// DB Time Clock configuration — the live apiUrl, clientId and Firebase keys.
//
// Committed BLANK on purpose: these values never go in the repository. Fill it
// in on the machine you deploy from and keep a copy somewhere outside the repo.
//
// It does NOT survive app updates on its own. `firebase deploy` uploads this
// file like every other file in public/, so a fresh clone — or a branch switch,
// or a merge that restores the committed copy — followed by a deploy replaces
// your live settings with these empty strings, and every phone lands on
// "config.js is not filled in yet".
//
// The service worker hides that for a while, because config.js is in the cached
// shell and the fetch handler is cache-first: phones keep serving the last good
// copy until their cache is dropped, so the outage surfaces hours after the
// deploy that caused it.
//
// ../check-config.mjs runs as a Firebase predeploy hook and refuses to deploy
// this file while it is blank. See SETUP.md.
window.DBTC_CONFIG = {
  // The /exec URL of the Apps Script web app deployment.
  apiUrl: '',
  // The Google OAuth web client id the crew signs in with.
  clientId: '',

  // ---- Push notifications (optional) ----
  // Fill these in to enable the nudge that reaches a phone in a pocket.
  // Leave them blank and the app still works — the in-app escalation and the
  // amber strip on the clock screen carry the requirement, they just can't
  // wake a sleeping phone. Firebase console > Project settings > General
  // (the web app's config) and > Cloud Messaging (the Web Push certificate).
  firebase: {
    apiKey: '',
    projectId: '',
    messagingSenderId: '',
    appId: ''
  },
  vapidKey: ''
};
