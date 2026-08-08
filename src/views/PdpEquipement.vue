<template>
  <div class="pe">
    <header class="pe-head">
      <div>
        <h1 class="pe-title">PDP Production par équipement</h1>
        <p class="pe-sub">Lots par ligne : en cours, prêts, dans le pipe, planifiés — et avancement du PDP</p>
      </div>
      <div class="pe-year">
        <label>Année</label>
        <select v-model.number="annee"><option v-for="a in annees" :key="a" :value="a">{{ a }}</option></select>
      </div>
    </header>

    <div v-if="chargement" class="pe-empty">Chargement…</div>
    <div v-else-if="!parEquip.length" class="pe-empty">Aucun équipement avec des lots ou un plan pour {{ annee }}.</div>

    <div v-else class="pe-grid">
      <div v-for="g in parEquip" :key="g.id" class="eq">
        <div class="eq-head">
          <span class="eq-badge">{{ g.pret.length + g.pipe.length + g.planifie.length + g.encours.length }}</span>
          <span class="eq-nom">{{ g.nom }}</span>
        </div>

        <div class="eq-now">
          <div class="now-lbl">Maintenant</div>
          <div v-if="g.encours.length" class="now-lot"><b class="now-num">{{ g.encours[0].numero_lot || '—' }}</b><span class="now-prod">{{ prodTxt(g.encours[0]) }}</span></div>
          <div v-else class="now-vide">Aucun lot en conditionnement</div>
        </div>

        <div class="eq-stats">
          <div class="st"><span class="st-n">{{ g.pret.length }}</span><span class="st-l">Prêts</span><span class="st-b">{{ fmt(boxesOf(g.pret)) }} b.</span></div>
          <div class="st"><span class="st-n">{{ g.pipe.length }}</span><span class="st-l">Dans le pipe</span><span class="st-b">{{ fmt(boxesOf(g.pipe)) }} b.</span></div>
          <div class="st"><span class="st-n">{{ g.planifie.length }}</span><span class="st-l">Planifiés</span><span class="st-b">{{ fmt(boxesOf(g.planifie)) }} b.</span></div>
        </div>

        <div class="eq-prog">
          <div class="pgroup">
            <div class="pg-lbl">Année {{ annee }}</div>
            <div class="pg-row"><span class="pg-m">Boîtes</span><div class="pg-bar"><span :class="pct(g.realB, g.planB) >= objectifPct ? 'ok' : 'bas'" :style="{ width: Math.min(pct(g.realB, g.planB), 100) + '%' }"></span></div><span class="pg-v">{{ fmt(g.realB) }}/{{ fmt(g.planB) }} <b>{{ pct(g.realB, g.planB) }}%</b></span></div>
            <div class="pg-row"><span class="pg-m">Lots</span><div class="pg-bar"><span :class="pct(g.realL, g.planL) >= objectifPct ? 'ok' : 'bas'" :style="{ width: Math.min(pct(g.realL, g.planL), 100) + '%' }"></span></div><span class="pg-v">{{ fmt(g.realL) }}/{{ fmt(g.planL) }} <b>{{ pct(g.realL, g.planL) }}%</b></span></div>
          </div>
          <div class="pgroup">
            <div class="pg-lbl">{{ MOIS[moisAuj] }} {{ annee }}</div>
            <div class="pg-row"><span class="pg-m">Boîtes</span><div class="pg-bar"><span :style="{ width: Math.min(pct(g.realMB, g.planMB), 100) + '%' }"></span></div><span class="pg-v">{{ fmt(g.realMB) }}/{{ fmt(g.planMB) }} <b>{{ pct(g.realMB, g.planMB) }}%</b></span></div>
            <div class="pg-row"><span class="pg-m">Lots</span><div class="pg-bar"><span :style="{ width: Math.min(pct(g.realML, g.planML), 100) + '%' }"></span></div><span class="pg-v">{{ fmt(g.realML) }}/{{ fmt(g.planML) }} <b>{{ pct(g.realML, g.planML) }}%</b></span></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'

