// Reign v1.2.17 — full UI restored (graph + badges) + cloud-first + completion fixes
const APP_KEY = 'reign-data-v1';

// Cloud creds (same as your Worker/KV)
const CREDS = { userId: 'zack', token: 'test-token-123', registered: false };
async function registerIfNeeded(){ try{ const r = await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(CREDS)}); if(r.ok) CREDS.registered=true; }catch(_){} }
async function cloudSave(state){ try{ await fetch('/api/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...CREDS,state})}); }catch(_){} }
async function cloudLoad(){ try{ const r=await fetch('/api/load',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(CREDS)}); if(r.ok) return await r.json(); }catch(_){} return null; }

// Required habits (your list)
const requiredHabits = [
  { id:'h-read',      title:'Read (100 min/day)',          schedule:'daily',  type:'minutes', target:100, difficulty:2, archived:false },
  { id:'h-audio',     title:'Audiobook (60–120 min/day)',  schedule:'daily',  type:'minutes', target:60,  difficulty:2, archived:false },
  { id:'h-kungfu',    title:'Kung Fu footwork',            schedule:'daily',  type:'check',   target:1,   difficulty:2, archived:false },
  { id:'h-taichi',    title:'Tai Chi (8 min/day)',         schedule:'daily',  type:'minutes', target:8,   difficulty:2, archived:false },
  { id:'h-chastity',  title:'Law of Chastity (daily)',     schedule:'daily',  type:'check',   target:1,   difficulty:3, archived:false },
  { id:'h-run',       title:'Run 5k (weekly)',             schedule:'weekly', type:'check',   target:1,   difficulty:3, archived:false },
  { id:'h-meditate',  title:'Meditate (10 min/day)',       schedule:'daily',  type:'minutes', target:10,  difficulty:2, archived:false },
  { id:'h-earthing',  title:'Earthing (5 min/day)',        schedule:'daily',  type:'minutes', target:5,   difficulty:1, archived:false },
  { id:'h-yoga',      title:'Yoga: 3 poses (daily)',       schedule:'daily',  type:'check',   target:1,   difficulty:2, archived:false },
  { id:'h-workout',   title:'Working out',                 schedule:'daily',  type:'check',   target:1,   difficulty:2, archived:false },
  { id:'h-deepsquat', title:'Deep squat (5 min)',          schedule:'daily',  type:'minutes', target:5,   difficulty:2, archived:false }
];

const defaultData = {
  createdAt: new Date().toISOString(),
  xp: 0, coins: 0,
  completions: [],
  habits: requiredHabits.map(h=>({...h})),
  rewards: [
    { id: 'r-youtube', title: '1 hour YouTube', cost: 50 },
    { id: 'r-treat',   title: 'Healthy treat',  cost: 40 }
  ],
  badges: [], history: {}
};

let state = loadLocal();

// Boot: cloud-first (fallback to local → defaults). Always ensure required habits exist.
(async () => {
  await registerIfNeeded();
  const remote = await cloudLoad();
  if (remote && Array.isArray(remote.habits) && remote.habits.length) {
    state = mergeState(remote);
  } else if (!localStorage.getItem(APP_KEY)) {
    state = structuredClone(defaultData);
  } else {
    state = mergeState(state);
  }
  save(); render();
})();

function mergeState(s){
  const out = {...s};
  if (!Array.isArray(out.habits)) out.habits = [];
  const have = new Set(out.habits.map(h=>h.id));
  requiredHabits.forEach(req => { if (!have.has(req.id)) out.habits.push({...req}); });
  out.habits.forEach(h => { if (requiredHabits.some(r=>r.id===h.id)) h.archived = false; });
  if(!out.rewards) out.rewards = structuredClone(defaultData.rewards);
  if(!out.history) out.history = {};
  if(typeof out.xp!=='number') out.xp=0;
  if(typeof out.coins!=='number') out.coins=0;
  return out;
}

function save(){ localStorage.setItem(APP_KEY, JSON.stringify(state)); cloudSave(state); }
function loadLocal(){ try{ const raw=localStorage.getItem(APP_KEY); return raw?JSON.parse(raw):structuredClone(defaultData); }catch{ return structuredClone(defaultData); } }

// Time helpers (kept UTC like before)
function todayKey(d=new Date()){ return d.toISOString().slice(0,10); }
function weekKey(d=new Date()){ const dt=new Date(d); const day=dt.getUTCDay(); const diff=(day+6)%7; dt.setUTCDate(dt.getUTCDate()-diff); return dt.toISOString().slice(0,10); }

// Game math
function levelFromXP(xp){ return Math.floor(Math.sqrt(xp/50)) + 1; }
function calcXP({difficulty=1, proportion=1}){ const base=10; const xp=Math.round((base+difficulty*5)*proportion); const coins=Math.max(1, Math.ceil(xp/10)); return {xp, coins}; }
function isDue(h){
  const now=new Date();
  if(h.schedule==='daily'){ return !state.completions.some(c=>c.habitId===h.id && c.dateISO.startsWith(todayKey(now))); }
  if(h.schedule==='weekly'){ const wk=weekKey(now); return !state.completions.some(c=>c.habitId===h.id && weekKey(new Date(c.dateISO))===wk); }
  return true;
}
function calcHabitStreak(hid){
  let s=0; const todayD=new Date(todayKey());
  const daily = state.habits.find(h=>h.id===hid)?.schedule==='daily';
  if(daily){
    for(let i=0;i<365;i++){ const d=new Date(todayD); d.setUTCDate(todayD.getUTCDate()-i); const k=todayKey(d);
      const did=state.completions.some(c=>c.habitId===hid && c.dateISO.startsWith(k)); if(did) s++; else break; }
  } else {
    for(let w=0;w<520;w++){ const start=new Date(weekKey(todayD)); start.setUTCDate(start.getUTCDate()-7*w);
      const did=state.completions.some(c=>c.habitId===hid && weekKey(new Date(c.dateISO))===weekKey(start)); if(did) s++; else break; }
  }
  return s;
}

// UI render
function render(){
  document.getElementById('level').textContent=`Lv ${levelFromXP(state.xp)}`;
  document.getElementById('xp').textContent=`${state.xp} XP`;
  document.getElementById('coins').textContent=`${state.coins} ⦿`;

  // Today
  const list=document.getElementById('today-list'); list.innerHTML='';
  state.habits.filter(h=>!h.archived).forEach(h=>{
    const card=document.createElement('div'); card.className='card';
    const due=isDue(h); const hs=calcHabitStreak(h.id);
    card.innerHTML=`<div class="title">${h.title}</div><div class="meta">${h.schedule==='daily'?'Daily':'Weekly'} • Diff ${h.difficulty} • Streak ${hs}${h.schedule==='weekly'?' wk':''}</div>`;
    const controls=document.createElement('div'); controls.className='habit-controls';
    if(h.type==='minutes'){
      const input=document.createElement('input'); input.type='number'; input.placeholder=`${h.target||30} min`; input.min='1';
      const btn=document.createElement('button'); btn.textContent=due?'Log minutes':'Done'; btn.className='btn '+(due?'good':'warn');
      btn.onclick=()=>{ if(!due) return toast('Already completed'); const mins=parseInt(input.value||`${h.target||30}`,10);
        const prop=h.target?Math.min(1,mins/Number(h.target)):Math.min(1,mins/30);
        completeHabit(h, mins, prop);
      };
      controls.append(input, btn);
    } else {
      const btn=document.createElement('button'); btn.textContent=due?'Complete':'Done'; btn.className='btn '+(due?'good':'warn');
      btn.onclick=()=>{ if(!due) return toast('Already completed'); completeHabit(h,1,1); };
      controls.append(btn);
    }
    card.append(controls); list.append(card);
  });

  // Rewards
  const rlist=document.getElementById('rewards-list'); rlist.innerHTML='';
  state.rewards.forEach(r=>{
    const card=document.createElement('div'); card.className='card';
    card.innerHTML=`<div class="title">${r.title}</div><div class="meta">${r.cost} ⦿</div>`;
    const btn=document.createElement('button'); btn.textContent='Redeem'; btn.className='btn';
    btn.onclick=()=>{ if(state.coins<r.cost) return toast('Not enough coins');
      state.coins-=r.cost; addHistory(0,-r.cost); save(); render(); toast('Enjoy!'); };
    card.append(btn); rlist.append(card);
  });

  renderProgress(); renderBadges(); wireTabs();
}

function completeHabit(h, value, proportion){
  const {xp, coins}=calcXP({difficulty:h.difficulty, proportion});
  const rec={id:crypto.randomUUID(), habitId:h.id, value, dateISO:new Date().toISOString(), xp, coins};
  state.completions.push(rec); state.xp+=xp; state.coins+=coins; addHistory(xp, coins); checkBadges(); save(); render();
}
function addHistory(xp, coins){ const k=todayKey(); if(!state.history[k]) state.history[k]={xp:0,coins:0}; state.history[k].xp+=xp; state.history[k].coins=(state.history[k].coins||0)+coins; }

function renderProgress(){
  const weekStart=weekKey(new Date()); let weekXP=0, allXP=state.xp;
  Object.entries(state.history).forEach(([k,v])=>{ if(weekKey(new Date(k))===weekStart) weekXP+=v.xp; });
  document.getElementById('week-xp').textContent=weekXP; document.getElementById('alltime-xp').textContent=allXP;
  document.getElementById('daily-streak').textContent=calcDailyStreak(); drawWeeklyChart();
}
function calcDailyStreak(){
  let s=0; const todayD=new Date(todayKey());
  for(let i=0;i<365;i++){
    const d=new Date(todayD); d.setUTCDate(todayD.getUTCDate()-i);
    const k=todayKey(d);
    const did=state.completions.some(c=>{
      const hd=state.habits.find(h=>h.id===c.habitId);
      return hd?.schedule==='daily' && c.dateISO.startsWith(k);
    });
    if(did) s++; else break;
  }
  return s;
}
function drawWeeklyChart(){
  const cvs=document.getElementById('weekly-chart'); const ctx=cvs.getContext('2d'); ctx.clearRect(0,0,cvs.width,cvs.height);
  const labels=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const start=new Date(weekKey(new Date()));
  const vals=[];
  for(let i=0;i<7;i++){ const d=new Date(start); d.setUTCDate(start.getUTCDate()+i); const k=todayKey(d); vals.push(state.history[k]?.xp||0); }
  const max=Math.max(10, ...vals); const w=cvs.width, h=cvs.height, pad=24; const barW=(w-pad*2)/(vals.length*1.5);
  labels.forEach((lab,i)=>{
    const x=pad+i*barW*1.5+barW/2;
    const v=vals[i];
    const bh=(h-pad*2)*(v/max);
    ctx.fillStyle='#7c3aed'; ctx.fillRect(x,h-pad-bh,barW,bh);
    ctx.fillStyle='#94a3b8'; ctx.font='12px system-ui'; ctx.textAlign='center'; ctx.fillText(lab, x+barW/2, h-6);
    if(v>0){ ctx.fillStyle='#e5e7eb'; ctx.fillText(String(v), x+barW/2, h-pad-bh-6); }
  });
}
function checkBadges(){
  const total=state.completions.length;
  const streak=calcDailyStreak();
  const grant=(code,name)=>{ if(!state.badges.some(b=>b.code===code)){ state.badges.push({code,name,earnedAt:new Date().toISOString()}); } };
  if(total>=1) grant('first-blood','First Quest');
  if(total>=25) grant('grinder','25 Completions');
  if(streak>=7) grant('flame-7','7-day Streak');
  if(streak>=30) grant('flame-30','30-day Streak');
}
function renderBadges(){
  const row=document.getElementById('badges'); row.innerHTML='';
  (state.badges||[]).forEach(b=>{
    const el=document.createElement('div'); el.className='badge'; el.textContent=b.name||b.code; row.append(el);
  });
}

// Tabs
function wireTabs(){
  document.querySelectorAll('nav.tabbar button').forEach(btn=>{
    btn.onclick=()=>{
      document.querySelectorAll('nav.tabbar button').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const view=btn.dataset.view;
      document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
      document.getElementById(`view-${view}`).classList.add('active');
    };
  });
}

// Utility toast
function toast(msg){
  const el=document.querySelector('.toast'); if(!el) return;
  el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'), 1200);
}

// Admin + forms
document.getElementById('reward-form').addEventListener('submit', (e)=>{
  e.preventDefault();
  const title=document.getElementById('reward-title').value.trim();
  const cost=parseInt(document.getElementById('reward-cost').value,10);
  if(!title||!cost) return;
  state.rewards.push({id:crypto.randomUUID(), title, cost});
  save(); render(); e.target.reset();
});
document.getElementById('habit-form').addEventListener('submit',(e)=>{
  e.preventDefault();
  const title=document.getElementById('habit-title').value.trim();
  const schedule=document.getElementById('habit-schedule').value;
  const type=document.getElementById('habit-type').value;
  const targetRaw=document.getElementById('habit-target').value;
  const target=targetRaw?parseInt(targetRaw,10):null;
  const difficulty=parseInt(document.getElementById('habit-difficulty').value||'2',10);
  if(!title) return;
  state.habits.push({id:crypto.randomUUID(), title, schedule, type, target, difficulty, archived:false});
  save(); render(); e.target.reset();
});
document.getElementById('restore-defaults').addEventListener('click', ()=>{ state.habits=requiredHabits.map(h=>({...h})); save(); render(); });

document.getElementById('sync-from-cloud').addEventListener('click', async()=>{ const r=await cloudLoad(); if(r){ state=mergeState(r); save(); render(); toast('Synced from cloud'); } else toast('No cloud data'); });
document.getElementById('push-to-cloud').addEventListener('click', ()=>{ save(); toast('Pushed to cloud'); });

if('serviceWorker' in navigator){ window.addEventListener('load', ()=>{ navigator.serviceWorker.register('sw.js'); }); }