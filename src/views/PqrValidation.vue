<template>
  <div class="pqr-page">
    <PageHeader title="Référentiel PQR — Protocole de validation procédé" tone="#a855f7"
      subtitle="Protocole de validation des procédés de fabrication : approche, critères d'acceptation et lots de validation par produit." />

    <p v-if="erreur" class="alert">{{ erreur }}</p>
    <p v-if="message" class="ok">{{ message }}</p>

    <section class="card">
      <div class="card-head">
        <h2 class="card-title">Protocole de validation</h2>
        <span v-if="produitSel" class="count" :class="'badge-' + protocole.statut">{{ statutLabel(protocole.statut) }}</span>
        <input v-model="recherche" class="pqr-search" placeholder="🔍 Rechercher un produit…" style="margin-left:auto" />
        <select v-model="produitSel" class="prod-sel">
          <option value="">— Choisir un produit —</option>
          <option v-for="pr in produitsFiltres" :key="pr.id" :value="String(pr.id)">{{ pr.code_pf }} — {{ pr.designation }}</option>
        </select>
      </div>

      <div v-if="!produitSel" class="empty-card">Choisis un produit pour créer ou consulter son protocole de validation procédé.</div>

      <template v-else>
        <div class="pv-top-actions"><button class="btn ghost" @click="exporterPDF">🖨 Exporter (PDF)</button></div>
        <!-- En-tête du protocole -->
        <div class="pv-grid">
          <label class="pv-f"><span>Référence</span><input v-model="protocole.reference" :disabled="!peutEditer" placeholder="PV-…" /></label>
          <label class="pv-f"><span>Approche</span>
            <select v-model="protocole.approche" :disabled="!peutEditer"><option value="">—</option><option value="prospective">Prospective</option><option value="concurrente">Concurrente</option><option value="retrospective">Rétrospective</option></select>
          </label>
          <label class="pv-f"><span>Nature</span>
            <select v-model="protocole.nature" :disabled="!peutEditer"><option value="">—</option><option value="initiale">Validation initiale</option><option value="revalidation">Revalidation</option><option value="transfert">Transfert</option></select>
          </label>
          <label class="pv-f pv-sm"><span>Nb lots</span><input v-model.number="protocole.nb_lots" type="number" min="1" :disabled="!peutEditer" /></label>
          <label class="pv-f pv-sm"><span>Date protocole</span><input v-model="protocole.date_protocole" type="date" :disabled="!peutEditer" /></label>
          <label class="pv-f"><span>Responsable</span><input v-model="protocole.responsable" :disabled="!peutEditer" placeholder="Nom / fonction" /></label>
          <label class="pv-f"><span>Statut</span>
            <select v-model="protocole.statut" :disabled="!peutEditer"><option value="brouillon">Brouillon</option><option value="en_cours">En cours</option><option value="valide">Validé</option><option value="cloture">Clôturé</option></select>
          </label>
        </div>
        <div class="pv-grid2">
          <label class="pv-f"><span>Portée / objectif</span><textarea v-model="protocole.portee" :disabled="!peutEditer" rows="2" placeholder="Procédé, dosage, taille de lot, équipements concernés…"></textarea></label>
          <label class="pv-f"><span>Critères d'acceptation (généraux)</span><textarea v-model="protocole.criteres" :disabled="!peutEditer" rows="2" placeholder="Ex. 3 lots consécutifs conformes à toutes les specs ; RSD ≤ … ; dissolution ≥ …"></textarea></label>
        </div>
        <div v-if="peutEditer" class="pv-save">
          <button class="btn" @click="enregistrerProtocole">💾 {{ protocole.id ? 'Mettre à jour le protocole' : 'Créer le protocole' }}</button>
        </div>

        <!-- Paramètres critiques à valider -->
        <h3 class="pv-sect">Paramètres critiques à valider <span class="pv-sect-sub">critères d'acceptation issus des « Paramètres critiques » du produit</span></h3>
        <div v-if="!paramsProduit.length" class="pqr-note">Aucun paramètre critique défini pour ce produit. Renseigne-les d'abord dans « Paramètres critiques ».</div>
        <div v-for="ph in phasesAffichees" :key="ph" class="pqr-phase">
          <h4 class="pqr-phase-titre">{{ ph }}</h4>
          <table class="pqr-tbl">
            <thead><tr><th>Paramètre</th><th>Unité</th><th class="r">Min</th><th class="r">Cible</th><th class="r">Max</th></tr></thead>
            <tbody>
              <tr v-for="p in paramsDe(ph)" :key="p.id">
                <td class="nom">{{ p.nom }}<span v-if="p.par_api" class="tag-api">par API</span></td>
                <td>{{ p.type === 'bool' ? '—' : (effUnite(p) || '—') }}</td>
                <td class="r">{{ p.type === 'bool' ? '—' : fmt(effMin(p)) }}</td>
                <td class="r cible">{{ p.type === 'bool' ? (p.etat_attendu ? 'Attendu : ' + p.etat_attendu : 'ON/OFF') : fmt(effCible(p)) }}</td>
                <td class="r">{{ p.type === 'bool' ? '—' : fmt(effMax(p)) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Lots de validation -->
        <h3 class="pv-sect">Lots de validation <span class="pv-sect-sub">{{ lotsConformes }}/{{ lots.length }} conforme(s) · objectif {{ protocole.nb_lots }} lot(s)</span></h3>
        <div class="pv-tbl-wrap">
          <table class="pqr-tbl pv-lots">
            <thead><tr><th>#</th><th>N° lot</th><th class="r">Taille (bts)</th><th>Date fab.</th><th>Statut</th><th>Conformité (mesures)</th><th>Écarts / observations</th><th v-if="peutEditer" class="r">Act.</th></tr></thead>
            <tbody>
              <template v-for="(l, i) in lots" :key="l._k">
              <tr>
                <td>{{ i + 1 }}</td>
                <td><input v-model="l.numero_lot" :disabled="!peutEditer" class="pv-in" placeholder="N° lot" /></td>
                <td class="r"><input v-model.number="l.taille_lot" type="number" min="0" :disabled="!peutEditer" class="pv-in pv-in-n" placeholder="—" /></td>
                <td><input v-model="l.date_fabrication" type="date" :disabled="!peutEditer" class="pv-in" /></td>
                <td><select v-model="l.statut" :disabled="!peutEditer" class="pv-in pv-st" :class="'st-' + l.statut"><option value="prevu">Prévu</option><option value="en_cours">En cours</option><option value="conforme">Conforme</option><option value="non_conforme">Non conforme</option></select></td>
                <td><span class="pv-verdict" :class="['v-' + (verdictLot(l).v || 'none'), { clickable: !!mesuresDe(l) }]" :title="mesuresDe(l) ? 'Clique pour le détail paramètre par paramètre' : (verdictLot(l).detail || '')" @click="mesuresDe(l) && toggleDetail(l)">{{ verdictTxt(verdictLot(l)) }}<span v-if="mesuresDe(l)" class="pv-chev">{{ expanded[l._k] ? '▴' : '▾' }}</span></span></td>
                <td><input v-model="l.ecarts" :disabled="!peutEditer" class="pv-in pv-in-w" placeholder="—" /></td>
                <td v-if="peutEditer" class="act"><button @click="retirerLot(i)" title="Retirer">🗑</button></td>
              </tr>
              <tr v-if="expanded[l._k]" class="pv-detail-row">
                <td :colspan="peutEditer ? 8 : 7">
                  <div v-if="!detailLot(l).length" class="pv-det-empty">Aucune mesure rattachée au lot {{ l.numero_lot || '—' }}.</div>
                  <table v-else class="pv-det-tbl">
                    <thead><tr><th>Paramètre</th><th>Phase</th><th>Valeurs</th><th>Limites (min – max)</th><th>Verdict</th></tr></thead>
                    <tbody>
                      <tr v-for="d in detailLot(l)" :key="d.id" :class="{ 'det-hors': d.conforme === false }">
                        <td class="det-nom">{{ d.nom }}</td>
                        <td class="det-ph">{{ d.phase }}</td>
                        <td>{{ d.vals.join(' · ') }} <span class="det-u">{{ d.unite }}</span></td>
                        <td>{{ fmt(d.min) }} – {{ fmt(d.max) }}</td>
                        <td><span class="det-v" :class="d.conforme === false ? 'nok' : (d.conforme === true ? 'ok' : 'na')">{{ d.conforme === false ? '✗ hors' : (d.conforme === true ? '✓ ok' : '—') }}</span></td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
              </template>
              <tr v-if="!lots.length"><td :colspan="peutEditer ? 8 : 7" class="pv-empty">Aucun lot de validation.</td></tr>
            </tbody>
          </table>
        </div>
        <div class="pv-lots-actions">
          <button class="btn ghost" @click="verifierConformite(false)">🔎 Vérifier la conformité (mesures)</button>
          <span class="pv-auto-note">Les statuts sont mis à jour automatiquement depuis les mesures. Clique un verdict pour le détail.</span>
        </div>
        <div v-if="peutEditer" class="pv-lots-actions">
          <button class="btn ghost" @click="ajouterLot">＋ Ajouter un lot</button>
          <button v-if="lots.length < (Number(protocole.nb_lots) || 0)" class="btn ghost" @click="ajouterLotsObjectif">＋ Compléter à {{ protocole.nb_lots }} lots</button>
          <button class="btn" @click="enregistrerLots" :disabled="!protocole.id">💾 Enregistrer les lots</button>
        </div>
        <p v-if="!protocole.id" class="pqr-note">Crée d'abord le protocole (bouton plus haut) pour pouvoir enregistrer les lots.</p>

        <!-- Conclusion -->
        <h3 class="pv-sect">Conclusion</h3>
        <textarea v-model="protocole.conclusion" :disabled="!peutEditer" rows="3" class="pv-concl" placeholder="Synthèse : procédé validé / non validé, écarts rencontrés, actions, références documentaires…"></textarea>
        <div v-if="peutEditer" class="pv-save"><button class="btn" @click="enregistrerProtocole">💾 Enregistrer le protocole</button></div>

        <!-- Annexe : granulométrie & densité -->
        <h3 class="pv-sect">Annexe — Résultats granulométrie &amp; densité <span class="pv-sect-sub">par lot de validation · analyses enregistrées (N° de lot correspondant)</span></h3>
        <div v-if="!granuloLots.length" class="pqr-note">Aucune analyse granulométrie / densité enregistrée pour les N° de lot ci-dessus. Saisis-les dans « Granulométrie &amp; densité » et enregistre-les avec le même N° de lot, puis clique « Vérifier la conformité ».</div>
        <div v-for="g in granuloLots" :key="g.numero_lot" class="pv-annex">
          <div class="pv-annex-head">
            <span class="pv-annex-lot">Lot {{ g.numero_lot }}</span>
            <span v-if="g.libelle" class="pv-annex-lib">{{ g.libelle }}</span>
            <span class="pv-annex-date">{{ frDate(g.date_analyse) }}</span>
          </div>
          <div class="pv-annex-body">
            <div class="pv-annex-chart">
              <svg v-if="g.chart.ok" :viewBox="'0 0 ' + GCW + ' ' + GCH" class="pv-svg" preserveAspectRatio="xMidYMid meet">
                <line v-for="q in [0,25,50,75,100]" :key="'ag'+q" :x1="GML" :x2="GCW-GMR" :y1="gY(q)" :y2="gY(q)" class="pv-gl" />
                <text v-for="q in [0,25,50,75,100]" :key="'agl'+q" :x="GML-5" :y="gY(q)+3" class="pv-axl">{{ q }}</text>
                <rect v-for="(b,bi) in g.chart.bars" :key="'ab'+bi" :x="b.x" :y="b.y" :width="b.w" :height="b.h" class="pv-bar" />
                <polyline :points="g.chart.poly" class="pv-line-pass" />
                <polyline :points="g.chart.polyRefus" class="pv-line-refus" />
                <text v-for="(b,bi) in g.chart.bars" :key="'ax'+bi" :x="b.x+b.w/2" :y="GCH-GMB+12" class="pv-xlab">{{ b.label }}</text>
              </svg>
              <p v-else class="pv-det-empty">Pas de données granulométriques.</p>
              <div class="pv-annex-leg"><span class="lg lg-bar"></span>% retenu <span class="lg lg-pass"></span>passant cumulé <span class="lg lg-refus"></span>refus cumulé</div>
            </div>
            <div class="pv-annex-kpis">
              <div class="pv-kpi"><span>D10</span><b>{{ dMic(g.d10) }}</b></div>
              <div class="pv-kpi"><span>D50 médian</span><b>{{ dMic(g.d50) }}</b></div>
              <div class="pv-kpi"><span>D90</span><b>{{ dMic(g.d90) }}</b></div>
              <div class="pv-kpi"><span>Span</span><b>{{ g.span != null ? g.span.toFixed(2) : '—' }}</b></div>
              <div class="pv-kpi"><span>Densité apparente</span><b>{{ g.densApp != null ? g.densApp.toFixed(3) : '—' }}<em>g/mL</em></b></div>
              <div class="pv-kpi"><span>Densité tassée</span><b>{{ g.densTass != null ? g.densTass.toFixed(3) : '—' }}<em>g/mL</em></b></div>
              <div class="pv-kpi"><span>Hausner</span><b>{{ g.hausner != null ? g.hausner.toFixed(3) : '—' }}</b></div>
              <div class="pv-kpi"><span>Carr</span><b>{{ g.carr != null ? g.carr.toFixed(1) + ' %' : '—' }}</b></div>
              <div class="pv-kpi pv-kpi-flow" :style="{ color: g.flow.c }"><span>Écoulement</span><b>{{ g.flow.t }}</b></div>
            </div>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, inject, watch } from 'vue'
import { supabase } from '../supabase'
import { LOGO_HTML } from '../logo'
import PageHeader from '../components/PageHeader.vue'

const peutEditer = inject('peutEditer', ref(true))

const produits = ref([]), produitSel = ref(''), recherche = ref('')
const params = ref([])      // référentiel pqr_parametres
const specs = ref({})       // specs produit : parametre_id -> {min,cible,max,unite}
const protocoleVide = () => ({ id: null, reference: '', approche: '', nature: '', nb_lots: 3, portee: '', criteres: '', responsable: '', statut: 'brouillon', date_protocole: '', conclusion: '' })
const protocole = reactive(protocoleVide())
const lots = ref([])
const mesuresParLot = ref({})   // numero_lot -> { parametre_id -> [mesures] }
const expanded = ref({})        // l._k -> détail déplié
const erreur = ref(''), message = ref('')
let lotSeq = 1

// ---- Annexe : granulométrie & densité par lot de validation ----
const granuloParLot = ref({})
const GCW = 640, GCH = 230, GML = 42, GMR = 42, GMT = 16, GMB = 34
const gPlotW = GCW - GML - GMR, gPlotH = GCH - GMT - GMB
const gY = (p) => GMT + gPlotH - (p / 100) * gPlotH
const dMic = (v) => (v == null ? '—' : (Math.round(v) + ' µm'))

function flowCalc(c) {
  if (c == null) return { t: '—', c: '#94a3b8' }
  if (c <= 10) return { t: 'Excellent', c: '#16a34a' }
  if (c <= 15) return { t: 'Bon', c: '#16a34a' }
  if (c <= 20) return { t: 'Assez bon', c: '#65a30d' }
  if (c <= 25) return { t: 'Passable', c: '#ca8a04' }
  if (c <= 31) return { t: 'Médiocre', c: '#ea580c' }
  if (c <= 37) return { t: 'Très médiocre', c: '#dc2626' }
  return { t: 'Très mauvais', c: '#b91c1c' }
}
function buildChart(sorted, tot) {
  const n = sorted.length
  if (!n || !(tot > 0)) return { ok: false, bars: [], poly: '', polyRefus: '' }
  const maxPct = Math.max(1, ...sorted.map(r => r.pct))
  const bw = gPlotW / n
  const bars = sorted.map((r, i) => { const h = (r.pct / maxPct) * gPlotH; return { x: GML + i * bw + bw * 0.2, w: bw * 0.6, y: GMT + gPlotH - h, h, label: r.taille } })
  const pts = sorted.map((r, i) => ({ x: GML + i * bw + bw * 0.5, y: gY(r.pass) }))
  const ptsRefus = sorted.map((r, i) => ({ x: GML + i * bw + bw * 0.5, y: gY(100 - r.pass) }))
  return { ok: true, bars, poly: pts.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' '), polyRefus: ptsRefus.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ') }
}
function buildGranulo(a) {
  const rowsRaw = (a.tamis || []).map(s => {
    const hasBN = (s.brut != null) || (s.net != null)
    const ret = hasBN ? ((Number(s.brut) || 0) - (Number(s.net) || 0)) : (Number(s.retenu) || 0)
    return { taille: Number(s.taille) || 0, ret }
  })
  const tot = rowsRaw.reduce((x, r) => x + r.ret, 0)
  const sorted = rowsRaw.map(r => {
    let rc = 0; for (const x of rowsRaw) if (x.taille >= r.taille) rc += x.ret
    return { taille: r.taille, pass: tot > 0 ? 100 - rc / tot * 100 : 0, pct: tot > 0 ? r.ret / tot * 100 : 0 }
  }).sort((p, q) => p.taille - q.taille)
  const dVal = (p) => {
    if (!(tot > 0) || !sorted.length) return null
    if (p <= sorted[0].pass) return sorted[0].taille
    for (let i = 1; i < sorted.length; i++) { if (sorted[i].pass >= p) { const x = sorted[i - 1], y = sorted[i]; if (y.pass === x.pass) return y.taille; return x.taille + (y.taille - x.taille) * (p - x.pass) / (y.pass - x.pass) } }
    return sorted[sorted.length - 1].taille
  }
  const d10 = dVal(10), d50 = dVal(50), d90 = dVal(90)
  const span = (d10 != null && d50 && d90 && d50 > 0) ? (d90 - d10) / d50 : null
  const carr = a.carr != null ? Number(a.carr) : null
  return {
    numero_lot: a.numero_lot, libelle: a.libelle, date_analyse: a.date_analyse,
    d10, d50, d90, span,
    densApp: a.dens_app != null ? Number(a.dens_app) : null,
    densTass: a.dens_tass != null ? Number(a.dens_tass) : null,
    hausner: a.hausner != null ? Number(a.hausner) : null,
    carr, flow: flowCalc(carr),
    chart: buildChart(sorted, tot)
  }
}
async function chargerGranulo() {
  const nums = [...new Set(lots.value.map(l => (l.numero_lot || '').trim()).filter(Boolean))]
  if (!nums.length) { granuloParLot.value = {}; return }
  const r = await supabase.from('granulo_analyses').select('*').in('numero_lot', nums).eq('actif', true).order('id', { ascending: false })
  if (r.error) { granuloParLot.value = {}; return }
  const by = {}
  for (const a of (r.data || [])) { const ln = (a.numero_lot || '').trim(); if (ln && !by[ln]) by[ln] = buildGranulo(a) }
  granuloParLot.value = by
}
const granuloLots = computed(() => {
  const by = granuloParLot.value; const seen = new Set(); const out = []
  for (const l of lots.value) { const ln = (l.numero_lot || '').trim(); if (ln && by[ln] && !seen.has(ln)) { seen.add(ln); out.push(by[ln]) } }
  return out
})
function granuloSvgString(c) {
  if (!c || !c.ok) return '<p style="color:#94a3b8;font-size:11px">Pas de données granulométriques enregistrées.</p>'
  let s = '<svg viewBox="0 0 ' + GCW + ' ' + GCH + '" width="100%" style="max-width:520px;border:1px solid #eef2f6;border-radius:6px" xmlns="http://www.w3.org/2000/svg">'
  for (const q of [0, 25, 50, 75, 100]) { const y = gY(q); s += '<line x1="' + GML + '" x2="' + (GCW - GMR) + '" y1="' + y + '" y2="' + y + '" stroke="#eef2f6"/><text x="' + (GML - 5) + '" y="' + (y + 3) + '" font-size="9" fill="#94a3b8" text-anchor="end">' + q + '</text>' }
  for (const b of c.bars) s += '<rect x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '" fill="#f59e0b"/>'
  s += '<polyline points="' + c.poly + '" fill="none" stroke="#0891b2" stroke-width="2"/>'
  s += '<polyline points="' + c.polyRefus + '" fill="none" stroke="#c2410c" stroke-width="2" stroke-dasharray="5 3"/>'
  for (const b of c.bars) s += '<text x="' + (b.x + b.w / 2) + '" y="' + (GCH - GMB + 12) + '" font-size="8" fill="#64748b" text-anchor="middle">' + b.label + '</text>'
  return s + '</svg>'
}

const PHASES_LISTE = ['Pesée', 'Granulation et Séchage', 'Mélange', 'Compression', 'Remplissage Gélules', 'Pelliculage', 'Contrôle Qualité']
const PHASES_PROD = ['Pesée', 'Granulation et Séchage', 'Mélange', 'Compression', 'Remplissage Gélules', 'Pelliculage']

async function charger() {
  const r = await supabase.from('pqr_parametres').select('*').eq('actif', true).order('ordre')
  if (!r.error) params.value = r.data || []
  const rp = await supabase.from('produits').select('id, code_pf, designation, gamme').order('code_pf')
  if (!rp.error) produits.value = rp.data || []
}
onMounted(charger)

const normR = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const produitsFiltres = computed(() => { const q = normR(recherche.value).trim(); if (!q) return produits.value; return produits.value.filter(pr => normR((pr.code_pf || '') + ' ' + (pr.designation || '')).includes(q)) })
const phaseIndex = (ph) => { const i = PHASES_LISTE.indexOf(ph); return i < 0 ? 999 : i }
function normPhaseG(ph) { return /^(granulation|s[ée]chage)$/i.test(String(ph).trim()) ? 'Granulation et Séchage' : ph }
function normGammeFab(g) { if (!Array.isArray(g) || !g.length) return PHASES_PROD.slice(); const out = []; for (const ph of g) { const n = normPhaseG(ph); if (PHASES_PROD.includes(n) && !out.includes(n)) out.push(n) } return out.length ? out : PHASES_PROD.slice() }
const gammeProduit = computed(() => { if (!produitSel.value) return null; const pr = produits.value.find(x => String(x.id) === produitSel.value); if (!pr) return null; const ph = normGammeFab(pr.gamme); ph.push('Contrôle Qualité'); return ph })
const paramsProduit = computed(() => { const g = gammeProduit.value; if (!g) return []; return params.value.filter(p => g.includes(p.phase)) })
const phasesAffichees = computed(() => [...new Set(paramsProduit.value.map(p => p.phase))].sort((a, b) => phaseIndex(a) - phaseIndex(b)))
function paramsDe(ph) { return paramsProduit.value.filter(p => p.phase === ph).sort((a, b) => (a.ordre || 0) - (b.ordre || 0) || a.id - b.id) }

const fmt = (v) => (v === null || v === undefined || v === '') ? '—' : v
const effMin = (p) => { const s = specs.value[p.id]; return s && s.min != null && s.min !== '' ? s.min : p.limite_min }
const effCible = (p) => { const s = specs.value[p.id]; return s && s.cible != null && s.cible !== '' ? s.cible : p.cible }
const effMax = (p) => { const s = specs.value[p.id]; return s && s.max != null && s.max !== '' ? s.max : p.limite_max }
const effUnite = (p) => { const s = specs.value[p.id]; return s && s.unite ? s.unite : p.unite }

const lotsConformes = computed(() => lots.value.filter(l => l.statut === 'conforme').length)
function statutLabel(s) { return ({ brouillon: 'Brouillon', en_cours: 'En cours', valide: 'Validé', cloture: 'Clôturé' })[s] || s }
const tableAbsente = (m) => /relation|does not exist|schema cache|could not find the table/i.test(m || '')

watch(produitSel, async (pid) => {
  erreur.value = ''; message.value = ''
  Object.assign(protocole, protocoleVide()); lots.value = []; specs.value = {}; mesuresParLot.value = {}; expanded.value = {}; granuloParLot.value = {}
  if (!pid) return
  const rs = await supabase.from('pqr_specs_produit').select('*').eq('produit_id', Number(pid))
  if (!rs.error) { const by = {}; for (const sp of (rs.data || [])) by[sp.parametre_id] = { min: sp.limite_min, cible: sp.cible, max: sp.limite_max, unite: sp.unite }; specs.value = by }
  const rp = await supabase.from('pqr_validation_protocoles').select('*').eq('produit_id', Number(pid)).eq('actif', true).limit(1)
  if (rp.error) { erreur.value = tableAbsente(rp.error.message) ? 'Tables de validation absentes — exécute la migration 007_pqr_validation.sql dans Supabase.' : rp.error.message; return }
  const proto = (rp.data || [])[0]
  if (proto) {
    Object.assign(protocole, { id: proto.id, reference: proto.reference || '', approche: proto.approche || '', nature: proto.nature || '', nb_lots: proto.nb_lots || 3, portee: proto.portee || '', criteres: proto.criteres || '', responsable: proto.responsable || '', statut: proto.statut || 'brouillon', date_protocole: proto.date_protocole || '', conclusion: proto.conclusion || '' })
    const rl = await supabase.from('pqr_validation_lots').select('*').eq('protocole_id', proto.id).order('ordre')
    if (!rl.error) lots.value = (rl.data || []).map(l => ({ _k: lotSeq++, id: l.id, numero_lot: l.numero_lot || '', taille_lot: l.taille_lot, date_fabrication: l.date_fabrication || '', statut: l.statut || 'prevu', ecarts: l.ecarts || '' }))
    await verifierConformite(true)
  }
})

function payloadProto(pid) { return { produit_id: pid, reference: protocole.reference || null, approche: protocole.approche || null, nature: protocole.nature || null, nb_lots: Number(protocole.nb_lots) || 3, portee: protocole.portee || null, criteres: protocole.criteres || null, responsable: protocole.responsable || null, statut: protocole.statut || 'brouillon', date_protocole: protocole.date_protocole || null, conclusion: protocole.conclusion || null } }

async function enregistrerProtocole() {
  erreur.value = ''; message.value = ''
  const pid = Number(produitSel.value); if (!pid) return
  const payload = payloadProto(pid)
  let r
  if (protocole.id) r = await supabase.from('pqr_validation_protocoles').update(payload).eq('id', protocole.id).select('id').single()
  else r = await supabase.from('pqr_validation_protocoles').insert(payload).select('id').single()
  if (r.error) { erreur.value = tableAbsente(r.error.message) ? 'Tables de validation absentes — exécute la migration 007_pqr_validation.sql dans Supabase.' : r.error.message; return }
  if (r.data) protocole.id = r.data.id
  message.value = 'Protocole enregistré.'
}

function ajouterLot() { lots.value.push({ _k: lotSeq++, id: null, numero_lot: '', taille_lot: null, date_fabrication: '', statut: 'prevu', ecarts: '' }) }
function ajouterLotsObjectif() { let g = 0; while (lots.value.length < (Number(protocole.nb_lots) || 3) && g++ < 60) ajouterLot() }
function retirerLot(i) { lots.value.splice(i, 1) }

async function enregistrerLots() {
  erreur.value = ''; message.value = ''
  if (!protocole.id) { erreur.value = 'Crée d\'abord le protocole.'; return }
  const del = await supabase.from('pqr_validation_lots').delete().eq('protocole_id', protocole.id)
  if (del.error) { erreur.value = del.error.message; return }
  const rows = lots.value.map((l, i) => ({ protocole_id: protocole.id, numero_lot: l.numero_lot || null, taille_lot: (l.taille_lot === '' || l.taille_lot == null) ? null : Number(l.taille_lot), date_fabrication: l.date_fabrication || null, statut: l.statut || 'prevu', ecarts: l.ecarts || null, ordre: i }))
  if (rows.length) { const ins = await supabase.from('pqr_validation_lots').insert(rows); if (ins.error) { erreur.value = ins.error.message; return } }
  message.value = 'Lots de validation enregistrés.'
}

// ---- Conformité calculée depuis les mesures réelles (pqr_mesures, par N° de lot) ----
async function verifierConformite(silent) {
  if (!silent) { erreur.value = ''; message.value = '' }
  const nums = [...new Set(lots.value.map(l => (l.numero_lot || '').trim()).filter(Boolean))]
  if (!nums.length) { mesuresParLot.value = {}; granuloParLot.value = {}; if (!silent) message.value = 'Aucun N° de lot renseigné dans les lots de validation.'; return }
  const r = await supabase.from('pqr_mesures').select('numero_lot, parametre_id, valeurs, valeur').in('numero_lot', nums)
  if (r.error) { if (!silent) erreur.value = r.error.message; return }
  const by = {}
  for (const m of (r.data || [])) { const ln = (m.numero_lot || '').trim(); if (!by[ln]) by[ln] = {}; if (!by[ln][m.parametre_id]) by[ln][m.parametre_id] = []; by[ln][m.parametre_id].push(m) }
  mesuresParLot.value = by
  await chargerGranulo()
  let nApp = 0
  for (const l of lots.value) { const r = verdictLot(l); if (r.v) { l.statut = r.v; nApp++ } }   // statut forcé automatiquement depuis les mesures
  if (!silent) { const nAvec = nums.filter(n => by[n]).length; message.value = 'Conformité calculée : mesures pour ' + nAvec + '/' + nums.length + ' lot(s) · ' + nApp + ' statut(s) mis à jour.' }
}
function mesuresDe(lot) { return mesuresParLot.value[(lot.numero_lot || '').trim()] || null }
function paramVals(rows) { if (!rows) return []; let out = []; for (const r of rows) { const v = (Array.isArray(r.valeurs) && r.valeurs.length) ? r.valeurs : (r.valeur != null ? [r.valeur] : []); out = out.concat(v) } return out.map(Number).filter(x => !isNaN(x)) }
function paramConforme(p, rows) { const vals = paramVals(rows); if (!vals.length) return null; const mn = effMin(p), mx = effMax(p); const lo = (mn === '' || mn == null) ? -Infinity : Number(mn); const hi = (mx === '' || mx == null) ? Infinity : Number(mx); if (lo === -Infinity && hi === Infinity) return null; return vals.every(v => v >= lo && v <= hi) }
function verdictLot(lot) {
  const mp = mesuresDe(lot); if (!mp) return { v: null, detail: '' }
  const nums = paramsProduit.value.filter(p => p.type !== 'bool')
  let nbMes = 0, nbHors = 0; const hors = []
  for (const p of nums) { const c = paramConforme(p, mp[p.id]); if (c === null) continue; nbMes++; if (!c) { nbHors++; hors.push(p.nom) } }
  if (nbMes === 0) return { v: null, detail: '' }
  let v = 'en_cours'
  if (nbHors > 0) v = 'non_conforme'; else if (nbMes >= nums.length) v = 'conforme'
  const detail = nbHors ? ('Hors spec : ' + hors.join(', ')) : (v === 'conforme' ? 'Tous les paramètres mesurés sont conformes' : (nbMes + '/' + nums.length + ' paramètres mesurés (conformes)'))
  return { v, nbMes, nbHors, total: nums.length, detail }
}
function verdictTxt(r) { return r.v === 'conforme' ? '✓ Conforme' : r.v === 'non_conforme' ? '✗ ' + r.nbHors + ' hors spec' : r.v === 'en_cours' ? (r.nbMes + '/' + r.total + ' mesurés') : '—' }
function toggleDetail(lot) { expanded.value = { ...expanded.value, [lot._k]: !expanded.value[lot._k] } }
function detailLot(lot) {
  const mp = mesuresDe(lot); if (!mp) return []
  const out = []
  for (const p of paramsProduit.value) {
    if (p.type === 'bool') continue
    const rows = mp[p.id]; const vals = paramVals(rows); if (!vals.length) continue
    out.push({ id: p.id, nom: p.nom, phase: p.phase, vals, min: effMin(p), max: effMax(p), unite: effUnite(p), conforme: paramConforme(p, rows) })
  }
  return out
}

// ---- Export PDF (impression navigateur) ----
function frDate(d) { if (!d) return '—'; const x = new Date(d); return isNaN(x) ? d : x.toLocaleDateString('fr-FR') }
function statutLotLabel(s) { return ({ prevu: 'Prévu', en_cours: 'En cours', conforme: 'Conforme', non_conforme: 'Non conforme' })[s] || s }
function exporterPDF() {
  erreur.value = ''
  const pr = produits.value.find(x => String(x.id) === produitSel.value) || {}
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const approcheL = { prospective: 'Prospective', concurrente: 'Concurrente', retrospective: 'Rétrospective' }[protocole.approche] || '—'
  const natureL = { initiale: 'Validation initiale', revalidation: 'Revalidation', transfert: 'Transfert' }[protocole.nature] || '—'
  let paramHtml = ''
  for (const ph of phasesAffichees.value) {
    const rows = paramsDe(ph).map(p => {
      const u = p.type === 'bool' ? '—' : (effUnite(p) || '—')
      const mn = p.type === 'bool' ? '—' : fmt(effMin(p)), cb = p.type === 'bool' ? (p.etat_attendu ? 'Attendu ' + p.etat_attendu : 'ON/OFF') : fmt(effCible(p)), mx = p.type === 'bool' ? '—' : fmt(effMax(p))
      return `<tr><td>${esc(p.nom)}</td><td>${esc(u)}</td><td class="r">${esc(mn)}</td><td class="r">${esc(cb)}</td><td class="r">${esc(mx)}</td></tr>`
    }).join('')
    paramHtml += `<tr class="ph"><td colspan="5">${esc(ph)}</td></tr>` + rows
  }
  const lotsHtml = lots.value.map((l, i) => {
    const v = verdictLot(l); const vtxt = v.v === 'conforme' ? 'Conforme' : v.v === 'non_conforme' ? ('Non conforme (' + v.nbHors + ' hors spec)') : v.v === 'en_cours' ? 'Mesures partielles' : '—'
    return `<tr><td>${i + 1}</td><td>${esc(l.numero_lot)}</td><td class="r">${(l.taille_lot != null && l.taille_lot !== '') ? esc(l.taille_lot) : '—'}</td><td>${esc(frDate(l.date_fabrication))}</td><td>${esc(statutLotLabel(l.statut))}</td><td>${esc(vtxt)}</td><td>${esc(l.ecarts)}</td></tr>`
  }).join('')
  let annexeHtml = ''
  for (const g of granuloLots.value) {
    annexeHtml += `<h3 class="ann-lot">Lot ${esc(g.numero_lot)}${g.libelle ? ' — ' + esc(g.libelle) : ''} <span class="ann-date">${esc(frDate(g.date_analyse))}</span></h3>`
      + granuloSvgString(g.chart)
      + `<table class="ann-kpi"><tbody><tr><td><b>D10</b> ${dMic(g.d10)}</td><td><b>D50</b> ${dMic(g.d50)}</td><td><b>D90</b> ${dMic(g.d90)}</td><td><b>Span</b> ${g.span != null ? g.span.toFixed(2) : '—'}</td></tr>`
      + `<tr><td><b>Densité app.</b> ${g.densApp != null ? g.densApp.toFixed(3) + ' g/mL' : '—'}</td><td><b>Densité tassée</b> ${g.densTass != null ? g.densTass.toFixed(3) + ' g/mL' : '—'}</td><td><b>Hausner</b> ${g.hausner != null ? g.hausner.toFixed(3) : '—'}</td><td><b>Carr</b> ${g.carr != null ? g.carr.toFixed(1) + ' %' : '—'}</td></tr>`
      + `<tr><td colspan="4"><b>Écoulement</b> ${esc(g.flow.t)}</td></tr></tbody></table>`
  }
  const annexeSection = granuloLots.value.length ? `<h2>Annexe — Résultats granulométrie &amp; densité</h2>${annexeHtml}` : ''
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Protocole de validation — ${esc(pr.code_pf || '')}</title>
<style>*{box-sizing:border-box}body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1b2733;margin:28px;font-size:12px}
h1{font-size:18px;margin:0 0 2px}h2{font-size:13px;color:#7c3aed;border-bottom:2px solid #eee;padding-bottom:4px;margin:20px 0 8px}
.sub{color:#64748b;margin:0 0 16px}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:2px 24px;margin-bottom:8px}.meta div{padding:3px 0;border-bottom:1px solid #f1f5f9}.meta b{color:#475569;display:inline-block;min-width:130px}
table{width:100%;border-collapse:collapse;margin-bottom:8px}th,td{text-align:left;padding:5px 8px;border-bottom:1px solid #eef2f6}th{background:#faf5ff;color:#6b21a8;font-size:10px;text-transform:uppercase}
td.r,th.r{text-align:right}tr.ph td{background:#f1f5f9;font-weight:700;text-transform:uppercase;font-size:10px;color:#475569}
.box{border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;margin-bottom:8px;white-space:pre-wrap;min-height:22px}
.sign{display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;margin-top:40px}.sign div{border-top:1px solid #94a3b8;padding-top:4px;font-size:11px;color:#64748b}
.ann-lot{font-size:12px;color:#0f172a;margin:16px 0 4px;font-weight:700;page-break-after:avoid}.ann-date{color:#94a3b8;font-weight:400;font-size:10px}
.ann-kpi{width:auto;margin:4px 0 12px;page-break-inside:avoid}.ann-kpi td{border:0;padding:2px 16px 2px 0;font-size:11px;white-space:nowrap}.ann-kpi b{color:#475569}
@media print{body{margin:12mm}}</style></head><body>
${LOGO_HTML}
<h1>Protocole de validation de procédé</h1>
<p class="sub">${esc(pr.code_pf || '')} — ${esc(pr.designation || '')}</p>
<div class="meta">
<div><b>Référence</b> ${esc(protocole.reference || '—')}</div><div><b>Statut</b> ${esc(statutLabel(protocole.statut))}</div>
<div><b>Approche</b> ${esc(approcheL)}</div><div><b>Nature</b> ${esc(natureL)}</div>
<div><b>Nombre de lots</b> ${esc(protocole.nb_lots)}</div><div><b>Date protocole</b> ${esc(frDate(protocole.date_protocole))}</div>
<div><b>Responsable</b> ${esc(protocole.responsable || '—')}</div></div>
<h2>Portée / objectif</h2><div class="box">${esc(protocole.portee || '—')}</div>
<h2>Critères d'acceptation</h2><div class="box">${esc(protocole.criteres || '—')}</div>
<h2>Paramètres critiques à valider</h2>
<table><thead><tr><th>Paramètre</th><th>Unité</th><th class="r">Min</th><th class="r">Cible</th><th class="r">Max</th></tr></thead><tbody>${paramHtml || '<tr><td colspan="5">Aucun paramètre.</td></tr>'}</tbody></table>
<h2>Lots de validation</h2>
<table><thead><tr><th>#</th><th>N° lot</th><th class="r">Taille</th><th>Date fab.</th><th>Statut</th><th>Conformité (mesures)</th><th>Écarts</th></tr></thead><tbody>${lotsHtml || '<tr><td colspan="7">Aucun lot.</td></tr>'}</tbody></table>
<h2>Conclusion</h2><div class="box">${esc(protocole.conclusion || '—')}</div>
${annexeSection}
<div class="sign"><div>Rédigé par</div><div>Vérifié par</div><div>Approuvé par</div></div>
</body></html>`
  const w = window.open('', '_blank')
  if (!w) { erreur.value = 'Autorise les pop-ups pour générer le PDF, puis réessaie.'; return }
  w.document.write(html); w.document.close(); w.focus(); setTimeout(() => { try { w.print() } catch (e) {} }, 350)
}
</script>

<style scoped>
.pqr-page { color: #1b2733; zoom: 0.85; }
.alert { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 10px 14px; border-radius: 8px; margin: 0 0 14px; }
.ok { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 10px 14px; border-radius: 8px; margin: 0 0 14px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 22px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
.card-title { margin: 0; font-size: 17px; }
.count { background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 700; padding: 2px 9px; border-radius: 999px; }
.badge-en_cours { background: #fef9c3; color: #854d0e; }
.badge-valide { background: #dcfce7; color: #166534; }
.badge-cloture { background: #e0e7ff; color: #3730a3; }
.prod-sel { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; color: #1b2733; font-weight: 600; max-width: 340px; }
.pqr-search { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; color: #1b2733; width: 220px; }
.pqr-search:focus { outline: none; border-color: #a855f7; box-shadow: 0 0 0 3px rgba(168,85,247,.15); }
.btn { background: #0f766e; color: #fff; border: 0; padding: 9px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.btn.ghost { background: #fff; color: #475569; border: 1px solid #cbd5e1; }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.empty-card { background: #fff; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 24px; color: #475569; text-align: center; font-size: 14px; }
.pqr-note { background: #faf5ff; border: 1px solid #e9d5ff; color: #6b21a8; padding: 9px 13px; border-radius: 8px; font-size: 13px; margin: 10px 0 0; }

.pv-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px 14px; }
.pv-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; margin-top: 12px; }
.pv-f { display: flex; flex-direction: column; gap: 4px; }
.pv-f > span { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .03em; }
.pv-f input, .pv-f select, .pv-f textarea { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; color: #1b2733; }
.pv-f textarea { resize: vertical; }
.pv-f input:focus, .pv-f select:focus, .pv-f textarea:focus { outline: none; border-color: #a855f7; box-shadow: 0 0 0 3px rgba(168,85,247,.15); }
.pv-sm { max-width: 130px; }
.pv-save { margin-top: 14px; }
@media (max-width: 720px) { .pv-grid2 { grid-template-columns: 1fr; } }

.pv-sect { margin: 26px 0 8px; font-size: 14px; font-weight: 800; color: #0f172a; border-bottom: 2px solid #eef2f6; padding-bottom: 6px; }
.pv-sect-sub { font-size: 11.5px; font-weight: 500; color: #94a3b8; text-transform: none; letter-spacing: 0; margin-left: 4px; }

.pqr-phase { margin-top: 14px; }
.pqr-phase-titre { margin: 0 0 6px; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: #a855f7; border-left: 3px solid #a855f7; padding-left: 8px; }
.pqr-tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.pqr-tbl th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; font-weight: 700; padding: 6px 10px; border-bottom: 2px solid #eef2f6; }
.pqr-tbl th.r { text-align: right; }
.pqr-tbl td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; }
.pqr-tbl td.r { text-align: right; font-variant-numeric: tabular-nums; }
.pqr-tbl td.nom { font-weight: 700; color: #0f172a; }
.pqr-tbl td.cible { color: #a855f7; font-weight: 700; }
.pqr-tbl td.act { text-align: right; white-space: nowrap; }
.pqr-tbl td.act button { border: 1px solid #e2e8f0; background: #fff; border-radius: 6px; padding: 3px 7px; cursor: pointer; font-size: 12px; }
.tag-api { font-size: 9px; font-weight: 800; background: #faf5ff; color: #7c3aed; padding: 1px 6px; border-radius: 999px; vertical-align: middle; margin-left: 4px; }

.pv-tbl-wrap { overflow-x: auto; }
.pv-lots td { vertical-align: middle; }
.pv-in { padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 7px; font: inherit; font-size: 13px; background: #fff; color: #0f172a; width: 100%; box-sizing: border-box; }
.pv-in:focus { outline: none; border-color: #a855f7; box-shadow: 0 0 0 3px rgba(168,85,247,.15); }
.pv-in-n { text-align: right; font-variant-numeric: tabular-nums; max-width: 110px; }
.pv-in-w { min-width: 220px; }
.pv-st { font-weight: 700; }
.pv-st.st-conforme { color: #166534; }
.pv-st.st-non_conforme { color: #b91c1c; }
.pv-st.st-en_cours { color: #854d0e; }
.pv-st.st-prevu { color: #64748b; }
.pv-empty { text-align: center; color: #94a3b8; padding: 18px; }
.pv-top-actions { display: flex; justify-content: flex-end; margin-bottom: 10px; }
.pv-verdict { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
.pv-verdict.v-conforme { background: #dcfce7; color: #166534; }
.pv-verdict.v-non_conforme { background: #fee2e2; color: #b91c1c; }
.pv-verdict.v-en_cours { background: #fef9c3; color: #854d0e; }
.pv-verdict.v-none { background: #f1f5f9; color: #94a3b8; }
.pv-verdict.clickable { cursor: pointer; }
.pv-verdict.clickable:hover { filter: brightness(.96); }
.pv-chev { margin-left: 4px; font-size: 9px; opacity: .7; }
.pv-auto-note { font-size: 11.5px; color: #94a3b8; align-self: center; }
.pv-detail-row td { background: #faf5ff; padding: 10px 14px; }
.pv-det-empty { font-size: 12px; color: #94a3b8; }
.pv-det-tbl { width: 100%; border-collapse: collapse; font-size: 12px; background: #fff; border: 1px solid #eef2f6; border-radius: 8px; overflow: hidden; }
.pv-det-tbl th { background: #fff; color: #94a3b8; font-size: 10px; text-transform: uppercase; letter-spacing: .03em; font-weight: 700; padding: 5px 9px; border-bottom: 1px solid #eef2f6; text-align: left; }
.pv-det-tbl td { padding: 5px 9px; border-bottom: 1px solid #f4f1fa; }
.pv-det-tbl tr:last-child td { border-bottom: 0; }
.pv-det-tbl tr.det-hors td { background: #fff5f5; }
.det-nom { font-weight: 700; color: #0f172a; }
.det-ph { color: #94a3b8; font-size: 11px; }
.det-u { color: #94a3b8; font-size: 11px; }
.det-v { font-weight: 700; font-size: 11px; padding: 1px 7px; border-radius: 999px; }
.det-v.ok { background: #dcfce7; color: #166534; }
.det-v.nok { background: #fee2e2; color: #b91c1c; }
.det-v.na { background: #f1f5f9; color: #94a3b8; }
.pv-lots-actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.pv-concl { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; color: #1b2733; resize: vertical; }
.pv-concl:focus { outline: none; border-color: #a855f7; box-shadow: 0 0 0 3px rgba(168,85,247,.15); }

/* Annexe granulométrie & densité */
.pv-annex { border: 1px solid #e9d5ff; border-radius: 10px; padding: 14px; margin-top: 12px; background: #fdfaff; }
.pv-annex-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 10px; }
.pv-annex-lot { font-size: 14px; font-weight: 800; color: #6b21a8; }
.pv-annex-lib { font-size: 12px; color: #7c3aed; }
.pv-annex-date { font-size: 11.5px; color: #94a3b8; margin-left: auto; }
.pv-annex-body { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 18px; align-items: start; }
@media (max-width: 860px) { .pv-annex-body { grid-template-columns: 1fr; } }
.pv-svg { width: 100%; height: auto; background: #fff; border: 1px solid #eef2f6; border-radius: 8px; }
.pv-gl { stroke: #eef2f6; stroke-width: 1; }
.pv-axl { font-size: 9px; fill: #94a3b8; text-anchor: end; }
.pv-xlab { font-size: 8px; fill: #64748b; text-anchor: middle; }
.pv-bar { fill: #f59e0b; opacity: .9; }
.pv-line-pass { fill: none; stroke: #0891b2; stroke-width: 2; }
.pv-line-refus { fill: none; stroke: #c2410c; stroke-width: 2; stroke-dasharray: 5 3; }
.pv-annex-leg { font-size: 11px; color: #64748b; margin-top: 6px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.pv-annex-leg .lg { display: inline-block; width: 14px; height: 10px; border-radius: 2px; }
.pv-annex-leg .lg-bar { background: #f59e0b; }
.pv-annex-leg .lg-pass { width: 16px; height: 0; border-top: 2px solid #0891b2; border-radius: 0; }
.pv-annex-leg .lg-refus { width: 16px; height: 0; border-top: 2px dashed #c2410c; border-radius: 0; }
.pv-annex-kpis { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.pv-kpi { background: #fff; border: 1px solid #eef2f6; border-radius: 8px; padding: 8px 10px; }
.pv-kpi span { display: block; font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; }
.pv-kpi b { font-size: 16px; color: #0f172a; font-variant-numeric: tabular-nums; }
.pv-kpi b em { font-size: 10px; color: #94a3b8; font-style: normal; font-weight: 500; margin-left: 3px; }
.pv-kpi-flow b { font-size: 14px; }
</style>
