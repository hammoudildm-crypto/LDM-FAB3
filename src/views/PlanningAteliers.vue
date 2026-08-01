<!--
  PlanningAteliers.vue — ProdTrack (LDM-FAB3)
  Vue parente : branche GanttAteliers.vue sur v_planning_ateliers.

  À placer dans src/views/ et à déclarer dans src/router/index.js :
    { path: '/planning-ateliers', name: 'PlanningAteliers',
      component: () => import('../views/PlanningAteliers.vue') }
-->

<template>
  <div class="planning-ateliers">
    <GanttAteliers ref="refGantt" :loader="chargerPlanning" @select-of="ouvrirOF" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import GanttAteliers from '../components/GanttAteliers.vue'
import { supabase } from '../supabase'   // ← adapter le chemin si besoin

const router = useRouter()
const refGantt = ref(null)

/* Pagination — remplacer par le helper du projet si sa signature diffère */
async function fetchAllPaged (table, colonnes, appliquer = q => q, taille = 1000) {
  const out = []
  let from = 0
  for (;;) {
    let q = supabase.from(table).select(colonnes).range(from, from + taille - 1)
    q = appliquer(q)
    const { data, error } = await q
    if (error) throw error
    if (!data || !data.length) break
    out.push(...data)
    if (data.length < taille) break
    from += taille
  }
  return out
}

/* Palette par type d'atelier — reprend le nuancier LDM */
const PALETTE = ['#2A4A85', '#3C63A8', '#5B9BD5', '#6FB1DE', '#1F7A6B', '#2E9C88',
                 '#B8860B', '#9C5A2E', '#C07A44', '#8E5BA8', '#7E8CA0']

async function chargerPlanning () {
  const [ateliersDb, segments] = await Promise.all([
    fetchAllPaged('ateliers', 'id, code, nom, type, actif',
                  q => q.eq('actif', true).order('code', { ascending: true })),
    fetchAllPaged('v_planning_ateliers',
                  'id, of_id, of_num, lot, produit, atelier_id, phase, phase_libelle, ' +
                  'debut, fin, statut, avancement, quantite, deviation',
                  q => q.order('debut', { ascending: true }))
  ])

  return {
    ateliers: ateliersDb.map((a, i) => ({
      id: a.id,
      code: a.code,
      nom: a.nom || a.code,
      couleur: PALETTE[i % PALETTE.length],
      capacite_h: 16
    })),
    ordres: segments.map(s => ({
      id: s.id,
      of_num: s.of_num,
      produit: s.phase === 'FAB' ? s.produit : `${s.produit} · ${s.phase_libelle}`,
      lot: s.lot,
      atelier_id: s.atelier_id,
      debut: s.debut,
      fin: s.fin,
      statut: s.statut,
      avancement: s.avancement,
      quantite: s.quantite
    }))
  }
}

function ouvrirOF (of) {
  router.push({ name: 'OrdresFabrication', query: { lot: of.lot } })
}
</script>

<style scoped>
.planning-ateliers { padding: 4px; }
</style>
