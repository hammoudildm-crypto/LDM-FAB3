<script setup>
import { ref, computed, onMounted, onUnmounted, provide, watch } from 'vue'
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
// --- Synchronisation périodique automatique (recharge les pages de consultation) ---
const AUTO_REFRESH_MS = 120000 // 2 minutes
const ROUTES_SANS_AUTO = ['/ordres', '/suivi', '/conditionnement', '/plan', '/referentiels', '/habilitations', '/effectifs', '/verification-ddl', '/compte', '/login']
let autoRefreshTimer = null
function autoRefresh() {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
  if (ROUTES_SANS_AUTO.includes(route.path)) return  // ne pas interrompre un écran de saisie
  refreshTick.value++
}

const estAdmin = computed(() => role.value === 'admin')
const peutEditer = computed(() => role.value === 'admin' || role.value === 'operateur')
provide('role', role)
provide('peutEditer', peutEditer)

const roleLabel = computed(() => ({ admin: 'Admin', operateur: 'Opérateur', lecteur: 'Lecteur' }[role.value] || ''))
// --- Présence temps réel : qui est en ligne ---
const enLigne = ref([])
let canalPresence = null
function nomEnLigne(u) { return u.email ? u.email.split('@')[0] : 'Utilisateur' }
function demarrerPresence() {
  if (!session.value || canalPresence) return
  const u = session.value.user
  canalPresence = supabase.channel('presence-app', { config: { presence: { key: u.id } } })
  canalPresence.on('presence', { event: 'sync' }, () => {
    const etat = canalPresence.presenceState()
    enLigne.value = Object.entries(etat).map(([id, arr]) => ({ id, ...(arr[0] || {}) }))
  })
  canalPresence.subscribe(async (statut) => {
    if (statut === 'SUBSCRIBED') await canalPresence.track({ email: u.email, role: role.value, online_at: new Date().toISOString() })
  })
}
function arreterPresence() {
  if (canalPresence) { supabase.removeChannel(canalPresence); canalPresence = null }
  enLigne.value = []
}

// --- Navigation par rôle, en groupes repliables ---
const LINK_ICONS = {
  '/': '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  '/realisation-plan': '<path d="M3 3v18h18"/><path d="M18 9l-5 5-3-3-4 4"/>',
  '/rendement': '<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  '/ca': '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  '/dispo-equipements': '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  '/avancement': '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  '/production-atelier': '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  '/encours': '<path d="M5 22h14M5 2h14M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2"/>',
  '/dossier': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  '/audit': '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>',
  '/plan': '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  '/ordres': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/>',
  '/suivi': '<path d="M9 2v6l-5 9a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-5-9V2"/><line x1="8" y1="2" x2="16" y2="2"/>',
  '/conditionnement': '<path d="M21 8l-9-5-9 5v8l9 5 9-5V8z"/><polyline points="3 8 12 13 21 8"/><line x1="12" y1="13" x2="12" y2="21"/>',
  '/verification-ddl': '<circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/>',
  '/effectifs': '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  '/referentiels': '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  '/habilitations': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
}
const NAV_GROUPS = [
  { key: 'consultation', label: 'Consultation', role: null, icon: '<path d="M3 3v18h18"/><polyline points="7 13 11 9 14 12 20 6"/>', links: [
    ['/realisation-plan', 'Réalisation vs Plan'],
    ['/rendement', 'Rendement'],
    ['/ca', "Chiffre d'affaires"],
    ['/dispo-equipements', 'Disponibilité équipements'],
    ['/avancement', 'Suivi du process'],
    ['/production-atelier', 'Production par atelier'],
    ['/encours', 'En-cours'],
    ['/dossier', 'Dossier de lot'],
    ['/audit', "Journal d'audit"],
  ] },
  { key: 'production', label: 'Production & saisie', role: 'edit', icon: '<path d="M2 20h20"/><path d="M4 20V9l5 3V9l5 3V5l5 3v12"/>', links: [
    ['/plan', 'Plan directeur'],
    ['/ordres', 'Ordres de fabrication'],
    ['/suivi', 'Suivi fabrication'],
    ['/conditionnement', 'Conditionnement'],
    ['/verification-ddl', 'Vérification DDL'],
    ['/effectifs', 'Effectifs'],
  ] },
  { key: 'admin', label: 'Administration', role: 'admin', icon: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>', links: [
    ['/referentiels', 'Référentiels'],
    ['/habilitations', 'Habilitations'],
  ] },
]
function groupVisible(g) {
  if (g.role === 'edit') return peutEditer.value
  if (g.role === 'admin') return estAdmin.value
  return true
}
const openGroups = ref(new Set())
function toggleGroup(key) {
  // Accordéon : un seul groupe ouvert à la fois
  openGroups.value = openGroups.value.has(key) ? new Set() : new Set([key])
}
// Déplier automatiquement le groupe de la page active (et fermer les autres)
function ouvrirGroupeActif(p) {
  const g = NAV_GROUPS.find(gr => gr.links.some(l => l[0] === p))
  if (g) openGroups.value = new Set([g.key])
}
watch(() => route.path, (p) => ouvrirGroupeActif(p))

