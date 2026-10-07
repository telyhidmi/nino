---
name: Private-account policy
description: Scope and transition decisions for Nino private accounts.
---
The user requested TikTok-like Settings and privacy and explicitly chose private accounts with follower approval.

Switching private retains existing followers as approved. New followers require approval before seeing posts. Switching public automatically approves pending follow requests; the confirmation must disclose this before saving.

**Why:** Retaining existing followers avoids unexpectedly disconnecting an established audience. Pending requests no longer need approval for a public account, but this consequence must not be hidden.

**How to apply:** Enforce post visibility on the server and on media requests, not merely through feed filtering. Do not include private playback credentials in Share links. Keep interface text clear that message blocking and post privacy are separate controls.
