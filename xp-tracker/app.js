const DEFAULT_SKILLS = ["Reading", "Meditation", "Workout"];
const STORAGE_KEY = "xp-tracker-state-v1";
const MAX_LEVEL = 120;

const skillGrid = document.querySelector(".skill-grid");
const skillSelector = document.getElementById("skillSelector");
const logSkill = document.getElementById("logSkill");
const logAmount = document.getElementById("logAmount");
const logNote = document.getElementById("logNote");
const logForm = document.getElementById("logForm");
const activityFeed = document.getElementById("activityFeed");
const chartInsight = document.getElementById("chartInsight");
const chartEmptyNotice = document.getElementById("chartEmptyNotice");
const installButton = document.getElementById("installButton");

const xpTable = buildXpTable(MAX_LEVEL + 1);
let chartInstance;
let currentChartSkill = DEFAULT_SKILLS[0];
let deferredPrompt;

const state = loadState();
renderSkillOptions();
renderSkillCards();
renderActivityFeed();
initializeChart();
updateChart(skillSelector.value);
updateChartInsight(skillSelector.value);
setupFormHandling();
setupInstallPrompt();

function buildXpTable(maxLevel) {
  const table = [0];
  let points = 0;
  table[1] = 0;
  for (let level = 1; level < maxLevel; level += 1) {
    points += Math.floor(level + 300 * Math.pow(2, level / 7));
    table[level + 1] = Math.floor(points / 4);
  }
  return table;
}

function xpForLevel(level) {
  if (level <= 1) return 0;
  const cappedLevel = Math.min(level, xpTable.length - 1);
  return xpTable[cappedLevel];
}

function levelForXp(xp) {
  for (let level = 1; level <= MAX_LEVEL; level += 1) {
    if (xp < xpForLevel(level + 1)) {
      return level;
    }
  }
  return MAX_LEVEL;
}

function xpToNextLevel(xp) {
  const level = Math.min(levelForXp(xp), MAX_LEVEL);
  const nextXp = xpForLevel(level + 1);
  if (level >= MAX_LEVEL && nextXp === xpForLevel(level)) {
    return 0;
  }
  return Math.max(nextXp - xp, 0);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const merged = ensureDefaultSkills(parsed);
      saveState(merged);
      return merged;
    }
  } catch (error) {
    console.warn("Failed to read tracker state", error);
  }

  const initial = {
    skills: Object.fromEntries(
      DEFAULT_SKILLS.map((skill) => [
        skill,
        {
          xp: 0,
          history: [
            createHistoryEntry({
              skill,
              xpAfter: 0,
              delta: 0,
              levelBefore: 1,
              levelAfter: 1,
              note: "",
              timestamp: Date.now()
            })
          ]
        }
      ])
    )
  };
  saveState(initial);
  return initial;
}

function ensureDefaultSkills(stateObj) {
  const clone = JSON.parse(JSON.stringify(stateObj || {}));
  clone.skills = clone.skills || {};

  Object.entries(clone.skills).forEach(([skillName, value]) => {
    const xpValue = Number(value?.xp ?? 0);
    clone.skills[skillName].xp = xpValue;
    if (!Array.isArray(value.history) || value.history.length === 0) {
      clone.skills[skillName].history = [
        createHistoryEntry({
          skill: skillName,
          xpAfter: xpValue,
          delta: 0,
          levelBefore: levelForXp(xpValue),
          levelAfter: levelForXp(xpValue),
          note: "",
          timestamp: Date.now()
        })
      ];
    }
  });

  DEFAULT_SKILLS.forEach((skill) => {
    if (!clone.skills[skill]) {
      clone.skills[skill] = {
        xp: 0,
        history: [
          createHistoryEntry({
            skill,
            xpAfter: 0,
            delta: 0,
            levelBefore: 1,
            levelAfter: 1,
            note: "",
            timestamp: Date.now()
          })
        ]
      };
    }
  });

  return clone;
}

