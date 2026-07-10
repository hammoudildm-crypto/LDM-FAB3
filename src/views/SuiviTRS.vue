<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'
import MiniChart from '../components/MiniChart.vue'
import { ICONS, TINTS } from '../icons.js'

const postes = ref([])
const cadences = ref([])
const chargement = ref(true)
const msg = ref('')

const now = new Date()
const du = ref(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10))
const au = ref(now.toISOString().slice(0, 10))

const MOTIFS = [
  ['panne', 'arret_panne_min', 'Panne', '#ef4444'],
  ['format', 'arret_format_min', 'Format', '#f59e0b'],
  ['nettoyage', 'arret_nettoyage_min', 'Nettoyage', '#0f766e'],
  ['reglage', 'arret_reglage_min', 'Réglage', '#8b5cf6'],
  ['maintenance', 'arret_maintenance_min', 'Maintenance', '#6366f1'],
  ['attente', 'arret_attente_min', 'Attente', '#94a3b8'],
  ['autre', 'arret_autre_min', 'Autre', '#cbd5e1']
]

async function charger() {
  chargement.value = true; msg.value = ''
  const r = await supabase.from('trs_postes')
    .select('*, equipements(code, nom), produits(code_pf)')
    .eq('actif', true).gte('date', du.value).lte('date', au.value)
  if (r.error) { msg.value = r.error.message; chargement.value = false; return }
  postes.value = r.data || []
  const rc = await supabase.from('cadences_produit').select('*')
  if (!rc.error) cadences.value = rc.data || []
  chargement.value = false
}
onMounted(charger)

function cadenceDe(eq, pr) {
  const c = cadences.value.find(c => c.equipement_id === eq && c.produit_id === pr)
  return { value: c && c.cadence_nominale != null ? Number(c.cadence_nominale) : 0, mode: c ? (c.mode || 'debit') : 'debit' }
}

const equipFiltre = ref('')
const equipList = computed(() => {
  const m = {}
  for (const s of postes.value) if (s.equipements && !m[s.equipement_id]) m[s.equipement_id] = { id: s.equipement_id, code: s.equipements.code, nom: s.equipements.nom }
  return Object.values(m).sort((a, b) => String(a.code).localeCompare(String(b.code)))
})
const equipFiltreCode = computed(() => { const e = equipList.value.find(e => e.id === equipFiltre.value); return e ? e.code : '' })
const postesFiltres = computed(() => equipFiltre.value ? postes.value.filter(s => s.equipement_id === equipFiltre.value) : postes.value)
const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const trsParMois = computed(() => {
  const parM = {}
  for (const s of postesFiltres.value) {
    const mo = new Date(s.date).getMonth()
    if (!parM[mo]) parM[mo] = { ouverture: 0, fonct: 0, theo: 0, prodPerf: 0, ecoule: 0, fonctPerf: 0, prodQual: 0, rebutsQual: 0 }
    const a = parM[mo]
    const to = s.temps_ouverture_min || 0
    let arr = 0
    for (const m of MOTIFS) arr += s[m[1]] || 0
    const tf = Math.max(0, to - arr)
    a.ouverture += to; a.fonct += tf
    const cd = cadenceDe(s.equipement_id, s.produit_id)
    if (cd.mode === 'cycle') { a.ecoule += Number(s.production_realisee) || 0; a.fonctPerf += tf }
    else if (cd.value > 0) { a.theo += (tf / 60) * cd.value; a.prodPerf += Number(s.production_realisee) || 0; a.prodQual += Number(s.production_realisee) || 0; a.rebutsQual += Number(s.rebuts) || 0 }
  }
  const out = Array(12).fill(0)
  for (let mo = 0; mo < 12; mo++) {
    const a = parM[mo]; if (!a) continue
    const dispo = a.ouverture ? a.fonct / a.ouverture : 0
    const perf = a.theo ? Math.min(1, a.prodPerf / a.theo) : (a.fonctPerf ? Math.min(1, a.ecoule / a.fonctPerf) : 0)
    const qualite = a.prodQual ? Math.max(0, (a.prodQual - a.rebutsQual) / a.prodQual) : 1
    out[mo] = +((dispo * perf * qualite) * 100).toFixed(1)
  }
  return out
})

