# AdaptArxiv — Design System

> Adapted from the Structured Money visual language. **Classical-editorial · monochrome-warm · motion-rich.**
>
> Built for AdaptArxiv — a research-paper-adjacent product where the editorial aesthetic is doing the same work a "trustworthy science" badge would do clumsily. The classical direction (typographic gravitas, considered motion, painterly imagery) signals *permanence* and *rigor* — the same qualities that make academic publishing visually distinct from SaaS.

---

## 1. Design philosophy

A black-first UI carried by a single warm-beige neutral, with a high-contrast display serif italicizing one word at a time inside otherwise uppercase headlines. Everything functional uses a quiet sans. There is no accent color — secondary chroma comes from painterly imagery, not from UI controls.

Three principles:

1. **Quiet UI, loud typography.** The interface itself recedes. Type does the talking.
2. **Geometric ornament over decoration.** Polygonal SVG button shapes, thin frames, circular image clips, large wordmarks-as-graphic — all ornament is structural.
3. **Cinematic, not snappy.** Reveals are slow (0.6s–3s, expo easing), parallax is deliberate. Motion conveys gravitas, not delight.

---

## 2. Color

### 2.1 Core tokens

```
--color-black:           #000000   /* primary surface, body text on light, CTA bg */
--color-primary:         #000000   /* alias for black */
--color-white:           #FFFFFF   /* hover/active states only */
--color-secondary:       #E7E5E4   /* warm off-white */
--color-base-foreground: #F5F5F4   /* paper white */
--color-dust:            #EBEBEB   /* footer / "made liquid" panel bg */
--color-linen:           #DFDCD5   /* fine ornaments at 40% opacity, button text */
--color-ghost:           #DFDCD5   /* button label color on dark */
--color-grey:            #C4C3B6   /* THE accent — heading color on black, partner logos */
--color-light-grey:      #7E7D75
--color-dark-grey:       #595855   /* borders, slider pills, ornament strokes, muted text */
--color-muted-foreground:#A3A3A3
```

The signature pairing is **`#000` background + `#C4C3B6` text** with `#595855` for borders and `#DFDCD5` for soft fills. Do not introduce a fourth UI hue.

### 2.2 Illustration / imagery palette (off-UI)

These never apply to controls or text — only to parallax art layers, painterly backgrounds, generative ornaments.

```
Olive landscape:      #686B25
Deep olive shadow:    #333B18
Antique gold / stone: #B49759
Warm stone:           #BDB7A0
Mist / sky:           #C7D8D0
Cloud grey:           #B8B7A8
```

### 2.3 What never goes in the palette

No bright Bitcoin orange, no neon cyan/green, no fintech teal, no SaaS purple-blue gradient, no glassmorphism tints. Brand-specific accent color (if AdaptArvix needs one for a single moment — say, a status pill) should be `#000` on `#C4C3B6` or vice versa, not a hue.

---

## 3. Typography

### 3.1 Two families, two roles

| Variable        | Family                | Role                                                                           |
| --------------- | --------------------- | ------------------------------------------------------------------------------ |
| `--font-serif`  | **Davinci** (TRJN)    | Display only — H1, H2, H3, hero wordmarks. Weights 400, 400 italic, 500.       |
| `--font-sans`   | **Inter**             | Body, buttons, labels, nav, captions. Weight 400 (and 500 for emphasis only).  |
| `--font-mono`   | system mono fallback  | Code/data only. Avoid in marketing.                                            |

Davinci is self-hosted from `/fonts/`. The `font-family` declared in `@font-face` must be `Davinci` (not `TRJN-DaVinci`) — it's what the Structured CSS uses, and the variable references it directly.

```css
@font-face {
  font-family: "Davinci";
  src: url("/fonts/TRJN-DaVinci-Regular.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Davinci";
  src: url("/fonts/TRJN-DaVinci-Italic.woff2") format("woff2");
  font-weight: 400;
  font-style: italic;
  font-display: swap;
}
@font-face {
  font-family: "Davinci";
  src: url("/fonts/TRJN-DaVinci-Medium.woff2") format("woff2");
  font-weight: 500;
  font-style: normal;
  font-display: swap;
}
```

**Always preload all three weights** in `<head>` — the italic appears in every hero/section heading, and without preload you get a flash of fallback italic which reads as broken on a high-contrast serif:

