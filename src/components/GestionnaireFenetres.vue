<script setup>
import { computed } from 'vue'
import FenetreFlottante from './FenetreFlottante.vue'
import { useFenetres } from '../useFenetres'

const { fenetres, fermer, focus, reduire, restaurer, basculerAgrandie } = useFenetres()
const visibles = computed(() => fenetres.filter(f => !f.reduite))
function cliquerDock(f) { if (f.reduite) restaurer(f.id); else focus(f.id) }
</script>

<template>
  <div class="fen-layer">
    <FenetreFlottante
      v-for="f in visibles" :key="f.id" :f="f"
      @focus="focus(f.id)" @fermer="fermer(f.id)" @reduire="reduire(f.id)" @agrandir="basculerAgrandie(f.id)" />

    <div v-if="fenetres.length" class="fen-dock">
      <span class="fen-dock-lbl">Fenêtres</span>
      <button v-for="f in fenetres" :key="f.id" class="fen-dock-item" :class="{ reduite: f.reduite }" @click="cliquerDock(f)" :title="f.titre">
        <span class="fen-dock-dot" :style="{ background: f.couleur }"></span>
        <span class="fen-dock-nom">{{ f.titre }}</span>
        <span class="fen-dock-x" @click.stop="fermer(f.id)" title="Fermer">✕</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.fen-layer { position: fixed; inset: 0; z-index: 1000; pointer-events: none; }
.fen-layer :deep(.fen) { pointer-events: auto; }
.fen-dock { pointer-events: auto; position: fixed; left: 50%; transform: translateX(-50%); bottom: 10px; z-index: 9999; display: flex; align-items: center; gap: 7px; max-width: 94vw; overflow-x: auto; padding: 7px 11px; background: rgba(15,23,42,.92); backdrop-filter: blur(6px); border: 1px solid #334155; border-radius: 12px; box-shadow: 0 10px 30px rgba(2,8,23,.35); }
.fen-dock-lbl { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: #94a3b8; flex: none; padding-right: 2px; }
.fen-dock-item { display: inline-flex; align-items: center; gap: 7px; flex: none; max-width: 220px; background: #1e293b; color: #e2e8f0; border: 1px solid #3a475e; border-radius: 9px; padding: 5px 8px 5px 10px; font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; transition: background .14s; }
.fen-dock-item:hover { background: #2a3850; }
.fen-dock-item.reduite { opacity: .62; }
.fen-dock-dot { width: 9px; height: 9px; border-radius: 3px; flex: none; }
.fen-dock-nom { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fen-dock-x { font-size: 12px; color: #94a3b8; padding: 0 2px; border-radius: 4px; flex: none; }
.fen-dock-x:hover { background: #dc2626; color: #fff; }
</style>
