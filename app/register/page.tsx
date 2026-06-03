"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "../lib/api";
import { formatFCFA } from "../lib/format";

const DEFAULT_PLANS = [
  {
    id: 1,
    name: "Essentiel",
    price_monthly: 5000,
    max_users: 3,
    max_warehouses: 1,
    max_products: 300,
    trial_days: 15,
  },
  {
    id: 2,
    name: "Standard",
    price_monthly: 10000,
    max_users: 10,
    max_warehouses: 3,
    max_products: 2000,
    trial_days: 15,
  },
  {
    id: 3,
    name: "Premium",
    price_monthly: 15000,
    max_users: 30,
    max_warehouses: 10,
    max_products: 10000,
    trial_days: 15,
  },
];

const AVAILABLE_MODULES = [
  { key: "produits", label: "Produits" },
  { key: "stock", label: "Stock" },
  { key: "inventaire", label: "Inventaires" },
  { key: "mouvements", label: "Mouvements" },
  { key: "entrepots", label: "Entrepôts" },
  { key: "emplacements", label: "Emplacements" },
  { key: "ventes", label: "Ventes" },
  { key: "pos", label: "POS / Caisse" },
  { key: "paiements", label: "Paiements" },
  { key: "recus", label: "Reçus" },
  { key: "achats", label: "Achats" },
  { key: "fournisseurs", label: "Fournisseurs" },
  { key: "clients", label: "Clients" },
  { key: "partenaires", label: "Partenaires" },
  { key: "comptabilite", label: "Comptabilité" },
  { key: "documents", label: "Documents" },
  { key: "rapports", label: "Rapports" },
  { key: "pointage", label: "Pointage" },
  { key: "ia", label: "Assistant IA" },
];

const defaultSelectedModules = AVAILABLE_MODULES.reduce((acc: Record<string, boolean>, module) => {
  acc[module.key] = true;
  return acc;
}, {});

