<script setup>
import { inject, computed, watch } from 'vue'
import { evaluerFormulaire, verdictChamp, verdictCellule, specTexte } from '../formulaire.js'

const d = inject('doc')
if (!d.saisie || typeof d.saisie !== 'object') d.saisie = {}
if (!d.formulaire || !Array.isArray(d.formulaire.sections)) d.formulaire = { sections: [] }

// Garantit un tableau pour chaque champ « tableau ».
function ensureTables () {
  for (const s of (d.formulaire.sections || [])) for (const ch of (s.champs || [])) {
    if (ch.type === 'tableau' && !Array.isArray(d.saisie[ch.id])) d.saisie[ch.id] = []
  }
}
watch(() => d.formulaire, ensureTables, { deep: true, immediate: true })

const res = computed(() => evaluerFormulaire(d.formulaire, d.saisie))
const stats = computed(() => res.value.stats)
const deviations = computed(() => res.value.deviations)
const vide = computed(() => !(d.formulaire.sections || []).some(s => (s.champs || []).length))

const bInfo = { conforme: { t: 'Conforme', c: 'ok' }, nc: { t: 'Non conforme', c: 'nc' }, vide: { t: 'À saisir', c: 'vide' } }
const vChamp = (ch) => verdictChamp(ch, d.saisie[ch.id])
const vCell = (col, row) => verdictCellule(col, row ? row[col.id] : '')

const statut = computed(() => {
  const s = stats.value
  if (!s.total) return { t: 'Formulaire vide', c: 'g' }
  if (s.saisis === 0) return { t: 'Non démarré', c: 'g' }
  if (s.nc > 0) return { t: `${s.nc} non-conformité(s)`, c: 'r' }
  if (s.pct < 100) return { t: `En cours — ${s.pct} %`, c: 'o' }
  return { t: 'Complet · conforme', c: 'v' }
})

function ligneVide (ch) { const o = {}; for (const col of (ch.colonnes || [])) o[col.id] = ''; return o }
function addLigne (ch) { if (!Array.isArray(d.saisie[ch.id])) d.saisie[ch.id] = []; d.saisie[ch.id].push(ligneVide(ch)) }
function delLigne (ch, i) { d.saisie[ch.id].splice(i, 1) }
function setOui (ch, val) { d.saisie[ch.id] = val }
function setOuiCell (row, col, val) { row[col.id] = val }
</script>

