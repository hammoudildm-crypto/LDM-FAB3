<template>
  <div class="form-page">
    <PageHeader title="Formations — Matrice & tableau de bord" tone="#0d9488"
      subtitle="État de qualification du personnel : qui est formé, ce qui expire, les écarts." />

    <p v-if="erreur" class="alert">{{ erreur }}</p>

    <section class="card">
      <div class="kpis">
        <div class="kpi"><div class="kv">{{ personnes.length }}</div><div class="kl">Personnes</div></div>
        <div class="kpi good"><div class="kv">{{ nbValides }}</div><div class="kl">Qualifications valides</div></div>
        <div class="kpi warn"><div class="kv">{{ nbBientot }}</div><div class="kl">À recycler (&lt; 60 j)</div></div>
        <div class="kpi bad"><div class="kv">{{ nbExpire }}</div><div class="kl">Expirées / non acquis</div></div>
      </div>

      <h3 class="sec-titre">À planifier — expiré ou bientôt</h3>
      <div v-if="!aPlanifier.length" class="empty-sm">Aucune formation à recycler 🎉</div>
      <table v-else class="form-tbl">
        <thead><tr><th>Personne</th><th>Formation</th><th>Date</th><th>Expiration</th><th>État</th></tr></thead>
        <tbody>
          <tr v-for="e in aPlanifier" :key="e.id" class="row-ko">
            <td class="nom">{{ e.personneNom }}</td><td>{{ e.formationNom }}</td><td>{{ e.date_formation }}</td><td>{{ e.expiration || '—' }}</td>
            <td><span class="etat" :class="'e-' + e.cell">{{ etatTxt(e.cell) }}</span></td>
          </tr>
        </tbody>
      </table>

      <h3 class="sec-titre">Matrice de qualification</h3>
      <div v-if="!personnes.length || !formations.length" class="empty-sm">Il faut des personnes (organigramme) et des formations (référentiel) pour construire la matrice.</div>
      <template v-else>
        <div class="mat-wrap">
          <table class="mat-tbl">
            <thead><tr><th class="sticky-l">Personne</th><th v-for="f in formations" :key="f.id" :title="f.nom">{{ abrev(f.nom) }}</th></tr></thead>
            <tbody>
              <tr v-for="p in personnes" :key="p.id">
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
          <span class="lg"><span class="pt e-absent">—</span>Non formé</span>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'
import PageHeader from '../components/PageHeader.vue'

const personnes = ref([])
const formations = ref([])
const enregistrements = ref([])
const erreur = ref('')

async function charger() {
  const rp = await supabase.from('organigramme').select('id, nom, matricule, fonction').eq('actif', true).order('nom')
  if (!rp.error) personnes.value = rp.data || []
  const rf = await supabase.from('formations').select('id, nom, validite_mois').eq('actif', true).order('ordre')
  if (!rf.error) formations.value = rf.data || []
  const re = await supabase.from('formation_enregistrements').select('*')
  if (re.error) { erreur.value = re.error.message; return }
  enregistrements.value = re.data || []
}
onMounted(charger)

const formationById = computed(() => { const m = {}; for (const f of formations.value) m[f.id] = f; return m })
function addMonths(dateStr, m) { const d = new Date(dateStr + 'T00:00:00'); d.setMonth(d.getMonth() + m); return d.toISOString().slice(0, 10) }
const today = new Date().toISOString().slice(0, 10)
const dans60 = (() => { const d = new Date(today + 'T00:00:00'); d.setDate(d.getDate() + 60); return d.toISOString().slice(0, 10) })()

const enrEnrichis = computed(() => enregistrements.value.map(e => {
  const f = formationById.value[e.formation_id]
  const exp = (f && f.validite_mois && e.date_formation) ? addMonths(e.date_formation, f.validite_mois) : null
  let cell = 'valide'
  if (e.resultat === 'non acquis') cell = 'expire'
  else if (exp) cell = exp < today ? 'expire' : (exp <= dans60 ? 'bientot' : 'valide')
  else cell = 'valide'
  return { ...e, expiration: exp, cell }
}))

// dernier enregistrement par (personne, formation)
const latestByKey = computed(() => {
  const m = {}
  for (const e of enrEnrichis.value) {
    const k = e.personne_id + '|' + e.formation_id
    if (!m[k] || String(e.date_formation) > String(m[k].date_formation)) m[k] = e
  }
  return m
})
function cellStatut(pid, fid) { const e = latestByKey.value[pid + '|' + fid]; return e ? e.cell : 'absent' }
function cellIcon(st) { return st === 'valide' ? '✓' : st === 'bientot' ? '⚠' : st === 'expire' ? '✗' : '—' }
function etatTxt(st) { return st === 'valide' ? '✓ Valide' : st === 'bientot' ? '⚠ Expire bientôt' : st === 'expire' ? '✗ Expiré' : 'Non formé' }
function cellTitre(p, f) {
  const e = latestByKey.value[p.id + '|' + f.id]
  if (!e) return p.nom + ' — ' + f.nom + ' : non formé'
  return p.nom + ' — ' + f.nom + '\nFormé le ' + e.date_formation + (e.expiration ? ' · expire le ' + e.expiration : ' · permanent') + (e.resultat === 'non acquis' ? ' · NON ACQUIS' : '')
}

