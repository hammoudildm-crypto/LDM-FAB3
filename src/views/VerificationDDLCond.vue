<script setup>
import { ref, computed, inject, onMounted } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'
import MiniChart from '../components/MiniChart.vue'
import { ICONS, TINTS } from '../icons.js'

const peutEditer = inject('peutEditer', ref(false))

const anneeCourante = new Date().getFullYear()
const ANNEES = []
for (let a = anneeCourante - 4; a <= anneeCourante + 1; a++) ANNEES.push(a)
const anneeSel = ref(anneeCourante)

const lots = ref([])
const conds = ref([])
const condList = ref([])
const msg = ref('')
const chargement = ref(true)

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
  chargement.value = true
  const r = await fetchAllPaged(() => supabase.from('ordres_fabrication')
    .select('id, numero_lot, statut, deviation_cond, en_triage_cond, ddl_cond_verifie, ddl_cond_verificateur, ddl_cond_date_verification, ddl_cond_date_envoi, ddl_cond_reserve, produits(designation, code_pf)')
    .eq('actif', true))
  if (r.error) { msg.value = r.error.message; chargement.value = false; return }
  lots.value = r.data || []
  const rc = await fetchAllPaged(() => supabase.from('conditionnement')
    .select('ordre_id, date_conditionnement, date_fin, statut').eq('actif', true))
  if (!rc.error) conds.value = rc.data || []
  const rv = await supabase.from('verificateurs_cond').select('nom').order('nom')
  if (!rv.error) condList.value = rv.data.map(v => v.nom)
  chargement.value = false
}
onMounted(charger)

const anYear = (d) => d ? new Date(d).getFullYear() : null
function fmtDate(d) { if (!d) return '—'; const x = new Date(d); return x.toLocaleDateString('fr-FR') }
function fmt(n) { return n == null ? '0' : Number(n).toLocaleString('fr-FR') }

// Date de fin de conditionnement d'un lot = la plus récente date_fin de ses conditionnements
const finCondParLot = computed(() => {
  const m = {}
  for (const c of conds.value) {
    if (!c.date_fin) continue
    const t = new Date(c.date_fin).getTime()
    if (!m[c.ordre_id] || t > m[c.ordre_id]) m[c.ordre_id] = t
  }
  return m
})
function dateFinCond(l) {
  const t = finCondParLot.value[l.id]
  return t ? new Date(t).toISOString() : null
}

// Lots dont le conditionnement est terminé (date de fin renseignée), pour l'année choisie
// En attente de vérification = conditionnement TERMINÉ (date de fin renseignée) + pas encore vérifié
const dossiers = computed(() => lots.value.filter(l => {
  const d = dateFinCond(l)
  return d && (anneeSel.value === 0 || anYear(d) === anneeSel.value)
}))
const attente = computed(() => dossiers.value
  .filter(l => !l.ddl_cond_verifie && !l.ddl_cond_date_envoi)
  .sort((a, b) => String(a.numero_lot || '').localeCompare(String(b.numero_lot || ''), undefined, { numeric: true })))
const verifies = computed(() => dossiers.value
  .filter(l => l.ddl_cond_verifie)
  .sort((a, b) => String(b.ddl_cond_date_verification || '').localeCompare(String(a.ddl_cond_date_verification || ''))))

