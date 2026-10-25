#!/usr/bin/env node
/**
 * The grill's 13 die-cut stickers, drawn by code in one hand: flat colours (each project's own leading), one
 * navy outline weight, depth from a darker shade of the same colour (never a gradient), no text, no filters.
 * The white die-cut border is cut by the browser from each drawing's own silhouette (every shape grown by
 * the border's width), with a faint edge line outside it so the white still reads on white enamel. Each
 * viewBox is fitted to its sticker.
 *
 *   node source/stickers.mjs            → NN-slug.svg beside BRIEF.md, and source/preview/*.png
 * (run from the stickers folder; needs Playwright: it uses cutroom's copy)
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '..')
const require = createRequire('/Users/user/Projects/cutroom/package.json')
const { chromium } = require('playwright')

/* the set's hand */
const INK = '#1E2B40', W = '#FFFFFF', CREAM = '#FFF6E6', OL = 9
const BORDER = 22, EDGE = 3, EDGE_COL = 'rgba(30,43,64,0.30)'
const shade = (hex, f = 0.72) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * f).toString(16).padStart(2, '0')).join('')
const tint = (hex, f = 0.45) => '#' + [1, 3, 5].map((i) => { const v = parseInt(hex.slice(i, i + 2), 16); return Math.round(v + (255 - v) * f).toString(16).padStart(2, '0') }).join('')
const o = (extra = '') => `stroke="${INK}" stroke-width="${OL}" stroke-linejoin="round" stroke-linecap="round" ${extra}`
const poly = (pts) => 'M' + pts.map((p) => p.join(' ')).join('L') + 'Z'
const rr = (x, y, w, h, r) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"`
/** a thick line drawn the set's way: navy outside, colour inside */
const tube = (d, w, col) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + OL * 2}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`

const STICKERS = []
const add = (id, slug, colour, art) => STICKERS.push({ id, slug, colour, art: art(colour) })

/* 01 Redbrick — a red-brick university building with its clock tower, standing on an isometric map tile */
add('01', 'redbrick', '#a3381d', (c) => {
  const iso = (cx, cy, a, b) => ({ L: [cx - a, cy], F: [cx, cy + b], R: [cx + a, cy], B: [cx, cy - b] })
  const up = (p, h) => [p[0], p[1] - h]
  const t = iso(200, 322, 150, 60), b = iso(200, 300, 86, 34), H = 118
  const T = iso(200, 300 - H, 30, 12), TH = 78
  const face = (P, Q, u0, u1, v0, v1, h) => { const at = (u, v) => [P[0] + (Q[0] - P[0]) * u, P[1] + (Q[1] - P[1]) * u - h * v]; return poly([at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)]) }
  const windows = (P, Q, col) => [[0.14, 0.38], [0.6, 0.84]].flatMap(([u0, u1]) => [[0.16, 0.4], [0.56, 0.8]].map(([v0, v1]) => `<path d="${face(P, Q, u0, u1, v0, v1, H)}" fill="${col}" ${o('stroke-width="6"')}/>`)).join('')
  const mortar = (P, Q) => [0.25, 0.5, 0.75].map((v) => `<path d="M${P[0]} ${P[1] - H * v}L${Q[0]} ${Q[1] - H * v}" stroke="${tint(c, 0.35)}" stroke-width="3.5" stroke-linecap="round" opacity="0.8"/>`).join('')
  const apex = [200, 300 - H - TH - 52]
  return `
  <path d="${poly([t.L, t.F, t.R, [t.R[0], t.R[1] + 20], [t.F[0], t.F[1] + 20], [t.L[0], t.L[1] + 20]])}" fill="#4E8A4A" ${o()}/>
  <path d="${poly([t.L, t.F, t.R, t.B])}" fill="#7FB069" ${o()}/>
  <path d="M86 300 L148 324 L178 312" fill="none" stroke="${CREAM}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${poly([b.L, b.F, up(b.F, H), up(b.L, H)])}" fill="${c}" ${o()}/>
  <path d="${poly([b.F, b.R, up(b.R, H), up(b.F, H)])}" fill="${shade(c)}" ${o()}/>
  ${mortar(b.L, b.F)}${mortar(b.F, b.R)}
  ${windows(b.L, b.F, CREAM)}${windows(b.F, b.R, tint(c, 0.55))}
  <path d="${poly([up(b.L, H), up(b.F, H), up(b.R, H), up(b.B, H)])}" fill="#3D4A5C" ${o()}/>
  <path d="${poly([T.L, T.F, up(T.F, TH), up(T.L, TH)])}" fill="${c}" ${o()}/>
  <path d="${poly([T.F, T.R, up(T.R, TH), up(T.F, TH)])}" fill="${shade(c)}" ${o()}/>
  <path d="${poly([up(T.L, TH), up(T.F, TH), apex])}" fill="#3D4A5C" ${o()}/>
  <path d="${poly([up(T.F, TH), up(T.R, TH), apex])}" fill="#27303D" ${o()}/>
  <circle cx="185" cy="${300 - H - 44}" r="13" fill="${CREAM}" ${o('stroke-width="6"')}/>
  <path d="M185 ${300 - H - 44}V${300 - H - 52}M185 ${300 - H - 44}L191 ${300 - H - 41}" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`
})

/* 02 Interfaze — a website in a browser window, its perfect score: a full teal ring with a tick */
add('02', 'interfaze', '#00bfa6', (c) => `
  ${rr(95, 40, 210, 320, 28)} fill="${CREAM}" ${o()}/>
  <path d="M95 96V68Q95 40 123 40H277Q305 40 305 68V96Z" fill="${c}" ${o()}/>
  <circle cx="125" cy="68" r="7.5" fill="${W}"/><circle cx="148" cy="68" r="7.5" fill="${W}"/><circle cx="171" cy="68" r="7.5" fill="${W}"/>
  <circle cx="200" cy="186" r="58" fill="none" stroke="${tint(c, 0.75)}" stroke-width="26"/>
  <circle cx="200" cy="186" r="58" fill="none" stroke="${c}" stroke-width="26"/>
  <circle cx="200" cy="186" r="71" fill="none" stroke="${INK}" stroke-width="6"/><circle cx="200" cy="186" r="45" fill="none" stroke="${INK}" stroke-width="6"/>
  <path d="M178 187L194 203L224 168" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
  ${rr(132, 280, 136, 16, 8)} fill="${tint(c, 0.6)}"/>
  ${rr(150, 308, 100, 30, 15)} fill="${c}" ${o('stroke-width="6"')}/>`)

/* 03 Wire — a plug, its cable tied in a loop, a spark at the pins */
add('03', 'wire', '#e0f61c', (c) => `
  <circle data-back="1" cx="124" cy="246" r="34"/>
  ${tube('M196 214C176 262 118 300 96 262C74 224 132 196 156 236C178 274 146 334 82 346', 22, c)}
  <g transform="translate(246 152) rotate(38)">
    ${rr(-17, -112, 12, 52, 5)} fill="#C9CDD2" ${o('stroke-width="6"')}/>${rr(9, -112, 12, 52, 5)} fill="#C9CDD2" ${o('stroke-width="6"')}/>
    ${rr(-50, -68, 104, 108, 22)} fill="${c}" ${o()}/>
    ${rr(-36, 34, 76, 26, 10)} fill="${shade(c, 0.78)}" ${o()}/>
    <path d="M6 -46L-14 -6H4L-6 24L18 -20H0Z" fill="${INK}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
  </g>
  <path d="M322 54L330 72L348 80L330 88L322 106L314 88L296 80L314 72Z" fill="${W}" ${o('stroke-width="6"')}/>`)

/* 04 Cohort — the pull-chain lamp, lit */
add('04', 'cohort', '#3358ff', (c) => {
  const beads = Array.from({ length: 8 }, (_, i) => `<circle cx="252" cy="${244 + i * 11}" r="4.6" fill="${INK}"/>`).join('')
  return `
  <path d="M200 24V108" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>
  ${rr(184, 96, 32, 26, 6)} fill="${shade(c, 0.6)}" ${o('stroke-width="7"')}/>
  <path d="M290 296L326 330M110 296L74 330M200 312V354" stroke="#FFC93C" stroke-width="12" stroke-linecap="round"/>
  <circle cx="200" cy="246" r="34" fill="#FFD84D" ${o()}/>
  <path d="M154 118H246L302 226Q304 236 294 236H106Q96 236 98 226Z" fill="${c}" ${o()}/>
  <path d="M154 118H178L130 236H106Q96 236 98 226Z" fill="${tint(c, 0.25)}"/>
  <path d="M154 118H246L302 226Q304 236 294 236H106Q96 236 98 226Z" fill="none" ${o()}/>
  ${beads}
  <path d="M244 336Q252 326 260 336L264 366Q252 376 240 366Z" fill="#F8A81B" ${o('stroke-width="7"')}/>`
})

/* 05 Tiwari Town — the dog made of spheres, on its little island */
add('05', 'tiwari-town', '#4a9fe0', (c) => {
  const tan = '#E9B46C', dark = '#C98B42'
  return `
  <ellipse cx="200" cy="318" rx="168" ry="44" fill="${c}" ${o()}/>
  <path d="M60 318Q80 306 100 318T140 318M260 318Q280 306 300 318T340 318" fill="none" stroke="${tint(c, 0.55)}" stroke-width="6" stroke-linecap="round"/>
  <ellipse cx="200" cy="304" rx="110" ry="26" fill="#F2D59B" ${o()}/>
  <circle cx="108" cy="190" r="20" fill="${dark}" ${o()}/>
  <circle cx="150" cy="282" r="22" fill="${dark}" ${o()}/><circle cx="254" cy="282" r="22" fill="${dark}" ${o()}/>
  <circle cx="190" cy="226" r="78" fill="${tan}" ${o()}/>
  <circle cx="176" cy="290" r="22" fill="${tan}" ${o()}/><circle cx="228" cy="290" r="22" fill="${tan}" ${o()}/>
  <circle cx="280" cy="150" r="52" fill="${tan}" ${o()}/>
  <circle cx="322" cy="176" r="24" fill="${tint(tan, 0.4)}" ${o()}/>
  <circle cx="340" cy="168" r="9" fill="${INK}"/>
  <ellipse cx="246" cy="128" rx="17" ry="27" transform="rotate(24 246 128)" fill="${dark}" ${o()}/>
  <circle cx="292" cy="136" r="7.5" fill="${INK}"/>
  <path d="M302 196Q314 206 326 198" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`
})

/* 06 Saleena Tiwari — a statue, her memories spiralling round her like a staircase (one thick ribbon, three big
   cards: it has to read as a shape at 30 px) */
add('06', 'saleena-tiwari', '#7a9c6f', (c) => {
  const P = Array.from({ length: 121 }, (_, i) => { const th = -0.45 * Math.PI + (i / 120) * 3.1 * Math.PI; return { i, th, x: 200 + 112 * Math.cos(th), y: 336 - i * 1.6 + 28 * Math.sin(th), front: Math.sin(th) > 0 } })
  const runs = []
  for (const p of P) { const last = runs.at(-1); if (last && last.front === p.front) last.pts.push(p); else runs.push({ front: p.front, pts: last ? [last.pts.at(-1), p] : [p] }) }
  const d = (pts) => 'M' + pts.map((p) => p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join('L')
  const card = (p) => `<g transform="translate(${p.x.toFixed(1)} ${(p.y - 22).toFixed(1)}) rotate(${(Math.cos(p.th) * -14).toFixed(1)})">${rr(-33, -38, 66, 76, 8)} fill="${CREAM}" ${o()}/>${rr(-22, -27, 44, 38, 4)} fill="${c}"/></g>`
  const at = (frac) => P[Math.round(frac * 120)]
  return `
  <path data-back="1" d="M80 352L82 86Q200 20 318 86L320 352Z"/>
  ${runs.filter((r) => !r.front).map((r) => tube(d(r.pts), 26, shade(c, 0.85))).join('')}
  ${rr(140, 326, 120, 40, 10)} fill="#D6CDB8" ${o()}/>
  <path d="M178 150Q200 136 222 150L252 326H148Z" fill="#ECE6D8" ${o()}/>
  <path d="M200 142Q222 144 222 150L252 326H200Z" fill="#D6CDB8"/>
  <path d="M178 150Q200 136 222 150L252 326H148Z" fill="none" ${o()}/>
  <circle cx="200" cy="108" r="34" fill="#ECE6D8" ${o()}/>
  ${runs.filter((r) => r.front).map((r) => tube(d(r.pts), 26, c)).join('')}
  ${[0.14, 0.5, 0.8].map(at).map(card).join('')}`
})

/* 07 Subtitles — a film frame, a photograph with its line burned in */
add('07', 'subtitles', '#6c5ce7', (c) => {
  const holes = (y) => Array.from({ length: 7 }, (_, i) => `${rr(68 + i * 40, y, 22, 14, 4)} fill="${W}"/>`).join('')
  return `<g transform="rotate(-6 200 200)">
  ${rr(46, 84, 308, 232, 14)} fill="${INK}" ${o()}/>
  ${holes(95)}${holes(291)}
  ${rr(66, 120, 268, 160, 6)} fill="${tint(c, 0.4)}"/>
  <circle cx="246" cy="178" r="28" fill="#FFD84D"/>
  <path d="M66 238Q130 192 190 226T334 214V280H66Z" fill="${c}"/>
  <path d="M66 258Q150 236 220 252T334 246V280H66Z" fill="${shade(c, 0.7)}"/>
  ${rr(122, 244, 156, 14, 7)} fill="${W}" stroke="${INK}" stroke-width="3"/>
  ${rr(150, 263, 100, 12, 6)} fill="${W}" stroke="${INK}" stroke-width="3"/></g>`
})

/* 08 KULTURE* — a boarding-pass stub: a plane, the asterisk, a barcode under the tear line */
add('08', 'kulture', '#c8a94a', (c) => {
  const bars = [4, 9, 4, 12, 5, 8, 4, 10, 6].reduce((a, w) => { a.x.push([a.at, w]); a.at += w + 7; return a }, { at: 132, x: [] }).x
  return `<g transform="rotate(-8 200 200)">
  <path d="M112 50H288Q306 50 306 68V220A16 16 0 0 0 306 252V332Q306 350 288 350H112Q94 350 94 332V252A16 16 0 0 0 94 220V68Q94 50 112 50Z" fill="${c}" ${o()}/>
  <path d="M112 236H288" stroke="${CREAM}" stroke-width="6" stroke-dasharray="10 9" stroke-linecap="round"/>
  <path d="M126 150L176 140L210 96Q222 84 228 92L214 138L262 130L276 112H288L282 140L292 168H280L262 150L214 160L222 206Q214 214 204 202L176 160L130 166Z" fill="${CREAM}" ${o('stroke-width="6"')}/>
  <g transform="translate(150 196)" stroke="${INK}" stroke-width="9" stroke-linecap="round"><path d="M0 -20V20M-17 -10L17 10M-17 10L17 -10"/></g>
  ${bars.map(([x, w]) => `${rr(x, 262, w, 64, 1.5)} fill="${INK}"/>`).join('')}</g>`
})

/* 09 Clark — flashcards and the streak's flame */
add('09', 'clark', '#ff5b1f', (c) => `
  <g transform="rotate(9 190 236)">${rr(70, 150, 232, 170, 16)} fill="${c}" ${o()}/></g>
  <g transform="rotate(-6 200 220)">
    ${rr(82, 132, 236, 172, 16)} fill="${CREAM}" ${o()}/>
    <path d="M100 170H300" stroke="${c}" stroke-width="5"/>
    <path d="M100 206H300M100 236H300M100 266H260" stroke="#BCD7EE" stroke-width="5" stroke-linecap="round"/>
    <path d="M118 226L136 244L170 204" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <path d="M300 186C254 182 240 140 262 108C268 132 280 136 286 128C280 98 296 70 324 52C320 82 352 102 354 136C356 170 334 188 300 186Z" fill="${c}" ${o()}/>
  <path d="M304 172C282 170 276 150 288 134C292 146 300 146 302 140C300 124 310 110 322 104C322 122 338 132 336 150C334 164 322 173 304 172Z" fill="#FFC93C"/>`)

/* 10 Cohort / Raise — a short letter, its network growing out of the page (four big nodes, thick links: a shape at 30 px) */
add('10', 'raise', '#4b63ff', (c) => {
  const N = [[200, 186, 26], [118, 116, 26], [284, 104, 30], [196, 44, 24]]
  const E = [[0, 1], [0, 2], [1, 3], [2, 3], [1, 2]]
  return `
  <path data-back="1" d="${poly(N.map(([x, y]) => [x, y]))}"/>
  <g transform="rotate(-4 200 280)">${rr(118, 196, 164, 160, 14)} fill="${tint(c, 0.8)}" ${o()}/>
    <path d="M146 254H254M146 284H230" stroke="${INK}" stroke-width="10" stroke-linecap="round" opacity="0.55"/>
    <path d="M146 324C158 308 166 336 178 320S200 312 210 322" fill="none" stroke="${c}" stroke-width="8" stroke-linecap="round"/></g>
  ${E.map(([a, b]) => `<path d="M${N[a][0]} ${N[a][1]}L${N[b][0]} ${N[b][1]}" stroke="${INK}" stroke-width="16" stroke-linecap="round"/>`).join('')}
  ${N.map(([x, y, r], i) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${i === 3 ? CREAM : c}" ${o()}/>`).join('')}`
})

