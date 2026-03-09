# UI Plan — OpenClaw Pixel Agent

> 最後更新：2026-03-07（P0 完成，P1 T9~T16 完成，剩 T17 整合測試）

---

## 1) 場景架構

本專案包含兩個 Canvas 場景，透過場景切換機制連結。

### A. 室內辦公室（Indoor Scene）— P0 ✅ 已完成

- **視角**：Top-down 2D（俯視）
- **Grid**：22×12 tiles，TILE_SIZE = 64px
- **主要元素**：
  - Gaia / Astraea 角色 + 走動動畫 + 狀態 emoji 泡泡
  - 佈告欄（Bulletin Board）5×3 掛牆大圖 → 點擊開啟 BoardModal
  - 儀表板（Dashboard）5×3 掛牆大圖 → 點擊開啟 DashboardModal
  - 木質牆面、時鐘、書架、電腦桌、盆栽隔板、沙發休息區
  - Hit-test 物件點選 + 碰撞邊界行走
- **出口**：場景底部或門口區域 → 點擊切換至室外場景

### B. 室外農場（Outdoor Scene）— P1 ✅ 核心完成（剩 T17 整合測試）

- **視角**：等距 Isometric（2:1 鑽石 tile）
- **Grid**：16×12 tiles，ISO_TILE_W = 64px，ISO_TILE_H = 32px
- **參考圖**：`ui/螢幕截圖_室外場景.png`
- **主要元素**：
  - 草地、泥地小徑、河流、農田、樹林邊界
  - **溫室 ×3** → 點擊開啟 GreenhousePanel（栽培數據 + 參考文獻）
  - **氣象站** → 點擊開啟 WeatherPanel（即時天氣 + 5 日預報）
  - **小木屋（資材室）** → 點擊切換至室內場景
  - Gaia / Astraea 角色（等距行走，方向重映射）
  - 深度排序渲染（畫家演算法）

### C. 場景切換

- **預設場景**：室內（Indoor）
- **切換方式**：
  - 室內 → 室外：點擊室內場景的「出口」區域
  - 室外 → 室內：點擊小木屋（資材室）
- **過場動畫**：~400ms CSS opacity 淡入淡出
- **角色狀態**：跨場景保留 statusEmoji，進入場景時 snap 到 home 位置
- **跨分頁同步**：WebSocket `scene:changed` 事件

---

## 2) 面板系統（Modals / Panels）

| 面板 | 觸發方式 | 場景 | 狀態 |
|------|----------|------|------|
| **BoardModal** | 點擊佈告欄 | 室內 | ✅ 完成（含 MODIFY + anyone assignee） |
| **DashboardModal** | 點擊儀表板 | 室內 | ✅ 完成 |
| **GreenhousePanel** | 點擊溫室 | 室外 | ✅ 完成 (T14) |
| **WeatherPanel** | 點擊氣象站 | 室外 | ✅ 完成 (T15) |
| **AgentDetailDrawer** | 點擊角色 avatar | 兩者 | P2 待做 |

### BoardModal（佈告欄）
- Tabs：System Alerts / Task Board
- Task CRUD：新增、指派、開始、完成
- 長內容折疊 + 按鈕 sticky

### DashboardModal（儀表板）
- Gateway 狀態、Agent model / session token 概況
- OpenClaw status + cron 解析數據
- Host 基礎資源（CPU/RAM）
- 最後更新時間

### GreenhousePanel（溫室）— P1 ✅ 完成
- Tabs：栽培數據 / 參考文獻
- 栽培數據：植物卡片（類型、階段 seed/sprout/growing/harvest、預計收成）
- 參考文獻：連結列表
- Backend API：`GET/POST/PATCH /api/greenhouse`

### WeatherPanel（氣象站）— P1 ✅ 完成
- 即時天氣：溫度、濕度、風速、天氣圖示
- 5 日預報：每日高低溫、降雨機率
- 外部 API 整合（OpenWeatherMap / weatherapi.com）
- 30 分鐘快取，無 API key 時 mock data 降級

---

## 3) Status Emoji Mapping

| Emoji | 狀態 | 說明 |
|-------|------|------|
| 🤔 | Thinking | 規劃 / 讀取任務中 |
| 💬 | Talking | 對話 / 執行任務中 |
| 😶 | IDLE | 閒置 |
| 📶⚠️ | Unstable | 網路不穩 / provider 問題 |
| ❌ | Failed | Tool / action 失敗 |
| 💥 | Crashed | 當機 / 超時 |
| ✅ | Completed | 任務完成 |

