// =====================================================================
//  Formulaire CONFIGURABLE du dossier de lot (par produit).
//  Le dossier n'est plus figé : chaque produit a son formulaire,
//  composé de SECTIONS, chacune contenant des CHAMPS. On ajoute /
//  supprime librement. La saisie s'adapte au produit sélectionné et
//  contrôle automatiquement les limites (data integrity).
// =====================================================================

export const TYPES_CHAMP = [
  { k: 'num', label: 'Numérique (avec limites)' },
  { k: 'oui_non', label: 'Conforme / Oui-Non' },
  { k: 'texte', label: 'Texte' },
  { k: 'date', label: 'Date / heure' },
  { k: 'tableau', label: 'Tableau (lignes)' },
  { k: 'note', label: 'Note / consignes (lecture seule)' },
  { k: 'fichier', label: 'Pièce jointe (fichier)' }
]
export const TYPES_COLONNE = [
  { k: 'texte', label: 'Texte' },
  { k: 'num', label: 'Numérique' },
  { k: 'oui_non', label: 'Conforme / Oui-Non' }
]
// Jeux de choix pour les champs « oui_non »
export const JEUX_OUI_NON = [
  { k: 'conf', options: ['Conforme', 'Non conforme'], attendu: 'Conforme' },
  { k: 'oui', options: ['Oui', 'Non'], attendu: 'Oui' },
  { k: 'cnc', options: ['C', 'NC'], attendu: 'C' }
]

let _seq = 0
export function uid (p = 'x') { _seq++; return p + '_' + Date.now().toString(36) + _seq.toString(36) }

export function colonneVide (type = 'texte') { return { id: uid('k'), label: '', type, unite: '', min: null, max: null, attendu: 'Conforme', options: ['Conforme', 'Non conforme'] } }
export function champVide (type = 'num') {
  const c = { id: uid('c'), label: '', type, unite: '', min: null, cible: null, max: null, obligatoire: false, attendu: 'Conforme', options: ['Conforme', 'Non conforme'], colonnes: [], contenu: '' }
  if (type === 'tableau') c.colonnes = [colonneVide('texte')]
  return c
}
export function sectionVide () { return { id: uid('s'), titre: '', cols: 1, champs: [] } }
export function formulaireVide () { return { sections: [] } }

export function parseNum (v) {
  if (v === null || v === undefined) return null
  const m = String(v).replace(',', '.').match(/-?\d+(\.\d+)?/)
  return m ? Number(m[0]) : null
}

// Verdicts : 'conforme' | 'nc' | 'vide'
export function verdictNum (v, min, max) {
  const n = parseNum(v)
  if (n === null) return 'vide'
  if (min !== null && min !== undefined && min !== '' && n < Number(min)) return 'nc'
  if (max !== null && max !== undefined && max !== '' && n > Number(max)) return 'nc'
  return 'conforme'
}
export function verdictOuiNon (v, attendu) {
  const s = String(v == null ? '' : v).trim()
  if (!s) return 'vide'
  if (!attendu) return 'conforme'
  return s.toUpperCase() === String(attendu).trim().toUpperCase() ? 'conforme' : 'nc'
}
// Verdict d'un champ (hors tableau) selon sa valeur saisie.
export function verdictChamp (champ, valeur) {
  if (champ.type === 'num') return verdictNum(valeur, champ.min, champ.max)
  if (champ.type === 'oui_non') return verdictOuiNon(valeur, champ.attendu)
  if (champ.obligatoire) return (valeur === '' || valeur === null || valeur === undefined) ? 'vide' : 'conforme'
  return (valeur === '' || valeur === null || valeur === undefined) ? 'vide' : 'conforme'
}
export function verdictCellule (col, valeur) {
  if (col.type === 'num') return verdictNum(valeur, col.min, col.max)
  if (col.type === 'oui_non') return verdictOuiNon(valeur, col.attendu)
  return (valeur === '' || valeur === null || valeur === undefined) ? 'vide' : 'conforme'
}

// Texte des limites/spéc d'un champ (pour affichage).
export function specTexte (c) {
  if (c.type === 'num') {
    const u = c.unite ? ' ' + c.unite : ''
    if (c.min != null && c.min !== '' && c.max != null && c.max !== '') return `${c.min} à ${c.max}${u}`
    if (c.max != null && c.max !== '') return `≤ ${c.max}${u}`
    if (c.min != null && c.min !== '') return `≥ ${c.min}${u}`
    return c.unite || ''
  }
  if (c.type === 'oui_non') return c.attendu ? 'Attendu : ' + c.attendu : ''
  return ''
}

// Évalue tout le formulaire rempli → stats + déviations (points 'nc').
export function evaluerFormulaire (formulaire, saisie) {
  const S = (formulaire && formulaire.sections) || []
  let total = 0, saisis = 0, conformes = 0, nc = 0
  const deviations = []
  for (const sec of S) {
    for (const ch of (sec.champs || [])) {
      if (ch.type === 'note' || ch.type === 'fichier') continue   // informatif / pièce jointe : hors conformité
      const controlable = ch.type === 'num' || ch.type === 'oui_non' || ch.obligatoire
      if (ch.type === 'tableau') {
        const rows = (saisie && saisie[ch.id]) || []
        for (const col of (ch.colonnes || [])) {
          if (!(col.type === 'num' || col.type === 'oui_non')) continue
          rows.forEach((row, ri) => {
            const val = row ? row[col.id] : ''
            const v = verdictCellule(col, val)
            if (v === 'vide' && (val === '' || val == null)) return // ne compte pas les cellules vides de tableau
            total++; saisis++
            if (v === 'conforme') conformes++
            if (v === 'nc') { nc++; deviations.push({ libelle: `${ch.label} — ${col.label} (ligne ${ri + 1})`, valeur: String(val), spec: specTexte(col) }) }
          })
        }
        continue
      }
      if (!controlable) continue
      total++
      const val = saisie ? saisie[ch.id] : ''
      const v = verdictChamp(ch, val)
      if (v !== 'vide') saisis++
      if (v === 'conforme') conformes++
      if (v === 'nc') { nc++; deviations.push({ libelle: `${sec.titre} — ${ch.label}`, valeur: String(val || ''), spec: specTexte(ch) }) }
    }
  }
  const pct = total ? Math.round(saisis / total * 100) : 0
  return { stats: { total, saisis, conformes, nc, pct, manquants: total - saisis }, deviations }
}

// Compte des champs (pour l'aperçu du constructeur).
export function compteChamps (formulaire) {
  return ((formulaire && formulaire.sections) || []).reduce((a, s) => a + ((s.champs || []).length), 0)
}
