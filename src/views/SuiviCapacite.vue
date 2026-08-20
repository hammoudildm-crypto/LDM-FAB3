<template>
  <div class="cap">
    <div class="cap-head">
      <div>
        <div class="ch-eyebrow">Charge & capacité</div>
        <h1 class="ch-title">Suivi de capacité des équipements</h1>
      </div>
    </div>

    <p v-if="chargement" class="muted card">Chargement…</p>
    <p v-else-if="!planExiste" class="muted warn card">Aucune quantité planifiée pour {{ annee }} dans le plan directeur.</p>

    <section v-if="!chargement" class="card">
      <div class="kpi-row">
        <div class="kpi"><div class="kpi-v">{{ (kpiOccMoy * 100).toFixed(0) }} %</div><div class="kpi-l">Occupation moyenne</div></div>
        <div class="kpi"><div class="kpi-v">{{ kpiSup90 }}</div><div class="kpi-l">Équipements &gt; 90 %</div></div>
        <div class="kpi warn"><div class="kpi-v">{{ kpiSurcharge }}</div><div class="kpi-l">En surcharge</div></div>
        <div class="kpi"><div class="kpi-v">{{ joursAnnee }}</div><div class="kpi-l">Jours ouvrés {{ annee }}</div></div>
      </div>
      <h2 class="card-title">Occupation annuelle — {{ siteSel === 'tous' ? 'Tous sites' : (SITES.find(s => s.key === siteSel) || {}).label }}<span v-if="phaseSel"> · {{ PHASE_NOM[phaseSel] || phaseSel }}</span> · {{ lignesTableau.length }} équip. · {{ joursAnnee }} j ouvrés</h2>
      <div class="occ-layout">
        <aside class="occ-side">
          <div class="side-sec">
            <div class="side-lbl">Année</div>
            <select class="side-select" v-model.number="annee"><option v-for="a in annees" :key="a" :value="a">{{ a }}</option></select>
          </div>
          <div class="side-sec">
            <div class="side-lbl">Régime</div>
            <select class="side-select" v-model="regime">
              <option value="auto">Réel (par équipement)</option>
              <option :value="1">1×8 (forcé)</option>
              <option :value="2">2×8 (forcé)</option>
              <option :value="3">3×8 (forcé)</option>
            </select>
          </div>
          <div class="side-sec">
            <div class="side-lbl">Nettoyage &amp; réglage</div>
            <label class="side-chk"><input type="checkbox" v-model="inclureNett" /> Inclure dans la charge</label>
          </div>
          <div class="side-sec side-sp-row">
            <div class="side-sp-col">
              <div class="side-lbl">Site</div>
              <div class="side-tg">
                <button v-for="st in SITES" :key="st.key" :class="{ on: siteSel === st.key }" @click="siteSel = st.key; phaseSel = ''">{{ st.label }}</button>
              </div>
            </div>
            <div class="side-sp-col">
              <div class="side-lbl">Phase</div>
              <div class="side-phases">
                <button :class="{ on: !phaseSel }" @click="phaseSel = ''"><span class="ph-dot" style="background:#94a3b8"></span>Toutes</button>
                <button v-for="ph in phasesDuSite" :key="ph" :class="{ on: phaseSel === ph }" @click="phaseSel = ph"><span class="ph-dot" :style="{ background: couleurPhase(ph) }"></span>{{ PHASE_NOM[ph] || ph }}</button>
              </div>
            </div>
          </div>
          <div class="side-sec">
            <div class="side-lbl">Légende</div>
            <div class="side-leg">
              <span class="lg lg-g">&lt; 70 %</span><span class="lg lg-a">70–90 %</span><span class="lg lg-r">&gt; 90 %</span><span class="lg lg-x">&gt; 100 %</span>
            </div>
          </div>
        </aside>
        <div class="occ-content tbl-wrap">
        <table class="grid">
          <colgroup>
            <col style="width:6%"><col style="width:21%"><col style="width:8%"><col style="width:8%"><col style="width:12%"><col style="width:12%"><col style="width:10%"><col style="width:15%"><col style="width:16%">
          </colgroup>
          <thead>
            <tr>
              <th class="ta-c">Réq. WE</th><th>Équipement</th><th class="ta-c">Machines</th><th class="ta-c">h/j effectif</th>
              <th class="ta-r">Charge globale (j)</th><th class="ta-r">Charge / machine (j)</th><th class="ta-r">Capacité (j)</th><th class="taux-h">Taux d'occupation</th><th class="mc-h">Évolution mensuelle</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in lignesTableau" :key="r.id" :class="{ vide: r.chargeJ === 0 }">
              <td class="ta-c"><input type="checkbox" :checked="weEq(r.id)" @change="setReq(r.id, $event.target.checked)" title="Travail le week-end pour cet équipement" /></td>
              <td><strong>{{ r.nom }}</strong></td>
              <td class="ta-c">{{ r.machines }}</td>
              <td class="ta-c hj">{{ r.hj.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) }}</td>
              <td class="ta-r glob">{{ r.chargeGlobaleJ.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) }}</td>
              <td class="ta-r">{{ r.chargeJ.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) }}</td>
              <td class="ta-r">{{ r.capaciteJ.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) }}</td>
              <td class="taux-cell">
                <div class="bar-wrap"><div class="bar" :class="cls(r.taux)" :style="{ width: Math.min(100, r.taux * 100) + '%' }"></div></div>
                <span class="taux-val" :class="clsTxt(r.taux)">{{ (r.taux * 100).toFixed(1) }} %</span>
              </td>
              <td class="mc-cell">
                <div class="mc-chart mc-inline">
                  <div class="mc-ref"></div>
                  <div v-for="(t, i) in r.tauxMois" :key="i" class="mc-col" :title="MOIS[i] + ' : ' + (t * 100).toFixed(0) + ' %'">
                    <div class="mc-bar" :class="cls(t)" :style="{ height: Math.max(2, Math.min(120, t * 100)) + '%' }"></div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>
    </section>


    <section v-if="!chargement" class="kpi-line">
      <div class="kpi-mini"><div class="km-val">{{ (occGlobal * 100).toFixed(0) }} %</div><div class="km-lbl">Occupation moyenne</div></div>
      <div class="kpi-mini"><div class="km-val">{{ nbGoulots }}</div><div class="km-lbl">Équipements &gt; 90 %</div></div>
      <div class="kpi-mini"><div class="km-val">{{ nbSurcharge }}</div><div class="km-lbl">En surcharge</div></div>
      <div class="kpi-mini"><div class="km-val">{{ joursAnnee }}</div><div class="km-lbl">Jours ouvrés {{ annee }}</div></div>
    </section>

    <section v-if="!chargement && produitsSansCadence.length" class="card avert">
      <h2 class="card-title">Produits planifiés sans cadence</h2>
      <p class="note">Plan {{ annee }} mais aucune cadence — non comptés. À renseigner dans <strong>Cadences</strong>.</p>
      <div class="chips"><span v-for="(p, i) in produitsSansCadence.slice(0, 30)" :key="i" class="chip">{{ p }}</span><span v-if="produitsSansCadence.length > 30" class="chip more">+{{ produitsSansCadence.length - 30 }}</span></div>
    </section>

    <section v-if="!chargement && produitsSansPoids.length" class="card avert">
      <h2 class="card-title">Produits de fabrication sans poids de lot</h2>
      <p class="note">Ces produits ont une phase de fabrication planifiée (cadence en kg/h) mais aucun <strong>poids de lot (kg)</strong> — leur charge de fabrication n'est pas comptée. Exécute le SQL <em>poids_lot_kg</em> ou renseigne le poids.</p>
      <div class="chips"><span v-for="(p, i) in produitsSansPoids.slice(0, 30)" :key="i" class="chip">{{ p }}</span><span v-if="produitsSansPoids.length > 30" class="chip more">+{{ produitsSansPoids.length - 30 }}</span></div>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { supabase } from '../supabase'

