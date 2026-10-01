<template>
  <div class="pqr-page">
    <PageHeader title="Tableau de bord PQR — Revue produit" tone="#a855f7"
      subtitle="Conformité, tendances et capabilité (Cp/Cpk) des paramètres critiques, par produit." />

    <p v-if="erreur" class="alert">{{ erreur }}</p>

    <section class="card">
      <div class="pqr-bar">
        <div class="f grow">
          <label>Produit</label>
          <select v-model="produitSel"><option value="">—</option><option v-for="pr in produits" :key="pr.id" :value="String(pr.id)">{{ pr.code_pf }} — {{ pr.designation }}</option></select>
        </div>
      </div>

      <div v-if="!produitSel" class="empty-card">Choisis un produit pour afficher sa revue qualité.</div>
      <div v-else-if="!mesures.length" class="empty-card">Aucune mesure saisie pour ce produit.</div>

      <template v-else>
        <div class="kpis">
          <div class="kpi"><div class="kv">{{ mesures.length }}</div><div class="kl">Mesures</div></div>
          <div class="kpi"><div class="kv">{{ nbLots }}</div><div class="kl">Lots</div></div>
          <div class="kpi" :class="tauxGlobal >= 95 ? 'good' : 'warn'"><div class="kv">{{ tauxGlobal.toFixed(1) }}%</div><div class="kl">Conformité</div></div>
          <div class="kpi" :class="{ bad: nbHors > 0 }"><div class="kv">{{ nbHors }}</div><div class="kl">Hors spec</div></div>
        </div>

        <h3 class="sec-titre">Synthèse par paramètre</h3>
        <p class="hint">Clique une ligne pour voir sa courbe de tendance. Cpk ≥ 1,33 : capable · 1,00–1,33 : acceptable · &lt; 1,00 : insuffisant.</p>
        <div v-for="ph in phasesAvecMesures" :key="ph" class="pqr-phase">
          <h4 class="pqr-phase-titre">{{ ph }}</h4>
          <table class="pqr-tbl">
            <thead><tr><th>Paramètre</th><th class="r">n</th><th class="r">Moyenne</th><th class="r">σ</th><th class="r">Limites</th><th class="r">Conf.</th><th class="r">Cp</th><th class="r">Cpk</th><th>Capabilité</th></tr></thead>
            <tbody>
              <tr v-for="r in syntheseDe(ph)" :key="r.id" :class="{ sel: r.id === paramSel }" @click="paramSel = r.id">
                <td class="nom">{{ r.nom }} <span class="u">{{ r.unite ? '(' + r.unite + ')' : '' }}</span></td>
                <td class="r">{{ r.n }}</td>
                <td class="r">{{ r.mean.toFixed(2) }}</td>
                <td class="r">{{ r.std.toFixed(3) }}</td>
                <td class="r lim">{{ limTxt(r.lsl, r.usl) }}</td>
                <td class="r"><span :class="r.conf >= 100 ? 'c-ok' : 'c-ko'">{{ r.conf.toFixed(0) }}%</span></td>
                <td class="r">{{ r.cp != null ? r.cp.toFixed(2) : '—' }}</td>
                <td class="r cpk">{{ r.cpk != null ? r.cpk.toFixed(2) : '—' }}</td>
                <td><span class="verdict" :class="verdictCls(r.cpk)">{{ verdictTxt(r.cpk) }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 class="sec-titre">Tendance — {{ paramSelObj ? paramSelObj.nom : '—' }}<span v-if="paramSelObj && paramSelObj.unite" class="u"> ({{ paramSelObj.unite }})</span></h3>
        <div v-if="chartData" class="chart-wrap">
          <svg :viewBox="'0 0 ' + chartData.W + ' ' + chartData.H" class="trend" preserveAspectRatio="xMidYMid meet">
            <line :x1="chartData.mL" :y1="chartData.mT" :x2="chartData.mL" :y2="chartData.H - chartData.mB" class="axis" />
            <line :x1="chartData.mL" :y1="chartData.H - chartData.mB" :x2="chartData.W - chartData.mR" :y2="chartData.H - chartData.mB" class="axis" />
            <template v-if="chartData.yUsl != null">
              <line :x1="chartData.mL" :y1="chartData.yUsl" :x2="chartData.W - chartData.mR" :y2="chartData.yUsl" class="l-spec" />
              <text :x="chartData.W - chartData.mR" :y="chartData.yUsl - 4" class="lbl-spec">Max {{ chartData.usl }}</text>
            </template>
            <template v-if="chartData.yLsl != null">
              <line :x1="chartData.mL" :y1="chartData.yLsl" :x2="chartData.W - chartData.mR" :y2="chartData.yLsl" class="l-spec" />
              <text :x="chartData.W - chartData.mR" :y="chartData.yLsl + 13" class="lbl-spec">Min {{ chartData.lsl }}</text>
            </template>
            <line v-if="chartData.yCible != null" :x1="chartData.mL" :y1="chartData.yCible" :x2="chartData.W - chartData.mR" :y2="chartData.yCible" class="l-cible" />
            <path :d="chartData.path" class="l-data" />
            <g v-for="(pt, i) in chartData.pts" :key="i">
              <circle :cx="pt.x" :cy="pt.y" r="4.5" :class="pt.ko ? 'pt-ko' : 'pt-ok'"><title>{{ pt.lot }} : {{ pt.v }}</title></circle>
            </g>
            <text :x="chartData.mL - 6" :y="chartData.mT + 5" class="ax">{{ chartData.ymax.toFixed(1) }}</text>
            <text :x="chartData.mL - 6" :y="chartData.H - chartData.mB + 4" class="ax">{{ chartData.ymin.toFixed(1) }}</text>
          </svg>
          <div class="leg"><span class="lg"><i class="d-ok"></i>Conforme</span><span class="lg"><i class="d-ko"></i>Hors spec</span><span class="lg"><i class="l-c"></i>Cible</span><span class="lg"><i class="l-s"></i>Limites</span></div>
        </div>
        <div v-else class="empty-sm">Sélectionne un paramètre ci-dessus.</div>

        <h3 class="sec-titre">Lots hors spec</h3>
        <div v-if="!horsSpecListe.length" class="empty-sm">Aucun lot hors spec 🎉</div>
        <table v-else class="pqr-tbl">
          <thead><tr><th>Lot</th><th>Phase</th><th>Paramètre</th><th class="r">Valeur</th><th class="r">Limites</th><th>Date</th></tr></thead>
          <tbody>
            <tr v-for="(h, i) in horsSpecListe" :key="i" class="row-ko">
              <td class="nom">{{ h.lot }}</td>
              <td>{{ h.phase }}</td>
              <td>{{ h.nom }}</td>
              <td class="r val-ko">{{ h.valeur }} {{ h.unite }}</td>
              <td class="r lim">{{ limTxt(h.lsl, h.usl) }}</td>
              <td>{{ h.date || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </template>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'

const PHASES_LISTE = ['Pesée', 'Granulation et Séchage', 'Mélange', 'Compression', 'Remplissage Gélules', 'Pelliculage']
const produits = ref([])
const produitSel = ref('')
const params = ref([])
const specByParam = ref({})
const mesures = ref([])
const paramSel = ref(null)
const erreur = ref('')

async function chargerBase() {
  const rp = await supabase.from('pqr_parametres').select('*').eq('actif', true).order('ordre')
  if (rp.error) { erreur.value = rp.error.message; return }
  params.value = rp.data || []
  const rpr = await supabase.from('produits').select('id, code_pf, designation').order('code_pf')
  if (!rpr.error) produits.value = rpr.data || []
}
onMounted(chargerBase)

watch(produitSel, async (pid) => {
  specByParam.value = {}; mesures.value = []; paramSel.value = null
  if (!pid) return
  const rs = await supabase.from('pqr_specs_produit').select('*').eq('produit_id', Number(pid))
  if (!rs.error) { const by = {}; for (const s of (rs.data || [])) by[s.parametre_id] = s; specByParam.value = by }
  const rm = await supabase.from('pqr_mesures').select('*').eq('produit_id', Number(pid))
  if (rm.error) { erreur.value = rm.error.message; return }
  mesures.value = rm.data || []
  paramSel.value = synthese.value.length ? synthese.value[0].id : null
})

function effMin(p) { const s = specByParam.value[p.id]; return s && s.limite_min != null ? s.limite_min : p.limite_min }
function effMax(p) { const s = specByParam.value[p.id]; return s && s.limite_max != null ? s.limite_max : p.limite_max }
function effCible(p) { const s = specByParam.value[p.id]; return s && s.cible != null ? s.cible : p.cible }
function horsSpecVal(v, mn, mx) { return (mn != null && v < mn) || (mx != null && v > mx) }
function limTxt(mn, mx) { if (mn == null && mx == null) return '—'; return (mn != null ? mn : '…') + ' – ' + (mx != null ? mx : '…') }

function stats(vals) {
  const n = vals.length
  const mean = vals.reduce((a, b) => a + b, 0) / n
  const variance = n > 1 ? vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0
  return { n, mean, std: Math.sqrt(variance), min: Math.min(...vals), max: Math.max(...vals) }
}
function cpkCalc(mean, std, lsl, usl) {
  if (std <= 0 || (lsl == null && usl == null)) return { cp: null, cpk: null }
  const cp = (lsl != null && usl != null) ? (usl - lsl) / (6 * std) : null
  const cpu = usl != null ? (usl - mean) / (3 * std) : Infinity
  const cpl = lsl != null ? (mean - lsl) / (3 * std) : Infinity
  const cpk = Math.min(cpu, cpl)
  return { cp, cpk: cpk === Infinity ? null : cpk }
}

const paramById = computed(() => { const m = {}; for (const p of params.value) m[p.id] = p; return m })
const synthese = computed(() => {
  const byParam = {}
  for (const m of mesures.value) { const v = Number(m.valeur); if (!Number.isNaN(v)) (byParam[m.parametre_id] = byParam[m.parametre_id] || []).push(v) }
  const out = []
  for (const p of params.value) {
    const vals = byParam[p.id]; if (!vals || !vals.length) continue
    const st = stats(vals); const lsl = effMin(p), usl = effMax(p)
    const conf = vals.filter(v => !horsSpecVal(v, lsl, usl)).length / vals.length * 100
    const c = cpkCalc(st.mean, st.std, lsl, usl)
    out.push({ id: p.id, phase: p.phase, nom: p.nom, unite: p.unite, n: st.n, mean: st.mean, std: st.std, min: st.min, max: st.max, lsl, usl, conf, cp: c.cp, cpk: c.cpk })
  }
  return out
})
const phaseIndex = (ph) => { const i = PHASES_LISTE.indexOf(ph); return i < 0 ? 999 : i }
const phasesAvecMesures = computed(() => [...new Set(synthese.value.map(r => r.phase))].sort((a, b) => phaseIndex(a) - phaseIndex(b)))
function syntheseDe(ph) { return synthese.value.filter(r => r.phase === ph) }

const nbLots = computed(() => new Set(mesures.value.map(m => m.of_id)).size)
const nbHors = computed(() => mesures.value.filter(m => { const p = paramById.value[m.parametre_id]; if (!p) return false; return horsSpecVal(Number(m.valeur), effMin(p), effMax(p)) }).length)
const tauxGlobal = computed(() => mesures.value.length ? (mesures.value.length - nbHors.value) / mesures.value.length * 100 : 0)

function verdictCls(cpk) { if (cpk == null) return 'v-na'; if (cpk >= 1.33) return 'v-ok'; if (cpk >= 1.0) return 'v-mid'; return 'v-ko' }
function verdictTxt(cpk) { if (cpk == null) return '—'; if (cpk >= 1.33) return 'Capable'; if (cpk >= 1.0) return 'Acceptable'; return 'Insuffisant' }

const paramSelObj = computed(() => paramById.value[paramSel.value] || null)
const chartData = computed(() => {
  const p = paramSelObj.value; if (!p) return null
  const ms = mesures.value.filter(m => m.parametre_id === p.id && !Number.isNaN(Number(m.valeur)))
    .slice().sort((a, b) => String(a.date_mesure || '').localeCompare(String(b.date_mesure || '')) || a.id - b.id)
  if (!ms.length) return null
  const vals = ms.map(m => Number(m.valeur))
  const lsl = effMin(p), usl = effMax(p), cible = effCible(p)
  const allY = [...vals]; if (lsl != null) allY.push(lsl); if (usl != null) allY.push(usl); if (cible != null) allY.push(cible)
  let ymin = Math.min(...allY), ymax = Math.max(...allY)
  if (ymin === ymax) { ymin -= 1; ymax += 1 }
  const pd = (ymax - ymin) * 0.12; ymin -= pd; ymax += pd
  const W = 760, H = 280, mL = 52, mR = 54, mT = 16, mB = 40
  const xx = (i) => mL + (ms.length === 1 ? (W - mL - mR) / 2 : i * (W - mL - mR) / (ms.length - 1))
  const yy = (v) => mT + (ymax - v) / (ymax - ymin) * (H - mT - mB)
  const pts = ms.map((m, i) => ({ x: xx(i), y: yy(Number(m.valeur)), v: Number(m.valeur), lot: m.numero_lot || '', ko: horsSpecVal(Number(m.valeur), lsl, usl) }))
  const path = pts.map((pt, i) => (i ? 'L' : 'M') + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1)).join(' ')
  return { W, H, mL, mR, mT, mB, pts, path, lsl, usl, cible, ymin, ymax, yLsl: lsl != null ? yy(lsl) : null, yUsl: usl != null ? yy(usl) : null, yCible: cible != null ? yy(cible) : null }
})

const horsSpecListe = computed(() => {
  const out = []
  for (const m of mesures.value) {
    const p = paramById.value[m.parametre_id]; if (!p) continue
    const v = Number(m.valeur); const lsl = effMin(p), usl = effMax(p)
    if (horsSpecVal(v, lsl, usl)) out.push({ lot: m.numero_lot || '—', phase: p.phase, nom: p.nom, unite: p.unite || '', valeur: m.valeur, lsl, usl, date: m.date_mesure })
  }
  return out.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
})
</script>

<style scoped>
.pqr-page { color: #1b2733; }
.alert { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 10px 14px; border-radius: 8px; margin: 0 0 14px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 22px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.empty-card { background: #fff; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 24px; color: #475569; text-align: center; font-size: 14px; }
.empty-sm { color: #64748b; font-size: 13px; padding: 10px 2px; }

.pqr-bar { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; align-items: flex-end; }
.pqr-bar .f { display: flex; flex-direction: column; gap: 4px; }
.pqr-bar .f.grow { flex: 1; min-width: 260px; }
.pqr-bar label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; }
.pqr-bar select { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; color: #1b2733; width: 100%; }

.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
.kpi { background: #f8fafc; border: 1px solid #eef2f6; border-radius: 12px; padding: 14px; text-align: center; }
.kpi .kv { font-size: 24px; font-weight: 800; color: #0f172a; font-variant-numeric: tabular-nums; }
.kpi .kl { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #94a3b8; font-weight: 700; margin-top: 2px; }
.kpi.good .kv { color: #16a34a; }
.kpi.warn .kv { color: #d97706; }
.kpi.bad .kv { color: #dc2626; }
@media (max-width: 640px) { .kpis { grid-template-columns: repeat(2, 1fr); } }

.sec-titre { margin: 22px 0 6px; font-size: 15px; font-weight: 800; color: #0f172a; border-left: 4px solid #a855f7; padding-left: 9px; }
.hint { font-size: 12px; color: #64748b; margin: 0 0 10px; }
.pqr-phase { margin-top: 14px; }
.pqr-phase-titre { margin: 0 0 5px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: #a855f7; }
.pqr-tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.pqr-tbl th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; font-weight: 700; padding: 6px 9px; border-bottom: 2px solid #eef2f6; }
.pqr-tbl th.r { text-align: right; }
.pqr-tbl td { padding: 7px 9px; border-bottom: 1px solid #f1f5f9; }
.pqr-tbl td.r { text-align: right; font-variant-numeric: tabular-nums; }
.pqr-tbl td.nom { font-weight: 700; color: #0f172a; }
.pqr-tbl td.nom .u { font-weight: 500; color: #94a3b8; font-size: 11px; }
.pqr-tbl td.lim { color: #64748b; }
.pqr-tbl td.cpk { font-weight: 800; color: #0f172a; }
.pqr-tbl tbody tr { cursor: pointer; }
.pqr-tbl tbody tr:hover { background: #faf5ff; }
.pqr-tbl tbody tr.sel { background: #f3e8ff; }
.pqr-tbl tr.row-ko { background: #fef2f2; cursor: default; }
.pqr-tbl td.val-ko { color: #b91c1c; font-weight: 800; }
.c-ok { color: #16a34a; font-weight: 700; }
.c-ko { color: #dc2626; font-weight: 700; }
.verdict { font-size: 11px; font-weight: 800; padding: 2px 9px; border-radius: 999px; white-space: nowrap; }
.verdict.v-ok { background: #dcfce7; color: #166534; }
.verdict.v-mid { background: #fef3c7; color: #92400e; }
.verdict.v-ko { background: #fee2e2; color: #b91c1c; }
.verdict.v-na { background: #f1f5f9; color: #94a3b8; }

.chart-wrap { margin-top: 6px; }
.trend { width: 100%; height: auto; background: #fcfcfd; border: 1px solid #eef2f6; border-radius: 12px; }
.trend .axis { stroke: #cbd5e1; stroke-width: 1; }
.trend .l-spec { stroke: #f87171; stroke-width: 1.5; stroke-dasharray: 5 4; }
.trend .l-cible { stroke: #a855f7; stroke-width: 1.5; stroke-dasharray: 2 4; }
.trend .l-data { fill: none; stroke: #0ea5e9; stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
.trend .pt-ok { fill: #0ea5e9; stroke: #fff; stroke-width: 1.5; }
.trend .pt-ko { fill: #dc2626; stroke: #fff; stroke-width: 1.5; }
.trend .ax { fill: #94a3b8; font-size: 11px; text-anchor: end; font-weight: 600; }
.trend .lbl-spec { fill: #ef4444; font-size: 10px; text-anchor: end; font-weight: 700; }
.leg { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 8px; padding-left: 4px; }
.leg .lg { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: #64748b; font-weight: 600; }
.leg i { width: 14px; height: 3px; border-radius: 2px; display: inline-block; }
.leg .d-ok, .leg .d-ko { width: 10px; height: 10px; border-radius: 50%; }
.leg .d-ok { background: #0ea5e9; }
.leg .d-ko { background: #dc2626; }
.leg .l-c { background: #a855f7; }
.leg .l-s { background: #f87171; }
</style>
