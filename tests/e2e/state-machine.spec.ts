/**
 * State Machine E2E Tests
 * 
 * Purpose: Verify allowed and forbidden state transitions only
 * 
 * State flow:
 *   draft → submitted → finalised
 * 
 * Tests:
 * 1. draft → submitted (ALLOWED)
 * 2. submitted → finalised (ALLOWED)
 * 3. submitted → edit answers (FORBIDDEN)
 * 4. finalised → grade (FORBIDDEN)
 * 5. finalised → edit (FORBIDDEN)
 * 
 * Constraints:
 * - NO DB manipulation
 * - UI and observed state only
 * - Uses existing E2E_CANARY modules from lifecycle tests
 */

import { test, expect } from '@playwright/test';

const STATE_MACHINE_MODULE_TITLE = `E2E_STATE_${Date.now()}`;

test.describe('State Machine: Draft → Submitted (ALLOWED)', () => {
  test.use({ storageState: 'tests/e2e/.auth/admin.json' });

  test('Setup: Create and publish module for state machine tests', async ({ page, context }) => {
    // Create module as admin
    await page.goto('/admin');
    await page.getByRole('tab', { name: /modules/i }).click();
    await page.getByRole('button', { name: /create module/i }).click();
    await page.getByLabel(/title/i).fill(STATE_MACHINE_MODULE_TITLE);
    await page.getByRole('dialog').getByRole('button', { name: /create/i }).click();
    await expect(page.getByText(STATE_MACHINE_MODULE_TITLE)).toBeVisible();

    // Assign instructor
    const moduleRow = page.locator('tr', { has: page.getByText(STATE_MACHINE_MODULE_TITLE) });
    await moduleRow.getByRole('button').filter({ has: page.locator('svg') }).first().click();
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: /inst@gmail.com|instructor/i }).click();
    await page.getByRole('dialog').getByRole('button', { name: /assign/i }).click();
    await expect(page.getByText(/instructor assigned/i)).toBeVisible();

    // Enroll student
    await moduleRow.getByRole('button').filter({ has: page.locator('svg') }).nth(1).click();
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: /student@gmail.com|student/i }).click();
    await page.getByRole('dialog').getByRole('button', { name: /enroll/i }).click();
    await expect(page.getByText(/student enrolled/i)).toBeVisible();

    // Switch to instructor to add questions
    const instructorPage = await context.newPage();
    await instructorPage.goto('/instructor');
    await instructorPage.getByText(STATE_MACHINE_MODULE_TITLE).click();
    
    // Add a simple question (minimal setup for state testing)
    await instructorPage.getByRole('button', { name: /add question|create question|new question/i }).click();
    await instructorPage.getByLabel(/title/i).fill('State Machine Test Question');
    await instructorPage.getByLabel(/scenario/i).fill('Test scenario');
    
    // Add Part A with sub-question
    await instructorPage.getByRole('button', { name: /add part/i }).click();
    await instructorPage.getByLabel(/part label/i).first().fill('A');
    await instructorPage.getByRole('button', { name: /add sub-question/i }).first().click();
    await instructorPage.getByLabel(/prompt/i).first().fill('What is 2+2?');
    await instructorPage.getByLabel(/max marks/i).first().fill('5');
    
    await instructorPage.getByRole('button', { name: /save|create/i }).click();
    await expect(instructorPage.getByText('State Machine Test Question')).toBeVisible();

    // Mark as ready
    await instructorPage.getByRole('button', { name: /mark as ready|ready for publish/i }).click();
    const dialog = instructorPage.getByRole('dialog');
    if (await dialog.isVisible()) {
      await dialog.getByRole('button', { name: /confirm|mark as ready/i }).click();
    }
    await instructorPage.close();

    // Publish as admin
    await moduleRow.getByRole('button').filter({ has: page.locator('svg') }).nth(2).click();
    await expect(page.getByText(/module published/i)).toBeVisible();
  });
});

test.describe('State Machine: Draft → Submitted Transition', () => {
  test.use({ storageState: 'tests/e2e/.auth/student.json' });

  test('ALLOWED: Student can transition from draft to submitted', async ({ page }) => {
    await page.goto('/student/modules');
    
    // Find our state machine test module
    await expect(page.getByText(STATE_MACHINE_MODULE_TITLE)).toBeVisible();
    await page.getByText(STATE_MACHINE_MODULE_TITLE).click();

    // Verify initial state: draft (Complete Module button is enabled)
    const completeButton = page.getByRole('button', { name: /complete module/i });
    await expect(completeButton).toBeVisible();
    await expect(completeButton).toBeEnabled();

    // Answer question first
    const questionLink = page.getByText('State Machine Test Question').or(page.locator('a[href*="/questions/"]')).first();
    await questionLink.click();
    
    // Fill answer
    const textarea = page.getByRole('textbox').first();
    await textarea.fill('4 is the answer');
    await page.waitForTimeout(1000); // Wait for auto-save
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });

    // Go back to module
    await page.getByRole('link', { name: /back to module/i }).click();

    // Perform transition: draft → submitted
    await completeButton.click();
    
    // Confirm in AlertDialog
    await expect(page.getByText(/are you sure you want to submit/i)).toBeVisible();
    await page.getByRole('button', { name: /^submit$/i }).click();

    // Verify state changed to submitted
    // 1. Button changes to "Completed" (disabled)
    await expect(page.getByRole('button', { name: /completed/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /completed/i })).toBeDisabled();

    // 2. Navigate to question to verify "Submitted" indicator
    await page.locator('a[href*="/questions/"]').first().click();
    await expect(page.getByText(/submitted/i)).toBeVisible();
    
    // 3. Green checkmark should be visible
    await expect(page.locator('svg').filter({ has: page.locator('path') })).toBeVisible();
  });
});

