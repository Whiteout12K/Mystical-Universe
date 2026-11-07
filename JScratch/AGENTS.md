# JScratch guidance

Read [README.md](README.md) before changing this engine or writing game programs.

JScratch is a JavaScript API inspired by Scratch blocks. `program/begin.js` defines startup/menu flow and `program/world.js` defines the playable World scene; `js/` implements the reusable engine. Preserve this separation. Do not rewrite the user's game or add scenes unless requested.

Keep the folder name and URL capitalization exactly `JScratch`. Shared website tools live in `../webpages/apps/`; the shared skill stylesheet lives in `../assets/css/mlg-skill.css`.
