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
      <div class="mat-bar">
        <div class="f"><label>Périmètre</label><select v-model="filtreAtelier"><option value="">Tous</option><option v-for="a in ateliersListe" :key="a" :value="a">{{ a }}</option></select></div>
        <div class="f"><label>Équipe</label><select v-model="filtreEquipe"><option value="">Toutes</option><option v-for="e in equipesListe" :key="e" :value="e">{{ e }}</option></select></div>
        <div class="f"><label>Fonction</label><select v-model="filtreFonction"><option value="">Toutes</option><option v-for="fn in fonctionsListe" :key="fn" :value="fn">{{ fn }}</option></select></div>
        <button v-if="personnesFiltrees.length && formations.length" class="btn" style="margin-left:auto" @click="exporterPDF">📄 Exporter la matrice (PDF)</button>
      </div>

      <div class="kpis">
        <div class="kpi"><div class="kv">{{ personnesFiltrees.length }}</div><div class="kl">Personnes</div></div>
        <div class="kpi good"><div class="kv">{{ nbValides }}</div><div class="kl">Qualifications valides</div></div>
        <div class="kpi warn"><div class="kv">{{ nbBientot }}</div><div class="kl">À recycler (&lt; 60 j)</div></div>
        <div class="kpi bad"><div class="kv">{{ nbExpire }}</div><div class="kl">Expirées / non acquis</div></div>
        <div class="kpi bad"><div class="kv">{{ nbEcarts }}</div><div class="kl">Écarts critiques</div></div>
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
const requises = ref([])
const filtreAtelier = ref('')
const filtreEquipe = ref('')
const filtreFonction = ref('')
const erreur = ref('')

async function charger() {
  const rp = await supabase.from('organigramme').select('id, nom, matricule, fonction, atelier_id, equipe').eq('actif', true).order('nom')
  if (!rp.error) personnes.value = rp.data || []
  const rf = await supabase.from('formations').select('id, nom, validite_mois').eq('actif', true).order('ordre')
  if (!rf.error) formations.value = rf.data || []
  const re = await supabase.from('formation_enregistrements').select('*')
  if (re.error) { erreur.value = re.error.message; return }
  enregistrements.value = re.data || []
  const rq = await supabase.from('formation_requise').select('*')
  if (!rq.error) requises.value = rq.data || []
}
onMounted(charger)

const ateliersListe = computed(() => [...new Set(personnes.value.map(p => p.atelier_id).filter(Boolean))].sort())
const equipesListe = computed(() => [...new Set(personnes.value.map(p => p.equipe).filter(Boolean))].sort())
const fonctionsListe = computed(() => [...new Set(personnes.value.map(p => p.fonction).filter(Boolean))].sort())
const personnesFiltrees = computed(() => personnes.value.filter(p => {
  if (filtreAtelier.value && (p.atelier_id || '') !== filtreAtelier.value) return false
  if (filtreEquipe.value && (p.equipe || '') !== filtreEquipe.value) return false
  if (filtreFonction.value && (p.fonction || '') !== filtreFonction.value) return false
  return true
}))
const persIds = computed(() => new Set(personnesFiltrees.value.map(p => p.id)))

const formationById = computed(() => { const m = {}; for (const f of formations.value) m[f.id] = f; return m })
const personneById = computed(() => { const m = {}; for (const p of personnes.value) m[p.id] = p; return m })
const requisParFonction = computed(() => { const m = {}; for (const r of requises.value) { (m[r.fonction] = m[r.fonction] || new Set()).add(r.formation_id) } return m })
function addMonths(dateStr, m) { const d = new Date(dateStr + 'T00:00:00'); d.setMonth(d.getMonth() + m); return d.toISOString().slice(0, 10) }
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
    for (const fid of req) { if (cellStatut(p.id, fid) === 'manquant') out.push({ id: 'm' + p.id + '_' + fid, personneNom: p.nom, formationNom: (formationById.value[fid] || {}).nom || '', date_formation: '—', expiration: null, cell: 'manquant' }) }
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

function abrev(nom) { const m = String(nom).match(/\(([^)]+)\)/); if (m) return m[1]; return String(nom).split(/\s+/)[0] }

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
.form-page { color: #1b2733; zoom: 0.9; }
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

.kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 20px; }
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
