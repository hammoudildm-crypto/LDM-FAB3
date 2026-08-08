<template>
  <div class="tr">
    <header class="tr-head">
      <div>
        <h1 class="tr-title">Suivi temps réel <span class="tr-live"><i></i>LIVE</span></h1>
        <p class="tr-sub">Lots de fabrication en cours — avancement dans la gamme</p>
      </div>
      <div class="tr-actions">
        <span class="tr-maj">Mis à jour à {{ majHeure }}</span>
        <button class="tr-refresh" @click="charger" :disabled="chargement">↻ Actualiser</button>
      </div>
    </header>

    <!-- Bandeau : nb en cours + répartition par phase courante -->
    <div class="tr-band">
      <div class="tr-kpi"><span class="k-val">{{ lotsEnCours.length }}</span><span class="k-lbl">lots en cours</span></div>
      <div class="tr-phbar">
        <button v-for="p in repartition" :key="p.key" class="tr-phpill" :class="{ on: filtrePhase === p.key }"
                :style="{ '--pc': p.color }" @click="filtrePhase = filtrePhase === p.key ? null : p.key">
          <span class="pp-dot"></span>{{ p.label }} <b>{{ p.n }}</b>
        </button>
      </div>
    </div>

    <div v-if="chargement" class="tr-empty">Chargement…</div>
    <div v-else-if="!lotsAffiches.length" class="tr-empty">Aucun lot en cours{{ filtrePhase ? ' à cette phase' : '' }}.</div>

    <!-- Cartes lots -->
    <div v-else class="tr-grid">
      <div v-for="l in lotsAffiches" :key="l.id" class="lot" :style="{ '--pc': l.cur.color }">
        <div class="lot-top">
          <span class="lot-num">{{ l.numero_lot }}</span>
          <span class="lot-cur" :style="{ background: l.cur.color }">{{ l.cur.label }}</span>
        </div>
        <div class="lot-prod">{{ l.code }} — {{ l.desig }}</div>

        <div class="phases">
          <span v-for="e in l.etapes" :key="e.key" class="ph-chip" :class="e.cls" :style="{ '--pc': e.color }" :title="e.label + ' — ' + e.statutLbl">{{ e.label }}</span>
        </div>

        <div class="lot-prog">
          <div class="prog-bar"><span :style="{ width: l.pct + '%', background: l.cur.color }"></span></div>
          <span class="prog-txt">{{ l.done }}/{{ l.total }} phases</span>
        </div>

        <div class="lot-foot">
          <span>{{ fmt(l.boites) }} boîtes</span>
          <span v-if="l.equip">· {{ l.equip }}</span>
          <span v-if="l.depuis">· depuis {{ l.depuis }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { supabase } from '../supabase'

const num = (v) => Number(v) || 0
const fmt = (v) => Math.round(num(v)).toLocaleString('fr-FR')
function fmtDate(d) {
  if (!d) return null
  const x = new Date(d); if (isNaN(x)) return null
  return (/[T ]\d{2}:/.test(String(d)) ? x.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + ' ' : '') + x.toLocaleDateString('fr-FR')
}

const PHASES = [
  { key: 'pesee', label: 'Pesée', color: '#64748b' },
  { key: 'granulation', label: 'Granulation / Séchage', color: '#14b8a6' },
  { key: 'melange', label: 'Mélange', color: '#0ea5e9' },
  { key: 'compression', label: 'Compression', color: '#8b5cf6' },
  { key: 'remplissage', label: 'Remplissage gélules', color: '#6366f1' },
  { key: 'pelliculage', label: 'Pelliculage', color: '#f59e0b' },
  { key: 'conditionnement', label: 'Conditionnement', color: '#22c55e' }
]
const PH = Object.fromEntries(PHASES.map(p => [p.key, p]))
const CANON_FAB = ['Pesée', 'Granulation', 'Mélange', 'Compression', 'Pelliculage']

function phaseKey(nom) {
  const t = String(nom || '').trim().toLowerCase()
  if (!t) return null
  if (/gran|s[ée]ch/.test(t)) return 'granulation'
  if (/pes/.test(t)) return 'pesee'
  if (/m[ée]lang/.test(t)) return 'melange'
  if (/compress/.test(t)) return 'compression'
  if (/rempliss|g[ée]lul/.test(t)) return 'remplissage'
  if (/pellicul|enrob/.test(t)) return 'pelliculage'
  if (/condition/.test(t)) return 'conditionnement'
  return null
}
const STAT_LBL = { 'Terminé': 'Terminé', 'En cours': 'En cours' }

const ofs = ref([]); const suivi = ref([])
const chargement = ref(true)
const filtrePhase = ref(null)
const majHeure = ref('')
let timer = null

async function fetchAllPaged(make) {
  const out = []; let from = 0; const size = 1000
  while (true) {
    const { data, error } = await make().range(from, from + size - 1)
    if (error) throw error
    out.push(...(data || []))
    if (!data || data.length < size) break
    from += size
  }
  return out
}

async function charger() {
  chargement.value = true
  try {
    const [ro, rs] = await Promise.all([
      fetchAllPaged(() => supabase.from('ordres_fabrication')
        .select('id, numero_lot, statut, quantite_theorique, boites_fabriquees, date_lancement, date_fin_fabrication, equipements(nom), produits(code_pf, designation, gamme)')),
      fetchAllPaged(() => supabase.from('suivi_phases').select('ordre_id, phase, statut, date_phase, date_debut').eq('actif', true))
    ])
    ofs.value = ro; suivi.value = rs
    majHeure.value = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch (e) { console.error(e) } finally { chargement.value = false }
}

const phasesLot = computed(() => {
  const m = {}
  for (const sp of suivi.value) {
    const k = phaseKey(sp.phase); if (!k) continue
    if (!m[sp.ordre_id]) m[sp.ordre_id] = {}
    const rec = { statut: sp.statut, date: sp.date_phase || sp.date_debut }
    if (!m[sp.ordre_id][k] || sp.statut === 'Terminé') m[sp.ordre_id][k] = rec
  }
  return m
})

const lotsEnCours = computed(() => {
  const out = []
  for (const o of ofs.value) {
    if (/rejet/i.test(o.statut || '')) continue
    const pl = phasesLot.value[o.id] || {}
    const p = o.produits || {}
    const gamme = (Array.isArray(p.gamme) && p.gamme.length) ? p.gamme : CANON_FAB
    const keys = []; const seen = new Set()
    for (const ph of gamme) { const k = phaseKey(ph); if (k && !seen.has(k)) { seen.add(k); keys.push(k) } }
    if (!seen.has('conditionnement')) keys.push('conditionnement')

    const etapes = keys.map(k => {
      const st = (pl[k] || {}).statut || 'À faire'
      const cls = st === 'Terminé' ? 'done' : st === 'En cours' ? 'cours' : 'todo'
      return { key: k, label: (PH[k] || {}).label || k, color: (PH[k] || {}).color || '#94a3b8', statut: st, statutLbl: STAT_LBL[st] || 'À faire', cls }
    })
    const done = etapes.filter(e => e.statut === 'Terminé').length
    const enCours = etapes.some(e => e.statut === 'En cours')
    if ((done === 0 && !enCours) || done === etapes.length) continue  // pas commencé ou tout fini

    let curIdx = etapes.findIndex(e => e.statut === 'En cours')
    if (curIdx < 0) curIdx = etapes.findIndex(e => e.statut !== 'Terminé')
    if (curIdx < 0) curIdx = etapes.length - 1
    const cur = etapes[curIdx]
    const curRec = pl[cur.key]

    out.push({
      id: o.id, numero_lot: o.numero_lot || '—', code: p.code_pf || '—', desig: p.designation || '',
      etapes, done, total: etapes.length, pct: Math.round(done / etapes.length * 100),
      cur: { key: cur.key, label: cur.label, color: cur.color },
      boites: num(o.quantite_theorique) || num(o.boites_fabriquees),
      equip: o.equipements ? o.equipements.nom : null,
      depuis: fmtDate((curRec && curRec.date) || o.date_lancement)
    })
  }
  return out.sort((a, b) => b.pct - a.pct)
})

const repartition = computed(() => {
  const m = {}
  for (const l of lotsEnCours.value) { m[l.cur.key] = (m[l.cur.key] || 0) + 1 }
  return PHASES.filter(p => m[p.key]).map(p => ({ key: p.key, label: p.label, color: p.color, n: m[p.key] }))
})
const lotsAffiches = computed(() => filtrePhase.value ? lotsEnCours.value.filter(l => l.cur.key === filtrePhase.value) : lotsEnCours.value)

onMounted(() => { charger(); timer = setInterval(charger, 30000) })
onUnmounted(() => clearInterval(timer))
</script>

<style scoped>
.tr { padding: 24px 30px 50px; max-width: 1240px; margin: 0 auto; color: #1e293b; font-family: 'Segoe UI', system-ui, sans-serif; }
.tr-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
.tr-title { margin: 0; font-size: 24px; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 12px; }
.tr-live { font-size: 11px; font-weight: 800; letter-spacing: 1px; color: #16a34a; display: inline-flex; align-items: center; gap: 6px; background: #dcfce7; padding: 3px 10px; border-radius: 999px; }
.tr-live i { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 8px #22c55e; animation: blink 1.4s infinite; }
.tr-sub { margin: 4px 0 0; font-size: 13px; color: #64748b; }
.tr-actions { display: flex; align-items: center; gap: 14px; }
.tr-maj { font-size: 12px; color: #94a3b8; }
.tr-refresh { background: #0f172a; color: #fff; border: none; border-radius: 9px; font: inherit; font-size: 13px; font-weight: 600; padding: 9px 16px; cursor: pointer; }
.tr-refresh:disabled { opacity: .5; cursor: default; }

.tr-band { display: flex; align-items: center; gap: 20px; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 18px; margin-bottom: 18px; box-shadow: 0 4px 14px rgba(30,41,59,.05); flex-wrap: wrap; }
.tr-kpi { display: flex; flex-direction: column; padding-right: 20px; border-right: 1px solid #e2e8f0; }
.tr-kpi .k-val { font-size: 30px; font-weight: 800; color: #0f172a; line-height: 1; }
.tr-kpi .k-lbl { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: .5px; margin-top: 3px; }
.tr-phbar { display: flex; gap: 8px; flex-wrap: wrap; flex: 1; }
.tr-phpill { background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 999px; font: inherit; font-size: 12px; font-weight: 600; color: #475569; padding: 6px 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; }
.tr-phpill.on { border-color: var(--pc); background: color-mix(in srgb, var(--pc) 12%, #fff); color: #0f172a; }
.pp-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--pc); }
.tr-phpill b { color: var(--pc); }

.tr-empty { padding: 50px; text-align: center; color: #94a3b8; font-size: 14px; }
.tr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
.lot { background: #fff; border: 1px solid #e2e8f0; border-top: 4px solid var(--pc); border-radius: 14px; padding: 15px 17px; box-shadow: 0 6px 18px rgba(30,41,59,.07); }
.lot-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.lot-num { font-family: ui-monospace, monospace; font-weight: 800; font-size: 16px; color: #0f172a; }
.lot-cur { color: #fff; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; }
.lot-prod { font-size: 12.5px; color: #64748b; margin-top: 3px; line-height: 1.3; }
.phases { display: flex; flex-wrap: wrap; gap: 5px; margin: 12px 0; }
.ph-chip { font-size: 10.5px; font-weight: 600; padding: 4px 9px; border-radius: 7px; border: 1px solid #e2e8f0; color: #94a3b8; background: #f8fafc; }
.ph-chip.done { background: color-mix(in srgb, var(--pc) 16%, #fff); border-color: var(--pc); color: var(--pc); }
.ph-chip.cours { background: var(--pc); border-color: var(--pc); color: #fff; animation: pulse 1.6s infinite; }
.ph-chip.todo { opacity: .7; }
.lot-prog { display: flex; align-items: center; gap: 10px; }
.prog-bar { flex: 1; height: 7px; background: #eef2f7; border-radius: 4px; overflow: hidden; }
.prog-bar span { display: block; height: 100%; border-radius: 4px; }
.prog-txt { font-size: 11px; font-weight: 700; color: #64748b; }
.lot-foot { margin-top: 10px; font-size: 11.5px; color: #94a3b8; display: flex; gap: 6px; flex-wrap: wrap; }

@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
@keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--pc) 45%, transparent); } 50% { box-shadow: 0 0 0 4px transparent; } }

@media (max-width: 720px) { .tr { padding: 16px; } .tr-grid { grid-template-columns: 1fr; } }
</style>
