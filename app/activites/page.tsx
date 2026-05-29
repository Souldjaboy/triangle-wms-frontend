"use client";

import { useEffect, useState } from "react";

export default function ActivitesPage() {
  const [activities, setActivities] = useState<any[]>([]);

  const fetchActivities = async () => {
    const response = await fetch("/api/activities");
    const data = await response.json();
    setActivities(data);
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold text-black mb-2">
        Activités utilisateurs
      </h1>

      <p className="text-gray-500 mb-8">
        Historique des actions effectuées dans le système.
      </p>

      <div className="bg-white rounded-2xl shadow p-6">
        <table className="w-full text-left">
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
      </div>
    </div>
  );
}
