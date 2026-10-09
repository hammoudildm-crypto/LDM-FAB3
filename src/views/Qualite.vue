<script setup>
import { ref, reactive, computed, onMounted, inject } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'

const peutEditer = inject('peutEditer', ref(false))
const erreur = ref('')
const message = ref('')
const tab = ref('dev')

const CRITICITES = ['Mineure', 'Majeure', 'Critique']
const STATUTS_DEV = ['Ouverte', 'En cours', 'Clôturée']
const ORIGINES_CAPA = ['Déviation', 'Audit', 'Réclamation', 'Autre']
const TYPES_CAPA = ['Corrective', 'Préventive']
const STATUTS_CAPA = ['Ouverte', 'En cours', 'Réalisée', 'Clôturée']
const EFFICACITES = ['Non vérifiée', 'Vérifiée', 'Non applicable']
const TYPES_CHG = ['Mineur', 'Majeur']
const STATUTS_CHG = ['Demandé', 'Approuvé', 'Réalisé', 'Clôturé']

const deviations = ref([])
const capa = ref([])
const changements = ref([])

const devForm = reactive({ id: null, numero: '', date_dev: new Date().toISOString().slice(0, 10), produit_lot: '', criticite: '', type: '', description: '', origine: '', responsable: '', statut: 'Ouverte', capa_liee: '' })
const capaForm = reactive({ id: null, numero: '', date_capa: new Date().toISOString().slice(0, 10), deviation_origine: '', origine: '', type: '', action: '', responsable: '', echeance: '', statut: 'Ouverte', efficacite: 'Non vérifiée' })
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
function devReset() { Object.assign(devForm, { id: null, numero: '', date_dev: new Date().toISOString().slice(0, 10), produit_lot: '', criticite: '', type: '', description: '', origine: '', responsable: '', statut: 'Ouverte', capa_liee: '' }) }
async function devEnregistrer() {
  erreur.value = ''; message.value = ''
  if (!devForm.description.trim()) { erreur.value = 'La description est obligatoire.'; return }
  const payload = { numero: (devForm.numero || prochainDev.value).trim(), date_dev: devForm.date_dev || null, produit_lot: devForm.produit_lot || null, criticite: devForm.criticite || null, type: devForm.type || null, description: devForm.description.trim(), origine: devForm.origine || null, responsable: devForm.responsable || null, statut: devForm.statut || 'Ouverte', capa_liee: devForm.capa_liee || null }
  const r = devForm.id ? await supabase.from('deviations').update(payload).eq('id', devForm.id) : await supabase.from('deviations').insert(payload)
  if (r.error) { erreur.value = r.error.message; return }
  message.value = devForm.id ? 'Déviation mise à jour.' : 'Déviation enregistrée.'; devReset(); await charger()
}
function devModifier(d) { Object.assign(devForm, { id: d.id, numero: d.numero || '', date_dev: d.date_dev || '', produit_lot: d.produit_lot || '', criticite: d.criticite || '', type: d.type || '', description: d.description || '', origine: d.origine || '', responsable: d.responsable || '', statut: d.statut || 'Ouverte', capa_liee: d.capa_liee || '' }); tab.value = 'dev'; window.scrollTo({ top: 0, behavior: 'smooth' }) }
async function devSupprimer(d) { if (!confirm('Supprimer la déviation ' + (d.numero || '') + ' ?')) return; const r = await supabase.from('deviations').delete().eq('id', d.id); if (r.error) { erreur.value = r.error.message; return } await charger() }
function creerCapaDepuisDev(d) { capaReset(); capaForm.deviation_origine = d.numero || ''; capaForm.origine = 'Déviation'; capaForm.action = 'Suite à déviation ' + (d.numero || '') + (d.produit_lot ? ' (' + d.produit_lot + ')' : ''); tab.value = 'capa'; window.scrollTo({ top: 0, behavior: 'smooth' }) }

