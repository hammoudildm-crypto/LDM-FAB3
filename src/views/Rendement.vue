<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { supabase } from '../supabase'

const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

const ofs = ref([])
const conds = ref([])
const erreur = ref('')
const chargement = ref(true)

const anneeSel = ref(new Date().getFullYear())

// Garde-fou : un lot n'est pris en compte que si son rendement reste dans une bande plausible.
// Hors bande -> saisie incomplète (trop bas) ou fiche poids/théorique erronée (trop haut) -> écarté + signalé.
const SEUIL_ANOMALIE = 50   // borne basse (%)
const SEUIL_HAUT = 110      // borne haute (%)
function rdtValide(rdt) { return rdt != null && rdt >= SEUIL_ANOMALIE && rdt <= SEUIL_HAUT }

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
    .select('id, numero_lot, quantite_theorique, date_fin_fabrication, rdt_granulation, rdt_melange, rdt_compression, rdt_pelliculage, produits(code_pf, designation, unites_par_boite)')
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
    if (!rdtValide((p / theo) * 100)) continue
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
    if (theo <= 0) continue
    const p = prod[o.id] || 0
    if (p <= 0) continue   // lot pas encore conditionné -> non pris en compte (ni rendement, ni anomalie)
    arr.push({ of: o, mois: d.getMonth(), prod: p, theo, rdt: (p / theo) * 100 })
  }
  return arr
})

const lotsValides = computed(() => lotsAnnee.value.filter(r => rdtValide(r.rdt)))
const anomalies = computed(() => lotsAnnee.value.filter(r => !rdtValide(r.rdt)).sort((a, b) => a.rdt - b.rdt))

const globalAnnee = computed(() => {
  let prod = 0, theo = 0
  for (const r of lotsValides.value) { prod += r.prod; theo += r.theo }
  return { prod, theo, rdt: theo > 0 ? (prod / theo) * 100 : null }
})

const rendementGlobal = computed(() => globalAnnee.value.rdt)
const tauxDechets = computed(() => globalAnnee.value.rdt == null ? null : Math.max(0, 100 - globalAnnee.value.rdt))
const nbLotsAnnee = computed(() => lotsValides.value.length)

// Taux de déchets mensuel : rendement% + avarie% (= 100 - rendement) par mois
const parMois = computed(() => {
  const a = Array.from({ length: 12 }, () => ({ prod: 0, theo: 0 }))
  for (const r of lotsValides.value) { a[r.mois].prod += r.prod; a[r.mois].theo += r.theo }
  return a.map(m => {
    const rdt = m.theo > 0 ? (m.prod / m.theo) * 100 : null
    return { prod: m.prod, theo: m.theo, rdt, avarie: rdt == null ? null : Math.max(0, 100 - rdt) }
  })
})

