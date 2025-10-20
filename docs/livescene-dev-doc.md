# LiveScene（直播场景样稿）开发文档 v1.0

> 面向 Codex 开发/工程团队的落地型文档：包含范围、架构、环境、接口、数据模型、业务规则、权限、导出、埋点、测试、CI/CD 与里程碑。可直接开工。

---

## 0. 摘要（TL;DR）

- **目标**：提供直播团队与“直播间搭建师”的场景样稿与一键适配服务，导出分镜/灯光/相机/音频/BOM/合规等可执行文档。
- **MVP 范围**：模板库 + 适配向导（4 步）+ 结果页 + 导出（PDF/CSV/ZIP）+ 项目/评论/版本基本协作。
- **推荐栈**：前端 Next.js（App Router）+ Tailwind + shadcn/ui；后端 Supabase（Postgres + Auth + Storage + Edge Functions）；导出服务 Node（pdf-lib/pdfkit）或 Python（reportlab）。部署：Vercel + Supabase 托管。

---

## 1. 功能范围（MVP）

- 模板库：检索/筛选/收藏/详情预览。
- 一键适配向导：4 步表单（Brief → 空间设备 → 预算器 → 结果）。
- 结果页：六大模块卡片（脚本/灯光/相机/音频/BOM/合规），导出与保存项目。
- 项目：列表、详情（概览/脚本 & 参数/BOM & 预算/合规/评论/版本）。
- 导出：PDF、CSV-BOM、Sora Prompt `.zip`。
- 协作：评论 @、简单版本号/变更记录。

**不在 MVP**：视频云渲染、第三方硬件直连、AR 实景（仅预留入口）。

---

## 2. 系统架构

- **Web 前端**（Next.js 14 / React 18）：SSR + ISR；路由见 §7。
- **API/后端**：
  - Supabase Postgres：业务数据；Row Level Security（RLS）。
  - Edge Functions（Deno）：轻量逻辑与导出触发。
  - Worker 服务（Node 或 Python）：PDF/ZIP 生成；对象存储回写。
- **对象存储**：Supabase Storage（封面、导出文件、Prompt 包）。
- **认证与授权**：Supabase Auth（邮箱魔术链/微信 OAuth 预留）。
- **监控/埋点**：Sentry + Umami；事件见 §12。

```
[Next.js]──(JWT)──>[Supabase REST/Edge]──>Postgres/Storage
                               │
                               └──(Queue/Webhook)──>[Worker 导出]
```

---

## 3. 代码结构（Monorepo 建议）

```
/apps
  /web        # Next.js 前端
  /worker     # 导出服务（Node/Python 任选其一）
/packages
  /ui         # 组件库（shadcn 扩展封装）
  /schema     # zod/TypeScript 类型 + OpenAPI
  /utils      # 通用工具（格式化/价格/映射）
/infrastructure # IaC（可选）
```

---

## 4. 环境与配置

- **运行时**：Node 20+；Deno（Edge）；Python 3.11（若选）。
- **环境变量**（示例）：
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE`
  - `EXPORT_SIGNING_SECRET`
  - `STORAGE_BUCKET_EXPORTS=exports`
  - `STORAGE_BUCKET_MEDIA=media`
- **本地启动**：
  - `pnpm i && pnpm dev`（web）；
  - `pnpm --filter worker dev`（导出服务）。

---

## 5. 数据模型（Postgres）

> 基于 PRD 的 Template/Project/Package 结构，含最小索引与 RLS 要点。

```sql
-- 用户与团队（简化）
create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner uuid not null,
  created_at timestamptz default now()
);

create table profiles (
  id uuid primary key,
  email text unique,
  team_id uuid references teams(id),
  role text check (role in ('owner','director','builder','crew','guest')),
  created_at timestamptz default now()
);

-- 模板
create table templates (
  id uuid primary key default gen_random_uuid(),
  title text,
  industry text,
  style text,
  purpose text,
  space text,
  budget_range text,
  cover_url text,
  rating numeric,
  usage_count int default 0,
  meta jsonb,
  created_at timestamptz default now()
);
create index on templates (industry, style, purpose);