```html
<link rel="preload" href="/fonts/TRJN-DaVinci-Regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/TRJN-DaVinci-Italic.woff2"  as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/TRJN-DaVinci-Medium.woff2"  as="font" type="font/woff2" crossorigin>
```

Inter is loaded via `next/font` (or `@fontsource/inter`). Enable stylistic sets `ss01` and `cv11` for the closest match to Helvetica Now's neutral grotesque feel:

```css
body {
  font-family: var(--font-sans);
  font-feature-settings: "ss01", "cv11";
}
```

### 3.2 Fluid type scale (clamp-based)

| Token              | Min → Max     | Usage                                                          |
| ------------------ | ------------- | -------------------------------------------------------------- |
| `text-heading-xxl` | 145 → 400 px  | Single hero wordmark only ("MAX BTC" treatment)                |
| `text-heading-xl`  | 45 → 94 px    | Section H2s                                                    |
| `text-heading-lg`  | 46 → 52 px    | Sub-section H2s                                                |
| `text-heading-lg-s`| 36 → 52 px    | Card titles in feature grids                                   |
| `text-heading-md`  | 30 → 34 px    | H3s, intro panel titles                                        |
| `text-heading-sm`  | 24 → 27 px    | H4s                                                            |
| `text-heading-xs`  | 19 → 21 px    | H5s                                                            |
| `text-body`        | 15 px (fixed) | Default body, button label                                     |
| `text-body-sm`     | 12 → 15 px    | Captions, meta                                                 |
| `text-link`        | 12 px (fixed) | Nav, footer links                                              |
| `text-small`       | 9 px          | Legal, microcopy                                               |

All headings: `letter-spacing: -0.03rem`, `line-height: 1` (tight). Body: `line-height: 1.25`.

### 3.3 Heading treatment rules

- **Default heading state is uppercase.** Apply via `text-transform: uppercase`, not by typing in caps.
- **Italicize one conceptual word per heading** with `<em>`. The italic word stays in its case; surrounding caps are unaffected. Class: `c-italic-no-uppercase` on the wrapper, `<em>` on the word.
  ```html
  <h2 class="c-heading-xl c-italic-no-uppercase">
    Real yield <em>on</em> Bitcoin
  </h2>
  ```
- **Headlines stay short**: 2–5 words. If you need more, split into a heading + sub-line.
- **Centered alignment** for hero and section titles. **Left-aligned** only inside cards and editorial blocks.
- Never use bold display weight; the serif's contrast is the emphasis. Reserve weight 500 (medium) for card headings only.

---

## 4. Layout & grid

### 4.1 Grid

```
Mobile (< 1024px):  4 columns,  16px edge,  20px gutter
Desktop (≥ 1024px): 12 columns, 16px edge,  20px gutter
```

Single hard breakpoint at `1024px`. Tailwind-style prefixes used in source: `m:` (medium = ≥640px), `l:` (large = ≥1024px). One additional fluid breakpoint at `--breakpoint-sm: 40rem` (640px).

### 4.2 Section heights

| Section              | Height                  |
| -------------------- | ----------------------- |
| Hero                 | `90dvh` desktop / `85dvh` mobile |
| Sticky storytelling  | `100vh` per panel       |
| Feature grid         | content-driven, ~448px card aspect |
| Footer               | content + parallax wordmark |

### 4.3 Card aspect ratios (lock these)

| Card type            | Ratio       |
| -------------------- | ----------- |
| Feature/expand card  | `459 / 448` |
| Use-case card        | `458 / 545` |
| Intro sticky card    | `458 / 474` |

### 4.4 Content widths

Body copy maxes at `240–360px`. Headlines max at `300–500px`. Wide content (data tables, code) gets the full grid. Never set a `max-width: 1440px` container — let edge padding (`16px`) and grid columns do the work; the wordmark scales to viewport edge for impact.

---

## 5. Spacing & radius

### 5.1 Border radius

| Element              | Radius                        |
| -------------------- | ----------------------------- |
| Section container    | `10px`, animates → `0px` on scroll-in |
| Card                 | `10px`                        |
| Intro black panel    | `9px`                         |
| Button wrapper       | `4px` (label sits inside SVG end-caps; visible shape is SVG-driven) |
| Slider pills         | `2px`                         |

