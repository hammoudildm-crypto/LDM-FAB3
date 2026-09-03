<script setup>
import { ref, reactive, computed, onMounted, inject } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'

const peutEditer = inject('peutEditer', ref(true))

const donneurs = ref([])
const produits = ref([])
const ateliers = ref([])
const equipements = ref([])
const supList = ref([])
const nouveauSup = ref('')
const editSupId = ref(null)
const editSupNom = ref('')
const condList = ref([])
const nouveauCond = ref('')
const editCondId = ref(null)
const editCondNom = ref('')
const cadList = ref([])
const cadEquip = ref('')
const cadProduit = ref('')
const cadValeur = ref('')
const cadUnite = ref('unités/h')
const cadMode = ref('debit')
const bulkAtelier = ref('')
const bulkMsg = ref('')
const editCadId = ref(null)
const editCadValeur = ref('')
const editCadUnite = ref('')
const editCadMode = ref('debit')
const rechercheProdCad = ref('')
const filtreCadEquip = ref('')
const produitsFiltresCad = computed(() => {
  const q = rechercheProdCad.value.trim().toLowerCase()
  if (!q) return produits.value
  return produits.value.filter(p => (String(p.code_pf || '') + ' ' + String(p.designation || '')).toLowerCase().includes(q))
})
const erreur = ref('')

const FORMES = ['comprimé', 'gélule', 'gel', 'crème', 'pommade', 'sachet', 'blister', 'seringue']
const GAMME_PHASES = ['Pesée', 'Granulation et Séchage', 'Mélange', 'Compression', 'Remplissage Gélules', 'Pelliculage']
// Fusionne les anciennes étapes « Granulation » + « Séchage » en une seule « Granulation et Séchage »
// Poids théorique du lot, en kg. ATTENTION : taille_lot est un nombre de BOÎTES, pas d'unités.
// Formule commune à PlanningEquipements, SuiviCapacite et EquipementDetail :
//   taille_lot (boîtes) × unités/boîte × poids unitaire (mg) / 1e6
const poidsLotCalcule = computed(() => {
  const boites = Number(formP.taille_lot) || 0
  const uPar = Number(formP.unites_par_boite) || 0
  const mg = Number(formP.poids_unitaire_mg) || 0
  if (boites <= 0 || uPar <= 0 || mg <= 0) return null
  return Math.round(boites * uPar * mg / 1e6 * 100) / 100
})
function appliquerPoidsLot() { if (poidsLotCalcule.value != null) formP.poids_lot_kg = poidsLotCalcule.value }
function normGammeR(g) {
  if (!Array.isArray(g)) return []
  const out = []
  for (const ph of g) {
    const p = /^(granulation|s[ée]chage)$/i.test(String(ph).trim()) ? 'Granulation et Séchage' : ph
    if (!out.includes(p)) out.push(p)
  }
  return out
}
function phaseFinaleP(g) {
  if (!Array.isArray(g) || !g.length) return null
  for (let i = GAMME_PHASES.length - 1; i >= 0; i--) if (g.includes(GAMME_PHASES[i])) return GAMME_PHASES[i]
  return null
}
const rechercheP = ref('')
const filtreDonneurP = ref('')
const filtreFormeP = ref('')
const produitsFiltres = computed(() => {
  const q = rechercheP.value.trim().toLowerCase()
  return produits.value.filter(p => {
    if (filtreDonneurP.value && String(p.donneur_ordre_id) !== String(filtreDonneurP.value)) return false
    if (filtreFormeP.value && (p.forme || '') !== filtreFormeP.value) return false
    if (q) {
      const code = String(p.code_pf || '').toLowerCase()
      const desig = String(p.designation || '').toLowerCase()
      if (!(code.includes(q) || desig.includes(q))) return false
    }
    return true
  })
})

// --- Donneur d'ordre ---
const formDO = reactive({ id: null, code: '', nom: '', activite: '' })
function resetDO() { Object.assign(formDO, { id: null, code: '', nom: '', activite: '' }) }

// --- Produit ---
const formP = reactive({
  id: null, code_pf: '', designation: '', forme: '', donneur_ordre_id: '',
  unites_par_boite: '', poids_unitaire_mg: '', poids_lot_kg: '', taille_lot: '', duree_vie_mois: '', aql: '', pcsu: '', gamme: []
})
function resetP() {
  Object.assign(formP, {
    id: null, code_pf: '', designation: '', forme: '', donneur_ordre_id: '',
    unites_par_boite: '', poids_unitaire_mg: '', poids_lot_kg: '', taille_lot: '', duree_vie_mois: '', aql: '', pcsu: '', gamme: []
  })
}

// --- Atelier ---
const formA = reactive({ id: null, code: '', nom: '' })
function resetA() { Object.assign(formA, { id: null, code: '', nom: '' }) }

// --- Équipement ---
const formE = reactive({ id: null, code: '', nom: '', atelier_id: '', type: '', nb_machines: 1 })
const ouvert = reactive({ donneurs: false, ateliers: false, equipements: false, produits: false, superviseurs: false, verifCond: false, cadences: false })
const sectionActive = ref(null)
const SECTIONS = [
  { k: 'donneurs', lbl: "Donneurs d'ordre", ic: '🏢', n: () => donneurs.value.length },
  { k: 'ateliers', lbl: 'Ateliers', ic: '🏭', n: () => ateliers.value.length },
  { k: 'equipements', lbl: 'Équipements', ic: '⚙️', n: () => equipements.value.length },
  { k: 'produits', lbl: 'Produits', ic: '💊', n: () => produits.value.length },
  { k: 'superviseurs', lbl: 'Vérificateurs', ic: '👤', n: () => supList.value.length },
  { k: 'verifCond', lbl: 'Vérif. conditionnement', ic: '📦', n: () => condList.value.length },
  { k: 'cadences', lbl: 'Cadences', ic: '⏱️', n: () => cadList.value.length }
]
function ouvrirSection(k) { sectionActive.value = k; ouvert[k] = true }
function resetE() { Object.assign(formE, { id: null, code: '', nom: '', atelier_id: '', type: '', nb_machines: 1 }) }

function toNum(v) { return v === '' || v === null ? null : Number(v) }
function atelierDe(e) { return ateliers.value.find(a => a.id === e.atelier_id) || null }

