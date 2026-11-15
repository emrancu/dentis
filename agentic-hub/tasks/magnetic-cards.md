# Magnetic effect on the service cards, and a more polished card UI

- Task id: `magnetic-cards`
- Epic: [landing](../epics/landing.md)
- Contracts: none (front end only)
- PR plan: one for all
- Branch: `feature/magnetic-cards` (stacked on `feature/knob-buttons`, PR #3)
- Pull request: none yet

## Goal
The Services cards feel physical: the card is pulled gently toward a nearby cursor, its content drifts a little further, a soft light follows the pointer, and a click squashes it. The cards and the section around them also look more finished.

## Spec (from the owner's style note, card values)
- **Setup:** each card sits in a static wrapper that never moves. All distances are measured from the card's **resting** rect (the wrapper's rect), never from the moving element. The card has `overflow: hidden` and `position: relative`; the content layer is above the light layer and has `pointer-events: none`.
- **Range:** cursor within 50px of the resting edge is active. Outside, the card springs back to rest.
- **Pull:** card translate = (cursor − resting centre) × 0.12, capped at 12px so text never leaves readability. Rotation = dx × 0.01°.
- **Depth:** content translate = offset × 0.05, so the content moves further than the card.
- **Near state:** the shadow grows (larger, more blur and offset).
- **Light:** a radial spot centred on the cursor inside the card, size about 1.5× the card's shorter side, transparent at 62%. The note says white at 18%, but the cards are white, so the light-element rule applies: the text colour (`--ink`) at about 6%. Fades in on hover in 0.3s, out on leave.
- **Click:** scale 1 → 0.9 → 1.05 → 1 over 400ms ease-out.
- **Motion:** transform only, 0.4s spring `cubic-bezier(.3,1.5,.5,1)`. Reduced motion: the effect is off.
- Mouse and pen only. Touch has no hover, so touch does nothing.

### UI enhancement (bounded)
- Card surface: a soft gradient, a hairline border, a refined accent and spacing, with the same surface tokens shared by the steps and doctor cards. Only the service cards get the magnetic effect.
- A soft tinted background band behind the Services section.
- No new content, no new icons, no layout change at any breakpoint.

### Out of scope
Making the cards do something when clicked, the doctor and step cards moving magnetically.

## Approved deviations
None. (The 6% ink light instead of 18% white follows the owner's own rule for light-coloured elements.)

## Subtasks
- [~] 1. The effect: pure maths, controller, tests
  - parallel: no
  - files: `public/js/magnetic.js`, `public/js/main.js`, `test/frontend`
  - done when: tests cover range, pull, caps, depth, light size, and the reduced-motion and touch rules
- [ ] 2. Service card markup and styles, plus the UI polish
  - parallel: no (after 1)
  - files: `public/css/site.css`, `public/js/main.js`
  - done when: tests cover the structure and the CSS rules, and the static page tests stay green
- [ ] 3. Verify in a real browser
  - parallel: no (after 2)
  - done when: real pointer events show pull inside 50px, rest outside, the light fading, the click squash, and no effect with reduced motion
- [ ] 4. Premortem & spec re-evaluation
  - parallel: no (after all above)
  - premortem: <to fill>
  - spec changes: <to fill>
  - done when: premortem filled in and the spec matches what was built

## Feature pull requests
- [ ] Pull request opened after the premortem
