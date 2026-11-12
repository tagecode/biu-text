import { test as base, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

type WorkerFixtures = {
  electronApp: ElectronApplication
  window: Page
}

export const test = base.extend<Record<string, never>, WorkerFixtures>({
  electronApp: [
    // 这个 fixture 不依赖别的 fixture，但 Playwright 仍要求带上参数位。
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const userData = await mkdtemp(path.join(tmpdir(), 'biu-text-e2e-'))
      await writeFile(path.join(userData, 'language.json'), JSON.stringify({ language: 'en-US' }), 'utf-8')
      const app = await electron.launch({
        args: [path.join(process.cwd(), 'out', 'main', 'index.js')],
        env: {
          ...process.env,
          BIU_TEXT_E2E: '1',
          BIU_TEXT_USER_DATA: userData
        }
      })
      await use(app)
      await app.evaluate(({ app: electronApp }) => {
        electronApp.exit(0)
      }).catch(() => undefined)
      await app.close().catch(() => undefined)
      await rm(userData, { recursive: true, force: true })
    },
    { scope: 'worker' }
  ],
  window: [
    async ({ electronApp }, use) => {
      const window = await electronApp.firstWindow()
      await window.getByRole('button', { name: 'Export HTML' }).waitFor()
      await use(window)
    },
    { scope: 'worker' }
  ]
})

export { expect } from '@playwright/test'
