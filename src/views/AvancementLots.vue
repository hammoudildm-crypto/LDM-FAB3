<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'
import { ICONS, TINTS } from '../icons.js'

// Gamme de fabrication (mêmes libellés que dans le suivi des phases)
const PHASES = ['Pesée', 'Granulation', 'Séchage', 'Mélange', 'Compression', 'Remplissage Gélules', 'Pelliculage', 'Conditionnement']
const COURT = ['Pesée', 'Gran.', 'Séch.', 'Mél.', 'Comp.', 'Rempl.', 'Pell.', 'Cond.']

const lots = ref([])
const phases = ref([])
const erreur = ref('')
const chargement = ref(true)
const recherche = ref('')
const filtre = ref('production') // production | tous | termines

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
  chargement.value = true
  erreur.value = ''

  const rl = await fetchAllPaged(() => supabase.from('ordres_fabrication')
    .select('id, numero_lot, statut, date_lancement, date_fin_fabrication, produits(code_pf, designation)')
    .eq('actif', true))
  if (rl.error) { erreur.value = rl.error.message; chargement.value = false; return }
  lots.value = rl.data || []

  const rp = await fetchAllPaged(() => supabase.from('suivi_phases')
    .select('ordre_id, phase, statut, date_debut, date_phase')
    .eq('actif', true))
  if (rp.error) { erreur.value = rp.error.message; chargement.value = false; return }
  phases.value = rp.data || []

  chargement.value = false
}

// ordre_id -> { phase -> record agrégé (priorité Terminé > En cours > autre) }
const phasesByLot = computed(() => {
  const rank = (st) => st === 'Terminé' ? 3 : st === 'En cours' ? 2 : 1
  const m = {}
  for (const r of phases.value) {
    if (!m[r.ordre_id]) m[r.ordre_id] = {}
    const cur = m[r.ordre_id][r.phase]
    if (!cur || rank(r.statut) > rank(cur.statut)) m[r.ordre_id][r.phase] = r
  }
  return m
})

// Analyse d'un lot : états des 8 étapes + étape courante + progression
function analyse(lot) {
  const recs = phasesByLot.value[lot.id] || {}
  const nodes = PHASES.map((ph, i) => {
    const r = recs[ph]
    let state = 'pending'
    if (r) state = r.statut === 'Terminé' ? 'done' : 'current'
    return { phase: ph, court: COURT[i], state, rec: r || null }
  })
  const nbRec = nodes.filter(n => n.rec).length
  const done = nodes.filter(n => n.state === 'done').length
  const termine = done === PHASES.length

  let currentIdx = nodes.findIndex(n => n.state === 'current')
  if (currentIdx === -1 && !termine) {
    let lastDone = -1
    nodes.forEach((n, i) => { if (n.state === 'done') lastDone = i })
    currentIdx = lastDone + 1
    if (currentIdx < PHASES.length) nodes[currentIdx].state = 'next'
  }

  let label
  if (termine) label = 'Terminé'
  else if (nbRec === 0) label = 'Non démarré'
  else if (currentIdx >= 0 && currentIdx < PHASES.length)
    label = (nodes[currentIdx].state === 'current' ? 'En cours : ' : 'Prochaine : ') + PHASES[currentIdx]
  else label = 'Terminé'

  return { nodes, currentIdx, done, nbRec, termine, label, progress: Math.round(done / PHASES.length * 100) }
}

const lotsAnalyses = computed(() =>
  lots.value.map(l => ({ lot: l, a: analyse(l) }))
)

const filtres = computed(() => {
  const q = recherche.value.trim().toLowerCase()
  return lotsAnalyses.value.filter(({ lot, a }) => {
    if (filtre.value === 'production' && (a.termine || a.nbRec === 0)) return false
    if (filtre.value === 'termines' && !a.termine) return false
    if (filtre.value === 'tous' && a.nbRec === 0) return false
    if (!q) return true
    const p = lot.produits
    return (lot.numero_lot || '').toLowerCase().includes(q)
      || (p && (p.code_pf || '').toLowerCase().includes(q))
      || (p && (p.designation || '').toLowerCase().includes(q))
  }).sort((x, y) => y.a.done - x.a.done)
})

