/**
 * Full lifecycle E2E test: Admin → Instructor → Student → Instructor → Student
 * 
 * Flow:
 * 1. Admin creates module, assigns instructor, publishes
 * 2. Student sees module, answers questions, submits
 * 3. Instructor grades answers, finalises
 * 4. Student sees final grades (read-only)
 * 
 * Constraints:
 * - Uses REAL UI routes only
 * - Role-based/text selectors (no hardcoded IDs)
 * - Dynamic loops (no assumptions about question structure)
 * - E2E_CANARY_ prefixed titles to avoid collisions
 * - NO automatic DB cleanup
 */

import { test, expect } from '@playwright/test';

const CANARY_MODULE_TITLE = `E2E_CANARY_Module_${Date.now()}`;
const CANARY_MODULE_DESC = 'E2E test module - full lifecycle';
const CANARY_QUESTION_TITLE = `E2E_CANARY_Question_${Date.now()}`;

test.describe('Full Lifecycle: Admin → Instructor → Student → Grades', () => {
  let moduleId: string;
  let questionId: string;

  test.use({ storageState: 'tests/e2e/.auth/admin.json' });

  test('Step 1: Admin creates module', async ({ page }) => {
    await page.goto('/admin');
    
    // Click Modules tab
    await page.getByRole('tab', { name: /modules/i }).click();
    
    // Click Create Module button
    await page.getByRole('button', { name: /create module/i }).click();
    
    // Fill in module details in dialog
    await page.getByLabel(/title/i).fill(CANARY_MODULE_TITLE);
    await page.getByLabel(/description/i).fill(CANARY_MODULE_DESC);
    
    // Submit creation
    await page.getByRole('dialog').getByRole('button', { name: /create/i }).click();
    
    // Wait for module to appear in table and extract moduleId from URL/data
    await expect(page.getByText(CANARY_MODULE_TITLE)).toBeVisible();
    
    // Module is created, but we need to capture the ID
    // Since we can't get ID from UI directly, we'll need to navigate as instructor next
  });

  test('Step 2: Admin assigns instructor', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('tab', { name: /modules/i }).click();
    
    // Find the row containing our canary module
    const moduleRow = page.locator('tr', { has: page.getByText(CANARY_MODULE_TITLE) });
    await expect(moduleRow).toBeVisible();
    
    // Click Assign Instructor button (UserPlus icon)
    await moduleRow.getByRole('button').filter({ has: page.locator('svg') }).first().click();
    
    // Select instructor from dropdown
    // Assuming instructor email from .env.e2e is inst@gmail.com
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: /inst@gmail.com|instructor/i }).click();
    
    // Click Assign button in dialog
    await page.getByRole('dialog').getByRole('button', { name: /assign/i }).click();
    
    // Verify success
    await expect(page.getByText(/instructor assigned successfully/i)).toBeVisible();
  });

  test('Step 3: Admin enrolls student', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('tab', { name: /modules/i }).click();
    
    const moduleRow = page.locator('tr', { has: page.getByText(CANARY_MODULE_TITLE) });
    await expect(moduleRow).toBeVisible();
    
    // Click Enroll Student button (GraduationCap icon) - second button
    await moduleRow.getByRole('button').filter({ has: page.locator('svg') }).nth(1).click();
    
    // Select student from dropdown
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: /student@gmail.com|student/i }).click();
    
    // Click Enroll button in dialog
    await page.getByRole('dialog').getByRole('button', { name: /enroll/i }).click();
    
    // Verify success
    await expect(page.getByText(/student enrolled successfully/i)).toBeVisible();
  });
});

