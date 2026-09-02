"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatFCFA } from "../lib/format";
import { afficherDate } from "../lib/dates";

/* Le type d'un document est du texte libre selon son origine : on le classe
   pour filtrer, sans jamais le réécrire. Même règle que le serveur. */
function familleDocument(type: string) {
  const t = String(type || "").toUpperCase();
  if (/RECEPTION|RÉCEPTION|ENTR[EÉ]E|RECU|REÇU/.test(t)) return "RECEPTION";
  if (/SORTIE|LIVRAISON|EXIT/.test(t)) return "SORTIE";
  return "AUTRE";
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  /* Sélection pour l'impression groupée. Cocher n'écrit rien. */
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [filtre, setFiltre] = useState<"TOUS" | "RECEPTION" | "SORTIE">("TOUS");
  const [apercuAuteur, setApercuAuteur] = useState<any>(null);
  /* Désactivée par défaut : l'historique n'a pas à se mêler au dernier import. */
  const [avecHistorique, setAvecHistorique] = useState(false);
  const [dernierImport, setDernierImport] = useState<any>(null);
  /* La sélection porte des clés composites « ev:12 » / « mv:34 » : en mode
     historique, événements d'import et anciens mouvements coexistent dans la
     même liste, et leurs identifiants numériques se recouvrent. */
  const [selectionMvt, setSelectionMvt] = useState<Set<string>>(new Set());
  const [generation, setGeneration] = useState(false);
  /* Vrai quand la liste vient des événements d'import et non des mouvements.
     Les deux ne se génèrent pas par la même route : un événement porte sa
     propre quantité, un mouvement consolidé porte leur somme. */
  const [parEvenement, setParEvenement] = useState(false);

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  });

  const fetchData = async () => {
    try {
      const docsRes = await fetch("/api/documents", { headers: authHeaders() });
      const docsData = await docsRes.json();
      setDocuments(Array.isArray(docsData) ? docsData : []);

      /* Le serveur décide ce qui reste à documenter : il rattache les
         mouvements au DERNIER import par `import_id`, et sait lesquels portent
         déjà un document actif. L'écran ne devine plus rien à partir du texte
         d'une observation — c'est ce rapprochement approximatif qui mélangeait
         l'ancienne sortie de 20 avec la nouvelle de 10. */
      /* Les ÉVÉNEMENTS d'abord. Un mouvement peut consolider plusieurs
         sorties : celui de STADE 4 AOUT vaut 20 alors qu'il y a eu trois
         sorties de 7, 7 et 6. Afficher les mouvements montre donc un 20 que
         personne n'a sorti en une fois et qu'aucun bon ne peut porter. Quand
         l'import a produit ses événements, c'est eux qu'on liste, une fiche
         par sortie réelle. */
      const suffixe = avecHistorique ? "?historique=1" : "";
      const evtRes = await fetch(`/api/documents/pending-events${suffixe}`,
        { headers: authHeaders() });
      const evtData = await evtRes.json().catch(() => null);
      const evts = Array.isArray(evtData?.evenements) ? evtData.evenements : [];

      const mvtRes = await fetch(`/api/documents/pending-movements${suffixe}`,
        { headers: authHeaders() });
      const mvtData = await mvtRes.json().catch(() => null);
      const mvts = Array.isArray(mvtData?.mouvements) ? mvtData.mouvements : [];

      /* Le repli sur les mouvements ne vaut que si l'import n'a JAMAIS produit
         d'événements — un import ancien, une saisie manuelle. Une fois les 21
         bons émis, la liste des événements est vide sans que rien ne soit à
         reprendre : retomber alors sur les mouvements ferait réapparaître les
         lignes consolidées de 20 qu'on vient de remplacer. */
      const modeEvenement = Boolean(evtData?.importAvecEvenements) || evts.length > 0;
      setParEvenement(modeEvenement);

      /* Chaque ligne dit ce qu'elle est. En historique, les deux familles se
         côtoient : les sorties reconstruites du dernier import, et les anciens
         mouvements consolidés que l'on ne documente plus par défaut. */
      const fiches = modeEvenement
        ? [
          ...evts.map((e: any) => ({ ...e, _kind: "ev", _cle: `ev:${e.id}` })),
          ...(avecHistorique
            ? mvts.map((m: any) => ({ ...m, _kind: "mv", _cle: `mv:${m.id}` }))
            : []),
        ]
        : mvts.map((m: any) => ({ ...m, _kind: "mv", _cle: `mv:${m.id}` }));

      setMovements(fiches);
      setDernierImport(evtData?.dernierImport || mvtData?.dernierImport || null);
      setSelectionMvt(new Set());
    } catch (error) {
      console.error(error);
      setDocuments([]);
      setMovements([]);
    }
  };

  /* Preview LECTURE SEULE : quels documents viennent du dernier import Excel.
     Aucune écriture — la substitution d'auteur ne vit qu'à l'impression. */
  const chargerApercuAuteur = async () => {
    const r = await fetch("/api/documents/print/author-preview", {
      headers: authHeaders(), cache: "no-store",
    });
    if (r.ok) setApercuAuteur(await r.json().catch(() => null));
  };

  useEffect(() => {
    chargerApercuAuteur();
  }, []);

  /* `avecHistorique` change l'URL appelée : sans lui dans les dépendances, la
     case se cochait et la liste ne bougeait pas. La sélection est vidée au
     passage — une case cochée sur un mouvement qui vient de disparaître de la
     liste serait quand même envoyée à la génération groupée. */
  useEffect(() => {
    setSelectionMvt(new Set());
    fetchData();
  }, [avecHistorique]);

  const documentsFiltres = useMemo(
    () => documents.filter((d) => filtre === "TOUS" || familleDocument(d.document_type) === filtre),
    [documents, filtre]
  );
  const tousSelectionnes = documentsFiltres.length > 0
    && documentsFiltres.every((d) => selection.has(d.id));

  const basculer = (id: number) => setSelection((prev) => {
    const s = new Set(prev);
    if (s.has(id)) s.delete(id); else s.add(id);
    return s;
  });
  const toutSelectionner = () => setSelection((prev) => {
    if (tousSelectionnes) {
      const s = new Set(prev);
      documentsFiltres.forEach((d) => s.delete(d.id));
      return s;
    }
    return new Set([...prev, ...documentsFiltres.map((d) => d.id)]);
  });
  const imprimerSelection = () => {
    if (!selection.size) return;
    /* Un seul onglet, un seul travail d'impression pour toute la série. */
    window.open(`/documents/impression?ids=${[...selection].join(",")}&print=1`, "_blank");
  };

  const getDefaultDocumentType = (movement: any) => {
    if (movement.type === "Entrée") return "Bon de réception";
    /* Une sortie de stock peut être une casse, un départ vers un chantier ou
       une consommation interne. Un bon de livraison, lui, accompagne une
       marchandise vendue et livrée : les confondre fait sortir des BL que
       personne n'a commandés. */
    if (movement.type === "Sortie") return "Bon de sortie";
    if (movement.type === "Transfert") return "Bon de transfert";
    if (movement.type === "Inventaire") return "Fiche inventaire";
    return "Document stock";
  };

  /* Un événement d'import dit son sens en anglais technique (OUT), un
     mouvement en français métier (Sortie). L'écran, lui, parle français. */
  const sensDe = (ligne: any) => {
    if (ligne.type) return ligne.type;
    if (ligne.direction === "OUT") return "Sortie";
    if (ligne.direction === "IN") return "Entrée";
    if (String(ligne.direction || "").startsWith("TRANSFER")) return "Transfert";
    return "Mouvement";
  };

  const getDocumentButtonLabel = (movement: any) => {
    if (movement.type === "Entrée") return "Générer BR";
    if (movement.type === "Sortie") return "Générer BS";
    if (movement.type === "Transfert") return "Générer BT";
    if (movement.type === "Inventaire") return "Générer fiche inventaire";
    return "Générer document";
  };

  /* Un seul appel pour tout le lot. Une boucle qui appelle N fois la route
     unitaire laisse, quand la moitié échoue, la moitié des bons créés avec des
     numéros consommés — et personne ne sait où reprendre. */
  const genererSelection = async () => {
    if (selectionMvt.size === 0) return;
    setGeneration(true);
    try {
      /* Un événement et un mouvement ne se documentent pas par la même route :
         l'un porte sa quantité propre, l'autre la somme consolidée. Une
         sélection mixte part donc en deux envois. */
      const evIds = [...selectionMvt].filter((c) => c.startsWith("ev:"))
        .map((c) => Number(c.slice(3)));
      const mvIds = [...selectionMvt].filter((c) => c.startsWith("mv:"))
        .map((c) => Number(c.slice(3)));

      let crees = 0;
      let refuses = 0;
      const erreurs: string[] = [];

      for (const [url, corps] of [
        ["/api/documents/from-events", { event_ids: evIds }],
        ["/api/documents/from-movements", { movement_ids: mvIds }],
      ] as [string, any][]) {
        const ids = Object.values(corps)[0] as number[];
        if (ids.length === 0) continue;
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify(corps),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) { erreurs.push(d?.error || "génération refusée"); continue; }
        crees += Number(d.crees || 0);
        refuses += Number(d.refuses || 0);
      }

      if (erreurs.length && crees === 0) {
        setMessage(erreurs[0]);
        return;
      }
      setMessage(`${crees} document(s) généré(s)`
        + (refuses > 0 ? ` — ${refuses} refusé(s)` : "")
        + (erreurs.length ? ` — ${erreurs.length} envoi(s) refusé(s)` : "") + ".");
      await fetchData();
    } finally {
      setGeneration(false);
    }
  };

  const basculerMvt = (cle: string) => {
    setSelectionMvt((s) => {
      const n = new Set(s);
      if (n.has(cle)) n.delete(cle); else n.add(cle);
      return n;
    });
  };

  const generateDocument = async (movement: any, type?: string) => {
    const finalType = type || getDefaultDocumentType(movement);

    await fetch(`/api/documents/from-movement/${movement.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({
        document_type: finalType,
        created_by: "Administrateur",
      }),
    });

    setMessage(`${finalType} généré avec succès.`);
    fetchData();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="flex justify-between items-center mb-8 print:hidden">
        <div>
          <h1 className="text-4xl font-bold text-black mb-2">
            Documents logistiques
          </h1>

          <p className="text-gray-500">
            Bons de réception, livraison, sortie, transfert, inventaire,
            facture et proforma.
          </p>
        </div>

        <p className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-gray-600">
          Ouvrez un document pour imprimer, exporter ou envoyer seulement celui-ci.
        </p>
      </div>

      {/* ---------- IMPRESSION GROUPÉE ----------
          Sélectionner et imprimer ne modifie rien : ni document, ni numéro,
          ni quantité, ni stock. */}
      <div className="mb-6 rounded-2xl bg-white p-5 shadow print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-black">Impression groupée</h2>
            <p className="text-sm text-gray-500">
              Sélectionnez plusieurs bons et lancez une seule impression — un document par page.
            </p>
          </div>
          <button onClick={imprimerSelection} disabled={!selection.size}
                  className="rounded-xl bg-slate-900 px-5 py-3 font-bold text-white disabled:opacity-40">
            Imprimer la sélection ({selection.size} document{selection.size > 1 ? "s" : ""})
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-bold text-gray-800">
            <input type="checkbox" checked={tousSelectionnes} onChange={toutSelectionner} />
            Tout sélectionner
          </label>
          {([["TOUS", "Tous"], ["RECEPTION", "Réceptions"], ["SORTIE", "Sorties"]] as const).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-sm text-gray-700">
              <input type="radio" name="filtre_doc" checked={filtre === k}
                     onChange={() => setFiltre(k as typeof filtre)} />
              {label}
              <span className="text-gray-400">
                ({k === "TOUS" ? documents.length
                  : documents.filter((d) => familleDocument(d.document_type) === k).length})
              </span>
            </label>
          ))}
          {selection.size > 0 && (
            <button onClick={() => setSelection(new Set())} className="text-sm font-bold text-gray-500">
              Tout décocher
            </button>
          )}
        </div>

        {apercuAuteur && apercuAuteur.documents_concernes > 0 && (
          <div className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
            <p className="font-bold">
              Dernier import Excel{apercuAuteur.import?.fichier ? ` — ${apercuAuteur.import.fichier}` : ""} :
              {" "}{apercuAuteur.total} document(s)
            </p>
            <p className="mt-1">
              {apercuAuteur.receptions.nombre} bon(s) de réception
              {apercuAuteur.receptions.premier
                ? ` (${apercuAuteur.receptions.premier} → ${apercuAuteur.receptions.dernier})` : ""}
              {" · "}{apercuAuteur.sorties.nombre} bon(s) de sortie
              {apercuAuteur.sorties.premier
                ? ` (${apercuAuteur.sorties.premier} → ${apercuAuteur.sorties.dernier})` : ""}
            </p>
            <p className="mt-1">
              À l&apos;impression, <b>{apercuAuteur.documents_concernes}</b> de ces documents afficheront{" "}
              <b>{apercuAuteur.auteur_affiche.nom}</b> — {apercuAuteur.auteur_affiche.fonction},{" "}
              {apercuAuteur.auteur_affiche.email} — au lieu du compte d&apos;import{" "}
              {apercuAuteur.auteur_actuel}.
              {apercuAuteur.documents_non_concernes > 0
                && ` ${apercuAuteur.documents_non_concernes} document(s) portent déjà un autre auteur et ne sont pas touchés.`}
            </p>
            <p className="mt-1 text-xs">
              Substitution d&apos;affichage uniquement : la base n&apos;est pas modifiée.
            </p>
          </div>
        )}
      </div>

      {message && (
        <div className="bg-green-100 text-green-700 p-4 rounded-xl mb-6 font-bold print:hidden">
          {message}
        </div>
      )}

      {/* Deux colonnes fixes forcent un défilement latéral sur téléphone : les
          cases à cocher et le bouton groupé sortent de l'écran. Elles
          s'empilent donc en dessous de 1024 px. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
        <div className="bg-white rounded-2xl shadow p-4 sm:p-6 print:hidden">
          <h2 className="text-xl sm:text-2xl font-bold text-black mb-1">
            {parEvenement ? "Sorties à documenter" : "Mouvements à documenter"}
          </h2>

          {/* D'où viennent ces lignes, dit noir sur blanc. Sans cela, rien ne
              distingue une sortie du dernier import d'une sortie de l'an
              dernier — et c'est ainsi qu'un bon finissait par porter 30 au
              lieu de 10. */}
          <p className="text-sm text-gray-600 mb-3">
            {avecHistorique ? (
              <>
                <b>Historique complet.</b> Les anciennes lignes sont affichées
                à côté de celles du dernier import.
              </>
            ) : (
              <>
                <b>
                  {parEvenement
                    ? "Nouvelles sorties du dernier import"
                    : "Nouveaux mouvements du dernier import"}
                </b>
                {dernierImport?.file_name ? ` — ${dernierImport.file_name}` : ""}.
                Les anciens mouvements ne sont accessibles que dans l&apos;historique.
              </>
            )}
          </p>

          {/* Le compte et le total, visibles sans compter à la main : c'est ce
              qui permet de dire d'un coup d'œil « 21 sorties, 739 unités » —
              et de voir immédiatement si un chiffre a dérivé. */}
          {movements.length > 0 && (
            <p className="mb-3 rounded-xl bg-gray-900 px-3 py-2 text-sm font-bold text-white">
              {movements.length} {parEvenement ? "sortie(s)" : "mouvement(s)"}
              {" · "}
              {movements.reduce((s: number, m: any) => s + Number(m.quantity || 0), 0)} unités
            </p>
          )}

          {parEvenement && (
            <p className="mb-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
              Une fiche par sortie réelle, avec sa date et sa quantité propres.
              Un même mouvement de stock peut en porter plusieurs — trois
              sorties de 7, 7 et 6 le même jour font un mouvement de 20, mais
              trois bons distincts.
            </p>
          )}

          <label className="mb-4 flex items-start gap-3 rounded-xl bg-gray-50 p-3 text-sm">
            <input
              type="checkbox"
              checked={avecHistorique}
              onChange={(e) => setAvecHistorique(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0"
            />
            <span>
              Afficher aussi les anciens mouvements
              <span className="mt-0.5 block text-xs text-gray-500">
                Ils restent dans l&apos;historique et gardent leurs documents,
                mais ne se cumulent jamais avec ceux du dernier import.
              </span>
            </span>
          </label>

          {movements.length === 0 ? (
            <p className="text-gray-500">
              {parEvenement
                ? "Toutes les sorties du dernier import portent leur bon."
                : "Aucun mouvement à documenter."}
              {!avecHistorique && (
                <span className="mt-1 block text-xs">
                  Les anciens mouvements restent accessibles par l&apos;historique
                  ci-dessus.
                </span>
              )}
            </p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSelectionMvt(
                      selectionMvt.size === movements.length
                        ? new Set()
                        : new Set(movements.map((m: any) => m._cle))
                    )
                  }
                  className="min-h-[44px] rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-bold text-gray-800"
                >
                  {selectionMvt.size === movements.length
                    ? "Tout décocher"
                    : `Tout sélectionner (${movements.length})`}
                </button>

                <button
                  type="button"
                  onClick={genererSelection}
                  disabled={selectionMvt.size === 0 || generation}
                  className="min-h-[44px] rounded-xl bg-black px-4 py-2.5 text-sm font-bold text-white disabled:bg-gray-300"
                >
                  {generation
                    ? "Génération…"
                    : `Générer ${selectionMvt.size} document(s)`}
                </button>
              </div>

              <div className="space-y-3">
                {movements.map((movement: any) => (
                  <label
                    key={movement._cle}
                    className={`flex items-start gap-3 rounded-xl border p-3 ${
                      selectionMvt.has(movement._cle)
                        ? "border-black bg-gray-50"
                        : "border-gray-200"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectionMvt.has(movement._cle)}
                      onChange={() => basculerMvt(movement._cle)}
                      className="mt-1 h-5 w-5 shrink-0"
                    />

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <b className="text-black">{movement.product_name}</b>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            sensDe(movement) === "Sortie"
                              ? "bg-red-100 text-red-900"
                              : sensDe(movement) === "Entrée"
                                ? "bg-amber-100 text-amber-900"
                                : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {sensDe(movement)} {Number(movement.quantity)}
                        </span>
                        {!movement.du_dernier_import && (
                          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-bold text-gray-700">
                            ancien
                          </span>
                        )}
                        {/* Une sortie qu'aucun mouvement ne porte : on le dit
                            plutôt que d'inventer un rattachement. */}
                        {movement._kind === "ev" && !movement.movement_id && (
                          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-900">
                            sans mouvement rattaché
                          </span>
                        )}
                      </span>

                      <span className="mt-1 block text-xs text-gray-600">
                        {movement._kind === "ev"
                          ? afficherDate(`${movement.effective_date}T12:00:00Z`)
                          : afficherDate(
                            movement.operation_effective_at || movement.created_at
                          )}
                        {movement.entrepot ? ` · ${movement.entrepot}` : ""}
                        {movement.location_code ? ` · ${movement.location_code}` : ""}
                      </span>

                      {/* La provenance exacte : c'est elle qui permet de
                          retrouver la cellule d'origine quand un chiffre est
                          contesté. */}
                      <span className="mt-0.5 block text-xs text-gray-400">
                        {movement._kind === "ev" ? (
                          <>
                            {movement.import_fichier || "import"} · ligne{" "}
                            {movement.excel_row} · cellule {movement.excel_cell}
                            {movement.movement_id
                              && Number(movement.quantite_mouvement) !== Number(movement.quantity)
                              ? ` · mouvement #${movement.movement_id} consolidé à ${Number(movement.quantite_mouvement)}`
                              : ""}
                          </>
                        ) : (
                          <>
                            import{" "}
                            {movement.import_fichier
                              || (movement.import_id ? `#${movement.import_id}` : "—")}
                          </>
                        )}
                      </span>
                    </span>

                    {movement._kind === "mv" && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          generateDocument(movement);
                        }}
                        className="min-h-[44px] shrink-0 rounded-xl bg-black px-3 py-2.5 text-xs font-bold text-white"
                      >
                        {getDocumentButtonLabel(movement)}
                      </button>
                    )}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow p-6 print:shadow-none">
          <h2 className="text-2xl font-bold text-black mb-5">
            Documents générés
          </h2>

          {documentsFiltres.length === 0 ? (
            <p className="text-gray-500">
              Aucun document généré.
            </p>
          ) : (
            <div className="space-y-4">
              {documentsFiltres.map((doc: any) => (
                <div key={doc.id}
                     className={`border rounded-xl p-4 bg-white ${selection.has(doc.id) ? "ring-2 ring-slate-900" : ""}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <label className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-700 print:hidden">
                        <input type="checkbox" checked={selection.has(doc.id)}
                               onChange={() => basculer(doc.id)}
                               aria-label={`Sélectionner ${doc.document_number}`} />
                        Sélectionner
                      </label>
                      <p className="font-bold text-black">
                        {doc.document_type}
                      </p>

                      <p className="text-sm text-blue-600 font-bold">
                        {doc.document_number}
                      </p>

                      <p className="text-sm text-gray-500 mt-2">
                        Client / Fournisseur : {doc.client_name || "-"}
                      </p>

                      <p className="text-sm text-gray-500">
                        Créé par : {doc.created_by}
                      </p>

                      {/* Date MÉTIER à l'heure de Bamako, avec repli explicite
                          sur la date de création tant qu'aucune n'est posée. */}
                      <p className="text-sm text-gray-500">
                        Date :{" "}
                        {afficherDate(
                          doc.document_datetime || doc.operation_effective_at || doc.created_at,
                          "-"
                        )}
                        {!doc.document_datetime && !doc.operation_effective_at && doc.created_at && (
                          <span className="text-xs text-gray-400"> (date de création)</span>
                        )}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xl font-bold text-green-600">
                        {formatFCFA(doc.total_amount)}
                      </p>

                      <p className="text-sm text-gray-500 mt-2">
                        {doc.status || "Brouillon"}
                      </p>

                      <Link
                        href={`/documents/${doc.id}`}
                        className="inline-block bg-black text-white px-4 py-2 rounded-xl font-bold mt-3 print:hidden"
                      >
                        Voir / Imprimer
                      </Link>
                    </div>
                  </div>

                  {doc.observation && (
                    <div className="mt-4 text-sm text-gray-600 border-t pt-3">
                      {doc.observation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
