<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'
import { ICONS, TINTS } from '../icons.js'
import MiniChart from '../components/MiniChart.vue'
import BoutonRapport from '../components/BoutonRapport.vue'

const anneeCourante = new Date().getFullYear()
const moisCourant = new Date().getMonth()
const anneeSel = ref(anneeCourante)
const ongletActif = ref('production')
// Accentuation par onglet : chaque onglet a sa couleur
const ACCENTS = {
  production: { c: '#0f766e', bg: '#f0fdfa' },
  qualite:    { c: '#4338ca', bg: '#eef2ff' },
  finance:    { c: '#b45309', bg: '#fff7ed' },
}
const accentC = computed(() => (ACCENTS[ongletActif.value] || ACCENTS.production).c)
const accentBg = computed(() => (ACCENTS[ongletActif.value] || ACCENTS.production).bg)
const session = ref(null)
const erreur = ref('')

const ANNEES = []
for (let a = anneeCourante - 1; a <= anneeCourante + 5; a++) ANNEES.push(a)
const ONGLETS = [['production', 'Production'], ['qualite', 'Qualité'], ['finance', 'Finance']]
const STATUTS = ['Planifié', 'En cours', 'Terminé', 'Libéré', 'Rejeté']
const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

const nbProduits = ref(0)
const lots = ref([])
const planData = ref([])
const conditionnements = ref([])
const moisSel = ref(null)
function ouvrirMois(mois, type) { moisSel.value = { mois, type } }
const phases = ref([])
const realisations = ref([])

// Charge TOUTES les lignes par pages (Supabase limite à 1000/requête)
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

  const rp = await supabase.from('produits').select('id', { count: 'exact', head: true }).eq('actif', true)
  if (!rp.error) nbProduits.value = rp.count || 0

  const rl = await fetchAllPaged(() => supabase.from('ordres_fabrication')
    .select('id, numero_lot, statut, date_lancement, date_fin_fabrication, quantite_theorique, boites_fabriquees, deviation, en_triage, ddl_verifie, ddl_reserve, ddl_cond_verifie, ddl_cond_reserve, produits(designation, pcsu)')
    .eq('actif', true).order('date_lancement', { ascending: false, nullsFirst: false }).order('id', { ascending: false }))
  if (rl.error) { erreur.value = rl.error.message; return }
  lots.value = rl.data

  const rpp = await fetchAllPaged(() => supabase.from('plan_production').select('annee, quantite_planifiee, produits(code_pf, designation, pcsu)'))
  if (!rpp.error) planData.value = rpp.data

  const rc = await fetchAllPaged(() => supabase.from('conditionnement')
    .select('ordre_id, quantite_entree, quantite_conditionnee, date_conditionnement, ordres_fabrication(numero_lot, date_fin_fabrication, produits(code_pf, designation, unites_par_boite, poids_unitaire_mg, pcsu, boites_theoriques, donneurs_ordre(nom)))')
    .eq('actif', true))
  if (!rc.error) conditionnements.value = rc.data

  const rph = await fetchAllPaged(() => supabase.from('suivi_phases')
    .select('ordre_id, quantite_entree, quantite_sortie, date_phase, id')
    .eq('actif', true).order('date_phase', { ascending: true, nullsFirst: true }).order('id', { ascending: true }))
  if (!rph.error) phases.value = rph.data

  const rr = await fetchAllPaged(() => supabase.from('realisations')
    .select('annee, mois, quantite_realisee, produits(code_pf, designation, pcsu, boites_theoriques, donneurs_ordre(nom))')
    .eq('actif', true))
  if (!rr.error) realisations.value = rr.data
}

// --- Helpers ---
function boitesOf(c) {
  const upb = c.ordres_fabrication && c.ordres_fabrication.produits ? Number(c.ordres_fabrication.produits.unites_par_boite || 0) : 0
  if (c.quantite_conditionnee == null || upb === 0) return 0
  return Math.floor(Number(c.quantite_conditionnee) / upb)
}
function prodDe(c) { return c.ordres_fabrication && c.ordres_fabrication.produits ? c.ordres_fabrication.produits : null }
function pcsuDe(c) { const p = prodDe(c); return p ? Number(p.pcsu || 0) : 0 }
function pcsuR(r) { return r.produits ? Number(r.produits.pcsu || 0) : 0 }
// Code de base = retire les suffixes de variante (-NT, -520, -DN, -NS) pour regrouper le même produit
function baseCode(c) {
  if (!c) return '—'
  let x = String(c), prev = null
  while (prev !== x) { prev = x; x = x.replace(/-(NT|520|DN|NS)$/, '') }
  return x
}
function estCeMois(c) {
  if (!c.date_conditionnement) return false
  const d = new Date(c.date_conditionnement)
  return d.getFullYear() === anneeCourante && d.getMonth() === moisCourant
}

// Conditionnements de l'année sélectionnée
const condAnnee = computed(() => conditionnements.value.filter(c => {
  if (!c.date_conditionnement) return false
  return new Date(c.date_conditionnement).getFullYear() === anneeSel.value
}))

// Réalisations de l'année sélectionnée (source : table realisations)
const realAnnee = computed(() => realisations.value.filter(r => r.annee === anneeSel.value))


// --- Lots (filtrés sur l'année de référence) ---
// Année du lot = année de fin de fabrication si dispo, sinon année de lancement
const anLot = (l) => {
  const d = l.date_fin_fabrication || l.date_lancement
  return d ? new Date(d).getFullYear() : null
}
const lotsAnnee = computed(() => lots.value.filter(l => anLot(l) === anneeSel.value))

// --- Indicateurs qualité BRFT / BRRFT / triage ---
// BRFT = lots produits sans déviation ET non rejetés / lots produits (année).
const brft = computed(() => {
  const prod = lotsAnnee.value.filter(l => ['Terminé', 'Libéré', 'Rejeté'].includes(l.statut))
  if (!prod.length) return null
  const rft = prod.filter(l => l.statut !== 'Rejeté' && !l.deviation).length
  return (rft / prod.length) * 100
})
// BRRFT = dossiers vérifiés (fab + cond) sans réserve / dossiers vérifiés (année).
const brrft = computed(() => {
  let ver = 0, sans = 0
  for (const l of lotsAnnee.value) {
    if (l.ddl_verifie) { ver++; if (!l.ddl_reserve) sans++ }
    if (l.ddl_cond_verifie) { ver++; if (!l.ddl_cond_reserve) sans++ }
  }
  return ver ? (sans / ver) * 100 : null
})
// Lots en triage = instantané (tous les lots actifs cochés « en triage »).
const lotsEnTriage = computed(() => lots.value.filter(l => l.en_triage).length)
function clsQualite(v) { return v == null ? '' : (v >= 95 ? 'q-good' : (v >= 85 ? 'q-mid' : 'q-bad')) }
const modalQualite = ref(null)
const detailBRFT = computed(() => lotsAnnee.value
  .filter(l => ['Terminé', 'Libéré', 'Rejeté'].includes(l.statut) && (l.statut === 'Rejeté' || l.deviation))
  .map(l => ({ lot: l.numero_lot, prod: l.produits ? l.produits.designation : '', v: l.statut === 'Rejeté' ? 'Rejeté' : 'Déviation' }))
  .sort((a, b) => String(a.lot).localeCompare(String(b.lot), undefined, { numeric: true })))
const detailBRRFT = computed(() => {
  const out = []
  for (const l of lotsAnnee.value) {
    if (l.ddl_verifie && l.ddl_reserve) out.push({ lot: l.numero_lot, prod: l.produits ? l.produits.designation : '', v: 'Fabrication' })
    if (l.ddl_cond_verifie && l.ddl_cond_reserve) out.push({ lot: l.numero_lot, prod: l.produits ? l.produits.designation : '', v: 'Conditionnement' })
  }
  return out.sort((a, b) => String(a.lot).localeCompare(String(b.lot), undefined, { numeric: true }))
})
const detailTriage = computed(() => lots.value
  .filter(l => l.en_triage)
  .map(l => ({ lot: l.numero_lot, prod: l.produits ? l.produits.designation : '', v: l.statut }))
  .sort((a, b) => String(a.lot).localeCompare(String(b.lot), undefined, { numeric: true })))
