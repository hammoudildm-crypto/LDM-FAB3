<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../supabase'

const router = useRouter()
const email = ref('')
const password = ref('')
const msg = ref('')
const erreur = ref('')
const busy = ref(false)

async function seConnecter() {
  erreur.value = ''; msg.value = ''
  if (!email.value.trim() || !password.value) { erreur.value = 'E-mail et mot de passe requis.'; return }
  busy.value = true
  const res = await supabase.auth.signInWithPassword({ email: email.value.trim(), password: password.value })
  busy.value = false
  if (res.error) {
    erreur.value = res.error.message === 'Invalid login credentials'
      ? 'E-mail ou mot de passe incorrect. Si tu n\'as pas encore défini de mot de passe, utilise le lien magique une fois, puis crée-le dans « Mon compte ».'
      : res.error.message
    return
  }
  router.push('/')
}

async function lienMagique() {
  erreur.value = ''; msg.value = ''
  if (!email.value.trim()) { erreur.value = 'Saisis ton e-mail.'; return }
  busy.value = true
  const res = await supabase.auth.signInWithOtp({
    email: email.value.trim(),
    options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
  })
  busy.value = false
  if (res.error) { erreur.value = res.error.message; return }
  msg.value = 'Lien de connexion envoyé. Vérifie ta boîte mail.'
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <h1>Connexion</h1>
      <p class="sub">LDM-FAB3 — gestion de fabrication</p>

      <p v-if="erreur" class="alert">{{ erreur }}</p>
      <p v-if="msg" class="ok">{{ msg }}</p>

      <label class="field">E-mail
        <input v-model="email" type="email" autocomplete="username" placeholder="ton@email.com" />
      </label>
      <label class="field">Mot de passe
        <input v-model="password" type="password" autocomplete="current-password" placeholder="••••••••" @keyup.enter="seConnecter" />
      </label>

      <button class="btn" :disabled="busy" @click="seConnecter">Se connecter</button>

      <div class="sep"><span>ou</span></div>

      <button class="btn ghost" :disabled="busy" @click="lienMagique">Recevoir un lien magique</button>
      <p class="aide">Première fois sans mot de passe ? Connecte-toi via le lien magique, puis va dans <strong>Mon compte</strong> pour définir ton mot de passe.</p>
    </div>
  </div>
</template>

<style scoped>
.login-page { display: flex; justify-content: center; padding-top: 24px; }
.login-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 26px; width: 100%; max-width: 380px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.login-card h1 { margin: 0; font-size: 23px; letter-spacing: -0.01em; }
.sub { margin: 4px 0 18px; color: #64748b; font-size: 13px; }

.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; font-size: 13px; margin: 0 0 12px; }
.ok { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 10px 12px; border-radius: 8px; font-size: 13px; margin: 0 0 12px; }

.field { display: flex; flex-direction: column; font-size: 12px; font-weight: 600; color: #475569; gap: 5px; margin-bottom: 13px; }
.field input { font-size: 15px; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; font-weight: 400; }
.field input:focus { outline: 2px solid #0f766e; border-color: #0f766e; }

.btn { width: 100%; background: #0f766e; color: #fff; border: 0; padding: 11px 16px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; }
.btn:hover:not(:disabled) { background: #0c5f59; }
.btn:disabled { opacity: .5; cursor: default; }
.btn.ghost { background: #fff; color: #0f766e; border: 1px solid #0f766e; }
.btn.ghost:hover:not(:disabled) { background: #ecfdf5; }

.sep { display: flex; align-items: center; text-align: center; color: #94a3b8; font-size: 12px; margin: 16px 0; }
.sep::before, .sep::after { content: ''; flex: 1; border-bottom: 1px solid #e2e8f0; }
.sep span { padding: 0 12px; }

.aide { color: #64748b; font-size: 12px; margin: 14px 0 0; line-height: 1.5; }
</style>
