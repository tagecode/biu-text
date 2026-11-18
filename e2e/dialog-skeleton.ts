import { expect, type Locator } from '@playwright/test'

/**
 * 弹窗"骨架"校验。
 *
 * 起因：重命名弹窗曾把 `DialogContent` 当成自带内边距的容器用，结果标题、输入框、
 * 按钮全部贴着边框——功能能跑，样式完全是坏的，而单元测试和功能断言都发现不了。
 * 这里把"看起来是个正常弹窗"变成可断言的几条硬指标：
 *
 * 1. 可见、在视口内、有可访问标题与关闭入口；
 * 2. 标题离左/上边缘至少 8px（贴边 bug 的直接形态）；
 * 3. 最后一个操作按钮离右/下边缘至少 8px；
 * 4. 不横向溢出、直接子元素不越出对话框边界。
 *
 * 必须在真实 Electron 里跑：jsdom 不做布局，Tailwind 的间距也拿不到计算值。
 */

const MIN_INSET = 8
const TOLERANCE = 1

export interface DialogSkeletonOptions {
  /** 期望标题文案 */
  title?: RegExp | string
  /** 必须存在的操作按钮（正则匹配按钮名） */
  action?: RegExp | string
}

export async function expectDialogSkeleton(
  dialog: Locator,
  options: DialogSkeletonOptions = {}
): Promise<void> {
  await expect(dialog).toBeVisible()

  const heading = dialog.locator('[data-slot="dialog-title"]').first()
  await expect(heading).toBeVisible()
  if (options.title) await expect(heading).toHaveText(options.title)

  // 关闭入口：X 按钮或「取消」
  await expect(
    dialog.getByRole('button', { name: /close|cancel|关闭|取消/i }).first()
  ).toBeVisible()

  if (options.action) {
    await expect(dialog.getByRole('button', { name: options.action }).first()).toBeVisible()
  }

  const metrics = await dialog.evaluate((element, tolerance) => {
    const box = element.getBoundingClientRect()
    const title = element.querySelector('[data-slot="dialog-title"]')
    const titleBox = title?.getBoundingClientRect()
    const buttons = Array.from(element.querySelectorAll('button'))
    const lastButtonBox = buttons.at(-1)?.getBoundingClientRect()

    return {
      left: box.left,
      top: box.top,
      right: box.right,
      bottom: box.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      titleInsetLeft: titleBox ? titleBox.left - box.left : -1,
      titleInsetTop: titleBox ? titleBox.top - box.top : -1,
      actionInsetRight: lastButtonBox ? box.right - lastButtonBox.right : -1,
      actionInsetBottom: lastButtonBox ? box.bottom - lastButtonBox.bottom : -1,
      overflowX: element.scrollWidth - element.clientWidth,
      childOverflow: Array.from(element.children).some((child) => {
        const childBox = child.getBoundingClientRect()
        return childBox.right > box.right + tolerance || childBox.left < box.left - tolerance
      })
    }
  }, TOLERANCE)

  // 在视口内
  expect(metrics.left, '对话框左边界').toBeGreaterThanOrEqual(0)
  expect(metrics.top, '对话框上边界').toBeGreaterThanOrEqual(0)
  expect(metrics.right, '对话框右边界').toBeLessThanOrEqual(metrics.viewportWidth + TOLERANCE)
  expect(metrics.bottom, '对话框下边界').toBeLessThanOrEqual(metrics.viewportHeight + TOLERANCE)

  // 内容不能贴边
  expect(metrics.titleInsetLeft, '标题左侧内边距').toBeGreaterThanOrEqual(MIN_INSET)
  expect(metrics.titleInsetTop, '标题上方内边距').toBeGreaterThanOrEqual(MIN_INSET)
  expect(metrics.actionInsetRight, '操作按钮右侧内边距').toBeGreaterThanOrEqual(MIN_INSET)
  expect(metrics.actionInsetBottom, '操作按钮下方内边距').toBeGreaterThanOrEqual(MIN_INSET)

  // 不出界、不横向滚动
  expect(metrics.overflowX, '对话框横向溢出').toBeLessThanOrEqual(TOLERANCE)
  expect(metrics.childOverflow, '子元素越出对话框').toBe(false)
}
