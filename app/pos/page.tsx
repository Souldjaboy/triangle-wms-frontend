"use client";

import { Html5QrcodeScanner } from "html5-qrcode";
import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useMemo, useRef, useState } from "react";

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
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [lastReceipt, setLastReceipt] = useState<any>(null);
  const [lastSale, setLastSale] = useState<any>(null);
  const [lastItems, setLastItems] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [scannerMode, setScannerMode] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const scannerRef = useRef<any>(null);

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
    loadSettings();
    loadCompanySettings();
    const params = new URLSearchParams(window.location.search);
    const scanCode = params.get("scan");
    searchProducts(scanCode || "").then((loaded) => {
      if (!scanCode) return;
      const exact = loaded.find((product: any) =>
        [product.reference, product.barcode, product.sku, product.name]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase() === scanCode.toLowerCase())
      );
      if (exact) addToCart(exact);
    });
  }, []);

  useEffect(() => {
    if (!scannerMode) {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
      return;
    }

    if (scannerRef.current) return;

    const scanner = new Html5QrcodeScanner(
      "pos-reader",
      { fps: 10, qrbox: 250 },
      false
    );
    scannerRef.current = scanner;
    scanner.render(
      (decodedText) => {
        handleScannedCode(decodedText);
      },
      () => {}
    );

    return () => {
      scanner.clear().catch(() => {});
      scannerRef.current = null;
    };
  }, [scannerMode, mode, products]);

  const loadSettings = async () => {
    const response = await fetch("/api/pos/settings", { headers: authHeaders() });
    const data = await response.json().catch(() => null);
    setSettings(data);
  };

  const loadCompanySettings = async () => {
    const response = await fetch("/api/company-settings");
    const data = await response.json().catch(() => null);
    setCompanySettings(data);
  };

  const normalizeScanValue = (value: string) => {
    const raw = String(value || "").trim();
    try {
      const url = new URL(raw);
      const productMatch = url.pathname.match(/\/scan\/product\/([^/]+)/);
      return decodeURIComponent(
        url.searchParams.get("ref") ||
          url.searchParams.get("product") ||
          (productMatch ? productMatch[1] : raw)
      );
    } catch {
      return raw;
    }
  };

  const getProductPrice = (product: any) =>
    Number(product.effective_sale_price || product.sale_price || product.pharmacy_price || product.wholesale_price || 0);

  const searchProducts = async (value: string) => {
    const response = await fetch(
      `/api/pos/products/search?q=${encodeURIComponent(value)}`,
      { headers: authHeaders() }
    );
    const data = await response.json().catch(() => []);
    const rows = Array.isArray(data) ? data : [];
    setProducts(rows);
    return rows;
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
          unit_price: getProductPrice(product),
          discount_amount: 0,
          tax_rate: Number(product.tax_rate || 0),
          stock: Number(product.stock || 0),
          location: product.location_code || product.emplacement_code || "",
        },
      ];
    });
  };

  const handleScanSubmit = async (event: any) => {
    event.preventDefault();
    await handleScannedCode(query);
  };

  const handleScannedCode = async (rawCode: string) => {
    const cleanCode = normalizeScanValue(rawCode);
    const value = cleanCode.toLowerCase();
    const rows = value ? await searchProducts(cleanCode) : products;
    const exact = rows.find((product) => {
      return [
        product.reference,
        product.barcode,
        product.sku,
        product.qr_code,
        product.name,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase() === value);
    });

    if (exact) {
      addToCart(exact);
      setQuery("");
      searchProducts("");
      setMessage(
        mode === "info"
          ? `Produit trouvé : ${exact.reference}`
          : `Produit ajouté au panier : ${exact.reference}`
      );
    } else {
      setQuery(cleanCode);
      setMessage("Produit introuvable pour ce scan.");
      searchProducts(cleanCode);
    }
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
    const subtotalBeforeDiscount = cart.reduce(
      (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
      0
    );
    const itemDiscount = cart.reduce(
      (sum, item) => sum + Number(item.discount_amount || 0),
      0
    );
    const subtotal = Math.max(subtotalBeforeDiscount - itemDiscount, 0);
    const discountValue = Number(discount || 0);
    const tax = taxEnabled
      ? cart.reduce((sum, item) => {
          const lineBase = Math.max(
            Number(item.quantity || 0) * Number(item.unit_price || 0) -
              Number(item.discount_amount || 0),
            0
          );
          const rate = Number(item.tax_rate || settings?.default_tax_rate || 18);
          return sum + (lineBase * rate) / 100;
        }, 0)
      : 0;
    return {
      subtotalBeforeDiscount,
      itemDiscount,
      subtotal,
      discount: discountValue,
      tax,
      total: Math.max(subtotal - discountValue + tax, 0),
    };
  }, [cart, discount, taxEnabled, settings]);

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
    setLastSale(data.sale);
    setLastItems(data.items || []);
    if (data.company_settings) setCompanySettings(data.company_settings);
    setCart([]);
    setMessage("Vente validée. Reçu généré.");
    searchProducts(query);
  };

  const printReceipt = () => {
    if (!lastReceipt || !lastSale) return;

    const receiptWindow = window.open("", "_blank", "width=420,height=720");
    if (!receiptWindow) return;

    receiptWindow.document.write(`
      <html>
        <head>
          <title>${lastReceipt.receipt_number}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111; margin: 0; padding: 12px; }
            .receipt { max-width: 300px; margin: 0 auto; }
            h1 { font-size: 18px; text-align: center; margin: 0 0 8px; }
            p { margin: 4px 0; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
            th, td { border-bottom: 1px dashed #999; padding: 5px 0; text-align: left; }
            .right { text-align: right; }
            .total { font-size: 16px; font-weight: 700; text-align: right; margin-top: 10px; }
            @page { size: 80mm auto; margin: 4mm; }
          </style>
        </head>
        <body>
          <div class="receipt">
            ${companySettings?.logo_url ? `<p style="text-align:center"><img src="${companySettings.logo_url}" style="max-width:80px;max-height:60px;object-fit:contain" /></p>` : ""}
            <h1>${companySettings?.company_name || "TRIANGLE WMS PRO"}</h1>
            ${companySettings?.address ? `<p>${companySettings.address}</p>` : ""}
            ${companySettings?.phone ? `<p>Tél : ${companySettings.phone}</p>` : ""}
            ${companySettings?.email ? `<p>Email : ${companySettings.email}</p>` : ""}
            <p>Reçu : ${lastReceipt.receipt_number}</p>
            <p>Vente : ${lastSale.sale_number}</p>
            <p>Date : ${new Date(lastSale.created_at).toLocaleString("fr-FR")}</p>
            <p>Caissier : ${lastSale.created_by_name || "-"}</p>
            <p>Client : ${lastSale.customer_name || "-"}</p>
            <table>
              <thead><tr><th>Produit</th><th>Qté</th><th class="right">Total</th></tr></thead>
              <tbody>
                ${lastItems
                  .map(
                    (item) => `<tr><td>${item.product_name}</td><td>${item.quantity}</td><td class="right">${Number(item.total_price || 0).toLocaleString()} FCFA</td></tr>`
                  )
                  .join("")}
              </tbody>
            </table>
            <p class="right">Remise : ${Number(lastSale.discount_amount || 0).toLocaleString()} FCFA</p>
            <p class="right">TVA : ${Number(lastSale.tax_amount || 0).toLocaleString()} FCFA</p>
            <p class="total">Total : ${Number(lastSale.total_amount || 0).toLocaleString()} FCFA</p>
            <p>Paiement : ${lastSale.payment_method} (${lastSale.payment_status})</p>
          </div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    receiptWindow.document.close();
  };

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
          <a href="/pos/produits" className="bg-white text-black px-5 py-3 rounded-xl font-bold">
            Étiquettes
          </a>
          <a href="/pos/alertes" className="bg-white text-black px-5 py-3 rounded-xl font-bold">
            Alertes
          </a>
          <a href="/pos/parametres" className="bg-white text-black px-5 py-3 rounded-xl font-bold">
            Paramètres POS
          </a>
        </div>
      </div>

      {message && <div className="bg-yellow-100 p-4 rounded-xl mb-5 font-bold print:hidden">{message}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6 print:hidden">
          <form onSubmit={handleScanSubmit} className="bg-white rounded-2xl shadow p-5">
            <div className="flex flex-col md:flex-row gap-3 mb-3">
              <button
                type="button"
                onClick={() => setScannerMode(!scannerMode)}
                className={`px-5 py-3 rounded-xl font-bold ${scannerMode ? "bg-yellow-500" : "bg-black text-white"}`}
              >
                Scanner produit
              </button>
              <span className="text-sm text-gray-500 self-center">
                Scanner USB/téléphone : validez avec Entrée pour ajouter automatiquement.
              </span>
            </div>
            {scannerMode && (
              <div className="mb-4 rounded-xl border p-3">
                <div id="pos-reader" />
              </div>
            )}
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
          </form>

          {selectedProduct && mode === "info" && (
            <div className="bg-white rounded-2xl shadow p-5">
              <h2 className="text-2xl font-bold mb-3">{selectedProduct.name}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <p><strong>Référence :</strong> {selectedProduct.reference}</p>
                <p><strong>Prix :</strong> {getProductPrice(selectedProduct).toLocaleString()} FCFA</p>
                <p><strong>Stock :</strong> {selectedProduct.stock}</p>
                <p><strong>Emplacement :</strong> {selectedProduct.location_code || selectedProduct.emplacement_code || "-"}</p>
                <p><strong>Lot :</strong> {selectedProduct.lot_number || "-"}</p>
                <p><strong>Expiration :</strong> {selectedProduct.expiration_date || "-"}</p>
              </div>
              <div className="mt-4">
                <QRCodeCanvas value={selectedProduct.qr_url || selectedProduct.reference || String(selectedProduct.id)} size={120} />
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
                  {getProductPrice(product).toLocaleString()} FCFA
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
                  <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
                    <label className="text-xs font-bold text-gray-600">
                      Quantité
                      <input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(item.product_id, "quantity", e.target.value)} className="mt-1 w-full border p-2 rounded-lg text-black" />
                    </label>
                    <label className="text-xs font-bold text-gray-600">
                      Prix unitaire
                      <input type="number" value={item.unit_price} disabled={!canEditPrice} onChange={(e) => updateItem(item.product_id, "unit_price", e.target.value)} className="mt-1 w-full border p-2 rounded-lg text-black disabled:bg-gray-100" />
                    </label>
                    <label className="text-xs font-bold text-gray-600">
                      Remise article
                      <input type="number" value={item.discount_amount} disabled={!canEditPrice} onChange={(e) => updateItem(item.product_id, "discount_amount", e.target.value)} className="mt-1 w-full border p-2 rounded-lg text-black disabled:bg-gray-100" />
                    </label>
                    <div className="text-xs font-bold text-gray-600">
                      TVA
                      <p className="mt-1 rounded-lg bg-gray-100 p-2 text-black">{taxEnabled ? `${Number(item.tax_rate || settings?.default_tax_rate || 18)}%` : "0%"}</p>
                    </div>
                    <div className="text-xs font-bold text-gray-600">
                      Total ligne
                      <p className="mt-1 rounded-lg bg-yellow-100 p-2 text-black">
                        {(Number(item.quantity || 0) * Number(item.unit_price || 0) - Number(item.discount_amount || 0)).toLocaleString()} FCFA
                      </p>
                    </div>
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
            <input type="number" value={discount} disabled={!canEditPrice} onChange={(e) => setDiscount(e.target.value)} placeholder="Remise ticket globale en FCFA" className="border p-3 rounded-xl w-full disabled:bg-gray-100" />
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={taxEnabled} onChange={(e) => setTaxEnabled(e.target.checked)} />
              TVA activée ({Number(settings?.default_tax_rate || 18)}% par défaut)
            </label>
            <div className="text-lg space-y-1">
              <p>Sous-total brut : <strong>{totals.subtotalBeforeDiscount.toLocaleString()} FCFA</strong></p>
              <p>Remises articles : <strong>{totals.itemDiscount.toLocaleString()} FCFA</strong></p>
              <p>Sous-total net : <strong>{totals.subtotal.toLocaleString()} FCFA</strong></p>
              <p>Remise ticket : <strong>{totals.discount.toLocaleString()} FCFA</strong></p>
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
