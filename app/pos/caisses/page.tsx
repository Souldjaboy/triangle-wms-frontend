"use client";

import { useEffect, useState } from "react";
import { formatFCFA } from "../../lib/format";

export default function PosCaissesPage() {
  const [caisses, setCaisses] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [assignment, setAssignment] = useState({ user_id: "", caisse_id: "" });
  const [form, setForm] = useState({
    nom_caisse: "",
    code_caisse: "",
    solde_initial: "",
  });

  const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  });

  const loadCaisses = async () => {
    const response = await fetch("/api/pos/caisses", { headers: headers() });
    const data = await response.json().catch(() => []);
    setCaisses(Array.isArray(data) ? data : []);
  };

  const loadUsers = async () => {
    const response = await fetch("/api/users", { headers: headers() });
    const data = await response.json().catch(() => []);
    setUsers(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    loadCaisses();
    loadUsers();
  }, []);

  const createCaisse = async () => {
    const response = await fetch("/api/pos/caisses", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        ...form,
        solde_initial: Number(form.solde_initial || 0),
      }),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Caisse créée." : data.error || "Erreur création caisse.");
    if (response.ok) {
      setForm({ nom_caisse: "", code_caisse: "", solde_initial: "" });
      loadCaisses();
    }
  };

  const openCaisse = async (caisse: any) => {
    const montant = prompt("Montant de départ", String(caisse.solde_initial || 0));
    if (montant === null) return;

    const response = await fetch(`/api/pos/caisses/${caisse.id}/open`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ solde_initial: Number(montant || 0) }),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Caisse ouverte." : data.error || "Erreur ouverture caisse.");
    loadCaisses();
  };

  const closeCaisse = async (caisse: any) => {
    const response = await fetch(`/api/pos/caisses/${caisse.id}/close`, {
      method: "POST",
      headers: headers(),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Caisse fermée." : data.error || "Erreur fermeture caisse.");
    loadCaisses();
  };

  const deleteCaisse = async (caisse: any) => {
    if (!confirm(`Désactiver ${caisse.nom_caisse} ?`)) return;

    const response = await fetch(`/api/pos/caisses/${caisse.id}`, {
      method: "DELETE",
      headers: headers(),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Caisse désactivée." : data.error || "Erreur suppression caisse.");
    loadCaisses();
  };

  const assignCaisse = async () => {
    if (!assignment.user_id) {
      setMessage("Choisissez un utilisateur.");
      return;
    }

    const response = await fetch(`/api/users/${assignment.user_id}/caisse`, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify({ caisse_id: assignment.caisse_id || null }),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Caisse affectée à l’utilisateur." : data.error || "Erreur affectation caisse.");
    if (response.ok) {
      loadUsers();
      loadCaisses();
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 text-black md:p-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold md:text-4xl">Gestion des caisses</h1>
          <p className="text-gray-500">Création, ouverture, fermeture et suivi des caisses POS.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/pos/rapport-caisses" className="rounded-xl bg-white px-5 py-3 font-bold text-black">
            Rapport caisses
          </a>
          <a href="/pos" className="rounded-xl bg-black px-5 py-3 font-bold text-white">
            Retour caisse
          </a>
        </div>
      </div>

      {message && <div className="mb-5 rounded-xl bg-yellow-100 p-4 font-bold">{message}</div>}

      <div className="mb-6 grid grid-cols-1 gap-3 rounded-2xl bg-white p-5 shadow md:grid-cols-4">
        <input
          value={form.nom_caisse}
          onChange={(e) => setForm({ ...form, nom_caisse: e.target.value })}
          placeholder="Nom caisse"
          className="rounded-xl border p-3"
        />
        <input
          value={form.code_caisse}
          onChange={(e) => setForm({ ...form, code_caisse: e.target.value })}
          placeholder="Code caisse"
          className="rounded-xl border p-3"
        />
        <input
          type="number"
          value={form.solde_initial}
          onChange={(e) => setForm({ ...form, solde_initial: e.target.value })}
          placeholder="Solde initial"
          className="rounded-xl border p-3"
        />
        <button onClick={createCaisse} className="rounded-xl bg-yellow-500 px-5 py-3 font-bold text-black">
          Ajouter caisse
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 rounded-2xl bg-white p-5 shadow md:grid-cols-3">
        <div>
          <label className="mb-2 block font-bold">Utilisateur</label>
          <select
            value={assignment.user_id}
            onChange={(e) => setAssignment({ ...assignment, user_id: e.target.value })}
            className="w-full rounded-xl border p-3"
          >
            <option value="">Choisir un utilisateur</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.fullname || user.email} - {user.role}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-2 block font-bold">Caisse affectée</label>
          <select
            value={assignment.caisse_id}
            onChange={(e) => setAssignment({ ...assignment, caisse_id: e.target.value })}
            className="w-full rounded-xl border p-3"
          >
            <option value="">Aucune caisse</option>
            {caisses.map((caisse) => (
              <option key={caisse.id} value={caisse.id}>
                {caisse.nom_caisse}
              </option>
            ))}
          </select>
        </div>
        <button onClick={assignCaisse} className="self-end rounded-xl bg-black px-5 py-3 font-bold text-white">
          Affecter utilisateur
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow">
        <table className="w-full min-w-[900px] text-left">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              <th className="p-4">Caisse</th>
              <th>Code</th>
              <th>Statut</th>
              <th>Solde initial</th>
              <th>Solde actuel</th>
              <th>Utilisateurs</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {caisses.map((caisse) => (
              <tr key={caisse.id} className="border-t">
                <td className="p-4 font-bold">{caisse.nom_caisse}</td>
                <td>{caisse.code_caisse || "-"}</td>
                <td>
                  <span className={`rounded-full px-3 py-1 text-sm font-bold ${
                    caisse.statut === "ouverte" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"
                  }`}>
                    {caisse.statut}
                  </span>
                </td>
                <td>{formatFCFA(caisse.solde_initial)}</td>
                <td className="font-bold">{formatFCFA(caisse.solde_actuel)}</td>
                <td>{caisse.assigned_users || 0}</td>
                <td className="space-x-2">
                  <button onClick={() => openCaisse(caisse)} className="rounded-xl bg-green-600 px-4 py-2 font-bold text-white">
                    Ouvrir
                  </button>
                  <button onClick={() => closeCaisse(caisse)} className="rounded-xl bg-black px-4 py-2 font-bold text-white">
                    Fermer
                  </button>
                  <button onClick={() => deleteCaisse(caisse)} className="rounded-xl bg-red-600 px-4 py-2 font-bold text-white">
                    Désactiver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {caisses.length === 0 && <p className="p-6 text-gray-500">Aucune caisse enregistrée.</p>}
      </div>
    </div>
  );
}
