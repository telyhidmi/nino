---
name: Discover country attribution
description: Product meaning and privacy boundaries of country-based video discovery.
---
Discover country attribution must describe the location where a video was recorded, not the creator's home country or where an existing file was uploaded.

**Why:** The user's requirement is geographic discovery by creation location. Substituting account country or gallery upload location misattributes travelers' videos and old media. Permission denial should not block ordinary publishing.

**How to apply:** Obtain optional foreground device location at camera recording start. Save only country and recording time; do not persist coordinates. Leave gallery uploads, old posts, photos, and failed/denied lookups unlocated rather than guessing. These posts can still appear in profile/feed, but not country Discover. Device-reported country is not tamper-proof verified geography. Native GPS still needs physical-device verification; backend fixture tests prove grouping, not GPS accuracy.