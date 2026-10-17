// =====================================================================
//  Catalogue des produits (données de référence de l'IF par produit).
//  Sélectionner un produit charge ces données fixes dans le dossier ;
//  l'opérateur ne saisit ensuite que les valeurs réelles du lot.
//  Pour ajouter un produit : copier ce bloc et adapter les valeurs.
// =====================================================================

// --- Fabriques pour composer un formulaire par défaut (ids STABLES, pour
//     que le rechargement d'un dossier enregistré retrouve bien ses saisies).
//     num(limites) · oc(Conforme/Non conforme) · oo(Oui/Non) · txt/date ·
//     colonnes de tableau cn/ct/coc · tab(tableau) · sec(section).           ---
const _num = (id, label, unite = '', min = null, max = null, obligatoire = false) =>
  ({ id, label, type: 'num', unite, min, cible: null, max, obligatoire, attendu: 'Conforme', options: ['Conforme', 'Non conforme'], colonnes: [] })
const _oc = (id, label, obligatoire = false) =>
  ({ id, label, type: 'oui_non', unite: '', min: null, cible: null, max: null, obligatoire, attendu: 'Conforme', options: ['Conforme', 'Non conforme'], colonnes: [] })
const _oo = (id, label, obligatoire = false) =>
  ({ id, label, type: 'oui_non', unite: '', min: null, cible: null, max: null, obligatoire, attendu: 'Oui', options: ['Oui', 'Non'], colonnes: [] })
const _txt = (id, label, type = 'texte', obligatoire = false) =>
  ({ id, label, type, unite: '', min: null, cible: null, max: null, obligatoire, attendu: 'Conforme', options: ['Conforme', 'Non conforme'], colonnes: [] })
const _cn = (id, label, unite = '', min = null, max = null) =>
  ({ id, label, type: 'num', unite, min, max, attendu: 'Conforme', options: ['Conforme', 'Non conforme'] })
const _ct = (id, label) =>
  ({ id, label, type: 'texte', unite: '', min: null, max: null, attendu: 'Conforme', options: ['Conforme', 'Non conforme'] })
const _coc = (id, label) =>
  ({ id, label, type: 'oui_non', unite: '', min: null, max: null, attendu: 'Conforme', options: ['Conforme', 'Non conforme'] })
const _tab = (id, label, colonnes) =>
  ({ id, label, type: 'tableau', unite: '', min: null, cible: null, max: null, obligatoire: false, attendu: 'Conforme', options: ['Conforme', 'Non conforme'], colonnes })
const _sec = (id, titre, champs) => ({ id, titre, champs })

