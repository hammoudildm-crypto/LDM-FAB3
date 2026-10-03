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
const PHASES_LISTE = ['Pesée', 'Granulation et Séchage', 'Mélange', 'Compression', 'Remplissage Gélules', 'Pelliculage']

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
  const req = await supabase.from('equipements').select('id, nom').eq('actif', true).order('nom')
  if (!req.error) equipementsListe.value = req.data || []

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
const equipementsListe = ref([])
const orgForm = reactive({ id: null, nom: '', fonction: '', atelier_id: '', equipe: '', note: '', parent_id: '', matricule: '', telephone: '', photo_url: '', date_naissance: '', date_recrutement: '', genre: '', contrat: '', fin_cdd: '', fin_essai: '', phases: [], machines: [] })
function orgReset() { Object.assign(orgForm, { id: null, nom: '', fonction: '', atelier_id: '', equipe: '', note: '', parent_id: '', matricule: '', telephone: '', photo_url: '', date_naissance: '', date_recrutement: '', genre: '', contrat: '', fin_cdd: '', fin_essai: '', phases: [], machines: [] }) }
function orgAddPhase(e) { const v = e.target.value; if (v && !orgForm.phases.includes(v)) orgForm.phases.push(v); e.target.value = '' }
function orgAddMachine(e) { const v = e.target.value; if (v && !orgForm.machines.includes(v)) orgForm.machines.push(v); e.target.value = '' }
function atelierOrg(id) { const a = ateliers.value.find(x => String(x.id) === String(id)); return a ? a.code : '' }
const RANGS_ORG = ['Manager', 'Responsable', 'Superviseur', 'Chef de ligne', 'Opérateur', "Agent d'hygiène"]
const FONCTIONS_SUGG = ['Manager', 'Responsable', 'Superviseur', 'Chef de ligne', 'Opérateur', "Agent d'hygiène", 'Chargé blanchisserie', 'Agent blanchisserie', "Agent d'hygiène vestiaire"]
const normOrg = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\u2019\u02bc']/g, "'").replace(/\s+/g, ' ').trim().replace(/ fabrication$/, '')
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

const kpiOrg = computed(() => {
  const list = orgNodesAffiches.value
  let h = 0, f = 0, cdi = 0, cdd = 0, ancSum = 0, ancN = 0
  const now = new Date()
  for (const n of list) {
    const g = (n.genre || '').toLowerCase()
    if (g[0] === 'f') f++; else if (g[0] === 'h' || g[0] === 'm') h++
    const c = (n.contrat || '').toUpperCase()
    if (c.indexOf('CDI') >= 0) cdi++; else if (c.indexOf('CDD') >= 0) cdd++
    if (n.date_recrutement) {
      const dt = new Date(n.date_recrutement)
      if (!isNaN(dt)) { let m = (now.getFullYear() - dt.getFullYear()) * 12 + (now.getMonth() - dt.getMonth()); if (now.getDate() < dt.getDate()) m--; if (m >= 0) { ancSum += m; ancN++ } }
    }
  }
  return { total: list.length, h, f, cdi, cdd, ancMoyMois: ancN ? ancSum / ancN : null }
})
const pct = (n) => kpiOrg.value.total ? Math.round(n / kpiOrg.value.total * 100) + '%' : '—'
const ancMoyTxt = computed(() => { const m = kpiOrg.value.ancMoyMois; return m == null ? '—' : ((m / 12).toFixed(1).replace('.0', '').replace('.', ',') + ' ans') })
const joursAvant = (d) => { if (!d) return null; const dt = new Date(d); if (isNaN(dt)) return null; const now = new Date(); now.setHours(0, 0, 0, 0); dt.setHours(0, 0, 0, 0); return Math.round((dt - now) / 86400000) }
const fmtD = (d) => { if (!d) return ''; const dt = new Date(d); return isNaN(dt) ? d : dt.toLocaleDateString('fr-FR') }
const jLabel = (j) => j < 0 ? ('dépassé de ' + (-j) + ' j') : (j === 0 ? "aujourd'hui" : ('dans ' + j + ' j'))
const jClass = (j) => (j < 0 || j <= 15) ? 'u-rouge' : 'u-ambre'
const alertesCdd = computed(() => orgNodesAffiches.value
  .filter(n => { const c = (n.contrat || '').toUpperCase(); return c.indexOf('CDD') >= 0 && n.fin_cdd })
  .map(n => ({ id: n.id, nom: n.nom, fonction: n.fonction, fin: n.fin_cdd, j: joursAvant(n.fin_cdd) }))
  .filter(n => n.j != null && n.j <= 60)
  .sort((a, b) => a.j - b.j))
