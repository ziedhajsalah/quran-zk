# Design System Document: The Sacred Library

## 1. Overview & Creative North Star

**Creative North Star: The Illuminating Sanctuary**
This design system rejects the "corporate" look in favor of a digital experience that feels like stepping into a modern, sunlit library. It is an "Editorial Spiritualism" approach—where the vast wisdom of the Quran is met with the precision of contemporary education.

We break the traditional "grid-in-a-box" template by utilizing **Intentional Asymmetry**. Sections are not perfectly mirrored; instead, they flow with a poetic rhythm. Large, elegant serif typography overlaps subtle background transitions, and content "breathes" through expansive whitespace (the 16 and 20 spacing tokens). The goal is to create a feeling of peace, focus, and reverence.

---

## 2. Colors

The palette is rooted in the deep, scholarly green of the heritage logo (`primary: #004d27`), balanced by organic, paper-like neutrals that evoke the texture of ancient manuscripts and modern classrooms.

### The "No-Line" Rule
**Borders are forbidden for sectioning.** To separate a lesson module from the main dashboard, do not use a 1px line. Instead, use a background shift. For example, a card using `surface-container-lowest` (#ffffff) should sit atop a `surface-container-low` (#f2f4ef) background. This creates a soft, natural boundary that feels high-end and intentional.

### Surface Hierarchy & Nesting
Think of the UI as layers of fine paper.
* **Base:** `background` (#f8faf5)
* **Layer 1 (The Desk):** `surface-container-low` (#f2f4ef) for major content areas.
* **Layer 2 (The Manuscript):** `surface-container-lowest` (#ffffff) for active cards or reading panes.
* **Accent Layer:** `tertiary-container` (#725515) for call-outs or specialized spiritual alerts.

### Glass & Gradient Rule
To add "soul," use subtle gradients on primary CTAs—transitioning from `primary` (#004d27) to `primary-container` (#006837). For floating navigation or prayer-time overlays, use **Glassmorphism**: apply `surface` with 80% opacity and a 12px backdrop-blur to allow the content beneath to glow through softly.

---

## 3. Typography

The typography is a bridge between the classical and the contemporary. It must support Right-to-Left (RTL) flawlessly.

* **Display & Headlines (Noto Serif):** This serif font is our "Authoritative Voice." Use `display-lg` (3.5rem) for hero statements. The serif mimics the stroke of a traditional Qalam (pen), providing a spiritual weight.
* **Body & Labels (Manrope):** Our "Modern Educator." This clean sans-serif ensures maximum legibility for study notes and administrative tasks.
* **Rhythm:** Always maintain a high contrast between headlines and body text. A `headline-lg` should feel significantly more "sacred" than the `body-md` beneath it.

---

## 4. Elevation & Depth

We convey importance through **Tonal Layering**, not structural rigidity.

* **The Layering Principle:** Depth is achieved by stacking. A `surface-container-highest` (#e1e3de) element should be used sparingly for high-priority interactive components like "Start Lesson" buttons or search bars.
* **Ambient Shadows:** For floating modals, use an extra-diffused shadow: `box-shadow: 0 20px 40px rgba(25, 28, 26, 0.06)`. Note the tint: we use a 6% opacity of our `on-surface` color (#191c1a) rather than pure black, ensuring the shadow feels like a natural part of the environment.
* **The "Ghost Border" Fallback:** If accessibility requires a border, use `outline-variant` (#bec9be) at 20% opacity. It should be felt, not seen.

---

## 5. Components

### Buttons
* **Primary:** Rounded `xl` (0.75rem). Background is a gradient of `primary` to `primary-container`. Typography is `label-md` in `on-primary` (#ffffff).
* **Secondary:** Ghost style. No background. `outline` (#6f7a70) at 30% opacity for the frame.

### Cards & Lists
* **Strict Rule:** No divider lines. Separate list items using `spacing-4` (1.4rem) and subtle background shifts.
* **The "Ayah" Card:** A `surface-container-lowest` card with a `primary` left-border (4px) to denote it as a sacred text snippet.

### Input Fields
* **Style:** Minimalist. No bottom line. A solid block of `surface-container-high` (#e7e9e4) with `md` (0.375rem) corners. The label sits in `on-surface-variant` above the field.

### Specialized Component: The Progress Rosary (Misbaha)
Instead of a standard horizontal progress bar, use a series of small, circular `primary-fixed` (#9ef6b6) chips that fill to `primary` as the student completes verses.

---

## 6. Do's and Don'ts

### Do
* **Embrace RTL:** Ensure all icons (like "back" arrows) are flipped for the Arabic interface.
* **Use Generous Padding:** When in doubt, add more space. Use `spacing-10` (3.5rem) between major sections to maintain a "zen" educational atmosphere.
* **Celebrate the Script:** Allow the Arabic script to be slightly larger (110-120%) than the English equivalent to preserve its intricate ligatures.

### Don't
* **No "Full Black":** Never use `#000000`. Use `on-surface` (#191c1a) for text to keep the look soft and premium.
* **No Sharp Corners:** Avoid `rounded-none`. Everything should feel organic and safe; use `md` as your minimum.
* **No Crowding:** Do not pack multiple features into one screen. If a student is reading the Quran, the sidebar and nav should recede into `surface-dim` (#d8dbd6).