const modalInfo = computed(() => {
  if (modalQualite.value === 'brft') return { titre: 'Lots NON bons du 1er coup', sous: 'rejetés ou avec déviation · ' + anneeSel.value, liste: detailBRFT.value, col3: 'Motif' }
  if (modalQualite.value === 'brrft') return { titre: 'Dossiers avec réserve', sous: 'fabrication ou conditionnement · ' + anneeSel.value, liste: detailBRRFT.value, col3: 'Dossier' }
  if (modalQualite.value === 'triage') return { titre: 'Lots en cours de triage', sous: 'instantané', liste: detailTriage.value, col3: 'Statut' }
  return { titre: '', sous: '', liste: [], col3: '' }
})
const nbLots = computed(() => lotsAnnee.value.length)
const lotsParStatut = computed(() => {
  const m = {}
  for (const s of STATUTS) m[s] = 0
  for (const l of lotsAnnee.value) { if (m[l.statut] != null) m[l.statut]++; else m[l.statut] = 1 }
  return m
})
// Lots en cours = fabrication lancée (date de lancement) mais pas encore conditionnée (statut ≠ Terminé)
const lotsEnCours = computed(() => lotsAnnee.value.filter(l => l.date_lancement && l.statut !== 'Terminé').length)
const lotsLiberes = computed(() => lotsParStatut.value['Libéré'] || 0)
const lotsTermines = computed(() => lotsParStatut.value['Terminé'] || 0)
const tauxLiberation = computed(() => nbLots.value > 0 ? (lotsLiberes.value / nbLots.value) * 100 : null)
const derniersLots = computed(() => lots.value.slice(0, 6))

// --- Plan (année sélectionnée) ---
const planAnnee = computed(() => planData.value.filter(x => x.annee === anneeSel.value))
const planTotal = computed(() => planAnnee.value.reduce((s, x) => s + Number(x.quantite_planifiee || 0), 0))
const caPotentielPlan = computed(() => planAnnee.value.reduce((s, x) => {
  const pcsu = x.produits ? Number(x.produits.pcsu || 0) : 0
  return s + Number(x.quantite_planifiee || 0) * pcsu
}, 0))
// Plan (boîtes) par produit pour l'année sélectionnée
const planParProduit = computed(() => {
  const m = {}
  for (const x of planAnnee.value) {
    const code = baseCode(x.produits ? x.produits.code_pf : '—')
    m[code] = (m[code] || 0) + Number(x.quantite_planifiee || 0)
  }
  return m
})

// --- Volumes (année sélectionnée) — source : module conditionnement (C) ---
const totalBoites = computed(() => condAnnee.value.reduce((s, c) => s + boitesOf(c), 0))
const boitesRestantes = computed(() => Math.max(0, planTotal.value - totalBoites.value))
const boitesCeMois = computed(() => conditionnements.value.filter(c => {
  if (!c.date_conditionnement) return false
  const d = new Date(c.date_conditionnement)
  return d.getFullYear() === anneeCourante && d.getMonth() === moisCourant
}).reduce((s, c) => s + boitesOf(c), 0))

// --- Finance (année sélectionnée) ---
const caRealise = computed(() => condAnnee.value.reduce((s, c) => s + boitesOf(c) * pcsuDe(c), 0))
const caCeMois = computed(() => conditionnements.value.filter(c => {
  if (!c.date_conditionnement) return false
  const d = new Date(c.date_conditionnement)
  return d.getFullYear() === anneeCourante && d.getMonth() === moisCourant
}).reduce((s, c) => s + boitesOf(c) * pcsuDe(c), 0))
const tauxRealisationCA = computed(() => caPotentielPlan.value > 0 ? (caRealise.value / caPotentielPlan.value) * 100 : null)
const prixMoyenBoite = computed(() => totalBoites.value > 0 ? caRealise.value / totalBoites.value : null)
const pctPlanRealise = computed(() => planTotal.value > 0 ? (totalBoites.value / planTotal.value) * 100 : null)

// --- CA par structure : Fabrication (boîtes fabriquées × PCSU) vs Conditionnement (CA réalisé) ---
const caFabrication = computed(() => {
  let s = 0
  for (const l of lotsAnnee.value) {
    const pcsu = l.produits ? Number(l.produits.pcsu || 0) : 0
    s += Number(l.boites_fabriquees || 0) * pcsu
  }
  return s
})
const pctCaFab = computed(() => caPotentielPlan.value > 0 ? (caFabrication.value / caPotentielPlan.value) * 100 : null)
const caResteFab = computed(() => Math.max(0, caPotentielPlan.value - caFabrication.value))
const caResteCond = computed(() => Math.max(0, caPotentielPlan.value - caRealise.value))

// --- Rendements ---
const rendementCndtMoyen = computed(() => {
  let boites = 0, eq = 0
  for (const c of condAnnee.value) {
    const p = prodDe(c)
    if (!p) continue
    const mm = Number(p.poids_unitaire_mg || 0)
    const upb = Number(p.unites_par_boite || 0)
    const kg = Number(c.quantite_entree || 0)
    if (c.quantite_conditionnee == null || Number(c.quantite_conditionnee) <= 0 || kg === 0 || mm === 0 || upb === 0) continue
    boites += Math.floor(Number(c.quantite_conditionnee) / upb)
    eq += (kg * 1e6) / mm / upb
  }
  return eq > 0 ? (boites / eq) * 100 : null
})
const phasesParLot = computed(() => {
  const m = {}
  for (const p of phases.value) { (m[p.ordre_id] = m[p.ordre_id] || []).push(p) }
  return m
})
const rendementFabMoyen = computed(() => {
  let somme = 0, n = 0
  const m = phasesParLot.value
  for (const k in m) {
    let r = 1, c = 0
    for (const p of m[k]) {
      const e = Number(p.quantite_entree || 0), s = p.quantite_sortie
      if (e > 0 && s != null) { r *= Number(s) / e; c++ }
    }
    if (c) { somme += r * 100; n++ }
  }
  return n ? somme / n : null
})
const rendementGlobalMoyen = computed(() => {
  const boxesByLot = {}
  for (const c of condAnnee.value) boxesByLot[c.ordre_id] = (boxesByLot[c.ordre_id] || 0) + boitesOf(c)
  let prod = 0, theo = 0
  for (const l of lots.value) {
    const b = boxesByLot[l.id]
    if (b == null || b <= 0) continue
    const t = Number(l.quantite_theorique || 0)
    if (t <= 0) continue
    prod += b; theo += t
  }
  return theo > 0 ? (prod / theo) * 100 : null
})
const rendementCondParMois = computed(() => {
  const boxes = Array(12).fill(0), eq = Array(12).fill(0)
  for (const c of condAnnee.value) {
    const p = prodDe(c)
    if (!p) continue
    const mm = Number(p.poids_unitaire_mg || 0), upb = Number(p.unites_par_boite || 0), kg = Number(c.quantite_entree || 0)
    if (c.quantite_conditionnee == null || Number(c.quantite_conditionnee) <= 0 || kg === 0 || mm === 0 || upb === 0) continue
    const mo = new Date(c.date_conditionnement).getMonth()
    boxes[mo] += Math.floor(Number(c.quantite_conditionnee) / upb)
    eq[mo] += (kg * 1e6) / mm / upb
  }
  return boxes.map((b, i) => eq[i] > 0 ? (b / eq[i]) * 100 : null)
})

// --- Deux structures Qualité : rendement/avarie = boîtes ÷ théorique ---
// Base = année de fabrication (comme la page Rendement), bande valide 50-110 %.
const RDT_MIN = 50, RDT_MAX = 110
const condBoxByLot = computed(() => {
  const m = {}
  for (const c of conditionnements.value) m[c.ordre_id] = (m[c.ordre_id] || 0) + boitesOf(c)
  return m
})
const structFab = computed(() => {
  let prod = 0, theo = 0, n = 0
  for (const l of lotsAnnee.value) {
    const p = Number(l.boites_fabriquees || 0), t = Number(l.quantite_theorique || 0)
    if (p <= 0 || t <= 0) continue
    const r = (p / t) * 100
    if (r < RDT_MIN || r > RDT_MAX) continue
    prod += p; theo += t; n++
  }
  const rdt = theo > 0 ? (prod / theo) * 100 : null
  return { prod, theo, n, rdt, avarie: rdt == null ? null : Math.max(0, 100 - rdt) }
})
const structCond = computed(() => {
  const byLot = condBoxByLot.value
  let prod = 0, theo = 0, n = 0
  for (const l of lotsAnnee.value) {
    const b = byLot[l.id] || 0, t = Number(l.quantite_theorique || 0)
    if (b <= 0 || t <= 0) continue
    const r = (b / t) * 100
    if (r < RDT_MIN || r > RDT_MAX) continue
    prod += b; theo += t; n++
  }
  const rdt = theo > 0 ? (prod / theo) * 100 : null
  return { prod, theo, n, rdt, avarie: rdt == null ? null : Math.max(0, 100 - rdt) }
})