const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
const PHASE_NOM = { pesee: 'Pesée', granulation: 'Granulation', sechage: 'Séchage', melange: 'Mélange', compression: 'Compression', remplissage: 'Remplissage', pelliculage: 'Pelliculage', conditionnement: 'Conditionnement' }
const NOM_KEY = {}
for (const [k, v] of Object.entries(PHASE_NOM)) NOM_KEY[v.toLowerCase()] = k

const produits = ref([]), equipements = ref([]), cadences = ref([]), plans = ref([])
const chargement = ref(true)
const annee = ref(new Date().getFullYear())
const regime = ref('auto')
const avecWE = ref(false)
const inclureNett = ref(true)

const annees = computed(() => { const s = new Set(plans.value.map(p => p.annee).filter(Boolean)); s.add(new Date().getFullYear()); s.add(annee.value); return [...s].sort((a, b) => b - a) })

async function fetchAllPaged(make) {
  const size = 1000; let from = 0, all = []
  for (;;) { const r = await make().range(from, from + size - 1); if (r.error) return all; all = all.concat(r.data || []); if (!r.data || r.data.length < size) break; from += size }
  return all
}

onMounted(async () => {
  produits.value = await fetchAllPaged(() => supabase.from('produits').select('id, code_pf, designation, unites_par_boite, taille_lot, poids_lot_kg, gamme').eq('actif', true))
  equipements.value = await fetchAllPaged(() => supabase.from('equipements').select('*').eq('actif', true))
  cadences.value = await fetchAllPaged(() => supabase.from('cadences_produit').select('equipement_id, produit_id, cadence_nominale'))
  plans.value = await fetchAllPaged(() => supabase.from('plan_production').select('annee, mois, quantite_planifiee, produit_id'))
  chargement.value = false
})

