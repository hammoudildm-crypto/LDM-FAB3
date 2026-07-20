// =====================================================================
// ProdTrack — Rapport hebdomadaire (PPTX) pour l'atelier
// Interroge Supabase, calcule les KPI, génère un PowerPoint.
// Lancé chaque semaine par GitHub Actions (ou à la main : node rapport_hebdo.mjs)
// =====================================================================
import { createClient } from '@supabase/supabase-js'
import pptxgen from 'pptxgenjs'
import fs from 'fs'

const SUPABASE_URL = 'https://lpojdepnssxpnsqrrwoc.supabase.co'
const SUPABASE_KEY = 'sb_publishable_dyH_MussLiMxLVcjE3QoEA_E2h0XEHw'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const MOCK = process.argv.includes('--mock')

// --- Récupération paginée (contourne la limite de 1000 lignes) ---
async function fetchAll(table, select) {
  const out = []
  let from = 0, size = 1000
  for (;;) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + size - 1)
    if (error) { console.error(`Erreur ${table}:`, error.message); break }
    out.push(...(data || []))
    if (!data || data.length < size) break
    from += size
  }
  return out
}

const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('fr-FR')
const pct = (n) => (Number(n) || 0).toFixed(1) + ' %'

// --- Calcul des KPI ---
async function collecte() {
  const annee = new Date().getFullYear()
  const semaine = new Date(); semaine.setDate(semaine.getDate() - 7)

  const [ofs, conds, produits, planRows, phases, cadences, trsPostes] = await Promise.all([
    fetchAll('ordres_fabrication', 'id, numero_lot, produit_id, statut, boites_fabriquees, quantite_theorique, date_fin_fabrication'),
    fetchAll('conditionnement', 'ordre_id, quantite_conditionnee, date_conditionnement, date_fin, actif'),
    fetchAll('produits', 'id, code_pf, designation, unites_par_boite, taille_lot, pcsu'),
    fetchAll('plan_production', 'annee, mois, quantite_planifiee'),
    fetchAll('suivi_phases', 'ordre_id, quantite_sortie, actif'),
    fetchAll('cadences_produit', 'equipement_id, produit_id, mode, cadence_nominale'),
    fetchAll('trs_postes', 'equipement_id, produit_id, date, temps_ouverture_min, arret_panne_min, arret_format_min, arret_nettoyage_min, arret_reglage_min, arret_maintenance_min, arret_attente_min, arret_autre_min, production_realisee, rebuts, actif'),
  ])

  const prodMap = {}; for (const p of produits) prodMap[p.id] = p
  const ofMap = {}; for (const o of ofs) ofMap[o.id] = o
  const upbOf = (o) => Number((prodMap[o.produit_id] || {}).unites_par_boite || 0)

  // Fabrication
  let fabBoxes = 0, fabTheo = 0, fabBoxesSem = 0, fabLots = 0, fabLotsSem = 0
  for (const o of ofs) {
    if (!o.date_fin_fabrication) continue
    const d = new Date(o.date_fin_fabrication), b = Number(o.boites_fabriquees || 0)
    const fini = o.statut === 'Terminé' || o.statut === 'Libéré'
    if (d.getFullYear() === annee && fini && b > 0) { fabBoxes += b; fabTheo += Number(o.quantite_theorique || 0); fabLots++ }
    if (d >= semaine && b > 0) { fabBoxesSem += b; fabLotsSem++ }
  }
  const rdtFab = fabTheo ? (fabBoxes / fabTheo) * 100 : 0

  // Conditionnement
  const condActifs = conds.filter(c => c.actif !== false)
  let condBoxes = 0, condBoxesSem = 0
  const condLotsSem = new Set(), condTheoIds = new Set()
  for (const c of condActifs) {
    if (!c.date_conditionnement) continue
    const o = ofMap[c.ordre_id]; if (!o) continue
    const upb = upbOf(o); if (upb <= 0) continue
    const boxes = Math.floor(Number(c.quantite_conditionnee || 0) / upb)
    const d = new Date(c.date_conditionnement)
    if (d.getFullYear() === annee) { condBoxes += boxes; condTheoIds.add(c.ordre_id) }
    if (d >= semaine) { condBoxesSem += boxes; condLotsSem.add(c.ordre_id) }
  }
  let condTheo = 0
  for (const id of condTheoIds) { const o = ofMap[id]; if (o) condTheo += Number(o.quantite_theorique || 0) }
  const rdtCond = condTheo ? (condBoxes / condTheo) * 100 : 0

  // Plan (PDP)
  let plan = 0
  for (const r of planRows) if (Number(r.annee) === annee) plan += Number(r.quantite_planifiee || 0)

  // Vrac en attente
  const condOrdreIds = new Set(condActifs.map(c => c.ordre_id))
  let vracBoxes = 0
  for (const o of ofs) {
    if (!o.date_fin_fabrication || condOrdreIds.has(o.id)) continue
    vracBoxes += Number(o.boites_fabriquees || 0)
  }

  // Alertes
  let phasesACompleter = 0
  for (const sp of phases) {
    if (sp.actif === false) continue
    if (Number(sp.quantite_sortie || 0) > 0) continue
    const o = ofMap[sp.ordre_id]
    if (o && o.date_fin_fabrication) phasesACompleter++
  }
  let condACompleter = 0
  for (const c of condActifs) if (c.date_fin && !(Number(c.quantite_conditionnee) > 0)) condACompleter++

  // TRS de la semaine (pondéré par le temps d'ouverture)
  const cadMap = {}; for (const c of cadences) cadMap[c.equipement_id + '|' + c.produit_id] = c
  const AR = ['arret_panne_min','arret_format_min','arret_nettoyage_min','arret_reglage_min','arret_maintenance_min','arret_attente_min','arret_autre_min']
  let sOuv = 0, sTrs = 0, sDispo = 0, sPerf = 0, sQual = 0, nPostes = 0
  for (const t of trsPostes) {
    if (t.actif === false) continue
    const d = new Date(t.date); if (d < semaine) continue
    const ouverture = Number(t.temps_ouverture_min || 0); if (ouverture <= 0) continue
    const arr = AR.reduce((s, k) => s + Number(t[k] || 0), 0)
    const fonct = Math.max(0, ouverture - arr)
    const dispo = ouverture ? fonct / ouverture : 0
    const cad = cadMap[t.equipement_id + '|' + t.produit_id]
    const prod = Number(t.production_realisee || 0)
    let perf = 0, qual = 1
    if (cad && cad.mode === 'cycle') { perf = fonct ? Math.min(1, prod / fonct) : 0 }
    else if (cad && Number(cad.cadence_nominale) > 0) {
      const theo = (fonct / 60) * Number(cad.cadence_nominale)
      perf = theo ? Math.min(1, prod / theo) : 0
      const reb = Number(t.rebuts || 0)
      qual = prod > 0 ? (prod - reb) / prod : 1
    }
    const trs = dispo * perf * qual
    sOuv += ouverture; sTrs += trs * ouverture; sDispo += dispo * ouverture; sPerf += perf * ouverture; sQual += qual * ouverture; nPostes++
  }

  return {
    annee, dateGen: new Date(),
    fabBoxes, fabTheo, rdtFab, fabLots, fabBoxesSem, fabLotsSem,
    condBoxes, condTheo, rdtCond, condBoxesSem, condLotsSem: condLotsSem.size,
    plan, pctPlanFab: plan ? (fabBoxes / plan) * 100 : 0, pctPlanCond: plan ? (condBoxes / plan) * 100 : 0,
    vracBoxes, phasesACompleter, condACompleter,
    trs: { global: sOuv ? (sTrs / sOuv) * 100 : 0, dispo: sOuv ? (sDispo / sOuv) * 100 : 0, perf: sOuv ? (sPerf / sOuv) * 100 : 0, qual: sOuv ? (sQual / sOuv) * 100 : 0, nPostes },
  }
}

