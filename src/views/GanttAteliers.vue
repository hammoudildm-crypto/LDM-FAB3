<!--
  GanttAteliers.vue — ProdTrack (LDM-FAB3)
  Planning Gantt des 11 ateliers de fabrication, pelliculage et conditionnement inclus.

  AUTONOME : aucun import hors `vue`. Le composant tourne tel quel avec son jeu de
  données de démonstration, donc avant le déploiement des vues SQL en attente
  (poids_lot_kg, champs_ratio_equipement, fix_date_fin_fab_pelliculage...).

  Branchement Supabase : passer une fonction au prop `loader` (voir bloc BRANCHEMENT
  en bas de fichier). Tant que `loader` est nul, la démo s'affiche avec un badge.
-->

<template>
  <section class="ga" :class="{ 'ga--demo': estDemo }">

    <!-- ══ Barre d'outils ══ -->
    <header class="ga__bar">
      <div class="ga__titre">
        <h2>Planning ateliers</h2>
        <span v-if="estDemo" class="ga__badge" title="Aucune source branchée : jeu de démonstration">
          Données de démonstration
        </span>
        <span v-else-if="chargement" class="ga__badge ga__badge--neutre">Chargement…</span>
        <span v-if="erreur" class="ga__badge ga__badge--erreur" :title="erreur">
          Source indisponible — démo affichée
        </span>
      </div>

      <div class="ga__outils">
        <input
          v-model="recherche"
          class="ga__champ"
          type="search"
          placeholder="Produit, lot ou n° OF"
          aria-label="Rechercher un ordre de fabrication"
        />

        <div class="ga__zoom" role="group" aria-label="Densité de la timeline">
          <button
            v-for="z in zooms"
            :key="z.cle"
            class="ga__zoomBtn"
            :class="{ 'est-actif': zoom === z.cle }"
            type="button"
            @click="zoom = z.cle"
          >{{ z.label }}</button>
        </div>

        <button class="ga__btn" type="button" @click="allerAujourdhui">Aujourd'hui</button>
        <button class="ga__btn" type="button" @click="exporterCsv">Exporter CSV</button>
      </div>
    </header>

    <!-- ══ Indicateurs ══ -->
    <div class="ga__kpis">
      <article class="ga__kpi">
        <span class="ga__kpiVal">{{ ordresFiltres.length }}</span>
        <span class="ga__kpiLib">OF planifiés</span>
      </article>
      <article class="ga__kpi">
        <span class="ga__kpiVal">{{ compteurStatut.en_cours }}</span>
        <span class="ga__kpiLib">en cours</span>
      </article>
      <article class="ga__kpi" :class="{ 'ga__kpi--alerte': compteurStatut.retard > 0 }">
        <span class="ga__kpiVal">{{ compteurStatut.retard }}</span>
        <span class="ga__kpiLib">en retard</span>
      </article>
      <article class="ga__kpi">
        <span class="ga__kpiVal">{{ occupationMoyenne }}<small>%</small></span>
        <span class="ga__kpiLib">occupation moyenne</span>
      </article>
    </div>

    <!-- ══ Filtres statut ══ -->
    <div class="ga__filtres">
      <button
        v-for="s in statuts"
        :key="s.cle"
        type="button"
        class="ga__chip"
        :class="{ 'est-actif': statutsActifs.includes(s.cle) }"
        :style="{ '--chip': s.couleur }"
        @click="basculerStatut(s.cle)"
      >
        <i class="ga__pastille"></i>{{ s.label }}
        <b>{{ compteurStatut[s.cle] || 0 }}</b>
      </button>
      <button class="ga__lien" type="button" @click="statutsActifs = statuts.map(s => s.cle)">
        Tout afficher
      </button>
    </div>

    <!-- ══ Gantt ══ -->
    <div class="ga__cadre">
      <!-- Colonne ateliers -->
      <div class="ga__col">
        <div class="ga__colTete">Atelier</div>
        <div
          v-for="ligne in lignes"
          :key="ligne.atelier.id"
          class="ga__colCell"
          :style="{ height: ligne.hauteur + 'px' }"
        >
          <div class="ga__atelierNom">
            <i class="ga__puce" :style="{ background: ligne.atelier.couleur }"></i>
            <span :title="ligne.atelier.nom">{{ ligne.atelier.nom }}</span>
          </div>
          <div class="ga__atelierMeta">
            <div class="ga__jauge" :title="`Occupation sur la période affichée : ${ligne.occupation}%`">
              <span
                class="ga__jaugeFill"
                :class="{
                  'est-haute': ligne.occupation >= 85,
                  'est-moyenne': ligne.occupation >= 60 && ligne.occupation < 85
                }"
                :style="{ width: Math.min(100, ligne.occupation) + '%' }"
              ></span>
            </div>
            <span class="ga__pourcent">{{ ligne.occupation }}%</span>
          </div>
        </div>
      </div>

      <!-- Timeline -->
      <div ref="refDefilement" class="ga__scroll" @scroll="masquerInfobulle">
        <div class="ga__piste" :style="{ width: largeurTotale + 'px' }">

          <!-- En-tête : mois -->
          <div class="ga__mois">
            <div
              v-for="m in bandeMois"
              :key="m.cle"
              class="ga__moisCell"
              :style="{ left: m.x + 'px', width: m.largeur + 'px' }"
            >{{ m.label }}</div>
          </div>

          <!-- En-tête : jours -->
          <div class="ga__jours">
            <div
              v-for="j in jours"
              :key="j.index"
              class="ga__jourCell"
              :class="{ 'est-weekend': j.weekend, 'est-aujourdhui': j.aujourdhui }"
              :style="{ left: j.x + 'px', width: pxJour + 'px' }"
            >
              <template v-if="pxJour >= 24">
                <b>{{ j.num }}</b>
                <small v-if="pxJour >= 34">{{ j.abrev }}</small>
              </template>
              <template v-else-if="j.lundi"><b>{{ j.num }}</b></template>
            </div>
          </div>

          <!-- Corps -->
          <div class="ga__corps">
            <!-- trames verticales -->
            <div
              v-for="j in jours"
              :key="'t' + j.index"
              class="ga__trame"
              :class="{ 'est-weekend': j.weekend }"
              :style="{ left: j.x + 'px', width: pxJour + 'px' }"
            ></div>

            <!-- repère du jour -->
            <div v-if="xAujourdhui !== null" class="ga__today" :style="{ left: xAujourdhui + 'px' }">
              <span class="ga__todayPuce"></span>
            </div>

            <!-- lignes ateliers -->
            <div
              v-for="ligne in lignes"
              :key="ligne.atelier.id"
              class="ga__ligne"
              :style="{ height: ligne.hauteur + 'px' }"
            >
              <button
                v-for="o in ligne.ordres"
                :key="o.id"
                type="button"
                class="ga__barre"
                :class="['est-' + o.statut, { 'est-selection': selection === o.id }]"
                :style="{
                  left: o.x + 'px',
                  width: o.largeur + 'px',
                  top: (6 + o.lane * (H_BARRE + 4)) + 'px',
                  height: H_BARRE + 'px'
                }"
                @click="choisirOrdre(o)"
                @mouseenter="afficherInfobulle($event, o)"
                @mousemove="deplacerInfobulle"
                @mouseleave="masquerInfobulle"
                @focus="afficherInfobulle($event, o)"
                @blur="masquerInfobulle"
              >
                <span class="ga__avancement" :style="{ width: o.avancement + '%' }"></span>
                <span v-if="o.largeur > 58" class="ga__barreTxt">{{ o.produit }} · {{ o.lot }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ══ Légende ══ -->
    <footer class="ga__legende">
      <span v-for="s in statuts" :key="s.cle" class="ga__legItem">
        <i :style="{ background: s.couleur }"></i>{{ s.label }}
      </span>
      <span class="ga__legItem ga__legItem--sep">
        <i class="ga__legWeekend"></i>Week-end (vendredi–samedi)
      </span>
      <span class="ga__legItem">
        <i class="ga__legToday"></i>Aujourd'hui
      </span>
    </footer>

    <!-- ══ Infobulle ══ -->
    <div
      v-if="infobulle.visible"
      class="ga__tip"
      :style="{ left: infobulle.x + 'px', top: infobulle.y + 'px' }"
      role="tooltip"
    >
      <div class="ga__tipTete">
        <b>{{ infobulle.o.produit }}</b>
        <span class="ga__tipStatut" :style="{ background: couleurStatut(infobulle.o.statut) }">
          {{ libelleStatut(infobulle.o.statut) }}
        </span>
      </div>
      <dl class="ga__tipListe">
        <div><dt>OF</dt><dd>{{ infobulle.o.of_num }}</dd></div>
        <div><dt>Lot</dt><dd>{{ infobulle.o.lot }}</dd></div>
        <div><dt>Atelier</dt><dd>{{ nomAtelier(infobulle.o.atelier_id) }}</dd></div>
        <div><dt>Période</dt><dd>{{ fmtDate(infobulle.o.debut) }} → {{ fmtDate(infobulle.o.fin) }}</dd></div>
        <div><dt>Durée</dt><dd>{{ infobulle.o.duree }} j</dd></div>
        <div><dt>Quantité</dt><dd>{{ fmtNb(infobulle.o.quantite) }} UV</dd></div>
        <div><dt>Avancement</dt><dd>{{ infobulle.o.avancement }} %</dd></div>
      </dl>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, reactive, watch, onMounted, nextTick } from 'vue'