function phaseDeType(type) {
  const t = (type || '').toLowerCase()
  if (/pes[ée]|balance|bascule/.test(t)) return 'pesee'
  if (/granul/.test(t)) return 'granulation'
  if (/s[ée]ch/.test(t)) return 'sechage'
  if (/mélang|melang/.test(t)) return 'melange'
  if (/gélule|gelule|remplis|encapsul|capsul/.test(t)) return 'remplissage'
  if (/compress|presse|compri/.test(t)) return 'compression'
  if (/pellicul|enrob|coat|dragé|drage/.test(t)) return 'pelliculage'
  if (/condition|blister|thermoform|uhlmann|integra|marchesini|emball|étui|etui|fardel|encart|mise en bo/.test(t)) return 'conditionnement'
  return null
}
function phaseDe(e) { return phaseDeType(e.type) || phaseDeType(e.nom) || phaseDeType(e.code) }
function phaseKeyFromName(name) {
  const t = String(name || '').toLowerCase().trim()
  if (NOM_KEY[t]) return NOM_KEY[t]
  if (/pes/.test(t)) return 'pesee'
  if (/granul/.test(t)) return 'granulation'
  if (/s[ée]ch/.test(t)) return 'sechage'
  if (/mélang|melang/.test(t)) return 'melange'
  if (/gélule|gelule|remplis|capsul/.test(t)) return 'remplissage'
  if (/compress|compri/.test(t)) return 'compression'
  if (/pellicul|enrob|dragé|drage/.test(t)) return 'pelliculage'
  if (/condition/.test(t)) return 'conditionnement'
  return null
}
// Ordre de la gamme de fabrication (pour trier les ateliers)
const ORDRE_GAMME = { pesee: 1, granulation: 2, sechage: 3, melange: 4, compression: 5, remplissage: 6, pelliculage: 7, conditionnement: 8 }
function num(v, def) { const n = Number(v); return (v === null || v === undefined || isNaN(n)) ? def : n }
function libelle(e) { const c = e.code ? String(e.code) : '', n = e.nom ? String(e.nom) : ''; return { code: c || n, nom: c && n ? n : '' } }

const prodById = computed(() => { const m = {}; for (const p of produits.value) m[p.id] = p; return m })
const cadMap = computed(() => { const m = {}; for (const c of cadences.value) { const v = Number(c.cadence_nominale || 0); if (v > 0) m[c.equipement_id + '|' + c.produit_id] = v } return m })
const equipAvecCadence = computed(() => { const s = new Set(); for (const c of cadences.value) if (Number(c.cadence_nominale) > 0) s.add(c.equipement_id); return s })
const gammeKeys = computed(() => { const m = {}; for (const p of produits.value) { const set = new Set(); const g = Array.isArray(p.gamme) ? p.gamme : []; for (const n of g) { const k = phaseKeyFromName(n); if (k) set.add(k) } m[p.id] = set } return m })

const planExiste = computed(() => plans.value.some(p => p.annee === annee.value))
const planAgg = computed(() => {
  const m = {}
  for (const p of plans.value) {
    if (p.annee !== annee.value) continue
    const mo = Number(p.mois || 0); if (mo < 1 || mo > 12) continue
    if (!m[p.produit_id]) m[p.produit_id] = new Array(12).fill(0)
    m[p.produit_id][mo - 1] += Number(p.quantite_planifiee || 0)
  }
  return m
})

