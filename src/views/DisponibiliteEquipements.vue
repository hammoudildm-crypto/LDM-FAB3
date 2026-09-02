<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'
import { ICONS, TINTS } from '../icons.js'

const router = useRouter()

const equipements = ref([])
const ateliers = ref([])
const ofs = ref([])
const conds = ref([])
const suivi = ref([])
const planRows = ref([])
const ongletDispo = ref('file')
const erreur = ref('')
const chargement = ref(true)
const recherche = ref('')

const anneeSel = ref(new Date().getFullYear())
const enCoursOnly = ref(true)

// Phases de fabrication -> colonne de rendement dans ordres_fabrication.
// Un lot "passe" par une phase si le rendement de cette phase est renseigné.
// Gamme de fabrication : ordre logique des phases.
const PHASES = [
  { key: 'pesee',           ordre: 1, label: 'Pesée',               ic: ICONS.hash,     tint: TINTS.slate },
  { key: 'granulation',     ordre: 2, label: 'Granulation',         ic: ICONS.flask,    tint: TINTS.teal },
  { key: 'sechage',         ordre: 3, label: 'Séchage',             ic: ICONS.activity, tint: TINTS.cyan },
  { key: 'melange',         ordre: 4, label: 'Mélange',             ic: ICONS.layers,   tint: TINTS.blue },
  { key: 'compression',     ordre: 5, label: 'Compression',         ic: ICONS.pill,     tint: TINTS.violet },
  { key: 'remplissage',     ordre: 6, label: 'Remplissage gélules', ic: ICONS.package,  tint: TINTS.indigo },
  { key: 'pelliculage',     ordre: 7, label: 'Pelliculage',         ic: ICONS.target,   tint: TINTS.amber },
  { key: 'conditionnement', ordre: 8, label: 'Conditionnement',     ic: ICONS.box,      tint: TINTS.green },
]

// Déduit la phase à partir du type d'équipement (robuste aux variantes de libellé).
function phaseDeType(type) {
  const t = (type || '').toLowerCase()
  if (/pes[ée]|balance|bascule/.test(t)) return 'pesee'
  if (/granul/.test(t)) return 'granulation'
  if (/séch|sech/.test(t)) return 'sechage'
  if (/mélang|melang/.test(t)) return 'melange'
  if (/gélule|gelule|remplis|encapsul|capsul/.test(t)) return 'remplissage'
  if (/compress|presse|compri/.test(t)) return 'compression'
  if (/pellicul|enrob|coat|dragé|drage/.test(t)) return 'pelliculage'
  if (/condition|blister|thermoform|uhlmann|integra|marchesini|emball|étui|etui|fardel|encart|mise en bo/.test(t)) return 'conditionnement'
  return null
}

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

  const ra = await supabase.from('ateliers').select('id, code, nom').eq('actif', true).order('code')
  if (ra.error) { erreur.value = ra.error.message; chargement.value = false; return }
  ateliers.value = ra.data || []

  const re = await supabase.from('equipements').select('id, code, nom, type, atelier_id').eq('actif', true).order('code')
  if (re.error) { erreur.value = re.error.message; chargement.value = false; return }
  equipements.value = re.data || []

  const rof = await fetchAllPaged(() => supabase.from('ordres_fabrication')
    .select('id, numero_lot, statut, deviation, deviation_cond, en_triage, triage_debut, triage_fin, qte_a_trier, qte_triee, en_triage_cond, triage_cond_debut, triage_cond_fin, quantite_theorique, boites_fabriquees, date_reception, date_fin_validite, date_lancement, date_fin_fabrication, equipement_id, rdt_granulation, rdt_melange, rdt_compression, rdt_pelliculage, produits(code_pf, designation, forme, gamme, unites_par_boite, taille_lot, poids_unitaire_mg), equipements(code, nom)')
    .eq('actif', true))
  if (rof.error) { erreur.value = rof.error.message; chargement.value = false; return }
  ofs.value = rof.data || []

  const rc = await fetchAllPaged(() => supabase.from('conditionnement')
    .select('ordre_id, equipement_id, statut, quantite_conditionnee').eq('actif', true))
  if (rc.error) { erreur.value = rc.error.message; chargement.value = false; return }
  conds.value = rc.data || []

  const rs = await fetchAllPaged(() => supabase.from('suivi_phases')
    .select('ordre_id, phase, statut, date_phase, date_debut').eq('actif', true))
  if (rs.error) { erreur.value = rs.error.message; chargement.value = false; return }
  suivi.value = rs.data || []

  await chargerSacs()
  const rpl = await fetchAllPaged(() => supabase.from('plan_production').select('annee, quantite_planifiee, produits(gamme)'))
  if (!rpl.error) planRows.value = rpl.data || []

  chargement.value = false
}

function anneeDe(o) {
  return o.date_fin_fabrication ? new Date(o.date_fin_fabrication).getFullYear() : null
}

const anneesDispo = computed(() => {
  const s = new Set()
  for (const o of ofs.value) { const a = anneeDe(o); if (a) s.add(a) }
  s.add(new Date().getFullYear())
  return Array.from(s).sort((a, b) => b - a)
})

// Lots retenus selon l'année de fabrication (0 = toutes).
const lotsAnnee = computed(() => {
  if (anneeSel.value === 0) return ofs.value
  return ofs.value.filter(o => anneeDe(o) === anneeSel.value)
})

// Produits en cours : au moins un lot lancé mais non terminé (état courant, toutes années).
const produitsEnCours = computed(() => {
  const s = new Set()
  for (const o of ofs.value) {
    if (o.produits && o.date_lancement && !o.date_fin_fabrication) s.add(o.produits.code_pf)
  }
  return s
})

// Lots conditionnés (au moins un enregistrement de conditionnement).
const ordresConditionnes = computed(() => {
  const s = new Set()
  for (const c of conds.value) s.add(c.ordre_id)
  return s
})
// Lots dont le conditionnement est DÉFINITIF (au moins un enregistrement Terminé/Libéré)
const condTermine = computed(() => {
  const s = new Set()
  for (const c of conds.value) if (c.statut === 'Terminé' || c.statut === 'Libéré') s.add(c.ordre_id)
  return s
})
// Boîtes conditionnées cumulées par lot
const condBoxParLot = computed(() => {
  const upb = {}
  for (const o of ofs.value) upb[o.id] = o.produits ? Number(o.produits.unites_par_boite || 0) : 0
  const m = {}
  for (const c of conds.value) {
    const u = upb[c.ordre_id] || 0
    if (u <= 0) continue
    m[c.ordre_id] = (m[c.ordre_id] || 0) + Math.floor(Number(c.quantite_conditionnee || 0) / u)
  }
  return m
})
// Conditionnement complet : statut Terminé/Libéré OU quantité conditionnée >= 85 % du fabriqué
// (couvre l'historique conditionné sans statut de clôture)
const condComplet = computed(() => {
  const s = new Set(condTermine.value)
  const cb = condBoxParLot.value
  for (const o of ofs.value) {
    if (s.has(o.id)) continue
    const avail = Number(o.boites_fabriquees || 0) || Number(o.quantite_theorique || 0)
    if (avail > 0 && (cb[o.id] || 0) >= avail * 0.85) s.add(o.id)
  }
  return s
})

// Équipements utilisés dans le module conditionnement -> considérés atelier de conditionnement
const condEquipIds = computed(() => {
  const s = new Set()
  for (const c of conds.value) if (c.equipement_id) s.add(c.equipement_id)
  return s
})
// Phase d'un équipement : par son type, sinon 'conditionnement' s'il sert au conditionnement
function phaseEquip(e) {
  const k = phaseDeType(e.type)
  if (k) return k
  if (condEquipIds.value.has(e.id)) return 'conditionnement'
  return null
}

// ============ FILE D'ATTENTE PAR ATELIER (temps réel) ============
const PHASE_NOM = { pesee: 'Pesée', granulation: 'Granulation', sechage: 'Séchage', melange: 'Mélange', compression: 'Compression', remplissage: 'Remplissage Gélules', pelliculage: 'Pelliculage', conditionnement: 'Conditionnement' }
const NOM_KEY = {}
for (const [k, v] of Object.entries(PHASE_NOM)) NOM_KEY[v.toLowerCase()] = k
// Nom de phase (gamme ou suivi) -> clé canonique. Granulation / Séchage / « Granulation et Séchage » -> 'granulation' (fusionnés).
function phaseKey(nom) {
  const t = String(nom || '').trim().toLowerCase()
  if (!t) return null
  if (/granul|s[ée]ch/.test(t)) return 'granulation'
  return NOM_KEY[t] || null
}
const CANON_FAB = ['Pesée', 'Granulation', 'Séchage', 'Mélange', 'Compression', 'Remplissage Gélules', 'Pelliculage']

// Statut de chaque phase par lot (depuis suivi_phases)
const phasesLot = computed(() => {
  const m = {}
  const sechEtat = {}
  for (const sp of suivi.value) {
    const id = sp.ordre_id, k = phaseKey(sp.phase)
    if (!k) continue
    if (!m[id]) m[id] = {}
    const rec = { statut: sp.statut, date: sp.date_phase || sp.date_debut || null }
    const cur = m[id][k]
    if (!cur || sp.statut === 'Terminé') m[id][k] = rec
    const nl = String(sp.phase || '').toLowerCase()
    if (/s[ée]ch/.test(nl) && !/granul/.test(nl)) {
      if (!sechEtat[id]) sechEtat[id] = { present: false, termine: false }
      sechEtat[id].present = true
      if (sp.statut === 'Terminé') sechEtat[id].termine = true
    }
  }
  // Fusion : « Granulation et Séchage » terminé SEULEMENT si le séchage (saisi à part) est terminé
  for (const id in m) {
    const g = m[id].granulation
    if (g && g.statut === 'Terminé') {
      const se = sechEtat[id]
      const apres = m[id].compression || m[id].remplissage || m[id].pelliculage || m[id].conditionnement
      if (se && se.present && !se.termine && !apres) m[id].granulation = { statut: 'En cours', date: g.date }
    }
  }
  return m
})

// Lots en cours de triage (ordres_fabrication.en_triage === 'Triage')
const lotsTriage = computed(() => {
  const pl = phasesLot.value
  return ofs.value.filter(o => !!o.en_triage && !o.triage_fin).map(o => {
    const prod = o.produits || {}
    const eq = o.equipements || {}
    let phaseAct = ''
    const ph = pl[o.id] || {}
    for (const P of PHASES) { const rec = ph[P.key]; if (rec && rec.statut !== 'Terminé') { phaseAct = P.label; break } }
    const upbT = Number(prod.unites_par_boite) || 0, pmgT = Number(prod.poids_unitaire_mg) || 0
    const boitesT = Number(o.boites_fabriquees) || Number(prod.taille_lot) || 0
    const kgLot = Math.round((boitesT * upbT * pmgT) / 1e6 * 100) / 100
    const aTrierDef = o.qte_a_trier != null ? o.qte_a_trier : kgLot
    return { id: o.id, lot: o.numero_lot || '—', code: prod.code_pf || '—', desig: prod.designation || '', equip: eq.nom || eq.code || '', phase: phaseAct, debut: o.triage_debut || '', fin: o.triage_fin || '', qteATrier: aTrierDef, qteTriee: o.qte_triee != null ? o.qte_triee : 0 }
  })
})

