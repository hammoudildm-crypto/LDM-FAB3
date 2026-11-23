<template>
  <div class="pe-page" :class="{ 'pe-pres': presentation }">
    <div class="pe-head">
      <h1>Planning des équipements — Fabrication<span v-if="presentation" class="pe-pres-sem"> · {{ vuePres === 'semaine' ? libelleSemaineVue : 'plan complet' }}</span></h1>
      <div class="pe-head-btns">
        <span v-if="lotSuivi" class="pe-suivi-chip">🔎 Lot {{ lotSuiviLib }} suivi sur toutes ses phases <button @click="lotSuivi = null" title="Arrêter le suivi">✕</button></span>
        <div v-if="presentation" class="pe-wk">
          <button type="button" class="pe-wk-btn" :class="{ on: vuePres === 'semaine' }" @click="choisirVue('semaine')">Semaine</button>
          <button type="button" class="pe-wk-btn" :class="{ on: vuePres === 'tout' }" @click="choisirVue('tout')">Plan complet</button>
          <template v-if="vuePres === 'semaine'">
            <button type="button" class="pe-wk-nav" :disabled="semaineIdx <= 0" @click="changerSemaine(-1)" title="Semaine précédente">◀</button>
            <span class="pe-wk-lbl">{{ semaineIdx + 1 }} / {{ nbSemaines }}</span>
            <button type="button" class="pe-wk-nav" :disabled="semaineIdx >= nbSemaines - 1" @click="changerSemaine(1)" title="Semaine suivante">▶</button>
          </template>
        </div>
        <button v-if="!presentation" type="button" class="pe-pdf-btn" @click="demarrerBoucle" title="Écran atelier : tous les équipements de fabrication en défilement automatique">⟳ Boucle</button>
        <button type="button" class="pe-pdf-btn" @click="exporterPDF" title="Exporter la vue affichée en PDF A3 paysage">🖨 PDF A3</button>
        <button type="button" class="pe-pres-btn" :class="{ on: presentation }" @click="basculerPresentation">{{ presentation ? '✕ Quitter la présentation' : '▶ Présentation' }}</button>
      </div>
    </div>

    <!-- Sélection de la phase (présentation) : toutes les phases de fabrication -->
    <div v-if="presentation" class="pe-phases">
      <button type="button" class="pe-ph" :class="{ on: !filtrePhase }" @click="choisirPhasePres('')">Toutes<span>{{ phasesPres.reduce((t, x) => t + x.n, 0) }} équip.</span></button>
      <button v-for="ph in phasesPres" :key="ph.k" type="button" class="pe-ph" :class="['ph' + ph.k, { on: String(filtrePhase) === String(ph.k), vide: !ph.n }]" :disabled="!ph.n" @click="choisirPhasePres(ph.k)" :title="ph.n ? ph.n + ' équipement(s) — ' + ph.nPlan + ' planifié(s)' : 'Aucun équipement de cette phase'">
        <b>{{ ph.k }}</b> {{ ph.l }}<span>{{ ph.n }} équip.<template v-if="ph.n"> · {{ ph.nPlan }} planifié{{ ph.nPlan > 1 ? 's' : '' }}</template></span>
      </button>
    </div>

    <!-- Bandeau KPI (présentation) -->
    <div v-if="presentation && planning.length" class="pe-kpis">
      <div class="pe-kpi"><span class="pe-kpi-l">Lots planifiés</span><span class="pe-kpi-v">{{ totalLots }}</span></div>
      <div class="pe-kpi pe-kpi-warn"><span class="pe-kpi-l">Goulot</span><span class="pe-kpi-v">{{ goulotLib }}</span><span v-if="goulotNom" class="pe-kpi-s">{{ goulotNom }}</span></div>
      <div class="pe-kpi pe-kpi-ok"><span class="pe-kpi-l">Lots en cours</span><span class="pe-kpi-v">{{ nbEnCours }}</span></div>
      <div class="pe-kpi"><span class="pe-kpi-l">Fin du plan</span><span class="pe-kpi-v">{{ fmtJH(finGlobale) }}</span></div>
    </div>

    <p v-if="erreur" class="alert">{{ erreur }}</p>
    <p v-if="panierErreur" class="alert">{{ panierErreur }}</p>
    <p v-if="msgDeplacement" class="pe-move-msg" :class="{ ko: msgDeplacement.startsWith('⚠') }">{{ msgDeplacement }}</p>
    <p v-if="retiresAuto" class="pe-clean-notice">✓ {{ retiresAuto }} lot(s) terminé(s) retiré(s) automatiquement du planning. <button class="pe-clean-x" @click="retiresAuto = 0">×</button></p>


    <!-- Légende -->
    <div class="legende">
      <span class="lg"><i class="sw sw-lot"></i>Lot (couleur = produit)</span>
      <span class="lg"><i class="sw sw-gen"></i>Nettoyage général (NG)</span>
      <span class="lg"><i class="sw sw-part"></i>Nettoyage partiel (NP)</span>
      <span class="lg"><i class="sw sw-nuit"></i>OFF (nuit 22h–06h / week-end chômé)</span>
      <template v-if="presentation"><span class="lg"><i class="sw sw-shm"></i>Matin 06–14</span><span class="lg"><i class="sw sw-sha"></i>Après-midi 14–22</span><span class="lg"><i class="sw sw-shn"></i>Nuit 22–06</span></template>
      <span class="lg"><i class="sw sw-termine"></i>✓ Terminé (dates réelles)</span>
      <span class="lg"><i class="sw sw-cours"></i>▶ En cours (avancement %)</span>
      <span class="lg"><i class="sw sw-plan"></i>Planifié</span>
    </div>
    <div v-if="produitsPlanning.length" class="lg-prods">
      <span class="lg-prods-t">Produits ({{ produitsPlanning.length }}) :</span>
      <button v-for="p in produitsLegende" :key="p.code" type="button" class="lg-prod"
              :class="{ on: prodFocus === p.code, off: prodFocus && prodFocus !== p.code }"
              :style="{ '--c': p.c.bg, '--cd': p.c.bd }"
              :title="p.code + ' — ' + p.designation + ' — ' + p.n + ' lot(s) · cliquer pour mettre en évidence'"
              @click="prodFocus = prodFocus === p.code ? '' : p.code">
        <i></i>{{ p.designation || p.code }} <span class="lg-prod-n">{{ p.n }}</span>
      </button>
      <button v-if="produitsPlanning.length > NB_PROD_LEG" type="button" class="lg-prod-plus" @click="legOuverte = !legOuverte">{{ legOuverte ? '▲ réduire' : '+ ' + (produitsPlanning.length - NB_PROD_LEG) + ' autres ▾' }}</button>
      <button v-if="prodFocus" type="button" class="lg-prod-reset" @click="prodFocus = ''">Tout afficher</button>
    </div>

    <section v-if="!chargement && planning.length && !presentation" class="card recap">
      <div class="synth-head">
        <h3>Synthèse</h3>
        <div class="occ-per">
          <span class="occ-per-t">Occupation sur :</span>
          <button type="button" class="pe-wk-btn" :class="{ on: periodeOcc === 'semaine' }" @click="choisirPeriodeOcc('semaine')">Semaine</button>
          <button type="button" class="pe-wk-btn" :class="{ on: periodeOcc === 'mois' }" @click="choisirPeriodeOcc('mois')">Mois</button>
          <button type="button" class="pe-wk-btn" :class="{ on: periodeOcc === 'plan' }" @click="choisirPeriodeOcc('plan')">Plan complet</button>
          <template v-if="periodeOcc !== 'plan'">
            <button type="button" class="pe-wk-nav" @click="occIdx = occIdxEff - 1" :disabled="occIdxEff <= occIdxMin" title="Période précédente">◀</button>
            <button type="button" class="pe-wk-nav" @click="occIdx = occIdxEff + 1" :disabled="occIdxEff >= occIdxMax" title="Période suivante">▶</button>
          </template>
          <span class="occ-per-lib">{{ periodeOccLib }}</span>
          <span class="occ-leg"><i class="so-prod"></i>production <i class="so-nett"></i>nettoyage</span>
        </div>
      </div>
      <div class="recap-grid">
        <div class="rc"><span class="rc-v">{{ planning.length }}</span><span class="rc-l">Équipements planifiés</span></div>
        <div class="rc"><span class="rc-v">{{ totalLots }}</span><span class="rc-l">Lots ordonnancés</span></div>
        <div class="rc"><span class="rc-v">{{ totalNG }}</span><span class="rc-l">Nettoyages généraux</span></div>
        <div class="rc"><span class="rc-v">{{ totalNP }}</span><span class="rc-l">Nettoyages partiels</span></div>
        <div class="rc"><span class="rc-v">{{ totalMP }}</span><span class="rc-l">Arrêt MP (h)</span></div>
        <div class="rc"><span class="rc-v">{{ totalMC }}</span><span class="rc-l">Arrêt MC (h)</span></div>
        <div class="rc"><span class="rc-v">{{ totalAT }}</span><span class="rc-l">Arrêt AT (h)</span></div>
        <div class="rc"><span class="rc-v">{{ totalAU }}</span><span class="rc-l">Arrêt autre (h)</span></div>
        <div class="rc"><span class="rc-v">{{ fmtJH(finGlobale) }}</span><span class="rc-l">Fin la plus tardive</span></div>
      </div>
      <button v-if="synthEquip.length" type="button" class="synth-tgl" @click="synthOuverte = !synthOuverte">{{ synthOuverte ? '▲ Masquer le détail par équipement' : '▾ Détail par équipement (' + synthEquip.length + ')' }}<span v-if="!synthOuverte && goulotId" class="synth-tgl-gl"> · goulot : <b>{{ goulotLib }}</b></span></button>
      <div class="synth-eq" v-if="synthEquip.length && synthOuverte">
        <table class="synth-tbl">
          <thead><tr><th>Équipement</th><th class="right">Lots</th><th class="right">NG</th><th class="right">NP</th><th class="right">MP</th><th class="right">MC</th><th class="right">AT</th><th class="right">Autre</th><th>Occupation <span class="so-per">({{ periodeOccLib }})</span></th><th>Régime</th><th class="right">Fin</th></tr></thead>
          <tbody>
            <tr v-for="e in synthEquip" :key="e.id" :class="{ 'synth-goulot': String(e.id) === String(goulotId) }">
              <td>{{ e.code }} <span class="synth-nom">{{ e.nom }}</span></td>
              <td class="right">{{ e.lots }}</td>
              <td class="right">{{ e.ng }}</td>
              <td class="right">{{ e.np }}</td>
              <td class="right">{{ e.mp || '—' }}</td>
              <td class="right">{{ e.mc || '—' }}</td>
              <td class="right">{{ e.at || '—' }}</td>
              <td class="right">{{ e.au || '—' }}</td>
              <td class="synth-occ-cell" :title="occTitre(e.id)">
                <span class="so-bar so-bar2"><span class="so-prod" :style="{ width: Math.min(100, (chargeMap[e.id] || {}).prodPct || 0) + '%' }"></span><span class="so-nett" :style="{ width: Math.max(0, Math.min(100 - ((chargeMap[e.id] || {}).prodPct || 0), (chargeMap[e.id] || {}).nettPct || 0)) + '%' }"></span></span>
                <b class="so-pct" :class="'t-' + chargeClass((chargeMap[e.id] || {}).occ || 0)">{{ (chargeMap[e.id] || {}).occ || 0 }}%</b>
                <span class="so-det">prod. {{ (chargeMap[e.id] || {}).prodPct || 0 }}% · nett. {{ (chargeMap[e.id] || {}).nettPct || 0 }}%</span>
                <span v-if="String(e.id) === String(goulotId)" class="so-gl">goulot</span>
              </td>
              <td>{{ e.regime === '2x8' ? '2×8' : '3×8' }}</td>
              <td class="right nowrap">{{ fmtJH(e.fin) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div class="pe-body">
    <section class="card params params-side">
      <div class="p-grp"><label>Départ</label><div class="dep-row"><input type="date" v-model="dateDepart" /><button type="button" class="vue-btn" @click="dateDepart = iso(new Date())">Auj.</button></div></div>
      <div class="p-grp"><label>Affichage</label>
        <div class="vue-btns">
          <button type="button" class="vue-btn" :class="{ on: pxH >= 15 }" @click="pxH = 20">Jour</button>
          <button type="button" class="vue-btn" :class="{ on: pxH >= 2.5 && pxH < 15 }" @click="pxH = 3.5">Semaine</button>
          <button type="button" class="vue-btn" :class="{ on: pxH < 2.5 }" @click="pxH = 0.8">Mois</button>
        </div>
      </div>
      <div class="p-grp"><label>Zoom<input type="range" min="0.5" max="24" step="0.5" v-model.number="pxH" /></label></div>
      <div class="p-grp"><label>Filtre<input type="text" v-model="filtreTexte" placeholder="code / nom…" /></label></div>
      <div class="p-grp"><label>Phase
        <select v-model="filtrePhase">
          <option value="">Toutes</option>
          <option value="1">Pesée</option>
          <option value="2">Granulation</option>
          <option value="3">Séchage</option>
          <option value="4">Mélange</option>
          <option value="5">Compression</option>
          <option value="6">Remplissage</option>
          <option value="7">Pelliculage</option>
        </select>
      </label></div>
      <div class="p-grp"><label class="chk-inline"><input type="checkbox" v-model="filtreAvecPlan" /> Avec planning</label></div>
      <div class="p-grp">
        <button type="button" class="vue-btn ctrl-btn" :class="{ ko: nbCtrl.err, wa: !nbCtrl.err && nbCtrl.warn }" @click="ctrlOuvert = true" title="Cadences en unités/h, fiches produit incomplètes, durées par défaut ou anormales">🔎 Contrôle des cadences<span v-if="nbCtrl.err" class="ctrl-n err">{{ nbCtrl.err }}</span><span v-if="nbCtrl.warn" class="ctrl-n warn">{{ nbCtrl.warn }}</span><span v-if="!nbCtrl.err && !nbCtrl.warn" class="ctrl-n ok">✓</span></button>
      </div>
      <div class="p-grp p-sync">
        <div class="p-sync-t">Planification manuelle</div>
        <div class="p-sync-r" style="font-weight:600">Clique sur un équipement pour ouvrir son panier et y ajouter les lots en attente (à l'unité ou par campagne). L'ordre du panier est l'ordre de passage.</div>
      </div>
      <div class="p-grp"><label class="chk-inline"><input type="checkbox" v-model="afficherTermines" /> Afficher les lots terminés</label></div>
      <div class="p-grp regle-off" title="Règle appliquée à tous les lots : le lot doit être terminé avant le début de l'OFF (nuit / week-end / arrêt), sinon il démarre au poste ouvré suivant. Le nettoyage n'est pas concerné : il peut être fait avant l'OFF.">⛔ Un lot ne démarre que s'il est clôturé avant l'OFF (nettoyage possible avant l'OFF)</div>
    </section>
      <div class="pe-gantt-wrap">
    <div v-if="chargement" class="empty">Chargement…</div>
    <div v-else-if="!planning.length" class="empty">Aucun équipement de fabrication trouvé.</div>

    <!-- Gantt -->
    <section v-else class="card gantt-card">
      <div class="gantt" ref="ganttEl">
        <!-- entête temps -->
        <div class="g-header">
          <div class="g-eqcol g-eqhead">Équipement</div>
          <div class="g-track g-timeline" :style="{ width: totalW + 'px' }">
            <div v-for="d in jours" :key="d.i" class="g-dcol" :class="{ 'g-dcol-dep': d.depart }" :style="{ left: d.left + 'px', width: d.w + 'px' }">
              <div class="g-dlbl">{{ d.label }}<span v-if="d.depart" class="g-dep-lbl"> ▸ Départ</span></div>
              <div v-if="presentation" class="g-shbar">
                <span class="g-sb g-sb-n" :style="{ left: 0, width: (6 * pxH) + 'px' }"><i v-if="6 * pxH >= 22">{{ 6 * pxH >= 100 ? 'Nuit 22–06' : (6 * pxH >= 34 ? 'Nuit' : 'N') }}</i></span>
                <span class="g-sb g-sb-m" :style="{ left: (6 * pxH) + 'px', width: (8 * pxH) + 'px' }"><i v-if="8 * pxH >= 22">{{ 8 * pxH >= 120 ? 'Matin 06–14' : (8 * pxH >= 50 ? 'Matin' : 'M') }}</i></span>
                <span class="g-sb g-sb-a" :style="{ left: (14 * pxH) + 'px', width: (8 * pxH) + 'px' }"><i v-if="8 * pxH >= 22">{{ 8 * pxH >= 130 ? 'Après-midi 14–22' : (8 * pxH >= 62 ? 'Après-midi' : 'AM') }}</i></span>
                <span class="g-sb g-sb-n" :style="{ left: (22 * pxH) + 'px', width: (2 * pxH) + 'px' }"></span>
              </div>
              <div v-else class="g-shifts">
                <span class="g-sh g-sh0" :style="{ width: (6 * pxH) + 'px' }"></span>
                <span class="g-sh" :style="{ width: (8 * pxH) + 'px' }">06</span>
                <span class="g-sh" :style="{ width: (8 * pxH) + 'px' }">14</span>
                <span class="g-sh" :style="{ width: (2 * pxH) + 'px' }">22</span>
              </div>
            </div>
            <div v-if="posMaintenant != null" class="g-now-head" :style="{ left: posMaintenant + 'px' }"><span>{{ heureMaintenant }}</span></div>
          </div>
        </div>
        <!-- lignes -->
        <template v-for="row in planning" :key="row.eq.id">
        <div v-if="row.grpHead" class="g-grp">
          <div class="g-grp-lbl"><span class="g-grp-n">{{ row.grpNum }}</span>{{ row.grpHead }} <span class="g-grp-c">{{ row.grpCount }} équip.</span></div>
          <div class="g-grp-line" :style="{ width: totalW + 'px' }"></div>
        </div>
        <div class="g-row" :data-eq="row.eq.id" :class="{ 'g-row-cible': dragTemps && dragTemps.mode === 'deplacer' && Math.abs(dragTemps.deltaY) > 6 && String(dragTemps.cible) === String(row.eq.id), 'g-row-ko': dragTemps && dragTemps.mode === 'deplacer' && String(dragTemps.cible) === String(row.eq.id) && !dragTemps.ok }">
          <div class="g-eqcol" :title="'Cliquer pour gérer le panier — ' + row.eq.nom" @click="ouvrirPanier(row.eq)">
            <div class="g-eqcode">{{ row.eq.code }} <span class="g-reg" :class="{ r2: (regimeEquip[row.eq.id] || '3x8') === '2x8' }">{{ (regimeEquip[row.eq.id] || '3x8') === '2x8' ? '2×8' : '3×8' }}</span> <span v-if="(panierEquip[row.eq.id] || []).length" class="g-pan">🧺 {{ (panierEquip[row.eq.id] || []).length }}</span></div>
            <div class="g-eqnom">{{ row.eq.nom }}</div>
            <div v-for="c in (enCoursListe[row.eq.id] || [])" :key="'ec' + c.ordreId" class="g-eqcours" :title="'En cours (règle Disponibilité) : ' + c.code + ' — ' + c.desig + ' · lot ' + c.lot + ' · ' + c.phase + (c.depuis ? ' · depuis le ' + fmtDepuis(c.depuis) : '')">▶ <b>{{ c.lot }}</b> · {{ c.code }}<span v-if="c.depuis" class="g-eqcours-d"> · {{ fmtDepuis(c.depuis) }}</span></div>
            <div class="g-eqfin">fin : {{ fmtJH(row.fin) }}</div>
            <label class="g-eqwe" @click.stop><input type="checkbox" :checked="weOn(row.eq.id)" @change="weekendEquip[row.eq.id] = $event.target.checked; sauverPanier(row.eq.id)" /> week-ends (2×8)</label>
          </div>
          <div class="g-track" :style="[{ width: totalW + 'px' }, presentation ? fondShifts : null]">
            <!-- bandes jours -->
            <div v-for="d in jours" :key="'b'+d.i" class="g-dband" :style="{ left: d.left + 'px', width: d.w + 'px' }"></div>
            <!-- bandes week-end (si l'équipement ne travaille pas le week-end) -->
            <template v-if="!weOn(row.eq.id)">
              <div v-for="d in joursWeekend" :key="'w'+d.i" class="g-weekend" :style="{ left: d.left + 'px', width: d.w + 'px' }"></div>
            </template>
            <!-- bandes OFF (hors plage de travail : nuits selon 2×8/3×8, week-end chômé) -->
            <div v-for="(n, ni) in (offBands[row.eq.id] || [])" :key="'off'+ni" class="g-nuit" :style="{ left: n.left + 'px', width: n.w + 'px' }" title="OFF — hors plage de travail"></div>
            <div v-for="d in jourDepart" :key="'dep'+d.i" class="g-depart" :style="{ left: d.left + 'px', width: d.w + 'px' }"></div>
            <div v-for="(m, mi) in (maintEquip[row.eq.id] || [])" :key="'mnt'+mi" class="g-maint" :class="{ 'g-maint-curr': m.type === 'curr', 'g-maint-tech': m.type === 'tech', 'g-maint-autre': m.type === 'autre' }" :style="maintStyle(m)" :title="maintLibelle(m) + ' — ' + m.dureeH + ' h'"><span class="g-maint-lbl">{{ maintAbrev(m) }}</span></div>
            <div v-if="posMaintenant != null" class="g-now" :style="{ left: posMaintenant + 'px' }"></div>
            <!-- barres (par segment) -->
            <!-- campagnes (présentation) -->
            <div v-for="c in (presData[row.eq.id] || {}).camps || []" :key="c.key" class="g-bar g-lot g-camp"
                 :class="{ 'g-termine': c.termine, 'g-dim': prodFocus && c.prod.code_pf !== prodFocus, 'g-focus': prodFocus && c.prod.code_pf === prodFocus, 'g-cours': c.enCours, 'g-suivi': lotSuivi && c.uids.includes(lotSuivi), 'g-dim2': lotSuivi && !c.uids.includes(lotSuivi) }"
                 :style="campStyle(c)" :title="titreCamp(c)" @click="c.termine ? null : basculerCamp(c.key)">
              <span v-for="(tk, ti) in c.ticks" :key="ti" class="g-camp-tick" :style="{ left: tk + '%' }"></span>
              <span v-if="campW(c) >= 24" class="g-lbl g-lbl2">
                <span class="g-lbl-lot"><b v-if="c.termine" class="g-ok">✓</b><b v-if="c.enCours" class="g-live">▶</b>{{ campW(c) >= 120 ? c.prod.code_pf + ' · ' + c.n + ' lots' : (campW(c) >= 60 ? c.n + ' lots' : '×' + c.n) }}</span>
                <span v-if="campW(c) >= 60" class="g-lbl-desig">{{ c.prod.designation }}</span>
                <span v-if="campW(c) >= 120" class="g-lbl-nom">{{ c.premier }} → {{ c.dernier }}</span>
              </span>
            </div>
            <div v-for="c in (presData[row.eq.id] || {}).ouvertes || []" :key="'o' + c.key" class="g-camp-open"
                 :style="{ left: (((c.start - tAff) / 3600000) * pxH) + 'px', width: Math.max(8, ((c.end - c.start) / 3600000) * pxH) + 'px', '--c': couleurProd(c.prod.code_pf).bg }"
                 title="Campagne dépliée — cliquer pour regrouper" @click="basculerCamp(c.key)"><span>▲ regrouper</span></div>
            <template v-for="(t, i) in ((presData[row.eq.id] || {}).tasks || row.tasks)">
              <div v-for="(seg, j) in t.segments" :key="i + '-' + j" class="g-bar"
                   :class="[('g-' + t.type), { 'g-drag': t.type === 'lot', 'g-dragging': dragTemps && t.type === 'lot' && dragTemps.eqId === row.eq.id && dragTemps.uid === t.uid, 'g-dim': prodFocus && (t.type !== 'lot' || t.prod.code_pf !== prodFocus), 'g-focus': prodFocus && t.type === 'lot' && t.prod.code_pf === prodFocus, 'g-cours': t.type === 'lot' && lotEnCours(row.eq.id, t), 'g-suite': j > 0, 'g-coupe': j < t.segments.length - 1, 'g-force': t.coupe, 'g-termine': t.etat === 'termine', 'g-encours': t.etat === 'cours', 'g-suivi': lotSuivi && t.type === 'lot' && t.uid === lotSuivi, 'g-dim2': lotSuivi && (t.type !== 'lot' || t.uid !== lotSuivi) }]"
                   :style="[barStyleSeg(seg, t), (t.type === 'lot' && dragTemps && dragTemps.eqId === row.eq.id && dragTemps.uid === t.uid) ? { transform: 'translate(' + (dragTemps.deltaH * pxH) + 'px,' + (dragTemps.deltaY || 0) + 'px)', opacity: 0.8, zIndex: 20, pointerEvents: 'none' } : null]"
                   :title="t.type === 'lot' ? (titre(t) + '  •  clic : suivre ce lot  •  glisser : déplacer (dans la ligne ou vers un équipement identique)  •  Maj + glisser : décaler dans le temps  •  double-clic : annuler le décalage') : titre(t)"
                   @mousedown="t.type === 'lot' && t.etat !== 'termine' && t.etat !== 'cours' ? debutDragTemps($event, row.eq.id, t.uid) : (t.type === 'lot' ? (lotSuivi = lotSuivi === t.uid ? null : t.uid) : null)"
                   @dblclick="t.type === 'lot' ? resetDecal(row.eq.id, t.uid) : null">
                <span v-if="t.type === 'lot' && segW(seg) >= 20" class="g-lbl g-lbl2">
                  <span v-if="t.etat === 'cours'" class="g-prog" :style="{ width: (t.prog || 0) + '%' }"></span>
                  <span class="g-lbl-lot"><b v-if="t.etat === 'termine'" class="g-ok">✓</b><b v-else-if="(t.etat === 'cours' || lotEnCours(row.eq.id, t)) && j === 0" class="g-live">▶</b><template v-if="j > 0">↳ </template>{{ lotCourt(t.lot, segW(seg)) }}<em v-if="t.turbNo && segW(seg) >= 70" class="g-turb">T{{ t.turbNo }}/{{ t.turbines }}</em></span>
                  <span v-if="segW(seg) >= 60" class="g-lbl-nom">{{ t.etat === 'cours' ? (t.depasse ? 'en retard · ' : t.prog + ' % · ') : (t.etat === 'termine' ? 'terminé · ' : '') }}{{ t.prod.designation }}</span>
                </span>
                <span v-else-if="t.type !== 'lot' && j === 0 && segW(seg) >= (presentation ? 30 : 14)" class="g-lbl">{{ t.type.startsWith('gen') ? 'NG' : 'NP' }}</span>
              </div>
            </template>
          </div>
        </div>
        </template>
      </div>
    </section>
      </div>
    </div>

    <!-- Synthèse détaillée sous le Gantt (présentation) -->
    <section v-if="presentation && synthEquip.length" class="card recap pe-pres-synth">
      <table class="synth-tbl">
        <thead><tr><th>Équipement</th><th class="right">Lots</th><th class="right">NG</th><th class="right">NP</th><th>Occupation <span class="so-per">({{ periodeOccLib }})</span></th><th>Régime</th><th class="right">Fin</th></tr></thead>
        <tbody>
          <tr v-for="e in synthEquip" :key="'p' + e.id" :class="{ 'synth-goulot': String(e.id) === String(goulotId) }">
            <td>{{ e.code }} <span class="synth-nom">{{ e.nom }}</span></td>
            <td class="right">{{ e.lots }}</td><td class="right">{{ e.ng }}</td><td class="right">{{ e.np }}</td>
            <td class="synth-occ-cell" :title="occTitre(e.id)">
                <span class="so-bar so-bar2"><span class="so-prod" :style="{ width: Math.min(100, (chargeMap[e.id] || {}).prodPct || 0) + '%' }"></span><span class="so-nett" :style="{ width: Math.max(0, Math.min(100 - ((chargeMap[e.id] || {}).prodPct || 0), (chargeMap[e.id] || {}).nettPct || 0)) + '%' }"></span></span>
                <b class="so-pct" :class="'t-' + chargeClass((chargeMap[e.id] || {}).occ || 0)">{{ (chargeMap[e.id] || {}).occ || 0 }}%</b>
                <span class="so-det">prod. {{ (chargeMap[e.id] || {}).prodPct || 0 }}% · nett. {{ (chargeMap[e.id] || {}).nettPct || 0 }}%</span>
                <span v-if="String(e.id) === String(goulotId)" class="so-gl">goulot</span>
              </td>
            <td>{{ e.regime === '2x8' ? '2×8' : '3×8' }}</td>
            <td class="right nowrap">{{ fmtJH(e.fin) }}</td>
          </tr>
        </tbody>
      </table>
    </section>


    <!-- ===== Mode BOUCLE (écran atelier) ===== -->
    <div v-if="boucle" class="pb">
      <div class="pb-top">
        <div class="pb-titre">
          <span class="pb-num" v-if="bPageCour.type === 'phase'">{{ bPageCour.num }}</span>
          <h2>{{ bPageCour.titre }}</h2>
          <span class="pb-sem">Semaine {{ bSemLib }}</span>
        </div>
        <div class="pb-ctl">
          <span class="pb-h">{{ bHeure }}</span>
          <span class="pb-pg">page {{ bPage + 1 }} / {{ bPages.length }}</span>
          <button @click="bSuivante(-1)" title="Page précédente (←)">◀</button>
          <button @click="bPause = !bPause" :title="bPause ? 'Reprendre (espace)' : 'Pause (espace)'">{{ bPause ? '▶' : '❚❚' }}</button>
          <button @click="bSuivante(1)" title="Page suivante (→)">▶</button>
          <select v-model.number="bDuree" title="Durée d'affichage par page"><option :value="10">10 s</option><option :value="20">20 s</option><option :value="30">30 s</option><option :value="60">60 s</option></select>
          <button class="pb-x" @click="arreterBoucle" title="Quitter (Échap)">✕</button>
        </div>
      </div>
      <div class="pb-prog"><div :style="{ width: Math.min(100, bEcoule / bDuree * 100) + '%' }" :class="{ pause: bPause }"></div></div>
      <div class="pb-tabs">
        <button v-for="ph in bPhases" :key="ph.k" :class="{ on: (bPageCour.type === 'synthese' ? 0 : bPageCour.ph) === ph.k }" @click="bAller(ph.idx)">{{ ph.lib }}</button>
      </div>

      <!-- Vue d'ensemble -->
      <div v-if="bPageCour.type === 'synthese'" class="pb-syn">
        <div class="pe-kpis">
          <div class="pe-kpi"><span class="pe-kpi-l">Lots planifiés cette semaine</span><span class="pe-kpi-v">{{ bKpi.lots }}</span></div>
          <div class="pe-kpi"><span class="pe-kpi-l">Équipements planifiés</span><span class="pe-kpi-v">{{ bKpi.actifs }} / {{ bKpi.total }}</span></div>
          <div class="pe-kpi pe-kpi-ok"><span class="pe-kpi-l">Lots en cours</span><span class="pe-kpi-v">{{ bKpi.cours }}</span></div>
          <div class="pe-kpi pe-kpi-warn"><span class="pe-kpi-l">Goulot de la semaine</span><span class="pe-kpi-v">{{ goulotLibB }}</span><span v-if="goulotNomB" class="pe-kpi-s">{{ goulotNomB }}</span></div>
        </div>
        <div class="pb-occ">
          <div v-for="x in bSynthese" :key="x.r.eq.id" class="pb-occ-l" :class="{ gl: String(x.r.eq.id) === String(goulotId) }">
            <span class="pb-occ-ph">{{ PH_LIB_B[phaseOrdre(x.r.eq.type)] || '—' }}</span>
            <span class="pb-occ-eq"><b>{{ x.r.eq.code }}</b> {{ x.r.eq.nom }}</span>
            <span class="pb-occ-bar"><span class="so-prod" :style="{ width: Math.min(100, x.c.prodPct || 0) + '%' }"></span><span class="so-nett" :style="{ width: Math.max(0, Math.min(100 - (x.c.prodPct || 0), x.c.nettPct || 0)) + '%' }"></span></span>
            <b class="pb-occ-pct" :class="'t-' + chargeClass(x.c.occ || 0)">{{ x.c.occ || 0 }} %</b>
            <span class="pb-occ-c"><template v-if="x.cours.length">▶ {{ x.cours[0].lot }} · {{ x.cours[0].code }}</template><template v-else-if="!(x.c.busyH > 0)">libre</template></span>
          </div>
        </div>
      </div>

      <!-- Page phase : cartes équipements -->
      <div v-else class="pb-cartes">
        <div v-for="r in bPageCour.rows" :key="r.eq.id" class="pb-carte" :class="{ libre: !(bCartes[r.eq.id] || {}).nbSem && !(enCoursListe[r.eq.id] || []).length }">
          <div class="pb-c-g">
            <div class="pb-c-code">{{ r.eq.code }} <span class="g-reg" :class="{ r2: (bCartes[r.eq.id] || {}).regime === '2x8' }">{{ (bCartes[r.eq.id] || {}).regime === '2x8' ? '2×8' : '3×8' }}</span></div>
            <div class="pb-c-nom">{{ r.eq.nom }}</div>
            <div class="pb-c-occ"><span class="pb-occ-bar"><span class="so-prod" :style="{ width: Math.min(100, (chargeMap[r.eq.id] || {}).prodPct || 0) + '%' }"></span><span class="so-nett" :style="{ width: Math.max(0, Math.min(100 - ((chargeMap[r.eq.id] || {}).prodPct || 0), (chargeMap[r.eq.id] || {}).nettPct || 0)) + '%' }"></span></span><b :class="'t-' + chargeClass((chargeMap[r.eq.id] || {}).occ || 0)">{{ (chargeMap[r.eq.id] || {}).occ || 0 }} %</b></div>
          </div>
          <div class="pb-c-d">
            <div class="pb-c-info">
              <span v-if="(enCoursListe[r.eq.id] || []).length" class="pb-cours">▶ En cours : <b>{{ enCoursListe[r.eq.id][0].lot }}</b> · {{ enCoursListe[r.eq.id][0].desig || enCoursListe[r.eq.id][0].code }}<span v-if="enCoursListe[r.eq.id][0].depuis"> · depuis {{ fmtDepuis(enCoursListe[r.eq.id][0].depuis) }}</span></span>
              <span v-else-if="(bCartes[r.eq.id] || {}).nbSem" class="pb-att">Aucun lot en cours</span>
              <span v-else class="pb-libre">Libre — aucun lot planifié cette semaine</span>
              <span v-if="(bCartes[r.eq.id] || {}).prochain" class="pb-next">Prochain : <b>{{ bCartes[r.eq.id].prochain.lot }}</b> · {{ bCartes[r.eq.id].prochain.prod.designation }} · {{ fmtJH(bCartes[r.eq.id].prochain.segments[0].start) }}</span>
              <span class="pb-nb"><b class="pb-n-t">✓ {{ (bCartes[r.eq.id] || {}).nT || 0 }}</b> terminés · <b class="pb-n-c">▶ {{ (bCartes[r.eq.id] || {}).nC || 0 }}</b> en cours · <b>{{ (bCartes[r.eq.id] || {}).nP || 0 }}</b> planifiés</span>
            </div>
            <div class="pb-frise">
              <div v-for="(o, oi) in (bCartes[r.eq.id] || {}).off || []" :key="'o' + oi" class="pb-off" :style="bStyle(o.a, o.b)"></div>
              <div v-for="(o, oi) in bJours" :key="'j' + oi" class="pb-jl" :style="{ left: o.left + '%' }"><span>{{ o.lbl }}</span></div>
              <div v-for="t in ((bCartes[r.eq.id] || {}).taches || [])" :key="'t' + t.uid + (t.turbNo || '') + t.type + t.start" class="pb-b" :class="['pb-' + t.type, { 'pb-termine': t.etat === 'termine', 'pb-encours': t.etat === 'cours' }]" :style="t.type === 'lot' ? bStyle(t.segments[0].start, t.end, t.prod) : bStyle(t.segments[0].start, t.end)">
                <span v-if="t.etat === 'cours'" class="g-prog" :style="{ width: (t.prog || 0) + '%' }"></span>
                <span v-if="t.type === 'lot'">{{ t.etat === 'termine' ? '✓ ' : (t.etat === 'cours' ? '▶ ' : '') }}{{ t.lot }}{{ t.etat === 'cours' ? ' · ' + (t.depasse ? 'retard' : t.prog + ' %') : '' }}</span>
              </div>
              <div v-for="c in ((bCartes[r.eq.id] || {}).camps || [])" :key="c.key" class="pb-b pb-camp" :class="{ cours: c.enCours, 'pb-termine': c.termine }" :style="bStyle(c.start, c.end, c.prod)">
                <span v-for="(tk, ti) in c.ticks" :key="ti" class="g-camp-tick" :style="{ left: tk + '%' }"></span>
                <span class="pb-camp-l"><b>{{ c.termine ? '✓ ' : '' }}{{ c.prod.code_pf }} · {{ c.n }} lots{{ c.termine ? ' terminés' : '' }}</b><em>{{ c.prod.designation }}</em></span>
              </div>
              <div class="pb-now" :style="{ left: bPct(maintenant) + '%' }"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="pb-pied">LDM Groupe — Site El Khroub · ProdTrack · données actualisées à {{ bMaj ? bMaj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—' }} · ← → pages · espace pause · Échap quitter</div>
    </div>

    <!-- Contrôle des cadences -->
    <div v-if="ctrlOuvert" class="pan-overlay" @click="ctrlOuvert = false">
      <div class="pan-box ctrl-box" @click.stop>
        <div class="pan-head">
          <div><b>Contrôle des cadences</b> <span class="pan-nom">couples équipement / produit utilisés par le planning ou saisis dans les cadences</span></div>
          <div class="pan-head-btns"><a href="#/cadences" class="pan-btn ctrl-lien" title="Page Cadences & paramètres par équipement">Ouvrir les cadences ↗</a><button class="pan-close" @click="ctrlOuvert = false">✕</button></div>
        </div>
        <div class="ctrl-res">
          <span class="ctrl-n err">{{ nbCtrl.err }}</span> durée par défaut 8 h ·
          <span class="ctrl-n warn">{{ nbCtrl.warn }}</span> durée anormale ·
          cadences lues dans le référentiel « Cadences & paramètres par équipement » (kg/h)
        </div>
        <p class="pan-hint2">Durée d'un lot = poids du lot (taille × unités/boîte × poids unitaire) ÷ cadence du référentiel Cadences (kg/h ; machines identiques regroupées comme dans la matrice). Pelliculage : ÷ nombre de turbines.</p>
        <div v-if="!controleDonnees.length" class="pan-vide">✓ Aucune anomalie : toutes les cadences et fiches produit utilisées sont complètes.</div>
        <table v-else class="synth-tbl ctrl-tbl">
          <thead><tr><th></th><th>Équipement</th><th>Produit</th><th class="right">Lots planifiés</th><th class="right">Cadence</th><th class="right">Durée / lot</th><th>Calcul</th><th>Problème</th></tr></thead>
          <tbody>
            <tr v-for="x in controleDonnees" :key="x.eq.id + '#' + x.prod.id" :class="'ctrl-' + x.niveau">
              <td><span class="ctrl-n" :class="x.niveau">{{ x.niveau === 'err' ? '!' : (x.niveau === 'warn' ? '?' : 'i') }}</span></td>
              <td><b>{{ x.eq.code }}</b> <span class="synth-nom">{{ x.eq.nom }}</span></td>
              <td>{{ x.prod.designation }} <span class="synth-nom">{{ x.prod.code_pf }}</span></td>
              <td class="right">{{ x.nbLots || '—' }}</td>
              <td class="right nowrap">{{ x.cad ? (x.cad.cadence_nominale + ' kg/h') : '—' }}</td>
              <td class="right nowrap">{{ fmtH(x.h) }}<span v-if="x.nbT > 1" class="synth-nom"> ({{ fmtH(x.hTurb) }}/turbine)</span></td>
              <td class="ctrl-calc">{{ calculTxt(x.prod, x.cad) }}</td>
              <td>{{ x.pb }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <!-- Récap -->

    <!-- Panier par équipement -->
    <div v-if="panierOuvert" class="pan-overlay" @click="panierOuvert = null">
      <div class="pan-box" @click.stop>
        <div class="pan-head">
          <div><b>Panier — {{ panierOuvert.code }}</b> <span class="pan-nom">{{ panierOuvert.nom }}</span></div>
          <div class="pan-head-btns">
            <button class="pan-vider" @click="viderPanier" :disabled="!(panierEquip[panierOuvert.id] || []).length">Vider</button>
            <button class="pan-close" @click="panierOuvert = null">✕</button>
          </div>
        </div>
        <div class="pan-cfg">
          <label class="pan-reg">Régime :
            <select :value="regimeEquip[panierOuvert.id] || '3x8'" @change="setRegime($event.target.value)">
              <option value="3x8">3×8 — 24 h/24</option>
              <option value="2x8">2×8 — 06 h–22 h</option>
            </select>
          </label>
        </div>
        <div class="pan-requis" v-if="!weOn(panierOuvert.id)">
          <div class="pan-req-head">Réquisitions week-end (date + régime) :</div>
          <div class="pan-req-list">
            <span v-for="req in (requisEquip[panierOuvert.id] || [])" :key="req.d || req" class="pan-req-chip">{{ req.d || req }} <b>{{ (req.r || '2x8') === '2x8' ? '2×8' : '3×8' }}</b> <button @click="retirerRequis(req.d || req)">✕</button></span>
            <span v-if="!(requisEquip[panierOuvert.id] || []).length" class="pan-none">Aucune.</span>
          </div>
          <div class="pan-req-add">
            <input type="date" v-model="requisDate" class="pan-reqdate" />
            <select v-model="requisRegime" class="pan-reqreg"><option value="2x8">2×8 (06h–22h)</option><option value="3x8">3×8</option></select>
            <button class="vue-btn" @click="ajouterRequis">Ajouter</button>
          </div>
        </div>
        <div class="pan-requis">
          <div class="pan-req-head">Arrêts maintenance (équipement indisponible) :</div>
          <div class="pan-req-list">
            <span v-for="(m, mi) in (maintEquip[panierOuvert.id] || [])" :key="mi" class="pan-req-chip" :class="{ 'pan-maint-curr': m.type === 'curr', 'pan-maint-tech': m.type === 'tech', 'pan-maint-autre': m.type === 'autre' }">{{ maintNom(m) }} · {{ fmtMaint(m.debut) }} · {{ m.dureeH }}h <button @click="retirerMaint(mi)">✕</button></span>
            <span v-if="!(maintEquip[panierOuvert.id] || []).length" class="pan-none">Aucun.</span>
          </div>
          <div class="pan-req-add">
            <select v-model="maintType" class="pan-reqreg"><option value="prev">Préventif</option><option value="curr">Curatif</option><option value="tech">Technique</option><option value="autre">Autre…</option></select>
            <input v-if="maintType === 'autre'" v-model="maintLabel" placeholder="Nom de l'arrêt" class="pan-reqdate" />
            <input type="datetime-local" v-model="maintDebut" class="pan-reqdate" />
            <input type="number" min="0.25" step="0.25" v-model.number="maintDuree" class="pan-nb" title="Durée (h)" />
            <button class="vue-btn" @click="ajouterMaint">Ajouter</button>
          </div>
        </div>
        <div class="pan-list">
          <div v-for="(item, idx) in (panierEquip[panierOuvert.id] || [])" :key="item.ordreId" class="pan-item" :class="{ 'pan-exclu': item.exclu }">
            <span class="pan-idx">{{ idx + 1 }}</span>
            <span class="pan-ord"><button class="pan-btn" @click="monterLot(idx, -1)" :disabled="idx === 0" title="Monter (passe avant)">▲</button><button class="pan-btn" @click="monterLot(idx, 1)" :disabled="idx === (panierEquip[panierOuvert.id] || []).length - 1" title="Descendre (passe après)">▼</button></span>
            <span class="pan-pnom"><b>{{ item.lot }}</b> — {{ produitNom(item.pid) }}<em v-if="item.exclu" class="pan-ex-l"> · exclu du planning</em></span>
            <select v-if="ciblesPossibles(item).length" class="pan-move" @change="deplacerDepuisPanier(item, $event)" title="Déplacer ce lot sur un autre équipement de la même phase"><option value="">→ déplacer…</option><option v-for="e in ciblesPossibles(item)" :key="e.id" :value="e.id">{{ e.code }}</option></select>
            <button class="pan-btn" :class="{ on: item.epingle }" @click="basculerEpingle(item)" :title="item.epingle ? 'Épinglé sur cet équipement — cliquer pour libérer' : 'Épingler sur cet équipement (la synchro ne le déplacera pas)'">📌</button>
            <button class="pan-btn" :class="{ on: item.exclu }" @click="basculerExclu(item)" :title="item.exclu ? 'Rétablir dans le planning' : 'Exclure du planning (la synchro ne le remettra pas)'">⊘</button>
            <input type="datetime-local" v-model="item.dateDebut" class="pan-date" title="Date de début souhaitée (laisser vide = automatique)" @change="sauverPanier(panierOuvert.id)" />
            <button v-if="item.dateDebut" class="pan-btn" @click="item.dateDebut = ''; sauverPanier(panierOuvert.id)" title="Repasser en automatique">auto</button>
            <button class="pan-btn del" @click="retirerLot(idx)" title="Retirer du panier">✕</button>
          </div>
          <div v-if="!(panierEquip[panierOuvert.id] || []).length" class="pan-vide">Aucun lot affecté à cet équipement.</div>
        </div>
        <p class="pan-hint2">▲▼ ordre de passage · → déplacer vers un équipement identique · ⊘ exclure du planning sans le retirer. Lots en attente de cette phase. Réordonne/décale en les <b>glissant sur le Gantt</b>, ou fixe une <b>date de début</b> par lot ci-dessus.</p>
        <div class="pan-add">
          <input v-model="rechProd" placeholder="Rechercher un lot (n°, produit)…" class="pan-search" />
          <p v-if="panSansCadence" class="pan-warn">⚠ Aucune cadence renseignée pour cet équipement : tous les lots de la phase sont proposés.</p>
          <p v-else class="pan-hint2">Seuls les produits qui passent sur {{ panierOuvert.code }} (cadence renseignée) sont proposés.</p>
          <div class="pan-camps">
            <div v-for="g in lotsAjoutablesParProduit" :key="g.pid" class="pan-camp">
              <div class="pan-camp-h"><i :style="{ background: couleurProd(g.code).bg }"></i><b>{{ g.desig || g.code }}</b> <span class="pan-camp-n">{{ g.lots.length }} lot(s)</span>
                <button v-if="g.lots.length > 1" class="pan-btn pan-camp-all" @click="ajouterCampagne(g.pid)" title="Ajouter tous les lots de ce produit à la suite (campagne)">+ toute la campagne</button></div>
              <div class="pan-prods">
                <button v-for="l in g.lots" :key="l.id" class="pan-chip" :class="{ 'pan-chip-plan': l.plan, 'pan-chip-cours': l.cours, 'pan-chip-ail': l.ailleurs, 'pan-chip-amont': l.amont }" @click="ajouterLot(l)" :title="(l.plan ? 'OF non lancé — ' : (l.cours ? 'En cours — ' : (l.amont ? 'À venir : actuellement en ' + l.amont + ' — ' : 'En attente — '))) + l.code + ' — ' + l.desig + (l.ailleurs ? '  •  déjà dans le panier de ' + l.ailleurs : '')">{{ l.lot }}<small v-if="l.amont"> · en {{ l.amont.toLowerCase() }}</small><small v-if="l.ailleurs"> · {{ l.ailleurs }}</small></button>
              </div>
            </div>
            <span v-if="!lotsAjoutables.length" class="pan-none">Aucun lot en attente pour cette phase.</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { supabase } from '../supabase'

const chargement = ref(true)
const erreur = ref('')

// Paramètres (valeurs fixes réglables)
const today = new Date()
const iso = (d) => { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const j = String(d.getDate()).padStart(2, '0'); return y + '-' + m + '-' + j }
const dateDepart = ref((() => { try { return localStorage.getItem('pe_depart') || '2026-08-11' } catch (e) { return '2026-08-11' } })())
watch(dateDepart, (v) => { try { if (v) localStorage.setItem('pe_depart', v) } catch (e) {} })
const vdlt = ref(8)        // nettoyage général (h)
const vdlp = ref(2)        // nettoyage partiel (h)
const holdingJ = ref(7)    // validité campagne (jours)
const annee = ref(today.getFullYear())
const pxH = ref(4)         // pixels par heure (zoom)
const filtreTexte = ref('')
const filtrePhase = ref('')
// Phases de fabrication (présentation) : sélection de la phase -> affichage de ses équipements
const PHASES_FAB = [[1, 'Pesée'], [2, 'Granulation'], [3, 'Séchage'], [4, 'Mélange'], [5, 'Compression'], [6, 'Remplissage gélules'], [7, 'Pelliculage']]
const phasesPres = computed(() => PHASES_FAB.map(([k, l]) => {
  const eqs = equipements.value.filter(e => estFab(e.type) && phaseOrdre(e.type) === k)
  return { k, l, n: eqs.length, nPlan: eqs.filter(e => (panierEquip[e.id] || []).length).length }
}))
let avecPlanAvant = null
function choisirPhasePres(k) {
  filtrePhase.value = k ? String(k) : ''
  // une phase choisie : tous ses équipements affichés (même sans lot), filtre texte retiré
  if (k) { if (avecPlanAvant === null) avecPlanAvant = filtreAvecPlan.value; filtreAvecPlan.value = false; filtreTexte.value = '' }
  else if (avecPlanAvant !== null) { filtreAvecPlan.value = avecPlanAvant; avecPlanAvant = null }
  try { ajusterVueBientot() } catch (e) {}
}
// Option : ne pas couper un lot sur les heures OFF — le reporter à la fenêtre
// de travail suivante où il tient d'un seul tenant (insécable). Mémorisé localement.
const lotsInsecables = ref((() => { try { return localStorage.getItem('pe_insecables') !== '0' } catch (e) { return true } })())
function majInsecables() { try { localStorage.setItem('pe_insecables', lotsInsecables.value ? '1' : '0') } catch (e) {} }
const filtreAvecPlan = ref(false)
const weekendEquip = reactive({}) // par équipement : true = tous les week-ends inclus (défaut : inclus)
const weOn = (id) => weekendEquip[id] !== false
const regimeEquip = reactive({})  // par équipement : '2x8' ou '3x8'
const requisEquip = reactive({})  // par équipement : dates week-end travaillées
const maintEquip = reactive({})   // par équipement : arrêts [{type,debut,dureeH}]
const ordreManuel = reactive({})  // par équipement : true = ordre du panier respecté strictement (réajusté à la main)

const holdingH = computed(() => Number(holdingJ.value) * 24)

// Données
const planRaw = ref([])
const cadences = ref([])
const equipements = ref([])
const produits = ref([])
const ofs = ref([])
const suivi = ref([])

async function fetchAllPaged(qb) {
  const size = 1000; let from = 0; const out = []
  while (true) {
    const { data, error } = await qb().range(from, from + size - 1)
    if (error) return { error }
    out.push(...(data || []))
    if (!data || data.length < size) break
    from += size
  }
  return { data: out }
}

onMounted(async () => { chargerLocal(); await chargerDonnees(); demarrerBoucleSiUrl() })
async function chargerDonnees() {
  try {
    const [rp, rc, re, rpr, rpan, rof, rsu] = await Promise.all([
      fetchAllPaged(() => supabase.from('plan_production').select('annee, quantite_planifiee, produit_id')),
      fetchAllPaged(() => supabase.from('cadences_produit').select('cadence_nominale, unite_cadence, mode, equipement_id, produit_id')),
      fetchAllPaged(() => supabase.from('equipements').select('id, code, nom, type, atelier_id, actif, vdlt, vdlp, dht, reglage, postes').eq('actif', true)),
      fetchAllPaged(() => supabase.from('produits').select('id, code_pf, designation, taille_lot, unites_par_boite, poids_unitaire_mg, gamme').eq('actif', true)),
      fetchAllPaged(() => supabase.from('planning_panier').select('equipement_id, produits')),
      fetchAllPaged(() => supabase.from('ordres_fabrication').select('id, numero_lot, statut, quantite_theorique, date_lancement, date_fin_fabrication, equipement_id, produits(id, code_pf, designation, gamme, taille_lot, unites_par_boite, poids_unitaire_mg)')),
      fetchAllPaged(() => supabase.from('suivi_phases').select('ordre_id, phase, statut, date_phase, date_debut, equipement_id').eq('actif', true))
    ])
    if (rp.error || rc.error || re.error || rpr.error) { erreur.value = (rp.error || rc.error || re.error || rpr.error).message; return }
    planRaw.value = rp.data; cadences.value = rc.data; equipements.value = re.data; produits.value = rpr.data
    if (rof && !rof.error) ofs.value = rof.data
    if (rsu && !rsu.error) suivi.value = rsu.data
    if (rpan && !rpan.error && rpan.data) for (const row of rpan.data) {
      let lotsArr = [], reg = null, req = null
      const pr = row.produits
      if (Array.isArray(pr)) lotsArr = pr
      else if (pr && typeof pr === 'object') { lotsArr = Array.isArray(pr.lots) ? pr.lots : []; reg = pr.regime; req = pr.requis; if (typeof pr.we === 'boolean') weekendEquip[row.equipement_id] = pr.we; if (Array.isArray(pr.maint)) maintEquip[row.equipement_id] = pr.maint; if (typeof pr.om === 'boolean') ordreManuel[row.equipement_id] = pr.om }
      const flat = []
      for (const x of lotsArr) {
        if (x && typeof x === 'object' && x.ordreId) flat.push({ ordreId: x.ordreId, lot: x.lot, pid: x.pid, decalage: Number(x.decalage) || 0, dateDebut: x.dateDebut || '', auto: (x.auto === undefined || x.auto === null) ? null : !!x.auto, epingle: !!x.epingle, exclu: !!x.exclu })
      }
      panierEquip[row.equipement_id] = flat
      if (reg) regimeEquip[row.equipement_id] = reg
      if (Array.isArray(req)) requisEquip[row.equipement_id] = req
    }
    // Holding times (requêtes tolérantes, comme Disponibilité)
    try { const r1 = await supabase.from('produits').select('id, holding_time_jours'); const hm = {}; if (!r1.error && r1.data) for (const x of r1.data) if (x.holding_time_jours != null) hm[x.id] = Number(x.holding_time_jours); holdTimes.value = hm } catch (e) {}
    try { const r2 = await supabase.from('produits').select('id, holding_times'); const hs = {}; if (!r2.error && r2.data) for (const x of r2.data) if (x.holding_times && typeof x.holding_times === 'object') hs[x.id] = x.holding_times; holdSteps.value = hs } catch (e) {}
    nettoyerPanierTermines()
    nettoyerHistoriqueEquip()
    purgerLotsAuto()   // planification MANUELLE : les lots ajoutés par l'ancienne synchro sont retirés
  } catch (e) { erreur.value = String(e) } finally { chargement.value = false }
}

// Années dispo
const annees = computed(() => {
  const s = new Set(planRaw.value.map(r => Number(r.annee)).filter(Boolean))
  s.add(today.getFullYear())
  return [...s].sort((a, b) => b - a)
})

// Index produits + PDP quantité par produit pour l'année
const produitsById = computed(() => { const m = {}; for (const p of produits.value) m[p.id] = p; return m })
const ofsById = computed(() => { const m = {}; for (const o of ofs.value) m[o.id] = o; return m })
const retiresAuto = ref(0)
function nettoyerPanierTermines() {
  const byId = ofsById.value; let n = 0
  for (const eqId in panierEquip) {
    const pan = panierEquip[eqId]
    if (!Array.isArray(pan) || !pan.length) continue
    const garde = pan.filter(item => { const o = byId[item.ordreId]; if (!o) return true; const fini = !!o.date_fin_fabrication || /lib[eé]r|rejet|clotur/i.test(o.statut || ''); return !fini })
    if (garde.length !== pan.length) { n += pan.length - garde.length; panierEquip[eqId] = garde; sauverPanier(Number(eqId)) }
  }
  retiresAuto.value = n
}
function nettoyerHistoriqueEquip() {
  const auj = new Date(); auj.setHours(0, 0, 0, 0)
  const maintenant = Date.now()
  for (const eqId in requisEquip) {
    const arr = requisEquip[eqId]
    if (!Array.isArray(arr) || !arr.length) continue
    const garde = arr.filter(x => { const d = typeof x === 'object' ? x.d : x; if (!d) return true; const dd = new Date(d + 'T00:00:00'); return isNaN(dd) || dd >= auj })
    if (garde.length !== arr.length) { requisEquip[eqId] = garde; sauverPanier(Number(eqId)) }
  }
  for (const eqId in maintEquip) {
    const arr = maintEquip[eqId]
    if (!Array.isArray(arr) || !arr.length) continue
    const garde = arr.filter(m => { if (!m || !m.debut) return true; const fin = new Date(m.debut).getTime() + (Number(m.dureeH) || 0) * 3600000; return isNaN(fin) || fin >= maintenant })
    if (garde.length !== arr.length) { maintEquip[eqId] = garde; sauverPanier(Number(eqId)) }
  }
}
// ===== Lot en cours par équipement — MÊME RÈGLE que « Disponibilité des produits par atelier » =====
// Le lot est à sa PREMIÈRE phase de gamme non terminée ; il est « en cours » si cette phase est
// « En cours » dans suivi_phases, sur l'équipement saisi pour cette phase.
// Granulation / Séchage fusionnés : granulation terminée mais séchage saisi et non terminé => en cours.
// Exclus : lots libérés / rejetés, non lancés, ou fabrication terminée.
const DP_PHASE_NOM = { pesee: 'Pesée', granulation: 'Granulation', sechage: 'Séchage', melange: 'Mélange', compression: 'Compression', remplissage: 'Remplissage Gélules', pelliculage: 'Pelliculage', conditionnement: 'Conditionnement' }
const DP_NOM_KEY = {}
for (const [k, v] of Object.entries(DP_PHASE_NOM)) DP_NOM_KEY[v.toLowerCase()] = k
const DP_ORDRE = { pesee: 1, granulation: 2, sechage: 3, melange: 4, compression: 5, remplissage: 6, pelliculage: 7, conditionnement: 8 }
const DP_CANON_FAB = ['Pesée', 'Granulation', 'Séchage', 'Mélange', 'Compression', 'Remplissage Gélules', 'Pelliculage']
function dpPhaseKey(nom) {
  const t = String(nom || '').trim().toLowerCase()
  if (!t) return null
  if (/granul|s[ée]ch/.test(t)) return 'granulation'
  return DP_NOM_KEY[t] || null
}
const dpPhasesLot = computed(() => {
  const m = {}, sechEtat = {}
  for (const sp of suivi.value) {
    const id = sp.ordre_id, k = dpPhaseKey(sp.phase)
    if (!k) continue
    if (!m[id]) m[id] = {}
    const rec = { statut: sp.statut, date: sp.date_phase || sp.date_debut || null, equip: sp.equipement_id ?? null, debut: sp.date_debut || null, fin: sp.statut === 'Terminé' ? (sp.date_phase || null) : null }
    const nl = String(sp.phase || '').toLowerCase()
    const estSech = /s[ée]ch/.test(nl) && !/granul/.test(nl)
    if (!estSech || !m[id][k]) { if (!m[id][k] || sp.statut === 'Terminé') m[id][k] = rec }
    if (estSech) {
      if (!sechEtat[id]) sechEtat[id] = { present: false, termine: false, fin: null }
      sechEtat[id].present = true
      if (sp.statut === 'Terminé') { sechEtat[id].termine = true; sechEtat[id].fin = sp.date_phase || null }
    }
  }
  for (const id in m) {
    const g = m[id].granulation
    if (g && g.statut === 'Terminé') {
      const se = sechEtat[id]
      const apres = m[id].compression || m[id].remplissage || m[id].pelliculage || m[id].conditionnement
      if (se && se.present && !se.termine && !apres) m[id].granulation = { statut: 'En cours', date: g.date, equip: g.equip, debut: g.debut, fin: null }
      else if (se && se.termine && se.fin && (!g.fin || new Date(se.fin) > new Date(g.fin))) m[id].granulation = { ...g, fin: se.fin }
    }
  }
  return m
})
// ===== Alimentation AUTOMATIQUE des paniers depuis la file « Disponibilité des produits par atelier » =====
// Lots : OF non libérés / rejetés / à fabrication terminée, lancés ou non (option) ; pour chaque phase
// RESTANTE de la gamme (1re non terminée et suivantes), le lot est affecté à un équipement de la phase
// qui a une CADENCE pour ce produit :
//   1) équipement saisi dans le suivi (en cours / terminé) ; 2) équipement réservé sur l'OF ;
//   3) 📌 épinglé ; 4) sinon CAMPAGNE ENTIÈRE (même produit = même équipement) sur l'équipement le moins chargé.
// Ordre dans le panier : en cours, puis campagnes par produit (produit le plus urgent d'abord,
// urgence = échéance holding time), puis échéance, puis n° de lot. Lots ajoutés à la main et 📌 conservés.
const holdTimes = ref({})
const holdSteps = ref({})
const syncAuto = ref((() => { try { return localStorage.getItem('pe_sync_auto') !== '0' } catch (e) { return true } })())
const syncNonLances = ref((() => { try { return localStorage.getItem('pe_sync_nl') !== '0' } catch (e) { return true } })())
watch(syncAuto, (v) => { try { localStorage.setItem('pe_sync_auto', v ? '1' : '0') } catch (e) {} })
watch(syncNonLances, (v) => { try { localStorage.setItem('pe_sync_nl', v ? '1' : '0') } catch (e) {} ; synchroniserPaniers() })
const syncInfo = ref(null)
const KEY_PH = { pesee: 1, granulation: 2, melange: 4, compression: 5, remplissage: 6, pelliculage: 7 }
function holdJours(pid, k) { const st = holdSteps.value[pid]; if (st && k && st[k] != null) return Number(st[k]); return holdTimes.value[pid] != null ? holdTimes.value[pid] : null }
function synchroniserPaniers() {
  const equipsFab = equipements.value.filter(e => estFab(e.type))
  const cadOk = { has: (k) => { const i = k.indexOf('#'); return !!cadRef(k.slice(0, i), k.slice(i + 1)) } }
  const now = Date.now()
  // charge courante (h) par équipement pour répartir
  const charge = {}
  const dureeSur = (eqId, pid) => { const prod = produitsById.value[pid]; const cad = cadRef(eqId, pid); return (prod && cad ? dureeLotH(prod, cad) : 8) + 2 }
  // où est déjà chaque lot (par phase)
  const ou = {}   // ordreId#ph -> { eqId, item }
  for (const eqId in panierEquip) for (const it of (panierEquip[eqId] || [])) { const eq = equipsFab.find(e => String(e.id) === String(eqId)); if (eq) ou[it.ordreId + '#' + phaseOrdre(eq.type)] = { eqId: Number(eqId), item: it } }
  const voulu = {}  // eqId -> [{ item, cle }]
  let nonAff = 0, nbLots = 0
  const demandes = []
  for (const o of ofs.value) {
    if (o.statut === 'Libéré' || o.statut === 'Rejeté' || o.date_fin_fabrication) continue
    if (!o.date_lancement && !syncNonLances.value) continue
    const p = o.produits || {}; if (!p.id) continue
    const gammeB = (Array.isArray(p.gamme) && p.gamme.length) ? p.gamme : GAMME_DEF
    const phases = [...new Set(gammeB.map(phaseOrdre).filter(x => x >= 1 && x <= 7))].sort((a, b) => a - b)
    const pl = dpPhasesLot.value[o.id] || {}
    // phases restantes = à partir de la 1re non terminée (clé fusionnée granulation/séchage)
    const statutPh = (ph) => (pl[PH_CLE[ph]] || {}).statut
    let i0 = phases.findIndex(ph => statutPh(ph) !== 'Terminé'); if (i0 < 0) continue
    const restantes = phases.slice(i0)
    // échéance holding time (étape courante)
    const kCur = PH_CLE[restantes[0]], kPrev = i0 > 0 ? PH_CLE[phases[i0 - 1]] : null
    const datePrec = (kPrev && pl[kPrev] && (pl[kPrev].fin || pl[kPrev].date)) || o.date_lancement
    const hj = holdJours(p.id, kCur)
    const echeance = (datePrec && hj != null) ? new Date(datePrec).getTime() + hj * 86400000 : Infinity
    nbLots++
    restantes.forEach((ph, idx) => {
      const cands = equipsFab.filter(e => phaseOrdre(e.type) === ph && cadOk.has(e.id + '#' + p.id))
      if (!cands.length) { if (ph !== 3) nonAff++; return }
      const rec = pl[PH_CLE[ph]]
      const deja = ou[o.id + '#' + ph]
      let force = null, ancre = false
      if (rec && rec.equip != null && (rec.statut === 'En cours' || rec.statut === 'Terminé') && cands.some(e => e.id === rec.equip)) { force = rec.equip; ancre = true }
      else if (deja && deja.item.epingle) force = deja.eqId
      else if (idx === 0 && o.equipement_id && cands.some(e => e.id === o.equipement_id)) force = o.equipement_id
      demandes.push({ o, p, ph, rec, deja, echeance, cands, force, ancre })
    })
  }
  // --- Répartition par CAMPAGNE ENTIÈRE : tous les lots d'un même produit sur une phase vont sur
  // le même équipement. Lots imposés (suivi / 📌 / réservé) d'abord ; une campagne suit l'équipement
  // où un de ses lots est imposé ; sinon les campagnes (plus grosses d'abord) vont sur l'équipement
  // identique le moins chargé.
  const affect = new Map()
  for (const d of demandes) if (d.force != null) { affect.set(d, d.force); charge[d.force] = (charge[d.force] || 0) + dureeSur(d.force, d.p.id) }
  const groupes = {}
  for (const d of demandes) if (d.force == null) (groupes[d.ph + '#' + d.p.id] = groupes[d.ph + '#' + d.p.id] || []).push(d)
  const listeG = Object.values(groupes).map(g => ({ g, h: g.reduce((t, d) => t + dureeSur(d.cands[0].id, d.p.id), 0) })).sort((x, y) => y.h - x.h)
  for (const { g } of listeG) {
    const d0 = g[0]
    // équipement où la campagne a déjà un lot imposé (en cours / épinglé / réservé)
    const ancre = demandes.find(d => d.ancre && d.ph === d0.ph && d.p.id === d0.p.id && d0.cands.some(e => e.id === d.force))
    let cible = ancre ? ancre.force : null
    if (cible == null) { let bc = Infinity; for (const e of d0.cands) { const c = charge[e.id] || 0; if (c < bc) { bc = c; cible = e.id } } }
    for (const d of g) { affect.set(d, cible); charge[cible] = (charge[cible] || 0) + dureeSur(cible, d.p.id) }
  }
  for (const d of demandes) {
    const cible = affect.get(d); if (cible == null) continue
    const ancien = d.deja && d.deja.eqId === cible ? d.deja.item : null
    const item = ancien ? { ...ancien, auto: ancien.auto === false ? false : true } : { ordreId: d.o.id, lot: d.o.numero_lot || '—', pid: d.p.id, decalage: 0, dateDebut: '', auto: true }
    item._cle = { cours: (d.rec && d.rec.statut === 'En cours') ? 0 : 1, ech: d.echeance, pid: d.p.id, lot: String(d.o.numero_lot || '') }
    ;(voulu[cible] = voulu[cible] || []).push(item)
  }
  let ajout = 0, retrait = 0, modifies = 0
  for (const eq of equipsFab) {
    const ancien = panierEquip[eq.id] || []
    const v = voulu[eq.id] || []
    const vIds = new Set(v.map(x => x.ordreId))
    // conservés hors synchro : ajoutés à la main (non auto), 📌 épinglés, exclus
    const garder = ancien.filter(x => !vIds.has(x.ordreId) && (x.auto === false || x.epingle || x.exclu || etatLot(eq, x.ordreId).etat === 'termine'))   // terminés gardés pour l'affichage (retirés quand l'OF est fini)
    // tri : en cours, puis campagnes (produit le plus urgent d'abord), puis échéance, puis n° de lot
    const echProd = {}
    for (const x of v) echProd[x._cle.pid] = Math.min(echProd[x._cle.pid] ?? Infinity, x._cle.ech)
    v.sort((a, b) => (a._cle.cours - b._cle.cours) || ((echProd[a._cle.pid] - echProd[b._cle.pid]) || 0) || String(a._cle.pid).localeCompare(String(b._cle.pid)) || ((a._cle.ech - b._cle.ech) || 0) || a._cle.lot.localeCompare(b._cle.lot, undefined, { numeric: true }))
    let nouveau = [...v.map(({ _cle, ...r }) => r), ...garder]
    if (ordreManuel[eq.id]) {
      // ordre réajusté à la main : on garde l'ordre existant, les nouveaux lots sont ajoutés à la fin
      const vMap = new Map(v.map(({ _cle, ...r }) => [r.ordreId, r])), gIds = new Set(garder.map(x => x.ordreId)), avIds0 = new Set(ancien.map(x => x.ordreId))
      const gardes = ancien.filter(x => vMap.has(x.ordreId) || gIds.has(x.ordreId)).map(x => vMap.get(x.ordreId) || x)
      nouveau = [...gardes, ...v.filter(x => !avIds0.has(x.ordreId)).map(({ _cle, ...r }) => r)]
    }
    const avIds = new Set(ancien.map(x => x.ordreId)), apIds = new Set(nouveau.map(x => x.ordreId))
    for (const id of apIds) if (!avIds.has(id)) ajout++
    for (const id of avIds) if (!apIds.has(id)) retrait++
    const sig = (arr) => JSON.stringify(arr.map(x => [x.ordreId, x.auto, x.epingle, x.exclu, x.dateDebut, x.decalage]))
    if (sig(ancien) !== sig(nouveau)) { panierEquip[eq.id] = nouveau; sauverPanier(eq.id); modifies++ }
  }
  syncInfo.value = { quand: new Date(), lots: nbLots, ajout, retrait, nonAff, modifies }
}
function monterLot(idx, dir) {
  const id = panierOuvert.value.id, pan = panierEquip[id]; const j = idx + dir
  if (!pan || j < 0 || j >= pan.length) return
  const [it] = pan.splice(idx, 1); pan.splice(j, 0, it); ordreManuel[id] = true; sauverPanier(id)
}
function ordreAuto() { const id = panierOuvert.value.id; ordreManuel[id] = false; sauverPanier(id); synchroniserPaniers() }
// équipements de la même phase pouvant recevoir ce lot (cadence)
function ciblesPossibles(item) {
  const src = panierOuvert.value; if (!src) return []
  return equipements.value.filter(e => estFab(e.type) && e.id !== src.id && phaseOrdre(e.type) === phaseOrdre(src.type) && !!cadRef(e.id, item.pid)).sort((a, b) => String(a.code).localeCompare(String(b.code)))
}
function deplacerDepuisPanier(item, ev) { const cib = Number(ev.target.value); ev.target.value = ''; if (cib) deplacerLot(panierOuvert.value.id, cib, item.ordreId, null) }
// Mode MANUEL : retire des paniers les lots ajoutés automatiquement, sauf épinglés / en cours / terminés ;
// les lots conservés deviennent manuels.
function purgerLotsAuto() {
  const eqs = equipements.value
  for (const eqId in panierEquip) {
    const pan = panierEquip[eqId]; if (!Array.isArray(pan) || !pan.length) continue
    const eq = eqs.find(e => String(e.id) === String(eqId))
    let modif = false
    const garde = pan.filter(x => {
      if (x.auto !== true) return true
      const et = eq ? etatLot(eq, x.ordreId).etat : 'plan'
      if (x.epingle || et === 'cours' || et === 'termine') { x.auto = false; modif = true; return true }
      modif = true; return false
    })
    if (modif) { panierEquip[eqId] = garde; sauverPanier(Number(eqId)) }
  }
}
// Ajout manuel : tous les lots en attente d'un produit (campagne) d'un coup
function ajouterCampagne(pid) { for (const l of lotsAjoutables.value.filter(x => x.pid === pid)) ajouterLot(l) }
function basculerEpingle(it) { it.epingle = !it.epingle; sauverPanier(panierOuvert.value.id) }
function basculerExclu(it) { it.exclu = !it.exclu; sauverPanier(panierOuvert.value.id) }

// Statut d'un lot sur la PHASE d'un équipement : 'termine' | 'cours' | 'plan' (+ dates réelles)
const PH_CLE = { 1: 'pesee', 2: 'granulation', 3: 'granulation', 4: 'melange', 5: 'compression', 6: 'remplissage', 7: 'pelliculage' }
function etatLot(eq, ordreId) {
  if (enCoursIds.value.has(String(eq.id) + '#' + ordreId)) {
    const r = (dpPhasesLot.value[ordreId] || {})[PH_CLE[phaseOrdre(eq.type)]] || {}
    return { etat: 'cours', debut: r.debut ? new Date(r.debut) : null }
  }
  const r = (dpPhasesLot.value[ordreId] || {})[PH_CLE[phaseOrdre(eq.type)]]
  if (r && r.statut === 'Terminé') return { etat: 'termine', debut: r.debut ? new Date(r.debut) : null, fin: r.fin ? new Date(r.fin) : null }
  return { etat: 'plan' }
}
const afficherTermines = ref((() => { try { return localStorage.getItem('pe_termines') !== '0' } catch (e) { return true } })())
watch(afficherTermines, (v) => { try { localStorage.setItem('pe_termines', v ? '1' : '0') } catch (e) {} })
// eqId -> [{ ordreId, lot, code, desig, phase, depuis }]
const enCoursListe = computed(() => {
  const m = {}
  for (const o of ofs.value) {
    if (o.statut === 'Libéré' || o.statut === 'Rejeté') continue
    if (!o.date_lancement || o.date_fin_fabrication) continue
    const pl = dpPhasesLot.value[o.id]
    if (!pl || !Object.keys(pl).length) continue
    const p = o.produits || {}
    const gammeB = (Array.isArray(p.gamme) && p.gamme.length) ? p.gamme : DP_CANON_FAB
    const gamme = []; let pk = null
    for (const ph of gammeB) { const k = dpPhaseKey(ph); if (!k || k === pk || k === 'conditionnement') continue; gamme.push(k); pk = k }
    gamme.sort((a, b) => (DP_ORDRE[a] || 99) - (DP_ORDRE[b] || 99))
    let kCur = null
    for (const k of gamme) { const r = pl[k]; if (!r || r.statut !== 'Terminé') { kCur = k; break } }
    if (!kCur) continue                                  // fabrication terminée -> plus sur un équipement de fab
    const rCur = pl[kCur]
    if (!rCur || rCur.statut !== 'En cours' || rCur.equip == null) continue
    ;(m[rCur.equip] = m[rCur.equip] || []).push({ ordreId: o.id, lot: o.numero_lot || '—', code: p.code_pf || '—', desig: p.designation || '', phase: kCur === 'granulation' ? 'Granulation / Séchage' : DP_PHASE_NOM[kCur], depuis: rCur.date })
  }
  for (const k in m) m[k].sort((a, b) => String(a.depuis || '').localeCompare(String(b.depuis || '')))
  return m
})
// 1er lot en cours par équipement (+ nombre total) — utilisé par la colonne équipement
const enCoursEquip = computed(() => {
  const m = {}
  for (const id in enCoursListe.value) { const l = enCoursListe.value[id]; m[id] = { ...l[0], n: l.length } }
  return m
})
const enCoursIds = computed(() => { const s = new Set(); for (const id in enCoursListe.value) for (const x of enCoursListe.value[id]) s.add(String(id) + '#' + x.ordreId); return s })
const fmtDepuis = (d) => { if (!d) return ''; const x = new Date(d); return isNaN(x) ? String(d) : x.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) }
// Statut de chaque phase (1..7) par OF, depuis suivi_phases
const phasesLot = computed(() => {
  const m = {}
  for (const sp of suivi.value) {
    const po = phaseOrdre(sp.phase)
    if (po < 1 || po > 7) continue
    const id = sp.ordre_id
    if (!m[id]) m[id] = {}
    if (!m[id][po] || sp.statut === 'Terminé') m[id][po] = sp.statut
  }
  return m
})
const GAMME_LIB = { 1: 'Pesée', 2: 'Granulation', 3: 'Séchage', 4: 'Mélange', 5: 'Compression', 6: 'Remplissage', 7: 'Pelliculage' }
const GAMME_DEF = ['Pesée', 'Granulation', 'Séchage', 'Mélange', 'Compression', 'Remplissage', 'Pelliculage']
// Lots réels en attente par phase (à leur 1re phase de gamme non terminée, non démarrée)
const lotsAttentePhase = computed(() => {
  const q = {}
  for (const o of ofs.value) {
    if (o.statut === 'Libéré' || o.statut === 'Rejeté' || o.date_fin_fabrication) continue
    const prod = o.produits || {}
    const gammeB = (Array.isArray(prod.gamme) && prod.gamme.length) ? prod.gamme : GAMME_DEF
    const phases = [...new Set(gammeB.map(phaseOrdre).filter(x => x >= 1 && x <= 7))].sort((a, b) => a - b)
    if (!phases.length) continue
    const pl = phasesLot.value[o.id] || {}
    const base = { id: o.id, lot: o.numero_lot || '—', pid: prod.id, code: prod.code_pf || '—', desig: prod.designation || '' }
    if (Object.keys(pl).length === 0) {
      // OF sans phase enregistrée (planifié / non démarré) -> proposé sur TOUTES les phases de sa gamme
      const planifie = !o.date_lancement
      for (const po of phases) { if (!q[po]) q[po] = []; q[po].push({ ...base, plan: planifie }) }
    } else {
      // OF en fabrication -> à sa phase courante (1re non terminée), en attente OU en cours
      let cur = null
      for (const po of phases) { if (pl[po] !== 'Terminé') { cur = po; break } }
      if (cur == null) continue
      if (!q[cur]) q[cur] = []
      q[cur].push({ ...base, cours: pl[cur] === 'En cours' })
      // … et proposé aussi sur les phases SUIVANTES de sa gamme, pour pouvoir le planifier à l'avance
      const libCur = GAMME_LIB[cur] || ''
      for (const po of phases) if (po > cur) { if (!q[po]) q[po] = []; q[po].push({ ...base, amont: libCur }) }
    }
  }
  return q
})
const pdpQty = computed(() => {
  const m = {}
  for (const r of planRaw.value) {
    if (Number(r.annee) !== annee.value) continue
    m[r.produit_id] = (m[r.produit_id] || 0) + Number(r.quantite_planifiee || 0)
  }
  return m
})

// Types fabrication
const FAB = /pes[ée]|balance|bascule|granul|s[ée]ch|m[ée]lang|compress|presse|compri|g[ée]lule|remplis|encapsul|capsul|pellicul|enrob|coat|drag[ée]/i
const estFab = (type) => FAB.test(String(type || ''))
// Ordre des phases (pour trier les équipements)
function phaseOrdre(type) {
  const t = String(type || '').toLowerCase()
  if (/pes[ée]|balance|bascule/.test(t)) return 1
  if (/granul/.test(t)) return 2
  if (/s[ée]ch/.test(t)) return 3
  if (/m[ée]lang/.test(t)) return 4
  if (/compress|presse|compri/.test(t)) return 5
  if (/g[ée]lule|remplis|encapsul|capsul/.test(t)) return 6
  if (/pellicul|enrob|coat|drag[ée]/.test(t)) return 7
  return 99
}

// Poids d'un lot en Kg (taille_lot boîtes × unités/boîte × poids unitaire mg)
function poidsLotKg(prod) {
  const boites = Number(prod.taille_lot) || 0
  const upb = Number(prod.unites_par_boite) || 0
  const pmg = Number(prod.poids_unitaire_mg) || 0
  return (boites * upb * pmg) / 1e6 // mg -> Kg
}
// Nombre de turbines par produit (pelliculage) — éditable ici
const TURBINES = [
  { rx: /panadol.*\b1\s*g/i, n: 21 },
  { rx: /panadol.*extra/i, n: 8 },
  { rx: /panadol.*(rhume|grippe)/i, n: 2 },
  { rx: /lipanthyl.*160/i, n: 6 }
]
function nbTurbines(prod) {
  const t = (prod.designation || '') + ' ' + (prod.code_pf || '')
  for (const x of TURBINES) if (x.rx.test(t)) return x.n
  return 1
}
// Durée d'un lot (h) : cadence en Kg/h
// Unité de cadence : 'unites' (unités/h, cp/h, gél/h…) ou 'kg' (kg/h, par défaut en fabrication)
// ===== Cadences : SEULE source = référentiel « Cadences & paramètres par équipement » =====
// Même lecture que la matrice : machines identiques (même phase + même nom sans le n° final)
// regroupées, valeur du groupe = la plus haute saisie ; unité = kg/h (fabrication), sans tenir
// compte de l'unité éventuellement enregistrée ailleurs (Saisie TRS).
const baseNomEq = (nom) => String(nom || '').trim().replace(/\s+(\d{1,2})\s*$/, (m, n) => (Number(n) <= 20 ? '' : m)).trim().toLowerCase()
const cadRefIndex = computed(() => {
  const grp = {}
  for (const e of equipements.value) grp[String(e.id)] = phaseOrdre(e.type) + '|' + baseNomEq(e.nom || e.code)
  const m = new Map()
  for (const c of cadences.value) {
    const g = grp[String(c.equipement_id)]; const v = Number(c.cadence_nominale) || 0
    if (g == null || v <= 0) continue
    const k = g + '#' + String(c.produit_id)
    if (!m.has(k) || v > m.get(k)) m.set(k, v)
  }
  return { grp, m }
})
function cadRef(eqId, pid) {
  const r = cadRefIndex.value, g = r.grp[String(eqId)]; if (g == null) return null
  const v = r.m.get(g + '#' + String(pid))
  return v ? { equipement_id: eqId, produit_id: pid, cadence_nominale: v, unite_cadence: 'kg/h' } : null
}
// Unité « unités/h » prise en compte seulement si la valeur est plausible (≥ 500 unités/h) :
// une cadence de 16 marquée « unités/h » est en réalité des kg/h (la matrice affiche kg/h).
const SEUIL_UNITES = 500
const uniteDeclaree = (cad) => { const u = String((cad && cad.unite_cadence) || '').toLowerCase(); return /unit|cp|comp|g[ée]l|caps|pi[eè]ce|u\/h/.test(u) ? 'unites' : 'kg' }
function uniteCad() { return 'kg' }   // référentiel = kg/h
const nbUnitesLot = (prod) => (Number(prod.taille_lot) || 0) * (Number(prod.unites_par_boite) || 0)
// Durée d'un lot + origine du calcul (pour le contrôle des données)
function dureeInfo(prod, cad) {
  if (!cad) return { h: 8, src: 'defaut', raison: 'Pas de cadence pour ce produit sur cet équipement' }
  const c = Number(cad.cadence_nominale) || 0
  if (c <= 0) return { h: 8, src: 'defaut', raison: 'Cadence nulle' }
  if (uniteCad(cad) === 'unites') {
    const n = nbUnitesLot(prod)
    if (n <= 0) return { h: 8, src: 'defaut', raison: 'Cadence en unités/h mais taille de lot ou unités/boîte manquante' }
    return { h: n / c, src: 'unites', raison: '' }
  }
  const kg = poidsLotKg(prod)
  if (kg <= 0) {
    const manque = [!(Number(prod.taille_lot) > 0) && 'taille de lot', !(Number(prod.unites_par_boite) > 0) && 'unités/boîte', !(Number(prod.poids_unitaire_mg) > 0) && 'poids unitaire'].filter(Boolean).join(', ')
    return { h: 8, src: 'defaut', raison: 'Fiche produit incomplète (' + manque + ')' }
  }
  return { h: kg / c, src: 'kg', raison: '' }
}
function dureeLotH(prod, cad) { return dureeInfo(prod, cad).h }
const fmtN = (x, d = 1) => Number(x).toLocaleString('fr-FR', { maximumFractionDigits: d })
// Explication lisible du calcul de durée
function calculTxt(prod, cad) {
  const d = dureeInfo(prod, cad)
  const det = (Number(prod.taille_lot) || 0) + ' bts × ' + (Number(prod.unites_par_boite) || 0) + ' u/bt'
  if (d.src === 'defaut') return 'durée par défaut 8 h (' + d.raison.toLowerCase() + ')'
  if (d.src === 'unites') return det + ' = ' + fmtN(nbUnitesLot(prod), 0) + ' u ÷ ' + fmtN(cad.cadence_nominale) + ' u/h = ' + fmtN(d.h) + ' h'
  return det + ' × ' + fmtN(prod.poids_unitaire_mg) + ' mg = ' + fmtN(poidsLotKg(prod)) + ' kg ÷ ' + fmtN(cad.cadence_nominale) + ' kg/h = ' + fmtN(d.h) + ' h'
}

const addH = (d, h) => new Date(d.getTime() + h * 3600000)

// --- Gestion des week-ends (vendredi=5, samedi=6) ---
const isoL = (d) => { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const j = String(d.getDate()).padStart(2, '0'); return y + '-' + m + '-' + j }
// requis = Map(dateISO -> régime). Régime effectif du jour d (ou null si chômé).
let maintCourant = []
function maintA(d) { const t = d.getTime(); for (const m of maintCourant) if (t >= m.debut && t < m.fin) return m; return null }
function buildMaintList(arr) {
  const out = []
  for (const m of (arr || [])) {
    if (!m || !m.debut) continue
    const deb = new Date(m.debut).getTime()
    if (isNaN(deb)) continue
    const dur = Math.max(0.25, Number(m.dureeH) || 0)
    out.push({ debut: deb, fin: deb + dur * 3600000, type: m.type || 'prev' })
  }
  return out
}
// Régime d'un jour de week-end (ven.=5 / sam.=6) : '2x8', '3x8' ou null (chômé)
function regWeekend(d, weAll, requis) {
  // Réquisition week-end : 2 shifts 06h00–22h00 (2×8)
  if (weAll) return '2x8'
  return (requis && requis.get(isoL(d))) || null
}
// Semaine de travail : du samedi 22h00 au jeudi 22h00.
//  - 3×8 : continu du sam. 22h00 au jeu. 22h00
//  - 2×8 : 06h00–22h00 du dimanche au jeudi
//  - ven./sam. : uniquement sur réquisition (2×8 06h–22h par défaut, 3×8 possible)
function ouvertRegime(d, regimeEq, weAll, requis) {
  const j = d.getDay(), h = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600
  // Jeu. 22h→ven. 06h et ven. 22h→sam. 06h : toujours OFF
  if (j === 4 && h >= 22) return false
  if (j === 5) return !!regWeekend(d, weAll, requis) && h >= 6 && h < 22
  if (j === 6) {
    if (h >= 22) return regimeEq === '3x8'                   // reprise de la semaine (poste de nuit)
    return !!regWeekend(d, weAll, requis) && h >= 6
  }
  return regimeEq === '3x8' ? true : (h >= 6 && h < 22)
}
// Prochaine bascule possible (00h, 06h, 22h ou début/fin d'arrêt maintenance)
function prochaineBascule(d) {
  const t = d.getTime(); let best = Infinity
  for (const hh of [0, 6, 22]) {
    const c = new Date(d); c.setHours(hh, 0, 0, 0)
    if (c.getTime() <= t) c.setDate(c.getDate() + 1)
    if (c.getTime() < best) best = c.getTime()
  }
  for (const m of maintCourant) { if (m.debut > t && m.debut < best) best = m.debut; if (m.fin > t && m.fin < best) best = m.fin }
  return new Date(best)
}
function buildRequisMap(arr, regimeEq) {
  const m = new Map()
  for (const x of (arr || [])) {
    if (x && typeof x === 'object' && x.d) m.set(x.d, x.r || '2x8')
    else if (typeof x === 'string') m.set(x, '2x8')
  }
  return m
}
// Prochain instant ouvré
function prochainOuvre(d, regimeEq, weAll, requis) {
  let c = new Date(d); let g = 0
  while (g++ < 5000) {
    if (estOuvre(c, regimeEq, weAll, requis)) return c
    c = prochaineBascule(c)
  }
  return c
}
// Fin de la plage ouvrée courante
function finOuvre(d, regimeEq, weAll, requis) {
  let c = new Date(d); let g = 0
  while (g++ < 5000) {
    const nb = prochaineBascule(c)
    if (!estOuvre(nb, regimeEq, weAll, requis)) return nb
    c = nb
  }
  return c
}
// Place une tâche de durée dureeH selon régime + jours ouvrés -> segments + fin
function placer(start, dureeH, regime, weAll, requis) {
  let cursor = prochainOuvre(new Date(start), regime, weAll, requis)
  let reste = dureeH; const segments = []; let g = 0
  while (reste > 0.001 && g++ < 3000) {
    const fin = finOuvre(cursor, regime, weAll, requis)
    const dispo = (fin - cursor) / 3600000
    if (dispo >= reste) { segments.push({ start: new Date(cursor), end: addH(cursor, reste) }); cursor = addH(cursor, reste); reste = 0 }
    else { if (dispo > 0.001) segments.push({ start: new Date(cursor), end: new Date(fin) }); reste -= Math.max(0, dispo); cursor = prochainOuvre(new Date(fin), regime, weAll, requis) }
  }
  if (!segments.length) segments.push({ start: new Date(start), end: new Date(start) })
  return { segments, end: cursor }
}
// Placement d'un lot en UN SEUL TENANT si noSplit (aucune coupure nuit en 2x8 ni week-end).
// Si le lot ne tient pas dans la fenêtre courante, on décale au début de la fenêtre suivante.
function placerLot(start, dureeH, regime, weAll, requis, noSplit) {
  let sdeb = prochainOuvre(new Date(start), regime, weAll, requis)
  if (noSplit) {
    let report0 = null, g = 0
    while (g++ < 200) {
      const pl = placer(sdeb, dureeH, regime, weAll, requis)
      if (pl.segments.length <= 1) return pl          // tient d'un seul bloc -> OK
      if (!report0) report0 = new Date(pl.segments[1].start)   // 1re ouverture de poste après un OFF
      sdeb = new Date(pl.segments[1].start)            // décalage à la fenêtre suivante
    }
    // Lot plus long que toute fenêtre de travail : démarrer à la 1re ouverture de poste
    // suivante (pas à cheval sur l'OFF dès le départ), puis laisser couper.
    if (report0) return placer(report0, dureeH, regime, weAll, requis)
  }
  return placer(sdeb, dureeH, regime, weAll, requis)
}
// Place le NETTOYAGE puis le LOT.
// Règle : le LOT ne démarre que s'il sera clôturé avant l'OFF (nuit, week-end chômé, arrêt maintenance) ;
// sinon il démarre au poste ouvré suivant. Le NETTOYAGE n'est pas soumis à cette règle : il est fait
// juste avant le lot, et peut donc se dérouler avant l'OFF (fin de poste) pour un lot lancé à la reprise.
//  - cursor       : équipement libre à partir de cet instant
//  - lotAuPlusTot : le lot ne peut pas démarrer avant (phase précédente, décalage, date imposée)
// Si le lot est plus long que la plus longue plage ouvrée, il démarre en début de plage et est coupé (coupe: true).
function placerBloc(cursor, lotAuPlusTot, C, D, regime, weAll, requis) {
  const finNettMin = placer(cursor, C, regime, weAll, requis).end           // nettoyage au plus tôt
  const t1 = new Date(Math.max(finNettMin.getTime(), lotAuPlusTot.getTime()))
  let s = prochainOuvre(t1, regime, weAll, requis), g = 0, lot = null, coupe = false
  while (g++ < 120) {
    const W = finOuvre(s, regime, weAll, requis)
    if (s.getTime() + D * 3600000 <= W.getTime() + 1000) { lot = { segments: [{ start: new Date(s), end: new Date(s.getTime() + D * 3600000) }], end: new Date(s.getTime() + D * 3600000) }; break }
    s = prochainOuvre(new Date(W), regime, weAll, requis)
  }
  if (!lot) { lot = placer(prochainOuvre(t1, regime, weAll, requis), D, regime, weAll, requis); coupe = true }
  // Nettoyage calé juste avant le lot (heures ouvrées), sans démarrer avant que l'équipement soit libre
  const lotStart = lot.segments[0].start
  let cs = reculerNettoyage(lotStart, C, regime, weAll, requis)
  if (cs < cursor) cs = new Date(cursor)
  const clean = placer(cs, C, regime, weAll, requis)
  return { clean, lot, coupe }
}
// Bascule précédente (00h, 06h, 22h ou bornes d'arrêt maintenance) strictement avant d
function basculePrecedente(d) {
  const t = d.getTime(); let best = -Infinity
  for (const hh of [0, 6, 22]) { const c = new Date(d); c.setHours(hh, 0, 0, 0); if (c.getTime() >= t) c.setDate(c.getDate() - 1); if (c.getTime() > best) best = c.getTime() }
  for (const m of maintCourant) { if (m.debut < t && m.debut > best) best = m.debut; if (m.fin < t && m.fin > best) best = m.fin }
  return new Date(best)
}
// Début exact de la plage ouvrée qui contient l'instant juste avant 'fin'
function debutPlageExact(fin, regime, weAll, requis) {
  let x = new Date(fin), g = 0
  while (g++ < 500) { const p = basculePrecedente(x); if (!estOuvre(p, regime, weAll, requis)) return x; x = p }
  return x
}
// Recule de dureeH heures OUVRÉES à partir de 'end' (en sautant les plages OFF) -> instant de début
function reculerNettoyage(end, dureeH, regime, weAll, requis) {
  let reste = dureeH, curEnd = new Date(end), g = 0
  while (reste > 0.001 && g++ < 300) {
    let c = new Date(curEnd.getTime() - 1), k = 0
    while (!estOuvre(c, regime, weAll, requis) && k++ < 20000) c = new Date(c.getTime() - 60000)
    const pf = new Date(Math.min(curEnd.getTime(), finOuvre(c, regime, weAll, requis).getTime()))
    const deb = debutPlageExact(pf, regime, weAll, requis)
    const dispo = (pf - deb) / 3600000
    if (dispo >= reste) return new Date(pf.getTime() - reste * 3600000)
    reste -= dispo; curEnd = new Date(deb)
  }
  return curEnd
}
// Instant ouvré ? (régime variable par jour)
function estOuvre(d, regimeEq, weAll, requis) {
  if (maintA(d)) return false
  return ouvertRegime(d, regimeEq, weAll, requis)
}
// Début de la plage ouvrée qui se termine à 'd'
function debutPlageAvant(d, regime, weAll, requis) {
  let c = new Date(d.getTime() - 1); let g = 0
  while (!estOuvre(c, regime, weAll, requis) && g++ < 20000) c = new Date(c.getTime() - 60000)
  let deb = new Date(c); g = 0
  while (g++ < 20000) { const t = new Date(deb.getTime() - 60000); if (!estOuvre(t, regime, weAll, requis)) break; deb = t }
  return deb
}
// Recule de dureeH heures ouvrées à partir de 'end' -> instant de début
function reculerOuvre(end, dureeH, regime, weAll, requis) {
  let curEnd = new Date(end); let reste = dureeH; let g = 0
  while (reste > 0.001 && g++ < 300) {
    const deb = debutPlageAvant(curEnd, regime, weAll, requis)
    const dispo = (curEnd - deb) / 3600000
    if (dispo >= reste) return new Date(curEnd.getTime() - reste * 3600000)
    reste -= dispo
    curEnd = new Date(deb.getTime() - 1)
  }
  return curEnd
}
function planifierTaches(lots, tDep, regime, weAll, requis, pVdlt, pVdlp, pHoldingH) {
  const tasks = []
  let cursor = prochainOuvre(new Date(tDep), regime, weAll, requis)
  const push = (type, dureeH, extra) => {
    const pl = placer(cursor, dureeH, regime, weAll, requis)
    tasks.push({ type, ...(extra || {}), segments: pl.segments, start: pl.segments[0].start, end: pl.end })
    cursor = pl.end
  }
  let lastPid = null, lastGen = null
  const cpt = {}
  for (const lot of lots) {
    const holdingDep = lastGen && (cursor - lastGen) / 3600000 > pHoldingH
    let cln
    if (lastPid === null || lot.pid !== lastPid) cln = 'gen'   // 1er lot ou produit différent -> nettoyage général
    else if (holdingDep) cln = 'genH'                          // validité campagne dépassée -> nettoyage général
    else cln = 'part'                                          // même produit -> nettoyage partiel
    if (cln === 'gen' || cln === 'genH') { push(cln, pVdlt); lastGen = new Date(cursor) }
    else push('part', pVdlp)
    cpt[lot.pid] = (cpt[lot.pid] || 0) + 1
    push('lot', lot.dLot, { prod: lot.prod, n: cpt[lot.pid], uid: lot.uid })
    lastPid = lot.pid
  }
  return { tasks, fin: cursor }
}

// Moteur d'ordonnancement
// --- Panier par équipement (produits à planifier + ordre) ---
const panierEquip = reactive({})
const panierOuvert = ref(null)
const rechProd = ref('')
// Glisser-déposer des campagnes sur le Gantt
const dragInfo = ref(null)
function dragStart(eqId, uid) { dragInfo.value = { eqId, uid } }
const dragTemps = ref(null)
function itemDecal(eqId, uid) { const pan = panierEquip[eqId]; const it = pan && pan.find(x => x.ordreId === uid); return it ? (Number(it.decalage) || 0) : 0 }
function debutDragTemps(e, eqId, uid) {
  if (e.button !== 0) return
  e.preventDefault()
  dragTemps.value = { eqId, uid, startX: e.clientX, startY: e.clientY, startDecal: itemDecal(eqId, uid), deltaH: 0, deltaY: 0, mode: e.shiftKey ? 'decal' : 'deplacer', cible: eqId, ok: true, tDrop: null }
  window.addEventListener('mousemove', moveDragTemps)
  window.addEventListener('mouseup', finDragTemps)
}
function moveDragTemps(e) {
  const d = dragTemps.value; if (!d) return
  const n = { ...d, deltaH: (e.clientX - d.startX) / pxH.value, deltaY: d.mode === 'deplacer' ? (e.clientY - d.startY) : 0 }
  if (d.mode === 'deplacer') {
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const row = el && el.closest ? el.closest('.g-row[data-eq]') : null
    if (row) {
      n.cible = Number(row.dataset.eq)
      const tr = row.querySelector('.g-track:not(.g-timeline)')
      if (tr) { const r = tr.getBoundingClientRect(); n.tDrop = new Date(tAff.value.getTime() + ((e.clientX - r.left) / pxH.value) * 3600000) }
      n.ok = verifCible(d.eqId, n.cible, d.uid) === ''
    }
  }
  dragTemps.value = n
}
// '' si le lot peut aller sur l'équipement cible, sinon la raison
function verifCible(src, cib, uid) {
  if (String(src) === String(cib)) return ''
  const eS = equipements.value.find(x => String(x.id) === String(src)), eC = equipements.value.find(x => String(x.id) === String(cib))
  if (!eS || !eC) return 'Équipement introuvable'
  if (phaseOrdre(eS.type) !== phaseOrdre(eC.type)) return eC.code + ' n\'est pas de la même phase'
  const it = (panierEquip[src] || []).find(x => x.ordreId === uid); if (!it) return 'Lot introuvable'
  if (!cadRef(cib, it.pid)) return eC.code + ' n\'a pas de cadence pour ce produit'
  return ''
}
// Insère le lot dans le panier de 'cib' juste avant le 1er lot planifié qui démarre après tDrop
function placerDansPanier(cib, item, tDrop) {
  const pan = (panierEquip[cib] = panierEquip[cib] || [])
  const row = planningTous.value.find(r => String(r.eq.id) === String(cib))
  let idx = pan.length
  if (tDrop && row) {
    const debut = {}; for (const t of row.tasks) if (t.type === 'lot' && debut[t.uid] == null) debut[t.uid] = t.segments[0].start.getTime()
    const i = pan.findIndex(x => x.ordreId !== item.ordreId && debut[x.ordreId] != null && debut[x.ordreId] > tDrop.getTime())
    if (i >= 0) idx = i
  }
  pan.splice(idx, 0, item)
}
const msgDeplacement = ref('')
function deplacerLot(src, cib, uid, tDrop) {
  const raison = verifCible(src, cib, uid)
  if (raison) { msgDeplacement.value = '⚠ Déplacement refusé : ' + raison; setTimeout(() => { msgDeplacement.value = '' }, 5000); return false }
  const pS = panierEquip[src] || [], i = pS.findIndex(x => x.ordreId === uid); if (i < 0) return false
  const [item] = pS.splice(i, 1)
  item.decalage = 0; item.dateDebut = ''
  if (String(src) !== String(cib)) item.epingle = true      // changé de ligne : épinglé pour que la synchro ne le ramène pas
  placerDansPanier(cib, item, tDrop)
  ordreManuel[cib] = true
  sauverPanier(cib); if (String(src) !== String(cib)) sauverPanier(src)
  const eC = equipements.value.find(x => String(x.id) === String(cib))
  msgDeplacement.value = '✓ Lot ' + item.lot + (String(src) !== String(cib) ? ' déplacé sur ' + (eC ? eC.code : '') + ' (📌 épinglé)' :  ' repositionné')
  setTimeout(() => { msgDeplacement.value = '' }, 5000)
  return true
}
function finDragTemps() {
  window.removeEventListener('mousemove', moveDragTemps)
  window.removeEventListener('mouseup', finDragTemps)
  const d = dragTemps.value; dragTemps.value = null
  if (!d) return
  // Simple clic (pas de glissement) : suivre / ne plus suivre ce lot sur toutes ses phases
  if (Math.abs(d.deltaH * pxH.value) < 4 && Math.abs(d.deltaY) < 6) { lotSuivi.value = (lotSuivi.value === d.uid) ? null : d.uid; return }
  if (d.mode === 'deplacer') { deplacerLot(d.eqId, d.cible, d.uid, d.tDrop); return }
  const nouveau = Math.max(0, Math.round((d.startDecal + d.deltaH) * 4) / 4)
  const pan = panierEquip[d.eqId]
  if (pan) { const it = pan.find(x => x.ordreId === d.uid); if (it) { it.decalage = nouveau; sauverPanier(d.eqId) } }
}
function resetDecal(eqId, uid) { const pan = panierEquip[eqId]; if (pan) { const it = pan.find(x => x.ordreId === uid); if (it && it.decalage) { it.decalage = 0; sauverPanier(eqId) } } }
function dropSur(eqId, uid) {
  const d = dragInfo.value; dragInfo.value = null
  if (!d || d.eqId !== eqId || d.uid === uid) return
  const arr = panierEquip[eqId]; if (!arr) return
  const from = arr.findIndex(i => i.ordreId === d.uid); if (from < 0) return
  const [moved] = arr.splice(from, 1)
  const to = arr.findIndex(i => i.ordreId === uid)
  if (to < 0) arr.push(moved); else arr.splice(to, 0, moved)
  sauverPanier(eqId)
}
const panierErreur = ref('')
async function sauverPanier(id) {
  try {
    const r = await supabase.from('planning_panier').upsert({ equipement_id: id, produits: { lots: panierEquip[id] || [], regime: regimeEquip[id] || '3x8', requis: requisEquip[id] || [], we: weOn(id), maint: maintEquip[id] || [], om: !!ordreManuel[id] }, updated_at: new Date().toISOString() }, { onConflict: 'equipement_id' })
    panierErreur.value = r.error ? ('Panier non sauvegardé : ' + r.error.message + ' — crée la table planning_panier (voir SQL).') : ''
  } catch (e) { panierErreur.value = 'Panier non sauvegardé : ' + String(e) }
  sauverLocal()
}
function sauverLocal() {
  try {
    localStorage.setItem('pe_state', JSON.stringify({
      panier: panierEquip, regime: regimeEquip, requis: requisEquip, we: weekendEquip, maint: maintEquip,
      ft: filtreTexte.value, fp: filtrePhase.value, fap: filtreAvecPlan.value, px: pxH.value
    }))
  } catch (e) {}
}
function chargerLocal() {
  try {
    const raw = localStorage.getItem('pe_state'); if (!raw) return
    const st = JSON.parse(raw)
    if (st.panier) Object.assign(panierEquip, st.panier)
    if (st.regime) Object.assign(regimeEquip, st.regime)
    if (st.requis) Object.assign(requisEquip, st.requis)
    if (st.we) Object.assign(weekendEquip, st.we)
    if (st.maint) Object.assign(maintEquip, st.maint)
    if (st.ft != null) filtreTexte.value = st.ft
    if (st.fp != null) filtrePhase.value = st.fp
    if (typeof st.fap === 'boolean') filtreAvecPlan.value = st.fap
    if (st.px) pxH.value = st.px
  } catch (e) {}
}
watch([filtreTexte, filtrePhase, filtreAvecPlan, pxH], sauverLocal)
let uidCounter = 0
function uidGen() { return 'l' + Date.now().toString(36) + (uidCounter++) }
function ouvrirPanier(eq) { panierOuvert.value = eq; rechProd.value = '' }
function viderPanier() { if (!panierOuvert.value) return; if (!confirm('Vider le panier de cet équipement ?')) return; const id = panierOuvert.value.id; panierEquip[id] = []; sauverPanier(id) }
function ajouterLot(l) { if (!panierOuvert.value) return; const id = panierOuvert.value.id; if (!panierEquip[id]) panierEquip[id] = []; if (!panierEquip[id].some(i => i.ordreId === l.id)) panierEquip[id].push({ ordreId: l.id, lot: l.lot, pid: l.pid, auto: false }); sauverPanier(id) }
function retirerLot(idx) { if (!panierOuvert.value) return; const id = panierOuvert.value.id; const a = panierEquip[id]; if (a) { a.splice(idx, 1); sauverPanier(id) } }
const requisDate = ref('')
const requisRegime = ref('2x8')
function setRegime(v) { if (!panierOuvert.value) return; regimeEquip[panierOuvert.value.id] = v; sauverPanier(panierOuvert.value.id) }
function ajouterRequis() { if (!panierOuvert.value || !requisDate.value) return; const id = panierOuvert.value.id; if (!requisEquip[id]) requisEquip[id] = []; const d = requisDate.value; if (!requisEquip[id].some(x => (typeof x === 'object' ? x.d : x) === d)) requisEquip[id].push({ d, r: requisRegime.value }); requisEquip[id].sort((a, b) => ((a && a.d) || a).localeCompare((b && b.d) || b)); requisDate.value = ''; sauverPanier(id) }
function retirerRequis(dt) { if (!panierOuvert.value) return; const id = panierOuvert.value.id; requisEquip[id] = (requisEquip[id] || []).filter(x => (typeof x === 'object' ? x.d : x) !== dt); sauverPanier(id) }
const maintType = ref('prev')
const maintDebut = ref('')
const maintDuree = ref(8)
const maintLabel = ref('')
function ajouterMaint() { if (!panierOuvert.value || !maintDebut.value) return; const id = panierOuvert.value.id; if (!maintEquip[id]) maintEquip[id] = []; const it = { type: maintType.value, debut: maintDebut.value, dureeH: Math.max(0.25, Number(maintDuree.value) || 8) }; if (maintType.value === 'autre') it.label = (maintLabel.value || 'Autre').trim(); maintEquip[id].push(it); maintEquip[id].sort((a, b) => String(a.debut).localeCompare(String(b.debut))); maintDebut.value = ''; maintLabel.value = ''; sauverPanier(id) }
function retirerMaint(idx) { if (!panierOuvert.value) return; const id = panierOuvert.value.id; const a = maintEquip[id]; if (a) { a.splice(idx, 1); sauverPanier(id) } }
function fmtMaint(dt) { const d = new Date(dt); return isNaN(d) ? dt : d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) }
function maintAbrev(m) { const t = m.type; return t === 'curr' ? 'MC' : t === 'tech' ? 'AT' : t === 'autre' ? (m.label || 'Autre') : 'MP' }
function maintNom(m) { const t = m.type; return t === 'curr' ? 'Curatif' : t === 'tech' ? 'Technique' : t === 'autre' ? (m.label || 'Autre') : 'Préventif' }
function maintLibelle(m) { const t = m.type; return t === 'curr' ? 'Maintenance curative' : t === 'tech' ? 'Arrêt technique / essai / étalonnage' : t === 'autre' ? (m.label || 'Autre arrêt') : 'Maintenance préventive' }
function maintStyle(m) { const deb = new Date(m.debut).getTime(); const left = ((deb - tAff.value.getTime()) / 3600000) * pxH.value; const w = Math.max(2, (Number(m.dureeH) || 0) * pxH.value); return { left: left + 'px', width: w + 'px' } }
function produitNom(pid) { const p = produitsById.value[pid]; return p ? (p.code_pf + ' — ' + p.designation) : String(pid) }
const phaseOuvert = computed(() => panierOuvert.value ? phaseOrdre(panierOuvert.value.type) : null)
const lotsAjoutables = computed(() => {
  if (!panierOuvert.value) return []
  const ph = phaseOuvert.value
  const dans = new Set((panierEquip[panierOuvert.value.id] || []).map(i => i.ordreId))
  const q = rechProd.value.trim().toLowerCase()
  // lots déjà placés sur un autre équipement de la même phase : signalés
  const ailleurs = {}
  for (const eqId in panierEquip) { if (String(eqId) === String(panierOuvert.value.id)) continue; const e = equipements.value.find(x => String(x.id) === String(eqId)); if (!e || phaseOrdre(e.type) !== ph) continue; for (const it of panierEquip[eqId] || []) ailleurs[it.ordreId] = e.code }
  // seulement les produits qui passent sur cet équipement (cadence renseignée) ;
  // si l'équipement n'a encore aucune cadence, on affiche tout (avec un avertissement)
  const eqId = panierOuvert.value.id
  const prodsEq = new Set(produits.value.filter(p => cadRef(eqId, p.id)).map(p => String(p.id)))
  return (lotsAttentePhase.value[ph] || []).filter(l => !dans.has(l.id) && (!prodsEq.size || prodsEq.has(String(l.pid))) && (!q || (l.lot + ' ' + l.code + ' ' + (l.desig || '')).toLowerCase().includes(q))).map(l => ({ ...l, ailleurs: ailleurs[l.id] || '' })).slice(0, 300)
})
// Regroupés par produit (en cours / lancés d'abord), lots non encore placés ailleurs en premier
const panSansCadence = computed(() => { if (!panierOuvert.value) return false; const id = panierOuvert.value.id; return !produits.value.some(p => cadRef(id, p.id)) })
const lotsAjoutablesParProduit = computed(() => {
  const m = {}
  for (const l of lotsAjoutables.value) { (m[l.pid] = m[l.pid] || { pid: l.pid, code: l.code, desig: l.desig, lots: [], rang: 2 }).lots.push(l); if (l.cours) m[l.pid].rang = 0; else if (!l.plan) m[l.pid].rang = Math.min(m[l.pid].rang, 1) }
  const out = Object.values(m)
  for (const g of out) g.lots.sort((a, b) => (!!a.ailleurs - !!b.ailleurs) || String(a.lot).localeCompare(String(b.lot), undefined, { numeric: true }))
  return out.sort((a, b) => (a.rang - b.rang) || String(a.desig || a.code).localeCompare(String(b.desig || b.code)))
})

const planCalc = computed(() => {
  const t0v = new Date(dateDepart.value + 'T22:00:00')
  const q = filtreTexte.value.trim().toLowerCase()
  const equipsFab = equipements.value.filter(e => estFab(e.type))
  const paramsEq = (eq) => ({
    regime: regimeEquip[eq.id] || '3x8',
    weAll: weOn(eq.id),
    requis: buildRequisMap(requisEquip[eq.id], regimeEquip[eq.id] || '3x8'),
    vdlt: (eq.vdlt != null && eq.vdlt !== '') ? Number(eq.vdlt) : vdlt.value,
    vdlp: (eq.vdlp != null && eq.vdlp !== '') ? Number(eq.vdlp) : vdlp.value,
    holdingH: (eq.dht != null && eq.dht !== '') ? Number(eq.dht) * 24 : holdingH.value
  })
  const eqTasks = {}, eqCursor = {}, eqLastPid = {}, eqLastGen = {}
  const lotReady = {}  // pid#idx -> fin de la phase précédente du même lot
  // Ordonnancement de flux : phase par phase (1=pesée -> 7=pelliculage)
  for (let ph = 1; ph <= 7; ph++) {
    const eqsPh = equipsFab.filter(e => phaseOrdre(e.type) === ph).sort((a, b) => String(a.code).localeCompare(String(b.code)))
    for (const eq of eqsPh) {
      const pan = panierEquip[eq.id]
      if (!pan || !pan.length) continue
      const P = paramsEq(eq)
      maintCourant = buildMaintList(maintEquip[eq.id])
      if (eqCursor[eq.id] === undefined) eqCursor[eq.id] = prochainOuvre(new Date(t0v), P.regime, P.weAll, P.requis)
      if (!eqTasks[eq.id]) eqTasks[eq.id] = []
      // Ordre de traitement : terminés (dates réelles), puis en cours (calé sur le démarrage réel), puis planifiés
      const etats = {}
      for (const it of pan) etats[it.ordreId] = etatLot(eq, it.ordreId)
      const rang = { termine: 0, cours: 1, plan: 2 }
      const panTri = pan.map((it, i) => ({ it, i })).sort((a, b) => (rang[etats[a.it.ordreId].etat] - rang[etats[b.it.ordreId].etat]) || (etats[a.it.ordreId].etat === 'termine' ? ((etats[a.it.ordreId].debut || 0) - (etats[b.it.ordreId].debut || 0)) : 0) || (a.i - b.i)).map(x => x.it)
      // Choix du lot suivant : terminés / en cours d'abord (fixes), puis parmi les planifiés,
      // les lots PRÊTS quand l'équipement se libère, dans l'ordre de priorité du panier ;
      // si aucun n'est prêt, celui qui sera prêt le plus tôt.
      const restants = panTri.filter(it => !it.exclu)
      const pretA = (it) => { let r = lotReady[it.ordreId] || new Date(t0v); if (it.dateDebut) { const dd = new Date(it.dateDebut); if (!isNaN(dd) && dd > r) r = dd } return r.getTime() }
      const suivant = () => {
        return restants.shift()   // planification manuelle : ordre du panier respecté tel quel
        const libre = eqCursor[eq.id].getTime() + 1800000
        let iBest = -1
        // continuer la campagne : un lot prêt du même produit que le dernier passé sur l'équipement
        const lp = eqLastPid[eq.id]
        if (lp != null) for (let i = 0; i < restants.length; i++) if (restants[i].pid === lp && pretA(restants[i]) <= libre) { iBest = i; break }
        if (iBest < 0) for (let i = 0; i < restants.length; i++) if (pretA(restants[i]) <= libre) { iBest = i; break }
        if (iBest < 0) { let b = Infinity; for (let i = 0; i < restants.length; i++) { const r = pretA(restants[i]); if (r < b) { b = r; iBest = i } } }
        return restants.splice(Math.max(0, iBest), 1)[0]
      }
      while (restants.length) {
        const item = suivant()
        const prod = produitsById.value[item.pid]; if (!prod) continue
        const E = etats[item.ordreId]
        const key = item.ordreId
        const readyPhase = lotReady[key] || new Date(t0v)  // fin de la phase précédente
        const cad = cadRef(eq.id, item.pid)
        const dLotFull = cad ? Math.max(0.25, dureeLotH(prod, cad)) : 8
        const calc = calculTxt(prod, cad)
        // Pelliculage : chaque turbine = un lot séparé
        let nbTurb = (ph === 7) ? nbTurbines(prod) : 1
        let dRun = dLotFull
        if (nbTurb > 1) dRun = Math.max(0.25, dLotFull / nbTurb)
        // --- Lot TERMINÉ sur cette phase : affiché à ses dates réelles, ne consomme pas de capacité future
        if (E.etat === 'termine') {
          const dTot = dRun * nbTurb
          let deb = E.debut, fin = E.fin
          if (!deb && fin) deb = new Date(fin.getTime() - dTot * 3600000)
          if (deb && !fin) fin = placer(deb, dTot, P.regime, P.weAll, P.requis).end
          if (deb && fin && afficherTermines.value) eqTasks[eq.id].push({ type: 'lot', etat: 'termine', calc, prod, lot: item.lot, uid: item.ordreId, turbines: nbTurb, turbNo: null, segments: [{ start: deb, end: fin }], start: deb, end: fin })
          if (fin) lotReady[key] = new Date(fin)
          eqLastPid[eq.id] = item.pid
          continue
        }
        // --- Lot EN COURS : calé sur son démarrage réel ; fin = démarrage + durée (heures ouvrées), au moins maintenant
        if (E.etat === 'cours' && E.debut && !isNaN(E.debut)) {
          const dTot = dRun * nbTurb
          const pl = placer(E.debut, dTot, P.regime, P.weAll, P.requis)
          const maint = maintenant.value
          let fin = pl.end, segs = pl.segments, depasse = false
          if (fin < maint) { fin = new Date(maint.getTime() + 15 * 60000); segs = [{ start: new Date(E.debut), end: fin }]; depasse = true }
          const prog = Math.max(0, Math.min(100, Math.round(((maint - E.debut) / Math.max(1, (pl.end - E.debut))) * 100)))
          eqTasks[eq.id].push({ type: 'lot', etat: 'cours', calc, prod, lot: item.lot, uid: item.ordreId, turbines: nbTurb, turbNo: null, segments: segs, start: segs[0].start, end: fin, prog, depasse })
          if (fin > eqCursor[eq.id]) eqCursor[eq.id] = new Date(fin)
          eqLastPid[eq.id] = item.pid
          lotReady[key] = new Date(fin)
          continue
        }
        let finLot = null
        for (let k = 1; k <= nbTurb; k++) {
          let cursor = eqCursor[eq.id]
          const lastPid = eqLastPid[eq.id], lastGen = eqLastGen[eq.id]
          const holdingDep = lastGen && (cursor - lastGen) / 3600000 > P.holdingH
          const cln = (lastPid == null || item.pid !== lastPid) ? 'gen' : (holdingDep ? 'genH' : 'part')
          const C = (cln === 'gen' || cln === 'genH') ? P.vdlt : P.vdlp
          // 1re turbine : attend la fin de la phase précédente ; les suivantes enchaînent sur l'équipement
          const decalMs = (Number(item.decalage) || 0) * 3600000
          let auPlusTot = (k === 1) ? new Date(readyPhase) : new Date(t0v)
          if (k === 1 && decalMs > 0) auPlusTot = new Date(Math.max(auPlusTot.getTime(), cursor.getTime() + C * 3600000) + decalMs)
          if (k === 1 && item.dateDebut) { const dd = new Date(item.dateDebut); if (!isNaN(dd) && dd.getTime() > auPlusTot.getTime()) auPlusTot = dd }
          // Nettoyage + lot en un seul bloc, clôturé avant l'OFF
          const bloc = placerBloc(cursor, auPlusTot, C, dRun, P.regime, P.weAll, P.requis)
          const plClean = bloc.clean, plLot = bloc.lot
          const lotStart = plLot.segments[0].start
          eqTasks[eq.id].push({ type: cln, segments: plClean.segments, start: plClean.segments[0].start, end: plClean.end })
          if (cln === 'gen' || cln === 'genH') eqLastGen[eq.id] = new Date(plClean.end)
          eqTasks[eq.id].push({ type: 'lot', etat: E.etat === 'cours' ? 'cours' : 'plan', prog: 0, calc, prod, lot: item.lot, uid: item.ordreId, turbines: nbTurb, turbNo: (nbTurb > 1 ? k : null), segments: plLot.segments, start: lotStart, end: plLot.end, coupe: bloc.coupe })
          eqCursor[eq.id] = plLot.end; eqLastPid[eq.id] = item.pid
          finLot = plLot.end
        }
        lotReady[key] = new Date(finLot)  // prêt pour la phase suivante (après la dernière turbine)
      }
    }
  }
  return { eqTasks, eqCursor, t0v, equipsFab }
})
const trierEq = (a, b) => (phaseOrdre(a.type) - phaseOrdre(b.type)) || String(a.code).localeCompare(String(b.code))
// Tous les équipements de fabrication actifs (sans filtre) — utilisé par la boucle et l'occupation
const planningTous = computed(() => {
  const { eqTasks, eqCursor, t0v, equipsFab } = planCalc.value
  return [...equipsFab].sort(trierEq).map(eq => ({ eq, tasks: eqTasks[eq.id] || [], fin: eqCursor[eq.id] || new Date(t0v) }))
})
const planning = computed(() => {
  const { eqTasks, eqCursor, t0v, equipsFab } = planCalc.value
  const q = filtreTexte.value.trim().toLowerCase()
  // Lignes affichées (filtres)
  const rows = []
  const eqsSorted = equipsFab.filter(e => {
    if (filtrePhase.value && phaseOrdre(e.type) !== Number(filtrePhase.value)) return false
    if (filtreAvecPlan.value && !(panierEquip[e.id] && panierEquip[e.id].length)) return false
    if (q && !((e.code + ' ' + (e.nom || '')).toLowerCase().includes(q))) return false
    return true
  }).sort((a, b) => (phaseOrdre(a.type) - phaseOrdre(b.type)) || String(a.code).localeCompare(String(b.code)))
  const PH_LIB = { 1: 'Pesée', 2: 'Granulation', 3: 'Séchage', 4: 'Mélange', 5: 'Compression', 6: 'Remplissage gélules', 7: 'Pelliculage' }
  const nbParPh = {}
  for (const eq of eqsSorted) { const ph = phaseOrdre(eq.type); nbParPh[ph] = (nbParPh[ph] || 0) + 1 }
  let phPrec = null, num = 0
  for (const eq of eqsSorted) {
    const ph = phaseOrdre(eq.type)
    const row = { eq, tasks: eqTasks[eq.id] || [], fin: eqCursor[eq.id] || new Date(t0v) }
    if (ph !== phPrec) { num++; row.grpHead = PH_LIB[ph] || 'Autres'; row.grpNum = num; row.grpCount = nbParPh[ph] }
    phPrec = ph
    rows.push(row)
  }
  return rows
})

// Bornes temps
const t0 = computed(() => new Date(dateDepart.value + 'T22:00:00'))
const finGlobale = computed(() => {
  let m = t0.value
  for (const r of planning.value) if (r.fin > m) m = r.fin
  return m
})
// Origine d'AFFICHAGE : en présentation Semaine, on remonte au samedi 22h de la 1re semaine
// (le calcul du planning, lui, part toujours de la date de départ t0).
// Lots en cours / terminés : l'affichage remonte jusqu'à leur début réel (au plus 3 jours avant le départ)
const debutHist = computed(() => {
  let m = t0.value.getTime(); const lim = m - 72 * 3600000
  const et = planCalc.value.eqTasks
  for (const id in et) for (const t of et[id]) if (t.type === 'lot' && (t.etat === 'cours' || t.etat === 'termine')) { const d = t.segments[0].start.getTime(); if (d < m) m = Math.max(lim, d) }
  const d = new Date(m); d.setMinutes(0, 0, 0); return d
})
const tAff = computed(() => { const base = (presentation.value && vuePres.value === 'semaine' && debutSemaine0.value < t0.value) ? debutSemaine0.value : t0.value; return debutHist.value < base ? debutHist.value : base })
const finAff = computed(() => (presentation.value && vuePres.value === 'semaine') ? new Date(Math.max(finGlobale.value.getTime(), debutSemaine0.value.getTime() + nbSemaines.value * H7)) : finGlobale.value)
const totalHeures = computed(() => Math.max(24, Math.ceil((finAff.value - tAff.value) / 3600000) + ((presentation.value && vuePres.value === 'semaine') ? 0 : 8)))
const totalW = computed(() => totalHeures.value * pxH.value)

// Jours (colonnes)
const jours = computed(() => {
  const out = []
  const start = new Date(tAff.value); start.setHours(0, 0, 0, 0)
  const n = Math.ceil(totalHeures.value / 24) + 1
  for (let i = 0; i < n; i++) {
    const d = new Date(start.getTime() + i * 86400000)
    const left = ((d - tAff.value) / 3600000) * pxH.value
    out.push({ i, left, w: 24 * pxH.value, weekend: d.getDay() === 5 || d.getDay() === 6, aujourdhui: isoL(d) === isoL(new Date()), depart: isoL(d) === dateDepart.value, label: d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' }) })
  }
  return out
})
const joursWeekend = computed(() => jours.value.filter(d => d.weekend))
const jourDepart = computed(() => jours.value.filter(d => d.depart))
// Bandes « OFF » (hors plage de travail) par équipement, dérivées du régime réel :
// 3×8 = continu sam. 22h → jeu. 22h ; ven./sam. en 2×8 (06h–22h) si week-end travaillé ;
// 2×8 = 06h–22h. Les bandes collent donc exactement à l'ordonnancement (ouvertRegime).
const offBands = computed(() => {
  const map = {}
  const end = finAff.value, t0t = tAff.value.getTime()
  for (const row of planning.value) {
    const regime = regimeEquip[row.eq.id] || '3x8'
    const weAll = weOn(row.eq.id)
    const requis = buildRequisMap(requisEquip[row.eq.id], regime)
    const bands = []
    let c = new Date(tAff.value), g = 0
    while (c < end && g++ < 4000) {
      const tc = c.getTime(); let best = Infinity
      for (const hh of [0, 6, 22]) { const x = new Date(c); x.setHours(hh, 0, 0, 0); if (x.getTime() <= tc) x.setDate(x.getDate() + 1); if (x.getTime() < best) best = x.getTime() }
      const segEnd = Math.min(best, end.getTime())
      if (!ouvertRegime(c, regime, weAll, requis)) {
        const last = bands[bands.length - 1]
        if (last && last._end === tc) { last._end = segEnd; last.w = ((segEnd - last._start) / 3600000) * pxH.value }
        else bands.push({ _start: tc, _end: segEnd, left: ((tc - t0t) / 3600000) * pxH.value, w: ((segEnd - tc) / 3600000) * pxH.value })
      }
      c = new Date(best)
    }
    map[row.eq.id] = bands
  }
  return map
})

// ===== Taux d'occupation =====
// Occupation = (heures de production + heures de nettoyage) ÷ heures DISPONIBLES, sur une PÉRIODE FIXE.
//  - heures disponibles = heures ouvertes du régime (3×8 / 2×8 / week-ends / réquisitions)
//    MOINS les arrêts maintenance (MP/MC/AT/autre) tombant sur ces heures ouvertes
//  - production = lots ; nettoyage = NG + NP ; seules les heures comprises dans la période comptent
// Période : semaine (sam. 22h → sam. 22h), mois civil ou plan complet (départ → fin du plan).
// En présentation, la période suit la vue affichée (semaine affichée / plan complet).
const periodeOcc = ref((() => { try { return localStorage.getItem('pe_occ_per') || 'semaine' } catch (e) { return 'semaine' } })())
const occIdx = ref(null)
function choisirPeriodeOcc(v) { periodeOcc.value = v; occIdx.value = null; try { localStorage.setItem('pe_occ_per', v) } catch (e) {} }
const moisDe = (d) => d.getFullYear() * 12 + d.getMonth()
const occIdxMin = computed(() => periodeOcc.value === 'mois' ? moisDe(t0.value) : 0)
const occIdxMax = computed(() => periodeOcc.value === 'mois' ? moisDe(finGlobale.value) : nbSemaines.value - 1)
const occIdxEff = computed(() => {
  if (occIdx.value != null) return Math.min(Math.max(occIdx.value, occIdxMin.value), occIdxMax.value)
  if (periodeOcc.value === 'mois') return Math.min(Math.max(moisDe(maintenant.value), occIdxMin.value), occIdxMax.value)
  return semaineDe(maintenant.value)
})
watch(periodeOcc, () => { occIdx.value = null })
watch(occIdx, (v) => { if (v != null && v !== occIdxEff.value) occIdx.value = occIdxEff.value })
const fenetreOcc = computed(() => {
  if (boucle.value) return { a: semaineBoucle.value.a, b: semaineBoucle.value.b, mode: 'semaine' }
  if (presentation.value) {
    if (vuePres.value === 'semaine') return { a: debutSemaineVue.value, b: new Date(debutSemaineVue.value.getTime() + H7), mode: 'semaine' }
    return { a: t0.value, b: finGlobale.value, mode: 'plan' }
  }
  if (periodeOcc.value === 'plan') return { a: t0.value, b: finGlobale.value, mode: 'plan' }
  if (periodeOcc.value === 'mois') { const k = occIdxEff.value; return { a: new Date(Math.floor(k / 12), k % 12, 1), b: new Date(Math.floor(k / 12), k % 12 + 1, 1), mode: 'mois' } }
  const a = new Date(debutSemaine0.value.getTime() + occIdxEff.value * H7)
  return { a, b: new Date(a.getTime() + H7), mode: 'semaine' }
})
const periodeOccLib = computed(() => {
  const f = fenetreOcc.value, fd = (d) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
  if (f.mode === 'plan') return 'plan complet ' + fd(f.a) + ' → ' + fd(f.b)
  if (f.mode === 'mois') return f.a.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  return 'semaine du ' + fd(f.a) + ' 22h → ' + fd(f.b) + ' 22h'
})
const chargeMap = computed(() => {
  const A = fenetreOcc.value.a.getTime(), B = fenetreOcc.value.b.getTime(), m = {}
  const sauveMaint = maintCourant
  for (const row of planningTous.value) {
    const regime = regimeEquip[row.eq.id] || '3x8', weAll = weOn(row.eq.id)
    const requis = buildRequisMap(requisEquip[row.eq.id], regime)
    maintCourant = buildMaintList(maintEquip[row.eq.id])
    let ouvH = 0, arretH = 0, c = new Date(A), g = 0
    while (c.getTime() < B && g++ < 20000) {
      const nb = prochaineBascule(c), tc = c.getTime(), fin = Math.min(nb.getTime(), B)
      if (ouvertRegime(c, regime, weAll, requis)) { const h = (fin - tc) / 3600000; ouvH += h; if (maintA(c)) arretH += h }
      c = new Date(fin)
    }
    let prodH = 0, nettH = 0
    for (const t of row.tasks) for (const sg of t.segments) {
      const d = Math.max(0, (Math.min(new Date(sg.end).getTime(), B) - Math.max(new Date(sg.start).getTime(), A)) / 3600000)
      if (t.type === 'lot') prodH += d; else nettH += d
    }
    const dispoH = Math.max(0, ouvH - arretH)
    const pc = (x) => dispoH > 0 ? Math.round(x / dispoH * 100) : 0
    m[row.eq.id] = { dispoH, ouvH, arretH, prodH, nettH, busyH: prodH + nettH, occ: pc(prodH + nettH), prodPct: pc(prodH), nettPct: pc(nettH) }
  }
  maintCourant = sauveMaint
  return m
})
function occTitre(id) {
  const c = chargeMap.value[id]; if (!c) return ''
  const h = (x) => (Math.round(x * 10) / 10).toLocaleString('fr-FR') + ' h'
  return 'Période : ' + periodeOccLib.value + '\nProduction : ' + h(c.prodH) + ' (' + c.prodPct + ' %)\nNettoyage : ' + h(c.nettH) + ' (' + c.nettPct + ' %)\nDisponible : ' + h(c.dispoH) + ' = ' + h(c.ouvH) + ' ouvertes − ' + h(c.arretH) + ' d\'arrêts maintenance\nOccupation = (production + nettoyage) ÷ disponible = ' + c.occ + ' %'
}
const goulotId = computed(() => { let best = null, bo = -1; const vis = new Set((boucle.value ? planningTous.value : planning.value).map(r => String(r.eq.id))); for (const id in chargeMap.value) { if (!vis.has(String(id))) continue; const o = chargeMap.value[id].occ; if (o > bo) { bo = o; best = id } } return best })
function chargeClass(o) { if (o >= 100) return 'ch-over'; if (o >= 85) return 'ch-high'; if (o >= 50) return 'ch-mid'; return 'ch-low' }

const maintenant = ref(new Date())
let timerNow = null
onMounted(() => { timerNow = setInterval(() => { maintenant.value = new Date() }, 60000) })
onUnmounted(() => { if (timerNow) clearInterval(timerNow) })
const heureMaintenant = computed(() => maintenant.value.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
const posMaintenant = computed(() => {
  const px = ((maintenant.value - tAff.value) / 3600000) * pxH.value
  return (px >= 0 && px <= totalW.value) ? px : null
})

// Fond des lignes en présentation : périmètre des 3 shifts de chaque jour, dégradés clairs
// (nuit 22h–06h bleu, matin 06h–14h jaune, après-midi 14h–22h orange), répété toutes les 24 h
// et calé sur minuit du 1er jour affiché.
const DEG_SHIFTS = 'linear-gradient(to right, #e4e9ff 0%, #dde4ff 25%, #fffdf0 25%, #fdf0c4 58.333%, #fff8f0 58.333%, #fde3c8 91.667%, #eef1ff 91.667%, #e8edff 100%)'
const fondShifts = computed(() => {
  const j0 = jours.value[0]; const w = 24 * pxH.value
  return { backgroundImage: DEG_SHIFTS, backgroundSize: w + 'px 100%', backgroundRepeat: 'repeat-x', backgroundPosition: (j0 ? j0.left : 0) + 'px 0' }
})
// ===== Mode présentation =====
const H7 = 7 * 24 * 3600000
const presentation = ref(false)
const ganttEl = ref(null)
const vuePres = ref('semaine')   // 'semaine' | 'tout'
const semaineIdx = ref(0)
let pxAvant = null, exportEnCours = false
function basculerPresentation() {
  presentation.value = !presentation.value
  if (presentation.value) {
    pxAvant = pxH.value
    semaineIdx.value = semaineDe(maintenant.value)
    vuePres.value = 'semaine'
  } else if (pxAvant != null) { pxH.value = pxAvant; pxAvant = null }
  try {
    if (presentation.value && document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {})
    if (!presentation.value && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {})
  } catch (e) {}
  ajusterVueBientot()
}
// Semaine de travail : du samedi 22h00 au samedi suivant 22h00 (3×8 sam.→jeu. + week-end)
const debutSemaine0 = computed(() => { const d = new Date(t0.value); let g = 0; while (d.getDay() !== 6 && g++ < 7) d.setDate(d.getDate() - 1); d.setHours(22, 0, 0, 0); if (d > t0.value) d.setDate(d.getDate() - 7); return d })
const nbSemaines = computed(() => Math.max(1, Math.ceil((finGlobale.value - debutSemaine0.value) / H7)))
function semaineDe(d) { const k = Math.floor((new Date(d) - debutSemaine0.value) / H7); return Math.min(Math.max(0, k), nbSemaines.value - 1) }
const debutSemaineVue = computed(() => new Date(debutSemaine0.value.getTime() + semaineIdx.value * H7))
const libelleSemaineVue = computed(() => {
  const a = debutSemaineVue.value, b = new Date(a.getTime() + H7)
  const lun = new Date(a.getTime() + 2 * 86400000); const j = new Date(Date.UTC(lun.getFullYear(), lun.getMonth(), lun.getDate()))
  const dn = j.getUTCDay() || 7; j.setUTCDate(j.getUTCDate() + 4 - dn)
  const sem = Math.ceil(((j - new Date(Date.UTC(j.getUTCFullYear(), 0, 1))) / 86400000 + 1) / 7)
  const f = (d) => d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })
  return 'semaine ' + sem + ' — ' + f(a) + ' 22h → ' + f(b) + ' 22h'
})
function largeurUtile() {
  const el = ganttEl.value; if (!el) return 0
  const col = el.querySelector('.g-eqcol'); return el.clientWidth - (col ? col.offsetWidth : 210) - 4
}
function ajusterVue() {
  if (!presentation.value) return
  const w = largeurUtile(); if (w <= 100) return
  if (vuePres.value === 'semaine') {
    pxH.value = Math.round((w / 168) * 1000) / 1000
    nextTick(() => { const el = ganttEl.value; if (el) el.scrollLeft = Math.max(0, ((debutSemaineVue.value - tAff.value) / 3600000) * pxH.value) })
  } else {
    pxH.value = Math.max(0.3, Math.round((w / totalHeures.value) * 1000) / 1000)
    nextTick(() => { if (ganttEl.value) ganttEl.value.scrollLeft = 0 })
  }
}
let tAjust = null
function ajusterVueBientot() { clearTimeout(tAjust); tAjust = setTimeout(() => nextTick(ajusterVue), 300) }
function choisirVue(v) { vuePres.value = v; ajusterVue() }
function changerSemaine(n) { semaineIdx.value = Math.min(Math.max(0, semaineIdx.value + n), nbSemaines.value - 1); ajusterVue() }
onMounted(() => window.addEventListener('resize', ajusterVueBientot))
onUnmounted(() => window.removeEventListener('resize', ajusterVueBientot))

// ===== Export PDF A3 paysage de la vue affichée =====
function echapHtml(x) { return String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])) }
async function exporterPDF() {
  const etaitPres = presentation.value
  if (!etaitPres) { basculerPresentation(); await new Promise(r => setTimeout(r, 700)) }
  const page = document.querySelector('.pe-page'); const gEl = ganttEl.value
  if (!page || !gEl) return
  const scroll = gEl.scrollLeft, largeur = page.scrollWidth
  const clone = page.cloneNode(true)
  clone.querySelectorAll('.pe-head-btns, .pe-pres-btn, .pe-pdf-btn, .g-now, .g-now-head, .pan-overlay').forEach(n => n.remove())
  clone.classList.remove('pe-pres'); clone.classList.add('pe-pres', 'pe-print')
  const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map(n => n.outerHTML).join('\n')
  const edite = new Date().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const titre = 'Planning fabrication — ' + (vuePres.value === 'semaine' ? libelleSemaineVue.value : 'plan complet')
  exportEnCours = true
  const w = window.open('', '_blank')
  if (!w) { erreur.value = 'Autorise les pop-ups pour générer le PDF.'; exportEnCours = false; return }
  w.document.write('<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>' + echapHtml(titre) + '</title>' + styles +
    '<style>@page{size:A3 landscape;margin:7mm}html,body{margin:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '.pe-print{position:static!important;inset:auto!important;overflow:visible!important;padding:0!important;width:' + largeur + 'px}' +
    '.pe-print .gantt{max-height:none!important;overflow-x:hidden!important;overflow-y:visible!important}' +
    '.pe-print .g-bar{animation:none!important}.pe-print .g-row,.pe-print .g-grp{break-inside:avoid}' +
    '.pe-print-pied{display:flex;justify-content:space-between;font:600 11px system-ui;color:#64748b;border-top:1px solid #e2e8f0;margin-top:8px;padding-top:4px}' +
    '#zoomer{transform-origin:0 0}</style></head><body><div id="zoomer">' + clone.outerHTML +
    '<div class="pe-print-pied" style="width:' + largeur + 'px"><span>LDM Groupe — Site El Khroub · ProdTrack</span><span>Édité le ' + echapHtml(edite) + '</span></div></div></body></html>')
  w.document.close()
  const lancer = () => {
    try {
      const g = w.document.querySelector('.gantt'); if (g) g.scrollLeft = scroll
      const z = w.document.getElementById('zoomer'); const cible = 1540   // largeur utile A3 paysage (px @96 dpi)
      if (z && largeur > cible) z.style.zoom = String(cible / largeur)
    } catch (e) {}
    setTimeout(() => { try { w.focus(); w.print() } catch (e) {} ; exportEnCours = false; if (!etaitPres && presentation.value) basculerPresentation() }, 400)
  }
  if (w.document.readyState === 'complete') setTimeout(lancer, 500); else w.addEventListener('load', () => setTimeout(lancer, 300))
}
function toucheClavier(e) {
  if (e.key !== 'Escape') return
  if (lotSuivi.value) { lotSuivi.value = null; return }
  if (presentation.value) basculerPresentation()
}
function finPleinEcran() {
  if (!document.fullscreenElement && presentation.value && !exportEnCours) { presentation.value = false; if (pxAvant != null) { pxH.value = pxAvant; pxAvant = null } return }
  ajusterVueBientot()
}
onMounted(() => { window.addEventListener('keydown', toucheClavier); document.addEventListener('fullscreenchange', finPleinEcran) })
onUnmounted(() => { window.removeEventListener('keydown', toucheClavier); document.removeEventListener('fullscreenchange', finPleinEcran) })
// Suivi d'un lot (OF) sur toutes ses phases
const lotSuivi = ref(null)
const lotSuiviLib = computed(() => {
  if (!lotSuivi.value) return ''
  for (const r of planning.value) for (const t of r.tasks) if (t.type === 'lot' && t.uid === lotSuivi.value) return (t.lot || '—') + ' (' + t.prod.code_pf + ')'
  return ''
})
const goulotNom = computed(() => { const r = planningTous.value.find(x => String(x.eq.id) === String(goulotId.value)); return r ? (r.eq.nom || '') : '' })
const goulotLib = computed(() => {
  const r = planning.value.find(x => String(x.eq.id) === String(goulotId.value))
  const o = (chargeMap.value[goulotId.value] || {}).occ
  return r ? (r.eq.code + ' · ' + (o || 0) + ' %') : '—'
})
const goulotNomB = computed(() => { const r = planningTous.value.find(x => String(x.eq.id) === String(goulotId.value)); return r ? (r.eq.nom || '') : '' })
const goulotLibB = computed(() => { const r = planningTous.value.find(x => String(x.eq.id) === String(goulotId.value)); return r ? r.eq.code + ' · ' + ((chargeMap.value[goulotId.value] || {}).occ || 0) + ' %' : '—' })
const nbEnCours = computed(() => { let n = 0; for (const r of planning.value) n += (enCoursListe.value[r.eq.id] || []).length; return n })
const libelleSemaine = computed(() => {
  const d = new Date(t0.value); const j = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dn = j.getUTCDay() || 7; j.setUTCDate(j.getUTCDate() + 4 - dn)
  const an = new Date(Date.UTC(j.getUTCFullYear(), 0, 1))
  return 'semaine ' + Math.ceil(((j - an) / 86400000 + 1) / 7) + ' — départ ' + d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
})

// ===== Mode BOUCLE (écran atelier) =====
// Une page « vue d'ensemble » puis une page par phase (découpée si trop d'équipements),
// défilement automatique, données rechargées à chaque tour.
const boucle = ref(false)
const bPage = ref(0)
const bPause = ref(false)
const bEcoule = ref(0)
const bDuree = ref((() => { try { return Number(localStorage.getItem('pe_boucle_s')) || 20 } catch (e) { return 20 } })())
watch(bDuree, (v) => { try { localStorage.setItem('pe_boucle_s', String(v)) } catch (e) {} })
const bParPage = ref(4)
const bMaj = ref(null)
let bTimer = null
const PH_LIB_B = { 1: 'Pesée', 2: 'Granulation', 3: 'Séchage', 4: 'Mélange', 5: 'Compression', 6: 'Remplissage gélules', 7: 'Pelliculage' }
const semaineBoucle = computed(() => {
  const k = Math.floor((maintenant.value - debutSemaine0.value) / H7)
  const a = new Date(debutSemaine0.value.getTime() + Math.max(0, k) * H7)
  return { a, b: new Date(a.getTime() + H7) }
})
const bPages = computed(() => {
  const pages = [{ type: 'synthese', titre: "Vue d'ensemble", ph: 0 }]
  const parPh = {}
  for (const r of planningTous.value) { const ph = phaseOrdre(r.eq.type); (parPh[ph] = parPh[ph] || []).push(r) }
  for (const ph of Object.keys(parPh).map(Number).sort((a, b) => a - b)) {
    const rows = parPh[ph], n = Math.max(1, bParPage.value), nbp = Math.ceil(rows.length / n)
    for (let i = 0; i < nbp; i++) pages.push({ type: 'phase', ph, titre: (PH_LIB_B[ph] || 'Autres') + (nbp > 1 ? ' (' + (i + 1) + '/' + nbp + ')' : ''), rows: rows.slice(i * n, i * n + n), num: ph })
  }
  return pages
})
const bPhases = computed(() => { const seen = new Set(), out = []; bPages.value.forEach((p, i) => { const k = p.type === 'synthese' ? 0 : p.ph; if (!seen.has(k)) { seen.add(k); out.push({ k, idx: i, lib: p.type === 'synthese' ? "Vue d'ensemble" : (PH_LIB_B[p.ph] || 'Autres') }) } }); return out })
const bPageCour = computed(() => bPages.value[Math.min(bPage.value, bPages.value.length - 1)] || bPages.value[0])
function bCalcParPage() { const h = window.innerHeight || 900; bParPage.value = Math.max(2, Math.floor((h - 170) / 175)) }
async function bSuivante(dir = 1) {
  const n = bPages.value.length
  let p = bPage.value + dir
  if (p >= n) { p = 0; try { await chargerDonnees(); bMaj.value = new Date() } catch (e) {} }   // chargerDonnees resynchronise si l'option est active
  if (p < 0) p = n - 1
  bPage.value = p; bEcoule.value = 0
}
function bAller(i) { bPage.value = i; bEcoule.value = 0 }
function demarrerBoucle() {
  if (presentation.value) basculerPresentation()
  boucle.value = true; bPage.value = 0; bEcoule.value = 0; bPause.value = false; bMaj.value = new Date(); bCalcParPage()
  try { if (document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}) } catch (e) {}
  clearInterval(bTimer)
  bTimer = setInterval(() => { if (!boucle.value || bPause.value) return; bEcoule.value += 0.25; if (bEcoule.value >= bDuree.value) bSuivante(1) }, 250)
}
function arreterBoucle() {
  boucle.value = false; clearInterval(bTimer); bTimer = null
  try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}) } catch (e) {}
}
function demarrerBoucleSiUrl() { try { if (/[?&]boucle=1/.test(window.location.hash + window.location.search)) demarrerBoucle() } catch (e) {} }
function bClavier(e) {
  if (!boucle.value) return
  if (e.key === 'ArrowRight') { bSuivante(1); e.preventDefault() }
  else if (e.key === 'ArrowLeft') { bSuivante(-1); e.preventDefault() }
  else if (e.key === ' ') { bPause.value = !bPause.value; e.preventDefault() }
  else if (e.key === 'Escape') arreterBoucle()
}
onMounted(() => { window.addEventListener('keydown', bClavier); window.addEventListener('resize', bCalcParPage) })
onUnmounted(() => { window.removeEventListener('keydown', bClavier); window.removeEventListener('resize', bCalcParPage); clearInterval(bTimer) })
// Contenu d'une carte équipement (semaine courante, positions en %)
function bPct(d) { const { a, b } = semaineBoucle.value; return Math.max(0, Math.min(100, ((new Date(d) - a) / (b - a)) * 100)) }
function bStyle(start, end, prod) {
  const l = bPct(start), r = bPct(end), st = { left: l + '%', width: Math.max(0.3, r - l) + '%' }
  if (prod) { const c = couleurProd(prod.code_pf); st.background = c.bg; st['--cd'] = c.bd }
  return st
}
const bVisible = (start, end) => { const { a, b } = semaineBoucle.value; return new Date(end) > a && new Date(start) < b }
const bCartes = computed(() => {
  const m = {}, now = maintenant.value
  if (!boucle.value) return m
  const { a, b } = semaineBoucle.value
  for (const r of planningTous.value) {
    const cd = campagnesDe(r, new Set())
    const regime = regimeEquip[r.eq.id] || '3x8', weAll = weOn(r.eq.id), requis = buildRequisMap(requisEquip[r.eq.id], regime)
    const off = []; let c = new Date(a), g = 0
    while (c < b && g++ < 3000) {
      const nb = prochaineBascule(c), fin = new Date(Math.min(nb.getTime(), b.getTime()))
      if (!ouvertRegime(c, regime, weAll, requis)) { const l = off[off.length - 1]; if (l && l.b.getTime() === c.getTime()) l.b = fin; else off.push({ a: new Date(c), b: fin }) }
      c = fin
    }
    const prochain = r.tasks.find(t => t.type === 'lot' && t.etat === 'plan' && t.segments[0].start > now && !lotEnCours(r.eq.id, t))
    const uidsEtat = (e) => new Set(r.tasks.filter(t => t.type === 'lot' && t.etat === e).map(t => t.uid)).size
    const nbSem = new Set(r.tasks.filter(t => t.type === 'lot' && bVisible(t.segments[0].start, t.end)).map(t => t.uid)).size
    m[r.eq.id] = {
      camps: cd.camps.filter(x => bVisible(x.start, x.end)),
      taches: cd.tasks.filter(t => bVisible(t.segments[0].start, t.end)),
      off, prochain, nbSem, regime, nT: uidsEtat('termine'), nC: uidsEtat('cours'), nP: uidsEtat('plan')
    }
  }
  return m
})
const bSynthese = computed(() => planningTous.value.map(r => ({ r, c: chargeMap.value[r.eq.id] || {}, cours: enCoursListe.value[r.eq.id] || [] }))
  .sort((x, y) => (y.c.occ || 0) - (x.c.occ || 0)))
