<script setup>
import { ref, computed, onMounted, onUnmounted, provide } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from './supabase'

const session = ref(null)
const role = ref(null)
const route = useRoute()
const navRef = ref(null)
const themeRef = ref(null)
const openMenu = ref(null)
const sidebarOpen = ref(false)
const refreshTick = ref(0)

const estAdmin = computed(() => role.value === 'admin')
const peutEditer = computed(() => role.value === 'admin' || role.value === 'operateur')
provide('role', role)
provide('peutEditer', peutEditer)

const roleLabel = computed(() => ({ admin: 'Admin', operateur: 'Opérateur', lecteur: 'Lecteur' }[role.value] || ''))

const PROD = ['/plan', '/ordres', '/suivi', '/encours', '/conditionnement', '/dossier']
const PILOT = ['/ca', '/realisation-plan', '/rendement', '/dispo-equipements', '/avancement', '/effectifs', '/verification-ddl', '/audit', '/habilitations']
const prodActive = computed(() => PROD.includes(route.path))
const pilotActive = computed(() => PILOT.includes(route.path))

// --- Thèmes ---
const THEMES = [['clair', 'Clair'], ['ocean', 'Océan'], ['ardoise', 'Ardoise'], ['sombre', 'Sombre']]
const theme = ref('clair')
const zoom = ref(90)
function setZoom(z) {
  zoom.value = Math.max(70, Math.min(150, z))
  try { localStorage.setItem('ldmfab-zoom', String(zoom.value)) } catch (e) { /* ignore */ }
}
function changeZoom(d) { setZoom(zoom.value + d) }
function setTheme(t) {
  theme.value = t
  document.documentElement.dataset.theme = t
  try { localStorage.setItem('ldmfab-theme', t) } catch (e) { /* ignore */ }
  closeMenu()
}

function toggleMenu(name) { openMenu.value = openMenu.value === name ? null : name }
function closeMenu() { openMenu.value = null }
function onDocClick(e) {
  const inNav = navRef.value && navRef.value.contains(e.target)
  const inTheme = themeRef.value && themeRef.value.contains(e.target)
  if (!inNav && !inTheme) openMenu.value = null
}

async function chargerRole() {
  if (!session.value) { role.value = null; return }
  const r = await supabase.from('profils').select('role').eq('user_id', session.value.user.id).maybeSingle()
  role.value = r.data ? r.data.role : null
}

onMounted(async () => {
  try {
    const saved = localStorage.getItem('ldmfab-theme')
    if (saved) { theme.value = saved; document.documentElement.dataset.theme = saved }
    const sz = parseInt(localStorage.getItem('ldmfab-zoom') || '', 10)
    if (sz) zoom.value = Math.max(70, Math.min(150, sz))
  } catch (e) { /* ignore */ }
  document.addEventListener('click', onDocClick)
  const res = await supabase.auth.getSession()
  if (res.error) { console.error('getSession:', res.error.message); return }
  session.value = res.data.session
  await chargerRole()
  supabase.auth.onAuthStateChange(async (_event, s) => { session.value = s; await chargerRole() })
})
onUnmounted(() => document.removeEventListener('click', onDocClick))