const personneById = computed(() => { const m = {}; for (const p of personnes.value) m[p.id] = p; return m })
const cellsListe = computed(() => Object.values(latestByKey.value))
const nbValides = computed(() => cellsListe.value.filter(e => e.cell === 'valide').length)
const nbBientot = computed(() => cellsListe.value.filter(e => e.cell === 'bientot').length)
const nbExpire = computed(() => cellsListe.value.filter(e => e.cell === 'expire').length)

const aPlanifier = computed(() => cellsListe.value
  .filter(e => e.cell === 'expire' || e.cell === 'bientot')
  .map(e => ({ ...e, personneNom: (personneById.value[e.personne_id] || {}).nom || '(supprimé)', formationNom: (formationById.value[e.formation_id] || {}).nom || '(supprimée)' }))
  .sort((a, b) => (a.cell === 'expire' ? -1 : 1) - (b.cell === 'expire' ? -1 : 1) || String(a.expiration || '').localeCompare(String(b.expiration || ''))))

function abrev(nom) { const m = String(nom).match(/\(([^)]+)\)/); if (m) return m[1]; return String(nom).split(/\s+/)[0] }
</script>

<style scoped>
.form-page { color: #1b2733; zoom: 0.9; }
.alert { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 10px 14px; border-radius: 8px; margin: 0 0 14px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 22px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.empty-sm { color: #64748b; font-size: 13px; padding: 10px 2px; }

.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
.kpi { background: #f8fafc; border: 1px solid #eef2f6; border-radius: 12px; padding: 14px; text-align: center; }
.kpi .kv { font-size: 24px; font-weight: 800; color: #0f172a; font-variant-numeric: tabular-nums; }
.kpi .kl { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #94a3b8; font-weight: 700; margin-top: 2px; }
.kpi.good .kv { color: #16a34a; } .kpi.warn .kv { color: #d97706; } .kpi.bad .kv { color: #dc2626; }
@media (max-width: 640px) { .kpis { grid-template-columns: repeat(2, 1fr); } }

.sec-titre { margin: 22px 0 8px; font-size: 15px; font-weight: 800; color: #0f172a; border-left: 4px solid #0d9488; padding-left: 9px; }
.form-tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.form-tbl th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; font-weight: 700; padding: 6px 10px; border-bottom: 2px solid #eef2f6; }
.form-tbl td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; }
.form-tbl td.nom { font-weight: 700; color: #0f172a; }
.form-tbl tr.row-ko { background: #fef2f2; }

.mat-wrap { overflow-x: auto; border: 1px solid #eef2f6; border-radius: 10px; }
.mat-tbl { border-collapse: collapse; font-size: 12px; white-space: nowrap; }
.mat-tbl th { background: #f8fafc; color: #475569; font-size: 10px; font-weight: 800; padding: 8px 6px; border-bottom: 2px solid #e2e8f0; border-left: 1px solid #f1f5f9; text-align: center; max-width: 70px; overflow: hidden; text-overflow: ellipsis; }
.mat-tbl td { padding: 5px 6px; border-bottom: 1px solid #f1f5f9; border-left: 1px solid #f1f5f9; text-align: center; }
.mat-tbl td.cell { }
.sticky-l { position: sticky; left: 0; z-index: 2; background: #fff; text-align: left !important; min-width: 150px; box-shadow: 1px 0 0 #e2e8f0; }
.mat-tbl thead .sticky-l { background: #f8fafc; z-index: 3; }
.mat-tbl td.nom { font-weight: 700; color: #0f172a; font-size: 12px; }
.mat-tbl tbody tr:hover td { background: #f0fdfa; }
.mat-tbl tbody tr:hover .sticky-l { background: #f0fdfa; }
.pt { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 6px; font-weight: 800; font-size: 12px; cursor: default; }
.pt.e-valide { background: #dcfce7; color: #166534; }
.pt.e-bientot { background: #fef3c7; color: #92400e; }
.pt.e-expire { background: #fee2e2; color: #b91c1c; }
.pt.e-absent { background: #f1f5f9; color: #cbd5e1; }

.etat { font-size: 11px; font-weight: 800; padding: 2px 9px; border-radius: 999px; white-space: nowrap; }
.etat.e-valide { background: #dcfce7; color: #166534; }
.etat.e-bientot { background: #fef3c7; color: #92400e; }
.etat.e-expire { background: #fee2e2; color: #b91c1c; }
.leg { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 10px; padding-left: 2px; }
.leg .lg { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #64748b; font-weight: 600; }
</style>
