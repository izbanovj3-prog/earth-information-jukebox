// Copyright (c) 2026 NASA Space Apps Team (teammate prototype, originally MIT). See NOTICE.
// Where the EIC jukebox runs inside the merged app.
// Originally from the teammate prototype (branch feat/earth-jukebox-mvp, src/public/js/env.js).
// The merged app is always a static site: frames + analysed features come pre-baked from
// public/eic/baked/ (made by the prototype's bake.html), samples from public/eic/samples/.
export const STATIC = true;
export const ASSET_BASE = `${import.meta.env?.BASE_URL ?? './'}eic/`;
