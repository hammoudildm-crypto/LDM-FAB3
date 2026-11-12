<template>
  <div class="ordo">
    <div class="ordo-head">
      <div>
        <div class="oh-eyebrow">Planification atelier</div>
        <h1 class="oh-title">Ordonnancement — simulateur</h1>
        <p class="oh-sub">Ordonnancement par priorité : chaque lot enchaîne sa gamme jusqu'au conditionnement ; dates de début et fin de fabrication calculées.</p>
      </div>
    </div>

    <!-- Paramètres -->
    <section class="card">
      <div class="add-grid">
        <div class="add-field">
          <label>Date de départ</label>
          <input type="date" v-model="dateDepart" />
        </div>
        <div class="add-field">
          <label>Régime</label>
          <select v-model.number="hpj">
            <option :value="8">1×8 (8 h/j)</option>
            <option :value="16">2×8 (16 h/j)</option>
            <option :value="24">3×8 (24 h/j)</option>
          </select>
        </div>
        <div class="add-field chk-wk">
          <label>Week-end</label>
          <label class="wk"><input type="checkbox" v-model="skipWeekend" /> Ne pas travailler le week-end</label>
        </div>
        <div class="add-field">
          <label>Optimisation</label>
          <select v-model="prioMode">
            <option value="echeance">Échéance la plus proche (EDD)</option>
            <option value="valeur">Valeur au plus tôt</option>
            <option value="ca">CA total décroissant</option>
            <option value="manuelle">Priorités manuelles</option>
          </select>
        </div>
        <div class="add-field chk-wk">
          <label>Conditionnement</label>
          <label class="wk"><input type="checkbox" v-model="optimisationCond" /> Alimentation continue du conditionnement (éviter les ruptures)</label>
        </div>
        <div class="add-field chk-wk">
          <label>Périmètre</label>
          <label class="wk"><input type="checkbox" v-model="condSeul" /> Conditionnement uniquement (vrac déjà fabriqué)</label>
        </div>
        <div class="add-field" v-if="condSeul && optimisationCond">
          <label>Occupation ↔ Campagnes</label>
          <input type="range" min="0" max="1" step="0.1" v-model.number="preferCampagne" class="slider-pc" />
          <div class="slider-lbl">{{ preferCampagne < 0.34 ? 'Occupation max' : preferCampagne > 0.66 ? 'Campagnes (moins de nettoyages)' : 'Équilibré' }}</div>
        </div>
      </div>
    </section>

    <!-- Ajout de produits -->
    <section class="card">
      <div class="add-grid">
        <div class="add-field grow">
          <label>Produit</label>
          <input type="search" v-model="rechercheProduit" class="prod-search" placeholder="Filtrer par code ou désignation…" />
          <select v-model="selProduit">
            <option value="">— Choisir un produit ({{ produitsAffiches.length }}) —</option>
            <option v-for="p in produitsAffiches" :key="p.id" :value="p.id">{{ p.code_pf }} · {{ p.designation }}</option>
          </select>
        </div>
        <div class="add-field"><label>Quantité (boîtes)</label><input type="number" min="1" v-model="selBoites" @keyup.enter="ajouter" /></div>
        <div class="add-field"><label>Lots (auto)</label><div class="lots-auto">{{ lotsAuto || '—' }}<span v-if="tailleLotSel" class="tl-hint">taille lot {{ fmt(tailleLotSel) }}</span></div></div>
        <button class="btn-add" @click="ajouter" :disabled="!selProduit || !(Number(selBoites) > 0)">Ajouter</button>
      </div>
      <div class="add-import" v-if="nbLotsEnCours">
        <button class="btn-import" @click="importerLotsEnCours">↓ Importer {{ condSeul ? 'le vrac prêt à conditionner' : 'les lots en cours' }} ({{ nbLotsEnCours }} lots · {{ nbProduitsImport }} produits)</button>
        <span class="import-hint">depuis « Disponibilité des produits par atelier »</span>
      </div>
      <div class="add-import">
        <button class="btn-import excel" @click="declencherImportPlan">⬆ Importer le plan conditionnement (Excel)</button>
        <span class="import-hint">colonnes « Code », « Taille », « Début est. » → ordonnancement fabrication au lot par échéance</span>
        <input ref="fichierPlan" type="file" accept=".xlsx,.xls,.csv" style="display:none" @change="importerPlanExcel" />
      </div>
      <p v-if="msgImport" class="msg-import">{{ msgImport }}</p>
      <p v-if="chargement" class="muted">Chargement…</p>
      <p v-else-if="selProduit && !gammeProduit(selProduit).length" class="muted warn">Aucune phase cadencée trouvée pour ce produit (gamme ou cadences manquantes).</p>
    </section>

    <!-- Groupes ajoutés -->
    <section v-if="groupes.length" class="card">
      <div class="card-head-row">
        <h2 class="card-title">{{ groupes.length > 60 ? 'Plan importé' : 'Produits' }} — {{ apercuProduits.length }} produit(s) · {{ lotsDeployes.length }} lot(s)</h2>
        <button class="btn-reset" @click="remiseAZero">Remise à zéro</button>
      </div>
      <!-- Vue éditable (peu de lots) -->
      <div v-if="groupes.length <= 60" class="tbl-wrap">
        <table class="grid">
          <thead><tr><th class="ta-c">Prio.</th><th>Produit</th><th class="ta-r">Boîtes (total)</th><th class="ta-r">Lots</th><th>Gamme</th><th class="ta-r">CA</th><th></th></tr></thead>
          <tbody>
            <tr v-for="g in groupesDetail" :key="g.id">
              <td class="ta-c"><span v-if="prioAutoCA" class="prio-auto">{{ g.priorite }}</span><input v-else type="number" min="1" class="prio-inp" :value="g.priorite" @change="setPriorite(g.id, $event.target.value)" /></td>
              <td><span class="lot-dot" :style="{ background: g.couleur }"></span><span v-if="g.numeroLot" class="lot-num">Lot {{ g.numeroLot }}</span> <strong>{{ g.code }}</strong> <span class="lot-desig">{{ g.desig }}</span></td>
              <td class="ta-r">{{ fmt(g.boites) }}</td>
              <td class="ta-r">{{ g.nb }}</td>
              <td class="gamme-cell">{{ g.gammeNoms }}</td>
              <td class="ta-r">{{ fmtDA(g.ca) }}</td>
              <td class="ta-r"><button class="lnk-del" @click="retirer(g.id)">✕</button></td>
            </tr>
          </tbody>
          <tfoot><tr class="tot"><td></td><td>Total</td><td></td><td class="ta-r">{{ lotsDeployes.length }}</td><td></td><td class="ta-r">{{ fmtDA(totalCA) }}</td><td></td></tr></tfoot>
        </table>
      </div>
      <!-- Aperçu agrégé (beaucoup de lots importés) -->
      <div v-else class="tbl-wrap">
        <table class="grid">
          <thead><tr><th>Produit</th><th class="ta-r">Lots</th><th class="ta-r">Boîtes</th><th class="ta-c">1ʳᵉ échéance</th></tr></thead>
          <tbody>
            <tr v-for="a in apercuProduits" :key="a.produitId">
              <td><strong>{{ a.code }}</strong> <span class="lot-desig">{{ a.desig }}</span></td>
              <td class="ta-r">{{ a.nbLots }}</td>
              <td class="ta-r">{{ fmt(a.boites) }}</td>
              <td class="ta-c">{{ a.ech ? fmtDate(new Date(a.ech + 'T00:00:00')) : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Respect des échéances de conditionnement (mode fabrication par échéance) -->
    <section v-if="planning.length && fabSeul" class="card ech-card">
      <div class="card-head-row">
        <h2 class="card-title">⏱ Fabrication par échéance de conditionnement</h2>
        <span class="obj-strat ech-strat">Fab prête avant le début de conditionnement</span>
      </div>
      <div class="obj-kpis">
        <div class="obj-kpi"><div class="ok-v">{{ resultatEcheance.total }}</div><div class="ok-l">Lots planifiés</div></div>
        <div class="obj-kpi"><div class="ok-v" style="color:#047857">{{ resultatEcheance.nTemps }}</div><div class="ok-l">À temps</div></div>
        <div class="obj-kpi" :class="{ 'ok-warn': resultatEcheance.nRetard > 0 }"><div class="ok-v">{{ resultatEcheance.nRetard }}</div><div class="ok-l">En retard</div></div>
        <div class="obj-kpi"><div class="ok-v">{{ resultatEcheance.total ? Math.round(resultatEcheance.nTemps / resultatEcheance.total * 100) : 100 }} %</div><div class="ok-l">Taux à temps</div></div>
      </div>
      <div v-if="resultatEcheance.retards.length" class="ech-retards">
        <div class="ech-rh">Lots en retard ({{ resultatEcheance.nRetard }}) — fabrication finie après le début de conditionnement</div>
        <div class="tbl-wrap">
          <table class="grid">
            <thead><tr><th>Produit / Lot</th><th class="ta-r">Boîtes</th><th class="ta-c">Fin fabrication</th><th class="ta-c">Début cond. (échéance)</th><th class="ta-r">Retard</th></tr></thead>
            <tbody>
              <tr v-for="(r, i) in resultatEcheance.retards.slice(0, 50)" :key="i">
                <td><strong>{{ r.code }}</strong> <span class="lot-desig">{{ r.desig }}</span><span v-if="r.numeroLot" class="lot-num">Lot {{ r.numeroLot }}</span></td>
                <td class="ta-r">{{ fmt(r.boites) }}</td>
                <td class="ta-c">{{ fmtDate(r.fin) }}</td>
                <td class="ta-c">{{ fmtDate(r.echeance) }}</td>
                <td class="ta-r ech-retard">+{{ r.retard }} j</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="resultatEcheance.retards.length > 50" class="muted" style="margin-top:6px">… et {{ resultatEcheance.retards.length - 50 }} autre(s). Avance la date de départ, ajoute une ligne, ou réduis la charge pour résorber les retards.</p>
      </div>
      <p v-else class="ech-ok">✓ Tous les lots sont fabriqués à temps pour leur conditionnement, avec la date de départ et la capacité actuelles.</p>
      <p class="obj-note">Priorité <strong>échéance la plus proche (EDD)</strong> : les lots dont le conditionnement démarre le plus tôt sont fabriqués en premier, selon les <strong>temps de gamme</strong> et la <strong>disponibilité des équipements de fabrication</strong>. Le détail par atelier (entrée/sortie) est ci-dessous.</p>
    </section>

    <!-- Ordonnancement optimal (objectif de livraison) -->
    <section v-if="planning.length && !fabSeul" class="card objectif-card">
      <div class="card-head-row">
        <h2 class="card-title">🎯 Ordonnancement optimal — objectif de livraison</h2>
        <span class="obj-strat">{{ prioMode === 'valeur' ? 'Valeur au plus tôt (CA ÷ durée)' : prioMode === 'ca' ? 'CA total décroissant' : 'Priorités manuelles' }}</span>
      </div>
      <div class="obj-kpis">
        <div class="obj-kpi"><div class="ok-v">{{ fmtDA(objectifResultat.totalCA) }}</div><div class="ok-l">CA total livré</div></div>
        <div class="obj-kpi"><div class="ok-v">{{ fmt(objectifResultat.totalBoites) }}</div><div class="ok-l">Boîtes à livrer</div></div>
        <div class="obj-kpi"><div class="ok-v">{{ fmtDate(objectifResultat.dateFin) }}</div><div class="ok-l">Objectif terminé le</div></div>
        <div class="obj-kpi" v-if="optimisationCond"><div class="ok-v">{{ (tauxAlim * 100).toFixed(0) }} %</div><div class="ok-l">Alimentation cond.</div></div>
        <div class="obj-kpi" v-if="optimisationCond" :class="{ 'ok-warn': condIdle > 0 }"><div class="ok-v">{{ condIdle }} j</div><div class="ok-l">Temps mort cond. (ruptures)</div></div>
      </div>
      <div class="tbl-wrap">
        <table class="grid">
          <thead><tr><th class="ta-c">Ordre</th><th>Produit</th><th class="ta-r">Boîtes</th><th class="ta-r">CA</th><th class="ta-c">Fin cond. · livrable</th><th class="ta-r">CA cumulé</th></tr></thead>
          <tbody>
            <tr v-for="(it, i) in objectifResultat.list" :key="it.gid">
              <td class="ta-c obj-rang">{{ i + 1 }}</td>
              <td><strong>{{ it.code }}</strong> <span class="lot-desig">{{ it.desig }}</span></td>
              <td class="ta-r">{{ fmt(it.boites) }}</td>
              <td class="ta-r">{{ fmtDA(it.ca) }}</td>
              <td class="ta-c obj-date">{{ fmtDate(it.dateLivr) }}</td>
              <td class="ta-r obj-cum">{{ fmtDA(it.cumCA) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="repartitionFab.length" class="obj-rep">
        <div class="obj-rep-h">Répartition de la fabrication sur les ateliers libres</div>
        <div class="tbl-wrap">
          <table class="grid">
            <thead><tr><th>Phase</th><th>Atelier / équipement</th><th class="ta-r">Lots</th><th class="ta-r">Jours occupés</th><th class="ta-r">Part charge</th></tr></thead>
            <tbody>
              <tr v-for="(r, i) in repartitionFab" :key="i">
                <td>{{ r.phase }}</td>
                <td><strong>{{ r.equip }}</strong></td>
                <td class="ta-r">{{ r.lots }}</td>
                <td class="ta-r">{{ r.jours }} j</td>
                <td class="ta-r"><span class="rep-bar"><span :style="{ width: r.pct + '%' }"></span></span>{{ r.pct }} %</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <p class="obj-note">Ordre optimisé pour <strong>livrer la valeur au plus tôt</strong> (CA ÷ durée), dans la limite de la disponibilité des ateliers. <strong>« Fin cond. · livrable »</strong> = date estimée de fin de conditionnement du produit (le vrac devient livrable une fois conditionné). La fabrication est affectée automatiquement à l'<strong>atelier compatible le plus tôt libre</strong> (répartition ci‑dessus) ; « Objectif terminé le » = fin de conditionnement du dernier produit.<span v-if="optimisationCond"> La fabrication est <strong>entrelacée pour alimenter le conditionnement en continu</strong> (stratégie « {{ strategieChoisie }} ») et éviter les ruptures des lignes de conditionnement.</span><span v-if="objectifResultat.sansCond"> ⚠ {{ objectifResultat.sansCond }} produit(s) sans phase de conditionnement planifiée (date = fin de fabrication).</span></p>
    </section>

    <!-- Affectation des équipements (machines identiques) -->
    <section v-if="groupes.length && aDesChoix && groupes.length <= 60" class="card">
      <h2 class="card-title">Affectation des équipements</h2>
      <p class="muted aff-intro">Pour les phases où plusieurs équipements identiques existent, choisis lequel utilise le produit. « Auto » = le simulateur prend le plus tôt disponible.</p>
      <div v-for="g in groupesDetail" :key="g.id" class="aff-prod">
        <div class="aff-nom"><span class="lot-dot" :style="{ background: g.couleur }"></span><strong>{{ g.code }}</strong> <span class="lot-desig">{{ g.desig }}</span></div>
        <div class="aff-phases">
          <template v-for="k in gammeProduit(g.produitId)" :key="k">
            <label v-if="equipsPhase(g.produitId, k).length > 1" class="aff-ph">
              <span class="aff-ph-lbl">{{ PHASE_NOM[k] }}</span>
              <select v-model="choixEquip[g.id + '|' + k]">
                <option value="">Auto (le plus tôt libre)</option>
                <option v-for="e in equipsPhase(g.produitId, k)" :key="e.id" :value="e.id">{{ e.code }}{{ e.nom ? ' · ' + e.nom : '' }}</option>
              </select>
            </label>
          </template>
        </div>
      </div>
    </section>

    <!-- Phases non planifiées -->
    <section v-if="phasesManquantes.length" class="card warn-card">
      <h2 class="card-title">⚠ Phases non planifiées ({{ phasesManquantes.length }})</h2>
      <p class="warn-txt">Ces phases de la gamme n'ont <strong>pas d'équipement avec une cadence</strong> pour le produit → elles sont ignorées dans le planning (c'est pourquoi certaines colonnes manquent). Ajoute la cadence dans le volet <strong>Cadences</strong> pour l'équipement concerné.</p>
      <ul class="manq-list">
        <li v-for="m in phasesManquantes" :key="m.code + m.phase" class="manq-item" @click="allerCadences(m)" title="Ouvrir Cadences pour définir la cadence de ce produit"><strong>{{ m.code }}</strong> <span class="lot-desig">{{ m.desig }}</span> — <span class="manq-ph">{{ m.phase }}</span> <span class="manq-go">→ définir la cadence</span></li>
      </ul>
    </section>

    <!-- Ordonnancement par atelier (entrée → sortie) -->
    <section v-if="planning.length" class="card">
      <div class="card-head-row">
        <h2 class="card-title">Ordonnancement par atelier — {{ fmtDate(fenetreOrdo.debut) }} → {{ fmtDate(fenetreOrdo.fin) }}</h2>
        <div class="plage-sel">
          <button :class="{ on: plageMois === 1 }" @click="plageMois = 1">Mois en cours</button>
          <button :class="{ on: plageMois === 2 }" @click="plageMois = 2">2 mois</button>
          <button :class="{ on: plageMois === 3 }" @click="plageMois = 3">3 mois</button>
        </div>
      </div>
      <p v-if="!ordoParAtelier.length" class="muted">Aucun lot planifié sur cette plage.</p>
      <div v-for="a in ordoParAtelier" :key="a.phase + a.equip" class="ordo-atelier">
        <div class="ordo-at-h" :class="{ 'a-cond': a.cond }"><span class="ordo-ph">{{ a.phase }}</span><strong>{{ a.equip }}</strong><span v-if="a.cond && a.trouTotal > 0" class="ordo-rupt">⚠ {{ a.trouTotal }} j de rupture</span><span v-else-if="a.cond" class="ordo-cont">✓ alimenté en continu</span><span class="ordo-n">{{ a.lots.length }} lot(s)</span></div>
        <div class="tbl-wrap">
          <table class="grid">
            <thead><tr><th>Produit / Lot</th><th class="ta-r">Boîtes</th><th class="ta-c">Date d'entrée</th><th class="ta-c">Date de sortie</th></tr></thead>
            <tbody>
              <tr v-for="(l, i) in a.lots" :key="i">
                <td><span class="lot-dot" :style="{ background: l.couleur }"></span><strong>{{ l.code }}</strong> <span class="lot-desig">{{ l.desig }}</span><span v-if="l.numeroLot" class="lot-num">Lot {{ l.numeroLot }}</span></td>
                <td class="ta-r">{{ fmt(l.boites) }}</td>
                <td class="ta-c ordo-date"><span v-if="l.trou > 0" class="ordo-gap" title="Arrêt avant ce lot (rupture d'alimentation)">⚠ {{ l.trou }} j</span>{{ fmtDate(l.entree) }}</td>
                <td class="ta-c ordo-date">{{ fmtDate(l.sortie) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <button class="ordo-detail-tg" @click="detailOuvert = !detailOuvert">{{ detailOuvert ? '▾ Masquer' : '▸ Afficher' }} le détail (planning complet, Gantt, occupation)</button>
    </section>

    <!-- Planning daté -->
    <section v-if="detailOuvert && planning.length" class="card">
      <h2 class="card-title">Planning — {{ fmtDate(dateIdx(0)) }} → {{ fmtDate(dateIdx(finGlobale)) }}</h2>
      <p v-if="optimisationCond" class="opt-banner">Stratégie : <strong>{{ strategieChoisie }}</strong> — temps mort <strong>{{ condIdle }} j</strong> · <strong>{{ condNettoyages }}</strong> nettoyage(s) (<strong>{{ condJoursNett }} j</strong>) · alimentation <strong>{{ (tauxAlim * 100).toFixed(0) }} %</strong>.</p>
      <div class="tbl-wrap">
        <table class="grid plan">
          <thead>
            <tr>
              <th>N°</th><th class="ta-c">Prio.</th><th>Produit</th><th class="ta-r">Boîtes</th>
              <th colspan="2" class="ph-h sumh">Fabrication</th><th class="ph-h sumh">Cond.</th>
              <th v-for="k in colonnes" :key="k" colspan="2" class="ph-h">{{ PHASE_NOM[k] }}</th>
            </tr>
            <tr class="sub">
              <th></th><th></th><th></th><th></th>
              <th class="dd">Début</th><th class="dd">Fin</th><th class="dd">Fin</th>
              <template v-for="k in colonnes" :key="k"><th class="dd">Début</th><th class="dd">Fin</th></template>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in planning" :key="r.id">
              <td class="num">{{ r.numeroLot || r.num }}</td>
              <td class="ta-c prio-cell">{{ r.prio }}</td>
              <td><span class="lot-dot" :style="{ background: r.couleur }"></span><strong>{{ r.code }}</strong> <span class="lot-desig">{{ r.desig }}</span></td>
              <td class="ta-r">{{ fmt(r.boites) }}</td>
              <td class="dcell sum">{{ r.debutFab != null ? fmtDate(dateIdx(r.debutFab)) : '' }}</td>
              <td class="dcell sum fin">{{ r.finFab != null ? fmtDate(dateIdx(r.finFab)) : '' }}</td>
              <td class="dcell sum fin">{{ r.finCond != null ? fmtDate(dateIdx(r.finCond)) : '' }}</td>
              <template v-for="k in colonnes" :key="k">
                <td class="dcell">{{ r.phases[k] ? fmtDate(dateIdx(r.phases[k].start)) : '' }}</td>
                <td class="dcell fin">{{ r.phases[k] ? fmtDate(dateIdx(r.phases[k].end)) : '' }}</td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="gantt-legend">Les lots sont ordonnancés par priorité — automatique par CA (le plus gros CA servi en premier) ou manuelle. Chaque phase démarre après la précédente du lot ET quand l'équipement se libère. Durée = boîtes ÷ cadence (kg/h en fabrication, boîtes/h en conditionnement), en jours ({{ hpj }} h/j). Le conditionnement occupe ses ateliers selon la gamme.</p>
    </section>

    <!-- Vue Gantt -->
    <section v-if="detailOuvert && planning.length" class="card">
      <h2 class="card-title">Vue Gantt — enchaînement des lots</h2>
      <div class="gantt" :style="gridStyle">
        <div class="g-axis-row">
          <div class="g-lbl-sp"></div>
          <div class="g-axis">
            <div v-for="t in axisTicks" :key="t.d" class="g-tick" :style="{ left: t.left }"><span>{{ t.label }}</span></div>
          </div>
        </div>
        <div v-for="r in planning" :key="r.id" class="g-row">
          <div class="g-lbl" :title="r.code + ' — ' + r.desig"><span class="lot-dot" :style="{ background: r.couleur }"></span><strong>{{ r.numeroLot || r.num }}·{{ r.code }}</strong> <span class="g-desig">{{ r.desig }}</span></div>
          <div class="g-track">
            <div v-for="k in Object.keys(r.phases)" :key="k" class="g-bar" :class="{ cond: k === 'conditionnement' }"
                 :style="{ left: barLeft(r.phases[k]), width: barWidth(r.phases[k]), background: r.couleur }"
                 :title="PHASE_NOM[k] + ' : ' + fmtDate(dateIdx(r.phases[k].start)) + ' → ' + fmtDate(dateIdx(r.phases[k].end))">
              <span class="gb-t">{{ PHASE_NOM[k].slice(0, 4) }}</span>
            </div>
          </div>
        </div>
      </div>
      <p class="gantt-legend">Chaque barre = une phase d'un lot. Le <strong>conditionnement</strong> (barre bordée de noir) démarre dès la fin de la dernière phase de fabrication du <strong>même lot</strong> — il chevauche donc la fabrication des lots suivants. Un lot n'attend que si sa ligne de conditionnement est déjà occupée par un lot précédent (augmente le nombre de machines de la ligne pour paralléliser).</p>
    </section>

    <!-- Occupation des équipements (fabrication + conditionnement) -->
    <section v-if="detailOuvert && occParEquip.length" class="card">
      <h2 class="card-title">Occupation des équipements sur la période</h2>

      <template v-for="grp in [{ t: 'Fabrication', list: occFabrication }, { t: 'Conditionnement', list: occConditionnement }]" :key="grp.t">
        <h3 class="occ-sub" v-if="grp.list.length">{{ grp.t }}</h3>
        <div v-for="a in grp.list" :key="a.equip + a.phase" class="cond-atelier">
          <div class="ca-head">
            <div class="ca-id"><strong>{{ a.equip }}</strong><span class="ca-phase">{{ PHASE_NOM[a.phase] }}</span><span class="ca-mach">{{ a.machines }} machine(s)</span></div>
            <div class="ca-r"><span class="ca-taux" :class="tauxCls(a.taux)">Taux {{ (a.taux * 100).toFixed(0) }} %</span><span class="ca-tot">{{ fmt(a.totalBoites) }} bts · {{ fmt(a.totalJours) }} j · {{ fmtDate(dateIdx(a.debut)) }} → {{ fmtDate(dateIdx(a.fin)) }}</span></div>
          </div>
          <table class="grid">
            <thead><tr><th>Produit</th><th class="ta-r">Boîtes</th><th class="ta-r">Lots</th><th class="ta-r">Jours d'occupation</th></tr></thead>
            <tbody>
              <tr v-for="pr in a.produits" :key="pr.code">
                <td><span class="lot-dot" :style="{ background: pr.couleur }"></span><strong>{{ pr.code }}</strong> <span class="lot-desig">{{ pr.desig }}</span></td>
                <td class="ta-r">{{ fmt(pr.boites) }}</td>
                <td class="ta-r">{{ pr.lots }}</td>
                <td class="ta-r">{{ fmt(pr.jours) }}</td>
              </tr>
            </tbody>
            <tfoot><tr class="tot"><td>Total</td><td class="ta-r">{{ fmt(a.totalBoites) }}</td><td></td><td class="ta-r">{{ fmt(a.totalJours) }}</td></tr></tfoot>
          </table>
        </div>
      </template>

      <p class="gantt-legend">Taux d'occupation = jours occupés ÷ jours disponibles sur la période ({{ finGlobale + 1 }} jours ouvrés × nombre de machines). Jours d'occupation d'un produit = somme des durées de ses lots sur cet équipement (durée d'un lot = boîtes ÷ cadence, en jours).</p>
    </section>

    <section v-if="groupes.length" class="kpi-line">
      <div class="kpi-mini"><div class="km-val">{{ fmtDA(totalCA) }}</div><div class="km-lbl">CA total</div></div>
      <div class="kpi-mini"><div class="km-val">{{ lotsDeployes.length }}</div><div class="km-lbl">Lots</div></div>
      <div class="kpi-mini"><div class="km-val">{{ finGlobale + 1 }} j</div><div class="km-lbl">Jours ouvrés</div></div>
      <div class="kpi-mini" v-if="tauxAlim > 0"><div class="km-val">{{ (tauxAlim * 100).toFixed(0) }} %</div><div class="km-lbl">Alim. conditionnement</div></div>
      <div class="kpi-mini" v-if="optimisationCond && condSeul"><div class="km-val">{{ condNettoyages }}</div><div class="km-lbl">Nettoyages</div></div>
      <div class="kpi-mini"><div class="km-val">{{ fmtDate(dateIdx(finGlobale)) }}</div><div class="km-lbl">Fin de planning</div></div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../supabase'

const routerOrd = useRouter()
function allerCadences(m) { routerOrd.push({ path: '/cadences', query: { produit: m.code } }) }

const PALETTE = ['#0f766e', '#4338ca', '#c2410c', '#047857', '#7c3aed', '#0369a1', '#b91c1c', '#a16207', '#be185d', '#15803d']
const PHASE_NOM = { pesee: 'Pesée', granulation: 'Granulation', sechage: 'Séchage', melange: 'Mélange', compression: 'Compression', remplissage: 'Remplissage', pelliculage: 'Pelliculage', conditionnement: 'Conditionnement' }
const PHASE_ORDRE = ['pesee', 'granulation', 'sechage', 'melange', 'compression', 'remplissage', 'pelliculage', 'conditionnement']
const NOM_KEY = {}
for (const [k, v] of Object.entries(PHASE_NOM)) NOM_KEY[v.toLowerCase()] = k

const produits = ref([]), equipements = ref([]), cadences = ref([]), ofs = ref([]), conds = ref([]), chargement = ref(true)
const groupes = ref([])   // { id, produitId, boites, nbLots }
const dateDepart = ref(new Date().toISOString().slice(0, 10))
const skipWeekend = ref(true)
const prioMode = ref('valeur')   // 'valeur' (WSPT : CA ÷ durée, livrer la valeur au plus tôt) | 'ca' (CA total) | 'manuelle'
const prioAutoCA = computed(() => prioMode.value !== 'manuelle')
const optimisationCond = ref(true)   // alimentation continue du conditionnement (anti-rupture) — actif par défaut
const condSeul = ref(false)
const fabSeul = ref(false)           // fabrication seule : on ordonnance la fab pour tenir l'échéance de conditionnement (import plan)
const preferCampagne = ref(0.5)
const hpj = ref(24)
const selProduit = ref(''), rechercheProduit = ref(''), selBoites = ref('')
let seq = 1
const msgImport = ref('')

function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('fr-FR') }
function fmtDA(n) { const v = Number(n) || 0; return v >= 1e6 ? (v / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' M DA' : Math.round(v).toLocaleString('fr-FR') + ' DA' }
function fmtDate(d) { return d ? d.toLocaleDateString('fr-FR') : '' }

async function fetchAllPaged(make) {
  const size = 1000; let from = 0, all = []
  for (;;) { const r = await make().range(from, from + size - 1); if (r.error) return all; all = all.concat(r.data || []); if (!r.data || r.data.length < size) break; from += size }
  return all
}

onMounted(async () => {
  const [rp, re, rc, ro, rk] = await Promise.all([
    fetchAllPaged(() => supabase.from('produits').select('id, code_pf, designation, pcsu, unites_par_boite, taille_lot, poids_lot_kg, gamme').eq('actif', true)),
    fetchAllPaged(() => supabase.from('equipements').select('*').eq('actif', true)),
    fetchAllPaged(() => supabase.from('cadences_produit').select('equipement_id, produit_id, cadence_nominale, mode')),
    fetchAllPaged(() => supabase.from('ordres_fabrication').select('id, numero_lot, produit_id, quantite_theorique, boites_fabriquees, date_fin_fabrication, date_lancement').eq('actif', true)),
    fetchAllPaged(() => supabase.from('conditionnement').select('ordre_id').eq('actif', true))
  ])
  produits.value = rp; equipements.value = re; cadences.value = rc; ofs.value = ro; conds.value = rk; chargement.value = false
  chargerLocal()
})

// Sauvegarde automatique à chaque changement
watch([groupes, dateDepart, skipWeekend, hpj, prioMode], sauvegarderLocal, { deep: true })

function phaseDeType(type) {
  const t = (type || '').toLowerCase()
  if (/pes[ée]|balance|bascule/.test(t)) return 'pesee'
  if (/granul/.test(t)) return 'granulation'
  if (/séch|sech/.test(t)) return 'sechage'
  if (/mélang|melang/.test(t)) return 'melange'
  if (/gélule|gelule|remplis|encapsul|capsul/.test(t)) return 'remplissage'
  if (/compress|presse|compri/.test(t)) return 'compression'
  if (/p[eé]llicul|enrob|coat|drag/.test(t)) return 'pelliculage'
  if (/condition|blister|thermoform|uhlmann|integra|marchesini|emball|étui|etui|fardel|encart|mise en bo/.test(t)) return 'conditionnement'
  return null
}
function phaseKeyFromName(name) {
  const t = String(name || '').toLowerCase().trim()
  if (NOM_KEY[t]) return NOM_KEY[t]
  if (/pes/.test(t)) return 'pesee'
  if (/granul/.test(t)) return 'granulation'
  if (/séch|sech/.test(t)) return 'sechage'
  if (/mélang|melang/.test(t)) return 'melange'
  if (/gélule|gelule|remplis|capsul/.test(t)) return 'remplissage'
  if (/compress|compri/.test(t)) return 'compression'
  if (/p[eé]llicul|enrob|drag/.test(t)) return 'pelliculage'
  if (/condition/.test(t)) return 'conditionnement'
  return null
}

const prodById = computed(() => { const m = {}; for (const p of produits.value) m[p.id] = p; return m })
const cadMap = computed(() => { const m = {}; for (const c of cadences.value) m[c.equipement_id + '|' + c.produit_id] = Number(c.cadence_nominale || 0); return m })
const couleur = (i) => PALETTE[i % PALETTE.length]

const produitsTries = computed(() => [...produits.value].sort((a, b) => String(a.code_pf || '').localeCompare(String(b.code_pf || ''), undefined, { numeric: true })))
const produitsAffiches = computed(() => {
  const q = rechercheProduit.value.trim().toLowerCase()
  if (!q) return produitsTries.value
  return produitsTries.value.filter(p => (p.code_pf || '').toLowerCase().includes(q) || (p.designation || '').toLowerCase().includes(q))
})

// Séquence de phases d'un produit = gamme (mappée en clés) + conditionnement final.
function gammeProduit(produitId) {
  if (condSeul.value) return ['conditionnement']
  const p = prodById.value[produitId]
  const g = (p && Array.isArray(p.gamme)) ? p.gamme : []
  const keys = []
  for (const n of g) { const k = phaseKeyFromName(n); if (k && k !== 'conditionnement' && !keys.includes(k)) keys.push(k) }
  if (!fabSeul.value) keys.push('conditionnement')   // fabrication seule : on n'ordonnance pas le conditionnement
  return keys
}
function gammeNoms(produitId) { return gammeProduit(produitId).map(k => PHASE_NOM[k]).join(' → ') }
// Choix d'équipement par (groupe|phase) ; vide = auto (le plus tôt libre)
const choixEquip = reactive({})
function equipsPhase(produitId, k) { return equipements.value.filter(e => phaseDeType(e.type) === k && cadMap.value[e.id + '|' + produitId] > 0) }
const aDesChoix = computed(() => groupes.value.some(g => gammeProduit(g.produitId).some(k => equipsPhase(g.produitId, k).length > 1)))

const tailleLotSel = computed(() => { const p = prodById.value[selProduit.value]; return p ? (Number(p.taille_lot) || 0) : 0 })
const lotsAuto = computed(() => { const b = Number(selBoites.value) || 0, tl = tailleLotSel.value; return (b > 0 && tl > 0) ? Math.ceil(b / tl) : 0 })

function ajouter() {
  if (!selProduit.value || !(Number(selBoites.value) > 0)) return
  const p = prodById.value[selProduit.value] || {}
  const tl = Number(p.taille_lot) || 0
  const total = Number(selBoites.value)
  const nb = tl > 0 ? Math.min(60, Math.ceil(total / tl)) : 1
  groupes.value.push({ id: seq++, ofId: null, numeroLot: null, produitId: selProduit.value, totalBoites: total, boitesParLot: tl > 0 ? tl : total, nbLots: nb, priorite: groupes.value.length + 1, dateFixe: null })
}
function retirer(id) { groupes.value = groupes.value.filter(g => g.id !== id) }
function setPriorite(id, val) { const g = groupes.value.find(x => x.id === id); if (g) g.priorite = Math.max(1, Number(val) || 1) }
function caDe(g) { const p = prodById.value[g.produitId] || {}; return (Number(g.totalBoites) || 0) * (Number(p.pcsu) || 0) }

// --- Persistance locale du scénario ---
const LS_KEY = 'ldm_ordo_scenario_v1'
function sauvegarderLocal() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      groupes: groupes.value, dateDepart: dateDepart.value, skipWeekend: skipWeekend.value,
      hpj: hpj.value, prioMode: prioMode.value, seq
    }))
  } catch (e) { /* stockage indisponible */ }
}
function chargerLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY); if (!raw) return
    const d = JSON.parse(raw)
    if (Array.isArray(d.groupes)) groupes.value = d.groupes
    if (d.dateDepart) dateDepart.value = d.dateDepart
    if (typeof d.skipWeekend === 'boolean') skipWeekend.value = d.skipWeekend
    if (d.hpj) hpj.value = d.hpj
    if (d.prioMode) prioMode.value = d.prioMode
    else if (typeof d.prioAutoCA === 'boolean') prioMode.value = d.prioAutoCA ? 'ca' : 'manuelle'   // rétro-compat
    if (d.seq) seq = Math.max(seq, Number(d.seq) || 1)
  } catch (e) { /* ignore */ }
}
function remiseAZero() {
  if (!confirm('Vider le scénario (produits, quantités, priorités) ? Cette action est définitive.')) return
  groupes.value = []
  try { localStorage.removeItem(LS_KEY) } catch (e) {}
}

