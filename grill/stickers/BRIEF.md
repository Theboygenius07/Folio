# Grill stickers: brief

Seyi's portfolio hero is a photo of him, from above, pulling his lip down to show a
silver grill. Each tooth is a link to one project. Each tooth needs its own illustrated
sticker: a small picture that tells you what the project is at a glance. Not the
project's logo.

## The set

- 13 stickers, one per project, all drawn in the same hand so they read as one set.
- Each sticker is an object or scene from that project, not a brand mark.
- Each sticker has its own shape. They should not all be circles.
- Treat them as real die-cut vinyl stickers: a bold illustration with a thick white
  die-cut border around the outside edge, so it reads on both silver and white enamel.
- Use a few flat colours per sticker with a dark outline. Lean on each project's own
  colour (listed below). No gradients, no text except where noted, no tiny detail.

## Size and legibility

- On a phone a tooth is about 30 to 50 px wide. On desktop it's about 75 to 140 px.
- When you click a tooth the camera dives in about 4 times closer.
- So each sticker must read as a silhouette at 30 px and still reward a close look at
  500 px.

## Shapes

- `templates/NN-slug.svg` is the outer edge of each tooth, scaled to 400 px on its
  long side. `teeth-map.jpg` shows where every tooth sits in the mouth.
- Open-face teeth have a silver rim about 12% of their width, with white enamel inside.
  The sticker goes on the white, inside the rim.
- Solid silver teeth (03, 04, 07, 12, 13): the sticker goes on the metal.
- Keep each sticker inside about 70% of its tooth, centred, so the rim and some tooth
  show round it.

## Output

- One SVG per project in this folder, named `NN-slug.svg` (for example `01-redbrick.svg`).
- Use a transparent background with a viewBox fitted to the sticker itself, not the tooth.
- Use plain vector shapes only: no embedded raster, no fonts, no filters.

## The projects

| No. | Tooth | Project | What it is | Colour | Sticker ideas |
|---|---|---|---|---|---|
| 01 | open, big front tooth | Redbrick | A 3D map of a university campus in the browser, built from OpenStreetMap and LIDAR (Three.js) | #a3381d | a red-brick building on a little map tile; a stack of bricks with a map pin |
| 02 | open, big front tooth | Interfaze | A redesign of an AI developer-tools website (Next.js, design system, Lighthouse scores) | #00bfa6 | a browser window with a teal interface; a perfect-score gauge |
| 03 | solid silver | Wire | Turns one sentence into a payment page, and any API into tools an AI agent can use | #e0f61c | a plug and cable; a lightning-yellow wire in a knot |
| 04 | solid silver | Cohort | A waitlist page for Cohort (a startup for students): a letter, a pull-chain lamp, a phone that burns in | #3358ff | the pull-chain lamp; a sealed letter |
| 05 | open | Tiwari Town | A walkable 3D world made as a birthday gift: a dog made of spheres, boat races, Connect 4 | #4a9fe0 | the sphere-dog; a little island with a boat |
| 06 | open | Saleena Tiwari | A scroll-driven 3D birthday gift: a statue with 21 memories spiralling round her like a staircase | #7a9c6f | a spiral staircase of cards; a small statue |
| 07 | solid silver | Subtitles | 42 photos, each with a line burned in like a film subtitle; you can browse with your hand | #6c5ce7 | a film frame with a subtitle bar; an open hand |
| 08 | open | KULTURE* | A party site framed as a flight: a boarding pass you can tilt and sign, a departures board | #c8a94a | a boarding-pass stub; a plane with an asterisk |
| 09 | open | Clark | An AI study workspace: flashcards, a streak, a lanyard badge | #ff5b1f | a flashcard; a flame streak; a lanyard badge |
| 10 | open | Cohort / Raise | Cohort's investor page: a short letter instead of a deck, with a network graph that grows | #4b63ff | a network of dots and lines; a fountain pen |
| 11 | open | Seyi's Park | A park in the browser built from one Blender file; you hop a character between billboards | #3a8f3a | a tree beside a billboard; a little hopping character |
| 12 | solid silver, smallest | Saleena | A one-page gift in German, Nepali and English, with drawings that open when you point at them | #e07ba0 | a heart; a folded note (keep it very simple: this tooth is the smallest) |
| 13 | solid silver, by the pinky | Fragments | Seyi's archive of writing (he is an award-winning writer) | #c8a94a | a torn page; a fountain-pen nib |

These sticker ideas are starting points. Better ideas are welcome, as long as each one is
specific to its project.
