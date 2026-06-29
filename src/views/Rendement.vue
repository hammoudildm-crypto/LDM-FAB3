<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { supabase } from '../supabase'

const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

const ofs = ref([])
const conds = ref([])
const erreur = ref('')
const chargement = ref(true)

const anneeSel = ref(new Date().getFullYear())

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

async function chargerTout() {
  chargement.value = true
  erreur.value = ''
  const rof = await fetchAllPaged(() => supabase.from('ordres_fabrication')
    .select('id, quantite_theorique, date_fin_fabrication, produits(code_pf, designation, unites_par_boite)')
    .eq('actif', true))
  if (rof.error) { erreur.value = rof.error.message; chargement.value = false; return }
  ofs.value = rof.data

  const rc = await fetchAllPaged(() => supabase.from('conditionnement')
    .select('ordre_id, quantite_conditionnee')
    .eq('actif', true))
  if (rc.error) { erreur.value = rc.error.message; chargement.value = false; return }
  conds.value = rc.data
  chargement.value = false
}

function upbOf(o) { return o && o.produits ? Number(o.produits.unites_par_boite || 0) : 0 }

// Boîtes réellement produites par lot (somme des comprimés fabriqués / unités par boîte)
const produitParLot = computed(() => {
  const ofById = {}
  for (const o of ofs.value) ofById[o.id] = o
  const m = {}
  for (const c of conds.value) {
    const o = ofById[c.ordre_id]
    if (!o) continue
    const upb = upbOf(o)
    if (upb <= 0) continue
    const cps = Number(c.quantite_conditionnee || 0)
    if (cps <= 0) continue
    m[c.ordre_id] = (m[c.ordre_id] || 0) + Math.floor(cps / upb)
  }
  return m
})

// Rendement quantitatif par année (boîtes produites / boîtes théoriques), placé sur l'année de fabrication
const parAn = computed(() => {
  const prod = produitParLot.value
  const m = {}
  for (const o of ofs.value) {
    if (!o.date_fin_fabrication) continue
    const theo = Number(o.quantite_theorique || 0)
    const p = prod[o.id] || 0
    if (theo <= 0 || p <= 0) continue
    const y = new Date(o.date_fin_fabrication).getFullYear()
    if (!m[y]) m[y] = { prod: 0, theo: 0 }
    m[y].prod += p; m[y].theo += theo
  }
  return Object.keys(m).map(y => {
    const rdt = m[y].theo > 0 ? (m[y].prod / m[y].theo) * 100 : null
    return { an: +y, prod: m[y].prod, theo: m[y].theo, rdt }
  }).sort((a, b) => a.an - b.an)
})

const anneesDispo = computed(() => {
  const ys = parAn.value.map(x => x.an)
  return ys.length ? ys : [anneeSel.value]
})

// Lots de l'année sélectionnée (fabrication)
const lotsAnnee = computed(() => {
  const prod = produitParLot.value
  const arr = []
  for (const o of ofs.value) {
    if (!o.date_fin_fabrication) continue
    const d = new Date(o.date_fin_fabrication)
    if (d.getFullYear() !== anneeSel.value) continue
    const theo = Number(o.quantite_theorique || 0)
    const p = prod[o.id] || 0
    if (theo <= 0 || p <= 0) continue
    arr.push({ of: o, mois: d.getMonth(), prod: p, theo })
  }
  return arr
})

const globalAnnee = computed(() => {
  let prod = 0, theo = 0
  for (const r of lotsAnnee.value) { prod += r.prod; theo += r.theo }
  return { prod, theo, rdt: theo > 0 ? (prod / theo) * 100 : null }
})

const rendementGlobal = computed(() => globalAnnee.value.rdt)
const tauxDechets = computed(() => globalAnnee.value.rdt == null ? null : Math.max(0, 100 - globalAnnee.value.rdt))
const nbLotsAnnee = computed(() => lotsAnnee.value.length)

// Taux de déchets mensuel : rendement% + avarie% (= 100 - rendement) par mois
const parMois = computed(() => {
  const a = Array.from({ length: 12 }, () => ({ prod: 0, theo: 0 }))
  for (const r of lotsAnnee.value) { a[r.mois].prod += r.prod; a[r.mois].theo += r.theo }
  return a.map(m => {
    const rdt = m.theo > 0 ? (m.prod / m.theo) * 100 : null
    return { prod: m.prod, theo: m.theo, rdt, avarie: rdt == null ? null : Math.max(0, 100 - rdt) }
  })
})

