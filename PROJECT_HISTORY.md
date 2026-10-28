# Mary Mary: project history and handover

The main brief is `CLAUDE.md`, in this same folder. This file records how the project got here and what has been decided.

_Last updated: 28 October 2026_

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

## Decisions made

- **Audience:** Stef first, on one phone. Sharing with Cath (online database and invites) comes later and needs asking about first.
- **Weather:** Open-Meteo (free, no key).
- **Smarts:** a built-in UK advice table first. No AI service yet.
- **Tech:**
  - React + TypeScript, bundled with esbuild, not Vite. Claude's workspace can't reach the npm registry.
  - GitHub Pages via Actions, installed from Safari as a home-screen web app.
  - Data in IndexedDB, with JSON backup and CSV export.
- **Setback tips** are worded as general UK advice ("Net it from late spring…"). They don't promise features that aren't built yet.
- **How Stef works:** plain English, small steps, ask before big decisions, keep the README current. Stef uses GitHub Desktop and no command line.

## Open questions

- UK sowing and frost-date data: a built-in table (likely) or an online source.
- When to start sharing with Cath, and which online database to use (Supabase or Firebase free tier are candidates).
- Photos: storing them on the phone will grow the data. They need their own storage before the diary is built.

## Next steps

1. Stef: commit and push v0.2, add the postcode in Settings, and set aspect and colours on each area.
2. Then: this week's jobs (wireframe Jobs screen), the garden diary screen and supplies.