/* ────────────────────────────────────────────────────────────────
   Props / emits
   ──────────────────────────────────────────────────────────────── */
const props = defineProps({
  /** Fonction async () => ({ ateliers, ordres }). Y placer l'appel fetchAllPaged. */
  loader: { type: Function, default: null },
  /** Injection directe (prioritaire sur loader) */
  ordres: { type: Array, default: null },
  ateliers: { type: Array, default: null },
  /** Fenêtre affichée par défaut, en jours */
  horizon: { type: Number, default: 45 }
})
const emit = defineEmits(['select-of'])

const H_BARRE = 22
const JOUR_MS = 86400000

/* ────────────────────────────────────────────────────────────────
   Référentiel des 11 ateliers
   ──────────────────────────────────────────────────────────────── */
const ATELIERS_REF = [
  { id: 'PES',  code: 'PES',  nom: 'Pesée / Dispensing',        couleur: '#7E8CA0', capacite_h: 16 },
  { id: 'GRA1', code: 'GRA1', nom: 'Granulation GLATT',         couleur: '#2A4A85', capacite_h: 16 },
  { id: 'GRA2', code: 'GRA2', nom: 'Granulation COMASA',        couleur: '#3C63A8', capacite_h: 16 },
  { id: 'SEC',  code: 'SEC',  nom: 'Séchage',                   couleur: '#5B9BD5', capacite_h: 16 },
  { id: 'CAL',  code: 'CAL',  nom: 'Calibrage / Mélange',       couleur: '#6FB1DE', capacite_h: 16 },
  { id: 'CP1',  code: 'CP1',  nom: 'Compression FETTE FE55',    couleur: '#1F7A6B', capacite_h: 21 },
  { id: 'CP2',  code: 'CP2',  nom: 'Compression INTEGRA 520',   couleur: '#2E9C88', capacite_h: 21 },
  { id: 'PEL',  code: 'PEL',  nom: 'Pelliculage',               couleur: '#B8860B', capacite_h: 16 },
  { id: 'CD1',  code: 'CD1',  nom: 'Conditionnement UHLMANN',   couleur: '#9C5A2E', capacite_h: 21 },
  { id: 'CD2',  code: 'CD2',  nom: 'Conditionnement Marchesini', couleur: '#C07A44', capacite_h: 21 },
  { id: 'HOR',  code: 'HOR',  nom: 'Zone hormonale',            couleur: '#8E5BA8', capacite_h: 16 }
]