async function chargerTout() {
  erreur.value = ''
  const rDO = await supabase.from('donneurs_ordre').select('*').eq('actif', true).order('nom')
  if (rDO.error) { erreur.value = rDO.error.message; return }
  donneurs.value = rDO.data

  const rP = await supabase.from('produits')
    .select('*, donneurs_ordre(nom, code)').eq('actif', true).order('code_pf')
  if (rP.error) { erreur.value = rP.error.message; return }
  produits.value = rP.data

  const rA = await supabase.from('ateliers').select('*').eq('actif', true).order('code')
  if (rA.error) { erreur.value = rA.error.message; return }
  ateliers.value = rA.data

  const rE = await supabase.from('equipements').select('*').eq('actif', true).order('code')
  if (rE.error) { erreur.value = rE.error.message; return }
  equipements.value = rE.data

  const rS = await supabase.from('superviseurs').select('id, nom').order('nom')
  if (!rS.error) supList.value = rS.data
  const rVC = await supabase.from('verificateurs_cond').select('id, nom').order('nom')
  if (!rVC.error) condList.value = rVC.data
  const rCad = await supabase.from('cadences_produit').select('id, cadence_nominale, unite_cadence, mode, equipement_id, produit_id, equipements(code), produits(code_pf, designation)').order('id', { ascending: false })
  if (!rCad.error) cadList.value = rCad.data
}

// --- Actions Vérificateurs ---
async function ajouterSup() {
  const nom = nouveauSup.value.trim()
  if (!nom) return
  const r = await supabase.from('superviseurs').insert({ nom })
  if (r.error) { erreur.value = r.error.message; return }
  nouveauSup.value = ''
  await chargerTout()
}
function ouvrirEditSup(sv) { editSupId.value = sv.id; editSupNom.value = sv.nom }
async function renommerSup(sv) {
  const nom = editSupNom.value.trim()
  if (!nom || nom === sv.nom) { editSupId.value = null; return }
  const r = await supabase.from('superviseurs').update({ nom }).eq('id', sv.id)
  if (r.error) { erreur.value = r.error.message; return }
  await supabase.from('ordres_fabrication').update({ ddl_verificateur: nom }).eq('ddl_verificateur', sv.nom)
  editSupId.value = null
  await chargerTout()
}
async function supprimerSup(sv) {
  if (!confirm('Supprimer le vérificateur « ' + sv.nom + ' » ?')) return
  const r = await supabase.from('superviseurs').delete().eq('id', sv.id)
  if (r.error) { erreur.value = r.error.message; return }
  await chargerTout()
}
async function reinitialiserPin(sv) {
  if (!confirm('Réinitialiser le code PIN de « ' + sv.nom + ' » ? Il devra en redéfinir un depuis « Mon compte ».')) return
  const r = await supabase.rpc('reinitialiser_pin_superviseur', { p_nom: sv.nom })
  if (r.error) { erreur.value = r.error.message + ' — as-tu créé la fonction SQL reinitialiser_pin_superviseur ?'; return }
  erreur.value = ''
  alert('Code PIN de « ' + sv.nom + ' » réinitialisé. Le superviseur peut en créer un nouveau depuis Mon compte.')
}

// --- Actions Vérificateurs conditionnement ---
async function ajouterCond() {
  const nom = nouveauCond.value.trim()
  if (!nom) return
  const r = await supabase.from('verificateurs_cond').insert({ nom })
  if (r.error) { erreur.value = r.error.message; return }
  nouveauCond.value = ''
  await chargerTout()
}
function ouvrirEditCond(v) { editCondId.value = v.id; editCondNom.value = v.nom }
async function renommerCond(v) {
  const nom = editCondNom.value.trim()
  if (!nom || nom === v.nom) { editCondId.value = null; return }
  const r = await supabase.from('verificateurs_cond').update({ nom }).eq('id', v.id)
  if (r.error) { erreur.value = r.error.message; return }
  await supabase.from('ordres_fabrication').update({ ddl_cond_verificateur: nom }).eq('ddl_cond_verificateur', v.nom)
  editCondId.value = null
  await chargerTout()
}
async function supprimerCond(v) {
  if (!confirm('Supprimer le vérificateur conditionnement « ' + v.nom + ' » ?')) return
  const r = await supabase.from('verificateurs_cond').delete().eq('id', v.id)
  if (r.error) { erreur.value = r.error.message; return }
  await chargerTout()
}

// --- Cadences (équipement × produit) ---
async function ajouterCad() {
  if (!cadEquip.value || !cadProduit.value) { erreur.value = 'Choisir un équipement ET un produit.'; return }
  const v = cadValeur.value === '' ? null : Number(cadValeur.value)
  const unite = cadMode.value === 'cycle' ? 'temps écoulé' : (cadUnite.value || 'unités/h')
  const r = await supabase.from('cadences_produit').upsert(
    { equipement_id: cadEquip.value, produit_id: cadProduit.value, cadence_nominale: v, unite_cadence: unite, mode: cadMode.value },
    { onConflict: 'equipement_id,produit_id' })
  if (r.error) { erreur.value = r.error.message; return }
  cadValeur.value = ''
  await chargerTout()
}

