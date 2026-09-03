"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { authFetch } from "../../../lib/api";
import { usePermissions } from "../../../lib/permissions";

/**
 * FICHE D'UNE VENTE DE SABLE — modifier/supprimer un brouillon, corriger ou
 * annuler une vente validée, contrepasser un paiement, consulter l'historique.
 *
 * Chaque bouton n'apparaît que si le statut de la vente ET la permission de
 * l'utilisateur l'autorisent tous les deux — le vrai refus reste toujours
 * celui du serveur, ceci n'est qu'un affichage.
 */

const money = (v: any) => new Intl.NumberFormat("fr-FR").format(Number(v || 0)) + " FCFA";
const PHRASE_ANNULATION = "ANNULER";

type Sale = {
  id: number; sale_number: string; status: string;
  customer_id: number; customer_name: string;
  sand_product_id: number; product_name: string;
  destination: string; delivery_place: string;
  quantity_m3: string; unit_price: string; transport_price: string;
  discount: string; tax_amount: string; total_amount: string;
  paid_amount: string; remaining_amount: string;
  sale_date: string; notes: string | null; truck: string | null; driver_name: string | null;
  expected_payment_method: string | null;
  cancelled_at: string | null; cancelled_by_name: string | null; cancellation_reason: string | null;
  replaced_by_sale_id: number | null; replaces_sale_id: number | null;
};
type Invoice = { id: number; invoice_number: string; status: string; remaining_amount: string } | null;
type Delivery = { id: number; delivery_number: string; cancelled_at: string | null } | null;

