"use client";

/**
 * AVANCES SUR SALAIRE.
 *
 * L'écran met le SOLDE au premier plan, jamais le montant initial : c'est le
 * solde qui décide de ce qu'on peut encore retenir ou rembourser. Une avance
 * de 25 000 déjà remboursée de 20 000 n'affiche pas « 25 000 » en gros, elle
 * affiche « reste 5 000 ».
 *
 * Les termes sont ceux de la conversation : Argent versé, Reste à rembourser,
 * En attente du directeur.
 */

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "../../lib/api";
import { usePermissions } from "../../lib/permissions";

type Avance = {
  id: number; reference: string; status: string;
  amount_requested: string; amount_authorized: string | null;
  amount_paid: string; balance: string; installment_amount: string;
  first_period_code: string; reason: string;
  employee_id: number; full_name: string; employee_number: number;
};
type Echeance = { rank: number; period_code: string; amount_due: string; amount_taken: string; status: string };
type Mouvement = {
  id: number; amount: string; origin: string; balance_before: string; balance_after: string;
  reference: string; reason: string; performed_by_name: string; created_at: string;
  reverses_repayment_id: number | null;
};
type Portee = "self" | "all";

const STATUTS: Record<string, { texte: string; classe: string }> = {
  BROUILLON:        { texte: "Brouillon",                classe: "bg-slate-200 text-slate-800" },
  DEMANDEE:         { texte: "En attente du directeur",  classe: "bg-amber-100 text-amber-900" },
  VALIDEE:          { texte: "Validée, à verser",        classe: "bg-blue-100 text-blue-900" },
  REFUSEE:          { texte: "Refusée",                  classe: "bg-red-100 text-red-900" },
  VERSEE:           { texte: "Versée",                   classe: "bg-emerald-100 text-emerald-900" },
  EN_REMBOURSEMENT: { texte: "En remboursement",         classe: "bg-blue-100 text-blue-900" },
  REMBOURSEE:       { texte: "Remboursée",               classe: "bg-emerald-600 text-white" },
  ANNULEE:          { texte: "Annulée",                  classe: "bg-slate-200 text-slate-600" },
};

const ORIGINES: Record<string, string> = {
  RETENUE_PAIE: "Retenue sur paie",
  VERSEMENT_DIRECT: "Versement au comptoir",
  CONTREPASSATION: "Contrepassation",
};

const fcfa = (v: unknown) =>
  v === null || v === undefined || v === "" ? "—"
    : `${Math.round(Number(v)).toLocaleString("fr-FR")} FCFA`;

