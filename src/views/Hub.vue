<template>
  <div class="hub-root">
    <div v-if="!authSession" class="hub-login">
      <div class="hub-login-card">
        <div class="hub-login-brand">ProdTrack</div>
        <h2>Connexion</h2>
        <input v-model="authEmail" type="email" placeholder="Identifiant (e-mail)" autocomplete="username" @keyup.enter="seConnecter" />
        <input v-model="authPassword" type="password" placeholder="Mot de passe" autocomplete="current-password" @keyup.enter="seConnecter" />
        <button class="hub-login-btn" @click="seConnecter" :disabled="authEnCours">{{ authEnCours ? 'Connexion…' : 'Se connecter' }}</button>
        <p v-if="authErreur" class="hub-login-err">{{ authErreur }}</p>
        <a href="#/login" class="hub-login-alt">Lien magique / mot de passe oublié</a>
      </div>
    </div>
      <div class="m-convoyeur" v-if="style === 'convoyeur'">
    <header class="ph">
      <div class="ph-brand"><span class="ph-mark">▸</span>ProdTrack<span class="ph-sub">Chaîne de production</span></div>
      <div class="ph-right">
        <span class="ph-clock">{{ heure }}</span>
        <span class="ph-status"><i></i> En service</span>
      </div>
    </header>

    <div class="ligne-wrap">
      <div class="line-band">
        <div class="conveyor">
          <div class="belt"></div>
          <div class="sweep"></div>
          <div class="batch"></div>
          <div class="batch b2"></div>
        </div>
        <div class="stations">
          <div v-for="(g, i) in flux" :key="g.label" class="station" :class="{ open: selected === i }" :style="{ '--c': g.c }">
            <button class="st-node" @click="toggle(i)" :title="g.label">
              <span class="st-badge">{{ i + 1 }}</span>
              <svg viewBox="0 0 24 24" v-html="g.icon"></svg>
            </button>
            <button class="st-label" @click="toggle(i)">{{ g.label }} <span class="st-caret">▾</span></button>
            <transition name="drop">
              <div v-if="selected === i" class="st-drop">
                <button v-for="l in g.links" :key="l[0]" class="st-page" @click="aller(l[0])">{{ l[1] }}</button>
              </div>
            </transition>
          </div>
        </div>
      </div>
      <div class="hint">Cliquez une étape pour afficher ses pages &nbsp;·&nbsp; Flux de production &rarr;</div>
    </div>
  </div>

      <div class="m-grille" v-else-if="style === 'grille'">
    <header class="ph">
      <div class="ph-brand"><span class="ph-mark">▸</span>ProdTrack<span class="ph-sub">Chaîne de production</span></div>
      <div class="ph-right">
        <span class="ph-clock">{{ heure }}</span>
        <span class="ph-status"><i></i> En service</span>
      </div>
    </header>

    <div class="grid-wrap">
      <div class="hint">Chaîne de production &middot; {{ flux.length }} modules &middot; toutes les pages accessibles</div>
      <div class="grid">
        <section v-for="(g, i) in flux" :key="g.label" class="mod" :style="{ '--c': g.c }">
          <div class="mod-top">
            <span class="mod-ic"><svg viewBox="0 0 24 24" v-html="g.icon"></svg></span>
            <div class="mod-titles">
              <span class="mod-step">Étape {{ i + 1 }}</span>
              <h2 class="mod-title">{{ g.label }}</h2>
            </div>
            <span class="mod-count">{{ g.links.length }}</span>
          </div>
          <div class="mod-links">
            <button v-for="l in g.links" :key="l[0]" class="mod-link" @click="aller(l[0])">
              <span class="mod-dot"></span>{{ l[1] }}<span class="mod-arrow">&rarr;</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  </div>

      <div class="m-flux" v-else-if="style === 'flux'">
    <header class="ph">
      <div class="ph-brand"><span class="ph-mark">▸</span>ProdTrack<span class="ph-sub">Chaîne de production</span></div>
      <div class="ph-right">
        <span class="ph-clock">{{ heure }}</span>
        <span class="ph-status"><i></i> En service</span>
      </div>
    </header>

    <div class="flow-wrap">
      <div class="hint">Flux de production &middot; de la configuration au pilotage</div>
      <ol class="flow">
        <li v-for="(g, i) in flux" :key="g.label" class="step" :class="{ last: i === flux.length - 1 }" :style="{ '--c': g.c }">
          <div class="step-rail">
            <span class="step-num">{{ i + 1 }}</span>
          </div>
          <div class="step-card">
            <div class="step-head">
              <span class="step-ic"><svg viewBox="0 0 24 24" v-html="g.icon"></svg></span>
              <h2 class="step-title">{{ g.label }}</h2>
              <span class="step-count">{{ g.links.length }} pages</span>
            </div>
            <div class="step-chips">
              <button v-for="l in g.links" :key="l[0]" class="chip" @click="aller(l[0])">{{ l[1] }}</button>
            </div>
          </div>
        </li>
      </ol>
    </div>
  </div>

      <div class="m-mosaique" v-else-if="style === 'mosaique'">
    <header class="ph">
      <div class="ph-brand"><span class="ph-mark">▸</span>ProdTrack<span class="ph-sub">Chaîne de production</span></div>
      <div class="ph-right">
        <span class="ph-clock">{{ heure }}</span>
        <span class="ph-status"><i></i> En service</span>
      </div>
    </header>

    <div class="bento-wrap">
      <div class="hint">Tableau de bord des modules &middot; {{ totalPages }} pages</div>
      <div class="bento">
        <section v-for="(g, i) in flux" :key="g.label" class="tile" :class="'span-' + (g.links.length >= 7 ? 2 : 1)" :style="{ '--c': g.c }">
          <div class="tile-head">
            <span class="tile-ic"><svg viewBox="0 0 24 24" v-html="g.icon"></svg></span>
            <div class="tile-tt">
              <span class="tile-step">{{ String(i + 1).padStart(2, '0') }}</span>
              <h2 class="tile-title">{{ g.label }}</h2>
            </div>
          </div>
          <div class="tile-links">
            <button v-for="l in g.links" :key="l[0]" class="tile-link" @click="aller(l[0])">{{ l[1] }}</button>
          </div>
        </section>
      </div>
    </div>
  </div>

      <div class="m-lateral" v-else-if="style === 'lateral'">
    <aside class="side">
      <div class="side-brand"><span class="ph-mark">▸</span>ProdTrack</div>
      <div class="side-sub">Chaîne de production</div>
      <nav class="side-nav">
        <button v-for="(g, i) in flux" :key="g.label" class="side-item" :class="{ on: selected === i }" :style="{ '--c': g.c }" @click="selected = i">
          <span class="side-ic"><svg viewBox="0 0 24 24" v-html="g.icon"></svg></span>
          <span class="side-txt">{{ g.label }}</span>
          <span class="side-n">{{ g.links.length }}</span>
        </button>
      </nav>
      <div class="side-foot"><span class="ph-status"><i></i> En service</span><span class="side-clock">{{ heure }}</span></div>
    </aside>

    <main class="main" :style="{ '--c': cur.c }">
      <div class="main-head">
        <span class="main-ic"><svg viewBox="0 0 24 24" v-html="cur.icon"></svg></span>
        <div>
          <span class="main-step">Étape {{ selected + 1 }} / {{ flux.length }}</span>
          <h1 class="main-title">{{ cur.label }}</h1>
        </div>
      </div>
      <div class="main-grid">
        <button v-for="l in cur.links" :key="l[0]" class="main-card" @click="aller(l[0])">
          <span class="mc-label">{{ l[1] }}</span>
          <span class="mc-go">Ouvrir &rarr;</span>
        </button>
      </div>
    </main>
  </div>

      <div class="m-hero" v-else-if="style === 'hero'">
    <header class="ph">
      <div class="ph-brand"><span class="ph-mark">▸</span>ProdTrack<span class="ph-sub">Chaîne de production</span></div>
      <div class="ph-right">
        <span class="ph-clock">{{ heure }}</span>
        <span class="ph-status"><i></i> En service</span>
      </div>
    </header>

    <div class="hero-wrap">
      <section v-for="(g, i) in flux" :key="g.label" class="hero" :style="{ '--c': g.c }">
        <div class="hero-left">
          <span class="hero-num">{{ String(i + 1).padStart(2, '0') }}</span>
          <span class="hero-ic"><svg viewBox="0 0 24 24" v-html="g.icon"></svg></span>
          <h2 class="hero-title">{{ g.label }}</h2>
          <span class="hero-count">{{ g.links.length }} pages</span>
        </div>
        <div class="hero-links">
          <button v-for="l in g.links" :key="l[0]" class="hero-link" @click="aller(l[0])">
            {{ l[1] }}<span class="hl-arrow">&rarr;</span>
          </button>
        </div>
      </section>
    </div>
  </div>

    <div class="style-switch">
      <span class="ss-lbl">Style</span>
      <button v-for="s in styles" :key="s.k" class="ss-btn" :class="{ on: style === s.k }" @click="setStyle(s.k)">{{ s.label }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { supabase } from '../supabase'
const authSession = ref(null)
const authEmail = ref(''), authPassword = ref(''), authErreur = ref(''), authEnCours = ref(false)
supabase.auth.getSession().then(({ data }) => { authSession.value = data.session })
supabase.auth.onAuthStateChange((_e, sess) => { authSession.value = sess })
async function seConnecter() {
  authErreur.value = ''
  if (!authEmail.value.trim() || !authPassword.value) { authErreur.value = 'Identifiant et mot de passe requis.'; return }
  authEnCours.value = true
  const res = await supabase.auth.signInWithPassword({ email: authEmail.value.trim(), password: authPassword.value })
  authEnCours.value = false
  if (res.error) authErreur.value = 'Identifiant ou mot de passe incorrect.'
}
import { useRouter } from 'vue-router'

const router = useRouter()
function aller(p) { router.push(p) }

const selected = ref(null)  // tous les menus fermés à l'ouverture
function toggle(i) { selected.value = selected.value === i ? null : i }

const heure = ref('')
let timer = null
function maj() { heure.value = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
onMounted(() => { maj(); timer = setInterval(maj, 1000) })
onUnmounted(() => clearInterval(timer))

const S = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"'
const flux = [
  { label: 'Configuration', c: '#64748b',
    icon: `<g ${S}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></g>`,
    links: [['/referentiels', 'Référentiels'], ['/cadences', 'Cadences'], ['/habilitations', 'Habilitations'], ['/effectifs', 'Effectifs']] },
  { label: 'Ordonnancement & OF', c: '#6366f1',
    icon: `<g ${S}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></g>`,
    links: [['/ordonnancement', 'Ordonnancement'], ['/plan', 'Plan directeur'], ['/ordres', 'Ordres de fabrication'], ['/planning-equipements', 'Planning équipements']] },
  { label: 'Suivi de production', c: '#0ea5e9',
    icon: `<g ${S}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></g>`,
    links: [['/temps-reel', 'Suivi temps réel'], ['/dispo-equipements', 'Disponibilité équipements'], ['/avancement', 'Suivi du process'], ['/production-atelier', 'Production par atelier'], ['/suivi-trs', 'Suivi TRS'], ['/capacite', 'Capacité équipements'], ['/encours', 'En-cours'], ['/dossier', 'Dossier de lot'], ['/historique', 'Historique des opérations']] },
  { label: 'Saisie & exécution', c: '#14b8a6',
    icon: `<g ${S}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></g>`,
    links: [['/suivi', 'Suivi fab. & Saisie TRS'], ['/conditionnement', 'Conditionnement'], ['/passation', 'Passation de consigne']] },
  { label: 'Qualité — DDL', c: '#f43f5e',
    icon: `<g ${S}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></g>`,
    links: [['/verification-ddl', 'DDL Fab — Production'], ['/verification-ddl-aq', 'DDL Fab — AQ'], ['/verification-ddl-cond', 'DDL Conditionnement'], ['/audit', "Journal d'audit"]] },
  { label: 'Pilotage', c: '#22c55e',
    icon: `<g ${S}><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></g>`,
    links: [['/tableau-de-bord', 'Tableau de bord'], ['/realisation-plan', 'Réalisation vs Plan'], ['/realisation-pdp', 'Réalisation PDP par phase'], ['/pdp-equipement', 'PDP par équipement'], ['/rendement', 'Rendement'], ['/ca', "Chiffre d'affaires"], ['/qse', 'Indicateurs QSE']] }
]
const cur = computed(() => flux[selected.value] || flux[0])
const totalPages = computed(() => flux.reduce((s, g) => s + g.links.length, 0))

const styles = [
  { k: 'convoyeur', label: 'Convoyeur' },
  { k: 'grille', label: 'Grille' },
  { k: 'flux', label: 'Flux' },
  { k: 'mosaique', label: 'Mosaïque' },
  { k: 'lateral', label: 'Latéral' },
  { k: 'hero', label: 'Héro' }
]
const CLE = 'prodtrack_hub_style'
const saved = (() => { try { return localStorage.getItem(CLE) } catch (e) { return null } })()
const valid = styles.map(s => s.k)
const style = ref(saved && valid.includes(saved) ? saved : 'convoyeur')
if (style.value === 'lateral') selected.value = 0
function setStyle(k) { style.value = k; if (k === 'lateral' && (selected.value == null)) selected.value = 0; try { localStorage.setItem(CLE, k) } catch (e) {} }
</script>

<style scoped>
.hub-root { position: fixed; inset: 0; z-index: 60; }
.style-switch { position: fixed; z-index: 90; bottom: 16px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 4px; background: rgba(255,255,255,.92); backdrop-filter: blur(10px); border: 1px solid #e2e8f0; border-radius: 999px; padding: 5px 6px; box-shadow: 0 10px 30px rgba(15,23,42,.22); }
.ss-lbl { font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #94a3b8; padding: 0 8px 0 6px; }
.ss-btn { font: inherit; font-size: 12px; font-weight: 700; color: #64748b; background: none; border: 0; border-radius: 999px; padding: 7px 14px; cursor: pointer; transition: background .12s ease, color .12s ease; white-space: nowrap; }
.ss-btn:hover { color: #0f172a; background: #f1f5f9; }
.ss-btn.on { color: #fff; background: #5b9bd5; box-shadow: 0 2px 8px rgba(91,155,213,.4); }
@media (max-width: 760px) { .style-switch { flex-wrap: wrap; justify-content: center; width: calc(100% - 20px); border-radius: 16px; bottom: 10px; } .ss-lbl { width: 100%; text-align: center; padding: 2px 0 4px; } }

/* Keyframes partagées */
@keyframes belt { to { background-position: 24px 0; } }
@keyframes sweep { from { background-position: -240px 0; } to { background-position: 110% 0; } }
@keyframes batch { from { left: 1.5%; } to { left: 96.5%; } }
@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: .4; } }

/* ===== convoyeur ===== */
.m-convoyeur {
  position: fixed; inset: 0; z-index: 60; overflow: auto; color: #1e293b;
  font-family: 'Segoe UI', system-ui, sans-serif;
  background:
    linear-gradient(rgba(148,163,184,.06) 1px, transparent 1px) 0 0 / 100% 34px,
    linear-gradient(90deg, rgba(148,163,184,.06) 1px, transparent 1px) 0 0 / 34px 100%,
    linear-gradient(155deg, #f2f6fb 0%, #e7eef6 100%);
}
.m-convoyeur .ph { display: flex; justify-content: space-between; align-items: center; padding: 24px 42px 6px; }
.m-convoyeur .ph-brand { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -.4px; display: flex; align-items: center; gap: 11px; }
.m-convoyeur .ph-mark { color: #5b9bd5; font-size: 15px; }
.m-convoyeur .ph-sub { font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 2.5px; text-transform: uppercase; margin-left: 13px; padding-left: 13px; border-left: 2px solid #cbd5e1; }
.m-convoyeur .ph-right { display: flex; align-items: center; gap: 20px; }
.m-convoyeur .ph-clock { font-family: 'Consolas', ui-monospace, monospace; font-size: 16px; font-weight: 600; color: #334155; letter-spacing: 2px; }
.m-convoyeur .ph-status { font-size: 11.5px; font-weight: 700; color: #16a34a; letter-spacing: .5px; text-transform: uppercase; display: flex; align-items: center; gap: 7px; }
.m-convoyeur .ph-status i { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 9px #22c55e; animation: blink 2s ease-in-out infinite; }
.m-convoyeur .ligne-wrap { position: relative; padding: 44px 56px 60px; min-height: 480px; }
.m-convoyeur .hint { text-align: center; font-size: 11.5px; font-weight: 700; color: #94a3b8; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 30px; }
.m-convoyeur /* Convoyeur + stations */
.line-band { position: relative; }
.m-convoyeur .conveyor { position: absolute; left: 4%; right: 4%; top: 18px; height: 44px; border-radius: 9px;
  background: linear-gradient(#414d5f, #29313d); box-shadow: inset 0 3px 9px rgba(0,0,0,.5), 0 10px 24px rgba(30,41,59,.18); overflow: hidden; z-index: 1; }
.m-convoyeur .belt { position: absolute; inset: 0; background: repeating-linear-gradient(90deg, rgba(0,0,0,.22) 0 2px, transparent 2px 24px); animation: belt 1.1s linear infinite; }
.m-convoyeur .sweep { position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(91,155,213,.30), transparent); background-size: 240px 100%; background-repeat: no-repeat; animation: sweep 3.2s linear infinite; }
.m-convoyeur .batch { position: absolute; top: 50%; margin-top: -6px; width: 24px; height: 12px; border-radius: 7px; background: linear-gradient(#fff, #d3e4f6); box-shadow: 0 2px 6px rgba(0,0,0,.4); z-index: 2; animation: batch 8s linear infinite; }
.m-convoyeur .batch.b2 { animation-delay: -4s; }
.m-convoyeur .stations { display: flex; justify-content: space-between; align-items: flex-start; position: relative; z-index: 3; }
.m-convoyeur .station { position: relative; display: flex; flex-direction: column; align-items: center; }
.m-convoyeur .st-node { width: 80px; height: 80px; border-radius: 19px; background: #fff; border: 2px solid var(--c); color: var(--c); position: relative; cursor: pointer;
  box-shadow: 0 9px 24px rgba(30,41,59,.15), 0 0 0 6px #eef3f9; display: flex; align-items: center; justify-content: center;
  transition: transform .2s ease, box-shadow .2s ease; }
.m-convoyeur .st-node svg { width: 35px; height: 35px; stroke: var(--c); }
.m-convoyeur .station:hover .st-node, .m-convoyeur .station.open .st-node { transform: translateY(-5px) scale(1.05); box-shadow: 0 16px 30px rgba(30,41,59,.22), 0 0 0 6px #fff; }
.m-convoyeur .st-badge { position: absolute; top: -11px; left: -11px; width: 25px; height: 25px; border-radius: 50%; background: var(--c); color: #fff;
  font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 7px rgba(0,0,0,.22); }
.m-convoyeur .st-label { margin-top: 15px; background: none; border: none; cursor: pointer; font: inherit; font-size: 13px; font-weight: 700; color: #1e293b;
  display: inline-flex; align-items: center; gap: 5px; text-align: center; }
.m-convoyeur .st-caret { font-size: 10px; color: var(--c); transition: transform .2s ease; }
.m-convoyeur .station.open .st-caret { transform: rotate(180deg); }
.m-convoyeur /* Déroulé des pages */
.st-drop { position: absolute; top: calc(100% + 14px); left: 50%; transform: translateX(-50%); width: 200px; z-index: 10;
  background: #fff; border: 1px solid #e2e8f0; border-top: 3px solid var(--c); border-radius: 13px; padding: 8px; display: flex; flex-direction: column; gap: 2px;
  box-shadow: 0 18px 40px rgba(30,41,59,.22); }
.m-convoyeur .st-drop::before { content: ''; position: absolute; top: -8px; left: 50%; transform: translateX(-50%) rotate(45deg); width: 14px; height: 14px; background: #fff; border-left: 1px solid #e2e8f0; border-top: 1px solid #e2e8f0; }
.m-convoyeur .st-page { background: none; border: none; text-align: left; cursor: pointer; font: inherit; font-size: 13px; color: #334155; padding: 9px 11px; border-radius: 8px; transition: background .12s ease, color .12s ease, padding .12s ease; }
.m-convoyeur .st-page:hover { background: #f1f5f9; color: #0f172a; padding-left: 15px; }
.m-convoyeur .drop-enter-active, .m-convoyeur .drop-leave-active { transition: opacity .16s ease, transform .16s ease; }
.m-convoyeur .drop-enter-from, .m-convoyeur .drop-leave-to { opacity: 0; transform: translateX(-50%) translateY(-6px); }
@media (max-width: 880px) {
.m-convoyeur .ph { padding: 18px 20px; flex-wrap: wrap; gap: 10px; }
.m-convoyeur .ph-sub { display: none; }
.m-convoyeur .ligne-wrap { padding: 24px 18px 40px; min-height: 0; }
.m-convoyeur .conveyor { display: none; }
.m-convoyeur .stations { flex-direction: column; align-items: stretch; gap: 12px; }
.m-convoyeur .station { align-items: stretch; }
.m-convoyeur .st-node { width: 54px; height: 54px; border-radius: 14px; }
.m-convoyeur .st-node svg { width: 24px; height: 24px; }
.m-convoyeur .station { flex-direction: row; align-items: center; gap: 12px; flex-wrap: wrap; }
.m-convoyeur .st-label { margin-top: 0; }
.m-convoyeur .st-drop { position: static; transform: none; width: 100%; margin-top: 6px; }
.m-convoyeur .st-drop::before { display: none; }
.m-convoyeur .drop-enter-from, .m-convoyeur .drop-leave-to { transform: translateY(-6px); }
}
@media (prefers-reduced-motion: reduce) {
.m-convoyeur .belt, .m-convoyeur .sweep, .m-convoyeur .batch, .m-convoyeur .ph-status i { animation: none; }
}

/* ===== grille ===== */
.m-grille {
  position: fixed; inset: 0; z-index: 60; overflow: auto; color: #1e293b;
  font-family: 'Segoe UI', system-ui, sans-serif;
  background:
    linear-gradient(rgba(148,163,184,.06) 1px, transparent 1px) 0 0 / 100% 34px,
    linear-gradient(90deg, rgba(148,163,184,.06) 1px, transparent 1px) 0 0 / 34px 100%,
    linear-gradient(155deg, #f2f6fb 0%, #e7eef6 100%);
}
.m-grille .ph { display: flex; justify-content: space-between; align-items: center; padding: 24px 42px 6px; }
.m-grille .ph-brand { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -.4px; display: flex; align-items: center; gap: 11px; }
.m-grille .ph-mark { color: #5b9bd5; font-size: 15px; }
.m-grille .ph-sub { font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 2.5px; text-transform: uppercase; margin-left: 13px; padding-left: 13px; border-left: 2px solid #cbd5e1; }
.m-grille .ph-right { display: flex; align-items: center; gap: 20px; }
.m-grille .ph-clock { font-family: 'Consolas', ui-monospace, monospace; font-size: 16px; font-weight: 600; color: #334155; letter-spacing: 2px; }
.m-grille .ph-status { font-size: 11.5px; font-weight: 700; color: #16a34a; letter-spacing: .5px; text-transform: uppercase; display: flex; align-items: center; gap: 7px; }
.m-grille .ph-status i { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 9px #22c55e; animation: blink 2s ease-in-out infinite; }
.m-grille .grid-wrap { padding: 24px 42px 60px; }
.m-grille .hint { text-align: center; font-size: 11.5px; font-weight: 700; color: #94a3b8; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 26px; }
.m-grille .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; max-width: 1280px; margin: 0 auto; }
.m-grille .mod {
  background: #fff; border: 1px solid #e6ecf3; border-radius: 18px; overflow: hidden;
  box-shadow: 0 2px 8px rgba(30,41,59,.05); border-top: 4px solid var(--c);
  transition: transform .18s ease, box-shadow .18s ease; display: flex; flex-direction: column;
}
.m-grille .mod:hover { transform: translateY(-4px); box-shadow: 0 14px 32px rgba(30,41,59,.13); }
.m-grille .mod-top { display: flex; align-items: center; gap: 13px; padding: 16px 18px 12px; }
.m-grille .mod-ic { width: 46px; height: 46px; border-radius: 13px; flex: none; display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--c) 12%, #fff); color: var(--c); }
.m-grille .mod-ic svg { width: 26px; height: 26px; stroke: var(--c); }
.m-grille .mod-titles { flex: 1; min-width: 0; }
.m-grille .mod-step { font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--c); }
.m-grille .mod-title { margin: 1px 0 0; font-size: 15.5px; font-weight: 800; color: #0f172a; letter-spacing: -.01em; }
.m-grille .mod-count { flex: none; font-size: 12px; font-weight: 800; color: var(--c); background: color-mix(in srgb, var(--c) 12%, #fff);
  border-radius: 20px; padding: 3px 10px; }
.m-grille .mod-links { padding: 4px 10px 12px; display: flex; flex-direction: column; gap: 1px; }
.m-grille .mod-link { display: flex; align-items: center; gap: 9px; background: none; border: 0; text-align: left; cursor: pointer;
  font: inherit; font-size: 13px; color: #334155; padding: 9px 10px; border-radius: 9px; transition: background .12s ease, color .12s ease; }
.m-grille .mod-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--c); flex: none; opacity: .55; }
.m-grille .mod-arrow { margin-left: auto; color: var(--c); opacity: 0; transform: translateX(-4px); transition: opacity .12s ease, transform .12s ease; font-weight: 700; }
.m-grille .mod-link:hover { background: color-mix(in srgb, var(--c) 8%, #f8fafc); color: #0f172a; }
.m-grille .mod-link:hover .mod-dot { opacity: 1; }
.m-grille .mod-link:hover .mod-arrow { opacity: 1; transform: translateX(0); }
@media (max-width: 880px) {
.m-grille .ph { padding: 18px 20px; flex-wrap: wrap; gap: 10px; }
.m-grille .ph-sub { display: none; }
.m-grille .grid-wrap { padding: 20px 16px 40px; }
.m-grille .grid { grid-template-columns: 1fr; gap: 14px; }
}
@media (prefers-reduced-motion: reduce) {
.m-grille .ph-status i { animation: none; }
.m-grille .mod { transition: none; }
}

/* ===== flux ===== */
.m-flux {
  position: fixed; inset: 0; z-index: 60; overflow: auto; color: #1e293b;
  font-family: 'Segoe UI', system-ui, sans-serif;
  background:
    linear-gradient(rgba(148,163,184,.06) 1px, transparent 1px) 0 0 / 100% 34px,
    linear-gradient(90deg, rgba(148,163,184,.06) 1px, transparent 1px) 0 0 / 34px 100%,
    linear-gradient(155deg, #f2f6fb 0%, #e7eef6 100%);
}
.m-flux .ph { display: flex; justify-content: space-between; align-items: center; padding: 24px 42px 6px; }
.m-flux .ph-brand { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -.4px; display: flex; align-items: center; gap: 11px; }
.m-flux .ph-mark { color: #5b9bd5; font-size: 15px; }
.m-flux .ph-sub { font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 2.5px; text-transform: uppercase; margin-left: 13px; padding-left: 13px; border-left: 2px solid #cbd5e1; }
.m-flux .ph-right { display: flex; align-items: center; gap: 20px; }
.m-flux .ph-clock { font-family: 'Consolas', ui-monospace, monospace; font-size: 16px; font-weight: 600; color: #334155; letter-spacing: 2px; }
.m-flux .ph-status { font-size: 11.5px; font-weight: 700; color: #16a34a; letter-spacing: .5px; text-transform: uppercase; display: flex; align-items: center; gap: 7px; }
.m-flux .ph-status i { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 9px #22c55e; animation: blink 2s ease-in-out infinite; }
.m-flux .flow-wrap { padding: 24px 42px 60px; max-width: 900px; margin: 0 auto; }
.m-flux .hint { text-align: center; font-size: 11.5px; font-weight: 700; color: #94a3b8; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 26px; }
.m-flux .flow { list-style: none; margin: 0; padding: 0; }
.m-flux .step { position: relative; display: grid; grid-template-columns: 52px 1fr; gap: 18px; padding-bottom: 18px; }
.m-flux /* Rail vertical + numéro */
.step-rail { position: relative; display: flex; justify-content: center; }
.m-flux .step-num { width: 40px; height: 40px; border-radius: 50%; background: #fff; border: 2px solid var(--c); color: var(--c);
  font-size: 16px; font-weight: 800; display: flex; align-items: center; justify-content: center; z-index: 2;
  box-shadow: 0 4px 12px rgba(30,41,59,.12); }
.m-flux .step:not(.last) .step-rail::after { content: ''; position: absolute; top: 40px; bottom: -18px; left: 50%; transform: translateX(-50%);
  width: 3px; background: linear-gradient(var(--c), color-mix(in srgb, var(--c) 30%, #e2e8f0)); border-radius: 3px; z-index: 1; }
.m-flux /* Carte de l'étape */
.step-card { background: #fff; border: 1px solid #e6ecf3; border-radius: 16px; padding: 14px 18px 16px;
  box-shadow: 0 2px 8px rgba(30,41,59,.05); border-left: 4px solid var(--c); }
.m-flux .step-head { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.m-flux .step-ic { width: 40px; height: 40px; border-radius: 11px; flex: none; display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--c) 12%, #fff); color: var(--c); }
.m-flux .step-ic svg { width: 23px; height: 23px; stroke: var(--c); }
.m-flux .step-title { flex: 1; margin: 0; font-size: 16px; font-weight: 800; color: #0f172a; letter-spacing: -.01em; }
.m-flux .step-count { flex: none; font-size: 10.5px; font-weight: 700; color: var(--c); background: color-mix(in srgb, var(--c) 12%, #fff);
  border-radius: 20px; padding: 3px 10px; text-transform: uppercase; letter-spacing: .04em; }
.m-flux .step-chips { display: flex; flex-wrap: wrap; gap: 7px; }
.m-flux .chip { background: #f6f8fb; border: 1px solid #e2e8f0; border-radius: 9px; cursor: pointer; font: inherit; font-size: 12.5px;
  font-weight: 600; color: #334155; padding: 7px 13px; transition: all .12s ease; }
.m-flux .chip:hover { background: color-mix(in srgb, var(--c) 12%, #fff); border-color: var(--c); color: var(--c); transform: translateY(-1px); }
@media (max-width: 880px) {
.m-flux .ph { padding: 18px 20px; flex-wrap: wrap; gap: 10px; }
.m-flux .ph-sub { display: none; }
.m-flux .flow-wrap { padding: 20px 16px 40px; }
.m-flux .step { grid-template-columns: 40px 1fr; gap: 12px; }
.m-flux .step-num { width: 32px; height: 32px; font-size: 14px; }
.m-flux .step:not(.last) .step-rail::after { top: 32px; }
}
@media (prefers-reduced-motion: reduce) {
.m-flux .ph-status i { animation: none; }
.m-flux .chip { transition: none; }
}

/* ===== mosaique ===== */
.m-mosaique {
  position: fixed; inset: 0; z-index: 60; overflow: auto; color: #1e293b;
  font-family: 'Segoe UI', system-ui, sans-serif;
  background:
    linear-gradient(rgba(148,163,184,.06) 1px, transparent 1px) 0 0 / 100% 34px,
    linear-gradient(90deg, rgba(148,163,184,.06) 1px, transparent 1px) 0 0 / 34px 100%,
    linear-gradient(155deg, #eef3f9 0%, #e3ebf4 100%);
}
.m-mosaique .ph { display: flex; justify-content: space-between; align-items: center; padding: 24px 42px 6px; }
.m-mosaique .ph-brand { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -.4px; display: flex; align-items: center; gap: 11px; }
.m-mosaique .ph-mark { color: #5b9bd5; font-size: 15px; }
.m-mosaique .ph-sub { font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 2.5px; text-transform: uppercase; margin-left: 13px; padding-left: 13px; border-left: 2px solid #cbd5e1; }
.m-mosaique .ph-right { display: flex; align-items: center; gap: 20px; }
.m-mosaique .ph-clock { font-family: 'Consolas', ui-monospace, monospace; font-size: 16px; font-weight: 600; color: #334155; letter-spacing: 2px; }
.m-mosaique .ph-status { font-size: 11.5px; font-weight: 700; color: #16a34a; letter-spacing: .5px; text-transform: uppercase; display: flex; align-items: center; gap: 7px; }
.m-mosaique .ph-status i { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 9px #22c55e; animation: blink 2s ease-in-out infinite; }
.m-mosaique .bento-wrap { padding: 22px 42px 60px; max-width: 1320px; margin: 0 auto; }
.m-mosaique .hint { text-align: center; font-size: 11.5px; font-weight: 700; color: #94a3b8; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 22px; }
.m-mosaique .bento { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; grid-auto-flow: dense; }
.m-mosaique .tile { grid-column: span 1; background: #fff; border-radius: 18px; padding: 16px 18px; position: relative; overflow: hidden;
  box-shadow: 0 2px 8px rgba(30,41,59,.05); border: 1px solid #e6ecf3;
  transition: transform .18s ease, box-shadow .18s ease; }
.m-mosaique .tile::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 5px; background: var(--c); }
.m-mosaique .tile.span-2 { grid-column: span 2; }
.m-mosaique .tile:hover { transform: translateY(-4px); box-shadow: 0 16px 34px rgba(30,41,59,.14); }
.m-mosaique .tile-head { display: flex; align-items: center; gap: 12px; margin-bottom: 13px; }
.m-mosaique .tile-ic { width: 44px; height: 44px; border-radius: 12px; flex: none; display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--c) 13%, #fff); color: var(--c); }
.m-mosaique .tile-ic svg { width: 25px; height: 25px; stroke: var(--c); }
.m-mosaique .tile-tt { display: flex; flex-direction: column; }
.m-mosaique .tile-step { font-family: 'Consolas', ui-monospace, monospace; font-size: 12px; font-weight: 800; color: var(--c); opacity: .7; }
.m-mosaique .tile-title { margin: 0; font-size: 15.5px; font-weight: 800; color: #0f172a; letter-spacing: -.01em; }
.m-mosaique .tile-links { display: grid; grid-template-columns: 1fr; gap: 4px; }
.m-mosaique .tile.span-2 .tile-links { grid-template-columns: 1fr 1fr; }
.m-mosaique .tile-link { background: #f6f8fb; border: 1px solid transparent; border-radius: 9px; cursor: pointer; font: inherit; font-size: 12.5px;
  font-weight: 600; color: #475569; padding: 8px 11px; text-align: left; transition: all .12s ease; }
.m-mosaique .tile-link:hover { background: color-mix(in srgb, var(--c) 12%, #fff); color: var(--c); border-color: var(--c); }
@media (max-width: 1080px) {
.m-mosaique .bento { grid-template-columns: repeat(2, 1fr); }
.m-mosaique .tile.span-2 { grid-column: span 2; }
.m-mosaique .tile.span-2 .tile-links { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 720px) {
.m-mosaique .ph { padding: 18px 20px; flex-wrap: wrap; gap: 10px; }
.m-mosaique .ph-sub { display: none; }
.m-mosaique .bento-wrap { padding: 18px 16px 40px; }
.m-mosaique .bento { grid-template-columns: 1fr; }
.m-mosaique .tile.span-2 { grid-column: span 1; }
.m-mosaique .tile.span-2 .tile-links { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) {
.m-mosaique .ph-status i { animation: none; }
.m-mosaique .tile { transition: none; }
}

/* ===== lateral ===== */
.m-lateral { position: fixed; inset: 0; z-index: 60; display: flex; color: #1e293b; font-family: 'Segoe UI', system-ui, sans-serif; background: #eef3f9; }
.m-lateral .ph-mark { color: #5b9bd5; }
.m-lateral /* Sidebar */
.side { width: 288px; flex: none; background: linear-gradient(180deg, #1e293b, #0f172a); color: #e2e8f0; display: flex; flex-direction: column; padding: 22px 16px; }
.m-lateral .side-brand { font-size: 21px; font-weight: 800; color: #fff; letter-spacing: -.4px; display: flex; align-items: center; gap: 9px; }
.m-lateral .side-sub { font-size: 10px; font-weight: 700; color: #94a3b8; letter-spacing: 2.5px; text-transform: uppercase; margin: 4px 0 22px 1px; }
.m-lateral .side-nav { display: flex; flex-direction: column; gap: 5px; flex: 1; }
.m-lateral .side-item { display: flex; align-items: center; gap: 12px; background: none; border: 0; cursor: pointer; font: inherit; color: #cbd5e1;
  padding: 11px 12px; border-radius: 11px; text-align: left; transition: background .14s ease, color .14s ease; position: relative; }
.m-lateral .side-item:hover { background: rgba(255,255,255,.06); color: #fff; }
.m-lateral .side-item.on { background: rgba(255,255,255,.10); color: #fff; }
.m-lateral .side-item.on::before { content: ''; position: absolute; left: 0; top: 9px; bottom: 9px; width: 3px; border-radius: 3px; background: var(--c); }
.m-lateral .side-ic { width: 34px; height: 34px; border-radius: 9px; flex: none; display: flex; align-items: center; justify-content: center; background: color-mix(in srgb, var(--c) 26%, transparent); color: var(--c); }
.m-lateral .side-item.on .side-ic { background: var(--c); color: #fff; }
.m-lateral .side-ic svg { width: 20px; height: 20px; }
.m-lateral .side-txt { flex: 1; font-size: 13.5px; font-weight: 700; }
.m-lateral .side-n { font-size: 11px; font-weight: 800; color: #94a3b8; background: rgba(255,255,255,.08); border-radius: 20px; padding: 2px 9px; }
.m-lateral .side-item.on .side-n { color: #fff; background: color-mix(in srgb, var(--c) 45%, transparent); }
.m-lateral .side-foot { margin-top: 18px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,.1); display: flex; align-items: center; justify-content: space-between; }
.m-lateral .ph-status { font-size: 11px; font-weight: 700; color: #4ade80; letter-spacing: .5px; text-transform: uppercase; display: flex; align-items: center; gap: 7px; }
.m-lateral .ph-status i { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 9px #22c55e; animation: blink 2s ease-in-out infinite; }
.m-lateral .side-clock { font-family: 'Consolas', ui-monospace, monospace; font-size: 13px; font-weight: 600; color: #94a3b8; letter-spacing: 1.5px; }
.m-lateral /* Main */
.main { flex: 1; overflow: auto; padding: 40px 46px; }
.m-lateral .main-head { display: flex; align-items: center; gap: 18px; margin-bottom: 30px; }
.m-lateral .main-ic { width: 64px; height: 64px; border-radius: 18px; flex: none; display: flex; align-items: center; justify-content: center; background: color-mix(in srgb, var(--c) 14%, #fff); color: var(--c); box-shadow: 0 8px 22px color-mix(in srgb, var(--c) 22%, transparent); }
.m-lateral .main-ic svg { width: 36px; height: 36px; stroke: var(--c); }
.m-lateral .main-step { font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--c); }
.m-lateral .main-title { margin: 2px 0 0; font-size: 30px; font-weight: 800; color: #0f172a; letter-spacing: -.02em; }
.m-lateral .main-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
.m-lateral .main-card { background: #fff; border: 1px solid #e6ecf3; border-radius: 14px; padding: 18px; cursor: pointer; text-align: left;
  display: flex; flex-direction: column; gap: 12px; box-shadow: 0 2px 6px rgba(30,41,59,.05); transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease; }
.m-lateral .main-card:hover { transform: translateY(-4px); box-shadow: 0 16px 32px rgba(30,41,59,.13); border-color: var(--c); }
.m-lateral .mc-label { font-size: 15px; font-weight: 700; color: #0f172a; }
.m-lateral .mc-go { font-size: 12px; font-weight: 700; color: var(--c); }
@media (max-width: 820px) {
.m-lateral { flex-direction: column; overflow: auto; }
.m-lateral .side { width: auto; flex-direction: column; padding: 16px; }
.m-lateral .side-nav { flex-direction: row; flex-wrap: wrap; }
.m-lateral .side-item { flex: 1 1 44%; }
.m-lateral .main { padding: 24px 18px; }
.m-lateral .main-title { font-size: 23px; }
}
@media (prefers-reduced-motion: reduce) {
.m-lateral .ph-status i { animation: none; }
.m-lateral .main-card { transition: none; }
}

/* ===== hero ===== */
.m-hero { position: fixed; inset: 0; z-index: 60; overflow: auto; color: #1e293b; font-family: 'Segoe UI', system-ui, sans-serif; background: #0f172a; }
.m-hero .ph { display: flex; justify-content: space-between; align-items: center; padding: 22px 46px 10px; }
.m-hero .ph-brand { font-size: 22px; font-weight: 800; color: #fff; letter-spacing: -.4px; display: flex; align-items: center; gap: 11px; }
.m-hero .ph-mark { color: #5b9bd5; font-size: 15px; }
.m-hero .ph-sub { font-size: 11px; font-weight: 700; color: #94a3b8; letter-spacing: 2.5px; text-transform: uppercase; margin-left: 13px; padding-left: 13px; border-left: 2px solid #334155; }
.m-hero .ph-right { display: flex; align-items: center; gap: 20px; }
.m-hero .ph-clock { font-family: 'Consolas', ui-monospace, monospace; font-size: 16px; font-weight: 600; color: #cbd5e1; letter-spacing: 2px; }
.m-hero .ph-status { font-size: 11.5px; font-weight: 700; color: #4ade80; letter-spacing: .5px; text-transform: uppercase; display: flex; align-items: center; gap: 7px; }
.m-hero .ph-status i { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 9px #22c55e; animation: blink 2s ease-in-out infinite; }
.m-hero .hero-wrap { padding: 16px 46px 50px; max-width: 1320px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
.m-hero .hero { display: grid; grid-template-columns: 300px 1fr; gap: 26px; align-items: center; border-radius: 20px; padding: 26px 30px; position: relative; overflow: hidden;
  background:
    radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, var(--c) 34%, transparent), transparent 60%),
    linear-gradient(120deg, #1e293b, #172033);
  border: 1px solid color-mix(in srgb, var(--c) 30%, #1e293b);
  transition: transform .18s ease, box-shadow .18s ease; }
.m-hero .hero:hover { transform: translateY(-3px); box-shadow: 0 20px 44px rgba(0,0,0,.4); }
.m-hero .hero::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 5px; background: var(--c); }
.m-hero .hero-left { display: grid; grid-template-columns: auto auto; grid-template-areas: 'num ic' 'title title' 'count count'; align-items: center; gap: 6px 14px; }
.m-hero .hero-num { grid-area: num; font-family: 'Consolas', ui-monospace, monospace; font-size: 30px; font-weight: 800; color: var(--c); line-height: 1; }
.m-hero .hero-ic { grid-area: ic; width: 52px; height: 52px; border-radius: 14px; display: flex; align-items: center; justify-content: center; background: color-mix(in srgb, var(--c) 22%, transparent); color: var(--c); justify-self: end; }
.m-hero .hero-ic svg { width: 30px; height: 30px; stroke: var(--c); }
.m-hero .hero-title { grid-area: title; margin: 8px 0 0; font-size: 23px; font-weight: 800; color: #fff; letter-spacing: -.02em; }
.m-hero .hero-count { grid-area: count; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .1em; }
.m-hero .hero-links { display: flex; flex-wrap: wrap; gap: 9px; }
.m-hero .hero-link { display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12);
  border-radius: 11px; cursor: pointer; font: inherit; font-size: 13px; font-weight: 600; color: #e2e8f0; padding: 10px 15px; transition: all .14s ease; }
.m-hero .hl-arrow { color: var(--c); opacity: 0; transform: translateX(-5px); transition: opacity .14s ease, transform .14s ease; }
.m-hero .hero-link:hover { background: color-mix(in srgb, var(--c) 24%, transparent); border-color: var(--c); color: #fff; transform: translateY(-2px); }
.m-hero .hero-link:hover .hl-arrow { opacity: 1; transform: translateX(0); }
@media (max-width: 820px) {
.m-hero .ph { padding: 16px 18px; flex-wrap: wrap; gap: 10px; }
.m-hero .ph-sub { display: none; }
.m-hero .hero-wrap { padding: 12px 16px 40px; }
.m-hero .hero { grid-template-columns: 1fr; gap: 16px; padding: 20px; }
.m-hero .hero-title { font-size: 20px; }
}
@media (prefers-reduced-motion: reduce) {
.m-hero .ph-status i { animation: none; }
.m-hero .hero, .m-hero .hero-link { transition: none; }
}
.hub-login { position: fixed; top: 92px; right: 26px; z-index: 900; }
.hub-login-card { background: rgba(255,255,255,.96); backdrop-filter: blur(8px); border: 1px solid #dbe4ee; border-radius: 14px; padding: 15px 16px; width: 244px; box-shadow: 0 14px 34px rgba(15,23,42,.18); text-align: center; }
.hub-login-brand { display: flex; align-items: center; justify-content: center; gap: 7px; font-size: 15px; font-weight: 800; letter-spacing: -.3px; color: #0f172a; margin-bottom: 3px; }
.hub-login-brand::before { content: '▸'; color: #5b9bd5; }
.hub-login-card h2 { margin: 0 0 11px; font-size: 9.5px; text-transform: uppercase; letter-spacing: .1em; color: #94a3b8; font-weight: 700; }
.hub-login-card input { width: 100%; box-sizing: border-box; padding: 9px 11px; margin-bottom: 8px; border: 1px solid #cbd5e1; border-radius: 9px; font-size: 13px; background: #f8fafc; }
.hub-login-card input:focus { outline: none; border-color: #5b9bd5; background: #fff; box-shadow: 0 0 0 3px rgba(91,155,213,.18); }
.hub-login-btn { width: 100%; padding: 10px; border: none; border-radius: 9px; background: #5b9bd5; color: #fff; font-weight: 700; font-size: 13.5px; cursor: pointer; text-decoration: none; box-shadow: 0 3px 10px rgba(91,155,213,.4); transition: background .12s ease; }
.hub-login-btn:hover { background: #4a8ac4; }
.hub-login-btn:disabled { opacity: .6; cursor: default; }
.hub-login-err { color: #dc2626; font-size: 12px; margin: 9px 0 0; }
.hub-login-alt { display: inline-block; margin-top: 10px; font-size: 11.5px; color: #64748b; text-decoration: none; }
.hub-login-alt:hover { color: #5b9bd5; text-decoration: underline; }
</style>
