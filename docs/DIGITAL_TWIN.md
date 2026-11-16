# Digital Twin — frontend candidat

La page est `/stocks/digital-twin`. Lire le dossier complet `docs/DIGITAL_TWIN.md` de la branche `feature/digital-twin-3d` du dépôt `Souldjaboy/triangle-wms-backend` avant toute intégration.

Cette version n'est pas déployée et ne remplit pas encore tout le cahier des charges. Elle nécessite les API du backend candidat et un schéma réel compatible. Les fonctions de smart slotting, lots/séries, prévisions, chemins, rotation et inventaires visuels restent à intégrer après audit métier. Les contrôles visuels et GPU n'ont pas pu être réalisés dans l'environnement de développement.

- `npm ci` : dépendances verrouillées.
- `npx tsc --noEmit` puis `npm run build` : vérifications.
- `NEXT_PUBLIC_DIGITAL_TWIN_ENABLED=true` au build : rend le lien visible sur la page Stocks. Backend : `DIGITAL_TWIN_ENABLED=true` uniquement après migration et recette.
- `npm run dev -- --hostname 127.0.0.1 --port 3101` puis `npm run test:digital-twin` : parcours local Playwright. Exécuter `npx playwright install chromium` si nécessaire. `TWIN_BROWSER_PATH` accepte le chemin d'un Chromium existant.

Les fixtures du test navigateur sont interceptées localement, jamais injectées dans les données du WMS. Aucun jeu de démonstration n'est chargé par la page.

Fichiers principaux : `page.tsx` pour le parcours et les lectures ; `types.ts` pour le contrat et les couleurs ; `Plan2D.tsx` et `Plan3D.tsx` pour le rendu ; `Scene.tsx` pour le chargement différé et le repli ; `Configurator.tsx` pour les plans ; `twin.css` pour le style responsive. Ils se trouvent tous dans `app/stocks/digital-twin/`.

## Contrôle VPS du 16 novembre 2026

Le diagnostic fourni par l’administrateur confirme Express 5, Next 16, les colonnes requises et aucune table dt_ existante. Le serveur comporte 19 fichiers backend et 27 fichiers frontend suivis modifiés : les branches candidates ne doivent pas remplacer ces dépôts.

La base contrôlée présente 89 produits gérés par emplacement dont le stock global diffère de la somme des balances, 228 produits avec stock non gérés par emplacement et 82 sans emplacement principal. Ces nombres concernent le périmètre global du diagnostic, pas nécessairement une seule société. Ils ne constituent pas une instruction de réconciliation. Aucune correction de stock n’a été exécutée.

La candidate signale désormais les références en écart par entrepôt autorisé. Les bins concernés, y compris un emplacement principal sans balance, sont non vérifiés : ni vide confirmé, ni capacité disponible calculée. Les quantités enregistrées restent visibles et marquées à vérifier. Les totaux de comparaison interentrepôts ne sont pas exposés aux utilisateurs. Les changements validés des services de stock existants pourront lever ces alertes au rafraîchissement suivant.

Le moteur de permissions conserve la société d’origine de l’utilisateur et reçoit séparément la société effective. Les droits historiques ne traversent pas cette frontière. Les habilitations sont relues, et le corps d’un formulaire ne choisit pas la société.

Validation locale : 19 tests métier/intégration passent également avec le fichier de permissions dont l’empreinte correspond exactement au VPS. Cela ne vaut pas validation visuelle ou test utilisateur sur le serveur.

## Vue automatique — 16 novembre 2026

L'ouverture d'un entrepôt affiche désormais un schéma 2D ou 3D construit à la lecture des emplacements réels, sans exiger de publication de plan. Les champs suivent les alias du moteur de stock : Rayon = `rayon_code || zone`, Étagère = `case_code || rayon`, Niveau = `level_code || etagere`, Bin = `bin_code`. Un champ manquant reste « Non renseigné ». Les codes composites `FULLBIN`, `BIN2-3` et autres repères historiques restent chacun une seule cellule reliée à leur identifiant officiel.

La 2D présente les étagères en façade, les niveaux et le contenu des cellules. La 3D représente les rayonnages avec leurs niveaux enregistrés et leurs bins sélectionnables. Le tableau Code / Rayon / Étagère / Niveau / Bin / Contenu ouvre la même fiche et le même historique. La recherche sélectionne également ces objets sans plan publié. Les identifiants des bins sont indépendants du tri et du code, ce qui conserve la sélection lors des actualisations.

Le rendu est explicitement schématique et hors échelle. Ses coordonnées graphiques sont calculées en mémoire ; elles ne sont jamais enregistrées dans les plans physiques, les emplacements ou le stock. Aucun taux de remplissage ou capacité n'est déduit des volumes dessinés. Les plans mesurés existants restent disponibles avec le sélecteur « Plan physique mesuré » ; l'assistant de configuration reçoit exclusivement leurs données originales.

La lecture se renouvelle toutes les 15 secondes lorsque l'écran est visible, au retour sur l'onglet et via le bouton d'actualisation. Une création, modification ou suppression autorisée par le WMS est donc reflétée après la prochaine lecture. Ce fonctionnement ne promet pas de notification instantanée par WebSocket. Un entrepôt sans emplacement ne reçoit aucun rack ou bin fictif.

Les écarts de stock restent signalés dans un panneau dépliable ; ils n'empêchent plus d'afficher les emplacements. Les stocks historiques non répartis ne sont pas artificiellement affectés à un bin. Le mode « Contenu enregistré » distingue stock enregistré, réservation, données à vérifier et indisponibilité, sans assimiler la présence de produits à un taux de remplissage physique.

Tests : `node --test tests/digital-twin-automatic.test.cjs` vérifie huit scénarios, dont 569 bins rendus en HTML, les champs historiques, les codes composites, la stabilité des identifiants et l'absence de mutation des plans publiés. La vérification locale du rendu WebGL n'a pas pu être réalisée : le téléchargement du navigateur de test échoue dans cet environnement. Elle reste à effectuer sur le VPS dans le navigateur utilisateur.