// Rendement de fabrication par mois (boîtes fabriquées ÷ théoriques, mois de fin de fab)
const rendementFabParMois = computed(() => {
  const prod = Array(12).fill(0), theo = Array(12).fill(0)
  for (const l of lotsAnnee.value) {
    const p = Number(l.boites_fabriquees || 0), t = Number(l.quantite_theorique || 0)
    if (p <= 0 || t <= 0) continue
    const r = (p / t) * 100
    if (r < RDT_MIN || r > RDT_MAX) continue
    const mo = new Date(l.date_fin_fabrication || l.date_lancement).getMonth()
    prod[mo] += p; theo[mo] += t
  }
  return prod.map((v, i) => theo[i] > 0 ? (v / theo[i]) * 100 : null)
})

// --- Vrac en attente (boîtes) : fabrication terminée (date de fin) mais conditionnement pas démarré ---
const vracEnAttente = computed(() => {
  const condIds = new Set()
  for (const c of conditionnements.value) condIds.add(c.ordre_id)
  let t = 0
  for (const l of lots.value) {
    if (!l.date_fin_fabrication) continue
    if (condIds.has(l.id)) continue
    t += Number(l.boites_fabriquees || 0)
  }
  return t
})

// --- Fabrication réalisée (boîtes) = boîtes réellement fabriquées, par date de fin de fabrication ---
// (même définition stricte que « Réalisation vs Plan » : pas de repli théorique)
const fabRealisee = computed(() => {
  let t = 0
  for (const l of lotsAnnee.value) {
    if (!l.date_fin_fabrication || !l.boites_fabriquees) continue
    if (new Date(l.date_fin_fabrication).getFullYear() !== anneeSel.value) continue
    t += Number(l.boites_fabriquees || 0)
  }
  return t
})
const pctPlanFab = computed(() => planTotal.value > 0 ? (fabRealisee.value / planTotal.value) * 100 : null)
const boitesRestantesFab = computed(() => Math.max(0, planTotal.value - fabRealisee.value))

// --- Valorisation en CA de chaque carte (boîtes x PCSU du produit) ---
// Chaque CA est le MIROIR EXACT de sa carte : mêmes lots, mêmes filtres.
function pcsuLot(l) { return l.produits ? Number(l.produits.pcsu || 0) : 0 }
const caFabRealisee = computed(() => {
  let t = 0
  for (const l of lotsAnnee.value) {
    if (!l.date_fin_fabrication || !l.boites_fabriquees) continue
    if (new Date(l.date_fin_fabrication).getFullYear() !== anneeSel.value) continue
    t += Number(l.boites_fabriquees || 0) * pcsuLot(l)
  }
  return t
})
const caVrac = computed(() => {
  const condIds = new Set()
  for (const c of conditionnements.value) condIds.add(c.ordre_id)
  let t = 0
  for (const l of lots.value) {
    if (!l.date_fin_fabrication) continue
    if (condIds.has(l.id)) continue
    t += Number(l.boites_fabriquees || 0) * pcsuLot(l)
  }
  return t
})
const caFabCeMois = computed(() => {
  let t = 0
  for (const l of lots.value) {
    if (!l.date_fin_fabrication || !l.boites_fabriquees) continue
    const d = new Date(l.date_fin_fabrication)
    if (d.getFullYear() === anneeCourante && d.getMonth() === moisCourant) t += Number(l.boites_fabriquees || 0) * pcsuLot(l)
  }
  return t
})
const caResteFabPlan = computed(() => Math.max(0, caPotentielPlan.value - caFabRealisee.value))
const caResteCondPlan = computed(() => Math.max(0, caPotentielPlan.value - caRealise.value))
const fabCeMois = computed(() => {
  let t = 0
  for (const l of lots.value) {
    if (!l.date_fin_fabrication || !l.boites_fabriquees) continue
    const d = new Date(l.date_fin_fabrication)
    if (d.getFullYear() === anneeCourante && d.getMonth() === moisCourant) t += Number(l.boites_fabriquees || 0)
  }
  return t
})

// --- Conditionnement par mois (année) ---
const prodParMois = computed(() => {
  const arr = Array(12).fill(0)
  for (const c of condAnnee.value) arr[new Date(c.date_conditionnement).getMonth()] += boitesOf(c)
  return arr
})
const maxMois = computed(() => Math.max(1, ...prodParMois.value))

// --- Fabrication par mois (boîtes fabriquées, par date de fin de fabrication) ---
const fabParMois = computed(() => {
  const a = Array(12).fill(0)
  for (const l of lotsAnnee.value) {
    if (!l.date_fin_fabrication || !l.boites_fabriquees) continue
    const d = new Date(l.date_fin_fabrication)
    if (d.getFullYear() !== anneeSel.value) continue
    a[d.getMonth()] += Number(l.boites_fabriquees || 0)
  }
  return a
})
const maxFabMois = computed(() => Math.max(1, ...fabParMois.value))
// --- CA par mois (× PCSU) : fabrication et conditionnement ---
const caFabParMois = computed(() => {
  const a = Array(12).fill(0)
  for (const l of lotsAnnee.value) {
    if (!l.date_fin_fabrication || !l.boites_fabriquees) continue
    const d = new Date(l.date_fin_fabrication)
    if (d.getFullYear() !== anneeSel.value) continue
    const pcsu = l.produits ? Number(l.produits.pcsu || 0) : 0
    a[d.getMonth()] += Number(l.boites_fabriquees || 0) * pcsu
  }
  return a
})
const caCondParMois = computed(() => {
  const arr = Array(12).fill(0)
  for (const c of condAnnee.value) arr[new Date(c.date_conditionnement).getMonth()] += boitesOf(c) * pcsuDe(c)
  return arr
})

// --- Top produits / donneurs / réalisation (année) — source : conditionnement ---
const topProduits = computed(() => {
  const m = {}
  for (const c of condAnnee.value) {
    const p = prodDe(c)
    const cle = p ? p.code_pf : '—'
    if (!m[cle]) m[cle] = { nom: p ? p.designation : '(produit inconnu)', boites: 0, ca: 0 }
    const b = boitesOf(c)
    m[cle].boites += b
    m[cle].ca += b * pcsuDe(c)
  }
  return Object.values(m).filter(x => x.boites > 0).sort((a, b) => b.ca - a.ca).slice(0, 5)
})
const caParDonneur = computed(() => {
  const m = {}
  for (const c of condAnnee.value) {
    const p = prodDe(c)
    const nom = p && p.donneurs_ordre ? p.donneurs_ordre.nom : '—'
    if (!m[nom]) m[nom] = { nom, boites: 0, ca: 0 }
    const b = boitesOf(c)
    m[nom].boites += b
    m[nom].ca += b * pcsuDe(c)
  }
  return Object.values(m).filter(x => x.boites > 0).sort((a, b) => b.ca - a.ca)
})
const maxCaDonneur = computed(() => Math.max(1, ...caParDonneur.value.map(d => d.ca)))

