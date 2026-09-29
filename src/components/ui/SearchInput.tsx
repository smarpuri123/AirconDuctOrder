import { Search } from 'lucide-react'

/** Shared field styles: visible surface + primary border (default and focus). */
export const searchInputFieldClass =
  'w-full h-12 pr-4 rounded-md bg-surface border-2 border-primary text-text-primary placeholder:text-neutral outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  'aria-label'?: string
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search orders...',
  className = '',
  'aria-label': ariaLabel,
}: SearchInputProps) {
  return (
    <div className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral pointer-events-none" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className={`${searchInputFieldClass} pl-12 ${className}`}
      />
    </div>
  )
}
