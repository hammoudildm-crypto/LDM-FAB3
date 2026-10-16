<script setup>
import { ref, provide } from 'vue'
import CalculPesee from './views/CalculPesee.vue'

// L'app Pesée est autonome : l'édition est toujours autorisée.
// (CalculPesee lit inject('peutEditer') — par défaut true, on le fournit explicitement.)
provide('peutEditer', ref(true))
</script>

<template>
  <div class="pes-shell">
    <main class="pes-main">
      <CalculPesee />
    </main>
  </div>
</template>

<style>
/* --- Base globale (reprise minimale du shell ProdTrack) --- */
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  background: #f1f5f9;
  color: #1b2733;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
#app { min-height: 100vh; }
.pes-shell { min-height: 100vh; background: #f1f5f9; }
.pes-main { max-width: 1100px; margin: 0 auto; padding: 22px 20px 56px; }
@media (max-width: 640px) { .pes-main { padding: 16px 14px 40px; } }
</style>
