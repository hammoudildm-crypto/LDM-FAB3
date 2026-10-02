<template>
  <div class="pqr-page">
    <PageHeader title="Saisie PQR — Mesures" tone="#a855f7"
      subtitle="Relevé des paramètres critiques par lot et par phase, avec contrôle automatique des limites." />

    <p v-if="erreur" class="alert">{{ erreur }}</p>
    <p v-if="message" class="ok">{{ message }}</p>

    <section class="card">
      <div class="pqr-bar">
        <div class="f">
          <label>Rechercher</label>
          <input v-model="rechercheOf" class="of-search" placeholder="🔍 N° lot ou produit" />
        </div>
        <div class="f grow">
          <label>Lot / OF <span v-if="chargementOfs" class="cnt">chargement…</span><span v-else-if="rechercheOf" class="cnt">({{ ofsFiltres.length }})</span></label>
          <select v-model="ofSel"><option value="">—</option><option v-for="o in ofsFiltres" :key="o.id" :value="String(o.id)">{{ o.numero_lot }} · {{ o.code }}{{ o.desig ? ' — ' + o.desig : '' }}</option></select>
        </div>
        <div class="f">
          <label>Phase</label>
          <select v-model="phaseSel" :disabled="!ofSel"><option value="">—</option><option v-for="ph in phasesAvecParams" :key="ph" :value="ph">{{ ph }}</option></select>
        </div>
        <div class="f">
          <label>Date</label>
          <input type="date" v-model="dateMesure" />
        </div>
      </div>

      <div v-if="!ofSel" class="empty-card">Choisis un lot / OF pour saisir ses mesures.</div>
      <div v-else-if="!phaseSel" class="empty-card">Choisis une phase.</div>
      <div v-else-if="!paramsPhase.length" class="empty-card">Aucun paramètre défini pour cette phase dans le référentiel.</div>

      <template v-else>
        <p class="hint">Saisis une ou plusieurs valeurs séparées par un <b>espace</b> (ex. <code>45,5 47 46,2</code>). La <b>virgule</b> est acceptée pour les décimales, et <b>aucune valeur n'est arrondie</b>. Moyenne et RSD calculés automatiquement. Verdict <b>indiv.</b> = toute valeur hors limites · <b>moy.</b> = moyenne hors limites.</p>
        <div class="pqr-sum">
          <span v-if="nbConf" class="chip ok">✓ {{ nbConf }} conforme(s)</span>
          <span v-if="nbHors" class="chip ko">⚠ {{ nbHors }} hors spec</span>
          <span v-if="nbVide" class="chip neutre">{{ nbVide }} non saisi(s)</span>
          <span class="chip prod">{{ ofCourant.numero_lot }} · {{ ofCourant.code }}</span>
        </div>
        <table class="pqr-tbl">
          <thead><tr><th>Paramètre</th><th>Unité</th><th class="r">Limites</th><th>Relevés</th><th class="r">n</th><th class="r">Moyenne</th><th class="r">RSD</th><th>Statut</th></tr></thead>
          <tbody>
            <tr v-for="p in paramsPhase" :key="p.id" :class="{ 'row-ko': st(p).ko }">
              <td class="nom">{{ p.nom }} <span v-if="p.type === 'bool'" class="tag-bool">ON/OFF</span></td>
              <td>{{ p.type === 'bool' ? '—' : (uniteEff(p) || '—') }}</td>
              <td class="r lim">{{ p.type === 'bool' ? (p.etat_attendu ? 'Attendu ' + p.etat_attendu : 'ON/OFF') : limTxt(p) }}</td>
              <td>
                <div v-if="p.type === 'bool'" class="onoff">
                  <button type="button" :class="{ on: st(p).etat === 'ON' }" @click="setEtat(p, 'ON')" :disabled="!peutEditer">ON</button>
                  <button type="button" :class="{ off: st(p).etat === 'OFF' }" @click="setEtat(p, 'OFF')" :disabled="!peutEditer">OFF</button>
                </div>
                <input v-else class="val-in" :class="{ ko: st(p).ko }" v-model="mesuresEdit[p.id]" placeholder="ex. 45 47 46" :disabled="!peutEditer" />
              </td>
              <td class="r">{{ st(p).bool ? '—' : (st(p).n || '—') }}</td>
              <td class="r moy">{{ st(p).bool ? '—' : (st(p).n ? fmtNum(st(p).mean) : '—') }}</td>
              <td class="r">{{ st(p).bool ? '—' : (st(p).n > 1 ? st(p).rsd.toFixed(1) + '%' : '—') }}</td>
              <td class="statut">
                <template v-if="st(p).bool">
                  <span v-if="!st(p).n" class="v2 neutre">—</span>
                  <span v-else-if="!st(p).attendu" class="v2 ok">{{ st(p).etat }}</span>
                  <span v-else class="v2" :class="st(p).ko ? 'ko' : 'ok'">{{ (st(p).ko ? '⚠ ' : '✓ ') + st(p).etat }}</span>
                </template>
                <template v-else-if="st(p).n">
                  <span class="v2" :class="st(p).indivKo ? 'ko' : 'ok'">indiv {{ st(p).indivKo ? '⚠' : '✓' }}</span>
                  <span class="v2" :class="st(p).meanKo ? 'ko' : 'ok'">moy {{ st(p).meanKo ? '⚠' : '✓' }}</span>
                </template>
                <span v-else class="v2 neutre">—</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="peutEditer" style="margin-top:16px">
          <button class="btn" @click="enregistrer">💾 Enregistrer les mesures</button>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject, watch } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'