// --- Données factices pour tester le rendu (--mock) ---
function mockData() {
  return {
    annee: 2026, dateGen: new Date('2026-07-20'),
    fabBoxes: 10276443, fabTheo: 10686443, rdtFab: 96.16, fabLots: 511, fabBoxesSem: 210500, fabLotsSem: 12,
    condBoxes: 11167603, condTheo: 11498615, rdtCond: 97.12, condBoxesSem: 322429, condLotsSem: 22,
    plan: 32761824, pctPlanFab: 31.4, pctPlanCond: 34.1,
    vracBoxes: 1284771, phasesACompleter: 7, condACompleter: 5,
    trs: { global: 62.4, dispo: 88.1, perf: 74.5, qual: 95.2, nPostes: 34 },
  }
}

// --- Construction du PPTX ---
const NAVY='161C2E', TEAL='0F766E', MINT='2DD4BF', LIGHT='F7F8FB', TEXT='1A2233', GREY='64748B', RED='B91C1C', AMBER='B45309', GREEN='047857', INDIGO='4338CA'
const HF='Cambria', BF='Calibri'
const sh = () => ({ type:'outer', angle:90, blur:10, offset:2, color:'000000', opacity:0.10 })

function couleurTaux(v){ return v>=95?GREEN:(v>=85?AMBER:RED) }

