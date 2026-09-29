// lib/keys.js
//
// Central namespace for every Redis key used by this app.
// Prevents collisions when this Upstash instance is shared with
// other University of Delhi / Aditi Mahavidyalaya websites.
//
// Default namespace:  du:amv:voicebox:
// Override via env var REDIS_NAMESPACE if the other site expects a
// different prefix (e.g. "du:amv:union" or "aditi:voicebox").

const RAW = process.env.REDIS_NAMESPACE || 'du:amv:voicebox';
const NS = RAW.replace(/:+$/, '');   // strip any trailing colons

export const K = {
  // Master index of every entry ID, newest first
  index: () => `${NS}:index`,

  // One entry, keyed by tracking code (AMV-XXXXXX)
  entry: (id) => `${NS}:entry:${id}`,

  // Admin session tokens (12h TTL)
  session: (token) => `${NS}:session:${token}`,

  // Per-IP failed-login counter (15m TTL)
  loginFail: (ip) => `${NS}:login:fail:${ip}`,
};

export const NAMESPACE = NS;