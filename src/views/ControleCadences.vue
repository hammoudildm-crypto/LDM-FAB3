<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'

// Contrôle des cadences : pour chaque équipement, est-il prêt pour le calcul du TRS ?
// (cadence présente, mode cohérent, produits saisis couverts). Lecture seule.

const equipements = ref([])
const cadences = ref([])
const produits = ref([])
const postes = ref([])
const chargement = ref(true)
const msg = ref('')
const masquerInactifs = ref(true)
const JOURS = 90   // fenêtre d'analyse des produits réellement fabriqués

function phaseDeType(type) {
  const t = (type || '').toLowerCase()
  if (/pes[ée]|balance|bascule/.test(t)) return 'pesee'
  if (/granul|séch|sech/.test(t)) return 'granulation'
  if (/mélang|melang/.test(t)) return 'melange'
  if (/gélule|gelule|remplis|encapsul|capsul/.test(t)) return 'remplissage'
  if (/compress|presse|compri/.test(t)) return 'compression'
  if (/pellicul|enrob|coat|dragé|drage/.test(t)) return 'pelliculage'
  if (/condition|blister|thermoform|uhlmann|integra|marchesini|emball|étui|etui|fardel|encart|mise en bo/.test(t)) return 'conditionnement'
  return null
}
const PHASE_LBL = { pesee: 'Pesée', granulation: 'Granulation / Séchage', melange: 'Mélange', compression: 'Compression', remplissage: 'Remplissage', pelliculage: 'Pelliculage', conditionnement: 'Conditionnement' }
const STATUT = {
  pret: { l: 'Prêt', c: 'ok' }, partiel: { l: 'À compléter', c: 'warn' },
  cycle: { l: 'Ancien mode — à migrer', c: 'migr' },
  manquant: { l: 'Non configuré', c: 'bad' }, mixte: { l: 'Modes mélangés', c: 'warn' }, inactif: { l: 'Non utilisé', c: 'muet' }
}

async function charger() {
  chargement.value = true; msg.value = ''
  const re = await supabase.from('equipements').select('id, code, nom, type').eq('actif', true).order('code')
  if (re.error) { msg.value = re.error.message; chargement.value = false; return }
  equipements.value = re.data || []
  const rc = await supabase.from('cadences_produit').select('equipement_id, produit_id, cadence_nominale, mode'); if (!rc.error) cadences.value = rc.data || []
  const rp = await supabase.from('produits').select('id, poids_lot_kg'); if (!rp.error) produits.value = rp.data || []
  const depuis = new Date(Date.now() - JOURS * 864e5).toISOString().slice(0, 10)
  const rs = await supabase.from('trs_postes').select('equipement_id, produit_id').eq('actif', true).gte('date', depuis); if (!rs.error) postes.value = rs.data || []
  chargement.value = false
}
onMounted(charger)

// Masse d'un lot en kg (colonne « Poids du lot (kg) ») — nécessaire pour les cadences en mode temps.
const tailleMap = computed(() => { const m = {}; for (const p of produits.value) m[p.id] = Number(p.poids_lot_kg) || 0; return m })

const audit = computed(() => {
  const cadByEq = {}
  for (const c of cadences.value) { if ((Number(c.cadence_nominale) || 0) <= 0) continue; (cadByEq[c.equipement_id] = cadByEq[c.equipement_id] || []).push({ pid: c.produit_id, mode: c.mode || 'debit' }) }
  const prodByEq = {}, nbSaisiesByEq = {}
  for (const s of postes.value) { nbSaisiesByEq[s.equipement_id] = (nbSaisiesByEq[s.equipement_id] || 0) + 1; if (s.produit_id) (prodByEq[s.equipement_id] = prodByEq[s.equipement_id] || new Set()).add(s.produit_id) }
  return equipements.value.map(e => {
    const cads = cadByEq[e.id] || []
    const modes = new Set(cads.map(c => c.mode))
    const nbCycle = cads.filter(c => c.mode === 'cycle').length   // ancien mode « temps écoulé » (à migrer)
    const modePrincipal = modes.has('temps') ? 'temps' : (modes.has('cycle') && !modes.has('debit') ? 'cycle' : (cads.length ? 'debit' : null))
    const mixed = new Set(cads.filter(c => c.mode !== 'cycle').map(c => c.mode)).size > 1
    const cadPids = new Set(cads.map(c => c.pid))
    const produced = prodByEq[e.id] || new Set()
    const nbSaisies = nbSaisiesByEq[e.id] || 0
    const manquants = [...produced].filter(pid => !cadPids.has(pid)).length
    const tailleManquante = modePrincipal === 'temps' ? cads.filter(c => !tailleMap.value[c.pid]).length : 0
    let statut
    if (nbSaisies === 0) statut = 'inactif'
    else if (cads.length === 0) statut = 'manquant'
    else if (nbCycle > 0) statut = 'cycle'
    else if (manquants > 0) statut = 'partiel'
    else if (mixed) statut = 'mixte'
    else statut = 'pret'
    return { id: e.id, code: e.code, nom: e.nom, phase: phaseDeType(e.type), modePrincipal, mixed, nbCycle, nbCad: cads.length, nbProduced: produced.size, manquants, tailleManquante, nbSaisies, statut }
  })
})

