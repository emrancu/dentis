# Slide-knob button effect on the call-to-action buttons

- Task id: `knob-buttons`
- Epic: [landing](../epics/landing.md)
- Contracts: none (front end only)
- PR plan: one for all
- Branch: `feature/knob-buttons` (stacked on `feature/website-polish`, PR #2)
- Pull request: https://github.com/emrancu/dentis/pull/3

## Goal
Every call-to-action button uses one slide-knob style. At rest a knob with a pixel chevron sits at the start of the pill. On hover or keyboard focus the knob slides to the end and the label shifts the other way, in 600ms with `cubic-bezier(.76,0,.24,1)`, animating `transform` only.

## Spec (from the owner's style note)
- Structure: pill shell (height 52) > knob (64 wide, 5 inset, above the label, holds the arrow) + a one-line label (18 gap after the knob, 28 to the end).
- Arrow, fixed signature, never replaced by another icon: 5 squares on a 3×5 grid at (0,0) (1,1) (2,2) (1,3) (0,4), drawn 9×15px: `<svg viewBox="0 0 6 10"><path fill="currentColor" d="M0 0h2v2H0zM2 2h2v2H2zM4 4h2v2H4zM2 6h2v2H2zM0 8h2v2H0z"/></svg>`.
- Hover and focus: knob slides to the end with the same 5 inset. Label shifts left by `knob + inset + gap − 28`. Both at once, no bounce, no layout change.
- Knob travel = shell inner width − knob width − 2 × inset, **measured at runtime** (the label and font change with the language).
- Reduced motion: instant.
- Colours from the site tokens: shell = text colour (`--ink`), label = background colour (white), knob = primary (teal gradient), arrow = on-primary (white). Radius: the shell is a pill, the knob radius = shell radius − inset. A light variant (white shell, ink label) for secondary buttons.
- Small variant for the header and the call panel (same proportions at height 44).

### Where it applies
The hero "Book an appointment" and "Our services", the header booking button, the Visit section's two buttons, the floating "Talk to us" button, and the call panel's "Call again" and "Try again".

### Not changed (YAGNI)
Utility controls where a sliding arrow would be odd: the language toggle, the menu button, mute, end call, close, and the hero treatment tabs.

### One adjustment
On phones (≤520px) the floating button is a circle with no label, so a slide has no room. It shows the phone icon in the knob and does not slide. This is the only place the arrow is not used.

## Approved deviations
None.

## Subtasks
- [x] 1. The component: CSS, the travel measurement, tests
  - parallel: no
  - what: `.kb` styles, `knob-button.js` (pure travel function + runtime measuring), unit tests
  - files: `public/css/site.css`, `public/js/knob-button.js`, `public/js/main.js`, `test/frontend`
  - done when: tests cover the arrow signature, timing, transform-only, reduced motion and the travel maths
- [x] 2. Apply it to every call-to-action button
  - parallel: no (after 1)
  - what: replace the old button markup and styles
  - files: `public/index.html`, `public/css/site.css`
  - done when: no old button class is left and the static Bangla text still equals the dictionary
- [x] 3. Verify in a real browser
  - parallel: no (after 2)
  - what: hover each button and measure where the knob and label end up, in both languages, on desktop and phone
  - done when: measured positions match the spec within a pixel and nothing overflows
- [x] 4. Premortem & spec re-evaluation
  - parallel: no (after all above)
  - premortem: see below
  - spec changes: see below
  - done when: premortem filled in and the spec matches what was built

### Premortem
| Likely cause | Covered by |
|---|---|
| The knob does not reach the end because the width changed (language switch, font load, button shown later) | The travel is measured at runtime and re-measured by a `ResizeObserver` and when fonts are ready. Measured in a real browser in both languages and with 3 different label widths: the knob ends 5px from the edge (4px on the small variant) within a pixel. |
| JavaScript fails | The buttons still work. The knob just stays at the start and nothing slides. |
| Touch screens have no hover, or hover sticks after a tap | The button action is unaffected. On phones the floating button is a plain circle and does not slide. |
| Reduced-motion users | Transitions are off (tested). |
| A full-width button on a phone stretches the shell | The knob travels the full width and the label lands 28px from the left. Rest geometry measured on a 360px phone. |
| Hover timing on real hardware | **Measured only in headless Chrome**, where the 3D hero scene runs in software and stalls frames, so the hero buttons were not timed there. The same CSS was verified on the buttons lower on the page. Real-GPU and Safari timing is untested. |
| A keyboard user gets no effect | `:focus-visible` triggers the same slide. Covered by a test of the CSS selector, **not by a real Tab key press**. |

### Spec changes
- The floating button on phones (≤520px) shows a phone icon in a circle and does not slide, because there is no room. This is the only place the arrow is not used.
- The call panel's "Call again" and "Try again" use the small light variant. Mute, end call, close, the language toggle, the menu and the hero tabs were left alone on purpose.

## Feature pull requests
- [!] Pull request opened after the premortem: https://github.com/emrancu/dentis/pull/3 (waiting on merge)
