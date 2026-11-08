# Mary Mary: project history and handover

The main brief is `CLAUDE.md`, in this same folder. This file records how the project got here and what has been decided.

_Last updated: 8 November 2026 (v1.1)_

## What Mary Mary is

Mary Mary is a personal gardening app and companion for Stef (UK), who gardens with Cath. It helps keep on top of the garden day to day and plan it season by season. Project description: "How does my garden grow? This is a gardening app and companion that helps me keep on top and plan my garden."

## Timeline

1. **11 to 25 Oct 2026: brief and wireframes.** Product brief written. Wireframes designed in the claude.ai Design canvas "Mary Mary: home screen" (https://claude.ai/artifact/MhdEt4dfEphpKfEUdAjFUp), with 31 phone screens.
2. **28 Oct: CLAUDE.md and this handover** written for working in Claude Code / Cowork.
3. **28 Oct: plants that don't make it.** Setback feature designed: struggling / died / pulled out, optional reasons, own words kept exactly, diary entry, lessons shown when replanting.
4. **28 Oct: publishing plan.** Guide written as a Claude Doc, "Mary Mary: from wireframes to your iPhone" (https://claude.ai/artifact/HtEKuzk7Ma2iRhSHF9LujG).
   - Stef created the GitHub account and installed GitHub Desktop.
   - Stef made the `Desktop\mary-mary` folder (Windows, OneDrive) and published it to https://github.com/stefdicembre/mary-mary
5. **28 Oct: version 0.1 built.**
   - Home, garden areas (Stef's 8 pre-filled), plants, "Not doing well" setbacks, Didn't make it, backup/export/restore, offline install, and the GitHub Pages workflow.
   - 8 logic tests pass. Clicked through end to end on an iPhone-sized screen.
   - Files copied into the folder. The `.github/workflows/deploy.yml` file is protected from remote writes, so it was sent to Stef to place by hand.

6. **28 Oct: went live.**
   - The repo was made public, which is needed for free GitHub Pages.
   - Stef placed `deploy.yml`, committed and pushed. The app is installed on the iPhone and "feels good so far".
7. **28 Oct: version 0.2, weather and planting plan.**
   - Weather uses postcodes.io and Open-Meteo, with frost, heat, wind, rain and dry-spell advice and a list of tender plants to protect.
   - The planting plan uses a built-in UK catalogue of about 75 plants and follows aspect, colours, soil and setback lessons. It has Planned, Planted it and Not for me.
   - 22 tests pass, and an end-to-end click-through passed using a pretend forecast.

8. **28 Oct: v0.2 committed and pushed by Stef.**
9. **28 Oct: version 0.3, jobs and garden diary.**
   - Seasonal UK job calendar matched to the garden, plus own jobs. The diary has photos, filters and search.
   - 33 tests pass, plus an end-to-end click-through including a full-size photo.

10. **v0.3 pushed** and on the iPhone (confirmed 8 Nov).
11. **8 Nov: version 0.4, garden layout plan.** Stef chose "map, then bed plans" over pins on a photo.
    - Whole-garden map with draggable, resizable areas and features, garden size and north.
    - "What's where" bed plan per area, linked to plants and planned plants.
    - 44 tests pass. Clicked through on an iPhone-sized screen, including touch drag, resize and page scrolling.

12. **v0.4 pushed** (confirmed 8 Nov).
13. **8 Nov: version 0.5, supplies.** Built from the wireframe Supplies screen.
    - What's in the shed, with levels, "Needed for" this week's jobs, and a shareable shopping list.
    - Jobs use up supplies when ticked off (small jobs add up, big jobs drop a level), and Undo puts them back.
    - 51 tests pass. Clicked through on an iPhone-sized screen.

14. **v0.5 pushed** (confirmed 8 Nov).
15. **8 Nov: version 0.6, harvest log.** Stef chose easy sizes (with count and weight optional), fruit, veg and herbs only (no cut flowers), and diary optional and off by default.
    - Log with year-so-far totals and last-year comparison, a quick "I picked something" form, a Harvest card on plant pages, "+ Harvest" after picking jobs, and a CSV export.
    - 61 tests pass. Clicked through on an iPhone-sized screen.
    - First time the changed files were written straight into Stef's `Desktop\mary-mary` folder (Stef granted folder access), instead of being sent for copying by hand.

16. **v0.6 pushed** (confirmed 8 Nov).
17. **8 Nov: version 0.7, plant pages linked to the bed plan.**
    - "Where it is" card on each plant page: mini bed plan, rough position, what's next to it, and a tap through to the bed plan with that plant picked. "Give it a square" for plants not placed yet.
    - 63 tests pass. Clicked through on an iPhone-sized screen.

18. **v0.7 pushed** (checked in the folder on 8 Nov: `main` matches GitHub).
19. **8 Nov: checkpoint against the 31 wireframe screens.**
    - Built (23): Home, the 8 area pages, Planting plan, Jobs, Settings, Weather, Menu, Garden diary and the 8 area-filtered diaries, Supplies.
    - Partly built (2): **Urgent warnings** (frost, heat and wind are urgent; heavy rain only shows as ordinary advice) and **Out in the garden** (only the "One thing at a time" card on Home, not the full-screen walk-round with "Take with you", how-to steps, notes and "What else did you do?").
    - Not built (6): **First-time setup** (skipped because Stef's areas were pre-filled), **Welcome back**, **Notifications** (needs push, a later phase), **Going away** and **Going away: Cath's phone** (parked).
    - Stef parked going-away mode: not wanted for now.
20. **8 Nov: version 0.8, frost dates and sowing times.** Stef chose "both": local frost dates from past weather, and sow indoors / sow outside / plant out shown separately.
    - Frost dates come from about 10 years of Open-Meteo weather history (free, no key). A night of 2°C or below counts as a frost risk, and the dates are right in 8 years out of 10. They're worked out in the background once a postcode is set, and can be changed by hand in Settings (early/mid/late + month).
    - The planting plan shows Sow indoors / Sow outside / Plant out for seed-grown plants. Frost jobs (sow tomatoes, new "sow courgettes, squash and beans", harden off, plant out tender, bring tender plants in, lift dahlias) follow the garden's dates. Planned plants show their next step.
    - 70 tests pass. Clicked through on an iPhone-sized screen with pretend weather and history (the real history service can't be reached from Claude's workspace).

21. **8 Nov: version 0.9, urgent alerts on the lock screen.** Stef chose GitHub to send them (free, no new account) and urgent only: frost tonight, storms and heatwaves, no daily nudge.
    - Settings → Notifications turns them on and makes a private push code that Stef pastes into GitHub as the `MARY_MARY_PUSH` secret. A test alert can be sent from GitHub's Actions tab.
    - GitHub checks the forecast at about 6am and 3pm every day and sends each alert once. Frost alerts name the tender plants.
    - No extra packages: the encryption uses Node's built-in tools and matches the standard's worked example. 78 tests pass. Clicked through on an iPhone-sized screen with stand-ins for the phone's notification parts.

22. **8 Nov: version 1.0, first-time setup.** Stef chose: it runs on a new install (instead of pre-filling the eight areas), with "Try first-time setup" and "Start afresh" in Settings; parts that need things not built yet are shown greyed out as "Coming soon".
    - Garden name, who's gardening, where it is, areas, what's growing in each, "Not much planted yet?" starter plants (from the planting plan's catalogue), and what matters most (remembered and pre-ticked on the planting plan).
    - Coming soon: joining a garden and invites, photo recognition, the phone's compass, everyday nudges and quiet time.
    - Start afresh offers a backup first and only replaces the garden at Finish. A half-done setup picks up where it left off.
    - 85 tests pass. Clicked through on an iPhone-sized screen: a new phone end to end, a try-out (garden unchanged), and Start afresh.

23. **8 Nov: version 1.1, sharing a garden and invites.** Stef chose Supabase (free online database), invite code only (no email sign-in), and everyone who joins can do everything.
    - Settings → Sharing → "Share this garden" puts it online. "Make an invite code" gives a code like ROSE-482193 (works once, for a week) and "Send the invite" sends it with instructions. On a new phone, "Been invited? Join a garden" and the code.
    - Both phones keep their own copy and catch up with each other (on opening, every 30 seconds, and just after a change). Changes made on both are merged; only the very same thing changed on both goes to the later one. Diary photos are shared too. Your own name stays on your phone.
    - Who's in, removing people (the person who started it), waiting invites, Leave / Stop sharing (everyone keeps their copy).
    - The database rules were tested on a real Postgres; the app was tested with two pretend phones and a pretend Supabase (104 tests, 26-step click-through).
    - Stef created the Supabase project the same day, and its URL and publishable key were put in `src/lib/cloudConfig.ts`.

## Decisions made

- **Audience:** Stef first, on one phone. Sharing with Cath added in v1.1 (8 Nov).
- **Sharing (8 Nov):** Supabase free tier, used through its plain web addresses (no extra packages). Phones sign in anonymously; an invite code (single use, 7 days) lets a phone into a garden. Everyone in a garden can change everything; the owner can remove people. The whole garden is one document with a version number; clashes are merged on the phone.
- **Weather:** Open-Meteo (free, no key).
- **Smarts:** a built-in UK advice table first. No AI service yet.
- **Tech:**
  - React + TypeScript, bundled with esbuild, not Vite. Claude's workspace can't reach the npm registry.
  - GitHub Pages via Actions, installed from Safari as a home-screen web app.
  - Data in IndexedDB, with JSON backup and CSV export.
- **Setback tips** are worded as general UK advice ("Net it from late spring…"). They don't promise features that aren't built yet.
- **How Stef works:** plain English, small steps, ask before big decisions, keep the README current. Stef uses GitHub Desktop and no command line.
- **Going-away mode is parked** (8 Nov). Don't build it unless Stef asks.
- **Notifications (8 Nov):** GitHub Actions sends them (no backend). Urgent only for now. Timing is loose (GitHub can be up to 30 minutes late), and GitHub pauses scheduled runs after 60 days without a push.
- **Edit files in place:** changes go into the existing files (in the app folder and in these project notes), never as new copies.

## Open questions

- Sharing: settled in v1.1 (Supabase). Next could be "who's doing it" on jobs.
- Photos: settled in v0.3. They're shrunk and kept in their own IndexedDB store, and included in backups.

## Next steps

1. Stef: Commit and Push v1.1 in GitHub Desktop.
2. Stef: set up Supabase (README → "Sharing a garden: setting it up") and give Claude the Project URL and publishable key. Claude puts them in `src/lib/cloudConfig.ts`; then try it with Cath's phone.
3. Then: "who's doing it" on jobs, or the wireframe gaps (the full "Out in the garden" mode, heavy rain as an urgent warning, Welcome back).