// Formulaire de conduite du lot ROSUSTINE ® 10 mg (comprimé pelliculé),
// calqué sur les étapes du dossier de lot : conditions de ligne, les 6
// opérations du procédé (mélange 01, tamisage, mélange 02, lubrification,
// compression, pelliculage), contrôles IPC et rendement.
// Limites renseignées = spéc. site (T°, HR, ΔP) + pharmacopée (friabilité,
// désagrégation) + masse déduite de la formule (108 mg/cp ± 5 %).
// Limites laissées vides (« à définir ») = valeurs produit à confirmer sur
// l'AMM / dossier (dureté, LOD, temps, vitesses, rendements) : à compléter
// dans le Constructeur. Les champs sans limite sont enregistrés sans alerte.
const FORMULAIRE_ROSUSTINE = {
  sections: [
    _sec('s_init', 'Démarrage & conditions de ligne', [
      _txt('f_date', 'Date de début de fabrication', 'date', true),
      _txt('f_equipe', 'Équipe / poste'),
      _txt('f_chef', 'Chef de ligne'),
      _oc('f_vide', 'Vide de ligne & propreté vérifiés', true),
      _num('f_temp', 'Température de la salle', '°C', 15, 25, true),
      _num('f_hr', 'Humidité relative', '%', null, 60, true),
      _num('f_dp', 'Différentiel de pression', 'Pa', 1, null)
    ]),
    _sec('s_m01', 'Mélange 01 — Rosuvastatine calcium + Crospovidone', [
      _oc('m01_eq', 'Équipement conforme — Mélangeur en V MAKINA 100L (PR210)'),
      _num('m01_t', 'Temps de mélange', 'min'),
      _num('m01_v', 'Vitesse / nombre de tours'),
      _txt('m01_visa', 'Visa opérateur')
    ]),
    _sec('s_tam', 'Tamisage — tamis 0,8 mm', [
      _oc('tam_eq', 'Équipement conforme — Calibreur CPS (PR036/PR097) / Kevin super mill (PR03/PR311)'),
      _oo('tam_grille', 'Tamis 0,8 mm en place'),
      _txt('tam_visa', 'Visa opérateur')
    ]),
    _sec('s_m02', 'Mélange 02 — + Lactose, Cellulose MC, Phosphate de calcium', [
      _oc('m02_eq', 'Équipement conforme — Mélangeur en V MPY 400 (PR032)'),
      _num('m02_t', 'Temps de mélange', 'min'),
      _num('m02_lod', 'LOD / perte à la dessiccation (à définir)', '%'),
      _oc('m02_unif', 'Uniformité de mélange conforme'),
      _txt('m02_visa', 'Visa opérateur')
    ]),
    _sec('s_lub', 'Lubrification — Stéarate de magnésium', [
      _num('lub_t', 'Temps de lubrification', 'min'),
      _txt('lub_visa', 'Visa opérateur')
    ]),
    _sec('s_comp', 'Compression — Fette 1200i (PR012/PR097/PR205)', [
      _oc('comp_eq', 'Équipement conforme'),
      _num('comp_masse', 'Masse moyenne comprimé nu', 'mg', 102.6, 113.4, true),
      _num('comp_dur', 'Dureté moyenne (à définir)', 'N'),
      _num('comp_ep', 'Épaisseur', 'mm'),
      _num('comp_fria', 'Friabilité', '%', null, 1.0),
      _num('comp_desa', 'Désagrégation comprimé nu', 'min', null, 15),
      _oc('comp_aspect', 'Aspect conforme'),
      _tab('comp_ipc', 'Contrôles périodiques en cours de compression', [
        _ct('ci_h', 'Heure'),
        _cn('ci_m', 'Masse moy. 20 cp', 'mg', 102.6, 113.4),
        _cn('ci_d', 'Dureté', 'N'),
        _cn('ci_des', 'Désagrégation', 'min', null, 15),
        _coc('ci_asp', 'Aspect')
      ])
    ]),
    _sec('s_pell', 'Pelliculage — Pelliculeuse LABORTECNIC (PR024)', [
      _oc('pell_eq', 'Équipement conforme'),
      _num('pell_masse', 'Masse moyenne comprimé pelliculé (cible ≈ 112,2)', 'mg'),
      _num('pell_gain', 'Prise de masse au pelliculage (cible ≈ 3,9)', '%'),
      _oc('pell_aspect', 'Aspect / couleur rose homogène conforme'),
      _num('pell_desa', 'Désagrégation comprimé pelliculé', 'min', null, 30),
      _txt('pell_visa', 'Visa opérateur')
    ]),
    _sec('s_rdt', 'Rendement & bilan', [
      _num('rdt_qnu', 'Quantité de comprimés nus obtenue', 'cp'),
      _num('rdt_rcomp', 'Rendement compression (à définir)', '%'),
      _num('rdt_qpell', 'Quantité de comprimés pelliculés', 'cp'),
      _num('rdt_global', 'Rendement global (à définir)', '%'),
      _txt('rdt_rem', 'Remarques / déviations')
    ])
  ]
}