test.describe('Instructor creates questions', () => {
  test.use({ storageState: 'tests/e2e/.auth/instructor.json' });

  test('Step 4: Instructor creates question with parts and sub-questions', async ({ page }) => {
    await page.goto('/instructor');
    
    // Find and click on our canary module
    await expect(page.getByText(CANARY_MODULE_TITLE)).toBeVisible();
    await page.getByText(CANARY_MODULE_TITLE).click();
    
    // Extract moduleId from URL
    await expect(page).toHaveURL(/\/instructor\/modules\/([a-f0-9-]+)/);
    
    // Create a question
    await page.getByRole('button', { name: /add question|create question|new question/i }).click();
    
    // Fill question details
    await page.getByLabel(/title/i).fill(CANARY_QUESTION_TITLE);
    await page.getByLabel(/scenario/i).fill('This is an E2E test scenario for the full lifecycle test.');
    
    // Add Part A
    await page.getByRole('button', { name: /add part/i }).click();
    await page.getByLabel(/part label/i).first().fill('A');
    
    // Add sub-question to Part A
    await page.getByRole('button', { name: /add sub-question/i }).first().click();
    await page.getByLabel(/prompt/i).first().fill('What is the capital of France?');
    await page.getByLabel(/max marks/i).first().fill('10');
    
    // Add Part B
    await page.getByRole('button', { name: /add part/i }).click();
    await page.getByLabel(/part label/i).last().fill('B');
    
    // Add sub-question to Part B
    await page.getByRole('button', { name: /add sub-question/i }).last().click();
    await page.getByLabel(/prompt/i).last().fill('Explain the concept of recursion.');
    await page.getByLabel(/max marks/i).last().fill('15');
    
    // Save question
    await page.getByRole('button', { name: /save|create/i }).click();
    
    // Verify question appears
    await expect(page.getByText(CANARY_QUESTION_TITLE)).toBeVisible();
  });

  test('Step 5: Instructor marks module as ready', async ({ page }) => {
    await page.goto('/instructor');
    
    // Click on our module
    await page.getByText(CANARY_MODULE_TITLE).click();
    
    // Mark as ready for publish
    await page.getByRole('button', { name: /mark as ready|ready for publish/i }).click();
    
    // Confirm if there's a dialog
    const dialog = page.getByRole('dialog');
    if (await dialog.isVisible()) {
      await dialog.getByRole('button', { name: /confirm|mark as ready/i }).click();
    }
    
    // Verify status change
    await expect(page.getByText(/ready/i)).toBeVisible();
  });
});

test.describe('Admin publishes module', () => {
  test.use({ storageState: 'tests/e2e/.auth/admin.json' });

  test('Step 6: Admin publishes module', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('tab', { name: /modules/i }).click();
    
    const moduleRow = page.locator('tr', { has: page.getByText(CANARY_MODULE_TITLE) });
    await expect(moduleRow).toBeVisible();
    
    // Click Publish button (BookOpen icon) - should be enabled when ready_for_publish is true
    // The publish button has a distinctive yellow/lime color when ready
    await moduleRow.getByRole('button').filter({ has: page.locator('svg') }).nth(2).click();
    
    // Verify success toast
    await expect(page.getByText(/module published successfully/i)).toBeVisible();
    
    // Verify status changed to "published"
    await expect(moduleRow.getByText(/published/i)).toBeVisible();
  });
});

test.describe('Student answers and submits', () => {
  test.use({ storageState: 'tests/e2e/.auth/student.json' });

  test('Step 7: Student sees published module', async ({ page }) => {
    await page.goto('/student/modules');
    
    // Verify module is visible
    await expect(page.getByText(CANARY_MODULE_TITLE)).toBeVisible();
    
    // Verify "Published" badge
    await expect(page.locator('.badge', { hasText: /published/i })).toBeVisible();
  });

  test('Step 8: Student answers questions', async ({ page }) => {
    await page.goto('/student/modules');
    
    // Click on module
    await page.getByText(CANARY_MODULE_TITLE).click();
    
    // Extract moduleId from URL
    const url = page.url();
    const moduleIdMatch = url.match(/\/student\/modules\/([a-f0-9-]+)/);
    expect(moduleIdMatch).toBeTruthy();
    const currentModuleId = moduleIdMatch![1];
    
    // Click on first question (our canary question)
    await expect(page.getByText(CANARY_QUESTION_TITLE)).toBeVisible();
    await page.getByText(CANARY_QUESTION_TITLE).click();
    
    // Now we're on the question page - answer all sub-questions dynamically
    // Find all textareas and fill them
    const textareas = page.getByRole('textbox');
    const textareaCount = await textareas.count();
    
    for (let i = 0; i < textareaCount; i++) {
      await textareas.nth(i).fill(`This is answer ${i + 1} for E2E testing. Capital of France is Paris. Recursion is a function calling itself.`);
      // Wait for auto-save
      await page.waitForTimeout(1000);
    }
    
    // Verify save status indicator
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });
    
    // Go back to module overview
    await page.getByRole('link', { name: /back to module/i }).click();
  });

  test('Step 9: Student submits module', async ({ page }) => {
    await page.goto('/student/modules');
    await page.getByText(CANARY_MODULE_TITLE).click();
    
    // Click Complete Module button
    await page.getByRole('button', { name: /complete module/i }).click();
    
    // Confirm in AlertDialog
    await expect(page.getByText(/are you sure you want to submit/i)).toBeVisible();
    await page.getByRole('button', { name: /^submit$/i }).click();
    
    // Verify submission success
    await expect(page.getByText(/completed/i)).toBeVisible();
    
    // Verify button is now disabled and shows "Completed"
    await expect(page.getByRole('button', { name: /completed/i })).toBeDisabled();
  });
});

