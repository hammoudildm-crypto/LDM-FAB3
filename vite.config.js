import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Pré-configuré pour le repo GitHub : hammoudildm-crypto/LDM-FAB3
// → site servi sous https://hammoudildm-crypto.github.io/LDM-FAB3/
// base alimente import.meta.env.BASE_URL, que le routeur réutilise automatiquement.
// (Si tu renommes le repo un jour, change UNIQUEMENT cette ligne.)

// Version de build (horodatage) : sert à détecter une nouvelle version côté
// navigateur et à proposer un rechargement automatique (anti-cache).
const APP_VERSION = String(Date.now())

// Émet /version.json dans le build, lu au runtime pour comparer à la version chargée.
function versionEmit() {
  return {
    name: 'app-version-emit',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ v: APP_VERSION }) })
    }
  }
}

export default defineConfig({
  plugins: [vue(), versionEmit()],
  base: '/LDM-FAB3/',
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION)
  },
})
