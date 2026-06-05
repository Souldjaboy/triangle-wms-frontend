"use client";

import { useEffect, useState } from "react";
import { authFetch } from "../lib/api";

export default function ActivitesPage() {
  const [activities, setActivities] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  const fetchActivities = async () => {
    setMessage("");
    const response = await authFetch("/activities");
    const data = await response.json().catch(() => []);

    if (!response.ok) {
      setMessage(data?.error || "Impossible de charger les activités.");
      setActivities([]);
      return;
    }

    setActivities(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-4 text-black md:p-8">
      <h1 className="text-4xl font-bold text-black mb-2">
        Activités utilisateurs
      </h1>

      <p className="text-gray-500 mb-8">
        Historique des actions effectuées dans le système.
      </p>

      {message && (
        <div className="mb-5 rounded-xl bg-red-50 p-4 font-bold text-red-700">
          {message}
        </div>
      )}

      <div className="overflow-x-auto bg-white rounded-2xl shadow p-4 md:p-6">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="py-3">Utilisateur</th>
              <th>Rôle</th>
              <th>Action</th>
              <th>Module</th>
              <th>Détails</th>
              <th>Date</th>
            </tr>
          </thead>

          <tbody>
            {activities.map((activity: any) => (
              <tr key={activity.id} className="border-b">
                <td className="py-4 font-bold">{activity.user_name}</td>
                <td>{activity.user_role}</td>
                <td>{activity.action}</td>
                <td>{activity.module}</td>
                <td>{activity.details}</td>
                <td>
                  {new Date(activity.created_at).toLocaleString("fr-FR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {activities.length === 0 && !message && (
          <div className="p-6 text-center font-bold text-gray-500">
            Aucune activité enregistrée.
          </div>
        )}
      </div>
    </div>
  );
}
