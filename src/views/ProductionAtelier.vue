<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'
import MiniChart from '../components/MiniChart.vue'
import { ICONS, TINTS } from '../icons.js'

const anneeCourante = new Date().getFullYear()
const ANNEES = []
for (let a = anneeCourante - 4; a <= anneeCourante + 1; a++) ANNEES.push(a)
const anneeSel = ref(anneeCourante)

// Ateliers de fabrication (phases) + Conditionnement en dernière ligne
const PHASES = ['Pesée', 'Granulation', 'Séchage', 'Mélange', 'Compression', 'Remplissage Gélules', 'Pelliculage', 'Conditionnement']
const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
const MOIS_LONG = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

const phases = ref([])
const conds = ref([])
const hist = ref([])
const erreur = ref('')
const chargement = ref(true)

async function fetchAllPaged(make) {
  const size = 1000
  let from = 0, all = []
  for (;;) {
    const r = await make().range(from, from + size - 1)
    if (r.error) return { error: r.error, data: all }
    all = all.concat(r.data || [])
    if (!r.data || r.data.length < size) break
    from += size
  }
  return { data: all, error: null }
}

async function charger() {
  erreur.value = ''
  chargement.value = true
  const rp = await fetchAllPaged(() => supabase.from('suivi_phases')
    .select('ordre_id, phase, statut, date_phase').eq('actif', true))
  if (rp.error) { erreur.value = rp.error.message; chargement.value = false; return }
  phases.value = rp.data || []
  const rc = await fetchAllPaged(() => supabase.from('conditionnement')
    .select('ordre_id, date_conditionnement, date_fin').eq('actif', true))
  if (!rc.error) conds.value = rc.data || []
  const rh = await fetchAllPaged(() => supabase.from('production_historique').select('annee, mois, etape, nb_lots'))
  if (!rh.error) hist.value = rh.data || []
  chargement.value = false
}

// Matrice : { phase -> [12 compteurs] } = nb de LOTS DISTINCTS ayant terminé la phase ce mois-là
// Données LIVE (suivi fabrication) agrégées : étape -> année -> [12 mois]
const liveParAn = computed(() => {
  const m = {}, vus = {}
  const ajouter = (ph, ordreId, d) => {
    if (!d || ordreId == null || !PHASES.includes(ph)) return
    const dt = new Date(d), y = dt.getFullYear(), mo = dt.getMonth()
    if (!m[ph]) m[ph] = {}
    if (!m[ph][y]) m[ph][y] = Array(12).fill(0)
    const cle = ph + '|' + y + '|' + mo
    if (!vus[cle]) vus[cle] = new Set()
    if (!vus[cle].has(ordreId)) { vus[cle].add(ordreId); m[ph][y][mo]++ }
  }
  for (const sp of phases.value) { if (sp.date_phase) ajouter(sp.phase, sp.ordre_id, sp.date_phase) }
  for (const c of conds.value) ajouter('Conditionnement', c.ordre_id, c.date_fin || c.date_conditionnement)
  return m
})
// Données HISTORIQUE importées (table production_historique)
const histParAn = computed(() => {
  const m = {}
  for (const r of hist.value) {
    if (!m[r.etape]) m[r.etape] = {}
    if (!m[r.etape][r.annee]) m[r.etape][r.annee] = Array(12).fill(0)
    if (r.mois >= 1 && r.mois <= 12) m[r.etape][r.annee][r.mois - 1] = r.nb_lots
  }
  return m
})
// Valeurs mensuelles d'une étape pour une année : historique si année passée, sinon temps réel
function valeurs(stage, year) {
  const h = (histParAn.value[stage] && histParAn.value[stage][year]) ? histParAn.value[stage][year] : null
  const l = (liveParAn.value[stage] && liveParAn.value[stage][year]) ? liveParAn.value[stage][year] : null
  if (year < anneeCourante) return h || Array(12).fill(0)                 // années passées : historique importé
  if (!h) return l || Array(12).fill(0)                                   // année en cours sans historique : temps réel
  if (!l) return h
  return h.map((v, i) => Math.max(v, l[i]))                               // année en cours : max(historique à ce jour, temps réel)
}
const matrice = computed(() => {
  const m = {}
  for (const ph of PHASES) m[ph] = valeurs(ph, anneeSel.value)
  return m
})

