"use client";

import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatFCFA } from "../lib/format";

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
  const [amountReceived, setAmountReceived] = useState("");
  const [discount, setDiscount] = useState("0");
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [lastReceipt, setLastReceipt] = useState<any>(null);
  const [lastSale, setLastSale] = useState<any>(null);
  const [lastItems, setLastItems] = useState<any[]>([]);
  const [paymentTransaction, setPaymentTransaction] = useState<any>(null);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentPhone, setPaymentPhone] = useState("");
  const [mixedPayments, setMixedPayments] = useState([
    { method: "Espèces", amount: "", reference: "" },
    { method: "Orange Money", amount: "", reference: "" },
  ]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [scannerMode, setScannerMode] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [cameraMessage, setCameraMessage] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanFrameRef = useRef<number | null>(null);

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
    if (scannerMode) startCameraScanner();
    return () => stopCameraScanner();
  }, [scannerMode, mode, products]);

  const scanImageFile = async (file: File | null) => {
    if (!file) return;

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("pos-image-reader");
      const decodedText = await scanner.scanFile(file, true);
      scanner.clear();
      handleScannedCode(decodedText);
    } catch {
      setMessage("QR code non reconnu dans cette image.");
    }
  };

  const stopCameraScanner = () => {
    if (scanFrameRef.current) {
      cancelAnimationFrame(scanFrameRef.current);
      scanFrameRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startCameraScanner = async () => {
    stopCameraScanner();
    setCameraMessage("Autoriser la caméra pour commencer le scan.");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraMessage("Aucune caméra détectée.");
        return;
      }

      const BarcodeDetectorCtor = (window as any).BarcodeDetector;

      if (!BarcodeDetectorCtor) {
        setCameraMessage(
          "Scanner caméra non supporté par ce navigateur. Utilisez le champ code-barres USB ou Scanner une image."
        );
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (!videoRef.current) return;

      videoRef.current.srcObject = stream;
      videoRef.current.setAttribute("playsinline", "true");
      await videoRef.current.play();

      setCameraMessage("Scanner avec la caméra.");

      const detector = new BarcodeDetectorCtor({
        formats: [
          "qr_code",
          "ean_13",
          "ean_8",
          "code_128",
          "code_39",
          "upc_a",
          "upc_e",
        ],
      });

      const scan = async () => {
        if (!scannerMode || !videoRef.current) return;

        try {
          const codes = await detector.detect(videoRef.current);

          if (codes.length > 0) {
            const rawValue = codes[0]?.rawValue || "";
            stopCameraScanner();
            setScannerMode(false);
            await handleScannedCode(rawValue);
            return;
          }
        } catch {
          // Keep scanning; detection can fail while the video is warming up.
        }

        scanFrameRef.current = requestAnimationFrame(scan);
      };

      scanFrameRef.current = requestAnimationFrame(scan);
    } catch (error: any) {
      stopCameraScanner();

      if (error?.name === "NotAllowedError" || error?.name === "SecurityError") {
        setCameraMessage("Autorisation caméra refusée.");
      } else if (error?.name === "NotFoundError" || error?.name === "OverconstrainedError") {
        setCameraMessage("Aucune caméra détectée.");
      } else {
        setCameraMessage("Impossible d’ouvrir la caméra.");
      }
    }
  };

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
      ).replace(/^Ref\s*[-_]*\s*/i, "").trim();
    } catch {
      return raw.replace(/^Ref\s*[-_]*\s*/i, "").trim();
    }
  };

  const normalizeProductCode = (value: any) =>
    String(value || "")
      .trim()
      .replace(/^Ref\s*[-_]*\s*/i, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();

  const getProductPrice = (product: any) =>
    [
      product.effective_sale_price,
      product.sale_price,
      product.pharmacy_price,
      product.wholesale_price,
      product.price,
    ].map((value) => Number(value || 0)).find((value) => value > 0) || 0;

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
    const normalizedValue = normalizeProductCode(cleanCode);
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
        .some(
          (field) =>
            String(field).toLowerCase() === value ||
            normalizeProductCode(field) === normalizedValue
        );
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

  const mixedTotal = mixedPayments.reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0
  );
  const amountReceivedNumber =
    paymentMethod === "Paiement mixte" ? mixedTotal : Number(amountReceived || 0);
  const changeDue = Math.max(amountReceivedNumber - totals.total, 0);
  const remainingAmount = Math.max(totals.total - amountReceivedNumber, 0);
  const isExternalPayment = ["Carte bancaire", "Orange Money", "Moov Money", "Wave"].includes(paymentMethod);
  const isPendingPaymentMethod = isExternalPayment || paymentMethod === "Virement";
  const paymentActionLabel =
    paymentMethod === "Orange Money"
      ? "Initier paiement Orange Money"
      : paymentMethod === "Moov Money"
        ? "Initier paiement Moov Money"
        : paymentMethod === "Wave"
          ? "Initier paiement Wave"
          : paymentMethod === "Carte bancaire"
            ? "Paiement carte"
            : "Initier paiement";

  const updateMixedPayment = (index: number, key: string, value: string) => {
    setMixedPayments((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row
      )
    );
  };

  const initiatePayment = async () => {
    setPaymentMessage("");

    if (cart.length === 0) {
      setPaymentMessage("Panier vide.");
      return;
    }

    const response = await fetch("/api/pos/sales", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        items: cart,
        discount_amount: Number(discount || 0),
        tax_enabled: taxEnabled,
        payment_method: paymentMethod,
        payment_status: "en attente",
        amount_received: amountReceivedNumber,
        change_due: changeDue,
        remaining_amount: remainingAmount,
        customer_phone: paymentPhone,
        mixed_payments: mixedPayments,
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setPaymentMessage(data.error || "Erreur initiation paiement.");
      return;
    }

    setLastSale(data.sale);
    setLastItems(data.items || []);
    setLastReceipt(data.receipt || null);
    setPaymentTransaction(data.payment_transaction || data.transaction);
    if (data.company_settings) setCompanySettings(data.company_settings);
    setCart([]);
    setPaymentStatus("en attente");
    setPaymentMessage(
      `Paiement initié : ${
        data.payment_transaction?.provider_reference || data.provider_reference || data.sale?.payment_reference || "-"
      } - statut en attente.`
    );
    searchProducts(query);
  };

  const confirmPayment = async (status: "payé" | "échoué") => {
    if (paymentProcessing) return;

    if (!paymentTransaction?.id && !lastSale?.transaction_id) {
      setPaymentMessage("Aucune transaction à confirmer.");
      return;
    }

    setPaymentProcessing(true);

    try {
      const response = await fetch("/api/payments/confirm", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          transaction_id: paymentTransaction?.id || lastSale?.transaction_id,
          provider_reference: paymentTransaction?.provider_reference || lastSale?.payment_reference || "",
          status,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setPaymentMessage(data.error || "Erreur confirmation paiement.");
        return;
      }

      setPaymentStatus(data.status || status);
      if (paymentTransaction) {
        setPaymentTransaction({ ...paymentTransaction, status: data.status || status });
      }
      if (data.sale) setLastSale(data.sale);
      if (data.receipt) setLastReceipt(data.receipt);
      if (data.items) setLastItems(data.items);
      if (data.company_settings) setCompanySettings(data.company_settings);
      setPaymentMessage(
        data.status === "paid"
          ? "Paiement simulé avec succès."
          : "Paiement simulé comme échoué."
      );
    } finally {
      setPaymentProcessing(false);
    }
  };

  const validateSale = async () => {
    setMessage("");

    if (!isPendingPaymentMethod && paymentMethod !== "Crédit client" && Number(amountReceived || 0) < totals.total && paymentStatus === "payé") {
      setMessage("Montant reçu insuffisant.");
      return;
    }

    const response = await fetch("/api/pos/sales", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        items: cart,
        discount_amount: Number(discount || 0),
        tax_enabled: taxEnabled,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        amount_received: amountReceivedNumber,
        change_due: changeDue,
        remaining_amount: remainingAmount,
        customer_phone: paymentPhone,
        mixed_payments: mixedPayments,
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
    setPaymentTransaction(data.payment_transaction || paymentTransaction);
    if (data.company_settings) setCompanySettings(data.company_settings);
    setCart([]);
    setAmountReceived("");
    setMessage(
      data.payment_required
        ? "Demande de paiement créée. Statut en attente de confirmation fournisseur."
        : "Vente validée. Reçu généré."
    );
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
                    (item) => `<tr><td>${item.product_name}</td><td>${item.quantity}</td><td class="right">${formatFCFA(item.total_price)}</td></tr>`
                  )
                  .join("")}
              </tbody>
            </table>
            <p class="right">Remise : ${formatFCFA(lastSale.discount_amount)}</p>
            <p class="right">TVA : ${formatFCFA(lastSale.tax_amount)}</p>
            <p class="total">Total : ${formatFCFA(lastSale.total_amount)}</p>
            <p class="right">Montant reçu : ${formatFCFA(lastSale.amount_paid)}</p>
            <p class="right">Monnaie rendue : ${formatFCFA(lastSale.change_due)}</p>
            <p class="right">Reste à payer : ${formatFCFA(lastSale.amount_due)}</p>
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
          <a href="/pos/paiements" className="bg-white text-black px-5 py-3 rounded-xl font-bold">
            Paiements
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
          <a href="/pos/parametres-paiement" className="bg-white text-black px-5 py-3 rounded-xl font-bold">
            Paramètres paiement
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
                onClick={() => {
                  setCameraMessage("Autoriser la caméra pour commencer le scan.");
                  setScannerMode(true);
                }}
                className={`px-5 py-3 rounded-xl font-bold ${scannerMode ? "bg-yellow-500" : "bg-black text-white"}`}
              >
                Scanner avec la caméra
              </button>
              <label className="cursor-pointer rounded-xl bg-white px-5 py-3 font-bold text-black border">
                Scanner une image
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(event) => scanImageFile(event.target.files?.[0] || null)}
                />
              </label>
              <span className="text-sm text-gray-500 self-center">
                Lecteur USB : scannez dans le champ puis Entrée.
              </span>
            </div>
            <div id="pos-image-reader" className="hidden" />
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

          {scannerMode && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
              <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-2xl">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold">Scanner produit</h2>
                    <p className="text-sm text-gray-500">
                      Mode {mode === "vente" ? "Vente" : "Information produit"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setScannerMode(false)}
                    className="rounded-xl bg-black px-4 py-2 font-bold text-white"
                  >
                    Fermer
                  </button>
                </div>

                <div className="overflow-hidden rounded-xl bg-black">
                  <video
                    ref={videoRef}
                    className="h-[55vh] max-h-[460px] w-full object-cover"
                    muted
                    playsInline
                  />
                </div>

                <p className="mt-3 rounded-xl bg-yellow-100 p-3 text-sm font-bold text-yellow-900">
                  {cameraMessage}
                </p>

                <p className="mt-2 text-sm text-gray-500">
                  Présentez un QR code produit ou un code-barres devant la caméra. Aucun changement de page ne sera effectué.
                </p>
              </div>
            </div>
          )}

          {selectedProduct && mode === "info" && (
            <div className="bg-white rounded-2xl shadow p-5">
              <div className="flex flex-col md:flex-row gap-4">
                {selectedProduct.image_url && (
                  <img src={selectedProduct.image_url} alt={selectedProduct.name} className="h-32 w-32 rounded-xl object-cover border" />
                )}
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-3">{selectedProduct.name}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <p><strong>Référence :</strong> {selectedProduct.reference}</p>
                    <p><strong>Prix :</strong> {formatFCFA(getProductPrice(selectedProduct))}</p>
                    <p><strong>Stock :</strong> {selectedProduct.stock}</p>
                    <p><strong>Emplacement :</strong> {selectedProduct.location_code || selectedProduct.emplacement_code || "-"}</p>
                    <p><strong>Lot :</strong> {selectedProduct.lot_number || "-"}</p>
                    <p><strong>Expiration :</strong> {selectedProduct.expiration_date || "-"}</p>
                  </div>
                </div>
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
                {product.image_url && (
                  <img src={product.image_url} alt={product.name} className="mb-3 h-28 w-full rounded-xl object-cover border" />
                )}
                <p className="font-bold text-lg">{product.name}</p>
                <p className="text-sm text-gray-500">{product.reference}</p>
                <p className="text-yellow-600 font-bold mt-2">
                  {formatFCFA(getProductPrice(product))}
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
                        {formatFCFA(Number(item.quantity || 0) * Number(item.unit_price || 0) - Number(item.discount_amount || 0))}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="border-t mt-5 pt-5 space-y-3">
            <h2 className="text-2xl font-bold">Paiement</h2>
            <select
              value={paymentMethod}
              onChange={(e) => {
                const method = e.target.value;
                setPaymentMethod(method);
                if (["Carte bancaire", "Orange Money", "Moov Money", "Wave", "Virement"].includes(method)) {
                  setPaymentStatus("en attente");
                } else if (method === "Espèces") {
                  setPaymentStatus("payé");
                }
              }}
              className="border p-3 rounded-xl w-full"
            >
              {paymentMethods.map((method) => <option key={method}>{method}</option>)}
            </select>
            <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className="border p-3 rounded-xl w-full">
              <option value="payé">Payé</option>
              <option value="en attente">En attente</option>
              <option value="échoué">Échoué</option>
              <option value="annulé">Annulé</option>
            </select>
            <input type="number" value={discount} disabled={!canEditPrice} onChange={(e) => setDiscount(e.target.value)} placeholder="Remise ticket globale en FCFA" className="border p-3 rounded-xl w-full disabled:bg-gray-100" />
            {paymentMethod === "Paiement mixte" ? (
              <div className="rounded-xl border p-3 space-y-3">
                <p className="font-bold">Paiement mixte</p>
                {mixedPayments.map((row, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <select
                      value={row.method}
                      onChange={(e) => updateMixedPayment(index, "method", e.target.value)}
                      className="border p-3 rounded-xl"
                    >
                      {paymentMethods.filter((method) => method !== "Paiement mixte").map((method) => (
                        <option key={method}>{method}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={row.amount}
                      onChange={(e) => updateMixedPayment(index, "amount", e.target.value)}
                      placeholder="Montant"
                      className="border p-3 rounded-xl"
                    />
                    <input
                      value={row.reference}
                      onChange={(e) => updateMixedPayment(index, "reference", e.target.value)}
                      placeholder="Référence"
                      className="border p-3 rounded-xl"
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setMixedPayments((current) => [...current, { method: "Espèces", amount: "", reference: "" }])}
                  className="bg-gray-100 text-black px-4 py-2 rounded-xl font-bold"
                >
                  Ajouter une ligne paiement
                </button>
              </div>
            ) : (
              <input
                type="number"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                placeholder="Montant reçu du client"
                className="border p-3 rounded-xl w-full"
              />
            )}

            {isExternalPayment && (
              <div className="rounded-xl bg-blue-50 p-4 space-y-3">
                {["Orange Money", "Moov Money"].includes(paymentMethod) && (
                  <input
                    type="tel"
                    value={paymentPhone}
                    onChange={(event) => setPaymentPhone(event.target.value)}
                    placeholder="Numéro téléphone client"
                    className="w-full rounded-xl border p-3"
                  />
                )}
                <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
                  <div>
                    <p className="font-bold">Paiement réel / sandbox</p>
                    <p className="text-sm text-blue-800">
                      Carte, Orange Money, Moov Money et Wave passent par une transaction. Sans clé marchand, le mode sandbox permet de simuler.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={initiatePayment}
                    className="bg-black text-white px-4 py-3 rounded-xl font-bold"
                  >
                    {paymentActionLabel}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div className="bg-white rounded-xl p-3">
                    <p className="text-gray-500">Statut</p>
                    <p className="font-bold">{paymentTransaction?.status || paymentStatus}</p>
                  </div>
                  <div className="bg-white rounded-xl p-3">
                    <p className="text-gray-500">Référence transaction</p>
                    <p className="font-bold break-all">{paymentTransaction?.provider_reference || lastSale?.payment_reference || "-"}</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => confirmPayment("payé")}
                      disabled={paymentProcessing || !["pending", "en attente"].includes(String(paymentTransaction?.status || paymentStatus || "").toLowerCase())}
                      className="flex-1 bg-green-600 text-white rounded-xl px-3 py-2 font-bold disabled:opacity-50"
                    >
                      {paymentProcessing ? "Traitement..." : "Simuler réussi"}
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmPayment("échoué")}
                      disabled={paymentProcessing || !["pending", "en attente"].includes(String(paymentTransaction?.status || paymentStatus || "").toLowerCase())}
                      className="flex-1 bg-red-600 text-white rounded-xl px-3 py-2 font-bold disabled:opacity-50"
                    >
                      {paymentProcessing ? "Traitement..." : "Simuler échoué"}
                    </button>
                  </div>
                </div>

                {paymentMessage && (
                  <p className="rounded-xl bg-white p-3 font-bold">{paymentMessage}</p>
                )}
              </div>
            )}
            {paymentMethod === "Virement" && (
              <div className="rounded-xl bg-blue-50 p-4 font-bold text-blue-900">
                Virement : la vente reste en attente jusqu’à confirmation manuelle admin/super admin dans Paiements POS.
              </div>
            )}
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={taxEnabled} onChange={(e) => setTaxEnabled(e.target.checked)} />
              TVA activée ({Number(settings?.default_tax_rate || 18)}% par défaut)
            </label>
            <div className="text-lg space-y-1">
              <p>Sous-total brut : <strong>{formatFCFA(totals.subtotalBeforeDiscount)}</strong></p>
              <p>Remises articles : <strong>{formatFCFA(totals.itemDiscount)}</strong></p>
              <p>Sous-total net : <strong>{formatFCFA(totals.subtotal)}</strong></p>
              <p>Remise ticket : <strong>{formatFCFA(totals.discount)}</strong></p>
              <p>TVA : <strong>{formatFCFA(totals.tax)}</strong></p>
              <p className="text-2xl">Total : <strong>{formatFCFA(totals.total)}</strong></p>
              <p>Total payé : <strong>{formatFCFA(amountReceivedNumber)}</strong></p>
              <p className="text-green-600">Monnaie à rendre : <strong>{formatFCFA(changeDue)}</strong></p>
              <p className="text-red-600">Reste à payer : <strong>{formatFCFA(remainingAmount)}</strong></p>
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
