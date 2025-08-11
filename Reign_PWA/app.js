// Reign v1.2.31 — enforce habit order + local-day bucketing + cloud-first + Settings: Clear Today

// ---- Cloud + storage --------------------------------------------------------
const APP_KEY = 'reign-data-v1';
const CREDS   = { userId: 'zack', token: 'test-token-123' };

async function api(path, body){
  const r = await fetch(path, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(body)
  });
  if(!r.ok) throw new Error(String(r.status));
  return r.json();
}
async function cloudLoad(){ try{ return await api('/api/load', CREDS); } catch { return null; } }
async function cloudSave(){ try{ await api('/api/save', { ...CREDS, state }); } catch(_){} }

function saveLocal(){ localStorage.setItem(APP_KEY, JSON.stringify(state)); }
function loadLocal(){ try{ const raw=localStorage.getItem(APP_KEY); return raw?JSON.parse(raw):null; }catch{ return null; } }

const $ = s => document.querySelector(s);
function toast(msg){ const el=$('.toast'); if(!el) return; el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),1200); }

// ---- Required habits (your desired order)
const requiredHabits = [
  { id:'h-earthing',  title:'Earthing (5 min/day)',        schedule:'daily',  type:'minutes', target:5,   difficulty:1, archived:false },
  { id:'h-meditate',  title:'Meditate (10 min/day)',       schedule:'daily',  type:'minutes', target:10,  difficulty:2, archived:false },
  { id:'h-workout',   title:'Working out',                 schedule:'daily',  type:'check',   target:1,   difficulty:2, archived:false },
  { id:'h-run',       title:'Run 5k (weekly)',             schedule:'weekly', type:'check',   target:1,   difficulty:3, archived:false },
  { id:'h-deepsquat', title:'Deep squat (5 min)',          schedule:'daily',  type:'minutes', target:5,   difficulty:2, archived:false },
  { id:'h-kungfu',    title:'Kung Fu footwork',            schedule:'daily',  type:'check',   target:1,   difficulty:2, archived:false },
  { id:'h-taichi',    title:'Tai Chi (8 min/day)',         schedule:'daily',  type:'minutes', target:8,   difficulty:2, archived:false },
  { id:'h-yoga',      title:'Yoga: 3 poses (daily)',       schedule:'daily',  type:'check',   target:1,   difficulty:2, archived:false },
  { id:'h-audio',     title:'Audiobook (60–120 min/day)',  schedule:'daily',  type:'minutes', target:60,  difficulty:2, archived:false },
  { id:'h-read',      title:'Read (100 min/day)',          schedule:'daily',  type:'minutes', target:100, difficulty:2, archived:false },
  { id:'h-chastity',  title:'Law of Chastity (daily)',     schedule:'daily',  type:'check',   target:1,   difficulty:3, archived:false }
];
const defaultData = {
  createdAt: new Date().toISOString(),
  xp: 0, coins: 0,
  completions: [],          // each: { id, habitId, value, dateISO, dayKey, xp, coins }
  history: {},              // { [dayKey]: { xp, coins } }
  habits: requiredHabits.map(h=>({...h})),
  rewards: [
    { id:'r-youtube', title:'1 hour YouTube', cost:50 },
    { id:'r-treat',   title:'Healthy treat',  cost:40 }
  ],
  badges: []
};

let state = loadLocal() || structuredClone(defaultData);

