/* ============================================================================
   BRANCHEMENT — webhook Apps Script, sauvegarde Google Sheets, assistance IA.
   La clé IA n'est JAMAIS ici : elle vit dans les propriétés du script Google.
   L'application n'envoie que du texte et reçoit des propositions.
   ========================================================================= */

const CONF_SYNC = 'pdp_conf_v1';
let conf = { url: '', secret: '', auto: true, appareil: '', derniere: '', ia: null };

/* L'adresse peut venir de deux endroits : le fichier lui-même (CONFIG.WEBHOOK_URL,
   renseigné une fois avant la mise en ligne sur l'intranet) ou les réglages de
   l'appareil. Le fichier fait foi pour tout le monde ; un réglage local ne sert
   qu'à travailler sur un autre serveur, et il prime. */
function urlDuFichier() { return ''; }   // V2 : plus d'adresse dans les fichiers publics

/* V2 — lien de branchement : …/#config=<adresse + mot de passe encodés>, distribué
   par la tuile de l'intranet. Lu UNE fois, gardé sur l'appareil, retiré de l'adresse. */
function appliquerLienBranchement() {
  const m = /[#&]config=([A-Za-z0-9_-]+)/.exec(location.hash || '');
  if (!m) return false;
  try {
    let b = m[1].replace(/-/g, '+').replace(/_/g, '/');
    b += '='.repeat((4 - b.length % 4) % 4);
    const c = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b), ch => ch.charCodeAt(0))));
    if (c && /\/exec$/.test(c.u || '') && c.s) {
      conf.url = c.u; conf.secret = c.s; conf.parFichier = false; sauverConf();
      history.replaceState(null, '', location.pathname + location.search);
      setTimeout(() => toast('Appareil branché au serveur CDES ✓'), 400);
      return true;
    }
  } catch (e) { /* lien abîmé */ }
  setTimeout(() => toast('Lien de branchement illisible : rouvre l’outil depuis l’intranet', true), 400);
  return false;
}
function chargerConf() {
  try { const r = localStorage.getItem(CONF_SYNC); if (r) Object.assign(conf, JSON.parse(r)); } catch (e) {}
  appliquerLienBranchement();
  if (!conf.url && urlDuFichier()) { conf.url = urlDuFichier(); conf.parFichier = true; }
  else if (conf.url && conf.url === urlDuFichier()) conf.parFichier = true;
  else conf.parFichier = false;
  if (!conf.appareil) { conf.appareil = 'appareil-' + Math.random().toString(36).slice(2, 8); sauverConf(); }
}
function sauverConf() { try { localStorage.setItem(CONF_SYNC, JSON.stringify(conf)); } catch (e) {} }
function branche() { return !!conf.url; }

/** L'erreur la plus fréquente : coller l'adresse /dev au lieu de /exec. */
function verifierUrl(u) {
  u = String(u || '').trim();
  if (!u) return 'Colle l’adresse du déploiement.';
  if (!/^https:\/\/script\.google\.com\//.test(u))
    return 'Ce n’est pas une adresse Google Apps Script.';
  if (/\/dev\/?$/.test(u))
    return 'Cette adresse finit par /dev : c’est l’adresse de test, elle ne marche que pour toi. ' +
           'Prends celle du déploiement, qui finit par /exec.';
  if (!/\/exec\/?$/.test(u))
    return 'L’adresse doit finir par /exec.';
  return '';
}

/** Appel du webhook. En text/plain pour éviter la requête préalable CORS. */
async function appel(action, charge, delai) {
  if (!conf.url) throw new Error('Aucun branchement configuré (Réglages ▸ Branchement).');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), delai || 60000);
  let r;
  try {
    r = await fetch(conf.url, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ action, secret: conf.secret, appareil: conf.appareil }, charge || {}))
    });
  } catch (e) {
    clearTimeout(t);
    throw new Error(e.name === 'AbortError'
      ? 'Le serveur n’a pas répondu à temps.'
      : 'Serveur injoignable. Vérifie l’adresse et ta connexion.');
  }
  clearTimeout(t);
  if (!r.ok) throw new Error(r.status === 404
    ? 'Le serveur a répondu 404 : cette adresse ne correspond à aucun déploiement actif. '
      + 'C’est l’adresse d’un déploiement supprimé ou archivé — reprends celle de '
      + 'Déployer ▸ Gérer les déploiements.'
    : 'Le serveur a répondu ' + r.status + '.');
  const txt = await r.text();
  let j;
  try { j = JSON.parse(txt); }
  catch (e) {
    throw new Error(/<!DOCTYPE|<html/i.test(txt)
      ? 'Le serveur a renvoyé une page web au lieu de données : le déploiement n’est probablement pas « accessible à tout le monde ».'
      : 'Réponse illisible du serveur.');
  }
  if (!j.ok) throw new Error(j.erreur || 'Erreur du serveur');
  return j;
}

