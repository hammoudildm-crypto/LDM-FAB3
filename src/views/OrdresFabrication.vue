<script setup>
import { ref, reactive, computed, onMounted, nextTick, inject } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'

const peutEditer = inject('peutEditer', ref(true))
const STATUTS = ['Planifié', 'En cours', 'Terminé', 'Libéré', 'Rejeté']
const statutOriginal = ref('Planifié')  // statut réel du lot chargé (pour la sentinelle __auto__)

const lots = ref([])
const produits = ref([])
const equipements = ref([])
// Ateliers de conditionnement uniquement (pour la ligne finale réservée)
const equipementsCond = computed(() => equipements.value.filter(e => {
  const t = (e.type || '').toLowerCase()
  return /condition|blister|thermoform|uhlmann|integra|marchesini|emball|étui|etui|fardel|encart|mise en bo/.test(t)
}))
const filtreStatut = ref('')
const rechercheLot = ref('')
const anneeF = ref(0)
const moisF = ref(0)
const lotDeb = ref('')
const lotFin = ref('')
const LIMITE = 300
const rechProduit = ref('')
const erreur = ref('')
const message = ref('')
const afficherDesactives = ref(false)
const lotsDesactives = ref([])
const signatures = ref([])
const formCard = ref(null)

const sig = reactive({ open: false, mode: 'sign', ordre: null, pin: '', pin2: '', motif: '', erreur: '', busy: false })

const form = reactive({
  id: null, numero_lot: '', produit_id: '', quantite_theorique: '',
  date_reception: '', date_fin_validite: '',
  date_lancement: '', date_fin_fabrication: '', statut: '__auto__', equipement_id: '', commentaire: '',
  deviation: false, en_triage: false, deviation_cond: false, en_triage_cond: false,
  triage_debut: '', triage_fin: '', triage_cond_debut: '', triage_cond_fin: ''
})
function resetForm() {
  statutOriginal.value = 'Planifié'
  Object.assign(form, {
    id: null, numero_lot: '', produit_id: '', quantite_theorique: '',
    date_reception: '', date_fin_validite: '',
    date_lancement: '', date_fin_fabrication: '', statut: '__auto__', equipement_id: '', commentaire: '',
    deviation: false, en_triage: false, deviation_cond: false, en_triage_cond: false,
    triage_debut: '', triage_fin: '', triage_cond_debut: '', triage_cond_fin: ''
  })
}
function majTriage(quel) {
  const auj = new Date().toISOString().slice(0, 10)
  if (quel === 'fab' && form.en_triage && !form.triage_debut) form.triage_debut = auj
  if (quel === 'cond' && form.en_triage_cond && !form.triage_cond_debut) form.triage_cond_debut = auj
}
function toNum(v) { return v === '' || v === null ? null : Number(v) }

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
  erreur.value = ''
  const rp = await supabase.from('produits').select('id, code_pf, designation, taille_lot').eq('actif', true).order('code_pf')
  if (rp.error) { erreur.value = rp.error.message; return }
  produits.value = rp.data

  const re = await supabase.from('equipements').select('id, code, nom, type').eq('actif', true).order('code')
  if (re.error) { erreur.value = re.error.message; return }
  equipements.value = re.data

  const rl = await fetchAllPaged(() => supabase.from('ordres_fabrication')
    .select('*, produits(code_pf, designation), equipements(code, nom)')
    .eq('actif', true).order('date_lancement', { ascending: false, nullsFirst: false }).order('id', { ascending: false }))
  if (rl.error) { erreur.value = rl.error.message; return }
  lots.value = rl.data

  const rs = await supabase.from('signatures').select('ordre_id, email, signed_at, motif').order('signed_at', { ascending: false })
  if (!rs.error) signatures.value = rs.data
}

const MOIS = [
  { v: 1, l: 'Janvier' }, { v: 2, l: 'Février' }, { v: 3, l: 'Mars' },
  { v: 4, l: 'Avril' }, { v: 5, l: 'Mai' }, { v: 6, l: 'Juin' },
  { v: 7, l: 'Juillet' }, { v: 8, l: 'Août' }, { v: 9, l: 'Septembre' },
  { v: 10, l: 'Octobre' }, { v: 11, l: 'Novembre' }, { v: 12, l: 'Décembre' }
]
function refDateLot(l) { return l.date_lancement || l.date_fin_fabrication }
const anneesLot = computed(() => {
  const set = new Set()
  for (const l of lots.value) { const d = refDateLot(l); if (d) set.add(new Date(d).getFullYear()) }
  return [...set].sort((a, b) => b - a)
})
const numLot = (v) => { const n = parseInt(String(v == null ? '' : v).replace(/\D/g, ''), 10); return isNaN(n) ? null : n }
// Règle numéro de lot : 2 premiers chiffres = année, le reste = séquence
const lotKey = (v) => {
  const d = String(v == null ? '' : v).replace(/\D/g, '')
  if (!d) return { an: -1, seq: -1 }
  return { an: parseInt(d.slice(0, 2), 10), seq: parseInt(d.slice(2) || '0', 10) }
}
const lotsFiltres = computed(() => {
  const q = rechercheLot.value.trim().toLowerCase()
  return lots.value.filter(l => {
    if (filtreStatut.value && l.statut !== filtreStatut.value) return false
    const d = refDateLot(l)
    if (anneeF.value && (!d || new Date(d).getFullYear() !== anneeF.value)) return false
    if (moisF.value && (!d || (new Date(d).getMonth() + 1) !== moisF.value)) return false
    if (lotDeb.value !== '' || lotFin.value !== '') {
      const n = numLot(l.numero_lot)
      if (n == null) return false
      const deb = numLot(lotDeb.value), fin = numLot(lotFin.value)
      if (deb != null && n < deb) return false
      if (fin != null && n > fin) return false
    }
    if (q) {
      const pr = l.produits
      const code = pr ? String(pr.code_pf || '') : ''
      const desig = pr ? String(pr.designation || '') : ''
      if (!(String(l.numero_lot || '').toLowerCase().includes(q) || code.toLowerCase().includes(q) || desig.toLowerCase().includes(q))) return false
    }
    return true
  }).sort((a, b) => { const ka = lotKey(a.numero_lot), kb = lotKey(b.numero_lot); return (kb.an - ka.an) || (kb.seq - ka.seq) })
})
const lotsAffiches = computed(() => lotsFiltres.value.slice(0, LIMITE))
// Dernier numéro de lot enregistré (le plus élevé) + le suivant proposé
const dernierLot = computed(() => {
  // le dernier lot NUMÉRIQUE réellement enregistré (le plus récemment créé = id le plus élevé)
  const num = lots.value
    .filter(l => /^\d+$/.test(String(l.numero_lot || '').trim()))
    .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0))[0]
  return num ? String(num.numero_lot).trim() : null
})
const prochainLot = computed(() => {
  const d = dernierLot.value
  return d ? String(Number(d) + 1) : null
})
const produitsForm = computed(() => {
  const q = rechProduit.value.trim().toLowerCase()
  if (!q) return produits.value
  return produits.value.filter(pr =>
    String(pr.code_pf || '').toLowerCase().includes(q) || String(pr.designation || '').toLowerCase().includes(q))
})

