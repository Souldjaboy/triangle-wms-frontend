"use client";

import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useMemo, useState } from "react";

const paymentMethods = [
  "Espèces",
  "Carte bancaire",
  "Orange Money",
  "Moov Money",
  "Wave",
  "Virement",
  "Paiement mixte",
  "Crédit client",
];

export default function PosPage() {
  const [mode, setMode] = useState<"vente" | "info">("vente");
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Espèces");
  const [paymentStatus, setPaymentStatus] = useState("payé");
  const [discount, setDiscount] = useState("0");
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const canEditPrice = ["admin", "super_admin"].includes(
    String(currentUser?.role || "").toLowerCase()
  ) || currentUser?.is_super_admin === true;

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  });

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) setCurrentUser(JSON.parse(savedUser));
    searchProducts("");
  }, []);

  const searchProducts = async (value: string) => {
    const response = await fetch(
      `/api/pos/products/search?q=${encodeURIComponent(value)}`,
      { headers: authHeaders() }
    );
    const data = await response.json().catch(() => []);
    setProducts(Array.isArray(data) ? data : []);
  };

  const addToCart = (product: any) => {
    if (mode === "info") {
      setSelectedProduct(product);
      return;
    }

    setCart((current) => {
      const existing = current.find((item) => item.product_id === product.id);
      if (existing) {
        return current.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [
        ...current,
        {
          product_id: product.id,
          reference: product.reference,
          name: product.name,
          barcode: product.barcode,
          quantity: 1,
          unit_price: Number(product.sale_price || 0),
          discount_amount: 0,
          stock: Number(product.stock || 0),
          location: product.location_code || product.emplacement_code || "",
        },
      ];
    });
  };

  const updateItem = (productId: number, key: string, value: string) => {
    setCart((current) =>
      current.map((item) =>
        item.product_id === productId
          ? { ...item, [key]: key === "quantity" ? Number(value || 0) : Number(value || 0) }
          : item
      )
    );
  };

  const totals = useMemo(() => {
    const subtotal = cart.reduce(
      (sum, item) =>
        sum + Number(item.quantity || 0) * Number(item.unit_price || 0) - Number(item.discount_amount || 0),
      0
    );
    const discountValue = Number(discount || 0);
    return {
      subtotal,
      discount: discountValue,
      tax: taxEnabled ? subtotal * 0.18 : 0,
      total: Math.max(subtotal - discountValue + (taxEnabled ? subtotal * 0.18 : 0), 0),
    };
  }, [cart, discount, taxEnabled]);

  const validateSale = async () => {
    setMessage("");

    const response = await fetch("/api/pos/sales", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        items: cart,
        discount_amount: Number(discount || 0),
        tax_enabled: taxEnabled,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(data.error || "Erreur vente POS.");
      return;
    }

    setLastReceipt(data.receipt);
    setCart([]);
    setMessage("Vente validée. Reçu généré.");
    searchProducts(query);
  };

  const printReceipt = () => window.print();

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 text-black">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 print:hidden">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">POS / Caisse</h1>
          <p className="text-gray-500">Vente, scan produit, panier et reçu.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["vente", "info"].map((item) => (
            <button
              key={item}
              onClick={() => setMode(item as any)}
              className={`px-5 py-3 rounded-xl font-bold ${
                mode === item ? "bg-yellow-500" : "bg-white"
              }`}
            >
              {item === "vente" ? "Vente" : "Voir information produit"}
            </button>
          ))}
          <a href="/pos/ventes" className="bg-black text-white px-5 py-3 rounded-xl font-bold">
            Historique
          </a>
        </div>
      </div>

      {message && <div className="bg-yellow-100 p-4 rounded-xl mb-5 font-bold print:hidden">{message}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6 print:hidden">
          <div className="bg-white rounded-2xl shadow p-5">
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                searchProducts(event.target.value);
              }}
              placeholder="Scanner ou chercher produit, référence, SKU, code-barres..."
              className="w-full border p-4 rounded-xl text-lg"
              autoFocus
            />
          </div>

          {selectedProduct && mode === "info" && (
            <div className="bg-white rounded-2xl shadow p-5">
              <h2 className="text-2xl font-bold mb-3">{selectedProduct.name}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <p><strong>Référence :</strong> {selectedProduct.reference}</p>
                <p><strong>Prix :</strong> {Number(selectedProduct.sale_price || 0).toLocaleString()} FCFA</p>
                <p><strong>Stock :</strong> {selectedProduct.stock}</p>
                <p><strong>Emplacement :</strong> {selectedProduct.location_code || selectedProduct.emplacement_code || "-"}</p>
                <p><strong>Lot :</strong> {selectedProduct.lot_number || "-"}</p>
                <p><strong>Expiration :</strong> {selectedProduct.expiration_date || "-"}</p>
              </div>
              <div className="mt-4">
                <QRCodeCanvas value={selectedProduct.reference || String(selectedProduct.id)} size={120} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {products.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className="bg-white rounded-2xl shadow p-4 text-left"
              >
                <p className="font-bold text-lg">{product.name}</p>
                <p className="text-sm text-gray-500">{product.reference}</p>
                <p className="text-yellow-600 font-bold mt-2">
                  {Number(product.sale_price || 0).toLocaleString()} FCFA
                </p>
                <p className="text-sm">Stock : {product.stock}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="text-2xl font-bold mb-4">Panier</h2>
          {cart.length === 0 ? (
            <p className="text-gray-500">Aucun produit.</p>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.product_id} className="border rounded-xl p-3">
                  <p className="font-bold">{item.reference} - {item.name}</p>
                  <p className="text-xs text-gray-500">Stock : {item.stock} | {item.location || "Aucun emplacement"}</p>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(item.product_id, "quantity", e.target.value)} className="border p-2 rounded-lg" />
                    <input type="number" value={item.unit_price} disabled={!canEditPrice} onChange={(e) => updateItem(item.product_id, "unit_price", e.target.value)} className="border p-2 rounded-lg disabled:bg-gray-100" />
                    <input type="number" value={item.discount_amount} disabled={!canEditPrice} onChange={(e) => updateItem(item.product_id, "discount_amount", e.target.value)} className="border p-2 rounded-lg disabled:bg-gray-100" />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="border-t mt-5 pt-5 space-y-3">
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="border p-3 rounded-xl w-full">
              {paymentMethods.map((method) => <option key={method}>{method}</option>)}
            </select>
            <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className="border p-3 rounded-xl w-full">
              <option value="payé">Payé</option>
              <option value="en attente">En attente</option>
              <option value="échoué">Échoué</option>
              <option value="annulé">Annulé</option>
            </select>
            <input type="number" value={discount} disabled={!canEditPrice} onChange={(e) => setDiscount(e.target.value)} placeholder="Remise globale" className="border p-3 rounded-xl w-full disabled:bg-gray-100" />
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={taxEnabled} onChange={(e) => setTaxEnabled(e.target.checked)} />
              TVA activée
            </label>
            <div className="text-lg space-y-1">
              <p>Sous-total : <strong>{totals.subtotal.toLocaleString()} FCFA</strong></p>
              <p>Remise : <strong>{totals.discount.toLocaleString()} FCFA</strong></p>
              <p>TVA : <strong>{totals.tax.toLocaleString()} FCFA</strong></p>
              <p className="text-2xl">Total : <strong>{totals.total.toLocaleString()} FCFA</strong></p>
            </div>
            <button disabled={cart.length === 0} onClick={validateSale} className="w-full bg-yellow-500 text-black font-bold py-4 rounded-xl disabled:opacity-50">
              Valider vente
            </button>
            {lastReceipt && (
              <button onClick={printReceipt} className="w-full bg-black text-white font-bold py-4 rounded-xl">
                Imprimer reçu {lastReceipt.receipt_number}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
