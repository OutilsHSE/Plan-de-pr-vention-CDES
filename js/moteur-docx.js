/* ============================================================================
   MOTEUR .docx — 100 % navigateur, sans aucune bibliothèque externe.
   Principe : on ne reconstruit JAMAIS la mise en page. On ouvre la trame Word
   de CDES, on remplace le texte et on supprime les lignes inutiles dans le XML,
   puis on referme le fichier. Tout ce qu'on ne touche pas est recopié octet
   pour octet — styles, en-têtes, images, numérotation : rien ne bouge.
   ========================================================================= */

/* ---------------------------- ZIP : lecture ------------------------------ */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();
function crc32(u8) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Lit un .docx (ou tout ZIP) et renvoie la liste de ses entrées.
 * Les données restent COMPRESSÉES : on ne décompresse que ce qu'on modifie.
 */
function zipLire(buffer) {
  const dv = new DataView(buffer), u8 = new Uint8Array(buffer);
  // fin du répertoire central (EOCD) : on remonte depuis la fin
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Fichier .docx illisible (fin d’archive introuvable)');
  const nb = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const entrees = [];
  for (let i = 0; i < nb; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Répertoire d’archive corrompu');
    const methode  = dv.getUint16(p + 10, true);
    const modTime  = dv.getUint16(p + 12, true);
    const modDate  = dv.getUint16(p + 14, true);
    const crc      = dv.getUint32(p + 16, true);
    const tailleC  = dv.getUint32(p + 20, true);
    const tailleD  = dv.getUint32(p + 24, true);
    const lnom     = dv.getUint16(p + 28, true);
    const lextra   = dv.getUint16(p + 30, true);
    const lcom     = dv.getUint16(p + 32, true);
    const offset   = dv.getUint32(p + 42, true);
    const nom      = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + lnom));
    // en-tête local : les longueurs peuvent différer du répertoire central
    const lnomL   = dv.getUint16(offset + 26, true);
    const lextraL = dv.getUint16(offset + 28, true);
    const debut   = offset + 30 + lnomL + lextraL;
    entrees.push({ nom, methode, modTime, modDate, crc, tailleD,
                   donnees: u8.subarray(debut, debut + tailleC) });
    p += 46 + lnom + lextra + lcom;
  }
  return entrees;
}

