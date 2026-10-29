// Every platform the library can hold. Each keeps its own table and model; this is the
// list the merged library, the platform filter and the background health checks go by.
export const PLATFORMS = {
  ao3: { label: 'AO3', home: 'https://archiveofourown.org/' },
} as const;

export type Platform = keyof typeof PLATFORMS;
export const PLATFORM_IDS = Object.keys(PLATFORMS) as Platform[];
