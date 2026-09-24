"use client";

import {
  ChangeEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  authFetch,
} from "../lib/api";

type ItemForm = {
  description: string;
  package_count: string;

  length_cm: string;
  width_cm: string;
  height_cm: string;

  weight_kg: string;
  supplier_reference: string;
  notes: string;

  photos: File[];
};

const createItem = (): ItemForm => ({
  description: "",
  package_count: "1",

  length_cm: "",
  width_cm: "",
  height_cm: "",

  weight_kg: "",
  supplier_reference: "",
  notes: "",

  photos: [],
});

const statusLabels: Record<string, string> = {
  WAITING_DEPART: "En attente de départ",
  LOADED: "Chargé",
  IN_TRANSIT: "En transit",
  ARRIVED_MALI: "Arrivé au Mali",
  AVAILABLE: "Disponible",
  DELIVERED: "Livré",
};

const nextActions: Record<
  string,
  {
    action: string;
    label: string;
  }
> = {
  WAITING_DEPART: {
    action: "LOAD",
    label: "Confirmer chargement",
  },

  LOADED: {
    action: "DEPART",
    label: "Confirmer départ Chine",
  },

  IN_TRANSIT: {
    action: "ARRIVE",
    label: "Confirmer arrivée Mali",
  },

  ARRIVED_MALI: {
    action: "MAKE_AVAILABLE",
    label: "Rendre disponible",
  },

  AVAILABLE: {
    action: "DELIVER",
    label: "Confirmer livraison",
  },
};

function money(value: unknown) {
  return (
    Number(value || 0)
      .toLocaleString("fr-FR") +
    " FCFA"
  );
}

function cbm(item: ItemForm) {
  return (
    Number(item.length_cm || 0) *
    Number(item.width_cm || 0) *
    Number(item.height_cm || 0) *
    Number(item.package_count || 1)
  ) / 1000000;
}