/* 11 Seyi's Park — a tree, a billboard, the little character hopping between them */
add('11', 'seyis-park', '#3a8f3a', (c) => `
  <path data-back="1" d="M120 120L340 110L346 320L60 320Z"/>
  <path d="M40 318Q200 262 360 318Q370 346 340 350H60Q30 346 40 318Z" fill="#7FB069" ${o()}/>
  <path d="M234 210V306M318 210V306" stroke="${INK}" stroke-width="12" stroke-linecap="round"/>
  ${rr(212, 110, 128, 100, 10)} fill="${CREAM}" ${o()}/>
  ${rr(226, 124, 100, 72, 4)} fill="#BFE3F2"/>
  <path d="M226 196L262 160L286 180L302 166L326 188V196Z" fill="${c}"/>
  <circle cx="306" cy="144" r="10" fill="#FFD84D"/>
  ${rr(108, 214, 28, 92, 8)} fill="#8B5A2B" ${o()}/>
  <circle cx="122" cy="166" r="72" fill="${c}" ${o()}/>
  <path d="M60 196A72 72 0 0 0 184 196A72 60 0 0 1 60 196Z" fill="${shade(c, 0.75)}"/>
  <circle cx="122" cy="166" r="72" fill="none" ${o()}/>
  <path d="M176 104Q196 40 226 92" fill="none" stroke="${INK}" stroke-width="5" stroke-dasharray="3 11" stroke-linecap="round"/>
  <circle cx="200" cy="56" r="13" fill="#F8A81B" ${o('stroke-width="6"')}/>
  ${rr(188, 66, 24, 26, 10)} fill="#F8A81B" ${o('stroke-width="6"')}/>`)

