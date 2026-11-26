<script setup>
import { ref, reactive, computed, inject, onMounted, watch, nextTick } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'

const peutEditer = inject('peutEditer', ref(false))
const lotPartage = inject('lotPartage', null)

// Modèles téléchargeables (hébergés dans public/modeles/)
const MODELES_BASE = import.meta.env.BASE_URL + 'modeles/'
const urlModeleXlsx = MODELES_BASE + 'Template_TRS_par_poste_LDM.xlsx'
const urlFicheA4 = MODELES_BASE + 'Fiche_releve_TRS_poste_A4.pdf'

const equipements = ref([])
const produits = ref([])
const personnel = ref([])        // organigramme (volet formation) pour « Fait par » / « Vérifié par »
const cadenceObj = ref(null)
const cadIn = ref('')
const cadUniteIn = ref('kg/h')
const cadMsg = ref('')
const saisies = ref([])
const filtreSaisiesEquip = ref(true)
const saisiesAffichees = computed(() => {
  if (filtreSaisiesEquip.value && equipId.value) return saisies.value.filter(s => String(s.equipement_id) === String(equipId.value))
  return saisies.value
})
const msg = ref('')
const ok = ref('')

const phaseFiltre = ref('')
const equipId = ref('')
const produitId = ref('')
const rechercheProduit = ref('')
const dateSel = ref(new Date().toISOString().slice(0, 10))
const poste = ref(1)
const modeSaisie = ref('poste')   // 'poste' = un poste à la fois · 'jour' = grille 3×8

const form = reactive({
  temps_ouverture_min: 450,
  arret_panne_min: 0, arret_format_min: 0, arret_nettoyage_min: 0,
  arret_reglage_min: 0, arret_maintenance_min: 0, arret_attente_min: 0, arret_autre_min: 0,
  arret_vdlg_min: 0, arret_vdlp_min: 0,
  production_realisee: 0, rebuts: 0, retouches: 0, commentaire: '',
  fait_par: '', verifie_par: '', superviseur: ''
})
const colRetouche = ref(false)   // vrai une fois la migration 003 exécutée (colonne trs_postes.retouches)
const colVdl = ref(false)        // vrai une fois la migration 009 exécutée (colonnes arret_vdlg_min / arret_vdlp_min)
const colSignat = ref(false)     // vrai une fois la migration 011 exécutée (colonnes fait_par / verifie_par)
const colSuperviseur = ref(false) // vrai une fois la migration 015 exécutée (colonne superviseur)

// Motifs d'arrêt regroupés MECE (un arrêt = un seul motif) :
// Planifié (organisationnel) vs Subi (non planifié). [colonne, libellé, définition]
const ARRETS_PLANIFIES = [
  ['arret_format_min', 'Changement de format', "Montage / démontage + réglage initial du passage d'un produit ou format à un autre."],
  ['arret_vdlg_min', 'Vide de ligne général (VDLG)', "Vidage + nettoyage complet lors d'un changement de produit / campagne (le nettoyage du changement est compté ICI)."],
  ['arret_vdlp_min', 'Vide de ligne partiel (VDLP)', "Vide de ligne entre lots d'un même produit (même campagne)."],
  ['arret_nettoyage_min', 'Nettoyage (hors VDL)', 'Nettoyage planifié NON lié à un changement : fin de poste, nettoyage intermédiaire.'],
  ['arret_maintenance_min', 'Maintenance préventive', 'Intervention de maintenance PLANIFIÉE (préventive).']
]
const ARRETS_SUBIS = [
  ['arret_panne_min', 'Panne', 'Défaillance machine imprévue (= maintenance corrective).'],
  ['arret_attente_min', 'Attente (matière / perso.)', "Arrêt subi faute de matière, de personnel ou d'utilités."],
  ['arret_reglage_min', 'Réglage (en cours)', 'Micro-réglages ou aléas process EN COURS de production, hors changement de format.'],
  ['arret_autre_min', 'Autre', 'Tout autre arrêt non classé (à minimiser).']
]
const MOTIFS = [...ARRETS_PLANIFIES, ...ARRETS_SUBIS]

async function charger() {
  const re = await supabase.from('equipements').select('*').eq('actif', true).order('code')
  if (!re.error) equipements.value = re.data || []
  const rp = await supabase.from('produits').select('id, code_pf, designation').eq('actif', true).order('code_pf')
  if (!rp.error) produits.value = rp.data || []
  const rpe = await supabase.from('organigramme').select('id, nom, fonction, atelier_id, equipement, machine').eq('actif', true).order('nom')
  if (!rpe.error) personnel.value = rpe.data || []
  const rs = await supabase.from('trs_postes').select('*, equipements(code, nom), produits(code_pf)').eq('actif', true).order('date', { ascending: false }).order('poste').limit(80)
  if (!rs.error) saisies.value = rs.data || []
  const pr = await supabase.from('trs_postes').select('retouches').limit(1)
  colRetouche.value = !pr.error
  const pv = await supabase.from('trs_postes').select('arret_vdlg_min').limit(1)
  colVdl.value = !pv.error
  const psg = await supabase.from('trs_postes').select('fait_par').limit(1)
  colSignat.value = !psg.error
  const pss = await supabase.from('trs_postes').select('superviseur').limit(1)
  colSuperviseur.value = !pss.error
}
onMounted(charger)

const equip = computed(() => equipements.value.find(e => e.id === equipId.value))

// ------- Régime de travail : repris de la page Capacité (localStorage 'sc_reg_equip') -------
// La Capacité enregistre, par unité physique (nom de base), un régime 1/2/3/4 (×8).
// On applique le même régime ici : seuls les postes réellement travaillés sont saisis.
const PREFIXE_OP = /^(granulation|s[ée]chage|s[ée]choir|m[ée]lange|pes[ée]e|compression|remplissage|encapsulation|pelliculage|enrobage|conditionnement)\s+(?!et\s)/i
function baseNom(nom) {
  const n = String(nom || '').trim().replace(PREFIXE_OP, '')
  return n.replace(/\s+(\d{1,2})\s*$/, (m, d) => (Number(d) <= 20 ? '' : m)).trim()
}
const regimeEquipMap = ref({})
function relireRegime() { try { regimeEquipMap.value = JSON.parse(localStorage.getItem('sc_reg_equip') || '{}') } catch (e) { regimeEquipMap.value = {} } }
relireRegime()
watch(equipId, relireRegime)
// Nombre de postes/jour selon le régime (4×8 = 24/7 ⇒ 3 postes/jour) ; repli = postes de l'équipement, sinon 3.
const nbPostes = computed(() => {
  const e = equip.value
  if (!e) return 3
  const key = (baseNom(e.nom || e.code) || String(e.nom || e.code || '')).toLowerCase()
  const r = regimeEquipMap.value[key]
  if (r === '4' || r === 4) return 3
  const n = Number(r)
  if (n >= 1 && n <= 3) return n
  const pf = Number(e.postes)
  return pf >= 1 && pf <= 3 ? pf : 3
})
const postesActifs = computed(() => (nbPostes.value >= 3 ? [1, 2, 3] : (nbPostes.value === 2 ? [1, 2] : [1])))
const regimeLabel = computed(() => nbPostes.value + '×8')
const POSTE_NOM = { 1: 'Matin', 2: 'Après-midi', 3: 'Nuit' }
// Options du sélecteur : postes du régime + le poste couramment choisi (pour éditer une saisie hors régime).
const postesSelectables = computed(() => (postesActifs.value.includes(Number(poste.value)) ? postesActifs.value : [...postesActifs.value, Number(poste.value)].sort((a, b) => a - b)))