function saveState(nextState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

function createHistoryEntry({ skill, xpAfter, delta, levelBefore, levelAfter, note, timestamp }) {
  return { skill, xpAfter, delta, levelBefore, levelAfter, note, timestamp };
}

function renderSkillOptions() {
  const options = Object.keys(state.skills).map((skill) => {
    const option = document.createElement("option");
    option.value = skill;
    option.textContent = skill;
    return option;
  });

  skillSelector.replaceChildren(...options.map((opt) => opt.cloneNode(true)));
  logSkill.replaceChildren(...options);
  skillSelector.value = skillSelector.value || DEFAULT_SKILLS[0];
  logSkill.value = logSkill.value || DEFAULT_SKILLS[0];

  skillSelector.addEventListener("change", (event) => {
    const skill = event.target.value;
    updateChart(skill);
    updateChartInsight(skill);
  });
}

function renderSkillCards() {
  skillGrid.innerHTML = "";
  Object.entries(state.skills).forEach(([skill, data]) => {
    const card = document.createElement("article");
    card.className = "skill-card";

    const level = levelForXp(data.xp);
    const currentLevelXp = xpForLevel(level);
    const nextLevelXp = xpForLevel(level + 1);
    const remaining = xpToNextLevel(data.xp);
    const xpSpan = nextLevelXp - currentLevelXp || 1;
    const progress = ((data.xp - currentLevelXp) / xpSpan) * 100;

    card.innerHTML = `
      <h3>${skill}</h3>
      <div class="skill-metadata">
        <span>Total XP</span>
        <span>${data.xp.toLocaleString()}</span>
      </div>
      <p class="level-display">Lvl ${level}</p>
      <div class="xp-progress" role="progressbar" aria-label="${skill} XP progress" aria-valuemin="0"
           aria-valuemax="${xpSpan}" aria-valuenow="${Math.max(data.xp - currentLevelXp, 0)}">
        <div class="xp-progress__bar" style="width: ${Math.min(progress, 100).toFixed(1)}%"></div>
      </div>
      <div class="next-level">
        <span>${remaining.toLocaleString()} XP to next level</span>
        <span>Lvl ${Math.min(level + 1, MAX_LEVEL)}</span>
      </div>
    `;

    skillGrid.appendChild(card);
  });
}

function setupFormHandling() {
  logForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const skill = logSkill.value;
    const amount = Number.parseInt(logAmount.value, 10);
    if (!skill || Number.isNaN(amount) || amount <= 0) {
      return;
    }
    const note = logNote.value.trim();
    addXp(skill, amount, note);
    logForm.reset();
    logSkill.value = skill;
  });
}

function addXp(skill, amount, note) {
  const skillData = state.skills[skill];
  if (!skillData) {
    return;
  }

  const beforeXp = skillData.xp;
  const levelBefore = levelForXp(beforeXp);
  skillData.xp += amount;
  const levelAfter = levelForXp(skillData.xp);
  const entry = createHistoryEntry({
    skill,
    xpAfter: skillData.xp,
    delta: amount,
    levelBefore,
    levelAfter,
    note,
    timestamp: Date.now()
  });

  skillData.history.push(entry);
  saveState(state);
  renderSkillCards();
  renderActivityFeed();
  skillSelector.value = skill;
  updateChart(skill);
  updateChartInsight(skill);
  if (chartEmptyNotice) {
    chartEmptyNotice.hidden = false;
  }
}

function renderActivityFeed() {
  const entries = Object.values(state.skills)
    .flatMap((skill) => skill.history)
    .filter((entry) => entry.delta > 0)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10);

  if (entries.length === 0) {
    activityFeed.innerHTML = "<li class=\"activity-item\">No activity yet. Log some XP to begin your journey!</li>";
    return;
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });

  activityFeed.innerHTML = "";
  entries.forEach((entry) => {
    const item = document.createElement("li");
    item.className = "activity-item";
    const leveledUp = entry.levelAfter > entry.levelBefore;
    item.innerHTML = `
      <div class="activity-item__header">
        <span>${entry.skill}</span>
        <span>+${entry.delta.toLocaleString()} XP</span>
      </div>
      <div class="activity-item__details">
        <span>${formatter.format(entry.timestamp)}</span>
        <span>${entry.xpAfter.toLocaleString()} XP total${leveledUp ? ` • Lvl ${entry.levelAfter}` : ""}</span>
      </div>
      ${entry.note ? `<p class="activity-item__note">${entry.note}</p>` : ""}
    `;
    activityFeed.appendChild(item);
  });
}

const chartDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric"
});

function initializeChart() {
  const canvas = document.getElementById("xpChart");
  if (!(canvas instanceof HTMLCanvasElement)) {
    chartInsight.textContent = "Chart canvas is unavailable.";
    if (chartEmptyNotice) {
      chartEmptyNotice.hidden = false;
      chartEmptyNotice.textContent = "Your browser cannot display the progression chart.";
    }
    chartInstance = null;
    return;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    chartInsight.textContent = "Unable to initialize the XP chart context.";
    if (chartEmptyNotice) {
      chartEmptyNotice.hidden = false;
      chartEmptyNotice.textContent = "Your browser does not support canvas drawing.";
    }
    chartInstance = null;
    return;
  }

  chartInstance = { canvas, ctx };

  if (window.ResizeObserver) {
    const observer = new ResizeObserver(() => updateChart(currentChartSkill));
    observer.observe(canvas);
    chartInstance.resizeObserver = observer;
  } else {
    const handler = () => updateChart(currentChartSkill);
    window.addEventListener("resize", handler);
    chartInstance.resizeHandler = handler;
  }
}

function updateChart(skill) {
  currentChartSkill = skill;
  if (!chartInstance?.ctx) {
    return;
  }

  const history = state.skills[skill]?.history ?? [];
  const hasGains = history.some((entry) => entry.delta > 0);

  if (chartEmptyNotice) {
    if (history.length === 0 || !hasGains) {
      chartEmptyNotice.hidden = false;
      chartEmptyNotice.textContent =
        history.length === 0 || history.every((entry) => entry.xpAfter === 0)
          ? `Log some XP in ${skill} to start charting your journey.`
          : `Keep logging XP in ${skill} to reveal more of your progression.`;
    } else {
      chartEmptyNotice.hidden = true;
    }
  }

  const sortedHistory = [...history].sort((a, b) => a.timestamp - b.timestamp);
  if (sortedHistory.length === 0) {
    clearChartArea();
    return;
  }

  drawXpChart(sortedHistory, skill);
}

function clearChartArea() {
  if (!chartInstance?.ctx) {
    return;
  }
  const { canvas, ctx } = chartInstance;
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || canvas.width || 400;
  const height = canvas.clientHeight || canvas.height || 260;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
}

