import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Login from '../views/Login.vue'
import Referentiels from '../views/Referentiels.vue'
import PlanDirecteur from '../views/PlanDirecteur.vue'
import OrdresFabrication from '../views/OrdresFabrication.vue'
import SuiviPhases from '../views/SuiviPhases.vue'
import Conditionnement from '../views/Conditionnement.vue'
import DossierLot from '../views/DossierLot.vue'
import ChiffreAffaires from '../views/ChiffreAffaires.vue'

const routes = [
  { path: '/', name: 'home', component: Home },
  { path: '/referentiels', name: 'referentiels', component: Referentiels },
  { path: '/plan', name: 'plan', component: PlanDirecteur },
  { path: '/ordres', name: 'ordres', component: OrdresFabrication },
  { path: '/suivi', name: 'suivi', component: SuiviPhases },
  { path: '/conditionnement', name: 'conditionnement', component: Conditionnement },
  { path: '/dossier', name: 'dossier', component: DossierLot },
  { path: '/ca', name: 'ca', component: ChiffreAffaires },
  { path: '/login', name: 'login', component: Login },
]

export default createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
})
