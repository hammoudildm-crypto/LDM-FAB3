// =====================================================================
//  Catalogue des produits (données de référence de l'IF par produit).
//  Sélectionner un produit charge ces données fixes dans le dossier ;
//  l'opérateur ne saisit ensuite que les valeurs réelles du lot.
//  Pour ajouter un produit : copier ce bloc et adapter les valeurs.
// =====================================================================

// --- Fabriques pour composer un formulaire par défaut (ids STABLES, pour
//     que le rechargement d'un dossier enregistré retrouve bien ses saisies).
//     Champs : num(limites) · oc(Conforme/Non conforme) · cnc(C/NC) ·
//     oo(Oui/Non) · txt/date. Colonnes de tableau : cn(num) · ct(texte) ·
//     coc(Conforme/NC) · ccnc(C/NC) · coo(Oui/Non). tab(tableau) · sec(section). ---
const _num = (id, label, unite = '', min = null, max = null, obligatoire = false) =>
  ({ id, label, type: 'num', unite, min, cible: null, max, obligatoire, attendu: 'Conforme', options: ['Conforme', 'Non conforme'], colonnes: [] })
const _oc = (id, label, obligatoire = false) =>
  ({ id, label, type: 'oui_non', unite: '', min: null, cible: null, max: null, obligatoire, attendu: 'Conforme', options: ['Conforme', 'Non conforme'], colonnes: [] })
const _cnc = (id, label, obligatoire = false) =>
  ({ id, label, type: 'oui_non', unite: '', min: null, cible: null, max: null, obligatoire, attendu: 'C', options: ['C', 'NC'], colonnes: [] })
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
const _ccnc = (id, label) =>
  ({ id, label, type: 'oui_non', unite: '', min: null, max: null, attendu: 'C', options: ['C', 'NC'] })
const _coo = (id, label) =>
  ({ id, label, type: 'oui_non', unite: '', min: null, max: null, attendu: 'Oui', options: ['Oui', 'Non'] })
const _tab = (id, label, colonnes) =>
  ({ id, label, type: 'tableau', unite: '', min: null, cible: null, max: null, obligatoire: false, attendu: 'Conforme', options: ['Conforme', 'Non conforme'], colonnes })
const _sec = (id, titre, champs) => ({ id, titre, champs })