// --- Saisie groupée des OF ---
const batchOpen = ref(false)
const batchRows = ref([])
const gen = reactive({ produit_id: '', quantite: '', nombre: 1, lotDepart: '', equipement_id: '', date_reception: '', date_lancement: '' })
const rechGen = ref('')
const produitsGen = computed(() => {
  const q = rechGen.value.trim().toLowerCase()
  if (!q) return produits.value
  return produits.value.filter(pr => String(pr.code_pf || '').toLowerCase().includes(q) || String(pr.designation || '').toLowerCase().includes(q))
})
function prochainLibre() {
  const pris = new Set([...lots.value.map(l => String(l.numero_lot || '').trim()), ...batchRows.value.map(r => String(r.numero_lot || '').trim())])
  let n = Number(dernierLot.value || 0) + 1
  while (pris.has(String(n))) n++
  return String(n)
}
function tailleDe(pid) { const pr = produits.value.find(p => p.id === pid); return (pr && pr.taille_lot != null && pr.taille_lot !== '') ? pr.taille_lot : '' }
function estFige(pid) { return tailleDe(pid) !== '' }
function onGenProduit() { const t = tailleDe(gen.produit_id); if (t !== '') gen.quantite = t }
function onRowProduit(r) { const t = tailleDe(r.produit_id); if (t !== '') r.quantite_theorique = t }
function ajouterBatch() {
  if (!gen.produit_id) { erreur.value = 'Choisis un produit pour la génération.'; return }
  const t = tailleDe(gen.produit_id)
  const qte = t !== '' ? t : gen.quantite   // quantité figée sur la taille de lot si le produit en a une
  const n = Math.max(1, Math.floor(Number(gen.nombre) || 1))
  const depart = String(gen.lotDepart).trim() !== '' && !isNaN(Number(gen.lotDepart)) ? Number(gen.lotDepart) : null
  for (let i = 0; i < n; i++) {
    const lot = depart != null ? String(depart + i) : prochainLibre()
    batchRows.value.push({ numero_lot: lot, produit_id: gen.produit_id, quantite_theorique: qte, equipement_id: gen.equipement_id || '', date_reception: gen.date_reception || '', date_lancement: gen.date_lancement || '' })
  }
  erreur.value = ''
}
function ajouterLigneBatch() { batchRows.value.push({ numero_lot: prochainLibre(), produit_id: '', quantite_theorique: '', equipement_id: '', date_reception: '', date_lancement: '' }) }
function retirerBatch(i) { batchRows.value.splice(i, 1) }
async function enregistrerBatch() {
  erreur.value = ''; message.value = ''
  const valides = batchRows.value.filter(r => String(r.numero_lot || '').trim() && r.produit_id)
  if (!valides.length) { erreur.value = 'Aucune ligne valide (numéro de lot + produit requis).'; return }
  const nums = valides.map(r => String(r.numero_lot).trim())
  if (new Set(nums).size !== nums.length) { erreur.value = 'Des numéros de lot sont en double dans la saisie.'; return }
  const payload = valides.map(r => ({ numero_lot: String(r.numero_lot).trim(), produit_id: r.produit_id, quantite_theorique: toNum(r.quantite_theorique), equipement_id: r.equipement_id || null, date_reception: r.date_reception || null, date_lancement: r.date_lancement || null, statut: 'Planifié' }))
  const res = await supabase.from('ordres_fabrication').insert(payload)
  if (res.error) { const m = res.error.message || ''; erreur.value = (res.error.code === '23505' || /duplicate/i.test(m)) ? 'Un ou plusieurs numéros de lot existent déjà (choisis des numéros uniques).' : m; return }
  message.value = valides.length + ' OF créés.'
  batchRows.value = []; batchOpen.value = false
  await chargerTout()
}

