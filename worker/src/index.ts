/**
 * Cloudflare Worker Entrypoint
 * Dynamic Pricing API & Telegram Bot Webhook
 */

import { Env, TelegramUpdate } from './types';
import { getCurrentPrices, publishPrices, rollbackPrices } from './storage';
import { parsePriceList } from './parser';
import { validatePriceList } from './validation';
import { verifyTelegramWebhook, verifyAdminApiAuth } from './auth';
import { handleTelegramUpdate } from './telegram';

/**
 * Build standard CORS headers
 */
function getCorsHeaders(env: Env, request: Request): HeadersInit {
  const origin = request.headers.get('Origin') || '*';
  const allowedOrigin = env.CORS_ORIGIN === '*' ? origin : (env.CORS_ORIGIN || '*');

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Secret, X-Telegram-Bot-Api-Secret-Token',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

/**
 * Build JSON response helper with CORS
 */
function jsonResponse(data: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders
    }
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method.toUpperCase();
    const corsHeaders = getCorsHeaders(env, request);

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    try {
      // 1. Health check: GET /api/health
      if (pathname === '/api/health' && method === 'GET') {
        return jsonResponse(
          {
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'dynamic-pricing-worker',
            version: '1.0.0'
          },
          200,
          corsHeaders
        );
      }

      // 2. Public prices: GET /api/prices
      if (pathname === '/api/prices' && method === 'GET') {
        const defaultTitle = env.DEFAULT_TITLE || 'Special Plans';
        const defaultCurrency = env.DEFAULT_CURRENCY || 'TOMAN';

        const data = await getCurrentPrices(env.PRICING_KV);

        const responsePayload = data || {
          title: defaultTitle,
          currency: defaultCurrency,
          updatedAt: new Date().toISOString(),
          plans: []
        };

        return jsonResponse(responsePayload, 200, {
          ...corsHeaders,
          'Cache-Control': 'public, max-age=60, s-maxage=60'
        });
      }

      // 3. Telegram Webhook: POST /api/telegram/webhook
      if (pathname === '/api/telegram/webhook' && method === 'POST') {
        // Verify Telegram secret token
        if (!verifyTelegramWebhook(request, env)) {
          return jsonResponse({ error: 'Unauthorized webhook request' }, 401);
        }

        const update = (await request.json()) as TelegramUpdate;
        return await handleTelegramUpdate(update, env);
      }

      // 4. Admin API: POST /api/admin/prices/preview
      if (pathname === '/api/admin/prices/preview' && method === 'POST') {
        if (!verifyAdminApiAuth(request, env)) {
          return jsonResponse({ error: 'Unauthorized admin operation' }, 401, corsHeaders);
        }

        const body = await request.json() as { text?: string };
        const text = body.text || '';
        const defaultTitle = env.DEFAULT_TITLE || 'Special Plans';
        const defaultCurrency = env.DEFAULT_CURRENCY || 'TOMAN';

        const parseResult = parsePriceList(text, defaultTitle, defaultCurrency);
        const validation = validatePriceList(text, parseResult, defaultCurrency);

        return jsonResponse(
          {
            parsed: parseResult,
            validation
          },
          200,
          corsHeaders
        );
      }

      // 5. Admin API: POST /api/admin/prices/publish
      if (pathname === '/api/admin/prices/publish' && method === 'POST') {
        if (!verifyAdminApiAuth(request, env)) {
          return jsonResponse({ error: 'Unauthorized admin operation' }, 401, corsHeaders);
        }

        const body = await request.json() as { text?: string; title?: string; plans?: any[] };
        const defaultCurrency = env.DEFAULT_CURRENCY || 'TOMAN';

        if (body.text) {
          const defaultTitle = env.DEFAULT_TITLE || 'Special Plans';
          const parseResult = parsePriceList(body.text, defaultTitle, defaultCurrency);
          const validation = validatePriceList(body.text, parseResult, defaultCurrency);

          if (!validation.isValid) {
            return jsonResponse({ error: 'Validation failed', details: validation.errors }, 400, corsHeaders);
          }

          const published = await publishPrices(env.PRICING_KV, {
            title: parseResult.title || defaultTitle,
            plans: parseResult.plans,
            currency: defaultCurrency
          });

          return jsonResponse({ success: true, data: published }, 200, corsHeaders);
        } else if (body.plans && Array.isArray(body.plans)) {
          const title = body.title || env.DEFAULT_TITLE || 'Special Plans';
          const published = await publishPrices(env.PRICING_KV, {
            title,
            plans: body.plans,
            currency: defaultCurrency
          });
          return jsonResponse({ success: true, data: published }, 200, corsHeaders);
        } else {
          return jsonResponse({ error: 'Missing text or plans payload' }, 400, corsHeaders);
        }
      }

      // 6. Admin API: POST /api/admin/prices/undo
      if (pathname === '/api/admin/prices/undo' && method === 'POST') {
        if (!verifyAdminApiAuth(request, env)) {
          return jsonResponse({ error: 'Unauthorized admin operation' }, 401, corsHeaders);
        }

        const restored = await rollbackPrices(env.PRICING_KV);
        if (!restored) {
          return jsonResponse({ error: 'No previous version available to restore' }, 404, corsHeaders);
        }

        return jsonResponse({ success: true, data: restored }, 200, corsHeaders);
      }

      // 404 Not Found
      return jsonResponse({ error: 'Not Found' }, 404, corsHeaders);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal Server Error';
      console.error('Unhandled Worker error:', err);
      return jsonResponse({ error: 'Internal Server Error', message }, 500, corsHeaders);
    }
  }
};
