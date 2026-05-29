"use client";

import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

export default function ScannerPage() {
  const [result, setResult] = useState("");
  const [locations, setLocations] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [matchedLocation, setMatchedLocation] = useState<any>(null);
  const [inventoryValues, setInventoryValues] = useState<any>({});
  const [message, setMessage] = useState("");

  const scannerRef = useRef<any>(null);

  const fetchData = async () => {
    const locationsRes = await fetch("/api/locations");
    const locationsData = await locationsRes.json();
    setLocations(Array.isArray(locationsData) ? locationsData : []);

    const productsRes = await fetch("/api/products");
    const productsData = await productsRes.json();
    setProducts(Array.isArray(productsData) ? productsData : []);
  };

  useEffect(() => {
    fetchData();
  }, []);

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
        setResult(decodedText);
        setMessage("");

        const found = locations.find(
          (location: any) => location.emplacement_code === decodedText
        );

        setMatchedLocation(found || null);
      },
      () => {}
    );

    return () => {
      scanner.clear().catch(() => {});
      scannerRef.current = null;
    };
  }, [locations]);

  const productsInLocation = matchedLocation
    ? products.filter((product: any) => {
        return (
          product.location_code === matchedLocation.emplacement_code ||
          product.emplacement_code === matchedLocation.emplacement_code
        );
      })
    : [];

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
                    {matchedLocation.warehouse_code}
                  </p>

                  <p>
                    <strong>Zone :</strong> {matchedLocation.zone}
                  </p>

                  <p>
                    <strong>Rayon :</strong> {matchedLocation.rayon}
                  </p>

                  <p>
                    <strong>Étagère :</strong> {matchedLocation.etagere}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}