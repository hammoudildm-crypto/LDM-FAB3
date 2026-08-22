<script setup>
import { ref, computed, onMounted, inject, watch } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'
import MiniChart from '../components/MiniChart.vue'
import { ICONS, TINTS } from '../icons.js'

const peutEditer = inject('peutEditer', ref(false))
const role = inject('role', ref(null))
const estAdmin = computed(() => role.value === 'admin')

const anneeCourante = new Date().getFullYear()
const ANNEES = []
for (let a = anneeCourante - 4; a <= anneeCourante + 1; a++) ANNEES.push(a)
const STATUTS_PRODUITS = ['Terminé', 'Libéré'] // lots produits = sujets à vérification
const LIMITE = 300

const lots = ref([])
const phases = ref([])
const msg = ref('')
const anneeSel = ref(anneeCourante) // par défaut : année en cours (0 = toutes)
const verifEnCours = ref(null)
const vForm = ref({ verificateur: '', date: new Date().toISOString().slice(0, 10), avec_reserve: false })
const superviseurChoix = ref('')
const CLE_SUP = 'prodtrack-vd-superviseurs'
let supInit = []
try { const raw = JSON.parse(localStorage.getItem(CLE_SUP) || '[]'); if (Array.isArray(raw)) supInit = raw } catch (e) {}
const supSuivis = ref(supInit)      // superviseurs à suivre (vide = tous), mémorisé
watch(supSuivis, (v) => { try { localStorage.setItem(CLE_SUP, JSON.stringify(v)) } catch (e) {} }, { deep: true })
const filtreSupOuvert = ref(false)
const nouveauSuperviseur = ref('')
const supList = ref([])  // superviseurs gérés dans Référentiels (noms)
const planRaw = ref([])  // plan de production (PDP)
const histRecherche = ref('')
const histDu = ref('')
const histAu = ref('')

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

async function charger() {
  msg.value = ''
  const r = await fetchAllPaged(() => supabase.from('ordres_fabrication')
    .select('id, numero_lot, statut, en_triage, triage_fin, date_lancement, date_fin_fabrication, ddl_verifie, ddl_verificateur, ddl_date_verification, ddl_reserve, produits(designation, code_pf, gamme)')
    .eq('actif', true)
    .order('date_lancement', { ascending: false, nullsFirst: false }).order('id', { ascending: false }))
  if (r.error) { msg.value = r.error.message; return }
  lots.value = r.data
  const rp = await fetchAllPaged(() => supabase.from('suivi_phases').select('ordre_id, phase, statut, date_phase, date_debut').eq('actif', true))
  if (!rp.error) phases.value = rp.data
  const rs = await supabase.from('superviseurs').select('nom').order('nom')
  if (!rs.error) supList.value = rs.data.map(s => s.nom)
  const rpp = await fetchAllPaged(() => supabase.from('plan_production').select('annee, mois, quantite_planifiee, produits(taille_lot)'))
  if (!rpp.error) planRaw.value = rpp.data
}
onMounted(charger)

const anYear = (d) => d ? new Date(d).getFullYear() : null
const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

const CANON_FAB = ['Pesée', 'Granulation et Séchage', 'Mélange', 'Compression', 'Remplissage Gélules', 'Pelliculage']
function phaseKey(nom) {
  const t = String(nom || '').trim().toLowerCase()
  if (!t) return null
  if (/pes[ée]|balance/.test(t)) return 'pesee'
  if (/granul|s[ée]ch/.test(t)) return 'granulation'
  if (/m[ée]lang/.test(t)) return 'melange'
  if (/compress|comprim/.test(t)) return 'compression'
  if (/g[ée]lule|remplis|encapsul/.test(t)) return 'remplissage'
  if (/pellicul|enrob/.test(t)) return 'pelliculage'
  if (/condition/.test(t)) return 'conditionnement'
  return t
}
const rangSt = (st) => st === 'Terminé' ? 3 : st === 'En cours' ? 2 : 1
const phasesParLot = computed(() => {
  const m = {}
  for (const sp of phases.value) {
    const k = phaseKey(sp.phase)
    if (!k) continue
    if (!m[sp.ordre_id]) m[sp.ordre_id] = {}
    const cur = m[sp.ordre_id][k]
    // clé fusionnée : garder le MOINS avancé (finie seulement si tout est fini)
    if (!cur || rangSt(sp.statut) < rangSt(cur.statut)) m[sp.ordre_id][k] = { statut: sp.statut, date: sp.date_phase || sp.date_debut }
  }
  return m
})
// Date de fin de fabrication : la date renseignée, sinon la date de la DERNIÈRE phase de gamme si Terminé
function dateFinFab(l) {
  const pl = phasesParLot.value[l.id] || {}
  const gB = (l.produits && Array.isArray(l.produits.gamme) && l.produits.gamme.length) ? l.produits.gamme : CANON_FAB
  const g = []; let pk = null
  for (const ph of gB) { const k = phaseKey(ph); if (k && k === pk) continue; g.push(ph); pk = k }
  if (g.length === 0) return null
  // STRICT : dossier prêt SEULEMENT si CHAQUE phase de la gamme est saisie ET Terminé (étape finale incluse).
  let derniere = null
  for (const ph of g) {
    const rec = pl[phaseKey(ph)]
    if (!rec || rec.statut !== 'Terminé') return null
    if (rec.date) derniere = rec.date
  }
  return derniere || l.date_fin_fabrication || null
}
function dateDDL(l) { return dateFinFab(l) || (l.ddl_verifie ? (l.date_fin_fabrication || l.date_lancement) : null) }
const produits = computed(() => lots.value.filter(l => {
  const d = dateDDL(l)
  return d && (anneeSel.value === 0 || anYear(d) === anneeSel.value)
}))
const verifies = computed(() => produits.value.filter(l => l.ddl_verifie))
const attente = computed(() => produits.value.filter(l => !l.ddl_verifie).sort((a, b) => String(a.numero_lot || '').localeCompare(String(b.numero_lot || ''), undefined, { numeric: true })))
const kpiQualite = computed(() => {
  const subj = produits.value
  const total = subj.length
  // BRFT : ni triage, ni rejeté, ni déviation (réserve)
  const brftOk = subj.filter(l => {
    const enTriage = !!l.en_triage && !l.triage_fin
    const rejete = /rejet|rebut/i.test(l.statut || '')
    const deviation = !!l.ddl_reserve
    return !enTriage && !rejete && !deviation
  }).length
  // BRRFT : DDL vérifiés sans réserve / DDL vérifiés
  const verif = subj.filter(l => l.ddl_verifie)
  const brrftOk = verif.filter(l => !l.ddl_reserve).length
  return {
    total, brftOk, nbVerif: verif.length, brrftOk,
    brft: total > 0 ? Math.round(brftOk / total * 1000) / 10 : null,
    brrft: verif.length > 0 ? Math.round(brrftOk / verif.length * 1000) / 10 : null
  }
})
function clsKpi(v) { return v == null ? '' : (v >= 95 ? 'ok' : (v >= 85 ? 'warn' : 'bad')) }
const triageIds = computed(() => new Set(lots.value.filter(l => !!l.en_triage && !l.triage_fin).map(l => l.id)))
const attenteParMois = computed(() => {
  const a = Array(12).fill(0)
  for (const l of attente.value) {
    const d = dateFinFab(l)
    if (d) a[new Date(d).getMonth()]++
  }
  return a
})
const MOIS_LONG = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const moisSel = ref(null)
function ouvrirMois(i) { moisSel.value = i }
const lotsDuMois = computed(() => {
  if (moisSel.value == null) return []
  return attente.value.filter(l => { const d = dateFinFab(l); return d && new Date(d).getMonth() === moisSel.value })
})
const verifParMois = computed(() => {
  const a = Array(12).fill(0)
  for (const l of lots.value) {
    if (!l.ddl_verifie || !l.ddl_date_verification) continue
    const d = new Date(l.ddl_date_verification)
    if (anneeSel.value && d.getFullYear() !== anneeSel.value) continue
    a[d.getMonth()]++
  }
  return a
})

