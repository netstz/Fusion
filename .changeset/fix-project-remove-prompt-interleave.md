---
"@runfusion/fusion": patch
---

Fix `fn project remove` confirmation prompt being obscured by the SQLite ExperimentalWarning. Move the confirmation prompt before `CentralCore` initialization so the warning no longer interleaves with the interactive prompt, causing the command to appear to silently exit.
