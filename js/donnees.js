/* ============================================================================
   Données de référence CDES — tout ce qui est « valeur fixe » ou catalogue.
   C'est ici qu'on ajuste sans toucher au reste de l'application.
   ========================================================================= */

const TYPES=[
 {code:'pdp',court:'PDP',court2:'Plan de prevention',nom:'Plan de prévention — entreprise extérieure',
  quand:"CDES intervient sur le site ou le chantier d'un donneur d'ordre. Écrit obligatoire au-delà de 400 h sur 12 mois, ou dès la 1re heure en cas de travaux dangereux.",
  articles:'R.4512-6 à R.4512-12',
  entete:'Plan de Prévention',
  titreDoc:'Plan de Prévention',
  sousTitre:'Etabli en application des articles R.4512-6 à 12 du Code du Travail'},
 {code:'ppsps',court:'PPSPS',court2:'PPSPS',nom:'PPSPS — chantier avec coordination SPS',
  quand:"Chantier de bâtiment ou de génie civil soumis à coordination SPS. Établi par l'entreprise et remis au coordonnateur.",
  articles:'R.4532-56 à R.4532-74',
  entete:'PPSPS',
  titreDoc:'Plan Particulier de Sécurité et de Protection de la Santé',
  sousTitre:'Etabli en application des articles R.4532-56 à 74 du Code du Travail'},
 {code:'protocole',court:'PS',court2:'Protocole de securite',nom:'Protocole de sécurité — transport',
  quand:"Opération de chargement ou de déchargement faisant intervenir une entreprise de transport extérieure.",
  articles:'R.4515-1 à R.4515-11',
  entete:'Protocole de Sécurité',
  titreDoc:'Protocole de Sécurité — Chargement / Déchargement',
  sousTitre:'Etabli en application des articles R.4515-1 à 11 du Code du Travail'}
];

/* --- agences CDES : adresse et téléphone suivent le choix ------------------ */
/* --- agences et annuaire CDES : V2, plus rien d'écrit ici ------------------
   Les adresses, téléphones, responsables d'agence, rédacteurs / valideurs et le
   coordinateur HSE viennent du Référentiel CDES, par le serveur, seulement sur un
   appareil branché (voir appliquerAnnuaire en bas de ce fichier). Sans branchement,
   les agences existent mais sans coordonnées. */
const AGENCES=[
 {code:'IDF',entite:'Agence Île-de-France',nom:'CDES Île-de-France',raison:'CURAGES DRAGAGES ET SYSTEMES (CDES)',adresse:'',tel:'',responsable:'',responsableFonction:'',responsableTel:''},
 {code:'NA',entite:'Agence Nouvelle-Aquitaine',nom:'CDES Nouvelle-Aquitaine',raison:'CURAGES DRAGAGES ET SYSTEMES (CDES) — agence Nouvelle-Aquitaine',adresse:'',tel:'',responsable:'',responsableFonction:'',responsableTel:''},
 {code:'BPL',entite:'Agence Bretagne / Pays de la Loire',nom:'CDES Bretagne — Pays de la Loire',raison:'CURAGES DRAGAGES ET SYSTEMES (CDES) — agence Bretagne / Pays de la Loire',adresse:'',tel:'',responsable:'',responsableFonction:'',responsableTel:''}
];
const PERSONNES=[];
let VERIFICATEUR='';
let HSE_DEFAUT='';
const COORDINATEUR_HSE={nom:'',adresse:'',tel:''};
const MEDECINE_TRAVAIL={nom:'SIST BTP 77 Seine-et-Marne',adresse:'3 rue Aristide Briand\n77100 MEAUX',tel:'01 60 09 80 46'};

/* --- listes déroulantes ---------------------------------------------------- */
const NATURES=['Dragage / Curage','Réhabilitation écologique','Arrachage mécanique','Arrachage / Faucardage',
 'Bathymétrie','Enrochements','Tunage / Génie végétal','Battage de pieux',
 'Maintenance d’équipements','Travaux portuaires','Transport et logistique','Autre'];
const FREQUENCES=['Intervention ponctuelle','Interventions annuelles et répétitives',
 'Interventions annuelles mais non répétitives','Interventions régulières sur l’année'];
const ROLES_EXT=['Entreprise extérieure','Sous-traitant','Co-traitant','Transporteur externe','Intérim','Location avec chauffeur'];

const DEPARTEMENTS=[
 {n:'02',nom:'Aisne'},{n:'08',nom:'Ardennes'},{n:'10',nom:'Aube'},{n:'14',nom:'Calvados'},
 {n:'17',nom:'Charente-Maritime'},{n:'21',nom:'Côte-d’Or'},{n:'22',nom:'Côtes-d’Armor'},
 {n:'27',nom:'Eure'},{n:'28',nom:'Eure-et-Loir'},{n:'29',nom:'Finistère'},{n:'33',nom:'Gironde'},
 {n:'35',nom:'Ille-et-Vilaine'},{n:'37',nom:'Indre-et-Loire'},{n:'41',nom:'Loir-et-Cher'},
 {n:'44',nom:'Loire-Atlantique'},{n:'45',nom:'Loiret'},{n:'49',nom:'Maine-et-Loire'},
 {n:'51',nom:'Marne'},{n:'53',nom:'Mayenne'},{n:'54',nom:'Meurthe-et-Moselle'},{n:'55',nom:'Meuse'},
 {n:'56',nom:'Morbihan'},{n:'57',nom:'Moselle'},{n:'59',nom:'Nord'},{n:'60',nom:'Oise'},
 {n:'62',nom:'Pas-de-Calais'},{n:'67',nom:'Bas-Rhin'},{n:'68',nom:'Haut-Rhin'},
 {n:'72',nom:'Sarthe'},{n:'75',nom:'Paris'},{n:'76',nom:'Seine-Maritime'},{n:'77',nom:'Seine-et-Marne'},
 {n:'78',nom:'Yvelines'},{n:'80',nom:'Somme'},{n:'85',nom:'Vendée'},{n:'89',nom:'Yonne'},
 {n:'91',nom:'Essonne'},{n:'92',nom:'Hauts-de-Seine'},{n:'93',nom:'Seine-Saint-Denis'},
 {n:'94',nom:'Val-de-Marne'},{n:'95',nom:'Val-d’Oise'}
];

/* --- travaux dangereux, arrêté du 19 mars 1993 ----------------------------- */
/* Liste revue par Justin (27/08/2026) : seuls trois travaux de l'arrêté
   concernent réellement les chantiers CDES. La noyade est cochée d'office,
   la chute de plus de 3 m et le bruit se cochent selon le chantier. Tout le
   reste (CMR, agents biologiques — la leptospirose n'en relève pas —, grues,
   soudage, ensevelissement…) est retiré. */
const TRAVAUX_DANGEREUX=[
 {t:'Travaux exposant à des risques de noyade',defaut:true},
 {t:'Travaux exposant les travailleurs à des risques de chute de hauteur de plus de 3 mètres',defaut:false},
 {t:'Travaux exposant à un niveau d’exposition sonore quotidienne supérieure à 90 dB (A) ou à un niveau de pression acoustique de crête supérieure à 140 dB',defaut:false}
];

/* --- horaires et mentions --------------------------------------------------- */
const HORAIRES_DEFAUT={lundi:{matin:'de 09h à 12h',apresMidi:'de 13h à 18h'},
 mardi:{matin:'de 07h à 12h',apresMidi:'de 13h à 18h'},
 mercredi:{matin:'de 07h à 12h',apresMidi:'de 13h à 18h'},
 jeudi:{matin:'de 07h à 12h',apresMidi:'de 13h à 18h'},
 vendredi:{matin:'de 07h à 12h',apresMidi:''},samedi:{matin:'',apresMidi:''}};
const HORAIRES_TEXTE_DEFAUT=
"Aucune intervention n'est autorisée en dehors de ces plages horaires sans validation préalable du responsable des travaux CDES.\n"+
"Toute intervention exceptionnelle (nuit, week-end, jour férié) fait l'objet d'un accord écrit du responsable des travaux et d'une information de l'entreprise utilisatrice.\n"+
"Le travailleur isolé est proscrit en dehors des horaires habituels.";