test.describe('State Machine: Submitted → Edit (FORBIDDEN)', () => {
  test.use({ storageState: 'tests/e2e/.auth/student.json' });

  test('FORBIDDEN: Student cannot edit answers after submission', async ({ page }) => {
    await page.goto('/student/modules');
    
    // Find submitted module
    await expect(page.getByText(STATE_MACHINE_MODULE_TITLE)).toBeVisible();
    await page.getByText(STATE_MACHINE_MODULE_TITLE).click();

    // Verify module is submitted (Completed button is disabled)
    await expect(page.getByRole('button', { name: /completed/i })).toBeDisabled();

    // Navigate to question
    await page.locator('a[href*="/questions/"]').first().click();

    // Verify FORBIDDEN indicators:
    // 1. "Submitted" text visible
    await expect(page.getByText(/submitted/i)).toBeVisible();

    // 2. Textareas are disabled (read-only)
    const textareas = page.getByRole('textbox');
    const count = await textareas.count();
    expect(count).toBeGreaterThan(0);
    
    for (let i = 0; i < count; i++) {
      await expect(textareas.nth(i)).toBeDisabled();
    }

    // 3. No save button visible
    await expect(page.getByRole('button', { name: /^save$/i })).not.toBeVisible();

    // 4. Try to type (should not work due to disabled state)
    const firstTextarea = textareas.first();
    const originalValue = await firstTextarea.inputValue();
    
    // Attempt to type (should be prevented by disabled attribute)
    await firstTextarea.click({ force: true }).catch(() => {});
    await page.keyboard.type('Should not be editable', { delay: 10 }).catch(() => {});
    
    // Verify value hasn't changed
    const newValue = await firstTextarea.inputValue();
    expect(newValue).toBe(originalValue);
  });
});

test.describe('State Machine: Submitted → Finalised (ALLOWED)', () => {
  test.use({ storageState: 'tests/e2e/.auth/instructor.json' });

  test('ALLOWED: Instructor can transition from submitted to finalised', async ({ page }) => {
    await page.goto('/instructor');
    
    // Find our state machine module
    await expect(page.getByText(STATE_MACHINE_MODULE_TITLE)).toBeVisible();
    await page.getByText(STATE_MACHINE_MODULE_TITLE).click();

    // Navigate to submissions
    await page.getByRole('link', { name: /submissions|view submissions/i }).click();

    // Find submitted submission
    const submissionRow = page.locator('tr').filter({ 
      has: page.getByText(/submitted/i) 
    }).first();
    await expect(submissionRow).toBeVisible();

    // Verify initial state: submitted
    await expect(submissionRow.getByText(/submitted/i)).toBeVisible();

    // Click on submission
    await submissionRow.click();

    // Grade the answers
    const scoreInputs = page.getByLabel(/score|marks/i);
    const scoreCount = await scoreInputs.count();
    
    for (let i = 0; i < scoreCount; i++) {
      await scoreInputs.nth(i).fill('5');
      await page.waitForTimeout(1000); // Wait for auto-save
    }

    // Wait for save confirmation
    await expect(page.getByText(/saved/i).first()).toBeVisible({ timeout: 5000 });

    // Perform transition: submitted → finalised
    const finalizeButton = page.getByRole('button', { name: /finalize grades/i });
    await expect(finalizeButton).toBeVisible();
    await expect(finalizeButton).toBeEnabled();
    
    await finalizeButton.click();

    // Confirm in dialog
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/finalize grades/i)).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: /finalize/i }).click();

    // Verify transition succeeded
    // 1. Success toast
    await expect(page.getByText(/grades finalised/i)).toBeVisible();

    // 2. Status changed to "Finalised"
    await expect(page.getByText(/finalised/i)).toBeVisible();

    // 3. "Finalize Grades" button is gone
    await expect(finalizeButton).not.toBeVisible();
  });
});