// Lots en cours (non terminés en fabrication) regroupés par produit — depuis Disponibilité par atelier
// Lots réels importables (individuels, avec numéro de lot)
const condOrdreIds = computed(() => { const set = new Set(); for (const c of conds.value) if (c.ordre_id) set.add(c.ordre_id); return set })
const lotsImportablesRaw = computed(() => {
  const done = condOrdreIds.value, out = []
  for (const o of ofs.value) {
    if (!o.produit_id || !prodById.value[o.produit_id]) continue
    if (condSeul.value) {
      if (!o.date_fin_fabrication || done.has(o.id)) continue
      out.push({ id: o.id, numeroLot: o.numero_lot, produitId: o.produit_id, boites: Number(o.boites_fabriquees) || Number(o.quantite_theorique) || 0, date: o.date_fin_fabrication })
    } else {
      if (o.date_fin_fabrication) continue
      out.push({ id: o.id, numeroLot: o.numero_lot, produitId: o.produit_id, boites: Number(o.quantite_theorique) || 0, date: o.date_lancement })
    }
  }
  return out
})
const nbLotsEnCours = computed(() => lotsImportablesRaw.value.length)
const nbProduitsImport = computed(() => new Set(lotsImportablesRaw.value.map(x => x.produitId)).size)
function importerLotsEnCours() {
  let nP = 0, plusTot = null
  for (const x of lotsImportablesRaw.value) {
    if (groupes.value.some(g => g.ofId === x.id)) continue
    const p = prodById.value[x.produitId]; if (!p) continue
    groupes.value.push({ id: seq++, ofId: x.id, numeroLot: x.numeroLot || null, produitId: x.produitId, totalBoites: x.boites, boitesParLot: x.boites, nbLots: 1, priorite: groupes.value.length + 1, dateFixe: x.date || null })
    if (x.date && (!plusTot || x.date < plusTot)) plusTot = x.date
    nP++
  }
  if (plusTot && plusTot < dateDepart.value) dateDepart.value = plusTot
  msgImport.value = nP ? (nP + ' lot(s) importé(s)' + (condSeul.value ? ' — vrac à conditionner' : ' — calés sur leur date de lancement') + '.') : 'Rien à importer (déjà importés, ou aucun lot disponible).'
}

