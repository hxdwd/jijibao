import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { useAuthStore } from './stores/useAuthStore'
import { syncEngine } from './db/sync-engine'
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

  // 初始化登录态（本地 localStorage 恢复）
  useEffect(() => {
    initAuth().catch(() => {
      // initAuth 内部已兜底
    })
  }, [initAuth])

  // 登录后：注册网络恢复监听 + 启动一次同步（拉回持仓与投资账户）
  useEffect(() => {
    if (!user) return
    syncEngine.setupNetworkListener(user.id)
    syncEngine.syncOnStartup(user.id).catch((err) => {
      console.error('[基基宝] 启动同步失败:', err)
    })
  }, [user])

  if (loading) return <LoadingScreen />
  if (!user) return <LoginPage />

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
