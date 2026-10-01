<template>
  <li class="on-li">
    <div class="on-card" :class="{ 'on-root': depth === 0 }">
      <div class="on-ava" :style="node.photo_url ? { backgroundImage: 'url(' + node.photo_url + ')' } : {}">
        <span v-if="!node.photo_url">{{ ini }}</span>
      </div>
      <div class="on-nom">{{ node.nom }}</div>
      <div class="on-fct" v-if="node.fonction">{{ node.fonction }}</div>
      <div class="on-meta">
        <span v-if="node.matricule">#{{ node.matricule }}</span>
        <span v-if="node.atelier_id"> · {{ node.atelier_id }}</span>
        <span v-if="node.equipe"> · Éq.{{ node.equipe }}</span>
      </div>
      <div class="on-tel" v-if="node.telephone">☎ {{ node.telephone }}</div>
      <div class="on-note" v-if="node.note">{{ node.note }}</div>
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
const enfants = computed(() => props.all
  .filter(n => n.parent_id === props.node.id)
  .sort((a, b) => (a.ordre || 0) - (b.ordre || 0) || a.id - b.id))
const ini = computed(() => (props.node.nom || '').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase())
function ac(id) { const a = props.ateliers.find(x => String(x.id) === String(id)); return a ? a.code : '' }
</script>

<style scoped>
ul { padding-top: 22px; position: relative; display: flex; justify-content: center; list-style: none; margin: 0; }
.on-li { list-style: none; text-align: center; position: relative; padding: 22px 10px 0; }
/* lignes de liaison (organigramme classique) */
.on-li::before, .on-li::after { content: ''; position: absolute; top: 0; right: 50%; border-top: 2px solid #cbd5e1; width: 50%; height: 22px; }
.on-li::after { right: auto; left: 50%; border-left: 2px solid #cbd5e1; }
.on-li:only-child::before, .on-li:only-child::after { display: none; }
.on-li:first-child::before, .on-li:last-child::after { border: 0 none; }
.on-li:last-child::before { border-right: 2px solid #cbd5e1; }
ul ul::before { content: ''; position: absolute; top: 0; left: 50%; border-left: 2px solid #cbd5e1; width: 0; height: 22px; }
/* carte */
.on-card { display: inline-flex; flex-direction: column; justify-content: center; position: relative; background: linear-gradient(158deg, #ffffff, #f8fafc); border: 1px solid #e2e8f0; border-top: 3px solid #0f766e; border-radius: 12px; padding: 10px 16px; box-shadow: 0 4px 12px rgba(16,24,40,.08); min-width: 160px; width: 160px; height: 104px; box-sizing: border-box; overflow: hidden; vertical-align: top; }
.on-card.on-root { border-top-color: #4f46e5; }
.on-ava { width: 38px; height: 38px; border-radius: 50%; background: #e0e7ff; background-size: cover; background-position: center; margin: 0 auto 5px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; color: #4f46e5; }
.on-nom { font-weight: 800; font-size: 14px; color: #0f172a; }
.on-fct { font-size: 11.5px; color: #0f766e; font-weight: 700; margin-top: 1px; }
.on-meta { font-size: 10.5px; color: #64748b; font-weight: 600; margin-top: 3px; }
.on-tel { font-size: 10.5px; color: #94a3b8; margin-top: 2px; }
.on-note { font-size: 10px; color: #b0b8c4; margin-top: 2px; font-style: italic; }
.on-acts { position: absolute; top: 6px; right: 6px; display: flex; gap: 3px; opacity: 0; transition: opacity .12s; }
.on-card:hover .on-acts { opacity: 1; }
.on-acts button { border: 1px solid #e2e8f0; background: #fff; border-radius: 6px; padding: 2px 5px; cursor: pointer; font-size: 11px; line-height: 1; }
.on-acts button:hover { background: #f0fdfa; border-color: #99f6e4; }
</style>