/* ------------------------------ synchronisation --------------------------- */
async function syncNow(silencieux) {
  if (!branche()) { if (!silencieux) toast('Pas encore branché', true); return; }
  const index = state.docs.map(d => ({ id: d.id, maj: d.maj }));
  const aPousser = state.docs.filter(d => !d._sync || d._sync < d.maj);
  try {
    const j = await appel('sync', {
      index, docs: aPousser.map(d => { const c = Object.assign({}, d); delete c._sync; return c; }),
      carnet: state.carnet || null
    });
    const t = new Date().toISOString();
    aPousser.forEach(d => { d._sync = d.maj; });
    (j.docs || []).forEach(d => {
      const i = state.docs.findIndex(x => x.id === d.id);
      d._sync = d.maj;
      if (i >= 0) state.docs[i] = d; else state.docs.unshift(d);
      if (cur && cur.id === d.id) cur = d;
    });
    (j.suppressions || []).forEach(s => {
      const i = state.docs.findIndex(x => x.id === s.id);
      if (cur && cur.id === s.id) { cur = null; go('v-docs'); }
      const pierre = { id: s.id, maj: s.maj, supprime: true, _sync: s.maj };
      if (i >= 0) state.docs[i] = pierre; else state.docs.push(pierre);
    });
    if (j.carnet) { Object.assign(CARNET, j.carnet); state.carnet = CARNET; }
    if (j.annuaire) appliquerAnnuaire(j.annuaire, true);   // V2 : annuaire du Référentiel
    conf.derniere = t;
    if (j.ia !== undefined) conf.ia = !!j.ia;   // sinon on garderait un état faux
    sauverConf();
    state.docs.forEach(d=>{if(!d.supprime)migrer(d)});
    save(); renderDocs();
    if (document.getElementById('v-reglages').classList.contains('active')) renderReglages();
    if (!silencieux)
      toast('Synchronisé ✓ ' + (j.recus || 0) + ' envoyé(s), ' + ((j.docs || []).length) + ' reçu(s)');
    return j;
  } catch (e) {
    if (!silencieux) toast(e.message, true);
    throw e;
  }
}
function syncAuto() { if (conf.auto && branche()) syncNow(true).catch(() => {}); }

