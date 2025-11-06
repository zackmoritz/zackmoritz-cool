const DEFAULT_SKILLS = ["Reading", "Meditation", "Workout"];
const STORAGE_KEY = "xp-tracker-state-v2";
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
const storageWarning = document.getElementById("storageWarning");
const chartCanvas = document.getElementById("xpChart");

const xpTable = buildXpTable(MAX_LEVEL + 1);
const chartDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric"
});

let deferredPrompt = null;

class StorageManager {
  constructor(key, { onUnavailable, onRestored } = {}) {
    this.key = key;
    this.onUnavailable = onUnavailable;
    this.onRestored = onRestored;
    this.memoryFallback = null;
    this.storageHealthy = true;
  }

  load(initializer) {
    try {
      const raw = window.localStorage.getItem(this.key);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.memoryFallback = deepClone(parsed);
        this.storageHealthy = true;
        this.onRestored?.();
        return parsed;
      }
      const initialized = initializer();
      this.save(initialized);
      return initialized;
    } catch (error) {
      console.warn("Storage unavailable, switching to in-memory state", error);
      this.storageHealthy = false;
      this.onUnavailable?.();
      if (this.memoryFallback) {
        return deepClone(this.memoryFallback);
      }
      const fallback = initializer();
      this.memoryFallback = deepClone(fallback);
      return fallback;
    }
  }

  save(state) {
    this.memoryFallback = deepClone(state);
    try {
      window.localStorage.setItem(this.key, JSON.stringify(state));
      this.storageHealthy = true;
      this.onRestored?.();
      return true;
    } catch (error) {
      console.warn("Storage save failed, preserving progress in memory", error);
      this.storageHealthy = false;
      this.onUnavailable?.();
      return false;
    }
  }
}

class SkillTracker {
  constructor(defaultSkills, storage) {
    this.storage = storage;
    this.defaultSkills = [...defaultSkills];
    this.state = this.storage.load(() => this.createInitialState());
    const mutated = this.normalizeState();
    if (mutated) {
      this.persist();
    }
  }

  createInitialState() {
    const now = Date.now();
    const skills = {};
    this.defaultSkills.forEach((skill) => {
      skills[skill] = this.createSkillBucket({
        xp: 0,
        history: [this.createHistoryEntry({ skill, xpAfter: 0, delta: 0, level: 1, note: "", timestamp: now })]
      });
    });
    return { skills };
  }

  createSkillBucket({ xp, history }) {
    return {
      xp: Number(xp) || 0,
      history: Array.isArray(history) ? history : []
    };
  }

  createHistoryEntry({ skill, xpAfter, delta, level, levelBefore, levelAfter, note, timestamp }) {
    const safeTimestamp = typeof timestamp === "number" ? timestamp : Date.parse(timestamp) || Date.now();
    const safeXp = Math.max(0, Number(xpAfter) || 0);
    const safeDelta = Number(delta) || 0;
    const beforeLevel = levelBefore || level || levelForXp(Math.max(0, safeXp - safeDelta));
    const afterLevel = levelAfter || level || levelForXp(safeXp);
    return {
      skill,
      xpAfter: safeXp,
      delta: safeDelta,
      levelBefore: beforeLevel,
      levelAfter: afterLevel,
      note: typeof note === "string" ? note : "",
      timestamp: safeTimestamp
    };
  }

