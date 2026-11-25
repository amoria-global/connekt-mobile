# Photobooks translations: for native review

Source of truth: `src/features/photobooks/copy.ts` (a byte-identical copy lives in the dashboard at `lib/photobookCopy.ts`).
English is the reference. Kiswahili (sw), Kinyarwanda (rw), French (fr) and Spanish (es) were drafted, **not yet reviewed by a
native speaker**. A key a language does not have yet falls back to English, so nothing is ever blank.

Review order (what users read most):

1. Status labels: `st_*` (Draft, With photographer, Photographer editing, Payment needed, Ready to review, Completed,
   Closed by photographer, New to edit, Changes requested, Waiting for payment, Waiting for review).
2. Source chips: `src_*` and `chip_*` (Event album, Free album, Purchased, Content, My album).
3. Actions: `act_*`, `accept_*`, `changes_*`, `confirm_*`.
4. Timeline: `tl_*`.
5. Everything else (picker, empty and error states, notes).

Points to check with a native speaker:

- rw: "Igisubizo" for Draft may read as "answer"; a better word for a draft book is probably "Igishushanyo" or "Ikiri gutegurwa".
- rw/sw: "Content" is rendered as "Ibirimo" / "Maudhui" (the album category). Confirm it is the word the content albums already use in the app.
- sw: "Albamu za picha" is used for Photobooks (the app's existing word elsewhere may differ).
- All four: "Closed by photographer" must read as an action the photographer took, not an error.
- Keys with no translation yet in sw/rw: `name_placeholder`, `list_empty_guest` and the few new helper lines at the end of the file (`pay_on_web`, `move_hint`, `move_cancel`, `save_done`, `photographer_only_own`, `closed_ok`). They show in English.
