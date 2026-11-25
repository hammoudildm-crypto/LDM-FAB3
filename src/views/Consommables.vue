<script setup>
import { ref, reactive, computed, onMounted, inject } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'

const peutEditer = inject('peutEditer', ref(true))
const peutSupprimer = inject('peutSupprimer', ref(true))   // suppression réservée à l'admin
const CATS_SUGG = ['Nettoyage', 'Protection / EPI', 'Emballage', 'Étiquetage', 'Divers']

function ymd(d) { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }
const consommables = ref([])
const mouvements = ref([])
const sorties = ref([])                               // sorties (consommation fab) des ~12 derniers mois
const moisSel = ref(ymd(new Date()).slice(0, 7))      // mois analysé (YYYY-MM)
const recherche = ref('')
const catSel = ref('')
const formOuvert = ref(false)
const erreur = ref('')
const message = ref('')
const nouv = reactive({ nom: '', reference: '', categorie: '', unite: 'unité', prix_unitaire: 0, stock_mp: 0, stock_fab: 0, seuil_mp: 0, seuil_fab: 0 })
const mvtModal = ref(null)
const editModal = ref(null)

async function charger() {
  erreur.value = ''
  const rc = await supabase.from('consommables').select('*').order('categorie', { nullsFirst: true }).order('nom')
  if (rc.error) erreur.value = rc.error.message; else consommables.value = rc.data || []
  const rm = await supabase.from('mouvements_consommables').select('*').order('date_mvt', { ascending: false }).order('id', { ascending: false }).limit(100)
  if (!rm.error) mouvements.value = rm.data || []
  const depuis = new Date(new Date().getFullYear() - 1, 0, 1)   // 1er janv. de l'an dernier → couvre l'évolution annuelle
  const rs = await supabase.from('mouvements_consommables').select('consommable_id,quantite,date_mvt').eq('type', 'sortie').gte('date_mvt', ymd(depuis))
  if (!rs.error) sorties.value = rs.data || []
  await chargerCommandes()
}
onMounted(charger)

// ---- Accès stocks par emplacement ----
const sMp = (c) => Number(c.stock_mp) || 0
const sFab = (c) => Number(c.stock_fab) || 0
const seMp = (c) => Number(c.seuil_mp) || 0
const seFab = (c) => Number(c.seuil_fab) || 0
const totalStock = (c) => sMp(c) + sFab(c)
function etatEmpl(stock, seuil) { if (stock <= 0) return 'rupture'; if (stock <= seuil) return 'alerte'; return 'ok' }
const etatMp = (c) => etatEmpl(sMp(c), seMp(c))
const etatFab = (c) => etatEmpl(sFab(c), seFab(c))

const categories = computed(() => [...new Set(consommables.value.map(c => c.categorie).filter(Boolean))].sort((a, b) => a.localeCompare(b)))
const filtres = computed(() => {
  const q = recherche.value.trim().toLowerCase()
  return consommables.value.filter(c => (!catSel.value || c.categorie === catSel.value) && (!q || (c.nom || '').toLowerCase().includes(q) || (c.reference || '').toLowerCase().includes(q)))
})
const nbAlerte = computed(() => consommables.value.filter(c => etatMp(c) === 'alerte' || etatFab(c) === 'alerte').length)
const nbRupture = computed(() => consommables.value.filter(c => etatMp(c) === 'rupture' || etatFab(c) === 'rupture').length)
const mvtMois = computed(() => { const n = new Date(); return mouvements.value.filter(m => { const d = new Date(m.date_mvt); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear() }).length })
const mvtsAffiches = computed(() => mouvements.value.slice(0, 40))

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR')
const fmtDA = (n) => Number(Math.round(n) || 0).toLocaleString('fr-FR') + ' DA'
const valeurDe = (c) => totalStock(c) * (Number(c.prix_unitaire) || 0)
const valeurMp = computed(() => consommables.value.reduce((s, c) => s + sMp(c) * (Number(c.prix_unitaire) || 0), 0))
const valeurFab = computed(() => consommables.value.reduce((s, c) => s + sFab(c) * (Number(c.prix_unitaire) || 0), 0))
const valeurFiltree = computed(() => filtres.value.reduce((s, c) => s + valeurDe(c), 0))
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—'
const nomDe = (id) => { const c = consommables.value.find(x => x.id === id); return c ? c.nom : '—' }
const labelType = (t) => t === 'entree' ? 'Entrée' : t === 'sortie' ? 'Sortie' : t === 'transfert' ? 'Transfert' : 'Ajustement'
function emplLabel(m) { if (m.type === 'transfert') return 'MP → Fab'; return m.emplacement === 'mp' ? 'Stock MP' : m.emplacement === 'fab' ? 'Fabrication' : '—' }

// ---- Consommation (sorties de stock = consommation fabrication) : mensuelle & journalière ----
const consoById = computed(() => { const m = {}; for (const c of consommables.value) m[c.id] = c; return m })
const prixDe = (id) => Number(consoById.value[id]?.prix_unitaire) || 0
const moisLabel = (ym) => { if (!ym) return '—'; const [y, mo] = ym.split('-').map(Number); return new Date(y, mo - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) }
const ajKey = computed(() => ymd(new Date()))
const curYM = computed(() => ajKey.value.slice(0, 7))
const moisDispo = computed(() => { const s = new Set(sorties.value.map(m => (m.date_mvt || '').slice(0, 7)).filter(Boolean)); s.add(curYM.value); return [...s].sort().reverse() })
const sortiesMois = computed(() => sorties.value.filter(m => (m.date_mvt || '').slice(0, 7) === moisSel.value))
const consoAujVal = computed(() => sorties.value.filter(m => m.date_mvt === ajKey.value).reduce((s, m) => s + (Number(m.quantite) || 0) * prixDe(m.consommable_id), 0))
const consoAujNb = computed(() => sorties.value.filter(m => m.date_mvt === ajKey.value).length)
const consoMoisVal = computed(() => sortiesMois.value.reduce((s, m) => s + (Number(m.quantite) || 0) * prixDe(m.consommable_id), 0))
const joursRefMois = computed(() => { const [y, mo] = moisSel.value.split('-').map(Number); return moisSel.value === curYM.value ? new Date().getDate() : new Date(y, mo, 0).getDate() })
const consoMoyJour = computed(() => joursRefMois.value > 0 ? consoMoisVal.value / joursRefMois.value : 0)
const consoParArticle = computed(() => {
  const m = {}
  for (const s of sortiesMois.value) {
    const c = consoById.value[s.consommable_id]; if (!c) continue
    if (!m[s.consommable_id]) m[s.consommable_id] = { id: s.consommable_id, nom: c.nom, unite: c.unite, qte: 0, valeur: 0, jours: new Set() }
    const q = Number(s.quantite) || 0, o = m[s.consommable_id]
    o.qte += q; o.valeur += q * prixDe(s.consommable_id); o.jours.add(s.date_mvt)
  }
  return Object.values(m).map(o => ({ id: o.id, nom: o.nom, unite: o.unite, qte: o.qte, valeur: o.valeur, nbJours: o.jours.size, moyJour: joursRefMois.value > 0 ? o.qte / joursRefMois.value : 0 })).sort((a, b) => b.valeur - a.valeur || b.qte - a.qte)
})
const consoJour = computed(() => {
  const [y, mo] = moisSel.value.split('-').map(Number)
  const nb = new Date(y, mo, 0).getDate(), byDay = {}
  for (const s of sortiesMois.value) { const d = Number((s.date_mvt || '').slice(8, 10)); if (!d) continue; byDay[d] = (byDay[d] || 0) + (Number(s.quantite) || 0) * prixDe(s.consommable_id) }
  const jours = []; let max = 0, tot = 0
  const auj = moisSel.value === curYM.value ? new Date().getDate() : -1
  for (let d = 1; d <= nb; d++) { const v = byDay[d] || 0; if (v > max) max = v; tot += v; jours.push({ jour: d, val: v, auj: d === auj }) }
  return { jours, max, tot }
})

