"use client";

import { useEffect, useState } from "react";

export default function ProduitsPage() {
  const [produits, setProduits] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [userRole, setUserRole] = useState("");

  const isAdmin = userRole === "admin";
  const canAddProduct = userRole === "admin" || userRole === "magasinier";

  const [formData, setFormData] = useState({
    reference: "",
    name: "",
    category: "",
    stock: "",
    warehouse: "",
    status: "Disponible",
    unit: "pièce",
    weight: "",
    dimensions: "",
    barcode: "",
    description: "",
    minimum_stock: "5",
    image_url: "",
    is_active: true,
    location_id: "",
    location_code: "",
  });

const fetchProduits = async () => {
  const response = await fetch(
    "http://localhost:5050/products",
    {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    }
  );

  const data = await response.json();

  setProduits(Array.isArray(data) ? data : []);
};

const fetchLocations = async () => {
  const response = await fetch(
    "http://localhost:5050/locations"
  );

  const data = await response.json();

  setLocations(Array.isArray(data) ? data : []);
};

useEffect(() => {
  fetchProduits();
  fetchLocations();

  const savedUser = localStorage.getItem("user");

  if (savedUser) {
    const user = JSON.parse(savedUser);
    setUserRole(user.role);
  }
}, []);

  const handleChange = (e: any) => {
    const value =
      e.target.type === "checkbox" ? e.target.checked : e.target.value;

    setFormData({
      ...formData,
      [e.target.name]: value,
    });
  };

  const handleLocationSelect = (locationId: string) => {
    const selectedLocation: any = locations.find(
      (location: any) => String(location.id) === String(locationId)
    );

    setFormData({
      ...formData,
      location_id: locationId,
      location_code: selectedLocation ? selectedLocation.emplacement_code : "",
      warehouse: selectedLocation ? selectedLocation.warehouse_code : "",
    });
  };

  const resetForm = () => {
    setEditingId(null);

    setFormData({
      reference: "",
      name: "",
      category: "",
      stock: "",
      warehouse: "",
      status: "Disponible",
      unit: "pièce",
      weight: "",
      dimensions: "",
      barcode: "",
      description: "",
      minimum_stock: "5",
      image_url: "",
      is_active: true,
      location_id: "",
      location_code: "",
    });
  };

const handleSubmit = async (e: any) => {
  e.preventDefault();

  if (!canAddProduct) {
    alert("Vous n'avez pas l'autorisation.");
    return;
  }

  const savedUser = localStorage.getItem("user");
  const user = savedUser ? JSON.parse(savedUser) : null;

  const payload = {
    ...formData,
    user_name: user?.fullname || "Utilisateur",
    user_role: user?.role || userRole,
  };

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  };

  let response;

  if (editingId) {
    if (!isAdmin) {
      alert("Seul l'administrateur peut modifier.");
      return;
    }

    response = await fetch(`http://localhost:5050/products/${editingId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
    });
  } else {
    response = await fetch("http://localhost:5050/products", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  }

  const data = await response.json();

  if (!response.ok) {
    alert(data.error || "Erreur enregistrement produit.");
    return;
  }

  resetForm();
  await fetchProduits();
};

  const handleEdit = (produit: any) => {
    if (!isAdmin) {
      alert("Seul l'administrateur peut modifier.");
      return;
    }

    setEditingId(produit.id);

    setFormData({
      reference: produit.reference || "",
      name: produit.name || "",
      category: produit.category || "",
      stock: String(produit.stock || ""),
      warehouse: produit.warehouse || "",
      status: produit.status || "Disponible",
      unit: produit.unit || "pièce",
      weight: String(produit.weight || ""),
      dimensions: produit.dimensions || "",
      barcode: produit.barcode || "",
      description: produit.description || "",
      minimum_stock: String(produit.minimum_stock || "5"),
      image_url: produit.image_url || "",
      is_active: produit.is_active !== false,
      location_id: produit.location_id ? String(produit.location_id) : "",
      location_code: produit.location_code || produit.emplacement_code || "",
    });
  };

  const handleDelete = async (id: number) => {
    if (!isAdmin) {
      alert("Seul l'administrateur peut supprimer.");
      return;
    }

    await fetch(`http://localhost:5050/products/${id}`, {
      method: "DELETE",
    });

    fetchProduits();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold text-black mb-2">
        Produits
      </h1>

      <p className="text-gray-500 mb-2">
        Gestion des références produits, images et emplacements.
      </p>

      <p className="text-sm text-gray-500 mb-8">
        Rôle connecté : {userRole || "non connecté"}
      </p>

      {canAddProduct && (
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-2xl shadow mb-10 grid grid-cols-3 gap-4"
        >
          <input
            type="text"
            name="reference"
            placeholder="Référence produit"
            value={formData.reference}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
            required
          />

          <input
            type="text"
            name="name"
            placeholder="Nom produit"
            value={formData.name}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
            required
          />

          <input
            type="text"
            name="category"
            placeholder="Catégorie"
            value={formData.category}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
          />

          <select
            name="unit"
            value={formData.unit}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
          >
            <option value="pièce">Pièce</option>
            <option value="carton">Carton</option>
            <option value="kg">Kg</option>
            <option value="litre">Litre</option>
            <option value="palette">Palette</option>
          </select>

          <input
            type="number"
            name="weight"
            placeholder="Poids"
            value={formData.weight}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
          />

          <input
            type="text"
            name="dimensions"
            placeholder="Dimensions"
            value={formData.dimensions}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
          />

          <input
            type="text"
            name="barcode"
            placeholder="Code-barres"
            value={formData.barcode}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
          />

          <input
            type="number"
            name="stock"
            placeholder="Stock initial"
            value={formData.stock}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
          />

          <input
            type="number"
            name="minimum_stock"
            placeholder="Stock minimum"
            value={formData.minimum_stock}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
          />

          <input
            type="text"
            name="image_url"
            placeholder="URL image produit"
            value={formData.image_url}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
          />

          <select
            name="location_id"
            value={formData.location_id}
            onChange={(e) => handleLocationSelect(e.target.value)}
            className="border p-3 rounded-xl text-black"
          >
            <option value="">Choisir emplacement</option>

            {locations.map((location: any) => (
              <option key={location.id} value={location.id}>
                {location.emplacement_code}
              </option>
            ))}
          </select>

          <input
            type="text"
            name="warehouse"
            placeholder="Entrepôt automatique"
            value={formData.warehouse}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
            readOnly
          />

          <input
            type="text"
            name="location_code"
            placeholder="Code emplacement automatique"
            value={formData.location_code}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
            readOnly
          />

          <textarea
            name="description"
            placeholder="Description produit"
            value={formData.description}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
          />

          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
          >
            <option value="Disponible">Disponible</option>
            <option value="Faible">Faible</option>
            <option value="Rupture">Rupture</option>
          </select>

          <label className="flex items-center gap-3 text-black">
            <input
              type="checkbox"
              name="is_active"
              checked={formData.is_active}
              onChange={handleChange}
            />
            Produit actif
          </label>

          <button
            type="submit"
            className={`font-bold rounded-xl py-3 ${
              editingId
                ? "bg-blue-500 text-white"
                : "bg-yellow-500 text-black"
            }`}
          >
            {editingId ? "Enregistrer modification" : "Ajouter produit"}
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
          Liste des produits
        </h2>

        <table className="w-full text-left">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="py-3">Image</th>
              <th>Référence</th>
              <th>Produit</th>
              <th>Catégorie</th>
              <th>Stock</th>
              <th>Min</th>
              <th>Entrepôt</th>
              <th>Emplacement</th>
              <th>Statut</th>
              {isAdmin && <th>Actions</th>}
            </tr>
          </thead>

          <tbody>
            {produits.map((produit: any) => (
              <tr key={produit.id} className="border-b">
                <td className="py-4">
                  {produit.image_url ? (
                    <img
                      src={produit.image_url}
                      alt={produit.name}
                      className="w-16 h-16 object-cover rounded-xl border"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-200 rounded-xl flex items-center justify-center text-xs text-gray-500">
                      Aucune
                    </div>
                  )}
                </td>

                <td className="font-bold">{produit.reference}</td>
                <td>{produit.name}</td>
                <td>{produit.category}</td>
                <td>{produit.stock}</td>
                <td>{produit.minimum_stock}</td>
                <td>{produit.warehouse}</td>

                <td className="font-bold text-blue-600">
                  {produit.location_code || produit.emplacement_code || "-"}
                </td>

                <td className="font-bold">{produit.status}</td>

                {isAdmin && (
                  <td className="space-x-2">
                    <button
                      onClick={() => handleEdit(produit)}
                      className="bg-blue-500 text-white px-4 py-2 rounded-lg"
                    >
                      Modifier
                    </button>

                    <button
                      onClick={() => handleDelete(produit.id)}
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
