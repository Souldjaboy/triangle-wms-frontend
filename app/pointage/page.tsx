"use client";

import { useEffect, useState } from "react";

export default function PointagePage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const savedUser = localStorage.getItem("user");

    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);

      fetchHistory(user.id);
    }

    fetchAttendance();
  }, []);

  const fetchAttendance = async () => {
    const res = await fetch("http://localhost:5050/attendance/today");
    const data = await res.json();

    setAttendance(Array.isArray(data) ? data : []);
  };

  const fetchHistory = async (userId: number) => {
    const res = await fetch(
      `http://localhost:5050/attendance/history/${userId}`
    );

    const data = await res.json();

    setHistory(Array.isArray(data) ? data : []);
  };

  const handleCheck = async (actionType: string) => {
    if (!currentUser) return;

    const response = await fetch("http://localhost:5050/attendance/check", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: currentUser.id,
        action_type: actionType,
        device_info: navigator.userAgent,
        ip_address: "",
        location_info: "",
      }),
    });

    const data = await response.json();

    if (data.error) {
      setMessage(data.error);
    } else {
      setMessage(`Pointage ${actionType} effectué avec succès.`);
    }

    fetchAttendance();
    fetchHistory(currentUser.id);
  };

  const presentCount = attendance.filter(
    (a: any) =>
      a.status === "Présent" ||
      a.status === "En retard" ||
      a.status === "En pause"
  ).length;

  const lateCount = attendance.filter(
    (a: any) => a.status === "En retard"
  ).length;

  const pauseCount = attendance.filter(
    (a: any) => a.status === "En pause"
  ).length;

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold text-black mb-2">
        Pointage intelligent
      </h1>

      <p className="text-gray-500 mb-8">
        Gestion des présences, pauses, retards et débauches.
      </p>

      {message && (
        <div className="bg-yellow-100 text-black p-4 rounded-xl mb-6 font-bold">
          {message}
        </div>
      )}

      <div className="grid grid-cols-4 gap-6 mb-8">
        <Card title="Présents" value={presentCount} />
        <Card title="Retards" value={lateCount} />
        <Card title="En pause" value={pauseCount} />
        <Card title="Pointages jour" value={attendance.length} />
      </div>

      <div className="grid grid-cols-3 gap-8">
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-2xl font-bold text-black mb-5">
            Pointage employé
          </h2>

          {!currentUser ? (
            <p className="text-gray-500">
              Vous devez être connecté.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-6">
                {currentUser.profile_image_url ? (
                  <img
                    src={currentUser.profile_image_url}
                    alt={currentUser.fullname}
                    className="w-20 h-20 rounded-full object-cover border"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-3xl">
                    👤
                  </div>
                )}

                <div>
                  <p className="font-bold text-black text-xl">
                    {currentUser.fullname}
                  </p>

                  <p className="text-gray-500">
                    {currentUser.role}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <button
                  onClick={() => handleCheck("ARRIVEE")}
                  className="w-full bg-green-500 text-white font-bold py-4 rounded-xl"
                >
                  Pointer arrivée
                </button>

                <button
                  onClick={() => handleCheck("DEPART_PAUSE")}
                  className="w-full bg-yellow-500 text-black font-bold py-4 rounded-xl"
                >
                  Départ pause
                </button>

                <button
                  onClick={() => handleCheck("RETOUR_PAUSE")}
                  className="w-full bg-blue-500 text-white font-bold py-4 rounded-xl"
                >
                  Retour pause
                </button>

                <button
                  onClick={() => handleCheck("DEBAUCHE")}
                  className="w-full bg-black text-white font-bold py-4 rounded-xl"
                >
                  Débauche
                </button>
              </div>
            </>
          )}
        </div>

        <div className="col-span-2 bg-white rounded-2xl shadow p-6">
          <h2 className="text-2xl font-bold text-black mb-5">
            Présences du jour
          </h2>

          {attendance.length === 0 ? (
            <p className="text-gray-500">
              Aucun pointage aujourd’hui.
            </p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="py-3">Employé</th>
                  <th>Statut</th>
                  <th>Arrivée</th>
                  <th>Pause</th>
                  <th>Débauche</th>
                  <th>Retard</th>
                </tr>
              </thead>

              <tbody>
                {attendance.map((item: any) => (
                  <tr key={item.id} className="border-b">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        {item.profile_image_url ? (
                          <img
                            src={item.profile_image_url}
                            alt={item.fullname}
                            className="w-12 h-12 rounded-full object-cover border"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                            👤
                          </div>
                        )}

                        <div>
                          <p className="font-bold">
                            {item.fullname}
                          </p>

                          <p className="text-sm text-gray-500">
                            {item.role}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="font-bold">
                      {item.status}
                    </td>

                    <td>
                      {item.check_in
                        ? new Date(item.check_in).toLocaleTimeString("fr-FR")
                        : "-"}
                    </td>

                    <td>
                      {item.break_out
                        ? new Date(item.break_out).toLocaleTimeString("fr-FR")
                        : "-"}
                    </td>

                    <td>
                      {item.check_out
                        ? new Date(item.check_out).toLocaleTimeString("fr-FR")
                        : "-"}
                    </td>

                    <td className="text-red-500 font-bold">
                      {item.late_minutes || 0} min
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h2 className="text-2xl font-bold text-black mt-10 mb-5">
            Mon historique
          </h2>

          {history.length === 0 ? (
            <p className="text-gray-500">
              Aucun historique.
            </p>
          ) : (
            <div className="space-y-3">
              {history.map((item: any) => (
                <div
                  key={item.id}
                  className="border rounded-xl p-4"
                >
                  <p className="font-bold text-black">
                    {item.action_type}
                  </p>

                  <p className="text-sm text-gray-500">
                    {item.action_time
                      ? new Date(item.action_time).toLocaleString("fr-FR")
                      : "-"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ title, value }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow">
      <p className="text-gray-500">{title}</p>

      <h2 className="text-3xl font-bold text-black">
        {value}
      </h2>
    </div>
  );
}