// --- Personnel pour « Fait par » / « Vérifié par » (depuis l'organigramme / volet formation) ---
const normTxt = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
const listeContient = (champ, val) => {
  if (!val) return false
  const cible = normTxt(val)
  return String(champ || '').split(',').map(x => normTxt(x)).some(x => x && (x === cible || x.includes(cible) || cible.includes(x)))
}
// Une personne « couvre » l'équipement si sa machine = nom de l'équipement, ou sa phase = type de l'équipement
const couvreEquip = (p, eq) => !!eq && (listeContient(p.machine, eq.nom) || listeContient(p.equipement, eq.type))
const estChefLigne = (fonction) => { const f = normTxt(fonction); return f.includes('chef de ligne') || f.includes('chef ligne') }
const estSuperviseur = (fonction) => normTxt(fonction).includes('superviseur')
const uniqNoms = (arr) => [...new Set(arr.map(p => p.nom).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))
// Périmètre d'un agent vis-à-vis de l'équipement : machine, phase, ou même atelier
const couvrePerim = (p, eq) => couvreEquip(p, eq) || (!!eq && !!eq.atelier_id && String(p.atelier_id || '') === String(eq.atelier_id))
// Fait par : personnel affecté au poste (machine/phase) ; repli = tout le personnel actif
const operateursPoste = computed(() => {
  const eq = equip.value; if (!eq) return []
  const scoped = personnel.value.filter(p => couvreEquip(p, eq))
  return uniqNoms(scoped.length ? scoped : personnel.value)
})
// Vérifié par : chefs de ligne du poste + superviseurs de l'atelier (toujours inclus).
const verificateursPoste = computed(() => {
  const eq = equip.value
  const chefs = personnel.value.filter(p => estChefLigne(p.fonction))
  const supers = personnel.value.filter(p => estSuperviseur(p.fonction))
  if (!eq) return uniqNoms([...chefs, ...supers])
  const chefsScoped = chefs.filter(p => couvrePerim(p, eq))
  const supersScoped = supers.filter(p => couvrePerim(p, eq))
  return uniqNoms([
    ...(chefsScoped.length ? chefsScoped : chefs),
    ...(supersScoped.length ? supersScoped : supers)
  ])
})
// Superviseur de shift : superviseurs de l'organigramme (de préférence ceux de l'atelier, sinon tous).
const superviseursListe = computed(() => {
  const eq = equip.value
  const supers = personnel.value.filter(p => estSuperviseur(p.fonction))
  if (!eq) return uniqNoms(supers)
  const scoped = supers.filter(p => couvrePerim(p, eq))
  return uniqNoms(scoped.length ? scoped : supers)
})
const phases = computed(() => { const s = new Set(); for (const e of equipements.value) if (e.type) s.add(e.type); return [...s].sort() })
const equipementsFiltres = computed(() => phaseFiltre.value ? equipements.value.filter(e => e.type === phaseFiltre.value) : equipements.value)
function onPhaseChange() { equipId.value = '' }
const produitsFiltres = computed(() => {
  const q = rechercheProduit.value.trim().toLowerCase()
  if (!q) return produits.value
  return produits.value.filter(p => (String(p.code_pf || '') + ' ' + String(p.designation || '')).toLowerCase().includes(q))
})
// Récupère UNIQUEMENT la cadence du couple sélectionné (pas de limite à 1000 lignes).
async function chargerCadence() {
  cadenceObj.value = null
  if (!equipId.value || !produitId.value) return
  const r = await supabase.from('cadences_produit').select('*')
    .eq('equipement_id', equipId.value).eq('produit_id', produitId.value).limit(1)
  if (!r.error && r.data && r.data.length) cadenceObj.value = r.data[0]
}
watch([equipId, produitId], chargerCadence)
if (lotPartage) watch(() => lotPartage.value && lotPartage.value.produitId, (pid) => { if (pid) { rechercheProduit.value = ''; produitId.value = pid } }, { immediate: true })
const cadence = computed(() => cadenceObj.value && cadenceObj.value.cadence_nominale != null ? Number(cadenceObj.value.cadence_nominale) : 0)
const cadenceMode = computed(() => cadenceObj.value ? (cadenceObj.value.mode || 'debit') : 'debit')
const uniteCad = computed(() => cadenceObj.value && cadenceObj.value.unite_cadence ? cadenceObj.value.unite_cadence : 'unités/h')
// Débit effectif : en mode 'temps' la cadence est en min/lot -> débit équivalent (lots/h = 60 / temps) ; la production saisie est alors un nombre de lots.
const cadenceEff = computed(() => cadenceMode.value === 'temps' ? (cadence.value > 0 ? 60 / cadence.value : 0) : cadence.value)

// Enregistrer la cadence directement depuis la Saisie TRS (évite l'aller-retour
// vers Référentiels et recharge la liste sur place -> plus de discordance).
async function enregistrerCadenceInline() {
  cadMsg.value = ''
  if (!equipId.value || !produitId.value) { cadMsg.value = 'Choisir équipement et produit.'; return }
  const v = cadIn.value === '' ? null : Number(cadIn.value)
  if (!(v > 0)) { cadMsg.value = 'Valeur > 0 requise.'; return }
  // Nettoie toute ligne existante pour ce couple (doublons / valeurs nulles), puis réinsère.
  const del = await supabase.from('cadences_produit').delete().eq('equipement_id', equipId.value).eq('produit_id', produitId.value)
  if (del.error) { cadMsg.value = 'Erreur suppression : ' + del.error.message; return }
  const r = await supabase.from('cadences_produit').insert(
    { equipement_id: equipId.value, produit_id: produitId.value, cadence_nominale: v, unite_cadence: cadUniteIn.value, mode: 'debit' })
  if (r.error) { cadMsg.value = 'Erreur enregistrement : ' + r.error.message; return }
  cadIn.value = ''
  await chargerCadence()
  cadMsg.value = ''
  ok.value = 'Cadence enregistrée.'; setTimeout(() => ok.value = '', 2500)
}

function chargerContexte() {
  const ex = saisies.value.find(s => String(s.equipement_id) === String(equipId.value) && s.date === dateSel.value && s.poste === Number(poste.value))
  if (ex) {
    if (ex.produit_id) produitId.value = ex.produit_id
    form.temps_ouverture_min = ex.temps_ouverture_min
    for (const m of MOTIFS) form[m[0]] = ex[m[0]] || 0
    form.production_realisee = ex.production_realisee || 0
    form.rebuts = ex.rebuts || 0
    form.retouches = ex.retouches || 0
    form.commentaire = ex.commentaire || ''
    form.fait_par = ex.fait_par || ''
    form.verifie_par = ex.verifie_par || ''
    form.superviseur = ex.superviseur || ''
  }
}

// Revenir sur une saisie de la liste pour la modifier : on la recharge dans le formulaire (mode Poste par poste).
const hautForm = ref(null)
function modifierSaisie(s) {
  modeSaisie.value = 'poste'
  phaseFiltre.value = ''            // afficher tous les équipements
  rechercheProduit.value = ''       // afficher tous les produits
  equipId.value = s.equipement_id
  dateSel.value = s.date
  poste.value = Number(s.poste)
  produitId.value = s.produit_id || ''
  relireRegime()
  chargerContexte()                 // remplit le formulaire avec les valeurs existantes
  msg.value = ''
  ok.value = 'Saisie chargée — modifie les valeurs puis « Enregistrer » pour mettre à jour.'
  setTimeout(() => { if (ok.value.startsWith('Saisie chargée')) ok.value = '' }, 5000)
  nextTick(() => { try { hautForm.value && hautForm.value.scrollIntoView({ behavior: 'smooth', block: 'start' }) } catch (e) {} })
}

