# Case studies

Deep-dive design-engineering case study pages — one per project — built to live
inside the portfolio without touching the main page's `styles.css` / `script.js`.

## Files

```
case-studies/
├── case-study.css     ← shared editorial styling (per-project tint)
├── case-study.js      ← shared interactions (progress bar, reveals, magnetic, clock)
├── cohort.html        ← 01  tint #3358ff
├── raise.html         ← 02  tint #4b63ff
├── seyis-park.html    ← 03  tint #5a8f5a
├── kulture.html       ← 04  tint #c01920
├── subtitles.html     ← 05  tint #6c5ce7
└── saleena.html       ← 06  tint #d98aa6
```

## How a page works

Every page is one HTML file that links `case-study.css` + `case-study.js` and sets
its accent colour on the body:

```html
<body style="--tint:#3358ff">
```

That single variable drives the progress bar, section numbers, links, callout rules,
chip hovers, and gradient placeholders. The tints match each project's `data-tint`
in the main `index.html`.

## Template structure (the "deep dive")

The same skeleton repeats on every page so they read as a series:

1. **Nav** — back to `../index.html#work` + project mark
2. **Hero** — index, title (serif, with `<em>` emphasis), lede, `<dl class="cs-meta">` (Role / Scope / Year / Stack / Live)
3. **Cover** — `.cs-cover` figure
4. **01 Overview** — what it is, the thesis
5. **02 Problem** — constraints, `.cs-pull` quote
6. **03 Process** — `.cs-steps` numbered
7. **04 Design decisions** — `.cs-cols` of `.cs-card`
8. **05 Engineering** — prose + `.cs-chips` stack
9. **06 Outcome** — `.cs-stats`
10. **07 Gallery** — `.cs-gallery` (`.wide` / `.tall` modifiers)
11. **Next** — dark band linking the next case study, footer with live clock

## Adding images

Placeholders render a gradient + label until you drop in real assets. Replace:

```html
<figure><span class="placeholder">Cover — hero shot</span></figure>
```

with:

```html
<figure><img src="../images/cohort.png" alt="Cohort hero" /></figure>
```

Project shots already referenced by the main page live in `../images/`
(`cohort.png`, `raise.png`, `seyispark.png`, `kulture.png`, `subtitles.png`, `saleena.png`).

## Wiring up the main page (not done — left to avoid clashing with the other agent)

The project rows in `../index.html` currently link straight to the live sites. To make
each row open its case study instead, point `.project__row` `href` at the matching file,
e.g. `href="case-studies/cohort.html"`. Left untouched so it doesn't collide with the
in-progress `styles.css` / `script.js` work on `index.html`.

## Content status

Cohort, Raise, and KULTURE are written from real project briefs. **Outcome** stats use
real figures supplied by Seyi:

- Cohort — 2,083 waitlist signups, 3 schools
- KULTURE* — 430 tickets sold, sold out in 5 days (500 cap)
- Subtitles — 1,000 visitors in 2 days
- Saleena — 3 languages (English, German, Nepali)
- Seyi's Park — qualitative (runs at 60fps target on the web)
- Raise — qualitative (unlisted investor narrative)