test.describe('Instructor grades and finalises', () => {
  test.use({ storageState: 'tests/e2e/.auth/instructor.json' });

  test('Step 10: Instructor sees submission', async ({ page }) => {
    await page.goto('/instructor');
    
    // Click on our module
    await page.getByText(CANARY_MODULE_TITLE).click();
    
    // Click on Submissions tab or link
    await page.getByRole('link', { name: /submissions|view submissions/i }).click();
    
    // Verify student submission appears
    await expect(page.getByText(/student@gmail.com|student/i)).toBeVisible();
    await expect(page.getByText(/submitted/i)).toBeVisible();
  });

  test('Step 11: Instructor grades all answers', async ({ page }) => {
    await page.goto('/instructor');
    await page.getByText(CANARY_MODULE_TITLE).click();
    await page.getByRole('link', { name: /submissions|view submissions/i }).click();
    
    // Click on student submission
    await page.getByText(/student@gmail.com|student/i).click();
    
    // Now on submission detail page
    // Find all score input fields and grade them dynamically
    const scoreInputs = page.getByLabel(/score|marks/i);
    const scoreCount = await scoreInputs.count();
    
    for (let i = 0; i < scoreCount; i++) {
      await scoreInputs.nth(i).fill(String(8 + i)); // Give scores like 8, 9, etc.
      // Wait for auto-save
      await page.waitForTimeout(1000);
    }
    
    // Add feedback to first answer (optional)
    const feedbackInputs = page.getByLabel(/feedback/i);
    if (await feedbackInputs.count() > 0) {
      await feedbackInputs.first().fill('Great work! Keep it up.');
      await page.waitForTimeout(1000);
    }
    
    // Verify save indicators
    await expect(page.getByText(/saved/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('Step 12: Instructor finalises grades', async ({ page }) => {
    await page.goto('/instructor');
    await page.getByText(CANARY_MODULE_TITLE).click();
    await page.getByRole('link', { name: /submissions|view submissions/i }).click();
    await page.getByText(/student@gmail.com|student/i).click();
    
    // Click Finalize Grades button
    await page.getByRole('button', { name: /finalize grades/i }).click();
    
    // Confirm in dialog
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/finalize grades/i)).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: /finalize/i }).click();
    
    // Verify success toast
    await expect(page.getByText(/grades finalised/i)).toBeVisible();
    
    // Verify status changed to "Finalised"
    await expect(page.getByText(/finalised/i)).toBeVisible();
    
    // Verify inputs are now disabled
    const scoreInputs = page.getByLabel(/score|marks/i);
    if (await scoreInputs.count() > 0) {
      await expect(scoreInputs.first()).toBeDisabled();
    }
  });
});

test.describe('Student views final grades', () => {
  test.use({ storageState: 'tests/e2e/.auth/student.json' });

  test('Step 13: Student sees finalised grades (read-only)', async ({ page }) => {
    await page.goto('/student/modules');
    await page.getByText(CANARY_MODULE_TITLE).click();
    
    // Click on question to view grades
    await page.getByText(CANARY_QUESTION_TITLE).click();
    
    // Verify finalised state indicators:
    // 1. Green checkmark + "Submitted" text
    await expect(page.locator('svg').filter({ has: page.locator('path') })).toBeVisible();
    await expect(page.getByText(/submitted/i)).toBeVisible();
    
    // 2. Grades and feedback are visible
    await expect(page.getByText(/marks awarded|score/i)).toBeVisible();
    await expect(page.getByText(/8|9/i)).toBeVisible(); // The scores we gave
    
    // 3. Answer fields are disabled/read-only
    const textareas = page.getByRole('textbox');
    const textareaCount = await textareas.count();
    for (let i = 0; i < textareaCount; i++) {
      await expect(textareas.nth(i)).toBeDisabled();
    }
    
    // 4. No save buttons or auto-save indicators for editing
    await expect(page.getByRole('button', { name: /save/i })).not.toBeVisible();
    
    // 5. Verify module shows "Completed" status
    await page.getByRole('link', { name: /back to module/i }).click();
    await expect(page.getByRole('button', { name: /completed/i })).toBeDisabled();
  });
});
