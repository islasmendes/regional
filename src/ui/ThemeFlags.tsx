import './ui.css'

type Props = {
  checkIn: boolean
  checkOut: boolean
}

export function ThemeFlags({ checkIn, checkOut }: Props) {
  return (
    <span className="painel-flag-row">
      <span className={`ui-flag ${checkIn ? 'is-on' : ''}`}>
        <span className="ui-flag-dot" aria-hidden />
        IN
      </span>
      <span className={`ui-flag ${checkOut ? 'is-on' : ''}`}>
        <span className="ui-flag-dot" aria-hidden />
        OUT
      </span>
    </span>
  )
}