const ORDRE = { manquant: 0, cycle: 1, partiel: 2, mixte: 3, pret: 4, inactif: 5 }
const liste = computed(() => audit.value.filter(e => !(masquerInactifs.value && e.statut === 'inactif')).slice().sort((a, b) => (ORDRE[a.statut] - ORDRE[b.statut]) || String(a.code).localeCompare(String(b.code))))
const nb = (s) => audit.value.filter(e => e.statut === s).length
const aRegler = computed(() => nb('manquant') + nb('cycle') + nb('partiel') + nb('mixte'))

function lienCadence(e) { return { path: '/cadences', query: { vue: 'matrice', phase: e.phase || undefined, eq: e.id } } }
const modeLbl = (m) => m === 'temps' ? 'Temps (min/lot)' : (m === 'cycle' ? 'Temps écoulé (ancien)' : (m === 'debit' ? 'Débit (kg/h · bts/h)' : '—'))
</script>

<template>
  <div class="cc">
    <PageHeader title="Contrôle des cadences — prêt pour le TRS" subtitle="Pour chaque équipement : la cadence est-elle définie et cohérente pour calculer la Performance et le TRS ? Analyse des produits réellement fabriqués sur les 90 derniers jours." tone="teal" />
    <p v-if="msg" class="alert">{{ msg }}</p>

    <div class="kpi-row">
      <div class="kpi vert"><div class="kpi-v">{{ nb('pret') }}</div><div class="kpi-l">Prêts pour le TRS</div></div>
      <div class="kpi migr"><div class="kpi-v">{{ nb('cycle') }}</div><div class="kpi-l">⚠ Ancien mode « temps écoulé » à migrer</div></div>
      <div class="kpi orange"><div class="kpi-v">{{ nb('partiel') + nb('mixte') }}</div><div class="kpi-l">À compléter</div></div>
      <div class="kpi rouge"><div class="kpi-v">{{ nb('manquant') }}</div><div class="kpi-l">Non configurés</div></div>
      <div class="kpi"><div class="kpi-v">{{ nb('inactif') }}</div><div class="kpi-l">Non utilisés (90 j)</div></div>
    </div>

    <p v-if="!chargement && aRegler === 0" class="cc-ok">✅ Tous tes équipements utilisés sont correctement configurés pour le TRS. Rien à corriger.</p>

    <section class="card">
      <div class="tb">
        <h2 class="card-title">État par équipement</h2>
        <label class="cc-chk"><input type="checkbox" v-model="masquerInactifs" /> Masquer les non utilisés</label>
      </div>
      <div class="tbl-scroll">
        <table class="tbl">
          <thead><tr><th>Statut</th><th>Équipement</th><th>Phase</th><th>Mode</th><th class="r">Cadences</th><th class="r">Produits saisis sans cadence</th><th class="r">Saisies (90 j)</th><th></th></tr></thead>
          <tbody>
            <tr v-for="e in liste" :key="e.id" :class="'row-' + STATUT[e.statut].c">
              <td><span class="stag" :class="STATUT[e.statut].c">{{ STATUT[e.statut].l }}</span></td>
              <td class="nom">{{ e.code }}<span v-if="e.nom" class="sub2"> · {{ e.nom }}</span></td>
              <td>{{ e.phase ? PHASE_LBL[e.phase] : '—' }}</td>
              <td :class="{ warn: e.mixed || e.nbCycle }">{{ modeLbl(e.modePrincipal) }}<span v-if="e.nbCycle" class="migr-txt"> · ⚠ {{ e.nbCycle }} en ancien « temps écoulé »</span><span v-if="e.mixed" class="sub2"> · mélangés !</span><span v-if="e.tailleManquante" class="sub2"> · {{ e.tailleManquante }} sans poids de lot (kg)</span></td>
              <td class="r">{{ e.nbCad }}</td>
              <td class="r" :class="{ warn: e.manquants > 0 }"><b v-if="e.manquants > 0">{{ e.manquants }}</b><span v-else>—</span></td>
              <td class="r">{{ e.nbSaisies }}</td>
              <td class="r"><RouterLink :to="lienCadence(e)" class="cc-btn">Régler →</RouterLink></td>
            </tr>
            <tr v-if="!liste.length"><td colspan="8" class="vide">{{ chargement ? 'Chargement…' : 'Aucun équipement à afficher.' }}</td></tr>
          </tbody>
        </table>
      </div>
      <p class="cc-note"><b>Lecture :</b> <span class="stag bad">Non configuré</span> = aucune cadence, la Performance et le TRS resteront « n/d » tant qu'on n'en définit pas une. <span class="stag migr">Ancien mode — à migrer</span> = cadence encore en « temps écoulé » (ancien calcul par cycle, <b>faux</b>) : à repasser en <b>Débit (kg/h)</b> ou <b>Temps (min/lot)</b> sur la page Cadences. <span class="stag warn">À compléter</span> = certains produits fabriqués n'ont pas de cadence (leurs postes auront une Performance « n/d »). <span class="stag ok">Prêt</span> = tout est couvert. Les <b>Non utilisés</b> n'ont aucune saisie sur 90 jours — pas urgent.</p>
    </section>
  </div>
