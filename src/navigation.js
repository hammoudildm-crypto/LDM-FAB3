// =====================================================================
//  Organisation des pages par MODULE — source unique de navigation,
//  partagée par le hub (Hub.vue) et la barre latérale (App.vue).
//  Pour ajouter/déplacer une page : modifier ici, les deux se mettent à jour.
//  Chaque module : { key, label, c (couleur), admin?, icon (SVG <g>), links:[[path,label]] }
// =====================================================================
const S = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"'

export const MODULES = [
  { key: 'config', label: 'Configuration', c: '#64748b', admin: true,
    icon: `<g ${S}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></g>`,
    links: [['/referentiels', 'Référentiels'], ['/cadences', 'Cadences'], ['/habilitations', 'Habilitations']] },
  { key: 'ordo', label: 'Ordonnancement & OF', c: '#6366f1',
    icon: `<g ${S}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></g>`,
    links: [['/ordonnancement', 'Ordonnancement'], ['/plan', 'Plan directeur'], ['/ordres', 'Ordres de fabrication'], ['/planning-equipements', 'Planning équipements']] },
  { key: 'suivifab', label: 'Suivi de fabrication', c: '#0ea5e9',
    icon: `<g ${S}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></g>`,
    links: [['/temps-reel', 'Suivi temps réel'], ['/avancement', 'Suivi du process'], ['/encours', 'En-cours']] },
  { key: 'suiviprod', label: 'Suivi de production', c: '#0ea5e9',
    icon: `<g ${S}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></g>`,
    links: [['/dispo-equipements', 'Disponibilité équipements'], ['/production-atelier', 'Production par atelier'], ['/suivi-trs', 'Suivi TRS'], ['/capacite', 'Capacité équipements'], ['/dossier', 'Dossier de lot'], ['/historique', 'Historique des opérations']] },
  { key: 'saisie', label: 'Saisie & exécution', c: '#14b8a6',
    icon: `<g ${S}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></g>`,
    links: [['/suivi', 'Suivi fab. & Saisie TRS'], ['/conditionnement', 'Conditionnement'], ['/calcul-pesee', 'Calcul de pesée (API / excipient)'], ['/dossier-ebmr', 'Dossier de lot (eBMR)'], ['/passation', 'Passation de consigne']] },
  { key: 'ddl', label: 'Qualité — DDL', c: '#f43f5e',
    icon: `<g ${S}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></g>`,
    links: [['/verification-ddl', 'DDL Fab — Production'], ['/verification-ddl-aq', 'DDL Fab — AQ'], ['/verification-ddl-cond', 'DDL Conditionnement'], ['/qualite', 'Déviations / CAPA / Changements'], ['/audit', "Journal d'audit"]] },
  { key: 'formation', label: 'Formation & Qualification', c: '#0d9488',
    icon: `<g ${S}><path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5"/></g>`,
    links: [['/effectifs', 'Effectifs'], ['/organigramme', 'Organigramme'], ['/formations', 'Référentiel des formations'], ['/formations-exigences', 'Exigences par fonction'], ['/formations-planning', 'Planification & suivi'], ['/formations-enreg', 'Enregistrements'], ['/formations-matrice', 'Matrice & tableau de bord']] },
  { key: 'pqr', label: 'Revue qualité (PQR)', c: '#a855f7',
    icon: `<g ${S}><path d="M9 3h6"/><path d="M10 3v5.5L4.5 17a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 8.5V3"/><line x1="8.5" y1="14" x2="15.5" y2="14"/></g>`,
    links: [['/pqr-parametres', 'Paramètres critiques'], ['/pqr-saisie', 'Saisie des mesures'], ['/pqr-tableau', 'Tableau de bord PQR']] },
  { key: 'pilotage', label: 'Pilotage', c: '#22c55e',
    icon: `<g ${S}><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></g>`,
    links: [['/tableau-de-bord', 'Tableau de bord'], ['/realisation-plan', 'Réalisation vs Plan'], ['/realisation-pdp', 'Réalisation PDP par phase'], ['/pdp-equipement', 'PDP par équipement'], ['/rendement', 'Rendement'], ['/ca', "Chiffre d'affaires"], ['/qse', 'Indicateurs QSE']] }
]

// Carte chemin -> couleur de module (pour l'accent de page : bordure topbar, lien actif).
export const MODULE_COLOR = (() => {
  const m = {}
  for (const g of MODULES) for (const l of g.links) m[l[0]] = g.c
  return m
})()

// Clé du module contenant un chemin donné (pour ouvrir le bon groupe dans la barre).
export function moduleDe(path) {
  const g = MODULES.find(g => g.links.some(l => l[0] === path))
  return g ? g.key : null
}
