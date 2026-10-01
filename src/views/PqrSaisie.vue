<template>
  <div class="pqr-page">
    <PageHeader title="Saisie PQR — Mesures" tone="#a855f7"
      subtitle="Relevé des paramètres critiques par lot et par phase, avec contrôle automatique des limites." />

    <p v-if="erreur" class="alert">{{ erreur }}</p>
    <p v-if="message" class="ok">{{ message }}</p>

    <section class="card">
      <div class="pqr-bar">
        <div class="f grow">
          <label>Lot / OF</label>
          <select v-model="ofSel"><option value="">—</option><option v-for="o in ofs" :key="o.id" :value="String(o.id)">{{ o.numero_lot }} · {{ o.code }}{{ o.desig ? ' — ' + o.desig : '' }}</option></select>
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
        <div class="pqr-sum">
          <span v-if="nbConf" class="chip ok">✓ {{ nbConf }} conforme(s)</span>
          <span v-if="nbHors" class="chip ko">⚠ {{ nbHors }} hors spec</span>
          <span v-if="nbVide" class="chip neutre">{{ nbVide }} non saisi(s)</span>
          <span class="chip prod">{{ ofCourant.numero_lot }} · {{ ofCourant.code }}</span>
        </div>
        <table class="pqr-tbl">
          <thead><tr><th>Paramètre</th><th>Unité</th><th class="r">Limites</th><th class="r">Cible</th><th class="r">Valeur mesurée</th><th>Statut</th></tr></thead>
          <tbody>
            <tr v-for="p in paramsPhase" :key="p.id" :class="{ 'row-ko': horsSpec(p) }">
              <td class="nom">{{ p.nom }}</td>
              <td>{{ p.unite || '—' }}</td>
              <td class="r lim">{{ limTxt(p) }}</td>
              <td class="r cible">{{ fmt(effCible(p)) }}</td>
              <td class="r"><input class="val-in" :class="{ ko: horsSpec(p) }" v-model="mesuresEdit[p.id]" type="number" step="any" placeholder="—" :disabled="!peutEditer" /></td>
              <td><span class="stat" :class="statutCls(p)">{{ statutTxt(p) }}</span></td>
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
  const ro = await supabase.from('ordres_fabrication').select('id, numero_lot, produits(id, code_pf, designation)').order('id', { ascending: false })
  if (ro.error) { erreur.value = ro.error.message; return }
  ofs.value = (ro.data || []).map(o => ({ id: o.id, numero_lot: o.numero_lot || '—', produit_id: o.produits ? o.produits.id : null, code: o.produits ? (o.produits.code_pf || '') : '', desig: o.produits ? (o.produits.designation || '') : '' }))
}
onMounted(charger)

const ofCourant = computed(() => ofs.value.find(o => String(o.id) === ofSel.value) || null)
const phaseIndex = (ph) => { const i = PHASES_LISTE.indexOf(ph); return i < 0 ? 999 : i }
const phasesAvecParams = computed(() => [...new Set(params.value.map(p => p.phase))].sort((a, b) => phaseIndex(a) - phaseIndex(b)))
const paramsPhase = computed(() => params.value.filter(p => p.phase === phaseSel.value).sort((a, b) => (a.ordre || 0) - (b.ordre || 0) || a.id - b.id))

const fmt = (v) => (v === null || v === undefined || v === '') ? '—' : v
function effMin(p) { const s = specByParam.value[p.id]; return s && s.limite_min != null ? s.limite_min : p.limite_min }
function effMax(p) { const s = specByParam.value[p.id]; return s && s.limite_max != null ? s.limite_max : p.limite_max }
function effCible(p) { const s = specByParam.value[p.id]; return s && s.cible != null ? s.cible : p.cible }
function limTxt(p) { const mn = effMin(p), mx = effMax(p); if (mn == null && mx == null) return '—'; return (mn != null ? mn : '…') + ' – ' + (mx != null ? mx : '…') }
function valNum(p) { const v = mesuresEdit.value[p.id]; return (v === '' || v == null) ? null : Number(v) }
function horsSpec(p) { const v = valNum(p); if (v == null || Number.isNaN(v)) return false; const mn = effMin(p), mx = effMax(p); return (mn != null && v < mn) || (mx != null && v > mx) }
function statutCls(p) { const v = valNum(p); if (v == null) return 'neutre'; return horsSpec(p) ? 'ko' : 'ok' }
function statutTxt(p) { const v = valNum(p); if (v == null) return '—'; return horsSpec(p) ? '⚠ Hors spec' : '✓ Conforme' }