</template>

<style scoped>
.cc { max-width: 1280px; margin: 0 auto; padding: 6px 4px 24px; }
.alert { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; border-radius: 10px; padding: 10px 14px; font-size: 13px; }
.kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin: 4px 0 16px; }
.kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; border-left: 4px solid #cbd5e1; }
.kpi-v { font-size: 28px; font-weight: 800; color: #0f172a; line-height: 1.1; }
.kpi-l { font-size: 12px; color: #64748b; font-weight: 600; margin-top: 3px; }
.kpi.vert { border-left-color: #16a34a; } .kpi.vert .kpi-v { color: #15803d; }
.kpi.orange { border-left-color: #d97706; } .kpi.orange .kpi-v { color: #b45309; }
.kpi.migr { border-left-color: #ea580c; background: #fff7ed; } .kpi.migr .kpi-v { color: #c2410c; }
.kpi.rouge { border-left-color: #dc2626; } .kpi.rouge .kpi-v { color: #dc2626; }
.cc-ok { background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; border-radius: 10px; padding: 12px 16px; font-size: 14px; font-weight: 600; margin-bottom: 16px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px 18px; }
.tb { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.card-title { margin: 0; font-size: 16px; font-weight: 800; }
.cc-chk { margin-left: auto; font-size: 12.5px; color: #475569; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.tbl-scroll { overflow-x: auto; }
.tbl { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.tbl th { text-align: left; font-size: 11.5px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
.tbl td { padding: 9px 10px; border-bottom: 1px solid #eef2f6; vertical-align: middle; }
.tbl td.nom { font-weight: 700; color: #0f172a; }
.r { text-align: right; } .sub2 { color: #94a3b8; font-weight: 400; font-size: 12px; }
.warn { color: #b45309; font-weight: 700; }
.row-bad { background: #fff7f7; } .row-warn { background: #fffbeb; }
.vide { text-align: center; color: #94a3b8; padding: 22px; }
.stag { font-size: 11px; font-weight: 800; padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
.stag.ok { background: #f0fdf4; color: #15803d; } .stag.warn { background: #fff7ed; color: #b45309; } .stag.bad { background: #fef2f2; color: #dc2626; } .stag.muet { background: #f1f5f9; color: #94a3b8; }
.stag.migr { background: #ffedd5; color: #c2410c; }
.migr-txt { color: #c2410c; font-weight: 700; font-size: 12px; }
.row-migr { background: #fff7ed; }
.cc-btn { display: inline-block; border: 1px solid #99f6e4; background: #f0fdfa; color: #0f766e; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 7px; text-decoration: none; white-space: nowrap; }
.cc-btn:hover { background: #0d9488; border-color: #0d9488; color: #fff; }
.cc-note { margin: 12px 2px 0; font-size: 12px; color: #64748b; line-height: 1.8; }
.cc-note .stag { font-size: 10px; padding: 2px 7px; }
</style>
