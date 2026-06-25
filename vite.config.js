import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Pré-configuré pour le repo GitHub : hammoudildm-crypto/LDM-FAB3
// → site servi sous https://hammoudildm-crypto.github.io/LDM-FAB3/
// base alimente import.meta.env.BASE_URL, que le routeur réutilise automatiquement.
// (Si tu renommes le repo un jour, change UNIQUEMENT cette ligne.)
export default defineConfig({
  plugins: [vue()],
  base: '/LDM-FAB3/',
})