const parEquip = computed(() => {
  const m = {}
  for (const s of postesFiltres.value) {
    const k = s.equipement_id
    if (!m[k]) m[k] = {
      id: k, code: s.equipements ? s.equipements.code : '?', nom: s.equipements ? s.equipements.nom : '',
      ouverture: 0, fonct: 0, theo: 0, prodPerf: 0, ecoule: 0, fonctPerf: 0, prodQual: 0, rebutsQual: 0, nbPostes: 0,
      arrets: { panne: 0, format: 0, nettoyage: 0, reglage: 0, maintenance: 0, attente: 0, autre: 0 }
    }
    const e = m[k]
    const to = s.temps_ouverture_min || 0
    let arr = 0
    for (const mo of MOTIFS) { const v = s[mo[1]] || 0; e.arrets[mo[0]] += v; arr += v }
    const tf = Math.max(0, to - arr)
    e.ouverture += to; e.fonct += tf; e.nbPostes++
    const cd = cadenceDe(s.equipement_id, s.produit_id)
    if (cd.mode === 'cycle') {
      e.ecoule += Number(s.production_realisee) || 0
      e.fonctPerf += tf
    } else if (cd.value > 0) {
      e.theo += (tf / 60) * cd.value
      e.prodPerf += Number(s.production_realisee) || 0
      e.prodQual += Number(s.production_realisee) || 0
      e.rebutsQual += Number(s.rebuts) || 0
    }
  }
  return Object.values(m).map(e => {
    const dispo = e.ouverture ? e.fonct / e.ouverture : 0
    const perf = e.theo ? Math.min(1, e.prodPerf / e.theo) : (e.fonctPerf ? Math.min(1, e.ecoule / e.fonctPerf) : 0)
    const qualite = e.prodQual ? Math.max(0, (e.prodQual - e.rebutsQual) / e.prodQual) : 1
    return { ...e, dispo, perf, qualite, trs: dispo * perf * qualite, pctNettoyage: e.ouverture ? e.arrets.nettoyage / e.ouverture : 0 }
  }).sort((a, b) => b.trs - a.trs)
})

const pertes = computed(() => {
  const t = { ouverture: 0, fonct: 0, panne: 0, format: 0, nettoyage: 0, reglage: 0, maintenance: 0, attente: 0, autre: 0 }
  for (const e of parEquip.value) {
    t.ouverture += e.ouverture; t.fonct += e.fonct
    for (const mo of MOTIFS) t[mo[0]] += e.arrets[mo[0]]
  }
  return t
})
const totalArrets = computed(() => MOTIFS.reduce((s, mo) => s + pertes.value[mo[0]], 0))

// TRS global (pondéré)
const global = computed(() => {
  let ouv = 0, sTrs = 0, sDispo = 0, sPerf = 0, sQual = 0
  for (const e of parEquip.value) { ouv += e.ouverture; sTrs += e.trs * e.ouverture; sDispo += e.dispo * e.ouverture; sPerf += e.perf * e.ouverture; sQual += e.qualite * e.ouverture }
  return ouv ? { dispo: sDispo / ouv, perf: sPerf / ouv, qualite: sQual / ouv, trs: sTrs / ouv } : { dispo: 0, perf: 0, qualite: 0, trs: 0 }
})

const trsParEquipChart = computed(() => [{ label: 'TRS %', color: '#4338ca', data: parEquip.value.map(e => +(e.trs * 100).toFixed(1)) }])
const labelsEquip = computed(() => parEquip.value.map(e => e.code))
const pertesChart = computed(() => [{ label: 'Minutes', color: '#64748b', data: MOTIFS.map(mo => pertes.value[mo[0]]) }])
const labelsMotifs = computed(() => MOTIFS.map(mo => mo[2]))

const pct = (x) => (x * 100).toFixed(1) + ' %'
const fmt = (n) => n == null ? '0' : Math.round(Number(n)).toLocaleString('fr-FR')
const heures = (min) => (min / 60).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' h'
</script>