---

## 4) Event-to-Animation Rules

| 事件 | 動畫 | 階段 |
|------|------|------|
| 新 alert 進入 | 最近 agent 走向佈告欄 | P2 (T21) |
| 新 task 指派 | 被指派 agent 顯示 🤔 → 走向佈告欄 | P2 (T21) |
| Dashboard 刷新 / 重大狀態變更 | 一位 agent 走向儀表板 | P2 (T21) |
| 任務完成 | 顯示 ✅ → 3 秒後回 IDLE + 走向休息區 | P2 (T21) |

---

## 5) Agent Card（側邊欄）

- RPG 風格角色卡片，可折疊
- 展開時顯示：頭像、Stats、HP/MP/EXP 條、Skills
- 折疊時顯示：頭像 + 名稱 + 狀態 badge
- 手動 walk 控制（座標輸入 + 目標按鈕）

---

## 6) Data Feeds

### OpenClaw ✅ 已整合
- `openclaw status` parsed feed → DashboardModal
- `openclaw cron list` + `openclaw cron runs --id ...`
- session token stats

### Host ✅ 已整合
- CPU/RAM/disk/net → DashboardModal

### Weather — P1
- 外部天氣 API（OpenWeatherMap / weatherapi.com）→ WeatherPanel
- 30 分鐘快取

### Greenhouse — P1
- 栽培數據 JSON store → GreenhousePanel
- 參考文獻連結管理

### IoT — P2
- LAN/MQTT/API adapter → IoT 狀態面板 (T20)

---

## 7) Page Layout

### 室內場景佈局（現行）
```
┌─────────────────────────────────┐
│  Canvas (Indoor)  │  AgentCard  │
│  22×12 grid       │  Stack      │
│  0.64× CSS scale  │  (vertical) │
├───────────────────┴─────────────┤
│  Manual Walk Controls           │
└─────────────────────────────────┘
```

### 室外場景佈局（P1）
```
┌─────────────────────────────────┐
│  Canvas (Outdoor)  │  AgentCard │
│  16×12 iso grid    │  Stack     │
│  diamond tiles     │            │
├────────────────────┴────────────┤
│  Manual Walk Controls           │
└─────────────────────────────────┘
```

> 兩個場景共用相同的外層 flex 佈局，只替換 `<SceneCanvas config={...}>` 內容。

---

## 8) Real-time Sync

- **Transport**：Socket.IO（WebSocket）
- **同步事件**：
  - `agent:statusChanged` — 狀態/emoji 變更
  - `agent:walk` — 角色移動
  - `board:changed` — 佈告欄數據更新
  - `dashboard:stale` — 儀表板需刷新
  - `modal:toggled` — 面板開關
  - `scene:changed` — 場景切換（P1）
  - `greenhouse:changed` — 溫室數據更新（P1）

---

## 9) Safety & UX Requirements

- 長內容必須可折疊
- Action buttons 在卡片/面板中必須 sticky，始終可見
- Config 相關面板顯示文件連結
- 高風險操作需有 confirm modal（P3 受控寫入）
- 場景切換過場動畫避免閃爍或殘留狀態

---

## 10) Backlog Summary

### P0 — MVP ✅ 全部完成
- Pixel 室內場景 + 牆面/裝飾品佈局
- Agent 狀態模型 + emoji 引擎
- Canvas 物件點選 + 碰撞邊界
- 佈告欄（Task Board + Alerts）
- Dashboard 只讀摘要 + OpenClaw 整合
- 卡片 UX 修補 + WebSocket 即時同步

### P1 — 室外等距農場 ✅ 核心完成
- ✅ Scene 抽象層重構（SceneConfig + SceneCanvas）
- ✅ 等距座標系統 + 渲染器
- ✅ 室外 WorldState + 素材
- ✅ 場景切換導航（淡入淡出）
- ✅ 溫室面板（栽培數據 + 文獻）
- ✅ 氣象站面板（即時天氣 + 預報）
- ✅ 等距素材升級 + 戶外場景微調
- ✅ 跨分頁角色位置 / 場景同步
- 🔲 T17 整合測試與打磨

### P2 — 擴展功能
- Agent 詳情側欄
- 每日 token heatmap
- IoT 狀態面板
- 事件驅動動畫

### P3 — 進階能力
- 受控寫入（diff / confirm / rollback）
- Policy / 角色權限
