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
const orgForm = reactive({ id: null, nom: '', fonction: '', atelier_id: '', equipe: '', note: '', parent_id: '', matricule: '', telephone: '', photo_url: '', date_naissance: '', date_recrutement: '', genre: '', contrat: '', fin_cdd: '', fin_essai: '', date_sortie: '', motif_sortie: '', phases: [], machines: [] })
const plusChamps = ref(false)
function orgReset() { Object.assign(orgForm, { id: null, nom: '', fonction: '', atelier_id: '', equipe: '', note: '', parent_id: '', matricule: '', telephone: '', photo_url: '', date_naissance: '', date_recrutement: '', genre: '', contrat: '', fin_cdd: '', fin_essai: '', date_sortie: '', motif_sortie: '', phases: [], machines: [] }) }
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
const tab = ref('org')
const estParti = (n) => { if (!n.date_sortie) return false; const dt = new Date(n.date_sortie); return !isNaN(dt) && dt <= new Date() }
const orgPerimRaw = computed(() => {
  const base = orgNodes.value
  if (!orgPerimFiltre.value) return base
  const byId = {}; for (const n of base) byId[n.id] = n
  const keep = new Set()
  for (const n of base) {
    if (normOrg(n.atelier_id) === normOrg(orgPerimFiltre.value)) {
      keep.add(n.id)
      let pp = n.parent_id
      while (pp && byId[pp]) { keep.add(pp); pp = byId[pp].parent_id }
    }
  }
  return base.filter(n => keep.has(n.id))
})
const orgNodesAffiches = computed(() => orgPerimRaw.value.filter(n => !estParti(n)))
const partis = computed(() => orgPerimRaw.value.filter(n => estParti(n)).slice().sort((a, b) => new Date(b.date_sortie) - new Date(a.date_sortie)))
const orgRacinesAffichees = computed(() => orgNodesAffiches.value
  .filter(n => !n.parent_id || !orgNodesAffiches.value.some(x => x.id === n.parent_id))
  .sort((a, b) => (a.ordre || 0) - (b.ordre || 0) || a.id - b.id))
const persRech = ref('')
const persListe = computed(() => {
  const q = normOrg(persRech.value)
  return orgNodesAffiches.value.filter(n => !q || normOrg(n.nom).indexOf(q) >= 0 || normOrg(n.fonction).indexOf(q) >= 0).slice().sort((a, b) => (a.nom || '').localeCompare(b.nom || ''))
})
function nomParent(n) { if (!n.parent_id) return ''; const pp = orgNodes.value.find(x => x.id === n.parent_id); return pp ? pp.nom : '' }

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

const MOIS_COURT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
const mouvAnnee = ref(new Date().getFullYear())
const anneesMouv = computed(() => { const c = new Date().getFullYear(); return [c - 2, c - 1, c] })
const effectifA = (date, list) => list.filter(n => {
  if (!n.date_recrutement) return false
  const r = new Date(n.date_recrutement); if (isNaN(r) || r > date) return false
  if (n.date_sortie) { const sd = new Date(n.date_sortie); if (!isNaN(sd) && sd <= date) return false }
  return true
}).length
const mouvStats = computed(() => {
  const list = orgPerimRaw.value, y = mouvAnnee.value
  const jan1 = new Date(y, 0, 1), dec31 = new Date(y, 11, 31, 23, 59, 59)
  const finRef = (y === new Date().getFullYear()) ? new Date() : dec31
  let entrees = 0, sorties = 0
  for (const n of list) {
    if (n.date_recrutement) { const r = new Date(n.date_recrutement); if (!isNaN(r) && r.getFullYear() === y) entrees++ }
    if (n.date_sortie) { const sd = new Date(n.date_sortie); if (!isNaN(sd) && sd.getFullYear() === y) sorties++ }
  }
  const eDebut = effectifA(jan1, list), eFin = effectifA(finRef, list)
  const eMoy = (eDebut + eFin) / 2
  return { entrees, sorties, eDebut, eFin, turnover: eMoy > 0 ? (sorties / eMoy * 100) : null }
})
const fmtTurnover = computed(() => mouvStats.value.turnover == null ? '—' : (mouvStats.value.turnover.toFixed(1).replace('.', ',') + '%'))
const evoEffectif = computed(() => {
  const list = orgPerimRaw.value, y = mouvAnnee.value, now = new Date()
  const pts = []
  for (let m = 0; m < 12; m++) { const fin = new Date(y, m + 1, 0); if (fin > now) break; pts.push({ mois: m, n: effectifA(fin, list) }) }
  return pts
})
const evoMax = computed(() => Math.max(1, ...evoEffectif.value.map(p => p.n)))

