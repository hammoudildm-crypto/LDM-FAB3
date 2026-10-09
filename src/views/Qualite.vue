<script setup>
import { ref, reactive, computed, onMounted, inject } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'

const peutEditer = inject('peutEditer', ref(false))
const erreur = ref('')
const message = ref('')
const tab = ref('dev')

const CRITICITES = ['Mineure', 'Majeure', 'Critique']
const STATUTS_DEV = ['Ouverte', 'En cours', 'Clôturée']

const deviations = ref([])
const devForm = reactive({ id: null, numero: '', date_dev: new Date().toISOString().slice(0, 10), produit_lot: '', criticite: '', type: '', description: '', origine: '', responsable: '', statut: 'Ouverte', capa_liee: '' })
const devRech = ref('')
const devFiltreStatut = ref('')

async function charger() {
  erreur.value = ''
  const r = await supabase.from('deviations').select('*').order('id', { ascending: false })
  if (r.error) { erreur.value = r.error.message; return }
  deviations.value = r.data || []
}
onMounted(charger)

const prochainNumero = computed(() => {
  const y = new Date().getFullYear()
  const n = deviations.value.filter(d => (d.numero || '').includes('DEV-' + y)).length + 1
  return 'DEV-' + y + '-' + String(n).padStart(3, '0')
})
const statutKey = (s) => { const n = (s || '').toLowerCase(); if (n.indexOf('ouvert') >= 0) return 'ouverte'; if (n.indexOf('cours') >= 0) return 'cours'; if (n.indexOf('clotur') >= 0 || n.indexOf('clôtur') >= 0) return 'cloturee'; return 'autre' }
const fmtD = (x) => { if (!x) return '—'; const dt = new Date(x); return isNaN(dt) ? x : dt.toLocaleDateString('fr-FR') }

const devListe = computed(() => {
  const q = (devRech.value || '').toLowerCase()
  return deviations.value.filter(d => {
    if (devFiltreStatut.value && d.statut !== devFiltreStatut.value) return false
    return !q || (d.numero || '').toLowerCase().indexOf(q) >= 0 || (d.produit_lot || '').toLowerCase().indexOf(q) >= 0 || (d.description || '').toLowerCase().indexOf(q) >= 0
  })
})
const kpiDev = computed(() => {
  const d = deviations.value
  return {
    total: d.length,
    ouvertes: d.filter(x => x.statut === 'Ouverte').length,
    enCours: d.filter(x => x.statut === 'En cours').length,
    cloturees: d.filter(x => x.statut === 'Clôturée').length,
    critiques: d.filter(x => x.criticite === 'Critique' && x.statut !== 'Clôturée').length
  }
})

function devReset() {
  Object.assign(devForm, { id: null, numero: '', date_dev: new Date().toISOString().slice(0, 10), produit_lot: '', criticite: '', type: '', description: '', origine: '', responsable: '', statut: 'Ouverte', capa_liee: '' })
}
async function devEnregistrer() {
  erreur.value = ''; message.value = ''
  if (!devForm.description.trim()) { erreur.value = 'La description est obligatoire.'; return }
  const payload = {
    numero: (devForm.numero || prochainNumero.value).trim(),
    date_dev: devForm.date_dev || null,
    produit_lot: devForm.produit_lot || null,
    criticite: devForm.criticite || null,
    type: devForm.type || null,
    description: devForm.description.trim(),
    origine: devForm.origine || null,
    responsable: devForm.responsable || null,
    statut: devForm.statut || 'Ouverte',
    capa_liee: devForm.capa_liee || null
  }
  const r = devForm.id
    ? await supabase.from('deviations').update(payload).eq('id', devForm.id)
    : await supabase.from('deviations').insert(payload)
  if (r.error) { erreur.value = r.error.message; return }
  message.value = devForm.id ? 'Déviation mise à jour.' : 'Déviation enregistrée.'
  devReset(); await charger()
}
function devModifier(d) { Object.assign(devForm, { id: d.id, numero: d.numero || '', date_dev: d.date_dev || '', produit_lot: d.produit_lot || '', criticite: d.criticite || '', type: d.type || '', description: d.description || '', origine: d.origine || '', responsable: d.responsable || '', statut: d.statut || 'Ouverte', capa_liee: d.capa_liee || '' }); window.scrollTo({ top: 0, behavior: 'smooth' }) }
async function devSupprimer(d) {
  if (!confirm('Supprimer la déviation ' + (d.numero || '') + ' ?')) return
  const r = await supabase.from('deviations').delete().eq('id', d.id)
  if (r.error) { erreur.value = r.error.message; return }
  await charger()
}
</script>

