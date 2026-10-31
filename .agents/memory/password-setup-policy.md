---
name: Social-account password setup
description: Google users may add a separate Nino password without creating another account or receiving passwords by email.
---

Allow Google users to choose a separate Nino password on their existing account after email verification. Keep Google sign-in available. Never generate and email plaintext passwords or treat a Nino password as the user's Google password.

**Why:** The user wanted an alternative to signing in through Gmail and explicitly accepted user-chosen passwords instead of emailed passwords.

**How to apply:** Use the authenticated identity provider's password and verification APIs; do not create a second user, store passwords in app data, or unlink Google. Keep password setup optional.
