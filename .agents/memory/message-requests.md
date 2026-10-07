---
name: Message requests
description: User-requested limits for starting private conversations.
---
If either person follows the other, both may message freely without a follow-back. If neither follows the other, a user may send two introductory messages, then must wait for the recipient to respond. Either person can block messaging; a block overrides follows and previously unlocked conversations.

**Why:** The user changed the original mutual-follow requirement to let all followers message freely unless blocked. The earlier two-message boundary still applies to strangers.

**How to apply:** Enforce against persisted relationships, blocks, and message history on the server, not demo follow toggles or client counters. A recipient reply opens ordinary two-way conversation; do not reset the quota by reopening a thread. Each person controls only their own block; unblocking must not override the other person's block.