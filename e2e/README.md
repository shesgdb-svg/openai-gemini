# LiveScene Playwright 套件

本目录提供 MVP 阶段的端到端自动化骨架，可在本地与 CI 直接运行。建议结合 `docs/livescene-dev-doc.md` 中的 Go/No-Go 清单共同验收。

## 环境准备

1. 安装依赖：在仓库根目录执行 `pnpm install`。
2. 配置 `.env`（本地或 CI）：
   - `E2E_BASE_URL`：被测站点地址（如 `http://localhost:3000`）。
   - `E2E_EMAIL_OWNER`、`E2E_PASSWORD_OWNER`：Owner 测试账号。
   - `E2E_EMAIL_DIRECTOR`、`E2E_PASSWORD_DIRECTOR`：导演账号（用于协作场景）。
   - `E2E_DOWNLOAD_DIR`（可选）：下载文件保存目录，默认使用 Playwright 临时目录。
3. 若需多角色并发，可新增 `.env` 变量并在 `fixtures/auth.ts` 中扩展。

## 运行方式

```bash
pnpm exec playwright test --config e2e/playwright.config.ts
```

常用参数：

- `--project=chromium`：仅运行 Chromium。
- `--grep @smoke`：按标签筛选。
- `--update-snapshots`：更新截图/快照。

## 目录约定

- `playwright.config.ts`：全局配置与项目定义。
- `fixtures/auth.ts`：统一登录流程，暴露带身份的测试上下文。
- `tests/*.spec.ts`：业务测试用例骨架，按场景分类。

## 文件下载

测试中会校验导出的 PDF/CSV/ZIP，可通过以下方式保存：

```ts
const download = await page.waitForEvent('download');
await download.saveAs(path.resolve(process.env.E2E_DOWNLOAD_DIR ?? 'tmp/downloads', download.suggestedFilename()));
```

CI 环境建议将目录上传为 Artifact 供评审。

## 后续扩展建议

- 引入 [@playwright/test](https://playwright.dev/docs/test-intro) 中的 [test.step](https://playwright.dev/docs/api/class-teststep) 提升报告可读性。
- 结合 Supabase API 写入前置数据，缩短场景准备时间。
- 使用 `storageState` 复用登录状态，加速测试执行。
