/* ============================================================================
   Plans de prévention CDES — logique de l'application
   ========================================================================= */
const APP_VERSION='V22.1', APP_DATE='21 octobre 2026';   // V22.1 = photos et logos lus dans le navigateur ; V22 = mémoire technique lu en entier sur 3 voies (script V2.4) : phasage, risques du site, moyens, horaires, coactivité, EPI, consignes, organismes de prévention, photos et logos ; V21 = reprise d’un PDP en 3 voies parallèles (script V2.3), texte allégé (cases non cochées, lignes répétées), attente calculée ; message clair si le script n’est pas à jour pour le mémoire technique ; V20 = lecture des documents dans le navigateur (toute taille), IA en passes sous la limite Groq ; V19 = reprise d'un PDP existant, tâches sur mesure, habilitations
const LS='pdp_app_v2';

let state={docs:[],carnet:null,agences:null};
let cur=null, etapeIdx=0;
const todayISO=new Date().toISOString().slice(0,10);
/* Le parcours n'est plus le même selon le document : un protocole de sécurité
   n'a ni inspection commune, ni organismes de prévention ; un PPSPS a en plus
   la coordination SPS, que le plan de prévention ignore. */
function etapes(){return ETAPES_PAR_TYPE[(cur&&cur.type)||'pdp']||ETAPES_PAR_TYPE.pdp}
function estProtocole(){return !!(cur&&estTypeProtocole(cur.type))}

