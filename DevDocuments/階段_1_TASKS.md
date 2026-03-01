# 階段_1_TASKS — OpenClaw PixelAgent

## 目標
在不動高風險寫入功能的前提下，先做出可用的 Pixel UI + 公布欄 + 只讀 Dashboard（MVP）。

---

## 任務狀態定義
- `todo`：尚未開始
- `doing`：進行中
- `blocked`：被依賴或外部因素卡住
- `done`：完成並驗收

---

## P0（先做，MVP 必要）

### T0. 開發環境確認與隔離基線
- 優先級：P0
- 工時：S
- 狀態：done
- 內容：
  - 確認 Node / npm / nvm 可用
  - 建立 `.nvmrc` 並固定 Node 版本（建議 20）
  - 確認 `package-lock.json` 策略（CI 使用 `npm ci`）
  - 檢查 `.gitignore` 是否覆蓋本地開發噪音檔（如 `.env`, logs, build outputs）
- DoD：
  - `node -v` / `npm -v` 可用且版本記錄完成
  - `.nvmrc` 已存在
  - 環境檢查結果寫入專案文件（可放 DevDocuments）
- 依賴：無

### T1. 專案骨架初始化（NestJS + 前端）
- 優先級：P0
- 工時：M
- 狀態：done
- 內容：
  - 建立 backend（NestJS/Fastify）
  - 建立 frontend（React/Vite 或 Next.js）
  - 設定 monorepo 或前後端分離
- DoD：
  - 可本機啟動前後端
  - `/health` 回 200
  - 前端首頁可顯示版本資訊
- 依賴：無

### T2. Agent 狀態模型與 emoji 引擎
- 優先級：P0
- 工時：S
- 狀態：doing
- 內容：
  - 定義 agent status enum
  - 狀態 -> emoji 映射
- DoD：
  - 可透過 mock API 改變 Gaia/Astraea 狀態並反映在 UI
- 依賴：T1

### T3. Pixel Scene 基礎畫面
- 優先級：P0
- 工時：M
- 狀態：done
- 內容：
  - 顯示 Gaia/Astraea 角色與走動動畫
  - 木質牆面、時鐘掛牆、裝飾品佈局
  - 佈告欄 / 儀表板 5×3 掛牆大圖
  - 盆栽垂直隔板分割左右區域
- DoD：
  - 可觸發 walk-to-board / walk-to-dashboard 動畫
  - 場景畫面截圖驗收通過
- 依賴：T1, T2

### T4. Canvas 物件點選 / 互動層（含碰撞邊界）
- 優先級：P0
- 工時：M
- 狀態：todo
- 內容：
  - **Hit-test 系統**：滑鼠點擊 canvas 時，依 `DECO_TILE_SIZE` 邊界判斷點到哪個物件
    - 可點選：角色（Gaia/Astraea）、佈告欄區域、儀表板區域、裝飾品
    - hover 可點選物件時游標改為 `pointer`
  - **選取狀態**：`selectedObject: { kind, id } | null`，存於 worldRef
  - **視覺回饋**：被選中物件顯示白色高亮外框 / 光暈（在 render pass 中繪製）
  - **事件回調**：`OfficeSceneHandle` 新增 `onSelect` callback，點選後通知 React parent
  - **碰撞邊界**：共用 hit-test 邊界資料，建立 `computeBlockedTiles(decorations, DECO_TILE_SIZE)`
    - 回傳 `Set<"col,row">` 標記不可走格子
    - BFS `findPath` 將這些格子視為障礙
    - 角色不再穿越書架、電腦桌、沙發、家電
  - **走道驗證**：盆栽牆（col 14, rows 1–8）封閉，rows 9–11 為唯一跨區通道，需確認 Astraea → 佈告欄路徑可達
- DoD：
  - 點 Gaia → 高亮 + callback 回傳 `{ kind: 'character', id: 'gaia' }`
  - 點佈告欄區域 → 高亮 + callback 回傳 `{ kind: 'board' }`
  - 點儀表板區域 → 高亮 + callback 回傳 `{ kind: 'dashboard' }`
  - 點空白地板 → 取消選取
  - 角色不穿越書架、電腦桌等障礙物
  - Astraea 從 home (22, 7) 走到佈告欄 (2, 2) 路徑正確（繞過盆栽牆底部）
  - TypeScript strict build 無錯誤
- 依賴：T3