// ---- CAPA ----
function capaReset() { Object.assign(capaForm, { id: null, numero: '', date_capa: new Date().toISOString().slice(0, 10), deviation_origine: '', origine: '', type: '', action: '', responsable: '', echeance: '', statut: 'Ouverte', efficacite: 'Non vérifiée' }) }
async function capaEnregistrer() {
  erreur.value = ''; message.value = ''
  if (!capaForm.action.trim()) { erreur.value = "L'action est obligatoire."; return }
  const payload = { numero: (capaForm.numero || prochainCapa.value).trim(), date_capa: capaForm.date_capa || null, deviation_origine: capaForm.deviation_origine || null, origine: capaForm.origine || null, type: capaForm.type || null, action: capaForm.action.trim(), responsable: capaForm.responsable || null, echeance: capaForm.echeance || null, statut: capaForm.statut || 'Ouverte', efficacite: capaForm.efficacite || null }
  const r = capaForm.id ? await supabase.from('capa').update(payload).eq('id', capaForm.id) : await supabase.from('capa').insert(payload)
  if (r.error) { erreur.value = r.error.message; return }
  if (payload.deviation_origine && payload.numero) {
    const dev = deviations.value.find(x => x.numero === payload.deviation_origine)
    if (dev && dev.capa_liee !== payload.numero) await supabase.from('deviations').update({ capa_liee: payload.numero }).eq('id', dev.id)
  }
  message.value = capaForm.id ? 'CAPA mise à jour.' : 'CAPA enregistrée.'; capaReset(); await charger()
}
function capaModifier(c) { Object.assign(capaForm, { id: c.id, numero: c.numero || '', date_capa: c.date_capa || '', deviation_origine: c.deviation_origine || '', origine: c.origine || '', type: c.type || '', action: c.action || '', responsable: c.responsable || '', echeance: c.echeance || '', statut: c.statut || 'Ouverte', efficacite: c.efficacite || 'Non vérifiée' }); tab.value = 'capa'; window.scrollTo({ top: 0, behavior: 'smooth' }) }
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
</script>