/* 12 Saleena — a folded paper heart (the smallest tooth: one shape, one fold) */
add('12', 'saleena', '#e07ba0', (c) => `
  <path d="M200 340C110 280 52 226 56 160C60 108 104 80 146 88C172 93 190 110 200 134C210 110 228 93 254 88C296 80 340 108 344 160C348 226 290 280 200 340Z" fill="${c}" ${o()}/>
  <path d="M200 134C210 110 228 93 254 88C296 80 340 108 344 160C348 226 290 280 200 340Z" fill="${shade(c, 0.82)}"/>
  <path d="M200 340C110 280 52 226 56 160C60 108 104 80 146 88C172 93 190 110 200 134C210 110 228 93 254 88C296 80 340 108 344 160C348 226 290 280 200 340Z" fill="none" ${o()}/>
  <path d="M200 134V336" stroke="${INK}" stroke-width="6" stroke-linecap="round" opacity="0.5"/>`)

/* 13 Fragments — a torn page from the archive, a gold fountain-pen nib writing on it */
add('13', 'fragments', '#c8a94a', (c) => `
  <g transform="rotate(-7 190 230)">
    <path d="M64 120L92 106L116 124L148 102L176 122L204 100L232 118L262 98L286 116L300 104V336H64Z" fill="${CREAM}" ${o()}/>
    <path d="M90 178H274M90 214H274M90 250H254M90 286H220" stroke="${INK}" stroke-width="6" stroke-linecap="round" opacity="0.4"/></g>
  <g transform="translate(250 176) rotate(36)">
    <path d="M-46 -112H46L52 -56C52 -10 26 34 0 96C-26 34 -52 -10 -52 -56Z" fill="${c}" ${o()}/>
    <path d="M0 -112H46L52 -56C52 -10 26 34 0 96Z" fill="${shade(c, 0.8)}"/>
    <path d="M-46 -112H46L52 -56C52 -10 26 34 0 96C-26 34 -52 -10 -52 -56Z" fill="none" ${o()}/>
    <path d="M-46 -112H46" stroke="${INK}" stroke-width="${OL}"/>
    <circle cx="0" cy="-34" r="11" fill="${INK}"/>
    <path d="M0 -34V92" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
  </g>`)

