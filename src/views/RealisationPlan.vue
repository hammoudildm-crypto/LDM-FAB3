<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'
import { ICONS, TINTS } from '../icons.js'

const anneeCourante = new Date().getFullYear()
const ANNEES = []
for (let a = anneeCourante - 4; a <= anneeCourante + 1; a++) ANNEES.push(a)
const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

const anneeSel = ref(anneeCourante)
const planRows = ref([])
const realRows = ref([])
const condRows = ref([])
const ofs = ref([])
const msg = ref('')

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
  msg.value = ''
  const rp = await fetchAllPaged(() => supabase.from('plan_production')
    .select('annee, mois, quantite_planifiee, produits(code_pf, designation, pcsu)'))
  if (rp.error) { msg.value = rp.error.message; return }
  planRows.value = rp.data

  const rr = await fetchAllPaged(() => supabase.from('realisations')
    .select('annee, mois, quantite_realisee, produits(code_pf, designation, pcsu)'))
  if (rr.error) { msg.value = rr.error.message; return }
  realRows.value = rr.data

  const rc = await fetchAllPaged(() => supabase.from('conditionnement')
    .select('quantite_conditionnee, date_conditionnement, ordres_fabrication(date_fin_fabrication, produits(code_pf, designation, pcsu, unites_par_boite))')
    .eq('actif', true))
  if (rc.error) { msg.value = rc.error.message; return }
  condRows.value = rc.data

  const ro = await fetchAllPaged(() => supabase.from('ordres_fabrication')
    .select('boites_fabriquees, date_fin_fabrication, produits(code_pf, designation, pcsu)')
    .eq('actif', true))
  if (ro.error) { msg.value = ro.error.message; return }
  ofs.value = ro.data
}
onMounted(charger)

const num = (v) => Number(v || 0)
const condBoites = (c) => {
  const p = c.ordres_fabrication && c.ordres_fabrication.produits ? c.ordres_fabrication.produits : null
  const upb = p ? num(p.unites_par_boite) : 0
  if (!upb || c.quantite_conditionnee == null) return 0
  return Math.floor(num(c.quantite_conditionnee) / upb)
}

// --- Séries mensuelles (boîtes) ---
const planParMois = computed(() => {
  const a = Array(12).fill(0)
  for (const r of planRows.value) if (Number(r.annee) === anneeSel.value && r.mois >= 1 && r.mois <= 12) a[r.mois - 1] += num(r.quantite_planifiee)
  return a
})
const fabReelParMois = computed(() => {
  const a = Array(12).fill(0)
  for (const o of ofs.value) {
    if (!o.date_fin_fabrication) continue
    const d = new Date(o.date_fin_fabrication)
    if (d.getFullYear() !== anneeSel.value) continue
    a[d.getMonth()] += num(o.boites_fabriquees)
  }
  return a
})
// Anticipation : fabriqué en N-1, conditionné en N -> crédité à la fabrication de N (au mois de conditionnement)
const condFabAnnee = (c) => {
  const o = c.ordres_fabrication
  return o && o.date_fin_fabrication ? new Date(o.date_fin_fabrication).getFullYear() : null
}
const anticipParMois = computed(() => {
  const a = Array(12).fill(0)
  for (const c of condRows.value) {
    if (!c.date_conditionnement) continue
    const d = new Date(c.date_conditionnement)
    if (d.getFullYear() === anneeSel.value && condFabAnnee(c) === anneeSel.value - 1) a[d.getMonth()] += condBoites(c)
  }
  return a
})
const anticipTotal = computed(() => anticipParMois.value.reduce((s, x) => s + x, 0))
const fabParMois = computed(() => fabReelParMois.value)
const condParMois = computed(() => {
  const a = Array(12).fill(0)
  for (const c of condRows.value) {
    if (!c.date_conditionnement) continue
    const d = new Date(c.date_conditionnement)
    if (d.getFullYear() === anneeSel.value) a[d.getMonth()] += condBoites(c)
  }
  return a
})

const planTotal = computed(() => planParMois.value.reduce((s, x) => s + x, 0))
const fabTotal = computed(() => fabParMois.value.reduce((s, x) => s + x, 0))
const condTotal = computed(() => condParMois.value.reduce((s, x) => s + x, 0))