/* --------------------------------- réglages ------------------------------- */
function renderBranchement() {
  const box = document.getElementById('branchement');
  if (!box) return;
  box.innerHTML = `
   <p class="small muted">${branche()
     ? 'Cet appareil est branché au serveur CDES. Rien à régler ici.'
     : 'Ouvre l’outil depuis la tuile de l’intranet HSE : l’appareil se branche tout seul. Sans branchement, l’application marche quand même, mais tout reste sur l’appareil, sans annuaire ni assistance IA.'}</p>
   ${conf.parFichier ? '' : ''}
   ${champConf('url','Adresse du déploiement (finit par /exec)','https://script.google.com/macros/s/…/exec')}
   ${champConf('secret','Mot de passe (rempli tout seul par le lien de l’intranet)','—','password')}
   <div class="row" style="margin-top:8px">
     <button class="btn btn-primary grow" onclick="enregistrerBranchement()">💾 Enregistrer et tester</button>
     ${branche() ? '<button class="btn btn-ghost" onclick="syncNow().catch(()=>{})">🔄 Synchroniser</button>' : ''}
   </div>
   ${branche() ? `<div class="ck ${conf.auto ? 'on' : ''}" style="margin-top:10px" onclick="bascAuto()">
     <span class="bx">${conf.auto ? '✓' : ''}</span><span class="tx">Synchroniser automatiquement
     à l’ouverture et après chaque génération de document</span></div>` : ''}
   <div id="etat-branchement">${etatBranchement()}</div>`;
}
function etatBranchement() {
  if (!branche()) return '<div class="avert">Pas encore branché. L’appli marche quand même.</div>';
  return `<div class="fiche">
    <div class="fl raison">✅ <span>Branché${conf.parFichier ? ' par le fichier — rien à régler ici' : ''}</span></div>
    <div class="fl">🔗 <span style="word-break:break-all">${esc(conf.url)}</span></div>
    ${conf.derniere ? '<div class="fl">🕒 <span>Dernière synchro : ' +
      esc(new Date(conf.derniere).toLocaleString('fr-FR')) + '</span></div>' : ''}
    ${(urlDuFichier() && conf.url !== urlDuFichier()) ? `<div class="fl manque">⚠️ <span>
      L’adresse réglée sur ce poste n’est pas celle inscrite dans le fichier mis en ligne.
      Toi tu travailles sur la bonne, mais <b>les autres iront sur celle du fichier</b> :
      <span style="word-break:break-all">${esc(urlDuFichier())}</span>.
      Corrige la ligne 19 du fichier avant de le republier.</span></div>` : ''}
    <div class="fl">${conf.ia ? '🤖 <span>Assistance IA disponible</span>'
      : '💤 <span>Pas de clé IA côté serveur : l’assistance est désactivée</span>'}</div>
  </div>`;
}
function champConf(cle, label, ph, type) {
  return `<div class="ch"><label class="f" for="cf_${cle}">${esc(label)}</label>
    <input type="${type || 'text'}" id="cf_${cle}" value="${esc(conf[cle] || '')}" placeholder="${esc(ph)}" autocomplete="off"></div>`;
}
function bascAuto() { conf.auto = !conf.auto; sauverConf(); renderBranchement(); }
async function enregistrerBranchement() {
  const u = document.getElementById('cf_url').value.trim();
  const s = document.getElementById('cf_secret').value.trim();
  const box = document.getElementById('etat-branchement');
  if (!u) { conf.url = ''; conf.secret = ''; conf.parFichier = false; sauverConf(); renderBranchement(); toast('Branchement retiré'); return; }
  const pb = verifierUrl(u);
  if (pb) { box.innerHTML = '<div class="avert"><b>Adresse à corriger :</b><br>' + esc(pb) + '</div>'; return; }
  conf.url = u; conf.secret = s; conf.parFichier = (u === urlDuFichier()); sauverConf();
  box.innerHTML = '<p class="hint">Test en cours…</p>';
  try {
    const j = await appel('ping', {}, 25000);
    conf.ia = !!j.ia; sauverConf();
    if (j.annuaire) appliquerAnnuaire(j.annuaire, true);
    const vs = j.version ? 'script ' + j.version : 'script ANTÉRIEUR à la V13 — colle le dernier Code_PDP.gs puis fais une nouvelle version du déploiement';
    box.innerHTML = '<div class="avert ok">✅ Le serveur répond (' + esc(vs) + ')' +
      (j.ia ? ' et la clé IA est en place.' : ', mais aucune clé IA n’est configurée.') + '</div>';
    await syncNow(true).catch(() => {});
    renderBranchement();
    const b2 = document.getElementById('etat-branchement');
    if (b2 && conf.ia) b2.insertAdjacentHTML('afterbegin',
      '<div class="avert ok">✅ Le serveur répond et la clé IA est en place.</div>');
  } catch (e) {
    box.innerHTML = '<div class="avert"><b>Le test a échoué :</b><br>' + esc(e.message) + '</div>';
  }
}

/* ================================ IA ====================================== */
function catalogues() {
  return {
    natures: NATURES,
    familles: BIBLIO.map(f => f.famille),
    risquesEnv: RISQUES_ENV.map(r => r.danger),
    epi: EPI.map(e => e.nom)
  };
}
function iaDispo() { return branche() && conf.ia !== false; }

let propositionIA = null;

