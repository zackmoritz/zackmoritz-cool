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
const installButton = document.getElementById("installButton");

const xpTable = buildXpTable(MAX_LEVEL + 1);
let chartInstance;
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
  updateChart(skillSelector.value);
  updateChartInsight(skillSelector.value);
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

function initializeChart() {
  const canvas = document.getElementById("xpChart");
  if (!window.Chart) {
    chartInsight.textContent = "Chart module failed to load. Check your connection and refresh.";
    return;
  }
  if (!(canvas instanceof HTMLCanvasElement)) {
    chartInsight.textContent = "Chart canvas is unavailable.";
    return;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    chartInsight.textContent = "Unable to initialize the XP chart context.";
    return;
  }
  chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Cumulative XP",
          data: [],
          borderColor: "rgba(248, 193, 42, 0.9)",
          backgroundColor: "rgba(248, 193, 42, 0.18)",
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: "rgba(248, 193, 42, 1)",
          fill: true,
          stepped: "before"
        },
        {
          label: "Next level threshold",
          data: [],
          borderColor: "rgba(96, 165, 250, 0.55)",
          borderDash: [6, 6],
          tension: 0,
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: {
            color: "#a0b5e8"
          },
          grid: {
            color: "rgba(255, 255, 255, 0.04)"
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: "#a0b5e8"
          },
          grid: {
            color: "rgba(255, 255, 255, 0.04)"
          }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: "#f6f7ff"
          }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const value = context.parsed.y || 0;
              if (context.datasetIndex === 0) {
                const level = levelForXp(value);
                return `${context.dataset.label}: ${value.toLocaleString()} XP • Lvl ${level}`;
              }
              return `${context.dataset.label}: ${value.toLocaleString()} XP`;
            },
            afterLabel: (context) => {
              if (context.datasetIndex !== 0) {
                return "";
              }
              const totalXp = context.parsed.y || 0;
              const remaining = xpToNextLevel(totalXp);
              if (remaining <= 0) {
                return "Max level reached";
              }
              return `${remaining.toLocaleString()} XP until next level`;
            }
          }
        }
      }
    }
  });
}

function updateChart(skill) {
  if (!chartInstance) return;
  const history = state.skills[skill]?.history ?? [];
  if (history.length === 0) {
    chartInstance.data.labels = [];
    chartInstance.data.datasets[0].data = [];
    chartInstance.data.datasets[1].data = [];
    chartInstance.update();
    return;
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric"
  });

  const sortedHistory = [...history].sort((a, b) => a.timestamp - b.timestamp);

  chartInstance.data.labels = sortedHistory.map((entry) => formatter.format(entry.timestamp));
  const xpValues = sortedHistory.map((entry) => entry.xpAfter);
  const thresholds = sortedHistory.map((entry) => xpForLevel(Math.min(entry.levelAfter + 1, MAX_LEVEL + 1)));

  chartInstance.data.datasets[0].label = `${skill} XP progression`;
  chartInstance.data.datasets[0].data = xpValues;
  chartInstance.data.datasets[1].label = `${skill} next level target`;
  chartInstance.data.datasets[1].data = thresholds;

  const maxValue = Math.max(...xpValues, ...thresholds, 100);
  chartInstance.options.scales.y.suggestedMax = maxValue * 1.1;
  chartInstance.update();
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
