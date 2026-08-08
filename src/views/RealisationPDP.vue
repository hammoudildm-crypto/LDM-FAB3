<template>
  <div class="rp">
    <header class="rp-head">
      <div>
        <h1 class="rp-title">Réalisation du PDP par phase</h1>
        <p class="rp-sub">Avancement du plan directeur, par phase de fabrication</p>
      </div>
      <div class="rp-year">
        <label>Année</label>
        <select v-model.number="annee"><option v-for="a in annees" :key="a" :value="a">{{ a }}</option></select>
      </div>
    </header>

    <div class="pdp-hero">
      <div class="hero-l">
        <div class="hero-pct"><span class="hp-val">{{ tauxGlobal }}%</span><div class="hp-txt"><span>réalisé — {{ mesure === 'boites' ? 'boîtes' : 'lots' }}</span><b :class="ecart >= 0 ? 'up' : 'down'">{{ Math.abs(ecart) }} pts {{ ecart >= 0 ? 'au-dessus' : 'sous' }} l'objectif</b></div></div>
        <div class="hero-bar-wrap">
          <div class="hero-bar"><span class="hb-fill" :style="{ width: Math.min(tauxGlobal, 100) + '%' }"></span><span class="hb-obj" :style="{ left: Math.min(objectifPct, 100) + '%' }"></span></div>
          <span class="hb-obj-lbl" :style="{ left: Math.min(objectifPct, 100) + '%' }">objectif {{ objectifPct }}%</span>
        </div>
        <div class="hero-stat" :class="statut.cls"><i></i>{{ statut.txt }}</div>
      </div>
      <div class="hero-r">
        <div class="syn-card"><div class="syn-nums"><b>{{ fmt(realTot) }}</b><span>/ {{ fmt(planTot) }}</span></div><div class="syn-lbl">Année {{ annee }}</div><div class="syn-pct" :class="ecart >= 0 ? 'up' : 'down'">{{ tauxGlobal }}%</div></div>
        <div class="syn-card"><div class="syn-nums"><b>{{ fmt(realMois) }}</b><span>/ {{ fmt(planMois) }}</span></div><div class="syn-lbl">{{ MOIS[bilan.moisAuj] }} {{ annee }}</div><div class="syn-pct">{{ tauxMois }}%</div></div>
      </div>
    </div>

    <section class="rp-card pdp-chart">
      <div class="pc-head"><h3 class="card-title">{{ mesure === 'boites' ? 'Boîtes' : 'Lots' }} par mois — réalisé vs prévu — {{ annee }}</h3><div class="pc-leg"><span class="lg r">Réalisé</span><span class="lg p">Prévu</span></div></div>
      <div class="pc-bars">
        <div v-for="(m, i) in MOIS" :key="i" class="pc-col">
          <div class="pc-pair">
            <span class="pc-bar r" :style="{ height: (serieMois.real[i] / serieMois.max * 100) + '%' }" :title="m + ' — Réalisé ' + fmt(serieMois.real[i])"></span>
            <span class="pc-bar p" :style="{ height: (serieMois.plan[i] / serieMois.max * 100) + '%' }" :title="m + ' — Prévu ' + fmt(serieMois.plan[i])"></span>
          </div>
          <span class="pc-lbl">{{ m }}</span>
        </div>
      </div>
    </section>

    <div class="rp-toggles">
      <div class="tg">
        <button :class="{ on: mesure === 'boites' }" @click="mesure = 'boites'">Boîtes</button>
        <button :class="{ on: mesure === 'lots' }" @click="mesure = 'lots'">Lots</button>
      </div>
      <div class="tg">
        <button :class="{ on: vue === 'annuel' }" @click="vue = 'annuel'">Annuel</button>
        <button :class="{ on: vue === 'mensuel' }" @click="vue = 'mensuel'">Mensuel</button>
      </div>
    </div>

    <div v-if="chargement" class="rp-empty">Chargement…</div>

    <!-- ANNUEL -->
    <div v-else-if="vue === 'annuel'" class="rp-card">
      <table class="rp-table">
        <thead><tr><th>Phase</th><th class="num">Plan</th><th class="num">Réalisé</th><th class="num">Taux</th></tr></thead>
        <tbody>
          <tr v-for="ph in phasesActives" :key="ph.key">
            <td class="ph-nom"><span class="ph-dot" :style="{ background: ph.color }"></span>{{ ph.label }}</td>
            <td class="num">{{ fmt(valPlan(ph.key)) }}</td>
            <td class="num">{{ fmt(valReal(ph.key)) }}</td>
            <td class="num"><span v-if="taux(ph.key) != null" class="tx" :class="taux(ph.key) >= 100 ? 'ok' : 'bas'">{{ taux(ph.key) }}%</span><span v-else class="muted">—</span></td>
          </tr>
          <tr v-if="!phasesActives.length"><td colspan="4" class="rp-empty">Aucune donnée pour {{ annee }}.</td></tr>
        </tbody>
      </table>
    </div>

    <!-- MENSUEL -->
    <div v-else class="rp-card rp-scroll">
      <div class="mat-tg"><button :class="{ on: matMode === 'real' }" @click="matMode = 'real'">Réalisé</button><button :class="{ on: matMode === 'plan' }" @click="matMode = 'plan'">Plan</button><button :class="{ on: matMode === 'taux' }" @click="matMode = 'taux'">Taux</button><button :class="{ on: matMode === 'comparer' }" @click="matMode = 'comparer'">Comparer</button></div>
      <table class="rp-table rp-matrix">
        <thead>
          <tr><th>Phase</th><th v-for="(m, i) in MOIS" :key="i" class="num mois">{{ m }}</th><th class="num tot-col">Total</th></tr>
        </thead>
        <tbody>
          <tr v-for="ph in phasesActives" :key="ph.key">
            <td class="ph-nom"><span class="ph-dot" :style="{ background: ph.color }"></span>{{ ph.label }}</td>
            <td v-for="(m, i) in MOIS" :key="i" class="num cell" :class="matMode === 'comparer' ? cmpCls(moisReal(ph.key, i), moisPlan(ph.key, i)) : { z: !moisVal(ph.key, i) }"><template v-if="matMode === 'comparer'"><span v-if="moisReal(ph.key, i) || moisPlan(ph.key, i)">{{ fmt(moisReal(ph.key, i)) }}<i>/{{ fmt(moisPlan(ph.key, i)) }}</i></span><span v-else>·</span></template><template v-else>{{ cellTxt(moisVal(ph.key, i)) }}</template></td>
            <td class="num tot-col"><template v-if="matMode === 'comparer'">{{ fmt(valReal(ph.key)) }}<i>/{{ fmt(valPlan(ph.key)) }}</i></template><template v-else>{{ cellTxt(totPhase(ph.key)) }}</template></td>
          </tr>
          <tr v-if="!phasesActives.length"><td :colspan="14" class="rp-empty">Aucune donnée pour {{ annee }}.</td></tr>
        </tbody>
        <tfoot v-if="phasesActives.length">
          <tr class="tot"><td>{{ matMode === 'plan' ? 'Total plan' : matMode === 'taux' ? 'Taux global' : matMode === 'comparer' ? 'Réalisé / Plan' : 'Total réalisé' }}</td><td v-for="(m, i) in MOIS" :key="i" class="num"><template v-if="matMode === 'comparer'">{{ fmt(totMois(i)) }}<i>/{{ fmt(totMoisPlan(i)) }}</i></template><template v-else>{{ cellTxt(totMoisVal(i)) }}</template></td><td class="num tot-col"><template v-if="matMode === 'comparer'">{{ fmt(totGlobal) }}<i>/{{ fmt(totPlanGlobal) }}</i></template><template v-else>{{ cellTxt(totGlobalVal) }}</template></td></tr>
        </tfoot>
      </table>
      <p class="rp-hint">Vue mensuelle : <b>Réalisé</b>, <b>Plan</b> ou <b>Taux</b> par phase et par mois (bascule ci-dessus). Le mois du réalisé = celui où le lot a atteint la phase.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'

