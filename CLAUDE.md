# Calorie Tracker

A static calorie and macronutrient tracker written in plain HTML, CSS and JavaScript.
There is no build step, framework or dependency: open `index.html` in a browser, or serve
the folder with any static server.

GitHub: https://github.com/diegozayas16/Calorie-tracker- (branch `main`)

## Files

- `index.html`: page layout. It has a header with day navigation, Today's Summary, Add Food, Food Log and Daily Goals.
- `style.css`: styling. Colors are CSS variables on `:root`, there's a dark mode via `prefers-color-scheme`, and the layout goes to one column below 480px.
- `app.js`: all the logic (state, rendering, event handlers).
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

## Conventions

- Keep it dependency-free vanilla JS and CSS unless there's a reason to add a toolchain.
- Don't use `confirm()`, `alert()` or `prompt()`. Some browsers, including the Claude
  desktop browser pane, block them without showing anything (`confirm()` returns `false`).
  Use confirmations built into the page instead (see the two-click "Clear day" button).
- Wrap `localStorage` access in try/catch. The app has to work when storage is unavailable.

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

## To do / blocked

- [ ] **Deploy to Vercel.** This was the next step but wasn't started. The Vercel connection
      (`mcp.vercel.com`) needs you to sign in first: run `/mcp` in Claude Code and authorize
      `plugin:vercel:vercel`. After that, deploy with the `vercel:deploy` skill, or connect the
      GitHub repo in the Vercel dashboard. No `vercel.json` is needed for a static site.
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