<template>
  <div class="strs-page">
    <PageHeader title="Suivi TRS" tone="indigo"
      subtitle="TRS par équipement, décomposé Disponibilité / Performance / Qualité, sur la période.">
      <div class="periode">
        <label>Équipement <select v-model="equipFiltre"><option value="">Tous</option><option v-for="e in equipList" :key="e.id" :value="e.id">{{ e.code }} — {{ e.nom }}</option></select></label>
        <label>Du <input type="date" v-model="du" @change="charger" /></label>
        <label>Au <input type="date" v-model="au" @change="charger" /></label>
      </div>
    </PageHeader>

    <p v-if="msg" class="alert">{{ msg }}</p>
    <p v-if="chargement" class="muted">Chargement…</p>

    <template v-if="!chargement">
      <div v-if="!parEquip.length" class="empty">Aucune saisie TRS sur cette période. Renseigne des postes dans « Saisie TRS ».</div>

      <template v-else>
        <div class="kpi-grid">
          <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.indigo"><svg viewBox="0 0 24 24" v-html="ICONS.gauge || ICONS.activity"></svg></span><div class="kpi-val big">{{ pct(global.trs) }}</div></div><div class="kpi-lbl">TRS global (pondéré)</div></div>
          <div class="kpi"><div class="kpi-top"><div class="kpi-val">{{ pct(global.dispo) }}</div></div><div class="kpi-lbl">Disponibilité</div></div>
          <div class="kpi"><div class="kpi-top"><div class="kpi-val">{{ pct(global.perf) }}</div></div><div class="kpi-lbl">Performance</div></div>
          <div class="kpi"><div class="kpi-top"><div class="kpi-val">{{ pct(global.qualite) }}</div></div><div class="kpi-lbl">Qualité</div></div>
        </div>

        <section class="card">
          <h3 class="card-title">TRS par équipement</h3>
          <MiniChart :labels="labelsEquip" :format="v => v + ' %'" :value-format="v => v || ''" show-values :series="trsParEquipChart" />
        </section>

        <section class="card">
          <h3 class="card-title">TRS par mois<span v-if="equipFiltre"> — {{ equipFiltreCode }}</span></h3>
          <MiniChart :labels="MOIS" :format="v => v + ' %'" :value-format="v => v || ''" show-values :series="[{ label: 'TRS %', color: '#0f766e', data: trsParMois }]" />
        </section>

        <section class="card">
          <h3 class="card-title">Détail par équipement</h3>
          <div class="table-scroll">
            <table class="mini">
              <thead><tr><th>Équipement</th><th class="right">Ouverture</th><th class="right">Fonct.</th><th class="right">Dispo.</th><th class="right">Perf.</th><th class="right">Qualité</th><th class="right">TRS</th><th class="right">Nettoyage</th></tr></thead>
              <tbody>
                <tr v-for="e in parEquip" :key="e.id">
                  <td class="strong">{{ e.code }} <span class="nom">{{ e.nom }}</span></td>
                  <td class="right nowrap">{{ heures(e.ouverture) }}</td>
                  <td class="right nowrap">{{ heures(e.fonct) }}</td>
                  <td class="right">{{ pct(e.dispo) }}</td>
                  <td class="right">{{ pct(e.perf) }}</td>
                  <td class="right">{{ pct(e.qualite) }}</td>
                  <td class="right trs-cell">{{ pct(e.trs) }}</td>
                  <td class="right nettoyage-cell">{{ heures(e.arrets.nettoyage) }} <span class="pcm">({{ pct(e.pctNettoyage) }})</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="card">
          <h3 class="card-title">Détail des pertes de temps (tous équipements)</h3>
          <MiniChart :labels="labelsMotifs" :format="v => fmt(v) + ' min'" :value-format="v => v || ''" show-values :series="pertesChart" />
          <div class="pertes-list">
            <div v-for="mo in MOTIFS" :key="mo[0]" class="perte-row" :class="{ hl: mo[0] === 'nettoyage' }">
              <span class="perte-dot" :style="{ background: mo[3] }"></span>
              <span class="perte-nom">{{ mo[2] }}</span>
              <span class="perte-min">{{ heures(pertes[mo[0]]) }}</span>
              <span class="perte-pct">{{ totalArrets ? ((pertes[mo[0]] / totalArrets) * 100).toFixed(1) : 0 }} % des arrêts</span>
              <span class="perte-pct2">{{ pertes.ouverture ? ((pertes[mo[0]] / pertes.ouverture) * 100).toFixed(1) : 0 }} % du temps d'ouverture</span>
            </div>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>

<style scoped>
.strs-page { color: #1b2733; }
.periode { display: flex; gap: 12px; }
.periode label { display: flex; flex-direction: column; font-size: 12px; font-weight: 600; color: #475569; gap: 4px; }
.periode input, .periode select { font-size: 14px; padding: 7px 9px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; font-weight: 600; }
.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }
.muted { color: #94a3b8; }
.empty { color: #94a3b8; text-align: center; padding: 30px; font-style: italic; }
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 18px; }
.kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.kpi-top { display: flex; align-items: center; gap: 10px; }
.kpi-ic { width: 34px; height: 34px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; flex: none; }
.kpi-ic svg { width: 19px; height: 19px; }
.kpi-val { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
.kpi-val.big { font-size: 26px; color: #4338ca; }
.kpi-lbl { font-size: 12px; color: #64748b; margin-top: 6px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-title { margin: 0 0 12px; font-size: 16px; }
.table-scroll { overflow-x: auto; }
table.mini { width: 100%; border-collapse: collapse; font-size: 14px; }
table.mini th { text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
table.mini td { padding: 8px 10px; border-bottom: 1px solid #eef2f6; }
.right { text-align: right; }
.nowrap { white-space: nowrap; }
.strong { font-weight: 700; }
.nom { font-weight: 400; color: #94a3b8; font-size: 12px; }
.trs-cell { font-weight: 800; color: #4338ca; }
.nettoyage-cell { color: #0f766e; font-weight: 600; }
.pcm { color: #94a3b8; font-weight: 400; font-size: 12px; }
.pertes-list { margin-top: 14px; }
.perte-row { display: grid; grid-template-columns: 16px 130px 90px 1fr 1fr; align-items: center; gap: 10px; padding: 7px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
.perte-row.hl { background: #f0fdfa; border-radius: 6px; }
.perte-dot { width: 13px; height: 13px; border-radius: 4px; }
.perte-nom { font-weight: 600; }
.perte-min { font-weight: 700; text-align: right; }
.perte-pct, .perte-pct2 { color: #64748b; font-size: 12.5px; }
@media (max-width: 800px) { .kpi-grid { grid-template-columns: 1fr 1fr; } .perte-row { grid-template-columns: 16px 1fr auto; } .perte-pct, .perte-pct2 { display: none; } }
</style>
