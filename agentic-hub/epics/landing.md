# Epic: Landing page

## Goal
A visitor sees a dental centre, understands in five seconds that they can book an appointment, and does it. Booking is by voice in Bangla, but the site is a dental centre first.

## Needs
- Hero: dental-centre headline about **dental care only** ("Healthy teeth, confident smiles"). Never put appointments or booking in the headline or sub-copy: the button carries that. No speed claims (principle 15), one primary button **Book an appointment** (starts a voice booking in Bangla), a light hero with a **round 3D stage** on the **right side** (below the text on phones), built with Three.js. It cycles through four treatment models (check-up, whitening, braces, implant) with floating cards and tabs naming each; a tap or the tabs switch, drag spins, and it pauses on hover. A small static tooth drawing is the fallback if WebGL is missing. Motion calms under `prefers-reduced-motion`.
- A floating **Call Dentis** button at the bottom right of every screen (a general call to the centre). It hides while a call panel is open.
- The header also has a **Book appointment** button on desktop.
- No trust chips or badges. Copy is written for the patient: Services (live from enabled skills), **Your first visit** (what to expect), **Why Dentis**, **Our dentists** (live), **Visit us** (live), footer with contact details.
- A mobile menu, the active section highlighted in the nav, and soft staggered reveals. Smooth, not busy (YAGNI): no extra animation libraries.
- Bangla and English toggle, remembered.
- Dentis SVG logo and favicon.

## Acceptance
- [ ] No horizontal scroll at 360px. The Book an appointment button is visible without scrolling on a phone, and the floating call button is reachable everywhere.
- [ ] Contrast meets WCAG AA. All controls work by keyboard.
- [ ] A skill changed in admin shows in Services on reload.
