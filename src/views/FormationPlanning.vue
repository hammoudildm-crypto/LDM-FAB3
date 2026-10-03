<template>
  <div class="form-page">
    <PageHeader title="Formations — Planification & suivi" tone="#0d9488"
      subtitle="Planifie des sessions de formation et suis leur réalisation, personne par personne." />

    <p v-if="erreur" class="alert">{{ erreur }}</p>
    <p v-if="message" class="ok">{{ message }}</p>

    <section class="card">
      <div class="card-head"><h2 class="card-title">{{ form.id ? 'Modifier la session' : 'Planifier une session' }}</h2></div>
      <div v-if="peutEditer" class="pl-form">
        <div class="row1">
          <select v-model="form.formation_id" class="grow"><option value="">Formation —</option><option v-for="f in formations" :key="f.id" :value="String(f.id)">{{ f.nom }}</option></select>
          <input type="date" v-model="form.date_prevue" />
          <input v-model="form.formateur" placeholder="Formateur" class="c" />
        </div>
        <div class="multi">
          <div v-if="form.personnes.length" class="chips"><span v-for="(pid, i) in form.personnes" :key="pid" class="chip">{{ personneNom(pid) }}<button type="button" @click="form.personnes.splice(i, 1)">×</button></span></div>
          <select @change="ajouterPersonne" class="add-sel"><option value="">+ Ajouter une personne</option><option v-for="p in personnes" :key="p.id" :value="String(p.id)" :disabled="form.personnes.includes(p.id)">{{ p.nom }}{{ p.fonction ? ' — ' + p.fonction : '' }}</option></select>
        </div>
        <div class="acts">
          <button class="btn" @click="enregistrer">{{ form.id ? 'Mettre à jour' : 'Planifier' }}</button>
          <button v-if="form.id" class="btn ghost" @click="reset">Annuler</button>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <h2 class="card-title">Sessions</h2>
        <span class="count">{{ sessionsFiltrees.length }}</span>
        <select v-model="filtreEtat" class="filtre" style="margin-left:auto"><option value="">Tous les états</option><option value="avenir">À venir</option><option value="retard">En retard</option><option value="realise">Réalisées</option><option value="annule">Annulées</option></select>
      </div>

      <div class="kpis">
        <div class="kpi"><div class="kv">{{ nbAvenir }}</div><div class="kl">À venir</div></div>
        <div class="kpi bad"><div class="kv">{{ nbRetard }}</div><div class="kl">En retard</div></div>
        <div class="kpi good"><div class="kv">{{ nbRealise }}</div><div class="kl">Réalisées</div></div>
      </div>

      <div v-if="!sessionsFiltrees.length" class="empty-card">Aucune session. Planifie-en une ci-dessus.</div>
      <div v-for="s in sessionsFiltrees" :key="s.id" class="sess" :class="'b-' + s.etat">
        <div class="sess-head">
          <span class="sess-form">{{ s.formationNom }}</span>
          <span class="meta">📅 {{ s.date_prevue }}</span>
          <span v-if="s.formateur" class="meta">👤 {{ s.formateur }}</span>
          <span class="etat" :class="'e-' + s.etat">{{ etatTxt(s) }}</span>
          <span class="prog">{{ s.faits.length }}/{{ s.personnes.length }} faits</span>
        </div>
        <div v-if="s.personnes.length" class="sess-pers">
          <label v-for="pid in s.personnes" :key="pid" class="pers" :class="{ fait: s.faits.includes(pid) }">
            <input type="checkbox" :checked="s.faits.includes(pid)" :disabled="!peutEditer" @change="toggleFait(s, pid)" />
            {{ personneNom(pid) }}
          </label>
        </div>
        <div v-else class="sess-vide">Aucune personne dans cette session.</div>
        <div v-if="peutEditer" class="sess-acts">
          <button v-if="s.statut !== 'realise'" class="btn sm" @click="setStatut(s, 'realise')">✓ Marquer réalisée</button>
          <button v-if="s.statut === 'realise'" class="btn ghost sm" @click="setStatut(s, 'planifie')">↩ Rouvrir</button>
          <button v-if="s.statut !== 'annule'" class="btn ghost sm" @click="setStatut(s, 'annule')">Annuler</button>
          <button class="btn ghost sm" @click="modifier(s)">✎ Modifier</button>
          <button class="btn ghost sm" @click="supprimer(s)">🗑</button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, inject } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'

