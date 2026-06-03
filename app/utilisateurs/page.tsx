"use client";

import { useEffect, useState } from "react";

type UserForm = {
  fullname: string;
  email: string;
  password: string;
  role: string;
  phone: string;
  is_active: boolean;
};

const emptyForm: UserForm = {
  fullname: "",
  email: "",
  password: "",
  role: "magasinier",
  phone: "",
  is_active: true,
};

export default function UtilisateursPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  });

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users", {
        headers: authHeaders(),
      });
      const data = await response.json();

      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      setUsers([]);
      setMessageType("error");
      setMessage("Erreur chargement utilisateurs.");
    }
  };

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
    fetchUsers();
  }, []);

  const isSuperAdmin =
    currentUser?.is_super_admin === true ||
    String(currentUser?.role || "").toLowerCase() === "super_admin";

  const handleChange = (event: any) => {
    const { name, value, type, checked } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (event: any) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        editingId ? `/api/users/${editingId}` : "/api/users",
        {
          method: editingId ? "PUT" : "POST",
          headers: authHeaders(),
          body: JSON.stringify(form),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessageType("error");
        setMessage(data.error || "Erreur enregistrement utilisateur.");
        return;
      }

      setMessageType("success");
      setMessage(editingId ? "Utilisateur modifié." : "Utilisateur ajouté.");
      resetForm();
      await fetchUsers();
    } catch (error) {
      console.error(error);
      setMessageType("error");
      setMessage("Erreur serveur.");
    } finally {
      setLoading(false);
    }
  };

  const editUser = (user: any) => {
    setEditingId(user.id);
    setForm({
      fullname: user.fullname || "",
      email: user.email || "",
      password: "",
      role: user.role || "magasinier",
      phone: user.phone || "",
      is_active: user.is_active !== false,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteUser = async (id: number) => {
    if (!confirm("Supprimer cet utilisateur ?")) return;

    try {
      const response = await fetch(`/api/users/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessageType("error");
        setMessage(data.error || "Erreur suppression utilisateur.");
        return;
      }

      setMessageType("success");
      setMessage("Utilisateur supprimé.");
      await fetchUsers();
    } catch (error) {
      console.error(error);
      setMessageType("error");
      setMessage("Erreur serveur.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8 text-black">
      <h1 className="text-4xl font-bold mb-2">Utilisateurs</h1>
      <p className="text-gray-500 mb-8">
        Ajouter, modifier, supprimer les comptes et gérer les rôles.
      </p>

      {message && (
        <div
          className={`p-4 rounded-xl mb-6 font-bold ${
            messageType === "success"
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {message}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow p-6 grid grid-cols-3 gap-4 mb-8"
      >
        <input
          name="fullname"
          placeholder="Nom complet"
          value={form.fullname}
          onChange={handleChange}
          className="border p-3 rounded-xl"
          required
        />
        <input
          name="email"
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          className="border p-3 rounded-xl"
          required
        />
        <input
          name="phone"
          placeholder="Téléphone"
          value={form.phone}
          onChange={handleChange}
          className="border p-3 rounded-xl"
        />
        <input
          name="password"
          type="password"
          placeholder={editingId ? "Nouveau mot de passe (optionnel)" : "Mot de passe"}
          value={form.password}
          onChange={handleChange}
          className="border p-3 rounded-xl"
          required={!editingId}
        />
        <select
          name="role"
          value={form.role}
          onChange={handleChange}
          className="border p-3 rounded-xl"
        >
          <option value="magasinier">Magasinier</option>
          <option value="employe">Employé</option>
          <option value="responsable_entrepot">Responsable d’entrepôt</option>
          <option value="caissier">Caissier</option>
          <option value="direction">Direction</option>
          <option value="client">Client</option>
          <option value="admin">Admin</option>
          {isSuperAdmin && <option value="super_admin">Super Admin</option>}
        </select>
        <label className="flex items-center gap-3 border p-3 rounded-xl">
          <input
            type="checkbox"
            name="is_active"
            checked={form.is_active}
            onChange={handleChange}
          />
          Compte actif
        </label>

        <div className="col-span-3 flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="bg-yellow-500 text-black font-bold px-6 py-3 rounded-xl"
          >
            {loading
              ? "Enregistrement..."
              : editingId
                ? "Modifier utilisateur"
                : "Ajouter utilisateur"}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="bg-gray-200 text-black font-bold px-6 py-3 rounded-xl"
            >
              Annuler
            </button>
          )}
        </div>
      </form>

      <div className="bg-white rounded-2xl shadow overflow-x-auto">
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold">Liste des utilisateurs</h2>
        </div>

        <table className="w-full text-left">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              <th className="p-4">Nom</th>
              <th className="p-4">Email</th>
              <th className="p-4">Rôle</th>
              <th className="p-4">Badge</th>
              <th className="p-4">Statut</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t hover:bg-gray-50">
                <td className="p-4 font-bold">{user.fullname}</td>
                <td className="p-4">{user.email}</td>
                <td className="p-4">{user.role}</td>
                <td className="p-4 font-mono text-sm">{user.badge_code || "-"}</td>
                <td className="p-4">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-bold ${
                      user.is_active !== false
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {user.is_active !== false ? "Actif" : "Inactif"}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => editUser(user)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => deleteUser(user.id)}
                      className="bg-red-600 text-white px-4 py-2 rounded-xl font-bold"
                    >
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <p className="p-6 text-gray-500">Aucun utilisateur trouvé.</p>
        )}
      </div>
    </div>
  );
}
