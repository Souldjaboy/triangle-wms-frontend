"use client";

import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

export default function BadgesPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [canViewBadges, setCanViewBadges] = useState(false);

  const fetchUsers = async () => {
    const storedUser = localStorage.getItem("user");
    const user = storedUser ? JSON.parse(storedUser) : null;
    const role = String(user?.role || "").toLowerCase();
    const allowed =
      user?.is_super_admin === true ||
      role === "super_admin" ||
      role === "admin";

    if (!allowed) {
      setCanViewBadges(false);
      setError("Accès refusé : les badges sont réservés à l’administrateur.");
      return;
    }

    setCanViewBadges(true);
    const response = await fetch("/api/users", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    const data = await response.json().catch(() => []);
    if (!response.ok) {
      setError(data.error || "Erreur chargement badges.");
      return;
    }
    setUsers(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const getQrValue = (user: any) => {
    return JSON.stringify({
      badge_code: user.badge_code || `TRIANGLE-EMP-${user.id}`,
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 p-10">
      <div className="flex justify-between items-center mb-8 print:hidden">
        <div>
          <h1 className="text-4xl font-bold text-black">Badges employés</h1>
          <p className="text-gray-500 mt-2">
            QR Code automatique pour le pointage par badge.
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="bg-black text-white px-6 py-3 rounded-xl font-bold"
        >
          Imprimer les badges
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-red-100 p-4 font-bold text-red-700">
          {error}
        </div>
      )}

      {!canViewBadges ? null : users.length === 0 ? (
        <p className="text-gray-500">Aucun utilisateur trouvé.</p>
      ) : (
        <div className="grid grid-cols-3 gap-8 print:grid-cols-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="bg-white rounded-2xl shadow p-6 border text-center"
            >
              <div className="text-sm font-bold text-yellow-600 mb-2">
                TRIANGLE WMS PRO
              </div>

              <div className="w-24 h-24 rounded-full bg-gray-200 mx-auto mb-4 overflow-hidden">
                {user.profile_image_url ? (
                  <img
                    src={user.profile_image_url}
                    alt={user.fullname}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">
                    Photo
                  </div>
                )}
              </div>

              <h2 className="text-2xl font-bold text-black">
                {user.fullname}
              </h2>

              <p className="text-gray-500 mb-4">{user.role}</p>

              <div className="flex justify-center mb-4">
                <QRCodeCanvas
                  value={getQrValue(user)}
                  size={170}
                  includeMargin
                />
              </div>

              <div className="bg-gray-100 rounded-xl p-3 text-black font-mono text-sm">
                {user.badge_code || `TRIANGLE-EMP-${user.id}`}
              </div>

              <p className="text-xs text-gray-400 mt-3">
                Scanner ce QR Code pour pointer.
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
