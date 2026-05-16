"use client";

import { useEffect, useState } from "react";

export default function NotificationsPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);

  const fetchNotifications = async (userId: number) => {
    const res = await fetch(`http://localhost:5050/notifications/${userId}`);
    const data = await res.json();
    setNotifications(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    const savedUser = localStorage.getItem("user");

    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      fetchNotifications(user.id);
    }
  }, []);

  const markAsRead = async (id: number) => {
    await fetch(`http://localhost:5050/notifications/${id}/read`, {
      method: "PUT",
    });

    if (currentUser) {
      fetchNotifications(currentUser.id);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-100 p-8 text-black">
        Vous devez être connecté.
      </div>
    );
  }

  const unreadCount = notifications.filter((n: any) => !n.is_read).length;

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold text-black mb-2">
        Notifications
      </h1>

      <p className="text-gray-500 mb-8">
        Centre des notifications internes du système.
      </p>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow">
          <p className="text-gray-500">Total notifications</p>
          <h2 className="text-3xl font-bold text-black">
            {notifications.length}
          </h2>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow">
          <p className="text-gray-500">Non lues</p>
          <h2 className="text-3xl font-bold text-red-500">
            {unreadCount}
          </h2>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow">
          <p className="text-gray-500">Utilisateur</p>
          <h2 className="text-xl font-bold text-blue-600">
            {currentUser.fullname}
          </h2>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-2xl font-bold text-black mb-5">
          Liste des notifications
        </h2>

        {notifications.length === 0 ? (
          <p className="text-gray-500">
            Aucune notification pour le moment.
          </p>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification: any) => (
              <div
                key={notification.id}
                className={`border rounded-xl p-4 ${
                  notification.is_read ? "bg-white" : "bg-yellow-50"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-black">
                      {notification.title}
                    </p>

                    <p className="text-gray-600 mt-1">
                      {notification.message}
                    </p>

                    <p className="text-sm text-gray-400 mt-2">
                      Type : {notification.type} |{" "}
                      {notification.created_at
                        ? new Date(notification.created_at).toLocaleString("fr-FR")
                        : "-"}
                    </p>
                  </div>

                  {!notification.is_read && (
                    <button
                      onClick={() => markAsRead(notification.id)}
                      className="bg-black text-white px-4 py-2 rounded-xl font-bold"
                    >
                      Marquer comme lu
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}