// Trening — personlig treningsapp (Preact + htm + localStorage)
// Bygd som en single-file modul. Importer Preact og htm fra esm.sh.

import { h, render, Fragment } from 'https://esm.sh/preact@10.22.0';
import { useState, useEffect, useMemo, useRef, useCallback } from 'https://esm.sh/preact@10.22.0/hooks';
import htm from 'https://esm.sh/htm@3.1.1';

const html = htm.bind(h);

/* =========================================================
   DATALAGER  (localStorage med versjonering)
   ========================================================= */

const STORAGE_KEY = 'trening:v1';
const DEFAULT_DATA = () => ({
  exercises: [],          // Exercise[]
  workouts: [],           // Workout[] (fullførte økter)
  programs: [],           // Program[]
  activeWorkout: null,    // ActiveWorkout | null
  settings: {
    units: 'kg',
    restSeconds: 120,
    showRPE: true,
  },
});

// Faste alternativer for justerbar hviletimer (sekunder)
const REST_PICKER_OPTIONS = [15, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DATA();
    const parsed = JSON.parse(raw);
    const merged = { ...DEFAULT_DATA(), ...parsed, settings: { ...DEFAULT_DATA().settings, ...(parsed.settings || {}) } };
    // Migrer gammel showRIR-setting til showRPE
    if (parsed.settings && 'showRIR' in parsed.settings && !('showRPE' in parsed.settings)) {
      merged.settings.showRPE = parsed.settings.showRIR;
      delete merged.settings.showRIR;
    }
    return merged;
  } catch (e) {
    console.error('Failed to load data', e);
    return DEFAULT_DATA();
  }
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save data', e);
  }
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const MUSCLE_GROUPS = [
  'Bryst', 'Rygg', 'Skulder', 'Biceps', 'Triceps',
  'Quad', 'Hamstring', 'Sete', 'Legger', 'Mage', 'Underarm', 'Annet',
];

/* =========================================================
   HJELPEFUNKSJONER
   ========================================================= */

const fmtDate = (ts) => new Date(ts).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' });
const fmtDateLong = (ts) => new Date(ts).toLocaleDateString('no-NO', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtTime = (ts) => new Date(ts).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });
const fmtDuration = (sec) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}m ${s.toString().padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  return `${h}t ${(m % 60).toString().padStart(2, '0')}m`;
};
const sameDay = (a, b) => {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
};
const startOfDay = (ts) => { const d = new Date(ts); d.setHours(0,0,0,0); return d.getTime(); };

// Brzycki-formel for estimert 1RM
const estimate1RM = (weight, reps) => {
  if (!weight || !reps || reps < 1) return 0;
  if (reps === 1) return weight;
  return weight * (36 / (37 - reps));
};

const totalVolume = (workout) =>
  workout.exercises.reduce((sum, ex) =>
    sum + ex.sets.filter(s => s.completed).reduce((s, set) => s + (set.weight || 0) * (set.reps || 0), 0)
  , 0);

const completedSetCount = (workout) =>
  workout.exercises.reduce((n, ex) => n + ex.sets.filter(s => s.completed).length, 0);

/* =========================================================
   ROOT-STATE  (en enkel store)
   ========================================================= */

function useStore() {
  const [data, setData] = useState(loadData);

  // Persistér ved hver endring
  useEffect(() => { saveData(data); }, [data]);

  const update = useCallback((mutator) => {
    setData((d) => {
      const draft = JSON.parse(JSON.stringify(d));
      mutator(draft);
      return draft;
    });
  }, []);

  return [data, update, setData];
}

/* =========================================================
   FELLES UI-KOMPONENTER
   ========================================================= */

const cx = (...c) => c.filter(Boolean).join(' ');

function Button({ children, onClick, variant = 'primary', size = 'md', disabled, className = '', type = 'button', ...rest }) {
  const variants = {
    primary: 'bg-ink-900 text-white active:bg-ink-800',
    secondary: 'bg-ink-100 text-ink-900 active:bg-ink-200',
    ghost: 'bg-transparent text-ink-900 active:bg-ink-100',
    danger: 'bg-red-600 text-white active:bg-red-700',
    outline: 'border border-ink-200 text-ink-900 active:bg-ink-50',
  };
  const sizes = {
    sm: 'h-9 px-3 text-sm rounded-lg',
    md: 'h-11 px-4 text-base rounded-xl',
    lg: 'h-14 px-6 text-lg rounded-2xl',
  };
  return html`
    <button
      type=${type}
      onClick=${onClick}
      disabled=${disabled}
      class=${cx('tap font-medium inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none', variants[variant], sizes[size], className)}
      ...${rest}
    >${children}</button>
  `;
}

function IconButton({ children, onClick, className = '', ...rest }) {
  return html`
    <button onClick=${onClick} class=${cx('tap inline-flex items-center justify-center w-10 h-10 rounded-full text-ink-900 active:bg-ink-100', className)} ...${rest}>
      ${children}
    </button>
  `;
}

function Card({ children, className = '', ...rest }) {
  return html`<div class=${cx('rounded-2xl border border-ink-100 bg-white', className)} ...${rest}>${children}</div>`;
}

function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;
  return html`
    <div class="fixed inset-0 z-50 modal-backdrop flex items-end sm:items-center justify-center" onClick=${onClose}>
      <div class="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl max-h-[88vh] overflow-y-auto safe-bottom" onClick=${(e) => e.stopPropagation()}>
        ${title && html`
          <div class="sticky top-0 bg-white px-5 pt-4 pb-3 border-b border-ink-100 flex items-center justify-between">
            <h2 class="text-lg font-semibold">${title}</h2>
            <${IconButton} onClick=${onClose}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            <//>
          </div>
        `}
        <div class="p-5">${children}</div>
      </div>
    </div>
  `;
}

function Field({ label, children, hint }) {
  return html`
    <label class="block">
      ${label && html`<div class="text-xs font-medium text-ink-500 mb-1.5 uppercase tracking-wide">${label}</div>`}
      ${children}
      ${hint && html`<div class="text-xs text-ink-400 mt-1">${hint}</div>`}
    </label>
  `;
}

function Input({ value, onInput, placeholder, type = 'text', className = '', inputMode, ...rest }) {
  return html`
    <input
      type=${type}
      inputMode=${inputMode}
      value=${value ?? ''}
      onInput=${(e) => onInput?.(e.currentTarget.value)}
      placeholder=${placeholder}
      class=${cx('w-full h-11 px-3 rounded-xl bg-ink-50 border border-transparent focus:border-ink-300 focus:bg-white outline-none text-base', className)}
      ...${rest}
    />
  `;
}

function Select({ value, onChange, options, className = '' }) {
  return html`
    <select
      value=${value}
      onChange=${(e) => onChange?.(e.currentTarget.value)}
      class=${cx('w-full h-11 px-3 rounded-xl bg-ink-50 border border-transparent focus:border-ink-300 focus:bg-white outline-none text-base appearance-none', className)}
    >
      ${options.map(o => html`<option value=${typeof o === 'string' ? o : o.value}>${typeof o === 'string' ? o : o.label}</option>`)}
    </select>
  `;
}

function EmptyState({ icon, title, body, action }) {
  return html`
    <div class="text-center py-16 px-6">
      <div class="text-5xl mb-4 opacity-50">${icon}</div>
      <h3 class="text-lg font-semibold mb-1">${title}</h3>
      <p class="text-sm text-ink-500 mb-6 max-w-xs mx-auto">${body}</p>
      ${action}
    </div>
  `;
}

function Header({ title, subtitle, right }) {
  return html`
    <div class="px-5 pt-6 pb-4 flex items-end justify-between">
      <div>
        ${subtitle && html`<div class="text-xs uppercase tracking-wide text-ink-400 mb-1">${subtitle}</div>`}
        <h1 class="text-3xl font-semibold tracking-tight">${title}</h1>
      </div>
      <div class="flex items-center gap-1">${right}</div>
    </div>
  `;
}

/* =========================================================
   SCREEN: HJEM
   ========================================================= */

