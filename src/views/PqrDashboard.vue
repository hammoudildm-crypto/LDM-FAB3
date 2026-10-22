<template>
  <div class="pqr-page">
    <PageHeader title="Tableau de bord PQR — Revue produit" tone="#a855f7"
      subtitle="Conformité, tendances, capabilité (Cp/Cpk) et maîtrise statistique des paramètres critiques." />

    <p v-if="erreur" class="alert">{{ erreur }}</p>

    <section class="card">
      <div class="pqr-bar">
        <div class="f">
          <label>Rechercher</label>
          <input v-model="rechercheProd" class="prod-search" placeholder="🔍 Code ou produit" />
        </div>
        <div class="f grow">
          <label>Produit <span v-if="rechercheProd" class="cnt">({{ produitsFiltres.length }})</span></label>
          <select v-model="produitSel"><option value="">—</option><option v-for="pr in produitsFiltres" :key="pr.id" :value="String(pr.id)">{{ pr.code_pf }} — {{ pr.designation }}</option></select>
        </div>
        <div class="f"><label>Du</label><input type="date" v-model="dateDu" /></div>
        <div class="f"><label>Au</label><input type="date" v-model="dateAu" /></div>
        <button v-if="dateDu || dateAu" class="btn ghost sm" @click="dateDu=''; dateAu=''">Toute période</button>
        <button v-if="produitSel && mesuresFiltrees.length" class="btn sm" style="margin-left:auto" @click="exporterPDF">📄 Exporter la revue (PDF)</button>
      </div>

      <div v-if="!produitSel" class="empty-card">Choisis un produit pour afficher sa revue qualité.</div>
      <div v-else-if="!mesures.length" class="empty-card">Aucune mesure saisie pour ce produit.</div>
      <div v-else-if="!mesuresFiltrees.length" class="empty-card">Aucune mesure sur la période choisie.</div>

      <template v-else>
        <div class="kpis">
          <div class="kpi"><div class="kv">{{ mesuresFiltrees.length }}</div><div class="kl">Mesures</div></div>
          <div class="kpi"><div class="kv">{{ nbLots }}</div><div class="kl">Lots</div></div>
          <div class="kpi" :class="tauxGlobal >= 95 ? 'good' : 'warn'"><div class="kv">{{ tauxGlobal.toFixed(1) }}%</div><div class="kl">Conformité</div></div>
          <div class="kpi" :class="{ bad: nbHors > 0 }"><div class="kv">{{ nbHors }}</div><div class="kl">Hors spec</div></div>
        </div>

        <div v-if="capabilite.n" class="cap-wrap">
          <div class="cap-head">
            <h3 class="cap-titre">Capabilité du procédé — Cp / Cpk</h3>
            <span class="cap-sub">{{ capabilite.n }} paramètre(s) numérique(s) évalué(s) · guide : Cpk ≥ 1,33 capable · ≥ 1,67 excellent</span>
          </div>
          <div class="cap-cards">
            <div class="cap-card">
              <svg viewBox="0 0 42 42" class="cap-donut">
                <circle class="cd-bg" cx="21" cy="21" r="15.915" />
                <g transform="rotate(-90 21 21)"><circle v-if="capabilite.cpkMoy != null" class="cd-seg" cx="21" cy="21" r="15.915" :stroke="capCol(capabilite.cpkMoy)" :stroke-dasharray="gaugeDash(capabilite.cpkMoy)" stroke-dashoffset="0" /></g>
                <text x="21" y="23" class="cd-val" :style="{ fill: capCol(capabilite.cpkMoy) }">{{ capabilite.cpkMoy != null ? capabilite.cpkMoy.toFixed(2) : '—' }}</text>
              </svg>
              <div class="cap-l">Cpk moyen</div>
              <span class="cap-badge" :style="{ background: capCol(capabilite.cpkMoy) }">{{ capLabel(capabilite.cpkMoy) }}</span>
            </div>
            <div class="cap-card">
              <svg viewBox="0 0 42 42" class="cap-donut">
                <circle class="cd-bg" cx="21" cy="21" r="15.915" />
                <g transform="rotate(-90 21 21)"><circle v-if="capabilite.cpMoy != null" class="cd-seg" cx="21" cy="21" r="15.915" :stroke="capCol(capabilite.cpMoy)" :stroke-dasharray="gaugeDash(capabilite.cpMoy)" stroke-dashoffset="0" /></g>
                <text x="21" y="23" class="cd-val" :style="{ fill: capCol(capabilite.cpMoy) }">{{ capabilite.cpMoy != null ? capabilite.cpMoy.toFixed(2) : '—' }}</text>
              </svg>
              <div class="cap-l">Cp moyen</div>
              <div class="cap-note">Potentiel (procédé centré)</div>
            </div>
            <div class="cap-card">
              <div class="cap-v" :style="{ color: capCol(capabilite.pire ? capabilite.pire.cpk : null) }">{{ capabilite.pire ? capabilite.pire.cpk.toFixed(2) : '—' }}</div>
              <div class="cap-l">Cpk le plus faible</div>
              <div class="cap-note" :title="capabilite.pire ? capabilite.pire.nom : ''">{{ capabilite.pire ? capabilite.pire.nom : '—' }}</div>
            </div>
          </div>
          <div class="cap-bar">
            <template v-for="t in capTiers" :key="'b' + t.key"><div v-if="capabilite.counts[t.key]" class="cap-seg" :style="{ width: (capabilite.counts[t.key] / capabilite.n * 100) + '%', background: t.col }" :title="t.label + ' : ' + capabilite.counts[t.key]"></div></template>
          </div>
          <div class="cap-leg">
            <span v-for="t in capTiers" :key="'l' + t.key" class="cap-lg"><i :style="{ background: t.col }"></i>{{ t.label }} <b>{{ capabilite.counts[t.key] }}</b> <span class="cap-lh">{{ t.hint }}</span></span>
          </div>
        </div>

        <h3 class="sec-titre">Synthèse par paramètre</h3>
        <p class="hint">Clique une ligne pour voir ses graphiques. Cpk ≥ 1,33 : capable · 1,00–1,33 : acceptable · &lt; 1,00 : insuffisant.</p>
        <div class="syn-layout">
          <aside class="syn-side">
            <button :class="{ on: !phaseSyn }" @click="phaseSyn = ''">Toutes</button>
            <button v-for="ph in phasesAvecMesures" :key="ph" :class="{ on: phaseSyn === ph }" @click="phaseSyn = ph">{{ ph }}</button>
          </aside>
          <div class="syn-main">
        <div v-for="ph in phasesSynAffichees" :key="ph" class="pqr-phase">
          <h4 class="pqr-phase-titre">{{ ph }}</h4>
          <table class="pqr-tbl">
            <thead><tr><th class="r cmp-th" title="Cocher pour comparer sur le même graphe">⇄</th><th>Paramètre</th><th class="r">n</th><th class="r">Moyenne</th><th class="r">σ</th><th class="r">Limites</th><th class="r">Conf.</th><th class="r">Cp</th><th class="r">Cpk</th><th>Capabilité</th></tr></thead>
            <tbody>
              <template v-for="et in etapesDeSyn(ph)" :key="ph + '|' + et">
              <tr v-if="et" class="etape-row"><td colspan="10">{{ et }}</td></tr>
              <tr v-for="r in syntheseDeEtape(ph, et)" :key="r.id" :class="{ sel: r.id === paramSel, cmp: estCompare(r.id) }" @click="paramSel = r.id">
                <td class="r cmp-td"><input type="checkbox" :checked="estCompare(r.id)" :disabled="r.bool" @click.stop="toggleCompare(r.id)" title="Comparer ce paramètre" /></td>
                <td class="nom">{{ r.nom }} <span v-if="r.bool" class="tag-bool">ON/OFF</span><span v-else class="u">{{ r.unite ? '(' + r.unite + ')' : '' }}</span></td>
                <td class="r">{{ r.n }}</td>
                <td class="r">{{ r.bool ? (r.nOn + ' ON / ' + (r.n - r.nOn) + ' OFF') : fmtNum(r.mean) }}</td>
                <td class="r">{{ r.bool ? '—' : r.std.toFixed(3) }}</td>
                <td class="r lim">{{ r.bool ? (r.attendu ? 'Att. ' + r.attendu : 'ON/OFF') : limTxt(r.lsl, r.usl) }}</td>
                <td class="r"><span :class="r.conf >= 100 ? 'c-ok' : 'c-ko'">{{ r.conf.toFixed(0) }}%</span></td>
                <td class="r">{{ r.bool ? '—' : (r.cp != null ? r.cp.toFixed(2) : '—') }}</td>
                <td class="r cpk">{{ r.bool ? '—' : (r.cpk != null ? r.cpk.toFixed(2) : '—') }}</td>
                <td><span class="verdict" :class="r.bool ? 'v-na' : verdictCls(r.cpk)">{{ r.bool ? 'ON/OFF' : verdictTxt(r.cpk) }}</span></td>
              </tr>
              </template>
            </tbody>
          </table>
        </div>
          </div>
        </div>

        <div class="chart-head">
          <h3 class="sec-titre">{{ chartMode === 'compare' ? ('Comparaison · ' + comparIds.length + ' paramètre' + (comparIds.length > 1 ? 's' : '')) : (paramSelObj ? paramSelObj.nom : '—') }}<span v-if="chartMode !== 'compare' && paramSelObj && uniteEff(paramSelObj)" class="u"> ({{ uniteEff(paramSelObj) }})</span></h3>
          <div class="tabs">
            <button :class="{ on: chartMode === 'trend' }" @click="chartMode = 'trend'">Tendance vs specs</button>
            <button :class="{ on: chartMode === 'control' }" @click="chartMode = 'control'">Carte de contrôle</button>
            <button :class="{ on: chartMode === 'capab' }" @click="chartMode = 'capab'">Courbe de capabilité</button>
            <button :class="{ on: chartMode === 'compare' }" @click="chartMode = 'compare'">Comparer ({{ comparIds.length }})</button>
          </div>
        </div>

        <div v-if="lotsOrdonnes.length > 1" class="zone-ctrl">
          <div class="zone-head">
            <span class="zone-ttl">⇥ Zone à analyser</span>
            <span class="zone-info">{{ lotLabelAt(Math.min(zoneA, zoneB)) }} → {{ lotLabelAt(Math.max(zoneA, zoneB)) }} · {{ Math.abs(zoneB - zoneA) + 1 }}/{{ lotsOrdonnes.length }} lots</span>
            <button v-if="zoneActive" class="zone-reset" @click="resetZone">↺ Tout</button>
          </div>
          <div class="zone-row">
            <button class="zone-step" @click="zoneGrow(-1)" :disabled="zoneA === zoneB" title="Réduire côté lots récents">−</button>
            <div class="zone-slider">
              <div class="zs-track"></div>
              <div class="zs-sel" :style="{ left: zonePct(Math.min(zoneA, zoneB)) + '%', right: (100 - zonePct(Math.max(zoneA, zoneB))) + '%' }"></div>
              <input type="range" class="zs-input" :min="0" :max="lotsOrdonnes.length - 1" step="1" :value="zoneA" @input="onZoneA" />
              <input type="range" class="zs-input" :min="0" :max="lotsOrdonnes.length - 1" step="1" :value="zoneB" @input="onZoneB" />
            </div>
            <button class="zone-step" @click="zoneGrow(1)" :disabled="Math.max(zoneA, zoneB) === lotsOrdonnes.length - 1" title="Étendre vers les lots récents">+</button>
          </div>
          <p class="hint" style="margin:6px 0 0">La fenêtre choisie filtre toute l'analyse : synthèse, Cp/Cpk, conformité et graphes.</p>
        </div>

        <!-- Tendance vs specs -->
        <div v-if="chartMode === 'trend'">
          <div v-if="chartData" class="chart-wrap">
            <svg :viewBox="'0 0 ' + chartData.W + ' ' + chartData.H" class="trend" preserveAspectRatio="xMidYMid meet" @mousemove="moveCur($event, chartData)" @mouseleave="clearCur()">
              <line :x1="chartData.mL" :y1="chartData.mT" :x2="chartData.mL" :y2="chartData.H - chartData.mB" class="axis" />
              <line :x1="chartData.mL" :y1="chartData.H - chartData.mB" :x2="chartData.W - chartData.mR" :y2="chartData.H - chartData.mB" class="axis" />
              <template v-if="chartData.yUsl != null"><line :x1="chartData.mL" :y1="chartData.yUsl" :x2="chartData.W - chartData.mR" :y2="chartData.yUsl" class="l-spec" /><text :x="chartData.W - chartData.mR" :y="chartData.yUsl - 4" class="lbl-spec">Max {{ chartData.usl }}</text></template>
              <template v-if="chartData.yLsl != null"><line :x1="chartData.mL" :y1="chartData.yLsl" :x2="chartData.W - chartData.mR" :y2="chartData.yLsl" class="l-spec" /><text :x="chartData.W - chartData.mR" :y="chartData.yLsl + 13" class="lbl-spec">Min {{ chartData.lsl }}</text></template>
              <line v-if="chartData.yCible != null" :x1="chartData.mL" :y1="chartData.yCible" :x2="chartData.W - chartData.mR" :y2="chartData.yCible" class="l-cible" />
              <path :d="chartData.path" class="l-data" />
              <circle v-for="(pt, i) in chartData.pts" :key="i" :cx="pt.x" :cy="pt.y" r="4.5" :class="pt.ko ? 'pt-ko' : 'pt-ok'"><title>{{ pt.lot }} : {{ pt.v }}</title></circle>
              <g v-for="(pt, i) in chartData.pts" :key="'ll' + i"><text v-if="i % chartData.step === 0" :x="pt.x" :y="chartData.H - chartData.mB + 11" class="lot-lbl" :transform="'rotate(-45 ' + pt.x + ' ' + (chartData.H - chartData.mB + 11) + ')'">{{ pt.lot }}</text></g>
              <text :x="chartData.mL - 6" :y="chartData.mT + 5" class="ax">{{ chartData.ymax.toFixed(1) }}</text>
              <text :x="chartData.mL - 6" :y="chartData.H - chartData.mB + 4" class="ax">{{ chartData.ymin.toFixed(1) }}</text>
              <template v-if="cur.i >= 0 && chartData.pts[cur.i]">
                <line :x1="cur.x" :y1="chartData.mT" :x2="cur.x" :y2="chartData.H - chartData.mB" class="cur-line" />
                <circle :cx="cur.x" :cy="chartData.pts[cur.i].y" r="5.5" class="cur-dot" />
              </template>
            </svg>
            <div class="leg"><span class="lg"><i class="d-ok"></i>Conforme</span><span class="lg"><i class="d-ko"></i>Hors spec</span><span class="lg"><i class="l-c"></i>Cible</span><span class="lg"><i class="l-s"></i>Limites spec</span></div>
            <div v-if="cur.i >= 0 && chartData.pts[cur.i]" class="cur-readout"><b>{{ chartData.pts[cur.i].lot || '—' }}</b> · {{ chartData.pts[cur.i].v }}{{ paramSelObj && uniteEff(paramSelObj) ? ' ' + uniteEff(paramSelObj) : '' }}</div>
          </div>
          <div v-else-if="paramBool" class="empty-sm">Paramètre ON/OFF — pas de courbe applicable (conformité dans la synthèse).</div>
          <div v-else class="empty-sm">Sélectionne un paramètre ci-dessus.</div>
        </div>

        <!-- Carte de contrôle -->
        <div v-else-if="chartMode === 'control'">
          <div v-if="controlData" class="chart-wrap">
            <svg :viewBox="'0 0 ' + controlData.W + ' ' + controlData.H" class="trend" preserveAspectRatio="xMidYMid meet" @mousemove="moveCur($event, controlData)" @mouseleave="clearCur()">
              <line :x1="controlData.mL" :y1="controlData.mT" :x2="controlData.mL" :y2="controlData.H - controlData.mB" class="axis" />
              <line :x1="controlData.mL" :y1="controlData.H - controlData.mB" :x2="controlData.W - controlData.mR" :y2="controlData.H - controlData.mB" class="axis" />
              <line :x1="controlData.mL" :y1="controlData.yUcl" :x2="controlData.W - controlData.mR" :y2="controlData.yUcl" class="l-ucl" />
              <line :x1="controlData.mL" :y1="controlData.yLcl" :x2="controlData.W - controlData.mR" :y2="controlData.yLcl" class="l-ucl" />
              <line :x1="controlData.mL" :y1="controlData.y2u" :x2="controlData.W - controlData.mR" :y2="controlData.y2u" class="l-sig" />
              <line :x1="controlData.mL" :y1="controlData.y2l" :x2="controlData.W - controlData.mR" :y2="controlData.y2l" class="l-sig" />
              <line :x1="controlData.mL" :y1="controlData.y1u" :x2="controlData.W - controlData.mR" :y2="controlData.y1u" class="l-sig1" />
              <line :x1="controlData.mL" :y1="controlData.y1l" :x2="controlData.W - controlData.mR" :y2="controlData.y1l" class="l-sig1" />
              <line :x1="controlData.mL" :y1="controlData.yCl" :x2="controlData.W - controlData.mR" :y2="controlData.yCl" class="l-cl" />
              <text :x="controlData.W - controlData.mR" :y="controlData.yUcl - 4" class="lbl-ucl">+3σ</text>
              <text :x="controlData.W - controlData.mR" :y="controlData.yLcl + 12" class="lbl-ucl">−3σ</text>
              <text :x="controlData.W - controlData.mR" :y="controlData.yCl - 4" class="lbl-cl">x̄ {{ fmtNum(controlData.mean) }}</text>
              <path :d="controlData.path" class="l-data" />
              <g v-for="(pt, i) in controlData.pts" :key="i">
                <circle v-if="pt.viol.length" :cx="pt.x" :cy="pt.y" r="7.5" class="pt-ring" />
                <circle :cx="pt.x" :cy="pt.y" r="4.5" :class="pt.viol.length ? 'pt-ko' : 'pt-ok'"><title>{{ pt.lot }} : {{ pt.v }}{{ pt.viol.length ? ' — ' + pt.viol.join(', ') : '' }}</title></circle>
              </g>
              <g v-for="(pt, i) in controlData.pts" :key="'cll' + i"><text v-if="i % controlData.step === 0" :x="pt.x" :y="controlData.H - controlData.mB + 11" class="lot-lbl" :transform="'rotate(-45 ' + pt.x + ' ' + (controlData.H - controlData.mB + 11) + ')'">{{ pt.lot }}</text></g>
              <text :x="controlData.mL - 6" :y="controlData.mT + 5" class="ax">{{ controlData.ymax.toFixed(1) }}</text>
              <text :x="controlData.mL - 6" :y="controlData.H - controlData.mB + 4" class="ax">{{ controlData.ymin.toFixed(1) }}</text>
              <template v-if="cur.i >= 0 && controlData.pts[cur.i]">
                <line :x1="cur.x" :y1="controlData.mT" :x2="cur.x" :y2="controlData.H - controlData.mB" class="cur-line" />
                <circle :cx="cur.x" :cy="controlData.pts[cur.i].y" r="5.5" class="cur-dot" />
              </template>
            </svg>
            <div class="leg"><span class="lg"><i class="l-clg"></i>Moyenne (CL)</span><span class="lg"><i class="l-ug"></i>±3σ (UCL/LCL)</span><span class="lg"><i class="d-ko"></i>Violation de règle</span></div>
            <div v-if="cur.i >= 0 && controlData.pts[cur.i]" class="cur-readout"><b>{{ controlData.pts[cur.i].lot || '—' }}</b> · {{ controlData.pts[cur.i].v }}{{ paramSelObj && uniteEff(paramSelObj) ? ' ' + uniteEff(paramSelObj) : '' }}<span v-if="controlData.pts[cur.i].viol.length" class="cur-viol">⚠ {{ controlData.pts[cur.i].viol.join(', ') }}</span></div>
            <div v-if="controlData.alertes.length" class="viol-box">
              <div class="viol-titre">⚠ Signaux de maîtrise détectés</div>
              <div v-for="(a, i) in controlData.alertes" :key="i" class="viol-row"><b>{{ a.lot }}</b> ({{ a.v }}) — {{ a.rules.join(' · ') }}</div>
            </div>
            <div v-else class="viol-ok">✓ Procédé sous contrôle — aucune règle Nelson/Westgard déclenchée.</div>
            <p class="hint rules">Règles : <b>1-3s</b> 1 pt &gt; 3σ · <b>2-2s</b> 2 pts &gt; 2σ même côté · <b>4-1s</b> 4 pts &gt; 1σ même côté · <b>9-x</b> 9 pts du même côté · <b>tendance</b> 6 pts croissants/décroissants.</p>
          </div>
          <div v-else-if="paramBool" class="empty-sm">Carte de contrôle non applicable à un paramètre ON/OFF.</div>
          <div v-else class="empty-sm">Au moins 2 mesures sont nécessaires pour construire la carte de contrôle.</div>
        </div>

        <!-- Courbe de capabilité (distribution vs specs) -->
        <div v-else-if="chartMode === 'capab'">
          <div v-if="capabCourbe" class="chart-wrap">
            <svg :viewBox="'0 0 ' + capabCourbe.W + ' ' + capabCourbe.H" class="trend" preserveAspectRatio="xMidYMid meet">
              <line :x1="capabCourbe.mL" :y1="capabCourbe.y0" :x2="capabCourbe.W - capabCourbe.mR" :y2="capabCourbe.y0" class="axis" />
              <path :d="capabCourbe.area" class="bell-area" :style="{ fill: capCol(capabCourbe.cpk) }" />
              <path :d="capabCourbe.line" class="bell-line" />
              <template v-if="capabCourbe.xLsl != null"><line :x1="capabCourbe.xLsl" :y1="capabCourbe.mT" :x2="capabCourbe.xLsl" :y2="capabCourbe.y0" class="bell-spec" /><text :x="capabCourbe.xLsl" :y="capabCourbe.mT - 5" class="bell-lbl spec">LSL {{ fmtNum(capabCourbe.lsl) }}</text></template>
              <template v-if="capabCourbe.xUsl != null"><line :x1="capabCourbe.xUsl" :y1="capabCourbe.mT" :x2="capabCourbe.xUsl" :y2="capabCourbe.y0" class="bell-spec" /><text :x="capabCourbe.xUsl" :y="capabCourbe.mT - 5" class="bell-lbl spec">USL {{ fmtNum(capabCourbe.usl) }}</text></template>
              <line :x1="capabCourbe.xMean" :y1="capabCourbe.yMeanTop" :x2="capabCourbe.xMean" :y2="capabCourbe.y0" class="bell-mean" />
              <text :x="capabCourbe.xMean" :y="capabCourbe.yMeanTop - 4" class="bell-lbl mean">μ {{ fmtNum(capabCourbe.mean) }}</text>
              <template v-if="capabCourbe.xCible != null"><line :x1="capabCourbe.xCible" :y1="capabCourbe.mT + 6" :x2="capabCourbe.xCible" :y2="capabCourbe.y0" class="bell-cible" /><text :x="capabCourbe.xCible" :y="capabCourbe.y0 + 24" class="bell-lbl cible">Cible {{ fmtNum(capabCourbe.cible) }}</text></template>
            </svg>
            <div class="cap-readrow">
              <span class="crr"><b :style="{ color: capCol(capabCourbe.cp) }">{{ capabCourbe.cp != null ? capabCourbe.cp.toFixed(2) : '—' }}</b> Cp</span>
              <span class="crr"><b :style="{ color: capCol(capabCourbe.cpk) }">{{ capabCourbe.cpk != null ? capabCourbe.cpk.toFixed(2) : '—' }}</b> Cpk</span>
              <span class="crr"><b>{{ fmtNum(capabCourbe.mean) }}</b> μ</span>
              <span class="crr"><b>{{ capabCourbe.std.toFixed(3) }}</b> σ</span>
              <span class="crr"><b>{{ capabCourbe.n }}</b> mesures</span>
              <span class="verdict" :class="verdictCls(capabCourbe.cpk)" style="margin-left:auto">{{ verdictTxt(capabCourbe.cpk) }}</span>
            </div>
            <p class="hint">Courbe normale estimée N(μ, σ) du paramètre, comparée aux limites de spécification. Un procédé capable et centré place toute la cloche entre LSL et USL, centrée sur la cible.</p>
          </div>
          <div v-else-if="paramBool" class="empty-sm">Courbe de capabilité non applicable à un paramètre ON/OFF.</div>
          <div v-else class="empty-sm">Il faut au moins 2 mesures et une limite de spécification (min ou max) pour tracer la courbe.</div>
        </div>

        <!-- Comparaison multi-paramètres -->
        <div v-else-if="chartMode === 'compare'">
          <div v-if="multiChartData" class="chart-wrap">
            <svg :viewBox="'0 0 ' + multiChartData.W + ' ' + multiChartData.H" class="trend" preserveAspectRatio="xMidYMid meet" @mousemove="moveCur($event, multiChartData)" @mouseleave="clearCur()">
              <line :x1="multiChartData.mL" :y1="multiChartData.mT" :x2="multiChartData.mL" :y2="multiChartData.H - multiChartData.mB" class="axis" />
              <line :x1="multiChartData.mL" :y1="multiChartData.H - multiChartData.mB" :x2="multiChartData.W - multiChartData.mR" :y2="multiChartData.H - multiChartData.mB" class="axis" />
              <g v-for="s in multiChartData.series" :key="'ser' + s.id">
                <path :d="s.path" class="l-multi" :style="{ stroke: s.color }" />
                <template v-for="(pt, i) in s.pts" :key="i"><circle v-if="pt" :cx="pt.x" :cy="pt.y" r="3.6" :style="{ fill: s.color }"><title>{{ s.nom }} — {{ pt.lot }} : {{ pt.v }}{{ s.unite ? ' ' + s.unite : '' }}</title></circle></template>
              </g>
              <g v-for="(l, i) in multiChartData.lotLabels" :key="'mll' + i"><text v-if="i % multiChartData.step === 0" :x="l.x" :y="multiChartData.H - multiChartData.mB + 11" class="lot-lbl" :transform="'rotate(-45 ' + l.x + ' ' + (multiChartData.H - multiChartData.mB + 11) + ')'">{{ l.lot }}</text></g>
              <text :x="multiChartData.mL - 6" :y="multiChartData.mT + 5" class="ax">100%</text>
              <text :x="multiChartData.mL - 6" :y="multiChartData.H - multiChartData.mB + 4" class="ax">0%</text>
              <template v-if="cur.i >= 0">
                <line :x1="cur.x" :y1="multiChartData.mT" :x2="cur.x" :y2="multiChartData.H - multiChartData.mB" class="cur-line" />
                <template v-for="s in multiChartData.series" :key="'cd' + s.id"><circle v-if="s.pts[cur.i]" :cx="cur.x" :cy="s.pts[cur.i].y" r="5" class="cur-dot" :style="{ stroke: s.color }" /></template>
              </template>
            </svg>
            <div class="multi-leg">
              <span v-for="s in multiChartData.series" :key="'lg' + s.id" class="ml-item"><span class="ml-dot" :style="{ background: s.color }"></span>{{ s.nom }} <span class="ml-rg">{{ fmtNum(s.min) }}–{{ fmtNum(s.max) }}{{ s.unite ? ' ' + s.unite : '' }}</span></span>
            </div>
            <div v-if="cur.i >= 0 && multiChartData.lotLabels[cur.i]" class="cur-readout">
              <b>{{ multiChartData.lotLabels[cur.i].lot || '—' }}</b>
              <span v-for="s in multiChartData.series" :key="'cr' + s.id" class="cr-it"><span class="cr-dot" :style="{ background: s.color }"></span>{{ s.nom }} : {{ s.pts[cur.i] ? s.pts[cur.i].v : '—' }}{{ s.pts[cur.i] && s.unite ? ' ' + s.unite : '' }}</span>
            </div>
            <p class="hint">Chaque courbe est normalisée sur sa propre plage (0 % = min, 100 % = max) pour comparer les tendances malgré des unités différentes. Valeurs moyennées par lot ; survole un point pour la valeur réelle.</p>
          </div>
          <div v-else class="empty-sm">Coche au moins un paramètre numérique dans la synthèse ci-dessus (colonne ⇄) pour superposer leurs courbes ici.</div>
        </div>

        <h3 class="sec-titre">Analyse d'impact entre paramètres</h3>
        <p class="hint">Relation entre deux paramètres, appariés par lot (moyenne par lot). Un lien statistique n'implique pas forcément une cause directe.</p>
        <div class="corr-ctrls">
          <label>Paramètre X
            <select v-model="corrX"><option value="">—</option><option v-for="p in paramsNumDispo" :key="'cx' + p.id" :value="String(p.id)">{{ p.nom }}</option></select>
          </label>
          <span class="corr-vs">vs</span>
          <label>Paramètre Y
            <select v-model="corrY"><option value="">—</option><option v-for="p in paramsNumDispo" :key="'cy' + p.id" :value="String(p.id)">{{ p.nom }}</option></select>
          </label>
        </div>
        <div v-if="!corrX || !corrY" class="empty-sm">Choisis deux paramètres à comparer.</div>
        <div v-else-if="corrX === corrY" class="empty-sm">Choisis deux paramètres différents.</div>
        <div v-else-if="corrData && corrData.insuffisant" class="empty-sm">Pas assez de lots communs ({{ corrData.n }}) — il en faut au moins 3 avec les deux paramètres mesurés.</div>
        <div v-else-if="corrData" class="corr-wrap">
          <div class="corr-cards">
            <div class="corr-card"><div class="cc-v">{{ corrData.r.toFixed(3) }}</div><div class="cc-l">Corrélation (r)</div></div>
            <div class="corr-card"><div class="cc-v">{{ (corrData.r2 * 100).toFixed(0) }}%</div><div class="cc-l">Variance expliquée (R²)</div></div>
            <div class="corr-card"><div class="cc-v">{{ corrData.n }}</div><div class="cc-l">Lots comparés</div></div>
          </div>
          <p class="corr-verdict" :class="corrForceCls">{{ corrTexte }}</p>
          <div class="corr-actions"><button class="btn sm" @click="exporterAnalysePDF">📄 Exporter l'analyse (PDF)</button></div>
          <div class="chart-wrap">
            <svg :viewBox="'0 0 ' + corrData.W + ' ' + corrData.H" class="trend" preserveAspectRatio="xMidYMid meet">
              <line :x1="corrData.mL" :y1="corrData.mT" :x2="corrData.mL" :y2="corrData.H - corrData.mB" class="axis" />
              <line :x1="corrData.mL" :y1="corrData.H - corrData.mB" :x2="corrData.W - corrData.mR" :y2="corrData.H - corrData.mB" class="axis" />
              <line :x1="corrData.line.x1" :y1="corrData.line.y1" :x2="corrData.line.x2" :y2="corrData.line.y2" class="l-reg" />
              <text :x="corrData.W - corrData.mR - 6" :y="corrData.mT + 14" class="eq-lbl" text-anchor="end">{{ corrEq }}</text>
              <circle v-for="(pt, i) in corrData.pts" :key="'cp' + i" :cx="pt.cx" :cy="pt.cy" r="4.5" class="pt-ok"><title>{{ pt.lot }} — X: {{ fmtNum(pt.x) }} · Y: {{ fmtNum(pt.y) }}</title></circle>
              <text :x="corrData.mL - 6" :y="corrData.mT + 5" class="ax">{{ corrData.ymax.toFixed(1) }}</text>
              <text :x="corrData.mL - 6" :y="corrData.H - corrData.mB + 4" class="ax">{{ corrData.ymin.toFixed(1) }}</text>
              <text :x="corrData.mL" :y="corrData.H - corrData.mB + 16" class="ax">{{ corrData.xmin.toFixed(1) }}</text>
              <text :x="corrData.W - corrData.mR" :y="corrData.H - corrData.mB + 16" class="ax" text-anchor="end">{{ corrData.xmax.toFixed(1) }}</text>
              <text :x="(corrData.mL + corrData.W - corrData.mR) / 2" :y="corrData.H - 8" class="ax-lbl" text-anchor="middle">{{ corrXnom }}</text>
              <text x="14" :y="(corrData.mT + corrData.H - corrData.mB) / 2" class="ax-lbl" text-anchor="middle" :transform="'rotate(-90 14 ' + ((corrData.mT + corrData.H - corrData.mB) / 2) + ')'">{{ corrYnom }}</text>
            </svg>
            <div class="leg"><span class="lg"><i class="d-ok"></i>Lot (X, Y)</span><span class="lg"><i class="l-rg"></i>Tendance (régression)</span></div>
          </div>
        </div>

        <div v-if="matriceCorr" class="mat-block">
          <button class="mat-toggle" @click="matriceOuverte = !matriceOuverte">{{ matriceOuverte ? '▾' : '▸' }} Matrice de corrélation ({{ matriceCorr.params.length }} paramètres)</button>
          <div v-if="matriceOuverte" class="mat-wrap">
            <p class="hint">Chaque case = corrélation (r) entre deux paramètres. Bleu = positive, rouge = négative, intensité = force. Clique une case pour l'analyser en détail.</p>
            <div class="mat-scroll">
              <table class="mat-tbl">
                <thead><tr><th class="mat-corner"></th><th v-for="(p, j) in matriceCorr.params" :key="'mh' + p.id" class="mat-h" :title="p.nom">{{ j + 1 }}</th></tr></thead>
                <tbody>
                  <tr v-for="(row, i) in matriceCorr.cells" :key="'mr' + i">
                    <th class="mat-rh" :title="matriceCorr.params[i].nom">{{ i + 1 }}. {{ matriceCorr.params[i].nom }}</th>
                    <td v-for="(c, j) in row" :key="'mc' + i + '_' + j" class="mat-c" :style="{ background: corrBg(c.r, c.self), color: corrFg(c.r, c.self) }"
                        :title="matriceCorr.params[i].nom + ' × ' + matriceCorr.params[j].nom + (c.r != null ? ' : r = ' + c.r.toFixed(2) + (c.n ? ' (' + c.n + ' lots)' : '') : ' : données insuffisantes')"
                        @click="!c.self && c.r != null && choisirPaire(matriceCorr.params[j].id, matriceCorr.params[i].id)">{{ c.self ? '1' : (c.r != null ? c.r.toFixed(2) : '·') }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <h3 class="sec-titre hors-head" @click="horsPlie = !horsPlie"><span class="hors-chev">{{ horsPlie ? '▸' : '▾' }}</span> Lots hors spec <span v-if="horsSpecListe.length" class="count">{{ horsSpecListe.length }}</span></h3>
        <template v-if="!horsPlie">
        <div v-if="!horsSpecListe.length" class="empty-sm">Aucun lot hors spec 🎉</div>
        <div v-else class="hors-wrap">
          <table class="pqr-tbl hors-tbl">
            <thead><tr><th>Lot</th><th>Phase</th><th>Paramètre</th><th class="r">Valeur</th><th class="r">Limites</th><th>Date</th></tr></thead>
            <tbody>
              <tr v-for="(h, i) in horsSpecListe" :key="i" class="row-ko">
                <td class="nom">{{ h.lot }}</td><td>{{ h.phase }}</td><td>{{ h.nom }}</td>
                <td class="r val-ko">{{ h.valeur }} {{ h.unite }}</td><td class="r lim">{{ h.bool ? ('Attendu ' + h.attendu) : limTxt(h.lsl, h.usl) }}</td><td>{{ h.date || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        </template>
      </template>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'

const PHASES_LISTE = ['Pesée', 'Granulation et Séchage', 'Mélange', 'Compression', 'Remplissage Gélules', 'Pelliculage', 'Contrôle Qualité']
const ETAPES_ORDRE = ['Mélange sec', 'Mouillage', 'Granulation', 'Séchage', 'Calibrage', 'Tamisage', 'Lubrification', 'Réglage', 'Démarrage', 'Milieu', 'Fin']
const etapeIdx = (e) => { const i = ETAPES_ORDRE.indexOf(e); return i >= 0 ? i : 999 }
const produits = ref([])
const produitSel = ref('')
const rechercheProd = ref('')
const dateDu = ref('')
const dateAu = ref('')
const params = ref([])
const specByParam = ref({})
const mesures = ref([])
const paramSel = ref(null)
const comparIds = ref([])
function estCompare(id) { return comparIds.value.includes(id) }
function toggleCompare(id) { const i = comparIds.value.indexOf(id); if (i >= 0) comparIds.value.splice(i, 1); else comparIds.value.push(id) }
const chartMode = ref('trend')
const horsPlie = ref(true)
const corrX = ref('')
const corrY = ref('')
const erreur = ref('')
const normR = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const produitsFiltres = computed(() => { const q = normR(rechercheProd.value).trim(); if (!q) return produits.value; return produits.value.filter(pr => normR((pr.code_pf || '') + ' ' + (pr.designation || '')).includes(q)) })

async function chargerBase() {
  const rp = await supabase.from('pqr_parametres').select('*').eq('actif', true).order('ordre')
  if (rp.error) { erreur.value = rp.error.message; return }
  params.value = rp.data || []
  const rpr = await supabase.from('produits').select('id, code_pf, designation').order('code_pf')
  // On ne garde que les produits ayant au moins une mesure saisie (données remplies).
  // Pagination : l'API plafonne à 1000 lignes ; sans ça, les mesures d'un produit
  // récent (au-delà des 1000 premières lignes) seraient ignorées → produit absent.
  const avecData = new Set()
  for (let from = 0; from < 500000; from += 1000) {
    const r = await supabase.from('pqr_mesures').select('produit_id').range(from, from + 999)
    if (r.error || !r.data || !r.data.length) break
    for (const x of r.data) if (x.produit_id != null) avecData.add(Number(x.produit_id))
    if (r.data.length < 1000) break
  }
  if (!rpr.error) produits.value = (rpr.data || []).filter(pr => avecData.has(Number(pr.id)))
}
onMounted(chargerBase)

watch(produitSel, async (pid) => {
  specByParam.value = {}; mesures.value = []; paramSel.value = null; corrX.value = ''; corrY.value = ''; comparIds.value = []
  if (!pid) return
  const rs = await supabase.from('pqr_specs_produit').select('*').eq('produit_id', Number(pid))
  if (!rs.error) { const by = {}; for (const s of (rs.data || [])) by[s.parametre_id] = s; specByParam.value = by }
  const allM = []
  for (let from = 0; from < 500000; from += 1000) {
    const rm = await supabase.from('pqr_mesures').select('*').eq('produit_id', Number(pid)).range(from, from + 999)
    if (rm.error) { erreur.value = rm.error.message; return }
    const chunk = rm.data || []
    allM.push(...chunk)
    if (chunk.length < 1000) break
  }
  mesures.value = allM
  paramSel.value = synthese.value.length ? synthese.value[0].id : null
})

const mesuresFiltrees = computed(() => mesures.value.filter(m => {
  const d = m.date_mesure || ''
  if (dateDu.value && d && d < dateDu.value) return false
  if (dateAu.value && d && d > dateAu.value) return false
  if ((dateDu.value || dateAu.value) && !d) return false
  return true
}))
// ---- Zone d'analyse : filtre sur une fenêtre de lots ----
const lotKeyOf = (m) => m.of_id != null ? 'of' + m.of_id : (m.numero_lot ? 'lot' + m.numero_lot : '')
const lotsOrdonnes = computed(() => {
  const meta = {}
  for (const m of mesuresFiltrees.value) {
    const key = lotKeyOf(m); if (!key) continue
    if (!meta[key]) meta[key] = { key, lot: m.numero_lot || key, date: m.date_mesure || '' }
    else if (m.date_mesure && (!meta[key].date || m.date_mesure < meta[key].date)) meta[key].date = m.date_mesure
  }
  return Object.values(meta).sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.lot).localeCompare(String(b.lot)))
})
const zoneA = ref(0), zoneB = ref(0)
function resetZone() { zoneA.value = 0; zoneB.value = Math.max(0, lotsOrdonnes.value.length - 1) }
watch(lotsOrdonnes, resetZone, { immediate: true })
const zoneActive = computed(() => lotsOrdonnes.value.length > 1 && (Math.min(zoneA.value, zoneB.value) > 0 || Math.max(zoneA.value, zoneB.value) < lotsOrdonnes.value.length - 1))
function onZoneA(e) { zoneA.value = Number(e.target.value) }
function onZoneB(e) { zoneB.value = Number(e.target.value) }
function zoneGrow(d) {
  const n = lotsOrdonnes.value.length
  const a = Math.min(zoneA.value, zoneB.value)
  let b = Math.max(zoneA.value, zoneB.value)
  if (d > 0) b = Math.min(n - 1, b + 1)   // étend vers la droite (lots récents)
  else b = Math.max(a, b - 1)             // réduit côté droit, garde le bord gauche
  zoneA.value = a; zoneB.value = b
}
function zonePct(i) { const n = lotsOrdonnes.value.length; return n <= 1 ? 0 : i / (n - 1) * 100 }
function lotLabelAt(i) { const l = lotsOrdonnes.value[i]; return l ? l.lot : '—' }
const zoneKeys = computed(() => { const ls = lotsOrdonnes.value; const a = Math.min(zoneA.value, zoneB.value), b = Math.max(zoneA.value, zoneB.value); return new Set(ls.slice(a, b + 1).map(l => l.key)) })
const mesuresZone = computed(() => {
  if (!zoneActive.value) return mesuresFiltrees.value
  const keep = zoneKeys.value
  return mesuresFiltrees.value.filter(m => { const k = lotKeyOf(m); return !k || keep.has(k) })
})

const baseParById = computed(() => { const m = {}; for (const p of params.value) m[p.id] = p; return m })
// Identité logique : un paramètre « par API » est scindé par principe actif (id::api)
function lidOf(pid, api) { const b = baseParById.value[pid]; return (b && b.par_api && api) ? (pid + '::' + api) : String(pid) }
// Paramètres logiques : un paramètre « par API » devient un paramètre virtuel par API présent dans les mesures
const paramsLog = computed(() => {
  const present = {}
  for (const m of mesuresZone.value) { if (m.api) (present[m.parametre_id] = present[m.parametre_id] || new Set()).add(m.api) }
  const out = []
  for (const p of params.value) {
    const apis = present[p.id] ? [...present[p.id]] : []
    if (p.par_api && apis.length) { for (const a of apis) out.push({ ...p, id: p.id + '::' + a, baseId: p.id, api: a, nom: p.nom + ' – ' + a }) }
    else out.push({ ...p, id: String(p.id), baseId: p.id, api: '' })
  }
  return out
})
const mesuresPlat = computed(() => {
  const out = []
  for (const m of mesuresZone.value) {
    const vals = Array.isArray(m.valeurs) && m.valeurs.length ? m.valeurs : (m.valeur != null ? [m.valeur] : [])
    const lid = lidOf(m.parametre_id, m.api)
    vals.forEach((v, k) => out.push({ parametre_id: lid, valeur: v, numero_lot: m.numero_lot, of_id: m.of_id, date_mesure: m.date_mesure, rang: k }))
  }
  return out
})

function effMin(p) { const s = specByParam.value[p.baseId != null ? p.baseId : p.id]; return s && s.limite_min != null ? s.limite_min : p.limite_min }
function uniteEff(p) { const s = specByParam.value[p.baseId != null ? p.baseId : p.id]; return (s && s.unite) ? s.unite : (p.unite || '') }
function effMax(p) { const s = specByParam.value[p.baseId != null ? p.baseId : p.id]; return s && s.limite_max != null ? s.limite_max : p.limite_max }
function effCible(p) { const s = specByParam.value[p.baseId != null ? p.baseId : p.id]; return s && s.cible != null ? s.cible : p.cible }
function horsSpecVal(v, mn, mx) { return (mn != null && v < mn) || (mx != null && v > mx) }
function limTxt(mn, mx) { if (mn == null && mx == null) return '—'; return (mn != null ? mn : '…') + ' – ' + (mx != null ? mx : '…') }
const fmtNum = (v) => (v == null || v === '' || Number.isNaN(Number(v))) ? '—' : parseFloat(Number(v).toFixed(6)).toString()
function stats(vals) { const n = vals.length; const mean = vals.reduce((a, b) => a + b, 0) / n; const variance = n > 1 ? vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0; return { n, mean, std: Math.sqrt(variance), min: Math.min(...vals), max: Math.max(...vals) } }
function cpkCalc(mean, std, lsl, usl) { if (std <= 0 || (lsl == null && usl == null)) return { cp: null, cpk: null }; const cp = (lsl != null && usl != null) ? (usl - lsl) / (6 * std) : null; const cpu = usl != null ? (usl - mean) / (3 * std) : Infinity; const cpl = lsl != null ? (mean - lsl) / (3 * std) : Infinity; const cpk = Math.min(cpu, cpl); return { cp, cpk: cpk === Infinity ? null : cpk } }

const paramById = computed(() => { const m = {}; for (const p of paramsLog.value) m[p.id] = p; return m })

// ---- Analyse d'impact entre paramètres (corrélation par lot) ----
// valeurs moyennes par lot pour chaque paramètre numérique (réutilisé par le nuage et la matrice)
const valParLotParam = computed(() => {
  const m = {}
  for (const r of mesuresPlat.value) {
    const v = Number(r.valeur); if (Number.isNaN(v)) continue
    const key = r.of_id != null ? 'of' + r.of_id : 'lot' + (r.numero_lot || '')
    if (key === 'of' || key === 'lot') continue
    if (!m[r.parametre_id]) m[r.parametre_id] = {}
    const o = m[r.parametre_id]
    if (!o[key]) o[key] = { s: 0, n: 0, lot: r.numero_lot }
    o[key].s += v; o[key].n++
  }
  return m
})
function pearsonEntre(xid, yid) {
  const mp = valParLotParam.value
  const X = mp[xid], Y = mp[yid]
  if (!X || !Y) return null
  const pairs = []
  for (const key of Object.keys(X)) { if (Y[key]) pairs.push({ x: X[key].s / X[key].n, y: Y[key].s / Y[key].n, lot: X[key].lot || Y[key].lot || '' }) }
  if (pairs.length < 3) return { pairs, n: pairs.length, r: null }
  const n = pairs.length
  const mx = pairs.reduce((a, q) => a + q.x, 0) / n
  const my = pairs.reduce((a, q) => a + q.y, 0) / n
  let sxy = 0, sxx = 0, syy = 0
  for (const q of pairs) { const dx = q.x - mx, dy = q.y - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy }
  const r = (sxx > 0 && syy > 0) ? sxy / Math.sqrt(sxx * syy) : 0
  const slope = sxx > 0 ? sxy / sxx : 0
  const intercept = my - slope * mx
  return { pairs, n, r, slope, intercept }
}
const paramsNumDispo = computed(() => {
  const avecData = new Set(mesuresPlat.value.map(m => m.parametre_id))
  return paramsLog.value.filter(p => p.type !== 'bool' && avecData.has(p.id))
})
const corrData = computed(() => {
  const xid = corrX.value, yid = corrY.value
  if (!xid || !yid || xid === yid) return null
  const c = pearsonEntre(xid, yid)
  if (!c) return null
  if (c.r == null) return { insuffisant: true, n: c.n }
  const { pairs, n, r, slope, intercept } = c
  const W = 760, H = 380, mL = 58, mR = 24, mT = 22, mB = 52
  const xs = pairs.map(p => p.x), ys = pairs.map(p => p.y)
  let xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys)
  if (xmin === xmax) { xmin -= 1; xmax += 1 }
  if (ymin === ymax) { ymin -= 1; ymax += 1 }
  const pX = (xmax - xmin) * 0.08, pY = (ymax - ymin) * 0.08
  xmin -= pX; xmax += pX; ymin -= pY; ymax += pY
  const xx = (v) => mL + (v - xmin) / (xmax - xmin) * (W - mL - mR)
  const yy = (v) => H - mB - (v - ymin) / (ymax - ymin) * (H - mT - mB)
  const pts = pairs.map(p => ({ cx: xx(p.x), cy: yy(p.y), x: p.x, y: p.y, lot: p.lot }))
  const line = { x1: xx(xmin), y1: yy(slope * xmin + intercept), x2: xx(xmax), y2: yy(slope * xmax + intercept) }
  return { insuffisant: false, n, r, r2: r * r, slope, intercept, W, H, mL, mR, mT, mB, xmin, xmax, ymin, ymax, pts, line }
})
const corrXnom = computed(() => { const p = paramById.value[corrX.value]; return p ? p.nom + (uniteEff(p) ? ' (' + uniteEff(p) + ')' : '') : '' })
const corrYnom = computed(() => { const p = paramById.value[corrY.value]; return p ? p.nom + (uniteEff(p) ? ' (' + uniteEff(p) + ')' : '') : '' })
const corrForceCls = computed(() => { const d = corrData.value; if (!d || d.insuffisant) return ''; const ar = Math.abs(d.r); return ar < 0.4 ? 'cv-weak' : ar < 0.6 ? 'cv-mod' : 'cv-strong' })
const corrTexte = computed(() => {
  const d = corrData.value
  if (!d || d.insuffisant) return ''
  const ar = Math.abs(d.r)
  const force = ar < 0.2 ? 'négligeable' : ar < 0.4 ? 'faible' : ar < 0.6 ? 'modérée' : ar < 0.8 ? 'forte' : 'très forte'
  const px = paramById.value[corrX.value], py = paramById.value[corrY.value]
  const nx = px ? px.nom : 'X', ny = py ? py.nom : 'Y'
  if (ar < 0.2) return 'Corrélation ' + force + ' (r = ' + d.r.toFixed(2) + ') : aucune relation nette entre ' + nx + ' et ' + ny + ' sur les lots mesurés.'
  const sens = d.r > 0 ? 'augmenter' : 'diminuer'
  return 'Corrélation ' + force + ' et ' + (d.r > 0 ? 'positive' : 'négative') + ' (r = ' + d.r.toFixed(2) + ', R² = ' + (d.r2 * 100).toFixed(0) + '%) : lorsque ' + nx + ' augmente, ' + ny + ' tend à ' + sens + '. Le R² est la part de variation de ' + ny + ' statistiquement liée à ' + nx + '.'
})
const corrEq = computed(() => {
  const d = corrData.value
  if (!d || d.insuffisant) return ''
  const a = d.slope, b = d.intercept
  const af = parseFloat(a.toFixed(4)).toString()
  const bf = parseFloat(Math.abs(b).toFixed(4)).toString()
  return 'y = ' + af + '·x ' + (b >= 0 ? '+ ' : '− ') + bf
})
const matriceOuverte = ref(false)
const matriceCorr = computed(() => {
  const ps = paramsNumDispo.value
  if (ps.length < 2) return null
  const cells = ps.map(pi => ps.map(pj => {
    if (pi.id === pj.id) return { r: 1, self: true, n: null }
    const c = pearsonEntre(pi.id, pj.id)
    return { r: (c && c.r != null) ? c.r : null, n: c ? c.n : 0, self: false }
  }))
  return { params: ps, cells }
})
function corrBg(r, self) {
  if (self) return '#eef2ff'
  if (r == null) return '#f8fafc'
  const a = Math.min(1, Math.abs(r))
  if (r >= 0) return 'rgba(37, 99, 235, ' + (0.1 + a * 0.72).toFixed(2) + ')'
  return 'rgba(220, 38, 38, ' + (0.1 + a * 0.72).toFixed(2) + ')'
}
function corrFg(r, self) { if (self) return '#4338ca'; return (r != null && Math.abs(r) > 0.55) ? '#fff' : '#334155' }
function choisirPaire(xid, yid) { corrX.value = String(xid); corrY.value = String(yid) }
const synthese = computed(() => {
  const byParam = {}
  for (const m of mesuresPlat.value) { const v = Number(m.valeur); if (!Number.isNaN(v)) (byParam[m.parametre_id] = byParam[m.parametre_id] || []).push(v) }
  const out = []
  for (const p of paramsLog.value) {
    const vals = byParam[p.id]; if (!vals || !vals.length) continue
    if (p.type === 'bool') {
      const nOn = vals.filter(v => v > 0).length; const attendu = p.etat_attendu || null
      const conf = attendu ? (vals.filter(v => ((attendu === 'ON') === (v > 0))).length / vals.length * 100) : 100
      out.push({ id: p.id, phase: p.phase, etape: p.etape || '', nom: p.nom, unite: uniteEff(p), bool: true, n: vals.length, nOn, attendu, conf, mean: null, std: null, cp: null, cpk: null, lsl: null, usl: null })
      continue
    }
    const st = stats(vals); const lsl = effMin(p), usl = effMax(p)
    const conf = vals.filter(v => !horsSpecVal(v, lsl, usl)).length / vals.length * 100
    const c = cpkCalc(st.mean, st.std, lsl, usl)
    out.push({ id: p.id, phase: p.phase, etape: p.etape || '', nom: p.nom, unite: uniteEff(p), n: st.n, mean: st.mean, std: st.std, min: st.min, max: st.max, lsl, usl, conf, cp: c.cp, cpk: c.cpk })
  }
  return out
})
const phaseIndex = (ph) => { const i = PHASES_LISTE.indexOf(ph); return i < 0 ? 999 : i }
const phasesAvecMesures = computed(() => [...new Set(synthese.value.map(r => r.phase))].sort((a, b) => phaseIndex(a) - phaseIndex(b)))
const phaseSyn = ref('')
const phasesSynAffichees = computed(() => phaseSyn.value ? phasesAvecMesures.value.filter(ph => ph === phaseSyn.value) : phasesAvecMesures.value)
function syntheseDe(ph) { return synthese.value.filter(r => r.phase === ph) }
function etapesDeSyn(ph) { const seen = []; for (const r of syntheseDe(ph)) { const e = r.etape || ''; if (!seen.includes(e)) seen.push(e) } return seen.sort((a, b) => (a === '' ? -1 : b === '' ? 1 : (etapeIdx(a) - etapeIdx(b)) || a.localeCompare(b))) }
function syntheseDeEtape(ph, et) { return syntheseDe(ph).filter(r => (r.etape || '') === et) }

