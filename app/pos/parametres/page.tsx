"use client";

import { useEffect, useState } from "react";
import { formatFCFA } from "../../lib/format";

const paymentOptions = [
  "Espèces",
  "Carte bancaire",
  "Orange Money",
  "Moov Money",
  "Wave",
  "Virement",
  "Paiement mixte",
  "Crédit client",
];

const paymentProviders = [
  { key: "card", name: "Carte bancaire" },
  { key: "orange_money", name: "Orange Money" },
  { key: "moov_money", name: "Moov Money" },
  { key: "wave", name: "Wave" },
];

const providerFields: Record<string, Array<{ name: string; label: string; type?: string; options?: string[] }>> = {
  card: [
    { name: "provider", label: "Fournisseur", options: ["Stripe", "CinetPay", "PayDunya"] },
    { name: "public_key", label: "Clé publique" },
    { name: "secret_key", label: "Clé secrète", type: "password" },
    { name: "webhook_secret", label: "Webhook secret", type: "password" },
    { name: "currency", label: "Devise" },
  ],
  orange_money: [
    { name: "merchant_id", label: "Merchant ID" },
    { name: "client_id", label: "Client ID" },
    { name: "client_secret", label: "Client Secret", type: "password" },
    { name: "merchant_account", label: "Numéro marchand Orange Money" },
    { name: "webhook_url", label: "URL webhook" },
    { name: "currency", label: "Devise" },
  ],
  moov_money: [
    { name: "merchant_id", label: "Merchant ID" },
    { name: "public_key", label: "API Key" },
    { name: "secret_key", label: "Secret Key", type: "password" },
    { name: "merchant_account", label: "Compte marchand Moov Money" },
    { name: "webhook_url", label: "URL webhook" },
    { name: "currency", label: "Devise" },
  ],
  wave: [
    { name: "public_key", label: "API Key" },
    { name: "secret_key", label: "Secret Key", type: "password" },
    { name: "merchant_account", label: "Compte marchand Wave" },
    { name: "webhook_url", label: "URL webhook" },
    { name: "currency", label: "Devise" },
  ],
};

