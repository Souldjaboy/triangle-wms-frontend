"use client";

/**
 * L'ESPACE DÉTENTE.
 *
 * Deux jeux courts, pour une pause de cinq minutes.
 *
 * CE QUE CET ESPACE NE FAIT PAS, ET C'EST VOLONTAIRE.
 *
 * 1. IL NE S'IMPOSE JAMAIS. Rien ne s'ouvre tout seul, rien ne clignote
 *    ailleurs dans l'application, aucune notification n'invite à jouer. On y
 *    vient, ou on n'y vient pas. Un logiciel de travail qui propose de jouer
 *    pendant qu'on saisit des factures est un logiciel qu'on finit par
 *    détester.
 *
 * 2. IL N'ENVOIE RIEN. Pas de score au serveur, pas de classement, pas de
 *    temps de jeu enregistré. Tout se passe dans le navigateur et disparaît
 *    en fermant l'onglet. Un temps de jeu mesuré finirait par être regardé
 *    par quelqu'un, et une pause surveillée n'est plus une pause.
 *
 * 3. IL NE RETIENT PAS. Pas de récompense à revenir demain, pas de série à
 *    ne pas briser. Ces mécanismes servent à faire rester ; ici l'intérêt
 *    est de repartir.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePermissions } from "../../lib/permissions";
import {
  ArrowLeft, Bomb, Flag, Gamepad2, Lock, RotateCcw, Shuffle, Timer, Trophy,
} from "lucide-react";

export default function Detente() {
  const { can, loading } = usePermissions();
  const [jeu, setJeu] = useState<"demineur" | "taquin" | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <Gamepad2 className="animate-pulse text-gray-700" />
      </div>
    );
  }

  if (!can("studio.detente", "view")) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <Lock className="mx-auto mb-4 text-gray-500" size={40} />
          <h1 className="mb-2 text-xl font-semibold">Espace détente fermé</h1>
          <p className="text-sm text-gray-400">
            Cet espace n&apos;est pas ouvert pour votre compte dans cette
            société. C&apos;est un réglage, pas un oubli : un administrateur
            peut l&apos;ouvrir depuis les droits.
          </p>
          <Link href="/studio" className="mt-6 inline-block text-sm text-blue-400 hover:underline">
            Retour au Studio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white min-w-0 w-full">
      <header className="border-b border-gray-800">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 min-w-0">
          <Link href="/studio" className="shrink-0 rounded-lg p-2 hover:bg-gray-800" aria-label="Retour au Studio">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate font-semibold">Espace détente</h1>
            <p className="truncate text-xs text-gray-500">
              Cinq minutes, puis on repart.
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-5 min-w-0">
        {!jeu ? (
          <>
            <p className="mb-4 rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-3 text-xs text-gray-400">
              Rien ici ne part vers le serveur : ni score, ni classement, ni
              temps passé. Tout disparaît en fermant l&apos;onglet. Et rien
              ne viendra vous chercher ailleurs dans l&apos;application — cet
              espace ne s&apos;ouvre que si vous venez.
            </p>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <li>
                <button onClick={() => setJeu("demineur")}
                  className="w-full rounded-xl border border-gray-800 bg-gray-900/50 p-4 text-left hover:border-blue-700">
                  <p className="flex items-center gap-2 font-medium"><Bomb size={17} /> Démineur</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Découvrir toutes les cases sauf les mines. Le premier clic
                    ne saute jamais.
                  </p>
                </button>
              </li>
              <li>
                <button onClick={() => setJeu("taquin")}
                  className="w-full rounded-xl border border-gray-800 bg-gray-900/50 p-4 text-left hover:border-blue-700">
                  <p className="flex items-center gap-2 font-medium"><Shuffle size={17} /> Taquin</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Remettre les nombres dans l&apos;ordre en glissant les
                    tuiles. Le mélange est toujours résoluble.
                  </p>
                </button>
              </li>
            </ul>
          </>
        ) : (
          <>
            <button onClick={() => setJeu(null)}
              className="mb-3 flex items-center gap-2 rounded-lg border border-gray-800 px-3 py-1.5 text-sm hover:bg-gray-800">
              <ArrowLeft size={14} /> Les jeux
            </button>
            {jeu === "demineur" ? <Demineur /> : <Taquin />}
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════ LE DÉMINEUR ═══════════════════════════════ */

type Case = { mine: boolean; voisines: number; ouverte: boolean; drapeau: boolean };

const NIVEAUX = [
  { cle: "facile", nom: "Facile", l: 9, h: 9, mines: 10 },
  { cle: "moyen", nom: "Moyen", l: 12, h: 12, mines: 22 },
  { cle: "difficile", nom: "Difficile", l: 16, h: 14, mines: 40 },
];