export default function VenteSableDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || "");
  const { can } = usePermissions();

  const [sale, setSale] = useState<Sale | null>(null);
  const [invoice, setInvoice] = useState<Invoice>(null);
  const [delivery, setDelivery] = useState<Delivery>(null);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);

  const [modifierOuvert, setModifierOuvert] = useState(false);
  const [corrigerOuvert, setCorrigerOuvert] = useState(false);
  const [annulerOuvert, setAnnulerOuvert] = useState(false);
  const [historiqueOuvert, setHistoriqueOuvert] = useState(false);
  const [historique, setHistorique] = useState<any>(null);
  const [enCours, setEnCours] = useState(false);

  const [clients, setClients] = useState<any[]>([]);
  const [produits, setProduits] = useState<any[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [motifAnnulation, setMotifAnnulation] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const r = await authFetch(`/sand/sales/${id}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErreur(d.error || "Vente introuvable."); return; }
      setSale(d.sale); setInvoice(d.invoice); setDelivery(d.delivery);
      setForm({
        customer_id: String(d.sale.customer_id || ""), sand_product_id: String(d.sale.sand_product_id || ""),
        destination: d.sale.destination || "", delivery_place: d.sale.delivery_place || "",
        quantity_m3: d.sale.quantity_m3, unit_price: d.sale.unit_price,
        transport_price: d.sale.transport_price, discount: d.sale.discount, tax_amount: d.sale.tax_amount,
        sale_date: d.sale.sale_date, notes: d.sale.notes || "",
        truck: d.sale.truck || "", driver_name: d.sale.driver_name || "",
        expected_payment_method: d.sale.expected_payment_method || "",
      });
    } finally { setChargement(false); }
  }, [id]);

  useEffect(() => { if (id) charger(); }, [id, charger]);
  useEffect(() => {
    authFetch("/sand/customers").then((r) => r.json()).then((d) => setClients(Array.isArray(d) ? d : [])).catch(() => {});
    authFetch("/sand/products").then((r) => r.json()).then((d) => setProduits(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const dejaImprimee = Boolean((invoice as any)?.print_count > 0 || (delivery as any)?.print_count > 0);

  const peutModifierBrouillon = can("sable", "vente_modifier_brouillon");
  const peutSupprimerBrouillon = can("sable", "vente_supprimer_brouillon");
  const peutCorriger = can("sable", "vente_corriger_validee");
  const peutAnnuler = can("sable", "vente_annuler");

  const soumettreModification = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnCours(true); setMessage(""); setErreur("");
    try {
      const r = await authFetch(`/sand/sales/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErreur(d.error || "Erreur de modification."); return; }
      setMessage("Brouillon modifié."); setModifierOuvert(false); await charger();
    } finally { setEnCours(false); }
  };

  const supprimerBrouillon = async () => {
    if (!confirm(`Supprimer le brouillon ${sale?.sale_number} ? Cette action est définitive.`)) return;
    setEnCours(true); setMessage(""); setErreur("");
    try {
      const r = await authFetch(`/sand/sales/${id}`, { method: "DELETE" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErreur(d.error || "Erreur de suppression."); return; }
      router.push("/sable/ventes");
    } finally { setEnCours(false); }
  };

  const soumettreCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motifAnnulation.trim() || motifAnnulation.trim().length < 3) {
      setErreur("Le motif de correction est obligatoire (3 caractères au moins)."); return;
    }
    setEnCours(true); setMessage(""); setErreur("");
    try {
      const r = await authFetch(`/sand/sales/${id}/correct`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, reason: motifAnnulation }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErreur(d.error || "Erreur de correction."); return; }
      setMessage(`Vente corrigée : nouvelle vente ${d.new_sale?.sale_number}, `
        + `facture ${d.new_invoice?.invoice_number}, BL ${d.new_delivery?.delivery_number}.`);
      setCorrigerOuvert(false); setMotifAnnulation("");
      router.push(`/sable/ventes/${d.new_sale.id}`);
    } finally { setEnCours(false); }
  };

  const soumettreAnnulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motifAnnulation.trim() || motifAnnulation.trim().length < 3) {
      setErreur("Le motif d'annulation est obligatoire (3 caractères au moins)."); return;
    }
    if (confirmation.trim().toUpperCase() !== PHRASE_ANNULATION) {
      setErreur(`Tapez exactement « ${PHRASE_ANNULATION} » pour confirmer.`); return;
    }
    setEnCours(true); setMessage(""); setErreur("");
    try {
      const r = await authFetch(`/sand/sales/${id}/cancel`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: motifAnnulation }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErreur(d.error || "Erreur d'annulation."); return; }
      const paiements = (d.payments_reversed || []).length;
      setMessage(`Vente annulée. Facture annulée. BL annulé.`
        + (paiements ? ` ${paiements} paiement(s) contrepassé(s).` : " Aucun paiement à contrepasser."));
      setAnnulerOuvert(false); setMotifAnnulation(""); setConfirmation(""); await charger();
    } finally { setEnCours(false); }
  };

  const ouvrirHistorique = async () => {
    setHistoriqueOuvert(true);
    const r = await authFetch(`/sand/sales/${id}/audit`);
    if (r.ok) setHistorique(await r.json());
  };

  const badgeCouleur = useMemo(() => {
    switch (sale?.status) {
      case "BROUILLON": return "bg-gray-200 text-gray-800";
      case "VALIDEE": return "bg-green-100 text-green-800";
      case "ANNULEE": return "bg-red-100 text-red-800";
      case "REMPLACEE": return "bg-amber-100 text-amber-800";
      default: return "bg-gray-100 text-gray-700";
    }
  }, [sale?.status]);

  if (chargement) return <div className="min-h-screen bg-gray-100 p-6 font-bold">Chargement…</div>;
  if (erreur && !sale) return (
    <div className="min-h-screen bg-gray-100 p-6">
      <p className="rounded-xl bg-red-100 p-4 font-bold text-red-800">{erreur}</p>
      <Link href="/sable/ventes" className="mt-4 inline-block font-bold text-blue-700">← Ventes de sable</Link>
    </div>
  );
  if (!sale) return null;

  return (
    <main className="min-h-screen bg-gray-100 p-4 text-black sm:p-6">
      <div className="mx-auto max-w-4xl">
        <Link href="/sable/ventes" className="text-sm font-bold text-blue-700">← Ventes de sable</Link>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-black sm:text-3xl">{sale.sale_number}</h1>
          <span className={`rounded-full px-3 py-1 text-sm font-bold ${badgeCouleur}`}>{sale.status}</span>
        </div>

        {message && <p className="mt-4 rounded-xl bg-green-50 p-3 text-sm font-bold text-green-800">{message}</p>}
        {erreur && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">{erreur}</p>}

        {sale.status === "ANNULEE" && (
          <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-900">
            <p className="font-black">Vente ANNULÉE</p>
            {sale.cancellation_reason && <p>Motif : {sale.cancellation_reason}</p>}
            {sale.cancelled_by_name && <p>Par : {sale.cancelled_by_name}</p>}
          </div>
        )}
        {sale.status === "REMPLACEE" && sale.replaced_by_sale_id && (
          <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-black">Vente REMPLACÉE par une correction.</p>
            <Link href={`/sable/ventes/${sale.replaced_by_sale_id}`} className="font-bold underline">
              Voir la nouvelle vente →
            </Link>
          </div>
        )}
        {sale.replaces_sale_id && (
          <p className="mt-2 text-sm text-gray-600">
            Corrige la vente{" "}
            <Link href={`/sable/ventes/${sale.replaces_sale_id}`} className="font-bold text-blue-700 underline">
              #{sale.replaces_sale_id}
            </Link>.
          </p>
        )}

        <section className="mt-6 grid grid-cols-1 gap-x-8 gap-y-1 rounded-2xl bg-white p-5 text-sm shadow sm:grid-cols-2">
          <p><span className="font-bold">Client :</span> {sale.customer_name}</p>
          <p><span className="font-bold">Site :</span> {sale.destination}</p>
          <p><span className="font-bold">Produit :</span> {sale.product_name}</p>
          <p><span className="font-bold">Quantité :</span> {sale.quantity_m3} m³</p>
          <p><span className="font-bold">Prix unitaire :</span> {money(sale.unit_price)}</p>
          <p><span className="font-bold">Total :</span> {money(sale.total_amount)}</p>
          <p><span className="font-bold">Payé :</span> {money(sale.paid_amount)}</p>
          <p><span className="font-bold">Reste dû :</span> {money(sale.remaining_amount)}</p>
        </section>

        {/* Actions — statut ET permission décident toutes deux de l'affichage. */}
        <div className="mt-6 flex flex-wrap gap-3">
          {sale.status === "BROUILLON" && peutModifierBrouillon && (
            <button onClick={() => setModifierOuvert(true)}
              className="min-h-[44px] rounded-xl bg-black px-5 py-2.5 font-bold text-white">
              Modifier
            </button>
          )}
          {sale.status === "BROUILLON" && peutSupprimerBrouillon && (
            <button onClick={supprimerBrouillon} disabled={enCours}
              className="min-h-[44px] rounded-xl border-2 border-red-600 px-5 py-2.5 font-bold text-red-700 disabled:opacity-50">
              Supprimer le brouillon
            </button>
          )}
          {sale.status === "VALIDEE" && peutCorriger && (
            <button onClick={() => setCorrigerOuvert(true)}
              className="min-h-[44px] rounded-xl bg-blue-700 px-5 py-2.5 font-bold text-white">
              Corriger la vente
            </button>
          )}
          {sale.status === "VALIDEE" && peutAnnuler && (
            <button onClick={() => setAnnulerOuvert(true)}
              className="min-h-[44px] rounded-xl border-2 border-red-600 px-5 py-2.5 font-bold text-red-700">
              Annuler la vente
            </button>
          )}
          {invoice && (
            <Link href={`/sable/factures/${invoice.id}`}
              className="min-h-[44px] rounded-xl border-2 border-black px-5 py-2.5 text-center font-bold leading-[1.6]">
              Voir la facture
            </Link>
          )}
          {delivery && (
            <Link href={`/sable/livraisons/${delivery.id}`}
              className="min-h-[44px] rounded-xl border-2 border-black px-5 py-2.5 text-center font-bold leading-[1.6]">
              Voir le BL
            </Link>
          )}
          <button onClick={ouvrirHistorique}
            className="min-h-[44px] rounded-xl border-2 border-gray-400 px-5 py-2.5 font-bold text-gray-700">
            Voir l&apos;historique
          </button>
        </div>

        {/* ── Modifier un brouillon ── */}
        {modifierOuvert && (
          <form onSubmit={soumettreModification} className="mt-6 space-y-3 rounded-2xl bg-white p-5 shadow">
            <h2 className="text-xl font-black">Modifier le brouillon</h2>
            <ChampsVente form={form} setForm={setForm} clients={clients} produits={produits} />
            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <button type="button" onClick={() => setModifierOuvert(false)}
                className="min-h-[44px] rounded-xl border px-5 py-2.5 font-bold">Annuler</button>
              <button disabled={enCours} className="min-h-[44px] rounded-xl bg-black px-5 py-2.5 font-bold text-white">
                {enCours ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </form>
        )}

        {/* ── Corriger une vente validée ── */}
        {corrigerOuvert && (
          <form onSubmit={soumettreCorrection} className="mt-6 space-y-3 rounded-2xl bg-white p-5 shadow">
            <h2 className="text-xl font-black">Corriger la vente</h2>
            <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
              Cette vente sera annulée et remplacée par une nouvelle vente, avec une nouvelle facture et
              un nouveau bon de livraison. {dejaImprimee && "La facture ou le BL actuels ont déjà été imprimés."}
            </p>
            <ChampsVente form={form} setForm={setForm} clients={clients} produits={produits} />
            <label className="block text-sm font-bold">
              Motif de la correction (obligatoire)
              <textarea required value={motifAnnulation} onChange={(e) => setMotifAnnulation(e.target.value)}
                className="mt-1 min-h-20 w-full rounded-xl border p-3 font-normal" />
            </label>
            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <button type="button" onClick={() => { setCorrigerOuvert(false); setMotifAnnulation(""); }}
                className="min-h-[44px] rounded-xl border px-5 py-2.5 font-bold">Annuler</button>
              <button disabled={enCours} className="min-h-[44px] rounded-xl bg-blue-700 px-5 py-2.5 font-bold text-white">
                {enCours ? "Correction en cours…" : "Corriger et générer les nouveaux documents"}
              </button>
            </div>
          </form>
        )}

        {/* ── Annuler une vente validée ── */}
        {annulerOuvert && (
          <form onSubmit={soumettreAnnulation} className="mt-6 space-y-3 rounded-2xl bg-white p-5 shadow">
            <h2 className="text-xl font-black text-red-700">Annuler la vente</h2>
            <div className="rounded-xl bg-red-50 p-3 text-sm text-red-900">
              <p className="font-bold">Cette opération va, en une seule fois :</p>
              <ul className="ml-5 list-disc">
                <li>annuler la vente {sale.sale_number} ;</li>
                {invoice && <li>annuler la facture {invoice.invoice_number} ;</li>}
                {delivery && <li>annuler le bon de livraison {delivery.delivery_number} ;</li>}
                <li>stock restitué : non applicable (le sable ne touche pas le stock) ;</li>
                {Number(sale.paid_amount) > 0
                  ? <li>contrepasser le(s) paiement(s) déjà encaissé(s) ({money(sale.paid_amount)}).</li>
                  : <li>aucun paiement à contrepasser (vente impayée).</li>}
              </ul>
              {dejaImprimee && <p className="mt-2 font-bold">Cette facture ou ce BL ont déjà été imprimés.</p>}
            </div>
            <label className="block text-sm font-bold">
              Motif d&apos;annulation (obligatoire)
              <textarea required value={motifAnnulation} onChange={(e) => setMotifAnnulation(e.target.value)}
                className="mt-1 min-h-20 w-full rounded-xl border p-3 font-normal" />
            </label>
            <label className="block text-sm font-bold">
              Tapez « {PHRASE_ANNULATION} » pour confirmer
              <input required value={confirmation} onChange={(e) => setConfirmation(e.target.value)}
                className="mt-1 w-full rounded-xl border p-3 font-normal uppercase" placeholder={PHRASE_ANNULATION} />
            </label>
            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <button type="button" onClick={() => { setAnnulerOuvert(false); setMotifAnnulation(""); setConfirmation(""); }}
                className="min-h-[44px] rounded-xl border px-5 py-2.5 font-bold">Renoncer</button>
              <button disabled={enCours || confirmation.trim().toUpperCase() !== PHRASE_ANNULATION}
                className="min-h-[44px] rounded-xl bg-red-700 px-5 py-2.5 font-bold text-white disabled:opacity-40">
                {enCours ? "Annulation en cours…" : "Confirmer l'annulation"}
              </button>
            </div>
          </form>
        )}

        {/* ── Historique ── */}
        {historiqueOuvert && (
          <div className="mt-6 rounded-2xl bg-white p-5 shadow">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black">Historique</h2>
              <button onClick={() => setHistoriqueOuvert(false)} className="font-bold text-gray-500">Fermer</button>
            </div>
            {!historique ? <p className="mt-3 text-gray-500">Chargement…</p> : (
              <div className="mt-3 space-y-3">
                {historique.chain?.length > 1 && (
                  <p className="text-sm text-gray-600">
                    Chaîne : {historique.chain.map((s: any) => `${s.sale_number} (${s.status})`).join(" → ")}
                  </p>
                )}
                {(historique.entries || []).length === 0 && <p className="text-gray-500">Aucun événement enregistré.</p>}
                {(historique.entries || []).map((e: any) => (
                  <div key={e.id} className="rounded-xl border border-gray-200 p-3 text-sm">
                    <p className="font-bold">{e.action} — {new Date(e.created_at).toLocaleString("fr-FR")}</p>
                    <p>Par : {e.performed_by_name || "—"}</p>
                    <p>Motif : {e.reason}</p>
                    {e.was_already_printed && <p className="text-amber-700">Document déjà imprimé au moment de l&apos;action.</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function ChampsVente({ form, setForm, clients, produits }: {
  form: Record<string, string>; setForm: (f: any) => void; clients: any[]; produits: any[];
}) {
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f: any) => ({ ...f, [k]: e.target.value }));
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="text-sm font-bold">Client
        <select value={form.customer_id} onChange={set("customer_id")} className="mt-1 w-full rounded-xl border p-3 font-normal">
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label className="text-sm font-bold">Produit
        <select value={form.sand_product_id} onChange={set("sand_product_id")} className="mt-1 w-full rounded-xl border p-3 font-normal">
          {produits.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label className="text-sm font-bold">Site / chantier (destination)
        <input value={form.destination} onChange={set("destination")} className="mt-1 w-full rounded-xl border p-3 font-normal" />
      </label>
      <label className="text-sm font-bold">Entrepôt / emplacement (lieu de livraison)
        <input value={form.delivery_place} onChange={set("delivery_place")} className="mt-1 w-full rounded-xl border p-3 font-normal" />
      </label>
      <label className="text-sm font-bold">Date métier
        <input type="date" value={String(form.sale_date || "").slice(0, 10)} onChange={set("sale_date")}
          className="mt-1 w-full rounded-xl border p-3 font-normal" />
      </label>
      <label className="text-sm font-bold">Quantité (m³)
        <input type="number" step="0.001" min="0.001" value={form.quantity_m3} onChange={set("quantity_m3")}
          className="mt-1 w-full rounded-xl border p-3 font-normal" />
      </label>
      <label className="text-sm font-bold">Prix unitaire (FCFA/m³)
        <input type="number" step="1" min="0" value={form.unit_price} onChange={set("unit_price")}
          className="mt-1 w-full rounded-xl border p-3 font-normal" />
      </label>
      <label className="text-sm font-bold">Prix transport
        <input type="number" step="1" min="0" value={form.transport_price} onChange={set("transport_price")}
          className="mt-1 w-full rounded-xl border p-3 font-normal" />
      </label>
      <label className="text-sm font-bold">Mode de paiement prévu
        <select value={form.expected_payment_method} onChange={set("expected_payment_method")}
          className="mt-1 w-full rounded-xl border p-3 font-normal">
          <option value="">—</option>
          <option value="especes">Espèces</option>
          <option value="banque">Banque</option>
        </select>
      </label>
      <label className="text-sm font-bold sm:col-span-2">Observation
        <textarea value={form.notes} onChange={(e) => setForm((f: any) => ({ ...f, notes: e.target.value }))}
          className="mt-1 min-h-16 w-full rounded-xl border p-3 font-normal" />
      </label>
    </div>
  );
}