const nbLots = computed(() => new Set(mesuresPlat.value.map(m => m.of_id)).size)
function estHors(m) { const p = paramById.value[m.parametre_id]; if (!p) return false; if (p.type === 'bool') { const att = p.etat_attendu; if (!att) return false; return (att === 'ON') !== (Number(m.valeur) > 0) } return horsSpecVal(Number(m.valeur), effMin(p), effMax(p)) }
const nbHors = computed(() => mesuresPlat.value.filter(estHors).length)
const tauxGlobal = computed(() => mesuresPlat.value.length ? (mesuresPlat.value.length - nbHors.value) / mesuresPlat.value.length * 100 : 0)

function verdictCls(cpk) { if (cpk == null) return 'v-na'; if (cpk >= 1.33) return 'v-ok'; if (cpk >= 1.0) return 'v-mid'; return 'v-ko' }
function verdictTxt(cpk) { if (cpk == null) return '—'; if (cpk >= 1.33) return 'Capable'; if (cpk >= 1.0) return 'Acceptable'; return 'Insuffisant' }

// --- Capabilité : synthèse graphique inspirée du guide Cp/Cpk (4 niveaux) ---
const capTiers = [
  { key: 'exc', label: 'Excellent', hint: 'Cpk ≥ 1,67', col: '#15803d' },
  { key: 'cap', label: 'Capable', hint: '1,33 – 1,67', col: '#16a34a' },
  { key: 'acc', label: 'Acceptable', hint: '1,00 – 1,33', col: '#d97706' },
  { key: 'ko', label: 'Insuffisant', hint: '< 1,00', col: '#dc2626' }
]
function capTier(v) { if (v == null) return null; if (v >= 1.67) return 'exc'; if (v >= 1.33) return 'cap'; if (v >= 1.0) return 'acc'; return 'ko' }
function capCol(v) { const t = capTier(v); return t ? capTiers.find(x => x.key === t).col : '#94a3b8' }
function capLabel(v) { const t = capTier(v); return t ? capTiers.find(x => x.key === t).label : '—' }
const capabilite = computed(() => {
  const rows = synthese.value.filter(r => !r.bool && r.cpk != null)
  const counts = { exc: 0, cap: 0, acc: 0, ko: 0 }
  let sCpk = 0, sCp = 0, nCp = 0, pire = null
  for (const r of rows) {
    const t = capTier(r.cpk); if (t) counts[t]++
    sCpk += r.cpk
    if (r.cp != null) { sCp += r.cp; nCp++ }
    if (!pire || r.cpk < pire.cpk) pire = r
  }
  const n = rows.length
  return { n, counts, cpkMoy: n ? sCpk / n : null, cpMoy: nCp ? sCp / nCp : null, pire }
})
// Jauge donut : indice (0 → 2) en pourcentage d'arc
function gaugeDash(v) { if (v == null) return '0 100'; const pct = Math.max(0, Math.min(100, v / 2 * 100)); return pct.toFixed(1) + ' ' + (100 - pct).toFixed(1) }
// Courbe de capabilité (cloche normale vs limites) pour le paramètre sélectionné
const capabCourbe = computed(() => {
  const p = paramSelObj.value
  if (!p || p.type === 'bool') return null
  const row = synthese.value.find(r => r.id === paramSel.value)
  if (!row || row.std == null || row.std <= 0) return null
  const mean = row.mean, std = row.std, lsl = row.lsl, usl = row.usl, cible = effCible(p)
  if (lsl == null && usl == null) return null
  const xs = [mean - 4 * std, mean + 4 * std]
  if (lsl != null) xs.push(lsl); if (usl != null) xs.push(usl); if (cible != null) xs.push(cible)
  let xmin = Math.min(...xs), xmax = Math.max(...xs)
  const pad = (xmax - xmin) * 0.06 || 1; xmin -= pad; xmax += pad
  const W = 760, H = 260, mL = 20, mR = 20, mT = 26, mB = 40
  const xx = (x) => mL + (x - xmin) / (xmax - xmin) * (W - mL - mR)
  const yy = (yn) => mT + (1 - yn) * (H - mT - mB)
  const y0 = yy(0)
  const N = 80, pts = []
  for (let i = 0; i <= N; i++) { const x = xmin + (xmax - xmin) * i / N; const z = (x - mean) / std; pts.push({ x: xx(x), y: yy(Math.exp(-0.5 * z * z)) }) }
  const line = pts.map((q, i) => (i ? 'L' : 'M') + q.x.toFixed(1) + ' ' + q.y.toFixed(1)).join(' ')
  const area = 'M' + pts[0].x.toFixed(1) + ' ' + y0.toFixed(1) + ' ' + pts.map(q => 'L' + q.x.toFixed(1) + ' ' + q.y.toFixed(1)).join(' ') + ' L' + pts[pts.length - 1].x.toFixed(1) + ' ' + y0.toFixed(1) + ' Z'
  return {
    W, H, mL, mR, mT, mB, line, area, y0,
    xLsl: lsl != null ? xx(lsl) : null, xUsl: usl != null ? xx(usl) : null,
    xMean: xx(mean), xCible: cible != null ? xx(cible) : null, yMeanTop: yy(1),
    lsl, usl, cible, mean, std, cp: row.cp, cpk: row.cpk, n: row.n
  }
})