// =====================================================================
//  Formulaire ROSUSTINE ® 10 mg — PARTIE PESÉE (IF PFLDM103, pages 9-24,
//  sections 1 à 14). Calqué page par page sur le dossier de lot papier.
//  Limites = spéc. dossier : T° 15-25 °C, HR ≤60 %, ΔP ≥1 mmH₂O.
//  Conformité pesée (quantité pesée vs théorique ± tolérance) = vue
//  « ② Pesée guidée (eBMR) » ; ici les quantités pesées sont enregistrées.
// =====================================================================
const FORMULAIRE_ROSUSTINE = {
  sections: [
    _sec('p_prelim', '1 · Opérations préliminaires & autorisation de démarrage', [
      _txt('pp_date', 'Date de début de pesée', 'date', true),
      _txt('pp_salle', 'N° de salle de pesée'),
      _txt('pp_heure', 'Heure de début'),
      _num('pp_temp', 'Température de la salle', '°C', 15, 25, true),
      _num('pp_hr', 'Humidité relative', '%', null, 60, true),
      _num('pp_dp', 'Différentiel de pression (ΔP)', 'mmH₂O', 1, null, true),
      _cnc('pp_vl_instr', 'Vide de ligne — Instructions générales'),
      _cnc('pp_vl_secu', 'Vide de ligne — Consignes de sécurité'),
      _cnc('pp_vl_env', 'Vide de ligne — Conditions environnementales'),
      _cnc('pp_vl_net', 'Vide de ligne — Nettoyage local & équipements'),
      _oo('pp_doc', "Présence de tous les documents de l'instruction de fabrication"),
      _oo('pp_habil', 'Habillage spécifique / réglementaire du personnel'),
      _oo('pp_sante', 'Aptitude hygiène du personnel vérifiée (selon procédure)'),
      _txt('pp_sup_visa', 'Démarrage autorisé — Superviseur Fabrication (date / heure / visa)'),
      _txt('pp_aq_visa', 'Démarrage autorisé — AQ Process (date / heure / visa)')
    ]),
    _sec('p_net', '2 · Vérification du nettoyage (étiquettes « nettoyé »)', [
      _oo('net_salle', 'Étiquette « nettoyé » — Salle de pesée collée'),
      _oo('net_flux', 'Étiquette « nettoyé » — Flux laminaire collée'),
      _oo('net_bal', 'Étiquettes « nettoyé » — Balances collées'),
      _oo('net_mat', 'Étiquettes « nettoyé » — Matériels de pesée collées'),
      _txt('net_visa', 'Vérifié par — Date & Visa')
    ]),
    _sec('p_ope', '3 · Liste des opérateurs de pesée', [
      _tab('ope_tab', 'Opérateurs — Shift 01 : 06-14h · 02 : 14-22h · 03 : 22-06h', [
        _ct('op_shift', 'N° Shift'),
        _ct('op_poste', 'Poste'),
        _ct('op_nom', 'Nom & prénom'),
        _ct('op_date', 'Date'),
        _ct('op_visa', 'Visa'),
        _ct('op_verif', 'Vérifié par (Date & Visa)')
      ])
    ]),
    _sec('p_equip', '4 · Vérification des équipements de pesée', [
      _cnc('eq042_vide', 'Balance Mettler Toledo MS 3200LL/01 (PR042) — Fonctionnement à vide'),
      _cnc('eq042_qual', 'PR042 — Statut qualification / calibration'),
      _cnc('eq042_vitr', 'PR042 — État des parties vitrées'),
      _cnc('eq325_vide', 'Balance de pesée Mettler Toledo (PR325) — Fonctionnement à vide'),
      _cnc('eq325_qual', 'PR325 — Statut qualification / calibration'),
      _cnc('eq325_vitr', 'PR325 — État des parties vitrées'),
      _txt('eq_visa', 'Fait par / Vérifié par — Date & Visa')
    ]),
    _sec('p_etal', '5 · Vérification de l\'étalonnage des balances', [
      _oo('etal042', 'Balance PR042 — Calibrage journalier effectué'),
      _oo('etal325', 'Balance PR325 — Calibrage journalier effectué'),
      _txt('etal_visa', 'Vérifié par — Date & Visa')
    ]),
    _sec('p_cond', '6 · Conditions T° / HR / ΔP au cours du process', [
      _tab('cond_tab', 'Relevés — début / milieu / fin de chaque shift (ΔP systématique)', [
        _ct('co_date', 'Date'),
        _ct('co_moment', 'Moment (Début/Milieu/Fin)'),
        _ct('co_heure', 'Heure'),
        _cn('co_t', 'Température', '°C', 15, 25),
        _cn('co_hr', 'Humidité', '%', null, 60),
        _cn('co_dp', 'ΔP', 'mmH₂O', 1, null),
        _ct('co_salle', 'N° salle'),
        _ct('co_visa', 'Visa')
      ])
    ]),
    _sec('p_recint', '7 · Réception des matières premières — retour interne', [
      _tab('recint_tab', 'Matières (retour interne) — 7 articles de la formule', [
        _ct('ri_art', 'Article'),
        _ct('ri_code', 'Code interne'),
        _ct('ri_lot', 'N° lot interne'),
        _cn('ri_qte', 'Quantité de retour', 'kg'),
        _coo('ri_etiq', 'Étiquette retour présente'),
        _ct('ri_visa', 'Vérifié par (Date & Visa)')
      ])
    ]),
    _sec('p_recext', '8 · Réception des matières premières — externe', [
      _tab('recext_tab', 'Matières (réception externe)', [
        _ct('re_art', 'Article'),
        _ct('re_code', 'Code interne'),
        _ct('re_lot', 'N° lot interne'),
        _coo('re_int', 'Contenant intègre / scellé / identifié'),
        _coo('re_etiq', 'Étiquette « accepté » présente'),
        _cn('re_cmd', 'Quantité commandée', 'kg'),
        _cn('re_liv', 'Quantité livrée', 'kg'),
        _ct('re_visa', 'Vérifié par (Date & Visa)')
      ])
    ]),
    _sec('p_pa', '9 · Pesée des principes actifs — Rosuvastatine calcium (MPPA0070)', [
      _txt('pa_hdeb', 'Heure de début de pesée'),
      _txt('pa_lot', 'N° de lot interne du PA'),
      _txt('pa_bal', 'Code balance utilisée'),
      _num('pa_theo', 'Quantité théorique corrigée A (à peser)', 'kg'),
      _num('pa_g', 'Pesée globale G', 'kg'),
      _num('pa_t', 'Tare T', 'kg'),
      _num('pa_n', 'Pesée nette N', 'kg'),
      _num('pa_b', 'Double pesée B (contrôle)', 'kg'),
      _txt('pa_visa', 'Fait par / Vérifié par — Date & Visa'),
      _txt('pa_hfin', 'Heure de fin de pesée'),
      _oo('pa_stock', 'Stockage API conforme (double sac PE + gel de silice, fût inox fermé)')
    ]),
    _sec('p_exc', '10 · Pesée des excipients', [
      _tab('exc_tab', 'Excipients — théoriques (kg/lot) : Lactose 64,44 · Crospovidone 5,40 · Phosphate Ca 7,85 · Stéarate Mg 1,35 · Aquapolish 4,21 ; Cellulose MC = quantité d\'ajustage B', [
        _ct('ex_des', 'Désignation'),
        _ct('ex_code', 'Code interne'),
        _ct('ex_lot', 'N° lot'),
        _cn('ex_theo', 'Qté théorique / lot', 'kg'),
        _cn('ex_net', 'Qté pesée nette N', 'kg'),
        _cn('ex_double', 'Double pesée B', 'kg'),
        _ct('ex_visa', 'Fait par / Vérifié par')
      ])
    ]),
    _sec('p_bilan', '11 · Bilan de pesée', [
      _oo('bil_bc', 'Bon de commande joint'),
      _oo('bil_bri', 'Bon de retours interne joint'),
      _oo('bil_brf', 'Bon de retour final joint'),
      _oo('bil_bav', "Bon d'avarie joint"),
      _tab('bil_tab', 'Bilan matières', [
        _ct('bl_mat', 'Matière'),
        _ct('bl_code', 'Code interne'),
        _ct('bl_lot', 'N° lot interne'),
        _cn('bl_liv', 'Qté totale livrée', 'kg'),
        _cn('bl_pes', 'Qté pesée', 'kg'),
        _cn('bl_reti', 'Qté retournée interne', 'kg'),
        _cn('bl_retf', 'Qté retournée final', 'kg'),
        _cn('bl_av', 'Qté avariée', 'kg'),
        _ct('bl_visa', 'Date & Visa Superviseur')
      ]),
      _txt('bil_visa', 'Date / Visa Responsable Fabrication')
    ]),
    _sec('p_inc', '12 · Suivi des incidents et arrêts', [
      _tab('inc_tab', 'Incidents / arrêts', [
        _ct('in_date', 'Date'),
        _ct('in_harr', "Heure d'arrêt"),
        _ct('in_sac', 'N° de sac'),
        _ct('in_motif', 'Motif'),
        _ct('in_action', 'Action corrective'),
        _ct('in_ddem', 'Date de démarrage'),
        _ct('in_hdem', 'Heure de démarrage'),
        _ct('in_visa', 'Fait par (Visa)')
      ])
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
    // Formulaire de conduite du lot — PARTIE PESÉE (voir FORMULAIRE_ROSUSTINE ci-dessus)
    formulaire: FORMULAIRE_ROSUSTINE
  }
}