// KPIs
const nbProduction = computed(() => lotsAnalyses.value.filter(x => !x.a.termine && x.a.nbRec > 0).length)
const nbTermines = computed(() => lotsAnalyses.value.filter(x => x.a.termine).length)
const nbSuivis = computed(() => lotsAnalyses.value.filter(x => x.a.nbRec > 0).length)

// Répartition des lots en production par étape courante
const parEtape = computed(() => {
  const c = PHASES.map(ph => ({ phase: ph, n: 0 }))
  for (const x of lotsAnalyses.value) {
    if (x.a.termine || x.a.nbRec === 0) continue
    const i = x.a.currentIdx
    if (i >= 0 && i < PHASES.length) c[i].n++
  }
  const max = Math.max(1, ...c.map(x => x.n))
  return c.map(x => ({ ...x, pct: Math.round(x.n / max * 100) }))
})

function fmt(n) { return n == null ? '—' : Number(n).toLocaleString('fr-FR') }
function classeStatut(s) {
  return { 'Planifié': 'st-plan', 'En cours': 'st-cours', 'Terminé': 'st-fini', 'Libéré': 'st-lib', 'Rejeté': 'st-rej' }[s] || 'st-plan'
}

const kpis = computed(() => [
  { v: fmt(nbProduction.value), l: 'Lots en production', tint: TINTS.blue,    ic: ICONS.activity },
  { v: fmt(nbTermines.value),   l: 'Lots terminés',      tint: TINTS.green,   ic: ICONS.check },
  { v: fmt(nbSuivis.value),     l: 'Lots suivis',        tint: TINTS.indigo,  ic: ICONS.clipboard },
])

onMounted(async () => {
  const r = await supabase.auth.getSession()
  if (r.data && r.data.session) await charger()
  else chargement.value = false
})
</script>

