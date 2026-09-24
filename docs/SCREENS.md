# Badgi Studio — écrans et design

## Design
- Polices : **Bricolage Grotesque** 600/800 (titres), **Figtree** 400–700 (texte) — Google Fonts.
- Couleurs : fond `#F4F6F5`, texte `#0E1B2C`, texte secondaire `#3F4D5C` / `#4A5868`, bordures `#C9D2D0` / `#E3E8E7`,
  accent teal `#0B6E69` (clair `#DDEFEC`, vif sur fond sombre `#5FD3C8`), accent corail `#C4502F` (clair `#F8DDD3`).
- Teintes par style : Pro `#DDE5EE`/`#2D4A6B`, Caricature `#F8DDD3`/`#9A3B20`, Peint `#E9DCC2` + bleu `#2C6FB0`.
- Bouton principal : fond `#0E1B2C`, texte blanc, hauteur 96–104 px, rayon 24 px. Cibles tactiles ≥ 44 px.
- Icônes : SVG au trait (lucide-react), jamais d'emoji.
- Borne : tablette portrait **820×1180**, padding 40/56 px. Mur : **1920×1080** fond `#0E1B2C`. Tableau de bord : desktop 1440.

## Borne (tablette)
1. **Accueil** — logo « badgi » + badge « Studio », sélecteur FR/EN/ع ; nom du congrès (majuscules teal) ;
   titre 76 px « Votre portrait IA en 30 secondes. » ; 3 cartes d'exemples illustrés (étiquette « Exemple fictif ») :
   Portrait pro, Caricature spécialité, Portrait peint ; bouton « Touchez pour commencer » ; « Offert par [logo sponsor] ».
2. **Identification** — retour + « Étape 1 sur 4 » ; « Qui êtes-vous ? » ; carte bordée teal « Scanner mon badge Badgi »
   (badge « Recommandé ») avec aperçu caméra sombre et cadre de visée ; séparateur « ou » ; bouton « Saisir mes informations ».
3a. **Saisie manuelle** — Prénom*, Nom*, Email, WhatsApp (sélecteur +216 + numéro), Spécialité (facultatif) ;
   note « Email ou WhatsApp : au moins l'un des deux » ; bouton « Continuer ».
3b. **Badge reconnu** — bandeau vert « Badge reconnu » ; « Bonjour Dr Amira ! » ; liste Nom, Spécialité, Établissement,
   Email masqué (étiquette « Badge ») ; champ WhatsApp facultatif ; lien « Ce n'est pas moi » ; « C'est bien moi, continuer ».
4. **Style et consentement** — 3 cartes-boutons (vignette 150×150, nom, description, coche sur la sélection) ;
   3 cases de consentement ; mention purge J+30 + lien confidentialité ; bouton « Prendre ma photo ».
5. **Capture** — fond sombre ; aperçu caméra avec ovale en pointillés ; compte à rebours géant 3-2-1 ;
   « Placez votre visage dans l'ovale et souriez » ; boutons « Groupe (jusqu'à 4) » (V2) et déclencheur.
6. **Génération** — vignette du selfie, « Votre portrait prend forme… », barre de progression, étapes (photo vérifiée,
   génération, cadre, envoi) ; encart sombre du sponsor.
6b. **Dessin en direct** — badge du style ; « L'artiste IA vous dessine… » ; feuille blanche avec badge « EN DIRECT »,
   le portrait se dessine trait par trait (SVG `stroke-dashoffset` animé) puis les couleurs apparaissent, crayon animé ;
   étapes Esquisse → Encrage → Couleurs → Cadre du congrès, pilotées par l'événement `portrait.progress`.
   Implémentation MVP : animation de révélation sur l'image finale (masque de dessin / filtre contour puis fondu couleur).
7. **Résultat** — « Voilà, Amira ! » + compte à rebours de retour ; portrait encadré (nom, congrès, sponsor) ;
   statuts « Envoyé sur WhatsApp » / « Envoyé par email » ; QR « Scannez pour télécharger en HD » ;
   boutons « Imprimer » (V2) et « Essayer un autre style » ; lien « Terminer ».

## Mur du congrès (1920×1080)
Titre « Mur des participants » + nom du congrès ; compteur de portraits ; encart « Votre portrait ? Borne Studio · Hall B » ;
dernier portrait en grand (badge « Nouveau », bordure `#5FD3C8`) ; grille 5×2 des portraits récents (nom + spécialité) ;
pied : prochaine session, logo sponsor, « badgi Studio ».

## Tableau de bord organisateur
Barre latérale sombre (Événements, Participants, Badges, **Studio IA**, Mur, Sponsors, Statistiques, Paramètres) ;
5 indicateurs (portraits générés, envoyés WhatsApp, emails, impressions, coût IA) ; bornes (statut en ligne) ;
styles proposés (cases à cocher + nombre) ; file de modération (Rejeter/Approuver, Retirer/Épingler).

## Message reçu par le participant
Image du portrait encadré + « Bonjour Amira, voici votre portrait du [congrès]. Version HD et galerie : badgi.net/p/[CODE] ».
