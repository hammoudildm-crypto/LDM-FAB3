<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../supabase'
import { ICONS, TINTS } from '../icons.js'
import PageHeader from '../components/PageHeader.vue'
import MiniChart from '../components/MiniChart.vue'

const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

const ofs = ref([])
const conds = ref([])
const erreur = ref('')
const chargement = ref(true)
const router = useRouter()
function ouvrirDossier(ordreId) {
  router.push({ path: '/dossier', query: { lot: ordreId } })
}

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
    .select('id, numero_lot, quantite_theorique, boites_fabriquees, date_fin_fabrication, rdt_granulation, rdt_melange, rdt_compression, rdt_pelliculage, produits(code_pf, designation, unites_par_boite, taille_lot)')
    .eq('actif', true))
  if (rof.error) { erreur.value = rof.error.message; chargement.value = false; return }
  ofs.value = rof.data

  const rc = await fetchAllPaged(() => supabase.from('conditionnement')
    .select('ordre_id, quantite_conditionnee, date_conditionnement, date_fin')
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

// Date de conditionnement par lot (dernière session) = date d'attribution mois/année
const condDateParLot = computed(() => {
  const m = {}
  for (const c of conds.value) {
    if (!c.date_conditionnement) continue
    if (!m[c.ordre_id] || c.date_conditionnement > m[c.ordre_id]) m[c.ordre_id] = c.date_conditionnement
  }
  return m
})

// Lots CONDITIONNÉS dans l'année sélectionnée, placés sur le MOIS DE LEUR
// CONDITIONNEMENT (et non sur le mois de fabrication) : même base que le
// tableau de bord et que les KPI annuels du conditionnement.
const lotsAnnee = computed(() => {
  const prod = produitParLot.value
  const dates = condDateParLot.value
  const arr = []
  for (const o of ofs.value) {
    const dc = dates[o.id]
    if (!dc) continue   // lot pas encore conditionné -> non pris en compte
    const d = new Date(dc)
    if (d.getFullYear() !== anneeSel.value) continue
    const theo = Number(o.quantite_theorique || 0)
    if (theo <= 0) continue
    const p = prod[o.id] || 0
    if (p <= 0) continue
    arr.push({ of: o, mois: d.getMonth(), prod: p, theo, rdt: (p / theo) * 100 })
  }
  return arr
})

const lotsValides = computed(() => lotsAnnee.value)
const anomalies = computed(() => lotsAnnee.value.filter(r => !rdtValide(r.rdt)).sort((a, b) => a.rdt - b.rdt))

// --- CONTRÔLE ANTI-OUBLI : lots EXCLUS du calcul (avarie invisible) ---
// Un lot n'entre dans les taux que si théorique > 0 ET boîtes > 0. S'il manque
// une donnée, le lot sort du calcul sans bruit : on le liste ici.
// (Les lots encore EN COURS ne sont pas listés : conditionnement sans date de fin.)
const condFiniParLot = computed(() => {
  const m = {}
  for (const c of conds.value) if (c.date_fin) m[c.ordre_id] = true
  return m
})
const lotsExclus = computed(() => {
  const prod = produitParLot.value
  const dates = condDateParLot.value
  const finis = condFiniParLot.value
  const arr = []
  for (const o of ofs.value) {
    const theo = Number(o.quantite_theorique || 0)
    const upb = upbOf(o)
    const bf = Number(o.boites_fabriquees || 0)
    const dFab = o.date_fin_fabrication
    const fabAnnee = !!dFab && new Date(dFab).getFullYear() === anneeSel.value
    const dc = dates[o.id]
    const condAnnee = !!dc && new Date(dc).getFullYear() === anneeSel.value
    if (!fabAnnee && !condAnnee) continue
    const p = prod[o.id] || 0
    const exFab = fabAnnee && (theo <= 0 || bf <= 0)
    const exCond = condAnnee && (theo <= 0 || upb <= 0 || (p <= 0 && !!finis[o.id]))
    if (!exFab && !exCond) continue
    let cause, cible
    if (theo <= 0) { cause = 'Théorique manquant'; cible = 'of' }
    else if (exCond && upb <= 0) { cause = 'Unités/boîte manquant (fiche produit)'; cible = 'produit' }
    else if (exFab && bf <= 0) { cause = 'Boîtes fabriquées non saisies'; cible = 'of' }
    else { cause = 'Quantité conditionnée non saisie'; cible = 'cond' }
    arr.push({
      id: o.id, lot: o.numero_lot || '—',
      code: o.produits ? o.produits.code_pf : '—',
      desig: o.produits ? o.produits.designation : '',
      taille: o.produits ? o.produits.taille_lot : null,
      cause, cible,
      impact: exFab && exCond ? 'Fab. + Cond.' : (exFab ? 'Fabrication' : 'Conditionnement'),
      date: dc || dFab
    })
  }
  return arr.sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))
    || String(a.lot).localeCompare(String(b.lot), undefined, { numeric: true }))
})
function corrigerExclu(x) {
  if (x.cible === 'produit') router.push({ path: '/referentiels' })
  else if (x.cible === 'cond') router.push({ path: '/conditionnement', query: { lot: x.id } })
  else router.push({ path: '/ordres', query: { edit: x.id } })
}

