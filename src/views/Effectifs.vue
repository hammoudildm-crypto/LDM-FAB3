<script setup>
import { ref, reactive, computed, onMounted, inject, provide, watch } from 'vue'
import { supabase } from '../supabase'
import OrgNode from '../components/OrgNode.vue'
import PageHeader from '../components/PageHeader.vue'
import { ICONS, TINTS } from '../icons.js'

const peutEditer = inject('peutEditer', ref(true))

const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const anneeCourante = new Date().getFullYear()
const ANNEES = [anneeCourante - 1, anneeCourante, anneeCourante + 1]
const PERIMETRES = ['Fabrication forme sèche', 'Fabrication forme semi solide', 'Fabrication forme sèche hormonale', 'Partie premix', 'Partie vrac']

const effectifs = ref([])
const ateliers = ref([])
const filtreAnnee = ref('')
const filtreAtelier = ref('')
const erreur = ref('')
const message = ref('')

const form = reactive({
  id: null, atelier_id: '', annee: anneeCourante, mois: new Date().getMonth() + 1,
  equipe: '', effectif: '', commentaire: ''
})
function resetForm() {
  Object.assign(form, {
    id: null, atelier_id: '', annee: anneeCourante, mois: new Date().getMonth() + 1,
    equipe: '', effectif: '', commentaire: ''
  })
}
function toNum(v) { return v === '' || v === null ? null : Number(v) }
function atelierDe(e) { return ateliers.value.find(a => a.id === e.atelier_id) || null }

async function chargerTout() {
  erreur.value = ''
  const ra = await supabase.from('ateliers').select('id, code, nom').eq('actif', true).order('code')
  if (ra.error) { erreur.value = ra.error.message; return }
  ateliers.value = ra.data

  const re = await supabase.from('effectifs').select('*').eq('actif', true)
    .order('annee', { ascending: false }).order('mois', { ascending: false }).order('id', { ascending: false })
  if (re.error) { erreur.value = re.error.message; return }
  effectifs.value = re.data
  const ro = await supabase.from('organigramme').select('*').eq('actif', true).order('ordre')
  if (!ro.error) orgNodes.value = ro.data || []
}

const effectifsFiltres = computed(() => {
  return effectifs.value.filter(e =>
    (!filtreAnnee.value || e.annee === filtreAnnee.value) &&
    (!filtreAtelier.value || e.atelier_id === filtreAtelier.value)
  )
})
const totalEffectif = computed(() => effectifsFiltres.value.reduce((s, e) => s + Number(e.effectif || 0), 0))

// --- Organigramme ---
const orgNodes = ref([])
const orgForm = reactive({ id: null, nom: '', fonction: '', atelier_id: '', equipe: '', note: '', parent_id: '', matricule: '', telephone: '', photo_url: '', equipement: '' })
function orgReset() { Object.assign(orgForm, { id: null, nom: '', fonction: '', atelier_id: '', equipe: '', note: '', parent_id: '', matricule: '', telephone: '', photo_url: '', equipement: '' }) }
function atelierOrg(id) { const a = ateliers.value.find(x => String(x.id) === String(id)); return a ? a.code : '' }
const RANGS_ORG = ['Manager Fabrication', 'Responsable fabrication', 'Superviseur', 'Chef de ligne', 'Opérateur', "Agent d'hygiène"]
const normOrg = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\u2019\u02bc']/g, "'").replace(/\s+/g, ' ').trim()
function rangOrg(f) { const i = RANGS_ORG.findIndex(r => normOrg(r) === normOrg(f)); return i >= 0 ? i : RANGS_ORG.length }
const responsablesPossibles = computed(() => {
  const monRang = rangOrg(orgForm.fonction)
  return orgNodes.value
    .filter(n => n.id !== orgForm.id && rangOrg(n.fonction) < monRang)
    .sort((a, b) => rangOrg(a.fonction) - rangOrg(b.fonction) || (a.nom || '').localeCompare(b.nom || ''))
})
const orgFlat = computed(() => {
  const byParent = {}
  for (const n of orgNodes.value) { const k = n.parent_id || 'root'; (byParent[k] = byParent[k] || []).push(n) }
  for (const k in byParent) byParent[k].sort((a, b) => (a.ordre || 0) - (b.ordre || 0) || a.id - b.id)
  const out = []
  function walk(key, depth) { for (const n of (byParent[key] || [])) { out.push({ ...n, depth }); walk(n.id, depth + 1) } }
  walk('root', 0)
  return out
})
const orgRacines = computed(() => orgNodes.value.filter(n => !n.parent_id).sort((a, b) => (a.ordre || 0) - (b.ordre || 0) || a.id - b.id))
// pliage + compteur (vue repliée par défaut au 1er chargement)
const orgCollapsed = reactive(new Set())
function orgToggle(id) { if (orgCollapsed.has(id)) orgCollapsed.delete(id); else orgCollapsed.add(id) }
provide('orgUI', { collapsed: orgCollapsed, toggle: orgToggle })
let orgInit = false
watch(orgNodes, () => {
  if (orgInit || !orgNodes.value.length) return
  orgInit = true
  for (const n of orgFlat.value) {
    if (n.depth >= 2 && orgNodes.value.some(x => x.parent_id === n.id)) orgCollapsed.add(n.id)
  }
})
// filtre par périmètre (garde les nœuds du périmètre + leurs ancêtres)
const orgPerimFiltre = ref('')
const orgNodesAffiches = computed(() => {
  if (!orgPerimFiltre.value) return orgNodes.value
  const byId = {}; for (const n of orgNodes.value) byId[n.id] = n
  const keep = new Set()
  for (const n of orgNodes.value) {
    if (normOrg(n.atelier_id) === normOrg(orgPerimFiltre.value)) {
      keep.add(n.id)
      let pp = n.parent_id
      while (pp && byId[pp]) { keep.add(pp); pp = byId[pp].parent_id }
    }
  }
  return orgNodes.value.filter(n => keep.has(n.id))
})
const orgRacinesAffichees = computed(() => orgNodesAffiches.value
  .filter(n => !n.parent_id || !orgNodesAffiches.value.some(x => x.id === n.parent_id))
  .sort((a, b) => (a.ordre || 0) - (b.ordre || 0) || a.id - b.id))
