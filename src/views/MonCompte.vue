<script setup>
import { ref, reactive, onMounted } from 'vue'
import { supabase } from '../supabase'

const email = ref('')
const pwd = ref('')
const pwd2 = ref('')
const msg = ref('')
const erreur = ref('')
const busy = ref(false)

// --- Code PIN de signature (superviseur) ---
const superviseurs = ref([])
const pinForm = reactive({ nom: '', ancien: '', nouveau: '', confirme: '' })
const aDejaPin = ref(false)
const pinMsg = ref('')
const pinErr = ref('')
const pinBusy = ref(false)

onMounted(async () => {
  const s = await supabase.auth.getSession()
  email.value = s.data.session ? s.data.session.user.email : ''
  const rs = await supabase.from('superviseurs').select('nom').order('nom')
  superviseurs.value = (rs.data || []).map(x => x.nom)
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

async function verifExistence() {
  aDejaPin.value = false; pinForm.ancien = ''; pinMsg.value = ''; pinErr.value = ''
  if (!pinForm.nom) return
  const r = await supabase.rpc('a_pin_superviseur', { p_nom: pinForm.nom })
  if (!r.error) aDejaPin.value = r.data === true
}

async function definirPin() {
  pinErr.value = ''; pinMsg.value = ''
  if (!pinForm.nom) { pinErr.value = 'Choisis ton nom.'; return }
  if (aDejaPin.value && !pinForm.ancien) { pinErr.value = 'Saisis ton code actuel pour le modifier.'; return }
  if (!pinForm.nouveau || pinForm.nouveau.length < 4) { pinErr.value = 'Le nouveau code doit comporter au moins 4 caractères.'; return }
  if (pinForm.nouveau !== pinForm.confirme) { pinErr.value = 'Les deux nouveaux codes ne correspondent pas.'; return }
  pinBusy.value = true
  const r = await supabase.rpc('definir_pin_superviseur', { p_nom: pinForm.nom, p_ancien: pinForm.ancien || '', p_nouveau: pinForm.nouveau })
  pinBusy.value = false
  if (r.error) { pinErr.value = 'Erreur : ' + r.error.message + ' — as-tu exécuté le SQL des fonctions ?'; return }
  if (r.data === true) {
    pinMsg.value = 'Code PIN enregistré avec succès ✓'
    pinForm.ancien = ''; pinForm.nouveau = ''; pinForm.confirme = ''
    aDejaPin.value = true
  } else {
    pinErr.value = 'Code actuel incorrect. Si tu as oublié ton code, demande à un administrateur de le réinitialiser.'
  }
}
</script>

<template>
  <div class="mc-page">
    <header class="mc-head">
      <h1>Mon compte</h1>
      <p class="sub">Gère ton mot de passe de connexion et ton code PIN de signature.</p>
    </header>

    <section class="card">
      <h2 class="card-t">🔑 Mot de passe de connexion</h2>
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

    <section class="card pin-card">
      <h2 class="card-t">🔒 Mon code PIN de signature</h2>
      <p class="pin-note">Ce code sert à signer les passations de consigne. Il est chiffré et connu de toi seul — personne ne peut le lire, seul un administrateur peut le réinitialiser en cas d'oubli.</p>

      <p v-if="pinErr" class="alert">{{ pinErr }}</p>
      <p v-if="pinMsg" class="ok">{{ pinMsg }}</p>

      <label class="field">Superviseur (toi)
        <select v-model="pinForm.nom" @change="verifExistence">
          <option value="">— Choisir ton nom —</option>
          <option v-for="s in superviseurs" :key="s" :value="s">{{ s }}</option>
        </select>
      </label>

      <label class="field" v-if="aDejaPin">Code actuel
        <input v-model="pinForm.ancien" type="password" autocomplete="off" inputmode="numeric" placeholder="Ton code actuel" />
      </label>
      <p v-else-if="pinForm.nom" class="pin-first">Aucun code défini — crée ton code ci-dessous.</p>

      <label class="field">Nouveau code
        <input v-model="pinForm.nouveau" type="password" autocomplete="new-password" inputmode="numeric" placeholder="Min. 4 caractères" />
      </label>
      <label class="field">Confirmer le nouveau code
        <input v-model="pinForm.confirme" type="password" autocomplete="new-password" inputmode="numeric" @keyup.enter="definirPin" placeholder="Retape le code" />
      </label>

      <button class="btn btn-pin" :disabled="pinBusy" @click="definirPin">{{ pinBusy ? 'Enregistrement…' : (aDejaPin ? 'Modifier mon code' : 'Créer mon code') }}</button>
    </section>

    <p class="hint">Une fois le mot de passe enregistré, déconnecte-toi puis reconnecte-toi avec <strong>e-mail + mot de passe</strong>. Le lien magique reste disponible en secours.</p>
  </div>
</template>

<style scoped>
.mc-page { color: #1b2733; max-width: 480px; }
.mc-head { margin: 4px 0 18px; }
.mc-head h1 { margin: 0; font-size: 24px; letter-spacing: -0.01em; }
.mc-head .sub { margin: 4px 0 0; color: #64748b; font-size: 14px; }

.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card + .card { margin-top: 16px; }
.card-t { margin: 0 0 14px; font-size: 15px; font-weight: 800; color: #1e293b; }
.pin-card { border-color: #ede9fe; }
.pin-note { background: #f5f3ff; border: 1px solid #ede9fe; color: #5b21b6; font-size: 12.5px; border-radius: 8px; padding: 10px 12px; margin: 0 0 14px; line-height: 1.45; }
.pin-first { font-size: 12.5px; color: #0369a1; background: #e0f2fe; border-radius: 8px; padding: 8px 10px; margin: 0 0 14px; }

.email-row { display: flex; flex-direction: column; gap: 3px; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #eef2f6; }
.email-row .lbl { font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: #94a3b8; }
.email-row .email { font-size: 15px; font-weight: 600; }

.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }
.ok { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }

.field { display: flex; flex-direction: column; font-size: 12px; font-weight: 600; color: #475569; gap: 5px; margin-bottom: 14px; }
.field input, .field select { font-size: 15px; padding: 9px 11px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; font-weight: 400; }
.field input:focus, .field select:focus { outline: 2px solid #0f766e; border-color: #0f766e; }

.btn { background: #0f766e; color: #fff; border: 0; padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
.btn:hover:not(:disabled) { background: #0c5f59; }
.btn:disabled { opacity: .5; cursor: default; }
.btn-pin { background: #6d28d9; }
.btn-pin:hover:not(:disabled) { background: #5b21b6; }

.hint { color: #64748b; font-size: 13px; margin-top: 14px; }
</style>