// ---- Local day/week helpers (no UTC surprises) ------------------------------
function localDayKey(d = new Date()){
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`; // local yyyy-mm-dd
}
function localWeekKey(d = new Date()){ // Monday start
  const dt = new Date(d);
  const day = dt.getDay();            // 0=Sun..6=Sat (local)
  const diff = (day + 6) % 7;         // days since Monday
  dt.setDate(dt.getDate() - diff);
  return localDayKey(dt);
}
// Parse yyyy-mm-dd as LOCAL date (Safari treats Date('yyyy-mm-dd') as UTC)
function dateFromKey(k){ const [y,m,d]=k.split('-').map(n=>parseInt(n,10)); return new Date(y, m-1, d); }

// ---- Game math --------------------------------------------------------------
function levelFromXP(xp){ return Math.floor(Math.sqrt(xp/50)) + 1; }
function calcXP({difficulty=1, proportion=1}){
  const base=10;
  const xp=Math.round((base + difficulty*5) * proportion);
  const coins=Math.max(1, Math.ceil(xp/10));
  return { xp, coins };
}
// ---- Ensure required habits exist + enforce order ---------------------------
function ensureRequired(){
  if (!Array.isArray(state.habits)) state.habits = [];
  const have = new Set(state.habits.map(h=>h.id));
  requiredHabits.forEach(req => {
    if (!have.has(req.id)) state.habits.push({ ...req });
  });
  // keep required ones un-archived
  state.habits.forEach(h => {
    if (requiredHabits.some(r => r.id === h.id)) h.archived = false;
  });
}

function enforceHabitOrder(){
  const order = new Map(requiredHabits.map((h,i) => [h.id, i]));
  state.habits.sort((a,b) =>
    (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999)
  );
}

// ---- Due checks (use stored dayKey) ----------------------------------------
function isDue(h){
  const todayK = localDayKey();
  if (h.schedule === 'daily') {
    return !state.completions.some(c => c.habitId === h.id && c.dayKey === todayK);
  }
  if (h.schedule === 'weekly') {
    const wk = localWeekKey();
    return !state.completions.some(c =>
      c.habitId === h.id && localWeekKey(dateFromKey(c.dayKey)) === wk
    );
  }
  return true;
}

// ---- History helpers --------------------------------------------------------
function addHistoryForDay(dayKey, xp, coins){
  if (!state.history) state.history = {};
  if (!state.history[dayKey]) state.history[dayKey] = { xp:0, coins:0 };
  state.history[dayKey].xp    += xp;
  state.history[dayKey].coins  = (state.history[dayKey].coins||0) + coins;
}

// ---- Complete a habit (stores fixed local dayKey) ---------------------------
function completeHabit(h, value, proportion){
  const { xp, coins } = calcXP({ difficulty: h.difficulty, proportion });
  const now    = new Date();
  const dayKey = localDayKey(now);

  const rec = {
    id: crypto.randomUUID(),
    habitId: h.id,
    value,
    dateISO: now.toISOString(),
    dayKey,             // <-- pin to local calendar day forever
    xp,
    coins
  };

  state.completions.push(rec);
  state.xp    += xp;
  state.coins += coins;

  addHistoryForDay(dayKey, xp, coins);

  saveLocal(); cloudSave(); render();
}

// ---- Streaks & chart (use dayKey) ------------------------------------------
function calcDailyStreak(){
  let s=0;
  const start=new Date();
  for(let i=0;i<365;i++){
    const d=new Date(start); d.setDate(start.getDate()-i);
    const k=localDayKey(d);
    const did = state.completions.some(c=>{
      const h=state.habits.find(x=>x.id===c.habitId);
      return h?.schedule==='daily' && c.dayKey===k;
    });
    if(did) s++; else break;
  }
  return s;
}

function drawWeeklyChart(){
  const cvs = document.getElementById('weekly-chart'); if (!cvs) return;
  const ctx = cvs.getContext('2d');

  // Retina-safe canvas sizing
  const dpr = window.devicePixelRatio || 1;
  const cssW = cvs.getAttribute('width') || 400;
  const cssH = cvs.getAttribute('height') || 180;
  cvs.width  = cssW * dpr;
  cvs.height = cssH * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0,0,cssW,cssH);

  const startK = localWeekKey(new Date());                 // Monday this week
  const [y,m,d] = startK.split('-').map(n => parseInt(n,10));
  const start = new Date(y, m-1, d);

  // Mon..Sun keys
  const dayKeys = Array.from({length:7}, (_,i) => {
    const dt = new Date(start); dt.setDate(start.getDate()+i);
    return localDayKey(dt);
  });

  // Sum XP per day from completions (fallback to dateISO if no dayKey)
  const dayTotals = new Map(dayKeys.map(k=>[k,0]));
  (state.completions || []).forEach(c => {
    const k = c.dayKey || (c.dateISO ? localDayKey(new Date(c.dateISO)) : null);
    if (!k) return;
    if (localWeekKey(dateFromKey(k)) !== startK) return;
    dayTotals.set(k, (dayTotals.get(k) || 0) + (c.xp || 0));
  });

  const vals = dayKeys.map(k => dayTotals.get(k) || 0);
  const labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  const max = Math.max(10, ...vals);
  const w = cssW, h = cssH, pad = 24;
  const barW = (w - pad*2) / (vals.length * 1.5);

  labels.forEach((lab,i)=>{
    const x = pad + i*barW*1.5 + barW/2;
    const v = vals[i];
    const bh = (h - pad*2) * (v/max);
    ctx.fillStyle = '#7c3aed';
    ctx.fillRect(x, h - pad - bh, barW, bh);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(lab, x+barW/2, h-6);
    if (v>0) { ctx.fillStyle = '#e5e7eb'; ctx.fillText(String(v), x+barW/2, h - pad - bh - 6); }
  });
}

  const labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const max = Math.max(10, ...vals);
  const w=cvs.width, h=cvs.height, pad=24;
  const barW = (w - pad*2) / (vals.length * 1.5);

  labels.forEach((lab,i)=>{
    const x = pad + i*barW*1.5 + barW/2;
    const v = vals[i];
    const bh = (h - pad*2) * (v/max);
    ctx.fillStyle = '#7c3aed'; ctx.fillRect(x, h - pad - bh, barW, bh);
    ctx.fillStyle = '#94a3b8'; ctx.font = '12px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(lab, x+barW/2, h-6);
    if (v>0) { ctx.fillStyle = '#e5e7eb'; ctx.fillText(String(v), x+barW/2, h - pad - bh - 6); }
  });
}

  // Build this week's XP straight from completions
  const startK = localWeekKey(new Date());                    // Monday of this week
  const [y,m,d] = startK.split('-').map(n=>parseInt(n,10));
  const start = new Date(y, m-1, d);

  const dayKeys = Array.from({length:7}, (_,i)=> {
    const dt = new Date(start); dt.setDate(start.getDate()+i);
    return localDayKey(dt);
  });

  const vals = dayKeys.map(k =>
    (state.completions||[])
      .filter(c => localWeekKey(dateFromKey(c.dayKey)) === startK && c.dayKey === k)
      .reduce((s,c)=> s + (c.xp||0), 0)
  );

  const labels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const max = Math.max(10, ...vals);
  const w=cvs.width, h=cvs.height, pad=24;
  const barW = (w - pad*2) / (vals.length * 1.5);

  labels.forEach((lab,i)=>{
    const x = pad + i*barW*1.5 + barW/2;
    const v = vals[i];
    const bh = (h - pad*2) * (v/max);
    ctx.fillStyle = '#7c3aed'; ctx.fillRect(x, h - pad - bh, barW, bh);
    ctx.fillStyle = '#94a3b8'; ctx.font = '12px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(lab, x+barW/2, h-6);
    if (v>0) { ctx.fillStyle = '#e5e7eb'; ctx.fillText(String(v), x+barW/2, h - pad - bh - 6); }
  });
}

// ---- Badges -----------------------------------------------------------------
function checkBadges(){
  const total=state.completions.length;
  const streak=calcDailyStreak();
  const grant=(code,name)=>{ if(!state.badges.some(b=>b.code===code)) state.badges.push({code,name,earnedAt:new Date().toISOString()}); };
  if(total>=1) grant('first-blood','First Quest');
  if(streak>=7) grant('flame-7','7-day Streak');
  if(streak>=30) grant('flame-30','30-day Streak');
}
function renderBadges(){
  const row=document.getElementById('badges'); if(!row) return;
  row.innerHTML='';
  (state.badges||[]).forEach(b=>{
    const el=document.createElement('div'); el.className='badge'; el.textContent=b.name||b.code; row.append(el);
  });
}

// ---- Render UI --------------------------------------------------------------
function render(){
  const lvl = levelFromXP(state.xp||0);
  $('#level').textContent = `Lv ${lvl}`;
  $('#xp').textContent    = `${state.xp||0} XP`;
  $('#coins').textContent = `${state.coins||0} ⦿`;

  // Enforce order before showing
  enforceHabitOrder();

  // Today list
  const list = document.getElementById('today-list'); if(list){ list.innerHTML='';
    const order = new Map(requiredHabits.map((h,i)=>[h.id,i]));
    state.habits
      .filter(h=>!h.archived)
      .sort((a,b)=>(order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999))
      .forEach(h=>{
        const due = isDue(h);
        const card=document.createElement('div'); card.className='card';
        card.innerHTML = `<div class="title">${h.title}</div>
          <div class="meta">${h.schedule==='daily'?'Daily':'Weekly'} • Diff ${h.difficulty}</div>`;
        const controls=document.createElement('div'); controls.className='habit-controls';

        if(h.type==='minutes'){
          const input=document.createElement('input'); input.type='number'; input.placeholder=`${h.target||30} min`; input.min='1';
          const btn=document.createElement('button'); btn.textContent=due?'Log minutes':'Done'; btn.className='btn '+(due?'good':'warn');
          btn.addEventListener('click',(ev)=>{
            ev.preventDefault(); ev.stopPropagation();
            if(!isDue(h)) { toast('Already completed'); return; }
            const mins = parseInt(input.value||`${h.target||30}`,10);
            const prop = h.target ? Math.min(1, mins/Number(h.target)) : Math.min(1, mins/30);
            completeHabit(h, mins, prop);
          });
          controls.append(input, btn);
        } else {
          const btn=document.createElement('button'); btn.textContent=due?'Complete':'Done'; btn.className='btn '+(due?'good':'warn');
          btn.addEventListener('click',(ev)=>{
            ev.preventDefault(); ev.stopPropagation();
            if(!isDue(h)) { toast('Already completed'); return; }
            completeHabit(h, 1, 1);
          });
          controls.append(btn);
        }
        card.append(controls); list.append(card);
      });
  }

// Progress numbers + chart
const weekStart = localWeekKey(new Date());

// Compute week XP from completions (handles old records without dayKey)
const weekXP = (state.completions || [])
  .map(c => {
    const k = c.dayKey || (c.dateISO ? localDayKey(new Date(c.dateISO)) : null);
    return k && localWeekKey(dateFromKey(k)) === weekStart ? (c.xp || 0) : 0;
  })
  .reduce((s, n) => s + n, 0);

const allXP = state.xp || 0;
const dailyStreak = calcDailyStreak();

const sx = document.getElementById('week-xp'); if (sx) sx.textContent = weekXP;
const ax = document.getElementById('alltime-xp'); if (ax) ax.textContent = allXP;
const ds = document.getElementById('daily-streak'); if (ds) ds.textContent = dailyStreak;

drawWeeklyChart();

// ---- Tabs & forms -----------------------------------------------------------
function wireTabs(){
  document.querySelectorAll('nav.tabbar button').forEach(btn=>{
    if(btn._wired) return; btn._wired = true;
    btn.onclick=()=>{
      document.querySelectorAll('nav.tabbar button').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const view=btn.dataset.view;
      document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
      document.getElementById(`view-${view}`).classList.add('active');
    };
  });
}

function wireForms(){
  const rform=document.getElementById('reward-form');
  if(rform && !rform._wired){
    rform._wired=true;
    rform.addEventListener('submit',(e)=>{
      e.preventDefault();
      const title=document.getElementById('reward-title').value.trim();
      const cost=parseInt(document.getElementById('reward-cost').value,10);
      if(!title||!cost) return;
      state.rewards.push({id:crypto.randomUUID(), title, cost});
      saveLocal(); cloudSave(); render(); rform.reset();
    });
  }
  const syncBtn=document.getElementById('sync-from-cloud');
  const pushBtn=document.getElementById('push-to-cloud');
  const resetBtn=document.getElementById('reset-btn');
  if(syncBtn && !syncBtn._wired){ syncBtn._wired=true; syncBtn.onclick=async()=>{
    const r=await cloudLoad(); if(r){ state=r; ensureRequired(); enforceHabitOrder(); saveLocal(); render(); toast('Synced from cloud'); } else toast('No cloud data');
  }; }
  if(pushBtn && !pushBtn._wired){ pushBtn._wired=true; pushBtn.onclick=()=>{ saveLocal(); cloudSave(); toast('Pushed to cloud'); }; }
  if(resetBtn && !resetBtn._wired){ resetBtn._wired=true; resetBtn.onclick=()=>{
    if(confirm('Reset progress? (habits kept)')){
      state.xp=0; state.coins=0; state.completions=[]; state.history={};
      saveLocal(); cloudSave(); render(); toast('Progress reset');
    }
  }; }
}

// ---- Boot (cloud-first) + MIGRATION to dayKey -------------------------------
(async()=>{
  const remote = await cloudLoad();
  if(remote && Array.isArray(remote.habits) && remote.habits.length){ state = remote; }
  ensureRequired();
  enforceHabitOrder();

  // MIGRATION: add dayKey to old completions + rebuild history strictly by dayKey
  (function migrateAndRebuild(){
    let changed = false;
    const hist = {};
    (state.completions || []).forEach(c=>{
      if(!c.dayKey){ c.dayKey = localDayKey(new Date(c.dateISO)); changed = true; }
      if(!hist[c.dayKey]) hist[c.dayKey] = { xp:0, coins:0 };
      hist[c.dayKey].xp    += c.xp || 0;
      hist[c.dayKey].coins  = (hist[c.dayKey].coins||0) + (c.coins||0);
    });
    state.history = hist;
    if(changed){ saveLocal(); cloudSave(); }
  })();

  saveLocal(); cloudSave(); render();
})();

// ---- Settings: Clear Today (safe, idempotent wiring) -----------------------
(function setupClearToday(){
  function handler(){
    const today = localDayKey(new Date());

    const removed = (state.completions||[]).filter(c =>
      (c.dayKey ? c.dayKey===today : (c.dateISO||'').slice(0,10)===today)
    );
    const xpBack   = removed.reduce((a,c)=>a+(c.xp||0),0);
    const coinBack = removed.reduce((a,c)=>a+(c.coins||0),0);

    state.completions = (state.completions||[]).filter(c =>
      (c.dayKey ? c.dayKey!==today : (c.dateISO||'').slice(0,10)!==today)
    );

    if (!state.history) state.history = {};
    state.history[today] = { xp:0, coins:0 };

    state.xp    = Math.max(0, (state.xp||0) - xpBack);
    state.coins = Math.max(0, (state.coins||0) - coinBack);

    if (!Array.isArray(state.badges)) state.badges = [];
    saveLocal(); cloudSave(); render();
    alert('Cleared today — you can redo your habits now.');
  }

  function attach(){
    const btn = document.getElementById('clear-today-btn');
    if (btn && !btn._wired) {
      btn._wired = true;
      btn.addEventListener('click', ()=> {
        if (!confirm('Clear all completions for today? This cannot be undone.')) return;
        handler();
      });
    }
  }

  if (document.readyState !== 'loading') attach();
  else document.addEventListener('DOMContentLoaded', attach);
})();