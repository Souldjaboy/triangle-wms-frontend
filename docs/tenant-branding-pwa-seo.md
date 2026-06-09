# Branding, PWA et SEO par tenant

Ce frontend peut être construit pour trois marques sans renommer le dépôt.

## Variables frontend

Triangle WMS Pro :

```bash
NEXT_PUBLIC_APP_PRODUCT=triangle
NEXT_PUBLIC_SITE_URL=https://trianglewmspro.com
```

MaliLink Global :

```bash
NEXT_PUBLIC_APP_PRODUCT=malilink
NEXT_PUBLIC_SITE_URL=https://malilinkglobal.com
```

HAFIYA Laboratoire / AFIA :

```bash
NEXT_PUBLIC_APP_PRODUCT=hafiya
NEXT_PUBLIC_SITE_URL=https://hafiyalab.com
```

## Variables backend à prévoir

Ces variables ne doivent jamais être codées en dur :

```bash
ADMIN_EMAIL=
ADMIN_PASSWORD=
TENANT_ID=
PUBLIC_APP_PRODUCT=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

Le mot de passe admin doit être haché côté backend. Il ne doit jamais apparaître dans le frontend.

## Domaines et visibilité

Triangle WMS Pro :

- domaine : `trianglewmspro.com`
- usage : privé
- SEO : `noindex,nofollow`
- `robots.txt` : bloque tout
- page racine : redirection vers `/login`

MaliLink Global :

- domaine : `malilinkglobal.com`
- usage : public
- SEO : indexable
- `robots.txt` : autorise les pages publiques
- `sitemap.xml` : actif

HAFIYA Laboratoire / AFIA :

- domaine : `hafiyalab.com`
- sous-domaine possible : `afia.trianglewmspro.com`
- usage : privé médical
- SEO : `noindex,nofollow`
- `robots.txt` : bloque tout
- page racine : redirection vers `/login`

## PWA et Capacitor

Le manifest PWA est généré par `app/manifest.ts` selon `NEXT_PUBLIC_APP_PRODUCT`.

Bundle IDs prévus :

- Triangle : `com.triangle.wmspro`
- MaliLink : `com.malilink.global`
- HAFIYA : `com.hafiya.lab`

Capacitor lit les mêmes variables pour préparer le wrapper mobile.

## Sécurité backend indispensable

Le frontend masque les modules, mais la vraie sécurité doit rester côté backend :

- vérifier JWT ;
- vérifier `tenant_id` ou `company_id` ;
- vérifier le domaine/tenant actif ;
- empêcher un token MaliLink d’accéder à Triangle ou HAFIYA ;
- utiliser cookies `Secure`, `HttpOnly`, `SameSite`;
- ne jamais dépendre uniquement de `noindex`.

## Reçus POS par email et WhatsApp

À prévoir côté backend :

- endpoint d’envoi reçu par email ;
- génération PDF côté serveur ;
- journalisation dans `audit_logs` ;
- template WhatsApp préparé côté frontend ou backend.

## Notifications externes MaliLink

À prévoir côté backend :

- stockage des abonnements Web Push ;
- VAPID keys ;
- notification vendeur/admin lors d’une commande ;
- respect du tenant et des permissions.

