"use client";

import { useEffect, useState } from "react";

export default function StocksPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [selectedType, setSelectedType] = useState("Entrée");
  const [userRole, setUserRole] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const [formData, setFormData] = useState({
    type: "Entrée",
    product_reference: "",
    product_name: "",
    location_code: "",
    current_stock: "",
    quantity: "",
    source_warehouse: "",
    destination_warehouse: "",
    reason: "",
  });

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  const fetchMovements = async () => {
    const response = await fetch("http://localhost:5050/stock-movements", {
      headers: authHeaders(),
    });

    const data = await response.json();
    setMovements(Array.isArray(data) ? data : []);
  };

  const fetchProducts = async () => {
    const response = await fetch("http://localhost:5050/products", {
      headers: authHeaders(),
    });

    const data = await response.json();
    setProducts(Array.isArray(data) ? data : []);
  };

  const fetchWarehouses = async () => {
    const response = await fetch("http://localhost:5050/warehouses", {
      headers: authHeaders(),
    });

    const data = await response.json();
    setWarehouses(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    fetchMovements();
    fetchProducts();
    fetchWarehouses();

    const savedUser = localStorage.getItem("user");

    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      setUserRole(user.role);

      if (
        user.role === "admin" ||
        user.role === "super_admin" ||
        user.is_super_admin === true
      ) {
        setIsAdmin(true);
      }
    }
  }, []);

  const selectMovementType = (type: string) => {
    setSelectedType(type);

    setFormData({
      ...formData,
      type,
      destination_warehouse: "",
      reason: "",
    });
  };

  const handleChange = (e: any) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleProductSelect = (reference: string) => {
    const product = products.find((p: any) => p.reference === reference);

    if (!product) return;

    setFormData({
      ...formData,
      product_reference: product.reference,
      product_name: product.name,
      current_stock: String(product.stock || 0),
      source_warehouse: product.warehouse || "",
      location_code:
        product.location_code ||
        product.emplacement_code ||
        "",
    });
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setMessage("");

    const payload = {
      type: selectedType,
      product_reference: formData.product_reference,
      product_name: formData.product_name,
      quantity: Number(formData.quantity || 0),
      source_warehouse: formData.source_warehouse,
      destination_warehouse: formData.destination_warehouse || "",
      reason: formData.reason || formData.location_code || "",
      status: "En attente",
      user_name: currentUser?.fullname || "Utilisateur",
      user_role: currentUser?.role || userRole || "Non défini",
    };

    const response = await fetch("http://localhost:5050/stock-movements", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessageType("error");
      setMessage(data.error || "Erreur création mouvement.");
      return;
    }

    setMessageType("success");
    setMessage(`Demande ${selectedType} créée avec succès.`);

    setFormData({
      type: selectedType,
      product_reference: "",
      product_name: "",
      location_code: "",
      current_stock: "",
      quantity: "",
      source_warehouse: "",
      destination_warehouse: "",
      reason: "",
    });

    fetchMovements();
    fetchProducts();
  };

  const validateMovement = async (id: number) => {
    const response = await fetch(`http://localhost:5050/stock-movements/${id}/validate`, {
      method: "PUT",
      headers: authHeaders(),
    });

    const data = await response.json().catch(() => ({}));
    setMessageType(response.ok ? "success" : "error");
    setMessage(response.ok ? "Mouvement validé et stock mis à jour." : data.error || "Erreur validation.");

    await fetchMovements();
    await fetchProducts();
  };

  const rejectMovement = async (id: number) => {
    const response = await fetch(`http://localhost:5050/stock-movements/${id}/reject`, {
      method: "PUT",
      headers: authHeaders(),
    });

    const data = await response.json().catch(() => ({}));
    setMessageType(response.ok ? "success" : "error");
    setMessage(response.ok ? "Mouvement refusé." : data.error || "Erreur refus.");

    await fetchMovements();
    await fetchProducts();
  };

  const getStatusColor = (status: string) => {
    if (status === "Validé") return "text-green-600";
    if (status === "Refusé") return "text-red-600";
    return "text-yellow-600";
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold text-black">
        Stocks
      </h1>

      <p className="text-gray-500 mt-2 mb-2">
        Suivi des entrées, sorties, transferts et inventaires avec emplacements.
      </p>

      <p className="text-sm text-gray-500 mb-8">
        Rôle connecté : {userRole || "non connecté"}
      </p>

      {message && (
        <div className={`p-4 rounded-xl mb-6 font-bold ${
          messageType === "success"
            ? "bg-green-100 text-green-700"
            : "bg-red-100 text-red-700"
        }`}>
          {message}
        </div>
      )}

      <div className="flex gap-3 mb-8">
        {["Entrée", "Sortie", "Transfert", "Inventaire"].map((type) => (
          <button
            key={type}
            onClick={() => selectMovementType(type)}
            className={`px-5 py-3 rounded-xl font-bold ${
              selectedType === type
                ? "bg-yellow-500 text-black"
                : "bg-white text-black"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-2xl shadow mb-10 grid grid-cols-3 gap-4"
      >
        <select
          name="product_reference"
          value={formData.product_reference}
          onChange={(e) => handleProductSelect(e.target.value)}
          className="border p-3 rounded-xl text-black"
          required
        >
          <option value="">Choisir produit</option>

          {products.map((product: any) => (
            <option key={product.id} value={product.reference}>
              {product.reference} - {product.name} | Stock : {product.stock} |{" "}
              {product.location_code ||
                product.emplacement_code ||
                "Aucun emplacement"}
            </option>
          ))}
        </select>

        <input
          type="text"
          name="product_name"
          placeholder="Nom produit"
          value={formData.product_name}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
          readOnly
        />

        <input
          type="text"
          name="location_code"
          placeholder="Emplacement exact"
          value={formData.location_code}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
          readOnly
        />

        <input
          type="text"
          name="current_stock"
          placeholder="Stock actuel"
          value={formData.current_stock}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
          readOnly
        />

        <input
          type="number"
          min="0"
          step="1"
          name="quantity"
          placeholder={
            selectedType === "Inventaire"
              ? "Stock réel compté"
              : "Quantité"
          }
          value={formData.quantity}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
          required
        />

        <select
          name="source_warehouse"
          value={formData.source_warehouse}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
          required
        >
          <option value="">Choisir entrepôt source</option>

          {warehouses.map((warehouse: any) => (
            <option key={warehouse.id} value={warehouse.name}>
              {warehouse.code} - {warehouse.name}
            </option>
          ))}
        </select>

        {selectedType === "Transfert" && (
          <select
            name="destination_warehouse"
            value={formData.destination_warehouse}
            onChange={handleChange}
            className="border p-3 rounded-xl text-black"
            required
          >
            <option value="">Choisir entrepôt destination</option>

            {warehouses.map((warehouse: any) => (
              <option key={warehouse.id} value={warehouse.name}>
                {warehouse.code} - {warehouse.name}
              </option>
            ))}
          </select>
        )}

        <input
          type="text"
          name="reason"
          placeholder="Motif / observation"
          value={formData.reason}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
        />

        <button
          type="submit"
          className="bg-yellow-500 text-black font-bold rounded-xl py-3"
        >
          Créer demande {selectedType}
        </button>
      </form>

      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow">
          <p className="text-gray-500">Produits</p>
          <h2 className="text-3xl font-bold text-blue-500">
            {products.length}
          </h2>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow">
          <p className="text-gray-500">Entrepôts</p>
          <h2 className="text-3xl font-bold text-purple-500">
            {warehouses.length}
          </h2>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow">
          <p className="text-gray-500">En attente</p>
          <h2 className="text-3xl font-bold text-yellow-600">
            {movements.filter((m: any) => m.status === "En attente").length}
          </h2>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow">
          <p className="text-gray-500">Validés</p>
          <h2 className="text-3xl font-bold text-green-600">
            {movements.filter((m: any) => m.status === "Validé").length}
          </h2>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-2xl font-bold text-black mb-5">
          Historique des mouvements
        </h2>

        <table className="w-full text-left">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="py-3">Type</th>
              <th>Produit</th>
              <th>Quantité</th>
              <th>Source</th>
              <th>Destination</th>
              <th>Observation / Emplacement</th>
              <th>Statut</th>
              {isAdmin && <th>Validation</th>}
            </tr>
          </thead>

          <tbody>
            {movements.map((movement: any) => (
              <tr key={movement.id} className="border-b">
                <td className="py-4 font-bold">
                  {movement.type}
                </td>

                <td>
                  {movement.product_reference} - {movement.product_name}
                </td>

                <td>{movement.quantity}</td>
                <td>{movement.source_warehouse}</td>
                <td>{movement.destination_warehouse || "-"}</td>
                <td>{movement.reason || "-"}</td>

                <td className={`font-bold ${getStatusColor(movement.status)}`}>
                  {movement.status}
                </td>

                {isAdmin && (
                  <td className="space-x-2">
                    {movement.status === "En attente" ? (
                      <>
                        <button
                          onClick={() => validateMovement(movement.id)}
                          className="bg-green-500 text-white px-4 py-2 rounded-xl font-bold"
                        >
                          Valider
                        </button>

                        <button
                          onClick={() => rejectMovement(movement.id)}
                          className="bg-red-500 text-white px-4 py-2 rounded-xl font-bold"
                        >
                          Refuser
                        </button>
                      </>
                    ) : (
                      <span className="text-gray-400">Déjà traité</span>
                    )}
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
