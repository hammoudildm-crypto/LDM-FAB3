<template>
  <div class="rp">
    <header class="rp-head">
      <div>
        <h1 class="rp-title">Réalisation du PDP par phase</h1>
        <p class="rp-sub">Avancement du plan directeur, par phase de fabrication</p>
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

    <div class="rp-layout">
      <aside class="rp-side">
        <div class="side-sec">
          <div class="side-lbl">Année</div>
          <select class="side-select" v-model.number="annee"><option v-for="a in annees" :key="a" :value="a">{{ a }}</option></select>
        </div>
        <div class="side-sec">
          <div class="side-lbl">Mesure</div>
          <div class="side-tg">
            <button :class="{ on: mesure === 'boites' }" @click="mesure = 'boites'">Boîtes</button>
            <button :class="{ on: mesure === 'lots' }" @click="mesure = 'lots'">Lots</button>
          </div>
        </div>
        <div class="side-sec">
          <div class="side-lbl">Période</div>
          <div class="side-tg">
            <button :class="{ on: vue === 'annuel' }" @click="vue = 'annuel'">Annuel</button>
            <button :class="{ on: vue === 'mensuel' }" @click="vue = 'mensuel'">Mensuel</button>
          </div>
        </div>
        <div class="side-sec">
          <div class="side-lbl">Phase</div>
          <div class="side-phases">
            <button v-for="ph in phasesActives" :key="ph.key" :class="{ on: filtrePhase === ph.key }" @click="filtrePhase = filtrePhase === ph.key ? null : ph.key"><span class="ph-dot" :style="{ background: ph.color }"></span>{{ ph.label }}</button>
          </div>
        </div>
        <div class="side-sec">
          <div class="side-lbl">Légende</div>
          <div class="side-leg">
            <div class="leg-row"><span class="leg-sw ok"></span>Taux &ge; objectif</div>
            <div class="leg-row"><span class="leg-sw mid"></span>80&ndash;99 % (Comparer)</div>
            <div class="leg-row"><span class="leg-sw bas"></span>Taux &lt; objectif</div>
            <div class="leg-note">Mode « Comparer » : Réalisé / Plan par case.</div>
          </div>
        </div>
      </aside>
      <div class="rp-main">

    <div v-if="chargement" class="rp-empty">Chargement…</div>

    <!-- ANNUEL -->
    <div v-else-if="vue === 'annuel'" class="rp-card">
      <table class="rp-table">
        <thead><tr><th>Phase</th><th class="num">Plan</th><th class="num">Réalisé</th><th class="num">Taux</th><th class="w-cbar">Comparer (Réalisé / Plan)</th></tr></thead>
        <tbody>
          <tr v-for="ph in phasesAffichees" :key="ph.key">
            <td class="ph-nom"><span class="ph-dot" :style="{ background: ph.color }"></span>{{ ph.label }}</td>
            <td class="num">{{ fmt(valPlan(ph.key)) }}</td>
            <td class="num">{{ fmt(valReal(ph.key)) }}</td>
            <td class="num"><span v-if="taux(ph.key) != null" class="tx" :class="taux(ph.key) >= 100 ? 'ok' : 'bas'">{{ taux(ph.key) }}%</span><span v-else class="muted">—</span></td>
            <td class="w-cbar"><span class="cbar"><span class="cbar-in" :class="(taux(ph.key) || 0) >= objectifPct ? 'ok' : 'bas'" :style="{ width: Math.min(taux(ph.key) || 0, 100) + '%' }"></span></span></td>
          </tr>
          <tr v-if="!phasesAffichees.length"><td colspan="5" class="rp-empty">Aucune donnée pour {{ annee }}.</td></tr>
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
          <tr v-for="ph in phasesAffichees" :key="ph.key">
            <td class="ph-nom"><span class="ph-dot" :style="{ background: ph.color }"></span>{{ ph.label }}</td>
            <td v-for="(m, i) in MOIS" :key="i" class="num cell" :class="matMode === 'comparer' ? cmpCls(moisReal(ph.key, i), moisPlan(ph.key, i)) : { z: !moisVal(ph.key, i) }"><template v-if="matMode === 'comparer'"><span v-if="moisReal(ph.key, i) || moisPlan(ph.key, i)">{{ fmt(moisReal(ph.key, i)) }}<i>/{{ fmt(moisPlan(ph.key, i)) }}</i></span><span v-else>·</span></template><template v-else>{{ cellTxt(moisVal(ph.key, i)) }}</template></td>
            <td class="num tot-col"><template v-if="matMode === 'comparer'">{{ fmt(valReal(ph.key)) }}<i>/{{ fmt(valPlan(ph.key)) }}</i></template><template v-else>{{ cellTxt(totPhase(ph.key)) }}</template></td>
          </tr>
          <tr v-if="!phasesAffichees.length"><td :colspan="14" class="rp-empty">Aucune donnée pour {{ annee }}.</td></tr>
        </tbody>
        <tfoot v-if="phasesAffichees.length">
          <tr class="tot"><td>{{ matMode === 'plan' ? 'Total plan' : matMode === 'taux' ? 'Taux global' : matMode === 'comparer' ? 'Réalisé / Plan' : 'Total réalisé' }}</td><td v-for="(m, i) in MOIS" :key="i" class="num"><template v-if="matMode === 'comparer'">{{ fmt(totMois(i)) }}<i>/{{ fmt(totMoisPlan(i)) }}</i></template><template v-else>{{ cellTxt(totMoisVal(i)) }}</template></td><td class="num tot-col"><template v-if="matMode === 'comparer'">{{ fmt(totGlobal) }}<i>/{{ fmt(totPlanGlobal) }}</i></template><template v-else>{{ cellTxt(totGlobalVal) }}</template></td></tr>
        </tfoot>
      </table>
      <p class="rp-hint">Vue mensuelle : <b>Réalisé</b>, <b>Plan</b> ou <b>Taux</b> par phase et par mois (bascule ci-dessus). Le mois du réalisé = celui où le lot a atteint la phase.</p>
    </div>

    <section v-if="filtrePhase" class="rp-card lots-phase">
      <h3 class="card-title">Lots — {{ labelPhase(filtrePhase) }}</h3>
      <div class="lp-cols">
        <div class="lp-col">
          <div class="lp-head enc"><span class="lp-dot"></span>En cours <b>{{ lotsPhaseSel.encours.length }}</b></div>
          <div class="lp-list"><div v-for="o in lotsPhaseSel.encours" :key="o.id" class="lp-lot"><span class="lp-num">{{ o.numero_lot }}</span> {{ prodTxt(o) }}</div><div v-if="!lotsPhaseSel.encours.length" class="lp-vide">Aucun</div></div>
        </div>
        <div class="lp-col">
          <div class="lp-head att"><span class="lp-dot"></span>En attente <b>{{ lotsPhaseSel.attente.length }}</b></div>
          <div class="lp-list"><div v-for="o in lotsPhaseSel.attente" :key="o.id" class="lp-lot"><span class="lp-num">{{ o.numero_lot }}</span> {{ prodTxt(o) }}</div><div v-if="!lotsPhaseSel.attente.length" class="lp-vide">Aucun</div></div>
        </div>
        <div class="lp-col">
          <div class="lp-head pla"><span class="lp-dot"></span>Planifiés <b>{{ lotsPhaseSel.planifie.length }}</b></div>
          <div class="lp-list"><div v-for="o in lotsPhaseSel.planifie" :key="o.id" class="lp-lot"><span class="lp-num">{{ o.numero_lot }}</span> {{ prodTxt(o) }}</div><div v-if="!lotsPhaseSel.planifie.length" class="lp-vide">Aucun</div></div>
        </div>
      </div>
    </section>
      </div>
      <div class="rp-right">
        <section class="rp-card pdp-chart">
          <div class="pc-head"><h3 class="card-title">{{ mesure === 'boites' ? 'Boîtes' : 'Lots' }} par mois — {{ annee }}</h3></div>
          <div class="pc-leg"><span class="lg r">Réalisé</span><span class="lg p">Prévu</span></div>
          <div class="pc-bars">
            <div v-for="(m, i) in MOIS" :key="i" class="pc-col">
              <div class="pc-pair">
                <span class="pc-bar r" :style="{ height: (serieMois.real[i] / serieMois.max * 100) + '%' }" :title="m + ' — Réalisé ' + fmt(serieMois.real[i])"></span>
                <span class="pc-bar p" :style="{ height: (serieMois.plan[i] / serieMois.max * 100) + '%' }" :title="m + ' — Prévu ' + fmt(serieMois.plan[i])"></span>
              </div>
              <span class="pc-lbl">{{ m.charAt(0) }}</span>
            </div>
          </div>
        </section>
      </div>
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
      fetchAllPaged(() => supabase.from('ordres_fabrication').select('id, numero_lot, statut, quantite_theorique, boites_fabriquees, date_lancement, date_fin_fabrication, produits(code_pf, designation, gamme, taille_lot)')),
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
const filtrePhase = ref(null)
const phasesAffichees = computed(() => filtrePhase.value ? phasesActives.value.filter(p => p.key === filtrePhase.value) : phasesActives.value)
const prodTxt = (o) => { const p = o && o.produits; return p ? ((p.code_pf || '') + ' — ' + (p.designation || '')) : '' }
const labelPhase = (k) => { const ph = PHASES.find(p => p.key === k); return ph ? ph.label : k }
const lotsParPhase = computed(() => {
  const m = {}
  const get = (k) => { if (!m[k]) m[k] = { encours: [], attente: [], planifie: [] }; return m[k] }
  for (const o of ofsRaw.value) {
    if (/rejet/i.test(o.statut || '')) continue
    const pl = phasesLot.value[o.id] || {}
    const p = o.produits || {}
    const gamme = (Array.isArray(p.gamme) && p.gamme.length) ? p.gamme : []
    const fabKeys = []; const seen = new Set()
    for (const phn of gamme) { const k = phaseKey(phn); if (k && k !== 'conditionnement' && !seen.has(k)) { seen.add(k); fabKeys.push(k) } }
    const started = fabKeys.some(k => { const st = (pl[k] || {}).statut; return st === 'Terminé' || st === 'En cours' })
    for (const k of fabKeys) {
      const st = (pl[k] || {}).statut
      if (st === 'Terminé') continue
      const g = get(k)
      if (st === 'En cours') g.encours.push(o)
      else if (started) g.attente.push(o)
      else g.planifie.push(o)
    }
  }
  return m
})
const lotsPhaseSel = computed(() => (filtrePhase.value && lotsParPhase.value[filtrePhase.value]) || { encours: [], attente: [], planifie: [] })
const totMois = (i) => phasesAffichees.value.reduce((s, ph) => s + moisReal(ph.key, i), 0)
const totGlobal = computed(() => phasesAffichees.value.reduce((s, ph) => s + valReal(ph.key), 0))
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
const totMoisPlan = (i) => phasesAffichees.value.reduce((s, ph) => s + moisPlan(ph.key, i), 0)
function totMoisVal(i) {
  if (matMode.value === 'plan') return totMoisPlan(i)
  if (matMode.value === 'taux') { const pl = totMoisPlan(i); return pl > 0 ? Math.round(totMois(i) / pl * 100) : null }
  return totMois(i)
}
const totPlanGlobal = computed(() => phasesAffichees.value.reduce((s, ph) => s + valPlan(ph.key), 0))
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
.rp-layout { display: flex; gap: 18px; align-items: flex-start; }
.rp-side { flex: 0 0 180px; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; box-shadow: 0 6px 18px rgba(30,41,59,.05); position: sticky; top: 16px; }
.side-sec { margin-bottom: 18px; } .side-sec:last-child { margin-bottom: 0; }
.side-lbl { font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #94a3b8; margin-bottom: 8px; }
.side-tg { display: flex; flex-direction: column; gap: 6px; }
.side-tg button { background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 9px; font: inherit; font-size: 13.5px; font-weight: 600; color: #64748b; padding: 9px 12px; cursor: pointer; text-align: left; }
.side-tg button.on { background: #6366f1; border-color: #6366f1; color: #fff; }
.rp-main { flex: 1; min-width: 0; }
@media (max-width: 760px) { .rp-layout { flex-direction: column; } .rp-side { flex: none; width: 100%; position: static; } .side-tg { flex-direction: row; } .side-tg button { flex: 1; text-align: center; } }
.side-select { width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 9px; font: inherit; font-size: 14px; font-weight: 600; }
.side-phases { display: flex; flex-direction: column; gap: 4px; }
.side-phases button { display: flex; align-items: center; gap: 7px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font: inherit; font-size: 12.5px; font-weight: 600; color: #475569; padding: 7px 10px; cursor: pointer; text-align: left; }
.side-phases button.on { background: #eef2ff; border-color: #6366f1; color: #4338ca; }
.ph-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.side-leg { display: flex; flex-direction: column; gap: 6px; }
.leg-row { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #64748b; }
.leg-sw { width: 14px; height: 14px; border-radius: 4px; flex-shrink: 0; }
.leg-sw.ok { background: #dcfce7; } .leg-sw.bas { background: #fee2e2; } .leg-sw.mid { background: #fef9c3; }
.leg-note { font-size: 11px; color: #94a3b8; margin-top: 2px; line-height: 1.4; }
.rp-right { flex: 0 0 250px; }
.rp-right .pdp-chart { position: sticky; top: 16px; margin-bottom: 0; padding: 14px 16px; }
.rp-right .pc-head { margin-bottom: 8px; }
.rp-right .pc-head .card-title { font-size: 14px; }
.rp-right .pc-leg { margin-bottom: 12px; }
.rp-right .pc-bars { height: 120px; gap: 3px; }
.rp-right .pc-pair { gap: 1px; }
.rp-right .pc-bar { max-width: 8px; }
.rp-right .pc-lbl { font-size: 8px; }
@media (max-width: 980px) { .rp-right { flex: none; width: 100%; } .rp-right .pdp-chart { position: static; } .rp-right .pc-bar { max-width: 16px; } .rp-right .pc-lbl { font-size: 10px; } }
.w-cbar { width: 170px; }
.cbar { display: block; height: 9px; background: #eef2f7; border-radius: 5px; overflow: hidden; }
.cbar-in { display: block; height: 100%; border-radius: 5px; min-width: 2px; }
.cbar-in.ok { background: #22c55e; } .cbar-in.bas { background: #f59e0b; }
.lots-phase { margin-top: 16px; }
.lp-cols { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 12px; }
.lp-col { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px; }
.lp-head { display: flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 700; color: #334155; margin-bottom: 8px; }
.lp-head b { margin-left: auto; }
.lp-dot { width: 9px; height: 9px; border-radius: 50%; }
.lp-head.enc .lp-dot { background: #14b8a6; } .lp-head.att .lp-dot { background: #f59e0b; } .lp-head.pla .lp-dot { background: #64748b; }
.lp-list { display: flex; flex-direction: column; gap: 4px; max-height: 320px; overflow-y: auto; }
.lp-lot { background: #fff; border: 1px solid #eef2f7; border-radius: 7px; padding: 6px 9px; font-size: 11.5px; color: #475569; line-height: 1.3; }
.lp-num { font-family: ui-monospace, monospace; font-weight: 700; color: #0f172a; }
.lp-vide { color: #cbd5e1; font-size: 12px; padding: 6px; text-align: center; }
@media (max-width: 640px) { .lp-cols { grid-template-columns: 1fr; } }
/* Mode compact : tout visible à l'écran */
.rp { padding: 12px 20px 20px; }
.rp-head { margin-bottom: 10px; }
.rp-title { font-size: 19px; }
.rp-sub { font-size: 12px; margin-top: 2px; }
.pdp-hero { padding: 12px 18px; margin-bottom: 12px; gap: 14px; }
.hp-val { font-size: 28px; }
.hp-txt { font-size: 12px; }
.hero-pct { margin-bottom: 8px; gap: 12px; }
.hero-bar-wrap { margin-bottom: 20px; }
.hero-bar { height: 10px; }
.hero-stat { padding: 6px 12px; font-size: 12px; }
.syn-card { padding: 10px 13px; min-width: 118px; }
.syn-nums b { font-size: 18px; }
.pdp-chart { margin-bottom: 0; }
.rp-table thead th { padding: 8px 12px; font-size: 11px; }
.rp-table tbody td { padding: 6px 12px; font-size: 12.5px; }
.rp-matrix .mois { padding: 7px 6px; }
.rp-matrix .cell { padding: 6px 6px; font-size: 11px; }
.rp-side { padding: 12px; }
.rp-side .side-sec { margin-bottom: 12px; }
.side-lbl { margin-bottom: 6px; }
.side-tg button { padding: 7px 10px; font-size: 13px; }
.side-phases button { padding: 5px 9px; font-size: 12px; }
.side-select { padding: 6px 9px; }
.lots-phase { margin-top: 12px; }
.lp-cols { margin-top: 10px; gap: 10px; }
.lp-col { padding: 9px; }
.lp-list { max-height: 220px; }
/* Ultra compact */
.rp { padding: 8px 14px 14px; }
.rp-title { font-size: 17px; }
.rp-sub { display: none; }
.rp-head { margin-bottom: 8px; }
.pdp-hero { padding: 10px 14px; margin-bottom: 8px; gap: 12px; }
.hp-val { font-size: 24px; }
.hp-txt { font-size: 11px; }
.hero-pct { margin-bottom: 6px; }
.hero-bar-wrap { margin-bottom: 15px; }
.hero-bar { height: 8px; }
.hero-stat { padding: 5px 10px; font-size: 11px; }
.hero-r { gap: 8px; }
.syn-card { padding: 8px 11px; min-width: 98px; }
.syn-nums b { font-size: 16px; }
.syn-lbl { font-size: 10px; }
.syn-pct { font-size: 13px; margin-top: 4px; }
.rp-layout { gap: 12px; }
.rp-card { padding: 4px; }
.rp-table thead th { padding: 6px 10px; font-size: 10.5px; }
.rp-table tbody td { padding: 4px 10px; font-size: 12px; }
.rp-matrix .cell { padding: 4px 5px; font-size: 10.5px; }
.rp-side { padding: 10px; flex: 0 0 158px; }
.rp-side .side-sec { margin-bottom: 9px; }
.side-lbl { font-size: 10px; margin-bottom: 5px; }
.side-tg button { padding: 5px 9px; font-size: 12px; }
.side-phases button { padding: 4px 8px; font-size: 11px; }
.side-select { padding: 5px 8px; font-size: 13px; }
.pdp-chart { padding: 10px 12px; }
.rp-right { flex: 0 0 218px; }
.rp-right .pc-bars { height: 88px; }
.card-title { font-size: 14px; }
.lots-phase { margin-top: 10px; }
.lp-cols { margin-top: 8px; gap: 8px; }
.lp-col { padding: 8px; }
.lp-list { max-height: 170px; }
.lp-lot { padding: 5px 8px; font-size: 11px; }
/* Filtres Mesure/Période côte à côte */
.side-tg { flex-direction: row; gap: 5px; }
.side-tg button { flex: 1; text-align: center; padding: 6px 4px; font-size: 12px; }
</style>
