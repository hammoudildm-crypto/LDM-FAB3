<template>
  <div class="tpm">
    <div class="tpm-head">
      <div>
        <div class="tpm-eyebrow">Lean · TPM (全員参加の生産保全)</div>
        <h1 class="tpm-title">TPM — Maintenance des équipements</h1>
        <p class="tpm-sub">Fiabilité et disponibilité des machines, à partir des arrêts saisis dans le TRS.</p>
      </div>
      <select v-model.number="annee" class="tpm-year">
        <option v-for="y in anneesDispo" :key="y" :value="y">{{ y }}</option>
      </select>
    </div>

    <p v-if="erreur" class="tpm-alert">{{ erreur }}</p>
    <p v-if="!lignes.length && !chargement" class="tpm-empty">Aucune saisie TRS pour {{ annee }}.</p>

    <div class="tpm-kpis">
      <div class="tpm-kpi"><div class="tpm-kv">{{ hm(tot.maint) }}</div><div class="tpm-kl">Maintenance (h)</div></div>
      <div class="tpm-kpi" :class="{ rouge: tot.panne > 0 }"><div class="tpm-kv">{{ hm(tot.panne) }}</div><div class="tpm-kl">Pannes (h)</div></div>
      <div class="tpm-kpi"><div class="tpm-kv">{{ tot.evPanne }}</div><div class="tpm-kl">Événements panne</div></div>
      <div class="tpm-kpi"><div class="tpm-kv" :class="'t-' + clsDispo(tot.dispo)">{{ tot.dispo.toFixed(1) }} %</div><div class="tpm-kl">Disponibilité moyenne</div></div>
      <div class="tpm-kpi"><div class="tpm-kv">{{ tot.mtbf ? hm(tot.mtbf) : '—' }}</div><div class="tpm-kl">MTBF moyen (h)</div></div>
      <div class="tpm-kpi"><div class="tpm-kv">{{ tot.mttr ? hm(tot.mttr) : '—' }}</div><div class="tpm-kl">MTTR moyen (h)</div></div>
    </div>

    <div v-if="lignes.length" class="tpm-two">
      <section class="tpm-card">
        <div class="tpm-ch">Pareto des causes d'arrêt — {{ annee }}</div>
        <div class="tpm-pareto">
          <div v-if="!pareto.length" class="tpm-empty2">Aucun arrêt saisi.</div>
          <div v-for="x in pareto" :key="x.col" class="tpm-par-row">
            <span class="tpm-par-lbl">{{ x.label }}</span>
            <div class="tpm-par-bar"><div class="tpm-par-fill" :style="{ width: (paretoMax ? x.min / paretoMax * 100 : 0) + '%', background: x.color }"></div></div>
            <span class="tpm-par-val">{{ hm(x.min) }} h · {{ x.pct.toFixed(0) }}%<span class="tpm-par-cum"> · cumul {{ x.cumPct.toFixed(0) }}%</span></span>
          </div>
        </div>
      </section>
      <section class="tpm-card">
        <div class="tpm-ch">Disponibilité par mois — {{ annee }}</div>
        <div class="tpm-months">
          <div v-for="(m, i) in parMois" :key="i" class="tpm-mcol" :title="MOIS[i] + ' : dispo ' + m.dispo.toFixed(0) + '% · arrêts maint.+panne ' + m.mpH.toFixed(1) + ' h'">
            <div class="tpm-mbararea"><div class="tpm-mbar" :class="'b-' + clsDispo(m.dispo)" :style="{ height: (m.actif ? Math.max(3, Math.min(100, m.dispo)) : 0) + '%' }"></div></div>
            <div class="tpm-mdispo">{{ m.actif ? Math.round(m.dispo) : '' }}</div>
            <div class="tpm-mlabel">{{ MOIS[i] }}</div>
          </div>
        </div>
        <div class="tpm-mleg">Barres = disponibilité (%). Survol : arrêts maintenance + panne du mois.</div>
      </section>
    </div>

    <section class="tpm-card">
      <div class="tpm-ch">Par équipement — {{ annee }} <span class="tpm-ch-hint">(cliquer une ligne pour le détail des arrêts)</span></div>
      <div class="tpm-scroll">
        <table class="tpm-tbl">
          <thead>
            <tr>
              <th>Équipement</th>
              <th class="r">Ouverture (h)</th>
              <th class="r">Fonct. (h)</th>
              <th class="r">Dispo</th>
              <th class="r">Maint. (h)</th>
              <th class="r">% maint.</th>
              <th class="r">Pannes (h)</th>
              <th class="r">Nb pannes</th>
              <th class="r" title="Temps moyen de bon fonctionnement entre deux pannes">MTBF (h)</th>
              <th class="r" title="Temps moyen de réparation par panne">MTTR (h)</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="l in lignes" :key="l.id">
              <tr class="tpm-row" :class="{ open: ouvertId === l.id }" @click="toggle(l.id)">
                <td class="tpm-eq"><span class="tpm-caret">{{ ouvertId === l.id ? '▾' : '▸' }}</span> {{ l.nom || l.code || ('#' + l.id) }}<span v-if="l.code && l.nom" class="tpm-code">{{ l.code }}</span></td>
                <td class="r">{{ hm(l.ouv) }}</td>
                <td class="r">{{ hm(l.fonct) }}</td>
                <td class="r"><span class="tpm-pct" :class="'t-' + clsDispo(l.dispo)">{{ l.dispo.toFixed(1) }} %</span></td>
                <td class="r">{{ hm(l.maint) }}</td>
                <td class="r">{{ l.pctMaint.toFixed(1) }} %</td>
                <td class="r" :class="{ 'tpm-red': l.panne > 0 }">{{ hm(l.panne) }}</td>
                <td class="r">{{ l.evPanne || '—' }}</td>
                <td class="r">{{ l.mtbf ? hm(l.mtbf) : '—' }}</td>
                <td class="r">{{ l.mttr ? hm(l.mttr) : '—' }}</td>
              </tr>
              <tr v-if="ouvertId === l.id" class="tpm-detail">
                <td :colspan="10">
                  <div class="tpm-det-head">Répartition des arrêts — {{ l.nom || l.code }}<span v-if="l.code && l.nom"> ({{ l.code }})</span></div>
                  <div v-for="d in detailMotifs(l)" :key="d.label" class="tpm-par-row">
                    <span class="tpm-par-lbl">{{ d.label }}</span>
                    <div class="tpm-par-bar"><div class="tpm-par-fill" :style="{ width: d.pct + '%', background: d.color }"></div></div>
                    <span class="tpm-par-val">{{ hm(d.min) }} h · {{ d.pct.toFixed(0) }}%</span>
                  </div>
                  <div v-if="!detailMotifs(l).length" class="tpm-empty2">Aucun arrêt pour cet équipement.</div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </section>

    <p class="tpm-foot">MTBF ≈ temps de fonctionnement ÷ nombre d'événements de panne ; MTTR ≈ temps de panne ÷ nombre d'événements. Un « événement de panne » = une saisie poste/jour avec un temps de panne &gt; 0 (estimation, le TRS est saisi au jour/poste). Objectif TPM : réduire pannes et maintenance subie, augmenter la disponibilité.</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from '../supabase'

