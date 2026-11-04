<template>
  <div class="andon">
    <div class="an-head">
      <div>
        <div class="an-eyebrow">Lean · アンドン</div>
        <h1 class="an-title">Andon — État des lignes</h1>
        <p class="an-sub">Signal visuel temps réel de la production : ce qui tourne, et où sont les arrêts / problèmes.</p>
      </div>
      <button type="button" class="an-refresh" @click="charger" :disabled="chargement">{{ chargement ? '…' : '↻ Actualiser' }}</button>
    </div>

    <p v-if="erreur" class="an-alert">{{ erreur }}</p>

    <div class="an-kpis">
      <div class="an-kpi k-vert"><div class="an-kv">{{ totalEnCours }}</div><div class="an-kl">Lots en production</div></div>
      <div class="an-kpi" :class="totalProb ? 'k-rouge' : 'k-slate'"><div class="an-kv">{{ totalProb }}</div><div class="an-kl">Lots en problème</div></div>
      <div class="an-kpi k-vert"><div class="an-kv">{{ tuiles.filter(t => t.etat === 'vert').length }}</div><div class="an-kl">Ateliers en marche</div></div>
      <div class="an-kpi" :class="nbAlerte ? 'k-rouge' : 'k-slate'"><div class="an-kv">{{ nbAlerte }}</div><div class="an-kl">Ateliers en alerte</div></div>
    </div>

    <div v-if="!tuiles.length && !chargement" class="an-empty">Aucun atelier avec des phases enregistrées.</div>

    <div class="an-grid">
      <div v-for="t in tuiles" :key="t.phase" class="an-tile" :class="'t-' + t.etat">
        <div class="an-tile-head">
          <span class="an-light" :class="'l-' + t.etat"></span>
          <h2 class="an-tile-title">{{ t.phase }}</h2>
          <span class="an-state-txt">{{ etatTxt(t.etat) }}</span>
        </div>
        <div class="an-tile-counts">
          <span class="an-cnt c-cours">{{ t.nb }} en cours</span>
          <span v-if="t.prob" class="an-cnt c-prob">{{ t.prob }} problème<span v-if="t.prob > 1">s</span></span>
          <span v-if="t.attente" class="an-cnt c-att">{{ t.attente }} en attente</span>
        </div>
        <ul v-if="t.lots.length" class="an-lots">
          <li v-for="l in t.lots" :key="l.id" :class="{ 'lot-prob': l.probleme }">
            <span class="an-lot-no">{{ l.lot }}</span>
            <span class="an-lot-prod">{{ l.code }}<span v-if="l.desig"> — {{ l.desig }}</span></span>
            <span v-if="l.tags.length" class="an-lot-tags"><span v-for="tg in l.tags" :key="tg" class="an-tag">{{ tg }}</span></span>
            <span v-if="l.equip" class="an-lot-eq">{{ equipNom(l.equip) }}</span>
          </li>
        </ul>
        <div v-else class="an-idle">Aucun lot en cours</div>
      </div>
    </div>

    <p class="an-foot">Vert = production en cours · Rouge = déviation ou triage en cours (arrêt/problème) · Gris = atelier à l'arrêt. L'état « en cours » vient des phases dont le début est saisi sans fin (Suivi des phases).</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'

const phases = ref([])      // suivi_phases actives
const ordres = ref([])      // OF en cours
const equipements = ref([])
const chargement = ref(true)
const erreur = ref('')

async function fetchAllPaged(make) {
  const size = 1000; let from = 0, all = []
  for (;;) { const r = await make().range(from, from + size - 1); if (r.error) return { error: r.error, data: all }; all = all.concat(r.data || []); if (!r.data || r.data.length < size) break; from += size }
  return { data: all, error: null }
}