  normalizeState() {
    if (!this.state || typeof this.state !== "object") {
      this.state = this.createInitialState();
      return true;
    }

    let mutated = false;
    const skills = this.state.skills || {};

    Object.entries(skills).forEach(([skill, data]) => {
      if (!data || typeof data !== "object") {
        skills[skill] = this.createSkillBucket({ xp: 0, history: [] });
        mutated = true;
      }
      skills[skill].xp = Number(data?.xp) || 0;
      let history = Array.isArray(data?.history) ? data.history : [];
      history = history
        .map((entry) => this.createHistoryEntry({ ...entry, skill }))
        .sort((a, b) => a.timestamp - b.timestamp);
      if (history.length === 0) {
        history.push(
          this.createHistoryEntry({
            skill,
            xpAfter: skills[skill].xp,
            delta: 0,
            level: levelForXp(skills[skill].xp),
            note: "",
            timestamp: Date.now()
          })
        );
        mutated = true;
      }
      const first = history[0];
      if (first.delta > 0) {
        const baselineXp = Math.max(0, first.xpAfter - first.delta);
        history.unshift(
          this.createHistoryEntry({
            skill,
            xpAfter: baselineXp,
            delta: 0,
            level: first.levelBefore,
            note: "",
            timestamp: first.timestamp - 1
          })
        );
        mutated = true;
      }
      skills[skill].history = history;
      const latestXp = history[history.length - 1]?.xpAfter ?? 0;
      if (skills[skill].xp !== latestXp) {
        skills[skill].xp = latestXp;
        mutated = true;
      }
    });

    this.defaultSkills.forEach((skill) => {
      if (!skills[skill]) {
        skills[skill] = this.createSkillBucket({
          xp: 0,
          history: [
            this.createHistoryEntry({
              skill,
              xpAfter: 0,
              delta: 0,
              level: 1,
              note: "",
              timestamp: Date.now()
            })
          ]
        });
        mutated = true;
      }
    });

    this.state.skills = skills;
    return mutated;
  }

  persist() {
    this.storage.save(this.state);
  }

  getSkillNames() {
    return Object.keys(this.state.skills).sort((a, b) => a.localeCompare(b));
  }

  getSkillData(skill) {
    return this.state.skills[skill];
  }

  getSkillSummary(skill) {
    const data = this.getSkillData(skill);
    if (!data) return null;
    const xp = Number(data.xp) || 0;
    const level = levelForXp(xp);
    const nextLevel = Math.min(level + 1, MAX_LEVEL);
    const currentLevelXp = xpForLevel(level);
    const nextLevelXp = xpForLevel(nextLevel);
    const span = Math.max(nextLevelXp - currentLevelXp, 1);
    const gainedThisLevel = xp - currentLevelXp;
    return {
      skill,
      xp,
      level,
      currentLevelXp,
      nextLevel,
      nextLevelXp,
      xpIntoLevel: gainedThisLevel,
      xpToNext: Math.max(nextLevelXp - xp, 0),
      progressPercent: Math.min(Math.round((gainedThisLevel / span) * 100), 100)
    };
  }

