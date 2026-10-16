/* ============================================================================
   Remplissage de la trame PPSPS / Plan de prévention CDES.
   Ce fichier ne connaît QUE la trame : il sait où poser chaque information.
   Tout repérage se fait par le TEXTE de la trame, jamais par un numéro de
   ligne ou de tableau — sinon la moindre suppression décale tout.
   ========================================================================= */

/* ------------------------------- outils ---------------------------------- */

/** Paragraphes « à puce » d'une cellule (chaque ☒/☐ est un paragraphe). */
function puces(tc) {
  return Array.from(tc.getElementsByTagNameNS(W, 'p'))
    .filter(p => texteDe(p).trim().length);
}
/* Repères du titre en page de garde, selon la trame ouverte. */
const ANCRES_TITRE = ['Nom du chantier', 'Dragage sur le réseau à petit gabarit',
  'Andernos les Bains', 'Bathymétrie - Chantier PRA Chaponval'];

/* -------------------- illustrations de la page de garde ---------------------
   La trame CDES a une page de garde presque vide : dans le document
   d'origine, deux vues du chantier tirées du mémoire technique occupaient ce
   blanc. On les remet, en ligne, centrées, sous le titre.
   Le logo CDES est une image ANCRÉE dont la position verticale est comptée
   depuis son paragraphe : si on ne la remontait pas d'autant, elle sortirait
   de la page dès qu'on ajoute de la hauteur au-dessus.                      */
function paragrapheVide(p) {
  return p && p.localName === 'p' && !texteDe(p).trim() && !porteUneImage(p);
}
/** Donne de l'air avant et après un paragraphe (espacement Word). */
function aerer(p) {
  const doc = p.ownerDocument;
  let ppr = Array.from(p.children).find(c => c.localName === 'pPr');
  if (!ppr) { ppr = doc.createElementNS(W, 'w:pPr'); p.insertBefore(ppr, p.firstChild); }
  let sp = Array.from(ppr.children).find(c => c.localName === 'spacing');
  if (!sp) { sp = doc.createElementNS(W, 'w:spacing'); ppr.insertBefore(sp, ppr.firstChild); }
  sp.setAttributeNS(W, 'w:before', '240');
  sp.setAttributeNS(W, 'w:after', '240');
}
/** Force le centrage horizontal d'un paragraphe. */
function centrer(p) {
  const doc = p.ownerDocument;
  let ppr = Array.from(p.children).find(c => c.localName === 'pPr');
  if (!ppr) { ppr = doc.createElementNS(W, 'w:pPr'); p.insertBefore(ppr, p.firstChild); }
  let jc = Array.from(ppr.children).find(c => c.localName === 'jc');
  if (!jc) { jc = doc.createElementNS(W, 'w:jc'); ppr.appendChild(jc); }
  jc.setAttributeNS(W, 'w:val', 'center');
}
function remonterAncres(doc, deltaEmu) {
  let n = 0;
  Array.from(doc.getElementsByTagName('*')).forEach(el => {
    if (el.localName !== 'positionV') return;
    const rel = el.getAttribute('relativeFrom');
    if (rel !== 'paragraph') return;
    const off = Array.from(el.children).find(c => c.localName === 'posOffset');
    if (!off) return;
    const v = parseInt(off.textContent, 10);
    if (!isFinite(v) || v <= 0) return;
    off.textContent = String(Math.max(0, v - deltaEmu));
    n++;
  });
  return n;
}
/**
 * Insère les images de la page de garde. « images » : [{dessin, cy}] déjà
 * construites par l'appelant (qui seul connaît les dimensions réelles).
 */
/* Le paragraphe du titre est repéré pendant le remplissage ; après coup il
   porte l'intitulé du chantier et les ancres de la trame ne le retrouvent
   plus. On le met de côté au passage. */
let paragrapheTitre = null;
function illustrations(doc, images) {
  if (!images || !images.length) return '';
  const pTitre = (paragrapheTitre && paragrapheTitre.ownerDocument === doc ? paragrapheTitre : null)
    || ANCRES_TITRE.map(a => paragrapheParTexte(doc, a)).find(Boolean);
  if (!pTitre) return '⚠ page de garde : aucun emplacement reconnu, les photos ne sont pas insérées';
  // on vise le DERNIER paragraphe vide de la page de garde : celui qui suit
  // le titre du document, juste au-dessus du logo. Se poser sur le premier
  // venu glisserait les photos entre l'intitulé du chantier et « Plan de
  // prévention ».
  let hote = null, n = pTitre.nextElementSibling, garde = 0, dernier = pTitre;
  while (n && garde++ < 20) {
    if (n.localName !== 'p') break;
    if (porteUneImage(n) || n.getElementsByTagNameNS(W, 'sectPr').length) break;
    if (paragrapheVide(n)) hote = n;
    dernier = n;
    n = n.nextElementSibling;
  }
  if (!hote) {
    hote = pTitre.cloneNode(false);
    dernier.parentNode.insertBefore(hote, dernier.nextSibling);
  }
  centrer(hote);
  while (hote.lastChild && hote.lastChild.localName !== 'pPr') hote.removeChild(hote.lastChild);
  aerer(hote);
  const espace = () => {
    const r = doc.createElementNS(W, 'w:r'), t = doc.createElementNS(W, 'w:t');
    t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
    t.textContent = '\u00a0 \u00a0'; r.appendChild(t); return r;
  };
  let ligne = 0, hauteur = 0;
  images.forEach((im, i) => {
    if (i % 2 === 1) hote.appendChild(espace());       // un blanc entre les deux
    hote.appendChild(runImage(doc, im.dessin));
    if (i % 2 === 0) { ligne = im.cy; } else { ligne = Math.max(ligne, im.cy); }
    if (i % 2 === 1 || i === images.length - 1) { hauteur += ligne; ligne = 0; }
  });
  remonterAncres(doc, hauteur);
  return images.length + ' illustration(s) en page de garde';
}

/* Première puce de la liste « 5.1 CONSIGNES GENERALES de SECURITE » selon la
   trame ouverte. On vise le texte de la TRAME, jamais celui de l'application :
   c'est le repère, pas le contenu. */
const ANCRES_CONSIGNES = [
  'Accès du chantier strictement interdit',
  'Acces du chantier strictement interdit',
  'Respect des dispositifs de sécurité en place',
  'Suivre les règles de circulation'
];
/** Coche/décoche un paragraphe précis. */
function cocherP(p, on) {
  const ts = p.querySelectorAll('t');
  let fait = false;
  ts.forEach(t => {
    if (/[☒☐]/.test(t.textContent)) { t.textContent = t.textContent.replace(/[☒☐]/g, on ? '☒' : '☐'); fait = true; }
  });
  // l'état de la vraie case Word suit le glyphe
  Array.from(p.getElementsByTagName('*')).forEach(e => {
    if (e.localName === 'sdt') majEtatSdt(e, on);
  });
  return fait;
}
/** Applique une liste d'états aux puces d'une cellule, et supprime les non
    retenues si « supprimer » est vrai (sinon on se contente de décocher). */
function appliquerPuces(tc, etats, supprimer) {
  const ps = puces(tc);
  ps.forEach((p, i) => {
    const on = etats[i] !== undefined ? !!etats[i] : false;
    if (supprimer && !on) { p.parentNode.removeChild(p); return; }
    cocherP(p, on);
  });
}
/** Clé de rapprochement : on ignore les cases à cocher et la casse, sinon
    « ☒ Bathymétrie » ne retrouve jamais « Bathymétrie ». */
function cle(s) { return normal(String(s || '').replace(/[☒☐]/g, ' ')).slice(0, 60); }
/** Supprime une ligne de tableau. */
function supprimerLigne(tr) { if (tr && tr.parentNode) tr.parentNode.removeChild(tr); }
/** Duplique une ligne de tableau et l'insère juste après. */
function clonerLigne(tr) {
  const c = tr.cloneNode(true);
  tr.parentNode.insertBefore(c, tr.nextSibling);
  return c;
}
/** Écrit dans la cellule n° i d'une ligne. */
function ecrireCel(tr, i, texte, sansDecor) {
  const cs = cellules(tr);
  if (cs[i]) ecrireDansCellule(cs[i], texte, sansDecor);
}

/** Remplace le texte d'un paragraphe repéré par une ancre. */
function remplacerP(doc, ancre, texte, sansDecor) {
  const p = paragrapheParTexte(doc, ancre);
  if (p && texte !== undefined && texte !== null && texte !== '') {
    const ok = ecrireDansParagraphe(p, texte);
    if (ok && sansDecor) nettoyerDecor(p);
    return true;
  }
  return false;
}
/** Insère des paragraphes (clonés d'un modèle) avant un paragraphe repère. */
function insererAvant(doc, ancre, textes, sansDecor) {
  const p = paragrapheParTexte(doc, ancre);
  if (!p || !textes.length) return 0;
  let n = 0;
  textes.forEach(t => {
    const c = p.cloneNode(true);
    if (ecrireDansParagraphe(c, t)) {
      if (sansDecor) nettoyerDecor(c);
      p.parentNode.insertBefore(c, p); n++;
    }
  });
  return n;
}
/** Supprime un paragraphe repéré par son texte exact. */
function supprimerP(doc, ancre) {
  const p = paragrapheParTexte(doc, ancre);
  if (p && p.parentNode) { p.parentNode.removeChild(p); return true; }
  return false;
}

/* ------------------------- listes à puces réécrites -------------------------
   Jusqu'ici le moteur se contentait de SUPPRIMER les consignes décochées. Les
   consignes réécrites dans l'application, celles qui étaient ajoutées, et toute
   la liste des consignes particulières ne sortaient donc jamais dans le Word :
   le texte de la trame apparaissait à la place du sien. On réécrit désormais
   la liste entière en réutilisant les paragraphes de la trame comme moules —
   la numérotation, les retraits et la police restent ceux du modèle.        */