function buildDeck(d) {
  const pres = new pptxgen()
  pres.layout='LAYOUT_WIDE'; pres.author='LDM Groupe'; pres.title='ProdTrack — Rapport hebdomadaire'
  const semStr = d.dateGen.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' })

  const head = (s, kicker, title) => {
    s.addText(kicker.toUpperCase(), { x:0.6, y:0.36, w:12.1, h:0.28, fontFace:BF, fontSize:11, bold:true, color:TEAL, charSpacing:1.6, margin:0 })
    s.addText(title, { x:0.6, y:0.64, w:12.1, h:0.6, fontFace:HF, fontSize:29, bold:true, color:TEXT, margin:0 })
  }
  const card = (s,x,y,w,h,fill) => s.addShape(pres.ShapeType.roundRect,{x,y,w,h,rectRadius:0.09,fill:{color:fill||'FFFFFF'},line:{color:'E2E8F0',width:1},shadow:sh()})
  // Grande tuile KPI
  const tuile = (s,x,y,w,h,valeur,libelle,couleur,sub) => {
    card(s,x,y,w,h)
    s.addShape(pres.ShapeType.rect,{x,y,w:0.12,h,fill:{color:couleur}})
    s.addText(valeur,{x:x+0.25,y:y+0.28,w:w-0.4,h:0.9,fontFace:HF,fontSize:36,bold:true,color:couleur,margin:0})
    s.addText(libelle,{x:x+0.25,y:y+h-0.85,w:w-0.4,h:0.4,fontFace:BF,fontSize:14,bold:true,color:TEXT,margin:0})
    if(sub) s.addText(sub,{x:x+0.25,y:y+h-0.5,w:w-0.4,h:0.35,fontFace:BF,fontSize:12,color:GREY,margin:0})
  }
  // Barre de progression
  const barre = (s,x,y,w,valeur,couleur) => {
    s.addShape(pres.ShapeType.roundRect,{x,y,w,h:0.28,rectRadius:0.14,fill:{color:'E2E8F0'}})
    const ww = Math.max(0.1, Math.min(1, valeur/100) * w)
    s.addShape(pres.ShapeType.roundRect,{x,y,w:ww,h:0.28,rectRadius:0.14,fill:{color:couleur}})
  }

  // ---- SLIDE 1 : titre ----
  let s = pres.addSlide(); s.background={color:NAVY}
  s.addShape(pres.ShapeType.ellipse,{x:10.4,y:-1.6,w:5,h:5,fill:{color:TEAL,transparency:55}})
  s.addShape(pres.ShapeType.ellipse,{x:11.8,y:4.8,w:2.8,h:2.8,fill:{color:MINT,transparency:75}})
  s.addText('Prod',{x:0.8,y:1.7,w:3,h:0.6,fontFace:HF,fontSize:26,bold:true,color:'FFFFFF',margin:0})
  s.addText('Track',{x:1.78,y:1.7,w:3,h:0.6,fontFace:HF,fontSize:26,bold:true,color:MINT,margin:0})
  s.addText('Rapport hebdomadaire de production',{x:0.8,y:2.7,w:11,h:0.9,fontFace:HF,fontSize:40,bold:true,color:'FFFFFF',margin:0})
  s.addText('État d\'avancement et indicateurs — atelier',{x:0.8,y:3.7,w:11,h:0.4,fontFace:BF,fontSize:17,color:MINT,italic:true,margin:0})
  s.addText('Semaine du ' + semStr,{x:0.8,y:4.5,w:11,h:0.4,fontFace:BF,fontSize:16,color:'AAB6CC',margin:0})
  s.addText('LDM Groupe · Laboratoires Du Médicament · généré automatiquement',{x:0.8,y:6.5,w:11,h:0.3,fontFace:BF,fontSize:11,color:'8494AE',margin:0})

  // ---- SLIDE 2 : état d'avancement (plan) ----
  s = pres.addSlide(); s.background={color:LIGHT}
  head(s,'Objectif annuel','État d\'avancement vs plan ' + d.annee)
  card(s,0.9,1.7,11.5,1.0,'F0FDFA')
  s.addText([{text:'Plan ' + d.annee + ' : ',options:{bold:true,color:TEAL}},{text:fmt(d.plan)+' boîtes',options:{color:TEXT}}],{x:1.2,y:1.85,w:10.9,h:0.7,fontFace:BF,fontSize:15,valign:'middle',margin:0})
  // Fabrication
  s.addText('Fabrication réalisée',{x:0.9,y:3.0,w:6,h:0.35,fontFace:HF,fontSize:16,bold:true,color:TEXT,margin:0})
  s.addText(fmt(d.fabBoxes)+' boîtes  ·  '+pct(d.pctPlanFab)+' du plan',{x:0.9,y:3.4,w:8,h:0.35,fontFace:BF,fontSize:14,color:GREY,margin:0})
  barre(s,0.9,3.85,11.5,d.pctPlanFab,TEAL)
  // Conditionnement
  s.addText('Conditionnement réalisé',{x:0.9,y:4.6,w:6,h:0.35,fontFace:HF,fontSize:16,bold:true,color:TEXT,margin:0})
  s.addText(fmt(d.condBoxes)+' boîtes  ·  '+pct(d.pctPlanCond)+' du plan',{x:0.9,y:5.0,w:8,h:0.35,fontFace:BF,fontSize:14,color:GREY,margin:0})
  barre(s,0.9,5.45,11.5,d.pctPlanCond,INDIGO)
  s.addText('Cumul depuis le 1ᵉʳ janvier ' + d.annee,{x:0.9,y:6.3,w:11,h:0.3,fontFace:BF,fontSize:12,italic:true,color:GREY,margin:0})

  // ---- SLIDE 3 : production de la semaine ----
  s = pres.addSlide(); s.background={color:LIGHT}
  head(s,'Cette semaine','Production des 7 derniers jours')
  tuile(s,0.9,1.9,5.6,2.0,fmt(d.fabBoxesSem),'Boîtes fabriquées',TEAL,d.fabLotsSem+' lot(s) terminé(s)')
  tuile(s,6.8,1.9,5.6,2.0,fmt(d.condBoxesSem),'Boîtes conditionnées',INDIGO,d.condLotsSem+' lot(s) conditionné(s)')
  card(s,0.9,4.2,11.5,2.1,'FFFBEB')
  s.addText('À suivre',{x:1.2,y:4.4,w:10.9,h:0.35,fontFace:HF,fontSize:16,bold:true,color:AMBER,margin:0})
  s.addText([
    {text:fmt(d.vracBoxes)+' boîtes',options:{bold:true,color:AMBER,fontSize:15}},
    {text:' en vrac, en attente de conditionnement.',options:{color:TEXT,fontSize:14}},
  ],{x:1.2,y:4.9,w:10.9,h:0.4,fontFace:BF,margin:0})
  s.addText('Objectif de la semaine : réduire le vrac en attente et clôturer les lots terminés.',{x:1.2,y:5.5,w:10.9,h:0.6,fontFace:BF,fontSize:13,italic:true,color:GREY,margin:0})

  // ---- SLIDE 4 : rendement & avarie ----
  s = pres.addSlide(); s.background={color:LIGHT}
  head(s,'Qualité quantitative','Rendement & avarie ' + d.annee)
  const avFab = Math.max(0,100-d.rdtFab), avCond = Math.max(0,100-d.rdtCond)
  tuile(s,0.9,1.9,5.6,2.0,pct(d.rdtFab),'Rendement fabrication',couleurTaux(d.rdtFab),'Avarie '+pct(avFab))
  tuile(s,6.8,1.9,5.6,2.0,pct(d.rdtCond),'Rendement conditionnement',couleurTaux(d.rdtCond),'Avarie '+pct(avCond))
  card(s,0.9,4.2,11.5,2.1,'F8FAFC')
  s.addText('Lecture',{x:1.2,y:4.4,w:10.9,h:0.35,fontFace:HF,fontSize:15,bold:true,color:TEAL,margin:0})
  s.addText('Rendement = boîtes réelles ÷ boîtes théoriques. Un rendement vert (≥ 95 %) est bon ; en dessous de 85 %, il faut identifier les pertes. Ces taux ne comptent que les lots dont la donnée est complète.',{x:1.2,y:4.85,w:10.9,h:1.3,fontFace:BF,fontSize:13,color:TEXT,margin:0})

  // ---- SLIDE 5 : TRS ----
  s = pres.addSlide(); s.background={color:LIGHT}
  head(s,'Efficience machine','TRS de la semaine')
  if (d.trs.nPostes > 0) {
    tuile(s,0.9,1.9,5.6,2.6,pct(d.trs.global),'TRS global',couleurTaux(d.trs.global),d.trs.nPostes+' poste(s) saisi(s)')
    const comp = [['Disponibilité',d.trs.dispo],['Performance',d.trs.perf],['Qualité',d.trs.qual]]
    comp.forEach((c,i)=>{
      const y=1.9+i*0.88
      card(s,6.8,y,5.6,0.72)
      s.addText(c[0],{x:7.05,y:y+0.2,w:2.6,h:0.35,fontFace:BF,fontSize:14,bold:true,color:TEXT,valign:'middle',margin:0})
      s.addText(pct(c[1]),{x:9.6,y:y+0.2,w:2.6,h:0.35,align:'right',fontFace:HF,fontSize:17,bold:true,color:couleurTaux(c[1]),valign:'middle',margin:0})
    })
    s.addText('TRS = Disponibilité × Performance × Qualité, pondéré par le temps d\'ouverture, sur les 7 derniers jours.',{x:0.9,y:4.9,w:11.5,h:0.5,fontFace:BF,fontSize:13,italic:true,color:GREY,margin:0})
  } else {
    card(s,0.9,2.0,11.5,1.2,'FFFBEB')
    s.addText('Aucun poste TRS saisi cette semaine — pensez à renseigner les postes dans « Saisie TRS ».',{x:1.2,y:2.2,w:10.9,h:0.8,fontFace:BF,fontSize:15,color:AMBER,valign:'middle',margin:0})
  }

  // ---- SLIDE 6 : alertes ----
  s = pres.addSlide(); s.background={color:LIGHT}
  head(s,'Points d\'attention','Données à compléter')
  const al = [
    [d.phasesACompleter,'Phases de fabrication à compléter','sans quantité sortie', d.phasesACompleter>0?RED:GREEN],
    [d.condACompleter,'Conditionnements à compléter','sans quantité saisie', d.condACompleter>0?RED:GREEN],
  ]
  al.forEach((a,i)=>{
    const x=0.9+i*5.95
    card(s,x,1.9,5.6,2.0)
    s.addText(String(a[0]),{x:x+0.25,y:2.15,w:5,h:0.9,fontFace:HF,fontSize:40,bold:true,color:a[3],margin:0})
    s.addText(a[1],{x:x+0.25,y:3.15,w:5.1,h:0.35,fontFace:BF,fontSize:14,bold:true,color:TEXT,margin:0})
    s.addText(a[2],{x:x+0.25,y:3.5,w:5.1,h:0.3,fontFace:BF,fontSize:12,color:GREY,margin:0})
  })
  card(s,0.9,4.3,11.5,1.9,(d.phasesACompleter+d.condACompleter)>0?'FEF2F2':'ECFDF5')
  const msg = (d.phasesACompleter+d.condACompleter)>0
    ? 'Tant que ces données manquent, les rendements et taux affichés sont incomplets. À corriger en priorité cette semaine (pages Suivi de fabrication et Conditionnement).'
    : 'Aucune donnée manquante : les indicateurs sont complets et fiables. Excellent travail.'
  s.addText(msg,{x:1.2,y:4.5,w:10.9,h:1.5,fontFace:BF,fontSize:14,color:TEXT,valign:'top',margin:0})

  return pres
}

// --- Exécution ---
const data = MOCK ? mockData() : await collecte()
if (!fs.existsSync('rapport')) fs.mkdirSync('rapport')
const pres = buildDeck(data)
await pres.writeFile({ fileName: 'rapport/Rapport_Hebdo_ProdTrack.pptx' })
console.log('Rapport généré : rapport/Rapport_Hebdo_ProdTrack.pptx', MOCK ? '(données factices)' : '(données réelles)')
