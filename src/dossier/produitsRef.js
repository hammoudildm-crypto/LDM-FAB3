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
const _calc = (id, label, formule, unite = '', min = null, max = null) => ({ id, label, type: 'calcul', unite, min, cible: null, max, obligatoire: false, attendu: 'Conforme', options: ['Conforme', 'Non conforme'], colonnes: [], contenu: '', formule })
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
      _note('bil_rnote', 'Rendement de la pesée (automatique)', 'Saisir le poids théorique total à peser (P_th) et le poids total réellement pesé (P_pesé) : l\'avarie et le rendement se calculent automatiquement. La norme de rendement est indicative (modifiable via le Constructeur).'),
      _num('bil_pth', 'Poids théorique total à peser (P_th)', 'kg'),
      _num('bil_ppes', 'Poids total pesé (P_pesé)', 'kg'),
      _calc('bil_av', 'Avarie engendrée = P_th − P_pesé', '{bil_pth} - {bil_ppes}', 'kg'),
      _calc('bil_rdt', 'Rendement de la pesée = P_pesé × 100 / P_th', '{bil_ppes} * 100 / {bil_pth}', '%', 99, 100),
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
    _note('tmbil_note', 'Calcul du rendement (automatique)', 'Saisir P_th, P_mél et C_mél : l\'avarie A₂ et le rendement R2 se calculent automatiquement.\nA₂ = P_th − (P_mél + C_mél) ; R2 (%) = (P_mél + C_mél) × 100 / P_th. Norme du rendement : 99–100 %.'),
    _num('tmbil_pth', 'Poids théorique du mélange (P_th)', 'kg'),
    _num('tmbil_pmel', 'Poids du mélange obtenu (P_mél)', 'kg'),
    _num('tmbil_cmel', 'Poids échantillon de contrôle (C_mél)', 'kg'),
    _calc('tmbil_av', 'Avarie engendrée (A₂) = P_th − (P_mél + C_mél)', '{tmbil_pth} - ({tmbil_pmel} + {tmbil_cmel})', 'kg'),
    _calc('tmbil_rdt', 'Rendement R2 = (P_mél + C_mél) × 100 / P_th', '({tmbil_pmel} + {tmbil_cmel}) * 100 / {tmbil_pth}', '%', 99, 100),
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

