# Version Log — OpenClaw PixelAgent

## v0.2.1 — 2026-03-06

> P1 室外等距農場場景核心完成

### 新功能

- **等距戶外場景**：草地、泥地、河流、樹林、農田的 isometric 渲染
- **溫室數據面板** (T14)：栽培數據 CRUD + 參考文獻管理
- **氣象站面板** (T15)：即時天氣 + 5 日預報（OpenWeatherMap 整合，無 API key 時 mock 降級）
- **場景切換導航** (T13)：室內 ↔ 室外淡入淡出，Agent Card context 選單觸發
- **等距素材升級** (T16)：全面替換 placeholder 為像素素材
- **跨分頁同步**：角色位置、場景可見性透過 WebSocket 即時同步

### 重構

- **Scene 抽象層** (T9)：`SceneConfig` 介面，`scene/` 重組為 core / indoor / outdoor
- **等距座標工具** (T10)：`isoMath.ts` 含 round-trip 單元測試
- **等距渲染器** (T12)：畫家演算法深度排序、鑽石 tile hit-test

### 修復

- Modal 開關狀態不再跨分頁同步（避免干擾）
- Portal / Exit icon 可正確選取
- 瀏覽器 zoom 非 100% 時點擊位置修正

### 完成任務

- T9 ✅ Scene 抽象層重構
- T10 ✅ 等距座標工具
- T11 ✅ 室外 World State + Sprites
- T12 ✅ 等距渲染器
- T13 ✅ 場景切換導航
- T14 ✅ 溫室數據面板
- T15 ✅ 氣象站面板
- T16 ✅ 等距素材升級

---

## v0.1.0 — 2026-03-04

> P0 MVP 完成：室內像素辦公室場景

### 新功能

- **室內像素場景** (T3)：22×12 tile grid，木質牆面、時鐘、書架、電腦桌、盆栽隔板、沙發休息區
- **Agent 狀態引擎** (T2)：Gaia / Astraea 角色 + 走動動畫 + 狀態 emoji 泡泡
- **Canvas 互動層** (T4)：滑鼠 hit-test 物件點選 + 碰撞邊界行走
- **佈告欄** (T5)：BoardModal — System Alerts / Task Board tabs，任務 CRUD
- **Dashboard 只讀摘要** (T6)：Gateway 狀態、Agent model / session token、Host CPU/RAM
- **OpenClaw 整合** (T7)：`openclaw status` / `cron list` / `cron runs` 解析
- **WebSocket 即時同步** (T8)：跨分頁角色狀態、佈告欄、儀表板同步
- **AgentCard RPG 風格**：HP/MP/EXP 條、Skills、可折疊卡片

### 基礎建設

- **環境基線** (T0)：Node 20 + `.nvmrc` + `.gitignore`
- **專案骨架** (T1)：NestJS/Fastify backend + React/Vite frontend

### 完成任務

- T0 ✅ 開發環境確認
- T1 ✅ 專案骨架初始化
- T2 ✅ Agent 狀態模型
- T3 ✅ Pixel Scene 基礎畫面
- T4 ✅ Canvas 物件點選 / 碰撞
- T5 ✅ 公布欄（Task Board + Alerts）
- T6 ✅ Dashboard 只讀摘要
- T7 ✅ OpenClaw 讀取整合
- T8 ✅ 卡片 UX 修補 + WebSocket 同步

---

## 待發布

### v0.3.0（規劃中）

- 🔲 T17 整合測試與打磨（P1 收尾）
- 🔲 BoardModal MODIFY 功能 + `anyone` assignee
- 🔲 任務流程規則更新（個人任務優先 → anyone 需確認）
- 🔲 Literature Harvesting for RAG 任務（TASK-005 ~ TASK-010）

### 未來版本

- P2：Agent 詳情側欄、Token heatmap、IoT 面板、事件驅動動畫
- P3：受控寫入（diff / confirm / rollback）、Policy 角色權限
