---
"@runfusion/fusion": minor
---

Add `fn project delete` command that fully removes a project: unregisters from central DB, removes git worktrees created by Fusion, and deletes the `.fusion/` directory. Supports `--force` to skip confirmation and running-agents check, and `--keep-files` to only unregister from the central DB.
