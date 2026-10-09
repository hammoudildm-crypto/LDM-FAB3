<script setup>
import { ref, reactive, computed, onMounted, inject } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'

const peutEditer = inject('peutEditer', ref(false))
const erreur = ref('')
const message = ref('')
const tab = ref('dev')

const MOIS_COURT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
const CRITICITES = ['Mineure', 'Majeure', 'Critique']
const STATUTS_DEV = ['Ouverte', 'En cours', 'Clôturée']
const ORIGINES_CAPA = ['Déviation', 'Changement', 'Audit', 'Réclamation', 'Autre']
const TYPES_CAPA = ['Corrective', 'Préventive']
const STATUTS_CAPA = ['Ouverte', 'En cours', 'Réalisée', 'Clôturée']
const EFFICACITES = ['Non vérifiée', 'Vérifiée', 'Non applicable']
const TYPES_CHG = ['Mineur', 'Majeur']
const STATUTS_CHG = ['Demandé', 'Approuvé', 'Réalisé', 'Clôturé']

const deviations = ref([])
const capa = ref([])
const changements = ref([])

const devForm = reactive({ id: null, numero: '', date_dev: new Date().toISOString().slice(0, 10), produit_lot: '', zone: '', criticite: '', type: '', description: '', origine: '', responsable: '', statut: 'Ouverte', capa_liee: '', ishikawa: { mo: [], ma: [], mat: [], me: [], mi: [] }, cinq_pourquoi: ['', '', '', '', ''], cause_racine: '' })
const capaForm = reactive({ id: null, numero: '', date_capa: new Date().toISOString().slice(0, 10), deviation_origine: '', changement_origine: '', origine: '', type: '', action: '', responsable: '', echeance: '', statut: 'Ouverte', efficacite: 'Non vérifiée' })
const chgForm = reactive({ id: null, numero: '', date_chg: new Date().toISOString().slice(0, 10), objet: '', type: '', description: '', impact: '', responsable: '', statut: 'Demandé', date_cloture: '' })

const devRech = ref(''); const devFiltreStatut = ref('')
const capaRech = ref(''); const capaFiltreStatut = ref('')
const chgRech = ref(''); const chgFiltreStatut = ref('')

async function charger() {
  erreur.value = ''
  const rd = await supabase.from('deviations').select('*').order('id', { ascending: false })
  if (rd.error) { erreur.value = rd.error.message; return } else deviations.value = rd.data || []
  const rc = await supabase.from('capa').select('*').order('id', { ascending: false })
  if (!rc.error) capa.value = rc.data || []
  const rg = await supabase.from('changements').select('*').order('id', { ascending: false })
  if (!rg.error) changements.value = rg.data || []
  await chargerPJ()
}
onMounted(charger)

const statutKey = (s) => {
  const n = (s || '').toLowerCase()
  if (n.indexOf('clotur') >= 0 || n.indexOf('clôtur') >= 0) return 'cloturee'
  if (n.indexOf('réalis') >= 0 || n.indexOf('realis') >= 0) return 'realisee'
  if (n.indexOf('approuv') >= 0) return 'approuve'
  if (n.indexOf('cours') >= 0) return 'cours'
  if (n.indexOf('ouvert') >= 0 || n.indexOf('demand') >= 0) return 'ouverte'
  return 'autre'
}
const fmtD = (x) => { if (!x) return '—'; const dt = new Date(x); return isNaN(dt) ? x : dt.toLocaleDateString('fr-FR') }
const estEnRetard = (c) => { if (!c.echeance) return false; if (statutKey(c.statut) === 'cloturee' || statutKey(c.statut) === 'realisee') return false; const dt = new Date(c.echeance); return !isNaN(dt) && dt < new Date(new Date().toISOString().slice(0, 10)) }
function numAuto(pref, liste) { const y = new Date().getFullYear(); const n = liste.filter(x => (x.numero || '').indexOf(pref + '-' + y) >= 0).length + 1; return pref + '-' + y + '-' + String(n).padStart(3, '0') }

const prochainDev = computed(() => numAuto('DEV', deviations.value))
const prochainCapa = computed(() => numAuto('CAPA', capa.value))
const prochainChg = computed(() => numAuto('CHG', changements.value))

const devListe = computed(() => { const q = devRech.value.toLowerCase(); return deviations.value.filter(d => (!devFiltreStatut.value || d.statut === devFiltreStatut.value) && (!q || (d.numero || '').toLowerCase().indexOf(q) >= 0 || (d.produit_lot || '').toLowerCase().indexOf(q) >= 0 || (d.description || '').toLowerCase().indexOf(q) >= 0)) })
const capaListe = computed(() => { const q = capaRech.value.toLowerCase(); return capa.value.filter(c => (!capaFiltreStatut.value || c.statut === capaFiltreStatut.value) && (!q || (c.numero || '').toLowerCase().indexOf(q) >= 0 || (c.action || '').toLowerCase().indexOf(q) >= 0 || (c.deviation_origine || '').toLowerCase().indexOf(q) >= 0)) })
const chgListe = computed(() => { const q = chgRech.value.toLowerCase(); return changements.value.filter(c => (!chgFiltreStatut.value || c.statut === chgFiltreStatut.value) && (!q || (c.numero || '').toLowerCase().indexOf(q) >= 0 || (c.objet || '').toLowerCase().indexOf(q) >= 0 || (c.description || '').toLowerCase().indexOf(q) >= 0)) })

const kpiDev = computed(() => { const d = deviations.value; return { total: d.length, ouvertes: d.filter(x => x.statut === 'Ouverte').length, enCours: d.filter(x => x.statut === 'En cours').length, cloturees: d.filter(x => x.statut === 'Clôturée').length, critiques: d.filter(x => x.criticite === 'Critique' && x.statut !== 'Clôturée').length } })
const kpiCapa = computed(() => { const d = capa.value; return { total: d.length, ouvertes: d.filter(x => x.statut === 'Ouverte').length, enCours: d.filter(x => x.statut === 'En cours').length, retard: d.filter(x => estEnRetard(x)).length, cloturees: d.filter(x => statutKey(x.statut) === 'cloturee' || statutKey(x.statut) === 'realisee').length } })
const kpiChg = computed(() => { const d = changements.value; return { total: d.length, encours: d.filter(x => statutKey(x.statut) !== 'cloturee').length, cloturees: d.filter(x => statutKey(x.statut) === 'cloturee').length, majeurs: d.filter(x => x.type === 'Majeur' && statutKey(x.statut) !== 'cloturee').length } })

// ---- Déviations ----
function devReset() { Object.assign(devForm, { id: null, numero: '', date_dev: new Date().toISOString().slice(0, 10), produit_lot: '', zone: '', criticite: '', type: '', description: '', origine: '', responsable: '', statut: 'Ouverte', capa_liee: '', ishikawa: { mo: [], ma: [], mat: [], me: [], mi: [] }, cinq_pourquoi: ['', '', '', '', ''], cause_racine: '' }) }
async function devEnregistrer() {
  erreur.value = ''; message.value = ''
  if (!devForm.description.trim()) { erreur.value = 'La description est obligatoire.'; return }
  const payload = { numero: (devForm.numero || prochainDev.value).trim(), date_dev: devForm.date_dev || null, produit_lot: devForm.produit_lot || null, zone: devForm.zone || null, criticite: devForm.criticite || null, type: devForm.type || null, description: devForm.description.trim(), origine: devForm.origine || null, responsable: devForm.responsable || null, statut: devForm.statut || 'Ouverte', capa_liee: devForm.capa_liee || null, ishikawa: devForm.ishikawa, cinq_pourquoi: devForm.cinq_pourquoi, cause_racine: devForm.cause_racine || null }
  const r = devForm.id ? await supabase.from('deviations').update(payload).eq('id', devForm.id) : await supabase.from('deviations').insert(payload)
  if (r.error) { erreur.value = r.error.message; return }
  message.value = devForm.id ? 'Déviation mise à jour.' : 'Déviation enregistrée.'; devReset(); await charger()
}
function devModifier(d) { Object.assign(devForm, { id: d.id, numero: d.numero || '', date_dev: d.date_dev || '', produit_lot: d.produit_lot || '', zone: d.zone || '', criticite: d.criticite || '', type: d.type || '', description: d.description || '', origine: d.origine || '', responsable: d.responsable || '', statut: d.statut || 'Ouverte', capa_liee: d.capa_liee || '', ishikawa: normIsh(d.ishikawa), cinq_pourquoi: norm5p(d.cinq_pourquoi), cause_racine: d.cause_racine || '' }); tab.value = 'dev'; window.scrollTo({ top: 0, behavior: 'smooth' }) }
async function devSupprimer(d) { if (!confirm('Supprimer la déviation ' + (d.numero || '') + ' ?')) return; const r = await supabase.from('deviations').delete().eq('id', d.id); if (r.error) { erreur.value = r.error.message; return } await charger() }
function creerCapaDepuisDev(d) { capaReset(); capaForm.deviation_origine = d.numero || ''; capaForm.origine = 'Déviation'; capaForm.action = 'Suite à déviation ' + (d.numero || '') + (d.produit_lot ? ' (' + d.produit_lot + ')' : ''); tab.value = 'capa'; window.scrollTo({ top: 0, behavior: 'smooth' }) }

