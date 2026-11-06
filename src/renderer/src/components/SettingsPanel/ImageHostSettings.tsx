import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/lib/toast-store'
import {
  formatHeaderLines,
  isSecureEndpoint,
  parseHeaderLines,
  type ImageHostConfigView,
  type ImageHostType
} from '@shared/image-host'

interface ImageHostSettingsProps {
  config: ImageHostConfigView | null
  onSave: (view: ImageHostConfigView) => Promise<void>
}

function Field({ id, label, className, children }: { id: string; label: string; className?: string; children: ReactNode }) {
  return (
    <div className={`grid gap-1.5 ${className ?? ''}`}>
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}

/** 图床配置：本地不需要参数，GitHub / 自定义接口各自一组字段 */
export function ImageHostSettings({ config, onSave }: ImageHostSettingsProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<ImageHostConfigView | null>(config)
  const [headersText, setHeadersText] = useState('')
  const [busy, setBusy] = useState<'save' | 'test' | null>(null)
  // 用户动过令牌框后，以框里的内容为准：清空即视为没有令牌，不再沿用已保存的那个
  const [tokenEdited, setTokenEdited] = useState(false)

  useEffect(() => {
    if (!config) return
    setDraft(config)
    setHeadersText(formatHeaderLines(config.custom.headers))
    setTokenEdited(false)
  }, [config])

  if (!draft) return null

  const github = draft.github
  const custom = draft.custom

  const withDraft = (next: Partial<ImageHostConfigView>) => setDraft({ ...draft, ...next })

  // 没有可撤销的改动时「取消」置灰，避免点了没反应
  const savedHeadersText = formatHeaderLines(config?.custom.headers ?? {})
  const dirty =
    !!config &&
    (draft.type !== config.type ||
      github.repo !== config.github.repo ||
      github.branch !== config.github.branch ||
      github.dir !== config.github.dir ||
      github.tokenMasked !== config.github.tokenMasked ||
      custom.url !== config.custom.url ||
      custom.field !== config.custom.field ||
      custom.responsePath !== config.custom.responsePath ||
      headersText !== savedHeadersText)

  // 没动过令牌框时沿用已保存的；动过就以框里的内容为准（清空 = 没有令牌）
  const hasToken = tokenEdited ? github.tokenMasked.trim() !== '' : github.tokenSaved

  // 配置还填不全时「测试连接」置灰，省得点了只换来一句报错
  const canTest =
    draft.type === 'github'
      ? github.repo.includes('/') && hasToken
      : isSecureEndpoint(custom.url)

  const validate = (): string | null => {
    if (draft.type === 'github') {
      if (!github.repo.includes('/')) return t('image.invalidRepo')
      if (!hasToken) return t('image.invalidToken')
    }
    if (draft.type === 'custom' && !isSecureEndpoint(custom.url)) return t('image.invalidUrl')
    return null
  }

  const draftView = (): ImageHostConfigView => ({
    ...draft,
    custom: { ...custom, headers: parseHeaderLines(headersText) }
  })

  const reportInvalid = (): boolean => {
    const error = validate()
    if (!error) return false
    toast({ level: 'error', title: t('image.invalidConfig'), description: error })
    return true
  }

  const handleSave = async () => {
    if (reportInvalid()) return
    setBusy('save')
    try {
      await onSave(draftView())
      toast({ level: 'success', title: t('image.saved') })
    } catch {
      // 主进程已弹「保存失败」通知；草稿原样保留，方便直接重试
    } finally {
      setBusy(null)
    }
  }

  const handleCancel = () => {
    if (!config) return
    setDraft(config)
    setHeadersText(formatHeaderLines(config.custom.headers))
    toast({ level: 'info', title: t('image.cancelDone') })
  }

  const handleTest = async () => {
    if (reportInvalid()) return
    setBusy('test')
    try {
      // 只把草稿拿去测，不落盘：否则主进程回传的脱敏值会把输入框里的令牌换掉
      const res = await window.imageAPI.testHost(draftView())
      if (res.ok) {
        toast({ level: 'success', title: t('image.testOk', { url: res.url }) })
      } else {
        toast({ level: 'error', title: t('image.testFailed'), description: res.error })
      }
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <Field id="setting-image-storage" label={t('image.storage')} className="sm:col-span-2">
        <Select value={draft.type} onValueChange={(value) => withDraft({ type: value as ImageHostType })}>
          <SelectTrigger id="setting-image-storage" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="local">{t('image.storageLocal')}</SelectItem>
            <SelectItem value="github">{t('image.storageGithub')}</SelectItem>
            <SelectItem value="custom">{t('image.storageCustom')}</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {draft.type === 'github' && (
        <>
          <Field id="setting-github-repo" label={t('image.githubRepo')}>
            <Input
              id="setting-github-repo"
              className="h-8 text-xs"
              placeholder="owner/repo"
              value={github.repo}
              onChange={(e) => withDraft({ github: { ...github, repo: e.target.value } })}
            />
          </Field>
          <Field id="setting-github-branch" label={t('image.githubBranch')}>
            <Input
              id="setting-github-branch"
              className="h-8 text-xs"
              placeholder="main"
              value={github.branch}
              onChange={(e) => withDraft({ github: { ...github, branch: e.target.value } })}
            />
          </Field>
          <Field id="setting-github-dir" label={t('image.githubDir')}>
            <Input
              id="setting-github-dir"
              className="h-8 text-xs"
              placeholder="images"
              value={github.dir}
              onChange={(e) => withDraft({ github: { ...github, dir: e.target.value } })}
            />
          </Field>
          <Field id="setting-github-token" label={t('image.githubToken')}>
            <Input
              id="setting-github-token"
              className="h-8 text-xs"
              placeholder={t('image.tokenPlaceholder')}
              value={github.tokenMasked}
              // 脱敏值只是"已保存"的提示，聚焦时全选，免得新令牌接在掩码后面
              onFocus={(e) => {
                if (!tokenEdited && github.tokenSaved) e.target.select()
              }}
              onChange={(e) => {
                setTokenEdited(true)
                withDraft({ github: { ...github, tokenMasked: e.target.value } })
              }}
            />
          </Field>
          <p className="text-[11px] text-muted-foreground sm:col-span-2">{t('image.tokenHint')}</p>
        </>
      )}

      {draft.type === 'custom' && (
        <>
          <Field id="setting-custom-url" label={t('image.customUrl')} className="sm:col-span-2">
            <Input
              id="setting-custom-url"
              className="h-8 text-xs"
              placeholder="https://example.com/upload"
              value={custom.url}
              onChange={(e) => withDraft({ custom: { ...custom, url: e.target.value } })}
            />
          </Field>
          <Field id="setting-custom-field" label={t('image.customField')}>
            <Input
              id="setting-custom-field"
              className="h-8 text-xs"
              placeholder="file"
              value={custom.field}
              onChange={(e) => withDraft({ custom: { ...custom, field: e.target.value } })}
            />
          </Field>
          <Field id="setting-custom-path" label={t('image.customPath')}>
            <Input
              id="setting-custom-path"
              className="h-8 text-xs"
              placeholder="data.url"
              value={custom.responsePath}
              onChange={(e) => withDraft({ custom: { ...custom, responsePath: e.target.value } })}
            />
          </Field>
          <Field id="setting-custom-headers" label={t('image.customHeaders')} className="sm:col-span-2">
            <Textarea
              id="setting-custom-headers"
              className="font-mono"
              rows={3}
              placeholder="Authorization: Bearer xxx"
              value={headersText}
              onChange={(e) => setHeadersText(e.target.value)}
            />
          </Field>
        </>
      )}

      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        {draft.type !== 'local' && (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy !== null || !canTest}
            onClick={() => void handleTest()}
          >
            {busy === 'test' ? t('image.testing') : t('image.test')}
          </Button>
        )}
        <Button size="sm" variant="outline" disabled={busy !== null || !dirty} onClick={handleCancel}>
          {t('image.cancel')}
        </Button>
        <Button size="sm" disabled={busy !== null} onClick={() => void handleSave()}>
          {t('image.save')}
        </Button>
      </div>
    </>
  )
}
