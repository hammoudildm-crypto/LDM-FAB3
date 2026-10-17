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
const _note = (id, label, contenu) => ({ id, label, type: 'note', unite: '', min: null, cible: null, max: null, obligatoire: false, attendu: 'Conforme', options: ['Conforme', 'Non conforme'], colonnes: [], contenu })
const _chk = (id, label, jeu, items) => {
  const J = { cnc: { options: ['C', 'NC'], attendu: 'C' }, oui: { options: ['Oui', 'Non'], attendu: 'Oui' }, conf: { options: ['Conforme', 'Non conforme'], attendu: 'Conforme' } }[jeu] || { options: ['C', 'NC'], attendu: 'C' }
  return { id, label, type: 'checklist', unite: '', min: null, cible: null, max: null, obligatoire: false, attendu: J.attendu, options: J.options, colonnes: [], contenu: '', items: items.map((l, i) => ({ id: id + '_' + (i + 1), label: l })) }
}
const _ooi = (id, label) => ({ id, label, type: 'oui_non', unite: '', min: null, cible: null, max: null, obligatoire: false, attendu: '', options: ['Oui', 'Non'], colonnes: [], contenu: '' })
const _pj = (id, label) => ({ id, label, type: 'fichier', unite: '', min: null, cible: null, max: null, obligatoire: false, attendu: 'Conforme', options: ['Conforme', 'Non conforme'], colonnes: [], contenu: '' })
const _sec = (id, titre, champs, cols = 1) => ({ id, titre, cols, champs })

// Texte « Instructions générales » (dossier, pages 3-4) — affiché en pièce jointe.
const TXT_INSTRUCTIONS_GEN = `Le Superviseur doit procéder aux vérifications suivantes avant le démarrage de chaque opération de fabrication :
• Vide de ligne : machines et locaux libérés des matériaux et documents du produit précédent.
• Nettoyage : nettoyage des salles et équipements selon la procédure en vigueur ; étiquettes de nettoyage jointes à l'IF.
• Identification : locaux et machines identifiés (nom du produit et N° de lot sur la fiche d'identification).
• Calibrage des balances (si applicable) : calibrage effectué et renseigné selon la procédure en vigueur.
• Paramètre du milieu : température (°C), humidité (%) et pression différentielle (mmH₂O) documentées sur la page correspondante.
• Personnel : nom et prénom des intervenants notés sur la fiche de suivi du personnel.
• Matières : propreté et intégrité des MP réceptionnées vérifiées ; page de réception renseignée.
• Machines : paramètres machine dans l'intervalle correspondant.
• Ordre de fabrication : validité de l'OF vérifiée.
• Attendre l'approbation AQ avant de procéder à l'opération de fabrication concernée.
• En cas d'anomalies : stopper l'opération, alerter le responsable hiérarchique, mentionner l'incident sur la page correspondante.`

// Texte « Consignes de sécurité obligatoires » (dossier, page 4).
const TXT_SECURITE = `• Le port de la tenue pharmaceutique adaptée à la zone est obligatoire (procédure d'habillage en vigueur).
• Le port du casque antibruit est obligatoire lors des opérations de compression.
• Interdiction formelle d'intervenir sur les machines en marche : attendre l'arrêt complet de l'équipement.
• Interdiction formelle de bipasser les consignes de sécurité de l'équipement.
• Interdiction formelle de désactiver les carters de sécurité de l'équipement.
• Le personnel est tenu de déclarer à sa hiérarchie toute plaie ou maladie contagieuse avant d'accéder à la zone de production.
• Éviter tout contact des produits manipulés avec la peau.`

// Texte « Précautions de production » (dossier, page 4).
const TXT_PRECAUTIONS = `• La fermeture des portes des ateliers de fabrication est obligatoire tout au long du process.
• En cours de fabrication, éviter un contact prolongé du produit avec l'air (ex. heures de pause, produit hygroscopique).
• Retirer le produit de l'équipement lorsqu'un arrêt prolongé est prévu.`

