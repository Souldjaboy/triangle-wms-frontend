"use client";

import { useEffect, useState } from "react";

const providers = [
  { key: "card", name: "Carte bancaire" },
  { key: "orange_money", name: "Orange Money" },
  { key: "moov_money", name: "Moov Money" },
  { key: "wave", name: "Wave" },
];

const providerFields: Record<string, Array<{ name: string; label: string; type?: string; options?: string[] }>> = {
  card: [
    { name: "provider", label: "Nom fournisseur", options: ["Stripe", "CinetPay", "PayDunya"] },
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

export default function PosPaymentSettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [settings, setSettings] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState("card");
  const [form, setForm] = useState<any>({});
  const [message, setMessage] = useState("");

  const isAdmin =
    user?.is_super_admin === true ||
    ["admin", "super_admin"].includes(String(user?.role || "").toLowerCase());

  const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  });

  const load = async () => {
    const response = await fetch("/api/pos/payment-settings", {
      headers: headers(),
    });
    const data = await response.json().catch(() => []);
    const rows = Array.isArray(data) ? data : [];
    setSettings(rows);
    const selected = rows.find((item) => item.provider_key === selectedProvider);
    setForm(selected || { provider_key: selectedProvider, currency: "FCFA", mode: "test" });
  };

  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (saved) setUser(JSON.parse(saved));
    load();
  }, []);

  useEffect(() => {
    const selected = settings.find((item) => item.provider_key === selectedProvider);
    setForm(selected || { provider_key: selectedProvider, currency: "FCFA", mode: "test" });
  }, [selectedProvider, settings]);

  const save = async () => {
    const response = await fetch("/api/pos/payment-settings", {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify({ ...form, provider_key: selectedProvider }),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Paramètres paiement enregistrés." : data.error || "Erreur paramètres paiement.");
    if (response.ok) load();
  };

  const testConnection = async () => {
    const response = await fetch("/api/pos/payment-settings/test", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ provider_key: selectedProvider }),
    });
    const data = await response.json().catch(() => ({}));
    setMessage(response.ok ? data.message || "Connexion test OK." : data.error || "Erreur test connexion.");
    if (response.ok) load();
  };

  const update = (field: string, value: any) => {
    setForm((current: any) => ({ ...current, [field]: value }));
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-100 p-8 text-black">
        <a href="/pos" className="inline-block mb-5 rounded-xl bg-black px-5 py-3 font-bold text-white">Retour caisse</a>
        <div className="rounded-2xl bg-white p-6 shadow">
          <h1 className="text-3xl font-bold">Paramètres paiement</h1>
          <p className="mt-2 font-bold text-red-600">Accès réservé Admin et Super Admin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 text-black md:p-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold md:text-4xl">Paramètres paiement POS</h1>
          <p className="text-gray-500">Les clés secrètes sont envoyées au backend et ne sont jamais réaffichées en clair.</p>
        </div>
        <a href="/pos" className="rounded-xl bg-black px-5 py-3 font-bold text-white">Retour caisse</a>
      </div>

      {message && <div className="mb-5 rounded-xl bg-yellow-100 p-4 font-bold">{message}</div>}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-2xl bg-white p-4 shadow">
          {providers.map((provider) => (
            <button
              key={provider.key}
              onClick={() => setSelectedProvider(provider.key)}
              className={`mb-2 block w-full rounded-xl p-3 text-left font-bold ${
                selectedProvider === provider.key ? "bg-yellow-500" : "bg-gray-100"
              }`}
            >
              {provider.name}
            </button>
          ))}
        </div>

        <div className="rounded-2xl bg-white p-5 shadow lg:col-span-2">
          <h2 className="mb-4 text-2xl font-bold">
            {providers.find((provider) => provider.key === selectedProvider)?.name}
          </h2>

          <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl bg-gray-100 p-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-gray-500">Statut connexion</p>
              <p className="font-bold">{form.connection_status || "Non testé"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Dernière vérification</p>
              <p className="font-bold">
                {form.last_checked_at
                  ? new Date(form.last_checked_at).toLocaleString("fr-FR")
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Secret</p>
              <p className="font-bold">
                {form.secret_key || form.client_secret || form.webhook_secret
                  ? "Clé secrète déjà enregistrée"
                  : "Aucune clé secrète enregistrée"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {(providerFields[selectedProvider] || []).map((field) =>
              field.options ? (
                <select
                  key={field.name}
                  value={form[field.name] || field.options[0]}
                  onChange={(e) => update(field.name, e.target.value)}
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
                  value={form[field.name] || ""}
                  onChange={(e) => update(field.name, e.target.value)}
                  placeholder={field.label}
                  className="rounded-xl border p-3"
                />
              )
            )}
            <select value={form.mode || "test"} onChange={(e) => update("mode", e.target.value)} className="rounded-xl border p-3">
              <option value="test">Mode test</option>
              <option value="production">Mode production</option>
            </select>
            <input value={form.webhook_url || ""} onChange={(e) => update("webhook_url", e.target.value)} placeholder="URL webhook fournisseur" className="rounded-xl border p-3 md:col-span-2" />
            <label className="flex items-center gap-2 font-bold">
              <input type="checkbox" checked={form.is_active === true} onChange={(e) => update("is_active", e.target.checked)} />
              Paiement actif
            </label>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={save} className="rounded-xl bg-yellow-500 px-5 py-3 font-bold text-black">
              Enregistrer
            </button>
            <button onClick={testConnection} className="rounded-xl bg-black px-5 py-3 font-bold text-white">
              Tester connexion
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
