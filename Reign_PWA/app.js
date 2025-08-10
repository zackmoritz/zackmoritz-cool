// Reign v1.2.19 — recovered full UI + cloud-first + completion fix
const APP_KEY = 'reign-data-v1';
const CREDS = { userId: 'zack', token: 'test-token-123' };

async function api(path, body){
  const r = await fetch(path, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  if(!r.ok) throw new Error(String(r.status));
  return r.json();
}
async function cloudLoad(){ try{ return await api('/api/load', CREDS); } catch { return null; } }
async function cloudSave(){ try{ await api('/api/save', { ...CREDS, state }); } catch(_){} }

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
  xp: 0, coins: 0, completions: [], history: {},
  habits: requiredHabits.map(h=>({...h})),
  rewards: [
    { id:'r-youtube', title:'1 hour YouTube', cost:50 },
    { id:'r-treat',   title:'Healthy treat',  cost:40 }
  ],
  badges: []
};

let state = loadLocal() || structuredClone(defaultData);

function saveLocal(){ localStorage.setItem(APP_KEY, JSON.stringify(state)); }
function loadLocal(){ try{ const raw=localStorage.getItem(APP_KEY); return raw?JSON.parse(raw):null; }catch{ return null; } }

function ensureRequired(){
  const have = new Set(state.habits.map(h=>h.id));
  requiredHabits.forEach(req=>{ if(!have.has(req.id)) state.habits.push({...req}); });
  state.habits.forEach(h=>{ if(requiredHabits.some(r=>r.id===h.id)) h.archived = false; });
}

const $ = s => document.querySelector(s);
function toast(msg){ const el=$('.toast'); if(!el) return; el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),1200); }

function todayKey(d=new Date()){ return d.toISOString().slice(0,10); }
function weekKey(d=new Date()){ const dt=new Date(d); const day=dt.getUTCDay(); const diff=(day+6)%7; dt.setUTCDate(dt.getUTCDate()-diff); return dt.toISOString().slice(0,10); }

function levelFromXP(xp){ return Math.floor(Math.sqrt(xp/50)) + 1; }
function calcXP({difficulty=1, proportion=1}){ const base=10; const xp=Math.round((base+difficulty*5)*proportion); const coins=Math.max(1, Math.ceil(xp/10)); return {xp, coins}; }

function isDue(h){
  const now = new Date();
  if(h.schedule==='daily')  return !state.completions.some(c=>c.habitId===h.id && c.dateISO.startsWith(todayKey(now)));
  if(h.schedule==='weekly'){ const wk=weekKey(now); return !state.completions.some(c=>c.habitId===h.id && weekKey(new Date(c.dateISO))===wk); }
  return true;
}

function addHistory(xp, coins){
  const k=todayKey(); if(!state.history[k]) state.history[k]={xp:0,coins:0};
  state.history[k].xp += xp; state.history[k].coins = (state.history[k].coins||0) + coins;
}

function completeHabit(h, value, proportion){
  const {xp, coins} = calcXP({difficulty:h.difficulty, proportion});
  state.completions.push({ id:crypto.randomUUID(), habitId:h.id, value, dateISO:new Date().toISOString(), xp, coins });
  state.xp += xp; state.coins += coins;
  addHistory(xp, coins);
  saveLocal(); cloudSave(); render();
}