const paramSelObj = computed(() => paramById.value[paramSel.value] || null)
const paramBool = computed(() => { const p = paramSelObj.value; return !!(p && p.type === 'bool') })
const byDate = (a, b) => String(a.date_mesure || '').localeCompare(String(b.date_mesure || '')) || ((a.of_id || 0) - (b.of_id || 0)) || ((a.rang || 0) - (b.rang || 0))
function mesuresParam(p) { return mesuresPlat.value.filter(m => m.parametre_id === p.id && !Number.isNaN(Number(m.valeur))).slice().sort(byDate) }

const chartData = computed(() => {
  const p = paramSelObj.value; if (!p || p.type === 'bool') return null
  const ms = mesuresParam(p); if (!ms.length) return null
  const vals = ms.map(m => Number(m.valeur)); const lsl = effMin(p), usl = effMax(p), cible = effCible(p)
  const allY = [...vals]; if (lsl != null) allY.push(lsl); if (usl != null) allY.push(usl); if (cible != null) allY.push(cible)
  let ymin = Math.min(...allY), ymax = Math.max(...allY); if (ymin === ymax) { ymin -= 1; ymax += 1 }
  const pd = (ymax - ymin) * 0.12; ymin -= pd; ymax += pd
  const W = 760, H = 280, mL = 52, mR = 54, mT = 16, mB = 62; const step = Math.max(1, Math.ceil(ms.length / 22))
  const xx = (i) => mL + (ms.length === 1 ? (W - mL - mR) / 2 : i * (W - mL - mR) / (ms.length - 1))
  const yy = (v) => mT + (ymax - v) / (ymax - ymin) * (H - mT - mB)
  const pts = ms.map((m, i) => ({ x: xx(i), y: yy(Number(m.valeur)), v: Number(m.valeur), lot: m.numero_lot || '', ko: horsSpecVal(Number(m.valeur), lsl, usl) }))
  const path = pts.map((pt, i) => (i ? 'L' : 'M') + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1)).join(' ')
  return { W, H, mL, mR, mT, mB, step, xs: pts.map(p => p.x), pts, path, lsl, usl, cible, ymin, ymax, yLsl: lsl != null ? yy(lsl) : null, yUsl: usl != null ? yy(usl) : null, yCible: cible != null ? yy(cible) : null }
})

