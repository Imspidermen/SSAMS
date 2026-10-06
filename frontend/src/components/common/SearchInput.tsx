import { useEffect, useId, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { IconButton } from '@/components/ui/Button';
import { SEARCH_DEBOUNCE_MS } from '@/utils/constants';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

export interface SearchInputProps {
  /** Local input value (controlled by the parent's filter state). */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  /** Debounce applied before the value reaches the API layer. */
  debounceMs?: number;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
}

/**
 * Debounced search field. The parent receives the settled value, so typing does
 * not fire a request per keystroke; clearing is instant.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  label = 'Search',
  debounceMs = SEARCH_DEBOUNCE_MS,
  disabled = false,
  className,
  autoFocus = false,
}: SearchInputProps) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const debounced = useDebouncedValue(draft, debounceMs);

  // Keep the field in sync when filters are reset from outside (e.g. "Clear all").
  useEffect(() => {
    setDraft((current) => (current === value ? current : value));
  }, [value]);

  useEffect(() => {
    if (debounced !== value) onChange(debounced);
    // `onChange` identity changes on every parent render; depend on the value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <div className={className}>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <div className="search-input">
        <span className="search-input__icon" aria-hidden="true">
          <Search size={16} />
        </span>
        <Input
          id={id}
          type="search"
          value={draft}
          disabled={disabled}
          autoFocus={autoFocus}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter applies immediately rather than waiting for the debounce.
            if (event.key === 'Enter') {
              event.preventDefault();
              onChange(draft);
            }
            if (event.key === 'Escape' && draft) {
              event.preventDefault();
              setDraft('');
              onChange('');
            }
          }}
        />
        {draft ? (
          <IconButton
            className="search-input__clear"
            size="sm"
            icon={<X size={15} />}
            label="Clear search"
            onClick={() => {
              setDraft('');
              onChange('');
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
