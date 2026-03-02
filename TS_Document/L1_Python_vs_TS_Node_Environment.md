# L1 Python vs TS/Node 環境與版本控制對照

> 第一堂課（L1）：先理解環境隔離與版本鎖定，再開始寫程式。

## 1) 概念對照（先看這張）

- Python `venv` -> Node 專案本地 `node_modules`
- Python `requirements.txt` -> Node `package.json`（宣告直接依賴）
- Python lock（poetry.lock / pip-tools 輸出）-> Node `package-lock.json`
- Python 版本管理（pyenv）-> Node 版本管理（nvm/fnm/volta）

---

## 2) 差異重點

### Python 常見做法
1. 建 venv
2. `pip install -r requirements.txt`
3. 凍結版本（視工具而定）

### Node/TS 常見做法
1. 切 Node 版本（`.nvmrc` + `nvm use`）
2. `npm install`（依賴安裝到專案本地 `node_modules`）
3. 提交 `package-lock.json` 鎖定整棵依賴樹

---

## 3) 實務建議（團隊協作）

1. 一定提交 `package-lock.json`
2. CI 用 `npm ci`（可重現、穩定）
3. 使用 `.nvmrc` 固定 Node 版本
4. 盡量用 `npx` 跑工具，少用全域安裝

---

## 4) 最小指令清單（可直接操作）

```bash
# 1) 固定 Node 版本（例如 20）
echo "20" > .nvmrc
nvm use

# 2) 初始化專案
npm init -y

# 3) 安裝 TS 開發依賴
npm install -D typescript ts-node @types/node

# 4) 產生 tsconfig
npx tsc --init

# 5) 團隊/CI 建議安裝方式
npm ci
```

---

## 5) 先看檔案架構，不先硬背語法（推薦讀法）

如果你目前比較容易被資料夾弄亂，先用這個順序看專案：

1. 先看入口檔（`main.ts` / `index.ts`）
2. 再看設定檔（`package.json` / `tsconfig.json`）
3. 分清資料夾角色：
   - `src/`：原始碼（主要修改）
   - `dist/`：編譯輸出（通常不手改）
   - `node_modules/`：外部套件（通常不手改）
4. 追一條功能線：一次只看一個檔案的 `import` 與呼叫關係

> 核心原則：先搞清楚「檔案怎麼互相生成/呼叫」，再補語法細節，學習壓力會小很多。

---

## 6) 你現在可以記住的一句話

Node 沒有單一 `venv` 指令，但透過：
- `node_modules`（依賴隔離）
- `package-lock.json`（版本鎖定）
- `nvm`（runtime 版本管理）

可以達到和 Python venv 生態同等級的可控性。