function Demineur() {
  const [niveau, setNiveau] = useState(NIVEAUX[0]);
  const [grille, setGrille] = useState<Case[][]>([]);
  const [etat, setEtat] = useState<"attente" | "en-cours" | "perdu" | "gagne">("attente");
  const [debut, setDebut] = useState(0);
  const [duree, setDuree] = useState(0);

  const neuve = useCallback(() => {
    const g: Case[][] = Array.from({ length: niveau.h }, () =>
      Array.from({ length: niveau.l }, () => ({
        mine: false, voisines: 0, ouverte: false, drapeau: false })));
    setGrille(g); setEtat("attente"); setDuree(0);
  }, [niveau]);

  useEffect(() => { neuve(); }, [neuve]);

  useEffect(() => {
    if (etat !== "en-cours") return;
    const t = window.setInterval(() => setDuree(Math.floor((Date.now() - debut) / 1000)), 500);
    return () => window.clearInterval(t);
  }, [etat, debut]);

  /* LES MINES SONT POSÉES APRÈS LE PREMIER CLIC, en évitant la case touchée
     et ses voisines. Perdre au premier clic n'apprend rien et n'amuse
     personne. */
  function poser(g: Case[][], sauf: { x: number; y: number }) {
    const libres: { x: number; y: number }[] = [];
    for (let y = 0; y < niveau.h; y++) {
      for (let x = 0; x < niveau.l; x++) {
        if (Math.abs(x - sauf.x) <= 1 && Math.abs(y - sauf.y) <= 1) continue;
        libres.push({ x, y });
      }
    }
    for (let i = libres.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [libres[i], libres[j]] = [libres[j], libres[i]];
    }
    for (const { x, y } of libres.slice(0, Math.min(niveau.mines, libres.length))) {
      g[y][x].mine = true;
    }
    for (let y = 0; y < niveau.h; y++) {
      for (let x = 0; x < niveau.l; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const a = x + dx, b = y + dy;
            if (a >= 0 && b >= 0 && a < niveau.l && b < niveau.h && g[b][a].mine) n += 1;
          }
        }
        g[y][x].voisines = n;
      }
    }
  }

  /* Les cases vides ouvrent leurs voisines de proche en proche. Une pile
     plutôt qu'une récursion : une grande zone vide dépasserait la pile
     d'appels du navigateur. */
  function ouvrirDepuis(g: Case[][], x0: number, y0: number) {
    const pile = [{ x: x0, y: y0 }];
    while (pile.length) {
      const { x, y } = pile.pop()!;
      const c = g[y]?.[x];
      if (!c || c.ouverte || c.drapeau) continue;
      c.ouverte = true;
      if (c.voisines === 0 && !c.mine) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx || dy) pile.push({ x: x + dx, y: y + dy });
          }
        }
      }
    }
  }

  function toucher(x: number, y: number) {
    if (etat === "perdu" || etat === "gagne") return;
    const g = grille.map((l) => l.map((c) => ({ ...c })));
    if (etat === "attente") {
      poser(g, { x, y });
      setDebut(Date.now());
      setEtat("en-cours");
    }
    const c = g[y][x];
    if (c.drapeau) return;
    if (c.mine) {
      for (const ligne of g) for (const k of ligne) if (k.mine) k.ouverte = true;
      setGrille(g); setEtat("perdu");
      return;
    }
    ouvrirDepuis(g, x, y);
    const reste = g.flat().filter((k) => !k.ouverte && !k.mine).length;
    setGrille(g);
    if (reste === 0) setEtat("gagne");
  }

  function marquer(e: React.MouseEvent, x: number, y: number) {
    e.preventDefault();
    if (etat === "perdu" || etat === "gagne") return;
    setGrille((gr) => gr.map((l, b) => l.map((c, a) =>
      (a === x && b === y && !c.ouverte) ? { ...c, drapeau: !c.drapeau } : c)));
  }

  const drapeaux = grille.flat().filter((c) => c.drapeau).length;
  const couleurs = ["", "#60a5fa", "#4ade80", "#f87171", "#c084fc", "#fbbf24", "#2dd4bf", "#e5e7eb", "#94a3b8"];

  return (
    <section className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {NIVEAUX.map((n) => (
          <button key={n.cle} onClick={() => setNiveau(n)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              n.cle === niveau.cle ? "border-blue-600 bg-blue-950/50 text-blue-200" : "border-gray-800 hover:bg-gray-800"
            }`}>
            {n.nom}
          </button>
        ))}
        <button onClick={neuve}
          className="flex items-center gap-1.5 rounded-lg border border-gray-800 px-3 py-1.5 text-sm hover:bg-gray-800">
          <RotateCcw size={14} /> Recommencer
        </button>
        <span className="ml-auto flex items-center gap-3 text-sm text-gray-400">
          <span className="flex items-center gap-1"><Flag size={13} /> {drapeaux}/{niveau.mines}</span>
          <span className="flex items-center gap-1"><Timer size={13} /> {duree} s</span>
        </span>
      </div>

      {etat === "gagne" && (
        <p className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-800 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-200">
          <Trophy size={16} /> Terminé en {duree} secondes. Bonne reprise.
        </p>
      )}
      {etat === "perdu" && (
        <p className="mb-3 flex items-center gap-2 rounded-lg border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-200">
          <Bomb size={16} /> Raté. Rien n&apos;est enregistré nulle part.
        </p>
      )}

      <div className="overflow-x-auto">
        <div className="inline-grid gap-[2px]"
          style={{ gridTemplateColumns: `repeat(${niveau.l}, minmax(0, 1fr))` }}>
          {grille.map((ligne, y) => ligne.map((c, x) => (
            <button
              key={`${x}-${y}`}
              onClick={() => toucher(x, y)}
              onContextMenu={(e) => marquer(e, x, y)}
              aria-label={`Case ${x + 1}, ${y + 1}`}
              className={`flex h-7 w-7 items-center justify-center rounded text-xs font-semibold sm:h-8 sm:w-8 ${
                c.ouverte
                  ? c.mine ? "bg-red-900 text-red-200" : "bg-gray-800 text-gray-200"
                  : "bg-gray-700 hover:bg-gray-600"
              }`}
              style={c.ouverte && !c.mine && c.voisines
                ? { color: couleurs[c.voisines] } : undefined}
            >
              {c.ouverte
                ? (c.mine ? "✶" : c.voisines || "")
                : (c.drapeau ? "⚑" : "")}
            </button>
          )))}
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-600">
        Clic droit — ou appui long sur téléphone — pour poser un drapeau.
      </p>
    </section>
  );
}

/* ═════════════════════════════ LE TAQUIN ═══════════════════════════════ */

function Taquin() {
  const [cote, setCote] = useState(3);
  const [tuiles, setTuiles] = useState<number[]>([]);
  const [coups, setCoups] = useState(0);

  const total = cote * cote;

  /* UN MÉLANGE TOUJOURS RÉSOLUBLE : on part de la solution et on fait des
     coups légaux au hasard. Tirer les tuiles au sort donnerait, une fois sur
     deux, une grille impossible — et personne ne saurait que c'est perdu
     d'avance. */
  const melanger = useCallback(() => {
    const t = Array.from({ length: total }, (_, i) => (i + 1) % total);
    let vide = total - 1;
    for (let i = 0; i < total * 60; i++) {
      const voisins: number[] = [];
      const x = vide % cote, y = Math.floor(vide / cote);
      if (x > 0) voisins.push(vide - 1);
      if (x < cote - 1) voisins.push(vide + 1);
      if (y > 0) voisins.push(vide - cote);
      if (y < cote - 1) voisins.push(vide + cote);
      const choisi = voisins[Math.floor(Math.random() * voisins.length)];
      [t[vide], t[choisi]] = [t[choisi], t[vide]];
      vide = choisi;
    }
    setTuiles(t); setCoups(0);
  }, [cote, total]);

  useEffect(() => { melanger(); }, [melanger]);

  const gagne = useMemo(
    () => tuiles.length === total && tuiles.every((v, i) => v === (i + 1) % total),
    [tuiles, total]);

  function glisser(i: number) {
    if (gagne) return;
    const vide = tuiles.indexOf(0);
    const x = i % cote, y = Math.floor(i / cote);
    const vx = vide % cote, vy = Math.floor(vide / cote);
    if (Math.abs(x - vx) + Math.abs(y - vy) !== 1) return;
    const t = [...tuiles];
    [t[i], t[vide]] = [t[vide], t[i]];
    setTuiles(t); setCoups((c) => c + 1);
  }

  return (
    <section className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {[3, 4, 5].map((n) => (
          <button key={n} onClick={() => setCote(n)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              n === cote ? "border-blue-600 bg-blue-950/50 text-blue-200" : "border-gray-800 hover:bg-gray-800"
            }`}>
            {n} × {n}
          </button>
        ))}
        <button onClick={melanger}
          className="flex items-center gap-1.5 rounded-lg border border-gray-800 px-3 py-1.5 text-sm hover:bg-gray-800">
          <Shuffle size={14} /> Mélanger
        </button>
        <span className="ml-auto text-sm text-gray-400">{coups} coups</span>
      </div>

      {gagne && (
        <p className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-800 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-200">
          <Trophy size={16} /> Remis en ordre en {coups} coups. Bonne reprise.
        </p>
      )}

      <div className="inline-grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cote}, minmax(0, 1fr))` }}>
        {tuiles.map((v, i) => (
          <button key={i} onClick={() => glisser(i)}
            disabled={v === 0}
            aria-label={v === 0 ? "Case vide" : `Tuile ${v}`}
            className={`flex items-center justify-center rounded-lg text-lg font-semibold transition-colors ${
              v === 0 ? "bg-transparent" : "bg-gray-700 hover:bg-gray-600"
            }`}
            style={{ width: cote > 4 ? 48 : 60, height: cote > 4 ? 48 : 60 }}>
            {v || ""}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-600">
        Le mélange part de la solution : il est toujours possible de la
        retrouver.
      </p>
    </section>
  );
}
