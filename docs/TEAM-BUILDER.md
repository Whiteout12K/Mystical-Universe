# Team Builder

`ml-game/apps/team_builder.html` retains the character cards, built-in presets, bonds, support slot, and ability previews. `js/site-enhancements/team-builder.js` adds planning controls; `team-builder-model.js` validates plans and supplies conditional guidance. Styles live in `css/team-builder.css`.

## Selections and persistence

Each plan has three ordered main-team slots, one distinct support, a Resonance owner/Technical Skill, per-character personal Technical Skills, and per-character equipment. Gear stays with a character when positions swap. Removing/replacing a character removes their gear from the current plan. Built-in presets reset equipment. Character choices support keyboard selection and a searchable picker with a compact current-team strip on mobile.

Weapons respect `weapon_type` and the currently documented Angelor restriction. Accessories are unrestricted. Four artifact selectors correspond to Headgear, Chestplate, Leggings, and Boots. Matching piece counts activate the defined two/four-piece descriptions; a full-set selector fills all four slots. Equipment and bonus links open the Codex. These are selection previews and do not calculate final stats or damage.

Named teams (up to 50) and the latest draft are stored locally under `ml-team-plans-v1` and `ml-team-draft-v1`. Save/update and delete are explicit actions. A versioned `#team=` URL includes every selection and is preferred over the draft on initial load. Shared input is bounded, parsed, and validated against real roster, skill, and equipment IDs. Duplicate characters and incompatible gear are discarded. Storage failures show a message with the share-link alternative. Equipment-load failure prevents overwriting saved plans with incomplete gear data. Saved teams are browser-local, not account saves.

## Explanations and source limits

Overview contributions come from the character's role, affinity, and specialty fields. Skill evidence comes from local `Characters/Cn/cn.json` descriptions. Exact character bonds still use `character_synergies`; matching affiliation alone is not presented as a numeric buff.

Resonance guidance shows the skill's written Resonance clause, owner-presence rules, and explicit species/element exceptions for Transformation, Enlightened Mode, Ice Travel, Infinity Beans, and Flame Reincarnation. Cohort, Surge, lightning, and unlocked-infusion conditions remain conditional rather than guessed as active. Personal Technical Skills can differ from Resonance. Support placement is not treated as main-team presence for activating Abilities. Missing skill files remain clearly labeled, while roster-valid shared Technical Skill selections are retained.

Specific interaction explanations cover Light/aura pairing, cohort conditions, Shield equipment interactions, Icelorian Freeze/Flash conditions, Mistywood, and healing-rate conversion. They link to source skills or equipment and do not claim that matching affinities or selected equipment automatically activate conditional buffs. The damage tester remains separate.

## Verification

Run `node --test tests/test-team-builder.mjs tests/test-site-features.mjs tests/test-equipment-catalog.mjs`. Browser checks should cover saving/loading/deleting a named team, draft reload, opening a share URL in a fresh page, weapon restrictions, mixed and full artifact sets, personal versus shared Technical Skills, swaps retaining gear, and mobile character search/slot switching.

## Simplified overview

The overview displays every unique character specialty without a disclosure. Abilities appears above the overview and keeps its original controls. The loadout editor, How this team works panel, and Resonance description panel have been removed. The original Resonance picker remains available beside the team cards. Equipment/Technical Skill fields from existing saved plans remain compatible, but have no overview editor.

## Share-only controls

The header toolbar now contains only Copy team link. Team naming, the saved-team dropdown, save/update/delete buttons, and New team were removed along with the named-team storage code. The current draft still restores automatically, and existing shared links remain compatible. Previously stored named teams are left untouched in browser storage.
