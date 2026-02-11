/**
 * Student login setup. Credentials (E2E_STUDENT_EMAIL, E2E_STUDENT_PASSWORD)
 * must be for an existing user with role=student in the Neon E2E DB (.env.e2e DATABASE_URL).
 * E2E tests must not create users, modify schema, or change auth behavior.
 */
import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const authDir = path.join(__dirname, '..', '.auth');
const studentAuthPath = path.join(authDir, 'student.json');

setup('student login and save storage state', async ({ page }) => {
  const email = process.env.E2E_STUDENT_EMAIL;
  const password = process.env.E2E_STUDENT_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'E2E_STUDENT_EMAIL and E2E_STUDENT_PASSWORD must be set (e.g. in .env.e2e)'
    );
  }

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page).toHaveURL(/\/student\/?$/);

  fs.mkdirSync(authDir, { recursive: true });
  await page.context().storageState({ path: studentAuthPath });
});