const postes = ref([])
const chargement = ref(true)
const erreur = ref('')
const annee = ref(new Date().getFullYear())

const MOTIFS = ['arret_panne_min', 'arret_format_min', 'arret_nettoyage_min', 'arret_reglage_min', 'arret_maintenance_min', 'arret_attente_min', 'arret_autre_min']
const MOTIFS_INFO = [
  ['arret_panne_min', 'Panne', '#ef4444'],
  ['arret_maintenance_min', 'Maintenance', '#6366f1'],
  ['arret_format_min', 'Changement format', '#f59e0b'],
  ['arret_reglage_min', 'Réglage', '#8b5cf6'],
  ['arret_nettoyage_min', 'Nettoyage', '#0d9488'],
  ['arret_attente_min', 'Attente', '#94a3b8'],
  ['arret_autre_min', 'Autre', '#cbd5e1']
]
const MOTIF_LBL = Object.fromEntries(MOTIFS_INFO.map(m => [m[0], m[1]]))
const MOTIF_COL = Object.fromEntries(MOTIFS_INFO.map(m => [m[0], m[2]]))
const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
const num = (v) => Number(v) || 0
const ouvertId = ref(null)

async function fetchAllPaged(make) {
  const size = 1000; let from = 0, all = []
  for (;;) { const r = await make().range(from, from + size - 1); if (r.error) return { error: r.error, data: all }; all = all.concat(r.data || []); if (!r.data || r.data.length < size) break; from += size }
  return { data: all, error: null }
}

async function charger() {
  chargement.value = true; erreur.value = ''
  const r = await fetchAllPaged(() => supabase.from('trs_postes').select('equipement_id, date, temps_ouverture_min, arret_panne_min, arret_format_min, arret_nettoyage_min, arret_reglage_min, arret_maintenance_min, arret_attente_min, arret_autre_min, equipements(code, nom)').eq('actif', true))
  if (r.error) { erreur.value = r.error.message; chargement.value = false; return }
  postes.value = r.data || []
  chargement.value = false
}
onMounted(charger)

