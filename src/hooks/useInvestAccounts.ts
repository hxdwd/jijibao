import { useCallback, useEffect, useState } from 'react'
import { db } from '../db/database'
import type { AccountRecord } from '../db/database'
import { syncEngine } from '../db/sync-engine'
import { useAuthStore } from '../stores/useAuthStore'

/**
 * 轻量替代记账版的 AppContext.useApp()。
 *
 * 基基宝只关心「投资账户」：持仓买卖时用来选资金账户、并扣减/回补账户余额。
 * 直接读本地 Dexie（数据由 syncEngine 启动同步拉回），不引入记账版的
 * 9 张表全量上下文。
 */
export function useInvestAccounts() {
  const userId = useAuthStore((s) => s.user?.id)
  const [accounts, setAccounts] = useState<AccountRecord[]>([])

  const load = useCallback(async () => {
    try {
      const rows = await db.accounts.toArray()
      setAccounts(rows.filter((r) => r._sync_status !== 'pending_delete'))
    } catch (err) {
      console.error('[基基宝] 读取投资账户失败:', err)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const updateAccount = useCallback(
    async (id: string, data: Partial<Pick<AccountRecord, 'name' | 'balance' | 'currency' | 'icon' | 'color'>>) => {
      const now = new Date().toISOString()
      const patch: Partial<AccountRecord> = {
        ...data,
        updated_at: now,
        _sync_status: 'local_dirty',
        _updated_at_local: now,
      }
      await db.accounts.update(id, patch)
      setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)))

      if (userId) {
        syncEngine.syncAfterWrite('accounts', userId).catch((err) => {
          console.error('[基基宝] 后台同步账户失败:', err)
        })
      }
    },
    [userId],
  )

  return { accounts, updateAccount }
}