/* ────────────────────────────────────────────────────────────────
   Statuts
   ──────────────────────────────────────────────────────────────── */
const statuts = [
  { cle: 'planifie', label: 'Planifié',  couleur: '#8C9BB0' },
  { cle: 'en_cours', label: 'En cours',  couleur: '#2A4A85' },
  { cle: 'termine',  label: 'Terminé',   couleur: '#2E9C88' },
  { cle: 'retard',   label: 'En retard', couleur: '#C0392B' },
  { cle: 'rejete',   label: 'Rejeté',    couleur: '#7A3B8E' },
  { cle: 'arret',    label: 'Arrêt',     couleur: '#6B7280' }
]
const couleurStatut = c => (statuts.find(s => s.cle === c) || statuts[0]).couleur
const libelleStatut = c => (statuts.find(s => s.cle === c) || statuts[0]).label

/* ────────────────────────────────────────────────────────────────
   Jeu de démonstration (dates relatives au jour courant)
   ──────────────────────────────────────────────────────────────── */
function jourPlus(n) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function ordresDemo() {
  const brut = [
    // produit,        lot,     atelier, début, durée, statut,      qté
    ['DIAMICRON 60',   '26401', 'PES',  -6, 1, 'termine',  180000],
    ['DIAMICRON 60',   '26401', 'GRA1', -5, 2, 'termine',  180000],
    ['DIAMICRON 60',   '26401', 'SEC',  -3, 1, 'termine',  180000],
    ['DIAMICRON 60',   '26401', 'CAL',  -2, 1, 'termine',  180000],
    ['DIAMICRON 60',   '26401', 'CP1',  -1, 3, 'en_cours', 180000],
    ['DIAMICRON 60',   '26401', 'CD1',   3, 3, 'planifie', 180000],

    ['LIPANTHYL 160',  '26395', 'GRA2', -4, 2, 'termine',   96000],
    ['LIPANTHYL 160',  '26395', 'SEC',  -2, 1, 'termine',   96000],
    ['LIPANTHYL 160',  '26395', 'CP2',   0, 2, 'en_cours',  96000],
    ['LIPANTHYL 160',  '26395', 'PEL',   2, 2, 'planifie',  96000],
    ['LIPANTHYL 160',  '26395', 'CD2',   5, 2, 'planifie',  96000],

    ['FLUDEX LP 1.5',  '26132', 'GRA1', -3, 2, 'retard',   120000],
    ['FLUDEX LP 1.5',  '26132', 'SEC',  -1, 1, 'retard',   120000],
    ['FLUDEX LP 1.5',  '26132', 'CP1',   2, 2, 'planifie', 120000],
    ['FLUDEX LP 1.5',  '26132', 'PEL',   4, 2, 'planifie', 120000],
    ['FLUDEX LP 1.5',  '26132', 'CD1',   7, 2, 'planifie', 120000],

    ['PREDNISOLONE 20', '26410', 'HOR',  -2, 4, 'en_cours',  60000],
    ['PREDNISOLONE 20', '26410', 'CD2',   4, 2, 'planifie',  60000],
    ['ESTRADIOL 2',     '26415', 'HOR',   5, 3, 'planifie',  40000],

    ['METFORMINE 850', '26420', 'PES',   1, 1, 'planifie', 240000],
    ['METFORMINE 850', '26420', 'GRA2',  2, 3, 'planifie', 240000],
    ['METFORMINE 850', '26420', 'CAL',   5, 1, 'planifie', 240000],
    ['METFORMINE 850', '26420', 'CP2',   6, 4, 'planifie', 240000],
    ['METFORMINE 850', '26420', 'CD1',  11, 3, 'planifie', 240000],

    ['AMLODIPINE 10',  '26425', 'CP1',   6, 2, 'planifie',  84000],
    ['AMLODIPINE 10',  '26425', 'PEL',   8, 2, 'planifie',  84000],
    ['AMLODIPINE 10',  '26425', 'CD2',  11, 2, 'planifie',  84000],

    ['ATORVASTATINE 20', '26430', 'GRA1', 4, 2, 'planifie', 150000],
    ['ATORVASTATINE 20', '26430', 'SEC',  6, 1, 'planifie', 150000],
    ['ATORVASTATINE 20', '26430', 'CP2', 11, 3, 'planifie', 150000],
    ['ATORVASTATINE 20', '26430', 'PEL', 14, 2, 'planifie', 150000],

    ['— Maintenance préventive —', 'MP-08', 'CP1', 10, 1, 'arret', 0],
    ['— Nettoyage campagne —',     'NC-03', 'PEL', 12, 1, 'arret', 0],
    ['— Qualification UHLMANN —',  'QO-11', 'CD1', 15, 2, 'arret', 0]
  ]

  return brut.map((r, i) => {
    const [produit, lot, atelier, offset, duree, statut, quantite] = r
    const avancement =
      statut === 'termine' ? 100 :
      statut === 'en_cours' ? 45 + ((i * 7) % 40) :
      statut === 'retard' ? 60 : 0
    return {
      id: 'DEMO-' + (i + 1),
      of_num: 'OF-' + String(26000 + i * 3).padStart(5, '0'),
      produit, lot,
      atelier_id: atelier,
      debut: jourPlus(offset),
      fin: jourPlus(offset + duree - 1),
      statut, quantite, avancement
    }
  })
}

