"use client";

import { useEffect, useState } from "react";
import { authFetch } from "../../lib/api";
import { formatFCFA } from "../../lib/format";

export default function SuperAdminMarketplacePage() {
  const [overview, setOverview] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      authFetch("/super-admin/marketplace").then((r) => r.json()),
      authFetch("/super-admin/marketplace/orders").then((r) => r.json()),
      authFetch("/super-admin/marketplace/vendors").then((r) => r.json()),
      authFetch("/super-admin/marketplace/customers").then((r) => r.json()),
    ]).then(([overviewData, ordersData, vendorsData, customersData]) => {
      setOverview(overviewData);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setVendors(Array.isArray(vendorsData) ? vendorsData : []);
      setCustomers(Array.isArray(customersData) ? customersData : []);
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-4 text-black md:p-8">
      <h1 className="text-4xl font-black">Super Admin Marketplace</h1>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card title="Produits" value={overview?.products?.total || 0} />
        <Card title="Commandes" value={overview?.orders?.total || 0} />
        <Card title="Vendeurs" value={overview?.vendors?.total || 0} />
        <Card title="Montant" value={formatFCFA(overview?.orders?.amount || 0)} />
      </div>
      <section className="mt-8 rounded-2xl bg-white p-5 shadow">
        <h2 className="mb-4 text-2xl font-black">Dernières commandes</h2>
        <div className="space-y-2">
          {orders.slice(0, 20).map((order) => (
            <div key={order.id} className="flex justify-between rounded-xl bg-gray-50 p-3">
              <span>{order.order_number} - {order.status}</span>
              <strong>{formatFCFA(order.total_amount)}</strong>
            </div>
          ))}
        </div>
      </section>
      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-5 shadow">
          <h2 className="mb-4 text-2xl font-black">Vendeurs</h2>
          {vendors.map((vendor) => <p key={vendor.id} className="border-b py-2">{vendor.name} - {vendor.products_count || 0} produits</p>)}
        </section>
        <section className="rounded-2xl bg-white p-5 shadow">
          <h2 className="mb-4 text-2xl font-black">Clients</h2>
          {customers.map((customer) => <p key={customer.id} className="border-b py-2">{customer.full_name || customer.email || customer.phone}</p>)}
        </section>
      </div>
    </div>
  );
}

function Card({ title, value }: any) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow">
      <p className="text-sm font-bold text-gray-500">{title}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}