// ---- Évolution annuelle de la consommation par article (matrice article × 12 mois) ----
const MOIS_COURTS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const metrique = ref('valeur')   // 'valeur' (DA) | 'qte'
const anneeSel = ref(String(new Date().getFullYear()))
const artSel = ref('')           // '' = tous les articles, sinon id (string)
const consommablesTries = computed(() => [...consommables.value].sort((a, b) => (a.nom || '').localeCompare(b.nom || '')))
const anneesDispo = computed(() => { const s = new Set(sorties.value.map(m => (m.date_mvt || '').slice(0, 4)).filter(Boolean)); s.add(String(new Date().getFullYear())); return [...s].sort().reverse() })
const evolutionAnnee = computed(() => {
  const an = anneeSel.value, parArt = {}
  for (const s of sorties.value) {
    if ((s.date_mvt || '').slice(0, 4) !== an) continue
    const c = consoById.value[s.consommable_id]; if (!c) continue
    const mo = Number((s.date_mvt || '').slice(5, 7)) - 1; if (mo < 0 || mo > 11) continue
    if (!parArt[s.consommable_id]) parArt[s.consommable_id] = { id: s.consommable_id, nom: c.nom, unite: c.unite, mois: new Array(12).fill(0), qteMois: new Array(12).fill(0), total: 0, totalQte: 0 }
    const q = Number(s.quantite) || 0, o = parArt[s.consommable_id]
    o.qteMois[mo] += q; o.mois[mo] += q * prixDe(s.consommable_id); o.total += q * prixDe(s.consommable_id); o.totalQte += q
  }
  let arr = Object.values(parArt)
  if (artSel.value) arr = arr.filter(o => String(o.id) === artSel.value)
  for (const o of arr) { o.serie = metrique.value === 'qte' ? o.qteMois : o.mois; o.max = Math.max(...o.serie, 0); o.totAff = metrique.value === 'qte' ? o.totalQte : o.total }
  return arr.sort((a, b) => b.total - a.total)
})
const evolutionTotaux = computed(() => {
  const mois = new Array(12).fill(0)
  for (const o of evolutionAnnee.value) for (let i = 0; i < 12; i++) mois[i] += o.mois[i]
  return { mois, max: Math.max(...mois, 1), total: mois.reduce((s, x) => s + x, 0) }
})
function cellStyle(v, max) { if (!v || max <= 0) return {}; const a = Math.min(0.85, 0.12 + v / max * 0.73); return { background: `rgba(180,83,9,${a.toFixed(3)})`, color: a > 0.5 ? '#fff' : '#7c2d12', fontWeight: 700 } }

// ---- Couverture de stock (jours) = stock ÷ consommation journalière moyenne (fenêtre 90 j) ----
const AVG_FENETRE = 90
const consoRecente = computed(() => {
  const lim = ymd(new Date(Date.now() - AVG_FENETRE * 86400000)), m = {}
  for (const s of sorties.value) if ((s.date_mvt || '') >= lim) m[s.consommable_id] = (m[s.consommable_id] || 0) + (Number(s.quantite) || 0)
  return m
})
const moyJourDe = (id) => (consoRecente.value[id] || 0) / AVG_FENETRE
const couvFabJ = (c) => { const a = moyJourDe(c.id); return a > 0 ? sFab(c) / a : null }
const couvMpJ = (c) => { const a = moyJourDe(c.id); return a > 0 ? sMp(c) / a : null }
function couvClass(j) { if (j === null) return 'couv-none'; if (j < 7) return 'couv-bas'; if (j < 21) return 'couv-moy'; return 'couv-ok' }
function couvLabel(j) { return j === null ? '—' : Math.round(j) + ' j' }

async function ajouter() {
  const nom = (nouv.nom || '').trim(); if (!nom) { erreur.value = 'Le nom est requis.'; return }
  const r = await supabase.from('consommables').insert({ nom, reference: nouv.reference || null, categorie: nouv.categorie || null, unite: nouv.unite || 'unité', prix_unitaire: Number(nouv.prix_unitaire) || 0, stock_mp: Number(nouv.stock_mp) || 0, stock_fab: Number(nouv.stock_fab) || 0, seuil_mp: Number(nouv.seuil_mp) || 0, seuil_fab: Number(nouv.seuil_fab) || 0 })
  if (r.error) { erreur.value = r.error.message; return }
  Object.assign(nouv, { nom: '', reference: '', categorie: '', unite: 'unité', prix_unitaire: 0, stock_mp: 0, stock_fab: 0, seuil_mp: 0, seuil_fab: 0 })
  formOuvert.value = false; message.value = 'Consommable ajouté.'; await charger()
}
function editer(c) { editModal.value = { ...c } }
async function validerEdit() {
  const e = editModal.value
  const r = await supabase.from('consommables').update({ nom: e.nom, categorie: e.categorie || null, unite: e.unite || 'unité', reference: e.reference || null, prix_unitaire: Number(e.prix_unitaire) || 0, seuil_mp: Number(e.seuil_mp) || 0, seuil_fab: Number(e.seuil_fab) || 0, stock_mp: Number(e.stock_mp) || 0, stock_fab: Number(e.stock_fab) || 0 }).eq('id', e.id)
  if (r.error) { erreur.value = r.error.message; return }
  editModal.value = null; message.value = 'Consommable modifié.'; await charger()
}
async function supprimer(c) {
  if (!peutSupprimer.value) { erreur.value = 'Suppression réservée à l’administrateur.'; return }
  if (!confirm('Supprimer « ' + c.nom + ' » et son historique de mouvements ?')) return
  const r = await supabase.from('consommables').delete().eq('id', c.id)
  if (r.error) { erreur.value = r.error.message; return }
  message.value = 'Consommable supprimé.'; await charger()
}

