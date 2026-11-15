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
- [x] 1. The effect: pure maths, controller, tests
  - parallel: no
  - files: `public/js/magnetic.js`, `public/js/main.js`, `test/frontend`
  - done when: tests cover range, pull, caps, depth, light size, and the reduced-motion and touch rules
- [x] 2. Service card markup and styles, plus the UI polish
  - parallel: no (after 1)
  - files: `public/css/site.css`, `public/js/main.js`
  - done when: tests cover the structure and the CSS rules, and the static page tests stay green
- [x] 3. Verify in a real browser
  - parallel: no (after 2)
  - done when: real pointer events show pull inside 50px, rest outside, the light fading, the click squash, and no effect with reduced motion
- [x] 4. Premortem & spec re-evaluation
  - parallel: no (after all above)
  - premortem: see below
  - spec changes: see below
  - done when: premortem filled in and the spec matches what was built

### Premortem
| Likely cause | Covered by |
|---|---|
| The card moves too far and text is hard to read | The pull is capped at 12px, the rotation at 2°, the content drift at 8px. Measured in a real browser at the 50px edge: exactly 12, 2 and 8. |
| The effect stays on after the cursor leaves, or sticks at a card edge | The range is measured from the static wrapper, so the moving card cannot change it. At 49px out the card is pulled, at 60px out it is at rest (measured). Leaving the window resets it. |
| It runs for reduced-motion or touch users | Off for reduced motion (measured: nothing moves, no click animation) and ignores touch pointers. |
| It slows the page | Updates are throttled to one per frame and only 8 cards are checked. **Not profiled on a low-end device.** Touch is excluded, so phones never run it. |
| The reveal animation and the pull fight over `transform` | The reveal is on the wrapper and the pull on the card, and a test enforces it. The squash uses the separate `scale` property, so it never fights the pull. |
| The card content can no longer be selected or copied with the mouse | **Real side effect:** the content layer has `pointer-events: none`, as the style note requires. Service text cannot be selected by dragging. |
| The cards feel clickable but do nothing | The click squash is tactile feedback only. Finding 15 from the design review (cards go nowhere) is still open. |
| It looks different in other browsers | **Measured only in headless Chrome.** The squash uses the `scale` property (Safari 14.1+, Chrome 104+). In an older browser it does nothing and does not break anything. |
| Keyboard users get nothing | The effect is pointer-only and nothing they need depends on it. |

### Spec changes
- The light is the **text colour at 6%** and not white at 18%, because the cards are white (the owner's own rule for light-coloured elements). Recorded as a deviation that follows the note, not one that breaks it.
- UI polish shipped: shared soft surface with a hairline on the service, step and doctor cards, a gradient accent bar, a soft teal wash behind Services, a larger teal-tinted shadow for the near state. Only the service cards are magnetic.

## Feature pull requests
- [ ] Pull request opened after the premortem