const PROD = ['/plan', '/ordres', '/suivi', '/encours', '/conditionnement', '/dossier']
const PILOT = ['/ca', '/realisation-plan', '/rendement', '/dispo-equipements', '/avancement', '/production-atelier', '/effectifs', '/verification-ddl', '/audit', '/habilitations']
const prodActive = computed(() => PROD.includes(route.path))
const pilotActive = computed(() => PILOT.includes(route.path))

// --- Thèmes ---
const THEMES = [['clair', 'Clair'], ['indigo', 'Indigo'], ['emeraude', 'Émeraude'], ['violet', 'Violet'], ['ocean', 'Océan'], ['ardoise', 'Ardoise'], ['sombre', 'Sombre'], ['minuit', 'Minuit']]
const theme = ref('clair')
const themeOuvert = ref(false)
const zoom = ref(90)
function setZoom(z) {
  zoom.value = Math.max(20, Math.min(200, z))
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
  if (!session.value) { role.value = null; arreterPresence(); return }
  const r = await supabase.from('profils').select('role').eq('user_id', session.value.user.id).maybeSingle()
  role.value = r.data ? r.data.role : null
  demarrerPresence()
}

// --- Alertes : OF dont la validité expire sous 3 jours (et non encore fabriqués) ---
const alertes = ref([])
const alertesFermees = ref(false)
const alertesOuvertes = ref(false)
async function chargerAlertes() {
  if (!session.value) { alertes.value = []; return }
  const auj = new Date()
  const limite = new Date(auj.getTime() + 3 * 86400000).toISOString().slice(0, 10)
  const r = await supabase.from('ordres_fabrication')
    .select('id, numero_lot, date_fin_validite, produits(code_pf, designation)')
    .eq('actif', true)
    .not('date_fin_validite', 'is', null)
    .is('date_fin_fabrication', null)
    .lte('date_fin_validite', limite)
  if (r.error) { console.error('alertes:', r.error.message); return }
  alertes.value = (r.data || []).map(o => ({
    id: o.id, lot: o.numero_lot || '—',
    code: o.produits ? o.produits.code_pf : '',
    desig: o.produits ? o.produits.designation : '',
    date: o.date_fin_validite,
    dateStr: new Date(o.date_fin_validite).toLocaleDateString('fr-FR'),
    jours: Math.ceil((new Date(o.date_fin_validite) - auj) / 86400000)
  })).sort((a, b) => a.jours - b.jours)
  notifierNavigateur()
}
let dejaNotifie = false
function notifierNavigateur() {
  if (dejaNotifie || !alertes.value.length || typeof Notification === 'undefined') return
  const envoyer = () => {
    dejaNotifie = true
    try {
      new Notification('ProdTrack — Validité OF', {
        body: alertes.value.length + ' ordre(s) de fabrication expire(nt) sous 3 jours.',
        tag: 'ldmfab-validite'
      })
    } catch (e) { /* ignore */ }
  }
  if (Notification.permission === 'granted') envoyer()
  else if (Notification.permission !== 'denied') Notification.requestPermission().then(p => { if (p === 'granted') envoyer() })
}