function HomeScreen({ data, update, navigate }) {
  const settingsBtn = html`
    <${IconButton} onClick=${() => navigate('innstillinger')}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
    <//>
  `;

  const today = new Date();
  const todayStr = today.toLocaleDateString('no-NO', { weekday: 'long', day: 'numeric', month: 'long' });
  const recent = [...data.workouts].sort((a, b) => b.date - a.date).slice(0, 3);
  const week = lastNDays(7).map(ts => ({
    ts,
    workout: data.workouts.find(w => sameDay(w.date, ts)),
  }));

  // Streak: hvor mange dager på rad har bruker trent
  const streak = computeStreak(data.workouts);

  const startNewWorkout = () => {
    update((d) => {
      d.activeWorkout = {
        id: uid(),
        date: Date.now(),
        startedAt: Date.now(),
        name: '',
        exercises: [],
        notes: '',
        programId: null,
      };
    });
    navigate('logg');
  };

  const startFromProgram = (program, dayIdx) => {
    const day = program.days[dayIdx];
    update((d) => {
      d.activeWorkout = {
        id: uid(),
        date: Date.now(),
        startedAt: Date.now(),
        name: `${program.name} — ${day.name}`,
        programId: program.id,
        exercises: day.exercises.map(de => ({
          exerciseId: de.exerciseId,
          sets: Array.from({ length: de.targetSets || 3 }, () => ({ weight: '', reps: '', rpe: '', completed: false })),
          notes: '',
          targetReps: de.targetReps,
        })),
        notes: '',
      };
    });
    navigate('logg');
  };

  return html`
    <div class="screen-enter pb-24">
      <${Header} title="Hjem" subtitle=${todayStr.charAt(0).toUpperCase() + todayStr.slice(1)} right=${settingsBtn} />

      ${data.activeWorkout && html`
        <div class="px-5 mb-5">
          <${Card} className="p-5 bg-ink-900 text-white border-ink-900">
            <div class="flex items-center justify-between mb-3">
              <div>
                <div class="text-xs text-ink-300 uppercase tracking-wide">Pågående økt</div>
                <div class="text-lg font-semibold">${data.activeWorkout.name || 'Uten navn'}</div>
              </div>
              <${LiveTimer} since=${data.activeWorkout.startedAt} />
            </div>
            <${Button} variant="secondary" className="w-full !bg-white !text-ink-900" onClick=${() => navigate('logg')}>
              Fortsett økt →
            <//>
          <//>
        </div>
      `}

      ${!data.activeWorkout && html`
        <div class="px-5 mb-5">
          <${Button} variant="primary" size="lg" className="w-full" onClick=${startNewWorkout}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
            Start ny økt
          <//>
        </div>
      `}

      <!-- Uke-oversikt -->
      <div class="px-5 mb-6">
        <div class="flex items-center justify-between mb-3">
          <div class="text-xs uppercase tracking-wide text-ink-400 font-medium">Denne uka</div>
          ${streak > 0 && html`<div class="text-xs font-medium text-ink-700">🔥 ${streak} dager på rad</div>`}
        </div>
        <div class="grid grid-cols-7 gap-1.5">
          ${week.map(({ ts, workout }) => {
            const d = new Date(ts);
            const isToday = sameDay(ts, Date.now());
            return html`
              <div class=${cx('flex flex-col items-center py-2 rounded-xl', isToday ? 'bg-ink-50' : '')}>
                <div class="text-[10px] uppercase text-ink-400 mb-1">${['S','M','T','O','T','F','L'][d.getDay()]}</div>
                <div class=${cx('text-sm font-medium', isToday ? 'text-ink-900' : 'text-ink-600')}>${d.getDate()}</div>
                <div class=${cx('w-1.5 h-1.5 rounded-full mt-1.5', workout ? 'bg-ink-900' : 'bg-ink-200')}></div>
              </div>
            `;
          })}
        </div>
      </div>

      <!-- Programmer -->
      ${data.programs.length > 0 && html`
        <div class="px-5 mb-6">
          <div class="text-xs uppercase tracking-wide text-ink-400 font-medium mb-3">Start fra program</div>
          <div class="space-y-2">
            ${data.programs.map(p => html`
              <${Card} className="p-4">
                <div class="font-medium mb-2">${p.name}</div>
                <div class="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
                  ${p.days.map((day, i) => html`
                    <button
                      class="tap shrink-0 px-3 h-9 rounded-lg bg-ink-100 text-sm text-ink-900 active:bg-ink-200"
                      onClick=${() => startFromProgram(p, i)}
                    >${day.name}</button>
                  `)}
                </div>
              <//>
            `)}
          </div>
        </div>
      `}

      <!-- Siste økter -->
      <div class="px-5">
        <div class="flex items-center justify-between mb-3">
          <div class="text-xs uppercase tracking-wide text-ink-400 font-medium">Siste økter</div>
          ${data.workouts.length > 3 && html`
            <button class="text-xs text-ink-500 tap" onClick=${() => navigate('statistikk')}>Se alle</button>
          `}
        </div>
        ${recent.length === 0 ? html`
          <div class="text-sm text-ink-400 text-center py-8">Ingen økter ennå. Trykk "Start ny økt" for å begynne.</div>
        ` : html`
          <div class="space-y-2">
            ${recent.map(w => html`<${WorkoutSummaryRow} workout=${w} exercises=${data.exercises} units=${data.settings.units} onClick=${() => navigate('historikk', { workoutId: w.id })} />`)}
          </div>
        `}
      </div>
    </div>
  `;
}

function lastNDays(n) {
  const days = [];
  const today = startOfDay(Date.now());
  // Begynn på mandag denne uka
  const day = new Date(today).getDay(); // 0=søndag
  const diffToMonday = (day === 0 ? 6 : day - 1);
  const monday = today - diffToMonday * 86400000;
  for (let i = 0; i < n; i++) days.push(monday + i * 86400000);
  return days;
}

function computeStreak(workouts) {
  if (workouts.length === 0) return 0;
  const dates = [...new Set(workouts.map(w => startOfDay(w.date)))].sort((a, b) => b - a);
  let streak = 0;
  let cursor = startOfDay(Date.now());
  if (dates[0] !== cursor && dates[0] !== cursor - 86400000) return 0;
  if (dates[0] === cursor - 86400000) cursor = cursor - 86400000;
  for (const d of dates) {
    if (d === cursor) {
      streak++;
      cursor -= 86400000;
    } else if (d < cursor) {
      break;
    }
  }
  return streak;
}

function LiveTimer({ since }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const sec = Math.floor((now - since) / 1000);
  return html`<div class="big-num text-lg font-medium tabular-nums">${fmtDuration(sec)}</div>`;
}

function WorkoutSummaryRow({ workout, exercises, units, onClick }) {
  const exerciseNames = workout.exercises
    .map(we => exercises.find(e => e.id === we.exerciseId)?.name || 'Slettet øvelse')
    .slice(0, 3)
    .join(' · ');
  const more = workout.exercises.length > 3 ? ` +${workout.exercises.length - 3}` : '';
  const vol = totalVolume(workout);
  const sets = completedSetCount(workout);
  return html`
    <button onClick=${onClick} class="tap w-full text-left">
      <${Card} className="p-4">
        <div class="flex items-center justify-between mb-1">
          <div class="font-medium">${workout.name || 'Økt'}</div>
          <div class="text-xs text-ink-400">${fmtDate(workout.date)}</div>
        </div>
        <div class="text-sm text-ink-500 truncate mb-2">${exerciseNames}${more}</div>
        <div class="flex gap-4 text-xs text-ink-500">
          <span>${sets} sett</span>
          <span>${Math.round(vol).toLocaleString('no-NO')} ${units}</span>
          ${workout.duration && html`<span>${fmtDuration(workout.duration)}</span>`}
        </div>
      <//>
    </button>
  `;
}

/* =========================================================
   SCREEN: AKTIV ØKT
   ========================================================= */

