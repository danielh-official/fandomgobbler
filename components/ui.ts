// Tailwind class sets reused across the side panel and the dashboard.

export const card = 'grid gap-2.5 rounded-lg border bg-surface p-3.5';

export const sectionHeading = 'mb-1.5 text-xs font-semibold tracking-wider text-muted uppercase';

export const linkButton =
  'justify-self-start border-0 bg-transparent p-0 text-left font-semibold text-accent hover:underline';

// A toggle that turns accent-coloured while aria-pressed is true.
export const pressed = 'aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-on-accent';

export const chip = `inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 ${pressed}`;

export const primaryButton = 'border-accent bg-accent text-on-accent hover:border-accent';

export const dangerButton = 'border-danger text-danger hover:border-danger';
