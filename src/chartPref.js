import { ref, watch } from 'vue'

// Préférence de style de graphe, partagée par toute l'app et mémorisée.
let saved = 'courbes'
try { const s = localStorage.getItem('ldmfab-chart'); if (s) saved = s } catch (e) { /* ignore */ }

export const chartStyle = ref(saved)

watch(chartStyle, (v) => {
  try { localStorage.setItem('ldmfab-chart', v) } catch (e) { /* ignore */ }
})