```
--radius-sm:  0.25rem   /* 4px  */
--radius-xl:  0.75rem   /* 12px */
--radius-2xl: 1rem      /* 16px */
```

### 5.2 Strokes

- `1px` for inner ornament, fine dividers (use `#595855` at 100% or `#DFDCD5` at 40%).
- `2px` for card outlines (`#595855`).
- Never use `0.5px` hairlines — they vanish on standard displays.

---

## 6. Components

### 6.1 Header

- Fixed, transparent on initial load; on scroll-past-hero, switches to `#000` bg with `1px` bottom border in `#595855`.
- Left: monogram logo (30×31 SVG, `currentColor` fill).
- Right: a single utility link (e.g., "Account", "Docs"). No multi-item nav.
- Header items animate in via `translateX(±30px) + opacity 0 → 1` over `0.5s`.
- Padding: `16px` vertical, grid-edge horizontal.

### 6.2 Buttons

The CTA is the brand's strongest single device. It is **not** a rounded rectangle — it's a label flanked by two SVG hexagonal end-caps, forming an angular gem/capsule shape.

```css
:root {
  --button-height:        40px;
  --button-min-width:     95px;
  --button-radius:        4px;       /* on the wrapper only */
  --button-font-size:     15px;
  --button-padding:       0 6px;
  --button-color:         #DFDCD5;
  --button-background:    var(--color-primary);
  --button-color-hover:   #FFFFFF;
  --button-background-hover: grey;   /* CSS keyword, = #808080 */
  --button-color-active:  #000000;
  --button-background-active: #FFFFFF;
}
```

Variants:
- **Primary (default).** Black bg, linen text. Use for `Sign up`, `Get started`, conversion actions only — max one per section.
- **Bordered.** Transparent bg, hexagonal SVG outline. Used as the `+`/`−` expand toggle on feature cards. Outline `polygon` fill animates on hover.
- **Light.** Inverse: linen bg, black text. For dark-on-dark contexts.

Hover behavior: two pseudo-element circles (`:before`, `:after`) at the label's left/right edges. They live at `scale(0.75)`. On hover they expand to `scale(1.4)` and the wrapper background shifts. Avoid generic `:hover { background: lighten(...) }`.

Use primary CTAs **sparingly**. The Structured homepage has only two ("mint maxBTC" and "Get maxBTC") — both leading to the app.

### 6.3 Feature card (expandable)

Three across on desktop, stacked on mobile.

- Square-ish aspect (`459/448`).
- Centered serif title at top (`c-heading-md`, weight 400).
- Circular-clipped illustration window in the middle. The clip uses `clip-path: inset(0% round 100%)`; on `.is-open`, animates to `inset(10% round 100%)` and fades opacity 0.
- Body copy appears **only when open** — fades in over `0.3s`.
- Border (`1px #595855`) appears only on `.is-open`, with a `transform: scale(0.95) → scale(1)` reveal.
- Bottom edge: `+`/`−` toggle button (bordered variant).

### 6.4 Use-case card

Three across, larger aspect (`458/545`).

- Black bg, `2px #595855` border, `10px` radius.
- Top edge: ornamental SVG frame (the polygon notch with peaks/valleys). The frame is a real SVG path, not a CSS clip — on scroll-in, a follower path animates along the same outline using `stroke-dasharray`.
- Large display title at bottom-left (`c-heading-lg-s-light` — weight 400, ~52px).
- Short body below (~13–15px).
- Entrance: clip-path from bottom (`polygon(0 100%, 0 100%, 100% 100%, 100% 100%) → polygon(0 0, 0 100%, 100% 100%, 100% 0)`) over `1s` with `--ease-out-expo`. Stagger by ~200ms across cards in the same row.

### 6.5 Footer

- Background: `--color-dust` (`#EBEBEB`).
- Top: small monogram logo (left) + utility link list (right, uppercase, underline-on-hover).
- Center: full-width parallax wordmark — the brand name set in Davinci at the largest possible size, translating vertically on scroll.
- Bottom: copyright + legal links + credit line.

---

## 7. Motion

### 7.1 Easing tokens

```
--ease-out-quad:    cubic-bezier(.25, .46, .45, .94)   /* UI, hover, micro */
--ease-out-expo:    cubic-bezier(.19,  1,   .22, 1)    /* section reveals  */
--ease-in-out-expo: cubic-bezier(.87,  0,   .13, 1)    /* clip-path morphs */
```

