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
  <header class="topbar">
    <div class="brand">LDM-FAB3</div>

    <nav class="nav" ref="navRef">
      <RouterLink to="/" class="navlink">Tableau de bord</RouterLink>

      <template v-if="session">
        <RouterLink to="/referentiels" class="navlink">Référentiels</RouterLink>

        <div class="dropdown">
          <button class="navlink drop-toggle" :class="{ open: openMenu === 'production', active: prodActive }" @click="toggleMenu('production')">
            Production <span class="caret">▾</span>
          </button>
          <div v-show="openMenu === 'production'" class="drop-panel">
            <RouterLink to="/plan" @click="closeMenu">Plan directeur</RouterLink>
            <RouterLink to="/ordres" @click="closeMenu">Ordres de fabrication</RouterLink>
            <RouterLink to="/suivi" @click="closeMenu">Suivi fabrication</RouterLink>
            <RouterLink to="/encours" @click="closeMenu">En-cours</RouterLink>
            <RouterLink to="/conditionnement" @click="closeMenu">Conditionnement</RouterLink>
            <RouterLink to="/dossier" @click="closeMenu">Dossier de lot</RouterLink>
          </div>
        </div>

        <div class="dropdown">
          <button class="navlink drop-toggle" :class="{ open: openMenu === 'pilotage', active: pilotActive }" @click="toggleMenu('pilotage')">
            Pilotage <span class="caret">▾</span>
          </button>
          <div v-show="openMenu === 'pilotage'" class="drop-panel">
            <RouterLink to="/ca" @click="closeMenu">Chiffre d'affaires</RouterLink>
            <RouterLink to="/realisation-plan" @click="closeMenu">Réalisation vs Plan</RouterLink>
            <RouterLink to="/rendement" @click="closeMenu">Rendement</RouterLink>
            <RouterLink to="/dispo-equipements" @click="closeMenu">Disponibilité par équipement</RouterLink>
            <RouterLink to="/avancement" @click="closeMenu">Suivi du process</RouterLink>
            <RouterLink to="/effectifs" @click="closeMenu">Effectifs</RouterLink>
            <RouterLink to="/verification-ddl" @click="closeMenu">Vérification DDL</RouterLink>
            <RouterLink to="/audit" @click="closeMenu">Journal d'audit</RouterLink>
            <RouterLink v-if="estAdmin" to="/habilitations" @click="closeMenu">Habilitations</RouterLink>
          </div>
        </div>
      </template>
    </nav>

    <div class="topbar-right">
      <div class="zoom-ctl" title="Zoom des pages">
        <button class="zoom-btn" @click="changeZoom(-10)" :disabled="zoom <= 70" title="Réduire">−</button>
        <button class="zoom-val" @click="setZoom(100)" title="Réinitialiser à 100 %">{{ zoom }}%</button>
        <button class="zoom-btn" @click="changeZoom(10)" :disabled="zoom >= 150" title="Agrandir">+</button>
      </div>
      <button class="zoom-btn" @click="refreshTick++" title="Actualiser les données de la page" style="margin-left:4px">⟳</button>
      <div class="dropdown" ref="themeRef">
        <button class="navlink drop-toggle" :class="{ open: openMenu === 'theme' }" @click="toggleMenu('theme')" title="Changer de thème">
          <span class="swatch" :class="'sw-' + theme"></span>Thème <span class="caret">▾</span>
        </button>
        <div v-show="openMenu === 'theme'" class="drop-panel theme-panel">
          <button v-for="t in THEMES" :key="t[0]" class="theme-item" :class="{ sel: theme === t[0] }" @click="setTheme(t[0])">
            <span class="swatch" :class="'sw-' + t[0]"></span>
            <span class="theme-name">{{ t[1] }}</span>
            <span v-if="theme === t[0]" class="chk">✓</span>
          </button>
        </div>
      </div>

      <RouterLink v-if="session" to="/compte" class="navlink">Mon compte</RouterLink>
      <span v-if="session && role" class="role-badge" :class="'r-' + role">{{ roleLabel }}</span>
      <RouterLink v-if="!session" to="/login" class="navlink">Connexion</RouterLink>
      <button v-else type="button" class="signout" @click="signOut">Déconnexion</button>
    </div>
  </header>
  <main :style="{ zoom: zoom / 100 }">
    <RouterView :key="route.fullPath + '::' + refreshTick" />
  </main>
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

