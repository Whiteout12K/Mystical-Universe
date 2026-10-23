# Mystical Legends atlas

`../map.html` is the entry point. `locations.json` contains the editable district and story-location records. Coordinates use a 1200 × 680 SVG canvas. The Earth view is equirectangular: x = (longitude + 180) / 360 × 1200; y = (90 − latitude) / 180 × 600 + 40. Mainland pins mark the region named in the glossary, not a fictional country's surveyed capital or boundaries.

## Story sources

- [Volume 1: Beginning](https://docs.google.com/document/d/1eJ0IbGH6eT_aMIMVBa0XPJtOaPcAmK1M5rRoBmc5eUo/edit): Mystical Districts glossary establishes all thirteen names, populations, and locations; The Light of the City describes the hidden island, Arctic location, climate, mist barrier, harbor, and Regnum arrival.
- [Volume 2: Awakening](https://docs.google.com/document/d/1EcxLmkrS9PAL04ZozTc_x2rnrPfe9kvKuHoIWSBy_Pg/edit): Invasion by Fire places Pyrus's lair beneath the central volcanic mountain and its entrance in the forest between Districts 7 and 13.
- [Volume 3: Ascension in Rivalry](https://docs.google.com/document/d/1UIgn4NfXDgxeCi0KFMl8shI976_C8MRCk4JtZmhxfdo/edit) and [Volume 4: Initialization](https://docs.google.com/document/d/1jqDk_z7uLm8q8bau8AzMincx0jgLAggDmc7xZf69wk8/edit): Aquia estate, cohort training, IT, and the I.T.E.R. project.
- [Volume 8: The Messengers' Return](https://docs.google.com/document/d/1VVN7a2GNvKQFlRM9OwP1sUHhtAz6sUwRp8C_Xl8bYIg/edit): the glossary repeats the global district placement; Lux describes Luminia's demihuman population, Luces history, and ports; A Call of the Waters establishes Atalantia below the sea near the island.
- [Mystical Legends Notes](https://docs.google.com/document/d/1kd2s1mQsFFxVz2_8pVetnZ5pEd4PcOuvZEDmiBbWUZc/edit): Paradise's destruction and planned reclamation, District 13's black market and I.T.E.R. continuation, and District 6 / Imperium's military involvement.

Do not restore the former placeholder Regnum Province / District 2 placement. Regnum belongs in District 7, Lux Urbis. District 9 has no given name in the glossary; do not invent one. Exact island boundaries, relative compass directions, individual building coordinates, the drawn river, and vegetation symbols are cartographic illustration rather than new canon. Routes are narrative connections, not measured journey tracks. The mainland route references Levi's New York-to-island voyage. Neither travel times nor progress percentages are established.

`earth.svg` is a local rendering of public-domain Natural Earth 1:110m land, distributed as [world-atlas 2.0.2](https://github.com/topojson/world-atlas). Coastlines are clipped at the dateline and Antarctica is omitted. No third-party map API, tracking, remote fonts, or runtime CDN is needed.

## Checks

Run `node --test tests/test-world-map.mjs` from the repository root. Browser-check both views, a direct marker selection, the searchable directory, filters, labels, zoom/reset, keyboard activation, and mobile stacking. All destination links point to existing website files. `?view=island` and `?location=regnum` support direct map links.
