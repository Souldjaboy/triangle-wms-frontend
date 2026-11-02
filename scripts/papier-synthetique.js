"use strict";
/**
 * FABRIQUER UNE FEUILLE DE PAPIER, EN IMAGE ET EN VIDÉO.
 *
 * Pour éprouver un scanner il faut quelque chose à scanner. Chromium sait
 * simuler une caméra à partir d'un fichier Y4M : on lui donne donc une
 * feuille claire sur fond sombre, vue de biais — exactement ce que la
 * détection de contour doit trouver et ce que le redressement doit remettre
 * d'aplomb.
 *
 * Le trapèze n'est pas un luxe : un rectangle parfaitement cadré ne prouve
 * rien de la correction de perspective, qui est tout l'intérêt de l'outil.
 */
const zlib = require("zlib");

/* ─────────────────────────── LE DESSIN ──────────────────────────────── */

/** Un plan de luminance : feuille claire en trapèze sur fond sombre. */
function luminance(largeur, hauteur, { biais = 0.12, marge = 0.1, texte = true } = {}) {
  const y = new Uint8Array(largeur * hauteur).fill(28);   /* table sombre */

  /* Les quatre coins de la feuille. Le haut est plus étroit que le bas :
     c'est ce que donne un téléphone tenu au-dessus d'une table. */
  const gx = largeur * marge, dx = largeur * (1 - marge);
  const hy = hauteur * marge, by = hauteur * (1 - marge);
  const retrait = (dx - gx) * biais / 2;
  const coins = [
    { x: gx + retrait, y: hy },      /* haut gauche */
    { x: dx - retrait, y: hy },      /* haut droit  */
    { x: dx, y: by },                /* bas droit   */
    { x: gx, y: by },                /* bas gauche  */
  ];

  /* Remplissage par test d'appartenance au quadrilatère convexe : le même
     signe de produit vectoriel sur les quatre côtés. */
  const dedans = (px, py) => {
    let signe = 0;
    for (let i = 0; i < 4; i++) {
      const a = coins[i], b = coins[(i + 1) % 4];
      const c = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
      if (c === 0) continue;
      const s = c > 0 ? 1 : -1;
      if (signe === 0) signe = s;
      else if (s !== signe) return false;
    }
    return true;
  };

  for (let py = 0; py < hauteur; py++) {
    for (let px = 0; px < largeur; px++) {
      if (dedans(px + 0.5, py + 0.5)) y[py * largeur + px] = 236;
    }
  }

  /* Quelques lignes sombres : du texte, pour que l'image ressemble à un
     document et pas à un carré blanc. */
  if (texte) {
    const lignes = 9;
    for (let l = 0; l < lignes; l++) {
      const ly = Math.round(hauteur * (marge + 0.07 + l * 0.08));
      const longueur = 0.52 + ((l * 37) % 30) / 100;
      for (let px = Math.round(largeur * (marge + 0.06));
        px < Math.round(largeur * (marge + 0.06 + longueur)); px++) {
        for (let e = 0; e < Math.max(2, Math.round(hauteur / 150)); e++) {
          const yy = ly + e;
          if (yy >= 0 && yy < hauteur && px >= 0 && px < largeur &&
              y[yy * largeur + px] > 150) {
            y[yy * largeur + px] = 48;
          }
        }
      }
    }
  }

  return { y, coins };
}

/* ─────────────────────────────── PNG ────────────────────────────────── */

let tableCrc = null;
function crc32(buf) {
  if (!tableCrc) {
    tableCrc = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      tableCrc[n] = c >>> 0;
    }
  }
  let c = 0xFFFFFFFF;
  for (const b of buf) c = tableCrc[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/** Un PNG en niveaux de gris, écrit en RVB pour rester simple à relire. */
function png(largeur, hauteur, options = {}) {
  const { y } = luminance(largeur, hauteur, options);
  const bloc = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const t = Buffer.from(type, "latin1");
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largeur, 0); ihdr.writeUInt32BE(hauteur, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  const lignes = [];
  for (let py = 0; py < hauteur; py++) {
    const ligne = Buffer.alloc(1 + largeur * 3);
    for (let px = 0; px < largeur; px++) {
      const v = y[py * largeur + px];
      ligne[1 + px * 3] = v; ligne[2 + px * 3] = v; ligne[3 + px * 3] = v;
    }
    lignes.push(ligne);
  }
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    bloc("IHDR", ihdr),
    bloc("IDAT", zlib.deflateSync(Buffer.concat(lignes))),
    bloc("IEND", Buffer.alloc(0)),
  ]);
}

/* ─────────────────────────────── Y4M ────────────────────────────────── */

/**
 * Une vidéo Y4M IMMOBILE : la détection de stabilité exige que le cadre ne
 * bouge plus pendant plusieurs images consécutives. Une vidéo qui tremble
 * empêcherait la capture automatique de se déclencher, et l'essai conclurait
 * à tort que la stabilité ne marche pas.
 */
function y4m(largeur, hauteur, images = 120, options = {}) {
  const { y } = luminance(largeur, hauteur, options);
  const u = Buffer.alloc((largeur / 2) * (hauteur / 2), 128);
  const v = Buffer.alloc((largeur / 2) * (hauteur / 2), 128);
  const entete = Buffer.from(
    `YUV4MPEG2 W${largeur} H${hauteur} F15:1 Ip A1:1 C420mpeg2\n`, "latin1");
  const morceaux = [entete];
  const plan = Buffer.from(y);
  for (let i = 0; i < images; i++) {
    morceaux.push(Buffer.from("FRAME\n", "latin1"), plan, u, v);
  }
  return Buffer.concat(morceaux);
}

module.exports = { luminance, png, y4m };

/* Appelé directement : écrit les fichiers demandés. */
if (require.main === module) {
  const fs = require("fs");
  const dossier = process.argv[2] || "/tmp/papier";
  fs.mkdirSync(dossier, { recursive: true });
  fs.writeFileSync(`${dossier}/page-debout.png`, png(900, 1200));
  fs.writeFileSync(`${dossier}/page-couchee.png`, png(1200, 900));
  /* 640×480 : la taille que la caméra simulée de Chromium accepte sans
     rechigner, et un multiple de 2 sur les deux axes pour le 4:2:0. */
  fs.writeFileSync(`${dossier}/camera.y4m`, y4m(640, 480, 16));
  for (const f of ["page-debout.png", "page-couchee.png", "camera.y4m"]) {
    console.log(`${dossier}/${f} — ${fs.statSync(`${dossier}/${f}`).size} octets`);
  }
}