// --- Remplissage manuel : produits SANS cadence pour un équipement ---
const produitsSansCadence = computed(() => {
  if (!filtreCadEquip.value) return []
  const avec = new Set(cadList.value.filter(c => c.equipement_id === filtreCadEquip.value).map(c => c.produit_id))
  return produits.value
    .filter(pr => !avec.has(pr.id))
    .sort((a, b) => String(a.code_pf || '').localeCompare(String(b.code_pf || ''), undefined, { numeric: true }))
})
function prefillCad(pr) {
  cadEquip.value = filtreCadEquip.value
  rechercheProdCad.value = pr.code_pf || ''
  cadProduit.value = pr.id
  cadMode.value = 'debit'
  setTimeout(() => {
    const el = document.getElementById('cad-valeur')
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus() }
  }, 50)
}
async function passerAtelierTempsEcoule() {
  bulkMsg.value = ''
  if (!bulkAtelier.value) { bulkMsg.value = 'Choisir un atelier.'; return }
  const equips = equipements.value.filter(e => e.atelier_id === bulkAtelier.value)
  if (!equips.length) { bulkMsg.value = 'Aucun équipement pour cet atelier.'; return }
  const at = ateliers.value.find(a => a.id === bulkAtelier.value)
  const atNom = at ? (at.code + ' — ' + at.nom) : 'cet atelier'
  if (!confirm('Passer TOUS les produits (' + produits.value.length + ') en temps écoulé sur les ' + equips.length + ' équipement(s) de « ' + atNom + ' » ?')) return
  const rows = []
  for (const e of equips) for (const p of produits.value) rows.push({ equipement_id: e.id, produit_id: p.id, cadence_nominale: null, unite_cadence: 'temps écoulé', mode: 'cycle' })
  bulkMsg.value = 'Enregistrement de ' + rows.length + ' cadences…'
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    const r = await supabase.from('cadences_produit').upsert(rows.slice(i, i + CHUNK), { onConflict: 'equipement_id,produit_id' })
    if (r.error) { bulkMsg.value = 'Erreur : ' + r.error.message; return }
  }
  await chargerTout()
  bulkMsg.value = rows.length + ' cadences en temps écoulé configurées pour « ' + atNom + ' ».'
  setTimeout(() => { bulkMsg.value = '' }, 6000)
}
async function supprimerCad(c) {
  if (!confirm('Supprimer cette cadence ?')) return
  const r = await supabase.from('cadences_produit').delete().eq('id', c.id)
  if (r.error) { erreur.value = r.error.message; return }
  await chargerTout()
}
function ouvrirEditCad(c) {
  editCadId.value = c.id
  editCadValeur.value = c.cadence_nominale != null ? c.cadence_nominale : ''
  editCadUnite.value = c.unite_cadence || 'unités/h'
  editCadMode.value = c.mode || 'debit'
}
async function enregistrerCad(c) {
  const v = editCadValeur.value === '' ? null : Number(editCadValeur.value)
  const unite = editCadMode.value === 'cycle' ? 'temps écoulé' : (editCadUnite.value || 'unités/h')
  const r = await supabase.from('cadences_produit').update({ cadence_nominale: v, unite_cadence: unite, mode: editCadMode.value }).eq('id', c.id)
  if (r.error) { erreur.value = r.error.message; return }
  editCadId.value = null
  await chargerTout()
}
// --- Actions Donneur d'ordre ---
async function enregistrerDO() {
  erreur.value = ''
  if (!formDO.code.trim() || !formDO.nom.trim()) { erreur.value = 'Code et nom du donneur d\'ordre obligatoires.'; return }
  const payload = { code: formDO.code.trim(), nom: formDO.nom.trim(), activite: formDO.activite.trim() || null }
  const res = formDO.id
    ? await supabase.from('donneurs_ordre').update(payload).eq('id', formDO.id)
    : await supabase.from('donneurs_ordre').insert(payload)
  if (res.error) { erreur.value = res.error.message; return }
  resetDO()
  await chargerTout()
}
function modifierDO(d) { Object.assign(formDO, { id: d.id, code: d.code, nom: d.nom, activite: d.activite || '' }) }
async function desactiverDO(d) {
  if (!confirm('Désactiver le donneur d\'ordre « ' + d.nom + ' » ?')) return
  erreur.value = ''
  const res = await supabase.from('donneurs_ordre').update({ actif: false }).eq('id', d.id)
  if (res.error) { erreur.value = res.error.message; return }
  await chargerTout()
}

// --- Actions Produit ---
async function enregistrerP() {
  erreur.value = ''
  if (!formP.code_pf.trim() || !formP.designation.trim()) { erreur.value = 'Code PF et désignation obligatoires.'; return }
  const payload = {
    code_pf: formP.code_pf.trim(),
    designation: formP.designation.trim(),
    forme: formP.forme || null,
    donneur_ordre_id: formP.donneur_ordre_id || null,
    unites_par_boite: toNum(formP.unites_par_boite),
    poids_unitaire_mg: toNum(formP.poids_unitaire_mg),
    poids_lot_kg: toNum(formP.poids_lot_kg),
    taille_lot: toNum(formP.taille_lot),
    duree_vie_mois: toNum(formP.duree_vie_mois),
    aql: formP.aql.trim() || null,
    pcsu: toNum(formP.pcsu),
    gamme: normGammeR(formP.gamme)
  }
  const res = formP.id
    ? await supabase.from('produits').update(payload).eq('id', formP.id)
    : await supabase.from('produits').insert(payload)
  if (res.error) { erreur.value = res.error.message; return }
  resetP()
  await chargerTout()
}
function modifierP(p) {
  Object.assign(formP, {
    id: p.id, code_pf: p.code_pf, designation: p.designation, forme: p.forme || '',
    donneur_ordre_id: p.donneur_ordre_id || '',
    unites_par_boite: p.unites_par_boite ?? '', poids_unitaire_mg: p.poids_unitaire_mg ?? '', poids_lot_kg: p.poids_lot_kg ?? '', taille_lot: p.taille_lot ?? '',
    duree_vie_mois: p.duree_vie_mois ?? '', aql: p.aql || '', pcsu: p.pcsu ?? '',
    gamme: normGammeR(p.gamme)
  })
}
async function desactiverP(p) {
  if (!confirm('Désactiver le produit « ' + p.designation + ' » ?')) return
  erreur.value = ''
  const res = await supabase.from('produits').update({ actif: false }).eq('id', p.id)
  if (res.error) { erreur.value = res.error.message; return }
  await chargerTout()
}

// --- Actions Atelier ---
async function enregistrerA() {
  erreur.value = ''
  if (!formA.code.trim() || !formA.nom.trim()) { erreur.value = 'Code et nom de l\'atelier obligatoires.'; return }
  const payload = { code: formA.code.trim(), nom: formA.nom.trim() }
  const res = formA.id
    ? await supabase.from('ateliers').update(payload).eq('id', formA.id)
    : await supabase.from('ateliers').insert(payload)
  if (res.error) { erreur.value = res.error.message; return }
  resetA()
  await chargerTout()
}
function modifierA(a) { Object.assign(formA, { id: a.id, code: a.code, nom: a.nom }) }
async function desactiverA(a) {
  if (!confirm('Désactiver l\'atelier « ' + a.nom + ' » ?')) return
  erreur.value = ''
  const res = await supabase.from('ateliers').update({ actif: false }).eq('id', a.id)
  if (res.error) { erreur.value = res.error.message; return }
  await chargerTout()
}

