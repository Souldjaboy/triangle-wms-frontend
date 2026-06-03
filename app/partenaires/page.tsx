"use client";

import { useEffect, useState } from "react";

export default function PartenairesPage() {
  const [partners, setPartners] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    type: "client",
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    country: "Mali",
    contact_person: "",
    nif: "",
    rccm: "",
    notes: "",
    status: "active",
  });

  const fetchPartners = async () => {
    const response = await fetch("/api/partners", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    const data = await response.json();
    setPartners(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  const handleChange = (e: any) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const createPartner = async (e: any) => {
    e.preventDefault();

    const response = await fetch("/api/partners", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify(form),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "Erreur ajout partenaire.");
      return;
    }

    setMessage("Partenaire ajouté avec succès.");

    setForm({
      type: "client",
      name: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      country: "Mali",
      contact_person: "",
      nif: "",
      rccm: "",
      notes: "",
      status: "active",
    });

    fetchPartners();
  };

  const deletePartner = async (id: number) => {
    if (!confirm("Supprimer ce partenaire ? S’il est utilisé, il sera désactivé au lieu d’être supprimé.")) return;

    const response = await fetch(`/api/partners/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });
    const data = await response.json().catch(() => ({}));

    setMessage(data.message || data.error || "Action partenaire terminée.");
    fetchPartners();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold text-black mb-2">
        Partenaires
      </h1>

      <p className="text-gray-500 mb-8">
        Gestion des clients et fournisseurs de l’entreprise.
      </p>

      {message && (
        <div className="bg-green-100 text-green-700 p-4 rounded-xl mb-6 font-bold">
          {message}
        </div>
      )}

      <form
        onSubmit={createPartner}
        className="bg-white rounded-2xl shadow p-6 grid grid-cols-3 gap-4 mb-8"
      >
        <select
          name="type"
          value={form.type}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
        >
          <option value="client">Client</option>
          <option value="fournisseur">Fournisseur</option>
        </select>

        <input
          name="name"
          placeholder="Nom entreprise / personne"
          value={form.name}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
          required
        />

        <input
          name="phone"
          placeholder="Téléphone"
          value={form.phone}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
        />

        <input
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
        />

        <input
          name="city"
          placeholder="Ville"
          value={form.city}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
        />

        <input
          name="country"
          placeholder="Pays"
          value={form.country}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
        />

        <input
          name="contact_person"
          placeholder="Personne contact"
          value={form.contact_person}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
        />

        <input
          name="nif"
          placeholder="NIF"
          value={form.nif}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
        />

        <input
          name="rccm"
          placeholder="RCCM"
          value={form.rccm}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
        />

        <textarea
          name="address"
          placeholder="Adresse"
          value={form.address}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black col-span-2"
        />

        <textarea
          name="notes"
          placeholder="Observations"
          value={form.notes}
          onChange={handleChange}
          className="border p-3 rounded-xl text-black"
        />

        <button
          type="submit"
          className="bg-yellow-500 text-black font-bold py-3 rounded-xl col-span-3"
        >
          Ajouter partenaire
        </button>
      </form>

      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-2xl font-bold text-black mb-5">
          Liste des partenaires
        </h2>

        {partners.length === 0 ? (
          <p className="text-gray-500">Aucun partenaire enregistré.</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="py-3">Type</th>
                <th>Nom</th>
                <th>Téléphone</th>
                <th>Email</th>
                <th>Ville</th>
                <th>Contact</th>
                <th>Statut</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {partners.map((partner: any) => (
                <tr key={partner.id} className="border-b">
                  <td className="py-4 font-bold">
                    {partner.type}
                  </td>
                  <td>{partner.name}</td>
                  <td>{partner.phone || "-"}</td>
                  <td>{partner.email || "-"}</td>
                  <td>{partner.city || "-"}</td>
                  <td>{partner.contact_person || "-"}</td>
                  <td>{partner.status}</td>
                  <td className="flex flex-wrap gap-2 py-3">
                    <a
                      href={`/partenaires/${partner.id}`}
                      className="bg-black text-white px-4 py-2 rounded-xl font-bold"
                    >
                      Voir fiche
                    </a>
                    <button
                      onClick={() => deletePartner(partner.id)}
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
