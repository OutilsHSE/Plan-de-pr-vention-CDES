/* ============================================================================
   Générateur de QR code — mode octet, correction M, versions 1 à 10.
   Sans aucune bibliothèque : l'affichage de chantier doit pouvoir être produit
   hors ligne, sur le téléphone du conducteur, sans rien télécharger.
   Renvoie une matrice de booléens (true = module noir).
   ========================================================================= */

/* nombre d'octets de données par version, correction M */
const QR_DATA = [16, 28, 44, 64, 86, 108, 124, 154, 182, 216];
/* nombre total d'octets (données + correction) par version */
const QR_TOTAL = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
/* octets de correction par bloc, et découpage en blocs [nb1, nb2] */
const QR_ECC = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const QR_BLOCS = [[1, 0], [1, 0], [1, 0], [2, 0], [2, 0], [4, 0], [4, 0], [2, 2], [3, 2], [4, 1]];
/* centres des motifs d'alignement */
const QR_ALIGN = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
                  [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
/* information de version (versions 7 et au-delà) */
const QR_VER_INFO = { 7: 0x07C94, 8: 0x085BC, 9: 0x09A99, 10: 0x0A4D3 };
/* information de format, niveau M, un mot par masque */
const QR_FMT = [0x5412, 0x5125, 0x5E7C, 0x5B4B, 0x45F9, 0x40CE, 0x4F97, 0x4AA0];

/* ------------------------- arithmétique GF(256) --------------------------- */
const QR_EXP = new Uint8Array(512), QR_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    QR_EXP[i] = x; QR_LOG[x] = i;
    x <<= 1; if (x & 0x100) x ^= 0x11D;
  }
  for (let i = 255; i < 512; i++) QR_EXP[i] = QR_EXP[i - 255];
})();
function qrMul(a, b) { return (a && b) ? QR_EXP[QR_LOG[a] + QR_LOG[b]] : 0; }

/** Polynôme générateur de degré n. */
function qrGenerateur(n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const suivant = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      suivant[j] ^= g[j];
      suivant[j + 1] ^= qrMul(g[j], QR_EXP[i]);
    }
    g = suivant;
  }
  return g;
}
/** Octets de correction d'erreur d'un bloc. */
function qrCorrection(donnees, nbEcc) {
  const g = qrGenerateur(nbEcc);
  const reste = new Array(nbEcc).fill(0);
  for (const octet of donnees) {
    const facteur = octet ^ reste[0];
    reste.shift(); reste.push(0);
    if (facteur) for (let j = 0; j < nbEcc; j++) reste[j] ^= qrMul(g[j + 1], facteur);
  }
  return reste;
}

