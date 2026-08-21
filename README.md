# PokemonDex

宝可梦图鉴应用：NestJS 后端 + Vue 3 前端。含全国图鉴、招式、能力、物品、蛋招式遗传规划工具等。

## 环境要求

- Node.js 18+
- npm

## 安装与启动

```bash
# 1. 安装依赖
cd backend && npm install
cd ../frontend && npm install

# 2. 配置环境变量（已提交 dev.db，通常无需改动）
cd ../backend
copy .env.example .env   # Windows
# cp .env.example .env   # macOS / Linux
```

数据库 `backend/prisma/dev.db`（22MB，含全部宝可梦/招式/遭遇数据/图片引用）已随仓库提交，无需重新导入。
图片资源已内嵌于 `backend/public/images/`，运行时不依赖外部数据集目录。

```bash
# 3. 启动后端（端口 3000）
cd backend
npm run start:dev

# 4. 启动前端（端口 5173 / 5175）
cd frontend
npm run dev
```

打开浏览器访问前端地址即可。

## 数据结构说明

- `pokemon-dataset-zh-main/`（gitignored）：原始数据集目录，运行时不需要
- `backend/data/moves_by_gen.json`：Gen2-8 全世代招式（含蛋招式家长/标记）
- `backend/data/encounters.json`：获得方式数据
- `backend/data/raw-wikitext.json`：52poke 抓取的原始 wikitext（本地解析用）

## 常用脚本（backend）

| 命令 | 说明 |
|------|------|
| `npm run db:import-encounters` | 导入获得方式数据到数据库 |
| `node scripts/parse-encounters.js` | 本地解析 wikitext → encounters.json |
| `node scripts/fetch-move-markers.js` | 从 52poke 抓取蛋招式标记 |
| `node scripts/merge-markers.js` | 合并标记进 moves_by_gen.json |