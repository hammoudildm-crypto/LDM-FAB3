<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from './supabase'

const session = ref(null)
const route = useRoute()
const navRef = ref(null)
const openMenu = ref(null)

const PROD = ['/plan', '/ordres', '/suivi', '/encours', '/conditionnement', '/dossier']
const PILOT = ['/ca', '/effectifs', '/audit']
const prodActive = computed(() => PROD.includes(route.path))
const pilotActive = computed(() => PILOT.includes(route.path))

function toggleMenu(name) { openMenu.value = openMenu.value === name ? null : name }
function closeMenu() { openMenu.value = null }
function onDocClick(e) { if (navRef.value && !navRef.value.contains(e.target)) openMenu.value = null }

onMounted(async () => {
  document.addEventListener('click', onDocClick)
  const res = await supabase.auth.getSession()
  if (res.error) { console.error('getSession:', res.error.message); return }
  session.value = res.data.session
  supabase.auth.onAuthStateChange((_event, s) => { session.value = s })
})
onUnmounted(() => document.removeEventListener('click', onDocClick))

async function signOut() {
  const res = await supabase.auth.signOut()
  if (res.error) { console.error('signOut:', res.error.message); return }
  session.value = null
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
            <RouterLink to="/effectifs" @click="closeMenu">Effectifs</RouterLink>
            <RouterLink to="/audit" @click="closeMenu">Journal d'audit</RouterLink>
          </div>
        </div>
      </template>
    </nav>

    <div class="right">
      <RouterLink v-if="!session" to="/login" class="navlink">Connexion</RouterLink>
      <button v-else type="button" class="signout" @click="signOut">Déconnexion</button>
    </div>
  </header>
  <main>
    <RouterView />
  </main>
</template>

<style>
* { box-sizing: border-box; }
body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 0; background: #f6f7f9; color: #1b2733; }

.topbar { display: flex; align-items: center; gap: 22px; padding: 0 20px; height: 56px;
  background: #0f2a33; color: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.12); position: relative; z-index: 20; }
.brand { font-weight: 700; letter-spacing: .02em; white-space: nowrap; }
.nav { display: flex; gap: 20px; align-items: center; }
.right { margin-left: auto; display: flex; align-items: center; }

.navlink { color: #cbd5e1; text-decoration: none; font-size: 14px; font-weight: 500; padding: 4px 0;
  white-space: nowrap; background: none; border: 0; border-bottom: 2px solid transparent; cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 5px; }
.navlink:hover { color: #fff; }
.nav a.router-link-exact-active { color: #fff; border-bottom-color: #2dd4bf; }
.drop-toggle.active { color: #fff; border-bottom-color: #2dd4bf; }
.caret { font-size: 10px; transition: transform .15s; }
.drop-toggle.open .caret { transform: rotate(180deg); }

.dropdown { position: relative; }
.drop-panel { position: absolute; top: calc(100% + 8px); left: 0; min-width: 210px; background: #fff;
  border: 1px solid #e2e8f0; border-radius: 10px; box-shadow: 0 8px 24px rgba(16,24,40,.14); padding: 6px; z-index: 50; }
.drop-panel a { display: block; color: #1b2733; text-decoration: none; font-size: 14px; padding: 8px 12px; border-radius: 7px; white-space: nowrap; }
.drop-panel a:hover { background: #f1f5f9; }
.drop-panel a.router-link-exact-active { background: #ecfdf5; color: #0f766e; font-weight: 600; }

.signout { background: transparent; color: #cbd5e1; border: 1px solid #33505a; padding: 5px 12px; border-radius: 7px; font-size: 13px; cursor: pointer; white-space: nowrap; }
.signout:hover { color: #fff; border-color: #557; }

main { padding: 20px 16px; max-width: 1200px; margin: 0 auto; }

.error { color: #b91c1c; }

@media print {
  .topbar { display: none !important; }
  main { padding: 0; max-width: none; }
}
</style>