// --- Import du plan depuis un fichier Excel (colonnes Code + Taille/Quantité) ---
const fichierPlan = ref(null)
let xlsxPromise = null
function chargerXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX)
  if (xlsxPromise) return xlsxPromise
  xlsxPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
    s.onload = () => resolve(window.XLSX)
    s.onerror = () => reject(new Error('Chargement de la librairie Excel impossible (hors ligne ?)'))
    document.head.appendChild(s)
  })
  return xlsxPromise
}
function declencherImportPlan() { msgImport.value = ''; if (fichierPlan.value) fichierPlan.value.click() }
const toDateImp = (v) => {
  if (v instanceof Date && !isNaN(v)) return v
  if (typeof v === 'number') { const d = new Date(Math.round((v - 25569) * 86400000)); return isNaN(d) ? null : d }
  if (typeof v === 'string') { const s = v.trim(); const m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/); if (m) { let y = +m[3]; if (y < 100) y += 2000; const d = new Date(y, +m[2] - 1, +m[1]); return isNaN(d) ? null : d } const d = new Date(s); return isNaN(d) ? null : d }
  return null
}
async function importerPlanExcel(e) {
  const file = e.target.files && e.target.files[0]; if (e.target) e.target.value = ''
  if (!file) return
  msgImport.value = 'Lecture du plan…'
  try {
    const XLSX = await chargerXLSX()
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true })
    const norm = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
    const parCode = {}
    for (const p of produits.value) if (p.code_pf) parCode[String(p.code_pf).trim().toLowerCase()] = p.id
    // Feuilles « besoin conditionnement » : Code + Taille + Début est. (échéance). Au lot (N° Lot).
    const feuilles = []
    for (const sn of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, blankrows: false })
      if (!rows.length) continue
      for (let r = 0; r < Math.min(rows.length, 15); r++) {
        const head = (rows[r] || []).map(norm)
        const iCode = head.indexOf('code'); const iTaille = head.indexOf('taille')
        const iDebut = head.findIndex(h => h.startsWith('debut est'))
        if (iCode >= 0 && iTaille >= 0 && iDebut >= 0) { const iLot = head.findIndex(h => h.includes('lot')); feuilles.push({ rows, hi: r, iCode, iTaille, iDebut, iLot }); break }
      }
    }
    if (!feuilles.length) { msgImport.value = 'Aucune feuille de conditionnement reconnue (colonnes attendues : « Code », « Taille », « Début est. »).'; return }
    let nAjout = 0; const nonReconnus = new Set(); const dejaLots = new Set(groupes.value.map(g => g.numeroLot).filter(Boolean))
    for (const F of feuilles) {
      for (let i = F.hi + 1; i < F.rows.length; i++) {
        const row = F.rows[i]; if (!row) continue
        const code = String(row[F.iCode] == null ? '' : row[F.iCode]).trim(); if (!code) continue
        const t = Number(String(row[F.iTaille] == null ? '' : row[F.iTaille]).replace(/\s/g, '').replace(',', '.')); if (!t || isNaN(t) || t <= 0) continue
        const pid = parCode[code.toLowerCase()]
        if (!pid) { if (nonReconnus.size < 10) nonReconnus.add(code); continue }
        const p = prodById.value[pid]; if (!p) continue
        const numeroLot = F.iLot >= 0 && row[F.iLot] != null ? String(row[F.iLot]).trim() : null
        if (numeroLot && dejaLots.has(numeroLot)) continue
        if (numeroLot) dejaLots.add(numeroLot)
        const d = toDateImp(row[F.iDebut]); const ds = d ? d.toISOString().slice(0, 10) : null
        groupes.value.push({ id: seq++, ofId: null, numeroLot, produitId: p.id, totalBoites: Math.round(t), boitesParLot: Math.round(t), nbLots: 1, priorite: groupes.value.length + 1, dateFixe: null, dateEcheance: ds })
        nAjout++
      }
    }
    // Mode : ordonnancement fabrication par échéance de conditionnement
    fabSeul.value = true
    optimisationCond.value = false
    prioMode.value = 'echeance'
    msgImport.value = nAjout ? (nAjout + ' lot(s) importé(s) — ordonnancement de la FABRICATION par échéance (début de conditionnement). Vérifie les retards éventuels.' + (nonReconnus.size ? ' Codes non reconnus : ' + [...nonReconnus].join(', ') : '')) : 'Aucun lot reconnu (ou déjà importés).'
  } catch (err) { msgImport.value = 'Import impossible : ' + (err.message || err) }
}
// Durée de production estimée d'un groupe (jours) = somme des durées de phases sur l'équipement le plus rapide.
function dureeGroupe(g) {
  const seqPh = gammeProduit(g.produitId)
  let total = 0
  for (const k of seqPh) {
    const compat = equipements.value.filter(e => phaseDeType(e.type) === k && cadMap.value[e.id + '|' + g.produitId] > 0)
    if (!compat.length) continue
    let best = Infinity
    for (const e of compat) { const d = dureeJours(e, g.produitId, g.totalBoites); if (d < best) best = d }
    if (best < Infinity) total += best
  }
  return Math.max(1, total)
}
// Priorité effective :
//  - 'valeur' : WSPT — on sert d'abord la plus forte valeur par jour de production (CA ÷ durée) → maximise le CA livré au plus tôt
//  - 'ca'     : CA total décroissant
//  - 'manuelle': priorités saisies
const echVal = (g) => g.dateEcheance ? new Date(g.dateEcheance + 'T00:00:00').getTime() : Infinity
const prioriteEffective = computed(() => {
  const m = {}
  if (prioMode.value === 'manuelle') { for (const g of groupes.value) m[g.id] = Number(g.priorite) || 999; return m }
  const ranked = [...groupes.value].sort((a, b) => {
    if (prioMode.value === 'echeance') return (echVal(a) - echVal(b)) || (caDe(b) - caDe(a))   // EDD : échéance la plus proche d'abord
    if (prioMode.value === 'valeur') return (caDe(b) / dureeGroupe(b)) - (caDe(a) / dureeGroupe(a))
    return caDe(b) - caDe(a)
  })
  ranked.forEach((g, i) => { m[g.id] = i + 1 })
  return m
})

