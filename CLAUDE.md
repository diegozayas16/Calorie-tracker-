# Calorie Tracker

A static calorie and macronutrient tracker written in plain HTML, CSS and JavaScript.
There is no build step, framework or dependency: open `index.html` in a browser, or serve
the folder with any static server. The one server-side piece is a small Vercel function
(`api/food-search.js`) for the USDA food search.

GitHub: https://github.com/diegozayas16/Calorie-tracker- (branch `main`). Live on Vercel.

## Files

- `index.html`: page layout. It has a header with day navigation, Today's Summary, Add Food (with the food search), Food Log and Daily Goals.
- `style.css`: styling. Colors are CSS variables on `:root`, there's a dark mode via `prefers-color-scheme`, and the layout goes to one column below 480px.
- `app.js`: all the browser logic (state, rendering, event handlers, food search).
- `api/food-search.js`: Vercel serverless function that forwards food searches to USDA (see below).
- `.gitignore`: excludes `.env*`, key and secret files, `node_modules/` and other dependency folders, build output, editor files and `.claude/`.

## How the app works

- Data is saved in `localStorage` under the key `calorieTracker.v1`, in this shape:
  ```js
  {
    goals: { calories, protein, carbs, fat },              // defaults 2000 / 150 / 250 / 65
    days: { "YYYY-MM-DD": [ { id, name, meal, calories, protein, carbs, fat } ] }
  }
  ```
  Day keys use the local date, not UTC. An empty day is deleted from `days`.
- `meal` is one of `Breakfast`, `Lunch`, `Dinner`, `Snack` (`MEALS` in `app.js`).
- `render()` redraws the date label, the summary (calorie ring and macro bars) and the food log
  from `state`. Every change goes through `saveState()` and then `render()`.
- User-entered food names are inserted with `textContent`, never `innerHTML`, to avoid HTML injection.
- The "Fill calories from macros" button uses 4 / 4 / 9 kcal per gram of protein / carbs / fat.

## Food search (USDA FoodData Central)

- The search box in Add Food calls `GET /api/food-search?q=...`. That Vercel function
  POSTs to `https://api.nal.usda.gov/fdc/v1/foods/search` (data types Foundation, SR Legacy,
  Survey (FNDDS), Branded; 25 results), strips the response down to the fields the app uses
  and only the nutrients it needs, and sets `Cache-Control: s-maxage=86400` so Vercel's CDN
  answers repeat searches without calling USDA.
- The API key is read from the `USDA_API_KEY` environment variable in Vercel (Project →
  Settings → Environment Variables), never from the browser code. Without it the function
  falls back to USDA's shared `DEMO_KEY`, which is limited to about 30 requests an hour and
  50 a day per IP, so set the real key on the live site. Keys are free from
  https://fdc.nal.usda.gov/api-key-signup (api.data.gov, 1,000 requests an hour).
- Nutrient ids used: energy 1008 (falls back to 2047 / 2048, then 4/4/9 from macros),
  protein 1003, carbs 1005 (or 1050), fat 1004 (or 1085).
- USDA values are per 100 g. Branded foods whose `servingSizeUnit` is ml/MLT are per 100 ml.
  `normalizeFood()` in `app.js` turns a result into `per100` values plus a `baseUnit`.
- Serving units: g and oz (28.3495 g) for everything; ml is added for liquids (per-100 ml
  branded foods, or names matching `LIQUID_WORDS`). Converting between ml and g assumes
  1 g/ml and the page says so. The default amount is the branded label serving, else 100.
- Picking a result and changing the amount or unit fills the normal Add Food fields
  (name gets the amount appended, e.g. "Bananas, raw (118 g)"). The user can still edit
  them before pressing Add Entry, so the stored entry shape doesn't change.
- Results are generic USDA foods first, then branded. Food names are inserted with
  `textContent`.
- Local testing: `python -m http.server` doesn't run `/api`, so on `localhost` a 404 from
  `/api/food-search` makes the page call USDA directly with `DEMO_KEY`. To run the real
  function locally use `vercel dev` (with `USDA_API_KEY` in a `.env` file, which is gitignored).

## Conventions

- Keep it dependency-free vanilla JS and CSS unless there's a reason to add a toolchain.
- Don't use `confirm()`, `alert()` or `prompt()`. Some browsers, including the Claude
  desktop browser pane, block them without showing anything (`confirm()` returns `false`).
  Use confirmations built into the page instead (see the two-click "Clear day" button).
- Wrap `localStorage` access in try/catch. The app has to work when storage is unavailable.
- Never put API keys in `app.js`, `index.html` or any committed file. Keys go in Vercel
  environment variables and are only read inside `api/`.

## Running locally

```bash
python -m http.server 8123
```
Then open http://localhost:8123. A local `.claude/launch.json` (not committed) has the
same server set up for the Claude browser preview.

## Done so far

1. Built the tracker: food entry with calories and macros, meal grouping, calorie ring,
   macro progress bars, editable daily goals, day navigation, saving in `localStorage`.
2. Fixed "Clear day" not clearing anything. It relied on `confirm()`, which the browser
   blocked, so it now uses a two-click confirmation in the page (resets after 3 s or on day change).
3. Added `.gitignore`, checked the files for secrets (none found), and pushed the first commit
   (`9be3525 Add calorie tracker web app`) to GitHub `main`.
4. Installed the Claude Code command-line tool (2.1.306, at `~/.local/bin`, added to the user PATH)
   and the Vercel plugin for Claude Code (`vercel-plugin@vercel` v0.54.1, user scope).

5. Deployed the site to Vercel (it's live).
6. Added USDA food search with serving sizes in g / oz / ml that autofills calories and macros,
   through the `api/food-search.js` Vercel function. Also fixed form inputs overflowing their
   card on wider screens (`width: 100%; min-width: 0` on inputs and selects).

## To do / blocked

- [ ] **Set `USDA_API_KEY` in Vercel.** Get a free key at https://fdc.nal.usda.gov/api-key-signup,
      add it in Vercel → Project → Settings → Environment Variables (Production and Preview),
      then redeploy. Until then the search uses the low-limit `DEMO_KEY`.
- [ ] **Fix the GitHub connector.** The `plugin:github:github` connection fails with
      "Authorization header is badly formatted". It needs to be signed in again or set up again.
      Plain `git push` over HTTPS works without it (Git Credential Manager).
- [ ] **Vercel plugin packages (optional).** The plugin's packages (`minisearch`, `detect-agent`)
      weren't installed because `bun` isn't installed. The hooks still ran without errors in a
      test, but features that use those packages may work less well. Install bun if that matters.
- [ ] **Move the local copy to a permanent folder.** This copy was made in a temporary folder
      for one Claude session and is deleted with it. Clone the GitHub repo somewhere permanent,
      or move the session to a chosen folder.
- [ ] **GitHub Pages (optional).** It could also be hosted for free via Settings → Pages → `main`.