// ---- Comparaison multi-paramètres (courbes superposées, normalisées 0–100 %) ----
const SERIES_COLORS = ['#6366f1', '#0d9488', '#e11d48', '#f59e0b', '#2563eb', '#9333ea', '#16a34a', '#0891b2']
const multiChartData = computed(() => {
  const ids = comparIds.value.filter(id => { const p = paramById.value[id]; return p && p.type !== 'bool' })
  if (!ids.length) return null
  const acc = {}, lotMeta = {}
  for (const id of ids) acc[id] = {}
  for (const m of mesuresPlat.value) {
    const id = m.parametre_id; if (!acc[id]) continue
    const v = Number(m.valeur); if (Number.isNaN(v)) continue
    const key = m.of_id != null ? 'of' + m.of_id : 'lot' + (m.numero_lot || '')
    if (key === 'of' || key === 'lot') continue
    if (!acc[id][key]) acc[id][key] = { s: 0, n: 0 }
    acc[id][key].s += v; acc[id][key].n++
    if (!lotMeta[key]) lotMeta[key] = { lot: m.numero_lot || key, date: m.date_mesure || '' }
    else if (m.date_mesure && (!lotMeta[key].date || m.date_mesure < lotMeta[key].date)) lotMeta[key].date = m.date_mesure
  }
  const allKeys = new Set()
  for (const id of ids) for (const k of Object.keys(acc[id])) allKeys.add(k)
  const keys = [...allKeys].sort((a, b) => String(lotMeta[a].date).localeCompare(String(lotMeta[b].date)) || a.localeCompare(b))
  if (!keys.length) return null
  const W = 760, H = 300, mL = 42, mR = 22, mT = 16, mB = 64, n = keys.length
  const xx = (i) => mL + (n === 1 ? (W - mL - mR) / 2 : i * (W - mL - mR) / (n - 1))
  const yy = (t) => mT + (1 - t) * (H - mT - mB)
  const series = ids.map((id, si) => {
    const p = paramById.value[id]
    const raw = keys.map(k => acc[id][k] ? acc[id][k].s / acc[id][k].n : null)
    const present = raw.filter(v => v != null)
    if (!present.length) return null
    const rMin = Math.min(...present), rMax = Math.max(...present)
    let a = rMin, b = rMax; if (a === b) { a -= 1; b += 1 }
    const pts = raw.map((v, i) => v == null ? null : { x: xx(i), y: yy((v - a) / (b - a)), v, lot: lotMeta[keys[i]].lot })
    let path = '', pen = false
    for (const pt of pts) { if (!pt) { pen = false; continue } path += (pen ? 'L' : 'M') + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1) + ' '; pen = true }
    return { id, nom: p.nom, unite: uniteEff(p), color: SERIES_COLORS[si % SERIES_COLORS.length], pts, path: path.trim(), min: rMin, max: rMax }
  }).filter(Boolean)
  if (!series.length) return null
  const step = Math.max(1, Math.ceil(n / 22))
  const lotLabels = keys.map((k, i) => ({ x: xx(i), lot: lotMeta[k].lot }))
  return { W, H, mL, mR, mT, mB, step, xs: lotLabels.map(l => l.x), series, lotLabels, n }
})

