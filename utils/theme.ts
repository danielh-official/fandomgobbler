import { createSignal, onCleanup } from 'solid-js';

export const THEMES = { system: 'System theme', light: 'Light', dark: 'Dark' } as const;
export type Theme = keyof typeof THEMES;

const KEY = 'fg-theme';

const parse = (v: string | null): Theme => (v === 'light' || v === 'dark' ? v : 'system');

// Storage may be unavailable; the system theme is the default.
function load(): Theme {
  try {
    return parse(localStorage.getItem(KEY));
  } catch {
    return 'system';
  }
}

// app.css picks colours from color-scheme, which data-theme pins; without it the
// system theme applies.
function apply(theme: Theme) {
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

// Call before rendering so the page doesn't flash the other theme.
export const applySavedTheme = () => apply(load());

// The theme setting, shared by the side panel and the dashboard through localStorage;
// a change in one page reaches the other live through the `storage` event.
export function createTheme() {
  const [theme, setThemeSignal] = createSignal(load());
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    setThemeSignal(parse(e.newValue));
    apply(theme());
  };
  window.addEventListener('storage', onStorage);
  onCleanup(() => window.removeEventListener('storage', onStorage));

  const setTheme = (t: Theme) => {
    setThemeSignal(t);
    apply(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      // See load().
    }
  };
  return [theme, setTheme] as const;
}