const nbVerifies = computed(() => verifies.value.length)
const nbAttente = computed(() => attente.value.length)
const taux = computed(() => {
  const tot = nbVerifies.value + nbAttente.value
  return tot > 0 ? (nbVerifies.value / tot) * 100 : null
})
const planDDL = computed(() => {
  const an = anneeSel.value
  let n = 0
  for (const r of planRaw.value) {
    if (an && Number(r.annee) !== an) continue
    const t = Number(r.produits ? r.produits.taille_lot : 0) || 0
    if (t > 0) n += Number(r.quantite_planifiee || 0) / t
  }
  return Math.round(n)
})
const tauxPlanDDL = computed(() => planDDL.value > 0 ? Math.round((nbVerifies.value / planDDL.value) * 100) : null)
const moisCourant = new Date().getMonth() + 1
const objectifMois = computed(() => {
  const an = anneeSel.value || new Date().getFullYear()
  let n = 0
  for (const r of planRaw.value) {
    if (Number(r.annee) !== an || Number(r.mois) !== moisCourant) continue
    const t = Number(r.produits ? r.produits.taille_lot : 0) || 0
    if (t > 0) n += Number(r.quantite_planifiee || 0) / t
  }
  return Math.round(n)
})
const verifMois = computed(() => {
  const an = anneeSel.value || new Date().getFullYear()
  return verifies.value.filter(l => {
    const d = l.ddl_date_verification ? new Date(l.ddl_date_verification) : null
    return d && d.getFullYear() === an && (d.getMonth() + 1) === moisCourant
  }).length
})
const tauxMois = computed(() => objectifMois.value > 0 ? Math.round((verifMois.value / objectifMois.value) * 100) : null)

const parSuperviseur = computed(() => {
  const m = {}
  for (const l of produits.value) {
    const k = l.ddl_verificateur
    if (!k) continue
    if (!m[k]) m[k] = { nom: k, assignes: 0, verifies: 0 }
    m[k].assignes++
    if (l.ddl_verifie) m[k].verifies++
  }
  return Object.values(m)
    .map(x => ({ ...x, taux: x.assignes ? (x.verifies / x.assignes) * 100 : 0 }))
    .sort((a, b) => b.assignes - a.assignes)
})

const parSuperviseurFiltre = computed(() => {
  if (!supSuivis.value.length) return parSuperviseur.value
  return parSuperviseur.value.filter(s => supSuivis.value.includes(s.nom))
})

const superviseurs = computed(() => {
  const s = new Set()
  for (const nom of supList.value) if (nom) s.add(nom)
  for (const l of lots.value) if (l.ddl_verificateur) s.add(l.ddl_verificateur)
  return [...s].sort()
})

const verifiesFiltres = computed(() => {
  const q = histRecherche.value.trim().toLowerCase()
  const du = histDu.value, au = histAu.value
  return verifies.value.filter(l => {
    const d = l.ddl_date_verification ? String(l.ddl_date_verification).slice(0, 10) : ''
    if (du && (!d || d < du)) return false
    if (au && (!d || d > au)) return false
    if (q) {
      const lot = String(l.numero_lot || '').toLowerCase()
      const sup = String(l.ddl_verificateur || '').toLowerCase()
      const nom = prodNom(l).toLowerCase()
      const code = (l.produits && l.produits.code_pf ? l.produits.code_pf : '').toLowerCase()
      if (!(lot.includes(q) || sup.includes(q) || nom.includes(q) || code.includes(q))) return false
    }
    return true
  })
})
const verifiesAffiches = computed(() => [...verifiesFiltres.value]
  .sort((a, b) => String(b.ddl_date_verification || '').localeCompare(String(a.ddl_date_verification || '')))
  .slice(0, LIMITE))