function numIdDe(p) {
  const n = Array.from(p.getElementsByTagNameNS(W, 'numId'))[0];
  return n ? (n.getAttributeNS(W, 'val') || n.getAttribute('w:val') || '') : '';
}
function styleDe(p) {
  const n = Array.from(p.getElementsByTagNameNS(W, 'pStyle'))[0];
  return n ? (n.getAttributeNS(W, 'val') || n.getAttribute('w:val') || '') : '';
}
/** Les paragraphes qui forment la même liste que « p0 », p0 compris. */
function listeDe(p0) {
  const num = numIdDe(p0), sty = styleDe(p0);
  const memeListe = p => p.localName === 'p' &&
    (num ? numIdDe(p) === num : (sty && styleDe(p) === sty));
  /* la trame mariniers glisse un paragraphe vide (parfois porteur d'une image
     ancrée) entre deux puces : on l'enjambe sans le toucher, la liste continue */
  const vide = p => p.localName === 'p' && !texteDe(p).trim();
  const out = [p0];
  let n = p0.nextElementSibling;
  while (n) {
    if (memeListe(n) && !vide(n)) { out.push(n); n = n.nextElementSibling; continue; }
    if (vide(n)) { let k = n.nextElementSibling; while (k && vide(k)) k = k.nextElementSibling;
      if (k && memeListe(k)) { n = k; continue; } }
    break;
  }
  let a = p0.previousElementSibling;
  while (a) {
    if (memeListe(a) && !vide(a)) { out.unshift(a); a = a.previousElementSibling; continue; }
    if (vide(a)) { let k = a.previousElementSibling; while (k && vide(k)) k = k.previousElementSibling;
      if (k && memeListe(k)) { a = k; continue; } }
    break;
  }
  return out;
}
/**
 * Réécrit intégralement la liste à puces qui contient « ancre » avec les
 * textes fournis. Renvoie le nombre de puces écrites, ou -1 si la liste
 * n'a pas été trouvée (le journal le signale alors à l'utilisateur).
 */
function reecrireListe(doc, ancres, textes) {
  const p0 = (Array.isArray(ancres) ? ancres : [ancres])
    .map(a => paragrapheParTexte(doc, a)).find(Boolean);
  if (!p0) return -1;
  const items = (textes || []).filter(t => String(t || '').trim());
  const puces = listeDe(p0);
  if (!items.length) { puces.forEach(p => p.parentNode && p.parentNode.removeChild(p)); return 0; }
  const moule = puces[puces.length - 1];
  let dernier = null;
  items.forEach((t, i) => {
    let p = puces[i];
    if (!p) { p = moule.cloneNode(true); dernier.parentNode.insertBefore(p, dernier.nextSibling); }
    ecrireDansParagraphe(p, t);
    dernier = p;
  });
  puces.slice(items.length).forEach(p => p.parentNode && p.parentNode.removeChild(p));
  return items.length;
}

/* --------------------------- remplissage global --------------------------- */

/**
 * @param {Document} doc  document.xml parsé
 * @param {Object}   d    données saisies dans l'application
 */