// ---- Mouvements : entrée (→ MP), transfert (MP → Fab), sortie (← Fab) ----
function ouvrirMvt(c, type) {
  mvtModal.value = { consommable_id: c.id, nom: c.nom, unite: c.unite, type, quantite: 0, date_mvt: new Date().toISOString().slice(0, 10), atelier: '', motif: '', mpAvant: sMp(c), fabAvant: sFab(c) }
}
const qMvt = computed(() => Number(mvtModal.value?.quantite) || 0)
const mpApres = computed(() => { const m = mvtModal.value; if (!m) return 0; return m.type === 'entree' ? m.mpAvant + qMvt.value : m.type === 'transfert' ? m.mpAvant - qMvt.value : m.mpAvant })
const fabApres = computed(() => { const m = mvtModal.value; if (!m) return 0; return m.type === 'sortie' ? m.fabAvant - qMvt.value : m.type === 'transfert' ? m.fabAvant + qMvt.value : m.fabAvant })
const mvtTitre = computed(() => { const m = mvtModal.value; if (!m) return ''; return m.type === 'entree' ? 'Entrée — Stock MP' : m.type === 'sortie' ? 'Sortie — Fabrication' : 'Transfert — MP → Fabrication' })
async function validerMvt() {
  const m = mvtModal.value; const q = qMvt.value
  if (q <= 0) { erreur.value = 'Quantité invalide.'; return }
  const empl = m.type === 'entree' ? 'mp' : 'fab'
  const ri = await supabase.from('mouvements_consommables').insert({ consommable_id: m.consommable_id, type: m.type, quantite: q, date_mvt: m.date_mvt, atelier: m.atelier || null, motif: m.motif || null, emplacement: empl })
  if (ri.error) { erreur.value = ri.error.message; return }
  const upd = {}
  if (m.type === 'entree') upd.stock_mp = mpApres.value
  else if (m.type === 'sortie') upd.stock_fab = fabApres.value
  else { upd.stock_mp = mpApres.value; upd.stock_fab = fabApres.value }
  const ru = await supabase.from('consommables').update(upd).eq('id', m.consommable_id)
  if (ru.error) erreur.value = ru.error.message
  mvtModal.value = null; message.value = 'Mouvement enregistré.'; await charger()
}

// ================= Commandes & approvisionnement =================
const vueConso = ref('stock')          // 'stock' | 'cmd'
const commandes = ref([])
const cmdDispo = ref(true)             // false tant que la table n'existe pas (migration 014)
const cmdModal = ref(null)
const receptionModal = ref(null)
const filtreCmd = ref('ouvertes')      // 'ouvertes' | 'toutes'
const STATUT_LBL = { en_cours: 'En cours', partielle: 'Partielle', recue: 'Reçue', annulee: 'Annulée' }

async function chargerCommandes() {
  const r = await supabase.from('commandes_consommables').select('*').order('date_commande', { ascending: false }).order('id', { ascending: false })
  if (r.error) { cmdDispo.value = false; commandes.value = []; return }
  cmdDispo.value = true; commandes.value = r.data || []
}

const cmdOuverte = (c) => c.statut === 'en_cours' || c.statut === 'partielle'
const resteDe = (c) => Math.max(0, (Number(c.quantite_commandee) || 0) - (Number(c.quantite_recue) || 0))
const commandesAff = computed(() => commandes.value.filter(c => filtreCmd.value === 'toutes' || cmdOuverte(c)))
const nbCmdOuvertes = computed(() => commandes.value.filter(cmdOuverte).length)
const valeurEngagee = computed(() => commandes.value.filter(cmdOuverte).reduce((s, c) => s + resteDe(c) * (Number(c.prix_unitaire) || 0), 0))
const nbCmdRetard = computed(() => commandes.value.filter(c => cmdOuverte(c) && c.date_prevue && c.date_prevue < ajKey.value).length)
const enCommandeParArticle = computed(() => { const m = {}; for (const c of commandes.value) if (cmdOuverte(c)) m[c.consommable_id] = (m[c.consommable_id] || 0) + resteDe(c); return m })
const enCommandeDe = (id) => enCommandeParArticle.value[id] || 0

// Suggestions d'approvisionnement : articles sous seuil MP (ou couverture < 14 j).
// Qté à commander = cible − stock MP − déjà commandé ; cible = 2× seuil MP (ou 30 j de conso à défaut de seuil).
const CIBLE_FACTEUR = 2
function qteSuggereeDe(c) {
  const seuil = seMp(c)
  const cible = seuil > 0 ? seuil * CIBLE_FACTEUR : Math.ceil(moyJourDe(c.id) * 30)
  return Math.max(0, Math.round(cible - sMp(c) - enCommandeDe(c.id)))
}
const suggestions = computed(() => consommables.value
  .filter(c => etatMp(c) === 'rupture' || etatMp(c) === 'alerte' || (couvMpJ(c) !== null && couvMpJ(c) < 14))
  .map(c => ({ c, qte: qteSuggereeDe(c), enCommande: enCommandeDe(c.id) }))
  .filter(x => x.qte > 0)
  .sort((a, b) => ((etatMp(b.c) === 'rupture') - (etatMp(a.c) === 'rupture')) || b.qte - a.qte))
const nbSuggestions = computed(() => suggestions.value.length)

