/**
 * my-bills-api — 共享后端 Worker
 *
 * 由多个 Cloudflare Pages 项目通过 Service binding（env.API）调用，
 * 因此密钥（DEEPSEEK_API_KEY 等）与 KV（QUOTE_CACHE）只需在此配置一份。
 *
 * 路由与原 Pages Functions 的路径完全一致，前端无需改动：
 *   GET  /api/quote/search
 *   GET  /api/quote/detail
 *   GET  /api/quote/history
 *   POST /api/quote/history-batch
 *   POST /api/valuation/batch
 *   POST /api/wealth/ai-analyze
 *   POST /api/wealth/import-screenshot
 *   POST /api/expend/goal-chat
 */

import { onRequestGet as quoteSearch } from './handlers/quote/search'
import { onRequestGet as quoteDetail } from './handlers/quote/detail'
import { onRequestGet as quoteHistory } from './handlers/quote/history'
import { onRequestPost as quoteHistoryBatch } from './handlers/quote/history-batch'
import { onRequestPost as valuationBatch } from './handlers/valuation/batch'
import { onRequestPost as wealthAiAnalyze } from './handlers/wealth/ai-analyze'
import { onRequestPost as wealthImportScreenshot } from './handlers/wealth/import-screenshot'
import { onRequestPost as expendGoalChat } from './handlers/expend/goal-chat'

type Ctx = { request: Request; env: any }
type Handler = (ctx: Ctx) => Promise<Response>

const ROUTES: Record<string, Handler> = {
  'GET /api/quote/search': quoteSearch,
  'GET /api/quote/detail': quoteDetail,
  'GET /api/quote/history': quoteHistory,
  'POST /api/quote/history-batch': quoteHistoryBatch,
  'POST /api/valuation/batch': valuationBatch,
  'POST /api/wealth/ai-analyze': wealthAiAnalyze,
  'POST /api/wealth/import-screenshot': wealthImportScreenshot,
  'POST /api/expend/goal-chat': expendGoalChat,
}

const ALLOWED_ORIGIN = '*' // 收紧时改为读取 env.ALLOWED_ORIGINS 白名单

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') || ALLOWED_ORIGIN
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN === '*' ? '*' : origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }
}

function withCors(response: Response, request: Request): Response {
  const headers = new Headers(response.headers)
  for (const [k, v] of Object.entries(corsHeaders(request))) headers.set(k, v)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function json(payload: unknown, status: number, request: Request): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request) },
  })
}

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) })
    }

    const { pathname } = new URL(request.url)

    if (pathname === '/api/health') {
      return json(
        {
          code: 0,
          message: 'ok',
          data: {
            service: 'my-bills-api',
            hasQuoteCache: !!env.QUOTE_CACHE,
            hasDeepseek: !!env.DEEPSEEK_API_KEY,
            hasTavily: !!env.TAVILY_API_KEY,
          },
        },
        200,
        request,
      )
    }

    const handler = ROUTES[`${request.method} ${pathname}`]
    if (!handler) {
      return json({ code: 404, message: `未知接口: ${request.method} ${pathname}` }, 404, request)
    }

    try {
      const res = await handler({ request, env })
      return withCors(res, request)
    } catch (e: any) {
      console.error('[my-bills-api] handler error', pathname, e)
      return json({ code: 500, message: '服务器内部错误' }, 500, request)
    }
  },
}