// --- Tri des équipements selon la gamme de fabrication ---
function ordreGammeType(type) {
  const t = (type || '').toLowerCase()
  if (/pes[ée]|balance|bascule/.test(t)) return 1
  if (/granul|s[ée]ch/.test(t)) return 2
  if (/m[ée]lang/.test(t)) return 3
  if (/compress|presse|compri/.test(t)) return 4
  if (/g[ée]lule|remplis|encapsul|capsul/.test(t)) return 5
  if (/pellicul|enrob|coat|drag/.test(t)) return 6
  if (/condition|blister|thermoform|uhlmann|integra|marchesini|emball|[ée]tui|fardel|encart|mise en bo/.test(t)) return 7
  return 99
}
const equipementsTries = computed(() => [...equipements.value].sort((a, b) =>
  (ordreGammeType(a.type) - ordreGammeType(b.type)) || String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true })))

// --- Actions Équipement ---
async function enregistrerE() {
  erreur.value = ''
  if (!formE.code.trim() || !formE.nom.trim()) { erreur.value = 'Code et nom de l\'équipement obligatoires.'; return }
  const payload = { code: formE.code.trim(), nom: formE.nom.trim(), atelier_id: formE.atelier_id || null, type: formE.type.trim() || null, nb_machines: Math.max(1, Number(formE.nb_machines) || 1) }
  const res = formE.id
    ? await supabase.from('equipements').update(payload).eq('id', formE.id)
    : await supabase.from('equipements').insert(payload)
  if (res.error) { erreur.value = res.error.message; return }
  resetE()
  await chargerTout()
}
function modifierE(e) { Object.assign(formE, { id: e.id, code: e.code, nom: e.nom, atelier_id: e.atelier_id || '', type: e.type || '', nb_machines: Number(e.nb_machines) || 1 }) }
async function supprimerE(e) {
  if (!confirm('Supprimer definitivement l' + ap + 'equipement ' + (e.nom || e.code || '') + ' ? Action irreversible.')) return
  const r = await supabase.from('equipements').delete().eq('id', e.id)
  if (r.error) { erreur.value = 'Suppression impossible (equipement sans doute reference par des cadences ou des OF). Utilise plutot Desactiver. Detail : ' + r.error.message; return }
  await chargerTout()
}
async function desactiverE(e) {
  if (!confirm('Désactiver l\'équipement « ' + e.nom + ' » ?')) return
  erreur.value = ''
  const res = await supabase.from('equipements').update({ actif: false }).eq('id', e.id)
  if (res.error) { erreur.value = res.error.message; return }
  await chargerTout()
}

const route = useRoute()
onMounted(async () => {
  await chargerTout()
  const q = route.query.produit
  if (q) { ouvert.produits = true; rechercheP.value = String(q) }
})
</script>