const num = (v) => Number(v) || 0
const fmt = (v) => Math.round(num(v)).toLocaleString('fr-FR')
const pct = (r, p) => p > 0 ? Math.round(num(r) / num(p) * 100) : 0
const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
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
const prodTxt = (o) => { const p = o && o.produits; return p ? ((p.code_pf || '') + ' — ' + (p.designation || '')) : '' }
const boxesOf = (list) => list.reduce((s, o) => s + num(o.quantite_theorique), 0)

const annee = ref(new Date().getFullYear())
const chargement = ref(true)
const equipements = ref([]); const ofsRaw = ref([]); const planRaw = ref([]); const suivi = ref([])
const auj = new Date()
const moisAuj = computed(() => annee.value === auj.getFullYear() ? auj.getMonth() : 11)
const objectifPct = computed(() => {
  if (annee.value < auj.getFullYear()) return 100
  if (annee.value > auj.getFullYear()) return 0
  const s0 = new Date(annee.value, 0, 1), e0 = new Date(annee.value + 1, 0, 1)
  return Math.round((auj - s0) / (e0 - s0) * 100)
})

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
onMounted(async () => {
  try {
    const [re, ro, rp, rs] = await Promise.all([
      fetchAllPaged(() => supabase.from('equipements').select('id, nom').eq('actif', true).order('nom')),
      fetchAllPaged(() => supabase.from('ordres_fabrication').select('id, numero_lot, statut, quantite_theorique, boites_fabriquees, date_lancement, date_fin_fabrication, equipement_id, produits(code_pf, designation, gamme, taille_lot)')),
      fetchAllPaged(() => supabase.from('plan_production').select('annee, mois, quantite_planifiee, equipement_id, produits(taille_lot)')),
      fetchAllPaged(() => supabase.from('suivi_phases').select('ordre_id, phase, statut').eq('actif', true))
    ])
    equipements.value = re; ofsRaw.value = ro; planRaw.value = rp; suivi.value = rs
  } catch (e) { console.error(e) } finally { chargement.value = false }
})

const annees = computed(() => {
  const s = new Set([new Date().getFullYear()])
  planRaw.value.forEach(r => { if (r.annee) s.add(Number(r.annee)) })
  ofsRaw.value.forEach(o => { const y = o.date_lancement ? new Date(o.date_lancement).getFullYear() : null; if (y) s.add(y) })
  return [...s].sort((a, b) => b - a)
})

const phasesLot = computed(() => {
  const m = {}
  for (const sp of suivi.value) {
    const k = phaseKey(sp.phase); if (!k) continue
    if (!m[sp.ordre_id]) m[sp.ordre_id] = {}
    if (!m[sp.ordre_id][k] || sp.statut === 'Terminé') m[sp.ordre_id][k] = { statut: sp.statut }
  }
  return m
})

function classifOF(o) {
  if (/rejet/i.test(o.statut || '')) return 'rejete'
  const pl = phasesLot.value[o.id] || {}
  const p = o.produits || {}
  const gamme = (Array.isArray(p.gamme) && p.gamme.length) ? p.gamme : CANON_FAB
  const fabKeys = []; const seen = new Set()
  for (const ph of gamme) { const k = phaseKey(ph); if (k && k !== 'conditionnement' && !seen.has(k)) { seen.add(k); fabKeys.push(k) } }
  const fabDone = fabKeys.length > 0 && fabKeys.every(k => (pl[k] || {}).statut === 'Terminé')
  const fabStarted = fabKeys.some(k => { const st = (pl[k] || {}).statut; return st === 'Terminé' || st === 'En cours' })
  const condSt = (pl['conditionnement'] || {}).statut
  if (condSt === 'Terminé' || /lib[eé]r|termin/i.test(o.statut || '')) return 'termine'
  if (condSt === 'En cours') return 'encours'
  if (fabDone) return 'pret'
  if (fabStarted) return 'pipe'
  return 'planifie'
}