/* the die-cut, the fit and the files: made in a real browser from each drawing */
const browser = await chromium.launch()
const page = await browser.newPage()
await page.setContent('<!doctype html><html><body style="margin:0"></body></html>')
const made = []
for (const s of STICKERS) {
  const svg = await page.evaluate(({ art, BORDER, EDGE, EDGE_COL }) => {
    const NS = 'http://www.w3.org/2000/svg'
    const root = document.createElementNS(NS, 'svg')
    root.setAttribute('xmlns', NS)
    root.setAttribute('viewBox', '0 0 400 400')
    document.body.innerHTML = ''
    document.body.append(root)
    const g = document.createElementNS(NS, 'g')
    g.innerHTML = art
    for (const el of g.querySelectorAll('[data-back]')) el.setAttribute('display', 'none')
    root.append(g)
    // the silhouette: every shape grown by the border (its own stroke kept), fills kept, in one colour
    const cut = (grow, colour) => {
      const c = g.cloneNode(true)
      c.removeAttribute('id')
      for (const el of c.querySelectorAll('[data-back]')) { el.removeAttribute('display'); el.removeAttribute('data-back') }
      for (const el of c.querySelectorAll('*')) {
        if (el.tagName === 'g') { el.removeAttribute('stroke'); el.removeAttribute('fill'); continue }
        const own = el.getAttribute('stroke') && el.getAttribute('stroke') !== 'none' ? +(el.getAttribute('stroke-width') ?? 1) : 0
        const fill = el.getAttribute('fill')
        el.setAttribute('stroke', colour)
        el.setAttribute('stroke-width', String(own + grow * 2))
        el.setAttribute('stroke-linejoin', 'round')
        el.setAttribute('stroke-linecap', 'round')
        el.removeAttribute('stroke-dasharray')
        el.removeAttribute('opacity')
        if (fill !== 'none') el.setAttribute('fill', colour)
      }
      return c
    }
    const edge = cut(BORDER + EDGE, EDGE_COL), white = cut(BORDER, '#FFFFFF')
    root.insertBefore(white, g)
    root.insertBefore(edge, white)
    // fit the viewBox to the sticker: the art's box, grown by the border, its edge and the widest stroke
    // getBBox leaves strokes out: grow by the widest stroke's half as well as the border and its edge
    const widest = Math.max(0, ...[...g.querySelectorAll('*')].map((el) => (el.getAttribute('stroke') && el.getAttribute('stroke') !== 'none' ? +(el.getAttribute('stroke-width') ?? 1) : 0)))
    const bb = g.getBBox()
    const pad = BORDER + EDGE + widest / 2 + 3
    const vb = [bb.x - pad, bb.y - pad, bb.width + pad * 2, bb.height + pad * 2].map((v) => Math.round(v * 10) / 10)
    root.setAttribute('viewBox', vb.join(' '))
    root.setAttribute('width', String(Math.round(vb[2])))
    root.setAttribute('height', String(Math.round(vb[3])))
    for (const el of g.querySelectorAll('[data-back]')) el.remove()
    return root.outerHTML
  }, { art: s.art, BORDER, EDGE, EDGE_COL })
  const file = resolve(OUT, `${s.id}-${s.slug}.svg`)
  writeFileSync(file, `<!-- grill sticker ${s.id} (${s.slug}): drawn by code, flat vector, die-cut border included; source/stickers.mjs -->\n${svg}\n`)
  made.push({ ...s, file, svg })
}