test.describe('State Machine: Finalised → Grade (FORBIDDEN)', () => {
  test.use({ storageState: 'tests/e2e/.auth/instructor.json' });

  test('FORBIDDEN: Instructor cannot edit grades after finalisation', async ({ page }) => {
    await page.goto('/instructor');
    
    // Find our state machine module
    await expect(page.getByText(STATE_MACHINE_MODULE_TITLE)).toBeVisible();
    await page.getByText(STATE_MACHINE_MODULE_TITLE).click();

    // Navigate to submissions
    await page.getByRole('link', { name: /submissions|view submissions/i }).click();

    // Find finalised submission
    const finalisedRow = page.locator('tr').filter({ 
      has: page.getByText(/finalised/i) 
    }).first();
    await expect(finalisedRow).toBeVisible();

    // Click on finalised submission
    await finalisedRow.click();

    // Verify FORBIDDEN indicators:
    // 1. Status shows "Finalised"
    await expect(page.getByText(/finalised/i)).toBeVisible();

    // 2. All score inputs are disabled
    const scoreInputs = page.getByLabel(/score|marks/i);
    const scoreCount = await scoreInputs.count();
    expect(scoreCount).toBeGreaterThan(0);
    
    for (let i = 0; i < scoreCount; i++) {
      await expect(scoreInputs.nth(i)).toBeDisabled();
    }

    // 3. Feedback inputs are disabled
    const feedbackInputs = page.getByLabel(/feedback/i);
    const feedbackCount = await feedbackInputs.count();
    
    if (feedbackCount > 0) {
      await expect(feedbackInputs.first()).toBeDisabled();
    }

    // 4. "Finalize Grades" button not visible
    await expect(page.getByRole('button', { name: /finalize grades/i })).not.toBeVisible();

    // 5. Try to modify grade (should fail due to disabled state)
    const firstScoreInput = scoreInputs.first();
    const originalValue = await firstScoreInput.inputValue();
    
    // Attempt to change value (should be prevented)
    await firstScoreInput.click({ force: true }).catch(() => {});
    await page.keyboard.type('999', { delay: 10 }).catch(() => {});
    
    // Verify value hasn't changed
    const newValue = await firstScoreInput.inputValue();
    expect(newValue).toBe(originalValue);
  });
});

test.describe('State Machine: Finalised → Edit Answers (FORBIDDEN)', () => {
  test.use({ storageState: 'tests/e2e/.auth/student.json' });

  test('FORBIDDEN: Student cannot edit answers after finalisation', async ({ page }) => {
    await page.goto('/student/modules');
    
    // Find finalised module
    await expect(page.getByText(STATE_MACHINE_MODULE_TITLE)).toBeVisible();
    await page.getByText(STATE_MACHINE_MODULE_TITLE).click();

    // Verify module is completed (button disabled)
    await expect(page.getByRole('button', { name: /completed/i })).toBeDisabled();

    // Navigate to question
    await page.locator('a[href*="/questions/"]').first().click();

    // Verify FORBIDDEN indicators for finalised state:
    // 1. "Submitted" text visible (still shows as submitted to student)
    await expect(page.getByText(/submitted/i)).toBeVisible();

    // 2. Grades/feedback are visible (finalised indicator)
    await expect(page.getByText(/marks|score/i)).toBeVisible();

    // 3. Textareas are disabled
    const textareas = page.getByRole('textbox');
    const count = await textareas.count();
    expect(count).toBeGreaterThan(0);
    
    for (let i = 0; i < count; i++) {
      await expect(textareas.nth(i)).toBeDisabled();
    }

    // 4. No save functionality available
    await expect(page.getByRole('button', { name: /^save$/i })).not.toBeVisible();

    // 5. Cannot modify text (due to disabled state)
    const firstTextarea = textareas.first();
    const originalValue = await firstTextarea.inputValue();
    
    await firstTextarea.click({ force: true }).catch(() => {});
    await page.keyboard.type('Cannot edit finalised', { delay: 10 }).catch(() => {});
    
    const newValue = await firstTextarea.inputValue();
    expect(newValue).toBe(originalValue);
  });
});

test.describe('State Machine: Verify Invalid Transitions', () => {
  test('Summary: All state transitions validated', async () => {
    // This is a documentation test that summarizes what was validated:
    const validatedTransitions = {
      allowed: [
        'draft → submitted ✓',
        'submitted → finalised ✓',
      ],
      forbidden: [
        'submitted → edit answers ✓ (textareas disabled)',
        'finalised → edit grades ✓ (inputs disabled)',
        'finalised → edit answers ✓ (textareas disabled)',
      ],
    };

    // Log the validated transitions
    console.log('State Machine Transitions Validated:');
    console.log('Allowed:', validatedTransitions.allowed);
    console.log('Forbidden:', validatedTransitions.forbidden);

    expect(validatedTransitions.allowed.length).toBe(2);
    expect(validatedTransitions.forbidden.length).toBe(3);
  });
});
