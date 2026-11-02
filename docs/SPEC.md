# Badgi Studio — spécification

## Acteurs
- **Participant** : utilise la borne, reçoit son portrait.
- **Organisateur** : configure le Studio d'un événement, modère, voit les statistiques.
- **Sponsor** : logo sur borne, cadre et mur ; reçoit les contacts consentis (V2).
- **Admin Badgi** : modèles IA, coûts.

## Parcours participant
Accueil → Identification → (Badge reconnu | Saisie manuelle) → Style + consentements → Capture → Génération →
Dessin en direct → Résultat → retour à l'accueil.

### Identification (simplifiée)
Prénom + nom obligatoires (2–60 caractères) ; email et WhatsApp (+216 par défaut, stocké en E.164) **facultatifs**.
Sans contact, le portrait reste disponible via le QR de téléchargement. Plus de scan de badge ni de spécialité.
- Réinitialisation de la borne après 60 s d'inactivité et 20 s après le résultat.
- 2 consentements : `ai_processing` (obligatoire), `wall`.

## Fonctionnalités MVP
- Borne PWA plein écran, appairage par code à 6 chiffres, FR/EN/AR, file d'envoi hors ligne (IndexedDB).
- 3 styles : Portrait professionnel, Caricature, Crayon noir (prompt + modèle par style en base ; activables dans l'admin).
- Modération avant génération (visage détecté, contenu convenable) ; en mode `mock`, toujours acceptée.
- Génération asynchrone, cadre ajouté côté serveur avec `sharp` selon le branding : `banner`, `border`, `polaroid` ou `none` (couleur, épaisseur, nom du participant, logo).
- Espace admin (`apps/dashboard`) : nom, slogan, logo, couleurs, cadre avec aperçu en direct, activation des styles.
- Mur en direct (WebSocket), dernier portrait mis en avant, compteur.
- Tableau de bord : activer le Studio, bornes, styles, modération (retirer, épingler, approuver), statistiques + coût IA.
- Page publique `/p/:code` (téléchargement HD), email, lien WhatsApp.
- Purge automatique J+30 (paramétrable) : fichiers supprimés, email/téléphone vidés, statistiques gardées.

### Non fonctionnel
- Portrait visible en moins de 30 s (objectif 15 s). 2 bornes × 30 portraits/heure.
- Liens de téléchargement signés et expirants. Conformité loi 2004-63 (Tunisie) et RGPD.

## Données (Prisma / PostgreSQL)
Un seul événement (`events`), sans dépendance externe.

| Table | Colonnes principales |
| --- | --- |
| `studio_configs` | id, event_id, enabled, logo_key, tagline, primary_color, accent_color, frame_style, frame_color, frame_width, show_name, show_logo, retention_days, wall_token |
| `studio_styles` | id, config_id, name, prompt, model, preview_key, sort_order, active |
| `kiosks` | id, event_id, name, pairing_code, device_token_hash, last_seen_at, status |
| `studio_participants` | id, event_id, attendee_id?, first_name, last_name, email?, whatsapp_e164? |
| `consents` | id, participant_id, type (`ai_processing`/`wall`), granted, granted_at, text_version |
| `capture_sessions` | id, kiosk_id, participant_id, started_at, ended_at, status |
| `portraits` | id, session_id, style_id, selfie_key, result_key, framed_key, status (`queued`/`moderating`/`generating`/`ready`/`rejected`/`failed`), provider_request_id, cost_usd, on_wall, pinned, public_code, created_at, purge_at |
| `deliveries` | id, portrait_id, channel (`email`/`whatsapp`/`print`), recipient, status, provider_message_id, cost_usd, sent_at, error |

Index : `portraits(status)`, `portraits(purge_at)`, `portraits(session_id)`.

## API
| Méthode | Route | Rôle |
| --- | --- | --- |
| POST | `/kiosk/pair` | code 6 chiffres → jeton d'appareil |
| GET | `/kiosk/config` | styles, sponsor, langues |
| POST | `/kiosk/participants` | saisie du nom (+ contact facultatif) |
| POST | `/kiosk/sessions` | ouvre un passage + consentements |
| POST | `/kiosk/sessions/:id/portraits` | selfie (multipart) + styleId → 202 `{portraitId}` |
| GET | `/p/:code` | page publique de téléchargement |
| GET | `/wall/:token/feed` | derniers portraits |
| POST | `/admin/login` | mot de passe → jeton admin |
| GET/PUT | `/admin/branding` | branding (nom, slogan, couleurs, cadre) |
| POST/DELETE | `/admin/branding/logo` | logo (multipart `logo`) |
| GET | `/admin/branding/preview` | aperçu JPEG du cadre |
| GET/PATCH | `/admin/styles[/:id]` | activer/désactiver un style |
| CRUD | `/events/:id/studio/styles` | styles |
| GET | `/events/:id/studio/portraits` | liste + modération |
| PATCH | `/portraits/:id` | retirer / épingler / approuver |
| GET | `/events/:id/studio/stats` | statistiques et coûts |
| POST | `/webhooks/ai` | résultat de génération (fournisseurs asynchrones) |

WebSocket (Socket.IO) : `portrait.progress` (étape : sketch/ink/color/frame), `portrait.ready`, `wall.new`, `wall.remove`.

## Génération
1. Upload du selfie → stockage → job `generate-portrait`.
2. Worker : modération → `AiProvider.generate(selfie, style)` → cadre `sharp` → stockage → `portrait.ready`.
3. Puis jobs `send-email` / lien WhatsApp. En cas d'échec : 1 nouvelle tentative, puis statut `failed`.

## Coûts plus tard (quand on quittera le gratuit)
fal.ai FLUX.1 Kontext [pro] 0,04 $/image ; WhatsApp utility Tunisie 0,004 $/message.
Congrès de 500 participants : environ 11 $ de services en ligne.
