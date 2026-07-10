import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Login from '../views/Login.vue'
import Referentiels from '../views/Referentiels.vue'
import PlanDirecteur from '../views/PlanDirecteur.vue'
import OrdresFabrication from '../views/OrdresFabrication.vue'
import SuiviPhases from '../views/SuiviPhases.vue'
import Conditionnement from '../views/Conditionnement.vue'
import SaisieTRS from '../views/SaisieTRS.vue'
import DossierLot from '../views/DossierLot.vue'
import ChiffreAffaires from '../views/ChiffreAffaires.vue'
import Effectifs from '../views/Effectifs.vue'
import EnCours from '../views/EnCours.vue'
import JournalAudit from '../views/JournalAudit.vue'
import Habilitations from '../views/Habilitations.vue'
import MonCompte from '../views/MonCompte.vue'
import VerificationDDL from '../views/VerificationDDL.vue'
import VerificationDDLCond from '../views/VerificationDDLCond.vue'
import RealisationPlan from '../views/RealisationPlan.vue'
import Rendement from '../views/Rendement.vue'
import DisponibiliteEquipements from '../views/DisponibiliteEquipements.vue'
import AvancementLots from '../views/AvancementLots.vue'
import ProductionAtelier from '../views/ProductionAtelier.vue'
import SuiviTRS from '../views/SuiviTRS.vue'

const routes = [
  { path: '/', name: 'home', component: Home },
  { path: '/referentiels', name: 'referentiels', component: Referentiels },
  { path: '/plan', name: 'plan', component: PlanDirecteur },
  { path: '/ordres', name: 'ordres', component: OrdresFabrication },
  { path: '/suivi', name: 'suivi', component: SuiviPhases },
  { path: '/conditionnement', name: 'conditionnement', component: Conditionnement },
  { path: '/saisie-trs', name: 'saisie-trs', component: SaisieTRS },
  { path: '/encours', name: 'encours', component: EnCours },
  { path: '/dossier', name: 'dossier', component: DossierLot },
  { path: '/ca', name: 'ca', component: ChiffreAffaires },
  { path: '/effectifs', name: 'effectifs', component: Effectifs },
  { path: '/audit', name: 'audit', component: JournalAudit },
  { path: '/habilitations', name: 'habilitations', component: Habilitations },
  { path: '/verification-ddl', name: 'verification-ddl', component: VerificationDDL },
  { path: '/verification-ddl-cond', name: 'verification-ddl-cond', component: VerificationDDLCond },
  { path: '/realisation-plan', name: 'realisation-plan', component: RealisationPlan },
  { path: '/rendement', name: 'rendement', component: Rendement },
  { path: '/dispo-equipements', name: 'dispo-equipements', component: DisponibiliteEquipements },
  { path: '/avancement', name: 'avancement', component: AvancementLots },
  { path: '/production-atelier', name: 'production-atelier', component: ProductionAtelier },
  { path: '/suivi-trs', name: 'suivi-trs', component: SuiviTRS },
  { path: '/compte', name: 'compte', component: MonCompte },
  { path: '/login', name: 'login', component: Login },
]

export default createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
})
