import path from 'node:path'
import { createServer, type Server } from 'node:http'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { expect, test } from './electron'
import { openFolder } from './open-folder'

/** v1.1 之后补的三项可视化/记录功能：内联表格、图片历史、链接预览与锚点跳转 */

async function resetToWelcome(window: import('@playwright/test').Page): Promise<void> {
  await window.reload()
  await window.getByRole('button', { name: 'Export HTML' }).first().waitFor()
}

async function writeDocument(dir: string, name: string, content: string): Promise<string> {
  const file = path.join(dir, name)
  await writeFile(file, content, 'utf-8')
  return file
}

test('inline table: renders as a translucent table and returns to source on click', async ({
  electronApp,
  window
}) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'biu-table-e2e-'))
  await writeDocument(
    dir,
    'table.md',
    ['# Table', '', '| Name | Value |', '| --- | ---: |', '| Alpha | 1 |', '| Beta | 2 |', ''].join(
      '\n'
    )
  )

  try {
    await resetToWelcome(window)
    await openFolder(electronApp, window, dir)
    await window.getByRole('tree').getByText('table.md').click()

    const table = window.locator('.cm-content:visible .cm-inline-table')
    await expect(table).toBeVisible()
    await expect(table.locator('th', { hasText: 'Name' })).toBeVisible()
    const opacity = await table.evaluate((node) => getComputedStyle(node).opacity)
    expect(Number(opacity)).toBeLessThan(1)

    await table.locator('td', { hasText: 'Alpha' }).click()
    await expect(window.locator('.cm-content:visible .cm-inline-table')).toHaveCount(0)
    await expect(window.locator('.cm-content:visible')).toContainText('| Name | Value |')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('image history: lists recent uploads from disk and copies a URL', async ({ electronApp, window }) => {
  await resetToWelcome(window)

  const userData = await electronApp.evaluate(({ app }) => app.getPath('userData'))
  await writeFile(
    path.join(userData, 'image-history.json'),
    JSON.stringify({
      version: 1,
      entries: [
        {
          id: 'e2e-upload-1',
          url: 'https://img.example.com/shot.png',
          fileName: 'shot.png',
          uploadedAt: Date.now(),
          provider: 'github'
        }
      ]
    }),
    'utf-8'
  )

  await electronApp.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].webContents.send('menu:image-history')
  })

  const row = window.getByTestId('image-history-e2e-upload-1')
  await expect(row).toBeVisible()
  await expect(row.getByText('shot.png', { exact: true })).toBeVisible()
  await expect(row.getByText('https://img.example.com/shot.png')).toBeVisible()

  // 右键菜单由主进程弹出，e2e 里替换成直接返回「复制 URL」
  await electronApp.evaluate(({ Menu }) => {
    type MenuLike = { items: Array<{ label: string; click: () => void }> }
    Menu.prototype.popup = function popup(
      this: MenuLike,
      options?: { callback?: () => void }
    ): void {
      const item = this.items.find((entry) => entry.label.includes('URL'))
      item?.click()
      options?.callback?.()
    } as never
  })
  await row.click({ button: 'right' })
  await expect
    .poll(() => electronApp.evaluate(({ clipboard }) => clipboard.readText()))
    .toBe('https://img.example.com/shot.png')
})

test('link preview and internal anchors in the preview pane', async ({ electronApp, window }) => {
  const server: Server = createServer((request, response) => {
    if (request.url === '/og') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      response.end(`<!doctype html><html><head>
        <meta property="og:title" content="BiuText Preview" />
        <meta property="og:description" content="Fetched by the main process" />
        <meta property="og:site_name" content="BiuText" />
      </head><body>ok</body></html>`)
      return
    }
    response.writeHead(404)
    response.end()
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0

  const paragraphs = Array.from({ length: 120 }, (_, index) => `段落 ${index}`).join('\n\n')
  const dir = await mkdtemp(path.join(tmpdir(), 'biu-link-e2e-'))
  await writeDocument(
    dir,
    'links.md',
    [
      '# Links',
      '',
      `[Example](http://127.0.0.1:${port}/og)`,
      '',
      '[Jump to target](#target)',
      '',
      paragraphs,
      '',
      '## Target',
      '',
      'You made it.'
    ].join('\n')
  )

  try {
    await resetToWelcome(window)
    await openFolder(electronApp, window, dir)
    await window.getByRole('tree').getByText('links.md').click()

    const article = window.locator('article.markdown-body')
    await expect(article.getByRole('heading', { name: 'Target' })).toHaveAttribute('id', 'target')

    await article.getByRole('link', { name: 'Example' }).hover()
    const card = window.getByTestId('link-preview-card')
    await expect(card).toBeVisible()
    await expect(card.getByText('BiuText Preview')).toBeVisible()
    await expect(card.getByText('Fetched by the main process')).toBeVisible()

    await article.getByRole('link', { name: 'Jump to target' }).click()
    await expect
      .poll(() => window.getByTestId('preview-scroll').evaluate((node) => node.scrollTop))
      .toBeGreaterThan(0)
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await rm(dir, { recursive: true, force: true })
  }
})