/* ────────────────────────────────────────────────────────────────
   État
   ──────────────────────────────────────────────────────────────── */
const donneesAteliers = ref(props.ateliers || ATELIERS_REF)
const donneesOrdres = ref(props.ordres || ordresDemo())
const estDemo = ref(!props.ordres && !props.loader)
const chargement = ref(false)
const erreur = ref('')

const recherche = ref('')
const statutsActifs = ref(statuts.map(s => s.cle))
const selection = ref(null)
const zoom = ref('semaine')
const refDefilement = ref(null)

const zooms = [
  { cle: 'jour',    label: 'Jour',    px: 44 },
  { cle: 'semaine', label: 'Semaine', px: 22 },
  { cle: 'mois',    label: 'Mois',    px: 9 }
]
const pxJour = computed(() => (zooms.find(z => z.cle === zoom.value) || zooms[1]).px)

function basculerStatut(cle) {
  const i = statutsActifs.value.indexOf(cle)
  if (i === -1) statutsActifs.value.push(cle)
  else statutsActifs.value.splice(i, 1)
}

/* ────────────────────────────────────────────────────────────────
   Chargement de la source
   ──────────────────────────────────────────────────────────────── */
async function charger() {
  if (!props.loader) return
  chargement.value = true
  erreur.value = ''
  try {
    const res = await props.loader()
    const lignesOF = (res && res.ordres) || []
    if (!lignesOF.length) throw new Error('Aucun ordre retourné par la source')
    donneesOrdres.value = lignesOF
    if (res.ateliers && res.ateliers.length) {
      // On conserve couleur et capacité du référentiel si l'atelier est connu
      donneesAteliers.value = res.ateliers.map(a => {
        const ref = ATELIERS_REF.find(x => x.id === a.id || x.code === a.code)
        return { ...ref, ...a, couleur: a.couleur || (ref && ref.couleur) || '#5B9BD5' }
      })
    }
    estDemo.value = false
  } catch (e) {
    erreur.value = (e && e.message) || String(e)
    donneesOrdres.value = ordresDemo()
    donneesAteliers.value = ATELIERS_REF
    estDemo.value = true
  } finally {
    chargement.value = false
  }
}

watch(() => props.ordres, v => {
  if (v && v.length) { donneesOrdres.value = v; estDemo.value = false }
})
watch(() => props.ateliers, v => { if (v && v.length) donneesAteliers.value = v })

/* ────────────────────────────────────────────────────────────────
   Normalisation et filtrage
   ──────────────────────────────────────────────────────────────── */
function versDate(v) {
  if (!v) return null
  const d = v instanceof Date ? new Date(v) : new Date(String(v).slice(0, 10) + 'T00:00:00')
  return isNaN(d) ? null : d
}

