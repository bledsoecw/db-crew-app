/* Template for public/config.js — copy it, don't edit it.
 *
 *   Copy-Item config.example.js public\config.js
 *
 * public/config.js holds the live values and is git-ignored, so nothing you do
 * with branches can disturb it. It lives outside public/ deliberately: files in
 * public/ are deployed, and a half-filled template on the live site helps
 * nobody.
 *
 * Two things to know:
 *
 *  - A Firebase Hosting deploy REPLACES the whole site. If public/config.js is
 *    missing or blank when you deploy, the live app loses its settings and every
 *    phone lands on "config.js is not filled in yet". check-config.mjs runs as a
 *    predeploy hook and stops that.
 *
 *  - Keep a copy somewhere outside the repo:
 *      curl.exe -s https://db-crews.web.app/config.js -o C:\dev\config-live-backup.js
 *
 * Where the values come from — full detail in SETUP.md:
 *   apiUrl    Apps Script > Deploy > Manage deployments > Web app URL
 *   clientId  Apps Script > Project Settings > Script Properties > OAUTH_CLIENT_ID
 *             (or Google Cloud console > APIs & Services > Credentials)
 *   firebase/vapidKey   optional, push only. Firebase console > Project settings
 *             > General for the web app config, > Cloud Messaging for the Web
 *             Push certificate. Leave blank and the app still works; it just
 *             can't wake a sleeping phone.
 */
window.DBTC_CONFIG = {
  // The /exec URL of the Apps Script web app deployment.
  apiUrl: '',
  // The Google OAuth web client id the crew signs in with.
  clientId: '',

  // ---- Push notifications (optional) ----
  // Paste the whole object from Firebase console > Project settings > General
  // > your web app > Config. Only apiKey, projectId, messagingSenderId and
  // appId are used, but the extras are harmless and keep it a straight copy.
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  },
  // Project settings > Cloud Messaging > Web Push certificates > Key pair.
  // NOT part of the config object above — a separate credential, 87-88
  // characters starting with "B".
  vapidKey: '',

  // Optional. Pins the Firebase SDK loaded from gstatic. Leave it out to use
  // the version the app ships with. Set it to try a newer or older one when a
  // browser update breaks push — the app reports the URL if it cannot load.
  // fbVersion: '12.19.0'
};