/* --- moyens matériels et logistique ---------------------------------------- */
const MOYENS_CHAMPS=[
 {k:'electricite',l:'Électricité'},{k:'eclairage',l:'Éclairage de chantier'},
 {k:'eau',l:'Eau'},{k:'communication',l:'Communication'},
 {k:'engins',l:'Engins et matériels mis en œuvre'},{k:'levage',l:'Appareils et accessoires de levage'}
];
const MOYENS_DEFAUT={
 electricite:"Alimentation à partir d'un groupe électrogène portatif.",
 eclairage:"Les engins sont équipés de feux LED en état de fonctionnement. Lampe frontale pour chaque collaborateur.",
 eau:"Les alimentations en eau font partie de l'installation de chantier. Bouteilles ou jerricanes en cas de raccordement impossible au réseau.",
 communication:"Chaque collaborateur possède son téléphone portable. Téléphone + VHF dans les engins et les pousseurs fluviaux.",
 engins:"À préciser selon le chantier (pelle mécanique, ponton, pousseur, fourgon…).",
 levage:"Accessoires de levage contrôlés annuellement (VGP à jour), vérification visuelle avant chaque utilisation."
};
const LOGISTIQUE_CHAMPS=[
 {k:'parking',l:'Stationnement des véhicules du personnel'},
 {k:'vestiaires',l:'Vestiaires, sanitaires, réfectoire'},
 {k:'vehicules',l:'Véhicules affectés au chantier'},
 {k:'dechets',l:'Gestion des déchets sur site'}
];
const LOGISTIQUE_DEFAUT={
 parking:"À proximité de la base vie et de la zone de mise à l'eau, sans gêner la circulation.",
 vestiaires:"CDES utilise sa propre base vie conformément à l'article R.4228-1 du Code du travail, ou les installations de chantier du titulaire du marché.",
 vehicules:"À préciser (immatriculations).",
 dechets:"Récupération des déchets avant de quitter le site. Tri au dépôt CDES. Aucun stockage de produit chimique en extérieur hors bac de rétention."
};

/* --- inspection commune préalable ------------------------------------------ */
const INSTALLATIONS=['Base vie CDES','Base vie mise à disposition par l’entreprise utilisatrice',
 'Sanitaires','Vestiaires','Réfectoire','Point d’eau','Alimentation électrique',
 'Zone de stockage','Aire de stationnement','Aucune installation mise à disposition'];
const INSPECTION_POINTS=[
 'Délimitation du secteur d’intervention',
 'Matérialisation des zones de danger',
 'Voies de circulation des véhicules et des engins',
 'Cheminements piétons et accès au poste de travail',
 'Accès aux installations sanitaires, vestiaires et restauration',
 'Consignes de sécurité propres à l’entreprise utilisatrice, remises',
 'Consignes d’évacuation et point de rassemblement',
 'Moyens de secours, de premiers soins et de lutte contre l’incendie',
 'Réseaux aériens et enterrés — DICT et repérage',
 'Énergies présentes et modalités de consignation',
 'Zones de stockage, de dépôt et d’évacuation des matériaux',
 'Entreprises présentes en simultané et zones de coactivité',
 'Matériels ou engins mis à disposition et convention associée',
 'Contraintes du site : navigation, écluses, marées, crues, faune et flore',
 'Autorisations et permis nécessaires (feu, fouille, navigation)'
];

/* --- coactivité : interférences les plus fréquentes ------------------------ */
const COACTIVITE_TYPE=[
 {danger:'Coactivité entre nos engins et le personnel d’une autre entreprise',
  risques:['Heurt, écrasement d’un piéton','Collision entre engins'],
  mesures:['Zones d’évolution des engins délimitées et interdites aux piétons',
   'Port du vêtement haute visibilité obligatoire pour tous les intervenants',
   'Contact visuel avec le conducteur avant toute approche ; arrêt moteur',
   'Plan de circulation commun affiché à l’entrée de la zone']},
 {danger:'Coactivité sur la voie d’eau avec d’autres usagers ou entreprises',
  risques:['Collision entre matériels flottants','Chute à l’eau'],
  mesures:['Signalisation fluviale réglementaire de la zone de travaux',
   'Information de VNF et des usagers en amont de l’intervention',
   'Veille VHF permanente pendant les manœuvres']},
 {danger:'Travaux simultanés à des niveaux différents (superposition)',
  risques:['Chute d’objets sur le personnel situé en dessous'],
  mesures:['Interdiction de travailler à l’aplomb d’un autre poste',
   'Balisage de la zone située sous les travaux','Décalage des interventions dans le temps']},
 {danger:'Utilisation partagée d’une voie d’accès ou d’une aire de stockage',
  risques:['Encombrement des accès de secours','Collision lors des manœuvres'],
  mesures:['Aires attribuées par entreprise et matérialisées',
   'Accès de secours maintenus libres en permanence',
   'Manœuvres de recul guidées par un second intervenant']},
 {danger:'Interventions générant du bruit ou des poussières à proximité d’autres postes',
  risques:['Exposition sonore des tiers','Gêne respiratoire, perte de visibilité'],
  mesures:['Information préalable des entreprises voisines',
   'Arrosage ou capotage en cas d’émission de poussières',
   'Protections auditives fournies aux intervenants exposés']}
];

/* --- EPI : ordre exact des pictogrammes de la trame ------------------------ */
const EPI=[
 {nom:'Gilet haute visibilité',picto:'🦺',defaut:true,note:'Hors travaux par point chaud'},
 {nom:'Chaussures de sécurité',picto:'🥾',defaut:true},
 {nom:'Gants',picto:'🧤',defaut:true},
 {nom:'Gilet de sauvetage',picto:'🛟',defaut:true},
 {nom:'Casque',picto:'⛑️',defaut:true},
 {nom:'Lunettes de protection',picto:'🥽',defaut:true},
 {nom:'Protections auditives',picto:'🎧',defaut:true}
];

/* --- consignes -------------------------------------------------------------- */
const CONSIGNES_GENERALES=[
 "Accès du chantier strictement interdit à toute personne étrangère au chantier",
 "Respect des dispositifs de sécurité en place (balisage lors des déchargements, EPC, risque de noyade…)",
 "Suivre les règles de circulation des personnes et des engins sur les lieux de travail",
 "Assurer l'ordre et la propreté du chantier et des équipements",
 "Interdiction aux personnes non habilitées d'accéder aux armoires électriques, de conduire des engins ou de manipuler des produits dangereux",
 "Ne pas stocker de produits chimiques en extérieur hormis dans des bacs de rétention spécifiques"
];
const CONSIGNES_PARTICULIERES=[
 "Les véhicules stationneront dans le périmètre du chantier à proximité de la base vie",
 "Le personnel se rendra sur le chantier au moyen des véhicules de l'entreprise identifiés",
 "Il est interdit aux piétons d'être présents dans les zones d'évolution des engins — se signaler au conducteur pour qu'il coupe le moteur",
 "Le port du gilet de sauvetage est obligatoire à proximité et sur l'eau",
 "Pas de port de ceinture s'il y a un risque de chute à l'eau de l'engin",
 "Tous les engins, bateaux et camions sont équipés d'extincteurs contrôlés annuellement",
 "Le balisage et la signalisation fluviale réglementaires de la zone de travaux sont mis en place",
 "Le stationnement des matériels flottants hors des heures de travail est sécurisé, amarrage vérifié",
 "Une réunion sécurité hebdomadaire est organisée sur le chantier avec le conducteur de travaux, le responsable de chantier et les ouvriers"
];
const VISITE_MEDICALE_DEFAUT=
"L'ensemble des collaborateurs intervenant sur le chantier dispose d'une visite d'information et de prévention à jour. "+
"Les salariés affectés à des postes soumis à un suivi individuel renforcé (conduite d'engins, travaux à proximité de l'eau) "+
"bénéficient d'un examen d'aptitude périodique auprès du service de prévention et de santé au travail.";

/* ============================================================================
   PROTOCOLE DE SÉCURITÉ — c'est un document à part : CDES y est l'entreprise
   UTILISATRICE (elle reçoit), le transporteur est l'entreprise intervenante.
   Ni inspection commune, ni organismes de prévention, ni familles d'activité
   chantier : on raisonne en moyens de transport et en opérations.
   ========================================================================= */
const PROT_LIEUX=['Dépôt CDES Luzancy','Chantiers CDES'];
const PROT_TRANSPORTEUR=['Entreprise de transport','Transporteur sous-traitant'];
const PROT_MODES=['Routier (terrestre)','Fluvial / Maritime'];
const PROT_OPERATIONS=['Chargement','Déchargement','Chargement et déchargement'];
const PROT_NATURES=['Livraison de fournitures industrielles','Livraison de matériaux',
 'Enlèvement de déchets','Transfert d’engins ou de matériels','Livraison de carburant ou de produits chimiques','Autre'];
const PROT_FREQUENCES=['Opération ponctuelle',
 'Opérations répétitives (localisation unique, matériaux et équipements identiques)',
 'Opérations régulières sur l’année'];
const PROT_ENGINS=['PL','Bateau','Tracteur','Grue mobile'];
const PROT_LOGISTIQUE=['Porte-engin','Cale, caisson, fourgon','Benne basculante','Benne Ampliroll'];
const PROT_MANUTENTION=['Pelle mécanique / engins TP','Chariot élévateur','Grue auxiliaire'];
const PROT_CONDITIONNEMENT=['Vrac','Colis / palettes','Engin arrimé'];
const PROT_HABILITATIONS=[
 {activite:'Conduite d’un PL dans le cadre des opérations de transport',habilitations:'Permis PL + formation FCO en cours de validité'},
 {activite:'Conduite d’un bateau Freycinet dans le cadre des opérations de transport',habilitations:'Permis fluvial (capitaine de navigation)'},
 {activite:'Conduite d’un engin de manutention (engins TP, engins logistique, grue auxiliaire)',habilitations:'Formation CACES correspondant à la catégorie de l’engin + autorisation de conduite'},
 {activite:'Transport de produits chimiques dangereux, déchets dangereux',habilitations:'Agrément transporteur ADR'}
];
/* Les libellés ci-dessous sont ceux de la trame de Justin, mot pour mot :
   c'est ce qui permet de cocher les cases existantes au lieu d'en rajouter. */