const anneesDispo = computed(() => {
  const s = new Set()
  for (const p of postes.value) { const y = p.date ? new Date(p.date).getFullYear() : null; if (y) s.add(y) }
  s.add(new Date().getFullYear())
  return [...s].sort((a, b) => b - a)
})
watch(anneesDispo, (ys) => { if (ys.length && !ys.includes(annee.value)) annee.value = ys[0] })

const postesAnnee = computed(() => postes.value.filter(p => p.date && new Date(p.date).getFullYear() === annee.value))

const lignes = computed(() => {
  const g = {}
  for (const p of postesAnnee.value) {
    const id = p.equipement_id; if (id == null) continue
    if (!g[id]) g[id] = { id, code: (p.equipements && p.equipements.code) || '', nom: (p.equipements && p.equipements.nom) || '', ouv: 0, fonct: 0, maint: 0, panne: 0, evPanne: 0, motifs: Object.fromEntries(MOTIFS.map(m => [m, 0])) }
    const o = g[id]
    const ouv = num(p.temps_ouverture_min)
    let arr = 0; for (const m of MOTIFS) { const v = num(p[m]); arr += v; o.motifs[m] += v }
    o.ouv += ouv
    o.fonct += Math.max(0, ouv - arr)
    o.maint += num(p.arret_maintenance_min)
    o.panne += num(p.arret_panne_min)
    if (num(p.arret_panne_min) > 0) o.evPanne++
  }
  const out = Object.values(g).map(o => {
    o.dispo = o.ouv ? o.fonct / o.ouv * 100 : 0
    o.pctMaint = o.ouv ? o.maint / o.ouv * 100 : 0
    o.mtbf = o.evPanne ? o.fonct / o.evPanne : 0
    o.mttr = o.evPanne ? o.panne / o.evPanne : 0
    return o
  })
  return out.sort((a, b) => (b.panne + b.maint) - (a.panne + a.maint))
})

// Pareto des causes d'arrêt (tous motifs, pour prioriser)
const pareto = computed(() => {
  const m = {}; for (const [col] of MOTIFS_INFO) m[col] = 0
  for (const p of postesAnnee.value) for (const [col] of MOTIFS_INFO) m[col] += num(p[col])
  const tot = Object.values(m).reduce((a, b) => a + b, 0)
  let cum = 0
  return MOTIFS_INFO.map(([col, label, color]) => ({ col, label, color, min: m[col] })).filter(x => x.min > 0).sort((a, b) => b.min - a.min).map(x => { cum += x.min; return { ...x, pct: tot ? x.min / tot * 100 : 0, cumPct: tot ? cum / tot * 100 : 0 } })
})
const paretoMax = computed(() => pareto.value.reduce((mx, x) => Math.max(mx, x.min), 0))

// Évolution mensuelle (disponibilité + arrêts maintenance/panne)
const parMois = computed(() => {
  const a = Array.from({ length: 12 }, () => ({ ouv: 0, fonct: 0, mp: 0 }))
  for (const p of postesAnnee.value) {
    const d = new Date(p.date); if (isNaN(d.getTime())) continue
    const mo = d.getMonth()
    const ouv = num(p.temps_ouverture_min); let arr = 0; for (const m of MOTIFS) arr += num(p[m])
    a[mo].ouv += ouv; a[mo].fonct += Math.max(0, ouv - arr); a[mo].mp += num(p.arret_maintenance_min) + num(p.arret_panne_min)
  }
  return a.map(x => ({ dispo: x.ouv ? x.fonct / x.ouv * 100 : 0, mpH: x.mp / 60, actif: x.ouv > 0 }))
})
const mpMoisMax = computed(() => parMois.value.reduce((mx, x) => Math.max(mx, x.mpH), 0))

function detailMotifs(l) {
  const tot = MOTIFS.reduce((s, m) => s + l.motifs[m], 0)
  return MOTIFS_INFO.map(([col, label, color]) => ({ label, color, min: l.motifs[col], pct: tot ? l.motifs[col] / tot * 100 : 0 })).filter(x => x.min > 0).sort((a, b) => b.min - a.min)
}
function toggle(id) { ouvertId.value = ouvertId.value === id ? null : id }

const tot = computed(() => {
  let maint = 0, panne = 0, evPanne = 0, ouv = 0, fonct = 0
  for (const l of lignes.value) { maint += l.maint; panne += l.panne; evPanne += l.evPanne; ouv += l.ouv; fonct += l.fonct }
  return { maint, panne, evPanne, dispo: ouv ? fonct / ouv * 100 : 0, mtbf: evPanne ? fonct / evPanne : 0, mttr: evPanne ? panne / evPanne : 0 }
})