const peutEditer = inject('peutEditer', ref(true))
const PHASES_LISTE = ['Pesée', 'Granulation et Séchage', 'Mélange', 'Compression', 'Remplissage Gélules', 'Pelliculage']

const ofs = ref([])
const rechercheOf = ref('')
const chargementOfs = ref(false)
const ofSel = ref('')
const phaseSel = ref('')
const dateMesure = ref(new Date().toISOString().slice(0, 10))
const params = ref([])
const specByParam = ref({})
const mesuresEdit = ref({})
const erreur = ref('')
const message = ref('')

async function charger() {
  const rp = await supabase.from('pqr_parametres').select('*').eq('actif', true).order('ordre')
  if (rp.error) { erreur.value = rp.error.message; return }
  params.value = rp.data || []
  chargementOfs.value = true
  let all = [], from = 0; const size = 1000
  while (true) {
    const ro = await supabase.from('ordres_fabrication').select('id, numero_lot, produits(id, code_pf, designation)').order('id', { ascending: false }).range(from, from + size - 1)
    if (ro.error) { erreur.value = ro.error.message; break }
    const batch = ro.data || []
    all = all.concat(batch)
    if (batch.length < size) break
    from += size
  }
  ofs.value = all.map(o => ({ id: o.id, numero_lot: o.numero_lot || '—', produit_id: o.produits ? o.produits.id : null, code: o.produits ? (o.produits.code_pf || '') : '', desig: o.produits ? (o.produits.designation || '') : '' }))
  chargementOfs.value = false
}
onMounted(charger)

