<template>
  <div class="andon" :class="{ pres: presentation }" ref="racine">
    <div class="an-head">
      <div>
        <div class="an-eyebrow">Lean · アンドン</div>
        <h1 class="an-title">Andon — État des lignes</h1>
        <p class="an-sub">Signal visuel temps réel de la production : ce qui tourne, et où sont les arrêts / problèmes.</p>
      </div>
      <div class="an-tools">
        <span v-if="majAt" class="an-maj">Actualisé à {{ majAt }}</span>
        <label class="an-auto" title="Rafraîchissement automatique toutes les 30 s"><input type="checkbox" v-model="auto" /> Auto</label>
        <label class="an-auto" title="Bip sonore quand un nouveau problème apparaît"><input type="checkbox" v-model="son" /> 🔊</label>
        <button type="button" class="an-refresh" @click="charger" :disabled="chargement" title="Actualiser">{{ chargement ? '…' : '↻' }}</button>
        <button type="button" class="an-refresh" @click="basculerPlein" title="Mode présentation plein écran">{{ presentation ? '✕ Quitter' : '⛶ Plein écran' }}</button>
      </div>
    </div>

    <p v-if="erreur" class="an-alert">{{ erreur }}</p>

    <div class="an-kpis">
      <div class="an-kpi k-vert"><div class="an-kv">{{ totalEnCours }}</div><div class="an-kl">Lots en production</div></div>
      <div class="an-kpi" :class="totalProb ? 'k-rouge' : 'k-slate'"><div class="an-kv">{{ totalProb }}</div><div class="an-kl">Lots en problème</div></div>
      <div class="an-kpi k-vert"><div class="an-kv">{{ tuiles.filter(t => t.etat === 'vert').length }}</div><div class="an-kl">Ateliers en marche</div></div>
      <div class="an-kpi" :class="nbAlerte ? 'k-rouge' : 'k-slate'"><div class="an-kv">{{ nbAlerte }}</div><div class="an-kl">Ateliers en alerte</div></div>
    </div>

    <div v-if="zonesDispo.length" class="an-perim">
      <span class="an-perim-lbl">Périmètre :</span>
      <label v-for="z in zonesDispo" :key="z.key" class="an-chip" :class="{ on: zoneSel(z.key) }"><input type="checkbox" :checked="zoneSel(z.key)" @change="toggleZone(z.key)" />{{ z.label }}</label>
      <button v-if="perimSel.length" type="button" class="an-chip-reset" @click="perimSel = []">Tous</button>
    </div>

    <div v-if="!tuiles.length && !chargement" class="an-empty">Aucun atelier avec des phases enregistrées.</div>

    <div class="an-grid">
      <div v-for="t in tuiles" :key="t.phase" class="an-tile" :class="'t-' + t.etat">
        <div class="an-tile-head">
          <span class="an-light" :class="'l-' + t.etat"></span>
          <h2 class="an-tile-title">{{ t.phase }}</h2>
          <span class="an-state-txt">{{ etatTxt(t.etat) }}</span>
        </div>
        <div class="an-tile-counts">
          <span class="an-cnt c-cours">{{ t.nb }} en cours</span>
          <span v-if="t.prob" class="an-cnt c-prob">{{ t.prob }} problème<span v-if="t.prob > 1">s</span></span>
          <span v-if="t.long" class="an-cnt c-long">{{ t.long }} qui traîne<span v-if="t.long > 1">nt</span></span>
          <span v-if="t.attente" class="an-cnt c-att">{{ t.attente }} en attente</span>
        </div>
        <div v-if="t.nbMach" class="an-mach">🔧 {{ t.occMach.length }}/{{ t.nbMach }} machine<span v-if="t.nbMach > 1">s</span> occupée<span v-if="t.occMach.length !== 1">s</span><span v-if="t.libMach.length" class="an-mach-lib"> · libres : {{ t.libMach.map(e => e.code || e.nom).join(', ') }}</span></div>
        <ul v-if="t.lots.length" class="an-lots">
          <li v-for="l in t.lots" :key="l.id" :class="{ 'lot-prob': l.probleme, 'lot-long': estLong(l) }">
            <span class="an-lot-no">{{ l.lot }}</span>
            <span class="an-lot-prod">{{ l.code }}<span v-if="l.desig"> — {{ l.desig }}</span></span>
            <span v-if="l.tags.length" class="an-lot-tags"><span v-for="tg in l.tags" :key="tg" class="an-tag">{{ tg }}</span></span>
            <span v-if="l.debut" class="an-lot-dur" :class="{ long: estLong(l) }">⏱ {{ dureeLabel(l.debut) }}</span>
            <span v-if="l.equip" class="an-lot-eq">{{ equipNom(l.equip) }}</span>
          </li>
        </ul>
        <div v-else class="an-idle">Aucun lot en cours</div>
      </div>
    </div>

    <p class="an-foot">Vert = production en cours · Rouge = déviation ou triage en cours (arrêt/problème) · Gris = atelier à l'arrêt. L'état « en cours » vient des phases dont le début est saisi sans fin (Suivi des phases).</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { supabase } from '../supabase'

