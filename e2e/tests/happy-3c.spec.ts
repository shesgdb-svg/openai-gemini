import { test, expectAuth as expect } from '../fixtures/auth';

test.describe('Happy Path · 数码模板', () => {
  test('校验相机参数包含 6000K 与 1/50', async ({ authenticatedPage: page }) => {
    await page.goto('/wizard?template=3C-001');

    await page.getByLabel('色调').fill('6000K 高对比');
    await page.getByRole('button', { name: '下一步' }).click();

    await page.getByLabel('空间高度').fill('3');
    await page.getByRole('button', { name: '下一步' }).click();

    await page.getByLabel('预算等级').selectOption('medium');
    await page.getByRole('button', { name: '生成方案' }).click();

    await page.waitForSelector('section[data-block="camera"]');
    const cameraText = await page.locator('section[data-block="camera"]').textContent();
    expect(cameraText).toMatch(/WB\s*=\s*6000K/i);
    expect(cameraText).toMatch(/1\/50/);
  });
});
