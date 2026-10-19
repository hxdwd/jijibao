import Dexie, { Table } from 'dexie'

// ============================================================
// IndexedDB Schema — 基基宝（仅持仓 + 投资账户）
// 与记账版 my-bills 完全独立：库名不同，避免同域本地开发时互相覆盖。
// ============================================================

export type SyncStatus = 'synced' | 'local_dirty' | 'pending_delete'

// 同步元数据 (指纹、游标)
export interface SyncMeta {
  key: string
  value: string
}

// 投资账户（买卖联动扣减余额用，其余账户类型不参与）
export interface AccountRecord {
  id: string
  user_id: string
  name: string
  type: 'cash' | 'bank' | 'credit' | 'wechat' | 'alipay' | 'crypto' | 'investment' | 'debt'
  balance: number
  currency: string
  icon: string
  color: string
  sort_order: number
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
  _sync_status: SyncStatus
  _updated_at_local: string
}

// 财富持仓流水（买入/卖出记录，当前持仓由聚合得出）
export interface HoldingTransactionRecord {
  id: string // UUID，对齐远程表与同步引擎的 on_conflict=id
  user_id: string
  symbol: string
  market: 'CN' | 'HK' | 'US' | 'FUND' | 'GOLD'
  name: string
  direction: 'buy' | 'sell'
  quantity: number
  price: number
  date: string // YYYY-MM-DD
  note?: string | null
  account_id?: string | null
  asset_currency?: string | null
  is_active?: boolean
  created_at: string
  updated_at: string
  _sync_status: SyncStatus
  _updated_at_local: string
}

class JijibaoDatabase extends Dexie {
  accounts!: Table<AccountRecord, string>
  holdings_transactions!: Table<HoldingTransactionRecord, string>
  syncMeta!: Table<SyncMeta, string>

  constructor() {
    // 独立库名：与 my-bills 的 MyBillsDB 隔离
    super('JijibaoDB')
    this.version(1).stores({
      accounts: 'id, user_id, _sync_status, type, is_active',
      holdings_transactions:
        'id, user_id, _sync_status, symbol, market, direction, date, account_id, is_active',
      syncMeta: 'key',
    })
  }
}

export const db = new JijibaoDatabase()

// 自修复：schema 升级失败时清空本地库并重建（数据可由远程同步引擎拉回）
db.open().catch(async (err: any) => {
  const msg = String(err?.message || '')
  if (/primary key|changing primary|UpgradeError|DatabaseClosed/i.test(msg)) {
    console.warn('[DB] 检测到 schema 升级冲突，重置本地库以恢复：', msg)
    try {
      await Dexie.delete('JijibaoDB')
      location.reload()
    } catch (e) {
      console.error('[DB] 重置失败', e)
    }
  } else {
    console.error('[DB] 打开失败', err)
  }
})

// 辅助函数：生成新记录的基础字段
export function newRecordBase(userId: string) {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    created_at: now,
    updated_at: now,
    _sync_status: 'local_dirty' as SyncStatus,
    _updated_at_local: now,
  }
}

// 辅助函数：更新记录时刷新同步状态
export function markDirty(record: { _sync_status: SyncStatus; _updated_at_local: string }) {
  record._sync_status = 'local_dirty'
  record._updated_at_local = new Date().toISOString()
  return record
}

// 辅助函数：标记删除
export function markDeleted(record: { _sync_status: SyncStatus; _updated_at_local: string }) {
  record._sync_status = 'pending_delete'
  record._updated_at_local = new Date().toISOString()
  return record
}