// Déploiement en lots individuels (numérotés par produit).
const lotsDeployes = computed(() => {
  const out = []
  const pe = prioriteEffective.value
  const ordered = groupes.value.map((g, gi) => ({ g, gi })).sort((a, b) => ((pe[a.g.id] || 999) - (pe[b.g.id] || 999)) || (a.gi - b.gi))
  for (const { g, gi } of ordered) {
    let reste = g.totalBoites
    for (let i = 1; i <= g.nbLots; i++) {
      const b = Math.min(g.boitesParLot, reste); reste -= b
      out.push({ id: g.id * 1000 + i, groupeId: g.id, produitId: g.produitId, boites: b, num: i, numeroLot: g.numeroLot, couleur: couleur(gi), prio: pe[g.id] || 999, dateFixe: g.dateFixe })
    }
  }
  return out
})

function dureeJours(equip, produitId, boites) {
  const p = prodById.value[produitId]; if (!p) return 1
  const cad = cadMap.value[equip.id + '|' + produitId]
  if (!(cad > 0)) return 1
  const estCond = phaseDeType(equip.type) === 'conditionnement'
  let qty = boites   // conditionnement : boîtes/h
  if (!estCond) { const tl = Number(p.taille_lot) || 0, plk = Number(p.poids_lot_kg) || 0; if (tl > 0 && plk > 0) qty = boites * plk / tl }   // fabrication : kg/h
  const heures = qty / cad
  return Math.max(1, Math.ceil(heures / hpj.value))
}