function joursOuvresMois(an, moisIdx) { const d = new Date(an, moisIdx, 1); let n = 0; while (d.getMonth() === moisIdx) { const wd = d.getDay(); if (avecWE.value || (wd !== 0 && wd !== 6)) n++; d.setDate(d.getDate() + 1) } return n }
const joursParMois = computed(() => MOIS.map((_, i) => joursOuvresMois(annee.value, i)))
const joursAnnee = computed(() => joursParMois.value.reduce((s, n) => s + n, 0))
function joursOuvresMoisWE(an, moisIdx, we) { const d = new Date(an, moisIdx, 1); let n = 0; while (d.getMonth() === moisIdx) { const wd = d.getDay(); if (we || (wd !== 0 && wd !== 6)) n++; d.setDate(d.getDate() + 1) } return n }
const joursMoisSansWE = computed(() => MOIS.map((_, i) => joursOuvresMoisWE(annee.value, i, false)))
const joursMoisAvecWE = computed(() => MOIS.map((_, i) => joursOuvresMoisWE(annee.value, i, true)))
const joursAnSansWE = computed(() => joursMoisSansWE.value.reduce((a, n) => a + n, 0))
const joursAnAvecWE = computed(() => joursMoisAvecWE.value.reduce((a, n) => a + n, 0))
const reqEquip = reactive({})
function weEq(key) { return !!reqEquip[key] }
const CLE_REQ = 'sc_req_we'
function sauverReq() { try { localStorage.setItem(CLE_REQ, JSON.stringify(reqEquip)) } catch (e) {} }
function setReq(key, val) { reqEquip[key] = val; sauverReq() }
try { const _r = JSON.parse(localStorage.getItem(CLE_REQ) || '{}'); for (const k in _r) reqEquip[k] = _r[k] } catch (e) {}

// Nom d'unité : retire le préfixe d'opération (ex "Granulation COMASA" / "Séchage COMASA" -> "COMASA")
// puis un indice d'unité en fin (<= 20), sans toucher aux numéros de modèle (FE55, TR100, 520...).
const PREFIXE_OP = /^(granulation|s[ée]chage|s[ée]choir|m[ée]lange|pes[ée]e|compression|remplissage|encapsulation|pelliculage|enrobage|conditionnement)\s+(?!et\s)/i
function baseNom(nom) {
  const n = String(nom || '').trim().replace(PREFIXE_OP, '')
  return n.replace(/\s+(\d{1,2})\s*$/, (m, d) => (Number(d) <= 20 ? '' : m)).trim()
}
// Regroupe par unité physique : même nom de base (toutes opérations confondues) -> une seule ligne.
// Une unité multi-opérations (COMASA = granulation + séchage) cumule le temps de ses opérations.
const groupesEquip = computed(() => {
  const eqs = equipements.value.filter(e => phaseDe(e))
  const g = {}
  for (const e of eqs) {
    const nom = (e.nom || e.code || '—').trim()
    const base = baseNom(nom) || nom
    const key = base.toLowerCase()
    if (!g[key]) g[key] = { key, nom: base, equips: [] }
    g[key].equips.push(e)
  }
  return Object.values(g)
})

