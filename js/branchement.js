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

/* ===================== V20 — LECTURE DES DOCUMENTS DANS LE NAVIGATEUR =====================
   Le texte d'un PDF (pdf.js embarqué dans js/lib, jamais de CDN) ou d'un Word est extrait ICI,
   quelle que soit la taille du fichier : rien n'est envoyé à Google sauf le texte utile. Et comme
   le palier gratuit de Groq n'accepte que 8 000 jetons par minute, un long document est lu en
   PASSES de ~12 000 caractères, à une minute d'intervalle, dont les résultats sont fusionnés. */
let pdfjsPret = null;
function chargerPdfjs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (pdfjsPret) return pdfjsPret;
  pdfjsPret = new Promise((ok, ko) => {
    const sc = document.createElement('script'); sc.src = 'js/lib/pdf.min.js?v=' + encodeURIComponent(typeof APP_VERSION !== 'undefined' ? APP_VERSION : '1');
    sc.onload = () => { try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/lib/pdf.worker.min.js'; ok(window.pdfjsLib); } catch (e) { ko(e); } };
    sc.onerror = () => ko(new Error('pdf.js introuvable (js/lib)')); document.head.appendChild(sc);
  });
  return pdfjsPret;
}
/** Texte d'un PDF lu dans le navigateur (couche texte) ; '' pour un PDF scanné sans texte. */
async function textePdfNavigateur(fichier, maxPages, surPage) {
  const lib = await chargerPdfjs();
  const pdf = await lib.getDocument({ data: await fichier.arrayBuffer(), isEvalSupported: false }).promise;
  const n = Math.min(pdf.numPages, maxPages || 150), pages = [];
  for (let i = 1; i <= n; i++) {
    const page = await pdf.getPage(i), tc = await page.getTextContent();
    let y = null, lignes = [], cour = [];
    tc.items.forEach(it => {
      const yy = Math.round((it.transform && it.transform[5]) || 0);
      if (y !== null && Math.abs(yy - y) > 3) { lignes.push(cour.join(' ')); cour = []; }
      y = yy; if (it.str) cour.push(it.str);
    });
    if (cour.length) lignes.push(cour.join(' '));
    pages.push(lignes.join('\n'));
    if (surPage) surPage(i, n);
  }
  try { pdf.destroy(); } catch (e) {}
  return pages.join('\n\n').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
function ligneNormale(l) { return sansAccent(String(l || '')).toLowerCase().replace(/[☒☐|•·\-–]/g, ' ').replace(/\s+/g, ' ').trim(); }
/** Les lignes de la trame vierge (texte fixe du modèle CDES) : elles n'apprennent rien sur le chantier. */
let trameLignesCache = null;
async function lignesDeLaTrame() {
  if (trameLignesCache) return trameLignesCache;
  const set = new Set();
  try {
    const buf = await chargerTrame('pdp');
    if (buf) (await texteDuDocx(buf)).split('\n').forEach(l => { const k = ligneNormale(l); if (k.length >= 15) set.add(k); });
  } catch (e) {}
  trameLignesCache = set; return set;
}
/** Retire du texte lu les lignes qui sont celles de la trame vierge : il ne reste que ce qui est propre au chantier. */
async function epurerAvecTrame(texte) {
  const set = await lignesDeLaTrame();
  if (!set.size) return texte;
  const out = texte.split('\n').filter(l => { const k = ligneNormale(l); return k.length < 15 || !set.has(k); });
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
/** Découpe un texte en morceaux de ~max caractères, sur des fins de paragraphe. */
function decouperTexte(texte, max) {
  const out = []; let cour = '';
  String(texte || '').split(/\n\n+/).forEach(par => {
    if ((cour + '\n\n' + par).length > max && cour) { out.push(cour); cour = par; }
    else cour = cour ? cour + '\n\n' + par : par;
    while (cour.length > max) { out.push(cour.slice(0, max)); cour = cour.slice(max); }
  });
  if (cour) out.push(cour);
  return out;
}
function attendre(ms) { return new Promise(r => setTimeout(r, ms)); }
/** Les passages d'un long document qui parlent du chantier (page de garde + paragraphes à mots-clés), ≤ max caractères. */
function passagesUtiles(texte, max) {
  const mots = /(ma[iî]tre d.ouvrage|ma[iî]trise d.ouvrage|ma[iî]tre d.oeuvre|ma[iî]trise d.oeuvre|moa|moe|adresse|commune|d[ée]partement|code postal|d[ée]lai|dur[ée]e|date|d[ée]marrage|effectif|personnel|nature des travaux|objet|dragage|curage|faucardage|g[ée]nie v[ée]g[ée]tal|terrassement|volume|m3|m³|t[ée]l[ée]phone|t[ée]l\.|chantier|site|lieu|intervention|horaires|planning|phase)/i;
  const pars = String(texte || '').split(/\n\n+/), tete = pars.slice(0, 6).join('\n\n');
  let out = tete, n = tete.length;
  for (let i = 6; i < pars.length && n < max; i++) { if (mots.test(pars[i])) { out += '\n\n' + pars[i]; n += pars[i].length + 2; } }
  return out.slice(0, max);
}
/** Appelle l'IA en plusieurs passes, à ≥ 61 s d'intervalle (palier gratuit : 8 000 jetons/min).
 *  Sur un 413, attend puis réessaie avec des morceaux plus petits. Rend la liste des extraits. */
async function appelParPasses(action, charge, texte, box, delai) {
  let morceaux = decouperTexte(texte, 12000), extraits = [], i = 0, tentatives = 0;
  const total = () => morceaux.length;
  while (i < morceaux.length) {
    if (i > 0) {
      for (let sec = 61; sec > 0; sec--) {
        if (box) box.innerHTML = '<div class="avert info">📥 Passe ' + (i + 1) + ' / ' + total() + ' dans ' + sec + ' s… (la clé IA gratuite ne lit que 8 000 mots par minute — le document fait ' + Math.round(texte.length / 1000) + ' k caractères)</div>';
        await attendre(1000);
      }
    }
    if (box) box.innerHTML = '<div class="avert info">📥 Lecture, passe ' + (i + 1) + ' / ' + total() + '…</div>';
    try {
      const j = await appel(action, Object.assign({}, charge, { texte: morceaux[i], partie: i + 1, total: total() }), delai || 240000);
      if (!j || typeof j.extrait !== 'object' || !j.extrait)
        throw new Error('Le serveur a répondu, mais sans le contenu attendu : il ne tourne pas sur la dernière version du script. Colle le dernier Code_PDP_V2.gs puis Déployer ▸ Gérer ▸ ✏️ ▸ Nouvelle version.');
      extraits.push(j); i++; tentatives = 0;
    } catch (e) {
      if (/413|429|jetons|tokens per minute|TPM/i.test(e.message || '') && tentatives < 2) {
        tentatives++;
        const reste = morceaux.slice(i).join('\n\n');
        morceaux = morceaux.slice(0, i).concat(decouperTexte(reste, 7000));   // morceaux plus petits
        for (let sec = 65; sec > 0; sec--) { if (box) box.innerHTML = '<div class="avert info">⏳ Limite de la clé IA atteinte : reprise dans ' + sec + ' s, en morceaux plus petits…</div>'; await attendre(1000); }
        continue;
      }
      throw e;
    }
  }
  return extraits;
}
/** Fusion des passes d'une reprise de PDP : premier champ non vide, listes concaténées sans doublon. */
function fusionnerReprises(liste) {
  const out = {}; const cle = x => ligneNormale(typeof x === 'string' ? x : JSON.stringify(x));
  const concat = (a, b) => { const vus = new Set((a || []).map(cle)); return (a || []).concat((b || []).filter(x => { const k = cle(x); if (vus.has(k)) return false; vus.add(k); return true; })); };
  liste.forEach(j => {
    const x = j.extrait || {};
    Object.keys(x).forEach(k => {
      const v = x[k];
      if (Array.isArray(v)) out[k] = concat(out[k], v);
      else if (v && typeof v === 'object') {
        if (k === 'coactivite') { out[k] = out[k] || { aucune: true, lignes: [] }; out[k].lignes = concat(out[k].lignes, v.lignes); if (v.aucune === false || out[k].lignes.length) out[k].aucune = false; }
        else { out[k] = out[k] || {}; Object.keys(v).forEach(kk => { if (!out[k][kk] && v[kk]) out[k][kk] = v[kk]; }); }
      } else if (k === 'confiance') { const ordre = { haute: 3, moyenne: 2, faible: 1 }; if (!out[k] || (ordre[v] || 0) < (ordre[out[k]] || 0)) out[k] = v; }
      else if (!out[k] && v) out[k] = v;
    });
  });
  return out;
}

/* --------------------------- mémoire technique ---------------------------- */
async function lireMemoire(inp) {
  const f = inp.files[0]; inp.value = '';
  if (!f) return;
  const box = document.getElementById('ia-memoire');
  const petit = f.size <= 8 * 1024 * 1024, estDocx = /\.docx$/i.test(f.name);
  box.innerHTML = '<div class="avert info">📄 Lecture du document dans le navigateur…</div>';
  try {
    /* V20 : le texte est lu ICI (50 Mo ou plus, aucun problème) ; le fichier ne part à Google
       (≤ 8 Mo) que pour en tirer photos et logos. Un PDF scanné sans texte ≤ 8 Mo passe par la
       reconnaissance de caractères côté serveur, comme avant. */
    let texte = '';
    try { texte = estDocx ? await texteDuDocx(await f.arrayBuffer()) : await textePdfNavigateur(f, 150, (i, n) => { box.innerHTML = '<div class="avert info">📄 Lecture du document dans le navigateur… page ' + i + ' / ' + n + '</div>'; }); }
    catch (e) { texte = ''; }
    const scanne = texte.replace(/\s/g, '').length < 200;
    if (scanne && !petit) { box.innerHTML = '<div class="avert">Ce PDF est une image scannée sans texte et pèse ' + Math.round(f.size / 1048576) + ' Mo : la reconnaissance de caractères est limitée à 8 Mo. Exporte-le à nouveau depuis Word, ou n’envoie que les pages utiles.</div>'; return; }
    let b64 = '';
    if (petit) b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(new Error('Fichier illisible')); r.readAsDataURL(f); });
    box.innerHTML = '<div class="avert info">🤖 ' + (texte.length ? Math.round(texte.length / 1000) + ' k caractères lus — ' : '') + 'l’IA en tire les informations du chantier… (' + (petit ? 'photos et logos compris, ' : '') + 'jusqu’à une minute)</div>';
    const charge = { nom: f.name, catalogues: catalogues() };
    if (!scanne) charge.texte = passagesUtiles(texte, 13000);
    if (petit) charge.contenu = b64;
    const j = await appel('ia-memoire', charge, 180000);
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

/* ----------------------- reprise d'un PDP existant ------------------------
 * V19. Un plan de prévention déjà rédigé (Word ou PDF) sert de base au nouveau :
 * le document est lu, le serveur en tire une transcription structurée, et TOUT
 * est affiché en propositions à cocher. Les opérations et situations retrouvées
 * dans la bibliothèque reprennent la ligne de la trame ; les autres deviennent
 * des lignes sur mesure (fabriquées sur le gabarit de la trame dans le Word).
 * Aucun nom de personne n'est repris : l'annuaire s'en charge.
 * ------------------------------------------------------------------------- */
let repriseExtrait = null;

/** Texte lisible d'un .docx, lu dans le navigateur : un paragraphe par ligne,
 *  les cellules d'une même ligne de tableau séparées par « | ». */
async function texteDuDocx(buf) {
  const entrees = zipLire(buf);
  const e = entrees.find(x => x.nom === 'word/document.xml');
  if (!e) throw new Error('Ce fichier n’est pas un document Word (.docx)');
  const xml = await zipTexte(e);
  return xml
    .replace(/<w:tab\/>/g, '\t').replace(/<w:br\/>/g, '\n')
    .replace(/<\/w:tc>/g, ' | ').replace(/<\/w:tr>/g, '\n').replace(/<\/w:p>/g, '\n')
    .replace(/<w:sym[^>]*w:char="F0FE"[^>]*\/>/g, '☒').replace(/<w:sym[^>]*w:char="F0A8"[^>]*\/>/g, '☐')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/[ \t]+\|/g, ' |').replace(/\n{3,}/g, '\n\n').trim();
}

async function reprendrePdp(inp) {
  const f = inp.files[0]; inp.value = '';
  if (!f || !cur) return;
  const box = document.getElementById('ia-reprise');
  if (!box) return;
  const estDocx = /\.docx$/i.test(f.name), petit = f.size <= 8 * 1024 * 1024;
  box.innerHTML = '<div class="avert info">📥 Lecture du plan de prévention dans le navigateur…</div>';
  try {
    /* V20 : texte lu dans le navigateur (Word ou PDF), débarrassé des lignes de la trame vierge
       (le texte fixe du modèle n'apprend rien), puis envoyé à l'IA en passes sous la limite de Groq. */
    let texte = '';
    try { texte = estDocx ? await texteDuDocx(await f.arrayBuffer()) : await textePdfNavigateur(f, 150, (i, n) => { box.innerHTML = '<div class="avert info">📥 Lecture dans le navigateur… page ' + i + ' / ' + n + '</div>'; }); }
    catch (e) { texte = ''; }
    const brut = texte.length;
    const catal = Object.assign(catalogues(), { frequences: FREQUENCES, roles: ROLES_EXT });
    let extraits;
    if (texte.replace(/\s/g, '').length < 200) {
      if (!petit) throw new Error('Ce PDF est une image scannée sans texte et pèse ' + Math.round(f.size / 1048576) + ' Mo : la reconnaissance de caractères est limitée à 8 Mo.');
      box.innerHTML = '<div class="avert info">📥 PDF scanné : reconnaissance de caractères côté serveur… une à deux minutes.</div>';
      const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(new Error('Fichier illisible')); r.readAsDataURL(f); });
      const j = await appel('ia-pdp', { nom: f.name, contenu: b64, catalogues: catal }, 240000);
      if (!j || typeof j.extrait !== 'object' || !j.extrait) throw new Error('Le serveur a répondu sans le contenu attendu : colle le dernier Code_PDP_V2.gs puis Déployer ▸ Gérer ▸ ✏️ ▸ Nouvelle version.');
      extraits = [j];
    } else {
      texte = await epurerAvecTrame(texte);
      extraits = await appelParPasses('ia-pdp', { nom: f.name, catalogues: catal }, texte, box, 240000);
    }
    repriseExtrait = fusionnerReprises(extraits);
    repriseExtrait._meta = { caracteres: brut, tronque: false, source: estDocx ? 'Word' : 'PDF', nom: f.name, passes: extraits.length };
    renderReprise();
  } catch (e) {
    box.innerHTML = '<div class="avert"><b>Lecture impossible :</b><br>' + esc(e.message) + '</div>';
  }
}

