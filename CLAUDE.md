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

- **v0.1 built:** Home, garden areas (Stef's eight areas pre-filled), plants, "Not doing well" setbacks, Didn't make it, Settings with backup, export and restore, offline install, and GitHub Pages publishing.
- **Next:** weather (Open-Meteo) on Home and the Weather screen. Then jobs this week, the garden diary screen and supplies.
