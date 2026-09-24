"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  authFetch,
} from "../../lib/api";


type DocType =
  | "FACTURE"
  | "BON DE LIVRAISON"
  | "PROFORMA";


const MODELS = [
  {
    id: "model1",
    name: "Corporate",
    subtitle: "Classique et professionnel",
  },
  {
    id: "model2",
    name: "Minimal",
    subtitle: "Sobre et très lisible",
  },
  {
    id: "model3",
    name: "Industrie",
    subtitle: "Logistique et opérations",
  },
  {
    id: "model4",
    name: "Premium",
    subtitle: "Élégant et exécutif",
  },
  {
    id: "model5",
    name: "Signature",
    subtitle: "Moderne et distinctif",
  },
];


const DEFAULT_CONFIG:any = {
  primary_color:"#0B2D5B",
  secondary_color:"#1769AA",
  accent_color:"#E8F1FA",

  font_family:"Arial",
  title_size:28,
  body_size:11,

  logo_size:95,
  logo_position:"left",
  density:"normal",

  logo_url:"",
  company_name_override:"",
  slogan_override:"",
  header_text:"",
  footer_text:"",

  whatsapp:"",
  nif:"",
  rccm:"",

  show_address:true,
  show_phone:true,
  show_email:true,
  show_website:true,
  show_slogan:true,
  show_signature:true,

  show_tax:false,
  tax_rate:18,

  client_label:"Informations Client",
  description_label:"Description",
  total_label:"Total",
};


