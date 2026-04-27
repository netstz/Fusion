---
"@runfusion/fusion": patch
---

Fix `fn init` writing a 16-byte SQLite magic-header stub instead of a real database. Every subsequent command (`fn task list`, `fn dashboard`, etc.) would open that stub and immediately throw `Error: file is not a database`. The stub write is replaced with a proper `TaskStore` construction that initialises the full schema on disk.