function siteDeCode(code) { const c = (code || '').toUpperCase(); if (c.startsWith('PRH')) return 'hormonal'; if (c === 'PR054') return 'semi'; return 'seche' }
function siteDuGroupe(equips) {
  const codes = (equips || []).map(e => (e.code || '').toUpperCase())
  if (codes.some(c => c.startsWith('PRH'))) return 'hormonal'
  if (codes.some(c => c === 'PR054')) return 'semi'
  // repli sur le nom si le code ne suit pas la convention
  const noms = (equips || []).map(e => (e.nom || '').toLowerCase())
  if (noms.some(n => /hormon/.test(n))) return 'hormonal'
  return 'seche'
}
const COULEUR_PHASE = { pesee: '#64748b', granulation: '#10b981', sechage: '#06b6d4', melange: '#3b82f6', compression: '#8b5cf6', remplissage: '#a855f7', pelliculage: '#f59e0b', conditionnement: '#ec4899' }
function couleurPhase(ph) { return COULEUR_PHASE[ph] || '#94a3b8' }
const lignes = computed(() => {
  const out = []
  for (const grp of groupesEquip.value) {
    // équipements de l'unité regroupés par opération (phase)
    const parPhase = {}
    for (const e of grp.equips) {
      const ph = phaseDe(e)
      if (!parPhase[ph]) parPhase[ph] = { equips: [], machines: 0 }
      parPhase[ph].equips.push(e)
      parPhase[ph].machines += Math.max(1, num(e.nb_machines, 1))
    }
    const phases = Object.keys(parPhase).sort((a, b) => (ORDRE_GAMME[a] || 99) - (ORDRE_GAMME[b] || 99))
    const machines = Math.max(1, ...phases.map(ph => parPhase[ph].machines))   // nb d'unités physiques
    const rep = grp.equips[0]
    const postes = regime.value === 'auto' ? num(rep.postes, 3) : Number(regime.value)
    const tep = num(rep.tep, 8)
    const vdlp = num(rep.vdlp, 0), vdlt = num(rep.vdlt, 0), reglage = num(rep.reglage, 0)
    const capaJour = postes * tep * machines
    const cadPhase = (ph, pid) => { let c = 0; for (const e of parPhase[ph].equips) { const v = cadMap.value[e.id + '|' + pid]; if (v > 0 && v > c) c = v } return c }
    const we = weEq(grp.key)
    const jMois = we ? joursMoisAvecWE.value : joursMoisSansWE.value
    const jAn = we ? joursAnAvecWE.value : joursAnSansWE.value
    const tauxMois = []; let chargeJTot = 0
    for (let mi = 0; mi < 12; mi++) {
      let occH = 0
      for (const [pid, tab] of Object.entries(planAgg.value)) {
        const boites = tab[mi]; if (!boites) continue
        const gk = gammeKeys.value[pid]
        const p = prodById.value[pid] || {}
        const tl = num(p.taille_lot, 0), plk = num(p.poids_lot_kg, 0)
        let utilise = false
        for (const ph of phases) {   // cumule le temps de chaque opération de l'unité
          const estCond = ph === 'conditionnement'
          const inGamme = estCond || !gk || gk.size === 0 || gk.has(ph) || (ph === 'sechage' && gk.has('granulation'))
          if (!inGamme) continue
          const cad = cadPhase(ph, pid); if (!(cad > 0)) continue
          let qty
          if (estCond) qty = boites
          else { if (!(tl > 0 && plk > 0)) continue; qty = boites * plk / tl }
          occH += qty / cad
          utilise = true
        }
        if (inclureNett.value && utilise) {
          const nbLots = tl > 0 ? Math.ceil(boites / tl) : 1
          occH += nbLots * vdlp + vdlt + reglage
        }
      }
      const chargeJ = capaJour > 0 ? occH / capaJour : 0
      chargeJTot += chargeJ
      tauxMois.push(jMois[mi] > 0 ? chargeJ / jMois[mi] : 0)
    }
    let phaseLabel = phases.map(ph => PHASE_NOM[ph] || ph).join(' / ')
    let nomAffiche = grp.nom
    if (phases.includes('granulation') && phases.includes('sechage')) { phaseLabel = 'Granulation et Séchage'; nomAffiche = 'Granulation et Séchage ' + grp.nom }
    else if (phases.length === 1 && phases[0] === 'granulation' && grp.equips.some(e => /s[ée]ch/i.test((e.type || '') + ' ' + (e.nom || e.code || '')))) phaseLabel = 'Granulation et Séchage'
    out.push({ id: grp.key, nom: nomAffiche, phase: phases[0], phaseLabel, estCond: phases.includes('conditionnement'), machines, hj: postes * tep, chargeGlobaleJ: chargeJTot * machines, chargeJ: chargeJTot, we, site: phases.includes('conditionnement') ? 'conditionnement' : siteDuGroupe(grp.equips), capaciteJ: jAn, taux: jAn > 0 ? chargeJTot / jAn : 0, tauxMois })
  }
  return out.sort((a, b) => (ORDRE_GAMME[a.phase] || 99) - (ORDRE_GAMME[b.phase] || 99) || b.taux - a.taux)
})

const occGlobal = computed(() => { const w = lignes.value.filter(r => r.chargeJ > 0); return w.length ? w.reduce((s, r) => s + r.taux, 0) / w.length : 0 })
const nbGoulots = computed(() => lignes.value.filter(r => r.taux > 0.9).length)
const nbSurcharge = computed(() => lignes.value.filter(r => r.taux > 1).length)

const produitsSansCadence = computed(() => {
  const s = new Set()
  for (const pid of Object.keys(planAgg.value)) {
    if (!planAgg.value[pid].some(v => v > 0)) continue
    if (!equipements.value.some(e => cadMap.value[e.id + '|' + pid] > 0)) { const p = prodById.value[pid]; if (p) s.add((p.code_pf || '') + ' · ' + (p.designation || '')) }
  }
  return [...s].sort()
})
const produitsSansPoids = computed(() => {
  const s = new Set()
  for (const pid of Object.keys(planAgg.value)) {
    if (!planAgg.value[pid].some(v => v > 0)) continue
    const p = prodById.value[pid]; if (!p) continue
    let besoin = false
    for (const e of equipements.value) { const ph = phaseDe(e); if (ph && ph !== 'conditionnement' && cadMap.value[e.id + '|' + pid] > 0) { besoin = true; break } }
    if (besoin && !(num(p.poids_lot_kg, 0) > 0)) s.add((p.code_pf || '') + ' · ' + (p.designation || ''))
  }
  return [...s].sort()
})

