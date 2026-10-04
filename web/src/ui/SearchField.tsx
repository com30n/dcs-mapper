import { SearchIcon } from './icons'
import styles from './SearchField.module.css'
import { cx } from './cx'

interface SearchFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  wide?: boolean
  className?: string
}

export const SearchField = ({ label, value, onChange, wide, className }: SearchFieldProps) => (
  <label className={cx(styles.search, wide && styles.wide, className)}>
    <SearchIcon />
    <span className="sr">{label}</span>
    <input type="search" value={value} placeholder={label} onChange={(e) => onChange(e.target.value)} />
  </label>
)