const nbAttente = computed(() => attente.value.length)
const kpiQualite = computed(() => {
  const subj = dossiers.value
  const total = subj.length
  const brftOk = subj.filter(l => !l.en_triage_cond && !/rejet|rebut/i.test(l.statut || '') && !l.deviation_cond).length
  const verif = subj.filter(l => l.ddl_cond_verifie)
  const brrftOk = verif.filter(l => !l.ddl_cond_reserve).length
  const nbDeviations = subj.filter(l => !!l.deviation_cond).length
  const nbTriage = subj.filter(l => !!l.en_triage_cond).length
  const nbRejet = subj.filter(l => /rejet|rebut/i.test(l.statut || '')).length
  return { total, brftOk, nbVerif: verif.length, brrftOk, nbDeviations, nbTriage, nbRejet,
    brft: total > 0 ? Math.round(brftOk / total * 1000) / 10 : null,
    brrft: verif.length > 0 ? Math.round(brrftOk / verif.length * 1000) / 10 : null }
})
function clsKpi(v) { return v == null ? '' : (v >= 95 ? 'ok' : (v >= 85 ? 'warn' : 'bad')) }
const nbVerifies = computed(() => verifies.value.length)
const taux = computed(() => {
  const tot = dossiers.value.length
  return tot ? Math.round((nbVerifies.value / tot) * 100) : 0
})
const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const verifParMois = computed(() => {
  const a = Array(12).fill(0)
  for (const l of lots.value) {
    if (!l.ddl_cond_verifie || !l.ddl_cond_date_verification) continue
    const d = new Date(l.ddl_cond_date_verification)
    if (anneeSel.value && d.getFullYear() !== anneeSel.value) continue
    a[d.getMonth()]++
  }
  return a
})
const totalVerifAnnee = computed(() => verifParMois.value.reduce((s, x) => s + x, 0))
const attenteParMois = computed(() => {
  const a = Array(12).fill(0)
  for (const l of attente.value) {
    const d = dateFinCond(l)
    if (d) a[new Date(d).getMonth()]++
  }
  return a
})
const totalAttenteMois = computed(() => attenteParMois.value.reduce((s, x) => s + x, 0))
const verifiesParMois = computed(() => {
  const a = Array(12).fill(0)
  for (const l of lots.value) {
    if (!l.ddl_cond_date_envoi) continue
    const d = new Date(l.ddl_cond_date_envoi)
    if (anneeSel.value && d.getFullYear() !== anneeSel.value) continue
    a[d.getMonth()]++
  }
  return a
})
const totalVerifiesMois = computed(() => verifiesParMois.value.reduce((s, x) => s + x, 0))
const parVerificateurCond = computed(() => {
  const m = {}
  for (const nom of condList.value) if (nom) m[nom] = { nom, verifies: 0 }
  for (const l of dossiers.value) {
    if (!l.ddl_cond_verifie || !l.ddl_cond_verificateur) continue
    const k = l.ddl_cond_verificateur
    if (!m[k]) m[k] = { nom: k, verifies: 0 }
    m[k].verifies++
  }
  const arr = Object.values(m).sort((a, b) => b.verifies - a.verifies)
  const max = Math.max(1, ...arr.map(x => x.verifies))
  return arr.map(x => ({ ...x, pct: Math.round((x.verifies / max) * 100) }))
})
const MOIS_LONG = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const moisSel = ref(null)
const modeMois = ref('attente')
function ouvrirMois(i) { modeMois.value = 'attente'; moisSel.value = i }
function ouvrirMoisVerif(i) { modeMois.value = 'verifies'; moisSel.value = i }
const dossiersDuMois = computed(() => {
  if (moisSel.value == null) return []
  if (modeMois.value === 'verifies') {
    return lots.value.filter(l => {
      if (!l.ddl_cond_date_envoi) return false
      const d = new Date(l.ddl_cond_date_envoi)
      return (anneeSel.value === 0 || d.getFullYear() === anneeSel.value) && d.getMonth() === moisSel.value
    }).sort((a, b) => String(a.numero_lot || '').localeCompare(String(b.numero_lot || ''), undefined, { numeric: true }))
  }
  return attente.value.filter(l => {
    const d = dateFinCond(l)
    return d && new Date(d).getMonth() === moisSel.value
  }).sort((a, b) => String(a.numero_lot || '').localeCompare(String(b.numero_lot || ''), undefined, { numeric: true }))
})

