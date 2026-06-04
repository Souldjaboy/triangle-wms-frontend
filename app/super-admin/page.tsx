"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Plus,
  ShieldCheck,
} from "lucide-react";

export default function SuperAdminPage() {

  const router = useRouter();

  const [companies, setCompanies] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [modulesData, setModulesData] = useState<any>({
    module_keys: [],
    companies: [],
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (!token || !storedUser) {
      router.push("/login");
      return;
    }

    try {
      const user = JSON.parse(storedUser);
      const role = String(user?.role || "").toLowerCase();
      const isSuperAdmin =
        user?.is_super_admin === true ||
        user?.is_super_admin === "true" ||
        user?.is_super_admin === 1 ||
        role === "super_admin";

      if (!isSuperAdmin) {
        router.push("/dashboard");
      }
    } catch {
      router.push("/login");
    }
  }, [router]);


  const [message, setMessage] = useState("");

  const [newPlan, setNewPlan] = useState({
    name: "",
    price_monthly: "",
    max_users: "",
    max_warehouses: "",
    max_products: "",
    max_movements_monthly: "",
    trial_days: "",
    modules: "",
  });

  const getHeaders = () => ({
    "Content-Type": "application/json",
    Authorization:
      `Bearer ${localStorage.getItem("token")}`,
  });

  const fetchAll = async (
    showLoading = false
  ) => {

    try {

      if (showLoading) {
        setLoading(true);
      }

      const headers = getHeaders();

      const companiesResponse =
        await fetch(
          "/api/super-admin/companies",
          { headers }
        );

      const usersResponse =
        await fetch(
          "/api/super-admin/users",
          { headers }
        );

      const plansResponse =
        await fetch(
          "/api/super-admin/plans",
          { headers }
        );

      const modulesResponse =
        await fetch(
          "/api/super-admin/modules",
          { headers }
        );

      const companiesData =
        await companiesResponse.json();

      const usersData =
        await usersResponse.json();

      const plansData =
        await plansResponse.json();

      const modulesPayload =
        await modulesResponse.json().catch(() => ({
          module_keys: [],
          companies: [],
        }));

      setCompanies(
        Array.isArray(companiesData)
          ? companiesData
          : []
      );

      setUsers(
        Array.isArray(usersData)
          ? usersData
          : []
      );

      setPlans(
        Array.isArray(plansData)
          ? plansData
          : []
      );

      setModulesData(
        modulesPayload?.module_keys
          ? modulesPayload
          : {
              module_keys: [],
              companies: [],
            }
      );

    } catch (error) {

      console.error(error);

    } finally {

      if (showLoading) {
        setLoading(false);
      }

    }

  };

  useEffect(() => {
    fetchAll(true);
  }, []);

  const updatePlanField = (
    id: number,
    field: string,
    value: any
  ) => {

    setPlans((prev: any[]) =>
      prev.map((plan) =>
        plan.id === id
          ? {
              ...plan,
              [field]: value,
            }
          : plan
      )
    );

  };

  const updatePlan = async (plan: any) => {

    try {

      await fetch(
        `/api/super-admin/plans/${plan.id}`,
        {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify(plan),
        }
      );

      setMessage("Plan SaaS modifié.");

      await fetchAll();

    } catch (error) {

      console.error(error);

    }

  };

  const createPlan = async () => {

    try {

      await fetch(
        "/api/super-admin/plans",
        {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            name: newPlan.name,
            price_monthly:
              Number(newPlan.price_monthly || 0),

            max_users:
              Number(newPlan.max_users || 0),

            max_warehouses:
              Number(newPlan.max_warehouses || 0),

            max_products:
              Number(newPlan.max_products || 0),

            max_movements_monthly:
              Number(
                newPlan.max_movements_monthly || 0
              ),

            trial_days:
              Number(newPlan.trial_days || 15),

            modules:
              newPlan.modules,
          }),
        }
      );

      setMessage("Plan ajouté.");

      setNewPlan({
        name: "",
        price_monthly: "",
        max_users: "",
        max_warehouses: "",
        max_products: "",
        max_movements_monthly: "",
        trial_days: "",
        modules: "",
      });

      await fetchAll();

    } catch (error) {

      console.error(error);

    }

  };

  const deletePlan = async (
    id: number
  ) => {

    if (
      !confirm("Supprimer ce plan ?")
    ) return;

    try {

      await fetch(
        `/api/super-admin/plans/${id}`,
        {
          method: "DELETE",
          headers: getHeaders(),
        }
      );

      setPlans((prev) =>
        prev.filter(
          (plan) => plan.id !== id
        )
      );

      setMessage("Plan supprimé.");

    } catch (error) {

      console.error(error);

    }

  };

  const deleteUser = async (
    id: number
  ) => {

    if (
      !confirm(
        "Supprimer cet utilisateur ?"
      )
    ) return;

    try {

      await fetch(
        `/api/super-admin/users/${id}`,
        {
          method: "DELETE",
          headers: getHeaders(),
        }
      );

      setUsers((prev) =>
        prev.filter(
          (user) => user.id !== id
        )
      );

      setMessage(
        "Utilisateur supprimé."
      );

    } catch (error) {

      console.error(error);

    }

  };

  const resetUserPassword = async (id: number) => {
    if (!confirm("Générer un nouveau mot de passe temporaire pour cet utilisateur ?")) {
      return;
    }

    try {
      const response = await fetch(`/api/users/${id}/reset-password`, {
        method: "POST",
        headers: getHeaders(),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(data.error || "Erreur réinitialisation mot de passe.");
        return;
      }

      setMessage(
        `Mot de passe temporaire pour ${data.user?.email || "utilisateur"} : ${data.temporary_password}`
      );
      await fetchAll(false);
    } catch (error) {
      console.error(error);
      setMessage("Erreur serveur réinitialisation mot de passe.");
    }
  };

  const deleteCompany = async (
    id: number
  ) => {

    if (
      !confirm(
        "Supprimer définitivement cette entreprise ?"
      )
    ) return;

    try {

      await fetch(
        `/api/super-admin/companies/${id}`,
        {
          method: "DELETE",
          headers: getHeaders(),
        }
      );

      setCompanies((prev) =>
        prev.filter(
          (company) =>
            company.id !== id
        )
      );

      setMessage(
        "Entreprise supprimée."
      );

    } catch (error) {

      console.error(error);

    }

  };

  const accessCompany = (company: any) => {
    localStorage.setItem("active_company_id", String(company.id));
    localStorage.setItem("active_company_name", company.name || "");
    setMessage(`Entreprise active : ${company.name}`);
    router.push("/dashboard");
  };

  const changeCompanyStatus = async (
    companyId: number,
    status: string
  ) => {

    try {

      await fetch(
        `/api/super-admin/companies/${companyId}/status`,
        {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify({
            status,
          }),
        }
      );

      setCompanies((prev) =>
        prev.map((company) =>
          company.id === companyId
            ? {
                ...company,
                subscription_status:
                  status,
              }
            : company
        )
      );

      setMessage(
        status === "active"
          ? "Entreprise réactivée."
          : "Entreprise suspendue."
      );

    } catch (error) {

      console.error(error);

    }

  };

  const renewSubscription = async (
    companyId: number
  ) => {

    try {

      await fetch(
        `/api/super-admin/subscriptions/${companyId}/renew`,
        {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify({
            months: 1,
          }),
        }
      );

      setMessage(
        "Abonnement renouvelé."
      );

    } catch (error) {

      console.error(error);

    }

  };

  const giveFreeAccess = async (
    companyId: number
  ) => {

    try {

      await fetch(
        `/api/super-admin/subscriptions/${companyId}/free`,
        {
          method: "PUT",
          headers: getHeaders(),
        }
      );

      setMessage(
        "Accès gratuit accordé."
      );

    } catch (error) {

      console.error(error);

    }

  };

  const updateCompanyModule = async (
    companyId: number,
    moduleKey: string,
    enabled: boolean
  ) => {

    const currentCompany = modulesData.companies.find(
      (company: any) => company.id === companyId
    );

    const modules = {
      ...(currentCompany?.modules || {}),
      [moduleKey]: enabled,
    };

    setModulesData((current: any) => ({
      ...current,
      companies: current.companies.map((company: any) =>
        company.id === companyId
          ? {
              ...company,
              modules,
            }
          : company
      ),
    }));

    await fetch(
      `/api/super-admin/modules/company/${companyId}`,
      {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify({
          modules,
        }),
      }
    );

    setMessage("Modules mis à jour.");

  };

  if (loading) {

    return (
      <div className="p-10 text-black">
        Chargement...
      </div>
    );

  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">

      <div className="flex items-center gap-4 mb-8">

        <ShieldCheck
          size={45}
          className="text-yellow-500"
        />

        <div>

          <h1 className="text-4xl font-bold text-black">
            Super Admin SaaS
          </h1>

          <p className="text-gray-500">
            Gestion complète Triangle WMS Pro
          </p>

        </div>

      </div>

      {message && (

        <div className="bg-green-100 text-green-700 p-4 rounded-xl mb-6 font-bold">
          {message}
        </div>

      )}

      {/* CREATE PLAN */}

      <div className="bg-white rounded-2xl shadow p-6 mb-10">

        <h2 className="text-2xl font-bold text-black mb-6">
          Ajouter un plan SaaS
        </h2>

        <div className="grid grid-cols-4 gap-4">

          <input
            className="border rounded-xl p-3 text-black"
            placeholder="Nom"
            value={newPlan.name}
            onChange={(e) =>
              setNewPlan({
                ...newPlan,
                name: e.target.value,
              })
            }
          />

          <input
            type="number"
            className="border rounded-xl p-3 text-black"
            placeholder="Prix"
            value={newPlan.price_monthly}
            onChange={(e) =>
              setNewPlan({
                ...newPlan,
                price_monthly:
                  e.target.value,
              })
            }
          />

          <input
            type="number"
            className="border rounded-xl p-3 text-black"
            placeholder="Utilisateurs"
            value={newPlan.max_users}
            onChange={(e) =>
              setNewPlan({
                ...newPlan,
                max_users:
                  e.target.value,
              })
            }
          />

          <input
            type="number"
            className="border rounded-xl p-3 text-black"
            placeholder="Entrepôts"
            value={newPlan.max_warehouses}
            onChange={(e) =>
              setNewPlan({
                ...newPlan,
                max_warehouses:
                  e.target.value,
              })
            }
          />

        </div>

        <button
          onClick={createPlan}
          className="mt-6 bg-yellow-500 text-black px-8 py-3 rounded-xl font-bold flex items-center gap-2"
        >

          <Plus size={18} />

          Ajouter le plan

        </button>

      </div>

      {/* COMPANIES */}

      <div className="bg-white rounded-2xl shadow p-6 mb-10 overflow-x-auto">

        <h2 className="text-2xl font-bold text-black mb-6">
          Entreprises
        </h2>

        <table className="w-full">

          <thead className="bg-gray-100">

            <tr>

              <th className="p-4 text-left text-black">
                Nom
              </th>

              <th className="p-4 text-left text-black">
                Statut
              </th>

              <th className="p-4 text-left text-black">
                Actions
              </th>

            </tr>

          </thead>

          <tbody>

            {companies.map((company) => (

              <tr
                key={company.id}
                className="border-t"
              >

                <td className="p-4 text-black font-semibold">
                  {company.name}
                </td>

                <td className="p-4 text-black">
                  {company.subscription_status}
                </td>

                <td className="p-4 flex gap-2 flex-wrap">

                  <button
                    onClick={() =>
                      accessCompany(company)
                    }
                    className="bg-yellow-500 text-black px-3 py-2 rounded-xl font-bold"
                  >
                    Accéder
                  </button>

                  <button
                    onClick={() =>
                      changeCompanyStatus(
                        company.id,
                        "suspended"
                      )
                    }
                    className="bg-orange-500 text-white px-3 py-2 rounded-xl"
                  >
                    Suspendre
                  </button>

                  <button
                    onClick={() =>
                      changeCompanyStatus(
                        company.id,
                        "active"
                      )
                    }
                    className="bg-green-600 text-white px-3 py-2 rounded-xl"
                  >
                    Réactiver
                  </button>

                  <button
                    onClick={() =>
                      renewSubscription(
                        company.id
                      )
                    }
                    className="bg-blue-600 text-white px-3 py-2 rounded-xl"
                  >
                    Renouveler
                  </button>

                  <button
                    onClick={() =>
                      giveFreeAccess(
                        company.id
                      )
                    }
                    className="bg-purple-600 text-white px-3 py-2 rounded-xl"
                  >
                    Gratuit
                  </button>

                  <button
                    onClick={() =>
                      deleteCompany(
                        company.id
                      )
                    }
                    className="bg-red-600 text-white px-3 py-2 rounded-xl"
                  >
                    Supprimer
                  </button>

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

      {/* MODULES */}

      <div className="bg-white rounded-2xl shadow p-6 mb-10 overflow-x-auto">

        <h2 className="text-2xl font-bold text-black mb-2">
          Gestion des modules
        </h2>

        <p className="text-gray-500 mb-6">
          Activation par entreprise : POS, ventes, IA, documents, rapports et autres modules.
        </p>

        <table className="w-full">

          <thead className="bg-gray-100">

            <tr>

              <th className="p-4 text-left text-black">
                Entreprise
              </th>

              {modulesData.module_keys.map((moduleKey: string) => (
                <th key={moduleKey} className="p-4 text-left text-black capitalize">
                  {moduleKey}
                </th>
              ))}

            </tr>

          </thead>

          <tbody>

            {modulesData.companies.map((company: any) => (

              <tr key={company.id} className="border-t">

                <td className="p-4 text-black font-semibold">
                  {company.name}
                </td>

                {modulesData.module_keys.map((moduleKey: string) => (
                  <td key={moduleKey} className="p-4">
                    <input
                      type="checkbox"
                      checked={company.modules?.[moduleKey] !== false}
                      onChange={(e) =>
                        updateCompanyModule(
                          company.id,
                          moduleKey,
                          e.target.checked
                        )
                      }
                    />
                  </td>
                ))}

              </tr>

            ))}

          </tbody>

        </table>

      </div>

      {/* USERS */}

      <div className="bg-white rounded-2xl shadow p-6 mb-10 overflow-x-auto">

        <h2 className="text-2xl font-bold text-black mb-6">
          Utilisateurs
        </h2>

        <table className="w-full">

          <thead className="bg-gray-100">

            <tr>

              <th className="p-4 text-left text-black">
                Nom
              </th>

              <th className="p-4 text-left text-black">
                Email
              </th>

              <th className="p-4 text-left text-black">
                Rôle
              </th>

              <th className="p-4 text-left text-black">
                Action
              </th>

            </tr>

          </thead>

          <tbody>

            {users.map((user) => (

              <tr
                key={user.id}
                className="border-t"
              >

                <td className="p-4 text-black">
                  {user.fullname}
                </td>

                <td className="p-4 text-black">
                  {user.email}
                </td>

                <td className="p-4 text-black">
                  {user.role}
                </td>

                <td className="p-4">
                  <button
                    onClick={() => resetUserPassword(user.id)}
                    className="mr-2 bg-yellow-500 text-black px-4 py-2 rounded-xl font-bold"
                  >
                    Reset MDP
                  </button>

                  <button
                    onClick={() =>
                      deleteUser(
                        user.id
                      )
                    }
                    className="bg-red-600 text-white px-4 py-2 rounded-xl"
                  >
                    Supprimer
                  </button>

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

      {/* PLANS */}

      <div className="bg-white rounded-2xl shadow p-6 overflow-x-auto">

        <h2 className="text-2xl font-bold text-black mb-6">
          Plans SaaS
        </h2>

        <table className="w-full">

          <thead className="bg-gray-100">

            <tr>

              <th className="p-4 text-left text-black">
                Nom
              </th>

              <th className="p-4 text-left text-black">
                Prix
              </th>

              <th className="p-4 text-left text-black">
                Utilisateurs
              </th>

              <th className="p-4 text-left text-black">
                Actions
              </th>

            </tr>

          </thead>

          <tbody>

            {plans.map((plan) => (

              <tr
                key={plan.id}
                className="border-t"
              >

                <td className="p-4">

                  <input
                    value={plan.name}
                    onChange={(e) =>
                      updatePlanField(
                        plan.id,
                        "name",
                        e.target.value
                      )
                    }
                    className="border rounded-lg p-2 text-black"
                  />

                </td>

                <td className="p-4">

                  <input
                    type="number"
                    value={plan.price_monthly}
                    onChange={(e) =>
                      updatePlanField(
                        plan.id,
                        "price_monthly",
                        e.target.value
                      )
                    }
                    className="border rounded-lg p-2 text-black"
                  />

                </td>

                <td className="p-4">

                  <input
                    type="number"
                    value={plan.max_users}
                    onChange={(e) =>
                      updatePlanField(
                        plan.id,
                        "max_users",
                        e.target.value
                      )
                    }
                    className="border rounded-lg p-2 text-black"
                  />

                </td>

                <td className="p-4 flex gap-2">

                  <button
                    onClick={() =>
                      updatePlan(plan)
                    }
                    className="bg-blue-600 text-white px-4 py-2 rounded-xl"
                  >
                    Modifier
                  </button>

                  <button
                    onClick={() =>
                      deletePlan(
                        plan.id
                      )
                    }
                    className="bg-red-600 text-white px-4 py-2 rounded-xl"
                  >
                    Supprimer
                  </button>

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>
  );
}