const ofCourant = computed(() => ofs.value.find(o => String(o.id) === ofSel.value) || null)
const ofsFiltres = computed(() => { const q = (rechercheOf.value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(); if (!q) return ofs.value; return ofs.value.filter(o => (((o.numero_lot || '') + ' ' + (o.code || '') + ' ' + (o.desig || '')).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')).includes(q)) })
const phaseIndex = (ph) => { const i = PHASES_LISTE.indexOf(ph); return i < 0 ? 999 : i }
const phasesAvecParams = computed(() => [...new Set(params.value.map(p => p.phase))].sort((a, b) => phaseIndex(a) - phaseIndex(b)))
const paramsPhase = computed(() => params.value.filter(p => p.phase === phaseSel.value).sort((a, b) => (a.ordre || 0) - (b.ordre || 0) || a.id - b.id))

const fmt = (v) => (v === null || v === undefined || v === '') ? '—' : v
const fmtNum = (v) => (v == null || v === '' || Number.isNaN(Number(v))) ? '—' : parseFloat(Number(v).toFixed(6)).toString()
function effMin(p) { const s = specByParam.value[p.id]; return s && s.limite_min != null ? s.limite_min : p.limite_min }
function uniteEff(p) { const s = specByParam.value[p.id]; return (s && s.unite) ? s.unite : (p.unite || '') }
function effMax(p) { const s = specByParam.value[p.id]; return s && s.limite_max != null ? s.limite_max : p.limite_max }
function limTxt(p) { const mn = effMin(p), mx = effMax(p); if (mn == null && mx == null) return '—'; return (mn != null ? mn : '…') + ' – ' + (mx != null ? mx : '…') }
function horsSpecVal(v, mn, mx) { return (mn != null && v < mn) || (mx != null && v > mx) }
function parseVals(str) { if (str == null) return []; return String(str).split(/[\s;]+/).map(x => x.trim().replace(',', '.')).filter(x => x !== '').map(Number).filter(v => !Number.isNaN(v)) }

const statsMap = computed(() => {
  const m = {}
  for (const p of paramsPhase.value) {
    if (p.type === 'bool') {
      const bv = parseVals(mesuresEdit.value[p.id])
      if (!bv.length) { m[p.id] = { n: 0, bool: true, ko: false, etat: null, attendu: p.etat_attendu || null }; continue }
      const on = bv[0] > 0; const attendu = p.etat_attendu || null
      m[p.id] = { n: 1, bool: true, etat: on ? 'ON' : 'OFF', attendu, ko: attendu ? ((attendu === 'ON') !== on) : false }
      continue
    }
    const vals = parseVals(mesuresEdit.value[p.id]); const n = vals.length
    if (!n) { m[p.id] = { n: 0, ko: false, indivKo: false, meanKo: false }; continue }
    const mean = vals.reduce((a, b) => a + b, 0) / n
    const std = n > 1 ? Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0
    const rsd = mean !== 0 ? std / Math.abs(mean) * 100 : 0
    const mn = effMin(p), mx = effMax(p)
    const indivKo = vals.some(v => horsSpecVal(v, mn, mx)); const meanKo = horsSpecVal(mean, mn, mx)
    m[p.id] = { n, mean, std, rsd, min: Math.min(...vals), max: Math.max(...vals), vals, indivKo, meanKo, ko: indivKo || meanKo }
  }
  return m
})
function st(p) { return statsMap.value[p.id] || { n: 0, ko: false } }
function setEtat(p, etat) { const cur = st(p).etat; mesuresEdit.value[p.id] = (cur === etat) ? '' : (etat === 'ON' ? '1' : '0') }

const nbConf = computed(() => paramsPhase.value.filter(p => st(p).n && !st(p).ko).length)
const nbHors = computed(() => paramsPhase.value.filter(p => st(p).ko).length)
const nbVide = computed(() => paramsPhase.value.filter(p => !st(p).n).length)

watch(ofSel, async (id) => {
  message.value = ''; specByParam.value = {}; mesuresEdit.value = {}
  const o = ofs.value.find(x => String(x.id) === id)
  if (!o) return
  if (o.produit_id != null) {
    const rs = await supabase.from('pqr_specs_produit').select('*').eq('produit_id', o.produit_id)
    if (!rs.error) { const by = {}; for (const s of (rs.data || [])) by[s.parametre_id] = s; specByParam.value = by }
  }
  const rm = await supabase.from('pqr_mesures').select('*').eq('of_id', o.id)
  if (!rm.error) {
    const m = {}
    for (const r of (rm.data || [])) {
      const vals = Array.isArray(r.valeurs) && r.valeurs.length ? r.valeurs : (r.valeur != null ? [r.valeur] : [])
      m[r.parametre_id] = vals.join(' ')
    }
    mesuresEdit.value = m
  }
})

async function enregistrer() {
  erreur.value = ''; message.value = ''
  const o = ofCourant.value; if (!o) return
  const up = [], delIds = []
  for (const p of paramsPhase.value) {
    const vals = parseVals(mesuresEdit.value[p.id])
    if (!vals.length) delIds.push(p.id)
    else { const mean = vals.reduce((a, b) => a + b, 0) / vals.length; up.push({ of_id: o.id, numero_lot: o.numero_lot, produit_id: o.produit_id, phase: p.phase, parametre_id: p.id, valeurs: vals, valeur: mean, date_mesure: dateMesure.value }) }
  }
  if (up.length) { const r = await supabase.from('pqr_mesures').upsert(up, { onConflict: 'of_id,parametre_id' }); if (r.error) { erreur.value = r.error.message; return } }
  if (delIds.length) { const d = await supabase.from('pqr_mesures').delete().eq('of_id', o.id).in('parametre_id', delIds); if (d.error) { erreur.value = d.error.message; return } }
  message.value = 'Mesures enregistrées' + (nbHors.value ? ' — ⚠ ' + nbHors.value + ' paramètre(s) hors spec.' : '.')
}
</script>

<style scoped>
.pqr-page { color: #1b2733; zoom: 0.85; }
.alert { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 10px 14px; border-radius: 8px; margin: 0 0 14px; }
.ok { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 10px 14px; border-radius: 8px; margin: 0 0 14px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 22px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.empty-card { background: #fff; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 24px; color: #475569; text-align: center; font-size: 14px; }
.btn { background: #0f766e; color: #fff; border: 0; padding: 9px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
.hint { font-size: 12px; color: #64748b; margin: 0 0 12px; background: #f8fafc; border: 1px solid #eef2f6; border-radius: 8px; padding: 8px 11px; }
.hint code { background: #eef2ff; color: #4338ca; padding: 1px 5px; border-radius: 4px; font-size: 11px; }

.pqr-bar { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; align-items: flex-end; }
.pqr-bar .f { display: flex; flex-direction: column; gap: 4px; }
.pqr-bar .f.grow { flex: 1; min-width: 220px; }
.pqr-bar label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; }
.pqr-bar select, .pqr-bar input { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; color: #1b2733; }
.pqr-bar .of-search { min-width: 180px; }
.pqr-bar .of-search:focus { outline: none; border-color: #a855f7; box-shadow: 0 0 0 3px rgba(168,85,247,.15); }
.pqr-bar label .cnt { color: #a855f7; font-weight: 700; }
.pqr-bar .f.grow select { width: 100%; }

.pqr-sum { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.chip { font-size: 12px; font-weight: 700; padding: 3px 11px; border-radius: 999px; }
.chip.ok { background: #f0fdf4; color: #166534; }
.chip.ko { background: #fef2f2; color: #b91c1c; }
.chip.neutre { background: #f1f5f9; color: #64748b; }
.chip.prod { background: #faf5ff; color: #7c3aed; margin-left: auto; }

.pqr-tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.pqr-tbl th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; font-weight: 700; padding: 6px 10px; border-bottom: 2px solid #eef2f6; }
.pqr-tbl th.r { text-align: right; }
.pqr-tbl td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
.pqr-tbl td.r { text-align: right; font-variant-numeric: tabular-nums; }
.pqr-tbl td.nom { font-weight: 700; color: #0f172a; }
.pqr-tbl td.lim { color: #64748b; }
.pqr-tbl td.moy { font-weight: 700; color: #0f172a; }
.pqr-tbl tr.row-ko { background: #fef2f2; }
.pqr-tbl tr.row-ko:hover { background: #fee2e2; }
.val-in { width: 140px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 7px; font: inherit; font-size: 13px; background: #fff; color: #0f172a; font-variant-numeric: tabular-nums; }
.val-in:focus { outline: none; border-color: #a855f7; box-shadow: 0 0 0 3px rgba(168,85,247,.15); }
.val-in.ko { border-color: #f87171; background: #fff1f2; color: #b91c1c; font-weight: 700; }
.onoff { display: inline-flex; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; }
.onoff button { border: 0; background: #fff; padding: 6px 14px; font: inherit; font-size: 12px; font-weight: 800; color: #94a3b8; cursor: pointer; }
.onoff button + button { border-left: 1px solid #e2e8f0; }
.onoff button.on { background: #16a34a; color: #fff; }
.onoff button.off { background: #64748b; color: #fff; }
.tag-bool { font-size: 9px; font-weight: 800; background: #ecfeff; color: #0891b2; padding: 1px 6px; border-radius: 999px; vertical-align: middle; }
.statut { white-space: nowrap; }
.v2 { display: inline-block; font-size: 11px; font-weight: 800; padding: 2px 7px; border-radius: 6px; margin-right: 4px; }
.v2.ok { background: #dcfce7; color: #166534; }
.v2.ko { background: #fee2e2; color: #b91c1c; }
.v2.neutre { background: #f1f5f9; color: #cbd5e1; }
</style>
