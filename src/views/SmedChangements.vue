<template>
  <div class="smed">
    <div class="sm-head">
      <div>
        <div class="sm-eyebrow">Lean · SMED (段取り替え)</div>
        <h1 class="sm-title">SMED — Changement de série</h1>
        <p class="sm-sub">Temps de changement (format + réglage) par équipement et par produit, pour les réduire. Issu des arrêts TRS.</p>
      </div>
      <select v-model.number="annee" class="sm-year">
        <option v-for="y in anneesDispo" :key="y" :value="y">{{ y }}</option>
      </select>
    </div>

    <p v-if="erreur" class="sm-alert">{{ erreur }}</p>
    <p v-if="!parEquip.length && !chargement" class="sm-empty">Aucun temps de format/réglage saisi en {{ annee }}.</p>

    <div class="sm-kpis">
      <div class="sm-kpi"><div class="sm-kv">{{ hm(tot.temps) }}</div><div class="sm-kl">Temps de changement (h)</div></div>
      <div class="sm-kpi"><div class="sm-kv">{{ tot.nb }}</div><div class="sm-kl">Changements</div></div>
      <div class="sm-kpi"><div class="sm-kv">{{ tot.nb ? Math.round(tot.temps / tot.nb) : 0 }} min</div><div class="sm-kl">Temps moyen / changement</div></div>
      <div class="sm-kpi"><div class="sm-kv">{{ tot.pct.toFixed(1) }} %</div><div class="sm-kl">du temps d'ouverture</div></div>
    </div>

    <section class="sm-card">
      <div class="sm-ch">Par équipement — {{ annee }}</div>
      <div class="sm-scroll">
        <table class="sm-tbl">
          <thead><tr><th>Équipement</th><th class="r">Changements</th><th class="r">Temps total (h)</th><th class="r">Moyen (min)</th><th class="r">Format (h)</th><th class="r">Réglage (h)</th><th class="r">% ouverture</th></tr></thead>
          <tbody>
            <tr v-for="l in parEquip" :key="l.id">
              <td class="sm-eq">{{ l.nom }}</td>
              <td class="r">{{ l.nb }}</td>
              <td class="r">{{ hm(l.temps) }}</td>
              <td class="r"><b :class="clsMoy(l.moy)">{{ Math.round(l.moy) }}</b></td>
              <td class="r">{{ hm(l.format) }}</td>
              <td class="r">{{ hm(l.reglage) }}</td>
              <td class="r">{{ l.pct.toFixed(1) }} %</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="sm-card">
      <div class="sm-ch">Par produit — temps moyen de changement (les plus longs d'abord)</div>
      <div class="sm-scroll">
        <table class="sm-tbl">
          <thead><tr><th>Produit</th><th class="r">Changements</th><th class="r">Temps total (h)</th><th class="r">Moyen (min)</th></tr></thead>
          <tbody>
            <tr v-for="l in parProduit" :key="l.id">
              <td><span class="sm-code">{{ l.code }}</span><span class="sm-des">{{ l.desig }}</span></td>
              <td class="r">{{ l.nb }}</td>
              <td class="r">{{ hm(l.temps) }}</td>
              <td class="r"><b :class="clsMoy(l.moy)">{{ Math.round(l.moy) }}</b></td>
            </tr>
            <tr v-if="!parProduit.length"><td colspan="4" class="sm-none">Aucun produit renseigné sur les changements.</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <p class="sm-foot">Un « changement » = une saisie poste/jour avec un temps de format ou de réglage &gt; 0. Objectif SMED : convertir les opérations internes (machine arrêtée) en externes (machine en marche) pour réduire ces temps.</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from '../supabase'

const postes = ref([])
const chargement = ref(true)
const erreur = ref('')
const annee = ref(new Date().getFullYear())
const num = (v) => Number(v) || 0

async function fetchAllPaged(make) {
  const size = 1000; let from = 0, all = []
  for (;;) { const r = await make().range(from, from + size - 1); if (r.error) return { error: r.error, data: all }; all = all.concat(r.data || []); if (!r.data || r.data.length < size) break; from += size }
  return { data: all, error: null }
}

async function charger() {
  chargement.value = true; erreur.value = ''
  const r = await fetchAllPaged(() => supabase.from('trs_postes').select('equipement_id, produit_id, date, temps_ouverture_min, arret_format_min, arret_reglage_min, equipements(code, nom), produits(code_pf, designation)').eq('actif', true))
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
const tempsChg = (p) => num(p.arret_format_min) + num(p.arret_reglage_min)

const parEquip = computed(() => {
  const g = {}
  for (const p of postesAnnee.value) {
    const id = p.equipement_id; if (id == null) continue
    if (!g[id]) g[id] = { id, nom: (p.equipements && (p.equipements.code || p.equipements.nom)) || ('#' + id), nb: 0, temps: 0, format: 0, reglage: 0, ouv: 0 }
    const o = g[id]; o.ouv += num(p.temps_ouverture_min)
    const t = tempsChg(p)
    if (t > 0) { o.nb++; o.temps += t; o.format += num(p.arret_format_min); o.reglage += num(p.arret_reglage_min) }
  }
  return Object.values(g).filter(o => o.nb > 0).map(o => { o.moy = o.nb ? o.temps / o.nb : 0; o.pct = o.ouv ? o.temps / o.ouv * 100 : 0; return o }).sort((a, b) => b.temps - a.temps)
})

const parProduit = computed(() => {
  const g = {}
  for (const p of postesAnnee.value) {
    const t = tempsChg(p); if (t <= 0) continue
    const id = p.produit_id; if (id == null) continue
    if (!g[id]) g[id] = { id, code: (p.produits && p.produits.code_pf) || ('#' + id), desig: (p.produits && p.produits.designation) || '', nb: 0, temps: 0 }
    g[id].nb++; g[id].temps += t
  }
  return Object.values(g).map(o => { o.moy = o.nb ? o.temps / o.nb : 0; return o }).sort((a, b) => b.moy - a.moy)
})

const tot = computed(() => {
  let temps = 0, nb = 0, ouv = 0
  for (const l of parEquip.value) { temps += l.temps; nb += l.nb; ouv += l.ouv }
  return { temps, nb, pct: ouv ? temps / ouv * 100 : 0 }
})

function hm(min) { const h = (Number(min) || 0) / 60; return h >= 100 ? Math.round(h).toLocaleString('fr-FR') : h.toFixed(1) }
function clsMoy(m) { return m >= 120 ? 'm-ko' : m >= 45 ? 'm-mid' : 'm-ok' }
</script>

<style scoped>
.smed { max-width: 1280px; margin: 0 auto; padding: 4px 2px 40px; }
.sm-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.sm-eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #0891b2; }
.sm-title { margin: 2px 0 2px; font-size: 24px; font-weight: 800; color: #0f172a; }
.sm-sub { margin: 0; color: #64748b; font-size: 13.5px; }
.sm-year { border: 1px solid #e2e8f0; background: #fff; border-radius: 9px; padding: 8px 12px; font: inherit; font-weight: 700; color: #334155; cursor: pointer; }
.sm-alert { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; border-radius: 8px; padding: 10px 14px; font-size: 13px; }
.sm-empty { text-align: center; color: #64748b; padding: 30px; }
.sm-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; }
.sm-kpi { border-radius: 12px; padding: 14px 16px; border: 1px solid #e2e8f0; background: #fff; }
.sm-kv { font-size: 24px; font-weight: 800; line-height: 1; color: #0f172a; }
.sm-kl { margin-top: 5px; font-size: 12px; color: #64748b; font-weight: 600; }
.sm-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; margin-bottom: 16px; }
.sm-ch { padding: 12px 16px; font-weight: 800; color: #0f172a; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
.sm-scroll { overflow-x: auto; }
.sm-tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.sm-tbl th, .sm-tbl td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; white-space: nowrap; }
.sm-tbl th { background: #f8fafc; font-weight: 700; color: #475569; text-align: left; font-size: 12px; }
.sm-tbl th.r, .sm-tbl td.r { text-align: right; font-variant-numeric: tabular-nums; }
.sm-eq { font-weight: 700; color: #0f172a; }
.sm-code { font-weight: 700; color: #0f172a; }
.sm-des { color: #64748b; margin-left: 8px; font-size: 12px; }
.m-ok { color: #047857; } .m-mid { color: #b45309; } .m-ko { color: #b91c1c; }
.sm-none { text-align: center; color: #94a3b8; padding: 16px; }
.sm-foot { margin-top: 6px; color: #94a3b8; font-size: 12px; }
@media (max-width: 760px) { .sm-kpis { grid-template-columns: repeat(2, 1fr); } }
</style>
