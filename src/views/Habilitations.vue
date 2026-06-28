<script setup>
import { ref, computed, inject, onMounted } from 'vue'
import { supabase } from '../supabase'

const ROLES = [
  { v: 'admin', l: 'Admin' },
  { v: 'operateur', l: 'Opérateur' },
  { v: 'lecteur', l: 'Lecteur' }
]

const role = inject('role', ref(null))
const estAdmin = computed(() => role.value === 'admin')

const users = ref([])
const moiId = ref(null)
const erreur = ref('')
const message = ref('')
const chargement = ref(false)

async function charger() {
  erreur.value = ''
  const s = await supabase.auth.getSession()
  moiId.value = s.data.session ? s.data.session.user.id : null
  chargement.value = true
  const r = await supabase.rpc('lister_utilisateurs')
  chargement.value = false
  if (r.error) { erreur.value = r.error.message; return }
  users.value = r.data
}

async function changerRole(u, e) {
  const nouveau = e.target.value
  erreur.value = ''; message.value = ''
  const res = await supabase.rpc('definir_role', { p_user_id: u.user_id, p_role: nouveau, p_email: u.email })
  if (res.error) { erreur.value = res.error.message; await charger(); return }
  message.value = 'Rôle mis à jour : ' + (u.email || 'utilisateur') + ' → ' + labelRole(nouveau) + '.'
  await charger()
}
async function basculerActif(u) {
  erreur.value = ''; message.value = ''
  const res = await supabase.rpc('definir_actif', { p_user_id: u.user_id, p_actif: !u.actif, p_email: u.email })
  if (res.error) { erreur.value = res.error.message; return }
  await charger()
}
function labelRole(v) { const x = ROLES.find(z => z.v === v); return x ? x.l : v }
function classeRole(v) { return { admin: 'r-admin', operateur: 'r-op', lecteur: 'r-lec' }[v] || 'r-lec' }

onMounted(charger)
</script>

<template>
  <div class="hb-page">
    <header class="hb-head">
      <h1>Habilitations</h1>
      <p class="sub">Gestion des comptes et des accès de l'équipe.</p>
    </header>

    <div v-if="!estAdmin" class="empty-card">
      🔒 Accès réservé aux administrateurs. Ton rôle actuel ne permet pas de gérer les habilitations.
    </div>

    <template v-else>
      <p v-if="erreur" class="alert">{{ erreur }}</p>
      <p v-if="message" class="ok">{{ message }}</p>

      <section class="legend">
        <div class="leg"><span class="badge r-admin">Admin</span> Tout, y compris la gestion des accès.</div>
        <div class="leg"><span class="badge r-op">Opérateur</span> Consulter + saisir / modifier les données.</div>
        <div class="leg"><span class="badge r-lec">Lecteur</span> Consultation seule (aucune écriture).</div>
      </section>

      <div class="ajout-info">
        <strong>Ajouter un membre :</strong> crée son compte dans Supabase (Authentication → Users → <em>Add user</em>, avec un mot de passe et « Auto Confirm » coché). Il apparaîtra ici automatiquement — il ne te reste qu'à choisir son rôle.
      </div>

      <section class="card">
        <div class="card-head">
          <h2 class="card-title">Comptes</h2>
          <span class="count">{{ users.length }}</span>
        </div>
        <p v-if="chargement" class="info">Chargement…</p>
        <div class="table-scroll">
          <table class="grid">
            <thead>
              <tr><th>Utilisateur</th><th>Rôle</th><th>Actif</th></tr>
            </thead>
            <tbody>
              <tr v-for="u in users" :key="u.user_id">
                <td>
                  {{ u.email || '(sans email)' }}
                  <span v-if="u.user_id === moiId" class="moi">(vous)</span>
                </td>
                <td>
                  <span v-if="u.user_id === moiId" class="badge" :class="classeRole(u.role)">{{ labelRole(u.role) }}</span>
                  <select v-else :value="u.role" @change="changerRole(u, $event)" class="role-select">
                    <option v-for="r in ROLES" :key="r.v" :value="r.v">{{ r.l }}</option>
                  </select>
                </td>
                <td>
                  <span v-if="u.user_id === moiId" class="badge-actif on">Actif</span>
                  <button v-else class="link" :class="u.actif ? 'danger' : ''" @click="basculerActif(u)">
                    {{ u.actif ? 'Désactiver' : 'Réactiver' }}
                  </button>
                </td>
              </tr>
              <tr v-if="!users.length && !chargement"><td colspan="3" class="empty">Aucun compte.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <p class="hint">Ton propre rôle n'est pas modifiable ici (sécurité : pour ne pas te verrouiller hors de l'administration). Les changements de rôle sont tracés dans le Journal d'audit.</p>
    </template>
  </div>
</template>

<style scoped>
.hb-page { color: #1b2733; }
.hb-head { margin: 4px 0 18px; }
.hb-head h1 { margin: 0; font-size: 24px; letter-spacing: -0.01em; }
.hb-head .sub { margin: 4px 0 0; color: #64748b; font-size: 14px; }

.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }
.ok { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }
.info { color: #64748b; font-size: 13px; }
.empty-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 28px; color: #475569; text-align: center; font-size: 15px; }

.legend { display: flex; flex-wrap: wrap; gap: 14px 24px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 18px; margin-bottom: 14px; }
.leg { font-size: 13px; color: #475569; display: flex; align-items: center; gap: 8px; }

.ajout-info { background: #f0f9ff; border: 1px solid #bae6fd; color: #0c4a6e; border-radius: 12px; padding: 14px 16px; margin-bottom: 18px; font-size: 13px; line-height: 1.5; }
.ajout-info em { font-style: normal; font-weight: 600; }

.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.card-title { margin: 0; font-size: 17px; }
.count { background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 600; padding: 2px 9px; border-radius: 999px; }

.table-scroll { overflow-x: auto; }
table.grid { width: 100%; border-collapse: collapse; font-size: 14px; }
table.grid th { text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
table.grid td { padding: 10px; border-bottom: 1px solid #eef2f6; }
.empty { color: #94a3b8; text-align: center; padding: 18px; font-style: italic; }
.moi { color: #0f766e; font-size: 12px; font-weight: 600; margin-left: 6px; }

.role-select { font-size: 14px; padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; font-weight: 500; }
.role-select:focus { outline: 2px solid #0f766e; border-color: #0f766e; }

.badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
.r-admin { background: #0f766e; color: #fff; }
.r-op { background: #1e40af; color: #fff; }
.r-lec { background: #64748b; color: #fff; }
.badge-actif { font-size: 12px; font-weight: 600; }
.badge-actif.on { color: #166534; }

button.link { background: none; border: 0; color: #0f766e; font-size: 13px; font-weight: 600; cursor: pointer; padding: 2px 6px; }
button.link:hover { text-decoration: underline; }
button.link.danger { color: #b91c1c; }

.hint { color: #64748b; font-size: 13px; margin-top: 4px; }
</style>
