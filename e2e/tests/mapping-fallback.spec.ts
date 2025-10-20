import path from 'node:path';
import fs from 'node:fs/promises';
import { test, expectAuth as expect } from '../fixtures/auth';

const DOWNLOAD_DIR = process.env.E2E_DOWNLOAD_DIR ?? path.resolve('tmp/downloads');

async function ensureDownloadDir() {
  await fs.mkdir(DOWNLOAD_DIR, { recursive: true });
}

test.describe('设备映射回退', () => {
  test('库存不足时提示 E_MAP_406 并提供替代表', async ({ authenticatedPage: page }) => {
    await ensureDownloadDir();

    await page.goto('/wizard?template=MZ-001');
    await page.getByLabel('库存清单').fill('RGB LED 5m');
    await page.getByRole('button', { name: '生成方案' }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('E_MAP_406');
    await expect(alert).toContainText('未匹配清单');

    await page.getByRole('button', { name: '查看替代表' }).click();
    const fallbackList = page.locator('[data-testid="mapping-fallback-list"] li');
    expect(await fallbackList.count()).toBeGreaterThan(0);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: '加入 BOM 并导出 CSV' }).click(),
    ]);
    const targetPath = path.resolve(DOWNLOAD_DIR, download.suggestedFilename());
    await download.saveAs(targetPath);
    const fileStat = await fs.stat(targetPath);
    expect(fileStat.size).toBeGreaterThan(0);
  });
});
