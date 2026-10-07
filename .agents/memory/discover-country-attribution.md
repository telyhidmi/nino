---
name: Discover country attribution
description: Product meaning and privacy boundaries of country-based video discovery.
---
Discover country attribution must describe the location where a video was recorded, not the creator's home country or where an existing file was uploaded.

Do not show the long location/privacy explanation in the camera screen. Keep necessary permission prompts and actionable location status notices.

**Why:** The user explicitly requested removing that explanation from the camera, without changing the location requirement.

**Why:** The user's requirement is geographic discovery by creation location. Substituting account country or gallery upload location misattributes travelers' videos and old media. On 2026-10-01 the user explicitly changed the access policy: foreground location permission is mandatory to use Nino, superseding the original optional-permission behavior.

**How to apply:** Require foreground permission only after sign-in, not at public app entry. On 2026-10-04 the user clarified that users must be able to sign up without allowing location; location is required only when signed in. Registration, verification and sign-in must remain accessible without permission. Obtain device location at camera recording start. Save only country and recording time; do not persist coordinates or add background tracking. Permission denial blocks signed-in app access, but a geocoding failure after permission is granted need not prevent recording. Leave gallery uploads, old posts, photos, and failed country lookups unlocated rather than guessing. These posts can still appear in profile/feed, but not country Discover. Device-reported country is not tamper-proof verified geography. Native GPS still needs physical-device verification; backend fixture tests prove grouping, not GPS accuracy.