// Vérification
const verifEnCours = ref(null)
const nomVerif = ref('')
const nomAutre = ref('')
const reserveCond = ref(false)
function ouvrir(l) { verifEnCours.value = l.id; nomVerif.value = l.ddl_cond_verificateur || ''; nomAutre.value = '' }
async function valider(l) {
  const nom = (nomVerif.value === '__autre__' ? nomAutre.value : nomVerif.value).trim()
  if (!nom) { msg.value = 'Choisir ou saisir le nom du vérificateur.'; return }
  const r = await supabase.from('ordres_fabrication').update({
    ddl_cond_verifie: true,
    ddl_cond_reserve: reserveCond.value,
    ddl_cond_verificateur: nom,
    ddl_cond_date_verification: new Date().toISOString().slice(0, 10)
  }).eq('id', l.id)
  if (r.error) { msg.value = r.error.message; return }
  verifEnCours.value = null
  reserveCond.value = false
  await charger()
}
async function devalider(l) {
  if (!confirm('Annuler la vérification du dossier ' + l.numero_lot + ' ?')) return
  const r = await supabase.from('ordres_fabrication').update({
    ddl_cond_verifie: false, ddl_cond_verificateur: null, ddl_cond_date_verification: null
  }).eq('id', l.id)
  if (r.error) { msg.value = r.error.message; return }
  await charger()
}
</script>