const parEquip = computed(() => {
  const m = {}
  const get = (id, nom) => { if (!m[id]) m[id] = { id, nom: nom || 'Équipement ' + id, encours: [], pret: [], pipe: [], planifie: [], planB: 0, planL: 0, realB: 0, realL: 0, planMB: 0, realMB: 0, planML: 0, realML: 0 }; return m[id] }
  for (const e of equipements.value) get(e.id, e.nom)
  const mA = moisAuj.value
  for (const o of ofsRaw.value) {
    if (!o.equipement_id) continue
    const g = m[o.equipement_id] || get(o.equipement_id, null)
    const cls = classifOF(o)
    if (cls === 'encours' || cls === 'pret' || cls === 'pipe' || cls === 'planifie') g[cls].push(o)
    const d = o.date_fin_fabrication
    if (d) { const dt = new Date(d); if (!isNaN(dt) && dt.getFullYear() === annee.value) { const b = num(o.boites_fabriquees) || num(o.quantite_theorique); g.realB += b; g.realL += 1; if (dt.getMonth() === mA) { g.realMB += b; g.realML += 1 } } }
  }
  for (const r of planRaw.value) {
    if (Number(r.annee) !== annee.value || !r.equipement_id) continue
    const g = m[r.equipement_id] || get(r.equipement_id, null)
    const b = num(r.quantite_planifiee), t = num(r.produits && r.produits.taille_lot), l = t > 0 ? b / t : 0
    g.planB += b; g.planL += l
    if ((Number(r.mois) || 1) - 1 === mA) { g.planMB += b; g.planML += l }
  }
  return Object.values(m)
    .map(g => ({ ...g, planL: Math.round(g.planL), planML: Math.round(g.planML) }))
    .filter(g => g.encours.length || g.pret.length || g.pipe.length || g.planifie.length || g.planB || g.realB)
    .sort((a, b) => b.realB - a.realB)
})
</script>

<style scoped>
.pe { padding: 24px 30px 50px; max-width: 1260px; margin: 0 auto; color: #1e293b; font-family: 'Segoe UI', system-ui, sans-serif; }
.pe-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
.pe-title { margin: 0; font-size: 24px; font-weight: 800; color: #0f172a; }
.pe-sub { margin: 4px 0 0; font-size: 13px; color: #64748b; }
.pe-year { display: flex; align-items: center; gap: 8px; }
.pe-year label { font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #94a3b8; }
.pe-year select { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 9px; font: inherit; font-size: 14px; font-weight: 600; }
.pe-empty { padding: 50px; text-align: center; color: #94a3b8; font-size: 14px; }

.pe-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 16px; }
.eq { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px 18px; box-shadow: 0 6px 18px rgba(30,41,59,.07); }
.eq-head { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.eq-badge { background: #0f172a; color: #fff; font-size: 13px; font-weight: 800; min-width: 34px; height: 26px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; padding: 0 8px; }
.eq-nom { font-size: 16px; font-weight: 800; color: #0f172a; }

.eq-now { background: #f8fafc; border-radius: 10px; padding: 10px 12px; margin-bottom: 12px; }
.now-lbl { font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #94a3b8; }
.now-lot { margin-top: 4px; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.now-num { font-family: ui-monospace, monospace; font-size: 15px; color: #0f172a; }
.now-prod { font-size: 12px; color: #64748b; }
.now-vide { margin-top: 4px; font-size: 12.5px; color: #cbd5e1; font-style: italic; }

.eq-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
.st { text-align: center; background: #f8fafc; border: 1px solid #eef2f7; border-radius: 9px; padding: 9px 6px; }
.st-n { display: block; font-size: 20px; font-weight: 800; color: #0f172a; }
.st-l { display: block; font-size: 10.5px; font-weight: 600; color: #64748b; margin-top: 1px; }
.st-b { display: block; font-size: 10px; color: #94a3b8; margin-top: 2px; }

.eq-prog { display: flex; flex-direction: column; gap: 12px; }
.pgroup { }
.pg-lbl { font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: .4px; margin-bottom: 5px; }
.pg-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.pg-m { font-size: 11px; color: #94a3b8; width: 38px; }
.pg-bar { flex: 1; height: 7px; background: #eef2f7; border-radius: 4px; overflow: hidden; }
.pg-bar span { display: block; height: 100%; border-radius: 4px; background: #6366f1; }
.pg-bar span.ok { background: #22c55e; } .pg-bar span.bas { background: #f59e0b; }
.pg-v { font-size: 11px; color: #64748b; white-space: nowrap; font-variant-numeric: tabular-nums; }
.pg-v b { color: #0f172a; font-weight: 800; }

@media (max-width: 720px) { .pe { padding: 16px; } .pe-grid { grid-template-columns: 1fr; } }
</style>