const peutEditer = inject('peutEditer', ref(true))
const route = useRoute()
const formations = ref([])
const personnes = ref([])
const sessions = ref([])
const filtreEtat = ref('')
const erreur = ref('')
const message = ref('')
const today = new Date().toISOString().slice(0, 10)
const form = reactive({ id: null, formation_id: '', date_prevue: today, formateur: '', personnes: [] })
function reset() { Object.assign(form, { id: null, formation_id: '', date_prevue: today, formateur: '', personnes: [] }) }

async function charger() {
  const rf = await supabase.from('formations').select('id, nom').eq('actif', true).order('ordre')
  if (!rf.error) formations.value = rf.data || []
  const rp = await supabase.from('organigramme').select('id, nom, fonction').eq('actif', true).order('nom')
  if (!rp.error) personnes.value = rp.data || []
  const rs = await supabase.from('formation_planning').select('*').order('date_prevue', { ascending: false })
  if (rs.error) { erreur.value = rs.error.message; return }
  sessions.value = rs.data || []
}
onMounted(async () => {
  await charger()
  if (route.query.formation) {
    form.formation_id = String(route.query.formation)
    const ids = String(route.query.personnes || '').split(',').map(Number).filter(Boolean)
    form.personnes = ids.filter(id => personnes.value.some(p => p.id === id))
    message.value = 'Session pré-remplie depuis la matrice — vérifie la date et le formateur, puis planifie.'
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
})

const formationById = computed(() => { const m = {}; for (const f of formations.value) m[f.id] = f; return m })
const personneById = computed(() => { const m = {}; for (const p of personnes.value) m[p.id] = p; return m })
function personneNom(pid) { const p = personneById.value[pid]; return p ? p.nom : '(supprimé)' }

const sessionsEnr = computed(() => sessions.value.map(s => {
  const f = formationById.value[s.formation_id]
  let etat = s.statut === 'realise' ? 'realise' : s.statut === 'annule' ? 'annule' : (s.date_prevue < today ? 'retard' : 'avenir')
  return { ...s, formationNom: f ? f.nom : '(formation supprimée)', etat, personnes: s.personnes || [], faits: s.faits || [] }
}))
const sessionsFiltrees = computed(() => filtreEtat.value ? sessionsEnr.value.filter(s => s.etat === filtreEtat.value) : sessionsEnr.value)
const nbAvenir = computed(() => sessionsEnr.value.filter(s => s.etat === 'avenir').length)
const nbRetard = computed(() => sessionsEnr.value.filter(s => s.etat === 'retard').length)
const nbRealise = computed(() => sessionsEnr.value.filter(s => s.etat === 'realise').length)
function etatTxt(s) { return s.etat === 'avenir' ? 'À venir' : s.etat === 'retard' ? 'En retard' : s.etat === 'realise' ? '✓ Réalisée' : 'Annulée' }

function ajouterPersonne(e) { const v = Number(e.target.value); if (v && !form.personnes.includes(v)) form.personnes.push(v); e.target.value = '' }

async function enregistrer() {
  erreur.value = ''; message.value = ''
  if (!form.formation_id) { erreur.value = 'Choisis une formation.'; return }
  if (!form.date_prevue) { erreur.value = 'La date prévue est requise.'; return }
  const payload = { formation_id: Number(form.formation_id), date_prevue: form.date_prevue, formateur: form.formateur || null, personnes: form.personnes }
  let r
  if (form.id) r = await supabase.from('formation_planning').update(payload).eq('id', form.id)
  else r = await supabase.from('formation_planning').insert({ ...payload, statut: 'planifie', faits: [] })
  if (r.error) { erreur.value = r.error.message; return }
  message.value = form.id ? 'Session mise à jour.' : 'Session planifiée.'
  reset(); await charger()
}
function modifier(s) { Object.assign(form, { id: s.id, formation_id: String(s.formation_id), date_prevue: s.date_prevue, formateur: s.formateur || '', personnes: [...(s.personnes || [])] }); window.scrollTo({ top: 0, behavior: 'smooth' }) }
async function supprimer(s) {
  if (!confirm('Supprimer cette session ?')) return
  const r = await supabase.from('formation_planning').delete().eq('id', s.id)
  if (r.error) { erreur.value = r.error.message; return }
  message.value = 'Session supprimée.'; await charger()
}
async function setStatut(s, st) {
  const r = await supabase.from('formation_planning').update({ statut: st }).eq('id', s.id)
  if (r.error) { erreur.value = r.error.message; return }
  message.value = st === 'realise' ? 'Session réalisée — pense à saisir les enregistrements (page Enregistrements).' : (st === 'annule' ? 'Session annulée.' : 'Session rouverte.')
  await charger()
}
async function toggleFait(s, pid) {
  const faits = s.faits.includes(pid) ? s.faits.filter(x => x !== pid) : [...s.faits, pid]
  const r = await supabase.from('formation_planning').update({ faits }).eq('id', s.id)
  if (r.error) { erreur.value = r.error.message; return }
  await charger()
}
</script>

<style scoped>
.form-page { color: #1b2733; zoom: 0.9; }
.alert { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 10px 14px; border-radius: 8px; margin: 0 0 14px; }
.ok { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 10px 14px; border-radius: 8px; margin: 0 0 14px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 22px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
.card-title { margin: 0; font-size: 17px; }
.count { background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 600; padding: 2px 9px; border-radius: 999px; }
.empty-card { background: #fff; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 24px; color: #475569; text-align: center; font-size: 14px; }
.btn { background: #0d9488; color: #fff; border: 0; padding: 9px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.btn.ghost { background: #fff; color: #475569; border: 1px solid #cbd5e1; }
.btn.sm { padding: 6px 11px; font-size: 12px; }
.filtre { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; color: #1b2733; font-weight: 600; }

.pl-form { display: flex; flex-direction: column; gap: 12px; }
.pl-form .row1 { display: flex; flex-wrap: wrap; gap: 8px; }
.pl-form select, .pl-form input { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; color: #1b2733; }
.pl-form .grow { flex: 1; min-width: 200px; }
.pl-form .c { width: 160px; }
.pl-form select:focus, .pl-form input:focus { outline: none; border-color: #0d9488; box-shadow: 0 0 0 3px rgba(13,148,136,.15); }
.pl-form .acts { display: flex; gap: 8px; }
.multi { display: flex; flex-direction: column; gap: 6px; }
.multi .chips { display: flex; flex-wrap: wrap; gap: 5px; }
.multi .chip { display: inline-flex; align-items: center; gap: 4px; background: #eef2ff; color: #4338ca; border-radius: 999px; padding: 3px 5px 3px 10px; font-size: 12px; font-weight: 700; }
.multi .chip button { border: 0; background: transparent; color: inherit; cursor: pointer; font-size: 14px; line-height: 1; }
.multi .add-sel { align-self: flex-start; padding: 8px 10px; border: 1px dashed #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; color: #64748b; min-width: 240px; }

.kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 18px; }
.kpi { background: #f8fafc; border: 1px solid #eef2f6; border-radius: 12px; padding: 14px; text-align: center; }
.kpi .kv { font-size: 24px; font-weight: 800; color: #0f172a; }
.kpi .kl { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #94a3b8; font-weight: 700; margin-top: 2px; }
.kpi.good .kv { color: #16a34a; } .kpi.bad .kv { color: #dc2626; }

.sess { border: 1px solid #e2e8f0; border-left: 4px solid #cbd5e1; border-radius: 10px; padding: 12px 14px; margin-bottom: 10px; }
.sess.b-avenir { border-left-color: #0ea5e9; }
.sess.b-retard { border-left-color: #dc2626; background: #fef6f6; }
.sess.b-realise { border-left-color: #16a34a; }
.sess.b-annule { border-left-color: #cbd5e1; opacity: .7; }
.sess-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.sess-form { font-weight: 800; color: #0f172a; font-size: 14px; }
.sess-head .meta { font-size: 12px; color: #64748b; font-weight: 600; }
.sess-head .prog { margin-left: auto; font-size: 12px; font-weight: 700; color: #475569; background: #f1f5f9; border-radius: 999px; padding: 2px 10px; }
.etat { font-size: 11px; font-weight: 800; padding: 2px 9px; border-radius: 999px; }
.etat.e-avenir { background: #e0f2fe; color: #075985; }
.etat.e-retard { background: #fee2e2; color: #b91c1c; }
.etat.e-realise { background: #dcfce7; color: #166534; }
.etat.e-annule { background: #f1f5f9; color: #64748b; }
.sess-pers { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.pers { display: inline-flex; align-items: center; gap: 6px; border: 1px solid #eef2f6; border-radius: 8px; padding: 5px 10px; font-size: 12.5px; cursor: pointer; }
.pers input { accent-color: #16a34a; cursor: pointer; }
.pers.fait { background: #f0fdf4; border-color: #bbf7d0; color: #166534; font-weight: 600; }
.sess-vide { margin-top: 8px; font-size: 12px; color: #94a3b8; font-style: italic; }
.sess-acts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
</style>
