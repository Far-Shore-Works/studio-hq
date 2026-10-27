// The player-facing name lives here and nowhere else in code. Change it once, then run
// `node tools/sync-brand.mjs` to rewrite the static files that cannot import it
// (index.html, manifest.webmanifest, privacy.html). tests/brand.test.js fails if they drift.
// The repo folder, the save-key prefix ('topple:v1:') and the seed salt are internal and stay.
export const GAME_NAME = 'Wreckdle';
export const SHARE_HOST = 'wreckdle.farshoreworks.com';   // placeholder until the domain exists
export const TAGLINE = 'A daily tower-toppling game. Three real objects, one slingshot, same tower for everyone.';