const alertesEssai = computed(() => orgNodesAffiches.value
  .filter(n => n.fin_essai)
  .map(n => ({ id: n.id, nom: n.nom, fonction: n.fonction, fin: n.fin_essai, j: joursAvant(n.fin_essai) }))
  .filter(n => n.j != null && n.j <= 30)
  .sort((a, b) => a.j - b.j))

const AGE_BRACKETS = [[60, 200, '60 +'], [55, 59, '55-59'], [50, 54, '50-54'], [45, 49, '45-49'], [40, 44, '40-44'], [35, 39, '35-39'], [30, 34, '30-34'], [25, 29, '25-29'], [0, 24, '< 25']]
const ageDe = (d) => { if (!d) return null; const dt = new Date(d); if (isNaN(dt)) return null; const now = new Date(); let a = now.getFullYear() - dt.getFullYear(); const m = now.getMonth() - dt.getMonth(); if (m < 0 || (m === 0 && now.getDate() < dt.getDate())) a--; return (a < 0 || a > 120) ? null : a }
const nbAvecAge = computed(() => orgNodesAffiches.value.filter(n => ageDe(n.date_naissance) != null).length)
const pyramide = computed(() => AGE_BRACKETS.map(([lo, hi, label]) => {
  let h = 0, f = 0
  for (const n of orgNodesAffiches.value) {
    const a = ageDe(n.date_naissance); if (a == null || a < lo || a > hi) continue
    const g = (n.genre || '').toLowerCase()
    if (g[0] === 'f') f++; else if (g[0] === 'h' || g[0] === 'm') h++
  }
  return { label, h, f }
}))
const pyrMax = computed(() => Math.max(1, ...pyramide.value.map(b => Math.max(b.h, b.f))))
const ageMoyTxt = computed(() => { let s = 0, n = 0; for (const x of orgNodesAffiches.value) { const a = ageDe(x.date_naissance); if (a != null) { s += a; n++ } } return n ? (Math.round(s / n) + ' ans') : '—' })
const ageRetraite = ref(60)
const horizonRetraite = 5
const retraites = computed(() => {
  const now = new Date()
  return orgNodesAffiches.value.map(n => {
    const a = ageDe(n.date_naissance); if (a == null) return null
    const reste = ageRetraite.value - a
    return { id: n.id, nom: n.nom, fonction: n.fonction, age: a, reste, annee: now.getFullYear() + reste }
  }).filter(n => n && n.reste <= horizonRetraite).sort((a, b) => a.reste - b.reste)
})