// ---- CAPA ----
function capaReset() { Object.assign(capaForm, { id: null, numero: '', date_capa: new Date().toISOString().slice(0, 10), deviation_origine: '', changement_origine: '', origine: '', type: '', action: '', responsable: '', echeance: '', statut: 'Ouverte', efficacite: 'Non vérifiée' }) }
async function capaEnregistrer() {
  erreur.value = ''; message.value = ''
  if (!capaForm.action.trim()) { erreur.value = "L'action est obligatoire."; return }
  const payload = { numero: (capaForm.numero || prochainCapa.value).trim(), date_capa: capaForm.date_capa || null, deviation_origine: capaForm.deviation_origine || null, changement_origine: capaForm.changement_origine || null, origine: capaForm.origine || null, type: capaForm.type || null, action: capaForm.action.trim(), responsable: capaForm.responsable || null, echeance: capaForm.echeance || null, statut: capaForm.statut || 'Ouverte', efficacite: capaForm.efficacite || null }
  const r = capaForm.id ? await supabase.from('capa').update(payload).eq('id', capaForm.id) : await supabase.from('capa').insert(payload)
  if (r.error) { erreur.value = r.error.message; return }
  if (payload.deviation_origine && payload.numero) {
    const dev = deviations.value.find(x => x.numero === payload.deviation_origine)
    if (dev && dev.capa_liee !== payload.numero) await supabase.from('deviations').update({ capa_liee: payload.numero }).eq('id', dev.id)
  }
  if (payload.changement_origine && payload.numero) {
    const chg = changements.value.find(x => x.numero === payload.changement_origine)
    if (chg && chg.capa_liee !== payload.numero) await supabase.from('changements').update({ capa_liee: payload.numero }).eq('id', chg.id)
  }
  message.value = capaForm.id ? 'CAPA mise à jour.' : 'CAPA enregistrée.'; capaReset(); await charger()
}
function capaModifier(c) { Object.assign(capaForm, { id: c.id, numero: c.numero || '', date_capa: c.date_capa || '', deviation_origine: c.deviation_origine || '', changement_origine: c.changement_origine || '', origine: c.origine || '', type: c.type || '', action: c.action || '', responsable: c.responsable || '', echeance: c.echeance || '', statut: c.statut || 'Ouverte', efficacite: c.efficacite || 'Non vérifiée' }); tab.value = 'capa'; window.scrollTo({ top: 0, behavior: 'smooth' }) }
async function capaSupprimer(c) { if (!confirm('Supprimer la CAPA ' + (c.numero || '') + ' ?')) return; const r = await supabase.from('capa').delete().eq('id', c.id); if (r.error) { erreur.value = r.error.message; return } await charger() }

// ---- Changements ----
function chgReset() { Object.assign(chgForm, { id: null, numero: '', date_chg: new Date().toISOString().slice(0, 10), objet: '', type: '', description: '', impact: '', responsable: '', statut: 'Demandé', date_cloture: '' }) }
async function chgEnregistrer() {
  erreur.value = ''; message.value = ''
  if (!chgForm.objet.trim()) { erreur.value = "L'objet est obligatoire."; return }
  const payload = { numero: (chgForm.numero || prochainChg.value).trim(), date_chg: chgForm.date_chg || null, objet: chgForm.objet.trim(), type: chgForm.type || null, description: chgForm.description || null, impact: chgForm.impact || null, responsable: chgForm.responsable || null, statut: chgForm.statut || 'Demandé', date_cloture: chgForm.date_cloture || null }
  const r = chgForm.id ? await supabase.from('changements').update(payload).eq('id', chgForm.id) : await supabase.from('changements').insert(payload)
  if (r.error) { erreur.value = r.error.message; return }
  message.value = chgForm.id ? 'Changement mis à jour.' : 'Changement enregistré.'; chgReset(); await charger()
}
function chgModifier(c) { Object.assign(chgForm, { id: c.id, numero: c.numero || '', date_chg: c.date_chg || '', objet: c.objet || '', type: c.type || '', description: c.description || '', impact: c.impact || '', responsable: c.responsable || '', statut: c.statut || 'Demandé', date_cloture: c.date_cloture || '' }); tab.value = 'chg'; window.scrollTo({ top: 0, behavior: 'smooth' }) }
async function chgSupprimer(c) { if (!confirm('Supprimer le changement ' + (c.numero || '') + ' ?')) return; const r = await supabase.from('changements').delete().eq('id', c.id); if (r.error) { erreur.value = r.error.message; return } await charger() }

const alertes = computed(() => {
  const out = []
  const auj = new Date(new Date().toISOString().slice(0, 10))
  for (const c of capa.value) {
    if (estEnRetard(c)) {
      const j = Math.round((auj - new Date(c.echeance)) / 86400000)
      out.push({ k: 'capa-' + c.id, type: 'CAPA en retard', numero: c.numero || '', texte: c.action || '', detail: 'échéance dépassée de ' + j + ' j', urgent: j > 15 })
    }
  }
  for (const d of deviations.value) {
    if (d.criticite === 'Critique' && d.statut !== 'Clôturée') {
      const j = d.date_dev ? Math.round((auj - new Date(d.date_dev)) / 86400000) : null
      out.push({ k: 'dev-' + d.id, type: 'Déviation critique', numero: d.numero || '', texte: d.description || '', detail: j != null ? ('ouverte depuis ' + j + ' j') : 'ouverte', urgent: j != null && j > 30 })
    }
  }
  return out.sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0))
})