const phases = ref([])      // suivi_phases actives
const ordres = ref([])      // OF en cours
const equipements = ref([])
const chargement = ref(true)
const erreur = ref('')
const auto = ref(true)           // rafraîchissement automatique (30 s)
const majAt = ref('')            // heure de dernière mise à jour
const presentation = ref(false)  // mode plein écran / présentation
const racine = ref(null)
const SEUIL_LONG = 3             // jours : au-delà, un lot en cours « traîne »
const hormonalParCode = ref({})  // code_pf -> true si hormonal
const perimSel = ref([])         // périmètres cochés (vide = tous)
const son = ref(false)           // alerte sonore sur nouveau problème
let prevProb = null
let timer = null

async function fetchAllPaged(make) {
  const size = 1000; let from = 0, all = []
  for (;;) { const r = await make().range(from, from + size - 1); if (r.error) return { error: r.error, data: all }; all = all.concat(r.data || []); if (!r.data || r.data.length < size) break; from += size }
  return { data: all, error: null }
}

async function charger() {
  chargement.value = true; erreur.value = ''
  const ro = await fetchAllPaged(() => supabase.from('ordres_fabrication')
    .select('id, numero_lot, statut, deviation, deviation_cond, en_triage, date_lancement, date_fin_fabrication, produits(code_pf, designation, forme)'))
  if (ro.error) { erreur.value = ro.error.message; chargement.value = false; return }
  // OF en cours de fabrication : lancés et non terminés
  ordres.value = (ro.data || []).filter(o => o.date_lancement && !o.date_fin_fabrication)
  const rp = await fetchAllPaged(() => supabase.from('suivi_phases')
    .select('ordre_id, phase, statut, date_debut, date_phase, equipement_id, en_triage, triage_debut, triage_fin').eq('actif', true))
  if (!rp.error) phases.value = rp.data || []
  const re = await fetchAllPaged(() => supabase.from('equipements').select('id, code, nom, type, atelier_id').eq('actif', true))
  if (!re.error) equipements.value = re.data || []
  const rh = await supabase.from('produits').select('code_pf, hormonal')
  if (!rh.error && rh.data) { const m = {}; for (const p of rh.data) if (p.hormonal) m[p.code_pf] = true; hormonalParCode.value = m }
  majAt.value = new Date().toLocaleTimeString('fr-FR')
  chargement.value = false
}

function demarrerAuto() { arreterAuto(); if (auto.value) timer = setInterval(() => { if (!chargement.value) charger() }, 30000) }
function arreterAuto() { if (timer) { clearInterval(timer); timer = null } }
watch(auto, (v) => v ? demarrerAuto() : arreterAuto())
onMounted(() => { charger(); demarrerAuto() })
onUnmounted(arreterAuto)

