# Epic: Browser voice call

## Goal
A visitor talks to the Bangla agent from the hero, in the browser.

## Needs
- Two entry points: **Book an appointment** (intent `booking`) and the floating **Call Dentis** (intent `general`). Either asks for the mic, calls `POST /api/session` with the intent, connects WebRTC to OpenAI Realtime with the short-lived key.
- States: idle, connecting, live (timer, mute, end; voice only, no caption text), ended, error.
- Errors with a retry: mic denied, no mic, session refused or rate-limited, network drop, 5-minute cap.
- Agent function calls go to `/api/agent/tools/:name` and the result goes back to the model.
- The ordered transcript is sent to `/api/calls/:id/finish` (also on page close). No audio is recorded or stored.

## Acceptance
- [ ] A call can be started, ended and started again.
- [ ] The call shows in the portal within seconds of hanging up.