function WorkoutScreen({ data, update, navigate }) {
  const aw = data.activeWorkout;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [restTimer, setRestTimer] = useState(null); // {endsAt}

  if (!aw) {
    return html`
      <div class="screen-enter">
        <${Header} title="Logg" />
        <${EmptyState}
          icon="🏋️"
          title="Ingen aktiv økt"
          body="Start en ny økt fra Hjem-skjermen for å begynne å logge."
          action=${html`<${Button} onClick=${() => navigate('hjem')}>Gå til Hjem<//>`}
        />
      </div>
    `;
  }

  const setName = (name) => update((d) => { d.activeWorkout.name = name; });
  const addExercises = (exerciseIds) => {
    update((d) => {
      for (const id of exerciseIds) {
        d.activeWorkout.exercises.push({
          exerciseId: id,
          sets: [{ weight: '', reps: '', rpe: '', completed: false }],
          notes: '',
        });
      }
    });
    setPickerOpen(false);
  };
  const removeExercise = (idx) => update((d) => { d.activeWorkout.exercises.splice(idx, 1); });
  const addSet = (exIdx) => update((d) => {
    const sets = d.activeWorkout.exercises[exIdx].sets;
    const last = sets[sets.length - 1];
    sets.push({
      weight: last?.weight ?? '',
      reps: last?.reps ?? '',
      rpe: '',
      completed: false,
    });
  });
  const removeSet = (exIdx, setIdx) => update((d) => {
    d.activeWorkout.exercises[exIdx].sets.splice(setIdx, 1);
  });
  const updateSet = (exIdx, setIdx, patch) => update((d) => {
    Object.assign(d.activeWorkout.exercises[exIdx].sets[setIdx], patch);
  });
  // Fullfør et sett og start hviletimer. customRest = sekunder (overstyrer standard).
  const completeSet = (exIdx, setIdx, customRest) => {
    const s = aw.exercises[exIdx].sets[setIdx];
    const willComplete = !s.completed;
    update((d) => { d.activeWorkout.exercises[exIdx].sets[setIdx].completed = willComplete; });
    if (willComplete) {
      const restSec = customRest != null ? customRest : data.settings.restSeconds;
      if (restSec > 0) {
        setRestTimer({ endsAt: Date.now() + restSec * 1000, total: restSec });
      }
    } else {
      // Hvis brukeren slår av et sett, stopp evt. pågående hvile
      setRestTimer(null);
    }
  };

  // Hviletimer-velger: holder styr på hvilket sett som skal fullføres med valgt tid
  const [restPicker, setRestPicker] = useState(null); // { exIdx, setIdx } | null
  const openRestPicker = (exIdx, setIdx) => setRestPicker({ exIdx, setIdx });
  const pickRestTime = (sec) => {
    if (!restPicker) return;
    const { exIdx, setIdx } = restPicker;
    setRestPicker(null);
    completeSet(exIdx, setIdx, sec);
  };

  const finish = () => {
    if (aw.exercises.length === 0 || completedSetCount(aw) === 0) {
      if (!confirm('Ingen sett er fullført. Vil du forkaste økta?')) return;
      update((d) => { d.activeWorkout = null; });
      navigate('hjem');
      return;
    }
    update((d) => {
      const finished = {
        ...d.activeWorkout,
        finishedAt: Date.now(),
        duration: Math.floor((Date.now() - d.activeWorkout.startedAt) / 1000),
      };
      // Ren ut tomme sett
      finished.exercises = finished.exercises.map(ex => ({
        ...ex,
        sets: ex.sets.filter(s => s.completed),
      })).filter(ex => ex.sets.length > 0);
      d.workouts.push(finished);
      d.activeWorkout = null;
    });
    navigate('hjem');
  };

  const cancel = () => {
    if (!confirm('Avbryt økta? All loggføring så langt mistes.')) return;
    update((d) => { d.activeWorkout = null; });
    navigate('hjem');
  };

  return html`
    <div class="screen-enter pb-44">
      <div class="px-5 pt-6 pb-4 flex items-center justify-between">
        <${IconButton} onClick=${cancel}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        <//>
        <div class="text-xs uppercase tracking-wide text-ink-400 font-medium">Aktiv økt</div>
        <div class="w-9"></div>
      </div>

      <div class="px-5 mb-5">
        <input
          value=${aw.name}
          onInput=${(e) => setName(e.currentTarget.value)}
          placeholder="Navn på økta (valgfritt)"
          class="w-full text-2xl font-semibold tracking-tight bg-transparent outline-none placeholder:text-ink-300"
        />
      </div>

      ${restTimer && html`<${RestBanner} endsAt=${restTimer.endsAt} total=${restTimer.total} onDone=${() => setRestTimer(null)} onCancel=${() => setRestTimer(null)} />`}

      <div class="px-5 space-y-4">
        ${aw.exercises.map((ex, exIdx) => {
          const exercise = data.exercises.find(e => e.id === ex.exerciseId);
          return html`
            <${ExerciseBlock}
              key=${ex.exerciseId + exIdx}
              exercise=${exercise}
              exData=${ex}
              units=${data.settings.units}
              showRPE=${data.settings.showRPE}
              previousBest=${getPreviousBest(data.workouts, ex.exerciseId)}
              previousSets=${getPreviousSets(data.workouts, ex.exerciseId)}
              onSetChange=${(setIdx, patch) => updateSet(exIdx, setIdx, patch)}
              onCompleteSet=${(setIdx) => completeSet(exIdx, setIdx)}
              onPickRest=${(setIdx) => openRestPicker(exIdx, setIdx)}
              onAddSet=${() => addSet(exIdx)}
              onRemoveSet=${(setIdx) => removeSet(exIdx, setIdx)}
              onRemove=${() => removeExercise(exIdx)}
            />
          `;
        })}
      </div>

      <div class="px-5 mt-5">
        <${Button} variant="secondary" className="w-full" onClick=${() => setPickerOpen(true)}>
          + Legg til øvelse
        <//>
      </div>

      <${ExercisePicker}
        open=${pickerOpen}
        exercises=${data.exercises}
        onClose=${() => setPickerOpen(false)}
        onPick=${addExercises}
        onCreateNew=${(name, mg) => {
          let newId;
          update((d) => {
            newId = uid();
            d.exercises.push({ id: newId, name, muscleGroup: mg, notes: '', createdAt: Date.now() });
          });
          return newId;
        }}
      />

      <${RestPickerModal}
        open=${!!restPicker}
        onClose=${() => setRestPicker(null)}
        onPick=${pickRestTime}
      />

      <!-- Sticky Fullfør-knapp: alltid synlig over BottomNav -->
      <div class="fixed inset-x-0 above-bottom-nav z-20 pointer-events-none">
        <div class="max-w-md mx-auto px-5 pb-2 pointer-events-auto">
          <${Button}
            variant="primary"
            className="w-full shadow-lg shadow-ink-900/20"
            onClick=${finish}
          >Fullfør økt<//>
        </div>
      </div>
    </div>
  `;
}

function getPreviousBest(workouts, exerciseId) {
  const sorted = [...workouts].sort((a, b) => b.date - a.date);
  for (const w of sorted) {
    const ex = w.exercises.find(e => e.exerciseId === exerciseId);
    if (ex) {
      const best = ex.sets
        .filter(s => s.completed && s.weight && s.reps)
        .reduce((m, s) => (s.weight * s.reps > (m?.weight * m?.reps || 0) ? s : m), null);
      if (best) return best;
    }
  }
  return null;
}

// Settene fra forrige gjennomførte økt med denne øvelsen.
// Returnerer en array (samme rekkefølge som forrige gang) eller [] hvis ingen historikk.
function getPreviousSets(workouts, exerciseId) {
  const sorted = [...workouts].sort((a, b) => b.date - a.date);
  for (const w of sorted) {
    const ex = w.exercises.find(e => e.exerciseId === exerciseId);
    if (ex && ex.sets.some(s => s.completed && s.weight && s.reps)) {
      return ex.sets.filter(s => s.completed && s.weight && s.reps);
    }
  }
  return [];
}

function ExerciseBlock({ exercise, exData, units, showRPE, previousBest, previousSets, onSetChange, onCompleteSet, onPickRest, onAddSet, onRemoveSet, onRemove }) {
  if (!exercise) {
    return html`
      <${Card} className="p-4">
        <div class="text-sm text-ink-400">Slettet øvelse</div>
      <//>
    `;
  }
  return html`
    <${Card} className="p-4">
      <div class="flex items-start justify-between mb-3">
        <div>
          <div class="font-semibold text-base leading-tight">${exercise.name}</div>
          <div class="text-xs text-ink-400 mt-0.5">${exercise.muscleGroup}${exData.targetReps ? ` · ${exData.targetReps}` : ''}</div>
          ${previousBest && html`
            <div class="text-xs text-ink-500 mt-1">
              Forrige beste: ${previousBest.weight}${units} × ${previousBest.reps}
            </div>
          `}
        </div>
        <${IconButton} onClick=${onRemove}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1.5 14a2 2 0 0 1-2 1.8H8.5a2 2 0 0 1-2-1.8L5 6"/></svg>
        <//>
      </div>

      <div class="grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wide text-ink-400 px-2 mb-1">
        <div class="col-span-1">#</div>
        <div class=${showRPE ? 'col-span-3' : 'col-span-4'}>Vekt (${units})</div>
        <div class="col-span-3">Reps</div>
        ${showRPE && html`<div class="col-span-2">RPE</div>`}
        <div class="col-span-3 text-right">Hvil</div>
      </div>

      <div class="space-y-1.5">
        ${exData.sets.map((s, i) => html`
          <${SetRow}
            key=${i}
            num=${i + 1}
            set=${s}
            previousSet=${previousSets ? previousSets[i] : null}
            showRPE=${showRPE}
            onChange=${(patch) => onSetChange(i, patch)}
            onComplete=${() => onCompleteSet(i)}
            onPickRest=${() => onPickRest(i)}
            onRemove=${() => onRemoveSet(i)}
          />
        `)}
      </div>

      <button onClick=${onAddSet} class="tap w-full mt-2 h-10 rounded-lg text-sm text-ink-500 active:bg-ink-50">
        + Legg til sett
      </button>
    <//>
  `;
}

function SetRow({ num, set, previousSet, showRPE, onChange, onComplete, onPickRest, onRemove }) {
  const prevWeight = previousSet?.weight ?? '';
  const prevReps = previousSet?.reps ?? '';
  const prevRpe = previousSet?.rpe ?? '';
  return html`
    <div class=${cx('grid grid-cols-12 gap-2 items-center px-1 py-1 rounded-lg', set.completed ? 'bg-ink-50' : '')}>
      <div class="col-span-1 text-sm text-ink-500 text-center">${num}</div>
      <div class=${showRPE ? 'col-span-3' : 'col-span-4'}>
        <input
          type="number" inputMode="decimal" step="any"
          value=${set.weight}
          placeholder=${prevWeight !== '' ? String(prevWeight) : ''}
          onInput=${(e) => onChange({ weight: e.currentTarget.value === '' ? '' : parseFloat(e.currentTarget.value) })}
          class="w-full h-10 px-2 text-center bg-ink-50 rounded-lg outline-none focus:bg-white focus:ring-1 focus:ring-ink-300 big-num placeholder:text-ink-300 placeholder:font-normal"
        />
      </div>
      <div class="col-span-3">
        <input
          type="number" inputMode="numeric"
          value=${set.reps}
          placeholder=${prevReps !== '' ? String(prevReps) : ''}
          onInput=${(e) => onChange({ reps: e.currentTarget.value === '' ? '' : parseInt(e.currentTarget.value) })}
          class="w-full h-10 px-2 text-center bg-ink-50 rounded-lg outline-none focus:bg-white focus:ring-1 focus:ring-ink-300 big-num placeholder:text-ink-300 placeholder:font-normal"
        />
      </div>
      ${showRPE && html`
        <div class="col-span-2">
          <input
            type="number" inputMode="decimal" step="0.5" min="1" max="10"
            value=${set.rpe}
            placeholder=${prevRpe !== '' ? String(prevRpe) : ''}
            onInput=${(e) => onChange({ rpe: e.currentTarget.value === '' ? '' : parseFloat(e.currentTarget.value) })}
            class="w-full h-10 px-2 text-center bg-ink-50 rounded-lg outline-none focus:bg-white focus:ring-1 focus:ring-ink-300 big-num placeholder:text-ink-300 placeholder:font-normal"
          />
        </div>
      `}
      <div class="col-span-3 flex items-center justify-end gap-1">
        <!-- Justeringsknapp: åpner velger for spesifikk hviletid -->
        <button
          onClick=${onPickRest}
          aria-label="Velg hviletid"
          class="tap w-9 h-9 rounded-lg flex items-center justify-center bg-ink-100 text-ink-500 active:bg-ink-200"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h12M4 12h8M4 18h16M18 4v4M14 10v4M20 16v4"/></svg>
        </button>
        <!-- Hovedknapp: fullfør sett + start standard hvile -->
        <button
          onClick=${onComplete}
          aria-label=${set.completed ? 'Angre fullført' : 'Fullfør sett og start hvile'}
          class=${cx('tap w-9 h-9 rounded-lg flex items-center justify-center', set.completed ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-500 active:bg-ink-200')}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="13" r="8"/>
            <path d="M12 9v4l2.5 2.5"/>
            <path d="M9 2h6"/>
            <path d="M19 5l1.5 1.5"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

/* Modal for å velge spesifikk hviletid (15 sek – 5 min) før et sett fullføres. */
function RestPickerModal({ open, onClose, onPick }) {
  if (!open) return null;
  const fmt = (s) => s < 60 ? `${s}s` : (s % 60 === 0 ? `${s/60}m` : `${Math.floor(s/60)}m ${s%60}s`);
  return html`
    <${Modal} open=${open} onClose=${onClose} title="Velg hviletid">
      <div class="grid grid-cols-3 gap-2 p-1">
        ${REST_PICKER_OPTIONS.map(sec => html`
          <button
            onClick=${() => onPick(sec)}
            class="tap h-14 rounded-xl bg-ink-50 active:bg-ink-100 flex items-center justify-center font-medium big-num"
          >${fmt(sec)}</button>
        `)}
      </div>
      <p class="text-xs text-ink-400 mt-3 text-center">Settet markeres som fullført når du velger en tid.</p>
    <//>
  `;
}

function RestBanner({ endsAt, total, onDone, onCancel }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const pct = total ? Math.max(0, Math.min(100, ((total - remaining) / total) * 100)) : 0;
  useEffect(() => {
    if (remaining === 0) {
      try { navigator.vibrate?.([200, 80, 200]); } catch {}
      onDone();
    }
  }, [remaining]);
  const fmt = (s) => s < 60 ? `${s}s` : `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
  return html`
    <div class="sticky top-2 z-10 mx-5 mb-4 rounded-2xl bg-ink-900 text-white px-4 py-3 overflow-hidden">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-xs text-ink-300 uppercase tracking-wide">Hvil</div>
          <div class="big-num text-2xl font-semibold tabular-nums">${fmt(remaining)}</div>
        </div>
        <button onClick=${onCancel} class="tap text-sm text-ink-300 px-3 py-1">Hopp over</button>
      </div>
      ${total && html`
        <div class="absolute left-0 bottom-0 h-1 bg-white/40 transition-all" style=${`width:${pct}%`}></div>
      `}
    </div>
  `;
}

function ExercisePicker({ open, exercises, onClose, onPick, onCreateNew }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMG, setNewMG] = useState(MUSCLE_GROUPS[0]);

  useEffect(() => {
    if (open) { setQuery(''); setSelected([]); setCreating(false); setNewName(''); }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return exercises
      .filter(e => !q || e.name.toLowerCase().includes(q) || e.muscleGroup.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'no'));
  }, [exercises, query]);

  const grouped = useMemo(() => {
    const map = {};
    for (const e of filtered) {
      (map[e.muscleGroup] ||= []).push(e);
    }
    return map;
  }, [filtered]);

  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const submitNew = () => {
    if (!newName.trim()) return;
    const id = onCreateNew(newName.trim(), newMG);
    setSelected(s => [...s, id]);
    setCreating(false);
    setNewName('');
  };

  return html`
    <${Modal} open=${open} onClose=${onClose} title="Velg øvelser">
      ${creating ? html`
        <div class="space-y-3">
          <${Field} label="Navn">
            <${Input} value=${newName} onInput=${setNewName} placeholder="f.eks. Knebøy" />
          <//>
          <${Field} label="Muskelgruppe">
            <${Select} value=${newMG} onChange=${setNewMG} options=${MUSCLE_GROUPS} />
          <//>
          <div class="flex gap-2 pt-2">
            <${Button} variant="secondary" className="flex-1" onClick=${() => setCreating(false)}>Avbryt<//>
            <${Button} className="flex-1" onClick=${submitNew} disabled=${!newName.trim()}>Lagre<//>
          </div>
        </div>
      ` : html`
        <div class="space-y-3">
          <${Input} value=${query} onInput=${setQuery} placeholder="Søk øvelser..." />

          ${exercises.length === 0 ? html`
            <div class="py-8 text-center text-sm text-ink-500">
              Du har ingen øvelser ennå.
            </div>
          ` : html`
            <div class="max-h-[50vh] overflow-y-auto -mx-5 px-5">
              ${Object.keys(grouped).sort().map(mg => html`
                <div class="mb-4">
                  <div class="text-[10px] uppercase tracking-wider text-ink-400 mb-1.5 sticky top-0 bg-white py-1">${mg}</div>
                  <div class="space-y-1">
                    ${grouped[mg].map(e => html`
                      <button
                        onClick=${() => toggle(e.id)}
                        class=${cx('tap w-full flex items-center justify-between p-3 rounded-xl text-left',
                          selected.includes(e.id) ? 'bg-ink-900 text-white' : 'bg-ink-50 active:bg-ink-100')}
                      >
                        <span class="font-medium">${e.name}</span>
                        ${selected.includes(e.id) && html`
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="m5 12 5 5L20 7"/></svg>
                        `}
                      </button>
                    `)}
                  </div>
                </div>
              `)}
            </div>
          `}

          <div class="flex gap-2 pt-2 border-t border-ink-100 -mx-5 px-5">
            <${Button} variant="secondary" className="flex-1" onClick=${() => setCreating(true)}>+ Ny øvelse<//>
            <${Button} className="flex-1" onClick=${() => onPick(selected)} disabled=${selected.length === 0}>
              Legg til ${selected.length > 0 ? `(${selected.length})` : ''}
            <//>
          </div>
        </div>
      `}
    <//>
  `;
}

/* =========================================================
   SCREEN: ØVELSER
   ========================================================= */

function ExercisesScreen({ data, update }) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null); // exercise eller {} for ny
  const [filter, setFilter] = useState('alle');

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return data.exercises
      .filter(e => filter === 'alle' || e.muscleGroup === filter)
      .filter(e => !q || e.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'no'));
  }, [data.exercises, query, filter]);

  const save = (ex) => {
    update((d) => {
      if (ex.id) {
        const idx = d.exercises.findIndex(e => e.id === ex.id);
        if (idx >= 0) d.exercises[idx] = ex;
      } else {
        d.exercises.push({ ...ex, id: uid(), createdAt: Date.now() });
      }
    });
    setEditing(null);
  };
  const remove = (id) => {
    if (!confirm('Slette denne øvelsen? Eksisterende økter beholdes uendret.')) return;
    update((d) => { d.exercises = d.exercises.filter(e => e.id !== id); });
    setEditing(null);
  };

  return html`
    <div class="screen-enter pb-24">
      <${Header} title="Øvelser" right=${html`
        <${IconButton} onClick=${() => setEditing({})}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
        <//>
      `} />

      <div class="px-5 mb-3">
        <${Input} value=${query} onInput=${setQuery} placeholder="Søk øvelser..." />
      </div>

      <div class="px-5 mb-4 flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
        ${['alle', ...MUSCLE_GROUPS].map(mg => html`
          <button
            onClick=${() => setFilter(mg)}
            class=${cx('tap shrink-0 px-3 h-8 rounded-full text-sm capitalize',
              filter === mg ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-700')}
          >${mg}</button>
        `)}
      </div>

      ${filtered.length === 0 ? html`
        <${EmptyState}
          icon="🧱"
          title=${data.exercises.length === 0 ? 'Ingen øvelser ennå' : 'Ingen treff'}
          body=${data.exercises.length === 0 ? 'Legg til din første øvelse for å begynne å logge.' : 'Prøv å justere søk eller filter.'}
          action=${data.exercises.length === 0 ? html`<${Button} onClick=${() => setEditing({})}>Legg til øvelse<//>` : null}
        />
      ` : html`
        <div class="px-5 space-y-1">
          ${filtered.map(e => html`
            <button onClick=${() => setEditing(e)} class="tap w-full text-left">
              <${Card} className="p-4 flex items-center justify-between">
                <div>
                  <div class="font-medium">${e.name}</div>
                  <div class="text-xs text-ink-400">${e.muscleGroup}</div>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="text-ink-300"><path d="m9 6 6 6-6 6"/></svg>
              <//>
            </button>
          `)}
        </div>
      `}

      <${ExerciseEditor} editing=${editing} onClose=${() => setEditing(null)} onSave=${save} onDelete=${remove} />
    </div>
  `;
}

function ExerciseEditor({ editing, onClose, onSave, onDelete }) {
  const isNew = editing && !editing.id;
  const [name, setName] = useState('');
  const [mg, setMG] = useState(MUSCLE_GROUPS[0]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (editing) {
      setName(editing.name || '');
      setMG(editing.muscleGroup || MUSCLE_GROUPS[0]);
      setNotes(editing.notes || '');
    }
  }, [editing]);

  const submit = () => {
    if (!name.trim()) return;
    onSave({ ...editing, name: name.trim(), muscleGroup: mg, notes });
  };

  return html`
    <${Modal} open=${!!editing} onClose=${onClose} title=${isNew ? 'Ny øvelse' : 'Rediger øvelse'}>
      <div class="space-y-3">
        <${Field} label="Navn">
          <${Input} value=${name} onInput=${setName} placeholder="f.eks. Knebøy" />
        <//>
        <${Field} label="Muskelgruppe">
          <${Select} value=${mg} onChange=${setMG} options=${MUSCLE_GROUPS} />
        <//>
        <${Field} label="Notater (valgfritt)">
          <textarea
            value=${notes}
            onInput=${(e) => setNotes(e.currentTarget.value)}
            placeholder="Form-tips, utstyr, osv."
            rows="3"
            class="w-full p-3 rounded-xl bg-ink-50 outline-none focus:bg-white focus:ring-1 focus:ring-ink-300 resize-none"
          ></textarea>
        <//>
        <div class="flex gap-2 pt-3">
          ${!isNew && html`
            <${Button} variant="danger" onClick=${() => onDelete(editing.id)}>Slett<//>
          `}
          <${Button} className="flex-1" onClick=${submit} disabled=${!name.trim()}>
            ${isNew ? 'Legg til' : 'Lagre'}
          <//>
        </div>
      </div>
    <//>
  `;
}

/* =========================================================
   SCREEN: PROGRAMMER
   ========================================================= */

function ProgramsScreen({ data, update, navigate }) {
  const [editing, setEditing] = useState(null);

  const save = (program) => {
    update((d) => {
      if (program.id) {
        const idx = d.programs.findIndex(p => p.id === program.id);
        if (idx >= 0) d.programs[idx] = program;
      } else {
        d.programs.push({ ...program, id: uid() });
      }
    });
    setEditing(null);
  };
  const remove = (id) => {
    if (!confirm('Slette dette programmet?')) return;
    update((d) => { d.programs = d.programs.filter(p => p.id !== id); });
    setEditing(null);
  };

  return html`
    <div class="screen-enter pb-24">
      <${Header} title="Programmer" right=${html`
        <${IconButton} onClick=${() => setEditing({ name: '', days: [{ id: uid(), name: 'Dag 1', exercises: [] }] })}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
        <//>
      `} />

      ${data.programs.length === 0 ? html`
        <${EmptyState}
          icon="📋"
          title="Ingen programmer"
          body="Programmer er maler for økter du gjentar. Lag for eksempel et Push-Pull-Legs-program."
          action=${html`<${Button} onClick=${() => setEditing({ name: '', days: [{ id: uid(), name: 'Dag 1', exercises: [] }] })}>Lag program<//>`}
        />
      ` : html`
        <div class="px-5 space-y-2">
          ${data.programs.map(p => html`
            <button class="tap w-full text-left" onClick=${() => setEditing(p)}>
              <${Card} className="p-4">
                <div class="font-medium mb-1">${p.name}</div>
                <div class="text-xs text-ink-400">${p.days.length} dag${p.days.length === 1 ? '' : 'er'} · ${p.days.flatMap(d => d.exercises).length} øvelser</div>
              <//>
            </button>
          `)}
        </div>
      `}

      <${ProgramEditor}
        editing=${editing}
        exercises=${data.exercises}
        onClose=${() => setEditing(null)}
        onSave=${save}
        onDelete=${remove}
        onCreateExercise=${(name, mg) => {
          let id;
          update((d) => {
            id = uid();
            d.exercises.push({ id, name, muscleGroup: mg, notes: '', createdAt: Date.now() });
          });
          return id;
        }}
      />
    </div>
  `;
}

function ProgramEditor({ editing, exercises, onClose, onSave, onDelete, onCreateExercise }) {
  const isNew = editing && !editing.id;
  const [program, setProgram] = useState(editing);
  const [pickerForDay, setPickerForDay] = useState(null);

  useEffect(() => { setProgram(editing); }, [editing]);

  if (!program) return null;

  const update = (mutator) => setProgram(p => {
    const draft = JSON.parse(JSON.stringify(p));
    mutator(draft);
    return draft;
  });

  const addDay = () => update(p => p.days.push({ id: uid(), name: `Dag ${p.days.length + 1}`, exercises: [] }));
  const removeDay = (idx) => update(p => p.days.splice(idx, 1));
  const renameDay = (idx, name) => update(p => { p.days[idx].name = name; });
  const addExercisesToDay = (dayIdx, ids) => update(p => {
    for (const id of ids) p.days[dayIdx].exercises.push({ exerciseId: id, targetSets: 3, targetReps: '8-12' });
  });
  const removeExerciseFromDay = (dayIdx, exIdx) => update(p => p.days[dayIdx].exercises.splice(exIdx, 1));
  const updateExerciseInDay = (dayIdx, exIdx, patch) => update(p => Object.assign(p.days[dayIdx].exercises[exIdx], patch));

  const submit = () => {
    if (!program.name.trim()) return;
    onSave(program);
  };

  return html`
    <${Modal} open=${!!editing} onClose=${onClose} title=${isNew ? 'Nytt program' : 'Rediger program'}>
      <div class="space-y-4">
        <${Field} label="Programnavn">
          <${Input} value=${program.name} onInput=${(v) => update(p => { p.name = v; })} placeholder="f.eks. Push Pull Legs" />
        <//>

        <div class="space-y-3">
          ${program.days.map((day, di) => html`
            <div class="rounded-xl border border-ink-100 p-3">
              <div class="flex items-center gap-2 mb-2">
                <input
                  value=${day.name}
                  onInput=${(e) => renameDay(di, e.currentTarget.value)}
                  class="flex-1 bg-transparent font-medium outline-none"
                />
                ${program.days.length > 1 && html`
                  <button class="tap text-ink-400 text-sm" onClick=${() => removeDay(di)}>Fjern</button>
                `}
              </div>
              <div class="space-y-1">
                ${day.exercises.map((ex, exIdx) => {
                  const exercise = exercises.find(e => e.id === ex.exerciseId);
                  return html`
                    <div class="flex items-center gap-2 p-2 bg-ink-50 rounded-lg">
                      <div class="flex-1 text-sm">${exercise?.name || 'Slettet'}</div>
                      <input
                        type="number" inputMode="numeric"
                        value=${ex.targetSets}
                        onInput=${(e) => updateExerciseInDay(di, exIdx, { targetSets: parseInt(e.currentTarget.value) || 3 })}
                        class="w-12 h-8 px-2 bg-white rounded text-sm text-center"
                        title="Antall sett"
                      />
                      <span class="text-xs text-ink-400">×</span>
                      <input
                        value=${ex.targetReps || ''}
                        onInput=${(e) => updateExerciseInDay(di, exIdx, { targetReps: e.currentTarget.value })}
                        placeholder="8-12"
                        class="w-16 h-8 px-2 bg-white rounded text-sm text-center"
                        title="Reps"
                      />
                      <button onClick=${() => removeExerciseFromDay(di, exIdx)} class="tap text-ink-400 text-sm">×</button>
                    </div>
                  `;
                })}
              </div>
              <button
                class="tap w-full mt-2 h-9 text-sm text-ink-500 rounded-lg active:bg-ink-50"
                onClick=${() => setPickerForDay(di)}
              >+ Legg til øvelser</button>
            </div>
          `)}
          <button class="tap w-full h-10 text-sm text-ink-500 rounded-lg active:bg-ink-50" onClick=${addDay}>
            + Legg til dag
          </button>
        </div>

        <div class="flex gap-2 pt-3">
          ${!isNew && html`<${Button} variant="danger" onClick=${() => onDelete(program.id)}>Slett<//>`}
          <${Button} className="flex-1" onClick=${submit} disabled=${!program.name.trim()}>
            ${isNew ? 'Lagre' : 'Oppdater'}
          <//>
        </div>
      </div>

      <${ExercisePicker}
        open=${pickerForDay !== null}
        exercises=${exercises}
        onClose=${() => setPickerForDay(null)}
        onPick=${(ids) => { addExercisesToDay(pickerForDay, ids); setPickerForDay(null); }}
        onCreateNew=${onCreateExercise}
      />
    <//>
  `;
}

/* =========================================================
   SCREEN: STATISTIKK & HISTORIKK
   ========================================================= */

function StatsScreen({ data, navigate }) {
  const [tab, setTab] = useState('oversikt');
  const [exerciseId, setExerciseId] = useState(data.exercises[0]?.id || '');

  const stats = useMemo(() => computeOverallStats(data.workouts), [data.workouts]);

  return html`
    <div class="screen-enter pb-24">
      <${Header} title="Statistikk" />

      <div class="px-5 mb-4 flex gap-1 bg-ink-100 rounded-xl p-1">
        ${[['oversikt', 'Oversikt'], ['historikk', 'Historikk'], ['ovelse', 'Per øvelse']].map(([k, l]) => html`
          <button
            onClick=${() => setTab(k)}
            class=${cx('tap flex-1 h-9 rounded-lg text-sm font-medium',
              tab === k ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500')}
          >${l}</button>
        `)}
      </div>

      ${tab === 'oversikt' && html`<${OverviewTab} data=${data} stats=${stats} />`}
      ${tab === 'historikk' && html`<${HistoryTab} data=${data} navigate=${navigate} />`}
      ${tab === 'ovelse' && html`<${PerExerciseTab} data=${data} exerciseId=${exerciseId} setExerciseId=${setExerciseId} />`}
    </div>
  `;
}

function computeOverallStats(workouts) {
  const total = workouts.length;
  const totalSets = workouts.reduce((n, w) => n + completedSetCount(w), 0);
  const totalVol = workouts.reduce((n, w) => n + totalVolume(w), 0);
  const totalMin = workouts.reduce((n, w) => n + (w.duration || 0), 0) / 60;
  return { total, totalSets, totalVol, totalMin };
}

function OverviewTab({ data, stats }) {
  const last8Weeks = useMemo(() => computeWeeklyVolume(data.workouts, 8), [data.workouts]);
  const max = Math.max(1, ...last8Weeks.map(w => w.volume));

  return html`
    <div class="px-5 space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <${StatCard} label="Økter totalt" value=${stats.total} />
        <${StatCard} label="Sett fullført" value=${stats.totalSets} />
        <${StatCard} label="Total volum" value=${`${Math.round(stats.totalVol).toLocaleString('no-NO')} ${data.settings.units}`} />
        <${StatCard} label="Tid trent" value=${`${Math.round(stats.totalMin)} min`} />
      </div>

      <${Card} className="p-4">
        <div class="text-xs uppercase tracking-wide text-ink-400 font-medium mb-3">Volum siste 8 uker</div>
        ${last8Weeks.every(w => w.volume === 0) ? html`
          <div class="text-sm text-ink-400 py-6 text-center">Ingen data ennå</div>
        ` : html`
          <div class="flex items-end gap-1 h-32">
            ${last8Weeks.map(w => html`
              <div class="flex-1 flex flex-col items-center gap-1">
                <div class="w-full flex items-end h-24">
                  <div
                    class="w-full bg-ink-900 rounded-t-md transition-all"
                    style=${`height: ${(w.volume / max) * 100}%; min-height: ${w.volume > 0 ? 4 : 0}px;`}
                  ></div>
                </div>
                <div class="text-[10px] text-ink-400">${w.label}</div>
              </div>
            `)}
          </div>
        `}
      <//>
    </div>
  `;
}

function StatCard({ label, value }) {
  return html`
    <${Card} className="p-4">
      <div class="text-xs uppercase tracking-wide text-ink-400 font-medium mb-1">${label}</div>
      <div class="text-2xl font-semibold tracking-tight big-num">${value}</div>
    <//>
  `;
}

function computeWeeklyVolume(workouts, weeks) {
  const now = Date.now();
  const weekMs = 7 * 86400000;
  // Start på mandag denne uka
  const today = new Date(); today.setHours(0,0,0,0);
  const dayDiff = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const thisMonday = today.getTime() - dayDiff * 86400000;
  const result = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = thisMonday - i * weekMs;
    const end = start + weekMs;
    const inWeek = workouts.filter(w => w.date >= start && w.date < end);
    const vol = inWeek.reduce((n, w) => n + totalVolume(w), 0);
    const label = `${new Date(start).getDate()}/${new Date(start).getMonth() + 1}`;
    result.push({ start, end, volume: vol, label });
  }
  return result;
}

function HistoryTab({ data, navigate }) {
  const sorted = [...data.workouts].sort((a, b) => b.date - a.date);
  if (sorted.length === 0) {
    return html`<div class="px-5"><${EmptyState} icon="📜" title="Ingen historikk" body="Fullfør din første økt for å se den her." /></div>`;
  }
  return html`
    <div class="px-5 space-y-2">
      ${sorted.map(w => html`<${WorkoutSummaryRow} workout=${w} exercises=${data.exercises} units=${data.settings.units} onClick=${() => navigate('historikk-detalj', { workoutId: w.id })} />`)}
    </div>
  `;
}

function PerExerciseTab({ data, exerciseId, setExerciseId }) {
  if (data.exercises.length === 0) {
    return html`<div class="px-5"><${EmptyState} icon="📈" title="Ingen øvelser" body="Legg til øvelser og logg dem for å se progresjon." /></div>`;
  }
  const exercise = data.exercises.find(e => e.id === exerciseId);
  const points = useMemo(() => buildExerciseProgress(data.workouts, exerciseId), [data.workouts, exerciseId]);
  const pr = useMemo(() => {
    let best = { weight: 0, reps: 0, e1rm: 0 };
    for (const w of data.workouts) {
      const ex = w.exercises.find(e => e.exerciseId === exerciseId);
      if (!ex) continue;
      for (const s of ex.sets) {
        if (!s.completed) continue;
        const e1rm = estimate1RM(s.weight, s.reps);
        if (e1rm > best.e1rm) best = { weight: s.weight, reps: s.reps, e1rm, date: w.date };
      }
    }
    return best;
  }, [data.workouts, exerciseId]);

  return html`
    <div class="px-5 space-y-4">
      <${Field} label="Velg øvelse">
        <${Select}
          value=${exerciseId}
          onChange=${setExerciseId}
          options=${data.exercises.map(e => ({ value: e.id, label: e.name }))}
        />
      <//>

      ${points.length === 0 ? html`
        <div class="text-sm text-ink-400 text-center py-12">Ingen logget data for ${exercise?.name}</div>
      ` : html`
        <div class="grid grid-cols-2 gap-3">
          <${StatCard} label="Beste sett" value=${`${pr.weight}${data.settings.units} × ${pr.reps}`} />
          <${StatCard} label="Estimert 1RM" value=${`${Math.round(pr.e1rm)} ${data.settings.units}`} />
        </div>

        <${Card} className="p-4">
          <div class="text-xs uppercase tracking-wide text-ink-400 font-medium mb-3">Estimert 1RM over tid</div>
          <${LineChart} points=${points} units=${data.settings.units} />
        <//>
      `}
    </div>
  `;
}

function buildExerciseProgress(workouts, exerciseId) {
  const data = [];
  const sorted = [...workouts].sort((a, b) => a.date - b.date);
  for (const w of sorted) {
    const ex = w.exercises.find(e => e.exerciseId === exerciseId);
    if (!ex) continue;
    let bestE1rm = 0;
    for (const s of ex.sets) {
      if (!s.completed) continue;
      const e1rm = estimate1RM(s.weight, s.reps);
      if (e1rm > bestE1rm) bestE1rm = e1rm;
    }
    if (bestE1rm > 0) data.push({ date: w.date, value: bestE1rm });
  }
  return data;
}

function LineChart({ points, units }) {
  if (points.length === 0) return null;
  const W = 320, H = 140, P = 24;
  const xs = points.map(p => p.date);
  const ys = points.map(p => p.value);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys) * 0.95, yMax = Math.max(...ys) * 1.05;
  const xScale = (x) => P + (xs.length > 1 ? ((x - xMin) / (xMax - xMin || 1)) * (W - 2 * P) : (W - 2 * P) / 2);
  const yScale = (y) => H - P - ((y - yMin) / (yMax - yMin || 1)) * (H - 2 * P);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.date).toFixed(1)} ${yScale(p.value).toFixed(1)}`).join(' ');

  return html`
    <svg viewBox=${`0 0 ${W} ${H}`} class="w-full h-auto">
      <line x1=${P} y1=${H - P} x2=${W - P} y2=${H - P} stroke="#e4e4e7" stroke-width="1" />
      <path d=${path} fill="none" stroke="#0a0a0a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      ${points.map(p => html`<circle cx=${xScale(p.date)} cy=${yScale(p.value)} r="3" fill="#0a0a0a" />`)}
      <text x=${P} y=${H - 6} font-size="10" fill="#a1a1aa">${fmtDate(xMin)}</text>
      <text x=${W - P} y=${H - 6} font-size="10" fill="#a1a1aa" text-anchor="end">${fmtDate(xMax)}</text>
      <text x=${W - P} y="14" font-size="10" fill="#a1a1aa" text-anchor="end">${Math.round(yMax)} ${units}</text>
    </svg>
  `;
}

/* =========================================================
   SCREEN: HISTORIKK-DETALJ
   ========================================================= */

function WorkoutDetailScreen({ data, update, navigate, params }) {
  const w = data.workouts.find(x => x.id === params.workoutId);
  if (!w) {
    return html`<div class="p-5"><${Button} onClick=${() => navigate('statistikk')}>← Tilbake<//></div>`;
  }
  const remove = () => {
    if (!confirm('Slette denne økta permanent?')) return;
    update(d => { d.workouts = d.workouts.filter(x => x.id !== w.id); });
    navigate('statistikk');
  };
  return html`
    <div class="screen-enter pb-24">
      <div class="px-5 pt-6 pb-4 flex items-center justify-between">
        <${IconButton} onClick=${() => navigate('statistikk')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>
        <//>
        <${IconButton} onClick=${remove}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="text-red-500"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1.5 14a2 2 0 0 1-2 1.8H8.5a2 2 0 0 1-2-1.8L5 6"/></svg>
        <//>
      </div>
      <div class="px-5 mb-5">
        <div class="text-xs uppercase tracking-wide text-ink-400 mb-1">${fmtDateLong(w.date)} · ${fmtTime(w.date)}</div>
        <h1 class="text-3xl font-semibold tracking-tight">${w.name || 'Økt'}</h1>
        <div class="mt-2 flex gap-4 text-sm text-ink-500">
          ${w.duration && html`<span>${fmtDuration(w.duration)}</span>`}
          <span>${completedSetCount(w)} sett</span>
          <span>${Math.round(totalVolume(w)).toLocaleString('no-NO')} ${data.settings.units}</span>
        </div>
      </div>

      <div class="px-5 space-y-3">
        ${w.exercises.map(we => {
          const ex = data.exercises.find(e => e.id === we.exerciseId);
          return html`
            <${Card} className="p-4">
              <div class="font-medium mb-2">${ex?.name || 'Slettet øvelse'}</div>
              <div class="space-y-1">
                ${we.sets.map((s, i) => html`
                  <div class="flex items-center gap-3 text-sm py-1">
                    <span class="w-6 text-ink-400">${i + 1}</span>
                    <span class="big-num">${s.weight}${data.settings.units} × ${s.reps}</span>
                    ${s.rpe !== '' && s.rpe !== undefined && html`<span class="text-xs text-ink-400">RPE ${s.rpe}</span>`}
                    ${s.rir !== '' && s.rir !== undefined && html`<span class="text-xs text-ink-400">RIR ${s.rir}</span>`}
                  </div>
                `)}
              </div>
            <//>
          `;
        })}
      </div>
    </div>
  `;
}

/* =========================================================
   SCREEN: INNSTILLINGER
   ========================================================= */

function SettingsScreen({ data, update, setRawData }) {
  const setSettings = (patch) => update(d => Object.assign(d.settings, patch));
  const fileInput = useRef(null);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trening-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (file) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.exercises || !parsed.workouts) throw new Error('Ugyldig fil');
      if (!confirm('Dette overskriver alle eksisterende data. Fortsette?')) return;
      setRawData({ ...DEFAULT_DATA(), ...parsed, settings: { ...DEFAULT_DATA().settings, ...(parsed.settings || {}) } });
      alert('Importert.');
    } catch (e) {
      alert('Kunne ikke lese fila: ' + e.message);
    }
  };

  const wipe = () => {
    if (!confirm('Slette ALLE data permanent? Dette kan ikke angres.')) return;
    if (!confirm('Helt sikker?')) return;
    setRawData(DEFAULT_DATA());
  };

  return html`
    <div class="screen-enter pb-24">
      <${Header} title="Innstillinger" />

      <div class="px-5 space-y-4">
        <${Card} className="p-4 space-y-3">
          <${Field} label="Vektenhet">
            <div class="flex gap-1 bg-ink-100 rounded-xl p-1">
              ${['kg', 'lb'].map(u => html`
                <button
                  onClick=${() => setSettings({ units: u })}
                  class=${cx('tap flex-1 h-9 rounded-lg text-sm font-medium uppercase',
                    data.settings.units === u ? 'bg-white shadow-sm' : 'text-ink-500')}
                >${u}</button>
              `)}
            </div>
          <//>
          <${Field} label="Standard hviletid (sekunder)">
            <${Input} type="number" inputMode="numeric" value=${data.settings.restSeconds} onInput=${(v) => setSettings({ restSeconds: parseInt(v) || 0 })} />
          <//>
          <${Field} label="Vis RPE (Rate of Perceived Exertion, 1–10)">
            <div class="flex gap-1 bg-ink-100 rounded-xl p-1">
              ${[[true, 'På'], [false, 'Av']].map(([v, l]) => html`
                <button
                  onClick=${() => setSettings({ showRPE: v })}
                  class=${cx('tap flex-1 h-9 rounded-lg text-sm font-medium',
                    data.settings.showRPE === v ? 'bg-white shadow-sm' : 'text-ink-500')}
                >${l}</button>
              `)}
            </div>
          <//>
        <//>

        <${Card} className="p-4">
          <div class="text-xs uppercase tracking-wide text-ink-400 font-medium mb-3">Data</div>
          <div class="space-y-2">
            <${Button} variant="secondary" className="w-full" onClick=${exportData}>📥 Eksporter til fil (.json)<//>
            <${Button} variant="secondary" className="w-full" onClick=${() => fileInput.current?.click()}>📤 Importer fra fil<//>
            <input
              ref=${fileInput}
              type="file"
              accept="application/json"
              class="hidden"
              onChange=${(e) => e.currentTarget.files?.[0] && importData(e.currentTarget.files[0])}
            />
          </div>
          <p class="text-xs text-ink-400 mt-3">
            Dataene ligger lokalt på denne enheten. Eksporter regelmessig for å ha en backup.
          </p>
        <//>

        <${Card} className="p-4">
          <div class="text-xs uppercase tracking-wide text-ink-400 font-medium mb-3">Statistikk</div>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div><div class="text-xl font-semibold big-num">${data.exercises.length}</div><div class="text-xs text-ink-400">Øvelser</div></div>
            <div><div class="text-xl font-semibold big-num">${data.programs.length}</div><div class="text-xs text-ink-400">Programmer</div></div>
            <div><div class="text-xl font-semibold big-num">${data.workouts.length}</div><div class="text-xs text-ink-400">Økter</div></div>
          </div>
        <//>

        <${Card} className="p-4 border-red-100">
          <div class="text-xs uppercase tracking-wide text-red-500 font-medium mb-2">Faresone</div>
          <${Button} variant="danger" className="w-full" onClick=${wipe}>Slett alle data<//>
        <//>

        <div class="text-center text-xs text-ink-400 pt-4">Trening · v1.0</div>
      </div>
    </div>
  `;
}

