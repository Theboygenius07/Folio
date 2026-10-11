# Case studies

One page per project, built to the bar set by redbrick.ink/about: the real work in the
hero, a narrow reading column a third of the way in, centred headings and notes, and a
lot of white space. Every section has 2 to 4 short paragraphs and one figure you can
touch, and most of those figures run the project's own code with its original numbers.

Type is Redbrick's: the system UI face for headings and paragraphs. Interactive figures
float on the paper, with no boxes, gradients, glows or entrance fades. Motion is used
only where it explains something.

## Pages

| No. | Page | Live figures, ported from the project's code |
|---|---|---|
| 001 | Redbrick | its own about page, redbrick.ink/about |
| 002 | Interfaze | its own write-up, interfaze-redesign.vercel.app/redesign |
| 003 | `wire.html` | curl to tool compiler, typewriter timing, Flow's 4 shapes, dashboard, dot grids, commit timeline |
| 004 | `cohort.html` | burn shader, the lamp (re-themes this page), chips, easter eggs, sky, Web Audio sounds |
| 005 | `tiwari-town.html` | terrain map, procedural dog, gait, light moods, narration queue, Connect 4 AI, race start, movement check, the gate |
| 006 | `saleena-tiwari.html` | 3D staircase with camera path, 5 failed approaches, card paths, keyframes, fog, flex shader |
| 007 | `subtitles.html` | hand control for the whole page (MediaPipe), globe and spiral, strip spring, canvas, focus card, corridor walk, pipeline |
| 008 | `kulture.html` | the ticket, tilt curves, sideways hero, font cycle, flip board, velocity marquee, lineup, print passes, backdrop generator |
| 009 | `clark.html` | lanyard badge physics, composer, onboarding, flashcard flip, empty and full states, streak (rebuilt from the designs, since there's no code) |
| 010 | `raise.html` | force graph with its forces drawn, clock, the wall, pen strike, phone burn, copy button. No investor figures. |
| 011 | `seyis-park.html` | the GLB by node name, tunable hop, hidden collision floor, sound board, night transition |
| 012 | `saleena.html` | reveal drawings, one reveal taken apart, language map, phone note timing, image effect modes |

The next links loop: Wire, Cohort, Tiwari Town, Saleena Tiwari, Subtitles, KULTURE*,
Clark, Raise, Seyi's Park, Saleena, and back to Wire.

## Files

```
case-studies/
├── study.css        the shared system (12-column grid, text in column 4 / span 6)
├── study.js         lazy videos, live windows, scrollytelling, reel chapters, contents
├── <slug>.html      one page per project
├── <slug>/          that page's own page.css, page.js, modules and assets
├── media/<slug>/    web-sized stills (webp)
└── fonts-kulture/   the two KULTURE* faces the ticket needs
```

## The shared system

- `window.Study`:
  - `.reduce` and `.hover`
  - `.onVisible(el, start, stop)`: build late, pause off screen
  - `.raf(fn)`: one shared animation loop
- Live figures: `.stage` (floats on the paper), `.stage-canvas`, `.stage-bar`.
- Controls: `.tabs` (Redbrick's text tabs), `.scrub` (slider), `.readout` (live parameters in mono), `.link-btn`.
- Scrollytelling: `.scrolly` > `.scrolly-steps` > `.step` + `.scrolly-fig`. The step in view gets `.is-on`, and a `step` event fires.
- Reels: `.reel[data-chapters]` is full bleed with chapter bars. Add `.reel--band` when the recording is light or busy, so the caption moves to a solid band under it.
- Contents: `.toc` sits in the left margin at 1360px and up. It steps aside whenever a wide figure passes under it. Mark any wide element the selector list misses with `data-wide`.
- Text blocks: `.note`, `.quote`, `.rows`, `.process`, `.facts`, `.ba`, `.keys`, `.live`.

## Rules for the copy

- These pages are for employers: lead with the impact and the craft.
- Every number comes from the project's code, its docs, or a figure Seyi supplied.
- No em dashes in prose. Write numerals, not words.
- No bylines or credit lines, no who-did-what, and no commit, git or AI-tooling detail.
- No "What I'd do next" sections, and no internal or business state: deploy status, pending decisions, TODOs, bugs in the original.
- The Cohort / Raise page describes the design only. The investor figures stay on the real page.
- Saleena, Saleena Tiwari and Tiwari Town are personal gifts. They show no private documents, and nothing of her beyond what her public pages already show.

## Previewing locally

Python's built-in server ignores range requests, so videos can't seek there. Use a
server that supports them (Vercel does) if you want to check the reel chapters.
