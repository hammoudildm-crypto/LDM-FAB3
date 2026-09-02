// Plans d'échantillonnage ISO 2859-1 (= NF X06-022 / ANSI-ASQ Z1.4)
// Échantillonnage SIMPLE, contrôle NORMAL.
//
// Deux tables :
//   Table 1   taille du lot + niveau de contrôle -> lettre-code
//   Table 2-A lettre-code + AQL                  -> taille d'échantillon, Ac, Re
//
// La table 2-A est une diagonale : pour chaque lettre, la colonne où Ac = 0 recule
// d'un cran à chaque lettre, et les critères d'acceptation suivent toujours la même
// suite 0, 1, 2, 3, 5, 7, 10, 14, 21. À gauche de cette diagonale la norme renvoie
// au premier plan EN DESSOUS (flèche ↓, échantillon plus grand), au-delà de 21 au
// premier plan AU-DESSUS (flèche ↑). C'est ce que reproduit resoudrePlan().

export const LETTRES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'Q', 'R']

export const TAILLE_ECHANTILLON = {
  A: 2, B: 3, C: 5, D: 8, E: 13, F: 20, G: 32, H: 50,
  J: 80, K: 125, L: 200, M: 315, N: 500, P: 800, Q: 1250, R: 2000
}

export const AQLS = [0.010, 0.015, 0.025, 0.040, 0.065, 0.10, 0.15, 0.25, 0.40, 0.65, 1.0, 1.5, 2.5, 4.0, 6.5, 10]

export const NIVEAUX = ['S-1', 'S-2', 'S-3', 'S-4', 'I', 'II', 'III']

// Suite des critères d'acceptation, de la diagonale Ac = 0 vers la droite.
const SUITE_AC = [0, 1, 2, 3, 5, 7, 10, 14, 21]

// Table 1 : bornes hautes de taille de lot, puis lettre par niveau (ordre de NIVEAUX).
const TABLE_1 = [
  [8, ['A', 'A', 'A', 'A', 'A', 'A', 'B']],
  [15, ['A', 'A', 'A', 'A', 'A', 'B', 'C']],
  [25, ['A', 'A', 'B', 'B', 'B', 'C', 'D']],
  [50, ['A', 'B', 'B', 'C', 'C', 'D', 'E']],
  [90, ['B', 'B', 'C', 'C', 'C', 'E', 'F']],
  [150, ['B', 'B', 'C', 'D', 'D', 'F', 'G']],
  [280, ['B', 'C', 'D', 'E', 'E', 'G', 'H']],
  [500, ['B', 'C', 'D', 'E', 'F', 'H', 'J']],
  [1200, ['C', 'C', 'E', 'F', 'G', 'J', 'K']],
  [3200, ['C', 'D', 'E', 'G', 'H', 'K', 'L']],
  [10000, ['C', 'D', 'F', 'G', 'J', 'L', 'M']],
  [35000, ['C', 'D', 'F', 'H', 'K', 'M', 'N']],
  [150000, ['D', 'E', 'G', 'J', 'L', 'N', 'P']],
  [500000, ['D', 'E', 'G', 'J', 'M', 'P', 'Q']],
  [Infinity, ['D', 'E', 'H', 'K', 'N', 'Q', 'R']]
]

// Indice, dans AQLS, de la colonne où Ac = 0 pour la lettre d'indice i.
function indiceZero(i) { return 16 - i }

/** Lettre-code d'après la taille du lot et le niveau de contrôle. */
export function lettreCode(tailleLot, niveau = 'II') {
  const n = Number(tailleLot) || 0
  const col = NIVEAUX.indexOf(niveau)
  if (n < 2 || col < 0) return null
  for (const [max, lettres] of TABLE_1) if (n <= max) return lettres[col]
  return null
}

/**
 * Plan d'échantillonnage pour une lettre et une AQL, flèches de la norme comprises.
 * Renvoie { lettre, n, ac, re, deplacement } ou null si la norme ne propose aucun plan.
 * deplacement : 0 = case directe, <0 = remonté (↑), >0 = descendu (↓).
 */
export function resoudrePlan(lettre, aql) {
  const depart = LETTRES.indexOf(lettre)
  const j = AQLS.indexOf(Number(aql))
  if (depart < 0 || j < 0) return null
  let i = depart
  while (i >= 0 && i < LETTRES.length) {
    const ecart = j - indiceZero(i)
    if (ecart < 0) { i++; continue }        // ↓ premier plan en dessous
    if (ecart > 8) { i--; continue }        // ↑ premier plan au-dessus
    const L = LETTRES[i]
    return { lettre: L, n: TAILLE_ECHANTILLON[L], ac: SUITE_AC[ecart], re: SUITE_AC[ecart] + 1, deplacement: i - depart }
  }
  return null
}

/**
 * Plan complet à partir de la taille du lot.
 * Si l'échantillon atteint la taille du lot, la norme impose le contrôle à 100 %.
 */
export function planPourLot(tailleLot, aql, niveau = 'II') {
  const L = lettreCode(tailleLot, niveau)
  if (!L) return null
  const p = resoudrePlan(L, aql)
  if (!p) return null
  const taille = Number(tailleLot) || 0
  return { ...p, lettreLot: L, cent: p.n >= taille, n: p.n >= taille ? taille : p.n }
}

/** Verdict d'une classe de défauts. */
export function verdictClasse(defauts, ac) {
  if (ac == null) return null
  return (Number(defauts) || 0) <= ac ? 'Accepté' : 'Refusé'
}
