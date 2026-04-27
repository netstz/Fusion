---
"@runfusion/fusion": patch
---

Fix `fn plugin install` failing with three chained errors when installing a directory-based plugin: missing `getRootDir` on the mock taskStore, `ENOTSUP` when trying to copyFile a directory for cache-busting, and `Cannot find module plugin-types.js` from plugin-sdk using broken relative source imports instead of the `@fusion/core` package.
