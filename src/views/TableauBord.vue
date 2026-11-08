<template>
  <div class="tb">
    <header class="tb-head">
      <div>
        <h1 class="tb-title">Tableau de bord</h1>
        <p class="tb-sub">Production par catégorie et par lot — boîtes & chiffre d'affaires</p>
      </div>
      <div class="tb-year">
        <label>Année</label>
        <select v-model.number="annee">
          <option v-for="a in annees" :key="a" :value="a">{{ a }}</option>
        </select>
      </div>
    </header>

    <!-- Onglets Fabrication / Conditionnement -->
    <div class="tb-tabs">
      <button type="button" :class="{ on: onglet === 'fab' }" class="tb-tab fab" @click="onglet = 'fab'">Fabrication</button>
      <button type="button" :class="{ on: onglet === 'cond' }" class="tb-tab cond" @click="onglet = 'cond'">Conditionnement</button>
    </div>

    <!-- Vue globale — scorecard KPI -->
    <div class="sc-grid">
      <div class="sc teal">
        <div class="sc-l">{{ onglet === 'fab' ? 'Fabriqué' : 'Conditionné' }} <span class="sc-u">boîtes</span></div>
        <div class="sc-v">{{ fmt(totBoites) }}</div>
        <svg viewBox="0 0 100 26" class="sc-spark" preserveAspectRatio="none"><path :d="sparkArea(serieReal)" class="sp-area teal" /><path :d="sparkPath(serieReal)" class="sp-line teal" /></svg>
        <div class="sc-s">ce mois <b>{{ fmt(totBoitesMois) }}</b></div>
      </div>
      <div class="sc teal">
        <div class="sc-l">Taux de réalisation</div>
        <div class="sc-rw">
          <svg viewBox="0 0 36 36" class="sc-ring"><circle class="rg-bg" cx="18" cy="18" r="15.915" /><circle class="rg-fg" cx="18" cy="18" r="15.915" :stroke="colPct(tauxGlobal, 100)" :stroke-dasharray="ringDash(tauxGlobal)" stroke-dashoffset="25" /><text x="18" y="21" class="rg-v" :style="{ fill: colPct(tauxGlobal, 100) }">{{ tauxGlobal != null ? tauxGlobal + '%' : '—' }}</text></svg>
          <div class="sc-s">plan <b>{{ totPlan ? fmt(totPlan) : '—' }}</b><br>ce mois <b>{{ tauxGlobalMois != null ? tauxGlobalMois + '%' : '—' }}</b></div>
        </div>
      </div>
      <div class="sc teal">
        <div class="sc-l">Chiffre d'affaires <span class="sc-u">DA</span></div>
        <div class="sc-v sc-v-ca">{{ fmtCA(totCA) }}</div>
        <svg viewBox="0 0 100 26" class="sc-spark" preserveAspectRatio="none"><path :d="sparkArea(serieCA)" class="sp-area sky" /><path :d="sparkPath(serieCA)" class="sp-line sky" /></svg>
        <div class="sc-s">ce mois <b>{{ fmtCA(totCAMois) }}</b></div>
      </div>
      <div class="sc teal">
        <div class="sc-l">Lots {{ onglet === 'fab' ? 'fabriqués' : 'conditionnés' }}</div>
        <div class="sc-v">{{ fmt(nbLots) }}</div>
        <div class="sc-s">répartis sur {{ donnees.length }} {{ libGroupe ? libGroupe.toLowerCase() + '(s)' : 'catégorie(s)' }}</div>
      </div>
      <div class="sc teal">
        <div class="sc-l">Rendement fabrication</div>
        <div class="sc-rw">
          <svg viewBox="0 0 36 36" class="sc-ring"><circle class="rg-bg" cx="18" cy="18" r="15.915" /><circle class="rg-fg" cx="18" cy="18" r="15.915" :stroke="colPct(rendementFab, 90)" :stroke-dasharray="ringDash(rendementFab)" stroke-dashoffset="25" /><text x="18" y="21" class="rg-v" :style="{ fill: colPct(rendementFab, 90) }">{{ rendementFab != null ? rendementFab + '%' : '—' }}</text></svg>
          <div class="sc-s">boîtes / quantité<br>théorique</div>
        </div>
      </div>
      <div class="sc sky">
        <div class="sc-l">Disponibilité équip.</div>
        <div class="sc-rw">
          <svg viewBox="0 0 36 36" class="sc-ring"><circle class="rg-bg" cx="18" cy="18" r="15.915" /><circle class="rg-fg" cx="18" cy="18" r="15.915" :stroke="colPct(equipKpi.dispo, 85)" :stroke-dasharray="ringDash(equipKpi.dispo)" stroke-dashoffset="25" /><text x="18" y="21" class="rg-v" :style="{ fill: colPct(equipKpi.dispo, 85) }">{{ equipKpi.dispo != null ? equipKpi.dispo + '%' : '—' }}</text></svg>
          <div class="sc-s">MTBF <b>{{ fmtH(equipKpi.mtbf) }}</b><br>MTTR <b>{{ fmtH(equipKpi.mttr) }}</b></div>
        </div>
      </div>
      <div class="sc amber">
        <div class="sc-l">Qualification personnel</div>
        <div class="sc-rw">
          <svg viewBox="0 0 36 36" class="sc-ring"><circle class="rg-bg" cx="18" cy="18" r="15.915" /><circle class="rg-fg" cx="18" cy="18" r="15.915" :stroke="colPct(formationKpi.taux, 90)" :stroke-dasharray="ringDash(formationKpi.taux)" stroke-dashoffset="25" /><text x="18" y="21" class="rg-v" :style="{ fill: colPct(formationKpi.taux, 90) }">{{ formationKpi.taux != null ? formationKpi.taux + '%' : '—' }}</text></svg>
          <div class="sc-s"><b :class="formationKpi.expire ? 'c-bad' : ''">{{ formationKpi.expire }}</b> expirées<br><b :class="formationKpi.bientot ? 'c-warn' : ''">{{ formationKpi.bientot }}</b> à recycler</div>
        </div>
      </div>
      <div class="sc violet">
        <div class="sc-l">Qualité</div>
        <div class="sc-v" :class="devOuvertes ? 'c-warn' : 'c-ok'">{{ devOuvertes }}</div>
        <div class="sc-s">déviations ouvertes<br><b :class="devCritiques ? 'c-bad' : ''">{{ devCritiques }}</b> critiques · <b :class="capaRetard ? 'c-bad' : ''">{{ capaRetard }}</b> CAPA en retard</div>
      </div>
    </div>

    <!-- Décisions -->
    <div v-if="alertes.length" class="decisions">
      <div class="dec-h">⚠ Points d'attention — aide à la décision</div>
      <div class="dec-list">
        <div v-for="(al, i) in alertes" :key="'a' + i" class="dec-item" :class="al.lvl">
          <span class="dec-t">{{ al.t }}</span><span class="dec-d">{{ al.d }}</span>
        </div>
      </div>
    </div>

    <!-- Pilotage — graphiques de suivi d'activité -->
    <section class="pilot">
      <div class="pilot-grid">
        <div class="pilot-card">
          <div class="pilot-h">
            <span class="pilot-t">Plan vs {{ onglet === 'fab' ? 'Fabriqué' : 'Conditionné' }} par mois — {{ annee }} <span class="pilot-u">(boîtes)</span></span>
            <span class="pilot-leg"><i class="lg b-plan"></i>Plan<i class="lg b-real"></i>Réalisé</span>
          </div>
          <svg :viewBox="'0 0 ' + graphPR.W + ' ' + graphPR.H" class="pilot-svg" preserveAspectRatio="none">
            <line v-for="(g, i) in graphPR.grid" :key="'g' + i" :x1="graphPR.mL" :x2="graphPR.mL + graphPR.iw" :y1="g.y" :y2="g.y" class="grid" />
            <rect v-for="(b, i) in graphPR.bars" :key="'b' + i" :x="b.x" :y="b.y" :width="b.w" :height="b.h" :class="b.cls" rx="2"><title>{{ fmt(b.v) }}</title></rect>
            <text v-for="(l, i) in graphPR.labels" :key="'l' + i" :x="l.x" :y="l.y" class="x-lbl">{{ l.t }}</text>
          </svg>
        </div>
        <div class="pilot-card">
          <div class="pilot-h"><span class="pilot-t">Top {{ libGroupe }} <span class="pilot-u">(boîtes, {{ annee }})</span></span></div>
          <div class="top-list">
            <div v-for="(d, i) in graphTop" :key="'t' + i" class="top-row">
              <span class="top-nom" :title="d.nom">{{ d.nom }}</span>
              <span class="top-bar"><span class="top-in" :style="{ width: d.pct + '%' }"></span></span>
              <span class="top-val">{{ fmt(d.boites) }}<span v-if="d.taux != null" class="top-taux" :class="d.taux >= 100 ? 'ok' : 'bas'">{{ d.taux }}%</span></span>
            </div>
            <div v-if="!graphTop.length" class="tb-empty">Aucune donnée.</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Indicateurs de performance — KPI production standard -->
    <section class="kpi-sec">
      <div class="kpi-head">
        <span class="kpi-titre">Indicateurs de performance — KPI production <span class="kpi-u">{{ annee }}</span></span>
        <span class="kpi-sum">
          <span class="kpi-chip ok">{{ kpiSummary.ok }} sur objectif</span>
          <span class="kpi-chip warn">{{ kpiSummary.warn }} à surveiller</span>
          <span class="kpi-chip bad">{{ kpiSummary.bad }} hors objectif</span>
          <span v-if="kpiSummary.info" class="kpi-chip info">{{ kpiSummary.info }} mesuré</span>
          <span class="kpi-chip na">{{ kpiSummary.na }} n/a</span>
          <button type="button" class="tb-detail-toggle" @click="kpiOuvert = !kpiOuvert">{{ kpiOuvert ? '▾ Réduire' : '▸ Détail' }}</button>
        </span>
      </div>
      <div v-if="kpiOuvert">
        <!-- Jauges : indicateurs évalués (cible + statut) -->
        <div v-if="kpisEval.length" class="kpi-gauges" :style="{ '--gcols': gaugeCols }">
          <div v-for="(k, i) in kpisEval" :key="'g' + i" class="kg-card">
            <svg viewBox="0 0 36 36" class="kg-ring">
              <circle class="kg-track" cx="18" cy="18" r="15.915" />
              <circle class="kg-fill" cx="18" cy="18" r="15.915" :stroke="kpiColor(k.st)" :stroke-dasharray="kpiFill(k) + ' ' + (100 - kpiFill(k))" stroke-dashoffset="25" />
              <text x="18" y="19.6" class="kg-val" :style="{ fill: kpiColor(k.st) }">{{ fmtKpi(k.v, k.u) }}</text>
            </svg>
            <div class="kg-name">{{ k.n }}</div>
            <div class="kg-cible">cible {{ k.c }}</div>
          </div>
        </div>

        <!-- Tuiles : valeurs suivies (mesuré) -->
        <div v-if="kpisMesure.length" class="kpi-tiles" :style="{ '--tcols': tileCols }">
          <div v-for="(k, i) in kpisMesure" :key="'t' + i" class="kt-card" :style="{ '--a': tileIcon(k.n).c }">
            <svg viewBox="0 0 24 24" class="kt-ic" v-html="tileIcon(k.n).p"></svg>
            <div class="kt-txt"><div class="kt-v">{{ fmtKpi(k.v, k.u) }}</div><div class="kt-n">{{ k.n }}</div></div>
          </div>
        </div>

        <div v-if="arretsDecomp && arretsDecomp.items.length" class="arrets-box">
          <div class="arrets-head">
            <span class="arrets-t">Décomposition des arrêts</span>
            <span class="arrets-sub">% du temps d'ouverture · perte totale {{ arretsDecomp.totPct.toFixed(1) }}% → Disponibilité {{ arretsDecomp.dispo.toFixed(1) }}%</span>
          </div>
          <div class="arrets-list">
            <div v-for="(x, i) in arretsDecomp.items" :key="x.k" class="arret-row" :class="{ 'arret-top': i === 0 }">
              <span class="arret-lbl">{{ x.lbl }}</span>
              <span class="arret-bar"><span :style="{ width: Math.min(100, x.pct) + '%' }"></span></span>
              <span class="arret-pct">{{ x.pct.toFixed(1) }}%</span>
              <span class="arret-h">{{ fmt(Math.round(x.min / 60)) }} h</span>
            </div>
          </div>
        </div>

        <button type="button" class="kpi-detail-btn" @click="detailOuvert = !detailOuvert">{{ detailOuvert ? '▾ Masquer le détail' : '▸ Détail & tableau complet (' + kpisStd.length + ')' }}</button>

        <div v-if="detailOuvert">
        <div class="kpi-panels">
          <div class="kpi-panel">
            <div class="kp-t">Répartition des statuts</div>
            <div class="kp-bar">
              <span v-if="kpiSummary.ok" class="seg ok" :style="{ width: pctSeg(kpiSummary.ok) }"></span>
              <span v-if="kpiSummary.warn" class="seg warn" :style="{ width: pctSeg(kpiSummary.warn) }"></span>
              <span v-if="kpiSummary.bad" class="seg bad" :style="{ width: pctSeg(kpiSummary.bad) }"></span>
              <span v-if="kpiSummary.info" class="seg info" :style="{ width: pctSeg(kpiSummary.info) }"></span>
              <span v-if="kpiSummary.na" class="seg na" :style="{ width: pctSeg(kpiSummary.na) }"></span>
            </div>
            <div class="kp-leg"><span><i class="ok"></i>Sur objectif <b>{{ kpiSummary.ok }}</b></span><span><i class="warn"></i>À surveiller <b>{{ kpiSummary.warn }}</b></span><span><i class="bad"></i>Hors objectif <b>{{ kpiSummary.bad }}</b></span><span><i class="info"></i>Mesuré <b>{{ kpiSummary.info }}</b></span><span><i class="na"></i>N/A <b>{{ kpiSummary.na }}</b></span></div>
          </div>
          <div class="kpi-panel">
            <div class="kp-t">À améliorer en priorité</div>
            <div v-for="(k, i) in kpiSummary.top" :key="'kt' + i" class="kp-top"><span class="kp-rank">{{ i + 1 }}</span><span class="kp-name">{{ k.n }}</span><span class="kst" :class="k.st">{{ fmtKpi(k.v, k.u) }}</span></div>
            <div v-if="!kpiSummary.top.length" class="kp-empty">Tous les indicateurs évalués sont sur objectif ✓</div>
          </div>
        </div>
        <div class="kpi-wrap">
          <table class="kpi-tbl">
            <thead><tr><th class="num">#</th><th>Indicateur</th><th>Formule / mesure</th><th class="c">Cible</th><th class="c">Réel</th><th class="c">Statut</th><th>Fréquence</th></tr></thead>
            <tbody>
              <tr v-for="(k, i) in kpisStd" :key="'k' + i" :class="'row-' + k.st">
                <td class="num">{{ i + 1 }}</td>
                <td class="kn"><b>{{ k.n }}</b><span class="kd">{{ k.d }}</span></td>
                <td class="kf">{{ k.f }}</td>
                <td class="c kc">{{ k.c }}</td>
                <td class="c kv">{{ fmtKpi(k.v, k.u) }}</td>
                <td class="c"><span class="kst" :class="k.st">{{ stLabel(k.st) }}</span></td>
                <td class="kfr">{{ k.fr }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="kpi-note">« Mesuré » = indicateur calculé sans cible normative (débit, délai, Takt, cadence, production par équipe/personne). Takt = temps disponible ÷ quantité planifiée du <i>Plan directeur de production</i> (où la demande est représentée) ; Production à temps = lots dont la fin de fabrication est au plus tard à la date de fin de validité de l'OF. Délai = réception OF → fin de fabrication ; Production par équipe / Productivité = boîtes rapportées aux effectifs. Les 20 indicateurs sont désormais reliés à une source : un « N/A » signifie seulement que la donnée n'est pas encore saisie — retouche (Saisie TRS), capacité (jours ouvrés × régime de travail, page Suivi de capacité), coût (PCSU du référentiel produit), équilibrage (flux entre phases, calculé depuis les cadences). OEE, Disponibilité, Performance et Qualité proviennent des postes TRS ; Performance/OEE nécessitent des cadences nominales renseignées.</p>
        </div>
      </div>
    </section>

    <!-- Regroupement -->
    <div class="tb-grp">
      <span class="grp-lbl">Regrouper par :</span>
      <button v-for="g in groupesVisibles" :key="g.k" type="button" :class="{ on: grp === g.k }" @click="grp = g.k">{{ g.lbl }}</button>
      <button type="button" class="tb-detail-toggle" @click="tableOuverte = !tableOuverte">{{ tableOuverte ? '▾ Masquer le détail' : '▸ Afficher le détail' }}</button>
    </div>

    <!-- Tableau -->
    <div v-if="tableOuverte" class="tb-card">
      <div v-if="chargement" class="tb-empty">Chargement…</div>
      <div v-else-if="!donnees.length" class="tb-empty">Aucune donnée de {{ onglet === 'fab' ? 'fabrication' : 'conditionnement' }} pour {{ annee }}.</div>
      <table v-else class="tb-table">
        <thead>
          <tr>
            <th>{{ libGroupe }}</th>
            <th class="num">Plan</th>
            <th class="num">{{ onglet === 'fab' ? 'Fabriqué' : 'Conditionné' }}</th>
            <th class="num">Taux</th>
            <th class="num">Plan (mois)</th>
            <th class="num">Réalisé (mois)</th>
            <th class="num">Taux (mois)</th>
            <th class="num">Lots</th>
            <th class="num">Chiffre d'affaires</th>
            <th class="num">CA (mois)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in donnees" :key="r.cle">
            <td class="g-nom">{{ r.cle }}</td>
            <td class="num">{{ r.plan ? fmt(r.plan) : '—' }}</td>
            <td class="num">{{ fmt(r.boites) }}</td>
            <td class="num"><span v-if="r.taux != null" class="taux" :class="r.taux >= 100 ? 'ok' : 'bas'">{{ r.taux }}%</span><span v-else class="muted">—</span></td>
            <td class="num">{{ r.planMois ? fmt(r.planMois) : '—' }}</td>
            <td class="num">{{ r.boitesMois ? fmt(r.boitesMois) : '—' }}</td>
            <td class="num"><span v-if="r.tauxMois != null" class="taux" :class="r.tauxMois >= 100 ? 'ok' : 'bas'">{{ r.tauxMois }}%</span><span v-else class="muted">—</span></td>
            <td class="num">{{ fmt(r.lots) }}</td>
            <td class="num ca">{{ fmtCA(r.ca) }}</td>
            <td class="num ca">{{ fmtCA(r.caMois) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="tot">
            <td>Total {{ annee }}</td>
            <td class="num">{{ totPlan ? fmt(totPlan) : '—' }}</td>
            <td class="num">{{ fmt(totBoites) }}</td>
            <td class="num">{{ tauxGlobal != null ? tauxGlobal + '%' : '—' }}</td>
            <td class="num">{{ totPlanMois ? fmt(totPlanMois) : '—' }}</td>
            <td class="num">{{ totBoitesMois ? fmt(totBoitesMois) : '—' }}</td>
            <td class="num">{{ tauxGlobalMois != null ? tauxGlobalMois + '%' : '—' }}</td>
            <td class="num">{{ fmt(totLots) }}</td>
            <td class="num ca">{{ fmtCA(totCA) }}</td>
            <td class="num ca">{{ fmtCA(totCAMois) }}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from '../supabase'

const num = (v) => Number(v) || 0
const fmt = (v) => Math.round(num(v)).toLocaleString('fr-FR')
const fmtCA = (v) => v > 0 ? Math.round(num(v)).toLocaleString('fr-FR') + ' DA' : '—'

async function fetchAllPaged(make) {
  const out = []; let from = 0; const size = 1000
  while (true) {
    const { data, error } = await make().range(from, from + size - 1)
    if (error) throw error
    out.push(...(data || []))
    if (!data || data.length < size) break
    from += size
  }
  return out
}

const CANON_FAB = ['Pesée', 'Granulation', 'Mélange', 'Compression', 'Pelliculage']
function phaseKey(nom) {
  const t = String(nom || '').trim().toLowerCase()
  if (!t) return null
  if (/gran|s[ée]ch/.test(t)) return 'granulation'
  if (/pes/.test(t)) return 'pesee'
  if (/m[ée]lang/.test(t)) return 'melange'
  if (/compress/.test(t)) return 'compression'
  if (/rempliss|g[ée]lul/.test(t)) return 'remplissage'
  if (/pellicul|enrob/.test(t)) return 'pelliculage'
  if (/condition/.test(t)) return 'conditionnement'
  return null
}
const PHASE_LBL = { pesee: 'Pesée', granulation: 'Granulation / Séchage', melange: 'Mélange', compression: 'Compression', remplissage: 'Remplissage gélules', pelliculage: 'Pelliculage' }
const FAB_PH = new Set(['pesee', 'granulation', 'melange', 'compression', 'remplissage', 'pelliculage'])
const estFabType = (type) => FAB_PH.has(phaseKey(type))
const onglet = ref('fab')       // fab | cond
const grp = ref('lab')          // lab | forme | produit | lot
const annee = ref(new Date().getFullYear())
const chargement = ref(true)
const groupes = [
  { k: 'lab', lbl: 'Laboratoire' }, { k: 'forme', lbl: 'Forme' },
  { k: 'produit', lbl: 'Produit' }, { k: 'equip', lbl: 'Équipement' }, { k: 'phase', lbl: 'Phase' }
]
const groupesVisibles = computed(() => groupes.filter(g => g.k !== 'phase' || onglet.value === 'fab'))
const LIB = { lab: 'Laboratoire', forme: 'Forme galénique', produit: 'Produit', equip: 'Équipement' }
const libGroupe = computed(() => LIB[grp.value])
const phasesByOf = computed(() => {
  const m = {}
  for (const sp of suiviRaw.value) {
    if (sp.statut !== 'Terminé') continue
    const k = phaseKey(sp.phase); if (!k || k === 'conditionnement') continue
    if (!m[sp.ordre_id]) m[sp.ordre_id] = new Set()
    m[sp.ordre_id].add(k)
  }
  return m
})
// Équipements de FABRICATION par OF (via les phases saisies, hors conditionnement)
const equipRef = ref([])
const cadences = ref([])
function phaseDeType(t) {
  t = (t || '').toLowerCase()
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
function phaseDeEq(e) { return phaseDeType(e.type) || phaseDeType(e.nom) || phaseDeType(e.code) }
function siteDeCode(code) { const c = (code || '').toUpperCase(); if (c.startsWith('PRH')) return 'hormonal'; if (c === 'PR054') return 'semi'; return 'seche' }
// Mêmes équipements que Suivi de capacité (Forme sèche) : référentiel + phase reconnue + site sèche
// Équipements autorisés (mêmes que Suivi de capacité — Forme sèche)
const EQUIP_OK = ['Cabine de pesée', 'Granulation et Séchage COMASA', 'Granulation et Séchage GLATT', 'Mélangeur en V', 'Mélangeur en V 100L', 'Mélangeur GLATT à Bin', '1200i', 'Fe55', 'Gélules', 'Labortechnic', 'GLATT']
const EQUIP_OK_SET = new Set(EQUIP_OK.map(x => x.toLowerCase().replace(/\s+/g, ' ').trim()))
const normNom = (n) => (n || '').toLowerCase().replace(/\s+/g, ' ').trim()
// Produit -> équipements, d'après la CADENCE (cadences_produit)
const equipParProduit = computed(() => {
  const nomById = {}
  for (const e of equipRef.value) nomById[e.id] = (e.nom || '').trim()
  const m = {}
  for (const c of cadences.value) {
    if (!(Number(c.cadence_nominale) > 0)) continue
    const nom = nomById[c.equipement_id]; if (!nom || !EQUIP_OK_SET.has(normNom(nom))) continue
    if (!m[c.produit_id]) m[c.produit_id] = new Set()
    m[c.produit_id].add(nom)
  }
  return m
})
const equipsByOf = computed(() => {
  const m = {}
  for (const sp of suiviRaw.value) {
    if (sp.statut !== 'Terminé') continue
    const k = phaseKey(sp.phase); if (!k || k === 'conditionnement') continue
    const nom = sp.equipements ? sp.equipements.nom : null
    if (!nom) continue
    if (!m[sp.ordre_id]) m[sp.ordre_id] = new Set()
    m[sp.ordre_id].add(nom)
  }
  return m
})
watch(onglet, () => { if (onglet.value === 'cond' && grp.value === 'phase') grp.value = 'equip' })

const fabRaw = ref([]); const condRaw = ref([]); const planRaw = ref([]); const suiviRaw = ref([])
// Sources transverses (qualité, équipements, RH)
const deviationsRaw = ref([]); const capaRaw = ref([]); const trsRaw = ref([])
const organigrammeRaw = ref([]); const formationsRaw = ref([]); const formEnrRaw = ref([]); const formReqRaw = ref([])
const cadencesRaw = ref([]); const effectifsRaw = ref([])
const ofEcheanceRaw = ref([])
const retoucheRaw = ref([]); const produitsConvRaw = ref([])
const regimeMap = ref({})   // régime de travail par équipement, partagé avec la page Suivi de capacité (localStorage)
onMounted(async () => {
  try {
    const [rf, rc, rp, rs, re, rcad] = await Promise.all([
      fetchAllPaged(() => supabase.from('ordres_fabrication')
        .select('id, produit_id, numero_lot, statut, boites_fabriquees, quantite_theorique, date_fin_fabrication, date_reception, date_lancement, date_fin_validite, equipements(nom), produits(gamme, code_pf, designation, pcsu, taille_lot, donneurs_ordre(nom))')),
      fetchAllPaged(() => supabase.from('conditionnement')
        .select('quantite_conditionnee, date_conditionnement, equipements(nom, type), ordres_fabrication(numero_lot, date_fin_fabrication, produits(code_pf, designation, pcsu, taille_lot, unites_par_boite, donneurs_ordre(nom)))')),
      fetchAllPaged(() => supabase.from('plan_production')
        .select('produit_id, annee, mois, quantite_planifiee, equipements(nom, type), produits(gamme, code_pf, designation, donneurs_ordre(nom))')),
      fetchAllPaged(() => supabase.from('suivi_phases').select('ordre_id, phase, statut, equipements(nom)')),
      fetchAllPaged(() => supabase.from('equipements').select('id, nom, type, code').eq('actif', true)),
      fetchAllPaged(() => supabase.from('cadences_produit').select('produit_id, equipement_id, cadence_nominale'))
    ])
    fabRaw.value = rf; condRaw.value = rc; planRaw.value = rp; suiviRaw.value = rs; equipRef.value = re || []; cadences.value = rcad || []
    // KPIs transverses (qualité, équipements, RH) — chaque requête est tolérante :
    // une table absente n'affecte que son propre KPI et ne casse jamais la page.
    const safe = async (make) => { try { return await fetchAllPaged(make) } catch (e) { console.warn('KPI transverse indisponible :', (e && e.message) || e); return [] } }
    const [rdev, rcapa, rtrs, rorg, rform, rfenr, rfreq, rcadp, reff, roe, rret, rconv] = await Promise.all([
      safe(() => supabase.from('deviations').select('statut, criticite, date_dev')),
      safe(() => supabase.from('capa').select('statut, echeance, date_capa')),
      safe(() => supabase.from('trs_postes').select('date, equipement_id, produit_id, temps_ouverture_min, production_realisee, rebuts, retouches, arret_panne_min, arret_format_min, arret_nettoyage_min, arret_reglage_min, arret_maintenance_min, arret_attente_min, arret_autre_min')),
      safe(() => supabase.from('organigramme').select('id, fonction, actif').eq('actif', true)),
      safe(() => supabase.from('formations').select('id, nom, validite_mois, actif').eq('actif', true)),
      safe(() => supabase.from('formation_enregistrements').select('personne_id, formation_id, date_formation, resultat')),
      safe(() => supabase.from('formation_requise').select('fonction, formation_id')),
      safe(() => supabase.from('cadences_produit').select('equipement_id, produit_id, cadence_nominale, mode')),
      safe(() => supabase.from('effectifs').select('annee, mois, equipe, effectif, actif').eq('actif', true)),
      safe(() => supabase.from('ordres_fabrication').select('id, date_fin_fabrication, date_echeance')),
      safe(() => supabase.from('trs_postes').select('date, production_realisee, retouches')),
      safe(() => supabase.from('produits').select('id, taille_lot, unites_par_boite, poids_unitaire_mg, poids_lot_kg').eq('actif', true))
    ])
    deviationsRaw.value = rdev; capaRaw.value = rcapa; trsRaw.value = rtrs
    organigrammeRaw.value = rorg; formationsRaw.value = rform; formEnrRaw.value = rfenr; formReqRaw.value = rfreq
    cadencesRaw.value = rcadp; effectifsRaw.value = reff; ofEcheanceRaw.value = roe
    retoucheRaw.value = rret; produitsConvRaw.value = rconv
    try { regimeMap.value = JSON.parse(localStorage.getItem('sc_reg_equip') || '{}') || {} } catch (e) { regimeMap.value = {} }
  } catch (e) { console.error(e) } finally { chargement.value = false }
})

const anYear = (d) => d ? new Date(d).getFullYear() : null

const fabData = computed(() => {
  const arr = fabRaw.value
    .filter(o => o.date_fin_fabrication && anYear(o.date_fin_fabrication) === annee.value)
    .map(o => ({ id: o.id, produit_id: o.produit_id, lot: o.numero_lot, equip: o.equipements ? o.equipements.nom : null, boites: o.boites_fabriquees, produit: o.produits, mois: anMonth(o.date_fin_fabrication) }))
  // Produits « direct conditionnement » (sans fabrication) : conditionné compté comme fabriqué
  for (const c of condRaw.value) {
    const of = c.ordres_fabrication
    if (!of || of.date_fin_fabrication) continue
    if (!c.date_conditionnement || anYear(c.date_conditionnement) !== annee.value) continue
    const p = of.produits; const upb = p ? num(p.unites_par_boite) : 0
    arr.push({ id: null, lot: of.numero_lot, equip: c.equipements ? c.equipements.nom : null, boites: upb > 0 ? Math.floor(num(c.quantite_conditionnee) / upb) : 0, produit: p, mois: anMonth(c.date_conditionnement) })
  }
  return arr
})

const condData = computed(() => condRaw.value
  .filter(c => c.date_conditionnement && anYear(c.date_conditionnement) === annee.value)
  .map(c => {
    const of = c.ordres_fabrication; const p = of ? of.produits : null
    const upb = p ? num(p.unites_par_boite) : 0
    return { lot: of ? of.numero_lot : null, equip: c.equipements ? c.equipements.nom : null, equipType: c.equipements ? c.equipements.type : null, boites: upb > 0 ? Math.floor(num(c.quantite_conditionnee) / upb) : 0, produit: p, mois: anMonth(c.date_conditionnement) }
  }))

const annees = computed(() => {
  const s = new Set()
  fabRaw.value.forEach(o => { const y = anYear(o.date_fin_fabrication); if (y) s.add(y) })
  condRaw.value.forEach(c => { const y = anYear(c.date_conditionnement); if (y) s.add(y) })
  s.add(new Date().getFullYear())
  return [...s].sort((a, b) => b - a)
})

function formeDe(p) {
  // 1) d'après la GAMME de fabrication (le vrai procédé)
  const g = (p && Array.isArray(p.gamme)) ? p.gamme.map(x => (x || '').toLowerCase()) : []
  if (g.some(x => /g[ée]lule|remplis|encapsul/.test(x))) return 'Gélule'
  if (g.some(x => /compress|compri/.test(x))) return 'Comprimé'
  if (g.some(x => /pellicul/.test(x))) return 'Comprimé'
  // 2) sinon d'après la désignation
  const d = ((p && p.designation) || '').toLowerCase()
  if (/g[ée]lule|caps/.test(d)) return 'Gélule'
  if (/comprim|\bcp\b|\bc\.?p\.?\b|pellicul|dispers|effervesc|\bcpr?\b/.test(d)) return 'Comprimé'
  if (/sachet|poudre|granul/.test(d)) return 'Sachet / Poudre'
  if (/sirop|solut|susp|goutte|\bml\b|\bfl\b/.test(d)) return 'Liquide'
  if (/pommade|cr[èe]me|\bgel\b|topique|onguent/.test(d)) return 'Topique'
  if (/suppos|ovule/.test(d)) return 'Suppositoire / Ovule'
  return 'Autre'
}
function cleProduit(p) {
  if (!p) return null
  if (grp.value === 'lab') return (p.donneurs_ordre && p.donneurs_ordre.nom) || 'Non attribué'
  if (grp.value === 'forme') return formeDe(p)
  if (grp.value === 'produit') return (p.code_pf || '?') + ' — ' + (p.designation || '')
  return null
}
function cleGroupe(r) { return grp.value === 'equip' ? (r.equip || 'Non attribué') : (cleProduit(r.produit) || 'Non attribué') }
const machinesParProduit = computed(() => {
  const m = {}
  for (const o of fabRaw.value) {
    const code = o.produits ? o.produits.code_pf : null
    const eqs = equipsByOf.value[o.id]
    if (!code || !eqs) continue
    if (!m[code]) m[code] = new Set()
    for (const nom of eqs) m[code].add(nom)
  }
  return m
})
function planAgg(moisFiltre) {
  const acc = {}
  const parPhase = onglet.value === 'fab' && grp.value === 'phase'
  const parEquipFab = onglet.value === 'fab' && grp.value === 'equip'
  const machP = machinesParProduit.value
  for (const r of planRaw.value) {
    if (Number(r.annee) !== annee.value) continue
    if (moisFiltre != null && Number(r.mois) !== moisFiltre) continue
    const q = num(r.quantite_planifiee)
    if (parPhase) {
      const p = r.produits; if (!p) continue
      const gamme = (Array.isArray(p.gamme) && p.gamme.length) ? p.gamme : []
      const seen = new Set()
      for (const phn of gamme) { const k = phaseKey(phn); if (!k || k === 'conditionnement' || seen.has(k)) continue; seen.add(k); const cle = PHASE_LBL[k] || k; acc[cle] = (acc[cle] || 0) + q }
    } else if (parEquipFab) {
      let machs = equipParProduit.value[r.produit_id]
      if ((!machs || !machs.size) && r.equipements && r.equipements.nom) machs = new Set([r.equipements.nom])
      if (!machs || !machs.size) continue
      for (const nom of machs) { if (EQUIP_OK_SET.has(normNom(nom))) acc[nom] = (acc[nom] || 0) + q }
    } else {
      const cle = grp.value === 'equip' ? (r.equipements ? r.equipements.nom : null) : cleProduit(r.produits)
      if (cle == null) continue
      if (onglet.value === 'cond' && grp.value === 'equip' && r.equipements && estFabType(r.equipements.type)) continue
      acc[cle] = (acc[cle] || 0) + q
    }
  }
  return acc
}
const planParGroupe = computed(() => planAgg(null))
const planParGroupeMois = computed(() => planAgg(moisCourant))

const donnees = computed(() => {
  const src = onglet.value === 'fab' ? fabData.value : condData.value
  const acc = {}
  const parPhase = onglet.value === 'fab' && grp.value === 'phase'
  const parEquipFab = onglet.value === 'fab' && grp.value === 'equip'
  const add = (cle, b, t, pc, mo) => { if (!acc[cle]) acc[cle] = { cle, boites: 0, boitesMois: 0, lots: 0, ca: 0, caMois: 0 }; acc[cle].boites += b; if (mo === moisCourant) { acc[cle].boitesMois += b; acc[cle].caMois += b * pc } acc[cle].lots += t > 0 ? b / t : 0; acc[cle].ca += b * pc }
  for (const r of src) {
    if (!r.produit || !(num(r.boites) > 0)) continue
    const b = num(r.boites), t = num(r.produit.taille_lot), pc = num(r.produit.pcsu), mo = r.mois
    if (parPhase) {
      const phs = phasesByOf.value[r.id]; if (!phs) continue
      for (const k of phs) add(PHASE_LBL[k] || k, b, t, pc, mo)
    } else if (parEquipFab) {
      let machs = equipParProduit.value[r.produit_id]
      if (!machs || !machs.size) machs = equipsByOf.value[r.id]
      if ((!machs || !machs.size) && r.equip) machs = new Set([r.equip])
      if (!machs || !machs.size) continue
      for (const nom of machs) { if (EQUIP_OK_SET.has(normNom(nom))) add(nom, b, t, pc, mo) }
    } else {
      if (onglet.value === 'cond' && grp.value === 'equip' && estFabType(r.equipType)) continue
      add(cleGroupe(r), b, t, pc, mo)
    }
  }
  const pg = planParGroupe.value
  const pgm = planParGroupeMois.value
  return Object.values(acc).map(g => {
    const plan = pg[g.cle] || 0
    const planMois = pgm[g.cle] || 0
    return { ...g, lots: Math.round(g.lots), plan, taux: plan > 0 ? Math.round(g.boites / plan * 100) : null, planMois, tauxMois: planMois > 0 ? Math.round(g.boitesMois / planMois * 100) : null }
  }).sort((a, b) => b.boites - a.boites)
})

const totBoites = computed(() => donnees.value.reduce((s, g) => s + g.boites, 0))
const totLots = computed(() => donnees.value.reduce((s, g) => s + g.lots, 0))
const totCA = computed(() => donnees.value.reduce((s, g) => s + g.ca, 0))
const maxBoites = computed(() => Math.max(1, ...donnees.value.map(g => g.boites)))
const totPlan = computed(() => donnees.value.reduce((s, g) => s + g.plan, 0))
const tauxGlobal = computed(() => totPlan.value > 0 ? Math.round(totBoites.value / totPlan.value * 100) : null)
// --- Mois en cours ---
const moisCourant = new Date().getMonth() + 1
const anMonth = (d) => d ? new Date(d).getMonth() + 1 : null
const nomMois = computed(() => new Date(annee.value, moisCourant - 1, 1).toLocaleDateString('fr-FR', { month: 'long' }))
const fabDataMois = computed(() => {
  const arr = fabRaw.value.filter(o => o.date_fin_fabrication && anYear(o.date_fin_fabrication) === annee.value && anMonth(o.date_fin_fabrication) === moisCourant).map(o => ({ boites: o.boites_fabriquees, produit: o.produits }))
  for (const c of condRaw.value) {
    const of = c.ordres_fabrication
    if (!of || of.date_fin_fabrication) continue
    if (!c.date_conditionnement || anYear(c.date_conditionnement) !== annee.value || anMonth(c.date_conditionnement) !== moisCourant) continue
    const p = of.produits; const upb = p ? num(p.unites_par_boite) : 0
    arr.push({ boites: upb > 0 ? Math.floor(num(c.quantite_conditionnee) / upb) : 0, produit: p })
  }
  return arr
})
const condDataMois = computed(() => condRaw.value.filter(c => c.date_conditionnement && anYear(c.date_conditionnement) === annee.value && anMonth(c.date_conditionnement) === moisCourant).map(c => { const of = c.ordres_fabrication; const pp = of ? of.produits : null; const upb = pp ? num(pp.unites_par_boite) : 0; return { boites: upb > 0 ? Math.floor(num(c.quantite_conditionnee) / upb) : 0, produit: pp } }))
const srcMois = computed(() => onglet.value === 'fab' ? fabDataMois.value : condDataMois.value)
const totBoitesMois = computed(() => srcMois.value.reduce((s, r) => s + num(r.boites), 0))
const totCAMois = computed(() => srcMois.value.reduce((s, r) => s + num(r.boites) * (r.produit ? num(r.produit.pcsu) : 0), 0))
const totPlanMois = computed(() => { let tot = 0; for (const r of planRaw.value) { if (Number(r.annee) === annee.value && Number(r.mois) === moisCourant) tot += num(r.quantite_planifiee) } return tot })
const tauxGlobalMois = computed(() => totPlanMois.value > 0 ? Math.round(totBoitesMois.value / totPlanMois.value * 100) : null)

// ===== Pilotage — séries mensuelles & géométrie des graphiques =====
const MOIS_COURTS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const serieMensuelle = computed(() => {
  const src = onglet.value === 'fab' ? fabData.value : condData.value
  const real = Array(12).fill(0), ca = Array(12).fill(0), plan = Array(12).fill(0)
  for (const r of src) {
    if (!r.produit || !(num(r.boites) > 0) || !r.mois) continue
    const i = r.mois - 1; real[i] += num(r.boites); ca[i] += num(r.boites) * num(r.produit.pcsu)
  }
  for (let m = 1; m <= 12; m++) { const agg = planAgg(m); plan[m - 1] = Object.values(agg).reduce((s, v) => s + v, 0) }
  return MOIS_COURTS.map((nom, i) => ({ nom, real: real[i], ca: ca[i], plan: plan[i] }))
})
// Barres groupées Plan vs Réalisé (boîtes) par mois
const graphPR = computed(() => {
  const s = serieMensuelle.value
  const W = 760, H = 182, mL = 10, mR = 10, mT = 12, mB = 24
  const iw = W - mL - mR, ih = H - mT - mB, baseY = mT + ih
  const max = Math.max(1, ...s.map(x => Math.max(x.plan, x.real)))
  const step = iw / 12, bw = Math.min(15, step / 3)
  const bars = []
  s.forEach((x, i) => {
    const cx = mL + step * i + step / 2
    const hp = x.plan / max * ih, hr = x.real / max * ih
    bars.push({ x: cx - bw - 2, y: baseY - hp, w: bw, h: hp, cls: 'b-plan', v: x.plan })
    bars.push({ x: cx + 2, y: baseY - hr, w: bw, h: hr, cls: 'b-real', v: x.real })
  })
  const labels = s.map((x, i) => ({ x: mL + step * i + step / 2, y: H - 7, t: x.nom }))
  const grid = [0.25, 0.5, 0.75, 1].map(g => ({ y: baseY - g * ih }))
  return { W, H, mL, iw, bars, labels, grid }
})
// Barres CA mensuel
const graphCA = computed(() => {
  const s = serieMensuelle.value
  const W = 760, H = 200, mL = 10, mR = 10, mT = 12, mB = 24
  const iw = W - mL - mR, ih = H - mT - mB, baseY = mT + ih
  const max = Math.max(1, ...s.map(x => x.ca))
  const step = iw / 12, bw = Math.min(28, step * 0.62)
  const bars = s.map((x, i) => { const cx = mL + step * i + step / 2; const h = x.ca / max * ih; return { x: cx - bw / 2, y: baseY - h, w: bw, h, v: x.ca } })
  const labels = s.map((x, i) => ({ x: mL + step * i + step / 2, y: H - 7, t: x.nom }))
  return { W, H, bars, labels }
})
// Top catégories (selon regroupement actif) par boîtes
const graphTop = computed(() => {
  const top = donnees.value.slice(0, 7)
  const max = Math.max(1, ...top.map(d => d.boites))
  return top.map(d => ({ nom: d.cle, boites: d.boites, pct: d.boites / max * 100, taux: d.taux }))
})

// ===== KPIs transverses pour le pilotage (qualité, équipements, RH) =====
const _today = new Date(new Date().toISOString().slice(0, 10))
const _dans60 = new Date(_today.getTime() + 60 * 86400000)
const normNomF = (n) => (n || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
function addMonths(dateStr, m) {
  if (!dateStr || !m) return null
  const d = new Date(String(dateStr).slice(0, 10) + 'T00:00:00')
  if (isNaN(d.getTime())) return null
  d.setMonth(d.getMonth() + Number(m)); return d
}
const fmtH = (h) => h == null ? '—' : (h >= 10 ? Math.round(h) : h.toFixed(1)) + ' h'
// Qualité
const statutKeyCapa = (s) => { const t = (s || '').toLowerCase(); if (/cl[oô]tur/.test(t)) return 'cloturee'; if (/r[ée]alis/.test(t)) return 'realisee'; return 'autre' }
const devOuvertes = computed(() => deviationsRaw.value.filter(d => d.statut !== 'Clôturée').length)
const devCritiques = computed(() => deviationsRaw.value.filter(d => d.criticite === 'Critique' && d.statut !== 'Clôturée').length)
const capaRetard = computed(() => capaRaw.value.filter(c => c.echeance && !['cloturee', 'realisee'].includes(statutKeyCapa(c.statut)) && new Date(c.echeance) < _today).length)
// Équipements — disponibilité, MTBF, MTTR (trs_postes) sur l'année sélectionnée
const equipKpi = computed(() => {
  let ouv = 0, arrets = 0, panne = 0, evPanne = 0
  for (const t of trsRaw.value) {
    if (!t.date || anYear(t.date) !== annee.value) continue
    const o = num(t.temps_ouverture_min); if (!(o > 0)) continue
    const p = num(t.arret_panne_min)
    const a = p + num(t.arret_format_min) + num(t.arret_nettoyage_min) + num(t.arret_reglage_min) + num(t.arret_maintenance_min) + num(t.arret_attente_min) + num(t.arret_autre_min)
    ouv += o; arrets += a; panne += p; if (p > 0) evPanne++
  }
  const fonct = Math.max(0, ouv - arrets)
  return { dispo: ouv > 0 ? Math.round(fonct / ouv * 100) : null, mtbf: evPanne ? fonct / evPanne / 60 : null, mttr: evPanne ? panne / evPanne / 60 : null, evPanne }
})
// Rendement fabrication sur l'année
const rendementFab = computed(() => {
  let theo = 0, prod = 0
  for (const o of fabRaw.value) {
    if (!o.date_fin_fabrication || anYear(o.date_fin_fabrication) !== annee.value) continue
    const t = num(o.quantite_theorique), b = num(o.boites_fabriquees)
    if (t > 0 && b > 0) { theo += t; prod += b }
  }
  return theo > 0 ? Math.round(prod / theo * 100) : null
})
// Taux de rejet : lots d'OF au statut « rejeté » / total lots de l'année
const tauxRejetLots = computed(() => {
  let total = 0, rejetes = 0
  for (const o of fabRaw.value) {
    const d = o.date_lancement || o.date_fin_fabrication || o.date_reception
    if (!d || anYear(d) !== annee.value) continue
    total++
    if (/rejet/i.test(String(o.statut || ''))) rejetes++
  }
  return total ? rejetes / total * 100 : null
})
// Taux de rebut : perte de fabrication = (quantité théorique − quantité livrée au conditionnement) ÷ théorique
// Quantité livrée au conditionnement = boîtes fabriquées (sortie de fabrication).
const tauxRebut = computed(() => {
  let theo = 0, perte = 0
  for (const o of fabRaw.value) {
    if (!o.date_fin_fabrication || anYear(o.date_fin_fabrication) !== annee.value) continue
    const t = num(o.quantite_theorique), b = num(o.boites_fabriquees)
    if (t > 0) { theo += t; perte += Math.max(0, t - b) }
  }
  return theo > 0 ? perte / theo * 100 : null
})
// Formation / qualification (logique Matrice, dédup par nom canonique)
const canonF = computed(() => {
  const cleById = {}, idByCle = {}
  for (const f of formationsRaw.value) { const cle = normNomF(f.nom); cleById[f.id] = cle; if (!(cle in idByCle)) idByCle[cle] = f.id }
  const map = {}, valid = {}
  for (const f of formationsRaw.value) { const c = idByCle[cleById[f.id]]; map[f.id] = c; if (valid[c] == null && f.validite_mois != null) valid[c] = f.validite_mois }
  return { map, valid }
})
const formationKpi = computed(() => {
  const cf = canonF.value
  const reqByFonction = {}
  for (const r of formReqRaw.value) { const c = cf.map[r.formation_id] || r.formation_id; if (!reqByFonction[r.fonction]) reqByFonction[r.fonction] = new Set(); reqByFonction[r.fonction].add(c) }
  const latest = {}
  for (const e of formEnrRaw.value) { const c = cf.map[e.formation_id] || e.formation_id; const k = e.personne_id + '|' + c; if (!latest[k] || String(e.date_formation) > String(latest[k].date_formation)) latest[k] = e }
  let requises = 0, valides = 0, expire = 0, bientot = 0, qualifies = 0, totalPers = 0
  for (const p of organigrammeRaw.value) {
    const reqs = reqByFonction[p.fonction]; if (!reqs || !reqs.size) continue
    totalPers++; let pv = 0
    for (const c of reqs) {
      requises++
      const e = latest[p.id + '|' + c]
      if (!e) continue
      if (e.resultat === 'non acquis') { expire++; continue }
      const exp = addMonths(e.date_formation, cf.valid[c])
      if (exp && exp < _today) { expire++; continue }
      if (exp && exp <= _dans60) { bientot++; continue }
      valides++; pv++
    }
    if (pv === reqs.size) qualifies++
  }
  return { taux: requises ? Math.round(valides / requises * 100) : null, expire, bientot, qualifies, totalPers }
})
// Bandeau de décisions — signaux nécessitant l'attention du manager
const alertes = computed(() => {
  const a = []
  if (capaRetard.value > 0) a.push({ t: capaRetard.value + ' CAPA en retard', d: 'Échéance dépassée — relancer les responsables', lvl: 'high' })
  if (devCritiques.value > 0) a.push({ t: devCritiques.value + ' déviation(s) critique(s) ouverte(s)', d: 'À traiter en priorité', lvl: 'high' })
  if (formationKpi.value.expire > 0) a.push({ t: formationKpi.value.expire + ' qualification(s) expirée(s)', d: 'Personnel à requalifier', lvl: 'high' })
  if (formationKpi.value.bientot > 0) a.push({ t: formationKpi.value.bientot + ' qualification(s) à recycler (< 60 j)', d: 'Planifier le recyclage', lvl: 'mid' })
  if (equipKpi.value.dispo != null && equipKpi.value.dispo < 85) a.push({ t: 'Disponibilité équipements ' + equipKpi.value.dispo + '%', d: "Sous l'objectif (85%) — analyser les arrêts", lvl: 'mid' })
  if (rendementFab.value != null && rendementFab.value < 90) a.push({ t: 'Rendement fabrication ' + rendementFab.value + '%', d: 'Pertes élevées — vérifier les procédés', lvl: 'mid' })
  if (tauxGlobalMois.value != null && tauxGlobalMois.value < 100) a.push({ t: 'Plan du mois réalisé à ' + tauxGlobalMois.value + '%', d: 'Retard sur le planning — ajuster la charge', lvl: 'mid' })
  return a
})

// ===== Illustrations compactes : anneaux (%) + sparklines (tendance) =====
const ringDash = (pct) => { const p = Math.max(0, Math.min(100, pct == null ? 0 : pct)); return p.toFixed(1) + ' ' + (100 - p).toFixed(1) }
const colPct = (p, seuil = 90) => p == null ? '#cbd5e1' : (p >= seuil ? '#16a34a' : (p >= seuil - 15 ? '#d97706' : '#dc2626'))
const serieReal = computed(() => serieMensuelle.value.map(x => x.real))
const serieCA = computed(() => serieMensuelle.value.map(x => x.ca))
function sparkPath(arr) {
  const a = arr || []; if (a.length < 2) return ''
  const max = Math.max(1, ...a), W = 100, H = 26, pad = 2
  return a.map((v, i) => { const x = pad + i / (a.length - 1) * (W - 2 * pad); const y = H - pad - (v / max) * (H - 2 * pad); return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) }).join(' ')
}
function sparkArea(arr) { const p = sparkPath(arr); if (!p) return ''; const W = 100, H = 26, pad = 2; return p + ' L ' + (W - pad) + ' ' + (H - pad) + ' L ' + pad + ' ' + (H - pad) + ' Z' }
const nbLots = computed(() => donnees.value.reduce((s, d) => s + (Number(d.lots) || 0), 0))
const tableOuverte = ref(false)

// ===== KPIs de production standard (cible / réel / statut) =====
const kpiOuvert = ref(true)
// Agrégat trs_postes de l'année + cadences (pour Performance / OEE)
const trsAgg = computed(() => {
  const cad = {}
  for (const c of cadencesRaw.value) cad[c.equipement_id + '|' + c.produit_id] = c
  let ouv = 0, fonct = 0, prod = 0, rebuts = 0, retouches = 0, reglage = 0, format = 0, theo = 0, prodTheo = 0
  let panne = 0, nettoyage = 0, maintenance = 0, attente = 0, autre = 0
  for (const t of trsRaw.value) {
    if (!t.date || anYear(t.date) !== annee.value) continue
    const o = num(t.temps_ouverture_min); if (!(o > 0)) continue
    const rg = num(t.arret_reglage_min), ft = num(t.arret_format_min)
    const pn = num(t.arret_panne_min), net = num(t.arret_nettoyage_min), mn = num(t.arret_maintenance_min), att = num(t.arret_attente_min), au = num(t.arret_autre_min)
    const arr = pn + ft + net + rg + mn + att + au
    const f = Math.max(0, o - arr)
    ouv += o; fonct += f; reglage += rg; format += ft
    panne += pn; nettoyage += net; maintenance += mn; attente += att; autre += au
    const p = num(t.production_realisee); prod += p; rebuts += num(t.rebuts); retouches += num(t.retouches)
    const c = cad[t.equipement_id + '|' + t.produit_id]
    if (c && c.mode === 'debit' && num(c.cadence_nominale) > 0) { theo += (f / 60) * num(c.cadence_nominale); prodTheo += p }
  }
  const good = Math.max(0, prod - rebuts)                    // conformes vendables (reprises incluses) → Débit, cycle
  const goodFtq = Math.max(0, prod - rebuts - retouches)     // conformes du 1er coup (rebuts + retouches exclus) → Qualité TRS
  return { ouv, fonct, prod, good, goodFtq, rebuts, retouches, reglage, format, theo, prodTheo, arrets: { panne, format, nettoyage, reglage, maintenance, attente, autre } }
})
// Décomposition des arrêts (en % du temps d'ouverture), triée par perte décroissante
const arretsDecomp = computed(() => {
  const a = trsAgg.value
  if (!a.ouv) return null
  const defs = [['panne', 'Panne'], ['format', 'Changement de format'], ['nettoyage', 'Nettoyage'], ['reglage', 'Réglage'], ['maintenance', 'Maintenance'], ['attente', 'Attente'], ['autre', 'Autre']]
  const items = defs.map(([k, lbl]) => ({ k, lbl, min: a.arrets[k] || 0, pct: (a.arrets[k] || 0) / a.ouv * 100 }))
    .filter(x => x.min > 0).sort((x, y) => y.min - x.min)
  const totArr = items.reduce((s, x) => s + x.min, 0)
  return { items, totPct: totArr / a.ouv * 100, dispo: a.fonct / a.ouv * 100 }
})
function statutKpi(val, dir, seuil) {
  if (val == null) return 'na'
  if (dir === 'info' || seuil == null) return 'info'
  if (dir === 'down') return val <= seuil ? 'ok' : (val <= seuil * 1.5 ? 'warn' : 'bad')
  return val >= seuil ? 'ok' : (val >= seuil * 0.9 ? 'warn' : 'bad')
}
const stLabel = (st) => ({ ok: 'Sur objectif', warn: 'À surveiller', bad: 'Hors objectif', na: 'N/A', info: '—' }[st] || '—')
function fmtKpi(v, u) {
  if (v == null) return '—'
  if (u === '%') return v.toFixed(1) + '%'
  if (u === '') return fmt(v)
  return v.toFixed(1) + u
}
// Délai de fabrication moyen (jours) : réception OF → fin de fabrication, lots terminés dans l'année
const ofDelai = computed(() => {
  let n = 0, somme = 0
  for (const o of fabRaw.value) {
    if (!o.date_fin_fabrication || !o.date_reception) continue
    if (anYear(o.date_fin_fabrication) !== annee.value) continue
    const j = (new Date(o.date_fin_fabrication) - new Date(o.date_reception)) / 86400000
    if (!(j >= 0) || j > 400) continue
    somme += j; n++
  }
  return n ? somme / n : null
})
// Effectifs : nombre d'équipes distinctes et effectif mensuel moyen sur l'année
const effectifKpi = computed(() => {
  const equipes = new Set(); const parMois = {}
  for (const e of effectifsRaw.value) {
    if (Number(e.annee) !== annee.value) continue
    if (e.equipe) equipes.add(String(e.equipe).trim().toLowerCase())
    const m = Number(e.mois) || 0
    parMois[m] = (parMois[m] || 0) + num(e.effectif)
  }
  const mois = Object.values(parMois)
  const effMoyen = mois.length ? mois.reduce((s, v) => s + v, 0) / mois.length : null
  return { nbEquipes: equipes.size || null, effMoyen }
})
// Demande client de l'année (boîtes) → base du Takt Time.
// Source : Plan directeur de production (plan_production), où la demande est représentée.
const demandeAnnee = computed(() => {
  let d = 0
  for (const r of planRaw.value) { if (Number(r.annee) === annee.value) d += num(r.quantite_planifiee) }
  return d
})
// Production à temps : % de lots terminés au plus tard à leur échéance.
// Échéance = date de fin de validité de l'OF (date_fin_validite) ; un champ
// « Échéance de livraison » saisi sur l'OF, s'il existe, fait exception.
const onTimeKpi = computed(() => {
  const manuel = {}
  for (const o of ofEcheanceRaw.value) if (o && o.date_echeance) manuel[o.id] = o.date_echeance
  let total = 0, aTemps = 0
  for (const o of fabRaw.value) {
    if (!o.date_fin_fabrication || anYear(o.date_fin_fabrication) !== annee.value) continue
    const ech = manuel[o.id] || o.date_fin_validite
    if (!ech) continue
    total++
    if (new Date(o.date_fin_fabrication) <= new Date(ech)) aTemps++
  }
  return total ? Math.round(aTemps / total * 100) : null
})
// Taux de retouche : unités retouchées / produites (postes TRS)
const retoucheKpi = computed(() => {
  let prod = 0, ret = 0
  for (const t of retoucheRaw.value) {
    if (!t.date || anYear(t.date) !== annee.value) continue
    prod += num(t.production_realisee); ret += num(t.retouches)
  }
  return prod > 0 ? ret / prod * 100 : null
})
// Taux d'utilisation capacité : temps de marche réel vs capacité calendaire.
// Capacité = jours ouvrés (hors week-end) × régime de travail × 8 h/poste, même
// base que la page « Suivi de capacité des équipements » (régime via localStorage,
// défaut 3×8). Calculé par équipement présent dans les postes TRS (couverture cohérente).
function joursOuvresMoisTB(an, moisIdx) {
  const d = new Date(an, moisIdx, 1); let n = 0
  while (d.getMonth() === moisIdx) { const wd = d.getDay(); if (wd !== 0 && wd !== 6) n++; d.setDate(d.getDate() + 1) }
  return n
}
// Base capacité partagée : heures de marche, d'ouverture et capacité calendaire (par équipement présent en TRS)
const capaBase = computed(() => {
  const now = new Date()
  const moisMax = annee.value === now.getFullYear() ? (now.getMonth() + 1) : 12
  let joursAn = 0
  for (let m = 0; m < moisMax; m++) joursAn += joursOuvresMoisTB(annee.value, m)
  if (!(joursAn > 0)) return null
  const fonctEq = {}, ouvEq = {}
  for (const t of trsRaw.value) {
    if (!t.date || anYear(t.date) !== annee.value) continue
    const o = num(t.temps_ouverture_min); if (!(o > 0)) continue
    const arr = num(t.arret_panne_min) + num(t.arret_format_min) + num(t.arret_nettoyage_min) + num(t.arret_reglage_min) + num(t.arret_maintenance_min) + num(t.arret_attente_min) + num(t.arret_autre_min)
    fonctEq[t.equipement_id] = (fonctEq[t.equipement_id] || 0) + Math.max(0, o - arr)
    ouvEq[t.equipement_id] = (ouvEq[t.equipement_id] || 0) + o
  }
  const rg = regimeMap.value || {}
  let marcheH = 0, ouvH = 0, capaH = 0
  for (const id in ouvEq) {
    marcheH += (fonctEq[id] || 0) / 60
    ouvH += ouvEq[id] / 60
    const r = rg[id]
    const postes = r === '4' ? 3 : (r ? Number(r) : 3)   // défaut 3×8, comme la page Suivi de capacité
    capaH += joursAn * postes * 8
  }
  return { marcheH, ouvH, capaH }
})
// Taux d'utilisation capacité = marche ÷ capacité calendaire
const utilisationCapacite = computed(() => {
  const b = capaBase.value
  return b && b.capaH > 0 ? Math.min(100, b.marcheH / b.capaH * 100) : null
})
// Taux d'engagement (Utilisation machine) = temps d'ouverture ÷ capacité calendaire
const tauxEngagement = computed(() => {
  const b = capaBase.value
  return b && b.capaH > 0 ? Math.min(100, b.ouvH / b.capaH * 100) : null
})
// Coût de production / unité : PCSU (coût/boîte du référentiel produit) pondéré par la production
const coutUnite = computed(() => totBoites.value > 0 ? totCA.value / totBoites.value : null)
// Équilibrage de ligne (depuis les cadences) : pour chaque produit, on dérive le
// temps par boîte de chaque phase de son procédé à partir de la cadence nominale
// (conversion kg/h → boîtes/h pour la fab, boîtes/h direct pour le conditionnement,
// même logique que la page Suivi de capacité). Efficience d'un produit =
// Σ temps / (nb phases × goulot). Le KPI est la moyenne sur les produits ayant au
// moins 2 phases cadencées.
const equilibrageLigne = computed(() => {
  const phaseEq = {}
  for (const e of equipRef.value) phaseEq[e.id] = phaseDeEq(e)
  const conv = {}
  for (const p of produitsConvRaw.value) {
    const tl = num(p.taille_lot)
    const plk = (tl * num(p.unites_par_boite) * num(p.poids_unitaire_mg) / 1e6) || num(p.poids_lot_kg)
    conv[p.id] = { tl, plk }
  }
  const parProduit = {}
  for (const c of cadences.value) {
    const cad = num(c.cadence_nominale); if (!(cad > 0)) continue
    const ph = phaseEq[c.equipement_id]; if (!ph) continue
    let debit                                  // boîtes/h
    if (ph === 'conditionnement') debit = cad   // cadence déjà en boîtes/h
    else {
      const cv = conv[c.produit_id]
      if (!cv || !(cv.tl > 0 && cv.plk > 0)) continue   // fab : besoin du poids de lot
      debit = cad * cv.tl / cv.plk               // kg/h → boîtes/h
    }
    if (!(debit > 0)) continue
    const m = (parProduit[c.produit_id] = parProduit[c.produit_id] || {})
    if (!m[ph] || debit > m[ph]) m[ph] = debit   // meilleur débit par phase
  }
  const effs = []
  for (const pid in parProduit) {
    const cycles = Object.values(parProduit[pid]).map(d => 1 / d)   // temps/boîte
    if (cycles.length < 2) continue
    const somme = cycles.reduce((s, v) => s + v, 0)
    effs.push(somme / (cycles.length * Math.max(...cycles)) * 100)
  }
  return effs.length ? effs.reduce((s, v) => s + v, 0) / effs.length : null
})
const kpisStd = computed(() => {
  const a = trsAgg.value
  const A = a.ouv ? a.fonct / a.ouv * 100 : null
  // Qualité = conformité du premier coup = 100 − taux de rebut (perte fabrication) − taux de retouche
  const Q = tauxRebut.value != null ? Math.max(0, 100 - tauxRebut.value - (retoucheKpi.value || 0)) : null
  const P = a.theo ? Math.min(100, a.prodTheo / a.theo * 100) : null
  const oee = (A != null && P != null && Q != null) ? A * P * Q / 10000 : null
  const cyc = a.good ? a.fonct / a.good : null
  const eff = effectifKpi.value
  const prodBase = totBoites.value || a.good || null
  const takt = (a.ouv && demandeAnnee.value) ? a.ouv / demandeAnnee.value : null
  const rows = [
    { n: 'OEE (TRS)', d: 'Efficacité globale des équipements', f: 'Disponibilité × Performance × Qualité', c: '≥ 85%', dir: 'up', s: 85, v: oee, u: '%', fr: 'Quot./Hebdo' },
    { n: 'Disponibilité', d: 'Temps de marche vs temps ouvert', f: 'Temps de marche / temps ouvert ×100', c: '≥ 90%', dir: 'up', s: 90, v: A, u: '%', fr: 'Quot./Hebdo' },
    { n: 'Performance', d: 'Cadence réelle vs cadence nominale', f: 'Production / production théorique ×100', c: '≥ 95%', dir: 'up', s: 95, v: P, u: '%', fr: 'Quot./Hebdo' },
    { n: 'Qualité', d: 'Conformité : 100 − taux de rebut − taux de retouche', f: '100 − taux de rebut − taux de retouche', c: '≥ 99%', dir: 'up', s: 99, v: Q, u: '%', fr: 'Quot./Hebdo' },
    { n: 'Efficience de production', d: 'Sortie réelle vs théorique', f: 'Sortie réelle / théorique ×100', c: '≥ 90%', dir: 'up', s: 90, v: P != null ? P : rendementFab.value, u: '%', fr: 'Quot./Hebdo' },
    { n: 'Taux d\'utilisation capacité', d: 'Marche vs capacité calendaire', f: 'Temps de marche / capacité théorique ×100', c: '≥ 80%', dir: 'up', s: 80, v: utilisationCapacite.value, u: '%', fr: 'Hebdo/Mens.' },
    { n: 'Débit (Throughput)', d: 'Unités conformes produites', f: 'Total unités conformes', c: '↑ mieux', dir: 'info', s: null, v: a.good || null, u: '', fr: 'Quot.' },
    { n: 'Production par équipe', d: 'Boîtes produites par équipe (an)', f: 'Boîtes fabriquées / nb d\'équipes', c: '↑ mieux', dir: 'info', s: null, v: (eff.nbEquipes && prodBase) ? prodBase / eff.nbEquipes : null, u: '', fr: 'Quot.' },
    { n: 'Temps de cycle', d: 'Temps pour produire une unité', f: 'Temps de marche / unités', c: '↓ mieux', dir: 'down', s: null, v: cyc, u: ' min', fr: 'Quot.' },
    { n: 'Takt Time', d: 'Rythme requis par la demande (PDP)', f: 'Temps disponible / quantité planifiée', c: 'selon demande', dir: 'info', s: null, v: takt, u: ' min', fr: 'Quot.' },
    { n: 'Délai (Lead Time)', d: 'Réception OF → fin de fabrication', f: 'Fin de fabrication − réception (moy. jours)', c: '↓ mieux', dir: 'down', s: null, v: ofDelai.value, u: ' j', fr: 'Hebdo/Mens.' },
    { n: 'First Pass Yield (FPY)', d: 'Unités bonnes du premier coup', f: 'Bonnes / total entrée ×100', c: '≥ 95%', dir: 'up', s: 95, v: rendementFab.value, u: '%', fr: 'Quot./Hebdo' },
    { n: 'Taux de rejet', d: '% de lots rejetés (statut OF rejeté)', f: 'Lots rejetés / total lots ×100', c: '< 2%', dir: 'down', s: 2, v: tauxRejetLots.value, u: '%', fr: 'Hebdo/Mens.' },
    { n: 'Taux de rebut', d: 'Perte fabrication : théorique − livré au conditionnement', f: '(Qté théorique − boîtes fabriquées) / théorique ×100', c: '< 1,5%', dir: 'down', s: 1.5, v: tauxRebut.value, u: '%', fr: 'Par lot / Hebdo' },
    { n: 'Taux de retouche', d: '% d\'unités retouchées', f: 'Retouchées / produites ×100', c: '< 2%', dir: 'down', s: 2, v: retoucheKpi.value, u: '%', fr: 'Quot.' },
    { n: 'Respect du planning', d: '% production réalisée au plan', f: 'Réalisé / planifié ×100', c: '≥ 95%', dir: 'up', s: 95, v: tauxGlobal.value, u: '%', fr: 'Quot./Hebdo' },
    { n: 'Utilisation machine', d: 'Taux d\'engagement : ouverture vs capacité calendaire', f: 'Temps d\'ouverture / capacité théorique ×100', c: '≥ 80%', dir: 'up', s: 80, v: tauxEngagement.value, u: '%', fr: 'Hebdo/Mens.' },
    { n: 'Temps de réglage (Setup)', d: 'Temps de réglage total', f: 'Σ temps de réglage', c: '↓ mieux', dir: 'down', s: null, v: a.reglage ? a.reglage / 60 : null, u: ' h', fr: 'Quot./Hebdo' },
    { n: 'Changement de série (SMED)', d: 'Changement d\'une série à l\'autre', f: 'Σ format + réglage', c: '↓ mieux', dir: 'down', s: null, v: (a.format + a.reglage) ? (a.format + a.reglage) / 60 : null, u: ' h', fr: 'Quot./Hebdo' },
    { n: 'Production à temps', d: '% lots finis avant la fin de validité OF', f: 'Lots à temps / total ×100 (échéance = date fin de validité OF)', c: '≥ 95%', dir: 'up', s: 95, v: onTimeKpi.value, u: '%', fr: 'Quot./Hebdo' },
    { n: 'Coût de production / unité', d: 'PCSU moyen par boîte (référentiel)', f: 'Σ(boîtes × PCSU) / boîtes', c: '↓ mieux', dir: 'down', s: null, v: coutUnite.value, u: ' DA', fr: 'Mensuel' },
    { n: 'Productivité main-d\'œuvre', d: 'Sortie par personne (effectif)', f: 'Boîtes fabriquées / effectif moyen', c: '↑ mieux', dir: 'info', s: null, v: (eff.effMoyen && prodBase) ? prodBase / eff.effMoyen : null, u: '', fr: 'Hebdo/Mens.' },
    { n: 'Équilibrage de ligne', d: 'Équilibre du flux entre phases (cadences)', f: 'Σ temps/boîte / (nb phases × goulot) ×100', c: '≥ 90%', dir: 'up', s: 90, v: equilibrageLigne.value, u: '%', fr: 'Hebdo' }
  ]
  return rows.map(r => ({ ...r, st: statutKpi(r.v, r.dir, r.s) }))
})
const kpiSummary = computed(() => {
  const k = kpisStd.value
  const ok = k.filter(x => x.st === 'ok').length
  const warn = k.filter(x => x.st === 'warn').length
  const bad = k.filter(x => x.st === 'bad').length
  const info = k.filter(x => x.st === 'info').length
  const na = k.filter(x => x.st === 'na').length
  const top = k.filter(x => x.st === 'bad').concat(k.filter(x => x.st === 'warn')).slice(0, 5)
  return { ok, warn, bad, info, na, total: k.length, top }
})
const pctSeg = (n) => (kpiSummary.value.total ? (n / kpiSummary.value.total * 100) : 0) + '%'

// --- Présentation graphique des KPI ---
const detailOuvert = ref(false)
// Jauges : indicateurs évalués (avec cible et valeur) ; Tuiles : valeurs suivies (mesuré)
const kpisEval = computed(() => kpisStd.value.filter(k => k.st === 'ok' || k.st === 'warn' || k.st === 'bad'))
const kpisMesure = computed(() => kpisStd.value.filter(k => k.st === 'info'))
function kpiColor(st) { return st === 'ok' ? '#16a34a' : st === 'warn' ? '#f59e0b' : st === 'bad' ? '#dc2626' : '#94a3b8' }
// Remplissage de l'anneau (0–100) : valeur directe si « plus haut = mieux », sinon rapportée à 3× la cible
function kpiFill(k) {
  if (k.v == null) return 0
  if (k.dir === 'down') return Math.max(3, Math.min(100, k.s ? k.v / (k.s * 3) * 100 : k.v))
  return Math.max(3, Math.min(100, k.v))
}
// Icônes (tracé SVG + couleur d'accent) pour les tuiles « valeurs suivies »
const TILE_ICONS = {
  'Débit': { c: '#14b8a6', p: '<line x1="6" y1="20" x2="6" y2="12"/><line x1="12" y1="20" x2="12" y2="5"/><line x1="18" y1="20" x2="18" y2="14"/>' },
  'Temps de cycle': { c: '#0ea5e9', p: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/>' },
  'Takt': { c: '#0ea5e9', p: '<circle cx="12" cy="13" r="8"/><line x1="12" y1="13" x2="12" y2="9"/><line x1="9" y1="2" x2="15" y2="2"/>' },
  'Délai': { c: '#6366f1', p: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/>' },
  'réglage': { c: '#a855f7', p: '<path d="M14.5 6.5a3.5 3.5 0 0 1-4.6 4.6L5 16l3 3 4.9-4.9a3.5 3.5 0 0 0 4.6-4.6l-2 2-2-2z"/>' },
  'Changement': { c: '#a855f7', p: '<polyline points="16 3 20 7 16 11"/><line x1="20" y1="7" x2="7" y2="7"/><polyline points="8 13 4 17 8 21"/><line x1="4" y1="17" x2="17" y2="17"/>' },
  'par équipe': { c: '#f59e0b', p: '<circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 6a3 3 0 0 1 0 6"/><path d="M19.5 20a5.5 5.5 0 0 0-3-5"/>' },
  'Productivité': { c: '#f59e0b', p: '<circle cx="12" cy="8" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0"/>' },
  'Coût': { c: '#10b981', p: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>' }
}
function tileIcon(name) { for (const k in TILE_ICONS) if (name.includes(k)) return TILE_ICONS[k]; return { c: '#64748b', p: '<circle cx="12" cy="12" r="9"/>' } }
// Nombre de colonnes équilibré : répartit les éléments en lignes égales (14 → 7+7, 9 → 5+4…)
function balancedCols(n, max) { if (n <= 1) return 1; const rows = Math.ceil(n / max); return Math.ceil(n / rows) }
const gaugeCols = computed(() => balancedCols(kpisEval.value.length, 8))
const tileCols = computed(() => balancedCols(kpisMesure.value.length, 5))
</script>

<style scoped>
.tb { padding: 26px 34px 50px; max-width: 1600px; margin: 0 auto; color: #1e293b; font-family: 'Segoe UI', system-ui, sans-serif; }
.tb-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 22px; }
.tb-title { margin: 0; font-size: 24px; font-weight: 800; color: #0f172a; }
.tb-sub { margin: 4px 0 0; font-size: 13px; color: #64748b; }
.tb-year { display: flex; align-items: center; gap: 8px; }
.tb-year label { font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #94a3b8; }
.tb-year select { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 9px; font: inherit; font-size: 14px; font-weight: 600; }

.tb-tabs { display: flex; gap: 8px; margin-bottom: 18px; }
.tb-tab { flex: 1; background: #fff; border: 1.5px solid #e2e8f0; border-radius: 12px; font: inherit; font-size: 15px; font-weight: 700; padding: 13px; cursor: pointer; color: #64748b; transition: all .18s ease; }
.tb-tab.fab.on { background: #14b8a6; border-color: #14b8a6; color: #fff; box-shadow: 0 8px 20px rgba(20,184,166,.28); }
.tb-tab.cond.on { background: #0ea5e9; border-color: #0ea5e9; color: #fff; box-shadow: 0 8px 20px rgba(14,165,233,.28); }

.tb-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 20px; }
.tb-kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 15px 18px; display: flex; flex-direction: column; gap: 4px; box-shadow: 0 4px 14px rgba(30,41,59,.05); }
.k-lbl { font-size: 12px; font-weight: 700; color: #64748b; }
.k-val { font-size: 22px; font-weight: 800; color: #0f172a; }
.tb-mois-lbl { font-size: 12px; font-weight: 800; color: #0f766e; margin: 4px 0 10px; text-transform: uppercase; letter-spacing: 0.5px; }
.tb-kpi-m { border-left: 3px solid #14b8a6; }

.tb-grp { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
.grp-lbl { font-size: 12px; font-weight: 700; color: #64748b; margin-right: 4px; }
.tb-grp button { background: #fff; border: 1px solid #cbd5e1; border-radius: 999px; font: inherit; font-size: 12.5px; font-weight: 600; padding: 7px 15px; cursor: pointer; color: #475569; }
.tb-grp button.on { background: #0f172a; border-color: #0f172a; color: #fff; }

.tb-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 6px 6px; box-shadow: 0 8px 22px rgba(30,41,59,.06); overflow: hidden; }
.tb-empty { padding: 40px; text-align: center; color: #94a3b8; font-size: 14px; }
.tb-table { width: 100%; border-collapse: collapse; }
.tb-table thead th { text-align: left; font-size: 11.5px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; color: #64748b; padding: 12px 16px; border-bottom: 2px solid #f1f5f9; }
.tb-table thead th.num { text-align: right; }
.tb-table tbody td { padding: 11px 16px; font-size: 13.5px; border-bottom: 1px solid #f5f7fa; }
.tb-table tbody tr:hover td { background: #f8fafc; }
.g-nom { font-weight: 600; color: #1e293b; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.ca { font-weight: 700; color: #0f766e; }
.taux { font-weight: 800; }
.taux.ok { color: #15803d; }
.taux.bas { color: #dc2626; }
.muted { color: #cbd5e1; }
.k-val.v-bas { color: #dc2626; }
.w-bar { width: 150px; }
.bar { display: block; height: 8px; background: #eef2f7; border-radius: 4px; overflow: hidden; }
.bar-in { display: block; height: 100%; border-radius: 4px; background: linear-gradient(90deg, #14b8a6, #0ea5e9); }
.tb-table tfoot .tot td { font-weight: 800; padding: 13px 16px; border-top: 2px solid #e2e8f0; background: #f8fafc; }

/* Pilotage — graphiques de suivi d'activité */
/* Scorecard — vue globale des KPIs */
.sc-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 14px; }
.sc { position: relative; background: #fff; border: 1px solid #e8edf3; border-radius: 16px; padding: 13px 15px 11px; box-shadow: 0 6px 18px rgba(30,41,59,.05); min-width: 0; min-height: 116px; display: flex; flex-direction: column; }
.sc::before { content: ''; position: absolute; left: 15px; right: 15px; top: 0; height: 3px; border-radius: 0 0 3px 3px; background: #cbd5e1; }
.sc.teal::before { background: #14b8a6; }
.sc.sky::before { background: #0ea5e9; }
.sc.amber::before { background: #f59e0b; }
.sc.violet::before { background: #a855f7; }
.sc-l { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .03em; margin-bottom: 6px; }
.sc-u { color: #94a3b8; font-weight: 600; text-transform: none; letter-spacing: 0; }
.sc-v { font-size: 26px; font-weight: 800; color: #0f172a; font-variant-numeric: tabular-nums; line-height: 1.05; letter-spacing: -.01em; }
.sc-v-ca { font-size: 20px; }
.sc-v.c-ok { color: #15803d; } .sc-v.c-warn { color: #d97706; }
.sc-s { font-size: 11px; color: #64748b; font-weight: 600; margin-top: auto; padding-top: 6px; line-height: 1.45; }
.sc-s b { color: #0f172a; font-variant-numeric: tabular-nums; }
.sc-s b.c-bad { color: #dc2626; } .sc-s b.c-warn { color: #d97706; }
.sc-spark { width: 100%; height: 26px; display: block; margin: 5px 0 1px; }
.sp-line { fill: none; stroke-width: 1.6; }
.sp-line.teal { stroke: #14b8a6; } .sp-line.sky { stroke: #0ea5e9; }
.sp-area { stroke: none; opacity: .13; }
.sp-area.teal { fill: #14b8a6; } .sp-area.sky { fill: #0ea5e9; }
.sc-rw { display: flex; align-items: center; gap: 12px; margin-top: 2px; }
.sc-ring { width: 58px; height: 58px; flex: none; }
.sc-ring .rg-bg { fill: none; stroke: #eef2f7; stroke-width: 3.2; }
.sc-ring .rg-fg { fill: none; stroke-width: 3.2; stroke-linecap: round; }
.sc-ring .rg-v { font-size: 9px; font-weight: 800; text-anchor: middle; font-variant-numeric: tabular-nums; }
.sc-rw .sc-s { margin-top: 0; padding-top: 0; }
@media (max-width: 1100px) { .sc-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 560px) { .sc-grid { grid-template-columns: 1fr; } }
/* Toggle détail */
.tb-detail-toggle { margin-left: auto; background: #f1f5f9; border: 1px solid #e2e8f0; color: #475569; border-radius: 999px; padding: 6px 14px; font-size: 12.5px; font-weight: 700; cursor: pointer; }
.tb-detail-toggle:hover { background: #e2e8f0; }

/* Indicateurs KPI standard */
.kpi-sec { margin: 6px 0 18px; }
.kpi-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
/* Présentation graphique : jauges (indicateurs évalués) */
.kpi-gauges { display: grid; grid-template-columns: repeat(var(--gcols, 7), minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
.kg-card { background: #fff; border: 1px solid #e8edf3; border-radius: 14px; padding: 12px 8px 10px; text-align: center; box-shadow: 0 4px 14px rgba(30, 41, 59, .05); display: flex; flex-direction: column; align-items: center; }
.kg-ring { width: 74px; height: 74px; }
.kg-track { fill: none; stroke: #eef2f7; stroke-width: 3.4; }
.kg-fill { fill: none; stroke-width: 3.4; stroke-linecap: round; transition: stroke-dasharray .6s ease; }
.kg-val { font-size: 8.6px; font-weight: 800; text-anchor: middle; font-variant-numeric: tabular-nums; }
.kg-name { font-size: 11px; font-weight: 700; color: #334155; margin-top: 7px; line-height: 1.2; }
.kg-cible { font-size: 10px; color: #94a3b8; margin-top: 2px; }
/* Présentation graphique : tuiles (valeurs suivies) */
.kpi-tiles { display: grid; grid-template-columns: repeat(var(--tcols, 5), minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
.kt-card { background: #fff; border: 1px solid #e8edf3; border-left: 3px solid var(--a, #64748b); border-radius: 12px; padding: 11px 13px; display: flex; align-items: center; gap: 11px; box-shadow: 0 4px 14px rgba(30, 41, 59, .05); }
.arrets-box { background: #fff; border: 1px solid #e8edf3; border-radius: 14px; padding: 13px 16px; margin-bottom: 14px; box-shadow: 0 4px 14px rgba(30, 41, 59, .05); }
.arrets-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.arrets-t { font-size: 13px; font-weight: 800; color: #0f172a; }
.arrets-sub { font-size: 11px; color: #94a3b8; font-weight: 600; }
.arrets-list { display: flex; flex-direction: column; gap: 6px; }
.arret-row { display: grid; grid-template-columns: 160px 1fr 54px 64px; align-items: center; gap: 10px; font-size: 12px; }
.arret-lbl { color: #475569; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.arret-top .arret-lbl { color: #b91c1c; font-weight: 800; }
.arret-bar { height: 10px; background: #f1f5f9; border-radius: 5px; overflow: hidden; }
.arret-bar > span { display: block; height: 100%; background: #f59e0b; border-radius: 5px; }
.arret-top .arret-bar > span { background: #ef4444; }
.arret-pct { text-align: right; font-weight: 800; color: #334155; font-variant-numeric: tabular-nums; }
.arret-h { text-align: right; color: #94a3b8; font-variant-numeric: tabular-nums; }
@media (max-width: 560px) { .arret-row { grid-template-columns: 104px 1fr 46px; } .arret-h { display: none; } }
.kt-ic { width: 26px; height: 26px; flex: none; color: var(--a, #64748b); fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
.kt-txt { min-width: 0; }
.kt-v { font-size: 17px; font-weight: 800; color: #0f172a; font-variant-numeric: tabular-nums; line-height: 1.1; }
.kt-n { font-size: 11px; color: #64748b; font-weight: 600; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kpi-detail-btn { background: #f1f5f9; border: 1px solid #e2e8f0; color: #475569; border-radius: 999px; padding: 6px 14px; font-size: 12.5px; font-weight: 700; cursor: pointer; margin-bottom: 12px; }
.kpi-detail-btn:hover { background: #e9eef5; }
@media (max-width: 900px) { .kpi-gauges { grid-template-columns: repeat(4, minmax(0, 1fr)); } .kpi-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 560px) { .kpi-gauges { grid-template-columns: repeat(3, minmax(0, 1fr)); } .kpi-tiles { grid-template-columns: repeat(1, minmax(0, 1fr)); } }
.kpi-titre { font-size: 15px; font-weight: 800; color: #0f172a; }
.kpi-u { color: #94a3b8; font-weight: 600; font-size: 13px; }
.kpi-sum { display: inline-flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.kpi-chip { font-size: 11.5px; font-weight: 800; padding: 3px 11px; border-radius: 999px; }
.kpi-chip.ok { background: #dcfce7; color: #15803d; } .kpi-chip.warn { background: #fef3c7; color: #b45309; } .kpi-chip.bad { background: #fee2e2; color: #b91c1c; } .kpi-chip.info { background: #e2e8f0; color: #475569; } .kpi-chip.na { background: #f1f5f9; color: #64748b; }
.kpi-panels { display: grid; grid-template-columns: 1.3fr 1fr; gap: 14px; margin-bottom: 14px; }
.kpi-panel { background: #fff; border: 1px solid #e8edf3; border-radius: 14px; padding: 13px 15px; box-shadow: 0 6px 18px rgba(30,41,59,.05); }
.kp-t { font-size: 12px; font-weight: 800; color: #334155; text-transform: uppercase; letter-spacing: .03em; margin-bottom: 10px; }
.kp-bar { display: flex; height: 16px; border-radius: 8px; overflow: hidden; background: #eef2f7; }
.kp-bar .seg { height: 100%; }
.kp-bar .seg.ok { background: #16a34a; } .kp-bar .seg.warn { background: #f59e0b; } .kp-bar .seg.bad { background: #dc2626; } .kp-bar .seg.info { background: #94a3b8; } .kp-bar .seg.na { background: #cbd5e1; }
.kp-leg { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 10px; font-size: 11.5px; color: #64748b; font-weight: 600; }
.kp-leg span { display: inline-flex; align-items: center; gap: 5px; }
.kp-leg i { width: 10px; height: 10px; border-radius: 3px; }
.kp-leg i.ok { background: #16a34a; } .kp-leg i.warn { background: #f59e0b; } .kp-leg i.bad { background: #dc2626; } .kp-leg i.info { background: #94a3b8; } .kp-leg i.na { background: #cbd5e1; }
.kp-leg b { color: #0f172a; }
.kp-top { display: flex; align-items: center; gap: 9px; padding: 5px 0; border-bottom: 1px solid #f1f5f9; font-size: 12.5px; }
.kp-top:last-child { border-bottom: 0; }
.kp-rank { width: 19px; height: 19px; border-radius: 50%; background: #fee2e2; color: #b91c1c; font-size: 11px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; flex: none; }
.kp-name { font-weight: 700; color: #334155; flex: 1; }
.kp-top .kst { font-size: 11px; }
.kp-empty { font-size: 12.5px; color: #15803d; font-weight: 700; padding: 8px 0; }
.kpi-wrap { overflow-x: auto; background: #fff; border: 1px solid #e8edf3; border-radius: 14px; box-shadow: 0 6px 18px rgba(30,41,59,.05); }
.kpi-tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.kpi-tbl th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: .03em; color: #64748b; font-weight: 700; padding: 10px 11px; background: #f8fafc; border-bottom: 1px solid #e8edf3; white-space: nowrap; }
.kpi-tbl th.c, .kpi-tbl td.c { text-align: center; }
.kpi-tbl th.num, .kpi-tbl td.num { text-align: center; width: 30px; color: #94a3b8; }
.kpi-tbl td { padding: 9px 11px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
.kpi-tbl tbody tr:last-child td { border-bottom: 0; }
.kpi-tbl .kn b { color: #0f172a; font-weight: 700; display: block; }
.kpi-tbl .kn .kd { color: #94a3b8; font-size: 11px; font-weight: 500; }
.kpi-tbl .kf { color: #64748b; font-size: 11.5px; }
.kpi-tbl .kc { color: #475569; font-weight: 700; white-space: nowrap; }
.kpi-tbl .kv { font-weight: 800; color: #0f172a; font-variant-numeric: tabular-nums; white-space: nowrap; }
.kpi-tbl .kfr { color: #94a3b8; font-size: 11px; white-space: nowrap; }
.kpi-tbl .row-ok .kv { color: #15803d; } .kpi-tbl .row-bad { background: #fff7f7; } .kpi-tbl .row-bad .kv { color: #b91c1c; } .kpi-tbl .row-warn .kv { color: #b45309; }
.kst { display: inline-block; font-size: 10.5px; font-weight: 800; padding: 3px 10px; border-radius: 999px; white-space: nowrap; }
.kst.ok { background: #dcfce7; color: #15803d; } .kst.warn { background: #fef3c7; color: #b45309; } .kst.bad { background: #fee2e2; color: #b91c1c; } .kst.na { background: #f1f5f9; color: #94a3b8; } .kst.info { background: #eef2f7; color: #64748b; }
.kpi-note { font-size: 11px; color: #94a3b8; margin: 9px 2px 0; line-height: 1.5; }
@media (max-width: 760px) { .kpi-panels { grid-template-columns: 1fr; } }

.pilot { margin: 2px 0 18px; }
.pilot-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.pilot-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 14px 16px; box-shadow: 0 8px 22px rgba(30,41,59,.06); min-width: 0; }
.pilot-card.wide { grid-column: 1 / -1; }
.pilot-h { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.pilot-t { font-size: 13px; font-weight: 800; color: #0f172a; }
.pilot-u { color: #94a3b8; font-weight: 600; font-size: 11.5px; }
.pilot-leg { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 700; color: #64748b; }
.pilot-leg .lg { width: 11px; height: 11px; border-radius: 3px; display: inline-block; }
.pilot-leg .lg.b-real { margin-left: 8px; }
.pilot-leg .lg.b-plan { background: #cbd5e1; }
.pilot-leg .lg.b-real { background: #14b8a6; }
.pilot-svg { width: 100%; height: auto; display: block; }
.pilot-svg .grid { stroke: #eef2f7; stroke-width: 1; }
.pilot-svg .b-plan { fill: #cbd5e1; }
.pilot-svg .b-real { fill: #14b8a6; }
.pilot-svg .b-ca { fill: #0ea5e9; }
.pilot-svg .x-lbl { fill: #94a3b8; font-size: 11px; font-weight: 600; text-anchor: middle; }
.top-list { display: flex; flex-direction: column; gap: 9px; padding-top: 2px; }
.top-row { display: grid; grid-template-columns: 116px 1fr auto; align-items: center; gap: 10px; font-size: 12.5px; }
.top-nom { font-weight: 600; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.top-bar { height: 10px; background: #eef2f7; border-radius: 5px; overflow: hidden; }
.top-in { display: block; height: 100%; border-radius: 5px; background: linear-gradient(90deg, #14b8a6, #0ea5e9); }
.top-val { font-weight: 800; color: #0f172a; font-variant-numeric: tabular-nums; white-space: nowrap; }
.top-taux { font-size: 10.5px; font-weight: 800; margin-left: 6px; }
.top-taux.ok { color: #15803d; } .top-taux.bas { color: #dc2626; }
@media (max-width: 820px) { .pilot-grid { grid-template-columns: 1fr; } }

/* Décisions & KPIs transverses */
.decisions { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 14px; padding: 12px 15px; margin-bottom: 14px; }
.dec-h { font-size: 12.5px; font-weight: 800; color: #b45309; margin-bottom: 9px; text-transform: uppercase; letter-spacing: .4px; }
.dec-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 8px; }
.dec-item { display: flex; flex-direction: column; gap: 2px; background: #fff; border: 1px solid #fde4c8; border-left-width: 4px; border-radius: 10px; padding: 8px 12px; }
.dec-item.high { border-left-color: #dc2626; }
.dec-item.mid { border-left-color: #f59e0b; }
.dec-t { font-size: 13px; font-weight: 800; color: #0f172a; }
.dec-d { font-size: 11.5px; color: #64748b; font-weight: 600; }
.trans-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 16px; }
.trans-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 13px 15px; box-shadow: 0 8px 22px rgba(30,41,59,.06); }
.trans-dom { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 10px; padding-left: 9px; border-left: 4px solid #94a3b8; }
.trans-dom.q { border-left-color: #a855f7; color: #7c3aed; }
.trans-dom.e { border-left-color: #0ea5e9; color: #0369a1; }
.trans-dom.r { border-left-color: #14b8a6; color: #0f766e; }
.trans-dom.p { border-left-color: #f59e0b; color: #b45309; }
.trans-kpis { display: flex; gap: 12px; flex-wrap: wrap; }
.tk { display: flex; flex-direction: column; gap: 1px; min-width: 58px; }
.tk-v { font-size: 20px; font-weight: 800; color: #0f172a; font-variant-numeric: tabular-nums; line-height: 1.1; }
.tk-v.ok { color: #15803d; } .tk-v.warn { color: #d97706; } .tk-v.bad { color: #dc2626; }
.tk-l { font-size: 10.5px; color: #64748b; font-weight: 600; }
@media (max-width: 1100px) { .trans-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 560px) { .trans-grid { grid-template-columns: 1fr; } }

@media (max-width: 820px) {
  .tb { padding: 18px; } .tb-kpis { grid-template-columns: repeat(2, 1fr); }
  .w-bar { display: none; }
}
/* Compact */
.tb { padding: 12px 20px 20px; }
.tb-head { margin-bottom: 10px; }
.tb-title { font-size: 18px; }
.tb-sub { font-size: 11px; margin-top: 2px; }
.tb-year select { padding: 6px 10px; font-size: 13px; }
.tb-tabs { gap: 6px; margin-bottom: 10px; }
.tb-tab { font-size: 13px; padding: 9px; }
.tb-kpis { gap: 10px; margin-bottom: 12px; }
.tb-kpi { padding: 10px 14px; }
.tb-kpi .k-val, .tb-kpi b, .tb-kpi strong { font-size: 19px; }
.tb-grp { margin-bottom: 10px; }
.tb-grp button { font-size: 11.5px; padding: 5px 12px; }
.tb-table thead th { padding: 7px 12px; font-size: 10.5px; }
.tb-table tbody td { padding: 6px 12px; font-size: 12px; }
.tb-table tfoot .tot td { padding: 7px 12px; }
.tb-empty { padding: 26px; font-size: 13px; }
/* Ultra compact */
.tb { padding: 8px 14px 14px; }
.tb-title { font-size: 15px; }
.tb-sub { display: none; }
.tb-head { margin-bottom: 6px; }
.tb-year select { padding: 5px 8px; font-size: 12px; }
.tb-tabs { gap: 6px; margin-bottom: 8px; }
.tb-tab { font-size: 12px; padding: 7px; border-radius: 9px; }
.tb-kpis { gap: 8px; margin-bottom: 8px; }
.tb-kpi { padding: 7px 11px; border-radius: 11px; gap: 2px; }
.tb-kpi .k-val { font-size: 16px; }
.tb-kpi .k-lbl { font-size: 9.5px; }
.tb-grp { margin-bottom: 7px; }
.tb-grp button { font-size: 10.5px; padding: 4px 10px; }
.tb-table thead th { padding: 5px 10px; font-size: 10px; }
.tb-table tbody td { padding: 4px 10px; font-size: 11px; }
.tb-table tfoot .tot td { padding: 5px 10px; }
.tb-empty { padding: 18px; font-size: 12px; }
.tb { zoom: 0.75; }
</style>
