import { expect, type ElectronApplication, type Page } from '@playwright/test'

/**
 * 原生目录选择框直接返回给定目录，并触发「文件 → 打开文件夹」。
 * 文件树的端到端用例都从这一步开始。
 */
export async function openFolder(
  electronApp: ElectronApplication,
  window: Page,
  folder: string
): Promise<void> {
  await electronApp.evaluate(({ dialog }, target) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [target] })
  }, folder)
  await electronApp.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].webContents.send('menu:open-folder')
  })
  await expect(window.getByRole('tree')).toBeVisible()
}