### T5. 公布欄（Task Board + Alerts）
- 優先級：P0
- 工時：M
- 狀態：todo
- 內容：
  - Tab: System Alerts / Task Board
  - 任務基本欄位（標題、指派、狀態、優先級）
- DoD：
  - 能新增任務、更新狀態、查看警示
  - 長內容可折疊
- 依賴：T1, T4

### T6. Dashboard 只讀摘要
- 優先級：P0
- 工時：M
- 狀態：todo
- 內容：
  - Gateway 狀態
  - Agent model / session token 概況
  - Host 基礎資源（CPU/RAM）
- DoD：
  - API `GET /dashboard/summary` 可用
  - 前端可顯示最後更新時間
- 依賴：T1, T4

### T7. OpenClaw 讀取整合（status + cron）
- 優先級：P0
- 工時：M
- 狀態：todo
- 內容：
  - 輪詢 `openclaw status`
  - 輪詢 cron list/runs（主要 job）
  - parser 轉換為結構資料
- DoD：
  - summary API 能展示真實 OpenClaw 數據
- 依賴：T6

### T8. 卡片 UX 修補

- 優先級：P0
- 工時：S
- 狀態：todo
- 內容：
  - Approve/alert 卡片內容區最大高度 + 滾動
  - action buttons sticky
- DoD：
  - 超長內容仍可點到按鈕
- 依賴：T5

---

## P1（MVP 完成後）

### T9. Agent 詳情側欄
- 優先級：P1
- 工時：S
- 狀態：todo
- 內容：
  - 顯示 skills/tools/cron mapping（先只讀）
- DoD：
  - 點 avatar 可開關 drawer
- 依賴：T4, T7

### T10. 每日 token heatmap（GitHub 方格）

- 優先級：P1
- 工時：M
- 狀態：todo
- 內容：
  - 聚合 daily usage
  - 前端方格圖顯示
- DoD：
  - 近 30 天可視化
- 依賴：T6, T7

### T11. IoT 狀態面板（Adapter）
- 優先級：P1
- 工時：M
- 狀態：todo
- 內容：
  - 先接一種來源（API 或 MQTT）
- DoD：
  - 顯示 online/offline 與最後心跳
- 依賴：T6

### T12. 事件驅動動畫
- 優先級：P1
- 工時：M
- 狀態：todo
- 內容：
  - 新告警 -> 走布告欄
  - dashboard 更新 -> 走 dashboard
- DoD：
  - 3 種事件觸發動畫正確
- 依賴：T3, T5, T6

---

## P2（進階能力）

### T13. 受控寫入（Config/操作）
- 優先級：P2
- 工時：L
- 狀態：todo
- 內容：
  - diff 預覽
  - 二次確認
  - rollback
- DoD：
  - 寫入失敗可回復
- 依賴：P0 全部完成

### T14. Policy/角色權限
- 優先級：P2
- 工時：M
- 狀態：todo
- 內容：
  - viewer/operator/admin
- DoD：
  - 不同角色可見/可操作範圍正確
- 依賴：T13

---

## 建議執行順序

```text
T0 ✅ → T1 ✅ → T2 (doing) → T3 ✅
                                ↓
                         T4（互動層 + 碰撞）
                          ↙           ↘
                    T5（公布欄）   T6（Dashboard）
                         ↓               ↓
                    T8（UX修補）    T7（OpenClaw整合）
                                         ↓
                                   P0 freeze → demo
```

---

## 風險與備案
- 風險：OpenClaw CLI 輸出格式變動
  - 備案：parser 做容錯 + adapter 抽象
- 風險：資料更新頻率太高導致 UI 卡頓
  - 備案：前端節流 + 增量更新
- 風險：IoT 資料源不穩
  - 備案：先用 mock/快取，來源恢復後回填
- 風險：碰撞邊界阻斷走到某些 walk target 的路徑
  - 備案：加入 `allowedBypass` 清單，讓特殊目標（board/dashboard walk positions）強制可走

---

## 驗收清單（MVP）
- [ ] 可以看到 Gaia/Astraea 狀態與 emoji
- [ ] 可點選 canvas 物件並獲得回饋
- [ ] 角色行走不穿越障礙物
- [ ] 可以看公告欄（任務/警示）
- [ ] 可以看 dashboard 基礎摘要
- [ ] 長內容不會擠爆按鈕
- [ ] 所有功能在 read-only 模式可穩定展示