const globalAnnee = computed(() => {
  let prod = 0, theo = 0
  for (const r of lotsValides.value) { prod += r.prod; theo += r.theo }
  return { prod, theo, rdt: theo > 0 ? (prod / theo) * 100 : null }
})

const rendementGlobal = computed(() => theoCondTotal.value ? (boitesCondTotal.value / theoCondTotal.value) * 100 : null)
const tauxDechets = computed(() => rendementGlobal.value == null ? null : Math.max(0, 100 - rendementGlobal.value))
const nbLotsAnnee = computed(() => lotsValides.value.length)

// --- Structure FABRICATION : boîtes fabriquées / boîtes théoriques ---
// Utilise boites_fabriquees (quantités réelles du classeur). Un lot pas encore
// fabriqué (sans boites_fabriquees) n'est pas compté.
const lotsAnneeFab = computed(() => {
  const arr = []
  for (const o of ofs.value) {
    if (!o.date_fin_fabrication) continue
    const d = new Date(o.date_fin_fabrication)
    if (d.getFullYear() !== anneeSel.value) continue
    const theo = Number(o.quantite_theorique || 0)
    const p = Number(o.boites_fabriquees || 0)
    if (theo <= 0 || p <= 0) continue
    arr.push({ of: o, mois: d.getMonth(), prod: p, theo, rdt: (p / theo) * 100 })
  }
  return arr
})
const lotsValidesFab = computed(() => lotsAnneeFab.value)
const globalAnneeFab = computed(() => {
  let prod = 0, theo = 0
  for (const r of lotsValidesFab.value) { prod += r.prod; theo += r.theo }
  return { prod, theo, rdt: theo > 0 ? (prod / theo) * 100 : null }
})
const rendementFab = computed(() => theoFabTotal.value ? (boitesFabTotal.value / theoFabTotal.value) * 100 : null)
const avarieFab = computed(() => rendementFab.value == null ? null : Math.max(0, 100 - rendementFab.value))
const nbLotsFab = computed(() => lotsValidesFab.value.length)
// Boîtes fabriquées = somme des boîtes des lots fabriqués de l'année (structure par lot,
// alignée sur le théorique pour Boîtes ÷ Théorique = rendement).
const boitesFabTotal = computed(() => lotsAnneeFab.value.reduce((s, r) => s + r.prod, 0))
// Boîtes conditionnées = somme des boîtes TOTALES des lots conditionnés dans l'année
// (alignées sur le théorique pour un rendement correct, sans écrasement par les lots à cheval).
const boitesCondTotal = computed(() => condLotsAnnee.value.reduce((s, r) => s + r.prod, 0))
// Théorique fabrication (mêmes lots que les boîtes) + nb de lots
const theoFabTotal = computed(() => lotsAnneeFab.value.reduce((s, r) => s + r.theo, 0))
const nbLotsFabTotal = computed(() => lotsAnneeFab.value.length)
// Lots conditionnés dans l'année = EXACTEMENT les mêmes que le graphe mensuel
// et le modal (une seule source de vérité pour le conditionnement).
const condLotsAnnee = computed(() => lotsAnnee.value)
const theoCondTotal = computed(() => condLotsAnnee.value.reduce((s, r) => s + r.theo, 0))
const nbLotsCondTotal = computed(() => condLotsAnnee.value.length)