const num = (v) => Number(v) || 0
const fmt = (v) => Math.round(num(v)).toLocaleString('fr-FR')
const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

const PHASES = [
  { key: 'pesee', label: 'Pesée', color: '#64748b' },
  { key: 'granulation', label: 'Granulation / Séchage', color: '#14b8a6' },
  { key: 'melange', label: 'Mélange', color: '#0ea5e9' },
  { key: 'compression', label: 'Compression', color: '#8b5cf6' },
  { key: 'remplissage', label: 'Remplissage gélules', color: '#6366f1' },
  { key: 'pelliculage', label: 'Pelliculage', color: '#f59e0b' },
  { key: 'conditionnement', label: 'Conditionnement', color: '#22c55e' }
]
const CANON_FAB = ['Pesée', 'Granulation', 'Mélange', 'Compression', 'Pelliculage']
function phaseKey(nom) {
  const t = String(nom || '').trim().toLowerCase()
  if (!t) return null
  if (/gran|s[ée]ch/.test(t)) return 'granulation'
  if (/pes/.test(t)) return 'pesee'
  if (/m[ée]lang/.test(t)) return 'melange'
  if (/compress/.test(t)) return 'compression'
  if (/rempliss|g[ée]lul/.test(t)) return 'remplissage'
  if (/pellicul|enrob/.test(t)) return 'pelliculage'
  if (/condition/.test(t)) return 'conditionnement'
  return null
}

