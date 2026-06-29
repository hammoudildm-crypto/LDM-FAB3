<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'

const anneeCourante = new Date().getFullYear()
const moisCourant = new Date().getMonth()
const anneeSel = ref(anneeCourante)
const ongletActif = ref('production')
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
const phases = ref([])
const realisations = ref([])

async function charger() {
  erreur.value = ''

  const rp = await supabase.from('produits').select('id', { count: 'exact', head: true }).eq('actif', true)
  if (!rp.error) nbProduits.value = rp.count || 0

  const rl = await supabase.from('ordres_fabrication')
    .select('id, numero_lot, statut, date_lancement, quantite_theorique, produits(designation)')
    .eq('actif', true).order('date_lancement', { ascending: false, nullsFirst: false }).order('id', { ascending: false })
  if (rl.error) { erreur.value = rl.error.message; return }
  lots.value = rl.data

  const rpp = await supabase.from('plan_production').select('annee, quantite_planifiee, produits(pcsu)')
  if (!rpp.error) planData.value = rpp.data

  const rc = await supabase.from('conditionnement')
    .select('ordre_id, quantite_entree, quantite_conditionnee, date_conditionnement, ordres_fabrication(produits(code_pf, designation, unites_par_boite, poids_unitaire_mg, pcsu, boites_theoriques, donneurs_ordre(nom)))')
    .eq('actif', true)
  if (!rc.error) conditionnements.value = rc.data

  const rph = await supabase.from('suivi_phases')
    .select('ordre_id, quantite_entree, quantite_sortie, date_phase, id')
    .eq('actif', true).order('date_phase', { ascending: true, nullsFirst: true }).order('id', { ascending: true })
  if (!rph.error) phases.value = rph.data

  const rr = await supabase.from('realisations')
    .select('annee, mois, quantite_realisee, produits(code_pf, designation, pcsu, boites_theoriques, donneurs_ordre(nom))')
    .eq('actif', true)
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

// --- Lots (état courant) ---
const nbLots = computed(() => lots.value.length)
const lotsParStatut = computed(() => {
  const m = {}
  for (const s of STATUTS) m[s] = 0
  for (const l of lots.value) { if (m[l.statut] != null) m[l.statut]++; else m[l.statut] = 1 }
  return m
})
const lotsEnCours = computed(() => lotsParStatut.value['En cours'] || 0)
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

// --- Volumes (année sélectionnée) ---
const totalBoites = computed(() => realAnnee.value.reduce((s, r) => s + Number(r.quantite_realisee || 0), 0))
const boitesRestantes = computed(() => Math.max(0, planTotal.value - totalBoites.value))
const boitesCeMois = computed(() => realisations.value.filter(r => r.annee === anneeCourante && r.mois === moisCourant + 1).reduce((s, r) => s + Number(r.quantite_realisee || 0), 0))

// --- Finance (année sélectionnée) ---
const caRealise = computed(() => realAnnee.value.reduce((s, r) => s + Number(r.quantite_realisee || 0) * pcsuR(r), 0))
const caCeMois = computed(() => realisations.value.filter(r => r.annee === anneeCourante && r.mois === moisCourant + 1).reduce((s, r) => s + Number(r.quantite_realisee || 0) * pcsuR(r), 0))
const tauxRealisationCA = computed(() => caPotentielPlan.value > 0 ? (caRealise.value / caPotentielPlan.value) * 100 : null)
const prixMoyenBoite = computed(() => totalBoites.value > 0 ? caRealise.value / totalBoites.value : null)
const pctPlanRealise = computed(() => planTotal.value > 0 ? (totalBoites.value / planTotal.value) * 100 : null)

// --- Rendements ---
const rendementCndtMoyen = computed(() => {
  let boites = 0, eq = 0
  for (const c of condAnnee.value) {
    const p = prodDe(c)
    if (!p) continue
    const mm = Number(p.poids_unitaire_mg || 0)
    const upb = Number(p.unites_par_boite || 0)
    const kg = Number(c.quantite_entree || 0)
    if (c.quantite_conditionnee == null || kg === 0 || mm === 0 || upb === 0) continue
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
    if (b == null) continue
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
    if (c.quantite_conditionnee == null || kg === 0 || mm === 0 || upb === 0) continue
    const mo = new Date(c.date_conditionnement).getMonth()
    boxes[mo] += Math.floor(Number(c.quantite_conditionnee) / upb)
    eq[mo] += (kg * 1e6) / mm / upb
  }
  return boxes.map((b, i) => eq[i] > 0 ? (b / eq[i]) * 100 : null)
})

// --- En-cours (vrac, état courant) ---
const vracEnAttente = computed(() => {
  const lastSortie = {}
  for (const p of phases.value) { if (p.quantite_sortie != null) lastSortie[p.ordre_id] = Number(p.quantite_sortie) }
  const condEntree = {}
  for (const c of conditionnements.value) { if (c.quantite_entree != null) condEntree[c.ordre_id] = (condEntree[c.ordre_id] || 0) + Number(c.quantite_entree) }
  let t = 0
  for (const k in lastSortie) { const v = lastSortie[k] - (condEntree[k] || 0); if (v > 0) t += v }
  return t
})

// --- Production par mois (année) ---
const prodParMois = computed(() => {
  const arr = Array(12).fill(0)
  for (const r of realAnnee.value) arr[r.mois - 1] += Number(r.quantite_realisee || 0)
  return arr
})
const maxMois = computed(() => Math.max(1, ...prodParMois.value))

// --- Top produits / donneurs / réalisation (année) ---
const topProduits = computed(() => {
  const m = {}
  for (const r of realAnnee.value) {
    const p = r.produits
    const cle = p ? p.code_pf : '—'
    if (!m[cle]) m[cle] = { nom: p ? p.designation : '(produit inconnu)', boites: 0, ca: 0 }
    const b = Number(r.quantite_realisee || 0)
    m[cle].boites += b
    m[cle].ca += b * pcsuR(r)
  }
  return Object.values(m).filter(x => x.boites > 0).sort((a, b) => b.ca - a.ca).slice(0, 5)
})
const caParDonneur = computed(() => {
  const m = {}
  for (const r of realAnnee.value) {
    const p = r.produits
    const nom = p && p.donneurs_ordre ? p.donneurs_ordre.nom : '—'
    if (!m[nom]) m[nom] = { nom, boites: 0, ca: 0 }
    const b = Number(r.quantite_realisee || 0)
    m[nom].boites += b
    m[nom].ca += b * pcsuR(r)
  }
  return Object.values(m).filter(x => x.boites > 0).sort((a, b) => b.ca - a.ca)
})
const maxCaDonneur = computed(() => Math.max(1, ...caParDonneur.value.map(d => d.ca)))
const realisationPlan = computed(() => {
  const m = {}
  for (const r of realAnnee.value) {
    const p = r.produits
    const code = p ? p.code_pf : '—'
    if (!m[code]) m[code] = { code, nom: p ? p.designation : '—', produit: 0, cible: p ? Number(p.boites_theoriques || 0) : 0 }
    m[code].produit += Number(r.quantite_realisee || 0)
  }
  return Object.values(m).filter(x => x.produit > 0)
    .map(x => ({ ...x, pct: x.cible > 0 ? (x.produit / x.cible) * 100 : null }))
    .sort((a, b) => b.produit - a.produit).slice(0, 8)
})

function pct(n, total) { return total > 0 ? (n / total) * 100 : 0 }
function fmt(n) { return n == null ? '—' : Number(n).toLocaleString('fr-FR') }
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

onMounted(async () => {
  const r = await supabase.auth.getSession()
  session.value = r.data ? r.data.session : null
  if (session.value) await charger()
})
</script>
