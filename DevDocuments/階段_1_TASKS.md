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
- 狀態：done
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
- 狀態：done
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
- 狀態：done
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
- 狀態：done
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
- 狀態：done
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
- 狀態：done
- 內容：
  - Approve/alert 卡片內容區最大高度 + 滾動
  - action buttons sticky
- DoD：
  - 超長內容仍可點到按鈕
- 依賴：T5

---

## P1（室外等距農場場景）

> 參考圖：`ui/螢幕截圖_室外場景.png`（等距像素農場：溫室 ×3、氣象站、小木屋、農田、樹林、河流）
>
> **設計決策**：
> - 視角：**等距 Isometric**（2:1 鑽石 tile）
> - 預設場景：**室內**為主場景，透過出口進入室外
> - 角色：Gaia 和 Astraea 都會出現在室外場景

### T9. Scene 抽象層重構
- 優先級：P1
- 工時：L
- 狀態：done
- 內容：
  - 定義 `SceneConfig` 介面（`frontend/src/scene/core/sceneTypes.ts`）
  - 重組 `frontend/src/scene/` 為 `core/` / `indoor/` / `outdoor/` 子目錄
  - 將現有模組搬移並改名：
    - `renderer.ts` → `indoor/indoorRenderer.ts`
    - `worldState.ts` → `indoor/indoorWorldState.ts`
    - `spriteLoader.ts` → `indoor/indoorSprites.ts`
    - `collision.ts` hit-test → `indoor/indoorHitTest.ts`
  - 建立 `indoor/indoorConfig.ts` 實作 `SceneConfig`
  - 建立通用 `SceneCanvas.tsx` 元件取代硬編碼的 `OfficeScene.tsx`
  - 共用邏輯移入 `core/`（types, gameLoop, pathfinding, character movement）
- DoD：
  - 室內場景重構後功能與畫面完全不變（截圖比對）
  - `SceneConfig` 介面已定義且 `indoorConfig` 實作完成
  - TypeScript strict build 無錯誤
- 依賴：T3, T4

### T10. 等距座標工具
- 優先級：P1
- 工時：S
- 狀態：done
- 內容：
  - 建立 `frontend/src/scene/outdoor/isoMath.ts`：
    - `isoToScreen(col, row)` — grid → screen 像素轉換
    - `screenToIso(sx, sy)` — screen → grid 反轉
    - `isoDepthSort()` — 畫家演算法排序（back-to-front）
    - `drawIsoDiamond()` — 鑽石外框繪製輔助
  - 常數：`ISO_TILE_W = 64`, `ISO_TILE_H = 32`
  - 單元測試：round-trip 座標轉換、depth sort 排序正確性
- DoD：
  - 所有 iso math 函式可用且測試通過
  - TypeScript strict build 無錯誤
- 依賴：T9

### T11. 室外 World State 與 Sprite Loader
- 優先級：P1
- 工時：M
- 狀態：done
- 內容：
  - 建立 `frontend/src/scene/outdoor/outdoorWorldState.ts`：
    - 16×12 grid，tile 類型：草地、泥地、水、小徑
    - 定義互動建築位置（溫室 ×3、氣象站、小木屋）
    - 樹林邊界、農田、河流 tile
    - `OUTDOOR_DECO_TILE_SIZE` 碰撞尺寸表
    - `createOutdoorWorldState()` 工廠函式
  - 建立 `frontend/src/scene/outdoor/outdoorSprites.ts`：
    - `loadOutdoorSprites()` 載入所有等距素材
    - 先用 placeholder（彩色鑽石方塊）讓開發可先行
  - 資產目錄：`frontend/public/assets/outdoor/`
- DoD：
  - `createOutdoorWorldState()` 回傳有效 WorldState
  - BFS pathfinding 在室外 grid 上可正確運作
  - TypeScript strict build 無錯誤
- 依賴：T9, T10

