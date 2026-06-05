"use client";

import Link from "next/link";

export default function ClientDashboardPage() {
  return (
    <div className="min-h-screen bg-gray-100 p-4 text-black md:p-8">
      <h1 className="text-4xl font-black">Espace client</h1>
      <p className="mt-2 text-gray-500">Commandes, factures et achats marketplace.</p>
      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
        <Link href="/marketplace" className="rounded-2xl bg-white p-6 font-black shadow">Catalogue</Link>
        <Link href="/marketplace/cart" className="rounded-2xl bg-white p-6 font-black shadow">Panier</Link>
        <Link href="/client/orders" className="rounded-2xl bg-yellow-500 p-6 font-black shadow">Mes commandes</Link>
        <Link href="/client/profile" className="rounded-2xl bg-white p-6 font-black shadow">Mon profil</Link>
      </div>
    </div>
  );
}
