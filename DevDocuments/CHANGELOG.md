# Changelog

## 2026-03-07

### Bulletin Board 功能增強（未提交）

- TaskCard 新增 **MODIFY** 編輯模式：可修改 title、content、assignee、priority
- 新增 `anyone` assignee 類型，所有下拉選單（篩選、新增、編輯、快速切換）皆已支援
- Delete 按鈕改為大寫樣式（MODIFY / DELETE 垂直排列）
- 後端 `TaskAssignee` enum 同步新增 `ANYONE = 'anyone'`

### 任務流程規則更新

- `L1_bulletin-board-task-flow.md` 改寫篩選邏輯：個人任務優先 → `anyone` 任務次之（需 DM 確認）
- Rules 從 4 條擴充為 6 條

### 戶外場景微調

- 左邊界樹木從 3 列（col 0, 2, 4）縮減為 1 列（col 0），增加左側可行走空間

## 2026-03-06

### T16: 等距素材升級 (v0.2.1)

- 等距素材全面升級，替換 placeholder
- 戶外場景佈局微調

### 跨分頁同步改進

- 角色位置與場景可見性跨分頁同步
- 修正 modal 開關狀態不再跨分頁同步（避免干擾）

## 2026-03-05

### T14 + T15: 溫室數據面板 & 氣象站面板

- 新增 GreenhousePanel：栽培數據 + 參考文獻 tabs
- 新增 WeatherPanel：即時天氣 + 5 日預報
- Backend greenhouse / weather modules

### T13: 場景切換導航

- Agent Card context 選單觸發場景導航
- 室內 ↔ 室外淡入淡出切換

### T12: 等距渲染器

- 等距 renderer、hit-test、outdoor scene config
- 深度排序（畫家演算法）

### T11: 室外 World State

- 室外 world state、sprite placeholders、pathfinding

### T10: 等距座標工具

- `isoMath.ts`：isoToScreen / screenToIso / depth sort
- 單元測試通過

### T9: Scene 抽象層

- 定義 SceneConfig 介面
- 重組 `scene/` 為 core / indoor / outdoor 子目錄

### World interaction updates

- Portal icon and Exit icon are now selectable in the indoor scene.
- Fixed click-position mismatch when browser zoom is not 100%.

### Task flow record

- 新增 publish-accept-complete 任務工作流程記錄

### Regression checklist (zoom-related hit-test)

- [ ] 100% zoom: can select Portal / Exit / Shelf objects correctly
- [ ] 125% zoom: can select Portal / Exit / Shelf objects correctly
- [ ] 150% zoom: can select Portal / Exit / Shelf objects correctly
- [ ] 80% zoom: can select Portal / Exit / Shelf objects correctly

### Notes

- Backend version bumped to 0.2.1
- Dashboard fallback version updated to 0.2.1