// --- Valorisation CA (boîtes × PCSU) ---
const planCA = computed(() => {
  let ca = 0
  for (const r of planRows.value) if (Number(r.annee) === anneeSel.value) ca += num(r.quantite_planifiee) * num(r.produits && r.produits.pcsu)
  return ca
})
const fabReelCA = computed(() => {
  let ca = 0
  for (const o of ofs.value) {
    if (!o.date_fin_fabrication || new Date(o.date_fin_fabrication).getFullYear() !== anneeSel.value) continue
    ca += num(o.boites_fabriquees) * num(o.produits && o.produits.pcsu)
  }
  return ca
})
const anticipCA = computed(() => {
  let ca = 0
  for (const c of condRows.value) {
    if (!c.date_conditionnement || new Date(c.date_conditionnement).getFullYear() !== anneeSel.value) continue
    if (condFabAnnee(c) !== anneeSel.value - 1) continue
    const p = c.ordres_fabrication && c.ordres_fabrication.produits ? c.ordres_fabrication.produits : null
    ca += condBoites(c) * num(p && p.pcsu)
  }
  return ca
})
const fabCA = computed(() => fabReelCA.value)
const condCA = computed(() => {
  let ca = 0
  for (const c of condRows.value) {
    if (!c.date_conditionnement) continue
    if (new Date(c.date_conditionnement).getFullYear() !== anneeSel.value) continue
    const p = c.ordres_fabrication && c.ordres_fabrication.produits ? c.ordres_fabrication.produits : null
    ca += condBoites(c) * num(p && p.pcsu)
  }
  return ca
})

const pctFab = computed(() => planTotal.value > 0 ? (fabTotal.value / planTotal.value) * 100 : null)
const pctCond = computed(() => planTotal.value > 0 ? (condTotal.value / planTotal.value) * 100 : null)
const maxMois = computed(() => {
  let m = 0
  for (let i = 0; i < 12; i++) m = Math.max(m, planParMois.value[i], fabParMois.value[i], condParMois.value[i])
  return m || 1
})

// --- Par produit ---
const parProduit = computed(() => {
  const m = {}
  const ent = (code, nom) => { if (!m[code]) m[code] = { code, nom, plan: 0, fab: 0, cond: 0, ca: 0 }; return m[code] }
  for (const r of planRows.value) if (Number(r.annee) === anneeSel.value && r.produits) ent(r.produits.code_pf, r.produits.designation).plan += num(r.quantite_planifiee)
  for (const o of ofs.value) {
    if (!o.date_fin_fabrication || new Date(o.date_fin_fabrication).getFullYear() !== anneeSel.value) continue
    if (o.produits) ent(o.produits.code_pf, o.produits.designation).fab += num(o.boites_fabriquees)
  }
  for (const c of condRows.value) {
    if (!c.date_conditionnement || new Date(c.date_conditionnement).getFullYear() !== anneeSel.value) continue
    const p = c.ordres_fabrication && c.ordres_fabrication.produits ? c.ordres_fabrication.produits : null
    if (!p) continue
    const e = ent(p.code_pf, p.designation)
    const b = condBoites(c)
    e.cond += b; e.ca += b * num(p.pcsu)
  }
  return Object.values(m).sort((a, b) => (b.plan - a.plan) || (b.fab - a.fab))
})

const w = (v) => (Math.min(100, (v / maxMois.value) * 100)) + '%'
const fmt = (n) => n == null ? '—' : Number(Math.round(n)).toLocaleString('fr-FR')
const fmtDA = (n) => n == null ? '—' : Number(Math.round(n)).toLocaleString('fr-FR') + ' DA'
const fmtPct = (p) => p == null ? '—' : p.toFixed(1) + ' %'
</script>