<template>
  <div class="ref-page">
    <PageHeader title="Référentiels" tone="teal"
      subtitle="Données de base de LDM-FAB3 — tout le reste de l'application s'appuie dessus." />

    <p v-if="erreur" class="alert">{{ erreur }}</p>

    <div v-if="!sectionActive" class="ref-hub">
      <button v-for="sec in SECTIONS" :key="sec.k" class="ref-hub-card" @click="ouvrirSection(sec.k)">
        <span class="rh-ic">{{ sec.ic }}</span>
        <span class="rh-lbl">{{ sec.lbl }}</span>
        <span class="rh-n">{{ sec.n() }}</span>
      </button>
    </div>
    <button v-if="sectionActive" class="ref-back" @click="sectionActive = null">← Retour aux référentiels</button>

    <!-- DONNEURS D'ORDRE -->
    <section v-if="sectionActive === 'donneurs'" class="card">
      <div class="card-head clickable" @click="ouvert.donneurs = !ouvert.donneurs">
        <h2>Donneurs d'ordre</h2>
        <span class="count">{{ donneurs.length }}</span>
        <span class="chevron">{{ ouvert.donneurs ? '▾' : '▸' }}</span>
      </div>
      <div v-show="ouvert.donneurs">
      <div class="form-grid do-grid" v-if="peutEditer">
        <label>Code<input v-model="formDO.code" placeholder="SERVIER" /></label>
        <label>Nom<input v-model="formDO.nom" placeholder="Laboratoires Servier" /></label>
        <label>Activité<input v-model="formDO.activite" placeholder="Princeps / Générique / OTC" /></label>
        <div class="form-actions">
          <button class="btn" @click="enregistrerDO">{{ formDO.id ? 'Mettre à jour' : 'Ajouter' }}</button>
          <button v-if="formDO.id" class="btn ghost" @click="resetDO">Annuler</button>
        </div>
      </div>
      <div class="table-scroll">
        <table class="grid">
          <thead><tr><th>Code</th><th>Nom</th><th>Activité</th><th class="right">Actions</th></tr></thead>
          <tbody>
            <tr v-for="d in donneurs" :key="d.id">
              <td class="mono">{{ d.code }}</td>
              <td>{{ d.nom }}</td>
              <td>{{ d.activite || '—' }}</td>
              <td class="right nowrap">
                <template v-if="peutEditer">
                  <button class="link" @click="modifierDO(d)">Modifier</button>
                  <button class="link danger" @click="desactiverDO(d)">Désactiver</button>
                </template>
              </td>
            </tr>
            <tr v-if="!donneurs.length"><td colspan="4" class="empty">Aucun donneur d'ordre. Ajoute-en un ci-dessus.</td></tr>
          </tbody>
        </table>
      </div>
      </div>
    </section>

    <section v-if="sectionActive === 'ateliers'" class="card">
      <div class="card-head clickable" @click="ouvert.ateliers = !ouvert.ateliers">
        <h2>Ateliers</h2>
        <span class="count">{{ ateliers.length }}</span>
        <span class="chevron">{{ ouvert.ateliers ? '▾' : '▸' }}</span>
      </div>
      <div v-show="ouvert.ateliers">
      <div class="form-grid a-grid" v-if="peutEditer">
        <label>Code<input v-model="formA.code" placeholder="COMASA" /></label>
        <label>Nom<input v-model="formA.nom" placeholder="Atelier granulation COMASA" /></label>
        <div class="form-actions">
          <button class="btn" @click="enregistrerA">{{ formA.id ? 'Mettre à jour' : 'Ajouter' }}</button>
          <button v-if="formA.id" class="btn ghost" @click="resetA">Annuler</button>
        </div>
      </div>
      <div class="table-scroll">
        <table class="grid">
          <thead><tr><th>Code</th><th>Nom</th><th class="right">Actions</th></tr></thead>
          <tbody>
            <tr v-for="a in ateliers" :key="a.id">
              <td class="mono">{{ a.code }}</td>
              <td>{{ a.nom }}</td>
              <td class="right nowrap">
                <template v-if="peutEditer">
                  <button class="link" @click="modifierA(a)">Modifier</button>
                  <button class="link danger" @click="desactiverA(a)">Désactiver</button>
                </template>
              </td>
            </tr>
            <tr v-if="!ateliers.length"><td colspan="3" class="empty">Aucun atelier. Ajoute-en un ci-dessus.</td></tr>
          </tbody>
        </table>
      </div>
      </div>
    </section>

    <section v-if="sectionActive === 'equipements'" class="card">
      <div class="card-head clickable" @click="ouvert.equipements = !ouvert.equipements">
        <h2>Équipements</h2>
        <span class="count">{{ equipements.length }}</span>
        <span class="chevron">{{ ouvert.equipements ? '▾' : '▸' }}</span>
      </div>
      <div v-show="ouvert.equipements">
      <div class="form-grid e-grid" v-if="peutEditer">
        <label>Code<input v-model="formE.code" placeholder="FE55" /></label>
        <label>Nom<input v-model="formE.nom" placeholder="Presse FETTE FE55" /></label>
        <label>Atelier
          <select v-model="formE.atelier_id">
            <option value="">—</option>
            <option v-for="a in ateliers" :key="a.id" :value="a.id">{{ a.code }} — {{ a.nom }}</option>
          </select>
        </label>
        <label>Type<input v-model="formE.type" placeholder="Compression" /></label>
        <label>Nombre de machines identiques<input type="number" min="1" v-model.number="formE.nb_machines" placeholder="1" /></label>
        <div class="form-actions">
          <button class="btn" @click="enregistrerE">{{ formE.id ? 'Mettre à jour' : 'Ajouter' }}</button>
          <button v-if="formE.id" class="btn ghost" @click="resetE">Annuler</button>
        </div>
      </div>
      <div class="table-scroll">
        <table class="grid">
          <thead><tr><th>Code</th><th>Nom</th><th>Atelier</th><th>Type</th><th class="right">Actions</th></tr></thead>
          <tbody>
            <tr v-for="e in equipementsTries" :key="e.id">
              <td class="mono">{{ e.code }}</td>
              <td>{{ e.nom }}</td>
              <td>{{ atelierDe(e) ? atelierDe(e).code : '—' }}</td>
              <td>{{ e.type || '—' }}</td>
              <td class="right nowrap">
                <template v-if="peutEditer">
                  <button class="link" @click="modifierE(e)">Modifier</button>
                  <button class="link danger" @click="desactiverE(e)">Désactiver</button>
                  <button class="link danger" @click="supprimerE(e)">Supprimer</button>
                </template>
              </td>
            </tr>
            <tr v-if="!equipements.length"><td colspan="5" class="empty">Aucun équipement. Ajoute-en un ci-dessus.</td></tr>
          </tbody>
        </table>
      </div>
      </div>
    </section>

    <section v-if="sectionActive === 'produits'" class="card">
      <div class="card-head clickable" @click="ouvert.produits = !ouvert.produits">
        <h2>Produits</h2>
        <span class="count">{{ produits.length }}</span>
        <span class="chevron">{{ ouvert.produits ? '▾' : '▸' }}</span>
      </div>
      <div v-show="ouvert.produits">
      <div class="form-grid p-grid" v-if="peutEditer">
        <label>Code PF<input v-model="formP.code_pf" placeholder="DIAM60" /></label>
        <label>Désignation<input v-model="formP.designation" placeholder="DIAMICRON 60 mg" /></label>
        <label>Forme
          <select v-model="formP.forme">
            <option value="">—</option>
            <option v-for="f in FORMES" :key="f" :value="f">{{ f }}</option>
          </select>
        </label>
        <label>Donneur d'ordre
          <select v-model="formP.donneur_ordre_id">
            <option value="">—</option>
            <option v-for="d in donneurs" :key="d.id" :value="d.id">{{ d.nom }}</option>
          </select>
        </label>
        <label>Unités / boîte<input v-model="formP.unites_par_boite" type="number" placeholder="30" /></label>
        <label>Poids unitaire ({{ formP.forme === 'seringue' ? 'mg / unité' : 'mg' }})<input v-model="formP.poids_unitaire_mg" type="number" step="any" placeholder="350" /></label>
        <label>Taille de lot<input v-model="formP.taille_lot" type="number" placeholder="500000" /></label>
        <label>Poids du lot (kg)<input v-model="formP.poids_lot_kg" type="number" step="any" placeholder="175" />
          <span v-if="poidsLotCalcule != null" class="pl-calc" :title="formP.taille_lot + ' boîtes × ' + formP.unites_par_boite + ' u/boîte × ' + formP.poids_unitaire_mg + ' mg / 1 000 000'">Calculé : {{ poidsLotCalcule }} kg <button type="button" class="pl-apply" @click="appliquerPoidsLot">appliquer</button></span>
          <span v-else class="pl-calc">Calcul indisponible : renseigne taille de lot, unités/boîte et poids unitaire.</span>
        </label>
        <label>Durée de vie (mois)<input v-model="formP.duree_vie_mois" type="number" placeholder="36" /></label>
        <label>AQL<input v-model="formP.aql" placeholder="0.65" /></label>
        <label>PCSU<input v-model="formP.pcsu" type="number" step="any" placeholder="12.50" /></label>
        <label class="gamme-field">Gamme de process
          <div class="gamme-checks">
            <label v-for="ph in GAMME_PHASES" :key="ph" class="gamme-chk">
              <input type="checkbox" :value="ph" v-model="formP.gamme" /> {{ ph }}
            </label>
          </div>
          <span class="gamme-hint">Coche les phases réellement effectuées. La dernière cochée = fin de fabrication.</span>
        </label>
        <div class="form-actions">
          <button class="btn" @click="enregistrerP">{{ formP.id ? 'Mettre à jour' : 'Ajouter' }}</button>
          <button v-if="formP.id" class="btn ghost" @click="resetP">Annuler</button>
        </div>
      </div>
      <div class="p-filters">
        <input v-model="rechercheP" type="search" class="p-search" placeholder="Rechercher (code, désignation)…" />
        <select v-model="filtreDonneurP" class="p-filtre">
          <option value="">Tous les donneurs d'ordre</option>
          <option v-for="d in donneurs" :key="d.id" :value="d.id">{{ d.nom }}</option>
        </select>
        <select v-model="filtreFormeP" class="p-filtre">
          <option value="">Toutes les formes</option>
          <option v-for="f in FORMES" :key="f" :value="f">{{ f }}</option>
        </select>
        <span class="p-count">{{ produitsFiltres.length }} / {{ produits.length }}</span>
      </div>
      <div class="table-scroll">
        <table class="grid">
          <thead>
            <tr>
              <th>Code PF</th><th>Désignation</th><th>Forme</th><th>Donneur d'ordre</th>
              <th class="right">U/boîte</th><th class="right">Poids (mg)</th><th class="right">Poids lot (kg)</th><th class="right">Taille lot</th><th class="right">PCSU</th>
              <th>Phase finale</th>
              <th class="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in produitsFiltres" :key="p.id">
              <td class="mono">{{ p.code_pf }}</td>
              <td>{{ p.designation }}</td>
              <td>{{ p.forme || '—' }}</td>
              <td>{{ p.donneurs_ordre ? p.donneurs_ordre.nom : '—' }}</td>
              <td class="right">{{ p.unites_par_boite ?? '—' }}</td>
              <td class="right">{{ p.poids_unitaire_mg ?? '—' }}</td>
              <td class="right">{{ p.poids_lot_kg ?? '—' }}</td>
              <td class="right">{{ p.taille_lot ?? '—' }}</td>
              <td class="right">{{ p.pcsu ?? '—' }}</td>
              <td><span v-if="phaseFinaleP(p.gamme)" class="gamme-badge">{{ phaseFinaleP(p.gamme) }}</span><span v-else class="gamme-none">non définie</span></td>
              <td class="right nowrap">
                <template v-if="peutEditer">
                  <button class="link" @click="modifierP(p)">Modifier</button>
                  <button class="link danger" @click="desactiverP(p)">Désactiver</button>
                </template>
              </td>
            </tr>
            <tr v-if="!produitsFiltres.length"><td colspan="10" class="empty">Aucun produit ne correspond aux filtres.</td></tr>
          </tbody>
        </table>
      </div>
      </div>
    </section>

    <section v-if="sectionActive === 'superviseurs'" class="card">
      <div class="card-head clickable" @click="ouvert.superviseurs = !ouvert.superviseurs">
        <h2>Vérificateurs</h2>
        <span class="count">{{ supList.length }}</span>
        <span class="chevron">{{ ouvert.superviseurs ? '▾' : '▸' }}</span>
      </div>
      <div v-show="ouvert.superviseurs">
        <div class="sv-add" v-if="peutEditer">
          <input v-model="nouveauSup" placeholder="Nom du vérificateur" @keyup.enter="ajouterSup" />
          <button class="btn" @click="ajouterSup">Ajouter</button>
        </div>
        <div v-if="!supList.length" class="empty">Aucun vérificateur.</div>
        <div v-for="sv in supList" :key="sv.id" class="sv-row">
          <template v-if="editSupId === sv.id">
            <input v-model="editSupNom" class="sv-edit" @keyup.enter="renommerSup(sv)" />
            <button class="btn" @click="renommerSup(sv)">OK</button>
            <button class="link" @click="editSupId = null">Annuler</button>
          </template>
          <template v-else>
            <span class="sv-nom">{{ sv.nom }}</span>
            <template v-if="peutEditer">
              <button class="link" @click="ouvrirEditSup(sv)">Renommer</button>
              <button class="link warn" @click="reinitialiserPin(sv)">Réinit. PIN</button>
              <button class="link danger" @click="supprimerSup(sv)">Supprimer</button>
            </template>
          </template>
        </div>
      </div>
    </section>

    <section v-if="sectionActive === 'verifCond'" class="card">
      <div class="card-head clickable" @click="ouvert.verifCond = !ouvert.verifCond">
        <h2>Vérificateurs conditionnement</h2>
        <span class="count">{{ condList.length }}</span>
        <span class="chevron">{{ ouvert.verifCond ? '▾' : '▸' }}</span>
      </div>
      <div v-show="ouvert.verifCond">
        <div class="sv-add" v-if="peutEditer">
          <input v-model="nouveauCond" placeholder="Nom du vérificateur conditionnement" @keyup.enter="ajouterCond" />
          <button class="btn" @click="ajouterCond">Ajouter</button>
        </div>
        <div v-if="!condList.length" class="empty">Aucun vérificateur conditionnement.</div>
        <div v-for="v in condList" :key="v.id" class="sv-row">
          <template v-if="editCondId === v.id">
            <input v-model="editCondNom" class="sv-edit" @keyup.enter="renommerCond(v)" />
            <button class="btn" @click="renommerCond(v)">OK</button>
            <button class="link" @click="editCondId = null">Annuler</button>
          </template>
          <template v-else>
            <span class="sv-nom">{{ v.nom }}</span>
            <template v-if="peutEditer">
              <button class="link" @click="ouvrirEditCond(v)">Renommer</button>
              <button class="link danger" @click="supprimerCond(v)">Supprimer</button>
            </template>
          </template>
        </div>
      </div>
    </section>

    <section v-if="sectionActive === 'cadences'" class="card">
      <div class="card-head clickable" @click="ouvert.cadences = !ouvert.cadences">
        <h2>Cadences (équipement × produit)</h2>
        <span class="count">{{ cadList.length }}</span>
        <span class="chevron">{{ ouvert.cadences ? '▾' : '▸' }}</span>
      </div>
      <div v-show="ouvert.cadences">
        <div class="cad-form" v-if="peutEditer">
          <select v-model="cadEquip"><option value="">Équipement…</option><option v-for="e in equipements" :key="e.id" :value="e.id">{{ e.code }} — {{ e.nom }}</option></select>
          <input v-model="rechercheProdCad" placeholder="Rechercher produit…" class="cad-prod-search" />
          <select v-model="cadProduit"><option value="">— {{ produitsFiltresCad.length }} produit(s) —</option><option v-for="p in produitsFiltresCad" :key="p.id" :value="p.id">{{ p.code_pf }} — {{ p.designation }}</option></select>
          <select v-model="cadMode"><option value="debit">Débit (unités/h ou kg/h)</option><option value="cycle">Temps écoulé (au poste)</option></select>
          <input v-if="cadMode === 'debit'" id="cad-valeur" type="number" step="any" v-model="cadValeur" placeholder="cadence (ex. 60000)" />
          <select v-if="cadMode === 'debit'" v-model="cadUnite" class="cad-unite-in"><option value="unités/h">unités/h (conditionnement)</option><option value="kg/h">kg/h (fabrication)</option></select>
          <button class="btn" @click="ajouterCad">Enregistrer</button>
        </div>
        <div class="bulk-row" v-if="peutEditer">
          <span class="bulk-lbl">En masse — atelier :</span>
          <select v-model="bulkAtelier"><option value="">Choisir…</option><option v-for="a in ateliers" :key="a.id" :value="a.id">{{ a.code }} — {{ a.nom }}</option></select>
          <button class="btn-sm" @click="passerAtelierTempsEcoule">Tout passer en temps écoulé</button>
          <span v-if="bulkMsg" class="bulk-msg">{{ bulkMsg }}</span>
        </div>
        <div class="cadfill" v-if="peutEditer">
          <div class="cadfill-row">
            <span class="cadfill-lbl">Remplissage manuel — produits sans cadence pour :</span>
            <select v-model="filtreCadEquip"><option value="">Choisir un équipement…</option><option v-for="e in equipements" :key="e.id" :value="e.id">{{ e.code }} — {{ e.nom }}</option></select>
          </div>
          <div v-if="filtreCadEquip" class="cadfill-body">
            <p v-if="!produitsSansCadence.length" class="cadfill-ok">✓ Tous les produits actifs ont déjà une cadence sur cet équipement.</p>
            <template v-else>
              <p class="cadfill-count">{{ produitsSansCadence.length }} produit(s) sans cadence — clique pour pré-remplir le formulaire ci-dessus :</p>
              <div class="cadfill-chips">
                <button v-for="pr in produitsSansCadence" :key="pr.id" class="cadfill-chip" @click="prefillCad(pr)" :title="pr.designation">{{ pr.code_pf }}</button>
              </div>
            </template>
          </div>
        </div>
        <div v-if="!cadList.length" class="empty">Aucune cadence définie.</div>
        <div class="cad-scroll" v-else>
          <table class="ref-table">
            <thead><tr><th>Équipement</th><th>Produit</th><th class="right">Cadence</th><th>Unité</th><th></th></tr></thead>
            <tbody>
              <tr v-for="c in cadList" :key="c.id">
                <td>{{ c.equipements ? c.equipements.code : '—' }}</td>
                <td>{{ c.produits ? (c.produits.code_pf + ' — ' + c.produits.designation) : '—' }}</td>
                <template v-if="editCadId === c.id">
                  <td class="right"><input v-if="editCadMode === 'debit'" type="number" step="any" v-model="editCadValeur" class="cad-edit-in" /><span v-else class="muted-sm">—</span></td>
                  <td><select v-model="editCadMode" class="cad-edit-sel"><option value="debit">Débit</option><option value="cycle">Temps écoulé</option></select><select v-if="editCadMode === 'debit'" v-model="editCadUnite" class="cad-edit-in2"><option value="unités/h">unités/h</option><option value="kg/h">kg/h</option></select></td>
                  <td class="right nowrap"><button class="link" @click="enregistrerCad(c)">OK</button> <button class="link" @click="editCadId = null">Annuler</button></td>
                </template>
                <template v-else>
                  <td class="right strong">{{ c.cadence_nominale != null ? Number(c.cadence_nominale).toLocaleString('fr-FR') : '—' }}</td>
                  <td>{{ c.unite_cadence }}</td>
                  <td class="right nowrap"><button v-if="peutEditer" class="link" @click="ouvrirEditCad(c)">Modifier</button> <button v-if="peutEditer" class="link danger" @click="supprimerCad(c)">Supprimer</button></td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ref-page { color: #1b2733; }

.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 7px 11px; border-radius: 8px; font-size: 13px; margin: 0 0 10px; }

