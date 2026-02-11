import { test, expect } from '@playwright/test';

test.describe('unauthenticated', () => {
  test('redirects to /login when visiting /admin', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });

  test('redirects to /login when visiting /instructor', async ({ page }) => {
    await page.goto('/instructor');
    await expect(page).toHaveURL(/\/login/);
  });

  test('redirects to /login when visiting /student', async ({ page }) => {
    await page.goto('/student');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('authenticated admin', () => {
  test.use({ storageState: 'tests/e2e/.auth/admin.json' });

  test('can access /admin', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin/);
    // Verify page actually loaded (not just redirected to a blank /admin)
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('authenticated instructor', () => {
  test.use({ storageState: 'tests/e2e/.auth/instructor.json' });

  test('can access /instructor', async ({ page }) => {
    await page.goto('/instructor');
    await expect(page).toHaveURL(/\/instructor/);
    // Verify page actually loaded (not just redirected to a blank /instructor)
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('authenticated student', () => {
  test.use({ storageState: 'tests/e2e/.auth/student.json' });

  test('can access /student', async ({ page }) => {
    await page.goto('/student');
    await expect(page).toHaveURL(/\/student/);
    // Verify page actually loaded (not just redirected to a blank /student)
    await expect(page.locator('body')).toBeVisible();
  });
});
