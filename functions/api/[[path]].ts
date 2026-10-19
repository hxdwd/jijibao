/**
 * 把所有 /api/* 请求原样转发给共享后端 Worker。
 *
 * 优先级：
 *   1. Service binding（env.API）—— 推荐，同源、不过公网、无需 CORS
 *   2. 环境变量 API_BASE_URL —— 兜底，直接反代到 Worker 公网地址
 *
 * 前端路径保持不变（/api/quote/search 等），所以无需改动任何请求代码。
 */

interface Env {
  /** Service binding 到 my-bills-api */
  API?: Fetcher
  /** 兜底：Worker 公网地址，如 https://my-bills-api.xxx.workers.dev */
  API_BASE_URL?: string
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  // 1) Service binding
  if (env.API) {
    return env.API.fetch(request)
  }

  // 2) 反代到 Worker 公网地址
  if (env.API_BASE_URL) {
    const url = new URL(request.url)
    const target = new URL(url.pathname + url.search, env.API_BASE_URL)
    const proxyReq = new Request(target, request)
    return fetch(proxyReq)
  }

  return new Response(
    JSON.stringify({
      code: 503,
      message: '后端未配置：请为 Pages 项目添加 Service binding「API」或环境变量 API_BASE_URL',
    }),
    { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8' } },
  )
}