async function charger() {
  chargement.value = true; erreur.value = ''
  const ro = await fetchAllPaged(() => supabase.from('ordres_fabrication')
    .select('id, numero_lot, statut, deviation, deviation_cond, en_triage, date_lancement, date_fin_fabrication, produits(code_pf, designation)'))
  if (ro.error) { erreur.value = ro.error.message; chargement.value = false; return }
  // OF en cours de fabrication : lancés et non terminés
  ordres.value = (ro.data || []).filter(o => o.date_lancement && !o.date_fin_fabrication)
  const rp = await fetchAllPaged(() => supabase.from('suivi_phases')
    .select('ordre_id, phase, statut, date_debut, date_phase, equipement_id, en_triage, triage_debut, triage_fin').eq('actif', true))
  if (!rp.error) phases.value = rp.data || []
  const re = await fetchAllPaged(() => supabase.from('equipements').select('id, code, nom').eq('actif', true))
  if (!re.error) equipements.value = re.data || []
  chargement.value = false
}
onMounted(charger)

const ordreById = computed(() => { const m = {}; for (const o of ordres.value) m[o.id] = o; return m })
const equipById = computed(() => { const m = {}; for (const e of equipements.value) m[e.id] = e; return m })
function equipNom(id) { const e = equipById.value[id]; return e ? (e.code || e.nom || '') : '' }

const ORDRE = ['Pesée', 'Granulation et Séchage', 'Mélange', 'Compression', 'Pelliculage', 'Conditionnement', 'Livraison Vrac']
function normPh(p) { p = String(p || '').trim(); return /^(granulation|s[ée]chage)$/i.test(p) ? 'Granulation et Séchage' : p }
function rang(ph) { const i = ORDRE.indexOf(ph); return i < 0 ? 99 : i }

// Ateliers réels = phases présentes dans les enregistrements
const ateliersReels = computed(() => {
  const s = new Set()
  for (const p of phases.value) { const n = normPh(p.phase); if (n) s.add(n) }
  return [...s].sort((a, b) => rang(a) - rang(b) || a.localeCompare(b))
})

// Lots en cours (phase démarrée non terminée) par atelier, + attente (phase à faire sur un OF en cours)
const parAtelier = computed(() => {
  const cours = {}, attente = {}
  for (const s of phases.value) {
    const o = ordreById.value[s.ordre_id]
    if (!o) continue // seulement les OF en cours
    const ph = normPh(s.phase)
    if (s.statut === 'En cours' || (s.date_debut && !s.date_phase)) {
      const tags = []
      if (o.deviation) tags.push('Déviation fab.')
      if (o.deviation_cond) tags.push('Déviation cond.')
      if (o.en_triage || (s.triage_debut && !s.triage_fin)) tags.push('Triage')
      const probleme = tags.length > 0
      ;(cours[ph] = cours[ph] || []).push({ id: o.id, lot: o.numero_lot || '—', code: (o.produits && o.produits.code_pf) || '—', desig: (o.produits && o.produits.designation) || '', probleme, tags, equip: s.equipement_id || null })
    } else if (s.statut === 'À faire' || (!s.date_debut && !s.date_phase)) {
      attente[ph] = (attente[ph] || 0) + 1
    }
  }
  return { cours, attente }
})

const tuiles = computed(() => {
  const { cours, attente } = parAtelier.value
  return ateliersReels.value.map(ph => {
    const lots = (cours[ph] || []).sort((a, b) => (b.probleme ? 1 : 0) - (a.probleme ? 1 : 0))
    const prob = lots.filter(l => l.probleme).length
    const etat = prob > 0 ? 'rouge' : (lots.length > 0 ? 'vert' : 'gris')
    return { phase: ph, lots, nb: lots.length, prob, attente: attente[ph] || 0, etat }
  })
})

const totalEnCours = computed(() => tuiles.value.reduce((s, t) => s + t.nb, 0))
const totalProb = computed(() => tuiles.value.reduce((s, t) => s + t.prob, 0))
const nbAlerte = computed(() => tuiles.value.filter(t => t.etat === 'rouge').length)
function etatTxt(e) { return e === 'rouge' ? 'ALERTE' : e === 'vert' ? 'En marche' : 'À l\'arrêt' }
</script>

