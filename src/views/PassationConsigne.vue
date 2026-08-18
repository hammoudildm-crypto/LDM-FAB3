<script setup>
import { ref, reactive, computed, onMounted, inject } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'

const peutEditer = inject('peutEditer', ref(true))

const SHIFTS = [
  { key: 'matin', label: 'Matin (06h–14h)' },
  { key: 'apres-midi', label: 'Après-midi (14h–22h)' },
  { key: 'nuit', label: 'Nuit (22h–06h)' }
]
function shiftLabel(k) { const s = SHIFTS.find(x => x.key === k); return s ? s.label : k }

const superviseurs = ref([])
const consignes = ref([])
const chargement = ref(true)
const erreur = ref('')
const enregistrement = ref(false)
const entrantSel = reactive({})

const form = reactive({
  date_shift: new Date().toISOString().slice(0, 10),
  shift: 'matin',
  superviseur_sortant: '',
  taches_realisees: '',
  taches_a_realiser: ''
})

async function charger() {
  chargement.value = true
  erreur.value = ''
  const rs = await supabase.from('superviseurs').select('nom').order('nom')
  superviseurs.value = (rs.data || []).map(x => x.nom)
  const rc = await supabase.from('passation_consignes')
    .select('*')
    .order('date_shift', { ascending: false })
    .order('cree_le', { ascending: false })
    .limit(300)
  if (rc.error) erreur.value = 'Table « passation_consignes » introuvable — exécute le SQL fourni. (' + rc.error.message + ')'
  else consignes.value = rc.data || []
  chargement.value = false
}
onMounted(charger)

async function enregistrer() {
  if (!form.superviseur_sortant || !form.shift || !form.date_shift) {
    erreur.value = 'Renseigne la date, le shift et le superviseur sortant.'
    return
  }
  enregistrement.value = true
  erreur.value = ''
  const r = await supabase.from('passation_consignes').insert({
    date_shift: form.date_shift,
    shift: form.shift,
    superviseur_sortant: form.superviseur_sortant,
    taches_realisees: form.taches_realisees || null,
    taches_a_realiser: form.taches_a_realiser || null
  })
  enregistrement.value = false
  if (r.error) { erreur.value = 'Enregistrement échoué : ' + r.error.message; return }
  form.taches_realisees = ''
  form.taches_a_realiser = ''
  await charger()
}

async function prendreConnaissance(c) {
  const nom = entrantSel[c.id]
  if (!nom) { erreur.value = 'Choisis le superviseur entrant avant de valider.'; return }
  erreur.value = ''
  const r = await supabase.from('passation_consignes').update({
    pris_connaissance: true,
    superviseur_entrant: nom,
    pris_connaissance_le: new Date().toISOString()
  }).eq('id', c.id)
  if (r.error) { erreur.value = 'Validation échouée : ' + r.error.message; return }
  await charger()
}

function fmtDate(d) { if (!d) return '—'; const x = new Date(d); return isNaN(x) ? d : x.toLocaleDateString('fr-FR') }
function fmtDateTime(d) { if (!d) return '—'; const x = new Date(d); return isNaN(x) ? d : x.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }

const nbEnAttente = computed(() => consignes.value.filter(c => !c.pris_connaissance).length)
</script>

<template>
  <div class="pc-page">
    <PageHeader title="Passation de consigne — Production" tone="violet">
      <p class="pc-sub">Transmission entre superviseurs des 3 shifts — tâches réalisées &amp; tâches à réaliser</p>
    </PageHeader>

    <p v-if="erreur" class="pc-err">{{ erreur }}</p>

    <section v-if="peutEditer" class="pc-card">
      <h2 class="pc-title">Nouvelle passation</h2>
      <div class="pc-form">
        <div class="pc-row">
          <label class="pc-field"><span>Date</span><input type="date" v-model="form.date_shift" /></label>
          <label class="pc-field"><span>Shift</span>
            <select v-model="form.shift"><option v-for="s in SHIFTS" :key="s.key" :value="s.key">{{ s.label }}</option></select>
          </label>
          <label class="pc-field"><span>Superviseur sortant</span>
            <select v-model="form.superviseur_sortant"><option value="">— Choisir —</option><option v-for="s in superviseurs" :key="s" :value="s">{{ s }}</option></select>
          </label>
        </div>
        <label class="pc-field full"><span class="pc-lbl ok">✅ Tâches réalisées</span><textarea v-model="form.taches_realisees" rows="4" placeholder="Ce qui a été fait pendant le shift…"></textarea></label>
        <label class="pc-field full"><span class="pc-lbl todo">📋 Tâches à réaliser (shift suivant)</span><textarea v-model="form.taches_a_realiser" rows="4" placeholder="Ce qui reste à faire / points de vigilance…"></textarea></label>
        <div class="pc-actions">
          <button class="pc-btn" :disabled="enregistrement" @click="enregistrer">{{ enregistrement ? 'Enregistrement…' : 'Enregistrer la consigne' }}</button>
        </div>
      </div>
    </section>

    <section class="pc-card">
      <h2 class="pc-title">Consignes <span v-if="nbEnAttente" class="pc-count">{{ nbEnAttente }} en attente de lecture</span></h2>
      <p v-if="chargement" class="pc-muted">Chargement…</p>
      <p v-else-if="!consignes.length" class="pc-muted">Aucune consigne enregistrée pour l'instant.</p>
      <div v-else class="pc-list">
        <article v-for="c in consignes" :key="c.id" class="pc-item" :class="{ 'pc-nonlu': !c.pris_connaissance }">
          <header class="pc-head">
            <span class="pc-shift">{{ shiftLabel(c.shift) }}</span>
            <span class="pc-datechip">{{ fmtDate(c.date_shift) }}</span>
            <span class="pc-sortant">Sortant : <b>{{ c.superviseur_sortant }}</b></span>
            <span v-if="!c.pris_connaissance" class="pc-badge">Non lu</span>
          </header>
          <div class="pc-blocks">
            <div class="pc-block"><span class="pc-lbl ok">✅ Tâches réalisées</span><p>{{ c.taches_realisees || '—' }}</p></div>
            <div class="pc-block"><span class="pc-lbl todo">📋 Tâches à réaliser</span><p>{{ c.taches_a_realiser || '—' }}</p></div>
          </div>
          <footer class="pc-foot">
            <div v-if="c.pris_connaissance" class="pc-ack ok">✓ Pris connaissance par <b>{{ c.superviseur_entrant }}</b> le {{ fmtDateTime(c.pris_connaissance_le) }}</div>
            <div v-else-if="peutEditer" class="pc-ack-form">
              <select v-model="entrantSel[c.id]"><option value="">— Superviseur entrant —</option><option v-for="s in superviseurs" :key="s" :value="s">{{ s }}</option></select>
              <button class="pc-btn sm" @click="prendreConnaissance(c)">Pris connaissance</button>
            </div>
            <div v-else class="pc-ack pending">En attente de lecture</div>
          </footer>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.pc-page { padding: 4px; }
