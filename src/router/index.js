import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../views/Home.vue'
import TableauBord from '../views/TableauBord.vue'
import SuiviTempsReel from '../views/SuiviTempsReel.vue'
import RealisationPDP from '../views/RealisationPDP.vue'
import PdpEquipement from '../views/PdpEquipement.vue'
import Hub from '../views/Hub.vue'
import Accueil from '../views/Accueil.vue'
import Ordonnancement from '../views/Ordonnancement.vue'
import PlanningEquipements from '../views/PlanningEquipements.vue'
import Login from '../views/Login.vue'
import Referentiels from '../views/Referentiels.vue'
import PlanDirecteur from '../views/PlanDirecteur.vue'
import OrdresFabrication from '../views/OrdresFabrication.vue'
import SuiviPhases from '../views/SuiviPhases.vue'
import Conditionnement from '../views/Conditionnement.vue'
import SaisieTRS from '../views/SaisieTRS.vue'
import SaisieProduction from '../views/SaisieProduction.vue'
import DossierLot from '../views/DossierLot.vue'
import ChiffreAffaires from '../views/ChiffreAffaires.vue'
import Effectifs from '../views/Effectifs.vue'
import EnCours from '../views/EnCours.vue'
import JournalAudit from '../views/JournalAudit.vue'
import Habilitations from '../views/Habilitations.vue'
import MonCompte from '../views/MonCompte.vue'
import VerificationDDL from '../views/VerificationDDL.vue'
import VerificationDDLCond from '../views/VerificationDDLCond.vue'
import VerificationDDLAQ from '../views/VerificationDDLAQ.vue'
import RealisationPlan from '../views/RealisationPlan.vue'
import Rendement from '../views/Rendement.vue'
import DisponibiliteEquipements from '../views/DisponibiliteEquipements.vue'
import AvancementLots from '../views/AvancementLots.vue'
import ProductionAtelier from '../views/ProductionAtelier.vue'
import SuiviTRS from '../views/SuiviTRS.vue'
import SuiviCapacite from '../views/SuiviCapacite.vue'
import EquipementDetail from '../views/EquipementDetail.vue'
import IndicateursQSE from '../views/IndicateursQSE.vue'
import Cadences from '../views/Cadences.vue'
import PassationConsigne from '../views/PassationConsigne.vue'
import HistoriquePhases from '../views/HistoriquePhases.vue'

const routes = [
  { path: '/', name: 'home', component: Hub },
  { path: '/tableau-de-bord', name: 'tableau-de-bord', component: TableauBord },
  { path: '/temps-reel', name: 'temps-reel', component: SuiviTempsReel },
  { path: '/realisation-pdp', name: 'realisation-pdp', component: RealisationPDP },
  { path: '/planning-equipements', name: 'planning-equipements', component: PlanningEquipements },
  { path: '/pdp-equipement', name: 'pdp-equipement', component: PdpEquipement },
  { path: '/tableau-de-bord-classique', name: 'tb-classique', component: Home },
  { path: '/accueil', redirect: '/' },
  { path: '/ordonnancement', name: 'ordonnancement', component: Ordonnancement },
  { path: '/referentiels', name: 'referentiels', component: Referentiels },
  { path: '/plan', name: 'plan', component: PlanDirecteur },
  { path: '/ordres', name: 'ordres', component: OrdresFabrication },
  { path: '/suivi', name: 'suivi', component: SaisieProduction },
  { path: '/conditionnement', name: 'conditionnement', component: Conditionnement },
  { path: '/saisie-trs', name: 'saisie-trs', component: SaisieTRS },
  { path: '/encours', name: 'encours', component: EnCours },
  { path: '/dossier', name: 'dossier', component: DossierLot },
  { path: '/historique', name: 'historique', component: HistoriquePhases },
  { path: '/ca', name: 'ca', component: ChiffreAffaires },
  { path: '/effectifs', name: 'effectifs', component: Effectifs },
  { path: '/audit', name: 'audit', component: JournalAudit },
  { path: '/habilitations', name: 'habilitations', component: Habilitations },
  { path: '/verification-ddl', name: 'verification-ddl', component: VerificationDDL },
  { path: '/verification-ddl-cond', name: 'verification-ddl-cond', component: VerificationDDLCond },
  { path: '/verification-ddl-aq', name: 'verification-ddl-aq', component: VerificationDDLAQ },
  { path: '/realisation-plan', name: 'realisation-plan', component: RealisationPlan },
  { path: '/rendement', name: 'rendement', component: Rendement },
  { path: '/dispo-equipements', name: 'dispo-equipements', component: DisponibiliteEquipements },
  { path: '/avancement', name: 'avancement', component: AvancementLots },
  { path: '/production-atelier', name: 'production-atelier', component: ProductionAtelier },
  { path: '/suivi-trs', name: 'suivi-trs', component: SuiviTRS },
  { path: '/capacite', name: 'capacite', component: SuiviCapacite },
  { path: '/equipement', name: 'equipement', component: EquipementDetail },
  { path: '/qse', name: 'qse', component: IndicateursQSE },
  { path: '/cadences', name: 'cadences', component: Cadences },
  { path: '/passation', name: 'passation', component: PassationConsigne },
  { path: '/compte', name: 'compte', component: MonCompte },
  { path: '/login', name: 'login', component: Login },
]

export default createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
})
