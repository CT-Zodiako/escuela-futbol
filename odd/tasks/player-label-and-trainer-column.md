# Player labels and trainer column

## Goal
Show each player's trainer in the initial roster and use “Jugador” instead of “Estudiante” in user-facing web copy.

## Tasks
- [x] Load trainers alongside the roster and render the trainer in desktop/mobile roster views.
- [x] Replace user-facing student labels and messages with player terminology.
- [x] Run focused frontend checks and record the work-unit commit.

## Acceptance criteria
- The initial roster shows the assigned trainer, or an em dash when no trainer is assigned.
- The player terminology appears consistently in visible web labels, messages, headings, and table columns.
- Existing API/database identifiers and internal component names remain compatible.

## Notes
- Trainer IDs already exist on Student records and trainers are available through `api.listTrainers()` for both web and desktop.
- This change intentionally does not rename database tables, API fields, or internal code symbols.
- Validation: `cd apps/web && npm run build` passed (`tsc -b` + Vite build). `grep -i estudiante apps/web/src` found no matches.
- Delivery: committed in `8d6082e` (`feat(reports): add trainer roster and Excel export`).
