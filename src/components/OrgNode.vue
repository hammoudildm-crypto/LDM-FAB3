<template>
  <li class="on-li">
    <div v-if="node.__phantom" class="on-spacer"></div>
    <div v-else class="on-card" :class="{ 'on-root': depth === 0 }" :style="{ '--c': couleur }" :title="node.note || ''">
      <div class="on-ava" :style="node.photo_url ? { backgroundImage: 'url(' + node.photo_url + ')' } : {}">
        <span v-if="!node.photo_url">{{ ini }}</span>
      </div>
      <div class="on-nom">{{ node.nom }}</div>
      <div class="on-fct" v-if="node.fonction">{{ node.fonction }}</div>
      <div class="on-meta" v-if="node.matricule || node.atelier_id || node.equipe">
        <span v-if="node.matricule">#{{ node.matricule }}</span>
        <span v-if="node.atelier_id"> · {{ node.atelier_id }}</span>
        <span v-if="node.equipe"> · Éq.{{ node.equipe }}</span>
      </div>
      <div class="on-tel" v-if="node.telephone">☎ {{ node.telephone }}</div>
      <div class="on-acts" v-if="peutEditer">
        <button @click="$emit('edit', node)" title="Modifier">✎</button>
        <button @click="$emit('del', node)" title="Supprimer">🗑</button>
      </div>
    </div>
    <ul v-if="enfants.length">
      <OrgNode v-for="c in enfants" :key="c.id" :node="c" :all="all" :ateliers="ateliers"
        :peutEditer="peutEditer" :depth="depth + 1" @edit="$emit('edit', $event)" @del="$emit('del', $event)" />
    </ul>
  </li>
</template>

<script setup>
defineOptions({ name: 'OrgNode' })
import { computed } from 'vue'
const props = defineProps({
  node: { type: Object, required: true },
  all: { type: Array, default: () => [] },
  ateliers: { type: Array, default: () => [] },
  peutEditer: { type: Boolean, default: false },
  depth: { type: Number, default: 0 }
})
defineEmits(['edit', 'del'])

const RANGS = ['Manager Fabrication', 'Responsable fabrication', 'Superviseur', 'Chef de ligne', 'Opérateur', "Agent d'hygiène"]
const COULEURS = {
  'manager fabrication': '#6366f1',
  'responsable fabrication': '#7c3aed',
  'superviseur': '#0d9488',
  'chef de ligne': '#0284c7',
  'opérateur': '#475569',
  "agent d'hygiène": '#d97706'
}
const norm = (t) => (t || '').toLowerCase().replace(/\s+/g, ' ').trim()
function rangDe(n) {
  const f = norm(n.fonction)
  const i = RANGS.findIndex(r => norm(r) === f)
  return i >= 0 ? i : RANGS.length
}
const rangsUtilises = computed(() => { const set = new Set(); for (const n of props.all) set.add(rangDe(n)); return set })
function wrap(child, parentRank) {
  const cRank = rangDe(child)
  const used = rangsUtilises.value
  const pr = []
  for (let r = parentRank + 1; r < cRank; r++) if (used.has(r)) pr.push(r)   // seulement les rangs occupés
  if (!pr.length) return child
  let node = child
  for (let i = pr.length - 1; i >= 0; i--) node = { __phantom: true, __rank: pr[i], __wrapped: node, id: 'ph-' + child.id + '-' + pr[i] }
  return node
}
const enfants = computed(() => {
  if (props.node.__phantom) return [props.node.__wrapped]
  const myRank = rangDe(props.node)
  const directs = props.all
    .filter(n => n.parent_id === props.node.id)
    .sort((a, b) => (a.ordre || 0) - (b.ordre || 0) || a.id - b.id)
  return directs.map(c => wrap(c, myRank))
})
const couleur = computed(() => COULEURS[norm(props.node.fonction)] || '#0f766e')
const ini = computed(() => (props.node.nom || '').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase())
</script>

<style scoped>
ul { padding-top: 26px; position: relative; display: flex; justify-content: center; list-style: none; margin: 0; }
.on-li { list-style: none; text-align: center; position: relative; padding: 26px 12px 0; }
.on-li::before, .on-li::after { content: ''; position: absolute; top: 0; right: 50%; border-top: 2px solid #d9e0e8; width: 50%; height: 26px; }
.on-li::after { right: auto; left: 50%; border-left: 2px solid #d9e0e8; }
.on-li:only-child::before, .on-li:only-child::after { display: none; }
.on-li:first-child::before, .on-li:last-child::after { border: 0 none; }
.on-li:last-child::before { border-right: 2px solid #d9e0e8; border-radius: 0 7px 0 0; }
.on-li:first-child::after { border-radius: 7px 0 0 0; }
ul ul::before { content: ''; position: absolute; top: 0; left: 50%; border-left: 2px solid #d9e0e8; width: 0; height: 26px; }

.on-card { display: inline-flex; flex-direction: column; align-items: center; justify-content: flex-start; position: relative; background: #fff; border: 1px solid #eef1f6; border-radius: 16px; padding: 16px 14px 12px; box-shadow: 0 8px 20px rgba(16,24,40,.08), 0 1px 3px rgba(16,24,40,.05); width: 172px; min-width: 172px; height: 124px; box-sizing: border-box; overflow: hidden; vertical-align: top; transition: transform .16s ease, box-shadow .16s ease; }
.on-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px; background: var(--c, #0f766e); }
.on-card:hover { transform: translateY(-3px); box-shadow: 0 16px 34px rgba(16,24,40,.15), 0 2px 6px rgba(16,24,40,.06); }
.on-card.on-root { box-shadow: 0 10px 26px rgba(99,102,241,.22), 0 2px 6px rgba(16,24,40,.06); }

.on-ava { width: 46px; height: 46px; border-radius: 50%; background: #f1f5f9; background-size: cover; background-position: center; margin: 3px auto 7px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; color: var(--c); box-shadow: 0 0 0 3px #fff, 0 0 0 5px var(--c); }
.on-nom { font-weight: 800; font-size: 13.5px; color: #0f172a; line-height: 1.15; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.on-fct { font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: var(--c); margin-top: 4px; }
.on-meta { font-size: 10px; color: #94a3b8; font-weight: 600; margin-top: 4px; max-width: 152px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.on-tel { font-size: 10px; color: #94a3b8; margin-top: 2px; }

.on-spacer { display: inline-block; width: 172px; height: 124px; vertical-align: top; position: relative; }
.on-spacer::after { content: ''; position: absolute; top: 0; bottom: 0; left: 50%; border-left: 2px dashed #d9e0e8; }

.on-acts { position: absolute; top: 7px; right: 7px; display: flex; gap: 3px; opacity: 0; transition: opacity .12s; }
.on-card:hover .on-acts { opacity: 1; }
.on-acts button { border: 1px solid #e2e8f0; background: #fff; border-radius: 6px; padding: 2px 5px; cursor: pointer; font-size: 11px; line-height: 1; }
.on-acts button:hover { background: #f8fafc; border-color: #cbd5e1; }
</style>