// Liste des lots du mois cliqué (fabrication ou conditionnement)
const moisLots = computed(() => {
  if (!moisSel.value) return []
  const { mois, type } = moisSel.value
  if (type === 'fab') {
    return lotsAnnee.value.filter(l => {
      if (!l.date_fin_fabrication || !l.boites_fabriquees) return false
      const d = new Date(l.date_fin_fabrication)
      return d.getFullYear() === anneeSel.value && d.getMonth() === mois
    }).map(l => ({ id: l.id, lot: l.numero_lot || '—', prod: l.produits ? l.produits.designation : '', boites: Number(l.boites_fabriquees || 0) }))
      .sort((a, b) => b.boites - a.boites)
  }
  const m = {}
  for (const c of condAnnee.value) {
    if (!c.date_conditionnement) continue
    const d = new Date(c.date_conditionnement)
    if (d.getFullYear() !== anneeSel.value || d.getMonth() !== mois) continue
    const of = c.ordres_fabrication, p = prodDe(c)
    if (!m[c.ordre_id]) m[c.ordre_id] = { id: c.ordre_id, lot: of ? (of.numero_lot || '—') : '—', prod: p ? p.designation : '', boites: 0 }
    m[c.ordre_id].boites += boitesOf(c)
  }
  return Object.values(m).sort((a, b) => b.boites - a.boites)
})
const moisLotsTotal = computed(() => moisLots.value.reduce((s, l) => s + l.boites, 0))
const realisationPlan = computed(() => {
  const m = {}
  for (const c of condAnnee.value) {
    const p = prodDe(c)
    const code = baseCode(p ? p.code_pf : '—')
    if (!m[code]) m[code] = { code, nom: p ? p.designation : '—', produit: 0 }
    m[code].produit += boitesOf(c)
  }
  const plan = planParProduit.value
  return Object.values(m).filter(x => x.produit > 0)
    .map(x => ({ ...x, cible: plan[x.code] || 0, horsPlan: (plan[x.code] || 0) === 0, pct: (plan[x.code] || 0) > 0 ? (x.produit / plan[x.code]) * 100 : null }))
    .sort((a, b) => b.produit - a.produit).slice(0, 8)
})

function pct(n, total) { return total > 0 ? (n / total) * 100 : 0 }
function fmt(n) { return n == null ? '—' : Number(n).toLocaleString('fr-FR') }
function fmtC(n) {
  if (n == null || isNaN(n)) return '—'
  if (Math.abs(n) >= 1000) return Number(n).toLocaleString('fr-FR', { notation: 'compact', maximumSignificantDigits: 2 })
  return Number(n).toLocaleString('fr-FR')
}
function fmtPct(n) { return n == null ? '—' : Number(n).toFixed(2) + ' %' }
function fmtDA(n) {
  if (n == null) return '—'
  if (n >= 1e6) return (n / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' M DA'
  return Math.round(n).toLocaleString('fr-FR') + ' DA'
}
function classeStatut(s) {
  return { 'Planifié': 'st-plan', 'En cours': 'st-cours', 'Terminé': 'st-fini', 'Libéré': 'st-lib', 'Rejeté': 'st-rej' }[s] || 'st-plan'
}
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('fr-FR') : '—' }

const kpisProd = computed(() => [
  { v: fmt(nbProduits.value),          l: 'Produits actifs',                      tint: TINTS.teal,    ic: ICONS.pill },
  { v: fmt(nbLots.value),              l: 'Lots',                                 tint: TINTS.blue,    ic: ICONS.box },
  { v: fmt(lotsEnCours.value),         l: 'Lots en cours',                        tint: TINTS.amber,   ic: ICONS.clock },
  { v: fmt(fabRealisee.value),         l: 'Fabrication réalisée (bts)',           tint: TINTS.blue,    ic: ICONS.factory },
  { v: fmt(totalBoites.value),         l: 'Conditionnement réalisé (bts)',        tint: TINTS.green,   ic: ICONS.check },
  { v: fmt(vracEnAttente.value),       l: 'Vrac en attente (bts)',                tint: TINTS.orange,  ic: ICONS.hourglass },
  { v: fmt(planTotal.value),           l: 'Plan ' + anneeSel.value + ' (boîtes)', tint: TINTS.indigo,  ic: ICONS.target },
  { v: fmtPct(pctPlanFab.value),        l: 'Plan fab. réalisé',                    tint: TINTS.cyan,    ic: ICONS.percent },
  { v: fmtPct(pctPlanRealise.value),    l: 'Plan cond. réalisé',                   tint: TINTS.emerald, ic: ICONS.percent },
  { v: fmt(boitesRestantesFab.value),  l: 'Restantes fab. (plan)',                tint: TINTS.violet,  ic: ICONS.layers },
  { v: fmt(boitesRestantes.value),     l: 'Restantes cond. (plan)',               tint: TINTS.rose,    ic: ICONS.layers },
  { v: fmt(boitesCeMois.value),        l: 'Boîtes conditionnées ce mois',         tint: TINTS.slate,   ic: ICONS.calendar },
])
const kpisQualite = computed(() => [
  { v: fmt(lotsTermines.value),           l: 'Lots terminés',         tint: TINTS.blue,    ic: ICONS.package },
  { v: fmt(lotsLiberes.value),            l: 'Lots libérés',          tint: TINTS.green,   ic: ICONS.check },
  { v: fmtPct(tauxLiberation.value),      l: 'Taux de libération',    tint: TINTS.emerald, ic: ICONS.percent },
])
const kpisFinance = computed(() => [
  { v: fmtDA(caCeMois.value),           l: 'CA ce mois',                                 tint: TINTS.green,   ic: ICONS.calendar },
  { v: fmtDA(caPotentielPlan.value),    l: 'CA potentiel (plan ' + anneeSel.value + ')', tint: TINTS.indigo,  ic: ICONS.target },
  { v: fmtDA(prixMoyenBoite.value),     l: 'Prix moyen / boîte',                         tint: TINTS.amber,   ic: ICONS.coins },
])

onMounted(async () => {
  const r = await supabase.auth.getSession()
  session.value = r.data ? r.data.session : null
  if (session.value) await charger()
})
</script>