// Rendement par produit (année sélectionnée)
const parProduit = computed(() => {
  const m = {}
  for (const r of lotsValides.value) {
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
  for (const r of lotsValides.value) {
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

// Comparaison du rendement par produit sur 3 années (relatives à l'année choisie)
const anneesCompare = computed(() => [anneeSel.value - 2, anneeSel.value - 1, anneeSel.value])
const compareProduits = computed(() => {
  const prodBox = produitParLot.value
  const yset = new Set(anneesCompare.value)
  const m = {}
  for (const o of ofs.value) {
    if (!o.date_fin_fabrication) continue
    const y = new Date(o.date_fin_fabrication).getFullYear()
    if (!yset.has(y)) continue
    const theo = Number(o.quantite_theorique || 0)
    if (theo <= 0) continue
    const p = prodBox[o.id] || 0
    if (p <= 0) continue
    if (!rdtValide((p / theo) * 100)) continue   // garde-fou : lots anormaux exclus
    const code = o.produits ? o.produits.code_pf : '—'
    if (!m[code]) m[code] = { code, nom: o.produits ? o.produits.designation : '—', an: {} }
    if (!m[code].an[y]) m[code].an[y] = { prod: 0, theo: 0 }
    m[code].an[y].prod += p; m[code].an[y].theo += theo
  }
  const recent = anneeSel.value
  return Object.values(m).map(x => {
    const rdt = {}
    for (const y of anneesCompare.value) {
      const a = x.an[y]
      rdt[y] = a && a.theo > 0 ? (a.prod / a.theo) * 100 : null
    }
    const dispo = anneesCompare.value.filter(y => rdt[y] != null)
    const delta = dispo.length >= 2 ? rdt[dispo[dispo.length - 1]] - rdt[dispo[0]] : null
    return { code: x.code, nom: x.nom, rdt, theoRecent: x.an[recent] ? x.an[recent].theo : 0, delta }
  }).filter(x => anneesCompare.value.some(y => x.rdt[y] != null))
    .sort((a, b) => b.theoRecent - a.theoRecent)
})
function hauteurCompare(rdt) {
  if (rdt == null) return 0
  const min = 90, max = 100
  return Math.max(4, Math.min(100, ((rdt - min) / (max - min)) * 100))
}

// Filtre produit pour la comparaison 3 ans
const produitSelCmp = ref('')
const produitsListeCmp = computed(() =>
  compareProduits.value.map(p => ({ code: p.code, nom: p.nom })).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
)
const compareProduitsFiltre = computed(() =>
  produitSelCmp.value ? compareProduits.value.filter(p => p.code === produitSelCmp.value) : compareProduits.value
)

// Rendement par phase + avarie (année sélectionnée, lots valides, pondéré par boîtes théoriques)
const PHASES = [
  { key: 'rdt_granulation', nom: 'Granulation' },
  { key: 'rdt_melange', nom: 'Mélange' },
  { key: 'rdt_compression', nom: 'Compression' },
  { key: 'rdt_pelliculage', nom: 'Pelliculage' }
]
const PHASE_COLORS = ['#0f766e', '#2563eb', '#f59e0b', '#8b5cf6']
const rendementPhases = computed(() =>
  PHASES.map((ph, i) => {
    let wy = 0, w = 0, loss = 0
    for (const r of lotsValides.value) {
      const y = Number(r.of[ph.key])
      if (!y || y <= 0 || y > 1.5) continue
      wy += y * r.theo; w += r.theo
      loss += Math.max(0, 1 - y) * r.theo
    }
    const rdt = w > 0 ? (wy / w) * 100 : null
    return { nom: ph.nom, couleur: PHASE_COLORS[i], rdt, avarie: rdt == null ? null : Math.max(0, 100 - rdt), loss }
  }).filter(x => x.rdt != null)
)
const avarieTotale = computed(() => rendementPhases.value.reduce((s, p) => s + p.loss, 0))
const avariePhases = computed(() => {
  const tot = avarieTotale.value
  return rendementPhases.value.map(p => ({ ...p, part: tot > 0 ? (p.loss / tot) * 100 : 0 }))
})
const donutSegments = computed(() => {
  let cum = 0
  return avariePhases.value.filter(p => p.part > 0).map(p => {
    const seg = { couleur: p.couleur, dash: `${p.part.toFixed(2)} ${(100 - p.part).toFixed(2)}`, offset: (25 - cum).toFixed(2), nom: p.nom, part: p.part }
    cum += p.part
    return seg
  })
})

// Géométrie des graphiques en courbes (SVG)
const CHART = { W: 680, H: 200, padL: 16, padR: 16, padT: 26, padB: 22 }
function segmentsFromPoints(pts, baseY) {
  const segs = []; let cur = []
  for (const p of pts) { if (!p) { if (cur.length) { segs.push(cur); cur = [] } } else cur.push(p) }
  if (cur.length) segs.push(cur)
  return segs.map(seg => ({
    line: seg.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' '),
    area: 'M' + seg[0].x.toFixed(1) + ' ' + baseY.toFixed(1) + ' ' + seg.map(p => 'L' + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ') + ' L' + seg[seg.length - 1].x.toFixed(1) + ' ' + baseY.toFixed(1) + ' Z'
  }))
}
const moisChart = computed(() => {
  const { W, H, padL, padR, padT, padB } = CHART
  const plotW = W - padL - padR, plotH = H - padT - padB, baseY = padT + plotH
  const vals = parMois.value.map(m => (m.rdt == null ? null : m.avarie))
  const maxV = Math.max(2, ...vals.filter(v => v != null)) * 1.3
  const xi = i => padL + (plotW * i) / 11
  const pts = vals.map((v, i) => (v == null ? null : { x: xi(i), y: padT + plotH * (1 - v / maxV), v, i }))
  return { W, H, baseY, padL, padR, pts, segs: segmentsFromPoints(pts, baseY), xi }
})
const anChart = computed(() => {
  const { W, H, padL, padR, padT, padB } = CHART
  const plotW = W - padL - padR, plotH = H - padT - padB, baseY = padT + plotH
  const arr = parAn.value
  const { min, max } = trendBornes.value
  const span = (max - min) || 1
  const xi = i => (arr.length <= 1 ? padL + plotW / 2 : padL + (plotW * i) / (arr.length - 1))
  const pts = arr.map((a, i) => ({ x: xi(i), y: padT + plotH * (1 - (a.rdt - min) / span), an: a.an, rdt: a.rdt }))
  return { W, H, baseY, padL, padR, pts, segs: segmentsFromPoints(pts, baseY) }
})

// Helpers chart mensuel
function segAvarie(m) { return m.rdt == null ? 0 : m.avarie }
function segRdt(m) { return m.rdt == null ? 0 : Math.min(100, m.rdt) }

function fmt(n) { return n == null ? '—' : Math.round(Number(n)).toLocaleString('fr-FR') }
function pct2(n) { return n == null ? '—' : Number(n).toFixed(2).replace('.', ',') + ' %' }
function pct1(n) { return n == null ? '—' : Number(n).toFixed(1).replace('.', ',') + ' %' }

watch(anneeSel, () => { produitSel.value = ''; produitSelCmp.value = '' })

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

      <!-- Lots à vérifier (rendement anormalement bas) -->
      <section v-if="anomalies.length" class="card warn">
        <div class="card-head">
          <h2 class="card-title">⚠ Lots à vérifier — {{ anneeSel }}</h2>
          <span class="count warn-count">{{ anomalies.length }}</span>
        </div>
        <p class="warn-txt">Rendement &lt; {{ SEUIL_ANOMALIE }} % ou &gt; {{ SEUIL_HAUT }} % — saisie incomplète, ou fiche produit (poids / théorique) erronée. Ces lots sont <strong>exclus</strong> des rendements ; vérifie les comprimés fabriqués et la fiche produit. Les lots <strong>pas encore conditionnés</strong> (sans boîtes) ne sont ni comptés ni listés.</p>
        <div class="table-scroll">
          <table class="grid">
            <thead>
              <tr>
                <th>Lot</th><th>Produit</th><th>Fin fab.</th>
                <th class="ta-r">Boîtes théo.</th><th class="ta-r">Boîtes prod.</th><th class="ta-r">Rendement</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in anomalies" :key="r.of.id">
                <td class="mono">{{ r.of.numero_lot }}</td>
                <td><span class="mono">{{ r.of.produits ? r.of.produits.code_pf : '—' }}</span> <span class="desig">{{ r.of.produits ? r.of.produits.designation : '' }}</span></td>
                <td>{{ new Date(r.of.date_fin_fabrication).toLocaleDateString('fr-FR') }}</td>
                <td class="ta-r">{{ fmt(r.theo) }}</td>
                <td class="ta-r">{{ fmt(r.prod) }}</td>
                <td class="ta-r av-num">{{ pct2(r.rdt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Taux de déchets mensuel -->
      <section class="card">
        <div class="card-head">
          <h2 class="card-title">Taux de déchets mensuel — {{ anneeSel }}</h2>
          <div class="legend">
            <span><i class="dot av"></i>Avarie</span>
            <span><i class="dot rdt"></i>Rendement</span>
          </div>
        </div>
        <div class="line-chart">
          <svg :viewBox="`0 0 ${moisChart.W} ${moisChart.H}`" class="lc-svg" role="img">
            <defs>
              <linearGradient id="gradAv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#ef4444" stop-opacity="0.25" />
                <stop offset="100%" stop-color="#ef4444" stop-opacity="0.01" />
              </linearGradient>
            </defs>
            <line :x1="moisChart.padL" :y1="moisChart.baseY" :x2="moisChart.W - moisChart.padR" :y2="moisChart.baseY" stroke="#e5e9f0" stroke-width="1" vector-effect="non-scaling-stroke" />
            <template v-for="(seg, i) in moisChart.segs" :key="'s' + i">
              <path :d="seg.area" fill="url(#gradAv)" />
              <path :d="seg.line" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
            </template>
            <g v-for="(p, idx) in moisChart.pts" :key="'p' + idx">
              <template v-if="p">
                <circle :cx="p.x" :cy="p.y" r="3" fill="#fff" stroke="#ef4444" stroke-width="2.5" vector-effect="non-scaling-stroke" />
                <text :x="p.x" :y="p.y - 7" class="lc-val">{{ p.v.toFixed(1).replace('.', ',') }}</text>
              </template>
            </g>
            <text v-for="(m, i) in MOIS" :key="'l' + i" :x="moisChart.xi(i)" :y="moisChart.H - 4" class="lc-xlabel">{{ m }}</text>
          </svg>
        </div>
        <p class="hint">Taux d'avarie (%) par mois — lots valides. Mois sans fabrication : pas de point.</p>
      </section>

      <!-- Rendement par phase + avarie -->
      <section v-if="rendementPhases.length" class="card">
        <h2 class="card-title">Rendement par phase — {{ anneeSel }}</h2>
        <div class="phase-grid">
          <div class="phase-bars">
            <div v-for="ph in rendementPhases" :key="ph.nom" class="phase-row">
              <span class="phase-nom">{{ ph.nom }}</span>
              <div class="phase-track"><div class="phase-fill" :style="{ width: Math.max(2, Math.min(100, (ph.rdt - 90) / 10 * 100)) + '%', background: ph.couleur }"></div></div>
              <span class="phase-val">{{ pct2(ph.rdt) }}</span>
            </div>
            <p class="hint">Rendement moyen pondéré par boîtes théoriques (lots valides). Échelle 90 → 100 %.</p>
          </div>
          <div class="donut-zone">
            <div class="donut-title">Avarie par phase</div>
            <div class="donut-wrap">
              <svg viewBox="0 0 42 42" class="donut">
                <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#f1f5f9" stroke-width="5" />
                <circle v-for="(seg, i) in donutSegments" :key="i" cx="21" cy="21" r="15.915" fill="transparent"
                  :stroke="seg.couleur" stroke-width="5" :stroke-dasharray="seg.dash" :stroke-dashoffset="seg.offset" stroke-linecap="butt" />
                <text x="21" y="20.5" class="donut-c1">{{ pct2(tauxDechets) }}</text>
                <text x="21" y="24.5" class="donut-c2">avarie globale</text>
              </svg>
            </div>
            <div class="donut-legend">
              <span v-for="p in avariePhases.filter(x => x.part > 0)" :key="p.nom"><i class="dot" :style="{ background: p.couleur }"></i>{{ p.nom }} {{ p.part.toFixed(1) }}%</span>
            </div>
          </div>
        </div>
        <p class="hint">Le donut montre la <strong>part de la perte totale</strong> attribuable à chaque phase (perte = (1 − rendement) × quantité). Calcul réel à partir des Y% du suivi — peut différer du tableau Excel.</p>
      </section>

      <!-- Tendance annuelle -->
      <section class="card">
        <h2 class="card-title">Rendement de fabrication par année</h2>
        <div class="line-chart">
          <svg :viewBox="`0 0 ${anChart.W} ${anChart.H}`" class="lc-svg" role="img">
            <defs>
              <linearGradient id="gradRdt" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#0f766e" stop-opacity="0.22" />
                <stop offset="100%" stop-color="#0f766e" stop-opacity="0.01" />
              </linearGradient>
            </defs>
            <line :x1="anChart.padL" :y1="anChart.baseY" :x2="anChart.W - anChart.padR" :y2="anChart.baseY" stroke="#e5e9f0" stroke-width="1" vector-effect="non-scaling-stroke" />
            <template v-for="(seg, i) in anChart.segs" :key="'s' + i">
              <path :d="seg.area" fill="url(#gradRdt)" />
              <path :d="seg.line" fill="none" stroke="#0f766e" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
            </template>
            <g v-for="(p, idx) in anChart.pts" :key="idx">
              <circle :cx="p.x" :cy="p.y" :r="p.an === anneeSel ? 4.5 : 3.2" :fill="p.an === anneeSel ? '#0f766e' : '#fff'" stroke="#0f766e" stroke-width="2.5" vector-effect="non-scaling-stroke" />
              <text :x="p.x" :y="p.y - 8" class="lc-val">{{ pct2(p.rdt) }}</text>
              <text :x="p.x" :y="anChart.H - 4" class="lc-xlabel">{{ p.an }}</text>
            </g>
          </svg>
        </div>
        <p class="hint">Tendance du rendement global par année. Échelle zoomée ({{ trendBornes.min }} % → {{ trendBornes.max }} %).</p>
      </section>

      <!-- Comparaison du rendement par produit sur 3 ans -->
      <section class="card">
        <div class="card-head">
          <h2 class="card-title">Comparaison du rendement par produit — 3 ans</h2>
          <div class="head-tools">
            <select v-model="produitSelCmp" class="filtre">
              <option value="">Tous les produits ({{ produitsListeCmp.length }})</option>
              <option v-for="p in produitsListeCmp" :key="p.code" :value="p.code">{{ p.code }} — {{ p.nom }}</option>
            </select>
            <div class="legend">
              <span v-for="(y, i) in anneesCompare" :key="y"><i class="dot" :class="'yr' + i"></i>{{ y }}</span>
            </div>
          </div>
        </div>
        <div class="table-scroll">
          <table class="grid">
            <thead>
              <tr>
                <th>Produit</th>
                <th v-for="y in anneesCompare" :key="y" class="ta-c">{{ y }}</th>
                <th class="ta-r">Évolution</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in compareProduitsFiltre" :key="p.code">
                <td><span class="mono">{{ p.code }}</span> <span class="desig">{{ p.nom }}</span></td>
                <td v-for="(y, i) in anneesCompare" :key="y" class="cmp-cell">
                  <template v-if="p.rdt[y] != null">
                    <div class="cmp-val">{{ pct1(p.rdt[y]) }}</div>
                    <div class="cmp-track"><div class="cmp-fill" :class="'yr' + i" :style="{ width: hauteurCompare(p.rdt[y]) + '%' }"></div></div>
                  </template>
                  <span v-else class="cmp-na">—</span>
                </td>
                <td class="ta-r">
                  <span v-if="p.delta != null" class="delta" :class="p.delta >= 0 ? 'up' : 'down'">{{ p.delta >= 0 ? '▲' : '▼' }} {{ Math.abs(p.delta).toFixed(1).replace('.', ',') }} pt</span>
                  <span v-else class="cmp-na">—</span>
                </td>
              </tr>
              <tr v-if="!compareProduitsFiltre.length"><td :colspan="anneesCompare.length + 2" class="empty">Pas de données sur ces 3 années.</td></tr>
            </tbody>
          </table>
        </div>
        <p class="hint">Rendement = boîtes produites ÷ théoriques (lots anormaux exclus). Barres : échelle zoomée 90 → 100 %.</p>
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
.card.warn { border-color: #fde68a; background: #fffbeb; }
.warn-count { background: #fef3c7; color: #92400e; }
.warn-txt { font-size: 13px; color: #92400e; margin: 0 0 14px; line-height: 1.5; }

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

.ta-c { text-align: center; }
.line-chart { width: 100%; margin-top: 4px; }
.lc-svg { width: 100%; height: auto; display: block; overflow: visible; }
.lc-xlabel { font-size: 9px; fill: #94a3b8; text-anchor: middle; }
.lc-val { font-size: 8.5px; font-weight: 700; fill: #475569; text-anchor: middle; }
.phase-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 24px; align-items: start; }
.phase-bars { display: flex; flex-direction: column; gap: 12px; }
.phase-row { display: flex; align-items: center; gap: 12px; }
.phase-nom { width: 110px; font-size: 13px; font-weight: 600; color: #334155; }
.phase-track { flex: 1; height: 12px; background: #f1f5f9; border-radius: 999px; overflow: hidden; }
.phase-fill { height: 100%; border-radius: 999px; min-width: 3px; }
.phase-val { width: 66px; text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; font-size: 13px; }
.donut-zone { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.donut-title { font-size: 13px; font-weight: 600; color: #475569; }
.donut-wrap { width: 180px; }
.donut { width: 100%; height: auto; transform: rotate(0deg); }
.donut-c1 { font-size: 6px; font-weight: 700; fill: #b91c1c; text-anchor: middle; }
.donut-c2 { font-size: 2.6px; fill: #94a3b8; text-anchor: middle; }
.donut-legend { display: flex; flex-wrap: wrap; gap: 8px 14px; justify-content: center; font-size: 12px; color: #475569; }
.donut-legend span { display: inline-flex; align-items: center; gap: 6px; }
@media (max-width: 860px) { .phase-grid { grid-template-columns: 1fr; } }
.dot.yr0 { background: #cbd5e1; }
.dot.yr1 { background: #5eead4; }
.dot.yr2 { background: #0f766e; }
.cmp-cell { min-width: 92px; text-align: center; vertical-align: middle; }
.cmp-val { font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
.cmp-track { height: 5px; background: #f1f5f9; border-radius: 999px; overflow: hidden; margin: 4px auto 0; max-width: 80px; }
.cmp-fill { height: 100%; border-radius: 999px; min-width: 3px; }
.cmp-fill.yr0 { background: #cbd5e1; }
.cmp-fill.yr1 { background: #5eead4; }
.cmp-fill.yr2 { background: #0f766e; }
.cmp-na { color: #cbd5e1; }
.delta.up { color: #15803d; font-weight: 700; }
.delta.down { color: #b91c1c; font-weight: 700; }

@media (max-width: 980px) {
  .kpi-grid.k4 { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 760px) {
  .kpi-grid.k4 { grid-template-columns: 1fr; }
}
</style>