function totalLigne(ph) { return matrice.value[ph].reduce((s, x) => s + x, 0) }
const totalColonne = computed(() => {
  const t = Array(12).fill(0)
  for (const ph of PHASES) for (let i = 0; i < 12; i++) t[i] += matrice.value[ph][i]
  return t
})
const grandTotal = computed(() => totalColonne.value.reduce((s, x) => s + x, 0))
const maxCellule = computed(() => {
  let mx = 0
  for (const ph of PHASES) for (const n of matrice.value[ph]) if (n > mx) mx = n
  return mx
})
function intensite(n) {
  if (!n || !maxCellule.value) return 0
  return n / maxCellule.value
}

// KPIs
const atelierTop = computed(() => {
  let best = null, mx = -1
  for (const ph of PHASES) { const t = totalLigne(ph); if (t > mx) { mx = t; best = ph } }
  return mx > 0 ? { nom: best, n: mx } : null
})
const moisTop = computed(() => {
  let best = -1, mx = -1
  totalColonne.value.forEach((n, i) => { if (n > mx) { mx = n; best = i } })
  return mx > 0 ? { nom: MOIS_LONG[best], n: mx } : null
})

// --- Comparaison multi-années : une courbe par année, par atelier ---
const ANNEES_COMP = []
for (let a = anneeCourante - 3; a <= anneeCourante; a++) ANNEES_COMP.push(a)
const COULEURS_ANNEES = ['#cbd5e1', '#60a5fa', '#2dd4bf', '#0f766e']
const matriceMultiAn = computed(() => {
  const m = {}
  for (const ph of PHASES) { m[ph] = {}; for (const y of ANNEES_COMP) m[ph][y] = valeurs(ph, y) }
  return m
})
function seriesAtelier(ph) {
  return ANNEES_COMP.map((y, i) => ({ label: String(y), color: COULEURS_ANNEES[i] || '#0f766e', data: matriceMultiAn.value[ph][y] }))
}
function totalAtelierAnnee(ph, y) { return matriceMultiAn.value[ph][y].reduce((s, x) => s + x, 0) }
const atelierSel = ref('Compression')
const anneesActives = ref(new Set(ANNEES_COMP))
function toggleAnnee(y) {
  const s = new Set(anneesActives.value)
  if (s.has(y)) s.delete(y); else s.add(y)
  anneesActives.value = s
}
const seriesChart = computed(() =>
  ANNEES_COMP.filter(y => anneesActives.value.has(y)).map(y => ({
    label: String(y), color: COULEURS_ANNEES[ANNEES_COMP.indexOf(y)] || '#0f766e',
    data: matriceMultiAn.value[atelierSel.value][y]
  }))
)

function fmt(n) { return n == null ? '—' : Number(n).toLocaleString('fr-FR') }

