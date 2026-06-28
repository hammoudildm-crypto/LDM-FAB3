<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from './supabase'

const session = ref(null)

onMounted(async () => {
  const res = await supabase.auth.getSession()
  if (res.error) {
    console.error('getSession:', res.error.message)
    return
  }
  session.value = res.data.session
  supabase.auth.onAuthStateChange((_event, s) => {
    session.value = s
  })
})

async function signOut() {
  const res = await supabase.auth.signOut()
  if (res.error) {
    console.error('signOut:', res.error.message)
    return
  }
  session.value = null
}
</script>

<template>
  <header class="topbar">
    <div class="brand">LDM-FAB3</div>
    <nav class="nav">
      <RouterLink to="/">Tableau de bord</RouterLink>
      <RouterLink to="/referentiels" v-if="session">Référentiels</RouterLink>
      <RouterLink to="/plan" v-if="session">Plan directeur</RouterLink>
      <RouterLink to="/ordres" v-if="session">Ordres de fabrication</RouterLink>
      <RouterLink to="/suivi" v-if="session">Suivi fabrication</RouterLink>
      <RouterLink to="/encours" v-if="session">En-cours</RouterLink>
      <RouterLink to="/conditionnement" v-if="session">Conditionnement</RouterLink>
      <RouterLink to="/dossier" v-if="session">Dossier de lot</RouterLink>
      <RouterLink to="/ca" v-if="session">Chiffre d'affaires</RouterLink>
      <RouterLink to="/effectifs" v-if="session">Effectifs</RouterLink>
      <RouterLink to="/audit" v-if="session">Journal d'audit</RouterLink>
      <RouterLink to="/login" v-if="!session">Connexion</RouterLink>
      <button v-else type="button" class="signout" @click="signOut">Déconnexion</button>
    </nav>
  </header>
  <main>
    <RouterView />
  </main>
</template>

<style>
* { box-sizing: border-box; }
body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 0; background: #f6f7f9; color: #1b2733; }

.topbar { display: flex; align-items: center; gap: 14px; padding: 0 20px; min-height: 56px;
  background: #0f2a33; color: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
.brand { font-weight: 700; letter-spacing: .02em; white-space: nowrap; }
.nav { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; padding: 8px 0; }
.nav a { color: #cbd5e1; text-decoration: none; font-size: 14px; font-weight: 500; padding: 4px 0; white-space: nowrap; }
.nav a:hover { color: #fff; }
.nav a.router-link-active { color: #fff; border-bottom: 2px solid #2dd4bf; }
.signout { background: transparent; color: #cbd5e1; border: 1px solid #33505a; padding: 5px 12px; border-radius: 7px; font-size: 13px; cursor: pointer; }
.signout:hover { color: #fff; border-color: #557; }

main { padding: 20px 16px; max-width: 1200px; margin: 0 auto; }

.error { color: #b91c1c; }

@media print {
  .topbar { display: none !important; }
  main { padding: 0; max-width: none; }
}
</style>