// --- Affectation groupée de la ligne de conditionnement ---
const selection = ref(new Set())
const ligneGroupe = ref('')
const msgGroupe = ref('')
const nbSel = computed(() => selection.value.size)
function toggleSel(id) { const st = new Set(selection.value); st.has(id) ? st.delete(id) : st.add(id); selection.value = st }
function toutSel() {
  const ids = lotsAffiches.value.map(l => l.id)
  const tous = ids.length && ids.every(id => selection.value.has(id))
  const st = new Set(selection.value)
  if (tous) ids.forEach(id => st.delete(id)); else ids.forEach(id => st.add(id))
  selection.value = st
}
async function affecterLigneGroupe() {
  msgGroupe.value = ''
  const ids = [...selection.value]
  if (!ids.length) { msgGroupe.value = 'Sélectionne au moins un OF.'; return }
  const res = await supabase.from('ordres_fabrication').update({ equipement_id: ligneGroupe.value || null }).in('id', ids)
  if (res.error) { msgGroupe.value = 'Erreur : ' + res.error.message; return }
  msgGroupe.value = ids.length + ' OF affectés à la ligne.'
  selection.value = new Set()
  await chargerTout()
  setTimeout(() => { msgGroupe.value = '' }, 4000)
}

async function enregistrer() {
  erreur.value = ''
  message.value = ''
  if (!form.numero_lot.trim() || !form.produit_id) { erreur.value = 'Numéro de lot et produit obligatoires.'; return }
  let statutFinal = form.statut
  if (statutFinal === '__auto__') statutFinal = ['Libéré', 'Rejeté'].includes(statutOriginal.value) ? 'En cours' : (statutOriginal.value || 'Planifié')
  // Fin de fabrication : auto-datée quand le lot passe à Terminé/Libéré -> alimente la file DDL
  let dateFin = form.date_fin_fabrication || null
  if (!dateFin && (statutFinal === 'Terminé' || statutFinal === 'Libéré')) {
    dateFin = new Date().toISOString().slice(0, 10)
    form.date_fin_fabrication = dateFin
  }
  const payload = {
    numero_lot: form.numero_lot.trim(),
    produit_id: form.produit_id,
    quantite_theorique: toNum(form.quantite_theorique),
    date_reception: form.date_reception || null,
    date_fin_validite: form.date_fin_validite || null,
    date_lancement: form.date_lancement || null,
    date_fin_fabrication: dateFin,
    statut: statutFinal,
    equipement_id: form.equipement_id || null,
    commentaire: form.commentaire.trim() || null,
    deviation: !!form.deviation,
    en_triage: !!form.en_triage,
    deviation_cond: !!form.deviation_cond,
    en_triage_cond: !!form.en_triage_cond,
    triage_debut: form.triage_debut || null,
    triage_fin: form.triage_fin || null,
    triage_cond_debut: form.triage_cond_debut || null,
    triage_cond_fin: form.triage_cond_fin || null
  }
  const res = form.id
    ? await supabase.from('ordres_fabrication').update(payload).eq('id', form.id)
    : await supabase.from('ordres_fabrication').insert(payload)
  if (res.error) {
    const m = res.error.message || ''
    if (res.error.code === '23505' || /duplicate key|numero_lot/i.test(m)) {
      erreur.value = 'Ce numéro de lot existe déjà. Choisis un numéro unique, ou modifie le lot existant depuis la liste (bouton « Modifier »).'
    } else {
      erreur.value = m
    }
    return
  }
  message.value = form.id ? 'Lot mis à jour.' : 'Lot créé.'
  resetForm()
  await chargerTout()
}
// Auto-remplir la quantité théorique depuis la taille de lot du produit choisi
function onProduitChange() {
  const pr = produits.value.find(p => p.id === form.produit_id)
  if (pr && pr.taille_lot != null && pr.taille_lot !== '') form.quantite_theorique = pr.taille_lot
}

// Quantité figée uniquement si le produit a une taille de lot ; sinon saisie libre
const qteFigee = computed(() => {
  const pr = produits.value.find(p => p.id === form.produit_id)
  return !!(pr && pr.taille_lot != null && pr.taille_lot !== '')
})
function modifier(l) {
  statutOriginal.value = l.statut || 'Planifié'
  Object.assign(form, {
    id: l.id, numero_lot: l.numero_lot, produit_id: l.produit_id || '',
    quantite_theorique: l.quantite_theorique ?? '', date_lancement: l.date_lancement || '',
    date_reception: l.date_reception || '', date_fin_validite: l.date_fin_validite || '',
    date_fin_fabrication: l.date_fin_fabrication || '',
    statut: ['Libéré', 'Rejeté'].includes(l.statut) ? l.statut : '__auto__', equipement_id: l.equipement_id || '', commentaire: l.commentaire || '', deviation: !!l.deviation, en_triage: !!l.en_triage, deviation_cond: !!l.deviation_cond, en_triage_cond: !!l.en_triage_cond,
    triage_debut: l.triage_debut || '', triage_fin: l.triage_fin || '', triage_cond_debut: l.triage_cond_debut || '', triage_cond_fin: l.triage_cond_fin || ''
  })
}
async function desactiver(l) {
  if (!confirm('Désactiver le lot « ' + l.numero_lot + ' » ?')) return
  erreur.value = ''
  const res = await supabase.from('ordres_fabrication').update({ actif: false }).eq('id', l.id)
  if (res.error) { erreur.value = res.error.message; return }
  await chargerTout()
}
async function supprimer(l) {
  if (!confirm('Supprimer DÉFINITIVEMENT le lot « ' + (l.numero_lot || '') + ' » ?\n\nCette action est irréversible et supprime aussi ses phases de fabrication et son conditionnement.')) return
  erreur.value = ''
  try {
    let r = await supabase.from('suivi_phases').delete().eq('ordre_id', l.id); if (r.error) throw r.error
    r = await supabase.from('conditionnement').delete().eq('ordre_id', l.id); if (r.error) throw r.error
    r = await supabase.from('ordres_fabrication').delete().eq('id', l.id); if (r.error) throw r.error
    await chargerTout()
  } catch (e) { erreur.value = 'Suppression impossible : ' + (e.message || e) + ' (des données liées empêchent peut-être la suppression).' }
}
async function chargerDesactives() {
  const rl = await fetchAllPaged(() => supabase.from('ordres_fabrication')
    .select('*, produits(code_pf, designation), equipements(code, nom)')
    .eq('actif', false).order('numero_lot'))
  if (!rl.error) lotsDesactives.value = rl.data
}
async function reactiver(l) {
  if (!confirm('Réactiver le lot « ' + l.numero_lot + ' » ?')) return
  erreur.value = ''
  const res = await supabase.from('ordres_fabrication').update({ actif: true }).eq('id', l.id)
  if (res.error) { erreur.value = res.error.message; return }
  lotsDesactives.value = lotsDesactives.value.filter(x => x.id !== l.id)
  await chargerTout()
}

