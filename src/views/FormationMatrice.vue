<template>
  <div class="form-page">
    <PageHeader title="Formations — Matrice & tableau de bord" tone="#0d9488"
      subtitle="État de qualification du personnel : qui est formé, ce qui expire, les écarts." />

    <p v-if="erreur" class="alert">{{ erreur }}</p>

    <div v-if="nbExpire || nbBientot" class="alerte-ech" :class="{ crit: nbExpire }">
      <span v-if="nbExpire">✗ <b>{{ nbExpire }}</b> qualification(s) expirée(s) ou non acquise(s)</span>
      <span v-if="nbExpire && nbBientot" class="sep">·</span>
      <span v-if="nbBientot">⚠ <b>{{ nbBientot }}</b> à recycler sous 60 jours</span>
    </div>

    <section class="card">
      <div class="perim-cards">
        <button type="button" class="pc" :class="{ on: filtreAtelier === '' }" @click="filtreAtelier = ''">
          <span class="pc-n">{{ personnes.length }}</span>
          <span class="pc-l">Tous les périmètres</span>
        </button>
        <button type="button" v-for="a in ateliersListe" :key="a" class="pc" :class="{ on: filtreAtelier === a }" @click="filtreAtelier = a">
          <span class="pc-n">{{ perimCount[a] || 0 }}</span>
          <span class="pc-l">{{ a }}</span>
        </button>
      </div>

      <div class="mat-bar">
        <div class="f"><label>Équipe</label><select v-model="filtreEquipe"><option value="">Toutes</option><option v-for="e in equipesListe" :key="e" :value="e">{{ e }}</option></select></div>
        <div class="f"><label>Fonction</label><select v-model="filtreFonction"><option value="">Toutes</option><option v-for="fn in fonctionsListe" :key="fn" :value="fn">{{ fn }}</option></select></div>
        <div class="f"><label>Phase</label><select v-model="filtrePhase"><option value="">Toutes</option><option v-for="ph in phasesListe" :key="ph" :value="ph">{{ ph }}</option></select></div>
        <div class="f"><label>Équipement</label><select v-model="filtreMachine"><option value="">Tous</option><option v-for="m in machinesListe" :key="m" :value="m">{{ m }}</option></select></div>
        <button v-if="personnesFiltrees.length && formations.length" class="btn" style="margin-left:auto" @click="exporterPDF">📄 Exporter la matrice (PDF)</button>
      </div>

      <div class="kpis">
        <div class="kpi" :class="tauxFormationGlobal != null && tauxFormationGlobal >= 90 ? 'good' : (tauxFormationGlobal != null && tauxFormationGlobal < 60 ? 'bad' : 'warn')"><div class="kv">{{ tauxFormationGlobal != null ? tauxFormationGlobal.toFixed(0) + '%' : '—' }}</div><div class="kl">Taux de formation</div></div>
        <div class="kpi good"><div class="kv">{{ nbQualifies }}/{{ personnesFiltrees.length }}</div><div class="kl">Personnel qualifié</div></div>
        <div class="kpi"><div class="kv">{{ personnesFiltrees.length }}</div><div class="kl">Personnes</div></div>
        <div class="kpi good"><div class="kv">{{ nbValides }}</div><div class="kl">Qualifications valides</div></div>
        <div class="kpi warn"><div class="kv">{{ nbBientot }}</div><div class="kl">À recycler (&lt; 60 j)</div></div>
        <div class="kpi bad"><div class="kv">{{ nbExpire }}</div><div class="kl">Expirées / non acquis</div></div>
        <div class="kpi bad"><div class="kv">{{ nbEcarts }}</div><div class="kl">Écarts critiques</div></div>
      </div>

      <div v-if="personnesFiltrees.length" class="kpi-charts">
        <div class="kc">
          <div class="kc-t">Taux de formation global</div>
          <svg viewBox="0 0 42 42" class="donut" role="img">
            <circle class="d-bg" cx="21" cy="21" r="15.915" />
            <g transform="rotate(-90 21 21)">
              <circle v-if="tauxDonut" class="d-seg" cx="21" cy="21" r="15.915" :stroke="tauxDonut.col" :stroke-dasharray="tauxDonut.dash" stroke-dashoffset="0" />
            </g>
            <text x="21" y="22" class="d-val" :style="{ fill: tauxDonut ? tauxDonut.col : '#94a3b8' }">{{ tauxDonut ? tauxDonut.pct.toFixed(0) + '%' : '—' }}</text>
            <text x="21" y="27" class="d-sub">formé</text>
          </svg>
          <div class="kc-leg"><span class="lg"><i style="background:#16a34a"></i>≥ 90 %</span><span class="lg"><i style="background:#d97706"></i>60–90 %</span><span class="lg"><i style="background:#dc2626"></i>&lt; 60 %</span></div>
        </div>

        <div class="kc">
          <div class="kc-t">Personnel qualifié</div>
          <svg viewBox="0 0 42 42" class="donut" role="img">
            <circle class="d-bg" cx="21" cy="21" r="15.915" />
            <g transform="rotate(-90 21 21)">
              <circle class="d-seg" cx="21" cy="21" r="15.915" stroke="#0d9488" :stroke-dasharray="qualifDonut.dash" stroke-dashoffset="0" />
            </g>
            <text x="21" y="21.5" class="d-val">{{ qualifDonut.q }}</text>
            <text x="21" y="27" class="d-sub">/ {{ qualifDonut.tot }} pers.</text>
          </svg>
          <div class="kc-leg"><span class="lg"><i style="background:#0d9488"></i>Qualifiés {{ qualifDonut.q }}</span><span class="lg"><i style="background:#e2e8f0"></i>Reste {{ qualifDonut.nonQ }}</span></div>
        </div>

        <div class="kc">
          <div class="kc-t">Répartition des qualifications</div>
          <svg viewBox="0 0 42 42" class="donut" role="img">
            <circle class="d-bg" cx="21" cy="21" r="15.915" />
            <g transform="rotate(-90 21 21)">
              <circle v-for="s in repDonut" :key="s.k" class="d-seg" cx="21" cy="21" r="15.915" :stroke="s.col" :stroke-dasharray="s.dash" :stroke-dashoffset="s.off" />
            </g>
            <text x="21" y="21.5" class="d-val">{{ repTotal }}</text>
            <text x="21" y="27" class="d-sub">requises</text>
          </svg>
          <div class="kc-leg">
            <span class="lg"><i style="background:#16a34a"></i>Valides {{ repartition.valide }}</span>
            <span class="lg"><i style="background:#d97706"></i>À recycler {{ repartition.bientot }}</span>
            <span class="lg"><i style="background:#dc2626"></i>Expirées {{ repartition.expire }}</span>
            <span class="lg"><i style="background:#991b1b"></i>Manquantes {{ repartition.manquant }}</span>
          </div>
        </div>
      </div>

      <div class="tabs2">
        <button :class="{ on: vue === 'matrice' }" @click="vue = 'matrice'">Matrice</button>
        <button :class="{ on: vue === 'planifier' }" @click="vue = 'planifier'">À planifier<span v-if="aPlanifier.length" class="tb">{{ aPlanifier.length }}</span></button>
        <button :class="{ on: vue === 'personne' }" @click="vue = 'personne'">Par personne</button>
        <button :class="{ on: vue === 'stats' }" @click="vue = 'stats'">Statistiques</button>
      </div>

      <div v-if="vue === 'planifier'">
      <h3 class="sec-titre">À planifier — expiré ou bientôt</h3>
      <div v-if="!aPlanifier.length" class="empty-sm">Aucune formation à recycler 🎉</div>
      <table v-else class="form-tbl">
        <thead><tr><th>Personne</th><th>Formation</th><th>Date</th><th>Expiration</th><th>État</th><th class="r">Action</th></tr></thead>
        <tbody>
          <tr v-for="e in aPlanifier" :key="e.id" class="row-ko">
            <td class="nom">{{ e.personneNom }}</td><td>{{ e.formationNom }}</td><td>{{ e.date_formation }}</td><td>{{ e.expiration || '—' }}</td>
            <td><span class="etat" :class="'e-' + e.cell">{{ etatTxt(e.cell) }}</span></td>
            <td class="r"><button class="btn-plan" @click="planifier(e.formation_id)" title="Planifier une session pour cette formation (toutes les personnes concernées)">📅 Planifier</button></td>
          </tr>
        </tbody>
      </table>

      </div>

      <div v-if="vue === 'personne'">
      <h3 class="sec-titre">Taux de formation par personne</h3>
      <p class="hint">Basé sur les formations <b>requises</b> de chaque fonction (définies dans « Exigences par fonction »). Trié des plus à risque en premier.</p>
      <p class="hint">Clique sur une personne pour voir le détail : formations acquises, à renouveler, expirées et manquantes.</p>
      <div class="pers-srch"><input v-model="recherchePers" type="search" placeholder="Rechercher une personne (nom, fonction)…" /><span v-if="recherchePers" class="pers-srch-n">{{ tauxParPersonneRech.length }} / {{ tauxParPersonne.length }}</span></div>
      <div v-if="!tauxParPersonne.length" class="empty-sm">Aucune personne pour ce filtre.</div>
      <div v-else-if="!tauxParPersonneRech.length" class="empty-sm">Aucune personne ne correspond à « {{ recherchePers }} ».</div>
      <table v-else class="form-tbl">
        <thead><tr><th>Personne</th><th>Fonction</th><th class="c">Recrutement</th><th class="r">Validées / Requises</th><th class="c">Formé</th><th class="c">À renouveler</th><th class="c">Expiré</th><th class="c">Manquant</th><th class="tx">Taux</th></tr></thead>
        <tbody>
          <template v-for="t in tauxParPersonneRech" :key="t.id">
            <tr class="pp-row" :class="{ open: persOuvert === t.id }" @click="persOuvert = persOuvert === t.id ? null : t.id" title="Voir le détail des qualifications">
              <td class="nom"><span class="pp-caret">{{ persOuvert === t.id ? '▾' : '▸' }}</span>{{ t.nom }}</td>
              <td>{{ t.fonction || '—' }}</td>
              <td class="c">{{ fmtDate(t.date_recrutement) }}</td>
              <td class="r">{{ t.requises ? t.valides + ' / ' + t.requises : '—' }}</td>
              <td class="c"><span class="pp-n ok">{{ t.valides }}</span></td>
              <td class="c"><span v-if="t.bientot" class="pp-n warn">{{ t.bientot }}</span><span v-else class="pp-z">—</span></td>
              <td class="c"><span v-if="t.expireN" class="pp-n bad">{{ t.expireN }}</span><span v-else class="pp-z">—</span></td>
              <td class="c"><span v-if="t.manquant" class="pp-n miss">{{ t.manquant }}</span><span v-else class="pp-z">—</span></td>
              <td class="tx"><div v-if="t.taux != null" class="bar"><div class="bar-fill" :class="barCls(t.taux)" :style="{ width: t.taux + '%' }"></div><span class="bar-txt">{{ t.taux.toFixed(0) }}%</span></div><span v-else class="no-req">pas d'exigence</span></td>
            </tr>
            <tr v-if="persOuvert === t.id" class="pp-detail">
              <td colspan="9">
                <div v-if="!detailPersonne(personneById[t.id]).length" class="empty-sm">Aucune formation requise ni enregistrée pour cette personne.</div>
                <table v-else class="pp-dtbl">
                  <thead><tr><th>Formation</th><th>Statut</th><th>Dernière formation</th><th>Expiration</th><th>Exigence</th></tr></thead>
                  <tbody>
                    <tr v-for="d in detailPersonne(personneById[t.id])" :key="d.formationNom + d.requis">
                      <td class="pp-dn">{{ d.formationNom }}</td>
                      <td><span class="et" :class="'et-' + d.statut">{{ etatTxt(d.statut) }}</span></td>
                      <td>{{ d.date || '—' }}</td>
                      <td>{{ d.expiration || (d.date ? 'permanent' : '—') }}</td>
                      <td><span class="pp-req" :class="d.requis ? 'req' : 'sup'">{{ d.requis ? 'Requise' : 'Supplémentaire' }}</span></td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      </div>

      <div v-if="vue === 'stats'">
      <h3 class="sec-titre">Répartition des qualifications requises</h3>
      <div v-if="!repTotal" class="empty-sm">Aucune formation requise (définis les exigences par fonction).</div>
      <div v-else class="repart">
        <div class="rp-bar">
          <div v-if="repartition.valide" class="rp-seg v" :style="{ width: (repartition.valide / repTotal * 100) + '%' }" :title="'Valides : ' + repartition.valide"></div>
          <div v-if="repartition.bientot" class="rp-seg b" :style="{ width: (repartition.bientot / repTotal * 100) + '%' }" :title="'À recycler : ' + repartition.bientot"></div>
          <div v-if="repartition.expire" class="rp-seg e" :style="{ width: (repartition.expire / repTotal * 100) + '%' }" :title="'Expirées : ' + repartition.expire"></div>
          <div v-if="repartition.manquant" class="rp-seg m" :style="{ width: (repartition.manquant / repTotal * 100) + '%' }" :title="'Manquantes : ' + repartition.manquant"></div>
        </div>
        <div class="rp-leg">
          <span class="lg"><i class="v"></i>Valides <b>{{ repartition.valide }}</b></span>
          <span class="lg"><i class="b"></i>À recycler <b>{{ repartition.bientot }}</b></span>
          <span class="lg"><i class="e"></i>Expirées <b>{{ repartition.expire }}</b></span>
          <span class="lg"><i class="m"></i>Manquantes <b>{{ repartition.manquant }}</b></span>
        </div>
      </div>

      <h3 class="sec-titre">Taux par formation</h3>
      <div v-if="!tauxParFormation.length" class="empty-sm">Aucune formation requise.</div>
      <table v-else class="form-tbl">
        <thead><tr><th>Formation</th><th>Code SOP</th><th class="r">Validées / Requises</th><th class="tx">Taux</th></tr></thead>
        <tbody>
          <tr v-for="f in tauxParFormation" :key="f.id">
            <td class="nom">{{ f.nom }}</td>
            <td><span v-if="f.code_sop" class="sop">{{ f.code_sop }}</span><span v-else class="pp-z">—</span></td>
            <td class="r">{{ f.val }} / {{ f.req }}</td>
            <td class="tx"><div class="bar"><div class="bar-fill" :class="barCls(f.taux)" :style="{ width: f.taux + '%' }"></div><span class="bar-txt">{{ f.taux.toFixed(0) }}%</span></div></td>
          </tr>
        </tbody>
      </table>

      <h3 class="sec-titre">Taux par périmètre</h3>
      <div v-if="!tauxParPerimetre.length" class="empty-sm">Aucune donnée.</div>
      <table v-else class="form-tbl">
        <thead><tr><th>Périmètre</th><th class="r">Validées / Requises</th><th class="tx">Taux</th></tr></thead>
        <tbody>
          <tr v-for="g in tauxParPerimetre" :key="g.nom">
            <td class="nom">{{ g.nom }}</td>
            <td class="r">{{ g.val }} / {{ g.req }}</td>
            <td class="tx"><div v-if="g.taux != null" class="bar"><div class="bar-fill" :class="barCls(g.taux)" :style="{ width: g.taux + '%' }"></div><span class="bar-txt">{{ g.taux.toFixed(0) }}%</span></div><span v-else>—</span></td>
          </tr>
        </tbody>
      </table>

      <h3 class="sec-titre">Évolution du taux de formation (12 mois)</h3>
      <div v-if="!evoChart" class="empty-sm">Pas assez d'historique pour tracer l'évolution.</div>
      <div v-else class="chart-wrap">
        <svg :viewBox="'0 0 ' + evoChart.W + ' ' + evoChart.H" class="evo" preserveAspectRatio="xMidYMid meet">
          <line :x1="evoChart.mL" :y1="evoChart.y0" :x2="evoChart.W - evoChart.mR" :y2="evoChart.y0" class="grid" />
          <line :x1="evoChart.mL" :y1="evoChart.y50" :x2="evoChart.W - evoChart.mR" :y2="evoChart.y50" class="grid" />
          <line :x1="evoChart.mL" :y1="evoChart.y100" :x2="evoChart.W - evoChart.mR" :y2="evoChart.y100" class="grid" />
          <text :x="evoChart.mL - 5" :y="evoChart.y0 + 3" class="ax">0</text>
          <text :x="evoChart.mL - 5" :y="evoChart.y50 + 3" class="ax">50</text>
          <text :x="evoChart.mL - 5" :y="evoChart.y100 + 3" class="ax">100</text>
          <path :d="evoChart.path" class="evo-line" />
          <g v-for="(g, i) in evoChart.geom" :key="i">
            <circle v-if="g.y != null" :cx="g.x" :cy="g.y" r="3.5" class="evo-pt"><title>{{ g.label }} : {{ g.taux.toFixed(0) }}%</title></circle>
            <text :x="g.x" :y="evoChart.H - evoChart.mB + 14" class="xl">{{ g.label }}</text>
          </g>
        </svg>
      </div>

      </div>

      <div v-if="vue === 'matrice'">
      <h3 class="sec-titre">Matrice de qualification</h3>
      <div v-if="!personnesFiltrees.length || !formations.length" class="empty-sm">Aucune personne (pour ce filtre) ou aucune formation.</div>
      <template v-else>
        <div class="mat-wrap">
          <table class="mat-tbl">
            <thead><tr><th class="sticky-l">Personne</th><th v-for="f in formations" :key="f.id" :title="f.nom">{{ abrev(f.nom) }}</th></tr></thead>
            <tbody>
              <tr v-for="p in personnesFiltrees" :key="p.id">
                <td class="sticky-l nom">{{ p.nom }}</td>
                <td v-for="f in formations" :key="f.id" class="cell">
                  <span class="pt" :class="'e-' + cellStatut(p.id, f.id)" :title="cellTitre(p, f)">{{ cellIcon(cellStatut(p.id, f.id)) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="leg">
          <span class="lg"><span class="pt e-valide">✓</span>Valide</span>
          <span class="lg"><span class="pt e-bientot">⚠</span>Expire bientôt</span>
          <span class="lg"><span class="pt e-expire">✗</span>Expiré / non acquis</span>
          <span class="lg"><span class="pt e-manquant">!</span>Manquant (requis)</span>
          <span class="lg"><span class="pt e-absent">—</span>Non requis</span>
        </div>
      </template>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'

const personnes = ref([])
const formations = ref([])
const enregistrements = ref([])
const requises = ref([])
const filtreAtelier = ref('')
const filtreEquipe = ref('')
const filtreFonction = ref('')
const filtrePhase = ref('')
const filtreMachine = ref('')
const vue = ref('matrice')
const recherchePers = ref('')
const normP = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const erreur = ref('')
const router = useRouter()

async function charger() {
  const rp = await supabase.from('organigramme').select('id, nom, matricule, fonction, atelier_id, equipe, equipement, machine, date_recrutement').eq('actif', true).order('nom')
  if (!rp.error) personnes.value = rp.data || []
  const rf = await supabase.from('formations').select('*').eq('actif', true).order('ordre')
  if (!rf.error) formations.value = rf.data || []
  const re = await supabase.from('formation_enregistrements').select('*')
  if (re.error) { erreur.value = re.error.message; return }
  enregistrements.value = re.data || []
  const rq = await supabase.from('formation_requise').select('*')
  if (!rq.error) requises.value = rq.data || []
}
onMounted(charger)

const ateliersListe = computed(() => [...new Set(personnes.value.map(p => p.atelier_id).filter(Boolean))].sort())
const perimCount = computed(() => { const m = {}; for (const p of personnes.value) { const k = p.atelier_id; if (k) m[k] = (m[k] || 0) + 1 } return m })
const equipesListe = computed(() => [...new Set(personnes.value.map(p => p.equipe).filter(Boolean))].sort())
const fonctionsListe = computed(() => [...new Set(personnes.value.map(p => p.fonction).filter(Boolean))].sort())
const phasesListe = computed(() => [...new Set(personnes.value.flatMap(p => (p.equipement || '').split(',').map(x => x.trim()).filter(Boolean)))].sort())
const machinesListe = computed(() => [...new Set(personnes.value.flatMap(p => (p.machine || '').split(',').map(x => x.trim()).filter(Boolean)))].sort())
const personnesFiltrees = computed(() => personnes.value.filter(p => {
  if (filtreAtelier.value && (p.atelier_id || '') !== filtreAtelier.value) return false
  if (filtreEquipe.value && (p.equipe || '') !== filtreEquipe.value) return false
  if (filtreFonction.value && (p.fonction || '') !== filtreFonction.value) return false
  if (filtrePhase.value && !(p.equipement || '').split(',').map(x => x.trim()).includes(filtrePhase.value)) return false
  if (filtreMachine.value && !(p.machine || '').split(',').map(x => x.trim()).includes(filtreMachine.value)) return false
  return true
}))
const persIds = computed(() => new Set(personnesFiltrees.value.map(p => p.id)))

const formationById = computed(() => { const m = {}; for (const f of formations.value) m[f.id] = f; return m })
const personneById = computed(() => { const m = {}; for (const p of personnes.value) m[p.id] = p; return m })
const requisParFonction = computed(() => { const m = {}; for (const r of requises.value) { (m[r.fonction] = m[r.fonction] || new Set()).add(r.formation_id) } return m })
function addMonths(dateStr, m) { const d = new Date(dateStr + 'T00:00:00'); d.setMonth(d.getMonth() + m); return d.toISOString().slice(0, 10) }
function fmtDate(d) { if (!d) return '—'; const t = new Date(String(d).slice(0, 10) + 'T00:00:00'); return isNaN(t) ? String(d) : t.toLocaleDateString('fr-FR') }
const today = new Date().toISOString().slice(0, 10)
const dans60 = (() => { const d = new Date(today + 'T00:00:00'); d.setDate(d.getDate() + 60); return d.toISOString().slice(0, 10) })()

const enrEnrichis = computed(() => enregistrements.value.map(e => {
  const f = formationById.value[e.formation_id]
  const exp = (f && f.validite_mois && e.date_formation) ? addMonths(e.date_formation, f.validite_mois) : null
  let cell = 'valide'
  if (e.resultat === 'non acquis') cell = 'expire'
  else if (exp) cell = exp < today ? 'expire' : (exp <= dans60 ? 'bientot' : 'valide')
  return { ...e, expiration: exp, cell }
}))
const latestByKey = computed(() => {
  const m = {}
  for (const e of enrEnrichis.value) {
    const k = e.personne_id + '|' + e.formation_id
    if (!m[k] || String(e.date_formation) > String(m[k].date_formation)) m[k] = e
  }
  return m
})
function cellStatut(pid, fid) { const e = latestByKey.value[pid + '|' + fid]; if (e) return e.cell; const p = personneById.value[pid]; const req = p && requisParFonction.value[p.fonction]; return (req && req.has(fid)) ? 'manquant' : 'absent' }
function cellIcon(st) { return st === 'valide' ? '✓' : st === 'bientot' ? '⚠' : st === 'expire' ? '✗' : st === 'manquant' ? '!' : '—' }
function etatTxt(st) { return st === 'valide' ? '✓ Valide' : st === 'bientot' ? '⚠ Expire bientôt' : st === 'expire' ? '✗ Expiré' : st === 'manquant' ? '! Manquant (requis)' : 'Non formé' }
function cellTitre(p, f) {
  const e = latestByKey.value[p.id + '|' + f.id]
  if (!e) return p.nom + ' — ' + f.nom + ' : non formé'
  return p.nom + ' — ' + f.nom + '\nFormé le ' + e.date_formation + (e.expiration ? ' · expire le ' + e.expiration : ' · permanent') + (e.resultat === 'non acquis' ? ' · NON ACQUIS' : '')
}

const cellsListe = computed(() => Object.values(latestByKey.value).filter(e => persIds.value.has(e.personne_id)))
const nbValides = computed(() => cellsListe.value.filter(e => e.cell === 'valide').length)
const nbBientot = computed(() => cellsListe.value.filter(e => e.cell === 'bientot').length)
const nbExpire = computed(() => cellsListe.value.filter(e => e.cell === 'expire').length)
const manquants = computed(() => {
  const out = []
  for (const p of personnesFiltrees.value) {
    const req = requisParFonction.value[p.fonction]; if (!req) continue
    for (const fid of req) { if (cellStatut(p.id, fid) === 'manquant') out.push({ id: 'm' + p.id + '_' + fid, personne_id: p.id, formation_id: fid, personneNom: p.nom, formationNom: (formationById.value[fid] || {}).nom || '', date_formation: '—', expiration: null, cell: 'manquant' }) }
  }
  return out
})
const nbEcarts = computed(() => {
  let n = 0
  for (const p of personnesFiltrees.value) { const req = requisParFonction.value[p.fonction]; if (!req) continue; for (const fid of req) { const st = cellStatut(p.id, fid); if (st === 'manquant' || st === 'expire') n++ } }
  return n
})
const aPlanifier = computed(() => {
  const rec = cellsListe.value.filter(e => e.cell === 'expire' || e.cell === 'bientot').map(e => ({ ...e, personneNom: (personneById.value[e.personne_id] || {}).nom || '(supprimé)', formationNom: (formationById.value[e.formation_id] || {}).nom || '(supprimée)' }))
  const ord = { manquant: 0, expire: 1, bientot: 2 }
  return [...manquants.value, ...rec].sort((a, b) => (ord[a.cell] - ord[b.cell]) || String(a.expiration || '').localeCompare(String(b.expiration || '')))
})

const tauxParPersonne = computed(() => personnesFiltrees.value.map(p => {
  const req = requisParFonction.value[p.fonction]
  if (!req || !req.size) return { id: p.id, nom: p.nom, fonction: p.fonction, date_recrutement: p.date_recrutement, requises: 0, valides: 0, bientot: 0, expireN: 0, manquant: 0, taux: null }
  let valides = 0, bientot = 0, expireN = 0, manquant = 0
  for (const fid of req) { const st = cellStatut(p.id, fid); if (st === 'valide') valides++; else if (st === 'bientot') bientot++; else if (st === 'expire') expireN++; else if (st === 'manquant') manquant++ }
  return { id: p.id, nom: p.nom, fonction: p.fonction, date_recrutement: p.date_recrutement, requises: req.size, valides, bientot, expireN, manquant, taux: valides / req.size * 100 }
}).sort((a, b) => (a.taux == null ? 1000 : a.taux) - (b.taux == null ? 1000 : b.taux) || (a.nom || '').localeCompare(b.nom || '')))
const tauxParPersonneRech = computed(() => {
  const q = normP(recherchePers.value.trim())
  if (!q) return tauxParPersonne.value
  return tauxParPersonne.value.filter(t => normP(t.nom).includes(q) || normP(t.fonction).includes(q))
})
// Détail des formations d'une personne (requises + supplémentaires), classé écarts d'abord
const persOuvert = ref(null)
function detailPersonne(p) {
  if (!p) return []
  const req = requisParFonction.value[p.fonction] || new Set()
  const rows = []
  for (const fid of req) {
    const f = formationById.value[fid]; if (!f) continue
    const e = latestByKey.value[p.id + '|' + fid]
    rows.push({ formationNom: f.nom, statut: cellStatut(p.id, fid), requis: true, date: e ? e.date_formation : null, expiration: e ? e.expiration : null })
  }
  for (const e of enrEnrichis.value) {
    if (e.personne_id !== p.id || req.has(e.formation_id)) continue
    if (latestByKey.value[p.id + '|' + e.formation_id] !== e) continue
    const f = formationById.value[e.formation_id]; if (!f) continue
    rows.push({ formationNom: f.nom, statut: e.cell, requis: false, date: e.date_formation, expiration: e.expiration })
  }
  const ord = { manquant: 0, expire: 1, bientot: 2, valide: 3, absent: 4 }
  return rows.sort((a, b) => (ord[a.statut] - ord[b.statut]) || a.formationNom.localeCompare(b.formationNom))
}
const tauxFormationGlobal = computed(() => { let req = 0, val = 0; for (const t of tauxParPersonne.value) { req += t.requises; val += t.valides } return req ? val / req * 100 : null })
const nbQualifies = computed(() => tauxParPersonne.value.filter(t => t.requises > 0 && t.valides === t.requises).length)
function barCls(t) { return t >= 100 ? 'ok' : t >= 50 ? 'mid' : 'low' }
const repartition = computed(() => {
  const r = { valide: 0, bientot: 0, expire: 0, manquant: 0 }
  for (const p of personnesFiltrees.value) { const req = requisParFonction.value[p.fonction]; if (!req) continue; for (const fid of req) { const st = cellStatut(p.id, fid); if (r[st] != null) r[st]++ } }
  return r
})
const repTotal = computed(() => { const r = repartition.value; return r.valide + r.bientot + r.expire + r.manquant })
// --- Graphiques KPI (donuts) ---
const repDonut = computed(() => {
  const r = repartition.value, tot = repTotal.value
  const cols = { valide: '#16a34a', bientot: '#d97706', expire: '#dc2626', manquant: '#991b1b' }
  const segs = []; let acc = 0
  for (const k of ['valide', 'bientot', 'expire', 'manquant']) {
    const v = r[k]; if (!tot || !v) continue
    const pct = v / tot * 100
    segs.push({ k, v, col: cols[k], dash: pct.toFixed(2) + ' ' + (100 - pct).toFixed(2), off: (-acc).toFixed(2) })
    acc += pct
  }
  return segs
})
const qualifDonut = computed(() => {
  const tot = personnesFiltrees.value.length, q = nbQualifies.value
  const pct = tot ? q / tot * 100 : 0
  return { tot, q, nonQ: tot - q, dash: pct.toFixed(2) + ' ' + (100 - pct).toFixed(2) }
})
const tauxDonut = computed(() => {
  const t = tauxFormationGlobal.value; if (t == null) return null
  return { pct: t, col: t >= 90 ? '#16a34a' : (t < 60 ? '#dc2626' : '#d97706'), dash: t.toFixed(2) + ' ' + (100 - t).toFixed(2) }
})
const tauxParFormation = computed(() => formations.value.map(f => {
  let req = 0, val = 0
  for (const p of personnesFiltrees.value) { const r = requisParFonction.value[p.fonction]; if (r && r.has(f.id)) { req++; if (cellStatut(p.id, f.id) === 'valide') val++ } }
  return { id: f.id, nom: f.nom, code_sop: f.code_sop || '', req, val, taux: req ? val / req * 100 : null }
}).filter(f => f.req > 0).sort((a, b) => a.taux - b.taux))
const tauxParPerimetre = computed(() => {
  const g = {}
  for (const p of personnesFiltrees.value) {
    const req = requisParFonction.value[p.fonction]; if (!req) continue
    const per = p.atelier_id || '(sans périmètre)'
    let val = 0; for (const fid of req) if (cellStatut(p.id, fid) === 'valide') val++
    if (!g[per]) g[per] = { nom: per, req: 0, val: 0 }
    g[per].req += req.size; g[per].val += val
  }
  return Object.values(g).map(x => ({ ...x, taux: x.req ? x.val / x.req * 100 : null })).sort((a, b) => (a.taux || 0) - (b.taux || 0))
})
function moisLabel(d) { return d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }) }
function estValideA(pid, fid, dateStr) {
  const recs = enregistrements.value.filter(e => e.personne_id === pid && e.formation_id === fid && e.resultat !== 'non acquis' && String(e.date_formation) <= dateStr)
  if (!recs.length) return false
  const latest = recs.reduce((a, b) => String(a.date_formation) > String(b.date_formation) ? a : b)
  const f = formationById.value[fid]
  if (!f || !f.validite_mois) return true
  return addMonths(latest.date_formation, f.validite_mois) >= dateStr
}
const evolution = computed(() => {
  const pts = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
    const ds = d.toISOString().slice(0, 10)
    let req = 0, val = 0
    for (const p of personnesFiltrees.value) {
      const reqSet = requisParFonction.value[p.fonction]; if (!reqSet) continue
      for (const fid of reqSet) { req++; if (estValideA(p.id, fid, ds)) val++ }
    }
    pts.push({ label: moisLabel(d), taux: req ? val / req * 100 : null })
  }
  return pts
})
const evoChart = computed(() => {
  const n = evolution.value.length
  if (evolution.value.filter(p => p.taux != null).length < 2) return null
  const W = 760, H = 220, mL = 38, mR = 14, mT = 14, mB = 38
  const xx = (i) => mL + i * (W - mL - mR) / (n - 1)
  const yy = (v) => mT + (100 - v) / 100 * (H - mT - mB)
  const geom = evolution.value.map((p, i) => ({ x: xx(i), y: p.taux != null ? yy(p.taux) : null, taux: p.taux, label: p.label }))
  const valid = geom.filter(g => g.y != null)
  const path = valid.map((g, i) => (i ? 'L' : 'M') + g.x.toFixed(1) + ' ' + g.y.toFixed(1)).join(' ')
  return { W, H, mL, mR, mT, mB, geom, path, y0: yy(0), y50: yy(50), y100: yy(100) }
})
function abrev(nom) { const m = String(nom).match(/\(([^)]+)\)/); if (m) return m[1]; return String(nom).split(/\s+/)[0] }
function planifier(fid) { const ids = [...new Set(aPlanifier.value.filter(e => e.formation_id === fid).map(e => e.personne_id))]; router.push({ path: '/formations-planning', query: { formation: String(fid), personnes: ids.join(',') } }) }

