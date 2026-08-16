"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatFCFA } from "../lib/format";

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

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  });

  const fetchData = async () => {
    try {
      const docsRes = await fetch("/api/documents", { headers: authHeaders() });
      const docsData = await docsRes.json();
      const docsArray = Array.isArray(docsData) ? docsData : [];
      setDocuments(docsArray);

      const movementsRes = await fetch("/api/stock-movements", {
        headers: authHeaders(),
      });
      const movementsData = await movementsRes.json();
      const movementsArray = Array.isArray(movementsData) ? movementsData : [];

      const filtered = movementsArray.filter((movement: any) => {
        if (movement.status !== "Validé") return false;

        const alreadyGenerated = docsArray.some((doc: any) =>
          doc.observation?.includes(`mouvement stock ID ${movement.id}`)
        );

        return !alreadyGenerated;
      });

      setMovements(filtered);
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
    fetchData();
    chargerApercuAuteur();
  }, []);

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
    if (movement.type === "Sortie") return "Bon de livraison";
    if (movement.type === "Transfert") return "Bon de transfert";
    if (movement.type === "Inventaire") return "Fiche inventaire";
    return "Document stock";
  };

  const getDocumentButtonLabel = (movement: any) => {
    if (movement.type === "Entrée") return "Générer BR";
    if (movement.type === "Sortie") return "Générer BL";
    if (movement.type === "Transfert") return "Générer BT";
    if (movement.type === "Inventaire") return "Générer fiche inventaire";
    return "Générer document";
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

  const getMovementColor = (type: string) => {
    if (type === "Entrée") return "bg-green-100 text-green-700";
    if (type === "Sortie") return "bg-blue-100 text-blue-700";
    if (type === "Transfert") return "bg-purple-100 text-purple-700";
    if (type === "Inventaire") return "bg-yellow-100 text-yellow-700";
    return "bg-gray-100 text-gray-700";
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

      <div className="grid grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl shadow p-6 print:hidden">
          <h2 className="text-2xl font-bold text-black mb-2">
            Mouvements à documenter
          </h2>

          <p className="text-gray-500 mb-5">
            Seuls les mouvements validés sans document apparaissent ici.
          </p>

          {movements.length === 0 ? (
            <p className="text-gray-500">
              Aucun mouvement à documenter.
            </p>
          ) : (
            <div className="space-y-4">
              {movements.map((movement: any) => (
                <div key={movement.id} className="border rounded-xl p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-bold ${getMovementColor(
                          movement.type
                        )}`}
                      >
                        {movement.type}
                      </span>

                      <p className="font-bold text-black mt-3">
                        {movement.product_reference} - {movement.product_name}
                      </p>

                      <p className="text-sm text-gray-500">
                        Quantité : {movement.quantity}
                      </p>

                      <p className="text-sm text-gray-500">
                        Source : {movement.source_warehouse || "-"}
                      </p>

                      <p className="text-sm text-gray-500">
                        Destination : {movement.destination_warehouse || "-"}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => generateDocument(movement)}
                      className="bg-yellow-500 text-black px-4 py-2 rounded-xl font-bold"
                    >
                      {getDocumentButtonLabel(movement)}
                    </button>

                    {movement.type === "Sortie" && (
                      <button
                        onClick={() =>
                          generateDocument(movement, "Bon de sortie")
                        }
                        className="bg-black text-white px-4 py-2 rounded-xl font-bold"
                      >
                        Générer BS
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
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

                      <p className="text-sm text-gray-500">
                        Date :{" "}
                        {doc.created_at
                          ? new Date(doc.created_at).toLocaleString("fr-FR")
                          : "-"}
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
