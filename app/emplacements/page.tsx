"use client";

import { useEffect, useState } from "react";

export default function EmplacementsPage() {
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);

  const [formData, setFormData] = useState({
    warehouse_id: "",
    zone: "",
    rayon: "",
    etagere: "",
    status: "Disponible",
  });

  const fetchWarehouses = async () => {
    const res = await fetch("http://localhost:5050/warehouses");
    const data = await res.json();
    setWarehouses(data);
  };

  const fetchLocations = async () => {
    const res = await fetch("http://localhost:5050/locations");
    const data = await res.json();
    setLocations(data);
  };

  useEffect(() => {
    fetchWarehouses();
    fetchLocations();
  }, []);

  const handleChange = (e: any) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    await fetch("http://localhost:5050/locations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    setFormData({
      warehouse_id: "",
      zone: "",
      rayon: "",
      etagere: "",
      status: "Disponible",
    });

    fetchLocations();
  };

  const handleDelete = async (id: number) => {
    await fetch(`http://localhost:5050/locations/${id}`, {
      method: "DELETE",
    });

    fetchLocations();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="flex justify-between items-center mb-8 print:hidden">
        <div>
          <h1 className="text-4xl font-bold text-black mb-2">
            Emplacements
          </h1>

          <p className="text-gray-500">
            Entrepôt → Zone → Rayon → Étagère → QR Code
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="bg-black text-white font-bold px-6 py-3 rounded-xl"
        >
          Imprimer les QR Codes
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-2xl shadow mb-10 grid grid-cols-3 gap-4 print:hidden"
      >
        <select
          name="warehouse_id"
          value={formData.warehouse_id}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
          required
        >
          <option value="">Choisir entrepôt</option>

          {warehouses.map((warehouse: any) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.code} - {warehouse.name}
            </option>
          ))}
        </select>

        <input
          type="text"
          name="zone"
          placeholder="Zone ex: A"
          value={formData.zone}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
          required
        />

        <input
          type="text"
          name="rayon"
          placeholder="Rayon ex: R1"
          value={formData.rayon}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
          required
        />

        <input
          type="text"
          name="etagere"
          placeholder="Étagère ex: E2"
          value={formData.etagere}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
          required
        />

        <select
          name="status"
          value={formData.status}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
        >
          <option value="Disponible">Disponible</option>
          <option value="Occupé">Occupé</option>
          <option value="Bloqué">Bloqué</option>
        </select>

        <button
          type="submit"
          className="bg-yellow-500 text-black font-bold rounded-xl py-3"
        >
          Créer emplacement QR
        </button>
      </form>

      <div className="bg-white rounded-2xl shadow p-6 print:shadow-none">
        <h2 className="text-2xl font-bold text-black mb-5 print:text-center">
          QR Codes des emplacements
        </h2>

        <div className="grid grid-cols-4 gap-6 print:grid-cols-3">
          {locations.map((location: any) => (
            <div
              key={location.id}
              className="border rounded-2xl p-4 text-center bg-white"
            >
              {location.qr_code ? (
                <img
                  src={location.qr_code}
                  alt={location.emplacement_code}
                  className="w-32 h-32 mx-auto mb-3"
                />
              ) : (
                <div className="w-32 h-32 mx-auto mb-3 flex items-center justify-center border text-gray-400">
                  Aucun QR
                </div>
              )}

              <p className="font-bold text-black text-sm">
                {location.emplacement_code}
              </p>

              <p className="text-xs text-gray-500 mt-1">
                {location.warehouse_code} / Zone {location.zone}
              </p>

              <p className="text-xs text-gray-500">
                Rayon {location.rayon} / Étagère {location.etagere}
              </p>

              <button
                onClick={() => handleDelete(location.id)}
                className="bg-red-500 text-white px-3 py-2 rounded-lg mt-4 print:hidden"
              >
                Supprimer
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}