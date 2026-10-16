import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Pré-configuré pour un dépôt GitHub nommé : hammoudildm-crypto/LDM-PESEE
// → site servi sous https://hammoudildm-crypto.github.io/LDM-PESEE/
// ⚠️ Si tu crées le dépôt sous un AUTRE nom, change UNIQUEMENT cette ligne
//    (ex. repo "pesee" → base: '/pesee/').
export default defineConfig({
  plugins: [vue()],
  base: '/LDM-PESEE/',
})