function nouvelleCommande(c = null) {
  cmdModal.value = {
    id: null,
    consommable_id: c ? c.id : (consommables.value[0]?.id ?? null),
    fournisseur: '', reference_commande: '',
    quantite_commandee: c ? qteSuggereeDe(c) : 0,
    prix_unitaire: c ? (Number(c.prix_unitaire) || 0) : 0,
    date_commande: ajKey.value, date_prevue: '', commentaire: ''
  }
}
function editerCommande(cmd) { cmdModal.value = { ...cmd, date_prevue: cmd.date_prevue || '' } }
function onCmdArticle() { const a = consoById.value[cmdModal.value.consommable_id]; if (a && !cmdModal.value.id) cmdModal.value.prix_unitaire = Number(a.prix_unitaire) || 0 }
async function validerCommande() {
  const m = cmdModal.value
  if (!m.consommable_id) { erreur.value = 'Choisis un article.'; return }
  if ((Number(m.quantite_commandee) || 0) <= 0) { erreur.value = 'Quantité commandée invalide.'; return }
  const art = consoById.value[m.consommable_id]
  const payload = {
    consommable_id: m.consommable_id, fournisseur: m.fournisseur || null, reference_commande: m.reference_commande || null,
    quantite_commandee: Number(m.quantite_commandee) || 0, unite: art ? art.unite : null,
    prix_unitaire: Number(m.prix_unitaire) || 0, date_commande: m.date_commande || ajKey.value,
    date_prevue: m.date_prevue || null, commentaire: m.commentaire || null
  }
  const r = m.id
    ? await supabase.from('commandes_consommables').update(payload).eq('id', m.id)
    : await supabase.from('commandes_consommables').insert({ ...payload, quantite_recue: 0, statut: 'en_cours', emplacement: 'mp' })
  if (r.error) { erreur.value = r.error.message; return }
  cmdModal.value = null; message.value = m.id ? 'Commande modifiée.' : 'Commande créée.'; await chargerCommandes()
}
async function annulerCommande(cmd) {
  if (!confirm('Annuler la commande de « ' + nomDe(cmd.consommable_id) + ' » ?')) return
  const r = await supabase.from('commandes_consommables').update({ statut: 'annulee' }).eq('id', cmd.id)
  if (r.error) { erreur.value = r.error.message; return }
  message.value = 'Commande annulée.'; await chargerCommandes()
}
async function supprimerCommande(cmd) {
  if (!peutSupprimer.value) { erreur.value = 'Suppression réservée à l’administrateur.'; return }
  if (!confirm('Supprimer définitivement cette commande ?')) return
  const r = await supabase.from('commandes_consommables').delete().eq('id', cmd.id)
  if (r.error) { erreur.value = r.error.message; return }
  message.value = 'Commande supprimée.'; await chargerCommandes()
}
// Réception : entrée en Stock MP + mise à jour de la commande (quantité reçue + statut).
function ouvrirReception(cmd) {
  const art = consoById.value[cmd.consommable_id]
  receptionModal.value = { cmd, nom: nomDe(cmd.consommable_id), unite: cmd.unite || (art ? art.unite : ''), quantite: resteDe(cmd), date_mvt: ajKey.value, mpAvant: art ? sMp(art) : 0 }
}
async function validerReception() {
  const r = receptionModal.value; const q = Number(r.quantite) || 0
  if (q <= 0) { erreur.value = 'Quantité reçue invalide.'; return }
  const cmd = r.cmd
  const ri = await supabase.from('mouvements_consommables').insert({ consommable_id: cmd.consommable_id, type: 'entree', quantite: q, date_mvt: r.date_mvt, motif: 'Réception commande' + (cmd.reference_commande ? ' ' + cmd.reference_commande : ''), emplacement: 'mp' })
  if (ri.error) { erreur.value = ri.error.message; return }
  const art = consoById.value[cmd.consommable_id]
  if (art) { const ru = await supabase.from('consommables').update({ stock_mp: sMp(art) + q }).eq('id', cmd.consommable_id); if (ru.error) { erreur.value = ru.error.message; return } }
  const recu = (Number(cmd.quantite_recue) || 0) + q
  const statut = recu >= (Number(cmd.quantite_commandee) || 0) ? 'recue' : 'partielle'
  const rc = await supabase.from('commandes_consommables').update({ quantite_recue: recu, statut }).eq('id', cmd.id)
  if (rc.error) { erreur.value = rc.error.message; return }
  receptionModal.value = null; message.value = 'Réception enregistrée — Stock MP mis à jour.'; await charger()
}
</script>