onMounted(async () => {
  try {
    const saved = localStorage.getItem('ldmfab-theme')
    if (saved) { theme.value = saved; document.documentElement.dataset.theme = saved }
    const sz = parseInt(localStorage.getItem('ldmfab-zoom') || '', 10)
    if (sz) zoom.value = Math.max(20, Math.min(200, sz))
  } catch (e) { /* ignore */ }
  document.addEventListener('click', onDocClick)
  const res = await supabase.auth.getSession()
  if (res.error) { console.error('getSession:', res.error.message); return }
  session.value = res.data.session
  await chargerRole()
  await chargerAlertes()
  supabase.auth.onAuthStateChange(async (_event, s) => { session.value = s; await chargerRole(); await chargerAlertes() })
  autoRefreshTimer = setInterval(autoRefresh, AUTO_REFRESH_MS)
  window.addEventListener('focus', autoRefresh)
})
onUnmounted(() => { document.removeEventListener('click', onDocClick); arreterPresence(); if (autoRefreshTimer) clearInterval(autoRefreshTimer); window.removeEventListener('focus', autoRefresh) })

async function signOut() {
  arreterPresence()
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
        <span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="19" height="19" fill="none"><path d="M4 16 L10 11 L15 14 L20 6" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="4" cy="16" r="1.7" fill="#fff"/><circle cx="10" cy="11" r="1.7" fill="#fff"/><circle cx="15" cy="14" r="1.7" fill="#fff"/><circle cx="20" cy="6" r="1.7" fill="#fff"/></svg></span>
        <span class="brand-wm">Prod<span class="brand-sub">Track</span></span>
      </div>
      <nav class="side-nav">
        <RouterLink to="/" class="side-link" @click="sidebarOpen = false"><span class="link-in"><span class="link-ic"><svg viewBox="0 0 24 24" v-html="LINK_ICONS['/']"></svg></span>Tableau de bord</span></RouterLink>
        <template v-if="session">
          <template v-for="g in NAV_GROUPS" :key="g.key">
            <div v-if="groupVisible(g)" class="nav-group" :class="{ open: openGroups.has(g.key) }">
              <button class="side-group side-group-btn" :class="{ open: openGroups.has(g.key) }" @click="toggleGroup(g.key)">
                <span class="grp-label"><span class="grp-ic"><svg viewBox="0 0 24 24" v-html="g.icon"></svg></span>{{ g.label }}</span>
                <span class="grp-caret">▾</span>
              </button>
              <div v-show="openGroups.has(g.key)" class="grp-links">
                <RouterLink v-for="l in g.links" :key="l[0]" :to="l[0]" class="side-link" @click="sidebarOpen = false"><span class="link-in"><span class="link-ic"><svg viewBox="0 0 24 24" v-html="LINK_ICONS[l[0]]"></svg></span>{{ l[1] }}</span></RouterLink>
              </div>
            </div>
          </template>
        </template>
      </nav>
      <div class="side-foot">
        <button class="theme-toggle" @click="themeOuvert = !themeOuvert" :class="{ open: themeOuvert }">
          <span class="tt-left"><span class="tt-dot" :class="'sw-' + theme"></span>Thème</span>
          <span class="grp-caret">▾</span>
        </button>
        <div v-show="themeOuvert" class="theme-row" title="Thème">
          <button v-for="t in THEMES" :key="t[0]" class="theme-dot" :class="['sw-' + t[0], { sel: theme === t[0] }]" @click="setTheme(t[0])" :title="t[1]"></button>
        </div>
        <div class="foot-row">
          <div class="zoom-ctl" title="Zoom des pages">
            <button class="zoom-btn" @click="changeZoom(-5)" :disabled="zoom <= 20" title="Réduire">−</button>
            <button class="zoom-val" @click="setZoom(100)" title="Réinitialiser à 100 %">{{ zoom }}%</button>
            <button class="zoom-btn" @click="changeZoom(5)" :disabled="zoom >= 200" title="Agrandir">+</button>
          </div>
          <button class="zoom-btn solo" @click="refreshTick++" title="Actualiser les données">⟳</button>
          <button class="zoom-btn solo cloche" @click.stop="alertesOuvertes = !alertesOuvertes" :title="(alertes.length || 'Aucune') + ' alerte(s) de validité'">
            🔔<span v-if="alertes.length" class="cloche-badge">{{ alertes.length }}</span>
          </button>
        </div>
        <template v-if="session">
          <div class="online-box" v-if="enLigne.length">
            <div class="online-head"><span class="online-dot"></span> {{ enLigne.length }} en ligne</div>
            <ul class="online-list">
              <li v-for="u in enLigne" :key="u.id"><span class="online-nom">{{ nomEnLigne(u) }}</span><span v-if="session && u.id === session.user.id" class="online-moi">moi</span></li>
            </ul>
          </div>
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

    <div v-if="alertesOuvertes" class="notif-backdrop" @click="alertesOuvertes = false"></div>
    <div v-if="alertesOuvertes" class="notif-panel">
      <div class="notif-head">
        <span>OF non valides &amp; sous 3 jours ({{ alertes.length }})</span>
        <button class="notif-x" @click="alertesOuvertes = false" title="Fermer">✕</button>
      </div>
      <RouterLink v-for="a in alertes" :key="a.id" :to="{ path: '/ordres', query: { edit: a.id } }"
        class="notif-item" :class="{ perime: a.jours <= 0 }" @click="alertesOuvertes = false; sidebarOpen = false">
        <div class="notif-lot">{{ a.lot }} <span class="notif-desig">{{ a.code ? a.code + ' — ' : '' }}{{ a.desig }}</span></div>
        <div class="notif-when">{{ a.jours <= 0 ? '⛔ OF non valide (expiré)' : '⏳ Expire dans ' + a.jours + ' j' }} · {{ a.dateStr }}</div>
      </RouterLink>
      <p v-if="!alertes.length" class="notif-empty">Aucune alerte de validité.</p>
    </div>

    <div class="app-main">
      <header class="mobile-top">
        <button class="burger" @click="sidebarOpen = !sidebarOpen" aria-label="Ouvrir le menu">☰</button>
        <span class="brand-wm">Prod<span class="brand-sub">Track</span></span>
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
html[data-theme="indigo"]   { --bg: #f4f5fb; --topbar: #1e1b4b; --topbar-muted: #c7d2fe; --topbar-border: #3730a3; --accent-bright: #818cf8; }
html[data-theme="emeraude"] { --bg: #f0f8f4; --topbar: #064e3b; --topbar-muted: #a7f3d0; --topbar-border: #047857; --accent-bright: #34d399; }
html[data-theme="violet"]   { --bg: #f8f4fc; --topbar: #3b0764; --topbar-muted: #e9d5ff; --topbar-border: #7e22ce; --accent-bright: #c084fc; }
html:is([data-theme="sombre"], [data-theme="minuit"])  { --bg: #0f172a; --text: #e6edf6; --topbar: #020617; --topbar-text: #f1f5f9; --topbar-muted: #94a3b8; --topbar-border: #334155; --accent-bright: #2dd4bf; color-scheme: dark; }
html[data-theme="minuit"]  { --bg: #0b1120; --topbar: #0d1424; --topbar-border: #24304a; --accent-bright: #60a5fa; }

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
.side-group { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .1em;
  color: var(--topbar-text); opacity: .55; padding: 15px 10px 6px; }
.side-group-btn { display: flex; align-items: center; justify-content: space-between; width: 100%;
  background: none; border: 0; cursor: pointer; font-family: inherit; text-align: left; border-radius: 6px; transition: opacity .15s ease, color .15s ease; }
.side-group-btn:hover { opacity: .9; color: var(--topbar-text); }
.grp-caret { font-size: 10px; opacity: .8; transition: transform .18s ease; }
.side-group-btn.open .grp-caret { transform: rotate(180deg); }
.grp-links { display: flex; flex-direction: column; gap: 1px; position: relative; margin: 2px 0 4px; }
.grp-links::before { content: ""; position: absolute; left: 6px; top: 2px; bottom: 4px; width: 1.5px; border-radius: 2px; background: var(--topbar-border); opacity: .55; }
.grp-links .side-link { padding-left: 16px; font-size: 13px; font-weight: 500; }
.grp-links a.router-link-exact-active::before { left: 6px; top: 8px; bottom: 8px; width: 2px; opacity: 1; }
.nav-group { border-radius: 10px; transition: background .18s ease; }
.nav-group.open { background: linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.02)); padding-bottom: 5px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.04); }
.grp-label { display: inline-flex; align-items: center; gap: 9px; }
.grp-ic { display: inline-flex; width: 16px; height: 16px; flex-shrink: 0; }
.grp-ic svg { width: 16px; height: 16px; fill: none; stroke: var(--accent-bright); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.link-in { display: inline-flex; align-items: center; gap: 9px; min-width: 0; }
.link-ic { display: inline-flex; width: 15px; height: 15px; flex-shrink: 0; opacity: .75; }
.link-ic svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.side-nav a.router-link-exact-active .link-ic { opacity: 1; }
.side-link { display: flex; align-items: center; justify-content: space-between; gap: 8px;
  color: var(--topbar-muted); text-decoration: none; font-size: 13.5px; font-weight: 500;
  padding: 8px 11px; border-radius: 8px; white-space: nowrap; background: none; border: 0; cursor: pointer;
  font-family: inherit; text-align: left; width: 100%; position: relative; }
.side-link:hover { background: rgba(255,255,255,.06); color: var(--topbar-text); }
.side-nav a.router-link-exact-active { background: rgba(255,255,255,.10); color: var(--topbar-text); font-weight: 600; }
.side-nav a.router-link-exact-active::before { content: ""; position: absolute; left: -12px; top: 7px; bottom: 7px; width: 3px;
  border-radius: 0 3px 3px 0; background: var(--accent-bright); }

.side-foot { border-top: 1px solid var(--topbar-border); padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.theme-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.theme-toggle { display: flex; align-items: center; justify-content: space-between; width: 100%; background: none; border: 1px solid var(--topbar-border); color: var(--topbar-muted); cursor: pointer; font-family: inherit; font-size: 13px; padding: 7px 11px; border-radius: 8px; transition: color .15s ease, border-color .15s ease; }
.theme-toggle:hover { color: var(--topbar-text); border-color: var(--topbar-muted); }
.tt-left { display: inline-flex; align-items: center; gap: 8px; }
.tt-dot { width: 14px; height: 14px; border-radius: 4px; border: 1px solid rgba(255,255,255,.2); flex-shrink: 0; }
.theme-toggle.open .grp-caret { transform: rotate(180deg); }
.theme-dot { width: 20px; height: 20px; border-radius: 6px; border: 1px solid rgba(255,255,255,.18); cursor: pointer; padding: 0; }
.theme-dot.sel { outline: 2px solid var(--accent-bright); outline-offset: 1px; }
.foot-row { display: flex; align-items: center; gap: 8px; }
.zoom-btn.solo { border: 1px solid var(--topbar-border); border-radius: 8px; width: 30px; height: 30px; }

/* ===== Zone principale & mobile ===== */
.app-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.alert-bar { display: flex; align-items: center; gap: 10px; background: #fff7ed; border-bottom: 1px solid #fed7aa; color: #9a3412; padding: 8px 16px; font-size: 13px; }
.alert-ic { font-size: 15px; flex-shrink: 0; }
.alert-txt { flex: 1; min-width: 0; }
.alert-link { color: inherit; font-weight: 700; text-decoration: underline; white-space: nowrap; }
.alert-close { background: none; border: 0; color: inherit; cursor: pointer; font-size: 14px; line-height: 1; padding: 2px 4px; }
html:is([data-theme="sombre"], [data-theme="minuit"]) .alert-bar { background: #3b1d06; border-bottom-color: #7c2d12; color: #fdba74; }
.cloche { position: relative; font-size: 14px; }
.cloche-badge { position: absolute; top: -5px; right: -5px; background: #ef4444; color: #fff; font-size: 9px; font-weight: 800; min-width: 15px; height: 15px; border-radius: 999px; display: flex; align-items: center; justify-content: center; padding: 0 3px; }
.notif-backdrop { position: fixed; inset: 0; z-index: 55; }
.notif-panel { position: fixed; left: 12px; bottom: 66px; width: 300px; max-width: calc(100vw - 24px); max-height: 60vh; overflow-y: auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 14px 36px rgba(16,24,40,.24); z-index: 60; padding: 8px; }
.notif-head { display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 700; color: #0f172a; padding: 4px 8px 8px; text-transform: uppercase; letter-spacing: .04em; }
.notif-x { background: none; border: 0; cursor: pointer; color: #64748b; font-size: 13px; }
.notif-item { display: block; text-decoration: none; padding: 8px 10px; border-radius: 8px; border-left: 3px solid #f59e0b; margin-bottom: 4px; background: #fffbeb; }
.notif-item.perime { border-left-color: #ef4444; background: #fef2f2; }
.notif-item:hover { background: #fef3c7; }
.notif-lot { font-size: 13px; font-weight: 700; color: #0f172a; }
.notif-desig { font-weight: 400; color: #64748b; font-size: 12px; }
.notif-when { font-size: 11px; color: #b45309; margin-top: 2px; }
.notif-item.perime .notif-when { color: #b91c1c; }
.notif-empty { font-size: 12px; color: #94a3b8; padding: 8px; }
html:is([data-theme="sombre"], [data-theme="minuit"]) .notif-panel { background: #161f33; border-color: #2a3650; }
html:is([data-theme="sombre"], [data-theme="minuit"]) .notif-lot, html:is([data-theme="sombre"], [data-theme="minuit"]) .notif-head { color: #e6edf6; }
html:is([data-theme="sombre"], [data-theme="minuit"]) .notif-item { background: #2a1f0a; }
html:is([data-theme="sombre"], [data-theme="minuit"]) .notif-item.perime { background: #2a1010; }
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
.sw-indigo { background: #1e1b4b; }
.sw-emeraude { background: #064e3b; }
.sw-violet { background: #3b0764; }
.sw-minuit { background: #0d1424; }

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
html:is([data-theme="sombre"], [data-theme="minuit"]) .dash,
html:is([data-theme="sombre"], [data-theme="minuit"]) .ref-page,
html:is([data-theme="sombre"], [data-theme="minuit"]) .pdp-page,
html:is([data-theme="sombre"], [data-theme="minuit"]) .of-page,
html:is([data-theme="sombre"], [data-theme="minuit"]) .ph-page,
html:is([data-theme="sombre"], [data-theme="minuit"]) .ec-page,
html:is([data-theme="sombre"], [data-theme="minuit"]) .cd-page,
html:is([data-theme="sombre"], [data-theme="minuit"]) .dl-page,
html:is([data-theme="sombre"], [data-theme="minuit"]) .ca-page,
html:is([data-theme="sombre"], [data-theme="minuit"]) .ef-page,
html:is([data-theme="sombre"], [data-theme="minuit"]) .au-page,
html:is([data-theme="sombre"], [data-theme="minuit"]) .hb-page,
html:is([data-theme="sombre"], [data-theme="minuit"]) .mc-page,
html:is([data-theme="sombre"], [data-theme="minuit"]) .vd-page,
html:is([data-theme="sombre"], [data-theme="minuit"]) .rp-page { color: #e6edf6; }

html:is([data-theme="sombre"], [data-theme="minuit"]) .card,
html:is([data-theme="sombre"], [data-theme="minuit"]) .kpi,
html:is([data-theme="sombre"], [data-theme="minuit"]) .empty-card,
html:is([data-theme="sombre"], [data-theme="minuit"]) .welcome { background: #161f33 !important; border-color: #2a3650 !important; box-shadow: none !important; }
html:is([data-theme="sombre"], [data-theme="minuit"]) .drop-panel { background: #161f33 !important; border-color: #2a3650 !important; }
html:is([data-theme="sombre"], [data-theme="minuit"]) .drop-panel a,
html:is([data-theme="sombre"], [data-theme="minuit"]) .theme-item { color: #e6edf6 !important; }
html:is([data-theme="sombre"], [data-theme="minuit"]) .drop-panel a:hover,
html:is([data-theme="sombre"], [data-theme="minuit"]) .theme-item:hover { background: #243049 !important; }
html:is([data-theme="sombre"], [data-theme="minuit"]) .form-grid { background: #0f1830 !important; border-color: #2a3650 !important; }
html:is([data-theme="sombre"], [data-theme="minuit"]) .bar-track { background: #2a3650 !important; }
html:is([data-theme="sombre"], [data-theme="minuit"]) .count { background: #243049 !important; color: #cbd5e1 !important; }
html:is([data-theme="sombre"], [data-theme="minuit"]) input,
html:is([data-theme="sombre"], [data-theme="minuit"]) select,
html:is([data-theme="sombre"], [data-theme="minuit"]) textarea { background: #0f1830 !important; color: #e6edf6 !important; border-color: #2a3650 !important; }
html:is([data-theme="sombre"], [data-theme="minuit"]) .btn.ghost { background: #161f33 !important; color: #cbd5e1 !important; border-color: #2a3650 !important; }
html:is([data-theme="sombre"], [data-theme="minuit"]) table.grid th { color: #94a3b8 !important; border-color: #2a3650 !important; }
html:is([data-theme="sombre"], [data-theme="minuit"]) table.grid td { border-color: #1f2940 !important; }
html:is([data-theme="sombre"], [data-theme="minuit"]) table.grid tr:hover td { background: #1d2740 !important; }
html:is([data-theme="sombre"], [data-theme="minuit"]) table.mini td { border-color: #1f2940 !important; }
html:is([data-theme="sombre"], [data-theme="minuit"]) .prog-nom { color: #e6edf6 !important; }
html:is([data-theme="sombre"], [data-theme="minuit"]) .doc-title { border-bottom-color: #2a3650 !important; }
html:is([data-theme="sombre"], [data-theme="minuit"]) .block { border-bottom-color: #1f2940 !important; }
html:is([data-theme="sombre"], [data-theme="minuit"]) .lot-info { border-top-color: #1f2940 !important; }

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
.online-box { border: 1px solid var(--topbar-border); border-radius: 8px; padding: 8px 10px; }
.online-head { display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 700; color: var(--topbar-text); margin-bottom: 6px; }
.online-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,.2); flex: none; }
.online-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; max-height: 140px; overflow-y: auto; }
.online-list li { display: flex; align-items: center; justify-content: space-between; gap: 6px; font-size: 12.5px; color: var(--topbar-muted); }
.online-nom { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.online-moi { font-size: 10px; font-weight: 700; color: #22c55e; background: rgba(34,197,94,.15); padding: 1px 6px; border-radius: 999px; flex: none; }
</style>
