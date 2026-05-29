"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "../lib/api";

const DEFAULT_PLANS = [
  {
    id: 1,
    name: "Starter",
    price_monthly: 5000,
    max_users: 3,
    max_warehouses: 1,
    max_products: 200,
    trial_days: 15,
  },
  {
    id: 2,
    name: "Standard",
    price_monthly: 10000,
    max_users: 10,
    max_warehouses: 3,
    max_products: 1000,
    trial_days: 15,
  },
  {
    id: 3,
    name: "Premium",
    price_monthly: 15000,
    max_users: "Illimité",
    max_warehouses: "Illimité",
    max_products: "Illimité",
    trial_days: 15,
  },
];

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
      address: "",
      password: "",
    });

  const fetchPlans = async () => {

    try {

      const response = await fetch(apiUrl("/public/plans"));

      const data =
        await response.json();

      const availablePlans =
        Array.isArray(data) && data.length > 0
          ? data
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
            }),
          }
        );

      const registerData =
        await registerResponse.json().catch(() => ({
          error: "Réponse serveur invalide."
        }));

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

    <div className="min-h-screen bg-gray-100 p-8">

      <div className="max-w-7xl mx-auto grid grid-cols-3 gap-8">

        {/* LEFT */}

        <div className="col-span-2 bg-white rounded-3xl shadow p-10">

          <h1 className="text-4xl font-bold text-black mb-2">
            Créer votre entreprise
          </h1>

          <p className="text-gray-500 mb-10">
            Triangle WMS Pro SaaS
          </p>

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
            className="grid grid-cols-2 gap-6"
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
              className="border rounded-xl p-4 text-black col-span-2"
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-4 rounded-xl col-span-2"
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
                {Number(
                  plan.price_monthly || 0
                ).toLocaleString()} FCFA
              </p>

              <div className="space-y-2 text-gray-600">

                <p>
                  👥 Utilisateurs :
                  {" "}
                  {plan.max_users}
                </p>

                <p>
                  🏢 Entrepôts :
                  {" "}
                  {plan.max_warehouses}
                </p>

                <p>
                  📦 Produits :
                  {" "}
                  {plan.max_products}
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
