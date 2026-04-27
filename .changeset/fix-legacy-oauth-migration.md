---
"@runfusion/fusion": patch
---

Fix "No API key for provider: github-copilot" error when credentials are stored in legacy `~/.pi/agent/auth.json`. Legacy OAuth credentials are now migrated into `~/.fusion/agent/auth.json` on startup so the primary AuthStorage can handle token refresh.