### T12. 等距渲染器
- 優先級：P1
- 工時：L
- 狀態：done
- 內容：
  - 建立 `frontend/src/scene/outdoor/outdoorRenderer.ts`：
    - 地面 pass：逐行繪製鑽石 tile（`isoToScreen` 座標映射）
    - 深度排序物件 pass：裝飾 + 建築 + 角色排序後繪製（畫家演算法）
    - 角色 sprite 等距定位（Phase 1：複用 4 方向 sprite + 方向重映射，Phase 2 於 T16 升級為 8 方向）
    - 方向重映射表：grid-UP→NW(LEFT sprite), DOWN→SE(DOWN), LEFT→SW(LEFT mirror), RIGHT→NE(RIGHT)
    - 選取高亮：鑽石外框（非矩形）
    - 路徑可視化：沿等距路徑的行進螞蟻線
    - 角色陰影、名稱標籤、狀態 emoji 泡泡（複用室內渲染邏輯）
  - 建立 `frontend/src/scene/outdoor/outdoorHitTest.ts`：
    - `screenToIso` 為基礎的 tile hit-test
    - 建築包圍盒 hit-test（考慮建築高度）
    - 優先順序：角色 > 建築 > 裝飾 > 地面
  - 建立 `frontend/src/scene/outdoor/outdoorConfig.ts` 實作 `SceneConfig`
- DoD：
  - 等距地面 tile 正確以鑽石投影繪製
  - 建築和樹木的深度排序正確（無視覺重疊錯誤）
  - 角色在等距 grid 上行走視覺插值正確
  - 滑鼠點擊能正確辨識 tile / 建築 / 角色
  - TypeScript strict build 無錯誤
- 依賴：T10, T11

### T13. 場景切換導航
- 優先級：P1
- 工時：M
- 狀態：done
- 內容：
  - 建立 `frontend/src/hooks/useSceneNavigation.ts`：
    - 狀態機：`current: 'indoor' | 'outdoor'`，transition: idle / fading-out / fading-in
    - `goTo(sceneId)` 觸發淡出 → 切換 → 淡入（~400ms CSS opacity）
  - 更新 `App.tsx`：
    - 預設場景：**indoor**（室內為主場景）
    - 條件渲染對應的 `<SceneCanvas config={...}>`
    - CSS transition wrapper 做淡入淡出
  - 室內 → 室外：在室內場景新增「出口」裝飾/區域（例如門口），點擊觸發 `goTo('outdoor')`
  - 室外 → 室內：點擊小木屋（資材室）觸發 `goTo('indoor')`
  - 角色跨場景保留 statusEmoji，進入場景時 snap 到各自 home 位置
  - WebSocket 廣播 `scene:changed` 讓其他分頁同步
- DoD：
  - 點小木屋 → 淡入室內；點室內出口 → 淡入室外
  - 角色狀態跨場景保留
  - 其他分頁 WebSocket 同步場景切換
  - 無 console 錯誤，TypeScript strict build 無錯誤
- 依賴：T9, T12

### T14. 溫室數據面板
- 優先級：P1
- 工時：M
- 狀態：done
- 內容：
  - **Backend**：建立 `backend/src/greenhouse/` NestJS module
    - `GET /api/greenhouse` — 列出栽培數據
    - `POST /api/greenhouse` — 新增栽培條目
    - `PATCH /api/greenhouse/:id` — 更新條目
    - 資料模型：`{ id, plantType, stage, plantedDate, expectedHarvest, notes, references[] }`
  - **Frontend**：建立 `frontend/src/components/GreenhousePanel.tsx`（modal）
    - Tabs：「栽培數據」/「參考文獻」
    - 栽培 tab：植物卡片列表（seed / sprout / growing / harvest 階段指示）
    - 文獻 tab：連結列表
  - WebSocket：`greenhouse:changed` 跨分頁同步
- DoD：
  - 點室外場景溫室 → 開啟面板
  - 可查看、新增栽培條目
  - 文獻 tab 顯示已收集連結
  - 跨分頁 WebSocket 同步
- 依賴：T12

