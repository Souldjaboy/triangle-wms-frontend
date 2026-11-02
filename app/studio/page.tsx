"use client";

/**
 * L'ACCUEIL DE TRIANGLE STUDIO PRO.
 *
 * Cet écran a une règle : il ne propose que ce qui marche.
 *
 * Une tuile grise qui ouvre une page vide coûte plus cher qu'une tuile
 * absente. Les modules encore à construire sont donc listés à part, nommés,
 * et désignés comme tels — y compris ceux qui attendent une dépendance
 * extérieure. Personne ne doit cliquer pour découvrir qu'il n'y a rien.
 *
 * Les tuiles suivent aussi les droits : un module fermé pour ce compte dans
 * cette société n'apparaît pas, parce que le serveur répondrait 404 de toute
 * façon — il ne distingue pas un module masqué d'une page absente, exprès.
 */

import Link from "next/link";
import { usePermissions } from "../lib/permissions";
import {
  ArrowLeft, FolderOpen, ScanLine, FileText, PenTool, Palette,
  Image as ImageIcon, Presentation, MessageSquare, Gamepad2,
  Loader2, Lock, Hammer,
} from "lucide-react";

type Tuile = {
  titre: string;
  texte: string;
  href: string;
  Icone: typeof FolderOpen;
  module: string;
};

/* CE QUI EXISTE ET RÉPOND. Rien d'autre n'a sa place ici. */
const PRETES: Tuile[] = [
  {
    titre: "Scanner",
    texte:
      "Viser une feuille, la voir détectée, capturer, corriger les coins, page suivante — puis assembler en PDF. Le texte peut être lu sur l'appareil, en français ou en anglais, pour retrouver le document par son contenu.",
    href: "/studio/scanner",
    Icone: ScanLine,
    module: "studio.scanner",
  },
  {
    titre: "Bibliothèque",
    texte:
      "Déposer, chercher, partager et versionner les documents. Les fichiers sont rangés hors du dossier public : aucune URL ne les atteint.",
    href: "/studio/bibliotheque",
    Icone: FolderOpen,
    module: "studio.bibliotheque",
  },
];

/* CE QUI RESTE À CONSTRUIRE. Nommé, pas cliquable, pas maquetté. */
const A_VENIR: { titre: string; Icone: typeof ScanLine; note: string }[] = [
  {
    titre: "Éditeur PDF",
    Icone: FileText,
    note: "Texte, images, tableaux, annotations, fusion et découpe. Demande une bibliothèque PDF côté navigateur, non encore installée.",
  },
  {
    titre: "Signatures et cachets",
    Icone: PenTool,
    note: "Le socle est posé : la bibliothèque sait déjà stocker une signature ou un cachet comme document à part entière, cloisonné par société.",
  },
  {
    titre: "Studio graphique",
    Icone: Palette,
    note: "Calques, modèles de cartes de visite, flyers, badges, certificats. Les modèles seront originaux : aucun modèle sous licence n'est repris.",
  },
  {
    titre: "Éditeur photo",
    Icone: ImageIcon,
    note: "Recadrage, lumière, filtres, retouches. Travaille sur une copie : l'original reste intact et téléchargeable.",
  },
  {
    titre: "Présentations",
    Icone: Presentation,
    note: "Diapositives, transitions, import et export PowerPoint.",
  },
  {
    titre: "Partage externe",
    Icone: MessageSquare,
    note: "Les liens signés fonctionnent déjà depuis la bibliothèque. L'envoi par courriel demande un serveur SMTP configuré ; l'envoi de pièces jointes WhatsApp demande un compte WhatsApp Business API — sans lui, rien ne part automatiquement.",
  },
  {
    titre: "Espace détente",
    Icone: Gamepad2,
    note: "Jeux courts, sur demande, jamais imposés à l'ouverture.",
  },
];

export default function Studio() {
  const { can, loading } = usePermissions();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!can("studio", "view")) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <Lock className="mx-auto mb-4 text-gray-500" size={40} />
          <h1 className="mb-2 text-xl font-semibold">Studio non accessible</h1>
          <p className="text-sm text-gray-400">
            Votre compte n&apos;a pas l&apos;accès au Studio pour cette
            société. Un administrateur peut l&apos;ouvrir depuis les droits et
            permissions.
          </p>
          <Link href="/dashboard" className="mt-6 inline-block text-sm text-blue-400 hover:underline">
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    );
  }

  const tuiles = PRETES.filter((t) => can(t.module, "view"));

  return (
    <div className="min-h-screen bg-gray-950 text-white min-w-0 w-full">
      <header className="border-b border-gray-800">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4 min-w-0">
          <Link href="/dashboard" className="shrink-0 rounded-lg p-2 hover:bg-gray-800" aria-label="Retour au tableau de bord">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">Triangle Studio Pro</h1>
            <p className="truncate text-xs text-gray-500">
              Documents, scans et créations — cloisonnés par société.
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 min-w-0">
        {tuiles.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {tuiles.map(({ titre, texte, href, Icone }) => (
              <Link
                key={href} href={href}
                className="group rounded-xl border border-gray-800 bg-gray-900/50 p-4 hover:border-blue-700 hover:bg-gray-900 min-w-0"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Icone size={20} className="shrink-0 text-blue-300" />
                  <span className="truncate font-medium">{titre}</span>
                </div>
                <p className="text-xs leading-relaxed text-gray-400">{texte}</p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-gray-800 bg-gray-900/50 px-4 py-6 text-sm text-gray-400">
            Aucun module du Studio n&apos;est ouvert pour votre compte dans
            cette société.
          </p>
        )}

        <section className="mt-8">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-300">
            <Hammer size={16} /> Pas encore construit
          </h2>
          <p className="mb-3 text-xs text-gray-600">
            Ces modules sont prévus mais n&apos;existent pas : ils ne sont pas
            cliquables, et aucune maquette ne les remplace. La liste dit aussi
            ce qui attend une dépendance extérieure.
          </p>
          <ul className="space-y-2">
            {A_VENIR.map(({ titre, Icone, note }) => (
              <li key={titre} className="flex items-start gap-3 rounded-xl border border-dashed border-gray-800 p-3 min-w-0">
                <Icone size={18} className="mt-0.5 shrink-0 text-gray-600" />
                <div className="min-w-0">
                  <p className="text-sm text-gray-400">{titre}</p>
                  <p className="text-xs leading-relaxed text-gray-600">{note}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