const annee = ref(new Date().getFullYear())
const mesure = ref('boites')
const vue = ref('annuel')
const chargement = ref(true)
const planRaw = ref([]); const ofsRaw = ref([]); const suivi = ref([])

async function fetchAllPaged(make) {
  const out = []; let from = 0; const size = 1000
  while (true) {
    const { data, error } = await make().range(from, from + size - 1)
    if (error) throw error
    out.push(...(data || []))
    if (!data || data.length < size) break
    from += size
  }
  return out
}
onMounted(async () => {
  try {
    const [rp, ro, rs] = await Promise.all([
      fetchAllPaged(() => supabase.from('plan_production').select('annee, mois, quantite_planifiee, produits(gamme, taille_lot)')),
      fetchAllPaged(() => supabase.from('ordres_fabrication').select('id, quantite_theorique, boites_fabriquees, date_lancement, date_fin_fabrication, produits(gamme, taille_lot)')),
      fetchAllPaged(() => supabase.from('suivi_phases').select('ordre_id, phase, statut, date_phase, date_debut').eq('actif', true))
    ])
    planRaw.value = rp; ofsRaw.value = ro; suivi.value = rs
  } catch (e) { console.error(e) } finally { chargement.value = false }
})

const annees = computed(() => {
  const s = new Set([new Date().getFullYear()])
  planRaw.value.forEach(r => { if (r.annee) s.add(Number(r.annee)) })
  ofsRaw.value.forEach(o => { const y = o.date_lancement ? new Date(o.date_lancement).getFullYear() : null; if (y) s.add(y) })
  return [...s].sort((a, b) => b - a)
})

const phasesLot = computed(() => {
  const m = {}
  for (const sp of suivi.value) {
    const k = phaseKey(sp.phase); if (!k) continue
    if (!m[sp.ordre_id]) m[sp.ordre_id] = {}
    const rec = { statut: sp.statut, date: sp.date_phase || sp.date_debut }
    if (!m[sp.ordre_id][k] || sp.statut === 'Terminé') m[sp.ordre_id][k] = rec
  }
  return m
})

// Plan par phase (annuel + mensuel)
const planData = computed(() => {
  const an = {}, mois = {}
  for (const r of planRaw.value) {
    if (Number(r.annee) !== annee.value) continue
    const p = r.produits; if (!p) continue
    const b = num(r.quantite_planifiee), t = num(p.taille_lot), lots = t > 0 ? b / t : 0
    const mi = (Number(r.mois) || 1) - 1
    const gamme = (Array.isArray(p.gamme) && p.gamme.length) ? p.gamme : []
    const seen = new Set()
    for (const ph of gamme) {
      const k = phaseKey(ph); if (!k || seen.has(k)) continue; seen.add(k)
      if (!an[k]) an[k] = { boites: 0, lots: 0 }
      an[k].boites += b; an[k].lots += lots
      if (!mois[k]) mois[k] = Array.from({ length: 12 }, () => ({ boites: 0, lots: 0 }))
      if (mi >= 0 && mi < 12) { mois[k][mi].boites += b; mois[k][mi].lots += lots }
    }
  }
  return { an, mois }
})

// Réalisé par phase (annuel + mensuel) — boîtes = qté théorique du lot ; lots = nombre de lots
const realData = computed(() => {
  const an = {}, mois = {}
  for (const o of ofsRaw.value) {
    const p = o.produits; if (!p) continue
    const b = num(o.quantite_theorique) || num(o.boites_fabriquees)
    const pl = phasesLot.value[o.id] || {}
    for (const k in pl) {
      const rec = pl[k]; if (rec.statut !== 'Terminé' && rec.statut !== 'En cours') continue
      const d = rec.date; const dt = d ? new Date(d) : null
      if (!dt || dt.getFullYear() !== annee.value) continue
      if (!an[k]) an[k] = { boites: 0, lots: 0 }
      an[k].boites += b; an[k].lots += 1
      const mi = dt.getMonth()
      if (!mois[k]) mois[k] = Array.from({ length: 12 }, () => ({ boites: 0, lots: 0 }))
      if (mi >= 0 && mi < 12) { mois[k][mi].boites += b; mois[k][mi].lots += 1 }
    }
  }
  return { an, mois }
})

