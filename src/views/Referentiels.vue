<script setup>
import { ref, reactive, onMounted, inject } from 'vue'
import { supabase } from '../supabase'

const peutEditer = inject('peutEditer', ref(true))

const donneurs = ref([])
const produits = ref([])
const ateliers = ref([])
const equipements = ref([])
const erreur = ref('')

const FORMES = ['comprimé', 'gélule', 'gel', 'crème', 'pommade', 'sachet']

// --- Donneur d'ordre ---
const formDO = reactive({ id: null, code: '', nom: '', activite: '' })
function resetDO() { Object.assign(formDO, { id: null, code: '', nom: '', activite: '' }) }

// --- Produit ---
const formP = reactive({
  id: null, code_pf: '', designation: '', forme: '', donneur_ordre_id: '',
  unites_par_boite: '', poids_unitaire_mg: '', taille_lot: '', duree_vie_mois: '', aql: '', pcsu: ''
})
function resetP() {
  Object.assign(formP, {
    id: null, code_pf: '', designation: '', forme: '', donneur_ordre_id: '',
    unites_par_boite: '', poids_unitaire_mg: '', taille_lot: '', duree_vie_mois: '', aql: '', pcsu: ''
  })
}

// --- Atelier ---
const formA = reactive({ id: null, code: '', nom: '' })
function resetA() { Object.assign(formA, { id: null, code: '', nom: '' }) }

// --- Équipement ---
const formE = reactive({ id: null, code: '', nom: '', atelier_id: '', type: '' })
function resetE() { Object.assign(formE, { id: null, code: '', nom: '', atelier_id: '', type: '' }) }

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
    taille_lot: toNum(formP.taille_lot),
    duree_vie_mois: toNum(formP.duree_vie_mois),
    aql: formP.aql.trim() || null,
    pcsu: toNum(formP.pcsu)
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
    unites_par_boite: p.unites_par_boite ?? '', poids_unitaire_mg: p.poids_unitaire_mg ?? '', taille_lot: p.taille_lot ?? '',
    duree_vie_mois: p.duree_vie_mois ?? '', aql: p.aql || '', pcsu: p.pcsu ?? ''
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

// --- Actions Équipement ---
async function enregistrerE() {
  erreur.value = ''
  if (!formE.code.trim() || !formE.nom.trim()) { erreur.value = 'Code et nom de l\'équipement obligatoires.'; return }
  const payload = { code: formE.code.trim(), nom: formE.nom.trim(), atelier_id: formE.atelier_id || null, type: formE.type.trim() || null }
  const res = formE.id
    ? await supabase.from('equipements').update(payload).eq('id', formE.id)
    : await supabase.from('equipements').insert(payload)
  if (res.error) { erreur.value = res.error.message; return }
  resetE()
  await chargerTout()
}
function modifierE(e) { Object.assign(formE, { id: e.id, code: e.code, nom: e.nom, atelier_id: e.atelier_id || '', type: e.type || '' }) }
async function desactiverE(e) {
  if (!confirm('Désactiver l\'équipement « ' + e.nom + ' » ?')) return
  erreur.value = ''
  const res = await supabase.from('equipements').update({ actif: false }).eq('id', e.id)
  if (res.error) { erreur.value = res.error.message; return }
  await chargerTout()
}

onMounted(chargerTout)
</script>

<template>
  <div class="ref-page">
    <header class="ref-head">
      <h1>Référentiels</h1>
      <p class="sub">Données de base de LDM-FAB3 — tout le reste de l'application s'appuie dessus.</p>
    </header>

    <p v-if="erreur" class="alert">{{ erreur }}</p>

    <!-- DONNEURS D'ORDRE -->
    <section class="card">
      <div class="card-head">
        <h2>Donneurs d'ordre</h2>
        <span class="count">{{ donneurs.length }}</span>
      </div>
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
    </section>

    <!-- PRODUITS -->
    <section class="card">
      <div class="card-head">
        <h2>Produits</h2>
        <span class="count">{{ produits.length }}</span>
      </div>
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
        <label>Poids unitaire (mg)<input v-model="formP.poids_unitaire_mg" type="number" step="any" placeholder="350" /></label>
        <label>Taille de lot<input v-model="formP.taille_lot" type="number" placeholder="500000" /></label>
        <label>Durée de vie (mois)<input v-model="formP.duree_vie_mois" type="number" placeholder="36" /></label>
        <label>AQL<input v-model="formP.aql" placeholder="0.65" /></label>
        <label>PCSU<input v-model="formP.pcsu" type="number" step="any" placeholder="12.50" /></label>
        <div class="form-actions">
          <button class="btn" @click="enregistrerP">{{ formP.id ? 'Mettre à jour' : 'Ajouter' }}</button>
          <button v-if="formP.id" class="btn ghost" @click="resetP">Annuler</button>
        </div>
      </div>
      <div class="table-scroll">
        <table class="grid">
          <thead>
            <tr>
              <th>Code PF</th><th>Désignation</th><th>Forme</th><th>Donneur d'ordre</th>
              <th class="right">U/boîte</th><th class="right">Poids (mg)</th><th class="right">Taille lot</th><th class="right">PCSU</th>
              <th class="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in produits" :key="p.id">
              <td class="mono">{{ p.code_pf }}</td>
              <td>{{ p.designation }}</td>
              <td>{{ p.forme || '—' }}</td>
              <td>{{ p.donneurs_ordre ? p.donneurs_ordre.nom : '—' }}</td>
              <td class="right">{{ p.unites_par_boite ?? '—' }}</td>
              <td class="right">{{ p.poids_unitaire_mg ?? '—' }}</td>
              <td class="right">{{ p.taille_lot ?? '—' }}</td>
              <td class="right">{{ p.pcsu ?? '—' }}</td>
              <td class="right nowrap">
                <template v-if="peutEditer">
                  <button class="link" @click="modifierP(p)">Modifier</button>
                  <button class="link danger" @click="desactiverP(p)">Désactiver</button>
                </template>
              </td>
            </tr>
            <tr v-if="!produits.length"><td colspan="9" class="empty">Aucun produit. Ajoute-en un ci-dessus.</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ATELIERS -->
    <section class="card">
      <div class="card-head">
        <h2>Ateliers</h2>
        <span class="count">{{ ateliers.length }}</span>
      </div>
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
    </section>

    <!-- ÉQUIPEMENTS -->
    <section class="card">
      <div class="card-head">
        <h2>Équipements</h2>
        <span class="count">{{ equipements.length }}</span>
      </div>
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
        <div class="form-actions">
          <button class="btn" @click="enregistrerE">{{ formE.id ? 'Mettre à jour' : 'Ajouter' }}</button>
          <button v-if="formE.id" class="btn ghost" @click="resetE">Annuler</button>
        </div>
      </div>
      <div class="table-scroll">
        <table class="grid">
          <thead><tr><th>Code</th><th>Nom</th><th>Atelier</th><th>Type</th><th
