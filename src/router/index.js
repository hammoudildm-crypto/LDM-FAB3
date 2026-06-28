import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Login from '../views/Login.vue'
import Referentiels from '../views/Referentiels.vue'
import PlanDirecteur from '../views/PlanDirecteur.vue'
import OrdresFabrication from '../views/OrdresFabrication.vue'

const routes = [
  { path: '/', name: 'home', component: Home },
  { path: '/referentiels', name: 'referentiels', component: Referentiels },
  { path: '/plan', name: 'plan', component: PlanDirecteur },
  { path: '/ordres', name: 'ordres', component: OrdresFabrication },
  { path: '/login', name: 'login', component: Login },
]

export default createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
})