### T15. 氣象站面板
- 優先級：P1
- 工時：M
- 狀態：done
- 內容：
  - **Backend**：建立 `backend/src/weather/` NestJS module
    - `GET /api/weather/current` — 目前天氣
    - `GET /api/weather/forecast` — 5 日預報
    - 外部 API 整合（OpenWeatherMap / weatherapi.com）
    - 快取：最多每 30 分鐘取一次外部 API
    - 未設 API key 時回傳 mock data
  - **Frontend**：建立 `frontend/src/components/WeatherPanel.tsx`（modal）
    - 目前天氣：溫度、濕度、風速、天氣圖示
    - 5 日預報：每日高低溫、降雨機率
    - 開啟面板時自動刷新
- DoD：
  - 點氣象站 → 開啟天氣面板
  - 顯示真實天氣數據（或無 API key 時優雅降級為 mock）
  - 5 日預報正確渲染
- 依賴：T12

### T16. 等距素材製作（含 8 方向角色 sprite）
- 優先級：P1
- 工時：M
- 狀態：done
- 內容：
  - 製作或取得所有等距像素素材：
    - 地面 tile：`iso_grass.png`、`iso_dirt.png`、`iso_water.png`、`iso_path.png`（64×32）
    - 建築：`greenhouse.png`、`weather_station.png`、`cabin.png`
    - 植被：`tree_1.png`、`tree_2.png`、`bush.png`
    - 農田：`crop_plot_empty.png`、`crop_plot_growing.png`、`crop_plot_ready.png`
  - 統一等距透視（2:1 比例、左上光源）
  - 放置於 `frontend/public/assets/outdoor/`
  - 替換 placeholder，驗證深度排序
  - **8 方向等距角色 sprite（Phase 2 升級）**：
    - 製作 `gaia_iso.png`、`astraea_iso.png`
    - 每角色 8 方向（N/NE/E/SE/S/SW/W/NW）× 4 walk frames = 32 frames
    - 來源尺寸：16×24px（chibi 比例，比室內 16×32 矮胖）
    - 4× scale → 64×96px 繪製尺寸
    - Sprite sheet 佈局：128×192px（4 cols × 8 rows）
    - 更新 `outdoorRenderer.ts` 中的角色渲染邏輯，從 4 方向重映射切換為 8 方向直接讀取
- DoD：
  - 所有 placeholder 替換為像素素材
  - 深度排序無視覺瑕疵
  - 角色在等距場景中 8 方向行走動畫流暢
  - 場景整體風格統一（與室內場景一致的像素美術風格）
- 依賴：T11, T12

### T17. 室外場景整合測試與打磨
- 優先級：P1
- 工時：S
- 狀態：todo
- 內容：
  - 端到端流程測試：室內 → 室外 → 點溫室/氣象站/小木屋 → 回室內
  - 角色在室外場景的閒逛行為
  - Jetson 硬體上 60fps 效能驗證
  - 跨分頁 WebSocket 場景同步
  - 修復視覺瑕疵、z-ordering、hit-test 邊界問題
- DoD：
  - 全流程無錯誤
  - Jetson 上穩定 60fps
  - 所有面板正確開關
  - 場景切換平順（無閃爍、無殘留狀態）
- 依賴：T12, T13, T14, T15, T16

---

## P2（擴展功能）

### T18. Agent 詳情側欄
- 優先級：P2
- 工時：S
- 狀態：todo
- 內容：
  - 顯示 skills/tools/cron mapping（先只讀）
- DoD：
  - 點 avatar 可開關 drawer
- 依賴：T4, T7

### T19. 每日 token heatmap（GitHub 方格）
- 優先級：P2
- 工時：M
- 狀態：todo
- 內容：
  - 聚合 daily usage
  - 前端方格圖顯示
- DoD：
  - 近 30 天可視化
- 依賴：T6, T7

### T20. IoT 狀態面板（Adapter）
- 優先級：P2
- 工時：M
- 狀態：todo
- 內容：
  - 先接一種來源（API 或 MQTT）
- DoD：
  - 顯示 online/offline 與最後心跳
- 依賴：T6

### T21. 事件驅動動畫
- 優先級：P2
- 工時：M
- 狀態：todo
- 內容：
  - 新告警 → 走布告欄
  - dashboard 更新 → 走 dashboard
- DoD：
  - 3 種事件觸發動畫正確
