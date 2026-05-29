"use client";

import { useEffect, useState } from "react";

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    location: "",
    manager: "",
    racks_count: "",
    status: "Actif",
  });

  const fetchWarehouses = async () => {
    const response = await fetch("/api/warehouses", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    const data = await response.json();

    setWarehouses(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    fetchWarehouses();

    const savedUser = localStorage.getItem("user");

    if (savedUser) {
      const user = JSON.parse(savedUser);

      if (
        user.role === "admin" ||
        user.role === "super_admin" ||
        user.is_super_admin === true
      ) {
        setIsAdmin(true);
      }
    }
  }, []);

  const handleChange = (e: any) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const resetForm = () => {
    setEditingId(null);

    setFormData({
      code: "",
      name: "",
      location: "",
      manager: "",
      racks_count: "",
      status: "Actif",
    });
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setMessage("");

    if (!isAdmin) {
      alert("Vous n'avez pas l'autorisation.");
      return;
    }

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    };

    let response;

    if (editingId) {
      response = await fetch(`/api/warehouses/${editingId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(formData),
      });
    } else {
      response = await fetch("/api/warehouses", {
        method: "POST",
        headers,
        body: JSON.stringify(formData),
      });
    }

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "Erreur enregistrement entrepôt.");
      return;
    }

    setMessage(
      editingId
        ? "Entrepôt modifié avec succès."
        : "Entrepôt ajouté avec succès."
    );

    resetForm();
    await fetchWarehouses();
  };

  const editWarehouse = (warehouse: any) => {
    setEditingId(warehouse.id);

    setFormData({
      code: warehouse.code || "",
      name: warehouse.name || "",
      location: warehouse.location || "",
      manager: warehouse.manager || "",
      racks_count: warehouse.racks_count || "",
      status: warehouse.status || "Actif",
    });
  };

  const deleteWarehouse = async (id: number) => {
    if (!isAdmin) {
      alert("Vous n'avez pas l'autorisation.");
      return;
    }

    if (!confirm("Supprimer cet entrepôt ?")) return;

    await fetch(`/api/warehouses/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    await fetchWarehouses();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold text-black mb-2">
        Entrepôts
      </h1>

      <p className="text-gray-500 mb-8">
        Gestion des entrepôts de l’entreprise.
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
        <input
          type="text"
          name="code"
          placeholder="Code entrepôt ex: M001"
          value={formData.code}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
          required
        />

        <input
          type="text"
          name="name"
          placeholder="Nom de l’entrepôt"
          value={formData.name}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
          required
        />

        <input
          type="text"
          name="location"
          placeholder="Localisation"
          value={formData.location}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
        />

        <input
          type="text"
          name="manager"
          placeholder="Responsable"
          value={formData.manager}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
        />

        <input
          type="number"
          name="racks_count"
          placeholder="Nombre de rayons"
          value={formData.racks_count}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
        />

        <select
          name="status"
          value={formData.status}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
        >
          <option value="Actif">Actif</option>
          <option value="Inactif">Inactif</option>
        </select>

        <button
          type="submit"
          className="bg-yellow-500 text-black font-bold rounded-xl py-3 col-span-3"
        >
          {editingId ? "Modifier entrepôt" : "Ajouter entrepôt"}
        </button>
      </form>

      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-2xl font-bold text-black mb-5">
          Liste des entrepôts
        </h2>

        {warehouses.length === 0 ? (
          <p className="text-gray-500">Aucun entrepôt enregistré.</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="py-3">Code</th>
                <th>Nom</th>
                <th>Localisation</th>
                <th>Responsable</th>
                <th>Rayons</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {warehouses.map((warehouse: any) => (
                <tr key={warehouse.id} className="border-b">
                  <td className="py-4 font-bold">{warehouse.code}</td>
                  <td>{warehouse.name}</td>
                  <td>{warehouse.location || "-"}</td>
                  <td>{warehouse.manager || "-"}</td>
                  <td>{warehouse.racks_count || 0}</td>
                  <td>{warehouse.status}</td>
                  <td className="space-x-2">
                    <button
                      onClick={() => editWarehouse(warehouse)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold"
                    >
                      Modifier
                    </button>

                    <button
                      onClick={() => deleteWarehouse(warehouse.id)}
                      className="bg-red-600 text-white px-4 py-2 rounded-xl font-bold"
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