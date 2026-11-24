<script setup>
import { ref, reactive, computed, inject, onMounted, watch } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'

const peutEditer = inject('peutEditer', ref(false))
const lotPartage = inject('lotPartage', null)

const equipements = ref([])
const produits = ref([])
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
  fait_par: '', verifie_par: ''
})
const colRetouche = ref(false)   // vrai une fois la migration 003 exécutée (colonne trs_postes.retouches)
const colVdl = ref(false)        // vrai une fois la migration 009 exécutée (colonnes arret_vdlg_min / arret_vdlp_min)
const colSignat = ref(false)     // vrai une fois la migration 011 exécutée (colonnes fait_par / verifie_par)

const MOTIFS = [
  ['arret_panne_min', 'Panne'], ['arret_format_min', 'Changement de format'],
  ['arret_nettoyage_min', 'Nettoyage'], ['arret_reglage_min', 'Réglage'],
  ['arret_vdlg_min', 'Vide de ligne général (VDLG)'], ['arret_vdlp_min', 'Vide de ligne partiel (VDLP)'],
  ['arret_maintenance_min', 'Maintenance'], ['arret_attente_min', 'Attente (matière/perso.)'],
  ['arret_autre_min', 'Autre']
]
// Motifs sortis de la grille 2-colonnes pour être regroupés sur des lignes dédiées
// (Nettoyage/Réglage, Vide de ligne général/partiel, Maintenance/Attente).
const motifsGrille = MOTIFS.filter(m => !['arret_nettoyage_min', 'arret_reglage_min', 'arret_maintenance_min', 'arret_attente_min', 'arret_vdlg_min', 'arret_vdlp_min'].includes(m[0]))

async function charger() {
  const re = await supabase.from('equipements').select('id, code, nom, type').eq('actif', true).order('code')
  if (!re.error) equipements.value = re.data || []
  const rp = await supabase.from('produits').select('id, code_pf, designation').eq('actif', true).order('code_pf')
  if (!rp.error) produits.value = rp.data || []
  const rs = await supabase.from('trs_postes').select('*, equipements(code, nom), produits(code_pf)').eq('actif', true).order('date', { ascending: false }).order('poste').limit(80)
  if (!rs.error) saisies.value = rs.data || []
  const pr = await supabase.from('trs_postes').select('retouches').limit(1)
  colRetouche.value = !pr.error
  const pv = await supabase.from('trs_postes').select('arret_vdlg_min').limit(1)
  colVdl.value = !pv.error
  const psg = await supabase.from('trs_postes').select('fait_par').limit(1)
  colSignat.value = !psg.error
}
onMounted(charger)

const equip = computed(() => equipements.value.find(e => e.id === equipId.value))
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
  }
}