// =====================================================================
//  Phase COMPRESSION (IF PFLDM103, pages 42-71) — modélisée à l'identique.
//  Spéc. site : T° 15-25 °C, HR ≤60 %, ΔP ≥1 mmH₂O. Comprimeuse FETTE 1200i.
//  Comprimé cible 150,00 mg · masse moyenne 145,50-154,50 mg · dureté 4-15 Kp.
//  Section 24 : rendement AUTOMATIQUE (P_mél sec.10, P_CP sec.23, MMS sec.18).
// =====================================================================
const SECTIONS_COMPRESSION = [
  _sec('cp_prelim', '1 · Opérations préliminaires & autorisation de démarrage', [
    _note('cpp_instr', 'Opérations préliminaires — vérifications avant démarrage', `• Vide de ligne : machines et locaux libérés des matériaux et documents du produit précédent (selon check-list vide de ligne).
• Nettoyage des équipements et locaux vérifié ; étiquettes de nettoyage et logs book renseignés.
• Local et machine identifiés (fiches « utilisation salle » et « utilisation machine ») ; étiquettes « Nettoyé » et « Utilisation salle » collées.
• Nettoyage des pièces mobiles vérifié ; étiquettes « Nettoyé » jointes à l'IF.
• Vérification journalière des balances effectuée.
• Propreté et intégrité des contenants MP réceptionnés vérifiées.
• Conditions d'ambiance du local vérifiées : température (°C), HR (%), ΔP.
• En cas d'anomalies : stopper l'opération, alerter le responsable, reporter l'évènement sur la fiche incidents.
• Attendre l'autorisation AQ avant de procéder à la compression.`),
    _note('cpp_secu', 'Consignes de sécurité obligatoires', TXT_SECURITE),
    _note('cpp_prec', 'Précautions de production', TXT_PRECAUTIONS),
    _txt('cpp_date', 'Date de début de compression', 'date', true),
    _txt('cpp_salle', 'N° de salle de compression'),
    _txt('cpp_heure', 'Heure de début'),
    _num('cpp_temp', 'Température de la salle', '°C', 15, 25, true),
    _num('cpp_hr', 'Humidité relative', '%', null, 60, true),
    _num('cpp_dp', 'Différentiel de pression (ΔP)', 'mmH₂O', 1, null, true)
  ], 2),
  _sec('cp_net', '2 · Vérification du nettoyage des équipements et locaux', [
    _note('cnet_note', 'Étiquettes de nettoyage', 'Remplacer les étiquettes « Nettoyé » salle et machine par les fiches « utilisation salle » et « utilisation machine ». Coller les étiquettes « Nettoyée » dans l\'instruction de fabrication.'),
    _chk('cnet_chk', 'Étiquettes « nettoyé » collées', 'oui', ['Salle de compression', 'Équipements', 'Pièces mobiles']),
    _pj('cnet_pjsalle', 'Étiquette nettoyée de la salle de compression (scan)'),
    _pj('cnet_pjequip', 'Étiquettes nettoyée des équipements (scan)'),
    _pj('cnet_pjmob', 'Étiquettes nettoyée des pièces mobiles (scan)'),
    _txt('cnet_visa', 'Vérifié par — Date & Visa')
  ], 2),
  _sec('cp_env', '3 · Conditions environnementales avant démarrage', [
    _note('cenv_note', 'Contrôle T° / HR / ΔP', 'Relever les données avant démarrage de la compression.'),
    _tab('cenv_tab', 'Contrôle de la température, de l\'humidité relative et de la différence de pression', [
      _ct('cen_etape', 'Étape'), _ct('cen_salle', 'N° salle'), _ct('cen_heure', 'Heure'),
      _cn('cen_t', 'T°C [15-25]', '°C', 15, 25), _cn('cen_hr', 'HR% ≤ 60', '%', null, 60), _cn('cen_dp', 'ΔP ≥ 1', 'mmH₂O', 1, null),
      _ct('cen_vop', 'Date/Visa Opérateur'), _ct('cen_vverif', 'Date/Visa Vérificateur')
    ])
  ]),
  _sec('cp_autor', '4 · Autorisation de démarrage de la compression', [
    _chk('caut_chk', 'Vide de ligne — conformité (joindre la checklist vide de ligne à l\'IF)', 'cnc', [
      'Instructions générales', 'Consignes de sécurité', 'Conditions environnementales', 'Nettoyage local et équipements'
    ]),
    _txt('caut_sup', 'Démarrage autorisé — Superviseur Fabrication (date / heure / visa)'),
    _txt('caut_aq', 'Démarrage autorisé — AQ Process (date / heure / visa)')
  ], 2),
  _sec('cp_vprel', '5 · Vérification préliminaire', [
    _chk('cvpr_chk', 'Vérifications à effectuer', 'oui', [
      'Présence de tous les documents de l\'instruction de fabrication',
      'Habillage spécifique / réglementaire du personnel',
      'Absence de plaies ouvertes ou maladies contagieuses chez le personnel'
    ]),
    _txt('cvpr_visa', 'Date / Visa')
  ], 2),
  _sec('cp_ope', '6 · Liste des opérateurs de compression', [
    _tab('cope_tab', 'Opérateurs — Shift 01 : 06-14h · 02 : 14-22h · 03 : 22-06h', [
      _ct('cop_shift', 'N° Shift'), _ct('cop_poste', 'Poste'), _ct('cop_nom', 'Nom & prénom'),
      _ct('cop_date', 'Date'), _ct('cop_visa', 'Visa'), _ct('cop_verif', 'Vérifier par (Date & Visa)')
    ])
  ]),
  _sec('cp_equip', '7 · Vérification des équipements utilisés', [
    _note('cequ_note', 'Équipements de compression', 'Comprimeuse FETTE 1200i (PR057 / PR012 / PR205) · Dépoussiéreur (PR013/01 · PR013/02 · PR301) · Détecteur de métaux (PR301-a · PR057-a · PR205-a) · Chaîne élévatrice (PR010 · PR231 · PR232). Statuts : C / NC / NA.'),
    _tab('cequ_tab', 'Équipements — qualification/calibration & parties vitrées', [
      _ct('ceq_nom', 'Équipement'), _ct('ceq_code', 'Code'),
      _ccnc('ceq_qual', 'Statut qualification / calibration'), _ccnc('ceq_vitr', 'État des parties vitrées'),
      _ct('ceq_fait', 'Fait par / Date & Visa'), _ct('ceq_verif', 'Vérifié par / Date & Visa'), _ct('ceq_obs', 'Observation')
    ])
  ]),
  _sec('cp_etal', '8 · Vérification de l\'étalonnage des balances', [
    _tab('cetal_tab', 'Balances — calibrage', [
      _ct('cet_bal', 'Balance'), _ct('cet_code', 'Code'), _coo('cet_cal', 'Calibrage effectué'),
      _ct('cet_date', 'Date'), _ct('cet_vop', 'Date/Visa Opérateur'), _ct('cet_vverif', 'Date/Visa Vérificateur'), _ct('cet_obs', 'Observation')
    ])
  ]),
  _sec('cp_cond', '9 · Conditions T°C / ΔP / HR% au cours du process', [
    _note('ccond_note', 'Fréquence', 'Relever les données toutes les 30 min pendant la compression.'),
    _tab('ccond_tab', 'Relevés en cours de compression', [
      _ct('cco_date', 'Date'), _ct('cco_heure', 'Heure'),
      _cn('cco_t', 'Température 15≤T≤25', '°C', 15, 25), _cn('cco_hr', 'Humidité ≤60', '%', null, 60), _cn('cco_dp', 'ΔP ≥1', 'mmH₂O', 1, null),
      _ct('cco_salle', 'N° salle'), _ct('cco_fait', 'Fait par / Visa'), _ct('cco_verif', 'Vérifié par / Date & Visa')
    ])
  ]),
  _sec('cp_recmel', '10 · Réception du mélange finale', [
    _note('crec_note', 'Réception', 'Vérifier l\'intégrité des contenants réceptionnés. La vérification doit être effectuée avant le début du processus de compression.'),
    _tab('crec_tab', 'Mélange final réceptionné', [
      _ct('cre_mat', 'Matière'), _ct('cre_lot', 'N° lot Produit Fini'),
      _coo('cre_int', 'Contenant intègre scellé et identifié'), _coo('cre_etiq', 'Présence étiquette pesée'),
      _cn('cre_qte', 'Quantité livrée', 'kg'), _ct('cre_fait', 'Fait par / Date & Visa'), _ct('cre_verif', 'Vérifié par / Date & Visa')
    ]),
    _num('crec_pmel', 'Quantité Totale reçue (P_mél)', 'kg')
  ]),
  _sec('cp_vfonc', '11 · Vérification du fonctionnement de l\'équipement avant compression', [
    _txt('cvf_date', 'Début — Date', 'date'), _txt('cvf_heure', 'Heure'),
    _note('cvf_note', 'Fonctionnement à vide', 'Comprimeuse FETTE 1200i · Dépoussiéreur · Détecteur de métaux · Chaîne élévatrice (codes section 7).'),
    _tab('cvf_tab', 'Fonctionnement à vide des équipements', [
      _ct('cvf_nom', 'Équipement'), _ct('cvf_code', 'Code'), _ccnc('cvf_fonc', 'Fonctionnement à vide'),
      _ct('cvf_fait', 'Fait par / Date'), _ct('cvf_verif', 'Vérifié par / Date'), _ct('cvf_obs', 'Observation')
    ])
  ]),
  _sec('cp_detmet', '12 · Vérification de la sensibilité du détecteur de métaux', [
    _note('cdet_note', 'Mode opératoire', `Fréquence : à chaque démarrage de compression.
Faire passer une par une les 3 billes tests dans le détecteur de métaux :
1- NFE 0,5 mm : métaux non ferreux
2- FE 0,3 mm : métaux ferreux
3- SS 304 0,5 mm : inox (stainless steel)
Norme : rejet des billes par le détecteur. En cas de non-rejet d'une bille, noter NC dans « Résultat » et prévenir l'agent de maîtrise.`),
    _tab('cdet_tab', 'Résultat du test (bille éjectée par le détecteur)', [
      _ct('cde_test', 'Test (NFE / FE / SS 304)'), _coo('cde_res', 'Bille éjectée'), _ct('cde_fait', 'Fait par')
    ]),
    _txt('cdet_sup', 'Superviseur Fabrication — Date / Heure / Visa')
  ]),
  _sec('cp_poincon', '13 · Poinçons avant montage & sensibilité du système d\'éjection', [
    _tab('cpoi_tab', 'Vérification des poinçons avant montage', [
      _ct('cpo_param', 'Paramètre'), _ct('cpo_spec', 'Spécification'), _ccnc('cpo_conf', 'Conformité'),
      _ct('cpo_fait', 'Fait par'), _ct('cpo_verif', 'Vérifié par')
    ]),
    _note('cpoi_note', 'Spécifications poinçons', 'Dimensions : Diamètre 7 mm · Aspect : rond concave sans trait de sécabilité sur les deux faces · Came de sur-remplissage : 8 mm.'),
    _note('cpoi_ej', 'Sensibilité du système d\'éjection de la comprimeuse', `Fréquence : à chaque démarrage de la compression du 1er lot de campagne ; après intervention maintenance ou réglage ayant une répercussion sur la barrette d'éjection.
Critère d'acceptabilité : la machine affiche un surpassement de force de compression durant tout le test sur le poste modifié ; tous les comprimés non conformes du poste modifié doivent être éjectés.
Vérifier à chaque démarrage de campagne que le nombre de postes actifs sur le panel correspond au nombre de poinçons présents sur tourelle.`),
    _num('cpoi_postes', 'Nombre de postes actifs', ''),
    _tab('cpoi_ejtab', 'Test d\'éjection', [
      _ct('cpe_dh', 'Date et heure'), _ct('cpe_motif', 'Motif du test'), _ct('cpe_poste', 'N° du poste utilisé'),
      _ct('cpe_vit', 'Vitesse tourelle au test'), _ccnc('cpe_res', 'Résultats'), _ct('cpe_fait', 'Fait par')
    ]),
    _txt('cpoi_sup', 'Superviseur Fabrication — Date / Heure / Visa')
  ]),
  _sec('cp_demarr', '14 · Démarrage du processus — réglage des paramètres de compression', [
    _num('cdm_fc', 'Force de compression', 'kN', 5.0, 6.0),
    _num('cdm_fpc', 'Force de pré-compression', 'kN', 1.5, 3.0),
    _num('cdm_vit', 'Vitesse fill-o-matic', 'RPM', 30, 50),
    _num('cdm_htc', 'Hauteur tranche compression', 'mm', 1.8, 2.9),
    _num('cdm_htpc', 'Hauteur tranche pré-compression', 'mm', 1.5, 4.0),
    _num('cdm_vol', 'Volume de remplissage', 'mm', 6.0, 8.0),
    _num('cdm_cad', 'Cadence', 'x1000 cps/h', 50, 70),
    _num('cdm_srel', 'S-rel', '%', null, 10),
    _txt('cdm_fait', 'Fait par / Vérifié par — Date & Visa')
  ], 2),
  _sec('cp_physiq', '15 · Paramètres physiques du comprimé & montage des poinçons', [
    _note('cph_spec', 'Spécifications du comprimé', 'Masse cible : 150,00 mg · Forme : comprimé blanc rond biconvexe sans trait de sécabilité sur les deux faces · Épaisseur : 3,5–3,8 mm · Couleur : blanc · Dureté : 4–15 Kp · Diamètre : 7 mm · Friabilité : ≤ 1 % de perte de masse, pas de comprimé cassé · Désagrégation : ≤ 15 min · Configuration des pales : hélice carrée.'),
    _note('cph_lanc', 'Lancement de la compression', 'Vérifier le montage et l\'intégrité des poinçons en prélevant la production de 10 tours successifs de la machine. Contrôler l\'absence de défauts de forme dus à un poinçon défectueux. Faire les contrôles physiques des comprimés au lancement.'),
    _chk('cph_chk', 'Contrôle au montage', 'cnc', ['Montage des poinçons', 'Intégrité des poinçons', 'Absence de défauts de forme']),
    _txt('cph_fait', 'Fait par / Vérifié par — Date & Visa')
  ]),
  _sec('cp_lanc', '16 · Contrôle des comprimés au lancement', [
    _note('cla_note', 'Échantillonnage', 'Prélever 71 comprimés : aspect (21), épaisseur Min–Max (21), masse moyenne (20), masse individuelle/uniformité (20), dureté (21), friabilité (44), désagrégation (06). Reporter les résultats ci-dessous et attendre l\'autorisation de démarrage. Toute non-conformité impose un réglage machine et un nouveau lancement.'),
    _oc('cla_aspect', 'Aspect (blanc, rond, biconvexe ; sans points noirs, marbrures, bavures, collage, clivage)'),
    _num('cla_mm', 'Masse moyenne (20 cp)', 'mg', 145.5, 154.5),
    _num('cla_miMin', 'Masse individuelle — minimale observée', 'mg', 142.5, null),
    _num('cla_miMax', 'Masse individuelle — maximale observée', 'mg', null, 157.5),
    _num('cla_epMin', 'Épaisseur — minimale', 'mm', 3.5, null),
    _num('cla_epMax', 'Épaisseur — maximale', 'mm', null, 3.8),
    _num('cla_dur', 'Dureté', 'Kp', 4, 15),
    _num('cla_fm1', 'Friabilité — masse avant test M1', 'g'),
    _num('cla_fm2', 'Friabilité — masse après test M2', 'g'),
    _calc('cla_fri', 'Friabilité = (M1 − M2) × 100 / M1', '({cla_fm1} - {cla_fm2}) * 100 / {cla_fm1}', '%', null, 1),
    _num('cla_desag', 'Désagrégation', 'min', null, 15),
    _txt('cla_fait', 'Fait par / Vérifié par — Date & Visa')
  ], 2),
  _sec('cp_autor2', '17 · Autorisation de démarrage de la compression', [
    _note('cau2_note', 'Démarrage de la compression autorisé', 'Après contrôles de lancement conformes, le démarrage de la compression est autorisé.'),
    _txt('cau2_sup', 'Superviseur Fabrication — Date / Heure / Visa'),
    _txt('cau2_aq', 'AQ Process — Date / Heure / Visa'),
    _pj('cau2_pj', 'Étiquettes « identification » du produit vrac (scan)')
  ], 2),
  _sec('cp_ipcmm', '18 · Contrôle en cours de process — masse moyenne & aspect', [
    _note('cim_note', 'Masse moyenne — zones & MMS', `Contrôles toutes les 15 min (masse moyenne & aspect).
Zone de travail : 145,50 – 154,50 mg (cible 150,00 mg ± 3 %).
Zone de réglage : 142,50 mg (−5 %) à 157,50 mg (+5 %).
Zone d'arrêt : < 142,50 mg ou > 157,50 mg.
Masse moyenne statistique MMS = (M₁ + M₂ + … + Mᵢ) / n  (n = nombre de contrôles).`),
    _tab('cim_tab', 'Suivi masse moyenne & aspect (chaque 15 min)', [
      _ct('cim_heure', 'Heure'), _cn('cim_mm', 'Masse moyenne', 'mg', 145.5, 154.5), _coc('cim_aspect', 'Aspect'),
      _ct('cim_cont', 'Contenant N°'), _cn('cim_cad', 'Cadence (x1000 cp/h)', '', 50, 70),
      _ct('cim_fait', 'Fait par'), _ct('cim_verif', 'Vérifié par')
    ]),
    _num('cim_mms', 'Masse moyenne statistique MMS (fin de compression)', 'mg', 145.5, 154.5),
    _txt('cim_visa', 'Visa AQ Process')
  ]),
  _sec('cp_ipcep', '19 · Contrôle en cours de process — épaisseur', [
    _note('cie_note', 'Fréquence', 'Contrôles à chaque lancement, toutes les 30 min. Valeur unitaire : 3,5–3,8 mm (21 comprimés).'),
    _tab('cie_tab', 'Suivi épaisseur (chaque 30 min)', [
      _ct('cie_date', 'Date'), _ct('cie_heure', 'Heure'),
      _cn('cie_min', 'Épaisseur Min', 'mm', 3.5, null), _cn('cie_max', 'Épaisseur Max', 'mm', null, 3.8),
      _ct('cie_cont', 'Contenant N°'), _ct('cie_fait', 'Fait par')
    ]),
    _txt('cie_visa', 'Vérifié par — Date & Visa')
  ]),
  _sec('cp_nus', '20 · Réception des comprimés nus (CQ)', [
    _ooi('cnus_req', 'Contrôle des comprimés nus requis CQ ? (si Oui : demande d\'échantillonnage réf. CQ-SOP-007)'),
    _ooi('cnus_bloq', 'Analyse bloquante ? (si Oui : attendre les résultats avant le conditionnement)'),
    _txt('cnus_obs', 'Observation'),
    _txt('cnus_fin', 'Fin — Date / Heure / Fait par / Vérifié par')
  ], 2),
  _sec('cp_chall', '21 · Suivi des challenge test détecteur de métaux', [
    _note('cch_note', 'Fréquence', 'Contrôles en début, milieu et fin de compression. Billes : NFE 0,5 mm · FE 0,3 mm · SS 304 0,5 mm.'),
    _tab('cch_tab', 'Challenge test (début / milieu / fin)', [
      _ct('cch_moment', 'Moment (Début/Milieu/Fin)'), _ct('cch_dh', 'Date / Heure'), _ct('cch_test', 'Test (NFE/FE/SS)'),
      _coo('cch_res', 'Bille éjectée'), _ct('cch_fait', 'Fait par'), _ct('cch_verif', 'Vérifié par')
    ])
  ]),
  _sec('cp_inc', '22 · Suivi des incidents et des arrêts de la comprimeuse', [
    _tab('cinc_tab', 'Incidents / arrêts', [
      _ct('cin_date', 'Date'), _ct('cin_harr', 'Heure d\'arrêt'), _ct('cin_sac', 'N° saccueuse / contenant'),
      _ct('cin_motif', 'Motif'), _ct('cin_action', 'Action corrective'),
      _ct('cin_ddem', 'Date de démarrage'), _ct('cin_hdem', 'Heure de démarrage'), _ct('cin_visa', 'Fait par / Visa')
    ]),
    _txt('cinc_visa', 'Vérifié par / Visa — Date')
  ]),
  _sec('cp_bilan', '23 · Bilan de la compression', [
    _note('cbil_note', 'Bilan', 'Tarer le poids des sacs. Récupérer les comprimés dans des sacs PE propres (identifier chaque sac). Peser le sac + comprimés (poids brut). Poids net = brut − tare. Transférer chaque sac dans un fût propre identifié.'),
    _tab('cbil_tab', 'Bilan par fût', [
      _ct('cbi_fut', 'Fût N°'), _ct('cbi_sac', 'Sac N°'),
      _cn('cbi_tare', 'Tare', 'kg'), _cn('cbi_brute', 'Brute', 'kg'), _cn('cbi_net', 'Net', 'kg'),
      _ct('cbi_fait', 'Fait par'), _ct('cbi_verif', 'Vérifié par')
    ]),
    _num('cbil_pcp', 'P_CP — Total Net des comprimés obtenus', 'kg'),
    _pj('cbil_pj', 'Étiquette « identification in process » des produits intermédiaires (scan)')
  ]),
  _sec('cp_rdt', '24 · Calcul du rendement de la compression', [
    _note('crd_note', 'Rendement (automatique depuis les données enregistrées)', `Les poids sont repris automatiquement : P_mél (section 10 · réception), P_CP (section 23 · bilan) et MMS (section 18 · masse moyenne statistique). Masse moyenne théorique MM = 150,00 mg. Saisir uniquement C_ép (nombre de comprimés prélevés par le CQ). Norme de rendement : 95–100 %.`),
    _calc('crd_pmel', 'P_mél — poids du mélange reçu (rappel section 10)', '{crec_pmel}', 'kg'),
    _calc('crd_pcp', 'P_CP — poids des comprimés obtenus (rappel section 23)', '{cbil_pcp}', 'kg'),
    _calc('crd_mms', 'MMS — masse moyenne statistique (rappel section 18)', '{cim_mms}', 'mg'),
    _num('crd_ceap', 'C_ép — nombre de comprimés prélevés par le CQ', 'cp'),
    _calc('crd_ntheo', 'N_théo = P_mél × 10⁶ / MM (150 mg)', '{crec_pmel} * 1000000 / 150', 'cp'),
    _calc('crd_ncp', 'N_CP = P_CP × 10⁶ / MMS', '{cbil_pcp} * 1000000 / {cim_mms}', 'cp'),
    _calc('crd_a1', 'A₁ (avarie) = P_mél − P_CP − (C_ép × MMS × 10⁻⁶)', '{crec_pmel} - {cbil_pcp} - ({crd_ceap} * {cim_mms} / 1000000)', 'kg'),
    _calc('crd_a2', 'A₂ (avarie) = N_théo − N_CP − C_ép', '{crd_ntheo} - {crd_ncp} - {crd_ceap}', 'cp'),
    _calc('crd_rkg', 'Rendement (kg/kg) = (P_CP + C_ép × MMS × 10⁻⁶) × 100 / P_mél', '({cbil_pcp} + {crd_ceap} * {cim_mms} / 1000000) * 100 / {crec_pmel}', '%', 95, 100),
    _calc('crd_rcp', 'Rendement (CP/CP) = (N_CP + C_ép) × 100 / N_théo', '({crd_ncp} + {crd_ceap}) * 100 / {crd_ntheo}', '%', 95, 100),
    _chk('crd_docs', 'Documents à joindre', 'oui', ['Bon d\'avarie', 'Bon de prélèvement']),
    _txt('crd_visa', 'Date / Visa Responsable Fabrication')
  ], 2)
]

