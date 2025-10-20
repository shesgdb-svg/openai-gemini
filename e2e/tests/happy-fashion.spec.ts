import { test, expectAuth as expect } from '../fixtures/auth';

const TEMPLATE_CODE = 'FS-001';

test.describe('Happy Path · 服饰模板', () => {
  test('生成服饰方案包含衣物细节脚本', async ({ authenticatedPage: page }) => {
    await page.goto(`/wizard?template=${TEMPLATE_CODE}`);

    await page.getByLabel('空间面积').fill('8');
    await page.getByRole('button', { name: '下一步' }).click();

    await page.getByLabel('灯光库存').selectOption('默认');
    await page.getByRole('button', { name: '下一步' }).click();

    await page.getByLabel('预算等级').selectOption('low');
    await page.getByRole('button', { name: '生成方案' }).click();

    await page.waitForSelector('section:has-text("脚本")');
    const scriptTexts = await page.locator('section[data-block="script"] li').allInnerTexts();
    const hasDetail = scriptTexts.some((text) => /衣物细节/.test(text));
    expect(hasDetail).toBeTruthy();
    const shotCount = await page.locator('section[data-block="script"] li').count();
    expect(shotCount).toBeGreaterThanOrEqual(3);
  });
});