  getHistory(skill) {
    const data = this.getSkillData(skill);
    if (!data) return [];
    return data.history
      .map((entry) => ({ ...entry }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  getChartHistory(skill) {
    return this.getHistory(skill);
  }

  hasProgress(skill) {
    return this.getHistory(skill).some((entry) => entry.delta > 0);
  }

  addXp(skill, amount, note) {
    const numericAmount = Number(amount);
    if (!skill || Number.isNaN(numericAmount) || numericAmount <= 0) {
      return null;
    }
    const skillData = this.getSkillData(skill);
    if (!skillData) {
      return null;
    }
    const beforeXp = Number(skillData.xp) || 0;
    const levelBefore = levelForXp(beforeXp);
    const newXp = beforeXp + numericAmount;
    const levelAfter = levelForXp(newXp);
    const entry = this.createHistoryEntry({
      skill,
      xpAfter: newXp,
      delta: numericAmount,
      levelBefore,
      levelAfter,
      note,
      timestamp: Date.now()
    });
    skillData.xp = newXp;
    skillData.history.push(entry);
    this.persist();
    return entry;
  }

  getRecentActivity(limit = 10) {
    const entries = Object.values(this.state.skills || {})
      .flatMap((skill) => skill.history)
      .filter((entry) => entry.delta > 0)
      .sort((a, b) => b.timestamp - a.timestamp);
    return entries.slice(0, limit).map((entry) => ({ ...entry }));
  }

  getLastGain(skill) {
    const history = [...this.getHistory(skill)].reverse();
    return history.find((entry) => entry.delta > 0) || null;
  }

  getSevenDayGain(skill) {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const history = this.getHistory(skill);
    const recent = history.filter((entry) => entry.delta > 0 && entry.timestamp >= cutoff);
    const total = recent.reduce((sum, entry) => sum + entry.delta, 0);
    return {
      total,
      daily: total > 0 ? Math.round(total / 7) : 0
    };
  }
}

class ChartRenderer {
  constructor(canvas, emptyNotice) {
    this.canvas = canvas instanceof HTMLCanvasElement ? canvas : null;
    this.emptyNotice = emptyNotice || null;
    this.ctx = this.canvas ? this.canvas.getContext("2d") : null;
    this.history = [];
    this.skillName = "";
    this.chartContext = null;

    if (!this.ctx && this.emptyNotice) {
      this.emptyNotice.hidden = false;
      this.emptyNotice.textContent = "Your browser cannot display the progression chart.";
    }

    if (this.canvas && this.ctx) {
      this.handleResize = this.handleResize.bind(this);
      if (window.ResizeObserver) {
        this.resizeObserver = new ResizeObserver(() => this.redraw());
        this.resizeObserver.observe(this.canvas);
      } else {
        window.addEventListener("resize", this.handleResize);
      }
    }
  }

  update(history, skillName, chartContext) {
    if (!this.ctx) {
      return;
    }
    this.history = Array.isArray(history) ? history : [];
    this.skillName = skillName;
    this.chartContext = chartContext;

    const hasGains = this.history.some((entry) => entry.delta > 0);
    if (!hasGains) {
      this.clear();
      if (this.emptyNotice) {
        this.emptyNotice.hidden = false;
        this.emptyNotice.textContent = `Log some XP in ${skillName} to start charting your journey.`;
      }
      return;
    }

    if (this.emptyNotice) {
      this.emptyNotice.hidden = true;
    }

    this.draw();
  }

  redraw() {
    if (!this.ctx) {
      return;
    }
    if (!this.history || this.history.length === 0) {
      this.clear();
      return;
    }
    this.draw();
  }

  handleResize() {
    this.redraw();
  }

  clear() {
    if (!this.ctx) return;
    const { canvas, ctx } = this;
    const width = canvas.clientWidth || canvas.width || 400;
    const height = canvas.clientHeight || canvas.height || 260;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
  }

  draw() {
    const { canvas, ctx } = this;
    if (!canvas || !ctx) {
      return;
    }

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

    const xpValues = this.history.map((entry) => entry.xpAfter);
    const latest = this.history[this.history.length - 1];
    const lastXp = latest?.xpAfter ?? 0;
    const nextLevelXp = this.chartContext?.nextLevelXp ?? lastXp;
    const chartMaxCandidate = Math.max(nextLevelXp, ...xpValues, 100);
    const yTicks = createTickMarks(chartMaxCandidate * 1.08);
    const chartMax = yTicks[yTicks.length - 1] || chartMaxCandidate || 1;

    const gradient = ctx.createLinearGradient(0, padding.top, 0, baseY);
    gradient.addColorStop(0, "rgba(26, 33, 72, 0.45)");
    gradient.addColorStop(1, "rgba(12, 16, 36, 0.85)");
    ctx.fillStyle = gradient;
    ctx.fillRect(padding.left, padding.top, plotWidth, plotHeight);

    drawGridLines({ ctx, padding, width, height, plotWidth, plotHeight, yTicks, history: this.history, chartMax });

    const getX = (index) => {
      if (this.history.length === 1) {
        return padding.left + plotWidth / 2;
      }
      return padding.left + (plotWidth * index) / (this.history.length - 1);
    };

    const getY = (xp) => {
      if (chartMax === 0) {
        return baseY;
      }
      const clamped = Math.min(Math.max(xp, 0), chartMax);
      const ratio = clamped / chartMax;
      return baseY - ratio * plotHeight;
    };

    drawSeriesArea({ ctx, history: this.history, getX, getY, baseY });
    drawSeriesLine({ ctx, history: this.history, getX, getY });
    drawSeriesPoints({ ctx, history: this.history, getX, getY });
    drawNextLevelGuide({
      ctx,
      padding,
      width,
      getY,
      nextLevelXp,
      lastXp,
      skill: this.skillName
    });
  }
}

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

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function drawGridLines({ ctx, padding, width, height, plotWidth, plotHeight, yTicks, history, chartMax }) {
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

  const xTickIndexes = selectXTickIndexes(history.length);
  xTickIndexes.forEach((index) => {
    const x =
      history.length === 1
        ? padding.left + plotWidth / 2
        : padding.left + (plotWidth * index) / (history.length - 1);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, baseY);
    ctx.stroke();

    ctx.fillStyle = "rgba(198, 206, 255, 0.75)";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(chartDateFormatter.format(history[index].timestamp), x, baseY + 8);
  });

  ctx.restore();

  ctx.beginPath();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, baseY);
  ctx.lineTo(width - padding.right, baseY);
  ctx.stroke();
}

function drawSeriesArea({ ctx, history, getX, getY, baseY }) {
  if (history.length === 0) {
    return;
  }
  ctx.save();
  ctx.fillStyle = "rgba(248, 193, 42, 0.16)";
  ctx.beginPath();
  const startX = getX(0);
  ctx.moveTo(startX, baseY);
  ctx.lineTo(startX, getY(history[0].xpAfter));
  for (let i = 1; i < history.length; i += 1) {
    ctx.lineTo(getX(i), getY(history[i - 1].xpAfter));
    ctx.lineTo(getX(i), getY(history[i].xpAfter));
  }
  ctx.lineTo(getX(history.length - 1), baseY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawSeriesLine({ ctx, history, getX, getY }) {
  if (history.length === 0) {
    return;
  }
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(248, 193, 42, 0.9)";
  ctx.beginPath();
  ctx.moveTo(getX(0), getY(history[0].xpAfter));
  for (let i = 1; i < history.length; i += 1) {
    ctx.lineTo(getX(i), getY(history[i].xpAfter));
  }
  ctx.stroke();
  ctx.restore();
}

function drawSeriesPoints({ ctx, history, getX, getY }) {
  if (history.length === 0) {
    return;
  }
  ctx.save();
  const lastIndex = history.length - 1;
  history.forEach((entry, index) => {
    const x = getX(index);
    const y = getY(entry.xpAfter);
    ctx.beginPath();
    ctx.fillStyle = index === lastIndex ? "#f8c12a" : "rgba(248, 193, 42, 0.6)";
    ctx.strokeStyle = "rgba(12, 16, 36, 0.85)";
    ctx.lineWidth = 1.5;
    ctx.arc(x, y, index === lastIndex ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();
}

function drawNextLevelGuide({ ctx, padding, width, getY, nextLevelXp, lastXp, skill }) {
  if (!nextLevelXp || nextLevelXp <= lastXp) {
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

const storage = new StorageManager(STORAGE_KEY, {
  onUnavailable: () => showStorageWarning("Progress is stored only for this session because browser storage could not be accessed."),
  onRestored: () => hideStorageWarning()
});
const tracker = new SkillTracker(DEFAULT_SKILLS, storage);
const chartRenderer = new ChartRenderer(chartCanvas, chartEmptyNotice);

initializeUi();
setupInstallPrompt();

function initializeUi() {
  renderSkillOptions();
  renderSkillCards();
  renderActivityFeed();
  const initialSkill = skillSelector.value || tracker.getSkillNames()[0];
  updateChart(initialSkill);
  updateChartInsight(initialSkill);
  setupFormHandling();
}

function renderSkillOptions() {
  const options = tracker.getSkillNames().map((skill) => {
    const option = document.createElement("option");
    option.value = skill;
    option.textContent = skill;
    return option;
  });

  skillSelector.replaceChildren(...options.map((option) => option.cloneNode(true)));
  logSkill.replaceChildren(...options);
  const defaultSkill = tracker.getSkillNames()[0];
  skillSelector.value = skillSelector.value || defaultSkill;
  logSkill.value = logSkill.value || defaultSkill;

  skillSelector.addEventListener("change", (event) => {
    const skill = event.target.value;
    updateChart(skill);
    updateChartInsight(skill);
  });
}

function renderSkillCards() {
  skillGrid.innerHTML = "";
  tracker.getSkillNames().forEach((skill) => {
    const summary = tracker.getSkillSummary(skill);
    if (!summary) return;
    const card = document.createElement("article");
    card.className = "skill-card";
    const xpSpan = Math.max(summary.nextLevelXp - summary.currentLevelXp, 1);
    const xpIntoLevel = Math.max(summary.xp - summary.currentLevelXp, 0);
    const progress = Math.min((xpIntoLevel / xpSpan) * 100, 100);

    card.innerHTML = `
      <h3>${skill}</h3>
      <div class="skill-metadata">
        <span>Total XP</span>
        <span>${summary.xp.toLocaleString()}</span>
      </div>
      <p class="level-display">Lvl ${summary.level}</p>
      <div class="xp-progress" role="progressbar" aria-label="${skill} XP progress" aria-valuemin="0"
           aria-valuemax="${xpSpan}" aria-valuenow="${xpIntoLevel}">
        <div class="xp-progress__bar" style="width: ${progress.toFixed(1)}%"></div>
      </div>
      <div class="next-level">
        <span>${summary.xpToNext.toLocaleString()} XP to next level</span>
        <span>Lvl ${Math.min(summary.nextLevel, MAX_LEVEL)}</span>
      </div>
    `;

    skillGrid.appendChild(card);
  });
}

function renderActivityFeed() {
  const entries = tracker.getRecentActivity(10);
  if (entries.length === 0) {
    activityFeed.innerHTML = '<li class="activity-item">No activity yet. Log some XP to begin your journey!</li>';
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

function setupFormHandling() {
  logForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const skill = logSkill.value;
    const amount = Number.parseInt(logAmount.value, 10);
    const note = logNote.value.trim();
    const entry = tracker.addXp(skill, amount, note);
    if (!entry) {
      return;
    }

    renderSkillCards();
    renderActivityFeed();
    skillSelector.value = skill;
    updateChart(skill);
    updateChartInsight(skill);
    logForm.reset();
    logSkill.value = skill;
  });
}

function updateChart(skill) {
  const history = tracker.getChartHistory(skill);
  const summary = tracker.getSkillSummary(skill);
  chartRenderer.update(history, skill, {
    nextLevelXp: summary?.nextLevelXp ?? 0
  });
}

function updateChartInsight(skill) {
  const summary = tracker.getSkillSummary(skill);
  if (!summary) {
    chartInsight.textContent = "";
    return;
  }

  const pace = tracker.getSevenDayGain(skill);
  const lastGain = tracker.getLastGain(skill);
  const paceText =
    pace.total === 0
      ? "Log some XP to set your 7-day pace."
      : `You gained ${pace.total.toLocaleString()} XP in the last 7 days (~${pace.daily.toLocaleString()} XP/day).`;
  const lastNote = lastGain?.note ? ` Last session: ${lastGain.note}.` : "";

  chartInsight.textContent = `${skill} is level ${summary.level} with ${summary.xp.toLocaleString()} XP. ${summary.xpToNext.toLocaleString()} XP left for the next level (${summary.progressPercent}% complete). ${paceText}${lastNote}`;
}

function showStorageWarning(message) {
  if (!storageWarning) return;
  storageWarning.hidden = false;
  storageWarning.textContent = message;
}

function hideStorageWarning() {
  if (!storageWarning) return;
  storageWarning.hidden = true;
}

function setupInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    if (installButton) {
      installButton.hidden = false;
    }
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
