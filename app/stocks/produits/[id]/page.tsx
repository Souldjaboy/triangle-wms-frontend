"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { authFetch } from "../../../lib/api";
import { usePermissions } from "../../../lib/permissions";
import BinSelector, { useBinTree, type Bin } from "../../../components/BinSelector";

/**
 * STOCK PAR EMPLACEMENT D'UN PRODUIT, ET OPÉRATIONS AU BAC PRÈS.
 *
 * Quatre opérations, et une seule règle à retenir :
 *   ENTRÉE    augmente le bac ET le stock global ;
 *   PRÉPARER  réserve dans le bac, ne déduit RIEN — le stock global ne bouge pas ;
 *   VALIDER   convertit la réservation en sortie réelle, le stock global baisse ;
 *   TRANSFERT déplace d'un bac à l'autre, le stock global ne change JAMAIS.
 *
 * Un bac vidé garde sa ligne, passe à 0 et devient EMPTY : il reste
 * immédiatement réutilisable pour un autre produit.
 */

type Balance = {
  id: number; location_id: number; quantity: number; reserved_quantity: number;
  available: number; status: "EMPTY" | "OCCUPIED";
  full_code: string | null; emplacement_code: string | null; warehouse_code: string | null;
  row_code: string | null; loc_code: string | null; lvl_code: string | null; bin_code: string | null;
};
type Detail = {
  product: { id: number; name: string; reference: string | null; stock: number; unit: string | null;
             location_managed: boolean };
  balances: Balance[];
  totals: { stock: number; reparti: number; aLocaliser: number; reserve: number };
};
type Reservation = {
  id: number; quantity: string; location_id: number;
  full_code: string | null; bin_code: string | null; created_by_name: string | null;
};

const n = (v: unknown) => Number(v || 0).toLocaleString("fr-FR");
type Op = "entry" | "reserve" | "exit" | "transfer";

const OPS: Record<Op, { titre: string; verbe: string; effet: string }> = {
  entry: { titre: "Entrée dans un bac", verbe: "Enregistrer l'entrée",
    effet: "Le bac ET le stock global augmentent." },
  reserve: { titre: "Préparer une sortie", verbe: "Réserver",
    effet: "Le stock ne bouge pas : seule la quantité disponible du bac baisse." },
  exit: { titre: "Sortie immédiate", verbe: "Sortir",
    effet: "Le bac ET le stock global diminuent, sans passer par une préparation." },
  transfer: { titre: "Transfert entre bacs", verbe: "Transférer",
    effet: "Le stock global reste strictement inchangé." },
};