const sommeArrets = computed(() => MOTIFS.reduce((s, m) => s + (Number(form[m[0]]) || 0), 0))
const tempsFonct = computed(() => Math.max(0, (Number(form.temps_ouverture_min) || 0) - sommeArrets.value))
const dispo = computed(() => { const to = Number(form.temps_ouverture_min) || 0; return to ? tempsFonct.value / to : 0 })
const perf = computed(() => {
  const prod = Number(form.production_realisee) || 0
  if (cadenceMode.value === 'cycle') return tempsFonct.value ? Math.min(1, prod / tempsFonct.value) : 0
  const theo = (tempsFonct.value / 60) * cadenceEff.value
  return theo ? Math.min(1, prod / theo) : 0
})
const qualite = computed(() => {
  if (cadenceMode.value === 'cycle') return 1
  const p = Number(form.production_realisee) || 0
  return p ? Math.max(0, (p - (Number(form.rebuts) || 0)) / p) : 0
})
const trs = computed(() => dispo.value * perf.value * qualite.value)
// TRS technique : on sort les arrêts planifiés du temps requis (isole la fiabilité machine)
const sommePlanifies = computed(() => ARRETS_PLANIFIES.reduce((s, m) => s + (Number(form[m[0]]) || 0), 0))
const sommeSubis = computed(() => ARRETS_SUBIS.reduce((s, m) => s + (Number(form[m[0]]) || 0), 0))
const tempsRequis = computed(() => Math.max(0, (Number(form.temps_ouverture_min) || 0) - sommePlanifies.value))
const dispoTech = computed(() => tempsRequis.value ? tempsFonct.value / tempsRequis.value : 0)
const trsTech = computed(() => dispoTech.value * perf.value * qualite.value)
// Cascade du temps : Ouverture = Σ arrêts + Temps utile (production) + Écart non justifié
const tempsUtile = computed(() => {
  const prod = Number(form.production_realisee) || 0
  if (cadenceMode.value === 'cycle') return Math.min(tempsFonct.value, prod)
  const c = cadenceEff.value
  return c > 0 ? Math.min(tempsFonct.value, prod / c * 60) : 0
})
const ecartTemps = computed(() => Math.max(0, tempsFonct.value - tempsUtile.value))
const surDeclare = computed(() => {
  const prod = Number(form.production_realisee) || 0
  if (cadenceMode.value === 'cycle') return prod > tempsFonct.value + 0.5
  const c = cadenceEff.value
  return c > 0 && (prod / c * 60) > tempsFonct.value + 0.5
})
const pct = (x) => (x * 100).toFixed(1) + ' %'

// ------- Mode « Journée 3×8 » : les 3 postes saisis en grille, un seul enregistrement -------
const TRS_COL = { ok: '#16a34a', mid: '#d97706', ko: '#dc2626' }
const trsCol = (x) => (x >= 0.85 ? TRS_COL.ok : (x >= 0.65 ? TRS_COL.mid : TRS_COL.ko))
function blankPoste() {
  return {
    produitId: '', cadenceObj: null,
    temps_ouverture_min: 450,
    arret_panne_min: 0, arret_format_min: 0, arret_nettoyage_min: 0,
    arret_reglage_min: 0, arret_maintenance_min: 0, arret_attente_min: 0, arret_autre_min: 0,
    arret_vdlg_min: 0, arret_vdlp_min: 0,
    production_realisee: 0, rebuts: 0, retouches: 0, commentaire: '',
    fait_par: '', verifie_par: '', superviseur: ''
  }
}
const jour = reactive({ 1: blankPoste(), 2: blankPoste(), 3: blankPoste() })
const cadenceDe = (p) => (p.cadenceObj && p.cadenceObj.cadence_nominale != null ? Number(p.cadenceObj.cadence_nominale) : 0)
const modeDe = (p) => (p.cadenceObj ? (p.cadenceObj.mode || 'debit') : 'debit')
const uniteDe = (p) => (p.cadenceObj && p.cadenceObj.unite_cadence ? p.cadenceObj.unite_cadence : 'unités/h')
const cadenceEffDe = (p) => modeDe(p) === 'temps' ? (cadenceDe(p) > 0 ? 60 / cadenceDe(p) : 0) : cadenceDe(p)
const sommeArretsDe = (p) => MOTIFS.reduce((s, m) => s + (Number(p[m[0]]) || 0), 0)
const fonctDe = (p) => Math.max(0, (Number(p.temps_ouverture_min) || 0) - sommeArretsDe(p))
const dispoDe = (p) => { const to = Number(p.temps_ouverture_min) || 0; return to ? fonctDe(p) / to : 0 }
const perfDe = (p) => {
  const prod = Number(p.production_realisee) || 0
  if (modeDe(p) === 'cycle') return fonctDe(p) ? Math.min(1, prod / fonctDe(p)) : 0
  const theo = (fonctDe(p) / 60) * cadenceEffDe(p)
  return theo ? Math.min(1, prod / theo) : 0
}
const qualiteDe = (p) => {
  if (modeDe(p) === 'cycle') return 1
  const prod = Number(p.production_realisee) || 0
  return prod ? Math.max(0, (prod - (Number(p.rebuts) || 0)) / prod) : 0
}
const trsDe = (p) => dispoDe(p) * perfDe(p) * qualiteDe(p)
const tempsUtileDe = (p) => {
  const prod = Number(p.production_realisee) || 0
  if (modeDe(p) === 'cycle') return Math.min(fonctDe(p), prod)
  const c = cadenceEffDe(p)
  return c > 0 ? Math.min(fonctDe(p), prod / c * 60) : 0
}
const ecartTempsDe = (p) => Math.max(0, fonctDe(p) - tempsUtileDe(p))
const sommePlanifiesDe = (p) => ARRETS_PLANIFIES.reduce((s, m) => s + (Number(p[m[0]]) || 0), 0)
const tempsRequisDe = (p) => Math.max(0, (Number(p.temps_ouverture_min) || 0) - sommePlanifiesDe(p))
const dispoTechDe = (p) => { const tr = tempsRequisDe(p); return tr ? fonctDe(p) / tr : 0 }
const trsTechDe = (p) => dispoTechDe(p) * perfDe(p) * qualiteDe(p)

// Sélecteur produit par poste : barre de recherche + liste déroulante (combobox)
const prodUI = reactive({ 1: { q: '', open: false }, 2: { q: '', open: false }, 3: { q: '', open: false } })
const prodLabel = (id) => { const p = produits.value.find(x => x.id === id); return p ? p.code_pf + (p.designation ? ' — ' + p.designation : '') : '' }
function filtreProd(pk) {
  const q = (prodUI[pk].q || '').trim().toLowerCase()
  const sel = jour[pk].produitId
  if (!q || (sel && prodLabel(sel).toLowerCase() === q)) return produits.value.slice(0, 60)
  return produits.value.filter(p => (p.code_pf + ' ' + (p.designation || '')).toLowerCase().includes(q)).slice(0, 60)
}
function pickProd(pk, p) { jour[pk].produitId = p.id; prodUI[pk].q = p.code_pf + (p.designation ? ' — ' + p.designation : ''); prodUI[pk].open = false }
function clearProd(pk) { jour[pk].produitId = ''; prodUI[pk].q = ''; prodUI[pk].open = true }

