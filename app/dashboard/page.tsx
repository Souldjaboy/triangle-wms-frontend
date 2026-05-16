"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  const [stats, setStats] = useState<any>(null);

  const fetchStats = async () => {
    const response = await fetch("http://localhost:5050/dashboard-stats");
    const data = await response.json();
    setStats(data);
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  if (!stats) {
    return (
      <div className="min-h-screen bg-gray-100 p-8 text-black">
        Chargement du tableau de bord...
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

  return (
    <div className="min-h-screen flex bg-gray-100">
      <aside className="w-64 bg-black text-white p-6 overflow-y-auto">
        <h1 className="text-2xl font-bold text-yellow-500">TRIANGLE</h1>
        <p className="text-sm text-gray-400 mb-10">WMS PRO</p>

        <ul className="space-y-3">
          <Link href="/dashboard">
            <li className="bg-yellow-500 text-black p-3 rounded-lg font-semibold cursor-pointer">
              Tableau de bord
            </li>
          </Link>

          <Link href="/recherche">
            <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer">
              Recherche
            </li>
          </Link>

          <Link href="/assistant">
            <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer">
              Assistant IA
            </li>
          </Link>

          <Link href="/chat">
            <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer">
              Chat interne
            </li>
          </Link>

          <Link href="/notifications">
            <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer">
              Notifications
            </li>
          </Link>

          <Link href="/produits">
            <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer">
              Produits
            </li>
          </Link>

          <Link href="/stocks">
            <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer">
              Stocks
            </li>
          </Link>

          <Link href="/inventaires">
            <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer">
              Inventaires
            </li>
          </Link>

          <Link href="/entrepots">
            <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer">
              Entrepôts
            </li>
          </Link>

          <Link href="/emplacements">
            <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer">
              Emplacements
            </li>
          </Link>

          <Link href="/scanner">
            <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer">
              Scanner QR
            </li>
          </Link>

          <Link href="/documents">
            <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer">
              Documents
            </li>
          </Link>

          <Link href="/rapports">
            <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer">
              Rapports
            </li>
          </Link>

          <Link href="/alertes">
            <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer">
              Alertes
            </li>
          </Link>

          <Link href="/activites">
            <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer">
              Activités
            </li>
          </Link>

          <Link href="/utilisateurs">
            <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer">
              Utilisateurs
            </li>
          </Link>

          <Link href="/pointage">
            <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer">
              Pointage
            </li>
          </Link>

          <Link href="/parametres-pointage">
            <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer">
              Paramètres pointage
            </li>
          </Link>

          <Link href="/parametres">
            <li className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer">
              Paramètres
            </li>
          </Link>

          <button
            onClick={handleLogout}
            className="w-full text-left p-3 bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer font-bold text-white mt-8"
          >
            Déconnexion
          </button>
        </ul>
      </aside>

      <main className="flex-1 p-8">
        <h1 className="text-4xl font-bold text-black">Tableau de bord</h1>

        <p className="text-gray-500 mt-2 mb-8">
          Vue globale graphique des opérations logistiques en temps réel.
        </p>

        <div className="grid grid-cols-4 gap-6 mb-8">
          <StatCard title="Produits" value={stats.total_produits} color="text-blue-500" />
          <StatCard title="Entrepôts" value={stats.total_entrepots} color="text-green-500" />
          <StatCard title="Emplacements" value={stats.total_emplacements} color="text-purple-500" />
          <StatCard title="Alertes" value={stats.alertes} color="text-red-500" />
        </div>

        <div className="grid grid-cols-4 gap-6 mb-8">
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