import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Login from '../views/Login.vue'

const routes = [
  { path: '/', name: 'home', component: Home },
  { path: '/login', name: 'login', component: Login },
]

// Hash mode (#/route) : évite les 404 au refresh sur GitHub Pages,
// qui ne sait pas réécrire les URLs côté serveur.
export default createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
})
