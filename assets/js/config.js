/**
 * Frontend Configuration for Dynamic Pricing Website
 * 
 * Update these settings to match your Cloudflare Worker URL and branding preferences.
 * Note: Never store administrative secrets or Telegram tokens in this file.
 */
window.__APP_CONFIG__ = {
  // Cloudflare Worker API URL.
  // In development, typically "http://localhost:8787".
  // In production on GitHub Pages, set this to your deployed Cloudflare Worker endpoint,
  // e.g. "https://pricing-api.your-subdomain.workers.dev"
  apiUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8787'
    : 'https://pricing-worker.boobool6975.workers.dev',

  // Brand name shown in header and meta
  brandName: 'Subscription Portal',

  // Contact / Order link (e.g. Telegram channel, bot, or customer support)
  contactUrl: 'https://t.me/vpnlopbot',
  contactText: 'Support & Order',

  // Default language: 'fa' (Persian) or 'en' (English)
  defaultLang: 'fa',

  // Cache duration in milliseconds before automatic background refresh (default: 60 seconds)
  cacheTtlMs: 60000,

  // Fallback demo plans for local testing or when explicitly enabled
  enableDemoModeOnFailure: false
};
