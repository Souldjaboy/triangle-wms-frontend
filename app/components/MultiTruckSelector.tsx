"use client";

export type TruckLine = {
  camion_id: string;
  driver_name: string;
  quantity: number | string;
};

type Props = {
  camions: any[];
  quantityTotal: number;
  value: TruckLine[];
  onChange: (rows: TruckLine[]) => void;
};

export default function MultiTruckSelector({
  camions,
  quantityTotal,
  value,
  onChange,
}: Props) {

  const rows =
    value?.length
      ? value
      : [{
          camion_id:"",
          driver_name:"",
          quantity:""
        }];

  const allocated =
    rows.reduce(
      (sum,row) =>
        sum +
        Number(row.quantity || 0),
      0
    );

  const remaining =
    Number(quantityTotal || 0) -
    allocated;

  function change(
    index:number,
    patch:Partial<TruckLine>
  ) {
    const next =
      rows.map(
        (row,i) =>
          i===index
            ? {...row,...patch}
            : row
      );

    onChange(next);
  }

  function chooseTruck(
    index:number,
    id:string
  ) {
    const truck =
      camions.find(
        (x:any) =>
          String(x.id)===String(id)
      );

    change(index,{
      camion_id:id,
      driver_name:
        rows[index]?.driver_name ||
        truck?.chauffeur ||
        ""
    });
  }

  function add() {
    onChange([
      ...rows,
      {
        camion_id:"",
        driver_name:"",
        quantity:""
      }
    ]);
  }

  function remove(index:number) {
    if (rows.length===1) return;

    onChange(
      rows.filter((_,i)=>i!==index)
    );
  }

  const ok =
    Number(quantityTotal)>0 &&
    Math.abs(remaining)<0.001 &&
    rows.every(
      r =>
        Number(r.camion_id)>0 &&
        Number(r.quantity)>0
    );

  return (
    <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">

        <div>
          <h3 className="text-lg font-black text-slate-900">
            🚚 Répartition des camions
          </h3>

          <p className="text-sm text-slate-600">
            Saisissez le volume réellement transporté par chaque camion.
            La quantité totale de la vente et le montant FCFA seront calculés automatiquement.
            Le même camion peut être ajouté plusieurs fois s'il effectue plusieurs rotations.
          </p>
        </div>

        <button
          type="button"
          onClick={add}
          className="rounded-xl bg-slate-900 px-4 py-2 font-bold text-white"
        >
          + Ajouter un camion
        </button>

      </div>

      <div className="space-y-3">

        {rows.map((row,index)=>(

          <div
            key={index}
            className="grid gap-3 rounded-xl border bg-white p-3 md:grid-cols-[1fr_1fr_150px_auto]"
          >

            <select
              value={row.camion_id}
              onChange={e=>
                chooseTruck(
                  index,
                  e.target.value
                )
              }
              className="rounded-lg border p-3 text-slate-900"
            >
              <option value="">
                Choisir camion *
              </option>

              {camions.map((c:any)=>(
                <option
                  key={c.id}
                  value={c.id}
                >
                  {c.code}
                  {c.immatriculation &&
                   c.immatriculation !== c.code
                    ? ` — ${c.immatriculation}`
                    : ""}
                </option>
              ))}
            </select>


            <input
              value={row.driver_name}
              onChange={e=>
                change(index,{
                  driver_name:e.target.value
                })
              }
              placeholder={`Chauffeur camion ${index+1}`}
              className="rounded-lg border p-3 text-slate-900"
            />


            <div>
              <input
                type="number"
                min="0.01"
                step="0.1"
                value={row.quantity}
                onChange={e=>
                  change(index,{
                    quantity:e.target.value
                  })
                }
                placeholder="m³"
                className="w-full rounded-lg border p-3 text-slate-900"
              />

              <div className="mt-1 text-center text-xs font-bold text-slate-500">
                m³ transportés
              </div>
            </div>


            <button
              type="button"
              disabled={rows.length===1}
              onClick={()=>remove(index)}
              className="rounded-lg px-3 font-black text-red-600 disabled:opacity-20"
            >
              ✕
            </button>

          </div>

        ))}

      </div>


      <div
        className={`mt-4 rounded-xl p-3 font-black ${
          ok
            ? "bg-emerald-100 text-emerald-800"
            : "bg-amber-100 text-amber-800"
        }`}
      >
        Vente :
        {" "}
        {Number(quantityTotal || 0).toLocaleString("fr-FR")}
        {" m³"}

        {" — "}

        Affecté aux camions :
        {" "}
        {allocated.toLocaleString("fr-FR")}
        {" m³"}

        {" — "}

        {ok
          ? "✅ Répartition correcte"
          : remaining > 0
            ? `⚠️ Il reste ${remaining.toLocaleString("fr-FR")} m³ à affecter`
            : `⚠️ Dépassement de ${Math.abs(remaining).toLocaleString("fr-FR")} m³`
        }
      </div>

    </div>
  );
}