const PROT_RISQUES=[
 {operation:'Accès et circulation dans l’enceinte de l’entreprise et sur les chantiers',
  risques:[{t:'Heurt / écrasement de piétons',on:true},
   {t:'Collision engins / véhicules',on:true},
   {t:'Chute à proximité des plans d’eau',on:false}],
  mesures:[{t:'Port des vêtements haute visibilité obligatoire (coactivité)',on:true},
   {t:'Ne pas stationner dans des zones à risque, ne pas empiéter les voies de circulation. Ne pas s’arrêter sur les voies piétonnes (dépôt)',on:true},
   {t:'Respecter le plan de circulation au dépôt',on:true},
   {t:'Interdiction d’approcher à moins de 2m des berges ou d’un plan d’eau sauf autorisation',on:false},
   {t:'Baliser la zone d’intervention si coactivité.',on:true},
   {t:'Ne pas descendre du véhicule avant autorisation du responsable CDES',on:true},
   {t:'Téléphone au volant interdit dans l’enceinte du site',on:true}]},
 {operation:'Chargement / déchargement : manœuvre d’engins et opérations de levage',
  risques:[{t:'Collision / heurt / écrasement',on:true},
   {t:'Présence de piétons en zone dangereuse',on:true},
   {t:'Chute de charge',on:true},
   {t:'Mauvais élingage',on:true},
   {t:'Renversement de l’engin de manutention',on:false}],
  mesures:[{t:'Interdiction de stationner sous charge. Ne pas entrer dans une zone de manœuvre. Respecter une distance de sécurité > 3m avec les engins.',on:true},
   {t:'Adéquation de l’engin de manutention pour le déchargement (chariot, pelle mécanique, grue)',on:true},
   {t:'Habilitations et formations pour les conducteurs d’engins',on:true},
   {t:'Chargement / déchargement réalisé par du personnel CDES',on:true},
   {t:'Utilisation de matériel de levage conforme (VGP). Contrôle visuel systématique.',on:true},
   {t:'Port du casque obligatoire à proximité des zones de manœuvre (cour extérieure) et vêtements haute visibilité.',on:true},
   {t:'Balisage et interdiction d’accès aux zones dangereuses (coactivité)',on:true},
   {t:'Le chauffeur reste en cabine ou dans la zone d’attente matérialisée pendant l’opération',on:true}]},
 {operation:'Transport de fournitures / petits matériels',
  risques:[{t:'Chute d’objets liés à un mauvais conditionnement',on:true},
   {t:'TMS liés au port de charges',on:true},
   {t:'Écrasement des membres lors de la manutention',on:false}],
  mesures:[{t:'Prioriser toujours un moyen de manutention mécanique pour le chargement / déchargement',on:true},
   {t:'Vérifier l’arrimage des charges dans les véhicules, sur les palettes.',on:true},
   {t:'Vérifier l’état des supports de stockage utilisés (palettes…)',on:true},
   {t:'Port des gants et des chaussures de sécurité',on:false}]}
];
const PROT_SECOURS={
 sst:'Liste SST dans les bases vie + panneau entrée CDES\nTrousse de secours salle de pause Atelier Dépôt CDES + fourgons des collaborateurs CDES',
 pollution:'Moyens anti-pollution à disposition au dépôt CDES\nAbsorbants dans les cuves de GNR des engins',
 incendie:'Plusieurs extincteurs dans le dépôt CDES (plan)\nExtincteurs dans les cabines des engins CDES'};
/* EPI par défaut du protocole, dans l'ordre de la trame : gilet HV, chaussures,
   gants, casque. Le gilet de sauvetage se coche pour les chantiers en bord d'eau. */
const PROT_EPI_DEFAUT=[true,true,true,false,true,false,false];

const PROT_MODE_OPERATOIRE_DEFAUT=
"Le mode opératoire ci-dessous définit les actions à réaliser par le transporteur et par CDES, dans l'ordre :\n"+
"1. Arrivée du transporteur, présentation au responsable CDES, remise du présent protocole.\n"+
"2. Positionnement du véhicule sur la zone matérialisée, moteur coupé, frein de parking serré.\n"+
"3. Mise en place du balisage de la zone d'évolution ; le chauffeur se place en zone d'attente.\n"+
"4. Opération de chargement ou de déchargement par le personnel CDES formé et autorisé.\n"+
"5. Contrôle de l'arrimage et de la conformité du chargement avant départ.\n"+
"6. Retrait du balisage et départ du véhicule après accord du responsable CDES.";
const PROT_CONSIGNES=[
 "Accès du site strictement interdit à toute personne étrangère à l'opération",
 "Suivre les règles de circulation des personnes et des engins sur les lieux de travail",
 "Il est interdit aux piétons d'être présents dans les zones d'évolution des engins — se signaler au conducteur",
 "Si je ne suis pas habilité et formé, je ne conduis pas d'engins",
 "Ne pas stocker de produits chimiques en extérieur hormis dans des bacs de rétention spécifiques",
 "Tous les engins, bateaux et camions sont équipés d'extincteurs contrôlés annuellement",
 "Assurer l'ordre et la propreté du site et des équipements"
];
const PROT_PRET_MATERIEL=
"Aucun prêt de matériel ou d'engin ne sera autorisé par l'entreprise CDES. Tout prêt exceptionnel "+
"devra faire l'objet d'une convention écrite préalable entre les parties.";

/* --- PPSPS : ce que le plan de prévention n'a pas ------------------------- */
const PPSPS_CATEGORIES=[
 'Catégorie I — opération soumise à collège interentreprises (CISSCT)',
 'Catégorie II — opération soumise à PGC',
 'Catégorie III — opération avec coordination simple'];
const PPSPS_AVIS=['Avis du médecin du travail sollicité','Avis du CSE sollicité',
 'PPSPS transmis au coordonnateur SPS','PPSPS tenu à disposition sur le chantier',
 'PGC pris en compte','Registre-journal de la coordination consulté'];

/* ============================================================================
   CE QUI DISTINGUE VRAIMENT LES TROIS DOCUMENTS
   Le parcours de saisie n'est plus le même : chaque type a ses étapes.
   ========================================================================= */
const ETAPES_PAR_TYPE={
 pdp:      ['Chantier','Organismes','Organisation','Inspection commune','Risques','EPI & consignes','Secours & signatures','Annexes'],
 ppsps:    ['Chantier','Organismes','Coordination SPS','Organisation','Inspection commune','Risques','EPI & consignes','Secours & signatures','Annexes'],
 protocole:['Transport','Moyens & mode opératoire','Risques transport','EPI & consignes','Secours & signatures','Annexes']
};

/* --- plan de prévention : diffusion et information (R.4514-1 à 3) ---------- */
const PDP_DIFFUSION=[
 {t:'Plan de prévention tenu à disposition de l’inspection du travail sur le lieu de travail',on:true},
 {t:'Plan de prévention tenu à disposition des agents de prévention de la CARSAT et de l’OPPBTP',on:true},
 {t:'Médecins du travail des deux entreprises informés de la date de l’inspection commune',on:true},
 {t:'CSE des deux entreprises informés de la date de l’inspection commune et invités à y participer',on:true},
 {t:'Inspection du travail avisée : opération de plus de 400 heures sur 12 mois',on:false},
 {t:'Inspection du travail avisée : travaux figurant sur la liste de l’arrêté du 19 mars 1993',on:false}
];

/* --- PPSPS : la coordination SPS, absente du plan de prévention ------------ */
const PPSPS_DIFFUSION=[
 {t:'PPSPS adressé au coordonnateur SPS avant le début des travaux',on:true},
 {t:'PPSPS tenu à disposition sur le chantier pendant toute la durée du chantier',on:true},
 {t:'PGC (plan général de coordination) communiqué par le coordonnateur et pris en compte',on:true},
 {t:'Registre-journal de la coordination consulté',on:true},
 {t:'Avis du médecin du travail sollicité avant transmission (R.4532-56)',on:false},
 {t:'Avis du CSE sollicité avant transmission (R.4532-56)',on:false},
 {t:'PPSPS conservé 5 ans à compter de la réception de l’ouvrage',on:true},
 {t:'Opération de catégorie I : PPSPS adressé à l’inspection du travail, à la CARSAT et à l’OPPBTP',on:false}
];

/* --- protocole : rien de tout cela, mais des mentions qui lui sont propres -- */
const PROT_DIFFUSION=[
 {t:'Protocole établi avant la première opération et remis au transporteur',on:true},
 {t:'Protocole tenu à disposition sur le site pendant toute la durée des opérations',on:true},
 {t:'Protocole reconduit tant que les conditions de l’opération restent inchangées (R.4515-6)',on:true},
 {t:'Toute modification des conditions de travail fait l’objet d’une mise à jour du protocole',on:true},
 {t:'Protocole tenu à disposition de l’inspection du travail et de la CARSAT',on:true}
];

