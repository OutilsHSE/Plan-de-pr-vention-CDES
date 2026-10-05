# Plans de prévention — CDES

Page publique de l'outil de rédaction des plans de prévention, PPSPS et protocoles
de sécurité (GitHub Pages). Version V18 du 05/10/2026 (V17 sécurisée).

| Fichier | Rôle |
|---|---|
| `index.html` | la page (structure seulement) |
| `css/pdp.css` | la mise en forme |
| `js/moteur-docx.js` | remplissage des trames Word, dans le navigateur |
| `js/qrcode.js` | QR code de l'affichage de chantier |
| `js/affichage.js` | affichage obligatoire de chantier |
| `js/branchement.js` | lien avec le serveur CDES, synchronisation, IA |
| `js/trame.js` | où poser chaque information dans les trames |
| `js/donnees.js` | données de référence publiques : bibliothèque de risques, EPI, organismes |
| `js/images.js` | logo |
| `js/app.js` | l'application |
| `*_trame.docx` | les trames Word, à garder à côté de `index.html` |

**Ce dépôt ne contient ni adresse de serveur, ni mot de passe, ni nom ou téléphone
de personne.** L'appareil est « branché » en ouvrant l'outil depuis la tuile de
l'intranet HSE. L'annuaire (agences, rédacteurs, valideurs, coordinateur HSE) arrive
du serveur, depuis le Référentiel CDES, seulement sur un appareil branché.