// Calendrier de jours ouvrés à partir de la date de départ.
const joursOuvres = computed(() => {
  const out = []; const d = new Date(dateDepart.value + 'T00:00:00')
  let guard = 0
  while (out.length < 900 && guard < 2000) {
    const wd = d.getDay()
    if (!skipWeekend.value || (wd !== 0 && wd !== 6)) out.push(new Date(d))
    d.setDate(d.getDate() + 1); guard++
  }
  return out
})
function dateIdx(idx) { const a = joursOuvres.value; return a.length ? a[Math.max(0, Math.min(idx, a.length - 1))] : null }
function idxDeDate(ds) { if (!ds) return 0; const a = joursOuvres.value, t = new Date(ds + 'T00:00:00'); for (let i = 0; i < a.length; i++) if (a[i] >= t) return i; return 0 }

// Ordonnancement : chaque lot enchaîne sa gamme, chaque phase après la précédente ET la libération de l'équipement.
// Ordonnance une liste de lots et mesure le temps mort du conditionnement
function simuler(lots) {
  const slots = {}
  function slotsDe(e) {
    if (!slots[e.id]) { const n = Math.max(1, Math.floor(Number(e.nb_machines) || 1)); slots[e.id] = new Array(n).fill(0) }
    return slots[e.id]
  }
  const slotsProd = {}
  function prodsDe(e) { if (!slotsProd[e.id]) { const n = Math.max(1, Math.floor(Number(e.nb_machines) || 1)); slotsProd[e.id] = new Array(n).fill(null) } return slotsProd[e.id] }
  let nettoyages = 0, joursNett = 0
  const rows = []
  for (const lt of lots) {
    const seqPh = gammeProduit(lt.produitId)
    const p = prodById.value[lt.produitId] || {}
    let prevEnd = lt.dateFixe ? Math.max(-1, idxDeDate(lt.dateFixe) - 1) : -1
    const phases = {}
    for (const k of seqPh) {
      let compat = equipements.value.filter(e => phaseDeType(e.type) === k && cadMap.value[e.id + '|' + lt.produitId] > 0)
      const chx = choixEquip[lt.groupeId + '|' + k]
      if (chx) { const f = compat.filter(e => e.id === chx); if (f.length) compat = f }
      if (!compat.length) continue
      let eq = null, si = -1, libre = Infinity
      for (const e of compat) { const arr = slotsDe(e); for (let i = 0; i < arr.length; i++) if (arr[i] < libre) { libre = arr[i]; eq = e; si = i } }
      const duree = dureeJours(eq, lt.produitId, lt.boites)
      let clean = 0
      if (k === 'conditionnement') { const last = prodsDe(eq)[si]; if (last !== null && last !== lt.produitId) { clean = Math.ceil(((Number(eq.vdlt) || 0) + (Number(eq.reglage) || 0)) / hpj.value); if (clean > 0) { nettoyages++; joursNett += clean } } }
      const start = Math.max(prevEnd + 1, (slotsDe(eq)[si] || 0) + clean)
      const end = start + duree - 1
      phases[k] = { start, end, equip: eq.nom || eq.code }
      slotsDe(eq)[si] = end + 1
      if (k === 'conditionnement') prodsDe(eq)[si] = lt.produitId
      prevEnd = end
    }
    const fabK = Object.keys(phases).filter(k => k !== 'conditionnement')
    const debutFab = fabK.length ? Math.min(...fabK.map(k => phases[k].start)) : null
    const finFab = fabK.length ? Math.max(...fabK.map(k => phases[k].end)) : null
    const cd = phases['conditionnement']
    rows.push({ id: lt.id, num: lt.num, numeroLot: lt.numeroLot, code: p.code_pf, desig: p.designation, boites: lt.boites, couleur: lt.couleur, prio: lt.prio, phases, debutFab, finFab, finCond: cd ? cd.end : null })
  }
  let fin = 0; for (const r of rows) for (const k in r.phases) fin = Math.max(fin, r.phases[k].end)
  const condByEq = {}
  for (const r of rows) {
    const cd = r.phases['conditionnement']; if (!cd) continue
    if (!condByEq[cd.equip]) condByEq[cd.equip] = { busy: 0, min: cd.start, max: cd.end }
    const a = condByEq[cd.equip]; a.busy += cd.end - cd.start + 1
    if (cd.start < a.min) a.min = cd.start
    if (cd.end > a.max) a.max = cd.end
  }
  let idle = 0, busy = 0, span = 0
  for (const a of Object.values(condByEq)) { const sp = a.max - a.min + 1; idle += Math.max(0, sp - a.busy); busy += a.busy; span += sp }
  return { rows, fin, condIdle: idle, condBusy: busy, condSpan: span, nettoyages, joursNett }
}

