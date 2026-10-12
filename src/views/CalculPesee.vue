<template>
  <div class="pes-page">
    <PageHeader title="Pesée — Calcul API / Excipient" tone="#4f46e5"
      subtitle="Calcule les quantités réelles à peser à partir des quantités théoriques et du titre de l'API. La masse totale du lot reste constante." />

    <section class="card">
      <div class="card-head">
        <h2 class="card-title">Données</h2>
        <select v-model="unite" class="u-sel" style="margin-left:auto">
          <option value="mg">mg</option>
          <option value="g">g</option>
          <option value="kg">kg</option>
        </select>
      </div>
      <div class="grid">
        <label class="fld">Quantité théorique API ({{ unite }})
          <input v-model.number="theoAPI" type="number" min="0" step="any" placeholder="ex. 500" />
        </label>
        <label class="fld">Titre API (%)
          <input v-model.number="titre" type="number" min="0" step="any" placeholder="ex. 98.5" />
        </label>
        <label class="fld">Quantité théorique excipient ({{ unite }})
          <input v-model.number="theoExc" type="number" min="0" step="any" placeholder="ex. 1500" />
        </label>
      </div>
      <p class="hint">
        <b>API :</b> qté réelle × titre = qté théorique × 100 → qté réelle API = qté théorique × 100 ÷ titre.<br />
        <b>Excipient :</b> réel API + réel excipient = théorique API + théorique excipient → l'excipient compense pour garder la masse totale constante.
      </p>
      <button class="btn ghost" @click="reset">Réinitialiser</button>
    </section>

    <section class="card" v-if="reelAPI != null || titreInvalide">
      <h2 class="card-title">Résultats</h2>
      <p v-if="titreInvalide" class="alert">Le titre doit être un pourcentage supérieur à 0.</p>
      <p v-if="excipientNegatif" class="alert">⚠ Excipient négatif : la quantité réelle d'API ({{ fmt(reelAPI) }} {{ unite }}) dépasse la masse totale théorique ({{ fmt(totalTheo) }} {{ unite }}). Vérifie le titre et les quantités.</p>

      <template v-if="reelAPI != null">
        <div class="res">
          <div class="res-card api">
            <div class="rc-l">Quantité réelle API</div>
            <div class="rc-v">{{ fmt(reelAPI) }} <span>{{ unite }}</span></div>
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
            <tr>
              <td>API</td>
              <td class="r">{{ fmt(theoAPI) }}</td>
              <td class="r b">{{ fmt(reelAPI) }}</td>
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
        <p class="note" v-if="reelExc != null">La masse totale réelle est identique à la masse totale théorique : l'excipient compense exactement le surplus (ou le déficit) d'API lié au titre.</p>
        <p class="note" v-else>Renseigne la quantité théorique d'excipient pour obtenir sa quantité réelle et le total.</p>
      </template>
    </section>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import PageHeader from '../components/PageHeader.vue'

const unite = ref('g')
const theoAPI = ref(null)
const theoExc = ref(null)
const titre = ref(100)

const vide = (x) => x === null || x === '' || x === undefined

const titreInvalide = computed(() => !vide(titre.value) && !(Number(titre.value) > 0))

// API : qté réelle = qté théorique × 100 / titre
const reelAPI = computed(() => {
  const t = Number(theoAPI.value), ti = Number(titre.value)
  if (!(t > 0) || !(ti > 0)) return null
  return t * 100 / ti
})
// Excipient : réel API + réel excipient = théo API + théo excipient (total constant)
const reelExc = computed(() => {
  const ra = reelAPI.value
  if (ra == null || vide(theoExc.value)) return null
  const te = Number(theoExc.value), ta = Number(theoAPI.value)
  if (!(te >= 0) || !(ta >= 0)) return null
  return (ta + te) - ra
})
const totalTheo = computed(() => {
  if (vide(theoAPI.value) || vide(theoExc.value)) return null
  const ta = Number(theoAPI.value), te = Number(theoExc.value)
  return (ta >= 0 && te >= 0) ? ta + te : null
})
const totalReel = computed(() => {
  const ra = reelAPI.value, re = reelExc.value
  return (ra != null && re != null) ? ra + re : null
})
const ecartAPI = computed(() => {
  const ra = reelAPI.value, ta = Number(theoAPI.value)
  return (ra != null && ta >= 0) ? ra - ta : null
})
const excipientNegatif = computed(() => reelExc.value != null && reelExc.value < 0)

function fmt(v) { if (v == null || Number.isNaN(Number(v))) return '—'; return Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 3 }) }
function sign(v) { return (v != null && v > 1e-9) ? '+' : '' }
function ecartCls(v) { if (v == null || Math.abs(v) < 1e-9) return ''; return v > 0 ? 'up' : 'down' }
function reset() { theoAPI.value = null; theoExc.value = null; titre.value = 100 }
</script>

<style scoped>
.pes-page { color: #1b2733; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 22px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
.card-title { margin: 0 0 14px; font-size: 17px; }
.card-head .card-title { margin: 0; }
.u-sel { padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; font-weight: 700; background: #fff; color: #1b2733; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 12px; }
.fld { display: flex; flex-direction: column; gap: 5px; font-size: 13px; font-weight: 600; color: #475569; }
.fld input { padding: 9px 11px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 15px; color: #0f172a; }
.fld input:focus { outline: 2px solid #c7d2fe; border-color: #6366f1; }
.hint { font-size: 12px; color: #64748b; margin: 0 0 12px; background: #f8fafc; border: 1px solid #eef2f6; border-radius: 8px; padding: 9px 11px; line-height: 1.6; }
.btn { background: #4f46e5; color: #fff; border: 0; padding: 9px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
.btn.ghost { background: #fff; color: #475569; border: 1px solid #cbd5e1; }
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
.t tr.tot td { font-weight: 800; background: #fafafa; border-top: 2px solid #e2e8f0; }
.t td.up { color: #047857; }
.t td.down { color: #b91c1c; }
.note { font-size: 12px; color: #64748b; margin-top: 10px; line-height: 1.5; }
</style>
