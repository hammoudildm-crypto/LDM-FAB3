<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'
import MiniChart from '../components/MiniChart.vue'

// Rendement du personnel : on relie chaque saisie TRS à la personne (Fait par /
// Vérifié par / Superviseur de shift) et on calcule son rendement = production
// réelle ÷ production théorique (cadence × temps de marche), + les volumes produits.
// Aucune nouvelle table : lecture de trs_postes + cadences_produit + organigramme.

const postes = ref([])
const cadences = ref([])
const personnel = ref([])
const chargement = ref(true)
const msg = ref('')

const now = new Date()
const du = ref(new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 10))
const au = ref(now.toISOString().slice(0, 10))
const role = ref('operateur')          // 'operateur' | 'chef' | 'superviseur'
const recherche = ref('')
const detail = ref(null)               // nom de la personne dont la fiche est ouverte
const MIN_POSTES = 5

const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
// [cle, colonne, groupe] — planifié vs subi (pour le temps requis / arrêts planifiés)
const MOTIFS = [
  ['format', 'arret_format_min', 'plan'], ['vdlg', 'arret_vdlg_min', 'plan'], ['vdlp', 'arret_vdlp_min', 'plan'],
  ['nettoyage', 'arret_nettoyage_min', 'plan'], ['maintenance', 'arret_maintenance_min', 'plan'],
  ['panne', 'arret_panne_min', 'subi'], ['attente', 'arret_attente_min', 'subi'],
  ['reglage', 'arret_reglage_min', 'subi'], ['autre', 'arret_autre_min', 'subi']
]
const COL_PLAN = MOTIFS.filter(m => m[2] === 'plan').map(m => m[1])
const CHAMP = { operateur: 'fait_par', chef: 'verifie_par', superviseur: 'superviseur' }
const ROLE_LBL = { operateur: 'Opérateur', chef: 'Chef de ligne', superviseur: 'Superviseur de shift' }

async function charger() {
  chargement.value = true; msg.value = ''
  const r = await supabase.from('trs_postes')
    .select('*, equipements(code, nom)')
    .eq('actif', true).gte('date', du.value).lte('date', au.value)
  if (r.error) { msg.value = r.error.message; chargement.value = false; return }
  postes.value = r.data || []
  const rc = await supabase.from('cadences_produit').select('*'); if (!rc.error) cadences.value = rc.data || []
  const ro = await supabase.from('organigramme').select('*'); if (!ro.error) personnel.value = ro.data || []
  chargement.value = false
}
onMounted(charger)

function cadenceDe(eq, pr) {
  const c = cadences.value.find(c => c.equipement_id === eq && c.produit_id === pr)
  return { value: c && c.cadence_nominale != null ? Number(c.cadence_nominale) : 0, mode: c ? (c.mode || 'debit') : 'debit' }
}
const normNom = (s) => String(s || '').trim()
const fonctionDe = (nom) => { const p = personnel.value.find(p => normNom(p.nom) === normNom(nom)); return p ? (p.fonction || '') : '' }

// Rendement (% performance) à partir d'accumulateurs : prod réelle ÷ théorique.
function rendementDe(a) {
  if (a.theo > 0) return Math.min(1, a.prodPerf / a.theo)
  if (a.fonctPerf > 0) return Math.min(1, a.ecoule / a.fonctPerf)
  return null   // pas de cadence définie -> non calculable
}
function accVide() { return { ouv: 0, fonct: 0, arrPlan: 0, theo: 0, prodPerf: 0, ecoule: 0, fonctPerf: 0, prodQual: 0, rebutsQual: 0 } }
function cumuler(a, s, to, tf, arrPlan, cd) {
  a.ouv += to; a.fonct += tf; a.arrPlan += arrPlan
  if (cd.mode === 'cycle') { a.ecoule += Number(s.production_realisee) || 0; a.fonctPerf += tf }
  else if (cd.value > 0) { a.theo += (tf / 60) * cd.value; a.prodPerf += Number(s.production_realisee) || 0; a.prodQual += Number(s.production_realisee) || 0; a.rebutsQual += Number(s.rebuts) || 0 }
}

