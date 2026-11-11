<script setup>
import { computed, provide } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({ f: { type: Object, required: true } })
const emit = defineEmits(['focus', 'fermer', 'reduire', 'agrandir'])
const router = useRouter()

// Les pages rendues dans une fenêtre n'affichent pas leurs propres boutons fenêtre.
provide('dansFenetreFlottante', true)

// Composant de la page correspondant au chemin (imports statiques → résolution synchrone).
const comp = computed(() => {
  try {
    const r = router.resolve(props.f.path)
    const m = r.matched[r.matched.length - 1]
    return m && m.components ? m.components.default : null
  } catch (e) { return null }
})

const style = computed(() => props.f.agrandie
  ? { left: '8px', top: '58px', width: 'calc(100vw - 16px)', height: 'calc(100vh - 110px)', zIndex: props.f.z }
  : { left: props.f.x + 'px', top: props.f.y + 'px', width: props.f.w + 'px', height: props.f.h + 'px', zIndex: props.f.z })

// --- Déplacement par la barre de titre ---
let drag = null
function onHeaderDown(e) {
  if (props.f.agrandie || e.target.closest('.fen-b')) return
  emit('focus')
  drag = { sx: e.clientX, sy: e.clientY, ox: props.f.x, oy: props.f.y }
  window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
}
function onMove(e) {
  if (!drag) return
  const vw = window.innerWidth, vh = window.innerHeight
  props.f.x = Math.min(Math.max(0, drag.ox + (e.clientX - drag.sx)), Math.max(0, vw - 140))
  props.f.y = Math.min(Math.max(0, drag.oy + (e.clientY - drag.sy)), Math.max(0, vh - 60))
}
function onUp() { drag = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }

// --- Redimensionnement par la poignée coin bas-droit ---
let rz = null
function onRzDown(e) {
  e.stopPropagation(); emit('focus')
  rz = { sx: e.clientX, sy: e.clientY, ow: props.f.w, oh: props.f.h }
  window.addEventListener('mousemove', onRz); window.addEventListener('mouseup', onRzUp)
}
function onRz(e) {
  if (!rz) return
  props.f.w = Math.max(380, rz.ow + (e.clientX - rz.sx))
  props.f.h = Math.max(240, rz.oh + (e.clientY - rz.sy))
}
function onRzUp() { rz = null; window.removeEventListener('mousemove', onRz); window.removeEventListener('mouseup', onRzUp) }
</script>

<template>
  <section class="fen" :class="{ agr: f.agrandie }" :style="style" @mousedown="emit('focus')">
    <header class="fen-bar" @mousedown="onHeaderDown" @dblclick="emit('agrandir')">
      <span class="fen-dot" :style="{ background: f.couleur }"></span>
      <span class="fen-titre">{{ f.titre }}</span>
      <div class="fen-btns">
        <button class="fen-b" @click="emit('reduire')" title="Réduire">−</button>
        <button class="fen-b" :class="{ on: f.agrandie }" @click="emit('agrandir')" title="Agrandir / restaurer">☐</button>
        <button class="fen-b fen-x" @click="emit('fermer')" title="Fermer">✕</button>
      </div>
    </header>
    <div class="fen-body">
      <component :is="comp" v-if="comp" />
      <p v-else class="fen-vide">Page introuvable.</p>
    </div>
    <span v-if="!f.agrandie" class="fen-rz" @mousedown="onRzDown" title="Redimensionner"></span>
  </section>
</template>

<style scoped>
.fen { position: fixed; display: flex; flex-direction: column; background: #fff; border: 1px solid #d6deea; border-radius: 12px; box-shadow: 0 20px 55px rgba(2,8,23,.30); overflow: hidden; min-width: 380px; min-height: 240px; }
.fen-bar { height: 40px; flex: none; display: flex; align-items: center; gap: 9px; padding: 0 8px 0 13px; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; cursor: move; user-select: none; }
.fen-dot { width: 11px; height: 11px; border-radius: 4px; flex: none; }
.fen-titre { flex: 1; min-width: 0; font-size: 13px; font-weight: 800; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fen-btns { display: flex; gap: 2px; flex: none; }
.fen-b { width: 30px; height: 27px; display: inline-flex; align-items: center; justify-content: center; background: transparent; color: #475569; border: 0; border-radius: 7px; cursor: pointer; font-size: 14px; line-height: 1; }
.fen-b:hover { background: #e2e8f0; color: #0f172a; }
.fen-b.on { background: #0f766e; color: #fff; }
.fen-x:hover { background: #dc2626; color: #fff; }
.fen-body { flex: 1; overflow: auto; background: #fff; padding: 12px 15px; zoom: 0.7; }
.fen-vide { color: #94a3b8; font-size: 14px; padding: 20px; }
.fen-rz { position: absolute; right: 2px; bottom: 2px; width: 16px; height: 16px; cursor: nwse-resize; background: linear-gradient(135deg, transparent 50%, #94a3b8 50%, #94a3b8 60%, transparent 60%, transparent 72%, #94a3b8 72%, #94a3b8 82%, transparent 82%); border-bottom-right-radius: 10px; }
html:is([data-theme="sombre"], [data-theme="minuit"]) .fen { background: #121a2b; border-color: #2a3650; }
html:is([data-theme="sombre"], [data-theme="minuit"]) .fen-bar { background: #0e1626; border-bottom-color: #2a3650; }
html:is([data-theme="sombre"], [data-theme="minuit"]) .fen-titre { color: #e6edf6; }
html:is([data-theme="sombre"], [data-theme="minuit"]) .fen-b { color: #c7d2e5; }
html:is([data-theme="sombre"], [data-theme="minuit"]) .fen-b:hover { background: #243049; color: #fff; }
html:is([data-theme="sombre"], [data-theme="minuit"]) .fen-body { background: #0e1420; }
</style>