const ordresNormalises = computed(() =>
  donneesOrdres.value
    .map(o => {
      const d = versDate(o.debut || o.date_debut)
      const f = versDate(o.fin || o.date_fin) || d
      if (!d) return null
      return {
        ...o,
        debut: d,
        fin: f < d ? d : f,
        statut: statuts.some(s => s.cle === o.statut) ? o.statut : 'planifie',
        avancement: Math.max(0, Math.min(100, Number(o.avancement) || 0)),
        quantite: Number(o.quantite) || 0
      }
    })
    .filter(Boolean)
)

const ordresFiltres = computed(() => {
  const q = recherche.value.trim().toLowerCase()
  return ordresNormalises.value.filter(o => {
    if (!statutsActifs.value.includes(o.statut)) return false
    if (!q) return true
    return [o.produit, o.lot, o.of_num].some(v => String(v || '').toLowerCase().includes(q))
  })
})

const compteurStatut = computed(() => {
  const c = {}
  statuts.forEach(s => { c[s.cle] = 0 })
  ordresNormalises.value.forEach(o => { c[o.statut] = (c[o.statut] || 0) + 1 })
  return c
})

/* ────────────────────────────────────────────────────────────────
   Échelle de temps
   ──────────────────────────────────────────────────────────────── */
const bornes = computed(() => {
  const src = ordresNormalises.value
  const auj = new Date(); auj.setHours(0, 0, 0, 0)
  if (!src.length) return { debut: auj, fin: new Date(auj.getTime() + props.horizon * JOUR_MS) }
  let min = src[0].debut, max = src[0].fin
  src.forEach(o => { if (o.debut < min) min = o.debut; if (o.fin > max) max = o.fin })
  const d = new Date(Math.min(min.getTime(), auj.getTime()) - 3 * JOUR_MS); d.setHours(0, 0, 0, 0)
  const f = new Date(Math.max(max.getTime(), auj.getTime()) + 3 * JOUR_MS); f.setHours(0, 0, 0, 0)
  return { debut: d, fin: f }
})

const nbJours = computed(() =>
  Math.max(1, Math.round((bornes.value.fin - bornes.value.debut) / JOUR_MS) + 1)
)
const largeurTotale = computed(() => nbJours.value * pxJour.value)
const indexJour = d => Math.round((d - bornes.value.debut) / JOUR_MS)

const ABREV = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam']
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

const jours = computed(() => {
  const out = []
  const auj = new Date(); auj.setHours(0, 0, 0, 0)
  for (let i = 0; i < nbJours.value; i++) {
    const d = new Date(bornes.value.debut.getTime() + i * JOUR_MS)
    const js = d.getDay()
    out.push({
      index: i,
      x: i * pxJour.value,
      num: d.getDate(),
      abrev: ABREV[js],
      lundi: js === 1,
      weekend: js === 5 || js === 6,   // vendredi–samedi
      aujourdhui: d.getTime() === auj.getTime()
    })
  }
  return out
})

const bandeMois = computed(() => {
  const out = []
  let courant = null
  for (let i = 0; i < nbJours.value; i++) {
    const d = new Date(bornes.value.debut.getTime() + i * JOUR_MS)
    const cle = d.getFullYear() + '-' + d.getMonth()
    if (!courant || courant.cle !== cle) {
      courant = { cle, label: MOIS[d.getMonth()] + ' ' + d.getFullYear(), x: i * pxJour.value, largeur: pxJour.value }
      out.push(courant)
    } else {
      courant.largeur += pxJour.value
    }
  }
  return out
})

const xAujourdhui = computed(() => {
  const auj = new Date(); auj.setHours(0, 0, 0, 0)
  const i = indexJour(auj)
  return i < 0 || i >= nbJours.value ? null : i * pxJour.value + pxJour.value / 2
})

/* ────────────────────────────────────────────────────────────────
   Construction des lignes (répartition en couloirs + occupation)
   ──────────────────────────────────────────────────────────────── */
const lignes = computed(() =>
  donneesAteliers.value.map(atelier => {
    const liste = ordresFiltres.value
      .filter(o => o.atelier_id === atelier.id || o.atelier_id === atelier.code)
      .sort((a, b) => a.debut - b.debut)

    // Placement en couloirs : un OF descend d'un cran s'il chevauche le précédent
    const finsParLane = []
    const places = liste.map(o => {
      const i0 = indexJour(o.debut)
      const i1 = indexJour(o.fin)
      let lane = 0
      while (lane < finsParLane.length && finsParLane[lane] >= i0) lane++
      finsParLane[lane] = i1
      return {
        ...o,
        lane,
        x: i0 * pxJour.value + 1,
        largeur: Math.max(6, (i1 - i0 + 1) * pxJour.value - 2),
        duree: i1 - i0 + 1
      }
    })

    const nbLanes = Math.max(1, finsParLane.length)
    const joursCharges = places
      .filter(o => o.statut !== 'arret')
      .reduce((s, o) => s + o.duree, 0)
    const ouvres = jours.value.filter(j => !j.weekend).length || 1
    const occupation = Math.round((joursCharges / ouvres) * 100)

    return {
      atelier,
      ordres: places,
      nbLanes,
      hauteur: 12 + nbLanes * (H_BARRE + 4),
      occupation
    }
  })
)