const selEquips = reactive({})
const CLE_SEL = 'sc_sel_equips'
function sauverSel() { try { localStorage.setItem(CLE_SEL, JSON.stringify(selEquips)) } catch (e) {} }
function initSel() { let sv = {}; try { sv = JSON.parse(localStorage.getItem(CLE_SEL) || '{}') } catch (e) {} for (const r of lignes.value) if (!(r.id in selEquips)) selEquips[r.id] = (r.id in sv) ? sv[r.id] : true }
watch(lignes, initSel, { immediate: true })
function toggleSel(id) { selEquips[id] = selEquips[id] === false ? true : false; sauverSel() }
function selTout() { for (const r of lignes.value) selEquips[r.id] = true; sauverSel() }
function selRien() { for (const r of lignes.value) selEquips[r.id] = false; sauverSel() }
const lignesAffichees = computed(() => lignes.value.filter(r => selEquips[r.id] !== false))
const SITES = [{ key: 'tous', label: 'Tous' }, { key: 'seche', label: 'Forme sèche' }, { key: 'hormonal', label: 'Hormonal' }, { key: 'semi', label: 'Semi' }, { key: 'conditionnement', label: 'Conditionnement' }]
const siteSel = ref('tous')
const phaseSel = ref('')
const phasesDuSite = computed(() => { const set = new Set(); for (const r of lignes.value) if ((siteSel.value === 'tous' || r.site === siteSel.value) && r.phase) set.add(r.phase); return [...set].filter(ph => ph !== 'conditionnement').sort((a, b) => (ORDRE_GAMME[a] || 99) - (ORDRE_GAMME[b] || 99)) })
const lignesSidebar = computed(() => lignes.value.filter(r => (siteSel.value === 'tous' || r.site === siteSel.value) && (!phaseSel.value || r.phase === phaseSel.value)))
const lignesTableau = computed(() => lignesSidebar.value)
const kpiCharges = computed(() => lignesTableau.value.filter(r => r.chargeJ > 0))
const kpiOccMoy = computed(() => { const l = kpiCharges.value; return l.length ? l.reduce((a, r) => a + r.taux, 0) / l.length : 0 })
const kpiSup90 = computed(() => lignesTableau.value.filter(r => r.taux > 0.9).length)
const kpiSurcharge = computed(() => lignesTableau.value.filter(r => r.taux > 1).length)
const sidebarGroupe = computed(() => { const m = {}; for (const r of lignesSidebar.value) { const ph = r.phase || 'autre'; (m[ph] = m[ph] || []).push(r) } return Object.keys(m).sort((a, b) => (ORDRE_GAMME[a] || 99) - (ORDRE_GAMME[b] || 99)).map(ph => ({ phase: ph, label: PHASE_NOM[ph] || ph, items: m[ph] })) })
const nbSel = computed(() => lignes.value.filter(r => selEquips[r.id] !== false).length)
function cls(t) { if (!t) return ''; if (t > 1) return 'x'; if (t > 0.9) return 'r'; if (t >= 0.7) return 'a'; return 'g' }
function clsTxt(t) { return 't-' + (cls(t) || 'g') }
</script>