function exporterPDF() {
  const now = new Date().toLocaleString('fr-FR')
  const filt = [filtreAtelier.value, filtreEquipe.value].filter(Boolean).join(' · ') || 'Tout le personnel'
  const ic = (st) => st === 'valide' ? '✓' : st === 'bientot' ? '⚠' : st === 'expire' ? '✗' : st === 'manquant' ? '!' : '—'
  const head = '<th class="nm">Personne</th>' + formations.value.map(f => `<th>${abrev(f.nom)}</th>`).join('')
  const rows = personnesFiltrees.value.map(p => {
    const cells = formations.value.map(f => { const st = cellStatut(p.id, f.id); return `<td class="c c-${st}">${ic(st)}</td>` }).join('')
    return `<tr><td class="nm">${p.nom}</td>${cells}</tr>`
  }).join('')
  const plan = aPlanifier.value.length
    ? aPlanifier.value.map(e => `<tr><td>${e.personneNom}</td><td>${e.formationNom}</td><td>${e.date_formation}</td><td>${e.expiration || '—'}</td><td>${etatTxt(e.cell)}</td></tr>`).join('')
    : '<tr><td colspan="5" style="text-align:center;color:#16a34a">Aucune formation à recycler</td></tr>'
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Matrice de qualification</title>
<style>
*{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1b2733;margin:24px;font-size:11px}
h1{font-size:19px;margin:0 0 2px;color:#0d9488} .sub{color:#64748b;font-size:12px;margin:0 0 14px}
.meta{display:flex;gap:22px;flex-wrap:wrap;font-size:11px;color:#475569;border-top:2px solid #0d9488;border-bottom:1px solid #e2e8f0;padding:8px 0;margin-bottom:16px} .meta b{color:#0f172a}
.kp{display:flex;gap:10px;margin:0 0 16px} .k{flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:8px;text-align:center} .k .v{font-size:17px;font-weight:800} .k .l{font-size:9px;text-transform:uppercase;color:#94a3b8;font-weight:700}
h2{font-size:13px;margin:16px 0 6px;border-left:4px solid #0d9488;padding-left:8px}
table{border-collapse:collapse;font-size:10px;margin-bottom:10px} table.plan{width:100%}
th{background:#f0fdfa;color:#0f766e;padding:5px 6px;border:1px solid #e2e8f0;font-size:9px;text-transform:uppercase}
td{padding:4px 6px;border:1px solid #f1f5f9} td.nm,th.nm{text-align:left;font-weight:700;color:#0f172a}
td.c{text-align:center;font-weight:800} .c-valide{background:#dcfce7;color:#166534} .c-bientot{background:#fef3c7;color:#92400e} .c-expire{background:#fee2e2;color:#b91c1c} .c-manquant{background:#fecaca;color:#991b1b} .c-absent{background:#f8fafc;color:#cbd5e1}
.foot{margin-top:18px;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px}
@media print{body{margin:10mm}}
</style></head><body>
<h1>Matrice de Qualification — Personnel</h1><p class="sub">${filt}</p>
<div class="meta"><span>Personnes : <b>${personnesFiltrees.value.length}</b></span><span>Valides : <b>${nbValides.value}</b></span><span>À recycler : <b>${nbBientot.value}</b></span><span>Expirées : <b>${nbExpire.value}</b></span><span>Édité le <b>${now}</b></span></div>
<div class="kp"><div class="k"><div class="v">${personnesFiltrees.value.length}</div><div class="l">Personnes</div></div><div class="k"><div class="v">${nbValides.value}</div><div class="l">Valides</div></div><div class="k"><div class="v">${nbBientot.value}</div><div class="l">À recycler</div></div><div class="k"><div class="v">${nbExpire.value}</div><div class="l">Expirées</div></div></div>
<h2>À planifier</h2>
<table class="plan"><thead><tr><th class="nm">Personne</th><th>Formation</th><th>Date</th><th>Expiration</th><th>État</th></tr></thead><tbody>${plan}</tbody></table>
<h2>Matrice (✓ valide · ⚠ expire bientôt · ✗ expiré/non acquis · — non formé)</h2>
<table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>
<div class="foot">Document généré par ProdTrack — Module Formation & Qualification.</div>
</body></html>`
  const w = window.open('', '_blank')
  if (!w) { erreur.value = 'Autorise les pop-ups pour exporter en PDF.'; return }
  w.document.write(html); w.document.close(); w.focus()
  setTimeout(() => { try { w.print() } catch (e) {} }, 350)
}
</script>

<style scoped>
.form-page { color: #1b2733; zoom: 0.7; }
.alert { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 10px 14px; border-radius: 8px; margin: 0 0 14px; }
.alerte-ech { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; padding: 11px 15px; border-radius: 10px; margin: 0 0 16px; font-size: 13px; font-weight: 600; }
.alerte-ech.crit { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }
.alerte-ech .sep { margin: 0 8px; opacity: .5; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 22px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.empty-sm { color: #64748b; font-size: 13px; padding: 10px 2px; }
.btn { background: #0d9488; color: #fff; border: 0; padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; }

.mat-bar { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; margin-bottom: 16px; }
.mat-bar .f { display: flex; flex-direction: column; gap: 4px; }
.mat-bar label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; }
.mat-bar select { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; background: #fff; color: #1b2733; font-weight: 600; min-width: 160px; }

.perim-cards { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
.pc { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; min-width: 120px; max-width: 210px; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 12px; padding: 11px 14px; cursor: pointer; text-align: left; transition: border-color .12s, background .12s, box-shadow .12s; }
.pc:hover { border-color: #99f6e4; background: #f0fdfa; }
.pc.on { border-color: #0d9488; background: #f0fdfa; box-shadow: 0 0 0 2px rgba(13,148,136,.2); }
.pc-n { font-size: 22px; font-weight: 800; color: #0f172a; font-variant-numeric: tabular-nums; line-height: 1; }
.pc.on .pc-n { color: #0d9488; }
.pc-l { font-size: 12px; font-weight: 700; color: #475569; line-height: 1.25; }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-bottom: 20px; }
.kpi { background: #f8fafc; border: 1px solid #eef2f6; border-radius: 12px; padding: 14px; text-align: center; }
.kpi .kv { font-size: 24px; font-weight: 800; color: #0f172a; font-variant-numeric: tabular-nums; }
.kpi .kl { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #94a3b8; font-weight: 700; margin-top: 2px; }
.kpi.good .kv { color: #16a34a; } .kpi.warn .kv { color: #d97706; } .kpi.bad .kv { color: #dc2626; }
@media (max-width: 640px) { .kpis { grid-template-columns: repeat(2, 1fr); } }

.kpi-charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 14px; margin-bottom: 20px; }
.kc { background: #fcfcfd; border: 1px solid #eef2f6; border-radius: 12px; padding: 14px 14px 12px; display: flex; flex-direction: column; align-items: center; }
.kc-t { font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; color: #64748b; text-align: center; margin-bottom: 8px; min-height: 30px; display: flex; align-items: center; }
.donut { width: 140px; height: 140px; display: block; }
.donut .d-bg { fill: none; stroke: #eef2f6; stroke-width: 5; }
.donut .d-seg { fill: none; stroke-width: 5; stroke-linecap: butt; transition: stroke-dasharray .4s ease; }
.donut .d-val { fill: #0f172a; font-size: 9px; font-weight: 800; text-anchor: middle; font-variant-numeric: tabular-nums; }
.donut .d-sub { fill: #94a3b8; font-size: 3.3px; font-weight: 700; text-anchor: middle; text-transform: uppercase; letter-spacing: .05em; }
.kc-leg { display: flex; flex-wrap: wrap; gap: 6px 12px; justify-content: center; margin-top: 10px; }
.kc-leg .lg { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; color: #64748b; font-weight: 600; }
.kc-leg .lg i { width: 10px; height: 10px; border-radius: 3px; flex: none; }

.sec-titre { margin: 22px 0 8px; font-size: 15px; font-weight: 800; color: #0f172a; border-left: 4px solid #0d9488; padding-left: 9px; }
.form-tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.form-tbl th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; font-weight: 700; padding: 6px 10px; border-bottom: 2px solid #eef2f6; }
.form-tbl td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; }
.form-tbl td.nom { font-weight: 700; color: #0f172a; }
.form-tbl tr.row-ko { background: #fef2f2; }
.form-tbl td.tx, .form-tbl th.tx { min-width: 160px; }
.bar { position: relative; height: 18px; background: #f1f5f9; border-radius: 999px; overflow: hidden; }
.bar-fill { position: absolute; top: 0; left: 0; bottom: 0; border-radius: 999px; }
.bar-fill.ok { background: #16a34a; } .bar-fill.mid { background: #d97706; } .bar-fill.low { background: #dc2626; }
.form-tbl th.c, .form-tbl td.c { text-align: center; white-space: nowrap; }
.pp-row { cursor: pointer; }
.pp-row:hover > td { background: #f8fafc; }
.pp-row.open > td { background: #ecfeff; }
.pp-caret { display: inline-block; width: 14px; color: #0e7490; font-size: 11px; }
.pp-n { display: inline-block; min-width: 20px; padding: 1px 7px; border-radius: 999px; font-weight: 800; font-size: 12px; }
.pp-n.ok { background: #dcfce7; color: #166534; }
.pp-n.warn { background: #fef3c7; color: #92400e; }
.pp-n.bad { background: #fee2e2; color: #991b1b; }
.pp-n.miss { background: #e2e8f0; color: #475569; }
.pp-z { color: #cbd5e1; }
.pp-detail > td { background: #f8fafc; padding: 4px 10px 12px; }
.pp-dtbl { width: 100%; border-collapse: collapse; font-size: 12.5px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
.pp-dtbl th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .03em; color: #94a3b8; font-weight: 800; padding: 6px 9px; background: #f8fafc; border-bottom: 1px solid #eef2f6; }
.pp-dtbl td { padding: 6px 9px; border-bottom: 1px solid #f1f5f9; white-space: nowrap; }
.pp-dtbl td.pp-dn { font-weight: 600; color: #0f172a; white-space: normal; }
.et { font-size: 11px; font-weight: 800; padding: 1px 8px; border-radius: 999px; }
.et-valide { background: #dcfce7; color: #166534; }
.et-bientot { background: #fef3c7; color: #92400e; }
.et-expire { background: #fee2e2; color: #991b1b; }
.et-manquant { background: #e2e8f0; color: #475569; }
.et-absent { background: #f1f5f9; color: #94a3b8; }
.pp-req { font-size: 10.5px; font-weight: 700; padding: 1px 7px; border-radius: 5px; }
.pp-req.req { background: #eef2ff; color: #4338ca; }
.pp-req.sup { background: #f1f5f9; color: #64748b; }
.pers-srch { display: flex; align-items: center; gap: 10px; margin: 2px 0 12px; }
.pers-srch input { flex: 1; max-width: 420px; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font: inherit; font-size: 13px; }
.pers-srch-n { font-size: 12px; color: #94a3b8; font-weight: 700; }
.bar-txt { position: absolute; top: 0; right: 7px; line-height: 18px; font-size: 11px; font-weight: 800; color: #0f172a; }
.no-req { font-size: 11px; color: #94a3b8; font-style: italic; }
.sop { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; font-weight: 600; color: #475569; background: #f1f5f9; padding: 1px 7px; border-radius: 5px; }
.repart { margin-bottom: 4px; }
.rp-bar { display: flex; height: 26px; border-radius: 8px; overflow: hidden; background: #f1f5f9; }
.rp-seg { height: 100%; }
.rp-seg.v { background: #16a34a; } .rp-seg.b { background: #d97706; } .rp-seg.e { background: #dc2626; } .rp-seg.m { background: #991b1b; }
.rp-leg { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 8px; }
.rp-leg .lg { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #64748b; font-weight: 600; }
.rp-leg .lg i { width: 11px; height: 11px; border-radius: 3px; }
.rp-leg .lg i.v { background: #16a34a; } .rp-leg .lg i.b { background: #d97706; } .rp-leg .lg i.e { background: #dc2626; } .rp-leg .lg i.m { background: #991b1b; }
.chart-wrap { margin-top: 4px; }
.evo { width: 100%; height: auto; background: #fcfcfd; border: 1px solid #eef2f6; border-radius: 12px; }
.evo .grid { stroke: #e2e8f0; stroke-width: 1; stroke-dasharray: 3 4; }
.evo .ax { fill: #94a3b8; font-size: 10px; text-anchor: end; font-weight: 600; }
.evo .xl { fill: #94a3b8; font-size: 9px; text-anchor: middle; font-weight: 600; }
.evo .evo-line { fill: none; stroke: #0d9488; stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
.evo .evo-pt { fill: #0d9488; stroke: #fff; stroke-width: 1.5; }
.tabs2 { display: inline-flex; flex-wrap: wrap; gap: 4px; background: #f1f5f9; border-radius: 10px; padding: 4px; margin-bottom: 18px; }
.tabs2 button { border: 0; background: transparent; padding: 7px 14px; border-radius: 8px; font: inherit; font-size: 13px; font-weight: 700; color: #64748b; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.tabs2 button.on { background: #fff; color: #0d9488; box-shadow: 0 1px 2px rgba(16,24,40,.08); }
.tabs2 .tb { background: #dc2626; color: #fff; border-radius: 999px; font-size: 10px; padding: 1px 6px; font-weight: 800; }
.form-tbl td.r, .form-tbl th.r { text-align: right; }
.btn-plan { border: 1px solid #99f6e4; background: #f0fdfa; color: #0d9488; border-radius: 7px; padding: 4px 10px; font-size: 11px; font-weight: 700; cursor: pointer; white-space: nowrap; }
.btn-plan:hover { background: #ccfbf1; border-color: #5eead4; }

.mat-wrap { overflow-x: auto; border: 1px solid #eef2f6; border-radius: 10px; }
.mat-tbl { border-collapse: collapse; font-size: 12px; white-space: nowrap; }
.mat-tbl th { background: #f8fafc; color: #475569; font-size: 10px; font-weight: 800; padding: 8px 6px; border-bottom: 2px solid #e2e8f0; border-left: 1px solid #f1f5f9; text-align: center; max-width: 70px; overflow: hidden; text-overflow: ellipsis; }
.mat-tbl td { padding: 5px 6px; border-bottom: 1px solid #f1f5f9; border-left: 1px solid #f1f5f9; text-align: center; }
.sticky-l { position: sticky; left: 0; z-index: 2; background: #fff; text-align: left !important; min-width: 150px; box-shadow: 1px 0 0 #e2e8f0; }
.mat-tbl thead .sticky-l { background: #f8fafc; z-index: 3; }
.mat-tbl td.nom { font-weight: 700; color: #0f172a; font-size: 12px; }
.mat-tbl tbody tr:hover td { background: #f0fdfa; }
.mat-tbl tbody tr:hover .sticky-l { background: #f0fdfa; }
.pt { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 6px; font-weight: 800; font-size: 12px; cursor: default; }
.pt.e-valide { background: #dcfce7; color: #166534; }
.pt.e-bientot { background: #fef3c7; color: #92400e; }
.pt.e-expire { background: #fee2e2; color: #b91c1c; }
.pt.e-manquant { background: #fee2e2; color: #b91c1c; box-shadow: inset 0 0 0 1.5px #f87171; }
.pt.e-absent { background: #f1f5f9; color: #cbd5e1; }

.etat { font-size: 11px; font-weight: 800; padding: 2px 9px; border-radius: 999px; white-space: nowrap; }
.etat.e-valide { background: #dcfce7; color: #166534; }
.etat.e-bientot { background: #fef3c7; color: #92400e; }
.etat.e-expire { background: #fee2e2; color: #b91c1c; }
.etat.e-manquant { background: #fecaca; color: #991b1b; }
.leg { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 10px; padding-left: 2px; }
.leg .lg { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #64748b; font-weight: 600; }
</style>
