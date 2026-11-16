# Digital Twin — frontend candidat

La page est `/stocks/digital-twin`. Lire le dossier complet `docs/DIGITAL_TWIN.md` de la branche `feature/digital-twin-3d` du dépôt `Souldjaboy/triangle-wms-backend` avant toute intégration.

Cette version n'est pas déployée et ne remplit pas encore tout le cahier des charges. Elle nécessite les API du backend candidat et un schéma réel compatible. Les fonctions de smart slotting, lots/séries, prévisions, chemins, rotation et inventaires visuels restent à intégrer après audit métier. Les contrôles visuels et GPU n'ont pas pu être réalisés dans l'environnement de développement.

- `npm ci` : dépendances verrouillées.
- `npx tsc --noEmit` puis `npm run build` : vérifications.
- `NEXT_PUBLIC_DIGITAL_TWIN_ENABLED=true` au build : rend le lien visible sur la page Stocks. Backend : `DIGITAL_TWIN_ENABLED=true` uniquement après migration et recette.
- `npm run dev -- --hostname 127.0.0.1 --port 3101` puis `npm run test:digital-twin` : parcours local Playwright. Exécuter `npx playwright install chromium` si nécessaire. `TWIN_BROWSER_PATH` accepte le chemin d'un Chromium existant.

Les fixtures du test navigateur sont interceptées localement, jamais injectées dans les données du WMS. Aucun jeu de démonstration n'est chargé par la page.

Fichiers principaux : `page.tsx` pour le parcours et les lectures ; `types.ts` pour le contrat et les couleurs ; `Plan2D.tsx` et `Plan3D.tsx` pour le rendu ; `Scene.tsx` pour le chargement différé et le repli ; `Configurator.tsx` pour les plans ; `twin.css` pour le style responsive. Ils se trouvent tous dans `app/stocks/digital-twin/`.
