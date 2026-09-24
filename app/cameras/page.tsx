"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  authFetch,
} from "../lib/api";

export default function CamerasPage() {
  const [sites,setSites] = useState<any[]>([]);
  const [channels,setChannels] = useState<any[]>([]);
  const [selected,setSelected] = useState<any>(null);
  const [error,setError] = useState("");

  const [form,setForm] = useState({
    name:"",
    location_label:"",
    recorder_type:"DVR",
    recorder_model:"XVR2104",
    recorder_app:"TSEYE",
    channel_count:"4",
    lan_ip:"",
    http_port:"",
    rtsp_port:"",
    onvif_port:"",
    notes:"",
  });

  const loadSites = async () => {
    const r = await authFetch(
      "/cameras/sites",
      {cache:"no-store"}
    );

    const d = await r.json();

    if (!r.ok) {
      throw new Error(d.error || "Erreur caméras");
    }

    setSites(Array.isArray(d) ? d : []);
  };

  useEffect(() => {
    loadSites().catch(e => setError(e.message));
  },[]);

  const createSite = async () => {
    setError("");

    const r = await authFetch(
      "/cameras/sites",
      {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(form),
      }
    );

    const d = await r.json();

    if (!r.ok) {
      setError(d.error || "Erreur création site.");
      return;
    }

    setForm({
      ...form,
      name:"",
      location_label:"",
      lan_ip:"",
      http_port:"",
      rtsp_port:"",
      onvif_port:"",
      notes:"",
    });

    await loadSites();
  };

  const openSite = async (site:any) => {
    setSelected(site);

    const r = await authFetch(
      `/cameras/sites/${site.id}/channels`,
      {cache:"no-store"}
    );

    const d = await r.json();

    if (!r.ok) {
      setError(d.error || "Erreur caméras.");
      return;
    }

    setChannels(Array.isArray(d) ? d : []);
  };

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white md:p-6">

      <div className="mx-auto max-w-7xl space-y-5">

        <div>
          <h1 className="text-3xl font-black">
            Centre de vidéosurveillance
          </h1>

          <p className="text-slate-400">
            Caméras des entrepôts Triangle / FAT & MAT.
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-red-950 p-3 font-bold text-red-200">
            {error}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-3">

          <section className="rounded-2xl bg-slate-900 p-5">

            <h2 className="text-xl font-black">
              Ajouter un entrepôt / DVR
            </h2>

            <div className="mt-4 grid gap-3">

              <input
                className="rounded-xl border border-slate-700 bg-slate-950 p-3"
                placeholder="Nom de l'entrepôt"
                value={form.name}
                onChange={e => setForm({
                  ...form,
                  name:e.target.value,
                })}
              />

              <input
                className="rounded-xl border border-slate-700 bg-slate-950 p-3"
                placeholder="Quartier / emplacement"
                value={form.location_label}
                onChange={e => setForm({
                  ...form,
                  location_label:e.target.value,
                })}
              />

              <div className="grid grid-cols-2 gap-2">

                <input
                  className="rounded-xl border border-slate-700 bg-slate-950 p-3"
                  placeholder="Modèle DVR"
                  value={form.recorder_model}
                  onChange={e => setForm({
                    ...form,
                    recorder_model:e.target.value,
                  })}
                />

                <input
                  className="rounded-xl border border-slate-700 bg-slate-950 p-3"
                  placeholder="Application"
                  value={form.recorder_app}
                  onChange={e => setForm({
                    ...form,
                    recorder_app:e.target.value,
                  })}
                />
              </div>

              <input
                className="rounded-xl border border-slate-700 bg-slate-950 p-3"
                type="number"
                placeholder="Nombre caméras"
                value={form.channel_count}
                onChange={e => setForm({
                  ...form,
                  channel_count:e.target.value,
                })}
              />

              <input
                className="rounded-xl border border-slate-700 bg-slate-950 p-3"
                placeholder="IP locale DVR"
                value={form.lan_ip}
                onChange={e => setForm({
                  ...form,
                  lan_ip:e.target.value,
                })}
              />

              <div className="grid grid-cols-3 gap-2">
                <input
                  className="rounded-xl border border-slate-700 bg-slate-950 p-3"
                  placeholder="HTTP"
                  value={form.http_port}
                  onChange={e => setForm({
                    ...form,
                    http_port:e.target.value,
                  })}
                />

                <input
                  className="rounded-xl border border-slate-700 bg-slate-950 p-3"
                  placeholder="RTSP"
                  value={form.rtsp_port}
                  onChange={e => setForm({
                    ...form,
                    rtsp_port:e.target.value,
                  })}
                />

                <input
                  className="rounded-xl border border-slate-700 bg-slate-950 p-3"
                  placeholder="ONVIF"
                  value={form.onvif_port}
                  onChange={e => setForm({
                    ...form,
                    onvif_port:e.target.value,
                  })}
                />
              </div>

              <button
                onClick={createSite}
                className="rounded-xl bg-yellow-500 p-3 font-black text-black"
              >
                ➕ Ajouter le site
              </button>

            </div>
          </section>


          <section className="rounded-2xl bg-slate-900 p-5">

            <h2 className="text-xl font-black">
              Entrepôts
            </h2>

            <div className="mt-4 space-y-3">
              {sites.map(site => (
                <button
                  key={site.id}
                  onClick={() => openSite(site)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-4 text-left"
                >
                  <div className="font-black">
                    🏭 {site.name}
                  </div>

                  <div className="mt-1 text-sm text-slate-400">
                    {site.location_label || "Emplacement non défini"}
                  </div>

                  <div className="mt-2 text-xs">
                    {site.recorder_model || site.recorder_type}
                    {" · "}
                    {site.cameras || site.channel_count} caméra(s)
                  </div>

                  <div className="mt-2">
                    <span className="rounded-full bg-yellow-900 px-2 py-1 text-xs">
                      {site.status}
                    </span>
                  </div>
                </button>
              ))}

              {!sites.length && (
                <div className="text-sm text-slate-400">
                  Aucun site configuré.
                </div>
              )}
            </div>
          </section>


          <section className="rounded-2xl bg-slate-900 p-5 lg:col-span-1">

            <h2 className="text-xl font-black">
              Configuration
            </h2>

            {selected ? (
              <div className="mt-4 text-sm text-slate-300">
                <div>
                  <strong>Site :</strong> {selected.name}
                </div>

                <div className="mt-2">
                  <strong>DVR :</strong> {selected.recorder_model}
                </div>

                <div className="mt-2">
                  <strong>Application :</strong> {selected.recorder_app}
                </div>

                <div className="mt-2">
                  <strong>IP LAN :</strong> {selected.lan_ip || "À configurer"}
                </div>

                <div className="mt-4 rounded-xl bg-slate-950 p-3 text-yellow-300">
                  🔐 Aucun mot de passe caméra n'est stocké dans le navigateur.
                </div>
              </div>
            ) : (
              <div className="mt-4 text-sm text-slate-400">
                Sélectionnez un entrepôt.
              </div>
            )}
          </section>

        </div>


        {selected && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-black">
                🎥 {selected.name}
              </h2>

              <div className="text-sm text-slate-400">
                {channels.length} canal(aux)
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

              {channels.map(channel => (
                <div
                  key={channel.id}
                  className="overflow-hidden rounded-2xl border border-slate-800 bg-black"
                >
                  <div className="aspect-video flex items-center justify-center bg-slate-950">

                    {channel.stream_url &&
                     ["HLS","WEBRTC","HTTP"].includes(
                       String(channel.stream_type)
                     )
                      ? (
                        <div className="text-center">
                          <div className="text-4xl">🎥</div>
                          <a
                            href={channel.stream_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 block text-sm text-blue-400 underline"
                          >
                            Ouvrir le flux configuré
                          </a>
                        </div>
                      )
                      : (
                        <div className="text-center text-slate-500">
                          <div className="text-5xl">
                            📹
                          </div>

                          <div className="mt-2 text-sm">
                            Flux non configuré
                          </div>
                        </div>
                      )}
                  </div>

                  <div className="p-3">
                    <div className="font-black">
                      {channel.name}
                    </div>

                    <div className="text-xs text-slate-400">
                      Canal {channel.channel_number}
                      {channel.zone_label
                        ? ` · ${channel.zone_label}`
                        : ""}
                    </div>
                  </div>
                </div>
              ))}

            </div>
          </section>
        )}

      </div>
    </main>
  );
}
