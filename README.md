# Mary Mary

> "Mary, Mary, quite contrary, how does your garden grow?"

A gentle garden companion for Stef's garden. It works as an app on the iPhone home screen, and everything is saved on the phone.

**Live app:** https://stefdicembre.github.io/mary-mary/

## What it does so far (version 1.0)

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

- **Garden map** (new in 0.4): from Home ("See the map") or the Menu. "Start my map" sets out your areas on a grid where each square is about a metre. Tap "Move things", then tap an area and drag it (or use the arrow buttons), drag its corner to resize, or "Turn round". Add the house, patio, paths, shed, trees and compost. Set the garden's size, and tap the compass to show which way north is. When you're not moving things, tap an area to open it. A dot shows where something is struggling.
- **What's where** (new in 0.4): each area has a bed plan. Tap a plant under "Not placed yet", then tap a square. Tap a placed plant to open it, move it or take it off. Planned plants show dashed, and keep their square when you tap "Planted it". Plants that didn't make it stay faintly as "was here" until you clear them. The grid starts at two squares to a metre from the map, and you can change it.

- **Supplies** (0.5): in the Menu. Add what's in the shed (tap an idea like Fleece or Bone meal, or type your own) and say whether you've got plenty or it's running low. Each item shows which of this week's jobs need it. When you tick off a job, Mary Mary uses up what it needs: small jobs use a bit (three of them drop it a level), big jobs like mulching drop it straight away. Tap "Change" to correct her, rename or remove. Undo on a job puts its supplies back. Jobs show "Needs fleece, twine", Home warns when something a job needs is running low, and "Share the list" sends your shopping list to Notes, Messages or wherever you like.

- **Harvest log** (new in 0.6): in the Menu, or "+ I picked some" on any fruit, veg or herb plant. Tap what you picked (or type "Something else", like blackberries from the hedge), then how much: a few, a handful, a bowlful, a trugful, or count them. Add a weight if you weighed it. "Add to the garden diary" is there if you want it (off to start with). The log shows each crop's year so far ("Picked 6 times · 23 in all · 2.1 kg"), how that compares with this time last year, and every picking by month. Tap "Change" to fix or remove one. After a picking job like "Pick courgettes and beans often", Done recently offers "+ Harvest". Settings can save the log as a spreadsheet (CSV).

- **Where it is** (new in 0.7): every plant page shows a little map of its bed with the plant's square picked out, roughly where that is ("In the top left corner of The Courtyard") and what's next to it. Tap it to open the bed plan with that plant already picked, ready to move. Plants without a square get "Give it a square", which opens the bed plan ready to tap a square. Plants that didn't make it show where they were.

- **Frost dates and sowing times** (new in 0.8): once your postcode is in Settings, Mary Mary looks at about ten years of past weather near you and works out when frost is usually over in spring and when it usually starts in autumn (right in about 8 years out of 10). You'll find them on the Weather screen and in Settings, where you can change them if your garden is a frost pocket. Planting plan suggestions now say "Sow indoors", "Sow outside" and "Plant out" separately, with dates that follow your frosts. Jobs like "Sow tomatoes indoors", "Harden off", "Plant out tender plants", "Bring tender plants under cover" and "Lift the dahlias" come up at the right time for your garden. There's also a new job: "Sow courgettes, squash and beans in pots indoors".

- **Urgent alerts on the lock screen** (new in 0.9): frost tonight (0°C or below), storms (gusts of 55mph or more) and heatwaves (30°C or more), and nothing else. Frost alerts name your tender plants. Turn them on in Settings → Notifications (open the app from its Home Screen icon first). The app makes a private "push code" that you paste into GitHub once, as a secret called `MARY_MARY_PUSH`. GitHub then checks the forecast at about 6am and 3pm every day (an hour later in summer, and GitHub can be up to half an hour late) and sends the alert. Each alert only comes once. If your tender plants or postcode change, Settings asks you to make a new code and paste it over the old one. To send a test: GitHub → Actions → Garden alerts → Run workflow.

- **First-time setup** (new in 1.0): a new phone opens with a few friendly questions, following the wireframe: the garden's name, who's gardening (time and days), where it is (for weather), its areas (from idea chips or your own names), what's growing in each area (by name, or "I'm not sure" with a description), "Not much planted yet?" (which way it faces, room, soil and what matters, then a short list of easy plants to add as planned), and what matters most. Parts that need things Mary Mary doesn't have yet (invites and joining a garden, photo recognition, the phone's compass, everyday nudges and quiet time) are shown greyed out as "Coming soon". If the app is closed part way, it picks up where you left off. Settings → First-time setup has "Try first-time setup" (nothing is saved) and "Start afresh" (offers a backup first; your garden is only replaced when you tap Finish). What matters to you is remembered and pre-ticked on the planting plan.

Possible next steps: the full "Out in the garden" mode, heavy rain as an urgent warning, a Welcome back screen. Going-away mode is parked. Sharing with Cath comes later.

## Putting a change live