<style scoped>
.cap { max-width: 1240px; margin: 0 auto; padding: 6px 4px 24px; }
.cap-head { margin-bottom: 20px; }
.ch-eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #0f766e; }
.ch-title { font-size: 20px; font-weight: 800; letter-spacing: -.02em; color: #1a2233; margin: 2px 0 1px; }
.ch-sub { font-size: 13.5px; color: #64748b; }

.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; margin-bottom: 12px; }
.card.avert { border-color: #fcd34d; background: #fffbeb; }
.card-title { font-size: 14px; font-weight: 800; color: #1a2233; margin: 0 0 10px; }
.muted { font-size: 13px; color: #94a3b8; margin: 6px 0 0; }
.muted.warn { color: #b45309; }
.note { font-size: 12px; color: #64748b; margin-top: 12px; font-style: italic; }

.ctrl { display: flex; gap: 14px; align-items: flex-end; flex-wrap: wrap; }
.cf { display: flex; flex-direction: column; gap: 5px; }
.cf.grow { flex: 1; }
.cf label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #64748b; }
.cf select { padding: 8px 11px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13.5px; }
.wk { font-size: 13px; color: #334155; font-weight: 500; display: inline-flex; align-items: center; gap: 7px; padding: 7px 0; text-transform: none; letter-spacing: 0; }
.legend { flex-direction: row; align-items: center; gap: 10px; justify-content: flex-end; }
.lg { font-size: 11.5px; font-weight: 600; padding: 3px 9px; border-radius: 20px; }
.lg-g { background: #dcfce7; color: #15803d; } .lg-a { background: #fef3c7; color: #b45309; } .lg-r { background: #fee2e2; color: #b91c1c; } .lg-x { background: #7f1d1d; color: #fff; }

.tbl-wrap { overflow-x: hidden; width: 100%; }
.grid { width: 100%; border-collapse: collapse; font-size: 9.5px; table-layout: fixed; }
.grid th, .grid td { padding: 2px 4px; border-bottom: 1px solid #eef2f6; text-align: left; white-space: normal; word-break: break-word; overflow: hidden; }
.grid th { font-size: 8.5px; color: #64748b; font-weight: 700; line-height: 1.1; }
.ta-r { text-align: right; } .ta-c { text-align: center; }
.grid tr.vide td { color: #cbd5e1; }
.hj { color: #64748b; font-size: 12px; }
.glob { color: #94a3b8; }
.unite { color: #64748b; font-size: 12px; }
.desig { color: #94a3b8; font-size: 12px; }
.phase-tag { font-size: 9.5px; color: #0f766e; background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 5px; padding: 1px 5px; font-weight: 600; }

.taux-h { width: 260px; }
.taux-cell { display: flex; align-items: center; gap: 3px; }
.bar-wrap { flex: 1; height: 7px; background: #f1f5f9; border-radius: 5px; overflow: hidden; min-width: 22px; }
.bar { height: 100%; border-radius: 7px; }
.bar.g { background: #22c55e; } .bar.a { background: #f59e0b; } .bar.r { background: #ef4444; } .bar.x { background: #7f1d1d; }
.taux-val { font-weight: 700; font-size: 9px; min-width: 30px; text-align: right; }
.t-g { color: #15803d; } .t-a { color: #b45309; } .t-r { color: #b91c1c; } .t-x { color: #7f1d1d; }

.matrice .sticky-c { position: sticky; left: 0; background: #fff; z-index: 1; }
.matrice th { text-align: center; }
.cell-taux { text-align: center; font-weight: 700; font-size: 12px; color: #334155; }
.cell-taux.g { background: #dcfce7; } .cell-taux.a { background: #fef3c7; } .cell-taux.r { background: #fee2e2; } .cell-taux.x { background: #7f1d1d; color: #fff; }

.kpi-line { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 18px; }
@media (max-width: 720px) { .kpi-line { grid-template-columns: repeat(2, 1fr); } .taux-h { width: auto; } .legend { justify-content: flex-start; } }
.kpi-mini { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; }
.km-val { font-size: 22px; font-weight: 800; color: #0f766e; letter-spacing: -.02em; }
.km-lbl { font-size: 12px; color: #64748b; margin-top: 2px; }

.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { font-size: 11.5px; background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; border-radius: 6px; padding: 3px 8px; }
.chip.more { background: #f1f5f9; border-color: #e2e8f0; color: #64748b; }
/* Panneau de sélection des équipements */
.occ-layout { display: flex; gap: 10px; align-items: flex-start; }
.kpi-row { display: flex; gap: 12px; margin-bottom: 14px; }
.kpi { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px; text-align: center; }
.kpi-v { font-size: 23px; font-weight: 800; color: #1e293b; line-height: 1.1; }
.kpi-l { font-size: 11px; color: #64748b; font-weight: 600; margin-top: 3px; }
.kpi.warn .kpi-v { color: #b91c1c; }
.occ-side { flex: 0 0 250px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; align-self: flex-start; }
.occ-side-head { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; font-size: 12px; font-weight: 800; color: #334155; }
.occ-side-btns { display: flex; gap: 4px; }
.occ-side-btns button { font: inherit; font-size: 10.5px; font-weight: 700; border: 1px solid #cbd5e1; background: #fff; border-radius: 5px; padding: 2px 7px; cursor: pointer; color: #475569; }
.occ-side-btns button:hover { background: #e2e8f0; }
.side-sec { padding: 7px 11px; border-bottom: 1px solid #eef2f6; }
.side-sp-row { display: flex; gap: 10px; }
.side-select { width: 100%; padding: 7px 9px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 12.5px; font-weight: 600; color: #0f172a; background: #fff; box-sizing: border-box; }
.side-chk { font-size: 12px; color: #334155; font-weight: 500; display: flex; align-items: center; gap: 7px; cursor: pointer; }
.side-leg { display: flex; flex-wrap: wrap; gap: 5px; }
.side-leg .lg { font-size: 10.5px; font-weight: 700; border-radius: 5px; padding: 2px 8px; }
.side-sp-col { flex: 1; min-width: 0; }
.side-sp-col .side-tg button, .side-sp-col .side-phases button { font-size: 10.5px; padding: 4px 7px; }
.side-sp-col .side-phases button { gap: 5px; }
.side-sec:last-child { border-bottom: none; }
.side-lbl { font-size: 9.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #94a3b8; margin-bottom: 5px; }
.side-tg { display: flex; flex-direction: column; gap: 5px; }
.side-tg.side-row2 { flex-direction: row; }
.side-tg button { background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; font: inherit; font-size: 12.5px; font-weight: 600; color: #64748b; padding: 7px 11px; cursor: pointer; text-align: left; flex: 1; }
.side-tg button:hover { background: #eef2f7; }
.side-tg button.on { background: #6366f1; border-color: #6366f1; color: #fff; }
.side-phases { display: flex; flex-direction: column; gap: 3px; }
.side-phases.side-eq { gap: 2px; }
.side-eq button { font-size: 10px; padding: 3px 7px; }
.side-eq .eq-taux { font-size: 9px; }
.side-eq .ph-dot { width: 7px; height: 7px; }
.side-phases button { display: flex; align-items: center; gap: 7px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font: inherit; font-size: 12px; font-weight: 600; color: #475569; padding: 6px 9px; cursor: pointer; text-align: left; width: 100%; }
.side-phases button:hover { background: #eef2f7; }
.side-phases button.on { background: #eef2ff; border-color: #6366f1; color: #4338ca; }
.ph-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.eq-nom { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.eq-taux { font-size: 10.5px; font-weight: 800; }
.occ-vide { font-size: 11px; color: #94a3b8; padding: 8px 2px; margin: 0; }
.occ-step { font-size: 11.5px; color: #475569; background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 8px 10px; margin: 0; }
.occ-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; min-height: 260px; color: #94a3b8; padding: 30px; }
.occ-empty-ic { font-size: 42px; margin-bottom: 8px; opacity: .6; }
.occ-empty-t { font-size: 16px; font-weight: 800; color: #64748b; margin: 0 0 6px; }
.occ-empty-s { font-size: 13px; max-width: 380px; line-height: 1.5; margin: 0; }
.occ-chk { display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-bottom: 1px solid #f1f5f9; cursor: pointer; font-size: 11.5px; }
.occ-chk:hover { background: #eef2f7; }
.occ-chk.off { opacity: .5; }
.occ-chk-nom { flex: 1; min-width: 0; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.occ-chk-taux { font-size: 10.5px; font-weight: 800; }
.occ-content { flex: 1; min-width: 0; }
@media (max-width: 800px) { .occ-layout { flex-direction: column; } .occ-side { flex-basis: auto; width: 100%; } .occ-side-list { max-height: 200px; } }
/* Mini-graphique mensuel par équipement */
.mc-legend { font-size: 11px; color: #64748b; margin-bottom: 6px; }
.mc-100 { border-top: 2px dashed #cbd5e1; padding-top: 2px; }
.mc-list { display: flex; flex-direction: column; gap: 4px; }
.mc-row { display: flex; align-items: center; gap: 12px; padding: 6px 8px; border-bottom: 1px solid #f1f5f9; }
.mc-row:hover { background: #f8fafc; }
.mc-nom { flex: 0 0 230px; min-width: 0; display: flex; flex-direction: column; }
.mc-nom strong { font-size: 13px; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mc-ph { font-size: 10.5px; color: #94a3b8; }
.mc-chart { flex: 1; display: flex; align-items: flex-end; gap: 3px; height: 58px; position: relative; border-bottom: 1px solid #e2e8f0; padding-top: 12px; }
.mc-ref { position: absolute; left: 0; right: 0; top: calc(12px + (58px - 12px) * (1 - 100/120)); border-top: 1px dashed #cbd5e1; pointer-events: none; }
.mc-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; }
.mc-bar { width: 78%; min-height: 2px; border-radius: 3px 3px 0 0; transition: height .2s; }
.mc-bar.g { background: #16a34a; }
.mc-bar.a { background: #f59e0b; }
.mc-bar.r { background: #ef4444; }
.mc-bar.x { background: #991b1b; }
.mc-m { font-size: 8.5px; color: #94a3b8; margin-top: 2px; }
.mc-cell { width: 96px; padding: 1px 4px !important; }
.mc-chart.mc-inline { height: 30px; padding-top: 6px; gap: 1px; border-bottom: none; }
.mc-chart.mc-inline .mc-ref { top: calc(8px + (40px - 8px) * (1 - 100/120)); }
.mc-h { text-align: left; }
.mc-max { flex: 0 0 78px; text-align: right; font-size: 12px; font-weight: 800; }
@media (max-width: 700px) { .mc-nom { flex-basis: 140px; } .mc-m { display: none; } }
</style>
