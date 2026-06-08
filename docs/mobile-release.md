# Triangle WMS Pro - Préparation mobile

Ce document explique comment utiliser Triangle WMS Pro comme PWA installable et comment préparer une future publication Google Play Store et Apple App Store.

## État actuel

- PWA web installable via `public/manifest.json`.
- Service worker public dans `public/sw.js`.
- Icônes PWA 192x192, 512x512 et maskable.
- Page publique d’aide : `/installer-application`.
- Configuration Capacitor : `capacitor.config.ts`.
- Application native préparée comme wrapper HTTPS vers `https://trianglewmspro.com`.

## Installation PWA

### Android

1. Ouvrir `https://trianglewmspro.com` avec Chrome.
2. Ouvrir le menu du navigateur.
3. Choisir `Installer l’application` ou `Ajouter à l’écran d’accueil`.
4. Ouvrir Triangle WMS Pro depuis l’icône installée.

### iPhone et iPad

1. Ouvrir `https://trianglewmspro.com` avec Safari.
2. Appuyer sur le bouton de partage.
3. Choisir `Sur l’écran d’accueil`.
4. Valider `Ajouter`.

### Windows et Mac

1. Ouvrir `https://trianglewmspro.com` avec Chrome, Edge ou Brave.
2. Cliquer sur l’icône d’installation dans la barre d’adresse, si elle apparaît.
3. Sinon ouvrir le menu du navigateur puis choisir `Installer Triangle WMS Pro`.

## Sécurité PWA

Le service worker ne doit pas mettre en cache les données privées.

Ne jamais mettre en cache :

- tokens de connexion ;
- utilisateurs ;
- commandes ;
- paiements ;
- badges ;
- stocks privés ;
- données d’entreprise ;
- appels API.

Le service worker actuel ignore les routes privées et les appels `/api`.

## Capacitor

Capacitor est installé pour préparer Android et iOS.

Configuration :

- appId : `com.trianglewmspro.app`
- appName : `Triangle WMS Pro`
- URL mobile : `https://trianglewmspro.com`
- HTTPS obligatoire.

Cette approche garde le site Next.js dynamique, sans casser les routes serveur, le marketplace, les connexions client/entreprise/super admin et les APIs.

## Commandes utiles

Installer les dépendances :

```bash
npm install
```

Vérifier le build web :

```bash
npm run build
```

Préparer Android :

```bash
npm run cap:android
```

Synchroniser Android après modification :

```bash
npm run cap:sync
```

Préparer iOS :

```bash
npm run cap:ios
```

## Tester sur Android

Pré-requis :

- Android Studio installé ;
- compte Google Play Console plus tard pour publication ;
- téléphone Android ou émulateur.

Étapes :

1. Exécuter `npm run cap:android`.
2. Ouvrir le dossier Android généré dans Android Studio.
3. Lancer sur téléphone ou émulateur.
4. Vérifier connexion entreprise, client, super admin, marketplace, POS, pointage et scanner.

## Tester sur iOS

Pré-requis :

- Mac avec Xcode ;
- compte Apple Developer plus tard pour publication ;
- iPhone/iPad ou simulateur.

Étapes :

1. Exécuter `npm run cap:ios`.
2. Ouvrir le dossier iOS généré dans Xcode.
3. Configurer l’équipe Apple Developer.
4. Lancer sur simulateur ou appareil réel.
5. Vérifier connexion entreprise, client, super admin, marketplace, POS, pointage et scanner.

## Préparer Google Play Store

À créer avant publication :

- compte Google Play Console ;
- icône haute résolution 512x512 ;
- bannière graphique ;
- captures écran téléphone et tablette ;
- texte court ;
- description complète ;
- politique de confidentialité ;
- adresse email support ;
- classement contenu ;
- APK/AAB signé.

Tests obligatoires avant publication :

- login entreprise ;
- login client ;
- super admin ;
- marketplace ;
- panier et commandes ;
- POS ;
- scan QR/caméra ;
- pointage GPS ;
- notifications ;
- déconnexion.

## Préparer Apple App Store

À créer avant publication :

- compte Apple Developer ;
- identifiant bundle `com.trianglewmspro.app` ;
- icône iOS ;
- captures iPhone ;
- captures iPad ;
- description App Store ;
- URL support ;
- politique de confidentialité ;
- signature et provisioning profile.

Tests obligatoires avant publication :

- installation iPhone ;
- installation iPad ;
- Safari/PWA ;
- wrapper Capacitor ;
- caméra scanner ;
- géolocalisation pointage ;
- notifications si activées ;
- paiement si disponible.

## Points restants avant publication officielle

- Générer les dossiers natifs `android/` et `ios/` seulement quand la publication commence.
- Préparer les captures écran réelles des modules.
- Ajouter les textes officiels store.
- Vérifier la politique de confidentialité publique.
- Tester caméra, GPS et fichiers sur appareils réels.
- Vérifier les règles Apple pour les paiements numériques si une vente de service numérique est ajoutée.
- Signer l’application Android et iOS avec les comptes développeurs officiels.