const parPersonne = computed(() => {
  const champ = CHAMP[role.value]
  const m = {}
  for (const s of postes.value) {
    const nom = normNom(s[champ]); if (!nom) continue
    if (!m[nom]) m[nom] = {
      nom, nbPostes: 0, prodTot: 0, rebutsTot: 0, retouchesTot: 0,
      glob: accVide(), equips: new Map(),
      parMois: Array.from({ length: 12 }, accVide)
    }
    const e = m[nom]
    const to = s.temps_ouverture_min || 0
    let arr = 0, arrPlan = 0
    for (const mo of MOTIFS) { const v = s[mo[1]] || 0; arr += v }
    for (const col of COL_PLAN) arrPlan += (s[col] || 0)
    const tf = Math.max(0, to - arr)
    const cd = cadenceDe(s.equipement_id, s.produit_id)
    e.nbPostes++
    e.prodTot += Number(s.production_realisee) || 0
    e.rebutsTot += Number(s.rebuts) || 0
    e.retouchesTot += Number(s.retouches) || 0
    cumuler(e.glob, s, to, tf, arrPlan, cd)
    cumuler(e.parMois[new Date(s.date).getMonth()], s, to, tf, arrPlan, cd)
    const k = s.equipement_id || '—'
    if (!e.equips.has(k)) e.equips.set(k, { id: k, code: s.equipements ? s.equipements.code : '?', nom: s.equipements ? s.equipements.nom : '', postes: 0, prod: 0, acc: accVide() })
    const eq = e.equips.get(k); eq.postes++; eq.prod += Number(s.production_realisee) || 0; cumuler(eq.acc, s, to, tf, arrPlan, cd)
  }
  return Object.values(m).map(e => {
    const g = e.glob
    const rendement = rendementDe(g)
    const dispo = g.ouv ? g.fonct / g.ouv : 0
    const qualite = g.prodQual ? Math.max(0, (g.prodQual - g.rebutsQual) / g.prodQual) : 1
    const rebutRate = e.prodTot ? e.rebutsTot / e.prodTot : 0
    const retoucheRate = e.prodTot ? e.retouchesTot / e.prodTot : 0
    const trend = e.parMois.map(pm => { const r = rendementDe(pm); return r == null ? null : +((r * 100).toFixed(1)) })
    const topEquips = [...e.equips.values()].map(eq => ({ ...eq, rendement: rendementDe(eq.acc) })).sort((a, b) => b.prod - a.prod).slice(0, 8)
    return {
      nom: e.nom, fonction: fonctionDe(e.nom), nbPostes: e.nbPostes, prodTot: e.prodTot,
      rendement, dispo, qualite, rebutRate, retoucheRate, fonct: g.fonct, nbEquip: e.equips.size,
      trend, topEquips, suffisant: e.nbPostes >= MIN_POSTES && rendement != null
    }
  })
})

const classement = computed(() => {
  const q = recherche.value.trim().toLowerCase()
  let arr = parPersonne.value
  if (q) arr = arr.filter(p => p.nom.toLowerCase().includes(q) || (p.fonction || '').toLowerCase().includes(q))
  return arr.slice().sort((a, b) => (Number(b.suffisant) - Number(a.suffisant)) || ((b.rendement ?? -1) - (a.rendement ?? -1)))
})
const evalues = computed(() => parPersonne.value.filter(p => p.suffisant))
const rdtMoyen = computed(() => { const a = evalues.value; const tot = a.reduce((s, p) => s + p.fonct, 0); return tot ? a.reduce((s, p) => s + (p.rendement || 0) * p.fonct, 0) / tot : null })
const meilleur = computed(() => evalues.value.slice().sort((a, b) => (b.rendement || 0) - (a.rendement || 0))[0] || null)
const volumeTotal = computed(() => classement.value.reduce((s, p) => s + p.prodTot, 0))
const roleDispo = computed(() => { const c = CHAMP[role.value]; return postes.value.some(s => normNom(s[c])) })
const ficheDe = computed(() => detail.value ? parPersonne.value.find(p => p.nom === detail.value) : null)

