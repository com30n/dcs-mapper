import { useId, useState, type ReactNode } from 'react'
import { percent } from '../../../state/export'
import styles from './Dialogs.module.css'

interface ValueProps {
  label: string
  value: number
  min?: number
  disabled?: boolean
  onChange: (value: number) => void
}

function readPercent(raw: string, min: number) {
  const v = Number(raw) / 100
  if (raw === '' || Number.isNaN(v)) return null
  return Math.max(min / 100, Math.min(1, v))
}

export function NumberInput({ value, min = 0, onChange, ...rest }: Omit<ValueProps, 'label'> & { id?: string; 'aria-label'?: string }) {
  const [text, setText] = useState(String(percent(value)))
  const [shown, setShown] = useState(value)
  if (value !== shown) {
    setShown(value)
    setText(String(percent(value)))
  }
  return (
    <input type="number" step="any" min={min} max={100} value={text} className={styles.number} {...rest}
      onBlur={() => setText(String(percent(value)))}
      onChange={(e) => {
        setText(e.target.value)
        const v = readPercent(e.target.value, min)
        if (v === null) return
        setShown(v)
        onChange(v)
      }} />
  )
}

export function ValueRow({ label, value, min = 0, disabled, onChange }: ValueProps) {
  const id = useId()
  return (
    <div className={styles.valueRow}>
      <label htmlFor={id}>{label}</label>
      <div>
        <input type="range" step={1} min={min} max={100} value={percent(value)} disabled={disabled} aria-label={label}
          onChange={(e) => onChange(readPercent(e.target.value, min)!)} />
        <NumberInput id={id} value={value} min={min} disabled={disabled} onChange={onChange} />
      </div>
    </div>
  )
}

export const Check = ({ checked, onChange, title, children }: { checked: boolean; onChange: (v: boolean) => void; title?: string; children: ReactNode }) => (
  <label className={styles.check} title={title}>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />{children}
  </label>
)
