/** 渲染进程 → 主进程传递的图片载荷；主进程只按 MIME/扩展名白名单落盘 */
export interface ImageFileInput {
  bytes: ArrayBuffer
  name: string
  mime: string
}