// Fabrication : par mois (rendement/avarie) et par année (tendance)
const parMoisFab = computed(() => {
  const a = Array.from({ length: 12 }, () => ({ prod: 0, theo: 0 }))
  for (const r of lotsValidesFab.value) { a[r.mois].prod += r.prod; a[r.mois].theo += r.theo }
  return a.map(m => {
    const rdt = m.theo > 0 ? (m.prod / m.theo) * 100 : null
    return { prod: m.prod, theo: m.theo, rdt, avarie: rdt == null ? null : Math.max(0, 100 - rdt) }
  })
})
// Détail des déchets d'un mois (clic sur le graphe Taux de déchets) — par barre (fab / cond)
const moisDechets = ref(null) // { mois, serie: 'fab' | 'cond' } | null
function ouvrirMoisDechets(i, si) { moisDechets.value = { mois: i, serie: si === 1 ? 'cond' : 'fab' } }
function ouvrirCorrection(l) { const s = moisDechets.value.serie; moisDechets.value = null; router.push(s === 'cond' ? { path: '/conditionnement', query: { lot: l.id } } : { path: '/suivi', query: { lot: l.id } }) }
const lotsDechetsMois = computed(() => {
  if (!moisDechets.value) return []
  const src = moisDechets.value.serie === 'cond' ? lotsValides.value : lotsValidesFab.value
  return src
    .filter(r => r.mois === moisDechets.value.mois && r.rdt < 100)
    .map(r => ({ id: r.of.id, lot: r.of.numero_lot || '—', code: r.of.produits ? r.of.produits.code_pf : '', desig: r.of.produits ? r.of.produits.designation : '', rdt: r.rdt, avarie: 100 - r.rdt }))
    .sort((a, b) => b.avarie - a.avarie)
})
const avarieMoisSel = computed(() => {
  if (!moisDechets.value) return null
  const arr = moisDechets.value.serie === 'cond' ? avarieCondMois.value : avarieFabMois.value
  return arr[moisDechets.value.mois]
})
const parAnFab = computed(() => {
  const m = {}
  for (const o of ofs.value) {
    if (!o.date_fin_fabrication) continue
    const theo = Number(o.quantite_theorique || 0)
    const p = Number(o.boites_fabriquees || 0)
    if (theo <= 0 || p <= 0) continue
    const y = new Date(o.date_fin_fabrication).getFullYear()
    if (!m[y]) m[y] = { prod: 0, theo: 0 }
    m[y].prod += p; m[y].theo += theo
  }
  return Object.keys(m).map(y => ({ an: +y, rdt: m[y].theo > 0 ? (m[y].prod / m[y].theo) * 100 : null })).sort((a, b) => a.an - b.an)
})

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

// Rendement par produit combiné : Fabrication + Conditionnement (année sélectionnée)
const parProduitCombine = computed(() => {
  const m = {}
  const ligne = (p) => {
    const code = p ? p.code_pf : '—'
    if (!m[code]) m[code] = { code, nom: p ? p.designation : '—', fabProd: 0, fabTheo: 0, condProd: 0, condTheo: 0 }
    return m[code]
  }
  for (const r of lotsValidesFab.value) { const x = ligne(r.of.produits); x.fabProd += r.prod; x.fabTheo += r.theo }
  for (const r of lotsValides.value) { const x = ligne(r.of.produits); x.condProd += r.prod; x.condTheo += r.theo }
  return Object.values(m).map(x => ({
    ...x,
    rdtFab: x.fabTheo > 0 ? (x.fabProd / x.fabTheo) * 100 : null,
    rdtCond: x.condTheo > 0 ? (x.condProd / x.condTheo) * 100 : null
  })).sort((a, b) => (b.fabTheo + b.condTheo) - (a.fabTheo + a.condTheo))
})