const sommeArrets = computed(() => MOTIFS.reduce((s, m) => s + (Number(form[m[0]]) || 0), 0))
const tempsFonct = computed(() => Math.max(0, (Number(form.temps_ouverture_min) || 0) - sommeArrets.value))
const dispo = computed(() => { const to = Number(form.temps_ouverture_min) || 0; return to ? tempsFonct.value / to : 0 })
const perf = computed(() => {
  const prod = Number(form.production_realisee) || 0
  if (cadenceMode.value === 'cycle') return tempsFonct.value ? Math.min(1, prod / tempsFonct.value) : 0
  const theo = (tempsFonct.value / 60) * cadence.value
  return theo ? Math.min(1, prod / theo) : 0
})
const qualite = computed(() => {
  if (cadenceMode.value === 'cycle') return 1
  const p = Number(form.production_realisee) || 0
  return p ? Math.max(0, (p - (Number(form.rebuts) || 0)) / p) : 0
})
const trs = computed(() => dispo.value * perf.value * qualite.value)
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
    fait_par: '', verifie_par: ''
  }
}
const jour = reactive({ 1: blankPoste(), 2: blankPoste(), 3: blankPoste() })
const cadenceDe = (p) => (p.cadenceObj && p.cadenceObj.cadence_nominale != null ? Number(p.cadenceObj.cadence_nominale) : 0)
const modeDe = (p) => (p.cadenceObj ? (p.cadenceObj.mode || 'debit') : 'debit')
const uniteDe = (p) => (p.cadenceObj && p.cadenceObj.unite_cadence ? p.cadenceObj.unite_cadence : 'unités/h')
const sommeArretsDe = (p) => MOTIFS.reduce((s, m) => s + (Number(p[m[0]]) || 0), 0)
const fonctDe = (p) => Math.max(0, (Number(p.temps_ouverture_min) || 0) - sommeArretsDe(p))
const dispoDe = (p) => { const to = Number(p.temps_ouverture_min) || 0; return to ? fonctDe(p) / to : 0 }
const perfDe = (p) => {
  const prod = Number(p.production_realisee) || 0
  if (modeDe(p) === 'cycle') return fonctDe(p) ? Math.min(1, prod / fonctDe(p)) : 0
  const theo = (fonctDe(p) / 60) * cadenceDe(p)
  return theo ? Math.min(1, prod / theo) : 0
}
const qualiteDe = (p) => {
  if (modeDe(p) === 'cycle') return 1
  const prod = Number(p.production_realisee) || 0
  return prod ? Math.max(0, (prod - (Number(p.rebuts) || 0)) / prod) : 0
}
const trsDe = (p) => dispoDe(p) * perfDe(p) * qualiteDe(p)

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
  const aEnreg = [1, 2, 3].filter(pk => jour[pk].produitId)
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
    </PageHeader>

    <p v-if="msg" class="alert">{{ msg }}</p>
    <p v-if="ok" class="okmsg">{{ ok }}</p>

    <div class="mode-switch">
      <button :class="{ on: modeSaisie === 'poste' }" @click="modeSaisie = 'poste'">Poste par poste</button>
      <button :class="{ on: modeSaisie === 'jour' }" @click="modeSaisie = 'jour'">Journée 3×8 (grille)</button>
    </div>

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
            <option :value="1">Poste 1</option>
            <option :value="2">Poste 2</option>
            <option :value="3">Poste 3</option>
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
      <p v-if="modeSaisie === 'jour' && !equipId" class="hint">Choisis un équipement <b>et</b> une date : tu saisiras les 3 postes de la journée d'un seul coup.</p>
    </section>

    <section v-if="modeSaisie === 'poste' && equipId && produitId" class="card">
      <div class="grid2">
        <div>
          <h3 class="card-title">Temps du poste (minutes)</h3>
          <label class="fl">Temps d'ouverture (pause 30 min déduite)<input type="number" v-model.number="form.temps_ouverture_min" /></label>
          <div class="motifs">
            <label v-for="m in motifsGrille" :key="m[0]" class="fl">{{ m[1] }}<input type="number" min="0" v-model.number="form[m[0]]" /></label>
          </div>
          <div class="duo">
            <label class="fl vdl">Vide de ligne général (VDLG)<input type="number" min="0" v-model.number="form.arret_vdlg_min" title="Vide de ligne complet lors d'un changement de produit ou de campagne." /></label>
            <label class="fl vdl">Vide de ligne partiel (VDLP)<input type="number" min="0" v-model.number="form.arret_vdlp_min" title="Vide de ligne entre lots d'un même produit." /></label>
          </div>
          <div class="trio">
            <label class="fl hl">Nettoyage<input type="number" min="0" v-model.number="form.arret_nettoyage_min" /></label>
            <label class="fl">Réglage<input type="number" min="0" v-model.number="form.arret_reglage_min" /></label>
            <label v-if="colRetouche" class="fl">Retouches<input type="number" min="0" v-model.number="form.retouches" title="Unités reprises/retouchées — alimente le KPI « Taux de retouche »." /></label>
          </div>
          <div class="trio">
            <label class="fl">Maintenance<input type="number" min="0" v-model.number="form.arret_maintenance_min" /></label>
            <label class="fl">Attente (matière/perso.)<input type="number" min="0" v-model.number="form.arret_attente_min" /></label>
            <label class="fl">Commentaire<input type="text" v-model="form.commentaire" placeholder="Optionnel" /></label>
          </div>
          <div class="sub">Σ arrêts : <b>{{ sommeArrets }}</b> min · Fonctionnement : <b>{{ tempsFonct }}</b> min</div>
        </div>
        <div>
          <h3 class="card-title">Production</h3>
          <label class="fl">{{ cadenceMode === 'cycle' ? 'Temps écoulé (min)' : 'Production réalisée (' + uniteCad.replace('/h','') + ')' }}<input type="number" min="0" v-model.number="form.production_realisee" /></label>
          <label v-if="cadenceMode !== 'cycle'" class="fl">Rebuts<input type="number" min="0" v-model.number="form.rebuts" /></label>

          <div class="trs-box">
            <div class="trs-line"><span>Disponibilité</span><b>{{ pct(dispo) }}</b></div>
            <div class="trs-line"><span>Performance</span><b>{{ pct(perf) }}</b></div>
            <div class="trs-line"><span>Qualité</span><b>{{ pct(qualite) }}</b></div>
            <div class="trs-total"><span>TRS</span><b>{{ pct(trs) }}</b></div>
          </div>
          <div class="sig-duo">
            <label class="fl">Fait par<input type="text" v-model="form.fait_par" placeholder="Nom opérateur" /></label>
            <label class="fl">Vérifié par<input type="text" v-model="form.verifie_par" placeholder="Nom vérificateur" /></label>
          </div>
          <button v-if="peutEditer" class="btn" @click="enregistrer">Enregistrer le poste</button>
        </div>
      </div>
    </section>

    <!-- Mode Journée 3×8 : les 3 postes en colonnes, un seul enregistrement -->
    <section v-if="modeSaisie === 'jour' && equipId" class="card">
      <h3 class="card-title">Journée 3×8 — {{ equip ? equip.code + (equip.nom ? ' · ' + equip.nom : '') : '' }} · {{ dateSel }}</h3>
      <div class="jtable-wrap">
        <table class="jtable">
          <thead>
            <tr><th>Rubrique</th><th>Matin · P1</th><th>Après-midi · P2</th><th>Nuit · P3</th></tr>
          </thead>
          <tbody>
            <tr class="jprod">
              <td>Produit</td>
              <td v-for="pk in [1, 2, 3]" :key="pk">
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
              <td v-for="pk in [1, 2, 3]" :key="pk">
                <span v-if="jour[pk].cadenceObj">{{ modeDe(jour[pk]) === 'cycle' ? 'temps écoulé' : (cadenceDe(jour[pk]) ? cadenceDe(jour[pk]).toLocaleString('fr-FR') + ' ' + uniteDe(jour[pk]) : '⚠ non définie') }}</span>
                <span v-else-if="jour[pk].produitId" class="cad-warn">⚠ cadence non définie</span>
                <span v-else class="jmuted">—</span>
              </td>
            </tr>
            <tr>
              <td>Temps d'ouverture (min)</td>
              <td v-for="pk in [1, 2, 3]" :key="pk"><input type="number" min="0" v-model.number="jour[pk].temps_ouverture_min" /></td>
            </tr>
            <tr v-for="m in MOTIFS" :key="m[0]" :class="{ 'jvdl': m[0] === 'arret_vdlg_min' || m[0] === 'arret_vdlp_min' }">
              <td>{{ m[1] }}</td>
              <td v-for="pk in [1, 2, 3]" :key="pk"><input type="number" min="0" v-model.number="jour[pk][m[0]]" /></td>
            </tr>
            <tr class="jcalc">
              <td>Σ Arrêts · Fonctionnement (min)</td>
              <td v-for="pk in [1, 2, 3]" :key="pk">{{ sommeArretsDe(jour[pk]) }} · <b>{{ fonctDe(jour[pk]) }}</b></td>
            </tr>
            <tr>
              <td>Production réalisée</td>
              <td v-for="pk in [1, 2, 3]" :key="pk"><input type="number" min="0" v-model.number="jour[pk].production_realisee" /></td>
            </tr>
            <tr>
              <td>Rebuts</td>
              <td v-for="pk in [1, 2, 3]" :key="pk"><input type="number" min="0" v-model.number="jour[pk].rebuts" /></td>
            </tr>
            <tr v-if="colRetouche">
              <td>Retouches</td>
              <td v-for="pk in [1, 2, 3]" :key="pk"><input type="number" min="0" v-model.number="jour[pk].retouches" /></td>
            </tr>
            <tr class="jdpq"><td>Disponibilité</td><td v-for="pk in [1, 2, 3]" :key="pk">{{ pct(dispoDe(jour[pk])) }}</td></tr>
            <tr class="jdpq"><td>Performance</td><td v-for="pk in [1, 2, 3]" :key="pk">{{ pct(perfDe(jour[pk])) }}</td></tr>
            <tr class="jdpq"><td>Qualité</td><td v-for="pk in [1, 2, 3]" :key="pk">{{ pct(qualiteDe(jour[pk])) }}</td></tr>
            <tr class="jtrs"><td>TRS</td><td v-for="pk in [1, 2, 3]" :key="pk" :style="{ color: trsCol(trsDe(jour[pk])) }"><b>{{ pct(trsDe(jour[pk])) }}</b></td></tr>
            <tr class="jsig">
              <td>Fait par</td>
              <td v-for="pk in [1, 2, 3]" :key="pk"><input type="text" v-model="jour[pk].fait_par" placeholder="Opérateur" /></td>
            </tr>
            <tr class="jsig">
              <td>Vérifié par</td>
              <td v-for="pk in [1, 2, 3]" :key="pk"><input type="text" v-model="jour[pk].verifie_par" placeholder="Vérificateur" /></td>
            </tr>
            <tr class="jcom">
              <td>Commentaire</td>
              <td v-for="pk in [1, 2, 3]" :key="pk"><input type="text" v-model="jour[pk].commentaire" placeholder="Optionnel" /></td>
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
          <thead><tr><th>Date</th><th>Poste</th><th>Équip.</th><th>Produit</th><th class="right">Ouv.</th><th class="right">Arrêts</th><th class="right">Fonct.</th><th class="right">Nettoyage</th></tr></thead>
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
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.trs-page { color: #1b2733; }
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
.sel-row select, .sel-row input, .fl input { font-size: 14px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; font-weight: 500; width: 100%; box-sizing: border-box; }
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
.mode-switch { display: inline-flex; gap: 3px; background: #eef2ff; border-radius: 10px; padding: 4px; margin: 0 0 14px; }
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
.jtable .jtrs td { background: #f8fafc; font-size: 15px; }
.jtable .jtrs td:first-child { font-size: 13px; }
.jtable .jcom input, .jtable .jsig input { text-align: left; }
.sig-duo { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 0 0 12px; }
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