/* =========================================================
   BUNNNAVIGERING + ROUTER
   ========================================================= */

const TABS = [
  { id: 'hjem', label: 'Hjem', icon: html`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>` },
  { id: 'logg', label: 'Logg', icon: html`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5h11M6.5 17.5h11M3 12h18M3 7h2M3 17h2M19 7h2M19 17h2"/></svg>` },
  { id: 'ovelser', label: 'Øvelser', icon: html`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10v4M17 10v4M3 12h18"/></svg>` },
  { id: 'programmer', label: 'Programmer', icon: html`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>` },
  { id: 'statistikk', label: 'Statistikk', icon: html`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m7 14 3-3 3 3 5-5"/></svg>` },
];

function BottomNav({ current, onChange }) {
  return html`
    <nav class="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-ink-100 safe-bottom z-30">
      <div class="grid grid-cols-5 max-w-md mx-auto">
        ${TABS.map(t => html`
          <button
            onClick=${() => onChange(t.id)}
            class=${cx('tap flex flex-col items-center gap-0.5 py-2.5',
              current === t.id ? 'text-ink-900' : 'text-ink-400')}
          >
            ${t.icon}
            <span class="text-[10px] font-medium">${t.label}</span>
          </button>
        `)}
      </div>
    </nav>
  `;
}

