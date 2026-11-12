export const WAIT_FOR_DOCUMENT_IMAGES = `Promise.all([...document.images].filter((img) => !img.complete).map((img) => new Promise((resolve) => {
  img.addEventListener('load', () => resolve(undefined), { once: true })
  img.addEventListener('error', () => resolve(undefined), { once: true })
})))`

export interface PdfPage {
  executeJavaScript(script: string): Promise<unknown>
  printToPDF(options: { printBackground: boolean; preferCSSPageSize: boolean; scale: number }): Promise<Uint8Array>
  destroy(): void
}

export interface PdfPrinter {
  writeFile(path: string, data: string | Uint8Array): Promise<void>
  open(path: string): Promise<PdfPage>
  remove(path: string): Promise<void>
}

/** 大段 HTML 不走 data URL。先落临时文件，等图片解码完再打印，失败也删掉临时文件。 */
export async function writePdfDocument(
  html: string,
  destination: string,
  tempPath: string,
  printer: PdfPrinter
): Promise<void> {
  let page: PdfPage | null = null
  try {
    await printer.writeFile(tempPath, html)
    page = await printer.open(tempPath)
    await page.executeJavaScript(WAIT_FOR_DOCUMENT_IMAGES)
    const pdf = await page.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      scale: 1
    })
    await printer.writeFile(destination, pdf)
  } finally {
    page?.destroy()
    await printer.remove(tempPath).catch(() => undefined)
  }
}