async function inflate(u8) {
  const s = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
async function deflate(u8) {
  const s = new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

/** Renvoie le texte d'une entrée (décompressée si besoin). */
async function zipTexte(entree) {
  const brut = entree.methode === 0 ? entree.donnees : await inflate(entree.donnees);
  return new TextDecoder('utf-8').decode(brut);
}

/* ---------------------------- ZIP : écriture ----------------------------- */

/**
 * Fabrique une archive .zip à partir de fichiers déjà constitués.
 * Sert à livrer le document Word ET ses annexes PDF en un seul téléchargement :
 * Word est incapable d'absorber un PDF dans son propre fichier.
 */
async function zipSimple(fichiers) {
  const entrees = [];
  for (const f of fichiers) {
    const brut = new Uint8Array(await f.blob.arrayBuffer());
    entrees.push({ nom: f.nom, methode: 8, modTime: 0, modDate: 0x2821,
      crc: crc32(brut), tailleD: brut.length, donnees: await deflate(brut) });
  }
  return zipEcrire(entrees, 'application/zip');
}

async function zipEcrire(entrees, mime) {
  const morceaux = [], central = [];
  let offset = 0;
  for (const e of entrees) {
    let donnees = e.donnees, methode = e.methode, crc = e.crc, tailleD = e.tailleD;
    if (e.nouveauTexte !== undefined) {                 // entrée modifiée
      const brut = new TextEncoder().encode(e.nouveauTexte);
      crc = crc32(brut); tailleD = brut.length;
      donnees = await deflate(brut); methode = 8;
    }
    const nom = new TextEncoder().encode(e.nom);
    const loc = new Uint8Array(30 + nom.length);
    const dvl = new DataView(loc.buffer);
    dvl.setUint32(0, 0x04034b50, true);
    dvl.setUint16(4, 20, true);                          // version nécessaire
    dvl.setUint16(6, 0, true);                           // pas de descripteur
    dvl.setUint16(8, methode, true);
    dvl.setUint16(10, e.modTime || 0, true);
    dvl.setUint16(12, e.modDate || 0x2821, true);
    dvl.setUint32(14, crc, true);
    dvl.setUint32(18, donnees.length, true);
    dvl.setUint32(22, tailleD, true);
    dvl.setUint16(26, nom.length, true);
    dvl.setUint16(28, 0, true);
    loc.set(nom, 30);
    morceaux.push(loc, donnees);

    const cen = new Uint8Array(46 + nom.length);
    const dvc = new DataView(cen.buffer);
    dvc.setUint32(0, 0x02014b50, true);
    dvc.setUint16(4, 20, true); dvc.setUint16(6, 20, true);
    dvc.setUint16(8, 0, true);
    dvc.setUint16(10, methode, true);
    dvc.setUint16(12, e.modTime || 0, true);
    dvc.setUint16(14, e.modDate || 0x2821, true);
    dvc.setUint32(16, crc, true);
    dvc.setUint32(20, donnees.length, true);
    dvc.setUint32(24, tailleD, true);
    dvc.setUint16(28, nom.length, true);
    dvc.setUint32(42, offset, true);
    cen.set(nom, 46);
    central.push(cen);
    offset += loc.length + donnees.length;
  }
  let tailleCen = 0; central.forEach(c => tailleCen += c.length);
  const fin = new Uint8Array(22);
  const dvf = new DataView(fin.buffer);
  dvf.setUint32(0, 0x06054b50, true);
  dvf.setUint16(8, central.length, true);
  dvf.setUint16(10, central.length, true);
  dvf.setUint32(12, tailleCen, true);
  dvf.setUint32(16, offset, true);
  return new Blob(morceaux.concat(central, [fin]),
    { type: mime || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

/* ------------------------ Manipulation du document ----------------------- */

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/* ============================ IMAGES ======================================
   Insérer une photo dans un .docx demande trois choses : le fichier dans
   word/media, une relation dans word/_rels/document.xml.rels, et une balise
   <w:drawing> dans le paragraphe. On ajoute, on ne remplace jamais : les
   images de la trame (logos, pictogrammes) gardent leurs propres relations. */
const EMU_PAR_CM = 360000;

/** Ajoute le fichier image à l'archive et renvoie l'identifiant de relation. */
async function ajouterMedia(entrees, u8, ext, partie) {
  ext = String(ext || 'png').toLowerCase().replace('jpeg', 'jpg');
  const mime = ext === 'png' ? 'image/png' : (ext === 'gif' ? 'image/gif' : 'image/jpeg');
  const extXml = ext === 'jpg' ? 'jpg' : ext;

  const ct = entrees.find(e => e.nom === '[Content_Types].xml');
  if (!ct) throw new Error('Trame .docx incomplète ([Content_Types].xml absent)');
  let txt = ct.nouveauTexte !== undefined ? ct.nouveauTexte : await zipTexte(ct);
  if (!new RegExp('Extension="' + extXml + '"', 'i').test(txt))
    txt = txt.replace('<Default', '<Default Extension="' + extXml + '" ContentType="' + mime + '"/><Default');
  ct.nouveauTexte = txt;

  const relNom = partie ? ('word/_rels/' + partie.replace('word/', '') + '.rels')
                        : 'word/_rels/document.xml.rels';
  const rel = entrees.find(e => e.nom === relNom);
  if (!rel) throw new Error('Trame .docx incomplète (relations de ' + relNom + ' absentes)');
  let rtxt = rel.nouveauTexte !== undefined ? rel.nouveauTexte : await zipTexte(rel);
  let n = 900;
  (rtxt.match(/Id="rId(\d+)"/g) || []).forEach(m => {
    const v = parseInt(m.replace(/\D/g, ''), 10); if (v >= n) n = v + 1;
  });
  const rid = 'rId' + n;
  let i = 1;
  while (entrees.some(e => e.nom === 'word/media/pdp' + i + '.' + extXml)) i++;
  const cible = 'media/pdp' + i + '.' + extXml;
  rtxt = rtxt.replace('</Relationships>', '<Relationship Id="' + rid +
    '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="' +
    cible + '"/></Relationships>');
  rel.nouveauTexte = rtxt;

  entrees.push({ nom: 'word/' + cible, methode: 8, modTime: 0, modDate: 0x2821,
    crc: crc32(u8), tailleD: u8.length, donnees: await deflate(u8) });
  return rid;
}

/** Construit la balise <w:drawing> d'une image en ligne (dimensions en EMU). */
function dessinInline(doc, rid, cx, cy, id, nom) {
  const e = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const xml =
    '<w:drawing xmlns:w="' + W + '"' +
    ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"' +
    ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<wp:inline distT="0" distB="0" distL="0" distR="0">' +
    '<wp:extent cx="' + cx + '" cy="' + cy + '"/>' +
    '<wp:effectExtent l="0" t="0" r="0" b="0"/>' +
    '<wp:docPr id="' + id + '" name="' + e(nom) + '"/>' +
    '<wp:cNvGraphicFramePr><a:graphicFrameLocks' +
    ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
    '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
    '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    '<pic:nvPicPr><pic:cNvPr id="' + id + '" name="' + e(nom) + '"/><pic:cNvPicPr/></pic:nvPicPr>' +
    '<pic:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
    '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm>' +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
    '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>';
  const d = new DOMParser().parseFromString(xml, 'application/xml');
  if (d.querySelector('parsererror')) throw new Error('Image : XML invalide');
  return doc.importNode(d.documentElement, true);
}

/** Un run contenant uniquement une image. */
function runImage(doc, dessin) {
  const r = doc.createElementNS(W, 'w:r');
  r.appendChild(dessin);
  return r;
}

/** Texte concaténé d'un élément (paragraphe, cellule, ligne…). */
function texteDe(el) {
  let s = '';
  el.querySelectorAll('t').forEach(t => { s += t.textContent; });
  return s;
}
function normal(s) {
  return String(s || '').replace(/ /g, ' ').replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Écrit un texte dans un paragraphe SANS toucher à sa mise en forme :
 * on garde le premier run tel quel (police, taille, couleur, gras…),
 * on y met tout le texte, et on vide les runs suivants.
 * Les retours à la ligne deviennent de vrais <w:br/>.
 */
function porteUneImage(el) {
  return !!(el.querySelector('drawing') || el.querySelector('pict') || el.querySelector('object'));
}

/* ------------------- typographie : ne pas hériter des pictogrammes ---------
   Dans la trame, les cases à cocher ☒ / ☐ sont des glyphes MS Gothic, souvent
   enfermés dans un contrôle de contenu <w:sdt>. L'ancienne écriture réutilisait
   ce run-là : tout le texte saisi ressortait en MS Gothic, plus gros et plus
   large que le reste du document. C'est ce qui apparaissait comme « les polices
   d'écriture sont nulles ». On distingue donc désormais le run pictogramme
   (qui garde son glyphe) du run de texte (qui reçoit la saisie).            */
const POLICES_PICTO = ['ms gothic', 'ms mincho', 'ms pgothic', 'wingdings', 'wingdings 2',
  'wingdings 3', 'webdings', 'symbol', 'segoe ui symbol', 'segoe ui emoji', 'mv boli'];

function rPrDe(r) {
  return Array.from(r.children).find(c => c.localName === 'rPr') || null;
}
function policeDuRun(r) {
  const rpr = rPrDe(r); if (!rpr) return '';
  const f = Array.from(rpr.children).find(c => c.localName === 'rFonts'); if (!f) return '';
  const lis = n => (f.getAttributeNS(W, n) || f.getAttribute('w:' + n) || '').toLowerCase();
  return [lis('ascii'), lis('hAnsi'), lis('eastAsia')].filter(Boolean).join('|');
}
/** Un run qui ne sert qu'à porter une case à cocher ou une puce symbole. */
function estRunPicto(r) {
  const pol = policeDuRun(r);
  if (POLICES_PICTO.some(p => pol.split('|').indexOf(p) >= 0)) return true;
  const t = Array.from(r.getElementsByTagNameNS(W, 't')).map(x => x.textContent).join('');
  return /[☒☐✔✓✗]/.test(t) && /^[\s☒☐✔✓✗•·●\-]*$/.test(t);
}
/** Le <w:sdt> case à cocher qui englobe ce run, s'il y en a un. */
function sdtDuRun(r, p) {
  let n = r.parentNode;
  while (n && n !== p) { if (n.localName === 'sdt') return n; n = n.parentNode; }
  return null;
}
/** Remonte jusqu'à l'enfant direct du paragraphe. */
function enfantDirect(el, p) {
  let n = el;
  while (n && n.parentNode && n.parentNode !== p) n = n.parentNode;
  return (n && n.parentNode === p) ? n : null;
}
/** Met à jour l'état réel de la case à cocher Word, pas seulement le glyphe. */
function majEtatSdt(sdt, coche) {
  if (!sdt) return;
  const cb = Array.from(sdt.getElementsByTagName('*')).find(e => e.localName === 'checkbox');
  if (!cb) return;
  const ck = Array.from(cb.children).find(c => c.localName === 'checked');
  if (!ck) return;
  Array.from(ck.attributes).forEach(a => { if (a.localName === 'val') ck.setAttribute(a.name, coche ? '1' : '0'); });
}
/* Attributs purement décoratifs du gabarit : ils habillaient le texte
   d'exemple de la trame et n'ont aucune raison de s'appliquer à la saisie.
   Les petites majuscules transformaient « Intervention ponctuelle » en
   « INTERVENTION PONCTUELLE » au milieu d'un tableau en casse normale. */
const HABILLAGE_GABARIT = ['smallCaps', 'caps', 'strike', 'dstrike', 'vanish', 'highlight', 'em', 'shadow', 'outline'];
function rprPropre(rpr) {
  if (!rpr) return null;
  const c = rpr.cloneNode(true);
  Array.from(c.children).forEach(e => {
    if (HABILLAGE_GABARIT.indexOf(e.localName) >= 0) c.removeChild(e);
  });
  return c;
}
/** Un run porteur de texte, avec une mise en forme donnée. */
function runTexte(doc, rpr, texte, avecSaut) {
  const r = doc.createElementNS(W, 'w:r');
  if (rpr) r.appendChild(rpr.cloneNode(true));
  if (avecSaut) r.appendChild(doc.createElementNS(W, 'w:br'));
  const t = doc.createElementNS(W, 'w:t');
  t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
  t.textContent = texte;
  r.appendChild(t);
  return r;
}
/**
 * Construit les runs qui reçoivent le texte. Les ☒ / ☐ en tête de ligne
 * gardent la police symbole de la trame (sinon Word affiche un carré vide),
 * le reste prend la police du texte courant.
 */
function rprSymbole(doc, rprTexte) {
  const c = rprTexte ? rprTexte.cloneNode(true) : doc.createElementNS(W, 'w:rPr');
  Array.from(c.children).forEach(e => { if (e.localName === 'rFonts') c.removeChild(e); });
  const f = doc.createElementNS(W, 'w:rFonts');
  f.setAttributeNS(W, 'w:ascii', 'Segoe UI Symbol');
  f.setAttributeNS(W, 'w:hAnsi', 'Segoe UI Symbol');
  f.setAttributeNS(W, 'w:cs', 'Segoe UI Symbol');
  c.insertBefore(f, c.firstChild);
  return c;
}
function runsDEcriture(doc, rprTexte, rprPicto, lignes) {
  const out = [];
  const picto = rprPicto || (lignes.some(l => /^[☒☐]/.test(l)) ? rprSymbole(doc, rprTexte) : null);
  lignes.forEach((ligne, i) => {
    const m = picto ? /^([☒☐])([  \s]*)/.exec(ligne) : null;
    if (m) {
      out.push(runTexte(doc, picto, m[1] + ' ', i > 0));
      out.push(runTexte(doc, rprTexte, ligne.slice(m[0].length), false));
    } else {
      out.push(runTexte(doc, rprTexte, ligne, i > 0));
    }
  });
  return out;
}

/**
 * Écrit un texte dans un paragraphe SANS toucher à sa mise en page :
 * la case à cocher éventuelle reste une vraie case à cocher, et le texte
 * prend la police du premier run de TEXTE (jamais celle du pictogramme).
 * Les retours à la ligne deviennent de vrais <w:br/>.
 */
function ecrireDansParagraphe(p, texte) {
  // on ne touche JAMAIS à un run qui porte une image : c'est ainsi qu'on a
  // effacé les logos VNF et CDES de la page de garde lors du premier essai.
  const doc = p.ownerDocument;
  const runs = Array.from(p.getElementsByTagNameNS(W, 'r'))
    .filter(r => r.getElementsByTagNameNS(W, 't').length && !porteUneImage(r));
  if (!runs.length) return false;

  const lignes = String(texte).split('\n');

  // 0. un texte sur plusieurs lignes dans un paragraphe JUSTIFIÉ sort avec des
  //    blancs énormes entre les mots (Word étire chaque ligne coupée par un
  //    saut) : on repasse ce paragraphe à gauche, rien d'autre ne change
  if (lignes.length > 1) {
    const jc = Array.from(p.getElementsByTagNameNS(W, 'jc')).find(j => j.parentNode && j.parentNode.parentNode === p);
    if (jc && /^(both|distribute)$/.test(jc.getAttributeNS(W, 'val') || jc.getAttribute('w:val') || ''))
      jc.setAttributeNS(W, 'w:val', 'left');
  }

  // 1. la case à cocher de tête revient à la case, pas au texte
  const picto = runs.find(estRunPicto) || null;
  const sdt = picto ? sdtDuRun(picto, p) : null;
  const m = /^([☒☐])[  \s]*/.exec(lignes[0]);
  let gardePicto = null;
  if (picto && m) {
    gardePicto = picto;
    const coche = m[1] === '☒';
    lignes[0] = lignes[0].slice(m[0].length);
    const ts = Array.from(picto.getElementsByTagNameNS(W, 't'));
    ts.slice(1).forEach(t => t.parentNode.removeChild(t));
    Array.from(picto.getElementsByTagNameNS(W, 'br')).forEach(b => b.parentNode.removeChild(b));
    ts[0].textContent = coche ? '☒ ' : '☐ ';
    ts[0].setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
    majEtatSdt(sdt, coche);
  }

  // 2. modèle typographique : le premier run de texte qui n'est pas un picto
  const aEcrire = runs.filter(r => r !== gardePicto);
  const modele = aEcrire.find(r => !estRunPicto(r)) || null;
  const rprModele = rprPropre(modele ? rPrDe(modele) : (gardePicto ? rprSansPicto(gardePicto, p) : null));
  // sans taille explicite, le texte prenait la taille par défaut du style et
  // ne s'accordait plus avec la case à cocher voisine (« Réhabilitation
  // écologique » sortait plus gros qu'« Intervention ponctuelle »)
  if (rprModele && gardePicto) heriterTaille(rprModele, rPrDe(gardePicto));

  // 3. point d'insertion : juste après la case à cocher si elle existe,
  //    sinon à la place du premier run de texte
  const repere = enfantDirect(gardePicto ? (sdt || gardePicto) : (aEcrire[0] || runs[0]), p);
  const rprPicto = gardePicto ? rPrDe(gardePicto) : null;
  const neufs = runsDEcriture(doc, rprModele, rprPicto, lignes);
  let apres = repere;
  neufs.forEach(n => {
    if (apres) { p.insertBefore(n, apres.nextSibling); apres = n; } else p.appendChild(n);
  });

  // 4. on retire les anciens runs de texte (la case à cocher est préservée)
  aEcrire.forEach(r => { if (r.parentNode) r.parentNode.removeChild(r); });
  // les <w:sdt> devenus vides de texte (autres cases de la ligne) partent aussi
  Array.from(p.getElementsByTagNameNS(W, 'sdt')).forEach(s => {
    if (s === sdt) return;
    if (!s.getElementsByTagNameNS(W, 't').length && !porteUneImage(s) && s.parentNode)
      s.parentNode.removeChild(s);
  });
  return true;
}
/** Copie w:sz / w:szCs d'une mise en forme vers une autre qui n'en a pas. */
function heriterTaille(rpr, source) {
  if (!rpr || !source) return;
  ['sz', 'szCs'].forEach(n => {
    if (Array.from(rpr.children).some(c => c.localName === n)) return;
    const e = Array.from(source.children).find(c => c.localName === n);
    if (e) rpr.appendChild(e.cloneNode(true));
  });
}
/** Vrai si ce run vit À L'INTÉRIEUR d'un dessin (zone de texte d'une forme) :
    il ne faut alors jamais y toucher. */
function estDansImage(el, limite) {
  let n = el.parentNode;
  while (n && n !== limite) {
    if (n.localName === 'drawing' || n.localName === 'pict' || n.localName === 'object') return true;
    n = n.parentNode;
  }
  return false;
}
/** Retire gras et couleur des runs de texte d'un paragraphe : les gabarits de
    la trame habillaient leurs exemples, pas la saisie de l'utilisateur. */
function nettoyerDecor(p) {
  const purger = rpr => {
    if (!rpr) return;
    Array.from(rpr.children).forEach(e => {
      if (['b', 'bCs', 'i', 'iCs', 'color', 'u', 'sz', 'szCs', 'rFonts'].indexOf(e.localName) >= 0)
        rpr.removeChild(e);
    });
  };
  Array.from(p.getElementsByTagNameNS(W, 'r')).forEach(r => {
    if (!r.getElementsByTagNameNS(W, 't').length || estRunPicto(r)) return;
    purger(rPrDe(r));
  });
  // la marque de paragraphe aussi : certains rendus en héritent
  const ppr = Array.from(p.children).find(c => c.localName === 'pPr');
  if (ppr) purger(Array.from(ppr.children).find(c => c.localName === 'rPr'));
}

/**
 * Écrit dans une cellule en PRÉSERVANT sa structure : les images restent, les
 * paragraphes vides d'espacement restent (c'est eux qui posent le texte sous
 * le logo), seuls les paragraphes de texte sont remplacés par la saisie.
 * C'est l'écriture des cellules de la page de garde.
 */
function ecrireCellulePreservant(tc, texte, sansDecor) {
  const tous = Array.from(tc.getElementsByTagNameNS(W, 'p'));
  if (!tous.length) return false;
  // les paragraphes porteurs d'images perdent leur texte périphérique
  // (le « Chemin de l'Usine » qui doublait l'adresse), jamais leurs images
  tous.forEach(p => {
    if (!porteUneImage(p)) return;
    Array.from(p.getElementsByTagNameNS(W, 'r')).forEach(r => {
      if (r.getElementsByTagNameNS(W, 't').length && !porteUneImage(r) &&
          !estDansImage(r, p)) r.parentNode.removeChild(r);
    });
  });
  const libres = tous.filter(p => !porteUneImage(p));
  if (!libres.length) return false;
  const cible = libres.find(p => p.getElementsByTagNameNS(W, 't').length) || libres[0];
  libres.forEach(p => {
    if (p !== cible && p.getElementsByTagNameNS(W, 't').length && p.parentNode)
      p.parentNode.removeChild(p);
  });
  if (!cible.getElementsByTagNameNS(W, 't').length) {
    const r = cible.ownerDocument.createElementNS(W, 'w:r');
    const t = cible.ownerDocument.createElementNS(W, 'w:t');
    t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
    r.appendChild(t); cible.appendChild(r);
  }
  const ok = ecrireDansParagraphe(cible, texte);
  if (ok && sansDecor) nettoyerDecor(cible);
  return ok;
}

/** Interdit à Word de couper cette ligne de tableau entre deux pages. */
function interdireCoupure(tr) {
  if (!tr) return;
  const doc = tr.ownerDocument;
  let trPr = Array.from(tr.children).find(c => c.localName === 'trPr');
  if (!trPr) { trPr = doc.createElementNS(W, 'w:trPr'); tr.insertBefore(trPr, tr.firstChild); }
  if (!Array.from(trPr.children).some(c => c.localName === 'cantSplit'))
    trPr.appendChild(doc.createElementNS(W, 'w:cantSplit'));
}
/** Rend sa hauteur automatique à une ligne dimensionnée pour la trame. */
function libererHauteur(tr) {
  if (!tr) return;
  const trPr = Array.from(tr.children).find(c => c.localName === 'trPr');
  if (!trPr) return;
  Array.from(trPr.children).forEach(c => { if (c.localName === 'trHeight') trPr.removeChild(c); });
}

/** Mise en forme de repli quand le paragraphe ne contient qu'un pictogramme :
    on part de celle de la case, débarrassée de la police symbole. */
function rprSansPicto(r, p) {
  const rpr = rPrDe(r);
  const doc = p.ownerDocument;
  const c = rpr ? rpr.cloneNode(true) : doc.createElementNS(W, 'w:rPr');
  Array.from(c.children).forEach(e => { if (e.localName === 'rFonts') c.removeChild(e); });
  return c;
}

/**
 * Écrit dans une cellule de tableau. On vise le premier paragraphe qui porte
 * réellement du texte : dans la trame, beaucoup de cellules commencent par un
 * paragraphe vide d'espacement, et écrire dedans donnait une cellule blanche.
 */
function ecrireDansCellule(tc, texte, sansDecor) {
  const tous = Array.from(tc.getElementsByTagNameNS(W, 'p'));
  if (!tous.length) return false;
  // les paragraphes porteurs d'images (logos) sont intouchables
  const ps = tous.filter(p => !porteUneImage(p));
  if (!ps.length) return false;
  const cible = ps.find(p => p.getElementsByTagNameNS(W, 't').length) || ps[0];
  ps.forEach(p => { if (p !== cible) p.parentNode.removeChild(p); });
  if (!cible.getElementsByTagNameNS(W, 't').length) {
    const r = cible.ownerDocument.createElementNS(W, 'w:r');
    const t = cible.ownerDocument.createElementNS(W, 'w:t');
    t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
    r.appendChild(t); cible.appendChild(r);
  }
  const ok = ecrireDansParagraphe(cible, texte);
  if (ok && sansDecor) nettoyerDecor(cible);
  return ok;
}

/**
 * Variante d'écriture pour les cellules qui contiennent un pictogramme : le
 * paragraphe porteur de l'image garde son image mais perd son texte, au lieu
 * d'être laissé intact — sinon l'ancien libellé de la trame reste affiché sous
 * le nouveau. C'est ce qui doublait les consignes de secours du protocole.
 */
function ecrireCelluleGardantImages(tc, texte) {
  const tous = Array.from(tc.getElementsByTagNameNS(W, 'p'));
  const libres = tous.filter(p => !porteUneImage(p));
  const cible = libres.find(p => p.getElementsByTagNameNS(W, 't').length) || libres[0];
  if (!cible) return false;
  tous.forEach(p => {
    if (p === cible) return;
    if (porteUneImage(p)) {
      Array.from(p.getElementsByTagNameNS(W, 'r')).forEach(r => {
        if (r.getElementsByTagNameNS(W, 't').length && !porteUneImage(r)) r.parentNode.removeChild(r);
      });
    } else if (p.parentNode) p.parentNode.removeChild(p);
  });
  return ecrireDansParagraphe(cible, texte);
}

/** Comparaison indifférente aux accents : « Chariot Elévateur » = « Chariot élévateur ». */
function sansAcc(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Textes que l'appli propose pour amorcer une saisie libre. Tant qu'ils n'ont
    pas été récrits, ils n'ont rien à faire dans le document remis au client. */
const GABARITS = ['nouvelle situation de travail', 'nouvelle operation', 'nouvelle interference',
  'risque a preciser', 'mesure a preciser', 'a preciser'];
function estGabarit(t) {
  const s = sansAcc(String(t || '').toLowerCase().replace(/[☒☐]/g, ' '))
    .replace(/\s+/g, ' ').trim().replace(/[.:;]+$/, '');
  return !s || GABARITS.indexOf(s) >= 0;
}

/** Coche / décoche les ☒ ☐ d'un élément (ligne, cellule, paragraphe). */
function cocher(el, coche) {
  el.querySelectorAll('t').forEach(t => {
    if (/[☒☐]/.test(t.textContent))
      t.textContent = t.textContent.replace(/[☒☐]/g, coche ? '☒' : '☐');
  });
  // la case Word elle-même, sinon Word rouvre le document avec l'ancien état
  Array.from(el.getElementsByTagName('*')).forEach(e => {
    if (e.localName === 'sdt') majEtatSdt(e, coche);
  });
  if (el.localName === 'sdt') majEtatSdt(el, coche);
}

/** Cellules d'une ligne de tableau. */
function cellules(tr) {
  return Array.from(tr.children).filter(c => c.localName === 'tc');
}
/** Lignes d'un tableau. */
function lignes(tbl) {
  return Array.from(tbl.children).filter(c => c.localName === 'tr');
}
/** Retrouve un tableau par un texte contenu dedans (jamais par son index :
    les index bougent dès qu'on supprime quelque chose). */
function tableauParTexte(doc, ...ancres) {
  const tbls = Array.from(doc.getElementsByTagNameNS(W, 'tbl'));
  const trouves = tbls.filter(t => {
    const txt = normal(texteDe(t));
    return ancres.every(a => txt.includes(normal(a)));
  });
  if (!trouves.length) return null;
  // Les trames Word imbriquent des tableaux dans des tableaux (page de garde).
  // On retient le plus INTERNE : écrire dans le tableau englobant détruirait
  // la mise en page — c'est exactement l'erreur qui a effacé les logos.
  const interne = trouves.filter(t => !trouves.some(u => u !== t && t.contains(u)));
  return interne[0] || trouves[0];
}
/** Retrouve un paragraphe par son texte. */
function paragrapheParTexte(doc, ancre) {
  const ps = Array.from(doc.getElementsByTagNameNS(W, 'p'));
  const n = normal(ancre);
  return ps.find(p => normal(texteDe(p)).includes(n)) || null;
}
/**
 * Retrouve, dans TOUT le document, la ligne de tableau qui contient les ancres
 * et qui ne contient elle-même aucun tableau imbriqué. Indispensable sur la page
 * de garde : la ligne englobante contient tout le reste, et écrire dedans
 * efface la page entière.
 */
function ligneProfonde(doc, ...ancres) {
  const trs = Array.from(doc.getElementsByTagNameNS(W, 'tr'));
  const ok = trs.filter(tr => {
    if (tr.getElementsByTagNameNS(W, 'tbl').length) return false;   // ligne englobante
    const txt = normal(texteDe(tr));
    return ancres.every(a => txt.includes(normal(a)));
  });
  return ok[0] || null;
}
/** Retrouve la ligne d'un tableau dont la 1re cellule contient le texte. */
function ligneParTexte(tbl, ancre) {
  const n = normal(ancre);
  return lignes(tbl).find(tr => {
    const c = cellules(tr)[0];
    return c && normal(texteDe(c)).includes(n);
  }) || null;
}