// Filtre par produit (section rendement par produit)
const produitSel = ref('')
const produitsListe = computed(() =>
  parProduitCombine.value.map(p => ({ code: p.code, nom: p.nom }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
)
const parProduitCombineFiltre = computed(() =>
  produitSel.value ? parProduitCombine.value.filter(p => p.code === produitSel.value) : parProduitCombine.value
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

// Barre de filtre pour la comparaison 3 ans : recherche + tendance
const rechercheCmp = ref('')
const tendanceCmp = ref('') // '' | 'up' | 'down'
const compareProduitsFiltre = computed(() => {
  const q = rechercheCmp.value.trim().toLowerCase()
  return compareProduits.value.filter(p => {
    if (q && !((p.code || '').toLowerCase().includes(q) || (p.nom || '').toLowerCase().includes(q))) return false
    if (tendanceCmp.value === 'up' && !(p.delta != null && p.delta >= 0)) return false
    if (tendanceCmp.value === 'down' && !(p.delta != null && p.delta < 0)) return false
    return true
  })
})

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
  const valsC = parMois.value.map(m => (m.rdt == null ? null : m.avarie))
  const valsF = parMoisFab.value.map(m => (m.rdt == null ? null : m.avarie))
  const maxV = Math.max(2, ...[...valsC, ...valsF].filter(v => v != null)) * 1.3
  const xi = i => padL + (plotW * i) / 11
  const toPts = vals => vals.map((v, i) => (v == null ? null : { x: xi(i), y: padT + plotH * (1 - v / maxV), v, i }))
  const ptsC = toPts(valsC), ptsF = toPts(valsF)
  return { W, H, baseY, padL, padR, xi,
    ptsC, segsC: segmentsFromPoints(ptsC, baseY),
    ptsF, segsF: segmentsFromPoints(ptsF, baseY) }
})
const anChart = computed(() => {
  const { W, H, padL, padR, padT, padB } = CHART
  const plotW = W - padL - padR, plotH = H - padT - padB, baseY = padT + plotH
  const rc = Object.fromEntries(parAn.value.map(a => [a.an, a.rdt]))
  const rf = Object.fromEntries(parAnFab.value.map(a => [a.an, a.rdt]))
  const years = Array.from(new Set([...Object.keys(rc), ...Object.keys(rf)].map(Number))).sort((a, b) => a - b)
  const allR = [...Object.values(rc), ...Object.values(rf)].filter(v => v != null)
  const min = allR.length ? Math.floor(Math.min(...allR)) - 1 : 90
  const max = allR.length ? Math.ceil(Math.max(...allR)) + 0.5 : 100
  const span = (max - min) || 1
  const xi = i => (years.length <= 1 ? padL + plotW / 2 : padL + (plotW * i) / (years.length - 1))
  const toPts = map => years.map((y, i) => (map[y] == null ? null : { x: xi(i), y: padT + plotH * (1 - (map[y] - min) / span), an: y, rdt: map[y] }))
  const ptsC = toPts(rc), ptsF = toPts(rf)
  return { W, H, baseY, padL, padR, min, max, years, xi,
    ptsC, segsC: segmentsFromPoints(ptsC, baseY),
    ptsF, segsF: segmentsFromPoints(ptsF, baseY) }
})

// Helpers chart mensuel
function segAvarie(m) { return m.rdt == null ? 0 : m.avarie }
function segRdt(m) { return m.rdt == null ? 0 : Math.min(100, m.rdt) }

// Séries brutes pour le composant MiniChart
const avarieFabMois = computed(() => parMoisFab.value.map(m => (m.rdt == null ? null : m.avarie)))
const avarieCondMois = computed(() => parMois.value.map(m => (m.rdt == null ? null : m.avarie)))
const anYears = computed(() => {
  const rc = Object.fromEntries(parAn.value.map(a => [a.an, a.rdt]))
  const rf = Object.fromEntries(parAnFab.value.map(a => [a.an, a.rdt]))
  return Array.from(new Set([...Object.keys(rc), ...Object.keys(rf)].map(Number))).sort((a, b) => a - b)
})
const rdtFabAn = computed(() => { const rf = Object.fromEntries(parAnFab.value.map(a => [a.an, a.rdt])); return anYears.value.map(y => (rf[y] == null ? null : rf[y])) })
const rdtCondAn = computed(() => { const rc = Object.fromEntries(parAn.value.map(a => [a.an, a.rdt])); return anYears.value.map(y => (rc[y] == null ? null : rc[y])) })
const anMin = computed(() => { const all = [...rdtFabAn.value, ...rdtCondAn.value].filter(v => v != null); return all.length ? Math.floor(Math.min(...all)) - 1 : 90 })
const anMax = computed(() => { const all = [...rdtFabAn.value, ...rdtCondAn.value].filter(v => v != null); return all.length ? Math.ceil(Math.max(...all)) + 0.5 : 100 })

function fmt(n) { return n == null ? '—' : Math.round(Number(n)).toLocaleString('fr-FR') }
function pct2(n) { return n == null ? '—' : Number(n).toFixed(2).replace('.', ',') + ' %' }
function pct1(n) { return n == null ? '—' : Number(n).toFixed(1).replace('.', ',') + ' %' }

watch(anneeSel, () => { produitSel.value = ''; rechercheCmp.value = ''; tendanceCmp.value = '' })

onMounted(chargerTout)
</script>

<template>
  <div class="rdt-page">
    <PageHeader title="Rendement quantitatif" tone="indigo"
      subtitle="Fabrication et conditionnement suivis avec les mêmes KPI : rendement, avarie, boîtes produites et théoriques — par mois et par produit.">
      <label class="annee-sel">Année de fabrication
        <select v-model.number="anneeSel">
          <option v-for="a in anneesDispo" :key="a" :value="a">{{ a }}</option>
        </select>
      </label>
    </PageHeader>

    <p v-if="erreur" class="alert">{{ erreur }}</p>
    <p v-if="chargement" class="loading">Chargement des données…</p>

    <template v-else>
      <!-- Deux structures : Fabrication & Conditionnement (mêmes KPI) -->
      <section class="struct">
        <h2 class="struct-title"><span class="struct-badge fab">Fabrication</span><span class="struct-desc">boîtes fabriquées ÷ boîtes théoriques</span></h2>
        <div class="kpi-grid k4">
          <div class="kpi">
            <span class="kpi-tag rdt-tag">Rendement</span>
            <div class="kpi-top"><span class="kpi-ic" :style="TINTS.teal"><svg viewBox="0 0 24 24" v-html="ICONS.gauge"></svg></span><div class="kpi-val accent">{{ pct2(rendementFab) }}</div></div>
            <div class="kpi-lbl">Rendement fabrication {{ anneeSel }}</div>
          </div>
          <div class="kpi">
            <span class="kpi-tag av-tag">Avarie</span>
            <div class="kpi-top"><span class="kpi-ic" :style="TINTS.red"><svg viewBox="0 0 24 24" v-html="ICONS.trash"></svg></span><div class="kpi-val danger">{{ pct2(avarieFab) }}</div></div>
            <div class="kpi-lbl">Taux de déchets {{ anneeSel }}</div>
          </div>
          <div class="kpi">
            <span class="kpi-tag prod-tag">Production</span>
            <div class="kpi-top"><span class="kpi-ic" :style="TINTS.blue"><svg viewBox="0 0 24 24" v-html="ICONS.box"></svg></span><div class="kpi-val">{{ fmt(boitesFabTotal) }}</div></div>
            <div class="kpi-lbl">Boîtes fabriquées</div>
          </div>
          <div class="kpi">
            <span class="kpi-tag theo-tag">Théorique</span>
            <div class="kpi-top"><span class="kpi-ic" :style="TINTS.indigo"><svg viewBox="0 0 24 24" v-html="ICONS.target"></svg></span><div class="kpi-val">{{ fmt(theoFabTotal) }}</div></div>
            <div class="kpi-lbl">Boîtes théoriques · {{ nbLotsFabTotal }} lots</div>
          </div>
        </div>
      </section>

      <section class="struct">
        <h2 class="struct-title"><span class="struct-badge cond">Conditionnement</span><span class="struct-desc">boîtes conditionnées ÷ boîtes théoriques</span></h2>
        <div class="kpi-grid k4">
          <div class="kpi">
            <span class="kpi-tag rdt-tag">Rendement</span>
            <div class="kpi-top"><span class="kpi-ic" :style="TINTS.teal"><svg viewBox="0 0 24 24" v-html="ICONS.gauge"></svg></span><div class="kpi-val accent">{{ pct2(rendementGlobal) }}</div></div>
            <div class="kpi-lbl">Rendement conditionnement {{ anneeSel }}</div>
          </div>
          <div class="kpi">
            <span class="kpi-tag av-tag">Avarie</span>
            <div class="kpi-top"><span class="kpi-ic" :style="TINTS.red"><svg viewBox="0 0 24 24" v-html="ICONS.trash"></svg></span><div class="kpi-val danger">{{ pct2(tauxDechets) }}</div></div>
            <div class="kpi-lbl">Taux de déchets {{ anneeSel }}</div>
          </div>
          <div class="kpi">
            <span class="kpi-tag prod-tag">Production</span>
            <div class="kpi-top"><span class="kpi-ic" :style="TINTS.blue"><svg viewBox="0 0 24 24" v-html="ICONS.box"></svg></span><div class="kpi-val">{{ fmt(boitesCondTotal) }}</div></div>
            <div class="kpi-lbl">Boîtes conditionnées</div>
          </div>
          <div class="kpi">
            <span class="kpi-tag theo-tag">Théorique</span>
            <div class="kpi-top"><span class="kpi-ic" :style="TINTS.indigo"><svg viewBox="0 0 24 24" v-html="ICONS.target"></svg></span><div class="kpi-val">{{ fmt(theoCondTotal) }}</div></div>
            <div class="kpi-lbl">Boîtes théoriques · {{ nbLotsCondTotal }} lots</div>
          </div>
        </div>
      </section>

      <!-- Lots à vérifier (rendement anormalement bas) -->
      <section v-if="lotsExclus.length" class="card warn">
        <div class="card-head">
          <h2 class="card-title">⛔ Lots exclus du calcul — {{ anneeSel }}</h2>
          <span class="count warn-count">{{ lotsExclus.length }}</span>
        </div>
        <p class="warn-txt">Ces lots ne sont comptés dans <strong>aucun taux</strong> : une donnée manque, donc leur avarie est <strong>invisible</strong>. Tant que cette liste n'est pas vide, les rendements et les taux de déchets sont <strong>incomplets</strong>. (Les lots encore en cours ne sont pas listés.)</p>
        <p class="warn-hint">👉 Clique sur <strong>Corriger</strong> pour aller directement à la donnée manquante.</p>
        <div class="table-scroll">
          <table class="grid">
            <thead>
              <tr><th>Lot</th><th>Produit</th><th>Donnée manquante</th><th>Taux impacté</th><th class="ta-r">Taille lot</th><th></th></tr>
            </thead>
            <tbody>
              <tr v-for="x in lotsExclus" :key="x.id + x.cause">
                <td class="mono">{{ x.lot }}</td>
                <td><span class="mono">{{ x.code }}</span> <span class="desig">{{ x.desig }}</span></td>
                <td class="av-num">{{ x.cause }}</td>
                <td>{{ x.impact }}</td>
                <td class="ta-r">{{ x.taille ? fmt(x.taille) : '—' }}</td>
                <td class="ta-r"><button class="excl-btn" @click="corrigerExclu(x)">Corriger ›</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="anomalies.length" class="card warn">
        <div class="card-head">
          <h2 class="card-title">⚠ Lots à vérifier — {{ anneeSel }}</h2>
          <span class="count warn-count">{{ anomalies.length }}</span>
        </div>
        <p class="warn-txt">Rendement &lt; {{ SEUIL_ANOMALIE }} % ou &gt; {{ SEUIL_HAUT }} % — saisie incomplète, ou fiche produit (poids / théorique) erronée. Ces lots restent <strong>inclus</strong> dans le rendement mais sont <strong>à contrôler</strong> (comprimés fabriqués / fiche produit). Les lots <strong>pas encore conditionnés</strong> (sans boîtes) ne sont ni comptés ni listés.</p>
        <p class="warn-hint">👉 Clique sur une ligne pour ouvrir le <strong>dossier du lot</strong> et corriger la saisie ou la fiche produit.</p>
        <div class="table-scroll">
          <table class="grid">
            <thead>
              <tr>
                <th>Lot</th><th>Produit</th><th>Fin fab.</th>
                <th class="ta-r">Boîtes théo.</th><th class="ta-r">Boîtes prod.</th><th class="ta-r">Rendement</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in anomalies" :key="r.of.id" class="row-link" @click="ouvrirDossier(r.of.id)" title="Ouvrir le dossier du lot">
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

      <!-- Taux de déchets mensuel (pleine largeur) -->
      <section class="card">
        <div class="card-head">
          <h2 class="card-title">Taux de déchets mensuel — {{ anneeSel }}</h2>
          <div class="legend">
            <span><i class="dot" style="background:#0f766e"></i>Avarie fabrication</span>
            <span><i class="dot av"></i>Avarie conditionnement</span>
          </div>
        </div>
        <MiniChart :labels="MOIS" :format="pct2" :value-format="v => v == null ? '' : v.toFixed(1).replace('.', ',')" show-values clickable @pick="ouvrirMoisDechets"
          :series="[
            { label: 'Fabrication', color: '#0f766e', data: avarieFabMois },
            { label: 'Conditionnement', color: '#ef4444', data: avarieCondMois }
          ]" />
        <p class="hint">Taux d'avarie (%) par mois — Fabrication (teal) et Conditionnement (rouge). Cliquer un mois pour voir les lots à déchets.</p>
      </section>

      <!-- Graphes en 2 colonnes -->
      <div class="charts-2col">
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
        <div class="card-head">
          <h2 class="card-title">Rendement par année — Fabrication vs Conditionnement</h2>
          <div class="legend">
            <span><i class="dot" style="background:#0f766e"></i>Fabrication</span>
            <span><i class="dot" style="background:#2563eb"></i>Conditionnement</span>
          </div>
        </div>
        <MiniChart :labels="anYears" :format="pct2" :value-format="v => v == null ? '' : v.toFixed(1).replace('.', ',') + '%'" :min="anMin" :max="anMax" show-values :show-switch="false"
          :series="[
            { label: 'Fabrication', color: '#0f766e', data: rdtFabAn },
            { label: 'Conditionnement', color: '#2563eb', data: rdtCondAn }
          ]" />
        <p class="hint">Rendement global par année — Fabrication (teal) vs Conditionnement (bleu). Échelle {{ anChart.min }} % → {{ anChart.max }} %.</p>
      </section>
      </div><!-- /charts-2col -->

      <!-- Comparaison du rendement par produit sur 3 ans -->
      <section class="card">
        <div class="card-head">
          <h2 class="card-title">Comparaison du rendement par produit — 3 ans</h2>
          <div class="head-tools">
            <input v-model="rechercheCmp" type="search" class="filtre" placeholder="Rechercher un produit…" />
            <select v-model="tendanceCmp" class="filtre">
              <option value="">Toutes tendances</option>
              <option value="up">En progression ▲</option>
              <option value="down">En baisse ▼</option>
            </select>
            <span class="count">{{ compareProduitsFiltre.length }}</span>
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
            <span class="count">{{ parProduitCombineFiltre.length }}</span>
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
                <th class="ta-r">Boîtes fab.</th>
                <th>Rendement fab.</th>
                <th class="ta-r">Boîtes cond.</th>
                <th>Rendement cond.</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in parProduitCombineFiltre" :key="p.code">
                <td><span class="mono">{{ p.code }}</span> <span class="desig">{{ p.nom }}</span></td>
                <td class="ta-r">{{ p.fabProd ? fmt(p.fabProd) : '—' }}</td>
                <td>
                  <div class="rdt-cell">
                    <div class="rdt-track"><div class="rdt-fill fab" :class="{ bas: p.rdtFab != null && p.rdtFab < 95 }" :style="{ width: Math.min(100, p.rdtFab || 0) + '%' }"></div></div>
                    <span class="rdt-num">{{ pct2(p.rdtFab) }}</span>
                  </div>
                </td>
                <td class="ta-r">{{ p.condProd ? fmt(p.condProd) : '—' }}</td>
                <td>
                  <div class="rdt-cell">
                    <div class="rdt-track"><div class="rdt-fill cond" :class="{ bas: p.rdtCond != null && p.rdtCond < 95 }" :style="{ width: Math.min(100, p.rdtCond || 0) + '%' }"></div></div>
                    <span class="rdt-num">{{ pct2(p.rdtCond) }}</span>
                  </div>
                </td>
              </tr>
              <tr v-if="!parProduitCombineFiltre.length"><td colspan="5" class="empty">Aucune donnée en {{ anneeSel }}.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <div v-if="moisDechets" class="md-backdrop" @click="moisDechets = null"></div>
    <div v-if="moisDechets" class="md-modal">
      <div class="md-head">
        <span>{{ moisDechets.serie === 'cond' ? 'Conditionnement' : 'Fabrication' }} — déchets {{ MOIS[moisDechets.mois] }} {{ anneeSel }}</span>
        <button class="md-x" @click="moisDechets = null" title="Fermer">✕</button>
      </div>
      <div class="md-sub">{{ lotsDechetsMois.length }} lot(s) · avarie moyenne du mois {{ pct2(avarieMoisSel) }}</div>
      <div class="md-list">
        <table>
          <thead><tr><th>Lot</th><th>Produit</th><th class="num">Rendement</th><th class="num">Avarie</th></tr></thead>
          <tbody>
            <tr v-for="l in lotsDechetsMois" :key="l.id" class="row-link" @click="ouvrirCorrection(l)" title="Corriger ce lot">
              <td class="pf">{{ l.lot }}</td>
              <td>{{ l.code }} — {{ l.desig }}</td>
              <td class="num">{{ pct2(l.rdt) }}</td>
              <td class="num av">{{ pct2(l.avarie) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="!lotsDechetsMois.length" class="empty">Aucun lot avec déchets ce mois.</p>
      </div>
    </div>
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
.struct { margin-bottom: 8px; }
.struct-title { display: flex; align-items: center; gap: 10px; margin: 0 0 12px; font-size: 15px; }
.struct-badge { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; padding: 4px 12px; border-radius: 999px; color: #fff; }
.struct-badge.fab { background: #0f766e; }
.struct-badge.cond { background: #2563eb; }
.struct-desc { font-size: 13px; font-weight: 500; color: #64748b; }
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
.rdt-fill.fab { background: #0f766e; }
.rdt-fill.cond { background: #2563eb; }
.rdt-fill.bas { background: #b91c1c; }
.rdt-num { width: 64px; text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }

.ta-c { text-align: center; }
.charts-2col { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-bottom: 22px; align-items: stretch; }
.charts-2col > .card { margin-bottom: 0; display: flex; flex-direction: column; }
.charts-2col .phase-grid { grid-template-columns: 1fr; gap: 14px; }
.charts-2col .donut-wrap { width: 160px; }
@media (max-width: 820px) { .charts-2col { grid-template-columns: 1fr; } }
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
.warn-hint { font-size: 12px; color: #92400e; margin: 0 0 10px; font-weight: 600; }
.row-link { cursor: pointer; }
.row-link:hover td { background: #fef3c7; }
.row-link .mono { color: #0f766e; }
.row-link:hover .mono { text-decoration: underline; }
.md-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.45); z-index: 70; }
.md-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 560px; max-width: calc(100vw - 32px); max-height: 80vh; display: flex; flex-direction: column; background: #fff; border-radius: 14px; box-shadow: 0 24px 60px rgba(16,24,40,.3); z-index: 71; overflow: hidden; }
.md-head { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; font-size: 15px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #eef2f6; }
.md-x { background: none; border: 0; cursor: pointer; color: #64748b; font-size: 16px; line-height: 1; }
.excl-btn { background: none; border: 0; color: #2563eb; font-weight: 700; cursor: pointer; font-size: 13px; white-space: nowrap; }
.excl-btn:hover { text-decoration: underline; }
.md-sub { padding: 8px 18px; font-size: 12px; color: #64748b; background: #f8fafc; border-bottom: 1px solid #eef2f6; }
.md-list { overflow-y: auto; padding: 6px 12px 14px; }
.md-list table { width: 100%; border-collapse: collapse; }
.md-list th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; padding: 8px; border-bottom: 1px solid #e2e8f0; }
.md-list td { padding: 7px 8px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
.md-list td.num, .md-list th.num { text-align: right; font-variant-numeric: tabular-nums; }
.md-list .pf { font-weight: 700; color: #0f766e; white-space: nowrap; }
.md-list td.av { color: #b91c1c; font-weight: 600; }
</style>