/* ------------------------------- outils ---------------------------------- */
function uid(){return 'd'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function jsq(s){return String(s==null?'':s).replace(/\\/g,'\\\\').replace(/'/g,"\\'")}
function toast(m,e){const t=document.getElementById('toast');t.textContent=m;t.className=(e?'err ':'')+'show';clearTimeout(t._t);t._t=setTimeout(()=>t.className='',3000)}
function save(){try{localStorage.setItem(LS,JSON.stringify(state))}catch(e){toast('Mémoire pleine',true)}}
function load(){try{const r=localStorage.getItem(LS);if(r){const s=JSON.parse(r);if(s&&Array.isArray(s.docs))state=Object.assign(state,s)}}catch(e){}}
function frDate(iso){if(!iso)return '';const d=new Date(iso+'T00:00');return isNaN(d)?iso:d.toLocaleDateString('fr-FR')}
function go(v){document.querySelectorAll('.view').forEach(s=>s.classList.remove('active'));document.getElementById(v).classList.add('active');
  document.querySelectorAll('nav.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
  document.querySelector('.barre').style.display=(v==='v-edit')?'flex':'none';
  if(v==='v-docs')renderDocs(); if(v==='v-biblio')renderBiblio(); if(v==='v-reglages')renderReglages();
  window.scrollTo(0,0)}
function fermerModal(){document.querySelectorAll('.modal').forEach(m=>m.classList.remove('open'))}

/* -------------------------- modèle de document ---------------------------- */
/* Bloc propre au protocole de sécurité : CDES y est l'entreprise UTILISATRICE,
   le transporteur est l'entreprise intervenante. Rôles inversés par rapport au
   plan de prévention — c'est la différence structurante du document. */
function protVierge(type){
  if(type==='marinier')return protMarinierVierge();
  return {lieu:PROT_LIEUX[0],adresseChantier:'',
    transporteurType:PROT_TRANSPORTEUR[0],
    transporteur:{nom:'',adresse:'',tel:'',responsable:''},
    mode:PROT_MODES[0],operation:PROT_OPERATIONS[1],
    nature:'',natureDetail:'',frequence:PROT_FREQUENCES[0],
    engins:[],enginsAutre:'',logistique:[],logistiqueAutre:'',
    manutention:[],manutentionAutre:'',conditionnement:[],
    modeOperatoire:PROT_MODE_OPERATOIRE_DEFAUT,
    habilitations:PROT_HABILITATIONS.map(h=>({activite:h.activite,habilitations:h.habilitations,on:false})),
    risques:PROT_RISQUES.map(o=>({operation:o.operation,on:true,
      risques:o.risques.map(r=>({txt:r.t,on:r.on})),mesures:o.mesures.map(m=>({txt:m.t,on:m.on}))})),
    epi:PROT_EPI_LIGNES.map(()=>PROT_EPI_DEFAUT.slice()),
    consignes:PROT_CONSIGNES.map(t=>({t,on:true})),
    secours:JSON.parse(JSON.stringify(PROT_SECOURS)),
    pretMateriel:PROT_PRET_MATERIEL,
    diffusion:JSON.parse(JSON.stringify(PROT_DIFFUSION))};
}
/* Protocole mariniers : les valeurs cochées de la trame « mariniers » — bateau,
   cale, pelle, vrac, sédiments, opérations répétitives, chargement et
   déchargement — et ses sept opérations. */
function protMarinierVierge(){
  return {lieu:PROT_LIEUX_MARINIER[0],adresseChantier:'',
    transporteurType:PROT_TRANSPORTEUR[0],
    transporteur:{nom:'',adresse:'',tel:'',responsable:''},
    mode:PROT_MODES[1],operation:PROT_OPERATIONS[2],
    nature:PROT_NATURES_MARINIER[0],natureDetail:'',frequence:PROT_FREQUENCES[1],
    engins:['Bateau','Grue mobile'],enginsAutre:'',logistique:['Cale, caisson, fourgon'],logistiqueAutre:'',
    manutention:['Pelle mécanique / engins TP'],manutentionAutre:'',conditionnement:['Vrac'],
    modeOperatoire:PROT_MODE_OPERATOIRE_MARINIER,
    habilitations:PROT_HABILITATIONS.map(h=>({activite:h.activite,habilitations:h.habilitations,on:/bateau/i.test(h.activite)})),
    risques:PROT_RISQUES_MARINIER.map(o=>({operation:o.operation,ancre:o.ancre,on:o.actif,
      risques:o.risques.map(r=>({txt:r.t,on:r.on})),mesures:o.mesures.map(m=>({txt:m.t,on:m.on}))})),
    epi:PROT_EPI_LIGNES.map(()=>PROT_EPI_DEFAUT_MARINIER.slice()),
    consignes:PROT_CONSIGNES.map(t=>({t,on:true})),
    secours:JSON.parse(JSON.stringify(PROT_SECOURS)),
    pretMateriel:PROT_PRET_MATERIEL,
    diffusion:JSON.parse(JSON.stringify(PROT_DIFFUSION))};
}
function spsVierge(){
  return {coordonnateur:'',coordonnateurTel:'',coordonnateurAdresse:'',
    categorie:PPSPS_CATEGORIES[1],pgc:'',dateTransmission:'',
    effectifPointe:'',dureePrevisionnelle:'',registre:'',
    diffusion:JSON.parse(JSON.stringify(PPSPS_DIFFUSION))};
}
function docVierge(type){
  const ag=AGENCES[0];
  const sig={};
  signatairesDe(type).forEach(k=>sig[k]={nom:'',date:''});
  return {id:uid(),type:type,cree:new Date().toISOString(),maj:new Date().toISOString(),statut:'brouillon',
    titre:'',titreCourt:'',description:'',
    agence:ag.code,
    historique:{redacteur:'',dateRedaction:todayISO,version:'0',
      motif:'Émission initiale',verifiePar:VERIFICATEUR,validePar:''},
    moa:{nom:'',adresse:'',tel:''}, moe:{nom:'',adresse:'',tel:''},
    lieu:'',departement:'',travauxDangereux:[],
    travauxChoix:TRAVAUX_DANGEREUX.map(t=>({t:t.t,on:!!t.defaut})),nature:'',frequence:'',
    dateDebut:'',dateFin:'',duree:'',
    organismes:{},
    encadrement:{respCdes:'',respCdesTel:'',respTravaux:'',respTravauxTel:''},
    effectifs:{cdes:'',interim:'',fluvial:'',transport:''},
    entreprisesExt:[],
    horairesTexte:HORAIRES_TEXTE_DEFAUT,
    moyens:JSON.parse(JSON.stringify(MOYENS_DEFAUT)),
    logistique:JSON.parse(JSON.stringify(LOGISTIQUE_DEFAUT)),
    inspection:{date:'',repEU:'',repEE:'',installations:[],points:INSPECTION_POINTS.map(p=>({t:p,etat:'',obs:''})),observations:''},
    habilitations:[],visiteMedicale:VISITE_MEDICALE_DEFAUT,
    risques:{exportes:[],importes:[],coactivite:{aucune:true,motif:'Pas de coactivité durant le chantier.',lignes:[]}},
    epi:EPI.map(e=>({on:e.defaut,note:e.note||''})),
    consignes:{generales:CONSIGNES_GENERALES.map(t=>({t,on:true})),particulieres:CONSIGNES_PARTICULIERES.map(t=>({t,on:true}))},
    urgence:{conducteur:'',responsable:'',hse:HSE_DEFAUT,gps:'',specificites:'',
      condManuel:false,respManuel:false},
    diffusion:JSON.parse(JSON.stringify(PDP_DIFFUSION)),
    sps:spsVierge(),
    prot:protVierge(type),
    annexes:[],
    photos:[],
    logos:{},
    logos:{},
    signataires:sig};
}
function nouveauDoc(){
  document.getElementById('gen-body').innerHTML=`<div class="grab"></div><h2>Quel document veux-tu établir ?</h2>
   <p class="small muted">Le type détermine la trame utilisée, le titre et les articles cités.</p>
   <div style="margin-top:12px">`+
   TYPES.map(t=>`<div class="ck" onclick="creer('${t.code}')"><span class="bx">›</span><span class="tx">
     <b>${esc(t.nom)}</b><br><span class="muted small">${esc(t.quand)}<br>Articles ${esc(t.articles)}</span></span></div>`).join('')
   +`</div>`;
  document.getElementById('m-gen').classList.add('open');
}
function creer(type){fermerModal();const d=docVierge(type);state.docs.unshift(d);save();ouvrirDoc(d.id)}
function ouvrirDoc(id){cur=state.docs.find(d=>d.id===id&&!d.supprime);if(!cur)return;migrer(cur);appliquerAgence();majUrgence();etapeIdx=0;go('v-edit');renderEtapes()}
function migrer(d){ // tolérance aux documents créés avec une version antérieure
  const v=docVierge(d.type);
  Object.keys(v).forEach(k=>{if(d[k]===undefined)d[k]=v[k]});
  if(!d.risques||!d.risques.exportes)d.risques=v.risques;
  if(!d.prot||!d.prot.risques)d.prot=protVierge();
  if(!d.sps||!d.sps.diffusion)d.sps=spsVierge();
  if(!Array.isArray(d.annexes))d.annexes=[];
  ajusterSignataires(d);
  delete d.emargement;            // la feuille d'émargement reste vierge
}
/* Les parties signataires ne sont pas les mêmes : un protocole se signe à trois
   (utilisatrice, transport, sous-traitant), un plan de prévention à deux. */
function ajusterSignataires(d){
  const attendus=signatairesDe(d.type);
  const anc=d.signataires||{};
  const neuf={};
  attendus.forEach(k=>neuf[k]=anc[k]||{nom:'',date:''});
  d.signataires=neuf;
}
/* Une suppression n'efface pas la ligne : elle la remplace par une pierre
   tombale (id + horodatage + supprime). C'est elle qui voyage jusqu'au serveur
   et jusqu'aux autres appareils — sans ça, le document reviendrait à la
   synchronisation suivante. */
function supprimerDoc(id,ev){
  if(ev){ev.stopPropagation();ev.preventDefault()}
  const i=state.docs.findIndex(x=>x.id===id);if(i<0)return;
  const d=state.docs[i];
  if(!confirm('Supprimer définitivement « '+(d.titre||'sans titre')+' » ?\n\nCette action est irréversible.'))return;
  (d.annexes||[]).forEach(a=>annexeDel(a.id).catch(()=>{}));
  state.docs[i]={id:id,maj:new Date().toISOString(),supprime:true};
  if(cur&&cur.id===id){cur=null;go('v-docs')}
  save();renderDocs();toast('Document supprimé');
  if(typeof syncAuto==='function')syncAuto();
}
/** Les documents réellement affichables : les pierres tombales restent cachées. */
function docsVisibles(){return state.docs.filter(d=>d&&!d.supprime)}
function supprimerDocCourant(){if(cur)supprimerDoc(cur.id)}
function fermerDoc(){cur=null;go('v-docs')}
function majDoc(){if(cur){cur.maj=new Date().toISOString();save()}}
function agenceDe(){return AGENCES.find(a=>a.code===(cur&&cur.agence))||AGENCES[0]}
/* Listes de personnes selon le rôle, agence du chantier en tête. */
function personnes(role){
  const ag=cur&&cur.agence;
  const dansAgence=p=>(p.agences||[]).includes(ag);
  return PERSONNES.filter(p=>role==='valide'?p.valide:(role==='redige'?p.redige:true))
    .slice().sort((a,b)=>(dansAgence(a)?0:1)-(dansAgence(b)?0:1)||a.nom.localeCompare(b.nom,'fr'))
    .map(p=>({v:p.nom,l:p.nom+' — '+p.fonction+(dansAgence(p)?'':' · '+(p.agences||[]).join('/'))}));
}
function personneDe(nom){return PERSONNES.find(x=>x.nom===nom)||null}

function renderDocs(){
  const box=document.getElementById('docs-list');
  const visibles=docsVisibles();
  if(!visibles.length){box.innerHTML='<div class="empty"><div class="big">📁</div>Aucun document.<br>Touche « ＋ Nouveau document ».</div>';return}
  box.innerHTML=visibles.map(d=>{const t=TYPES.find(x=>x.code===d.type)||TYPES[0];
    const n=estTypeProtocole(d.type)?((d.prot&&d.prot.risques||[]).filter(r=>r.on).length+' opération(s) de transport')
      :((d.risques&&d.risques.exportes?d.risques.exportes.length:0)+' opération(s)');
    const na=(d.annexes||[]).length;
    return `<div class="doc" onclick="ouvrirDoc('${d.id}')">
      <div class="ty"><b>${esc(t.court)}</b><span>${esc(d.agence||'')}</span></div>
      <div class="i"><div class="t">${esc(d.titre||'(sans titre)')}</div>
      <div class="s">${esc(d.lieu||'—')}${d.dateDebut?' · '+frDate(d.dateDebut):''} · ${esc(n)}${na?' · '+na+' annexe(s)':''}</div></div>
      <span class="badge ${d.statut}">${d.statut==='fini'?'terminé':'brouillon'}</span>
      <button class="btn btn-danger btn-xs" title="Supprimer ce document"
        onclick="supprimerDoc('${d.id}',event)">🗑</button></div>`}).join('');
}

/* ------------------------------- assistant -------------------------------- */
function renderEtapes(){
  const E=etapes();
  if(etapeIdx>=E.length)etapeIdx=E.length-1;
  document.getElementById('etapes').innerHTML=E.map((e,i)=>
    `<div class="etape ${i===etapeIdx?'on':''} ${etapeFaite(e)?'ok':''}" onclick="allerEtape(${i})">
      <span class="n">${etapeFaite(e)&&i!==etapeIdx?'✓':(i+1)}</span>${esc(e)}</div>`).join('');
  document.getElementById('b-prec').disabled=etapeIdx===0;
  document.getElementById('b-suiv').disabled=etapeIdx===E.length-1;
  renderEtape();
}
function etapeFaite(nom){
  if(!cur)return false;
  switch(nom){
    case 'Chantier':return !!(cur.titre&&cur.lieu&&cur.dateDebut&&cur.historique.redacteur);
    case 'Organismes':return !!(cur.organismes&&cur.organismes.carsat);
    case 'Coordination SPS':return !!(cur.sps&&cur.sps.coordonnateur);
    case 'Organisation':return !!(cur.encadrement.respTravaux);
    case 'Inspection commune':return !!cur.inspection.date;
    case 'Risques':return (cur.risques.exportes||[]).length>0;
    case 'EPI & consignes':return estProtocole()?cur.prot.epi[ligneEpiProtocole()].some(Boolean):cur.epi.some(e=>e.on);
    case 'Secours & signatures':return !!cur.urgence.conducteur;
    case 'Annexes':return (cur.annexes||[]).length>0;
    case 'Transport':return !!(cur.titre&&cur.prot.transporteur.nom);
    case 'Moyens & mode opératoire':return (cur.prot.engins||[]).length>0;
    case 'Risques transport':return cur.prot.risques.some(r=>r.on);
  }
  return false;
}
function allerEtape(i){const E=etapes();if(i<0||i>=E.length)return;etapeIdx=i;renderEtapes();window.scrollTo(0,0)}
function lire(ch){return ch.split('.').reduce((o,k)=>(o||{})[k],cur)}
function ecrire(ch,val){
  const ks=ch.split('.');const last=ks.pop();let o=cur;ks.forEach(k=>{if(!o[k])o[k]={};o=o[k]});
  o[last]=val;majDoc();
  if(ch==='titre'&&!cur.titreCourt){cur.titreCourt=val;const el=document.getElementById('ch_titreCourt');if(el)el.value=val}
  if(ch==='departement')appliquerCarnet(val);
  if(ch==='agence'){appliquerAgence();majUrgence();renderEtape()}
  if(ch==='type'){ajusterSignataires(cur);etapeIdx=0;renderEtapes()}
  if(ch==='urgence.conducteur')cur.urgence.condManuel=true;
  if(ch==='urgence.responsable')cur.urgence.respManuel=true;
}
/* --------- contacts d'urgence : renseignés seuls, mais surchargeables ------
   Le conducteur de travaux est celui déclaré à l'encadrement, le responsable
   CDES est le chef de l'agence retenue. Dès que le conducteur écrit dans l'un des
   deux champs, on cesse de l'écraser. */
function urgenceAuto(){
  const e=(cur&&cur.encadrement)||{}, ag=agenceDe();
  const av=(n,t)=>n?(n+(t?' — '+t:'')):'';
  return {conducteur:av(e.respTravaux,e.respTravauxTel),
          responsable:av(ag.responsable,(personneDe(ag.responsable)||{}).tel||ag.responsableTel)};
}
function majUrgence(){
  if(!cur)return;
  if(!cur.urgence)cur.urgence={};
  const a=urgenceAuto();
  if(!cur.urgence.condManuel&&a.conducteur)cur.urgence.conducteur=a.conducteur;
  if(!cur.urgence.respManuel&&a.responsable)cur.urgence.responsable=a.responsable;
}
/* ---------------------------- point GPS ------------------------------------
   Trois façons d'obtenir le point, de la plus rapide à la plus manuelle :
   la position de l'appareil, l'adresse du chantier géocodée, ou un lien Maps
   collé depuis le téléphone. Le point sert ensuite au lien Maps et au QR code
   de l'affichage de chantier. */
function lienMaps(lat,lon){
  return 'https://www.google.com/maps/search/?api=1&query='+Number(lat).toFixed(6)+','+Number(lon).toFixed(6);
}
/** Reconnaît des coordonnées ou un lien Maps collé (Google, Apple, OSM, geo:). */
function lireCoord(t){
  t=String(t||'').trim();
  if(!t)return null;
  let m;
  const ok=(la,lo)=>{la=parseFloat(la);lo=parseFloat(lo);
    return (isFinite(la)&&isFinite(lo)&&Math.abs(la)<=90&&Math.abs(lo)<=180)?{lat:la,lon:lo}:null};
  if((m=t.match(/[?&](?:q|query|ll|daddr|sll)=(-?\d+[.,]?\d*)\s*,\s*(-?\d+[.,]?\d*)/i)))
    return ok(m[1].replace(',','.'),m[2].replace(',','.'));
  if((m=t.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)))return ok(m[1],m[2]);
  if((m=t.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)))return ok(m[1],m[2]);
  if((m=t.match(/#map=\d+\/(-?\d+\.\d+)\/(-?\d+\.\d+)/)))return ok(m[1],m[2]);
  if((m=t.match(/geo:(-?\d+\.\d+),(-?\d+\.\d+)/i)))return ok(m[1],m[2]);
  // deux nombres décimaux séparés, sans autre chiffre parasite
  if((m=t.match(/^\s*(-?\d{1,3}(?:[.,]\d+)?)\s*[,; ]\s*(-?\d{1,3}(?:[.,]\d+)?)\s*$/)))
    return ok(m[1].replace(',','.'),m[2].replace(',','.'));
  return null;
}
function poserPoint(lat,lon,source){
  cur.urgence.lat=Math.round(lat*1e6)/1e6;
  cur.urgence.lon=Math.round(lon*1e6)/1e6;
  majDoc();renderEtape();
  if(source)toast(source+' ✓');
  adresseDuPoint();
}
function effacerPoint(){delete cur.urgence.lat;delete cur.urgence.lon;cur.urgence.adresseGps='';majDoc();renderEtape()}
function collerPoint(v){
  const c=lireCoord(v);
  if(!c){toast('Coordonnées ou lien non reconnus',true);return}
  poserPoint(c.lat,c.lon,'Point repris');
}
function maPosition(){
  if(!navigator.geolocation){toast('Localisation indisponible sur cet appareil',true);return}
  toast('Localisation en cours…');
  navigator.geolocation.getCurrentPosition(
    p=>poserPoint(p.coords.latitude,p.coords.longitude,
      'Position relevée (±'+Math.round(p.coords.accuracy)+' m)'),
    err=>toast(err.code===1?'Localisation refusée : autorise-la dans les réglages du navigateur'
      :'Position introuvable — saisis les coordonnées à la main',true),
    {enableHighAccuracy:true,timeout:15000,maximumAge:0});
}
/** Géocode l'adresse du chantier avec la Base Adresse Nationale (gratuite). */
async function pointDepuisAdresse(){
  const q=(cur.lieu||'').replace(/—.*$/,'').trim();
  if(!q){toast('Renseigne d’abord le lieu de l’intervention',true);return}
  toast('Recherche de l’adresse…');
  try{
    const r=await fetch('https://api-adresse.data.gouv.fr/search/?limit=1&q='+encodeURIComponent(q));
    const j=await r.json();
    const f=(j.features||[])[0];
    if(!f){toast('Adresse introuvable — utilise « Ma position » ou colle un lien',true);return}
    const [lon,lat]=f.geometry.coordinates;
    cur.urgence.adresseGps=(f.properties&&f.properties.label)||'';
    poserPoint(lat,lon,'Point placé sur « '+(f.properties.label||q)+' »');
  }catch(e){toast('Service d’adresses injoignable',true)}
}
/** Adresse la plus proche du point, pour vérifier qu'on ne s'est pas trompé. */
async function adresseDuPoint(){
  if(cur.urgence.lat==null)return;
  try{
    const r=await fetch('https://api-adresse.data.gouv.fr/reverse/?lon='+cur.urgence.lon+'&lat='+cur.urgence.lat);
    const j=await r.json();
    const f=(j.features||[])[0];
    cur.urgence.adresseGps=(f&&f.properties&&f.properties.label)||'';
    majDoc();
    const el=document.getElementById('gps-adresse');
    if(el)el.innerHTML=cur.urgence.adresseGps
      ?'📍 Adresse la plus proche : <b>'+esc(cur.urgence.adresseGps)+'</b>':'';
  }catch(e){}
}
function blocGPS(){
  const u=cur.urgence||{};
  const pose=(u.lat!=null&&u.lon!=null);
  const lien=pose?lienMaps(u.lat,u.lon):'';
  return `<div class="card"><h2><span class="ico">🗺️</span>Point GPS pour les secours</h2>
   <p class="small muted">Le point sert au lien Maps et au <b>QR code de l’affichage de chantier</b> :
   les secours scannent et sont guidés jusqu’au point de rendez-vous.</p>
   <div class="row">
     <button class="btn btn-accent btn-sm grow" onclick="maPosition()">📍 Ma position</button>
     <button class="btn btn-ghost btn-sm grow" onclick="pointDepuisAdresse()">🏗️ Depuis le lieu du chantier</button>
   </div>
   <div class="ch" style="margin-top:10px">
     <label class="f" for="gps-coller">Ou colle un lien Maps / des coordonnées</label>
     <input type="text" id="gps-coller" placeholder="48.5301, 2.5644 — ou un lien Google Maps"
       onchange="collerPoint(this.value)">
     <p class="aide">Depuis le téléphone : appui long sur la carte → Partager → coller ici.</p>
   </div>
   ${pose?`<div class="fiche">
     <div class="fl raison">✅ <span>Point enregistré</span></div>
     <div class="fl">🧭 <span><b>${Number(u.lat).toFixed(6)}, ${Number(u.lon).toFixed(6)}</b></span></div>
     <div class="fl" id="gps-adresse">${u.adresseGps?'📍 Adresse la plus proche : <b>'+esc(u.adresseGps)+'</b>':''}</div>
     <div class="row" style="margin-top:8px">
       <a class="btn btn-ghost btn-sm grow" href="${esc(lien)}" target="_blank" rel="noopener">🗺️ Ouvrir dans Maps</a>
       <button class="btn btn-danger btn-sm" onclick="effacerPoint()">Effacer</button></div>
     </div>`
    :`<div class="avert">Aucun point enregistré. L’affichage de chantier sortira sans QR code.</div>`}
   ${champ('urgence.gps','Repère et accès pour les secours',{ph:'Ex. accès par le chemin de halage rive gauche, portail PK 92,2'})}
   </div>`;
}
function libererUrgence(k){
  cur.urgence[k==='conducteur'?'condManuel':'respManuel']=false;majUrgence();majDoc();renderEtape();
  toast('Repris de l’annuaire ✓');
}
/* Un champ = UN bloc. Sans l'enveloppe, la grille séparait le libellé de sa
   case dans deux colonnes différentes — c'était le décalage visible à l'écran. */
function champ(ch,label,o){
  o=o||{};const v=lire(ch);const id='ch_'+ch.replace(/[^\w]/g,'_');
  const req=/\*$/.test(label);
  const lab=`<label class="f" for="${id}">${esc(label.replace(/\s*\*$/,''))}${req?'<i class="req">obligatoire</i>':''}</label>`;
  const attrs=(o.ro?' readonly':'')+(o.ph?' placeholder="'+esc(o.ph)+'"':'');
  let corps;
  if(o.zone) corps=`<textarea id="${id}"${attrs} oninput="ecrire('${ch}',this.value)">${esc(v||'')}</textarea>`;
  else if(o.liste) corps=`<div class="selwrap"><select id="${id}" onchange="ecrire('${ch}',this.value)">`+
    (o.vide?'<option value="">'+esc(o.vide)+'</option>':'')+
    o.liste.map(x=>{const val=(typeof x==='string')?x:x.v;const l2=(typeof x==='string')?x:x.l;
      return '<option value="'+esc(val)+'"'+(String(v)===String(val)?' selected':'')+'>'+esc(l2)+'</option>'}).join('')+'</select></div>';
  else corps=`<input type="${o.type||'text'}" id="${id}" value="${esc(v||'')}"${attrs} oninput="ecrire('${ch}',this.value)">`;
  return `<div class="ch${o.ro?' ro':''}">${lab}${corps}${o.aide?'<p class="aide">'+esc(o.aide)+'</p>':''}</div>`;
}
const VUES={'Chantier':()=>etChantier(),'Organismes':()=>etOrganismes(),
 'Coordination SPS':()=>etSps(),'Organisation':()=>etOrganisation(),
 'Inspection commune':()=>etInspection(),'Risques':()=>etRisques(),
 'EPI & consignes':()=>estProtocole()?etProtEpi():etEpi(),
 'Secours & signatures':()=>etSecours(),'Annexes':()=>etAnnexes(),
 'Transport':()=>etProtTransport(),'Moyens & mode opératoire':()=>etProtMoyens(),
 'Risques transport':()=>etProtRisques()};
function renderEtape(){
  const nom=etapes()[etapeIdx];
  document.getElementById('etape-body').innerHTML=(VUES[nom]||(()=>''))();
  if(nom==='Risques')renderRisques();
  if(nom==='Annexes')renderAnnexes();
  if(nom==='Chantier')renderPhotos();
}

/* ============================ 1. CHANTIER ================================= */
function etChantier(){
  const t=TYPES.find(x=>x.code===cur.type)||TYPES[0];
  const ag=agenceDe();
  return `<div class="card"><h2><span class="ico">📄</span>Nature du document</h2>
   <div class="avert info"><b>${esc(t.nom)}</b> — ${esc(t.quand)}<br>Établi en application des articles <b>${esc(t.articles)}</b> du Code du travail.</div>
   ${cur.type==='ppsps'
     ?`<div class="avert">Ce qu’un PPSPS a et qu’un plan de prévention n’a pas : un <b>coordonnateur SPS</b>,
       un <b>PGC</b> à prendre en compte, une <b>catégorie d’opération</b> et une date de transmission.
       Une étape « Coordination SPS » a été ajoutée à ton parcours.</div>`
     :`<div class="avert">Ce qui distingue le plan de prévention : il repose sur l’<b>inspection commune
       préalable</b> et se tient à disposition de l’inspection du travail et de la CARSAT. Pas de
       coordonnateur SPS, pas de PGC.</div>`}
   ${champ('type','Changer de type',{liste:TYPES.map(x=>({v:x.code,l:x.nom}))})}
   </div>

   ${blocIA()}

   ${blocPhotos()}

   <div class="card"><h2><span class="ico">🏗️</span>Le chantier</h2>
   ${champ('titre','Intitulé du chantier *',{ph:'Ex. Bathymétrie — Chantier PRA Chaponval'})}
   ${champ('titreCourt','Intitulé court (repris en en-tête de chaque page)',{ph:'Repris automatiquement du titre'})}
   ${champ('description','Description des travaux *',{zone:true,ph:'Ce que CDES va réaliser, avec quels moyens'})}
   <div class="g2">${champ('lieu','Lieu de l’intervention *',{ph:'Commune, voie d’eau, PK…'})}
   ${champ('departement','Département *',{liste:DEPARTEMENTS.map(d=>({v:d.n,l:d.n+' — '+d.nom})),vide:'— choisir —'})}</div>
   <div class="g2">${champ('nature','Nature des opérations',{liste:NATURES,vide:'— choisir —'})}
   ${champ('frequence','Fréquence',{liste:FREQUENCES,vide:'— choisir —'})}</div>
   <div class="g3">${champ('dateDebut','Date de début *',{type:'date'})}${champ('dateFin','Date de fin',{type:'date'})}
   ${champ('duree','Durée',{ph:'Ex. 3 jours'})}</div>
   <label class="f">Travaux dangereux — arrêté du 19 mars 1993</label>
   <div>${renderTravauxDangereux()}</div>
   <p class="hint">Liste réduite aux travaux qui concernent réellement les chantiers CDES
   (revue du 27/08/2026). La noyade est cochée d’office ; coche la chute de plus de 3 mètres
   ou le bruit selon le chantier. C’est cette liste qui rend l’écrit obligatoire dès la
   première heure d’intervention.</p>
   </div>

   <div class="card"><h2><span class="ico">🏢</span>Entreprise intervenante</h2>
   <p class="small muted">Toujours CDES. Choisis l’agence : adresse et téléphone suivent.</p>
   ${champ('agence','Agence',{liste:AGENCES.map(a=>({v:a.code,l:a.nom}))})}
   ${carteAgence(ag)}
   </div>

   <div class="card"><h2><span class="ico">🧾</span>Historique et approbation</h2>
   <p class="small muted">Ce tableau se remplit tout seul en page 2 du document.</p>
   <div class="g2">${champ('historique.redacteur','Rédacteur *',{liste:personnes('redige'),vide:'— choisir —'})}
   ${champ('historique.dateRedaction','Date de rédaction',{type:'date'})}</div>
   <div class="g2">${champ('historique.version','Version',{ro:true})}
   ${champ('historique.motif','Motif de l’édition',{ro:true})}</div>
   <div class="g2">${champ('historique.verifiePar','Vérifié par',{ro:true})}
   ${champ('historique.validePar','Validé par',{liste:personnes('valide'),vide:'— choisir —'})}</div>
   </div>

   <div class="card"><h2><span class="ico">👤</span>Maîtrise d’ouvrage et maîtrise d’œuvre</h2>
   <p class="small muted">Recherche dans le registre officiel des entreprises et administrations.</p>
   <div class="row"><input type="text" id="q-moa" class="grow" placeholder="Ex. Voies navigables de France Meaux">
     <button class="btn btn-ghost btn-sm" onclick="chercherOrganisme('moa')">🔎 Chercher</button></div>
   <div id="res-moa"></div>
   ${champ('moa.nom','Maître d’ouvrage')}${champ('moa.adresse','Adresse',{zone:true})}${champ('moa.tel','Téléphone')}
   <h3>Maîtrise d’œuvre</h3>
   ${champ('moe.nom','Maître d’œuvre')}${champ('moe.adresse','Adresse',{zone:true})}${champ('moe.tel','Téléphone')}
   </div>`;
}
/* L'assistant n'apparaît que si le branchement est en place et la clé IA
   configurée côté serveur : sinon la carte expliquerait un bouton mort. */
/* ---------------------- photos de la page de garde -------------------------
   La page de garde de la trame est presque vide : dans le document d'origine,
   des vues du chantier tirées du mémoire technique occupaient ce blanc. On
   laisse le conducteur y déposer ses images ; elles partent dans le .docx.        */
const PHOTOS_MAX = 4;
function blocPhotos(){
  return `<div class="card"><h2><span class="ico">📷</span>Photos de la page de garde</h2>
   <p class="small muted">Vues du chantier, extraits de plan, images du mémoire technique.
   Jusqu’à ${PHOTOS_MAX} images, deux par ligne. Elles restent sur l’appareil et sont
   insérées dans le Word au moment de la génération.</p>
   <div id="photos-list"></div>
   <div class="row" style="margin-top:10px">
     <button class="btn btn-accent grow" onclick="document.getElementById('photo-file').click()">＋ Ajouter des photos</button>
     <input type="file" id="photo-file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" multiple
       style="display:none" onchange="ajouterPhotos(this)"></div>
   <h3 style="margin-top:16px">Logos des intervenants</h3>
   <p class="small muted">Le logo du <b>maître d’ouvrage</b> se pose en haut à gauche de la page
   de garde et de chaque en-tête, en face du logo CDES — comme sur tes plans de prévention.
   Celui du maître d’œuvre va dans sa colonne du tableau des intervenants. Ils peuvent aussi
   venir de la lecture d’un mémoire technique.</p>
   <div class="row">
     <button class="btn btn-ghost grow" onclick="document.getElementById('logo-moa-file').click()">🏛️ Logo maître d’ouvrage</button>
     <input type="file" id="logo-moa-file" accept="image/png,image/jpeg" style="display:none" onchange="deposerLogo(this,'moa')">
     <button class="btn btn-ghost grow" onclick="document.getElementById('logo-moe-file').click()">📐 Logo maître d’œuvre</button>
     <input type="file" id="logo-moe-file" accept="image/png,image/jpeg" style="display:none" onchange="deposerLogo(this,'moe')">
   </div>
   <div id="logos-etat" class="small muted" style="margin-top:8px"></div>
   </div>`;
}
/* Les logos déposés à la main : même coffre que les photos, mais rangés par
   rôle. Ils l'emportent sur ceux repérés dans un mémoire technique, puisque
   c'est un choix explicite. */
function renderLogosEtat(){
  const el=document.getElementById('logos-etat'); if(!el)return;
  const lg=(cur&&cur.logos)||{};
  const un=(k,nom)=>lg[k]
    ? '✅ '+nom+' ('+lg[k].w+'×'+lg[k].h+') · <a href="#" onclick="retirerLogo(\''+k+'\');return false">retirer</a>'
    : '— '+nom+' : aucun';
  el.innerHTML=un('moa','Maître d’ouvrage')+'<br>'+un('moe','Maître d’œuvre');
}
async function deposerLogo(inp,role){
  const f=inp.files[0];inp.value='';if(!f)return;
  if(!/^image\/(png|jpeg)$/.test(f.type)){toast('PNG ou JPEG uniquement',true);return}
  if(f.size>2*1024*1024){toast('2 Mo au maximum pour un logo',true);return}
  let d;try{d=await tailleImage(f)}catch(e){toast('Image illisible',true);return}
  const id='g'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  try{await annexePut(id,f)}catch(e){toast('Enregistrement impossible : '+e.message,true);return}
  if(!cur.logos)cur.logos={};
  cur.logos[role]={id:id,w:d.w,h:d.h,type:/png$/i.test(f.type)?'png':'jpg'};
  majDoc();renderLogosEtat();toast('Logo enregistré ✓');
}
function retirerLogo(role){
  if(cur.logos&&cur.logos[role]){
    annexeDel(cur.logos[role].id).catch(()=>{});
    delete cur.logos[role];majDoc();renderLogosEtat();
  }
}
function renderPhotos(){
  renderLogosEtat();
  const box=document.getElementById('photos-list'); if(!box)return;
  const l=(cur&&cur.photos)||[];
  if(!l.length){box.innerHTML='<p class="hint">Aucune photo. La page de garde restera telle quelle.</p>';return}
  box.innerHTML='<div class="photogrid">'+l.map((p,i)=>`<figure class="ph" id="ph_${esc(p.id)}">
     <div class="vign">…</div>
     <figcaption>${esc(p.nom)} · ${p.w}×${p.h}
     <button class="btn btn-ghost btn-xs" onclick="deplacerPhoto(${i},-1)">←</button>
     <button class="btn btn-ghost btn-xs" onclick="deplacerPhoto(${i},1)">→</button>
     <button class="btn btn-danger btn-xs" onclick="delPhoto(${i})">✕</button></figcaption></figure>`).join('')+'</div>';
  l.forEach(p=>annexeGet(p.id).then(b=>{
    const el=document.querySelector('#ph_'+p.id+' .vign'); if(!el||!b)return;
    const u=URL.createObjectURL(b);
    el.innerHTML='<img src="'+u+'" alt="">';
    setTimeout(()=>URL.revokeObjectURL(u),120000);
  }).catch(()=>{}));
}
/** Dimensions réelles d'une image, nécessaires pour respecter les proportions. */
function tailleImage(blob){
  return new Promise((res,rej)=>{
    const u=URL.createObjectURL(blob), im=new Image();
    im.onload=()=>{res({w:im.naturalWidth,h:im.naturalHeight});URL.revokeObjectURL(u)};
    im.onerror=()=>{URL.revokeObjectURL(u);rej(new Error('image illisible'))};
    im.src=u;
  });
}
async function ajouterPhotos(inp){
  const fs=Array.from(inp.files||[]); inp.value='';
  if(!fs.length)return;
  if(!cur.photos)cur.photos=[];
  let n=0;
  for(const f of fs){
    if(cur.photos.length>=PHOTOS_MAX){toast(PHOTOS_MAX+' photos au maximum',true);break}
    if(!/^image\/(png|jpeg)$/.test(f.type)&&!/\.(png|jpe?g)$/i.test(f.name)){
      toast('« '+f.name+' » n’est ni un PNG ni un JPEG',true);continue}
    if(f.size>6*1024*1024){toast('« '+f.name+' » dépasse 6 Mo',true);continue}
    let d;try{d=await tailleImage(f)}catch(e){toast('« '+f.name+' » illisible',true);continue}
    const id='p'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
    try{await annexePut(id,f)}catch(e){toast('Enregistrement impossible : '+e.message,true);continue}
    cur.photos.push({id:id,nom:f.name,taille:f.size,w:d.w,h:d.h,
      type:/png$/i.test(f.type||f.name)?'png':'jpg'});
    n++;
  }
  majDoc();renderPhotos();
  if(n)toast(n+' photo(s) ajoutée(s) ✓');
}
function delPhoto(i){
  const p=cur.photos[i];if(!p)return;
  annexeDel(p.id).catch(()=>{});
  cur.photos.splice(i,1);majDoc();renderPhotos();
}
function deplacerPhoto(i,d){
  const j=i+d;if(j<0||j>=cur.photos.length)return;
  const [p]=cur.photos.splice(i,1);cur.photos.splice(j,0,p);majDoc();renderPhotos();
}
/** Prépare les images pour le moteur .docx : relation, dimensions, balise. */
async function dessinsPageDeGarde(entrees,doc){
  const l=(cur.photos||[]).slice(0,PHOTOS_MAX);
  if(!l.length)return [];
  const CM=360000;
  const seul=l.length===1;
  const maxL=(seul?15:7.1)*CM, maxH=(seul?9:5.3)*CM;
  const out=[];
  for(let i=0;i<l.length;i++){
    const p=l[i];
    const blob=await annexeGet(p.id).catch(()=>null);
    if(!blob)continue;
    const u8=new Uint8Array(await blob.arrayBuffer());
    const rid=await ajouterMedia(entrees,u8,p.type);
    const k=Math.min(maxL/(p.w||1),maxH/(p.h||1));
    const cx=Math.max(1,Math.round((p.w||1)*k)), cy=Math.max(1,Math.round((p.h||1)*k));
    out.push({dessin:dessinInline(doc,rid,cx,cy,7000+i,'Photo '+(i+1)),cy:cy});
  }
  return out;
}

/** Pose les logos MOA / MOE (repris du memoire technique) dans les cellules
    de couverture reperees par le moteur. Hauteur ~1,1 cm, centres, au-dessus
    du texte. La colonne Entreprise garde le logo CDES de la trame. */
/* ------------------- logo du maître d'ouvrage, page de garde ----------------
   Modèle : le plan de prévention « Arrachage — Pont sur Sambre ». Le logo du
   maître d'ouvrage se pose en haut à GAUCHE, le logo CDES en haut à droite,
   sur la page de garde et sur chaque en-tête de page. La trame porte le repère
   « LOGO-MOA » dans la cellule de gauche : on l'y remplace par l'image, et on
   efface le repère s'il n'y a pas de logo.                                   */
const WNS='http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function paragrapheRepereLogo(doc){
  return Array.from(doc.getElementsByTagNameNS(WNS,'p')).find(p=>{
    let t='';Array.from(p.getElementsByTagNameNS(WNS,'t')).forEach(x=>t+=x.textContent);
    return t.trim()==='LOGO-MOA';
  })||null;
}
/** Taille d'un logo : hauteur imposée, largeur au prorata, largeur plafonnée. */
function tailleLogo(info,hCm,maxCm){
  const CM=360000, ratio=(info.w||1)/(info.h||1);
  let cy=Math.round(hCm*CM), cx=Math.round(cy*ratio);
  if(cx>maxCm*CM){cx=Math.round(maxCm*CM);cy=Math.round(cx/ratio);}
  return {cx:cx,cy:cy};
}
/** Renvoie 1 si le logo est posé, 0 si la trame l'attend mais qu'il manque,
    -1 si cette trame ne prévoit pas de logo de maître d'ouvrage. */
async function logoCouverture(entrees,doc){
  const p=paragrapheRepereLogo(doc);
  if(!p)return -1;
  const info=(cur&&cur.logos&&cur.logos.moa)||null;
  // le repère disparaît dans tous les cas
  Array.from(p.getElementsByTagNameNS(WNS,'t')).forEach(t=>{t.textContent=''});
  if(!info)return 0;
  const blob=await annexeGet(info.id).catch(()=>null);
  if(!blob)return 0;
  const u8=new Uint8Array(await blob.arrayBuffer());
  const rid=await ajouterMedia(entrees,u8,info.type);
  const d=tailleLogo(info,1.6,5);
  p.appendChild(runImage(doc,dessinInline(doc,rid,d.cx,d.cy,7500,'Logo maître d’ouvrage')));
  return 1;
}

/** Le même logo, dans la cellule de gauche du tableau d'en-tête. La trame
    porte un tableau à trois colonnes — repère, titre, logo CDES : c'est la
    seule disposition que Word et les autres traitements de texte placent de
    la même façon. Deux images ancrées côte à côte finissaient inversées. */
async function logoEntetes(entrees){
  const info=(cur&&cur.logos&&cur.logos.moa)||null;
  let n=0;
  for(const e of entrees.filter(x=>/^word\/header\d+\.xml$/.test(x.nom))){
    const txt=e.nouveauTexte!==undefined?e.nouveauTexte:await zipTexte(e);
    if(txt.indexOf('LOGO-MOA')<0)continue;
    const hd=new DOMParser().parseFromString(txt,'application/xml');
    if(hd.querySelector('parsererror'))continue;
    const p=paragrapheRepereLogo(hd);
    if(!p)continue;
    Array.from(p.getElementsByTagNameNS(WNS,'t')).forEach(t=>{t.textContent=''});
    if(info){
      const blob=await annexeGet(info.id).catch(()=>null);
      if(blob){
        const u8=new Uint8Array(await blob.arrayBuffer());
        const rid=await ajouterMedia(entrees,u8,info.type,e.nom);
        const d=tailleLogo(info,1.3,3.8);
        p.appendChild(runImage(hd,dessinInline(hd,rid,d.cx,d.cy,7900+n,'Logo MOA en-tête')));
        n++;
      }
    }
    e.nouveauTexte=new XMLSerializer().serializeToString(hd);
  }
  return n;
}

async function logosPageDeGarde(entrees,doc){
  const cs=remplirPPSPS.cellulesCouverture;
  const lg=(cur&&cur.logos)||{};
  if(!cs||!cs.length)return 0;
  const CM=360000;
  const roles=[['moa',0],['moe',1]];
  let poses=0;
  for(const paire of roles){
    const role=paire[0], idx=paire[1];
    const info=lg[role]; const cell=cs[idx];
    if(!info||!cell)continue;
    const blob=await annexeGet(info.id).catch(()=>null);
    if(!blob)continue;
    const u8=new Uint8Array(await blob.arrayBuffer());
    const rid=await ajouterMedia(entrees,u8,info.type);
    const h=Math.round(1.1*CM), ratio=(info.w||1)/(info.h||1);
    let cy=h, cx=Math.round(h*ratio);
    if(cx>4.5*CM){cx=Math.round(4.5*CM);cy=Math.round(cx/ratio);}
    const dessin=dessinInline(doc,rid,cx,cy,7600+idx,'Logo '+role.toUpperCase());
    const WNS='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const p=doc.createElementNS(WNS,'w:p');
    const ppr=doc.createElementNS(WNS,'w:pPr');
    const jc=doc.createElementNS(WNS,'w:jc');jc.setAttributeNS(WNS,'w:val','center');
    ppr.appendChild(jc);p.appendChild(ppr);
    p.appendChild(runImage(doc,dessin));
    const premier=cell.getElementsByTagNameNS(WNS,'p')[0];
    if(premier)premier.parentNode.insertBefore(p,premier);else cell.appendChild(p);
    poses++;
  }
  return poses;
}

function blocIA(){
  if(!iaDispo())return `<div class="card"><h2><span class="ico">🤖</span>Assistance IA</h2>
    <p class="small muted">${branche()
      ?'Le serveur est branché mais aucune clé IA n’y est configurée. Ajoute la propriété GROQ_API_KEY au script Google.'
      :'Pas encore branchée. Réglages ▸ Branchement pour l’activer — l’appli marche très bien sans.'}</p></div>`;
  return `<div class="card"><h2><span class="ico">🤖</span>Assistance IA</h2>
   <p class="small muted">Trois façons de démarrer, cumulables : décris le chantier et l’assistant propose la nature des
   opérations, les activités, les risques importés, les EPI et des consignes ; fais lire le <b>mémoire technique</b>
   en entier (chantier, maître d’ouvrage et d’œuvre, phasage, risques du site, moyens, horaires, coactivité, EPI,
   consignes, organismes de prévention, photos, logos) ; ou <b>repars d’un plan de prévention déjà rédigé</b>, Word ou PDF :
   ses opérations, situations de travail, risques, mesures, EPI et consignes te sont proposés. Tu coches ce que tu gardes.</p>
   <div class="row">
     <button class="btn btn-accent grow" onclick="analyserChantier()">✨ Analyser la description</button>
     <button class="btn btn-ghost grow" onclick="document.getElementById('memoire-file').click()">📄 Lire un mémoire technique</button>
     <button class="btn btn-ghost grow" onclick="document.getElementById('reprise-file').click()">📥 Reprendre un PDP existant</button>
     <input type="file" id="memoire-file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style="display:none" onchange="lireMemoire(this)">
     <input type="file" id="reprise-file" accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style="display:none" onchange="reprendrePdp(this)">
   </div>
   <div id="ia-memoire" style="margin-top:10px"></div>
   <div id="ia-reprise" style="margin-top:10px"></div>
   <div id="ia-panneau" style="margin-top:10px"></div>
   </div>`;
}
function carteAgence(ag){
  const manque=!ag.adresse||!ag.tel;
  return `<div class="fiche ${manque?'attention':''}">
    <div class="fl raison">🏢 <span>${esc(ag.raison)}</span></div>
    ${ag.adresse?`<div class="fl">📍 <span>${esc(ag.adresse).replace(/\n/g,'<br>')}</span></div>`:''}
    ${ag.tel?`<div class="fl">☎️ <span>${esc(ag.tel)}</span></div>`:''}
    ${ag.responsable?`<div class="fl">👤 <span><b>${esc(ag.responsable)}</b>${ag.responsableFonction?' — '+esc(ag.responsableFonction):''}${ag.responsableTel?' · '+esc(ag.responsableTel):''}</span></div>`:''}
    ${manque?`<div class="fl manque">⚠️ <span>Adresse ou téléphone à renseigner — voir Réglages</span></div>`:''}
  </div>`;
}
function appliquerAgence(){
  const a=agenceDe();
  if(a.responsable){
    if(!cur.historique.validePar)cur.historique.validePar=a.responsable;
    if(!cur.encadrement.respCdes){
      cur.encadrement.respCdes=a.responsable;
      const p=personneDe(a.responsable);cur.encadrement.respCdesTel=p?p.tel:(a.responsableTel||'');
    }
  }
  majDoc();
}
function renderTravauxDangereux(){
  if(!cur.travauxChoix)cur.travauxChoix=TRAVAUX_DANGEREUX.map(t=>({t:t.t,on:!!t.defaut}));
  return cur.travauxChoix.map((c,i)=>`<div class="ck ${c.on?'on':''}">
    <span class="bx" onclick="bascTravaux(${i})">${c.on?'✓':''}</span>
    <span class="tx">${esc(c.t)}</span></div>`).join('');
}
function bascTravaux(i){cur.travauxChoix[i].on=!cur.travauxChoix[i].on;majDoc();renderEtape()}
function travauxDangereuxDeduits(){
  if(!cur.travauxChoix)cur.travauxChoix=TRAVAUX_DANGEREUX.map(t=>({t:t.t,on:!!t.defaut}));
  return cur.travauxChoix.filter(c=>c.on).map(c=>c.t);
}
async function chercherOrganisme(cible){
  const q=document.getElementById('q-'+cible).value.trim();
  const box=document.getElementById('res-'+cible);
  if(!q){toast('Tape un nom',true);return}
  box.innerHTML='<p class="hint">Recherche dans le registre…</p>';
  try{
    const r=await fetch('https://recherche-entreprises.api.gouv.fr/search?q='+encodeURIComponent(q)+'&per_page=5');
    if(!r.ok)throw new Error('registre indisponible');
    const j=await r.json();
    const res=[];
    (j.results||[]).forEach(e=>{
      (e.matching_etablissements||[]).slice(0,3).forEach(et=>res.push({
        nom:(e.nom_complet||'')+(et.nom_commercial?' — '+et.nom_commercial:''),
        adresse:et.adresse||'',siret:et.siret||''}));
      if(!(e.matching_etablissements||[]).length&&e.siege)
        res.push({nom:e.nom_complet||'',adresse:(e.siege.adresse||''),siret:e.siege.siret||''});
    });
    if(!res.length){box.innerHTML='<p class="hint">Aucun résultat.</p>';return}
    box.innerHTML=res.slice(0,8).map((x,i)=>`<div class="ck" onclick="choisirOrganisme('${cible}',${i})">
      <span class="bx">›</span><span class="tx"><b>${esc(x.nom)}</b><br><span class="muted small">${esc(x.adresse)}${x.siret?' · SIRET '+esc(x.siret):''}</span></span></div>`).join('')
      +'<p class="hint">Source : registre national des entreprises (INSEE / annuaire-entreprises).</p>';
    window.__res=res;
  }catch(e){box.innerHTML='<p class="hint" style="color:var(--warn)">Registre injoignable : '+esc(e.message)+'. Saisis à la main.</p>'}
}
function choisirOrganisme(cible,i){
  const x=(window.__res||[])[i];if(!x)return;
  cur[cible].nom=x.nom;cur[cible].adresse=x.adresse;majDoc();renderEtape();toast('Renseigné ✓');
}

/* ========================== 2. ORGANISMES ================================= */
function appliquerCarnet(dep){
  const e=CARNET[String(dep).trim()];
  if(e)cur.organismes=JSON.parse(JSON.stringify(e));
  if(!cur.organismes.medecine)cur.organismes.medecine=JSON.parse(JSON.stringify(MEDECINE_TRAVAIL));
  if(!cur.organismes.hse)cur.organismes.hse=JSON.parse(JSON.stringify(COORDINATEUR_HSE));
  majDoc();
  if(etapeIdx===1)renderEtape();
}
function etOrganismes(){
  if(!cur.organismes.medecine)appliquerCarnet(cur.departement);
  const o=cur.organismes||{};
  const dep=String(cur.departement||'').trim();
  const bloc=(cle,titre,fixe)=>{
    const x=o[cle]||{};
    return `<h3>${esc(titre)}${fixe?' <span class="badge">valeur fixe</span>':''}${x.aVerifier?' <span class="badge brouillon">à vérifier</span>':''}</h3>
    ${champ('organismes.'+cle+'.nom','Organisme')}
    ${champ('organismes.'+cle+'.adresse','Adresse',{zone:true})}
    ${champ('organismes.'+cle+'.tel','Téléphone')}`;
  };
  return `<div class="card"><h2><span class="ico">📍</span>Organismes de prévention</h2>
   ${dep?(CARNET[dep]?`<div class="avert ok">✓ Renseigné automatiquement pour le département <b>${esc(dep)}</b>. Rien à faire ici : c’est un onglet de lecture et de contrôle.</div>`
     :`<div class="avert">Le département <b>${esc(dep)}</b> n’est pas encore au carnet. Complète ci-dessous, ce sera mémorisé.</div>`)
    :'<div class="avert">Choisis le département à l’étape 1.</div>'}
   ${bloc('hse','Coordinateur QHSE CDES',true)}
   ${bloc('inspection','Inspection du travail (DDETS)')}
   ${bloc('carsat','CARSAT / CRAMIF')}
   ${bloc('oppbtp','OPPBTP')}
   ${bloc('medecine','Médecine du travail',true)}
   <div class="row" style="margin-top:12px"><button class="btn btn-ghost grow" onclick="memoriserCarnet()">📌 Mémoriser pour ce département</button></div>
   </div>`;
}
function memoriserCarnet(){
  const dep=String(cur.departement||'').trim();
  if(!dep){toast('Choisis d’abord le département',true);return}
  CARNET[dep]=JSON.parse(JSON.stringify(cur.organismes||{}));
  ['inspection','carsat','oppbtp'].forEach(k=>{if(CARNET[dep][k])delete CARNET[dep][k].aVerifier});
  state.carnet=CARNET;save();toast('Mémorisé pour le '+dep+' ✓');renderEtape();
}

/* ========================= 3. ORGANISATION ================================ */
function etOrganisation(){
  const j=['lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  return `<div class="card"><h2><span class="ico">👷</span>Encadrement</h2>
   <div class="g2">
    ${champ('encadrement.respTravaux','Responsable des travaux — rédige le document *',{liste:personnes('redige'),vide:'— choisir —'})}
    ${champ('encadrement.respTravauxTel','Téléphone',{ro:true})}</div>
   <div class="g2">
    ${champ('encadrement.respCdes','Responsable CDES — valide le document',{liste:personnes('valide'),vide:'— choisir —'})}
    ${champ('encadrement.respCdesTel','Téléphone',{ro:true})}</div>
   <p class="hint">Les listes ne proposent que les personnes habilitées à rédiger ou à valider, celles de l’agence du chantier en premier. Les téléphones viennent de l’annuaire CDES.</p>
   </div>

   <div class="card"><h2><span class="ico">🧮</span>Effectifs</h2>
   <div class="g2">${champ('effectifs.cdes','Effectif CDES',{ph:'Ex. 2 collaborateurs'})}
   ${champ('effectifs.interim','Intérimaires',{ph:'Laisser vide si aucun'})}</div>
   <div class="g2">${champ('effectifs.fluvial','Transport fluvial interne CDES',{ph:'Laisser vide si aucun'})}
   ${champ('effectifs.transport','Transport terrestre externe',{ph:'Laisser vide si aucun'})}</div>
   <p class="hint">Une ligne laissée vide sort avec « / » dans le document, jamais blanche.</p>
   <h3>Entreprises extérieures, sous-traitants, transporteurs</h3>
   <div id="ext-list">${renderExt()}</div>
   <div class="row" style="margin-top:8px">
     <input type="text" id="q-ext" class="grow" placeholder="Nom de l’entreprise (recherche au registre)">
     <button class="btn btn-ghost btn-sm" onclick="chercherExt()">🔎 Chercher</button>
     <button class="btn btn-ghost btn-sm" onclick="addExt()">＋ Saisir à la main</button></div>
   <div id="res-ext"></div>
   </div>

   <div class="card"><h2><span class="ico">🎓</span>Habilitations et formations requises</h2>
   <p class="small muted">Tableau § 4.1 du document : nombre de collaborateurs concernés, activité, habilitations exigées
   (CACES, AIPR, permis fluvial, habilitation électrique…). Une ligne par activité.</p>
   <div id="hab-list">${renderHab()}</div>
   <div class="row" style="margin-top:8px">
     <button class="btn btn-ghost btn-sm" onclick="addHab()">＋ Ajouter une habilitation</button>
     ${HABILITATIONS_TYPES.length?`<select class="grow" onchange="if(this.value!==''){addHab(HABILITATIONS_TYPES[+this.value]);this.value=''}">
       <option value="">— ou choisir une habilitation courante —</option>
       ${HABILITATIONS_TYPES.map((h,i)=>`<option value="${i}">${esc(h.activite)}</option>`).join('')}</select>`:''}
   </div>
   </div>

   <div class="card"><h2><span class="ico">🕗</span>Horaires du chantier</h2>
   <div class="tbl-wrap"><table><tr><th>Jour</th><th>Matin</th><th>Après-midi</th></tr>
   ${j.map(x=>`<tr><td style="text-transform:capitalize">${x}</td>
     <td><input type="text" value="${esc(HORAIRES_DEFAUT[x].matin)}" oninput="majHoraire('${x}','matin',this.value)"></td>
     <td><input type="text" value="${esc(HORAIRES_DEFAUT[x].apresMidi)}" oninput="majHoraire('${x}','apresMidi',this.value)"></td></tr>`).join('')}
   </table></div>
   ${champ('horairesTexte','Mentions accompagnant les horaires',{zone:true})}
   </div>

   <div class="card"><h2><span class="ico">🔌</span>Moyens matériels mis en œuvre</h2>
   <p class="small muted">Valeurs génériques CDES — modifie ce qui diffère sur ce chantier.</p>
   ${MOYENS_CHAMPS.map(m=>champ('moyens.'+m.k,m.l,{zone:true})).join('')}
   </div>

   <div class="card"><h2><span class="ico">🚻</span>Logistique du personnel</h2>
   ${LOGISTIQUE_CHAMPS.map(m=>champ('logistique.'+m.k,m.l,{zone:true})).join('')}
   </div>`;
}
function renderHab(){
  if(!Array.isArray(cur.habilitations))cur.habilitations=[];
  if(!cur.habilitations.length)return '<p class="hint">Aucune habilitation déclarée. Le contrôle de cohérence le signalera si des engins apparaissent dans les risques.</p>';
  return cur.habilitations.map((h,i)=>`<div class="ligne"><div class="row">
      <input type="text" style="width:70px" value="${esc(h.nombre||'')}" oninput="majHab(${i},'nombre',this.value)" placeholder="Nb">
      <input type="text" class="grow" value="${esc(h.activite||'')}" oninput="majHab(${i},'activite',this.value)" placeholder="Activité (ex. conduite de pelle)">
      <button class="btn btn-danger btn-sm" onclick="delHab(${i})">✕</button></div>
    <input type="text" style="margin-top:6px" value="${esc(h.habilitations||'')}" oninput="majHab(${i},'habilitations',this.value)" placeholder="Habilitations requises (ex. CACES R482 cat. B1 + autorisation de conduite)">
    </div>`).join('');
}
function addHab(o){if(!Array.isArray(cur.habilitations))cur.habilitations=[];
  cur.habilitations.push(Object.assign({nombre:'',activite:'',habilitations:''},o||{}));majDoc();renderEtape()}
function majHab(i,k,v){cur.habilitations[i][k]=v;majDoc()}
function delHab(i){cur.habilitations.splice(i,1);majDoc();renderEtape()}
function majHoraire(j,q,v){HORAIRES_DEFAUT[j][q]=v;if(!cur.horaires)cur.horaires={};if(!cur.horaires[j])cur.horaires[j]={};cur.horaires[j][q]=v;majDoc()}
function renderExt(){
  if(!cur.entreprisesExt.length)return '<p class="hint">Aucune entreprise extérieure déclarée.</p>';
  return cur.entreprisesExt.map((e,i)=>`<div class="ligne">
    <div class="row">
      <select style="width:190px" onchange="majExt(${i},'role',this.value)">
        ${ROLES_EXT.map(r=>'<option'+(e.role===r?' selected':'')+'>'+esc(r)+'</option>').join('')}</select>
      <input type="text" class="grow" value="${esc(e.nom||'')}" oninput="majExt(${i},'nom',this.value)" placeholder="Raison sociale">
      <input type="text" style="width:130px" value="${esc(e.effectif||'')}" oninput="majExt(${i},'effectif',this.value)" placeholder="Effectif">
      <button class="btn btn-danger btn-sm" onclick="delExt(${i})">✕</button></div>
    <input type="text" style="margin-top:6px" value="${esc(e.adresse||'')}" oninput="majExt(${i},'adresse',this.value)" placeholder="Adresse">
    </div>`).join('');
}
function addExt(o){cur.entreprisesExt.push(Object.assign({role:ROLES_EXT[0],nom:'',adresse:'',effectif:''},o||{}));majDoc();renderEtape()}
function majExt(i,k,v){cur.entreprisesExt[i][k]=v;majDoc()}
function delExt(i){cur.entreprisesExt.splice(i,1);majDoc();renderEtape()}
async function chercherExt(){
  const q=document.getElementById('q-ext').value.trim();const box=document.getElementById('res-ext');
  if(!q){toast('Tape un nom',true);return}
  box.innerHTML='<p class="hint">Recherche…</p>';
  try{
    const r=await fetch('https://recherche-entreprises.api.gouv.fr/search?q='+encodeURIComponent(q)+'&per_page=5');
    const j=await r.json();
    const res=(j.results||[]).map(e=>({nom:e.nom_complet||'',adresse:(e.siege&&e.siege.adresse)||'',siret:(e.siege&&e.siege.siret)||''}));
    if(!res.length){box.innerHTML='<p class="hint">Aucun résultat.</p>';return}
    window.__resExt=res;
    box.innerHTML=res.map((x,i)=>`<div class="ck" onclick="choisirExt(${i})"><span class="bx">›</span>
      <span class="tx"><b>${esc(x.nom)}</b><br><span class="muted small">${esc(x.adresse)}</span></span></div>`).join('');
  }catch(e){box.innerHTML='<p class="hint" style="color:var(--warn)">Registre injoignable. Saisis à la main.</p>'}
}
function choisirExt(i){const x=(window.__resExt||[])[i];if(!x)return;
  addExt({nom:x.nom,adresse:x.adresse});document.getElementById('q-ext').value='';toast('Ajoutée ✓')}

/* ====================== 4. INSPECTION COMMUNE ============================= */
function etInspection(){
  return `<div class="card"><h2><span class="ico">🔍</span>Inspection commune préalable</h2>
   <div class="avert info">Obligatoire <b>avant le début de l’opération</b> (art. R.4512-2). L’entreprise
   utilisatrice délimite le secteur d’intervention, matérialise les zones de danger, indique les voies
   de circulation et d’accès aux installations, et communique ses consignes de sécurité
   (art. R.4512-4 et R.4512-5). Sans elle, le plan de prévention n’est pas valable.</div>
   <div class="g2">${champ('inspection.date','Date de l’inspection *',{type:'date'})}
   ${champ('inspection.lieu','Lieu / point de rendez-vous')}</div>
   <div class="g2">${champ('inspection.repEU','Représentant entreprise utilisatrice',{ph:'Nom, prénom, fonction'})}
   ${champ('inspection.repEE','Représentant CDES',{ph:'Nom, prénom, fonction'})}</div>
   ${champ('inspection.autres','Autres participants',{zone:true,ph:'Sous-traitants, coordonnateur SPS, médecin du travail, CSE…'})}
   <h3>Installations mises à disposition</h3>
   ${INSTALLATIONS.map((x,i)=>`<div class="ck ${(cur.inspection.installations||[]).includes(x)?'on':''}" onclick="bascInstall(${i})">
     <span class="bx">${(cur.inspection.installations||[]).includes(x)?'✓':''}</span><span class="tx">${esc(x)}</span></div>`).join('')}
   </div>
   <div class="card"><h2><span class="ico">✔</span>Points examinés sur le terrain</h2>
   <p class="small muted">Vu / Sans objet / À traiter — et une observation si nécessaire.</p>
   ${cur.inspection.points.map((p,i)=>`<div class="ligne">
     <div class="row" style="align-items:center">
       <span class="grow" style="font-size:13.5px;font-weight:600">${esc(p.t)}</span>
       ${['Vu','S/O','À traiter'].map(e=>`<button class="btn btn-xs ${p.etat===e?(e==='À traiter'?'btn-danger':'btn-primary'):'btn-ghost'}"
          onclick="majPoint(${i},'etat','${e}')">${e}</button>`).join('')}
     </div>
     ${p.etat==='À traiter'||p.obs?`<input type="text" style="margin-top:6px" value="${esc(p.obs||'')}"
        oninput="majPoint(${i},'obs',this.value)" placeholder="Observation, action décidée, qui, quand">`:''}
   </div>`).join('')}
   ${champ('inspection.observations','Synthèse et décisions prises',{zone:true})}
   </div>`;
}
function bascInstall(i){
  const x=INSTALLATIONS[i];const l=cur.inspection.installations||(cur.inspection.installations=[]);
  const k=l.indexOf(x);if(k>=0)l.splice(k,1);else l.push(x);majDoc();renderEtape();
}
function majPoint(i,k,v){cur.inspection.points[i][k]=v;majDoc();if(k==='etat')renderEtape()}

/* ============================ 5. RISQUES ================================== */
function etRisques(){
  return `<div class="card"><h2><span class="ico">⚠️</span>Analyse des risques</h2>
   <div class="avert info">Trois natures de risques, à ne pas mélanger :
   <b style="color:var(--exp)">exportés</b> (générés par notre intervention) ·
   <b style="color:var(--imp)">importés</b> (subis, présents dans l’environnement du chantier) ·
   <b style="color:var(--coa)">coactivité</b> (nés de la simultanéité des activités). C’est cette
   dernière analyse qui justifie réglementairement le plan de prévention.</div>
   </div>
   <div id="r-exp"></div><div id="r-imp"></div><div id="r-coa"></div>`;
}
function renderRisques(){
  renderExportes();renderImportes();renderCoactivite();
}
function pictoFamille(nom){const f=BIBLIO.find(x=>x.famille===nom);return (f&&f.picto)||'⚙️'}

function renderExportes(){
  const box=document.getElementById('r-exp');if(!box)return;
  box.innerHTML=`<div class="bloc exp"><div class="bh"><span class="pic">↗️</span>
     <b>Risques exportés<span class="sd">Générés par notre intervention — § 4.3 du document</span></b></div>
   <div class="bb">
   <p class="small muted">Coche les activités du chantier : chacune devient une opération numérotée. Une tâche ou un
   métier absent de la trame (palplanches, battage, tunage…) s’ajoute avec le bouton du bas : tu nommes l’opération,
   puis ses situations de travail, risques et mesures. Elle sort dans le Word comme les autres.</p>
   ${BIBLIO.map((f,i)=>{const on=cur.risques.exportes.some(o=>o.source===f.famille);
     return `<div class="ck ${on?'on':''}" onclick="bascFamille(${i})"><span class="bx">${on?'✓':''}</span>
       <span class="tx"><span style="font-size:16px">${f.picto}</span> <b>${esc(f.famille)}</b>
       <span class="muted small">— ${f.lignes.length} situation(s)</span></span></div>`}).join('')}
   <div id="ops"></div>
   <button class="btn btn-accent btn-block btn-sm" style="margin-top:8px" onclick="addOpLibre()">＋ Ajouter une tâche ou un métier absent de la trame</button>
   </div></div>`;
  renderOps();
}
function bascFamille(i){
  const f=BIBLIO[i];
  const idx=cur.risques.exportes.findIndex(o=>o.source===f.famille);
  if(idx>=0)cur.risques.exportes.splice(idx,1);
  else cur.risques.exportes.push({source:f.famille,nom:f.famille,picto:f.picto,numeroter:f.famille!=='Autres risques',
    lignes:f.lignes.map(l=>ligneDepuis(l))});
  majDoc();renderEtape();
}
function ligneDepuis(l){return {source:l.danger,danger:l.danger,on:true,significatif:false,
  risques:l.risques.map(t=>({txt:t,on:true})),mesures:l.mesures.map(t=>({txt:t,on:true}))}}
function addOpLibre(){
  cur.risques.exportes.push({source:'',nom:'',picto:'✳️',numeroter:true,libre:true,
    lignes:[{danger:'Nouvelle situation de travail',on:true,significatif:false,
      risques:[{txt:'Risque à préciser',on:true}],mesures:[{txt:'Mesure à préciser',on:true}]}]});
  majDoc();renderEtape();
  /* le conducteur nomme tout de suite sa tâche : on l'amène dessus */
  const ops=document.querySelectorAll('#ops .op');const dern=ops[ops.length-1];
  if(dern){dern.scrollIntoView({behavior:'smooth',block:'center'});const inp=dern.querySelector('.oh input');if(inp){inp.focus();}}
}
function renderOps(){
  const box=document.getElementById('ops');if(!box)return;
  box.innerHTML=cur.risques.exportes.map((op,oi)=>`
   <div class="op"><div class="oh">
     <span class="pic">${op.picto||'⚙️'}</span>
     <span class="muted small">${op.numeroter===false?'—':'OP. '+(numeroOp(oi))}</span>
     <input value="${esc(op.nom)}" placeholder="${op.libre?'Nom de la tâche ou du métier (ex. Mise en place de palplanches)':'Nom de l’opération'}" oninput="majOp(${oi},this.value)">
     <button class="btn btn-ghost btn-xs" onclick="deplacerOp(${oi},-1)">↑</button>
     <button class="btn btn-ghost btn-xs" onclick="deplacerOp(${oi},1)">↓</button>
     <button class="btn btn-danger btn-xs" onclick="delOp(${oi})">✕</button>
   </div><div class="ob">
   ${(op.lignes||[]).map((l,li)=>ligneHTML(l,'exp',oi,li)).join('')||'<p class="hint">Aucune situation de travail.</p>'}
   <button class="btn btn-ghost btn-xs" onclick="addLigne(${oi})">＋ Situation de travail</button>
   </div></div>`).join('');
}
function numeroOp(oi){let n=0;for(let i=0;i<=oi;i++)if(cur.risques.exportes[i].numeroter!==false)n++;return n}
function ligneHTML(l,type,oi,li){
  const p=(cle,i)=>`onclick="bascSous('${type}',${oi},${li},'${cle}',${i})"`;
  return `<div class="ligne ${l.on===false?'off':''} ${l.significatif?'sig':''}">
    <div class="lt">
      <span class="ck-mini ${l.on!==false?'on':''}" onclick="bascLigne('${type}',${oi},${li})">${l.on!==false?'✓':''}</span>
      <span class="nm" contenteditable="true" onblur="majDanger('${type}',${oi},${li},this.innerText)">${esc(l.danger)}</span>
      <button class="flag sig ${l.significatif?'on':''}" title="Marquer comme risque significatif" onclick="bascSignificatif('${type}',${oi},${li})">🚩</button>
      <button class="flag sup" title="Retirer cette situation" onclick="delLigne('${type}',${oi},${li})">✕</button>
    </div>
    ${l.on===false?'':`<div class="sous">
      <h4>Risques <span class="muted">(${l.risques.filter(r=>r.on).length}/${l.risques.length})</span>
        <button class="btn btn-ghost btn-xs add" onclick="addSous('${type}',${oi},${li},'risques')">＋</button></h4>
      ${l.risques.map((r,i)=>`<div class="s1 ${r.on?'on':''}"><span class="b" ${p('risques',i)}>${r.on?'✓':''}</span>
        <span class="tt" contenteditable="true" onblur="majSous('${type}',${oi},${li},'risques',${i},this.innerText)">${esc(r.txt)}</span>
        <button class="x" onclick="delSous('${type}',${oi},${li},'risques',${i})">✕</button></div>`).join('')}
      <h4>Mesures de prévention <span class="muted">(${l.mesures.filter(m=>m.on).length}/${l.mesures.length})</span>
        <button class="btn btn-ghost btn-xs add" onclick="addSous('${type}',${oi},${li},'mesures')">＋</button></h4>
      ${l.mesures.map((m,i)=>`<div class="s1 ${m.on?'on':''}"><span class="b" ${p('mesures',i)}>${m.on?'✓':''}</span>
        <span class="tt" contenteditable="true" onblur="majSous('${type}',${oi},${li},'mesures',${i},this.innerText)">${esc(m.txt)}</span>
        <button class="x" onclick="delSous('${type}',${oi},${li},'mesures',${i})">✕</button></div>`).join('')}
    </div>`}
  </div>`;
}
function conteneur(type,oi){
  if(type==='exp')return cur.risques.exportes[oi].lignes;
  if(type==='imp')return cur.risques.importes;
  return cur.risques.coactivite.lignes;
}
function bascLigne(t,oi,li){const l=conteneur(t,oi)[li];l.on=(l.on===false);majDoc();renderRisques()}
function bascSignificatif(t,oi,li){const l=conteneur(t,oi)[li];l.significatif=!l.significatif;majDoc();renderRisques()}
function delLigne(t,oi,li){conteneur(t,oi).splice(li,1);majDoc();renderRisques()}
function majDanger(t,oi,li,v){const l=conteneur(t,oi)[li];if(l){l.danger=v.trim();majDoc()}}
function bascSous(t,oi,li,cle,i){const x=conteneur(t,oi)[li][cle][i];x.on=!x.on;majDoc();renderRisques()}
function majSous(t,oi,li,cle,i,v){const x=conteneur(t,oi)[li][cle][i];if(x){x.txt=v.trim();majDoc()}}
function delSous(t,oi,li,cle,i){conteneur(t,oi)[li][cle].splice(i,1);majDoc();renderRisques()}
function addSous(t,oi,li,cle){conteneur(t,oi)[li][cle].push({txt:cle==='risques'?'Nouveau risque':'Nouvelle mesure',on:true});majDoc();renderRisques()}
function addLigne(oi){cur.risques.exportes[oi].lignes.push({danger:'Nouvelle situation de travail',on:true,significatif:false,
  risques:[{txt:'Risque à préciser',on:true}],mesures:[{txt:'Mesure à préciser',on:true}]});majDoc();renderRisques()}
function majOp(i,v){cur.risques.exportes[i].nom=v;majDoc()}
function delOp(i){cur.risques.exportes.splice(i,1);majDoc();renderEtape()}
function deplacerOp(i,d){const j=i+d;if(j<0||j>=cur.risques.exportes.length)return;
  const [o]=cur.risques.exportes.splice(i,1);cur.risques.exportes.splice(j,0,o);majDoc();renderEtape()}

function renderImportes(){
  const box=document.getElementById('r-imp');if(!box)return;
  box.innerHTML=`<div class="bloc imp"><div class="bh"><span class="pic">↘️</span>
     <b>Risques importés<span class="sd">Subis — présents dans l’environnement du chantier — § 4.6</span></b></div>
   <div class="bb">
   ${RISQUES_ENV.map((r,i)=>{const on=cur.risques.importes.some(x=>x.source===r.danger);
     return `<div class="ck ${on?'on':''}" onclick="bascImporte(${i})"><span class="bx">${on?'✓':''}</span>
       <span class="tx">${esc(r.danger)}</span></div>`}).join('')}
   <div style="margin-top:10px">${cur.risques.importes.map((l,li)=>ligneHTML(l,'imp',0,li)).join('')}</div>
   <button class="btn btn-ghost btn-block btn-sm" onclick="addImporteLibre()">＋ Risque importé sur mesure</button>
   </div></div>`;
}
function bascImporte(i){
  const r=RISQUES_ENV[i];
  const idx=cur.risques.importes.findIndex(x=>x.source===r.danger);
  if(idx>=0)cur.risques.importes.splice(idx,1);
  else cur.risques.importes.push(ligneDepuis(r));
  majDoc();renderEtape();
}
function addImporteLibre(){cur.risques.importes.push({danger:'Nouveau risque importé',on:true,significatif:false,
  risques:[{txt:'Risque à préciser',on:true}],mesures:[{txt:'Mesure à préciser',on:true}]});majDoc();renderRisques()}

function renderCoactivite(){
  const box=document.getElementById('r-coa');if(!box)return;
  const c=cur.risques.coactivite;
  box.innerHTML=`<div class="bloc coa"><div class="bh"><span class="pic">⇄</span>
     <b>Risques de coactivité<span class="sd">Nés de la simultanéité des activités — § 4.5</span></b></div>
   <div class="bb">
   <div class="ck ${c.aucune?'on':''}" onclick="bascAucuneCoactivite()"><span class="bx">${c.aucune?'✓':''}</span>
     <span class="tx"><b>Pas de coactivité sur ce chantier</b><br>
     <span class="muted small">CDES intervient seule sur la zone, aucune autre entreprise en simultané.</span></span></div>
   ${c.aucune?`<div style="margin-top:8px">${champ('risques.coactivite.motif','Mention portée au document',{zone:true})}</div>`
    :`<div style="margin-top:8px">
      ${c.lignes.map((l,li)=>ligneHTML(l,'coa',0,li)).join('')||'<div class="avert">Tu as déclaré de la coactivité : décris au moins une interférence.</div>'}
      ${COACTIVITE_TYPE.map((x,i)=>`<div class="ck" onclick="addCoactivite(${i})"><span class="bx">＋</span><span class="tx">${esc(x.danger)}</span></div>`).join('')}
      <button class="btn btn-ghost btn-block btn-sm" onclick="addCoactivite(-1)">＋ Interférence sur mesure</button></div>`}
   </div></div>`;
}
function bascAucuneCoactivite(){cur.risques.coactivite.aucune=!cur.risques.coactivite.aucune;majDoc();renderRisques()}
function addCoactivite(i){
  const m=i>=0?COACTIVITE_TYPE[i]:{danger:'Nouvelle interférence',risques:['Risque à préciser'],mesures:['Mesure à préciser']};
  cur.risques.coactivite.lignes.push({danger:m.danger,on:true,significatif:false,
    risques:m.risques.map(t=>({txt:t,on:true})),mesures:m.mesures.map(t=>({txt:t,on:true}))});
  majDoc();renderRisques();
}

/* ========================= 6. EPI ET CONSIGNES ============================ */
function etEpi(){
  return `<div class="card"><h2><span class="ico">🦺</span>Équipements de protection individuelle</h2>
   <p class="small muted">Dans l’ordre du tableau de ta trame. Une croix sera portée pour chaque EPI retenu.</p>
   <div class="epigrid">${EPI.map((e,i)=>`<div class="epi ${cur.epi[i].on?'on':''}" onclick="bascEpi(${i})">
     <span class="p">${e.picto}</span><span class="n">${esc(e.nom)}</span>
     ${cur.epi[i].note?'<span class="muted small">'+esc(cur.epi[i].note)+'</span>':''}</div>`).join('')}</div>
   </div>
   <div class="card"><h2><span class="ico">📌</span>Consignes générales de sécurité</h2>
   ${cur.consignes.generales.map((c,i)=>`<div class="ck ${c.on?'on':''}"><span class="bx" onclick="bascConsigne('generales',${i})">${c.on?'✓':''}</span>
     <span class="tx" contenteditable="true" onblur="majConsigne('generales',${i},this.innerText)">${esc(c.t)}</span></div>`).join('')}
   <button class="btn btn-ghost btn-block btn-sm" onclick="addConsigne('generales')">＋ Consigne</button>
   </div>
   <div class="card"><h2><span class="ico">📍</span>Consignes particulières au chantier</h2>
   ${cur.consignes.particulieres.map((c,i)=>`<div class="ck ${c.on?'on':''}"><span class="bx" onclick="bascConsigne('particulieres',${i})">${c.on?'✓':''}</span>
     <span class="tx" contenteditable="true" onblur="majConsigne('particulieres',${i},this.innerText)">${esc(c.t)}</span></div>`).join('')}
   <button class="btn btn-ghost btn-block btn-sm" onclick="addConsigne('particulieres')">＋ Consigne</button>
   </div>`;
}
function bascEpi(i){cur.epi[i].on=!cur.epi[i].on;majDoc();renderEtape()}
function bascConsigne(k,i){cur.consignes[k][i].on=!cur.consignes[k][i].on;majDoc();renderEtape()}
function majConsigne(k,i,v){cur.consignes[k][i].t=v.trim();majDoc()}
function addConsigne(k){cur.consignes[k].push({t:'Nouvelle consigne',on:true});majDoc();renderEtape()}

/* ======================= 7. SECOURS ET SIGNATURES ========================= */
function etSecours(){
  majUrgence();
  const a=urgenceAuto();
  const repris=(cle,champManuel)=>cur.urgence[champManuel]&&a[cle]&&a[cle]!==cur.urgence[cle]
    ? `<p class="aide">Annuaire : ${esc(a[cle])} · <a href="#" onclick="libererUrgence('${cle}');return false">reprendre cette valeur</a></p>`:'';
  const prot=estProtocole();
  const listeDiff=prot?'prot.diffusion':(cur.type==='ppsps'?'sps.diffusion':'diffusion');
  const diff=prot?cur.prot.diffusion:(cur.type==='ppsps'?cur.sps.diffusion:cur.diffusion);
  return `<div class="card"><h2><span class="ico">🚑</span>Conduite à tenir en cas d’urgence</h2>
   <div class="avert ok">Les deux numéros ci-dessous sont repris tout seuls : le conducteur de travaux
   depuis l’encadrement, le responsable CDES depuis le chef de l’agence retenue. Écris par-dessus si besoin.</div>
   ${champ('urgence.conducteur','Conducteur de travaux / téléphone *',{ph:'Nom — 06 xx xx xx xx'})}
   ${repris('conducteur','condManuel')}
   ${champ('urgence.responsable','Responsable CDES (chef d’agence) / téléphone')}
   ${repris('responsable','respManuel')}
   ${champ('urgence.hse','Responsable HSE / téléphone')}
   ${champ('urgence.specificites','Spécificités de ce chantier',{zone:true,ph:'Hôpital le plus proche, accès difficile, moyens anti-pollution sur site…'})}
   </div>
   ${blocGPS()}
   ${prot?`<div class="card"><h2><span class="ico">🧯</span>Emplacement des dispositifs de secours</h2>
   <p class="small muted">Les trois colonnes du tableau condensé : secours aux personnes, environnement, incendie.</p>
   ${champ('prot.secours.sst','Secours aux personnes',{zone:true})}
   ${champ('prot.secours.pollution','Incident environnement',{zone:true})}
   ${champ('prot.secours.incendie','Incendie',{zone:true})}
   </div>`:''}
   ${cur.type==='pdp'?'':`<div class="card"><h2><span class="ico">📤</span>Diffusion et information</h2>
   <p class="small muted">${prot?'Ce que le protocole impose en propre (R.4515-6).'
     :'Obligations liées à la coordination SPS — un plan de prévention n’en a aucune.'}</p>
   ${diff.map((c,i)=>`<div class="ck ${c.on?'on':''}" onclick="bascDiffusion('${listeDiff}',${i})">
     <span class="bx">${c.on?'✓':''}</span><span class="tx">${esc(c.t)}</span></div>`).join('')}
   </div>`}
   <div class="card"><h2><span class="ico">✍️</span>Signataires</h2>
   <p class="small muted">${prot?'Trois parties : l’utilisatrice (CDES), le transporteur et son éventuel sous-traitant.'
     :(cur.type==='ppsps'?'Une seule signature : le PPSPS est établi par l’entreprise intervenante et remis au coordonnateur SPS. L’entreprise utilisatrice ne le contresigne pas.'
     :'Deux parties : l’entreprise extérieure (CDES) et l’entreprise utilisatrice.')}</p>
   ${Object.keys(cur.signataires).map(k=>{
     if(!estProtocole()&&cur.type!=='ppsps'&&/utilisatrice/i.test(k))
       return `<h3>${esc(k)}</h3><p class="hint">Cette ligne reste vierge dans le document : c’est le client qui la remplit à la signature.</p>`;
     return `<h3>${esc(k)}</h3>${champ('signataires.'+k+'.nom','Nom du responsable')}`;
   }).join('')}
   </div>
   <div class="card"><h2><span class="ico">📋</span>Feuille d’émargement</h2>
   <div class="avert info">Elle reste <b>vierge</b> dans le document : elle se signe sur le terrain,
   au moment de la diffusion aux équipes. Rien à saisir ici.</div>
   </div>
   <div class="card"><h2><span class="ico">✅</span>Finalisation</h2>
   <div id="controle">${renderControle()}</div>
   <div class="row" style="margin-top:10px">
     <button class="btn btn-primary grow" onclick="genererWord()">📄 Générer le document</button>
     <button class="btn btn-accent grow" onclick="genererAffichageWord()">🪧 Affichage obligatoire</button></div>
   <div class="row" style="margin-top:8px">
     <button class="btn btn-ghost btn-block" onclick="marquerFini()">Marquer terminé</button></div>
   <p class="hint">L’affichage obligatoire est un panneau A4 rempli avec ce que tu viens de saisir :
   chantier, horaires, effectif, conducteur, inspection et médecine du travail, numéros
   d’urgence et QR code vers le point GPS.</p>
   <div class="row" style="margin-top:8px"><button class="btn btn-danger btn-block btn-sm" onclick="supprimerDocCourant()">🗑 Supprimer ce document</button></div>
   </div>`;
}
function bascDiffusion(chemin,i){const l=lire(chemin);l[i].on=!l[i].on;majDoc();renderEtape()}
function marquerFini(){cur.statut='fini';majDoc();toast('Document marqué terminé ✓');go('v-docs')}
function renderControle(){
  const a=controles();
  if(!a.length)return '<div class="avert ok">✓ Rien à signaler avant génération.</div>';
  return '<div class="avert"><b>À vérifier avant de générer :</b><ul style="margin:6px 0 0 0;padding-left:18px">'+
    a.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div>';
}
function controles(){
  const a=[];
  if(!cur.titre)a.push('L’intitulé de l’opération est vide.');
  if(!cur.urgence.conducteur)a.push('Aucun conducteur de travaux à contacter en cas d’urgence.');
  if(estProtocole()){
    if(!cur.prot.transporteur.nom)a.push('Le transporteur — l’entreprise intervenante du protocole — n’est pas identifié.');
    if(!cur.prot.risques.some(r=>r.on))a.push('Aucune opération de transport retenue : le document sortira sans analyse de risques.');
    if(!(cur.prot.engins||[]).length)a.push('Aucun engin de transport coché.');
    if(!cur.prot.habilitations.some(h=>h.on))a.push('Aucune habilitation retenue alors que le transport en exige au moins une.');
    return a;
  }
  if(!cur.inspection.date)a.push('La date de l’inspection commune préalable n’est pas renseignée — elle est obligatoire avant le début de l’opération.');
  if(!cur.risques.exportes.length)a.push('Aucune activité retenue : le tableau des risques sera vide.');
  const txt=JSON.stringify(cur.risques).toLowerCase();
  if(/engin|pelle|grue|chariot|manitou/.test(txt)&&!cur.habilitations.length)
    a.push('Des engins apparaissent dans les risques mais aucune habilitation n’est déclarée.');
  if(/noyade|chute à l’eau|chute a l eau/.test(txt)&&!cur.epi[3].on)
    a.push('Le risque de noyade est retenu mais le gilet de sauvetage n’est pas coché dans les EPI.');
  if(!cur.risques.coactivite.aucune&&!cur.risques.coactivite.lignes.length)
    a.push('Tu as déclaré de la coactivité sans décrire d’interférence.');
  if(cur.type==='ppsps'){
    if(!cur.sps.coordonnateur)a.push('PPSPS sans coordonnateur SPS : c’est lui qui reçoit le document.');
    if(!cur.sps.dateTransmission)a.push('La date de transmission du PPSPS au coordonnateur n’est pas renseignée.');
  }
  return a;
}

/* ====================== ÉTAPE PPSPS : COORDINATION SPS ====================
   Absente du plan de prévention : c'est elle qui fait le PPSPS. */
function etSps(){
  const s=cur.sps;
  return `<div class="card"><h2><span class="ico">🧭</span>Coordination sécurité et protection de la santé</h2>
   <div class="avert info">Le PPSPS n’est pas un plan de prévention : il s’adresse au <b>coordonnateur SPS</b>
   d’une opération de bâtiment ou de génie civil, il répond au <b>plan général de coordination</b> et il
   doit lui être transmis avant le début des travaux (art. R.4532-56 et suivants).</div>
   ${champ('sps.coordonnateur','Coordonnateur SPS *',{ph:'Nom, organisme'})}
   <div class="g2">${champ('sps.coordonnateurTel','Téléphone')}
   ${champ('sps.dateTransmission','Date de transmission du PPSPS *',{type:'date'})}</div>
   ${champ('sps.coordonnateurAdresse','Adresse',{zone:true})}
   ${champ('sps.categorie','Catégorie de l’opération',{liste:PPSPS_CATEGORIES})}
   ${champ('sps.pgc','Référence du PGC (plan général de coordination)',{ph:'Indice, date, émetteur'})}
   ${champ('sps.registre','Registre-journal de la coordination',{ph:'Références des observations reprises'})}
   <div class="g2">${champ('sps.effectifPointe','Effectif de pointe prévu sur le chantier',{ph:'Ex. 6 personnes'})}
   ${champ('sps.dureePrevisionnelle','Durée prévisionnelle des travaux',{ph:'Ex. 5 semaines'})}</div>
   <p class="hint">Ces informations n’existent pas dans un plan de prévention : elles ne seront écrites
   au document que si le type retenu est le PPSPS.</p>
   </div>`;
}

/* ============================= ANNEXES PDF ================================ */
function etAnnexes(){
  return `<div class="card"><h2><span class="ico">📎</span>Annexes</h2>
   <p class="small muted">Plans de circulation, DICT, notices, mode opératoire détaillé, Règles Qui Sauvent…
   Les fichiers restent sur l’appareil ; ils sont livrés avec le document.</p>
   <div class="avert info">Word ne sait pas absorber un PDF dans son propre fichier. Quand tu as des annexes,
   la génération produit donc un <b>dossier compressé</b> : le document Word + les PDF, prêts à envoyer.
   La liste des annexes, elle, est écrite dans le document.</div>
   <div id="annexes-list"></div>
   <div class="row" style="margin-top:10px">
     <button class="btn btn-accent grow" onclick="document.getElementById('annexe-file').click()">＋ Ajouter des PDF</button>
     <input type="file" id="annexe-file" accept="application/pdf,.pdf" multiple style="display:none"
       onchange="ajouterAnnexes(this)"></div>
   </div>`;
}
function renderAnnexes(){
  const box=document.getElementById('annexes-list');if(!box)return;
  const l=cur.annexes||[];
  box.innerHTML=l.length?l.map((a,i)=>`<div class="ligne"><div class="row" style="align-items:center">
     <span style="font-size:20px">📄</span>
     <input type="text" class="grow" value="${esc(a.titre||'')}" oninput="majAnnexe(${i},'titre',this.value)" placeholder="Intitulé de l’annexe">
     <button class="btn btn-ghost btn-xs" onclick="deplacerAnnexe(${i},-1)">↑</button>
     <button class="btn btn-ghost btn-xs" onclick="deplacerAnnexe(${i},1)">↓</button>
     <button class="btn btn-danger btn-xs" onclick="delAnnexe(${i})">✕</button></div>
     <p class="aide">Annexe ${i+1} · ${esc(a.nom)} · ${Math.round((a.taille||0)/1024)} Ko</p></div>`).join('')
   :'<p class="hint">Aucune annexe. Le document sera généré seul, en .docx.</p>';
}
async function ajouterAnnexes(inp){
  const fs=Array.from(inp.files||[]);inp.value='';
  if(!fs.length)return;
  let n=0;
  for(const f of fs){
    if(!/pdf$/i.test(f.name)&&f.type!=='application/pdf'){toast('« '+f.name+' » n’est pas un PDF',true);continue}
    const id='a'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
    try{await annexePut(id,f)}catch(e){toast('Enregistrement impossible : '+e.message,true);continue}
    cur.annexes.push({id:id,nom:f.name,taille:f.size,
      titre:f.name.replace(/\.pdf$/i,'').replace(/[_-]+/g,' ').trim()});
    n++;
  }
  majDoc();renderAnnexes();
  if(n)toast(n+' annexe(s) ajoutée(s) ✓');
}
function majAnnexe(i,k,v){cur.annexes[i][k]=v;majDoc()}
function delAnnexe(i){
  const a=cur.annexes[i];if(!a)return;
  if(!confirm('Retirer l’annexe « '+(a.titre||a.nom)+' » ?'))return;
  annexeDel(a.id).catch(()=>{});
  cur.annexes.splice(i,1);majDoc();renderAnnexes();
}
function deplacerAnnexe(i,d){const j=i+d;if(j<0||j>=cur.annexes.length)return;
  const [a]=cur.annexes.splice(i,1);cur.annexes.splice(j,0,a);majDoc();renderAnnexes()}
/* stockage des PDF : IndexedDB, pour ne pas saturer le stockage local */
const ADB='pdp_annexes';
function magasin(nom,mode){
  return new Promise((res,rej)=>{
    const r=indexedDB.open(ADB,2);
    r.onupgradeneeded=()=>{['f','trames'].forEach(s=>{
      if(!r.result.objectStoreNames.contains(s))r.result.createObjectStore(s)})};
    r.onsuccess=()=>{try{res(r.result.transaction(nom,mode).objectStore(nom))}catch(e){rej(e)}};
    r.onerror=()=>rej(r.error||new Error('IndexedDB indisponible'));
  });
}
function annexeReq(q){return new Promise((res,rej)=>{q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})}
async function annexePut(k,blob){const s=await magasin('f','readwrite');return annexeReq(s.put(blob,k))}
async function annexeGet(k){const s=await magasin('f','readonly');return annexeReq(s.get(k))}
async function annexeDel(k){const s=await magasin('f','readwrite');return annexeReq(s.delete(k))}
async function tramePut(k,blob){const s=await magasin('trames','readwrite');return annexeReq(s.put(blob,k))}
async function trameGet(k){const s=await magasin('trames','readonly');return annexeReq(s.get(k))}
async function trameDel(k){const s=await magasin('trames','readwrite');return annexeReq(s.delete(k))}

/* ==========================================================================
   PROTOCOLE DE SÉCURITÉ — parcours dédié.
   Trois différences de fond avec le plan de prévention :
   · CDES est l'entreprise UTILISATRICE, le transporteur est l'intervenante ;
   · ni inspection commune préalable, ni organismes de prévention ;
   · on raisonne en moyens de transport et en opérations, pas en familles
     d'activité de chantier.
   ========================================================================= */
/* cases à cocher multiples adossées à un tableau de valeurs */
function cases(chemin,liste,cols){
  const sel=lire(chemin)||[];
  return `<div class="epigrid" style="grid-template-columns:repeat(auto-fill,minmax(${cols||190}px,1fr))">`+
    liste.map(x=>`<div class="epi ${sel.includes(x)?'on':''}" data-v="${esc(x)}"
      onclick="bascCase('${chemin}',this.dataset.v)"><span class="n">${esc(x)}</span></div>`).join('')+`</div>`;
}
function bascCase(chemin,v){
  const l=lire(chemin)||[];const k=l.indexOf(v);
  if(k>=0)l.splice(k,1);else l.push(v);
  ecrire(chemin,l);renderEtape();
}
function etProtTransport(){
  const ag=agenceDe();
  const t=TYPES.find(x=>x.code===cur.type)||TYPES[2];
  return `<div class="card"><h2><span class="ico">📄</span>Nature du document</h2>
   <div class="avert info"><b>${esc(t.nom)}</b> — ${esc(t.quand)}<br>
   Établi en application des articles <b>${esc(t.articles)}</b> du Code du travail.</div>
   <div class="avert">Attention au sens des rôles : dans un protocole, <b>CDES est l’entreprise utilisatrice</b>
   — celle qui reçoit — et le transporteur est l’entreprise intervenante. C’est l’inverse du plan de prévention.</div>
   ${champ('type','Changer de type',{liste:TYPES.map(x=>({v:x.code,l:x.nom}))})}
   </div>

   <div class="card"><h2><span class="ico">🚚</span>L’opération de transport</h2>
   ${champ('titre','Intitulé de l’opération *',{ph:'Ex. Dépose des bungalows au dépôt de Luzancy'})}
   ${champ('titreCourt','Intitulé court (en-tête de page)',{ph:'Repris automatiquement du titre'})}
   ${champ('description','Description des travaux *',{zone:true,ph:'Ce qui est livré ou enlevé, par qui, avec quoi'})}
   <div class="g2">${champ('prot.lieu','Lieu de l’intervention',{liste:cur.type==='marinier'?PROT_LIEUX_MARINIER:PROT_LIEUX})}
   ${champ('prot.adresseChantier','Adresse du chantier',{ph:'Si l’opération n’a pas lieu au dépôt'})}</div>
   <div class="g2">${champ('prot.mode','Type de transport',{liste:PROT_MODES})}
   ${champ('prot.operation','Opération',{liste:PROT_OPERATIONS})}</div>
   <div class="g2">${champ('prot.nature','Nature du transport',{liste:cur.type==='marinier'?PROT_NATURES_MARINIER:PROT_NATURES,vide:'— choisir —'})}
   ${champ('prot.natureDetail','Précision',{ph:'Ex. bungalows nouveaux bureaux'})}</div>
   ${champ('prot.frequence','Fréquence',{liste:PROT_FREQUENCES})}
   <div class="g3">${champ('dateDebut','Date de l’opération *',{type:'date'})}
   ${champ('dateFin','Date de fin')}${champ('duree','Durée')}</div>
   </div>

   <div class="card"><h2><span class="ico">🚛</span>Entreprise intervenante — le transporteur</h2>
   <p class="small muted">Recherche au registre national des entreprises.</p>
   ${champ('prot.transporteurType','Qualité',{liste:PROT_TRANSPORTEUR})}
   <div class="row"><input type="text" id="q-prot" class="grow" placeholder="Nom du transporteur">
     <button class="btn btn-ghost btn-sm" onclick="chercherTransporteur()">🔎 Chercher</button></div>
   <div id="res-prot"></div>
   ${champ('prot.transporteur.nom','Raison sociale *')}
   ${champ('prot.transporteur.adresse','Adresse',{zone:true})}
   <div class="g2">${champ('prot.transporteur.tel','Téléphone')}
   ${champ('prot.transporteur.responsable','Responsable de l’entreprise ou du service')}</div>
   </div>

   <div class="card"><h2><span class="ico">🏢</span>Entreprise utilisatrice — CDES</h2>
   ${champ('agence','Site concerné',{liste:AGENCES.map(a=>({v:a.code,l:a.nom}))})}
   ${carteAgence(ag)}
   <h3>Responsables CDES présents</h3>
   ${champ('encadrement.respTravaux','Responsable de l’opération *',{liste:personnes('redige'),vide:'— choisir —'})}
   ${champ('encadrement.respTravauxTel','Téléphone',{ro:true})}
   ${champ('encadrement.respCdes','Responsable CDES (chef d’agence)',{liste:personnes('valide'),vide:'— choisir —'})}
   ${champ('encadrement.respCdesTel','Téléphone',{ro:true})}
   </div>

   <div class="card"><h2><span class="ico">🧾</span>Historique et approbation</h2>
   <div class="g2">${champ('historique.redacteur','Rédacteur *',{liste:personnes('redige'),vide:'— choisir —'})}
   ${champ('historique.dateRedaction','Date de rédaction',{type:'date'})}</div>
   <div class="g2">${champ('historique.verifiePar','Vérifié par',{ro:true})}
   ${champ('historique.validePar','Validé par',{liste:personnes('valide'),vide:'— choisir —'})}</div>
   </div>`;
}
async function chercherTransporteur(){
  const q=document.getElementById('q-prot').value.trim();const box=document.getElementById('res-prot');
  if(!q){toast('Tape un nom',true);return}
  box.innerHTML='<p class="hint">Recherche…</p>';
  try{
    const r=await fetch('https://recherche-entreprises.api.gouv.fr/search?q='+encodeURIComponent(q)+'&per_page=5');
    const j=await r.json();
    const res=(j.results||[]).map(e=>({nom:e.nom_complet||'',adresse:(e.siege&&e.siege.adresse)||'',siret:(e.siege&&e.siege.siret)||''}));
    if(!res.length){box.innerHTML='<p class="hint">Aucun résultat.</p>';return}
    window.__resProt=res;
    box.innerHTML=res.map((x,i)=>`<div class="ck" onclick="choisirTransporteur(${i})"><span class="bx">›</span>
      <span class="tx"><b>${esc(x.nom)}</b><br><span class="muted small">${esc(x.adresse)}</span></span></div>`).join('');
  }catch(e){box.innerHTML='<p class="hint" style="color:var(--warn)">Registre injoignable. Saisis à la main.</p>'}
}
function choisirTransporteur(i){const x=(window.__resProt||[])[i];if(!x)return;
  cur.prot.transporteur.nom=x.nom;cur.prot.transporteur.adresse=x.adresse;majDoc();renderEtape();toast('Renseigné ✓')}

function etProtMoyens(){
  const j=['lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  return `<div class="card"><h2><span class="ico">🔧</span>Moyens mis en œuvre</h2>
   <p class="small muted">Coche ce qui est effectivement utilisé : le document porte une croix en face.</p>
   <h3>Engins de transport</h3>${cases('prot.engins',PROT_ENGINS,140)}
   ${champ('prot.enginsAutre','Autre (à préciser)')}
   <h3>Moyens logistiques</h3>${cases('prot.logistique',PROT_LOGISTIQUE,190)}
   ${champ('prot.logistiqueAutre','Autre (à préciser)')}
   <h3>Moyens de manutention</h3>${cases('prot.manutention',PROT_MANUTENTION,200)}
   ${champ('prot.manutentionAutre','Autre (à préciser)')}
   <h3>Conditionnement</h3>${cases('prot.conditionnement',PROT_CONDITIONNEMENT,160)}
   </div>
   <div class="card"><h2><span class="ico">📝</span>Mode opératoire</h2>
   <p class="small muted">Qui fait quoi, dans quel ordre, de l’arrivée du camion à son départ.</p>
   ${champ('prot.modeOperatoire','Déroulé de l’opération',{zone:true})}
   </div>
   <div class="card"><h2><span class="ico">🕗</span>Horaires d’accès au site</h2>
   <div class="tbl-wrap"><table><tr><th>Jour</th><th>Matin</th><th>Après-midi</th></tr>
   ${j.map(x=>`<tr><td style="text-transform:capitalize">${x}</td>
     <td><input type="text" value="${esc(HORAIRES_DEFAUT[x].matin)}" oninput="majHoraire('${x}','matin',this.value)"></td>
     <td><input type="text" value="${esc(HORAIRES_DEFAUT[x].apresMidi)}" oninput="majHoraire('${x}','apresMidi',this.value)"></td></tr>`).join('')}
   </table></div>
   ${champ('horairesTexte','Mentions accompagnant les horaires',{zone:true})}
   </div>`;
}

function etProtRisques(){
  const p=cur.prot;
  return `<div class="card"><h2><span class="ico">🎓</span>Habilitations exigées</h2>
   <p class="small muted">Coche celles que l’opération met réellement en jeu.</p>
   ${p.habilitations.map((h,i)=>`<div class="ck ${h.on?'on':''}" onclick="bascProtHab(${i})">
     <span class="bx">${h.on?'✓':''}</span><span class="tx"><b>${esc(h.activite)}</b><br>
     <span class="muted small">${esc(h.habilitations)}</span></span></div>`).join('')}
   <div class="avert info" style="margin-top:10px">La conduite des équipements de manutention lors du
   chargement / déchargement reste réservée au personnel CDES formé et autorisé.</div>
   ${champ('prot.pretMateriel','Prêt de matériel',{zone:true})}
   </div>
   <div class="card"><h2><span class="ico">⚠️</span>Risques liés aux opérations de transport</h2>
   <div class="avert info">${cur.type==='marinier'
     ?'Les sept opérations de la trame mariniers, dans son ordre. Trois sont actives par défaut (déchargement, fournitures, boues de dragage) : active celles que l’opération met en jeu, décoche les autres, ajuste les risques et les mesures. Une opération écartée disparaît du Word.'
     :'Trois opérations, dans l’ordre du document : la circulation sur le site, le chargement / déchargement, puis le transport lui-même. Décoche celles qui ne concernent pas l’opération, ajuste les risques et les mesures.'}
   Une opération absente de la trame s’ajoute en bas : elle sort dans le Word dans un tableau supplémentaire, au même gabarit.</div>
   </div>
   ${p.risques.map((o,oi)=>`<div class="bloc ${o.on?'exp':''}" style="${o.on?'':'opacity:.5'}">
     <div class="bh" style="${o.on?'':'background:#f3f7fb;color:var(--muted)'}">
       <span class="ck-mini ${o.on?'on':''}" onclick="bascProtOp(${oi})">${o.on?'✓':''}</span>
       ${o.libre?`<input class="grow" value="${esc(o.operation)}" placeholder="Nom de l’opération (ex. Amarrage et accostage du bateau)" oninput="majProtOp(${oi},this.value)" onclick="event.stopPropagation()">
         <button class="btn btn-danger btn-xs" onclick="delProtOp(${oi})">✕</button>`
       :`<b>${esc(o.operation)}<span class="sd">Opération ${oi+1} sur ${p.risques.length}</span></b>`}</div>
     ${o.on?`<div class="bb"><div class="sous" style="margin-left:0">
       <h4>Risques liés à l’activité <span class="muted">(${o.risques.filter(r=>r.on).length}/${o.risques.length})</span>
         <button class="btn btn-ghost btn-xs add" onclick="addProtSous(${oi},'risques')">＋</button></h4>
       ${o.risques.map((r,i)=>`<div class="s1 ${r.on?'on':''}"><span class="b" onclick="bascProtSous(${oi},'risques',${i})">${r.on?'✓':''}</span>
         <span class="tt" contenteditable="true" onblur="majProtSous(${oi},'risques',${i},this.innerText)">${esc(r.txt)}</span>
         <button class="x" onclick="delProtSous(${oi},'risques',${i})">✕</button></div>`).join('')}
       <h4>Mesures de prévention applicables <span class="muted">(${o.mesures.filter(m=>m.on).length}/${o.mesures.length})</span>
         <button class="btn btn-ghost btn-xs add" onclick="addProtSous(${oi},'mesures')">＋</button></h4>
       ${o.mesures.map((m,i)=>`<div class="s1 ${m.on?'on':''}"><span class="b" onclick="bascProtSous(${oi},'mesures',${i})">${m.on?'✓':''}</span>
         <span class="tt" contenteditable="true" onblur="majProtSous(${oi},'mesures',${i},this.innerText)">${esc(m.txt)}</span>
         <button class="x" onclick="delProtSous(${oi},'mesures',${i})">✕</button></div>`).join('')}
     </div></div>`:''}
   </div>`).join('')}
   <button class="btn btn-accent btn-block btn-sm" style="margin-top:8px" onclick="addProtOp()">＋ Ajouter une opération absente de la trame</button>`;
}
function addProtOp(){cur.prot.risques.push({operation:'',on:true,libre:true,
  risques:[{txt:'Risque à préciser',on:true}],mesures:[{txt:'Mesure à préciser',on:true}]});majDoc();renderEtape();
  const b=document.querySelectorAll('#etape-body .bloc');const d=b[b.length-1];
  if(d){d.scrollIntoView({behavior:'smooth',block:'center'});const i=d.querySelector('.bh input');if(i)i.focus();}}
function majProtOp(oi,v){cur.prot.risques[oi].operation=v;majDoc()}
function delProtOp(oi){cur.prot.risques.splice(oi,1);majDoc();renderEtape()}
function bascProtHab(i){cur.prot.habilitations[i].on=!cur.prot.habilitations[i].on;majDoc();renderEtape()}
function bascProtOp(oi){cur.prot.risques[oi].on=!cur.prot.risques[oi].on;majDoc();renderEtape()}
function bascProtSous(oi,cle,i){const x=cur.prot.risques[oi][cle][i];x.on=!x.on;majDoc();renderEtape()}
function majProtSous(oi,cle,i,v){const x=cur.prot.risques[oi][cle][i];if(x){x.txt=v.trim();majDoc()}}
function delProtSous(oi,cle,i){cur.prot.risques[oi][cle].splice(i,1);majDoc();renderEtape()}
function addProtSous(oi,cle){cur.prot.risques[oi][cle].push({txt:cle==='risques'?'Nouveau risque':'Nouvelle mesure',on:true});majDoc();renderEtape()}

/* Une seule ligne d'EPI est renseignée : celle du lieu retenu à l'étape
   Transport. Dépôt CDES → ligne « Dépôt CDES ». Chantiers → ligne
   « Chantiers CDES ». Jamais les deux. */
function ligneEpiProtocole(){
  const i=PROT_LIEUX.indexOf(cur.prot.lieu);
  return i<0?0:Math.min(i,PROT_EPI_LIGNES.length-1);
}
function etProtEpi(){
  const li=ligneEpiProtocole();
  return `<div class="card"><h2><span class="ico">🦺</span>Équipements de protection individuelle</h2>
   <div class="avert ok">Lieu retenu : <b>${esc(cur.prot.lieu)}</b> → seule la ligne
   « <b>${esc(PROT_EPI_LIGNES[li])}</b> » est renseignée dans le document. L’autre reste hors sujet
   et n’apparaît pas. Pour la changer, reviens à l’étape Transport.</div>
   <h3>${esc(PROT_EPI_LIGNES[li])}</h3>
   <div class="epigrid">${EPI.map((e,i)=>`<div class="epi ${cur.prot.epi[li][i]?'on':''}" onclick="bascProtEpi(${li},${i})">
     <span class="p">${e.picto}</span><span class="n">${esc(e.nom)}</span></div>`).join('')}</div>
   </div>
   <div class="card"><h2><span class="ico">📌</span>Règles de sécurité majeures</h2>
   ${cur.prot.consignes.map((c,i)=>`<div class="ck ${c.on?'on':''}"><span class="bx" onclick="bascProtConsigne(${i})">${c.on?'✓':''}</span>
     <span class="tx" contenteditable="true" onblur="majProtConsigne(${i},this.innerText)">${esc(c.t)}</span></div>`).join('')}
   <button class="btn btn-ghost btn-block btn-sm" onclick="addProtConsigne()">＋ Règle</button>
   </div>`;
}
function bascProtEpi(li,i){cur.prot.epi[li][i]=!cur.prot.epi[li][i];majDoc();renderEtape()}
function bascProtConsigne(i){cur.prot.consignes[i].on=!cur.prot.consignes[i].on;majDoc();renderEtape()}
function majProtConsigne(i,v){cur.prot.consignes[i].t=v.trim();majDoc()}
function addProtConsigne(){cur.prot.consignes.push({t:'Nouvelle règle',on:true});majDoc();renderEtape()}

/* ============================= GÉNÉRATION ================================= */
/* Plusieurs noms possibles : l'application essaie tous ceux de la liste avant
   d'abandonner, pour ne pas obliger à renommer le fichier au caractère près. */
const TRAMES={
 pdp:['PDP_trame.docx','Trame Plan de prevention.docx','PPSPS_trame.docx'],
 ppsps:['PPSPS_trame.docx','Trame PPSPS 2026.docx','PPSPS.docx'],
 protocole:['Protocole_transport_trame.docx','Trame Protocole Sécurité Transport 2026.docx',
   'Protocole_trame.docx','Protocole.docx'],
 marinier:['Protocole_marinier_trame.docx','Trame Protocole Sécurité Transport 2026 - mariniers.docx'],
 affichage:['Affichage_trame.docx','Trame  Affichage Obligatoire 2026.docx',
   'Trame Affichage Obligatoire 2026.docx']};
/* Deux trames suffisent : le plan de prévention et le PPSPS partagent la même,
   le protocole a la sienne. Une fois chargée, elle est MÉMORISÉE sur l'appareil
   — plus besoin de la redonner à chaque ouverture. */
const SLOT={pdp:'pdp',ppsps:'ppsps',protocole:'protocole',marinier:'marinier',affichage:'affichage'};
const SLOTS=[{k:'affichage',l:'Affichage obligatoire'},
             {k:'pdp',l:'Plan de prévention'},{k:'ppsps',l:'PPSPS'},
             {k:'protocole',l:'Protocole de sécurité'},{k:'marinier',l:'Protocole mariniers'}];
/* La trame déposée à côté du fichier (sur l'intranet) passe TOUJOURS devant la
   copie mémorisée sur l'appareil : remplacer la trame sur le site suffit,
   personne n'a à vider quoi que ce soit. La copie mémorisée sert quand le site
   n'a pas la trame à côté de lui, ou hors connexion — et elle est rafraîchie à
   chaque génération réussie depuis le site. */
async function chargerTrame(type){
  const slot=SLOT[type]||'ppsps';
  for(const nom of TRAMES[type]||[]){
    try{
      const r=await fetch(nom,{cache:'no-cache'});
      if(r.ok){
        const blob=await r.blob();
        const buf=await blob.arrayBuffer();
        zipLire(buf);                       // contrôle avant de rafraîchir la copie
        tramePut(slot,blob).catch(()=>{});
        chargerTrame.source='celle du site ('+nom+')';
        return buf;
      }
    }catch(e){}
  }
  const memo=await trameGet(slot).catch(()=>null);
  if(memo){chargerTrame.source='copie mémorisée sur cet appareil';return await memo.arrayBuffer()}
  throw new Error('Trame Word manquante pour ce document.\n\nVa dans Réglages → Trames Word et '+
    'charge le fichier « '+(TRAMES[type]||[])[0]+' » (ou ta trame équivalente). '+
    'Elle sera mémorisée : tu ne le feras qu’une fois.');
}
async function memoriserTrame(inp,slot){
  const f=inp.files[0];inp.value='';if(!f)return;
  if(!/\.docx$/i.test(f.name)){toast('Il faut un fichier .docx',true);return}
  try{
    const buf=await f.arrayBuffer();
    zipLire(buf);                                  // contrôle : c'est bien un .docx lisible
    await tramePut(slot,f);
    toast('Trame mémorisée ✓');
  }catch(e){toast('Fichier illisible : '+(e.message||e),true)}
  renderReglages();
}
async function oublierTrame(slot){
  if(!confirm('Oublier la trame mémorisée ?'))return;
  await trameDel(slot).catch(()=>{});renderReglages();toast('Trame oubliée');
}
async function testerTrames(){
  const box=document.getElementById('etat-trames');if(!box)return;
  let h='';
  for(const s of SLOTS){
    const memo=await trameGet(s.k).catch(()=>null);
    let fichier=null;
    if(!memo){
      const type=s.k;
      for(const f of TRAMES[type]||[]){
        try{const r=await fetch(f,{method:'HEAD'});if(r.ok){fichier=f;break}}catch(e){}
      }
    }
    const ok=!!(memo||fichier);
    h+=`<div class="fiche ${ok?'':'attention'}" style="margin-bottom:8px">
      <div class="fl raison">${ok?'✅':'⚠️'} <span>${esc(s.l)}</span></div>
      <div class="fl"><span>${memo?'Mémorisée sur cet appareil — <b>'+esc(memo.name)+'</b>'
        :(fichier?'Trouvée à côté de l’application — <code>'+esc(fichier)+'</code>'
        :'<b>Aucune trame.</b> Charge-la ci-dessous, ce sera fait une fois pour toutes.')}</span></div>
      <div class="row" style="margin-top:8px">
        <button class="btn btn-ghost btn-sm grow" onclick="document.getElementById('tf-${s.k}').click()">
          📂 ${memo?'Remplacer':'Charger'} la trame</button>
        ${memo?`<button class="btn btn-danger btn-sm" onclick="oublierTrame('${s.k}')">Oublier</button>`:''}
        <input type="file" id="tf-${s.k}" accept=".docx" style="display:none"
          onchange="memoriserTrame(this,'${s.k}')"></div>
    </div>`;
  }
  box.innerHTML=h;
}
function sansAccent(s){return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[’‘]/g,"'").replace(/[—–]/g,'-')}
function nomFichier(ext){
  const t=TYPES.find(x=>x.code===cur.type)||TYPES[0];
  const n=sansAccent(cur.titre||'document').replace(/[^\w\s'-]/g,'').replace(/\s+/g,' ').trim().slice(0,60);
  return sansAccent(t.court2)+' - '+n+'.'+(ext||'docx');
}
async function genererWord(){
  if(!cur)return;
  if(!cur.titre){toast('Renseigne l’intitulé du chantier',true);return}
  const b=document.getElementById('gen-body');
  b.innerHTML='<div class="grab"></div><h2>Génération…</h2><p class="muted small">Ouverture de la trame, écriture, refermeture.</p>';
  document.getElementById('m-gen').classList.add('open');
  try{
    chargerTrame.source='';
    const buf=await chargerTrame(cur.type);
    const entrees=zipLire(buf);
    const e=entrees.find(x=>x.nom==='word/document.xml');
    const doc=new DOMParser().parseFromString(await zipTexte(e),'application/xml');
    if(doc.querySelector('parsererror'))throw new Error('Trame illisible');
    const donnees=preparerDonnees();
    const journal=estProtocole()?remplirProtocole(doc,donnees):remplirPPSPS(doc,donnees);
    /* les photos de la page de garde : elles ajoutent des fichiers à l'archive,
       il faut donc les traiter avant de refermer le .docx */
    try{
      const images=await dessinsPageDeGarde(entrees,doc);
      const m=illustrations(doc,images);
      if(m)journal.push(m);
      else if((cur.photos||[]).length)journal.push('⚠ photos : aucune n’a pu être relue sur cet appareil');
    }catch(err){journal.push('⚠ photos de la page de garde : '+err.message)}
    try{
      const nl=await logosPageDeGarde(entrees,doc);
      if(nl)journal.push(nl+' logo(s) dans le tableau des intervenants');
    }catch(err){journal.push('⚠ logos des intervenants : '+err.message)}
    try{
      const nc=await logoCouverture(entrees,doc);
      const nh=await logoEntetes(entrees);
      if(nc>0||nh)journal.push('logo du maître d’ouvrage : page de garde'+(nh?' et '+nh+' en-tête(s)':''));
      else if(nc===0)
        journal.push('⚠ pas de logo de maître d’ouvrage (étape Chantier ▸ Logos des intervenants)');
    }catch(err){journal.push('⚠ logo du maître d’ouvrage : '+err.message)}
    e.nouveauTexte=new XMLSerializer().serializeToString(doc);
    let nEnt=0;
    for(const h of entrees.filter(x=>/^word\/header\d+\.xml$/.test(x.nom))){
      const hd=new DOMParser().parseFromString(
        h.nouveauTexte!==undefined?h.nouveauTexte:await zipTexte(h),'application/xml');
      const ti=TYPES.find(x=>x.code===cur.type)||TYPES[0];
      const k=remplirEntete(hd,cur.titreCourt||cur.titre,ti.entete||ti.court);
      if(k){h.nouveauTexte=new XMLSerializer().serializeToString(hd);nEnt+=k}
    }
    if(nEnt)journal.push('en-têtes de page : '+nEnt+' emplacement(s)');
    journal.push('application '+APP_VERSION+' · trame : '+(chargerTrame.source||'?'));
    const word=await zipEcrire(entrees);
    /* Avec des annexes on livre un dossier compressé : Word ne sait pas
       absorber un PDF dans son propre fichier. */
    let blob=word, nom=nomFichier('docx');
    if((cur.annexes||[]).length){
      const fichiers=[{nom:nomFichier('docx'),blob:word}];
      let manquantes=0;
      for(let i=0;i<cur.annexes.length;i++){
        const a=cur.annexes[i];
        const f=await annexeGet(a.id).catch(()=>null);
        if(!f){manquantes++;continue}
        fichiers.push({nom:'Annexes/'+String(i+1).padStart(2,'0')+' - '+
          sansAccent(a.titre||a.nom).replace(/[^\w\s'.-]/g,'').trim()+'.pdf',blob:f});
      }
      blob=await zipSimple(fichiers);
      nom=nomFichier('zip');
      journal.push((fichiers.length-1)+' annexe(s) jointe(s) au dossier'+
        (manquantes?' ('+manquantes+' fichier(s) introuvable(s))':''));
    }
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=nom;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
    const ctl=controles();
    b.innerHTML=`<div class="grab"></div><h2><span class="ico">✅</span>Document généré</h2>
      <p class="small muted">${esc(nom)}</p>
      <div class="card" style="margin-top:10px;box-shadow:none">${journal.map(j=>'<div class="small">✓ '+esc(j)+'</div>').join('')}</div>
      ${ctl.length?'<div class="avert"><b>Points restés ouverts :</b><ul style="margin:6px 0 0;padding-left:18px">'+ctl.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div>':''}
      <div class="avert">Relis le document avant diffusion : l’application remplit, elle ne relit pas à ta place.</div>
      <button class="btn btn-primary btn-block" onclick="fermerModal()">Fermer</button>`;
  }catch(err){
    b.innerHTML=`<div class="grab"></div><h2><span class="ico">⚠️</span>Génération impossible</h2><p>${esc(err.message||String(err))}</p>
      <button class="btn btn-ghost btn-block" onclick="fermerModal()">Fermer</button>`;
  }
}
/* ------------------- affichage obligatoire de chantier ---------------------
   On ouvre la page dans un onglet quand le navigateur l'autorise (impression
   immédiate), et on propose toujours le téléchargement : sur iPhone la
   fenêtre surgissante est souvent bloquée. */
/** Le QR code du lien Maps, en octets PNG, pour l'insérer dans le Word. */
function qrPngOctets(texte,echelle){
  const m=qrEncoder(texte); if(!m)return null;
  const q=4,n=m.length,e=echelle||10,t=(n+2*q)*e;
  const c=document.createElement('canvas');c.width=c.height=t;
  const g=c.getContext('2d');
  g.fillStyle='#fff';g.fillRect(0,0,t,t);g.fillStyle='#000';
  for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(m[y][x])g.fillRect((x+q)*e,(y+q)*e,e,e);
  const bin=atob(c.toDataURL('image/png').split(',')[1]),u8=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
  return u8;
}

/** L'affichage obligatoire en Word : la trame CDES, remplie depuis le document
    courant (plan de prévention, PPSPS ou protocole), avec le QR code du point
    GPS et le logo du maître d'ouvrage. */
async function genererAffichageWord(id){
  if(id){const d=state.docs.find(x=>x.id===id&&!x.supprime);if(d){cur=d;migrer(cur);appliquerAgence();majUrgence()}}
  if(!cur)return;
  if(!cur.titre){toast('Renseigne l’intitulé du chantier',true);return}
  const b=document.getElementById('gen-body');
  b.innerHTML='<div class="grab"></div><h2>Génération…</h2><p class="muted small">Ouverture de la trame d’affichage, écriture, refermeture.</p>';
  document.getElementById('m-gen').classList.add('open');
  try{
    chargerTrame.source='';
    const buf=await chargerTrame('affichage');
    const entrees=zipLire(buf);
    const e=entrees.find(x=>x.nom==='word/document.xml');
    const doc=new DOMParser().parseFromString(await zipTexte(e),'application/xml');
    if(doc.querySelector('parsererror'))throw new Error('Trame d’affichage illisible');
    const a=affDonnees(preparerDonnees());
    const dateJour=frDate(new Date().toISOString().slice(0,10));
    const journal=remplirAffichage(doc,a,dateJour);

    if(a.lat!=null&&a.lon!=null){
      const octets=qrPngOctets(lienMaps(a.lat,a.lon));
      const pQr=paragrapheParTexte(doc,'QR-GPS');
      if(octets&&pQr){
        const rid=await ajouterMedia(entrees,octets,'png');
        const CM=360000;
        ecrireDansParagraphe(pQr,' ');
        pQr.appendChild(runImage(doc,dessinInline(doc,rid,Math.round(4.3*CM),Math.round(4.3*CM),7800,'QR point GPS')));
        centrer(pQr);
        journal.push('QR code du point GPS');
      }
    }else journal.push('⚠ pas de point GPS : pas de QR code (étape Secours ▸ Point GPS)');

    e.nouveauTexte=new XMLSerializer().serializeToString(doc);
    try{ const nh=await logoEntetes(entrees); if(nh)journal.push('logo du maître d’ouvrage'); }catch(err){}
    for(const f of entrees.filter(x=>/^word\/footer\d+\.xml$/.test(x.nom))){
      const txt=f.nouveauTexte!==undefined?f.nouveauTexte:await zipTexte(f);
      if(txt.indexOf('JJ/MM/AAAA')>=0)f.nouveauTexte=txt.split('JJ/MM/AAAA').join(dateJour);
    }
    const word=await zipEcrire(entrees);
    const nom='Affichage obligatoire - '+sansAccent(cur.titre).replace(/[^\w\s'-]/g,'').replace(/\s+/g,' ').trim().slice(0,60)+'.docx';
    const url=URL.createObjectURL(word);
    const aEl=document.createElement('a');aEl.href=url;aEl.download=nom;
    document.body.appendChild(aEl);aEl.click();aEl.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
    b.innerHTML=`<div class="grab"></div><h2><span class="ico">✅</span>Affichage généré</h2>
      <p class="small"><b>${esc(nom)}</b></p>
      <div class="small">${journal.map(j=>'<div>'+(/^⚠/.test(j)?'':'✓ ')+esc(j)+'</div>').join('')}
      <div class="muted" style="margin-top:6px">application ${APP_VERSION} · trame : ${esc(chargerTrame.source||'?')}</div></div>
      <p class="hint">Les noms des SST se complètent à la main, après impression ou dans le Word.</p>
      <button class="btn btn-ghost btn-block" onclick="fermerModal()">Fermer</button>`;
  }catch(err){
    b.innerHTML=`<div class="grab"></div><h2><span class="ico">⚠️</span>Affichage impossible</h2>
      <p>${esc(err.message||String(err))}</p>
      <button class="btn btn-ghost btn-block" onclick="fermerModal()">Fermer</button>`;
  }
}
function fonctionDe(nom){const p=PERSONNES.find(x=>x.nom===nom);return p?p.fonction:''}
function preparerDonnees(){
  majUrgence();
  cur.travauxDangereux=estProtocole()?[]:travauxDangereuxDeduits();  // à jour à la génération
  const d=JSON.parse(JSON.stringify(cur));
  const ag=agenceDe(), t=TYPES.find(x=>x.code===cur.type)||TYPES[0];
  d.typeInfo=t; d.agenceInfo=ag;
  d.historique.qualiteRedacteur=fonctionDe(cur.historique.redacteur)||'Responsable des travaux';
  d.historique.qualiteValideur='Responsable d’agence';
  d.entreprise={raison:ag.raison,adresse:ag.adresse,telephone:ag.tel,
    respCdes:cur.encadrement.respCdes+(cur.encadrement.respCdesTel?' — '+cur.encadrement.respCdesTel:''),
    respTravaux:cur.encadrement.respTravaux+(cur.encadrement.respTravauxTel?' — '+cur.encadrement.respTravauxTel:''),
    effectif:cur.effectifs.cdes};
  d.horaires=cur.horaires||HORAIRES_DEFAUT;
  d.operations=(d.risques.exportes||[]).map(op=>Object.assign({},op,{lignes:(op.lignes||[]).filter(l=>l.on!==false)}))
    .filter(op=>op.lignes.length||op.libre);
  d.risquesEnv=(d.risques.importes||[]).filter(l=>l.on!==false);
  d.coactivite=d.risques.coactivite;
  d.epiEtats=d.epi.map(x=>x.on);
  d.dateDebut=frDate(d.dateDebut);d.dateFin=frDate(d.dateFin);
  d.inspection.dateFr=frDate(cur.inspection.date);
  // la date de l'édition est celle du JOUR de la génération
  d.historique.dateFr=frDate(new Date().toISOString().slice(0,10));
  if(d.sps)d.sps.dateTransmissionFr=frDate(cur.sps.dateTransmission);
  d.annexesListe=(cur.annexes||[]).map(a=>a.titre||a.nom);   // numérotées à l'écriture
  if(!d.organismes)d.organismes={};
  if(!(d.organismes.hse&&d.organismes.hse.nom)&&COORDINATEUR_HSE.nom)d.organismes.hse=JSON.parse(JSON.stringify(COORDINATEUR_HSE));   // V19 : coordinateur QHSE depuis l'annuaire même si l'étape Organismes n'a pas été ouverte
  if(estProtocole()){
    d.prot.epiEtats=d.prot.epi;
    d.prot.epiLigne=ligneEpiProtocole();      // une seule ligne selon le lieu
    d.prot.operationsRetenues=(d.prot.risques||[]).filter(o=>o.on);
    d.prot.habilitationsRetenues=(d.prot.habilitations||[]).filter(h=>h.on);
    d.prot.lieuFinal=d.prot.lieu+(d.prot.adresseChantier?' / '+d.prot.adresseChantier:'');
    d.prot.responsablesCdes=[
      cur.encadrement.respTravaux&&('☒ '+cur.encadrement.respTravaux+
        (cur.encadrement.respTravauxTel?' / '+cur.encadrement.respTravauxTel:'')),
      cur.encadrement.respCdes&&cur.encadrement.respCdes!==cur.encadrement.respTravaux&&
        ('☒ '+cur.encadrement.respCdes+(cur.encadrement.respCdesTel?' / '+cur.encadrement.respCdesTel:''))
    ].filter(Boolean).join('\n');
  }
  Object.keys(d.signataires||{}).forEach(k=>{if(!d.signataires[k].date)d.signataires[k].date='     /      / '+new Date().getFullYear()});
  return d;
}

/* ------------------------------- annexes ---------------------------------- */
function renderBiblio(){
  document.getElementById('biblio-list').innerHTML=BIBLIO.map(f=>`
    <div class="op"><div class="oh"><span class="pic">${f.picto}</span><b style="color:var(--marine)">${esc(f.famille)}</b>
      <span class="muted small" style="margin-left:auto">${f.lignes.length} situation(s)</span></div>
    <div class="ob">${f.lignes.map(l=>`<div class="ligne"><div class="lt"><span class="nm">${esc(l.danger)}</span></div>
      <div class="sous"><h4>Risques</h4>${l.risques.map(r=>'<div class="s1"><span>· '+esc(r)+'</span></div>').join('')}
      <h4>Mesures</h4>${l.mesures.map(m=>'<div class="s1"><span>· '+esc(m)+'</span></div>').join('')}</div></div>`).join('')}
    </div></div>`).join('');
}
function renderReglages(){
  document.getElementById('ver-info').innerHTML='<b>Version '+APP_VERSION+'</b> — '+APP_DATE+'.';
  document.getElementById('agences-list').innerHTML=AGENCES.map(a=>carteAgence(a)+'<div style="height:8px"></div>').join('')
    +'<p class="hint">'+PERSONNES.length+' personnes à l’annuaire · '+PERSONNES.filter(p=>p.redige).length+
    ' peuvent rédiger · '+PERSONNES.filter(p=>p.valide).length+' peuvent valider.</p>';
  const deps=Object.keys(CARNET).sort();
  renderBranchement();
  document.getElementById('carnet').innerHTML=deps.length?('<div class="tbl-wrap"><table><tr><th>Dép.</th><th>Inspection</th><th>CARSAT</th><th>OPPBTP</th></tr>'+
    deps.map(d=>{const c=CARNET[d];const cel=k=>c[k]?esc(c[k].nom)+(c[k].aVerifier?' <span class="badge brouillon">à vérifier</span>':''):'—';
      return `<tr><td><b>${esc(d)}</b></td><td>${cel('inspection')}</td><td>${cel('carsat')}</td><td>${cel('oppbtp')}</td></tr>`}).join('')+'</table></div>')
    :'<p class="hint">Carnet vide.</p>';
  testerTrames();
}
function dl(name,content,type){const b=new Blob([content],{type:type||'text/plain;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(a.href)}
function exportJSON(){dl('sauvegarde-plans-prevention-'+todayISO+'.json',JSON.stringify(state,null,2),'application/json');toast('Sauvegarde téléchargée')}
/* On AJOUTE au lieu de remplacer : charger un exemple ne doit jamais effacer
   le travail en cours. Un document déjà présent (même identifiant) est mis à
   jour, les autres viennent s'ajouter en tête de liste. */
function importJSON(inp){const f=inp.files[0];if(!f)return;const r=new FileReader();
  r.onload=()=>{try{
    const j=JSON.parse(r.result);if(!Array.isArray(j.docs))throw 0;
    if(!confirm('Ajouter '+j.docs.length+' document(s) à ta liste ?\n\nRien ne sera effacé : les documents déjà présents sont mis à jour.'))return;
    let ajoutes=0,majs=0;
    j.docs.forEach(d=>{
      const k=state.docs.findIndex(x=>x.id===d.id);
      if(k>=0){state.docs[k]=d;majs++}else{state.docs.unshift(d);ajoutes++}
    });
    if(j.carnet)Object.assign(CARNET,j.carnet),state.carnet=CARNET;
    save();renderDocs();
    toast(ajoutes+' ajouté(s)'+(majs?' · '+majs+' mis à jour':'')+' ✓');
  }catch(e){toast('Fichier invalide',true)}};r.readAsText(f);inp.value=''}
document.querySelectorAll('.modal').forEach(m=>m.addEventListener('mousedown',e=>{if(e.target===m)fermerModal()}));

/* remplissage des téléphones depuis l'annuaire CDES */
const _ecrire=ecrire;
ecrire=function(ch,val){
  _ecrire(ch,val);
  if(ch==='encadrement.respTravaux'||ch==='encadrement.respCdes'){
    const p=PERSONNES.find(x=>x.nom===val);
    const cle=ch.replace('respTravaux','respTravauxTel').replace('respCdes','respCdesTel');
    const ks=cle.split('.');cur[ks[0]][ks[1]]=p?p.tel:'';
    if(ch==='encadrement.respTravaux'&&!cur.historique.redacteur)cur.historique.redacteur=val;
    majDoc();renderEtape();
  }
};

document.getElementById('logo').src=window.__LOGO__;
document.getElementById('hd-ver').textContent=APP_VERSION;
load();
chargerConf();
if(state.carnet)Object.assign(CARNET,state.carnet);
renderDocs();
syncAuto();
document.querySelector('.barre').style.display='none';