<template>
  <div class="rp-page">
    <div class="rp-head">
      <div>
        <h1>Réalisation vs Plan</h1>
        <p class="sub">Fabrication et conditionnement réalisés (boîtes) comparés au plan, et leur valorisation en CA.</p>
      </div>
      <label class="annee-sel">Année
        <select v-model.number="anneeSel">
          <option v-for="a in ANNEES" :key="a" :value="a">{{ a }}</option>
        </select>
      </label>
    </div>

    <p v-if="msg" class="alert">{{ msg }}</p>

    <div class="kpi-grid k4">
      <div class="kpi">
        <div class="kpi-tag plan-tag">Plan</div>
        <div class="kpi-top"><span class="kpi-ic" :style="TINTS.indigo"><svg viewBox="0 0 24 24" v-html="ICONS.target"></svg></span><div class="kpi-val">{{ fmt(planTotal) }}</div></div>
        <div class="kpi-lbl">boîtes · {{ fmtDA(planCA) }}</div>
      </div>
      <div class="kpi">
        <div class="kpi-tag fab-tag">Fabrication réalisée</div>
        <div class="kpi-top"><span class="kpi-ic" :style="TINTS.green"><svg viewBox="0 0 24 24" v-html="ICONS.factory"></svg></span><div class="kpi-val">{{ fmt(fabTotal) }}</div></div>
        <div class="kpi-lbl">{{ fmtPct(pctFab) }} du plan · {{ fmtDA(fabCA) }}</div>
      </div>
      <div class="kpi">
        <div class="kpi-tag cond-tag">Conditionnement réalisé</div>
        <div class="kpi-top"><span class="kpi-ic" :style="TINTS.blue"><svg viewBox="0 0 24 24" v-html="ICONS.box"></svg></span><div class="kpi-val">{{ fmt(condTotal) }}</div></div>
        <div class="kpi-lbl">{{ fmtPct(pctCond) }} du plan · {{ fmtDA(condCA) }}</div>
      </div>
      <div class="kpi">
        <div class="kpi-tag antic-tag">Anticipation N-1</div>
        <div class="kpi-top"><span class="kpi-ic" :style="TINTS.amber"><svg viewBox="0 0 24 24" v-html="ICONS.clock"></svg></span><div class="kpi-val">{{ fmt(anticipTotal) }}</div></div>
        <div class="kpi-lbl">fab. {{ anneeSel - 1 }} → cond. {{ anneeSel }} · {{ fmtDA(anticipCA) }}</div>
      </div>
    </div>
    <p class="note"><strong>Fabrication réalisée</strong> = boîtes fabriquées dans l'année (par date de fabrication). <strong>Conditionnement réalisé</strong> = boîtes conditionnées dans l'année (par date de conditionnement). L'<strong>anticipation</strong> (fab. {{ anneeSel - 1 }} → cond. {{ anneeSel }}) est indiquée à part et <strong>non comptée</strong> dans la fabrication.</p>

    <section class="card">
      <div class="card-head">
        <h3 class="card-title">Comparaison mensuelle (boîtes)</h3>
        <div class="legend">
          <span><i class="dot plan"></i>Plan</span>
          <span><i class="dot fab"></i>Fabrication</span>
          <span><i class="dot cond"></i>Conditionnement</span>
        </div>
      </div>
      <div v-for="(mo, i) in MOIS" :key="i" class="mois-bloc">
        <div class="mois-nom">{{ mo }}</div>
        <div class="series">
          <div class="serie"><div class="bar-track"><div class="bar-fill plan" :style="{ width: w(planParMois[i]) }"></div></div><span class="serie-val">{{ fmt(planParMois[i]) }}</span></div>
          <div class="serie"><div class="bar-track"><div class="bar-fill fab" :style="{ width: w(fabParMois[i]) }"></div></div><span class="serie-val">{{ fmt(fabParMois[i]) }}</span></div>
          <div class="serie"><div class="bar-track"><div class="bar-fill cond" :style="{ width: w(condParMois[i]) }"></div></div><span class="serie-val">{{ fmt(condParMois[i]) }}</span></div>
        </div>
      </div>
    </section>

    <section class="card" style="margin-top: 22px">
      <h3 class="card-title">Détail par produit ({{ parProduit.length }})</h3>
      <div v-if="!parProduit.length" class="empty">Aucune donnée pour {{ anneeSel }}.</div>
      <div v-else class="table-scroll">
        <table class="grid">
          <thead>
            <tr>
              <th class="sticky">Produit</th>
              <th class="ta-r">Plan (bts)</th>
              <th class="ta-r">Fab. réalisée (bts)</th>
              <th class="ta-r">Cond. réalisé (bts)</th>
              <th class="ta-r">% plan (cond.)</th>
              <th class="ta-r">CA cond. réalisé</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in parProduit" :key="p.code">
              <td class="sticky"><span class="mono">{{ p.code }}</span> <span class="desig">{{ p.nom }}</span></td>
              <td class="ta-r">{{ fmt(p.plan) }}</td>
              <td class="ta-r fab-txt">{{ fmt(p.fab) }}</td>
              <td class="ta-r cond-txt">{{ fmt(p.cond) }}</td>
              <td class="ta-r">{{ p.plan > 0 ? ((p.cond / p.plan) * 100).toFixed(0) + ' %' : '—' }}</td>
              <td class="ta-r strong">{{ fmtDA(p.ca) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.rp-page { color: #1b2733; }
.rp-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin: 4px 0 18px; }
.rp-head h1 { margin: 0; font-size: 26px; letter-spacing: -0.01em; }
.sub { margin: 4px 0 0; color: #64748b; font-size: 14px; }
.annee-sel { display: flex; flex-direction: column; font-size: 11px; font-weight: 600; color: #64748b; gap: 4px; text-transform: uppercase; letter-spacing: .03em; }
.annee-sel select { font-size: 14px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; font-weight: 600; color: #1b2733; min-width: 110px; }
.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }

.kpi-grid { display: grid; gap: 14px; margin-bottom: 22px; }
.kpi-grid.k3 { grid-template-columns: repeat(3, 1fr); }
.kpi-grid.k4 { grid-template-columns: repeat(4, 1fr); }
.kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.kpi-tag { display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; padding: 3px 8px; border-radius: 999px; margin-bottom: 8px; }
.plan-tag { background: #f1f5f9; color: #475569; }
.fab-tag { background: #ccfbf1; color: #0f766e; }
.cond-tag { background: #dbeafe; color: #1d4ed8; }
.antic-tag { background: #fef3c7; color: #92400e; }
.kpi-val { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
.kpi-lbl { font-size: 12px; color: #64748b; margin-top: 4px; }
.note { font-size: 12px; color: #475569; margin: -12px 0 22px; background: #fffbeb; border: 1px solid #fde68a; padding: 8px 12px; border-radius: 8px; }

.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.card-title { margin: 0; font-size: 16px; }
.legend { display: flex; gap: 16px; font-size: 12px; color: #475569; }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.dot { width: 11px; height: 11px; border-radius: 3px; display: inline-block; }
.dot.plan, .bar-fill.plan { background: #94a3b8; }
.dot.fab, .bar-fill.fab { background: #0f766e; }
.dot.cond, .bar-fill.cond { background: #2563eb; }

.mois-bloc { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
.mois-bloc:last-child { border-bottom: 0; }
.mois-nom { width: 38px; font-weight: 700; font-size: 13px; color: #475569; flex-shrink: 0; }
.series { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.serie { display: flex; align-items: center; gap: 10px; }
.bar-track { flex: 1; height: 9px; background: #f1f5f9; border-radius: 999px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 999px; min-width: 2px; }
.serie-val { width: 92px; text-align: right; font-size: 12px; font-variant-numeric: tabular-nums; color: #1b2733; flex-shrink: 0; }

.table-scroll { overflow-x: auto; }
table.grid { border-collapse: collapse; font-size: 13px; width: 100%; }
table.grid th { text-align: left; padding: 9px 10px; border-bottom: 2px solid #e2e8f0; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; white-space: nowrap; }
table.grid td { padding: 9px 10px; border-bottom: 1px solid #eef2f6; white-space: nowrap; }
.ta-r { text-align: right; }
.sticky { position: sticky; left: 0; background: #fff; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 600; }
.desig { color: #64748b; }
.fab-txt { color: #0f766e; font-weight: 600; }
.cond-txt { color: #1d4ed8; font-weight: 600; }
.strong { font-weight: 700; }
.empty { color: #94a3b8; font-style: italic; font-size: 13px; }

@media (max-width: 980px) {
  .kpi-grid.k4 { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 760px) {
  .kpi-grid.k3, .kpi-grid.k4 { grid-template-columns: 1fr; }
  .serie-val { width: 70px; }
}
</style>
