// DB Time Clock configuration — this file survives app updates, so deploying a
// new build never clobbers your settings. See SETUP.md.
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
