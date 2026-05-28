"use client";

import { Html5Qrcode } from "html5-qrcode";
import { useEffect, useRef, useState } from "react";

export default function PointagePage() {
  const [records, setRecords] = useState<any[]>([]);
  const [actionType, setActionType] = useState("checkin");
  const [message, setMessage] = useState("");
  const [countdown, setCountdown] = useState(5);
  const [lastCode, setLastCode] = useState("");

  const scannerRef = useRef<Html5Qrcode | null>(null);

  const fetchAttendance = async () => {
    try {
      const res = await fetch("http://localhost:5050/attendance/today");

      const text = await res.text();

      try {
        const data = JSON.parse(text);
        setRecords(Array.isArray(data) ? data : []);
      } catch {
        console.error("Réponse backend invalide :", text);
        setRecords([]);
      }

      setCountdown(5);
    } catch (error) {
      console.error("Erreur fetch attendance :", error);
    }
  };

  const extractBadgeCode = (decodedText: string) => {
    try {
      const parsed = JSON.parse(decodedText);
      return parsed.badge_code || decodedText.trim();
    } catch {
      const match = decodedText.match(/TRIANGLE-EMP-\d+/);
      return match ? match[0] : decodedText.trim();
    }
  };

  const sendScan = async (decodedText: string) => {
    const badgeCode = extractBadgeCode(decodedText);

    if (!badgeCode || badgeCode === lastCode) return;

    setLastCode(badgeCode);

    try {
      const response = await fetch("http://localhost:5050/attendance/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          badge_code: badgeCode,
          action_type: actionType,
        }),
      });

      const text = await response.text();

      let data: any = {};

      try {
        data = JSON.parse(text);
      } catch {
        console.error("Réponse scan invalide :", text);
      }

      if (!response.ok) {
        setMessage(data.error || "Erreur scan QR");
      } else {
        setMessage(`${data.user?.fullname || "Employé"} - ${data.action} enregistré`);
        await fetchAttendance();
      }
    } catch (error) {
      console.error(error);
      setMessage("Erreur QR Code");
    }

    setTimeout(() => {
      setLastCode("");
    }, 3000);
  };

  useEffect(() => {
    fetchAttendance();

    const refresh = setInterval(fetchAttendance, 5000);

    const counter = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : 5));
    }, 1000);

    return () => {
      clearInterval(refresh);
      clearInterval(counter);
    };
  }, []);

  useEffect(() => {
    const startScanner = async () => {
      try {
        if (scannerRef.current) return;

        const scanner = new Html5Qrcode("reader");
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: {
              width: 250,
              height: 250,
            },
          },
          async (decodedText) => {
            await sendScan(decodedText);
          },
          () => {}
        );
      } catch (error) {
        console.error(error);
        setMessage("Impossible de démarrer la caméra.");
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [actionType, lastCode]);

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
        <h1 className="text-4xl font-bold">Pointage Employés</h1>
        <p className="text-gray-500">
          Mise à jour automatique dans {countdown} seconde(s)
        </p>
      </div>

      <div className="grid grid-cols-5 gap-5 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow">
          <p className="text-gray-500">Présents</p>
          <h2 className="text-4xl font-bold text-green-600">{present}</h2>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow">
          <p className="text-gray-500">Absents</p>
          <h2 className="text-4xl font-bold text-red-600">{absent}</h2>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow">
          <p className="text-gray-500">En pause</p>
          <h2 className="text-4xl font-bold text-yellow-600">{pause}</h2>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow">
          <p className="text-gray-500">Retards</p>
          <h2 className="text-4xl font-bold text-orange-600">{late}</h2>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow">
          <p className="text-gray-500">Salaire jour</p>
          <h2 className="text-2xl font-bold">
            {salaryTotal.toLocaleString()} FCFA
          </h2>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4">Scanner badge QR</h2>

        <select
          value={actionType}
          onChange={(e) => setActionType(e.target.value)}
          className="border p-4 rounded-xl w-full mb-4 text-black"
        >
          <option value="checkin">Début travail</option>
          <option value="pause_start">Début pause</option>
          <option value="pause_end">Fin pause</option>
          <option value="checkout">Fin travail</option>
        </select>

        <div id="reader" className="w-full overflow-hidden rounded-2xl border" />

        {message && (
          <div className="mt-4 bg-green-100 text-green-700 p-4 rounded-xl font-bold">
            {message}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow overflow-x-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Feuille de pointage du jour</h2>
            <p className="text-gray-500">
              Mise à jour automatique toutes les 5 secondes
            </p>
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
              <th className="p-4 text-left">Partir</th>
              <th className="p-4 text-left">Retard</th>
              <th className="p-4 text-left">Heures</th>
              <th className="p-4 text-left">Salaire</th>
            </tr>
          </thead>

          <tbody>
            {records.map((r) => (
              <tr key={r.user_id} className="border-t hover:bg-gray-50">
                <td className="p-4 font-bold">
                  {r.fullname}
                  <div className="text-xs text-gray-500">{r.role}</div>
                </td>

                <td className="p-4 font-mono text-sm">{r.badge_code || "-"}</td>

                <td className="p-4">
                  <span
                    className={`${statusColor(
                      r.status
                    )} px-4 py-2 rounded-full text-sm font-bold`}
                  >
                    {r.status}
                  </span>
                </td>

                <td className="p-4">{formatTime(r.check_in)}</td>
                <td className="p-4">{formatTime(r.break_out)}</td>
                <td className="p-4">{formatTime(r.break_in)}</td>
                <td className="p-4">{formatTime(r.check_out)}</td>

                <td className="p-4">
                  {Number(r.late_minutes || 0) > 0
                    ? `${r.late_minutes} min`
                    : "-"}
                </td>

                <td className="p-4">
                  {Number(r.worked_hours || 0) > 0
                    ? `${r.worked_hours} h`
                    : "-"}
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