const bKpi = computed(() => {
  const { a, b } = semaineBoucle.value
  let lots = 0, actifs = 0, cours = 0
  for (const r of planningTous.value) {
    const n = new Set(r.tasks.filter(t => t.type === 'lot' && bVisible(t.segments[0].start, t.end)).map(t => t.uid)).size
    lots += n; if (n) actifs++; cours += (enCoursListe.value[r.eq.id] || []).length
  }
  return { lots, actifs, total: planningTous.value.length, cours }
})
const bHeure = computed(() => maintenant.value.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
const bSemLib = computed(() => { const f = (d) => d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' }); return f(semaineBoucle.value.a) + ' 22h → ' + f(semaineBoucle.value.b) + ' 22h' })
const bJours = computed(() => { const out = []; const { a } = semaineBoucle.value; for (let i = 0; i < 7; i++) { const d = new Date(a.getTime() + (i * 24 + 2) * 3600000); d.setHours(0, 0, 0, 0); out.push({ lbl: d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' }), left: bPct(d) }) } return out })

// ===== Campagnes (présentation) =====
// Lots consécutifs du même produit, séparés seulement par un NP (pas de NG, pas d'OFF entre eux)
// -> une barre unique ; les NP deviennent des traits. Clic sur la campagne : détail lot par lot.
const campOuvertes = ref(new Set())
function basculerCamp(k) { const s = new Set(campOuvertes.value); s.has(k) ? s.delete(k) : s.add(k); campOuvertes.value = s }
const presData = computed(() => {
  if (!presentation.value) return {}
  const out = {}
  for (const r of planning.value) out[r.eq.id] = campagnesDe(r, campOuvertes.value)
  return out
})
function campagnesDe(r, ouv) {
  {
    const T = r.tasks, tasks = [], camps = []
    let i = 0
    while (i < T.length) {
      const t = T[i]
      if (t.type !== 'lot') { if (t.type !== 'part') tasks.push(t); i++; continue }
      if (t.etat === 'termine') {
        const g2 = [t]; let j2 = i + 1
        while (j2 < T.length && T[j2].type === 'lot' && T[j2].etat === 'termine' && T[j2].prod.code_pf === t.prod.code_pf && (T[j2].segments[0].start - g2[g2.length - 1].end) <= 4 * 3600000) { g2.push(T[j2]); j2++ }
        if (g2.length < 2) { tasks.push(t); i++; continue }
        const st = g2[0].segments[0].start, en = g2[g2.length - 1].end, tot = Math.max(1, en - st)
        camps.push({ key: r.eq.id + ':T:' + g2[0].uid, termine: true, prod: t.prod, start: st, end: en, n: g2.length, premier: g2[0].lot || '—', dernier: g2[g2.length - 1].lot || '—', uids: g2.map(x => x.uid), enCours: false, ticks: g2.slice(1).map(x => Math.round(((x.segments[0].start - st) / tot) * 10000) / 100), lotsTxt: g2.map(x => x.lot || '—').join(', ') })
        i = j2; continue
      }
      if (t.etat === 'cours') { tasks.push(t); i++; continue }
      // construire la campagne
      const grp = [t]; let j = i + 1
      while (j + 1 < T.length && T[j].type === 'part' && T[j + 1].type === 'lot' && T[j + 1].etat !== 'termine' && T[j + 1].etat !== 'cours' && T[j + 1].prod.code_pf === t.prod.code_pf) {
        const np = T[j], nx = T[j + 1], prev = grp[grp.length - 1]
        const ecart = (nx.segments[0].start - prev.end) / 3600000
        const dureeNp = (np.end - np.segments[0].start) / 3600000
        if (np.segments.length > 1 || nx.segments.length > 1 || prev.segments.length > 1 || ecart > dureeNp + 0.25) break
        grp.push(nx); j += 2
      }
      const key = r.eq.id + ':' + grp[0].uid + ':' + (grp[0].turbNo || 0)
      if (grp.length < 2 || ouv.has(key)) {
        // lot isolé ou campagne dépliée : tâches individuelles (NP visibles si dépliée)
        for (let k = i; k < (grp.length < 2 ? i + 1 : j); k++) if (T[k].type === 'lot' || grp.length >= 2) tasks.push(T[k])
        if (grp.length >= 2) camps.push({ key, ouverte: true, prod: t.prod, start: grp[0].segments[0].start, end: grp[grp.length - 1].end, n: 0, uids: [], ticks: [], fantome: true })
        i = grp.length < 2 ? i + 1 : j; continue
      }
      const start = grp[0].segments[0].start, end = grp[grp.length - 1].end, tot = end - start
      const lots = [...new Set(grp.map(x => x.lot || x.uid))]
      camps.push({
        key, prod: t.prod, start, end, n: lots.length, nTaches: grp.length,
        premier: grp[0].lot || '—', dernier: grp[grp.length - 1].lot || '—',
        uids: grp.map(x => x.uid), enCours: grp.some(x => lotEnCours(r.eq.id, x)),
        ticks: grp.slice(1).map(x => Math.round(((x.segments[0].start - start) / tot) * 10000) / 100),
        lotsTxt: grp.map(x => (x.lot || '—') + (x.turbNo ? ' T' + x.turbNo : '')).join(', ')
      })
      i = j
    }
    return { tasks, camps: camps.filter(c => !c.fantome), ouvertes: camps.filter(c => c.fantome) }
  }
}
const campW = (c) => ((c.end - c.start) / 3600000) * pxH.value
function campStyle(c) {
  const col = couleurProd(c.prod.code_pf)
  if (c.termine) return { left: (((c.start - tAff.value) / 3600000) * pxH.value) + 'px', width: Math.max(2, campW(c)) + 'px', background: 'repeating-linear-gradient(45deg, ' + col.bg + '30, ' + col.bg + '30 5px, ' + col.bg + '18 5px, ' + col.bg + '18 10px)', borderColor: col.bd, '--cd': col.bd }
  return { left: (((c.start - tAff.value) / 3600000) * pxH.value) + 'px', width: Math.max(2, campW(c)) + 'px', background: col.bg, borderColor: col.bd, '--cd': col.bd }
}
function titreCamp(c) { return 'Campagne ' + c.prod.code_pf + ' — ' + c.prod.designation + '  •  ' + c.n + ' lot(s) : ' + c.lotsTxt + '  •  ' + fmtJH(c.start) + ' → ' + fmtJH(c.end) + '  •  clic : détail lot par lot' }
// Libellé de lot selon la place : complet, 3 derniers chiffres, ou rien
function lotCourt(lot, w) { const l = String(lot || '—'); if (w >= 52 || l.length <= 3) return l; return w >= 22 ? '…' + l.slice(-3) : '' }

// ===== Contrôle des données de cadence =====
// Couples équipement / produit utilisés par le planning (paniers) + cadences de fabrication saisies.
const ctrlOuvert = ref(false)
const controleDonnees = computed(() => {
  const out = [], vus = new Set()
  const eqFab = equipements.value.filter(e => estFab(e.type))
  const eqById = {}; for (const e of eqFab) eqById[e.id] = e
  const ajouter = (eq, prod, cad, nbLots) => {
    const k = eq.id + '#' + prod.id; if (vus.has(k)) return; vus.add(k)
    const d = dureeInfo(prod, cad)
    const nbT = phaseOrdre(eq.type) === 7 ? nbTurbines(prod) : 1
    let niveau = null, pb = ''
    if (d.src === 'defaut') { niveau = 'err'; pb = d.raison + ' → durée par défaut 8 h' }
    else if (d.src === 'unites') { niveau = 'info'; pb = 'Cadence en ' + (cad.unite_cadence || 'unités/h') + ' : convertie (unités du lot ÷ cadence)' }
    if (!niveau && d.h < 0.25) { niveau = 'warn'; pb = 'Durée très courte (' + (Math.round(d.h * 60)) + ' min) : cadence trop élevée ou en mauvaise unité ?' }
    if (!niveau && d.h > 48) { niveau = 'warn'; pb = 'Durée très longue (' + Math.round(d.h) + ' h) : cadence trop faible ou en mauvaise unité ?' }
    if (!niveau) return
    out.push({ niveau, eq, prod, cad, h: d.h, hTurb: d.h / nbT, nbT, pb, nbLots })
  }
  // 1) lots présents dans les paniers
  const cpt = {}
  for (const eqId in panierEquip) for (const it of (panierEquip[eqId] || [])) { if (it.exclu) continue; const k = eqId + '#' + it.pid; cpt[k] = (cpt[k] || 0) + 1 }
  for (const k in cpt) { const [eqId, pid] = k.split('#'); const eq = eqById[eqId]; const prod = produitsById.value[pid]; if (!eq || !prod) continue; const cad = cadRef(eqId, pid); ajouter(eq, prod, cad, cpt[k]) }
  // 2) toutes les cadences de fabrication saisies (même sans lot planifié)
  for (const c of cadences.value) { const eq = eqById[c.equipement_id]; const prod = produitsById.value[c.produit_id]; if (eq && prod) ajouter(eq, prod, cadRef(c.equipement_id, c.produit_id), cpt[c.equipement_id + '#' + c.produit_id] || 0) }
  const rang = { err: 0, warn: 1, info: 2 }
  return out.sort((a, b) => (rang[a.niveau] - rang[b.niveau]) || (b.nbLots - a.nbLots) || String(a.eq.code).localeCompare(String(b.eq.code)))
})
const nbCtrl = computed(() => { const n = { err: 0, warn: 0, info: 0 }; for (const x of controleDonnees.value) n[x.niveau]++; return n })
const fmtH = (h) => h < 1 ? Math.round(h * 60) + ' min' : (Math.round(h * 10) / 10).toLocaleString('fr-FR') + ' h'

// Légende produits repliée : les plus fréquents d'abord ; détail de synthèse replié
const NB_PROD_LEG = 8
const legOuverte = ref(false)
const synthOuverte = ref((() => { try { return localStorage.getItem('pe_synth_ouv') === '1' } catch (e) { return false } })())
watch(synthOuverte, (v) => { try { localStorage.setItem('pe_synth_ouv', v ? '1' : '0') } catch (e) {} })
const produitsLegende = computed(() => {
  const tri = [...produitsPlanning.value].sort((a, b) => b.n - a.n)
  if (legOuverte.value || tri.length <= NB_PROD_LEG) return tri
  const vis = tri.slice(0, NB_PROD_LEG)
  if (prodFocus.value && !vis.some(x => x.code === prodFocus.value)) { const f = tri.find(x => x.code === prodFocus.value); if (f) vis.push(f) }
  return vis
})

// Mise en évidence d'un produit (légende cliquable)
const prodFocus = ref('')
// Largeur (px) d'un segment
const segW = (seg) => ((seg.end - seg.start) / 3600000) * pxH.value
// Lot en cours sur cet équipement (suivi_phases)
function lotEnCours(eqId, t) { return enCoursIds.value.has(String(eqId) + '#' + t.uid) }
// Produits présents dans le planning (une couleur distincte par produit)
const produitsPlanning = computed(() => {
  const m = {}
  for (const r of planning.value) for (const t of r.tasks) {
    if (t.type !== 'lot') continue
    const k = t.prod.code_pf || '—'
    if (!m[k]) m[k] = { code: k, designation: t.prod.designation || '', lots: new Set() }
    m[k].lots.add(t.lot || t.uid)
  }
  return Object.values(m).sort((a, b) => String(a.code).localeCompare(String(b.code)))
    .map(p => ({ code: p.code, designation: p.designation, n: p.lots.size, c: couleurProd(p.code) }))
})
const couleurIndex = computed(() => {
  const codes = new Set()
  for (const r of planning.value) for (const t of r.tasks) if (t.type === 'lot') codes.add(t.prod.code_pf || '—')
  const idx = {}; [...codes].sort((a, b) => String(a).localeCompare(String(b))).forEach((c, i) => { idx[c] = i })
  return idx
})

// Position des barres (par segment)
function barStyleSeg(seg, t) {
  const left = ((seg.start - tAff.value) / 3600000) * pxH.value
  const w = Math.max(2, ((seg.end - seg.start) / 3600000) * pxH.value)
  const s = { left: left + 'px', width: w + 'px' }
  if (t.type === 'lot') {
    const c = couleurProd(t.prod.code_pf); s.background = c.bg; s.borderColor = c.bd; s['--cd'] = c.bd
    if (t.etat === 'termine') s.background = 'repeating-linear-gradient(45deg, ' + c.bg + '30, ' + c.bg + '30 5px, ' + c.bg + '18 5px, ' + c.bg + '18 10px)'
  }
  return s
}

// Couleur par produit (stable)
// Couleurs franches (texte blanc lisible), attribuées dans l'ordre des produits
// du planning → deux produits affichés n'ont pas la même couleur (jusqu'à 14).
const palette = [
  ['#2563eb', '#1e3a8a'], ['#16a34a', '#14532d'], ['#ea580c', '#7c2d12'], ['#9333ea', '#4c1d95'],
  ['#0891b2', '#164e63'], ['#db2777', '#831843'], ['#ca8a04', '#713f12'], ['#4f46e5', '#312e81'],
  ['#059669', '#064e3b'], ['#c2410c', '#431407'], ['#0284c7', '#0c4a6e'], ['#65a30d', '#365314'],
  ['#be185d', '#500724'], ['#7c3aed', '#2e1065']
]
function couleurProd(code) {
  const k = String(code || '')
  let i = couleurIndex.value[k]
  if (i == null) { let h = 0; for (let n = 0; n < k.length; n++) h = (h * 31 + k.charCodeAt(n)) >>> 0; i = h }
  const [bg, bd] = palette[i % palette.length]
  return { bg, bd }
}

// Helpers affichage
const fmtJH = (d) => d ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''
function titre(t) {
  const p = fmtJH(t.start) + ' → ' + fmtJH(t.end)
  if (t.type === 'lot' && t.coupe) return '⚠ LOT TROP LONG pour un poste : le lot dépasse la plage ouvrée, coupure inévitable sur l\'OFF  •  ' + t.prod.code_pf + ' — ' + t.prod.designation + '  •  Lot ' + (t.lot || '—') + '  •  ' + p
  if (t.type === 'lot' && t.etat === 'termine') return '✓ TERMINÉ sur cette phase  •  ' + t.prod.code_pf + ' — ' + t.prod.designation + '  •  Lot ' + (t.lot || '—') + '  •  réel : ' + p
  if (t.type === 'lot' && t.etat === 'cours') return '▶ EN COURS (' + (t.depasse ? 'durée prévue dépassée' : t.prog + ' %') + ')  •  ' + t.prod.code_pf + ' — ' + t.prod.designation + '  •  Lot ' + (t.lot || '—') + '  •  démarré ' + fmtJH(t.start) + ' → fin prévue ' + fmtJH(t.end) + (t.calc ? '\nDurée : ' + t.calc : '')
  if (t.type === 'lot' && t.calc) return t.prod.code_pf + ' — ' + t.prod.designation + '  •  Lot ' + (t.lot || '—') + (t.turbNo ? '  •  turbine ' + t.turbNo + '/' + t.turbines : '') + '  •  ' + p + '\nDurée : ' + t.calc + (t.turbines > 1 ? ' (÷ ' + t.turbines + ' turbines)' : '')
  if (t.type === 'lot') return t.prod.code_pf + ' — ' + t.prod.designation + '  •  Lot ' + (t.lot || '—') + (t.turbNo ? '  •  turbine ' + t.turbNo + '/' + t.turbines : '') + '  •  ' + p
  if (t.type === 'gen') return 'Nettoyage général (début campagne)  •  ' + p
  if (t.type === 'genH') return 'Nettoyage général (holding dépassé)  •  ' + p
  return 'Nettoyage partiel  •  ' + p
}

// Récap
const totalLots = computed(() => planning.value.reduce((s, r) => s + r.tasks.filter(t => t.type === 'lot').length, 0))
const totalNG = computed(() => planning.value.reduce((s, r) => s + r.tasks.filter(t => t.type === 'gen' || t.type === 'genH').length, 0))
const totalNP = computed(() => planning.value.reduce((s, r) => s + r.tasks.filter(t => t.type === 'part').length, 0))
const hMaint = (list, type) => (list || []).filter(m => (m.type || 'prev') === type).reduce((a, m) => a + (Number(m.dureeH) || 0), 0)
const synthEquip = computed(() => planning.value.map(r => {
  const mList = maintEquip[r.eq.id] || []
  const mp = hMaint(mList, 'prev'), mc = hMaint(mList, 'curr'), at = hMaint(mList, 'tech'), au = hMaint(mList, 'autre')
  return {
    id: r.eq.id, code: r.eq.code, nom: r.eq.nom,
    regime: regimeEquip[r.eq.id] || '3x8',
    lots: r.tasks.filter(t => t.type === 'lot').length,
    ng: r.tasks.filter(t => t.type === 'gen' || t.type === 'genH').length,
    np: r.tasks.filter(t => t.type === 'part').length,
    mp, mc, at, au, maintH: mp + mc + at + au,
    fin: r.fin
  }
}).filter(x => x.lots > 0 || x.maintH > 0))
const totalMP = computed(() => synthEquip.value.reduce((s, e) => s + e.mp, 0))
const totalMC = computed(() => synthEquip.value.reduce((s, e) => s + e.mc, 0))
const totalAT = computed(() => synthEquip.value.reduce((s, e) => s + e.at, 0))
const totalAU = computed(() => synthEquip.value.reduce((s, e) => s + e.au, 0))
</script>

<style scoped>
.pe-page { color: #1b2733; }
.pe-head h1 { margin: 0; font-size: 18px; font-weight: 800; color: #0f172a; }
.pe-head .sub { margin: 3px 0 12px; color: #64748b; font-size: 12px; }
.alert { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 8px; padding: 8px 10px; font-size: 12px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; margin-bottom: 12px; }
.empty { padding: 24px; text-align: center; color: #94a3b8; font-size: 13px; }

.params { display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-end; }
.p-grp label { display: flex; flex-direction: column; gap: 4px; font-size: 11px; font-weight: 700; color: #475569; }
.p-grp input, .p-grp select { font-size: 13px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 7px; color: #1b2733; }
.p-grp input[type=range] { padding: 0; }
.vue-btns { display: flex; gap: 4px; }
.vue-btn { background: #eef2f7; border: 1px solid #cbd5e1; border-radius: 7px; font-size: 12px; padding: 5px 11px; cursor: pointer; color: #475569; font-weight: 600; }
.vue-btn.on { background: #0f766e; border-color: #0f766e; color: #fff; }
.dep-row { display: flex; gap: 6px; align-items: center; }
.p-grp .chk { flex-direction: row; align-items: center; gap: 6px; font-size: 12px; }
.p-grp .chk-inline { flex-direction: row; align-items: center; gap: 6px; font-size: 12px; }
.p-grp input[type=text], .p-grp select { font-size: 12px; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 7px; }

.legende { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 8px; font-size: 11px; color: #475569; }
.lg { display: inline-flex; align-items: center; gap: 5px; }
.sw { width: 14px; height: 12px; border-radius: 3px; display: inline-block; }
.sw-lot { background: linear-gradient(90deg, #2563eb 0 33%, #16a34a 33% 66%, #ea580c 66%); border-left: 3px solid #1e3a8a; }
.sw-cours { background: #fff; border: 2px solid #22c55e; box-shadow: 0 0 0 2px rgba(34,197,94,.3); }
.lg-prods { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; margin: 0 0 8px; }
.lg-prods-t { font-size: 10px; font-weight: 700; color: #64748b; margin-right: 2px; }
.lg-prod { display: inline-flex; align-items: center; gap: 5px; background: #fff; border: 1px solid #e2e8f0; border-radius: 999px; padding: 2px 9px 2px 4px; font-size: 10.5px; font-weight: 700; color: #1e293b; cursor: pointer; transition: opacity .15s, box-shadow .15s; }
.lg-prod i { width: 14px; height: 14px; border-radius: 50%; background: var(--c); box-shadow: inset 0 0 0 2px var(--cd); }
.lg-prod-n { font-size: 9px; font-weight: 800; color: #fff; background: var(--c); border-radius: 999px; padding: 0 5px; }
.lg-prod.on { border-color: var(--c); box-shadow: 0 0 0 2px var(--c); }
.lg-prod.off { opacity: .4; }
.lg-prod-reset { background: none; border: none; color: #0f766e; font-size: 10.5px; font-weight: 700; cursor: pointer; text-decoration: underline; }
.sw-gen { background: #7f1d1d; }
.sw-part { background: #cbd5e1; }
.sw-nuit { background: repeating-linear-gradient(45deg, rgba(30,41,59,.12), rgba(30,41,59,.12) 3px, rgba(30,41,59,.28) 3px, rgba(30,41,59,.28) 6px); border: 1px solid #cbd5e1; }

.gantt-card { padding: 0; overflow: hidden; }
.gantt { overflow-x: auto; overflow-y: auto; max-height: calc(100vh - 320px); }
.g-header { display: flex; position: sticky; top: 0; z-index: 5; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
.g-eqcol { flex: 0 0 190px; width: 190px; padding: 6px 10px; border-right: 1px solid #e2e8f0; background: #fff; position: sticky; left: 0; z-index: 3; }
.g-eqhead { display: flex; align-items: center; font-size: 11px; font-weight: 800; color: #475569; background: #f8fafc; }
.g-timeline { position: relative; height: 40px; }
.g-dcol { position: absolute; top: 0; height: 40px; border-left: 1px solid #e2e8f0; box-sizing: border-box; }
.g-dlbl { font-size: 10px; font-weight: 700; color: #334155; padding: 2px 4px; white-space: nowrap; }
.g-shifts { display: flex; }
.g-sh { font-size: 8px; color: #94a3b8; border-left: 1px dashed #e2e8f0; padding-left: 2px; box-sizing: border-box; }
.g-sh0 { border-left: none; padding-left: 0; }
.g-shifts .g-sh { overflow: hidden; white-space: nowrap; }

.g-row { display: flex; border-bottom: 1px solid #f1f5f9; }
.g-eqcode { font-size: 11px; font-weight: 800; color: #0f172a; }
.g-eqnom { font-size: 9.5px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.g-eqfin { font-size: 8.5px; color: #94a3b8; }
.g-eqcours-d { font-weight: 600; opacity: .8; }
.g-eqcours { font-size: 8px; color: #166534; font-weight: 700; background: #dcfce7; border-radius: 4px; padding: 1px 4px; margin: 2px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.g-eqwe { display: flex; align-items: center; gap: 3px; font-size: 8px; color: #64748b; margin-top: 1px; cursor: pointer; }
.g-track { position: relative; height: 54px; }
.g-dband { position: absolute; top: 0; bottom: 0; border-left: 1px solid #f1f5f9; box-sizing: border-box; z-index: 0; }
.g-weekend { position: absolute; top: 0; bottom: 0; background: repeating-linear-gradient(45deg, #f1f5f9, #f1f5f9 6px, #e9edf3 6px, #e9edf3 12px); z-index: 0; }
.g-nuit { position: absolute; top: 0; bottom: 0; background: repeating-linear-gradient(45deg, rgba(30,41,59,.07), rgba(30,41,59,.07) 5px, rgba(30,41,59,.14) 5px, rgba(30,41,59,.14) 10px); z-index: 0; pointer-events: none; }
.g-depart { position: absolute; top: 0; bottom: 0; background: rgba(91, 155, 213, 0.10); border-left: 2px solid #5B9BD5; z-index: 0; box-sizing: border-box; }
.g-dcol-dep { background: rgba(91, 155, 213, 0.08); }
.g-dep-lbl { color: #2A4A85; font-weight: 800; }
.g-maint { position: absolute; top: 2px; bottom: 2px; background: repeating-linear-gradient(45deg, #93c5fd, #93c5fd 5px, #bfdbfe 5px, #bfdbfe 10px); border: 1px solid #3b82f6; border-radius: 3px; z-index: 2; box-sizing: border-box; }
.g-maint-curr { background: repeating-linear-gradient(45deg, #fca5a5, #fca5a5 5px, #fecaca 5px, #fecaca 10px); border-color: #ef4444; }
.g-maint-lbl { font-size: 7.5px; font-weight: 800; color: #1e3a8a; padding: 0 2px; white-space: nowrap; }
.g-maint-curr .g-maint-lbl { color: #7f1d1d; }
.g-maint-tech { background: repeating-linear-gradient(45deg, #d8b4fe, #d8b4fe 5px, #e9d5ff 5px, #e9d5ff 10px); border-color: #a855f7; }
.g-maint-tech .g-maint-lbl { color: #6b21a8; }
.pan-maint-tech { background: #f3e8ff; border-color: #e9d5ff; color: #6b21a8; }
.g-maint-autre { background: repeating-linear-gradient(45deg, #cbd5e1, #cbd5e1 5px, #e2e8f0 5px, #e2e8f0 10px); border-color: #64748b; }
.g-maint-autre .g-maint-lbl { color: #334155; }
.pan-maint-autre { background: #f1f5f9; border-color: #e2e8f0; color: #334155; }
.pan-maint-curr { background: #fee2e2; border-color: #fecaca; color: #991b1b; }
.g-now { position: absolute; top: 0; bottom: 0; width: 2px; background: #ef4444; z-index: 3; }
.g-now-head { position: absolute; top: 0; bottom: 0; width: 2px; background: #ef4444; z-index: 4; }
.g-now-head span { position: absolute; top: 0; left: 2px; background: #ef4444; color: #fff; font-size: 8px; font-weight: 700; padding: 1px 4px; border-radius: 0 3px 3px 0; white-space: nowrap; }
.g-bar { position: absolute; top: 7px; height: 40px; border-radius: 6px; border: 1px solid; box-sizing: border-box; overflow: hidden; display: flex; align-items: center; cursor: default; z-index: 1; transition: opacity .15s, filter .15s, box-shadow .15s; }
.g-bar.g-lot { border-width: 0 0 0 4px; border-left-color: var(--cd); box-shadow: 0 1px 3px rgba(15,23,42,.25), inset 0 1px 0 rgba(255,255,255,.25); }
.g-bar.g-lot:hover { filter: brightness(1.08); box-shadow: 0 4px 10px rgba(15,23,42,.35); z-index: 4; }
.g-bar.g-lot.g-suite { border-left-style: dashed; border-top-left-radius: 0; border-bottom-left-radius: 0; }
.g-bar.g-lot.g-coupe { border-top-right-radius: 0; border-bottom-right-radius: 0; box-shadow: 0 1px 3px rgba(15,23,42,.25), inset -3px 0 0 rgba(255,255,255,.35); }
.g-bar.g-gen, .g-bar.g-genH, .g-bar.g-part { top: 12px; height: 30px; }
.g-bar.g-dim { opacity: .18; filter: grayscale(.7); }
.g-bar.g-focus { box-shadow: 0 0 0 2px #0f172a, 0 4px 10px rgba(15,23,42,.35); z-index: 4; }
.g-bar.g-cours { box-shadow: 0 0 0 2px #fff, 0 0 0 4px #22c55e; animation: gCours 1.6s ease-in-out infinite; z-index: 3; }
@keyframes gCours { 50% { box-shadow: 0 0 0 2px #fff, 0 0 0 4px rgba(34,197,94,.35); } }
.g-lbl { font-size: 10px; font-weight: 800; padding: 0 5px; white-space: nowrap; color: #1e293b; }
.g-lbl2 { display: flex; flex-direction: column; justify-content: center; line-height: 1.2; overflow: hidden; min-width: 0; color: #fff; text-shadow: 0 1px 1px rgba(0,0,0,.25); }
.g-lbl2 .g-lbl-lot { font-size: 11.5px; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: .01em; }
.g-lbl2 .g-lbl-nom { font-size: 9.5px; font-weight: 600; opacity: .92; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.g-turb { font-style: normal; font-size: 9px; font-weight: 800; background: rgba(255,255,255,.25); border-radius: 4px; padding: 0 4px; margin-left: 4px; }
.g-live { color: #bbf7d0; margin-right: 3px; }
.g-bar.g-lot.g-force { outline: 2px dashed #dc2626; outline-offset: 1px; }
.regle-off { font-size: 10px; font-weight: 700; color: #7f1d1d; background: #fef2f2; border: 1px solid #fecaca; border-radius: 7px; padding: 5px 7px; line-height: 1.3; }
.g-gen, .g-genH { background: #7f1d1d; border-color: #7f1d1d; }
.g-gen .g-lbl, .g-genH .g-lbl { color: #fff; }
.g-genH { background: repeating-linear-gradient(45deg, #7f1d1d, #7f1d1d 4px, #991b1b 4px, #991b1b 8px); }
.g-part { background: #cbd5e1; border-color: #94a3b8; }
.g-part .g-lbl { color: #334155; }

.recap h3 { margin: 0 0 8px; font-size: 13px; font-weight: 800; color: #0f172a; }
.recap-grid { display: flex; flex-wrap: wrap; gap: 22px; }
.synth-eq { margin-top: 14px; overflow-x: auto; border-top: 1px solid #f1f5f9; padding-top: 10px; }
.synth-tbl { width: 100%; border-collapse: collapse; font-size: 11px; }
.synth-tbl th { text-align: left; font-size: 10px; color: #64748b; padding: 4px 8px; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
.synth-tbl th.right, .synth-tbl td.right { text-align: right; }
.synth-tbl td { padding: 3px 8px; border-bottom: 1px solid #f1f5f9; color: #1b2733; white-space: nowrap; }
.synth-nom { color: #94a3b8; font-size: 10px; }
.synth-occ-cell { min-width: 150px; }
.synth-occ-cell .so-bar { display: inline-block; width: 70px; height: 8px; background: #f1f5f9; border-radius: 5px; overflow: hidden; vertical-align: middle; margin-right: 6px; }
.synth-occ-cell .so-fill { display: block; height: 100%; border-radius: 5px; }
.so-fill.ch-over { background: #dc2626; } .so-fill.ch-high { background: #f59e0b; } .so-fill.ch-mid { background: #0d9488; } .so-fill.ch-low { background: #94a3b8; }
.synth-occ-cell .so-pct { font-variant-numeric: tabular-nums; font-weight: 800; }
.so-gl { margin-left: 6px; font-size: 8.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .03em; color: #c2410c; background: #ffedd5; border-radius: 999px; padding: 1px 6px; }
.synth-goulot td { background: #fff7ed; }
.rc { display: flex; flex-direction: column; }
.rc-v { font-size: 18px; font-weight: 800; color: #0f172a; }
.rc-l { font-size: 10px; color: #64748b; }
.g-eqcol { cursor: pointer; }
.g-pan { font-size: 8px; color: #0f766e; font-weight: 700; }
.g-reg { font-size: 8px; font-weight: 700; color: #64748b; background: #eef2f7; border-radius: 5px; padding: 0 4px; }
.g-reg.r2 { color: #b45309; background: #fef3c7; }
.pan-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.4); display: flex; align-items: center; justify-content: center; z-index: 50; }
.pan-box { background: #fff; border-radius: 14px; width: 860px; max-width: 96vw; max-height: 92vh; overflow-y: auto; padding: 18px 20px; box-shadow: 0 20px 60px rgba(0,0,0,.3); display: flex; flex-direction: column; }
.pan-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.pan-head b { font-size: 15px; color: #0f172a; }
.pan-nom { font-size: 12px; color: #64748b; }
.pan-close { background: none; border: none; font-size: 16px; cursor: pointer; color: #64748b; }
.pan-head-btns { display: flex; align-items: center; gap: 8px; }
.pan-vider { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; border-radius: 7px; font-size: 12px; padding: 4px 12px; cursor: pointer; font-weight: 600; }
.pan-vider:disabled { opacity: .4; cursor: default; }
.pan-hint { font-size: 11px; color: #94a3b8; margin: 0 0 10px; }
.pan-list { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; max-height: 42vh; overflow-y: auto; border: 1px solid #f1f5f9; border-radius: 8px; padding: 6px; }
.pan-date { font: inherit; font-size: 10.5px; padding: 2px 5px; border: 1px solid #cbd5e1; border-radius: 5px; max-width: 155px; }
.pan-item { display: flex; align-items: center; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 5px 8px; }
.pan-idx { font-size: 11px; font-weight: 800; color: #5B9BD5; width: 18px; }
.pan-pnom { flex: 1; font-size: 12px; color: #1b2733; }
.pan-nb { width: 52px; padding: 3px 5px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; text-align: right; }
.pan-nblbl { font-size: 10px; color: #94a3b8; }
.pan-btn { background: #eef2f7; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 11px; padding: 2px 7px; cursor: pointer; }
.pan-btn:disabled { opacity: .35; cursor: default; }
.pan-btn.del { color: #dc2626; }
.pan-vide { font-size: 12px; color: #94a3b8; padding: 8px; text-align: center; }
.pan-add { border-top: 1px solid #e2e8f0; padding-top: 10px; }
.pan-search { width: 100%; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; margin-bottom: 8px; box-sizing: border-box; }
.pan-prods { display: flex; flex-wrap: wrap; gap: 5px; }
.pan-chip { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; border-radius: 12px; font-size: 11px; padding: 3px 10px; cursor: pointer; font-weight: 600; }
.pan-chip:hover { background: #dbeafe; }
.pan-chip-plan { background: #fef3c7; border-color: #fde68a; color: #92400e; }
.pan-chip-plan:hover { background: #fde68a; }
.pan-chip-cours { background: #dcfce7; border-color: #86efac; color: #166534; }
.pan-chip-cours:hover { background: #bbf7d0; }
.pan-none { font-size: 11px; color: #94a3b8; }
.pan-add-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.pan-add-row .pan-search { margin-bottom: 0; flex: 1; }
.pan-nbadd { font-size: 11px; color: #475569; display: flex; align-items: center; gap: 4px; white-space: nowrap; }
.pan-nbadd .pan-nb { width: 52px; }
.pan-hint2 { font-size: 10px; color: #94a3b8; margin: 0 0 10px; }
.pan-cfg { display: flex; gap: 14px; align-items: center; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #f1f5f9; }
.pan-reg { font-size: 12px; color: #475569; display: flex; align-items: center; gap: 5px; }
.pan-reg select { font-size: 12px; padding: 3px 6px; border: 1px solid #cbd5e1; border-radius: 6px; }
.pan-requis { margin-bottom: 10px; }
.pan-req-head { font-size: 11px; color: #64748b; margin-bottom: 5px; font-weight: 600; }
.pan-req-list { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 6px;  max-height: 120px; overflow-y: auto; }
.pan-req-chip { background: #fef3c7; border: 1px solid #fde68a; color: #92400e; border-radius: 10px; font-size: 11px; padding: 2px 8px; display: inline-flex; align-items: center; gap: 4px; }
.pan-req-chip button { background: none; border: none; color: #b45309; cursor: pointer; font-size: 11px; padding: 0; }
.pan-req-add { display: flex; gap: 6px; align-items: center; }
.pan-reqdate { font-size: 12px; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 6px; }
.pan-reqreg { font-size: 12px; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 6px; }
.g-drag { cursor: grab; }
.g-drag:active { cursor: grabbing; }
.g-dragging { opacity: .5; outline: 2px dashed #5B9BD5; outline-offset: -1px; }
/* Compact global pour optimiser l'affichage */
.pe-head h1 { font-size: 15px; }
.pe-head .sub { font-size: 9.5px; margin-bottom: 8px; }
.card { padding: 8px 10px; margin-bottom: 8px; }
.params { gap: 10px; }
.p-grp label { font-size: 10px; }
.p-grp input, .p-grp select { font-size: 11px; padding: 4px 6px; }
.vue-btn { font-size: 11px; padding: 4px 9px; }
.legende { font-size: 9.5px; gap: 12px; margin-bottom: 6px; }
.recap h3 { font-size: 12px; margin-bottom: 6px; }
.recap-grid { gap: 16px; }
.rc-v { font-size: 15px; }
.rc-l { font-size: 9px; }
.synth-tbl { font-size: 10px; }
.synth-tbl th { font-size: 9px; padding: 3px 6px; }
.synth-tbl td { padding: 2px 6px; }
.synth-nom { font-size: 9px; }
.g-eqcol { flex: 0 0 168px; width: 168px; padding: 4px 8px; }
.g-eqhead { font-size: 10px; }
.g-eqcode { font-size: 10px; }
.g-eqnom { font-size: 8.5px; }
.g-eqfin { font-size: 8px; }
.g-eqwe { font-size: 7.5px; }
.g-dlbl { font-size: 9px; }
.g-sh { font-size: 7.5px; }
.g-reg, .g-pan { font-size: 7.5px; }
/* Paramètres en colonne à gauche du Gantt */
.pe-body { display: flex; gap: 10px; align-items: flex-start; }
.params-side { flex: 0 0 190px; width: 190px; flex-direction: column; align-items: stretch; gap: 8px; align-self: stretch; }
.params-side .p-grp { width: 100%; }
.params-side .p-grp label { display: flex; flex-direction: column; gap: 4px; }
.params-side .vue-btns { flex-wrap: nowrap; gap: 3px; }
.params-side .vue-btns .vue-btn { padding: 4px 4px; font-size: 9.5px; flex: 1 1 0; min-width: 0; white-space: nowrap; }
.params-side .dep-row { width: 100%; }
.params-side input, .params-side select { width: 100%; box-sizing: border-box; }
.pe-gantt-wrap { flex: 1; min-width: 0; }
@media (max-width: 900px) { .pe-body { flex-direction: column; } .params-side { flex: none; width: 100%; flex-direction: row; flex-wrap: wrap; } }
/* En-tête + bouton présentation */
.pe-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 4px; }
.pe-head-btns { display: flex; align-items: center; gap: 8px; }
.pe-pres-btn { background: #0f766e; color: #fff; border: none; border-radius: 8px; font-size: 12px; font-weight: 700; padding: 6px 14px; cursor: pointer; }
.pe-pres-btn.on { background: #334155; }
.pe-suivi-chip { background: #0f172a; color: #fff; font-size: 11px; font-weight: 700; border-radius: 999px; padding: 4px 6px 4px 12px; display: inline-flex; align-items: center; gap: 6px; }
.pe-suivi-chip button { background: rgba(255,255,255,.18); border: none; color: #fff; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; }
.pe-pres-sem { font-weight: 600; color: #64748b; }
/* Groupes par phase */
.g-grp { display: flex; background: #f1f5f9; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; }
.g-grp-lbl { flex: 0 0 168px; width: 168px; position: sticky; left: 0; z-index: 3; background: #f1f5f9; padding: 4px 8px; font-size: 10.5px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: .04em; white-space: nowrap; display: flex; align-items: center; gap: 6px; }
.g-grp-n { background: #0f766e; color: #fff; border-radius: 50%; width: 17px; height: 17px; display: inline-flex; align-items: center; justify-content: center; font-size: 9.5px; }
.g-grp-c { font-weight: 600; color: #64748b; text-transform: none; letter-spacing: 0; font-size: 9.5px; }
.g-grp-line { height: 1px; }
/* Suivi d'un lot */
.g-bar.g-suivi { box-shadow: 0 0 0 3px #0f172a, 0 6px 14px rgba(15,23,42,.4); z-index: 5; filter: none; opacity: 1; }
.g-bar.g-dim2 { opacity: .15; filter: grayscale(.8); }
.g-bar.g-lot { cursor: pointer; }
/* Semaine / export */
.pe-wk { display: flex; align-items: center; gap: 4px; background: #f1f5f9; border-radius: 9px; padding: 3px; }
.pe-wk-btn { background: none; border: none; font-size: 12px; font-weight: 700; color: #475569; padding: 5px 10px; border-radius: 7px; cursor: pointer; }
.pe-wk-btn.on { background: #fff; color: #0f766e; box-shadow: 0 1px 2px rgba(15,23,42,.15); }
.pe-wk-nav { background: #fff; border: 1px solid #cbd5e1; border-radius: 7px; width: 30px; height: 28px; cursor: pointer; font-size: 12px; color: #0f172a; }
.pe-wk-nav:disabled { opacity: .35; cursor: default; }
.pe-wk-lbl { font-size: 12px; font-weight: 800; color: #0f172a; min-width: 44px; text-align: center; font-variant-numeric: tabular-nums; }
.pe-pdf-btn { background: #fff; color: #0f172a; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px; font-weight: 700; padding: 6px 12px; cursor: pointer; }
.pe-pdf-btn:hover { background: #f8fafc; }
/* Campagnes + en-tête nuit */
.g-camp { cursor: pointer; }
.g-camp-tick { position: absolute; top: 4px; bottom: 4px; width: 0; border-left: 2px solid rgba(255,255,255,.75); z-index: 1; }
.g-camp .g-lbl2 { position: relative; z-index: 2; }
.g-camp-tick { opacity: .55; }
.g-nightbar { position: relative; height: 6px; margin-top: 3px; background: #fef3c7; border-radius: 2px; }
.g-nb-n { position: absolute; top: 0; bottom: 0; background: #334155; opacity: .55; }
.pe-pres .g-timeline, .pe-pres .g-dcol { height: 34px; }
/* ===== Mode présentation ===== */
.pe-pres { position: fixed; inset: 0; z-index: 2000; background: #fff; overflow: auto; padding: 14px 20px; }
.pe-pres .params-side, .pe-pres .pe-clean-notice, .pe-pres .alert { display: none; }
.pe-pres .pe-head h1 { font-size: 22px; }
.pe-pres .legende { font-size: 12px; }
.pe-pres .lg-prod { font-size: 12.5px; padding: 3px 11px 3px 5px; }
.pe-pres .gantt { max-height: none; }
.pe-pres .g-eqcol, .pe-pres .g-grp-lbl { flex-basis: 210px; width: 210px; }
.pe-pres .g-eqcode { font-size: 13px; }
.pe-pres .g-eqnom { font-size: 10.5px; }
.pe-pres .g-eqcours { font-size: 10px; }
.pe-pres .g-eqwe, .pe-pres .g-pan { display: none; }
.pe-pres .g-grp-lbl { font-size: 12.5px; padding: 6px 10px; }
.pe-pres .g-dlbl { font-size: 12px; }
.pe-pres .g-sh { font-size: 9.5px; }
.pe-pres .g-track { height: 66px; }
.pe-pres .g-bar { top: 8px; height: 50px; }
.pe-pres .g-bar.g-gen, .pe-pres .g-bar.g-genH, .pe-pres .g-bar.g-part { top: 16px; height: 34px; }
.pe-pres .g-lbl2 .g-lbl-lot { font-size: 14px; }
.pe-pres .g-lbl2 .g-lbl-nom { font-size: 11.5px; }
.pe-pres .g-lbl { font-size: 12px; }
.pe-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 6px 0 10px; }
.pe-kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 14px; display: flex; flex-direction: column; }
.pe-kpi-l { font-size: 11.5px; color: #64748b; font-weight: 600; }
.pe-kpi-v { font-size: 24px; font-weight: 800; color: #0f172a; font-variant-numeric: tabular-nums; }
.pe-kpi-warn .pe-kpi-v { color: #c2410c; }
.pe-kpi-ok .pe-kpi-v { color: #15803d; }
.pe-pres-synth { margin-top: 10px; }
.pe-pres-synth .synth-tbl { font-size: 12px; }
@media (max-width: 900px) { .pe-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
/* Occupation */
.synth-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.occ-per { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.occ-per-t { font-size: 10.5px; color: #64748b; font-weight: 700; margin-right: 2px; }
.occ-per .pe-wk-btn { font-size: 10.5px; padding: 3px 8px; background: #f1f5f9; }
.occ-per .pe-wk-btn.on { background: #0f766e; color: #fff; }
.occ-per .pe-wk-nav { width: 24px; height: 22px; font-size: 10px; }
.occ-per-lib { font-size: 10.5px; font-weight: 800; color: #0f172a; margin-left: 4px; }
.occ-leg { font-size: 10px; color: #64748b; display: inline-flex; align-items: center; gap: 4px; margin-left: 8px; }
.occ-leg i { display: inline-block; width: 10px; height: 8px; border-radius: 2px; }
.so-per { font-weight: 600; color: #94a3b8; text-transform: none; }
.synth-occ-cell .so-bar2 { display: inline-flex; width: 90px; }
.so-prod { background: #0d9488; height: 100%; display: block; }
.so-nett { background: #94a3b8; height: 100%; display: block; }
.occ-leg .so-prod { background: #0d9488; } .occ-leg .so-nett { background: #94a3b8; }
.so-det { font-size: 9px; color: #64748b; margin-left: 6px; white-space: nowrap; }
.so-pct.t-ch-over { color: #dc2626; } .so-pct.t-ch-high { color: #c2410c; }
.synth-occ-cell { min-width: 250px; }
.pe-clean-notice { background: #ecfdf5; border: 1px solid #a7f3d0; color: #047857; padding: 7px 12px; border-radius: 8px; font-size: 12.5px; font-weight: 600; margin: 6px 0; display: inline-flex; align-items: center; gap: 8px; }
.pe-clean-x { background: none; border: none; color: #047857; font-size: 16px; cursor: pointer; line-height: 1; }
/* Présentation : nettoyages en bande fine (après les règles de taille du mode présentation) */
.pe-pres .g-bar.g-gen, .pe-pres .g-bar.g-genH { top: 27px; height: 12px; border-radius: 3px; }
.pe-pres .g-bar.g-gen .g-lbl, .pe-pres .g-bar.g-genH .g-lbl { font-size: 9px; line-height: 12px; }
.pe-pres .g-bar.g-part { top: 27px; height: 12px; }
.g-camp-open { position: absolute; top: 0; height: 7px; background: var(--c); opacity: .85; border-radius: 0 0 4px 4px; cursor: pointer; z-index: 6; }
.g-camp-open span { display: none; position: absolute; top: 7px; left: 0; font-size: 10px; font-weight: 800; color: #fff; background: #0f172a; border-radius: 4px; padding: 1px 6px; white-space: nowrap; }
.g-camp-open:hover { height: 9px; opacity: 1; }
.g-camp-open:hover span { display: block; }
.g-lbl2 .g-lbl-desig { font-size: 10px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pe-pres .g-camp .g-lbl2 { line-height: 1.12; }
.pe-pres .g-camp .g-lbl2 .g-lbl-lot { font-size: 13px; }
.pe-pres .g-camp .g-lbl2 .g-lbl-desig { font-size: 11px; }
.pe-pres .g-camp .g-lbl2 .g-lbl-nom { font-size: 10px; opacity: .85; }
/* Lignes aussi larges que la frise : la colonne équipement reste collée à gauche quel que soit le défilement */
.g-header, .g-row, .g-grp { width: max-content; min-width: 100%; }
/* ===== Mode BOUCLE ===== */
.pb { position: fixed; inset: 0; z-index: 2100; background: #f8fafc; display: flex; flex-direction: column; padding: 14px 22px 8px; overflow: hidden; color: #0f172a; }
.pb-top { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.pb-titre { display: flex; align-items: center; gap: 12px; }
.pb-titre h2 { margin: 0; font-size: 28px; font-weight: 800; }
.pb-num { background: #0f766e; color: #fff; border-radius: 50%; width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 800; }
.pb-sem { font-size: 14px; color: #64748b; font-weight: 600; }
.pb-ctl { display: flex; align-items: center; gap: 6px; }
.pb-ctl button, .pb-ctl select { background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; height: 32px; min-width: 34px; font-size: 13px; cursor: pointer; color: #0f172a; }
.pb-ctl .pb-x { background: #334155; color: #fff; border-color: #334155; }
.pb-h { font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums; margin-right: 6px; }
.pb-pg { font-size: 12px; color: #64748b; font-weight: 700; margin-right: 4px; }
.pb-prog { height: 5px; background: #e2e8f0; border-radius: 3px; margin: 10px 0 8px; overflow: hidden; }
.pb-prog div { height: 100%; background: #0f766e; transition: width .25s linear; }
.pb-prog div.pause { background: #f59e0b; }
.pb-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
.pb-tabs button { background: #fff; border: 1px solid #e2e8f0; border-radius: 999px; padding: 4px 12px; font-size: 12.5px; font-weight: 700; color: #475569; cursor: pointer; }
.pb-tabs button.on { background: #0f766e; color: #fff; border-color: #0f766e; }
.pb-syn { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
.pb-occ { flex: 1; overflow: hidden; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: min-content; gap: 4px 18px; align-content: start; }
.pb-occ-l { display: grid; grid-template-columns: 110px minmax(0, 1fr) 150px 56px 170px; align-items: center; gap: 8px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 10px; font-size: 13px; }
.pb-occ-l.gl { border-color: #fdba74; background: #fff7ed; }
.pb-occ-ph { font-size: 11px; font-weight: 800; color: #0f766e; text-transform: uppercase; letter-spacing: .03em; }
.pb-occ-eq { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #64748b; }
.pb-occ-eq b { color: #0f172a; }
.pb-occ-bar { display: inline-flex; height: 10px; background: #f1f5f9; border-radius: 5px; overflow: hidden; width: 100%; }
.pb-occ-pct { text-align: right; font-variant-numeric: tabular-nums; }
.pb-occ-c { font-size: 12px; color: #15803d; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.t-ch-over { color: #dc2626; } .t-ch-high { color: #c2410c; }
.pb-cartes { flex: 1; display: flex; flex-direction: column; gap: 10px; overflow: hidden; }
.pb-jours { position: absolute; top: 0; left: 252px; right: 14px; height: 16px; }
.pb-jours span { position: absolute; font-size: 12px; font-weight: 700; color: #475569; padding-left: 4px; white-space: nowrap; }
.pb-carte { display: flex; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; min-height: 150px; overflow: hidden; }
.pb-carte.libre { opacity: .7; }
.pb-c-g { flex: 0 0 240px; width: 240px; padding: 12px 14px; border-right: 1px solid #f1f5f9; display: flex; flex-direction: column; gap: 4px; }
.pb-c-code { font-size: 20px; font-weight: 800; }
.pb-c-nom { font-size: 12.5px; color: #64748b; }
.pb-c-occ { margin-top: auto; display: flex; align-items: center; gap: 8px; font-size: 18px; }
.pb-c-d { flex: 1; min-width: 0; padding: 10px 14px 12px 0; display: flex; flex-direction: column; gap: 8px; }
.pb-c-info { display: flex; gap: 16px; flex-wrap: wrap; align-items: center; font-size: 14px; padding-left: 12px; }
.pb-cours { color: #15803d; font-weight: 700; background: #dcfce7; border-radius: 6px; padding: 2px 8px; }
.pb-att { color: #64748b; font-weight: 600; }
.pb-libre { color: #94a3b8; font-weight: 700; }
.pb-next { color: #0f172a; }
.pb-nb { color: #64748b; font-size: 12.5px; margin-left: auto; }
.pb-frise { position: relative; flex: 1; min-height: 72px; margin-left: 12px; background: #fbfcfd; border-radius: 6px; }
.pb-off { position: absolute; top: 0; bottom: 0; background: repeating-linear-gradient(45deg, rgba(30,41,59,.06), rgba(30,41,59,.06) 5px, rgba(30,41,59,.13) 5px, rgba(30,41,59,.13) 10px); }
.pb-jl { position: absolute; top: 0; bottom: 0; border-left: 1px solid #e2e8f0; }
.pb-jl span { position: absolute; top: 1px; left: 4px; font-size: 10.5px; font-weight: 700; color: #94a3b8; white-space: nowrap; }
.pb-c-occ b { white-space: nowrap; }
.pb-c-occ .pb-occ-bar { flex: 1; }
.pb-b { position: absolute; top: 18px; bottom: 6px; border-radius: 6px; overflow: hidden; color: #fff; font-size: 12px; font-weight: 800; display: flex; align-items: center; padding-left: 6px; white-space: nowrap; border-left: 4px solid var(--cd, transparent); box-sizing: border-box; }
.pb-b.pb-gen, .pb-b.pb-genH { top: 40%; bottom: 40%; background: #7f1d1d; border: none; border-radius: 3px; padding: 0; }
.pb-b.pb-part { display: none; }
.pb-camp-l { position: relative; display: flex; flex-direction: column; line-height: 1.15; min-width: 0; text-shadow: 0 1px 1px rgba(0,0,0,.25); }
.pb-camp-l b { font-size: 13px; overflow: hidden; text-overflow: ellipsis; }
.pb-camp-l em { font-style: normal; font-size: 11.5px; font-weight: 600; opacity: .92; overflow: hidden; text-overflow: ellipsis; }
.pb-camp.cours { box-shadow: 0 0 0 2px #fff, 0 0 0 4px #22c55e; }
.pb-now { position: absolute; top: -4px; bottom: -4px; width: 2px; background: #ef4444; z-index: 3; }
.pb-pied { font-size: 11px; color: #94a3b8; text-align: center; padding-top: 6px; }
/* États de lot */
.sw-termine { background: repeating-linear-gradient(45deg, #d4537e44, #d4537e44 3px, #d4537e22 3px, #d4537e22 6px); border: 1px solid #d4537e; }
.sw-plan { background: #d4537e; }
.g-bar.g-termine { box-shadow: none !important; border-width: 1px 1px 1px 4px; border-style: solid; }
.g-bar.g-termine .g-lbl2 { color: var(--cd); text-shadow: none; }
.g-ok { margin-right: 3px; }
.g-bar.g-encours { box-shadow: 0 0 0 2px #fff, 0 0 0 4px #22c55e; animation: gCours 1.6s ease-in-out infinite; z-index: 3; }
.g-prog { position: absolute; left: 0; bottom: 0; height: 5px; background: rgba(255,255,255,.9); border-radius: 0 3px 0 0; z-index: 1; }
.pb-b.pb-termine { color: var(--cd); text-shadow: none; border: 1px solid var(--cd); border-left-width: 4px; }

.pb-b.pb-encours { box-shadow: 0 0 0 2px #fff, 0 0 0 4px #22c55e; }
.pb-n-t { color: #64748b; } .pb-n-c { color: #15803d; }
.pb-b.pb-termine { background: repeating-linear-gradient(45deg, rgba(100,116,139,.16), rgba(100,116,139,.16) 5px, rgba(255,255,255,.9) 5px, rgba(255,255,255,.9) 10px) !important; }
/* Colonne équipement toujours au-dessus des barres (lots démarrés avant la frise) */
.g-eqcol, .g-grp-lbl { z-index: 8; }
.g-header { z-index: 9; }
.pb-b.pb-termine .pb-camp-l { text-shadow: none; }
/* Alimentation automatique */
.p-sync { background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 7px 8px; display: flex; flex-direction: column; gap: 5px; }
.p-sync-t { font-size: 10px; font-weight: 800; color: #0f766e; text-transform: uppercase; letter-spacing: .04em; }
.p-sync-btn { background: #0f766e !important; color: #fff !important; border-color: #0f766e !important; font-size: 10.5px !important; white-space: normal !important; }
.p-sync-r { font-size: 10px; color: #0f766e; font-weight: 700; line-height: 1.35; }
.p-sync-w { color: #b45309; }
.pan-src { font-size: 9px; font-weight: 800; border-radius: 4px; padding: 1px 5px; text-transform: uppercase; }
.src-auto { background: #ccfbf1; color: #0f766e; } .src-man { background: #fef3c7; color: #92400e; }
.pan-btn.on { background: #0f766e; color: #fff; border-color: #0f766e; }
.pan-exclu { opacity: .5; } .pan-exclu .pan-pnom b { text-decoration: line-through; }
.pan-ex-l { font-style: normal; color: #b91c1c; font-size: 10.5px; }
.pe-kpi-s { font-size: 13px; font-weight: 600; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lg-prod-plus { background: #f1f5f9; border: 1px dashed #94a3b8; border-radius: 999px; padding: 2px 10px; font-size: 10.5px; font-weight: 700; color: #334155; cursor: pointer; }
.synth-tgl { margin-top: 8px; background: none; border: none; padding: 2px 0; font-size: 11px; font-weight: 700; color: #0f766e; cursor: pointer; }
.synth-tgl-gl { color: #64748b; font-weight: 600; } .synth-tgl-gl b { color: #c2410c; }
/* Réajustements manuels */
.g-row-cible .g-track:not(.g-timeline) { background: rgba(13,148,136,.08); box-shadow: inset 0 0 0 2px #0d9488; }
.g-row-ko .g-track:not(.g-timeline) { background: rgba(220,38,38,.06); box-shadow: inset 0 0 0 2px #dc2626; }
.pe-move-msg { position: sticky; top: 4px; z-index: 30; display: inline-block; background: #ecfdf5; border: 1px solid #a7f3d0; color: #047857; font-size: 12.5px; font-weight: 700; padding: 6px 12px; border-radius: 8px; margin: 4px 0; }
.pe-move-msg.ko { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }
.pan-ord { display: inline-flex; gap: 2px; }
.pan-ord .pan-btn { padding: 0 5px; font-size: 9px; line-height: 16px; }
.pan-move { font-size: 10.5px; padding: 2px 4px; border: 1px solid #cbd5e1; border-radius: 6px; max-width: 120px; }
.pan-om { font-size: 11px; font-weight: 800; color: #92400e; background: #fef3c7; border-radius: 6px; padding: 2px 8px; display: inline-flex; align-items: center; gap: 6px; }
.pan-camps { display: flex; flex-direction: column; gap: 8px; max-height: 34vh; overflow-y: auto; }
.pan-camp { border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 8px; }
.pan-camp-h { display: flex; align-items: center; gap: 6px; font-size: 12px; margin-bottom: 5px; }
.pan-camp-h i { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.pan-camp-n { color: #64748b; font-size: 11px; }
.pan-camp-all { margin-left: auto; background: #0f766e !important; color: #fff !important; border-color: #0f766e !important; }
.pan-chip-ail { opacity: .55; border-style: dashed; }
.pan-chip small { font-size: 9px; font-weight: 600; }
.pan-warn { font-size: 11px; font-weight: 700; color: #b45309; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 4px 8px; margin: 0 0 6px; }
/* Contrôle des cadences */
.ctrl-btn { width: 100%; display: flex; align-items: center; gap: 4px; justify-content: center; font-size: 10.5px !important; }
.ctrl-btn.ko { border-color: #fca5a5; background: #fef2f2; color: #b91c1c; }
.ctrl-btn.wa { border-color: #fcd34d; background: #fffbeb; color: #92400e; }
.ctrl-n { display: inline-flex; align-items: center; justify-content: center; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 999px; font-size: 9.5px; font-weight: 800; color: #fff; }
.ctrl-n.err { background: #dc2626; } .ctrl-n.warn { background: #d97706; } .ctrl-n.info { background: #0284c7; } .ctrl-n.ok { background: #16a34a; }
.ctrl-box { width: 1100px; }
.ctrl-res { font-size: 12px; color: #334155; margin: 4px 0 6px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.ctrl-tbl td { white-space: normal; vertical-align: top; }
.ctrl-err td { background: #fef2f2; } .ctrl-warn td { background: #fffbeb; }
.ctrl-lien { text-decoration: none; color: #0f766e; font-weight: 700; }
.pan-chip-amont { background: #f5f3ff; border-color: #c4b5fd; color: #5b21b6; }
.pan-chip-amont:hover { background: #ede9fe; }
.ctrl-calc { font-size: 10px; color: #475569; font-variant-numeric: tabular-nums; }
/* Hauteur : zone du Gantt plus haute, lignes plus hautes (colonne équipement lisible) */
.gantt { max-height: calc(100vh - 170px); min-height: 60vh; }
.pe-body .gantt-card { min-height: 62vh; }
.g-track { height: 78px; }
.g-row { min-height: 78px; }
.g-eqcol { min-height: 78px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; gap: 1px; }
.g-eqcode { font-size: 11.5px; }
.g-eqnom { font-size: 9.5px; }
.g-eqcours { font-size: 9px; }
.g-eqfin, .g-eqwe { font-size: 8.5px; }
.g-bar { top: 12px; height: 54px; }
.g-bar.g-gen, .g-bar.g-genH, .g-bar.g-part { top: 24px; height: 30px; }
.g-lbl2 .g-lbl-lot { font-size: 12.5px; }
.g-lbl2 .g-lbl-nom { font-size: 10.5px; }
.g-maint { top: 4px; bottom: 4px; }
/* le mode présentation garde ses propres hauteurs */
.pe-pres .g-track, .pe-pres .g-row, .pe-pres .g-eqcol { height: auto; min-height: 66px; }
.pe-pres .g-track { height: 66px; }
.pe-pres .g-bar { top: 8px; height: 50px; }
.pe-pres .g-bar.g-gen, .pe-pres .g-bar.g-genH, .pe-pres .g-bar.g-part { top: 27px; height: 12px; }
/* Lignes encore plus hautes (colonne équipement) */
.g-track { height: 104px; }
.g-row, .g-eqcol { min-height: 104px; }
.g-eqcode { font-size: 13px; }
.g-eqnom { font-size: 10.5px; white-space: normal; line-height: 1.25; }
.g-eqcours { font-size: 10px; padding: 2px 5px; }
.g-eqfin, .g-eqwe { font-size: 9.5px; }
.g-bar { top: 16px; height: 72px; }
.g-bar.g-gen, .g-bar.g-genH, .g-bar.g-part { top: 34px; height: 36px; }
.g-lbl2 .g-lbl-lot { font-size: 13.5px; }
.g-lbl2 .g-lbl-nom { font-size: 11px; white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.pe-pres .g-track { height: 66px; }
.pe-pres .g-row, .pe-pres .g-eqcol { min-height: 66px; }
.pe-pres .g-bar { top: 8px; height: 50px; }
.pe-pres .g-bar.g-gen, .pe-pres .g-bar.g-genH, .pe-pres .g-bar.g-part { top: 27px; height: 12px; }
/* Sélection de phase (présentation) */
.pe-phases { display: flex; gap: 6px; flex-wrap: wrap; margin: 6px 0 10px; }
.pe-ph { display: inline-flex; flex-direction: column; align-items: flex-start; gap: 1px; background: #fff; border: 1px solid #e2e8f0; border-left: 5px solid #94a3b8; border-radius: 9px; padding: 6px 14px; font: inherit; font-size: 14px; font-weight: 700; color: #0f172a; cursor: pointer; }
.pe-ph b { display: none; }
.pe-ph span { font-size: 11px; font-weight: 600; color: #64748b; }
.pe-ph.on { background: #0f766e; border-color: #0f766e; color: #fff; } .pe-ph.on span { color: #ccfbf1; }
.pe-ph.vide { opacity: .45; cursor: default; }
.pe-ph.ph1 { border-left-color: #64748b; } .pe-ph.ph2 { border-left-color: #0d9488; } .pe-ph.ph3 { border-left-color: #0891b2; } .pe-ph.ph4 { border-left-color: #2563eb; }
.pe-ph.ph5 { border-left-color: #7c3aed; } .pe-ph.ph6 { border-left-color: #4f46e5; } .pe-ph.ph7 { border-left-color: #d97706; }
/* Périmètre des shifts (présentation) */
.g-shbar { position: relative; height: 16px; margin-top: 3px; }
.g-sb { position: absolute; top: 0; bottom: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; border-right: 1px solid rgba(255,255,255,.9); box-sizing: border-box; }
.g-sb i { font-style: normal; font-size: 10px; font-weight: 800; white-space: nowrap; letter-spacing: .02em; }
.g-sb-m { background: linear-gradient(to right, #fffdf0, #fbe7a8); } .g-sb-m i { color: #854d0e; }
.g-sb-a { background: linear-gradient(to right, #fff6ec, #fbd5ad); } .g-sb-a i { color: #9a3412; }
.g-sb-n { background: linear-gradient(to right, #e7ecff, #cfd8ff); } .g-sb-n i { color: #3730a3; }
.sw-shm { background: linear-gradient(to right, #fffdf0, #fbe7a8); border: 1px solid #f5d77a; }
.sw-sha { background: linear-gradient(to right, #fff6ec, #fbd5ad); border: 1px solid #f6c08d; }
.sw-shn { background: linear-gradient(to right, #e7ecff, #cfd8ff); border: 1px solid #b4c0f5; }
.pe-pres .g-dband { border-left: 1px solid #cbd5e1; }
.pe-pres .g-timeline, .pe-pres .g-dcol { height: 40px; }
</style>
