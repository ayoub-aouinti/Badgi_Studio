# Badgi Studio — instructions pour Claude Code

Badgi Studio est un module de la plateforme Badgi (badgi.net, gestion de congrès médicaux en Tunisie).
Une **borne tablette** transforme le selfie d'un participant en **portrait IA**, l'affiche sur le **mur du congrès**
(écran TV) et le lui envoie (email, WhatsApp, QR de téléchargement).

Lire avant de coder : `docs/SPEC.md` (fonctionnel + données + API) et `docs/SCREENS.md` (écrans et design).

## Contrainte principale : ressources gratuites pour le moment
- Tout doit tourner en local avec Docker, sans service payant obligatoire.
- Chaque service externe passe par une **interface + un adaptateur**, sélectionné par variable d'environnement,
  pour passer plus tard à un service payant sans toucher au métier :
  - `AI_PROVIDER=mock | fal | gemini` — `mock` (par défaut) applique un effet local avec `sharp`
    (niveaux de couleur, contours, teinte par style) pour développer sans aucun coût.
  - `STORAGE_DRIVER=local | s3` — `local` écrit dans `./storage`, MinIO en Docker pour tester le S3.
  - `MAIL_DRIVER=smtp` — Mailpit en Docker pour le dev (capture les emails), SMTP gratuit (Brevo, Gmail) ensuite.
  - `WHATSAPP_MODE=link | cloud_api` — `link` (par défaut, gratuit) : l'écran Résultat affiche un QR
    `https://wa.me/?text=<message + lien du portrait>` ; `cloud_api` (plus tard) : Meta WhatsApp Cloud API.

## Stack imposée
- **Monorepo** pnpm workspaces :
  - `apps/api` — NestJS 10, TypeScript, Prisma, PostgreSQL 16, BullMQ + Redis, Socket.IO, class-validator, Swagger.
  - `apps/kiosk` — React 18 + Vite + TypeScript, PWA, Tailwind, TanStack Query, react-i18next (FR/EN/AR, RTL),
    `@zxing/browser` pour le scan QR, `getUserMedia` pour la caméra.
  - `apps/wall` — React + Vite, écran 1920×1080, Socket.IO client.
  - `apps/dashboard` — React + Vite, tableau de bord organisateur.
  - `packages/shared` — types et DTO partagés.
- `docker-compose.yml` : postgres, redis, minio, mailpit.

## Conventions
- Code, noms de variables et commits en anglais ; textes d'interface en français par défaut (fichiers i18n).
- Pas de secrets dans le code : `.env.example` documente toutes les variables.
- Les tâches lentes (IA, envois, purge) passent par BullMQ ; la borne ne fait jamais d'appel direct à un service externe.
- Tests : Jest côté API (services + e2e principaux), Vitest côté front.

## Ordre de travail (une phase à la fois, valider avant la suivante)
1. Monorepo + docker-compose + Prisma (schéma de `docs/SPEC.md`) + seed d'un événement de démo.
2. API : appairage borne, identification (badge ou saisie), sessions, upload selfie, job de génération (`mock`), WebSocket.
3. Borne : les 9 écrans de `docs/SCREENS.md`.
4. Mur en direct.
5. Tableau de bord : configuration, modération, statistiques.
6. Envois : email (Mailpit), lien WhatsApp, page publique `/p/:code`, purge J+30.