// ---- Curseur vertical : lecture des valeurs au lot pointé ----
const cur = ref({ i: -1, x: 0 })
function clearCur() { cur.value = { i: -1, x: 0 } }
function moveCur(ev, data) {
  if (!data || !data.xs || !data.xs.length) return
  const r = ev.currentTarget.getBoundingClientRect(); if (!r.width) return
  const sx = (ev.clientX - r.left) / r.width * data.W
  let best = 0, bd = Infinity
  for (let i = 0; i < data.xs.length; i++) { const d = Math.abs(data.xs[i] - sx); if (d < bd) { bd = d; best = i } }
  cur.value = { i: best, x: data.xs[best] }
}
watch([chartMode, produitSel], clearCur)

function detectViolations(vals, mean, std) {
  const n = vals.length, flags = vals.map(() => [])
  const z = vals.map(v => std > 0 ? (v - mean) / std : 0)
  for (let i = 0; i < n; i++) if (Math.abs(z[i]) > 3) flags[i].push('1-3s')
  for (let i = 1; i < n; i++) {
    if (z[i] > 2 && z[i - 1] > 2) { flags[i].push('2-2s'); flags[i - 1].push('2-2s') }
    if (z[i] < -2 && z[i - 1] < -2) { flags[i].push('2-2s'); flags[i - 1].push('2-2s') }
  }
  for (let i = 3; i < n; i++) {
    if (z[i] > 1 && z[i - 1] > 1 && z[i - 2] > 1 && z[i - 3] > 1) for (let k = i - 3; k <= i; k++) flags[k].push('4-1s')
    if (z[i] < -1 && z[i - 1] < -1 && z[i - 2] < -1 && z[i - 3] < -1) for (let k = i - 3; k <= i; k++) flags[k].push('4-1s')
  }
  for (let i = 8; i < n; i++) { const seg = z.slice(i - 8, i + 1); if (seg.every(v => v > 0) || seg.every(v => v < 0)) for (let k = i - 8; k <= i; k++) flags[k].push('9-x') }
  for (let i = 5; i < n; i++) { let inc = true, dec = true; for (let k = i - 5; k < i; k++) { if (!(vals[k + 1] > vals[k])) inc = false; if (!(vals[k + 1] < vals[k])) dec = false } if (inc || dec) for (let k = i - 5; k <= i; k++) flags[k].push('tendance') }
  return flags.map(f => [...new Set(f)])
}

