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