/* previews: each at 500 px and 120 px on enamel and on silver, and the whole set at 30 px on the teeth */
const PREV = resolve(HERE, 'preview')
mkdirSync(PREV, { recursive: true })
const tooth = (s) => readFileSync(resolve(OUT, 'templates', `${s.id}-${s.slug}.svg`), 'utf8')
const solid = ['03', '04', '07', '12', '13']
const cell = (s, px, bg) => `<div style="width:${px}px;height:${px}px;background:${bg};display:grid;place-items:center;border-radius:10px"><img src="data:image/svg+xml;base64,${Buffer.from(s.svg).toString('base64')}" style="max-width:${px * 0.86}px;max-height:${px * 0.86}px"></div>`
const onTooth = (s, h) => {
  const t = tooth(s), vb = t.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number), path = t.match(/ d="([^"]+)"/)[1]
  const silver = solid.includes(s.id)
  const w = (h * vb[2]) / vb[3]
  return `<div style="position:relative;width:${w}px;height:${h}px"><svg viewBox="${vb.join(' ')}" width="${w}" height="${h}" style="position:absolute"><path d="${path}" fill="${silver ? '#C9CDD2' : '#D5D9DE'}"/>${silver ? '' : `<path d="${path}" fill="#F2EEE6" transform="translate(${vb[2] * 0.12} ${vb[3] * 0.1}) scale(0.76 0.8)"/>`}</svg><img src="data:image/svg+xml;base64,${Buffer.from(s.svg).toString('base64')}" style="position:absolute;left:${w * 0.15}px;top:${h * 0.15}px;width:${w * 0.7}px;height:${h * 0.7}px;object-fit:contain"></div>`
}
const html = (body) => `<!doctype html><html><body style="margin:0;padding:24px;background:#2a2d33;font:14px system-ui;color:#ccc">${body}</body></html>`
await page.setViewportSize({ width: 1500, height: 900 })
await page.setContent(html(`<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:16px">${made.map((s) => `<div>${cell(s, 190, '#F2EEE6')}<div style="margin-top:6px">${s.id} ${s.slug}</div></div>`).join('')}</div>`))
await page.screenshot({ path: resolve(PREV, 'set-enamel.png'), fullPage: true })
await page.setContent(html(`<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:16px">${made.map((s) => cell(s, 190, '#B9BEC5')).join('')}</div>`))
await page.screenshot({ path: resolve(PREV, 'set-silver.png'), fullPage: true })
await page.setContent(html(`<p>on the teeth, as a phone shows them (40 px) and as a desktop does (120 px)</p><div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap">${made.map((s) => onTooth(s, 40)).join('')}</div><div style="display:flex;gap:14px;align-items:end;flex-wrap:wrap;margin-top:24px">${made.map((s) => onTooth(s, 120)).join('')}</div>`))
await page.screenshot({ path: resolve(PREV, 'on-teeth.png'), fullPage: true })
for (const s of made) { await page.setContent(html(cell(s, 520, '#F2EEE6'))); await page.screenshot({ path: resolve(PREV, `${s.id}-500.png`), clip: { x: 24, y: 24, width: 520, height: 520 } }) }
await browser.close()
console.log(made.map((s) => `${s.id}-${s.slug}.svg`).join(' '))