export default function AvancesPage() {
  const { can } = usePermissions();
  const peutCreer = can("paie.avance", "create");
  const peutValider = can("paie.avance", "validate");
  const peutPayer = can("paie.avance", "pay");
  const peutModifier = can("paie.avance", "update");
  const peutAnnuler = can("paie.avance", "cancel");

  const [avances, setAvances] = useState<Avance[]>([]);
  const [portee, setPortee] = useState<Portee | null>(null);
  const [monEmploye, setMonEmploye] = useState<any>(null);
  const [employes, setEmployes] = useState<any[]>([]);
  const [comptes, setComptes] = useState<{ banques: any[]; caisses: any[] }>({ banques: [], caisses: [] });
  const [fiche, setFiche] = useState<{ avance: Avance; echeancier: Echeance[]; mouvements: Mouvement[] } | null>(null);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);

  const [nouvelle, setNouvelle] = useState({ employee_id: "", amount_requested: "", installment_amount: "", reason: "" });

  const charger = useCallback(async () => {
    const ra = await authFetch("/avances", { cache: "no-store" });
    const da = await ra.json().catch(() => ({}));
    if (!ra.ok) { setErreur(da.error || "Impossible de charger les avances."); return; }
    setAvances(Array.isArray(da.avances) ? da.avances : []);
    const prochainePortee: Portee = da.scope === "all" ? "all" : "self";
    setPortee(prochainePortee);
    setMonEmploye(da.employee || null);

    /* Un salarié en portée personnelle ne télécharge jamais l'annuaire des
       salariés, les banques ni les caisses. La confidentialité ne dépend pas
       seulement de ce qui est dessiné à l'écran. */
    if (prochainePortee !== "all") {
      setEmployes([]);
      setComptes({ banques: [], caisses: [] });
      return;
    }

    const [re, rb, rc] = await Promise.all([
      authFetch("/attendance-v2/employees", { cache: "no-store" }),
      authFetch("/accounting/banks", { cache: "no-store" }).catch(() => null),
      authFetch("/caisses", { cache: "no-store" }).catch(() => null),
    ]);
    const de = await re.json().catch(() => ({}));
    setEmployes(Array.isArray(de.employees) ? de.employees : []);
    const banques = rb && rb.ok ? await rb.json().catch(() => []) : [];
    const caisses = rc && rc.ok ? await rc.json().catch(() => []) : [];
    setComptes({
      banques: Array.isArray(banques) ? banques : (banques?.banks || banques?.banques || []),
      caisses: Array.isArray(caisses) ? caisses : (caisses?.caisses || []),
    });
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const agir = async (chemin: string, corps?: unknown) => {
    setOccupe(true); setMessage(""); setErreur("");
    try {
      const r = await authFetch(chemin, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corps ?? {}),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErreur(d.error || "Opération refusée."); return null; }
      setMessage(d.message || "Enregistré.");
      await charger();
      if (fiche) await ouvrirFiche(fiche.avance.id);
      return d;
    } finally { setOccupe(false); }
  };

  const ouvrirFiche = async (id: number) => {
    const r = await authFetch(`/avances/${id}`, { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setErreur(d.error || "Avance illisible."); return; }
    setFiche({ avance: d.avance, echeancier: d.echeancier || [], mouvements: d.mouvements || [] });
  };

  /* SALARY_ADVANCE_TREASURY_V3 */

  /**
   * Aucun bank_id / caisse_id =
   * Trésorerie générale de la société active.
   */
  const choisirCompte = (): {
    caisse_id?: number;
    bank_id?: number;
  } | null => {

    const { banques, caisses } = comptes;

    const choix = window.prompt(
      [
        "Depuis quel compte ?",
        "",
        "1. tresorerie",
        "2. caisse",
        "3. banque",
        "",
        "Par défaut : tresorerie"
      ].join("\n"),
      "tresorerie"
    );

    if (choix === null) return null;

    const valeur = String(choix)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();

    /*
     * {} est volontaire :
     * le backend interprète l'absence de
     * bank_id et caisse_id comme Trésorerie.
     */
    if (
      !valeur ||
      valeur === "1" ||
      valeur === "tresorerie" ||
      valeur === "treso"
    ) {
      return {};
    }

    const parCaisse =
      valeur === "2" ||
      valeur.includes("caisse");

    const parBanque =
      valeur === "3" ||
      valeur.includes("banque");

    if (!parCaisse && !parBanque) {
      setErreur(
        "Choisissez tresorerie, caisse ou banque."
      );
      return null;
    }

    const liste =
      parCaisse ? caisses : banques;

    if (!liste.length) {
      setErreur(
        parCaisse
          ? "Aucune caisse disponible."
          : "Aucune banque disponible."
      );
      return null;
    }

    const nomDe = (c: any) =>
      c.nom_caisse ||
      c.bank_name ||
      c.name ||
      `#${c.id}`;

    const choixCompte = window.prompt(
      [
        parCaisse
          ? "Choisissez la caisse :"
          : "Choisissez la banque :",
        "",
        ...liste.map(
          (c: any, i: number) =>
            `${i + 1}. ${nomDe(c)}`
        )
      ].join("\n"),
      "1"
    );

    if (choixCompte === null) {
      return null;
    }

    const rang =
      Number(choixCompte);

    const compte =
      liste[rang - 1];

    if (!compte) {
      setErreur("Compte invalide.");
      return null;
    }

    return parCaisse
      ? {
          caisse_id:
            Number(compte.id)
        }
      : {
          bank_id:
            Number(compte.id)
        };
  };


  const imprimerBonAvance = (
    data: {
      avance: any;
      echeancier: any[];
      mouvements: any[];
    }
  ) => {

    const a = data.avance;

    /* SALARY_ADVANCE_DOCUMENT_3_SIGNATURES_V3 */
    const montantAccorde =
      Number(
        a.amount_paid ||
        a.amount_authorized ||
        a.amount_requested ||
        0
      );

    const resteARegulariser =
      Math.max(
        0,
        Number(a.balance || 0)
      );

    const montantRegularise =
      Math.max(
        0,
        montantAccorde - resteARegulariser
      );

    const statutRegularisation =
      montantAccorde > 0 &&
      resteARegulariser <= 0
        ? "Intégralement régularisée"
        : montantRegularise > 0
          ? "Partiellement régularisée"
          : "À régulariser";

    const w = window.open(
      "",
      "_blank",
      "width=900,height=1000"
    );

    if (!w) {
      setErreur(
        "Autorisez les fenêtres contextuelles pour imprimer."
      );
      return;
    }

    const esc = (v: unknown) =>
      String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const compte =
      a.bank_id
        ? "Banque"
        : a.caisse_id
          ? "Caisse"
          : "Trésorerie générale";

    const echeancier =
      (data.echeancier || [])
        .map(
          (e: any) => `
            <tr>
              <td>${e.rank}</td>
              <td>${esc(e.period_code)}</td>
              <td class="num">
                ${fcfa(e.amount_due)}
              </td>
              <td class="num">
                ${fcfa(e.amount_taken)}
              </td>
              <td>
                ${
                  e.status === "RETENUE"
                    ? "Retenue"
                    : e.status === "A_VENIR"
                      ? "À venir"
                      : esc(e.status)
                }
              </td>
            </tr>
          `
        )
        .join("");

    w.document.write(`<!doctype html>
<html lang="fr">
<head>

<meta charset="utf-8">
<title>Avance ${esc(a.reference)}</title>

<style>

@page {
  size: A4 portrait;
  margin: 12mm;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: white;
  color: black;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 12px;
}

.document {
  width: 100%;
}

.entete {
  display: flex;
  justify-content: space-between;
  gap: 25px;
  border-bottom: 3px solid black;
  padding-bottom: 12px;
}

.societe {
  font-size: 19px;
  font-weight: 900;
}

.titre {
  text-align: right;
}

.titre h1 {
  margin: 0;
  font-size: 21px;
}

.reference {
  margin-top: 5px;
  font-family: monospace;
  font-weight: bold;
}

.infos {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px 25px;
  margin-top: 20px;
}

.champ {
  border-bottom: 1px solid #aaa;
  padding: 8px 0;
}

.libelle {
  display: block;
  text-transform: uppercase;
  font-size: 9px;
  color: #555;
}

.valeur {
  display: block;
  margin-top: 4px;
  font-size: 13px;
  font-weight: bold;
}

.montant {
  margin-top: 22px;
  border: 2px solid black;
  padding: 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.montant strong {
  font-size: 20px;
}

.texte {
  margin-top: 20px;
  line-height: 1.7;
  text-align: justify;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
}

th {
  border-top: 2px solid black;
  border-bottom: 2px solid black;
  padding: 7px;
  text-align: left;
}

td {
  border-bottom: 1px solid #aaa;
  padding: 7px;
}

.num {
  text-align: right;
}

.note {
  margin-top: 20px;
  border: 1px solid #777;
  padding: 10px;
  line-height: 1.5;
  font-size: 10px;
}

.signatures {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 28px;
  margin-top: 55px;
}

.signature {
  border-top: 1px solid black;
  padding-top: 8px;
  text-align: center;
  font-weight: bold;
}

.espace {
  height: 45px;
}

@media print {
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}

</style>
</head>

<body>

<div class="document">

  <div class="entete">

    <div>
      <div class="societe">
        ${esc(
          a.company_name ||
          "Entreprise"
        )}
      </div>

      <div>
        Avance sur salaire
      </div>
    </div>

    <div class="titre">
      <h1>
        RECONNAISSANCE D'AVANCE
      </h1>

      <div class="reference">
        ${esc(a.reference)}
      </div>
    </div>

  </div>


  <div class="infos">

    <div class="champ">
      <span class="libelle">
        Salarié
      </span>

      <span class="valeur">
        ${esc(a.full_name)}
      </span>
    </div>


    <div class="champ">
      <span class="libelle">
        Mode de décaissement
      </span>

      <span class="valeur">
        ${compte}
      </span>
    </div>


    <div class="champ">
      <span class="libelle">
        Première retenue
      </span>

      <span class="valeur">
        ${esc(
          a.first_period_code ||
          "—"
        )}
      </span>
    </div>


    <div class="champ">
      <span class="libelle">
        Retenue mensuelle
      </span>

      <span class="valeur">
        ${
          Number(
            a.installment_amount
          )
            ? fcfa(
                a.installment_amount
              )
            : "En une fois"
        }
      </span>
    </div>


    <div class="champ">
      <span class="libelle">
        Motif
      </span>

      <span class="valeur">
        ${esc(a.reason || "—")}
      </span>
    </div>


    <div class="champ">
      <span class="libelle">
        Solde restant
      </span>

      <span class="valeur">
        ${fcfa(a.balance || 0)}
      </span>
    </div>

  </div>


  <div class="montant">

    <span>
      Montant effectivement avancé
    </span>

    <strong>
      ${fcfa(
        a.amount_paid ||
        a.amount_authorized ||
        a.amount_requested
      )}
    </strong>

  </div>


  <div class="texte">

    Je soussigné(e)
    <strong>
      ${esc(a.full_name)}
    </strong>,
    reconnais avoir reçu la somme
    indiquée ci-dessus à titre
    d'avance sur salaire.

    Le remboursement sera effectué
    principalement par retenues sur
    salaire selon l'échéancier prévu.

    Je peux également effectuer à tout
    moment un remboursement anticipé,
    total ou partiel.

  </div>


  ${
    echeancier
      ? `
        <table>

          <thead>
            <tr>
              <th>#</th>
              <th>Période</th>
              <th class="num">
                Prévu
              </th>
              <th class="num">
                Retenu
              </th>
              <th>État</th>
            </tr>
          </thead>

          <tbody>
            ${echeancier}
          </tbody>

        </table>
      `
      : ""
  }


  <div class="note">

    Chaque retenue mensuelle ou
    remboursement effectué fera
    apparaître le nouveau solde restant.

    Une preuve distincte peut être
    imprimée et signée après chaque
    opération.

  </div>


    <div style="
    margin-top:22px;
    border:2px solid #111;
    padding:12px 14px;
  ">
    <div style="
      font-weight:900;
      font-size:13px;
      margin-bottom:8px;
      text-transform:uppercase;
    ">
      Situation de l'avance
    </div>

    <table style="margin-top:0">
      <tbody>
        <tr>
          <td>Montant accordé</td>
          <td class="num">
            <strong>${fcfa(montantAccorde)}</strong>
          </td>
        </tr>

        <tr>
          <td>Montant déjà régularisé / remboursé</td>
          <td class="num">
            <strong>${fcfa(montantRegularise)}</strong>
          </td>
        </tr>

        <tr>
          <td>Reste à régulariser</td>
          <td class="num">
            <strong>${fcfa(resteARegulariser)}</strong>
          </td>
        </tr>

        <tr>
          <td>Statut de régularisation</td>
          <td class="num">
            <strong>${esc(statutRegularisation)}</strong>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

<div class="signatures">

    <div class="signature">

      LE SALARIÉ

      <div class="espace"></div>

      Signature

    </div>


    <div class="signature">

      LA DIRECTION

      <div class="espace"></div>

      Signature et cachet

    </div>

    <div class="signature">
      LA COMPTABILITÉ
      <div class="espace"></div>
      Signature
    </div>

  </div>

</div>

<script>
window.onload = function () {
  window.print();
};
</script>

</body>
</html>`);

    w.document.close();
  };


  const imprimerPreuveAvance = (
    a: any,
    m: any
  ) => {

    const w = window.open(
      "",
      "_blank",
      "width=850,height=900"
    );

    if (!w) return;

    const montant =
      Math.abs(
        Number(m.amount || 0)
      );

    const solde =
      Number(
        m.balance_after || 0
      );

    w.document.write(`<!doctype html>
<html lang="fr">

<head>

<meta charset="utf-8">

<title>
Preuve retenue avance
</title>

<style>

@page {
  size: A4 portrait;
  margin: 15mm;
}

body {
  color: black;
  background: white;
  font-family: Arial, sans-serif;
}

.cadre {
  border: 2px solid black;
  padding: 30px;
}

h1 {
  margin-top: 0;
  text-align: center;
  font-size: 21px;
}

.ligne {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  border-bottom: 1px solid #aaa;
  padding: 10px 0;
}

.texte {
  margin-top: 30px;
  line-height: 1.7;
}

.signatures {
  display: flex;
  gap: 80px;
  margin-top: 70px;
}

.signature {
  flex: 1;
  border-top: 1px solid black;
  padding-top: 8px;
  text-align: center;
}

</style>

</head>

<body>

<div class="cadre">

<h1>
ATTESTATION DE RETENUE /
REMBOURSEMENT
</h1>


<div class="ligne">
  <strong>Salarié</strong>
  <span>
    ${a.full_name || ""}
  </span>
</div>


<div class="ligne">
  <strong>Avance</strong>
  <span>
    ${a.reference || ""}
  </span>
</div>


<div class="ligne">
  <strong>Date</strong>

  <span>
    ${
      new Date(
        m.created_at
      ).toLocaleDateString(
        "fr-FR"
      )
    }
  </span>
</div>


<div class="ligne">
  <strong>Type</strong>

  <span>
    ${
      ORIGINES[m.origin] ||
      m.origin
    }
  </span>
</div>


<div class="ligne">

  <strong>
    Montant
  </strong>

  <span>
    ${fcfa(montant)}
  </span>

</div>


<div class="ligne">

  <strong>
    Solde restant
  </strong>

  <span>
    ${fcfa(solde)}
  </span>

</div>


<div class="texte">

Le présent document confirme
qu'un montant de
<strong>
${fcfa(montant)}
</strong>

a été ${
  m.origin === "RETENUE_PAIE"
    ? "retenu sur le salaire"
    : "remboursé"
}

au titre de l'avance
<strong>
${a.reference || ""}
</strong>.

Après cette opération,
le solde restant à rembourser est
de

<strong>
${fcfa(solde)}
</strong>.

</div>


<div class="signatures">

  <div class="signature">
    LE SALARIÉ
    <br><br><br>
    Signature
  </div>

  <div class="signature">
    LA DIRECTION
    <br><br><br>
    Signature et cachet
  </div>

    <div class="signature">
      LA COMPTABILITÉ
      <div class="espace"></div>
      Signature
    </div>

</div>

</div>

<script>
window.onload=function(){
  window.print();
};
</script>

</body>
</html>`);

    w.document.close();
  };


  const creer = async (e: React.FormEvent) => {
    e.preventDefault();
    const montant = Number(nouvelle.amount_requested);
    if ((portee === "all" && !nouvelle.employee_id) || !(montant > 0)) {
      setErreur(portee === "all" ? "Employé et montant sont obligatoires." : "Le montant est obligatoire.");
      return;
    }
    const d = new Date();
    await agir("/avances", {
      ...(portee === "all" ? { employee_id: Number(nouvelle.employee_id) } : {}),
      amount_requested: montant,
      installment_amount: Number(nouvelle.installment_amount || 0),
      first_period_code: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      reason: nouvelle.reason,
    });
    setNouvelle({ employee_id: "", amount_requested: "", installment_amount: "", reason: "" });
  };

  const totalDu = avances.reduce((t, a) => t + Number(a.balance || 0), 0);

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-950 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header>
          <h1 className="text-3xl font-black md:text-4xl">Avances sur salaire</h1>
          <p className="mt-2 text-slate-600">
            Une avance n’est pas une dépense : c’est de l’argent avancé au salarié, qu’il
            rembourse ensuite. Le solde restant décide de tout.
          </p>
          {portee === "self" && (
            <p className="mt-2 rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-900">
              Espace personnel de {monEmploye?.full_name || "salarié"} : vous voyez uniquement vos demandes.
            </p>
          )}
        </header>

        {(message || erreur) && (
          <div className={`mt-5 rounded-xl p-4 font-bold ${
            erreur ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}>
            {erreur || message}
          </div>
        )}

        <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Chiffre libelle="Avances en cours" valeur={String(avances.filter((a) => Number(a.balance) > 0).length)} />
          <Chiffre libelle="Reste à rembourser" valeur={fcfa(totalDu)} />
          <Chiffre libelle="En attente du directeur" valeur={String(avances.filter((a) => a.status === "DEMANDEE").length)} />
          <Chiffre libelle="À verser" valeur={String(avances.filter((a) => a.status === "VALIDEE").length)} />
        </section>

        {peutCreer && (
          <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black">Demander une avance</h2>
            <form onSubmit={creer} className="mt-4 grid gap-3 md:grid-cols-4">
              {portee === "all" ? (
                <label className="block md:col-span-1">
                  <span className="mb-1 block text-sm font-bold">Employé</span>
                  <select className="min-h-12 w-full rounded-xl border p-3" value={nouvelle.employee_id}
                    onChange={(e) => setNouvelle({ ...nouvelle, employee_id: e.target.value })}>
                    <option value="">Choisir…</option>
                    {employes.map((e) => (
                      <option key={e.id} value={e.id}>{e.employee_number}. {e.full_name}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="rounded-xl bg-slate-100 p-3 md:col-span-1">
                  <span className="block text-sm font-bold">Demande pour</span>
                  <span>{monEmploye?.full_name || "Votre fiche salarié"}</span>
                </div>
              )}
              <label className="block">
                <span className="mb-1 block text-sm font-bold">Montant demandé</span>
                <input type="number" min={1} className="min-h-12 w-full rounded-xl border p-3"
                  value={nouvelle.amount_requested}
                  onChange={(e) => setNouvelle({ ...nouvelle, amount_requested: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-bold">Mensualité</span>
                <input type="number" min={0} className="min-h-12 w-full rounded-xl border p-3"
                  placeholder="0 = en une fois"
                  value={nouvelle.installment_amount}
                  onChange={(e) => setNouvelle({ ...nouvelle, installment_amount: e.target.value })} />
                <span className="mt-1 block text-xs text-slate-500">
                  Laisser vide pour retenir en une seule fois.
                </span>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-bold">Motif</span>
                <input className="min-h-12 w-full rounded-xl border p-3" value={nouvelle.reason}
                  onChange={(e) => setNouvelle({ ...nouvelle, reason: e.target.value })} />
              </label>
              <button type="submit" disabled={occupe}
                className="min-h-12 rounded-xl bg-slate-900 px-5 font-black text-white disabled:opacity-40 md:col-span-4 md:w-auto md:justify-self-start">
                Enregistrer la demande
              </button>
            </form>
          </section>
        )}

        {/* ── LA FICHE ── */}
        {fiche && (
          <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">{fiche.avance.full_name}</h2>
                <p className="font-mono text-sm text-slate-500">{fiche.avance.reference}</p>
              </div>
              <div className="flex flex-wrap gap-2">

                {["VERSEE", "EN_REMBOURSEMENT", "REMBOURSEE"].includes(
                  fiche.avance.status
                ) && (
                  <button
                    type="button"
                    onClick={() =>
                      imprimerBonAvance(
                        fiche
                      )
                    }
                    className="min-h-10 rounded-xl border border-slate-900 bg-white px-4 font-black"
                  >
                    🖨️ Bon d&apos;avance
                  </button>
                )}

                <button
                  onClick={() =>
                    setFiche(null)
                  }
                  className="min-h-10 rounded-xl bg-slate-200 px-4 font-black"
                >
                  Fermer
                </button>

              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Chiffre libelle="Argent versé" valeur={fcfa(fiche.avance.amount_paid)} />
              <Chiffre libelle="Reste à rembourser" valeur={fcfa(fiche.avance.balance)} fort />
              <Chiffre libelle="Mensualité"
                valeur={Number(fiche.avance.installment_amount) ? fcfa(fiche.avance.installment_amount) : "En une fois"} />
              <Chiffre libelle="État" valeur={(STATUTS[fiche.avance.status] || { texte: fiche.avance.status }).texte} />
            </div>

            {fiche.echeancier.length > 0 && (
              <div className="mt-5">
                <h3 className="font-black">Échéancier</h3>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr><th className="p-2">#</th><th className="p-2">Période</th>
                        <th className="p-2">À retenir</th><th className="p-2">Retenu</th><th className="p-2">État</th></tr>
                    </thead>
                    <tbody>
                      {fiche.echeancier.map((e) => (
                        <tr key={e.rank} className="border-t">
                          <td className="p-2">{e.rank}</td>
                          <td className="p-2">{e.period_code}</td>
                          <td className="p-2">{fcfa(e.amount_due)}</td>
                          <td className="p-2">{fcfa(e.amount_taken)}</td>
                          <td className="p-2 font-bold">
                            {e.status === "A_VENIR" ? "À venir"
                              : e.status === "RETENUE" ? "Retenue"
                              : e.status === "SUSPENDUE" ? "Suspendue" : e.status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {fiche.mouvements.length > 0 && (
              <div className="mt-5">
                <h3 className="font-black">Historique des remboursements</h3>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[680px] text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr><th className="p-2">Date</th><th className="p-2">Origine</th>
                        <th className="p-2">Montant</th><th className="p-2">Solde après</th>
                        <th className="p-2">Auteur</th><th className="p-2">Action</th></tr>
                    </thead>
                    <tbody>
                      {fiche.mouvements.map((m) => (
                        <tr key={m.id} className="border-t">
                          <td className="p-2">{new Date(m.created_at).toLocaleDateString("fr-FR")}</td>
                          <td className="p-2">{ORIGINES[m.origin] || m.origin}</td>
                          <td className={`p-2 font-bold ${Number(m.amount) < 0 ? "text-amber-700" : ""}`}>
                            {fcfa(m.amount)}
                          </td>
                          <td className="p-2">{fcfa(m.balance_after)}</td>
                          <td className="p-2 text-slate-500">{m.performed_by_name}</td>
                          <td className="p-2">

                            <div className="flex flex-wrap gap-2">

                              {m.origin !== "CONTREPASSATION" && (

                                <button
                                  type="button"
                                  onClick={() =>
                                    imprimerPreuveAvance(
                                      fiche.avance,
                                      m
                                    )
                                  }
                                  className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-black"
                                >
                                  🖨️ Preuve
                                </button>

                              )}

                            {peutAnnuler && m.origin !== "CONTREPASSATION" && !m.reverses_repayment_id && (
                              <button disabled={occupe} onClick={async () => {
                                const motif = window.prompt("Motif de la contrepassation (obligatoire) :") ?? "";
                                if (motif.trim().length < 5) return;
                                await agir(`/avances/remboursements/${m.id}/contrepasser`, { reason: motif.trim() });
                              }}
                                className="rounded-lg bg-slate-200 px-3 py-1 text-xs font-black disabled:opacity-40">
                                Contrepasser
                              </button>
                            )}

                            </div>

                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── LA LISTE ── */}
        <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="border-b p-5"><h2 className="text-xl font-black">
            {portee === "all" ? "Toutes les avances" : "Mes demandes d’avance"}
          </h2></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-slate-50 text-sm text-slate-600">
                <tr>
                  <th className="p-3">Employé</th><th className="p-3">Référence</th>
                  <th className="p-3">Demandé</th><th className="p-3">Versé</th>
                  <th className="p-3">Reste à rembourser</th><th className="p-3">État</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {avances.map((a) => {
                  const s = STATUTS[a.status] || { texte: a.status, classe: "bg-slate-200" };
                  return (
                    <tr key={a.id} className="border-t align-top">
                      <td className="p-3 font-bold">{a.full_name}</td>
                      <td className="p-3 font-mono text-sm">{a.reference}</td>
                      <td className="p-3">{fcfa(a.amount_requested)}</td>
                      <td className="p-3">{Number(a.amount_paid) ? fcfa(a.amount_paid) : "—"}</td>
                      <td className="p-3 font-black">{Number(a.balance) ? fcfa(a.balance) : "—"}</td>
                      <td className="p-3">
                        <span className={`rounded-lg px-2 py-1 text-xs font-black ${s.classe}`}>{s.texte}</span>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => ouvrirFiche(a.id)}
                            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-black text-white">
                            Détail
                          </button>
                          {peutValider && a.status === "DEMANDEE" && (
                            <>
                              <button disabled={occupe} onClick={() => agir(`/avances/${a.id}/decision`, { decision: "VALIDEE" })}
                                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-black text-white disabled:opacity-40">
                                Valider
                              </button>
                              <button disabled={occupe} onClick={async () => {
                                const motif = window.prompt("Motif du refus (obligatoire) :") ?? "";
                                if (motif.trim().length < 3) return;
                                await agir(`/avances/${a.id}/decision`, { decision: "REFUSEE", reason: motif.trim() });
                              }}
                                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-black text-white disabled:opacity-40">
                                Refuser
                              </button>
                            </>
                          )}
                          {peutPayer && a.status === "VALIDEE" && (
                            <button disabled={occupe} onClick={async () => {
                              const compte = choisirCompte(); if (!compte) return;
                              await agir(`/avances/${a.id}/versement`, compte);
                            }}
                              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-black text-white disabled:opacity-40">
                              Verser
                            </button>
                          )}
                          {peutPayer && ["VERSEE", "EN_REMBOURSEMENT"].includes(a.status) && (
                            <button disabled={occupe} onClick={async () => {
                              const saisi = window.prompt(
                                `Remboursement de ${a.full_name}\nReste dû : ${fcfa(a.balance)}\n\nMontant reçu :`);
                              if (saisi === null) return;
                              const montant = Number(saisi);
                              if (!(montant > 0)) { setErreur("Montant invalide."); return; }
                              const compte = choisirCompte(); if (!compte) return;
                              await agir(`/avances/${a.id}/remboursement`, { amount: montant, ...compte });
                            }}
                              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-black text-white disabled:opacity-40">
                              Encaisser un remboursement
                            </button>
                          )}
                          {peutModifier && ["VERSEE", "EN_REMBOURSEMENT"].includes(a.status) && (
                            <button disabled={occupe} onClick={async () => {
                              const saisi = window.prompt(
                                `Nouvelle mensualité pour ${a.full_name} (0 = solder en une fois) :`,
                                String(Math.round(Number(a.installment_amount || 0))));
                              if (saisi === null) return;
                              const motif = window.prompt("Motif du rééchelonnement (obligatoire) :") ?? "";
                              if (motif.trim().length < 5) return;
                              await agir(`/avances/${a.id}/reechelonner`,
                                { installment_amount: Number(saisi), reason: motif.trim() });
                            }}
                              className="rounded-lg bg-slate-200 px-3 py-2 text-sm font-black disabled:opacity-40">
                              Rééchelonner
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {avances.length === 0 && (
                  <tr><td colSpan={7} className="p-6 text-center text-slate-500">Aucune avance.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function Chiffre({ libelle, valeur, fort }: { libelle: string; valeur: string; fort?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 shadow-sm ${fort ? "bg-slate-900 text-white" : "bg-white"}`}>
      <p className={`text-sm ${fort ? "text-slate-300" : "text-slate-500"}`}>{libelle}</p>
      <p className="mt-1 text-xl font-black">{valeur}</p>
    </div>
  );
}