### 7.2 Duration tokens

```
--transition-duration:      0.4s     /* hover, fade, default UI */
--transition-duration-slow: 0.6s     /* clip-path, morph */
0.3s   — tooltip, badge, tag fade
0.5s   — header/link entrance
1.0s   — section clip-path reveal
3.0s   — large card translate / opacity composite
```

### 7.3 Patterns

- **Split-text reveal.** Wrap headlines in a custom element that splits to lines → words → letters and stagger transition-delays (50ms per letter, 100ms per line). On `.is-inview`, transform `translateY(100%) → 0`.
- **Scroll parallax.** Use a scroll library (Locomotive, Lenis) with `data-scroll-speed` per layer. Speeds: foreground `0.1`, mid `0.2`, far `0.3`.
- **Sticky storytelling panel.** Position a centered card `position: sticky; top: 0; height: 100vh` while a long parallax background scrolls behind it. Inside the card, swap text slides via `.active` class; trigger via scroll-progress percentage.
- **Soft-light glow followers.** A `40×40px` blurred (`blur(6px)`) circle of `--color-secondary` with `mix-blend-mode: soft-light`, positioned absolutely and translated by JS to follow cursor or ornament path. Subtle — barely perceptible. Two or three per section, never more.
- **Path-trace ornament.** SVG outline of a card frame. A second `<path>` with `stroke-dasharray` of its full length traces the outline on `.is-inview`.

### 7.4 What to avoid

- No spring/bounce easing.
- No "scale on hover" without compensating motion (it reads as cheap).
- No fade-only entrances — always pair opacity with translate or clip-path.
- No looping ambient animations (rotating coins, pulsing dots). Motion should be triggered, deliberate, and end.

---

## 8. Imagery & art direction

### 8.1 Style

Painterly, classical, atmospheric. Layered foreground/midground/background as separate PNGs with parallax. Subjects: landscapes with winding paths, classical architecture (temples, columns, ruins), trees, clouds, geometric monuments. Texture is brushed/painted, not vector-flat. Colors stay in the illustration palette (§ 2.2), never the UI palette.

### 8.2 Production guidance

- Source: AI-generated (Midjourney / Flux on a tuned LoRA) → manual paint-out in Photoshop → export per parallax layer.
- Each scene = 4–6 PNG layers with transparent backgrounds.
- Resolutions: serve `500 / 768 / 1024 / 1440 / 1920` widths via `srcset`.
- Always include a `.webp` source before `.png`.

### 8.3 What this aesthetic is NOT

- No 3D crypto coins.
- No abstract gradient meshes.
- No isometric SaaS illustrations.
- No glassmorphism / frosted-glass cards.
- No neon/cyberpunk lighting.
- No stock photography of people in offices.

---

## 9. Voice & content

Calm, declarative, institutional. Prefers nouns over adjectives. Names what the product is and what it does. Avoids hype.

**Use:** *liquid, yield-bearing, sustainable, composable, collateral, unified, integrated, scalable, real, proven, structured, adaptive*

**Avoid:** *revolutionary, next-gen, unlock, supercharge, insane, blazing-fast, AI-powered (as a hero claim), to the moon, game-changing*

Headlines: 2–5 words, with one italicized concept word.
Body: 1–2 sentences, ~25 words max per block.
Microcopy: lowercase or sentence case (e.g., "mint maxBTC", "get maxBTC"), never title-case for CTAs.

---

## 10. Implementation: CSS tokens

Drop this into `tokens.css` or your Tailwind theme:

