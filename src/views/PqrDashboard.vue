<template>
  <div class="pqr-page">
    <PageHeader title="Tableau de bord PQR — Revue produit" tone="#a855f7"
      subtitle="Conformité, tendances, capabilité (Cp/Cpk) et maîtrise statistique des paramètres critiques." />

    <p v-if="erreur" class="alert">{{ erreur }}</p>

    <section class="card">
      <div class="pqr-bar">
        <div class="f">
          <label>Rechercher</label>
          <input v-model="rechercheProd" class="prod-search" placeholder="🔍 Code ou produit" />
        </div>
        <div class="f grow">
          <label>Produit <span v-if="rechercheProd" class="cnt">({{ produitsFiltres.length }})</span></label>
          <select v-model="produitSel"><option value="">—</option><option v-for="pr in produitsFiltres" :key="pr.id" :value="String(pr.id)">{{ pr.code_pf }} — {{ pr.designation }}</option></select>
        </div>
        <div class="f"><label>Du</label><input type="date" v-model="dateDu" /></div>
        <div class="f"><label>Au</label><input type="date" v-model="dateAu" /></div>
        <button v-if="dateDu || dateAu" class="btn ghost sm" @click="dateDu=''; dateAu=''">Toute période</button>
        <button v-if="produitSel && mesuresFiltrees.length" class="btn sm" style="margin-left:auto" @click="exporterPDF">📄 Exporter la revue (PDF)</button>
      </div>

      <div v-if="!produitSel" class="empty-card">Choisis un produit pour afficher sa revue qualité.</div>
      <div v-else-if="!mesures.length" class="empty-card">Aucune mesure saisie pour ce produit.</div>
      <div v-else-if="!mesuresFiltrees.length" class="empty-card">Aucune mesure sur la période choisie.</div>

      <template v-else>
        <div class="kpis">
          <div class="kpi"><div class="kv">{{ mesuresFiltrees.length }}</div><div class="kl">Mesures</div></div>
          <div class="kpi"><div class="kv">{{ nbLots }}</div><div class="kl">Lots</div></div>
          <div class="kpi" :class="tauxGlobal >= 95 ? 'good' : 'warn'"><div class="kv">{{ tauxGlobal.toFixed(1) }}%</div><div class="kl">Conformité</div></div>
          <div class="kpi" :class="{ bad: nbHors > 0 }"><div class="kv">{{ nbHors }}</div><div class="kl">Hors spec</div></div>
        </div>

        <h3 class="sec-titre">Synthèse par paramètre</h3>
        <p class="hint">Clique une ligne pour voir ses graphiques. Cpk ≥ 1,33 : capable · 1,00–1,33 : acceptable · &lt; 1,00 : insuffisant.</p>
        <div class="syn-layout">
          <aside class="syn-side">
            <button :class="{ on: !phaseSyn }" @click="phaseSyn = ''">Toutes</button>
            <button v-for="ph in phasesAvecMesures" :key="ph" :class="{ on: phaseSyn === ph }" @click="phaseSyn = ph">{{ ph }}</button>
          </aside>
          <div class="syn-main">
        <div v-for="ph in phasesSynAffichees" :key="ph" class="pqr-phase">
          <h4 class="pqr-phase-titre">{{ ph }}</h4>
          <table class="pqr-tbl">
            <thead><tr><th>Paramètre</th><th class="r">n</th><th class="r">Moyenne</th><th class="r">σ</th><th class="r">Limites</th><th class="r">Conf.</th><th class="r">Cp</th><th class="r">Cpk</th><th>Capabilité</th></tr></thead>
            <tbody>
              <template v-for="et in etapesDeSyn(ph)" :key="ph + '|' + et">
              <tr v-if="et" class="etape-row"><td colspan="9">{{ et }}</td></tr>
              <tr v-for="r in syntheseDeEtape(ph, et)" :key="r.id" :class="{ sel: r.id === paramSel }" @click="paramSel = r.id">
                <td class="nom">{{ r.nom }} <span v-if="r.bool" class="tag-bool">ON/OFF</span><span v-else class="u">{{ r.unite ? '(' + r.unite + ')' : '' }}</span></td>
                <td class="r">{{ r.n }}</td>
                <td class="r">{{ r.bool ? (r.nOn + ' ON / ' + (r.n - r.nOn) + ' OFF') : fmtNum(r.mean) }}</td>
                <td class="r">{{ r.bool ? '—' : r.std.toFixed(3) }}</td>
                <td class="r lim">{{ r.bool ? (r.attendu ? 'Att. ' + r.attendu : 'ON/OFF') : limTxt(r.lsl, r.usl) }}</td>
                <td class="r"><span :class="r.conf >= 100 ? 'c-ok' : 'c-ko'">{{ r.conf.toFixed(0) }}%</span></td>
                <td class="r">{{ r.bool ? '—' : (r.cp != null ? r.cp.toFixed(2) : '—') }}</td>
                <td class="r cpk">{{ r.bool ? '—' : (r.cpk != null ? r.cpk.toFixed(2) : '—') }}</td>
                <td><span class="verdict" :class="r.bool ? 'v-na' : verdictCls(r.cpk)">{{ r.bool ? 'ON/OFF' : verdictTxt(r.cpk) }}</span></td>
              </tr>
              </template>
            </tbody>
          </table>
        </div>
          </div>
        </div>

        <div class="chart-head">
          <h3 class="sec-titre">{{ paramSelObj ? paramSelObj.nom : '—' }}<span v-if="paramSelObj && uniteEff(paramSelObj)" class="u"> ({{ uniteEff(paramSelObj) }})</span></h3>
          <div class="tabs">
            <button :class="{ on: chartMode === 'trend' }" @click="chartMode = 'trend'">Tendance vs specs</button>
            <button :class="{ on: chartMode === 'control' }" @click="chartMode = 'control'">Carte de contrôle</button>
          </div>
        </div>

        <!-- Tendance vs specs -->
        <div v-if="chartMode === 'trend'">
          <div v-if="chartData" class="chart-wrap">
            <svg :viewBox="'0 0 ' + chartData.W + ' ' + chartData.H" class="trend" preserveAspectRatio="xMidYMid meet">
              <line :x1="chartData.mL" :y1="chartData.mT" :x2="chartData.mL" :y2="chartData.H - chartData.mB" class="axis" />
              <line :x1="chartData.mL" :y1="chartData.H - chartData.mB" :x2="chartData.W - chartData.mR" :y2="chartData.H - chartData.mB" class="axis" />
              <template v-if="chartData.yUsl != null"><line :x1="chartData.mL" :y1="chartData.yUsl" :x2="chartData.W - chartData.mR" :y2="chartData.yUsl" class="l-spec" /><text :x="chartData.W - chartData.mR" :y="chartData.yUsl - 4" class="lbl-spec">Max {{ chartData.usl }}</text></template>
              <template v-if="chartData.yLsl != null"><line :x1="chartData.mL" :y1="chartData.yLsl" :x2="chartData.W - chartData.mR" :y2="chartData.yLsl" class="l-spec" /><text :x="chartData.W - chartData.mR" :y="chartData.yLsl + 13" class="lbl-spec">Min {{ chartData.lsl }}</text></template>
              <line v-if="chartData.yCible != null" :x1="chartData.mL" :y1="chartData.yCible" :x2="chartData.W - chartData.mR" :y2="chartData.yCible" class="l-cible" />
              <path :d="chartData.path" class="l-data" />
              <circle v-for="(pt, i) in chartData.pts" :key="i" :cx="pt.x" :cy="pt.y" r="4.5" :class="pt.ko ? 'pt-ko' : 'pt-ok'"><title>{{ pt.lot }} : {{ pt.v }}</title></circle>
              <g v-for="(pt, i) in chartData.pts" :key="'ll' + i"><text v-if="i % chartData.step === 0" :x="pt.x" :y="chartData.H - chartData.mB + 11" class="lot-lbl" :transform="'rotate(-45 ' + pt.x + ' ' + (chartData.H - chartData.mB + 11) + ')'">{{ pt.lot }}</text></g>
              <text :x="chartData.mL - 6" :y="chartData.mT + 5" class="ax">{{ chartData.ymax.toFixed(1) }}</text>
              <text :x="chartData.mL - 6" :y="chartData.H - chartData.mB + 4" class="ax">{{ chartData.ymin.toFixed(1) }}</text>
            </svg>
            <div class="leg"><span class="lg"><i class="d-ok"></i>Conforme</span><span class="lg"><i class="d-ko"></i>Hors spec</span><span class="lg"><i class="l-c"></i>Cible</span><span class="lg"><i class="l-s"></i>Limites spec</span></div>
          </div>
          <div v-else-if="paramBool" class="empty-sm">Paramètre ON/OFF — pas de courbe applicable (conformité dans la synthèse).</div>
          <div v-else class="empty-sm">Sélectionne un paramètre ci-dessus.</div>
        </div>

        <!-- Carte de contrôle -->
        <div v-else>
          <div v-if="controlData" class="chart-wrap">
            <svg :viewBox="'0 0 ' + controlData.W + ' ' + controlData.H" class="trend" preserveAspectRatio="xMidYMid meet">
              <line :x1="controlData.mL" :y1="controlData.mT" :x2="controlData.mL" :y2="controlData.H - controlData.mB" class="axis" />
              <line :x1="controlData.mL" :y1="controlData.H - controlData.mB" :x2="controlData.W - controlData.mR" :y2="controlData.H - controlData.mB" class="axis" />
              <line :x1="controlData.mL" :y1="controlData.yUcl" :x2="controlData.W - controlData.mR" :y2="controlData.yUcl" class="l-ucl" />
              <line :x1="controlData.mL" :y1="controlData.yLcl" :x2="controlData.W - controlData.mR" :y2="controlData.yLcl" class="l-ucl" />
              <line :x1="controlData.mL" :y1="controlData.y2u" :x2="controlData.W - controlData.mR" :y2="controlData.y2u" class="l-sig" />
              <line :x1="controlData.mL" :y1="controlData.y2l" :x2="controlData.W - controlData.mR" :y2="controlData.y2l" class="l-sig" />
              <line :x1="controlData.mL" :y1="controlData.y1u" :x2="controlData.W - controlData.mR" :y2="controlData.y1u" class="l-sig1" />
              <line :x1="controlData.mL" :y1="controlData.y1l" :x2="controlData.W - controlData.mR" :y2="controlData.y1l" class="l-sig1" />
              <line :x1="controlData.mL" :y1="controlData.yCl" :x2="controlData.W - controlData.mR" :y2="controlData.yCl" class="l-cl" />
              <text :x="controlData.W - controlData.mR" :y="controlData.yUcl - 4" class="lbl-ucl">+3σ</text>
              <text :x="controlData.W - controlData.mR" :y="controlData.yLcl + 12" class="lbl-ucl">−3σ</text>
              <text :x="controlData.W - controlData.mR" :y="controlData.yCl - 4" class="lbl-cl">x̄ {{ fmtNum(controlData.mean) }}</text>
              <path :d="controlData.path" class="l-data" />
              <g v-for="(pt, i) in controlData.pts" :key="i">
                <circle v-if="pt.viol.length" :cx="pt.x" :cy="pt.y" r="7.5" class="pt-ring" />
                <circle :cx="pt.x" :cy="pt.y" r="4.5" :class="pt.viol.length ? 'pt-ko' : 'pt-ok'"><title>{{ pt.lot }} : {{ pt.v }}{{ pt.viol.length ? ' — ' + pt.viol.join(', ') : '' }}</title></circle>
              </g>
              <g v-for="(pt, i) in controlData.pts" :key="'cll' + i"><text v-if="i % controlData.step === 0" :x="pt.x" :y="controlData.H - controlData.mB + 11" class="lot-lbl" :transform="'rotate(-45 ' + pt.x + ' ' + (controlData.H - controlData.mB + 11) + ')'">{{ pt.lot }}</text></g>
              <text :x="controlData.mL - 6" :y="controlData.mT + 5" class="ax">{{ controlData.ymax.toFixed(1) }}</text>
              <text :x="controlData.mL - 6" :y="controlData.H - controlData.mB + 4" class="ax">{{ controlData.ymin.toFixed(1) }}</text>
            </svg>
            <div class="leg"><span class="lg"><i class="l-clg"></i>Moyenne (CL)</span><span class="lg"><i class="l-ug"></i>±3σ (UCL/LCL)</span><span class="lg"><i class="d-ko"></i>Violation de règle</span></div>
            <div v-if="controlData.alertes.length" class="viol-box">
              <div class="viol-titre">⚠ Signaux de maîtrise détectés</div>
              <div v-for="(a, i) in controlData.alertes" :key="i" class="viol-row"><b>{{ a.lot }}</b> ({{ a.v }}) — {{ a.rules.join(' · ') }}</div>
            </div>
            <div v-else class="viol-ok">✓ Procédé sous contrôle — aucune règle Nelson/Westgard déclenchée.</div>
            <p class="hint rules">Règles : <b>1-3s</b> 1 pt &gt; 3σ · <b>2-2s</b> 2 pts &gt; 2σ même côté · <b>4-1s</b> 4 pts &gt; 1σ même côté · <b>9-x</b> 9 pts du même côté · <b>tendance</b> 6 pts croissants/décroissants.</p>
          </div>
          <div v-else-if="paramBool" class="empty-sm">Carte de contrôle non applicable à un paramètre ON/OFF.</div>
          <div v-else class="empty-sm">Au moins 2 mesures sont nécessaires pour construire la carte de contrôle.</div>
        </div>

        <h3 class="sec-titre">Lots hors spec</h3>
        <div v-if="!horsSpecListe.length" class="empty-sm">Aucun lot hors spec 🎉</div>
        <table v-else class="pqr-tbl">
          <thead><tr><th>Lot</th><th>Phase</th><th>Paramètre</th><th class="r">Valeur</th><th class="r">Limites</th><th>Date</th></tr></thead>
          <tbody>
            <tr v-for="(h, i) in horsSpecListe" :key="i" class="row-ko">
              <td class="nom">{{ h.lot }}</td><td>{{ h.phase }}</td><td>{{ h.nom }}</td>
              <td class="r val-ko">{{ h.valeur }} {{ h.unite }}</td><td class="r lim">{{ h.bool ? ('Attendu ' + h.attendu) : limTxt(h.lsl, h.usl) }}</td><td>{{ h.date || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </template>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'

const PHASES_LISTE = ['Pesée', 'Granulation et Séchage', 'Mélange', 'Compression', 'Remplissage Gélules', 'Pelliculage', 'Contrôle Qualité']
const ETAPES_ORDRE = ['Mélange sec', 'Mouillage', 'Granulation', 'Séchage', 'Calibrage', 'Tamisage', 'Lubrification', 'Réglage', 'Démarrage', 'Milieu', 'Fin']
const etapeIdx = (e) => { const i = ETAPES_ORDRE.indexOf(e); return i >= 0 ? i : 999 }
const produits = ref([])
const produitSel = ref('')
const rechercheProd = ref('')
const dateDu = ref('')
const dateAu = ref('')
const params = ref([])
const specByParam = ref({})
const mesures = ref([])
const paramSel = ref(null)
const chartMode = ref('trend')
const erreur = ref('')
const normR = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const produitsFiltres = computed(() => { const q = normR(rechercheProd.value).trim(); if (!q) return produits.value; return produits.value.filter(pr => normR((pr.code_pf || '') + ' ' + (pr.designation || '')).includes(q)) })

async function chargerBase() {
  const rp = await supabase.from('pqr_parametres').select('*').eq('actif', true).order('ordre')
  if (rp.error) { erreur.value = rp.error.message; return }
  params.value = rp.data || []
  const rpr = await supabase.from('produits').select('id, code_pf, designation').order('code_pf')
  if (!rpr.error) produits.value = rpr.data || []
}
onMounted(chargerBase)

watch(produitSel, async (pid) => {
  specByParam.value = {}; mesures.value = []; paramSel.value = null
  if (!pid) return
  const rs = await supabase.from('pqr_specs_produit').select('*').eq('produit_id', Number(pid))
  if (!rs.error) { const by = {}; for (const s of (rs.data || [])) by[s.parametre_id] = s; specByParam.value = by }
  const rm = await supabase.from('pqr_mesures').select('*').eq('produit_id', Number(pid))
  if (rm.error) { erreur.value = rm.error.message; return }
  mesures.value = rm.data || []
  paramSel.value = synthese.value.length ? synthese.value[0].id : null
})

const mesuresFiltrees = computed(() => mesures.value.filter(m => {
  const d = m.date_mesure || ''
  if (dateDu.value && d && d < dateDu.value) return false
  if (dateAu.value && d && d > dateAu.value) return false
  if ((dateDu.value || dateAu.value) && !d) return false
  return true
}))
const mesuresPlat = computed(() => {
  const out = []
  for (const m of mesuresFiltrees.value) {
    const vals = Array.isArray(m.valeurs) && m.valeurs.length ? m.valeurs : (m.valeur != null ? [m.valeur] : [])
    vals.forEach((v, k) => out.push({ parametre_id: m.parametre_id, valeur: v, numero_lot: m.numero_lot, of_id: m.of_id, date_mesure: m.date_mesure, rang: k }))
  }
  return out
})

function effMin(p) { const s = specByParam.value[p.id]; return s && s.limite_min != null ? s.limite_min : p.limite_min }
function uniteEff(p) { const s = specByParam.value[p.id]; return (s && s.unite) ? s.unite : (p.unite || '') }
function effMax(p) { const s = specByParam.value[p.id]; return s && s.limite_max != null ? s.limite_max : p.limite_max }
function effCible(p) { const s = specByParam.value[p.id]; return s && s.cible != null ? s.cible : p.cible }
function horsSpecVal(v, mn, mx) { return (mn != null && v < mn) || (mx != null && v > mx) }
function limTxt(mn, mx) { if (mn == null && mx == null) return '—'; return (mn != null ? mn : '…') + ' – ' + (mx != null ? mx : '…') }
const fmtNum = (v) => (v == null || v === '' || Number.isNaN(Number(v))) ? '—' : parseFloat(Number(v).toFixed(6)).toString()
function stats(vals) { const n = vals.length; const mean = vals.reduce((a, b) => a + b, 0) / n; const variance = n > 1 ? vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0; return { n, mean, std: Math.sqrt(variance), min: Math.min(...vals), max: Math.max(...vals) } }
function cpkCalc(mean, std, lsl, usl) { if (std <= 0 || (lsl == null && usl == null)) return { cp: null, cpk: null }; const cp = (lsl != null && usl != null) ? (usl - lsl) / (6 * std) : null; const cpu = usl != null ? (usl - mean) / (3 * std) : Infinity; const cpl = lsl != null ? (mean - lsl) / (3 * std) : Infinity; const cpk = Math.min(cpu, cpl); return { cp, cpk: cpk === Infinity ? null : cpk } }

const paramById = computed(() => { const m = {}; for (const p of params.value) m[p.id] = p; return m })
const synthese = computed(() => {
  const byParam = {}
  for (const m of mesuresPlat.value) { const v = Number(m.valeur); if (!Number.isNaN(v)) (byParam[m.parametre_id] = byParam[m.parametre_id] || []).push(v) }
  const out = []
  for (const p of params.value) {
    const vals = byParam[p.id]; if (!vals || !vals.length) continue
    if (p.type === 'bool') {
      const nOn = vals.filter(v => v > 0).length; const attendu = p.etat_attendu || null
      const conf = attendu ? (vals.filter(v => ((attendu === 'ON') === (v > 0))).length / vals.length * 100) : 100
      out.push({ id: p.id, phase: p.phase, etape: p.etape || '', nom: p.nom, unite: uniteEff(p), bool: true, n: vals.length, nOn, attendu, conf, mean: null, std: null, cp: null, cpk: null, lsl: null, usl: null })
      continue
    }
    const st = stats(vals); const lsl = effMin(p), usl = effMax(p)
    const conf = vals.filter(v => !horsSpecVal(v, lsl, usl)).length / vals.length * 100
    const c = cpkCalc(st.mean, st.std, lsl, usl)
    out.push({ id: p.id, phase: p.phase, etape: p.etape || '', nom: p.nom, unite: uniteEff(p), n: st.n, mean: st.mean, std: st.std, min: st.min, max: st.max, lsl, usl, conf, cp: c.cp, cpk: c.cpk })
  }
  return out
})
const phaseIndex = (ph) => { const i = PHASES_LISTE.indexOf(ph); return i < 0 ? 999 : i }
const phasesAvecMesures = computed(() => [...new Set(synthese.value.map(r => r.phase))].sort((a, b) => phaseIndex(a) - phaseIndex(b)))
const phaseSyn = ref('')
const phasesSynAffichees = computed(() => phaseSyn.value ? phasesAvecMesures.value.filter(ph => ph === phaseSyn.value) : phasesAvecMesures.value)
function syntheseDe(ph) { return synthese.value.filter(r => r.phase === ph) }
function etapesDeSyn(ph) { const seen = []; for (const r of syntheseDe(ph)) { const e = r.etape || ''; if (!seen.includes(e)) seen.push(e) } return seen.sort((a, b) => (a === '' ? -1 : b === '' ? 1 : (etapeIdx(a) - etapeIdx(b)) || a.localeCompare(b))) }
function syntheseDeEtape(ph, et) { return syntheseDe(ph).filter(r => (r.etape || '') === et) }

const nbLots = computed(() => new Set(mesuresPlat.value.map(m => m.of_id)).size)
function estHors(m) { const p = paramById.value[m.parametre_id]; if (!p) return false; if (p.type === 'bool') { const att = p.etat_attendu; if (!att) return false; return (att === 'ON') !== (Number(m.valeur) > 0) } return horsSpecVal(Number(m.valeur), effMin(p), effMax(p)) }
const nbHors = computed(() => mesuresPlat.value.filter(estHors).length)
const tauxGlobal = computed(() => mesuresPlat.value.length ? (mesuresPlat.value.length - nbHors.value) / mesuresPlat.value.length * 100 : 0)

function verdictCls(cpk) { if (cpk == null) return 'v-na'; if (cpk >= 1.33) return 'v-ok'; if (cpk >= 1.0) return 'v-mid'; return 'v-ko' }
function verdictTxt(cpk) { if (cpk == null) return '—'; if (cpk >= 1.33) return 'Capable'; if (cpk >= 1.0) return 'Acceptable'; return 'Insuffisant' }

const paramSelObj = computed(() => paramById.value[paramSel.value] || null)
const paramBool = computed(() => { const p = paramSelObj.value; return !!(p && p.type === 'bool') })
const byDate = (a, b) => String(a.date_mesure || '').localeCompare(String(b.date_mesure || '')) || ((a.of_id || 0) - (b.of_id || 0)) || ((a.rang || 0) - (b.rang || 0))
function mesuresParam(p) { return mesuresPlat.value.filter(m => m.parametre_id === p.id && !Number.isNaN(Number(m.valeur))).slice().sort(byDate) }

const chartData = computed(() => {
  const p = paramSelObj.value; if (!p || p.type === 'bool') return null
  const ms = mesuresParam(p); if (!ms.length) return null
  const vals = ms.map(m => Number(m.valeur)); const lsl = effMin(p), usl = effMax(p), cible = effCible(p)
  const allY = [...vals]; if (lsl != null) allY.push(lsl); if (usl != null) allY.push(usl); if (cible != null) allY.push(cible)
  let ymin = Math.min(...allY), ymax = Math.max(...allY); if (ymin === ymax) { ymin -= 1; ymax += 1 }
  const pd = (ymax - ymin) * 0.12; ymin -= pd; ymax += pd
  const W = 760, H = 280, mL = 52, mR = 54, mT = 16, mB = 62; const step = Math.max(1, Math.ceil(ms.length / 22))
  const xx = (i) => mL + (ms.length === 1 ? (W - mL - mR) / 2 : i * (W - mL - mR) / (ms.length - 1))
  const yy = (v) => mT + (ymax - v) / (ymax - ymin) * (H - mT - mB)
  const pts = ms.map((m, i) => ({ x: xx(i), y: yy(Number(m.valeur)), v: Number(m.valeur), lot: m.numero_lot || '', ko: horsSpecVal(Number(m.valeur), lsl, usl) }))
  const path = pts.map((pt, i) => (i ? 'L' : 'M') + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1)).join(' ')
  return { W, H, mL, mR, mT, mB, step, pts, path, lsl, usl, cible, ymin, ymax, yLsl: lsl != null ? yy(lsl) : null, yUsl: usl != null ? yy(usl) : null, yCible: cible != null ? yy(cible) : null }
})

function detectViolations(vals, mean, std) {
  const n = vals.length, flags = vals.map(() => [])
  const z = vals.map(v => std > 0 ? (v - mean) / std : 0)
  for (let i = 0; i < n; i++) if (Math.abs(z[i]) > 3) flags[i].push('1-3s')
  for (let i = 1; i < n; i++) {
    if (z[i] > 2 && z[i - 1] > 2) { flags[i].push('2-2s'); flags[i - 1].push('2-2s') }
    if (z[i] < -2 && z[i - 1] < -2) { flags[i].push('2-2s'); flags[i - 1].push('2-2s') }
  }
  for (let i = 3; i < n; i++) {
    if (z[i] > 1 && z[i - 1] > 1 && z[i - 2] > 1 && z[i - 3] > 1) for (let k = i - 3; k <= i; k++) flags[k].push('4-1s')
    if (z[i] < -1 && z[i - 1] < -1 && z[i - 2] < -1 && z[i - 3] < -1) for (let k = i - 3; k <= i; k++) flags[k].push('4-1s')
  }
  for (let i = 8; i < n; i++) { const seg = z.slice(i - 8, i + 1); if (seg.every(v => v > 0) || seg.every(v => v < 0)) for (let k = i - 8; k <= i; k++) flags[k].push('9-x') }
  for (let i = 5; i < n; i++) { let inc = true, dec = true; for (let k = i - 5; k < i; k++) { if (!(vals[k + 1] > vals[k])) inc = false; if (!(vals[k + 1] < vals[k])) dec = false } if (inc || dec) for (let k = i - 5; k <= i; k++) flags[k].push('tendance') }
  return flags.map(f => [...new Set(f)])
}

const controlData = computed(() => {
  const p = paramSelObj.value; if (!p || p.type === 'bool') return null
  const ms = mesuresParam(p); if (ms.length < 2) return null
  const vals = ms.map(m => Number(m.valeur)); const st = stats(vals); const mean = st.mean, std = st.std
  const ucl = mean + 3 * std, lcl = mean - 3 * std
  const viol = detectViolations(vals, mean, std)
  const allY = [...vals, ucl, lcl]; let ymin = Math.min(...allY), ymax = Math.max(...allY); if (ymin === ymax) { ymin -= 1; ymax += 1 }
  const pd = (ymax - ymin) * 0.1; ymin -= pd; ymax += pd
  const W = 760, H = 280, mL = 52, mR = 54, mT = 16, mB = 62; const step = Math.max(1, Math.ceil(ms.length / 22))
  const xx = (i) => mL + (ms.length === 1 ? (W - mL - mR) / 2 : i * (W - mL - mR) / (ms.length - 1))
  const yy = (v) => mT + (ymax - v) / (ymax - ymin) * (H - mT - mB)
  const pts = ms.map((m, i) => ({ x: xx(i), y: yy(Number(m.valeur)), v: Number(m.valeur), lot: m.numero_lot || '', viol: viol[i] }))
  const path = pts.map((pt, i) => (i ? 'L' : 'M') + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1)).join(' ')
  const alertes = []
  pts.forEach(pt => { if (pt.viol.length) alertes.push({ lot: pt.lot || '(lot ?)', v: pt.v, rules: pt.viol }) })
  return { W, H, mL, mR, mT, mB, step, pts, path, mean, std, ymin, ymax, alertes,
    yCl: yy(mean), yUcl: yy(ucl), yLcl: yy(lcl), y2u: yy(mean + 2 * std), y2l: yy(mean - 2 * std), y1u: yy(mean + std), y1l: yy(mean - std) }
})

