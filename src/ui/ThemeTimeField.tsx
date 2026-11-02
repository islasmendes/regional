import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatHhMm, parseHhMm } from '../lib/time'
import { useFloatingMenu } from './useFloatingMenu'
import './ui.css'

type Props = {
  label?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  stepMinutes?: number
}

function clampTime(value: string): string {
  const mins = parseHhMm(value)
  return mins == null ? '00:00' : formatHhMm(mins)
}

export function ThemeTimeField({
  label,
  value,
  onChange,
  disabled,
  stepMinutes = 5,
}: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const safe = clampTime(value)
  const currentMins = parseHhMm(safe) ?? 0
  const hour = Math.floor(currentMins / 60)
  const minute = currentMins % 60
  const pos = useFloatingMenu(open, triggerRef, 220)

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), [])
  const minutes = useMemo(() => {
    const step = Math.max(1, Math.min(30, stepMinutes))
    const list: number[] = []
    for (let m = 0; m < 60; m += step) list.push(m)
    if (!list.includes(minute)) list.push(minute)
    return list.sort((a, b) => a - b)
  }, [stepMinutes, minute])

  useEffect(() => {
    if (!open) return
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const setPart = (nextHour: number, nextMinute: number) => {
    onChange(formatHhMm(nextHour * 60 + nextMinute))
  }

  return (
    <div className="ui-field" ref={rootRef}>
      {label && <span className="ui-field-label">{label}</span>}
      <div className={`ui-time ${open ? 'is-open' : ''}`}>
        <button
          ref={triggerRef}
          type="button"
          className={`ui-time-trigger ${open ? 'is-open' : ''}`}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span>{safe}</span>
          <span className="ui-time-icon" aria-hidden />
        </button>
        {open &&
          createPortal(
            <div
              ref={menuRef}
              className="ui-time-pop ui-portal-menu"
              role="dialog"
              aria-label={label ?? 'Horário'}
              style={{
                top: pos.top,
                left: pos.left,
                width: Math.max(pos.width, 200),
                maxHeight: pos.maxHeight + 72,
              }}
            >
              <div className="ui-time-cols">
                <div className="ui-time-col">
                  <span>Hora</span>
                  <div className="ui-time-list" style={{ maxHeight: Math.max(120, pos.maxHeight - 24) }}>
                    {hours.map((h) => (
                      <button
                        key={h}
                        type="button"
                        className={h === hour ? 'is-selected' : ''}
                        onClick={() => setPart(h, minute)}
                      >
                        {String(h).padStart(2, '0')}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="ui-time-col">
                  <span>Min</span>
                  <div className="ui-time-list" style={{ maxHeight: Math.max(120, pos.maxHeight - 24) }}>
                    {minutes.map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={m === minute ? 'is-selected' : ''}
                        onClick={() => setPart(hour, m)}
                      >
                        {String(m).padStart(2, '0')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="ui-time-actions">
                <button type="button" onClick={() => setOpen(false)}>
                  OK
                </button>
              </div>
            </div>,
            document.body,
          )}
      </div>
    </div>
  )
}