const PROT_EPI_LIGNES=['Dépôt CDES','Chantiers CDES'];
const PROT_SIGNATAIRES=['Entreprise Utilisatrice','Entreprise de transport','Sous-Traitant n°1'];
const PDP_SIGNATAIRES=['Entreprise Extérieure','Entreprise Utilisatrice'];
/* Le PPSPS n'est pas un accord entre deux entreprises : c'est un document que
   l'entreprise intervenante établit et remet au coordonnateur SPS. Elle seule
   le signe. */
const PPSPS_SIGNATAIRES=['Entreprise intervenante'];
function signatairesDe(type){
  return type==='protocole'?PROT_SIGNATAIRES:(type==='ppsps'?PPSPS_SIGNATAIRES:PDP_SIGNATAIRES);
}

/* ============================================================================
   AFFICHAGE OBLIGATOIRE DE CHANTIER
   Valeurs fixes reprises de la trame « Affichage Obligatoire 2026 ». Tout ce
   qui est propre au chantier vient du plan de prévention.
   ========================================================================= */
const AFFICHAGE={
 correspondantRH:{nom:'',tel:''},          // V2 : vient du Référentiel (appliquerAnnuaire)
 defenseurDroits:{adresse:'Défenseur des droits, Libre réponse 71120, 75342 Paris CEDEX 07',
   tel:'09 69 39 00 00',ref:'Code du travail D. 1151-1'},
 referentHarcelement:{titre:'Référent « lutte contre le harcèlement sexuel et les agissements sexistes » désigné par l’employeur',
   ref:'Code du travail L. 1153-5-1 et D. 1151-1',
   nom:'',tel:'',                             // V2 : vient du Référentiel (appliquerAnnuaire)
   adresse:'CDES — Chemin de l’Usine, 77138 Luzancy'},
 conges:{ref:'Code du travail D. 3141-6 et D. 3141-28',
   periode:'Voir CNETP',
   ordre:'L’ordre des départs est défini chaque année en tenant compte des souhaits de chacun et '+
     'des impératifs des services. En cas de désaccord entre les salariés, l’ordre tiendra compte : '+
     'de la situation de famille des bénéficiaires (présence d’enfants scolarisés à charge, '+
     'possibilités de congé du conjoint) ; de l’ancienneté du salarié dans l’entreprise ; '+
     'de l’activité éventuelle du salarié chez un ou plusieurs autres employeurs.'},
 consultation:[
  {doc:'Document unique d’évaluation des risques professionnels (DUERP)',ref:'Code du travail R. 4121-1 à 4',
   ou:'Bureau HSE, classeur en version papier — consultable à la demande'},
  {doc:'Règlement intérieur',ref:'L. 1321-1 à 4 et R. 1321-1',
   ou:'Bureaux RH — consultable de 9h à 12h et de 13h à 17h, diffusé à l’ensemble des collaborateurs'},
  {doc:'Accords collectifs et convention collective',ref:'L. 2262-5, R. 2262-1 à 3',
   ou:'Bureaux RH — consultable de 9h à 12h et de 13h à 17h, diffusé à l’ensemble des collaborateurs'}],
 tabac:{ref:'Code de la santé publique R. 3512, R. 3513 et R. 3515',
   consignes:['Interdiction de fumer dans les locaux CDES',
    'Emplacement fumeurs à l’entrée des bureaux (extérieur)',
    'Sur les chantiers, à proximité des bases vie, à l’extérieur']},
 sst:{ref:'Code du travail R. 4141-3-1',lignes:4},
 urgences:[{n:'18',q:'Pompiers'},{n:'15',q:'SAMU'},{n:'112',q:'Numéro européen'},
   {n:'17',q:'Police / Gendarmerie'}],
 refs:{horaires:'Code du travail D. 3171-1 et suivants',
   inspection:'Code du travail D. 1151-1 et D. 4711-1',
   medecine:'Code du travail D. 1151-1 et D. 4711-1',
   incendie:'Code du travail R. 4227-37'}
};

