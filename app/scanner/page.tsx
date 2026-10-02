"use client";

import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { QRCodeCanvas } from "qrcode.react";
import { authFetch } from "../lib/api";

/* Un badge de pointage v2 n'encode qu'un jeton aléatoire (base64url, ~32
   caractères) : ni emplacement, ni produit, ni employé lisible. */
const JETON_BADGE_V2 = /^[A-Za-z0-9_-]{24,64}$/;

export default function ScannerPage() {
  const [result, setResult] = useState("");
  const [locations, setLocations] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [matchedLocation, setMatchedLocation] = useState<any>(null);
  const [scanDetails, setScanDetails] = useState<any>(null);
  const [inventoryValues, setInventoryValues] = useState<any>({});
  const [message, setMessage] = useState("");
  const [badgePointage, setBadgePointage] = useState("");

  const scannerRef = useRef<any>(null);

  const headers = () => ({
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  });

  const getLocationUrl = (code: string) => {
    if (typeof window === "undefined") return code;
    return `${window.location.origin}/scanner?location=${encodeURIComponent(code)}`;
  };

  const normalizeScanValue = (value: string) => {
    try {
      const url = new URL(value);
      return url.searchParams.get("location") || value.trim();
    } catch {
      return value.trim();
    }
  };

  const resolveScan = async (code: string) => {
    const response = await fetch(
      `/api/scan/resolve/${encodeURIComponent(code)}`,
      { headers: headers() }
    );

    return response.json();
  };

  const selectLocationByCode = async (code: string, sourceValue = code) => {
    const cleanCode = normalizeScanValue(code);
    setResult(sourceValue);
    setMessage("");
    setScanDetails(null);
    setBadgePointage("");

    const found = locations.find(
      (location: any) => location.emplacement_code === cleanCode
    );

    setMatchedLocation(found || null);

    const data = await resolveScan(cleanCode).catch(() => null);

    if ((!data || data.error) && JETON_BADGE_V2.test(cleanCode)) {
      setBadgePointage(cleanCode);
    }

    if (data && !data.error) {
      setScanDetails(data);

      if (data.type === "location") {
        setMatchedLocation(data.location);
      }
    }
  };

  const fetchData = async () => {
    const locationsRes = await fetch("/api/locations", { headers: headers() });
    const locationsData = await locationsRes.json();
    setLocations(Array.isArray(locationsData) ? locationsData : []);

    const productsRes = await fetch("/api/products", { headers: headers() });
    const productsData = await productsRes.json();
    setProducts(Array.isArray(productsData) ? productsData : []);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (locations.length === 0) return;

    const params = new URLSearchParams(window.location.search);
    const locationCode = params.get("location");

    if (locationCode) {
      selectLocationByCode(locationCode, getLocationUrl(locationCode));
    }
  }, [locations]);

  useEffect(() => {
    if (scannerRef.current) return;

    const scanner = new Html5QrcodeScanner(
      "reader",
      {
        fps: 10,
        qrbox: 250,
      },
      false
    );

    scannerRef.current = scanner;

    scanner.render(
      (decodedText) => {
        selectLocationByCode(decodedText, decodedText);
      },
      () => {}
    );

    return () => {
      scanner.clear().catch(() => {});
      scannerRef.current = null;
    };
  }, [locations]);

  const productsInLocation = matchedLocation
    ? (scanDetails?.type === "location" && Array.isArray(scanDetails.products)
        ? scanDetails.products
        : products.filter((product: any) => {
        return (
          product.location_id === matchedLocation.id ||
          product.id === matchedLocation.product_id ||
          product.location_code === matchedLocation.emplacement_code ||
          product.emplacement_code === matchedLocation.emplacement_code
        );
      }))
    : [];

  /* Pointage par le moteur v2 : badge à jeton aléatoire, borné à la société
     active, droit `pointage.qr|scan`, périmètre d'opérateur, anti-rebond et
     ordre des étapes appliqués par le serveur. L'ancien scan par code imprimé
     (`/attendance/scan`, prévisible) n'existe plus. */
  const scanAttendance = async () => {
    if (!badgePointage) return;
    const response = await authFetch("/attendance-v2/qr/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qr_token: badgePointage }),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(
      response.ok
        ? `${data.employe?.nom || "Employé"} : ${data.action_libelle || data.action || "pointage"} ${data.repetition ? "déjà enregistré" : "enregistré"}`
        : data.error || "Pointage refusé"
    );
    if (response.ok) setBadgePointage("");
  };

  const getProductsForLocation = (location: any) =>
    products.filter((product: any) => {
      return (
        product.location_id === location.id ||
        product.id === location.product_id ||
        product.location_code === location.emplacement_code ||
        product.emplacement_code === location.emplacement_code
      );
    });

  const getProductLabel = (location: any) => {
    if (location.product_reference) {
      return `${location.product_reference} - ${location.product_name || ""}`;
    }

    const locationProducts = getProductsForLocation(location);

    if (locationProducts.length === 0) return "Aucun produit";

    return locationProducts
      .map((product: any) => `${product.reference} - ${product.name}`)
      .join(", ");
  };

  const printLocation = (location: any) => {
    const printWindow = window.open("", "_blank", "width=420,height=620");
    if (!printWindow) return;

    const qrCanvas = document.getElementById(
      `location-qr-${location.id}`
    ) as HTMLCanvasElement | null;
    const qrImage = qrCanvas?.toDataURL("image/png") || location.qr_code || "";

    printWindow.document.write(`
      <html>
        <head>
          <title>QR ${location.emplacement_code}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            .label { border: 2px solid #111827; border-radius: 12px; padding: 20px; width: 320px; text-align: center; }
            img { width: 220px; height: 220px; margin: 12px auto; display: block; }
            h1 { font-size: 24px; margin: 0 0 8px; }
            p { font-size: 14px; margin: 6px 0; }
            .product { font-weight: 700; font-size: 16px; }
          </style>
        </head>
        <body>
          <div class="label">
            <h1>${location.emplacement_code}</h1>
            <img src="${qrImage}" />
            <p>Entrepôt : ${location.warehouse_name || location.warehouse_code || "-"}</p>
            <p class="product">Produit : ${getProductLabel(location)}</p>
            <p>Rayon ${location.rayon_code || location.zone || "-"} | Case ${
              location.case_code || location.rayon || "-"
            } | Level ${location.level_code || location.etagere || "-"}</p>
            <p>Bin : ${location.bin_code || "-"}</p>
          </div>
          <script>window.onload = () => { window.print(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleInventoryChange = (productId: number, value: string) => {
    setInventoryValues({
      ...inventoryValues,
      [productId]: value,
    });
  };

  const submitInventory = async (product: any) => {
    const realStock = inventoryValues[product.id];

    if (!realStock && realStock !== 0) {
      alert("Entre le stock réel compté.");
      return;
    }

    const savedUser = localStorage.getItem("user");
    const user = savedUser ? JSON.parse(savedUser) : null;

    await fetch("/api/stock-movements", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "Inventaire",
        product_reference: product.reference,
        product_name: product.name,
        quantity: Number(realStock),
        source_warehouse: product.warehouse,
        destination_warehouse: "",
        reason: `Inventaire mobile | Emplacement : ${
          product.location_code || product.emplacement_code || ""
        }`,
        user_name: user?.fullname || "Magasinier mobile",
        user_role: user?.role || "magasinier",
      }),
    });

    setMessage(
      `Inventaire envoyé pour validation : ${product.reference} - ${product.name}`
    );

    setInventoryValues({
      ...inventoryValues,
      [product.id]: "",
    });

    fetchData();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold text-black mb-2">
        Scanner QR Code
      </h1>

      <p className="text-gray-500 mb-8">
        Scanner un emplacement, voir les produits et faire un inventaire mobile.
      </p>

      {message && (
        <div className="bg-green-100 text-green-700 p-4 rounded-xl mb-6 font-bold">
          {message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-2xl font-bold text-black mb-5">
            Caméra scanner
          </h2>

          <div id="reader" className="w-full"></div>
        </div>

        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-2xl font-bold text-black mb-5">
            Résultat du scan
          </h2>

          {!result ? (
            <p className="text-gray-500">
              Aucun QR code scanné pour le moment.
            </p>
          ) : (
            <div>
              <p className="text-gray-500 mb-2">
                Code détecté :
              </p>

              <p className="text-xl font-bold text-blue-600 mb-6">
                {result}
              </p>

              {matchedLocation ? (
                <div className="space-y-3 mb-8">
                  <p>
                    <strong>Entrepôt :</strong>{" "}
                    {matchedLocation.warehouse_name ||
                      matchedLocation.warehouse_code}
                  </p>

                  <p>
                    <strong>Produit :</strong>{" "}
                    {matchedLocation.product_reference
                      ? `${matchedLocation.product_reference} - ${
                          matchedLocation.product_name || ""
                        }`
                      : "Aucun produit enregistré"}
                  </p>

                  <p>
                    <strong>Rayon :</strong>{" "}
                    {matchedLocation.rayon_code || matchedLocation.zone}
                  </p>

                  <p>
                    <strong>Case :</strong>{" "}
                    {matchedLocation.case_code || matchedLocation.rayon}
                  </p>

                  <p>
                    <strong>Level :</strong>{" "}
                    {matchedLocation.level_code || matchedLocation.etagere}
                  </p>

                  <p>
                    <strong>Bin :</strong> {matchedLocation.bin_code || "-"}
                  </p>

                  <p>
                    <strong>Statut :</strong> {matchedLocation.status}
                  </p>
                </div>
              ) : (
                <p className="text-red-500 font-bold">
                  Aucun emplacement trouvé pour ce QR code.
                </p>
              )}

              {matchedLocation && (
                <div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                    <a
                      href={`/produits?location=${encodeURIComponent(
                        matchedLocation.emplacement_code
                      )}`}
                      className="bg-black text-white text-center font-bold rounded-xl py-3"
                    >
                      Ajouter produit
                    </a>
                    {["Entrée", "Sortie", "Transfert", "Inventaire"].map(
                      (type) => (
                        <a
                          key={type}
                          href={`/stocks?type=${encodeURIComponent(
                            type
                          )}&location=${encodeURIComponent(
                            matchedLocation.emplacement_code
                          )}`}
                          className="bg-yellow-500 text-black text-center font-bold rounded-xl py-3"
                        >
                          {type}
                        </a>
                      )
                    )}
                    <a
                      href={`/stocks?location=${encodeURIComponent(
                        matchedLocation.emplacement_code
                      )}`}
                      className="bg-blue-600 text-white text-center font-bold rounded-xl py-3"
                    >
                      Voir mouvements
                    </a>
                  </div>

                  <h3 className="text-xl font-bold text-black mb-4">
                    Inventaire des produits dans cet emplacement
                  </h3>

                  {productsInLocation.length === 0 ? (
                    <p className="text-gray-500">
                      Aucun produit enregistré dans cet emplacement.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {productsInLocation.map((product: any) => (
                        <div
                          key={product.id}
                          className="border rounded-xl p-4"
                        >
                          <div className="flex items-center gap-4 mb-4">
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="w-16 h-16 object-cover rounded-xl border"
                              />
                            ) : (
                              <div className="w-16 h-16 bg-gray-200 rounded-xl flex items-center justify-center text-xs text-gray-500">
                                Image
                              </div>
                            )}

                            <div>
                              <p className="font-bold text-black">
                                {product.reference} - {product.name}
                              </p>

                              <p className="text-sm text-gray-500">
                                Stock système : {product.stock}{" "}
                                {product.unit || ""}
                              </p>

                              <p className="text-sm text-gray-500">
                                Emplacement :{" "}
                                {product.location_code ||
                                  product.emplacement_code ||
                                  "-"}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <input
                              type="number"
                              placeholder="Stock réel compté"
                              value={inventoryValues[product.id] || ""}
                              onChange={(e) =>
                                handleInventoryChange(
                                  product.id,
                                  e.target.value
                                )
                              }
                              className="border p-3 rounded-xl text-black"
                            />

                            <button
                              onClick={() => submitInventory(product)}
                              className="bg-yellow-500 text-black font-bold rounded-xl"
                            >
                              Envoyer inventaire
                            </button>
                          </div>

                          <p className="text-xs text-gray-500 mt-3">
                            Cette demande ira en validation admin avant de
                            modifier le stock.
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {scanDetails?.type === "product" && (
                <div className="space-y-4">
                  <div className="border rounded-xl p-4">
                    <h3 className="text-xl font-bold text-black mb-3">
                      Produit scanné
                    </h3>

                    <p>
                      <strong>Référence :</strong>{" "}
                      {scanDetails.product.reference}
                    </p>
                    <p>
                      <strong>Nom :</strong> {scanDetails.product.name}
                    </p>
                    <p>
                      <strong>Catégorie :</strong>{" "}
                      {scanDetails.product.category || "-"}
                    </p>
                    <p>
                      <strong>Stock total :</strong>{" "}
                      {scanDetails.product.stock}{" "}
                      {scanDetails.product.unit || ""}
                    </p>
                    <p>
                      <strong>Emplacement :</strong>{" "}
                      {scanDetails.product.location_code ||
                        scanDetails.product.emplacement_code ||
                        "-"}
                    </p>
                    <p>
                      <strong>Rayon / Case / Level / Bin :</strong>{" "}
                      {scanDetails.product.rayon_code || "-"} /{" "}
                      {scanDetails.product.case_code || "-"} /{" "}
                      {scanDetails.product.level_code || "-"} /{" "}
                      {scanDetails.product.bin_code || "-"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {["Entrée", "Sortie", "Transfert", "Inventaire"].map(
                      (type) => (
                        <a
                          key={type}
                          href={`/stocks?type=${encodeURIComponent(
                            type
                          )}&product=${encodeURIComponent(
                            scanDetails.product.reference
                          )}`}
                          className="bg-yellow-500 text-black text-center font-bold rounded-xl py-3"
                        >
                          {type}
                        </a>
                      )
                    )}
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-black mb-4">
                      Historique produit
                    </h3>
                    {(scanDetails.movements || []).length === 0 ? (
                      <p className="text-gray-500">Aucun mouvement.</p>
                    ) : (
                      <div className="space-y-2">
                        {scanDetails.movements.map((movement: any) => (
                          <div key={movement.id} className="border rounded-xl p-3">
                            <p className="font-bold">
                              {movement.type} | {movement.quantity} |{" "}
                              {movement.status}
                            </p>
                            <p className="text-sm text-gray-500">
                              {movement.reason || "-"}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {badgePointage && !scanDetails && (
                <div className="space-y-3 rounded-xl border p-4">
                  <h3 className="text-xl font-bold text-black">Badge de pointage</h3>
                  <p className="text-sm text-gray-600">
                    Le serveur identifiera l&apos;employé et l&apos;étape (arrivée, pause, retour, fin).
                  </p>
                  <button
                    onClick={scanAttendance}
                    className="w-full rounded-xl bg-green-600 py-3 font-bold text-white"
                  >
                    Pointer ce badge
                  </button>
                </div>
              )}

              {scanDetails?.type === "employee" && (
                <div className="space-y-4">
                  <div className="border rounded-xl p-4">
                    <h3 className="text-xl font-bold text-black mb-3">
                      Employé scanné
                    </h3>
                    <p>
                      <strong>Nom :</strong> {scanDetails.employee.fullname}
                    </p>
                    <p>
                      <strong>Rôle :</strong> {scanDetails.employee.role}
                    </p>
                    <p>
                      <strong>Badge :</strong>{" "}
                      {scanDetails.employee.badge_code || "-"}
                    </p>
                  </div>

                  <p className="rounded-xl bg-amber-100 p-3 text-sm font-bold text-amber-900">
                    {scanDetails.avertissement ||
                      "Ancien badge imprimé : il ne permet plus de pointer."}{" "}
                    <a href="/pointage-qr" className="underline">Ouvrir le pointage par badge</a>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-6 mt-8">
        <h2 className="text-2xl font-bold text-black mb-5">
          QR codes des emplacements à imprimer
        </h2>

        {locations.length === 0 ? (
          <p className="text-gray-500">Aucun emplacement enregistré.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {locations.map((location: any) => (
              <div key={location.id} className="border rounded-xl p-4">
                <div className="flex items-start gap-4">
                  <QRCodeCanvas
                    id={`location-qr-${location.id}`}
                    value={getLocationUrl(location.emplacement_code)}
                    size={112}
                    level="M"
                  />

                  <div className="min-w-0">
                    <p className="font-bold text-blue-600 break-words">
                      {location.emplacement_code}
                    </p>

                    <p className="text-sm text-gray-700 mt-1">
                      {getProductLabel(location)}
                    </p>

                    <p className="text-xs text-gray-500 mt-1">
                      {location.warehouse_name ||
                        location.warehouse_code ||
                        "-"}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => printLocation(location)}
                  className="mt-4 w-full bg-yellow-500 text-black font-bold rounded-xl py-2"
                >
                  Imprimer
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