function remplirPPSPS(doc, d) {
  const journal = [];
  const note = m => journal.push(m);

  /* --- page de garde ------------------------------------------------------ */
  // chaque trame porte un autre nom de chantier en page de garde : on essaie
  // les intitulés connus, et « Nom du chantier » qui sert de repère aux trames
  // vierges — le même que dans les en-têtes de page
  const pTitre = ANCRES_TITRE.map(a => paragrapheParTexte(doc, a)).find(Boolean);
  paragrapheTitre = pTitre || null;
  if (pTitre && d.titre) { ecrireDansParagraphe(pTitre, d.titre); note('titre'); }
  // la ligne du lieu, juste sous l'intitulé (modèle « Pont sur Sambre »)
  const pLieu = paragrapheParTexte(doc, 'Lieu du chantier');
  if (pLieu) {
    const lieu = String(d.lieu || '').trim();
    if (lieu) ecrireDansParagraphe(pLieu, lieu);
    else if (pLieu.parentNode) pLieu.parentNode.removeChild(pLieu);
  }
  else if (d.titre) note('⚠ intitulé du chantier : aucun emplacement reconnu en page de garde');
  // le nom du chantier est répété ailleurs (tableau de couverture, bandeaux) :
  // tout paragraphe qui n'est QUE le repère « Nom du chantier » est repris
  if (d.titre) {
    let n = 0;
    Array.from(doc.getElementsByTagNameNS(W, 'p')).forEach(p => {
      if (p !== pTitre && normal(texteDe(p)) === 'nom du chantier' &&
          ecrireDansParagraphe(p, d.titre)) n++;
    });
    if (n) note('nom du chantier repris à ' + n + ' autre(s) endroit(s)');
  }
  const pDesc = paragrapheParTexte(doc, 'Travaux de dragage Urgent sur le canal de Calais')
             || paragrapheParTexte(doc, 'Description des travaux');
  if (pDesc && d.description) { ecrireDansParagraphe(pDesc, d.description); note('description'); }
  else if (d.description) note('⚠ cette trame n’a pas de bloc « description des travaux » : '
    + 'le texte saisi ne figure pas dans le document');

  /* --- 1.1 désignation du chantier ---------------------------------------- */
  const t2 = tableauParTexte(doc, "LIEU de l’INTERVENTION");
  if (t2) {
    const set = (ancre, val) => {
      const tr = ligneParTexte(t2, ancre);
      if (tr && val !== undefined && val !== null) ecrireCel(tr, 1, val);
    };
    set("LIEU de l’INTERVENTION", d.lieu);
    set('TRAVAUX DANGEREUX', (d.travauxDangereux || []).join('\n'));
    interdireCoupure(ligneParTexte(t2, 'TRAVAUX DANGEREUX'));
    /* l'annexe « liste des travaux dangereux » porte les mêmes intitulés avec
       des cases : on coche celles qui correspondent aux travaux retenus */
    if (d.travauxDangereux) {
      /* L'annexe porte la liste complète de l'arrêté du 19 mars 1993 : on coche
         les lignes retenues dans l'appli et on décoche toutes les autres. Le
         rapprochement se fait sur le début du libellé, à l'accent près. */
      const debut = s => sansAcc(normal(String(s || '').replace(/[☒☐]/g, ' '))).slice(0, 40);
      const retenus = (d.travauxDangereux || []).map(debut).filter(Boolean);
      let coches = 0, vues = 0;
      const tousP = Array.from(doc.getElementsByTagNameNS(W, 'p'));
      // on ne touche qu'à l'annexe : ailleurs, « Travaux… » désigne des risques
      const depart = tousP.findIndex(p => /LISTE\s+des\s+TRAVAUX\s+DANGEREUX/i.test(texteDe(p)));
      (depart < 0 ? [] : tousP.slice(depart)).forEach(p => {
        const brut = texteDe(p);
        if (!/[☒☐]/.test(brut)) return;
        const tp = debut(brut);
        if (!tp.startsWith('travaux ')) return;
        vues++;
        const on = retenus.some(r => r.startsWith(tp.slice(0, 30)) || tp.startsWith(r.slice(0, 30)));
        cocher(p, on);
        if (on) coches++;
      });
      if (vues) note('annexe travaux dangereux : ' + coches + ' case(s) cochée(s) sur ' + vues);
    }
    set('DATE de DEBUT', d.dateDebut);
    set('DATE de FIN', d.dateFin);
    set('DUREE', d.duree);
    note('désignation du chantier');   // nature et fréquence : voir plus bas
  }

  /* --- 1.2 entreprise ------------------------------------------------------ */
  const t3 = tableauParTexte(doc, 'ENTREPRISE EXTERIEURE', 'Raison sociale');
  if (t3 && d.entreprise) {
    const e = d.entreprise;
    const set = (ancre, val) => { const tr = ligneParTexte(t3, ancre); if (tr && val) ecrireCel(tr, 1, val); };
    set('Raison sociale', e.raison);
    set('Adresse', e.adresse);
    set('Téléphone', e.telephone);
    set('Nom du Responsable CDES', e.respCdes);
    set('Nom du Responsable des Travaux', e.respTravaux);
    set('Effectif prévu', e.effectif);
    // certaines trames n'ont qu'une ligne « Nom du Responsable »
    const trResp = lignes(t3).find(tr => {
      const c = cellules(tr)[0];
      return c && normal(texteDe(c)) === 'nom du responsable';
    });
    if (trResp) ecrireCel(trResp, 1, e.respTravaux || e.respCdes || '');
    // …et une ligne « Médecine du travail »
    const trMed = ligneParTexte(t3, 'Médecine du travail');
    if (trMed && d.organismes && d.organismes.medecine) {
      const m = d.organismes.medecine;
      ecrireCel(trMed, 1, [m.nom, m.adresse, m.tel].filter(Boolean).join('\n'), true);
    }
    /* Colonne « ENTREPRISE UTILISATRICE » quand la trame en a une : c'est le
       donneur d'ordre, donc le maître d'ouvrage. */
    const enTete = lignes(t3)[0];
    if (enTete && normal(texteDe(enTete)).includes('entreprise utilisatrice') && d.moa && d.moa.nom) {
      const paire = [['Raison sociale', d.moa.nom], ['Adresse', d.moa.adresse], ['Téléphone', d.moa.tel]];
      paire.forEach(([ancre, val]) => {
        const tr = ligneParTexte(t3, ancre);
        if (tr && val) ecrireCel(tr, 2, val, true);   // sans gras : c'est de la saisie
      });
      note('colonne entreprise utilisatrice remplie avec le maître d’ouvrage');
    }
    note('entreprise');
  }

  /* --- horaires ------------------------------------------------------------ */
  const t4 = tableauParTexte(doc, 'JOURS', 'MATIN', 'APRES-MIDI');
  if (t4 && d.horaires) {
    ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'].forEach(j => {
      const h = d.horaires[j.toLowerCase()];
      if (!h) return;
      const tr = ligneParTexte(t4, j);
      if (!tr) return;
      ecrireCel(tr, 1, h.matin || '');
      ecrireCel(tr, 2, h.apresMidi || '');
    });
    note('horaires');
  }

  /* --- 1.3 organismes de prévention ---------------------------------------- */
  const t5 = tableauParTexte(doc, 'INSPECTION DU TRAVAIL', 'CARSAT', 'OPPBTP');
  if (t5 && d.organismes) {
    const o = d.organismes;
    const trAdr = ligneParTexte(t5, 'Adresse');
    const trTel = ligneParTexte(t5, 'Téléphone');
    [['inspection', 1], ['carsat', 2], ['oppbtp', 3]].forEach(([cle, col]) => {
      const org = o[cle]; if (!org) return;
      if (trAdr) ecrireCel(trAdr, col, [org.nom, org.adresse].filter(Boolean).join('\n'));
      if (trTel) ecrireCel(trTel, col, org.tel || '');
    });
    note('organismes de prévention');
  }

  /* --- 2.1 effectifs -------------------------------------------------------- */
  if (d.effectifs) {
    const maj = (ancre, libelle, val) => {
      const p = paragrapheParTexte(doc, ancre);
      if (p) ecrireDansParagraphe(p, libelle + ' : ' + (String(val || '').trim() || '/'));
    };
    // les libellés sont ceux de la trame ; une ligne vide sort avec « / »,
    // jamais blanche (« Effectif intérimaires pas rempli »)
    maj('Effectif CDES', 'Effectif CDES', d.effectifs.cdes);
    maj('Effectif intérimaires', 'Effectif intérimaires', d.effectifs.interim);
    maj('Effectif Transport fluvial interne', 'Effectif Transport fluvial interne CDES', d.effectifs.fluvial);
    maj('Effectif Transport terrestre externes', 'Effectif Transport terrestre externes', d.effectifs.transport);
    note('effectifs');
  }

  /* --- 4.1 habilitations ---------------------------------------------------- */
  const t7 = tableauParTexte(doc, 'Nombre de collaborateur concerné', 'Habilitations');
  if (t7 && d.habilitations && d.habilitations.length) {
    const trs = lignes(t7);
    const modele = trs[trs.length - 1];              // dernière ligne = gabarit
    let precedente = modele;
    d.habilitations.forEach((h, i) => {
      const tr = i === 0 ? modele : clonerLigne(precedente);
      // la trame a l'ordre : Nombre | Activité | Habilitations
      ecrireCel(tr, 0, String(h.nombre || ''));
      ecrireCel(tr, 1, h.activite || '');
      ecrireCel(tr, 2, h.habilitations || '');
      precedente = tr;
    });
    note(d.habilitations.length + ' habilitation(s)');
  }

  /* --- 4.3 tableau des risques propres --------------------------------------
     On ne se contente pas de supprimer : on RECONSTRUIT l'ordre du tableau à
     partir des opérations décrites par le conducteur, en réutilisant les vraies
     lignes de la trame (donc leur mise en forme). Une même famille peut servir
     deux fois : la ligne de titre est alors dupliquée. */
  /* Repérage par l'EN-TÊTE du tableau, pas par une famille de risques : le
     plan de prévention et le PPSPS n'ont pas les mêmes familles, et s'accrocher
     à « Installation du chantier » faisait rater le tableau — donc sortir un
     document sans aucune analyse de risques, en silence. */
  const t9 = tableauParTexte(doc, 'Dangers / Activités', 'Mesures de prévention applicables');
  if (t9 && d.operations) {
    const trs = lignes(t9);
    const entete = trs[0];
    const index = new Map();
    trs.slice(1).forEach(tr => {
      const c = cellules(tr)[0];
      if (c) index.set(cle(texteDe(c)), tr);
    });
    /* Deux gabarits : une ligne de titre de famille (1 cellule fusionnée) et une
       ligne de situation (3 cellules). Ils servent à FABRIQUER une ligne dont la
       trame n'a pas le modèle — c'est ce qui permet d'utiliser comme source un
       document déjà rempli, qui ne porte plus tout le catalogue. */
    let gabaritFamille = null, gabaritSituation = null;
    trs.slice(1).forEach(tr => {
      const n = cellules(tr).length;
      if (n === 1 && !gabaritFamille) gabaritFamille = tr;
      if (n >= 3 && !gabaritSituation) gabaritSituation = tr;
    });
    const dejaUtilisee = new Set();
    let fabriquees = 0;
    /** Renvoie {tr, neuve} : la vraie ligne, une copie, ou une ligne fabriquée. */
    const prendre = (k, gabarit) => {
      const tr = index.get(k);
      if (tr) {
        if (!dejaUtilisee.has(tr)) { dejaUtilisee.add(tr); return { tr: tr, neuve: false }; }
        return { tr: tr.cloneNode(true), neuve: false };
      }
      if (!gabarit) return null;
      fabriquees++;
      return { tr: gabarit.cloneNode(true), neuve: true };
    };
    const puce = (liste, actifs) => (liste || [])
      .filter(x => actifs === false || x.on !== false)
      .filter(x => !estGabarit(x.txt || x))
      .map(x => '☒ ' + (x.txt || x)).join('\n');

    const ordre = [];
    let manquantes = 0, gabarits = 0;
    d.operations.forEach((op, no) => {
      /* Les lignes restées à l'état de gabarit (« Nouvelle situation de
         travail », « Risque à préciser »…) ne partent pas dans le Word. */
      const utiles = (op.lignes || []).filter(l => !estGabarit(l.danger) ||
        (l.risques || []).some(x => x.on !== false && !estGabarit(x.txt)) ||
        (l.mesures || []).some(x => x.on !== false && !estGabarit(x.txt)));
      gabarits += (op.lignes || []).length - utiles.length;
      if (!utiles.length && estGabarit(op.nom)) { gabarits++; return; }
      op = Object.assign({}, op, { lignes: utiles });
      const f = prendre(cle(op.source || op.nom), gabaritFamille);
      if (f) {
        ecrireDansCellule(cellules(f.tr)[0],
          (op.numeroter === false ? '' : 'OPERATION ' + (no + 1) + ' : ') + op.nom);
        cocher(cellules(f.tr)[0], true);
        if (f.neuve) ecrireDansCellule(cellules(f.tr)[0],
          '☒ ' + (op.numeroter === false ? '' : 'OPERATION ' + (no + 1) + ' : ') + op.nom);
        ordre.push(f.tr);
      }
      (op.lignes || []).forEach(l => {
        const r = prendre(cle(l.source || l.danger), gabaritSituation);
        if (!r) { manquantes++; return; }
        const cs = cellules(r.tr);
        // un risque marqué significatif ressort dans le document, pas seulement à l'écran
        const marque = l.significatif ? '\n⚠ RISQUE SIGNIFICATIF' : '';
        if (l.danger) { ecrireDansCellule(cs[0], '☒ ' + l.danger + marque); }
        else { cocher(cs[0], true); if (marque) ecrireDansCellule(cs[0], texteDe(cs[0]).trim() + marque); }
        if (r.neuve) {
          // ligne fabriquée : on écrit le contenu en entier, il n'y a rien à cocher
          if (cs[1]) ecrireDansCellule(cs[1], puce(l.risques) || '—');
          if (cs[2]) ecrireDansCellule(cs[2], puce(l.mesures) || '—');
        } else {
          if (cs[1]) appliquerPuces(cs[1], (l.risques || []).map(x => x.on !== false), true);
          if (cs[2]) appliquerPuces(cs[2], (l.mesures || []).map(x => x.on !== false), true);
        }
        ordre.push(r.tr);
      });
    });
    if (fabriquees) note(fabriquees + ' ligne(s) de risque fabriquée(s) sur le gabarit de la trame');
    if (gabarits) note(gabarits + ' ligne(s) laissée(s) à l’état de gabarit, non reprise(s) dans le Word');
    // on vide le tableau de ses lignes d'origine puis on rejoue l'ordre voulu
    trs.slice(1).forEach(tr => supprimerLigne(tr));
    let apres = entete;
    ordre.forEach(tr => { entete.parentNode.insertBefore(tr, apres.nextSibling); apres = tr; });
    note('tableau des risques : ' + ordre.length + ' lignes' +
         (manquantes ? ' (' + manquantes + ' introuvables dans la trame)' : ''));
  }

  /* --- 4.6 risques inhérents au chantier ------------------------------------ */
  const t10 = tableauParTexte(doc, 'Travaux à proximité de lignes électriques');
  if (t10 && d.risquesEnv) {
    const trs = lignes(t10);
    trs.slice(1).forEach(tr => {
      const cs = cellules(tr);
      const k = cle(texteDe(cs[0]));
      const choix = (d.risquesEnv || []).find(r => cle(r.source || r.danger) === k);
      if (!choix || choix.on === false) {
        if (d.supprimerRisquesEnvNonRetenus) supprimerLigne(tr);
        else cs.forEach(c => cocher(c, false));
        return;
      }
      cocher(cs[0], true);
      if (choix.significatif) ecrireDansCellule(cs[0], texteDe(cs[0]).trim() + '\n⚠ RISQUE SIGNIFICATIF');
      if (cs[1]) appliquerPuces(cs[1], (choix.risques || []).map(r => r.on !== false), false);
      if (cs[2]) appliquerPuces(cs[2], (choix.mesures || []).map(m => m.on !== false), false);
    });
    note('risques du chantier et de son environnement');
  }

  /* --- 5.3 numéros d'urgence -------------------------------------------------
     Depuis la refonte des trames, la section secours se limite au tableau
     condensé du protocole : consignes générales, emplacement des dispositifs,
     numéros d'urgence. Les contacts s'écrivent dans la DERNIÈRE ligne du
     tableau ; le point GPS et les spécificités du chantier s'y ajoutent. */
  const t13 = tableauParTexte(doc, 'Numéros d’Urgence');
  if (t13 && ligneParTexte(t13, 'Rappeler le point GPS'))
    note('⚠ TRAME ANCIENNE : le site sert encore une trame d’avant la refonte des secours. '
      + 'Remplace PDP_trame.docx et PPSPS_trame.docx sur le site par celles de la dernière livraison.');
  if (t13 && d.urgence) {
    const trs13 = lignes(t13);
    const tr = trs13[trs13.length - 1];
    if (tr) {
      const cs = cellules(tr);
      const cible = cs[cs.length - 1];
      const l = [];
      if (d.urgence.conducteur) l.push('☒ Conducteur de Travaux : ' + d.urgence.conducteur);
      if (d.urgence.responsable) l.push('☒ Responsable CDES : ' + d.urgence.responsable);
      if (d.urgence.hse) l.push('☒ Responsable HSE : ' + d.urgence.hse);
      (d.urgence.autres || []).forEach(a => l.push('☒ ' + a));
      if (d.urgence.lat != null && d.urgence.lon != null)
        l.push('Point GPS : ' + Number(d.urgence.lat).toFixed(6) + ', ' + Number(d.urgence.lon).toFixed(6) +
               (d.urgence.gps ? ' — ' + d.urgence.gps : ''));
      else if (d.urgence.gps) l.push('Point GPS / accès : ' + d.urgence.gps);
      if (d.urgence.specificites) l.push(d.urgence.specificites);
      if (l.length && cible) ecrireDansCellule(cible, l.join('\n'));
      interdireCoupure(tr);
    }
    note('numéros d’urgence');
  }

  /* --- signatures ------------------------------------------------------------
     Le PPSPS n'est pas un accord entre deux entreprises : l'entreprise
     intervenante l'établit et le remet au coordonnateur SPS. Elle seule signe,
     et les lignes des autres parties sont retirées du tableau. */
  const t15 = tableauParTexte(doc, 'Signature des parties');
  if (t15 && d.signataires) {
    const ppsps = d.type === 'ppsps';
    const attendus = Object.keys(d.signataires);
    const cible = k => ppsps && /extérieure|exterieure/i.test(k) ? 'Entreprise intervenante' : null;
    let retirees = 0;
    lignes(t15).slice(2).forEach(tr => {
      const c0 = cellules(tr)[0];
      const lib = c0 ? texteDe(c0).trim() : '';
      if (!lib) return;
      const cle = attendus.find(k => normal(k) === normal(lib)) ||
                  (ppsps && /extérieure|exterieure/i.test(lib) ? attendus[0] : null);
      if (!cle) { supprimerLigne(tr); retirees++; return; }
      const s = d.signataires[cle] || {};
      const neuf = cible(lib);
      if (neuf) ecrireDansCellule(c0, neuf);
      /* La ligne « Entreprise Utilisatrice » d'un plan de prévention reste
         vierge : c'est le client qui la remplit à la signature. */
      const utilisatrice = !ppsps && /utilisatrice/i.test(lib);
      ecrireCel(tr, 1, utilisatrice ? ' ' : (s.nom || ' '), true);
      const cNom = cellules(tr)[1];
      if (cNom) { const pN = cNom.getElementsByTagNameNS(W, 'p')[0]; if (pN) centrer(pN); }
      if (s.date) ecrireCel(tr, 2, s.date);
    });
    note('signataires : ' + attendus.length + ' partie(s)' +
         (retirees ? ', ' + retirees + ' ligne(s) retirée(s)' : ''));
  }

  /* --- titre réglementaire selon le type de document ------------------------ */
  if (d.typeInfo) {
    // chaque trame porte son propre intitulé : on remplace celui qui s'y trouve
    ['Plan Particulier de Sécurité et de Protection de la Santé',
     'Plan de prévention', 'Plan de Prévention'].some(a => remplacerP(doc, a, d.typeInfo.titreDoc));
    remplacerP(doc, 'Etabli en application des article', d.typeInfo.sousTitre);
    note('type : ' + d.typeInfo.court2);
  }

  /* --- maîtrise d'ouvrage / maîtrise d'œuvre -------------------------------- */
  /* La ligne des coordonnées est celle qui SUIT la ligne des libellés
     « Maitrise d'ouvrage … Entreprise(s) ». Selon la trame elle a 3 colonnes
     (ouvrage / œuvre / entreprise) ou 4 (œuvre conception et exécution
     séparées) : l'entreprise est toujours la DERNIÈRE. S'appuyer sur une
     adresse précise de la trame, comme avant, ne marchait que sur une seule. */
  if (d.moa || d.moe || d.agenceInfo) {
    const libelles = Array.from(doc.getElementsByTagNameNS(W, 'tr')).find(tr =>
      !tr.getElementsByTagNameNS(W, 'tbl').length &&
      normal(texteDe(tr)).includes('maitrise d\'ouvrage') &&
      normal(texteDe(tr)).includes('entreprise'));
    const trAdr = libelles ? libelles.nextElementSibling : ligneProfonde(doc, '37 rue du Plat');
    const cs = trAdr ? cellules(trAdr) : [];
    if (cs.length >= 3) {
      const bloc = o => [o.nom, o.adresse, o.tel].filter(Boolean).join('\n');
      // écriture préservante : le logo CDES et les paragraphes d'espacement
      // restent, le texte périphérique des images disparaît, rien n'est gras
      if (d.moa && d.moa.nom) ecrireCellulePreservant(cs[0], bloc(d.moa), true);
      if (d.moe && d.moe.nom) ecrireCellulePreservant(cs[1], bloc(d.moe), true);
      remplirPPSPS.cellulesCouverture = cs;    // les logos MOA / MOE s'y posent ensuite
      if (d.agenceInfo) ecrireCellulePreservant(cs[cs.length - 1],
        [d.agenceInfo.raison, d.agenceInfo.adresse, d.agenceInfo.tel].filter(Boolean).join('\n'), true);
      note('maîtrise d’ouvrage / d’œuvre (' + cs.length + ' colonnes)');
    } else note('⚠ page de garde : ligne maîtrise d’ouvrage / d’œuvre introuvable');
  }

  /* --- historique des modifications et approbation -------------------------- */
  if (d.historique) {
    const tHist = tableauParTexte(doc, 'Version', 'Date de l’édition', 'Descriptions des modifications');
    if (tHist) {
      const tr = ligneParTexte(tHist, '0') ||
                 lignes(tHist).find(x => normal(texteDe(x)).includes('1ère diffusion'));
      if (tr) {
        const cs = cellules(tr);
        if (cs[0]) ecrireDansCellule(cs[0], d.historique.version || '0');
        if (cs[1]) ecrireDansCellule(cs[1], d.historique.dateFr || '');
        if (cs[2]) ecrireDansCellule(cs[2], d.historique.motif || 'Émission initiale');
      }
    }
    /* Le bloc APPROBATION vit dans des zones de texte, ses cellules sont
       vierges : on le retrouve par ses libellés voisins, et on remplit la
       ligne à 3 cellules (rédaction / vérification / approbation). Les copies
       de compatibilité Word (Choice/Fallback) sont remplies toutes les deux. */
    let approFait = 0;
    Array.from(doc.getElementsByTagNameNS(W, 'tbl')).forEach(tb => {
      const tx = normal(texteDe(tb));
      if (!tx.includes('approbation') || !tx.includes('informations qualit')) return;
      const tr3 = lignes(tb).find(r => cellules(r).length === 3);
      if (!tr3) return;
      const cs3 = cellules(tr3);
      const bloc = (titre, nom, qualite) =>
        titre + ' :\n' + (nom || '') + (qualite ? '\n' + qualite : '');
      ecrireDansCellule(cs3[0], bloc('Rédaction', d.historique.redacteur, d.historique.qualiteRedacteur), true);
      ecrireDansCellule(cs3[1], bloc('Vérification', d.historique.verifiePar, ''), true);
      ecrireDansCellule(cs3[2], bloc('Approbation', d.historique.validePar, d.historique.qualiteValideur || 'Responsable d’agence'), true);
      approFait++;
    });
    note('historique' + (approFait ? ' et approbation' : ' (⚠ bloc approbation introuvable)'));
  }

  /* --- nature et fréquence : une valeur unique choisie dans une liste ------- */
  const tDes = tableauParTexte(doc, "LIEU de l’INTERVENTION");
  if (tDes) {
    if (d.nature) { const tr = ligneParTexte(tDes, 'NATURE des OPERATIONS');
      if (tr) { ecrireCel(tr, 1, '☒ ' + d.nature); libererHauteur(tr); interdireCoupure(tr); } }
    if (d.frequence) { const tr = ligneParTexte(tDes, 'FREQUENCE');
      if (tr) { ecrireCel(tr, 1, '☒ ' + d.frequence); interdireCoupure(tr); } }
  }

  /* --- sous-traitance et entreprises extérieures ---------------------------- */
  if (d.entreprisesExt) {
    const ext = d.entreprisesExt.filter(e => e.nom);
    remplacerP(doc, 'Partie des travaux sous-traités',
      'Partie des travaux sous-traités : ' + (ext.length ? ext.map(e => e.role).join(', ') : 'RAS'), true);
    remplacerP(doc, 'Raison sociale, Nom et adresse de l’entrepreneur sous-traitant',
      'Raison sociale, nom et adresse des entreprises extérieures : ' +
      (ext.length ? ext.map(e => e.nom + (e.adresse ? ' — ' + e.adresse : '') +
        (e.effectif ? ' (' + e.effectif + ')' : '')).join(' · ') : 'RAS'), true);
    if (ext.length) note(ext.length + ' entreprise(s) extérieure(s)');
  }

  /* --- personne chargée de diriger l'exécution des travaux -------------------
     La trame laisse deux lignes vides sous ce libellé, dont une qui porte déjà
     le pictogramme ☎ : sans écriture elles ressortaient blanches, avec un
     téléphone orphelin. */
  if (d.encadrement && d.encadrement.respTravaux) {
    const pLib = paragrapheParTexte(doc, 'chargée de diriger l’exécution des travaux')
              || paragrapheParTexte(doc, 'chargée de diriger');
    if (pLib) {
      const e = d.encadrement;
      const suivants = [];
      let n = pLib.nextElementSibling, garde = 0;
      while (n && garde++ < 5 && n.localName === 'p') {
        const t = texteDe(n).trim();
        if (t && !/^[☎✆✉\s]+$/.test(t)) break;
        suivants.push(n); n = n.nextElementSibling;
      }
      const forcer = (p, txt) => {
        if (!p.getElementsByTagNameNS(W, 'r').length) {
          const r = doc.createElementNS(W, 'w:r'), tt = doc.createElementNS(W, 'w:t');
          tt.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
          r.appendChild(tt); p.appendChild(r);
        }
        return ecrireDansParagraphe(p, txt);
      };
      // le ☎ de la trame est un <w:sym> : il ne renvoie aucun texte
      const aSymbole = p => !!Array.from(p.getElementsByTagName('*')).find(e => e.localName === 'sym');
      const pTel = suivants.find(p => /[☎✆]/.test(texteDe(p)) || aSymbole(p));
      const pNom = suivants.find(p => p !== pTel);
      let ecrites = 0;
      if (pNom && forcer(pNom, e.respTravaux +
        (e.respTravauxFonction ? ' — ' + e.respTravauxFonction : ' — Conducteur de travaux'))) ecrites++;
      if (e.respTravauxTel) {
        if (pTel) { if (forcer(pTel, (aSymbole(pTel) ? ' ' : '☎ ') + e.respTravauxTel)) ecrites++; }
        else {
          const p2 = suivants.find(p => p !== pNom);
          if (p2 && forcer(p2, '☎ ' + e.respTravauxTel)) ecrites++;
        }
      }
      if (ecrites) note('personne chargée de diriger les travaux');
    }
  }

  /* --- mentions accompagnant les horaires ----------------------------------- */
  if (d.horairesTexte) {
    const n = insererAvant(doc, 'Coordinateur QHSE CDES',
      String(d.horairesTexte).split('\n').filter(Boolean), true);
    if (n) note('mentions horaires');
  }
  /* --- coordinateur QHSE : nom, fonction, téléphone depuis l'annuaire ----------
     Les trames publiques n'en portent plus (V19) : les trois paragraphes qui suivent
     « Coordinateur QHSE CDES : » sont réécrits depuis le Référentiel, ou vidés. */
  {
    const pQ = paragrapheParTexte(doc, 'Coordinateur QHSE CDES');
    const hse = (d.organismes && d.organismes.hse) || {};
    if (pQ) {
      const lignesHse = [hse.nom || '', String(hse.adresse || '').split('\n')[0] || '', hse.tel ? 'Tél. ' + hse.tel : ''];
      let suiv = pQ.nextSibling, i = 0;
      while (suiv && i < 3) {
        if (suiv.localName === 'tbl') break;
        if (suiv.localName === 'p') {
          const ts = texteDe(suiv).trim();
          if (/^\d\.\d|RENSEIGNEMENTS|ORGANISMES/i.test(ts)) break;
          /* les trames nettoyées portent trois paragraphes VIDES (nom, fonction, téléphone)
             qui gardent leurs runs : on écrit dedans, vides ou non */
          if (suiv.getElementsByTagNameNS(W, 't').length) {
            Array.from(suiv.getElementsByTagNameNS(W, 'sym')).forEach(sy => sy.parentNode.removeChild(sy));
            ecrireDansParagraphe(suiv, lignesHse[i]); i++;
          }
        }
        suiv = suiv.nextSibling;
      }
      if (i) note(hse.nom ? 'coordinateur QHSE (annuaire)' : 'coordinateur QHSE : annuaire absent, lignes vidées');
    }
  }

  /* --- moyens matériels et logistique --------------------------------------- */
  if (d.moyens) {
    remplacerP(doc, 'Alimentation à partir de groupe électrogène portatif', d.moyens.electricite);
    remplacerP(doc, 'Les engins sont équipés de feux LED', d.moyens.eclairage);
    remplacerP(doc, 'Les alimentations en eau font partie', d.moyens.eau);
    /* Repéré AVANT d'écrire la communication : le texte saisi contient souvent
       lui-même « Téléphone + VHF », et l'ancre se serait retrouvée dessus. */
    const pVhf = paragrapheParTexte(doc, 'Téléphone + VHF dans les engins');
    remplacerP(doc, 'Chaque collaborateur possède son téléphone portable', d.moyens.communication);
    /* La trame porte DEUX intitulés « - COMMUNICATION : » de suite : le second
       recevait les accessoires de levage sous un titre faux. On le renomme et
       on loge les engins juste avant. */
    if (pVhf) {
      const lib = pVhf.previousElementSibling &&
        /communication/.test(normal(texteDe(pVhf.previousElementSibling))) ? pVhf.previousElementSibling :
        (pVhf.previousElementSibling && pVhf.previousElementSibling.previousElementSibling &&
         /communication/.test(normal(texteDe(pVhf.previousElementSibling.previousElementSibling)))
           ? pVhf.previousElementSibling.previousElementSibling : null);
      if (lib) ecrireDansParagraphe(lib, '- APPAREILS ET ACCESSOIRES DE LEVAGE :');
      ecrireDansParagraphe(pVhf, d.moyens.levage || d.moyens.communication);
      if (d.moyens.engins && lib) {
        const pl = lib.cloneNode(true), pt = pVhf.cloneNode(true);
        ecrireDansParagraphe(pl, '- ENGINS ET MATERIELS MIS EN ŒUVRE :');
        ecrireDansParagraphe(pt, d.moyens.engins);
        // la trame espace ses blocs par des paragraphes vides : on reproduit,
        // sinon le bloc inséré sort collé (« problème de mise en page »)
        const modeleVide = (lib.nextElementSibling && !texteDe(lib.nextElementSibling).trim() &&
          !porteUneImage(lib.nextElementSibling)) ? lib.nextElementSibling : null;
        const vide = () => {
          if (modeleVide) return modeleVide.cloneNode(true);
          const p = lib.ownerDocument.createElementNS(W, 'w:p');
          return p;
        };
        lib.parentNode.insertBefore(pl, lib);
        lib.parentNode.insertBefore(vide(), lib);
        lib.parentNode.insertBefore(pt, lib);
        lib.parentNode.insertBefore(vide(), lib);
      }
    }
    note('moyens matériels');
  }
  if (d.logistique) {
    remplacerP(doc, 'A proximité de la base vie', d.logistique.parking);
    remplacerP(doc, 'CDES utilisera sa propre base vie', d.logistique.vestiaires);
    note('logistique du personnel');
  }

  /* --- inspection commune préalable ----------------------------------------- */
  const tIns = tableauParTexte(doc, 'DATE de l’INSPECTION');
  if (tIns && d.inspection) {
    const trD = ligneParTexte(tIns, 'DATE de l’INSPECTION');
    if (trD) ecrireCel(trD, 1, d.inspection.dateFr || '');
    const trI = ligneParTexte(tIns, 'INSTALLATIONS MISES A DISPOSITION');
    if (trI && (d.inspection.installations || []).length)
      ecrireCel(trI, 1, d.inspection.installations.map(x => '☒ ' + x).join('\n'));
    const trR = ligneParTexte(tIns, 'REPRESENTANT EU');
    if (trR) {
      const cs = cellules(trR);
      if (cs[1]) ecrireDansCellule(cs[1], d.inspection.repEU || '', true);
      if (cs[3]) ecrireDansCellule(cs[3], d.inspection.repEE || '', true);
    }
    const pts = (d.inspection.points || []).filter(p => p.etat);
    if (pts.length) {
      const lignesTxt = pts.map(p => '☒ ' + p.t + ' : ' + p.etat + (p.obs ? ' — ' + p.obs : ''));
      if (d.inspection.observations) lignesTxt.push('Synthèse : ' + d.inspection.observations);
      insererAvant(doc, 'La mise à disposition, à titre exceptionnel', lignesTxt);
    }
    note('inspection commune (' + pts.length + ' point(s) examiné(s))');
  }

  /* --- risques de coactivité (§ 4.5) ---------------------------------------- */
  if (d.coactivite) {
    if (d.coactivite.aucune) {
      remplacerP(doc, 'Pas de coactivité durant le chantier', d.coactivite.motif || 'Pas de coactivité durant le chantier.');
    } else {
      const l = (d.coactivite.lignes || []).filter(x => x.on !== false).map(x =>
        '• ' + x.danger + (x.significatif ? '  [RISQUE SIGNIFICATIF]' : '') +
        ' — Risques : ' + (x.risques || []).filter(r => r.on !== false).map(r => r.txt).join(' ; ') +
        ' — Mesures : ' + (x.mesures || []).filter(m => m.on !== false).map(m => m.txt).join(' ; '));
      if (l.length) {
        remplacerP(doc, 'Pas de coactivité durant le chantier', l[0]);
        insererAvant(doc, '4.6 - ANALYSE & PREVENTION des RISQUES INHERENTS', l.slice(1));
      }
    }
    note('coactivité : ' + (d.coactivite.aucune ? 'aucune' : (d.coactivite.lignes || []).length + ' interférence(s)'));
  }

  /* --- EPI ------------------------------------------------------------------- */
  const tEpi = tableauParTexte(doc, 'Equipements de Protection Individuelle');
  if (tEpi && d.epiEtats) {
    const tr = ligneParTexte(tEpi, 'Obligatoires sur tout le chantier');
    if (tr) {
      const cs = cellules(tr);
      d.epiEtats.forEach((on, i) => {
        const c = cs[i + 1];
        if (!c) return;
        const actuel = texteDe(c).trim();
        // on conserve la mention « Hors travaux par point chaud » de la trame
        const suffixe = /hors travaux/i.test(actuel) ? ' Hors travaux par point chaud' : '';
        ecrireDansCellule(c, on ? ('X' + suffixe) : '');
      });
      note(d.epiEtats.filter(Boolean).length + ' EPI sur 7');
    }
  }

  /* --- consignes générales et particulières ----------------------------------
     La liste de la trame est remplacée par celle de l'application : textes
     réécrits, consignes ajoutées, consignes décochées retirées. Les consignes
     particulières prolongent la même liste, dans le même style. */
  if (d.consignes) {
    const pris = k => (d.consignes[k] || []).filter(c => c.on !== false)
      .map(c => String(c.t || '').trim()).filter(Boolean);
    const tout = pris('generales').concat(pris('particulieres'));
    const n = reecrireListe(doc, ANCRES_CONSIGNES, tout);
    if (n < 0) note('⚠ cette trame n’a pas de liste « consignes générales de sécurité » : ' +
      tout.length + ' consigne(s) saisie(s) ne figurent pas dans le document');
    else note(n + ' consigne(s) écrite(s)');
  }

  /* --- visite médicale -------------------------------------------------------- */
  if (d.visiteMedicale) {
    remplacerP(doc, 'Tous les salariés amenés à conduire certains équipements de travail',
      'Tous les salariés amenés à conduire certains équipements de travail pour lesquels une ' +
      'autorisation de conduite est nécessaire.\n' + d.visiteMedicale);
  }


  /* --- la feuille d'émargement reste VIERGE : elle se signe sur le terrain --- */

  /* --- ce qui sépare le PPSPS du plan de prévention -------------------------- */
  if (d.type === 'ppsps' && d.sps) note(coordinationSPS(doc, d.sps));
  /* Le plan de prévention ne reprend plus les mentions de diffusion en fin de
     document (demande du 09/09) ; le PPSPS garde sa diffusion de coordination. */
  if (d.type === 'ppsps')
    note(diffusion(doc, (d.sps || {}).diffusion, 'Coordination SPS — diffusion et avis'));

  /* --- annexes et clause d'engagement ---------------------------------------- */
  note(annexes(doc, d.annexesListe));
  if (clauseEngagement(doc, d.type)) note('clause d’engagement adaptée au type');

  return journal.filter(Boolean);
}