const pctR = (v) => (v == null ? '—' : Math.round(v * 100) + ' %')
const pct1 = (v) => (v == null ? '—' : (v * 100).toFixed(1).replace('.', ',') + ' %')
const niv = (v) => (v == null ? 'none' : (v >= 0.85 ? 'vert' : (v >= 0.65 ? 'orange' : 'rouge')))
const fmtInt = (v) => Math.round(Number(v) || 0).toLocaleString('fr-FR')
function appliquer() { detail.value = null; charger() }
function choisirRole(r) { role.value = r; detail.value = null }
</script>

<template>
  <div class="perf">
    <PageHeader title="Rendement du personnel" subtitle="Rendement (production réelle ÷ théorique) et volumes produits par personne, à partir des saisies TRS — Fait par, Vérifié par et Superviseur de shift." tone="teal" />
    <p v-if="msg" class="alert">{{ msg }}</p>

    <div class="pf-bar">
      <label class="pf-f">Du<input type="date" v-model="du" /></label>
      <label class="pf-f">Au<input type="date" v-model="au" /></label>
      <button class="pf-apply" @click="appliquer">Appliquer</button>
      <div class="pf-tabs">
        <button :class="{ on: role === 'operateur' }" @click="choisirRole('operateur')">Opérateurs</button>
        <button :class="{ on: role === 'chef' }" @click="choisirRole('chef')">Chefs de ligne</button>
        <button :class="{ on: role === 'superviseur' }" @click="choisirRole('superviseur')">Superviseurs</button>
      </div>
      <input class="pf-search" v-model="recherche" placeholder="Rechercher une personne…" />
    </div>

    <p v-if="chargement" class="pf-empty">Chargement…</p>
    <p v-else-if="!roleDispo" class="pf-empty">Aucune saisie avec « {{ ROLE_LBL[role] }} » renseigné sur la période.<span v-if="role === 'superviseur'"> Renseigne le superviseur dans Saisie TRS (migration 015 requise).</span></p>

    <template v-else>
      <div class="kpi-row">
        <div class="kpi"><div class="kpi-v">{{ evalues.length }}</div><div class="kpi-l">Personnes évaluées <small>(≥ {{ MIN_POSTES }} postes)</small></div></div>
        <div class="kpi teal"><div class="kpi-v">{{ pctR(rdtMoyen) }}</div><div class="kpi-l">Rendement moyen (pondéré)</div></div>
        <div class="kpi"><div class="kpi-v">{{ fmtInt(volumeTotal) }}</div><div class="kpi-l">Volume produit (période)</div></div>
        <div class="kpi vert"><div class="kpi-v sm">{{ meilleur ? meilleur.nom : '—' }}</div><div class="kpi-l">Meilleur rendement<template v-if="meilleur"> · {{ pctR(meilleur.rendement) }}</template></div></div>
      </div>

      <section class="card">
        <div class="tb"><h2 class="card-title">Classement — {{ ROLE_LBL[role] }}s <span class="ct-sub">rendement décroissant</span></h2></div>
        <div class="tbl-scroll">
          <table class="tbl">
            <thead><tr><th>#</th><th>Personne</th><th class="r">Postes</th><th class="rdt-col">Rendement</th><th class="r">Quantité produite</th><th class="r">Rebuts</th><th class="r">Retouches</th><th class="r">Polyv.</th><th></th></tr></thead>
            <tbody>
              <tr v-for="(p, i) in classement" :key="p.nom" :class="{ insuff: !p.suffisant }">
                <td class="rang">{{ p.suffisant ? i + 1 : '·' }}</td>
                <td class="nom">{{ p.nom }}<span v-if="p.fonction" class="sub2"> · {{ p.fonction }}</span></td>
                <td class="r">{{ p.nbPostes }}</td>
                <td>
                  <div class="rdt-cell">
                    <div class="rdt-bar"><span class="rdt-f" :class="niv(p.rendement)" :style="{ width: (p.rendement == null ? 0 : Math.round(p.rendement * 100)) + '%' }"></span></div>
                    <b :class="niv(p.rendement)">{{ pctR(p.rendement) }}</b>
                  </div>
                </td>
                <td class="r vol">{{ fmtInt(p.prodTot) }}</td>
                <td class="r" :class="{ warnq: p.rebutRate > 0.03 }">{{ pct1(p.rebutRate) }}</td>
                <td class="r">{{ pct1(p.retoucheRate) }}</td>
                <td class="r">{{ p.nbEquip }}</td>
                <td class="r"><button class="icon-b" @click="detail = detail === p.nom ? null : p.nom">{{ detail === p.nom ? '▲' : 'Détail' }}</button></td>
              </tr>
              <tr v-if="!classement.length"><td colspan="9" class="vide">Aucune donnée sur la période.</td></tr>
            </tbody>
          </table>
        </div>
        <p class="pf-note">Rendement = production réelle ÷ production théorique (cadence × temps de marche), plafonné à 100 % — comparable d'une machine à l'autre. Les quantités dépendent de l'équipement (non comparables entre lignes). Les personnes avec moins de {{ MIN_POSTES }} postes (ou sans cadence définie) apparaissent en gris, hors classement.</p>
      </section>

      <section v-if="ficheDe" class="card fiche">
        <div class="tb"><h2 class="card-title">{{ ficheDe.nom }}<span v-if="ficheDe.fonction" class="ct-sub"> · {{ ficheDe.fonction }}</span></h2><button class="icon-b" @click="detail = null">Fermer ✕</button></div>
        <div class="fiche-kpis">
          <div class="fk"><span class="fk-l">Rendement</span><b :class="niv(ficheDe.rendement)">{{ pctR(ficheDe.rendement) }}</b></div>
          <div class="fk"><span class="fk-l">Quantité produite</span><b>{{ fmtInt(ficheDe.prodTot) }}</b></div>
          <div class="fk"><span class="fk-l">Postes réalisés</span><b>{{ ficheDe.nbPostes }}</b></div>
          <div class="fk"><span class="fk-l">Temps de marche</span><b>{{ fmtInt(ficheDe.fonct) }} min</b></div>
          <div class="fk"><span class="fk-l">Rebuts</span><b>{{ pct1(ficheDe.rebutRate) }}</b></div>
          <div class="fk"><span class="fk-l">Retouches</span><b>{{ pct1(ficheDe.retoucheRate) }}</b></div>
          <div class="fk"><span class="fk-l">Disponibilité</span><b>{{ pctR(ficheDe.dispo) }}</b></div>
          <div class="fk"><span class="fk-l">Qualité</span><b>{{ pctR(ficheDe.qualite) }}</b></div>
        </div>
        <div class="fiche-grid">
          <div class="fg-card">
            <h3 class="fg-t">Rendement mensuel</h3>
            <MiniChart :labels="MOIS" :format="v => v + ' %'" show-values :value-format="v => v ? Math.round(v) + '%' : ''" :max="100" :series="[{ label: 'Rendement', color: '#0d9488', data: ficheDe.trend }]" />
          </div>
          <div class="fg-card">
            <h3 class="fg-t">Par équipement</h3>
            <div class="tbl-scroll">
              <table class="tbl mini2">
                <thead><tr><th>Équipement</th><th class="r">Postes</th><th class="r">Qté</th><th class="r">Rendement</th></tr></thead>
                <tbody>
                  <tr v-for="eq in ficheDe.topEquips" :key="eq.id"><td class="nom">{{ eq.code }}<span v-if="eq.nom" class="sub2"> · {{ eq.nom }}</span></td><td class="r">{{ eq.postes }}</td><td class="r">{{ fmtInt(eq.prod) }}</td><td class="r"><b :class="niv(eq.rendement)">{{ pctR(eq.rendement) }}</b></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.perf { max-width: 1320px; margin: 0 auto; padding: 6px 4px 24px; }
