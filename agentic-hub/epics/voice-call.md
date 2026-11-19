# Epic: Browser voice call

## Goal
A visitor talks to the Bangla agent from the hero, in the browser.

## Needs
- Two entry points: **Book an appointment** (intent `booking`) and the floating **Call Dentis** (intent `general`). Either asks for the mic, calls `POST /api/session`, opens the Scribe WebSocket with the one-use URL, and sends the intent with every `POST /api/agent/turn`.
- States: idle, connecting, live (timer, mute, end; voice only, no caption text), ended, error. While live the status shows Listening, Thinking or Speaking.
- Errors with a retry: mic denied, no mic, a missing API key (`not_configured`), session refused or rate-limited, network drop, 5-minute cap.
- Each finished caller turn goes to `/api/agent/turn`; the reply streams back and every sentence is spoken at once through `/api/voice/speak`. Tools run on the server inside the turn.
- Barge-in: when the caller speaks over the agent, audio and the turn stop at once.
- A dropped speech connection reconnects up to 3 times; a failed turn gets a spoken apology.
- The ordered transcript is sent to `/api/calls/:id/finish` (also on page close). No audio is recorded or stored.

## Acceptance
- [ ] A call can be started, ended and started again.
- [ ] The call shows in the portal within seconds of hanging up.