async function analyserChantier() {
  if (!cur) return;
  if (!(cur.description || '').trim() && !(cur.titre || '').trim()) {
    toast('Décris d’abord le chantier en quelques lignes', true); return;
  }
  const box = document.getElementById('ia-panneau');
  if (box) box.innerHTML = '<div class="avert info">🤖 Analyse en cours… (quelques secondes)</div>';
  try {
    const j = await appel('ia-chantier', {
      titre: cur.titre, lieu: cur.lieu, description: cur.description,
      complement: cur.nature ? 'Nature déjà retenue : ' + cur.nature : '',
      catalogues: catalogues()
    });
    if (!j || typeof j.proposition !== 'object' || !j.proposition)
      throw new Error('Le serveur a répondu, mais sans le contenu attendu. Le script Google '
        + 'ne tourne probablement pas sur sa dernière version : colle le dernier Code_PDP.gs, '
        + 'puis Déployer ▸ Gérer les déploiements ▸ ✏️ ▸ Nouvelle version.');
    propositionIA = j.proposition;
    propositionIA._choix = {
      nature: true, familles: propositionIA.familles.slice(),
      risquesEnv: propositionIA.risquesEnv.slice(), epi: propositionIA.epi.slice(),
      consignes: propositionIA.consignes.slice(), moyens: true, coactivite: true
    };
    renderPropositionIA();
  } catch (e) {
    if (box) box.innerHTML = '<div class="avert"><b>Analyse impossible :</b><br>' + esc(e.message) + '</div>';
  }
}
function bascIA(cle, valeur) {
  const l = propositionIA._choix[cle];
  if (Array.isArray(l)) { const i = l.indexOf(valeur); if (i >= 0) l.splice(i, 1); else l.push(valeur); }
  else propositionIA._choix[cle] = !propositionIA._choix[cle];
  renderPropositionIA();
}
function renderPropositionIA() {
  const box = document.getElementById('ia-panneau');
  if (!box) return;
  if (!propositionIA) { box.innerHTML = ''; return; }
  const p = propositionIA, ch = p._choix;
  const liste = (cle, titre, valeurs) => valeurs.length ? `<h3>${esc(titre)}</h3>` + valeurs.map(v =>
    `<div class="ck ${ch[cle].includes(v) ? 'on' : ''}" onclick="bascIA('${cle}',${JSON.stringify(v).replace(/"/g, '&quot;')})">
      <span class="bx">${ch[cle].includes(v) ? '✓' : ''}</span><span class="tx">${esc(v)}</span></div>`).join('') : '';
  box.innerHTML = `<div class="bloc exp"><div class="bh"><span class="pic">🤖</span>
     <b>Proposition de l’assistant<span class="sd">Coche ce que tu retiens. Rien n’est appliqué sans toi.</span></b></div>
   <div class="bb">
   ${p.resume ? '<div class="avert info">' + esc(p.resume) + '</div>' : ''}
   ${p.nature ? `<h3>Nature des opérations</h3>
     <div class="ck ${ch.nature ? 'on' : ''}" onclick="bascIA('nature')"><span class="bx">${ch.nature ? '✓' : ''}</span>
     <span class="tx">${esc(p.nature)}</span></div>` : ''}
   ${liste('familles', 'Activités et familles de risques', p.familles)}
   ${liste('risquesEnv', 'Risques importés (environnement du chantier)', p.risquesEnv)}
   ${liste('epi', 'EPI à rendre obligatoires', p.epi)}
   ${liste('consignes', 'Consignes particulières proposées', p.consignes)}
   ${p.moyens ? `<h3>Moyens matériels</h3>
     <div class="ck ${ch.moyens ? 'on' : ''}" onclick="bascIA('moyens')"><span class="bx">${ch.moyens ? '✓' : ''}</span>
     <span class="tx">${esc(p.moyens)}</span></div>` : ''}
   ${p.coactivite ? `<div class="ck ${ch.coactivite ? 'on' : ''}" style="margin-top:8px" onclick="bascIA('coactivite')">
     <span class="bx">${ch.coactivite ? '✓' : ''}</span><span class="tx">
     <b>Déclarer de la coactivité</b><br><span class="muted small">La description mentionne d’autres
     intervenants sur la zone.</span></span></div>` : ''}
   <div class="row" style="margin-top:12px">
     <button class="btn btn-primary grow" onclick="appliquerIA()">✓ Appliquer ce que j’ai coché</button>
     <button class="btn btn-ghost" onclick="propositionIA=null;renderPropositionIA()">Ignorer</button></div>
   <p class="hint">L’assistant propose à partir de ta description. Il ne connaît pas le terrain :
   c’est toi qui décides, et tu restes responsable du contenu du document.</p>
   </div></div>`;
}
function appliquerIA() {
  if (!propositionIA) return;
  const p = propositionIA, ch = p._choix, faits = [];
  if (p.nature && ch.nature) { cur.nature = p.nature; faits.push('nature'); }
  ch.familles.forEach(f => {
    const i = BIBLIO.findIndex(x => x.famille === f);
    if (i >= 0 && !cur.risques.exportes.some(o => o.source === f)) { bascFamille(i); }
  });
  if (ch.familles.length) faits.push(ch.familles.length + ' activité(s)');
  ch.risquesEnv.forEach(d => {
    const i = RISQUES_ENV.findIndex(x => x.danger === d);
    if (i >= 0 && !cur.risques.importes.some(x => x.source === d)) bascImporte(i);
  });
  if (ch.risquesEnv.length) faits.push(ch.risquesEnv.length + ' risque(s) importé(s)');
  if (ch.epi.length) {
    EPI.forEach((e, i) => { if (ch.epi.includes(e.nom)) cur.epi[i].on = true; });
    faits.push(ch.epi.length + ' EPI');
  }
  ch.consignes.forEach(t => {
    if (!cur.consignes.particulieres.some(c => c.t === t))
      cur.consignes.particulieres.push({ t: t, on: true });
  });
  if (ch.consignes.length) faits.push(ch.consignes.length + ' consigne(s)');
  if (p.moyens && ch.moyens) { cur.moyens.engins = p.moyens; faits.push('moyens'); }
  if (p.coactivite && ch.coactivite) { cur.risques.coactivite.aucune = false; faits.push('coactivité'); }
  propositionIA = null;
  majDoc(); renderEtapes();
  toast('Appliqué : ' + (faits.join(', ') || 'rien') + ' ✓');
}