function classeStatut(s) {
  return {
    'Planifié': 'st-plan', 'En cours': 'st-cours', 'Terminé': 'st-fini',
    'Libéré': 'st-lib', 'Rejeté': 'st-rej'
  }[s] || 'st-plan'
}
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('fr-FR') : '—' }
function fmt(n) { return n == null ? '—' : Number(n).toLocaleString('fr-FR') }

function telechargerCSV(nom, entetes, lignes) {
  const esc = (c) => { const s = c == null ? '' : String(c); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
  const csv = [entetes, ...lignes].map(r => r.map(esc).join(';')).join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = nom; a.click()
}
function exporterCSV() {
  const entetes = ['N° lot', 'Produit', 'Quantité théorique', 'Date lancement', 'Statut', 'Ligne']
  const lignes = lotsFiltres.value.map(l => [
    l.numero_lot,
    l.produits ? (l.produits.code_pf + ' ' + l.produits.designation) : '',
    l.quantite_theorique ?? '',
    l.date_lancement || '',
    l.statut,
    l.equipements ? l.equipements.code : ''
  ])
  telechargerCSV('ordres_fabrication.csv', entetes, lignes)
}

function fmtDateHeure(d) { return d ? new Date(d).toLocaleString('fr-FR') : '—' }
function signatureDe(l) { return signatures.value.find(s => s.ordre_id === l.id) || null }

async function ouvrirSignature(l) {
  Object.assign(sig, { ordre: l, pin: '', pin2: '', motif: '', erreur: '', busy: false })
  const r = await supabase.rpc('a_un_pin')
  sig.mode = (r.data === true) ? 'sign' : 'set'
  sig.open = true
}
function fermerSignature() { sig.open = false; sig.ordre = null }

async function definirPin() {
  sig.erreur = ''
  if (sig.pin.length < 4) { sig.erreur = 'Le code doit comporter au moins 4 caractères.'; return }
  if (sig.pin !== sig.pin2) { sig.erreur = 'Les deux codes ne correspondent pas.'; return }
  sig.busy = true
  const r = await supabase.rpc('definir_pin', { p_pin: sig.pin })
  sig.busy = false
  if (r.error) { sig.erreur = r.error.message; return }
  sig.mode = 'sign'; sig.pin = ''; sig.pin2 = ''
}

async function signer() {
  sig.erreur = ''
  if (!sig.pin) { sig.erreur = 'Saisis ton code de signature.'; return }
  sig.busy = true
  const r = await supabase.rpc('signer_liberation', { p_ordre_id: sig.ordre.id, p_pin: sig.pin, p_motif: sig.motif })
  sig.busy = false
  if (r.error) { sig.erreur = r.error.message; return }
  const num = sig.ordre.numero_lot
  sig.open = false; sig.ordre = null
  message.value = 'Lot ' + num + ' libéré et signé.'
  await chargerTout()
}

const route = useRoute()
onMounted(async () => {
  await chargerTout()
  const id = route.query.edit
  if (id) {
    const l = lots.value.find(x => String(x.id) === String(id))
    if (l) {
      modifier(l)
      await nextTick()
      if (formCard.value) formCard.value.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }
})
</script>

<template>
  <div class="of-page">
    <PageHeader title="Ordres de fabrication" tone="blue"
      subtitle="Création et suivi des lots de fabrication." />

    <p v-if="erreur" class="alert">{{ erreur }}</p>
    <p v-if="message" class="ok">{{ message }}</p>

    <div v-if="!produits.length" class="empty-card">
      Aucun produit dans le référentiel. Va d'abord dans <strong>Référentiels</strong> créer un produit — il en faut un pour lancer un lot.
    </div>

    <template v-else>
      <div v-if="peutEditer" class="batch-toggle">
        <button type="button" class="btn-groupe" @click="batchOpen = !batchOpen">{{ batchOpen ? '✕ Fermer la saisie groupée' : '⊞ Saisie groupée de plusieurs OF' }}</button>
      </div>
      <section v-if="peutEditer && batchOpen" class="card batch-card">
        <h2 class="card-title">Saisie groupée des OF</h2>
        <div class="gen-row">
          <label>Produit
            <input v-model="rechGen" type="search" placeholder="Filtrer par code ou désignation…" class="gen-search" />
            <select v-model="gen.produit_id" @change="onGenProduit">
              <option value="">— choisir —</option>
              <option v-for="pr in produitsGen" :key="pr.id" :value="pr.id">{{ pr.code_pf }} — {{ pr.designation }}</option>
            </select>
            <span v-if="rechGen" class="gen-count">{{ produitsGen.length }} produit(s)</span>
          </label>
          <label>Quantité<input type="number" v-model="gen.quantite" :readonly="estFige(gen.produit_id)" :class="{ fige: estFige(gen.produit_id) }" placeholder="taille de lot" style="width:110px" /></label>
          <label>Nombre d'OF<input type="number" min="1" v-model.number="gen.nombre" style="width:90px" /></label>
          <label>N° de départ<input type="number" v-model="gen.lotDepart" :placeholder="prochainLot || 'auto'" style="width:110px" /></label>
          <label>Ligne de conditionnement (finale)
            <select v-model="gen.equipement_id">
              <option value="">— aucune —</option>
              <option v-for="e in equipementsCond" :key="e.id" :value="e.id">{{ e.code }} — {{ e.nom }}</option>
            </select>
          </label>
          <label>Réception<input type="date" v-model="gen.date_reception" /></label>
          <label>Lancement<input type="date" v-model="gen.date_lancement" /></label>
          <button type="button" class="btn-add" @click="ajouterBatch">+ Générer les lignes</button>
        </div>
        <table v-if="batchRows.length" class="grid batch-grid">
          <thead><tr><th>N° lot</th><th>Produit</th><th>Quantité</th><th>Ligne cond.</th><th>Réception</th><th>Lancement</th><th></th></tr></thead>
          <tbody>
            <tr v-for="(r, i) in batchRows" :key="i">
              <td><input v-model="r.numero_lot" class="b-inp" /></td>
              <td><select v-model="r.produit_id" @change="onRowProduit(r)" class="b-sel"><option value="">—</option><option v-for="pr in produits" :key="pr.id" :value="pr.id">{{ pr.code_pf }}</option></select></td>
              <td><input type="number" v-model="r.quantite_theorique" :readonly="estFige(r.produit_id)" class="b-inp" :class="{ fige: estFige(r.produit_id) }" /></td>
              <td><select v-model="r.equipement_id" class="b-sel"><option value="">—</option><option v-for="e in equipementsCond" :key="e.id" :value="e.id">{{ e.code }}</option></select></td>
              <td><input type="date" v-model="r.date_reception" class="b-inp" /></td>
              <td><input type="date" v-model="r.date_lancement" class="b-inp" /></td>
              <td><button type="button" class="b-del" @click="retirerBatch(i)">✕</button></td>
            </tr>
          </tbody>
        </table>
        <p v-else class="muted" style="padding:10px 0">Génère des lignes ci-dessus, ou ajoute-les une par une.</p>
        <div class="batch-actions">
          <button type="button" class="btn-ghost2" @click="ajouterLigneBatch">+ Ligne vide</button>
          <button type="button" class="btn-save2" :disabled="!batchRows.length" @click="enregistrerBatch">Enregistrer les {{ batchRows.length }} OF</button>
          <span v-if="erreur" class="b-err">{{ erreur }}</span>
          <span v-if="message" class="b-ok">{{ message }}</span>
        </div>
      </section>
      <section class="card" v-if="peutEditer" ref="formCard">
        <h2 class="card-title">{{ form.id ? 'Modifier le lot' : 'Nouveau lot' }}</h2>
        <div class="form-grid">
          <label>N° de lot<input v-model="form.numero_lot" placeholder="L260145" /><span v-if="dernierLot" class="lot-hint">Dernier lot : <b>{{ dernierLot }}</b><button v-if="prochainLot" type="button" class="lot-next" @click="form.numero_lot = prochainLot" title="Remplir avec le lot suivant">→ {{ prochainLot }}</button></span></label>
          <label class="wide">Produit
            <input v-model="rechProduit" type="search" class="prod-search" placeholder="Filtrer par code ou désignation…" />
            <select v-model="form.produit_id" @change="onProduitChange">
              <option value="">— Choisir un produit — ({{ produitsForm.length }})</option>
              <option v-for="p in produitsForm" :key="p.id" :value="p.id">{{ p.code_pf }} — {{ p.designation }}</option>
            </select>
          </label>
          <label>Quantité théorique<input v-model="form.quantite_theorique" type="number" placeholder="500000" :disabled="qteFigee" :title="qteFigee ? 'Figée : taille de lot du produit (Référentiels).' : 'Saisir la quantité (pas de taille de lot définie pour ce produit).'" /></label>
          <label>Date de réception OF<input v-model="form.date_reception" type="date" /></label>
          <label>Date fin de validité OF<input v-model="form.date_fin_validite" type="date" /></label>
          <label>Statut
            <select v-model="form.statut" title="Seuls Libéré / Rejeté (qualité) sont manuels. Planifié / En cours / Terminé sont automatiques.">
              <option value="__auto__">Automatique (piloté par fabrication + conditionnement)</option>
              <option value="Libéré">Libéré (qualité)</option>
              <option value="Rejeté">Rejeté (qualité)</option>
            </select>
          </label>
          <label>Ligne de conditionnement (finale)
            <select v-model="form.equipement_id">
              <option value="">— à affecter —</option>
              <option v-for="e in equipementsCond" :key="e.id" :value="e.id">{{ e.code }} — {{ e.nom }}</option>
            </select>
          </label>
          <label class="wide">Commentaire<input v-model="form.commentaire" placeholder="Remarque éventuelle" /></label>
          <div class="wide chk-row chk-row-1l">
            <label class="chk"><input type="checkbox" v-model="form.deviation" /> Déviation fabrication</label>
            <label class="chk"><input type="checkbox" v-model="form.deviation_cond" /> Déviation conditionnement</label>
            <label class="chk"><input type="checkbox" v-model="form.en_triage" @change="majTriage('fab')" /> En triage fabrication</label>
            <label class="chk"><input type="checkbox" v-model="form.en_triage_cond" @change="majTriage('cond')" /> En triage conditionnement</label>
          </div>
          <div class="wide chk-row" v-if="form.en_triage">
            <span class="tri-lbl">Triage fabrication :</span>
            <label class="tri-d">Début <input type="date" v-model="form.triage_debut" /></label>
            <label class="tri-d">Fin <input type="date" v-model="form.triage_fin" /></label>
          </div>
          <div class="wide chk-row" v-if="form.en_triage_cond">
            <span class="tri-lbl">Triage conditionnement :</span>
            <label class="tri-d">Début <input type="date" v-model="form.triage_cond_debut" /></label>
            <label class="tri-d">Fin <input type="date" v-model="form.triage_cond_fin" /></label>
          </div>
          <div class="form-actions">
            <button class="btn" @click="enregistrer">{{ form.id ? 'Mettre à jour' : 'Créer le lot' }}</button>
            <button v-if="form.id" class="btn ghost" @click="resetForm">Annuler</button>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-head">
          <h2 class="card-title">Lots</h2>
          <span class="count">{{ lotsFiltres.length }}</span>
          <div class="head-tools">
            <input v-model="rechercheLot" type="search" class="recherche" placeholder="Rechercher (n° lot, code, désignation)…" />
            <input v-model="lotDeb" type="number" class="filtre-lot" placeholder="Lot début" title="N° de lot de début" />
            <input v-model="lotFin" type="number" class="filtre-lot" placeholder="Lot fin" title="N° de lot de fin" />
            <select v-model.number="anneeF" class="filtre2">
              <option :value="0">Toutes années</option>
              <option v-for="a in anneesLot" :key="a" :value="a">{{ a }}</option>
            </select>
            <select v-model.number="moisF" class="filtre2">
              <option :value="0">Tous les mois</option>
              <option v-for="m in MOIS" :key="m.v" :value="m.v">{{ m.l }}</option>
            </select>
            <select v-model="filtreStatut" class="filtre2">
              <option value="">Tous les statuts</option>
              <option v-for="s in STATUTS" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
          <button class="btn-exp" @click="exporterCSV" :disabled="!lotsFiltres.length">Exporter CSV</button>
          <label class="chk-desact"><input type="checkbox" v-model="afficherDesactives" @change="afficherDesactives && chargerDesactives()" /> Afficher les lots désactivés</label>
        </div>

        <p v-if="msgGroupe" class="b-ok" style="margin:0 0 10px">{{ msgGroupe }}</p>
        <div v-if="nbSel" class="bulk-bar">
          <span class="bulk-n">{{ nbSel }} OF sélectionné(s)</span>
          <label>Ligne de conditionnement (finale)
            <select v-model="ligneGroupe">
              <option value="">— aucune —</option>
              <option v-for="e in equipementsCond" :key="e.id" :value="e.id">{{ e.code }} — {{ e.nom }}</option>
            </select>
          </label>
          <button type="button" class="btn-affect" @click="affecterLigneGroupe">Affecter à {{ nbSel }} OF</button>
          <button type="button" class="btn-ghost2" @click="selection = new Set()">Désélectionner</button>
        </div>

        <div class="table-scroll">
          <table class="grid">
            <thead>
              <tr>
                <th class="chk-col"><input type="checkbox" :checked="lotsAffiches.length && lotsAffiches.every(l => selection.has(l.id))" @change="toutSel" title="Tout sélectionner" /></th>
                <th>N° lot</th><th>Produit</th><th class="right">Qté théo.</th>
                <th>Lancement</th><th>Statut</th><th>Ligne</th><th class="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="l in lotsAffiches" :key="l.id" :class="{ 'row-sel': selection.has(l.id) }">
                <td class="chk-col"><input type="checkbox" :checked="selection.has(l.id)" @change="toggleSel(l.id)" /></td>
                <td class="mono">{{ l.numero_lot }}</td>
                <td>
                  <span class="mono">{{ l.produits ? l.produits.code_pf : '—' }}</span>
                  <span class="desig"> {{ l.produits ? l.produits.designation : '' }}</span>
                </td>
                <td class="right">{{ fmt(l.quantite_theorique) }}</td>
                <td>{{ fmtDate(l.date_lancement) }}</td>
                <td>
                  <span class="badge" :class="classeStatut(l.statut)">{{ l.statut }}</span>
                  <div v-if="l.statut === 'Libéré' && signatureDe(l)" class="sig-info">✍ {{ signatureDe(l).email }}<br>{{ fmtDateHeure(signatureDe(l).signed_at) }}</div>
                </td>
                <td>{{ l.equipements ? l.equipements.code : '—' }}</td>
                <td class="right nowrap">
                  <template v-if="peutEditer">
                    <button v-if="l.statut === 'Terminé'" class="link release" @click="ouvrirSignature(l)">Libérer (signer)</button>
                    <button class="link" @click="modifier(l)">Modifier</button>
                    <button class="link link-del" @click="supprimer(l)">Supprimer</button>
                    <button class="link danger" @click="desactiver(l)">Désactiver</button>
                  </template>
                </td>
              </tr>
              <tr v-if="!lotsFiltres.length"><td colspan="7" class="empty">Aucun lot ne correspond aux filtres.</td></tr>
              <tr v-else-if="lotsFiltres.length > LIMITE"><td colspan="7" class="cap-note">… {{ lotsFiltres.length - LIMITE }} autres lots masqués — affine les filtres (l'export CSV reste complet).</td></tr>
            </tbody>
          </table>
        </div>

        <div v-if="afficherDesactives" class="desact-block">
          <h3 class="desact-h">Lots désactivés <span class="desact-n">{{ lotsDesactives.length }}</span></h3>
          <div class="table-scroll">
            <table class="grid">
              <thead><tr><th>N° lot</th><th>Produit</th><th class="right">Qté théo.</th><th>Statut</th><th class="right">Action</th></tr></thead>
              <tbody>
                <tr v-for="l in lotsDesactives" :key="l.id">
                  <td class="mono">{{ l.numero_lot }}</td>
                  <td><span class="mono">{{ l.produits ? l.produits.code_pf : '—' }}</span><span class="desig"> {{ l.produits ? l.produits.designation : '' }}</span></td>
                  <td class="right">{{ fmt(l.quantite_theorique) }}</td>
                  <td><span class="badge" :class="classeStatut(l.statut)">{{ l.statut }}</span></td>
                  <td class="right"><button v-if="peutEditer" class="link ok" @click="reactiver(l)">Réactiver</button></td>
                </tr>
                <tr v-if="!lotsDesactives.length"><td colspan="5" class="empty">Aucun lot désactivé.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </template>

    <div v-if="sig.open" class="modal-overlay" @click.self="fermerSignature">
      <div class="modal">
        <template v-if="sig.mode === 'set'">
          <h3 class="modal-title">Définir votre code de signature</h3>
          <p class="modal-sub">Ce code confidentiel vous servira à signer électroniquement les libérations de lot. Vous le choisissez une fois ; il vous sera redemandé à chaque signature.</p>
          <label class="modal-field">Nouveau code
            <input v-model="sig.pin" type="password" autocomplete="new-password" placeholder="Au moins 4 caractères" />
          </label>
          <label class="modal-field">Confirmer le code
            <input v-model="sig.pin2" type="password" autocomplete="new-password" @keyup.enter="definirPin" />
          </label>
          <p v-if="sig.erreur" class="modal-err">{{ sig.erreur }}</p>
          <div class="modal-actions">
            <button class="btn ghost" @click="fermerSignature">Annuler</button>
            <button class="btn" :disabled="sig.busy" @click="definirPin">Enregistrer le code</button>
          </div>
        </template>
        <template v-else>
          <h3 class="modal-title">Signer la libération</h3>
          <p class="modal-sub">Lot <strong>{{ sig.ordre ? sig.ordre.numero_lot : '' }}</strong>. En signant, vous attestez la libération de ce lot. L'action est tracée, horodatée et nominative.</p>
          <label class="modal-field">Motif
            <input v-model="sig.motif" placeholder="Libération du lot" />
          </label>
          <label class="modal-field">Votre code de signature
            <input v-model="sig.pin" type="password" autocomplete="off" placeholder="••••" @keyup.enter="signer" />
          </label>
          <p v-if="sig.erreur" class="modal-err">{{ sig.erreur }}</p>
          <div class="modal-actions">
            <button class="btn ghost" @click="fermerSignature">Annuler</button>
            <button class="btn" :disabled="sig.busy" @click="signer">Signer et libérer</button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.of-page { color: #1b2733; }
.of-head { margin: 4px 0 18px; }
.of-head h1 { margin: 0; font-size: 24px; letter-spacing: -0.01em; }
.of-head .sub { margin: 4px 0 0; color: #64748b; font-size: 14px; }

.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }
.ok { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }

.empty-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 28px; color: #475569; text-align: center; font-size: 15px; }

.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 22px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-title { margin: 0 0 14px; font-size: 17px; }
.batch-toggle { margin-bottom: 14px; }
.btn-groupe { background: #0f766e; color: #fff; border: none; border-radius: 9px; font: inherit; font-size: 14px; font-weight: 600; padding: 9px 18px; cursor: pointer; }
.btn-groupe:hover { background: #0c5f59; }
.batch-card { border: 2px solid #99f6e4; }
.gen-row { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; padding: 14px; background: #f0fdfa; border-radius: 10px; margin-bottom: 14px; }
.gen-row label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: #334155; }
.gen-row input, .gen-row select { padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 7px; font: inherit; font-size: 13px; }
.gen-row select { min-width: 220px; }
.gen-search { padding: 6px 9px; border: 1px solid #cbd5e1; border-radius: 6px; font: inherit; font-size: 12.5px; width: 240px; }
.gen-count { font-size: 11px; color: #64748b; font-weight: 500; }
.btn-add { background: #0f766e; color: #fff; border: none; border-radius: 8px; font: inherit; font-weight: 600; padding: 8px 16px; cursor: pointer; }
.batch-grid { width: 100%; }
.batch-grid th { text-align: left; font-size: 11.5px; color: #64748b; padding: 6px 8px; }
.batch-grid td { padding: 4px 6px; }
.b-inp, .b-sel { width: 100%; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font: inherit; font-size: 13px; }
.b-del { background: #fee2e2; color: #b91c1c; border: none; border-radius: 6px; width: 26px; height: 26px; cursor: pointer; font-weight: 700; }
.fige { background: #eef2f6 !important; color: #64748b; cursor: not-allowed; }
.bulk-bar { display: flex; align-items: flex-end; gap: 14px; flex-wrap: wrap; padding: 12px 16px; background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 10px; margin-bottom: 12px; }
.bulk-n { font-weight: 700; color: #0f766e; padding-bottom: 8px; }
.bulk-bar label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 600; color: #334155; }
.bulk-bar select { padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 7px; font: inherit; font-size: 13px; min-width: 220px; }
.btn-affect { background: #0f766e; color: #fff; border: none; border-radius: 8px; font: inherit; font-weight: 600; padding: 9px 18px; cursor: pointer; }
.chk-col { width: 34px; text-align: center; }
.filtre-lot { width: 100px; padding: 7px 9px; border: 1px solid #cbd5e1; border-radius: 7px; font: inherit; font-size: 13px; }
.row-sel { background: #ecfeff; }
.batch-actions { display: flex; gap: 10px; margin-top: 14px; align-items: center; flex-wrap: wrap; }
.btn-save2 { background: #0f766e; color: #fff; border: none; border-radius: 8px; font: inherit; font-weight: 600; padding: 9px 20px; cursor: pointer; }
.btn-save2:disabled { opacity: .5; cursor: not-allowed; }
.btn-ghost2 { background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; padding: 8px 16px; cursor: pointer; }
.b-err { color: #b91c1c; font-size: 13px; font-weight: 600; }
.b-ok { color: #15803d; font-size: 13px; font-weight: 600; }
.card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.card-head .card-title { margin: 0; }
.count { background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 600; padding: 2px 9px; border-radius: 999px; }
.filtre { margin-left: auto; font-size: 13px; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; }
.btn-exp { font-size: 13px; padding: 7px 12px; border: 1px solid #0f766e; border-radius: 8px; background: #fff; color: #0f766e; font-weight: 600; cursor: pointer; white-space: nowrap; }
.btn-exp:hover { background: #ecfdf5; }
.btn-exp:disabled { opacity: .45; cursor: not-allowed; }

.form-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; align-items: end; }
.form-grid label { display: flex; flex-direction: column; font-size: 12px; font-weight: 600; color: #475569; gap: 5px; }
.form-grid input:disabled { background: #f1f5f9; color: #64748b; cursor: not-allowed; }
.form-grid .wide { grid-column: span 2; }
.form-grid input, .form-grid select { font-size: 14px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; font-weight: 400; }
.form-grid input:focus, .form-grid select:focus { outline: 2px solid #0f766e; border-color: #0f766e; }
.form-actions { display: flex; gap: 8px; align-items: end; grid-column: 1 / -1; }

.btn { background: #0f766e; color: #fff; border: 0; padding: 9px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.btn:hover { background: #0c5f59; }
.btn.ghost { background: #fff; color: #475569; border: 1px solid #cbd5e1; }
.btn.ghost:hover { background: #f8fafc; }

.table-scroll { overflow-x: auto; }
table.grid { width: 100%; border-collapse: collapse; font-size: 14px; }
table.grid th { text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
table.grid td { padding: 9px 10px; border-bottom: 1px solid #eef2f6; white-space: nowrap; }
table.grid tr:hover td { background: #f8fafc; }
.right { text-align: right; }
.nowrap { white-space: nowrap; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 600; }
.desig { color: #64748b; font-size: 12px; }
.empty { color: #94a3b8; text-align: center; padding: 18px; font-style: italic; }

.badge { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; }
.st-plan { background: #f1f5f9; color: #475569; }
.st-cours { background: #dbeafe; color: #1e40af; }
.st-fini { background: #ccfbf1; color: #0f766e; }
.st-lib { background: #dcfce7; color: #166534; }
.st-rej { background: #fee2e2; color: #b91c1c; }

button.link { background: none; border: 0; color: #0f766e; font-size: 13px; font-weight: 600; cursor: pointer; padding: 2px 6px; }
button.link:hover { text-decoration: underline; }
button.link.danger { color: #b91c1c; }
button.link.release { color: #166534; }

.sig-info { font-size: 11px; color: #166534; margin-top: 4px; line-height: 1.3; }

.modal-overlay { position: fixed; inset: 0; background: rgba(15,42,51,.55); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 16px; }
.modal { background: #fff; border-radius: 14px; padding: 22px; width: 100%; max-width: 420px; box-shadow: 0 20px 50px rgba(0,0,0,.25); }
.modal-title { margin: 0 0 6px; font-size: 18px; }
.modal-sub { margin: 0 0 16px; font-size: 13px; color: #64748b; line-height: 1.45; }
.modal-field { display: flex; flex-direction: column; font-size: 12px; font-weight: 600; color: #475569; gap: 5px; margin-bottom: 12px; }
.modal-field input { font-size: 15px; padding: 9px 11px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; font-weight: 400; }
.modal-field input:focus { outline: 2px solid #0f766e; border-color: #0f766e; }
.modal-err { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 8px 10px; border-radius: 8px; font-size: 13px; margin: 0 0 12px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }

@media (max-width: 820px) {
  .form-grid { grid-template-columns: 1fr 1fr; }
  .form-grid .wide { grid-column: span 2; }
}
.head-tools { margin-left: auto; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.recherche { font-size: 13px; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; min-width: 220px; }
.recherche:focus { outline: 2px solid #0f766e; border-color: #0f766e; }
.filtre2 { font-size: 13px; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; }
.cap-note { color: #94a3b8; font-size: 12px; padding: 8px 10px; }
.prod-search { font-size: 13px; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; width: 100%; box-sizing: border-box; margin-bottom: 5px; }
.prod-search:focus { outline: 2px solid #0f766e; border-color: #0f766e; }
.hint-statut { font-weight: 500; font-size: 11px; color: #94a3b8; margin-top: 2px; }
.lot-hint { display: block; margin-top: 5px; font-size: 12px; color: #64748b; font-weight: 500; }
.lot-hint b { color: #0f766e; }
.lot-next { margin-left: 8px; font-size: 12px; font-weight: 600; color: #0f766e; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 1px 7px; cursor: pointer; }
.lot-next:hover { background: #d1fae5; }
.chk-row { display: flex; flex-wrap: wrap; gap: 18px; align-items: center; }
.chk { display: inline-flex; align-items: center; gap: 7px; font-size: 13.5px; color: #334155; cursor: pointer; font-weight: 500; }
.chk input { width: 16px; height: 16px; cursor: pointer; }
.tri-d { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #475569; font-weight: 500; }
.tri-d input { padding: 4px 8px; font-size: 13px; }
.chk-desact { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #475569; cursor: pointer; margin-left: 8px; }
.desact-block { margin-top: 18px; padding-top: 14px; border-top: 2px dashed #e2e8f0; }
.desact-h { font-size: 15px; font-weight: 800; color: #0f172a; margin: 0 0 10px; display: flex; align-items: center; gap: 8px; }
.desact-n { background: #f1f5f9; color: #64748b; font-size: 12px; padding: 2px 8px; border-radius: 10px; }
.link.ok { color: #15803d; font-weight: 700; }

/* 4 cases (déviation/triage) sur une seule ligne */
.chk-row-1l { display: flex; flex-wrap: wrap; gap: 18px; align-items: center; }
.tri-lbl { font-size: 12px; font-weight: 700; color: #64748b; }
.link.link-del { color: #dc2626; }
.link.link-del:hover { color: #b91c1c; }
</style>