function telechargerCSV(nom, entetes, lignes) {
  const esc = (c) => { const s = c == null ? '' : String(c); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
  const csv = [entetes, ...lignes].map(r => r.map(esc).join(';')).join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = nom; a.click()
}
function exporterCSV() {
  const entetes = ['Atelier', ...MOIS, 'Total']
  const lignes = PHASES.map(ph => [ph, ...matrice.value[ph], totalLigne(ph)])
  lignes.push(['Total', ...totalColonne.value, grandTotal.value])
  telechargerCSV('production_par_atelier_' + anneeSel.value + '.csv', entetes, lignes)
}

onMounted(charger)
</script>

<template>
  <div class="pa-page">
    <PageHeader title="Production par atelier" tone="teal"
      subtitle="Nombre de lots ayant terminé chaque étape, par atelier et par mois.">
      <label class="annee">Année
        <select v-model.number="anneeSel">
          <option v-for="a in ANNEES" :key="a" :value="a">{{ a }}</option>
        </select>
      </label>
    </PageHeader>

    <p v-if="erreur" class="alert">{{ erreur }}</p>
    <p v-if="chargement" class="muted">Chargement…</p>

    <template v-if="!chargement">
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.teal"><svg viewBox="0 0 24 24" v-html="ICONS.activity"></svg></span><div class="kpi-val accent">{{ fmt(grandTotal) }}</div></div><div class="kpi-lbl">Étapes terminées en {{ anneeSel }}</div></div>
        <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.blue"><svg viewBox="0 0 24 24" v-html="ICONS.flask"></svg></span><div class="kpi-val">{{ atelierTop ? atelierTop.nom : '—' }}</div></div><div class="kpi-lbl">Atelier le plus actif<span v-if="atelierTop"> ({{ atelierTop.n }})</span></div></div>
        <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.amber"><svg viewBox="0 0 24 24" v-html="ICONS.calendar"></svg></span><div class="kpi-val">{{ moisTop ? moisTop.nom : '—' }}</div></div><div class="kpi-lbl">Mois le plus actif<span v-if="moisTop"> ({{ moisTop.n }})</span></div></div>
      </div>

      <section class="card">
        <div class="card-head">
          <h2 class="card-title">Lots fabriqués par atelier — {{ anneeSel }}</h2>
          <button class="btn-exp" @click="exporterCSV" :disabled="!grandTotal">Exporter CSV</button>
        </div>
        <div class="table-scroll">
          <table class="grid">
            <thead>
              <tr>
                <th class="at-col">Atelier</th>
                <th v-for="m in MOIS" :key="m" class="mois-col">{{ m }}</th>
                <th class="tot-col">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="ph in PHASES" :key="ph" :class="{ cond: ph === 'Conditionnement' }">
                <td class="at-name">{{ ph }}</td>
                <td v-for="(n, i) in matrice[ph]" :key="i" class="num"
                    :style="n ? { background: 'rgba(15,118,110,' + (0.08 + intensite(n) * 0.55) + ')', color: intensite(n) > 0.6 ? '#fff' : '#0f5c54' } : null">
                  {{ n || '·' }}
                </td>
                <td class="num strong">{{ totalLigne(ph) }}</td>
              </tr>
              <tr v-if="!grandTotal"><td :colspan="14" class="empty">Aucune étape terminée en {{ anneeSel }}. Les lots apparaissent ici dès qu'une phase est saisie « Terminé » (avec sa date) dans Suivi des phases.</td></tr>
            </tbody>
            <tfoot v-if="grandTotal">
              <tr>
                <td class="strong">Total</td>
                <td v-for="(n, i) in totalColonne" :key="i" class="num strong">{{ n || '·' }}</td>
                <td class="num strong accent">{{ grandTotal }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2 class="card-title">Comparaison mensuelle par atelier</h2></div>
        <div class="filtres">
          <div class="filtre-groupe">
            <span class="filtre-lbl">Atelier</span>
            <div class="btn-row">
              <button v-for="ph in PHASES" :key="ph" type="button" :class="{ on: atelierSel === ph }" @click="atelierSel = ph">{{ ph }}</button>
            </div>
          </div>
          <div class="filtre-groupe">
            <span class="filtre-lbl">Années</span>
            <div class="btn-row">
              <button v-for="(y, i) in ANNEES_COMP" :key="y" type="button" class="an-btn" :class="{ on: anneesActives.has(y) }" @click="toggleAnnee(y)"><span class="an-dot" :style="{ background: COULEURS_ANNEES[i] }"></span>{{ y }}</button>
            </div>
          </div>
        </div>
        <div class="chart-titre">{{ atelierSel }} — lots terminés par mois</div>
        <div class="chart-wrap">
          <MiniChart v-if="seriesChart.length" :series="seriesChart" :labels="MOIS" :show-switch="true" :show-values="anneesActives.size <= 1" />
          <p v-else class="empty">Sélectionne au moins une année pour afficher le graphe.</p>
        </div>
      </section>

      <p class="hint">Chaque cellule = nombre de <strong>lots distincts</strong> ayant <strong>terminé</strong> l'étape ce mois-là. Les <strong>années passées</strong> proviennent de l'<strong>historique importé</strong> (TDB PROD) ; l'<strong>année en cours</strong> est calculée en <strong>temps réel</strong> depuis Suivi des phases. Un même lot compte une fois par atelier.</p>
    </template>
  </div>
</template>

<style scoped>
.pa-page { color: #1b2733; }
.annee { display: flex; flex-direction: column; font-size: 12px; font-weight: 600; color: #475569; gap: 5px; }
.annee select { font-size: 14px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; font-weight: 600; color: #1b2733; }
.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }
.muted { color: #94a3b8; }

.kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 22px; }
.kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.kpi-top { display: flex; align-items: center; gap: 10px; }
.kpi-ic { width: 34px; height: 34px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; flex: none; }
.kpi-ic svg { width: 19px; height: 19px; }
.kpi-val { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
.kpi-val.accent { color: #0f766e; }
.kpi-lbl { font-size: 12px; color: #64748b; margin-top: 6px; }

.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.card-title { margin: 0; font-size: 17px; }
.btn-exp { margin-left: auto; font-size: 13px; padding: 7px 12px; border: 1px solid #0f766e; border-radius: 8px; background: #fff; color: #0f766e; font-weight: 600; cursor: pointer; white-space: nowrap; }
.btn-exp:hover { background: #ecfdf5; }
.btn-exp:disabled { opacity: .45; cursor: not-allowed; }

.table-scroll { overflow-x: auto; }
table.grid { width: 100%; border-collapse: collapse; font-size: 14px; }
table.grid th { text-align: center; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding: 8px 6px; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
table.grid th.at-col { text-align: left; }
table.grid td { padding: 8px 6px; border-bottom: 1px solid #eef2f6; white-space: nowrap; }
.at-col { min-width: 150px; }
.mois-col { width: 52px; }
.tot-col { width: 60px; }
.at-name { font-weight: 600; color: #1b2733; }
.num { text-align: center; font-variant-numeric: tabular-nums; border-radius: 6px; }
.num.strong { font-weight: 700; }
.accent { color: #0f766e; }
tr.cond .at-name { color: #0f766e; }
tr.cond td { border-top: 1px solid #cbd5e1; }
table.grid tfoot td { border-top: 2px solid #e2e8f0; border-bottom: 0; background: #f8fafc; }
.empty { color: #94a3b8; text-align: center; padding: 18px; font-style: italic; white-space: normal; }
.hint { color: #64748b; font-size: 13px; margin-top: 4px; }
.filtres { display: flex; flex-direction: column; gap: 12px; margin-bottom: 10px; }
.filtre-groupe { display: flex; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
.filtre-lbl { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding-top: 8px; min-width: 58px; }
.btn-row { display: flex; flex-wrap: wrap; gap: 7px; }
.btn-row button { font-size: 13px; font-weight: 600; padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #475569; cursor: pointer; transition: all .15s ease; display: inline-flex; align-items: center; gap: 6px; }
.btn-row button:hover { border-color: #0f766e; color: #0f766e; }
.btn-row button.on { background: #0f766e; border-color: #0f766e; color: #fff; }
.an-dot { width: 12px; height: 3px; border-radius: 2px; display: inline-block; }
.btn-row button.an-btn.on .an-dot { background: #fff; }
.chart-titre { font-size: 14px; font-weight: 700; color: #0f766e; margin: 4px 0 2px; }
.chart-wrap { margin-top: 4px; }

@media (max-width: 700px) {
  .kpi-grid { grid-template-columns: 1fr; }
}
</style>
