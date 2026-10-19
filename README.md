# 基基宝

> 基金持仓实时估值 —— 看得见的涨跌

从 [my-bills](../) 拆分出来的独立产品，只保留**登录 + 财富板块**，供推广使用。

## 它解决什么

国内基金平台普遍看不到盘中实时持仓变化。基基宝把你的持仓录进来，接行情源算出实时市值与浮动盈亏。

## 功能范围

- 登录（邀请制，账号由管理员开通）
- 财富首页：总市值、今日盈亏、累计盈亏、分类分布
- 持仓明细：按类别查看、排序、切换本位币
- 持仓详情：K 线、收益走势、AI 分析
- 新增持仓：搜索代码 → 选账户 → 记一笔
- 持仓导入：粘贴文本 / 截图 OCR 识别
- 清仓复盘：已实现收益记录

不含：记账、预算、分类管理、日历、统计报表等记账版功能。

## 技术栈

- 前端：React 18 + TypeScript + Vite + Tailwind CSS
- 本地库：Dexie（IndexedDB），离线可用，启动时增量同步
- 数据库：Supabase（与 my-bills 共用同一个库）
- 后端：Cloudflare Worker `my-bills-api`（行情/估值/AI，多个 Pages 共享）
- 部署：Cloudflare Pages

## 本地开发

```bash
npm install
cp .env.example .env   # 填入 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev            # http://localhost:5174
```

后端接口在本地有两种跑法：

```bash
# A. 直接指向已部署的共享 Worker（推荐，零配置）
echo 'VITE_FUNCTIONS_URL=https://my-bills-api.<你的子域>.workers.dev' >> .env

# B. 本地起 Worker（本仓库已内置，见 worker/）
npm run worker:dev
# 然后把 VITE_FUNCTIONS_URL 指向 http://127.0.0.1:8787
```

## 构建与部署

```bash
npm run build          # 输出到 dist/
npm run typecheck      # 类型检查
```

首次部署：

```bash
npx wrangler pages project create jijibao
npx wrangler pages deploy dist --project-name jijibao
```

云端需要配置：

| 类型 | 名称 | 说明 |
|---|---|---|
| 构建变量 | `VITE_SUPABASE_URL` | Supabase 项目地址 |
| 构建变量 | `VITE_SUPABASE_ANON_KEY` | anon key（公开，RLS 保护） |
| Service binding | `API` | 指向 Worker `my-bills-api` |

`public/_redirects` 已处理 SPA 深链回退（`/wealth/detail/:market/:symbol` 刷新不会 404）。

## 数据库

Schema 的真相源在 [my-bills/supabase/migrations](../supabase/migrations)，本项目**不持有 migration**。

用到的表与函数：

- `public.users` + `login_user` RPC（自建用户名密码登录）
- `public.holdings_transactions`（持仓流水）
- `public.accounts`（投资账户，买卖联动扣减余额）
- `get_sync_meta` RPC（增量同步指纹）
- `get_current_user_id()`（读 `x-user-id` 请求头做 RLS）

## 与原项目的关系

`my-bills` 是财富板块逻辑的真相源。本项目独立演进，只单向 cherry-pick 公共 bugfix（行情源、估值算法、同步引擎）。
