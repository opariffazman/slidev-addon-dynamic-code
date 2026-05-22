import { expect, test } from '@playwright/test'

test('presenter edit propagates to audience', async ({ browser }) => {
  const presenter = await browser.newContext()
  const audience = await browser.newContext()

  const presenterPage = await presenter.newPage()
  const audiencePage = await audience.newPage()

  await presenterPage.goto('/?presenter=test-secret')
  await audiencePage.goto('/')

  // Wait for both pages to be on slide 1 with the install block visible.
  await presenterPage.locator('.dynamic-code-wrapper').first().waitFor()
  await audiencePage.locator('.dynamic-code-wrapper').first().waitFor()

  // Focus the textarea on presenter and type a new command.
  const textarea = presenterPage.locator('.dynamic-code-wrapper textarea').first()
  await textarea.click()
  await textarea.fill('pnpm install some-package')

  // Audience reflects the edit within 1 second (debounce + WS round-trip).
  await expect(audiencePage.locator('.dynamic-code-pre').first()).toContainText('pnpm install some-package', { timeout: 5000 })
})

test('hash mismatch makes audience ignore stale DO content', async ({ browser: _browser }) => {
  // This test relies on a deck whose origin hash differs from any persisted content.
  // We simulate by submitting an edit with a known good hash, then loading audience with a hash mismatch via query param hack — skipped here.
  test.skip(true, 'covered by unit tests; e2e variant requires deck rebuild between runs')
})