body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 0; background: var(--bg); color: var(--text); }

.topbar { display: flex; align-items: center; gap: 22px; padding: 0 20px; height: 56px;
  background: var(--topbar); color: var(--topbar-text); box-shadow: 0 1px 3px rgba(0,0,0,.12); position: sticky; top: 0; z-index: 30; }
.brand { font-weight: 700; letter-spacing: .02em; white-space: nowrap; }
.nav { display: flex; gap: 20px; align-items: center; }
.topbar-right { margin-left: auto; display: flex; align-items: center; gap: 14px; }

.navlink { color: var(--topbar-muted); text-decoration: none; font-size: 14px; font-weight: 500; padding: 4px 0;
  white-space: nowrap; background: none; border: 0; border-bottom: 2px solid transparent; cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 5px; }
.navlink:hover { color: var(--topbar-text); }
.nav a.router-link-exact-active { color: var(--topbar-text); border-bottom-color: var(--accent-bright); }
.drop-toggle.active { color: var(--topbar-text); border-bottom-color: var(--accent-bright); }
.caret { font-size: 10px; transition: transform .15s; }
.drop-toggle.open .caret { transform: rotate(180deg); }

.dropdown { position: relative; }
.drop-panel { position: absolute; top: calc(100% + 8px); left: 0; min-width: 210px; background: #fff;
  border: 1px solid #e2e8f0; border-radius: 10px; box-shadow: 0 8px 24px rgba(16,24,40,.14); padding: 6px; z-index: 50; }
.drop-panel a { display: block; color: #1b2733; text-decoration: none; font-size: 14px; padding: 8px 12px; border-radius: 7px; white-space: nowrap; }
.drop-panel a:hover { background: #f1f5f9; }
.drop-panel a.router-link-exact-active { background: #ecfdf5; color: #0f766e; font-weight: 600; }

/* Sélecteur de thème */
.theme-panel { right: 0; left: auto; min-width: 170px; }
.theme-item { display: flex; align-items: center; gap: 10px; width: 100%; background: none; border: 0; cursor: pointer;
  font-size: 14px; color: #1b2733; padding: 8px 12px; border-radius: 7px; font-family: inherit; text-align: left; }
.theme-item:hover { background: #f1f5f9; }
.theme-item.sel { font-weight: 600; }
.theme-name { flex: 1; }
.chk { color: #0f766e; font-weight: 700; }
.swatch { width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; border: 1px solid rgba(0,0,0,.15); display: inline-block; }
.sw-clair { background: #0f2a33; }
.sw-ocean { background: #0c4a6e; }
.sw-ardoise { background: #1e293b; }
.sw-sombre { background: #020617; }

.role-badge { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; text-transform: uppercase; letter-spacing: .03em; }
.r-admin { background: #2dd4bf; color: #06322c; }
.r-operateur { background: #60a5fa; color: #0b2a5b; }
.r-lecteur { background: #94a3b8; color: #1b2733; }

.signout { background: transparent; color: var(--topbar-muted); border: 1px solid var(--topbar-border); padding: 5px 12px; border-radius: 7px; font-size: 13px; cursor: pointer; white-space: nowrap; }
.signout:hover { color: var(--topbar-text); border-color: var(--topbar-muted); }

main { padding: 12px 20px; max-width: 1560px; margin: 0 auto; }

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
  .topbar { display: none !important; }
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
.card { padding: 12px 15px !important; margin-bottom: 12px !important; }
.kpi { padding: 11px 14px !important; }
.kpi-val { font-size: 18px !important; line-height: 1.15 !important; white-space: nowrap !important; }
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
</style>
