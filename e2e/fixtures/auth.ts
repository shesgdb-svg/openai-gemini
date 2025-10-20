import { test as base, expect, Page } from '@playwright/test';

type Credentials = {
  email: string;
  password: string;
};

type AuthFixtures = {
  authenticatedPage: Page;
  owner: Credentials;
  director: Credentials;
};

async function performLogin(page: Page, { email, password }: Credentials) {
  await page.goto('/auth/sign-in');
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码').fill(password);
  await page.getByRole('button', { name: '登录' }).click();
  await page.waitForURL(/dashboard|\/templates/, { timeout: 15_000 });
  await expect(page).toHaveURL(/dashboard|\/templates/);
}

export const test = base.extend<AuthFixtures>({
  owner: async ({}, use) => {
    const owner: Credentials = {
      email: process.env.E2E_EMAIL_OWNER ?? 'owner@example.com',
      password: process.env.E2E_PASSWORD_OWNER ?? 'Passw0rd!',
    };
    await use(owner);
  },
  director: async ({}, use) => {
    const director: Credentials = {
      email: process.env.E2E_EMAIL_DIRECTOR ?? 'director@example.com',
      password: process.env.E2E_PASSWORD_DIRECTOR ?? 'Passw0rd!',
    };
    await use(director);
  },
  authenticatedPage: async ({ browser, owner }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await performLogin(page, owner);
    await use(page);
    await context.close();
  },
});

export const { describe, beforeEach, afterEach } = test;
export const expectAuth = expect;