function prodNom(l) { return l.produits?.designation || l.produits?.code_pf || '—' }
function fmt(n) { return (n == null ? '—' : Number(n).toLocaleString('fr-FR')) }
function fmtPct(p) { return (p == null ? '—' : p.toFixed(1) + ' %') }
function fmtDate(d) {
  if (!d) return '—'
  const x = new Date(d); if (isNaN(x)) return '—'
  return (/[T ]\d{2}:/.test(String(d)) ? x.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + ' ' : '') + x.toLocaleDateString('fr-FR')
}
function exporterHistoriqueCSV() {
  const list = [...verifiesFiltres.value].sort((a, b) =>
    String(b.ddl_date_verification || '').localeCompare(String(a.ddl_date_verification || '')))
  const rows = [['Lot', 'Code produit', 'Produit', 'Vérificateur', 'Date vérification']]
  for (const l of list) rows.push([
    l.numero_lot || '', (l.produits && l.produits.code_pf) || '', prodNom(l),
    l.ddl_verificateur || '', fmtDate(l.ddl_date_verification)
  ])
  const csv = rows.map(r => r.map(c => {
    const v = String(c == null ? '' : c)
    return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v
  }).join(';')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'historique_ddl_' + new Date().toISOString().slice(0, 10) + '.csv'
  a.click(); URL.revokeObjectURL(url)
}

function ouvrir(l) {
  verifEnCours.value = l.id
  const d = l.ddl_date_verification ? String(l.ddl_date_verification).slice(0, 10) : new Date().toISOString().slice(0, 10)
  vForm.value = { verificateur: l.ddl_verificateur || '', date: d, avec_reserve: !!l.ddl_reserve }
  superviseurChoix.value = l.ddl_verificateur || ''
  nouveauSuperviseur.value = ''
  msg.value = ''
}

async function reserverVerif(l, nom) {
  const r = await supabase.from('ordres_fabrication').update({ ddl_verificateur: nom || null }).eq('id', l.id)
  if (r.error) { msg.value = r.error.message; return }
  await charger()
}
async function valider(l) {
  msg.value = ''
  const nom = (superviseurChoix.value === '__autre__' ? nouveauSuperviseur.value : superviseurChoix.value).trim()
  if (!nom) { msg.value = 'Choisis ou saisis le nom du vérificateur.'; return }
  const r = await supabase.from('ordres_fabrication').update({
    ddl_verifie: true,
    ddl_reserve: !!vForm.value.avec_reserve,
    ddl_verificateur: nom,
    ddl_date_verification: vForm.value.date || null
  }).eq('id', l.id)
  if (r.error) { msg.value = r.error.message; return }
  verifEnCours.value = null
  await charger()
}

async function devalider(l) {
  if (!confirm(`Annuler la vérification du lot ${l.numero_lot} ?`)) return
  const r = await supabase.from('ordres_fabrication').update({
    ddl_verifie: false, ddl_verificateur: null, ddl_date_verification: null
  }).eq('id', l.id)
  if (r.error) { msg.value = r.error.message; return }
  await charger()
}
</script>

<template>
  <div class="vd-page">
    <PageHeader title="Vérification des dossiers de lot" tone="violet"
      subtitle="Suivi de la vérification des DDL de fabrication par vérificateur">
      <label class="annee-sel">Année
        <select v-model.number="anneeSel">
          <option :value="0">Toutes</option>
          <option v-for="a in ANNEES" :key="a" :value="a">{{ a }}</option>
        </select>
      </label>
    </PageHeader>

    <p v-if="msg" class="alert">{{ msg }}</p>

    <section class="card plan-ddl plan-ddl-top">
      <h3 class="card-title">Plan de vérification DDL<span v-if="anneeSel"> — {{ anneeSel }}</span> <span class="pddl-src">· basé sur le PDP</span></h3>
      <div class="pddl-top-row">
        <div class="pddl-top-item"><span class="pddl-lbl">DDL à vérifier (an)</span><span class="pddl-val">{{ fmt(planDDL) }}</span></div>
        <div class="pddl-top-item"><span class="pddl-lbl">Vérifiés</span><span class="pddl-val ok">{{ fmt(nbVerifies) }}</span></div>
        <div class="pddl-top-item"><span class="pddl-lbl">En attente</span><span class="pddl-val warn">{{ fmt(nbAttente) }}</span></div>
        <div class="pddl-top-item" title="Batch Right First Time : lots sans triage, sans rejet et sans réserve/déviation ÷ total lots"><span class="pddl-lbl">BRFT</span><span class="pddl-val" :class="'k-' + clsKpi(kpiQualite.brft)">{{ kpiQualite.brft != null ? kpiQualite.brft + '%' : '—' }}</span><span class="pddl-mini">{{ kpiQualite.brftOk }}/{{ kpiQualite.total }}</span></div>
        <div class="pddl-top-item" title="Batch Record Right First Time : dossiers de lot vérifiés SANS réserve ÷ dossiers vérifiés"><span class="pddl-lbl">BRRFT</span><span class="pddl-val" :class="'k-' + clsKpi(kpiQualite.brrft)">{{ kpiQualite.brrft != null ? kpiQualite.brrft + '%' : '—' }}</span><span class="pddl-mini">{{ kpiQualite.brrftOk }}/{{ kpiQualite.nbVerif }}</span></div>
        <div class="pddl-top-bar" v-if="tauxPlanDDL != null">
          <div class="pddl-bar-head"><span>Avancement / plan</span><span>{{ tauxPlanDDL }}%</span></div>
          <div class="bar-track"><div class="bar-fill" :class="tauxPlanDDL >= 100 ? 'ok' : 'part'" :style="{ width: Math.min(100, tauxPlanDDL) + '%' }"></div></div>
        </div>
      </div>
    </section>

    <div class="verif-3col">
      <div class="v3-col">
      <section class="card">
        <h3 class="card-title">Dossiers vérifiés par mois<span v-if="anneeSel"> — {{ anneeSel }}</span></h3>
        <MiniChart :labels="MOIS" :format="v => v" :value-format="v => v || ''" show-values :series="[{ label: 'DDL vérifiés', color: '#0f766e', data: verifParMois }]" />
        <p v-if="!verifParMois.some(v => v)" class="empty">Aucun DDL vérifié<span v-if="anneeSel"> en {{ anneeSel }}</span>.</p>
      </section>
      <section class="card">
        <h3 class="card-title">Dossiers en attente de vérification par mois<span v-if="anneeSel"> — {{ anneeSel }}</span></h3>
        <MiniChart :labels="MOIS" :format="v => v" :value-format="v => v || ''" show-values :clickable="true" @pick="ouvrirMois" :series="[{ label: 'En attente', color: '#d97706', data: attenteParMois }]" />
        <p class="chart-hint-vd">Clique sur une barre pour voir les dossiers en attente ce mois-là.</p>
        <p v-if="!attenteParMois.some(v => v)" class="empty">Aucun DDL en attente<span v-if="anneeSel"> en {{ anneeSel }}</span>.</p>
      </section>
      </div>

      <div class="v3-col v3-right">
      <section class="card plan-ddl">
        <h3 class="card-title">Objectif du mois — {{ MOIS[moisCourant - 1] }}</h3>
        <p class="hint">DDL à vérifier ce mois (PDP)</p>
        <div class="pddl-grid">
          <div class="pddl-row"><span class="pddl-lbl">Objectif</span><span class="pddl-val">{{ fmt(objectifMois) }}</span></div>
          <div class="pddl-row"><span class="pddl-lbl">Vérifiés ce mois</span><span class="pddl-val ok">{{ fmt(verifMois) }}</span></div>
        </div>
        <div v-if="tauxMois != null" class="pddl-progress">
          <div class="pddl-bar-head"><span>Taux de vérification</span><span>{{ tauxMois }}%</span></div>
          <div class="bar-track"><div class="bar-fill" :class="tauxMois >= 100 ? 'ok' : 'part'" :style="{ width: Math.min(100, tauxMois) + '%' }"></div></div>
        </div>
      </section>
      <section class="card">
        <div class="sup-head">
          <h3 class="card-title">Taux de vérification par vérificateur</h3>
          <div class="sup-filtre">
            <button class="btn-filtre" type="button" @click="filtreSupOuvert = !filtreSupOuvert">Vérificateurs<span v-if="supSuivis.length"> ({{ supSuivis.length }})</span> ▾</button>
            <div v-if="filtreSupOuvert" class="sup-backdrop" @click="filtreSupOuvert = false"></div>
            <div v-if="filtreSupOuvert" class="sup-menu">
              <label class="sup-opt"><input type="checkbox" :checked="!supSuivis.length" @change="supSuivis = []" /> Tous</label>
              <label v-for="sup in superviseurs" :key="sup" class="sup-opt"><input type="checkbox" :value="sup" v-model="supSuivis" /> {{ sup }}</label>
            </div>
          </div>
        </div>
        <p class="hint">DDL envoyés à l'AQ ÷ DDL qui lui sont assignés</p>
        <div v-if="!parSuperviseurFiltre.length" class="empty">Aucun vérificateur pour ce filtre.</div>
        <div v-for="s in parSuperviseurFiltre" :key="s.nom" class="prog-row">
          <div class="prog-head">
            <span class="prog-nom">{{ s.nom }}</span>
            <span class="prog-pct" :class="{ warn: s.taux < 100 }">{{ s.verifies }}/{{ s.assignes }} · {{ s.taux.toFixed(0) }}%</span>
          </div>
          <div class="bar-track"><div class="bar-fill" :class="s.taux >= 100 ? 'ok' : 'part'" :style="{ width: s.taux + '%' }"></div></div>
        </div>
      </section>
      </div>

      <section class="card v3-mid">
        <h3 class="card-title">DDL en attente de vérification ({{ nbAttente }})</h3>
        <div class="v3-mid-scroll">
        <div v-if="!attente.length" class="empty">Aucun DDL en attente. 🎉</div>
        <table v-else class="mini">
          <thead><tr><th>Lot</th><th>Produit</th><th>Réserver vérificateur</th><th class="right">Fin fab.</th><th></th></tr></thead>
          <tbody>
            <template v-for="l in attente" :key="l.id">
              <tr :class="{ 'ddl-triage': triageIds.has(l.id) }">
                <td class="mono">{{ l.numero_lot }}</td>
                <td class="desig">{{ prodNom(l) }}</td>
                <td>
                  <select v-if="peutEditer" class="resv-sel" :value="l.ddl_verificateur || ''" @change="reserverVerif(l, $event.target.value)">
                    <option value="">— Réserver —</option>
                    <option v-for="sup in superviseurs" :key="sup" :value="sup">{{ sup }}</option>
                  </select>
                  <span v-else>{{ l.ddl_verificateur || '—' }}</span>
                </td>
                <td class="right nowrap">{{ fmtDate(dateDDL(l)) }}</td>
                <td class="right"><button v-if="peutEditer" class="link" @click="ouvrir(l)">Vérifier</button></td>
              </tr>
              <tr v-if="verifEnCours === l.id">
                <td colspan="5">
                  <div class="verif-form">
                    <select v-model="superviseurChoix" class="sv-sel">
                      <option value="">— Choisir un vérificateur —</option>
                      <option v-for="s in superviseurs" :key="s" :value="s">{{ s }}</option>
                      <option value="__autre__">＋ Autre (saisir un nom)…</option>
                    </select>
                    <input v-if="superviseurChoix === '__autre__'" list="superv-list" v-model="nouveauSuperviseur" placeholder="Nom du vérificateur" />
                    <input type="date" v-model="vForm.date" /><label class="verif-chk"><input type="checkbox" v-model="vForm.avec_reserve" /> Avec réserve</label>
                    <button class="btn sm" @click="valider(l)">Valider</button>
                    <button class="link" @click="verifEnCours = null">Annuler</button>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
        </div>
      </section>
    </div>

    <section class="card span2" style="margin-top: 22px">
      <div class="hist-head">
        <h3 class="card-title">DDL vérifiés</h3>
        <span class="hist-count">{{ verifiesFiltres.length }}</span>
        <div class="hist-tools">
          <input v-model="histRecherche" type="search" class="hist-search" placeholder="Rechercher (lot, produit, vérificateur)…" />
          <label class="dlab">Du <input type="date" v-model="histDu" /></label>
          <label class="dlab">Au <input type="date" v-model="histAu" /></label>
          <button class="hist-exp" @click="exporterHistoriqueCSV" :disabled="!verifiesFiltres.length">Exporter CSV</button>
        </div>
      </div>
      <div v-if="!verifiesFiltres.length" class="empty">Aucun DDL vérifié pour ces critères.</div>
      <table v-else class="mini">
        <thead><tr><th>Lot</th><th>Produit</th><th>Vérificateur</th><th class="right">Date d'envoi</th><th></th></tr></thead>
        <tbody>
          <template v-for="l in verifiesAffiches" :key="l.id">
            <tr>
              <td class="mono">{{ l.numero_lot }}</td>
              <td class="desig">{{ prodNom(l) }}</td>
              <td>{{ l.ddl_verificateur || '—' }}</td>
              <td class="right nowrap">{{ fmtDate(l.ddl_date_verification) }}</td>
              <td class="right nowrap">
                <button v-if="estAdmin" class="link" @click="ouvrir(l)">Modifier</button>
                <button v-if="peutEditer" class="link danger" @click="devalider(l)">Annuler</button>
              </td>
            </tr>
            <tr v-if="verifEnCours === l.id">
              <td colspan="5">
                <div class="verif-form">
                  <select v-model="superviseurChoix" class="sv-sel">
                    <option value="">— Choisir un vérificateur —</option>
                    <option v-for="s in superviseurs" :key="s" :value="s">{{ s }}</option>
                    <option value="__autre__">＋ Autre (saisir un nom)…</option>
                  </select>
                  <input v-if="superviseurChoix === '__autre__'" list="superv-list" v-model="nouveauSuperviseur" placeholder="Nom du vérificateur" />
                  <input type="date" v-model="vForm.date" /><label class="verif-chk"><input type="checkbox" v-model="vForm.avec_reserve" /> Avec réserve</label>
                  <button class="btn sm" @click="valider(l)">Enregistrer</button>
                  <button class="link" @click="verifEnCours = null">Annuler</button>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
      <p v-if="verifiesFiltres.length > verifiesAffiches.length" class="empty">
        … {{ fmt(verifiesFiltres.length - verifiesAffiches.length) }} autres (affichage limité à {{ LIMITE }} ; affine la recherche ou les dates).
      </p>
    </section>

    <datalist id="superv-list">
      <option v-for="s in superviseurs" :key="s" :value="s"></option>
    </datalist>
    <div v-if="moisSel != null" class="vd-modal-overlay" @click.self="moisSel = null">
      <div class="vd-modal">
        <div class="vd-modal-head">
          <h3 class="vd-modal-title">En attente de vérification — {{ MOIS_LONG[moisSel] }}<span v-if="anneeSel"> {{ anneeSel }}</span> ({{ lotsDuMois.length }})</h3>
          <button class="vd-modal-close" @click="moisSel = null">✕</button>
        </div>
        <div class="vd-modal-body">
          <div v-if="!lotsDuMois.length" class="empty">Aucun dossier en attente ce mois-là.</div>
          <table v-else class="mini-vd">
            <thead><tr><th>N° lot</th><th>Produit</th><th class="right">Fin fab.</th></tr></thead>
            <tbody>
              <tr v-for="l in lotsDuMois" :key="l.id">
                <td class="strong">{{ l.numero_lot }}</td>
                <td>{{ l.produits ? l.produits.designation : '—' }}</td>
                <td class="right nowrap">{{ fmtDate(dateDDL(l)) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vd-page { color: #1b2733; }
.vd-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin: 4px 0 18px; }
.vd-head h1 { margin: 0; font-size: 26px; letter-spacing: -0.01em; }
.sub { margin: 4px 0 0; color: #64748b; font-size: 14px; }
.annee-sel { display: flex; flex-direction: column; font-size: 11px; font-weight: 600; color: #64748b; gap: 4px; text-transform: uppercase; letter-spacing: .03em; }
.annee-sel select { font-size: 14px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; font-weight: 600; color: #1b2733; min-width: 110px; }

.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }

.kpi-grid { display: grid; gap: 14px; margin-bottom: 22px; }
.kpi-grid.k3 { grid-template-columns: repeat(3, 1fr); }
.kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.kpi-val { font-size: 23px; font-weight: 700; letter-spacing: -0.02em; }
.kpi-val.accent { color: #0f766e; }
.kpi-val.warn { color: #b45309; }
.kpi-lbl { font-size: 12px; color: #64748b; margin-top: 4px; }

.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card.span2 { grid-column: 1 / -1; }
.card-title { margin: 0 0 14px; font-size: 16px; }

.prog-row { margin-bottom: 13px; }
.prog-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 5px; }
.prog-nom { font-size: 13px; font-weight: 600; color: #1b2733; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70%; }
.prog-pct { font-size: 13px; font-weight: 700; color: #0f766e; flex-shrink: 0; }
.bar-track { height: 10px; background: #f1f5f9; border-radius: 999px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 999px; min-width: 2px; }
.bar-fill.prod { background: #0f766e; }
.bar-fill.ok { background: #16a34a; }
.bar-fill.part { background: #f59e0b; }
.prog-pct.warn { color: #b45309; }
.hint { margin: -8px 0 14px; font-size: 12px; color: #94a3b8; }

table.mini { width: 100%; border-collapse: collapse; font-size: 13px; }
table.mini th { text-align: left; padding: 7px 6px; border-bottom: 2px solid #e2e8f0; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; }
table.mini td { padding: 7px 6px; border-bottom: 1px solid #eef2f6; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 600; }
.desig { color: #64748b; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.right { text-align: right; }
.nowrap { white-space: nowrap; }
.empty { color: #94a3b8; font-style: italic; font-size: 13px; }

.btn { display: inline-block; background: #0f766e; color: #fff; border: 0; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
.btn:hover { background: #0c5f59; }
.btn.sm { padding: 7px 14px; font-size: 13px; }
.link { background: none; border: 0; color: #0f766e; font-size: 13px; font-weight: 600; cursor: pointer; padding: 4px 6px; }
.link:hover { text-decoration: underline; }
.link.danger { color: #b91c1c; }

.verif-form { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 4px 0; }
.verif-form input { font-size: 14px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; }
.verif-form input[list] { min-width: 230px; }

@media (max-width: 900px) {
  .kpi-grid.k3 { grid-template-columns: 1fr; }
  .cols { grid-template-columns: 1fr; }
  .card.span2 { grid-column: auto; }
}
.verif-form select { font-size: 14px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; min-width: 230px; }
.hist-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.hist-head .card-title { margin: 0; }
.hist-count { background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 600; padding: 2px 9px; border-radius: 999px; }
.hist-tools { margin-left: auto; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.hist-search { font-size: 13px; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; min-width: 220px; }
.hist-search:focus { outline: 2px solid #0f766e; border-color: #0f766e; }
.dlab { font-size: 12px; color: #64748b; display: inline-flex; align-items: center; gap: 5px; }
.dlab input { font-size: 13px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #1b2733; }
.hist-exp { font-size: 13px; padding: 7px 12px; border: 1px solid #0f766e; border-radius: 8px; background: #fff; color: #0f766e; font-weight: 600; cursor: pointer; white-space: nowrap; }
.hist-exp:hover { background: #ecfdf5; }
.hist-exp:disabled { opacity: .45; cursor: not-allowed; }
.sup-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.sup-filtre { position: relative; }
.btn-filtre { font-size: 12px; font-weight: 600; color: #475569; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px 10px; cursor: pointer; white-space: nowrap; }
.btn-filtre:hover { border-color: #0f766e; color: #0f766e; }
.sup-backdrop { position: fixed; inset: 0; z-index: 20; }
.sup-menu { position: absolute; right: 0; top: calc(100% + 4px); z-index: 21; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; box-shadow: 0 10px 28px rgba(16,24,40,.18); padding: 6px; min-width: 210px; max-height: 260px; overflow-y: auto; }
.sup-opt { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #1b2733; padding: 6px 8px; border-radius: 6px; cursor: pointer; white-space: nowrap; }
.sup-opt:hover { background: #f1f5f9; }
.sup-opt input { width: 15px; height: 15px; accent-color: #0f766e; cursor: pointer; }
.chart-hint-vd { font-size: 12px; color: #94a3b8; margin: 8px 0 0; font-style: italic; }
.vd-modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.45); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
.vd-modal { background: #fff; border-radius: 14px; width: min(640px, 100%); max-height: 82vh; display: flex; flex-direction: column; box-shadow: 0 20px 50px rgba(0,0,0,.3); }
.vd-modal-head { display: flex; align-items: center; gap: 10px; padding: 16px 18px; border-bottom: 1px solid #e2e8f0; }
.vd-modal-title { margin: 0; font-size: 16px; }
.vd-modal-close { margin-left: auto; background: none; border: 0; font-size: 18px; color: #64748b; cursor: pointer; line-height: 1; }
.vd-modal-body { overflow-y: auto; padding: 8px 18px 18px; }
.mini-vd { width: 100%; border-collapse: collapse; font-size: 14px; }
.mini-vd th { text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; }
.mini-vd td { padding: 8px 10px; border-bottom: 1px solid #eef2f6; }
.mini-vd .right { text-align: right; }
.mini-vd .strong { font-weight: 700; }
.mini-vd .nowrap { white-space: nowrap; }
.verif-chk { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #b45309; font-weight: 600; white-space: nowrap; cursor: pointer; }
.verif-chk input { width: 15px; height: 15px; cursor: pointer; }
.charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: start; }
.charts-row > .card { margin: 0; }
@media (max-width: 900px) { .charts-row { grid-template-columns: 1fr; } }
.verif-3col { display: grid; grid-template-columns: 0.8fr 1.5fr 0.9fr; gap: 14px; align-items: stretch; }
.verif-3col > .v3-col { display: flex; flex-direction: column; gap: 14px; order: 1; align-self: stretch; margin-top: 0; }
.verif-3col > .v3-mid { order: 2; margin: 0; align-self: stretch; margin-top: 0; }
.verif-3col > .v3-right { order: 3; margin: 0; align-self: stretch; margin-top: 0; }
.verif-3col > * > .card:first-child, .verif-3col > .v3-mid.card { margin-top: 0; }
@media (max-width: 1100px) { .verif-3col { grid-template-columns: 1fr; } .verif-3col > * { order: 0 !important; } }
/* Compact */
.vd-head h1 { font-size: 15px; }
.sub { display: none; }
.vd-head { margin-bottom: 8px; }
.kpi { padding: 8px 11px; }
.kpi-val { font-size: 15px; }
.kpi-lbl { font-size: 9.5px; margin-top: 2px; }
.card { padding: 9px 11px; }
.card-title { font-size: 12px; margin: 0 0 8px; }
.prog-nom, .prog-pct { font-size: 11px; }
.prog-row { margin-bottom: 8px; }
.hint { font-size: 10px; margin: -4px 0 8px; }
table.mini { font-size: 11px; }
table.mini th { font-size: 9.5px; padding: 4px 5px; }
table.mini td { padding: 3px 5px; }
.btn { padding: 6px 14px; font-size: 12px; }
.btn.sm { padding: 5px 11px; font-size: 11px; }
.verif-form input, .verif-form select { font-size: 12px; padding: 5px 8px; }
.verif-form select { min-width: 180px; }
.btn-filtre { font-size: 11px; padding: 5px 9px; }
.sup-opt { font-size: 11px; padding: 4px 7px; }
.resv-sel { font-size: 11px; padding: 3px 6px; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; color: #1b2733; max-width: 150px; }
.plan-ddl .pddl-grid { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
.pddl-row { display: flex; justify-content: space-between; align-items: center; }
.pddl-lbl { font-size: 11px; color: #64748b; }
.pddl-val { font-size: 14px; font-weight: 800; color: #0f172a; }
.pddl-val.ok { color: #0f766e; }
.pddl-val.warn { color: #d97706; }
.pddl-bar-head { display: flex; justify-content: space-between; font-size: 10px; color: #64748b; margin-bottom: 3px; font-weight: 600; }
/* Réduction pour tout visualiser */
.card { padding: 7px 9px; }
.card-title { font-size: 11px; margin: 0 0 6px; }
.hint { font-size: 9px; margin: -3px 0 6px; }
.pddl-val { font-size: 12px; }
.pddl-lbl { font-size: 10px; }
.pddl-bar-head { font-size: 9px; }
.pddl-grid { gap: 3px !important; margin-bottom: 6px !important; }
.prog-nom, .prog-pct { font-size: 10px; }
.prog-row { margin-bottom: 6px; }
table.mini { font-size: 10px; }
table.mini th { font-size: 8.5px; padding: 3px 4px; }
table.mini td { padding: 2px 4px; }
.verif-3col { gap: 10px; }
.verif-3col > .v3-col { gap: 10px; }
.bar-track { height: 6px; }
.btn.sm { padding: 4px 9px; font-size: 10px; }
.verif-form input, .verif-form select { font-size: 11px; padding: 4px 7px; }
.resv-sel { font-size: 10px; padding: 2px 5px; }
.chart-hint-vd { font-size: 9px; margin: 4px 0 0; }
.card-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* Colonnes bornées en hauteur + défilement interne pour tout voir */
.v3-mid { max-height: calc(100vh - 120px); overflow-y: auto; }
.v3-mid .card-title { position: sticky; top: 0; background: #fff; z-index: 2; padding-bottom: 4px; }
.verif-3col > .v3-col { max-height: calc(100vh - 120px); overflow-y: auto; }
.verif-3col > .v3-col::-webkit-scrollbar, .v3-mid::-webkit-scrollbar { width: 7px; }
.verif-3col > .v3-col::-webkit-scrollbar-thumb, .v3-mid::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
/* Réduction forte pour visualiser toutes les cartes */
.card { padding: 5px 7px; }
.card-title { font-size: 10px; margin: 0 0 4px; }
.hint { font-size: 8px; margin: -2px 0 4px; }
table.mini td { padding: 1px 4px; font-size: 9px; }
table.mini th { font-size: 8px; padding: 2px 4px; }
.prog-row { margin-bottom: 4px; }
.prog-nom, .prog-pct { font-size: 9px; }
.pddl-val { font-size: 11px; }
.pddl-lbl { font-size: 9px; }
.pddl-bar-head { font-size: 8px; }
.verif-3col { gap: 8px; }
.verif-3col > .v3-col { gap: 8px; }
.chart-hint-vd { font-size: 8px; }
/* Graphes compacts (aires + barres) */
.v3-col :deep(.ch) { height: 95px !important; padding-top: 12px !important; }
.v3-col :deep(.line-ch) { height: 95px !important; overflow: hidden; }
.v3-col :deep(.lch-svg) { height: 95px !important; width: 100% !important; }
.v3-col :deep(.ch-switch) { margin-bottom: 3px !important; }
.v3-col :deep(.ch-switch button) { font-size: 9px !important; padding: 2px 7px !important; }
/* Colonne gauche plus étroite + titres minimisés */
.verif-3col { grid-template-columns: 0.72fr 1.3fr 1fr !important; }
.v3-col .card-title, .v3-mid .card-title { font-size: 10px !important; margin-bottom: 4px !important; line-height: 1.2 !important; }
/* Colonne centrale : tableau pleine largeur, sans défilement horizontal */
.v3-mid table.mini { table-layout: fixed; width: 100%; }
.v3-mid table.mini th, .v3-mid table.mini td { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.v3-mid table.mini th:nth-child(1), .v3-mid table.mini td:nth-child(1) { width: 12%; }
.v3-mid table.mini th:nth-child(2), .v3-mid table.mini td:nth-child(2) { width: 32%; }
.v3-mid table.mini th:nth-child(3), .v3-mid table.mini td:nth-child(3) { width: 33%; }
.v3-mid table.mini th:nth-child(4), .v3-mid table.mini td:nth-child(4) { width: 13%; }
.v3-mid table.mini th:nth-child(5), .v3-mid table.mini td:nth-child(5) { width: 10%; }
.v3-mid .resv-sel { width: 100%; max-width: 100%; }
.v3-mid .verif-form td { white-space: normal; overflow: visible; }
/* Colonne droite plus étroite */
.verif-3col { grid-template-columns: 0.72fr 1.45fr 0.83fr !important; }
.plan-ddl-top { margin-bottom: 10px; }
.plan-ddl-top .pddl-top-row { display: flex; align-items: flex-end; gap: 22px; flex-wrap: wrap; }
.plan-ddl-top .pddl-top-item { display: flex; flex-direction: column; gap: 2px; }
.plan-ddl-top .pddl-top-item .pddl-val { font-size: 16px; }
.plan-ddl-top .pddl-top-bar { flex: 1; min-width: 220px; }
.pddl-src { font-size: 9px; color: #94a3b8; font-weight: 500; }
/* 3 colonnes alignées en bas (même hauteur) */
.verif-3col { align-items: stretch !important; }
.verif-3col > .v3-col, .verif-3col > .v3-mid { height: calc(100vh - 240px) !important; max-height: calc(100vh - 240px) !important; overflow-y: auto; }

/* Colonnes de même hauteur : bas aligné */
.verif-3col > .v3-col > .card:last-child { flex: 1 1 auto; }
/* Lots en cours de triage (fabrication) */
tr.ddl-triage td { background: #fef3c7; }
tr.ddl-triage .mono::after { content: ' 🔍 triage'; color: #b45309; font-size: .78em; font-weight: 700; white-space: nowrap; }

/* ============================================================= *
 * Refonte moderne — couche de surcharge (cohérence violet)
 * ============================================================= */
.vd-page :deep(h1) { font-size: 20px !important; }
.card { border-color: #ece9f6 !important; border-radius: 13px !important; box-shadow: 0 1px 3px rgba(76,29,149,.05) !important; }
.card-title { color: #4c1d95 !important; font-weight: 800 !important; letter-spacing: -.01em !important; border-left: 3px solid #7c3aed; padding-left: 8px; }
.v3-mid .card-title { position: sticky; top: 0; background: #fff; }

/* KPI / valeurs */
.kpi { border-color: #ece9f6 !important; border-radius: 12px !important; background: #fff !important; }
.kpi-val.accent { color: #6d28d9 !important; }
.pddl-val.ok { color: #6d28d9 !important; }

/* Bandeau Plan DDL (en tête) */
.plan-ddl-top { background: linear-gradient(135deg, #faf5ff, #f3f0fd) !important; border-color: #e5d9fb !important; }
.plan-ddl-top .pddl-top-item .pddl-val { color: #1e1b3a; }
.pddl-src { color: #a78bfa !important; }

/* Barres de progression */
.bar-track { background: #efeafb !important; height: 8px !important; border-radius: 999px; }
.bar-fill.prod, .bar-fill.ok { background: linear-gradient(90deg, #8b5cf6, #6d28d9) !important; }
.bar-fill.part { background: linear-gradient(90deg, #fbbf24, #f59e0b) !important; }
.prog-pct { color: #6d28d9 !important; }
.prog-pct.warn { color: #b45309 !important; }

/* Tableaux */
table.mini th, .mini-vd th { color: #6d28d9 !important; }
table.mini tbody tr:hover td { background: #faf9fe; }

/* Boutons */
.btn { background: linear-gradient(135deg, #7c3aed, #6d28d9) !important; border-radius: 9px !important; box-shadow: 0 2px 8px rgba(109,40,217,.25); }
.btn:hover { background: linear-gradient(135deg, #7c3aed, #6d28d9) !important; filter: brightness(1.07); }
.link { color: #6d28d9 !important; }
.link.danger { color: #b91c1c !important; }
.hist-exp { color: #6d28d9 !important; border-color: #ddd6fe !important; }
.hist-exp:hover { background: #f5f3ff !important; }
.btn-filtre:hover { color: #6d28d9 !important; border-color: #c4b5fd !important; }

/* Champs / focus */
.annee-sel select:focus, .verif-form input:focus, .verif-form select:focus, .hist-search:focus { outline: none !important; border-color: #7c3aed !important; box-shadow: 0 0 0 3px rgba(124,58,237,.12) !important; }
.sup-opt input, .verif-chk input { accent-color: #6d28d9; }

/* Modale */
.vd-modal { border-radius: 16px !important; }
.vd-modal-title { color: #4c1d95 !important; }

/* Compteurs / puces */
.hist-count { background: #ede9fe !important; color: #6d28d9 !important; }


/* Mise en page : centrale élargie, latérales équilibrées */
.verif-3col { grid-template-columns: 0.72fr 1.95fr 0.72fr !important; gap: 12px !important; }

/* Placement explicite des 3 colonnes (robuste, corrige la table centrale) */
.verif-3col > .v3-col:first-child { grid-column: 1 !important; }
.verif-3col > .v3-mid { grid-column: 2 !important; }
.verif-3col > .v3-right { grid-column: 3 !important; }
@media (max-width: 1100px) {
  .verif-3col { grid-template-columns: 1fr !important; }
  .verif-3col > * { grid-column: auto !important; order: 0 !important; height: auto !important; max-height: none !important; }
}

/* Titre de la carte centrale : visible en entier (non rogné par le scroll) */
.v3-mid { padding-top: 0 !important; }
.v3-mid .card-title { position: sticky; top: 0; z-index: 3; background: #fff; margin: 0 0 6px !important; padding: 8px 6px 6px !important; font-size: 12px !important; line-height: 1.2 !important; border-bottom: 1px solid #eef0f4; }

/* Empilement titre + en-tête tableau (pas de superposition) */
.v3-mid .card-title { position: sticky !important; top: 0 !important; z-index: 6 !important; background: #fff !important; margin: 0 !important; padding: 8px 6px 6px !important; font-size: 12px !important; line-height: 1.2 !important; }
.v3-mid table.mini { border-collapse: separate; border-spacing: 0; }
.v3-mid table.mini thead th { position: sticky !important; top: 30px !important; z-index: 5 !important; background: #f6f7fb !important; }

/* Titre fixe hors défilement + liste scrollable (robuste) */
.v3-mid { display: flex !important; flex-direction: column !important; overflow: hidden !important; }
.v3-mid .card-title { flex: 0 0 auto !important; position: static !important; margin: 0 0 6px !important; }
.v3-mid-scroll { flex: 1 1 auto; overflow-y: auto; min-height: 0; }
.v3-mid-scroll::-webkit-scrollbar { width: 7px; }
.v3-mid-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
.v3-mid table.mini thead th { position: sticky !important; top: 0 !important; z-index: 2; background: #f6f7fb !important; }

/* KPI qualité BRFT / BRRFT */
.pddl-top-item .pddl-mini { font-size: 9px; color: #94a3b8; font-weight: 600; margin-top: 1px; }
.pddl-val.k-ok { color: #16a34a !important; }
.pddl-val.k-warn { color: #d97706 !important; }
.pddl-val.k-bad { color: #dc2626 !important; }
</style>