<template>
  <div class="conso-page">
    <PageHeader title="Gestion des consommables" tone="#b45309"
      subtitle="Deux emplacements de stock par consommable : Stock MP (magasin) et Fabrication. Flux réception → MP → transfert → fabrication → consommation." />

    <p v-if="erreur" class="alert">{{ erreur }}</p>
    <p v-if="message" class="ok" @click="message = ''">{{ message }}</p>

    <div class="conso-tabs">
      <button :class="{ on: vueConso === 'stock' }" @click="vueConso = 'stock'">Stock &amp; mouvements</button>
      <button :class="{ on: vueConso === 'cmd' }" @click="vueConso = 'cmd'">Commandes &amp; approvisionnement<span v-if="nbCmdOuvertes" class="tab-badge">{{ nbCmdOuvertes }}</span></button>
    </div>

    <div v-show="vueConso === 'stock'">
    <div class="kpi-row">
      <div class="kpi"><div class="kpi-v">{{ consommables.length }}</div><div class="kpi-l">Références</div></div>
      <div class="kpi alerte"><div class="kpi-v">{{ nbAlerte }}</div><div class="kpi-l">En alerte (≤ seuil)</div></div>
      <div class="kpi rupture"><div class="kpi-v">{{ nbRupture }}</div><div class="kpi-l">Ruptures (un emplacement vide)</div></div>
      <div class="kpi valeur"><div class="kpi-v">{{ fmtDA(valeurMp) }}</div><div class="kpi-l">Valeur Stock MP</div></div>
      <div class="kpi valeur2"><div class="kpi-v">{{ fmtDA(valeurFab) }}</div><div class="kpi-l">Valeur Fabrication</div></div>
    </div>

    <section class="card">
      <div class="tb">
        <input v-model="recherche" class="search" placeholder="Rechercher un consommable…" />
        <div class="cat-chips">
          <button class="chip" :class="{ on: !catSel }" @click="catSel = ''">Toutes</button>
          <button v-for="c in categories" :key="c" class="chip" :class="{ on: catSel === c }" @click="catSel = (catSel === c ? '' : c)">{{ c }}</button>
        </div>
        <button v-if="peutEditer" class="btn" @click="formOuvert = !formOuvert">＋ Ajouter</button>
      </div>

      <div v-if="formOuvert && peutEditer" class="add-form">
        <input v-model="nouv.nom" class="f-nom" placeholder="Nom (ex. Sac polyéthylène 50 L)" @keyup.enter="ajouter" />
        <input v-model="nouv.reference" class="f-code" placeholder="Code article" />
        <input v-model="nouv.categorie" list="cats" placeholder="Catégorie" />
        <input v-model="nouv.unite" list="unites" placeholder="Unité" />
        <input v-model.number="nouv.prix_unitaire" type="number" step="0.01" placeholder="Prix U. (DA)" />
        <input v-model.number="nouv.stock_mp" type="number" placeholder="Stock MP" />
        <input v-model.number="nouv.stock_fab" type="number" placeholder="Stock Fab." />
        <input v-model.number="nouv.seuil_mp" type="number" placeholder="Seuil MP" />
        <input v-model.number="nouv.seuil_fab" type="number" placeholder="Seuil Fab." />
        <button class="btn" @click="ajouter">Enregistrer</button>
        <button class="btn ghost" @click="formOuvert = false">Annuler</button>
      </div>
      <datalist id="cats"><option v-for="c in CATS_SUGG" :key="c" :value="c" /></datalist>
      <datalist id="unites"><option value="unité" /><option value="paquet" /><option value="boîte" /><option value="rouleau" /><option value="kg" /><option value="L" /><option value="paire" /><option value="carton" /></datalist>

      <div class="tbl-scroll">
        <table class="tbl">
          <thead><tr><th>Consommable</th><th>Code</th><th>Catégorie</th><th>Unité</th><th class="r">Stock MP</th><th class="r">Stock Fab.</th><th class="r">Total</th><th class="r">Prix U.</th><th class="r">Valeur</th><th class="r">Couverture</th><th v-if="peutEditer" class="r">Actions</th></tr></thead>
          <tbody>
            <tr v-for="c in filtres" :key="c.id">
              <td class="nom">{{ c.nom }}</td>
              <td class="code">{{ c.reference || '—' }}</td>
              <td>{{ c.categorie || '—' }}</td>
              <td class="unit">{{ c.unite }}</td>
              <td class="r stock2" :class="etatMp(c)"><b>{{ fmt(sMp(c)) }}</b><span class="sub">seuil {{ fmt(seMp(c)) }}</span></td>
              <td class="r stock2" :class="etatFab(c)"><b>{{ fmt(sFab(c)) }}</b><span class="sub">seuil {{ fmt(seFab(c)) }}</span></td>
              <td class="r tot-stock">{{ fmt(totalStock(c)) }}</td>
              <td class="r prix">{{ c.prix_unitaire ? fmtDA(c.prix_unitaire) : '—' }}</td>
              <td class="r val">{{ valeurDe(c) ? fmtDA(valeurDe(c)) : '—' }}</td>
              <td class="r couv2" :title="'Consommation moyenne : ' + fmt(Math.round(moyJourDe(c.id) * 10) / 10) + ' ' + c.unite + '/jour (90 j)'">
                <span :class="couvClass(couvFabJ(c))">Fab {{ couvLabel(couvFabJ(c)) }}</span>
                <span :class="couvClass(couvMpJ(c))">MP {{ couvLabel(couvMpJ(c)) }}</span>
              </td>
              <td v-if="peutEditer" class="r act">
                <button class="mini in" @click="ouvrirMvt(c, 'entree')" title="Entrée au Stock MP">＋</button>
                <button class="mini tr" @click="ouvrirMvt(c, 'transfert')" title="Transfert MP → Fabrication">⇄</button>
                <button class="mini out" @click="ouvrirMvt(c, 'sortie')" title="Sortie (consommation) depuis la Fabrication">－</button>
                <button class="mini" @click="editer(c)" title="Modifier">✎</button>
                <button v-if="peutSupprimer" class="mini danger" @click="supprimer(c)" title="Supprimer">✕</button>
              </td>
            </tr>
            <tr v-if="!filtres.length"><td :colspan="peutEditer ? 11 : 10" class="vide">Aucun consommable. Clique « ＋ Ajouter » pour commencer.</td></tr>
          </tbody>
          <tfoot v-if="filtres.length">
            <tr class="tot"><td colspan="8">Total valeur du stock (MP + Fabrication)</td><td class="r val">{{ fmtDA(valeurFiltree) }}</td><td :colspan="peutEditer ? 2 : 1"></td></tr>
          </tfoot>
        </table>
      </div>
    </section>


    <section class="card">
      <h2 class="card-title">Derniers mouvements</h2>
      <div class="tbl-scroll">
        <table class="tbl">
          <thead><tr><th>Date</th><th>Consommable</th><th>Type</th><th>Emplacement</th><th class="r">Qté</th><th>Atelier / service</th><th>Motif</th></tr></thead>
          <tbody>
            <tr v-for="m in mvtsAffiches" :key="m.id">
              <td>{{ fmtDate(m.date_mvt) }}</td>
              <td class="nom">{{ nomDe(m.consommable_id) }}</td>
              <td><span class="mtag" :class="m.type">{{ labelType(m.type) }}</span></td>
              <td class="empl">{{ emplLabel(m) }}</td>
              <td class="r" :class="m.type === 'sortie' ? 'q-out' : m.type === 'entree' ? 'q-in' : 'q-tr'">{{ m.type === 'sortie' ? '−' : m.type === 'entree' ? '+' : '⇄' }}{{ fmt(m.quantite) }}</td>
              <td>{{ m.atelier || '—' }}</td>
              <td class="motif">{{ m.motif || '—' }}</td>
            </tr>
            <tr v-if="!mvtsAffiches.length"><td colspan="7" class="vide">Aucun mouvement enregistré.</td></tr>
          </tbody>
        </table>
      </div>
    </section>
    </div><!-- /vue stock -->

    <div v-show="vueConso === 'cmd'">
      <p v-if="!cmdDispo" class="alert">La table des commandes n'est pas encore créée. Exécute la migration <b>014</b> dans Supabase (SQL Editor) pour activer ce module.</p>

      <div class="kpi-row">
        <div class="kpi"><div class="kpi-v">{{ nbCmdOuvertes }}</div><div class="kpi-l">Commandes en cours</div></div>
        <div class="kpi valeur"><div class="kpi-v">{{ fmtDA(valeurEngagee) }}</div><div class="kpi-l">Valeur engagée (reste à livrer)</div></div>
        <div class="kpi rupture"><div class="kpi-v">{{ nbCmdRetard }}</div><div class="kpi-l">Livraisons en retard</div></div>
        <div class="kpi alerte"><div class="kpi-v">{{ nbSuggestions }}</div><div class="kpi-l">Articles à commander</div></div>
      </div>

      <section class="card">
        <div class="tb">
          <h2 class="card-title" style="margin:0">Suggestions d'approvisionnement</h2>
          <span class="sugg-note">Sous seuil MP ou couverture &lt; 14 jours · quantité proposée pour revenir à 2× le seuil</span>
        </div>
        <div class="tbl-scroll">
          <table class="tbl">
            <thead><tr><th>Consommable</th><th class="r">Stock MP</th><th class="r">Seuil MP</th><th class="r">Couverture</th><th class="r">Conso/j</th><th class="r">Déjà commandé</th><th class="r">À commander</th><th v-if="peutEditer" class="r">Action</th></tr></thead>
            <tbody>
              <tr v-for="s in suggestions" :key="s.c.id">
                <td class="nom">{{ s.c.nom }}<span v-if="s.c.reference" class="sub2"> · {{ s.c.reference }}</span></td>
                <td class="r" :class="etatMp(s.c)"><b>{{ fmt(sMp(s.c)) }}</b></td>
                <td class="r">{{ fmt(seMp(s.c)) }}</td>
                <td class="r"><span :class="couvClass(couvMpJ(s.c))">{{ couvLabel(couvMpJ(s.c)) }}</span></td>
                <td class="r">{{ moyJourDe(s.c.id) ? (Math.round(moyJourDe(s.c.id) * 10) / 10) : '—' }}</td>
                <td class="r">{{ s.enCommande ? fmt(s.enCommande) : '—' }}</td>
                <td class="r sugg-qte">{{ fmt(s.qte) }} {{ s.c.unite }}</td>
                <td v-if="peutEditer" class="r"><button class="btn-sm" :disabled="!cmdDispo" @click="nouvelleCommande(s.c)">Commander</button></td>
              </tr>
              <tr v-if="!suggestions.length"><td :colspan="peutEditer ? 8 : 7" class="vide">Aucun réapprovisionnement nécessaire pour le moment. 👍</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <div class="tb">
          <h2 class="card-title" style="margin:0">Commandes {{ filtreCmd === 'ouvertes' ? 'en cours' : '(toutes)' }}</h2>
          <div class="seg">
            <button :class="{ on: filtreCmd === 'ouvertes' }" @click="filtreCmd = 'ouvertes'">En cours</button>
            <button :class="{ on: filtreCmd === 'toutes' }" @click="filtreCmd = 'toutes'">Toutes</button>
          </div>
          <button v-if="peutEditer" class="btn" style="margin-left:auto" :disabled="!cmdDispo" @click="nouvelleCommande()">＋ Nouvelle commande</button>
        </div>
        <div class="tbl-scroll">
          <table class="tbl">
            <thead><tr><th>Article</th><th>Fournisseur</th><th>N° BC</th><th>Commandé le</th><th>Prévu</th><th class="r">Qté</th><th class="r">Reçu</th><th class="r">Reste</th><th>Statut</th><th class="r">Valeur reste</th><th v-if="peutEditer" class="r">Actions</th></tr></thead>
            <tbody>
              <tr v-for="c in commandesAff" :key="c.id" :class="{ 'row-retard': cmdOuverte(c) && c.date_prevue && c.date_prevue < ajKey }">
                <td class="nom">{{ nomDe(c.consommable_id) }}</td>
                <td>{{ c.fournisseur || '—' }}</td>
                <td>{{ c.reference_commande || '—' }}</td>
                <td class="nowrap-a">{{ fmtDate(c.date_commande) }}</td>
                <td class="nowrap-a" :class="{ 'txt-retard': cmdOuverte(c) && c.date_prevue && c.date_prevue < ajKey }">{{ fmtDate(c.date_prevue) }}</td>
                <td class="r">{{ fmt(c.quantite_commandee) }}</td>
                <td class="r">{{ fmt(c.quantite_recue) }}</td>
                <td class="r">{{ fmt(resteDe(c)) }}</td>
                <td><span class="stag" :class="c.statut">{{ STATUT_LBL[c.statut] || c.statut }}</span></td>
                <td class="r">{{ fmtDA(resteDe(c) * (Number(c.prix_unitaire) || 0)) }}</td>
                <td v-if="peutEditer" class="r nowrap-a">
                  <button v-if="cmdOuverte(c)" class="btn-sm ok" @click="ouvrirReception(c)" title="Réceptionner (entrée Stock MP)">⇣ Recevoir</button>
                  <button class="icon-b" @click="editerCommande(c)" title="Modifier">✎</button>
                  <button v-if="cmdOuverte(c)" class="icon-b" @click="annulerCommande(c)" title="Annuler">⦸</button>
                  <button v-if="peutSupprimer" class="icon-b danger" @click="supprimerCommande(c)" title="Supprimer">🗑</button>
                </td>
              </tr>
              <tr v-if="!commandesAff.length"><td :colspan="peutEditer ? 11 : 10" class="vide">Aucune commande{{ filtreCmd === 'ouvertes' ? ' en cours' : '' }}.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div><!-- /vue cmd -->

    <div v-if="mvtModal" class="modal-back" @click.self="mvtModal = null">
      <div class="modal">
        <div class="modal-h" :class="mvtModal.type"><span>{{ mvtTitre }} — {{ mvtModal.nom }}</span><button class="x" @click="mvtModal = null">✕</button></div>
        <div class="modal-b">
          <label>Quantité ({{ mvtModal.unite }})<input v-model.number="mvtModal.quantite" type="number" min="0" /></label>
          <label>Date<input v-model="mvtModal.date_mvt" type="date" /></label>
          <label v-if="mvtModal.type !== 'entree'">Atelier / service<input v-model="mvtModal.atelier" placeholder="(optionnel)" /></label>
          <label>Motif<input v-model="mvtModal.motif" placeholder="(optionnel)" /></label>
          <p v-if="mvtModal.type === 'entree'" class="modal-info">Stock MP : <b>{{ fmt(mvtModal.mpAvant) }}</b> → après : <b>{{ fmt(mpApres) }}</b></p>
          <p v-else-if="mvtModal.type === 'sortie'" class="modal-info">Stock Fab. : <b>{{ fmt(mvtModal.fabAvant) }}</b> → après : <b :class="fabApres < 0 ? 'neg' : ''">{{ fmt(fabApres) }}</b></p>
          <p v-else class="modal-info">
            Stock MP : <b>{{ fmt(mvtModal.mpAvant) }}</b> → <b :class="mpApres < 0 ? 'neg' : ''">{{ fmt(mpApres) }}</b><br>
            Fabrication : <b>{{ fmt(mvtModal.fabAvant) }}</b> → <b>{{ fmt(fabApres) }}</b>
            <span v-if="mpApres < 0" class="modal-warn">Quantité supérieure au stock MP disponible.</span>
          </p>
        </div>
        <div class="modal-f"><button class="btn ghost" @click="mvtModal = null">Annuler</button><button class="btn" @click="validerMvt">Valider</button></div>
      </div>
    </div>

    <div v-if="editModal" class="modal-back" @click.self="editModal = null">
      <div class="modal modal-lg">
        <div class="modal-h"><span>Modifier — {{ editModal.nom }}</span><button class="x" @click="editModal = null">✕</button></div>
        <div class="modal-b">
          <label>Nom<input v-model="editModal.nom" /></label>
          <label>Catégorie<input v-model="editModal.categorie" list="cats" /></label>
          <label>Unité<input v-model="editModal.unite" list="unites" /></label>
          <label>Code article<input v-model="editModal.reference" placeholder="(optionnel)" /></label>
          <label>Prix unitaire (DA)<input v-model.number="editModal.prix_unitaire" type="number" step="0.01" /></label>
          <div class="modal-grid2">
            <label>Stock MP (correction)<input v-model.number="editModal.stock_mp" type="number" /></label>
            <label>Stock Fab. (correction)<input v-model.number="editModal.stock_fab" type="number" /></label>
            <label>Seuil MP<input v-model.number="editModal.seuil_mp" type="number" /></label>
            <label>Seuil Fab.<input v-model.number="editModal.seuil_fab" type="number" /></label>
          </div>
        </div>
        <div class="modal-f"><button class="btn ghost" @click="editModal = null">Annuler</button><button class="btn" @click="validerEdit">Enregistrer</button></div>
      </div>
    </div>

    <!-- Commande : créer / modifier -->
    <div v-if="cmdModal" class="modal-back" @click.self="cmdModal = null">
      <div class="modal modal-lg">
        <div class="modal-h"><span>{{ cmdModal.id ? 'Modifier la commande' : 'Nouvelle commande' }}</span><button class="x" @click="cmdModal = null">✕</button></div>
        <div class="modal-b">
          <label>Article
            <select v-model.number="cmdModal.consommable_id" @change="onCmdArticle">
              <option v-for="c in consommables" :key="c.id" :value="c.id">{{ c.nom }}{{ c.reference ? ' · ' + c.reference : '' }}</option>
            </select>
          </label>
          <div class="modal-grid2">
            <label>Fournisseur<input v-model="cmdModal.fournisseur" placeholder="(optionnel)" /></label>
            <label>N° bon de commande<input v-model="cmdModal.reference_commande" placeholder="(optionnel)" /></label>
            <label>Quantité commandée<input v-model.number="cmdModal.quantite_commandee" type="number" min="0" /></label>
            <label>Prix unitaire (DA)<input v-model.number="cmdModal.prix_unitaire" type="number" step="0.01" /></label>
            <label>Date de commande<input v-model="cmdModal.date_commande" type="date" /></label>
            <label>Livraison prévue<input v-model="cmdModal.date_prevue" type="date" /></label>
          </div>
          <label>Commentaire<input v-model="cmdModal.commentaire" placeholder="(optionnel)" /></label>
          <p class="modal-info">Montant estimé : <b>{{ fmtDA((Number(cmdModal.quantite_commandee) || 0) * (Number(cmdModal.prix_unitaire) || 0)) }}</b></p>
        </div>
        <div class="modal-f"><button class="btn ghost" @click="cmdModal = null">Annuler</button><button class="btn" @click="validerCommande">{{ cmdModal.id ? 'Enregistrer' : 'Créer la commande' }}</button></div>
      </div>
    </div>

    <!-- Réception d'une commande -->
    <div v-if="receptionModal" class="modal-back" @click.self="receptionModal = null">
      <div class="modal">
        <div class="modal-h entree"><span>Réception — {{ receptionModal.nom }}</span><button class="x" @click="receptionModal = null">✕</button></div>
        <div class="modal-b">
          <label>Quantité reçue ({{ receptionModal.unite }})<input v-model.number="receptionModal.quantite" type="number" min="0" /></label>
          <label>Date de réception<input v-model="receptionModal.date_mvt" type="date" /></label>
          <p class="modal-info">Entrée en <b>Stock MP</b> : {{ fmt(receptionModal.mpAvant) }} → <b>{{ fmt(receptionModal.mpAvant + (Number(receptionModal.quantite) || 0)) }}</b></p>
          <p class="modal-info">Reste à livrer après : <b>{{ fmt(Math.max(0, resteDe(receptionModal.cmd) - (Number(receptionModal.quantite) || 0))) }}</b></p>
        </div>
        <div class="modal-f"><button class="btn ghost" @click="receptionModal = null">Annuler</button><button class="btn" @click="validerReception">Valider la réception</button></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.conso-page { color: #1b2733; }
.alert { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 10px 14px; border-radius: 8px; margin: 0 0 14px; }
.ok { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 10px 14px; border-radius: 8px; margin: 0 0 14px; cursor: pointer; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 18px; margin-bottom: 18px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-title { margin: 0 0 12px; font-size: 16px; }
.kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 18px; }
.kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; border-left: 4px solid #b45309; }
.kpi-v { font-size: 26px; font-weight: 800; color: #0f172a; line-height: 1.1; }
.kpi-l { font-size: 12px; color: #64748b; font-weight: 600; margin-top: 3px; }
.kpi.alerte { border-left-color: #d97706; } .kpi.alerte .kpi-v { color: #b45309; }
.kpi.rupture { border-left-color: #dc2626; } .kpi.rupture .kpi-v { color: #dc2626; }
.kpi.valeur { border-left-color: #0d9488; } .kpi.valeur .kpi-v { color: #0f766e; font-size: 20px; }
.kpi.valeur2 { border-left-color: #6366f1; } .kpi.valeur2 .kpi-v { color: #4f46e5; font-size: 20px; }

.tb { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.search { flex: 1 1 240px; min-width: 200px; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 14px; }
.cat-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chip { padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 999px; background: #fff; color: #475569; font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; }
.chip:hover { border-color: #fcd34d; background: #fffbeb; }
.chip.on { background: #b45309; border-color: #b45309; color: #fff; }
.btn { background: #b45309; color: #fff; border: 0; padding: 9px 16px; border-radius: 8px; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; white-space: nowrap; }
.btn.ghost { background: #fff; color: #475569; border: 1px solid #cbd5e1; }
.add-form { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 11px; margin-bottom: 12px; }
.add-form input { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 7px; font: inherit; font-size: 13px; width: 110px; }
.add-form .f-nom { flex: 1 1 220px; width: auto; min-width: 200px; }
.add-form .f-code { width: 120px; }
.tbl td.code { font-family: ui-monospace, monospace; font-size: 12px; color: #475569; }
.tbl td.prix, .tbl td.val { font-variant-numeric: tabular-nums; white-space: nowrap; }
.tbl td.val { font-weight: 700; color: #0f766e; }
.tbl tfoot .tot td { border-top: 2px solid #e2e8f0; font-weight: 800; background: #f8fafc; color: #0f172a; }
.tbl tfoot .tot .val { color: #0f766e; }

.tbl-scroll { overflow-x: auto; }
.tbl { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.tbl th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; font-weight: 800; padding: 8px 12px; border-bottom: 2px solid #eef2f6; white-space: nowrap; }
.tbl td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; }
.tbl th.r, .tbl td.r { text-align: right; }
.tbl td.nom { font-weight: 700; color: #0f172a; }
.tbl td.unit { color: #64748b; }
.stock2 { font-variant-numeric: tabular-nums; white-space: nowrap; }
.stock2 b { font-weight: 800; display: block; }
.stock2 .sub { font-size: 10px; font-weight: 600; color: #94a3b8; }
.stock2.ok b { color: #0f172a; } .stock2.alerte b { color: #b45309; } .stock2.rupture b { color: #dc2626; }
.stock2.alerte { background: #fffbeb; } .stock2.rupture { background: #fef2f2; }
.tot-stock { font-weight: 800; font-variant-numeric: tabular-nums; color: #0f172a; }
.couv2 { white-space: nowrap; font-variant-numeric: tabular-nums; }
.couv2 span { display: block; font-size: 11.5px; font-weight: 700; }
.couv-ok { color: #15803d; } .couv-moy { color: #b45309; } .couv-bas { color: #dc2626; } .couv-none { color: #cbd5e1; }
.badge { font-size: 11px; font-weight: 800; padding: 2px 9px; border-radius: 999px; }
.act { white-space: nowrap; }
.mini { width: 28px; height: 26px; border: 1px solid #e2e8f0; background: #f8fafc; color: #475569; border-radius: 6px; cursor: pointer; font-size: 13px; margin-left: 3px; }
.mini:hover { background: #eef2f6; }
.mini.in { color: #15803d; border-color: #bbf7d0; } .mini.in:hover { background: #dcfce7; }
.mini.tr { color: #4f46e5; border-color: #c7d2fe; } .mini.tr:hover { background: #e0e7ff; }
.mini.out { color: #b45309; border-color: #fde68a; } .mini.out:hover { background: #fef3c7; }
.mini.danger { color: #dc2626; } .mini.danger:hover { background: #fee2e2; border-color: #fecaca; }
.vide { text-align: center; color: #94a3b8; padding: 22px; }
.mtag { font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 6px; }
.mtag.entree { background: #dcfce7; color: #166534; } .mtag.sortie { background: #fef3c7; color: #92400e; } .mtag.ajustement { background: #e2e8f0; color: #475569; } .mtag.transfert { background: #e0e7ff; color: #4338ca; }
.empl { color: #475569; font-weight: 600; font-size: 12.5px; }
.q-in { color: #15803d; font-weight: 700; } .q-out { color: #b45309; font-weight: 700; } .q-tr { color: #4f46e5; font-weight: 700; }
.motif { color: #475569; }

.conso-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.conso-head .card-title { margin: 0; }
.mois-sel { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13.5px; font-weight: 700; color: #334155; background: #fff; text-transform: capitalize; cursor: pointer; }
.conso-kpi { grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); margin-bottom: 4px; }
.conso-sub { margin: 18px 0 10px; font-size: 12px; font-weight: 800; color: #b45309; text-transform: uppercase; letter-spacing: .04em; }
.vide-p { color: #94a3b8; font-size: 13px; margin: 6px 0 0; }
.daybars { display: flex; align-items: flex-end; gap: 3px; height: 130px; padding: 6px 2px 0; overflow-x: auto; border-bottom: 1px solid #f1f5f9; }
.daybar { flex: 1 0 15px; min-width: 15px; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 3px; }
.db-fill { width: 68%; min-height: 2px; background: #f59e0b; border-radius: 3px 3px 0 0; transition: height .2s; }
.daybar:hover .db-fill { background: #b45309; }
.daybar.auj .db-fill { background: #0d9488; }
.db-lbl { font-size: 9.5px; color: #94a3b8; font-weight: 700; }
.tbl td .u { font-size: 11px; color: #94a3b8; font-weight: 600; }

.evo-ctrl { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.seg { display: inline-flex; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; }
.seg button { border: 0; background: #fff; color: #475569; font: inherit; font-size: 12.5px; font-weight: 700; padding: 7px 13px; cursor: pointer; }
.seg button + button { border-left: 1px solid #e2e8f0; }
.seg button.on { background: #b45309; color: #fff; }
.monthbars { display: flex; align-items: flex-end; gap: 8px; height: 120px; padding: 6px 2px 0; }
.monthbar { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 4px; }
.mb-fill { width: 58%; min-height: 2px; background: #f59e0b; border-radius: 4px 4px 0 0; transition: height .2s; }
.monthbar:hover .mb-fill { background: #b45309; }
.mb-lbl { font-size: 10.5px; color: #94a3b8; font-weight: 700; }
.evo-note { font-size: 12px; color: #94a3b8; margin: 10px 0 14px; }
.evo-tbl th.mo { min-width: 50px; }
.evo-tbl .cell { font-variant-numeric: tabular-nums; font-size: 12px; text-align: right; }
.evo-tbl tfoot .tot td { border-top: 2px solid #e2e8f0; font-weight: 800; background: #f8fafc; color: #0f172a; font-variant-numeric: tabular-nums; }
.art-sel { max-width: 220px; text-transform: none; }

.modal-back { position: fixed; inset: 0; background: rgba(15,23,42,.45); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 16px; }
.modal { background: #fff; border-radius: 14px; width: 440px; max-width: 94vw; box-shadow: 0 24px 60px rgba(2,8,23,.3); overflow: hidden; }
.modal.modal-lg { width: 620px; }
.modal-h { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 13px 16px; background: #f1f5f9; font-weight: 800; font-size: 14px; color: #0f172a; }
.modal-h.entree { background: #dcfce7; } .modal-h.sortie { background: #fef3c7; } .modal-h.transfert { background: #e0e7ff; }
.modal-h .x { background: none; border: 0; font-size: 18px; color: #64748b; cursor: pointer; }
.modal-b { padding: 16px; display: flex; flex-direction: column; gap: 11px; }
.modal-b label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 700; color: #475569; }
.modal-b input { padding: 9px 11px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 14px; }
.modal-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 11px; }
.modal-info { margin: 2px 0 0; font-size: 13px; color: #475569; background: #f8fafc; border: 1px solid #eef2f6; border-radius: 8px; padding: 8px 11px; line-height: 1.6; }
.modal-info .neg { color: #dc2626; }

/* ---- Commandes & approvisionnement ---- */
.conso-tabs { display: inline-flex; gap: 3px; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 4px; margin: 0 0 16px; }
.conso-tabs button { border: 0; background: none; font-size: 13px; font-weight: 700; color: #9a6a3a; padding: 8px 16px; border-radius: 7px; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; }
.conso-tabs button.on { background: #b45309; color: #fff; }
.tab-badge { background: #dc2626; color: #fff; font-size: 11px; font-weight: 800; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; }
.conso-tabs button.on .tab-badge { background: #fff; color: #b45309; }
.seg { display: inline-flex; gap: 2px; background: #f1f5f9; border-radius: 8px; padding: 3px; }
.seg button { border: 0; background: none; font-size: 12.5px; font-weight: 700; color: #64748b; padding: 5px 12px; border-radius: 6px; cursor: pointer; }
.seg button.on { background: #fff; color: #b45309; box-shadow: 0 1px 2px rgba(16,24,40,.1); }
.sugg-note { font-size: 12px; color: #94a3b8; font-weight: 600; }
.sub2 { color: #94a3b8; font-weight: 400; font-size: 12px; }
.sugg-qte { font-weight: 800; color: #b45309; }
.tbl td.rupture { color: #dc2626; } .tbl td.alerte { color: #b45309; }
.stag { font-size: 11px; font-weight: 800; padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
.stag.en_cours { background: #eff6ff; color: #1d4ed8; }
.stag.partielle { background: #fff7ed; color: #b45309; }
.stag.recue { background: #f0fdf4; color: #15803d; }
.stag.annulee { background: #f1f5f9; color: #94a3b8; }
.row-retard { background: #fff7f7; }
.txt-retard { color: #dc2626; font-weight: 800; }
.btn-sm { border: 1px solid #c7d2fe; background: #eef2ff; color: #4338ca; font-weight: 700; font-size: 12px; padding: 4px 10px; border-radius: 7px; cursor: pointer; white-space: nowrap; }
.btn-sm.ok { border-color: #bbf7d0; background: #f0fdf4; color: #15803d; }
.btn-sm:hover { filter: brightness(.97); }
.btn-sm:disabled { opacity: .5; cursor: not-allowed; }
.icon-b { border: 1px solid #e2e8f0; background: #fff; color: #475569; font-size: 13px; padding: 4px 8px; border-radius: 7px; cursor: pointer; margin-left: 4px; }
.icon-b.danger { color: #dc2626; border-color: #fecaca; }
.icon-b:hover { background: #f8fafc; }
.nowrap-a { white-space: nowrap; }
.modal-warn { display: block; color: #b91c1c; font-weight: 700; font-size: 12px; margin-top: 4px; }
.modal-f { display: flex; justify-content: flex-end; gap: 8px; padding: 13px 16px; border-top: 1px solid #eef2f6; }
</style>