/* --------------------------------------------------------------------------
   Blocs communs aux trois documents mais au contenu propre à chacun.
   ------------------------------------------------------------------------ */

/** Coordination SPS : n'existe que dans le PPSPS. Inséré en fin de § 1. */
function coordinationSPS(doc, s) {
  const l = [];
  if (s.coordonnateur) l.push('Coordonnateur SPS : ' + s.coordonnateur +
    (s.coordonnateurTel ? ' — ' + s.coordonnateurTel : ''));
  if (s.coordonnateurAdresse) l.push('Adresse : ' + String(s.coordonnateurAdresse).replace(/\n/g, ' — '));
  if (s.categorie) l.push(s.categorie);
  if (s.pgc) l.push('Plan général de coordination (PGC) : ' + s.pgc);
  if (s.registre) l.push('Registre-journal de la coordination : ' + s.registre);
  if (s.dateTransmissionFr) l.push('PPSPS transmis au coordonnateur SPS le ' + s.dateTransmissionFr);
  if (s.effectifPointe) l.push('Effectif de pointe prévu : ' + s.effectifPointe);
  if (s.dureePrevisionnelle) l.push('Durée prévisionnelle des travaux : ' + s.dureePrevisionnelle);
  if (!l.length) return '';
  l.unshift('1.3 bis - COORDINATION SECURITE ET PROTECTION DE LA SANTE');
  const n = insererAvant(doc, '1.4 - RENSEIGNEMENTS CONCERNANT les CONCESSIONNAIRES', l) ||
            insererAvant(doc, 'Voir réponses aux DICT', l);
  return n ? 'coordination SPS (' + (l.length - 1) + ' mention(s))' : '';
}