- 依賴：T3, T5, T6

---

## P3（進階能力）

### T22. 受控寫入（Config/操作）
- 優先級：P3
- 工時：L
- 狀態：todo
- 內容：
  - diff 預覽
  - 二次確認
  - rollback
- DoD：
  - 寫入失敗可回復
- 依賴：P0 全部完成

### T23. Policy/角色權限
- 優先級：P3
- 工時：M
- 狀態：todo
- 內容：
  - viewer/operator/admin
- DoD：
  - 不同角色可見/可操作範圍正確
- 依賴：T22

---

## 建議執行順序

```text
P0（全部完成）:
T0 ✅ → T1 ✅ → T2 ✅ → T3 ✅
                           ↓
                        T4 ✅（互動層 + 碰撞）
                         ↙           ↘
                    T5 ✅（公布欄）  T6 ✅（Dashboard）
                         ↓               ↓
                    T8 ✅（UX修補）  T7 ✅（OpenClaw整合）
                                         ↓
                                   P0 freeze ✅
                                         ↓
P1（室外等距農場）:
  T9 ✅（Scene 抽象層重構）
   ↓
  T10 ✅（等距座標工具）
   ↓
  T11 ✅（室外 WorldState + Sprites）──→ T16 ✅（素材製作）
   ↓
  T12 ✅（等距渲染器）
   ↓ ↘ ↘
  T13 ✅（場景切換）  T14 ✅（溫室面板）  T15 ✅（氣象站面板）
                          ↓
                    T17（整合測試）
                          ↓
                    P1 freeze → demo
                          ↓
P2（T18–T21）→ P3（T22–T23）
```

---

## 風險與備案

### P0 風險
- 風險：OpenClaw CLI 輸出格式變動
  - 備案：parser 做容錯 + adapter 抽象
- 風險：資料更新頻率太高導致 UI 卡頓
  - 備案：前端節流 + 增量更新
- 風險：碰撞邊界阻斷走到某些 walk target 的路徑
  - 備案：加入 `allowedBypass` 清單，讓特殊目標（board/dashboard walk positions）強制可走

### P1 風險
- 風險：T9 Scene 抽象層重構破壞 P0 功能
  - 備案：獨立分支開發，截圖比對回歸測試
- 風險：等距座標計算錯誤導致渲染/點擊偏移
  - 備案：單元測試 round-trip 轉換；先用 4×4 小 grid 驗證再擴大
- 風險：深度排序邊緣案例（建築與角色重疊）
  - 備案：以物件「腳部 row」排序；同 row 用 sub-pixel tie-breaking
- 風險：Jetson 上等距渲染效能不足
  - 備案：預渲染 tile 圖片（非程式鑽石填充）；靜態元素用離屏 canvas
- 風險：等距素材製作延遲
  - 備案：placeholder 可先行開發；考慮 Kenney.nl 免費等距 tileset 過渡
- 風險：天氣 API 不穩定
  - 備案：30 分鐘快取 + mock data 優雅降級

### P2+ 風險
- 風險：IoT 資料源不穩
  - 備案：先用 mock/快取，來源恢復後回填

---

## 驗收清單

### MVP（P0）
- [ ] 可以看到 Gaia/Astraea 狀態與 emoji
- [ ] 可點選 canvas 物件並獲得回饋
- [ ] 角色行走不穿越障礙物
- [ ] 可以看公告欄（任務/警示）
- [ ] 可以看 dashboard 基礎摘要
- [ ] 長內容不會擠爆按鈕
- [ ] 所有功能在 read-only 模式可穩定展示

### 室外場景（P1）
- [ ] 等距農場場景正確渲染（地面、建築、樹木、河流）
- [ ] 角色可在等距場景中行走，深度排序正確
- [ ] 點溫室 → 開啟栽培數據/文獻面板
- [ ] 點氣象站 → 開啟真實天氣/預報面板
- [ ] 點小木屋 → 淡入室內場景；室內出口 → 淡入室外
- [ ] 場景切換跨分頁 WebSocket 同步
- [ ] Jetson 上穩定 60fps