<template>
  <div class="q-page">
    <PageHeader title="Qualité" tone="teal" subtitle="Déviations, CAPA et changements." />
    <p v-if="erreur" class="q-alert">{{ erreur }}</p>
    <p v-if="message" class="q-ok">{{ message }}</p>

    <div class="q-tabs">
      <button :class="{ on: tab === 'dev' }" @click="tab = 'dev'">Déviations <span class="qt-n">{{ kpiDev.total }}</span></button>
      <button :class="{ on: tab === 'capa' }" @click="tab = 'capa'">CAPA</button>
      <button :class="{ on: tab === 'chg' }" @click="tab = 'chg'">Changements</button>
    </div>

    <div v-if="tab === 'dev'">
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-v">{{ kpiDev.total }}</div><div class="kpi-l">Total</div></div>
        <div class="kpi"><div class="kpi-v o">{{ kpiDev.ouvertes }}</div><div class="kpi-l">Ouvertes</div></div>
        <div class="kpi"><div class="kpi-v c">{{ kpiDev.enCours }}</div><div class="kpi-l">En cours</div></div>
        <div class="kpi"><div class="kpi-v g">{{ kpiDev.cloturees }}</div><div class="kpi-l">Clôturées</div></div>
        <div class="kpi"><div class="kpi-v r">{{ kpiDev.critiques }}</div><div class="kpi-l">Critiques ouvertes</div></div>
      </div>

      <section class="card" v-if="peutEditer">
        <h2 class="card-title">{{ devForm.id ? 'Modifier la déviation' : 'Nouvelle déviation' }}</h2>
        <div class="of-grid">
          <label class="of-col"><span class="of-lbl">N°</span><input v-model="devForm.numero" :placeholder="prochainNumero" /></label>
          <label class="of-col"><span class="of-lbl">Date</span><input v-model="devForm.date_dev" type="date" /></label>
          <label class="of-col"><span class="of-lbl">Produit / Lot</span><input v-model="devForm.produit_lot" placeholder="Produit ou n° lot" /></label>
          <label class="of-col"><span class="of-lbl">Criticité</span><select v-model="devForm.criticite"><option value="">—</option><option v-for="c in CRITICITES" :key="c" :value="c">{{ c }}</option></select></label>
          <label class="of-col"><span class="of-lbl">Type</span><input v-model="devForm.type" placeholder="Type de déviation" /></label>
          <label class="of-col"><span class="of-lbl">Origine</span><input v-model="devForm.origine" placeholder="Origine / cause" /></label>
          <label class="of-col"><span class="of-lbl">Responsable</span><input v-model="devForm.responsable" placeholder="Responsable" /></label>
          <label class="of-col"><span class="of-lbl">Statut</span><select v-model="devForm.statut"><option v-for="s in STATUTS_DEV" :key="s" :value="s">{{ s }}</option></select></label>
          <label class="of-col"><span class="of-lbl">CAPA liée</span><input v-model="devForm.capa_liee" placeholder="N° CAPA" /></label>
          <label class="of-col of-wide"><span class="of-lbl">Description *</span><textarea v-model="devForm.description" rows="2" placeholder="Description de la déviation"></textarea></label>
        </div>
        <div class="q-actions">
          <button class="q-btn" @click="devEnregistrer">{{ devForm.id ? 'Mettre à jour' : 'Ajouter' }}</button>
          <button v-if="devForm.id" class="q-btn ghost" @click="devReset">Annuler</button>
        </div>
      </section>

      <section class="card">
        <div class="q-bar">
          <input v-model="devRech" class="q-search" placeholder="Rechercher (N°, lot, description)…" />
          <select v-model="devFiltreStatut" class="q-filtre"><option value="">Tous les statuts</option><option v-for="s in STATUTS_DEV" :key="s" :value="s">{{ s }}</option></select>
          <span class="q-count">{{ devListe.length }} déviation(s)</span>
        </div>
        <div v-if="!devListe.length" class="empty-sm">Aucune déviation enregistrée.</div>
        <div v-else class="q-tablewrap">
          <table class="q-table">
            <thead><tr><th>N°</th><th>Date</th><th>Produit/Lot</th><th>Criticité</th><th>Description</th><th>Responsable</th><th>CAPA</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              <tr v-for="d in devListe" :key="d.id">
                <td class="qt-num">{{ d.numero || '—' }}</td>
                <td>{{ fmtD(d.date_dev) }}</td>
                <td>{{ d.produit_lot || '—' }}</td>
                <td><span v-if="d.criticite" class="q-crit" :class="'crit-' + d.criticite.toLowerCase()">{{ d.criticite }}</span><span v-else>—</span></td>
                <td class="qt-desc" :title="d.description">{{ d.description || '—' }}</td>
                <td>{{ d.responsable || '—' }}</td>
                <td>{{ d.capa_liee || '—' }}</td>
                <td><span class="q-stat" :class="'st-' + statutKey(d.statut)">{{ d.statut }}</span></td>
                <td class="qt-act"><button v-if="peutEditer" @click="devModifier(d)" title="Modifier">✎</button><button v-if="peutEditer" @click="devSupprimer(d)" title="Supprimer">🗑</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <div v-else class="card bientot">
      <div class="bt-ic">🚧</div>
      <div class="bt-txt">Module <b>{{ tab === 'capa' ? 'CAPA' : 'Changements' }}</b> à venir.</div>
    </div>
  </div>
