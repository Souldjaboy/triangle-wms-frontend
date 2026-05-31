"use client";

import { useEffect, useState } from "react";

export default function NotificationsPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);

  const fetchNotifications = async (userId: number) => {
    const res = await fetch(`/api/notifications/${userId}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
      },
    });
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
    await fetch(`/api/notifications/${id}/read`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
      },
    });

    if (currentUser) {
      fetchNotifications(currentUser.id);
    }
  };

  const canApprove =
    currentUser?.is_super_admin === true ||
    ["admin", "super_admin", "responsable_entrepot", "chef_entrepot"].includes(
      String(currentUser?.role || "").toLowerCase()
    );

  const refresh = () => {
    if (currentUser) fetchNotifications(currentUser.id);
  };

  const validateMovement = async (notification: any) => {
    const quantity = prompt("Quantité finale à valider", "");
    if (quantity === null) return;

    const response = await fetch(
      `/api/stock-movements/${notification.related_entity_id}/validate`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
        body: JSON.stringify({
          final_quantity: quantity ? Number(quantity) : undefined,
          correction_note: quantity ? "Validation depuis notification" : "",
        }),
      }
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) alert(data.error || "Erreur validation.");
    refresh();
  };

  const rejectMovement = async (notification: any) => {
    const reason = prompt("Motif du refus", "");
    if (reason === null) return;

    const response = await fetch(
      `/api/stock-movements/${notification.related_entity_id}/reject`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
        body: JSON.stringify({ rejection_reason: reason }),
      }
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) alert(data.error || "Erreur refus.");
    refresh();
  };

  const openNotification = async (notification: any) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    if (notification.action_url) {
      window.location.href = notification.action_url;
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
                  <button
                    type="button"
                    onClick={() => openNotification(notification)}
                    className="text-left flex-1"
                  >
                    <p className="font-bold text-black">
                      {notification.title}
                    </p>

                    <p className="text-gray-600 mt-1">
                      {notification.message}
                    </p>

                    <p className="text-sm text-gray-400 mt-2">
                      Type : {notification.type} |{" "}
                      Priorité : {notification.priority || "normal"} |{" "}
                      {notification.created_at
                        ? new Date(notification.created_at).toLocaleString("fr-FR")
                        : "-"}
                    </p>
                  </button>

                  <div className="flex gap-2">
                    {canApprove &&
                      notification.related_entity_type === "stock_movement" &&
                      String(notification.type || "").includes("pending") && (
                        <>
                          <button
                            onClick={() => validateMovement(notification)}
                            className="bg-green-600 text-white px-4 py-2 rounded-xl font-bold"
                          >
                            Valider
                          </button>
                          <button
                            onClick={() => rejectMovement(notification)}
                            className="bg-red-600 text-white px-4 py-2 rounded-xl font-bold"
                          >
                            Refuser
                          </button>
                        </>
                      )}

                    {notification.action_url && (
                      <button
                        onClick={() => openNotification(notification)}
                        className="bg-yellow-500 text-black px-4 py-2 rounded-xl font-bold"
                      >
                        Ouvrir
                      </button>
                    )}

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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