// Ordre entrelacé : round-robin des lots entre produits (respecte l'ordre de priorité des produits)
function ordreEntrelace() {
  const pe = prioriteEffective.value
  const gs = groupes.value.map((g, gi) => ({ g, gi })).sort((a, b) => ((pe[a.g.id] || 999) - (pe[b.g.id] || 999)) || (a.gi - b.gi))
  const parG = gs.map(({ g, gi }) => {
    const arr = []; let reste = g.totalBoites
    for (let i = 1; i <= g.nbLots; i++) { const b = Math.min(g.boitesParLot, reste); reste -= b; arr.push({ id: g.id * 1000 + i, groupeId: g.id, produitId: g.produitId, boites: b, num: i, numeroLot: g.numeroLot, couleur: couleur(gi), prio: pe[g.id] || 999, dateFixe: g.dateFixe }) }
    return arr
  })
  const maxL = parG.reduce((m, a) => Math.max(m, a.length), 0)
  const out = []
  for (let i = 0; i < maxL; i++) for (const arr of parG) if (arr[i]) out.push(arr[i])
  return out
}

// Conditionnement seul : greedy « line-pull » — chaque ligne libre prend le lot au plus fort CA compatible.
// Découpe librement les campagnes pour occuper toutes les lignes en continu.
function simulerGreedyCond(lots) {
  const machines = []
  for (const e of equipements.value) {
    if (phaseDeType(e.type) !== 'conditionnement') continue
    const n = Math.max(1, Math.floor(Number(e.nb_machines) || 1))
    const chH = (Number(e.vdlt) || 0) + (Number(e.reglage) || 0)
    for (let i = 0; i < n; i++) machines.push({ equipId: e.id, equip: e, equipNom: e.nom || e.code, free: 0, lastProd: null, chH })
  }
  const caDe = (lt) => { const pr = prodById.value[lt.produitId] || {}; return lt.boites * (Number(pr.pcsu) || 0) }
  const readyOf = (lt) => lt.dateFixe ? idxDeDate(lt.dateFixe) : 0
  const rows = []
  const remaining = lots.slice()
  const pc = preferCampagne.value
  let nettoyages = 0, joursNett = 0
  while (remaining.length && machines.length) {
    machines.sort((a, b) => a.free - b.free)
    const m = machines[0]
    let best = -1, bestCA = -Infinity
    for (let i = 0; i < remaining.length; i++) {
      const lt = remaining[i]
      if (!(cadMap.value[m.equipId + '|' + lt.produitId] > 0)) continue
      const chx = choixEquip[lt.groupeId + '|conditionnement']
      if (chx && chx !== m.equipId) continue
      const same = m.lastProd === lt.produitId
      const c = caDe(lt) * (same ? (1 + 3 * pc) : 1)
      if (c > bestCA) { bestCA = c; best = i }
    }
    if (best < 0) { machines.shift(); continue }
    const lt = remaining.splice(best, 1)[0]
    const productChange = m.lastProd !== null && m.lastProd !== lt.produitId
    const clean = productChange ? Math.ceil(m.chH / hpj.value) : 0
    if (clean > 0) { nettoyages++; joursNett += clean }
    const duree = dureeJours(m.equip, lt.produitId, lt.boites)
    const start = Math.max(m.free + clean, readyOf(lt))
    const end = start + duree - 1
    m.free = end + 1
    m.lastProd = lt.produitId
    const pr = prodById.value[lt.produitId] || {}
    rows.push({ id: lt.id, num: lt.num, numeroLot: lt.numeroLot, code: pr.code_pf, desig: pr.designation, boites: lt.boites, couleur: lt.couleur, prio: lt.prio, phases: { conditionnement: { start, end, equip: m.equipNom } }, debutFab: null, finFab: null, finCond: end })
  }
  let fin = 0; for (const r of rows) for (const k in r.phases) fin = Math.max(fin, r.phases[k].end)
  const condByEq = {}
  for (const r of rows) {
    const cd = r.phases['conditionnement']; if (!cd) continue
    if (!condByEq[cd.equip]) condByEq[cd.equip] = { busy: 0, min: cd.start, max: cd.end }
    const a = condByEq[cd.equip]; a.busy += cd.end - cd.start + 1
    if (cd.start < a.min) a.min = cd.start
    if (cd.end > a.max) a.max = cd.end
  }
  let idle = 0, busy = 0, span = 0
  for (const a of Object.values(condByEq)) { const sp = a.max - a.min + 1; idle += Math.max(0, sp - a.busy); busy += a.busy; span += sp }
  return { rows, fin, condIdle: idle, condBusy: busy, condSpan: span, nettoyages, joursNett }
}

const resultatSimu = computed(() => {
  const prio = { ...simuler(lotsDeployes.value), strategie: 'Priorité' }
  if (!optimisationCond.value) return prio
  const cands = [prio, { ...simuler(ordreEntrelace()), strategie: 'Entrelacé' }]
  if (condSeul.value) cands.push({ ...simulerGreedyCond(lotsDeployes.value), strategie: 'Sous-campagnes' })
  return cands.sort((a, b) => ((a.condIdle + (a.joursNett || 0)) - (b.condIdle + (b.joursNett || 0))) || (a.fin - b.fin))[0]
})
const planning = computed(() => resultatSimu.value.rows)
const condIdle = computed(() => resultatSimu.value.condIdle)
const strategieChoisie = computed(() => resultatSimu.value.strategie)
const tauxAlim = computed(() => { const r = resultatSimu.value; return r.condSpan > 0 ? r.condBusy / r.condSpan : 0 })
const condNettoyages = computed(() => resultatSimu.value.nettoyages || 0)
const condJoursNett = computed(() => resultatSimu.value.joursNett || 0)

// Récap « ordonnancement optimal » de l'objectif : par produit, date de livraison (fin de la dernière phase) + CA cumulé dans l'ordre de livraison.
const objectifResultat = computed(() => {
  const byG = {}
  for (const r of planning.value) {
    const gid = Math.floor(r.id / 1000)
    const fin = r.finCond != null ? r.finCond : (r.finFab != null ? r.finFab : 0)
    if (!byG[gid]) byG[gid] = { gid, fin: 0, boites: 0 }
    byG[gid].fin = Math.max(byG[gid].fin, fin)
    byG[gid].boites += r.boites
  }
  const list = Object.values(byG).map(x => {
    const g = groupes.value.find(gr => gr.id === x.gid) || {}
    const p = prodById.value[g.produitId] || {}
    return { gid: x.gid, code: p.code_pf || '?', desig: p.designation || '', boites: x.boites, ca: x.boites * (Number(p.pcsu) || 0), finIdx: x.fin, dateLivr: dateIdx(x.fin) }
  }).sort((a, b) => (a.finIdx - b.finIdx) || (b.ca - a.ca))
  let cum = 0
  for (const it of list) { cum += it.ca; it.cumCA = cum }
  const finMax = list.reduce((mx, x) => Math.max(mx, x.finIdx), 0)
  const sansCond = list.filter(x => x.finIdx === 0 || x.finIdx == null).length
  return { list, totalCA: cum, totalBoites: list.reduce((s, x) => s + x.boites, 0), dateFin: dateIdx(finMax), sansCond }
})

// Répartition de la charge de FABRICATION sur les ateliers libres : par équipement utilisé, lots & jours affectés.
const repartitionFab = computed(() => {
  const m = {}
  for (const r of planning.value) {
    for (const k in r.phases) {
      if (k === 'conditionnement') continue
      const ph = r.phases[k]
      const cle = (PHASE_NOM[k] || k) + ' · ' + ph.equip
      if (!m[cle]) m[cle] = { phase: PHASE_NOM[k] || k, equip: ph.equip, lots: 0, jours: 0 }
      m[cle].lots += 1
      m[cle].jours += (ph.end - ph.start + 1)
    }
  }
  const list = Object.values(m).sort((a, b) => a.phase.localeCompare(b.phase) || b.jours - a.jours)
  const totJours = list.reduce((s, x) => s + x.jours, 0)
  for (const x of list) x.pct = totJours > 0 ? Math.round(x.jours / totJours * 100) : 0
  return list
})

// --- Ordonnancement par atelier (date d'entrée → date de sortie) sur une fenêtre de mois ---
const plageMois = ref(1)          // 1 = mois en cours (par défaut), 2, 3
const detailOuvert = ref(false)   // Gantt / planning complet / occupation en repli
const fenetreOrdo = computed(() => {
  const now = new Date()
  const debut = new Date(now.getFullYear(), now.getMonth(), 1)
  const fin = new Date(now.getFullYear(), now.getMonth() + plageMois.value, 0, 23, 59, 59)   // dernier jour de (mois courant + plageMois - 1)
  return { debut, fin }
})
const ordoParAtelier = computed(() => {
  const { debut, fin } = fenetreOrdo.value
  const byEq = {}
  for (const r of planning.value) {
    for (const k in r.phases) {
      const ph = r.phases[k]
      const dE = dateIdx(ph.start), dS = dateIdx(ph.end)
      if (!dE || !dS) continue
      if (dS < debut || dE > fin) continue   // ne garder que les lots qui touchent la plage
      const cle = (PHASE_NOM[k] || k) + '§' + ph.equip
      if (!byEq[cle]) byEq[cle] = { phase: PHASE_NOM[k] || k, equip: ph.equip, cond: k === 'conditionnement', lots: [] }
      byEq[cle].lots.push({ code: r.code, desig: r.desig, numeroLot: r.numeroLot, boites: r.boites, couleur: r.couleur, entree: dE, sortie: dS, startIdx: ph.start, endIdx: ph.end })
    }
  }
  const list = Object.values(byEq)
  for (const a of list) {
    a.lots.sort((x, y) => x.startIdx - y.startIdx)
    let prevEnd = null; a.trouTotal = 0
    for (const l of a.lots) { l.trou = (prevEnd != null && l.startIdx > prevEnd + 1) ? (l.startIdx - prevEnd - 1) : 0; a.trouTotal += l.trou; prevEnd = l.endIdx }
  }
  return list.sort((a, b) => a.phase.localeCompare(b.phase) || String(a.equip).localeCompare(String(b.equip)))
})

