# Pesée — Calcul API / Excipient (LDM)

Application **autonome** dédiée au calcul de pesée (par fraction, multi-API, correction
de titre, compensation de l'excipient, fiche de pesée imprimable).

Extraite de ProdTrack (LDM-FAB3), elle pointe sur la **même base Supabase** :
- lecture des **produits** et de la **config titres** (`produits`, `pesee_config`) ;
- enregistrement et historique des pesées (table `pesees`, 50 dernières).

Aucune duplication de données : les fiches restent centralisées avec le reste du système.

---

## Mise en ligne (GitHub Pages) — une seule fois

1. Crée un dépôt GitHub **`LDM-PESEE`** sous le compte `hammoudildm-crypto`
   (le même que ProdTrack). Laisse-le vide, sans README.
2. Dépose **tout le contenu de ce dossier** à la racine du dépôt
   (glisser-déposer sur github.com → *Add file* → *Upload files*, ou via github.dev).
   Garde bien l'arborescence : `index.html`, `package.json`, `vite.config.js`,
   `src/…`, `public/…`, `.github/workflows/deploy.yml`.
3. Dans le dépôt : **Settings → Pages → Build and deployment → Source = GitHub Actions**.
4. Le workflow `Deploy` se lance à chaque push sur `main` et publie le site sous
   **https://hammoudildm-crypto.github.io/LDM-PESEE/**

> **Nom de dépôt différent ?** Change **uniquement** la ligne `base:` dans
> `vite.config.js` pour qu'elle corresponde (ex. dépôt `pesee` → `base: '/pesee/'`).
> C'est la seule ligne à adapter.

Aucun secret à configurer : l'URL et la clé *publishable* Supabase sont en clair dans
`src/supabase.js` (ces deux valeurs sont de toute façon visibles côté navigateur ; ce
sont les règles RLS de Supabase qui protègent les données).

---

## Développement local (optionnel)

```bash
npm install
npm run dev      # serveur local Vite
npm run build    # build de production dans dist/
npm run preview  # prévisualise le build
```

## Pile technique

Vue 3 (`<script setup>`) · Vite 8 · @supabase/supabase-js — SPA statique, sans routeur
(une seule page). Mêmes versions que ProdTrack pour rester cohérent.

## Structure

```
LDM-PESEE/
├─ index.html                     entrée Vite
├─ package.json / vite.config.js
├─ .github/workflows/deploy.yml   publication GitHub Pages
├─ public/                        icônes + manifest PWA + .nojekyll
└─ src/
   ├─ main.js                     monte l'app
   ├─ App.vue                     coquille (fond, police, fournit peutEditer)
   ├─ supabase.js                 client Supabase (même base que ProdTrack)
   ├─ components/PageHeader.vue
   └─ views/CalculPesee.vue       l'outil de pesée (identique à ProdTrack)
```

## Lien avec ProdTrack

`CalculPesee.vue` et `PageHeader.vue` sont **identiques** à ceux de ProdTrack.
Si tu fais évoluer le calcul de pesée dans un projet, reporte la même version de
`CalculPesee.vue` dans l'autre pour garder les deux en phase.