export default function RegisterPage() {

  const router = useRouter();

  const [plans, setPlans] = useState<any[]>([]);

  const [selectedPlan, setSelectedPlan] =
    useState<any>(null);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [formData, setFormData] =
    useState({
      company_name: "",
      business_type: "",
      responsible_name: "",
      email: "",
      phone: "",
      country: "",
      address: "",
      password: "",
    });
  const [selectedModules, setSelectedModules] =
    useState<Record<string, boolean>>(defaultSelectedModules);

  const fetchPlans = async () => {

    try {

      const response = await fetch(apiUrl("/public/plans"));

      const data =
        await response.json();

      const availablePlans =
        Array.isArray(data) && data.length > 0
          ? data.map((plan: any) => ({
              ...plan,
              name: plan.name === "Starter" ? "Essentiel" : plan.name,
            }))
          : DEFAULT_PLANS;

      setPlans(availablePlans);

      setSelectedPlan((current: any) => current || availablePlans[0]);

    } catch (error) {

      console.error(error);
      setPlans(DEFAULT_PLANS);
      setSelectedPlan((current: any) => current || DEFAULT_PLANS[0]);

    }

  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleChange = (e: any) => {

    setFormData({
      ...formData,
      [e.target.name]:
        e.target.value,
    });

  };

  const toggleModule = (moduleKey: string) => {
    setSelectedModules((current) => ({
      ...current,
      [moduleKey]: current[moduleKey] === false,
    }));
  };

  const displayLimit = (value: any) => {
    const numberValue = Number(value || 0);
    return numberValue > 0 ? numberValue.toLocaleString("fr-FR") : "Non défini";
  };

  /* REGISTER + PAYMENT */

  const handleSubmit = async (
    e: any
  ) => {

    e.preventDefault();

    if (!selectedPlan) {

      setError(
        "Veuillez choisir un plan."
      );

      return;

    }

    setLoading(true);

    setMessage("");
    setError("");

    try {

      /* CREATE COMPANY */

      const registerResponse =
        await fetch(
          apiUrl("/register-saas"),
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              ...formData,
              plan_id:
                selectedPlan.id,
              plan_name:
                selectedPlan.name,
              plan_price:
                selectedPlan.price_monthly,
              selected_modules:
                selectedModules,
            }),
          }
        );

      const registerText = await registerResponse.text();
      let registerData: any = {};

      try {
        registerData = registerText ? JSON.parse(registerText) : {};
      } catch {
        registerData = {
          error: `Réponse serveur invalide : ${registerText.slice(0, 160)}`
        };
      }

      if (
        !registerResponse.ok
      ) {

        setError(
          registerData.error ||
          "Erreur inscription."
        );

        setLoading(false);

        return;

      }

      /* PAYMENT */

      try {
        const paymentResponse =
          await fetch(
            apiUrl("/payments/create"),
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({

                company_id:
                  registerData.company?.id,

                plan_id:
                  selectedPlan.id,

                amount:
                  selectedPlan.price_monthly,

                customer_name:
                  formData.company_name,

                customer_email:
                  formData.email,

                customer_phone:
                  formData.phone,

              }),
            }
          );

        const paymentData =
          await paymentResponse.json().catch(() => ({}));

        if (
          paymentData.data?.payment_url
        ) {

          window.location.href =
            paymentData.data.payment_url;

          return;

        }
      } catch (paymentError) {
        console.error("Paiement non disponible :", paymentError);
      }

      setMessage(
        "Entreprise créée avec succès. Vous pouvez vous connecter."
      );

      setTimeout(() => {

        router.push("/login");

      }, 2000);

    } catch (error) {

      console.error(error);

      setError(
        "Erreur serveur."
      );

    } finally {

      setLoading(false);

    }

  };

  return (

    <div className="min-h-screen bg-gray-100 p-4 md:p-8">

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">

        {/* LEFT */}

        <div className="lg:col-span-2 bg-white rounded-3xl shadow p-6 md:p-10">
          <div className="mb-8 flex flex-col gap-5 rounded-2xl bg-black p-6 text-white md:flex-row md:items-center">
            <img
              src="/icons/triangle-wms-icon.svg"
              alt="Triangle WMS Pro"
              className="h-20 w-20 rounded-2xl bg-yellow-500 p-3"
            />
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-yellow-400">
                ERP / WMS SaaS intelligent
              </p>
              <h1 className="mt-1 text-3xl font-bold md:text-4xl">
                Créez votre entreprise en quelques minutes.
              </h1>
              <p className="mt-3 max-w-3xl text-gray-300">
                Triangle WMS Pro vous aide à gérer stocks, ventes, achats, utilisateurs,
                paiements et opérations quotidiennes depuis une plateforme moderne.
              </p>
            </div>
          </div>

          <div className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-5">
            {[
              "Gestion centralisée",
              "Suivi en temps réel",
              "Assistant IA intégré",
              "Rapports automatiques",
              "Sécurité avancée",
            ].map((item) => (
              <div key={item} className="rounded-xl bg-yellow-50 p-3 text-sm font-bold text-black">
                {item}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => router.push("/login")}
            className="mb-6 bg-black text-white font-bold rounded-xl px-5 py-3"
          >
            Déjà un compte ? Se connecter
          </button>

          {message && (

            <div className="bg-green-100 text-green-700 p-4 rounded-xl mb-6">
              {message}
            </div>

          )}

          {error && (

            <div className="bg-red-100 text-red-700 p-4 rounded-xl mb-6">
              {error}
            </div>

          )}

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6"
          >

            <input
              type="text"
              name="company_name"
              placeholder="Nom entreprise"
              value={formData.company_name}
              onChange={handleChange}
              className="border rounded-xl p-4 text-black"
              required
            />

            <input
              type="text"
              name="business_type"
              placeholder="Type activité"
              value={formData.business_type}
              onChange={handleChange}
              className="border rounded-xl p-4 text-black"
            />

            <input
              type="text"
              name="responsible_name"
              placeholder="Responsable"
              value={formData.responsible_name}
              onChange={handleChange}
              className="border rounded-xl p-4 text-black"
            />

            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              className="border rounded-xl p-4 text-black"
              required
            />

            <input
              type="text"
              name="phone"
              placeholder="Téléphone"
              value={formData.phone}
              onChange={handleChange}
              className="border rounded-xl p-4 text-black"
              required
            />

            <input
              type="text"
              name="country"
              placeholder="Pays"
              value={formData.country}
              onChange={handleChange}
              className="border rounded-xl p-4 text-black"
            />

            <input
              type="text"
              name="address"
              placeholder="Adresse"
              value={formData.address}
              onChange={handleChange}
              className="border rounded-xl p-4 text-black"
            />

            <input
              type="password"
              name="password"
              placeholder="Mot de passe"
              value={formData.password}
              onChange={handleChange}
              className="border rounded-xl p-4 text-black md:col-span-2"
              required
            />

            <div className="md:col-span-2 rounded-2xl border p-4">
              <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-black">
                    Modules à activer
                  </h2>
                  <p className="text-sm text-gray-500">
                    Le choix des modules ne change pas les limites du plan sélectionné.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedModules(defaultSelectedModules)}
                  className="rounded-xl bg-black px-4 py-2 text-sm font-bold text-white"
                >
                  Tout activer
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {AVAILABLE_MODULES.map((module) => (
                  <label
                    key={module.key}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 font-bold ${
                      selectedModules[module.key] !== false
                        ? "border-yellow-400 bg-yellow-50 text-black"
                        : "border-gray-200 bg-white text-gray-500"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedModules[module.key] !== false}
                      onChange={() => toggleModule(module.key)}
                    />
                    {module.label}
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-4 rounded-xl md:col-span-2"
            >

              {loading
                ? "Chargement..."
                : "Créer une entreprise"}

            </button>

          </form>

        </div>

        {/* RIGHT */}

        <div className="space-y-6">

          {plans.length === 0 && (
            <div className="bg-white rounded-3xl shadow p-6 text-gray-600">
              Chargement des plans...
            </div>
          )}

          {plans.map((plan) => (

            <div
              key={plan.id}
              onClick={() =>
                setSelectedPlan(plan)
              }
              className={`rounded-3xl shadow p-6 cursor-pointer transition border-4 ${
                selectedPlan?.id === plan.id
                  ? "border-yellow-500 bg-yellow-50"
                  : "border-transparent bg-white"
              }`}
            >

              <h2 className="text-2xl font-bold text-black mb-2">
                {plan.name}
              </h2>

              <p className="text-4xl font-bold text-yellow-600 mb-4">
                {formatFCFA(plan.price_monthly)}
              </p>

              <div className="space-y-2 text-gray-600">

                <p>
                  👥 Utilisateurs :
                  {" "}
                  {displayLimit(plan.max_users)}
                </p>

                <p>
                  🏢 Entrepôts :
                  {" "}
                  {displayLimit(plan.max_warehouses)}
                </p>

                <p>
                  📦 Produits :
                  {" "}
                  {displayLimit(plan.max_products)}
                </p>

                <p>
                  🎁 Essai :
                  {" "}
                  {plan.trial_days} jours
                </p>

              </div>

              {selectedPlan?.id === plan.id && (

                <div className="mt-4 bg-yellow-500 text-black text-center py-2 rounded-xl font-bold">
                  Plan sélectionné
                </div>

              )}

            </div>

          ))}

        </div>

      </div>

    </div>

  );

}