function drawXpChart(sortedHistory, skill) {
  const { canvas, ctx } = chartInstance;
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || canvas.width || 400;
  const height = canvas.clientHeight || canvas.height || 260;
  const scaledWidth = Math.round(width * dpr);
  const scaledHeight = Math.round(height * dpr);
  if (canvas.width !== scaledWidth || canvas.height !== scaledHeight) {
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const padding = { top: 32, right: 28, bottom: 44, left: 60 };
  const plotWidth = Math.max(width - padding.left - padding.right, 10);
  const plotHeight = Math.max(height - padding.top - padding.bottom, 10);
  const baseY = height - padding.bottom;

  const xpValues = sortedHistory.map((entry) => entry.xpAfter);
  const lastEntry = sortedHistory[sortedHistory.length - 1];
  const lastXp = lastEntry.xpAfter;
  const currentLevel = levelForXp(lastXp);
  const nextLevelXp = currentLevel >= MAX_LEVEL ? lastXp : xpForLevel(currentLevel + 1);
  const targetMax = Math.max(nextLevelXp, lastXp, 100);
  const yTicks = createTickMarks(targetMax * 1.08);
  const chartMax = yTicks[yTicks.length - 1] || targetMax || 1;

  const gradient = ctx.createLinearGradient(0, padding.top, 0, baseY);
  gradient.addColorStop(0, "rgba(26, 33, 72, 0.45)");
  gradient.addColorStop(1, "rgba(12, 16, 36, 0.85)");
  ctx.fillStyle = gradient;
  ctx.fillRect(padding.left, padding.top, plotWidth, plotHeight);

  drawGridLines(ctx, padding, width, height, plotWidth, plotHeight, yTicks, sortedHistory, chartMax);

  const getX = (index) => {
    if (sortedHistory.length === 1) {
      return padding.left + plotWidth / 2;
    }
    return padding.left + (plotWidth * index) / (sortedHistory.length - 1);
  };

  const getY = (xp) => {
    if (chartMax === 0) {
      return baseY;
    }
    const clamped = Math.min(Math.max(xp, 0), chartMax);
    const ratio = clamped / chartMax;
    return baseY - ratio * plotHeight;
  };

  drawSeriesArea(ctx, sortedHistory, getX, getY, baseY);
  drawSeriesLine(ctx, sortedHistory, getX, getY);
  drawSeriesPoints(ctx, sortedHistory, getX, getY);
  drawNextLevelGuide(ctx, padding, width, getY, nextLevelXp, lastXp, skill);
}

function drawGridLines(ctx, padding, width, height, plotWidth, plotHeight, yTicks, sortedHistory, chartMax) {
  const baseY = height - padding.bottom;
  ctx.save();
  ctx.lineWidth = 1;
  ctx.font = "12px/1.4 'Inter', system-ui, sans-serif";

  yTicks.forEach((value) => {
    const y = baseY - (Math.min(value, chartMax) / chartMax) * plotHeight;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();

    ctx.fillStyle = "rgba(198, 206, 255, 0.75)";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`${formatNumber(value)} XP`, padding.left - 10, y);
  });

  const xTickIndexes = selectXTickIndexes(sortedHistory.length);
  xTickIndexes.forEach((index) => {
    const x =
      sortedHistory.length === 1
        ? padding.left + plotWidth / 2
        : padding.left + (plotWidth * index) / (sortedHistory.length - 1);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, baseY);
    ctx.stroke();

    ctx.fillStyle = "rgba(198, 206, 255, 0.75)";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(chartDateFormatter.format(sortedHistory[index].timestamp), x, baseY + 8);
  });

  ctx.restore();

  ctx.beginPath();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, baseY);
  ctx.lineTo(width - padding.right, baseY);
  ctx.stroke();
}