export default function DocumentSettingsPage() {

  const [company,setCompany] =
    useState<any>({});

  const [templateId,setTemplateId] =
    useState("model1");

  const [config,setConfig] =
    useState<any>(DEFAULT_CONFIG);

  const [docType,setDocType] =
    useState<DocType>("FACTURE");

  const [message,setMessage] =
    useState("");

  const [error,setError] =
    useState("");

  const [saving,setSaving] =
    useState(false);

  const [uploading,setUploading] =
    useState(false);


  async function load() {
    setError("");

    const [companyRes,designRes] =
      await Promise.all([
        authFetch(
          "/company-settings/current"
        ),
        authFetch(
          "/document-design/current"
        ),
      ]);

    const c =
      await companyRes
        .json()
        .catch(()=>({}));

    const d =
      await designRes
        .json()
        .catch(()=>({}));

    if (!companyRes.ok) {
      setError(
        c.error ||
        "Erreur identité entreprise."
      );
      return;
    }

    if (!designRes.ok) {
      setError(
        d.error ||
        "Erreur paramètres documents."
      );
      return;
    }

    setCompany(c);

    setTemplateId(
      d.template_id || "model1"
    );

    setConfig({
      ...DEFAULT_CONFIG,
      ...(d.config || {}),
    });
  }


  useEffect(()=>{
    load();
  },[]);


  function update(
    key:string,
    value:any
  ) {
    setConfig((old:any)=>({
      ...old,
      [key]:value,
    }));
  }


  async function save() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const r =
        await authFetch(
          "/document-design/current",
          {
            method:"PUT",
            headers:{
              "Content-Type":
                "application/json",
            },
            body:JSON.stringify({
              template_id:templateId,
              config,
            }),
          }
        );

      const d =
        await r.json().catch(()=>({}));

      if (!r.ok) {
        setError(
          d.error ||
          "Erreur enregistrement."
        );
        return;
      }

      setConfig({
        ...DEFAULT_CONFIG,
        ...(d.config || config),
      });

      setMessage(
        "Modèle enregistré pour cette entreprise."
      );
    } finally {
      setSaving(false);
    }
  }


  async function uploadLogo(
    e:React.ChangeEvent<HTMLInputElement>
  ) {
    const file=e.target.files?.[0];

    if (!file) return;

    setUploading(true);
    setError("");

    try {
      const fd=new FormData();
      fd.append("logo",file);

      const r=
        await authFetch(
          "/upload-logo",
          {
            method:"POST",
            body:fd,
          }
        );

      const d=
        await r.json().catch(()=>({}));

      if (!r.ok) {
        setError(
          d.error ||
          "Erreur upload logo."
        );
        return;
      }

      update(
        "logo_url",
        d.logo_url || ""
      );

      setMessage(
        "Logo chargé. Enregistre le modèle pour le conserver."
      );
    } finally {
      setUploading(false);
    }
  }


  function resetDesign() {
    const fatmat =
      Number(company?.company_id)===5;

    setTemplateId(
      fatmat
        ? "model4"
        : "model1"
    );

    setConfig({
      ...DEFAULT_CONFIG,

      primary_color:
        fatmat
          ? "#171717"
          : "#0B2D5B",

      secondary_color:
        fatmat
          ? "#B58A4B"
          : "#1769AA",

      accent_color:
        fatmat
          ? "#F3EBDD"
          : "#E8F1FA",

      font_family:
        fatmat
          ? "Georgia"
          : "Arial",
    });
  }


  const logo =
    config.logo_url ||
    company.logo_url ||
    "";


  const companyName =
    config.company_name_override ||
    company.company_name ||
    "Entreprise";


  const slogan =
    config.slogan_override ||
    company.slogan ||
    "";


  const densityPadding =
    config.density==="compact"
      ? 8
      : config.density==="airy"
        ? 16
        : 12;


  const modelStyle =
    useMemo(()=>{

      if (templateId==="model2") {
        return {
          borderRadius:0,
          shadow:"none",
        };
      }

      if (templateId==="model3") {
        return {
          borderRadius:6,
          shadow:
            "0 8px 30px rgba(0,0,0,.10)",
        };
      }

      if (templateId==="model4") {
        return {
          borderRadius:2,
          shadow:
            "0 12px 35px rgba(0,0,0,.14)",
        };
      }

      if (templateId==="model5") {
        return {
          borderRadius:10,
          shadow:
            "0 10px 35px rgba(0,0,0,.12)",
        };
      }

      return {
        borderRadius:4,
        shadow:
          "0 8px 25px rgba(0,0,0,.08)",
      };
    },[templateId]);


  const total=1850000;
  const tax=
    config.show_tax
      ? total * Number(
          config.tax_rate || 0
        ) / 100
      : 0;


  return (
    <div
      className="min-h-screen bg-gray-100 p-4 md:p-8"
    >
      <div
        className="mx-auto max-w-[1600px]"
      >
        <div
          className="mb-6 flex flex-wrap items-center justify-between gap-4"
        >
          <div>
            <a
              href="/parametres"
              className="text-sm font-bold text-gray-500"
            >
              ← Paramètres
            </a>

            <h1
              className="mt-2 text-3xl font-black text-black md:text-4xl"
            >
              Documents & PDF
            </h1>

            <p
              className="mt-1 text-gray-500"
            >
              {companyName}
            </p>
          </div>

          <div
            className="flex gap-3"
          >
            <button
              type="button"
              onClick={resetDesign}
              className="rounded-xl border bg-white px-4 py-3 font-bold text-black"
            >
              Réinitialiser
            </button>

            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-xl bg-black px-5 py-3 font-black text-white disabled:opacity-50"
            >
              {saving
                ? "Enregistrement…"
                : "Utiliser ce modèle"}
            </button>
          </div>
        </div>


        {message && (
          <div
            className="mb-5 rounded-xl bg-green-100 p-4 font-bold text-green-800"
          >
            {message}
          </div>
        )}

        {error && (
          <div
            className="mb-5 rounded-xl bg-red-100 p-4 font-bold text-red-800"
          >
            {error}
          </div>
        )}


        <section
          className="mb-6 rounded-2xl bg-white p-5 shadow"
        >
          <h2
            className="mb-4 text-xl font-black text-black"
          >
            Choisir parmi les 5 modèles
          </h2>

          <div
            className="grid gap-3 md:grid-cols-5"
          >
            {MODELS.map((m,i)=>(
              <button
                key={m.id}
                type="button"
                onClick={()=>
                  setTemplateId(m.id)
                }
                className={`rounded-2xl border-2 p-4 text-left transition ${
                  templateId===m.id
                    ? "border-black bg-gray-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div
                  className="mb-3 flex h-20 overflow-hidden rounded-lg border bg-white"
                >
                  <div
                    className="w-1/4"
                    style={{
                      background:
                        i===3
                          ? config.secondary_color
                          : config.primary_color,
                    }}
                  />

                  <div
                    className="flex-1 p-2"
                  >
                    <div
                      className="h-2 w-2/3 rounded"
                      style={{
                        background:
                          config.primary_color,
                      }}
                    />
                    <div
                      className="mt-2 h-1 w-full bg-gray-200"
                    />
                    <div
                      className="mt-2 h-1 w-4/5 bg-gray-200"
                    />
                    <div
                      className="mt-2 h-1 w-full bg-gray-200"
                    />
                  </div>
                </div>

                <div
                  className="font-black text-black"
                >
                  Modèle {i+1}
                </div>

                <div
                  className="text-sm font-semibold text-gray-700"
                >
                  {m.name}
                </div>

                <div
                  className="mt-1 text-xs text-gray-500"
                >
                  {m.subtitle}
                </div>
              </button>
            ))}
          </div>
        </section>


        <div
          className="grid gap-6 xl:grid-cols-[430px_1fr]"
        >

          {/* EDITEUR */}
          <div
            className="space-y-5"
          >

            <Panel title="Identité & en-tête">

              <Field label="Nom affiché sur les documents">
                <input
                  value={
                    config.company_name_override
                  }
                  onChange={e=>
                    update(
                      "company_name_override",
                      e.target.value
                    )
                  }
                  placeholder={
                    company.company_name ||
                    "Nom entreprise"
                  }
                  className="input"
                />
              </Field>

              <Field label="Slogan personnalisé">
                <input
                  value={
                    config.slogan_override
                  }
                  onChange={e=>
                    update(
                      "slogan_override",
                      e.target.value
                    )
                  }
                  placeholder={
                    company.slogan ||
                    "Slogan"
                  }
                  className="input"
                />
              </Field>

              <Field label="Texte supplémentaire de l'en-tête">
                <textarea
                  value={
                    config.header_text
                  }
                  onChange={e=>
                    update(
                      "header_text",
                      e.target.value
                    )
                  }
                  rows={3}
                  className="input"
                  placeholder="Ex. Transport • Logistique • Transit"
                />
              </Field>

              <Field label="Logo propre aux documents">
                <input
                  type="file"
                  accept="image/*"
                  onChange={uploadLogo}
                  className="input"
                />

                {uploading && (
                  <div
                    className="mt-2 text-sm font-bold text-blue-600"
                  >
                    Upload…
                  </div>
                )}

                {config.logo_url && (
                  <button
                    type="button"
                    onClick={()=>
                      update(
                        "logo_url",
                        ""
                      )
                    }
                    className="mt-2 text-sm font-bold text-red-600"
                  >
                    Utiliser à nouveau le logo général
                  </button>
                )}
              </Field>

              <Field label={`Taille logo : ${config.logo_size}px`}>
                <input
                  type="range"
                  min={40}
                  max={180}
                  value={config.logo_size}
                  onChange={e=>
                    update(
                      "logo_size",
                      Number(e.target.value)
                    )
                  }
                  className="w-full"
                />
              </Field>

              <Field label="Position du logo">
                <select
                  value={
                    config.logo_position
                  }
                  onChange={e=>
                    update(
                      "logo_position",
                      e.target.value
                    )
                  }
                  className="input"
                >
                  <option value="left">
                    Gauche
                  </option>
                  <option value="center">
                    Centre
                  </option>
                  <option value="right">
                    Droite
                  </option>
                </select>
              </Field>

            </Panel>


            <Panel title="Couleurs">

              <ColorField
                label="Couleur principale"
                value={
                  config.primary_color
                }
                onChange={v=>
                  update(
                    "primary_color",
                    v
                  )
                }
              />

              <ColorField
                label="Couleur secondaire"
                value={
                  config.secondary_color
                }
                onChange={v=>
                  update(
                    "secondary_color",
                    v
                  )
                }
              />

              <ColorField
                label="Couleur d'accent"
                value={
                  config.accent_color
                }
                onChange={v=>
                  update(
                    "accent_color",
                    v
                  )
                }
              />

            </Panel>


            <Panel title="Typographie">

              <Field label="Police">
                <select
                  value={
                    config.font_family
                  }
                  onChange={e=>
                    update(
                      "font_family",
                      e.target.value
                    )
                  }
                  className="input"
                >
                  <option>Arial</option>
                  <option>Georgia</option>
                  <option>
                    Times New Roman
                  </option>
                  <option>Verdana</option>
                  <option>
                    Trebuchet MS
                  </option>
                </select>
              </Field>

              <Field
                label={`Titre : ${config.title_size}px`}
              >
                <input
                  type="range"
                  min={18}
                  max={42}
                  value={
                    config.title_size
                  }
                  onChange={e=>
                    update(
                      "title_size",
                      Number(
                        e.target.value
                      )
                    )
                  }
                  className="w-full"
                />
              </Field>

              <Field
                label={`Texte : ${config.body_size}px`}
              >
                <input
                  type="range"
                  min={8}
                  max={18}
                  value={
                    config.body_size
                  }
                  onChange={e=>
                    update(
                      "body_size",
                      Number(
                        e.target.value
                      )
                    )
                  }
                  className="w-full"
                />
              </Field>

              <Field label="Espacement">
                <select
                  value={config.density}
                  onChange={e=>
                    update(
                      "density",
                      e.target.value
                    )
                  }
                  className="input"
                >
                  <option value="compact">
                    Compact
                  </option>
                  <option value="normal">
                    Normal
                  </option>
                  <option value="airy">
                    Aéré
                  </option>
                </select>
              </Field>

            </Panel>


            <Panel title="Coordonnées complémentaires">

              <Field label="WhatsApp">
                <input
                  className="input"
                  value={config.whatsapp}
                  onChange={e=>
                    update(
                      "whatsapp",
                      e.target.value
                    )
                  }
                  placeholder="+223 ..."
                />
              </Field>

              <Field label="NIF">
                <input
                  className="input"
                  value={config.nif}
                  onChange={e=>
                    update(
                      "nif",
                      e.target.value
                    )
                  }
                />
              </Field>

              <Field label="RCCM">
                <input
                  className="input"
                  value={config.rccm}
                  onChange={e=>
                    update(
                      "rccm",
                      e.target.value
                    )
                  }
                />
              </Field>

            </Panel>


            <Panel title="Informations visibles">

              <Toggle
                label="Adresse"
                checked={
                  config.show_address
                }
                onChange={v=>
                  update(
                    "show_address",
                    v
                  )
                }
              />

              <Toggle
                label="Téléphone"
                checked={
                  config.show_phone
                }
                onChange={v=>
                  update(
                    "show_phone",
                    v
                  )
                }
              />

              <Toggle
                label="E-mail"
                checked={
                  config.show_email
                }
                onChange={v=>
                  update(
                    "show_email",
                    v
                  )
                }
              />

              <Toggle
                label="Site web"
                checked={
                  config.show_website
                }
                onChange={v=>
                  update(
                    "show_website",
                    v
                  )
                }
              />

              <Toggle
                label="Slogan"
                checked={
                  config.show_slogan
                }
                onChange={v=>
                  update(
                    "show_slogan",
                    v
                  )
                }
              />

              <Toggle
                label="Zone de signature"
                checked={
                  config.show_signature
                }
                onChange={v=>
                  update(
                    "show_signature",
                    v
                  )
                }
              />

              <div
                className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4"
              >
                <label
                  className="flex items-center justify-between gap-3"
                >
                  <div>
                    <div
                      className="font-bold text-gray-500"
                    >
                      TVA
                    </div>
                    <div
                      className="text-xs text-gray-400"
                    >
                      Préparée, mais non activable tant que le calcul fiscal n'est pas activé dans le logiciel.
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={false}
                    disabled
                  />
                </label>
              </div>

            </Panel>


            <Panel title="Libellés">

              <Field label="Bloc client">
                <input
                  className="input"
                  value={
                    config.client_label
                  }
                  onChange={e=>
                    update(
                      "client_label",
                      e.target.value
                    )
                  }
                />
              </Field>

              <Field label="Description">
                <input
                  className="input"
                  value={
                    config.description_label
                  }
                  onChange={e=>
                    update(
                      "description_label",
                      e.target.value
                    )
                  }
                />
              </Field>

              <Field label="Total">
                <input
                  className="input"
                  value={
                    config.total_label
                  }
                  onChange={e=>
                    update(
                      "total_label",
                      e.target.value
                    )
                  }
                />
              </Field>

            </Panel>


            <Panel title="Pied de page">

              <Field label="Texte personnalisé">
                <textarea
                  rows={4}
                  className="input"
                  value={
                    config.footer_text
                  }
                  onChange={e=>
                    update(
                      "footer_text",
                      e.target.value
                    )
                  }
                  placeholder="Merci pour votre confiance • Vos marchandises, notre engagement..."
                />
              </Field>

            </Panel>

          </div>


          {/* APERCU */}
          <div>
            <div
              className="sticky top-4"
            >
              <div
                className="mb-4 flex flex-wrap gap-2 rounded-2xl bg-white p-3 shadow"
              >
                {(
                  [
                    "FACTURE",
                    "BON DE LIVRAISON",
                    "PROFORMA",
                  ] as DocType[]
                ).map(t=>(
                  <button
                    key={t}
                    type="button"
                    onClick={()=>
                      setDocType(t)
                    }
                    className={`rounded-xl px-4 py-2 font-bold ${
                      docType===t
                        ? "bg-black text-white"
                        : "bg-gray-100 text-black"
                    }`}
                  >
                    {t==="BON DE LIVRAISON"
                      ? "BL"
                      : t}
                  </button>
                ))}

                <div
                  className="ml-auto flex items-center px-3 text-sm font-bold text-gray-500"
                >
                  Aperçu avant sélection
                </div>
              </div>


              <div
                className="overflow-auto rounded-2xl bg-gray-300 p-4 md:p-8"
              >
                <div
                  className="mx-auto min-h-[1120px] w-[790px] max-w-full bg-white"
                  style={{
                    fontFamily:
                      config.font_family,
                    fontSize:
                      `${config.body_size}px`,
                    borderRadius:
                      modelStyle.borderRadius,
                    boxShadow:
                      modelStyle.shadow,
                  }}
                >

                  <header
                    style={{
                      padding:
                        densityPadding + 10,
                      borderTop:
                        templateId==="model4"
                          ? `15px solid ${config.primary_color}`
                          : undefined,
                      borderBottom:
                        `3px solid ${config.primary_color}`,
                      background:
                        templateId==="model5"
                          ? `linear-gradient(115deg, white 0 68%, ${config.accent_color} 68%)`
                          : "white",
                    }}
                  >

                    <div
                      style={{
                        display:"flex",
                        flexDirection:
                          config.logo_position==="right"
                            ? "row-reverse"
                            : "row",
                        justifyContent:
                          config.logo_position==="center"
                            ? "center"
                            : "space-between",
                        alignItems:"flex-start",
                        gap:20,
                      }}
                    >

                      <div
                        style={{
                          display:"flex",
                          flexDirection:
                            config.logo_position==="center"
                              ? "column"
                              : "row",
                          alignItems:
                            config.logo_position==="center"
                              ? "center"
                              : "flex-start",
                          gap:16,
                        }}
                      >

                        {logo && (
                          <img
                            src={logo}
                            alt=""
                            style={{
                              width:
                                config.logo_size,
                              height:
                                config.logo_size,
                              objectFit:"contain",
                            }}
                          />
                        )}

                        <div>
                          <div
                            style={{
                              fontWeight:900,
                              fontSize:22,
                              color:
                                config.primary_color,
                            }}
                          >
                            {companyName}
                          </div>

                          {config.show_slogan && slogan && (
                            <div
                              style={{
                                marginTop:3,
                                color:"#555",
                              }}
                            >
                              {slogan}
                            </div>
                          )}

                          {config.header_text && (
                            <div
                              style={{
                                marginTop:8,
                                whiteSpace:"pre-line",
                                color:"#555",
                              }}
                            >
                              {config.header_text}
                            </div>
                          )}
                        </div>
                      </div>


                      <div
                        style={{
                          textAlign:"right",
                        }}
                      >
                        <div
                          style={{
                            fontSize:
                              config.title_size,
                            fontWeight:900,
                            color:
                              config.primary_color,
                          }}
                        >
                          {docType}
                        </div>

                        <div
                          style={{
                            fontWeight:700,
                            marginTop:5,
                          }}
                        >
                          {docType==="FACTURE"
                            ? "FAC-260904-002"
                            : docType==="PROFORMA"
                              ? "PRO-260904-001"
                              : "BL-260904-002"}
                        </div>

                        <div>
                          04/09/2026
                        </div>
                      </div>

                    </div>


                    <div
                      style={{
                        marginTop:14,
                        display:"flex",
                        flexWrap:"wrap",
                        gap:"4px 18px",
                        color:"#555",
                      }}
                    >

                      {config.show_address &&
                        company.address && (
                        <span>
                          {company.address}
                        </span>
                      )}

                      {config.show_phone &&
                        company.phone && (
                        <span>
                          Tél : {company.phone}
                        </span>
                      )}

                      {config.show_email &&
                        company.email && (
                        <span>
                          {company.email}
                        </span>
                      )}

                      {config.show_website &&
                        company.website && (
                        <span>
                          {company.website}
                        </span>
                      )}

                      {config.whatsapp && (
                        <span>
                          WhatsApp :
                          {" "}
                          {config.whatsapp}
                        </span>
                      )}

                      {config.nif && (
                        <span>
                          NIF :
                          {" "}
                          {config.nif}
                        </span>
                      )}

                      {config.rccm && (
                        <span>
                          RCCM :
                          {" "}
                          {config.rccm}
                        </span>
                      )}

                    </div>
                  </header>


                  <main
                    style={{
                      padding:
                        densityPadding + 16,
                    }}
                  >

                    <section
                      style={{
                        display:"grid",
                        gridTemplateColumns:
                          "1fr 1fr",
                        gap:16,
                        marginBottom:20,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight:900,
                            color:
                              config.primary_color,
                            marginBottom:8,
                          }}
                        >
                          {config.client_label}
                        </div>

                        <div>
                          Nom : EM2S
                        </div>
                        <div>
                          Adresse : Bamako
                        </div>
                        <div>
                          Contact : —
                        </div>
                      </div>

                      <div>
                        <div
                          style={{
                            fontWeight:900,
                            color:
                              config.primary_color,
                            marginBottom:8,
                          }}
                        >
                          Informations
                        </div>

                        {docType==="BON DE LIVRAISON" ? (
                          <>
                            <div>
                              Camion : CH 0578
                            </div>
                            <div>
                              Chauffeur : —
                            </div>
                            <div>
                              Destination : Bamako
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              Référence : EM2S
                            </div>
                            <div>
                              Mode : Dépôt client
                            </div>
                            <div>
                              Site : Bamako
                            </div>
                          </>
                        )}
                      </div>
                    </section>


                    <table
                      style={{
                        width:"100%",
                        borderCollapse:"collapse",
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            background:
                              config.primary_color,
                            color:"white",
                          }}
                        >
                          <th style={cell}>
                            Référence
                          </th>

                          <th style={cell}>
                            Quantité
                          </th>

                          <th style={cell}>
                            {config.description_label}
                          </th>

                          {docType!=="BON DE LIVRAISON" && (
                            <>
                              <th style={cell}>
                                Prix unitaire
                              </th>
                              <th style={cell}>
                                Montant
                              </th>
                            </>
                          )}
                        </tr>
                      </thead>

                      <tbody>
                        <tr>
                          <td style={cell}>
                            SAB-001
                          </td>
                          <td style={cell}>
                            10 m³
                          </td>
                          <td style={cell}>
                            Vente de sable
                          </td>

                          {docType!=="BON DE LIVRAISON" && (
                            <>
                              <td style={cell}>
                                185 000
                              </td>
                              <td style={cell}>
                                1 850 000
                              </td>
                            </>
                          )}
                        </tr>

                        {Array.from({
                          length:8,
                        }).map((_,i)=>(
                          <tr key={i}>
                            <td
                              style={{
                                ...cell,
                                height:34,
                                background:
                                  i%2
                                    ? config.accent_color
                                    : "white",
                              }}
                            />
                            <td
                              style={{
                                ...cell,
                                background:
                                  i%2
                                    ? config.accent_color
                                    : "white",
                              }}
                            />
                            <td
                              style={{
                                ...cell,
                                background:
                                  i%2
                                    ? config.accent_color
                                    : "white",
                              }}
                            />

                            {docType!=="BON DE LIVRAISON" && (
                              <>
                                <td
                                  style={{
                                    ...cell,
                                    background:
                                      i%2
                                        ? config.accent_color
                                        : "white",
                                  }}
                                />
                                <td
                                  style={{
                                    ...cell,
                                    background:
                                      i%2
                                        ? config.accent_color
                                        : "white",
                                  }}
                                />
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>


                    {docType!=="BON DE LIVRAISON" && (
                      <div
                        style={{
                          marginTop:22,
                          marginLeft:"auto",
                          width:260,
                        }}
                      >
                        <TotalRow
                          label="Sous-total"
                          value="1 850 000"
                          color={
                            config.primary_color
                          }
                        />

                        {config.show_tax && (
                          <TotalRow
                            label={`TVA ${config.tax_rate}%`}
                            value={
                              Math.round(tax)
                                .toLocaleString(
                                  "fr-FR"
                                )
                            }
                            color={
                              config.primary_color
                            }
                          />
                        )}

                        <TotalRow
                          label={
                            config.total_label
                          }
                          value={
                            Math.round(
                              total + tax
                            ).toLocaleString(
                              "fr-FR"
                            )
                          }
                          color={
                            config.primary_color
                          }
                          strong
                        />
                      </div>
                    )}


                    {config.show_signature && (
                      <div
                        style={{
                          marginTop:80,
                          display:"flex",
                          justifyContent:
                            "space-between",
                          gap:50,
                        }}
                      >
                        <div
                          style={{
                            width:220,
                            borderTop:
                              "1px solid #333",
                            paddingTop:7,
                            textAlign:"center",
                          }}
                        >
                          Cachet & Signature
                        </div>

                        {docType==="BON DE LIVRAISON" && (
                          <div
                            style={{
                              width:220,
                              borderTop:
                                "1px solid #333",
                              paddingTop:7,
                              textAlign:"center",
                            }}
                          >
                            Reçu conforme
                          </div>
                        )}
                      </div>
                    )}

                  </main>


                  <footer
                    style={{
                      marginTop:40,
                      padding:
                        densityPadding + 4,
                      background:
                        config.primary_color,
                      color:"white",
                      minHeight:55,
                      display:"flex",
                      justifyContent:
                        "space-between",
                      gap:20,
                    }}
                  >
                    <div
                      style={{
                        whiteSpace:
                          "pre-line",
                      }}
                    >
                      {config.footer_text ||
                        "Merci pour votre confiance."}
                    </div>

                    <strong>
                      {companyName}
                    </strong>
                  </footer>

                </div>
              </div>
            </div>
          </div>

        </div>
      </div>


      <style jsx global>{`
        .input {
          width: 100%;
          border: 1px solid #d1d5db;
          border-radius: 0.75rem;
          padding: 0.75rem;
          color: #111827;
          background: white;
        }
      `}</style>
    </div>
  );
}


const cell:React.CSSProperties = {
  border:"1px solid #d1d5db",
  padding:9,
  textAlign:"left",
};


function Panel({
  title,
  children,
}:{
  title:string;
  children:React.ReactNode;
}) {
  return (
    <section
      className="rounded-2xl bg-white p-5 shadow"
    >
      <h2
        className="mb-4 text-xl font-black text-black"
      >
        {title}
      </h2>

      <div
        className="space-y-4"
      >
        {children}
      </div>
    </section>
  );
}


function Field({
  label,
  children,
}:{
  label:string;
  children:React.ReactNode;
}) {
  return (
    <label
      className="block"
    >
      <span
        className="mb-1 block text-sm font-bold text-gray-700"
      >
        {label}
      </span>

      {children}
    </label>
  );
}


function Toggle({
  label,
  checked,
  onChange,
}:{
  label:string;
  checked:boolean;
  onChange:(v:boolean)=>void;
}) {
  return (
    <label
      className="flex items-center justify-between rounded-xl border p-3"
    >
      <span
        className="font-bold text-black"
      >
        {label}
      </span>

      <input
        type="checkbox"
        checked={checked}
        onChange={e=>
          onChange(
            e.target.checked
          )
        }
        className="h-5 w-5"
      />
    </label>
  );
}


function ColorField({
  label,
  value,
  onChange,
}:{
  label:string;
  value:string;
  onChange:(v:string)=>void;
}) {
  return (
    <Field label={label}>
      <div
        className="flex gap-3"
      >
        <input
          type="color"
          value={value}
          onChange={e=>
            onChange(
              e.target.value
            )
          }
          className="h-12 w-16 rounded border"
        />

        <input
          value={value}
          onChange={e=>
            onChange(
              e.target.value
            )
          }
          className="input"
        />
      </div>
    </Field>
  );
}


function TotalRow({
  label,
  value,
  color,
  strong=false,
}:{
  label:string;
  value:string;
  color:string;
  strong?:boolean;
}) {
  return (
    <div
      style={{
        display:"grid",
        gridTemplateColumns:
          "1fr 1fr",
        border:
          "1px solid #aaa",
        borderTop:0,
        fontWeight:
          strong
            ? 900
            : 600,
      }}
    >
      <div
        style={{
          padding:8,
          background:
            strong
              ? color
              : "#f3f4f6",
          color:
            strong
              ? "white"
              : "black",
        }}
      >
        {label}
      </div>

      <div
        style={{
          padding:8,
          textAlign:"right",
        }}
      >
        {value}
      </div>
    </div>
  );
}
