// Reign Safe Mode vSM2 — cloud-first + debounced cloud save
const CREDS = { userId: 'zack', token: 'test-token-123' };
const APP_KEY = 'reign-safe-state';

const defaultHabits = [
  { id:'h-read',      title:'Read (100 min/day)',  schedule:'daily',  type:'minutes', target:100, difficulty:2, archived:false },
  { id:'h-meditate',  title:'Meditate (10 min)',   schedule:'daily',  type:'minutes', target:10,  difficulty:2, archived:false },
  { id:'h-deepsquat', title:'Deep squat (5 min)',  schedule:'daily',  type:'minutes', target:5,   difficulty:2, archived:false }
];

const defaultState = {
  xp: 0, coins: 0, completions: [], history: {},
  habits: defaultHabits.map(h => ({...h}))
};

let state = {...defaultState};

const $ = s => document.querySelector(s);
const toast = msg => {
  let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className='toast'; document.body.append(t); }
  t.textContent = msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 1200);
};

function levelFromXP(xp){ return Math.floor(Math.sqrt(xp/50))+1; }
function todayKey(d=new Date()){ return d.toISOString().slice(0,10); }
function isDue(h){
  const k = todayKey();
  return !state.completions.some(c => c.habitId===h.id && c.dateISO.startsWith(k));
}

async function api(path, body){
  const res = await fetch(path, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}
async function cloudLoad(){ try{ return await api('/api/load', CREDS); }catch{ return null; } }

// Debounced save so we don’t spam KV
let saveTimer = null;
async function cloudSaveNow(){ try{ await api('/api/save', {...CREDS, state}); }catch(e){ console.warn('save failed', e); } }
function cloudSaveDebounced(){
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(cloudSaveNow, 400);
}

function saveLocal(){ localStorage.setItem(APP_KEY, JSON.stringify(state)); }
function loadLocal(){
  try { const raw = localStorage.getItem(APP_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function mergeDefaults(){
  if (!Array.isArray(state.habits)) state.habits = [];
  const have = new Set(state.habits.map(h=>h.id));
  defaultHabits.forEach(r => { if (!have.has(r.id)) state.habits.push({...r}); });
  state.habits.forEach(h => { if (defaultHabits.some(r => r.id===h.id)) h.archived=false; });
}

function renderHeader(){
  $('#level').textContent = `Lv ${levelFromXP(state.xp)}`;
  $('#xp').textContent = `${state.xp} XP`;
}

function complete(h, minutes){
  const target = h.target || minutes || 30;
  const val = Math.max(1, minutes || target);
  const proportion = Math.min(1, val / target);
  const base = 10 + h.difficulty*5;
  const xp = Math.round(base * proportion);
  const coins = Math.max(1, Math.ceil(xp/10));

  state.completions.push({ id: crypto.randomUUID(), habitId: h.id, value: val, dateISO: new Date().toISOString(), xp, coins });
  state.xp += xp;
  state.coins = (state.coins||0) + coins;

  // history (for future charts)
  const k = todayKey(); if(!state.history[k]) state.history[k] = { xp:0, coins:0 };
  state.history[k].xp += xp; state.history[k].coins = (state.history[k].coins||0) + coins;
}

function renderToday(){
  const wrap = $('#today'); wrap.innerHTML = '';
  state.habits.filter(h=>!h.archived).forEach(h=>{
    const card = document.createElement('div'); card.className = 'card';
    const due = isDue(h);
    card.innerHTML = `
      <div class="title">${h.title}</div>
      <div class="meta">${h.schedule==='daily'?'Daily':'Weekly'} • Diff ${h.difficulty}</div>
      <div class="controls"></div>`;
    const ctr = card.querySelector('.controls');

    if (h.type==='minutes'){
      const input = document.createElement('input'); input.type='number'; input.placeholder=`${h.target} min`; input.min='1';
      const btn = document.createElement('button'); btn.textContent = due ? 'Log minutes' : 'Done';
      btn.onclick = async ()=>{
        if (!due) { toast('Already completed today'); return; }
        const mins = parseInt(input.value||`${h.target}`, 10);
        complete(h, mins);
        saveLocal(); cloudSaveDebounced();
        renderHeader(); renderToday();
        toast(`+${mins}m • +XP`);
      };
      ctr.append(input, btn);
    } else {
      const btn = document.createElement('button'); btn.textContent = due ? 'Complete' : 'Done';
      btn.onclick = async ()=>{
        if (!due) { toast('Already completed today'); return; }
        complete(h, 1);
        saveLocal(); cloudSaveDebounced();
        renderHeader(); renderToday();
        toast('+XP');
      };
      ctr.append(btn);
    }

    wrap.append(card);
  });
}

// Cloud-first boot (with fallbacks)
async function boot(){
  let remote = null;
  try { remote = await cloudLoad(); } catch(e) { console.warn('cloud load failed', e); }

  if (remote && Array.isArray(remote.habits) && remote.habits.length) {
    state = remote;               // prefer cloud
  } else {
    state = loadLocal() || {...defaultState};  // fallback to local or defaults
  }

  mergeDefaults();  // guarantee Read/Meditate/Deep Squat present
  saveLocal();      // keep a local copy
  cloudSaveDebounced(); // push to KV soon

  renderHeader();
  renderToday();
}

$('#sync-cloud').onclick = async()=>{
  const remote = await cloudLoad();
  if (remote){
    state = remote; mergeDefaults(); saveLocal(); renderHeader(); renderToday(); toast('Synced from cloud');
  } else toast('No cloud data');
};
$('#push-cloud').onclick = async()=>{
  saveLocal(); await cloudSaveNow(); toast('Saved to cloud');
};

// Bonus: auto-save on backgrounding the app
document.addEventListener('visibilitychange', ()=>{ if (document.visibilityState === 'hidden') { saveLocal(); cloudSaveNow(); } });

boot();