async function chargerCadenceJour(pk) {
  const p = jour[pk]; p.cadenceObj = null
  if (!equipId.value || !p.produitId) return
  const r = await supabase.from('cadences_produit').select('*')
    .eq('equipement_id', equipId.value).eq('produit_id', p.produitId).limit(1)
  if (!r.error && r.data && r.data.length) p.cadenceObj = r.data[0]
}
function chargerJour() {
  for (const pk of [1, 2, 3]) {
    const base = blankPoste()
    const ex = saisies.value.find(s => String(s.equipement_id) === String(equipId.value) && s.date === dateSel.value && s.poste === pk)
    if (ex) {
      base.produitId = ex.produit_id || ''
      base.temps_ouverture_min = ex.temps_ouverture_min
      for (const m of MOTIFS) base[m[0]] = ex[m[0]] || 0
      base.production_realisee = ex.production_realisee || 0
      base.rebuts = ex.rebuts || 0
      base.retouches = ex.retouches || 0
      base.commentaire = ex.commentaire || ''
      base.fait_par = ex.fait_par || ''
      base.verifie_par = ex.verifie_par || ''
      base.superviseur = ex.superviseur || ''
    }
    Object.assign(jour[pk], base)
    prodUI[pk].q = prodLabel(jour[pk].produitId)
    prodUI[pk].open = false
  }
  for (const pk of [1, 2, 3]) chargerCadenceJour(pk)
}
for (const pk of [1, 2, 3]) watch(() => jour[pk].produitId, () => chargerCadenceJour(pk))
watch([equipId, dateSel], () => { if (modeSaisie.value === 'jour') chargerJour() })
watch(modeSaisie, (m) => { if (m === 'jour') chargerJour() })

async function enregistrerJour() {
  msg.value = ''
  if (!equipId.value) { msg.value = 'Choisir un équipement.'; return }
  const aEnreg = postesActifs.value.filter(pk => jour[pk].produitId)
  if (!aEnreg.length) { msg.value = 'Renseigne au moins un poste (le produit est requis).'; return }
  for (const pk of aEnreg) {
    const p = jour[pk]
    if (!p.cadenceObj) { msg.value = 'Poste ' + pk + ' : ce produit n\'a pas de cadence définie (Référentiels › Cadences).'; return }
    if (modeDe(p) === 'debit' && !cadenceDe(p)) { msg.value = 'Poste ' + pk + ' : cadence (débit) manquante.'; return }
  }
  let n = 0
  for (const pk of aEnreg) {
    const p = jour[pk]
    const payload = {
      equipement_id: equipId.value, produit_id: p.produitId, date: dateSel.value, poste: pk,
      temps_ouverture_min: Number(p.temps_ouverture_min) || 0,
      production_realisee: Number(p.production_realisee) || 0,
      rebuts: Number(p.rebuts) || 0, commentaire: p.commentaire || null
    }
    if (colRetouche.value) payload.retouches = Number(p.retouches) || 0
    if (colSignat.value) { payload.fait_par = p.fait_par || null; payload.verifie_par = p.verifie_par || null }
    if (colSuperviseur.value) payload.superviseur = p.superviseur || null
    for (const m of MOTIFS) {
      if (!colVdl.value && (m[0] === 'arret_vdlg_min' || m[0] === 'arret_vdlp_min')) continue
      payload[m[0]] = Number(p[m[0]]) || 0
    }
    const r = await supabase.from('trs_postes').upsert(payload, { onConflict: 'equipement_id,date,poste' })
    if (r.error) { msg.value = 'Poste ' + pk + ' : ' + r.error.message; return }
    n++
  }
  await charger()
  chargerJour()
  ok.value = n + ' poste(s) enregistré(s) pour le ' + dateSel.value + '.'; setTimeout(() => ok.value = '', 3500)
}

async function enregistrer() {
  msg.value = ''
  if (!equipId.value) { msg.value = 'Choisir un équipement.'; return }
  if (!produitId.value) { msg.value = 'Choisir le produit qui tournait sur ce poste.'; return }
  if (!cadenceObj.value) { msg.value = "Ce produit sur cet équipement n'a pas de mode/cadence défini — renseigne-le dans Référentiels › Cadences."; return }
  if (cadenceMode.value === 'debit' && !cadence.value) { msg.value = "Renseigner la cadence (débit) dans Référentiels › Cadences."; return }
  const payload = {
    equipement_id: equipId.value, produit_id: produitId.value, date: dateSel.value, poste: Number(poste.value),
    temps_ouverture_min: Number(form.temps_ouverture_min) || 0,
    production_realisee: Number(form.production_realisee) || 0,
    rebuts: Number(form.rebuts) || 0, commentaire: form.commentaire || null
  }
  if (colRetouche.value) payload.retouches = Number(form.retouches) || 0
  if (colSignat.value) { payload.fait_par = form.fait_par || null; payload.verifie_par = form.verifie_par || null }
  if (colSuperviseur.value) payload.superviseur = form.superviseur || null
  for (const m of MOTIFS) {
    // Tant que la migration 009 n'est pas exécutée, on n'envoie pas VDLG/VDLP
    // (colonnes absentes) pour ne pas casser l'enregistrement.
    if (!colVdl.value && (m[0] === 'arret_vdlg_min' || m[0] === 'arret_vdlp_min')) continue
    payload[m[0]] = Number(form[m[0]]) || 0
  }
  const r = await supabase.from('trs_postes').upsert(payload, { onConflict: 'equipement_id,date,poste' })
  if (r.error) { msg.value = r.error.message; return }
  const trsFige = pct(trs.value)
  await charger()
  ok.value = 'Poste enregistré (TRS ' + trsFige + ').'; setTimeout(() => ok.value = '', 3500)
  // vider les champs pour la saisie suivante
  form.temps_ouverture_min = 450
  for (const m of MOTIFS) form[m[0]] = 0
  form.production_realisee = 0
  form.rebuts = 0
  form.retouches = 0
  form.commentaire = ''
  form.fait_par = ''
  form.verifie_par = ''
  form.superviseur = ''
}

function trsSaisie(s) {
  const arr = MOTIFS.reduce((t, m) => t + (s[m[0]] || 0), 0)
  const to = s.temps_ouverture_min || 0
  const tf = Math.max(0, to - arr)
  return { arr, tf }
}
const fmt = (n) => n == null ? '—' : Number(n).toLocaleString('fr-FR')
</script>

