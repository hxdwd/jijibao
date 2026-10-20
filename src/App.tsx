import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { useAuthStore } from './stores/useAuthStore'
import { syncEngine } from './db/sync-engine'
import { db } from './db/database'
import { refreshWealthValuation } from './hooks/useWealthValuation'
import {
  LoginPage,
  WealthHome,
  WealthCategory,
  WealthDetail,
  WealthAdd,
  WealthImport,
  WealthLiquidation,
} from './pages'
import { UpdatePrompt } from './pwa/UpdatePrompt'

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
        <p className="text-ink-2 text-sm">加载中...</p>
      </div>
    </div>
  )
}

function Shell() {
  const { user, loading, initAuth } = useAuthStore()
  // 首次使用（本地库为空）时，等同步完成再渲染页面；
  // 否则页面会先读到空库、白跑一次估值请求，并要等 60 秒轮询才看到数据。
  const [booting, setBooting] = useState(true)

  // 初始化登录态（本地 localStorage 恢复）
  useEffect(() => {
    initAuth().catch(() => {
      // initAuth 内部已兜底
    })
  }, [initAuth])

  // 登录后：注册网络恢复监听 + 启动同步（拉回持仓与投资账户），
  // 同步落地后再主动刷新估值，避免依赖 60 秒轮询。
  useEffect(() => {
    if (!user) return
    let cancelled = false

    void (async () => {
      const hasLocal =
        (await db.holdings_transactions.count()) > 0 || (await db.accounts.count()) > 0
      // 本地已有数据：先用缓存渲染，同步在后台跑（不阻塞首屏）
      if (hasLocal && !cancelled) setBooting(false)

      syncEngine.setupNetworkListener(user.id)
      try {
        await syncEngine.syncOnStartup(user.id)
        // 数据已落地，通知估值层重新聚合（首次登录的关键一步）。
        // 不 await：估值要打行情接口，别把首屏渲染也一起拖住，
        // 页面自己会用 loading 态兜底。
        void refreshWealthValuation()
      } catch (err) {
        console.error('[基基宝] 启动同步失败:', err)
      } finally {
        if (!cancelled) setBooting(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user])

  if (loading) return <LoadingScreen />
  if (!user) return <LoginPage />
  if (booting) return <LoadingScreen />

  return (
    <>
      <Routes>
        <Route path="/" element={<WealthHome />} />
        <Route path="/wealth" element={<Navigate to="/" replace />} />
        {/* 具体路由与通配路由顺序无关（v6 按静态段优先匹配），此处保持可读性 */}
        <Route path="/wealth/add" element={<WealthAdd />} />
        <Route path="/wealth/import" element={<WealthImport />} />
        <Route path="/wealth/liquidation" element={<WealthLiquidation />} />
        <Route path="/wealth/detail/:market/:symbol" element={<WealthDetail />} />
        <Route path="/wealth/:type" element={<WealthCategory />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <UpdatePrompt />
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <Shell />
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
