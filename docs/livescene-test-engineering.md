# LiveScene 测试工程方案 v1.0

> 面向 QA / 开发协同团队的测试落地文档，覆盖范围、策略、环境、数据、用例矩阵与自动化计划，确保直播场景样稿 MVP 在 7 周内可交付、可验证。

---

## 1. 测试范围

| 模块 | 主要功能 | 风险等级 | 说明 |
| --- | --- | --- | --- |
| 模板库 | 检索、筛选、详情、收藏 | 高 | 涉及多维筛选与缓存策略，错误易直接影响转化 |
| 适配向导 | Brief → 空间 → 预算 → 结果 | 高 | 表单校验、规则引擎调用、状态保存 |
| 结果页 | 六大模块展示、导出入口 | 高 | 数据准确性与导出触发可靠性 |
| 项目空间 | 列表、详情、评论、版本 | 中 | RLS 权限与版本差异对比 |
| 导出服务 | PDF/CSV/ZIP 生成与回写 | 高 | 性能、稳定性、编码兼容 |
| 权限与协作 | RLS、角色矩阵、通知 | 中 | 需覆盖 Owner/导演/搭建师/访客等角色 |
| 监控与埋点 | Sentry、Umami、Edge 日志 | 中 | 数据完整性直接影响运营分析 |

---

## 2. 测试策略

1. **单元测试**：规则函数（预算、灯光解算、设备映射、合规校验）；最低覆盖率 70%。
2. **集成测试**：Supabase Edge Function `/v1/projects/generate`、`/v1/export`；模拟不同 Inventory/Budget 组合。
3. **端到端测试**：Playwright 端对端流程（模板 → 向导 → 结果 → 导出 → 下载）；多浏览器（Chromium/Firefox/Webkit）。
4. **回归测试**：导出包结构、PDF 字体渲染、CSV UTF-8 BOM；模板检索缓存；RLS 权限。
5. **非功能测试**：
   - 性能：导出服务并发 5、10、20 阶梯压测，目标 P95 < 6s。
   - 安全：RLS 绕过测试、签名 URL 过期验证、输入敏感词检测。
   - 可用性：关键路径（开始向导、导出）NPS ≥ 8（内测 10 家）。

---

## 3. 环境矩阵

| 环境 | URL/部署 | 数据库 | 存储 | 说明 |
| --- | --- | --- | --- | --- |
| 本地 | `localhost:3000`、Supabase 本地容器 | `supabase-dev` | 本地 Storage | 开发自测、单测、Playwright UI |
| Staging | `https://dev.livescene.example.com` | Supabase `livescene-dev` | Supabase Storage `dev` | 每次合并到 `dev` 自动部署；QA 回归与自动化主要环境 |
| Production | `https://livescene.example.com` | Supabase `livescene-prod` | Supabase Storage `prod` | 仅灰度发布 + 正式用户 |

**配置管理**：通过 `.env.local`, `.env.staging`, `.env.production` 管理；敏感变量使用 Supabase Secrets + Vercel 环境变量注入。

---

## 4. 测试数据策略

- 模板库：导入 20 套种子模板 + 5 套异常模板（字段缺失/超长）。
- 设备映射：≥ 50 条词表，包含功率、接口、替代型号。
- 合规话术：30 条敏感词 → 替代表达映射，用于正/负用例。
- 预算场景：总预算、单品预算、租赁 vs 购买三类。
- 账号角色：Owner/导演/搭建师/访客四类测试账号；Staging 使用魔术链登录。
- 导出验证：预置 3 个项目数据用于回归；包括灯光高亮度、音频多麦克风、BOM 大量配件。

---

## 5. 用例设计

### 5.1 单元测试样例