const M = (o) => o ? (mesure.value === 'boites' ? o.boites : o.lots) : 0
const valPlan = (k) => M(planData.value.an[k])
const valReal = (k) => M(realData.value.an[k])
const taux = (k) => { const p = valPlan(k); return p > 0 ? Math.round(valReal(k) / p * 100) : null }
const moisReal = (k, i) => { const a = realData.value.mois[k]; return a ? M(a[i]) : 0 }

const phasesActives = computed(() => PHASES.filter(ph => planData.value.an[ph.key] || realData.value.an[ph.key]))
const totMois = (i) => phasesActives.value.reduce((s, ph) => s + moisReal(ph.key, i), 0)
const totGlobal = computed(() => phasesActives.value.reduce((s, ph) => s + valReal(ph.key), 0))
const matMode = ref('real')
const moisPlan = (k, i) => { const a = planData.value.mois[k]; return a ? M(a[i]) : 0 }
function moisVal(k, i) {
  if (matMode.value === 'plan') return moisPlan(k, i)
  if (matMode.value === 'taux') { const pl = moisPlan(k, i); return pl > 0 ? Math.round(moisReal(k, i) / pl * 100) : null }
  return moisReal(k, i)
}
function totPhase(k) {
  if (matMode.value === 'plan') return valPlan(k)
  if (matMode.value === 'taux') return taux(k)
  return valReal(k)
}
const totMoisPlan = (i) => phasesActives.value.reduce((s, ph) => s + moisPlan(ph.key, i), 0)
function totMoisVal(i) {
  if (matMode.value === 'plan') return totMoisPlan(i)
  if (matMode.value === 'taux') { const pl = totMoisPlan(i); return pl > 0 ? Math.round(totMois(i) / pl * 100) : null }
  return totMois(i)
}
const totPlanGlobal = computed(() => phasesActives.value.reduce((s, ph) => s + valPlan(ph.key), 0))
const totGlobalVal = computed(() => {
  if (matMode.value === 'plan') return totPlanGlobal.value
  if (matMode.value === 'taux') return totPlanGlobal.value > 0 ? Math.round(totGlobal.value / totPlanGlobal.value * 100) : null
  return totGlobal.value
})
function cellTxt(v) { if (matMode.value === 'taux') return v == null ? '·' : v + '%'; return v ? fmt(v) : '·' }
function cmpCls(real, plan) { if (!plan) return real ? '' : 'z'; const t = real / plan * 100; return t >= 100 ? 'cmp-ok' : t >= 80 ? 'cmp-mid' : 'cmp-low' }
const auj = new Date()
const objectifPct = computed(() => {
  if (annee.value < auj.getFullYear()) return 100
  if (annee.value > auj.getFullYear()) return 0
  const s0 = new Date(annee.value, 0, 1), e0 = new Date(annee.value + 1, 0, 1)
  return Math.round((auj - s0) / (e0 - s0) * 100)
})
const bilan = computed(() => {
  const moisAuj = (annee.value === auj.getFullYear()) ? auj.getMonth() : 11
  let planB = 0, planL = 0, realB = 0, realL = 0, planMB = 0, planML = 0, realMB = 0, realML = 0
  for (const r of planRaw.value) {
    if (Number(r.annee) !== annee.value) continue
    const p = r.produits; if (!p) continue
    const b = num(r.quantite_planifiee), t = num(p.taille_lot), l = t > 0 ? b / t : 0
    planB += b; planL += l
    if ((Number(r.mois) || 1) - 1 === moisAuj) { planMB += b; planML += l }
  }
  for (const o of ofsRaw.value) {
    const d = o.date_fin_fabrication; if (!d) continue
    const dt = new Date(d); if (isNaN(dt) || dt.getFullYear() !== annee.value) continue
    const b = num(o.boites_fabriquees) || num(o.quantite_theorique)
    realB += b; realL += 1
    if (dt.getMonth() === moisAuj) { realMB += b; realML += 1 }
  }
  return { planB, planL, realB, realL, planMB, planML, realMB, realML, moisAuj }
})
const planTot = computed(() => mesure.value === 'boites' ? bilan.value.planB : bilan.value.planL)
const realTot = computed(() => mesure.value === 'boites' ? bilan.value.realB : bilan.value.realL)
const tauxGlobal = computed(() => planTot.value > 0 ? Math.round(realTot.value / planTot.value * 100) : 0)
const ecart = computed(() => tauxGlobal.value - objectifPct.value)
const planMois = computed(() => mesure.value === 'boites' ? bilan.value.planMB : bilan.value.planML)
const realMois = computed(() => mesure.value === 'boites' ? bilan.value.realMB : bilan.value.realML)
const tauxMois = computed(() => planMois.value > 0 ? Math.round(realMois.value / planMois.value * 100) : 0)
const statut = computed(() => {
  const e = ecart.value
  if (e >= 0) return { txt: 'Dans les temps', cls: 'ok' }
  if (e >= -10) return { txt: 'Léger retard', cls: 'mid' }
  if (e >= -25) return { txt: 'Retard modéré — action prioritaire', cls: 'warn' }
  return { txt: 'Retard important — action urgente', cls: 'bad' }
})
const serieMois = computed(() => {
  const plan = Array(12).fill(0), real = Array(12).fill(0)
  for (const r of planRaw.value) {
    if (Number(r.annee) !== annee.value) continue
    const p = r.produits; if (!p) continue
    const v = mesure.value === 'boites' ? num(r.quantite_planifiee) : (num(p.taille_lot) > 0 ? num(r.quantite_planifiee) / num(p.taille_lot) : 0)
    const mi = (Number(r.mois) || 1) - 1
    if (mi >= 0 && mi < 12) plan[mi] += v
  }
  for (const o of ofsRaw.value) {
    const d = o.date_fin_fabrication; if (!d) continue
    const dt = new Date(d); if (isNaN(dt) || dt.getFullYear() !== annee.value) continue
    const mi = dt.getMonth()
    const v = mesure.value === 'boites' ? (num(o.boites_fabriquees) || num(o.quantite_theorique)) : 1
    if (mi >= 0 && mi < 12) real[mi] += v
  }
  return { plan, real, max: Math.max(1, ...plan, ...real) }
})
</script>