<template>
  <div class="dash">
    <header class="dash-head">
      <div>
        <h1><span class="dash-dot" :style="{ background: accentC }"></span>Tableau de bord</h1>
        <p class="sub">Vue d'ensemble de la production — LDM-FAB3</p>
      </div>
      <div v-if="session" class="dash-actions">
        <BoutonRapport />
        <label class="annee-sel">Année de référence
          <select v-model.number="anneeSel">
            <option v-for="a in ANNEES" :key="a" :value="a">{{ a }}</option>
          </select>
        </label>
      </div>
    </header>

    <div v-if="!session" class="welcome">
      <h2>Bienvenue sur LDM-FAB3</h2>
      <p>Connecte-toi pour accéder au tableau de bord et aux modules de production.</p>
      <RouterLink to="/login" class="btn">Se connecter</RouterLink>
    </div>

    <template v-else>
      <p v-if="erreur" class="alert">{{ erreur }}</p>

      <div class="dash-body" :style="{ '--tab-c': accentC, '--tab-bg': accentBg }">
      <nav class="tabs">
        <button v-for="o in ONGLETS" :key="o[0]" class="tab" :class="{ active: ongletActif === o[0] }" @click="ongletActif = o[0]">{{ o[1] }}</button>
      </nav>

      <div class="tab-content">
      <!-- ====================== PRODUCTION ====================== -->
      <div v-show="ongletActif === 'production'">
        <!-- Deux structures : Fabrication réalisée & Conditionnement réalisé -->
        <h3 class="struct-h"><span class="struct-b fab">Fabrication réalisée</span><span class="struct-d">boîtes fabriquées · {{ anneeSel }}</span></h3>
        <div class="kpi-grid k5">
          <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.blue"><svg viewBox="0 0 24 24" v-html="ICONS.factory"></svg></span><span class="kpi-val accent">{{ fmt(fabRealisee) }}</span></div><div class="kpi-lbl">Fabrication réalisée (bts)</div><div class="kpi-ca">{{ fmtDA(caFabRealisee) }}</div></div>
          <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.cyan"><svg viewBox="0 0 24 24" v-html="ICONS.percent"></svg></span><span class="kpi-val">{{ fmtPct(pctPlanFab) }}</span></div><div class="kpi-lbl">% du plan</div></div>
          <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.violet"><svg viewBox="0 0 24 24" v-html="ICONS.layers"></svg></span><span class="kpi-val">{{ fmt(boitesRestantesFab) }}</span></div><div class="kpi-lbl">Reste / plan</div><div class="kpi-ca">{{ fmtDA(caResteFabPlan) }}</div></div>
          <RouterLink to="/encours?vrac=1" class="kpi kpi-clic vrac-link"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.orange"><svg viewBox="0 0 24 24" v-html="ICONS.hourglass"></svg></span><span class="kpi-val">{{ fmt(vracEnAttente) }}</span></div><div class="kpi-lbl">Vrac en attente (bts) ›</div><div class="kpi-ca">{{ fmtDA(caVrac) }}</div></RouterLink>
          <div class="kpi kpi-clic" @click="ouvrirMois(moisCourant, 'fab')"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.slate"><svg viewBox="0 0 24 24" v-html="ICONS.calendar"></svg></span><span class="kpi-val">{{ fmt(fabCeMois) }}</span></div><div class="kpi-lbl">Fabriquées ce mois ›</div><div class="kpi-ca">{{ fmtDA(caFabCeMois) }}</div></div>
        </div>
        <h3 class="struct-h"><span class="struct-b cond">Conditionnement réalisé</span><span class="struct-d">boîtes conditionnées · {{ anneeSel }}</span></h3>
        <div class="kpi-grid k4">
          <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.green"><svg viewBox="0 0 24 24" v-html="ICONS.check"></svg></span><span class="kpi-val accent">{{ fmt(totalBoites) }}</span></div><div class="kpi-lbl">Conditionnement réalisé (bts)</div><div class="kpi-ca">{{ fmtDA(caRealise) }}</div></div>
          <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.emerald"><svg viewBox="0 0 24 24" v-html="ICONS.percent"></svg></span><span class="kpi-val">{{ fmtPct(pctPlanRealise) }}</span></div><div class="kpi-lbl">% du plan</div></div>
          <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.rose"><svg viewBox="0 0 24 24" v-html="ICONS.layers"></svg></span><span class="kpi-val">{{ fmt(boitesRestantes) }}</span></div><div class="kpi-lbl">Reste / plan</div><div class="kpi-ca">{{ fmtDA(caResteCondPlan) }}</div></div>
          <div class="kpi kpi-clic" @click="ouvrirMois(moisCourant, 'cond')"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.slate"><svg viewBox="0 0 24 24" v-html="ICONS.calendar"></svg></span><span class="kpi-val">{{ fmt(boitesCeMois) }}</span></div><div class="kpi-lbl">Conditionnées ce mois ›</div><div class="kpi-ca">{{ fmtDA(caCeMois) }}</div></div>
        </div>

        <!-- Indicateurs généraux -->
        <div class="kpi-grid k4">
          <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.teal"><svg viewBox="0 0 24 24" v-html="ICONS.pill"></svg></span><span class="kpi-val">{{ fmt(nbProduits) }}</span></div><div class="kpi-lbl">Produits actifs</div></div>
          <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.blue"><svg viewBox="0 0 24 24" v-html="ICONS.box"></svg></span><span class="kpi-val">{{ fmt(nbLots) }}</span></div><div class="kpi-lbl">Lots</div></div>
          <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.amber"><svg viewBox="0 0 24 24" v-html="ICONS.clock"></svg></span><span class="kpi-val">{{ fmt(lotsEnCours) }}</span></div><div class="kpi-lbl">Lots en cours</div></div>
          <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.indigo"><svg viewBox="0 0 24 24" v-html="ICONS.target"></svg></span><span class="kpi-val">{{ fmt(planTotal) }}</span></div><div class="kpi-lbl">Plan {{ anneeSel }} (boîtes)</div><div class="kpi-ca">{{ fmtDA(caPotentielPlan) }}</div></div>
        </div>

        <div class="cols">
          <section class="card">
            <h2 class="card-title">Fabrication {{ anneeSel }} par mois (boîtes)</h2>
            <MiniChart :labels="MOIS" :format="fmt" :value-format="fmtC" show-values clickable @pick="ouvrirMois($event, 'fab')"
              :series="[{ label: 'Fabrication', color: '#0f766e', data: fabParMois }]" />
            <p v-if="!fabRealisee" class="empty">Aucune fabrication en {{ anneeSel }}.</p>
          </section>

          <section class="card">
            <h2 class="card-title">Conditionnement {{ anneeSel }} par mois (boîtes)</h2>
            <MiniChart :labels="MOIS" :format="fmt" :value-format="fmtC" show-values clickable :show-switch="false" spacer @pick="ouvrirMois($event, 'cond')"
              :series="[{ label: 'Conditionnement', color: '#059669', data: prodParMois }]" />
            <p v-if="!totalBoites" class="empty">Aucun conditionnement en {{ anneeSel }}.</p>
          </section>
        </div>

        <h3 class="struct-h"><span class="struct-b qual">Qualité — coup d'œil</span><span class="struct-d">bon du 1er coup &amp; triage · {{ anneeSel }}</span></h3>
        <div class="kpi-grid k3">
          <div class="kpi kpi-clic" @click="modalQualite = 'brft'">
            <div class="kpi-top"><span class="kpi-ic" :style="TINTS.teal"><svg viewBox="0 0 24 24" v-html="ICONS.gauge"></svg></span><span class="kpi-val" :class="clsQualite(brft)">{{ brft != null ? fmtPct(brft) : '—' }}</span></div>
            <div class="kpi-lbl">BRFT — lots bons du 1<sup>er</sup> coup</div>
          </div>
          <div class="kpi kpi-clic" @click="modalQualite = 'brrft'">
            <div class="kpi-top"><span class="kpi-ic" :style="TINTS.indigo"><svg viewBox="0 0 24 24" v-html="ICONS.target"></svg></span><span class="kpi-val" :class="clsQualite(brrft)">{{ brrft != null ? fmtPct(brrft) : '—' }}</span></div>
            <div class="kpi-lbl">BRRFT — dossiers bons du 1<sup>er</sup> coup</div>
          </div>
          <div class="kpi kpi-clic" @click="modalQualite = 'triage'">
            <div class="kpi-top"><span class="kpi-ic" :style="TINTS.blue"><svg viewBox="0 0 24 24" v-html="ICONS.box"></svg></span><span class="kpi-val" :class="lotsEnTriage > 0 ? 'q-warn' : ''">{{ fmt(lotsEnTriage) }}</span></div>
            <div class="kpi-lbl">Lots en cours de triage</div>
          </div>
        </div>

        <section class="card">
          <h2 class="card-title">Réalisation du plan — top produits</h2>
          <div v-for="p in realisationPlan" :key="p.code" class="prog-row">
            <div class="prog-head">
              <span class="prog-nom">{{ p.nom }}</span>
              <span v-if="p.horsPlan" class="hors-plan">Hors plan</span>
              <span v-else class="prog-pct">{{ fmtPct(p.pct) }}</span>
            </div>
            <div class="bar-track"><div class="bar-fill" :class="p.horsPlan ? 'hp' : ((p.pct != null && p.pct >= 100) ? 'st-lib' : 'prod')" :style="{ width: (p.horsPlan ? 100 : Math.min(100, p.pct || 0)) + '%' }"></div></div>
            <div class="prog-sub">
              <template v-if="p.horsPlan">{{ fmt(p.produit) }} boîtes · non planifié</template>
              <template v-else>{{ fmt(p.produit) }} / {{ fmt(p.cible) }} boîtes</template>
            </div>
          </div>
          <p v-if="!realisationPlan.length" class="empty">Aucun conditionnement en {{ anneeSel }}.</p>
        </section>

          <section class="card span2">
            <h2 class="card-title">Derniers lots</h2>
            <table class="mini">
              <tbody>
                <tr v-for="l in derniersLots" :key="l.id">
                  <td class="mono">{{ l.numero_lot }}</td>
                  <td class="desig">{{ l.produits ? l.produits.designation : '—' }}</td>
                  <td>{{ fmtDate(l.date_lancement) }}</td>
                  <td><span class="badge" :class="classeStatut(l.statut)">{{ l.statut }}</span></td>
                </tr>
                <tr v-if="!derniersLots.length"><td colspan="4" class="empty">Aucun lot.</td></tr>
              </tbody>
            </table>
          </section>
      </div>

      <!-- ====================== QUALITÉ ====================== -->
      <div v-show="ongletActif === 'qualite'">
        <!-- Deux structures : Fabrication & Conditionnement (mêmes KPI) -->
        <h3 class="struct-h"><span class="struct-b fab">Fabrication</span><span class="struct-d">boîtes fabriquées ÷ théoriques · {{ anneeSel }}</span></h3>
        <div class="kpi-grid k4">
          <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.teal"><svg viewBox="0 0 24 24" v-html="ICONS.gauge"></svg></span><span class="kpi-val accent">{{ fmtPct(structFab.rdt) }}</span></div><div class="kpi-lbl">Rendement</div></div>
          <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.red"><svg viewBox="0 0 24 24" v-html="ICONS.trash"></svg></span><span class="kpi-val">{{ fmtPct(structFab.avarie) }}</span></div><div class="kpi-lbl">Avarie</div></div>
          <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.blue"><svg viewBox="0 0 24 24" v-html="ICONS.box"></svg></span><span class="kpi-val">{{ fmt(structFab.prod) }}</span></div><div class="kpi-lbl">Boîtes fabriquées</div></div>
          <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.indigo"><svg viewBox="0 0 24 24" v-html="ICONS.target"></svg></span><span class="kpi-val">{{ fmt(structFab.theo) }}</span></div><div class="kpi-lbl">Théoriques · {{ structFab.n }} lots</div></div>
        </div>
        <h3 class="struct-h"><span class="struct-b cond">Conditionnement</span><span class="struct-d">boîtes conditionnées ÷ théoriques · {{ anneeSel }}</span></h3>
        <div class="kpi-grid k4">
          <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.teal"><svg viewBox="0 0 24 24" v-html="ICONS.gauge"></svg></span><span class="kpi-val accent">{{ fmtPct(structCond.rdt) }}</span></div><div class="kpi-lbl">Rendement</div></div>
          <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.red"><svg viewBox="0 0 24 24" v-html="ICONS.trash"></svg></span><span class="kpi-val">{{ fmtPct(structCond.avarie) }}</span></div><div class="kpi-lbl">Avarie</div></div>
          <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.blue"><svg viewBox="0 0 24 24" v-html="ICONS.box"></svg></span><span class="kpi-val">{{ fmt(structCond.prod) }}</span></div><div class="kpi-lbl">Boîtes conditionnées</div></div>
          <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.indigo"><svg viewBox="0 0 24 24" v-html="ICONS.target"></svg></span><span class="kpi-val">{{ fmt(structCond.theo) }}</span></div><div class="kpi-lbl">Théoriques · {{ structCond.n }} lots</div></div>
        </div>

        <!-- Indicateurs qualité -->
        <div class="kpi-grid k3">
          <div class="kpi" v-for="(k, i) in kpisQualite" :key="i">
            <div class="kpi-top">
              <span class="kpi-ic" :style="k.tint"><svg viewBox="0 0 24 24" v-html="k.ic"></svg></span>
              <span class="kpi-val">{{ k.v }}</span>
            </div>
            <div class="kpi-lbl">{{ k.l }}</div>
          </div>
        </div>

        <h3 class="struct-h"><span class="struct-b qual">Bon du premier coup &amp; triage</span><span class="struct-d">indicateurs qualité · {{ anneeSel }}</span></h3>
        <div class="kpi-grid k3">
          <div class="kpi kpi-clic" @click="modalQualite = 'brft'">
            <div class="kpi-top"><span class="kpi-ic" :style="TINTS.teal"><svg viewBox="0 0 24 24" v-html="ICONS.gauge"></svg></span><span class="kpi-val" :class="clsQualite(brft)">{{ brft != null ? fmtPct(brft) : '—' }}</span></div>
            <div class="kpi-lbl">BRFT — lots bons du 1<sup>er</sup> coup</div>
          </div>
          <div class="kpi kpi-clic" @click="modalQualite = 'brrft'">
            <div class="kpi-top"><span class="kpi-ic" :style="TINTS.indigo"><svg viewBox="0 0 24 24" v-html="ICONS.target"></svg></span><span class="kpi-val" :class="clsQualite(brrft)">{{ brrft != null ? fmtPct(brrft) : '—' }}</span></div>
            <div class="kpi-lbl">BRRFT — dossiers bons du 1<sup>er</sup> coup</div>
          </div>
          <div class="kpi kpi-clic" @click="modalQualite = 'triage'">
            <div class="kpi-top"><span class="kpi-ic" :style="TINTS.blue"><svg viewBox="0 0 24 24" v-html="ICONS.box"></svg></span><span class="kpi-val" :class="lotsEnTriage > 0 ? 'q-warn' : ''">{{ fmt(lotsEnTriage) }}</span></div>
            <div class="kpi-lbl">Lots en cours de triage</div>
          </div>
        </div>

        <div class="cols">
          <section class="card">
            <h2 class="card-title">Rendement fabrication par mois — {{ anneeSel }}</h2>
            <MiniChart :labels="MOIS" :format="fmtPct" :value-format="v => v != null ? Math.round(v) + '%' : ''" :max="100" show-values :show-switch="false"
              :series="[{ label: 'Rendement fab.', color: '#4338ca', low: '#dc2626', threshold: 95, data: rendementFabParMois }]" />
            <p v-if="rendementFabParMois.every(v => v == null)" class="empty">Aucune fabrication en {{ anneeSel }}.</p>
          </section>

          <section class="card">
            <h2 class="card-title">Rendement cond. par mois — {{ anneeSel }}</h2>
            <MiniChart :labels="MOIS" :format="fmtPct" :value-format="v => v != null ? Math.round(v) + '%' : ''" :max="100" show-values :show-switch="false"
              :series="[{ label: 'Rendement cond.', color: '#4338ca', low: '#dc2626', threshold: 95, data: rendementCondParMois }]" />
            <p v-if="rendementCondParMois.every(v => v == null)" class="empty">Aucun conditionnement en {{ anneeSel }}.</p>
          </section>
        </div>

        <section class="card">
          <h2 class="card-title">Lots par statut</h2>
          <div v-for="s in STATUTS" :key="s" class="bar-row">
            <span class="bar-lbl"><span class="badge" :class="classeStatut(s)">{{ s }}</span></span>
            <div class="bar-track"><div class="bar-fill" :class="classeStatut(s)" :style="{ width: pct(lotsParStatut[s], nbLots) + '%' }"></div></div>
            <span class="bar-num">{{ lotsParStatut[s] }}</span>
          </div>
          <p v-if="!nbLots" class="empty">Aucun lot pour l'instant.</p>
        </section>
      </div>

      <!-- ====================== FINANCE ====================== -->
      <div v-show="ongletActif === 'finance'">
        <!-- Deux structures : valeur Fabrication & Conditionnement -->
        <h3 class="struct-h"><span class="struct-b fab">Fabrication</span><span class="struct-d">valeur produite (boîtes fabriquées × PCSU) · {{ anneeSel }}</span></h3>
        <div class="kpi-grid k3">
          <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.emerald"><svg viewBox="0 0 24 24" v-html="ICONS.money"></svg></span><span class="kpi-val accent">{{ fmtDA(caFabrication) }}</span></div><div class="kpi-lbl">CA fabrication</div></div>
          <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.teal"><svg viewBox="0 0 24 24" v-html="ICONS.percent"></svg></span><span class="kpi-val">{{ fmtPct(pctCaFab) }}</span></div><div class="kpi-lbl">% du plan CA</div></div>
          <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.violet"><svg viewBox="0 0 24 24" v-html="ICONS.layers"></svg></span><span class="kpi-val">{{ fmtDA(caResteFab) }}</span></div><div class="kpi-lbl">Reste / plan</div></div>
        </div>
        <h3 class="struct-h"><span class="struct-b cond">Conditionnement</span><span class="struct-d">CA réalisé (boîtes conditionnées × PCSU) · {{ anneeSel }}</span></h3>
        <div class="kpi-grid k3">
          <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.emerald"><svg viewBox="0 0 24 24" v-html="ICONS.money"></svg></span><span class="kpi-val accent">{{ fmtDA(caRealise) }}</span></div><div class="kpi-lbl">CA conditionnement</div></div>
          <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.teal"><svg viewBox="0 0 24 24" v-html="ICONS.percent"></svg></span><span class="kpi-val">{{ fmtPct(tauxRealisationCA) }}</span></div><div class="kpi-lbl">% du plan CA</div></div>
          <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.violet"><svg viewBox="0 0 24 24" v-html="ICONS.layers"></svg></span><span class="kpi-val">{{ fmtDA(caResteCond) }}</span></div><div class="kpi-lbl">Reste / plan</div></div>
        </div>

        <!-- Indicateurs financiers généraux -->
        <div class="kpi-grid k3">
          <div class="kpi" v-for="(k, i) in kpisFinance" :key="i">
            <div class="kpi-top">
              <span class="kpi-ic" :style="k.tint"><svg viewBox="0 0 24 24" v-html="k.ic"></svg></span>
              <span class="kpi-val">{{ k.v }}</span>
            </div>
            <div class="kpi-lbl">{{ k.l }}</div>
          </div>
        </div>

        <section class="card">
          <h2 class="card-title">CA par mois {{ anneeSel }} — Fabrication vs Conditionnement (DA)</h2>
          <MiniChart :labels="MOIS" :format="fmtDA" :value-format="fmtC" show-values
            :series="[{ label: 'CA fabrication', color: '#0f766e', data: caFabParMois }, { label: 'CA conditionnement', color: '#059669', data: caCondParMois }]" />
          <p v-if="!caFabrication && !caRealise" class="empty">Aucun CA en {{ anneeSel }}.</p>
        </section>

        <div class="cols">
          <section class="card">
            <h2 class="card-title">Chiffre d'affaires par donneur d'ordre</h2>
            <div v-for="d in caParDonneur" :key="d.nom" class="bar-row">
              <span class="bar-lbl don">{{ d.nom }}</span>
              <div class="bar-track"><div class="bar-fill prod" :style="{ width: (d.ca / maxCaDonneur * 100) + '%' }"></div></div>
              <span class="bar-num ca-num">{{ fmtDA(d.ca) }}</span>
            </div>
            <p v-if="!caParDonneur.length" class="empty">Aucun conditionnement en {{ anneeSel }}.</p>
          </section>

          <section class="card">
            <h2 class="card-title">Top produits — chiffre d'affaires</h2>
            <table class="mini">
              <tbody>
                <tr v-for="(p, i) in topProduits" :key="i">
                  <td class="rank">{{ i + 1 }}</td>
                  <td class="desig">{{ p.nom }}</td>
                  <td class="right">{{ fmt(Math.round(p.boites)) }} bts</td>
                  <td class="right strong">{{ fmtDA(p.ca) }}</td>
                </tr>
                <tr v-if="!topProduits.length"><td colspan="4" class="empty">Aucun conditionnement en {{ anneeSel }}.</td></tr>
              </tbody>
            </table>
          </section>
        </div>
      </div>
      </div>
      </div>
    </template>

    <div v-if="moisSel" class="mois-backdrop" @click="moisSel = null"></div>
    <div v-if="moisSel" class="mois-modal">
      <div class="mois-head">
        <span>{{ moisSel.type === 'fab' ? 'Fabrication' : 'Conditionnement' }} — {{ MOIS[moisSel.mois] }} {{ anneeSel }}</span>
        <button class="mois-x" @click="moisSel = null" title="Fermer">✕</button>
      </div>
      <div class="mois-sub">{{ moisLots.length }} lot(s) · {{ fmt(moisLotsTotal) }} boîtes</div>
      <div class="mois-list">
        <table>
          <thead><tr><th>Lot</th><th>Produit</th><th class="num">Boîtes</th></tr></thead>
          <tbody>
            <tr v-for="l in moisLots" :key="l.id">
              <td class="pf">{{ l.lot }}</td>
              <td>{{ l.prod }}</td>
              <td class="num">{{ fmt(l.boites) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="!moisLots.length" class="empty">Aucun lot pour ce mois.</p>
      </div>
    </div>
    <div v-if="modalQualite" class="modal-overlay" @click="modalQualite = null">
      <div class="q-modal" @click.stop>
        <div class="q-md-head">
          <div><h3>{{ modalInfo.titre }}</h3><span class="q-md-sub">{{ modalInfo.sous }} · {{ modalInfo.liste.length }} lot(s)</span></div>
          <button class="q-md-x" @click="modalQualite = null">✕</button>
        </div>
        <div class="q-md-body">
          <p v-if="!modalInfo.liste.length" class="empty">Aucun lot concerné — tout est bon !</p>
          <table v-else class="grid">
            <thead><tr><th>N° lot</th><th>Produit</th><th>{{ modalInfo.col3 }}</th></tr></thead>
            <tbody>
              <tr v-for="(r, i) in modalInfo.liste" :key="i">
                <td class="q-lot">{{ r.lot }}</td>
                <td>{{ r.prod }}</td>
                <td>{{ r.v }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dash { color: #1b2733; }
.dash-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin: 4px 0 18px; }
.dash-head h1 { margin: 0; font-size: 26px; letter-spacing: -0.01em; }
.dash-head .sub { margin: 4px 0 0; color: #64748b; font-size: 14px; }
.annee-sel { display: flex; flex-direction: column; font-size: 11px; font-weight: 600; color: #64748b; gap: 4px; text-transform: uppercase; letter-spacing: .03em; }
.annee-sel select { font-size: 14px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; font-weight: 600; color: #1b2733; min-width: 110px; }

.welcome { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 40px; text-align: center; }
.welcome h2 { margin: 0 0 8px; font-size: 22px; }
.welcome p { color: #64748b; margin: 0 0 18px; }

.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }

.dash-body { display: flex; flex-direction: column; gap: 16px; align-items: stretch; }
.tabs { display: flex; flex-direction: row; gap: 6px; margin-bottom: 0; min-width: 0; background: #fff; border: 1px solid #e9edf2; border-radius: 12px; padding: 6px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.tab { flex: 1; background: none; border: 0; text-align: center; padding: 11px 13px; font-size: 14px; font-weight: 600; color: #64748b; cursor: pointer; border-radius: 8px; position: relative; transition: color .15s ease, background .15s ease; }
.tab:hover { color: var(--tab-c, #0f766e); background: #f6f8fa; }
.tab.active { color: var(--tab-c, #0f766e); background: var(--tab-bg, #f0fdfa); }
.tab.active::before { content: ""; position: absolute; left: 14px; right: 14px; bottom: 3px; top: auto; height: 2.5px; width: auto; border-radius: 3px; background: var(--tab-c, #0f766e); }
.dash-dot { display: inline-block; width: 12px; height: 12px; border-radius: 4px; margin-right: 10px; vertical-align: middle; transition: background .2s ease; }
html[data-theme="sombre"] .tabs { background: #161f33; border-color: #2a3650; }
html[data-theme="sombre"] .tab { color: #94a3b8; }
html[data-theme="sombre"] .tab:hover { background: #1d2740; }
html[data-theme="sombre"] .tab.active { background: #1d2740 !important; }
.tab-content { flex: 1; min-width: 0; }

.kpi-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; margin-bottom: 14px; }
.kpi-grid:last-of-type { margin-bottom: 22px; }
.kpi-grid.k4 { grid-template-columns: repeat(4, 1fr); }
.kpi-grid.k5 { grid-template-columns: repeat(5, 1fr); }
.kpi-grid.k3 { grid-template-columns: repeat(3, 1fr); }
@media (max-width: 900px) { .kpi-grid.k4, .kpi-grid.k3, .kpi-grid.k5 { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 560px) { .kpi-grid.k4, .kpi-grid.k3, .kpi-grid.k5 { grid-template-columns: 1fr; } }
.struct-h { display: flex; align-items: center; gap: 10px; margin: 6px 0 10px; font-size: 14px; font-weight: 600; }
.struct-b { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; padding: 4px 12px; border-radius: 999px; color: #fff; }
.struct-b.fab { background: #0f766e; }
.struct-b.cond { background: #2563eb; }
.struct-d { font-size: 13px; font-weight: 500; color: #64748b; }
.kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.kpi-val { font-size: 23px; font-weight: 700; letter-spacing: -0.02em; }
.kpi-val.accent { color: #0f766e; }
.kpi-lbl { font-size: 12px; color: #64748b; margin-top: 4px; }
.kpi-ca { font-size: 11.5px; color: #0f766e; font-weight: 700; margin-top: 3px; font-variant-numeric: tabular-nums; }

.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card.span2 { grid-column: 1 / -1; }
.card-title { margin: 0 0 14px; font-size: 16px; }

.bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 3px; }
.bar-lbl { width: 92px; flex-shrink: 0; }
.bar-lbl.mois { width: 38px; font-size: 12px; font-weight: 600; color: #64748b; }
.bar-lbl.don { width: 112px; font-size: 12px; font-weight: 600; color: #475569; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bar-track { flex: 1; height: 13px; background: #eef2f7; border-radius: 999px; overflow: hidden; box-shadow: inset 0 1px 2px rgba(16,24,40,.05); }
.bar-fill { height: 100%; border-radius: 999px; min-width: 3px; box-shadow: inset 0 1px 0 rgba(255,255,255,.3); transition: width .45s cubic-bezier(.4,0,.2,1); }
.bar-fill.st-plan { background: #94a3b8; }
.bar-fill.st-cours { background: #3b82f6; }
.bar-fill.st-fini { background: #14b8a6; }
.bar-fill.st-lib { background: #22c55e; }
.bar-fill.st-rej { background: #ef4444; }
.bar-fill.prod { background: #0f766e; }
.histo { display: flex; align-items: stretch; gap: 4px; height: 170px; padding-top: 20px; }
.histo-col { flex: 1; display: flex; flex-direction: column; align-items: center; min-width: 0; }
.histo-bar-wrap { flex: 1; width: 100%; display: flex; align-items: flex-end; }
.histo-bar { position: relative; width: 100%; border-radius: 5px 5px 2px 2px; min-height: 2px; transition: height .5s cubic-bezier(.4,0,.2,1); box-shadow: inset 0 1px 0 rgba(255,255,255,.25); }
.histo-val { position: absolute; top: -16px; left: 50%; transform: translateX(-50%); font-size: 11px; font-weight: 700; color: #334155; white-space: nowrap; font-variant-numeric: tabular-nums; }
html[data-theme="sombre"] .histo-val, html[data-theme="minuit"] .histo-val { color: #cbd5e1; }
.histo-bar.fab { background: linear-gradient(180deg, #2dd4bf, #0f766e); }
.histo-bar.cond { background: linear-gradient(180deg, #4ade80, #059669); }
.histo-bar.qual { background: linear-gradient(180deg, #818cf8, #4338ca); }
.histo-bar.rej { background: linear-gradient(180deg, #f87171, #dc2626); }
.histo-bar:hover { filter: brightness(1.08); }
.histo-lbl { font-size: 10px; color: #94a3b8; margin-top: 6px; font-weight: 600; }
.histo-col.clic { cursor: pointer; border-radius: 6px; transition: background .15s ease; }
.histo-col.clic:hover { background: rgba(15,118,110,.07); }
.mois-backdrop { position: fixed; inset: 0; background: rgba(15,23,42,.45); z-index: 70; }
.mois-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 520px; max-width: calc(100vw - 32px); max-height: 80vh; display: flex; flex-direction: column; background: #fff; border-radius: 14px; box-shadow: 0 24px 60px rgba(16,24,40,.3); z-index: 71; overflow: hidden; }
.mois-head { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; font-size: 15px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #eef2f6; }
.mois-x { background: none; border: 0; cursor: pointer; color: #64748b; font-size: 16px; line-height: 1; }
.mois-sub { padding: 8px 18px; font-size: 12px; color: #64748b; background: #f8fafc; border-bottom: 1px solid #eef2f6; }
.mois-list { overflow-y: auto; padding: 6px 12px 14px; }
.mois-list table { width: 100%; border-collapse: collapse; }
.mois-list th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; padding: 8px; border-bottom: 1px solid #e2e8f0; }
.mois-list td { padding: 7px 8px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
.mois-list td.num, .mois-list th.num { text-align: right; font-variant-numeric: tabular-nums; }
.mois-list .pf { font-weight: 700; color: #0f766e; white-space: nowrap; }
html[data-theme="sombre"] .mois-modal, html[data-theme="minuit"] .mois-modal { background: #161f33; }
html[data-theme="sombre"] .mois-head, html[data-theme="minuit"] .mois-head { color: #e6edf6; border-bottom-color: #2a3650; }
html[data-theme="sombre"] .mois-sub, html[data-theme="minuit"] .mois-sub { background: #0f1830; border-bottom-color: #2a3650; }
html[data-theme="sombre"] .mois-list td, html[data-theme="minuit"] .mois-list td { border-bottom-color: #1f2940; color: #e6edf6; }
.bar-num { width: 36px; text-align: right; font-weight: 700; font-size: 14px; flex-shrink: 0; }
.bar-num.wide { width: 64px; }
.bar-num.xl { width: 78px; font-size: 13px; }
.bar-num.ca-num { width: auto; min-width: 96px; white-space: nowrap; font-size: 12px; }

.btn { display: inline-block; background: #0f766e; color: #fff; border: 0; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; }
.btn:hover { background: #0c5f59; }

table.mini { width: 100%; border-collapse: collapse; font-size: 13px; }
table.mini td { padding: 3px 6px; border-bottom: 1px solid #eef2f6; white-space: nowrap; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 600; }
.desig { color: #64748b; max-width: 260px; overflow: hidden; text-overflow: ellipsis; }
.right { text-align: right; }
.strong { font-weight: 700; color: #0f766e; }
.rank { width: 22px; text-align: center; font-weight: 700; color: #94a3b8; }
.empty { color: #94a3b8; font-style: italic; font-size: 13px; }

.prog-row { margin-bottom: 5px; }
.prog-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 2px; }
.prog-nom { font-size: 13px; font-weight: 600; color: #1b2733; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 72%; }
.prog-pct { font-size: 13px; font-weight: 700; color: #0f766e; flex-shrink: 0; }
.prog-sub { font-size: 11px; color: #94a3b8; margin-top: 1px; }
.hors-plan { font-size: 11px; font-weight: 700; color: #92400e; background: #fef3c7; padding: 1px 8px; border-radius: 999px; flex-shrink: 0; }
.bar-fill.hp { background: #f59e0b; }

.badge { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; }
.st-plan { background: #f1f5f9; color: #475569; }
.st-cours { background: #dbeafe; color: #1e40af; }
.st-fini { background: #ccfbf1; color: #0f766e; }
.st-lib { background: #dcfce7; color: #166534; }
.st-rej { background: #fee2e2; color: #b91c1c; }

@media (max-width: 900px) {
  .kpi-grid { grid-template-columns: repeat(3, 1fr); }
  .cols { grid-template-columns: 1fr; }
  .card.span2 { grid-column: auto; }
}
@media (max-width: 560px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
}
.kpi-clic { cursor: pointer; transition: border-color .15s, box-shadow .15s; }
.kpi-clic:hover { border-color: #0f766e; box-shadow: 0 2px 12px rgba(15,118,110,.16); }
.vrac-link { text-decoration: none; color: inherit; display: block; }
.dash-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.struct-b.qual { background: #ede9fe; color: #4338ca; }
.q-good { color: #047857 !important; }
.q-mid { color: #b45309 !important; }
.q-bad { color: #b91c1c !important; }
.q-warn { color: #b45309 !important; }
.kpi-clic { cursor: pointer; transition: box-shadow .15s, transform .15s; }
.kpi-clic:hover { box-shadow: 0 4px 14px rgba(0,0,0,.1); transform: translateY(-1px); }
.modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.45); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
.q-modal { background: #fff; border-radius: 14px; width: min(600px, 100%); max-height: 80vh; display: flex; flex-direction: column; box-shadow: 0 20px 50px rgba(0,0,0,.3); }
.q-md-head { display: flex; align-items: flex-start; justify-content: space-between; padding: 14px 18px 10px; gap: 12px; }
.q-md-head h3 { margin: 0; font-size: 16px; }
.q-md-sub { font-size: 12.5px; color: #64748b; }
.q-md-x { background: none; border: 0; font-size: 17px; color: #94a3b8; cursor: pointer; }
.q-md-body { overflow-y: auto; padding: 6px 18px 16px; }
.q-lot { font-family: ui-monospace, monospace; font-weight: 700; white-space: nowrap; }
</style>
