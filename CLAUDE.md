# Mary Mary — garden companion app

> "Mary, Mary, quite contrary, how does your garden grow?"

Mary Mary is a personal gardening app and companion for Stef. It helps keep on top of the garden day to day and plan it season by season.

## Who it's for

- A home gardener (Stef), based in the **UK (Europe/London)**. Stef gardens with Cath. Sharing with Cath on her own phone is planned for later.
- Use UK conventions: metric units (cm, m, °C), UK spellings, UK seasons and frost dates, and UK plant names alongside the Latin ones.
- It should feel friendly and calm, like a helpful gardening friend rather than a farm-management tool.

## The design

The wireframes are in the claude.ai Design canvas "Mary Mary: home screen" (https://claude.ai/artifact/MhdEt4dfEphpKfEUdAjFUp). It has 31 phone screens: Home, First-time setup, Area pages and planting plan, Jobs, Out in the garden, Weather, Urgent warnings, Notifications, Going away (plus Cath's view), Garden diary, Supplies, Settings and Menu. Match its look:

- Plus Jakarta Sans font
- cream background `#F1EFE8`, dark green `#27500A`, green `#3B6D11`, pale green `#EAF3DE`
- white rounded cards, round area icons, buttons at least 44px

## Core features (rough priority order)

1. **My plants**: name, variety, Latin name, area, section, date planted, source, notes and photos. Status: growing / struggling / lost.
2. **Garden areas**: beds, borders, pots, greenhouse, allotment and so on, each with aspect, soil and notes.
3. **Care calendar and jobs**: what's due this week, who's doing it, done / not now, "One thing at a time".
4. **Weather**: forecast, frost and heat warnings, and "no need to water, it rained" (Open-Meteo, free, no key).
5. **Sowing and planting planner**: UK timings and frost dates. Takes past setbacks into account.
6. **Garden diary**: dated notes and photos, by area and plant.
7. **Supplies**: what's in the shed and what's running low.
8. **Harvest log**, **garden layout plan** and **going away** mode.
9. *Later:* sharing with Cath (online database and invites), push notifications, smarter suggestions.

## Plants that don't make it (setbacks)

- From a plant: **"Not doing well"**, choosing **Struggling**, **Died** or **Pulled it out**.
- Optional reason chips (Weather → Frost / Heat / Wind; Water → Too wet / Too dry; Pests → named pest; Disease; Forgot about it; Don't know). The gardener's own words are kept exactly as written, and Mary Mary offers reasons it spots in them ("Sounds like: + Wind").
- **Add to diary** is on by default and creates a linked journal entry.
- Struggling plants show on Home ("Needs a look") and on their area. Lost plants move to **Didn't make it** with their history. Areas show "Learned here" counts, and adding the same plant again shows what happened last time.
- Suggestions use setback history gently and never block.

## Product principles

- **Quick to use outdoors**: seconds, on a phone, with muddy hands.
- **Simple first**: add features gradually.
- **The data belongs to Stef**: backup (JSON), plants as CSV, restore. No lock-in.
- **Gentle, not naggy**: setbacks are for learning, not blame.

## Decisions (28 Oct 2026)

- **Just Stef's phone first.** No backend yet. Sharing with Cath is a later phase that needs an online database and sign-in, so ask before starting it.
- **Weather:** use Open-Meteo (free, no account). The postcode is only used for the forecast.
- **Smarts:** a built-in UK table of seasonal jobs and plant advice first. No AI service yet: that would need an API key and a running cost, so ask first.
- **Tech:**
  - React + TypeScript, bundled with **esbuild** (`build.mjs`), not Vite. Claude's workspace can't download npm packages, so the build uses only tools that work there.
  - Hosted on **GitHub Pages**: `.github/workflows/deploy.yml` builds on every push to `main`. Live at https://stefdicembre.github.io/mary-mary/
  - Installed on the iPhone via Safari → Add to Home Screen. Offline support comes from `public/sw.js`.
  - Data in IndexedDB as one `GardenData` document (`src/lib/types.ts`). Changes go through pure functions in `src/lib/actions.ts`, with tests in `src/lib/logic.test.ts`.
  - Hash routing (`#/area/…`) so GitHub Pages needs no server set-up.
- **Stef's computer:** Windows. The folder is `Desktop\mary-mary` (in OneDrive) and is managed with GitHub Desktop. Stef doesn't use the command line.

## How to work with me (notes for Claude)

- I'm building this for myself, so **explain things in plain English** and don't assume deep coding knowledge.
- **Ask before** making big structural decisions, such as changing the stack, adding a backend, or adding paid services.
- Work in small steps: get one feature working end to end, show it, then move on.
- Keep `README.md` up to date.
- For built-in gardening advice, aim for UK accuracy and note where advice is general.
- After a change: run `npm test` and `npm run build`, then tell me to Commit and Push in GitHub Desktop.

## Current status

- **v0.1 (live):** Home, garden areas (Stef's eight areas pre-filled), plants, "Not doing well" setbacks, Didn't make it, Settings with backup, export and restore, offline install, and GitHub Pages publishing.
- **v0.2:**
  - **Weather:** the postcode is looked up with postcodes.io, the forecast comes from Open-Meteo, and the last forecast is saved for offline use. Frost, heat, wind, rain and dry-spell advice. Frost warnings list tender plants (`isTender` plus past frost setbacks).
  - **Planting plan:** built-in catalogue of about 75 UK plants. Suggestions follow the area's aspect, colours, soil and setback lessons. Planned plants live on the area, "Planted it" makes them real plants, and "Not for me" is remembered.
  - Areas now have a colour scheme.
- **v0.3:**
  - **Jobs:** seasonal UK calendar (`SEASONAL` in jobs.ts, about 45 jobs) matched to plants and areas, plus own jobs, Not now (7 days), Add something I did, Done recently with Undo and "+ Diary". Home has "This week's jobs" and "One thing at a time".
  - **Garden diary:** list by month, area chips, search, entry view, add/edit/remove, and photos (shrunk, own IndexedDB store, included in backups). Links from area, plant and jobs.
  - Still out of scope: the "who's doing it" Stef/Cath split, which waits for sharing.
- **v0.4 (8 Nov 2026):**
  - **Garden map** (`#/map`): areas and features (house, patio, path, shed, tree, compost) as boxes on a 1 m grid. Edit mode: tap to select, drag to move, corner handle to resize, arrow and size buttons, Turn round, garden size, north compass. View mode: tap an area to open it. Smaller shapes draw on top.
  - **Bed plans** (`#/area/<id>/layout`, "What's where"): a grid per area (default two squares per metre from the map, or 6 × 4). Place plants and planned plants, move/swap, take off. Planned → planted keeps the square. Lost plants stay faintly as "was here".
  - Data: `GardenData.map` and `GardenData.bedPlans`, filled in by `upgrade()` for older backups. Logic in `src/lib/layout.ts`; `tidyBedPlans` runs after every change.
- **v0.5 (8 Nov 2026):**
  - **Supplies** (`#/supplies`, from the Menu): add (with idea chips), Plenty / Running low / None left, rename, remove, all with Undo. "Needed for" lists this week's jobs that use it; "Next time you're at the garden centre" with Share the list.
  - Ticking off a job uses up its supplies: small use = 1, big use (`lots`) = 3, a level drops at 3 (`Supply.wear`). `Task.supplyUse` lets Undo put back exactly that. Setting a level by hand resets the count.
  - Seasonal jobs have `uses` in `SEASONAL`; own jobs match supply names in their title/notes. Job rows show "Needs …" and Home shows a note when a supply this week's jobs need is low or gone.
  - Logic in `src/lib/supplies.ts`, tests in `supplies.test.ts` (51 tests in all). Also fixed "Does well here" on a struggling plant not being saved.
- **v0.6 (8 Nov 2026):**
  - **Harvest log** (`#/harvest`, from the Menu): fruit, veg and herbs only (Stef's choice). "I picked something" form: plant chips (Fruit / Vegetables / Herbs sections) plus recent typed names and "Something else"; easy sizes (a few / handful / bowlful / trugful), optional count stepper, optional weight (g or kg, stored as grams); Today / Yesterday / date; note; "Add to the garden diary" off by default.
  - Log screen: "This year so far" totals per crop (plurals and varieties joined by `cropKey`), "By now last year", pickings by month with Change (edit/remove, with Undo), year chips once there's more than one year.
  - Plant pages for edible plants show a Harvest card with "+ I picked some". Done recently offers "+ Harvest" after picking jobs (`isPickingJob`). Settings saves the log as CSV.
  - Data: `GardenData.harvests` (`Harvest` in types.ts), filled in by `upgrade()`. Deleting a plant keeps its pickings under the name; removing a picking removes the diary line Mary Mary wrote for it, and an edited picking only rewrites that line if it hasn't been changed by hand.
  - Logic in `src/lib/harvest.ts`, tests in `harvest.test.ts` (61 tests in all).
- **v0.7 (8 Nov 2026):**
  - **Plant ↔ bed plan link:** plant pages have a "Where it is" card: a mini bed plan with the plant's square picked out, rough position ("In the top left corner of …", from `positionWords`) and "Next to …" (`neighbours`, lost plants left out, up to three names plus "N more"). Tapping it opens `#/area/<id>/layout/plant/<plantId>`, which starts with the plant picked (ready to move), a glowing ring once placed, and Back to the plant. Plants without a square get "Give it a square"; lost plants show "Where it was".
  - Logic (`whereIs`, `spotName`, `neighbours`, `positionWords`, `andList`) in `src/lib/layout.ts`, 63 tests in all.
- **Next:** going-away mode, or something else Stef picks. Ask Stef.
- **Claude's workspace:** `npm install` is blocked, but React, esbuild, tsx and TypeScript are in `/opt/npm-tools/node_modules`. Symlink them into `node_modules/` to run `npm test` and `npm run build`. There are no React types there, so `.tsx` can't be type-checked; the click-through covers that.
- **Delivering changes:** with Stef's `Desktop\mary-mary` folder connected, write the changed files straight into it (update the existing files, don't make copies). Stef then Commits and Pushes in GitHub Desktop.
- The repo is public, which is needed for free GitHub Pages. Stef places `.github/workflows` files by hand, because remote tools can't write there.