async function signOut() {
  const res = await supabase.auth.signOut()
  if (res.error) { console.error('signOut:', res.error.message); return }
  session.value = null
  role.value = null
}
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <div class="side-brand">
        <span class="brand-mark" aria-hidden="true">L</span>
        <span class="brand-wm">LDM<span class="brand-sub">FAB3</span></span>
      </div>
      <nav class="side-nav">
        <RouterLink to="/" class="side-link" @click="sidebarOpen = false">Tableau de bord</RouterLink>
        <template v-if="session">
          <RouterLink to="/referentiels" class="side-link" @click="sidebarOpen = false">Référentiels</RouterLink>

          <div class="side-group">Production</div>
          <RouterLink to="/plan" class="side-link" @click="sidebarOpen = false">Plan directeur</RouterLink>
          <RouterLink to="/ordres" class="side-link" @click="sidebarOpen = false">Ordres de fabrication</RouterLink>
          <RouterLink to="/suivi" class="side-link" @click="sidebarOpen = false">Suivi fabrication</RouterLink>
          <RouterLink to="/encours" class="side-link" @click="sidebarOpen = false">En-cours</RouterLink>
          <RouterLink to="/conditionnement" class="side-link" @click="sidebarOpen = false">Conditionnement</RouterLink>
          <RouterLink to="/dossier" class="side-link" @click="sidebarOpen = false">Dossier de lot</RouterLink>

          <div class="side-group">Pilotage</div>
          <RouterLink to="/ca" class="side-link" @click="sidebarOpen = false">Chiffre d'affaires</RouterLink>
          <RouterLink to="/realisation-plan" class="side-link" @click="sidebarOpen = false">Réalisation vs Plan</RouterLink>
          <RouterLink to="/rendement" class="side-link" @click="sidebarOpen = false">Rendement</RouterLink>
          <RouterLink to="/dispo-equipements" class="side-link" @click="sidebarOpen = false">Disponibilité équipements</RouterLink>
          <RouterLink to="/avancement" class="side-link" @click="sidebarOpen = false">Suivi du process</RouterLink>
          <RouterLink to="/effectifs" class="side-link" @click="sidebarOpen = false">Effectifs</RouterLink>
          <RouterLink to="/verification-ddl" class="side-link" @click="sidebarOpen = false">Vérification DDL</RouterLink>
          <RouterLink to="/audit" class="side-link" @click="sidebarOpen = false">Journal d'audit</RouterLink>
          <RouterLink v-if="estAdmin" to="/habilitations" class="side-link" @click="sidebarOpen = false">Habilitations</RouterLink>
        </template>
      </nav>
      <div class="side-foot">
        <div class="theme-row" title="Thème">
          <button v-for="t in THEMES" :key="t[0]" class="theme-dot" :class="['sw-' + t[0], { sel: theme === t[0] }]" @click="setTheme(t[0])" :title="t[1]"></button>
        </div>
        <div class="foot-row">
          <div class="zoom-ctl" title="Zoom des pages">
            <button class="zoom-btn" @click="changeZoom(-10)" :disabled="zoom <= 70" title="Réduire">−</button>
            <button class="zoom-val" @click="setZoom(100)" title="Réinitialiser à 100 %">{{ zoom }}%</button>
            <button class="zoom-btn" @click="changeZoom(10)" :disabled="zoom >= 150" title="Agrandir">+</button>
          </div>
          <button class="zoom-btn solo" @click="refreshTick++" title="Actualiser les données">⟳</button>
        </div>
        <template v-if="session">
          <RouterLink to="/compte" class="side-link acct" @click="sidebarOpen = false">
            <span>Mon compte</span>
            <span v-if="role" class="role-badge" :class="'r-' + role">{{ roleLabel }}</span>
          </RouterLink>
          <button type="button" class="signout" @click="signOut">Déconnexion</button>
        </template>
        <RouterLink v-else to="/login" class="side-link" @click="sidebarOpen = false">Connexion</RouterLink>
      </div>
    </aside>

    <div v-if="sidebarOpen" class="side-backdrop" @click="sidebarOpen = false"></div>

    <div class="app-main">
      <header class="mobile-top">
        <button class="burger" @click="sidebarOpen = !sidebarOpen" aria-label="Ouvrir le menu">☰</button>
        <span class="brand-wm">LDM<span class="brand-sub">FAB3</span></span>
        <button class="zoom-btn solo" @click="refreshTick++" title="Actualiser" style="margin-left:auto">⟳</button>
      </header>
      <main :style="{ zoom: zoom / 100 }">
        <RouterView :key="route.fullPath + '::' + refreshTick" />
      </main>
    </div>
  </div>
</template>

<style>
* { box-sizing: border-box; }