/* --------------------------- mémoire technique ---------------------------- */
async function lireMemoire(inp) {
  const f = inp.files[0]; inp.value = '';
  if (!f) return;
  const box = document.getElementById('ia-memoire');
  if (f.size > 8 * 1024 * 1024) {
    box.innerHTML = '<div class="avert">Fichier trop lourd (' + Math.round(f.size / 1048576) +
      ' Mo). Envoie seulement les pages utiles, 8 Mo au maximum.</div>';
    return;
  }
  box.innerHTML = '<div class="avert info">📄 Lecture du document… cela peut prendre une minute.</div>';
  try {
    const b64 = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(',')[1]);
      r.onerror = () => rej(new Error('Fichier illisible'));
      r.readAsDataURL(f);
    });
    const j = await appel('ia-memoire', { nom: f.name, contenu: b64, catalogues: catalogues() }, 180000);
    /* Un serveur qui répond « ok » sans le contenu attendu est un serveur qui
       tourne encore sur une ancienne version du script : on le dit clairement
       au lieu de planter. */
    if (!j || typeof j.extrait !== 'object' || !j.extrait)
      throw new Error('Le serveur a répondu, mais sans le contenu attendu. Le script Google '
        + 'ne tourne probablement pas sur sa dernière version : colle le dernier Code_PDP.gs, '
        + 'puis Déployer ▸ Gérer les déploiements ▸ ✏️ ▸ Nouvelle version (l’adresse /exec ne change pas). '
        + 'Vérifie aussi, dans Réglages ▸ Branchement, que l’adresse est bien celle du script '
        + 'des plans de prévention, pas celle d’un autre outil.');
    memoireExtrait = j.extrait;
    memoireExtrait._images = (j.images || []).map((im, i) => ({ ...im, id: 'm' + i, prise: i < 2 }));
    memoireExtrait._logos = (j.logos || []).map((im, i) => ({ ...im, id: 'l' + i, role: '' }));
    renderMemoire(j.caracteres);
  } catch (e) {
    box.innerHTML = '<div class="avert"><b>Lecture impossible :</b><br>' + esc(e.message) + '</div>';
  }
}
let memoireExtrait = null;
const CHAMPS_MEMOIRE = [
  { k: 'titre', l: 'Intitulé du chantier' }, { k: 'lieu', l: 'Lieu de l’intervention' },
  { k: 'departement', l: 'Département' }, { k: 'description', l: 'Description des travaux' },
  { k: 'nature', l: 'Nature des opérations' }, { k: 'dateDebut', l: 'Date de début' },
  { k: 'dateFin', l: 'Date de fin' }, { k: 'duree', l: 'Durée' },
  { k: 'effectif', l: 'Effectif prévu' }
];
function renderMemoire(caracteres) {
  const box = document.getElementById('ia-memoire');
  if (!box) return;
  if (!memoireExtrait) { box.innerHTML = ''; return; }
  const x = memoireExtrait;
  if (!x._choix) {
    x._choix = {};
    CHAMPS_MEMOIRE.forEach(c => { if (x[c.k]) x._choix[c.k] = true; });
    if (x.moa && x.moa.nom) x._choix.moa = true;
    if (x.moe && x.moe.nom) x._choix.moe = true;
  }
  const ligne = (cle, label, valeur) => valeur ? `<div class="ck ${x._choix[cle] ? 'on' : ''}"
     onclick="memoireExtrait._choix['${cle}']=!memoireExtrait._choix['${cle}'];renderMemoire()">
     <span class="bx">${x._choix[cle] ? '✓' : ''}</span><span class="tx">
     <span class="muted small">${esc(label)}</span><br>${esc(valeur)}</span></div>` : '';
  const conf = { haute: ['ok', 'élevée'], moyenne: ['', 'moyenne'], faible: ['', 'faible'] }[x.confiance] || ['', '?'];
  box.innerHTML = `<div class="bloc imp"><div class="bh"><span class="pic">📄</span>
     <b>Lu dans le mémoire technique<span class="sd">${caracteres ? caracteres + ' caractères lus · ' : ''}confiance ${esc(conf[1])}</span></b></div>
   <div class="bb">
   <div class="avert ${conf[0]}">Relis chaque ligne avant de l’accepter : l’assistant a pu mal
   comprendre le document. Décoche ce qui est faux.</div>
   ${CHAMPS_MEMOIRE.map(c => ligne(c.k, c.l, x[c.k])).join('')}
   ${x.moa && x.moa.nom ? ligne('moa', 'Maître d’ouvrage',
      [x.moa.nom, x.moa.adresse, x.moa.tel].filter(Boolean).join(' — ')) : ''}
   ${x.moe && x.moe.nom ? ligne('moe', 'Maître d’œuvre',
      [x.moe.nom, x.moe.adresse, x.moe.tel].filter(Boolean).join(' — ')) : ''}
   ${(x._logos || []).length ? `<div class="ck on" style="cursor:default"><span class="bx">🏷️</span><span class="tx">
     <span class="muted small">Logos trouvés — désigne celui du maître d’ouvrage (MOA) et du maître d’œuvre (MOE) :
     ils seront posés en page de garde. La colonne Entreprise garde le logo CDES.</span>
     <div class="photogrid" style="margin-top:6px">${x._logos.map((lo, i) => `
       <figure class="ph"><div class="vign" style="background:#fff">
         <img src="data:image/${lo.type === 'png' ? 'png' : 'jpeg'};base64,${lo.b64}" alt="" style="object-fit:contain">
       </div>
       <figcaption>
         <button class="btn btn-xs ${lo.role === 'moa' ? 'btn-primary' : 'btn-ghost'}"
           onclick="roleLogo(${i},'moa');renderMemoire(${caracteres || 0})">MOA</button>
         <button class="btn btn-xs ${lo.role === 'moe' ? 'btn-primary' : 'btn-ghost'}"
           onclick="roleLogo(${i},'moe');renderMemoire(${caracteres || 0})">MOE</button>
         <button class="btn btn-xs btn-ghost" onclick="roleLogo(${i},'');renderMemoire(${caracteres || 0})">—</button>
       </figcaption></figure>`).join('')}
     </div></span></div>` : ''}
   ${(x._images || []).length ? `<div class="ck on" style="cursor:default"><span class="bx">📷</span><span class="tx">
     <span class="muted small">Photos trouvées dans le document — celles cochées iront en page de garde</span>
     <div class="photogrid" style="margin-top:6px">${x._images.map((im, i) => `
       <figure class="ph" style="cursor:pointer;outline:${im.prise ? '2.5px solid var(--ok)' : 'none'}"
         onclick="memoireExtrait._images[${i}].prise=!memoireExtrait._images[${i}].prise;renderMemoire(${caracteres || 0})">
       <div class="vign"><img src="data:image/${im.type === 'png' ? 'png' : 'jpeg'};base64,${im.b64}" alt=""></div>
       <figcaption>${im.prise ? '✓ retenue' : 'ignorée'} · ${im.w}×${im.h}</figcaption></figure>`).join('')}
     </div></span></div>` : ''}
   <div class="row" style="margin-top:12px">
     <button class="btn btn-primary grow" onclick="appliquerMemoire()">✓ Reprendre ce que j’ai coché</button>
     <button class="btn btn-ghost" onclick="memoireExtrait=null;renderMemoire()">Ignorer</button></div>
   </div></div>`;
}
function roleLogo(i, role) {
  if (!memoireExtrait || !memoireExtrait._logos) return;
  memoireExtrait._logos.forEach((l, k) => {
    if (k === i) l.role = (l.role === role ? '' : role);
    else if (role && l.role === role) l.role = '';
  });
}
function appliquerMemoire() {
  if (!memoireExtrait) return;
  const x = memoireExtrait, c = x._choix, faits = [];
  CHAMPS_MEMOIRE.forEach(f => {
    if (c[f.k] && x[f.k]) {
      if (f.k === 'effectif') cur.effectifs.cdes = x[f.k];
      else if (f.k === 'departement') { cur.departement = String(x[f.k]).padStart(2, '0'); appliquerCarnet(cur.departement); }
      else cur[f.k] = x[f.k];
      faits.push(f.l.toLowerCase());
    }
  });
  if (c.moa && x.moa) { cur.moa = { nom: x.moa.nom || '', adresse: x.moa.adresse || '', tel: x.moa.tel || '' }; faits.push('maître d’ouvrage'); }
  if (c.moe && x.moe) { cur.moe = { nom: x.moe.nom || '', adresse: x.moe.adresse || '', tel: x.moe.tel || '' }; faits.push('maître d’œuvre'); }
  if (!cur.titreCourt && cur.titre) cur.titreCourt = cur.titre;
  const photos = (x._images || []).filter(im => im.prise);
  const logos = (x._logos || []).filter(l => l.role);
  if (logos.length) reprendreLogosMemoire(logos).catch(() => {});
  memoireExtrait = null;
  majDoc(); renderEtapes();
  if (photos.length) {
    reprendrePhotosMemoire(photos)
      .then(n => { if (n) { majDoc(); renderPhotos(); faits.push('photos'); }
        toast('Repris : ' + faits.length + ' information(s)' + (n ? ' + ' + n + ' photo(s)' : '') + ' ✓'); })
      .catch(() => toast('Photos : enregistrement impossible sur cet appareil', true));
  } else toast(faits.length ? 'Repris : ' + faits.length + ' information(s) ✓' : 'Rien de coché', !faits.length);
}
/** Mémorise les logos désignés (MOA / MOE) pour la page de garde. */
async function reprendreLogosMemoire(logos) {
  if (!cur.logos) cur.logos = {};
  for (const lo of logos) {
    const bin = atob(lo.b64), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const blob = new Blob([u8], { type: lo.type === 'png' ? 'image/png' : 'image/jpeg' });
    const id = 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await annexePut(id, blob);
    cur.logos[lo.role] = { id: id, w: lo.w, h: lo.h, type: lo.type === 'png' ? 'png' : 'jpg' };
  }
  majDoc();
}

/** Range les images choisies du mémoire avec les photos de la page de garde. */
async function reprendrePhotosMemoire(images) {
  if (!cur.photos) cur.photos = [];
  let n = 0;
  for (const im of images) {
    if (cur.photos.length >= PHOTOS_MAX) break;
    const bin = atob(im.b64), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const blob = new Blob([u8], { type: im.type === 'png' ? 'image/png' : 'image/jpeg' });
    let d = { w: im.w, h: im.h };
    try { d = await tailleImage(blob); } catch (e) {}
    const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await annexePut(id, blob);
    cur.photos.push({ id: id, nom: 'Mémoire technique', taille: blob.size,
      w: d.w, h: d.h, type: im.type === 'png' ? 'png' : 'jpg' });
    n++;
  }
  return n;
}
