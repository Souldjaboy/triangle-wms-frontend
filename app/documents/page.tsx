"use client";

import { useEffect, useState } from "react";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [message, setMessage] = useState("");

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

  useEffect(() => {
    fetchData();
  }, []);

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

  const printDocument = () => {
    window.print();
  };

  const sendByEmail = () => {
    setMessage("Envoi email préparé. Configurez SMTP côté serveur pour l’envoi automatique.");
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

        <button
          onClick={printDocument}
          className="bg-black text-white font-bold px-6 py-3 rounded-xl"
        >
          Imprimer / PDF
        </button>

        <button
          onClick={sendByEmail}
          className="bg-yellow-500 text-black font-bold px-6 py-3 rounded-xl"
        >
          Envoyer par email
        </button>
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

          {documents.length === 0 ? (
            <p className="text-gray-500">
              Aucun document généré.
            </p>
          ) : (
            <div className="space-y-4">
              {documents.map((doc: any) => (
                <div key={doc.id} className="border rounded-xl p-4 bg-white">
                  <div className="flex justify-between items-start">
                    <div>
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
                        {doc.total_amount || 0} FCFA
                      </p>

                      <p className="text-sm text-gray-500 mt-2">
                        {doc.status || "Brouillon"}
                      </p>

                      <button
                        onClick={printDocument}
                        className="bg-black text-white px-4 py-2 rounded-xl font-bold mt-3 print:hidden"
                      >
                        Voir / Imprimer
                      </button>
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
