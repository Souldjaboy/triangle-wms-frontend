"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isRouteAvailable, productConfig } from "../app/lib/product-config";

export default function ProductAvailabilityGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (!pathname || isRouteAvailable(pathname)) {
    return <>{children}</>;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-4 text-black">
      <section className="w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-2xl">
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl font-black text-white"
          style={{ backgroundColor: productConfig.theme.primary }}
        >
          {productConfig.name.slice(0, 1)}
        </div>
        <p className="mt-6 text-sm font-black uppercase tracking-wide text-gray-500">{productConfig.name}</p>
        <h1 className="mt-3 text-3xl font-black">Module non disponible sur cette version</h1>
        <p className="mt-3 text-gray-600">
          Cette route existe dans le projet, mais elle est masquée pour la marque actuellement active.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/" className="rounded-xl bg-yellow-500 px-5 py-3 font-black text-black">
            Accueil
          </Link>
          <Link href="/login" className="rounded-xl bg-black px-5 py-3 font-black text-white">
            Connexion
          </Link>
        </div>
      </section>
    </main>
  );
}