<template>
  <div class="ddlc-page">
    <PageHeader title="Vérification DDL — Conditionnement" tone="blue"
      subtitle="Dossiers de lot dont le conditionnement est terminé, à vérifier.">
      <label class="annee">Année
        <select v-model.number="anneeSel">
          <option :value="0">Toutes</option>
          <option v-for="a in ANNEES" :key="a" :value="a">{{ a }}</option>
        </select>
      </label>
    </PageHeader>

    <p v-if="msg" class="alert">{{ msg }}</p>
    <p v-if="chargement" class="muted">Chargement…</p>

    <template v-if="!chargement">
      <section class="card plan-ddl plan-ddl-top">
        <h3 class="card-title">Synthèse de la vérification<span v-if="anneeSel"> — {{ anneeSel }}</span></h3>
        <div class="pddl-top-row">
          <div class="pddl-top-item"><span class="pddl-lbl">Dossiers cond.</span><span class="pddl-val">{{ fmt(dossiers.length) }}</span></div>
          <div class="pddl-top-item"><span class="pddl-lbl">Vérifiés</span><span class="pddl-val ok">{{ fmt(nbVerifies) }}</span></div>
          <div class="pddl-top-item"><span class="pddl-lbl">En attente</span><span class="pddl-val warn">{{ fmt(nbAttente) }}</span></div>
          <div class="pddl-top-item" title="Batch Right First Time : lots sans triage, sans rejet et sans déviation conditionnement ÷ total"><span class="pddl-lbl">BRFT</span><span class="pddl-val" :class="'k-' + clsKpi(kpiQualite.brft)">{{ kpiQualite.brft != null ? kpiQualite.brft + '%' : '—' }}</span><span class="pddl-mini">{{ kpiQualite.brftOk }}/{{ kpiQualite.total }}</span></div>
          <div class="pddl-top-item" title="Batch Record Right First Time : dossiers cond. vérifiés SANS réserve ÷ vérifiés"><span class="pddl-lbl">BRRFT</span><span class="pddl-val" :class="'k-' + clsKpi(kpiQualite.brrft)">{{ kpiQualite.brrft != null ? kpiQualite.brrft + '%' : '—' }}</span><span class="pddl-mini">{{ kpiQualite.brrftOk }}/{{ kpiQualite.nbVerif }}</span></div>
          <div class="pddl-top-item" title="Lots avec déviation conditionnement"><span class="pddl-lbl">Déviations</span><span class="pddl-val" :class="kpiQualite.nbDeviations > 0 ? 'k-bad' : 'k-ok'">{{ kpiQualite.nbDeviations }}</span><span class="pddl-mini">{{ kpiQualite.nbTriage }} triage · {{ kpiQualite.nbRejet }} rejet</span></div>
          <div class="pddl-top-bar">
            <div class="pddl-bar-head"><span>Avancement</span><span>{{ taux }}%</span></div>
            <div class="bar-track"><div class="bar-fill" :class="taux >= 100 ? 'ok' : 'part'" :style="{ width: Math.min(100, taux) + '%' }"></div></div>
          </div>
        </div>
      </section>

      <div class="verif-3col">
        <div class="v3-col">

      <section class="card" v-if="totalAttenteMois">
        <h3 class="card-title">Dossiers en attente de vérification par mois — {{ anneeSel || 'toutes années' }}</h3>
        <MiniChart :series="[{ label: 'En attente', color: '#d97706', data: attenteParMois }]" :labels="MOIS" :show-values="true" :clickable="true" @pick="ouvrirMois" />
        <p class="chart-hint">Clique sur une barre pour voir les dossiers en attente ce mois-là.</p>
      </section>

      <section class="card" v-if="totalVerifiesMois">
        <h3 class="card-title">Dossiers de lot conditionnement vérifiés par mois — {{ anneeSel || 'toutes années' }}</h3>
        <MiniChart :series="[{ label: 'Vérifiés', color: '#2563eb', data: verifiesParMois }]" :labels="MOIS" :show-values="true" :clickable="true" @pick="ouvrirMoisVerif" />
        <p class="chart-hint">Clique sur une barre pour voir les dossiers vérifiés ce mois-là.</p>
      </section>
        </div>
        <div class="v3-col v3-right">
      <section class="card" v-if="parVerificateurCond.length">
        <h3 class="card-title">Taux de vérification par vérificateur</h3>
        <div v-for="v in parVerificateurCond" :key="v.nom" class="prog-row">
          <span class="prog-nom">{{ v.nom }}</span>
          <div class="prog-bar"><div class="prog-fill" :style="{ width: v.pct + '%' }"></div></div>
          <span class="prog-val">{{ v.verifies }}</span>
        </div>
      </section>
        </div>
      <section class="card v3-mid">
        <h3 class="card-title">En attente de vérification ({{ nbAttente }})</h3>
        <div v-if="!attente.length" class="empty">Aucun dossier conditionnement en attente. 🎉</div>
        <div v-else class="table-scroll">
          <table class="mini">
            <thead><tr><th>N° lot</th><th>Code</th><th>Produit</th><th class="right">Envoi DDL</th><th class="right">Fin cond.</th><th class="right"></th></tr></thead>
            <tbody>
              <template v-for="l in attente" :key="l.id">
                <tr>
                  <td class="strong">{{ l.numero_lot }}</td>
                  <td>{{ l.produits ? l.produits.code_pf : '—' }}</td>
                  <td>{{ l.produits ? l.produits.designation : '—' }}</td>
                  <td class="right nowrap">{{ fmtDate(l.ddl_cond_date_envoi) }}</td>
                  <td class="right nowrap">{{ fmtDate(dateFinCond(l)) }}</td>
                  <td class="right"><button v-if="peutEditer" class="link" @click="ouvrir(l)">Vérifier</button></td>
                </tr>
                <tr v-if="verifEnCours === l.id">
                  <td colspan="6" class="verif-row">
                    <span>Vérificateur :</span>
                    <select v-model="nomVerif" class="verif-sel">
                      <option value="">— Choisir —</option>
                      <option v-for="v in condList" :key="v" :value="v">{{ v }}</option>
                      <option value="__autre__">Autre…</option>
                    </select>
                    <input v-if="nomVerif === '__autre__'" v-model="nomAutre" placeholder="Nom" @keyup.enter="valider(l)" />
                    <label class="verif-chk"><input type="checkbox" v-model="reserveCond" /> Avec réserve</label>
                    <button class="btn sm" @click="valider(l)">Valider</button>
                    <button class="link" @click="verifEnCours = null">Annuler</button>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </section>
      </div>

      <section class="card span2" style="margin-top: 18px">
        <h3 class="card-title">Dossiers vérifiés ({{ nbVerifies }})</h3>
        <div v-if="!verifies.length" class="empty">Aucun dossier vérifié pour cette période.</div>
        <div v-else class="table-scroll">
          <table class="mini">
            <thead><tr><th>N° lot</th><th>Code</th><th>Produit</th><th class="right">Envoi DDL</th><th>Vérifié par</th><th class="right">Date</th><th class="right"></th></tr></thead>
            <tbody>
              <tr v-for="l in verifies" :key="l.id">
                <td class="strong">{{ l.numero_lot }}</td>
                <td>{{ l.produits ? l.produits.code_pf : '—' }}</td>
                <td>{{ l.produits ? l.produits.designation : '—' }}</td>
                <td class="right nowrap">{{ fmtDate(l.ddl_cond_date_envoi) }}</td>
                <td>{{ l.ddl_cond_verificateur || '—' }}</td>
                <td class="right nowrap">{{ fmtDate(l.ddl_cond_date_verification) }}</td>
                <td class="right"><button v-if="peutEditer" class="link danger" @click="devalider(l)">Annuler</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <p class="hint">Un dossier apparaît ici dès que le <strong>conditionnement du lot est terminé</strong> (date de fin de conditionnement renseignée dans Conditionnement). La vérification est indépendante de celle de la fabrication.</p>

      <div v-if="moisSel != null" class="modal-overlay" @click.self="moisSel = null">
        <div class="modal">
          <div class="modal-head">
            <h3 class="modal-title">{{ modeMois === 'verifies' ? 'Dossiers vérifiés' : 'Dossiers en attente' }} — {{ MOIS_LONG[moisSel] }} {{ anneeSel }} ({{ dossiersDuMois.length }})</h3>
            <button class="modal-close" @click="moisSel = null">✕</button>
          </div>
          <div class="modal-body">
            <div v-if="!dossiersDuMois.length" class="empty">{{ modeMois === 'verifies' ? 'Aucun dossier vérifié' : 'Aucun dossier en attente' }} ce mois-là.</div>
            <table v-else class="mini">
              <thead><tr><th>N° lot</th><th>Code</th><th>Produit</th><th class="right">{{ modeMois === 'verifies' ? 'Envoi DDL' : 'Fin cond.' }}</th></tr></thead>
              <tbody>
                <tr v-for="l in dossiersDuMois" :key="l.id">
                  <td class="strong">{{ l.numero_lot }}</td>
                  <td>{{ l.produits ? l.produits.code_pf : '—' }}</td>
                  <td>{{ l.produits ? l.produits.designation : '—' }}</td>
                  <td class="right nowrap">{{ modeMois === 'verifies' ? fmtDate(l.ddl_cond_date_envoi) : fmtDate(dateFinCond(l)) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ddlc-page { color: #1b2733; }
.annee { display: flex; flex-direction: column; font-size: 12px; font-weight: 600; color: #475569; gap: 5px; }
.annee select { font-size: 14px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; font-weight: 600; color: #1b2733; }
.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 10px 12px; border-radius: 8px; font-size: 14px; margin: 0 0 12px; }
.muted { color: #94a3b8; }

.kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 20px; }
.kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.kpi-top { display: flex; align-items: center; gap: 10px; }
.kpi-ic { width: 34px; height: 34px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; flex: none; }
.kpi-ic svg { width: 19px; height: 19px; }
.kpi-val { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
.kpi-val.accent { color: #0f766e; }
.kpi-val.warn { color: #d97706; }
.kpi-lbl { font-size: 12px; color: #64748b; margin-top: 6px; }

.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 16px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-title { margin: 0 0 12px; font-size: 16px; }
.table-scroll { overflow-x: auto; }
table.mini { width: 100%; border-collapse: collapse; font-size: 14px; }
table.mini th { text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
table.mini td { padding: 8px 10px; border-bottom: 1px solid #eef2f6; }
.right { text-align: right; }
.nowrap { white-space: nowrap; }
.strong { font-weight: 700; }
.accent { color: #0f766e; }
.empty { color: #94a3b8; text-align: center; padding: 18px; font-style: italic; }
.verif-row { background: #f8fafc; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.verif-row input, .verif-row select { font-size: 13px; padding: 6px 9px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; }
.btn { font-size: 13px; font-weight: 600; padding: 7px 12px; border: 0; border-radius: 8px; background: #0f766e; color: #fff; cursor: pointer; }
.btn.sm { padding: 5px 12px; }
.link { background: none; border: 0; color: #0f766e; font-weight: 600; cursor: pointer; font-size: 13px; }
.link.danger { color: #dc2626; }
.hint { color: #64748b; font-size: 13px; margin-top: 4px; }

@media (max-width: 700px) { .kpi-grid { grid-template-columns: 1fr; } }
.chart-hint { font-size: 12px; color: #94a3b8; margin: 8px 0 0; font-style: italic; }
.modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.45); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
.modal { background: #fff; border-radius: 14px; width: min(680px, 100%); max-height: 82vh; display: flex; flex-direction: column; box-shadow: 0 20px 50px rgba(0,0,0,.3); }
.modal-head { display: flex; align-items: center; gap: 10px; padding: 16px 18px; border-bottom: 1px solid #e2e8f0; }
.modal-title { margin: 0; font-size: 16px; }
.modal-close { margin-left: auto; background: none; border: 0; font-size: 18px; color: #64748b; cursor: pointer; line-height: 1; }
.modal-body { overflow-y: auto; padding: 8px 18px 18px; }
.prog-row { display: flex; align-items: center; gap: 12px; padding: 7px 0; }
.prog-nom { flex: 0 0 160px; font-weight: 600; font-size: 14px; color: #1b2733; }
.prog-bar { flex: 1; height: 10px; background: #eef2f6; border-radius: 6px; overflow: hidden; }
.prog-fill { height: 100%; background: #2563eb; border-radius: 6px; }
.prog-val { flex: 0 0 auto; font-weight: 700; font-size: 14px; color: #0f766e; min-width: 30px; text-align: right; }
.verif-chk { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #b45309; font-weight: 600; white-space: nowrap; cursor: pointer; }
.verif-chk input { width: 15px; height: 15px; cursor: pointer; }

/* ============================================================= *
 * Refonte moderne — couche de surcharge (cohérence)
 * ============================================================= */
.vd-page :deep(h1), .cond-page :deep(h1), .aq-page :deep(h1) { font-size: 20px !important; }
.card { border-color: #ecebf3 !important; border-radius: 13px !important; box-shadow: 0 1px 3px rgba(30,41,59,.05) !important; }
.card-title { color: #1e40af !important; font-weight: 800 !important; letter-spacing: -.01em !important; border-left: 3px solid #2563eb; padding-left: 8px; }
.kpi { border-color: #ecebf3 !important; border-radius: 12px !important; background: #fff !important; }
.kpi-val.accent { color: #2563eb !important; }
.pddl-val.ok { color: #2563eb !important; }
.plan-ddl-top { background: linear-gradient(135deg, #eff6ff, #fff) !important; border-color: #bfdbfe !important; }
.bar-track { background: #eef0f4 !important; height: 8px !important; border-radius: 999px; }
.bar-fill.prod, .bar-fill.ok { background: linear-gradient(90deg, #2563eb, #1e40af) !important; }
.bar-fill.part { background: linear-gradient(90deg, #fbbf24, #f59e0b) !important; }
.prog-pct { color: #2563eb !important; }
.prog-pct.warn { color: #b45309 !important; }
table.mini th, .mini-vd th { color: #2563eb !important; }
table.mini tbody tr:hover td { background: #fafafa; }
.btn { background: linear-gradient(135deg, #2563eb, #1e40af) !important; border-radius: 9px !important; box-shadow: 0 2px 8px rgba(37,99,235,.22); }
.btn:hover { background: linear-gradient(135deg, #2563eb, #1e40af) !important; filter: brightness(1.07); }
.link { color: #2563eb !important; }
.link.danger { color: #b91c1c !important; }
.hist-exp { color: #2563eb !important; border-color: #bfdbfe !important; }
.hist-exp:hover { background: #eff6ff !important; }
.btn-filtre:hover { color: #2563eb !important; border-color: #bfdbfe !important; }
.annee-sel select:focus, .verif-form input:focus, .verif-form select:focus, .hist-search:focus { outline: none !important; border-color: #2563eb !important; box-shadow: 0 0 0 3px rgba(37,99,235,.22) !important; }
.sup-opt input, .verif-chk input { accent-color: #2563eb; }
.vd-modal, .cond-modal, .aq-modal { border-radius: 16px !important; }
.hist-count { background: #eff6ff !important; color: #2563eb !important; }


.kpi-val.k-ok { color: #16a34a; } .kpi-val.k-warn { color: #d97706; } .kpi-val.k-bad { color: #dc2626; }

/* Structure type Fabrication : bandeau plan + 3 colonnes */
.plan-ddl-top { padding: 12px 14px !important; margin-bottom: 12px; }
.plan-ddl-top .card-title { margin-bottom: 10px; }
.pddl-top-row { display: flex; align-items: flex-start; gap: 22px; flex-wrap: wrap; }
.pddl-top-item { display: flex; flex-direction: column; gap: 2px; }
.pddl-lbl { font-size: 11px; color: #64748b; font-weight: 600; }
.pddl-val { font-size: 18px; font-weight: 800; color: #0f172a; line-height: 1; }
.pddl-val.ok { color: #2563eb; }
.pddl-val.warn { color: #d97706; }
.pddl-val.k-ok { color: #16a34a; } .pddl-val.k-warn { color: #d97706; } .pddl-val.k-bad { color: #dc2626; }
.pddl-mini { font-size: 9px; color: #94a3b8; font-weight: 600; margin-top: 1px; }
.pddl-top-bar { flex: 1; min-width: 200px; }
.pddl-bar-head { display: flex; justify-content: space-between; font-size: 10px; color: #64748b; margin-bottom: 3px; font-weight: 600; }
.bar-track { height: 8px; background: #eef0f4; border-radius: 999px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 999px; min-width: 2px; }
.bar-fill.ok { background: linear-gradient(90deg, #2563eb, #1d4ed8); }
.bar-fill.part { background: linear-gradient(90deg, #fbbf24, #f59e0b); }
.verif-3col { display: grid; grid-template-columns: 0.72fr 1.95fr 0.72fr; gap: 12px; align-items: stretch; margin-bottom: 16px; }
.verif-3col > .v3-col { display: flex; flex-direction: column; gap: 12px; }
.verif-3col > .v3-col:first-child { grid-column: 1; }
.verif-3col > .v3-mid { grid-column: 2; display: flex; flex-direction: column; overflow: hidden; }
.verif-3col > .v3-right { grid-column: 3; }
.v3-mid > .card-title { flex: 0 0 auto; }
.v3-mid > .table-scroll, .v3-mid > .empty { flex: 1 1 auto; overflow-y: auto; min-height: 0; }
.v3-mid table.mini thead th { position: sticky; top: 0; z-index: 2; background: #eff6ff; }
@media (max-width: 1100px) {
  .verif-3col { grid-template-columns: 1fr; }
  .verif-3col > * { grid-column: auto !important; }
  .v3-mid { overflow: visible; }
}
</style>