/* ------------------------------ encodage ---------------------------------- */
function qrEncoder(texte) {
  const octets = Array.from(new TextEncoder().encode(texte));
  let version = 0;
  for (let v = 1; v <= 10; v++) {
    const compteur = v < 10 ? 8 : 16;                  // longueur du compteur
    if (octets.length + 2 + Math.ceil(compteur / 8) <= QR_DATA[v - 1]) { version = v; break; }
  }
  if (!version) return null;                            // texte trop long

  /* --- flux de bits : mode 0100, compteur, données, terminateur --- */
  const bits = [];
  const pousser = (valeur, n) => { for (let i = n - 1; i >= 0; i--) bits.push((valeur >> i) & 1); };
  pousser(0b0100, 4);
  pousser(octets.length, version < 10 ? 8 : 16);
  octets.forEach(o => pousser(o, 8));
  const capacite = QR_DATA[version - 1] * 8;
  for (let i = 0; i < 4 && bits.length < capacite; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const mots = [];
  for (let i = 0; i < bits.length; i += 8) {
    let o = 0; for (let j = 0; j < 8; j++) o = (o << 1) | bits[i + j];
    mots.push(o);
  }
  const bourrage = [0xEC, 0x11];
  for (let i = 0; mots.length < QR_DATA[version - 1]; i++) mots.push(bourrage[i % 2]);

  /* --- découpage en blocs et correction d'erreur --- */
  const [n1, n2] = QR_BLOCS[version - 1];
  const nbBlocs = n1 + n2;
  const tailleCourte = Math.floor(QR_DATA[version - 1] / nbBlocs);
  const nbLongs = QR_DATA[version - 1] - tailleCourte * nbBlocs;   // blocs à +1 octet
  const blocs = [], eccs = [];
  let p = 0;
  for (let b = 0; b < nbBlocs; b++) {
    const taille = tailleCourte + (b >= nbBlocs - nbLongs ? 1 : 0);
    const bloc = mots.slice(p, p + taille); p += taille;
    blocs.push(bloc);
    eccs.push(qrCorrection(bloc, QR_ECC[version - 1]));
  }
  /* entrelacement */
  const finaux = [];
  const maxD = Math.max(...blocs.map(b => b.length));
  for (let i = 0; i < maxD; i++) blocs.forEach(b => { if (i < b.length) finaux.push(b[i]); });
  for (let i = 0; i < QR_ECC[version - 1]; i++) eccs.forEach(e => finaux.push(e[i]));

  /* --- construction de la matrice --- */
  const taille = version * 4 + 17;
  const m = Array.from({ length: taille }, () => new Array(taille).fill(null));
  const reserve = Array.from({ length: taille }, () => new Array(taille).fill(false));
  const poser = (x, y, v) => { if (x >= 0 && y >= 0 && x < taille && y < taille) { m[y][x] = v; reserve[y][x] = true; } };

  const motifFixe = (cx, cy) => {                       // motif de repérage 7×7
    for (let dy = -1; dy <= 7; dy++) for (let dx = -1; dx <= 7; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= taille || y >= taille) continue;
      const bord = dx === -1 || dy === -1 || dx === 7 || dy === 7;
      const anneau = (dx === 0 || dx === 6 || dy === 0 || dy === 6);
      const centre = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
      poser(x, y, bord ? false : (anneau || centre));
    }
  };
  motifFixe(0, 0); motifFixe(taille - 7, 0); motifFixe(0, taille - 7);

  QR_ALIGN[version - 1].forEach(cy => QR_ALIGN[version - 1].forEach(cx => {
    if ((cx <= 8 && cy <= 8) || (cx >= taille - 9 && cy <= 8) || (cx <= 8 && cy >= taille - 9)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
      poser(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));

  for (let i = 8; i < taille - 8; i++) { poser(i, 6, i % 2 === 0); poser(6, i, i % 2 === 0); }
  poser(8, taille - 8, true);                            // module sombre

  for (let i = 0; i <= 8; i++) { poser(i, 8, m[8][i]); poser(8, i, m[i][8]); }
  for (let i = 0; i < 9; i++) { reserve[8][i] = true; reserve[i][8] = true; }
  for (let i = 0; i < 8; i++) { reserve[8][taille - 1 - i] = true; reserve[taille - 1 - i][8] = true; }
  // information de version : un bloc 3×6 en haut à droite, 6×3 en bas à gauche
  if (version >= 7) for (let i = 0; i < 18; i++) {
    const a = Math.floor(i / 3), b = i % 3;
    reserve[a][taille - 11 + b] = true;      // haut droite
    reserve[taille - 11 + b][a] = true;      // bas gauche
  }

  /* --- pose des données en zigzag --- */
  let bit = 0, montant = true;
  const flux = [];
  finaux.forEach(o => { for (let i = 7; i >= 0; i--) flux.push((o >> i) & 1); });
  for (let col = taille - 1; col > 0; col -= 2) {
    if (col === 6) col--;                                // la colonne de synchro
    for (let k = 0; k < taille; k++) {
      const y = montant ? taille - 1 - k : k;
      for (let d = 0; d < 2; d++) {
        const x = col - d;
        if (reserve[y][x]) continue;
        m[y][x] = bit < flux.length ? !!flux[bit] : false;
        bit++;
      }
    }
    montant = !montant;
  }

  /* --- masques : on essaie les 8 et on garde le moins pénalisé --- */
  const masques = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    (x, y) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
  ];
  let meilleur = null, meilleurScore = Infinity;
  for (let k = 0; k < 8; k++) {
    const c = m.map(l => l.slice());
    for (let y = 0; y < taille; y++) for (let x = 0; x < taille; x++)
      if (!reserve[y][x] && masques[k](x, y)) c[y][x] = !c[y][x];
    /* format */
    const fmt = QR_FMT[k];
    for (let i = 0; i < 15; i++) {
      const b = ((fmt >> i) & 1) === 1;
      if (i < 6) c[i][8] = b;
      else if (i < 8) c[i + 1][8] = b;
      else if (i === 8) c[8][7] = b;
      else c[8][15 - i - 1] = b;
      if (i < 8) c[8][taille - 1 - i] = b;
      else c[taille - 15 + i][8] = b;
    }
    if (version >= 7) {
      const vi = QR_VER_INFO[version];
      for (let i = 0; i < 18; i++) {
        const v = ((vi >> i) & 1) === 1;
        const a = Math.floor(i / 3), b = i % 3;
        c[a][taille - 11 + b] = v;           // haut droite
        c[taille - 11 + b][a] = v;           // bas gauche
      }
    }
    const s = qrPenalite(c);
    if (s < meilleurScore) { meilleurScore = s; meilleur = c; }
  }
  return meilleur;
}

/** Pénalité normalisée : quatre règles de la norme, version compacte. */
function qrPenalite(m) {
  const n = m.length; let p = 0;
  const serie = ligne => {
    let c = 1;
    for (let i = 1; i < ligne.length; i++) {
      if (ligne[i] === ligne[i - 1]) { c++; if (c === 5) p += 3; else if (c > 5) p++; }
      else c = 1;
    }
  };
  for (let y = 0; y < n; y++) serie(m[y]);
  for (let x = 0; x < n; x++) serie(m.map(l => l[x]));
  for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++)
    if (m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
  const motif = [true, false, true, true, true, false, true, false, false, false, false];
  const cherche = ligne => {
    for (let i = 0; i + 11 <= ligne.length; i++) {
      let ok = true, okInv = true;
      for (let j = 0; j < 11; j++) {
        if (ligne[i + j] !== motif[j]) ok = false;
        if (ligne[i + j] !== motif[10 - j]) okInv = false;
      }
      if (ok || okInv) p += 40;
    }
  };
  for (let y = 0; y < n; y++) cherche(m[y]);
  for (let x = 0; x < n; x++) cherche(m.map(l => l[x]));
  let noirs = 0;
  m.forEach(l => l.forEach(v => { if (v) noirs++; }));
  p += Math.floor(Math.abs(noirs * 100 / (n * n) - 50) / 5) * 10;
  return p;
}

/** QR code en SVG, prêt à être inséré dans une page ou imprimé. */
function qrSVG(texte, cote, marge) {
  const m = qrEncoder(texte);
  if (!m) return '';
  const n = m.length, q = marge === undefined ? 4 : marge, total = n + 2 * q;
  let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++)
    if (m[y][x]) d += 'M' + (x + q) + ' ' + (y + q) + 'h1v1h-1z';
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + cote + '" height="' + cote +
    '" viewBox="0 0 ' + total + ' ' + total + '" shape-rendering="crispEdges" role="img">' +
    '<rect width="' + total + '" height="' + total + '" fill="#fff"/>' +
    '<path d="' + d + '" fill="#000"/></svg>';
}