function drawSeriesArea(ctx, sortedHistory, getX, getY, baseY) {
  if (sortedHistory.length === 0) {
    return;
  }
  ctx.save();
  ctx.fillStyle = "rgba(248, 193, 42, 0.16)";
  ctx.beginPath();
  const startX = getX(0);
  ctx.moveTo(startX, baseY);
  ctx.lineTo(startX, getY(sortedHistory[0].xpAfter));
  for (let i = 1; i < sortedHistory.length; i += 1) {
    ctx.lineTo(getX(i), getY(sortedHistory[i - 1].xpAfter));
    ctx.lineTo(getX(i), getY(sortedHistory[i].xpAfter));
  }
  const endX = getX(sortedHistory.length - 1);
  ctx.lineTo(endX, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawSeriesLine(ctx, sortedHistory, getX, getY) {
  if (sortedHistory.length === 0) {
    return;
  }
  ctx.save();
  ctx.strokeStyle = "rgba(248, 193, 42, 0.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(getX(0), getY(sortedHistory[0].xpAfter));
  for (let i = 1; i < sortedHistory.length; i += 1) {
    ctx.lineTo(getX(i), getY(sortedHistory[i - 1].xpAfter));
    ctx.lineTo(getX(i), getY(sortedHistory[i].xpAfter));
  }
  ctx.stroke();
  ctx.restore();
}

function drawSeriesPoints(ctx, sortedHistory, getX, getY) {
  if (sortedHistory.length === 0) {
    return;
  }
  const lastIndex = sortedHistory.length - 1;
  sortedHistory.forEach((entry, index) => {
    const radius = index === lastIndex && entry.delta > 0 ? 6 : 3.5;
    const x = getX(index);
    const y = getY(entry.xpAfter);
    ctx.save();
    ctx.fillStyle = index === lastIndex && entry.delta > 0 ? "rgba(248, 193, 42, 1)" : "rgba(248, 193, 42, 0.55)";
    ctx.strokeStyle = "rgba(17, 23, 46, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });
}

function drawNextLevelGuide(ctx, padding, width, getY, nextLevelXp, lastXp, skill) {
  if (nextLevelXp <= lastXp) {
    return;
  }
  const guideY = getY(nextLevelXp);
  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = "rgba(96, 165, 250, 0.7)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padding.left, guideY);
  ctx.lineTo(width - padding.right, guideY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "rgba(148, 184, 255, 0.9)";
  ctx.font = "12px/1.4 'Inter', system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  const textY = Math.max(guideY - 6, padding.top + 12);
  const label = `${skill} next level: ${nextLevelXp.toLocaleString()} XP`;
  ctx.fillText(label, padding.left + 8, textY);
  ctx.restore();
}

function createTickMarks(maxValue) {
  const safeMax = Math.max(maxValue, 1);
  const targetTicks = 5;
  const rawStep = safeMax / targetTicks;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  let step;
  if (normalized <= 1) step = 1 * magnitude;
  else if (normalized <= 2) step = 2 * magnitude;
  else if (normalized <= 5) step = 5 * magnitude;
  else step = 10 * magnitude;

  const ticks = [];
  for (let value = 0; value <= safeMax + step; value += step) {
    ticks.push(Math.round(value));
  }
  if (!ticks.includes(Math.round(safeMax))) {
    ticks.push(Math.round(safeMax));
  }
  return [...new Set(ticks)].sort((a, b) => a - b);
}

function selectXTickIndexes(length) {
  if (length <= 1) {
    return [0];
  }
  const ticks = new Set([0, length - 1]);
  const segments = Math.min(3, length - 1);
  for (let i = 1; i < segments; i += 1) {
    ticks.add(Math.round((i * (length - 1)) / segments));
  }
  return [...ticks].sort((a, b) => a - b);
}

function formatNumber(value) {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return `${Math.round(value)}`;
}

function updateChartInsight(skill) {
  const data = state.skills[skill];
  if (!data) {
    chartInsight.textContent = "";
    return;
  }

  const level = levelForXp(data.xp);
  const remaining = xpToNextLevel(data.xp);
  const levelBaseXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const gainedThisLevel = data.xp - levelBaseXp;
  const span = nextLevelXp - levelBaseXp || 1;
  const progressPercent = Math.floor((gainedThisLevel / span) * 100);

  const lastEntry = [...data.history].reverse().find((entry) => entry.delta > 0);
  const lastNote = lastEntry?.note ? `Last session: ${lastEntry.note}.` : "";
  const pace = computeSevenDayGain(skill);

  chartInsight.textContent = `${skill} is level ${level} with ${data.xp.toLocaleString()} XP. ${remaining.toLocaleString()} XP left for the next level (${progressPercent}% complete). ${pace}${lastNote ? ` ${lastNote}` : ""}`;
}

function computeSevenDayGain(skill) {
  const history = state.skills[skill]?.history ?? [];
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = history.filter((entry) => entry.timestamp >= cutoff);
  const gain = recent.reduce((total, entry) => total + entry.delta, 0);
  if (gain === 0) {
    return "Log some XP to set your 7-day pace.";
  }
  const daily = Math.round(gain / 7);
  return `You gained ${gain.toLocaleString()} XP in the last 7 days (~${daily.toLocaleString()} XP/day).`;
}

function setupInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    installButton.hidden = false;
  });

  installButton?.addEventListener("click", async () => {
    if (!deferredPrompt) {
      return;
    }
    installButton.disabled = true;
    try {
      await deferredPrompt.prompt();
    } finally {
      deferredPrompt = null;
      installButton.hidden = true;
      installButton.disabled = false;
    }
  });
}
