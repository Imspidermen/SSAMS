import { Monitor, Moon, Sun } from 'lucide-react';
import { Dropdown, DropdownItem, DropdownLabel } from '@/components/ui/Dropdown';
import { IconButton } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';
import type { ThemePreference } from '@/context/ThemeContext';

const ICONS: Record<ThemePreference, React.ReactNode> = {
  light: <Sun size={17} />,
  dark: <Moon size={17} />,
  system: <Monitor size={17} />,
};

const LABELS: Record<ThemePreference, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

/** Light / dark / system switcher. Persisted as a UI preference only. */
export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  return (
    <Dropdown
      ariaLabel="Appearance"
      trigger={({ toggle, ref, ariaExpanded, id }) => (
        <IconButton
          ref={ref}
          id={id}
          icon={ICONS[preference]}
          label={`Appearance: ${LABELS[preference]}. Change theme`}
          aria-expanded={ariaExpanded}
          aria-haspopup="true"
          onClick={toggle}
        />
      )}
    >
      {({ close }) => (
        <>
          <DropdownLabel>Appearance</DropdownLabel>
          {(Object.keys(LABELS) as ThemePreference[]).map((option) => (
            <DropdownItem
              key={option}
              icon={ICONS[option]}
              onSelect={() => {
                setPreference(option);
                close();
              }}
            >
              {LABELS[option]}
              {option === preference ? <span className="sr-only"> (current)</span> : null}
            </DropdownItem>
          ))}
        </>
      )}
    </Dropdown>
  );
}
