"use client";

import { Html5Qrcode } from "html5-qrcode";
import { useCallback, useEffect, useRef, useState } from "react";

const API_URL = "/api";

type ActionType = "checkin" | "pause_start" | "pause_end" | "checkout";

const ACTION_LABEL: Record<ActionType, string> = {
  checkin: "Début travail",
  pause_start: "Début pause",
  pause_end: "Fin pause",
  checkout: "Fin travail",
};

export default function PointageQRCodePage() {
  const [records, setRecords] = useState<any[]>([]);
  const [actionType, setActionType] = useState<ActionType>("checkin");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [countdown, setCountdown] = useState(5);
  const [cameraReady, setCameraReady] = useState(false);

  const actionRef = useRef<ActionType>("checkin");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const startingRef = useRef(false);
  const lastScanRef = useRef<{ key: string; time: number }>({ key: "", time: 0 });

  const getHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  });

  const fetchAttendance = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/attendance/today`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      setRecords(Array.isArray(data) ? data : []);
      setCountdown(5);
    } catch (error) {
      console.error("Erreur fetch attendance :", error);
      setRecords([]);
    }
  }, []);

  const extractBadgeCode = (decodedText: string) => {
    const text = decodedText.trim();

    try {
      const parsed = JSON.parse(text);
      return String(
        parsed.badge_code ||
          parsed.badgeCode ||
          parsed.code ||
          parsed.badge ||
          text
      ).trim();
    } catch {
      const match = text.match(/TRIANGLE-EMP-[A-Za-z0-9-]+/);
      return match ? match[0] : text;
    }
  };

  const sendScan = useCallback(async (decodedText: string) => {
    const badgeCode = extractBadgeCode(decodedText);
    const selectedAction = actionRef.current;
    const scanKey = `${selectedAction}:${badgeCode}`;
    const now = Date.now();

    if (!badgeCode) return;

    if (lastScanRef.current.key === scanKey && now - lastScanRef.current.time < 2500) {
      return;
    }

    lastScanRef.current = { key: scanKey, time: now };

    try {
      const response = await fetch(`${API_URL}/attendance/scan`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          badge_code: badgeCode,
          action_type: selectedAction,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessageType("error");
        setMessage(data.error || `Erreur ${ACTION_LABEL[selectedAction]}`);
        return;
      }

      setMessageType("success");
      setMessage(
        `${data.user?.fullname || "Employé"} - ${
          data.action || ACTION_LABEL[selectedAction]
        } enregistré`
      );

      await fetchAttendance();
    } catch (error) {
      console.error(error);
      setMessageType("error");
      setMessage("Erreur QR Code ou serveur inaccessible.");
    }
  }, [fetchAttendance]);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setCameraReady(false);

    if (!scanner) return;

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
      scanner.clear();
    } catch (error) {
      console.error("Erreur arrêt caméra :", error);
    }
  }, []);

  const startScanner = useCallback(async () => {
    if (scannerRef.current || startingRef.current) return;

    startingRef.current = true;
    setCameraReady(false);

    try {
      const scanner = new Html5Qrcode("reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => sendScan(decodedText),
        () => {}
      );

      setCameraReady(true);
      setMessage("");
    } catch (error) {
      console.error(error);
      scannerRef.current = null;
      setCameraReady(false);
      setMessageType("error");
      setMessage("Impossible de démarrer la caméra. Vérifie l'autorisation caméra.");
    } finally {
      startingRef.current = false;
    }
  }, [sendScan]);

  const restartScanner = async () => {
    await stopScanner();
    await startScanner();
  };

  useEffect(() => {
    actionRef.current = actionType;
    setMessage("");
  }, [actionType]);

  useEffect(() => {
    fetchAttendance();

    const refresh = setInterval(fetchAttendance, 5000);
    const counter = setInterval(
      () => setCountdown((prev) => (prev > 1 ? prev - 1 : 5)),
      1000
    );

    return () => {
      clearInterval(refresh);
      clearInterval(counter);
    };
  }, [fetchAttendance]);

  useEffect(() => {
    startScanner();

    return () => {
      stopScanner();
    };
  }, [startScanner, stopScanner]);

  const formatTime = (value: string) => {
    if (!value) return "-";
    return new Date(value).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusColor = (status: string) => {
    if (status === "Présent") return "bg-green-600 text-white";
    if (status === "En pause") return "bg-yellow-500 text-black";
    if (status === "Terminé") return "bg-blue-600 text-white";
    return "bg-red-600 text-white";
  };

  const present = records.filter((r) => r.status === "Présent").length;
  const absent = records.filter((r) => r.status === "Absent").length;
  const pause = records.filter((r) => r.status === "En pause").length;
  const late = records.filter((r) => Number(r.late_minutes || 0) > 0).length;
  const salaryTotal = records.reduce(
    (sum, r) => sum + Number(r.calculated_salary || 0),
    0
  );

  return (
    <div className="min-h-screen bg-gray-100 p-8 text-black">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">Pointage QR</h1>
        <p className="text-gray-500">
          Mise à jour automatique dans {countdown} seconde(s)
        </p>
      </div>

      <div className="grid grid-cols-5 gap-5 mb-8">
        <Card title="Présents" value={present} className="text-green-600" />
        <Card title="Absents" value={absent} className="text-red-600" />
        <Card title="En pause" value={pause} className="text-yellow-600" />
        <Card title="Retards" value={late} className="text-orange-600" />
        <Card
          title="Salaire jour"
          value={`${salaryTotal.toLocaleString()} FCFA`}
          className="text-black text-2xl"
        />
      </div>

      <div className="bg-white rounded-2xl shadow p-6 mb-8">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-2xl font-bold">Scanner badge QR</h2>

          <button
            type="button"
            onClick={restartScanner}
            className="bg-black text-white px-4 py-2 rounded-xl font-bold"
          >
            Redémarrer caméra
          </button>
        </div>

        <select
          value={actionType}
          onChange={(e) => setActionType(e.target.value as ActionType)}
          className="border p-4 rounded-xl w-full mb-4 text-black"
        >
          <option value="checkin">Début travail</option>
          <option value="pause_start">Début pause</option>
          <option value="pause_end">Fin pause</option>
          <option value="checkout">Fin travail</option>
        </select>

        <div className="mb-3 text-sm font-bold text-gray-600">
          Action sélectionnée : {ACTION_LABEL[actionType]} | Caméra :{" "}
          {cameraReady ? "active" : "chargement"}
        </div>

        <div id="reader" className="w-full overflow-hidden rounded-2xl border min-h-[280px]" />

        {message && (
          <div
            className={`mt-4 p-4 rounded-xl font-bold ${
              messageType === "success"
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {message}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow overflow-x-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Feuille de pointage du jour</h2>
            <p className="text-gray-500">Mise à jour automatique toutes les 5 secondes</p>
          </div>

          <button
            onClick={() => window.print()}
            className="bg-black text-white px-6 py-3 rounded-xl font-bold"
          >
            Imprimer
          </button>
        </div>

        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-4 text-left">Employé</th>
              <th className="p-4 text-left">Badge</th>
              <th className="p-4 text-left">Statut</th>
              <th className="p-4 text-left">Arrivée</th>
              <th className="p-4 text-left">Pause sortie</th>
              <th className="p-4 text-left">Pause retour</th>
              <th className="p-4 text-left">Départ</th>
              <th className="p-4 text-left">Retard</th>
              <th className="p-4 text-left">Heures</th>
              <th className="p-4 text-left">Salaire</th>
            </tr>
          </thead>

          <tbody>
            {records.map((r) => (
              <tr key={r.user_id || r.id} className="border-t hover:bg-gray-50">
                <td className="p-4 font-bold">
                  {r.fullname}
                  <div className="text-xs text-gray-500">{r.role}</div>
                </td>
                <td className="p-4 font-mono text-sm">{r.badge_code || "-"}</td>
                <td className="p-4">
                  <span className={`${statusColor(r.status)} px-4 py-2 rounded-full text-sm font-bold`}>
                    {r.status}
                  </span>
                </td>
                <td className="p-4">{formatTime(r.check_in)}</td>
                <td className="p-4">{formatTime(r.break_out)}</td>
                <td className="p-4">{formatTime(r.break_in)}</td>
                <td className="p-4">{formatTime(r.check_out)}</td>
                <td className="p-4">
                  {Number(r.late_minutes || 0) > 0 ? `${r.late_minutes} min` : "-"}
                </td>
                <td className="p-4">
                  {Number(r.worked_hours || 0) > 0 ? `${r.worked_hours} h` : "-"}
                </td>
                <td className="p-4 font-bold">
                  {Number(r.calculated_salary || 0).toLocaleString()} FCFA
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ title, value, className }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow">
      <p className="text-gray-500">{title}</p>
      <h2 className={`text-4xl font-bold ${className}`}>{value}</h2>
    </div>
  );
}
