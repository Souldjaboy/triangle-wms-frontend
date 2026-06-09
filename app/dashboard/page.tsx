"use client";
import {
  LayoutDashboard,
  Search,
  Bot,
  ShieldCheck,
  QrCode,
  MessageCircle,
  Bell,
  Package,
  Handshake,
  Boxes,
  ClipboardList,
  Warehouse,
  MapPin,
  ScanLine,
  FileText,
  ShoppingCart,
  Calculator,
  BarChart3,
  Car,
  Building2,
  Utensils,
  FlaskConical,
  TriangleAlert,
  Activity,
  Users,
  ClipboardCheck,
  Settings,
  LogOut,
} from "lucide-react";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "../lib/api";
import { isProductModuleEnabled, productConfig, type ProductModule } from "../lib/product-config";
import InstallPWAButton from "../../components/InstallPWAButton";
import TrialBanner from "../../components/TrialBanner";
import WhatsAppSupportButton from "../../components/WhatsAppSupportButton";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function DashboardPage() {
  const router = useRouter();

  const [userData, setUserData] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [companyIdentity, setCompanyIdentity] = useState<any>(null);
  const [statsError, setStatsError] = useState("");
  const [accessMessage, setAccessMessage] = useState("");

  useEffect(() => {
    const access = new URLSearchParams(window.location.search).get("access");
    if (access === "admin") {
      setAccessMessage("Accès refusé : réservé à l’administrateur");
    }
    if (access === "direction") {
      setAccessMessage("Accès refusé : module réservé à la direction");
    }
    if (access === "accounting") {
      setAccessMessage("Accès refusé : module réservé à la comptabilité ou à la direction");
    }
    const module = new URLSearchParams(window.location.search).get("module");
    if (module) {
      setAccessMessage(`Module ${module} désactivé pour cette entreprise.`);
    }

    const storedUser = localStorage.getItem("user");

    if (storedUser) {
      setUserData(JSON.parse(storedUser));
    }
  }, []);

  const fetchStats = async () => {
    try {
      const response = await authFetch("/dashboard-stats", {
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatsError(data.error || "Erreur chargement tableau de bord.");
        setStats({});
        return;
      }

      setStats(data);
    } catch (error) {
      console.error(error);
      setStatsError("Backend inaccessible pour le tableau de bord.");
      setStats({});
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    authFetch("/company-settings/current", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setCompanyIdentity(data || null))
      .catch(() => setCompanyIdentity(null));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    document.cookie = "triangle_token=; path=/; max-age=0";
    document.cookie = "triangle_super_admin=; path=/; max-age=0";
    document.cookie = "triangle_subscription_status=; path=/; max-age=0";
    document.cookie = "triangle_modules=; path=/; max-age=0";
    router.push("/login");
  };

  if (!stats) {
    return (
      <div className="min-h-screen bg-gray-100 p-8 text-black">
        Chargement du tableau de bord...
      </div>
    );
  }

  if (statsError) {
    return (
      <div className="min-h-screen bg-gray-100 p-8 text-black">
        <div className="bg-red-100 text-red-700 p-4 rounded-xl font-bold">
          {statsError}
        </div>
      </div>
    );
  }

  const alertData = [
    { name: "Stock faible", value: stats.stock_faible || 0 },
    { name: "Rupture", value: stats.rupture_stock || 0 },
    { name: "En attente", value: stats.mouvements_attente || 0 },
  ];

  const overviewData = [
    { name: "Produits", value: stats.total_produits || 0 },
    { name: "Stock total", value: stats.total_stock || 0 },
    { name: "Entrepôts", value: stats.total_entrepots || 0 },
    { name: "Emplacements", value: stats.total_emplacements || 0 },
    { name: "Commandes", value: stats.total_commandes || stats.total_orders || 0 },
    { name: "Utilisateurs", value: stats.total_utilisateurs || 0 },
    { name: "Inventaires", value: stats.total_inventaires || 0 },
  ];

  const movementData = (stats.derniers_mouvements || []).map(
    (movement: any, index: number) => ({
      name: `M${index + 1}`,
      quantité: Number(movement.quantity || 0),
    })
  );

  const role = String(userData?.role || "").toLowerCase();
  const isSuperAdmin =
    userData?.is_super_admin === true ||
    userData?.is_super_admin === "true" ||
    userData?.is_super_admin === 1 ||
    role === "super_admin";
  const isAdminLike =
    isSuperAdmin ||
    role === "admin" ||
    role === "super_admin";
  const isWarehouseManager =
    role === "responsable_entrepot" ||
    role === "chef_entrepot" ||
    role === "responsable d'entrepôt";
  const isReadOnlyRole = role === "direction" || role === "client";
  const isDirectionRole = role === "direction" || role === "directeur";
  const isAccountingRole = role === "comptable";
  const canManageWarehouse = isAdminLike || isWarehouseManager;
  const canViewDirectionModules = isAdminLike || isDirectionRole;
  const canViewAccounting = isAdminLike || isDirectionRole || isAccountingRole;
  const canUsePos = isAdminLike || role === "caissier" || role === "vendeur" || role === "direction";
  const modules = userData?.modules || {};
  const productModuleByDashboardKey: Record<string, ProductModule> = {
    ia: "ia",
    marketplace: "marketplace",
    automobile: "automobile",
    immobilier: "immobilier",
    hotel: "immobilier",
    restaurant: "restaurants",
    laboratoire: "laboratoire",
    pos: "pos",
    comptabilite: "comptabilite",
    stock: "stock",
    produits: "stock",
    inventaire: "stock",
    entrepots: "entrepots",
    emplacements: "entrepots",
    pointage: "pointage",
    documents: "documents",
    rapports: "rapports",
    crm: "crm",
    partenaires: "crm",
    utilisateurs: "utilisateurs",
    badges: "badges",
    notifications: "notifications",
    alertes: "notifications",
    chat: "chat",
    activites: "logistique",
  };
  const moduleEnabled = (key: string) => {
    const productModule = productModuleByDashboardKey[key];
    if (productModule && !isProductModuleEnabled(productModule)) return false;
    return modules[key] !== false || isSuperAdmin;
  };
  const displayCompanyName =
    companyIdentity?.company_name ||
    (isSuperAdmin && !userData?.company_id ? "Plateforme globale" : userData?.company_name) ||
    productConfig.name;
  const displayLogoUrl = companyIdentity?.logo_url || "";
  const displayPlanName =
    companyIdentity?.plan_name ||
    (isSuperAdmin && !userData?.company_id ? "Administrateur système" : userData?.plan_name) ||
    "";
  const displaySubscriptionStatus =
    companyIdentity?.subscription_status ||
    (isSuperAdmin && !userData?.company_id ? "Illimité" : userData?.subscription_status) ||
    "";

  return (
    <div className="min-h-screen flex bg-gray-100">
      <aside className="w-64 bg-black text-white p-6 overflow-y-auto">
        <div className="mb-10 flex items-center gap-3">
          {displayLogoUrl ? (
            <img src={displayLogoUrl} alt={displayCompanyName} className="h-12 w-12 rounded-lg bg-white object-contain p-1" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-500 font-black text-black">
              {displayCompanyName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold text-yellow-500 leading-tight">{displayCompanyName}</h1>
            <p className="text-xs text-gray-400">{productConfig.name}</p>
          </div>
        </div>

       <ul className="space-y-3">

  <Link href="/dashboard">
    <li className="bg-yellow-500 text-black p-3 rounded-lg font-semibold cursor-pointer flex items-center gap-3">
      <LayoutDashboard size={20} />
      Tableau de bord
    </li>
  </Link>

  <Link href="/recherche">
    <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
      <Search size={20} />
      Recherche
    </li>
  </Link>

  {moduleEnabled("ia") && (
    <Link href="/assistant">
      <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
        <Bot size={20} />
        Assistant IA
      </li>
    </Link>
  )}

  {isSuperAdmin && (
    <Link href="/super-admin">
      <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
        <ShieldCheck size={20} />
        Super Admin
      </li>
    </Link>
  )}


  {moduleEnabled("chat") && (
    <Link href="/chat">
      <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
        <MessageCircle size={20} />
        Chat interne
      </li>
    </Link>
  )}

  {moduleEnabled("notifications") && (
    <Link href="/notifications">
      <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
        <Bell size={20} />
        Notifications
      </li>
    </Link>
  )}

  {moduleEnabled("produits") && (
    <Link href="/produits">
      <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
        <Package size={20} />
        Produits
      </li>
    </Link>
  )}

  {canManageWarehouse && (moduleEnabled("crm") || moduleEnabled("partenaires")) && (
    <Link href="/partenaires">
      <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
        <Handshake size={20} />
        Partenaires
      </li>
    </Link>
  )}

  {moduleEnabled("stock") && (
    <Link href="/stocks">
      <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
        <Boxes size={20} />
        Stockages
      </li>
    </Link>
  )}

  {moduleEnabled("inventaire") && (
    <Link href="/inventaires">
      <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
        <ClipboardList size={20} />
        Inventaires
      </li>
    </Link>
  )}

  {isAdminLike && (
    <>
      {moduleEnabled("entrepots") && (
        <Link href="/entrepots">
          <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
            <Warehouse size={20} />
            Entrepôts
          </li>
        </Link>
      )}

      {moduleEnabled("emplacements") && (
        <Link href="/emplacements">
          <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
            <MapPin size={20} />
            Emplacements
          </li>
        </Link>
      )}
    </>
  )}

  {moduleEnabled("stock") && (
    <Link href="/scanner">
      <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
        <ScanLine size={20} />
        Scanner QR
      </li>
    </Link>
  )}

  {canUsePos && moduleEnabled("pos") && (
    <Link href="/pos">
      <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
        <ShoppingCart size={20} />
        POS / Caisse
      </li>
    </Link>
  )}

  {moduleEnabled("marketplace") && (
    <Link href="/marketplace">
      <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
        <ShoppingCart size={20} />
        Marketplace
      </li>
    </Link>
  )}

  {moduleEnabled("automobile") && (
    <Link href="/automobile">
      <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
        <Car size={20} />
        Automobile
      </li>
    </Link>
  )}

  {(moduleEnabled("immobilier") || moduleEnabled("hotel")) && (
    <Link href="/immobilier">
      <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
        <Building2 size={20} />
        Immobilier / Hôtel
      </li>
    </Link>
  )}

  {moduleEnabled("restaurant") && (
    <Link href="/restaurant">
      <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
        <Utensils size={20} />
        Restaurant
      </li>
    </Link>
  )}

  {moduleEnabled("laboratoire") && (
    <Link href="/laboratoire">
      <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
        <FlaskConical size={20} />
        Laboratoire
      </li>
    </Link>
  )}

  {canViewAccounting && moduleEnabled("comptabilite") && (
    <Link href="/comptabilite">
      <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
        <Calculator size={20} />
        Comptabilité
      </li>
    </Link>
  )}

  {canViewDirectionModules && (moduleEnabled("documents") || moduleEnabled("rapports")) && (
    <>
      {moduleEnabled("documents") && (
        <Link href="/documents">
          <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
            <FileText size={20} />
            Documents
          </li>
        </Link>
      )}

      {moduleEnabled("rapports") && (
        <Link href="/rapports">
          <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
            <BarChart3 size={20} />
            Rapports
          </li>
        </Link>
      )}

    </>
  )}

  {(canManageWarehouse || isReadOnlyRole) && moduleEnabled("alertes") && (
    <Link href="/alertes">
      <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
        <TriangleAlert size={20} />
        Alertes
      </li>
    </Link>
  )}

  {isAdminLike && (
    <>
      {moduleEnabled("activites") && (
        <Link href="/activites">
          <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
            <Activity size={20} />
            Activités
          </li>
        </Link>
      )}

      {moduleEnabled("utilisateurs") && (
        <Link href="/utilisateurs">
          <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
            <Users size={20} />
            Utilisateurs
          </li>
        </Link>
      )}

      {moduleEnabled("badges") && (
        <Link href="/badges">
          <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
            Badges
          </li>
        </Link>
      )}
    </>
  )}


  {moduleEnabled("pointage") && (
    <Link href="/attendance-scan">
      <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
        <QrCode size={20} />
        Pointage QR
      </li>
    </Link>
  )}

  {moduleEnabled("pointage") && (
    <Link href="/pointage">
      <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
        <ClipboardCheck size={20} />
        Pointage
      </li>
    </Link>
  )}

  {isAdminLike && moduleEnabled("pointage") && (
    <>
      <Link href="/parametres-pointage">
        <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
          <Settings size={20} />
          Paramètres pointage
        </li>
      </Link>

      <Link href="/parametres">
        <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
          <Settings size={20} />
          Paramètres
        </li>
      </Link>
    </>
  )}

  <button
    onClick={handleLogout}
    className="w-full text-left p-3 bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer font-bold text-white mt-8 flex items-center gap-3"
  >
    <LogOut size={20} />
    Déconnexion
  </button>

</ul>
      </aside>

    <main className="flex-1 p-8">
  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <h1 className="text-4xl font-bold text-black">
      Tableau de bord
    </h1>
    <InstallPWAButton />
  </div>

  <TrialBanner user={userData} />

  {accessMessage && (
    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">
      {accessMessage}
    </div>
  )}

  {userData && (
    <div className="bg-white rounded-2xl shadow p-4 mt-4 mb-6">
      <div className="flex flex-wrap gap-6 text-sm text-black">

        <p>
          <span className="font-bold">Entreprise :</span>{" "}
          {displayCompanyName}
        </p>

        <p>
          <span className="font-bold">Plan :</span>{" "}
          {displayPlanName || "Non défini"}
        </p>

        <p>
          <span className="font-bold">Abonnement :</span>{" "}
          <span
            className={
              userData.subscription_status === "active"
                ? "text-green-600 font-bold"
                : displaySubscriptionStatus === "Illimité"
                  ? "text-green-600 font-bold"
                  : "text-red-600 font-bold"
            }
          >
            {displaySubscriptionStatus || "Non défini"}
          </span>
        </p>

        <p>
          <span className="font-bold">Super Admin :</span>{" "}
          {isSuperAdmin ? "Oui" : "Non"}
        </p>

      </div>
    </div>
  )}

  <p className="text-gray-500 mt-2 mb-8">
    Vue globale graphique des opérations logistiques en temps réel.
  </p>

        <div className="grid grid-cols-4 gap-6 mb-8">
          <StatCard title="Produits" value={stats.total_produits} color="text-blue-500" />
          <StatCard title="Stock total" value={stats.total_stock || 0} color="text-yellow-600" />
          <StatCard title="Entrepôts" value={stats.total_entrepots} color="text-green-500" />
          <StatCard title="Emplacements" value={stats.total_emplacements} color="text-purple-500" />
          <StatCard title="Commandes" value={stats.total_commandes || stats.total_orders || 0} color="text-indigo-600" />
        </div>

        <div className="grid grid-cols-4 gap-6 mb-8">
          <StatCard title="Alertes" value={stats.alertes} color="text-red-500" />
          <StatCard title="Utilisateurs" value={stats.total_utilisateurs || 0} color="text-black" />
          <StatCard title="Inventaires" value={stats.total_inventaires || 0} color="text-purple-600" />
          <StatCard title="Stock faible" value={stats.stock_faible} color="text-orange-500" />
          <StatCard title="Rupture stock" value={stats.rupture_stock} color="text-red-600" />
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8">
          <ChartCard title="Vue générale du système">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={overviewData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Répartition des alertes">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={alertData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={80}
                  label
                >
                  {alertData.map((entry, index) => (
                    <Cell key={`cell-${index}`} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8">
          <ChartCard title="Quantités des derniers mouvements">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={movementData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="quantité" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="bg-white p-4 rounded-2xl shadow">
            <h2 className="text-xl font-bold text-black mb-4">
              Derniers mouvements
            </h2>

            {stats.derniers_mouvements.length === 0 ? (
              <p className="text-gray-500">Aucun mouvement récent.</p>
            ) : (
              <div className="space-y-3">
                {stats.derniers_mouvements.map((mouvement: any) => (
                  <div key={mouvement.id} className="border-b pb-2">
                    <p className="font-bold text-black">
                      {mouvement.type} - {mouvement.product_name}
                    </p>

                    <p className="text-sm text-gray-500">
                      Quantité : {mouvement.quantity} | Statut : {mouvement.status}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow">
          <h2 className="text-xl font-bold text-black mb-4">
            Activités récentes
          </h2>

          {stats.activites_recentes.length === 0 ? (
            <p className="text-gray-500">Aucune activité récente.</p>
          ) : (
            <div className="space-y-3">
              {stats.activites_recentes.map((activity: any) => (
                <div key={activity.id} className="border-b pb-2">
                  <p className="font-bold text-black">{activity.action}</p>

                  <p className="text-sm text-gray-500">
                    {activity.user_name} | {activity.module}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <a
          href="/assistant"
          className="fixed bottom-6 right-6 bg-black text-white px-5 py-4 rounded-full shadow-2xl font-bold hover:scale-105 transition z-50"
        >
          🤖 Triangle IA
        </a>
        <div className="fixed bottom-24 right-6 z-50">
          <WhatsAppSupportButton className="shadow-2xl" label="Support" />
        </div>
      </main>
    </div>
  );
}

function StatCard({ title, value, color }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow">
      <p className="text-gray-500">{title}</p>
      <h2 className={`text-3xl font-bold ${color}`}>{value ?? 0}</h2>
    </div>
  );
}

function ChartCard({ title, children }: any) {
  return (
    <div className="bg-white p-4 rounded-2xl shadow">
      <h2 className="text-xl font-bold text-black mb-4">{title}</h2>

      <div className="h-[220px]">{children}</div>
    </div>
  );
}