const BIBLIO=[{"famille":"Installation du chantier","lignes":[{"danger":"Arrivée sur le chantier / Stationnement des engins, véhicules terrestres et matériel","risques":["Choc, collision engin / véhicule / piéton"],"mesures":["Vigilance circulation véhicules, piétons, cyclistes","Signalétique à mettre en place – balisage du lieu de lieu de travail +","mise en place des panneaux de chantiers (Danger Travaux…)","Port des vêtements haute visibilité obligatoire sur le chantier","Respect des vitesses de circulation sur les voiries et chemins de halage","Le stationnement ne doit pas encombrer les axes de circulation, les voies piétonnes, les chemins de service","La voirie doit rester propre pendant le déroulement du chantier"]},{"danger":"Arrivée sur le chantier / chute à l’eau en véhicules ou en engins","risques":["Noyade","Renversement d’un engin à l’eau"],"mesures":["Respect des vitesses de circulation sur les voiries et chemins de halage","Présence d'un marteau brise-glace et d'un coupe ceinture dans chaque véhicule et engins. Circuler vitre ouverte aux abords des plans d’eau.","Port du gilet de sauvetage obligatoire à proximité ou sur l’eau"]},{"danger":"Utilisation d’engin pour levage, transport et mise à l’eau du matériel (fournitures, équipements de travail)","risques":["Ecrasement","Chutes d’objets","Blessures musculaires ou fractures liés aux opérations d’élingage","Electrisation par arc suite à présence de  ligne électrique aérienne"],"mesures":["Balisage et restriction d’accès à la zone de travail pendant les opérations de chargement / déchargement","Contrôle du bon état du matériel avant utilisation. Engins et accessoires de levage soumis à VGP périodiques.","Contrôle préalable du bon état des organes de sécurité (signal de recul, klaxon, marchepied en bon état, rétroviseur, extincteur)","CACES et autorisation de conduite des conducteurs internes et","externes à présenter pour la conduite des engins de levage","Port des EPI pendant les opérations de levage : vêtements haute visibilité, casque de protection, gants de manutention pour l’élingage","Respect des 3 points d’appui pour la montée et descente des engins","Vérification de l’adéquation entre charge à lever et charge maximale","d’utilisation des équipements de levage","Interdiction de stationner ou circuler sous les charges sans étayage","Utilisation obligatoire des moyens de retenue (ceinture de sécurité,","porte de l’engin fermée) pendant l’opération","Rédaction et vérification des DICT. Respect des distances de sécurité avec réseaux électriques aériens","Protocole de chargement/déchargement si intervenants externes","Vigilance avec les usagers des cours d’eau"]},{"danger":"Transport des fournitures sur le chantier, déchargement des bennes.","risques":["Heurt, écrasement lors du déchargement (chute d’objet)","Proximité avec une ligne électrique haute tension (électrocution…)"],"mesures":["Le conducteur d’engin qui gère le déchargement doit être titulaire d’un CACES et autorisation de conduite délivrée par l’entreprise intervenante.","Zone de déchargement des fourniture identifiée et balisée.","Respect des distances de sécurité lors de l’ouverture des bennes levantes","La zone de déchargement et la voie d’accès ne doit pas se trouver sous la ligne aérienne haute tension"]},{"danger":"Manutentions manuelles pour le déchargement du petit matériel (chaines de manutention, bidons, équipements anti-pollution…)","risques":["Lombalgie","Choc, écrasement","Blessures diverses"],"mesures":["Toujours prioriser le recours à un équipement mécanique de manutention","Respect des bonnes pratiques en matière de gestes et postures :","se rapprocher le plus possible de la charge","rechercher des appuis stables","travail avec la force des cuisses","maintenir droite la colonne vertébrale","Port de charges à deux ou plusieurs","Port de chaussures de sécurité, gants de manutention et casques"]},{"danger":"Montage et démontage des matériels (souvent à la pelle hydraulique ou camion grue auxiliaire Montage de la pelle sur ponton et Arrimage de la pelle sur le ponton à l’aide de 6 chaines de 10T de résistance -  Neutralisation des chenilles","risques":["Ecrasement coincement","Chutes de charges","Blessures musculaires ou fractures","Renversement de la pelle à l’eau","Chute à l’eau de l’operateur","Lumbago"],"mesures":["Vigilance du conducteur","Pas de piétons dans la zone d’évolution des engins","Amarrage conséquent du ponton à la berge","Privilégier la manipulation des axes d’assemblage à l’aide d’un moyen","de manutention mécanique","Privilégier l’assemblage des faucardeurs à l’aide d’un moyen de","manutention mécanique","Port des EPI (gants, casque, gilet de sauvetage, vêtement HV)","Gestes et postures"]}],"picto":"🚧"},{"famille":"Travaux de dragage","lignes":[{"danger":"Mise en place du matériel : Assemblage du ponton flottant, montage de la pontage sur le ponton","risques":["Ecrasements, chocs, heurts lors de la manutention des éléments matériels","Renversement de la pelle à l’eau","Chute à l’eau, du collaborateur","Risques liés aux manutentions manuelles lors de l’assemblage"],"mesures":["Zone de mise à l’eau définie et sécurisée pour le déchargement","EPI : Port du gilet de sauvetage pour travailler sur et à proximité d’un plan d’eau. Port des gants, chaussures de sécurité et casque de protection.","Respect des rayons d’interdiction d’évolution autour des engins. Ne pas passer sous les charges lors des déchargements.","Travail à plusieurs pour l’assemblage du ponton et des barges. Pas de manutention manuelle des équipements lourds. Contrôle visuel de l’état des chaînes de levage avant élingage.","Montée et descente des engins camion– 3 points d’appui","Mode opératoire interne pour la montage de la pelle sur ponton"]},{"danger":"Travaux de dragage mécanique (pelle hydraulique sur ponton)","risques":["Heurt entre la pelle et un autre équipement","Renversement de la pelle à l’eau","Chute à l’eau, du collaborateur","Piqures d’insecte"],"mesures":["Formation CACES pour la conduite de l’engin + autorisation de conduite délivrée par l’employeur","Pelle soumis à VGP tous les 6 mois + entretiens réguliers","Vérification du brêlage de la pelle sur le ponton (6 chaînes obligatoires)","EPC (équipement de protection collective) : Barque avec rames, bouée couronne avec une ligne de jet, passerelle en bon état, extincteur dans la cabine de la pelle + marteau brise vitre","Vigilance à la stabilité des sols avant d’évoluer avec les engins de TP","EPI : Port du gilet de sauvetage pour travailler sur l’eau (sur le ponton et sur les bateaux)","Respect des rayons d’interdiction d’évolution autour des engins : Conducteur de camion ou Freyssinet ne doivent pas se trouver à proximité des zones de chargement déchargement","Montée et descente des engins camion– 3 points d’appui","Communication radio (VHF) entre le pelleur au dragage et les autres collaborateurs sur le chantier","Vigilance avec les usagers des cours d’eau. Pas de coactivité avec les usagers du cours qui sortent du tunnel de navigation (distance avec la zone de travaux)"]},{"danger":"Transport fluvial (pousseur fluvial + barges)","risques":["Heurt avec un équipement ou un usager de la voie d’eau lors de la conduite du pousseur","Chute à l’eau, du collaborateur","Manutentions manuelles, chute de plain-pied lors de l’amarrage des barges","Exposition au bruit"],"mesures":["Permis Fluvial PC pour la conduite d’un pousseur + autorisation de conduite délivrée par l’employeur","Entretiens réguliers / maintenances de nos pousseurs + passage des communautaires réglementaires","EPC (équipement de protection collective) : bouée couronne avec une ligne de jet, gaffe, extincteur dans la cabine du pousseur","EPI : Port du gilet de sauvetage pour travailler sur l’eau (sur le ponton et sur les bateaux), gants de protection pour manipuler les câbles de treuil, protections auditives obligatoires","Vérification quotidienne de l’état des cordes d’amarrage","Communication radio (VHF) entre le pelleur au dragage et le conducteur du pousseur fluvial","Vigilance avec les usagers des cours d’eau. Pas de coactivité avec les usagers du cours d’eau"]},{"danger":"Transbordement : déchargement des barges + chargement des PL avec bennes étanches au moyen d’une pelle mécanique","risques":["Heurt avec la pelle, chute et projection de matériaux lors du chargement / déchargement","Renversement de la pelle à l’eau / Chute à l’eau, du collaborateur"],"mesures":["Formation CACES pour la conduite de l’engin + autorisation de conduite délivrée par l’employeur","Pelle soumis à VGP tous les 6 mois + entretiens réguliers périodiques","EPC (équipement de protection collective) : bouée avec une ligne de jet à proximité de la zone de déchargement, extincteur dans la cabine de pelle + marteau brise vitre","EPI : Port du gilet de sauvetage au transbordement","Respect des rayons d'interdiction d’évolution autour des engins en particulier par les chauffeurs PL sur le chantier.","Port obligatoires des EPI par les chauffeurs PL sur le chantier : vêtements haute visibilité, casque de protection, chaussures de sécurité.","Protocole de chargement déchargement avec nos apporteurs","Respect de la procédure interne de transbordement pour le déchargement des boues de dragage","Montée et descente des engins camion– 3 points d’appui","Délimitation des zones d’attente, circulation, retournement des camions","Nettoyage régulier de la zone de déchargement pour éviter les glissades"]}],"picto":"⚓"},{"famille":"Travaux d’enrochements","lignes":[{"danger":"Mise en place des enrochements au moyen d’une pelle mécanique sur ponton flottant","risques":["Risque de heurt, collision lié à la coactivité avec des engins / chute d’un enrochement","Renversement de la pelle à l’eau","Chute à l’eau du collaborateur","Chute en montant dans la machine"],"mesures":["Equipements de Protection Collective sur nos installations (pontons…) : bouée couronne avec une ligne de jet, passerelle en bon état, barque de secours","EPI : Port du gilet de sauvetage pour travailler sur l’eau et sur les berges.","Formations des collaborateurs CDES à l’utilisation des équipements de protection contre le risque de noyage","Port du casque obligatoire à proximité des engins et lors des opérations de manutention mécanique","Respect des rayons d'interdiction d’évolution autour des engins, immobilisation des machines avant toutes opérations d'amarrages","Vigilance avec les usagers des cours d’eau.","Montée et descente des engins – 3 points d’appui. Chaussures montantes obligatoires (maintien de la cheville)","Contrôle visuel de la stabilité / état de la berge avant la mise en place de la pelle pour le déchargement","Engins soumis à Vérifications Générales Périodiques tous les 6 mois + suivi des entretiens réguliers","Contrôle préalable du bon état des organes de sécurité sur la machine (signal de recul, klaxon, marchepied, rétroviseur, présence extincteur)","Rédaction et vérification des DICT / Respect des distances de sécurité avec réseaux électriques aériens","CACES et Autorisation de conduite pour tous les conducteurs d’engins présents sur le chantier"]},{"danger":"Livraison des enrochements par voie fluviale (bateaux Freycinet). Déchargement depuis la cale du bateau au moyen d’une pelle mécanique","risques":["Risques liés à la navigation : collision avec un tiers.","Chute à l’eau du marinier lors du déchargement / amarrage / circulation sur plat bord","Risque de heurt avec le bras de pelle lors du déchargement","Blessures physiques lors des travaux manuels  (amarrage…)"],"mesures":["Equipements de Protection Collective sur le bateau : bouée couronne avec une ligne de jet, extincteur, ligne de vie, barque","EPI : Port du gilet de sauvetage obligatoire pour travailler sur l’eau et circuler sur le plat bord. Port des gants pour manipuler les cordes.","Formations des collaborateurs CDES à l’utilisation des équipements de protection contre le risque de noyage","Respect des rayons d'interdiction d’évolution autour des engins, en particulier avec la pelle lors du déchargement (distance de sécurité)","Vigilance avec les usagers des cours d’eau. Signalisation visuelle et sonore (feux de navigation fonctionnels…)","Amarrage obligatoire du bateau au ponton pour assurer la stabilité et contrôle quotidien des cordes","VHF obligatoire dans la cabine du bateau (communication)","Permis Fluvial + Autorisation de conduite pour conduire nos bateaux"]}],"picto":"🪨"},{"famille":"Faucardage / Arrachage manuel","lignes":[{"danger":"Travaux de Faucardage (utilisation des faucardeurs, ramassage des herbes, déchargement…) Travaux d’arrachage manuel (arrachage des herbes, ramassage, chargement dans contenant et déchargement.)","risques":["Ecrasement, chocs","Coupures","Piqures insecte","Lumbagos","Chute à l’eau","Ecrasement, chocs","blessures suite à utilisation d’outils (râteaux...)","Piqures insecte , morsures, risque biologique (leptospirose)","Lumbagos","Chute à l’eau , trébuchement dans l’eau"],"mesures":["Pas de piéton dans la zone d’évolution des engins vers les berges","Peigne au sol lors des dépôts d’herbe","Respect des bonnes pratiques en matière de gestes et postures :","se rapprocher le plus possible de la charge","rechercher des appuis stables","travail avec la force des cuisses","maintenir droite la colonne vertébrale","Port de charges à deux ou plusieurs","Port de chaussures de sécurité, gants de manutention, casques, gilet","de sauvetage","Vigilance avec les usagers des cours d’eau","Respect de la procédure de transbordement","Respect des bonnes pratiques en matière de gestes et postures :","-      se rapprocher le plus possible de la charge","-      rechercher des appuis stables","-      travail avec la force des cuisses","-      maintenir droite la colonne vertébrale","Port de charges à deux ou plusieurs","Port Waders, port du gilet de sauvetage","Respecter les consignes d’hygiène","Ne jamais être seul sur le chantier"]}],"picto":"🌾"},{"famille":"Arrachage mécanique des espèces exotiques envahissantes","picto":"🌿","lignes":[{"danger":"Assemblage du ponton flottant / Montage et arrimage de la pelle à l’aide de 6 chaînes de brêlage (neutralisation des chenilles)","risques":["Risques d’écrasement / heurt lors de l’assemblage","Liaison musculaire liée au port manuel de charges","Risque de submersion ou dérive du ponton","Chute à l’eau du collaborateur","Chute de la pelle depuis le ponton"],"mesures":["Assemblage du ponton assisté par pelle mécanique. Levage mécanique de tous les accessoires.","EPI : port des gants de protection pour les opérations manuelles (élingage) et casque (coactivité avec la pelle)","Pas de piétons dans la zone d’évolution des engins","Amarrage conséquent du ponton à la berge. Pieux pour assurer la stabilité du ponton.","Brêlage de la pelle sur le ponton au moyen de 6 chaînes pour neutralisation des chenilles.","Contrôle de l’étanchéité des pontons pendant l’assemblage.","Vigilance du conducteur d’engin pendant toute l’opération. Code de communication commun entre les intervenants."]},{"danger":"Déchargement manuel du petit matériel (chaînes de manutention, bidons, absorbants) / Mise en place du barrage flottant","risques":["Liaisons musculaires : lombalgie…","Chute d’un équipement","Blessures physiques type coupures"],"mesures":["Prioriser l’utilisation d’un équipement de levage mécanique pour les manutentions","Respect des bonnes pratiques en matière de gestes et postures : se rapprocher le plus possible de la charge, rechercher des appuis stables, travail avec la force des cuisses, maintenir droite la colonne vertébrale","Port de charges à deux ou plusieurs","EPI : port de chaussures de sécurité, gants de manutention"]},{"danger":"Arrachage mécanique au moyen d’une pelle sur ponton / Utilisation d’une pelle mécanique pour le déchargement des plantes envahissantes (transbordement)","risques":["Risque de heurt, collision lié à la coactivité avec des engins","Renversement de la pelle à l’eau","Chute à l’eau du collaborateur","Chute en montant dans la machine"],"mesures":["Équipements de Protection Collective sur nos installations (pontons…) : bouée couronne avec une ligne de jet, passerelle en bon état, barque de secours","EPI : port du gilet de sauvetage pour travailler sur l’eau et sur les berges.","Formations des collaborateurs CDES à l’utilisation des équipements de protection contre le risque de noyade","Port du casque obligatoire à proximité des engins et lors des opérations de manutention mécanique","Respect des rayons d’interdiction d’évolution autour des engins, immobilisation des machines avant toutes opérations d’amarrage","Vigilance avec les usagers des cours d’eau.","Montée et descente des engins – 3 points d’appui. Chaussures montantes obligatoires (maintien de la cheville)","Contrôle visuel de la stabilité / état de la berge avant la mise en place de la pelle pour le déchargement","Engins soumis à Vérifications Générales Périodiques tous les 6 mois + suivi des entretiens réguliers","Contrôle préalable du bon état des organes de sécurité sur la machine (signal de recul, klaxon, marchepied, rétroviseur, présence extincteur)","Rédaction et vérification des DICT / Respect des distances de sécurité avec réseaux électriques aériens","CACES et autorisation de conduite pour tous les conducteurs d’engins présents sur le chantier"]},{"danger":"Conduite d’un pousseur fluvial + barges pour le transport interne des plantes envahissantes","risques":["Risque de collision avec les engins","Chute à l’eau du collaborateur","Chute en circulant sur le pousseur et les barges","Coupure, piqûre liée aux opérations manuelles pour l’amarrage des barges"],"mesures":["Équipements de Protection Collective sur le pousseur : bouée couronne avec une ligne de jet, extincteur, échelle de secours, garde-corps","EPI : port du gilet de sauvetage obligatoire pour travailler sur l’eau. Port des gants pour toutes les opérations manuelles. Port des protections auditives : niveau de bruit > 80 dB.","Formations des collaborateurs CDES à l’utilisation des équipements de protection contre le risque de noyade","Respect des rayons d’interdiction d’évolution autour des engins, immobilisation des machines avant toutes opérations d’amarrage","Vigilance avec les usagers des cours d’eau. Signalisation visuelle et sonore (feux de navigation fonctionnels…)","Pousseurs équipés de marchepied pour accéder aux barges en sécurité","Contrôle quotidien des cordes d’amarrage et des câbles de treuillage","VHF obligatoire dans la cabine des engins et pousseurs pour communiquer et alerter.","Permis Fluvial et autorisation de conduite pour la conduite de nos bateaux pousseurs."]},{"danger":"Ressuyage des plantes exotiques dans l’emprise du chantier avant évacuation","risques":["Coactivité avec les usagers liée au stockage des plantes envahissantes"],"mesures":["Délimiter la zone de stockage et interdire l’accès avec la mise en place de barrières HERAS."]},{"danger":"Évacuation des espèces exotiques par PL après la période de ressuyage","risques":["Coactivité entre les PL / engins / piétons / usagers de la voirie"],"mesures":["Définition d’un plan de circulation pour l’entrée / sortie des PL sur le chantier","Mise en place d’une signalisation temporaire sur la voirie pour prévenir les risques liés à la coactivité avec les usagers de la route.","Stockage fermé des plantes envahissantes dans les bennes des PL pour éviter la dispersion."]}]},{"famille":"Réhabilitation écologique","lignes":[{"danger":"Coactivité entre les intervenants sur le chantier","risques":["Risque de collision entre les engins"],"mesures":["EPI : Port de vêtements haute visibilité par les intervenants","Utilisation de moyens de communication: téléphones, VH, système intercom équipés sur les casques","Lors des manœuvres, 1 seule personne désignée pour donner les consignes. Codes de communication définis entre les intervenants."]},{"danger":"Travaux d’élimination de bambous (aériens + rhizomes) mécaniques et manuelles (utilisation d’une pelle mécanique avec accessoire sécateur","risques":["Coupure avec les plantes et avec outils","Coactivité engins / piétons - heurt","Chute à l’eau","Chute par travail en dénivelé"],"mesures":["CACES et autorisation de conduite à présenter pour la conduite des engins TP. Formation pour l’utilisation des accessoires particuliers sur la pelle (sécateur)","Respect des 3 points d’appui pour la montée et descente des engins","Engins et accessoires soumis à VGP périodiques conformes","Port des EPI obligatoires pour tous les collaborateurs : vêtements haute visibilité pour se rendre visible, casque de protection, gants de manutention pour tous les travaux manuels.","Port de la visière si risque de projection de plantes lors des travaux d’élimination","Pas de piéton dans la zone d’évolution des engins","Vigilance en cas d’intempéries (boue, chute de branches…)"]},{"danger":"Renforcement et végétalisation des berges par la mise en place fascines de saules + boudins hélophytes","risques":["Chute à l’eau / Glissade sur sol meuble","Piqûres ou coupures avec branches","TMS liés aux manutentions manuelles","Coactivité engins / piétons - heurt"],"mesures":["Port des EPI obligatoires pour tous les collaborateurs : gilet de sauvetage sur les berges, vêtements haute visibilité, gants de manutention pour tous les travaux manuels.","Travail à 2 collaborateurs, toujours une personne en surveillance","Vérification quotidienne de la stabilité des berges","Pas de collaborateur dans la zone d’évolution des engins"]},{"danger":"Criblage des matériaux sur site au moyen d’un manitou avec un godet cribleur","risques":["Coactivité engins / piétons - heurt","Projection de matériaux"],"mesures":["CACES et autorisation de conduite à présenter pour la conduite des engins TP.","Vérification du bon état des accessoires et dispositifs de sécurité","Engins et accessoires soumis à VGP périodiques conformes","Délimiter une zone spécifique pour cette intervention. Aucun collaborateur dans la zone pendant l’opération."]},{"danger":"Tronçonnage, élagage, débroussaillage...) :","risques":["Lumbagos,","Coupure","Entaille","Chute par travail en dénivelé","Chute par travail de plein pied","Bruit"],"mesures":["Formation obligatoire","Maintenance régulière et conformité du matériel","Respect des consignes d’utilisation des équipements","Port des EPI adaptés : visière forestière, casque antibruit, surpantalon","Balisage et restriction à la zone d’accès"]}],"picto":"🌱"},{"famille":"Travaux de maintenance sur nos équipements","lignes":[{"danger":"Maintenance d’engin","risques":["Ecrasement","Chutes de hauteur","Blessures diverses","Pollution"],"mesures":["Immobilisation de l’engin avec du matériel adapté :","garder la clé de contact,","caler les roues,","pas d’équipement en suspension (sauf étayage sécurisé)","Balisage et restriction d’accès à la zone de travail","Intervention sur zone dédiée, propre, stable, imperméabilisée","Récupération des huiles usagées et déchets, assurer leur traitement et absorber les fuites avec un matériau absorbant adapté","Vidanges sur le sol et dans les réseaux d’eau interdites","Montée et descente : 3 points d’appui"]},{"danger":"Travail générant des points chauds (soudure, meulage, oxycoupage...) sur des équipements en chantier","risques":["Incendie","Explosion","Brulure"],"mesures":["EPI adapté à a soudure et intervenant formé","Bâche ignifugée si coactivité","Extincteur à placé à proximité (prévention du risque incendie)","Contrôle des équipements avant intervention par points chaud (disque, flexible, rallonges électriques)","Pas de gilet HV lors des phases de soudure, meulage, oxycoupage"]}],"picto":"🔧"},{"famille":"Bathymétrie","lignes":[{"danger":"Utilisation de la grue auxiliaire pour la mise à l’eau de la navette de la Bathy","risques":["Ecrasement","Chutes d’objets","Blessures musculaires ou fractures liés aux opérations d’élingage","Electrisation par arc suite à présence de  ligne électrique aérienne"],"mesures":["Prendre connaissances des alertes et conditions climatiques avant déchargement (vent / crue…)","Faire l’analyse de l’environnement de travail avant déchargement (Vigiminute)","Avant le déchargement, s’assurer que la zone est plane, praticable et sans obstacle.","Balisage et restriction d’accès à la zone de travail pendant les opérations de chargement / déchargement (cône de balisage)","Contrôle du bon état du matériel avant utilisation. Grue auxiliaire et accessoires de levage soumis à VGP périodiques (chaînes de levage)","Contrôle préalable du bon état des organes de sécurité (signal de recul, klaxon, marchepied en bon état, rétroviseur, extincteur)","CACES et autorisation de conduite pour l’utilisation de la grue auxiliaire","Guider la charge avec un système de retenue pour éviter les mouvements de balancement","Port des EPI pendant les opérations de levage : vêtements haute visibilité, casque de protection, gants de manutention pour l’élingage","Respect des 3 points d’appui pour la montée et descente des engins","Interdiction de stationner ou circuler sous les charges sans étayage","Vigilance avec les usagers des cours d’eau"]},{"danger":"Risque de chute à l’eau depuis la berge ou l’embarcation (montée et descente du bateau)","risques":["Noyade"],"mesures":["Port du gilet de sauvetage obligatoire","Port des EPI en particulier chaussures de sécurité montantes. Vigilance à l’état du sol avant d’évoluer sur le chantier","Echelle de sauvetage sur le bateau","Présence d’une bouée de sauvetage"]},{"danger":"Risques liés à la navigation, relevés bathymétriques","risques":["Collision avec d’autres usagers","Chute à l’eau"],"mesures":["Respect des règles de navigations (Code de navigation fluviale)","Permis Fluvial PC obligatoire pour la navigation avec le bateau","Port du gilet de sauvetage obligatoire à bord","Vigilance par rapport aux usagers de la voie d’eau"]},{"danger":"Passage des écluses","risques":["Retournement du bateau","Chutes à l’eau"],"mesures":["Mise en place d’un système d’amarrage obligatoire dans le sas lors de l’éclusage","Vigilance lors des fermetures et ouvertures de portes d’écluses","Port du gilet de sauvetage"]},{"danger":"Bruit émis par le moteur du bateau de  bathymétrie","risques":["Perte auditive / surdité/ stress / fatigue"],"mesures":["Port des protections auditives moulées obligatoires","Maintenance régulière du matériel pour limiter le bruit"]},{"danger":"Descente du fourgon et mise à l’eau manuelle du drone à l’aide du chariot de transport / récupération du drone","risques":["TMS liés aux manutentions manuelles (efforts importants pour descendre le drone le long de la berge)","Chute à l’eau lors des manutentions, glissade"],"mesures":["Mise à l’eau du drone réalisée à 2 collaborateurs (synchronisation des gestes)","Zone de mise à l’eau définie  et sécurisée. Privilégier une zone sans obstacle, non glissante, avec une pente limitée.","Vérifier l’état du chariot avant déchargement (état des roues…)","Port des EPI pour les opérations manuelles (gants de manutention anti-coupure)","Port du gilet de sauvetage pour travailler à proximité de l’eau","Positionner le drone dans l’axe du chariot pour éviter les dévers"]},{"danger":"Commande et suivi du drone","risques":["Risque de chute à l’eau / Noyade","Risque de perte de l’équipement"],"mesures":["Contrôle visuel pendant la progression du drone sur l’eau. Vigilance aux obstacles sur la trajectoire du drone","Travail à 2 collaborateurs. Utilisation des téléphones ou talkies walkies pour communiquer sur le chantier"]}],"picto":"📡"},{"famille":"Autres risques","lignes":[{"danger":"Risques biologiques","risques":["Pathologies diverses (leptospirose...)"],"mesures":["Hygiène des mains – eau à disposition dans les bases vie et fourgons","Proposition de vacciner les collaborateurs (Leptospirose)","Port des gants de protection étanche pour travailler dans l’eau"]},{"danger":"Utilisation de produits chimiques (cartouches de graissage, carburant, huiles...)","risques":["Brûlures / Irritations par contact cutané","Intoxication","CMR","Incendie","Pollution"],"mesures":["Vérification de l’étiquetage des contenants  / Contrôle de l’adéquation contenant-contenu","Utilisation d’EPI adaptés selon recommandations de la Fiche de  Données Sécurité (gants de manutention étanches, vêtements couvrants, protection des yeux…)","Présence de moyens de secours à proximité (point d’eau, absorbant)","Stockage interdit des produits en extérieur sans la mise en place d’un bac de rétention","Vérification de l’absence de sources d’inflammation","Utilisation d’un entonnoir pour le remplissage des machines","L’entreprise extérieure a la charge de ses contenants vides"]},{"danger":"Ambiances particulières","risques":["Risques liés aux conditions climatiques (chaleur excessives, intempéries)","Ambiances Poussiéreuses","Travail par manque d’éclairage"],"mesures":["S’hydrater régulièrement","Adapter les vêtements de travail aux conditions climatiques","Limiter la durée d’exposition, faire régulièrement des pauses adaptées en zone tempérée en cas de vigilance canicule","Lampe frontale pour tous les collaborateurs, systèmes d’éclairage d’appoint si besoin"]},{"danger":"Travailleur isolé Communication complexe sur le chantier (transport, zone importante, engins multiples…)","risques":["Retard dans l’intervention des secours en cas d’accident"],"mesures":["Travail en binôme","Dispositif PTI","Autre moyen de communication permettant de porter secours dans","des délais brefs : contact téléphonique régulier à fréquence définie","VHF dans les cabines pour travailler sur l’eau"]},{"danger":"Risques environnementaux (déchets, pollution,        incendie...)","risques":["Pollution eau, sol, fumées","Bruit","Odeurs","Poussières","Incendie /explosion","Utilisation forte d’eau et d’énergie"],"mesures":["Récupérer les déchets avant de quitter le site","Zone de stockage dédiées","Utilisation des contenants à disposition","Tri des déchets - Emballage et élimination en filière spécifique","Présence d’absorbants ou matériels de rétention","Limitation quantité d’eau et d’énergie aux besoins de la prestation","Equipements de protection incendie (extincteurs…)","Entretien des engins pour limiter la pollution des gaz d’échappement","Filière spécifique pour la gestion des déchets végétaux (bambous) à supprimer"]}],"picto":"⚠️"},{"famille":"Transfert des équipements en PL + porte-char","lignes":[{"danger":"Descente des engins à chenilles et à pneus depuis un porte char","risques":["Glissade de l’engin","Ecrasement en cas de retournement de l’engin","Blessures musculaires ou fracture"],"mesures":["Balisage et restriction d’accès à la zone de travail","Port du casque - port des gants de manutention","Montée et descente des engins camion– 3 points d’appui","Contrôle du bon état du matériel avant utilisation et VGP des engins","Contrôle préalable du bon état des organes de sécurité (signal de","recul, klaxon, marchepied, rétroviseur, extincteur)","S’assurer que les chenilles et pneus sont propres pour éviter un risque de glissade sur les rampes","Utilisation obligatoire des moyens de retenue (ceinture de sécurité,","porte de l’engin fermée)","Montée des engins en marche arrière et descente en marche avant pour faciliter l’opération et assurer une meilleure visibilité","CACES et autorisation de conduite des conducteurs + aptitude pour la descente et montée sur porte char.","Protocole de chargement /déchargement si intervenants externes","Equilibrage de la machine lors de la montée / descente avec prise d’appui du bras de pelle sur le sol","Vigilance avec les usagers des cours d’eau si déchargement sur les berges + port du gilet de sauvetage obligatoire"]}],"picto":"🚛"}];
const RISQUES_ENV=[{"danger":"Travaux à proximité de lignes électriques aériennes (en particulier haute tension)","risques":["Electrisation, électrocution par contact direct ou indirect avec un engin"],"mesures":["Rédaction des DICT + prise en compte des réseaux à proximité","Respect strict des distances de sécurité à respecter avec les réseaux électriques aériens (3m ou 5m selon voltage)","Délimitation et matérialisation au sol d’une zone d’exclusion (en-dessous de la ligne aérienne) pour la circulation des engins TP et engins de transport avec benne levante.","Sensibiliser les collaborateurs sur le terrain"]},{"danger":"Travaux à proximité de réseaux enterrés (eau, gaz, électrique, produits chimiques, internet…) Travaux à proximité d’infrastructures sensibles (ponts, habitations, autres éléments qui pourraient avoir un impact sur le déroulement du chantier","risques":["Heurt, collision avec une infrastructure sensible (réseaux, habitation)"],"mesures":["Rédaction des DICT + prise en compte des réseaux à proximité","Balisage des zones à risque et sensibilisation des équipes sur le terrain"]},{"danger":"Travaux à proximité de berges, pistes de circulation et zones de travaux instables, meubles Travaux dans des zones particulièrement encombrée, espace forestier","risques":["Enlisement des équipements de travail","Renversement à l’eau des engins, chute à l’eau des collaborateurs","Heurt avec un obstacle, zone difficile d’accès…"],"mesures":["Repérage des zones de travaux en amont pour évaluer les risques","Identification des zones de mise à l’eau, déchargement…","Création de pistes, renforcement des berges avant déploiement des engins. Mise en place de plaques de roulage.","Vérification quotidienne de la portance des sols, en particulier lors des périodes d’intempéries.","Travaux de débroussaillage"]},{"danger":"Travaux dans zones pentues, et/ou avec un risque de chute de hauteur (débroussaillage en talus…)","risques":["Glissade, chute de hauteur"],"mesures":["Location d’une nacelle pour la réalisation de travaux en hauteur","Pour tous les travaux en hauteur, ou dénivelé important, port d’un harnais de sécurité + longes. EPI contrôlé (soumis à VGP) + formation du personnel à son utilisation.","Mise en place d’une échelle télescopique ou équivalent pour garantir une montée / descente en sécurité."]},{"danger":"Prise en compte des spécifications historiques : présence d’engins explosifs de guerre (obus…)","risques":["Explosion, intoxication"],"mesures":["Renseignement au préalable si contexte historique particulier dans le périmètre géographique du chantier","Prendre connaissance de la procédure « Découverte d’un engin de guerre » et sensibiliser les équipes sur le terrain"]},{"danger":"Travaux soumis à des hauteurs d’eau fluctuantes (marées…)","risques":["Dérive, renversement des engins liés aux phénomènes de montées d’eaux, crue","Chute à l’eau, noyade"],"mesures":["Prendre connaissance des phénomènes de marées, crues dans le secteur du chantier","Ne pas stationner les engins, matériels dans des zones à risque.","Prévoir une marge suffisante sur les amarres des équipements pour permettre la variation du niveau d’eau (crues, marées).","EPC présents sur le chantier : bouées de sauvetage, barque. Port du gilet obligatoire pour tous les collaborateurs pour travailler sur l’eau ou à proximité.","Définir une procédure spécifique « Crue » prenant en compte des règles de réaction selon le niveau de vigilance pouvant aller jusqu’à l’évacuation du matériel en cas d’urgence (plan de repli)"]},{"danger":"Travaux à proximité d’espèces faunes / flores sensibles.","risques":["Détérioration de la faune et de la flore"],"mesures":["Prise en compte des spécifications faunes/flores, de la sensibilité écologique du milieu auprès du MOE.","Définition des périodes d’intervention, balisage des espèces protégées en lien avec le MOE"]}];
const CARNET={"62":{"_region":"Hauts-de-France","inspection":{"nom":"DDETS du Pas-de-Calais","adresse":"14 voie Bossuet - CS 20960\n62033 ARRAS Cedex","tel":"03 21 60 28 00"},"carsat":{"nom":"CARSAT Hauts-de-France","adresse":"100 rue de Vélodrome\n62223 SAINT-LAURENT-BLANGY","tel":"09 71 10 39 60"},"oppbtp":{"nom":"OPPBTP Hauts-de-France","adresse":"340 avenue de la Marne\n59700 MARCQ-EN-BAROEUL","tel":"03 20 52 13 14"}},"59":{"_region":"Hauts-de-France","inspection":{"nom":"DDETS du Nord","adresse":"","tel":"","aVerifier":true},"carsat":{"nom":"CARSAT Hauts-de-France","adresse":"100 rue de Vélodrome\n62223 SAINT-LAURENT-BLANGY","tel":"09 71 10 39 60"},"oppbtp":{"nom":"OPPBTP Hauts-de-France","adresse":"340 avenue de la Marne\n59700 MARCQ-EN-BAROEUL","tel":"03 20 52 13 14"}},"95":{"_region":"Île-de-France","inspection":{"nom":"DDETS du Val-d'Oise","adresse":"Immeuble Atrium\n3 boulevard de l'Oise\n95014 CERGY-PONTOISE","tel":"01 34 35 49 49"},"carsat":{"nom":"CRAMIF Île-de-France","adresse":"19 avenue de Flandre\n75019 PARIS","tel":"01 40 05 32 64"},"oppbtp":{"nom":"OPPBTP Île-de-France","adresse":"1 rue de Heyrault\n92660 BOULOGNE-BILLANCOURT","tel":"01 40 31 64 00"}},"77":{"_region":"Île-de-France","inspection":{"nom":"DDETS de Seine-et-Marne","adresse":"","tel":"","aVerifier":true},"carsat":{"nom":"CRAMIF Île-de-France","adresse":"19 avenue de Flandre\n75019 PARIS","tel":"01 40 05 32 64"},"oppbtp":{"nom":"OPPBTP Île-de-France","adresse":"1 rue de Heyrault\n92660 BOULOGNE-BILLANCOURT","tel":"01 40 31 64 00"}},"78":{"_region":"Île-de-France","inspection":{"nom":"DDETS des Yvelines","adresse":"","tel":"","aVerifier":true},"carsat":{"nom":"CRAMIF Île-de-France","adresse":"19 avenue de Flandre\n75019 PARIS","tel":"01 40 05 32 64"},"oppbtp":{"nom":"OPPBTP Île-de-France","adresse":"1 rue de Heyrault\n92660 BOULOGNE-BILLANCOURT","tel":"01 40 31 64 00"}},"91":{"_region":"Île-de-France","inspection":{"nom":"DDETS de l'Essonne","adresse":"","tel":"","aVerifier":true},"carsat":{"nom":"CRAMIF Île-de-France","adresse":"19 avenue de Flandre\n75019 PARIS","tel":"01 40 05 32 64"},"oppbtp":{"nom":"OPPBTP Île-de-France","adresse":"1 rue de Heyrault\n92660 BOULOGNE-BILLANCOURT","tel":"01 40 31 64 00"}},"60":{"_region":"Hauts-de-France","inspection":{"nom":"DDETS de l'Oise","adresse":"","tel":"","aVerifier":true},"carsat":{"nom":"CARSAT Hauts-de-France","adresse":"100 rue de Vélodrome\n62223 SAINT-LAURENT-BLANGY","tel":"09 71 10 39 60"},"oppbtp":{"nom":"OPPBTP Hauts-de-France","adresse":"340 avenue de la Marne\n59700 MARCQ-EN-BAROEUL","tel":"03 20 52 13 14"}},"33":{"_region":"Nouvelle-Aquitaine","inspection":{"nom":"DDETS de la Gironde","adresse":"","tel":"","aVerifier":true},"carsat":{"nom":"CARSAT Aquitaine","adresse":"80 avenue de la Jallère\n33053 BORDEAUX Cedex","tel":"39 60"},"oppbtp":{"nom":"OPPBTP Nouvelle-Aquitaine","adresse":"","tel":"","aVerifier":true}},"35":{"_region":"Bretagne","inspection":{"nom":"DDETS d'Ille-et-Vilaine","adresse":"","tel":"","aVerifier":true},"carsat":{"nom":"CARSAT Bretagne","adresse":"236 rue de Châteaugiron\n35030 RENNES Cedex 9","tel":"39 60"},"oppbtp":{"nom":"OPPBTP Bretagne","adresse":"","tel":"","aVerifier":true}},"44":{"_region":"Pays de la Loire","inspection":{"nom":"DDETS de Loire-Atlantique","adresse":"","tel":"","aVerifier":true},"carsat":{"nom":"CARSAT Pays de la Loire","adresse":"","tel":"","aVerifier":true},"oppbtp":{"nom":"OPPBTP Pays de la Loire","adresse":"","tel":"","aVerifier":true}}};

