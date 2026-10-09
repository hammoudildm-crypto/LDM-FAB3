<script setup>
import { ref, reactive, computed, onMounted, provide, watch } from 'vue'
import { supabase } from '../supabase'
import OrgNode from '../components/OrgNode.vue'
import PageHeader from '../components/PageHeader.vue'

const PERIMETRES = ['Fabrication forme sèche', 'Fabrication forme semi solide', 'Fabrication forme sèche hormonale', 'Partie premix', 'Partie vrac']
const normOrg = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\u2019\u02bc']/g, "'").replace(/\s+/g, ' ').trim().replace(/ fabrication$/, '')

const erreur = ref('')
const orgNodes = ref([])
const orgPerimFiltre = ref('')
const orgCollapsed = reactive(new Set())
function orgToggle(id) { if (orgCollapsed.has(id)) orgCollapsed.delete(id); else orgCollapsed.add(id) }
provide('orgUI', { collapsed: orgCollapsed, toggle: orgToggle })

const orgFlat = computed(() => {
  const byParent = {}
  for (const n of orgNodes.value) { const k = n.parent_id || 'root'; (byParent[k] = byParent[k] || []).push(n) }
  for (const k in byParent) byParent[k].sort((a, b) => (a.ordre || 0) - (b.ordre || 0) || a.id - b.id)
  const out = []
  function walk(key, depth) { for (const n of (byParent[key] || [])) { out.push({ ...n, depth }); walk(n.id, depth + 1) } }
  walk('root', 0)
  return out
})
const estParti = (n) => { if (!n.date_sortie) return false; const dt = new Date(n.date_sortie); return !isNaN(dt) && dt <= new Date() }
const orgPerimRaw = computed(() => {
  const base = orgNodes.value
  if (!orgPerimFiltre.value) return base
  const byId = {}; for (const n of base) byId[n.id] = n
  const keep = new Set()
  for (const n of base) {
    if (normOrg(n.atelier_id) === normOrg(orgPerimFiltre.value)) {
      keep.add(n.id)
      let pp = n.parent_id
      while (pp && byId[pp]) { keep.add(pp); pp = byId[pp].parent_id }
    }
  }
  return base.filter(n => keep.has(n.id))
})
const orgNodesAffiches = computed(() => orgPerimRaw.value.filter(n => !estParti(n)))
const orgRacinesAffichees = computed(() => orgNodesAffiches.value
  .filter(n => !n.parent_id || !orgNodesAffiches.value.some(x => x.id === n.parent_id))
  .sort((a, b) => (a.ordre || 0) - (b.ordre || 0) || a.id - b.id))

let orgInit = false
watch(orgNodes, () => {
  if (orgInit || !orgNodes.value.length) return
  orgInit = true
  for (const n of orgFlat.value) { if (n.depth >= 2 && orgNodes.value.some(x => x.parent_id === n.id)) orgCollapsed.add(n.id) }
})

async function charger() {
  erreur.value = ''
  const ro = await supabase.from('organigramme').select('*').eq('actif', true).order('ordre')
  if (ro.error) erreur.value = ro.error.message; else orgNodes.value = ro.data || []
}
onMounted(charger)
</script>

<template>
  <div class="org-page">
    <PageHeader title="Organigramme" tone="teal" subtitle="Schéma hiérarchique du personnel." />
    <p v-if="erreur" class="alert">{{ erreur }}</p>
    <section class="card">
      <div class="org-toolbar">
        <select v-model="orgPerimFiltre" class="org-filtre"><option value="">Tous les périmètres</option><option v-for="pe in PERIMETRES" :key="pe" :value="pe">{{ pe }}</option></select>
        <div class="org-legende">
          <span class="lg-item"><i style="background:#6366f1"></i>Manager</span>
          <span class="lg-item"><i style="background:#7c3aed"></i>Responsable</span>
          <span class="lg-item"><i style="background:#0d9488"></i>Superviseur</span>
          <span class="lg-item"><i style="background:#0284c7"></i>Chef de ligne</span>
          <span class="lg-item"><i style="background:#475569"></i>Opérateur</span>
          <span class="lg-item"><i style="background:#d97706"></i>Agent d'hygiène</span>
        </div>
      </div>
      <div v-if="!orgRacinesAffichees.length" class="empty-card">Aucun poste à afficher. Ajoute ou importe du personnel depuis la page <strong>Effectifs</strong>.</div>
      <div v-else class="org-chart">
        <ul class="org-root">
          <OrgNode v-for="n in orgRacinesAffichees" :key="n.id" :node="n" :all="orgNodesAffiches" :ateliers="[]" :peutEditer="false" :depth="0" />
        </ul>
      </div>
    </section>
  </div>
</template>

<style scoped>
.org-page { color: #1b2733; }
.alert { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 10px; padding: 10px 14px; font-size: 14px; margin-bottom: 14px; }
.card { background: #fff; border: 1px solid #eef1f6; border-radius: 16px; padding: 20px; box-shadow: 0 1px 3px rgba(16,24,40,.04); }
.org-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; }
.org-filtre { padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; color: #1b2733; font-weight: 600; }
.org-legende { display: flex; flex-wrap: wrap; gap: 10px; }
.lg-item { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; color: #475569; }
.lg-item i { width: 11px; height: 11px; border-radius: 3px; display: inline-block; }
.empty-card { background: #fff; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 28px; color: #475569; text-align: center; font-size: 15px; }
.org-chart { overflow-x: auto; padding: 12px 0 4px; zoom: 0.6; }
.org-root { display: flex; justify-content: center; list-style: none; padding: 0; margin: 0; min-width: min-content; }
</style>
