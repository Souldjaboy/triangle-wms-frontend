"use client";

import { useEffect, useMemo, useState } from "react";

const API_URL = "http://localhost:5050";

export default function EmplacementsPage() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [isAdmin, setIsAdmin] = useState(false);

  const [formData, setFormData] = useState({
    warehouse_id: "",
    product_id: "",
    product_reference: "",
    product_name: "",
    rayon_code: "A",
    case_code: "1",
    level_code: "1",
    bin_mode: "single",
    bin_code: "1",
    bin_group: "",
    status: "Disponible",
  });

  const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  });

  const fetchAll = async () => {
    const [wRes, pRes, lRes] = await Promise.all([
      fetch(`${API_URL}/warehouses`, { headers: headers() }),
      fetch(`${API_URL}/products`, { headers: headers() }),
      fetch(`${API_URL}/locations`, { headers: headers() }),
    ]);
    setWarehouses(await wRes.json().then((d) => (Array.isArray(d) ? d : [])).catch(() => []));
    setProducts(await pRes.json().then((d) => (Array.isArray(d) ? d : [])).catch(() => []));
    setLocations(await lRes.json().then((d) => (Array.isArray(d) ? d : [])).catch(() => []));
  };

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setIsAdmin(user.role === "admin" || user.role === "super_admin" || user.is_super_admin === true);
    }
    fetchAll();
  }, []);

  const rayons = useMemo(() => Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)), []);
  const cases = useMemo(() => Array.from({ length: 30 }, (_, i) => String(i + 1)), []);
  const levels = ["1", "2", "3", "Top"];
  const bins = ["1", "2", "3"];

  const handleChange = (e: any) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleProductSelect = (productId: string) => {
    const product = products.find((p: any) => String(p.id) === String(productId));
    setFormData({
      ...formData,
      product_id: productId,
      product_reference: product?.reference || "",
      product_name: product?.name || "",
    });
  };

  const resetForm = () => setFormData({
    warehouse_id: "",
    product_id: "",
    product_reference: "",
    product_name: "",
    rayon_code: "A",
    case_code: "1",
    level_code: "1",
    bin_mode: "single",
    bin_code: "1",
    bin_group: "",
    status: "Disponible",
  });

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setMessage("");

    if (!isAdmin) {
      setMessageType("error");
      setMessage("Seul l’administrateur peut créer des emplacements.");
      return;
    }

    const selectedBins = formData.bin_mode === "full" ? "1,2,3" : formData.bin_code;

    const response = await fetch(`${API_URL}/locations`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        ...formData,
        zone: formData.rayon_code,
        rayon: `CASE-${formData.case_code}`,
        etagere: `L${formData.level_code}-BIN-${selectedBins}`,
        bin_code: selectedBins,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessageType("error");
      setMessage(data.error || "Erreur ajout emplacement");
      return;
    }

    setMessageType("success");
    setMessage(`Emplacement créé : ${data.emplacement_code || "OK"}`);
    resetForm();
    await fetchAll();
  };

  const handleDelete = async (id: number) => {
    if (!isAdmin) return alert("Seul l’administrateur peut supprimer.");
    if (!confirm("Supprimer cet emplacement ?")) return;

    const response = await fetch(`${API_URL}/locations/${id}`, { method: "DELETE", headers: headers() });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return alert(data.error || "Erreur suppression emplacement");
    await fetchAll();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold text-black mb-2">Emplacements</h1>
      <p className="text-gray-500 mb-8">Nouvelle hiérarchie : Rayon → Case → Level → Bin.</p>

      {message && <div className={`p-4 rounded-xl mb-6 font-bold ${messageType === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{message}</div>}

      {isAdmin && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow mb-10 grid grid-cols-4 gap-4">
          <select name="warehouse_id" value={formData.warehouse_id} onChange={handleChange} className="border p-3 rounded-xl text-black" required>
            <option value="">Choisir entrepôt</option>
            {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.code} - {w.name}</option>)}
          </select>

          <select name="product_id" value={formData.product_id} onChange={(e) => handleProductSelect(e.target.value)} className="border p-3 rounded-xl text-black">
            <option value="">Produit optionnel</option>
            {products.map((p: any) => <option key={p.id} value={p.id}>{p.reference} - {p.name}</option>)}
          </select>

          <select name="rayon_code" value={formData.rayon_code} onChange={handleChange} className="border p-3 rounded-xl text-black" required>
            {rayons.map((r) => <option key={r} value={r}>Rayon {r}</option>)}
          </select>

          <select name="case_code" value={formData.case_code} onChange={handleChange} className="border p-3 rounded-xl text-black" required>
            {cases.map((c) => <option key={c} value={c}>Case {c}</option>)}
          </select>

          <select name="level_code" value={formData.level_code} onChange={handleChange} className="border p-3 rounded-xl text-black" required>
            {levels.map((l) => <option key={l} value={l}>Level {l}</option>)}
          </select>

          <select name="bin_mode" value={formData.bin_mode} onChange={handleChange} className="border p-3 rounded-xl text-black">
            <option value="single">Un seul Bin</option>
            <option value="full">Full Bin : Bin 1 + 2 + 3</option>
            <option value="group">Groupe de Bins</option>
          </select>

          {formData.bin_mode === "single" && <select name="bin_code" value={formData.bin_code} onChange={handleChange} className="border p-3 rounded-xl text-black">{bins.map((b) => <option key={b} value={b}>Bin {b}</option>)}</select>}

          {formData.bin_mode === "group" && <select name="bin_group" value={formData.bin_group} onChange={(e) => setFormData({ ...formData, bin_group: e.target.value, bin_code: e.target.value })} className="border p-3 rounded-xl text-black"><option value="1,2">Bin 1 + 2</option><option value="2,3">Bin 2 + 3</option><option value="1,3">Bin 1 + 3</option></select>}

          <select name="status" value={formData.status} onChange={handleChange} className="border p-3 rounded-xl text-black"><option value="Disponible">Disponible</option><option value="Occupé">Occupé</option></select>

          <button type="submit" className="bg-yellow-500 text-black font-bold rounded-xl py-3 col-span-4">Ajouter emplacement</button>
        </form>
      )}

      <div className="bg-white rounded-2xl shadow p-6 overflow-x-auto">
        <h2 className="text-2xl font-bold text-black mb-5">Liste des emplacements</h2>
        {locations.length === 0 ? <p className="text-gray-500">Aucun emplacement enregistré.</p> : (
          <table className="w-full text-left">
            <thead><tr className="border-b text-gray-500"><th className="py-3">Code</th><th>Entrepôt</th><th>Produit</th><th>Rayon</th><th>Case</th><th>Level</th><th>Bin</th><th>Mode</th><th>Statut</th>{isAdmin && <th>Actions</th>}</tr></thead>
            <tbody>{locations.map((l: any) => <tr key={l.id} className="border-b"><td className="py-4 font-bold text-blue-600">{l.emplacement_code}</td><td>{l.warehouse_name || l.warehouse_code || l.warehouse_id}</td><td>{l.product_reference ? `${l.product_reference} - ${l.product_name}` : "-"}</td><td>{l.rayon_code || l.zone}</td><td>{l.case_code || l.rayon}</td><td>{l.level_code || l.etagere}</td><td>{l.bin_code || "-"}</td><td>{l.bin_mode || "single"}</td><td>{l.status}</td>{isAdmin && <td><button onClick={() => handleDelete(l.id)} className="bg-red-600 text-white px-4 py-2 rounded-xl font-bold">Supprimer</button></td>}</tr>)}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
