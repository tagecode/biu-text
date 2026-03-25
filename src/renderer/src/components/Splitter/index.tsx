import { useRef, useCallback } from 'react'

interface SplitterProps {
  /** 拖拽时回调，参数为水平位移像素（正值向右，负值向左） */
  onDrag: (deltaX: number) => void
  /** 双击恢复默认 50:50 比例 */
  onReset: () => void
}

export function Splitter({ onDrag, onReset }: SplitterProps) {
  const isDragging = useRef(false)
  const lastX = useRef(0)

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = true
    lastX.current = e.clientX
    e.currentTarget.setPointerCapture(e.pointerId)
    e.preventDefault()
  }, [])

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging.current) return
      const delta = e.clientX - lastX.current
      lastX.current = e.clientX
      if (delta !== 0) onDrag(delta)
    },
    [onDrag]
  )

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return
    isDragging.current = false
    e.currentTarget.releasePointerCapture(e.pointerId)
  }, [])

  return (
    <div
      role="separator"
      aria-label="拖拽调整面板宽度，双击恢复 50:50"
      className="relative w-1 shrink-0 bg-border cursor-col-resize select-none group
        hover:bg-primary/40 active:bg-primary/60 transition-colors duration-150"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={onReset}
    >
      {/* 拖拽把手：三个竖点，hover 时显示 */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
          flex flex-col items-center gap-[3px]
          opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="w-[3px] h-[3px] rounded-full bg-muted-foreground/60" />
        ))}
      </div>
    </div>
  )
}
