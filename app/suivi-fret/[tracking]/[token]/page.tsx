"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  apiUrl,
} from "../../../lib/api";

const labels: Record<string, string> = {
  WAITING_DEPART:
    "En attente de départ",

  LOADED:
    "Chargé",

  IN_TRANSIT:
    "En transit vers le Mali",

  ARRIVED_MALI:
    "Arrivé au Mali",

  AVAILABLE:
    "Disponible au retrait",

  DELIVERED:
    "Livré",
};

function money(value: unknown) {
  return (
    Number(value || 0)
      .toLocaleString("fr-FR") +
    " FCFA"
  );
}

export default function TrackingPage({
  params,
}: {
  params: Promise<{
    tracking: string;
    token: string;
  }>;
}) {
  const [data, setData] =
    useState<any>(null);

  const [error, setError] =
    useState("");

  useEffect(() => {
    params
      .then(
        async ({
          tracking,
          token,
        }) => {
          const response =
            await fetch(
              apiUrl(
                `/public/fret/track/${encodeURIComponent(
                  tracking
                )}/${encodeURIComponent(
                  token
                )}`
              ),
              {
                cache: "no-store",
              }
            );

          const result =
            await response.json();

          if (!response.ok) {
            throw new Error(
              result.error ||
              "Suivi introuvable."
            );
          }

          setData(result);
        }
      )
      .catch(
        (e: Error) =>
          setError(e.message)
      );
  }, [params]);

  if (error) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">

        <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow">

          <div className="text-5xl">
            📦
          </div>

          <h1 className="mt-4 text-2xl font-black">
            Suivi indisponible
          </h1>

          <p className="mt-3 text-red-600">
            {error}
          </p>

        </div>

      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        Chargement du suivi…
      </main>
    );
  }

  const r =
    data.reception;

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">

      <div className="mx-auto max-w-4xl space-y-5">

        <section className="rounded-3xl bg-black p-6 text-white">

          <div className="text-sm font-bold uppercase tracking-widest text-yellow-400">
            Fret Chine → Mali
          </div>

          <h1 className="mt-2 text-3xl font-black">
            Suivi de votre marchandise
          </h1>

          <div className="mt-5 text-xl font-black">
            {r.tracking_code}
          </div>

          <div className="mt-3 inline-block rounded-full bg-yellow-500 px-4 py-2 font-black text-black">
            {labels[r.status] ||
              r.status}
          </div>

        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">

          <div className="grid gap-4 md:grid-cols-3">

            <div>
              <div className="text-xs uppercase text-slate-500">
                Client
              </div>

              <div className="font-black">
                {r.customer_name}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase text-slate-500">
                CBM total
              </div>

              <div className="font-black">
                {Number(
                  r.total_cbm
                ).toFixed(4)}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase text-slate-500">
                Total
              </div>

              <div className="font-black">
                {money(
                  r.total_amount
                )}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase text-slate-500">
                Payé
              </div>

              <div className="font-black">
                {money(
                  r.amount_paid
                )}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase text-slate-500">
                Reste
              </div>

              <div className="font-black">
                {money(
                  r.balance
                )}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase text-slate-500">
                Arrivée estimée
              </div>

              <div className="font-black">
                {r.eta_min
                  ? `${new Date(
                      r.eta_min
                    ).toLocaleDateString(
                      "fr-FR"
                    )} → ${new Date(
                      r.eta_max
                    ).toLocaleDateString(
                      "fr-FR"
                    )}`
                  : "À confirmer"}
              </div>
            </div>

          </div>

        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">

          <h2 className="text-xl font-black">
            Marchandises
          </h2>

          <div className="mt-4 space-y-4">

            {data.items.map(
              (item: any) => (

                <article
                  key={item.id}
                  className="rounded-xl border p-4"
                >

                  <div className="font-black">
                    {item.item_code}
                  </div>

                  <div className="mt-1">
                    {item.description}
                  </div>

                  <div className="mt-2 text-sm text-slate-600">
                    {item.package_count}
                    {" colis · "}
                    {item.length_cm}
                    {" × "}
                    {item.width_cm}
                    {" × "}
                    {item.height_cm}
                    {" cm · "}
                    {Number(
                      item.cbm
                    ).toFixed(4)}
                    {" CBM"}
                  </div>

                  {Array.isArray(
                    item.photos
                  ) &&
                    item.photos.length > 0 && (

                    <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">

                      {item.photos.map(
                        (
                          photo: string,
                          index: number
                        ) => (

                          <a
                            key={`${photo}-${index}`}
                            href={photo}
                            target="_blank"
                            rel="noreferrer"
                          >

                            <img
                              src={photo}
                              alt=""
                              className="aspect-square w-full rounded-xl object-cover"
                            />

                          </a>
                        )
                      )}

                    </div>
                  )}

                </article>
              )
            )}

          </div>

        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">

          <h2 className="text-xl font-black">
            Historique
          </h2>

          <div className="mt-5 space-y-5">

            {data.events.map(
              (
                event: any,
                index: number
              ) => (

                <div
                  key={index}
                  className="flex gap-4"
                >

                  <div className="mt-1 h-4 w-4 shrink-0 rounded-full bg-yellow-500" />

                  <div>

                    <div className="font-black">
                      {event.label}
                    </div>

                    <div className="text-sm text-slate-500">
                      {new Date(
                        event.created_at
                      ).toLocaleString(
                        "fr-FR"
                      )}

                      {event.location_label
                        ? ` · ${event.location_label}`
                        : ""}
                    </div>

                    {event.comment && (
                      <div className="mt-1 text-sm">
                        {event.comment}
                      </div>
                    )}

                  </div>

                </div>
              )
            )}

          </div>

        </section>

        <button
          type="button"
          onClick={() =>
            window.print()
          }
          className="w-full rounded-xl bg-black p-4 font-black text-white print:hidden"
        >
          Télécharger / imprimer
        </button>

      </div>

    </main>
  );
}
