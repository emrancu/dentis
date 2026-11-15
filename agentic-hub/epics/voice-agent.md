# Epic: Voice agent

## Goal
A receptionist that sounds natural in colloquial Bangla, books real appointments, and never invents facts.

## Needs
- A system prompt built for each session from the clinic profile, doctors, skill titles and today's date. Rules: Dhaka Bangla, code-switching, short turns, read back digits, safety.
- The tools in [agent-tools](../contracts/agent-tools.md).
- Booking rules: valid Bangladeshi mobile (Bangla digits accepted), a real future date within 60 days, doctor schedule, no double-booking, alternatives on conflict.
- No post-call analysis: the tools capture the structured data. The transcript is Bangla only.
- Abuse guard: sessions per IP, call length.

## Acceptance
- [ ] A Bangla caller books an appointment end to end.
- [ ] Every fact the agent states traces to a tool result.
- [ ] Editing a skill changes the next call without a deploy.
- Silence: after 15 seconds with no speech the agent asks "হ্যালো, আপনি কি লাইনে আছেন?" once. After 30 seconds it says the closing line and the call ends (reason `idle`, saved as an ordinary incomplete call). A deliberate mute restarts the clock. The times are constants in `public/js/idle.js`.
