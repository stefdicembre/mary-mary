# Mary Mary

> "Mary, Mary, quite contrary, how does your garden grow?"

A gentle garden companion for Stef's garden. It works as an app on the iPhone home screen, and everything is saved on the phone.

**Live app:** https://stefdicembre.github.io/mary-mary/

## What it does so far (version 0.3)

- **Home:** a greeting, your garden areas, and any plants that need a look.
- **Garden areas:** add, edit or remove areas, with which way they face, soil and notes.
- **Plants:** add plants to an area, grouped into sections, with variety, Latin name, date planted, where they came from and notes.
- **Not doing well:** mark a plant as struggling, died or pulled out. You can say why if you know (weather, water, pests, disease…) or write it in your own words, and Mary Mary spots likely reasons in what you write. It can also go in the garden diary.
- **Didn't make it:** lost plants are kept with their history, so you can learn from them. Each area shows what has gone wrong there before, and adding the same plant again shows what happened last time.
- **Backup:** save everything as a file (JSON), export your plants as a spreadsheet (CSV), and restore from a backup.
- **Weather** (new in 0.2): add your postcode in Settings. Home shows today's temperature and warnings for frost, heat or strong wind in the next day or two. Frost warnings list the tender plants to protect. The Weather screen has the next few hours, the week ahead and "How does this affect the garden?". The last forecast is kept for when there's no signal.
- **Planting plan** (new in 0.2): from any area, "Suggest a planting plan". Choose "Fill the gaps" or "Give it a refresh", then soil and what matters most. Suggestions come from Mary Mary's built-in list of reliable UK plants. They suit the area's aspect, colour scheme and soil, learn from past setbacks (e.g. wind), and are grouped by when to plant. "Add to planned" puts a plant on the area's Planned list, and "Planted it" turns it into a real plant.

- **Jobs** (new in 0.3): a built-in UK seasonal calendar that only suggests jobs that fit your garden (e.g. "Lift and store the dahlias" only if you have dahlias), plus your own jobs. Tick them off, "Not now" puts a job off for a week, and you can "Add something I did". Home shows "This week's jobs" and "One thing at a time" (the shortest job), and an urgent frost warning becomes today's first job.
- **Garden diary** (new in 0.3): notes and photos by date, filtered by area or plant, with search. Setbacks and finished jobs can go in it too. Photos are shrunk to 1600px before saving, and backups include them.

Coming next: supplies and the harvest log. Sharing with Cath comes later.

## Putting a change live

1. In GitHub Desktop, write a short summary and click **Commit to main**.
2. Click **Push origin**.
3. Wait 1 to 3 minutes for the green tick on GitHub's **Actions** tab.
4. Close the app on your phone fully and open it again.

## For developers

- React + TypeScript, bundled with esbuild (`build.mjs`). No other runtime libraries.
- Weather: `src/lib/weatherApi.ts` (postcodes.io for UK postcodes, Open-Meteo for the forecast and town names; both free, no keys) and `src/lib/weather.ts` (advice rules). Overnight lows are worked out from hourly temperatures, 6pm to 9am.
- Jobs: `src/lib/jobs.ts` (seasonal calendar plus own jobs; a seasonal job done counts for that season, keyed "<id>:<season year>").
- Diary photos: `src/lib/photos.ts`, kept in their own IndexedDB store. Unused photos are tidied when the app starts.
- Planner: `src/lib/catalogue.ts` (built-in UK plant list, general advice) and `src/lib/plan.ts` (filtering and scoring).
- Data lives in IndexedDB (`src/lib/db.ts`) as one document (`GardenData` in `src/lib/types.ts`).
- All changes to the data go through small pure functions in `src/lib/actions.ts`.
- `npm install`, then `npm test` (logic tests), `npm run build` (makes `dist/`), and `npm run dev` (preview at http://localhost:5173).
- `.github/workflows/deploy.yml` tests, builds and publishes to GitHub Pages on every push to `main`.
- `public/sw.js` is the offline service worker. The build stamps a version into it, so each publish replaces the old cache.
- Icons are drawn by `scripts/make-icons.mjs`, which needs `sharp`. The PNGs are committed, so this only needs running if the icon design changes.