<style scoped>
.rp { padding: 24px 30px 50px; max-width: 1200px; margin: 0 auto; color: #1e293b; font-family: 'Segoe UI', system-ui, sans-serif; }
.rp-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
.rp-title { margin: 0; font-size: 24px; font-weight: 800; color: #0f172a; }
.rp-sub { margin: 4px 0 0; font-size: 13px; color: #64748b; }
.rp-year { display: flex; align-items: center; gap: 8px; }
.rp-year label { font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #94a3b8; }
.rp-year select { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 9px; font: inherit; font-size: 14px; font-weight: 600; }

.rp-toggles { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.tg { display: inline-flex; background: #eef2f7; border-radius: 10px; padding: 3px; }
.tg button { background: none; border: none; font: inherit; font-size: 13px; font-weight: 700; color: #64748b; padding: 7px 16px; border-radius: 8px; cursor: pointer; }
.tg button.on { background: #fff; color: #0f172a; box-shadow: 0 2px 6px rgba(30,41,59,.1); }

.rp-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 6px; box-shadow: 0 8px 22px rgba(30,41,59,.06); }
.rp-scroll { overflow-x: auto; }
.rp-empty { padding: 40px; text-align: center; color: #94a3b8; font-size: 14px; }
.rp-table { width: 100%; border-collapse: collapse; }
.rp-table thead th { text-align: left; font-size: 11.5px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; color: #64748b; padding: 12px 14px; border-bottom: 2px solid #f1f5f9; white-space: nowrap; }
.rp-table thead th.num { text-align: right; }
.rp-table tbody td { padding: 11px 14px; font-size: 13.5px; border-bottom: 1px solid #f5f7fa; }
.rp-table tbody tr:hover td { background: #f8fafc; }
.ph-nom { font-weight: 600; color: #1e293b; white-space: nowrap; }
.ph-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 8px; vertical-align: middle; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.tx { font-weight: 800; } .tx.ok { color: #15803d; } .tx.bas { color: #dc2626; } .muted { color: #cbd5e1; }
.rp-matrix .mois { font-size: 10.5px; padding: 10px 8px; }
.rp-matrix .cell { font-size: 12px; padding: 9px 8px; }
.rp-matrix .cell.z { color: #cbd5e1; }
.tot-col { font-weight: 800; background: #f8fafc; }
.rp-table tfoot .tot td { font-weight: 800; padding: 12px 14px; border-top: 2px solid #e2e8f0; background: #f8fafc; }
.rp-hint { font-size: 11.5px; color: #94a3b8; margin: 10px 6px 4px; }

@media (max-width: 760px) { .rp { padding: 16px; } }
.mat-tg { display: inline-flex; background: #eef2f7; border-radius: 10px; padding: 3px; margin: 6px 6px 12px; }
.mat-tg button { background: none; border: none; font: inherit; font-size: 12.5px; font-weight: 700; color: #64748b; padding: 6px 14px; border-radius: 8px; cursor: pointer; }
.mat-tg button.on { background: #fff; color: #0f172a; box-shadow: 0 2px 6px rgba(30,41,59,.1); }
.cmp-ok { background: #dcfce7; color: #15803d; font-weight: 700; }
.cmp-mid { background: #fef9c3; color: #a16207; font-weight: 700; }
.cmp-low { background: #fee2e2; color: #b91c1c; font-weight: 700; }
.rp-matrix .cell i, .rp-table i { font-style: normal; color: #94a3b8; font-weight: 400; font-size: .88em; }
.pdp-hero { display: flex; gap: 18px; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px 24px; margin-bottom: 18px; box-shadow: 0 8px 22px rgba(30,41,59,.06); flex-wrap: wrap; }
.hero-l { flex: 1; min-width: 320px; }
.hero-pct { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
.hp-val { font-size: 40px; font-weight: 800; color: #0f172a; line-height: 1; }
.hp-txt { display: flex; flex-direction: column; font-size: 13px; color: #64748b; }
.hp-txt b { font-weight: 700; margin-top: 2px; }
.up { color: #15803d; } .down { color: #dc2626; }
.hero-bar-wrap { position: relative; margin-bottom: 34px; }
.hero-bar { position: relative; height: 12px; background: #eef2f7; border-radius: 6px; }
.hb-fill { position: absolute; left: 0; top: 0; height: 100%; background: linear-gradient(90deg, #3b82f6, #6366f1); border-radius: 6px; }
.hb-obj { position: absolute; top: -4px; width: 2px; height: 20px; background: #0f172a; transform: translateX(-1px); }
.hb-obj-lbl { position: absolute; top: 22px; font-size: 11px; font-weight: 600; color: #475569; transform: translateX(-50%); white-space: nowrap; }
.hero-stat { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; padding: 8px 14px; border-radius: 9px; }
.hero-stat i { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.hero-stat.ok { background: #dcfce7; color: #15803d; }
.hero-stat.mid { background: #fef9c3; color: #a16207; }
.hero-stat.warn { background: #ffedd5; color: #c2410c; }
.hero-stat.bad { background: #fee2e2; color: #b91c1c; }
.hero-r { display: flex; gap: 12px; }
.syn-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; min-width: 130px; display: flex; flex-direction: column; justify-content: center; }
.syn-nums { display: flex; align-items: baseline; gap: 5px; }
.syn-nums b { font-size: 22px; font-weight: 800; color: #0f172a; }
.syn-nums span { font-size: 12px; color: #94a3b8; }
.syn-lbl { font-size: 11px; color: #64748b; margin-top: 3px; }
.syn-pct { font-size: 14px; font-weight: 800; color: #334155; margin-top: 6px; }
@media (max-width: 720px) { .hero-r { width: 100%; } .syn-card { flex: 1; } }
.pdp-chart { padding: 16px 20px; margin-bottom: 18px; }
.pc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 8px; }
.pc-leg { display: flex; gap: 14px; font-size: 12px; }
.lg { display: inline-flex; align-items: center; gap: 6px; color: #64748b; }
.lg::before { content: ''; width: 11px; height: 11px; border-radius: 3px; display: inline-block; }
.lg.r::before { background: #6366f1; }
.lg.p::before { background: #cbd5e1; }
.pc-bars { display: flex; align-items: flex-end; gap: 6px; height: 130px; }
.pc-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
.pc-pair { flex: 1; display: flex; align-items: flex-end; gap: 3px; width: 100%; justify-content: center; }
.pc-bar { width: 42%; max-width: 16px; border-radius: 3px 3px 0 0; min-height: 2px; }
.pc-bar.r { background: linear-gradient(#6366f1, #818cf8); }
.pc-bar.p { background: #cbd5e1; }
.pc-lbl { font-size: 10px; color: #94a3b8; margin-top: 5px; }
</style>