/** Diffusion et information : le régime n'est pas le même d'un document à l'autre. */
function diffusion(doc, liste, titre) {
  const l = (liste || []).filter(x => x.on).map(x => '☒ ' + x.t);
  if (!l.length) return '';
  l.unshift(titre);
  // ancre volontairement hors tableau : insérer dans une cellule casserait la page
  const n = insererAvant(doc, 'certifient avoir transmis, fait connaître', l);
  return n ? 'diffusion et information (' + (l.length - 1) + ' mention(s))' : '';
}

/** Liste des annexes jointes, à la suite de celles que porte déjà la trame,
    en poursuivant leur numérotation au lieu de repartir de 1. */
function annexes(doc, titres) {
  if (!titres || !titres.length) return '';
  const p = paragrapheParTexte(doc, 'Annexe 1 –') || paragrapheParTexte(doc, 'Annexe 1 -');
  if (!p) return '';
  // dernière annexe déjà listée dans la trame, et son numéro
  let apres = p, dernier = 1, q = p.nextSibling;
  while (q) {
    if (q.nodeType === 1) {
      const m = /^Annexe\s+(\d+)/i.exec(texteDe(q).trim());
      if (m) { apres = q; dernier = Math.max(dernier, parseInt(m[1], 10)); }
      else if (texteDe(q).trim()) break;
    }
    q = q.nextSibling;
  }
  let n = 0;
  titres.forEach(t => {
    const c = p.cloneNode(true);
    if (ecrireDansParagraphe(c, 'Annexe ' + (dernier + n + 1) + ' – ' + t)) {
      apres.parentNode.insertBefore(c, apres.nextSibling); apres = c; n++;
    }
  });
  return n ? n + ' annexe(s) listée(s), numérotées à partir de ' + (dernier + 1) : '';
}