// =====================================================================
//  Squelette générique d'une étape de fabrication (prélim, nettoyage,
//  opérateurs, équipements, conditions, opération, IPC, bilan, incidents).
//  Sert à pré-structurer les étapes dont le dossier n'est pas encore
//  modélisé ; à compléter via le Constructeur ou au partage des pages.
// =====================================================================
function phaseSkel (px, labelOp) {
  return [
    _sec(px + '_prelim', '1 · Opérations préliminaires & autorisation de démarrage', [
      _txt(px + '_date', 'Date de début', 'date', true),
      _txt(px + '_salle', 'N° de salle'),
      _txt(px + '_heure', 'Heure de début'),
      _num(px + '_temp', 'Température de la salle', '°C', 15, 25, true),
      _num(px + '_hr', 'Humidité relative', '%', null, 60, true),
      _num(px + '_dp', 'Différentiel de pression (ΔP)', 'mmH₂O', 1, null),
      _chk(px + '_vl', 'Vide de ligne — autorisation de démarrage', 'cnc', ['Instructions générales', 'Consignes de sécurité', 'Conditions environnementales', 'Nettoyage local & équipements']),
      _chk(px + '_prel', 'Vérification préliminaire', 'oui', ["Présence de tous les documents de l'instruction de fabrication", 'Habillage spécifique / réglementaire du personnel', 'Aptitude hygiène du personnel vérifiée (selon procédure)']),
      _txt(px + '_sup', 'Démarrage autorisé — Superviseur Fabrication (date / heure / visa)'),
      _txt(px + '_aq', 'Démarrage autorisé — AQ Process (date / heure / visa)')
    ], 2),
    _sec(px + '_net', '2 · Vérification du nettoyage (étiquettes « nettoyé »)', [
      _chk(px + '_netchk', 'Étiquettes « nettoyé » collées', 'oui', ['Salle', 'Équipements', 'Pièces mobiles']),
      _pj(px + '_netpj', 'Étiquettes « nettoyé » (scan)'),
      _txt(px + '_netvisa', 'Vérifié par — Date & Visa')
    ], 2),
    _sec(px + '_ope', '3 · Liste des opérateurs', [
      _tab(px + '_opetab', 'Opérateurs — Shift 01 : 06-14h · 02 : 14-22h · 03 : 22-06h', [
        _ct(px + '_opshift', 'N° Shift'), _ct(px + '_oppos', 'Poste'), _ct(px + '_opnom', 'Nom & prénom'), _ct(px + '_opdate', 'Date'), _ct(px + '_opvisa', 'Visa'), _ct(px + '_opver', 'Vérifié par')
      ])
    ]),
    _sec(px + '_equip', '4 · Vérification des équipements', [
      _tab(px + '_eqtab', 'Équipements', [
        _ct(px + '_eqnom', 'Équipement'), _ct(px + '_eqcode', 'Code'), _coc(px + '_eqqual', 'Qualification / calibration'), _coc(px + '_eqetat', 'État / fonctionnement à vide'), _ct(px + '_eqvisa', 'Visa')
      ])
    ]),
    _sec(px + '_cond', '5 · Conditions T° / HR / ΔP au cours du process', [
      _tab(px + '_condtab', 'Relevés', [
        _ct(px + '_cddate', 'Date'), _ct(px + '_cdheure', 'Heure'), _cn(px + '_cdt', 'Température', '°C', 15, 25), _cn(px + '_cdhr', 'Humidité', '%', null, 60), _cn(px + '_cddp', 'ΔP', 'mmH₂O', 1, null), _ct(px + '_cdsalle', 'N° salle'), _ct(px + '_cdvisa', 'Visa')
      ])
    ]),
    _sec(px + '_op', '6 · ' + labelOp, [
      _note(px + '_opnote', labelOp, "Section à compléter selon le dossier de lot de cette étape (paramètres machine, contrôles IPC, visas). Partagez les pages et je la modélise à l'identique, ou composez-la via le Constructeur."),
      _txt(px + '_opdeb', 'Date / heure de début'),
      _txt(px + '_opfin', 'Date / heure de fin'),
      _num(px + '_opduree', 'Durée', 'min'),
      _txt(px + '_opsig', 'Fait par / Vérifié par — Date & Visa')
    ], 2),
    _sec(px + '_ipc', '7 · Contrôles IPC', [
      _note(px + '_ipcnote', 'Contrôles en cours de process (IPC)', 'À définir selon l\'étape : aspect, masse, dureté, friabilité, désagrégation, humidité résiduelle…'),
      _pj(px + '_ipcpj', 'Fiche IPC / ticket (scan)')
    ], 2),
    _sec(px + '_bilan', '8 · Bilan / rendement', [
      _note(px + '_bnote', 'Rendement (automatique)', 'Saisir la quantité théorique et la quantité obtenue : l\'avarie et le rendement se calculent automatiquement. La norme (min/max) de rendement propre à l\'étape se définit via le Constructeur.'),
      _num(px + '_pth', 'Quantité théorique', 'kg'),
      _num(px + '_pobt', 'Quantité obtenue', 'kg'),
      _calc(px + '_av', 'Avarie = théorique − obtenue', '{' + px + '_pth} - {' + px + '_pobt}', 'kg'),
      _calc(px + '_rdt', 'Rendement = obtenue × 100 / théorique', '{' + px + '_pobt} * 100 / {' + px + '_pth}', '%'),
      _txt(px + '_bjust', 'Justification des écarts'),
      _txt(px + '_bvisa', 'Date / Visa Responsable Fabrication')
    ], 2),
    _sec(px + '_inc', '9 · Suivi des incidents et arrêts', [
      _tab(px + '_inctab', 'Incidents / arrêts', [
        _ct(px + '_indate', 'Date'), _ct(px + '_inharr', "Heure d'arrêt"), _ct(px + '_insac', 'N° de sac'), _ct(px + '_inmotif', 'Motif'), _ct(px + '_inact', 'Action corrective'), _ct(px + '_inddem', 'Date démarrage'), _ct(px + '_inhdem', 'Heure démarrage'), _ct(px + '_invisa', 'Visa')
      ])
    ])
  ]
}