async function orgEnregistrer() {
  erreur.value = ''
  if (!orgForm.nom.trim()) { erreur.value = 'Le nom du poste est requis.'; return }
  const payload = { nom: orgForm.nom.trim(), fonction: orgForm.fonction || null, atelier_id: orgForm.atelier_id || null, equipe: orgForm.equipe || null, note: orgForm.note || null, parent_id: orgForm.parent_id || null, matricule: orgForm.matricule || null, telephone: orgForm.telephone || null, photo_url: orgForm.photo_url || null, equipement: orgForm.equipement || null }
  let r
  if (orgForm.id) r = await supabase.from('organigramme').update(payload).eq('id', orgForm.id)
  else r = await supabase.from('organigramme').insert(payload)
  if (r.error) { erreur.value = r.error.message; return }
  message.value = orgForm.id ? 'Poste mis a jour.' : 'Poste ajoute.'
  orgReset(); await chargerTout()
}
function orgModifier(n) { Object.assign(orgForm, { id: n.id, nom: n.nom, fonction: n.fonction || '', atelier_id: n.atelier_id || '', equipe: n.equipe || '', note: n.note || '', parent_id: n.parent_id || '', matricule: n.matricule || '', telephone: n.telephone || '', photo_url: n.photo_url || '', equipement: n.equipement || '' }) }
async function orgSupprimer(n) {
  if (!confirm('Supprimer le poste ' + n.nom + ' ? Ses subordonnes remonteront d un niveau.')) return
  await supabase.from('organigramme').update({ parent_id: n.parent_id || null }).eq('parent_id', n.id)
  const r = await supabase.from('organigramme').update({ actif: false }).eq('id', n.id)
  if (r.error) { erreur.value = r.error.message; return }
  await chargerTout()
}

async function enregistrer() {
  erreur.value = ''
  message.value = ''
  if (!form.atelier_id) { erreur.value = 'Choisis un atelier.'; return }
  if (form.effectif === '' || form.effectif === null) { erreur.value = 'Saisis un effectif.'; return }
  const payload = {
    atelier_id: form.atelier_id,
    annee: Number(form.annee),
    mois: form.mois ? Number(form.mois) : null,
    equipe: form.equipe.trim() || null,
    effectif: toNum(form.effectif),
    commentaire: form.commentaire.trim() || null
  }
  const res = form.id
    ? await supabase.from('effectifs').update(payload).eq('id', form.id)
    : await supabase.from('effectifs').insert(payload)
  if (res.error) { erreur.value = res.error.message; return }
  message.value = form.id ? 'Effectif mis à jour.' : 'Effectif enregistré.'
  resetForm()
  await chargerTout()
}
function modifier(e) {
  Object.assign(form, {
    id: e.id, atelier_id: e.atelier_id || '', annee: e.annee, mois: e.mois || '',
    equipe: e.equipe || '', effectif: e.effectif ?? '', commentaire: e.commentaire || ''
  })
}
async function desactiver(e) {
  if (!confirm('Supprimer cette ligne d\'effectif ?')) return
  erreur.value = ''
  const res = await supabase.from('effectifs').update({ actif: false }).eq('id', e.id)
  if (res.error) { erreur.value = res.error.message; return }
  await chargerTout()
}