const controlData = computed(() => {
  const p = paramSelObj.value; if (!p || p.type === 'bool') return null
  const ms = mesuresParam(p); if (ms.length < 2) return null
  const vals = ms.map(m => Number(m.valeur)); const st = stats(vals); const mean = st.mean, std = st.std
  const ucl = mean + 3 * std, lcl = mean - 3 * std
  const viol = detectViolations(vals, mean, std)
  const allY = [...vals, ucl, lcl]; let ymin = Math.min(...allY), ymax = Math.max(...allY); if (ymin === ymax) { ymin -= 1; ymax += 1 }
  const pd = (ymax - ymin) * 0.1; ymin -= pd; ymax += pd
  const W = 760, H = 280, mL = 52, mR = 54, mT = 16, mB = 62; const step = Math.max(1, Math.ceil(ms.length / 22))
  const xx = (i) => mL + (ms.length === 1 ? (W - mL - mR) / 2 : i * (W - mL - mR) / (ms.length - 1))
  const yy = (v) => mT + (ymax - v) / (ymax - ymin) * (H - mT - mB)
  const pts = ms.map((m, i) => ({ x: xx(i), y: yy(Number(m.valeur)), v: Number(m.valeur), lot: m.numero_lot || '', viol: viol[i] }))
  const path = pts.map((pt, i) => (i ? 'L' : 'M') + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1)).join(' ')
  const alertes = []
  pts.forEach(pt => { if (pt.viol.length) alertes.push({ lot: pt.lot || '(lot ?)', v: pt.v, rules: pt.viol }) })
  return { W, H, mL, mR, mT, mB, step, xs: pts.map(p => p.x), pts, path, mean, std, ymin, ymax, alertes,
    yCl: yy(mean), yUcl: yy(ucl), yLcl: yy(lcl), y2u: yy(mean + 2 * std), y2l: yy(mean - 2 * std), y1u: yy(mean + std), y1l: yy(mean - std) }
})

const horsSpecListe = computed(() => {
  const out = []
  for (const m of mesuresPlat.value) {
    const p = paramById.value[m.parametre_id]; if (!p) continue
    if (!estHors(m)) continue
    const bool = p.type === 'bool'
    out.push({ lot: m.numero_lot || '—', phase: p.phase, nom: p.nom, unite: bool ? '' : uniteEff(p), valeur: bool ? (Number(m.valeur) > 0 ? 'ON' : 'OFF') : m.valeur, lsl: effMin(p), usl: effMax(p), bool, attendu: p.etat_attendu, date: m.date_mesure })
  }
  return out.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
})

