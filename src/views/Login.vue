<script setup>
import { ref } from 'vue'
import { supabase } from '../supabase'

const email = ref('')
const msg = ref('')

async function signIn() {
  msg.value = ''
  if (!email.value.trim()) return
  const res = await supabase.auth.signInWithOtp({
    email: email.value.trim(),
    // Retour sur l'app déployée après clic sur le lien (hash route).
    options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
  })
  if (res.error) {
    msg.value = 'Erreur : ' + res.error.message
    return
  }
  msg.value = 'Lien de connexion envoyé. Vérifie ta boîte mail.'
}
</script>

<template>
  <h1>Connexion</h1>
  <div style="display:flex; gap:8px; margin:12px 0;">
    <input v-model="email" type="email" placeholder="ton@email.com" />
    <button type="button" @click="signIn">Recevoir un lien magique</button>
  </div>
  <p v-if="msg">{{ msg }}</p>
</template>