.pc-sub { margin: 4px 0 0; font-size: 13px; opacity: .85; }
.pc-err { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 8px 12px; border-radius: 8px; font-size: 13px; margin: 10px 0; }
.pc-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 16px 18px; margin-top: 14px; box-shadow: 0 1px 2px rgba(0,0,0,.04); }
.pc-title { margin: 0 0 12px; font-size: 16px; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 10px; }
.pc-count { font-size: 11px; font-weight: 700; color: #92400e; background: #fef3c7; border: 1px solid #fde68a; border-radius: 20px; padding: 2px 10px; }
.pc-form { display: flex; flex-direction: column; gap: 12px; }
.pc-row { display: flex; gap: 14px; flex-wrap: wrap; }
.pc-field { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 700; color: #475569; }
.pc-field.full { width: 100%; }
.pc-field > span { display: block; }
.pc-field input, .pc-field select, .pc-field textarea { font: inherit; font-weight: 500; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; color: #0f172a; background: #fff; }
.pc-field textarea { resize: vertical; line-height: 1.4; }
.pc-field select, .pc-field input { min-width: 190px; }
.pc-lbl { font-weight: 800; }
.pc-lbl.ok { color: #047857; }
.pc-lbl.todo { color: #b45309; }
.pc-actions { display: flex; justify-content: flex-end; }
.pc-btn { background: #6d28d9; color: #fff; border: none; border-radius: 9px; padding: 9px 18px; font-weight: 700; font-size: 13.5px; cursor: pointer; }
.pc-btn:hover { background: #5b21b6; }
.pc-btn:disabled { opacity: .6; cursor: default; }
.pc-btn.sm { padding: 6px 12px; font-size: 12.5px; }
.pc-muted { color: #94a3b8; font-size: 13px; }
.pc-list { display: flex; flex-direction: column; gap: 12px; }
.pc-item { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px 14px; background: #fafafa; }
.pc-item.pc-nonlu { border-left: 4px solid #f59e0b; background: #fffbeb; }
.pc-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
.pc-shift { font-weight: 800; color: #4c1d95; background: #ede9fe; border-radius: 6px; padding: 2px 10px; font-size: 12.5px; }
.pc-datechip { font-weight: 700; color: #334155; font-size: 12.5px; }
.pc-sortant { font-size: 12.5px; color: #475569; }
.pc-badge { margin-left: auto; font-size: 10.5px; font-weight: 800; color: #92400e; background: #fde68a; border-radius: 20px; padding: 2px 9px; text-transform: uppercase; letter-spacing: .3px; }
.pc-blocks { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.pc-block { background: #fff; border: 1px solid #eef2f7; border-radius: 8px; padding: 8px 10px; }
.pc-block .pc-lbl { font-size: 11.5px; }
.pc-block p { margin: 4px 0 0; font-size: 13px; color: #1e293b; white-space: pre-wrap; line-height: 1.4; }
.pc-foot { margin-top: 10px; padding-top: 8px; border-top: 1px dashed #e5e7eb; }
.pc-ack.ok { color: #047857; font-size: 12.5px; font-weight: 600; }
.pc-ack.pending { color: #b45309; font-size: 12.5px; font-weight: 600; }
.pc-ack-form { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.pc-ack-form select { font: inherit; padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 8px; }
@media (max-width: 640px) { .pc-blocks { grid-template-columns: 1fr; } }
</style>