async function basculerPlein() {
  presentation.value = !presentation.value
  try {
    if (presentation.value && racine.value && racine.value.requestFullscreen) await racine.value.requestFullscreen()
    else if (!presentation.value && document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen()
  } catch (e) { /* le mode CSS reste actif même si l'API plein écran est refusée */ }
}

function joursDepuis(d) { if (!d) return null; const x = new Date(String(d).slice(0, 10) + 'T00:00:00'); if (isNaN(x.getTime())) return null; return Math.max(0, Math.floor((Date.now() - x.getTime()) / 86400000)) }
function dureeLabel(d) { const j = joursDepuis(d); return j == null ? '' : (j === 0 ? "aujourd'hui" : j === 1 ? '1 j' : j + ' j') }
function estLong(l) { const j = joursDepuis(l.debut); return j != null && j > SEUIL_LONG }

const ordreById = computed(() => { const m = {}; for (const o of ordres.value) m[o.id] = o; return m })
const equipById = computed(() => { const m = {}; for (const e of equipements.value) m[e.id] = e; return m })
function equipNom(id) { const e = equipById.value[id]; return e ? (e.code || e.nom || '') : '' }

// Périmètre (zone) à partir de la forme du produit + caractère hormonal
const HORMONAUX_KW = ['levothyrox', 'levothyroxine']
const normZ = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
function zoneForme(forme) { const f = normZ(forme); if (!f) return 'autre'; if (/comprim|gelul|sachet|blister/.test(f)) return 'seche'; if (/pommade|crem|gel/.test(f)) return 'semi'; if (/seringue|injectable/.test(f)) return 'seringue'; return 'autre' }
function estHormonal(p) { if (!p) return false; if (p.code_pf && hormonalParCode.value[p.code_pf]) return true; const s = normZ((p.designation || '') + ' ' + (p.code_pf || '')); return HORMONAUX_KW.some(k => s.includes(k)) }
function zoneProd(p) { const z = zoneForme(p && p.forme); return (estHormonal(p) && z === 'seche') ? 'seche_hormonale' : z }
const ZONES = [{ key: 'seche', label: 'Forme sèche' }, { key: 'seche_hormonale', label: 'Forme sèche hormonale' }, { key: 'semi', label: 'Forme semi solide' }, { key: 'seringue', label: 'Seringue' }, { key: 'autre', label: 'Forme ?' }]
function toggleZone(k) { const i = perimSel.value.indexOf(k); if (i >= 0) perimSel.value.splice(i, 1); else perimSel.value.push(k) }
function zoneSel(k) { return perimSel.value.includes(k) }
function zoneMatch(l) { return !perimSel.value.length || perimSel.value.includes(l.zone) }

// Machines par atelier (pour le détail occupé / libre)
function phaseDeType(type) { const t = (type || '').toLowerCase(); if (/pes[ée]|balance|bascule/.test(t)) return 'pesee'; if (/granul/.test(t)) return 'granulation'; if (/séch|sech/.test(t)) return 'sechage'; if (/mélang|melang/.test(t)) return 'melange'; if (/gélule|gelule|remplis|encapsul|capsul/.test(t)) return 'remplissage'; if (/compress|presse|compri/.test(t)) return 'compression'; if (/pellicul|enrob|coat|dragé|drage/.test(t)) return 'pelliculage'; if (/condition|blister|thermoform|uhlmann|integra|marchesini|emball|étui|etui|fardel|encart|mise en bo/.test(t)) return 'conditionnement'; return null }
const PK_ATELIER = { pesee: 'Pesée', granulation: 'Granulation et Séchage', sechage: 'Granulation et Séchage', melange: 'Mélange', remplissage: 'Remplissage', compression: 'Compression', pelliculage: 'Pelliculage', conditionnement: 'Conditionnement' }
function atelierDeEquip(e) { const k = phaseDeType(e.type); return k ? (PK_ATELIER[k] || null) : null }
const machinesParAtelier = computed(() => { const m = {}; for (const e of equipements.value) { const a = atelierDeEquip(e); if (!a) continue; (m[a] = m[a] || []).push(e) } return m })

function bip() { try { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; const ctx = new AC(); const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.value = 880; o.connect(g); g.connect(ctx.destination); g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45); o.start(); o.stop(ctx.currentTime + 0.45); setTimeout(() => { try { ctx.close() } catch (e) {} }, 800) } catch (e) {} }
const zonesDispo = computed(() => { const s = new Set(); const { cours } = parAtelier.value; for (const ph in cours) for (const l of cours[ph]) s.add(l.zone); return ZONES.filter(z => s.has(z.key)) })

const ORDRE = ['Pesée', 'Granulation et Séchage', 'Mélange', 'Compression', 'Pelliculage', 'Conditionnement', 'Livraison Vrac']
function normPh(p) { p = String(p || '').trim(); return /^(granulation|s[ée]chage)$/i.test(p) ? 'Granulation et Séchage' : p }
function rang(ph) { const i = ORDRE.indexOf(ph); return i < 0 ? 99 : i }

// Ateliers réels = phases présentes dans les enregistrements
const ateliersReels = computed(() => {
  const s = new Set()
  for (const p of phases.value) { const n = normPh(p.phase); if (n) s.add(n) }
  return [...s].sort((a, b) => rang(a) - rang(b) || a.localeCompare(b))
})

