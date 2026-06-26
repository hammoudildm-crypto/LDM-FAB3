<script setup>
import { ref, reactive, onMounted } from 'vue'
import { supabase } from '../supabase'

const donneurs = ref([])
const produits = ref([])
const erreur = ref('')

const FORMES = ['comprimé', 'gélule', 'crème', 'pommade']

// --- Formulaire Donneur d'ordre ---
const formDO = reactive({ id: null, code: '', nom: '', activite: '' })
function resetDO() { Object.assign(formDO, { id: null, code: '', nom: '', activite: '' }) }

// --- Formulaire Produit ---
const formP = reactive({
  id: null, code_pf: '', designation: '', forme: '', donneur_ordre_id: '',
  unites_par_boite: '', taille_lot: '', duree_vie_mois: '', aql: '', pcsu: ''
})
function resetP() {
  Object.assign(formP, {
    id: null, code_pf: '', designation: '', forme: '', donneur_ordre_id: '',
    unites_par_boite: '', taille_lot: '', duree_vie_mois: '', aql: '', pcsu: ''
  })
}

function toNum(v) { return v === '' || v === null ? null : Number(v) }

async function chargerTout() {
  erreur.value = ''
  const rDO = await supabase.from('donneurs_ordre').select('*').eq('actif', true).order('nom')
  if (rDO.error) { erreur.value = rDO.error.message; return }
  donneurs.value = rDO.data

  const rP = await supabase.from('produits')
    .select('*, donneurs_ordre(nom, code)').eq('actif', true).order('code_pf')
  if (rP.error) { erreur.value = rP.error.message; return }
  produits.value = rP.data
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
    unites_par_boite: p.unites_par_boite ?? '', taille_lot: p.taille_lot ?? '',
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

      <div class="form-grid do-grid">
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
          <thead>
            <tr><th>Code</th><th>Nom</th><th>Activité</th><th class="right">Actions</th></tr>
          </thead>
          <tbody>
            <tr v-for="d in donneurs" :key="d.id">
              <td class="mono">{{ d.code }}</td>
              <td>{{ d.nom }}</td>
              <td>{{ d.activite || '—' }}</td>
              <td class="right nowrap">
                <button class="link" @click="modifierDO(d)">Modifier</button>
                <button class="link danger" @click="desactiverDO(d)">Désactiver</button>
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

      <div class="form-grid p-grid">
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
              <th class="right">U/boîte</th><th class="right">Taille lot</th><th class="right">PCSU</th>
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
              <td class="right">{{ p.taille_lot ?? '—' }}</td>
              <td class="right">{{ p.pcsu ?? '—' }}</td>
              <td class="right nowrap">
                <button class="link" @click="modifierP(p)">Modifier</button>
                <button class="link danger" @click="desactiverP(p)">Désactiver</button>
              </td>
            </tr>
            <tr v-if="!produits.length"><td colspan="8" class="empty">Aucun produit. Ajoute-en un ci-dessus.</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ref-page { color: #1b2733; }
.ref-head { margin: 4px 0 20px; }
.ref-head h1 { margin: 0; font-size: 24px; letter-spacing: -0.01em; }
.ref-head .sub { margin: 4px 0 0; color: #64748b; font-size: 14px; }

.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 16px; }

.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 22px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.card-head h2 { margin: 0; font-size: 17px; }
.count { background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 600; padding: 2px 9px; border-radius: 999px; }

.form-grid { display: grid; gap: 12px; align-items: end; padding: 14px; background: #f8fafc; border: 1px solid #eef2f6; border-radius: 10px; margin-bottom: 16px; }
.do-grid { grid-template-columns: 1fr 2fr 1.4fr auto; }
.p-grid { grid-template-columns: repeat(4, 1fr) auto; }
.form-grid label { display: flex; flex-direction: column; font-size: 12px; font-weight: 600; color: #475569; gap: 5px; }
.form-grid input, .form-grid select { font-size: 14px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; font-weight: 400; }
.form-grid input:focus, .form-grid select:focus { outline: 2px solid #0f766e; outline-offset: 0; border-color: #0f766e; }
.form-actions { display: flex; gap: 8px; align-items: end; }

.btn { background: #0f766e; color: #fff; border: 0; padding: 9px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.btn:hover { background: #0c5f59; }
.btn.ghost { background: #fff; color: #475569; border: 1px solid #cbd5e1; }
.btn.ghost:hover { background: #f8fafc; }

.table-scroll { overflow-x: auto; }
table.grid { width: 100%; border-collapse: collapse; font-size: 14px; }
table.grid th { text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
table.grid td { padding: 9px 10px; border-bottom: 1px solid #eef2f6; }
table.grid tr:hover td { background: #f8fafc; }
.right { text-align: right; }
.nowrap { white-space: nowrap; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 600; }
.empty { color: #94a3b8; text-align: center; padding: 18px; font-style: italic; }

button.link { background: none; border: 0; color: #0f766e; font-size: 13px; font-weight: 600; cursor: pointer; padding: 2px 6px; }
button.link:hover { text-decoration: underline; }
button.link.danger { color: #b91c1c; }

@media (max-width: 820px) {
  .do-grid, .p-grid { grid-template-columns: 1fr 1fr; }
  .form-actions { grid-column: 1 / -1; }
}
</style>