function exportPDF() {
  const now = new Date().toLocaleString('fr-FR')
  const filt = orgPerimFiltre.value || 'Tout le personnel'
  const pyrRows = pyramide.value.filter(b => b.h || b.f).map(b => `<tr><td>${b.label}</td><td style="text-align:right">${b.h}</td><td style="text-align:right">${b.f}</td><td style="text-align:right">${b.h + b.f}</td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:#94a3b8">—</td></tr>'
  const alCdd = alertesCdd.value.map(n => `<tr><td>${n.nom}</td><td>${n.fonction || ''}</td><td>${fmtD(n.fin)}</td><td>${jLabel(n.j)}</td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:#16a34a">Aucun</td></tr>'
  const alEss = alertesEssai.value.map(n => `<tr><td>${n.nom}</td><td>${n.fonction || ''}</td><td>${fmtD(n.fin)}</td><td>${jLabel(n.j)}</td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:#16a34a">Aucun</td></tr>'
  const ret = retraites.value.map(n => `<tr><td>${n.nom}</td><td>${n.fonction || ''}</td><td style="text-align:right">${n.age}</td><td style="text-align:right">${n.annee}</td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:#94a3b8">Aucun</td></tr>'
  const sor = partis.value.map(n => `<tr><td>${n.nom}</td><td>${n.fonction || ''}</td><td>${n.motif_sortie || ''}</td><td>${fmtD(n.date_sortie)}</td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:#94a3b8">Aucune</td></tr>'
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Tableau de bord RH</title>
<style>
*{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1b2733;margin:24px;font-size:11px}
h1{font-size:19px;margin:0 0 2px;color:#0d9488} .sub{color:#64748b;font-size:12px;margin:0 0 14px}
.meta{display:flex;gap:20px;flex-wrap:wrap;font-size:11px;color:#475569;border-top:2px solid #0d9488;border-bottom:1px solid #e2e8f0;padding:8px 0;margin-bottom:16px} .meta b{color:#0f172a}
.kp{display:flex;gap:10px;margin:0 0 14px;flex-wrap:wrap} .k{flex:1;min-width:88px;border:1px solid #e2e8f0;border-radius:8px;padding:8px;text-align:center} .k .v{font-size:16px;font-weight:800} .k .l{font-size:9px;text-transform:uppercase;color:#94a3b8;font-weight:700}
h2{font-size:13px;margin:16px 0 6px;border-left:4px solid #0d9488;padding-left:8px}
table{border-collapse:collapse;font-size:10px;margin-bottom:10px;width:100%}
th{background:#f0fdfa;color:#0f766e;padding:5px 6px;border:1px solid #e2e8f0;font-size:9px;text-transform:uppercase;text-align:left}
td{padding:4px 6px;border:1px solid #f1f5f9}
.foot{margin-top:18px;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px}
@media print{body{margin:10mm}}
</style></head><body>
<h1>Tableau de bord RH</h1><p class="sub">Périmètre : ${filt}</p>
<div class="meta"><span>Effectif : <b>${kpiOrg.value.total}</b></span><span>Hommes : <b>${kpiOrg.value.h}</b></span><span>Femmes : <b>${kpiOrg.value.f}</b></span><span>CDI : <b>${kpiOrg.value.cdi}</b></span><span>CDD : <b>${kpiOrg.value.cdd}</b></span><span>Édité le <b>${now}</b></span></div>
<div class="kp"><div class="k"><div class="v">${kpiOrg.value.total}</div><div class="l">Effectif</div></div><div class="k"><div class="v">${pct(kpiOrg.value.h)}</div><div class="l">Hommes</div></div><div class="k"><div class="v">${pct(kpiOrg.value.f)}</div><div class="l">Femmes</div></div><div class="k"><div class="v">${pct(kpiOrg.value.cdi)}</div><div class="l">CDI</div></div><div class="k"><div class="v">${ageMoyTxt.value}</div><div class="l">Âge moyen</div></div><div class="k"><div class="v">${fmtTurnover.value}</div><div class="l">Turnover ${mouvAnnee.value}</div></div></div>
<h2>Mouvements ${mouvAnnee.value}</h2>
<div class="kp"><div class="k"><div class="v">${mouvStats.value.entrees}</div><div class="l">Entrées</div></div><div class="k"><div class="v">${mouvStats.value.sorties}</div><div class="l">Sorties</div></div><div class="k"><div class="v">${mouvStats.value.eDebut} &rarr; ${mouvStats.value.eFin}</div><div class="l">Effectif début &rarr; fin</div></div></div>
<h2>Pyramide des âges</h2>
<table><thead><tr><th>Tranche</th><th style="text-align:right">Hommes</th><th style="text-align:right">Femmes</th><th style="text-align:right">Total</th></tr></thead><tbody>${pyrRows}</tbody></table>
<h2>CDD à échéance (&lt; 60 j)</h2>
<table><thead><tr><th>Nom</th><th>Fonction</th><th>Fin</th><th>Échéance</th></tr></thead><tbody>${alCdd}</tbody></table>
<h2>Périodes d'essai à confirmer (&lt; 30 j)</h2>
<table><thead><tr><th>Nom</th><th>Fonction</th><th>Fin</th><th>Échéance</th></tr></thead><tbody>${alEss}</tbody></table>
<h2>Départs en retraite prévisibles (&lt; 5 ans)</h2>
<table><thead><tr><th>Nom</th><th>Fonction</th><th style="text-align:right">Âge</th><th style="text-align:right">Année</th></tr></thead><tbody>${ret}</tbody></table>
<h2>Sorties enregistrées</h2>
<table><thead><tr><th>Nom</th><th>Fonction</th><th>Motif</th><th>Date</th></tr></thead><tbody>${sor}</tbody></table>
<div class="foot">Document généré par ProdTrack — Tableau de bord RH. Le taux de formation est disponible dans le module Formation & Qualification.</div>
</body></html>`
  const w = window.open('', '_blank')
  if (!w) { erreur.value = 'Autorise les pop-ups pour exporter en PDF.'; return }
  w.document.write(html); w.document.close(); w.focus()
  setTimeout(() => { try { w.print() } catch (e) {} }, 350)
}

async function orgEnregistrer() {
  erreur.value = ''
  if (!orgForm.nom.trim()) { erreur.value = 'Le nom du poste est requis.'; return }
  const payload = { nom: orgForm.nom.trim(), fonction: orgForm.fonction || null, atelier_id: orgForm.atelier_id || null, equipe: orgForm.equipe || null, note: orgForm.note || null, parent_id: orgForm.parent_id || null, matricule: orgForm.matricule || null, telephone: orgForm.telephone || null, photo_url: orgForm.photo_url || null, date_naissance: orgForm.date_naissance || null, date_recrutement: orgForm.date_recrutement || null, genre: orgForm.genre || null, contrat: orgForm.contrat || null, fin_cdd: orgForm.fin_cdd || null, fin_essai: orgForm.fin_essai || null, date_sortie: orgForm.date_sortie || null, motif_sortie: orgForm.motif_sortie || null, equipement: orgForm.phases.length ? orgForm.phases.join(', ') : null, machine: orgForm.machines.length ? orgForm.machines.join(', ') : null }
  let r
  if (orgForm.id) r = await supabase.from('organigramme').update(payload).eq('id', orgForm.id)
  else r = await supabase.from('organigramme').insert(payload)
  if (r.error) { erreur.value = r.error.message; return }
  message.value = orgForm.id ? 'Poste mis a jour.' : 'Poste ajoute.'
  orgReset(); await chargerTout()
}

// --- Import liste -> organigramme ---
const impTexte = ref('')
const impRemplacer = ref(false)
const impActifsSeuls = ref(true)
const impOuvert = ref(false)
const impBusy = ref(false)
const impApercu = ref(null)
function impDate(v) {
  if (v == null || v === '') return ''
  const s = String(v).trim(); if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)
  if (m) { let y = m[3]; if (y.length === 2) y = '20' + y; return y + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0') }
  if (/^\d{4,6}$/.test(s)) { const n = parseInt(s, 10); const dt = new Date(Date.UTC(1899, 11, 30) + n * 86400000); if (!isNaN(dt)) return dt.toISOString().slice(0, 10) }
  const dt = new Date(s); if (!isNaN(dt)) return dt.toISOString().slice(0, 10)
  return ''
}
function impColonne(h) { for (let a = 1; a < arguments.length; a++) { const i = h.indexOf(normOrg(arguments[a])); if (i >= 0) return i } return -1 }
function impParse() {
  const lignes = [], erreurs = []
  const raw = impTexte.value.split(/\r?\n/).filter(l => l.trim())
  if (!raw.length) return { lignes, racines: 0, orphelins: 0, ignores: 0, erreurs: ['Liste vide.'], mode: '' }
  const sep = raw[0].indexOf('\t') >= 0 ? '\t' : (raw[0].indexOf(';') >= 0 ? ';' : ',')
  const rows = raw.map(l => l.split(sep).map(c => c.trim()))
  const h = rows[0].map(c => normOrg(c))
  const ci = {
    nom: impColonne(h, 'nom prenom', 'nom et prenom', 'nom', 'name'),
    superieur: impColonne(h, 'responsable 1', 'responsable', 'superieur', 'manager', 'n+1', 'responsable hierarchique'),
    fonction: impColonne(h, 'fonction', 'poste', 'intitule poste', 'emploi'),
    perimetre: impColonne(h, 'departement', 'pole', 'perimetre', 'atelier', 'service', 'unite'),
    equipe: impColonne(h, 'equipe', 'shift'),
    matricule: impColonne(h, 'matricule', 'mle', 'num matricule'),
    contrat: impColonne(h, 'type contrat', 'contrat', 'type de contrat'),
    genre: impColonne(h, 'sexe', 'genre'),
    telephone: impColonne(h, 'telephone', 'tel', 'tel pro', 'mobile'),
    recrutement: impColonne(h, 'date debut', 'date recrutement', 'date embauche', 'date d embauche'),
    naissance: impColonne(h, 'date naissance', 'naissance', 'date de naissance'),
    motif: impColonne(h, 'raison de depart', 'raison depart', 'motif', 'motif depart', 'motif de depart'),
    sortie: impColonne(h, 'date fin', 'date sortie', 'date depart', 'date de depart'),
    essai: impColonne(h, 'date fin periode essai', 'fin periode essai', 'fin essai', 'fin periode d essai'),
    actif: impColonne(h, 'actif', 'statut', 'etat')
  }
  const parEntete = ci.nom >= 0
  let data, mode
  if (parEntete) { data = rows.slice(1); mode = 'entete' }
  else {
    mode = 'position'
    const h0 = h[0]
    data = (h0 === 'nom' || h0 === 'name' || h.indexOf('fonction') >= 0 || h.indexOf('superieur') >= 0) ? rows.slice(1) : rows
    ci.nom = 0; ci.fonction = 1; ci.superieur = 2; ci.perimetre = 3; ci.equipe = 4
    ci.matricule = ci.contrat = ci.genre = ci.telephone = ci.recrutement = ci.naissance = ci.motif = ci.sortie = ci.essai = ci.actif = -1
  }
  const val = (r, i) => (i >= 0 && i < r.length) ? (r[i] || '').trim() : ''
  const estFaux = (s) => { const n = normOrg(s); return n === 'false' || n === 'faux' || n === 'non' || n === '0' || n === 'inactif' }
  let ignores = 0
  for (const r of data) {
    const nom = val(r, ci.nom); if (!nom) continue
    const sortieRaw = impDate(val(r, ci.sortie))
    const actifTxt = val(r, ci.actif)
    const inactif = (ci.actif >= 0 && actifTxt && estFaux(actifTxt)) || (!!sortieRaw && new Date(sortieRaw) <= new Date())
    if (impActifsSeuls.value && inactif) { ignores++; continue }
    let genre = ''; const g = normOrg(val(r, ci.genre))
    if (g === 'm' || g === 'masculin' || g === 'homme' || g === 'h') genre = 'Homme'
    else if (g === 'f' || g === 'feminin' || g === 'femme') genre = 'Femme'
    const ctRaw = val(r, ci.contrat).toUpperCase()
    const contrat = ctRaw.indexOf('CDI') >= 0 ? 'CDI' : (ctRaw.indexOf('CDD') >= 0 ? 'CDD' : '')
    lignes.push({
      nom, fonction: val(r, ci.fonction), superieur: val(r, ci.superieur),
      perimetre: val(r, ci.perimetre), equipe: val(r, ci.equipe),
      matricule: val(r, ci.matricule), contrat, genre, telephone: val(r, ci.telephone),
      date_recrutement: impDate(val(r, ci.recrutement)), date_naissance: impDate(val(r, ci.naissance)),
      motif_sortie: val(r, ci.motif), date_sortie: sortieRaw, fin_essai: impDate(val(r, ci.essai)),
      inactif, supIntrouvable: false
    })
  }
  const noms = new Set()
  if (!impRemplacer.value) for (const n of orgNodes.value) noms.add(normOrg(n.nom))
  for (const l of lignes) noms.add(normOrg(l.nom))
  let racines = 0, orphelins = 0
  for (const l of lignes) {
    if (!l.superieur) { racines++; continue }
    if (!noms.has(normOrg(l.superieur))) { l.supIntrouvable = true; orphelins++; racines++ }
  }
  const vus = new Set(), dups = new Set()
  for (const l of lignes) { const k = normOrg(l.nom); if (vus.has(k)) dups.add(l.nom); vus.add(k) }
  if (dups.size) erreurs.push(dups.size + ' doublon(s) : ' + [...dups].slice(0, 3).join(', '))
  return { lignes, racines, orphelins, ignores, erreurs, mode }
}
function impPreview() { impApercu.value = impParse() }
async function impImporter() {
  erreur.value = ''; message.value = ''
  const ap = impParse()
  if (!ap.lignes.length) { erreur.value = (ap.erreurs[0] || 'Rien a importer.'); return }
  if (impRemplacer.value && !confirm('Remplacer tout l\'organigramme (' + orgNodes.value.length + ' postes) par cette liste ?')) return
  impBusy.value = true
  try {
    if (impRemplacer.value) {
      const rd = await supabase.from('organigramme').update({ actif: false }).eq('actif', true)
      if (rd.error) { erreur.value = rd.error.message; impBusy.value = false; return }
    }
    const payloads = ap.lignes.map((l, i) => ({
      nom: l.nom, fonction: l.fonction || null,
      atelier_id: (PERIMETRES.find(pe => normOrg(pe) === normOrg(l.perimetre)) || l.perimetre) || null,
      equipe: l.equipe || null, matricule: l.matricule || null, telephone: l.telephone || null,
      contrat: l.contrat || null, genre: l.genre || null,
      date_recrutement: l.date_recrutement || null, date_naissance: l.date_naissance || null,
      fin_essai: l.fin_essai || null, date_sortie: l.date_sortie || null, motif_sortie: l.motif_sortie || null,
      ordre: i
    }))
    const ins = await supabase.from('organigramme').insert(payloads).select('id, nom')
    if (ins.error) { erreur.value = ins.error.message; impBusy.value = false; return }
    const inseres = (ins.data || []).slice().sort((a, b) => a.id - b.id)
    const nomId = new Map()
    if (!impRemplacer.value) for (const n of orgNodes.value) { const k = normOrg(n.nom); if (!nomId.has(k)) nomId.set(k, n.id) }
    for (const n of inseres) { const k = normOrg(n.nom); if (!nomId.has(k)) nomId.set(k, n.id) }
    const maj = []
    ap.lignes.forEach((l, i) => {
      const self = inseres[i]; if (!self || !l.superieur) return
      const pid = nomId.get(normOrg(l.superieur))
      if (pid && pid !== self.id) maj.push(supabase.from('organigramme').update({ parent_id: pid }).eq('id', self.id))
    })
    if (maj.length) { const res = await Promise.all(maj); const er = res.find(r => r.error); if (er) { erreur.value = er.error.message; impBusy.value = false; return } }
    message.value = inseres.length + ' poste(s) importe(s)' + (ap.ignores ? (' - ' + ap.ignores + ' inactif(s) ignore(s)') : '') + '.'
    impTexte.value = ''; impApercu.value = null; impOuvert.value = false
    await chargerTout()
  } catch (e) { erreur.value = 'Erreur import : ' + (e.message || e) }
  impBusy.value = false
}
let xlsxPromise = null
function chargerXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX)
  if (xlsxPromise) return xlsxPromise
  xlsxPromise = new Promise((resolve, reject) => {
    const sc = document.createElement('script')
    sc.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'
    sc.onload = () => resolve(window.XLSX)
    sc.onerror = () => reject(new Error('Echec du chargement du lecteur Excel. Enregistre le fichier en CSV et reessaie.'))
    document.head.appendChild(sc)
  })
  return xlsxPromise
}
async function impFichier(e) {
  const f = e.target.files && e.target.files[0]
  if (!f) return
  erreur.value = ''; message.value = ''
  const nom = f.name.toLowerCase()
  try {
    if (nom.endsWith('.csv') || nom.endsWith('.txt') || nom.endsWith('.tsv')) {
      impTexte.value = await f.text()
    } else if (nom.endsWith('.xlsx') || nom.endsWith('.xls')) {
      const XLSX = await chargerXLSX()
      const buf = await f.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '', raw: true })
      impTexte.value = rows.map(r => r.map(c => (c instanceof Date) ? c.toISOString().slice(0, 10) : String(c == null ? '' : c)).join('\t')).join('\n')
    } else {
      erreur.value = 'Format non reconnu. Utilise .xlsx, .xls ou .csv.'; e.target.value = ''; return
    }
    impOuvert.value = true
    impApercu.value = impParse()
    message.value = 'Fichier charge : ' + f.name + '. Verifie l\'apercu puis clique Importer.'
  } catch (err) {
    erreur.value = err.message || ('Erreur lecture fichier : ' + err)
  }
  e.target.value = ''
}

