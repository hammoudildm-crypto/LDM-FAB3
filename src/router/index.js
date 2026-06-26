import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Login from '../views/Login.vue'
import Referentiels from '../views/Referentiels.vue'

const routes = [
  { path: '/', name: 'home', component: Home },
  { path: '/referentiels', name: 'referentiels', component: Referentiels },
  { path: '/login', name: 'login', component: Login },
]

// Hash mode (#/route) : évite les 404 au refresh sur GitHub Pages.
export default createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
})
