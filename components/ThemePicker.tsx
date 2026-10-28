import { For } from 'solid-js';
import { createTheme, THEMES, type Theme } from '@/utils/theme';

export function ThemePicker(props: { class?: string }) {
  const [theme, setTheme] = createTheme();
  return (
    <select
      class={props.class}
      value={theme()}
      onChange={(e) => setTheme(e.currentTarget.value as Theme)}
      aria-label="Theme"
    >
      <For each={Object.entries(THEMES)}>{([value, label]) => <option value={value}>{label}</option>}</For>
    </select>
  );
}