// Rendement par produit (année sélectionnée)
const parProduit = computed(() => {
  const m = {}
  for (const r of lotsAnnee.value) {
    const p = r.of.produits
    const code = p ? p.code_pf : '—'
    if (!m[code]) m[code] = { code, nom: p ? p.designation : '—', prod: 0, theo: 0 }
    m[code].prod += r.prod; m[code].theo += r.theo
  }
  return Object.values(m).map(x => {
    const rdt = x.theo > 0 ? (x.prod / x.theo) * 100 : null
    return { ...x, rdt, avarie: rdt == null ? null : Math.max(0, 100 - rdt) }
  }).sort((a, b) => b.theo - a.theo)
})

// Filtre par produit (section rendement par produit)
const produitSel = ref('')
const produitsListe = computed(() =>
  parProduit.value.map(p => ({ code: p.code, nom: p.nom }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
)
const parProduitFiltre = computed(() =>
  produitSel.value ? parProduit.value.filter(p => p.code === produitSel.value) : parProduit.value
)
const produitNomSel = computed(() => {
  const p = produitsListe.value.find(x => x.code === produitSel.value)
  return p ? p.nom : ''
})
// Détail mensuel du produit sélectionné
const produitMois = computed(() => {
  if (!produitSel.value) return null
  const a = Array.from({ length: 12 }, () => ({ prod: 0, theo: 0 }))
  for (const r of lotsAnnee.value) {
    const p = r.of.produits
    const code = p ? p.code_pf : '—'
    if (code !== produitSel.value) continue
    a[r.mois].prod += r.prod; a[r.mois].theo += r.theo
  }
  return a.map(m => {
    const rdt = m.theo > 0 ? (m.prod / m.theo) * 100 : null
    return { prod: m.prod, theo: m.theo, rdt, avarie: rdt == null ? null : Math.max(0, 100 - rdt) }
  })
})

// Échelle zoomée pour la tendance annuelle (min-1 .. max+0.5)
const trendBornes = computed(() => {
  const vals = parAn.value.map(x => x.rdt).filter(v => v != null)
  if (!vals.length) return { min: 90, max: 100 }
  const min = Math.max(0, Math.floor(Math.min(...vals)) - 1)
  const max = Math.min(100, Math.ceil(Math.max(...vals)) + 1)
  return { min, max: max > min ? max : min + 1 }
})
function hauteurTrend(rdt) {
  if (rdt == null) return 0
  const { min, max } = trendBornes.value
  return Math.max(2, Math.min(100, ((rdt - min) / (max - min)) * 100))
}

// Helpers chart mensuel
function segAvarie(m) { return m.rdt == null ? 0 : m.avarie }
function segRdt(m) { return m.rdt == null ? 0 : Math.min(100, m.rdt) }

function fmt(n) { return n == null ? '—' : Math.round(Number(n)).toLocaleString('fr-FR') }
function pct2(n) { return n == null ? '—' : Number(n).toFixed(2).replace('.', ',') + ' %' }

watch(anneeSel, () => { produitSel.value = '' })

onMounted(chargerTout)
</script>

<template>
  <div class="rdt-page">
    <header class="rdt-head">
      <div>
        <h1>Rendement quantitatif</h1>
        <p class="sub">Boîtes produites ÷ boîtes théoriques, et taux de déchets (avarie) — par mois et par produit.</p>
      </div>
      <label class="annee-sel">Année de fabrication
        <select v-model.number="anneeSel">
          <option v-for="a in anneesDispo" :key="a" :value="a">{{ a }}</option>
        </select>
      </label>
    </header>

    <p v-if="erreur" class="alert">{{ erreur }}</p>
    <p v-if="chargement" class="loading">Chargement des données…</p>

    <template v-else>
      <!-- KPIs -->
      <div class="kpi-grid k4">
        <div class="kpi">
          <span class="kpi-tag rdt-tag">Rendement</span>
          <div class="kpi-val accent">{{ pct2(rendementGlobal) }}</div>
          <div class="kpi-lbl">Rendement global {{ anneeSel }}</div>
        </div>
        <div class="kpi">
          <span class="kpi-tag av-tag">Avarie</span>
          <div class="kpi-val danger">{{ pct2(tauxDechets) }}</div>
          <div class="kpi-lbl">Taux de déchets {{ anneeSel }}</div>
        </div>
        <div class="kpi">
          <span class="kpi-tag prod-tag">Production</span>
          <div class="kpi-val">{{ fmt(globalAnnee.prod) }}</div>
          <div class="kpi-lbl">Boîtes produites</div>
        </div>
        <div class="kpi">
          <span class="kpi-tag theo-tag">Théorique</span>
          <div class="kpi-val">{{ fmt(globalAnnee.theo) }}</div>
          <div class="kpi-lbl">Boîtes théoriques · {{ nbLotsAnnee }} lots</div>
        </div>
      </div>

      <!-- Taux de déchets mensuel -->
      <section class="card">
        <div class="card-head">
          <h2 class="card-title">Taux de déchets mensuel — {{ anneeSel }}</h2>
          <div class="legend">
            <span><i class="dot av"></i>Avarie</span>
            <span><i class="dot rdt"></i>Rendement</span>
          </div>
        </div>
        <div class="months">
          <div v-for="(m, i) in parMois" :key="i" class="mcol">
            <div class="mavarie" :class="{ none: m.rdt == null }">{{ m.rdt == null ? '0,00 %' : pct2(m.avarie) }}</div>
            <div class="mbar">
              <div class="seg av" :style="{ height: segAvarie(m) + '%' }"></div>
              <div class="seg rdt" :style="{ height: segRdt(m) + '%' }">
                <span v-if="m.rdt != null" class="seg-lbl">{{ pct2(m.rdt) }}</span>
              </div>
            </div>
            <div class="mname">{{ MOIS[i] }}</div>
          </div>
        </div>
        <p class="hint">Chaque barre = 100 % (rendement + avarie). Mois sans fabrication : barre vide.</p>
      </section>

      <!-- Tendance annuelle -->
      <section class="card">
        <h2 class="card-title">Rendement de fabrication par année</h2>
        <div class="years">
          <div v-for="y in parAn" :key="y.an" class="ycol">
            <div class="yval">{{ pct2(y.rdt) }}</div>
            <div class="ybar-zone">
              <div class="ybar" :class="{ cur: y.an === anneeSel }" :style="{ height: hauteurTrend(y.rdt) + '%' }"></div>
            </div>
            <div class="yname">{{ y.an }}</div>
          </div>
        </div>
        <p class="hint">Échelle zoomée ({{ trendBornes.min }} % → {{ trendBornes.max }} %) pour visualiser les écarts.</p>
      </section>

      <!-- Rendement par produit -->
      <section class="card">
        <div class="card-head">
          <h2 class="card-title">Rendement par produit — {{ anneeSel }}</h2>
          <div class="head-tools">
            <select v-model="produitSel" class="filtre">
              <option value="">Tous les produits ({{ produitsListe.length }})</option>
              <option v-for="p in produitsListe" :key="p.code" :value="p.code">{{ p.code }} — {{ p.nom }}</option>
            </select>
            <span class="count">{{ parProduitFiltre.length }}</span>
          </div>
        </div>

        <div v-if="produitSel && produitMois" class="prod-detail">
          <div class="pd-title">Détail mensuel — <strong>{{ produitNomSel }}</strong> ({{ produitSel }})</div>
          <div class="months compact">
            <div v-for="(m, i) in produitMois" :key="i" class="mcol">
              <div class="mavarie" :class="{ none: m.rdt == null }">{{ m.rdt == null ? '—' : pct2(m.avarie) }}</div>
              <div class="mbar">
                <div class="seg av" :style="{ height: segAvarie(m) + '%' }"></div>
                <div class="seg rdt" :style="{ height: segRdt(m) + '%' }"></div>
              </div>
              <div class="mname">{{ MOIS[i] }}</div>
            </div>
          </div>
        </div>

        <div class="table-scroll">
          <table class="grid">
            <thead>
              <tr>
                <th>Produit</th>
                <th class="ta-r">Boîtes théo.</th>
                <th class="ta-r">Boîtes prod.</th>
                <th>Rendement</th>
                <th class="ta-r">Avarie</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in parProduitFiltre" :key="p.code">
                <td><span class="mono">{{ p.code }}</span> <span class="desig">{{ p.nom }}</span></td>
                <td class="ta-r">{{ fmt(p.theo) }}</td>
                <td class="ta-r">{{ fmt(p.prod) }}</td>
                <td>
                  <div class="rdt-cell">
                    <div class="rdt-track"><div class="rdt-fill" :class="{ bas: p.rdt != null && p.rdt < 95 }" :style="{ width: Math.min(100, p.rdt || 0) + '%' }"></div></div>
                    <span class="rdt-num">{{ pct2(p.rdt) }}</span>
                  </div>
                </td>
                <td class="ta-r" :class="{ 'av-num': p.avarie != null && p.avarie > 5 }">{{ pct2(p.avarie) }}</td>
              </tr>
              <tr v-if="!parProduitFiltre.length"><td colspan="5" class="empty">Aucune fabrication en {{ anneeSel }}.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.rdt-page { color: #1b2733; }
.rdt-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin: 4px 0 18px; }
.rdt-head h1 { margin: 0; font-size: 26px; letter-spacing: -0.01em; }
.sub { margin: 4px 0 0; color: #64748b; font-size: 14px; }
.annee-sel { display: flex; flex-direction: column; font-size: 11px; font-weight: 600; color: #64748b; gap: 4px; text-transform: uppercase; letter-spacing: .03em; }
.annee-sel select { font-size: 14px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; font-weight: 600; color: #1b2733; min-width: 110px; }
.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }
.loading { color: #64748b; font-size: 14px; padding: 8px 2px; }

.kpi-grid { display: grid; gap: 14px; margin-bottom: 22px; }
.kpi-grid.k4 { grid-template-columns: repeat(4, 1fr); }
.kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.kpi-tag { display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; padding: 3px 8px; border-radius: 999px; margin-bottom: 8px; }
.rdt-tag { background: #ccfbf1; color: #0f766e; }
.av-tag { background: #fee2e2; color: #b91c1c; }
.prod-tag { background: #dbeafe; color: #1d4ed8; }
.theo-tag { background: #f1f5f9; color: #475569; }
.kpi-val { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
.kpi-val.accent { color: #0f766e; }
.kpi-val.danger { color: #b91c1c; }
.kpi-lbl { font-size: 12px; color: #64748b; margin-top: 4px; }

.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; box-shadow: 0 1px 2px rgba(16,24,40,.04); margin-bottom: 22px; }
.card-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.card-title { margin: 0 0 14px; font-size: 16px; }
.card-head .card-title { margin: 0; }
.count { background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 600; padding: 2px 9px; border-radius: 999px; }
.legend { display: flex; gap: 16px; font-size: 12px; color: #475569; }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.dot { width: 11px; height: 11px; border-radius: 3px; display: inline-block; }
.dot.av { background: #ef4444; }
.dot.rdt { background: #0f766e; }
.hint { font-size: 12px; color: #94a3b8; margin: 12px 0 0; }

/* Chart mensuel — barres verticales empilées */
.months { display: flex; gap: 8px; align-items: flex-end; padding-top: 6px; overflow-x: auto; }
.mcol { flex: 1; min-width: 52px; display: flex; flex-direction: column; align-items: center; gap: 5px; }
.mavarie { font-size: 11px; font-weight: 700; color: #b91c1c; }
.mavarie.none { color: #cbd5e1; }
.mbar { width: 38px; height: 190px; background: #f8fafc; border: 1px solid #eef2f6; border-radius: 6px; overflow: hidden; display: flex; flex-direction: column; }
.seg { width: 100%; }
.seg.av { background: #ef4444; }
.seg.rdt { background: #0f766e; display: flex; align-items: flex-start; justify-content: center; }
.seg-lbl { font-size: 10px; font-weight: 700; color: #fff; margin-top: 5px; transform: rotate(-90deg); transform-origin: center; white-space: nowrap; }
.mname { font-size: 12px; font-weight: 600; color: #475569; }

/* Tendance annuelle */
.years { display: flex; gap: 18px; align-items: flex-end; padding-top: 6px; }
.ycol { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 64px; }
.yval { font-size: 12px; font-weight: 700; color: #0f766e; }
.ybar-zone { height: 130px; width: 46px; display: flex; align-items: flex-end; }
.ybar { width: 100%; background: #5eead4; border-radius: 6px 6px 0 0; min-height: 3px; }
.ybar.cur { background: #0f766e; }
.yname { font-size: 12px; font-weight: 600; color: #475569; }

/* Table produits */
.table-scroll { overflow-x: auto; }
table.grid { border-collapse: collapse; font-size: 13px; width: 100%; }
table.grid th { text-align: left; padding: 9px 10px; border-bottom: 2px solid #e2e8f0; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; white-space: nowrap; }
table.grid td { padding: 9px 10px; border-bottom: 1px solid #eef2f6; white-space: nowrap; }
.ta-r { text-align: right; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 600; }
.desig { color: #64748b; }
.empty { color: #94a3b8; font-style: italic; text-align: center; padding: 16px; }
.av-num { color: #b91c1c; font-weight: 700; }

.head-tools { display: flex; align-items: center; gap: 10px; }
.filtre { font-size: 13px; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; max-width: 340px; }
.filtre:focus { outline: 2px solid #0f766e; border-color: #0f766e; }
.prod-detail { background: #f8fafc; border: 1px solid #eef2f6; border-radius: 10px; padding: 14px 14px 16px; margin-bottom: 16px; }
.pd-title { font-size: 13px; color: #475569; margin-bottom: 12px; }
.months.compact .mbar { height: 120px; width: 30px; }
.months.compact .mavarie { font-size: 10px; }
.months.compact .mcol { min-width: 44px; }

.rdt-cell { display: flex; align-items: center; gap: 10px; min-width: 200px; }
.rdt-track { flex: 1; height: 9px; background: #f1f5f9; border-radius: 999px; overflow: hidden; }
.rdt-fill { height: 100%; background: #0f766e; border-radius: 999px; min-width: 2px; }
.rdt-fill.bas { background: #b91c1c; }
.rdt-num { width: 64px; text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }

@media (max-width: 980px) {
  .kpi-grid.k4 { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 760px) {
  .kpi-grid.k4 { grid-template-columns: 1fr; }
}
</style>