/** Rapproche un libellé d'une liste de référence (égalité ou préfixe, accents
 *  et casse ignorés) ; renvoie l'élément de la liste ou null. Jamais l'inclusion
 *  quelconque : « Déchargement » ne doit pas retrouver « Chargement ». */
function rapprocher(txt, liste, cle) {
  const k = sansAccent(String(txt || '')).toLowerCase().replace(/[☒☐]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!k) return null;
  for (const x of liste) {
    const a = sansAccent(String(cle ? cle(x) : x)).toLowerCase().replace(/\s+/g, ' ').trim();
    if (a === k || (k.length >= 12 && a.indexOf(k) === 0) || (a.length >= 12 && k.indexOf(a) === 0)) return x;
  }
  return null;
}

const CHAMPS_REPRISE = [
  { k: 'titre', l: 'Intitulé du chantier' }, { k: 'lieu', l: 'Lieu de l’intervention' },
  { k: 'departement', l: 'Département' }, { k: 'description', l: 'Description des travaux' },
  { k: 'nature', l: 'Nature des opérations' }, { k: 'frequence', l: 'Fréquence' },
  { k: 'dateDebut', l: 'Date de début' }, { k: 'dateFin', l: 'Date de fin' }, { k: 'duree', l: 'Durée' },
  { k: 'horaires', l: 'Horaires' }
];
function renderReprise() {
  const box = document.getElementById('ia-reprise');
  if (!box) return;
  if (!repriseExtrait) { box.innerHTML = ''; return; }
  const x = repriseExtrait, m = x._meta || {};
  if (!x._choix) {
    const c = x._choix = { champs: {}, moa: !!(x.moa && x.moa.nom), moe: !!(x.moe && x.moe.nom),
      effectifs: !!Object.values(x.effectifs || {}).some(Boolean),
      ext: (x.entreprisesExt || []).map(() => true), hab: (x.habilitations || []).map(() => true),
      ops: (x.operations || []).map(() => true), imp: (x.importes || []).map(() => true),
      coa: (x.coactivite && x.coactivite.lignes || []).map(() => true),
      epi: (x.epi || []).slice(), consignes: (x.consignes || []).slice() };
    CHAMPS_REPRISE.forEach(f => { if (x[f.k]) c.champs[f.k] = true; });
  }
  const c = x._choix;
  const ck = (on, action, html) => `<div class="ck ${on ? 'on' : ''}" onclick="${action};renderReprise()">
     <span class="bx">${on ? '✓' : ''}</span><span class="tx">${html}</span></div>`;
  const tog = expr => `${expr}=!${expr}`;
  const lignesTxt = l => (l.risques || []).length + ' risque(s) · ' + (l.mesures || []).length + ' mesure(s)';
  const conf = { haute: ['ok', 'élevée'], moyenne: ['', 'moyenne'], faible: ['', 'faible'] }[x.confiance] || ['', '?'];
  const nbSit = (x.operations || []).reduce((n, o) => n + (o.lignes || []).length, 0);
  const famillesTrouvees = (x.operations || []).filter(o => rapprocher(o.nom, BIBLIO, f => f.famille)).length;

  box.innerHTML = `<div class="bloc exp"><div class="bh"><span class="pic">📥</span>
     <b>Lu dans le plan de prévention existant<span class="sd">${esc(m.nom || '')} · ${m.source || ''} · ${m.caracteres || 0} caractères · confiance ${esc(conf[1])}</span></b></div>
   <div class="bb">
   <div class="avert ${conf[0]}">Transcription du document, pas une analyse : relis chaque bloc et décoche ce qui ne vaut
   pas pour ce nouveau chantier. Les noms et téléphones ne sont jamais repris, l’annuaire s’en charge.
   ${m.tronque ? '<br><b>Document long : seule la première partie a été lue.</b>' : ''}</div>

   <h3>Chantier</h3>
   ${CHAMPS_REPRISE.map(f => x[f.k] ? ck(c.champs[f.k], tog(`repriseExtrait._choix.champs['${f.k}']`),
      `<span class="muted small">${esc(f.l)}</span><br>${esc(/^date/.test(f.k) ? frDate(x[f.k]) : x[f.k])}`) : '').join('')}
   ${x.moa && x.moa.nom ? ck(c.moa, tog('repriseExtrait._choix.moa'), `<span class="muted small">Maître d’ouvrage</span><br>${esc([x.moa.nom, x.moa.adresse, x.moa.tel].filter(Boolean).join(' — '))}`) : ''}
   ${x.moe && x.moe.nom ? ck(c.moe, tog('repriseExtrait._choix.moe'), `<span class="muted small">Maître d’œuvre</span><br>${esc([x.moe.nom, x.moe.adresse, x.moe.tel].filter(Boolean).join(' — '))}`) : ''}
   ${Object.values(x.effectifs || {}).some(Boolean) ? ck(c.effectifs, tog('repriseExtrait._choix.effectifs'),
      `<span class="muted small">Effectifs</span><br>${esc(['cdes', 'interim', 'fluvial', 'transport'].filter(k => x.effectifs[k]).map(k => ({ cdes: 'CDES', interim: 'intérim', fluvial: 'fluvial', transport: 'transport' })[k] + ' : ' + x.effectifs[k]).join(' · '))}`) : ''}

   ${(x.entreprisesExt || []).length ? '<h3>Entreprises extérieures</h3>' + x.entreprisesExt.map((e, i) => ck(c.ext[i], tog(`repriseExtrait._choix.ext[${i}]`),
      `<b>${esc(e.nom)}</b> <span class="muted small">${esc(e.role || '')}${e.adresse ? ' — ' + esc(e.adresse) : ''}</span>`)).join('') : ''}

   ${(x.habilitations || []).length ? '<h3>Habilitations</h3>' + x.habilitations.map((h, i) => ck(c.hab[i], tog(`repriseExtrait._choix.hab[${i}]`),
      `${h.nombre ? '<b>' + esc(h.nombre) + '</b> · ' : ''}${esc(h.activite)}<br><span class="muted small">${esc(h.habilitations)}</span>`)).join('') : ''}

   ${(x.operations || []).length ? `<h3>Opérations et situations de travail <span class="muted">(${nbSit} situation(s))</span></h3>
     <p class="hint">${famillesTrouvees} opération(s) sur ${x.operations.length} correspondent à une activité de la bibliothèque : elles reprennent les lignes de la trame. Les autres sont créées sur mesure, avec le texte du document.</p>`
     + x.operations.map((o, i) => { const fam = rapprocher(o.nom, BIBLIO, f => f.famille);
       return ck(c.ops[i], tog(`repriseExtrait._choix.ops[${i}]`),
       `<b>${esc(o.nom || 'Opération')}</b> ${fam ? '<span class="badge fini">' + (fam.picto || '') + ' bibliothèque</span>' : '<span class="badge brouillon">sur mesure</span>'}<br>
        <span class="muted small">${(o.lignes || []).map(l => esc(l.danger)).join(' · ') || 'aucune situation'}</span>`); }).join('') : ''}

   ${(x.importes || []).length ? '<h3>Risques importés (site et environnement)</h3>' + x.importes.map((l, i) => ck(c.imp[i], tog(`repriseExtrait._choix.imp[${i}]`),
      `${esc(l.danger)}<br><span class="muted small">${lignesTxt(l)}</span>`)).join('') : ''}

   ${x.coactivite && !x.coactivite.aucune && (x.coactivite.lignes || []).length ? '<h3>Coactivité</h3>' + x.coactivite.lignes.map((l, i) => ck(c.coa[i], tog(`repriseExtrait._choix.coa[${i}]`),
      `${esc(l.danger)}<br><span class="muted small">${lignesTxt(l)}</span>`)).join('') : ''}

   ${(x.epi || []).length ? '<h3>EPI</h3>' + x.epi.map(e => ck(c.epi.includes(e), `bascListe(repriseExtrait._choix.epi,${JSON.stringify(e).replace(/"/g, '&quot;')})`, esc(e))).join('') : ''}
   ${(x.consignes || []).length ? '<h3>Consignes particulières</h3>' + x.consignes.map(t => ck(c.consignes.includes(t), `bascListe(repriseExtrait._choix.consignes,${JSON.stringify(t).replace(/"/g, '&quot;')})`, esc(t))).join('') : ''}

   <div class="row" style="margin-top:12px">
     <button class="btn btn-primary grow" onclick="appliquerReprise()">✓ Reprendre ce que j’ai coché</button>
     <button class="btn btn-ghost" onclick="repriseExtrait=null;renderReprise()">Ignorer</button></div>
   <p class="hint">Ce qui est repris s’ajoute au document en cours sans effacer ce que tu as déjà saisi.</p>
   </div></div>`;
}
function bascListe(l, v) { const i = l.indexOf(v); if (i >= 0) l.splice(i, 1); else l.push(v); }

/** Construit une situation de travail à partir d'une ligne lue, en la
 *  rapprochant si possible d'une ligne de la bibliothèque (famille donnée ou
 *  toutes) : les risques/mesures du catalogue sont cochés quand le document
 *  les cite, les autres restent décochés, et ce que le document ajoute vient
 *  en plus, coché. */
function ligneDepuisReprise(l, famille) {
  const candidates = famille ? famille.lignes : BIBLIO.flatMap(f => f.lignes);
  const ref = rapprocher(l.danger, candidates, x => x.danger);
  const items = (cat, lus) => {
    const out = cat.map(t => ({ txt: t, on: !!rapprocher(t, lus) || !!lus.some(u => rapprocher(u, [t])) }));
    lus.forEach(u => { if (!rapprocher(u, cat)) out.push({ txt: u, on: true }); });
    return out;
  };
  if (ref) return { source: ref.danger, danger: ref.danger, on: true, significatif: false,
    risques: items(ref.risques, l.risques || []), mesures: items(ref.mesures, l.mesures || []) };
  return { danger: l.danger, on: true, significatif: false,
    risques: (l.risques || []).map(t => ({ txt: t, on: true })),
    mesures: (l.mesures || []).map(t => ({ txt: t, on: true })) };
}
function appliquerReprise() {
  if (!repriseExtrait || !cur) return;
  const x = repriseExtrait, c = x._choix, faits = [];
  CHAMPS_REPRISE.forEach(f => {
    if (!c.champs[f.k] || !x[f.k]) return;
    if (f.k === 'departement') { cur.departement = String(x[f.k]).padStart(2, '0'); appliquerCarnet(cur.departement); }
    else if (f.k === 'horaires') cur.horairesTexte = x.horaires;
    else cur[f.k] = x[f.k];
    faits.push(f.l.toLowerCase());
  });
  if (c.moa && x.moa) { cur.moa = { nom: x.moa.nom || '', adresse: x.moa.adresse || '', tel: x.moa.tel || '' }; faits.push('maître d’ouvrage'); }
  if (c.moe && x.moe) { cur.moe = { nom: x.moe.nom || '', adresse: x.moe.adresse || '', tel: x.moe.tel || '' }; faits.push('maître d’œuvre'); }
  if (c.effectifs && x.effectifs) { ['cdes', 'interim', 'fluvial', 'transport'].forEach(k => { if (x.effectifs[k]) cur.effectifs[k] = x.effectifs[k]; }); faits.push('effectifs'); }
  if (!cur.titreCourt && cur.titre) cur.titreCourt = cur.titre;

  let n = 0;
  (x.entreprisesExt || []).forEach((e, i) => {
    if (!c.ext[i] || cur.entreprisesExt.some(y => rapprocher(y.nom, [e.nom]))) return;
    cur.entreprisesExt.push({ role: e.role || ROLES_EXT[0], nom: e.nom, adresse: e.adresse || '', effectif: e.effectif || '' }); n++;
  });
  if (n) faits.push(n + ' entreprise(s)');

  n = 0;
  if (!Array.isArray(cur.habilitations)) cur.habilitations = [];
  (x.habilitations || []).forEach((h, i) => {
    if (!c.hab[i] || cur.habilitations.some(y => rapprocher(y.activite, [h.activite]))) return;
    cur.habilitations.push({ nombre: h.nombre || '', activite: h.activite || '', habilitations: h.habilitations || '' }); n++;
  });
  if (n) faits.push(n + ' habilitation(s)');

  n = 0;
  (x.operations || []).forEach((o, i) => {
    if (!c.ops[i]) return;
    const fam = rapprocher(o.nom, BIBLIO, f => f.famille);
    const lignes = (o.lignes || []).map(l => ligneDepuisReprise(l, fam));
    if (fam) {
      const k = cur.risques.exportes.findIndex(op => op.source === fam.famille && !op.lignes.length);
      const op = { source: fam.famille, nom: o.nom || fam.famille, picto: fam.picto, numeroter: fam.famille !== 'Autres risques', lignes: lignes };
      if (k >= 0) cur.risques.exportes[k] = op; else cur.risques.exportes.push(op);
    } else cur.risques.exportes.push({ source: '', nom: o.nom || 'Opération reprise', picto: '📥', numeroter: true, libre: true, lignes: lignes });
    n++;
  });
  if (n) faits.push(n + ' opération(s)');

  n = 0;
  (x.importes || []).forEach((l, i) => {
    if (!c.imp[i]) return;
    const ref = rapprocher(l.danger, RISQUES_ENV, r => r.danger);
    if (ref && cur.risques.importes.some(y => y.source === ref.danger)) return;
    const ligne = ligneDepuisReprise(l, { lignes: RISQUES_ENV });
    cur.risques.importes.push(ligne); n++;
  });
  if (n) faits.push(n + ' risque(s) importé(s)');

  n = 0;
  if (x.coactivite && !x.coactivite.aucune) (x.coactivite.lignes || []).forEach((l, i) => {
    if (!c.coa[i]) return;
    cur.risques.coactivite.aucune = false;
    cur.risques.coactivite.lignes.push({ danger: l.danger, on: true, significatif: false,
      risques: (l.risques || []).map(t => ({ txt: t, on: true })), mesures: (l.mesures || []).map(t => ({ txt: t, on: true })) }); n++;
  });
  if (n) faits.push(n + ' interférence(s)');

  if (c.epi.length) { EPI.forEach((e, i) => { if (c.epi.includes(e.nom)) cur.epi[i].on = true; }); faits.push(c.epi.length + ' EPI'); }
  n = 0;
  c.consignes.forEach(t => { if (!cur.consignes.particulieres.some(k => rapprocher(k.t, [t]))) { cur.consignes.particulieres.push({ t: t, on: true }); n++; } });
  if (n) faits.push(n + ' consigne(s)');

  repriseExtrait = null;
  majDoc(); renderEtapes();
  toast(faits.length ? 'Repris : ' + faits.join(', ') + ' ✓' : 'Rien de coché', !faits.length);
}
