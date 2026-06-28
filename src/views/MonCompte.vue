<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase'

const email = ref('')
const pwd = ref('')
const pwd2 = ref('')
const msg = ref('')
const erreur = ref('')
const busy = ref(false)

onMounted(async () => {
  const s = await supabase.auth.getSession()
  email.value = s.data.session ? s.data.session.user.email : ''
})

async function definir() {
  erreur.value = ''; msg.value = ''
  if (pwd.value.length < 6) { erreur.value = 'Le mot de passe doit comporter au moins 6 caractères.'; return }
  if (pwd.value !== pwd2.value) { erreur.value = 'Les deux mots de passe ne correspondent pas.'; return }
  busy.value = true
  const res = await supabase.auth.updateUser({ password: pwd.value })
  busy.value = false
  if (res.error) { erreur.value = res.error.message; return }
  pwd.value = ''; pwd2.value = ''
  msg.value = 'Mot de passe enregistré. Tu peux désormais te connecter avec ton e-mail et ce mot de passe.'
}
</script>

<template>
  <div class="mc-page">
    <header class="mc-head">
      <h1>Mon compte</h1>
      <p class="sub">Définis un mot de passe pour te connecter sans lien magique.</p>
    </header>

    <section class="card">
      <div class="email-row">
        <span class="lbl">E-mail</span>
        <span class="email">{{ email || '—' }}</span>
      </div>

      <p v-if="erreur" class="alert">{{ erreur }}</p>
      <p v-if="msg" class="ok">{{ msg }}</p>

      <label class="field">Nouveau mot de passe
        <input v-model="pwd" type="password" autocomplete="new-password" placeholder="Au moins 6 caractères" />
      </label>
      <label class="field">Confirmer le mot de passe
        <input v-model="pwd2" type="password" autocomplete="new-password" @keyup.enter="definir" />
      </label>

      <button class="btn" :disabled="busy" @click="definir">Enregistrer le mot de passe</button>
    </section>

    <p class="hint">Une fois le mot de passe enregistré, déconnecte-toi puis reconnecte-toi avec <strong>e-mail + mot de passe</strong> sur l'écran de connexion. Le lien magique reste disponible en secours.</p>
  </div>
</template>

<style scoped>
.mc-page { color: #1b2733; max-width: 480px; }
.mc-head { margin: 4px 0 18px; }
.mc-head h1 { margin: 0; font-size: 24px; letter-spacing: -0.01em; }
.mc-head .sub { margin: 4px 0 0; color: #64748b; font-size: 14px; }

.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }

.email-row { display: flex; flex-direction: column; gap: 3px; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #eef2f6; }
.email-row .lbl { font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: #94a3b8; }
.email-row .email { font-size: 15px; font-weight: 600; }

.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }
.ok { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }

.field { display: flex; flex-direction: column; font-size: 12px; font-weight: 600; color: #475569; gap: 5px; margin-bottom: 14px; }
.field input { font-size: 15px; padding: 9px 11px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; font-weight: 400; }
.field input:focus { outline: 2px solid #0f766e; border-color: #0f766e; }

.btn { background: #0f766e; color: #fff; border: 0; padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
.btn:hover:not(:disabled) { background: #0c5f59; }
.btn:disabled { opacity: .5; cursor: default; }

.hint { color: #64748b; font-size: 13px; margin-top: 14px; }
</style>