| 标识 | 场景 | 输入 | 预期 |
| --- | --- | --- | --- |
| UT-BUD-001 | 区域系数 B，租赁 | `base=1000, region=B, quantity=3, days=2, mode='rent'` | 输出 5100，租赁比购买省 15% |
| UT-LUX-002 | 灯光解算 - 高亮背景 | `ambient=high, subjectDistance=1.5` | 建议补光增加 20%，色温 6000K±200 |
| UT-MAP-003 | 设备映射无库存 | `category='light', model='不存在'` | 返回备用列表 >=2，错误码 `E_MAP_406` |

### 5.2 集成测试样例

| 标识 | 接口 | 场景 | 关键断言 |
| --- | --- | --- | --- |
| IT-GEN-001 | `/v1/projects/generate` | 完整 Brief + Inventory | `lighting` 数组长度 ≥3，`bom` 含库存型号 |
| IT-GEN-005 | `/v1/projects/generate` | 无匹配模板 | 返回 `fallbackTemplates` 3 套，并记录埋点 `mapping_fallback` |
| IT-EXP-002 | `/v1/export` | 请求 PDF+CSV | 生成任务写入 `exports/PROJECT_ID/TIMESTAMP/`，签名 URL 7 日有效 |

### 5.3 端到端用例

1. **E2E-FLOW-001**：模板检索 → 选择模板 → 完成 4 步向导 → 查看结果 → 导出全部 → 校验下载文件结构。
2. **E2E-COLLAB-002**：Owner 创建项目 → 导演评论 @搭建师 → 搭建师更新空间参数 → 版本号 +1 → 导出 BOM。
3. **E2E-RLS-003**：访客登录 → 查看项目 → 无法编辑、可导出；尝试访问他人项目返回 403。

---

## 6. 自动化与工具链

- **测试框架**：Vitest（单元）+ Supertest（集成）+ Playwright（E2E）。
- **Mock/Fixture**：msw 模拟 Supabase REST；测试种子数据位于 `packages/schema/fixtures`。
- **CI 集成**：GitHub Actions 3 阶段工作流：
  1. `lint-type-test`: `pnpm lint && pnpm test`
  2. `integration`: 启动 Supabase Test Containers，运行 `pnpm test:integration`
  3. `e2e`: 部署 Preview，运行 Playwright Cloud。
- **报告**：
  - Coverage 上传至 Codecov；阈值 70%。
  - Playwright 截图 & 视频存储在 GitHub Actions Artifact（保留 30 天）。
  - 缺陷管理使用 Linear（标签：`qa`, `bug`, `severity`）。

---

## 7. 里程碑与交付

| 周次 | 交付物 | 负责人 | 验收 |
| --- | --- | --- | --- |
| W2 | 单元测试样例 + 测试数据种子 | 开发/QA 协作 | 评审覆盖率报告 |
| W3 | 集成测试脚本 + Supabase 测试容器 | QA | CI 集成通过 |
| W4 | Playwright 脚本初稿 + 导出回归 | QA | Preview 环境通过 |
| W5 | RLS/权限专项、非功能压测 | 安全/性能组 | 报告通过基线 |
| W6 | 公测缺陷回归、测试总结报告 | QA Owner | 缺陷清零、发布评审通过 |
| W7 | 上线后监控复盘（7 天） | QA + 产品 | 指标达标、经验沉淀 |

---

## 8. 风险与应对

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| 导出服务生成耗时过长 | 发布延迟、用户体验差 | 优化图片压缩、启用并行渲染、监控 P95 |
| Supabase RLS 误配置 | 数据泄露或访问失败 | 引入基线测试脚本，变更需双人 Code Review |
| Playwright 不稳定 | CI Flaky | 采用 `--retry 2`、网络请求 mock，失败自动截屏 |
| 测试数据污染生产 | 合规风险 | 区分环境密钥、启用数据擦除脚本 |

---

## 9. 追踪与复盘

- 周会同步测试执行情况，使用 QA 看板跟踪。
- 版本发布后 7 天内收集崩溃、性能指标，形成复盘报告。
- 将关键测试脚本沉淀为模板，纳入 `packages/utils/testing` 供后续项目复用。