-- 项目与生成包
create table projects (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id),
  created_by uuid references profiles(id),
  brief jsonb not null,
  space jsonb not null,
  status text default 'draft',
  created_at timestamptz default now()
);

create table project_packages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  script jsonb,
  lighting jsonb,
  camera jsonb,
  audio jsonb,
  bom jsonb,
  compliance jsonb,
  version int default 1,
  created_at timestamptz default now()
);

-- 评论与版本
create table comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  author uuid references profiles(id),
  body text,
  created_at timestamptz default now()
);
```

**RLS 建议**：`projects`/`project_packages` 按 `team_id` 限制；`templates` 全员可读，编辑仅管理员。

---

## 6. 业务规则（关键逻辑）

> 实现位置：前端 zod 校验 + Edge Function + utils 封装。

1. **模板匹配**：行业 × 目的 × 风格 × 空间 → 初始模板；无匹配提供 3 套通用起步模板。
2. **设备映射**：优先库存；按“功率/接口/用途/附件/焦段/指向性”做替代（见映射词表初版 ≥ 50 条）。
3. **灯光解算**：
   - 目标面部照度 800–1200 lux；
   - 背景光比 ≤ 1:2；
   - 色温 = 统一色调（如 6000K ± 200）。
4. **相机预设**：中景/特写优先；快门 ≈ 帧率 × 2；ISO 400–800；WB 同色调。
5. **音频**：动圈近讲 12–15 cm；峰值约 -12 dB。
6. **预算计算**：`基准价 × 区域系数（A1.25/B1/C0.85）× 数量 × 天数`；买 vs 租对比。
7. **合规检查**：敏感词/医疗化/夸大/擦边；提供替代表达库。

---

## 7. 前端路由与页面

- `/` 首页（模板发现）
- `/templates` 列表；`/templates/[id]` 详情
- `/wizard` 适配向导（step=1..4）
- `/projects` 列表；`/projects/[id]` 详情（Tab：overview/script/bom/compliance/comments/versions）
- `/export/[id]` 导出记录或下载页

**组件契约**：

- `TemplateCard`、`FilterDrawer`、`ShotTable`、`ParamPanel(Light/Camera/Audio)`、`BOMTable`、`ComplianceList`、`ExportDialog`、`CommentThread`。

---

## 8. 接口（OpenAPI 3.1 摘要）

> 详细 YAML 已在 PRD；此处列关键端点与样例。

### POST `/v1/templates/search`

- **Request**：`{industry?, style?, purpose?, space?, budget?}`
- **Response**：`Template[]`

### POST `/v1/projects/generate`

- **Request**：`{brief: Brief, space: Space, inventory?: InventoryItem[], budget?: Budget}`
- **Response**：`{script[], lighting[], camera[], audio[], bom[], compliance}`

**示例请求**

```json
{
  "brief": {
    "product": "口红X",
    "audience": ["都市白领"],
    "goal": "convert",
    "brandTone": "warm",
    "aspect": "9:16",
    "fps": 25,
    "colorTone": "6000K 高对比温馨"
  },
  "space": {"length": 2.2, "width": 2.4, "height": 2.8, "wall": "white", "ambientLight": "mid", "noise": "low"},
  "inventory": [{"category": "light", "brand": "Godox", "model": "SL60W", "qty": 1}],
  "budget": {"mode": "total", "region": "B", "total": 3000}
}
```

### POST `/v1/adapt`

以 `templateId + Space + Inventory + Budget` 生成适配版本。

### POST `/v1/export`

- **Request**：`{projectId, types: ["pdf","csv","zip"]}`
- **Response**：返回签名下载 URL 与导出记录 ID。

---

## 9. 导出服务设计

- **触发**：前端调用 `/v1/export` → Edge Function 创建导出任务 → Worker 拉取任务。
- **生成**：
  - PDF：pdf-lib/pdfkit（Node）或 reportlab（Python）；模板采用“目录 + 卡片分节”。
  - CSV：BOM 以逗号分隔（UTF-8）。
  - ZIP（Sora Prompt 包）：`global.txt` + `shots/*.txt` + `refs/color_palette.png` + `readme.md`。
- **存储**：写入 `exports/PROJECT_ID/TIMESTAMP/*`；返回签名 URL（有效期 7 日）。
- **重试**：失败重试 3 次；失败记录 `E_EXPORT_500`。

---

## 10. 权限矩阵（简化）

| 操作              | Owner | 导演 | 搭建师         | 灯光/摄像 | 访客 |
| ----------------- | ----- | ---- | -------------- | --------- | ---- |
| 创建/删除项目     | ✅     | 🚫   | 🚫             | 🚫        | 🚫   |
| 编辑 Brief/向导   | ✅     | ✅   | ⚠️ 仅设备/空间 | 🚫        | 🚫   |
| 编辑脚本/参数     | ✅     | ✅   | ✅             | ✅        | 🚫   |
| 导出              | ✅     | ✅   | ✅             | ✅        | ✅   |
| 评论/@            | ✅     | ✅   | ✅             | ✅        | ✅   |
| 版本回滚          | ✅     | ✅   | 🚫             | 🚫        | 🚫   |

---

## 11. 错误码与文案

- `E_TMPL_404` 未匹配模板 → “未找到完全匹配，已为你准备 3 套通用起步方案。”
- `E_MAP_406` 设备映射失败 → 展示未匹配清单与替代表。
- `E_BUDGET_400` 预算字段异常 → 高亮错误项。
- `E_EXPORT_500` 导出失败 → 提示重试；保留记录。

---

## 12. 埋点（事件 × 属性）

- `view_template` {template_id}
- `start_wizard` {source, template_id}
- `complete_step` {step_no, duration_ms}
- `generate_success` {template_id, variant, has_inventory}
- `export` {types[], pages, has_qr, duration_ms}
- `comment_added` {project_id}
- `mapping_fallback` {unmatched_count}

---

## 13. 测试计划

- **单测**：规则函数（映射/预算/灯光解算）；最低覆盖 70%。
- **集成**：`/v1/projects/generate` 输入组合（含空/错/边界）。
- **E2E**：Playwright：模板 → 向导 → 结果 → 导出 → 下载。
- **回归**：导出包结构、PDF 字体/中文、CSV UTF-8 BOM。

---

## 14. CI/CD

- GitHub Actions：Lint/Typecheck/Test → Build → Preview → Prod。
- 分支策略：`main`（prod），`dev`（staging）。PR 必须通过单测与构建。
- 部署：web → Vercel；Edge Functions/DB → Supabase；Worker → Railway/Fly.io。

---

## 15. 性能与安全

- 列表页 ISR 60 s；详情 SSR。
- 结果页/导出接口限频（IP + 用户）：每分钟 5 次。
- RLS 全量开启；导出链接短期签名；敏感日志脱敏。
- 上传校验（MIME/大小）+ 病毒扫描（可选）。

---

## 16. 内容与种子数据

- **首发 20 套模板**：见《PRD 画布·章节 M》，导入脚本提供 CSV/JSON 两份。
- **设备映射词表**：首发 ≥ 50 条；字段 `{category, powerW?, mount?, alt_models[]}`。
- **合规替代话术**：按“风险点 → 替代说法 → 适用行业”三列导入。

---

## 17. 里程碑（7 周）

- W1：交互定稿、数据表上线、映射词表 v0。
- W2：模板检索与详情、向导 Step1–2。
- W3：预算器 Step3、规则引擎、Step4 结果页。
- W4：导出服务（PDF/CSV/ZIP）与导出记录。
- W5：项目空间/评论/版本、埋点与看板。
- W6：私测（≥ 10 家）与修复、模板首发 20 套。
- W7：公测与增长物料（落地页/教程）。

---

## 18. FAQ（给开发）

- **为什么选 Supabase？** 免费层 + RLS + 存储足够，集成最省力。
- **PDF 中文字体？** 嵌入 Noto Sans CJK；按权重裁剪以减体积。
- **ZIP 体积控制？** shots 文本化；refs 仅放色板与小图。
- **可扩展项**：AR / 硬件 SDK / 市场与版权 / 设备推送。

---

## 19. 附录：类型定义（片段）

```ts
export type Brief = {
  product: string
  audience: string[]
  goal: 'convert' | 'seed' | 'traffic' | 'launch'
  brandTone: 'life' | 'tech' | 'warm' | 'minimal'
  aspect: '9:16' | '16:9' | '1:1'
  fps: number
  colorTone: string
}

export type Space = {
  length: number
  width: number
  height: number
  wall?: 'white' | 'gray' | 'colored' | 'glass' | 'mirror' | 'acoustic'
  ambientLight?: 'low' | 'mid' | 'high'
  noise?: 'low' | 'mid' | 'high'
  outlets?: number
}
```

---

> 备注：本开发文档与《PRD + 方案蓝本》配套使用；如需 Postman 集合 / OpenAPI 完整 YAML / Supabase seed 脚本，可在需求单中勾选。

---

# O. Go/No-Go 验收清单（MVP · 10 条）

> 用于发布前评审；全项通过才 Go。每条含范围/步骤/通过标准/证据。评审人打钩并附截图或链接。

1. **向导 4 步可闭环（美妆 · MZ-001）**

   - 步骤：`首页 → MZ-001 → 一键适配 → Step1–4` 生成结果
   - 通过：4 步无致命报错；结果页出现 6 张卡片（脚本/灯光/相机/音频/BOM/合规）
   - 证据：结果页 URL + 截图

2. **向导 4 步可闭环（服饰 · FS-001）**

   - 同上；更换模板 FS-001，空间 = 8 ㎡，预算 = 低
   - 通过：结果对象内 `shot.length ≥ 3`，并含“衣物细节”关键词

3. **向导 4 步可闭环（数码 · 3C-001）**

   - 同上；模板 3C-001，统一色调 = 6000K 高对比
   - 通过：相机参数含 `WB = 6000K` 与 `1/50`

4. **设备映射失败 → 回退方案**

   - 步骤：库存仅有 `RGB LED 5m`，移除主光，运行生成
   - 通过：出现 `E_MAP_406` 提示；结果页显示“未匹配清单 + 替代表”，可一键加入 BOM

5. **预算器**

   - 步骤：区域 = A（1.25/1.15），总额 = 3000，切换买 vs 租
   - 通过：总价随系数/买租变化；导出的 CSV 合计与 UI 一致（±1 元内）

6. **导出 PDF**

   - 步骤：结果页 → 导出 PDF
   - 通过：PDF 含目录与 6 节内容；中文字体正常；二维码可扫至落地页

7. **导出 CSV-BOM**

   - 步骤：结果页 → 导出 CSV
   - 通过：UTF-8（含 BOM）；金额汇总正确；列头与字段字典一致

8. **导出 Prompt ZIP**

   - 步骤：结果页 → 导出 ZIP
   - 通过：结构 = `global.txt + shots/*.txt + refs/color_palette.png + readme.md`

9. **项目保存 & 评论 @**

   - 步骤：保存结果为项目 → 评论 @ 测试账号“导演”
   - 通过：导演账号可收到并查看项目；RLS 不允许访客查看

10. **埋点漏斗**

    - 步骤：走完 3 条 happy-path
    - 通过：仪表盘显示 `start_wizard → complete_step → generate_success → export` 全链路事件；`generate_success` 的 `has_inventory` 正确

> 评审结论：**Go / No-Go**（圈选）

---

# P. Playwright E2E 用例骨架

> 三条 happy-path + 一条错误映射回退；可直接在 CI 跑。默认使用 `.env` 注入 baseURL 与测试账号。

## P1. 目录结构

```
/e2e
  ├─ tests
  │   ├─ happy-makeup.spec.ts
  │   ├─ happy-fashion.spec.ts
  │   ├─ happy-3c.spec.ts
  │   └─ mapping-fallback.spec.ts
  ├─ fixtures
  │   └─ auth.ts
  ├─ playwright.config.ts
  └─ README.md
```

## P2. 关键约定

- `.env`：`E2E_BASE_URL`、`E2E_EMAIL_OWNER`、`E2E_PASSWORD_OWNER` 等。
- 登录统一走 `fixtures/auth.ts`。
- 选择模板依赖测试数据：`MZ-001 / FS-001 / 3C-001` 已在 seed 中。

---