.alert { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; border-radius: 10px; padding: 10px 14px; font-size: 13px; }
.pf-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 4px 0 16px; }
.pf-f { display: flex; flex-direction: column; gap: 3px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .03em; }
.pf-f input { font-size: 14px; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; }
.pf-apply { align-self: flex-end; background: #0d9488; color: #fff; border: 0; border-radius: 8px; padding: 9px 16px; font-size: 13px; font-weight: 700; cursor: pointer; }
.pf-tabs { display: inline-flex; gap: 2px; background: #f1f5f9; border-radius: 9px; padding: 3px; }
.pf-tabs button { border: 0; background: none; font-size: 13px; font-weight: 700; color: #64748b; padding: 7px 14px; border-radius: 7px; cursor: pointer; }
.pf-tabs button.on { background: #fff; color: #0f766e; box-shadow: 0 1px 2px rgba(16,24,40,.1); }
.pf-search { flex: 1; min-width: 180px; font-size: 14px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; }
.pf-empty { color: #64748b; font-size: 14px; padding: 24px 4px; }
.kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 16px; }
.kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; border-left: 4px solid #cbd5e1; }
.kpi-v { font-size: 26px; font-weight: 800; color: #0f172a; line-height: 1.1; }
.kpi-v.sm { font-size: 17px; }
.kpi-l { font-size: 12px; color: #64748b; font-weight: 600; margin-top: 3px; }
.kpi-l small { font-weight: 500; color: #94a3b8; }
.kpi.teal { border-left-color: #0d9488; } .kpi.teal .kpi-v { color: #0f766e; }
.kpi.vert { border-left-color: #16a34a; } .kpi.vert .kpi-v { color: #15803d; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px 18px; margin-bottom: 16px; }
.tb { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.card-title { margin: 0; font-size: 16px; font-weight: 800; }
.ct-sub { font-size: 12px; font-weight: 600; color: #94a3b8; }
.tbl-scroll { overflow-x: auto; }
.tbl { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.tbl th { text-align: left; font-size: 11.5px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; padding: 8px 10px; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
.tbl td { padding: 9px 10px; border-bottom: 1px solid #eef2f6; }
.tbl td.nom { font-weight: 700; color: #0f172a; }
.r { text-align: right; } .rdt-col { min-width: 160px; }
.rang { font-weight: 800; color: #94a3b8; width: 28px; }
.sub2 { color: #94a3b8; font-weight: 400; font-size: 12px; }
.vol { font-weight: 700; font-variant-numeric: tabular-nums; }
.warnq { color: #b45309; font-weight: 700; }
.rdt-cell { display: flex; align-items: center; gap: 9px; min-width: 150px; }
.rdt-bar { flex: 1; height: 11px; background: #f1f5f9; border-radius: 6px; overflow: hidden; min-width: 70px; }
.rdt-f { display: block; height: 100%; border-radius: 6px; }
.rdt-f.vert { background: #16a34a; } .rdt-f.orange { background: #d97706; } .rdt-f.rouge { background: #dc2626; } .rdt-f.none { background: #cbd5e1; }
.rdt-cell b { font-variant-numeric: tabular-nums; min-width: 46px; text-align: right; }
b.vert { color: #15803d; } b.orange { color: #b45309; } b.rouge { color: #dc2626; } b.none { color: #94a3b8; }
.insuff { opacity: .55; }
.insuff .nom { font-weight: 600; }
.vide { text-align: center; color: #94a3b8; padding: 22px; }
.icon-b { border: 1px solid #e2e8f0; background: #fff; color: #475569; font-size: 12.5px; font-weight: 700; padding: 4px 10px; border-radius: 7px; cursor: pointer; }
.icon-b:hover { background: #f8fafc; }
.pf-note { margin: 12px 2px 0; font-size: 12px; color: #94a3b8; line-height: 1.5; }
.fiche { border-color: #99f6e4; }
.fiche-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; margin-bottom: 16px; }
.fk { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 9px 12px; display: flex; flex-direction: column; gap: 2px; }
.fk-l { font-size: 11px; color: #64748b; font-weight: 600; }
.fk b { font-size: 17px; color: #0f172a; font-variant-numeric: tabular-nums; }
.fiche-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.fg-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; }
.fg-t { margin: 0 0 10px; font-size: 13px; font-weight: 800; color: #0f172a; }
.mini2 { font-size: 12.5px; }
.mini2 th { font-size: 10.5px; padding: 6px 8px; }
.mini2 td { padding: 6px 8px; }
@media (max-width: 760px) { .fiche-grid { grid-template-columns: 1fr; } }
</style>
