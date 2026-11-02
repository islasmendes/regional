import { useLayoutEffect, useState, type RefObject } from 'react'

export type FloatingPos = {
  top: number
  left: number
  width: number
  maxHeight: number
  placement: 'bottom' | 'top'
}

/** Posiciona menu em `position: fixed` (portal) acima de qualquer bloco. */
export function useFloatingMenu(
  open: boolean,
  triggerRef: RefObject<HTMLElement | null>,
  menuMinHeight = 180,
): FloatingPos {
  const [pos, setPos] = useState<FloatingPos>({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: 240,
    placement: 'bottom',
  })

  useLayoutEffect(() => {
    if (!open) return

    const update = () => {
      const el = triggerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const gap = 6
      const spaceBelow = window.innerHeight - rect.bottom - gap - 12
      const spaceAbove = rect.top - gap - 12
      const placement: 'bottom' | 'top' =
        spaceBelow < menuMinHeight && spaceAbove > spaceBelow ? 'top' : 'bottom'
      const maxHeight = Math.max(120, Math.min(280, placement === 'bottom' ? spaceBelow : spaceAbove))
      const top =
        placement === 'bottom' ? rect.bottom + gap : Math.max(8, rect.top - gap - maxHeight)

      setPos({
        top,
        left: Math.min(rect.left, window.innerWidth - Math.max(rect.width, 160) - 8),
        width: rect.width,
        maxHeight,
        placement,
      })
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, triggerRef, menuMinHeight])

  return pos
}