<template>
  <div class="av-page">
    <header class="av-head">
      <div>
        <h1>Suivi du process — avancement des lots</h1>
        <p class="sub">Où en est chaque lot dans la gamme, d'après les phases saisies (Pesée → … → Conditionnement).</p>
      </div>
    </header>

    <p v-if="erreur" class="err">{{ erreur }}</p>
    <p v-if="chargement" class="muted">Chargement…</p>

    <template v-if="!chargement">
      <div class="kpi-grid k3">
        <div class="kpi" v-for="(k, i) in kpis" :key="i">
          <div class="kpi-top">
            <span class="kpi-ic" :style="k.tint"><svg viewBox="0 0 24 24" v-html="k.ic"></svg></span>
            <div class="kpi-val">{{ k.v }}</div>
          </div>
          <div class="kpi-lbl">{{ k.l }}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Répartition des lots en production par étape</div>
        <div class="rep">
          <div v-for="e in parEtape" :key="e.phase" class="rep-row">
            <span class="rep-lbl">{{ e.phase }}</span>
            <span class="rep-bar"><span class="rep-fill" :style="{ width: e.pct + '%' }"></span></span>
            <span class="rep-n">{{ e.n }}</span>
          </div>
        </div>
      </div>

      <div class="filters">
        <input v-model="recherche" type="text" placeholder="Rechercher un lot ou un produit…" />
        <div class="segs">
          <button :class="{ on: filtre === 'production' }" @click="filtre = 'production'">En production</button>
          <button :class="{ on: filtre === 'tous' }" @click="filtre = 'tous'">Tous les suivis</button>
          <button :class="{ on: filtre === 'termines' }" @click="filtre = 'termines'">Terminés</button>
        </div>
      </div>

      <p v-if="filtres.length === 0" class="muted">Aucun lot ne correspond. Les lots apparaissent ici dès qu'au moins une phase est saisie dans <strong>Suivi des phases</strong>.</p>

      <div v-for="{ lot, a } in filtres" :key="lot.id" class="card lot-card">
        <div class="lot-head">
          <div class="lot-ident">
            <span class="lot-num">{{ lot.numero_lot || '—' }}</span>
            <span class="lot-prod" v-if="lot.produits">{{ lot.produits.code_pf }} · {{ lot.produits.designation }}</span>
          </div>
          <div class="lot-right">
            <span class="etape" :class="{ fini: a.termine, vide: a.nbRec === 0 }">{{ a.label }}</span>
            <span class="badge sm" :class="classeStatut(lot.statut)">{{ lot.statut }}</span>
          </div>
        </div>

        <div class="stepper">
          <div v-for="(n, i) in a.nodes" :key="i" class="step" :class="n.state">
            <span v-if="i > 0" class="line" :class="{ filled: a.nodes[i - 1].state === 'done' }"></span>
            <span class="dot">
              <svg v-if="n.state === 'done'" viewBox="0 0 24 24" class="dot-ic"><path d="m5 12 5 5 9-11" /></svg>
              <span v-else class="dot-c"></span>
            </span>
            <span class="step-lbl">{{ n.court }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.av-page { color: #1b2733; }
.av-head { margin: 4px 0 18px; }
.av-head h1 { margin: 0; font-size: 24px; letter-spacing: -0.01em; }
.sub { margin: 4px 0 0; color: #64748b; font-size: 14px; }
.err { color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; }
.muted { color: #94a3b8; }

.kpi-grid { display: grid; gap: 14px; margin-bottom: 14px; }
.k3 { grid-template-columns: repeat(3, 1fr); }
.kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.kpi-val { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
.kpi-lbl { font-size: 12px; color: #64748b; margin-top: 4px; }

.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); margin-bottom: 16px; }
.card-title { font-size: 15px; font-weight: 600; margin-bottom: 12px; }

.rep { display: flex; flex-direction: column; gap: 6px; }
.rep-row { display: grid; grid-template-columns: 130px 1fr 34px; align-items: center; gap: 10px; }
.rep-lbl { font-size: 12px; color: #475569; }
.rep-bar { height: 10px; background: #f1f5f9; border-radius: 999px; overflow: hidden; }
.rep-fill { display: block; height: 100%; background: #0f766e; border-radius: 999px; }
.rep-n { font-size: 13px; font-weight: 600; text-align: right; color: #0f172a; }

.filters { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 14px; }
.filters input { flex: 1; min-width: 220px; max-width: 400px; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; }
.segs { display: inline-flex; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; }
.segs button { border: 0; background: #fff; padding: 8px 14px; font-size: 13px; color: #475569; cursor: pointer; border-left: 1px solid #e2e8f0; }
.segs button:first-child { border-left: 0; }
.segs button.on { background: #0f766e; color: #fff; }

.lot-card { padding: 14px 16px; }
.lot-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.lot-ident { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.lot-num { font-weight: 700; font-size: 15px; }
.lot-prod { font-size: 12px; color: #64748b; }
.lot-right { display: flex; align-items: center; gap: 10px; }
.etape { font-size: 12px; font-weight: 600; color: #1d4ed8; background: #eff6ff; border: 1px solid #dbeafe; padding: 4px 10px; border-radius: 999px; white-space: nowrap; }
.etape.fini { color: #15803d; background: #f0fdf4; border-color: #dcfce7; }
.etape.vide { color: #94a3b8; background: #f8fafc; border-color: #eef2f6; }

.stepper { display: flex; }
.step { flex: 1; display: flex; flex-direction: column; align-items: center; position: relative; min-width: 0; }
.line { position: absolute; top: 12px; right: 50%; width: 100%; height: 2px; background: #e2e8f0; z-index: 0; }
.line.filled { background: #16a34a; }
.dot { position: relative; z-index: 1; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: #fff; border: 2px solid #cbd5e1; }
.dot-ic { width: 14px; height: 14px; fill: none; stroke: #fff; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
.dot-c { width: 8px; height: 8px; border-radius: 50%; background: #cbd5e1; }
.step-lbl { font-size: 10px; color: #94a3b8; margin-top: 5px; text-align: center; white-space: nowrap; }

.step.done .dot { background: #16a34a; border-color: #16a34a; }
.step.done .step-lbl { color: #16a34a; }
.step.current .dot { background: #f59e0b; border-color: #f59e0b; }
.step.current .dot-c { background: #fff; }
.step.current .step-lbl { color: #b45309; font-weight: 700; }
.step.next .dot { border-color: #3b82f6; border-style: dashed; }
.step.next .dot-c { background: #3b82f6; }
.step.next .step-lbl { color: #2563eb; font-weight: 600; }

.badge.sm { font-size: 11px; padding: 2px 8px; border-radius: 999px; font-weight: 600; }
.st-plan { background: #f1f5f9; color: #475569; }
.st-cours { background: #eff6ff; color: #1d4ed8; }
.st-fini { background: #ecfeff; color: #0e7490; }
.st-lib { background: #f0fdf4; color: #15803d; }
.st-rej { background: #fef2f2; color: #b91c1c; }
</style>