// Aperçu agrégé par produit (affichage quand beaucoup de lots importés)
const apercuProduits = computed(() => {
  const m = {}
  for (const g of groupes.value) {
    const p = prodById.value[g.produitId] || {}
    if (!m[g.produitId]) m[g.produitId] = { produitId: g.produitId, code: p.code_pf || '?', desig: p.designation || '', nbLots: 0, boites: 0, ech: null }
    m[g.produitId].nbLots += g.nbLots || 1
    m[g.produitId].boites += Number(g.totalBoites) || 0
    if (g.dateEcheance && (!m[g.produitId].ech || g.dateEcheance < m[g.produitId].ech)) m[g.produitId].ech = g.dateEcheance
  }
  return Object.values(m).sort((a, b) => (a.ech || 'zzzz').localeCompare(b.ech || 'zzzz') || a.code.localeCompare(b.code))
})
// Respect des échéances : fin de fabrication vs début de conditionnement (échéance), par lot
const resultatEcheance = computed(() => {
  const gById = {}; for (const g of groupes.value) gById[g.id] = g
  const list = []
  for (const r of planning.value) {
    const gid = Math.floor(r.id / 1000); const g = gById[gid]; if (!g || !g.dateEcheance) continue
    const finIdx = r.finFab != null ? r.finFab : (r.finCond != null ? r.finCond : 0)
    const finDate = dateIdx(finIdx)
    const ech = new Date(g.dateEcheance + 'T00:00:00')
    const retard = (finDate && ech) ? Math.round((finDate - ech) / 86400000) : null
    list.push({ code: r.code, desig: r.desig, numeroLot: r.numeroLot, boites: r.boites, fin: finDate, echeance: ech, retard, enRetard: retard != null && retard > 0 })
  }
  const retards = list.filter(x => x.enRetard).sort((a, b) => b.retard - a.retard)
  return { total: list.length, nRetard: retards.length, nTemps: list.length - retards.length, retards }
})

const colonnes = computed(() => {
  const used = new Set()
  for (const r of planning.value) for (const k in r.phases) used.add(k)
  return PHASE_ORDRE.filter(k => used.has(k))
})

// Phases de la gamme non planifiées faute d'équipement + cadence
const phasesManquantes = computed(() => {
  const out = [], seen = new Set()
  for (const lt of lotsDeployes.value) {
    const seq = gammeProduit(lt.produitId)
    const p = prodById.value[lt.produitId] || {}
    for (const k of seq) {
      const ok = equipements.value.some(e => phaseDeType(e.type) === k && cadMap.value[e.id + '|' + lt.produitId] > 0)
      if (!ok) { const key = lt.produitId + '|' + k; if (!seen.has(key)) { seen.add(key); out.push({ code: p.code_pf, desig: p.designation, phase: PHASE_NOM[k] }) } }
    }
  }
  return out
})
const finGlobale = computed(() => {
  let m = 0
  for (const r of planning.value) for (const k in r.phases) m = Math.max(m, r.phases[k].end)
  return m
})
function barLeft(ph) { const per = finGlobale.value + 1; return (per > 0 ? (ph.start / per) * 100 : 0) + '%' }
function barWidth(ph) { const per = finGlobale.value + 1; return (per > 0 ? ((ph.end - ph.start + 1) / per) * 100 : 0) + '%' }
const axisTicks = computed(() => {
  const per = finGlobale.value + 1; if (per <= 0) return []
  const step = Math.max(1, Math.round(per / 10)), out = []
  for (let d = 0; d < per; d += step) {
    const date = dateIdx(d)
    out.push({ d, left: (d / per) * 100 + '%', label: date ? date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '' })
  }
  return out
})
const gridStyle = computed(() => { const per = finGlobale.value + 1, step = Math.max(1, Math.round(per / 10)); return { '--grid': (per > 0 ? (step / per) * 100 : 10) + '%' } })

// Occupation par équipement (toutes phases) + taux = jours occupés ÷ jours disponibles sur la période
const occParEquip = computed(() => {
  const map = {}
  for (const r of planning.value) {
    for (const k in r.phases) {
      const ph = r.phases[k]
      const key = ph.equip + '||' + k
      if (!map[key]) map[key] = { equip: ph.equip, phase: k, prods: {}, debut: ph.start, fin: ph.end }
      const a = map[key]
      if (ph.start < a.debut) a.debut = ph.start
      if (ph.end > a.fin) a.fin = ph.end
      const jours = ph.end - ph.start + 1
      if (!a.prods[r.code]) a.prods[r.code] = { code: r.code, desig: r.desig, couleur: r.couleur, boites: 0, lots: 0, jours: 0 }
      a.prods[r.code].boites += r.boites
      a.prods[r.code].lots += 1
      a.prods[r.code].jours += jours
    }
  }
  const machParNom = {}
  for (const e of equipements.value) { const n = e.nom || e.code; machParNom[n] = Math.max(machParNom[n] || 0, Math.max(1, Math.floor(Number(e.nb_machines) || 1))) }
  const periode = finGlobale.value + 1
  return Object.values(map).map(a => {
    const produits = Object.values(a.prods).sort((x, y) => y.jours - x.jours)
    const totalJours = produits.reduce((s, p) => s + p.jours, 0)
    const machines = machParNom[a.equip] || 1
    const dispo = periode * machines
    return { equip: a.equip, phase: a.phase, produits, debut: a.debut, fin: a.fin, totalJours, totalBoites: produits.reduce((s, p) => s + p.boites, 0), machines, taux: dispo > 0 ? totalJours / dispo : 0 }
  }).sort((x, y) => y.totalJours - x.totalJours)
})
const occFabrication = computed(() => occParEquip.value.filter(a => a.phase !== 'conditionnement'))
const occConditionnement = computed(() => occParEquip.value.filter(a => a.phase === 'conditionnement'))
function tauxCls(t) { return t > 0.9 ? 'tx-r' : t >= 0.7 ? 'tx-a' : 'tx-g' }

const groupesDetail = computed(() => {
  const pe = prioriteEffective.value
  return groupes.value.map((g, gi) => {
    const p = prodById.value[g.produitId] || {}
    return { id: g.id, produitId: g.produitId, numeroLot: g.numeroLot, code: p.code_pf || '?', desig: p.designation || '', boites: g.totalBoites, nb: g.nbLots, gammeNoms: gammeNoms(g.produitId), ca: g.totalBoites * Number(p.pcsu || 0), couleur: couleur(gi), priorite: pe[g.id] || 999 }
  }).sort((a, b) => ((a.priorite || 999) - (b.priorite || 999)) || (a.id - b.id))
})
const totalCA = computed(() => groupesDetail.value.reduce((s, g) => s + g.ca, 0))
</script>

