# Mary Mary: project history and handover

This file carries the context from the claude.ai "Mary Mary" project into Claude Code.
The main brief is in `CLAUDE.md`, in this same folder. This file records how the project got here and what has been decided so far.

_Last updated: 28 October 2026_

## What Mary Mary is

Mary Mary is a personal gardening app and companion for Stef, based in the UK. It helps keep on top of the garden day to day and plan it season by season. The project description is: "How does my garden grow? This is a gardening app and companion that helps me keep on top and plan my garden."

## Conversation summary so far

1. **Moving to Claude Code.** Stef asked how to turn the Mary Mary project into a Claude Code chat. We agreed on this approach:
   - Make a project folder on the computer, called `mary-mary`, on the Desktop.
   - Put a `CLAUDE.md` brief in it. Claude Code reads that file automatically at the start of every session.
   - Open the folder from the **Code** tab in the Claude desktop app, or with the Claude Code command-line tool.
   - Claude Code can't see claude.ai chats or projects. Anything it needs to know has to be in files in this folder.
2. **CLAUDE.md written.** A starter brief was written and placed in this folder. A copy is also saved in the claude.ai project. The brief covers:
   - the purpose, users and UK conventions
   - the features, in priority order
   - the product principles
   - a suggested setup, a sketch of the data the app stores, and working preferences
3. **This handover file.** It's here so Claude Code knows the background.

## Decisions made

- **Audience:** one home gardener (Stef) in the UK. Use metric units, UK spellings, and UK seasons and frost dates.
- **Feature order:**
  1. My plants
  2. Garden areas
  3. Care calendar and reminders
  4. Sowing and planting planner
  5. Journal
  6. Harvest log
  7. Garden layout plan
  8. Later: weather nudges and a wishlist
- **Principles:** quick to use outdoors on a phone; start simple; Stef's data is easy to export, with no lock-in; reminders are gentle rather than nagging.
- **Suggested setup (still open to change):**
  - a mobile-friendly web app or PWA built with React + TypeScript + Vite
  - data stored on the device first (IndexedDB)
  - tests for the date and reminder logic
- **How Stef wants to work:**
  - explanations in plain English
  - Claude asks before any big structural decision
  - small steps, getting one feature fully working at a time
  - a `README.md` kept up to date

## Open questions

- Confirm the tech stack (the React + Vite web app is only a suggestion so far).
- Whether the app needs to work across several devices (that would mean cloud sync later) or just one phone.
- Where to find UK sowing and frost-date data: entered by hand, a built-in table, or an online source.

## Next step

Set up the project and build the **My plants** list (add, edit and view plants), with data saved on the device.

## Notes

- This summary covers the chats that were visible when it was written. If other chats in the claude.ai project held more ideas, add them under "Decisions made" or "Open questions".
