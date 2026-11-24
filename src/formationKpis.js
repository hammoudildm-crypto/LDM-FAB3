// KPIs de formation/qualification — agrégats identiques à l'écran « Matrice formation ».
// Fonction pure (aucune dépendance Vue) : on lui passe les tables, elle renvoie les indicateurs.
// Réutilisée par le mode Boucle du planning pour l'affichage mural.
//
// Entrées :
//   personnes      : organigramme [{ id, nom, fonction, atelier_id, date_recrutement }]
//   formations     : formations ACTIVES [{ id, nom, code_sop, validite_mois }]
//   formationsAll  : toutes les formations (actives + inactives) [{ id, nom }] (correspondance par nom)
//   enregistrements: formation_enregistrements [{ personne_id, formation_id, date_formation, resultat, id }]
//   requises       : formation_requise [{ fonction, formation_id }]
//   preuveIds      : Set des enregistrement_id ayant une preuve jointe (couverture)
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const nomCle = (nom) => norm(nom).replace(/[^a-z0-9]+/g, ' ').trim()
function addMonths(dateStr, m) {
  if (!dateStr) return null
  const d = new Date(String(dateStr).slice(0, 10) + 'T00:00:00')
  if (isNaN(d.getTime())) return null
  d.setMonth(d.getMonth() + m)
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

export function computeFormationKpis({ personnes = [], formations = [], formationsAll = [], enregistrements = [], requises = [], preuveIds = new Set() } = {}) {
  const AUJ = new Date().toISOString().slice(0, 10)
  const DANS60 = (() => { const d = new Date(AUJ + 'T00:00:00'); d.setDate(d.getDate() + 60); return d.toISOString().slice(0, 10) })()
  const formById = {}; for (const f of formations) formById[f.id] = f
  const allById = {}; for (const f of formationsAll) allById[f.id] = f
  // id canonique par nom : fiches en double (actives prioritaires) ramenées à un même id
  const canonParNom = {}
  for (const f of formations) { const k = nomCle(f.nom); if (k && !(k in canonParNom)) canonParNom[k] = f.id }
  for (const f of formationsAll) { const k = nomCle(f.nom); if (k && !(k in canonParNom)) canonParNom[k] = f.id }
  const canonId = (fid) => { const f = allById[fid] || formById[fid]; if (!f) return fid; const k = nomCle(f.nom); return (k && canonParNom[k]) || fid }
  const requisParFn = {}
  for (const r of requises) { (requisParFn[r.fonction] = requisParFn[r.fonction] || new Set()).add(canonId(r.formation_id)) }
  // dernier enregistrement par personne|formation-canonique, avec statut de cellule
  const latest = {}
  for (const e of enregistrements) {
    const cf = canonId(e.formation_id), f = formById[cf]
    const dateStr = e.date_formation ? String(e.date_formation).slice(0, 10) : ''
    const exp = (f && f.validite_mois && dateStr) ? addMonths(dateStr, f.validite_mois) : null
    let cell = 'valide'
    if (e.resultat === 'non acquis') cell = 'expire'
    else if (exp) cell = exp < AUJ ? 'expire' : (exp <= DANS60 ? 'bientot' : 'valide')
    const k = e.personne_id + '|' + cf, prev = latest[k]
    if (!prev || String(dateStr) > String(prev.date)) latest[k] = { date: dateStr, cell }
  }
  const statut = (pid, fonction, cf) => { const e = latest[pid + '|' + cf]; if (e) return e.cell; const req = requisParFn[fonction]; return (req && req.has(cf)) ? 'manquant' : 'absent' }
  // par personne
  const perPers = []
  for (const p of personnes) {
    const req = requisParFn[p.fonction]
    if (!req || !req.size) { perPers.push({ id: p.id, nom: p.nom, fonction: p.fonction, atelier: p.atelier_id, requises: 0, valides: 0, bientot: 0, expire: 0, manquant: 0, taux: null }); continue }
    let v = 0, b = 0, ex = 0, mq = 0
    for (const fid of req) { const st = statut(p.id, p.fonction, fid); if (st === 'valide') v++; else if (st === 'bientot') b++; else if (st === 'expire') ex++; else if (st === 'manquant') mq++ }
    perPers.push({ id: p.id, nom: p.nom, fonction: p.fonction, atelier: p.atelier_id, requises: req.size, valides: v, bientot: b, expire: ex, manquant: mq, taux: v / req.size * 100 })
  }
  // global
  let gReq = 0, gVal = 0; const rep = { valide: 0, bientot: 0, expire: 0, manquant: 0 }
  for (const t of perPers) { gReq += t.requises; gVal += t.valides; rep.valide += t.valides; rep.bientot += t.bientot; rep.expire += t.expire; rep.manquant += t.manquant }
  const withReq = perPers.filter(t => t.requises > 0)
  const qualifies = withReq.filter(t => t.valides === t.requises).length
  // couverture des preuves
  const totalEnr = enregistrements.length
  let avecPreuve = 0; for (const e of enregistrements) if (preuveIds.has(e.id)) avecPreuve++
  // ventilation par groupe (atelier ou fonction)
  const parGroupe = (keyOf, fallback) => {
    const g = {}
    for (const t of perPers) {
      if (!t.requises) continue
      const k = keyOf(t) || fallback
      const e = g[k] = g[k] || { nom: k, req: 0, val: 0, bientot: 0, expire: 0, manquant: 0, pers: 0 }
      e.req += t.requises; e.val += t.valides; e.bientot += t.bientot; e.expire += t.expire; e.manquant += t.manquant; e.pers++
    }
    return Object.values(g).map(e => ({ ...e, taux: e.req ? e.val / e.req * 100 : null })).sort((a, b) => (a.taux == null ? 999 : a.taux) - (b.taux == null ? 999 : b.taux))
  }
  const parAtelier = parGroupe(t => t.atelier, '(sans atelier)')
  const parFonction = parGroupe(t => t.fonction, '(sans fonction)')
  // priorité : le plus d'écarts (expirées + manquantes), puis « bientôt », puis taux le plus bas
  const priorite = withReq.map(t => ({ nom: t.nom, fonction: t.fonction, atelier: t.atelier, expire: t.expire, manquant: t.manquant, bientot: t.bientot, taux: t.taux, ecarts: t.expire + t.manquant }))
    .filter(t => t.ecarts > 0 || t.bientot > 0)
    .sort((a, b) => (b.ecarts - a.ecarts) || (b.bientot - a.bientot) || (a.taux - b.taux))
    .slice(0, 12)
  return {
    global: {
      taux: gReq ? gVal / gReq * 100 : null,
      qualifies, effectif: personnes.length, avecReq: withReq.length,
      valide: rep.valide, bientot: rep.bientot, expire: rep.expire, manquant: rep.manquant,
      repTotal: rep.valide + rep.bientot + rep.expire + rep.manquant,
      preuveCov: totalEnr ? Math.round(avecPreuve / totalEnr * 100) : 0, totalEnr, avecPreuve
    },
    parAtelier, parFonction, priorite
  }
}