<template>
  <div class="fd">
    <div v-if="vide" class="fd-empty noprint">
      <p class="fd-empty-t">Aucun formulaire pour ce produit</p>
      <p class="fd-empty-s">Ouvrez le <b>Constructeur de formulaire</b> (bouton ✦) pour composer le dossier de ce produit : sections, champs, limites.</p>
    </div>

    <template v-else>
      <!-- Bandeau d'état -->
      <div class="hud" :class="'s-' + statut.c">
        <div class="hud-main"><span class="hud-badge">{{ statut.t }}</span><span class="hud-sub">Dossier configuré — contrôle des paramètres</span></div>
        <div class="hud-stats">
          <div class="ks"><b>{{ stats.pct }}%</b><span>complétude</span></div>
          <div class="ks ok"><b>{{ stats.conformes }}</b><span>conformes</span></div>
          <div class="ks nc"><b>{{ stats.nc }}</b><span>non conf.</span></div>
          <div class="ks"><b>{{ stats.manquants }}</b><span>à saisir</span></div>
        </div>
        <div class="hud-prog"><div class="hud-bar" :style="{ width: stats.pct + '%' }"></div></div>
      </div>

      <!-- Sections -->
      <section v-for="sec in d.formulaire.sections" :key="sec.id" class="fd-sec">
        <h3 class="fd-sec-t">{{ sec.titre || 'Section' }}</h3>

        <div v-for="ch in sec.champs" :key="ch.id" class="fd-champ" :class="{ tab: ch.type === 'tableau' }">
          <!-- Champs simples -->
          <template v-if="ch.type !== 'tableau'">
            <div class="fd-lbl">{{ ch.label || '—' }}<span v-if="ch.obligatoire" class="fd-req">*</span><span v-if="specTexte(ch)" class="fd-spec">{{ specTexte(ch) }}</span></div>
            <div class="fd-ctrl">
              <template v-if="ch.type === 'num'">
                <input class="fd-in" :class="{ nc: vChamp(ch) === 'nc' }" v-model="d.saisie[ch.id]" placeholder="valeur" />
              </template>
              <template v-else-if="ch.type === 'oui_non'">
                <div class="fd-onoff">
                  <button v-for="o in ch.options" :key="o" type="button" :class="{ on: d.saisie[ch.id] === o, bad: d.saisie[ch.id] === o && o !== ch.attendu }" @click="setOui(ch, o)">{{ o }}</button>
                </div>
              </template>
              <template v-else-if="ch.type === 'date'">
                <input class="fd-in" v-model="d.saisie[ch.id]" placeholder="jj/mm/aaaa ou heure" />
              </template>
              <template v-else>
                <input class="fd-in" v-model="d.saisie[ch.id]" placeholder="…" />
              </template>
              <span class="vb" :class="bInfo[vChamp(ch)].c">{{ bInfo[vChamp(ch)].t }}</span>
            </div>
          </template>

          <!-- Tableau -->
          <template v-else>
            <div class="fd-lbl">{{ ch.label || 'Tableau' }}<span v-if="ch.obligatoire" class="fd-req">*</span></div>
            <table class="fd-tbl">
              <thead><tr><th v-for="col in ch.colonnes" :key="col.id">{{ col.label }}<span v-if="specTexte(col)" class="th-spec">{{ specTexte(col) }}</span></th><th></th></tr></thead>
              <tbody>
                <tr v-for="(row, ri) in (d.saisie[ch.id] || [])" :key="ri">
                  <td v-for="col in ch.colonnes" :key="col.id">
                    <div v-if="col.type === 'oui_non'" class="fd-onoff sm">
                      <button v-for="o in (col.options || ['Conforme','Non conforme'])" :key="o" type="button" :class="{ on: row[col.id] === o, bad: row[col.id] === o && o !== col.attendu }" @click="setOuiCell(row, col, o)">{{ o }}</button>
                    </div>
                    <input v-else class="fd-in sm" :class="{ nc: vCell(col, row) === 'nc' }" v-model="row[col.id]" />
                  </td>
                  <td class="ta-c"><button class="fd-del" @click="delLigne(ch, ri)">✕</button></td>
                </tr>
                <tr v-if="!(d.saisie[ch.id] || []).length"><td :colspan="ch.colonnes.length + 1" class="fd-tbl-empty">Aucune ligne.</td></tr>
              </tbody>
            </table>
            <button class="fd-addrow noprint" @click="addLigne(ch)">+ ligne</button>
          </template>
        </div>
      </section>

      <!-- Déviations -->
      <section class="fd-sec dev" :class="{ empty: !deviations.length }">
        <h3 class="dev-t">Déviations — paramètres hors spécification <span class="dev-n">{{ deviations.length }}</span></h3>
        <p v-if="!deviations.length" class="dev-ok">✓ Aucune déviation : tous les paramètres contrôlés saisis sont conformes.</p>
        <ul v-else class="dev-list">
          <li v-for="(dv, i) in deviations" :key="i"><span class="vb nc">NC</span> <b>{{ dv.libelle }}</b> — mesuré : {{ dv.valeur || '—' }}<span v-if="dv.spec"> · spéc. : {{ dv.spec }}</span></li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.fd { color: #1b2733; }
.fd-empty { text-align: center; padding: 42px 22px; background: #fff; border: 1px dashed #cbd5e1; border-radius: 14px; }
.fd-empty-t { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 6px; }
.fd-empty-s { font-size: 13px; color: #64748b; max-width: 540px; margin: 0 auto; line-height: 1.5; }
.hud { border-radius: 14px; padding: 16px 18px 10px; margin-bottom: 16px; color: #fff; position: relative; overflow: hidden; }
.hud.s-g { background: linear-gradient(120deg,#475569,#334155); }
.hud.s-o { background: linear-gradient(120deg,#d97706,#b45309); }
.hud.s-r { background: linear-gradient(120deg,#e11d48,#9f1239); }
.hud.s-v { background: linear-gradient(120deg,#059669,#047857); }
.hud-main { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.hud-badge { font-size: 18px; font-weight: 800; }
.hud-sub { font-size: 12.5px; opacity: .9; }
.hud-stats { display: flex; gap: 22px; margin: 10px 0 12px; flex-wrap: wrap; }
.ks { display: flex; flex-direction: column; font-size: 11px; opacity: .92; }
.ks b { font-size: 20px; font-weight: 800; }
.hud-prog { position: absolute; left: 0; right: 0; bottom: 0; height: 5px; background: rgba(255,255,255,.25); }
.hud-bar { height: 100%; background: #fff; transition: width .3s; }
.fd-sec { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; }
.fd-sec-t { margin: 0 0 10px; font-size: 14px; color: #0e7490; }
.fd-champ { display: grid; grid-template-columns: 1fr; gap: 4px; padding: 7px 0; border-bottom: 1px solid #f1f5f9; }
.fd-champ:last-child { border-bottom: 0; }
.fd-lbl { font-size: 13px; font-weight: 600; color: #334155; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.fd-req { color: #be123c; font-weight: 800; }
.fd-spec { font-size: 11.5px; color: #64748b; font-weight: 400; }
.fd-ctrl { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.fd-in { font: inherit; font-size: 13px; padding: 7px 9px; border: 1px solid #cbd5e1; border-radius: 7px; min-width: 130px; }
.fd-in.sm { min-width: 0; width: 100%; padding: 5px 7px; }
.fd-in.nc { border-color: #fca5a5; background: #fef2f2; }
.fd-onoff { display: inline-flex; gap: 4px; }
.fd-onoff button { font: inherit; font-size: 12px; font-weight: 600; padding: 6px 12px; border: 1px solid #cbd5e1; background: #fff; color: #475569; border-radius: 7px; cursor: pointer; }
.fd-onoff.sm button { padding: 4px 8px; font-size: 11px; }
.fd-onoff button.on { background: #0891b2; color: #fff; border-color: #0891b2; }
.fd-onoff button.on.bad { background: #e11d48; border-color: #e11d48; }
.vb { display: inline-block; font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
.vb.ok { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
.vb.nc { background: #fef2f2; color: #be123c; border: 1px solid #fecaca; }
.vb.vide { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }
.fd-tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-top: 4px; }
.fd-tbl th { text-align: left; font-size: 10.5px; color: #64748b; padding: 5px 6px; border-bottom: 1px solid #e2e8f0; }
.fd-tbl .th-spec { display: block; font-weight: 400; color: #94a3b8; font-size: 10px; }
.fd-tbl td { padding: 3px 5px; border-bottom: 1px solid #f6f8fa; }
.fd-tbl-empty { text-align: center; color: #94a3b8; font-style: italic; }
.fd-del { border: 0; background: #fef2f2; color: #be123c; border-radius: 6px; padding: 3px 7px; cursor: pointer; font-size: 11px; }
.fd-addrow { font: inherit; font-size: 11px; font-weight: 600; color: #0e7490; background: #ecfeff; border: 1px solid #a5f3fc; border-radius: 6px; padding: 3px 10px; cursor: pointer; margin-top: 6px; }
.ta-c { text-align: center; }
.dev { border-color: #fecaca; } .dev.empty { border-color: #a7f3d0; }
.dev-t { color: #be123c; font-size: 14px; margin: 0 0 6px; display: flex; align-items: center; gap: 8px; }
.dev-n { background: #be123c; color: #fff; font-size: 11px; font-weight: 800; min-width: 20px; text-align: center; padding: 1px 7px; border-radius: 999px; }
.dev-ok { color: #047857; font-size: 13px; margin: 2px 0 0; }
.dev-list { list-style: none; padding: 0; margin: 6px 0 0; font-size: 12.5px; color: #334155; }
.dev-list li { padding: 5px 0; border-bottom: 1px dashed #f1f5f9; display: flex; gap: 8px; align-items: baseline; }
</style>