// Lots en cours (phase démarrée non terminée) par atelier, + attente (phase à faire sur un OF en cours)
const parAtelier = computed(() => {
  const cours = {}, attente = {}
  for (const s of phases.value) {
    const o = ordreById.value[s.ordre_id]
    if (!o) continue // seulement les OF en cours
    const ph = normPh(s.phase)
    if (s.statut === 'En cours' || (s.date_debut && !s.date_phase)) {
      const tags = []
      if (o.deviation) tags.push('Déviation fab.')
      if (o.deviation_cond) tags.push('Déviation cond.')
      if (o.en_triage || (s.triage_debut && !s.triage_fin)) tags.push('Triage')
      const probleme = tags.length > 0
      ;(cours[ph] = cours[ph] || []).push({ id: o.id, lot: o.numero_lot || '—', code: (o.produits && o.produits.code_pf) || '—', desig: (o.produits && o.produits.designation) || '', probleme, tags, debut: s.date_debut || null, equip: s.equipement_id || null, zone: zoneProd(o.produits) })
    } else if (s.statut === 'À faire' || (!s.date_debut && !s.date_phase)) {
      attente[ph] = (attente[ph] || 0) + 1
    }
  }
  return { cours, attente }
})

const tuiles = computed(() => {
  const { cours, attente } = parAtelier.value
  return ateliersReels.value.map(ph => {
    const lots = (cours[ph] || []).filter(zoneMatch).sort((a, b) => (b.probleme ? 1 : 0) - (a.probleme ? 1 : 0) || (joursDepuis(b.debut) || 0) - (joursDepuis(a.debut) || 0))
    const prob = lots.filter(l => l.probleme).length
    const long = lots.filter(l => estLong(l)).length
    const etat = prob > 0 ? 'rouge' : (lots.length > 0 ? 'vert' : 'gris')
    const machines = machinesParAtelier.value[ph] || []
    const occIds = new Set(lots.map(l => l.equip).filter(Boolean))
    const occMach = machines.filter(e => occIds.has(e.id))
    const libMach = machines.filter(e => !occIds.has(e.id))
    return { phase: ph, lots, nb: lots.length, prob, long, attente: attente[ph] || 0, etat, nbMach: machines.length, occMach, libMach }
  })
})

const totalEnCours = computed(() => tuiles.value.reduce((s, t) => s + t.nb, 0))
const totalProb = computed(() => tuiles.value.reduce((s, t) => s + t.prob, 0))
const nbAlerte = computed(() => tuiles.value.filter(t => t.etat === 'rouge').length)
watch(totalProb, (n) => { if (son.value && prevProb != null && n > prevProb) bip(); prevProb = n })
function etatTxt(e) { return e === 'rouge' ? 'ALERTE' : e === 'vert' ? 'En marche' : 'À l\'arrêt' }
</script>