const triageIds = computed(() => new Set(lotsTriage.value.map(l => l.id)))
const triageCondIds = computed(() => new Set(ofs.value.filter(o => !!o.en_triage_cond && !o.triage_cond_fin).map(o => o.id)))
// Déviations déclarées sur l'OF (page Ordres de fabrication)
const deviationIds = computed(() => new Set(ofs.value.filter(o => !!o.deviation).map(o => o.id)))
const deviationCondIds = computed(() => new Set(ofs.value.filter(o => !!o.deviation_cond).map(o => o.id)))
// File par phase : lots à l'étape courante (en attente = étape précédente finie ; en cours = démarrée)
const anneeCourante = new Date().getFullYear()
const planParPhase = computed(() => {
  const acc = {}
  for (const r of planRows.value) {
    if (Number(r.annee) !== anneeCourante) continue
    const p = r.produits; if (!p) continue
    const g = (Array.isArray(p.gamme) && p.gamme.length) ? p.gamme : CANON_FAB
    const vus = new Set(); for (const ph of g) { const k = phaseKey(ph); if (k) vus.add(k) }
    for (const k of vus) acc[k] = (acc[k] || 0) + Number(r.quantite_planifiee || 0)
  }
  return acc
})
const realiseParPhase = computed(() => {
  const acc = {}
  for (const o of ofs.value) {
    const d = o.date_lancement
    if (!d || new Date(d).getFullYear() !== anneeCourante) continue
    const pl = phasesLot.value[o.id] || {}
    const b = Number(o.quantite_theorique || 0)
    for (const k in pl) { const st = pl[k].statut; if (st === 'Terminé' || st === 'En cours') acc[k] = (acc[k] || 0) + b }
  }
  return acc
})
function infoPhase(k) {
  const plan = planParPhase.value[k] || 0, realise = realiseParPhase.value[k] || 0
  return { plan, realise, taux: plan > 0 ? Math.round(realise / plan * 100) : null }
}
// Produit « direct conditionnement » (ex. seringues importées type Rebif) : pas d'étape de fabrication
function estDirectCond(p) { return !!(p && String(p.forme || '').toLowerCase() === 'seringue') }
const queuePhase = computed(() => {
  const q = {}
  for (const ph of PHASES) q[ph.key] = { attente: [], cours: [] }
  const condFini = condComplet.value
  const condAny = ordresConditionnes.value
  for (const o of ofs.value) {
    const directCond = estDirectCond(o.produits)
    if (condFini.has(o.id)) continue
    if (!directCond && !o.date_lancement && !o.date_fin_fabrication) continue
    if (o.statut === 'Libéré' || o.statut === 'Rejeté') continue
    const pl = phasesLot.value[o.id] || {}
    const stat = (nom) => (pl[phaseKey(nom)] || {}).statut
    const gammeB = (o.produits && Array.isArray(o.produits.gamme) && o.produits.gamme.length) ? o.produits.gamme : CANON_FAB
    const gamme = []; let _pk = null
    for (const _ph of gammeB) { const _k = phaseKey(_ph); if (_k && _k === _pk) continue; gamme.push(_ph); _pk = _k }
    gamme.sort((a, b) => ((PHASES.find(x => x.key === phaseKey(a)) || {}).ordre || 99) - ((PHASES.find(x => x.key === phaseKey(b)) || {}).ordre || 99))
    const p = o.produits || {}
    // Fabrication finie = dernière phase de la gamme du produit terminée (critère fiable, pas la date).
    const kDern = gamme.length ? phaseKey(gamme[gamme.length - 1]) : null
    const fabTerminee = !!o.date_fin_fabrication || !!(kDern && pl[kDern] && pl[kDern].statut === 'Terminé')
    const base = { id: o.id, triage: triageIds.value.has(o.id), triageCond: triageCondIds.value.has(o.id), deviation: deviationIds.value.has(o.id), deviationCond: deviationCondIds.value.has(o.id), lot: o.numero_lot || '—', code: p.code_pf || '—', desig: p.designation || '', forme: p.forme || '', boites: Number(o.quantite_theorique || 0), lancement: o.date_lancement || null,
      validite: o.date_fin_validite || null, perime: (o.date_fin_validite && !fabTerminee) ? (new Date(o.date_fin_validite) < new Date()) : false,
      reserveId: o.equipement_id || null, reserveLabel: o.equipements ? (o.equipements.code + (o.equipements.nom ? ' — ' + o.equipements.nom : '')) : null }
    if (directCond) {
      (condAny.has(o.id) ? q.conditionnement.cours : q.conditionnement.attente).push({ ...base, date: o.date_lancement || o.date_reception || o.date_fin_fabrication })
      continue
    }
    // Règle : le lot est à sa PREMIÈRE phase de gamme NON terminée.
    //   Conditionnement uniquement si TOUTES les phases de la gamme sont terminées.
    if (Object.keys(pl).length === 0) {
      if (o.date_fin_fabrication) {
        (condAny.has(o.id) ? q.conditionnement.cours : q.conditionnement.attente).push({ ...base, date: o.date_fin_fabrication })
      } else {
        const k0 = phaseKey(gamme[0])
        if (k0 && q[k0]) q[k0].attente.push({ ...base, date: o.date_lancement })
      }
      continue
    }
    let curIdx = -1
    for (let i = 0; i < gamme.length; i++) {
      const kk = phaseKey(gamme[i]); const rr = kk ? pl[kk] : null
      if (!rr || rr.statut !== 'Terminé') { curIdx = i; break }
    }
    if (curIdx < 0) {
      (condAny.has(o.id) ? q.conditionnement.cours : q.conditionnement.attente).push({ ...base, date: o.date_fin_fabrication || o.date_lancement })
    } else {
      const kCur = phaseKey(gamme[curIdx]); const rCur = kCur ? pl[kCur] : null
      if (kCur && q[kCur]) {
        if (rCur && rCur.statut === 'En cours') q[kCur].cours.push({ ...base, date: (rCur && rCur.date) || o.date_lancement })
        else q[kCur].attente.push({ ...base, date: (rCur && rCur.date) || o.date_lancement })
      }
    }
  }
  const byDate = (a, b) => String(a.lot || '').localeCompare(String(b.lot || ''), undefined, { numeric: true })
  for (const k in q) { q[k].attente.sort(byDate); q[k].cours.sort(byDate) }
  return q
})

// Phases couvertes par chaque atelier (via ses équipements)
const phasesParAtelier = computed(() => {
  const m = {}
  for (const e of equipements.value) { const k = phaseEquip(e); if (!k) continue; (m[e.atelier_id] = m[e.atelier_id] || new Set()).add(k) }
  return m
})

// --- Filtres + priorité ---
const filtrePerime = ref(false)
const filtreUrgent = ref(false)
const SEUIL_URGENT = 15
function estUrgent(l) {
  if (l && l.perime) return true
  if (!l || !l.date) return false
  return Math.floor((Date.now() - new Date(l.date)) / 86400000) >= SEUIL_URGENT
}
function lotMatch(l) {
  const rq = recherche.value.trim().toLowerCase()
  if (rq && !((l.lot || "").toLowerCase().includes(rq) || (l.code || "").toLowerCase().includes(rq) || (l.desig || "").toLowerCase().includes(rq))) return false
  if (filtrePerime.value && !l.perime) return false
  if (filtreUrgent.value && !estUrgent(l)) return false
  return true
}

// Vue file FABRICATION : une colonne par PHASE (dédupliquée, hors pesée/conditionnement)
const vueFile = computed(() => {
  const q = queuePhase.value
  const rq = recherche.value.trim().toLowerCase()
  const mL = lotMatch
  const presentes = new Set()
  for (const a of ateliers.value) {
    const keys = phasesParAtelier.value[a.id]
    if (keys) for (const k of keys) if (k !== 'conditionnement' && k !== 'pesee') presentes.add(k)
  }
  const liste = [...presentes].map(k => {
    const ph = PHASES.find(p => p.key === k)
    const attente = (q[k] ? q[k].attente : []).filter(mL)
    const cours = (q[k] ? q[k].cours : []).filter(mL)
    return { key: k, phase: ph, attente, cours, volAttente: attente.reduce((s, l) => s + l.boites, 0), volCours: cours.reduce((s, l) => s + l.boites, 0), ...infoPhase(k) }
  }).filter(x => x.phase)
  // Fusionner Granulation + Séchage en une seule colonne (même opération)
  const gran = liste.find(x => x.key === 'granulation')
  const sech = liste.find(x => x.key === 'sechage')
  if (gran || sech) {
    const byDate = (a, b) => String(a.lot || '').localeCompare(String(b.lot || ''), undefined, { numeric: true })
    const ref = gran || sech
    const attente = [...(gran ? gran.attente : []), ...(sech ? sech.attente : [])].sort(byDate)
    const cours = [...(gran ? gran.cours : []), ...(sech ? sech.cours : [])].sort(byDate)
    const merged = {
      key: 'gran_sech',
      phase: { key: 'gran_sech', label: 'Granulation et séchage', ordre: ref.phase.ordre, ic: ref.phase.ic, tint: ref.phase.tint },
      attente, cours,
      volAttente: attente.reduce((s, l) => s + l.boites, 0), volCours: cours.reduce((s, l) => s + l.boites, 0), ...infoPhase('granulation')
    }
    const rest = liste.filter(x => x.key !== 'granulation' && x.key !== 'sechage')
    rest.push(merged)
    return rest.sort((a, b) => a.phase.ordre - b.phase.ordre)
  }
  return liste.sort((a, b) => a.phase.ordre - b.phase.ordre)
})

// Planning CONDITIONNEMENT : lots regroupés par LIGNE RÉSERVÉE (equipement_id de l'ordre)
const vueCondLignes = computed(() => {
  const qc = queuePhase.value.conditionnement
  const rq = recherche.value.trim().toLowerCase()
  const mL = lotMatch
  const groups = {}
  // Toutes les lignes de conditionnement, MÊME SANS LOT (pour visualiser l'utilisation).
  // Exception : pendant une recherche, on ne garde que les lignes concernées.
  if (!rq) {
    for (const e of equipements.value) {
      if (phaseEquip(e) !== 'conditionnement') continue
      groups[e.id] = { id: e.id, label: e.code + (e.nom ? ' — ' + e.nom : ''), reserve: true, attente: [], cours: [] }
    }
  }
  const add = (l, type) => {
    if (!mL(l)) return
    const key = l.reserveId || '__none__'
    if (!groups[key]) groups[key] = { id: key, label: l.reserveLabel || 'Non réservé', reserve: !!l.reserveId, attente: [], cours: [] }
    groups[key][type].push(l)
  }
  for (const l of qc.cours) add(l, 'cours')
  for (const l of qc.attente) add(l, 'attente')
  return Object.values(groups).map(g => ({ ...g,
    volAttente: g.attente.reduce((s, l) => s + l.boites, 0), volCours: g.cours.reduce((s, l) => s + l.boites, 0),
    tot: g.attente.length + g.cours.length }))
    .sort((a, b) => (a.reserve === b.reserve ? b.tot - a.tot : (a.reserve ? -1 : 1)))
})