const horsSpecListe = computed(() => {
  const out = []
  for (const m of mesuresPlat.value) {
    const p = paramById.value[m.parametre_id]; if (!p) continue
    if (!estHors(m)) continue
    const bool = p.type === 'bool'
    out.push({ lot: m.numero_lot || '—', phase: p.phase, nom: p.nom, unite: bool ? '' : uniteEff(p), valeur: bool ? (Number(m.valeur) > 0 ? 'ON' : 'OFF') : m.valeur, lsl: effMin(p), usl: effMax(p), bool, attendu: p.etat_attendu, date: m.date_mesure })
  }
  return out.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
})

function exporterPDF() {
  const pr = produits.value.find(x => String(x.id) === produitSel.value)
  const prNom = pr ? (pr.code_pf + ' — ' + pr.designation) : ''
  const periode = (dateDu.value || dateAu.value) ? ((dateDu.value || '…') + ' → ' + (dateAu.value || '…')) : 'toutes les mesures'
  const now = new Date().toLocaleString('fr-FR')
  let synthHtml = ''
  for (const ph of phasesAvecMesures.value) {
    synthHtml += `<tr class="ph"><td colspan="8">${ph}</td></tr>`
    for (const r of syntheseDe(ph)) synthHtml += `<tr><td>${r.nom}${r.unite ? ' (' + r.unite + ')' : ''}</td><td class="r">${r.n}</td><td class="r">${r.mean.toFixed(2)}</td><td class="r">${r.std.toFixed(3)}</td><td class="r">${limTxt(r.lsl, r.usl)}</td><td class="r">${r.conf.toFixed(0)}%</td><td class="r">${r.cpk != null ? r.cpk.toFixed(2) : '—'}</td><td>${verdictTxt(r.cpk)}</td></tr>`
  }
  let horsHtml = horsSpecListe.value.length
    ? horsSpecListe.value.map(h => `<tr><td>${h.lot}</td><td>${h.phase}</td><td>${h.nom}</td><td class="r">${h.valeur} ${h.unite}</td><td class="r">${limTxt(h.lsl, h.usl)}</td><td>${h.date || '—'}</td></tr>`).join('')
    : '<tr><td colspan="6" style="text-align:center;color:#16a34a">Aucun lot hors spec</td></tr>'
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Revue PQR — ${prNom}</title>
<style>
*{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1b2733;margin:28px;font-size:12px}
h1{font-size:20px;margin:0 0 2px;color:#6b21a8} .sub{color:#64748b;font-size:12px;margin:0 0 16px}
.meta{display:flex;gap:24px;flex-wrap:wrap;font-size:11px;color:#475569;border-top:2px solid #a855f7;border-bottom:1px solid #e2e8f0;padding:8px 0;margin-bottom:16px}
.meta b{color:#0f172a}
.kpis{display:flex;gap:10px;margin:0 0 18px} .k{flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:8px;text-align:center}
.k .v{font-size:18px;font-weight:800} .k .l{font-size:10px;text-transform:uppercase;color:#94a3b8;font-weight:700}
h2{font-size:13px;margin:18px 0 6px;border-left:4px solid #a855f7;padding-left:8px}
table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:10px}
th{text-align:left;background:#faf5ff;color:#6b21a8;padding:5px 7px;border-bottom:1px solid #e9d5ff;font-size:10px;text-transform:uppercase}
th.r,td.r{text-align:right} td{padding:4px 7px;border-bottom:1px solid #f1f5f9}
tr.ph td{background:#f8fafc;font-weight:800;color:#a855f7;text-transform:uppercase;font-size:10px}
.foot{margin-top:22px;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px}
@media print{body{margin:14mm}}
</style></head><body>
<h1>Revue Produit Qualité — PQR</h1><p class="sub">${prNom}</p>
<div class="meta"><span>Période : <b>${periode}</b></span><span>Mesures : <b>${mesuresPlat.value.length}</b></span><span>Lots : <b>${nbLots.value}</b></span><span>Édité le <b>${now}</b></span></div>
<div class="kpis"><div class="k"><div class="v">${mesuresPlat.value.length}</div><div class="l">Mesures</div></div><div class="k"><div class="v">${nbLots.value}</div><div class="l">Lots</div></div><div class="k"><div class="v">${tauxGlobal.value.toFixed(1)}%</div><div class="l">Conformité</div></div><div class="k"><div class="v">${nbHors.value}</div><div class="l">Hors spec</div></div></div>
<h2>Synthèse par paramètre</h2>
<table><thead><tr><th>Paramètre</th><th class="r">n</th><th class="r">Moyenne</th><th class="r">σ</th><th class="r">Limites</th><th class="r">Conf.</th><th class="r">Cpk</th><th>Capabilité</th></tr></thead><tbody>${synthHtml}</tbody></table>
<h2>Lots hors spec</h2>
<table><thead><tr><th>Lot</th><th>Phase</th><th>Paramètre</th><th class="r">Valeur</th><th class="r">Limites</th><th>Date</th></tr></thead><tbody>${horsHtml}</tbody></table>
<div class="foot">Document généré par ProdTrack — Module PQR. Cpk ≥ 1,33 : capable · 1,00–1,33 : acceptable · &lt; 1,00 : insuffisant.</div>
</body></html>`
  const w = window.open('', '_blank')
  if (!w) { erreur.value = 'Autorise les pop-ups pour exporter la revue en PDF.'; return }
  w.document.write(html); w.document.close(); w.focus()
  setTimeout(() => { try { w.print() } catch (e) {} }, 350)
}
</script>

<style scoped>
.pqr-page { color: #1b2733; zoom: 0.85; }
.syn-layout { display: flex; gap: 16px; align-items: flex-start; }
.syn-side { flex: 0 0 180px; display: flex; flex-direction: column; gap: 4px; position: sticky; top: 12px; }
.syn-side button { text-align: left; border: 1px solid #e2e8f0; background: #fff; padding: 8px 12px; border-radius: 8px; font: inherit; font-size: 12.5px; font-weight: 600; color: #475569; cursor: pointer; transition: background .12s, border-color .12s; }
.syn-side button:hover { background: #faf5ff; border-color: #e9d5ff; }
.syn-side button.on { background: #a855f7; border-color: #a855f7; color: #fff; }
.syn-main { flex: 1; min-width: 0; }
@media (max-width: 720px) { .syn-layout { flex-direction: column; } .syn-side { flex: none; width: 100%; flex-direction: row; flex-wrap: wrap; position: static; } .syn-side button { flex: 1 1 auto; } }
.alert { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 10px 14px; border-radius: 8px; margin: 0 0 14px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 22px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.empty-card { background: #fff; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 24px; color: #475569; text-align: center; font-size: 14px; }
.empty-sm { color: #64748b; font-size: 13px; padding: 10px 2px; }
.btn { background: #0f766e; color: #fff; border: 0; padding: 9px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
.btn.ghost { background: #fff; color: #475569; border: 1px solid #cbd5e1; }
.btn.sm { padding: 7px 12px; font-size: 13px; }

.pqr-bar { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; align-items: flex-end; }
.pqr-bar .f { display: flex; flex-direction: column; gap: 4px; }
.pqr-bar .f.grow { flex: 1; min-width: 240px; }
.pqr-bar label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; }
.pqr-bar select, .pqr-bar input { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; color: #1b2733; }
.pqr-bar .prod-search { min-width: 170px; }
.pqr-bar .prod-search:focus { outline: none; border-color: #a855f7; box-shadow: 0 0 0 3px rgba(168,85,247,.15); }
.pqr-bar label .cnt { color: #a855f7; font-weight: 700; }
.pqr-bar .f.grow select { width: 100%; }

.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
.kpi { background: #f8fafc; border: 1px solid #eef2f6; border-radius: 12px; padding: 14px; text-align: center; }
.kpi .kv { font-size: 24px; font-weight: 800; color: #0f172a; font-variant-numeric: tabular-nums; }
.kpi .kl { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #94a3b8; font-weight: 700; margin-top: 2px; }
.kpi.good .kv { color: #16a34a; } .kpi.warn .kv { color: #d97706; } .kpi.bad .kv { color: #dc2626; }
@media (max-width: 640px) { .kpis { grid-template-columns: repeat(2, 1fr); } }

.sec-titre { margin: 22px 0 6px; font-size: 15px; font-weight: 800; color: #0f172a; border-left: 4px solid #a855f7; padding-left: 9px; }
.hint { font-size: 12px; color: #64748b; margin: 0 0 10px; }
.hint.rules { margin-top: 8px; background: #f8fafc; border: 1px solid #eef2f6; border-radius: 8px; padding: 7px 10px; }
.pqr-phase { margin-top: 14px; }
.pqr-phase-titre { margin: 0 0 5px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: #a855f7; }
.pqr-tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.pqr-tbl th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; font-weight: 700; padding: 6px 9px; border-bottom: 2px solid #eef2f6; }
.pqr-tbl th.r { text-align: right; }
.pqr-tbl td { padding: 7px 9px; border-bottom: 1px solid #f1f5f9; }
.pqr-tbl td.r { text-align: right; font-variant-numeric: tabular-nums; }
.pqr-tbl td.nom { font-weight: 700; color: #0f172a; }
.pqr-tbl td.nom .u { font-weight: 500; color: #94a3b8; font-size: 11px; }
.tag-bool { font-size: 9px; font-weight: 800; background: #ecfeff; color: #0891b2; padding: 1px 6px; border-radius: 999px; }
.pqr-tbl td.lim { color: #64748b; }
.pqr-tbl td.cpk { font-weight: 800; color: #0f172a; }
.pqr-tbl tbody tr { cursor: pointer; }
.pqr-tbl tbody tr:hover { background: #faf5ff; }
.pqr-tbl tbody tr.sel { background: #f3e8ff; }
.pqr-tbl .etape-row td { background: #f1f5f9; font-weight: 800; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; padding: 5px 10px; cursor: default; }
.pqr-tbl tr.row-ko { background: #fef2f2; cursor: default; }
.pqr-tbl td.val-ko { color: #b91c1c; font-weight: 800; }
.c-ok { color: #16a34a; font-weight: 700; } .c-ko { color: #dc2626; font-weight: 700; }
.verdict { font-size: 11px; font-weight: 800; padding: 2px 9px; border-radius: 999px; white-space: nowrap; }
.verdict.v-ok { background: #dcfce7; color: #166534; } .verdict.v-mid { background: #fef3c7; color: #92400e; } .verdict.v-ko { background: #fee2e2; color: #b91c1c; } .verdict.v-na { background: #f1f5f9; color: #94a3b8; }

.chart-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
.chart-head .sec-titre { margin: 0; }
.tabs { display: inline-flex; background: #f1f5f9; border-radius: 10px; padding: 3px; }
.tabs button { border: 0; background: transparent; padding: 6px 13px; border-radius: 8px; font: inherit; font-size: 12px; font-weight: 700; color: #64748b; cursor: pointer; }
.tabs button.on { background: #fff; color: #a855f7; box-shadow: 0 1px 2px rgba(16,24,40,.08); }

.chart-wrap { margin-top: 10px; }
.trend { width: 100%; height: auto; background: #fcfcfd; border: 1px solid #eef2f6; border-radius: 12px; }
.trend .axis { stroke: #cbd5e1; stroke-width: 1; }
.trend .l-spec { stroke: #f87171; stroke-width: 1.5; stroke-dasharray: 5 4; }
.trend .l-cible { stroke: #a855f7; stroke-width: 1.5; stroke-dasharray: 2 4; }
.trend .l-ucl { stroke: #ef4444; stroke-width: 1.5; stroke-dasharray: 6 4; }
.trend .l-sig { stroke: #f59e0b; stroke-width: 1; stroke-dasharray: 3 4; }
.trend .l-sig1 { stroke: #cbd5e1; stroke-width: 1; stroke-dasharray: 2 4; }
.trend .l-cl { stroke: #16a34a; stroke-width: 1.5; }
.trend .l-data { fill: none; stroke: #0ea5e9; stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
.trend .pt-ok { fill: #0ea5e9; stroke: #fff; stroke-width: 1.5; }
.trend .pt-ko { fill: #dc2626; stroke: #fff; stroke-width: 1.5; }
.trend .pt-ring { fill: none; stroke: #dc2626; stroke-width: 1.5; opacity: .5; }
.trend .ax { fill: #94a3b8; font-size: 11px; text-anchor: end; font-weight: 600; }
.trend .lot-lbl { fill: #94a3b8; font-size: 9px; text-anchor: end; font-weight: 600; }
.trend .lbl-spec { fill: #ef4444; font-size: 10px; text-anchor: end; font-weight: 700; }
.trend .lbl-ucl { fill: #ef4444; font-size: 10px; text-anchor: end; font-weight: 700; }
.trend .lbl-cl { fill: #16a34a; font-size: 10px; text-anchor: end; font-weight: 700; }
.leg { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 8px; padding-left: 4px; }
.leg .lg { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: #64748b; font-weight: 600; }
.leg i { width: 14px; height: 3px; border-radius: 2px; display: inline-block; }
.leg .d-ok, .leg .d-ko { width: 10px; height: 10px; border-radius: 50%; }
.leg .d-ok { background: #0ea5e9; } .leg .d-ko { background: #dc2626; }
.leg .l-c { background: #a855f7; } .leg .l-s { background: #f87171; } .leg .l-clg { background: #16a34a; } .leg .l-ug { background: #ef4444; }

.viol-box { margin-top: 10px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 10px 13px; }
.viol-titre { font-size: 12px; font-weight: 800; color: #b91c1c; margin-bottom: 5px; }
.viol-row { font-size: 12px; color: #7f1d1d; padding: 2px 0; }
.viol-ok { margin-top: 10px; background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; border-radius: 10px; padding: 9px 13px; font-size: 13px; font-weight: 600; }
</style>