// ---- Render UI ----
function render(){
  $('#level').textContent = `Lv ${levelFromXP(state.xp)}`;
  $('#xp').textContent    = `${state.xp} XP`;
  $('#coins').textContent = `${state.coins} ⦿`;

  // Today list
  const list = $('#today-list'); list.innerHTML='';
  state.habits.filter(h=>!h.archived).forEach(h=>{
    const due = isDue(h);
    const card = document.createElement('div'); card.className='card';
    card.innerHTML = `<div class="title">${h.title}</div>
      <div class="meta">${h.schedule==='daily'?'Daily':'Weekly'} • Diff ${h.difficulty}</div>`;
    const controls = document.createElement('div'); controls.className='habit-controls';

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
    } else { // check-type
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

  renderProgress(); renderBadges(); wireTabs(); wireForms();
}

function renderProgress(){
  const weekStart=weekKey(new Date()); let weekXP=0, allXP=state.xp;
  Object.entries(state.history).forEach(([k,v])=>{ if(weekKey(new Date(k))===weekStart) weekXP+=v.xp; });
  document.getElementById('week-xp').textContent=weekXP;
  document.getElementById('alltime-xp').textContent=allXP;
  document.getElementById('daily-streak').textContent=calcDailyStreak();
  drawWeeklyChart();
}

function calcDailyStreak(){
  let s=0; const todayD=new Date(todayKey());
  for(let i=0;i<365;i++){
    const d=new Date(todayD); d.setUTCDate(todayD.getUTCDate()-i);
    const k=todayKey(d);
    const did = state.completions.some(c=>{
      const hd = state.habits.find(h=>h.id===c.habitId);
      return hd?.schedule==='daily' && c.dateISO.startsWith(k);
    });
    if(did) s++; else break;
  }
  return s;
}

function drawWeeklyChart(){
  const cvs=document.getElementById('weekly-chart'); const ctx=cvs.getContext('2d');
  ctx.clearRect(0,0,cvs.width,cvs.height);
  const labels=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const start=new Date(weekKey(new Date())); const vals=[];
  for(let i=0;i<7;i++){ const d=new Date(start); d.setUTCDate(start.getUTCDate()+i); const k=todayKey(d); vals.push(state.history[k]?.xp||0); }
  const max=Math.max(10, ...vals); const w=cvs.width, h=cvs.height, pad=24; const barW=(w-pad*2)/(vals.length*1.5);
  labels.forEach((lab,i)=>{
    const x=pad+i*barW*1.5+barW/2; const v=vals[i]; const bh=(h-pad*2)*(v/max);
    ctx.fillStyle='#7c3aed'; ctx.fillRect(x,h-pad-bh,barW,bh);
    ctx.fillStyle='#94a3b8'; ctx.font='12px system-ui'; ctx.textAlign='center'; ctx.fillText(lab, x+barW/2, h-6);
    if(v>0){ ctx.fillStyle='#e5e7eb'; ctx.fillText(String(v), x+barW/2, h-pad-bh-6); }
  });
}

function checkBadges(){
  const total=state.completions.length;
  const streak=calcDailyStreak();
  const grant=(code,name)=>{ if(!state.badges.some(b=>b.code===code)) state.badges.push({code,name,earnedAt:new Date().toISOString()}); };
  if(total>=1) grant('first-blood','First Quest');
  if(streak>=7) grant('flame-7','7-day Streak');
  if(streak>=30) grant('flame-30','30-day Streak');
}
function renderBadges(){
  const row=document.getElementById('badges'); row.innerHTML='';
  (state.badges||[]).forEach(b=>{ const el=document.createElement('div'); el.className='badge'; el.textContent=b.name||b.code; row.append(el); });
}

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
  if(syncBtn && !syncBtn._wired){ syncBtn._wired=true; syncBtn.onclick=async()=>{ const r=await cloudLoad(); if(r){ state=r; ensureRequired(); saveLocal(); render(); toast('Synced from cloud'); } else toast('No cloud data'); }; }
  if(pushBtn && !pushBtn._wired){ pushBtn._wired=true; pushBtn.onclick=()=>{ saveLocal(); cloudSave(); toast('Pushed to cloud'); }; }
  if(resetBtn && !resetBtn._wired){ resetBtn._wired=true; resetBtn.onclick=()=>{ if(confirm('Reset progress? (habits kept)')){ state.xp=0; state.coins=0; state.completions=[]; state.history={}; saveLocal(); cloudSave(); render(); toast('Progress reset'); } }; }
}

// ---- Boot (cloud-first) ----
(async()=>{
  const remote = await cloudLoad();
  if(remote && Array.isArray(remote.habits) && remote.habits.length){ state = remote; }
  ensureRequired();
  saveLocal(); cloudSave(); render();
})();