<template>
  <div class="q-page">
    <PageHeader title="Qualité" tone="teal" subtitle="Déviations, CAPA et changements." />
    <p v-if="erreur" class="q-alert">{{ erreur }}</p>
    <p v-if="message" class="q-ok">{{ message }}</p>

    <div class="q-tabs">
      <button :class="{ on: tab === 'dev' }" @click="tab = 'dev'">Déviations <span class="qt-n">{{ kpiDev.total }}</span></button>
      <button :class="{ on: tab === 'capa' }" @click="tab = 'capa'">CAPA <span class="qt-n">{{ kpiCapa.total }}</span></button>
      <button :class="{ on: tab === 'chg' }" @click="tab = 'chg'">Changements <span class="qt-n">{{ kpiChg.total }}</span></button>
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
          <label class="of-col"><span class="of-lbl">Criticité</span><select v-model="devForm.criticite"><option value="">—</option><option v-for="c in CRITICITES" :key="c" :value="c">{{ c }}</option></select></label>
          <label class="of-col"><span class="of-lbl">Type</span><input v-model="devForm.type" placeholder="Type de déviation" /></label>
          <label class="of-col"><span class="of-lbl">Origine</span><input v-model="devForm.origine" placeholder="Origine / cause" /></label>
          <label class="of-col"><span class="of-lbl">Responsable</span><input v-model="devForm.responsable" placeholder="Responsable" /></label>
          <label class="of-col"><span class="of-lbl">Statut</span><select v-model="devForm.statut"><option v-for="s in STATUTS_DEV" :key="s" :value="s">{{ s }}</option></select></label>
          <label class="of-col"><span class="of-lbl">CAPA liée</span><select v-model="devForm.capa_liee"><option value="">—</option><option v-for="c in capa" :key="c.id" :value="c.numero">{{ c.numero }}</option></select></label>
          <label class="of-col of-wide"><span class="of-lbl">Description *</span><textarea v-model="devForm.description" rows="2" placeholder="Description de la déviation"></textarea></label>
        </div>
        <div class="q-actions"><button class="q-btn" @click="devEnregistrer">{{ devForm.id ? 'Mettre à jour' : 'Ajouter' }}</button><button v-if="devForm.id" class="q-btn ghost" @click="devReset">Annuler</button></div>
      </section>
      <section class="card">
        <div class="q-bar"><input v-model="devRech" class="q-search" placeholder="Rechercher (N°, lot, description)…" /><select v-model="devFiltreStatut" class="q-filtre"><option value="">Tous les statuts</option><option v-for="s in STATUTS_DEV" :key="s" :value="s">{{ s }}</option></select><span class="q-count">{{ devListe.length }} déviation(s)</span></div>
        <div v-if="!devListe.length" class="empty-sm">Aucune déviation enregistrée.</div>
        <div v-else class="q-tablewrap">
          <table class="q-table">
            <thead><tr><th>N°</th><th>Date</th><th>Produit/Lot</th><th>Criticité</th><th>Description</th><th>Responsable</th><th>CAPA</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              <tr v-for="d in devListe" :key="d.id">
                <td class="qt-num">{{ d.numero || '—' }}</td><td>{{ fmtD(d.date_dev) }}</td><td>{{ d.produit_lot || '—' }}</td>
                <td><span v-if="d.criticite" class="q-crit" :class="'crit-' + d.criticite.toLowerCase()">{{ d.criticite }}</span><span v-else>—</span></td>
                <td class="qt-desc" :title="d.description">{{ d.description || '—' }}</td><td>{{ d.responsable || '—' }}</td><td>{{ d.capa_liee || '—' }}</td>
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
          <label class="of-col"><span class="of-lbl">Origine</span><select v-model="capaForm.origine"><option value="">—</option><option v-for="o in ORIGINES_CAPA" :key="o" :value="o">{{ o }}</option></select></label>
          <label class="of-col"><span class="of-lbl">Type</span><select v-model="capaForm.type"><option value="">—</option><option v-for="t in TYPES_CAPA" :key="t" :value="t">{{ t }}</option></select></label>
          <label class="of-col"><span class="of-lbl">Responsable</span><input v-model="capaForm.responsable" placeholder="Responsable" /></label>
          <label class="of-col"><span class="of-lbl">Échéance</span><input v-model="capaForm.echeance" type="date" /></label>
          <label class="of-col"><span class="of-lbl">Statut</span><select v-model="capaForm.statut"><option v-for="s in STATUTS_CAPA" :key="s" :value="s">{{ s }}</option></select></label>
          <label class="of-col"><span class="of-lbl">Efficacité</span><select v-model="capaForm.efficacite"><option v-for="e in EFFICACITES" :key="e" :value="e">{{ e }}</option></select></label>
          <label class="of-col of-wide"><span class="of-lbl">Action *</span><textarea v-model="capaForm.action" rows="2" placeholder="Action corrective / préventive"></textarea></label>
        </div>
        <div class="q-actions"><button class="q-btn" @click="capaEnregistrer">{{ capaForm.id ? 'Mettre à jour' : 'Ajouter' }}</button><button v-if="capaForm.id" class="q-btn ghost" @click="capaReset">Annuler</button></div>
      </section>
      <section class="card">
        <div class="q-bar"><input v-model="capaRech" class="q-search" placeholder="Rechercher (N°, action, déviation)…" /><select v-model="capaFiltreStatut" class="q-filtre"><option value="">Tous les statuts</option><option v-for="s in STATUTS_CAPA" :key="s" :value="s">{{ s }}</option></select><span class="q-count">{{ capaListe.length }} CAPA</span></div>
        <div v-if="!capaListe.length" class="empty-sm">Aucune CAPA enregistrée.</div>
        <div v-else class="q-tablewrap">
          <table class="q-table">
            <thead><tr><th>N°</th><th>Date</th><th>Déviation</th><th>Type</th><th>Action</th><th>Responsable</th><th>Échéance</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              <tr v-for="c in capaListe" :key="c.id">
                <td class="qt-num">{{ c.numero || '—' }}</td><td>{{ fmtD(c.date_capa) }}</td><td>{{ c.deviation_origine || '—' }}</td>
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
        <div class="q-actions"><button class="q-btn" @click="chgEnregistrer">{{ chgForm.id ? 'Mettre à jour' : 'Ajouter' }}</button><button v-if="chgForm.id" class="q-btn ghost" @click="chgReset">Annuler</button></div>
      </section>
      <section class="card">
        <div class="q-bar"><input v-model="chgRech" class="q-search" placeholder="Rechercher (N°, objet, description)…" /><select v-model="chgFiltreStatut" class="q-filtre"><option value="">Tous les statuts</option><option v-for="s in STATUTS_CHG" :key="s" :value="s">{{ s }}</option></select><span class="q-count">{{ chgListe.length }} changement(s)</span></div>
        <div v-if="!chgListe.length" class="empty-sm">Aucun changement enregistré.</div>
        <div v-else class="q-tablewrap">
          <table class="q-table">
            <thead><tr><th>N°</th><th>Date</th><th>Objet</th><th>Type</th><th>Responsable</th><th>Clôture</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              <tr v-for="c in chgListe" :key="c.id">
                <td class="qt-num">{{ c.numero || '—' }}</td><td>{{ fmtD(c.date_chg) }}</td><td class="qt-desc" :title="c.objet">{{ c.objet || '—' }}</td>
                <td><span v-if="c.type" class="q-type" :class="c.type === 'Majeur' ? 'ty-corr' : 'ty-prev'">{{ c.type }}</span><span v-else>—</span></td>
                <td>{{ c.responsable || '—' }}</td><td>{{ fmtD(c.date_cloture) }}</td>
                <td><span class="q-stat" :class="'st-' + statutKey(c.statut)">{{ c.statut }}</span></td>
                <td class="qt-act"><button v-if="peutEditer" @click="chgModifier(c)" title="Modifier">✎</button><button v-if="peutEditer" @click="chgSupprimer(c)" title="Supprimer">🗑</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
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
</style>
