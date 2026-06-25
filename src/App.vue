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
  <header>
    <nav>
      <RouterLink to="/">Accueil</RouterLink>
      <RouterLink to="/login" v-if="!session">Connexion</RouterLink>
      <button v-else type="button" @click="signOut">Déconnexion</button>
    </nav>
  </header>
  <main>
    <RouterView />
  </main>
</template>

<style>
body { font-family: system-ui, sans-serif; margin: 0; }
header { padding: 12px 16px; border-bottom: 1px solid #e5e7eb; }
nav { display: flex; gap: 16px; align-items: center; }
main { padding: 16px; max-width: 720px; }
.error { color: #b91c1c; }
</style>