function periode(e) { return (e.mois ? MOIS[e.mois - 1] + ' ' : '') + e.annee }
function fmt(n) { return n == null ? '—' : Number(n).toLocaleString('fr-FR') }

function telechargerCSV(nom, entetes, lignes) {
  const esc = (c) => { const s = c == null ? '' : String(c); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
  const csv = [entetes, ...lignes].map(r => r.map(esc).join(';')).join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = nom; a.click()
}
function exporterCSV() {
  const entetes = ['Atelier', 'Nom atelier', 'Période', 'Équipe', 'Effectif']
  const lignes = effectifsFiltres.value.map(e => {
    const a = atelierDe(e)
    return [a ? a.code : '', a ? a.nom : '', periode(e), e.equipe || '', e.effectif ?? '']
  })
  telechargerCSV('effectifs.csv', entetes, lignes)
}

onMounted(chargerTout)
</script>

<template>
  <div class="ef-page">
    <PageHeader title="Effectifs" tone="teal"
      subtitle="Suivi des effectifs par atelier, par mois et par équipe." />

    <p v-if="erreur" class="alert">{{ erreur }}</p>
    <p v-if="message" class="ok">{{ message }}</p>

    <div v-if="!ateliers.length" class="empty-card">
      Aucun atelier. Va d'abord dans <strong>Référentiels</strong> créer tes ateliers — il en faut pour saisir des effectifs.
    </div>

    <template v-else>
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.indigo"><svg viewBox="0 0 24 24" v-html="ICONS.users"></svg></span><div class="kpi-val accent">{{ fmt(totalEffectif) }}</div></div><div class="kpi-lbl">Effectif total (filtré)</div></div>
        <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.slate"><svg viewBox="0 0 24 24" v-html="ICONS.hash"></svg></span><div class="kpi-val">{{ effectifsFiltres.length }}</div></div><div class="kpi-lbl">Lignes</div></div>
      </div>

      <section class="card" v-if="peutEditer">
        <h2 class="card-title">{{ form.id ? 'Modifier l\'effectif' : 'Nouvel effectif' }}</h2>
        <div class="form-grid">
          <label>Atelier
            <select v-model="form.atelier_id">
              <option value="">—</option>
              <option v-for="a in ateliers" :key="a.id" :value="a.id">{{ a.code }} — {{ a.nom }}</option>
            </select>
          </label>
          <label>Année
            <select v-model.number="form.annee">
              <option v-for="a in ANNEES" :key="a" :value="a">{{ a }}</option>
            </select>
          </label>
          <label>Mois
            <select v-model="form.mois">
              <option value="">—</option>
              <option v-for="(m, i) in MOIS" :key="i" :value="i + 1">{{ m }}</option>
            </select>
          </label>
          <label>Équipe / poste<input v-model="form.equipe" placeholder="Matin / Après-midi / Nuit" /></label>
          <label>Effectif<input v-model="form.effectif" type="number" min="0" placeholder="18" /></label>
          <label class="wide">Commentaire<input v-model="form.commentaire" placeholder="Remarque éventuelle" /></label>
          <div class="form-actions">
            <button class="btn" @click="enregistrer">{{ form.id ? 'Mettre à jour' : 'Enregistrer' }}</button>
            <button v-if="form.id" class="btn ghost" @click="resetForm">Annuler</button>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-head">
          <h2 class="card-title">Effectifs</h2>
          <span class="count">{{ effectifsFiltres.length }}</span>
          <select v-model="filtreAtelier" class="filtre">
            <option value="">Tous les ateliers</option>
            <option v-for="a in ateliers" :key="a.id" :value="a.id">{{ a.code }}</option>
          </select>
          <select v-model.number="filtreAnnee" class="filtre">
            <option :value="''">Toutes années</option>
            <option v-for="a in ANNEES" :key="a" :value="a">{{ a }}</option>
          </select>
          <button class="btn-exp" @click="exporterCSV" :disabled="!effectifsFiltres.length">Exporter CSV</button>
        </div>
        <div class="table-scroll">
          <table class="grid">
            <thead>
              <tr><th>Atelier</th><th>Période</th><th>Équipe</th><th class="right">Effectif</th><th class="right">Actions</th></tr>
            </thead>
            <tbody>
              <tr v-for="e in effectifsFiltres" :key="e.id">
                <td><span class="mono">{{ atelierDe(e) ? atelierDe(e).code : '—' }}</span> <span class="desig">{{ atelierDe(e) ? atelierDe(e).nom : '' }}</span></td>
                <td>{{ periode(e) }}</td>
                <td>{{ e.equipe || '—' }}</td>
                <td class="right strong">{{ fmt(e.effectif) }}</td>
                <td class="right nowrap">
                  <template v-if="peutEditer">
                    <button class="link" @click="modifier(e)">Modifier</button>
                    <button class="link danger" @click="desactiver(e)">Supprimer</button>
                  </template>
                </td>
              </tr>
              <tr v-if="!effectifsFiltres.length"><td colspan="5" class="empty">Aucun effectif. Enregistres-en un ci-dessus.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
      <section class="card">
        <div class="card-head"><h2 class="card-title">Organigramme</h2><span class="count">{{ orgFlat.length }}</span></div>
        <div v-if="peutEditer" class="org-form">
          <input v-model="orgForm.nom" placeholder="Nom *" />
          <input v-model="orgForm.fonction" placeholder="Fonction" />
          <select v-model="orgForm.atelier_id"><option value="">Périmètre —</option><option v-for="pe in PERIMETRES" :key="pe" :value="pe">{{ pe }}</option></select>
          <input v-model="orgForm.equipe" placeholder="Équipe" />
          <select v-model="orgForm.equipement"><option value="">Atelier —</option><option v-for="at in ateliers" :key="at.id" :value="at.nom">{{ at.code }} — {{ at.nom }}</option></select>
          <input v-model="orgForm.matricule" placeholder="Matricule" />
          <input v-model="orgForm.telephone" placeholder="Téléphone" />
          <select v-model="orgForm.parent_id"><option value="">Responsable — (sommet)</option><option v-for="n in responsablesPossibles" :key="n.id" :value="n.id">{{ n.nom }} — {{ n.fonction }}</option></select>
          <input v-model="orgForm.photo_url" placeholder="URL photo (optionnel)" />
          <input v-model="orgForm.note" placeholder="Note" class="org-note" />
          <div class="org-actions">
            <button class="btn" @click="orgEnregistrer">{{ orgForm.id ? 'Mettre à jour' : 'Ajouter' }}</button>
            <button v-if="orgForm.id" class="btn ghost" @click="orgReset">Annuler</button>
          </div>
        </div>
        <div v-if="!orgNodes.length" class="empty-card">Aucun poste. Ajoute le premier (ex. Manager Fabrication) ci-dessus.</div>
        <template v-else>
          <div class="org-toolbar">
            <select v-model="orgPerimFiltre" class="org-filtre"><option value="">Tous les périmètres</option><option v-for="pe in PERIMETRES" :key="pe" :value="pe">{{ pe }}</option></select>
            <div class="org-legende">
              <span class="lg-item"><i style="background:#6366f1"></i>Manager</span>
              <span class="lg-item"><i style="background:#7c3aed"></i>Responsable</span>
              <span class="lg-item"><i style="background:#0d9488"></i>Superviseur</span>
              <span class="lg-item"><i style="background:#0284c7"></i>Chef de ligne</span>
              <span class="lg-item"><i style="background:#475569"></i>Opérateur</span>
              <span class="lg-item"><i style="background:#d97706"></i>Agent d'hygiène</span>
            </div>
          </div>
          <div v-if="!orgRacinesAffichees.length" class="empty-card">Aucun poste dans ce périmètre.</div>
          <div v-else class="org-chart">
            <ul class="org-root">
              <OrgNode v-for="n in orgRacinesAffichees" :key="n.id" :node="n" :all="orgNodesAffiches" :ateliers="ateliers" :peutEditer="peutEditer" :depth="0" @edit="orgModifier" @del="orgSupprimer" />
            </ul>
          </div>
        </template>
      </section>
    </template>
  </div>
</template>

<style scoped>
.ef-page { color: #1b2733; }
.ef-head { margin: 4px 0 18px; }
.ef-head h1 { margin: 0; font-size: 24px; letter-spacing: -0.01em; }
.ef-head .sub { margin: 4px 0 0; color: #64748b; font-size: 14px; }

.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }
.ok { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }
.empty-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 28px; color: #475569; text-align: center; font-size: 15px; }

.kpi-grid { display: grid; grid-template-columns: repeat(2, 220px); gap: 14px; margin-bottom: 22px; }
.kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.kpi-val { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; }
.kpi-val.accent { color: #0f766e; }
.kpi-lbl { font-size: 12px; color: #64748b; margin-top: 4px; }

.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 22px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-title { margin: 0 0 14px; font-size: 17px; }
.card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
.card-head .card-title { margin: 0; }
.count { background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 600; padding: 2px 9px; border-radius: 999px; }
.filtre { font-size: 13px; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; }
.card-head .filtre:first-of-type { margin-left: auto; }
.btn-exp { font-size: 13px; padding: 7px 12px; border: 1px solid #0f766e; border-radius: 8px; background: #fff; color: #0f766e; font-weight: 600; cursor: pointer; white-space: nowrap; }
.btn-exp:hover { background: #ecfdf5; }
.btn-exp:disabled { opacity: .45; cursor: not-allowed; }

.form-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; align-items: end; }
.form-grid label { display: flex; flex-direction: column; font-size: 12px; font-weight: 600; color: #475569; gap: 5px; }
.form-grid .wide { grid-column: span 2; }
.form-grid input, .form-grid select { font-size: 14px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; font-weight: 400; }
.form-grid input:focus, .form-grid select:focus { outline: 2px solid #0f766e; border-color: #0f766e; }
.form-actions { display: flex; gap: 8px; align-items: end; grid-column: 1 / -1; }

.btn { background: #0f766e; color: #fff; border: 0; padding: 9px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.btn:hover { background: #0c5f59; }
.btn.ghost { background: #fff; color: #475569; border: 1px solid #cbd5e1; }

.org-form { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.org-form input, .org-form select { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; color: #1b2733; }
.org-form .org-note { flex: 1; min-width: 150px; }
.org-actions { display: flex; gap: 8px; }
.org-tree { display: flex; flex-direction: column; gap: 6px; }
.org-chart { overflow-x: auto; padding: 12px 0 4px; }
.org-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 10px; }
.org-filtre { padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; color: #1b2733; font-weight: 600; }
.org-legende { display: flex; flex-wrap: wrap; gap: 10px; }
.lg-item { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; color: #475569; }
.lg-item i { width: 11px; height: 11px; border-radius: 3px; display: inline-block; }
.org-root { display: flex; justify-content: center; list-style: none; padding: 0; margin: 0; min-width: min-content; }
.org-row { display: flex; align-items: center; gap: 8px; }
.org-connect { width: 18px; height: 2px; background: #cbd5e1; flex-shrink: 0; }
.org-box { background: linear-gradient(158deg, #ffffff, #f8fafc); border: 1px solid #e2e8f0; border-left: 3px solid #0f766e; border-radius: 10px; padding: 7px 14px; box-shadow: 0 2px 6px rgba(16,24,40,.05); min-width: 170px; }
.org-nom { font-weight: 800; font-size: 14px; color: #0f172a; }
.org-meta { font-size: 11px; color: #64748b; font-weight: 600; margin-top: 1px; }
.org-note-txt { font-size: 10px; color: #94a3b8; margin-top: 1px; }
.org-btns { display: flex; gap: 4px; }
.org-edit, .org-del { border: 1px solid #e2e8f0; background: #fff; border-radius: 7px; padding: 4px 8px; cursor: pointer; font-size: 12px; }
.org-del:hover { background: #fee2e2; border-color: #fecaca; }
.org-edit:hover { background: #f0fdfa; border-color: #99f6e4; }
.btn.ghost:hover { background: #f8fafc; }

.table-scroll { overflow-x: auto; }
table.grid { width: 100%; border-collapse: collapse; font-size: 14px; }
table.grid th { text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
table.grid td { padding: 9px 10px; border-bottom: 1px solid #eef2f6; white-space: nowrap; }
table.grid tr:hover td { background: #f8fafc; }
.right { text-align: right; }
.nowrap { white-space: nowrap; }
.strong { font-weight: 700; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 600; }
.desig { color: #64748b; font-size: 13px; }
.empty { color: #94a3b8; text-align: center; padding: 18px; font-style: italic; }

button.link { background: none; border: 0; color: #0f766e; font-size: 13px; font-weight: 600; cursor: pointer; padding: 2px 6px; }
button.link:hover { text-decoration: underline; }
button.link.danger { color: #b91c1c; }

@media (max-width: 820px) {
  .form-grid { grid-template-columns: 1fr 1fr; }
  .form-grid .wide { grid-column: span 2; }
  .kpi-grid { grid-template-columns: 1fr 1fr; }
}
</style>
