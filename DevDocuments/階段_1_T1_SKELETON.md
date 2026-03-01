# 階段_1_T1_SKELETON — 專案骨架初始化

## 完成時間
- 2026-03-01 (Asia/Taipei)

## 任務目標
建立前後端分離骨架，作為後續所有模組的基礎。

---

## 架構決策

| 項目 | 選擇 | 說明 |
|------|------|------|
| 架構模式 | 前後端分離 | `backend/` + `frontend/` 各自獨立 |
| 後端框架 | NestJS + Fastify | TypeScript strict，OOP 分層 |
| 前端框架 | React + Vite | TypeScript strict，Canvas 2D 相容 |
| 即時通訊 | WebSocket（Phase 1 可先用 SSE） | T2 後再接 |

---

## 套件版本

### Backend (`backend/`)
- Node.js: `v24.14.0`
- `@nestjs/core`: `^11.0.1`
- `@nestjs/platform-fastify`: `^11.1.14`

### Frontend (`frontend/`)
- React: `^19.2.0`
- Vite: `^7.3.1`

---

## 目錄結構

```
OpenClaw_PixelAgent/
├── backend/
│   ├── src/
│   │   ├── main.ts             ← FastifyAdapter + CORS + port 3000
│   │   ├── app.module.ts
│   │   ├── app.controller.ts   ← GET /health
│   │   └── app.service.ts      ← 讀 package.json 版本
│   ├── nest-cli.json
│   ├── tsconfig.json           ← strict mode, nodenext
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   └── App.tsx             ← 呼叫 /api/health 顯示版本
│   ├── vite.config.ts          ← proxy /api → localhost:3000
│   ├── tsconfig.json           ← strict mode
│   └── package.json
└── tools/
    ├── start-backend.sh
    ├── start-frontend.sh
    └── start-all.sh            ← 同時啟動，Ctrl+C 一起停
```

---

## 啟動方式

```bash
# 方式一：分別啟動
./tools/start-backend.sh    # http://localhost:3000
./tools/start-frontend.sh   # http://localhost:5173

# 方式二：一鍵啟動（前端前景，後端 log → /tmp/openclaw-backend.log）
./tools/start-all.sh
```

---

## DoD 驗收結果

- [x] `cd backend && npm run start:dev` 啟動無錯誤
- [x] `GET /health` → HTTP 200 `{"status":"ok","version":"0.0.1"}`
- [x] `cd frontend && npm run dev` 啟動無錯誤
- [x] 瀏覽器 http://localhost:5173 顯示版本資訊（從 `/api/health` 取得）
- [x] 前後端 TypeScript strict build 無錯誤

---

## 結論
T1 骨架完成。下一步可進入 T2（Agent 狀態模型與 emoji 引擎）。
