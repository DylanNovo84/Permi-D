# 🚌 Ligne D — Mise en ligne facile (sans terminal, tout à la souris)

Pas besoin d'ordinateur puissant ni de taper de commandes. Juste 2 sites web,
et à chaque fois : glisser-déposer + cliquer.

## Étape 1 — Mettre le dossier sur GitHub (5 min)

1. Va sur **[github.com](https://github.com)** → **Sign up** (crée un compte, email + mot de passe).
2. Une fois connecté, clique le **+** en haut à droite → **New repository**.
3. Donne-lui un nom (ex. `ligne-d`), laisse le reste par défaut → **Create repository**.
4. Sur la page qui s'affiche, clique le lien **« uploading an existing file »**.
5. **Dézippe** le fichier `permis-bus-app.zip` sur ton ordinateur, puis **glisse tout le
   contenu du dossier** (`server.js`, `package.json`, `public/`, `render.yaml`, etc. —
   pas le dossier lui-même, ce qu'il y a dedans) dans la zone de dépôt du navigateur.
6. En bas de page, clique **Commit changes**. C'est fini pour GitHub.

## Étape 2 — Mettre en ligne sur Render (3 min, aucune saisie technique)

1. Va sur **[render.com](https://render.com)** → **Get Started** → choisis
   **« Sign up with GitHub »** (un seul clic, pas de nouveau mot de passe à retenir).
2. Clique **New +** → **Blueprint**.
3. Sélectionne le dépôt `ligne-d` que tu viens de créer.
4. Render détecte automatiquement le fichier `render.yaml` inclus dans le projet et
   **remplit tout tout seul** (build, démarrage, mot de passe secret généré
   automatiquement). Tu n'as rien à taper.
5. Clique **Apply** (ou **Create**). Attends 2-3 minutes que ça se construise.

Une fois terminé, Render t'affiche ton adresse fixe, du genre :
`https://ligne-d-permis-bus.onrender.com`

C'est cette adresse que tu ouvres sur ton téléphone ou ton PC, de partout. Tu peux
créer ton compte (nom d'utilisateur + mot de passe) directement dessus.

## À savoir

- Sur le plan gratuit de Render, le site peut mettre 30-60 secondes à se "réveiller"
  s'il n'a pas été utilisé depuis un moment (première ouverture un peu lente, normal).
- Sur le plan gratuit, les données peuvent être remises à zéro si le service redémarre
  après un long moment d'inactivité (limite du stockage fichier gratuit). Si tu veux
  que ce soit garanti permanent, dis-le-moi : je peux brancher une vraie base de
  données gratuite (Supabase) à la place, ça ne change rien à ce que tu as à faire
  toi-même, juste le fichier `server.js` en coulisses.