1. In GitHub Desktop, write a short summary and click **Commit to main**.
2. Click **Push origin**.
3. Wait 1 to 3 minutes for the green tick on GitHub's **Actions** tab.
4. Close the app on your phone fully and open it again.

## For developers

- React + TypeScript, bundled with esbuild (`build.mjs`). No other runtime libraries.
- Weather: `src/lib/weatherApi.ts` (postcodes.io for UK postcodes, Open-Meteo for the forecast and town names; both free, no keys) and `src/lib/weather.ts` (advice rules). Overnight lows are worked out from hourly temperatures, 6pm to 9am.
- Jobs: `src/lib/jobs.ts` (seasonal calendar plus own jobs; a seasonal job done counts for that season, keyed "<id>:<season year>").
- Supplies: `src/lib/supplies.ts` (matching jobs to supplies by name, using up and putting back, tested in `supplies.test.ts`) and `src/screens/Supplies.tsx`. Seasonal jobs list what they use (`uses` in `SEASONAL`); your own jobs are matched by words in their title and "Anything you'll need?". Each supply counts `wear` in thirds of a level, and a done job records `supplyUse` so Undo is exact.
- Harvest log: `src/lib/harvest.ts` (adding, changing and removing pickings with their diary line, crop totals that join "Tomatoes" and "Tomato 'Sungold'", last-year comparison, CSV; tested in `harvest.test.ts`) and `src/screens/Harvest.tsx`. Pickings are `GardenData.harvests`; only plants in the Fruit, Vegetables and Herbs sections are offered.
- Diary photos: `src/lib/photos.ts`, kept in their own IndexedDB store. Unused photos are tidied when the app starts.
- Layout: `src/lib/layout.ts` (map boxes and bed plan squares, tested in `layout.test.ts`) and `src/screens/Layout.tsx`. `whereIs`, `neighbours` and `positionWords` power the "Where it is" card on plant pages; `#/area/<id>/layout/plant/<plantId>` opens a bed plan with that plant picked. Bed plans are tidied after every change (`tidyBedPlans`) so they never point at deleted or moved plants.
- Frost dates and sowing: `src/lib/sowing.ts` (tested in `sowing.test.ts`). `workOutFrost` reads daily lows from Open-Meteo's free history (`archive-api.open-meteo.com`, no key). A night of 2°C or below counts as a frost risk. It takes the date frost is over by in 8 years out of 10 (spring) and the date it holds off until in 8 years out of 10 (autumn). The dates are saved as `settings.frost`, worked out again if the place changes, and never overwritten once set by hand. `SOWING` gives seed-grown plants sow indoors / sow outside / plant out timings, either as fixed months or as weeks around the last frost. Seasonal jobs with `frost` follow the same dates (`dueNow`), and `{last}` / `{first}` in their text become the dates. `weatherStore.tsx` fetches the dates in the background, and `src/screens/Frost.tsx` shows them.
- First-time setup: `src/lib/setup.ts` (turns the answers into a garden with `gardenFromSetup`, `starterIdeas` reuses the planner, `newInstall` makes the empty garden a new phone starts with; tested in `setup.test.ts`) and `src/screens/Setup.tsx` (`#/setup`, and `#/setup/try` for a try-out that saves nothing). A garden with `settings.needsSetup` always shows setup, except Settings (so a backup can be restored). The answers in progress are kept in IndexedDB (`setup-draft` extra). Gardeners and likes are saved as `settings.gardeners` and `settings.likes`.
- Planner: `src/lib/catalogue.ts` (built-in UK plant list, general advice) and `src/lib/plan.ts` (filtering and scoring).
- Data lives in IndexedDB (`src/lib/db.ts`) as one document (`GardenData` in `src/lib/types.ts`).
- All changes to the data go through small pure functions in `src/lib/actions.ts`.
- `npm install`, then `npm test` (logic tests), `npm run build` (makes `dist/`), and `npm run dev` (preview at http://localhost:5173).
- `.github/workflows/deploy.yml` tests, builds and publishes to GitHub Pages on every push to `main`.
- Urgent alerts: `src/lib/alerts.ts` (the push code, which forecast alerts to send at each check, sending each once; tested in `alerts.test.ts`), `src/lib/push.ts` and `src/screens/Notify.tsx` (the phone side: permission, keys made with WebCrypto, the push code kept in IndexedDB and never in backups). `.github/workflows/notify.yml` runs `scripts/notify.ts` twice a day with the `MARY_MARY_PUSH` secret, and remembers what it sent in the Actions cache. `scripts/webpush.ts` encrypts (RFC 8291) and signs (VAPID) the alert with Node's built-in crypto, so no extra packages; `webpush.test.ts` checks it against the RFC's worked example. The repo is public, so the script never prints the garden's place. GitHub turns off scheduled workflows after 60 days without a push to the repo.
- `public/sw.js` is the offline service worker, and shows alerts (`push`) and opens the app at the weather when one is tapped. The build stamps a version into it, so each publish replaces the old cache.
- Icons are drawn by `scripts/make-icons.mjs`, which needs `sharp`. The PNGs are committed, so this only needs running if the icon design changes.
