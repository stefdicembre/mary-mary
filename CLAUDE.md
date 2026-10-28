# Mary Mary — garden companion app

> "Mary, Mary, quite contrary, how does your garden grow?"

Mary Mary is a personal gardening app and companion for Stef. It helps keep on top of the garden day to day and plan it season by season.

## Who it's for

- A single home gardener (Stef), based in the **UK (Europe/London)**.
- Use UK conventions: metric units (cm, m, °C), UK spellings, UK seasons and frost dates, and UK plant names alongside the Latin ones.
- It should feel friendly and calm, like a helpful gardening friend rather than a farm-management tool.

## Core features (in rough priority order)

1. **My plants** — a list of everything in the garden: name, variety, Latin name, where it's planted, date planted, source (seed, plug, cutting, shop), photos and notes.
2. **Garden areas** — beds, borders, pots, greenhouse, veg patch and so on. Each area holds plants and can record sun/shade and soil type.
3. **Care calendar & reminders** — watering, feeding, pruning, deadheading, sowing, pricking out, hardening off, planting out and harvesting. Show what's due this week.
4. **Sowing & planting planner** — month-by-month guidance on what to sow or plant (indoors or outdoors), based on UK timings and the last and first frost dates.
5. **Garden journal** — dated notes and photos about what happened, what worked and what didn't. Searchable by plant or area.
6. **Harvest log** — what was picked, when and how much.
7. **Garden plan / layout** — a simple visual map of beds and what's in them, with year-on-year history to help with crop rotation.
8. *(Later)* Weather-aware nudges, such as frost warnings or "no need to water, it rained", and a wishlist or shopping list.

## Product principles

- **Quick to use outdoors.** Logging a task or note should take seconds, on a phone, with muddy hands.
- **Simple first.** Start with plants, areas and reminders. Add the rest gradually.
- **The data belongs to Stef.** Data should be easy to export (CSV/JSON), with no lock-in.
- **Gentle, not naggy.** Reminders should be helpful and easy to snooze or skip.

## Suggested tech approach (open to change)

- Start as a **mobile-friendly web app**, ideally a PWA so it can be installed on a phone.
- Keep the stack simple and well known, for example **React + TypeScript + Vite**.
- Store data locally first, for example in IndexedDB. Add cloud sync later only if needed.
- Use plain, readable code with small components. Avoid heavy frameworks unless they clearly help.
- Write tests for the date and reminder logic. That's where bugs would hurt most.

## Data model sketch

- **Plant**: id, commonName, variety, latinName, areaId, plantedOn, source, notes, photos[]
- **Area**: id, name, type (bed / pot / greenhouse / border), sun, soil, notes
- **Task**: id, plantId?, areaId?, type (water / feed / prune / sow / harvest / …), dueOn, repeat, doneOn?
- **JournalEntry**: id, date, text, plantIds[], areaIds[], photos[]
- **Harvest**: id, plantId, date, quantity, unit, notes

## How to work with me (notes for Claude)

- I'm building this for myself, so **explain things in plain English** and don't assume deep coding knowledge.
- **Ask before** making big structural decisions, such as changing the stack, adding a backend, or adding paid services.
- Work in small steps. Get one feature working end to end, show it, then move on.
- Keep a short `README.md` up to date explaining how to run the app.
- When gardening advice is built in (sowing times, care tips), aim for UK accuracy and note where advice is general.

## Current status

- Nothing has been built yet. This file is the starting brief.
- **First step:** set up the project and build the **My plants** list (add, edit, view) with local storage.
