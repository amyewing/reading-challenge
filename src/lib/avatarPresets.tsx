import type { ReactNode } from 'react';

/**
 * Built-in literary icons people can use instead of a photo. Each is a simple line drawing on a
 * round background in the app's colours. The key is what gets saved, so keep keys stable and
 * lower-case with hyphens (the API only accepts that).
 */
export interface AvatarPreset {
  key: string;
  label: string;
  /** Background colour, and the colour of the line drawing */
  bg: string;
  fg: string;
  /** Drawn on a 48 x 48 canvas */
  glyph: ReactNode;
}

const GREEN = '#2f4a3a';
const RED = '#8a3b2e';
const GOLD = '#c9a55a';
const SAGE = '#9db3a2';
const INK = '#5b4636';
const CREAM = '#fffbef';
const DARK = '#2b2622';

export const AVATAR_PRESETS: AvatarPreset[] = [
  {
    key: 'open-book',
    label: 'Open book',
    bg: GREEN,
    fg: CREAM,
    glyph: (
      <>
        <path d="M24 15C20 12 14 12 9 14V35C14 33 20 33 24 36C28 33 34 33 39 35V14C34 12 28 12 24 15Z" />
        <path d="M24 15V36M13 19C16 18 19 18 21 19M13 24C16 23 19 23 21 24M27 19C29 18 32 18 35 19M27 24C29 23 32 23 35 24" />
      </>
    ),
  },
  {
    key: 'quill',
    label: 'Quill pen',
    bg: RED,
    fg: CREAM,
    glyph: (
      <>
        <path d="M37 9C28 9 19 15 17 27L15 33L21 31C31 29 36 19 37 9Z" />
        <path d="M15 33L10 39M20 30L30 18" />
      </>
    ),
  },
  {
    key: 'book-stack',
    label: 'Stack of books',
    bg: GOLD,
    fg: DARK,
    glyph: (
      <>
        <rect x="9" y="29" width="30" height="8" rx="1.5" />
        <rect x="12" y="21" width="25" height="8" rx="1.5" />
        <rect x="10" y="13" width="27" height="8" rx="1.5" />
        <path d="M15 33H20M17 25H22M15 17H20" />
      </>
    ),
  },
  {
    key: 'owl',
    label: 'Wise owl',
    bg: INK,
    fg: CREAM,
    glyph: (
      <>
        <path d="M14 13L19 18M34 13L29 18" />
        <path d="M14 18C14 12 34 12 34 18V30C34 38 14 38 14 30Z" />
        <circle cx="19.5" cy="24" r="3.5" />
        <circle cx="28.5" cy="24" r="3.5" />
        <path d="M22.5 28.5L24 31.5L25.5 28.5Z" />
      </>
    ),
  },
  {
    key: 'teacup',
    label: 'Tea cup',
    bg: SAGE,
    fg: DARK,
    glyph: (
      <>
        <path d="M12 21H34V28C34 34 30 37 23 37C16 37 12 34 12 28Z" />
        <path d="M34 23H37C40 23 40 29 36 29H34M10 41H38" />
        <path d="M19 16C17 13 21 12 19 9M26 16C24 13 28 12 26 9" />
      </>
    ),
  },
  {
    key: 'lantern',
    label: 'Lantern',
    bg: GREEN,
    fg: GOLD,
    glyph: (
      <>
        <path d="M19 12C19 6 29 6 29 12" />
        <path d="M17 12H31L29 16H19ZM19 16L16 34H32L29 16" />
        <path d="M15 34H33V38H15Z" />
        <path d="M24 20C21 25 22 29 24 29C26 29 27 25 24 20Z" />
      </>
    ),
  },
  {
    key: 'magnifier',
    label: 'Magnifying glass',
    bg: RED,
    fg: GOLD,
    glyph: (
      <>
        <circle cx="21" cy="21" r="10" />
        <path d="M28.5 28.5L38 38" strokeWidth="3.6" />
        <path d="M16 18C17 16 19 15 21 15" />
      </>
    ),
  },
  {
    key: 'moon-stars',
    label: 'Moon and stars',
    bg: DARK,
    fg: GOLD,
    glyph: (
      <>
        <path d="M30 9A15 15 0 1 0 39 30A12 12 0 1 1 30 9Z" />
        <path d="M37 10V16M34 13H40M12 12V16M10 14H14" />
      </>
    ),
  },
  {
    key: 'reading-glasses',
    label: 'Reading glasses',
    bg: GOLD,
    fg: GREEN,
    glyph: (
      <>
        <circle cx="15" cy="26" r="7.5" />
        <circle cx="33" cy="26" r="7.5" />
        <path d="M22.5 25C23.5 23 24.5 23 25.5 25M7.5 25L4 21M40.5 25L44 21" />
      </>
    ),
  },
  {
    key: 'bookmark',
    label: 'Bookmark',
    bg: SAGE,
    fg: RED,
    glyph: (
      <>
        <path d="M15 8H33V40L24 33L15 40Z" />
        <path d="M24 15L25.5 19H29.5L26.3 21.5L27.5 25.5L24 23L20.5 25.5L21.7 21.5L18.5 19H22.5Z" />
      </>
    ),
  },
  {
    key: 'candle',
    label: 'Candle',
    bg: INK,
    fg: GOLD,
    glyph: (
      <>
        <path d="M24 7C20 13 21 17 24 17C27 17 28 13 24 7Z" />
        <path d="M24 17V20" />
        <rect x="18" y="20" width="12" height="18" rx="1.5" />
        <path d="M18 25C21 27 21 24 24 26" />
        <path d="M13 38H35" />
      </>
    ),
  },
  {
    key: 'inkwell',
    label: 'Inkwell and quill',
    bg: GREEN,
    fg: CREAM,
    glyph: (
      <>
        <path d="M16 24H32L35 36C35 38 33 40 31 40H17C15 40 13 38 13 36Z" />
        <rect x="19.5" y="19" width="9" height="5" rx="1" />
        <path d="M27 19L37 7M37 7C41 9 40 15 33 16" />
      </>
    ),
  },
];

export const findPreset = (key: string | null | undefined) => AVATAR_PRESETS.find((p) => p.key === key) ?? null;

/** A preset icon drawn as a filled circle with its line drawing on top */
export function PresetIcon({ preset }: { preset: AvatarPreset }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <circle cx="24" cy="24" r="24" fill={preset.bg} />
      <g fill="none" stroke={preset.fg} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {preset.glyph}
      </g>
    </svg>
  );
}
