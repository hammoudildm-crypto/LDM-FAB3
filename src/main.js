import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { startVersionCheck } from './versionCheck'

createApp(App).use(router).mount('#app')

// Détection automatique des nouvelles versions déployées (anti-cache).
startVersionCheck()
