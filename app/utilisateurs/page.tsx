"use client";

import { useEffect, useState } from "react";

export default function UtilisateursPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const [formData, setFormData] = useState({
    fullname: "",
    email: "",
    password: "",
    role: "magasinier",
    is_active: true,
    profile_image_url: "",
  });

  const fetchUsers = async () => {
    try {
      const response = await fetch("http://localhost:5050/users");
      const data = await response.json();

      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      setUsers([]);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleChange = (e: any) => {
    const value =
      e.target.type === "checkbox" ? e.target.checked : e.target.value;

    setFormData({
      ...formData,
      [e.target.name]: value,
    });
  };

  const handlePhotoUpload = async (e: any) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setUploading(true);
    setMessage("");

    const uploadData = new FormData();
    uploadData.append("photo", file);

    const response = await fetch("http://localhost:5050/upload-user-photo", {
      method: "POST",
      body: uploadData,
    });

    const data = await response.json();

    if (data.profile_image_url) {
      setFormData({
        ...formData,
        profile_image_url: data.profile_image_url,
      });

      setMessage("Photo uploadée avec succès.");
    }

    setUploading(false);
  };

  const resetForm = () => {
    setEditingId(null);

    setFormData({
      fullname: "",
      email: "",
      password: "",
      role: "magasinier",
      is_active: true,
      profile_image_url: "",
    });
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    if (editingId) {
      await fetch(`http://localhost:5050/users/${editingId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });
    } else {
      await fetch("http://localhost:5050/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });
    }

    setMessage(
      editingId
        ? "Utilisateur modifié avec succès."
        : "Utilisateur ajouté avec succès."
    );

    resetForm();
    fetchUsers();
  };

  const handleEdit = (user: any) => {
    setEditingId(user.id);

    setFormData({
      fullname: user.fullname || "",
      email: user.email || "",
      password: "",
      role: user.role || "magasinier",
      is_active: user.is_active !== false,
      profile_image_url: user.profile_image_url || "",
    });
  };

  const handleDelete = async (id: number) => {
    await fetch(`http://localhost:5050/users/${id}`, {
      method: "DELETE",
    });

    setMessage("Utilisateur supprimé.");
    fetchUsers();
  };

  const getRoleColor = (role: string) => {
    if (role === "admin") return "bg-red-100 text-red-700";
    if (role === "responsable_logistique") return "bg-blue-100 text-blue-700";
    if (role === "chef_magasin") return "bg-purple-100 text-purple-700";
    if (role === "direction") return "bg-green-100 text-green-700";
    return "bg-yellow-100 text-yellow-700";
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold text-black mb-2">
        Utilisateurs
      </h1>

      <p className="text-gray-500 mb-8">
        Gestion des comptes, rôles, photos et accès au système.
      </p>

      {message && (
        <div className="bg-green-100 text-green-700 p-4 rounded-xl mb-6 font-bold">
          {message}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-2xl shadow mb-10 grid grid-cols-3 gap-4"
      >
        <div className="col-span-3 flex items-center gap-6 border rounded-2xl p-4">
          {formData.profile_image_url ? (
            <img
              src={formData.profile_image_url}
              alt="Photo utilisateur"
              className="w-24 h-24 object-cover rounded-full border"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-4xl">
              👤
            </div>
          )}

          <div className="flex-1">
            <p className="font-bold text-black mb-2">
              Photo utilisateur
            </p>

            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="border p-3 rounded-xl text-black w-full"
            />

            {uploading && (
              <p className="text-blue-600 font-bold mt-2">
                Upload en cours...
              </p>
            )}

            <input
              type="text"
              name="profile_image_url"
              placeholder="URL photo utilisateur"
              value={formData.profile_image_url}
              onChange={handleChange}
              className="border p-3 rounded-xl text-black w-full mt-3"
            />
          </div>
        </div>

        <input
          type="text"
          name="fullname"
          placeholder="Nom complet"
          value={formData.fullname}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
          required
        />

        <input
          type="email"
          name="email"
          placeholder="Adresse email"
          value={formData.email}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
          required
        />

        <input
          type="text"
          name="password"
          placeholder={
            editingId ? "Nouveau mot de passe optionnel" : "Mot de passe"
          }
          value={formData.password}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
          required={!editingId}
        />

        <select
          name="role"
          value={formData.role}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
        >
          <option value="admin">Administrateur</option>
          <option value="responsable_logistique">Responsable logistique</option>
          <option value="chef_magasin">Chef magasin</option>
          <option value="magasinier">Magasinier</option>
          <option value="direction">Direction</option>
        </select>

        <label className="flex items-center gap-3 text-black">
          <input
            type="checkbox"
            name="is_active"
            checked={formData.is_active}
            onChange={handleChange}
          />
          Compte actif
        </label>

        <button
          type="submit"
          className={`font-bold rounded-xl py-3 ${
            editingId ? "bg-blue-500 text-white" : "bg-yellow-500 text-black"
          }`}
        >
          {editingId ? "Modifier utilisateur" : "Ajouter utilisateur"}
        </button>

        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            className="bg-gray-500 text-white font-bold rounded-xl py-3"
          >
            Annuler
          </button>
        )}
      </form>

      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-2xl font-bold text-black mb-5">
          Liste des utilisateurs
        </h2>

        {users.length === 0 ? (
          <p className="text-gray-500">
            Aucun utilisateur trouvé.
          </p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="py-3">Photo</th>
                <th>Nom</th>
                <th>Email</th>
                <th>Rôle</th>
                <th>Statut</th>
                <th>Date création</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {users.map((user: any) => (
                <tr key={user.id} className="border-b">
                  <td className="py-4">
                    {user.profile_image_url ? (
                      <img
                        src={user.profile_image_url}
                        alt={user.fullname}
                        className="w-14 h-14 object-cover rounded-full border"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center text-2xl">
                        👤
                      </div>
                    )}
                  </td>

                  <td className="font-bold">{user.fullname}</td>

                  <td>{user.email}</td>

                  <td>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-bold ${getRoleColor(
                        user.role
                      )}`}
                    >
                      {user.role}
                    </span>
                  </td>

                  <td>
                    {user.is_active ? (
                      <span className="text-green-600 font-bold">Actif</span>
                    ) : (
                      <span className="text-red-600 font-bold">Inactif</span>
                    )}
                  </td>

                  <td>
                    {user.created_at
                      ? new Date(user.created_at).toLocaleDateString("fr-FR")
                      : "-"}
                  </td>

                  <td className="space-x-2">
                    <button
                      onClick={() => handleEdit(user)}
                      className="bg-blue-500 text-white px-4 py-2 rounded-lg"
                    >
                      Modifier
                    </button>

                    <button
                      onClick={() => handleDelete(user.id)}
                      className="bg-red-500 text-white px-4 py-2 rounded-lg"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}