<style scoped>
.andon { max-width: 1280px; margin: 0 auto; padding: 4px 2px 40px; }
.an-tools { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.an-maj { font-size: 11.5px; color: #94a3b8; font-weight: 600; }
.an-auto { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; color: #475569; font-weight: 600; }
.c-long { background: #fff7ed; color: #c2410c; }
.an-lot-dur { font-size: 10.5px; color: #64748b; font-weight: 700; background: #f1f5f9; padding: 1px 6px; border-radius: 999px; }
.an-lot-dur.long { background: #ffedd5; color: #c2410c; }
.an-lots li.lot-long:not(.lot-prob) { background: #fff7ed; }
.an-perim { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin: 0 0 16px; }
.an-perim-lbl { font-size: 12px; font-weight: 700; color: #475569; }
.an-chip { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: #334155; background: #fff; border: 1px solid #e2e8f0; border-radius: 999px; padding: 4px 11px; cursor: pointer; }
.an-chip.on { background: #fde8ef; border-color: #f9a8c4; color: #9f1239; }
.an-chip input { margin: 0; }
.an-chip-reset { font-size: 12px; font-weight: 700; color: #e11d48; background: none; border: 0; cursor: pointer; }
.an-mach { font-size: 11.5px; color: #475569; margin-bottom: 8px; font-weight: 600; }
.an-mach-lib { color: #94a3b8; font-weight: 500; }
.andon.pres .an-perim-lbl, .andon.pres .an-mach { color: #cbd5e1; }
.andon.pres .an-chip { background: #111a2e; border-color: #1f2a44; color: #e5e7eb; }
.andon.pres .an-mach-lib { color: #64748b; }
/* Mode présentation / plein écran (écran d'atelier) */
.andon.pres { max-width: none; background: #0b1220; color: #e5e7eb; min-height: 100vh; padding: 22px 26px; }
.andon.pres .an-eyebrow { color: #fb7185; }
.andon.pres .an-title { color: #fff; font-size: 30px; }
.andon.pres .an-sub, .andon.pres .an-foot { display: none; }
.andon.pres .an-maj { color: #94a3b8; }
.andon.pres .an-auto { color: #cbd5e1; }
.andon.pres .an-kpi, .andon.pres .an-tile { background: #111a2e; border-color: #1f2a44; }
.andon.pres .an-kpi .an-kv, .andon.pres .an-tile-title { color: #f1f5f9; }
.andon.pres .an-grid { grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 18px; }
.andon.pres .an-tile-title { font-size: 19px; }
.andon.pres .an-lots li { background: #0b1220; color: #e5e7eb; }
.andon.pres .an-lot-no, .andon.pres .an-lot-prod { color: #e5e7eb; }
.andon.pres .an-tile.t-rouge { background: #2a1115; border-color: #7f1d1d; }
.an-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.an-eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #e11d48; }
.an-title { margin: 2px 0 2px; font-size: 24px; font-weight: 800; color: #0f172a; }
.an-sub { margin: 0; color: #64748b; font-size: 13.5px; }
.an-refresh { border: 1px solid #e2e8f0; background: #fff; border-radius: 9px; padding: 8px 14px; font: inherit; font-size: 13px; font-weight: 700; color: #334155; cursor: pointer; white-space: nowrap; }
.an-refresh:hover { background: #f8fafc; }
.an-alert { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; border-radius: 8px; padding: 10px 14px; font-size: 13px; }
.an-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; }
.an-kpi { border-radius: 12px; padding: 14px 16px; border: 1px solid #e2e8f0; background: #fff; }
.an-kv { font-size: 28px; font-weight: 800; line-height: 1; }
.an-kl { margin-top: 4px; font-size: 12.5px; color: #64748b; font-weight: 600; }
.k-vert .an-kv { color: #047857; } .k-vert { background: #ecfdf5; border-color: #a7f3d0; }
.k-rouge .an-kv { color: #b91c1c; } .k-rouge { background: #fef2f2; border-color: #fecaca; }
.k-slate .an-kv { color: #334155; }
.an-empty { text-align: center; color: #64748b; padding: 40px; }
.an-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
.an-tile { border-radius: 14px; border: 1px solid #e2e8f0; background: #fff; padding: 14px 16px; box-shadow: 0 1px 2px rgba(0,0,0,.04); }
.an-tile.t-rouge { border-color: #fca5a5; background: #fff6f6; }
.an-tile.t-vert { border-color: #a7f3d0; }
.an-tile-head { display: flex; align-items: center; gap: 10px; }
.an-light { width: 16px; height: 16px; border-radius: 50%; background: #cbd5e1; flex: none; }
.an-light.l-vert { background: #22c55e; box-shadow: 0 0 0 4px rgba(34,197,94,.18); }
.an-light.l-gris { background: #cbd5e1; }
.an-light.l-rouge { background: #ef4444; animation: anPulse 1.1s infinite; }
@keyframes anPulse { 0% { box-shadow: 0 0 0 0 rgba(239,68,68,.6); } 70% { box-shadow: 0 0 0 8px rgba(239,68,68,0); } 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); } }
.an-tile-title { margin: 0; font-size: 15px; font-weight: 800; color: #0f172a; flex: 1; }
.an-state-txt { font-size: 11px; font-weight: 800; letter-spacing: .04em; color: #64748b; }
.t-rouge .an-state-txt { color: #b91c1c; }
.t-vert .an-state-txt { color: #047857; }
.an-tile-counts { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; }
.an-cnt { font-size: 11.5px; font-weight: 700; padding: 3px 9px; border-radius: 999px; }
.c-cours { background: #ecfdf5; color: #047857; }
.c-prob { background: #fee2e2; color: #b91c1c; }
.c-att { background: #f1f5f9; color: #64748b; }
.an-lots { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.an-lots li { display: flex; align-items: center; gap: 8px; font-size: 12.5px; padding: 5px 8px; border-radius: 8px; background: #f8fafc; flex-wrap: wrap; }
.an-lots li.lot-prob { background: #fef2f2; }
.an-lot-no { font-weight: 800; font-variant-numeric: tabular-nums; color: #0f172a; }
.an-lot-prod { color: #475569; flex: 1; min-width: 80px; }
.an-tag { display: inline-block; font-size: 10px; font-weight: 700; color: #b91c1c; background: #fee2e2; padding: 1px 6px; border-radius: 999px; margin-left: 4px; }
.an-lot-eq { font-size: 10.5px; color: #64748b; font-weight: 700; background: #eef2ff; padding: 1px 6px; border-radius: 999px; }
.an-idle { color: #94a3b8; font-size: 12.5px; font-style: italic; padding: 4px 0; }
.an-foot { margin-top: 18px; color: #94a3b8; font-size: 12px; }
@media (max-width: 720px) { .an-kpis { grid-template-columns: repeat(2, 1fr); } }
</style>