.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 11px 13px; margin-bottom: 12px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-head { display: flex; align-items: center; gap: 9px; margin-bottom: 9px; }
.card-head h2 { margin: 0; font-size: 14px; }
.count { background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 600; padding: 2px 9px; border-radius: 999px; }

.form-grid { display: grid; gap: 8px 10px; align-items: end; padding: 9px 11px; background: #f8fafc; border: 1px solid #eef2f6; border-radius: 10px; margin-bottom: 10px; }
.do-grid { grid-template-columns: 1fr 2fr 1.4fr auto; }
.p-grid { grid-template-columns: repeat(4, 1fr) auto; }
.a-grid { grid-template-columns: 1fr 2.4fr auto; }
.e-grid { grid-template-columns: 1fr 1.8fr 1.6fr 1fr auto; }
.form-grid label { display: flex; flex-direction: column; font-size: 11px; font-weight: 600; color: #475569; gap: 3px; }
.form-grid input, .form-grid select { font-size: 14px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; font-weight: 400; }
.form-grid input:focus, .form-grid select:focus { outline: 2px solid #0f766e; outline-offset: 0; border-color: #0f766e; }
.form-actions { display: flex; gap: 8px; align-items: end; }

.btn { background: #0f766e; color: #fff; border: 0; padding: 6px 13px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; }
/* Ce bouton était sans style : rendu par défaut du navigateur au milieu d'une page stylée. */
.btn-sm { background: #fff; color: #0f766e; border: 1px solid #99f6e4; padding: 4px 11px; border-radius: 7px; font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap; }
.btn-sm:hover { background: #f0fdfa; border-color: #0f766e; }
.btn:hover { background: #0c5f59; }
.btn.ghost { background: #fff; color: #475569; border: 1px solid #cbd5e1; }
.btn.ghost:hover { background: #f8fafc; }

.table-scroll { overflow-x: auto; }
table.grid { width: 100%; border-collapse: collapse; font-size: 12.5px; }
table.grid th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .02em; color: #64748b; padding: 5px 7px; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
table.grid td { padding: 3px 7px; border-bottom: 1px solid #eef2f6; }
table.grid tr:hover td { background: #f8fafc; }
.right { text-align: right; }
.nowrap { white-space: nowrap; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 600; }
.empty { color: #94a3b8; text-align: center; padding: 10px; font-style: italic; font-size: 12px; }

button.link { background: none; border: 0; color: #0f766e; font-size: 13px; font-weight: 600; cursor: pointer; padding: 2px 6px; }
button.link:hover { text-decoration: underline; }
button.link.danger { color: #b91c1c; }

@media (max-width: 820px) {
  .do-grid, .p-grid, .a-grid, .e-grid { grid-template-columns: 1fr 1fr; }
  .form-actions { grid-column: 1 / -1; }
}
.card-head.clickable { cursor: pointer; user-select: none; }
.card-head.clickable:hover h2 { color: #0f766e; }
.chevron { margin-left: auto; font-size: 14px; color: #64748b; padding-left: 8px; }
.p-filters { display: flex; gap: 7px; align-items: center; flex-wrap: wrap; margin-bottom: 7px; }
.p-search { font-size: 12px; padding: 5px 9px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; min-width: 240px; }
.p-search:focus { outline: 2px solid #0f766e; border-color: #0f766e; }
.p-filtre { font-size: 12px; padding: 5px 9px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; }
.p-count { font-size: 12px; font-weight: 600; color: #475569; background: #f1f5f9; padding: 4px 10px; border-radius: 999px; margin-left: auto; }
.pl-calc { display: block; margin-top: 3px; font-size: 10px; font-weight: 600; color: #94a3b8; text-transform: none; letter-spacing: 0; }
.pl-apply { border: 0; background: none; padding: 0 0 0 4px; font: inherit; font-size: 10px; font-weight: 800; color: #0f766e; cursor: pointer; text-decoration: underline; }
.gamme-field { grid-column: 1 / -1; }
.gamme-checks { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 3px; }
.gamme-chk { display: inline-flex; align-items: center; gap: 5px; font-weight: 400; font-size: 12px; color: #334155; }
.gamme-chk input { width: auto; margin: 0; }
.gamme-hint { display: block; font-size: 11px; color: #94a3b8; margin-top: 5px; }
.gamme-badge { background: #ccfbf1; color: #0f766e; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
.gamme-none { color: #cbd5e1; font-size: 12px; }
.sv-add { display: flex; gap: 8px; margin-bottom: 9px; }
.sv-add input, .sv-edit { font-size: 14px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; }
.sv-add input { flex: 1; }
.sv-add input:focus, .sv-edit:focus { outline: 2px solid #0f766e; border-color: #0f766e; }
.sv-row { display: flex; align-items: center; gap: 8px; padding: 4px 0; border-bottom: 1px solid #eef2f6; }
.sv-nom { flex: 1; font-size: 14px; font-weight: 600; color: #1b2733; }
.cad-form { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 9px; align-items: center; }
.cad-form select, .cad-form input { font-size: 14px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; }
.cad-form select { max-width: 250px; }
.cad-prod-search { font-size: 14px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; max-width: 200px; }
.bulk-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 4px 0 16px; padding: 10px 12px; background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; }
.bulk-lbl { font-weight: 600; color: #0f766e; font-size: 13px; }
.bulk-row select { font-size: 14px; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 8px; max-width: 220px; }
.bulk-msg { font-size: 13px; color: #0f766e; font-weight: 600; }
.cadfill { margin: 0 0 16px; padding: 12px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; }
.cadfill-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.cadfill-lbl { font-weight: 600; color: #334155; font-size: 13px; }
.cadfill-row select { font-size: 14px; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 8px; max-width: 260px; }
.cadfill-body { margin-top: 10px; }
.cadfill-ok { font-size: 13px; color: #047857; font-weight: 600; margin: 0; }
.cadfill-count { font-size: 12.5px; color: #64748b; margin: 0 0 8px; }
.cadfill-chips { display: flex; flex-wrap: wrap; gap: 6px; max-height: 160px; overflow-y: auto; padding: 2px; }
.cadfill-chip { font-family: ui-monospace, monospace; font-size: 12px; font-weight: 700; color: #0f766e; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 7px; padding: 4px 9px; cursor: pointer; }
.cadfill-chip:hover { background: #0f766e; color: #fff; }
.cad-unite-in { width: 90px; }
.cad-scroll { overflow-x: auto; }
.ref-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.ref-table th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .02em; color: #64748b; padding: 5px 7px; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
.ref-table td { padding: 3px 7px; border-bottom: 1px solid #eef2f6; }
.ref-table .right { text-align: right; }
.ref-table .strong { font-weight: 700; }
.ref-table .nowrap { white-space: nowrap; }
.cad-edit-in { width: 90px; font-size: 13px; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 6px; }
.cad-edit-in2 { width: 78px; font-size: 13px; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 6px; margin-left: 4px; }
.cad-edit-sel { font-size: 13px; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 6px; }
.muted-sm { color: #94a3b8; }
.ref-hub { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 14px; margin-top: 6px; }
.ref-hub-card { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 18px; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; cursor: pointer; transition: all .15s; text-align: left; }
.ref-hub-card:hover { border-color: #5B9BD5; box-shadow: 0 4px 14px rgba(43,74,133,.1); transform: translateY(-2px); }
.rh-ic { font-size: 26px; }
.rh-lbl { font-size: 14px; font-weight: 700; color: #1b2733; }
.rh-n { font-size: 12px; font-weight: 700; color: #5B9BD5; background: #eff6ff; padding: 2px 10px; border-radius: 10px; }
.ref-back { background: #f1f5f9; border: 1px solid #e2e8f0; color: #475569; padding: 8px 14px; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 600; margin-bottom: 14px; }
.ref-back:hover { background: #e2e8f0; }
.link.warn { color: #b45309; }
</style>
