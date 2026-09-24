"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { authFetch, apiUrl } from "../lib/api";
import { usePermissions } from "../lib/permissions";

import CameraReceiptCapture from "../components/CameraReceiptCapture";
/**
 * PHASES 1-4 — Espace du DEMANDEUR (Assistant(e) de Direction et tout profil
 * disposant de demande). Aucun nom codé en dur : le backend restreint
 * automatiquement la liste aux demandes de l'utilisateur (périmètre RBAC +
 * company_id), sans exiger le droit de validation Direction.
 */

type RequestLine = {
  id?: number;
  line_no: number;
  category: string | null;
  label: string;
  amount: string | number;
};

type DraftLine = {
  category: string;
  label: string;
  quantity: string;
  unit_price: string;
  camion_id: string;
  amount: string;
};

const EMPTY_LINE: DraftLine = {
  category: "",
  label: "",
  quantity: "",
  unit_price: "",
  camion_id: "",
  amount: "",
};

type Req = {
  id: number; request_number: string; created_at: string; reason: string; category: string | null;
  amount: string; amount_disbursed: string | null; urgency: string | null; status: string;
  payment_method: string | null; approval_comment: string | null; approved_by_name: string | null;
  approved_at: string | null; disbursed_by_name: string | null; disbursed_at: string | null;
  disbursement_comment: string | null; voucher_number: string | null; closed_at: string | null;
  requester_name: string | null;
  camion_id: number | null;
  camion_code: string | null;
  lines?: RequestLine[];
};
type Receipt = { id: number; file_url: string; file_name: string | null; amount: string; label: string | null; review_status: string; uploaded_at: string };
type Refund = { id: number; amount: string; created_at: string };
type Amounts = { disbursed: number; justified: number; refunded: number; remaining: number; fully_justified: boolean };