```css
:root {
  /* Color */
  --color-black:           #000000;
  --color-primary:         #000000;
  --color-white:           #FFFFFF;
  --color-secondary:       #E7E5E4;
  --color-base-foreground: #F5F5F4;
  --color-dust:            #EBEBEB;
  --color-linen:           #DFDCD5;
  --color-ghost:           #DFDCD5;
  --color-grey:            #C4C3B6;
  --color-light-grey:      #7E7D75;
  --color-dark-grey:       #595855;
  --color-muted-foreground:#A3A3A3;

  /* Type families */
  --font-serif: "Davinci", "Times New Roman", serif;
  --font-sans:  "Inter", "Helvetica Neue", "Arial", sans-serif;
  --font-mono:  ui-monospace, "SF Mono", Menlo, Consolas, monospace;

  /* Type scale */
  --text-heading-xxl: clamp(9.0625rem, 3.519rem + 27.7174vw, 25rem);
  --text-heading-xl:  clamp(2.8125rem, 1.7473rem + 5.3261vw, 5.875rem);
  --text-heading-lg:  clamp(2.875rem, 2.7446rem + 0.6522vw, 3.25rem);
  --text-heading-lg-s:clamp(2.25rem, 1.9022rem + 1.7391vw, 3.25rem);
  --text-heading-md:  clamp(1.875rem, 1.788rem + 0.4348vw, 2.125rem);
  --text-heading-sm:  clamp(1.5rem, 1.4348rem + 0.3261vw, 1.6875rem);
  --text-heading-xs:  clamp(1.1875rem, 1.144rem + 0.2174vw, 1.3125rem);
  --text-body:        clamp(0.9375rem, 0.9375rem + 0vw, 0.9375rem);
  --text-body-sm:     clamp(0.75rem, 0.6848rem + 0.3261vw, 0.9375rem);
  --text-link:        0.75rem;
  --text-small:       0.5625rem;

  /* Radius */
  --radius-sm:  0.25rem;
  --radius-xl:  0.75rem;
  --radius-2xl: 1rem;

  /* Motion */
  --ease-out-quad:    cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --ease-out-expo:    cubic-bezier(0.19, 1,    0.22, 1);
  --ease-in-out-expo: cubic-bezier(0.87, 0,    0.13, 1);
  --transition-duration:      0.4s;
  --transition-duration-slow: 0.6s;

  /* Grid */
  --grid-edge-s:   16px;
  --grid-edge-m:   16px;
  --grid-gutter:   20px;
  --grid-columns-s: 4;
  --grid-columns-m: 12;
  --breakpoint-sm: 40rem;
  --breakpoint-l:  64rem;

  /* Buttons */
  --button-height:           40px;
  --button-min-width:        95px;
  --button-radius:           4px;
  --button-font-size:        15px;
  --button-padding:          0 6px;
  --button-color:            #DFDCD5;
  --button-background:       var(--color-primary);
  --button-color-hover:      #FFFFFF;
  --button-background-hover: #808080;
  --button-color-active:     #000000;
  --button-background-active:#FFFFFF;
}

/* Heading utility classes */
.c-heading-xl { font: 400 var(--text-heading-xl)/1 var(--font-serif); letter-spacing: -0.03rem; }
.c-heading-lg { font: 400 var(--text-heading-lg)/1 var(--font-serif); }
.c-heading-md { font: 400 var(--text-heading-md)/1.1 var(--font-serif); }

/* Italic-keeps-case modifier */
.c-italic-no-uppercase { text-transform: uppercase; }
.c-italic-no-uppercase em { text-transform: none; font-style: italic; }

/* Body */
.c-body    { font: 400 var(--text-body)/1.25 var(--font-sans); }
.c-body-sm { font: 400 var(--text-body-sm)/1.25 var(--font-sans); }
```

---

## 11. Build stack recommendation

Match the engineering choices that make this aesthetic feel correct in motion:

- **Astro** or **Next.js** with static rendering — content-led, fast, SEO-clean.
- **Tailwind v4** for utility classes; the `@theme` block holds the tokens above.
- **Locomotive Scroll v5** or **Lenis** for smooth scroll + scroll-progress.
- **GSAP** (or `motion` for React) for clip-path and path-trace animations.
- Self-host fonts via `next/font` or `<link rel="preload" as="font">`.
- Use `<picture>` + `srcset` for parallax PNG layers; serve `.webp` first.

---

## 12. Anti-patterns checklist

Before shipping a page, verify:

- [ ] No accent color in UI controls (no blue, no orange, no green).
- [ ] No more than two type families on the page.
- [ ] No bold weight in body copy.
- [ ] No glassmorphism or frosted blur on cards.
- [ ] No emoji or 3D illustration in marketing surfaces.
- [ ] No "AI-generated" cyber/futuristic tropes.
- [ ] All headings ≤ 5 words.
- [ ] At most one primary CTA per section.
- [ ] Every entrance animation pairs translate or clip-path with opacity.
- [ ] Every painterly image has at least one parallax layer.

---