/** La clause d'engagement de fin de document nomme le mauvais document selon
    le type retenu : on la réécrit. */
function clauseEngagement(doc, type) {
  const parties = type === 'protocole'
    ? 'de l’Entreprise Utilisatrice, de l’Entreprise de transport et de leurs sous-traitants'
    : 'de l’Entreprise Utilisatrice, de l’Entreprise Extérieure et de leurs sous-traitants';
  const nom = type === 'protocole' ? 'le présent protocole de sécurité'
            : (type === 'ppsps' ? 'le présent PPSPS' : 'le présent plan de prévention');
  return remplacerP(doc, 'certifient avoir transmis, fait connaître',
    'Par ' + nom + ', les représentants ' + parties + ' certifient avoir transmis, fait connaître ' +
    'et comprendre à l’ensemble de leurs salariés concernés par l’opération l’intégralité des ' +
    'informations qu’il contient. Chaque entreprise reste responsable de l’application des mesures ' +
    'de prévention qui la concernent.');
}

/* ============================================================================
   PROTOCOLE DE SÉCURITÉ — moteur dédié.
   Ce n'est pas une variante du plan de prévention : les rôles sont inversés
   (CDES est l'entreprise UTILISATRICE), il n'y a ni inspection commune ni
   organismes de prévention, les EPI sont sur deux lignes (dépôt / chantiers)
   et les risques sont rangés par opération de transport, chacune dans son
   propre petit tableau.
   ========================================================================= */

/** Coche une valeur parmi les cases d'une ligne : « ☒ PL », « ☐ Bateau »…
    La comparaison ignore les accents : la trame écrit « Chariot Elévateur »,
    l'application « Chariot élévateur ». */
/**
 * Rapprochement d'un libellé de l'application avec celui de la trame.
 * On accepte l'égalité et le préfixe — « Chantiers CDES » retrouve
 * « Chantiers CDES / Adresse du chantier : » — mais JAMAIS l'inclusion
 * quelconque : sinon « Déchargement » cochait aussi « Chargement ».
 */
function correspond(t, v) {
  if (!t || !v) return false;
  if (t === v) return true;
  if (v.length >= 4 && t.startsWith(v)) return true;
  if (t.length >= 4 && v.startsWith(t)) return true;
  return false;
}
function cocherParmi(tr, valeurs, depuis) {
  const cs = cellules(tr);
  const vals = (valeurs || []).map(v => sansAcc(normal(v)));
  let n = 0;
  cs.slice(depuis === undefined ? 1 : depuis).forEach(c => {
    const t = sansAcc(normal(texteDe(c).replace(/[☒☐]/g, ' ')));
    if (!t) return;
    const on = vals.some(v => correspond(t, v));
    cocher(c, on);
    if (on) n++;
  });
  return n;
}
/** Réécrit une cellule de risques/mesures : une ligne ☒ par élément retenu.
    Dans la trame du protocole, la colonne « Risques » est un seul paragraphe
    dont les items sont séparés par des sauts de ligne — cocher item par item
    est impossible, on réécrit donc la cellule entière. */
