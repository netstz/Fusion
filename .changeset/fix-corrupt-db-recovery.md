---
"@runfusion/fusion": patch
---

Fix `Error: file is not a database` crash on `fn task list`, `fn dashboard`, and all other commands when the project's `fusion.db` is a truncated stub (16 bytes) from an interrupted `fn init`. The stub is now detected by a pre-flight file-size check (< 100 bytes) and deleted before opening, allowing SQLite to create a fresh database automatically.
