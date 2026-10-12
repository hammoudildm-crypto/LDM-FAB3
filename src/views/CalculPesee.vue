<template>
  <div class="pes-page">
    <PageHeader title="Pesée — Calcul API / Excipient" tone="#4f46e5"
      subtitle="Calcule les quantités réelles à peser. Le titre de chaque lot d'API est déduit du dosage et de la LOD. La masse totale du lot reste constante." />

    <section class="card">
      <div class="card-head">
        <h2 class="card-title">API — lots</h2>
        <select v-model="unite" class="u-sel" style="margin-left:auto">
          <option value="mg">mg</option>
          <option value="g">g</option>
          <option value="kg">kg</option>
        </select>
      </div>

      <div class="lots-wrap">
        <table class="lots-tbl">
          <thead>
            <tr>
              <th>Lot API</th>
              <th>Qté théorique ({{ unite }})</th>
              <th>Dosage (%)</th>
              <th>LOD (%)</th>
              <th>Titre (%)</th>
              <th>Qté réelle ({{ unite }})</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(l, i) in lots" :key="i">
              <td><input v-model="l.lot" type="text" placeholder="N° lot" /></td>
              <td><input v-model.number="l.theo" type="number" min="0" step="any" placeholder="ex. 500" /></td>
              <td><input v-model.number="l.dosage" type="number" min="0" step="any" placeholder="ex. 99.5" /></td>
              <td><input v-model.number="l.lod" type="number" min="0" step="any" placeholder="ex. 0.5" /></td>
              <td class="calc">{{ lotsCalc[i].titre != null ? fmt(lotsCalc[i].titre) + ' %' : '—' }}</td>
              <td class="calc b">{{ lotsCalc[i].reel != null ? fmt(lotsCalc[i].reel) : '—' }}</td>
              <td><button v-if="lots.length > 1" class="x" @click="removeLot(i)" title="Supprimer ce lot">✕</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <button class="btn ghost sm" @click="addLot">+ Ajouter un lot API</button>

      <p class="hint">
        <b>Titre</b> de chaque lot = <b>Dosage − LOD</b>.<br />
        <b>API :</b> qté réelle × titre = qté théorique × 100 → qté réelle = qté théorique × 100 ÷ titre (par lot).<br />
        <b>Excipient :</b> total réel API + réel excipient = total théorique API + théorique excipient (masse totale constante).
      </p>
    </section>

    <section class="card">
      <h2 class="card-title">Excipient</h2>
      <div class="grid">
        <label class="fld">Quantité théorique excipient ({{ unite }})
          <input v-model.number="theoExc" type="number" min="0" step="any" placeholder="ex. 1500" />
        </label>
      </div>
      <button class="btn ghost sm" @click="reset">Réinitialiser tout</button>
    </section>

    <section class="card" v-if="totalReelAPI != null || titreInvalide">
      <h2 class="card-title">Résultats</h2>
      <p v-if="titreInvalide" class="alert">Un lot a un titre invalide (Dosage − LOD ≤ 0). Vérifie le dosage et la LOD.</p>
      <p v-if="excipientNegatif" class="alert">⚠ Excipient négatif : la quantité réelle totale d'API ({{ fmt(totalReelAPI) }} {{ unite }}) dépasse la masse totale théorique ({{ fmt(totalTheo) }} {{ unite }}). Vérifie les titres et les quantités.</p>

      <template v-if="totalReelAPI != null">
        <div class="res">
          <div class="res-card api">
            <div class="rc-l">Total réel API</div>
            <div class="rc-v">{{ fmt(totalReelAPI) }} <span>{{ unite }}</span></div>
            <div class="rc-e" v-if="ecartAPI != null">{{ sign(ecartAPI) }}{{ fmt(ecartAPI) }} {{ unite }} vs théorique</div>
          </div>
          <div class="res-card exc" :class="{ neg: excipientNegatif }" v-if="reelExc != null">
            <div class="rc-l">Quantité réelle excipient</div>
            <div class="rc-v">{{ fmt(reelExc) }} <span>{{ unite }}</span></div>
            <div class="rc-e" v-if="ecartAPI != null">{{ sign(-ecartAPI) }}{{ fmt(-ecartAPI) }} {{ unite }} vs théorique</div>
          </div>
        </div>

        <table class="t">
          <thead><tr><th>Composant</th><th class="r">Théorique ({{ unite }})</th><th class="r">Réel ({{ unite }})</th><th class="r">Écart ({{ unite }})</th></tr></thead>
          <tbody>
            <tr v-for="l in lotsReels" :key="l.idx">
              <td>API — lot {{ l.lot || ('n°' + (l.idx + 1)) }} <span class="titre-badge">titre {{ fmt(l.titre) }} %</span></td>
              <td class="r">{{ fmt(l.theoNum) }}</td>
              <td class="r b">{{ fmt(l.reel) }}</td>
              <td class="r" :class="ecartCls(l.reel - l.theoNum)">{{ sign(l.reel - l.theoNum) }}{{ fmt(l.reel - l.theoNum) }}</td>
            </tr>
            <tr class="sub" v-if="lotsReels.length > 1">
              <td>Total API</td>
              <td class="r">{{ fmt(totalTheoAPI) }}</td>
              <td class="r b">{{ fmt(totalReelAPI) }}</td>
              <td class="r" :class="ecartCls(ecartAPI)">{{ sign(ecartAPI) }}{{ fmt(ecartAPI) }}</td>
            </tr>
            <tr v-if="reelExc != null">
              <td>Excipient</td>
              <td class="r">{{ fmt(theoExc) }}</td>
              <td class="r b">{{ fmt(reelExc) }}</td>
              <td class="r" :class="ecartCls(-ecartAPI)">{{ sign(-ecartAPI) }}{{ fmt(-ecartAPI) }}</td>
            </tr>
            <tr class="tot" v-if="totalReel != null">
              <td>Total</td>
              <td class="r">{{ fmt(totalTheo) }}</td>
              <td class="r b">{{ fmt(totalReel) }}</td>
              <td class="r">0</td>
            </tr>
          </tbody>
        </table>
        <p class="note" v-if="reelExc != null">Chaque lot est corrigé par son propre titre (= dosage − LOD). L'excipient compense exactement le surplus (ou le déficit) total d'API, la masse totale restant constante.</p>
        <p class="note" v-else>Renseigne la quantité théorique d'excipient pour obtenir sa quantité réelle et le total.</p>
      </template>
    </section>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import PageHeader from '../components/PageHeader.vue'

