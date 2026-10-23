# Game Codex

`webpages/game-codex.html` contains the Effects, Weapons, Accessories, and Artifact sets sections. `webpages/effects.html` redirects old links while preserving the query string and effect hash. Navigation, skill-effect links, and search use the new page. The team builder and damage tester remain separate and were not changed for this work.

The equipment source is [Mystical Legends Game Design](https://docs.google.com/document/d/1-95tvkDwbZnsN_vPy7gM4aJgFCXnzDQ2go8kIhIyAaw/edit), **Equipment and Support → Weapons / Accessories / Artifacts**, as modified October 19, 2026. The catalogue includes all four weapons, eight accessories, and eight artifact sets from those lists. Existing equipment IDs remain stable; previously missing items fill the remaining IDs. Accessory `a2` is now named Water Spirit Rune, with its former Water Spirit Stone name retained as a search alias.

## Editing equipment

- Edit `images/mlg-assets/data-weapon.json`, `data-accessory.json`, and `data-artifact.json`.
- `reference_sections` stores each item's Weapon Skill, Passives, set bonuses, and description as titled paragraph groups. These are the codex's prose source. `additional` retains equivalent text for existing inventory consumers.
- Embedded `[Effect] Type - …` definitions resolve at render time to `data-effects.json`, including every description paragraph, type, and icon. Keep the shared effect record current; the equipment copy is retained as source context but is not displayed. Both effect-list and embedded icons reserve an empty frame when artwork is absent or fails to load.
- In `reference_sections`, wrap only numbers bolded in the source notes in `<b class="codex-value">…</b>`. Equipment descriptions never highlight numbers automatically. Fixed counts, durations, costs, and unbolded percentages stay plain; small metadata stays muted even if markup is present. Source bold formatting was checked against the live Game Design document on October 23, 2026.
- `reference_stats` stores the exact level 1 and level 100 endpoints printed in the design document. Existing `stat_change_by_level` fields remain available to inventory calculations. The codex does not interpolate levels or simulate equipment.
- `set_bonuses` records two- and four-piece descriptions for future consumers. Four numbered piece-name and piece-image fields retain the existing artifact format.
- Set `weapon_img`, `accessory_img`, or optional `artifact_img` to a local image path. Artifact piece art uses `piece_num_1_img` through `piece_num_4_img`. Empty strings reserve blank image slots; existing artwork appears automatically when supplied. Failed images fall back to blank slots rather than broken-image icons.
- `equipment-rules.json` records the general progression, random-stat ranges, and fixed slot main-stat choices. No dummy equipment values or damage-test logic are included.

## Source gaps retained

Blade of Surging Seas has no defined Weapon Skill beyond its energy-gauge cost. Water Spirit Rune has no written passives. Three Mistywood piece names are unspecified. The Fire and Dark Runestones each list Attack for both stats; their entries preserve both values and display a source note. The Gathering Sickle's skill name matches the Icelorian Blade's in the document and is retained as written. Do not invent replacements for these gaps.

Holy Aura, Plant Tether, and Severance were added to the shared effect glossary from the equipment definitions. Their descriptions are reference information; this does not implement new damage-test behavior.

## Links and checks

Deep links use `#weapon-w1`, `#accessory-a1`, and `#artifact-o1`. Existing effect hashes such as `#shield` continue to work. Open a section directly with `?category=weapons`, `accessories`, `artifacts`, or `effects`.

After editing, run `python3 scripts/build-site-index.py`, `python3 scripts/check-content.py`, and `node --test tests/test-equipment-catalog.mjs tests/test-site-features.mjs`. Verify the desktop and mobile card layouts, filters, blank art slots, and effect links in the browser.