// =====================================================================
//  Bibliothèque des ÉTAPES DE FABRICATION standard (modèle unique).
//  Pesée et Tamisage & Mélange : modélisés à l'identique du dossier.
//  Les autres : squelette standard à compléter.
// =====================================================================
const PHASES_STANDARD = {
  pesee:                 { nom: 'Pesée', sections: SECTIONS_PESEE },
  granulation_sechage:   { nom: 'Granulation & Séchage', sections: phaseSkel('gr', 'Opération de granulation & séchage') },
  tamisage_melange:      { nom: 'Tamisage & Mélange', sections: SECTIONS_TM },
  compression:           { nom: 'Compression', sections: SECTIONS_COMPRESSION },
  remplissage_gelules:   { nom: 'Remplissage des gélules', sections: phaseSkel('ge', 'Opération de remplissage des gélules') },
  pelliculage:           { nom: 'Pelliculage', sections: phaseSkel('pl', 'Opération de pelliculage') },
  melange_creme_pommade: { nom: 'Mélange crème & pommade', sections: phaseSkel('cr', 'Opération de mélange crème/pommade') }
}

// Liste ordonnée des étapes (pour l'éditeur de gamme).
export const ETAPES_FAB = [
  { k: 'pesee', nom: 'Pesée' },
  { k: 'granulation_sechage', nom: 'Granulation & Séchage' },
  { k: 'tamisage_melange', nom: 'Tamisage & Mélange' },
  { k: 'compression', nom: 'Compression' },
  { k: 'remplissage_gelules', nom: 'Remplissage des gélules' },
  { k: 'pelliculage', nom: 'Pelliculage' },
  { k: 'melange_creme_pommade', nom: 'Mélange crème & pommade' }
]

// Gamme par défaut (comprimé pelliculé) si le produit n'en définit pas.
const GAMME_DEFAUT = ['pesee', 'tamisage_melange', 'compression', 'pelliculage']

// Assemble le formulaire d'un produit à partir de sa gamme (liste d'étapes),
// en conservant l'ordre officiel des étapes et en clonant chaque section.
export function assembleGamme (gamme) {
  const choisies = (Array.isArray(gamme) && gamme.length) ? gamme : GAMME_DEFAUT
  const sections = []
  for (const e of ETAPES_FAB) {
    if (!choisies.includes(e.k)) continue
    const ph = PHASES_STANDARD[e.k]
    if (!ph) continue
    for (const s of ph.sections) sections.push({ ...JSON.parse(JSON.stringify(s)), phase: ph.nom })
  }
  return { sections }
}

// Modèle par défaut (gamme comprimé pelliculé).
export const FORMULAIRE_DEFAUT = assembleGamme(GAMME_DEFAUT)

export const PRODUITS_REF = {
  'ROSUSTINE ® 10 mg': {
    gamme: ['pesee', 'tamisage_melange', 'compression', 'pelliculage'],
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