export const PRODUITS_REF = {
  'ROSUSTINE ® 10 mg': {
    entete: {
      refSop: 'AQ-SOP-108-011', refIf: 'PFLDM103', version: '05', totalPages: 92,
      produit: 'ROSUSTINE ® 10 mg', dci2: 'Rosuvastatine calcium', forme: 'Comprimé pelliculé',
      taillePoids: '108.00', uniteDosee: '720 000', uniteVente: '24000'
    },
    amm: {
      dci: 'Rosuvastatine sous forme de Rosuvastatine calcique',
      numAmm: '24/19.06 M 269/309',
      titulaire: 'Laboratoires de Diagnostic Maghrebins-LDM',
      dureeValidite: '36 mois',
      refDossierTechnique: 'Juillet-2018'
    },
    redacteurs: [
      { nom: 'KHAMADJA Seloua', fonction: 'Superviseur Fabrication', visa: '' }
    ],
    verificateurs: [
      { nom: 'DJELOUAT Sandra', fonction: 'Superviseur MS&T Transfert technologique', visa: '' },
      { nom: 'BOUDIAF Raid Abderraouf', fonction: 'Spécialiste AQ Validation', visa: '' },
      { nom: 'ASSABA Dikra', fonction: 'Pharmacienne assistante DT de production, cheffe de projet CMC', visa: '' }
    ],
    approbateurs: [
      { nom: 'BAILI Soumeya', fonction: 'Directrice des affaires réglementaires, market access et pharmacovigilance et DT de production', visa: '' },
      { nom: 'KORICHE Saber', fonction: 'Manager AQ', visa: '' }
    ],
    // Formule de fabrication (page 5)
    formule: [
      { c: 'MPPA0070', de: 'Rosuvastatine calcium', qn: '10,40', qt: '7,49', qc: 'A =' },
      { c: 'MPEX0013', de: 'Cellulose microcristalline PH102', qn: '29,82', qt: '21,47', qc: 'B =' },
      { c: 'MPEX0158', de: 'Lactose monohydrate (Flowlac 100)', qn: '89,50', qt: '64,44', qc: '64,44' },
      { c: 'MPEX0017', de: 'Crospovidone (POLYPLASDONE XL)', qn: '7,50', qt: '5,40', qc: '5,40' },
      { c: 'MPEX0253', de: 'Calcium phosphate Tribasic', qn: '10,90', qt: '7,85', qc: '7,85' },
      { c: 'MPEX0056', de: 'Stéarate de magnésium (LIGAMED MF-2-V)', qn: '1,88', qt: '1,35', qc: '1,35' }
    ],
    formuleP: [
      { c: 'MPEX0255', de: "Aquapolish P pink 041.47 (PREMELANGE D'ENROBAGE ROSE)", qn: '4,50', qt: '4,21 (2)', qc: '4,21 (2)' },
      { c: '/', de: 'Eau purifiée', qn: 'Q.S', qt: '25,90 (2)', qc: '25,90 (2)' }
    ],
    // Liste des matières (réception, bilan) : [désignation, code]
    mats: [
      ['Rosuvastatine calcium', 'MPPA0070'],
      ['Cellulose microcristalline PH102', 'MPEX0013'],
      ['Lactose monohydrate (Flowlac 100)', 'MPEX0158'],
      ['Crospovidone (POLYPLASDONE XL)', 'MPEX0017'],
      ['Calcium phosphate Tribasic', 'MPEX0253'],
      ['Stéarate de magnésium (LIGAMED MF-2-V)', 'MPEX0056'],
      ["Aquapolish P pink 041.47 (PREMELANGE D'ENROBAGE ROSE)", 'MPEX0255']
    ],
    // Excipients pesés (page 19-20) : [désignation, code, quantité théorique]
    exc: [
      ['Cellulose microcristalline PH102', 'MPEX0013', ''],
      ['Lactose monohydrate (Flowlac 100)', 'MPEX0158', '64,44'],
      ['Crospovidone (POLYPLASDONE XL)', 'MPEX0017', '5,40'],
      ['Calcium phosphate Tribasic', 'MPEX0253', '7,85'],
      ['Stéarate de magnésium (LIGAMED MF-2-V)', 'MPEX0056', '1,35'],
      ["Aquapolish P pink 041.47 (PREMELANGE D'ENROBAGE ROSE)", 'MPEX0255', '4,21']
    ],
    // Équipements de pesée (vérif + étalonnage) : [désignation, code]
    equip: [
      ['Balance Mettler Toledo MS 3200LL/01', 'PR042'],
      ['Balance de pesée Mettler Toledo', 'PR325']
    ],
    // Diagramme de fabrication (page 8) — flux d'opérations, IPC, équipements de la ligne
    diagramme: {
      flux: [
        { nom: 'Mélange 01', items: ['Rosuvastatine calcium', 'Crospovidone'] },
        { nom: 'Tamisage (Tamis à 0.8 mm)', items: ['Mélange 01'] },
        { nom: 'Mélange 02', items: ['Mélange 1', 'Lactose monohydrate', 'Cellulose microcristalline PH102', 'Calcium phosphate tribasic'] },
        { nom: 'Lubrification', items: ['Stéarate de Magnésium (LIGAMED MF-2-V)'] },
        { nom: 'Compression', items: [] },
        { nom: 'Pelliculage', items: ["Prémélange d'enrobage rose : Aquapolish P pink 041.47, Eau purifiée"] }
      ],
      ipc: [
        'LOD — Uniformité de mélange',
        'Aspect — Masse individuelle — Dureté — Friabilité — Désagrégation',
        'Aspect — Masse — Désagrégation'
      ],
      equipements: [
        'Balances, codes : PR042 / PR325',
        '« Mélangeur en V » MAKINA 100L, code : PR210',
        'Calibreur CPS line, code PR036/PR097 — Kevin super mill, code PR03/PR311',
        '« Mélangeur en V » MPY 400, code : PR032',
        'Comprimeuse Fette 1200i, codes : PR012/PR097/PR205',
        'Pelliculeuse LABORTECNIC, code : PR024'
      ]
    },
    // Formulaire de conduite du lot (configurable par produit — voir ci-dessus)
    formulaire: FORMULAIRE_ROSUSTINE
  }
}
