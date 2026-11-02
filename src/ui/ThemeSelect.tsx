import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFloatingMenu } from './useFloatingMenu'
import './ui.css'

export type ThemeSelectOption = {
  value: string
  label: string
  disabled?: boolean
}

type Props = {
  label?: string
  value: string
  options: ThemeSelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function ThemeSelect({
  label,
  value,
  options,
  onChange,
  placeholder = 'Selecione…',
  disabled,
  className,
}: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const selected = options.find((o) => o.value === value)
  const pos = useFloatingMenu(open, triggerRef)

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

  return (
    <div className={`ui-field ${className ?? ''}`.trim()} ref={rootRef}>
      {label && <span className="ui-field-label">{label}</span>}
      <div className={`ui-select ${open ? 'is-open' : ''}`}>
        <button
          ref={triggerRef}
          type="button"
          className={`ui-select-trigger ${open ? 'is-open' : ''}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="ui-select-value">{selected?.label ?? placeholder}</span>
          <span className="ui-select-chevron" aria-hidden />
        </button>
        {open &&
          createPortal(
            <div
              ref={menuRef}
              className="ui-select-menu ui-portal-menu"
              role="listbox"
              id={listId}
              style={{
                top: pos.top,
                left: pos.left,
                width: Math.max(pos.width, 160),
                maxHeight: pos.maxHeight,
              }}
            >
              {options.map((opt) => {
                const isSelected = opt.value === value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    className={`ui-select-option ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => {
                      onChange(opt.value)
                      setOpen(false)
                    }}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <span className="ui-select-check" aria-hidden />}
                  </button>
                )
              })}
            </div>,
            document.body,
          )}
      </div>
    </div>
  )
}