<style scoped>
.andon { max-width: 1280px; margin: 0 auto; padding: 4px 2px 40px; }
.an-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.an-eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #e11d48; }
.an-title { margin: 2px 0 2px; font-size: 24px; font-weight: 800; color: #0f172a; }
.an-sub { margin: 0; color: #64748b; font-size: 13.5px; }
.an-refresh { border: 1px solid #e2e8f0; background: #fff; border-radius: 9px; padding: 8px 14px; font: inherit; font-size: 13px; font-weight: 700; color: #334155; cursor: pointer; white-space: nowrap; }
.an-refresh:hover { background: #f8fafc; }
.an-alert { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; border-radius: 8px; padding: 10px 14px; font-size: 13px; }
.an-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; }
.an-kpi { border-radius: 12px; padding: 14px 16px; border: 1px solid #e2e8f0; background: #fff; }
.an-kv { font-size: 28px; font-weight: 800; line-height: 1; }
.an-kl { margin-top: 4px; font-size: 12.5px; color: #64748b; font-weight: 600; }
.k-vert .an-kv { color: #047857; } .k-vert { background: #ecfdf5; border-color: #a7f3d0; }
.k-rouge .an-kv { color: #b91c1c; } .k-rouge { background: #fef2f2; border-color: #fecaca; }
.k-slate .an-kv { color: #334155; }
.an-empty { text-align: center; color: #64748b; padding: 40px; }
.an-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
.an-tile { border-radius: 14px; border: 1px solid #e2e8f0; background: #fff; padding: 14px 16px; box-shadow: 0 1px 2px rgba(0,0,0,.04); }
.an-tile.t-rouge { border-color: #fca5a5; background: #fff6f6; }
.an-tile.t-vert { border-color: #a7f3d0; }
.an-tile-head { display: flex; align-items: center; gap: 10px; }
.an-light { width: 16px; height: 16px; border-radius: 50%; background: #cbd5e1; flex: none; }
.an-light.l-vert { background: #22c55e; box-shadow: 0 0 0 4px rgba(34,197,94,.18); }
.an-light.l-gris { background: #cbd5e1; }
.an-light.l-rouge { background: #ef4444; animation: anPulse 1.1s infinite; }
@keyframes anPulse { 0% { box-shadow: 0 0 0 0 rgba(239,68,68,.6); } 70% { box-shadow: 0 0 0 8px rgba(239,68,68,0); } 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); } }
.an-tile-title { margin: 0; font-size: 15px; font-weight: 800; color: #0f172a; flex: 1; }
.an-state-txt { font-size: 11px; font-weight: 800; letter-spacing: .04em; color: #64748b; }
.t-rouge .an-state-txt { color: #b91c1c; }
.t-vert .an-state-txt { color: #047857; }
.an-tile-counts { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; }
.an-cnt { font-size: 11.5px; font-weight: 700; padding: 3px 9px; border-radius: 999px; }
.c-cours { background: #ecfdf5; color: #047857; }
.c-prob { background: #fee2e2; color: #b91c1c; }
.c-att { background: #f1f5f9; color: #64748b; }
.an-lots { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.an-lots li { display: flex; align-items: center; gap: 8px; font-size: 12.5px; padding: 5px 8px; border-radius: 8px; background: #f8fafc; flex-wrap: wrap; }
.an-lots li.lot-prob { background: #fef2f2; }
.an-lot-no { font-weight: 800; font-variant-numeric: tabular-nums; color: #0f172a; }
.an-lot-prod { color: #475569; flex: 1; min-width: 80px; }
.an-tag { display: inline-block; font-size: 10px; font-weight: 700; color: #b91c1c; background: #fee2e2; padding: 1px 6px; border-radius: 999px; margin-left: 4px; }
.an-lot-eq { font-size: 10.5px; color: #64748b; font-weight: 700; background: #eef2ff; padding: 1px 6px; border-radius: 999px; }
.an-idle { color: #94a3b8; font-size: 12.5px; font-style: italic; padding: 4px 0; }
.an-foot { margin-top: 18px; color: #94a3b8; font-size: 12px; }
@media (max-width: 720px) { .an-kpis { grid-template-columns: repeat(2, 1fr); } }
</style>