const kpisFile = computed(() => {
  let attFab = 0, coursFab = 0, secs = 0, maxCharge = 0, atelierMax = "—"
  for (const ph of vueFile.value) {
    attFab += ph.attente.length; coursFab += ph.cours.length
    if (ph.attente.length === 0 && ph.cours.length === 0) secs++
    const ch = ph.attente.length + ph.cours.length
    if (ch > maxCharge) { maxCharge = ch; atelierMax = ph.phase.label }
  }
  let attCond = 0, coursCond = 0
  for (const g of vueCondLignes.value) { attCond += g.attente.length; coursCond += g.cours.length; if (g.reserve && g.tot === 0) secs++ }
  const pesee = attentePeseeList.value.length
  let perimes = 0, sommeJ = 0, nbJ = 0
  const scan = (l, att) => { if (l.perime) perimes++; if (att && l.date) { sommeJ += Math.max(0, Math.floor((Date.now() - new Date(l.date)) / 86400000)); nbJ++ } }
  for (const l of attentePeseeList.value) scan(l, true)
  for (const ph of vueFile.value) { ph.attente.forEach(l => scan(l, true)); ph.cours.forEach(l => scan(l, false)) }
  for (const g of vueCondLignes.value) { g.attente.forEach(l => scan(l, true)); g.cours.forEach(l => scan(l, false)) }
  const delai = nbJ ? Math.round(sommeJ / nbJ) : 0
  const totalProd = pesee + attFab + attCond + coursFab + coursCond
  return [
    { v: fmt(totalProd), l: "Lots en production", tint: TINTS.cyan, ic: ICONS.layers },
    { v: fmt(pesee + attFab + attCond), l: "Lots en attente", tint: TINTS.amber, ic: ICONS.hourglass },
    { v: fmt(coursFab + coursCond), l: "Lots en cours", tint: TINTS.blue, ic: ICONS.activity },
    { v: fmt(secs), l: "Ateliers à sec (risque)", tint: TINTS.rose, ic: ICONS.alert },
    { v: atelierMax, l: "Atelier le plus chargé" + (maxCharge ? " (" + maxCharge + ")" : ""), tint: TINTS.indigo, ic: ICONS.factory, small: true },
    { v: delai + " j", l: "Délai moyen d'attente", tint: TINTS.violet, ic: ICONS.gauge },
    { v: fmt(perimes), l: "OF périmés", tint: perimes > 0 ? TINTS.rose : TINTS.slate, ic: ICONS.alert },
  ]
})
// ===== Qualité : suivi du triage et des déviations =====
// Population annuelle : lots dont la fabrication est terminée dans l'année (même base que le rapport hebdo).
const qualiteAnnee = computed(() => {
  const finis = ofs.value.filter(o => o.date_fin_fabrication
    && new Date(o.date_fin_fabrication).getFullYear() === anneeCourante
    && ['Terminé', 'Libéré', 'Rejeté'].includes(o.statut))
  const brft = (k) => finis.length ? Math.round(finis.filter(o => o.statut !== 'Rejeté' && !o[k]).length / finis.length * 1000) / 10 : null
  return {
    finis: finis.length,
    devFab: finis.filter(o => !!o.deviation).length,
    devCond: finis.filter(o => !!o.deviation_cond).length,
    brftFab: brft('deviation'), brftCond: brft('deviation_cond')
  }
})
// Répartition par atelier sur les lots actuellement en file (attente + en cours)
const qualiteParAtelier = computed(() => {
  const compte = (attente, cours, pk) => {
    let tri = 0
    const devLots = []
    for (const l of [...attente, ...cours]) {
      if (l.triage || l.triageCond) tri++
      if (l.deviation || l.deviationCond) devLots.push({ id: l.id, lot: l.lot, code: l.code, desig: l.desig, deviation: !!l.deviation, deviationCond: !!l.deviationCond, pk })
    }
    const bts = (arr) => arr.reduce((n, l) => n + (Number(l.boites) || 0), 0)
    return { tot: attente.length + cours.length, att: attente.length, enc: cours.length,
      bts: bts(attente) + bts(cours), btsAtt: bts(attente), btsEnc: bts(cours),
      tri, dev: devLots.length, devLots }
  }
  const rows = []
  const pes = attentePeseeList.value.map(l => ({
    id: l.id, lot: l.lot, code: l.code, desig: l.desig, boites: l.boites,
    triage: triageIds.value.has(l.id), triageCond: triageCondIds.value.has(l.id),
    deviation: deviationIds.value.has(l.id), deviationCond: deviationCondIds.value.has(l.id)
  }))
  const p = compte(pes, [], 'pesee')
  if (p.tot) rows.push({ label: 'Pesée (attente)', ...p })
  for (const ph of vueFile.value) rows.push({ label: ph.phase.label, ...compte(ph.attente, ph.cours, ph.key) })
  let cAtt = [], cCours = []
  for (const g of vueCondLignes.value) { cAtt = cAtt.concat(g.attente); cCours = cCours.concat(g.cours) }
  const c = compte(cAtt, cCours, 'conditionnement')
  if (c.tot) rows.push({ label: 'Conditionnement', ...c })
  // Charge relative : barre proportionnelle à l'atelier le plus chargé (reprend « Charge par atelier »)
  const max = Math.max(1, ...rows.map(r => r.tot))
  return rows.map(r => ({ ...r, pct: Math.round(r.tot / max * 100), pctDev: r.tot ? Math.round(r.dev / r.tot * 100) : 0 }))
})
// Dépliage du détail des lots en déviation (clic sur la colonne « Avec déviation »)
const devOuvert = ref(null)
function toggleDev(label, n) { if (!n) return; devOuvert.value = devOuvert.value === label ? null : label }
const devLotsTous = computed(() => {
  const out = []
  for (const r of qualiteParAtelier.value) for (const l of r.devLots) out.push({ ...l, atelier: r.label })
  return out
})
const qualiteTotaux = computed(() => {
  const t = qualiteParAtelier.value.reduce((a, r) => ({ tot: a.tot + r.tot, att: a.att + r.att, enc: a.enc + r.enc, bts: a.bts + r.bts, tri: a.tri + r.tri, dev: a.dev + r.dev }), { tot: 0, att: 0, enc: 0, bts: 0, tri: 0, dev: 0 })
  return { ...t, pctDev: t.tot ? Math.round(t.dev / t.tot * 100) : 0 }
})
const kpisQualite = computed(() => {
  const q = qualiteAnnee.value
  const enTriFab = lotsTriage.value.length
  const enTriCond = triageCondIds.value.size
  let aTrier = 0, triee = 0
  for (const l of lotsTriage.value) { const e = qteEdit[l.id] || {}; aTrier += Number(e.aTrier) || 0; triee += Number(e.triee) || 0 }
  const pctTri = aTrier > 0 ? Math.min(100, Math.round(triee / aTrier * 100)) : null
  const devProd = qualiteTotaux.value.dev
  return [
    { v: fmt(enTriFab), l: 'Lots en triage — fabrication', tint: enTriFab ? TINTS.amber : TINTS.slate, ic: ICONS.hourglass },
    { v: fmt(enTriCond), l: 'Lots en triage — conditionnement', tint: enTriCond ? TINTS.amber : TINTS.slate, ic: ICONS.package },
    { v: pctTri == null ? '—' : pctTri + ' %', l: 'Avancement du triage (Kg triés / à trier)', tint: TINTS.blue, ic: ICONS.percent },
    { v: fmt(devProd), l: 'Lots en file avec déviation', tint: devProd ? TINTS.rose : TINTS.slate, ic: ICONS.alert },
    { v: fmt(q.devFab), l: 'Déviations fabrication ' + anneeCourante, tint: q.devFab ? TINTS.rose : TINTS.slate, ic: ICONS.flask },
    { v: q.brftFab == null ? '—' : q.brftFab + ' %', l: 'BRFT fabrication ' + anneeCourante + ' (' + q.finis + ' lots)', tint: TINTS.emerald, ic: ICONS.check },
    { v: q.brftCond == null ? '—' : q.brftCond + ' %', l: 'BRFT conditionnement ' + anneeCourante, tint: TINTS.teal, ic: ICONS.check },
  ]
})

// Lots planifiés EN ATTENTE DE PESÉE : réception OF faite, pesée pas encore terminée
const attentePeseeList = computed(() => {
  const rq = recherche.value.trim().toLowerCase()
  const mL = lotMatch
  const cc = condComplet.value
  const now = new Date()
  const res = []
  for (const o of ofs.value) {
    if (!o.date_reception && !o.date_lancement) continue
    if (o.date_fin_fabrication) continue
    if (cc.has(o.id)) continue
    if (o.statut === 'Libéré' || o.statut === 'Rejeté') continue
    const pl = phasesLot.value[o.id] || {}
    if ((pl['pesee'] || {}).statut === 'Terminé') continue // pesée effectuée -> le lot disparaît
    if (Object.keys(pl).some(k => k !== 'pesee')) continue // a une phase au-delà de la pesée -> plus en attente de pesée
    const p = o.produits || {}
    res.push({
      id: o.id, lot: o.numero_lot || '—', code: p.code_pf || '—', desig: p.designation || '', forme: p.forme || '',
      boites: Number(o.quantite_theorique || 0), date: o.date_reception || o.date_lancement,
      validite: o.date_fin_validite || null, perime: (o.date_fin_validite && !o.date_fin_fabrication) ? (new Date(o.date_fin_validite) < now) : false
    })
  }
  return res.filter(mL).sort((a, b) => String(a.lot || '').localeCompare(String(b.lot || ''), undefined, { numeric: true }))
})

// OF planifiés, pas encore reçus (ni démarrés) -> en attente de réception
const attenteReceptionList = computed(() => {
  const rq = recherche.value.trim().toLowerCase()
  const mL = lotMatch
  const cc = condComplet.value
  const res = []
  for (const o of ofs.value) {
    if (o.date_reception || o.date_lancement || o.date_fin_fabrication) continue
    if (cc.has(o.id)) continue
    if (o.statut === 'Libéré' || o.statut === 'Rejeté' || o.statut === 'Terminé') continue
    const p = o.produits || {}
    if (estDirectCond(p)) continue
    res.push({ id: o.id, lot: o.numero_lot || '—', code: p.code_pf || '—', desig: p.designation || '', forme: p.forme || '', boites: Number(o.quantite_theorique || 0), validite: o.date_fin_validite || null })
  }
  return res.filter(mL).sort((a, b) => String(a.lot || '').localeCompare(String(b.lot || ''), undefined, { numeric: true }))
})

