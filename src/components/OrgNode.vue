<template>
  <li class="on-li">
    <div class="on-card" :class="{ 'on-root': depth === 0 }" :style="{ '--c': couleur }" :title="node.note || ''">
      <div class="on-ava" :style="node.photo_url ? { backgroundImage: 'url(' + node.photo_url + ')' } : {}">
        <span v-if="!node.photo_url">{{ ini }}</span>
      </div>
      <div class="on-nom">{{ node.nom }}</div>
      <div class="on-fct" v-if="node.fonction">{{ node.fonction }}</div>
      <div class="on-meta" v-if="node.matricule || node.atelier_id || node.equipe || node.equipement">
        <span v-if="node.matricule">#{{ node.matricule }}</span>
        <span v-if="node.atelier_id"> · {{ node.atelier_id }}</span>
        <span v-if="node.equipe"> · Éq.{{ node.equipe }}</span>
        <span v-if="node.equipement"> · {{ node.equipement }}</span>
      </div>
      <div class="on-tel" v-if="node.telephone">☎ {{ node.telephone }}</div>
      <button v-if="enfants.length" class="on-fold" :class="{ plie: estPlie }" @click.stop="basculer" :title="estPlie ? 'Déplier' : 'Replier'">
        <span class="on-caret">{{ estPlie ? '▸' : '▾' }}</span> 👥 {{ nbDesc }}
      </button>
      <div class="on-acts" v-if="peutEditer">
        <button @click.stop="$emit('edit', node)" title="Modifier">✎</button>
        <button @click.stop="$emit('del', node)" title="Supprimer">🗑</button>
      </div>
    </div>
    <ul v-if="enfants.length && !estPlie">
      <OrgNode v-for="c in enfants" :key="c.id" :node="c" :all="all" :ateliers="ateliers"
        :peutEditer="peutEditer" :depth="depth + 1" @edit="$emit('edit', $event)" @del="$emit('del', $event)" />
    </ul>
  </li>
</template>

<script setup>
defineOptions({ name: 'OrgNode' })
import { computed, inject } from 'vue'
const props = defineProps({
  node: { type: Object, required: true },
  all: { type: Array, default: () => [] },
  ateliers: { type: Array, default: () => [] },
  peutEditer: { type: Boolean, default: false },
  depth: { type: Number, default: 0 }
})
defineEmits(['edit', 'del'])

const orgUI = inject('orgUI', { collapsed: new Set(), toggle: () => {} })
const estPlie = computed(() => orgUI.collapsed.has(props.node.id))
function basculer() { orgUI.toggle(props.node.id) }

const COULEURS = {
  'manager': '#6366f1',
  'responsable': '#7c3aed',
  'superviseur': '#0d9488',
  'chef de ligne': '#0284c7',
  'operateur': '#475569',
  "agent d'hygiene": '#d97706'
}
const norm = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\u2019\u02bc']/g, "'").replace(/\s+/g, ' ').trim().replace(/ fabrication$/, '')
const enfants = computed(() => props.all
  .filter(n => n.parent_id === props.node.id)
  .sort((a, b) => (a.ordre || 0) - (b.ordre || 0) || a.id - b.id))
function compterDesc(id) {
  let n = 0
  for (const k of props.all.filter(x => x.parent_id === id)) n += 1 + compterDesc(k.id)
  return n
}
const nbDesc = computed(() => compterDesc(props.node.id))
const couleur = computed(() => COULEURS[norm(props.node.fonction)] || '#0f766e')
const ini = computed(() => (props.node.nom || '').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase())
</script>

<style scoped>
ul { padding-top: 24px; position: relative; display: flex; justify-content: center; list-style: none; margin: 0; }
.on-li { list-style: none; text-align: center; position: relative; padding: 24px 10px 0; }
.on-li::before, .on-li::after { content: ''; position: absolute; top: 0; right: 50%; border-top: 2px solid #d9e0e8; width: 50%; height: 24px; }
.on-li::after { right: auto; left: 50%; border-left: 2px solid #d9e0e8; }
.on-li:only-child::before, .on-li:only-child::after { display: none; }
.on-li:first-child::before, .on-li:last-child::after { border: 0 none; }
.on-li:last-child::before { border-right: 2px solid #d9e0e8; border-radius: 0 7px 0 0; }
.on-li:first-child::after { border-radius: 7px 0 0 0; }
ul ul::before { content: ''; position: absolute; top: 0; left: 50%; border-left: 2px solid #d9e0e8; width: 0; height: 24px; }

.on-card { display: inline-flex; flex-direction: column; align-items: center; justify-content: flex-start; position: relative; background: #fff; border: 1px solid #eef1f6; border-radius: 14px; padding: 10px 12px 22px; box-shadow: 0 6px 16px rgba(16,24,40,.08), 0 1px 3px rgba(16,24,40,.05); width: 152px; min-width: 152px; height: 120px; box-sizing: border-box; overflow: hidden; vertical-align: top; transition: transform .16s ease, box-shadow .16s ease; }
.on-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px; background: var(--c, #0f766e); }
.on-card:hover { transform: translateY(-3px); box-shadow: 0 14px 30px rgba(16,24,40,.15), 0 2px 6px rgba(16,24,40,.06); }
.on-card.on-root { box-shadow: 0 10px 26px rgba(99,102,241,.22), 0 2px 6px rgba(16,24,40,.06); }

.on-ava { width: 38px; height: 38px; border-radius: 50%; background: #f1f5f9; background-size: cover; background-position: center; margin: 2px auto 5px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; color: var(--c); box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--c); }
.on-nom { font-weight: 800; font-size: 12.5px; color: #0f172a; line-height: 1.12; max-width: 134px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.on-fct { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; color: var(--c); margin-top: 3px; }
.on-meta { font-size: 9.5px; color: #94a3b8; font-weight: 600; margin-top: 3px; max-width: 136px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.on-tel { font-size: 9.5px; color: #94a3b8; margin-top: 2px; }

.on-fold { position: absolute; bottom: 5px; left: 50%; transform: translateX(-50%); border: 1px solid #e2e8f0; background: #f8fafc; color: #475569; border-radius: 999px; padding: 1px 9px; font-size: 10px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; transition: background .12s, border-color .12s, color .12s; }
.on-fold:hover { background: #eef2ff; border-color: #c7d2fe; color: #4338ca; }
.on-fold.plie { background: var(--c); border-color: var(--c); color: #fff; }
.on-caret { font-size: 9px; line-height: 1; }

.on-acts { position: absolute; top: 6px; right: 6px; display: flex; gap: 3px; opacity: 0; transition: opacity .12s; }
.on-card:hover .on-acts { opacity: 1; }
.on-acts button { border: 1px solid #e2e8f0; background: #fff; border-radius: 6px; padding: 2px 5px; cursor: pointer; font-size: 11px; line-height: 1; }
.on-acts button:hover { background: #f8fafc; border-color: #cbd5e1; }
</style>
