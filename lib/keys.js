// lib/keys.js
//
// Central namespace for every Redis key used by this app.
// Prevents collisions when this Upstash instance is shared with
// other University of Delhi college websites.
//
// Default namespace:  du:arc:voicebox:
// Override via env var REDIS_NAMESPACE if you want a different prefix.

const RAW = process.env.REDIS_NAMESPACE || 'du:arc:voicebox';
const NS = RAW.replace(/:+$/, '');   // strip any trailing colons

export const K = {
  // Master index of every entry ID, newest first
  index: () => `${NS}:index`,

  // One entry, keyed by tracking code (ARC-XXXXXX)
  entry: (id) => `${NS}:entry:${id}`,

  // Admin session tokens (12h TTL)
  session: (token) => `${NS}:session:${token}`,

  // Per-IP failed-login counter (15m TTL)
  loginFail: (ip) => `${NS}:login:fail:${ip}`,
};

export const NAMESPACE = NS;