export default function ProduitEmplacementsPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const { can } = usePermissions();
  const canApply = can("stock", "validate");
  const canPrepare = can("stock", "create");
  const { tree, reload: reloadTree } = useBinTree();

  const [data, setData] = useState<Detail | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [op, setOp] = useState<Op | null>(null);

  const load = useCallback(async () => {
    const r = await authFetch(`/stock/products/${id}/balances`, { cache: "no-store" });
    if (!r.ok) return setError(r.status === 404 ? "Produit introuvable." : "Erreur de chargement.");
    setData(await r.json());
    const v = await authFetch(`/stock/products/${id}/reservations`, { cache: "no-store" });
    if (v.ok) setReservations(await v.json());
  }, [id]);
  useEffect(() => { if (id) load(); }, [id, load]);

  const apres = async (m: string) => {
    setNotice(m); setError(""); setOp(null);
    await load(); await reloadTree();
  };

  const agirReservation = async (r: Reservation, action: "release" | "validate") => {
    const res = await authFetch(`/stock/locations/reservations/${r.id}/${action}`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setError(d?.error || "Échec de l'opération.");
    await apres(action === "release"
      ? `Réservation de ${n(r.quantity)} libérée. Stock inchangé.`
      : `Sortie validée : ${n(r.quantity)} unité(s), stock ${n(d.stockBefore)} → ${n(d.stockAfter)}.`);
  };

  if (error && !data) return <div className="p-8 font-semibold text-red-700">{error}</div>;
  if (!data) return <div className="p-8 text-gray-600">Chargement…</div>;

  const p = data.product;
  const t = data.totals;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <Link href="/stocks/repartition" className="text-sm font-bold text-blue-700">← Répartition</Link>
        <h1 className="mt-1 text-2xl font-black text-gray-900 sm:text-3xl">{p.name}</h1>
        <p className="mt-1 text-sm text-gray-600">
          {p.reference || "sans référence"} · stock global <span className="font-bold">{n(p.stock)}</span> {p.unit || ""}
          {p.location_managed
            ? <> · <span className="font-bold text-green-700">réparti par emplacement</span></>
            : <> · <span className="font-bold text-amber-700">répartition non établie</span></>}
        </p>

        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}
        {notice && (
          <p className="mt-4 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-900">
            {notice} <button onClick={() => setNotice("")} className="underline">fermer</button>
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Box label="Stock global" value={n(t.stock)} />
          <Box label="Réparti" value={n(t.reparti)} tone="text-green-700" />
          <Box label="Réservé" value={n(t.reserve)} tone="text-blue-700" />
          <Box label="À localiser" value={n(t.aLocaliser)} tone={t.aLocaliser > 0 ? "text-amber-700" : ""} />
        </div>

        {t.aLocaliser !== 0 && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            {n(Math.abs(t.aLocaliser))} unité(s) {t.aLocaliser > 0 ? "ne sont rattachées à aucun bac" : "de trop dans les bacs"}.
            Le stock global reste la référence — passez par la répartition pour régler l&apos;écart.
          </p>
        )}

        {/* ---------- STOCK PAR EMPLACEMENT ---------- */}
        <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-black text-gray-900">Stock par emplacement</h2>
            <div className="flex flex-wrap gap-2">
              {(["entry", "reserve", "exit", "transfer"] as Op[]).map((k) => {
                const autorise = k === "reserve" ? canPrepare : canApply;
                return autorise ? (
                  <button key={k} onClick={() => setOp(k)}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-gray-800">
                    {OPS[k].titre}
                  </button>
                ) : null;
              })}
            </div>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="p-2">Entrepôt</th><th className="p-2">Rayon</th>
                  <th className="p-2">Location</th><th className="p-2">Level</th><th className="p-2">BIN</th>
                  <th className="p-2 text-right">Quantité</th><th className="p-2 text-right">Réservé</th>
                  <th className="p-2 text-right">Disponible</th><th className="p-2">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {!data.balances.length && (
                  <tr><td colSpan={9} className="p-6 text-center text-gray-500">
                    Aucun emplacement. Ce produit n&apos;est pas encore réparti.
                  </td></tr>
                )}
                {data.balances.map((b) => (
                  <tr key={b.id} className={b.status === "EMPTY" ? "text-gray-400" : ""}>
                    <td className="p-2 font-bold">{b.warehouse_code || "—"}</td>
                    <td className="p-2">{b.row_code || "—"}</td>
                    <td className="p-2">{b.loc_code || "—"}</td>
                    <td className="p-2">{b.lvl_code || "—"}</td>
                    <td className="p-2 font-bold">{b.bin_code || "—"}</td>
                    <td className="p-2 text-right font-bold">{n(b.quantity)}</td>
                    <td className="p-2 text-right text-blue-700">{n(b.reserved_quantity)}</td>
                    <td className="p-2 text-right font-bold text-green-700">{n(b.available)}</td>
                    <td className="p-2">
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${
                        b.status === "EMPTY" ? "bg-gray-200 text-gray-600" : "bg-green-100 text-green-800"}`}>
                        {b.status === "EMPTY" ? "VIDE" : "OCCUPÉ"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Un bac vidé conserve sa ligne à 0 et redevient <span className="font-bold">VIDE</span> :
            il reste réutilisable, y compris pour un autre produit.
          </p>
        </section>

        {/* ---------- SORTIES PRÉPARÉES ---------- */}
        {reservations.length > 0 && (
          <section className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <h2 className="text-lg font-black text-gray-900">Sorties préparées</h2>
            <p className="mt-1 text-sm text-blue-900">
              Ces quantités sont réservées mais <span className="font-bold">toujours en stock</span>.
              Seule la validation les déduit.
            </p>
            <div className="mt-3 space-y-2">
              {reservations.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3">
                  <p className="text-sm">
                    <span className="font-black">{n(r.quantity)}</span> unité(s) réservée(s) sur{" "}
                    <span className="font-bold">{r.full_code || r.bin_code}</span>
                    {r.created_by_name ? <span className="text-gray-500"> — {r.created_by_name}</span> : null}
                  </p>
                  <div className="flex gap-2">
                    {canPrepare && (
                      <button onClick={() => agirReservation(r, "release")}
                              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700">
                        Annuler la préparation
                      </button>
                    )}
                    {canApply && (
                      <button onClick={() => agirReservation(r, "validate")}
                              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">
                        Valider la sortie
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {op && (
        <OperationModal op={op} productId={p.id} produit={p.name} tree={tree}
                        onClose={() => setOp(null)} onDone={apres} onError={setError} />
      )}
    </div>
  );
}

/* ============================== OPÉRATIONS ============================== */

function OperationModal({ op, productId, produit, tree, onClose, onDone, onError }: {
  op: Op; productId: number; produit: string;
  tree: ReturnType<typeof useBinTree>["tree"];
  onClose: () => void; onDone: (m: string) => void; onError: (m: string) => void;
}) {
  const [source, setSource] = useState<Bin | null>(null);
  const [destination, setDestination] = useState<Bin | null>(null);
  const [quantity, setQuantity] = useState("");
  const [busy, setBusy] = useState(false);

  const q = Number(quantity || 0);
  const estTransfert = op === "transfer";
  const bacPrincipal = op === "entry" ? destination : source;
  const trop = !estTransfert && op !== "entry" && bacPrincipal ? q > bacPrincipal.available : false;
  const valide = q > 0 && bacPrincipal
    && (!estTransfert || (destination && source && destination.id !== source.id))
    && !trop;

  const envoyer = async () => {
    setBusy(true);
    const corps: Record<string, unknown> = { productId, quantity: q };
    let url = "";
    if (op === "entry") { url = "/stock/locations/entry"; corps.locationId = destination!.id; }
    if (op === "exit") { url = "/stock/locations/exit"; corps.locationId = source!.id; }
    if (op === "reserve") { url = "/stock/locations/reserve"; corps.locationId = source!.id; }
    if (op === "transfer") {
      url = "/stock/locations/transfer";
      corps.sourceLocationId = source!.id; corps.destinationLocationId = destination!.id;
    }
    const r = await authFetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return onError(d?.error || "Échec de l'opération.");
    if (op === "reserve") {
      return onDone(`${n(q)} unité(s) réservées sur ${source!.code}. ` +
        `Stock inchangé, disponible ${n(d.availableAfter)}.`);
    }
    if (op === "transfer") {
      return onDone(`${n(q)} unité(s) transférées : ${source!.code} ${n(d.sourceBefore)} → ${n(d.sourceAfter)}, ` +
        `${destination!.code} ${n(d.destinationBefore)} → ${n(d.destinationAfter)}. Stock global inchangé.`);
    }
    onDone(`${OPS[op].titre} : ${n(q)} unité(s), bac ${n(d.locationBefore)} → ${n(d.locationAfter)}, ` +
      `stock global ${n(d.stockBefore)} → ${n(d.stockAfter)}.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-gray-900">{OPS[op].titre}</h2>
            <p className="text-sm text-gray-600">{produit} — {OPS[op].effet}</p>
          </div>
          <button onClick={onClose} className="text-2xl leading-none text-gray-400">×</button>
        </div>

        <div className="mt-4 space-y-4">
          {op !== "entry" && (
            <BinSelector tree={tree} value={source} onSelect={setSource}
                         label={estTransfert ? "Bac SOURCE" : "Bac où prélever"} />
          )}
          {(op === "entry" || estTransfert) && (
            <BinSelector tree={tree} value={destination} onSelect={setDestination}
                         label={estTransfert ? "Bac DESTINATION" : "Bac de destination"} />
          )}
          <label className="block text-xs font-bold text-gray-700">Quantité
            <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)}
                   className="mt-1 w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </label>
        </div>

        {trop && bacPrincipal && (
          <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm font-semibold text-red-800">
            {n(q)} demandé(s) mais seulement {n(bacPrincipal.available)} disponible(s) dans ce bac
            ({n(bacPrincipal.quantity)} présent(s) dont {n(bacPrincipal.reserved)} réservé(s)).
          </p>
        )}
        {estTransfert && source && destination && source.id === destination.id && (
          <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm font-semibold text-red-800">
            Source et destination identiques.
          </p>
        )}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700">
            Annuler
          </button>
          <button onClick={envoyer} disabled={!valide || busy}
                  className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">
            {busy ? "En cours…" : OPS[op].verbe}
          </button>
        </div>
      </div>
    </div>
  );
}

function Box({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-black ${tone || "text-gray-900"}`}>{value}</p>
    </div>
  );
}