function hm(min) { const h = (Number(min) || 0) / 60; return h >= 100 ? Math.round(h).toLocaleString('fr-FR') : h.toFixed(1) }
function clsDispo(d) { return d >= 90 ? 'ok' : d >= 75 ? 'mid' : 'ko' }
</script>

<style scoped>
.tpm { max-width: 1280px; margin: 0 auto; padding: 4px 2px 40px; }
.tpm-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.tpm-eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #6366f1; }
.tpm-title { margin: 2px 0 2px; font-size: 24px; font-weight: 800; color: #0f172a; }
.tpm-sub { margin: 0; color: #64748b; font-size: 13.5px; }
.tpm-year { border: 1px solid #e2e8f0; background: #fff; border-radius: 9px; padding: 8px 12px; font: inherit; font-weight: 700; color: #334155; cursor: pointer; }
.tpm-alert { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; border-radius: 8px; padding: 10px 14px; font-size: 13px; }
.tpm-empty { text-align: center; color: #64748b; padding: 30px; }
.tpm-kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-bottom: 18px; }
.tpm-kpi { border-radius: 12px; padding: 13px 14px; border: 1px solid #e2e8f0; background: #fff; }
.tpm-kpi.rouge { background: #fef2f2; border-color: #fecaca; }
.tpm-kv { font-size: 22px; font-weight: 800; line-height: 1; color: #0f172a; }
.tpm-kl { margin-top: 5px; font-size: 11.5px; color: #64748b; font-weight: 600; }
.t-ok { color: #047857; } .t-mid { color: #b45309; } .t-ko { color: #b91c1c; }
.tpm-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; }
.tpm-ch { padding: 12px 16px; font-weight: 800; color: #0f172a; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
.tpm-scroll { overflow-x: auto; }
.tpm-tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.tpm-tbl th, .tpm-tbl td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; white-space: nowrap; }
.tpm-tbl th { background: #f8fafc; font-weight: 700; color: #475569; text-align: left; font-size: 12px; }
.tpm-tbl th.r, .tpm-tbl td.r { text-align: right; font-variant-numeric: tabular-nums; }
.tpm-eq { font-weight: 700; color: #0f172a; }
.tpm-code { display: inline-block; margin-left: 7px; padding: 1px 7px; border-radius: 999px; background: #eef2f7; color: #64748b; font-size: 10.5px; font-weight: 700; letter-spacing: .02em; vertical-align: middle; }
.tpm-pct { font-weight: 800; }
.tpm-red { color: #b91c1c; font-weight: 700; }
.tpm-foot { margin-top: 16px; color: #94a3b8; font-size: 12px; }
.tpm-two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
.tpm-ch-hint { font-weight: 500; color: #94a3b8; font-size: 12px; }
.tpm-empty2 { color: #94a3b8; font-size: 12.5px; padding: 8px 0; }
.tpm-pareto { padding: 12px 16px; }
.tpm-par-row { display: flex; align-items: center; gap: 10px; padding: 5px 0; }
.tpm-par-lbl { width: 120px; flex: none; font-size: 12.5px; color: #334155; font-weight: 600; }
.tpm-par-bar { flex: 1; height: 14px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
.tpm-par-fill { height: 100%; border-radius: 4px; min-width: 2px; }
.tpm-par-val { width: 150px; flex: none; text-align: right; font-size: 11.5px; color: #475569; font-variant-numeric: tabular-nums; }
.tpm-par-cum { color: #94a3b8; }
.tpm-months { display: flex; align-items: flex-end; gap: 4px; padding: 14px 16px 6px; height: 150px; }
.tpm-mcol { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
.tpm-mbararea { flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; }
.tpm-mbar { width: 70%; border-radius: 4px 4px 0 0; min-height: 2px; transition: height .3s; }
.b-ok { background: #10b981; } .b-mid { background: #f59e0b; } .b-ko { background: #ef4444; }
.tpm-mdispo { font-size: 10px; color: #64748b; font-weight: 700; margin-top: 3px; height: 13px; }
.tpm-mlabel { font-size: 10px; color: #94a3b8; margin-top: 2px; }
.tpm-mleg { padding: 0 16px 12px; color: #94a3b8; font-size: 11.5px; }
.tpm-row { cursor: pointer; }
.tpm-row:hover { background: #f8fafc; }
.tpm-row.open { background: #eef2ff; }
.tpm-caret { color: #94a3b8; font-size: 10px; margin-right: 2px; }
.tpm-detail td { background: #f8fafc; padding: 12px 16px; }
.tpm-det-head { font-weight: 700; color: #0f172a; font-size: 13px; margin-bottom: 8px; }
@media (max-width: 860px) { .tpm-two { grid-template-columns: 1fr; } }
@media (max-width: 860px) { .tpm-kpis { grid-template-columns: repeat(3, 1fr); } }
</style>
