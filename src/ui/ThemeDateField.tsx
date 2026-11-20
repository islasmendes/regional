import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatBrDate, parseIsoDate, toIsoDate } from '../lib/dates'
import { useFloatingMenu } from './useFloatingMenu'
import './ui.css'

type Props = {
  label?: string
  value: string | null
  onChange: (value: string | null) => void
  disabled?: boolean
  allowClear?: boolean
  placeholder?: string
}

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function monthLabel(year: number, month: number): string {
  const dt = new Date(year, month, 1)
  return dt.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export function ThemeDateField({
  label,
  value,
  onChange,
  disabled,
  allowClear = true,
  placeholder = 'dd/mm/aaaa',
}: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const selected = parseIsoDate(value)
  const [cursorYear, setCursorYear] = useState(() => selected?.getFullYear() ?? new Date().getFullYear())
  const [cursorMonth, setCursorMonth] = useState(() => selected?.getMonth() ?? new Date().getMonth())
  const pos = useFloatingMenu(open, triggerRef, 280)

  useEffect(() => {
    if (!open) return
    if (selected) {
      setCursorYear(selected.getFullYear())
      setCursorMonth(selected.getMonth())
      return
    }
    const now = new Date()
    setCursorYear(now.getFullYear())
    setCursorMonth(now.getMonth())
  }, [open, value])

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

  const days = useMemo(() => {
    const first = new Date(cursorYear, cursorMonth, 1)
    const startPad = first.getDay()
    const lastDate = new Date(cursorYear, cursorMonth + 1, 0).getDate()
    const cells: Array<{ iso: string; day: number; inMonth: boolean } | null> = []
    for (let i = 0; i < startPad; i++) cells.push(null)
    for (let d = 1; d <= lastDate; d++) {
      const dt = new Date(cursorYear, cursorMonth, d)
      cells.push({ iso: toIsoDate(dt), day: d, inMonth: true })
    }
    return cells
  }, [cursorYear, cursorMonth])

  const display = value ? formatBrDate(value) : placeholder

  return (
    <div className="ui-field" ref={rootRef}>
      {label && <span className="ui-field-label">{label}</span>}
      <div className={`ui-date ${open ? 'is-open' : ''}`}>
        <button
          ref={triggerRef}
          type="button"
          className={`ui-date-trigger ${open ? 'is-open' : ''} ${value ? '' : 'is-empty'}`}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span>{display}</span>
          <span className="ui-date-icon" aria-hidden />
        </button>
        {open &&
          createPortal(
            <div
              ref={menuRef}
              className="ui-date-pop ui-portal-menu"
              role="dialog"
              aria-label={label ?? 'Data'}
              style={{
                top: pos.top,
                left: pos.left,
                width: Math.max(pos.width, 260),
                maxHeight: pos.maxHeight + 120,
              }}
            >
              <div className="ui-date-nav">
                <button
                  type="button"
                  aria-label="Mês anterior"
                  onClick={() => {
                    const m = cursorMonth - 1
                    if (m < 0) {
                      setCursorMonth(11)
                      setCursorYear((y) => y - 1)
                    } else setCursorMonth(m)
                  }}
                >
                  ‹
                </button>
                <strong>{monthLabel(cursorYear, cursorMonth)}</strong>
                <button
                  type="button"
                  aria-label="Próximo mês"
                  onClick={() => {
                    const m = cursorMonth + 1
                    if (m > 11) {
                      setCursorMonth(0)
                      setCursorYear((y) => y + 1)
                    } else setCursorMonth(m)
                  }}
                >
                  ›
                </button>
              </div>
              <div className="ui-date-weekdays">
                {WEEKDAYS.map((w, i) => (
                  <span key={`${w}-${i}`}>{w}</span>
                ))}
              </div>
              <div className="ui-date-grid">
                {days.map((cell, idx) =>
                  cell ? (
                    <button
                      key={cell.iso}
                      type="button"
                      className={cell.iso === value ? 'is-selected' : ''}
                      onClick={() => {
                        onChange(cell.iso)
                        setOpen(false)
                      }}
                    >
                      {cell.day}
                    </button>
                  ) : (
                    <span key={`pad-${idx}`} />
                  ),
                )}
              </div>
              <div className="ui-date-actions">
                {allowClear && (
                  <button
                    type="button"
                    className="ui-date-clear"
                    onClick={() => {
                      onChange(null)
                      setOpen(false)
                    }}
                  >
                    Limpar
                  </button>
                )}
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