function exporterPDF() {
  const pr = produits.value.find(x => String(x.id) === produitSel.value)
  const prNom = pr ? (pr.code_pf + ' — ' + pr.designation) : ''
  const periode = (dateDu.value || dateAu.value) ? ((dateDu.value || '…') + ' → ' + (dateAu.value || '…')) : 'toutes les mesures'
  const now = new Date().toLocaleString('fr-FR')
  let synthHtml = ''
  for (const ph of phasesAvecMesures.value) {
    synthHtml += `<tr class="ph"><td colspan="8">${ph}</td></tr>`
    for (const r of syntheseDe(ph)) synthHtml += `<tr><td>${r.nom}${r.unite ? ' (' + r.unite + ')' : ''}</td><td class="r">${r.n}</td><td class="r">${r.mean.toFixed(2)}</td><td class="r">${r.std.toFixed(3)}</td><td class="r">${limTxt(r.lsl, r.usl)}</td><td class="r">${r.conf.toFixed(0)}%</td><td class="r">${r.cpk != null ? r.cpk.toFixed(2) : '—'}</td><td>${verdictTxt(r.cpk)}</td></tr>`
  }
  let horsHtml = horsSpecListe.value.length
    ? horsSpecListe.value.map(h => `<tr><td>${h.lot}</td><td>${h.phase}</td><td>${h.nom}</td><td class="r">${h.valeur} ${h.unite}</td><td class="r">${limTxt(h.lsl, h.usl)}</td><td>${h.date || '—'}</td></tr>`).join('')
    : '<tr><td colspan="6" style="text-align:center;color:#16a34a">Aucun lot hors spec</td></tr>'
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Revue PQR — ${prNom}</title>
<style>
*{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1b2733;margin:28px;font-size:12px}
h1{font-size:20px;margin:0 0 2px;color:#6b21a8} .sub{color:#64748b;font-size:12px;margin:0 0 16px}
.meta{display:flex;gap:24px;flex-wrap:wrap;font-size:11px;color:#475569;border-top:2px solid #a855f7;border-bottom:1px solid #e2e8f0;padding:8px 0;margin-bottom:16px}
.meta b{color:#0f172a}
.kpis{display:flex;gap:10px;margin:0 0 18px} .k{flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:8px;text-align:center}
.k .v{font-size:18px;font-weight:800} .k .l{font-size:10px;text-transform:uppercase;color:#94a3b8;font-weight:700}
h2{font-size:13px;margin:18px 0 6px;border-left:4px solid #a855f7;padding-left:8px}
table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:10px}
th{text-align:left;background:#faf5ff;color:#6b21a8;padding:5px 7px;border-bottom:1px solid #e9d5ff;font-size:10px;text-transform:uppercase}
th.r,td.r{text-align:right} td{padding:4px 7px;border-bottom:1px solid #f1f5f9}
tr.ph td{background:#f8fafc;font-weight:800;color:#a855f7;text-transform:uppercase;font-size:10px}
.foot{margin-top:22px;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px}
@media print{body{margin:14mm}}
</style></head><body>
<h1>Revue Produit Qualité — PQR</h1><p class="sub">${prNom}</p>
<div class="meta"><span>Période : <b>${periode}</b></span><span>Mesures : <b>${mesuresPlat.value.length}</b></span><span>Lots : <b>${nbLots.value}</b></span><span>Édité le <b>${now}</b></span></div>
<div class="kpis"><div class="k"><div class="v">${mesuresPlat.value.length}</div><div class="l">Mesures</div></div><div class="k"><div class="v">${nbLots.value}</div><div class="l">Lots</div></div><div class="k"><div class="v">${tauxGlobal.value.toFixed(1)}%</div><div class="l">Conformité</div></div><div class="k"><div class="v">${nbHors.value}</div><div class="l">Hors spec</div></div></div>
<h2>Synthèse par paramètre</h2>
<table><thead><tr><th>Paramètre</th><th class="r">n</th><th class="r">Moyenne</th><th class="r">σ</th><th class="r">Limites</th><th class="r">Conf.</th><th class="r">Cpk</th><th>Capabilité</th></tr></thead><tbody>${synthHtml}</tbody></table>
<h2>Lots hors spec</h2>
<table><thead><tr><th>Lot</th><th>Phase</th><th>Paramètre</th><th class="r">Valeur</th><th class="r">Limites</th><th>Date</th></tr></thead><tbody>${horsHtml}</tbody></table>
<div class="foot">Document généré par ProdTrack — Module PQR. Cpk ≥ 1,33 : capable · 1,00–1,33 : acceptable · &lt; 1,00 : insuffisant.</div>
</body></html>`
  const w = window.open('', '_blank')
  if (!w) { erreur.value = 'Autorise les pop-ups pour exporter la revue en PDF.'; return }
  w.document.write(html); w.document.close(); w.focus()
  setTimeout(() => { try { w.print() } catch (e) {} }, 350)
}

function exporterAnalysePDF() {
  const d = corrData.value
  const pr = produits.value.find(x => String(x.id) === produitSel.value)
  const prNom = pr ? (pr.code_pf + ' — ' + pr.designation) : ''
  const now = new Date().toLocaleString('fr-FR')
  const nx = corrXnom.value, ny = corrYnom.value
  let scatterSvg = ''
  if (d && !d.insuffisant) {
    const ptsSvg = d.pts.map(pt => `<circle cx="${pt.cx}" cy="${pt.cy}" r="4" fill="#4f46e5" />`).join('')
    scatterSvg = `<svg viewBox="0 0 ${d.W} ${d.H}" width="100%" style="max-width:560px;border:1px solid #e2e8f0;border-radius:8px;margin-top:6px">
      <line x1="${d.mL}" y1="${d.mT}" x2="${d.mL}" y2="${d.H - d.mB}" stroke="#94a3b8" stroke-width="1"/>
      <line x1="${d.mL}" y1="${d.H - d.mB}" x2="${d.W - d.mR}" y2="${d.H - d.mB}" stroke="#94a3b8" stroke-width="1"/>
      <line x1="${d.line.x1}" y1="${d.line.y1}" x2="${d.line.x2}" y2="${d.line.y2}" stroke="#4f46e5" stroke-width="2" stroke-dasharray="6 4"/>
      ${ptsSvg}
      <text x="${d.W - d.mR - 6}" y="${d.mT + 14}" font-size="12" fill="#4f46e5" font-weight="700" text-anchor="end">${corrEq.value}</text>
      <text x="${d.mL - 6}" y="${d.mT + 5}" font-size="10" fill="#64748b" text-anchor="end">${d.ymax.toFixed(1)}</text>
      <text x="${d.mL - 6}" y="${d.H - d.mB + 4}" font-size="10" fill="#64748b" text-anchor="end">${d.ymin.toFixed(1)}</text>
      <text x="${d.mL}" y="${d.H - d.mB + 16}" font-size="10" fill="#64748b">${d.xmin.toFixed(1)}</text>
      <text x="${d.W - d.mR}" y="${d.H - d.mB + 16}" font-size="10" fill="#64748b" text-anchor="end">${d.xmax.toFixed(1)}</text>
      <text x="${(d.mL + d.W - d.mR) / 2}" y="${d.H - 6}" font-size="11" fill="#475569" font-weight="700" text-anchor="middle">${nx}</text>
    </svg>`
  }
  let matHtml = ''
  const mc = matriceCorr.value
  if (mc) {
    const head = mc.params.map((p, j) => `<th title="${p.nom}">${j + 1}</th>`).join('')
    const rows = mc.cells.map((row, i) => {
      const tds = row.map(c => {
        const bg = corrBg(c.r, c.self), fg = corrFg(c.r, c.self)
        const txt = c.self ? '1' : (c.r != null ? c.r.toFixed(2) : '·')
        return `<td style="background:${bg};color:${fg};text-align:center">${txt}</td>`
      }).join('')
      return `<tr><th style="text-align:left;white-space:nowrap">${i + 1}. ${mc.params[i].nom}</th>${tds}</tr>`
    }).join('')
    const leg = mc.params.map((p, j) => `${j + 1} = ${p.nom}`).join(' · ')
    matHtml = `<h2>Matrice de corrélation</h2>
      <table class="mat"><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table>
      <p class="note">${leg}</p>
      <p class="note">Bleu = corrélation positive · Rouge = négative · intensité = force (|r|). « · » : moins de 3 lots communs.</p>`
  }
  const statBlock = (d && !d.insuffisant)
    ? `<div class="kpis"><div class="k"><div class="v">${d.r.toFixed(3)}</div><div class="l">Corrélation r</div></div><div class="k"><div class="v">${(d.r2 * 100).toFixed(0)}%</div><div class="l">Variance R²</div></div><div class="k"><div class="v">${d.n}</div><div class="l">Lots comparés</div></div></div>
       <p class="eq">Droite de régression : <b>${corrEq.value}</b></p>
       <p class="verdict">${corrTexte.value}</p>
       ${scatterSvg}`
    : `<p class="note">Sélectionne deux paramètres ayant au moins 3 lots communs pour l'analyse détaillée (le tableau ci-dessous reste disponible).</p>`
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Analyse d'impact PQR</title>
<style>
*{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1b2733;margin:28px;font-size:12px}
h1{font-size:19px;margin:0 0 2px;color:#6b21a8} .sub{color:#64748b;font-size:12px;margin:0 0 14px}
.meta{display:flex;gap:22px;flex-wrap:wrap;font-size:11px;color:#475569;border-top:2px solid #a855f7;border-bottom:1px solid #e2e8f0;padding:8px 0;margin-bottom:14px} .meta b{color:#0f172a}
h2{font-size:13px;margin:18px 0 6px;border-left:4px solid #a855f7;padding-left:8px}
.kpis{display:flex;gap:10px;margin:0 0 10px} .k{flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:8px;text-align:center}
.k .v{font-size:18px;font-weight:800;color:#4f46e5} .k .l{font-size:10px;text-transform:uppercase;color:#94a3b8;font-weight:700}
.eq{font-size:13px;margin:4px 0} .verdict{font-size:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:9px 11px;line-height:1.45;margin:6px 0 12px}
table.mat{border-collapse:collapse;font-size:10px;margin-top:4px}
table.mat th{background:#faf5ff;color:#6b21a8;padding:3px 6px;border:1px solid #e9d5ff;font-weight:700}
table.mat td{padding:3px 7px;border:1px solid #fff;font-weight:600}
.note{font-size:10px;color:#94a3b8;margin-top:6px}
.foot{margin-top:20px;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px}
@media print{body{margin:12mm}}
</style></head><body>
<h1>Analyse d'impact entre paramètres — PQR</h1><p class="sub">${prNom}</p>
<div class="meta"><span>Paramètres : <b>${nx || '—'}</b> vs <b>${ny || '—'}</b></span><span>Édité le <b>${now}</b></span></div>
<h2>Relation ${nx || 'X'} → ${ny || 'Y'}</h2>
${statBlock}
${matHtml}
<div class="foot">Document généré par ProdTrack — Module PQR. Une corrélation statistique n'implique pas nécessairement une relation de cause à effet.</div>
</body></html>`
  const w = window.open('', '_blank')
  if (!w) { erreur.value = "Autorise les pop-ups pour exporter l'analyse en PDF."; return }
  w.document.write(html); w.document.close(); w.focus()
  setTimeout(() => { try { w.print() } catch (e) {} }, 350)
}
</script>

<style scoped>
.pqr-page { color: #1b2733; zoom: 0.85; }
.syn-layout { display: flex; gap: 16px; align-items: flex-start; }
.syn-side { flex: 0 0 180px; display: flex; flex-direction: column; gap: 4px; position: sticky; top: 12px; }
.syn-side button { text-align: left; border: 1px solid #e2e8f0; background: #fff; padding: 8px 12px; border-radius: 8px; font: inherit; font-size: 12.5px; font-weight: 600; color: #475569; cursor: pointer; transition: background .12s, border-color .12s; }
.syn-side button:hover { background: #faf5ff; border-color: #e9d5ff; }
.syn-side button.on { background: #a855f7; border-color: #a855f7; color: #fff; }
.syn-main { flex: 1; min-width: 0; }
@media (max-width: 720px) { .syn-layout { flex-direction: column; } .syn-side { flex: none; width: 100%; flex-direction: row; flex-wrap: wrap; position: static; } .syn-side button { flex: 1 1 auto; } }
.alert { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 10px 14px; border-radius: 8px; margin: 0 0 14px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 22px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.empty-card { background: #fff; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 24px; color: #475569; text-align: center; font-size: 14px; }
.empty-sm { color: #64748b; font-size: 13px; padding: 10px 2px; }
.btn { background: #0f766e; color: #fff; border: 0; padding: 9px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
.btn.ghost { background: #fff; color: #475569; border: 1px solid #cbd5e1; }
.btn.sm { padding: 7px 12px; font-size: 13px; }

.pqr-bar { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; align-items: flex-end; }
.pqr-bar .f { display: flex; flex-direction: column; gap: 4px; }
.pqr-bar .f.grow { flex: 1; min-width: 240px; }
.pqr-bar label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; }
.pqr-bar select, .pqr-bar input { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; color: #1b2733; }
.pqr-bar .prod-search { min-width: 170px; }
.pqr-bar .prod-search:focus { outline: none; border-color: #a855f7; box-shadow: 0 0 0 3px rgba(168,85,247,.15); }
.pqr-bar label .cnt { color: #a855f7; font-weight: 700; }
.pqr-bar .f.grow select { width: 100%; }

.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
.kpi { background: #f8fafc; border: 1px solid #eef2f6; border-radius: 12px; padding: 14px; text-align: center; }
.kpi .kv { font-size: 24px; font-weight: 800; color: #0f172a; font-variant-numeric: tabular-nums; }
.kpi .kl { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #94a3b8; font-weight: 700; margin-top: 2px; }
.kpi.good .kv { color: #16a34a; } .kpi.warn .kv { color: #d97706; } .kpi.bad .kv { color: #dc2626; }

.cap-wrap { background: #f8fafc; border: 1px solid #eef2f6; border-radius: 12px; padding: 14px 16px; margin-bottom: 20px; }
.cap-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.cap-titre { margin: 0; font-size: 15px; font-weight: 800; color: #0f172a; border-left: 4px solid #a855f7; padding-left: 9px; }
.cap-sub { font-size: 12px; color: #94a3b8; font-weight: 600; }
.cap-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 14px; }
.cap-card { background: #fff; border: 1px solid #eef2f6; border-radius: 10px; padding: 12px 14px; text-align: center; }
.cap-v { font-size: 26px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1.1; }
.cap-l { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #94a3b8; font-weight: 700; margin-top: 3px; }
.cap-badge { display: inline-block; margin-top: 7px; font-size: 11px; font-weight: 800; color: #fff; padding: 1px 11px; border-radius: 999px; }
.cap-note { font-size: 12px; color: #475569; font-weight: 600; margin-top: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cap-bar { display: flex; height: 22px; border-radius: 8px; overflow: hidden; background: #eef2f6; }
.cap-seg { height: 100%; }
.cap-leg { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-top: 10px; }
.cap-lg { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #475569; font-weight: 600; }
.cap-lg i { width: 11px; height: 11px; border-radius: 3px; flex: none; }
.cap-lg b { color: #0f172a; }
.cap-lh { color: #94a3b8; font-weight: 600; font-size: 11px; }
.cap-donut { width: 86px; height: 86px; display: block; margin: 0 auto 3px; }
.cap-donut .cd-bg { fill: none; stroke: #eef2f6; stroke-width: 5; }
.cap-donut .cd-seg { fill: none; stroke-width: 5; stroke-linecap: round; }
.cap-donut .cd-val { font-size: 10px; font-weight: 800; text-anchor: middle; font-variant-numeric: tabular-nums; }
.bell-area { opacity: .16; }
.bell-line { fill: none; stroke: #0f172a; stroke-width: 2; }
.bell-mean { stroke: #2563eb; stroke-width: 1.5; }
.bell-spec { stroke: #dc2626; stroke-width: 1.5; stroke-dasharray: 4 3; }
.bell-cible { stroke: #16a34a; stroke-width: 1.5; stroke-dasharray: 2 3; }
.bell-lbl { font-size: 10px; font-weight: 800; text-anchor: middle; }
.bell-lbl.spec { fill: #dc2626; }
.bell-lbl.mean { fill: #2563eb; }
.bell-lbl.cible { fill: #16a34a; }
.cap-readrow { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; margin-top: 8px; padding: 9px 2px 2px; border-top: 1px solid #eef2f6; }
.crr { font-size: 12px; color: #64748b; font-weight: 600; }
.crr b { font-size: 16px; color: #0f172a; font-variant-numeric: tabular-nums; margin-right: 3px; }
@media (max-width: 640px) { .kpis { grid-template-columns: repeat(2, 1fr); } }

.sec-titre { margin: 22px 0 6px; font-size: 15px; font-weight: 800; color: #0f172a; border-left: 4px solid #a855f7; padding-left: 9px; }
.hint { font-size: 12px; color: #64748b; margin: 0 0 10px; }
.hint.rules { margin-top: 8px; background: #f8fafc; border: 1px solid #eef2f6; border-radius: 8px; padding: 7px 10px; }
.pqr-phase { margin-top: 14px; }
.pqr-phase-titre { margin: 0 0 5px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: #a855f7; }
.pqr-tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.pqr-tbl th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; font-weight: 700; padding: 6px 9px; border-bottom: 2px solid #eef2f6; }
.pqr-tbl th.r { text-align: right; }
.pqr-tbl td { padding: 7px 9px; border-bottom: 1px solid #f1f5f9; }
.pqr-tbl td.r { text-align: right; font-variant-numeric: tabular-nums; }
.pqr-tbl td.nom { font-weight: 700; color: #0f172a; }
.pqr-tbl td.nom .u { font-weight: 500; color: #94a3b8; font-size: 11px; }
.tag-bool { font-size: 9px; font-weight: 800; background: #ecfeff; color: #0891b2; padding: 1px 6px; border-radius: 999px; }
.pqr-tbl td.lim { color: #64748b; }
.pqr-tbl td.cpk { font-weight: 800; color: #0f172a; }
.pqr-tbl tbody tr { cursor: pointer; }
.pqr-tbl tbody tr:hover { background: #faf5ff; }
.pqr-tbl tbody tr.sel { background: #f3e8ff; }
.pqr-tbl .etape-row td { background: #f1f5f9; font-weight: 800; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; padding: 5px 10px; cursor: default; }
.pqr-tbl tr.row-ko { background: #fef2f2; cursor: default; }
.pqr-tbl td.val-ko { color: #b91c1c; font-weight: 800; }
.hors-wrap { max-height: 240px; overflow: auto; border: 1px solid #f1f5f9; border-radius: 10px; }
.hors-wrap .hors-tbl thead th { position: sticky; top: 0; z-index: 1; background: #fff; }
.hors-head { cursor: pointer; user-select: none; display: flex; align-items: center; gap: 7px; }
.hors-head:hover { color: #a855f7; }
.hors-chev { color: #94a3b8; font-size: 12px; font-weight: 700; }
.c-ok { color: #16a34a; font-weight: 700; } .c-ko { color: #dc2626; font-weight: 700; }
.verdict { font-size: 11px; font-weight: 800; padding: 2px 9px; border-radius: 999px; white-space: nowrap; }
.verdict.v-ok { background: #dcfce7; color: #166534; } .verdict.v-mid { background: #fef3c7; color: #92400e; } .verdict.v-ko { background: #fee2e2; color: #b91c1c; } .verdict.v-na { background: #f1f5f9; color: #94a3b8; }

.chart-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
.chart-head .sec-titre { margin: 0; }
.tabs { display: inline-flex; background: #f1f5f9; border-radius: 10px; padding: 3px; }
.tabs button { border: 0; background: transparent; padding: 6px 13px; border-radius: 8px; font: inherit; font-size: 12px; font-weight: 700; color: #64748b; cursor: pointer; }
.tabs button.on { background: #fff; color: #a855f7; box-shadow: 0 1px 2px rgba(16,24,40,.08); }

.chart-wrap { margin-top: 10px; }
.corr-ctrls { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; margin: 8px 0 12px; }
.corr-ctrls label { display: flex; flex-direction: column; gap: 3px; font-size: 12px; font-weight: 600; color: #475569; }
.corr-ctrls select { padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 7px; font-size: 13px; min-width: 210px; }
.corr-vs { align-self: center; font-weight: 700; color: #94a3b8; padding-bottom: 7px; }
.corr-cards { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 6px; }
.corr-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 9px; padding: 8px 18px; text-align: center; min-width: 118px; }
.cc-v { font-size: 20px; font-weight: 800; color: #4f46e5; }
.cc-l { font-size: 11px; color: #64748b; margin-top: 2px; }
.corr-verdict { font-size: 13px; padding: 9px 12px; border-radius: 8px; margin: 4px 0 10px; line-height: 1.45; }
.cv-weak { background: #f1f5f9; color: #475569; }
.cv-mod { background: #fef3c7; color: #92400e; }
.cv-strong { background: #dbeafe; color: #1e40af; }
.l-reg { stroke: #4f46e5; stroke-width: 2; stroke-dasharray: 6 4; fill: none; }
.leg .l-rg { display: inline-block; width: 16px; height: 2px; background: repeating-linear-gradient(90deg, #4f46e5 0 5px, transparent 5px 9px); vertical-align: middle; }
.ax-lbl { font-size: 11px; fill: #475569; font-weight: 700; }
.eq-lbl { font-size: 12px; fill: #4f46e5; font-weight: 700; }
.corr-actions { margin: 10px 0 2px; }
.mat-block { margin-top: 16px; }
.mat-toggle { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 7px 12px; font-size: 13px; font-weight: 700; color: #334155; cursor: pointer; }
.mat-toggle:hover { background: #e2e8f0; }
.mat-wrap { margin-top: 8px; }
.mat-scroll { overflow-x: auto; }
.mat-tbl { border-collapse: collapse; font-size: 11px; }
.mat-tbl th { background: #faf5ff; color: #6b21a8; padding: 4px 8px; border: 1px solid #e9d5ff; font-weight: 700; white-space: nowrap; }
.mat-tbl .mat-rh { text-align: left; position: sticky; left: 0; z-index: 1; }
.mat-tbl .mat-h { text-align: center; min-width: 34px; }
.mat-tbl .mat-corner { position: sticky; left: 0; z-index: 2; }
.mat-tbl .mat-c { text-align: center; padding: 5px 8px; border: 1px solid #fff; font-weight: 700; cursor: pointer; min-width: 34px; }
.mat-tbl .mat-c:hover { outline: 2px solid #4f46e5; outline-offset: -2px; }
.trend { width: 100%; height: auto; background: #fcfcfd; border: 1px solid #eef2f6; border-radius: 12px; }
.trend .axis { stroke: #cbd5e1; stroke-width: 1; }
.trend .l-spec { stroke: #f87171; stroke-width: 1.5; stroke-dasharray: 5 4; }
.trend .l-cible { stroke: #a855f7; stroke-width: 1.5; stroke-dasharray: 2 4; }
.trend .l-ucl { stroke: #ef4444; stroke-width: 1.5; stroke-dasharray: 6 4; }
.trend .l-sig { stroke: #f59e0b; stroke-width: 1; stroke-dasharray: 3 4; }
.trend .l-sig1 { stroke: #cbd5e1; stroke-width: 1; stroke-dasharray: 2 4; }
.trend .l-cl { stroke: #16a34a; stroke-width: 1.5; }
.trend .l-data { fill: none; stroke: #0ea5e9; stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
.trend .pt-ok { fill: #0ea5e9; stroke: #fff; stroke-width: 1.5; }
.trend .pt-ko { fill: #dc2626; stroke: #fff; stroke-width: 1.5; }
.trend .pt-ring { fill: none; stroke: #dc2626; stroke-width: 1.5; opacity: .5; }
.trend .ax { fill: #94a3b8; font-size: 11px; text-anchor: end; font-weight: 600; }
.trend .lot-lbl { fill: #94a3b8; font-size: 9px; text-anchor: end; font-weight: 600; }
.trend .lbl-spec { fill: #ef4444; font-size: 10px; text-anchor: end; font-weight: 700; }
.trend .lbl-ucl { fill: #ef4444; font-size: 10px; text-anchor: end; font-weight: 700; }
.trend .lbl-cl { fill: #16a34a; font-size: 10px; text-anchor: end; font-weight: 700; }
.leg { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 8px; padding-left: 4px; }
.leg .lg { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: #64748b; font-weight: 600; }
.leg i { width: 14px; height: 3px; border-radius: 2px; display: inline-block; }
.leg .d-ok, .leg .d-ko { width: 10px; height: 10px; border-radius: 50%; }
.leg .d-ok { background: #0ea5e9; } .leg .d-ko { background: #dc2626; }
.leg .l-c { background: #a855f7; } .leg .l-s { background: #f87171; } .leg .l-clg { background: #16a34a; } .leg .l-ug { background: #ef4444; }
.trend .l-multi { fill: none; stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
.multi-leg { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-top: 10px; padding-left: 4px; }
.multi-leg .ml-item { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #334155; font-weight: 600; }
.multi-leg .ml-dot { width: 11px; height: 11px; border-radius: 50%; display: inline-block; flex: none; }
.multi-leg .ml-rg { color: #94a3b8; font-weight: 500; font-size: 11px; font-variant-numeric: tabular-nums; }
.pqr-tbl th.cmp-th, .pqr-tbl td.cmp-td { text-align: center; width: 30px; padding-left: 4px; padding-right: 4px; }
.pqr-tbl td.cmp-td input { cursor: pointer; margin: 0; }
.pqr-tbl tbody tr.cmp { background: #eef2ff; }
.pqr-tbl tbody tr.cmp.sel { background: #e0e7ff; }
.trend { cursor: crosshair; }
.trend .cur-line { stroke: #0f172a; stroke-width: 1; stroke-dasharray: 3 3; opacity: .5; pointer-events: none; }
.trend .cur-dot { fill: #fff; stroke: #0f172a; stroke-width: 2; pointer-events: none; }
.cur-readout { margin-top: 8px; padding: 7px 11px; background: #0f172a; color: #fff; border-radius: 8px; font-size: 12px; font-weight: 700; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; }
.cur-readout b { color: #fff; }
.cur-readout .cur-viol { color: #fca5a5; font-weight: 700; }
.cur-readout .cr-it { display: inline-flex; align-items: center; gap: 5px; font-weight: 600; color: #e2e8f0; }
.cur-readout .cr-dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; flex: none; }
.zone-ctrl { margin: 12px 0 2px; padding: 10px 12px; background: #f8fafc; border: 1px solid #eef2f6; border-radius: 10px; }
.zone-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
.zone-ttl { font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: .04em; }
.zone-info { font-size: 12px; color: #64748b; font-weight: 700; font-variant-numeric: tabular-nums; }
.zone-reset { margin-left: auto; background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; border-radius: 7px; padding: 3px 10px; font: inherit; font-size: 11px; font-weight: 700; cursor: pointer; }
.zone-reset:hover { background: #e0e7ff; }
.zone-row { display: flex; align-items: center; gap: 10px; }
.zone-row .zone-slider { flex: 1; }
.zone-step { flex: none; width: 28px; height: 28px; border-radius: 8px; border: 1px solid #c7d2fe; background: #eef2ff; color: #4338ca; font-size: 18px; font-weight: 700; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.zone-step:hover:not(:disabled) { background: #e0e7ff; }
.zone-step:disabled { opacity: .4; cursor: default; }
.zone-slider { position: relative; height: 24px; }
.zone-slider .zs-track { position: absolute; left: 0; right: 0; top: 10px; height: 4px; background: #e2e8f0; border-radius: 3px; }
.zone-slider .zs-sel { position: absolute; top: 10px; height: 4px; background: #6366f1; border-radius: 3px; }
.zone-slider .zs-input { position: absolute; left: 0; top: 0; width: 100%; height: 24px; margin: 0; background: none; -webkit-appearance: none; appearance: none; pointer-events: none; }
.zone-slider .zs-input:focus { outline: none; }
.zone-slider .zs-input::-webkit-slider-runnable-track { background: none; border: none; }
.zone-slider .zs-input::-moz-range-track { background: none; border: none; }
.zone-slider .zs-input::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #fff; border: 2px solid #6366f1; box-shadow: 0 1px 3px rgba(15,23,42,.25); cursor: pointer; pointer-events: auto; margin-top: -6px; }
.zone-slider .zs-input::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: #fff; border: 2px solid #6366f1; box-shadow: 0 1px 3px rgba(15,23,42,.25); cursor: pointer; pointer-events: auto; }

.viol-box { margin-top: 10px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 10px 13px; }
.viol-titre { font-size: 12px; font-weight: 800; color: #b91c1c; margin-bottom: 5px; }
.viol-row { font-size: 12px; color: #7f1d1d; padding: 2px 0; }
.viol-ok { margin-top: 10px; background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; border-radius: 10px; padding: 9px 13px; font-size: 13px; font-weight: 600; }
</style>
