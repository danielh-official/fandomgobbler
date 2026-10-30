// Every platform the library can hold. Each keeps its own table and model; this is the
// list the merged library, the platform filter and the background health checks go by.
export const PLATFORMS = {
  ao3: { label: 'AO3', home: 'https://archiveofourown.org/' },
  ffnet: { label: 'FanFiction.net', home: 'https://www.fanfiction.net/' },
  wattpad: { label: 'Wattpad', home: 'https://www.wattpad.com/' },
} as const;

export type Platform = keyof typeof PLATFORMS;
export const PLATFORM_IDS = Object.keys(PLATFORMS) as Platform[];

// "AO3 or FanFiction.net", for prompts like the paste-a-URL fields.
export const PLATFORM_NAMES = PLATFORM_IDS.map((p) => PLATFORMS[p].label).join(' or ');

// Hint under the paste-a-URL fields, e.g. "Supported: AO3, FanFiction.net".
export const SUPPORTED_HINT = `Supported: ${PLATFORM_IDS.map((p) => PLATFORMS[p].label).join(', ')}`;