<template>
  <div class="trs-page">
    <PageHeader title="Saisie TRS" tone="indigo"
      subtitle="Temps, arrêts, production et rebuts par équipement, produit et poste (3×8).">
      <a class="dl-btn" :href="urlFicheA4" download target="_blank" rel="noopener" title="Fiche de relevé vierge, format A4 (PDF)">⬇ Fiche A4 (PDF)</a>
      <a class="dl-btn" :href="urlModeleXlsx" download title="Classeur Excel : fiche, registre, référentiel, guide">⬇ Modèle Excel</a>
    </PageHeader>

    <p v-if="msg" class="alert">{{ msg }}</p>
    <p v-if="ok" class="okmsg">{{ ok }}</p>

    <div class="mode-switch" ref="hautForm">
      <button :class="{ on: modeSaisie === 'poste' }" @click="modeSaisie = 'poste'">Poste par poste</button>
      <button :class="{ on: modeSaisie === 'jour' }" @click="modeSaisie = 'jour'">Journée {{ regimeLabel }} (grille)</button>
    </div>
    <p v-if="equip" class="rg-hint">Régime <b>{{ regimeLabel }}</b> appliqué (défini sur la page Capacité)<span v-if="nbPostes < 3"> — seuls les {{ nbPostes }} poste(s) travaillés sont saisis</span>.</p>

    <section class="card">
      <div class="sel-row">
        <label>Phase / Atelier
          <select v-model="phaseFiltre" @change="onPhaseChange">
            <option value="">— Toutes —</option>
            <option v-for="ph in phases" :key="ph" :value="ph">{{ ph }}</option>
          </select>
        </label>
        <label>Équipement
          <select v-model="equipId" @change="chargerContexte">
            <option value="">— Choisir —</option>
            <option v-for="e in equipementsFiltres" :key="e.id" :value="e.id">{{ e.code }} — {{ e.nom }}</option>
          </select>
        </label>
        <label class="prod-col" v-if="modeSaisie === 'poste'">Produit
          <div class="prod-row">
            <input class="prod-search" v-model="rechercheProduit" placeholder="Rechercher (code / nom)…" />
            <select v-model="produitId">
              <option value="">— {{ produitsFiltres.length }} produit(s) —</option>
              <option v-for="p in produitsFiltres" :key="p.id" :value="p.id">{{ p.code_pf }} — {{ p.designation }}</option>
            </select>
          </div>
        </label>
        <label>Date
          <input type="date" v-model="dateSel" @change="chargerContexte" />
        </label>
        <label v-if="modeSaisie === 'poste'">Poste
          <select v-model.number="poste" @change="chargerContexte">
            <option v-for="pk in postesSelectables" :key="pk" :value="pk">Poste {{ pk }} · {{ POSTE_NOM[pk] }}{{ pk > nbPostes ? ' (hors régime)' : '' }}</option>
          </select>
        </label>
      </div>

      <template v-if="modeSaisie === 'poste'">
      <div v-if="equipId && produitId" class="cad-row">
        <span class="cad-lbl">Cadence de ce produit sur cet équipement :</span>
        <span class="cad-val" v-if="cadenceMode === 'cycle'">Mesuré au temps écoulé</span>
        <span class="cad-val" v-else>{{ cadence ? cadence.toLocaleString('fr-FR') + ' ' + uniteCad : '—' }}</span>
        <span v-if="cadenceMode === 'debit' && !cadence" class="cad-warn">⚠ non définie</span>
        <span v-if="peutEditer && cadenceMode === 'debit' && !cadence" class="cad-inline">
          <input type="number" step="any" min="0" v-model="cadIn" placeholder="cadence" class="cad-inline-in" @keyup.enter="enregistrerCadenceInline" />
          <select v-model="cadUniteIn" class="cad-inline-sel"><option value="kg/h">kg/h</option><option value="unités/h">unités/h</option></select>
          <button class="cad-inline-btn" @click="enregistrerCadenceInline">Enregistrer ici</button>
          <span v-if="cadMsg" class="cad-inline-msg">{{ cadMsg }}</span>
        </span>
      </div>
      <p v-else class="hint">Choisis un équipement <b>et</b> un produit : la cadence est propre à chaque couple.</p>
      </template>
      <p v-if="modeSaisie === 'jour' && !equipId" class="hint">Choisis un équipement <b>et</b> une date : tu saisiras les postes de la journée (selon le régime) d'un seul coup.</p>
    </section>

    <section v-if="modeSaisie === 'poste' && equipId && produitId" class="card">
      <div class="grid2">
        <div>
          <h3 class="card-title">Temps du poste (minutes)</h3>
          <label class="fl">Temps d'ouverture (pause 30 min déduite)<input type="number" v-model.number="form.temps_ouverture_min" /></label>

          <div class="grp-head grp-plan">Arrêts planifiés (organisationnels)</div>
          <div class="motifs">
            <label v-for="m in ARRETS_PLANIFIES" :key="m[0]" class="fl" :class="{ vdl: m[0] === 'arret_vdlg_min' || m[0] === 'arret_vdlp_min' }">
              <span class="lbl">{{ m[1] }}<abbr class="info" :title="m[2]">ⓘ</abbr></span>
              <input type="number" min="0" v-model.number="form[m[0]]" :title="m[2]" />
            </label>
          </div>

          <div class="grp-head grp-subi">Arrêts subis (non planifiés)</div>
          <div class="motifs">
            <label v-for="m in ARRETS_SUBIS" :key="m[0]" class="fl">
              <span class="lbl">{{ m[1] }}<abbr class="info" :title="m[2]">ⓘ</abbr></span>
              <input type="number" min="0" v-model.number="form[m[0]]" :title="m[2]" />
            </label>
          </div>

          <label class="fl">Commentaire<input type="text" v-model="form.commentaire" placeholder="Optionnel" /></label>
          <div class="sub">Σ planifiés : <b>{{ sommePlanifies }}</b> · Σ subis : <b>{{ sommeSubis }}</b> · Fonct. : <b>{{ tempsFonct }}</b> · Requis : <b>{{ tempsRequis }}</b> min</div>
        </div>
        <div>
          <h3 class="card-title">Production</h3>
          <label class="fl">{{ cadenceMode === 'cycle' ? 'Temps écoulé (min)' : (cadenceMode === 'temps' ? 'Nombre de lots' : 'Production réalisée (' + uniteCad.replace('/h','') + ')') }}<input type="number" min="0" step="any" v-model.number="form.production_realisee" /></label>
          <label v-if="cadenceMode !== 'cycle'" class="fl">Rebuts<input type="number" min="0" v-model.number="form.rebuts" /></label>
          <label v-if="colRetouche && cadenceMode !== 'cycle'" class="fl">Retouches<input type="number" min="0" v-model.number="form.retouches" title="Unités reprises / retouchées — alimente le taux de retouche (Qualité), sans impact sur le TRS." /></label>

          <div class="trs-box">
            <div class="trs-line"><span>Disponibilité</span><b>{{ pct(dispo) }}</b></div>
            <div class="trs-line"><span>Performance</span><b>{{ pct(perf) }}</b></div>
            <div class="trs-line"><span>Qualité</span><b>{{ pct(qualite) }}</b></div>
            <div class="trs-total"><span>TRS global</span><b>{{ pct(trs) }}</b></div>
            <div class="trs-tech"><span>TRS technique <small>arrêts planifiés exclus</small></span><b>{{ pct(trsTech) }}</b></div>
          </div>
          <div class="sig-duo">
            <label class="fl">Fait par
              <select v-model="form.fait_par">
                <option value="">— choisir —</option>
                <option v-for="nom in operateursPoste" :key="nom" :value="nom">{{ nom }}</option>
                <option v-if="form.fait_par && !operateursPoste.includes(form.fait_par)" :value="form.fait_par">{{ form.fait_par }}</option>
              </select>
            </label>
            <label class="fl">Vérifié par
              <select v-model="form.verifie_par">
                <option value="">— choisir —</option>
                <option v-for="nom in verificateursPoste" :key="nom" :value="nom">{{ nom }}</option>
                <option v-if="form.verifie_par && !verificateursPoste.includes(form.verifie_par)" :value="form.verifie_par">{{ form.verifie_par }}</option>
              </select>
            </label>
            <label class="fl">Superviseur de shift
              <select v-model="form.superviseur">
                <option value="">— choisir —</option>
                <option v-for="nom in superviseursListe" :key="nom" :value="nom">{{ nom }}</option>
                <option v-if="form.superviseur && !superviseursListe.includes(form.superviseur)" :value="form.superviseur">{{ form.superviseur }}</option>
              </select>
            </label>
          </div>
          <button v-if="peutEditer" class="btn" @click="enregistrer">Enregistrer le poste</button>
        </div>
      </div>
      <div class="cascade">
        <div class="casc-ttl">Cascade du temps (min) — où passe le temps d'ouverture</div>
        <div class="casc-flow">
          <span class="cf-step"><i>Ouverture</i><b>{{ form.temps_ouverture_min || 0 }}</b></span>
          <span class="cf-op">−</span>
          <span class="cf-step"><i>Arrêts déclarés</i><b>{{ sommeArrets }}</b></span>
          <span class="cf-op">=</span>
          <span class="cf-step accent"><i>Fonctionnement</i><b>{{ tempsFonct }}</b></span>
          <span class="cf-op">−</span>
          <span class="cf-step"><i>Temps utile (production)</i><b>{{ Math.round(tempsUtile) }}</b></span>
          <span class="cf-op">=</span>
          <span class="cf-step ecart" :class="{ warn: ecartTemps > 0 }"><i>Écart non justifié</i><b>{{ Math.round(ecartTemps) }}</b></span>
        </div>
        <div v-if="surDeclare" class="casc-note err">⚠ Incohérence : la production dépasse la capacité du temps de fonctionnement — vérifie les arrêts déclarés ou la cadence du couple.</div>
        <div v-else-if="ecartTemps > 0" class="casc-note">⚠ {{ Math.round(ecartTemps) }} min non justifiés (micro-arrêts / ralentissements non déclarés) — ils pèsent sur la Performance. À déclarer en arrêt si c'en était un, sinon c'est une perte de vitesse.</div>
        <div v-else class="casc-note ok">✓ Temps entièrement justifié : arrêts + production utile = temps d'ouverture.</div>
      </div>
    </section>

    <!-- Mode Journée 3×8 : les 3 postes en colonnes, un seul enregistrement -->
    <section v-if="modeSaisie === 'jour' && equipId" class="card">
      <h3 class="card-title">Journée {{ regimeLabel }} — {{ equip ? equip.code + (equip.nom ? ' · ' + equip.nom : '') : '' }} · {{ dateSel }}</h3>
      <div class="jtable-wrap">
        <table class="jtable">
          <thead>
            <tr><th>Rubrique</th><th v-for="pk in postesActifs" :key="pk">{{ POSTE_NOM[pk] }} · P{{ pk }}</th></tr>
          </thead>
          <tbody>
            <tr class="jprod">
              <td>Produit</td>
              <td v-for="pk in postesActifs" :key="pk">
                <div class="jcombo">
                  <input type="text" class="jcombo-in" v-model="prodUI[pk].q" placeholder="Rechercher un produit…"
                    @focus="prodUI[pk].open = true" @input="prodUI[pk].open = true" @blur="prodUI[pk].open = false" />
                  <button v-if="jour[pk].produitId || prodUI[pk].q" type="button" class="jcombo-x" @mousedown.prevent="clearProd(pk)" title="Effacer">×</button>
                  <ul v-if="prodUI[pk].open && filtreProd(pk).length" class="jcombo-list">
                    <li v-for="p in filtreProd(pk)" :key="p.id" :class="{ sel: p.id === jour[pk].produitId }" @mousedown.prevent="pickProd(pk, p)"><strong>{{ p.code_pf }}</strong><span v-if="p.designation"> — {{ p.designation }}</span></li>
                  </ul>
                </div>
              </td>
            </tr>
            <tr class="jcad">
              <td>Cadence</td>
              <td v-for="pk in postesActifs" :key="pk">
                <span v-if="jour[pk].cadenceObj">{{ modeDe(jour[pk]) === 'cycle' ? 'temps écoulé' : (cadenceDe(jour[pk]) ? cadenceDe(jour[pk]).toLocaleString('fr-FR') + ' ' + uniteDe(jour[pk]) : '⚠ non définie') }}</span>
                <span v-else-if="jour[pk].produitId" class="cad-warn">⚠ cadence non définie</span>
                <span v-else class="jmuted">—</span>
              </td>
            </tr>
            <tr>
              <td>Temps d'ouverture (min)</td>
              <td v-for="pk in postesActifs" :key="pk"><input type="number" min="0" v-model.number="jour[pk].temps_ouverture_min" /></td>
            </tr>
            <tr class="jgrp jgrp-plan"><td colspan="4">Arrêts planifiés (organisationnels)</td></tr>
            <tr v-for="m in ARRETS_PLANIFIES" :key="m[0]" :class="{ 'jvdl': m[0] === 'arret_vdlg_min' || m[0] === 'arret_vdlp_min' }">
              <td :title="m[2]">{{ m[1] }}</td>
              <td v-for="pk in postesActifs" :key="pk"><input type="number" min="0" v-model.number="jour[pk][m[0]]" /></td>
            </tr>
            <tr class="jgrp jgrp-subi"><td colspan="4">Arrêts subis (non planifiés)</td></tr>
            <tr v-for="m in ARRETS_SUBIS" :key="m[0]">
              <td :title="m[2]">{{ m[1] }}</td>
              <td v-for="pk in postesActifs" :key="pk"><input type="number" min="0" v-model.number="jour[pk][m[0]]" /></td>
            </tr>
            <tr class="jcalc">
              <td>Σ Arrêts · Fonct. · Requis (min)</td>
              <td v-for="pk in postesActifs" :key="pk">{{ sommeArretsDe(jour[pk]) }} · <b>{{ fonctDe(jour[pk]) }}</b> · {{ tempsRequisDe(jour[pk]) }}</td>
            </tr>
            <tr>
              <td>{{ postesActifs.some(pk => modeDe(jour[pk]) === 'temps') ? 'Nombre de lots' : 'Production réalisée' }}</td>
              <td v-for="pk in postesActifs" :key="pk"><input type="number" min="0" step="any" v-model.number="jour[pk].production_realisee" /></td>
            </tr>
            <tr>
              <td>Rebuts</td>
              <td v-for="pk in postesActifs" :key="pk"><input type="number" min="0" v-model.number="jour[pk].rebuts" /></td>
            </tr>
            <tr v-if="colRetouche">
              <td>Retouches</td>
              <td v-for="pk in postesActifs" :key="pk"><input type="number" min="0" v-model.number="jour[pk].retouches" /></td>
            </tr>
            <tr class="jcalc">
              <td>Temps utile · Écart non justifié (min)</td>
              <td v-for="pk in postesActifs" :key="pk">{{ Math.round(tempsUtileDe(jour[pk])) }} · <b :style="{ color: ecartTempsDe(jour[pk]) > 0 ? '#b45309' : '#047857' }">{{ Math.round(ecartTempsDe(jour[pk])) }}</b></td>
            </tr>
            <tr class="jdpq"><td>Disponibilité</td><td v-for="pk in postesActifs" :key="pk">{{ pct(dispoDe(jour[pk])) }}</td></tr>
            <tr class="jdpq"><td>Performance</td><td v-for="pk in postesActifs" :key="pk">{{ pct(perfDe(jour[pk])) }}</td></tr>
            <tr class="jdpq"><td>Qualité</td><td v-for="pk in postesActifs" :key="pk">{{ pct(qualiteDe(jour[pk])) }}</td></tr>
            <tr class="jtrs"><td>TRS global</td><td v-for="pk in postesActifs" :key="pk" :style="{ color: trsCol(trsDe(jour[pk])) }"><b>{{ pct(trsDe(jour[pk])) }}</b></td></tr>
            <tr class="jtrs jtrs-tech"><td>TRS technique <small>(planifiés exclus)</small></td><td v-for="pk in postesActifs" :key="pk" :style="{ color: trsCol(trsTechDe(jour[pk])) }">{{ pct(trsTechDe(jour[pk])) }}</td></tr>
            <tr class="jsig">
              <td>Fait par</td>
              <td v-for="pk in postesActifs" :key="pk">
                <select v-model="jour[pk].fait_par">
                  <option value="">— choisir —</option>
                  <option v-for="nom in operateursPoste" :key="nom" :value="nom">{{ nom }}</option>
                  <option v-if="jour[pk].fait_par && !operateursPoste.includes(jour[pk].fait_par)" :value="jour[pk].fait_par">{{ jour[pk].fait_par }}</option>
                </select>
              </td>
            </tr>
            <tr class="jsig">
              <td>Vérifié par</td>
              <td v-for="pk in postesActifs" :key="pk">
                <select v-model="jour[pk].verifie_par">
                  <option value="">— choisir —</option>
                  <option v-for="nom in verificateursPoste" :key="nom" :value="nom">{{ nom }}</option>
                  <option v-if="jour[pk].verifie_par && !verificateursPoste.includes(jour[pk].verifie_par)" :value="jour[pk].verifie_par">{{ jour[pk].verifie_par }}</option>
                </select>
              </td>
            </tr>
            <tr class="jsig">
              <td>Superviseur de shift</td>
              <td v-for="pk in postesActifs" :key="pk">
                <select v-model="jour[pk].superviseur">
                  <option value="">— choisir —</option>
                  <option v-for="nom in superviseursListe" :key="nom" :value="nom">{{ nom }}</option>
                  <option v-if="jour[pk].superviseur && !superviseursListe.includes(jour[pk].superviseur)" :value="jour[pk].superviseur">{{ jour[pk].superviseur }}</option>
                </select>
              </td>
            </tr>
            <tr class="jcom">
              <td>Commentaire</td>
              <td v-for="pk in postesActifs" :key="pk"><input type="text" v-model="jour[pk].commentaire" placeholder="Optionnel" /></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="jfoot">
        <button v-if="peutEditer" class="btn" @click="enregistrerJour">Enregistrer la journée</button>
        <span class="jhint">Une colonne sans produit n'est pas enregistrée. Les postes déjà saisis pour cette date se chargent automatiquement.</span>
      </div>
    </section>

    <section class="card">
      <div class="ds-head">
        <h3 class="card-title">Dernières saisies</h3>
        <label class="ds-filtre"><input type="checkbox" v-model="filtreSaisiesEquip" /> Équipement sélectionné uniquement</label>
      </div>
      <div v-if="!saisiesAffichees.length" class="empty">{{ filtreSaisiesEquip && equipId ? 'Aucune saisie pour cet équipement.' : "Aucune saisie pour l\'instant." }}</div>
      <div v-else class="table-scroll">
        <table class="mini">
          <thead><tr><th>Date</th><th>Poste</th><th>Équip.</th><th>Produit</th><th class="right">Ouv.</th><th class="right">Arrêts</th><th class="right">Fonct.</th><th class="right">Nettoyage</th><th class="right">Action</th></tr></thead>
          <tbody>
            <tr v-for="s in saisiesAffichees" :key="s.id">
              <td class="nowrap">{{ s.date }}</td>
              <td>P{{ s.poste }}</td>
              <td>{{ s.equipements ? s.equipements.code : '—' }}<span v-if="s.equipements && s.equipements.nom" class="dt-nom"> — {{ s.equipements.nom }}</span></td>
              <td>{{ s.produits ? s.produits.code_pf : '—' }}</td>
              <td class="right">{{ fmt(s.temps_ouverture_min) }}</td>
              <td class="right">{{ fmt(trsSaisie(s).arr) }}</td>
              <td class="right">{{ fmt(trsSaisie(s).tf) }}</td>
              <td class="right">{{ fmt(s.arret_nettoyage_min) }}</td>
              <td class="right"><button type="button" class="ds-edit" @click="modifierSaisie(s)" title="Recharger cette saisie dans le formulaire pour la modifier">✎ Modifier</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.trs-page { color: #1b2733; }
.dl-btn { height: 30px; display: inline-flex; align-items: center; gap: 6px; padding: 0 12px; background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; border-radius: 8px; font-size: 12.5px; font-weight: 700; text-decoration: none; cursor: pointer; white-space: nowrap; transition: background .15s, color .15s, border-color .15s; }
.dl-btn:hover { background: #4338ca; border-color: #4338ca; color: #fff; }
html:is([data-theme="sombre"], [data-theme="minuit"]) .dl-btn { background: #1e293b; color: #a5b4fc; border-color: #334155; }
html:is([data-theme="sombre"], [data-theme="minuit"]) .dl-btn:hover { background: #4338ca; color: #fff; border-color: #4338ca; }
.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }
.okmsg { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-title { margin: 0 0 12px; font-size: 16px; }
.sel-row { display: flex; gap: 14px; flex-wrap: nowrap; align-items: flex-start; }
.sel-row > label { flex: 1 1 0; min-width: 0; }
.sel-row > label.prod-col { flex: 2.3 1 0; }
.prod-row { display: flex; gap: 8px; align-items: center; }
.prod-row > * { flex: 1 1 0; min-width: 0; margin: 0; }
.sel-row label, .fl { display: flex; flex-direction: column; font-size: 12px; font-weight: 600; color: #475569; gap: 5px; }
.sel-row select, .sel-row input, .fl input, .fl select { font-size: 14px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; font-weight: 500; width: 100%; box-sizing: border-box; }
.prod-search { font-size: 13px; padding: 6px 9px; border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: 5px; width: 100%; box-sizing: border-box; }
@media (max-width: 900px) { .sel-row { flex-wrap: wrap; } .sel-row > label { flex: 1 1 180px; } }
.cad-row { display: flex; align-items: center; gap: 10px; margin-top: 14px; flex-wrap: wrap; font-size: 14px; }
.cad-lbl { font-weight: 600; color: #475569; }
.cad-row input { font-size: 14px; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 8px; width: 130px; }
.cad-unit { color: #64748b; }
.cad-val { font-weight: 700; color: #4338ca; font-size: 15px; }
.cad-warn { color: #d97706; font-size: 12px; font-weight: 600; }
.hint { margin-top: 12px; color: #64748b; font-size: 13px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
.fl { margin-bottom: 10px; }
.motifs { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.trio { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
.duo { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
.fl.hl input { border-color: #0f766e; background: #f0fdfa; }
.fl.vdl input { border-color: #6366f1; background: #eef2ff; }
.sub { font-size: 13px; color: #64748b; margin-top: 8px; }
/* Groupes d'arrêts (Planifié / Subi) */
.grp-head { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .03em; margin: 14px 0 8px; padding: 4px 10px; border-radius: 6px; border-left: 4px solid; }
.grp-plan { color: #4338ca; background: #eef2ff; border-color: #6366f1; }
.grp-subi { color: #b45309; background: #fff7ed; border-color: #f59e0b; }
.fl .lbl { display: inline-flex; align-items: center; gap: 4px; }
.info { color: #94a3b8; font-size: 11px; cursor: help; text-decoration: none; border: 0; }
.trs-tech { display: flex; justify-content: space-between; align-items: baseline; padding: 6px 0 2px; margin-top: 4px; border-top: 1px dashed #cbd5e1; font-size: 14px; font-weight: 700; color: #0f766e; }
.trs-tech small { font-weight: 500; color: #94a3b8; font-size: 11px; }
/* Cascade du temps (écart non justifié) */
.cascade { margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 14px; }
.casc-ttl { font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 8px; }
.casc-flow { display: flex; flex-wrap: wrap; align-items: stretch; gap: 6px; }
.cf-step { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 7px 12px; min-width: 92px; }
.cf-step i { font-style: normal; font-size: 10.5px; font-weight: 600; color: #64748b; text-align: center; }
.cf-step b { font-size: 16px; color: #1b2733; font-variant-numeric: tabular-nums; }
.cf-step.accent { background: #eef2ff; border-color: #c7d2fe; } .cf-step.accent b { color: #4338ca; }
.cf-step.ecart { background: #f0fdfa; border-color: #99f6e4; } .cf-step.ecart b { color: #0f766e; }
.cf-step.ecart.warn { background: #fff7ed; border-color: #fed7aa; } .cf-step.ecart.warn b { color: #b45309; }
.cf-op { display: flex; align-items: center; font-size: 16px; font-weight: 700; color: #cbd5e1; }
.casc-note { margin-top: 9px; font-size: 12px; color: #b45309; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 7px 11px; }
.casc-note.ok { color: #047857; background: #ecfdf5; border-color: #a7f3d0; }
.casc-note.err { color: #b91c1c; background: #fef2f2; border-color: #fecaca; }
@media (max-width: 700px) { .cf-op { display: none; } .cf-step { flex: 1 1 120px; } }
.trs-box { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; margin: 14px 0; background: #f8fafc; }
.trs-line { display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; color: #475569; }
.trs-line b { color: #1b2733; }
.trs-total { display: flex; justify-content: space-between; padding: 8px 0 2px; margin-top: 6px; border-top: 2px solid #e2e8f0; font-size: 17px; font-weight: 700; }
.trs-total b { color: #4338ca; }
.btn { font-size: 14px; font-weight: 600; padding: 9px 16px; border: 0; border-radius: 8px; background: #4338ca; color: #fff; cursor: pointer; }
.btn-sm { font-size: 13px; font-weight: 600; padding: 6px 12px; border: 1px solid #4338ca; border-radius: 8px; background: #fff; color: #4338ca; cursor: pointer; }
.table-scroll { overflow-x: auto; }
table.mini { width: 100%; border-collapse: collapse; font-size: 14px; }
table.mini th { text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
table.mini td { padding: 8px 10px; border-bottom: 1px solid #eef2f6; }
.right { text-align: right; }
.nowrap { white-space: nowrap; }
.empty { color: #94a3b8; text-align: center; padding: 16px; font-style: italic; }
@media (max-width: 800px) { .grid2 { grid-template-columns: 1fr; } .motifs { grid-template-columns: 1fr; } .trio { grid-template-columns: 1fr; } .duo { grid-template-columns: 1fr; } }
.cad-inline { display: inline-flex; align-items: center; gap: 6px; margin-left: 10px; }
.cad-inline-in { width: 110px; font-size: 13px; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 6px; }
.cad-inline-sel { font-size: 13px; padding: 5px 6px; border: 1px solid #cbd5e1; border-radius: 6px; }
.cad-inline-btn { font-size: 13px; font-weight: 700; color: #fff; background: #0f766e; border: 0; border-radius: 7px; padding: 6px 12px; cursor: pointer; }
.cad-inline-btn:hover { background: #0b5b55; }
.cad-inline-msg { font-size: 12.5px; font-weight: 700; color: #b91c1c; margin-left: 8px; }
.ds-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 6px; }
.ds-filtre { font-size: 13px; color: #475569; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; }
.ds-filtre input { cursor: pointer; }
.dt-nom { color: #94a3b8; font-weight: 400; }
/* Interrupteur de mode */
.mode-switch { display: inline-flex; gap: 3px; background: #eef2ff; border-radius: 10px; padding: 4px; margin: 0 0 8px; }
.rg-hint { margin: 0 0 14px; font-size: 12.5px; color: #475569; }
.rg-hint b { color: #4338ca; }
.ds-edit { border: 1px solid #c7d2fe; background: #eef2ff; color: #4338ca; font-weight: 700; font-size: 12px; padding: 4px 10px; border-radius: 7px; cursor: pointer; white-space: nowrap; transition: background .15s, color .15s, border-color .15s; }
.ds-edit:hover { background: #4338ca; border-color: #4338ca; color: #fff; }
html:is([data-theme="sombre"], [data-theme="minuit"]) .ds-edit { background: #1e293b; color: #a5b4fc; border-color: #334155; }
html:is([data-theme="sombre"], [data-theme="minuit"]) .ds-edit:hover { background: #4338ca; color: #fff; border-color: #4338ca; }
.mode-switch button { border: 0; background: none; font-family: inherit; font-size: 13px; font-weight: 700; color: #64748b; padding: 7px 16px; border-radius: 7px; cursor: pointer; transition: background .15s, color .15s; }
.mode-switch button.on { background: #fff; color: #4338ca; box-shadow: 0 1px 2px rgba(16,24,40,.1); }
/* Grille Journée 3×8 */
.jtable-wrap { overflow-x: auto; }
.jtable { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 580px; }
.jtable th, .jtable td { border: 1px solid #e8edf3; padding: 6px 8px; text-align: center; }
.jtable thead th { background: #4338ca; color: #fff; font-size: 12px; font-weight: 700; position: sticky; top: 0; }
.jtable thead th:first-child { background: #3730a3; }
.jtable td:first-child, .jtable th:first-child { text-align: left; font-weight: 600; color: #475569; white-space: nowrap; background: #f8fafc; }
.jtable input { width: 100%; box-sizing: border-box; font-size: 13px; padding: 5px 7px; border: 1px solid #cbd5e1; border-radius: 6px; text-align: right; background: #fff; color: #1b2733; }
.jtable select { width: 100%; box-sizing: border-box; font-size: 12px; padding: 5px 7px; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; color: #1b2733; }
.jtable .jprod td:not(:first-child), .jtable .jcad td:not(:first-child) { background: #fcfdff; }
.jtable .jcad { color: #4338ca; font-weight: 700; font-size: 12px; }
.jtable .jcad .cad-warn { color: #d97706; }
.jtable .jmuted { color: #cbd5e1; }
.jtable .jvdl input { border-color: #6366f1; background: #eef2ff; }
.jtable .jcalc { background: #f1f5f9; color: #475569; font-weight: 600; }
.jtable .jdpq td:not(:first-child) { font-weight: 600; color: #334155; }
.jtable .jgrp td { background: #f1f5f9; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .03em; text-align: left; padding: 5px 8px; }
.jtable .jgrp-plan td { color: #4338ca; border-left: 3px solid #6366f1; }
.jtable .jgrp-subi td { color: #b45309; border-left: 3px solid #f59e0b; }
.jtable .jtrs td { background: #f8fafc; font-size: 15px; }
.jtable .jtrs-tech td { font-size: 13px; background: #fbfbfe; }
.jtable .jtrs-tech td:first-child { font-size: 12px; color: #0f766e; }
.jtable .jtrs-tech td small { color: #94a3b8; font-weight: 400; }
.jtable .jtrs td:first-child { font-size: 13px; }
.jtable .jcom input, .jtable .jsig input { text-align: left; }
.sig-duo { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 0 0 12px; }
@media (max-width: 640px) { .sig-duo { grid-template-columns: 1fr; } }
/* Combobox produit (recherche + liste) dans la grille 3×8 */
.jcombo { position: relative; }
.jcombo-in { width: 100%; box-sizing: border-box; font-size: 12px; padding: 5px 22px 5px 7px; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; color: #1b2733; }
.jcombo-x { position: absolute; right: 5px; top: 50%; transform: translateY(-50%); border: 0; background: #e2e8f0; color: #475569; width: 16px; height: 16px; border-radius: 50%; cursor: pointer; font-size: 12px; line-height: 1; padding: 0; display: flex; align-items: center; justify-content: center; }
.jcombo-x:hover { background: #cbd5e1; }
.jcombo-list { position: absolute; z-index: 60; top: calc(100% + 3px); left: 0; right: 0; margin: 0; padding: 4px; list-style: none; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; box-shadow: 0 10px 24px rgba(16,24,40,.16); max-height: 230px; overflow-y: auto; text-align: left; }
.jcombo-list li { padding: 6px 8px; border-radius: 6px; cursor: pointer; font-size: 12px; white-space: normal; line-height: 1.3; color: #475569; }
.jcombo-list li:hover { background: #eef2ff; }
.jcombo-list li.sel { background: #e0e7ff; }
.jcombo-list strong { color: #1b2733; font-weight: 700; }
.jfoot { display: flex; align-items: center; gap: 14px; margin-top: 14px; flex-wrap: wrap; }
.jhint { font-size: 12px; color: #64748b; }
@media (max-width: 700px) { .jfoot { flex-direction: column; align-items: flex-start; } }
</style>
