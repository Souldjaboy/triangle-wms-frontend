"use client";

import Link from "next/link";

export default function VendorDashboardPage() {
  return (
    <div className="min-h-screen bg-gray-100 p-4 text-black md:p-8">
      <h1 className="text-4xl font-black">Espace vendeur marketplace</h1>
      <p className="mt-2 text-gray-500">Publiez vos produits et suivez vos commandes reçues.</p>
      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
        <Link href="/vendor/products" className="rounded-2xl bg-yellow-500 p-6 font-black shadow">Produits publiés</Link>
        <Link href="/vendor/orders" className="rounded-2xl bg-white p-6 font-black shadow">Commandes reçues</Link>
        <Link href="/marketplace" className="rounded-2xl bg-black p-6 font-black text-white shadow">Voir marketplace</Link>
      </div>
    </div>
  );
}