function ecrireCases(tc, retenus) {
  const l = (retenus || []).map(t => '☒ ' + t);
  if (!l.length) { ecrireDansCellule(tc, 'Sans objet'); return 0; }
  ecrireDansCellule(tc, l.join('\n'));
  return l.length;
}
/** Coche les puces d'une cellule d'après une liste de libellés retenus. */
function cocherPuces(tc, retenus) {
  const ps = puces(tc);
  const vals = (retenus || []).map(r => sansAcc(normal(r)));
  ps.forEach(p => {
    const t = sansAcc(normal(texteDe(p).replace(/[☒☐]/g, ' ')));
    cocherP(p, vals.some(v => correspond(t, v)));
  });
  return (retenus || []).length;
}

function remplirProtocole(doc, d) {
  const journal = [];
  const note = m => { if (m) journal.push(m); };
  const p = d.prot || {};

  /* --- page de garde : intervenante (transporteur) / utilisatrice (CDES) --- */
  const t1 = tableauParTexte(doc, 'ENTREPRISE INTERVENANTE', 'ENTREPRISE UTILISATRICE');
  if (t1) {
    const trs = lignes(t1);
    const tr = trs[1], trResp = trs[2];
    if (tr) {
      const cs = cellules(tr);
      const tp = p.transporteur || {};
      if (cs[0]) ecrireDansCellule(cs[0],
        [tp.nom, tp.adresse, tp.tel].filter(Boolean).join('\n') || 'À compléter');
      if (cs[1] && d.agenceInfo) ecrireDansCellule(cs[1],
        [d.agenceInfo.raison, d.agenceInfo.adresse, d.agenceInfo.tel].filter(Boolean).join('\n'));
    }
    if (trResp) {
      const cs = cellules(trResp);
      if (cs[0] && (p.transporteur || {}).responsable)
        ecrireDansCellule(cs[0], 'Responsables de l’entreprise ou du service : ' + p.transporteur.responsable);
      if (cs[1] && p.responsablesCdes)
        ecrireDansCellule(cs[1], 'Responsables CDES :\n' + p.responsablesCdes);
    }
    note('entreprises : transporteur (intervenante) et CDES (utilisatrice)');
  }
  /* la trame transport porte un exemple (bungalows), la trame mariniers une
     phrase générique : l'une ou l'autre reçoit la description */
  const pDesc = paragrapheParTexte(doc, 'Dépose des nouveaux bungalows') ||
                paragrapheParTexte(doc, 'Transport fluvial (fret) dans le cadre');
  if (pDesc && d.description) { ecrireDansParagraphe(pDesc, d.description); note('description des travaux'); }
  /* trame mariniers : le coordinateur QHSE est écrit depuis l'annuaire, jamais laissé tel quel */
  const pQhse = paragrapheParTexte(doc, 'Coordinateur QHSE CDES');
  if (d.urgence && d.urgence.hse && pQhse) {
    remplacerP(doc, 'Coordinateur QHSE CDES', 'Coordinateur QHSE CDES : ' + d.urgence.hse);
    /* la trame porte le nom sur la ligne suivante : elle part, l'annuaire a parlé */
    let suiv = pQhse.nextSibling, vus = 0;
    while (suiv && vus < 4) {
      if (suiv.localName === 'tbl') break;
      if (suiv.localName === 'p') {
        vus++;
        const ts = texteDe(suiv).trim();
        if (/JOURS|MATIN|Horaires/i.test(ts)) break;
        // la ligne du nom (« M. … (fonction) ») et celle du téléphone (« ☎ 06 … »)
        if (ts && ts.length < 120 && (/^(M\.|Mme|Mr|☎)/.test(ts) || /\d{2}[ .]\d{2}[ .]\d{2}[ .]\d{2}/.test(ts)))
          ecrireDansParagraphe(suiv, '');
      }
      suiv = suiv.nextSibling;
    }
    /* le téléphone du coordinateur est un paragraphe à part, placé après le
       tableau des horaires : un paragraphe qui n'est qu'un numéro part aussi */
    Array.from(doc.getElementsByTagNameNS(W, 'p')).forEach(par => {
      if (/^\s*\d{2}([ .]\d{2}){4}\s*$/.test(texteDe(par))) {
        ecrireDansParagraphe(par, '');
        Array.from(par.getElementsByTagNameNS(W, 'sym')).forEach(sy => sy.parentNode.removeChild(sy));
      }
    });
    note('coordinateur QHSE');
  }
  if (d.typeInfo) {
    remplacerP(doc, 'Etabli en application des article', d.typeInfo.sousTitre);
    note('type : ' + d.typeInfo.court2);
  }

  /* --- renseignements généraux sur le transport ---------------------------- */
  const t3 = tableauParTexte(doc, 'LIEU de l’INTERVENTION', 'TRANSPORTEUR', 'TYPE DE TRANSPORT');
  if (t3) {
    const trLieu = ligneParTexte(t3, 'LIEU de l’INTERVENTION');
    if (trLieu) {
      const cs = cellules(trLieu);
      if (cs[1]) cocherPuces(cs[1], [p.lieu]);
      // l'adresse s'écrit à la suite de la puce « Chantiers CDES », sans
      // fusionner les deux puces en un seul paragraphe
      if (cs[1] && p.adresseChantier) {
        const pa = puces(cs[1]).find(x => normal(texteDe(x)).includes('adresse du chantier'));
        if (pa) ecrireDansParagraphe(pa, texteDe(pa).replace(/\s*:\s*$/, '') + ' : ' + p.adresseChantier);
      }
    }
    const trTr = ligneParTexte(t3, 'TRANSPORTEUR');
    if (trTr) { const cs = cellules(trTr); if (cs[1]) cocherPuces(cs[1], [p.transporteurType]); }
    const trTy = ligneParTexte(t3, 'TYPE DE TRANSPORT');
    if (trTy) { const cs = cellules(trTy);
      if (cs[1]) cocherPuces(cs[1], [p.mode]);
      if (cs[2]) cocherPuces(cs[2], p.operation === 'Chargement et déchargement'
        ? ['Chargement', 'Déchargement'] : [p.operation]); }
    const trNa = ligneParTexte(t3, 'NATURE DU TRANSPORT');
    if (trNa && p.nature) { const cs = cellules(trNa);
      if (cs[1]) ecrireDansCellule(cs[1], '☒ ' + p.nature + (p.natureDetail ? ' : ' + p.natureDetail : '')); }
    const trFr = ligneParTexte(t3, 'FREQUENCE');
    if (trFr && p.frequence) { const cs = cellules(trFr); if (cs[1]) ecrireDansCellule(cs[1], '☒ ' + p.frequence); }
    note('renseignements généraux sur le transport');
  }

  /* --- horaires ------------------------------------------------------------ */
  const t4 = tableauParTexte(doc, 'JOURS', 'MATIN', 'APRES-MIDI');
  /* protocole mariniers : la trame porte ses propres horaires (07h30, vendredi
     16h) ; on ne les écrase que si le conducteur en a saisi */
  if (t4 && d.horaires && !(d.type === 'marinier' && !d.horairesSaisis)) {
    ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'].forEach(j => {
      const h = d.horaires[j.toLowerCase()]; if (!h) return;
      const tr = ligneParTexte(t4, j); if (!tr) return;
      ecrireCel(tr, 1, h.matin || 'Fermé');
      ecrireCel(tr, 2, h.apresMidi || 'Fermé');
    });
    note('horaires d’accès au site');
  }
  if (d.horairesTexte) {
    const ht = String(d.horairesTexte).split('\n').filter(Boolean).join('\n');
    if (paragrapheParTexte(doc, 'Les livraisons sont réalisées pendant les horaires habituels'))
      remplacerP(doc, 'Les livraisons sont réalisées pendant les horaires habituels', ht);
    else if (paragrapheParTexte(doc, 'Les chargements / déchargements sont réalisé'))
      remplacerP(doc, 'Les chargements / déchargements sont réalisé', ht);
  }

  /* --- moyens : quatre lignes de cases à cocher ---------------------------- */
  const t5 = tableauParTexte(doc, 'ENGINS DE TRANSPORT', 'MOYENS LOGISTIQUES', 'CONDITIONNEMENT');
  if (t5) {
    const paire = (ancre, sel, autre) => {
      const tr = ligneParTexte(t5, ancre);
      if (!tr) return 0;
      const n = cocherParmi(tr, sel);
      if (autre) {                       // la ligne « Autre (à préciser) » suit
        const suiv = tr.nextElementSibling;
        if (suiv && normal(texteDe(suiv)).includes('autre'))
          ecrireCel(suiv, cellules(suiv).length - 1, 'Autre (à préciser) : ' + autre);
      }
      return n;
    };
    let n = 0;
    n += paire('ENGINS DE TRANSPORT', p.engins, p.enginsAutre);
    n += paire('MOYENS LOGISTIQUES', p.logistique, p.logistiqueAutre);
    n += paire('MOYENS MANUTENTTION', p.manutention, p.manutentionAutre);
    n += paire('CONDITIONNEMENT', p.conditionnement, '');
    note('moyens : ' + n + ' case(s) cochée(s)');
  }

  /* --- mode opératoire ------------------------------------------------------ */
  const t6 = tableauParTexte(doc, 'Mode opératoire');
  if (t6 && p.modeOperatoire) {
    const trs = lignes(t6);
    const cible = trs[1] || trs[0];
    if (cible) ecrireCel(cible, 0, p.modeOperatoire);
    note('mode opératoire');
  }

  /* --- habilitations : on ne garde que celles retenues ---------------------- */
  const t7 = tableauParTexte(doc, 'Activité', 'Habilitations');
  if (t7) {
    const retenues = (p.habilitationsRetenues || []).map(h => normal(h.activite));
    let gardees = 0;
    lignes(t7).slice(1).forEach(tr => {
      const c = cellules(tr)[0];
      const t = c ? normal(texteDe(c)) : '';
      const ok = retenues.some(r => r === t || r.includes(t) || t.includes(r));
      if (!ok && retenues.length) supprimerLigne(tr); else gardees++;
    });
    note(gardees + ' habilitation(s) retenue(s)');
  }
  if (p.pretMateriel) remplacerP(doc, 'Aucun prêt de matériel', p.pretMateriel);

  /* --- risques : un petit tableau par opération de transport ---------------- */
  const ancresOp = ['Accès et circulation dans l’enceinte',
                    'manœuvre d’engins et opérations de levage',
                    'Transport de fournitures'];
  let nOps = 0;
  /* Pour les opérations ajoutées par le conducteur (au-delà des trois de la
     trame), on clone un tableau existant : même gabarit, même mise en forme.
     Le modèle et le point d'insertion sont relevés AVANT toute suppression. */
  let modele = null, parent = null, apres = null;
  const remplirTableau = (tbl, op) => {
    const trs = lignes(tbl);
    /* la ligne de contenu suit l'en-tête « Risques liés à l'activité » ; on ne
       compte pas les lignes, la trame mariniers glisse un tableau de produits
       chimiques avant cet en-tête */
    const iEntete = trs.findIndex(tr => /risques li[ée]s/.test(normal(texteDe(tr))));
    const trTitre = trs[0], trContenu = (iEntete >= 0 && trs[iEntete + 1]) || trs[2] || trs[trs.length - 1];
    if (trTitre) ecrireDansCellule(cellules(trTitre)[0], '☒ ' + op.operation);
    if (trContenu) {
      const cs = cellules(trContenu);
      if (cs[0]) ecrireCases(cs[0], (op.risques || []).filter(r => r.on).map(r => r.txt));
      if (cs[1]) ecrireCases(cs[1], (op.mesures || []).filter(m => m.on).map(m => m.txt));
    }
  };
  /* Les opérations de la trame : celles qui portent une « ancre » (protocole
     mariniers, sept tableaux) ou, à défaut, les trois du protocole transport. */
  const ops = p.risques || [];
  const deTrame = ops.filter(o => o && !o.libre && (o.ancre || ancresOp[ops.indexOf(o)]));
  deTrame.forEach(op => {
    const ancre = op.ancre || ancresOp[ops.indexOf(op)];
    const tbl = tableauParTexte(doc, ancre, 'Mesures de prévention applicables');
    if (!tbl) return;
    if (!modele) { modele = tbl.cloneNode(true); parent = tbl.parentNode; }
    apres = tbl.nextSibling;                   // ce qui suit le dernier tableau de la trame
    if (!op.on) {                              // opération écartée : le tableau part
      if (tbl.parentNode) tbl.parentNode.removeChild(tbl);
      return;
    }
    remplirTableau(tbl, op);
    nOps++;
  });
  let nLibres = 0;
  ops.filter(o => o && !deTrame.includes(o)).forEach(op => {
    if (!op || !op.on || !modele || !parent) return;
    const titre = String(op.operation || '').trim();
    const utiles = (op.risques || []).concat(op.mesures || []).filter(x => x.on && !estGabarit(x.txt));
    if (!titre || estGabarit(titre) || !utiles.length) return;   // gabarit laissé vide : pas dans le Word
    /* deux tableaux qui se touchent fusionnent dans Word : on glisse un paragraphe vide entre eux */
    const sep = doc.createElementNS(W, 'w:p');
    const tbl = modele.cloneNode(true);
    parent.insertBefore(sep, apres);
    parent.insertBefore(tbl, apres);
    remplirTableau(tbl, { operation: titre,
      risques: (op.risques || []).filter(x => !estGabarit(x.txt)),
      mesures: (op.mesures || []).filter(x => !estGabarit(x.txt)) });
    nOps++; nLibres++;
  });
  note(nOps + ' opération(s) de transport analysée(s)' + (nLibres ? ' dont ' + nLibres + ' ajoutée(s) sur le gabarit de la trame' : ''));

  /* --- EPI : UNE seule ligne, celle du lieu retenu -------------------------
     Le protocole porte deux lignes (dépôt / chantiers) mais une opération se
     déroule à un seul endroit : on renseigne la ligne correspondante et on
     retire l'autre, plutôt que de cocher les deux. */
  const tEpi = tableauParTexte(doc, 'Equipements de Protection Individuelle');
  if (tEpi && p.epiEtats) {
    const noms = ['Dépôt CDES', 'Chantiers CDES'];
    const retenue = Math.min(Math.max(p.epiLigne || 0, 0), noms.length - 1);
    noms.forEach((nom, li) => {
      const tr = ligneParTexte(tEpi, nom); if (!tr) return;
      if (li !== retenue) { supprimerLigne(tr); return; }
      const cs = cellules(tr);
      (p.epiEtats[li] || []).forEach((on, i) => { if (cs[i + 1]) ecrireDansCellule(cs[i + 1], on ? 'X' : ''); });
    });
    note('EPI : ligne « ' + noms[retenue] +' » uniquement');
  }

  /* --- règles de sécurité majeures ------------------------------------------ */
  if (p.consignes) {
    const tout = p.consignes.filter(c => c.on !== false)
      .map(c => String(c.t || '').trim()).filter(Boolean);
    const n = reecrireListe(doc, ['Accès du site strictement interdit',
      'Acces du site strictement interdit', 'Accès du chantier strictement interdit',
      'Suivre les règles de circulation'], tout);
    if (n < 0) note('⚠ règles de sécurité : liste introuvable dans cette trame, ' +
      tout.length + ' règle(s) non reportée(s)');
    else note(n + ' règle(s) de sécurité écrite(s)');
  }

  /* --- emplacement des dispositifs de secours (le tableau condensé) --------- */
  const tSec = tableauParTexte(doc, 'Emplacement des dispositifs de secours');
  if (tSec && p.secours) {
    const trs = lignes(tSec);
    const tr = trs[trs.length - 1];
    if (tr) {
      // ces cellules portent des pictogrammes : on garde l'image, pas le texte
      const cs = cellules(tr);
      if (cs[0] && p.secours.sst) ecrireCelluleGardantImages(cs[0], p.secours.sst);
      if (cs[1] && p.secours.pollution) ecrireCelluleGardantImages(cs[1], p.secours.pollution);
      if (cs[2] && p.secours.incendie) ecrireCelluleGardantImages(cs[2], p.secours.incendie);
    }
    note('dispositifs de secours');
  }

  /* --- numéros d'urgence ----------------------------------------------------- */
  const t13 = tableauParTexte(doc, 'Numéros d’Urgence');
  if (t13 && d.urgence) {
    const trs = lignes(t13);
    const tr = trs[trs.length - 1];
    if (tr) {
      const cs = cellules(tr);
      const cible = cs[cs.length - 1];
      const l = [];
      if (d.urgence.conducteur) l.push('☒ Conducteur de travaux : ' + d.urgence.conducteur);
      if (d.urgence.responsable) l.push('☒ Responsable CDES : ' + d.urgence.responsable);
      if (d.urgence.hse) l.push('☒ Responsable HSE : ' + d.urgence.hse);
      if (d.urgence.gps) l.push('Point GPS : ' + d.urgence.gps);
      if (d.urgence.specificites) l.push(d.urgence.specificites);
      if (l.length && cible) ecrireDansCellule(cible, l.join('\n'));
    }
    note('numéros d’urgence');
  }

  /* --- signatures : trois parties -------------------------------------------- */
  const t14 = tableauParTexte(doc, 'Signature des parties');
  if (t14 && d.signataires) {
    Object.keys(d.signataires).forEach(k => {
      const tr = ligneParTexte(t14, k); if (!tr) return;
      const s = d.signataires[k];
      ecrireCel(tr, 1, s.nom || '');
      if (s.date) ecrireCel(tr, 2, s.date);
    });
    note('signataires (3 parties)');
  }

  /* --- la feuille d'émargement reste vierge ---------------------------------- */

  note(diffusion(doc, p.diffusion, 'Diffusion et suivi du protocole (art. R.4515-6)'));
  note(annexes(doc, d.annexesListe));
  // la trame parle de « plan de prévention » dans sa clause d'engagement
  if (clauseEngagement(doc, 'protocole')) note('clause d’engagement adaptée au protocole');
  return journal.filter(Boolean);
}

/* ---------------------- en-têtes de page (nom du chantier) -----------------
   Le nom du chantier est répété dans les en-têtes de section de la trame,
   parfois en zone de texte (donc dupliqué pour compatibilité). On remplace
   chaque paragraphe dont le texte correspond à l'un des libellés d'origine. */
const ENTETES_A_REMPLACER = [
  'nom du chantier',
  'andernos les bains',
  'dragage sur le réseau à petit gabarit de l’uhc n°1 – campagne de dragage urgent 2024 - audruicq',
  'bathymétrie - chantier pra chaponval'
];
function remplirEntete(doc, titre, mention) {
  let n = 0;
  Array.from(doc.getElementsByTagNameNS(W, 'p')).forEach(p => {
    const t = normal(texteDe(p));
    if (!t) return;
    if (ENTETES_A_REMPLACER.some(x => t === normal(x))) {
      if (ecrireDansParagraphe(p, titre)) n++;
    } else if (mention && ['ppsps', 'plan de prevention', 'protocole de securite',
               'plan particulier de securite et de protection de la sante'].includes(t)) {
      if (ecrireDansParagraphe(p, mention)) n++;   // la mention du type en en-tête
    }
  });
  return n;
}