const unite = ref('g')
const theoExc = ref(null)
const lots = ref([{ lot: '', theo: null, dosage: null, lod: null }])

const vide = (x) => x === null || x === '' || x === undefined

// Calcul par lot : titre = dosage - LOD ; qté réelle = théo x 100 / titre
const lotsCalc = computed(() => lots.value.map((l, i) => {
  const dosage = Number(l.dosage), lod = Number(l.lod), theo = Number(l.theo)
  const titre = (!vide(l.dosage) && !vide(l.lod)) ? dosage - lod : null
  const theoNum = (!vide(l.theo) && theo >= 0) ? theo : null
  const reel = (theoNum != null && theoNum > 0 && titre != null && titre > 0) ? theoNum * 100 / titre : null
  return { idx: i, lot: l.lot, titre, theoNum, reel }
}))
const lotsReels = computed(() => lotsCalc.value.filter(l => l.reel != null && l.theoNum != null))

const titreInvalide = computed(() => lotsCalc.value.some(l => l.titre != null && l.titre <= 0))

const totalTheoAPI = computed(() => {
  let s = 0, any = false
  for (const l of lotsCalc.value) { if (l.theoNum != null) { s += l.theoNum; any = true } }
  return any ? s : null
})
// null si un lot a une qté théorique mais un réel non calculable (calcul incomplet)
const totalReelAPI = computed(() => {
  let s = 0, any = false
  for (const l of lotsCalc.value) {
    if (l.theoNum != null && l.theoNum > 0) {
      if (l.reel == null) return null
      s += l.reel; any = true
    }
  }
  return any ? s : null
})
const reelExc = computed(() => {
  const tra = totalReelAPI.value, tta = totalTheoAPI.value
  if (tra == null || tta == null || vide(theoExc.value)) return null
  const te = Number(theoExc.value)
  if (!(te >= 0)) return null
  return (tta + te) - tra
})
const totalTheo = computed(() => {
  const tta = totalTheoAPI.value
  if (tta == null || vide(theoExc.value)) return null
  const te = Number(theoExc.value)
  return (te >= 0) ? tta + te : null
})
const totalReel = computed(() => {
  const tra = totalReelAPI.value, re = reelExc.value
  return (tra != null && re != null) ? tra + re : null
})
const ecartAPI = computed(() => {
  const tra = totalReelAPI.value, tta = totalTheoAPI.value
  return (tra != null && tta != null) ? tra - tta : null
})
const excipientNegatif = computed(() => reelExc.value != null && reelExc.value < 0)

