<script setup>
import { ref, computed, onMounted } from 'vue'
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
    .select('id, numero_lot, statut, quantite_theorique, boites_fabriquees, date_reception, date_fin_validite, date_lancement, date_fin_fabrication, equipement_id, rdt_granulation, rdt_melange, rdt_compression, rdt_pelliculage, produits(code_pf, designation, forme, gamme, unites_par_boite), equipements(code, nom)')
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
  for (const sp of suivi.value) {
    const id = sp.ordre_id, k = phaseKey(sp.phase)
    if (!k) continue
    if (!m[id]) m[id] = {}
    const rec = { statut: sp.statut, date: sp.date_phase || sp.date_debut || null }
    const cur = m[id][k]
    if (!cur || sp.statut === 'Terminé') m[id][k] = rec
  }
  return m
})

// File par phase : lots à l'étape courante (en attente = étape précédente finie ; en cours = démarrée)
const queuePhase = computed(() => {
  const q = {}
  for (const ph of PHASES) q[ph.key] = { attente: [], cours: [] }
  const condFini = condComplet.value
  const condAny = ordresConditionnes.value
  for (const o of ofs.value) {
    if ((!o.date_lancement && !o.date_fin_fabrication) || condFini.has(o.id)) continue
    if (o.statut === 'Libéré' || o.statut === 'Rejeté') continue
    const pl = phasesLot.value[o.id] || {}
    const stat = (nom) => (pl[phaseKey(nom)] || {}).statut
    const gammeB = (o.produits && Array.isArray(o.produits.gamme) && o.produits.gamme.length) ? o.produits.gamme : CANON_FAB
    const gamme = []; let _pk = null
    for (const _ph of gammeB) { const _k = phaseKey(_ph); if (_k && _k === _pk) continue; gamme.push(_ph); _pk = _k }
    const p = o.produits || {}
    // Fabrication finie = dernière phase de la gamme du produit terminée (critère fiable, pas la date).
    const kDern = gamme.length ? phaseKey(gamme[gamme.length - 1]) : null
    const fabTerminee = !!o.date_fin_fabrication || !!(kDern && pl[kDern] && pl[kDern].statut === 'Terminé')
    const base = { id: o.id, lot: o.numero_lot || '—', code: p.code_pf || '—', desig: p.designation || '', forme: p.forme || '', boites: Number(o.quantite_theorique || 0), lancement: o.date_lancement || null,
      validite: o.date_fin_validite || null, perime: (o.date_fin_validite && !fabTerminee) ? (new Date(o.date_fin_validite) < new Date()) : false,
      reserveId: o.equipement_id || null, reserveLabel: o.equipements ? (o.equipements.code + (o.equipements.nom ? ' — ' + o.equipements.nom : '')) : null }
    // Règle : le lot est à sa phase la plus AVANCÉE déjà saisie (dans la gamme du produit).
    //   En cours -> en cours à cet atelier ; À faire -> en attente à cet atelier ;
    //   Terminé -> en attente de la phase SUIVANTE de la gamme ; si c'était la dernière -> conditionnement.
    let lastIdx = -1
    for (let i = 0; i < gamme.length; i++) { if (pl[phaseKey(gamme[i])]) lastIdx = i }
    if (lastIdx < 0) {
      if (o.date_fin_fabrication) {
        (condAny.has(o.id) ? q.conditionnement.cours : q.conditionnement.attente).push({ ...base, date: o.date_fin_fabrication })
      } else {
        const k0 = phaseKey(gamme[0])
        if (k0 && q[k0]) q[k0].attente.push({ ...base, date: o.date_lancement })
      }
      continue
    }
    const nomAv = gamme[lastIdx]
    const recAv = pl[phaseKey(nomAv)]
    const stAv = recAv ? recAv.statut : undefined
    if (stAv === 'Terminé') {
      if (lastIdx >= gamme.length - 1) {
        (condAny.has(o.id) ? q.conditionnement.cours : q.conditionnement.attente).push({ ...base, date: (recAv && recAv.date) || o.date_fin_fabrication || o.date_lancement })
      } else {
        const kSuiv = phaseKey(gamme[lastIdx + 1])
        if (kSuiv && q[kSuiv]) q[kSuiv].attente.push({ ...base, date: (recAv && recAv.date) || o.date_lancement })
      }
    } else {
      const kAv = phaseKey(nomAv)
      if (kAv && q[kAv]) {
        if (stAv === 'En cours') q[kAv].cours.push({ ...base, date: (recAv && recAv.date) || o.date_lancement })
        else q[kAv].attente.push({ ...base, date: (recAv && recAv.date) || o.date_lancement })
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

// Vue file FABRICATION : une colonne par PHASE (dédupliquée, hors pesée/conditionnement)
const vueFile = computed(() => {
  const q = queuePhase.value
  const rq = recherche.value.trim().toLowerCase()
  const mL = (l) => !rq || (l.lot || '').toLowerCase().includes(rq) || (l.code || '').toLowerCase().includes(rq) || (l.desig || '').toLowerCase().includes(rq)
  const presentes = new Set()
  for (const a of ateliers.value) {
    const keys = phasesParAtelier.value[a.id]
    if (keys) for (const k of keys) if (k !== 'conditionnement' && k !== 'pesee') presentes.add(k)
  }
  const liste = [...presentes].map(k => {
    const ph = PHASES.find(p => p.key === k)
    const attente = (q[k] ? q[k].attente : []).filter(mL)
    const cours = (q[k] ? q[k].cours : []).filter(mL)
    return { key: k, phase: ph, attente, cours, volAttente: attente.reduce((s, l) => s + l.boites, 0), volCours: cours.reduce((s, l) => s + l.boites, 0) }
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
      volAttente: attente.reduce((s, l) => s + l.boites, 0), volCours: cours.reduce((s, l) => s + l.boites, 0)
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
  const mL = (l) => !rq || (l.lot || '').toLowerCase().includes(rq) || (l.code || '').toLowerCase().includes(rq) || (l.desig || '').toLowerCase().includes(rq)
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
  let attFab = 0, coursFab = 0, secs = 0
  for (const ph of vueFile.value) { attFab += ph.attente.length; coursFab += ph.cours.length; if (ph.attente.length === 0 && ph.cours.length === 0) secs++ }
  let attCond = 0, coursCond = 0
  for (const g of vueCondLignes.value) { attCond += g.attente.length; coursCond += g.cours.length }
  const pesee = attentePeseeList.value.length
  return [
    { v: fmt(pesee + attFab + attCond), l: 'Lots en attente (toutes étapes)', tint: TINTS.amber, ic: ICONS.hourglass },
    { v: fmt(coursFab + coursCond), l: 'Lots en cours (toutes étapes)', tint: TINTS.blue, ic: ICONS.activity },
    { v: fmt(secs), l: 'Ateliers à sec (risque)', tint: TINTS.rose, ic: ICONS.alert },
  ]
})
// Lots planifiés EN ATTENTE DE PESÉE : réception OF faite, pesée pas encore terminée
const attentePeseeList = computed(() => {
  const rq = recherche.value.trim().toLowerCase()
  const mL = (l) => !rq || (l.lot || '').toLowerCase().includes(rq) || (l.code || '').toLowerCase().includes(rq) || (l.desig || '').toLowerCase().includes(rq)
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

function joursDepuis(d) { if (!d) return '—'; const j = Math.floor((Date.now() - new Date(d)) / 86400000); return j <= 0 ? 'auj.' : j + ' j' }
function ageClass(d) {
  if (!d) return ''
  const j = Math.floor((Date.now() - new Date(d)) / 86400000)
  if (j >= 7) return 'age-danger'
  if (j >= 3) return 'age-warn'
  return ''
}
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('fr-FR') : '—' }
function ouvrirLot(l, phaseKey) {
  if (phaseKey === 'conditionnement') router.push({ path: '/conditionnement', query: { lot: l.id } })
  else router.push({ path: '/suivi', query: { lot: l.id } })
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
    <PageHeader title="Disponibilité des produits par atelier" tone="cyan"
      subtitle="File d'attente en temps réel par atelier (pour prioriser et éviter les ruptures) et vue des produits fabriqués par équipement.">
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

      <!-- Onglets -->
      <div class="de-tabs">
        <button :class="{ on: ongletDispo === 'file' }" @click="ongletDispo = 'file'">File d'attente par atelier</button>
        <button :class="{ on: ongletDispo === 'retro' }" @click="ongletDispo = 'retro'">Fabriqués par équipement</button>
      </div>

      <!-- ===================== FILE D'ATTENTE ===================== -->
      <div v-show="ongletDispo === 'file'">
        <div class="kpi-grid k3">
          <div class="kpi" v-for="(k, i) in kpisFile" :key="i">
            <div class="kpi-top"><span class="kpi-ic" :style="k.tint"><svg viewBox="0 0 24 24" v-html="k.ic"></svg></span><div class="kpi-val">{{ k.v }}</div></div>
            <div class="kpi-lbl">{{ k.l }}</div>
          </div>
        </div>
        <div class="searchbar">
          <input v-model="recherche" type="text" placeholder="Rechercher un lot ou un produit…" />
        </div>
        <h3 class="board-h">Fabrication — files par atelier</h3>
        <p class="note">
          Chaque lot apparaît dans l'atelier de son <strong>étape courante</strong> : « en cours » s'il y est démarré, « en attente » si l'étape précédente est terminée.
          Une file <strong>vide</strong> = atelier à sec (risque de rupture). Les lots les plus anciens sont en haut.
        </p>
        <p v-if="vueFile.length === 0" class="muted">Aucun lot en production actuellement (un lot apparaît dès qu'il est lancé et suivi phase par phase).</p>

        <div class="file-board">
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
          <h2 class="atelier-titre"><span class="at-name">Atelier de {{ ph.phase.label }}</span>
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
                    <tr v-for="l in ph.cours" :key="l.id" class="lot-row" @click="ouvrirLot(l, ph.phase.key)" title="Ouvrir le suivi de fabrication de ce lot">
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
                    <tr v-for="l in ph.attente" :key="l.id" class="lot-row" @click="ouvrirLot(l, ph.phase.key)" title="Ouvrir le suivi de fabrication de ce lot">
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
                      <tr v-for="l in g.cours" :key="l.id" class="lot-row" @click="ouvrirLot(l, 'conditionnement')" title="Ouvrir ce lot dans le conditionnement">
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
                      <tr v-for="l in g.attente" :key="l.id" class="lot-row" @click="ouvrirLot(l, 'conditionnement')" title="Ouvrir ce lot dans le conditionnement">
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
      </div>

      <!-- ===================== RÉTROSPECTIVE ===================== -->
      <div v-show="ongletDispo === 'retro'">
      <div class="kpi-grid k3">
        <div class="kpi" v-for="(k, i) in kpis" :key="i">
          <div class="kpi-top">
            <span class="kpi-ic" :style="k.tint"><svg viewBox="0 0 24 24" v-html="k.ic"></svg></span>
            <div class="kpi-val">{{ k.v }}</div>
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
.atelier-titre { font-size: 13px; font-weight: 700; margin: 0 0 7px; color: #0f172a; border-left: 3px solid #0f766e; padding-left: 8px; line-height: 1.25; }
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
</style>