export default function PosParametresPage() {
  const [user, setUser] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [paymentSettings, setPaymentSettings] = useState<any[]>([]);
  const [selectedPaymentProvider, setSelectedPaymentProvider] = useState("card");
  const [paymentForm, setPaymentForm] = useState<any>({
    provider_key: "card",
    currency: "FCFA",
    mode: "test",
  });
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [paymentMessage, setPaymentMessage] = useState("");

  const isAdmin = user?.is_super_admin === true || ["admin", "super_admin"].includes(String(user?.role || "").toLowerCase());

  const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  });

  const loadSettings = async () => {
    const response = await fetch("/api/pos/settings", { headers: headers() });
    const data = await response.json().catch(() => null);
    setSettings(data);
  };

  const loadPaymentSettings = async () => {
    const response = await fetch("/api/pos/payment-settings", {
      headers: headers(),
    });
    const data = await response.json().catch(() => []);
    const rows = Array.isArray(data) ? data : [];
    const selected = rows.find((item) => item.provider_key === selectedPaymentProvider);
    setPaymentSettings(rows);
    setPaymentForm(
      selected || {
        provider_key: selectedPaymentProvider,
        currency: "FCFA",
        mode: "test",
      }
    );
  };

  const searchProducts = async (value: string) => {
    const response = await fetch(`/api/pos/products/search?q=${encodeURIComponent(value)}`, {
      headers: headers(),
    });
    const data = await response.json().catch(() => []);
    setProducts(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (saved) setUser(JSON.parse(saved));
    loadSettings();
    loadPaymentSettings();
    searchProducts("");
  }, []);

  useEffect(() => {
    const selected = paymentSettings.find(
      (item) => item.provider_key === selectedPaymentProvider
    );
    setPaymentForm(
      selected || {
        provider_key: selectedPaymentProvider,
        currency: "FCFA",
        mode: "test",
      }
    );
  }, [selectedPaymentProvider, paymentSettings]);

  const saveSettings = async () => {
    const response = await fetch("/api/pos/settings", {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify(settings),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Paramètres POS enregistrés." : data.error || "Erreur paramètres POS.");
    if (response.ok) setSettings(data);
  };

  const saveProduct = async () => {
    if (!selectedProduct) return;

    const response = await fetch(`/api/pos/products/${selectedProduct.id}/settings`, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify(selectedProduct),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Produit POS enregistré." : data.error || "Erreur produit POS.");
    if (response.ok) {
      setSelectedProduct(data);
      searchProducts(query);
    }
  };

  const updateSetting = (field: string, value: any) => {
    setSettings((current: any) => ({ ...(current || {}), [field]: value }));
  };

  const updatePaymentSetting = (field: string, value: any) => {
    setPaymentForm((current: any) => ({ ...(current || {}), [field]: value }));
  };

  const updateProduct = (field: string, value: any) => {
    setSelectedProduct((current: any) => ({ ...(current || {}), [field]: value }));
  };

  const togglePayment = (method: string) => {
    const current = String(settings?.allowed_payment_methods || "").split(",").filter(Boolean);
    const next = current.includes(method)
      ? current.filter((item) => item !== method)
      : [...current, method];
    updateSetting("allowed_payment_methods", next.join(","));
  };

  const savePaymentSettings = async () => {
    const response = await fetch("/api/pos/payment-settings", {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify({
        ...paymentForm,
        provider_key: selectedPaymentProvider,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setPaymentMessage(
      response.ok
        ? "Paramètres paiement enregistrés."
        : data.error || "Erreur paramètres paiement."
    );
    if (response.ok) loadPaymentSettings();
  };

  const testPaymentConnection = async () => {
    const response = await fetch("/api/pos/payment-settings/test", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ provider_key: selectedPaymentProvider }),
    });
    const data = await response.json().catch(() => ({}));
    setPaymentMessage(
      response.ok
        ? data.message || "Connexion test OK."
        : data.error || "Erreur test connexion."
    );
    if (response.ok) loadPaymentSettings();
  };

  const getProductPrice = (product: any) =>
    [
      product.effective_sale_price,
      product.sale_price,
      product.pharmacy_price,
      product.wholesale_price,
      product.price,
    ].map((value) => Number(value || 0)).find((value) => value > 0) || 0;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-100 p-8 text-black">
        <a href="/pos" className="inline-block mb-5 bg-black text-white px-5 py-3 rounded-xl font-bold">Retour caisse</a>
        <div className="bg-white rounded-2xl shadow p-6">
          <h1 className="text-3xl font-bold mb-2">Paramètres POS</h1>
          <p className="text-red-600 font-bold">Accès réservé au Super Admin et à l’Admin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 text-black">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">Paramètres POS</h1>
          <p className="text-gray-500">Prix, TVA, reçus, paiements, pharmacie et codes produits.</p>
        </div>
        <a href="/pos" className="bg-black text-white px-5 py-3 rounded-xl font-bold">Retour caisse</a>
      </div>

      {message && <div className="bg-yellow-100 p-4 rounded-xl mb-5 font-bold">{message}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl shadow p-5 xl:col-span-1">
          <h2 className="text-2xl font-bold mb-4">Paramètres globaux</h2>
          <div className="grid gap-3">
            <label className="flex items-center gap-2 font-bold">
              <input type="checkbox" checked={settings?.pos_enabled !== false} onChange={(e) => updateSetting("pos_enabled", e.target.checked)} />
              POS activé
            </label>
            <input type="number" value={settings?.default_tax_rate || ""} onChange={(e) => updateSetting("default_tax_rate", e.target.value)} placeholder="TVA par défaut %" className="border p-3 rounded-xl" />
            <input value={settings?.currency || ""} onChange={(e) => updateSetting("currency", e.target.value)} placeholder="Devise" className="border p-3 rounded-xl" />
            <select value={settings?.receipt_format || "80mm"} onChange={(e) => updateSetting("receipt_format", e.target.value)} className="border p-3 rounded-xl">
              <option value="80mm">Reçu thermique 80 mm</option>
              <option value="a4">A4 PDF</option>
            </select>
            <input value={settings?.printer_name || ""} onChange={(e) => updateSetting("printer_name", e.target.value)} placeholder="Imprimante" className="border p-3 rounded-xl" />
            <input type="number" value={settings?.max_discount_rate || ""} onChange={(e) => updateSetting("max_discount_rate", e.target.value)} placeholder="Seuil remise maximum %" className="border p-3 rounded-xl" />
            <div>
              <p className="font-bold mb-2">Modes de paiement autorisés</p>
              <div className="grid grid-cols-1 gap-2">
                {paymentOptions.map((method) => (
                  <label key={method} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={String(settings?.allowed_payment_methods || "").split(",").includes(method)}
                      onChange={() => togglePayment(method)}
                    />
                    {method}
                  </label>
                ))}
              </div>
            </div>
            <button onClick={saveSettings} className="bg-yellow-500 text-black px-5 py-3 rounded-xl font-bold">Enregistrer paramètres</button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-5 xl:col-span-2">
          <h2 className="text-2xl font-bold mb-4">Paramètres paiement</h2>
          <p className="text-gray-500 mb-4">
            Sélectionne un fournisseur : seuls ses champs s’affichent.
          </p>

          {paymentMessage && (
            <div className="mb-4 rounded-xl bg-yellow-100 p-4 font-bold">
              {paymentMessage}
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="rounded-2xl border p-3">
              {paymentProviders.map((provider) => (
                <button
                  key={provider.key}
                  onClick={() => setSelectedPaymentProvider(provider.key)}
                  className={`mb-2 block w-full rounded-xl p-3 text-left font-bold ${
                    selectedPaymentProvider === provider.key
                      ? "bg-yellow-500"
                      : "bg-gray-100"
                  }`}
                >
                  {provider.name}
                </button>
              ))}
            </div>

            <div className="lg:col-span-2">
              <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl bg-gray-100 p-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-gray-500">Statut connexion</p>
                  <p className="font-bold">
                    {paymentForm.connection_status || "Non testé"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Dernière vérification</p>
                  <p className="font-bold">
                    {paymentForm.last_checked_at
                      ? new Date(paymentForm.last_checked_at).toLocaleString("fr-FR")
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Secret</p>
                  <p className="font-bold">
                    {paymentForm.secret_key ||
                    paymentForm.client_secret ||
                    paymentForm.webhook_secret
                      ? "Clé secrète déjà enregistrée"
                      : "Aucune clé secrète enregistrée"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {(providerFields[selectedPaymentProvider] || []).map((field) =>
                  field.options ? (
                    <select
                      key={field.name}
                      value={paymentForm[field.name] || field.options[0]}
                      onChange={(e) => updatePaymentSetting(field.name, e.target.value)}
                      className="rounded-xl border p-3"
                    >
                      {field.options.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      key={field.name}
                      type={field.type || "text"}
                      value={paymentForm[field.name] || ""}
                      onChange={(e) => updatePaymentSetting(field.name, e.target.value)}
                      placeholder={field.label}
                      className="rounded-xl border p-3"
                    />
                  )
                )}

                <select
                  value={paymentForm.mode || "test"}
                  onChange={(e) => updatePaymentSetting("mode", e.target.value)}
                  className="rounded-xl border p-3"
                >
                  <option value="test">Mode test</option>
                  <option value="production">Mode production</option>
                </select>

                <label className="flex items-center gap-2 font-bold">
                  <input
                    type="checkbox"
                    checked={paymentForm.is_active === true}
                    onChange={(e) => updatePaymentSetting("is_active", e.target.checked)}
                  />
                  Paiement actif
                </label>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={savePaymentSettings}
                  className="rounded-xl bg-yellow-500 px-5 py-3 font-bold text-black"
                >
                  Enregistrer
                </button>
                <button
                  onClick={testPaymentConnection}
                  className="rounded-xl bg-black px-5 py-3 font-bold text-white"
                >
                  Tester connexion
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-5 xl:col-span-2">
          <h2 className="text-2xl font-bold mb-4">Paramètres produit</h2>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              searchProducts(e.target.value);
            }}
            placeholder="Chercher produit, référence, code-barres..."
            className="border p-3 rounded-xl w-full mb-4"
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="border rounded-2xl overflow-hidden">
              {products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => setSelectedProduct(product)}
                  className={`block w-full text-left p-3 border-b ${selectedProduct?.id === product.id ? "bg-yellow-100" : "bg-white"}`}
                >
                  <strong>{product.reference}</strong> - {product.name}
                  <span className="block text-sm text-gray-500">
                    {formatFCFA(getProductPrice(product))} | Stock {product.stock}
                  </span>
                </button>
              ))}
              {products.length === 0 && <p className="p-4 text-gray-500">Aucun produit.</p>}
            </div>

            {selectedProduct ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input type="number" value={selectedProduct.purchase_price || ""} onChange={(e) => updateProduct("purchase_price", e.target.value)} placeholder="Prix achat" className="border p-3 rounded-xl" />
                <input type="number" value={selectedProduct.sale_price || ""} onChange={(e) => updateProduct("sale_price", e.target.value)} placeholder="Prix vente" className="border p-3 rounded-xl" />
                <input type="number" value={selectedProduct.wholesale_price || ""} onChange={(e) => updateProduct("wholesale_price", e.target.value)} placeholder="Prix grossiste" className="border p-3 rounded-xl" />
                <input type="number" value={selectedProduct.pharmacy_price || ""} onChange={(e) => updateProduct("pharmacy_price", e.target.value)} placeholder="Prix pharmacie" className="border p-3 rounded-xl" />
                <input type="number" value={selectedProduct.tax_rate || ""} onChange={(e) => updateProduct("tax_rate", e.target.value)} placeholder="TVA %" className="border p-3 rounded-xl" />
                <input type="number" value={selectedProduct.max_discount_rate || ""} onChange={(e) => updateProduct("max_discount_rate", e.target.value)} placeholder="Remise max %" className="border p-3 rounded-xl" />
                <input value={selectedProduct.barcode || ""} onChange={(e) => updateProduct("barcode", e.target.value)} placeholder="Code-barres" className="border p-3 rounded-xl" />
                <input value={selectedProduct.qr_code || ""} onChange={(e) => updateProduct("qr_code", e.target.value)} placeholder="QR code interne" className="border p-3 rounded-xl" />
                <input value={selectedProduct.lot_number || ""} onChange={(e) => updateProduct("lot_number", e.target.value)} placeholder="Lot" className="border p-3 rounded-xl" />
                <input type="date" value={selectedProduct.manufacture_date?.slice?.(0, 10) || ""} onChange={(e) => updateProduct("manufacture_date", e.target.value)} className="border p-3 rounded-xl" />
                <input type="date" value={selectedProduct.expiration_date?.slice?.(0, 10) || ""} onChange={(e) => updateProduct("expiration_date", e.target.value)} className="border p-3 rounded-xl" />
                <input value={selectedProduct.category || ""} onChange={(e) => updateProduct("category", e.target.value)} placeholder="Catégorie" className="border p-3 rounded-xl" />
                <input value={selectedProduct.subcategory || ""} onChange={(e) => updateProduct("subcategory", e.target.value)} placeholder="Sous-catégorie" className="border p-3 rounded-xl" />
                <input value={selectedProduct.supplier_id || ""} onChange={(e) => updateProduct("supplier_id", e.target.value)} placeholder="Fournisseur ID" className="border p-3 rounded-xl" />
                <label className="flex items-center gap-2 font-bold">
                  <input type="checkbox" checked={selectedProduct.batch_tracking_enabled === true} onChange={(e) => updateProduct("batch_tracking_enabled", e.target.checked)} />
                  Suivi lots
                </label>
                <label className="flex items-center gap-2 font-bold">
                  <input type="checkbox" checked={selectedProduct.expiration_tracking_enabled === true} onChange={(e) => updateProduct("expiration_tracking_enabled", e.target.checked)} />
                  Suivi expiration
                </label>
                <label className="flex items-center gap-2 font-bold">
                  <input type="checkbox" checked={selectedProduct.blocked_for_sale === true} onChange={(e) => updateProduct("blocked_for_sale", e.target.checked)} />
                  Produit bloqué
                </label>
                <button onClick={saveProduct} className="md:col-span-2 bg-yellow-500 text-black px-5 py-3 rounded-xl font-bold">Enregistrer produit POS</button>
              </div>
            ) : (
              <p className="text-gray-500">Sélectionne un produit pour régler ses prix, TVA, lot et codes.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