const occupationMoyenne = computed(() => {
  if (!lignes.value.length) return 0
  const t = lignes.value.reduce((s, l) => s + l.occupation, 0)
  return Math.round(t / lignes.value.length)
})

const nomAtelier = id => {
  const a = donneesAteliers.value.find(x => x.id === id || x.code === id)
  return a ? a.nom : id
}

/* ────────────────────────────────────────────────────────────────
   Interactions
   ──────────────────────────────────────────────────────────────── */
const infobulle = reactive({ visible: false, x: 0, y: 0, o: {} })

function afficherInfobulle(evt, o) {
  infobulle.o = o
  infobulle.visible = true
  positionner(evt)
}
function deplacerInfobulle(evt) { if (infobulle.visible) positionner(evt) }
function positionner(evt) {
  const x = evt.clientX || (evt.target.getBoundingClientRect().left + 20)
  const y = evt.clientY || evt.target.getBoundingClientRect().top
  infobulle.x = Math.min(x + 14, window.innerWidth - 270)
  infobulle.y = Math.min(y + 16, window.innerHeight - 230)
}
function masquerInfobulle() { infobulle.visible = false }

function choisirOrdre(o) {
  selection.value = o.id
  emit('select-of', o)
}

function allerAujourdhui() {
  const el = refDefilement.value
  if (!el || xAujourdhui.value === null) return
  el.scrollTo({ left: Math.max(0, xAujourdhui.value - el.clientWidth / 3), behavior: 'smooth' })
}

const fmtDate = d => (d instanceof Date ? d.toLocaleDateString('fr-FR') : d)
const fmtNb = n => new Intl.NumberFormat('fr-FR').format(n || 0)

