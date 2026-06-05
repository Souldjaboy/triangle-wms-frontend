"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiUrl, authFetch, getAuthToken } from "../lib/api";
import { formatFCFA } from "../lib/format";
import MarketplaceHeader from "./MarketplaceHeader";
import {
  Apple,
  Beaker,
  BriefcaseBusiness,
  Building2,
  Car,
  Coffee,
  Footprints,
  Home,
  Hotel,
  Hammer,
  Laptop,
  MonitorSmartphone,
  Pill,
  Search,
  ShoppingCart,
  Shirt,
  Sofa,
  Sparkles,
  Sprout,
  Tv,
  Utensils,
  Wrench,
} from "lucide-react";

const publicCategories = [
  "Produits",
  "Alimentation",
  "Boissons",
  "Pharmacie",
  "Santé / Laboratoire",
  "Téléphones",
  "Informatique",
  "Électronique",
  "Vêtements",
  "Chaussures",
  "Beauté / Cosmétique",
  "Pièces auto",
  "Automobiles",
  "Immobilier",
  "Hôtels",
  "Restaurants",
  "Agriculture",
  "Matériaux construction",
  "Fournitures bureau",
  "Maison / meubles",
  "Services",
];

const categoryIcons: Record<string, any> = {
  Produits: ShoppingCart,
  Alimentation: Apple,
  Boissons: Coffee,
  Pharmacie: Pill,
  "Santé / Laboratoire": Beaker,
  Téléphones: MonitorSmartphone,
  Informatique: Laptop,
  Électronique: Tv,
  Vêtements: Shirt,
  Chaussures: Footprints,
  "Beauté / Cosmétique": Sparkles,
  "Pièces auto": Wrench,
  Automobiles: Car,
  Immobilier: Building2,
  Hôtels: Hotel,
  Restaurants: Utensils,
  Agriculture: Sprout,
  "Matériaux construction": Hammer,
  "Fournitures bureau": BriefcaseBusiness,
  "Maison / meubles": Home,
  Services: Sofa,
};