<style scoped>
.ordo { max-width: 1240px; margin: 0 auto; padding: 6px 4px 24px; }
.ordo-head { margin-bottom: 20px; }
.oh-eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #0f766e; }
.oh-title { font-size: 24px; font-weight: 800; letter-spacing: -.02em; color: #1a2233; margin: 3px 0 2px; }
.oh-sub { font-size: 13.5px; color: #64748b; }

.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 20px; margin-bottom: 18px; }
.card-title { font-size: 15px; font-weight: 800; color: #1a2233; margin: 0 0 14px; }
.muted { font-size: 13px; color: #94a3b8; margin: 10px 0 0; }
.muted.warn { color: #b45309; }

.add-grid { display: flex; gap: 14px; align-items: flex-end; flex-wrap: wrap; }
.add-field { display: flex; flex-direction: column; gap: 5px; }
.add-field.grow { flex: 1; min-width: 240px; }
.add-field label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #64748b; }
.add-field select, .add-field input { padding: 8px 11px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13.5px; width: 100%; }
.prod-search { margin-bottom: 6px; }
.wk { font-size: 13px; color: #334155; font-weight: 500; display: inline-flex; align-items: center; gap: 7px; padding: 7px 0; text-transform: none; letter-spacing: 0; }
.btn-add { background: #0f766e; color: #fff; border: 0; border-radius: 9px; font: inherit; font-size: 13.5px; font-weight: 700; padding: 9px 18px; cursor: pointer; }
.btn-add:disabled { background: #cbd5e1; cursor: not-allowed; }
.lots-auto { padding: 8px 11px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; font-weight: 700; color: #0f766e; background: #f0fdfa; display: flex; align-items: center; gap: 8px; min-height: 37px; box-sizing: border-box; }
.tl-hint { font-size: 11px; font-weight: 500; color: #94a3b8; }

.tbl-wrap { overflow-x: auto; }
.grid { width: 100%; border-collapse: collapse; font-size: 13px; }
.grid th, .grid td { padding: 7px 10px; border-bottom: 1px solid #eef2f6; text-align: left; white-space: nowrap; }
.grid th { font-size: 12px; color: #64748b; font-weight: 700; }
.ta-r { text-align: right; }
.lot-dot { display: inline-block; width: 9px; height: 9px; border-radius: 3px; margin-right: 7px; vertical-align: middle; }
.lot-desig { color: #94a3b8; font-size: 12px; }
.gamme-cell { font-size: 12px; color: #475569; white-space: normal; }
.tot td { font-weight: 800; border-top: 2px solid #e2e8f0; background: #f8fafc; }
.lnk-del { background: none; border: 0; color: #94a3b8; cursor: pointer; font-size: 14px; }
.lnk-del:hover { color: #b91c1c; }

.plan th.ph-h { text-align: center; background: #f1f5f9; border-left: 2px solid #e2e8f0; }
.plan tr.sub th.dd { font-size: 10.5px; color: #94a3b8; font-weight: 600; }
.plan td.num { color: #94a3b8; font-weight: 700; }
.plan td.dcell { font-size: 12px; color: #334155; }
.plan td.dcell.fin { color: #64748b; border-right: 2px solid #f1f5f9; }

.gantt-legend { font-size: 12px; color: #64748b; margin-top: 12px; font-style: italic; }
.prio-inp { width: 46px; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 6px; font: inherit; font-size: 12.5px; text-align: center; }
.prio-cell { font-weight: 700; color: #0f766e; }
.prio-auto { display: inline-block; min-width: 24px; font-weight: 800; color: #0f766e; background: #f0fdfa; border-radius: 6px; padding: 2px 8px; }
.card-head-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 4px; }
.btn-reset { background: #fff; color: #b91c1c; border: 1px solid #fca5a5; border-radius: 8px; font: inherit; font-size: 13px; font-weight: 600; padding: 7px 14px; cursor: pointer; }
.btn-reset:hover { background: #fef2f2; }
.add-import { display: flex; align-items: center; gap: 12px; margin-top: 12px; flex-wrap: wrap; }
.btn-import { background: #ecfeff; color: #0e7490; border: 1px solid #67e8f9; border-radius: 9px; font: inherit; font-size: 13.5px; font-weight: 600; padding: 8px 16px; cursor: pointer; }
.btn-import:hover { background: #cffafe; }
.btn-import.excel { background: #ecfdf5; color: #047857; border-color: #6ee7b7; }
.btn-import.excel:hover { background: #d1fae5; }
.import-hint { font-size: 12px; color: #64748b; font-style: italic; }
.msg-import { font-size: 13px; color: #15803d; margin-top: 8px; font-weight: 600; }
.warn-card { border-color: #fcd34d; background: #fffbeb; }
.warn-txt { font-size: 13px; color: #92400e; margin-bottom: 10px; }
.manq-item { cursor: pointer; padding: 4px 6px; border-radius: 6px; transition: background .12s ease; }
.manq-item:hover { background: #fff7ed; }
.manq-go { color: #c2410c; font-weight: 600; font-size: 12px; margin-left: 4px; }
.manq-list { margin: 0; padding-left: 20px; }
.manq-list li { font-size: 13px; color: #334155; margin: 3px 0; }
.manq-ph { font-weight: 700; color: #b45309; }
.gantt { display: flex; flex-direction: column; gap: 4px; overflow-x: auto; }
.g-row { display: flex; align-items: center; gap: 8px; min-height: 24px; }
.g-lbl { width: 210px; flex-shrink: 0; font-size: 11.5px; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.g-desig { color: #94a3b8; }
.g-track { position: relative; flex: 1; height: 20px; min-width: 520px; background-color: #f8fafc; background-image: repeating-linear-gradient(to right, #e5eaf0 0 1px, transparent 1px var(--grid, 10%)); border-radius: 4px; }
.g-axis-row { display: flex; align-items: flex-end; gap: 8px; margin-bottom: 6px; }
.g-lbl-sp { width: 210px; flex-shrink: 0; }
.g-axis { position: relative; flex: 1; height: 16px; min-width: 520px; border-bottom: 1px solid #cbd5e1; }
.g-tick { position: absolute; bottom: 0; transform: translateX(-50%); }
.g-tick span { font-size: 9.5px; color: #64748b; white-space: nowrap; }
.g-tick::after { content: ''; position: absolute; bottom: -4px; left: 50%; width: 1px; height: 4px; background: #cbd5e1; }
.g-bar { position: absolute; top: 2px; height: 16px; border-radius: 3px; opacity: .82; display: flex; align-items: center; overflow: hidden; }
.g-bar.cond { opacity: 1; border: 2px solid #1e293b; box-sizing: border-box; }
.gb-t { font-size: 9px; color: #fff; font-weight: 700; padding: 0 3px; white-space: nowrap; }
.lot-num { font-size: 11px; font-weight: 700; color: #4338ca; background: #eef2ff; border-radius: 5px; padding: 1px 6px; }
.aff-intro { margin-bottom: 12px; }
.aff-prod { padding: 10px 0; border-bottom: 1px solid #eef2f6; }
.aff-prod:last-child { border-bottom: 0; }
.aff-nom { font-size: 13.5px; color: #1b2733; margin-bottom: 8px; }
.aff-phases { display: flex; flex-wrap: wrap; gap: 12px; }
.aff-ph { display: flex; flex-direction: column; gap: 3px; }
.aff-ph-lbl { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .04em; }
.aff-ph select { padding: 6px 9px; border: 1px solid #cbd5e1; border-radius: 7px; font: inherit; font-size: 13px; min-width: 170px; }
.opt-banner { font-size: 13px; color: #0f766e; background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; }
.slider-pc { width: 170px; accent-color: #0f766e; }
.slider-lbl { font-size: 11px; color: #64748b; margin-top: 3px; }
.objectif-card { border: 1px solid #c7d2fe; background: linear-gradient(180deg, #f5f7ff, #fff); }
.ech-card { border: 1px solid #fbcfe8; background: linear-gradient(180deg, #fdf4ff, #fff); }
.ech-strat { color: #a21caf; background: #fae8ff; border-color: #f5d0fe; }
.ech-retards { margin-top: 12px; }
.ech-rh { font-size: 13px; font-weight: 800; color: #b91c1c; margin-bottom: 7px; }
.ech-retard { color: #dc2626; font-weight: 800; white-space: nowrap; }
.ech-ok { margin-top: 10px; font-size: 13px; font-weight: 700; color: #047857; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 9px 12px; }
.obj-strat { font-size: 12px; font-weight: 700; color: #4338ca; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 999px; padding: 3px 11px; white-space: nowrap; }
.obj-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 12px 0 14px; }
.obj-kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 11px 13px; border-left: 4px solid #4338ca; }
.ok-v { font-size: 19px; font-weight: 800; color: #0f172a; line-height: 1.15; }
.ok-l { font-size: 11.5px; color: #64748b; font-weight: 600; margin-top: 2px; }
.obj-rang { font-weight: 800; color: #4338ca; }
.obj-date { font-weight: 700; color: #0f172a; white-space: nowrap; }
.obj-cum { font-weight: 800; color: #4338ca; }
.obj-note { font-size: 12px; color: #64748b; margin: 10px 2px 0; background: #f8fafc; border: 1px solid #eef2f6; border-radius: 8px; padding: 8px 11px; }
.obj-rep { margin-top: 14px; }
.obj-rep-h { font-size: 13px; font-weight: 800; color: #4338ca; margin-bottom: 7px; }
.rep-bar { display: inline-block; width: 70px; height: 7px; background: #eef2ff; border-radius: 999px; overflow: hidden; vertical-align: middle; margin-right: 7px; }
.rep-bar > span { display: block; height: 100%; background: #6366f1; border-radius: 999px; }
.plage-sel { display: flex; gap: 4px; flex-wrap: wrap; }
.plage-sel button { padding: 6px 12px; border: 1px solid #c7d2fe; background: #fff; color: #4338ca; border-radius: 8px; font: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; }
.plage-sel button:hover { background: #eef2ff; }
.plage-sel button.on { background: #4338ca; border-color: #4338ca; color: #fff; }
.ordo-atelier { margin-top: 14px; border: 1px solid #e8edf3; border-radius: 10px; overflow: hidden; }
.ordo-at-h { display: flex; align-items: center; gap: 9px; padding: 9px 13px; background: #f5f7ff; border-bottom: 1px solid #e8edf3; font-size: 13.5px; }
.ordo-ph { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; color: #6366f1; background: #eef2ff; border-radius: 6px; padding: 2px 8px; }
.ordo-n { margin-left: auto; font-size: 11.5px; font-weight: 700; color: #64748b; }
.ordo-date { font-weight: 700; color: #0f172a; white-space: nowrap; }
.ordo-detail-tg { margin-top: 14px; background: #f8fafc; border: 1px dashed #cbd5e1; color: #475569; border-radius: 8px; font: inherit; font-size: 12.5px; font-weight: 700; padding: 8px 14px; cursor: pointer; }
.ordo-detail-tg:hover { background: #eef2f6; }
.ordo-at-h.a-cond { background: #ecfdf5; border-bottom-color: #a7f3d0; }
.ordo-rupt { font-size: 11.5px; font-weight: 800; color: #b91c1c; background: #fee2e2; border-radius: 6px; padding: 2px 9px; }
.ordo-cont { font-size: 11.5px; font-weight: 700; color: #047857; background: #d1fae5; border-radius: 6px; padding: 2px 9px; }
.ordo-gap { display: inline-block; font-size: 10.5px; font-weight: 800; color: #b91c1c; background: #fee2e2; border-radius: 5px; padding: 1px 6px; margin-right: 6px; }
.ok-warn .ok-v { color: #dc2626; }
.ok-warn { border-left-color: #dc2626 !important; }
.cond-atelier { margin-bottom: 18px; }
.ca-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 8px 12px; background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px 8px 0 0; flex-wrap: wrap; }
.ca-head strong { font-size: 14px; color: #0f766e; }
.ca-tot { font-size: 12px; color: #475569; }
.cond-atelier .grid { border: 1px solid #e2e8f0; border-top: 0; }
.occ-sub { font-size: 12px; font-weight: 800; color: #1a2233; margin: 16px 0 10px; text-transform: uppercase; letter-spacing: .05em; }
.ca-id { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.ca-r { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.ca-phase { font-size: 11px; font-weight: 700; color: #0f766e; background: #ccfbf1; border-radius: 5px; padding: 1px 7px; }
.ca-mach { font-size: 11.5px; color: #64748b; }
.ca-taux { font-size: 12px; font-weight: 800; padding: 2px 9px; border-radius: 20px; }
.ca-taux.tx-g { background: #dcfce7; color: #15803d; } .ca-taux.tx-a { background: #fef3c7; color: #b45309; } .ca-taux.tx-r { background: #fee2e2; color: #b91c1c; }
.sumh { background: #f0fdfa !important; color: #0f766e !important; }
.dcell.sum { background: #f0fdfa; font-weight: 600; color: #0f766e; }

.kpi-line { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
@media (max-width: 720px) { .kpi-line { grid-template-columns: repeat(2, 1fr); } .add-field.grow { min-width: 100%; } }
.kpi-mini { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; }
.km-val { font-size: 20px; font-weight: 800; color: #0f766e; letter-spacing: -.02em; }
.km-lbl { font-size: 12px; color: #64748b; margin-top: 2px; }
</style>
