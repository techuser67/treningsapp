/* =========================================================
   FARGE-TOKENS (mørk modus)
   Disse fungerer som fallback hvis Tailwind-config-en ikke
   rekker å laste — og som autoritet for noen utility-klasser.
   ========================================================= */
:root {
  --canvas: #0a0a0c;
  --ink-50:  #15151a;
  --ink-100: #1c1c21;
  --ink-200: #27272f;
  --ink-300: #3f3f48;
  --ink-400: #71717a;
  --ink-500: #a1a1aa;
  --ink-600: #d4d4d8;
  --ink-700: #e4e4e7;
  --ink-800: #f4f4f5;
  --ink-900: #fafafa;
  --accent: #a3e635;
  --accent-hover: #bef264;
  --accent-fg: #0a0a0a;
}

/* Tving riktig bakgrunn og tekstfarge på body, uavhengig av Tailwind */
html, body {
  background-color: var(--canvas) !important;
  color: var(--ink-900) !important;
  color-scheme: dark;
}

/* Fallback-utilities som speiler Tailwind-konfig-en.
   Brukes automatisk hvis Tailwind-CDN ikke har lest config-en. */
.bg-canvas { background-color: var(--canvas) !important; }
.bg-ink-50 { background-color: var(--ink-50) !important; }
.bg-ink-100 { background-color: var(--ink-100) !important; }
.bg-ink-200 { background-color: var(--ink-200) !important; }
.bg-ink-300 { background-color: var(--ink-300) !important; }
.bg-ink-900 { background-color: var(--ink-900) !important; }
.bg-accent { background-color: var(--accent) !important; }
.bg-accent-hover { background-color: var(--accent-hover) !important; }
.bg-accent-fg { background-color: var(--accent-fg) !important; }
.text-ink-300 { color: var(--ink-300) !important; }
.text-ink-400 { color: var(--ink-400) !important; }
.text-ink-500 { color: var(--ink-500) !important; }
.text-ink-600 { color: var(--ink-600) !important; }
.text-ink-700 { color: var(--ink-700) !important; }
.text-ink-800 { color: var(--ink-800) !important; }
.text-ink-900 { color: var(--ink-900) !important; }
.text-accent { color: var(--accent) !important; }
.text-accent-fg { color: var(--accent-fg) !important; }
.border-ink-100 { border-color: var(--ink-100) !important; }
.border-ink-200 { border-color: var(--ink-200) !important; }
.border-ink-300 { border-color: var(--ink-300) !important; }
.border-accent { border-color: var(--accent) !important; }
.shadow-card { box-shadow: 0 1px 0 0 rgba(255,255,255,0.04) inset, 0 1px 3px 0 rgba(0,0,0,0.5) !important; }

/* Tekst- og knapp-overstyringer */
button { color: inherit; }
input, textarea, select { color: var(--ink-900); }

/* Active-states for primær-knapp */
.active\:bg-accent-hover:active { background-color: var(--accent-hover) !important; }

/* =========================================================
   ORIGINALE STILER
   ========================================================= */

/* Minimalistisk basis */
html, body {
  -webkit-tap-highlight-color: transparent;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  overscroll-behavior-y: contain;
}

body {
  font-feature-settings: "ss01", "cv11";
}

/* Skjul scrollbar pent */
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

/* Subtle stigende animasjon for skjermer */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
.screen-enter { animation: fadeInUp .18s ease-out; }

/* Trykk-respons */
.tap { transition: transform .08s ease, opacity .08s ease, background-color .15s ease; }
.tap:active { transform: scale(.97); opacity: .85; }

/* Numerisk input uten spinners */
input[type=number]::-webkit-outer-spin-button,
input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
input[type=number] { -moz-appearance: textfield; }

/* Safe area for iPhone */
.safe-bottom { padding-bottom: max(env(safe-area-inset-bottom), 0px); }
.safe-top { padding-top: max(env(safe-area-inset-top), 0px); }

/* Stor tall-input for vekt/reps */
.big-num {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
  letter-spacing: -0.02em;
}

/* Modal bakgrunn */
.modal-backdrop {
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}

/* Plasser et sticky element rett over BottomNav (60px innhold + safe-area-inset) */
.above-bottom-nav {
  bottom: calc(env(safe-area-inset-bottom, 0px) + 64px);
}
