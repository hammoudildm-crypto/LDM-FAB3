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

    <section class="tpm-card">
      <div class="tpm-ch">Par équipement — {{ annee }}</div>
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
            <tr v-for="l in lignes" :key="l.id">
              <td class="tpm-eq">{{ l.nom }}</td>
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
const num = (v) => Number(v) || 0

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
    if (!g[id]) g[id] = { id, nom: (p.equipements && (p.equipements.code || p.equipements.nom)) || ('#' + id), ouv: 0, fonct: 0, maint: 0, panne: 0, evPanne: 0 }
    const o = g[id]
    const ouv = num(p.temps_ouverture_min)
    let arr = 0; for (const m of MOTIFS) arr += num(p[m])
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
.tpm-pct { font-weight: 800; }
.tpm-red { color: #b91c1c; font-weight: 700; }
.tpm-foot { margin-top: 16px; color: #94a3b8; font-size: 12px; }
@media (max-width: 860px) { .tpm-kpis { grid-template-columns: repeat(3, 1fr); } }
</style>