async function orgEnregistrer() {
  erreur.value = ''
  if (!orgForm.nom.trim()) { erreur.value = 'Le nom du poste est requis.'; return }
  const payload = { nom: orgForm.nom.trim(), fonction: orgForm.fonction || null, atelier_id: orgForm.atelier_id || null, equipe: orgForm.equipe || null, note: orgForm.note || null, parent_id: orgForm.parent_id || null, matricule: orgForm.matricule || null, telephone: orgForm.telephone || null, photo_url: orgForm.photo_url || null, date_naissance: orgForm.date_naissance || null, date_recrutement: orgForm.date_recrutement || null, genre: orgForm.genre || null, contrat: orgForm.contrat || null, fin_cdd: orgForm.fin_cdd || null, fin_essai: orgForm.fin_essai || null, equipement: orgForm.phases.length ? orgForm.phases.join(', ') : null, machine: orgForm.machines.length ? orgForm.machines.join(', ') : null }
  let r
  if (orgForm.id) r = await supabase.from('organigramme').update(payload).eq('id', orgForm.id)
  else r = await supabase.from('organigramme').insert(payload)
  if (r.error) { erreur.value = r.error.message; return }
  message.value = orgForm.id ? 'Poste mis a jour.' : 'Poste ajoute.'
  orgReset(); await chargerTout()
}
function orgModifier(n) { Object.assign(orgForm, { id: n.id, nom: n.nom, fonction: n.fonction || '', atelier_id: n.atelier_id || '', equipe: n.equipe || '', note: n.note || '', parent_id: n.parent_id || '', matricule: n.matricule || '', telephone: n.telephone || '', photo_url: n.photo_url || '', date_naissance: n.date_naissance || '', date_recrutement: n.date_recrutement || '', genre: n.genre || '', contrat: n.contrat || '', fin_cdd: n.fin_cdd || '', fin_essai: n.fin_essai || '', phases: (n.equipement || '').split(',').map(x => x.trim()).filter(Boolean), machines: (n.machine || '').split(',').map(x => x.trim()).filter(Boolean) }) }
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
        <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.indigo"><svg viewBox="0 0 24 24" v-html="ICONS.users"></svg></span><div class="kpi-val accent">{{ kpiOrg.total }}</div></div><div class="kpi-lbl">Effectif total</div></div>
        <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="{ ...TINTS.blue, fontSize: '16px', fontWeight: '900' }">♂</span><div class="kpi-val">{{ kpiOrg.h }}</div></div><div class="kpi-lbl">Hommes · {{ pct(kpiOrg.h) }}</div></div>
        <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="{ ...TINTS.rose, fontSize: '16px', fontWeight: '900' }">♀</span><div class="kpi-val">{{ kpiOrg.f }}</div></div><div class="kpi-lbl">Femmes · {{ pct(kpiOrg.f) }}</div></div>
        <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.green"><svg viewBox="0 0 24 24" v-html="ICONS.check"></svg></span><div class="kpi-val">{{ kpiOrg.cdi }}</div></div><div class="kpi-lbl">CDI · {{ pct(kpiOrg.cdi) }}</div></div>
        <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.amber"><svg viewBox="0 0 24 24" v-html="ICONS.clock"></svg></span><div class="kpi-val">{{ kpiOrg.cdd }}</div></div><div class="kpi-lbl">CDD · {{ pct(kpiOrg.cdd) }}</div></div>
        <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.teal"><svg viewBox="0 0 24 24" v-html="ICONS.hourglass"></svg></span><div class="kpi-val">{{ ancMoyTxt }}</div></div><div class="kpi-lbl">Ancienneté moyenne</div></div>
      </div>

      <section class="card alert-contrats" v-if="alertesCdd.length || alertesEssai.length">
        <h2 class="card-title">⚠ Alertes contrats</h2>
        <div class="alert-cols">
          <div v-if="alertesCdd.length" class="alert-col">
            <div class="alert-h">CDD à échéance · {{ alertesCdd.length }}</div>
            <div v-for="n in alertesCdd" :key="n.id" class="alert-row">
              <span class="ar-nom">{{ n.nom }}</span>
              <span class="ar-fct" v-if="n.fonction">· {{ n.fonction }}</span>
              <span class="ar-date">{{ fmtD(n.fin) }}</span>
              <span class="ar-badge" :class="jClass(n.j)">{{ jLabel(n.j) }}</span>
            </div>
          </div>
          <div v-if="alertesEssai.length" class="alert-col">
            <div class="alert-h">Périodes d'essai à confirmer · {{ alertesEssai.length }}</div>
            <div v-for="n in alertesEssai" :key="n.id" class="alert-row">
              <span class="ar-nom">{{ n.nom }}</span>
              <span class="ar-fct" v-if="n.fonction">· {{ n.fonction }}</span>
              <span class="ar-date">{{ fmtD(n.fin) }}</span>
              <span class="ar-badge" :class="jClass(n.j)">{{ jLabel(n.j) }}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="card" v-if="nbAvecAge">
        <div class="card-head"><h2 class="card-title">Pyramide des âges</h2><span class="count">Âge moyen · {{ ageMoyTxt }}</span></div>
        <div class="pyr">
          <div v-for="b in pyramide" :key="b.label" class="pyr-row">
            <div class="pyr-h"><span class="pyr-n">{{ b.h || '' }}</span><div class="pyr-bar hb" :style="{ width: (b.h / pyrMax * 100) + '%' }"></div></div>
            <div class="pyr-lbl">{{ b.label }}</div>
            <div class="pyr-f"><div class="pyr-bar fb" :style="{ width: (b.f / pyrMax * 100) + '%' }"></div><span class="pyr-n">{{ b.f || '' }}</span></div>
          </div>
        </div>
        <div class="pyr-leg"><span class="pl-h">♂ Hommes</span><span class="pl-f">♀ Femmes</span></div>
      </section>

      <section class="card" v-if="nbAvecAge">
        <div class="card-head"><h2 class="card-title">Départs en retraite prévisibles</h2><span class="count">{{ retraites.length }}</span><label class="ret-age">Âge de départ<input v-model.number="ageRetraite" type="number" min="50" max="70" /></label></div>
        <div v-if="!retraites.length" class="empty-sm">Aucun départ prévu dans les {{ horizonRetraite }} ans.</div>
        <div v-else class="ret-list">
          <div v-for="n in retraites" :key="n.id" class="ret-row">
            <span class="rr-nom">{{ n.nom }}</span>
            <span class="rr-fct" v-if="n.fonction">· {{ n.fonction }}</span>
            <span class="rr-age">{{ n.age }} ans</span>
            <span class="rr-an">→ {{ n.annee }}</span>
            <span class="rr-badge" :class="n.reste <= 1 ? 'u-rouge' : 'u-ambre'">{{ n.reste <= 0 ? 'éligible' : ('dans ' + n.reste + ' an' + (n.reste > 1 ? 's' : '')) }}</span>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2 class="card-title">Organigramme</h2><span class="count">{{ orgFlat.length }}</span></div>
        <div v-if="peutEditer" class="org-form">
          <input v-model="orgForm.nom" placeholder="Nom *" />
          <input v-model="orgForm.fonction" list="fonctionsListe" placeholder="Fonction" /><datalist id="fonctionsListe"><option v-for="f in FONCTIONS_SUGG" :key="f" :value="f" /></datalist>
          <select v-model="orgForm.atelier_id"><option value="">Périmètre —</option><option v-for="pe in PERIMETRES" :key="pe" :value="pe">{{ pe }}</option></select>
          <input v-model="orgForm.equipe" placeholder="Équipe" />
          <div class="multi">
            <div v-if="orgForm.phases.length" class="chips"><span v-for="(ph, i) in orgForm.phases" :key="i" class="chip">{{ ph }}<button type="button" @click="orgForm.phases.splice(i, 1)">×</button></span></div>
            <select @change="orgAddPhase" class="add-sel"><option value="">+ Phase</option><option v-for="ph in PHASES_LISTE" :key="ph" :value="ph" :disabled="orgForm.phases.includes(ph)">{{ ph }}</option></select>
          </div>
          <div class="multi">
            <div v-if="orgForm.machines.length" class="chips"><span v-for="(m, i) in orgForm.machines" :key="i" class="chip mach">{{ m }}<button type="button" @click="orgForm.machines.splice(i, 1)">×</button></span></div>
            <select @change="orgAddMachine" class="add-sel"><option value="">+ Équipement</option><option v-for="eq in equipementsListe" :key="eq.id" :value="eq.nom" :disabled="orgForm.machines.includes(eq.nom)">{{ eq.nom }}</option></select>
          </div>
          <input v-model="orgForm.matricule" placeholder="Matricule" />
          <input v-model="orgForm.telephone" placeholder="Téléphone" />
          <label class="org-datef">Naissance<input v-model="orgForm.date_naissance" type="date" /></label>
          <label class="org-datef">Recrutement<input v-model="orgForm.date_recrutement" type="date" /></label>
          <select v-model="orgForm.genre"><option value="">Genre —</option><option value="Homme">Homme</option><option value="Femme">Femme</option></select>
          <select v-model="orgForm.contrat"><option value="">Contrat —</option><option value="CDI">CDI</option><option value="CDD">CDD</option></select>
          <label v-if="orgForm.contrat === 'CDD'" class="org-datef">Fin CDD<input v-model="orgForm.fin_cdd" type="date" /></label>
          <label class="org-datef">Fin essai<input v-model="orgForm.fin_essai" type="date" /></label>
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