function fmt(v) { if (v == null || Number.isNaN(Number(v))) return '—'; return Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 3 }) }
function sign(v) { return (v != null && v > 1e-9) ? '+' : '' }
function ecartCls(v) { if (v == null || Math.abs(v) < 1e-9) return ''; return v > 0 ? 'up' : 'down' }
function addLot() { lots.value.push({ lot: '', theo: null, dosage: null, lod: null }) }
function removeLot(i) { if (lots.value.length > 1) lots.value.splice(i, 1) }
function reset() { lots.value = [{ lot: '', theo: null, dosage: null, lod: null }]; theoExc.value = null }
</script>

<style scoped>
.pes-page { color: #1b2733; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 22px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
.card-title { margin: 0 0 14px; font-size: 17px; }
.card-head .card-title { margin: 0; }
.u-sel { padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; font-weight: 700; background: #fff; color: #1b2733; }
.lots-wrap { overflow-x: auto; margin-bottom: 10px; }
.lots-tbl { border-collapse: collapse; width: 100%; font-size: 13px; }
.lots-tbl th { text-align: left; background: #f8fafc; color: #475569; padding: 7px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-transform: uppercase; white-space: nowrap; }
.lots-tbl td { padding: 5px 6px; border-bottom: 1px solid #f1f5f9; }
.lots-tbl input { width: 100%; min-width: 74px; padding: 7px 8px; border: 1px solid #cbd5e1; border-radius: 7px; font: inherit; font-size: 14px; color: #0f172a; }
.lots-tbl input[type=text] { min-width: 94px; }
.lots-tbl input:focus { outline: 2px solid #c7d2fe; border-color: #6366f1; }
.lots-tbl .calc { text-align: right; font-weight: 600; color: #0f172a; white-space: nowrap; }
.lots-tbl .calc.b { font-weight: 800; color: #4f46e5; }
.lots-tbl .x { background: #fff; border: 1px solid #fca5a5; color: #dc2626; border-radius: 6px; width: 28px; height: 28px; cursor: pointer; font-size: 13px; }
.lots-tbl .x:hover { background: #fef2f2; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 12px; }
.fld { display: flex; flex-direction: column; gap: 5px; font-size: 13px; font-weight: 600; color: #475569; }
.fld input { padding: 9px 11px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 15px; color: #0f172a; }
.fld input:focus { outline: 2px solid #c7d2fe; border-color: #6366f1; }
.hint { font-size: 12px; color: #64748b; margin: 12px 0 0; background: #f8fafc; border: 1px solid #eef2f6; border-radius: 8px; padding: 9px 11px; line-height: 1.6; }
.btn { background: #4f46e5; color: #fff; border: 0; padding: 9px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
.btn.ghost { background: #fff; color: #475569; border: 1px solid #cbd5e1; }
.btn.sm { padding: 6px 12px; font-size: 13px; }
.alert { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 10px 14px; border-radius: 8px; margin: 0 0 14px; font-size: 13px; }
.res { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; }
.res-card { flex: 1; min-width: 220px; border-radius: 12px; padding: 16px 18px; border: 1px solid; }
.res-card.api { background: #eef2ff; border-color: #c7d2fe; }
.res-card.exc { background: #f0fdfa; border-color: #99f6e4; }
.res-card.exc.neg { background: #fef2f2; border-color: #fecaca; }
.rc-l { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #64748b; }
.rc-v { font-size: 28px; font-weight: 800; color: #0f172a; margin-top: 4px; }
.rc-v span { font-size: 16px; font-weight: 600; color: #64748b; }
.rc-e { font-size: 12px; color: #64748b; margin-top: 4px; font-weight: 600; }
.t { width: 100%; border-collapse: collapse; font-size: 13px; }
.t th { text-align: left; background: #f8fafc; color: #475569; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-transform: uppercase; }
.t th.r, .t td.r { text-align: right; }
.t td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
.t td.b { font-weight: 800; color: #0f172a; }
.t tr.sub td { font-weight: 700; background: #fafbff; }
.t tr.tot td { font-weight: 800; background: #fafafa; border-top: 2px solid #e2e8f0; }
.t td.up { color: #047857; }
.t td.down { color: #b91c1c; }
.titre-badge { font-size: 11px; color: #64748b; font-weight: 600; background: #f1f5f9; padding: 1px 6px; border-radius: 10px; margin-left: 6px; white-space: nowrap; }
.note { font-size: 12px; color: #64748b; margin-top: 10px; line-height: 1.5; }
</style>
