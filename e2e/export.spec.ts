import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { ElectronApplication } from '@playwright/test'
import { expect, test } from './electron'

const DIAGRAMS = [
  '# Diagrams',
  '',
  '```chartjs',
  '{"type":"bar","data":{"labels":["Jan"],"datasets":[{"label":"Sales","data":[12]}]}}',
  '```',
  '',
  '```dot',
  'digraph { A -> B }',
  '```',
  ''
].join('\n')

test.describe.configure({ mode: 'serial' })

test('shows the welcome document in the preview', async ({ window }) => {
  await expect(window.locator('article.markdown-body').getByRole('heading', { name: 'Welcome to BiuText' })).toBeVisible()
})

test('renders a chart and a graph in the preview', async ({ window }) => {
  const editor = window.locator('.cm-content')
  await editor.click()
  await window.keyboard.press('ControlOrMeta+a')
  await window.keyboard.insertText(DIAGRAMS)

  const preview = window.locator('article.markdown-body')
  await expect(preview.getByRole('heading', { name: 'Diagrams' })).toBeVisible()
  await expect(preview.locator('.biu-diagram canvas')).toBeVisible()
  await expect(preview.locator('.biu-diagram svg')).toBeVisible()
})

test('exports the preview to HTML and PDF', async ({ electronApp, window }) => {
  const outputDir = await mkdtemp(path.join(tmpdir(), 'biu-text-export-'))
  const htmlPath = path.join(outputDir, 'note.html')
  const pdfPath = path.join(outputDir, 'note.pdf')
  try {
    await window.getByRole('button', { name: 'Export HTML' }).first().click()
    const dialog = window.getByRole('dialog', { name: 'Export preview' })
    const frame = dialog.getByTitle('Export preview')
    await expect(frame).toBeVisible()
    await expect.poll(async () => frame.getAttribute('srcdoc')).toContain('<svg')
    const srcdoc = await frame.getAttribute('srcdoc')
    expect(srcdoc).toContain('data:image/png')

    await mockSaveDialog(electronApp, null)
    await dialog.getByRole('button', { name: 'Export HTML' }).click()
    await expect(dialog).toBeVisible()

    await mockSaveDialog(electronApp, htmlPath)
    await dialog.getByRole('button', { name: 'Export HTML' }).click()
    await expect(dialog).toBeHidden()
    const html = await readFile(htmlPath, 'utf-8')
    expect(html).toContain('<svg')
    expect(html).toContain('data:image/png')
    expect(html).toContain('print-color-adjust: exact')
    expect(html).not.toContain('biu-image://')

    await window.getByRole('button', { name: 'Export PDF' }).first().click()
    const pdfDialog = window.getByRole('dialog', { name: 'Export preview' })
    await expect(pdfDialog.getByRole('button', { name: 'Export PDF' })).toBeEnabled()
    await mockSaveDialog(electronApp, pdfPath)
    await pdfDialog.getByRole('button', { name: 'Export PDF' }).click()
    await expect(pdfDialog).toBeHidden()
    const pdf = await readFile(pdfPath)
    expect(pdf.subarray(0, 5).toString('utf-8')).toBe('%PDF-')
  } finally {
    await rm(outputDir, { recursive: true, force: true })
  }
})

async function mockSaveDialog(app: ElectronApplication, filePath: string | null): Promise<void> {
  await app.evaluate(({ dialog }, result) => {
    dialog.showSaveDialog = async () => result
  }, filePath ? { canceled: false as const, filePath } : { canceled: true as const, filePath: '' })
}