// =====================================================================
//  Formulaire PESÉE PAR DÉFAUT (modèle intégré) — utilisé par TOUS les produits
//  tant qu'ils n'ont pas leur propre formulaire. Calqué sur le dossier de lot
//  (IF PFLDM103, pages 9-24, sections 1 à 14). Limites = spéc. dossier du site :
//  T° 15-25 °C, HR ≤60 %, ΔP ≥1 mmH₂O. Les quantités pesées sont enregistrées.
//  Les libellés propres à un produit (PA, excipients) se complètent à la saisie.
// =====================================================================
const SECTIONS_PESEE = [
    _sec('p_prelim', '1 · Opérations préliminaires & autorisation de démarrage', [
      _note('pp_instr', 'Instructions générales — vérifications avant démarrage', TXT_INSTRUCTIONS_GEN),
      _note('pp_secu', 'Consignes de sécurité obligatoires', TXT_SECURITE),
      _note('pp_prec', 'Précautions de production', TXT_PRECAUTIONS),
      _txt('pp_date', 'Date de début de pesée', 'date', true),
      _txt('pp_salle', 'N° de salle de pesée'),
      _txt('pp_heure', 'Heure de début'),
      _num('pp_temp', 'Température de la salle', '°C', 15, 25, true),
      _num('pp_hr', 'Humidité relative', '%', null, 60, true),
      _num('pp_dp', 'Différentiel de pression (ΔP)', 'mmH₂O', 1, null, true),
      _chk('pp_vl', 'Vide de ligne — autorisation de démarrage', 'cnc', [
        'Instructions générales',
        'Consignes de sécurité',
        'Conditions environnementales',
        'Nettoyage local & équipements'
      ]),
      _chk('pp_prelim', 'Vérification préliminaire', 'oui', [
        "Présence de tous les documents de l'instruction de fabrication",
        'Habillage spécifique / réglementaire du personnel',
        'Aptitude hygiène du personnel vérifiée (selon procédure)'
      ]),
      _txt('pp_sup_visa', 'Démarrage autorisé — Superviseur Fabrication (date / heure / visa)'),
      _txt('pp_aq_visa', 'Démarrage autorisé — AQ Process (date / heure / visa)')
    ], 2),
    _sec('p_net', '2 · Vérification du nettoyage (étiquettes « nettoyé »)', [
      _chk('net_chk', 'Étiquettes « nettoyé » collées', 'oui', [
        'Salle de pesée',
        'Flux laminaire',
        'Balances',
        'Matériels de pesée'
      ]),
      _txt('net_visa', 'Vérifié par — Date & Visa')
    ], 2),
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
      _chk('eq_chk', 'Balances — contrôles à vide / qualification / parties vitrées', 'cnc', [
        'Balance Mettler Toledo MS 3200LL/01 (PR042) — Fonctionnement à vide',
        'PR042 — Statut qualification / calibration',
        'PR042 — État des parties vitrées',
        'Balance de pesée Mettler Toledo (PR325) — Fonctionnement à vide',
        'PR325 — Statut qualification / calibration',
        'PR325 — État des parties vitrées'
      ]),
      _txt('eq_visa', 'Fait par / Vérifié par — Date & Visa')
    ], 2),
    _sec('p_etal', '5 · Vérification de l\'étalonnage des balances', [
      _chk('etal_chk', 'Calibrage journalier effectué', 'oui', [
        'Balance PR042',
        'Balance PR325'
      ]),
      _txt('etal_visa', 'Vérifié par — Date & Visa')
    ], 2),
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
    _sec('p_pa', '9 · Pesée des principes actifs', [
      _txt('pa_hdeb', 'Heure de début de pesée'),
      _txt('pa_des', 'Désignation du principe actif'),
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
    ], 2),
    _sec('p_exc', '10 · Pesée des excipients', [
      _tab('exc_tab', 'Excipients — une ligne par excipient ; renseigner la quantité théorique (kg/lot) selon la formule du produit', [
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
      _chk('bil_docs', 'Documents joints', 'oui', [
        'Bon de commande',
        'Bon de retours interne',
        'Bon de retour final',
        "Bon d'avarie"
      ]),
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
    ], 2),
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

// =====================================================================
//  Phase TAMISAGE & MÉLANGE (IF PFLDM103, pages 25-41) — mêmes spéc. site
//  (T° 15-25 °C, HR ≤60 %, ΔP ≥1 mmH₂O ; humidité résiduelle < 3 %).
// =====================================================================
const SECTIONS_TM = [
  _sec('tm_prelim', '1 · Opérations préliminaires & autorisation de démarrage', [
    _note('tm_instr', 'Opérations préliminaires — vérifications avant démarrage', `• Vide de ligne : machines et locaux libérés des matériaux et documents du produit précédent (selon check-list vide de ligne).
• Nettoyage des équipements et locaux vérifié ; étiquettes de nettoyage et logs book renseignés.
• Local et machine identifiés (fiches « utilisation salle » et « utilisation machine »).
• Nettoyage des pièces mobiles vérifié ; étiquettes « Nettoyé » jointes à l'IF.
• Vérification journalière des balances effectuée.
• Propreté et intégrité des contenants MP réceptionnés vérifiées.
• Conditions d'ambiance du local vérifiées : température (°C), HR (%), ΔP.
• Attendre l'autorisation AQ avant de procéder au tamisage et mélange.`),
    _txt('tm_date', 'Date de début', 'date', true),
    _txt('tm_salle', 'N° de salle'),
    _txt('tm_heure', 'Heure de début'),
    _num('tm_temp', 'Température de la salle', '°C', 15, 25, true),
    _num('tm_hr', 'Humidité relative', '%', null, 60, true),
    _num('tm_dp', 'Différentiel de pression (ΔP)', 'mmH₂O', 1, null, true),
    _chk('tm_vl', 'Vide de ligne — autorisation de démarrage', 'cnc', [
      'Instructions générales', 'Consignes de sécurité', 'Conditions environnementales', 'Nettoyage local & équipements'
    ]),
    _chk('tm_prel', 'Vérification préliminaire', 'oui', [
      "Présence de tous les documents de l'instruction de fabrication",
      'Habillage spécifique / réglementaire du personnel',
      'Aptitude hygiène du personnel vérifiée (selon procédure)'
    ]),
    _txt('tm_sup', 'Démarrage autorisé — Superviseur Fabrication (date / heure / visa)'),
    _txt('tm_aq', 'Démarrage autorisé — AQ Process (date / heure / visa)')
  ], 2),
  _sec('tm_net', '2 · Vérification du nettoyage (étiquettes « nettoyé »)', [
    _chk('tmnet_chk', 'Étiquettes « nettoyé » collées', 'oui', ['Salle de mélange', 'Équipements', 'Pièces mobiles']),
    _pj('tmnet_pj', 'Étiquettes « nettoyé » (scan)'),
    _txt('tmnet_visa', 'Vérifié par — Date & Visa')
  ], 2),
  _sec('tm_ope', '3 · Liste des opérateurs de tamisage & mélange', [
    _tab('tmope_tab', 'Opérateurs — Shift 01 : 06-14h · 02 : 14-22h · 03 : 22-06h', [
      _ct('tmop_shift', 'N° Shift'), _ct('tmop_poste', 'Poste'), _ct('tmop_nom', 'Nom & prénom'),
      _ct('tmop_date', 'Date'), _ct('tmop_visa', 'Visa'), _ct('tmop_verif', 'Vérifié par (Date & Visa)')
    ])
  ]),
  _sec('tm_equip', '4 · Vérification des équipements utilisés', [
    _chk('tmeq_chk', 'Équipements — qualification/calibration & parties vitrées', 'cnc', [
      'Mélangeur en V MAKINA 100L (PR210) — Qualification / calibration',
      'PR210 — État des parties vitrées',
      'Mélangeur en V MPY 400 (PR032) — Qualification / calibration',
      'PR032 — État des parties vitrées',
      'Calibreur CPS Line (PR036/PR097) — Qualification / calibration',
      'PR036/PR097 — État des parties vitrées',
      'Kevin super mill (PR310/PR311) — Qualification / calibration',
      'PR310/PR311 — État des parties vitrées'
    ]),
    _txt('tmeq_visa', 'Fait par / Vérifié par — Date & Visa')
  ], 2),
  _sec('tm_etal', "5 · Vérification de l'étalonnage des balances", [
    _tab('tmetal_tab', 'Balances — calibrage', [
      _ct('tmet_bal', 'Balance'), _ct('tmet_code', 'Code'), _coo('tmet_cal', 'Calibrage effectué'),
      _ct('tmet_date', 'Date'), _ct('tmet_visa', 'Date & Visa')
    ])
  ]),
  _sec('tm_cond', '6 · Conditions T° / HR / ΔP au cours du process', [
    _tab('tmcond_tab', 'Relevés — tous les 30 min pendant le mélange', [
      _ct('tmco_date', 'Date'), _ct('tmco_heure', 'Heure'),
      _cn('tmco_t', 'Température', '°C', 15, 25), _cn('tmco_hr', 'Humidité', '%', null, 60), _cn('tmco_dp', 'ΔP', 'mmH₂O', 1, null),
      _ct('tmco_salle', 'N° salle'), _ct('tmco_visa', 'Visa')
    ])
  ]),
  _sec('tm_rec', '7 · Réception des matières', [
    _note('tmrec_note', 'Réception', "Vérifier l'intégrité des contenants réceptionnés. La vérification doit être effectuée avant le début du processus de mélange."),
    _tab('tmrec_tab', 'Matières (articles de la formule)', [
      _ct('tmre_art', 'Matière'), _ct('tmre_code', 'Code interne'), _ct('tmre_lot', 'N° lot interne'),
      _coo('tmre_int', 'Contenant intègre / scellé / identifié'), _coo('tmre_etiq', 'Étiquette pesée présente'),
      _cn('tmre_theo', 'Qté théorique', 'kg'), _cn('tmre_liv', 'Qté livrée', 'kg'), _ct('tmre_visa', 'Vérifié par')
    ]),
    _num('tmrec_tot', 'Quantité totale', 'kg')
  ]),
  _sec('tm_vfonc', "8 · Vérification du fonctionnement de l'équipement avant mélange", [
    _txt('tmvf_date', 'Date de début', 'date'), _txt('tmvf_heure', 'Heure'),
    _chk('tmvf_chk', 'Fonctionnement à vide des équipements', 'cnc', [
      'Mélangeur en V MAKINA 100L (PR210)', 'Mélangeur en V MPY 400 (PR032)',
      'Calibreur CPS Line (PR036/PR097)', 'Kevin super mill (PR310/PR311)'
    ]),
    _txt('tmvf_visa', 'Fait par / Vérifié par — Date & Visa')
  ], 2),
  _sec('tm_m01', '9 · Mélange 01 — Mélangeur en V MAKINA 100L (PR210)', [
    _txt('tmm01_date', 'Date de début', 'date'), _txt('tmm01_heure', 'Heure de début'),
    _chk('tmm01_mat', 'Matières transférées', 'oui', ['Rosuvastatine calcium', 'Crospovidone (POLYPLASDONE XL)']),
    _chk('tmm01_op', 'Avant démarrage & mélange', 'oui', [
      'Fermeture des vannes du mélangeur', 'Fermeture des dispositifs de sécurité', 'Mélangeur actionné 10 min à 10 RPM'
    ]),
    _txt('tmm01_deb', 'Début du mélange (heure)'), _txt('tmm01_fin', 'Fin du mélange (heure)'), _num('tmm01_duree', 'Durée réelle du mélange', 'min')
  ], 2),
  _sec('tm_tam', '10 · Tamisage (tamis 0,8 mm)', [
    _note('tmtam_note', 'Tamisage', 'Vérifier visuellement le tamis avant le lancement. Procéder au tamisage du Mélange 01 avec un tamis de 0,8 mm.'),
    _oo('tmtam_ok', 'Tamisage du Mélange 01 réalisé'),
    _num('tmtam_maille', 'Ouverture de maille du tamis (consigne 0,8)', 'mm'),
    _num('tmtam_vit', 'Vitesse du calibreur (consigne 800)', 'RPM'),
    _txt('tmtam_deb', 'Heure de début'), _txt('tmtam_fin', 'Heure de fin'), _num('tmtam_duree', 'Durée du tamisage', 'min'),
    _txt('tmtam_visa', 'Date & Visa Opérateur / Superviseur')
  ], 2),
  _sec('tm_m02', '11 · Mélange 02 — Mélangeur en V MPY 400 (PR032)', [
    _txt('tmm02_date', 'Date de début', 'date'), _txt('tmm02_heure', 'Heure de début'),
    _chk('tmm02_mat', "Matières transférées (dans l'ordre)", 'oui', [
      'Mélange 01', 'Cellulose microcristalline PH102', 'Lactose monohydrate (Flowlac 100)', 'Calcium phosphate tribasic'
    ]),
    _chk('tmm02_op', 'Avant démarrage & mélange', 'oui', [
      'Fermeture des vannes du mélangeur', 'Fermeture des dispositifs de sécurité', 'Mélangeur actionné 20 min à 10 RPM'
    ]),
    _txt('tmm02_deb', 'Début du mélange (heure)'), _txt('tmm02_fin', 'Fin du mélange (heure)'), _num('tmm02_duree', 'Durée réelle du mélange', 'min')
  ], 2),
  _sec('tm_mf', '12 · Mélange final — Lubrification (MPY 400 PR032)', [
    _txt('tmmf_date', 'Date de début', 'date'), _txt('tmmf_heure', 'Heure de début'),
    _chk('tmmf_mat', 'Matières transférées', 'oui', ['Mélange 02', 'Stéarate de magnésium (LIGAMED MF-2-V)']),
    _chk('tmmf_op', 'Avant démarrage & mélange', 'oui', [
      'Fermeture des vannes du mélangeur', 'Fermeture des dispositifs de sécurité', 'Mélangeur actionné 5 min à 10 RPM'
    ]),
    _txt('tmmf_deb', 'Début du mélange (heure)'), _txt('tmmf_fin', 'Fin du mélange (heure)'), _num('tmmf_duree', 'Durée réelle du mélange', 'min'),
    _pj('tmmf_ticket', 'Ticket de pesée du mélange final (scan)')
  ], 2),
  _sec('tm_ipc', '13 · Contrôle IPC — humidité résiduelle (fin de mélange)', [
    _note('tmipc_note', 'Contrôle IPC humidité résiduelle', "Prélever 5 g du granulé. Transférer à l'AQ IPC : dessiccateur IR à 105 °C, mode auto. Attendre le résultat IPC avant de poursuivre. Joindre la Fiche IPC à l'IF."),
    _num('tmipc_hum', 'Humidité résiduelle du granulé', '%', null, 3),
    _txt('tmipc_visa', 'Visa AQ IPC — Date et Heure'),
    _pj('tmipc_pj', 'Fiche IPC humidité (scan)')
  ], 2),
  _sec('tm_cq', '14 · Contrôle du mélange (CQ) & fin', [
    _ooi('tmcq_req', "Contrôle du mélange (CQ) requis ? (si Oui : demande d'échantillonnage réf. CQ-007)"),
    _ooi('tmcq_bloq', 'Analyse bloquante ? (si Oui : attendre les résultats avant la compression)'),
    _txt('tmcq_obs', 'Observation'),
    _txt('tmcq_fin', 'Fin — Date / Heure / Fait par / Vérifié par')
  ], 2),
  _sec('tm_fiches', '15 · Fiches utilisation (salle / machine)', [
    _pj('tmf_salle', 'Fiche utilisation salle (scan)'),
    _pj('tmf_machine', 'Fiche utilisation machine (scan)'),
    _txt('tmf_visa', 'Vérifié par — Date & Visa')
  ], 2),
  _sec('tm_bilan', '16 · Bilan de la phase tamisage & mélange (rendement)', [
    _note('tmbil_note', 'Calcul du rendement', 'A₂ = P_th mél − (P_mél + C_mél) ; R2 (%) = (P_mél + C_mél) × 100 / P_th mél. Norme du rendement : 99–100 %.'),
    _num('tmbil_pth', 'Poids théorique du mélange (P_th)', 'kg'),
    _num('tmbil_pmel', 'Poids du mélange obtenu (P_mél)', 'kg'),
    _num('tmbil_cmel', 'Poids échantillon de contrôle (C_mél)', 'kg'),
    _num('tmbil_av', 'Avarie engendrée (A₂)', 'kg'),
    _num('tmbil_rdt', 'Rendement R2', '%', 99, 100),
    _txt('tmbil_just', 'Justification de toute avarie hors normes'),
    _txt('tmbil_visa', 'Date / Visa Responsable Fabrication')
  ], 2),
  _sec('tm_inc', '17 · Suivi des incidents et arrêts', [
    _tab('tminc_tab', 'Incidents / arrêts', [
      _ct('tmin_date', 'Date'), _ct('tmin_harr', "Heure d'arrêt"), _ct('tmin_sac', 'N° de sac'),
      _ct('tmin_motif', 'Motif'), _ct('tmin_action', 'Action corrective'),
      _ct('tmin_ddem', 'Date de démarrage'), _ct('tmin_hdem', 'Heure de démarrage'), _ct('tmin_visa', 'Fait par (Visa)')
    ])
  ])
]

// Associe une phase à chaque section, puis assemble le modèle complet multi-phases.
const _phase = (sections, phase) => sections.map(s => ({ ...s, phase }))
export const FORMULAIRE_DEFAUT = {
  sections: [
    ..._phase(SECTIONS_PESEE, 'Pesée'),
    ..._phase(SECTIONS_TM, 'Tamisage & Mélange')
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
    // Formulaire de conduite du lot — modèle Pesée par défaut (partagé)
    formulaire: FORMULAIRE_DEFAUT
  }
}
