/**
 * SERVIX Gemini API Proxy — Cloudflare Worker
 * 
 * This worker proxies Gemini API requests from regions where Google AI
 * is not directly available (e.g. Saudi Arabia).
 * 
 * Deploy to Cloudflare Workers (free tier: 100K requests/day):
 * 
 * 1. Go to https://dash.cloudflare.com → Workers & Pages → Create
 * 2. Name it: servix-gemini-proxy
 * 3. Paste this code → Deploy
 * 4. Your proxy URL will be: https://servix-gemini-proxy.<your-subdomain>.workers.dev
 * 5. Set GEMINI_BASE_URL=https://servix-gemini-proxy.<your-subdomain>.workers.dev/v1beta
 *    in your .env file on the server
 */

export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    // Build the target Google API URL
    const targetUrl = 'https://generativelanguage.googleapis.com' + url.pathname + url.search;
    
    // Forward the request to Google
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: request.method === 'POST' ? await request.text() : undefined,
    });
    
    // Return the response with CORS headers
    const responseBody = await response.text();
    return new Response(responseBody, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};
