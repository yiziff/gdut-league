# 广东工业大学球类联赛

2026 秋季校园球类联赛站点。覆盖篮球、足球、排球、羽毛球、乒乓球，展示赛程、积分榜、淘汰赛对阵和队伍资料，并带一个可录入赛果的管理端。

## 功能

- 首页汇总今日赛事、即将开赛和最近赛果
- 每个项目下可以有多个联赛，联赛内按男子组、女子组、混合团体查看赛程、积分榜和对阵图
- 队伍与比赛详情展示成员的班级、姓名和号码
- 比赛详情包含比分、排球局分、足球点球、弃权和球员数据
- 每场比赛可上传自己的空白技术统计表模板，赛后拍照识别、校对并留存原图
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

开发模式会监听前后端文件变更：前端由 Vite 热更新，API 由 `tsx watch` 自动重启。

## 环境变量

复制 `.env.example` 为 `.env` 后按需修改。服务启动时读取，已有的进程环境变量优先。

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `ADMIN_PASSWORD` | `admin` | 管理端登录密码 |
| `PORT` | `3001` | API 监听端口 |
| `OCR_SERVICE_URL` | 空 | PaddleOCR/PaddleX 服务地址，例如 `http://127.0.0.1:8080` |
| `OCR_SERVICE_TOKEN` | 空 | OCR 服务要求鉴权时使用的 token |
| `OCR_ENGINE_NAME` | `PaddleOCR-VL-1.6` | 写入统计表留档信息的识别引擎名称 |
| `OCR_TIMEOUT_MS` | `180000` | 单张统计表识别超时（毫秒） |
| `FORM_VLM_API_URL` | 空 | 推荐：支持图片输入的 OpenAI 兼容接口，用于比较空白模板和赛后表 |
| `FORM_VLM_API_KEY` | 空 | 表单视觉模型接口密钥；本地服务可留空 |
| `FORM_VLM_MODEL` | 空 | 表单视觉模型名称 |
| `FIBA_PYTHON` | `.venv-ocr/bin/python` | 运行 `scripts/fiba_sheet.py` 的 Python，需要装 OpenCV 和 numpy |

## 篮球：FIBA 记录表算个人得分

篮球比赛统一使用 FIBA 标准记录表，不调用收费服务：

1. 在比赛编辑页的「技术统计」上传填好的记录表照片，比赛自动记为已结束；
2. `scripts/fiba_sheet.py` 找到表格外框并拉正，按 `server/fiba/layout.json` 定位累积分区格线，只切出写了字的号码格；
3. 核对页先选表上 A 队是哪一队，再逐格填球衣号（点名单号码，或输入号码回车，没写号码点「空」）；
4. 每次得分 = 这格累计分减去本队上一个写了号码的格子，按号码加总得到个人得分，并和表底最后比分对账；
5. 点「确认写入得分」，个人得分和比分写入比赛，确认过的格子存为样本（`data/digit-samples/<号码>/`，`digit_samples` 表），留给以后训练本机手写数字识别。

拍照要求：表格外框四个角都要拍进去，尽量正对、光线均匀。自动切格失败时，可以在原图上手点外框四个角重试。

依赖：

```bash
python3 -m venv .venv-ocr
.venv-ocr/bin/pip install opencv-python-headless numpy
```

换了记录表版式时，用空白表重新标定：

```bash
.venv-ocr/bin/python scripts/fiba_sheet.py calibrate 空白表.jpg server/fiba/layout.json server/fiba/blank.jpg
```

## 动态技术统计表识别（其他项目）

模板不写死在代码中，每场比赛可以使用不同表格：

1. 创建或编辑比赛时上传一张未填写的空白技术统计表；
2. 保存比赛时，后台识别表格类型、球员标识、统计字段和特殊记录区域；
3. 比赛结束后上传使用同一模板填写的整张统计表；
4. 后台同时参考空白模板、赛后照片和本场名单生成待核对草稿；
5. 管理员修正后点击“保存修改”，数据才会写入正式技术统计。

这一流程适用于所有项目。球员统计列以模板识别结果为准，不再强制使用一张篮球 box score。没有配置识别服务时，模板和赛后照片仍可留档并对照人工录入。

### 推荐：表单视觉模型

任意模板，尤其是带跑分斜线、圆点和格内犯规符号的 FIBA 记录表，需要能同时理解两张图片的视觉模型。配置一个支持图片输入的 OpenAI 兼容接口：

```bash
FORM_VLM_API_URL=http://127.0.0.1:8000
FORM_VLM_MODEL=your-vision-model
FORM_VLM_API_KEY=
```

系统会把空白模板和赛后表一起提交，并只接受受支持字段的结构化 JSON。手写和符号识别仍可能出错，因此始终保留人工校对。

### PaddleOCR 回退

PaddleOCR 可用于表头、表格结构和普通逐行统计表识别。模型首次运行会下载权重，生产环境建议独立部署：

```bash
python3 -m venv .venv-ocr
source .venv-ocr/bin/activate
python -m pip install "paddleocr[doc-parser]"
paddlex --install serving
paddlex --serve --pipeline PaddleOCR-VL-1.6 --port 8080
```

然后在 `.env` 中设置：

```bash
OCR_SERVICE_URL=http://127.0.0.1:8080
```

仅配置 PaddleOCR 时，系统会按模板检测到的列解析赛后表。对于 FIBA 跑分栏等“以符号表达语义”的表格，PaddleOCR 只是回退方案，页面会明确要求重点复核。

实现参考：

- [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR)：版面、表格与 OCR 主流程
- [trocr-chinese](https://github.com/chineseocr/trocr-chinese)：中文手写识别模型
- [table_rec_system](https://github.com/caigouShaw/table_rec_system)：表格线切分、单元格识别和自有表单微调思路
- [OCR_HandWritten_Form](https://github.com/yashveersinghsohi/OCR_HandWritten_Form)：空白模板、图像配准和区域识别流程
- [FIBA Official Basketball Rules 2024](https://assets.fiba.basketball/image/upload/documents-corporate-fiba-official-rules-2024-v10a.pdf)：记录表和犯规填写规范
- [FIBA Statisticians' Manual 2024](https://assets.fiba.basketball/image/upload/documents-corporate-fiba-statisticians-manual-2024-v2.pdf)：投篮、篮板、助攻、失误等统计口径

## 报名数据

报名时先创建队伍，再进入对应队伍逐个添加成员。每名成员必须填写：

- 班级
- 姓名
- 号码

同一队伍内班级和姓名可以重复，号码必须唯一。页面会在提交前检查，API 和 SQLite 也会阻止重复号码。旧数据库启动时会自动补充成员字段；历史重复号码不会被自动删除，而会在管理端标红，需手动选择保留者。

## 脚本

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 以监听模式同时启动 API 和 Vite |
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
- 先创建报名队伍，再逐人维护班级、姓名、号码和队伍颜色
- 按赛制生成对阵，或逐场增删比赛
- 录入状态（未赛 / 进行中 / 已结束）、比分、局分、点球、弃权和球员数据
- 为每场比赛上传空白统计表模板，赛后拍摄、识别、校对并留档填写结果

公开接口是 `GET /api/snapshot`、`GET /api/leagues` 和 `GET /api/leagues/:id`。写操作都在 `/api/admin` 下，需要登录后的会话 Cookie。