function exporterCsv() {
  const entetes = ['OF', 'Produit', 'Lot', 'Atelier', 'Debut', 'Fin', 'Duree_j', 'Statut', 'Avancement_%', 'Quantite']
  const lignesCsv = ordresFiltres.value.map(o => {
    const i0 = indexJour(o.debut), i1 = indexJour(o.fin)
    return [
      o.of_num, o.produit, o.lot, nomAtelier(o.atelier_id),
      fmtDate(o.debut), fmtDate(o.fin), i1 - i0 + 1,
      libelleStatut(o.statut), o.avancement, o.quantite
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')
  })
  const csv = '\uFEFF' + [entetes.join(';'), ...lignesCsv].join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `planning_ateliers_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(async () => {
  await charger()
  await nextTick()
  allerAujourdhui()
})

defineExpose({ recharger: charger, allerAujourdhui })
</script>

<style scoped>
/* Les variables reprennent le thème de ProdTrack si présent, sinon la palette LDM. */
.ga {
  --ga-accent: var(--couleur-primaire, #2A4A85);
  --ga-accent2: var(--couleur-secondaire, #5B9BD5);
  --ga-fond: var(--couleur-fond, #ffffff);
  --ga-surface: var(--couleur-surface, #f6f8fb);
  --ga-texte: var(--couleur-texte, #1d2430);
  --ga-texte2: var(--couleur-texte-secondaire, #6b7789);
  --ga-bord: var(--couleur-bordure, #dfe5ee);

  background: var(--ga-fond);
  color: var(--ga-texte);
  border: 1px solid var(--ga-bord);
  border-radius: 10px;
  padding: 14px;
  font-size: 13px;
}

/* ── Barre d'outils ── */
.ga__bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; }
.ga__titre { display: flex; align-items: center; gap: 8px; }
.ga__titre h2 { margin: 0; font-size: 16px; font-weight: 650; letter-spacing: .2px; }
.ga__badge {
  background: #fdf3d7; color: #8a6d1a; border: 1px solid #edd89a;
  padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600;
}
.ga__badge--neutre { background: var(--ga-surface); color: var(--ga-texte2); border-color: var(--ga-bord); }
.ga__badge--erreur { background: #fdeceb; color: #a02f24; border-color: #f2c3bd; }

.ga__outils { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.ga__champ {
  border: 1px solid var(--ga-bord); border-radius: 6px; padding: 6px 10px;
  min-width: 190px; background: var(--ga-fond); color: var(--ga-texte); font-size: 12px;
}
.ga__champ:focus { outline: 2px solid var(--ga-accent2); outline-offset: 1px; }
.ga__btn, .ga__zoomBtn {
  border: 1px solid var(--ga-bord); background: var(--ga-fond); color: var(--ga-texte);
  padding: 6px 11px; border-radius: 6px; cursor: pointer; font-size: 12px;
}
.ga__btn:hover, .ga__zoomBtn:hover { border-color: var(--ga-accent2); }
.ga__zoom { display: flex; }
.ga__zoom .ga__zoomBtn { border-radius: 0; margin-left: -1px; }
.ga__zoom .ga__zoomBtn:first-child { border-radius: 6px 0 0 6px; margin-left: 0; }
.ga__zoom .ga__zoomBtn:last-child { border-radius: 0 6px 6px 0; }
.ga__zoomBtn.est-actif { background: var(--ga-accent); color: #fff; border-color: var(--ga-accent); }

/* ── KPI ── */
.ga__kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; margin: 12px 0 10px; }
.ga__kpi {
  background: var(--ga-surface); border: 1px solid var(--ga-bord); border-radius: 8px;
  padding: 9px 12px; display: flex; flex-direction: column; gap: 2px;
}
.ga__kpi--alerte { border-color: #f2c3bd; background: #fdeceb; }
.ga__kpiVal { font-size: 21px; font-weight: 680; line-height: 1.1; color: var(--ga-accent); }
.ga__kpi--alerte .ga__kpiVal { color: #C0392B; }
.ga__kpiVal small { font-size: 12px; font-weight: 600; }
.ga__kpiLib { font-size: 11px; color: var(--ga-texte2); text-transform: uppercase; letter-spacing: .4px; }

/* ── Filtres ── */
.ga__filtres { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 10px; }
.ga__chip {
  display: inline-flex; align-items: center; gap: 6px;
  border: 1px solid var(--ga-bord); background: var(--ga-fond); color: var(--ga-texte2);
  border-radius: 20px; padding: 4px 11px; font-size: 12px; cursor: pointer;
}
.ga__chip.est-actif { color: var(--ga-texte); border-color: var(--chip); background: color-mix(in srgb, var(--chip) 10%, transparent); }
.ga__chip b { font-weight: 650; }
.ga__pastille { width: 8px; height: 8px; border-radius: 50%; background: var(--chip); display: inline-block; }
.ga__lien { background: none; border: none; color: var(--ga-accent2); cursor: pointer; font-size: 12px; text-decoration: underline; }

/* ── Cadre Gantt ── */
.ga__cadre { display: flex; border: 1px solid var(--ga-bord); border-radius: 8px; overflow: hidden; background: var(--ga-fond); }
.ga__col { flex: 0 0 218px; border-right: 2px solid var(--ga-bord); background: var(--ga-surface); }
.ga__colTete {
  height: 46px; display: flex; align-items: flex-end; padding: 0 10px 6px;
  font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: var(--ga-texte2);
  border-bottom: 1px solid var(--ga-bord);
}
.ga__colCell {
  padding: 6px 10px; border-bottom: 1px solid var(--ga-bord);
  display: flex; flex-direction: column; justify-content: center; gap: 5px; box-sizing: border-box;
}
.ga__atelierNom { display: flex; align-items: center; gap: 7px; font-weight: 600; font-size: 12px; }
.ga__atelierNom span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ga__puce { width: 4px; height: 15px; border-radius: 2px; flex: 0 0 4px; }
.ga__atelierMeta { display: flex; align-items: center; gap: 6px; }
.ga__jauge { flex: 1; height: 5px; background: var(--ga-bord); border-radius: 3px; overflow: hidden; }
.ga__jaugeFill { display: block; height: 100%; background: var(--ga-accent2); }
.ga__jaugeFill.est-moyenne { background: #E0A22B; }
.ga__jaugeFill.est-haute { background: #C0392B; }
.ga__pourcent { font-size: 10px; color: var(--ga-texte2); min-width: 28px; text-align: right; font-variant-numeric: tabular-nums; }

/* ── Timeline ── */
.ga__scroll { flex: 1; overflow-x: auto; overflow-y: hidden; }
.ga__piste { position: relative; }
.ga__mois, .ga__jours { position: relative; height: 23px; }
.ga__mois { border-bottom: 1px solid var(--ga-bord); }
.ga__moisCell {
  position: absolute; top: 0; height: 23px; display: flex; align-items: center; padding-left: 6px;
  font-size: 11px; font-weight: 620; color: var(--ga-texte2); border-left: 1px solid var(--ga-bord);
  text-transform: capitalize; white-space: nowrap; overflow: hidden;
}
.ga__jours { border-bottom: 1px solid var(--ga-bord); }
.ga__jourCell {
  position: absolute; top: 0; height: 23px; box-sizing: border-box;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  font-size: 10px; color: var(--ga-texte2); border-left: 1px solid var(--ga-bord); overflow: hidden;
}
.ga__jourCell b { font-weight: 620; font-size: 10px; line-height: 1; }
.ga__jourCell small { font-size: 8px; opacity: .75; line-height: 1; }
.ga__jourCell.est-weekend { background: color-mix(in srgb, var(--ga-bord) 45%, transparent); }
.ga__jourCell.est-aujourdhui { background: var(--ga-accent); color: #fff; }
.ga__jourCell.est-aujourdhui small { opacity: .9; }

.ga__corps { position: relative; }
.ga__trame { position: absolute; top: 0; bottom: 0; border-left: 1px solid color-mix(in srgb, var(--ga-bord) 55%, transparent); }
.ga__trame.est-weekend { background: color-mix(in srgb, var(--ga-bord) 28%, transparent); }
.ga__today { position: absolute; top: 0; bottom: 0; width: 2px; background: #C0392B; z-index: 3; }
.ga__todayPuce { position: absolute; top: -3px; left: -3px; width: 8px; height: 8px; border-radius: 50%; background: #C0392B; }

.ga__ligne { position: relative; border-bottom: 1px solid var(--ga-bord); box-sizing: border-box; }

.ga__barre {
  position: absolute; border: none; border-radius: 4px; padding: 0 7px; cursor: pointer;
  display: flex; align-items: center; overflow: hidden; z-index: 2;
  color: #fff; font-size: 11px; text-align: left; background: #8C9BB0;
  box-shadow: 0 1px 2px rgba(16, 24, 40, .16);
  transition: transform .12s ease, box-shadow .12s ease;
}
.ga__barre:hover { transform: translateY(-1px); box-shadow: 0 3px 8px rgba(16, 24, 40, .24); }
.ga__barre:focus-visible { outline: 2px solid var(--ga-texte); outline-offset: 2px; }
.ga__barre.est-selection { outline: 2px solid var(--ga-texte); outline-offset: 1px; }
.ga__barre.est-planifie { background: #8C9BB0; }
.ga__barre.est-en_cours { background: var(--ga-accent); }
.ga__barre.est-termine  { background: #2E9C88; }
.ga__barre.est-retard   { background: #C0392B; }
.ga__barre.est-rejete   { background: #7A3B8E; }
.ga__barre.est-arret    { background: repeating-linear-gradient(45deg, #6B7280, #6B7280 5px, #59606c 5px, #59606c 10px); }
.ga__avancement { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(255, 255, 255, .26); }
.ga__barreTxt { position: relative; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 560; }

/* ── Légende ── */
.ga__legende { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 10px; font-size: 11px; color: var(--ga-texte2); }
.ga__legItem { display: inline-flex; align-items: center; gap: 5px; }
.ga__legItem i { width: 11px; height: 11px; border-radius: 3px; display: inline-block; }
.ga__legItem--sep { padding-left: 14px; border-left: 1px solid var(--ga-bord); }
.ga__legWeekend { background: color-mix(in srgb, var(--ga-bord) 60%, transparent); border: 1px solid var(--ga-bord); }
.ga__legToday { background: #C0392B; width: 3px !important; border-radius: 2px !important; }

/* ── Infobulle ── */
.ga__tip {
  position: fixed; z-index: 60; width: 252px; pointer-events: none;
  background: var(--ga-fond); color: var(--ga-texte);
  border: 1px solid var(--ga-bord); border-radius: 8px; padding: 9px 11px;
  box-shadow: 0 8px 24px rgba(16, 24, 40, .18); font-size: 12px;
}
.ga__tipTete { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 7px; }
.ga__tipStatut { color: #fff; border-radius: 20px; padding: 1px 8px; font-size: 10px; font-weight: 600; white-space: nowrap; }
.ga__tipListe { margin: 0; display: grid; gap: 3px; }
.ga__tipListe > div { display: flex; justify-content: space-between; gap: 10px; }
.ga__tipListe dt { color: var(--ga-texte2); font-size: 11px; }
.ga__tipListe dd { margin: 0; font-weight: 560; text-align: right; }

/* ── Responsive ── */
@media (max-width: 700px) {
  .ga__col { flex: 0 0 132px; }
  .ga__atelierMeta { display: none; }
  .ga__champ { min-width: 130px; flex: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .ga__barre { transition: none; }
  .ga__barre:hover { transform: none; }
}
</style>

<!--
════════════════════════════════════════════════════════════════════
BRANCHEMENT SUPABASE — à faire dans la vue parente, pas ici
════════════════════════════════════════════════════════════════════

<template>
  <GanttAteliers :loader="chargerPlanning" @select-of="ouvrirOF" />
</template>

<script setup>
import GanttAteliers from '../components/GanttAteliers.vue'
import { supabase } from '../supabase'          // adapter le chemin
import { fetchAllPaged } from '../utils/fetchAllPaged'  // adapter le chemin

async function chargerPlanning () {
  const lignes = await fetchAllPaged(
    (from, to) => supabase
      .from('v_planning_ateliers')
      .select('id, of_num, produit, lot, atelier_id, date_debut, date_fin, statut, avancement, quantite')
      .order('date_debut', { ascending: true })
      .range(from, to)
  )

  return {
    ordres: lignes.map(l => ({
      id: l.id,
      of_num: l.of_num,
      produit: l.produit,
      lot: l.lot,
      atelier_id: l.atelier_id,        // doit valoir PES, GRA1, GRA2, SEC, CAL,
                                       // CP1, CP2, PEL, CD1, CD2 ou HOR
      debut: l.date_debut,
      fin: l.date_fin,
      statut: l.statut,                // planifie | en_cours | termine | retard | arret
      avancement: l.avancement,
      quantite: l.quantite
    }))
    // ateliers: [...]  ← optionnel, sinon le référentiel interne est utilisé
  }
}

function ouvrirOF (of) {
  // ex. router.push({ name: 'OrdresFabrication', query: { of: of.of_num } })
}
</script>

Si le loader échoue ou ne renvoie rien, le composant retombe automatiquement
sur la démo et affiche un badge — pas d'écran vide.
-->