</template>

<style scoped>
.q-page { color: #1b2733; }
.q-alert { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 10px; padding: 10px 14px; font-size: 14px; margin-bottom: 12px; }
.q-ok { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; border-radius: 10px; padding: 10px 14px; font-size: 14px; margin-bottom: 12px; }
.q-tabs { display: inline-flex; flex-wrap: wrap; gap: 4px; background: #f1f5f9; border-radius: 10px; padding: 4px; margin-bottom: 18px; }
.q-tabs button { border: 0; background: transparent; padding: 8px 16px; border-radius: 8px; font: inherit; font-size: 13px; font-weight: 700; color: #64748b; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.q-tabs button.on { background: #fff; color: #0d9488; box-shadow: 0 1px 2px rgba(16,24,40,.08); }
.qt-n { background: #e2e8f0; color: #475569; border-radius: 999px; font-size: 10px; padding: 1px 7px; font-weight: 800; }
.q-tabs button.on .qt-n { background: #ccfbf1; color: #0f766e; }
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-bottom: 18px; }
.kpi { background: #fff; border: 1px solid #eef1f6; border-radius: 12px; padding: 14px; box-shadow: 0 1px 3px rgba(16,24,40,.04); }
.kpi-v { font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -.02em; }
.kpi-v.o { color: #d97706; } .kpi-v.c { color: #0284c7; } .kpi-v.g { color: #16a34a; } .kpi-v.r { color: #dc2626; }
.kpi-l { font-size: 11px; color: #64748b; margin-top: 3px; font-weight: 600; }
.card { background: #fff; border: 1px solid #eef1f6; border-radius: 16px; padding: 20px; box-shadow: 0 1px 3px rgba(16,24,40,.04); margin-bottom: 18px; }
.card-title { font-size: 15px; font-weight: 800; color: #0f172a; margin: 0 0 14px; }
.of-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px 12px; align-items: start; }
.of-col { display: flex; flex-direction: column; gap: 4px; }
.of-col.of-wide { grid-column: 1 / -1; }
.of-lbl { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .03em; color: #94a3b8; }
.of-col input, .of-col select, .of-col textarea { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; color: #1b2733; width: 100%; box-sizing: border-box; resize: vertical; }
.q-actions { margin-top: 14px; display: flex; gap: 8px; }
.q-btn { background: #0d9488; color: #fff; border: 0; border-radius: 8px; padding: 9px 18px; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
.q-btn:hover { background: #0f766e; }
.q-btn.ghost { background: #fff; color: #475569; border: 1px solid #cbd5e1; }
.q-btn.ghost:hover { background: #f8fafc; }
.q-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.q-search { flex: 1; min-width: 180px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; }
.q-filtre { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; font-weight: 600; }
.q-count { font-size: 12px; color: #94a3b8; font-weight: 700; }
.empty-sm { color: #94a3b8; font-size: 13px; padding: 12px 2px; }
.q-tablewrap { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 10px; }
.q-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; }
.q-table th { background: #f8fafc; color: #475569; padding: 9px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; white-space: nowrap; }
.q-table td { padding: 9px 12px; border-top: 1px solid #f1f5f9; white-space: nowrap; }
.q-table tbody tr:hover td { background: #f0fdfa; }
.qt-num { font-weight: 700; color: #0f172a; }
.qt-desc { max-width: 280px; overflow: hidden; text-overflow: ellipsis; }
.q-crit { font-size: 10.5px; font-weight: 800; padding: 2px 8px; border-radius: 999px; }
.crit-mineure { background: #dcfce7; color: #16a34a; }
.crit-majeure { background: #ffedd5; color: #ea580c; }
.crit-critique { background: #fee2e2; color: #dc2626; }
.q-stat { font-size: 10.5px; font-weight: 800; padding: 2px 8px; border-radius: 999px; }
.q-stat.st-ouverte { background: #fef3c7; color: #b45309; }
.q-stat.st-cours { background: #dbeafe; color: #0284c7; }
.q-stat.st-cloturee { background: #dcfce7; color: #16a34a; }
.q-stat.st-autre { background: #f1f5f9; color: #64748b; }
.qt-act { text-align: right; }
.qt-act button { border: 1px solid #e2e8f0; background: #fff; border-radius: 6px; padding: 3px 7px; cursor: pointer; font-size: 12px; margin-left: 4px; }
.qt-act button:hover { background: #f1f5f9; }
.bientot { text-align: center; padding: 48px 20px; }
.bt-ic { font-size: 40px; margin-bottom: 10px; }
.bt-txt { font-size: 15px; color: #64748b; }
</style>
