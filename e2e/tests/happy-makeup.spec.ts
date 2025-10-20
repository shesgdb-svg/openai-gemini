import { test, expectAuth as expect } from '../fixtures/auth';

const TEMPLATE_CODE = 'MZ-001';

test.describe('Happy Path · 美妆模板', () => {
  test('@smoke 完成美妆向导并导出全部', async ({ authenticatedPage: page }) => {
    await test.step('选择模板并进入向导', async () => {
      await page.goto('/templates');
      await page.getByRole('link', { name: new RegExp(TEMPLATE_CODE) }).click();
      await page.getByRole('button', { name: '一键适配' }).click();
    });

    await test.step('完成 Step1 Brief', async () => {
      await page.getByLabel('品牌调性').selectOption('warm');
      await page.getByLabel('目标').selectOption('convert');
      await page.getByRole('button', { name: '下一步' }).click();
    });

    await test.step('完成 Step2 空间设备', async () => {
      await page.getByLabel('空间面积').fill('6');
      await page.getByRole('button', { name: '下一步' }).click();
    });

    await test.step('完成 Step3 预算', async () => {
      await page.getByLabel('总预算').fill('3000');
      await page.getByRole('button', { name: '下一步' }).click();
    });

    await test.step('生成结果', async () => {
      await page.getByRole('button', { name: '生成方案' }).click();
      await page.waitForSelector('section:has-text("脚本")');
      const cards = await page.locator('section[data-block]').count();
      expect(cards).toBeGreaterThanOrEqual(6);
    });

    await test.step('导出 PDF/CSV/ZIP', async () => {
      await page.getByRole('button', { name: '导出' }).click();
      await page.getByRole('checkbox', { name: 'PDF' }).check();
      await page.getByRole('checkbox', { name: 'CSV' }).check();
      await page.getByRole('checkbox', { name: 'ZIP' }).check();
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: '开始导出' }).click(),
      ]);
      await download.cancel();
    });
  });
});