:root {
  --bg: #f6f7f9;
  --text: #1b2733;
  --topbar: #0f2a33;
  --topbar-text: #ffffff;
  --topbar-muted: #cbd5e1;
  --topbar-border: #33505a;
  --accent-bright: #2dd4bf;
}
html[data-theme="ocean"]   { --bg: #eef4f9; --topbar: #0c4a6e; --topbar-muted: #bae6fd; --topbar-border: #1e6091; --accent-bright: #38bdf8; }
html[data-theme="ardoise"] { --bg: #eceff4; --topbar: #1e293b; --topbar-muted: #cbd5e1; --topbar-border: #475569; --accent-bright: #94a3b8; }
html[data-theme="sombre"]  { --bg: #0f172a; --text: #e6edf6; --topbar: #020617; --topbar-text: #f1f5f9; --topbar-muted: #94a3b8; --topbar-border: #334155; --accent-bright: #2dd4bf; color-scheme: dark; }

body { font-family: 'Inter', system-ui, -apple-system, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; margin: 0; background: var(--bg); color: var(--text); letter-spacing: -0.006em; }

.app-shell { display: flex; min-height: 100vh; }

/* ===== Barre latérale ===== */
.sidebar { width: 236px; flex-shrink: 0; background: var(--topbar); color: var(--topbar-text);
  display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh;
  box-shadow: 2px 0 14px rgba(0,0,0,.10); z-index: 40; }
.side-brand { display: flex; align-items: center; gap: 10px; padding: 16px 18px 12px; }
.brand-mark { width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; font-size: 16px; font-weight: 800;
  color: #06241f; background: linear-gradient(140deg, var(--accent-bright), #14b8a6); box-shadow: 0 2px 7px rgba(20,184,166,.4); flex-shrink: 0; }
.brand-wm { font-size: 16px; font-weight: 800; letter-spacing: .05em; }
.brand-sub { color: var(--accent-bright); margin-left: 3px; font-weight: 700; }

.side-nav { flex: 1; overflow-y: auto; padding: 4px 12px 12px; display: flex; flex-direction: column; gap: 1px; }
.side-nav::-webkit-scrollbar { width: 8px; }
.side-nav::-webkit-scrollbar-thumb { background: var(--topbar-border); border-radius: 8px; }
.side-group { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .09em;
  color: var(--topbar-muted); opacity: .65; padding: 14px 10px 5px; }
.side-link { display: flex; align-items: center; justify-content: space-between; gap: 8px;
  color: var(--topbar-muted); text-decoration: none; font-size: 13.5px; font-weight: 500;
  padding: 8px 11px; border-radius: 8px; white-space: nowrap; background: none; border: 0; cursor: pointer;
  font-family: inherit; text-align: left; width: 100%; position: relative; }
.side-link:hover { background: rgba(255,255,255,.06); color: var(--topbar-text); }
.side-nav a.router-link-exact-active { background: rgba(255,255,255,.10); color: var(--topbar-text); font-weight: 600; }
.side-nav a.router-link-exact-active::before { content: ""; position: absolute; left: -12px; top: 7px; bottom: 7px; width: 3px;
  border-radius: 0 3px 3px 0; background: var(--accent-bright); }

.side-foot { border-top: 1px solid var(--topbar-border); padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.theme-row { display: flex; gap: 8px; }
.theme-dot { width: 20px; height: 20px; border-radius: 6px; border: 1px solid rgba(255,255,255,.18); cursor: pointer; padding: 0; }
.theme-dot.sel { outline: 2px solid var(--accent-bright); outline-offset: 1px; }
.foot-row { display: flex; align-items: center; gap: 8px; }
.zoom-btn.solo { border: 1px solid var(--topbar-border); border-radius: 8px; width: 30px; height: 30px; }

/* ===== Zone principale & mobile ===== */
.app-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.mobile-top { display: none; }
.side-backdrop { display: none; }
@media (max-width: 900px) {
  .sidebar { position: fixed; top: 0; left: 0; height: 100vh; transform: translateX(-100%); transition: transform .25s ease; }
  .sidebar.open { transform: translateX(0); }
  .side-backdrop { display: block; position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 35; }
  .mobile-top { display: flex; align-items: center; gap: 12px; padding: 0 14px; height: 52px;
    background: var(--topbar); color: var(--topbar-text); position: sticky; top: 0; z-index: 20; box-shadow: 0 2px 10px rgba(0,0,0,.14); }
  .burger { background: none; border: 0; color: var(--topbar-text); font-size: 22px; cursor: pointer; padding: 4px; line-height: 1; }
}
.sw-clair { background: #0f2a33; }
.sw-ocean { background: #0c4a6e; }
.sw-ardoise { background: #1e293b; }
.sw-sombre { background: #020617; }

.role-badge { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; text-transform: uppercase; letter-spacing: .03em; }
.r-admin { background: #2dd4bf; color: #06322c; }
.r-operateur { background: #60a5fa; color: #0b2a5b; }
.r-lecteur { background: #94a3b8; color: #1b2733; }

.signout { background: transparent; color: var(--topbar-muted); border: 1px solid var(--topbar-border); padding: 7px 12px; border-radius: 8px; font-size: 13px; cursor: pointer; white-space: nowrap; width: 100%; }
.signout:hover { color: var(--topbar-text); border-color: var(--topbar-muted); background: rgba(255,255,255,.05); }

main { padding: 16px 22px; max-width: 1560px; margin: 0 auto; width: 100%; }

.error { color: #b91c1c; }

/* ===== Mode sombre : surfaces & textes (s'applique partout via les classes communes) ===== */
/* Texte clair sur tout le contenu (les conteneurs de page forçaient un texte foncé) */
html[data-theme="sombre"] .dash,
html[data-theme="sombre"] .ref-page,
html[data-theme="sombre"] .pdp-page,
html[data-theme="sombre"] .of-page,
html[data-theme="sombre"] .ph-page,
html[data-theme="sombre"] .ec-page,
html[data-theme="sombre"] .cd-page,
html[data-theme="sombre"] .dl-page,
html[data-theme="sombre"] .ca-page,
html[data-theme="sombre"] .ef-page,
html[data-theme="sombre"] .au-page,
html[data-theme="sombre"] .hb-page,
html[data-theme="sombre"] .mc-page,
html[data-theme="sombre"] .vd-page,
html[data-theme="sombre"] .rp-page { color: #e6edf6; }

html[data-theme="sombre"] .card,
html[data-theme="sombre"] .kpi,
html[data-theme="sombre"] .empty-card,
html[data-theme="sombre"] .welcome { background: #161f33 !important; border-color: #2a3650 !important; box-shadow: none !important; }
html[data-theme="sombre"] .drop-panel { background: #161f33 !important; border-color: #2a3650 !important; }
html[data-theme="sombre"] .drop-panel a,
html[data-theme="sombre"] .theme-item { color: #e6edf6 !important; }
html[data-theme="sombre"] .drop-panel a:hover,
html[data-theme="sombre"] .theme-item:hover { background: #243049 !important; }
html[data-theme="sombre"] .form-grid { background: #0f1830 !important; border-color: #2a3650 !important; }
html[data-theme="sombre"] .bar-track { background: #2a3650 !important; }
html[data-theme="sombre"] .count { background: #243049 !important; color: #cbd5e1 !important; }
html[data-theme="sombre"] input,
html[data-theme="sombre"] select,
html[data-theme="sombre"] textarea { background: #0f1830 !important; color: #e6edf6 !important; border-color: #2a3650 !important; }
html[data-theme="sombre"] .btn.ghost { background: #161f33 !important; color: #cbd5e1 !important; border-color: #2a3650 !important; }
html[data-theme="sombre"] table.grid th { color: #94a3b8 !important; border-color: #2a3650 !important; }
html[data-theme="sombre"] table.grid td { border-color: #1f2940 !important; }
html[data-theme="sombre"] table.grid tr:hover td { background: #1d2740 !important; }
html[data-theme="sombre"] table.mini td { border-color: #1f2940 !important; }
html[data-theme="sombre"] .prog-nom { color: #e6edf6 !important; }
html[data-theme="sombre"] .doc-title { border-bottom-color: #2a3650 !important; }
html[data-theme="sombre"] .block { border-bottom-color: #1f2940 !important; }
html[data-theme="sombre"] .lot-info { border-top-color: #1f2940 !important; }

@media print {
  .sidebar, .mobile-top, .side-backdrop { display: none !important; }
  .app-main, main { margin: 0; padding: 0; max-width: none; }
  main { padding: 0; max-width: none; }
}
.zoom-ctl { display: inline-flex; align-items: center; gap: 2px; border: 1px solid var(--topbar-border); border-radius: 8px; padding: 2px; margin-right: 4px; }
.zoom-btn, .zoom-val { background: transparent; border: none; color: var(--topbar-muted); cursor: pointer; font-family: inherit; border-radius: 6px; }
.zoom-btn { width: 24px; height: 24px; font-size: 17px; line-height: 1; display: flex; align-items: center; justify-content: center; }
.zoom-btn:hover:not(:disabled) { background: rgba(255,255,255,0.14); color: #fff; }
.zoom-btn:disabled { opacity: 0.35; cursor: default; }
.zoom-val { min-width: 44px; font-size: 12px; font-weight: 600; padding: 4px 4px; }
.zoom-val:hover { background: rgba(255,255,255,0.14); color: #fff; }

/* ===== Mode compact — densité maximale (s'applique à toutes les pages) ===== */
.card { padding: 13px 16px !important; margin-bottom: 12px !important; border-radius: 14px !important; box-shadow: 0 1px 2px rgba(16,24,40,.04), 0 8px 20px -12px rgba(16,24,40,.18) !important; }
.kpi { padding: 11px 14px !important; border-radius: 13px !important; transition: box-shadow .18s ease; }
.kpi:hover { box-shadow: 0 1px 2px rgba(16,24,40,.04), 0 10px 22px -10px rgba(16,24,40,.22) !important; }
.kpi-val { font-size: 18px !important; line-height: 1.15 !important; white-space: nowrap !important; font-variant-numeric: tabular-nums; }
.kpi-grid { gap: 9px !important; }
.grid th, .grid td { padding: 5px 8px !important; }
.grid th { font-size: 11px !important; }
.card-title { margin: 0 0 9px !important; font-size: 15px !important; }
.card-head { margin-bottom: 9px !important; }
h1 { font-size: 20px !important; }
h2 { font-size: 17px !important; }
.sub { margin-top: 3px !important; font-size: 13px !important; }

/* ===== Badges d'icônes des KPI (toutes les pages) ===== */
.kpi-top { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.kpi-ic { width: 28px; height: 28px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.kpi-ic svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

/* ===== Modernisation : transitions & focus visibles ===== */
.side-link { transition: background .15s ease, color .15s ease; }
.btn, .signout, .zoom-btn, .zoom-val, .theme-dot { transition: background .15s ease, color .15s ease, border-color .15s ease; }
a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
  outline: 2px solid var(--accent-bright); outline-offset: 2px; border-radius: 5px;
}
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
</style>