function joursDepuis(d) { if (!d) return '—'; const j = Math.floor((Date.now() - new Date(d)) / 86400000); return j <= 0 ? 'auj.' : j + ' j' }
function ageClass(d) {
  if (!d) return ''
  const j = Math.floor((Date.now() - new Date(d)) / 86400000)
  if (j >= 7) return 'age-danger'
  if (j >= 3) return 'age-warn'
  return ''
}
function fmtDate(d) { if (!d) return '—'; const x = new Date(d); if (isNaN(x)) return String(d); return (/[T ]\\d{2}:/.test(String(d)) ? x.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + ' ' : '') + x.toLocaleDateString('fr-FR') }
function ouvrirLot(l, phaseKey) {
  if (phaseKey === 'conditionnement') router.push({ path: '/conditionnement', query: { lot: l.id } })
  else router.push({ path: '/suivi', query: { lot: l.id } })
}
// La fin de triage se saisit désormais sur l'étape, dans Suivi des phases
function ouvrirTriageFin(id) { router.push({ path: '/suivi', query: { lot: id, triage: 1 } }) }
// ===== Triage sac par sac =====
// Nombre de sacs = ceil(Kg à trier / poids du sac). Un sac coché = trié et conforme.
const CLE_POIDS_SAC = 'dispo_poids_sac'
const poidsSac = ref(25)
try { const v = Number(localStorage.getItem(CLE_POIDS_SAC)); if (v > 0) poidsSac.value = v } catch (e) { /* ignore */ }
watch(poidsSac, (v) => { try { localStorage.setItem(CLE_POIDS_SAC, String(Number(v) > 0 ? v : 25)) } catch (e) { /* ignore */ } })
const sacs = ref([])            // lignes triage_sacs
const sacsOuvert = ref(null)    // id du lot déplié
const majSac = ref('')
async function chargerSacs() {
  const r = await fetchAllPaged(() => supabase.from('triage_sacs').select('id, ordre_id, numero_sac'))
  // fetchAllPaged renvoie { data, error } : ne jamais affecter l'objet lui-même à sacs.
  // Si la table n'existe pas encore (migration 004 non passée), on reste sur une liste vide.
  if (r.error) { sacs.value = []; majSac.value = 'Suivi par sac indisponible : ' + r.error.message; return }
  sacs.value = Array.isArray(r.data) ? r.data : []
}
const sacsParLot = computed(() => {
  const m = {}
  const liste = Array.isArray(sacs.value) ? sacs.value : []
  for (const x of liste) { if (!m[x.ordre_id]) m[x.ordre_id] = new Set(); m[x.ordre_id].add(x.numero_sac) }
  return m
})
function nbSacs(l) {
  const q = Number((qteEdit[l.id] || {}).aTrier) || 0
  const ps = Number(poidsSac.value) || 0
  return ps > 0 ? Math.ceil(q / ps) : 0
}
function sacCoche(l, n) { const s = sacsParLot.value[l.id]; return !!(s && s.has(n)) }
function nbSacsCoches(l) {
  const s = sacsParLot.value[l.id]; if (!s) return 0
  const tot = nbSacs(l)
  let n = 0; for (const v of s) if (v <= tot) n++   // on ignore les sacs au-delà du total courant
  return n
}
function pctSacs(l) { const t = nbSacs(l); return t > 0 ? Math.round(nbSacsCoches(l) / t * 100) : 0 }
// Kg réellement triés : les sacs pleins valent poidsSac, le DERNIER ne vaut que le reliquat.
function kgSacs(l) {
  const q = Number((qteEdit[l.id] || {}).aTrier) || 0
  const ps = Number(poidsSac.value) || 0
  const tot = nbSacs(l)
  if (tot <= 0 || ps <= 0) return 0
  const reste = q - (tot - 1) * ps
  let kg = 0
  for (let n = 1; n <= tot; n++) if (sacCoche(l, n)) kg += (n === tot ? reste : ps)
  return Math.round(kg * 100) / 100
}
// Reporte les sacs cochés dans « Triée (Kg) » et enregistre.
async function syncKgTries(l) {
  if (!qteEdit[l.id]) return
  const kg = kgSacs(l)
  qteEdit[l.id].triee = kg
  const r = await supabase.from('ordres_fabrication').update({ qte_triee: kg }).eq('id', l.id)
  if (r.error) majSac.value = 'Erreur : ' + r.error.message
}
async function basculerSac(l, n, sync) {
  majSac.value = ''
  if (sacCoche(l, n)) {
    const r = await supabase.from('triage_sacs').delete().eq('ordre_id', l.id).eq('numero_sac', n)
    if (r.error) { majSac.value = 'Erreur : ' + r.error.message; return }
    sacs.value = sacs.value.filter(x => !(x.ordre_id === l.id && x.numero_sac === n))
    if (sync !== false) await syncKgTries(l)
  } else {
    let email = null
    try { const se = await supabase.auth.getSession(); email = se.data && se.data.session ? se.data.session.user.email : null } catch (e) { /* ignore */ }
    const r = await supabase.from('triage_sacs').insert({ ordre_id: l.id, numero_sac: n, conforme: true, coche_par: email }).select('id').single()
    if (r.error) { majSac.value = 'Erreur : ' + r.error.message; return }
    sacs.value = sacs.value.concat([{ id: r.data ? r.data.id : null, ordre_id: l.id, numero_sac: n }])
    if (sync !== false) await syncKgTries(l)
  }
}
async function cocherTousSacs(l) {
  const tot = nbSacs(l)
  for (let n = 1; n <= tot; n++) if (!sacCoche(l, n)) await basculerSac(l, n, false)
  await syncKgTries(l)
}
async function decocherTousSacs(l) {
  const tot = nbSacs(l)
  for (let n = 1; n <= tot; n++) if (sacCoche(l, n)) await basculerSac(l, n, false)
  await syncKgTries(l)
}
function toggleSacs(l) { sacsOuvert.value = sacsOuvert.value === l.id ? null : l.id }
const qteEdit = reactive({})
watch(lotsTriage, (lots) => { for (const l of lots) if (!qteEdit[l.id]) qteEdit[l.id] = { aTrier: l.qteATrier || 0, triee: l.qteTriee || 0 } }, { immediate: true })
function pctTriage(id) { const q = qteEdit[id] || {}; const t = Number(q.aTrier) || 0; return t > 0 ? Math.min(100, Math.round((Number(q.triee) || 0) / t * 100)) : 0 }
async function sauverTriage(l) {
  const q = qteEdit[l.id] || {}
  const r = await supabase.from('ordres_fabrication').update({ qte_a_trier: Number(q.aTrier) || 0, qte_triee: Number(q.triee) || 0 }).eq('id', l.id)
  if (r.error) { alert('Enregistrement échoué : ' + r.error.message + ' — as-tu ajouté les colonnes qte_a_trier / qte_triee ?'); return }
  await charger()
}

// Pour chaque phase : { code_pf -> { code, desig, lots, boites } }
const produitsParPhase = computed(() => {
  const res = {}
  for (const ph of PHASES) res[ph.key] = {}
  const add = (key, o, p) => {
    const m = res[key]
    if (!m[p.code_pf]) m[p.code_pf] = { code: p.code_pf, desig: p.designation || '', lots: 0, boites: 0 }
    m[p.code_pf].lots++
    m[p.code_pf].boites += Number(o.quantite_theorique || 0)
  }
  const estGelule = (p) => /gélule|gelule|capsule/.test((p.forme || '').toLowerCase())
  for (const o of lotsAnnee.value) {
    const p = o.produits
    if (!p) continue
    add('pesee', o, p)                                                   // tout lot fabriqué est pesé
    if (o.rdt_granulation != null) { add('granulation', o, p); add('sechage', o, p) }
    if (o.rdt_melange != null) add('melange', o, p)
    if (o.rdt_compression != null) add(estGelule(p) ? 'remplissage' : 'compression', o, p)
    if (o.rdt_pelliculage != null) add('pelliculage', o, p)
    if (ordresConditionnes.value.has(o.id)) add('conditionnement', o, p)
  }
  return res
})

// Ateliers -> équipements enrichis (phase + produits + totaux), filtrés par recherche.
const vue = computed(() => {
  const q = recherche.value.trim().toLowerCase()
  const match = (e, prods) => {
    if (!q) return true
    if ((e.code || '').toLowerCase().includes(q)) return true
    if ((e.nom || '').toLowerCase().includes(q)) return true
    if ((e.type || '').toLowerCase().includes(q)) return true
    return prods.some(p => p.code.toLowerCase().includes(q) || p.desig.toLowerCase().includes(q))
  }
  return ateliers.value.map(a => {
    const eqs = equipements.value
      .filter(e => e.atelier_id === a.id)
      .map(e => {
        const ph = PHASES.find(x => x.key === phaseEquip(e)) || null
        let prods = ph ? Object.values(produitsParPhase.value[ph.key]).sort((x, y) => y.boites - x.boites) : []
        if (enCoursOnly.value) prods = prods.filter(p => produitsEnCours.value.has(p.code))
        return {
          ...e, phase: ph, prods,
          totalLots: prods.reduce((s, p) => s + p.lots, 0),
          totalBoites: prods.reduce((s, p) => s + p.boites, 0),
        }
      })
      .filter(e => match(e, e.prods))
    eqs.sort((x, y) => (x.phase ? x.phase.ordre : 99) - (y.phase ? y.phase.ordre : 99))
    const minOrdre = eqs.reduce((m, e) => Math.min(m, e.phase ? e.phase.ordre : 99), 99)
    return { ...a, eqs, minOrdre }
  }).filter(a => a.eqs.length > 0).sort((a, b) => a.minOrdre - b.minOrdre)
})

// KPIs globaux
const nbAteliers = computed(() => vue.value.length)
const nbEquipements = computed(() => equipements.value.length)
const nbProduitsDistincts = computed(() => {
  const s = new Set()
  for (const ph of PHASES) for (const c of Object.keys(produitsParPhase.value[ph.key])) {
    if (!enCoursOnly.value || produitsEnCours.value.has(c)) s.add(c)
  }
  return s.size
})

function fmt(n) { return n == null ? '—' : Number(n).toLocaleString('fr-FR') }
function fmtC(n) {
  if (n == null || isNaN(n)) return '—'
  if (Math.abs(n) >= 1000) return Number(n).toLocaleString('fr-FR', { notation: 'compact', maximumSignificantDigits: 2 })
  return Number(n).toLocaleString('fr-FR')
}

const kpis = computed(() => [
  { v: fmt(nbAteliers.value),         l: 'Ateliers',              tint: TINTS.indigo, ic: ICONS.factory },
  { v: fmt(nbEquipements.value),      l: 'Équipements',           tint: TINTS.blue,   ic: ICONS.gauge },
  { v: fmt(nbProduitsDistincts.value),l: enCoursOnly.value ? 'Produits en cours' : 'Produits fabriqués', tint: TINTS.teal, ic: ICONS.pill },
])

onMounted(async () => {
  const r = await supabase.auth.getSession()
  if (r.data && r.data.session) await charger()
  else chargement.value = false
})
</script>

