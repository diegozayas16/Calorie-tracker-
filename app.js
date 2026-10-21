// ---------- Storage ----------
const STORAGE_KEY = "calorieTracker.v1";
const DEFAULT_GOALS = { calories: 2000, protein: 150, carbs: 250, fat: 65 };
const MEALS = ["Breakfast", "Lunch", "Dinner", "Snack"];

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.goals && saved.days) return saved;
  } catch (e) {
    // Storage unavailable or corrupt; fall back to defaults
  }
  return { goals: { ...DEFAULT_GOALS }, days: {} };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    showToast("Could not save — storage unavailable");
  }
}

let state = loadState();
let currentDate = new Date();

// ---------- Helpers ----------
const $ = (id) => document.getElementById(id);

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isToday(date) {
  return dateKey(date) === dateKey(new Date());
}

function entriesForDay() {
  return state.days[dateKey(currentDate)] || [];
}

function num(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function round(n) {
  return Math.round(n * 10) / 10;
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2000);
}

// ---------- Rendering ----------
const RING_CIRCUMFERENCE = 2 * Math.PI * 52;

function renderDate() {
  const label = isToday(currentDate)
    ? "Today"
    : currentDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  $("currentDate").textContent = label;
  document.querySelector(".summary h2").textContent =
    isToday(currentDate) ? "Today's Summary" : `Summary for ${label}`;
}

function renderSummary() {
  const totals = entriesForDay().reduce(
    (t, e) => ({
      calories: t.calories + e.calories,
      protein: t.protein + e.protein,
      carbs: t.carbs + e.carbs,
      fat: t.fat + e.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  const goals = state.goals;

  // Calorie ring
  const ratio = goals.calories > 0 ? totals.calories / goals.calories : 0;
  const ring = $("ringProgress");
  ring.style.strokeDasharray = RING_CIRCUMFERENCE;
  ring.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - Math.min(ratio, 1));
  ring.classList.toggle("over", ratio > 1);

  $("caloriesConsumed").textContent = Math.round(totals.calories);
  $("calorieGoalText").textContent = goals.calories;

  const remaining = Math.round(goals.calories - totals.calories);
  const remainingEl = $("caloriesRemaining");
  remainingEl.textContent = remaining >= 0 ? `${remaining} left` : `${-remaining} over`;
  remainingEl.classList.toggle("over", remaining < 0);

  // Macro bars
  for (const macro of ["protein", "carbs", "fat"]) {
    const goal = goals[macro];
    const value = totals[macro];
    const pct = goal > 0 ? (value / goal) * 100 : 0;
    const bar = $(`${macro}Bar`);
    bar.style.width = `${Math.min(pct, 100)}%`;
    bar.classList.toggle("over", pct > 100);
    $(`${macro}Text`).textContent = `${round(value)} / ${goal} g`;
  }
}

function renderLog() {
  const log = $("foodLog");
  const entries = entriesForDay();
  log.innerHTML = "";
  $("emptyMsg").hidden = entries.length > 0;
  $("clearDay").hidden = entries.length === 0;

  for (const meal of MEALS) {
    const mealEntries = entries.filter((e) => e.meal === meal);
    if (mealEntries.length === 0) continue;

    const group = document.createElement("div");
    group.className = "meal-group";

    const mealCals = mealEntries.reduce((sum, e) => sum + e.calories, 0);
    const title = document.createElement("div");
    title.className = "meal-title";
    title.innerHTML = `<span></span><span>${Math.round(mealCals)} kcal</span>`;
    title.firstChild.textContent = meal;
    group.appendChild(title);

    for (const entry of mealEntries) {
      const row = document.createElement("div");
      row.className = "entry";
      row.innerHTML = `
        <div class="entry-main">
          <div class="entry-name"></div>
          <div class="entry-macros">
            <span class="p">P ${round(entry.protein)}g</span> ·
            <span class="c">C ${round(entry.carbs)}g</span> ·
            <span class="f">F ${round(entry.fat)}g</span>
          </div>
        </div>
        <div class="entry-cals">${Math.round(entry.calories)} kcal</div>
        <button class="delete-btn" aria-label="Delete entry" title="Delete">&times;</button>
      `;
      // textContent keeps user-entered names from being parsed as HTML
      row.querySelector(".entry-name").textContent = entry.name;
      row.querySelector(".delete-btn").addEventListener("click", () => deleteEntry(entry.id));
      group.appendChild(row);
    }
    log.appendChild(group);
  }
}

function renderGoalsForm() {
  $("goalCalories").value = state.goals.calories;
  $("goalProtein").value = state.goals.protein;
  $("goalCarbs").value = state.goals.carbs;
  $("goalFat").value = state.goals.fat;
}

function render() {
  renderDate();
  renderSummary();
  renderLog();
}

// ---------- Actions ----------
function addEntry(entry) {
  const key = dateKey(currentDate);
  if (!state.days[key]) state.days[key] = [];
  state.days[key].push(entry);
  saveState();
  render();
}

function deleteEntry(id) {
  const key = dateKey(currentDate);
  state.days[key] = (state.days[key] || []).filter((e) => e.id !== id);
  if (state.days[key].length === 0) delete state.days[key];
  saveState();
  render();
  showToast("Entry removed");
}

function changeDay(offset) {
  resetClearButton();
  currentDate = new Date(currentDate);
  currentDate.setDate(currentDate.getDate() + offset);
  render();
}

// ---------- Event listeners ----------
$("foodForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = $("foodName").value.trim();
  if (!name) return;

  addEntry({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name,
    meal: $("mealType").value,
    calories: num($("calories").value),
    protein: num($("protein").value),
    carbs: num($("carbs").value),
    fat: num($("fat").value),
  });

  const meal = $("mealType").value;
  event.target.reset();
  $("mealType").value = meal; // keep the selected meal for quick repeat entries
  $("foodName").focus();
  showToast(`Added ${name}`);
});

$("estimateBtn").addEventListener("click", () => {
  const kcal = num($("protein").value) * 4 + num($("carbs").value) * 4 + num($("fat").value) * 9;
  $("calories").value = Math.round(kcal);
});

$("goalsForm").addEventListener("submit", (event) => {
  event.preventDefault();
  state.goals = {
    calories: num($("goalCalories").value),
    protein: num($("goalProtein").value),
    carbs: num($("goalCarbs").value),
    fat: num($("goalFat").value),
  };
  saveState();
  renderSummary();
  showToast("Goals saved");
});

// Two-click confirm inside the page, since browsers can block confirm() popups
function resetClearButton() {
  const btn = $("clearDay");
  btn.textContent = "Clear day";
  btn.classList.remove("confirming");
  clearTimeout(resetClearButton.timer);
}

$("clearDay").addEventListener("click", () => {
  const btn = $("clearDay");
  if (!btn.classList.contains("confirming")) {
    btn.textContent = "Click again to confirm";
    btn.classList.add("confirming");
    resetClearButton.timer = setTimeout(resetClearButton, 3000);
    return;
  }
  resetClearButton();
  delete state.days[dateKey(currentDate)];
  saveState();
  render();
  showToast("Day cleared");
});

$("prevDay").addEventListener("click", () => changeDay(-1));
$("nextDay").addEventListener("click", () => changeDay(1));

// ---------- Init ----------
renderGoalsForm();
render();