/* ============================================================================
   ANNUAIRE (V2) — reçu du serveur (ping et synchro) depuis le Référentiel CDES.
   Les tableaux et objets sont modifiés SUR PLACE : tout le code qui les lit
   continue de fonctionner. Copie gardée sur l'appareil branché pour travailler
   hors réseau.
   ========================================================================= */
const CLE_ANNUAIRE='pdp_annuaire_v2';
function appliquerAnnuaire(a,memoriser){
  if(!a||typeof a!=='object')return false;
  if(Array.isArray(a.agences)&&a.agences.length)AGENCES.splice(0,AGENCES.length,...a.agences);
  if(Array.isArray(a.personnes))PERSONNES.splice(0,PERSONNES.length,...a.personnes);
  if(typeof a.verificateur==='string')VERIFICATEUR=a.verificateur;
  if(typeof a.hseDefaut==='string')HSE_DEFAUT=a.hseDefaut;
  if(a.coordinateurHse)Object.assign(COORDINATEUR_HSE,a.coordinateurHse);
  if(a.correspondantRH)Object.assign(AFFICHAGE.correspondantRH,a.correspondantRH);
  if(a.referentHarcelement){AFFICHAGE.referentHarcelement.nom=a.referentHarcelement.nom||'';AFFICHAGE.referentHarcelement.tel=a.referentHarcelement.tel||''}
  if(memoriser){try{localStorage.setItem(CLE_ANNUAIRE,JSON.stringify(a))}catch(e){}}
  return true;
}
try{appliquerAnnuaire(JSON.parse(localStorage.getItem(CLE_ANNUAIRE)||'null'))}catch(e){}