const nbConf = computed(() => paramsPhase.value.filter(p => valNum(p) != null && !horsSpec(p)).length)
const nbHors = computed(() => paramsPhase.value.filter(p => horsSpec(p)).length)
const nbVide = computed(() => paramsPhase.value.filter(p => valNum(p) == null).length)

watch(ofSel, async (id) => {
  message.value = ''; specByParam.value = {}; mesuresEdit.value = {}
  const o = ofs.value.find(x => String(x.id) === id)
  if (!o) return
  if (o.produit_id != null) {
    const rs = await supabase.from('pqr_specs_produit').select('*').eq('produit_id', o.produit_id)
    if (!rs.error) { const by = {}; for (const s of (rs.data || [])) by[s.parametre_id] = s; specByParam.value = by }
  }
  const rm = await supabase.from('pqr_mesures').select('*').eq('of_id', o.id)
  if (!rm.error) { const m = {}; for (const r of (rm.data || [])) m[r.parametre_id] = r.valeur; mesuresEdit.value = m }
})

async function enregistrer() {
  erreur.value = ''; message.value = ''
  const o = ofCourant.value; if (!o) return
  const up = [], delIds = []
  for (const p of paramsPhase.value) {
    const v = valNum(p)
    if (v == null || Number.isNaN(v)) delIds.push(p.id)
    else up.push({ of_id: o.id, numero_lot: o.numero_lot, produit_id: o.produit_id, phase: p.phase, parametre_id: p.id, valeur: v, date_mesure: dateMesure.value })
  }
  if (up.length) {
    const r = await supabase.from('pqr_mesures').upsert(up, { onConflict: 'of_id,parametre_id' })
    if (r.error) { erreur.value = r.error.message; return }
  }
  if (delIds.length) {
    const d = await supabase.from('pqr_mesures').delete().eq('of_id', o.id).in('parametre_id', delIds)
    if (d.error) { erreur.value = d.error.message; return }
  }
  message.value = 'Mesures enregistrées' + (nbHors.value ? ' — ⚠ ' + nbHors.value + ' paramètre(s) hors spec.' : '.')
}
</script>

<style scoped>
.pqr-page { color: #1b2733; }
.alert { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 10px 14px; border-radius: 8px; margin: 0 0 14px; }
.ok { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 10px 14px; border-radius: 8px; margin: 0 0 14px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 22px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.empty-card { background: #fff; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 24px; color: #475569; text-align: center; font-size: 14px; }
.btn { background: #0f766e; color: #fff; border: 0; padding: 9px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }

.pqr-bar { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; align-items: flex-end; }
.pqr-bar .f { display: flex; flex-direction: column; gap: 4px; }
.pqr-bar .f.grow { flex: 1; min-width: 240px; }
.pqr-bar label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; }
.pqr-bar select, .pqr-bar input { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; color: #1b2733; }
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
.pqr-tbl td.cible { color: #a855f7; font-weight: 700; }
.pqr-tbl tr.row-ko { background: #fef2f2; }
.pqr-tbl tr.row-ko:hover { background: #fee2e2; }
.val-in { width: 92px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 7px; font: inherit; font-size: 13px; text-align: right; background: #fff; color: #0f172a; font-variant-numeric: tabular-nums; }
.val-in:focus { outline: none; border-color: #a855f7; box-shadow: 0 0 0 3px rgba(168,85,247,.15); }
.val-in.ko { border-color: #f87171; background: #fff1f2; color: #b91c1c; font-weight: 700; }
.stat { font-size: 12px; font-weight: 700; white-space: nowrap; }
.stat.ok { color: #16a34a; }
.stat.ko { color: #dc2626; }
.stat.neutre { color: #cbd5e1; }
</style>
