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
const sidebarMasquee = ref(false)
watch(sidebarMasquee, v => { try { localStorage.setItem('ldmfab-sidebar-masquee', v ? '1' : '0') } catch (e) { /* ignore */ } })
const refreshTick = ref(0)
const presenceOuverte = ref(false)
// --- Synchronisation périodique automatique (recharge les pages de consultation) ---
const AUTO_REFRESH_MS = 300000 // 5 minutes (filet de sécurité ; le temps réel gère l'instantané)
const ROUTES_SANS_AUTO = ['/ordres', '/suivi', '/conditionnement', '/saisie-trs', '/plan', '/referentiels', '/cadences', '/habilitations', '/effectifs', '/verification-ddl', '/verification-ddl-aq', '/verification-ddl-cond', '/compte', '/login']
let autoRefreshTimer = null
// Ne jamais recharger pendant qu'un opérateur saisit (champ focalisé) ou qu'une fenêtre est ouverte
const refreshEnAttente = ref(false)
function enSaisie() {
  if (typeof document === 'undefined') return false
  const el = document.activeElement
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return true
  if (document.querySelector('.modal-overlay, .modal')) return true
  return false
}
function surFinSaisie() {
  setTimeout(() => {
    if (refreshEnAttente.value && !enSaisie() && !ROUTES_SANS_AUTO.includes(route.path)) { refreshEnAttente.value = false; refreshTick.value++ }
  }, 500)
}
function autoRefresh() {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
  if (ROUTES_SANS_AUTO.includes(route.path)) return  // ne pas interrompre un écran de saisie
  if (enSaisie()) { refreshEnAttente.value = true; return }  // opérateur en train de saisir : on diffère
  refreshTick.value++
}
let canalSync = null
function onDbChange() {
  if (ROUTES_SANS_AUTO.includes(route.path)) return  // pas de rechargement pendant une saisie
  if (enSaisie()) { refreshEnAttente.value = true; return }  // opérateur en train de saisir : on diffère
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
  '/accueil': '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  '/ordonnancement': '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  '/realisation-plan': '<path d="M3 3v18h18"/><path d="M18 9l-5 5-3-3-4 4"/>',
  '/rendement': '<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  '/ca': '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  '/dispo-equipements': '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  '/avancement': '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  '/production-atelier': '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  '/suivi-trs': '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  '/encours': '<path d="M5 22h14M5 2h14M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2"/>',
  '/dossier': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  '/audit': '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>',
  '/plan': '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  '/ordres': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/>',
  '/suivi': '<path d="M9 2v6l-5 9a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-5-9V2"/><line x1="8" y1="2" x2="16" y2="2"/>',
  '/conditionnement': '<path d="M21 8l-9-5-9 5v8l9 5 9-5V8z"/><polyline points="3 8 12 13 21 8"/><line x1="12" y1="13" x2="12" y2="21"/>',
  '/saisie-trs': '<path d="M3.34 19a10 10 0 1 1 17.32 0"/><path d="M12 14l4-4"/>',
  '/verification-ddl': '<circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/>',
  '/verification-ddl-aq': '<circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/><path d="M12 2v3"/>',
  '/verification-ddl-cond': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 12l3 3 5-6"/>',
  '/effectifs': '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  '/referentiels': '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  '/habilitations': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  '/capacite': '<path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/><line x1="3" y1="20" x2="21" y2="20"/>',
  '/qse': '<circle cx="12" cy="8" r="6"/><path d="M15.5 13.5 17 22l-5-3-5 3 1.5-8.5"/>',
  '/cadences': '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M19.1 4.9l-2.8 2.8M7.7 16.3l-2.8 2.8"/>',
}
const NAV_GROUPS = [
  { key: 'consultation', label: 'Consultation', role: null, icon: '<path d="M3 3v18h18"/><polyline points="7 13 11 9 14 12 20 6"/>', links: [
    ['/realisation-plan', 'Réalisation vs Plan'],
    ['/rendement', 'Rendement'],
    ['/ca', "Chiffre d'affaires"],
    ['/dispo-equipements', 'Disponibilité équipements'],
    ['/avancement', 'Suivi du process'],
    ['/production-atelier', 'Production par atelier'],
    ['/suivi-trs', 'Suivi TRS'],
    ['/capacite', 'Capacité équipements'],
    ['/qse', 'Indicateurs QSE'],
    ['/encours', 'En-cours'],
    ['/dossier', 'Dossier de lot'],
    ['/audit', "Journal d'audit"],
  ] },
  { key: 'production', label: 'Production & saisie', role: 'edit', icon: '<path d="M2 20h20"/><path d="M4 20V9l5 3V9l5 3V5l5 3v12"/>', links: [
    ['/ordonnancement', 'Ordonnancement'],
    ['/plan', 'Plan directeur'],
    ['/ordres', 'Ordres de fabrication'],
    ['/suivi', 'Suivi fabrication'],
    ['/conditionnement', 'Conditionnement'],
    ['/saisie-trs', 'Saisie TRS'],
    ['/verification-ddl', 'DDL Fab — Production'],
    ['/verification-ddl-aq', 'DDL Fab — AQ'],
    ['/verification-ddl-cond', 'DDL Conditionnement'],
    ['/effectifs', 'Effectifs'],
  ] },
  { key: 'admin', label: 'Administration', role: 'admin', icon: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>', links: [
    ['/referentiels', 'Référentiels'],
    ['/cadences', 'Cadences'],
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
// Sous-menus repliés par défaut ; on les ouvre/ferme uniquement au clic sur le menu principal

const PROD = ['/plan', '/ordres', '/suivi', '/encours', '/conditionnement', '/dossier']
const PILOT = ['/ca', '/realisation-plan', '/rendement', '/dispo-equipements', '/avancement', '/production-atelier', '/saisie-trs', '/suivi-trs', '/qse', '/effectifs', '/verification-ddl', '/verification-ddl-aq', '/verification-ddl-cond', '/audit', '/habilitations']
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
    if (localStorage.getItem('ldmfab-sidebar-masquee') === '1') sidebarMasquee.value = true
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
  document.addEventListener('focusout', surFinSaisie)
  canalSync = supabase.channel('sync-donnees')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ordres_fabrication' }, onDbChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'suivi_phases' }, onDbChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conditionnement' }, onDbChange)
    .subscribe()
})
onUnmounted(() => { document.removeEventListener('click', onDocClick); arreterPresence(); if (autoRefreshTimer) clearInterval(autoRefreshTimer); window.removeEventListener('focus', autoRefresh); document.removeEventListener('focusout', surFinSaisie); if (canalSync) supabase.removeChannel(canalSync) })