<template>
  <div class="de-page">
    <PageHeader title="Disponibilité des produits par atelier" tone="cyan">
      <label class="annee-sel">Année de fabrication
        <select v-model.number="anneeSel">
          <option :value="0">Toutes années</option>
          <option v-for="a in anneesDispo" :key="a" :value="a">{{ a }}</option>
        </select>
      </label>
    </PageHeader>

    <p v-if="erreur" class="err">{{ erreur }}</p>
    <p v-if="chargement" class="muted">Chargement…</p>

    <template v-if="!chargement">
      <div class="flow">
        <template v-for="(ph, i) in PHASES" :key="ph.key">
          <span class="flow-step" :style="ph.tint"><span class="flow-ic"><svg viewBox="0 0 24 24" v-html="ph.ic"></svg></span>{{ ph.label }}</span>
          <span v-if="i < PHASES.length - 1" class="flow-arrow">→</span>
        </template>
      </div>

      <!-- Onglet « Fabriqués par équipement » supprimé : vue File d'attente uniquement -->

      <!-- ===================== FILE D'ATTENTE ===================== -->
      <div v-show="ongletDispo === 'file'">
        <section class="qual-box">
          <h3 class="qual-h">Charge, triage et déviations par atelier</h3>
          <p class="qual-sub">File de production</p>
          <div class="kpi-grid qual-kpis">
            <div class="kpi" v-for="(k, i) in kpisFile" :key="'f' + i">
              <div class="kpi-top"><span class="kpi-ic" :style="k.tint"><svg viewBox="0 0 24 24" v-html="k.ic"></svg></span><div class="kpi-val" :class="{ 'kpi-val-sm': k.small }">{{ k.v }}</div></div>
              <div class="kpi-lbl">{{ k.l }}</div>
            </div>
          </div>
          <p class="qual-sub">Qualité</p>
          <div class="kpi-grid qual-kpis">
            <div class="kpi" v-for="(k, i) in kpisQualite" :key="'q' + i">
              <div class="kpi-top"><span class="kpi-ic" :style="k.tint"><svg viewBox="0 0 24 24" v-html="k.ic"></svg></span><div class="kpi-val" :class="{ 'kpi-val-sm': k.small }">{{ k.v }}</div></div>
              <div class="kpi-lbl">{{ k.l }}</div>
            </div>
          </div>
          <p class="qual-sub">Détail par atelier</p>
          <table v-if="qualiteParAtelier.length" class="qual-tbl">
            <thead><tr><th>Atelier</th><th class="qcharge-h">Charge — lots en file</th><th class="qnum">Boîtes</th><th class="qnum">En triage</th><th class="qnum">Avec déviation</th><th class="qnum">Part dév.</th></tr></thead>
            <tbody>
              <template v-for="r in qualiteParAtelier" :key="r.label">
                <tr>
                  <td class="q-at">{{ r.label }}</td>
                  <td>
                    <div class="q-charge">
                      <div class="qc-bar"><div class="qc-fill" :style="{ width: r.pct + '%' }"></div></div>
                      <span class="qc-val">{{ fmt(r.tot) }}<span v-if="r.att" class="qc-att"> · {{ r.att }} att.</span><span v-if="r.enc" class="qc-enc"> · {{ r.enc }} en cours</span></span>
                    </div>
                  </td>
                  <td class="qnum q-bts" :title="fmt(r.btsAtt) + ' bts en attente · ' + fmt(r.btsEnc) + ' bts en cours'">{{ fmt(r.bts) }} <span class="unit">bts</span></td>
                  <td class="qnum" :class="{ 'q-warn': r.tri > 0 }">{{ r.tri || '—' }}</td>
                  <td class="qnum" :class="{ 'q-bad': r.dev > 0, 'q-clic': r.dev > 0 }" @click="toggleDev(r.label, r.dev)" :title="r.dev ? 'Voir les lots en déviation' : ''">
                    {{ r.dev || '—' }}<span v-if="r.dev" class="q-caret">{{ devOuvert === r.label ? '▾' : '▸' }}</span>
                  </td>
                  <td class="qnum" :class="{ 'q-bad': r.pctDev >= 20 }">{{ r.pctDev }}%</td>
                </tr>
                <tr v-if="devOuvert === r.label" class="q-detail">
                  <td colspan="6">
                    <table class="qd-tbl">
                      <thead><tr><th>N° lot</th><th>Produit</th><th>Déviation</th></tr></thead>
                      <tbody>
                        <tr v-for="l in r.devLots" :key="l.id" @click="ouvrirLot(l, l.pk)" title="Ouvrir le suivi de ce lot">
                          <td class="qd-lot">{{ l.lot }}</td>
                          <td>{{ l.code }}<span v-if="l.desig"> — {{ l.desig }}</span></td>
                          <td>
                            <span v-if="l.deviation" class="qd-tag qd-fab">Fabrication</span>
                            <span v-if="l.deviationCond" class="qd-tag qd-cond">Conditionnement</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </template>
            </tbody>
            <tfoot>
              <tr class="q-tot">
                <td class="q-at">Total</td>
                <td class="qc-tot">{{ fmt(qualiteTotaux.tot) }}<span v-if="qualiteTotaux.att" class="qc-att"> · {{ qualiteTotaux.att }} att.</span><span v-if="qualiteTotaux.enc" class="qc-enc"> · {{ qualiteTotaux.enc }} en cours</span></td>
                <td class="qnum q-bts">{{ fmt(qualiteTotaux.bts) }} <span class="unit">bts</span></td>
                <td class="qnum">{{ qualiteTotaux.tri || '—' }}</td>
                <td class="qnum" :class="{ 'q-clic': qualiteTotaux.dev > 0 }" @click="toggleDev('__tous__', qualiteTotaux.dev)" :title="qualiteTotaux.dev ? 'Voir tous les lots en déviation' : ''">
                  {{ qualiteTotaux.dev || '—' }}<span v-if="qualiteTotaux.dev" class="q-caret">{{ devOuvert === '__tous__' ? '▾' : '▸' }}</span>
                </td>
                <td class="qnum">{{ qualiteTotaux.pctDev }}%</td>
              </tr>
              <tr v-if="devOuvert === '__tous__'" class="q-detail">
                <td colspan="6">
                  <table class="qd-tbl">
                    <thead><tr><th>N° lot</th><th>Produit</th><th>Atelier</th><th>Déviation</th></tr></thead>
                    <tbody>
                      <tr v-for="l in devLotsTous" :key="l.atelier + '-' + l.id" @click="ouvrirLot(l, l.pk)" title="Ouvrir le suivi de ce lot">
                        <td class="qd-lot">{{ l.lot }}</td>
                        <td>{{ l.code }}<span v-if="l.desig"> — {{ l.desig }}</span></td>
                        <td>{{ l.atelier }}</td>
                        <td>
                          <span v-if="l.deviation" class="qd-tag qd-fab">Fabrication</span>
                          <span v-if="l.deviationCond" class="qd-tag qd-cond">Conditionnement</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tfoot>
          </table>
        </section>
        <div class="searchbar">
          <input v-model="recherche" type="text" placeholder="Rechercher un lot ou un produit…" />
          <label class="filtre-chk"><input type="checkbox" v-model="filtreUrgent" /> Urgents (&gt;{{ SEUIL_URGENT }} j)</label>
          <label class="filtre-chk"><input type="checkbox" v-model="filtrePerime" /> OF périmés</label>
        </div>        <h3 class="board-h">Fabrication — files par atelier</h3>
        <p class="note">
          Chaque lot apparaît dans l'atelier de son <strong>étape courante</strong> : « en cours » s'il y est démarré, « en attente » si l'étape précédente est terminée.
          Une file <strong>vide</strong> = atelier à sec (risque de rupture). Les lots les plus anciens sont en haut.
        </p>
        <p v-if="vueFile.length === 0" class="muted">Aucun lot en production actuellement (un lot apparaît dès qu'il est lancé et suivi phase par phase).</p>

        <div class="file-board">
        <section class="atelier">
          <h2 class="atelier-titre"><span class="at-name">OF planifiés</span>
            <span class="at-sum">{{ attenteReceptionList.length }} en attente de réception</span>
          </h2>
          <div class="eq-grid">
            <div class="card phase-card reception" :class="{ rupture: !attenteReceptionList.length }">
              <div class="eq-head">
                <div class="eq-ident">
                  <span class="eq-ic" :style="TINTS.slate"><svg viewBox="0 0 24 24" v-html="ICONS.clipboard"></svg></span>
                  <div><div class="eq-code">En attente de réception</div><div class="eq-nom">OF planifiés, non reçus</div></div>
                </div>
              </div>
              <div class="q-block">
                <div class="q-title attente">À recevoir — {{ attenteReceptionList.length }} OF</div>
                <div v-if="attenteReceptionList.length" class="prod-scroll">
                  <table class="grid"><tbody>
                    <tr v-for="l in attenteReceptionList" :key="l.id" class="lot-row" @click="ouvrirLot(l, 'pesee')" title="Ouvrir le suivi de fabrication de ce lot">
                      <td><span class="pf">{{ l.lot }}</span> <span class="pd">{{ l.desig }}</span><span v-if="l.validite" class="lot-sub">Validité : {{ fmtDate(l.validite) }}</span></td>
                      <td class="num">{{ fmt(l.boites) }} <span class="unit">bts</span></td>
                    </tr>
                  </tbody></table>
                </div>
                <p v-else class="empty">Aucun OF planifié en attente de réception.</p>
              </div>
            </div>
          </div>
        </section>
        <section class="atelier">
          <h2 class="atelier-titre"><span class="at-name">Réception OF</span>
            <span class="at-sum">{{ attentePeseeList.length }} en attente de pesée</span>
          </h2>
          <div class="eq-grid">
            <div class="card phase-card reception" :class="{ rupture: !attentePeseeList.length }">
              <div class="eq-head">
                <div class="eq-ident">
                  <span class="eq-ic" :style="TINTS.amber"><svg viewBox="0 0 24 24" v-html="ICONS.hourglass"></svg></span>
                  <div><div class="eq-code">En attente de pesée</div><div class="eq-nom">Reçus, avant pesée</div></div>
                </div>
              </div>
              <div class="q-block">
                <div class="q-title attente">À peser — {{ attentePeseeList.length }} lot(s)</div>
                <div v-if="attentePeseeList.length" class="prod-scroll">
                  <table class="grid"><tbody>
                    <tr v-for="l in attentePeseeList" :key="l.id" class="lot-row" :class="{ 'row-perime': l.perime }" @click="ouvrirLot(l, 'pesee')" title="Ouvrir le suivi de fabrication de ce lot">
                      <td><span class="pf">{{ l.lot }}</span> <span class="pd">{{ l.desig }}</span><span v-if="l.perime" class="perime-tag">OF périmé</span><span v-if="l.validite" class="lot-sub">Validité : {{ fmtDate(l.validite) }}</span></td>
                      <td class="num">{{ fmt(l.boites) }} <span class="unit">bts</span></td>
                      <td class="num age" :class="ageClass(l.date)" :title="l.date ? 'En stock depuis le ' + fmtDate(l.date) : ''">{{ joursDepuis(l.date) }}</td>
                    </tr>
                  </tbody></table>
                </div>
                <p v-else class="empty">Aucun lot en attente de pesée.</p>
              </div>
            </div>
          </div>
        </section>
        <section v-for="ph in vueFile" :key="ph.key" class="atelier">
          <h2 class="atelier-titre"><span class="at-name">Atelier de {{ ph.phase.label }}</span><span v-if="ph.plan" class="at-plan">Plan {{ fmtC(ph.plan) }} · Réalisé {{ fmtC(ph.realise) }} · <span :class="ph.taux >= 100 ? 'tx-ok' : 'tx-bas'">{{ ph.taux }}%</span></span>
            <span class="at-sum">{{ ph.attente.length }} en attente · {{ ph.cours.length }} en cours</span>
          </h2>
          <div class="eq-grid">
            <div class="card phase-card" :class="{ rupture: !ph.attente.length && !ph.cours.length }">
              <div class="eq-head">
                <div class="eq-ident">
                  <span class="eq-ic" :style="ph.phase.tint"><svg viewBox="0 0 24 24" v-html="ph.phase.ic"></svg></span>
                  <div><div class="eq-code">{{ ph.phase.label }}</div><div class="eq-nom">File de l'atelier</div></div>
                </div>
                <span v-if="!ph.attente.length && !ph.cours.length" class="phase-badge rupt-badge">À sec ⚠</span>
              </div>

              <div class="q-block">
                <div class="q-title cours">En cours — {{ ph.cours.length }} lot(s) · {{ fmtC(ph.volCours) }} bts</div>
                <div v-if="ph.cours.length" class="prod-scroll">
                  <table class="grid"><tbody>
                    <tr v-for="l in ph.cours" :key="l.id" class="lot-row" :class="{ 'en-triage': l.triage }" @click="ouvrirLot(l, ph.phase.key)" title="Ouvrir le suivi de fabrication de ce lot">
                      <td><span class="pf">{{ l.lot }}</span> <span class="pd">{{ l.desig }}</span><span v-if="l.perime" class="perime-tag">OF périmé</span><span v-if="l.validite" class="lot-sub">Validité : {{ fmtDate(l.validite) }}</span></td>
                      <td class="num">{{ fmt(l.boites) }} <span class="unit">bts</span></td>
                      <td class="num age" :class="ageClass(l.date)" :title="l.date ? 'En stock depuis le ' + fmtDate(l.date) : ''">{{ joursDepuis(l.date) }}</td>
                    </tr>
                  </tbody></table>
                </div>
                <p v-else class="empty">Aucun lot en cours.</p>
              </div>

              <div class="q-block">
                <div class="q-title attente">En attente — {{ ph.attente.length }} lot(s) · {{ fmtC(ph.volAttente) }} bts</div>
                <div v-if="ph.attente.length" class="prod-scroll">
                  <table class="grid"><tbody>
                    <tr v-for="l in ph.attente" :key="l.id" class="lot-row" :class="{ 'en-triage': l.triage }" @click="ouvrirLot(l, ph.phase.key)" title="Ouvrir le suivi de fabrication de ce lot">
                      <td><span class="pf">{{ l.lot }}</span> <span class="pd">{{ l.desig }}</span><span v-if="l.perime" class="perime-tag">OF périmé</span><span v-if="l.validite" class="lot-sub">Validité : {{ fmtDate(l.validite) }}</span></td>
                      <td class="num">{{ fmt(l.boites) }} <span class="unit">bts</span></td>
                      <td class="num age" :class="ageClass(l.date)" :title="l.date ? 'En stock depuis le ' + fmtDate(l.date) : ''">{{ joursDepuis(l.date) }}</td>
                    </tr>
                  </tbody></table>
                </div>
                <p v-else class="empty">Rien en attente.</p>
              </div>
            </div>
          </div>
        </section>
        </div>

        <h3 class="board-h">Conditionnement — planning par ligne réservée</h3>
        <p class="note">Chaque colonne = une <strong>ligne de conditionnement réservée</strong> (champ « Ligne / équipement » de l'ordre de fabrication). Les lots fabriqués non encore conditionnés y sont regroupés. « Non réservé » = lots sans ligne assignée.</p>
        <p v-if="!vueCondLignes.length" class="muted">Aucun lot à conditionner pour le moment.</p>
        <div class="file-board">
          <section v-for="g in vueCondLignes" :key="g.id" class="atelier">
            <h2 class="atelier-titre"><span class="at-name">{{ g.label }}</span>
              <span class="at-sum">{{ g.attente.length }} en attente · {{ g.cours.length }} en cours</span>
            </h2>
            <div class="eq-grid">
              <div class="card phase-card" :class="{ rupture: !g.reserve || !g.tot }">
                <div class="eq-head">
                  <div class="eq-ident">
                    <span class="eq-ic" :style="TINTS.green"><svg viewBox="0 0 24 24" v-html="ICONS.box"></svg></span>
                    <div><div class="eq-code">Conditionnement</div><div class="eq-nom">{{ g.reserve ? 'Ligne réservée' : 'Sans réservation' }}</div></div>
                  </div>
                  <span v-if="!g.reserve" class="phase-badge rupt-badge">à affecter</span>
                  <span v-else-if="!g.tot" class="phase-badge rupt-badge">Libre</span>
                </div>
                <div class="q-block">
                  <div class="q-title cours">En cours — {{ g.cours.length }} lot(s) · {{ fmtC(g.volCours) }} bts</div>
                  <div v-if="g.cours.length" class="prod-scroll">
                    <table class="grid"><tbody>
                      <tr v-for="l in g.cours" :key="l.id" class="lot-row" :class="{ 'en-triage': l.triage }" @click="ouvrirLot(l, 'conditionnement')" title="Ouvrir ce lot dans le conditionnement">
                        <td><span class="pf">{{ l.lot }}</span> <span class="pd">{{ l.desig }}</span><span v-if="l.perime" class="perime-tag">OF périmé</span><span v-if="l.validite" class="lot-sub">Validité : {{ fmtDate(l.validite) }}</span></td>
                        <td class="num">{{ fmt(l.boites) }} <span class="unit">bts</span></td>
                        <td class="num age" :class="ageClass(l.date)" :title="l.date ? 'En stock depuis le ' + fmtDate(l.date) : ''">{{ joursDepuis(l.date) }}</td>
                      </tr>
                    </tbody></table>
                  </div>
                  <p v-else class="empty">Aucun lot en cours.</p>
                </div>
                <div class="q-block">
                  <div class="q-title attente">En attente — {{ g.attente.length }} lot(s) · {{ fmtC(g.volAttente) }} bts</div>
                  <div v-if="g.attente.length" class="prod-scroll">
                    <table class="grid"><tbody>
                      <tr v-for="l in g.attente" :key="l.id" class="lot-row" :class="{ 'en-triage': l.triage }" @click="ouvrirLot(l, 'conditionnement')" title="Ouvrir ce lot dans le conditionnement">
                        <td><span class="pf">{{ l.lot }}</span> <span class="pd">{{ l.desig }}</span><span v-if="l.perime" class="perime-tag">OF périmé</span><span v-if="l.validite" class="lot-sub">Validité : {{ fmtDate(l.validite) }}</span></td>
                        <td class="num">{{ fmt(l.boites) }} <span class="unit">bts</span></td>
                        <td class="num age" :class="ageClass(l.date)" :title="l.date ? 'En stock depuis le ' + fmtDate(l.date) : ''">{{ joursDepuis(l.date) }}</td>
                      </tr>
                    </tbody></table>
                  </div>
                  <p v-else class="empty">Rien en attente.</p>
                </div>
              </div>
            </div>
          </section>
        </div>
        <section class="triage-box">
          <div class="triage-head">
            <h3 class="triage-h">🔍 Lots en cours de triage ({{ lotsTriage.length }})</h3>
            <label class="sac-poids">Poids du sac<input type="number" min="0.1" step="any" v-model.number="poidsSac" /> Kg</label>
          </div>
          <p v-if="majSac" class="sac-err">{{ majSac }}</p>
          <table v-if="lotsTriage.length" class="triage-tbl">
            <thead><tr><th>N° lot</th><th>Produit</th><th>Étape</th><th class="tnum">À trier (Kg)</th><th class="tnum">Triée (Kg)</th><th class="tnum">Sacs conformes</th><th>Avancement</th><th></th></tr></thead>
            <tbody>
              <template v-for="l in lotsTriage" :key="l.id">
              <tr class="triage-row">
                <td class="t-lot" @click="ouvrirTriageFin(l.id)" title="Ouvrir l'étape en triage pour saisir la date de fin">{{ l.lot }}</td>
                <td @click="ouvrirTriageFin(l.id)">{{ l.code }} — {{ l.desig }}</td>
                <td>{{ l.equip }}<span v-if="l.phase"> · {{ l.phase }}</span></td>
                <td class="tnum"><input type="number" min="0" step="any" v-model.number="qteEdit[l.id].aTrier" class="tq" @click.stop /></td>
                <td class="tnum"><input type="number" min="0" step="any" v-model.number="qteEdit[l.id].triee" class="tq" @click.stop /></td>
                <td class="tnum">
                  <button type="button" class="sac-btn" :class="{ ok: nbSacs(l) > 0 && nbSacsCoches(l) >= nbSacs(l) }" :disabled="!nbSacs(l)" @click.stop="toggleSacs(l)" :title="nbSacs(l) ? 'Détail des sacs' : 'Renseigne les Kg à trier et le poids du sac'">
                    {{ nbSacsCoches(l) }} / {{ nbSacs(l) || '—' }}<span v-if="nbSacs(l)" class="sac-caret">{{ sacsOuvert === l.id ? '▾' : '▸' }}</span>
                  </button>
                </td>
                <td class="t-prog">
                  <div class="tp-bar"><div class="tp-fill" :class="{ full: pctTriage(l.id) >= 100 }" :style="{ width: pctTriage(l.id) + '%' }"></div></div>
                  <span class="tp-pct">{{ pctTriage(l.id) }}%</span>
                </td>
                <td><button class="tq-save" @click.stop="sauverTriage(l)" title="Enregistrer">💾</button></td>
              </tr>
              <tr v-if="sacsOuvert === l.id && nbSacs(l)" class="sac-detail">
                <td colspan="8">
                  <div class="sac-bar">
                    <span class="sac-tit">{{ nbSacs(l) }} sacs de {{ poidsSac }} Kg — coche un sac quand son triage est terminé et conforme</span>
                    <button type="button" class="sac-act" @click="cocherTousSacs(l)">Tout cocher</button>
                    <button type="button" class="sac-act" @click="decocherTousSacs(l)">Tout décocher</button>
                  </div>
                  <div class="sac-grid">
                    <button v-for="n in nbSacs(l)" :key="n" type="button" class="sac-chip" :class="{ on: sacCoche(l, n) }" @click="basculerSac(l, n)" :title="'Sac ' + n + (sacCoche(l, n) ? ' — conforme' : ' — à trier')">
                      <span class="sac-tick">{{ sacCoche(l, n) ? "✓" : "" }}</span>{{ n }}
                    </button>
                  </div>
                  <div class="sac-pied">{{ nbSacsCoches(l) }} / {{ nbSacs(l) }} sacs conformes · {{ pctSacs(l) }} % · {{ fmt(kgSacs(l)) }} Kg reportés automatiquement dans « Triée (Kg) »<span v-if="nbSacs(l) > 1"> · dernier sac : {{ fmt(Math.round((((qteEdit[l.id] || {}).aTrier || 0) - (nbSacs(l) - 1) * poidsSac) * 100) / 100) }} Kg</span></div>
                </td>
              </tr>
              </template>
            </tbody>
          </table>
          <p v-else class="triage-vide">Aucun lot coché « En triage fabrication » pour l'instant (case à cocher sur la page Ordres de fabrication).</p>
        </section>
      </div>

      <!-- ===================== RÉTROSPECTIVE ===================== -->
      <div v-show="ongletDispo === 'retro'">
      <div class="kpi-grid k3">
        <div class="kpi" v-for="(k, i) in kpis" :key="i">
          <div class="kpi-top">
            <span class="kpi-ic" :style="k.tint"><svg viewBox="0 0 24 24" v-html="k.ic"></svg></span>
            <div class="kpi-val" :class="{ 'kpi-val-sm': k.small }">{{ k.v }}</div>
          </div>
          <div class="kpi-lbl">{{ k.l }}</div>
        </div>
      </div>

      <div class="searchbar">
        <input v-model="recherche" type="text" placeholder="Rechercher un équipement, un type ou un produit…" />
        <label class="chk"><input type="checkbox" v-model="enCoursOnly" /> Uniquement les produits en cours</label>
      </div>

      <p class="note">
        Un produit apparaît sous un équipement dès qu'un de ses lots passe par la phase correspondante.
        Les équipements d'un même type partagent la même liste (la machine exacte n'est pas tracée par lot).
        Un produit est « en cours » s'il a au moins un lot lancé et non terminé.
      </p>

      <p v-if="vue.length === 0" class="muted">Aucun équipement ne correspond.</p>

      <section v-for="a in vue" :key="a.id" class="atelier">
        <h2 class="atelier-titre">{{ a.code }} — {{ a.nom }}</h2>
        <div class="eq-grid">
          <div v-for="e in a.eqs" :key="e.id" class="card eq-card">
            <div class="eq-head">
              <div class="eq-ident">
                <span class="eq-ic" :style="e.phase ? e.phase.tint : { background: '#f1f5f9', color: '#94a3b8' }">
                  <svg viewBox="0 0 24 24" v-html="e.phase ? e.phase.ic : ICONS.gauge"></svg>
                </span>
                <div>
                  <div class="eq-code">{{ e.code }}</div>
                  <div class="eq-nom">{{ e.nom }}</div>
                </div>
              </div>
              <span v-if="e.phase" class="phase-badge" :style="e.phase.tint">{{ e.phase.label }}</span>
              <span v-else class="phase-badge muted-badge">type non reconnu</span>
            </div>

            <div class="eq-stats">
              <span><strong>{{ fmt(e.prods.length) }}</strong> produits</span>
              <span><strong>{{ fmt(e.totalLots) }}</strong> lots</span>
              <span><strong>{{ fmtC(e.totalBoites) }}</strong> boîtes</span>
            </div>

            <div v-if="e.prods.length" class="prod-scroll">
              <table class="grid">
                <thead>
                  <tr><th>Produit</th><th class="num">Lots</th><th class="num">Boîtes</th></tr>
                </thead>
                <tbody>
                  <tr v-for="p in e.prods" :key="p.code">
                    <td><span class="pf">{{ p.code }}</span> <span class="pd">{{ p.desig }}</span></td>
                    <td class="num">{{ fmt(p.lots) }}</td>
                    <td class="num">{{ fmt(p.boites) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="empty">
              {{ e.phase ? (enCoursOnly ? 'Aucun produit en cours sur cette phase.' : 'Aucun produit sur cette phase pour l\'année sélectionnée.') : 'Type non associé à une phase (Granulation, Mélange, Compression, Pelliculage, Conditionnement).' }}
            </p>
          </div>
        </div>
      </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.de-page { color: #1b2733; }
.de-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin: 4px 0 18px; }
.de-head h1 { margin: 0; font-size: 24px; letter-spacing: -0.01em; }
.sub { margin: 4px 0 0; color: #64748b; font-size: 14px; }
.annee-sel { font-size: 13px; color: #475569; display: flex; flex-direction: column; gap: 4px; }
.annee-sel select { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; background: #fff; }
.err { color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; }
.muted { color: #94a3b8; }
.note { color: #64748b; font-size: 11px; background: #f8fafc; border: 1px solid #eef2f6; border-radius: 7px; padding: 6px 10px; margin: 0 0 10px; }

.kpi-grid { display: grid; gap: 14px; margin-bottom: 14px; }
.k3 { grid-template-columns: repeat(3, 1fr); }
.kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.kpi-val { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
.kpi-lbl { font-size: 12px; color: #64748b; margin-top: 4px; }

.searchbar { margin-bottom: 14px; }
.flow { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 12px 14px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 1px 2px rgba(16,24,40,.04); margin-bottom: 16px; }
.flow-step { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; padding: 5px 11px; border-radius: 999px; }
.flow-ic { display: inline-flex; }
.flow-ic svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.flow-arrow { color: #cbd5e1; font-weight: 700; }
.searchbar { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.searchbar input[type=text] { flex: 1; min-width: 240px; max-width: 460px; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; }
.chk { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; color: #475569; cursor: pointer; white-space: nowrap; }
.chk input { width: 15px; height: 15px; cursor: pointer; }

.atelier { margin-bottom: 26px; }
.atelier-titre { font-size: 11px; font-weight: 700; margin: 0 0 7px; color: #0f172a; border-left: 3px solid #0f766e; padding-left: 8px; line-height: 1.2; }
.at-plan { display: block; font-size: 11px; font-weight: 600; color: #64748b; margin-top: 3px; }
.tx-ok { color: #15803d; font-weight: 800; }
.tx-bas { color: #dc2626; font-weight: 800; }
/* Réserve 2 lignes pour le nom -> titres 1 ligne alignés sur les titres 2 lignes (cartes homogènes) */
.at-name { display: block; min-height: 2.5em; }
.at-sum { display: block; font-size: 10.5px; font-weight: 500; color: #64748b; margin: 2px 0 0 11px; }
/* File d'attente en colonnes (façon Kanban) */
.file-board { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; align-items: stretch; }
.board-h { font-size: 15px; font-weight: 800; letter-spacing: -0.01em; color: #0f172a; margin: 26px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0; }
.board-h:first-of-type { margin-top: 6px; }
.cond-plan-h { font-size: 17px; font-weight: 700; margin: 26px 0 6px; color: #0f172a; }
.file-board .atelier { margin-bottom: 0; }
.file-board .eq-grid { grid-template-columns: 1fr; flex: 1; }
.file-board .phase-card { height: 100%; }
.file-board .atelier { min-width: 0; display: flex; flex-direction: column; }
.file-board .prod-scroll { overflow-x: hidden; height: 180px; }
/* Hauteur fixe des boites internes -> toutes les cartes a la meme hauteur */
.file-board .q-block .empty { height: 180px; display: flex; align-items: center; justify-content: center; }
/* Réception OF (1 seul bloc) : son bloc remplit la carte -> meme hauteur que les cartes a 2 blocs */
.file-board .reception .q-block { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.file-board .reception .prod-scroll { flex: 1; height: auto; min-height: 0; max-height: 282px; }
.file-board .reception .q-block .empty { flex: 1; height: auto; min-height: 0; }
/* Bloc En cours = souvent 1 seul lot -> plus court (En attente garde 180px pour plusieurs lots) */
.file-board .q-block:has(.q-title.cours) .prod-scroll { height: 72px; }
.file-board .q-block:has(.q-title.cours) .empty { height: 72px; }
.pf, .pd { overflow-wrap: anywhere; }
.lot-row { cursor: pointer; }
.lot-row:hover td { background: #f0f9ff; }
.lot-row:hover .pf { color: #0891b2; text-decoration: underline; }
.perime-tag { display: inline-block; margin-left: 6px; font-size: 10px; font-weight: 700; color: #b91c1c; background: #fee2e2; padding: 1px 6px; border-radius: 999px; }
.lot-sub { display: block; font-size: 10.5px; color: #64748b; margin-top: 2px; }
.unit { font-size: 10px; color: #94a3b8; font-weight: 500; }
.row-perime td { background: #fff5f6; }
/* Onglets */
.de-tabs { display: flex; gap: 4px; background: #fff; border: 1px solid #e9edf2; border-radius: 12px; padding: 5px; margin: 0 0 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); width: fit-content; }
.de-tabs button { background: none; border: 0; padding: 9px 16px; font-size: 14px; font-weight: 600; color: #64748b; cursor: pointer; border-radius: 8px; font-family: inherit; transition: color .15s ease, background .15s ease; }
.de-tabs button:hover { color: #0891b2; }
.de-tabs button.on { color: #0891b2; background: #ecfeff; }
/* Cartes de file */
.phase-card { display: flex; flex-direction: column; gap: 7px; padding: 11px 12px !important; border-radius: 11px !important; }
.phase-card.rupture { border-color: #fecdd3; background: #fff5f6; }
.rupt-badge { background: #fee2e2; color: #b91c1c; }
.q-block { border-top: 1px solid #f1f5f9; padding-top: 6px; }
.q-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; margin-bottom: 4px; }
.q-title.cours { color: #2563eb; }
.q-title.attente { color: #b45309; }
.age { color: #64748b; font-variant-numeric: tabular-nums; white-space: nowrap; }
.age.age-warn { color: #b45309; font-weight: 700; }
.age.age-danger { color: #b91c1c; font-weight: 700; }
.eq-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.eq-card { display: flex; flex-direction: column; }
.eq-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px; }
.eq-ident { display: flex; align-items: center; gap: 10px; min-width: 0; }
.eq-ic { width: 27px; height: 27px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.eq-ic svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.eq-code { font-weight: 700; font-size: 13px; }
.eq-nom { font-size: 10.5px; color: #64748b; }
.phase-badge { font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
.muted-badge { background: #f1f5f9; color: #94a3b8; }

.eq-stats { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12px; color: #64748b; padding: 8px 0 10px; border-top: 1px solid #f1f5f9; }
.eq-stats strong { color: #0f172a; font-size: 14px; }

.prod-scroll { max-height: 230px; overflow-y: auto; border: 1px solid #eef2f6; border-radius: 7px; }
.grid { width: 100%; border-collapse: collapse; }
.grid th { position: sticky; top: 0; background: #f8fafc; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
.grid td { padding: 4px 7px; border-bottom: 1px solid #f1f5f9; font-size: 11.5px; }
.grid tr:last-child td { border-bottom: none; }
.num { text-align: right; white-space: nowrap; }
.pf { font-weight: 600; color: #0f766e; }
.pd { color: #475569; }
.empty { font-size: 11px; color: #94a3b8; margin: 3px 0 0; }
/* Cadre interne harmonisé : le bloc vide a le même encadré que le tableau (.prod-scroll) */
.q-block .empty { border: 1px solid #eef2f6; border-radius: 7px; background: #f8fafc; padding: 12px 10px; text-align: center; margin: 0; }
/* redeploy 2026-08-06 */
/* Ultra compact */
.de-head h1 { font-size: 15px; }
.sub { font-size: 10px; margin-top: 2px; }
.de-head { margin-bottom: 6px; }
.annee-sel select { padding: 5px 8px; font-size: 12px; }
.err { padding: 6px 10px; font-size: 12px; }
.note { padding: 4px 8px; margin: 0 0 6px; font-size: 10px; }
.kpi { padding: 8px 11px; border-radius: 10px; }
.kpi-val { font-size: 16px; }
.kpi-lbl { font-size: 9.5px; margin-top: 2px; }
.flow { padding: 7px 10px; gap: 4px; margin-bottom: 8px; }
.flow-step { font-size: 10.5px; padding: 3px 8px; }
.searchbar input[type=text] { padding: 6px 10px; font-size: 12px; }
.chk { font-size: 11.5px; }
.atelier-titre { font-size: 10.5px; margin: 0 0 5px; }
.at-plan { font-size: 10px; }
.at-sum { font-size: 9.5px; }
.board-h { font-size: 13px; margin: 12px 0 7px; }
.cond-plan-h { font-size: 14px; margin: 12px 0 5px; }
.de-tabs { margin: 0 0 8px; padding: 3px; }
.de-tabs button { font-size: 12px; padding: 6px 12px; }
.phase-card { padding: 7px 9px !important; gap: 4px; }
.q-title { font-size: 9.5px; margin-bottom: 3px; }
.card { padding: 9px 11px; }
.eq-code { font-size: 12px; }
.eq-nom { font-size: 9.5px; }
.eq-stats { font-size: 11px; padding: 5px 0 6px; gap: 10px; }
.eq-stats strong { font-size: 12px; }
.phase-badge { font-size: 10px; padding: 2px 8px; }
.grid th { font-size: 10px; padding: 4px 6px; }
.grid td { padding: 2px 6px; font-size: 10.5px; }
.lot-sub { font-size: 9.5px; }
.q-block .empty { padding: 8px; }
/* Encore plus compact */
.de-head h1 { font-size: 13px; }
.sub { display: none; }
.de-head { margin-bottom: 5px; }
.kpi { padding: 6px 9px; }
.kpi-val { font-size: 14px; }
.kpi-lbl { font-size: 9px; }
.flow { padding: 5px 8px; margin-bottom: 6px; gap: 3px; }
.flow-step { font-size: 9.5px; padding: 2px 6px; }
.searchbar input[type=text] { padding: 5px 8px; font-size: 11px; }
.atelier-titre { font-size: 11px; margin: 0 0 4px; }
.at-plan { font-size: 9.5px; }
.at-sum { font-size: 9px; }
.board-h { font-size: 12px; margin: 9px 0 5px; }
.cond-plan-h { font-size: 12px; margin: 9px 0 4px; }
.de-tabs button { font-size: 11px; padding: 5px 10px; }
.phase-card { padding: 5px 7px !important; gap: 3px; }
.card { padding: 6px 9px; }
.eq-code { font-size: 11px; }
.eq-nom { font-size: 9px; }
.eq-stats { font-size: 10px; padding: 4px 0 5px; gap: 8px; }
.eq-stats strong { font-size: 11px; }
.phase-badge { font-size: 9.5px; padding: 2px 7px; }
.grid th { font-size: 9.5px; padding: 3px 5px; }
.grid td { padding: 2px 5px; font-size: 10px; }
.lot-sub { font-size: 9px; }
/* Réduction maximale */
.flow { display: none; }
.note { display: none; }
.de-head h1 { font-size: 12px; }
.de-head { margin-bottom: 4px; }
.kpi { padding: 5px 8px; }
.kpi-val { font-size: 13px; }
.board-h { font-size: 11px; margin: 6px 0 4px; padding-bottom: 4px; }
.cond-plan-h { font-size: 11px; margin: 6px 0 4px; }
.de-tabs { margin: 0 0 6px; padding: 2px; }
.de-tabs button { font-size: 10.5px; padding: 4px 9px; }
.card { padding: 5px 8px; }
.phase-card { padding: 4px 6px !important; gap: 3px; }
.eq-stats { padding: 3px 0 4px; gap: 7px; font-size: 9.5px; }
.eq-stats strong { font-size: 10.5px; }
.grid th { font-size: 9px; padding: 2px 5px; }
.grid td { padding: 1px 5px; font-size: 9.5px; }
.atelier-titre { font-size: 10.5px; margin: 0 0 3px; }
.searchbar input[type=text] { padding: 4px 8px; font-size: 10.5px; }
/* Réduction supplémentaire de résolution */
.de-head h1 { font-size: 12px; }
.sub { display: none; }
.flow { display: none; }
.note { display: none; }
.de-head { margin-bottom: 4px; }
.kpi { padding: 5px 8px; }
.kpi-val { font-size: 13px; }
.kpi-lbl { font-size: 9px; }
.board-h { font-size: 11px; margin: 6px 0 4px; padding-bottom: 4px; }
.cond-plan-h { font-size: 11px; margin: 6px 0 4px; }
.card { padding: 5px 8px; }
.phase-card { padding: 4px 6px !important; gap: 3px; }
.eq-stats { padding: 3px 0 4px; gap: 7px; font-size: 9.5px; }
.eq-stats strong { font-size: 10.5px; }
.grid th { font-size: 9px; padding: 2px 5px; }
.grid td { padding: 1px 5px; font-size: 9.5px; }
.atelier-titre { font-size: 10.5px; margin: 0 0 3px; }
.at-plan { font-size: 9px; }
.searchbar input[type=text] { padding: 4px 8px; font-size: 10.5px; }
/* Qualité — triage et déviations */
.qual-box { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin-bottom: 18px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.qual-h { margin: 0 0 12px; font-size: 15px; font-weight: 800; color: #0f172a; }
.qual-kpis { grid-template-columns: repeat(auto-fit, minmax(158px, 1fr)); gap: 9px; margin-bottom: 12px; }
.qual-kpis .kpi { padding: 10px 12px; border-radius: 10px; box-shadow: none; }
.qual-kpis .kpi-val { font-size: 19px; }
.qual-kpis .kpi-val-sm { font-size: 13px; }
.qual-kpis .kpi-lbl { font-size: 10.5px; margin-top: 2px; line-height: 1.25; }
.qual-sub { margin: 0 0 6px; font-size: 10px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; color: #94a3b8; }
.qual-tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.qual-tbl th { text-align: left; font-size: 11px; color: #64748b; font-weight: 700; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
.qual-tbl td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; color: #1e293b; }
.qual-tbl .qnum { text-align: right; white-space: nowrap; }
.qual-tbl .q-at { font-weight: 600; }
.qual-tbl .q-warn { color: #b45309; font-weight: 700; }
.qual-tbl .q-bad { color: #dc2626; font-weight: 700; }
.qual-tbl .q-bts { color: #0f766e; font-weight: 700; }
.qual-tbl .q-bts .unit { font-size: 10px; font-weight: 600; color: #94a3b8; }
.qual-tbl .q-tot td { border-top: 2px solid #e2e8f0; border-bottom: none; font-weight: 800; background: #f8fafc; }
.qual-tbl .qcharge-h { min-width: 190px; }
.q-charge { display: flex; align-items: center; gap: 9px; }
.qc-bar { flex: 1; min-width: 60px; height: 13px; background: #ecfeff; border-radius: 999px; overflow: hidden; }
.qc-fill { height: 100%; background: linear-gradient(90deg, #22d3ee, #0891b2); border-radius: 999px; min-width: 2px; transition: width .3s ease; }
.qc-val { font-size: 12px; font-weight: 800; color: #0891b2; white-space: nowrap; }
.qc-att { font-weight: 600; color: #94a3b8; font-size: 10px; }
.qc-enc { font-weight: 600; color: #64748b; font-size: 10px; }
.qc-tot { font-size: 13px; font-weight: 800; color: #0891b2; white-space: nowrap; }
.qual-tbl .q-clic { cursor: pointer; user-select: none; }
.qual-tbl .q-clic:hover { text-decoration: underline; }
.q-caret { font-size: 9px; margin-left: 4px; color: #94a3b8; }
.q-detail > td { background: #fff7f7; padding: 8px 10px; }
.qd-tbl { width: 100%; border-collapse: collapse; font-size: 12px; }
.qd-tbl th { text-align: left; font-size: 10px; color: #94a3b8; font-weight: 700; padding: 3px 6px; }
.qd-tbl td { padding: 4px 6px; border-top: 1px solid #fee2e2; color: #1e293b; }
.qd-tbl tbody tr { cursor: pointer; transition: background .12s; }
.qd-tbl tbody tr:hover { background: #fee2e2; }
.qd-lot { font-weight: 700; }
.qd-tag { display: inline-block; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 999px; margin-right: 4px; }
.qd-fab { background: #fee2e2; color: #b91c1c; }
.qd-cond { background: #ffe4e6; color: #9f1239; }
/* Lots en cours de triage */
.triage-head { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.sac-poids { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: #92400e; white-space: nowrap; }
.sac-poids input { width: 62px; padding: 3px 6px; border: 1px solid #fcd34d; border-radius: 6px; font: inherit; font-size: 12px; text-align: right; }
.sac-err { margin: 6px 0 0; font-size: 12px; font-weight: 700; color: #b91c1c; }
.sac-btn { background: none; border: 1px solid #e2e8f0; border-radius: 7px; padding: 2px 8px; font: inherit; font-size: 12px; font-weight: 800; color: #b45309; cursor: pointer; white-space: nowrap; }
.sac-btn:hover:not(:disabled) { background: #fffbeb; border-color: #fcd34d; }
.sac-btn:disabled { opacity: .45; cursor: default; color: #94a3b8; }
.sac-btn.ok { color: #15803d; border-color: #86efac; background: #f0fdf4; }
.sac-caret { font-size: 9px; margin-left: 4px; color: #94a3b8; }
.sac-detail > td { background: #fffdf5; padding: 10px 12px; }
.sac-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
.sac-tit { font-size: 11px; font-weight: 700; color: #92400e; }
.sac-act { background: #fff; border: 1px solid #fcd34d; border-radius: 999px; padding: 2px 10px; font: inherit; font-size: 11px; font-weight: 700; color: #b45309; cursor: pointer; }
.sac-act:hover { background: #fef3c7; }
.sac-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.sac-chip { display: inline-flex; align-items: center; gap: 3px; min-width: 46px; justify-content: center; padding: 5px 8px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; font: inherit; font-size: 12px; font-weight: 700; color: #64748b; cursor: pointer; transition: background .12s, border-color .12s, color .12s; }
.sac-chip:hover { border-color: #fcd34d; background: #fffbeb; }
.sac-chip.on { background: #dcfce7; border-color: #86efac; color: #15803d; }
.sac-tick { font-size: 11px; }
.sac-pied { margin-top: 8px; font-size: 11px; font-weight: 700; color: #64748b; }
.triage-box { background: #fef3c7; border: 1px solid #fde68a; border-radius: 12px; padding: 14px 16px; margin-bottom: 18px; }
.triage-h { margin: 0 0 10px; font-size: 15px; font-weight: 800; color: #92400e; }
.triage-tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.triage-tbl th { text-align: left; font-size: 11px; color: #a16207; padding: 4px 8px; border-bottom: 1px solid #fde68a; }
.triage-tbl td { padding: 5px 8px; border-bottom: 1px solid #fde68a55; color: #451a03; }
.triage-tbl .t-lot { font-weight: 700; cursor: pointer; }
.triage-tbl .tnum { text-align: right; white-space: nowrap; }
.triage-tbl .tq { width: 72px; text-align: right; font: inherit; padding: 3px 6px; border: 1px solid #fcd34d; border-radius: 6px; background: #fffef7; }
.t-prog { display: flex; align-items: center; gap: 8px; min-width: 150px; }
.tp-bar { flex: 1; height: 9px; background: #fde68a; border-radius: 6px; overflow: hidden; }
.tp-fill { height: 100%; background: #f59e0b; border-radius: 6px; transition: width .2s; }
.tp-fill.full { background: #16a34a; }
.tp-pct { font-size: 11.5px; font-weight: 800; color: #92400e; min-width: 34px; text-align: right; }
.tq-save { background: #f59e0b; color: #fff; border: none; border-radius: 6px; padding: 3px 8px; cursor: pointer; font-size: 13px; }
.tq-save:hover { background: #d97706; }
.triage-row { cursor: pointer; transition: background .12s; }
.triage-row:hover { background: #fde68a; }
.triage-row:hover .t-lot { text-decoration: underline; }
.lot-row.en-triage { background: #fef3c7; }
.lot-row.en-triage > td:first-child { box-shadow: inset 3px 0 0 #f59e0b; }
.lot-row.en-triage .pf::after { content: ' 🔍 triage'; color: #b45309; font-size: .78em; font-weight: 700; }
.lot-row.en-triage-cond { background: #fef3c7; }
.lot-row.en-triage-cond > td:first-child { box-shadow: inset 3px 0 0 #f59e0b; }
.lot-row.en-triage-cond .pf::after { content: ' 🔍 triage cond.'; color: #b45309; font-size: .78em; font-weight: 700; }
.triage-vide { font-size: 12px; color: #92400e; margin: 0; }
.triage-vide code { background: #fde68a; padding: 1px 5px; border-radius: 4px; font-size: 11px; }

/* ============================================================= *
 * Refonte moderne — couche de surcharge (cohérence cyan)
 * ============================================================= */
.de-page :deep(h1) { font-size: 20px !important; }
.card, .kpi { border-color: #e0edf1 !important; border-radius: 13px !important; box-shadow: 0 1px 3px rgba(8,145,178,.05) !important; }
.kpi-val { color: #0891b2 !important; }
.atelier-titre { color: #0e7490 !important; font-weight: 800 !important; letter-spacing: -.01em; border-left: 3px solid #06b6d4; padding-left: 8px; }
.q-title, .card-title { color: #0e7490 !important; font-weight: 800 !important; letter-spacing: -.01em; }
.q-title { border-left: 3px solid #22d3ee; padding-left: 7px; }

/* Bloc atelier / équipement */
.atelier { border-color: #e0edf1 !important; border-radius: 13px !important; }
.eq-head { border-bottom-color: #e6f4f7 !important; }
.eq-ic { color: #0891b2 !important; background: #ecfeff !important; }
.phase-card { border-color: #e6f4f7 !important; border-radius: 11px !important; }

/* Tableaux */
.grid th { color: #0891b2 !important; background: #ecfeff !important; }
.lot-row:hover td, .lot-row:hover { background: #f2fdff; }

/* Onglets */
.de-tabs button.on { color: #0891b2 !important; background: #ecfeff !important; box-shadow: inset 0 -2px 0 #06b6d4; }

/* Badges / puces */
.phase-badge { background: #ecfeff !important; color: #0e7490 !important; border-color: #a5f0fc !important; }
.attente { color: #0891b2; }

/* Champs / focus */
select:focus, input:focus { outline: none !important; border-color: #06b6d4 !important; box-shadow: 0 0 0 3px rgba(6,182,212,.12) !important; }


/* Développements : KPI auto-fit + filtres + graphe de charge + urgence */
.kpi-grid.k3 { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)) !important; }
.searchbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.filtre-chk { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #475569; cursor: pointer; white-space: nowrap; padding: 4px 10px; border: 1px solid #e2e8f0; border-radius: 20px; background: #fff; }
.filtre-chk input { accent-color: #0891b2; width: 15px; height: 15px; }
@media (max-width: 700px) { .charge-row { grid-template-columns: 100px 1fr auto; } .charge-lbl { font-size: 10px; } }

/* Tuile KPI à valeur texte (ex. atelier le plus chargé) : police réduite */
.kpi-val.kpi-val-sm { font-size: 12px !important; line-height: 1.2; word-break: break-word; }
.de-page { zoom: 0.8; }
</style>