.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(168px, 1fr)); gap: 14px; margin-bottom: 22px; }
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
.org-datef { display: inline-flex; flex-direction: column; gap: 2px; font-size: 9.5px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: .03em; }
.alert-contrats { border-left: 4px solid #f59e0b; }
.alert-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 20px; margin-top: 12px; }
.alert-h { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; color: #92400e; margin-bottom: 7px; }
.alert-row { display: flex; align-items: center; gap: 6px; padding: 6px 2px; border-top: 1px solid #f1f5f9; font-size: 13px; }
.ar-nom { font-weight: 700; color: #0f172a; }
.ar-fct { color: #94a3b8; font-size: 11.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ar-date { margin-left: auto; color: #64748b; font-size: 11.5px; white-space: nowrap; }
.ar-badge { font-size: 10.5px; font-weight: 800; padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
.ar-badge.u-rouge { background: #fee2e2; color: #dc2626; }
.ar-badge.u-ambre { background: #fef3c7; color: #b45309; }
.empty-sm { color: #94a3b8; font-size: 13px; padding: 10px 2px; }
.pyr { display: flex; flex-direction: column; gap: 4px; margin-top: 10px; }
.pyr-row { display: grid; grid-template-columns: 1fr 58px 1fr; align-items: center; gap: 6px; }
.pyr-h { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
.pyr-f { display: flex; align-items: center; justify-content: flex-start; gap: 6px; }
.pyr-bar { height: 16px; border-radius: 4px; min-width: 0; transition: width .3s ease; }
.pyr-bar.hb { background: #3b82f6; }
.pyr-bar.fb { background: #ec4899; }
.pyr-n { font-size: 11px; font-weight: 800; color: #475569; min-width: 14px; }
.pyr-h .pyr-n { text-align: right; }
.pyr-lbl { text-align: center; font-size: 11px; font-weight: 800; color: #64748b; }
.pyr-leg { display: flex; justify-content: center; gap: 22px; margin-top: 12px; font-size: 11.5px; font-weight: 700; }
.pl-h { color: #3b82f6; }
.pl-f { color: #ec4899; }
.ret-age { margin-left: auto; font-size: 11px; font-weight: 700; color: #64748b; display: inline-flex; align-items: center; gap: 6px; }
.ret-age input { width: 56px; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 7px; font: inherit; font-size: 13px; }
.ret-list { display: flex; flex-direction: column; margin-top: 6px; }
.ret-row { display: flex; align-items: center; gap: 6px; padding: 7px 2px; border-top: 1px solid #f1f5f9; font-size: 13px; }
.rr-nom { font-weight: 700; color: #0f172a; }
.rr-fct { color: #94a3b8; font-size: 11.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rr-age { margin-left: auto; color: #475569; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
.rr-an { color: #94a3b8; font-size: 11px; white-space: nowrap; }
.rr-badge { font-size: 10.5px; font-weight: 800; padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
.rr-badge.u-rouge { background: #fee2e2; color: #dc2626; }
.rr-badge.u-ambre { background: #fef3c7; color: #b45309; }
.org-actions { display: flex; gap: 8px; }
.org-tree { display: flex; flex-direction: column; gap: 6px; }
.org-chart { overflow-x: auto; padding: 12px 0 4px; zoom: 0.72; }
.org-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 10px; }
.org-filtre { padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; color: #1b2733; font-weight: 600; }
.org-legende { display: flex; flex-wrap: wrap; gap: 10px; }
.lg-item { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; color: #475569; }
.lg-item i { width: 11px; height: 11px; border-radius: 3px; display: inline-block; }
.multi { display: inline-flex; flex-direction: column; gap: 4px; vertical-align: top; }
.multi .chips { display: flex; flex-wrap: wrap; gap: 4px; }
.multi .chip { display: inline-flex; align-items: center; gap: 3px; background: #eef2ff; color: #4338ca; border-radius: 999px; padding: 2px 4px 2px 9px; font-size: 11px; font-weight: 700; }
.multi .chip.mach { background: #ecfeff; color: #0891b2; }
.multi .chip button { border: 0; background: transparent; color: inherit; cursor: pointer; font-size: 14px; line-height: 1; padding: 0 2px; }
.multi .add-sel { padding: 7px 9px; border: 1px dashed #cbd5e1; border-radius: 8px; font: inherit; font-size: 12px; background: #fff; color: #64748b; }
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