const S = {
  DRAFT: "BROUILLON", WAITING: "EN_ATTENTE_DIRECTION", WAITING_DISB: "EN_ATTENTE_DECAISSEMENT",
  REJECTED: "REFUSEE_DIRECTION", WAITING_RECEIPTS: "EN_ATTENTE_JUSTIFICATIFS",
  RECEIPTS: "JUSTIFICATIFS_DEPOSES", REVIEW: "EN_CONTROLE", CLOSED: "CLOTUREE",
};
const FILTERS = [
  { key: "", label: "Toutes" }, { key: S.DRAFT, label: "Mes brouillons" },
  { key: S.WAITING, label: "En attente Direction" }, { key: S.WAITING_DISB, label: "Validées" },
  { key: S.REJECTED, label: "Refusées" }, { key: S.WAITING_RECEIPTS, label: "Décaissées" },
  { key: S.RECEIPTS, label: "Justificatifs déposés" }, { key: S.REVIEW, label: "En contrôle" },
  { key: S.CLOSED, label: "Clôturées" },
];
const COLOR: Record<string, string> = {
  [S.DRAFT]: "bg-gray-200 text-gray-700", [S.WAITING]: "bg-amber-100 text-amber-800",
  [S.WAITING_DISB]: "bg-blue-100 text-blue-800", [S.REJECTED]: "bg-red-100 text-red-800",
  [S.WAITING_RECEIPTS]: "bg-orange-100 text-orange-800", [S.RECEIPTS]: "bg-purple-100 text-purple-800",
  [S.REVIEW]: "bg-indigo-100 text-indigo-800", [S.CLOSED]: "bg-green-100 text-green-800",
};
// Étapes de la timeline (PHASE 3).
const STEPS = [
  { key: "created", label: "Demande créée" }, { key: "submitted", label: "Soumise" },
  { key: "direction", label: "Direction" }, { key: "disbursed", label: "Décaissement" },
  { key: "receipts", label: "Justificatifs" }, { key: "review", label: "Contrôle" },
  { key: "closed", label: "Clôture" },
];
function stepIndex(status: string): number {
  if (status === S.DRAFT) return 0;
  if (status === S.WAITING) return 2;
  if (status === S.REJECTED) return 2;
  if (status === S.WAITING_DISB) return 3;
  if (status === S.WAITING_RECEIPTS) return 4;
  if (status === S.RECEIPTS) return 4;
  if (status === S.REVIEW) return 5;
  if (status === S.CLOSED) return 6;
  return 1;
}
const fcfa = (v: string | number | null) => (v == null || v === "" ? "—" : Number(v).toLocaleString("fr-FR") + " FCFA");
const fdate = (d: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");

// TRUCK_REQUEST_SELECTOR_V3
const EMPTY = {
  beneficiary: "", service: "", reason: "", description: "", currency: "FCFA",
  project: "", urgency: "normale", desired_date: "", payment_method: "especes",
  observation: "",
};

export default function MesDemandesPage() {
  const { can, loading } = usePermissions();
  const allowed = can("demande", "view");
  const [items, setItems] = useState<Req[]>([]);
  const [camions, setCamions] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  // DISBURSEMENT_EDIT_UI_V1
  const [editingId, setEditingId] =
    useState<number | null>(null);

  const [editingStatus, setEditingStatus] =
    useState<string | null>(null);

  const [form, setForm] = useState({ ...EMPTY });
  const [requestLines, setRequestLines] = useState<DraftLine[]>([
    { ...EMPTY_LINE }
  ]);

  const totalRequest = requestLines.reduce(
    (sum, line) =>
      sum +
      (
        (Number(line.quantity) || 0)
        *
        (Number(line.unit_price) || 0)
      ),
    0
  );

  const updateRequestLine = (
    index: number,
    patch: Partial<DraftLine>
  ) => {
    setRequestLines((current) =>
      current.map((line, i) =>
        i === index ? { ...line, ...patch } : line
      )
    );
  };

  const addRequestLine = () => {
    setRequestLines((current) => [
      ...current,
      { ...EMPTY_LINE }
    ]);
  };

  const removeRequestLine = (index: number) => {
    setRequestLines((current) => {
      if (current.length <= 1) return current;
      return current.filter((_, i) => i !== index);
    });
  };
  const [attach, setAttach] = useState<File | null>(null);

  const [initialReceiptMode,setInitialReceiptMode] =
    useState<"FILE" | "PENDING" | "DECLARATION">("FILE");

  const [initialExpectedDate,setInitialExpectedDate] =
    useState("");

  const [initialDeclaration,setInitialDeclaration] =
    useState("");

  const [initialSupplier,setInitialSupplier] =
    useState("");


  const [detail, setDetail] = useState<Req | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [amounts, setAmounts] = useState<Amounts | null>(null);
  const [rec, setRec] = useState({ amount: "", label: "" });
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    const q = filter ? `?status=${filter}` : "";
    const r = await authFetch(`/disbursements${q}`);
    if (r.ok) {
      const data = await r.json();
      setItems(
        Array.isArray(data)
          ? data.filter(
              (x: Req) =>
                x.status !== "ANNULEE"
            )
          : []
      );
    }
  }, [filter]);
  useEffect(() => { if (allowed) load(); }, [allowed, load]);

  useEffect(() => {
    if (!allowed) return;

    authFetch("/disbursement-camions")
      .then(async (r) => {
        if (!r.ok) return;
        const data = await r.json().catch(() => []);
        setCamions(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
  }, [allowed]);

  // DISBURSEMENT_REQUESTER_ACTIONS_V1
  const deleteRequest = async (
    r: Req
  ) => {
    if (
      ![
        S.DRAFT,
        S.WAITING
      ].includes(r.status)
    ) {
      setMsg(
        "❌ Cette demande est déjà validée ou traitée et ne peut plus être supprimée."
      );
      return;
    }

    const ok = window.confirm(
      `Supprimer la demande ${r.request_number} ?\n\nCette action l'annulera définitivement pour le demandeur.`
    );

    if (!ok) return;

    setBusy(true);
    setMsg("");

    try {
      const res = await authFetch(
        `/disbursements/${r.id}`,
        {
          method: "DELETE"
        }
      );

      const data =
        await res.json().catch(
          () => ({})
        );

      if (!res.ok) {
        setMsg(
          `❌ ${
            data?.error ||
            "Impossible de supprimer la demande."
          }`
        );
        return;
      }

      setDetail(null);

      setItems((prev) =>
        prev.filter(
          (x) => x.id !== r.id
        )
      );

      setMsg(
        `✅ ${r.request_number} supprimée de vos demandes.`
      );

    } catch {
      setMsg(
        "❌ Impossible de supprimer la demande."
      );

    } finally {
      setBusy(false);
    }
  };


  // DISBURSEMENT_SAFE_DETAIL_V1
  const openDetail = async (r: Req) => {

    setMsg("");
    setBusy(true);

    /*
     * Ne jamais rendre la fiche avec la ligne
     * partielle provenant du tableau.
     * On attend d'abord la réponse complète du backend.
     */
    setDetail(null);
    setReceipts([]);
    setRefunds([]);
    setAmounts(null);

    try {

      const res = await authFetch(
        `/disbursements/${r.id}/details`,
        {
          cache: "no-store"
        }
      );

      const raw = await res.text();

      let d: any = {};

      try {
        d = raw
          ? JSON.parse(raw)
          : {};
      } catch {
        console.error(
          "Réponse détail non JSON :",
          raw.slice(0, 1000)
        );

        setMsg(
          "❌ Le serveur a renvoyé une réponse invalide pour cette demande."
        );

        return;
      }

      if (!res.ok) {

        console.error(
          "Erreur détail demande :",
          res.status,
          d
        );

        setMsg(
          `❌ ${
            d?.error ||
            `Impossible d'ouvrir la demande (${res.status}).`
          }`
        );

        return;
      }

      if (
        !d?.request ||
        !d.request.id ||
        !d.request.status
      ) {

        console.error(
          "Détail incomplet :",
          d
        );

        setMsg(
          "❌ Les informations de cette demande sont incomplètes."
        );

        return;
      }

      setReceipts(
        Array.isArray(d.receipts)
          ? d.receipts
          : []
      );

      setRefunds(
        Array.isArray(d.refunds)
          ? d.refunds
          : []
      );

      setAmounts(
        d.amounts || null
      );

      /*
       * Ouvrir le modal seulement lorsque
       * toutes les données essentielles sont prêtes.
       */
      setDetail({
        ...d.request,

        lines:
          Array.isArray(d.request.lines)
            ? d.request.lines
            : []
      });

    } catch (error) {

      console.error(
        "Erreur openDetail :",
        error
      );

      setMsg(
        "❌ Impossible de charger le détail. Vérifiez la connexion puis réessayez."
      );

    } finally {

      setBusy(false);
    }
  };

  const editRequest = async (r: Req) => {

    setMsg("");
    setBusy(true);

    try {

      const res =
        await authFetch(
          `/disbursements/${r.id}/details`,
          {
            cache: "no-store"
          }
        );

      const d =
        await res.json()
          .catch(() => ({}));

      if (!res.ok) {

        return setMsg(
          `❌ ${
            d?.error ||
            "Impossible de charger la demande."
          }`
        );
      }

      const req =
        d.request || r;

      const lines =
        Array.isArray(
          req.lines
        )
          ? req.lines
          : [];


      setEditingId(
        Number(req.id)
      );

      setEditingStatus(
        String(req.status)
      );


      setForm({
        ...EMPTY,

        beneficiary:
          req.beneficiary_name ||
          "",

        reason:
          req.reason ||
          "",

        urgency:
          req.urgency ||
          "normale",

        payment_method:
          req.payment_method ||
          "especes",

        description:
          req.description ||
          ""
      });


      setRequestLines(
        lines.length
          ? lines.map(
              (line: any) => ({
                category:
                  String(
                    line.category ||
                    ""
                  ),

                label:
                  String(
                    line.label ||
                    ""
                  ),

                quantity:
                  String(
                    line.quantity ??
                    ""
                  ),

                unit_price:
                  String(
                    line.unit_price ??
                    ""
                  ),

                camion_id:
                  line.camion_id
                    ? String(
                        line.camion_id
                      )
                    : "",

                amount:
                  String(
                    line.amount ??
                    ""
                  )
              })
            )
          : [
              {
                ...EMPTY_LINE
              }
            ]
      );


      setDetail(null);
      setShowForm(true);

      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });


    } finally {

      setBusy(false);
    }
  };


  const cancelEdit = () => {

    setEditingId(null);
    setEditingStatus(null);

    setForm({
      ...EMPTY
    });

    setRequestLines([
      {
        ...EMPTY_LINE
      }
    ]);

    setShowForm(false);
    setMsg("");
  };


  const create = async (submit: boolean) => {
    setMsg("");

    if (!form.reason.trim()) {
      return setMsg(
        "L'objet général de la demande est obligatoire."
      );
    }

    const lines = requestLines.map((line, index) => {

      const quantity = Number(line.quantity);
      const unit_price = Number(line.unit_price);

      return {
        line_no: index + 1,
        category: line.category.trim(),
        label: line.label.trim(),
        quantity,
        unit_price,
        camion_id:
          line.camion_id
            ? Number(line.camion_id)
            : null,
        amount:
          quantity * unit_price,
      };
    });

    for (let i = 0; i < lines.length; i += 1) {
      if (!lines[i].category) {
        return setMsg(
          `Catégorie obligatoire à la ligne ${i + 1}.`
        );
      }

      if (!lines[i].label) {
        return setMsg(
          `Libellé obligatoire à la ligne ${i + 1}.`
        );
      }

      if (!(lines[i].quantity > 0)) {
        return setMsg(
          `Quantité obligatoire à la ligne ${i + 1}.`
        );
      }

      if (!(lines[i].unit_price > 0)) {
        return setMsg(
          `Prix unitaire obligatoire à la ligne ${i + 1}.`
        );
      }

      /*
       * DISBURSEMENT_TRUCK_OPTIONAL_FRONT_V3
       *
       * Camion facultatif.
       * On peut toujours le renseigner pour
       * une dépense qui concerne un véhicule.
       */

      if (!(lines[i].amount > 0)) {
        return setMsg(
          `Montant invalide à la ligne ${i + 1}.`
        );
      }
    }

    const amount = lines.reduce(
      (sum, line) => sum + line.amount,
      0
    );

    if (!(amount > 0)) {
      return setMsg("Montant total invalide.");
    }

    setBusy(true);

    const body = {
      amount,
      reason: form.reason,
      category:
        lines.length === 1
          ? lines[0].category
          : "Multi-catégories",
      lines,

      beneficiary_name:
        form.beneficiary.trim() || null,

      urgency: form.urgency,
      payment_method: form.payment_method,
      submit,

      description: [
        form.description,
        form.service && `Service : ${form.service}`,
        form.project && `Projet : ${form.project}`,
        form.desired_date &&
          `Souhaitée le ${form.desired_date}`,
        form.observation,
      ]
        .filter(Boolean)
        .join(" · ") || null,
    };

    const isEditing =
      editingId !== null;

    const res = await authFetch(
      isEditing
        ? `/disbursements/${editingId}`
        : "/disbursements",
      {
        method:
          isEditing
            ? "PUT"
            : "POST",
        headers: {
          "Content-Type":
            "application/json"
        },
        body:
          JSON.stringify(body),
      }
    );

    const d = await res.json().catch(() => ({}));

    if (!res.ok) {
      setBusy(false);
      return setMsg(
        `❌ ${d?.error || "Erreur."}`
      );
    }

    /*
     * Une modification ne crée pas de nouveau justificatif initial.
     */
    if (editingId !== null) {

      setEditingId(null);
      setEditingStatus(null);

      setForm({
        ...EMPTY
      });

      setRequestLines([
        {
          ...EMPTY_LINE
        }
      ]);

      setShowForm(false);

      await load();

      setBusy(false);

      setMsg(
        "✅ Demande modifiée avec succès."
      );

      return;
    }

    if (
      initialReceiptMode === "FILE" &&
      attach
    ) {
      const fd = new FormData();

      fd.append("file", attach);
      fd.append("amount", "0");
      fd.append("label", "Justificatif initial");
      fd.append("receipt_type", "FILE");
      fd.append("initial", "true");

      const rr = await authFetch(
        `/disbursements/${d.id}/receipts`,
        {
          method: "POST",
          body: fd,
        }
      );

      if (!rr.ok) {
        const er =
          await rr.json().catch(() => ({}));

        setBusy(false);

        return setMsg(
          `⚠️ Demande créée mais justificatif initial non enregistré : ${
            er?.error || "Erreur."
          }`
        );
      }
    }


    if (
      initialReceiptMode === "PENDING"
    ) {
      const fd = new FormData();

      fd.append("amount", "0");
      fd.append("label", "Justificatif initial — reçu plus tard");
      fd.append("receipt_type", "PENDING");
      fd.append("initial", "true");
      fd.append(
        "expected_date",
        initialExpectedDate
      );

      const rr = await authFetch(
        `/disbursements/${d.id}/receipts`,
        {
          method: "POST",
          body: fd,
        }
      );

      if (!rr.ok) {
        const er =
          await rr.json().catch(() => ({}));

        setBusy(false);

        return setMsg(
          `⚠️ Demande créée mais reçu futur non enregistré : ${
            er?.error || "Erreur."
          }`
        );
      }
    }


    if (
      initialReceiptMode === "DECLARATION"
    ) {
      const fd = new FormData();

      fd.append("amount", "0");
      fd.append("label", "Justificatif initial — déclaration");
      fd.append("receipt_type", "DECLARATION");
      fd.append("initial", "true");

      fd.append(
        "supplier_name",
        initialSupplier
      );

      fd.append(
        "declaration_text",
        initialDeclaration
      );

      const rr = await authFetch(
        `/disbursements/${d.id}/receipts`,
        {
          method: "POST",
          body: fd,
        }
      );

      if (!rr.ok) {
        const er =
          await rr.json().catch(() => ({}));

        setBusy(false);

        return setMsg(
          `⚠️ Demande créée mais déclaration initiale non enregistrée : ${
            er?.error || "Erreur."
          }`
        );
      }
    }

    setBusy(false);

    setMsg(
      submit
        ? `✅ ${d.request_number} soumise à la Direction — ${lines.length} ligne(s) — ${fcfa(amount)}.`
        : `✅ ${d.request_number} enregistrée en brouillon — ${lines.length} ligne(s) — ${fcfa(amount)}.`
    );

    setForm({ ...EMPTY });
    setRequestLines([{ ...EMPTY_LINE }]);
    setAttach(null);
    setShowForm(false);

    await load();
  };

  const submitDraft = async (id: number) => {
    setBusy(true);
    const res = await authFetch(`/disbursements/${id}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? `✅ ${d.request_number} soumise à la Direction.` : `❌ ${d?.error || "Erreur."}`);
    await load();
  };

  const addReceipt = async () => {
    if (!detail) return;
    if (!file) return setMsg("Choisissez ou photographiez un justificatif.");
    setBusy(true); setMsg("");
    const fd = new FormData();
    fd.append("file", file); fd.append("amount", rec.amount || "0");
    if (rec.label) fd.append("label", rec.label);
    const res = await authFetch(`/disbursements/${detail.id}/receipts`, { method: "POST", body: fd });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(`❌ ${d?.error || "Erreur."}`);
    setMsg("✅ Justificatif envoyé.");
    setFile(null); setRec({ amount: "", label: "" });
    await openDetail(detail); await load();
  };

  if (!loading && !allowed) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow">
          <h1 className="text-xl font-black text-gray-900">Mes demandes</h1>
          <p className="mt-2 font-semibold text-red-600">Vous n&apos;avez pas accès au module financier.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-bold text-yellow-600">TRIANGLE WMS PRO</p>
            <h1 className="text-3xl font-black text-gray-900">Mes demandes de décaissement</h1>
          </div>
          <div className="flex gap-2">
            {can("demande", "create") && (
              <button onClick={() => setShowForm((v) => !v)} className="rounded-xl bg-yellow-500 px-4 py-2 font-black text-black hover:bg-yellow-400">
                + Nouvelle demande
              </button>
            )}
            <Link href="/dashboard" className="rounded-xl border border-gray-300 px-4 py-2 font-bold text-gray-700">← Tableau de bord</Link>
          </div>
        </div>

        {msg && <div className="rounded-xl bg-blue-50 p-4 font-semibold text-blue-900">{msg}</div>}

        {/* Formulaire (PHASE 2) */}
        {showForm && can("demande", "create") && (
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="text-lg font-black text-gray-900">Nouvelle demande de décaissement</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Bénéficiaire"><input className={inp} value={form.beneficiary} onChange={(e) => setForm({ ...form, beneficiary: e.target.value })} /></Field>
              <Field label="Service"><input className={inp} value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} /></Field>
              <Field label="Objet *"><input className={inp} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Ex. Achat fournitures chantier" /></Field>
              <Field label="Devise"><input className={inp} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></Field>
              <Field label="Projet / chantier / site"><input className={inp} value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} /></Field>
              <Field label="Urgence">
                <select className={inp} value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })}>
                  <option value="basse">Basse</option><option value="normale">Normale</option><option value="haute">Haute</option><option value="critique">Critique</option>
                </select>
              </Field>
              <Field label="Date souhaitée"><input type="date" className={inp} value={form.desired_date} onChange={(e) => setForm({ ...form, desired_date: e.target.value })} /></Field>
              <Field label="Mode de paiement souhaité">
                <select className={inp} value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                  <option value="especes">Espèces</option><option value="virement">Virement</option><option value="cheque">Chèque</option><option value="mobile">Mobile money</option>
                </select>
              </Field>


              <Field label="Description" wide><textarea rows={2} className={inp} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
              <Field label="Observation" wide><input className={inp} value={form.observation} onChange={(e) => setForm({ ...form, observation: e.target.value })} /></Field>
              <div className="col-span-full">
                <div className="rounded-2xl border border-gray-200 bg-white p-5">

                  <div className="mb-4">
                    <h3 className="text-lg font-black text-gray-900">
                      Justificatif initial
                    </h3>

                    <p className="text-sm text-gray-500">
                      Facture, proforma, reçu prévu plus tard ou déclaration sans reçu.
                    </p>
                  </div>


                  <div className="grid gap-3 md:grid-cols-3">

                    <button
                      type="button"
                      onClick={() =>
                        setInitialReceiptMode("FILE")
                      }
                      className={`rounded-xl border-2 p-4 text-left ${
                        initialReceiptMode === "FILE"
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-gray-200 bg-white text-gray-900"
                      }`}
                    >
                      <div className="text-lg font-black">
                        📷 Reçu disponible
                      </div>

                      <div className="mt-1 text-sm opacity-80">
                        Photographier ou importer
                      </div>
                    </button>


                    <button
                      type="button"
                      onClick={() =>
                        setInitialReceiptMode("PENDING")
                      }
                      className={`rounded-xl border-2 p-4 text-left ${
                        initialReceiptMode === "PENDING"
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-gray-200 bg-white text-gray-900"
                      }`}
                    >
                      <div className="text-lg font-black">
                        ⌛ Reçu plus tard
                      </div>

                      <div className="mt-1 text-sm opacity-80">
                        Indiquer la date prévue
                      </div>
                    </button>


                    <button
                      type="button"
                      onClick={() =>
                        setInitialReceiptMode("DECLARATION")
                      }
                      className={`rounded-xl border-2 p-4 text-left ${
                        initialReceiptMode === "DECLARATION"
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-gray-200 bg-white text-gray-900"
                      }`}
                    >
                      <div className="text-lg font-black">
                        📝 Aucun reçu
                      </div>

                      <div className="mt-1 text-sm opacity-80">
                        Créer une déclaration
                      </div>
                    </button>

                  </div>


                  {initialReceiptMode === "FILE" && (
                    <div className="mt-4 rounded-xl bg-gray-50 p-4">

                      <p className="mb-3 font-black text-gray-900">
                        Photo ou fichier
                      </p>

                      <div className="grid gap-4 md:grid-cols-2">

                        <div>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,image/*"
                            className="w-full text-sm"
                            onChange={(e) =>
                              setAttach(
                                e.target.files?.[0] || null
                              )
                            }
                          />

                          {attach && (
                            <p className="mt-2 text-sm font-bold text-emerald-700">
                              ✅ {attach.name}
                            </p>
                          )}
                        </div>

                        <CameraReceiptCapture
                          onCapture={(file) => {
                            setAttach(file);
                          }}
                        />

                      </div>

                    </div>
                  )}


                  {initialReceiptMode === "PENDING" && (
                    <div className="mt-4 rounded-xl bg-gray-50 p-4">

                      <label className="block">
                        <span className="mb-2 block font-black text-gray-900">
                          Date prévue du reçu
                        </span>

                        <input
                          type="date"
                          value={initialExpectedDate}
                          onChange={(e) =>
                            setInitialExpectedDate(
                              e.target.value
                            )
                          }
                          className="w-full rounded-xl border border-gray-300 bg-white p-3 text-gray-900"
                        />
                      </label>

                    </div>
                  )}


                  {initialReceiptMode === "DECLARATION" && (
                    <div className="mt-4 grid gap-3 rounded-xl bg-gray-50 p-4 md:grid-cols-2">

                      <label className="block">
                        <span className="mb-2 block font-black text-gray-900">
                          Fournisseur / bénéficiaire
                        </span>

                        <input
                          value={initialSupplier}
                          onChange={(e) =>
                            setInitialSupplier(
                              e.target.value
                            )
                          }
                          className="w-full rounded-xl border border-gray-300 bg-white p-3 text-gray-900"
                          placeholder="Nom du fournisseur"
                        />
                      </label>


                      <label className="block md:col-span-2">
                        <span className="mb-2 block font-black text-gray-900">
                          Déclaration / explication
                        </span>

                        <textarea
                          rows={4}
                          value={initialDeclaration}
                          onChange={(e) =>
                            setInitialDeclaration(
                              e.target.value
                            )
                          }
                          className="w-full rounded-xl border border-gray-300 bg-white p-3 text-gray-900"
                          placeholder="Expliquez pourquoi aucun reçu n'est disponible..."
                        />
                      </label>

                    </div>
                  )}

                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-black text-gray-900">
                    Détail de la demande
                  </p>
                  <p className="text-xs text-gray-500">
                    Ajoutez une ligne par dépense / catégorie.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addRequestLine}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white"
                >
                  + Ajouter une ligne
                </button>
              </div>

              <datalist id="demande-categories">
                <option value="Carburant" />
                <option value="Transport" />
                <option value="Fournitures" />
                <option value="Achat matériel" />
                <option value="Entretien / réparation" />
                <option value="Communication" />
                <option value="Restauration" />
                <option value="Hébergement" />
                <option value="Frais administratifs" />
                <option value="Autre" />
              </datalist>

              <div className="mt-4 space-y-3">
                {requestLines.map((line, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-gray-200 bg-white p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-black text-gray-700">
                        Ligne {index + 1}
                      </p>

                      {requestLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRequestLine(index)}
                          className="rounded-lg bg-red-50 px-3 py-1 text-xs font-bold text-red-700"
                        >
                          Supprimer
                        </button>
                      )}
                    </div>

                    <div className="grid gap-3 md:grid-cols-[1fr_2fr_.8fr_1fr_1fr_1fr]">
                      <div>
                        <label className="mb-1 block text-xs font-bold text-gray-600">
                          Catégorie *
                        </label>
                        <input
                          list="demande-categories"
                          className={inp}
                          value={line.category}
                          placeholder="Ex. Carburant"
                          onChange={(e) =>
                            updateRequestLine(index, {
                              category: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-bold text-gray-600">
                          Libellé / motif de la ligne *
                        </label>
                        <input
                          className={inp}
                          value={line.label}
                          placeholder="Ex. Gasoil camion chantier"
                          onChange={(e) =>
                            updateRequestLine(index, {
                              label: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div>
                    <label className="mb-1 block text-xs font-bold text-gray-600">
                      Quantité *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className={inp}
                      value={line.quantity}
                      placeholder="Ex. 200"
                      onChange={(e) =>
                        updateRequestLine(index, {
                          quantity: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-600">
                      Prix unitaire *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className={inp}
                      value={line.unit_price}
                      placeholder="Ex. 900"
                      onChange={(e) =>
                        updateRequestLine(index, {
                          unit_price: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-600">
                      Camion
                    </label>
                    <select
                      className={inp}
                      value={line.camion_id}
                      onChange={(e) =>
                        updateRequestLine(index, {
                          camion_id: e.target.value,
                        })
                      }
                    >
                      <option value="">
                        Aucun / choisir
                      </option>

                      {camions.map((c:any) => (
                        <option
                          key={c.id}
                          value={c.id}
                        >
                          {c.code}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-600">
                      Montant
                    </label>
                    <input
                      type="number"
                      className={inp}
                      value={
                        (Number(line.quantity) || 0)
                        *
                        (Number(line.unit_price) || 0)
                      }
                      readOnly
                    />
                  </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex justify-end">
                <div className="rounded-xl bg-emerald-50 px-5 py-3 text-right">
                  <p className="text-xs font-bold text-emerald-700">
                    TOTAL DE LA DEMANDE
                  </p>
                  <p className="text-2xl font-black text-emerald-800">
                    {fcfa(totalRequest)}
                  </p>
                </div>
              </div>
            </div>

            {editingId !== null && (
              <div className="mb-4 rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-900">
                ✏️ Modification de la demande.
                {editingStatus === S.WAITING &&
                  " Elle est déjà en attente de la Direction. La sauvegarde conservera ce statut."}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                disabled={busy}
                onClick={() =>
                  create(false)
                }
                className="rounded-xl border border-gray-300 px-4 py-3 font-bold text-gray-700"
              >
                {editingId !== null
                  ? "Enregistrer les modifications"
                  : "Enregistrer brouillon"}
              </button>
              {editingId === null && (
                <button
                  disabled={busy}
                  onClick={() =>
                    create(true)
                  }
                  className="rounded-xl bg-emerald-600 px-6 py-3 font-black text-white disabled:opacity-60"
                >
                  {busy
                    ? "Envoi…"
                    : "Soumettre à la Direction"}
                </button>
              )}

              {editingId !== null && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={cancelEdit}
                  className="rounded-xl bg-slate-200 px-4 py-3 font-black text-slate-700"
                >
                  Annuler la modification
                </button>
              )}
              <span className="self-center text-xs text-gray-500">Un brouillon n&apos;est pas transmis à la Direction.</span>
            </div>
          </section>
        )}

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button key={f.key || "all"} onClick={() => setFilter(f.key)}
              className={`rounded-xl px-3 py-1.5 text-sm font-bold ${filter === f.key ? "bg-slate-900 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>
              {f.label}
            </button>
          ))}
        </div>

        <section className="rounded-2xl bg-white p-4 shadow">
          {items.length === 0 ? (
            <p className="p-4 text-gray-600">Aucune demande.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead><tr className="text-left text-gray-500">
                  <th className="p-2">N°</th><th className="p-2">Date</th><th className="p-2">Objet</th>
                  <th className="p-2">Montant</th><th className="p-2">Décaissé</th><th className="p-2">Statut</th><th className="p-2">Actions</th>
                </tr></thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id} className="border-t border-gray-100">
                      <td className="p-2 font-mono text-xs text-gray-900">{r.request_number}</td>
                      <td className="p-2 text-gray-600">{fdate(r.created_at)}</td>
                      <td className="p-2 text-gray-700">{r.reason}</td>
                      <td className="p-2 font-bold text-gray-900">{fcfa(r.amount)}</td>
                      <td className="p-2 text-gray-700">{fcfa(r.amount_disbursed)}</td>
                      <td className="p-2"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${COLOR[r.status] || "bg-gray-200"}`}>{r.status.replace(/_/g, " ")}</span></td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          <button
                            onClick={() =>
                              openDetail(r)
                            }
                            className="rounded-lg bg-gray-200 px-2 py-1 text-xs font-bold text-gray-800"
                          >
                            Suivre
                          </button>

                          {[S.DRAFT, S.WAITING].includes(r.status) &&
                            can("demande", "update") && (
                              <button
                                disabled={busy}
                                onClick={() =>
                                  editRequest(r)
                                }
                                className="rounded-lg bg-amber-500 px-2 py-1 text-xs font-black text-black"
                              >
                                Modifier
                              </button>
                            )}

                          {[S.DRAFT, S.WAITING].includes(r.status) &&
                            can("demande", "update") && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  deleteRequest(r)
                                }
                                className="rounded-lg bg-red-100 px-2 py-1 text-xs font-black text-red-700"
                              >
                                Supprimer
                              </button>
                            )}

                          {r.status === S.DRAFT && can("demande", "update") && (
                            <button disabled={busy} onClick={() => submitDraft(r.id)} className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-bold text-white">Soumettre</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* DISBURSEMENT_SAFE_MODAL_V3 */}
      {detail ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="mt-8 w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="break-words text-xl font-black text-gray-900">
                  {String(detail.request_number || "Demande")}
                </h3>

                <p className="mt-1 break-words text-sm text-gray-600">
                  {String(detail.reason || "Aucun motif")}
                </p>
              </div>

              <div className="flex shrink-0 gap-2">
                {(
                  String(detail.status || "") === S.DRAFT ||
                  String(detail.status || "") === S.WAITING
                ) &&
                  can("demande", "update") && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => editRequest(detail)}
                      className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-black text-black disabled:opacity-50"
                    >
                      ✏️ Modifier
                    </button>
                  )}

                {(
                  String(detail.status || "") === S.DRAFT ||
                  String(detail.status || "") === S.WAITING
                ) &&
                  can("demande", "update") && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        deleteRequest(detail)
                      }
                      className="rounded-lg bg-red-100 px-3 py-2 text-sm font-black text-red-700 disabled:opacity-50"
                    >
                      🗑️ Supprimer
                    </button>
                  )}

                <button
                  type="button"
                  onClick={() => setDetail(null)}
                  className="rounded-lg bg-gray-100 px-3 py-2 text-xl font-black text-gray-500"
                >
                  ×
                </button>
              </div>
            </div>


            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs font-bold text-gray-500">
                  Demandé
                </p>
                <p className="font-black text-gray-900">
                  {Number(detail.amount || 0).toLocaleString("fr-FR")} FCFA
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs font-bold text-gray-500">
                  Décaissé
                </p>
                <p className="font-black text-gray-900">
                  {Number(detail.amount_disbursed || 0).toLocaleString("fr-FR")} FCFA
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs font-bold text-gray-500">
                  Statut
                </p>
                <p className="break-words font-black text-gray-900">
                  {String(detail.status || "INCONNU").replace(/_/g, " ")}
                </p>
              </div>

              <div className="rounded-xl bg-green-50 p-3">
                <p className="text-xs font-bold text-green-700">
                  Justifié
                </p>
                <p className="font-black text-green-800">
                  {Number(amounts?.justified || 0).toLocaleString("fr-FR")} FCFA
                </p>
              </div>

              <div className="rounded-xl bg-blue-50 p-3">
                <p className="text-xs font-bold text-blue-700">
                  Remboursé
                </p>
                <p className="font-black text-blue-800">
                  {Number(amounts?.refunded || 0).toLocaleString("fr-FR")} FCFA
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs font-bold text-gray-500">
                  Reste à justifier
                </p>
                <p className="font-black text-gray-900">
                  {Number(amounts?.remaining || 0).toLocaleString("fr-FR")} FCFA
                </p>
              </div>
            </div>


            <div className="mt-5 rounded-xl border border-gray-200 p-4">
              <p className="mb-3 font-black text-gray-900">
                Lignes de la demande
              </p>

              {Array.isArray(detail.lines) && detail.lines.length > 0 ? (
                <div className="space-y-2">
                  {detail.lines.map((line: any, index: number) => (
                    <div
                      key={String(line?.id ?? line?.line_no ?? index)}
                      className="rounded-xl bg-gray-50 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-500">
                            Ligne {String(line?.line_no ?? index + 1)}
                          </p>

                          <p className="break-words font-black text-gray-900">
                            {String(line?.category || "Non catégorisé")}
                          </p>

                          <p className="break-words text-sm text-gray-600">
                            {String(line?.label || "")}
                          </p>

                          {line?.quantity != null ? (
                            <p className="mt-1 text-xs text-gray-500">
                              Qté : {String(line.quantity)}
                              {line?.unit_price != null
                                ? ` × ${Number(line.unit_price).toLocaleString("fr-FR")} FCFA`
                                : ""}
                            </p>
                          ) : null}
                        </div>

                        <p className="shrink-0 font-black text-gray-900">
                          {Number(line?.amount || 0).toLocaleString("fr-FR")} FCFA
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  Aucune ligne détaillée enregistrée.
                </p>
              )}
            </div>


            {detail.approval_comment ? (
              <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                <b>Direction :</b>{" "}
                {String(detail.approval_comment)}
              </div>
            ) : null}


            {detail.disbursement_comment ? (
              <div className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
                <b>Comptabilité :</b>{" "}
                {String(detail.disbursement_comment)}
              </div>
            ) : null}


            {Array.isArray(receipts) && receipts.length > 0 ? (
              <div className="mt-5">
                <p className="mb-2 font-black text-gray-900">
                  Justificatifs
                </p>

                <div className="space-y-2">
                  {receipts.map((r: any, index: number) => (
                    <div
                      key={String(r?.id ?? index)}
                      className="rounded-xl border border-gray-200 p-3 text-sm"
                    >
                      <p className="break-words font-bold text-gray-900">
                        {String(r?.file_name || r?.label || "Justificatif")}
                      </p>

                      <p className="text-gray-600">
                        {Number(r?.amount || 0).toLocaleString("fr-FR")} FCFA
                      </p>

                      {r?.review_status ? (
                        <p className="text-xs font-bold text-gray-500">
                          {String(r.review_status)}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}


            {Array.isArray(refunds) && refunds.length > 0 ? (
              <div className="mt-5">
                <p className="mb-2 font-black text-gray-900">
                  Remboursements
                </p>

                <div className="space-y-2">
                  {refunds.map((r: any, index: number) => (
                    <div
                      key={String(r?.id ?? index)}
                      className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900"
                    >
                      Remboursement :{" "}
                      <b>
                        {Number(r?.amount || 0).toLocaleString("fr-FR")} FCFA
                      </b>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}


            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="rounded-xl bg-slate-900 px-5 py-3 font-black text-white"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}

const inp = "w-full rounded-xl border border-gray-300 p-3 text-gray-900";
function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <div className={wide ? "sm:col-span-2 lg:col-span-3" : ""}><label className="mb-1 block text-sm font-semibold text-gray-700">{label}</label>{children}</div>;
}
function Box({ label, value, c }: { label: string; value: string; c?: string }) {
  return <div className="rounded-lg bg-gray-50 p-2 text-center"><p className={`font-black ${c || "text-gray-900"}`}>{value}</p><p className="text-xs text-gray-500">{label}</p></div>;
}