export default function FretChineMaliPage() {
  const [dashboard, setDashboard] =
    useState<any>(null);

  const [customers, setCustomers] =
    useState<any[]>([]);

  const [error, setError] =
    useState("");

  const [info, setInfo] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [customerForm, setCustomerForm] =
    useState({
      full_name: "",
      phone: "",
      whatsapp: "",
    });

  const [receptionForm, setReceptionForm] =
    useState({
      customer_id: "",
      extra_fees: "0",
      amount_paid: "0",
      notes: "",
    });

  const [items, setItems] =
    useState<ItemForm[]>([
      createItem(),
    ]);

  async function loadData() {
    const [
      dashboardResponse,
      customersResponse,
    ] = await Promise.all([
      authFetch(
        "/fret/v2/dashboard",
        {
          cache: "no-store",
        }
      ),

      authFetch(
        "/fret/customers",
        {
          cache: "no-store",
        }
      ),
    ]);

    const dashboardData =
      await dashboardResponse.json();

    const customersData =
      await customersResponse.json();

    if (!dashboardResponse.ok) {
      throw new Error(
        dashboardData.error ||
        "Erreur chargement fret."
      );
    }

    setDashboard(
      dashboardData
    );

    setCustomers(
      Array.isArray(customersData)
        ? customersData
        : []
    );
  }

  useEffect(() => {
    loadData().catch(
      (e: Error) =>
        setError(e.message)
    );
  }, []);

  const rate =
    Number(
      dashboard?.rate
        ?.price_per_unit ||
      245000
    );

  const totalCbm =
    useMemo(
      () =>
        items.reduce(
          (
            total: number,
            item: ItemForm
          ) =>
            total + cbm(item),
          0
        ),
      [items]
    );

  const totalFreight =
    totalCbm * rate;

  function updateItem(
    index: number,
    field: keyof ItemForm,
    value: string | File[]
  ) {
    setItems(
      (current) =>
        current.map(
          (item, i) =>
            i === index
              ? {
                  ...item,
                  [field]:
                    value,
                }
              : item
        )
    );
  }

  function addItem() {
    setItems(
      (current) => [
        ...current,
        createItem(),
      ]
    );
  }

  function removeItem(
    index: number
  ) {
    if (
      items.length <= 1
    ) {
      return;
    }

    setItems(
      (current) =>
        current.filter(
          (_item, i) =>
            i !== index
        )
    );
  }

  function addPhotos(
    index: number,
    event:
      ChangeEvent<HTMLInputElement>
  ) {
    const files =
      Array.from(
        event.target.files || []
      );

    updateItem(
      index,
      "photos",
      [
        ...items[index].photos,
        ...files,
      ].slice(0, 30)
    );

    event.target.value = "";
  }

  function removePhoto(
    itemIndex: number,
    photoIndex: number
  ) {
    updateItem(
      itemIndex,
      "photos",
      items[
        itemIndex
      ].photos.filter(
        (_photo, index) =>
          index !== photoIndex
      )
    );
  }

  async function createCustomer() {
    setBusy(true);
    setError("");
    setInfo("");

    try {
      const response =
        await authFetch(
          "/fret/customers",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                customerForm
              ),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Erreur création client."
        );
      }

      setCustomerForm({
        full_name: "",
        phone: "",
        whatsapp: "",
      });

      await loadData();

      setInfo(
        "Client fret créé."
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Erreur client."
      );
    } finally {
      setBusy(false);
    }
  }

  async function createReception() {
    setBusy(true);
    setError("");
    setInfo("");

    try {
      const response =
        await authFetch(
          "/fret/v2/receptions",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                ...receptionForm,

                items:
                  items.map(
                    (item) => ({
                      description:
                        item.description,

                      package_count:
                        item.package_count,

                      length_cm:
                        item.length_cm,

                      width_cm:
                        item.width_cm,

                      height_cm:
                        item.height_cm,

                      weight_kg:
                        item.weight_kg,

                      supplier_reference:
                        item.supplier_reference,

                      notes:
                        item.notes,
                    })
                  ),
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Erreur création réception."
        );
      }

      for (
        let index = 0;
        index < items.length;
        index++
      ) {
        const item =
          items[index];

        if (!item.photos.length) {
          continue;
        }

        const createdItem =
          data.items[index];

        const formData =
          new FormData();

        item.photos.forEach(
          (photo) => {
            formData.append(
              "photos",
              photo
            );
          }
        );

        const photoResponse =
          await authFetch(
            `/fret/v2/receptions/${data.reception.id}/items/${createdItem.id}/photos`,
            {
              method: "POST",
              body: formData,
            }
          );

        if (!photoResponse.ok) {
          console.warn(
            `Photos ligne ${index + 1} non envoyées`
          );
        }
      }

      setReceptionForm({
        customer_id: "",
        extra_fees: "0",
        amount_paid: "0",
        notes: "",
      });

      setItems([
        createItem(),
      ]);

      await loadData();

      const link =
        `${window.location.origin}${data.public_url}`;

      await navigator.clipboard
        .writeText(link)
        .catch(() => {});

      setInfo(
        `Réception ${data.reception.tracking_code} créée. Lien client copié.`
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Erreur réception."
      );
    } finally {
      setBusy(false);
    }
  }

  async function getDetail(
    id: number
  ) {
    const response =
      await authFetch(
        `/fret/v2/receptions/${id}`,
        {
          cache: "no-store",
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
        "Réception introuvable."
      );
    }

    return data;
  }

  async function copyLink(
    row: any
  ) {
    try {
      const data =
        await getDetail(
          Number(row.id)
        );

      const r =
        data.reception;

      const url =
        `${window.location.origin}/suivi-fret/${encodeURIComponent(
          r.tracking_code
        )}/${encodeURIComponent(
          r.public_token
        )}`;

      await navigator.clipboard
        .writeText(url);

      setInfo(
        "Lien client copié."
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Erreur lien."
      );
    }
  }

  async function advance(
    row: any
  ) {
    const rule =
      nextActions[row.status];

    if (!rule) {
      return;
    }

    if (
      !window.confirm(
        `${rule.label} ?\n\nCette étape ne pourra pas être annulée normalement.`
      )
    ) {
      return;
    }

    const payload:
      Record<string, string> = {
        action: rule.action,
      };

    if (
      rule.action ===
      "DELIVER"
    ) {
      const name =
        window.prompt(
          "Nom de la personne qui retire la marchandise :"
        );

      if (!name) {
        return;
      }

      payload.delivered_to =
        name;

      payload.delivered_phone =
        window.prompt(
          "Téléphone :"
        ) || "";
    }

    const response =
      await authFetch(
        `/fret/v2/receptions/${row.id}/next`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify(
              payload
            ),
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      setError(
        data.error ||
        "Action impossible."
      );

      return;
    }

    await loadData();
  }

  async function printBon(
    row: any
  ) {
    try {
      const data =
        await getDetail(
          Number(row.id)
        );

      const r =
        data.reception;

      const itemRows =
        data.items
          .map(
            (item: any) => `
              <tr>
                <td>${item.line_no}</td>
                <td>
                  <b>${item.item_code}</b><br>
                  ${item.description}
                </td>
                <td>${item.package_count}</td>
                <td>
                  ${item.length_cm} ×
                  ${item.width_cm} ×
                  ${item.height_cm} cm
                </td>
                <td style="text-align:right">
                  ${Number(item.cbm).toFixed(4)}
                </td>
              </tr>
            `
          )
          .join("");

      const trackingLink =
        `${window.location.origin}/suivi-fret/${encodeURIComponent(
          r.tracking_code
        )}/${encodeURIComponent(
          r.public_token
        )}`;

      const popup =
        window.open(
          "",
          "_blank"
        );

      if (!popup) {
        return;
      }

      popup.document.write(`
        <!doctype html>

        <html lang="fr">

        <head>
          <meta charset="UTF-8">

          <title>
            ${r.reception_no}
          </title>

          <style>
            body {
              font-family:
                Arial,
                sans-serif;

              padding: 30px;
              color: #111;
            }

            .header {
              display: flex;
              justify-content: space-between;
              gap: 20px;
              border-bottom: 4px solid #eab308;
              padding-bottom: 18px;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 22px;
            }

            th,
            td {
              border: 1px solid #ccc;
              padding: 8px;
              font-size: 12px;
            }

            th {
              background: #f3f4f6;
            }

            .total {
              text-align: right;
              margin-top: 20px;
              line-height: 1.7;
            }

            .tracking {
              margin-top: 25px;
              border: 2px solid #111;
              padding: 14px;
              word-break: break-all;
            }
          </style>
        </head>

        <body>

          <div class="header">

            <div>
              <h1>
                BON DE RÉCEPTION CHINE
              </h1>

              <b>
                Fret Chine → Mali
              </b>
            </div>

            <div style="text-align:right">
              <b>
                ${r.reception_no}
              </b>

              <br>

              ${r.tracking_code}
            </div>

          </div>

          <p>
            <b>Client :</b>
            ${r.customer_name}

            <br>

            <b>Téléphone :</b>
            ${r.customer_phone || "—"}

            <br>

            <b>Date :</b>
            ${new Date(
              r.received_at
            ).toLocaleString(
              "fr-FR"
            )}
          </p>

          <table>

            <thead>
              <tr>
                <th>#</th>
                <th>Marchandise</th>
                <th>Quantité de colis</th>
                <th>Dimensions</th>
                <th>CBM</th>
              </tr>
            </thead>

            <tbody>
              ${itemRows}
            </tbody>

          </table>

          <div class="total">

            <b>
              CBM total :
            </b>

            ${Number(
              r.total_cbm
            ).toFixed(4)}

            <br>

            Tarif :
            ${money(
              r.rate_per_cbm
            )}
            / CBM

            <br>

            Fret :
            ${money(
              r.freight_amount
            )}

            <br>

            Frais :
            ${money(
              r.extra_fees
            )}

            <br>

            <b>
              TOTAL :
              ${money(
                r.total_amount
              )}
            </b>

            <br>

            Payé :
            ${money(
              r.amount_paid
            )}

            <br>

            <b>
              Reste :
              ${money(
                r.balance
              )}
            </b>

          </div>

          <div class="tracking">

            <b>
              Suivi client :
            </b>

            <br>

            ${trackingLink}

          </div>

          <script>
            window.onload =
              function () {
                setTimeout(
                  function () {
                    window.print();
                  },
                  400
                );
              };
          </script>

        </body>

        </html>
      `);

      popup.document.close();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Erreur bon."
      );
    }
  }

  function exportCsv() {
    const rows =
      dashboard?.receptions || [];

    const content:
      Array<
        Array<
          string |
          number
        >
      > = [
        [
          "Suivi",
          "Client",
          "Statut",
          "Lignes",
          "Colis",
          "CBM",
          "Total",
          "Payé",
          "Reste",
        ],

        ...rows.map(
          (row: any) => [
            row.tracking_code,
            row.customer_name,
            statusLabels[
              row.status
            ] ||
              row.status,
            Number(
              row.item_lines || 0
            ),
            Number(
              row.packages || 0
            ),
            Number(
              row.total_cbm || 0
            ),
            Number(
              row.total_amount || 0
            ),
            Number(
              row.amount_paid || 0
            ),
            Number(
              row.balance || 0
            ),
          ]
        ),
      ];

    const csv =
      content
        .map(
          (
            csvRow:
              Array<
                string |
                number
              >
          ) =>
            csvRow
              .map(
                (
                  value:
                    string |
                    number
                ) =>
                  `"${String(
                    value ?? ""
                  ).replace(
                    /"/g,
                    '""'
                  )}"`
              )
              .join(";")
        )
        .join("\n");

    const blob =
      new Blob(
        [
          "\uFEFF",
          csv,
        ],
        {
          type:
            "text/csv;charset=utf-8",
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href =
      url;

    link.download =
      `etat-fret-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

    link.click();

    URL.revokeObjectURL(
      url
    );
  }

  if (!dashboard) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        Chargement du module Fret…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">

      <div className="mx-auto max-w-7xl space-y-5">

        <div className="flex flex-wrap items-center justify-between gap-3">

          <div>

            <h1 className="text-3xl font-black">
              Fret Chine → Mali
            </h1>

            <p className="text-slate-500">
              Réception multi-colis, photos, suivi sécurisé et documents.
            </p>

          </div>

          <button
            type="button"
            onClick={exportCsv}
            className="rounded-xl bg-emerald-700 px-4 py-3 font-black text-white"
          >
            Télécharger l'état
          </button>

        </div>

        {error && (
          <div className="rounded-xl bg-red-100 p-3 font-bold text-red-700">
            {error}
          </div>
        )}

        {info && (
          <div className="rounded-xl bg-emerald-100 p-3 font-bold text-emerald-800">
            {info}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase text-slate-500">
              Total
            </div>

            <div className="mt-2 text-xl font-black">
              {dashboard.stats?.total || 0}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase text-slate-500">
              Attente
            </div>

            <div className="mt-2 text-xl font-black">
              {dashboard.stats?.attente || 0}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase text-slate-500">
              Chargés
            </div>

            <div className="mt-2 text-xl font-black">
              {dashboard.stats?.charges || 0}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase text-slate-500">
              Transit
            </div>

            <div className="mt-2 text-xl font-black">
              {dashboard.stats?.transit || 0}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase text-slate-500">
              Arrivés Mali
            </div>

            <div className="mt-2 text-xl font-black">
              {dashboard.stats?.arrives || 0}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase text-slate-500">
              Disponibles
            </div>

            <div className="mt-2 text-xl font-black">
              {dashboard.stats?.disponibles || 0}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase text-slate-500">
              Livrés
            </div>

            <div className="mt-2 text-xl font-black">
              {dashboard.stats?.livres || 0}
            </div>
          </div>

        </div>

        <section className="rounded-2xl bg-yellow-50 p-5">

          <div className="text-xl font-black">
            {money(rate)}
            {" / CBM"}
          </div>

          <div className="mt-1 text-sm">
            Délai indicatif :
            {" "}
            {dashboard.rate?.min_transit_days || 45}
            {" à "}
            {dashboard.rate?.max_transit_days || 60}
            {" jours"}
          </div>

          <div className="mt-3 text-sm">
            📍
            {" "}
            {dashboard.settings?.china_warehouse_address ||
              "Entrepôt Chine"}

            {dashboard.settings?.china_entry_number
              ? ` — Entrée ${dashboard.settings.china_entry_number}`
              : ""}
          </div>

        </section>

        <div className="grid gap-5 xl:grid-cols-3">

          <section className="rounded-2xl bg-white p-5 shadow-sm">

            <h2 className="text-xl font-black">
              Nouveau client fret
            </h2>

            <div className="mt-4 grid gap-3">

              <input
                className="rounded-xl border p-3"
                placeholder="Nom du client"
                value={customerForm.full_name}
                onChange={(event) =>
                  setCustomerForm({
                    ...customerForm,
                    full_name:
                      event.target.value,
                  })
                }
              />

              <input
                className="rounded-xl border p-3"
                placeholder="Téléphone"
                value={customerForm.phone}
                onChange={(event) =>
                  setCustomerForm({
                    ...customerForm,
                    phone:
                      event.target.value,
                  })
                }
              />

              <input
                className="rounded-xl border p-3"
                placeholder="WhatsApp"
                value={customerForm.whatsapp}
                onChange={(event) =>
                  setCustomerForm({
                    ...customerForm,
                    whatsapp:
                      event.target.value,
                  })
                }
              />

              <button
                type="button"
                disabled={busy}
                onClick={createCustomer}
                className="rounded-xl bg-black p-3 font-black text-white"
              >
                Créer le client
              </button>

            </div>

          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm xl:col-span-2">

            <div className="flex flex-wrap items-center justify-between gap-3">

              <div>

                <h2 className="text-xl font-black">
                  Nouvelle réception Chine
                </h2>

                <p className="text-sm text-slate-500">
                  Ajoutez plusieurs marchandises ou colis dans la même réception.
                </p>

              </div>

              <button
                type="button"
                onClick={addItem}
                className="rounded-xl bg-yellow-500 px-4 py-3 font-black"
              >
                ＋ Ajouter un colis
              </button>

            </div>

            <select
              className="mt-4 w-full rounded-xl border p-3"
              value={receptionForm.customer_id}
              onChange={(event) =>
                setReceptionForm({
                  ...receptionForm,
                  customer_id:
                    event.target.value,
                })
              }
            >
              <option value="">
                Sélectionner le client
              </option>

              {customers.map(
                (customer: any) => (
                  <option
                    key={customer.id}
                    value={customer.id}
                  >
                    {customer.customer_code}
                    {" — "}
                    {customer.full_name}
                  </option>
                )
              )}

            </select>

            <div className="mt-5 space-y-5">

              {items.map(
                (
                  item,
                  index
                ) => (

                  <article
                    key={index}
                    className="rounded-2xl border-2 border-slate-200 p-4"
                  >

                    <div className="flex items-center justify-between">

                      <h3 className="font-black">
                        Colis / ligne {index + 1}
                      </h3>

                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            removeItem(index)
                          }
                          className="font-bold text-red-600"
                        >
                          Supprimer
                        </button>
                      )}

                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">

                      <input
                        className="rounded-xl border p-3 md:col-span-2"
                        placeholder="Marchandise / description"
                        value={item.description}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "description",
                            event.target.value
                          )
                        }
                      />

                      <input
                        type="number"
                        min="1"
                        className="rounded-xl border p-3"
                        placeholder="Quantité de colis"
                        value={item.package_count}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "package_count",
                            event.target.value
                          )
                        }
                      />

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="rounded-xl border p-3"
                        placeholder="Longueur cm"
                        value={item.length_cm}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "length_cm",
                            event.target.value
                          )
                        }
                      />

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="rounded-xl border p-3"
                        placeholder="Largeur cm"
                        value={item.width_cm}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "width_cm",
                            event.target.value
                          )
                        }
                      />

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="rounded-xl border p-3"
                        placeholder="Hauteur cm"
                        value={item.height_cm}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "height_cm",
                            event.target.value
                          )
                        }
                      />

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="rounded-xl border p-3"
                        placeholder="Poids kg optionnel"
                        value={item.weight_kg}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "weight_kg",
                            event.target.value
                          )
                        }
                      />

                      <input
                        className="rounded-xl border p-3 md:col-span-2"
                        placeholder="Référence fournisseur"
                        value={item.supplier_reference}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "supplier_reference",
                            event.target.value
                          )
                        }
                      />

                      <div className="rounded-xl bg-slate-100 p-3 md:col-span-2">
                        <b>
                          CBM ligne :
                        </b>
                        {" "}
                        {cbm(item).toFixed(4)}
                      </div>

                    </div>

                    <div className="mt-4 rounded-xl border border-dashed border-slate-400 p-4">

                      <div className="font-black">
                        📷 Photos du colis
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">

                        <label className="cursor-pointer rounded-xl bg-black px-4 py-2 font-bold text-white">
                          Ajouter plusieurs photos

                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(event) =>
                              addPhotos(
                                index,
                                event
                              )
                            }
                          />
                        </label>

                        <label className="cursor-pointer rounded-xl bg-yellow-500 px-4 py-2 font-bold">
                          Prendre une photo

                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(event) =>
                              addPhotos(
                                index,
                                event
                              )
                            }
                          />
                        </label>

                      </div>

                      {item.photos.length > 0 && (
                        <div className="mt-4 grid grid-cols-3 gap-2 md:grid-cols-5">

                          {item.photos.map(
                            (
                              photo,
                              photoIndex
                            ) => (

                              <div
                                key={`${photo.name}-${photoIndex}`}
                                className="relative"
                              >

                                <img
                                  src={
                                    URL.createObjectURL(
                                      photo
                                    )
                                  }
                                  alt=""
                                  className="aspect-square w-full rounded-xl object-cover"
                                />

                                <button
                                  type="button"
                                  onClick={() =>
                                    removePhoto(
                                      index,
                                      photoIndex
                                    )
                                  }
                                  className="absolute right-1 top-1 rounded-full bg-red-600 px-2 py-1 text-xs font-black text-white"
                                >
                                  ×
                                </button>

                              </div>
                            )
                          )}

                        </div>
                      )}

                    </div>

                  </article>
                )
              )}

            </div>

            <div className="mt-5 rounded-2xl bg-slate-950 p-5 text-white">

              <div className="grid gap-4 md:grid-cols-3">

                <div>
                  <div className="text-xs uppercase text-slate-400">
                    CBM total
                  </div>

                  <div className="text-2xl font-black">
                    {totalCbm.toFixed(4)}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase text-slate-400">
                    Tarif
                  </div>

                  <div className="text-xl font-black">
                    {money(rate)}
                    {" / CBM"}
                  </div>
                </div>

                <div>
                  <div className="text-xs uppercase text-slate-400">
                    Fret calculé
                  </div>

                  <div className="text-xl font-black">
                    {money(totalFreight)}
                  </div>
                </div>

              </div>

            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">

              <input
                type="number"
                min="0"
                className="rounded-xl border p-3"
                placeholder="Frais supplémentaires"
                value={receptionForm.extra_fees}
                onChange={(event) =>
                  setReceptionForm({
                    ...receptionForm,
                    extra_fees:
                      event.target.value,
                  })
                }
              />

              <input
                type="number"
                min="0"
                className="rounded-xl border p-3"
                placeholder="Montant déjà payé"
                value={receptionForm.amount_paid}
                onChange={(event) =>
                  setReceptionForm({
                    ...receptionForm,
                    amount_paid:
                      event.target.value,
                  })
                }
              />

              <textarea
                className="rounded-xl border p-3 md:col-span-2"
                placeholder="Observation générale"
                value={receptionForm.notes}
                onChange={(event) =>
                  setReceptionForm({
                    ...receptionForm,
                    notes:
                      event.target.value,
                  })
                }
              />

              <button
                type="button"
                disabled={busy}
                onClick={createReception}
                className="rounded-xl bg-yellow-500 p-4 text-lg font-black md:col-span-2"
              >
                Enregistrer réception Chine
              </button>

            </div>

          </section>

        </div>

        <section className="overflow-hidden rounded-2xl bg-white shadow-sm">

          <div className="border-b p-5">

            <h2 className="text-xl font-black">
              Dossiers fret
            </h2>

          </div>

          <div className="overflow-x-auto">

            <table className="min-w-full text-sm">

              <thead className="bg-slate-50">

                <tr>
                  <th className="p-3 text-left">
                    Suivi
                  </th>

                  <th className="p-3 text-left">
                    Client
                  </th>

                  <th className="p-3 text-right">
                    Lignes
                  </th>

                  <th className="p-3 text-right">
                    Quantité de colis
                  </th>

                  <th className="p-3 text-right">
                    CBM
                  </th>

                  <th className="p-3 text-right">
                    Total
                  </th>

                  <th className="p-3 text-right">
                    Reste
                  </th>

                  <th className="p-3 text-left">
                    Statut
                  </th>

                  <th className="p-3 text-left">
                    Actions
                  </th>
                </tr>

              </thead>

              <tbody>

                {(dashboard.receptions || []).map(
                  (row: any) => (

                    <tr
                      key={row.id}
                      className="border-t"
                    >

                      <td className="p-3 font-black">
                        {row.tracking_code}
                      </td>

                      <td className="p-3">
                        {row.customer_name}
                      </td>

                      <td className="p-3 text-right">
                        {row.item_lines}
                      </td>

                      <td className="p-3 text-right">
                        {row.packages}
                      </td>

                      <td className="p-3 text-right">
                        {Number(
                          row.total_cbm
                        ).toFixed(4)}
                      </td>

                      <td className="p-3 text-right">
                        {money(
                          row.total_amount
                        )}
                      </td>

                      <td className="p-3 text-right">
                        {money(
                          row.balance
                        )}
                      </td>

                      <td className="p-3">
                        <span className="rounded-full bg-yellow-100 px-3 py-1 font-bold">
                          {statusLabels[
                            row.status
                          ] ||
                            row.status}
                        </span>
                      </td>

                      <td className="p-3">

                        <div className="flex flex-wrap gap-2">

                          <button
                            type="button"
                            onClick={() =>
                              printBon(row)
                            }
                            className="rounded-lg bg-black px-3 py-2 font-bold text-white"
                          >
                            Bon
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              copyLink(row)
                            }
                            className="rounded-lg bg-blue-600 px-3 py-2 font-bold text-white"
                          >
                            Lien client
                          </button>

                          {nextActions[
                            row.status
                          ] && (
                            <button
                              type="button"
                              onClick={() =>
                                advance(row)
                              }
                              className="rounded-lg bg-yellow-500 px-3 py-2 font-bold"
                            >
                              {
                                nextActions[
                                  row.status
                                ].label
                              }
                            </button>
                          )}

                        </div>

                      </td>

                    </tr>
                  )
                )}

              </tbody>

            </table>

          </div>

        </section>

      </div>

    </main>
  );
}