export default function MarketplacePage() {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [laboratories, setLaboratories] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [vendor, setVendor] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const initialCategory = search.get("category") || "";
    const initialQuery = search.get("q") || "";
    if (initialCategory) setCategory(initialCategory);
    if (initialQuery) setQuery(initialQuery);
  }, []);

  const loadProducts = async (value = query) => {
    if (category === "Santé / Laboratoire") {
      const params = new URLSearchParams();
      if (value) params.set("q", value);
      if (vendor) params.set("city", vendor);
      const response = await fetch(apiUrl(`/laboratories/public?${params.toString()}`));
      const data = await response.json().catch(() => []);
      setLaboratories(Array.isArray(data) ? data : []);
      setProducts([]);
      return;
    }
    const params = new URLSearchParams();
    if (value) params.set("q", value);
    if (category) params.set("category", category);
    if (vendor) params.set("vendor_company_id", vendor);
    if (minPrice) params.set("min_price", minPrice);
    if (maxPrice) params.set("max_price", maxPrice);
    const response = await fetch(apiUrl(`/marketplace/products?${params.toString()}`));
    const data = await response.json().catch(() => []);
    setProducts(Array.isArray(data) ? data : []);
    setLaboratories([]);
  };

  useEffect(() => {
    loadProducts();
  }, [category, vendor, minPrice, maxPrice]);

  const addToCart = async (product: any) => {
    if (!getAuthToken()) {
      router.push("/client/login?redirect=/marketplace");
      return;
    }
    const response = await authFetch("/marketplace/cart/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketplace_product_id: product.id, quantity: 1 }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403) {
      router.push("/client/login?redirect=/marketplace");
      return;
    }
    setMessage(response.ok ? "Produit ajouté au panier." : data.error || "Impossible d’ajouter ce produit au panier. Vérifiez votre connexion client ou utilisez l’espace B2B.");
  };

  return (
    <div className="min-h-screen bg-gray-100 text-black">
      <section className="bg-black px-4 py-8 text-white md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-bold text-yellow-400">Triangle WMS Pro</p>
            <h1 className="mt-2 text-4xl font-black md:text-5xl">Marketplace Mali</h1>
            <p className="mt-3 max-w-2xl text-white/70">
              Produits, services, restaurants, hôtels, automobiles, immobilier et laboratoires publiés par les entreprises Triangle.
            </p>
          </div>
          <MarketplaceHeader />
        </div>
      </section>

      <main className="mx-auto max-w-7xl p-4 md:p-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-black">Catalogue public</h2>
          <p className="text-gray-500">Marketplace clients et entreprises au Mali, reliée uniquement aux produits publiés volontairement.</p>
        </div>
      </div>

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl bg-white p-5 shadow">
          <h2 className="text-xl font-black">Produits publiés</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            Les entreprises choisissent ce qu’elles veulent vendre en ligne. Les données internes de stock restent privées.
          </p>
        </article>
        <article className="rounded-2xl bg-white p-5 shadow">
          <h2 className="text-xl font-black">Achat client ou entreprise</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            Les clients particuliers et les entreprises acheteuses ont des parcours séparés pour éviter toute confusion.
          </p>
        </article>
        <article className="rounded-2xl bg-white p-5 shadow">
          <h2 className="text-xl font-black">Catégories locales</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            Retrouvez produits, pharmacies, laboratoires, restaurants, hôtels, automobile, immobilier, services et logistique.
          </p>
        </article>
      </section>

      {message && <div className="mb-5 rounded-xl bg-yellow-100 p-4 font-bold text-yellow-800">{message}</div>}

      <div className="mb-6 flex flex-wrap gap-3">
        {publicCategories.map((item) => {
          const Icon = categoryIcons[item] || ShoppingCart;
          return (
          <button
            key={item}
            onClick={() => {
              setCategory(item === "Produits" ? "" : item);
              if (item === "Santé / Laboratoire") loadProducts(query);
            }}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-3 font-bold shadow ${
              (item === "Produits" && !category) || category === item
                ? "bg-yellow-500 text-black"
                : "bg-white text-black"
            }`}
          >
            <Icon size={18} />
            {item}
          </button>
          );
        })}
      </div>

      <div className="mb-6 grid gap-3 rounded-2xl bg-white p-4 shadow md:grid-cols-6">
        <div className="relative md:col-span-2">
          <Search className="absolute left-4 top-4 text-gray-400" size={20} />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              loadProducts(event.target.value);
            }}
            placeholder="Rechercher produit, référence, catégorie..."
            className="w-full rounded-xl border p-4 pl-12"
          />
        </div>
        <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Catégorie" className="rounded-xl border p-4" />
        <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder={category === "Santé / Laboratoire" ? "Ville laboratoire" : "ID entreprise"} className="rounded-xl border p-4" />
        <input value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="Prix min" className="rounded-xl border p-4" />
        <input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Prix max" className="rounded-xl border p-4" />
      </div>

      {category === "Santé / Laboratoire" && (
        <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {laboratories.map((lab) => (
            <article key={lab.id} className="rounded-2xl bg-white p-5 shadow">
              {lab.public_image_url || lab.logo_url ? (
                <img src={lab.public_image_url || lab.logo_url} alt={lab.lab_name} className="mb-4 h-40 w-full rounded-xl object-cover" />
              ) : (
                <div className="mb-4 flex h-40 items-center justify-center rounded-xl bg-gray-100 font-bold text-gray-400">Laboratoire</div>
              )}
              <p className="text-sm font-bold text-gray-500">{lab.city || "Ville non renseignée"}</p>
              <h2 className="mt-1 text-xl font-black">{lab.lab_name || lab.company_name}</h2>
              <p className="mt-2 text-sm text-gray-500">{lab.public_description || lab.description || lab.address}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/client/laboratoires/${lab.id}`} className="rounded-xl bg-black px-4 py-3 text-center font-bold text-white">Voir laboratoire</Link>
                <Link href={`/client/laboratoire/rendez-vous?lab=${lab.id}&company=${lab.company_id}`} className="rounded-xl bg-yellow-500 px-4 py-3 font-bold text-black">Rendez-vous</Link>
              </div>
            </article>
          ))}
          {laboratories.length === 0 && <div className="rounded-2xl bg-white p-8 text-center font-bold text-gray-500">Aucun laboratoire publié.</div>}
        </div>
      )}

      {category !== "Santé / Laboratoire" && <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {products.map((product) => (
          <article key={product.id} className="rounded-2xl bg-white p-5 shadow">
            {product.image_url ? (
              <img src={product.image_url} alt={product.title} className="mb-4 h-40 w-full rounded-xl object-cover" />
            ) : (
              <div className="mb-4 flex h-40 items-center justify-center rounded-xl bg-gray-100 font-bold text-gray-400">Image produit</div>
            )}
            <p className="text-sm font-bold text-gray-500">{product.vendor_name || "Vendeur"}</p>
            <h2 className="mt-1 text-xl font-black">{product.title}</h2>
            <p className="mt-2 text-sm text-gray-500">{product.category || product.reference || "-"}</p>
            <p className="mt-3 text-2xl font-black text-green-700">{formatFCFA(product.price)}</p>
            <p className="text-sm text-gray-500">Stock : {Number(product.display_stock || product.stock || 0).toLocaleString("fr-FR")}</p>
            <div className="mt-4 flex gap-2">
              <Link href={`/marketplace/product/${product.id}`} className="flex-1 rounded-xl bg-black px-4 py-3 text-center font-bold text-white">Voir</Link>
              <button onClick={() => addToCart(product)} className="flex-1 rounded-xl bg-yellow-500 px-4 py-3 font-bold text-black">Ajouter</button>
            </div>
          </article>
        ))}
      </div>}

      {category !== "Santé / Laboratoire" && products.length === 0 && <div className="rounded-2xl bg-white p-8 text-center font-bold text-gray-500">Aucun produit publié.</div>}
      </main>
    </div>
  );
}
