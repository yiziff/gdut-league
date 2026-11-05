# 广东工业大学球类联赛

2026 秋季校园球类联赛站点。覆盖篮球、足球、排球、羽毛球、乒乓球，展示赛程、积分榜、淘汰赛对阵和队伍资料，并带一个可录入赛果的管理端。

## 功能

- 首页汇总今日赛事、即将开赛和最近赛果
- 每个项目下可以有多个联赛，联赛内按男子组、女子组、混合团体查看赛程、积分榜和对阵图
- 比赛详情包含比分、排球局分、足球点球、弃权和球员数据
- 积分规则按项目区分：篮球胜 2 负 1，足球胜 3 平 1 负 0，排球按 3:0 / 3:1 / 3:2 记分，羽毛球和乒乓球按团体赛胜负记分
- 管理端可以创建联赛、维护队伍和名单，并按单循环、双循环、小组赛加淘汰赛或单败淘汰生成对阵

## 技术栈

- 前端：React 19、React Router（Hash 路由）、Vite、Tailwind CSS 4
- 后端：Express、Node.js 内置 `node:sqlite`
- 数据文件：`data/league.db`（首次启动且库为空时自动创建）

服务端依赖 Node.js 22.5 及以上的 `node:sqlite`。Node 20 无法启动。

## 本地启动

```bash
nvm use 22
npm install
npm run dev
```

- 页面：http://localhost:5173
- 接口：http://127.0.0.1:3001，开发时 Vite 把 `/api` 代理到这里

数据库为空时，会把 `src/data/*.json` 导入为每个项目一个「2026 校级联赛」。之后再改这些 JSON 不会覆盖已有数据；要重新灌入示例数据，删掉 `data/league.db` 再启动。

管理端入口是 http://localhost:5173/#/admin 。未设置密码时，默认密码是 `admin`。

## 环境变量

复制 `.env.example` 为 `.env` 后按需修改。服务启动时读取，已有的进程环境变量优先。

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `ADMIN_PASSWORD` | `admin` | 管理端登录密码 |
| `PORT` | `3001` | API 监听端口 |

## 脚本

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 同时启动 API 和 Vite |
| `npm test` | 运行 Vitest |
| `npm run build` | 类型检查并构建前端到 `dist/` |
| `npm start` | 以生产模式启动，同一端口提供 API 和 `dist/` 静态文件 |
| `node scripts/gen-sample-data.mjs` | 重新生成 `src/data/<sport>.json` 演示赛程 |

生产部署：

```bash
npm run build
npm start
```

页面和接口都在 `PORT`（默认 3001）上。路由使用 hash，刷新子页面不需要额外的服务端回退。

## 目录

```
server/          Express API、SQLite 和首次种子数据
src/pages/       前台页面和管理端
src/lib/         积分、对阵、循环赛和赛制生成
src/data/        示例赛程 JSON，以及前端数据加载
scripts/         生成示例赛程
```

## 管理端能做什么

登录后可以：

- 创建、改名和删除联赛
- 维护报名队伍、颜色和球员名单
- 按赛制生成对阵，或逐场增删比赛
- 录入状态（未赛 / 进行中 / 已结束）、比分、局分、点球、弃权和球员数据

公开接口是 `GET /api/snapshot`、`GET /api/leagues` 和 `GET /api/leagues/:id`。写操作都在 `/api/admin` 下，需要登录后的会话 Cookie。