/* =========================================================
   APP
   ========================================================= */

function App() {
  const [data, update, setRawData] = useStore();
  const [route, setRoute] = useState({ name: 'hjem', params: {} });
  const navigate = (name, params = {}) => setRoute({ name, params });

  // Hvis det er en aktiv økt og brukeren bytter til "logg"-fanen, bra. Ellers ingen redirect.

  // Map fra fane-id til skjerm
  const renderRoute = () => {
    switch (route.name) {
      case 'hjem': return html`<${HomeScreen} data=${data} update=${update} navigate=${navigate} />`;
      case 'logg': return html`<${WorkoutScreen} data=${data} update=${update} navigate=${navigate} />`;
      case 'ovelser': return html`<${ExercisesScreen} data=${data} update=${update} />`;
      case 'programmer': return html`<${ProgramsScreen} data=${data} update=${update} navigate=${navigate} />`;
      case 'statistikk': return html`<${StatsScreen} data=${data} navigate=${navigate} />`;
      case 'historikk':
      case 'historikk-detalj':
        return html`<${WorkoutDetailScreen} data=${data} update=${update} navigate=${navigate} params=${route.params} />`;
      case 'innstillinger': return html`<${SettingsScreen} data=${data} update=${update} setRawData=${setRawData} />`;
      default: return null;
    }
  };

  // Bunn-fanene viser kun de fem hovedfanene; andre ruter er detalj-skjermer
  const navTab = ['hjem','logg','ovelser','programmer','statistikk'].includes(route.name) ? route.name : null;

  return html`
    <div class="min-h-screen max-w-md mx-auto relative safe-top">
      ${renderRoute()}
      <${BottomNav}
        current=${navTab}
        onChange=${(id) => navigate(id)}
      />
    </div>
  `;
}

render(html`<${App} />`, document.getElementById('app'));