function orgModifier(n) { Object.assign(orgForm, { id: n.id, nom: n.nom, fonction: n.fonction || '', atelier_id: n.atelier_id || '', equipe: n.equipe || '', note: n.note || '', parent_id: n.parent_id || '', matricule: n.matricule || '', telephone: n.telephone || '', photo_url: n.photo_url || '', date_naissance: n.date_naissance || '', date_recrutement: n.date_recrutement || '', genre: n.genre || '', contrat: n.contrat || '', fin_cdd: n.fin_cdd || '', fin_essai: n.fin_essai || '', date_sortie: n.date_sortie || '', motif_sortie: n.motif_sortie || '', phases: (n.equipement || '').split(',').map(x => x.trim()).filter(Boolean), machines: (n.machine || '').split(',').map(x => x.trim()).filter(Boolean) }) }
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
      <div class="rh-tabs">
        <button :class="{ on: tab === 'org' }" @click="tab = 'org'">Personnel</button>
        <button :class="{ on: tab === 'demo' }" @click="tab = 'demo'">Démographie</button>
        <button :class="{ on: tab === 'contrats' }" @click="tab = 'contrats'">Contrats<span v-if="alertesCdd.length + alertesEssai.length" class="tb">{{ alertesCdd.length + alertesEssai.length }}</span></button>
        <button :class="{ on: tab === 'mouv' }" @click="tab = 'mouv'">Mouvements</button>
        <button :class="{ on: tab === 'dash' }" @click="tab = 'dash'">Tableau de bord RH</button>
      </div>

      <div v-if="tab === 'dash'">
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.indigo"><svg viewBox="0 0 24 24" v-html="ICONS.users"></svg></span><div class="kpi-val accent">{{ kpiOrg.total }}</div></div><div class="kpi-lbl">Effectif total</div></div>
        <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="{ ...TINTS.blue, fontSize: '16px', fontWeight: '900' }">♂</span><div class="kpi-val">{{ kpiOrg.h }}</div></div><div class="kpi-lbl">Hommes · {{ pct(kpiOrg.h) }}</div></div>
        <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="{ ...TINTS.rose, fontSize: '16px', fontWeight: '900' }">♀</span><div class="kpi-val">{{ kpiOrg.f }}</div></div><div class="kpi-lbl">Femmes · {{ pct(kpiOrg.f) }}</div></div>
        <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.green"><svg viewBox="0 0 24 24" v-html="ICONS.check"></svg></span><div class="kpi-val">{{ kpiOrg.cdi }}</div></div><div class="kpi-lbl">CDI · {{ pct(kpiOrg.cdi) }}</div></div>
        <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.amber"><svg viewBox="0 0 24 24" v-html="ICONS.clock"></svg></span><div class="kpi-val">{{ kpiOrg.cdd }}</div></div><div class="kpi-lbl">CDD · {{ pct(kpiOrg.cdd) }}</div></div>
        <div class="kpi"><div class="kpi-top"><span class="kpi-ic" :style="TINTS.teal"><svg viewBox="0 0 24 24" v-html="ICONS.hourglass"></svg></span><div class="kpi-val">{{ ancMoyTxt }}</div></div><div class="kpi-lbl">Ancienneté moyenne</div></div>
      </div>

      <div class="dash-head">
        <h2 class="card-title">Synthèse RH</h2>
        <button class="btn-pdf" @click="exportPDF">⬇ Export PDF</button>
      </div>
      <div class="dash-grid">
        <div class="dash-card" @click="tab = 'demo'">
          <div class="dc-t">Mixité</div>
          <div class="dc-bar"><div class="dc-seg h" :style="{ width: (kpiOrg.total ? kpiOrg.h / kpiOrg.total * 100 : 0) + '%' }"></div><div class="dc-seg f" :style="{ width: (kpiOrg.total ? kpiOrg.f / kpiOrg.total * 100 : 0) + '%' }"></div></div>
          <div class="dc-sub">{{ kpiOrg.h }} H · {{ kpiOrg.f }} F</div>
        </div>
        <div class="dash-card" @click="tab = 'contrats'">
          <div class="dc-t">Contrats</div>
          <div class="dc-big">{{ pct(kpiOrg.cdi) }} CDI</div>
          <div class="dc-sub"><span v-if="alertesCdd.length" class="dc-warn">⚠ {{ alertesCdd.length }} CDD à échéance</span><span v-else>{{ kpiOrg.cdd }} CDD · aucune alerte</span></div>
        </div>
        <div class="dash-card" @click="tab = 'demo'">
          <div class="dc-t">Âge</div>
          <div class="dc-big">{{ ageMoyTxt }}</div>
          <div class="dc-sub">{{ retraites.length }} départ(s) retraite &lt; 5 ans</div>
        </div>
        <div class="dash-card" @click="tab = 'mouv'">
          <div class="dc-t">Turnover {{ mouvAnnee }}</div>
          <div class="dc-big">{{ fmtTurnover }}</div>
          <div class="dc-sub">{{ mouvStats.entrees }} entrées · {{ mouvStats.sorties }} sorties</div>
        </div>
        <a class="dash-card dc-link" href="#/formations-matrice">
          <div class="dc-t">Formation</div>
          <div class="dc-big">Matrice →</div>
          <div class="dc-sub">Voir le taux de formation</div>
        </a>
      </div>
      </div>

      <div v-if="tab === 'contrats'">
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
      <div v-if="!alertesCdd.length && !alertesEssai.length" class="empty-sm">Aucune alerte contrat pour l'instant 🎉 — les CDD à échéance (&lt; 60 j) et les périodes d'essai à confirmer (&lt; 30 j) s'afficheront ici.</div>
      </div>

      <div v-if="tab === 'demo'">
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
      <div v-if="!nbAvecAge" class="empty-sm">Renseigne les dates de naissance pour afficher la pyramide des âges et les départs en retraite.</div>
      </div>

      <div v-if="tab === 'mouv'">
      <section class="card">
        <div class="card-head"><h2 class="card-title">Mouvements du personnel</h2><label class="ret-age">Année<select v-model.number="mouvAnnee"><option v-for="a in anneesMouv" :key="a" :value="a">{{ a }}</option></select></label></div>
        <div class="mouv-kpis">
          <div class="mk mk-in"><div class="mk-v">{{ mouvStats.entrees }}</div><div class="mk-l">Entrées {{ mouvAnnee }}</div></div>
          <div class="mk mk-out"><div class="mk-v">{{ mouvStats.sorties }}</div><div class="mk-l">Sorties {{ mouvAnnee }}</div></div>
          <div class="mk"><div class="mk-v">{{ fmtTurnover }}</div><div class="mk-l">Taux de turnover</div></div>
          <div class="mk"><div class="mk-v">{{ mouvStats.eDebut }} → {{ mouvStats.eFin }}</div><div class="mk-l">Effectif (début → fin)</div></div>
        </div>
        <div v-if="evoEffectif.length > 1" class="evo-wrap">
          <div class="evo-title">Évolution de l'effectif · {{ mouvAnnee }}</div>
          <div class="evo-bars">
            <div v-for="p in evoEffectif" :key="p.mois" class="evo-b">
              <div class="evo-b-val">{{ p.n }}</div>
              <div class="evo-b-bar" :style="{ height: Math.max(3, p.n / evoMax * 72) + 'px' }"></div>
              <div class="evo-b-lbl">{{ MOIS_COURT[p.mois] }}</div>
            </div>
          </div>
        </div>
        <div v-if="partis.length" class="partis-wrap">
          <div class="evo-title">Sorties enregistrées <span class="count">{{ partis.length }}</span></div>
          <div class="ret-list">
            <div v-for="n in partis" :key="n.id" class="parti-row">
              <span class="rr-nom">{{ n.nom }}</span>
              <span class="rr-fct" v-if="n.fonction">· {{ n.fonction }}</span>
              <span class="parti-right">
                <span class="rr-motif" v-if="n.motif_sortie">{{ n.motif_sortie }}</span>
                <span class="parti-date">{{ fmtD(n.date_sortie) }}</span>
                <button v-if="peutEditer" class="lien-edit" @click="orgModifier(n)">Modifier</button>
              </span>
            </div>
          </div>
        </div>
        <div v-if="!evoEffectif.length && !partis.length && !mouvStats.entrees" class="empty-sm">Renseigne les dates de recrutement et de sortie pour suivre les mouvements et le turnover.</div>
      </section>
      </div>

      <div v-if="tab === 'org'">
      <section class="card">
        <div class="card-head"><h2 class="card-title">Personnel</h2><span class="count">{{ orgNodesAffiches.length }}</span></div>
        <div v-if="peutEditer" class="org-import">
          <button class="imp-toggle" @click="impOuvert = !impOuvert">📋 Importer / coller une liste <span class="imp-ch">{{ impOuvert ? '▲' : '▼' }}</span></button>
          <div v-if="impOuvert" class="imp-body">
            <p class="imp-hint">Charge l'export Excel de <b>Mirilla</b> — les colonnes (Nom, Responsable 1, Type contrat, Matricule, Téléphone, Date début, Date naissance, Date fin, Fin période essai…) sont <b>reconnues automatiquement</b> par leur nom. La hiérarchie est reconstruite via <b>Responsable 1</b>. Tu peux aussi coller une liste simple : <b>Nom · Fonction · Supérieur · Périmètre · Équipe</b>.</p>
            <div class="imp-file">
              <label class="imp-upload">📁 Charger un fichier Excel / CSV<input type="file" accept=".xlsx,.xls,.csv,.txt,.tsv" @change="impFichier" hidden /></label>
              <span class="imp-ou">— ou colle les lignes ci-dessous —</span>
            </div>
            <textarea v-model="impTexte" class="imp-ta" rows="7" placeholder="Nom, Fonction, Supérieur, Périmètre, Équipe — une ligne par personne"></textarea>
            <div class="imp-row">
              <div class="imp-opts">
                <label class="imp-rep"><input type="checkbox" v-model="impActifsSeuls" @change="impApercu && impPreview()" /> N'importer que les collaborateurs actifs</label>
                <label class="imp-rep"><input type="checkbox" v-model="impRemplacer" @change="impApercu && impPreview()" /> Remplacer l'organigramme existant ({{ orgNodes.length }} postes)</label>
              </div>
              <div class="imp-actions">
                <button class="btn-ghost" @click="impPreview">Prévisualiser</button>
                <button class="btn" :disabled="impBusy" @click="impImporter">{{ impBusy ? 'Import…' : 'Importer' }}</button>
              </div>
            </div>
            <div v-if="impApercu" class="imp-apercu">
              <div class="imp-stat"><b>{{ impApercu.lignes.length }}</b> personne(s) · <b>{{ impApercu.racines }}</b> au sommet<span v-if="impApercu.ignores"> · {{ impApercu.ignores }} inactif(s) ignoré(s)</span><span v-if="impApercu.orphelins"> · <b class="imp-no">{{ impApercu.orphelins }}</b> supérieur(s) introuvable(s) → placé(s) au sommet</span><span v-if="impApercu.mode === 'entete'" class="imp-detect"> · colonnes Mirilla détectées ✓</span></div>
              <div v-if="impApercu.erreurs.length" class="imp-err">⚠ {{ impApercu.erreurs.join(' · ') }}</div>
              <div class="imp-tablewrap" v-if="impApercu.lignes.length">
                <table class="imp-table">
                  <thead><tr><th>Nom</th><th>Supérieur</th><th>Contrat</th><th>Recrut.</th><th>Naiss.</th><th>Matricule</th></tr></thead>
                  <tbody><tr v-for="(l, i) in impApercu.lignes.slice(0, 40)" :key="i"><td>{{ l.nom }}</td><td :class="{ 'imp-no': l.supIntrouvable }">{{ l.superieur || '—' }}</td><td>{{ l.contrat || '—' }}</td><td>{{ l.date_recrutement || '—' }}</td><td>{{ l.date_naissance || '—' }}</td><td>{{ l.matricule || '—' }}</td></tr></tbody>
                </table>
              </div>
              <div v-if="impApercu.lignes.length > 40" class="imp-more">… et {{ impApercu.lignes.length - 40 }} de plus</div>
            </div>
          </div>
        </div>
        <div v-if="peutEditer" class="org-form2">
          <div class="of-grid">
            <label class="of-col"><span class="of-lbl">Nom *</span><input v-model="orgForm.nom" placeholder="Nom & prénom" /></label>
            <label class="of-col"><span class="of-lbl">Fonction</span><input v-model="orgForm.fonction" list="fonctionsListe" placeholder="Fonction" /><datalist id="fonctionsListe"><option v-for="f in FONCTIONS_SUGG" :key="f" :value="f" /></datalist></label>
            <label class="of-col"><span class="of-lbl">Supérieur</span><select v-model="orgForm.parent_id"><option value="">— (sommet)</option><option v-for="n in responsablesPossibles" :key="n.id" :value="n.id">{{ n.nom }}</option></select></label>
            <label class="of-col"><span class="of-lbl">Contrat</span><select v-model="orgForm.contrat"><option value="">—</option><option value="CDI">CDI</option><option value="CDD">CDD</option></select></label>
            <label class="of-col"><span class="of-lbl">Recrutement</span><input v-model="orgForm.date_recrutement" type="date" /></label>
            <label class="of-col"><span class="of-lbl">Naissance</span><input v-model="orgForm.date_naissance" type="date" /></label>
            <label class="of-col"><span class="of-lbl">Périmètre</span><select v-model="orgForm.atelier_id"><option value="">—</option><option v-for="pe in PERIMETRES" :key="pe" :value="pe">{{ pe }}</option></select></label>
            <label class="of-col"><span class="of-lbl">Équipe</span><input v-model="orgForm.equipe" placeholder="Équipe" /></label>
            <label class="of-col"><span class="of-lbl">Matricule</span><input v-model="orgForm.matricule" placeholder="Matricule" /></label>
            <label class="of-col"><span class="of-lbl">Téléphone</span><input v-model="orgForm.telephone" placeholder="Téléphone" /></label>
            <label class="of-col"><span class="of-lbl">Genre</span><select v-model="orgForm.genre"><option value="">—</option><option value="Homme">Homme</option><option value="Femme">Femme</option></select></label>
            <label v-if="orgForm.contrat === 'CDD'" class="of-col"><span class="of-lbl">Fin CDD</span><input v-model="orgForm.fin_cdd" type="date" /></label>
            <label class="of-col"><span class="of-lbl">Fin essai</span><input v-model="orgForm.fin_essai" type="date" /></label>
            <label class="of-col"><span class="of-lbl">Date sortie</span><input v-model="orgForm.date_sortie" type="date" /></label>
            <label v-if="orgForm.date_sortie" class="of-col"><span class="of-lbl">Motif sortie</span><select v-model="orgForm.motif_sortie"><option value="">—</option><option>Démission</option><option>Fin de contrat</option><option>Licenciement</option><option>Retraite</option><option>Mutation</option><option>Décès</option><option>Autre</option></select></label>
            <div class="of-col"><span class="of-lbl">Phase</span><div class="multi">
              <div v-if="orgForm.phases.length" class="chips"><span v-for="(ph, i) in orgForm.phases" :key="i" class="chip">{{ ph }}<button type="button" @click="orgForm.phases.splice(i, 1)">×</button></span></div>
              <select @change="orgAddPhase" class="add-sel"><option value="">+ Phase</option><option v-for="ph in PHASES_LISTE" :key="ph" :value="ph" :disabled="orgForm.phases.includes(ph)">{{ ph }}</option></select>
            </div></div>
            <div class="of-col"><span class="of-lbl">Équipement</span><div class="multi">
              <div v-if="orgForm.machines.length" class="chips"><span v-for="(m, i) in orgForm.machines" :key="i" class="chip mach">{{ m }}<button type="button" @click="orgForm.machines.splice(i, 1)">×</button></span></div>
              <select @change="orgAddMachine" class="add-sel"><option value="">+ Équipement</option><option v-for="eq in equipementsListe" :key="eq.id" :value="eq.nom" :disabled="orgForm.machines.includes(eq.nom)">{{ eq.nom }}</option></select>
            </div></div>
            <label class="of-col"><span class="of-lbl">Photo (URL)</span><input v-model="orgForm.photo_url" placeholder="URL photo" /></label>
            <label class="of-col"><span class="of-lbl">Note</span><input v-model="orgForm.note" placeholder="Note" /></label>
          </div>
          <div class="org-actions">
            <button class="btn" @click="orgEnregistrer">{{ orgForm.id ? 'Mettre à jour' : 'Ajouter' }}</button>
            <button v-if="orgForm.id" class="btn ghost" @click="orgReset">Annuler</button>
          </div>
        </div>
        <div v-if="!orgNodes.length" class="empty-card">Aucun poste. Ajoute le premier (ex. Manager Fabrication) ci-dessus.</div>
        <template v-else>
          <div class="pers-bar">
            <input v-model="persRech" class="pers-search" placeholder="Rechercher un nom, une fonction…" />
            <select v-model="orgPerimFiltre" class="org-filtre"><option value="">Tous les périmètres</option><option v-for="pe in PERIMETRES" :key="pe" :value="pe">{{ pe }}</option></select>
            <span class="pers-count">{{ persListe.length }} personne(s)</span>
          </div>
          <div v-if="!persListe.length" class="empty-sm">Aucun collaborateur ne correspond.</div>
          <div v-else class="pers-tablewrap">
            <table class="pers-table">
              <thead><tr>
                <th>Nom</th><th>Matricule</th><th>Fonction</th><th>Supérieur</th><th>Périmètre</th><th>Équipe</th><th>Phase</th><th>Équipement</th><th>Contrat</th><th>Recrutement</th><th>Fin essai</th><th>Naissance</th><th>Genre</th><th>Téléphone</th><th>Sortie</th><th>Motif</th><th></th>
              </tr></thead>
              <tbody>
                <tr v-for="n in persListe" :key="n.id">
                  <td class="pt-nom">{{ n.nom }}</td>
                  <td>{{ n.matricule || '—' }}</td>
                  <td>{{ n.fonction || '—' }}</td>
                  <td>{{ nomParent(n) || '—' }}</td>
                  <td>{{ n.atelier_id || '—' }}</td>
                  <td>{{ n.equipe || '—' }}</td>
                  <td>{{ n.equipement || '—' }}</td>
                  <td>{{ n.machine || '—' }}</td>
                  <td><span v-if="n.contrat" class="pt-ct" :class="'ct-' + (n.contrat === 'CDI' ? 'cdi' : 'cdd')">{{ n.contrat }}</span><span v-else class="pt-muted">—</span></td>
                  <td>{{ fmtD(n.date_recrutement) || '—' }}</td>
                  <td>{{ fmtD(n.fin_essai) || '—' }}</td>
                  <td>{{ fmtD(n.date_naissance) || '—' }}</td>
                  <td>{{ n.genre || '—' }}</td>
                  <td>{{ n.telephone || '—' }}</td>
                  <td>{{ fmtD(n.date_sortie) || '—' }}</td>
                  <td>{{ n.motif_sortie || '—' }}</td>
                  <td class="pt-act"><button v-if="peutEditer" @click="orgModifier(n)" title="Modifier">✎</button><button v-if="peutEditer" @click="orgSupprimer(n)" title="Supprimer">🗑</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ef-page { color: #1b2733; zoom: 0.7; }
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
.org-import { margin-bottom: 14px; }
.src-switch { display: inline-flex; gap: 4px; background: #eef2ff; border-radius: 10px; padding: 4px; margin-bottom: 16px; }
.src-switch button { border: 0; background: transparent; padding: 8px 16px; border-radius: 8px; font: inherit; font-size: 13px; font-weight: 700; color: #6366f1; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; }
.src-switch button.on { background: #fff; color: #4338ca; box-shadow: 0 1px 3px rgba(99,102,241,.2); }
.src-n { background: rgba(99,102,241,.15); color: #4338ca; border-radius: 999px; font-size: 10px; padding: 1px 7px; font-weight: 800; }
.imp-cible { font-size: 12px; color: #0f766e; background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 7px 10px; margin-bottom: 10px; font-weight: 600; }
.imp-toggle { background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; border-radius: 9px; padding: 8px 14px; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.imp-toggle:hover { background: #e0e7ff; }
.imp-ch { font-size: 10px; }
.imp-body { margin-top: 12px; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; background: #f8fafc; }
.imp-hint { font-size: 12px; color: #64748b; line-height: 1.5; margin: 0 0 10px; }
.imp-file { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
.imp-upload { background: #0d9488; color: #fff; border-radius: 8px; padding: 8px 14px; font-size: 13px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; }
.imp-upload:hover { background: #0f766e; }
.imp-ou { font-size: 11.5px; color: #94a3b8; font-weight: 600; }
.imp-ta { width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; font-size: 12.5px; font-family: ui-monospace, Menlo, Consolas, monospace; resize: vertical; }
.imp-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-top: 10px; }
.imp-rep { font-size: 12.5px; color: #475569; font-weight: 600; display: inline-flex; align-items: center; gap: 7px; cursor: pointer; }
.imp-actions { display: inline-flex; gap: 8px; }
.btn-ghost { border: 1px solid #cbd5e1; background: #fff; border-radius: 8px; padding: 8px 14px; font: inherit; font-size: 13px; font-weight: 600; color: #475569; cursor: pointer; }
.btn-ghost:hover { background: #f1f5f9; }
.imp-apercu { margin-top: 14px; }
.imp-stat { font-size: 12.5px; color: #475569; }
.imp-opts { display: flex; flex-direction: column; gap: 6px; }
.imp-detect { color: #16a34a; font-weight: 700; }
.imp-err { font-size: 12px; color: #b45309; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 6px 10px; margin-top: 8px; }
.imp-tablewrap { max-height: 320px; overflow: auto; margin-top: 10px; border: 1px solid #e2e8f0; border-radius: 8px; }
.imp-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.imp-table th { background: #f1f5f9; color: #475569; padding: 6px 8px; text-align: left; font-size: 11px; position: sticky; top: 0; }
.imp-table td { padding: 5px 8px; border-top: 1px solid #f1f5f9; }
.imp-no { color: #dc2626; font-weight: 700; }
.imp-more { font-size: 11.5px; color: #94a3b8; margin-top: 6px; }
.rh-tabs { display: flex; flex-wrap: wrap; gap: 4px; background: #f1f5f9; border-radius: 10px; padding: 4px; margin-bottom: 20px; }
.rh-tabs button { border: 0; background: transparent; padding: 8px 16px; border-radius: 8px; font: inherit; font-size: 13px; font-weight: 700; color: #64748b; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.rh-tabs button.on { background: #fff; color: #0d9488; box-shadow: 0 1px 2px rgba(16,24,40,.08); }
.rh-tabs .tb { background: #dc2626; color: #fff; border-radius: 999px; font-size: 10px; padding: 1px 6px; font-weight: 800; }
.dash-head { display: flex; align-items: center; justify-content: space-between; margin: 4px 0 14px; }
.dash-head .card-title { margin: 0; }
.btn-pdf { background: #0d9488; color: #fff; border: 0; padding: 8px 15px; border-radius: 8px; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.btn-pdf:hover { background: #0f766e; }
.dash-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
.dash-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); cursor: pointer; text-decoration: none; color: inherit; transition: border-color .15s, box-shadow .15s, transform .15s; }
.dash-card:hover { border-color: #cbd5e1; box-shadow: 0 6px 16px rgba(16,24,40,.08); transform: translateY(-2px); }
.dc-t { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; margin-bottom: 8px; }
.dc-big { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -.02em; }
.dc-sub { font-size: 11.5px; color: #64748b; margin-top: 6px; font-weight: 600; }
.dc-warn { color: #dc2626; font-weight: 800; }
.dc-bar { display: flex; height: 18px; border-radius: 6px; overflow: hidden; background: #f1f5f9; margin-bottom: 6px; }
.dc-seg { height: 100%; }
.dc-seg.h { background: #3b82f6; }
.dc-seg.f { background: #ec4899; }
.dc-link .dc-big { color: #0d9488; }
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
.mouv-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-top: 12px; }
.mk { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; }
.mk-v { font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -.02em; }
.mk-l { font-size: 11px; color: #64748b; margin-top: 3px; font-weight: 600; }
.mk-in .mk-v { color: #16a34a; }
.mk-out .mk-v { color: #dc2626; }
.evo-wrap, .partis-wrap { margin-top: 20px; }
.evo-title { font-size: 12px; font-weight: 800; color: #475569; margin-bottom: 12px; }
.evo-bars { display: flex; align-items: flex-end; gap: 6px; height: 104px; }
.evo-b { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 3px; }
.evo-b-val { font-size: 10px; font-weight: 800; color: #475569; }
.evo-b-bar { width: 100%; max-width: 34px; background: linear-gradient(180deg, #14b8a6, #0d9488); border-radius: 4px 4px 0 0; transition: height .3s ease; }
.evo-b-lbl { font-size: 9.5px; color: #94a3b8; font-weight: 700; }
.parti-row { display: flex; align-items: center; gap: 6px; padding: 7px 2px; border-top: 1px solid #f1f5f9; font-size: 13px; }
.parti-right { margin-left: auto; display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }
.parti-date { color: #64748b; font-size: 11.5px; }
.rr-motif { color: #7c3aed; font-size: 10.5px; font-weight: 700; background: #f5f3ff; padding: 1px 8px; border-radius: 999px; }
.lien-edit { border: 1px solid #e2e8f0; background: #fff; border-radius: 7px; padding: 3px 10px; font: inherit; font-size: 12px; font-weight: 600; color: #475569; cursor: pointer; }
.lien-edit:hover { background: #f8fafc; border-color: #cbd5e1; }
.org-actions { display: flex; gap: 8px; }
.org-tree { display: flex; flex-direction: column; gap: 6px; }
.org-chart { overflow-x: auto; padding: 12px 0 4px; zoom: 1; }
.pers-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.pers-search { flex: 1; min-width: 180px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; }
.pers-count { font-size: 12px; color: #94a3b8; font-weight: 700; }
.pers-tablewrap { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 10px; }
.pers-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.pers-table th { background: #f8fafc; color: #475569; padding: 9px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; white-space: nowrap; }
.pers-table td { padding: 9px 12px; border-top: 1px solid #f1f5f9; white-space: nowrap; }
.pt-nom { font-weight: 700; color: #0f172a; }
.pers-table th:first-child, .pers-table td:first-child { position: sticky; left: 0; z-index: 1; }
.pers-table thead th:first-child { background: #f8fafc; }
.pers-table tbody td:first-child { background: #fff; box-shadow: 1px 0 0 #e2e8f0; }
.pt-muted { color: #cbd5e1; }
.pt-ct { font-size: 10.5px; font-weight: 900; padding: 2px 8px; border-radius: 999px; }
.pt-ct.ct-cdi { background: #dcfce7; color: #16a34a; }
.pt-ct.ct-cdd { background: #ffedd5; color: #ea580c; }
.pt-act { text-align: right; }
.pt-act button { border: 1px solid #e2e8f0; background: #fff; border-radius: 6px; padding: 3px 7px; cursor: pointer; font-size: 12px; margin-left: 4px; }
.pt-act button:hover { background: #f1f5f9; }
.org-form2 { margin-bottom: 18px; }
.of-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px 12px; align-items: start; }
.of-col .multi { width: 100%; } .of-col .add-sel { width: 100%; }
.of-col { display: flex; flex-direction: column; gap: 4px; }
.of-lbl { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .03em; color: #94a3b8; }
.of-col input, .of-col select { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; color: #1b2733; width: 100%; box-sizing: border-box; }
.of-plus { margin-top: 12px; border: 1px dashed #cbd5e1; background: #f8fafc; border-radius: 8px; padding: 7px 14px; font: inherit; font-size: 12.5px; font-weight: 700; color: #64748b; cursor: pointer; }
.of-plus:hover { background: #f1f5f9; }
.of-extra { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #f1f5f9; }
.of-extra input, .of-extra select { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; color: #1b2733; }
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
