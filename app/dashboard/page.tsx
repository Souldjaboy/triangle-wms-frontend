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
  BarChart3,
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
import { apiUrl } from "../lib/api";
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
  const [statsError, setStatsError] = useState("");

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (storedUser) {
      setUserData(JSON.parse(storedUser));
    }
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch(apiUrl("/dashboard-stats"), {
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

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    document.cookie = "triangle_token=; path=/; max-age=0";
    document.cookie = "triangle_super_admin=; path=/; max-age=0";
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
  const canManageWarehouse = isAdminLike || isWarehouseManager;
  const canViewReports = canManageWarehouse || isReadOnlyRole;
  const canUsePos = isAdminLike || role === "caissier" || role === "vendeur" || role === "direction";

  return (
    <div className="min-h-screen flex bg-gray-100">
      <aside className="w-64 bg-black text-white p-6 overflow-y-auto">
        <h1 className="text-2xl font-bold text-yellow-500">TRIANGLE</h1>
        <p className="text-sm text-gray-400 mb-10">WMS PRO</p>

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

  <Link href="/assistant">
    <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
      <Bot size={20} />
      Assistant IA
    </li>
  </Link>

  {isSuperAdmin && (
    <Link href="/super-admin">
      <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
        <ShieldCheck size={20} />
        Super Admin
      </li>
    </Link>
  )}


  <Link href="/chat">
    <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
      <MessageCircle size={20} />
      Chat interne
    </li>
  </Link>

  <Link href="/notifications">
    <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
      <Bell size={20} />
      Notifications
    </li>
  </Link>

  <Link href="/produits">
    <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
      <Package size={20} />
      Produits
    </li>
  </Link>

  {canManageWarehouse && (
    <Link href="/partenaires">
      <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
        <Handshake size={20} />
        Partenaires
      </li>
    </Link>
  )}

  <Link href="/stocks">
    <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
      <Boxes size={20} />
      Stockages
    </li>
  </Link>

  <Link href="/inventaires">
    <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
      <ClipboardList size={20} />
      Inventaires
    </li>
  </Link>

  {isAdminLike && (
    <>
      <Link href="/entrepots">
        <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
          <Warehouse size={20} />
          Entrepôts
        </li>
      </Link>

      <Link href="/emplacements">
        <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
          <MapPin size={20} />
          Emplacements
        </li>
      </Link>
    </>
  )}

  <Link href="/scanner">
    <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
      <ScanLine size={20} />
      Scanner QR
    </li>
  </Link>

  {canUsePos && (
    <Link href="/pos">
      <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
        <ShoppingCart size={20} />
        POS / Caisse
      </li>
    </Link>
  )}

  {canViewReports && (
    <>
      <Link href="/documents">
        <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
          <FileText size={20} />
          Documents
        </li>
      </Link>

      <Link href="/rapports">
        <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
          <BarChart3 size={20} />
          Rapports
        </li>
      </Link>

      <Link href="/alertes">
        <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
          <TriangleAlert size={20} />
          Alertes
        </li>
      </Link>
    </>
  )}

  {isAdminLike && (
    <>
      <Link href="/activites">
        <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
          <Activity size={20} />
          Activités
        </li>
      </Link>

      <Link href="/utilisateurs">
        <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
          <Users size={20} />
          Utilisateurs
        </li>
      </Link>

      <Link href="/badges">
        <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
          Badges
        </li>
      </Link>
    </>
  )}


  <Link href="/attendance-scan">
    <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
      <QrCode size={20} />
      Pointage QR
    </li>
  </Link>

  <Link href="/pointage">
    <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3">
      <ClipboardCheck size={20} />
      Pointage
    </li>
  </Link>

  {isAdminLike && (
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
  <h1 className="text-4xl font-bold text-black">
    Tableau de bord
  </h1>

  {userData && (
    <div className="bg-white rounded-2xl shadow p-4 mt-4 mb-6">
      <div className="flex flex-wrap gap-6 text-sm text-black">

        <p>
          <span className="font-bold">Entreprise :</span>{" "}
          {userData.company_name || "N/A"}
        </p>

        <p>
          <span className="font-bold">Plan :</span>{" "}
          {userData.plan_name || "N/A"}
        </p>

        <p>
          <span className="font-bold">Abonnement :</span>{" "}
          <span
            className={
              userData.subscription_status === "active"
                ? "text-green-600 font-bold"
                : "text-red-600 font-bold"
            }
          >
            {userData.subscription_status || "N/A"}
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
