"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "../lib/api";

/**
 * PHASE 3 — Encaissement d'une facture de vente (Ciment ou Sable).
 *
 * Le statut n'est JAMAIS choisi par l'utilisateur : il est calculé par le
 * serveur à partir des paiements réellement enregistrés. On ne peut donc pas
 * marquer une facture payée sans encaisser l'argent.
 *
 * En mode Banque, la banque doit être choisie explicitement — aucune sélection
 * automatique. Les banques proposées sont uniquement les banques ACTIVES de
 * l'entreprise active (route métier dédiée, sans accès au reste de la compta).
 */

export type PayableInvoice = {
  id: number;
  invoice_number: string;
  client_name?: string | null;
  customer_name?: string | null;
  total_amount: string | number;
  paid_amount: string | number;
  remaining_amount: string | number;
};
type Bank = { id: number; bank_name: string; account_number?: string | null };

const money = (v: string | number | null | undefined) =>
  v == null || v === "" ? "0" : Number(v).toLocaleString("fr-FR");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function PaiementFactureModal({
  module, invoice, onClose, onPaid,
}: {
  module: "cement" | "sand";
  invoice: PayableInvoice;
  onClose: () => void;
  onPaid: (message: string) => void;
}) {
  const remaining = Number(invoice.remaining_amount || 0);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [banksLoaded, setBanksLoaded] = useState(false);
  const [method, setMethod] = useState<"ESPECES" | "BANQUE">("ESPECES");
  const [bankId, setBankId] = useState("");
  const [amount, setAmount] = useState(String(remaining));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  /* Clé d'idempotence générée UNE SEULE FOIS à l'ouverture du modal.
     Elle protège les rejeux involontaires — double-clic, retry réseau — sans
     jamais confondre deux paiements réellement distincts : une clé dérivée de
     (facture, montant, date, banque) aurait rejeté un second versement
     légitime du même montant le même jour sur la même banque.
     Fermer puis rouvrir le modal démonte le composant : nouvelle clé. */
  const [idempotencyKey] = useState(() => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `payment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  });

  const loadBanks = useCallback(async () => {
    const r = await authFetch(`/${module}/payment-destinations`);
    if (r.ok) setBanks((await r.json()).banks || []);
    setBanksLoaded(true);
  }, [module]);
  useEffect(() => { loadBanks(); }, [loadBanks]);

  const value = Number(amount || 0);
  const noBank = banksLoaded && banks.length === 0;
  const invalid =
    !(value > 0) || value > remaining || (method === "BANQUE" && (!bankId || noBank));

  const submit = async () => {
    setError("");
    if (!(value > 0)) return setError("Le montant reçu doit être supérieur à 0.");
    if (value > remaining) return setError(`Le montant dépasse le reste à payer (${money(remaining)} FCFA).`);
    if (method === "BANQUE" && !bankId) return setError("Sélectionnez la banque qui reçoit le paiement.");

    setBusy(true); // désactive le bouton : pas de double-clic
    const res = await authFetch(`/${module}/invoices/${invoice.id}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Stable pendant toute la vie du modal : les retry ne créent qu'un paiement.
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        amount: value,
        payment_method: method === "BANQUE" ? "banque" : "especes",
        bank_id: method === "BANQUE" ? Number(bankId) : null,
        payment_date: date,
        reference: reference || null,
        notes: notes || null,
      }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(d?.error || "Erreur lors de l'enregistrement du paiement.");
    onPaid(
      `✅ Paiement de ${money(value)} FCFA enregistré sur ${invoice.invoice_number} — ${d?.destination?.label || "trésorerie"}.`
    );
  };

  const inp = "w-full rounded-lg border border-gray-300 p-2.5 text-gray-900";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-black text-gray-900">Enregistrer un paiement</h2>

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-gray-50 p-4 text-sm">
          <p className="col-span-2"><span className="text-gray-500">Facture</span><br />
            <b className="text-gray-900">{invoice.invoice_number}</b></p>
          <p className="col-span-2"><span className="text-gray-500">Client</span><br />
            <b className="text-gray-900">{invoice.client_name || invoice.customer_name || "—"}</b></p>
          <p><span className="text-gray-500">Montant total</span><br />
            <b className="text-gray-900">{money(invoice.total_amount)} F</b></p>
          <p><span className="text-gray-500">Déjà payé</span><br />
            <b className="text-gray-900">{money(invoice.paid_amount)} F</b></p>
          <p className="col-span-2"><span className="text-gray-500">Reste à payer</span><br />
            <b className="text-lg text-red-600">{money(remaining)} F</b></p>
        </div>

        {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-sm font-bold text-gray-700">Montant reçu</span>
            <input type="number" min="0" max={remaining} className={inp} value={amount}
              onChange={(e) => setAmount(e.target.value)} />
            <span className="text-xs text-gray-500">Modifiable pour un paiement partiel — maximum {money(remaining)} F.</span>
          </label>

          <label className="block">
            <span className="text-sm font-bold text-gray-700">Mode de paiement</span>
            <select className={inp} value={method}
              onChange={(e) => setMethod(e.target.value as "ESPECES" | "BANQUE")}>
              <option value="ESPECES">ESPÈCES</option>
              <option value="BANQUE">BANQUE</option>
            </select>
          </label>

          {method === "BANQUE" && (
            noBank ? (
              <p className="rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                Aucune banque active. Créez d&apos;abord une banque dans Comptabilité.
              </p>
            ) : (
              <label className="block">
                <span className="text-sm font-bold text-gray-700">Banque qui reçoit le paiement</span>
                {/* Aucune présélection : l'utilisateur choisit explicitement. */}
                <select className={inp} value={bankId} onChange={(e) => setBankId(e.target.value)}>
                  <option value="">— Sélectionnez une banque —</option>
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bank_name}{b.account_number ? ` — ${b.account_number}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            )
          )}

          <label className="block">
            <span className="text-sm font-bold text-gray-700">Référence <span className="font-normal text-gray-400">(facultatif)</span></span>
            <input className={inp} value={reference} onChange={(e) => setReference(e.target.value)}
              placeholder="Virement client, bordereau, référence bancaire…" />
          </label>

          <label className="block">
            <span className="text-sm font-bold text-gray-700">Observation <span className="font-normal text-gray-400">(facultatif)</span></span>
            <input className={inp} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>

          <label className="block">
            <span className="text-sm font-bold text-gray-700">Date du paiement</span>
            <input type="date" className={inp} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} disabled={busy}
            className="rounded-lg border border-gray-300 px-4 py-2 font-bold text-gray-700 disabled:opacity-50">
            Annuler
          </button>
          <button onClick={submit} disabled={busy || invalid}
            className="rounded-lg bg-emerald-600 px-5 py-2 font-black text-white disabled:opacity-50">
            {busy ? "Enregistrement…" : "Confirmer le paiement"}
          </button>
        </div>
      </div>
    </div>
  );
}
