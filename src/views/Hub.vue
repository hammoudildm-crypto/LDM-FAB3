<template>
  <div class="hub-root">
    <component :is="models[style]" />

    <div class="style-switch">
      <span class="ss-lbl">Style</span>
      <button v-for="s in styles" :key="s.k" class="ss-btn" :class="{ on: style === s.k }" @click="setStyle(s.k)">{{ s.label }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import HubConvoyeur from './Hub_Convoyeur.vue'
import HubGrille from './Hub_Grille.vue'
import HubFlux from './Hub_Flux.vue'
import HubMosaique from './Hub_Mosaique.vue'
import HubLateral from './Hub_Lateral.vue'
import HubHero from './Hub_Hero.vue'

const models = {
  convoyeur: HubConvoyeur,
  grille: HubGrille,
  flux: HubFlux,
  mosaique: HubMosaique,
  lateral: HubLateral,
  hero: HubHero
}
const styles = [
  { k: 'convoyeur', label: 'Convoyeur' },
  { k: 'grille', label: 'Grille' },
  { k: 'flux', label: 'Flux' },
  { k: 'mosaique', label: 'Mosaïque' },
  { k: 'lateral', label: 'Latéral' },
  { k: 'hero', label: 'Héro' }
]

const CLE = 'prodtrack_hub_style'
const saved = (() => { try { return localStorage.getItem(CLE) } catch (e) { return null } })()
const style = ref(saved && models[saved] ? saved : 'convoyeur')
function setStyle(k) {
  style.value = k
  try { localStorage.setItem(CLE, k) } catch (e) {}
}
</script>

<style scoped>
.hub-root { position: fixed; inset: 0; z-index: 60; }

.style-switch {
  position: fixed; z-index: 90; bottom: 16px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 4px;
  background: rgba(255, 255, 255, .92); backdrop-filter: blur(10px);
  border: 1px solid #e2e8f0; border-radius: 999px; padding: 5px 6px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, .22);
}
.ss-lbl { font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #94a3b8; padding: 0 8px 0 6px; }
.ss-btn { font: inherit; font-size: 12px; font-weight: 700; color: #64748b; background: none; border: 0; border-radius: 999px; padding: 7px 14px; cursor: pointer; transition: background .12s ease, color .12s ease; white-space: nowrap; }
.ss-btn:hover { color: #0f172a; background: #f1f5f9; }
.ss-btn.on { color: #fff; background: #5b9bd5; box-shadow: 0 2px 8px rgba(91, 155, 213, .4); }

@media (max-width: 760px) {
  .style-switch { flex-wrap: wrap; justify-content: center; width: calc(100% - 20px); border-radius: 16px; bottom: 10px; }
  .ss-lbl { width: 100%; text-align: center; padding: 2px 0 4px; }
}
</style>
