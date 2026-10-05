/* ============================================================================
   AFFICHAGE OBLIGATOIRE DE CHANTIER
   Produit une page A4 prête à imprimer, à partir du plan de prévention déjà
   saisi. Rien à ressaisir : le chantier, l'adresse, les horaires, l'effectif,
   le conducteur de travaux, l'inspection du travail et la médecine du travail
   viennent du document. Le reste est fixe (valeurs CDES).
   ========================================================================= */

function affJour(h) {
  if (!h) return '—';
  const m = (h.matin || '').trim(), a = (h.apresMidi || '').trim();
  if (!m && !a) return '—';
  return [m, a].filter(Boolean).join(' · ');
}

/** Données de l'affichage, déduites du document courant. */
function affDonnees(d) {
  const ag = AGENCES.find(a => a.code === d.agence) || AGENCES[0];
  const o = d.organismes || {};
  const h = d.horaires || HORAIRES_DEFAUT;
  const effectif = [d.effectifs && d.effectifs.cdes,
    d.effectifs && d.effectifs.interim && !/^ras$/i.test(d.effectifs.interim)
      ? d.effectifs.interim + ' (intérim)' : '',
    (d.entreprisesExt || []).filter(e => e.nom)
      .map(e => e.nom + (e.effectif ? ' (' + e.effectif + ')' : '')).join(', ')
  ].filter(Boolean).join(' · ');
  const cond = d.encadrement && d.encadrement.respTravaux
    ? d.encadrement.respTravaux + (d.encadrement.respTravauxTel ? ' — ' + d.encadrement.respTravauxTel : '')
    : (d.urgence && d.urgence.conducteur) || '';
  return {
    titre: d.titre || '', typeInfo: TYPES.find(t => t.code === d.type) || TYPES[0],
    lieu: d.lieu || '', entite: 'Curages Dragages et Systèmes — ' + (ag.entite || ag.nom),
    activite: d.nature || d.description || '', effectif: effectif || '—',
    conducteur: cond || '—',
    responsable: (d.urgence && d.urgence.responsable) || '',
    hse: (d.urgence && d.urgence.hse) || HSE_DEFAUT,
    dateDebut: d.dateDebut || '', dateFin: d.dateFin || '',
    horaires: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
      .map(j => ({ j: j[0].toUpperCase() + j.slice(1), v: affJour(h[j]) }))
      .concat([{ j: 'Dimanche', v: '—' }]),
    inspection: o.inspection || {}, medecine: o.medecine || MEDECINE_TRAVAIL,
    gps: (d.urgence && d.urgence.gps) || '', lat: d.urgence && d.urgence.lat,
    lon: d.urgence && d.urgence.lon,
    acces: (d.urgence && d.urgence.specificites) || '',
    agence: ag
  };
}

/* ================== AFFICHAGE OBLIGATOIRE — version Word ==================
   Même moteur que les trois documents : on ouvre la trame, on remplace le
   texte par ancres, on referme. Le QR code du point GPS est ajouté à part,
   dans la cellule « QR-GPS ».                                              */
function remplirAffichage(doc, a, dateJour) {
  const journal = [];
  const note = m => { if (m) journal.push(m); };

  const pT = paragrapheParTexte(doc, 'Nom du chantier');
  if (pT && a.titre) { ecrireDansParagraphe(pT, a.titre); note('chantier'); }

  const tInfo = tableauParTexte(doc, 'Adresse du chantier', 'Conducteur de travaux');
  if (tInfo) {
    const set = (ancre, val) => { const tr = ligneParTexte(tInfo, ancre); if (tr && val) ecrireCel(tr, 1, val, true); };
    set('Adresse du chantier', a.lieu);
    set('Entité', a.entite);
    set('Activité', a.activite);
    set('Effectif', a.effectif);
    set('Conducteur de travaux', a.conducteur);
    note('informations chantier');
  }

  const tHor = tableauParTexte(doc, 'Lundi', 'Dimanche');
  if (tHor && a.horaires) {
    const tr = lignes(tHor)[1];
    if (tr) {
      const cs = cellules(tr);
      a.horaires.forEach((hj, i) => { if (cs[i]) ecrireDansCellule(cs[i], hj.v || '—'); });
      note('horaires');
    }
  }

  if (a.lat != null && a.lon != null)
    remplacerP(doc, 'Coordonnées :', 'Coordonnées : ' +
      Number(a.lat).toFixed(6) + ', ' + Number(a.lon).toFixed(6));
  const repere = [a.gps, a.acces].filter(Boolean).join(' — ');
  if (repere) remplacerP(doc, 'Repère / accès :', 'Repère / accès : ' + repere);

  const tIns = tableauParTexte(doc, 'Organisme');
  if (tIns && a.inspection) {
    const set = (ancre, val) => { const tr = ligneParTexte(tIns, ancre); if (tr && val) ecrireCel(tr, 1, val, true); };
    set('Organisme', a.inspection.nom);
    set('Adresse', a.inspection.adresse);
    set('Téléphone', a.inspection.tel);
    note('inspection du travail');
  }
  const tMed = tableauParTexte(doc, 'Service de santé');
  if (tMed && a.medecine && a.medecine.nom) {
    const set = (ancre, val) => { const tr = ligneParTexte(tMed, ancre); if (tr && val) ecrireCel(tr, 1, val, true); };
    set('Service de santé', a.medecine.nom);
    set('Adresse', a.medecine.adresse);
    set('Téléphone', a.medecine.tel);
    note('médecine du travail');
  }
  if (dateJour) note('daté du ' + dateJour);
  return journal;
}
