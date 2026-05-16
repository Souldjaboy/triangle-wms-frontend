"use client";

import { useEffect, useState } from "react";

export default function EntrepotsPage() {
  const [warehouses, setWarehouses] = useState([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [userRole, setUserRole] = useState("");

  const isAdmin = userRole === "admin";

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    location: "",
    manager: "",
    racks_count: "",
    status: "Actif",
  });

  const fetchWarehouses = async () => {
    const response = await fetch("http://localhost:5050/warehouses");
    const data = await response.json();
    setWarehouses(data);
  };

  useEffect(() => {
    fetchWarehouses();

    const savedUser = localStorage.getItem("user");

    if (savedUser) {
      const user = JSON.parse(savedUser);
      setUserRole(user.role);
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

    if (!isAdmin) {
      alert("Vous n'avez pas l'autorisation.");
      return;
    }

    if (editingId) {
      await fetch(`http://localhost:5050/warehouses/${editingId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });
    } else {
      await fetch("http://localhost:5050/warehouses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });
    }

    resetForm();
    fetchWarehouses();
  };

  const handleEdit = (warehouse: any) => {
    if (!isAdmin) return;

    setEditingId(warehouse.id);

    setFormData({
      code: warehouse.code,
      name: warehouse.name,
      location: warehouse.location,
      manager: warehouse.manager,
      racks_count: String(warehouse.racks_count || ""),
      status: warehouse.status,
    });
  };

  const handleDelete = async (id: number) => {
    if (!isAdmin) {
      alert("Vous n'avez pas l'autorisation.");
      return;
    }

    await fetch(`http://localhost:5050/warehouses/${id}`, {
      method: "DELETE",
    });

    fetchWarehouses();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">

      <h1 className="text-4xl font-bold text-black mb-2">
        Entrepôts
      </h1>

      <p className="text-gray-500 mb-2">
        Gestion des entrepôts, rayons, responsables et statuts.
      </p>

      <p className="text-sm text-gray-500 mb-8">
        Rôle connecté : {userRole || "non connecté"}
      </p>

      {isAdmin && (
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-2xl shadow mb-10 grid grid-cols-3 gap-4"
        >
          <input
            type="text"
            name="code"
            placeholder="Code entrepôt ex: W-001"
            value={formData.code}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
            required
          />

          <input
            type="text"
            name="name"
            placeholder="Nom entrepôt"
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
            placeholder="Nombre de rayons / racks"
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
            <option value="Saturé">Saturé</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Inactif">Inactif</option>
          </select>

          <button
            type="submit"
            className={`font-bold rounded-xl py-3 ${
              editingId
                ? "bg-blue-500 text-white"
                : "bg-yellow-500 text-black"
            }`}
          >
            {editingId
              ? "Enregistrer modification"
              : "Ajouter entrepôt"}
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
      )}

      <div className="bg-white rounded-2xl shadow p-6">

        <h2 className="text-2xl font-bold text-black mb-5">
          Liste des entrepôts
        </h2>

        <table className="w-full text-left">

          <thead>
            <tr className="border-b text-gray-500">
              <th className="py-3">Code</th>
              <th>Nom</th>
              <th>Localisation</th>
              <th>Responsable</th>
              <th>Rayons / Racks</th>
              <th>Statut</th>
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>

          <tbody>
            {warehouses.map((warehouse: any) => (
              <tr key={warehouse.id} className="border-b">

                <td className="py-4 font-bold">
                  {warehouse.code}
                </td>

                <td>{warehouse.name}</td>

                <td>{warehouse.location}</td>

                <td>{warehouse.manager}</td>

                <td className="font-bold text-blue-600">
                  {warehouse.racks_count || 0}
                </td>

                <td className="font-bold">
                  {warehouse.status}
                </td>

                {isAdmin && (
                  <td className="space-x-2">

                    <button
                      onClick={() => handleEdit(warehouse)}
                      className="bg-blue-500 text-white px-4 py-2 rounded-lg"
                    >
                      Modifier
                    </button>

                    <button
                      onClick={() => handleDelete(warehouse.id)}
                      className="bg-red-500 text-white px-4 py-2 rounded-lg"
                    >
                      Supprimer
                    </button>

                  </td>
                )}

              </tr>
            ))}
          </tbody>

        </table>

      </div>

    </div>
  );
}