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

// ---------- Food search (USDA FoodData Central) ----------
const GRAMS_PER_OZ = 28.3495;
const LIQUID_WORDS =
  /\b(milk|juice|drinks?|beverages?|soda|cola|water|coffee|tea|smoothies?|shakes?|broth|soup|wine|beer|lemonade|kombucha|kefir|nectar)\b/i;
// USDA nutrient ids; the first one found in each list is used
const NUTRIENTS = {
  calories: [1008, 2047, 2048],
  protein: [1003],
  carbs: [1005, 1050],
  fat: [1004, 1085],
};

let selectedFood = null;

function nutrientValue(food, ids) {
  for (const id of ids) {
    const n = food.foodNutrients.find((x) => x.nutrientId === id);
    if (n && Number.isFinite(n.value)) return n.value;
  }
  return null;
}

// Turn a USDA search result into values per 100 g (or per 100 ml for drinks sold by volume)
function normalizeFood(food) {
  food.foodNutrients = food.foodNutrients || [];
  const unit = String(food.servingSizeUnit || "").toLowerCase();
  const perMl = food.dataType === "Branded" && (unit === "ml" || unit === "mlt");
  const protein = nutrientValue(food, NUTRIENTS.protein) || 0;
  const carbs = nutrientValue(food, NUTRIENTS.carbs) || 0;
  const fat = nutrientValue(food, NUTRIENTS.fat) || 0;
  let calories = nutrientValue(food, NUTRIENTS.calories);
  if (calories === null) calories = protein * 4 + carbs * 4 + fat * 9;
  const serving = num(food.servingSize);

  return {
    name: food.description || "Unknown food",
    brand: food.brandName || food.brandOwner || "",
    baseUnit: perMl ? "ml" : "g",
    liquid: perMl || LIQUID_WORDS.test(food.description || ""),
    per100: { calories, protein, carbs, fat },
    // Branded foods list their label serving; everything else starts at 100
    serving: serving > 0 && (unit === "g" || unit === "grm" || perMl) ? serving : 100,
    household: food.householdServingFullText || "",
  };
}

async function fetchFoods(query) {
  const res = await fetch(`/api/food-search?q=${encodeURIComponent(query)}`);
  // No /api when the folder is served with a plain static server: call USDA directly with
  // the public demo key (local testing only; the live site goes through /api)
  if (res.status === 404 && ["localhost", "127.0.0.1"].includes(location.hostname)) {
    const direct = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=DEMO_KEY&pageSize=25&query=${encodeURIComponent(query)}`
    );
    if (!direct.ok) throw new Error(direct.status === 429 ? "Too many searches right now, try again later" : "Search failed");
    return (await direct.json()).foods || [];
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Search failed");
  return data.foods || [];
}

function setSearchStatus(message) {
  $("searchStatus").textContent = message;
  $("searchStatus").hidden = !message;
}

function renderResults(foods) {
  const list = $("searchResults");
  list.innerHTML = "";
  list.hidden = foods.length === 0;
  for (const food of foods) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "result-btn";
    const name = document.createElement("span");
    name.className = "result-name";
    name.textContent = food.name;
    const meta = document.createElement("span");
    meta.className = "result-meta";
    meta.textContent = `${food.brand || "Generic"} · ${Math.round(food.per100.calories)} kcal per 100 ${food.baseUnit}`;
    btn.append(name, meta);
    btn.addEventListener("click", () => selectFood(food));
    li.appendChild(btn);
    list.appendChild(li);
  }
}

function selectFood(food) {
  selectedFood = food;
  $("searchResults").hidden = true;
  setSearchStatus("");
  $("servingName").textContent = food.brand ? `${food.name} (${food.brand})` : food.name;

  const units = food.liquid ? ["g", "oz", "ml"] : ["g", "oz"];
  const select = $("servingUnit");
  select.innerHTML = "";
  for (const u of units) select.add(new Option(u, u));
  select.value = food.baseUnit;
  $("servingAmount").value = round(food.serving);
  $("servingPanel").hidden = false;
  applyServing();
  $("servingAmount").focus();
}

// Scale the per-100 values to the chosen amount and fill in the Add Food form
function applyServing() {
  if (!selectedFood) return;
  const amount = num($("servingAmount").value);
  const unit = $("servingUnit").value;
  const base = unit === "oz" ? amount * GRAMS_PER_OZ : amount; // g and ml treated as 1:1
  const factor = base / 100;
  const v = selectedFood.per100;

  $("foodName").value = `${selectedFood.name} (${round(amount)} ${unit})`;
  $("calories").value = Math.round(v.calories * factor);
  $("protein").value = round(v.protein * factor);
  $("carbs").value = round(v.carbs * factor);
  $("fat").value = round(v.fat * factor);

  const notes = [];
  if (selectedFood.household) notes.push(`Label serving: ${selectedFood.household} (${round(selectedFood.serving)} ${selectedFood.baseUnit})`);
  const mixesUnits = (unit === "ml") !== (selectedFood.baseUnit === "ml");
  if (mixesUnits) notes.push("Converted assuming 1 ml ≈ 1 g, so it's approximate.");
  $("servingNote").textContent = notes.join(" ");
  $("servingNote").hidden = notes.length === 0;
}

function clearSelection() {
  selectedFood = null;
  $("servingPanel").hidden = true;
}

const SEARCH_DELAY_MS = 350; // wait for a pause in typing so every keystroke isn't a request
const searchCache = new Map();
let searchTimer;
let searchSeq = 0;

async function runSearch(query) {
  const seq = ++searchSeq;
  const key = query.toLowerCase();
  setSearchStatus("Searching…");
  try {
    let foods = searchCache.get(key);
    if (!foods) {
      foods = (await fetchFoods(query)).map(normalizeFood);
      // Generic USDA foods first, then branded products
      foods.sort((a, b) => (a.brand ? 1 : 0) - (b.brand ? 1 : 0));
      searchCache.set(key, foods);
    }
    if (seq !== searchSeq) return; // a newer search started while this one was loading
    renderResults(foods);
    setSearchStatus(foods.length ? "Pick a food to fill in its calories and macros." : "No foods found.");
  } catch (e) {
    if (seq !== searchSeq) return;
    renderResults([]);
    setSearchStatus(e.message === "Failed to fetch" ? "Search failed — check your connection." : e.message);
  }
}

// Search as the user types
$("searchInput").addEventListener("input", () => {
  clearTimeout(searchTimer);
  const query = $("searchInput").value.trim();
  if (query.length < 2) {
    searchSeq++; // ignore any search still loading
    renderResults([]);
    setSearchStatus("");
    return;
  }
  searchTimer = setTimeout(() => runSearch(query), SEARCH_DELAY_MS);
});

// Enter or the Search button searches right away
$("searchForm").addEventListener("submit", (event) => {
  event.preventDefault();
  clearTimeout(searchTimer);
  const query = $("searchInput").value.trim();
  if (query.length < 2) {
    setSearchStatus("Type at least 2 characters.");
    return;
  }
  runSearch(query);
});

$("servingAmount").addEventListener("input", applyServing);
$("servingUnit").addEventListener("change", applyServing);
$("servingClear").addEventListener("click", clearSelection);

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
  clearSelection();
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
