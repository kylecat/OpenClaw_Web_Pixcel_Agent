# OpenClaw PixelAgent — NestJS 規格草案（Draft v0.1）

## 1) 目標
建立一個以 OOP 為核心的後端，支援 PixelAgent 前端場景：
- Agent 狀態與動畫事件來源
- 公布欄（任務/告警）資料管理
- Dashboard（OpenClaw + Host + IoT）聚合資料
- 先讀後寫：Phase 1 以 read-only 為主，Phase 2 再加受控寫入

---

## 2) 技術選型（建議）
- Runtime: Node.js 20+
- Framework: NestJS (TypeScript)
- HTTP: Nest + FastifyAdapter
- Realtime: WebSocket Gateway（Phase 1 也可先用 SSE）
- Validation: class-validator + class-transformer
- ORM: Prisma（或 TypeORM 二擇一）
- DB: SQLite（開發）→ PostgreSQL（上線可升級）
- Scheduler: @nestjs/schedule
- Logging: pino / nestjs-pino
- Config: @nestjs/config

---

## 3) 分層與模組（OOP）

### 3.1 模組總覽
1. `AgentsModule`
2. `BoardModule`
3. `DashboardModule`
4. `TelemetryModule`
5. `OpenClawModule`
6. `HostModule`
7. `IotModule`
8. `PolicyModule`
9. `EventsModule` (WebSocket/SSE)
10. `AuthModule`（若需多人使用再開）

### 3.2 類別職責（核心）
- `AgentService`
  - 管理 agent 狀態（IDLE/THINKING/ERROR/...）
  - 計算 emoji 與動畫意圖（walk-to-board / walk-to-dashboard）
- `BoardService`
  - 任務/告警 CRUD
  - 任務狀態機（new → assigned → in_progress → blocked → done）
- `DashboardService`
  - 聚合 OpenClaw + Host + IoT 資料為單一 DTO
- `OpenClawService`
  - 封裝 `openclaw status/cron runs/list` 讀取
  - 提供 parser（CLI text -> structured object）
- `HostMetricsService`
  - CPU/RAM/disk/net 監測
- `IotStatusService`
  - LAN IoT 裝置上線狀態（adapter pattern）
- `PolicyService`
  - 高風險操作權限判斷（Phase 2）
- `EventBusService`
  - 將狀態變更推送給前端（WS/SSE）

---

## 4) 專案目錄建議

```txt
openclaw-pixelagent-backend/
  src/
    main.ts
    app.module.ts

    common/
      dto/
      enums/
      interfaces/
      utils/
      filters/
      interceptors/

    agents/
      agents.module.ts
      agents.controller.ts
      agents.service.ts
      dto/

    board/
      board.module.ts
      board.controller.ts
      board.service.ts
      entities/
      dto/

    dashboard/
      dashboard.module.ts
      dashboard.controller.ts
      dashboard.service.ts
      dto/

    telemetry/
      telemetry.module.ts
      telemetry.service.ts

    openclaw/
      openclaw.module.ts
      openclaw.service.ts
      openclaw.parser.ts

    host/
      host.module.ts
      host.service.ts

    iot/
      iot.module.ts
      iot.service.ts
      adapters/

    policy/
      policy.module.ts
      policy.service.ts

    events/
      events.module.ts
      events.gateway.ts
      events.service.ts

    schedule/
      schedule.module.ts
      health-check.job.ts

  prisma/
    schema.prisma

  test/
```

---

## 5) Domain Model（初版）

### 5.1 Agent
- `id`: string (`gaia`, `astraea`)
- `displayName`: string
- `status`: enum (`IDLE`, `THINKING`, `TALKING`, `NETWORK_UNSTABLE`, `ERROR`, `CRASHED`, `DONE`)
- `emoji`: string
- `currentTaskId?`: string
- `lastSeenAt`: datetime
- `model?`: string
- `sessionKey?`: string

### 5.2 TaskItem
- `id`
- `title`
- `description`
- `status`: enum
- `assignee?`: agent id
- `priority`: enum (`P0`, `P1`, `P2`)
- `dueAt?`
- `createdBy`
- `createdAt`, `updatedAt`

### 5.3 AlertItem
- `id`
- `source`: enum (`openclaw`, `host`, `iot`, `manual`)
- `severity`: enum (`info`, `warn`, `error`, `critical`)
- `message`
- `detail?`
- `acknowledged`: boolean
- `createdAt`

---

## 6) API 草案（Phase 1）

### Agents
- `GET /agents`
- `GET /agents/:id`
- `GET /agents/:id/timeline`

### Board
- `GET /board/tasks`
- `POST /board/tasks`
- `PATCH /board/tasks/:id`
- `GET /board/alerts`
- `POST /board/alerts`（人工新增）
- `PATCH /board/alerts/:id/ack`

### Dashboard
- `GET /dashboard/summary`
- `GET /dashboard/tokens/daily`
- `GET /dashboard/host`
- `GET /dashboard/iot`

### Realtime
- `WS /events`
  - `agent.status.changed`
  - `board.task.changed`
  - `board.alert.created`
  - `dashboard.updated`

---

## 7) 前端事件映射（給 Pixel Scene）

- `agent.status.changed(THINKING)` -> 🤔
- `board.alert.created(severity=error)` -> 最近 agent 走向布告欄 + ❌
- `dashboard.updated(host.cpu > threshold)` -> agent 走向 dashboard + 📶⚠️ or ❌
- `task.status.changed(done)` -> ✅ 3 秒後回 IDLE

---

## 8) 與 OpenClaw 的介接方式（Phase 1 建議）

1. 後端定時輪詢（30~60 秒）
   - `openclaw status`
   - `openclaw cron list`
   - `openclaw cron runs --id <jobId> --limit N`
2. parser 轉為結構化 DTO
3. 更新資料表與快取
4. 推送 WebSocket 事件給前端

> 備註：先讀取 CLI 輸出可快速落地；後續若有 Gateway API 可直接改 adapter。

---

## 9) 安全與風險控制

### Phase 1（Read-only）
- 禁止寫入 OpenClaw config
- UI 僅監看 + 任務板寫入（本系統 DB）

### Phase 2（Controlled write）
- 寫入前 diff preview
- 二次確認 modal
- Policy check
- 寫入後自動驗證
- 失敗 rollback

---

## 10) 里程碑建議

### Milestone A（3~5 天）
- NestJS 專案骨架
- `GET /agents`, `GET /dashboard/summary`, `GET /board/tasks`
- 基礎輪詢 OpenClaw status

### Milestone B（5~7 天）
- Board 任務/告警 CRUD
- WS 事件推播
- Pixel scene 與狀態 emoji 串接

### Milestone C（7~10 天）
- Token heatmap
- Host metrics + IoT adapter
- 異常聚合與布告欄自動告警

---

## 11) 開發規範（OOP/可維護）

- Controller 不放業務邏輯，只做 I/O
- Service 單一職責
- 以 DTO + Validation Pipe 做輸入驗證
- 對外資料統一 ViewModel，避免前端直接依賴內部結構
- Parser/Adapter 獨立，避免 CLI 變動影響核心 domain
- 每個模組至少有 service unit tests

---

## 12) 下一步（可直接執行）

1. 初始化 NestJS 專案（Fastify）
2. 先建 `OpenClawModule + DashboardModule + BoardModule`
3. 建一個 `/dashboard/summary` MVP API
4. 前端先吃 summary + agents + alerts 三支 API
5. 再接 WebSocket 做即時狀態動畫

