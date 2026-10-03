---
name: Message requests
description: User-requested limits for starting private conversations.
---
Mutual followers may message freely. Without mutual following, a user may send two introductory messages, then must wait for the recipient to respond.

**Why:** The user explicitly requested this boundary for unsolicited messages.

**How to apply:** Enforce against persisted relationships and message history on the server, not demo follow toggles or client counters. A recipient reply opens ordinary two-way conversation; do not treat the quota as two messages per turn or reset it by reopening a thread.