function donneesExport() {
  if (tab.value === 'dev') return { titre: 'Déviations', cols: ['N°', 'Date', 'Produit/Lot', 'Criticité', 'Type', 'Description', 'Origine', 'Responsable', 'CAPA liée', 'Statut'], rows: devListe.value.map(d => [d.numero, fmtD(d.date_dev), d.produit_lot, d.criticite, d.type, d.description, d.origine, d.responsable, d.capa_liee, d.statut]) }
  if (tab.value === 'capa') return { titre: 'CAPA', cols: ['N°', 'Date', 'Déviation', 'Origine', 'Type', 'Action', 'Responsable', 'Échéance', 'Statut', 'Efficacité'], rows: capaListe.value.map(c => [c.numero, fmtD(c.date_capa), c.deviation_origine, c.origine, c.type, c.action, c.responsable, fmtD(c.echeance), c.statut, c.efficacite]) }
  return { titre: 'Changements', cols: ['N°', 'Date', 'Objet', 'Type', 'Description', 'Impact', 'Responsable', 'Statut', 'Clôture'], rows: chgListe.value.map(c => [c.numero, fmtD(c.date_chg), c.objet, c.type, c.description, c.impact, c.responsable, c.statut, fmtD(c.date_cloture)]) }
}
function escHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
function tableHTML() {
  const d = donneesExport()
  const th = d.cols.map(c => '<th>' + escHtml(c) + '</th>').join('')
  const tr = d.rows.map(r => '<tr>' + r.map(c => '<td>' + escHtml(c) + '</td>').join('') + '</tr>').join('')
  return { titre: d.titre, n: d.rows.length, html: '<table border="1" cellspacing="0" cellpadding="4"><thead><tr>' + th + '</tr></thead><tbody>' + tr + '</tbody></table>' }
}
function telecharger(contenu, nom, mime, bom) {
  const blob = new Blob([(bom ? '\ufeff' : '') + contenu], { type: mime })
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = nom; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1500)
}
function exportPDF() {
  const t = tableHTML()
  const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + t.titre + '</title><style>body{font-family:Arial,sans-serif;font-size:11px;margin:16px}h1{font-size:18px;color:#0d9488;margin:0 0 4px}.sub{color:#64748b;font-size:11px;margin:0 0 12px}table{border-collapse:collapse;width:100%;font-size:9.5px}th{background:#f0fdfa;color:#0f766e;padding:5px;border:1px solid #cbd5e1;text-align:left;font-size:9px}td{padding:4px 5px;border:1px solid #e2e8f0}@media print{body{margin:8mm}}</style></head><body><h1>' + t.titre + ' — Qualité</h1><p class="sub">Édité le ' + new Date().toLocaleString('fr-FR') + ' — ' + t.n + ' ligne(s)</p>' + t.html + '</body></html>'
  const w = window.open('', '_blank'); if (!w) { erreur.value = 'Autorise les pop-ups pour exporter en PDF.'; return }
  w.document.write(html); w.document.close(); w.focus(); setTimeout(() => { try { w.print() } catch (e) {} }, 350)
}
function exportWord() {
  const t = tableHTML()
  const html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><style>body{font-family:Arial}h1{color:#0d9488}table{border-collapse:collapse;width:100%}th{background:#f0fdfa;color:#0f766e;padding:5px;border:1px solid #999;text-align:left}td{padding:4px;border:1px solid #ccc}</style></head><body><h1>' + t.titre + ' — Qualité</h1><p>Édité le ' + new Date().toLocaleString('fr-FR') + '</p>' + t.html + '</body></html>'
  telecharger(html, t.titre + '_' + new Date().toISOString().slice(0, 10) + '.doc', 'application/msword', false)
}
function exportExcel() {
  const d = donneesExport()
  const esc = (s) => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"'
  const lignes = [d.cols.map(esc).join(';')].concat(d.rows.map(r => r.map(esc).join(';')))
  telecharger(lignes.join('\r\n'), d.titre + '_' + new Date().toISOString().slice(0, 10) + '.csv', 'text/csv;charset=utf-8', true)
}

const dashDu = ref('')
const dashAu = ref('')
const dansPeriode = (dateStr) => { if (!dashDu.value && !dashAu.value) return true; if (!dateStr) return false; const d = String(dateStr).slice(0, 10); if (dashDu.value && d < dashDu.value) return false; if (dashAu.value && d > dashAu.value) return false; return true }
const devPeriode = computed(() => deviations.value.filter(d => dansPeriode(d.date_dev)))
const capaPeriode = computed(() => capa.value.filter(c => dansPeriode(c.date_capa)))
const chgPeriode = computed(() => changements.value.filter(c => dansPeriode(c.date_chg)))
const repartition = (liste, champ) => { const m = {}; for (const x of liste) { const v = ((x[champ] || '') + '').trim() || '—'; m[v] = (m[v] || 0) + 1 }; return Object.keys(m).map(k => ({ k, n: m[k] })).sort((a, b) => b.n - a.n) }
const maxN = (arr) => Math.max(1, ...arr.map(r => r.n))
const blocs = computed(() => [
  { t: 'Déviations · criticité', d: repartition(devPeriode.value, 'criticite') },
  { t: 'Déviations · statut', d: repartition(devPeriode.value, 'statut') },
  { t: 'Déviations · zone', d: repartition(devPeriode.value, 'zone') },
  { t: 'Déviations · top produits / lots', d: repartition(devPeriode.value, 'produit_lot').slice(0, 8) },
  { t: 'Déviations · origine', d: repartition(devPeriode.value, 'origine') },
  { t: 'Déviations · responsable', d: repartition(devPeriode.value, 'responsable').slice(0, 8) },
  { t: 'CAPA · type', d: repartition(capaPeriode.value, 'type') },
  { t: 'CAPA · statut', d: repartition(capaPeriode.value, 'statut') },
  { t: 'CAPA · responsable', d: repartition(capaPeriode.value, 'responsable').slice(0, 8) },
  { t: 'Changements · type', d: repartition(chgPeriode.value, 'type') },
  { t: 'Changements · statut', d: repartition(chgPeriode.value, 'statut') }
])
const evolution = computed(() => {
  const now = new Date(), mois = []
  for (let i = 11; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); mois.push({ key: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), label: MOIS_COURT[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2), dev: 0, capa: 0, chg: 0 }) }
  const idx = {}; mois.forEach((m, i) => idx[m.key] = i)
  for (const x of deviations.value) { const k = (x.date_dev || '').slice(0, 7); if (k in idx) mois[idx[k]].dev++ }
  for (const x of capa.value) { const k = (x.date_capa || '').slice(0, 7); if (k in idx) mois[idx[k]].capa++ }
  for (const x of changements.value) { const k = (x.date_chg || '').slice(0, 7); if (k in idx) mois[idx[k]].chg++ }
  return mois
})
const evoMax = computed(() => Math.max(1, ...evolution.value.map(m => Math.max(m.dev, m.capa, m.chg))))
function exportDashPDF() {
  const per = (dashDu.value || dashAu.value) ? ('Période : ' + (dashDu.value || '…') + ' → ' + (dashAu.value || '…')) : 'Toute période'
  const kp = [['Déviations', devPeriode.value.length], ['dont critiques', devPeriode.value.filter(d => d.criticite === 'Critique').length], ['CAPA', capaPeriode.value.length], ['CAPA en retard', capaPeriode.value.filter(c => estEnRetard(c)).length], ['Changements', chgPeriode.value.length]]
  const kpHtml = '<div class="kp">' + kp.map(k => '<div class="k"><div class="v">' + k[1] + '</div><div class="l">' + escHtml(k[0]) + '</div></div>').join('') + '</div>'
  const evoHtml = '<h2>Évolution mensuelle (12 mois)</h2><table><thead><tr><th>Mois</th><th>Déviations</th><th>CAPA</th><th>Changements</th></tr></thead><tbody>' + evolution.value.map(m => '<tr><td>' + m.label + '</td><td style="text-align:right">' + m.dev + '</td><td style="text-align:right">' + m.capa + '</td><td style="text-align:right">' + m.chg + '</td></tr>').join('') + '</tbody></table>'
  const blocsHtml = blocs.value.map(b => '<h2>' + escHtml(b.t) + '</h2>' + (b.d.length ? '<table><tbody>' + b.d.map(r => '<tr><td>' + escHtml(r.k) + '</td><td style="text-align:right;width:50px">' + r.n + '</td></tr>').join('') + '</tbody></table>' : '<p class="none">Aucune donnée</p>')).join('')
  const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Tableau de bord Qualité</title><style>body{font-family:Arial,sans-serif;font-size:11px;margin:16px;color:#1b2733}h1{font-size:19px;color:#0d9488;margin:0 0 2px}.sub{color:#64748b;font-size:11px;margin:0 0 14px}h2{font-size:12px;margin:16px 0 6px;border-left:4px solid #0d9488;padding-left:8px}.kp{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px}.k{flex:1;min-width:90px;border:1px solid #e2e8f0;border-radius:8px;padding:8px;text-align:center}.k .v{font-size:18px;font-weight:800}.k .l{font-size:9px;text-transform:uppercase;color:#94a3b8;font-weight:700}table{border-collapse:collapse;font-size:10px;margin-bottom:8px;width:100%;max-width:440px}th{background:#f0fdfa;color:#0f766e;padding:4px 6px;border:1px solid #cbd5e1;text-align:left;font-size:9px}td{padding:3px 6px;border:1px solid #e2e8f0}.none{color:#94a3b8;font-size:10px}@media print{body{margin:8mm}}</style></head><body><h1>Tableau de bord — Qualité</h1><p class="sub">' + per + ' — édité le ' + new Date().toLocaleString('fr-FR') + '</p>' + kpHtml + evoHtml + blocsHtml + '</body></html>'
  const w = window.open('', '_blank'); if (!w) { erreur.value = 'Autorise les pop-ups pour exporter.'; return }
  w.document.write(html); w.document.close(); w.focus(); setTimeout(() => { try { w.print() } catch (e) {} }, 350)
}

const pj = ref([])
async function chargerPJ() { const r = await supabase.from('qualite_pj').select('*').order('id', { ascending: false }); if (!r.error) pj.value = r.data || [] }
const pjDe = (mod, refId) => pj.value.filter(x => x.module === mod && x.ref_id === refId)
async function ajouterPJ(e, mod, refId) {
  const f = e.target.files && e.target.files[0]; if (!f) return
  erreur.value = ''; message.value = ''
  const path = mod + '/' + refId + '/' + Date.now() + '_' + f.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const up = await supabase.storage.from('qualite').upload(path, f, { upsert: false })
  if (up.error) { erreur.value = 'Upload : ' + up.error.message; e.target.value = ''; return }
  const pub = supabase.storage.from('qualite').getPublicUrl(path)
  const r = await supabase.from('qualite_pj').insert({ module: mod, ref_id: refId, nom: f.name, url: pub.data.publicUrl, path })
  if (r.error) { erreur.value = r.error.message; e.target.value = ''; return }
  message.value = 'Pièce jointe ajoutée.'; e.target.value = ''; await chargerPJ()
}
async function supprimerPJ(x) {
  if (!confirm('Supprimer « ' + x.nom + ' » ?')) return
  if (x.path) await supabase.storage.from('qualite').remove([x.path])
  const r = await supabase.from('qualite_pj').delete().eq('id', x.id)
  if (r.error) { erreur.value = r.error.message; return }
  await chargerPJ()
}
function creerCapaDepuisChg(c) { capaReset(); capaForm.changement_origine = c.numero || ''; capaForm.origine = 'Changement'; capaForm.action = 'Suite au changement ' + (c.numero || '') + (c.objet ? ' (' + c.objet + ')' : ''); tab.value = 'capa'; window.scrollTo({ top: 0, behavior: 'smooth' }) }

const acrOuvert = ref(false)
const ISH_W = 720, ISH_H = 360, spineY = 180
const branchesM = [
  { k: 'mo', nom: "Main-d'œuvre", top: true, bx: 185 },
  { k: 'ma', nom: 'Matière', top: true, bx: 335 },
  { k: 'mat', nom: 'Matériel', top: true, bx: 485 },
  { k: 'me', nom: 'Méthode', top: false, bx: 260 },
  { k: 'mi', nom: 'Milieu', top: false, bx: 410 }
]
const BIBLIO = {
  mo: ['Formation insuffisante', 'Habilitation manquante', 'Erreur humaine / inattention', 'Non-respect de la procédure', 'Charge de travail / stress', 'Communication / transmission', 'Relève d\'équipe', 'Compétence inadaptée'],
  ma: ['Matière première non conforme', 'Article de conditionnement non conforme', 'Lot fournisseur défaillant', 'Péremption dépassée', 'Erreur d\'identification / étiquetage', 'Contamination', 'Stockage inadapté'],
  mat: ['Panne équipement', 'Mauvais réglage / paramétrage', 'Maintenance insuffisante', 'Étalonnage expiré', 'Usure / vétusté', 'Nettoyage équipement insuffisant', 'Pièce défectueuse'],
  me: ['Procédure inadaptée / incomplète', 'Instruction ambiguë', 'Paramètres de procédé inadaptés', 'Mode opératoire non suivi', 'Absence de procédure', 'Procédure obsolète', 'Contrôle en cours insuffisant'],
  mi: ['Température hors spécification', 'Humidité hors spécification', 'Pression différentielle non conforme', 'Propreté des locaux', 'Flux inadapté', 'Éclairage insuffisant', 'Encombrement de la zone']
}
const brEnd = (b) => ({ x: b.bx - 65, y: b.top ? 50 : ISH_H - 50 })
const causePos = (b, i, n) => { const e = brEnd(b); const f = (i + 1) / (n + 1); return { x: b.bx + (e.x - b.bx) * f, y: spineY + (e.y - spineY) * f } }
function normIsh(ish) { const base = { mo: [], ma: [], mat: [], me: [], mi: [] }; if (ish) for (const k in base) if (Array.isArray(ish[k])) base[k] = ish[k].slice(); return base }
function norm5p(arr) { const a = ['', '', '', '', '']; if (Array.isArray(arr)) for (let i = 0; i < 5; i++) a[i] = arr[i] || ''; return a }
function ajIsh(k, e) { const v = (e.target.value || '').trim(); if (v) { devForm.ishikawa[k].push(v); e.target.value = '' } }
function ficheACR() {
  const d = devForm
  const noms = { mo: "Main-d'œuvre", ma: 'Matière', mat: 'Matériel', me: 'Méthode', mi: 'Milieu' }
  const ish = normIsh(d.ishikawa), p5 = norm5p(d.cinq_pourquoi)
  const ishHtml = Object.keys(noms).map(k => '<div class="b"><h3>' + noms[k] + '</h3>' + (ish[k].length ? '<ul>' + ish[k].map(c => '<li>' + escHtml(c) + '</li>').join('') + '</ul>' : '<p class="none">—</p>') + '</div>').join('')
  const p5Html = '<ol>' + p5.map(r => '<li>' + escHtml(r || '—') + '</li>').join('') + '</ol>'
  const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fiche ACR</title><style>body{font-family:Arial,sans-serif;font-size:12px;margin:18px;color:#1b2733}h1{font-size:19px;color:#0d9488;margin:0 0 2px}.sub{color:#64748b;margin:0 0 14px;font-size:11px}h2{font-size:13px;margin:16px 0 6px;border-left:4px solid #0d9488;padding-left:8px}h3{font-size:12px;margin:6px 0 4px;color:#4338ca}.g{display:grid;grid-template-columns:1fr 1fr;gap:10px}.b{border:1px solid #e2e8f0;border-radius:8px;padding:8px}ul,ol{margin:4px 0;padding-left:18px}li{margin:2px 0}.none{color:#94a3b8}.box{border:1px solid #e2e8f0;border-radius:8px;padding:10px;background:#f8fafc}@media print{body{margin:10mm}}</style></head><body><h1>Fiche d\'analyse des causes racines</h1><p class="sub">' + escHtml(d.numero || '') + ' — ' + escHtml(d.produit_lot || '') + ' — édité le ' + new Date().toLocaleDateString('fr-FR') + '</p><h2>Problème</h2><div class="box">' + escHtml(d.description || '—') + '</div><h2>Ishikawa (5M) — causes potentielles</h2><div class="g">' + ishHtml + '</div><h2>5 Pourquoi</h2>' + p5Html + '<h2>Cause racine identifiée</h2><div class="box">' + escHtml(d.cause_racine || '—') + '</div></body></html>'
  const w = window.open('', '_blank'); if (!w) { erreur.value = 'Autorise les pop-ups pour la fiche.'; return }
  w.document.write(html); w.document.close(); w.focus(); setTimeout(() => { try { w.print() } catch (e) {} }, 350)
}

const iaEnCours = ref(false)
const iaSuggestion = ref(null)
async function assistantIA() {
  if (!devForm.description.trim()) { erreur.value = 'Saisis d\'abord la description de la déviation.'; return }
  iaEnCours.value = true; iaSuggestion.value = null; erreur.value = ''; message.value = ''
  try {
    const { data, error } = await supabase.functions.invoke('analyse-deviation', { body: { description: devForm.description, produit_lot: devForm.produit_lot, zone: devForm.zone, criticite: devForm.criticite } })
    if (error) { erreur.value = 'Assistant IA : ' + error.message; iaEnCours.value = false; return }
    if (data && data.error) { erreur.value = 'Assistant IA : ' + data.error; iaEnCours.value = false; return }
    iaSuggestion.value = data; acrOuvert.value = true
  } catch (e) { erreur.value = 'Assistant IA : ' + (e.message || e) }
  iaEnCours.value = false
}
function appliquerIA() {
  const d = iaSuggestion.value; if (!d) return
  if (d.criticite && !devForm.criticite) devForm.criticite = d.criticite
  if (d.ishikawa) for (const k of ['mo', 'ma', 'mat', 'me', 'mi']) if (Array.isArray(d.ishikawa[k])) for (const c of d.ishikawa[k]) if (c && !devForm.ishikawa[k].includes(c)) devForm.ishikawa[k].push(c)
  if (Array.isArray(d.cinq_pourquoi)) for (let i = 0; i < 5; i++) if (d.cinq_pourquoi[i] && !devForm.cinq_pourquoi[i]) devForm.cinq_pourquoi[i] = d.cinq_pourquoi[i]
  if (d.cause_racine && !devForm.cause_racine) devForm.cause_racine = d.cause_racine
  message.value = 'Suggestions IA appliquées — vérifie et ajuste.'; iaSuggestion.value = null
}
</script>

<template>
  <div class="q-page">
    <PageHeader title="Qualité" tone="teal" subtitle="Déviations, CAPA et changements." />
    <p v-if="erreur" class="q-alert">{{ erreur }}</p>
    <p v-if="message" class="q-ok">{{ message }}</p>

    <div class="q-alertes" v-if="alertes.length">
      <div class="qa-head">⚠ Alertes qualité ({{ alertes.length }})</div>
      <div v-for="a in alertes" :key="a.k" class="qa-row" :class="a.urgent ? 'qa-rouge' : 'qa-ambre'">
        <span class="qa-tag">{{ a.type }}</span>
        <span class="qa-num">{{ a.numero }}</span>
        <span class="qa-txt">{{ a.texte }}</span>
        <span class="qa-detail">{{ a.detail }}</span>
      </div>
    </div>

    <div class="q-tabs">
      <button :class="{ on: tab === 'dev' }" @click="tab = 'dev'">Déviations <span class="qt-n">{{ kpiDev.total }}</span></button>
      <button :class="{ on: tab === 'capa' }" @click="tab = 'capa'">CAPA <span class="qt-n">{{ kpiCapa.total }}</span></button>
      <button :class="{ on: tab === 'chg' }" @click="tab = 'chg'">Changements <span class="qt-n">{{ kpiChg.total }}</span></button>
      <button :class="{ on: tab === 'dash' }" @click="tab = 'dash'">📊 Tableau de bord</button>
    </div>

    <!-- ===== DÉVIATIONS ===== -->
    <div v-if="tab === 'dev'">
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-v">{{ kpiDev.total }}</div><div class="kpi-l">Total</div></div>
        <div class="kpi"><div class="kpi-v o">{{ kpiDev.ouvertes }}</div><div class="kpi-l">Ouvertes</div></div>
        <div class="kpi"><div class="kpi-v c">{{ kpiDev.enCours }}</div><div class="kpi-l">En cours</div></div>
        <div class="kpi"><div class="kpi-v g">{{ kpiDev.cloturees }}</div><div class="kpi-l">Clôturées</div></div>
        <div class="kpi"><div class="kpi-v r">{{ kpiDev.critiques }}</div><div class="kpi-l">Critiques ouvertes</div></div>
      </div>
      <section class="card" v-if="peutEditer">
        <h2 class="card-title">{{ devForm.id ? 'Modifier la déviation' : 'Nouvelle déviation' }}</h2>
        <div class="of-grid">
          <label class="of-col"><span class="of-lbl">N°</span><input v-model="devForm.numero" :placeholder="prochainDev" /></label>
          <label class="of-col"><span class="of-lbl">Date</span><input v-model="devForm.date_dev" type="date" /></label>
          <label class="of-col"><span class="of-lbl">Produit / Lot</span><input v-model="devForm.produit_lot" placeholder="Produit ou n° lot" /></label>
          <label class="of-col"><span class="of-lbl">Zone / Atelier</span><input v-model="devForm.zone" placeholder="Zone de production" /></label>
          <label class="of-col"><span class="of-lbl">Criticité</span><select v-model="devForm.criticite"><option value="">—</option><option v-for="c in CRITICITES" :key="c" :value="c">{{ c }}</option></select></label>
          <label class="of-col"><span class="of-lbl">Type</span><input v-model="devForm.type" placeholder="Type de déviation" /></label>
          <label class="of-col"><span class="of-lbl">Origine</span><input v-model="devForm.origine" placeholder="Origine / cause" /></label>
          <label class="of-col"><span class="of-lbl">Responsable</span><input v-model="devForm.responsable" placeholder="Responsable" /></label>
          <label class="of-col"><span class="of-lbl">Statut</span><select v-model="devForm.statut"><option v-for="s in STATUTS_DEV" :key="s" :value="s">{{ s }}</option></select></label>
          <label class="of-col"><span class="of-lbl">CAPA liée</span><select v-model="devForm.capa_liee"><option value="">—</option><option v-for="c in capa" :key="c.id" :value="c.numero">{{ c.numero }}</option></select></label>
          <label class="of-col of-wide"><span class="of-lbl">Description *</span><textarea v-model="devForm.description" rows="2" placeholder="Description de la déviation"></textarea></label>
        </div>
        <div v-if="peutEditer" class="acr-box">
          <button type="button" class="acr-toggle" @click="acrOuvert = !acrOuvert">🔍 Analyse des causes (Ishikawa 5M + 5 Pourquoi) <span class="acr-ch">{{ acrOuvert ? '▲' : '▼' }}</span></button>
          <div v-if="acrOuvert" class="acr-body">
            <div class="ia-box">
              <button type="button" class="ia-btn" :disabled="iaEnCours" @click="assistantIA">{{ iaEnCours ? '🤖 Analyse en cours…' : '🤖 Assistant IA — proposer une analyse' }}</button>
              <div v-if="iaSuggestion" class="ia-result">
                <div class="ia-h">Proposition de l'IA — à valider</div>
                <div v-if="iaSuggestion.criticite" class="ia-line"><b>Criticité :</b> {{ iaSuggestion.criticite }}</div>
                <div v-if="iaSuggestion.cause_racine" class="ia-line"><b>Cause racine :</b> {{ iaSuggestion.cause_racine }}</div>
                <div v-if="iaSuggestion.capa && iaSuggestion.capa.length" class="ia-line"><b>CAPA suggérées :</b><ul class="ia-ul"><li v-for="(c, i) in iaSuggestion.capa" :key="i">{{ c.type }} — {{ c.action }}</li></ul></div>
                <div class="ia-actions"><button type="button" class="q-btn" @click="appliquerIA">Appliquer à l'analyse</button><button type="button" class="q-btn ghost" @click="iaSuggestion = null">Ignorer</button></div>
              </div>
            </div>
            <div class="ish-wrap">
              <svg :viewBox="'0 0 ' + ISH_W + ' ' + ISH_H" class="ish-svg" preserveAspectRatio="xMidYMid meet">
                <line :x1="30" :y1="spineY" :x2="ISH_W - 120" :y2="spineY" stroke="#0d9488" stroke-width="2.5" />
                <polygon :points="(ISH_W - 120) + ',' + (spineY - 24) + ' ' + (ISH_W - 18) + ',' + spineY + ' ' + (ISH_W - 120) + ',' + (spineY + 24)" fill="#ccfbf1" stroke="#0d9488" stroke-width="1.5" />
                <text :x="ISH_W - 69" :y="spineY - 3" text-anchor="middle" class="ish-head-t">Déviation</text>
                <text :x="ISH_W - 69" :y="spineY + 11" text-anchor="middle" class="ish-head-t2">{{ devForm.numero || '—' }}</text>
                <g v-for="b in branchesM" :key="b.k">
                  <line :x1="b.bx" :y1="spineY" :x2="brEnd(b).x" :y2="brEnd(b).y" stroke="#94a3b8" stroke-width="2" />
                  <rect :x="brEnd(b).x - 46" :y="b.top ? brEnd(b).y - 17 : brEnd(b).y + 1" width="92" height="16" rx="4" fill="#6366f1" />
                  <text :x="brEnd(b).x" :y="b.top ? brEnd(b).y - 5 : brEnd(b).y + 13" text-anchor="middle" class="ish-m-t">{{ b.nom }}</text>
                  <g v-for="(c, i) in devForm.ishikawa[b.k].slice(0, 5)" :key="i">
                    <line :x1="causePos(b, i, Math.min(devForm.ishikawa[b.k].length, 5)).x" :y1="causePos(b, i, Math.min(devForm.ishikawa[b.k].length, 5)).y" :x2="causePos(b, i, Math.min(devForm.ishikawa[b.k].length, 5)).x - 24" :y2="causePos(b, i, Math.min(devForm.ishikawa[b.k].length, 5)).y" stroke="#cbd5e1" stroke-width="1" />
                    <text :x="causePos(b, i, Math.min(devForm.ishikawa[b.k].length, 5)).x - 27" :y="causePos(b, i, Math.min(devForm.ishikawa[b.k].length, 5)).y + 3" text-anchor="end" class="ish-c-t">{{ c.length > 18 ? c.slice(0, 17) + '…' : c }}</text>
                  </g>
                </g>
              </svg>
            </div>
            <div class="ish-cards">
              <div v-for="b in branchesM" :key="b.k" class="ish-card">
                <div class="ish-m">{{ b.nom }}</div>
                <div class="ish-causes"><span v-for="(c, i) in devForm.ishikawa[b.k]" :key="i" class="ish-chip">{{ c }}<button type="button" @click="devForm.ishikawa[b.k].splice(i, 1)">×</button></span></div>
                <input class="ish-input" placeholder="+ cause personnalisée…" @keyup.enter="ajIsh(b.k, $event)" />
                <div class="ish-lib"><span v-for="c in BIBLIO[b.k].filter(x => !devForm.ishikawa[b.k].includes(x))" :key="c" class="ish-sugg" @click="devForm.ishikawa[b.k].push(c)">+ {{ c }}</span></div>
              </div>
            </div>
            <div class="pq-box">
              <div class="pq-head">5 Pourquoi — remonter à la cause racine</div>
              <div v-for="(r, i) in devForm.cinq_pourquoi" :key="i" class="pq-row">
                <span class="pq-n">Pourquoi {{ i + 1 }} ?</span>
                <input v-model="devForm.cinq_pourquoi[i]" class="pq-input" placeholder="Parce que…" />
              </div>
            </div>
            <label class="acr-racine"><span class="of-lbl">Cause racine identifiée</span><textarea v-model="devForm.cause_racine" rows="2" placeholder="Conclusion de l'analyse"></textarea></label>
            <div class="acr-actions"><button type="button" class="q-btn ghost" @click="ficheACR">📄 Fiche ACR (PDF)</button></div>
          </div>
        </div>
        <div v-if="devForm.id" class="pj-box">
          <div class="pj-head">Pièces jointes</div>
          <div class="pj-list">
            <div v-for="x in pjDe('dev', devForm.id)" :key="x.id" class="pj-item"><a :href="x.url" target="_blank" class="pj-lnk">📎 {{ x.nom }}</a><button class="pj-del" @click="supprimerPJ(x)" title="Supprimer">×</button></div>
            <label class="pj-add">+ Ajouter un fichier<input type="file" @change="e => ajouterPJ(e, 'dev', devForm.id)" hidden /></label>
          </div>
        </div>
        <div class="q-actions"><button class="q-btn" @click="devEnregistrer">{{ devForm.id ? 'Mettre à jour' : 'Ajouter' }}</button><button v-if="devForm.id" class="q-btn ghost" @click="devReset">Annuler</button></div>
      </section>
      <section class="card">
        <div class="q-bar"><input v-model="devRech" class="q-search" placeholder="Rechercher (N°, lot, description)…" /><select v-model="devFiltreStatut" class="q-filtre"><option value="">Tous les statuts</option><option v-for="s in STATUTS_DEV" :key="s" :value="s">{{ s }}</option></select><span class="q-count">{{ devListe.length }} déviation(s)</span><div class="q-exports"><button class="q-exp" @click="exportPDF" title="Exporter en PDF">📄 PDF</button><button class="q-exp" @click="exportWord" title="Exporter en Word">📝 Word</button><button class="q-exp" @click="exportExcel" title="Exporter en Excel (CSV)">📊 Excel</button></div></div>
        <div v-if="!devListe.length" class="empty-sm">Aucune déviation enregistrée.</div>
        <div v-else class="q-tablewrap">
          <table class="q-table">
            <thead><tr><th>N°</th><th>Date</th><th>Produit/Lot</th><th>Criticité</th><th>Description</th><th>Responsable</th><th>Cause racine</th><th>CAPA</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              <tr v-for="d in devListe" :key="d.id">
                <td class="qt-num">{{ d.numero || '—' }}</td><td>{{ fmtD(d.date_dev) }}</td><td>{{ d.produit_lot || '—' }}</td>
                <td><span v-if="d.criticite" class="q-crit" :class="'crit-' + d.criticite.toLowerCase()">{{ d.criticite }}</span><span v-else>—</span></td>
                <td class="qt-desc" :title="d.description">{{ d.description || '—' }}</td><td>{{ d.responsable || '—' }}</td><td class="qt-desc" :title="d.cause_racine">{{ d.cause_racine || '—' }}</td><td>{{ d.capa_liee || '—' }}</td>
                <td><span class="q-stat" :class="'st-' + statutKey(d.statut)">{{ d.statut }}</span></td>
                <td class="qt-act"><button v-if="peutEditer && !d.capa_liee" class="lnk" @click="creerCapaDepuisDev(d)" title="Créer une CAPA">→ CAPA</button><button v-if="peutEditer" @click="devModifier(d)" title="Modifier">✎</button><button v-if="peutEditer" @click="devSupprimer(d)" title="Supprimer">🗑</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- ===== CAPA ===== -->
    <div v-if="tab === 'capa'">
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-v">{{ kpiCapa.total }}</div><div class="kpi-l">Total</div></div>
        <div class="kpi"><div class="kpi-v o">{{ kpiCapa.ouvertes }}</div><div class="kpi-l">Ouvertes</div></div>
        <div class="kpi"><div class="kpi-v c">{{ kpiCapa.enCours }}</div><div class="kpi-l">En cours</div></div>
        <div class="kpi"><div class="kpi-v r">{{ kpiCapa.retard }}</div><div class="kpi-l">En retard</div></div>
        <div class="kpi"><div class="kpi-v g">{{ kpiCapa.cloturees }}</div><div class="kpi-l">Réalisées/Clôturées</div></div>
      </div>
      <section class="card" v-if="peutEditer">
        <h2 class="card-title">{{ capaForm.id ? 'Modifier la CAPA' : 'Nouvelle CAPA' }}</h2>
        <div class="of-grid">
          <label class="of-col"><span class="of-lbl">N°</span><input v-model="capaForm.numero" :placeholder="prochainCapa" /></label>
          <label class="of-col"><span class="of-lbl">Date</span><input v-model="capaForm.date_capa" type="date" /></label>
          <label class="of-col"><span class="of-lbl">Déviation d'origine</span><select v-model="capaForm.deviation_origine"><option value="">—</option><option v-for="d in deviations" :key="d.id" :value="d.numero">{{ d.numero }}<template v-if="d.produit_lot"> — {{ d.produit_lot }}</template></option></select></label>
          <label class="of-col"><span class="of-lbl">Changement d'origine</span><select v-model="capaForm.changement_origine"><option value="">—</option><option v-for="c in changements" :key="c.id" :value="c.numero">{{ c.numero }}<template v-if="c.objet"> — {{ c.objet }}</template></option></select></label>
          <label class="of-col"><span class="of-lbl">Origine</span><select v-model="capaForm.origine"><option value="">—</option><option v-for="o in ORIGINES_CAPA" :key="o" :value="o">{{ o }}</option></select></label>
          <label class="of-col"><span class="of-lbl">Type</span><select v-model="capaForm.type"><option value="">—</option><option v-for="t in TYPES_CAPA" :key="t" :value="t">{{ t }}</option></select></label>
          <label class="of-col"><span class="of-lbl">Responsable</span><input v-model="capaForm.responsable" placeholder="Responsable" /></label>
          <label class="of-col"><span class="of-lbl">Échéance</span><input v-model="capaForm.echeance" type="date" /></label>
          <label class="of-col"><span class="of-lbl">Statut</span><select v-model="capaForm.statut"><option v-for="s in STATUTS_CAPA" :key="s" :value="s">{{ s }}</option></select></label>
          <label class="of-col"><span class="of-lbl">Efficacité</span><select v-model="capaForm.efficacite"><option v-for="e in EFFICACITES" :key="e" :value="e">{{ e }}</option></select></label>
          <label class="of-col of-wide"><span class="of-lbl">Action *</span><textarea v-model="capaForm.action" rows="2" placeholder="Action corrective / préventive"></textarea></label>
        </div>
        <div v-if="capaForm.id" class="pj-box">
          <div class="pj-head">Pièces jointes</div>
          <div class="pj-list">
            <div v-for="x in pjDe('capa', capaForm.id)" :key="x.id" class="pj-item"><a :href="x.url" target="_blank" class="pj-lnk">📎 {{ x.nom }}</a><button class="pj-del" @click="supprimerPJ(x)" title="Supprimer">×</button></div>
            <label class="pj-add">+ Ajouter un fichier<input type="file" @change="e => ajouterPJ(e, 'capa', capaForm.id)" hidden /></label>
          </div>
        </div>
        <div class="q-actions"><button class="q-btn" @click="capaEnregistrer">{{ capaForm.id ? 'Mettre à jour' : 'Ajouter' }}</button><button v-if="capaForm.id" class="q-btn ghost" @click="capaReset">Annuler</button></div>
      </section>
      <section class="card">
        <div class="q-bar"><input v-model="capaRech" class="q-search" placeholder="Rechercher (N°, action, déviation)…" /><select v-model="capaFiltreStatut" class="q-filtre"><option value="">Tous les statuts</option><option v-for="s in STATUTS_CAPA" :key="s" :value="s">{{ s }}</option></select><span class="q-count">{{ capaListe.length }} CAPA</span><div class="q-exports"><button class="q-exp" @click="exportPDF" title="Exporter en PDF">📄 PDF</button><button class="q-exp" @click="exportWord" title="Exporter en Word">📝 Word</button><button class="q-exp" @click="exportExcel" title="Exporter en Excel (CSV)">📊 Excel</button></div></div>
        <div v-if="!capaListe.length" class="empty-sm">Aucune CAPA enregistrée.</div>
        <div v-else class="q-tablewrap">
          <table class="q-table">
            <thead><tr><th>N°</th><th>Date</th><th>Déviation</th><th>Type</th><th>Action</th><th>Responsable</th><th>Échéance</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              <tr v-for="c in capaListe" :key="c.id">
                <td class="qt-num">{{ c.numero || '—' }}</td><td>{{ fmtD(c.date_capa) }}</td><td>{{ c.deviation_origine || c.changement_origine || '—' }}</td>
                <td><span v-if="c.type" class="q-type" :class="c.type === 'Corrective' ? 'ty-corr' : 'ty-prev'">{{ c.type }}</span><span v-else>—</span></td>
                <td class="qt-desc" :title="c.action">{{ c.action || '—' }}</td><td>{{ c.responsable || '—' }}</td>
                <td><span :class="{ 'q-retard': estEnRetard(c) }">{{ fmtD(c.echeance) }}</span></td>
                <td><span class="q-stat" :class="'st-' + statutKey(c.statut)">{{ c.statut }}</span></td>
                <td class="qt-act"><button v-if="peutEditer" @click="capaModifier(c)" title="Modifier">✎</button><button v-if="peutEditer" @click="capaSupprimer(c)" title="Supprimer">🗑</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- ===== CHANGEMENTS ===== -->
    <div v-if="tab === 'chg'">
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-v">{{ kpiChg.total }}</div><div class="kpi-l">Total</div></div>
        <div class="kpi"><div class="kpi-v c">{{ kpiChg.encours }}</div><div class="kpi-l">En cours</div></div>
        <div class="kpi"><div class="kpi-v r">{{ kpiChg.majeurs }}</div><div class="kpi-l">Majeurs ouverts</div></div>
        <div class="kpi"><div class="kpi-v g">{{ kpiChg.cloturees }}</div><div class="kpi-l">Clôturés</div></div>
      </div>
      <section class="card" v-if="peutEditer">
        <h2 class="card-title">{{ chgForm.id ? 'Modifier le changement' : 'Nouveau changement' }}</h2>
        <div class="of-grid">
          <label class="of-col"><span class="of-lbl">N°</span><input v-model="chgForm.numero" :placeholder="prochainChg" /></label>
          <label class="of-col"><span class="of-lbl">Date</span><input v-model="chgForm.date_chg" type="date" /></label>
          <label class="of-col"><span class="of-lbl">Type</span><select v-model="chgForm.type"><option value="">—</option><option v-for="t in TYPES_CHG" :key="t" :value="t">{{ t }}</option></select></label>
          <label class="of-col"><span class="of-lbl">Responsable</span><input v-model="chgForm.responsable" placeholder="Responsable" /></label>
          <label class="of-col"><span class="of-lbl">Statut</span><select v-model="chgForm.statut"><option v-for="s in STATUTS_CHG" :key="s" :value="s">{{ s }}</option></select></label>
          <label class="of-col"><span class="of-lbl">Date clôture</span><input v-model="chgForm.date_cloture" type="date" /></label>
          <label class="of-col of-wide"><span class="of-lbl">Objet *</span><input v-model="chgForm.objet" placeholder="Objet du changement" /></label>
          <label class="of-col of-wide"><span class="of-lbl">Description</span><textarea v-model="chgForm.description" rows="2" placeholder="Description"></textarea></label>
          <label class="of-col of-wide"><span class="of-lbl">Impact</span><textarea v-model="chgForm.impact" rows="2" placeholder="Impact / évaluation"></textarea></label>
        </div>
        <div v-if="chgForm.id" class="pj-box">
          <div class="pj-head">Pièces jointes</div>
          <div class="pj-list">
            <div v-for="x in pjDe('chg', chgForm.id)" :key="x.id" class="pj-item"><a :href="x.url" target="_blank" class="pj-lnk">📎 {{ x.nom }}</a><button class="pj-del" @click="supprimerPJ(x)" title="Supprimer">×</button></div>
            <label class="pj-add">+ Ajouter un fichier<input type="file" @change="e => ajouterPJ(e, 'chg', chgForm.id)" hidden /></label>
          </div>
        </div>
        <div class="q-actions"><button class="q-btn" @click="chgEnregistrer">{{ chgForm.id ? 'Mettre à jour' : 'Ajouter' }}</button><button v-if="chgForm.id" class="q-btn ghost" @click="chgReset">Annuler</button></div>
      </section>
      <section class="card">
        <div class="q-bar"><input v-model="chgRech" class="q-search" placeholder="Rechercher (N°, objet, description)…" /><select v-model="chgFiltreStatut" class="q-filtre"><option value="">Tous les statuts</option><option v-for="s in STATUTS_CHG" :key="s" :value="s">{{ s }}</option></select><span class="q-count">{{ chgListe.length }} changement(s)</span><div class="q-exports"><button class="q-exp" @click="exportPDF" title="Exporter en PDF">📄 PDF</button><button class="q-exp" @click="exportWord" title="Exporter en Word">📝 Word</button><button class="q-exp" @click="exportExcel" title="Exporter en Excel (CSV)">📊 Excel</button></div></div>
        <div v-if="!chgListe.length" class="empty-sm">Aucun changement enregistré.</div>
        <div v-else class="q-tablewrap">
          <table class="q-table">
            <thead><tr><th>N°</th><th>Date</th><th>Objet</th><th>Type</th><th>Responsable</th><th>CAPA</th><th>Clôture</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              <tr v-for="c in chgListe" :key="c.id">
                <td class="qt-num">{{ c.numero || '—' }}</td><td>{{ fmtD(c.date_chg) }}</td><td class="qt-desc" :title="c.objet">{{ c.objet || '—' }}</td>
                <td><span v-if="c.type" class="q-type" :class="c.type === 'Majeur' ? 'ty-corr' : 'ty-prev'">{{ c.type }}</span><span v-else>—</span></td>
                <td>{{ c.responsable || '—' }}</td><td>{{ c.capa_liee || '—' }}</td><td>{{ fmtD(c.date_cloture) }}</td>
                <td><span class="q-stat" :class="'st-' + statutKey(c.statut)">{{ c.statut }}</span></td>
                <td class="qt-act"><button v-if="peutEditer && !c.capa_liee" class="lnk" @click="creerCapaDepuisChg(c)" title="Créer une CAPA">→ CAPA</button><button v-if="peutEditer" @click="chgModifier(c)" title="Modifier">✎</button><button v-if="peutEditer" @click="chgSupprimer(c)" title="Supprimer">🗑</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- ===== TABLEAU DE BORD ===== -->
    <div v-if="tab === 'dash'">
      <div class="dash-filtre">
        <label class="of-col"><span class="of-lbl">Du</span><input v-model="dashDu" type="date" /></label>
        <label class="of-col"><span class="of-lbl">Au</span><input v-model="dashAu" type="date" /></label>
        <button v-if="dashDu || dashAu" class="q-btn ghost" @click="dashDu = ''; dashAu = ''">Toute période</button>
        <button class="q-btn" style="margin-left:auto" @click="exportDashPDF">📄 Export PDF</button>
      </div>
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-v">{{ devPeriode.length }}</div><div class="kpi-l">Déviations</div></div>
        <div class="kpi"><div class="kpi-v r">{{ devPeriode.filter(d => d.criticite === 'Critique').length }}</div><div class="kpi-l">dont critiques</div></div>
        <div class="kpi"><div class="kpi-v">{{ capaPeriode.length }}</div><div class="kpi-l">CAPA</div></div>
        <div class="kpi"><div class="kpi-v r">{{ capaPeriode.filter(c => estEnRetard(c)).length }}</div><div class="kpi-l">CAPA en retard</div></div>
        <div class="kpi"><div class="kpi-v">{{ chgPeriode.length }}</div><div class="kpi-l">Changements</div></div>
      </div>
      <section class="card">
        <div class="dash-head2"><h3 class="dash-t">Évolution mensuelle (12 mois)</h3><div class="evo-leg"><span class="el dev">Déviations</span><span class="el capa">CAPA</span><span class="el chg">Changements</span></div></div>
        <div class="evo2">
          <div v-for="m in evolution" :key="m.key" class="evo2-col">
            <div class="evo2-bars">
              <div class="evo2-b dev" :style="{ height: (m.dev / evoMax * 90) + 'px' }" :title="m.dev + ' déviations'"></div>
              <div class="evo2-b capa" :style="{ height: (m.capa / evoMax * 90) + 'px' }" :title="m.capa + ' CAPA'"></div>
              <div class="evo2-b chg" :style="{ height: (m.chg / evoMax * 90) + 'px' }" :title="m.chg + ' changements'"></div>
            </div>
            <div class="evo2-lbl">{{ m.label }}</div>
          </div>
        </div>
      </section>
      <div class="dash-grid">
        <section v-for="b in blocs" :key="b.t" class="card dash-card">
          <h3 class="dash-t">{{ b.t }}</h3>
          <div v-if="!b.d.length" class="empty-sm">Aucune donnée.</div>
          <div v-else class="brk">
            <div v-for="r in b.d" :key="r.k" class="brk-row">
              <span class="brk-lbl" :title="r.k">{{ r.k }}</span>
              <div class="brk-bar"><div class="brk-fill" :style="{ width: (r.n / maxN(b.d) * 100) + '%' }"></div></div>
              <span class="brk-n">{{ r.n }}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.q-page { color: #1b2733; }
.q-alert { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 10px; padding: 10px 14px; font-size: 14px; margin-bottom: 12px; }
.q-ok { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; border-radius: 10px; padding: 10px 14px; font-size: 14px; margin-bottom: 12px; }
.q-tabs { display: inline-flex; flex-wrap: wrap; gap: 4px; background: #f1f5f9; border-radius: 10px; padding: 4px; margin-bottom: 18px; }
.q-tabs button { border: 0; background: transparent; padding: 8px 16px; border-radius: 8px; font: inherit; font-size: 13px; font-weight: 700; color: #64748b; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.q-tabs button.on { background: #fff; color: #0d9488; box-shadow: 0 1px 2px rgba(16,24,40,.08); }
.qt-n { background: #e2e8f0; color: #475569; border-radius: 999px; font-size: 10px; padding: 1px 7px; font-weight: 800; }
.q-tabs button.on .qt-n { background: #ccfbf1; color: #0f766e; }
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-bottom: 18px; }
.kpi { background: #fff; border: 1px solid #eef1f6; border-radius: 12px; padding: 14px; box-shadow: 0 1px 3px rgba(16,24,40,.04); }
.kpi-v { font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -.02em; }
.kpi-v.o { color: #d97706; } .kpi-v.c { color: #0284c7; } .kpi-v.g { color: #16a34a; } .kpi-v.r { color: #dc2626; }
.kpi-l { font-size: 11px; color: #64748b; margin-top: 3px; font-weight: 600; }
.card { background: #fff; border: 1px solid #eef1f6; border-radius: 16px; padding: 20px; box-shadow: 0 1px 3px rgba(16,24,40,.04); margin-bottom: 18px; }
.card-title { font-size: 15px; font-weight: 800; color: #0f172a; margin: 0 0 14px; }
.of-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px 12px; align-items: start; }
.of-col { display: flex; flex-direction: column; gap: 4px; }
.of-col.of-wide { grid-column: 1 / -1; }
.of-lbl { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .03em; color: #94a3b8; }
.of-col input, .of-col select, .of-col textarea { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; color: #1b2733; width: 100%; box-sizing: border-box; resize: vertical; }
.q-actions { margin-top: 14px; display: flex; gap: 8px; }
.q-btn { background: #0d9488; color: #fff; border: 0; border-radius: 8px; padding: 9px 18px; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
.q-btn:hover { background: #0f766e; }
.q-btn.ghost { background: #fff; color: #475569; border: 1px solid #cbd5e1; }
.q-btn.ghost:hover { background: #f8fafc; }
.q-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.q-search { flex: 1; min-width: 180px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; }
.q-filtre { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; font-weight: 600; }
.q-count { font-size: 12px; color: #94a3b8; font-weight: 700; }
.empty-sm { color: #94a3b8; font-size: 13px; padding: 12px 2px; }
.q-tablewrap { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 10px; }
.q-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; }
.q-table th { background: #f8fafc; color: #475569; padding: 9px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; white-space: nowrap; }
.q-table td { padding: 9px 12px; border-top: 1px solid #f1f5f9; white-space: nowrap; }
.q-table tbody tr:hover td { background: #f0fdfa; }
.qt-num { font-weight: 700; color: #0f172a; }
.qt-desc { max-width: 280px; overflow: hidden; text-overflow: ellipsis; }
.q-crit, .q-type, .q-stat { font-size: 10.5px; font-weight: 800; padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
.crit-mineure { background: #dcfce7; color: #16a34a; }
.crit-majeure { background: #ffedd5; color: #ea580c; }
.crit-critique { background: #fee2e2; color: #dc2626; }
.ty-corr { background: #fee2e2; color: #dc2626; }
.ty-prev { background: #dbeafe; color: #0284c7; }
.q-stat.st-ouverte { background: #fef3c7; color: #b45309; }
.q-stat.st-cours { background: #dbeafe; color: #0284c7; }
.q-stat.st-approuve { background: #e0e7ff; color: #4338ca; }
.q-stat.st-realisee { background: #d1fae5; color: #059669; }
.q-stat.st-cloturee { background: #dcfce7; color: #16a34a; }
.q-stat.st-autre { background: #f1f5f9; color: #64748b; }
.q-retard { color: #dc2626; font-weight: 800; }
.qt-act { text-align: right; white-space: nowrap; }
.qt-act button { border: 1px solid #e2e8f0; background: #fff; border-radius: 6px; padding: 3px 7px; cursor: pointer; font-size: 12px; margin-left: 4px; }
.qt-act button:hover { background: #f1f5f9; }
.qt-act .lnk { color: #7c3aed; border-color: #ddd6fe; font-weight: 700; }
.qt-act .lnk:hover { background: #f5f3ff; }
.q-alertes { background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 14px 16px; margin-bottom: 18px; }
.qa-head { font-size: 12px; font-weight: 800; color: #92400e; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 10px; }
.qa-row { display: flex; align-items: center; gap: 8px; padding: 6px 2px; border-top: 1px solid #fef3c7; font-size: 13px; }
.qa-tag { font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
.qa-row.qa-rouge .qa-tag { background: #fee2e2; color: #dc2626; }
.qa-row.qa-ambre .qa-tag { background: #fef3c7; color: #b45309; }
.qa-num { font-weight: 700; color: #0f172a; white-space: nowrap; }
.qa-txt { color: #475569; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
.qa-detail { font-size: 11.5px; font-weight: 700; white-space: nowrap; }
.qa-row.qa-rouge .qa-detail { color: #dc2626; }
.qa-row.qa-ambre .qa-detail { color: #b45309; }
.q-exports { display: inline-flex; gap: 6px; }
.q-exp { border: 1px solid #cbd5e1; background: #fff; border-radius: 7px; padding: 6px 11px; font: inherit; font-size: 12.5px; font-weight: 600; color: #475569; cursor: pointer; }
.q-exp:hover { background: #f8fafc; border-color: #94a3b8; }
.dash-filtre { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
.dash-filtre .of-col { min-width: 140px; }
.dash-filtre input { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; }
.dash-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 16px; }
.dash-card { margin-bottom: 0; }
.dash-t { font-size: 13px; font-weight: 800; color: #0f172a; margin: 0 0 12px; }
.brk { display: flex; flex-direction: column; gap: 7px; }
.brk-row { display: flex; align-items: center; gap: 8px; }
.brk-lbl { font-size: 12px; color: #475569; font-weight: 600; width: 115px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 0; }
.brk-bar { flex: 1; height: 16px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
.brk-fill { height: 100%; background: linear-gradient(90deg, #14b8a6, #0d9488); border-radius: 4px; }
.brk-n { font-size: 12px; font-weight: 800; color: #0f172a; width: 28px; text-align: right; flex-shrink: 0; }
.dash-head2 { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; }
.evo-leg { display: inline-flex; gap: 12px; font-size: 11px; font-weight: 700; }
.el { display: inline-flex; align-items: center; gap: 5px; color: #475569; }
.el::before { content: ''; width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
.el.dev::before { background: #6366f1; } .el.capa::before { background: #0d9488; } .el.chg::before { background: #f59e0b; }
.evo2 { display: flex; align-items: flex-end; gap: 6px; height: 122px; overflow-x: auto; }
.evo2-col { flex: 1; min-width: 34px; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.evo2-bars { display: flex; align-items: flex-end; gap: 2px; height: 94px; }
.evo2-b { width: 7px; border-radius: 2px 2px 0 0; min-height: 1px; transition: height .3s ease; }
.evo2-b.dev { background: #6366f1; } .evo2-b.capa { background: #0d9488; } .evo2-b.chg { background: #f59e0b; }
.evo2-lbl { font-size: 9px; color: #94a3b8; font-weight: 700; white-space: nowrap; }
.pj-box { margin-top: 14px; padding-top: 14px; border-top: 1px solid #f1f5f9; }
.pj-head { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .03em; color: #94a3b8; margin-bottom: 8px; }
.pj-list { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.pj-item { display: inline-flex; align-items: center; gap: 4px; background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 4px 8px; font-size: 12px; }
.pj-lnk { color: #0f766e; text-decoration: none; font-weight: 600; }
.pj-lnk:hover { text-decoration: underline; }
.pj-del { border: 0; background: transparent; color: #dc2626; cursor: pointer; font-size: 14px; padding: 0; line-height: 1; }
.pj-add { background: #eef2ff; color: #4338ca; border: 1px dashed #c7d2fe; border-radius: 8px; padding: 5px 11px; font-size: 12.5px; font-weight: 700; cursor: pointer; }
.pj-add:hover { background: #e0e7ff; }
.acr-box { margin-top: 14px; padding-top: 14px; border-top: 1px solid #f1f5f9; }
.acr-toggle { background: #faf5ff; color: #7c3aed; border: 1px solid #e9d5ff; border-radius: 9px; padding: 9px 16px; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.acr-toggle:hover { background: #f3e8ff; }
.acr-ch { font-size: 10px; }
.acr-body { margin-top: 14px; }
.ish-wrap { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 10px; background: #fff; padding: 8px; margin-bottom: 14px; }
.ish-svg { width: 100%; min-width: 620px; height: auto; display: block; }
.ish-head-t { font-size: 11px; font-weight: 800; fill: #0f766e; }
.ish-head-t2 { font-size: 9px; font-weight: 700; fill: #0d9488; }
.ish-m-t { font-size: 10px; font-weight: 800; fill: #fff; }
.ish-c-t { font-size: 9px; fill: #475569; }
.ish-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 16px; }
.ish-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; }
.ish-m { font-size: 11px; font-weight: 800; color: #4338ca; margin-bottom: 7px; }
.ish-causes { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 7px; }
.ish-chip { background: #ede9fe; color: #6d28d9; font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 999px; display: inline-flex; align-items: center; gap: 3px; }
.ish-chip button { border: 0; background: transparent; color: #6d28d9; cursor: pointer; font-size: 12px; padding: 0; line-height: 1; }
.ish-input { width: 100%; box-sizing: border-box; padding: 6px 9px; border: 1px solid #cbd5e1; border-radius: 7px; font: inherit; font-size: 12px; }
.ish-lib { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 7px; }
.ish-sugg { background: #fff; color: #64748b; border: 1px dashed #cbd5e1; font-size: 10.5px; font-weight: 600; padding: 2px 7px; border-radius: 999px; cursor: pointer; }
.ish-sugg:hover { background: #ede9fe; color: #6d28d9; border-color: #c4b5fd; }
.pq-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; margin-bottom: 14px; }
.pq-head { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .03em; color: #94a3b8; margin-bottom: 10px; }
.pq-row { display: flex; align-items: center; gap: 10px; margin-bottom: 7px; }
.pq-n { font-size: 12px; font-weight: 700; color: #7c3aed; width: 92px; flex-shrink: 0; }
.pq-input { flex: 1; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 7px; font: inherit; font-size: 13px; }
.acr-racine { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
.acr-racine textarea { padding: 9px 11px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; resize: vertical; }
.acr-actions { display: flex; gap: 8px; }
.ia-box { margin-bottom: 14px; }
.ia-btn { background: linear-gradient(90deg, #8b5cf6, #6366f1); color: #fff; border: 0; border-radius: 9px; padding: 10px 18px; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.ia-btn:hover:not(:disabled) { opacity: .92; }
.ia-btn:disabled { opacity: .6; cursor: wait; }
.ia-result { margin-top: 12px; background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 10px; padding: 14px; }
.ia-h { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .03em; color: #7c3aed; margin-bottom: 8px; }
.ia-line { font-size: 13px; color: #475569; margin-bottom: 6px; }
.ia-line b { color: #0f172a; }
.ia-ul { margin: 4px 0 0; padding-left: 18px; }
.ia-ul li { margin: 2px 0; }
.ia-actions { display: flex; gap: 8px; margin-top: 10px; }
</style>
