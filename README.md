# LDM-FAB3

Front statique **Vite + Vue 3** → **GitHub Pages**, données/auth via **Supabase** (Postgres + Auth + RLS).
Aucun autre backend ni hébergeur. Déploiement automatique à chaque `git push` sur `main`.

Repo : `hammoudildm-crypto/LDM-FAB3` · URL Pages : `https://hammoudildm-crypto.github.io/LDM-FAB3/`

---

## ✅ Déjà configuré

`vite.config.js` est déjà réglé sur ce repo (`base: '/LDM-FAB3/'`). Rien à modifier ici.
Le routeur (hash mode) réutilise cette valeur via `import.meta.env.BASE_URL`.
(Si un jour tu renommes le repo, change uniquement la ligne `base`.)

---

## Réglages manuels (une seule fois — à faire à la main)

1. **Supabase** : créer le projet → *Settings → API* → copier l'**URL** et la clé **publishable** (`sb_publishable_…`).
2. **Supabase** : *SQL Editor* → exécuter `supabase/migrations/001_init.sql`.
3. **Supabase** : *Authentication → URL Configuration* → mettre l'URL Pages
   (`https://hammoudildm-crypto.github.io/LDM-FAB3/`) dans *Site URL* et *Redirect URLs* (sinon le lien magique ne revient pas sur l'app).
4. **GitHub** : *Settings → Secrets and variables → Actions* → ajouter
   `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (pour le build CI).
5. **GitHub** : *Settings → Pages → Source = GitHub Actions*.

---

## Démarrage local

```bash
npm install           # 1re fois
cp .env.example .env   # puis colle ton URL + clé publishable dans .env (jamais committé)
npm run dev           # http://localhost:5173/LDM-FAB3/
```

---

## Workflow récurrent

```bash
# 1. éditer le code en local
npm run build        # valide que ça compile
npm run dev          # vérifie en local
git add -A && git commit -m "…" && git push   # sur main
# → GitHub Actions build + déploie sur Pages (~1-2 min)
# → recharger en Ctrl+Shift+R
```

---

## Conventions

- **Variables** : tout passe par `VITE_…` (`.env` local / secrets CI). Jamais de clé en dur. Jamais la `service_role` côté front.
- **Supabase** : on ne `throw` jamais. On vérifie **`res.error` après chaque appel** (voir `src/views/Home.vue`).
- **SQL** : migrations versionnées `NNN_*.sql`. Chaque table → RLS activé + 4 policies (`select/insert/update/delete` `to authenticated`).
- **Routeur** : hash mode obligatoire (`createWebHashHistory`) pour éviter les 404 au refresh sur Pages.

---

## Structure

```
.
├── .github/workflows/deploy.yml   # build + déploiement Pages
├── public/.nojekyll               # évite tout traitement Jekyll
├── src/
│   ├── supabase.js                # client (lit les VITE_…)
│   ├── main.js
│   ├── App.vue                    # session auth + nav
│   ├── router/index.js            # hash mode
│   └── views/{Home,Login}.vue     # exemples lecture/écriture + magic link
├── supabase/migrations/001_init.sql
├── .env.example                   # template (committé) → cp en .env
├── vite.config.js                 # base = nom du repo
└── package.json
```