async function signOut() {
  arreterPresence()
  const res = await supabase.auth.signOut()
  if (res.error) { console.error('signOut:', res.error.message); return }
  session.value = null
  role.value = null
}
</script>

<template>
  <div class="app-shell" :class="{ masquee: sidebarMasquee }">
    <div class="side-reveal" aria-hidden="true"></div>
    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <div class="side-brand">
        <span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="19" height="19" fill="none"><path d="M4 16 L10 11 L15 14 L20 6" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="4" cy="16" r="1.7" fill="#fff"/><circle cx="10" cy="11" r="1.7" fill="#fff"/><circle cx="15" cy="14" r="1.7" fill="#fff"/><circle cx="20" cy="6" r="1.7" fill="#fff"/></svg></span>
        <span class="brand-wm">Prod<span class="brand-sub">Track</span></span>
        <button class="side-hide" @click="sidebarMasquee = !sidebarMasquee" :title="sidebarMasquee ? 'Épingler la barre' : 'Masquer la barre'">{{ sidebarMasquee ? '»' : '«' }}</button>
      </div>
      <nav class="side-nav">
        <RouterLink to="/accueil" class="side-link" @click="sidebarOpen = false"><span class="link-in"><span class="link-ic"><svg viewBox="0 0 24 24" v-html="LINK_ICONS['/accueil']"></svg></span>Accueil</span></RouterLink>
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
      <header class="app-topbar">
        <button class="burger" @click="sidebarMasquee = false; sidebarOpen = !sidebarOpen" aria-label="Menu">☰</button>
        <span class="brand-wm tb-brand">Prod<span class="brand-sub">Track</span></span>
        <RouterLink v-if="route.path !== '/accueil'" to="/accueil" class="tb-accueil" @click="sidebarOpen = false" title="Retour à l'accueil"><span class="tb-accueil-ar">←</span><span class="tb-accueil-tx">Accueil</span></RouterLink>
        <div class="tb-spacer"></div>
        <div class="tb-item" v-if="session && enLigne.length">
          <button class="tb-icon" @click.stop="presenceOuverte = !presenceOuverte" :title="enLigne.length + ' en ligne'"><span class="online-dot"></span>{{ enLigne.length }}</button>
          <div v-if="presenceOuverte" class="tb-drop">
            <div class="tb-drop-head">{{ enLigne.length }} en ligne</div>
            <ul class="online-list">
              <li v-for="u in enLigne" :key="u.id"><span class="online-nom">{{ nomEnLigne(u) }}</span><span v-if="session && u.id === session.user.id" class="online-moi">moi</span></li>
            </ul>
          </div>
        </div>
        <div class="tb-item">
          <button class="tb-icon" @click.stop="themeOuvert = !themeOuvert" title="Thème"><span class="tt-dot" :class="'sw-' + theme"></span></button>
          <div v-if="themeOuvert" class="tb-drop theme-drop">
            <button v-for="t in THEMES" :key="t[0]" class="theme-dot" :class="['sw-' + t[0], { sel: theme === t[0] }]" @click="setTheme(t[0]); themeOuvert = false" :title="t[1]"></button>
          </div>
        </div>
        <div class="zoom-ctl" title="Zoom des pages">
          <button class="zoom-btn" @click="changeZoom(-5)" :disabled="zoom <= 20" title="Réduire">−</button>
          <button class="zoom-val" @click="setZoom(100)" title="Réinitialiser à 100 %">{{ zoom }}%</button>
          <button class="zoom-btn" @click="changeZoom(5)" :disabled="zoom >= 200" title="Agrandir">+</button>
        </div>
        <button class="zoom-btn solo" @click="refreshTick++" title="Actualiser les données">⟳</button>
        <button class="zoom-btn solo cloche" @click.stop="alertesOuvertes = !alertesOuvertes" :title="(alertes.length || 'Aucune') + ' alerte(s) de validité'">🔔<span v-if="alertes.length" class="cloche-badge">{{ alertes.length }}</span></button>
        <template v-if="session">
          <RouterLink to="/compte" class="tb-acct" @click="sidebarOpen = false" title="Mon compte">Compte<span v-if="role" class="role-badge" :class="'r-' + role">{{ roleLabel }}</span></RouterLink>
          <button type="button" class="tb-signout" @click="signOut" title="Déconnexion">⏻</button>
        </template>
        <RouterLink v-else to="/login" class="tb-acct" @click="sidebarOpen = false">Connexion</RouterLink>
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
  --bg: #f7f8fb;
  --text: #1a2233;
  --topbar: #161c2e;
  --topbar-text: #ffffff;
  --topbar-muted: #aab6cc;
  --topbar-border: #2c3552;
  --accent-bright: #2dd4bf;
}
html[data-theme="ocean"]   { --bg: #eef4fa; --topbar: #0a2f4c; --topbar-muted: #b6d9ef; --topbar-border: #1b4f76; --accent-bright: #38bdf8; }
html[data-theme="ardoise"] { --bg: #eef0f4; --topbar: #1a2233; --topbar-muted: #b6bfd0; --topbar-border: #394255; --accent-bright: #7f9df2; }
html[data-theme="indigo"]   { --bg: #f5f6fc; --topbar: #1a1848; --topbar-muted: #c4cbf6; --topbar-border: #35318f; --accent-bright: #8b93ff; }
html[data-theme="emeraude"] { --bg: #eff8f3; --topbar: #093c2f; --topbar-muted: #a1e5ce; --topbar-border: #12654e; --accent-bright: #34d399; }
html[data-theme="violet"]   { --bg: #f8f4fc; --topbar: #2c0b50; --topbar-muted: #e1c9f5; --topbar-border: #6a2dac; --accent-bright: #c084fc; }
html:is([data-theme="sombre"], [data-theme="minuit"])  { --bg: #0e1420; --text: #e6edf6; --topbar: #0a0f1a; --topbar-text: #f1f5f9; --topbar-muted: #97a3ba; --topbar-border: #29334a; --accent-bright: #2dd4bf; color-scheme: dark; }
html[data-theme="minuit"]  { --bg: #0a0f1c; --topbar: #0c1220; --topbar-border: #222c44; --accent-bright: #5b9dff; }

body { font-family: 'Inter', system-ui, -apple-system, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; margin: 0; background: var(--bg); color: var(--text); letter-spacing: -0.006em; }

.app-shell { display: flex; min-height: 100vh; }

/* ===== Barre latérale ===== */
.sidebar { width: 236px; flex-shrink: 0; background: var(--topbar); color: var(--topbar-text);
  display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh;
  box-shadow: 2px 0 14px rgba(0,0,0,.10); z-index: 40; }
.side-brand { display: flex; align-items: center; gap: 10px; padding: 16px 18px 12px; }
.brand-mark { width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; font-size: 16px; font-weight: 800;
  color: #06241f; background: linear-gradient(140deg, var(--accent-bright), #14b8a6); box-shadow: 0 2px 7px rgba(20,184,166,.4); flex-shrink: 0; }
.brand-wm { font-size: 14.5px; font-weight: 800; letter-spacing: .05em; }
.brand-sub { color: var(--accent-bright); margin-left: 3px; font-weight: 700; }

.side-nav { flex: 1; overflow-y: auto; padding: 4px 12px 12px; display: flex; flex-direction: column; gap: 1px; }
.side-nav::-webkit-scrollbar { width: 8px; }
.side-nav::-webkit-scrollbar-thumb { background: var(--topbar-border); border-radius: 8px; }
.side-group { font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .1em;
  color: var(--topbar-text); opacity: .55; padding: 15px 10px 6px; }
.side-group-btn { display: flex; align-items: center; justify-content: space-between; width: 100%;
  background: none; border: 0; cursor: pointer; font-family: inherit; text-align: left; border-radius: 6px; transition: opacity .15s ease, color .15s ease; }
.side-group-btn:hover { opacity: .9; color: var(--topbar-text); }
.grp-caret { font-size: 10px; opacity: .8; transition: transform .18s ease; }
.side-group-btn.open .grp-caret { transform: rotate(180deg); }
.grp-links { display: flex; flex-direction: column; gap: 1px; position: relative; margin: 2px 0 4px; }
.grp-links::before { content: ""; position: absolute; left: 6px; top: 2px; bottom: 4px; width: 1.5px; border-radius: 2px; background: var(--topbar-border); opacity: .55; }
.grp-links .side-link { padding-left: 16px; font-size: 12px; font-weight: 500; }
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
  color: var(--topbar-muted); text-decoration: none; font-size: 12px; font-weight: 500;
  padding: 6px 10px; border-radius: 8px; white-space: nowrap; background: none; border: 0; cursor: pointer;
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
/* --- Barre latérale masquable (desktop) --- */
.side-brand { display: flex; align-items: center; }
.side-reveal { display: none; }
.side-hide { margin-left: auto; background: transparent; border: 0; color: var(--topbar-muted); font-size: 17px; line-height: 1; cursor: pointer; padding: 2px 7px; border-radius: 6px; }
.side-hide:hover { background: rgba(255,255,255,.12); color: #fff; }
@media (min-width: 901px) and (hover: hover) and (pointer: fine) {
  .app-shell.masquee .sidebar { position: fixed; left: 0; top: 0; bottom: 0; height: 100vh; transform: translateX(-100%); transition: transform .22s ease; z-index: 60; box-shadow: 2px 0 18px rgba(0,0,0,.28); }
  .app-shell.masquee .side-reveal { display: block; position: fixed; left: 0; top: 0; bottom: 0; width: 12px; z-index: 55; }
  .app-shell.masquee .side-reveal:hover + .sidebar,
  .app-shell.masquee .sidebar:hover { transform: translateX(0); }
}
@media (max-width: 900px) and (orientation: portrait), (hover: none) and (pointer: coarse) and (orientation: portrait) {
  .sidebar { position: fixed; top: 0; left: 0; height: 100vh; padding-top: env(safe-area-inset-top, 0px); transform: translateX(-100%); transition: transform .25s ease; }
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
.app-topbar { display: flex; align-items: center; gap: 8px; padding: env(safe-area-inset-top, 0px) 14px 0; min-height: 54px; background: var(--topbar); color: var(--topbar-text); position: sticky; top: 0; z-index: 40; box-shadow: 0 2px 10px rgba(0,0,0,.14); flex-wrap: wrap; }
.app-topbar .burger { display: none; background: none; border: 0; color: var(--topbar-text); font-size: 22px; cursor: pointer; padding: 4px; line-height: 1; }
.app-shell.masquee .app-topbar .burger { display: inline-flex; }
.tb-brand { display: none; }
.tb-spacer { flex: 1; }
.tb-item { position: relative; }
.tb-icon { display: inline-flex; align-items: center; gap: 6px; background: transparent; border: 1px solid var(--topbar-border); color: var(--topbar-muted); border-radius: 8px; padding: 6px 10px; font-size: 13px; font-weight: 600; cursor: pointer; }
.tb-icon:hover { color: var(--topbar-text); border-color: var(--topbar-muted); }
.tb-icon .tt-dot { width: 16px; height: 16px; border-radius: 5px; border: 1px solid rgba(255,255,255,.2); }
.tb-drop { position: absolute; top: calc(100% + 6px); right: 0; background: var(--topbar); border: 1px solid var(--topbar-border); border-radius: 10px; padding: 10px; z-index: 50; box-shadow: 0 12px 30px rgba(0,0,0,.35); min-width: 190px; }
.tb-drop.theme-drop { display: flex; flex-wrap: wrap; gap: 8px; width: 210px; min-width: 0; }
.tb-drop-head { font-size: 12px; font-weight: 700; color: var(--topbar-text); margin-bottom: 6px; }
.tb-acct { display: inline-flex; align-items: center; gap: 8px; text-decoration: none; color: var(--topbar-muted); font-size: 13px; font-weight: 600; padding: 6px 10px; border: 1px solid var(--topbar-border); border-radius: 8px; white-space: nowrap; }
.tb-acct:hover { color: var(--topbar-text); border-color: var(--topbar-muted); }
.tb-signout { background: transparent; color: var(--topbar-muted); border: 1px solid var(--topbar-border); padding: 6px 11px; border-radius: 8px; font-size: 15px; cursor: pointer; line-height: 1; }
.tb-signout:hover { color: #fca5a5; border-color: #fca5a5; }
@media (max-width: 900px) and (orientation: portrait), (hover: none) and (pointer: coarse) and (orientation: portrait) { .app-topbar .burger, .tb-brand { display: inline-flex; } .tb-acct { display: none; } }
/* Mode application (ajoutée à l'écran d'accueil) : réserver la barre d'état,
   avec une marge fixe de secours pour Android où env(safe-area) vaut souvent 0. */
@media (display-mode: standalone) and (hover: none), (display-mode: fullscreen) and (hover: none) {
  .app-topbar { padding-top: max(env(safe-area-inset-top, 0px), 30px); }
  .sidebar { padding-top: max(env(safe-area-inset-top, 0px), 30px); }
}
.tb-accueil { display: inline-flex; align-items: center; gap: 6px; margin-left: 14px; padding: 6px 13px; border-radius: 9px; background: rgba(255,255,255,.12); color: var(--topbar-text); text-decoration: none; font-size: 13px; font-weight: 600; border: 1px solid var(--topbar-border); transition: background .15s; white-space: nowrap; }
.tb-accueil:hover { background: rgba(255,255,255,.22); }
.tb-accueil-ar { font-size: 16px; line-height: 1; }
@media (max-width: 560px) { .tb-accueil { margin-left: 8px; padding: 6px 9px; } .tb-accueil-tx { display: none; } }
</style>
