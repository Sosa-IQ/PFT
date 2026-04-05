// Shared category color palette and badge-style utilities.
// Used by TransactionTable and the categories management page.

import type { CSSProperties } from 'react'

export interface ColorEntry {
  label: string
  swatch: string  // hex color for the picker dot
  badge: string   // Tailwind classes for the pill badge
}

export const CATEGORY_PALETTE: Record<string, ColorEntry> = {
  purple: { label: 'Purple', swatch: '#b794f4', badge: 'bg-[#efe5ff] text-[#7c4fd6] dark:bg-[#312548] dark:text-[#cf9bff]' },
  green:  { label: 'Green',  swatch: '#5ecfa0', badge: 'bg-[#e3f6ed] text-[#239b73] dark:bg-[#153729] dark:text-accent' },
  red:    { label: 'Red',    swatch: '#e89fa6', badge: 'bg-[#fde8e7] text-[#c96672] dark:bg-[#3c2430] dark:text-danger' },
  blue:   { label: 'Blue',   swatch: '#7bb8e8', badge: 'bg-[#e2f1ff] text-[#2a7db4] dark:bg-[#22344f] dark:text-[#78d7ff]' },
  yellow: { label: 'Yellow', swatch: '#d4b86a', badge: 'bg-[#fbf2d7] text-[#b68a22] dark:bg-[#3d3622] dark:text-warning' },
  gray:   { label: 'Gray',   swatch: '#9baabf', badge: 'bg-[#e8edf6] text-[#697792] dark:bg-[#27324a] dark:text-cream-muted' },
  orange: { label: 'Orange', swatch: '#e8a870', badge: 'bg-[#fef0e3] text-[#b86a2a] dark:bg-[#3d2c1a] dark:text-[#f5a96b]' },
  pink:   { label: 'Pink',   swatch: '#e8a0c8', badge: 'bg-[#fce8f4] text-[#b84a8a] dark:bg-[#3d1a30] dark:text-[#f59bcf]' },
  teal:   { label: 'Teal',   swatch: '#60c8c0', badge: 'bg-[#e0f5f4] text-[#1a8a85] dark:bg-[#1a3535] dark:text-[#60c8c0]' },
  indigo: { label: 'Indigo', swatch: '#818cf8', badge: 'bg-[#eef0ff] text-[#4f5ad6] dark:bg-[#252848] dark:text-[#818cf8]' },
}

// Keyword → color key mapping used as a fallback when no stored color exists.
const KEYWORD_COLORS: Record<string, string> = {
  food: 'purple', dining: 'purple', restaurant: 'purple',
  groceries: 'green', grocery: 'green',
  shopping: 'red',
  transport: 'blue', travel: 'blue',
  housing: 'yellow', rent: 'yellow',
  utilities: 'gray',
  entertainment: 'purple',
  health: 'red', medical: 'red',
  income: 'green',
}

const DEFAULT_BADGE = 'bg-[#e8edf6] text-[#697792] dark:bg-[#27324a] dark:text-cream-muted'

/** Whether a color value is a custom hex (e.g. "#ff5733") vs a palette key. */
export function isHexColor(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith('#')
}

/** Inline style to apply when a custom hex color is used for a badge. */
function hexBadgeStyle(hex: string): CSSProperties {
  return {
    backgroundColor: `${hex}28`,  // ~16% opacity tint
    color: hex,
  }
}

export interface BadgeProps {
  className: string
  style?: CSSProperties
}

/**
 * Returns className + optional inline style for a category badge pill.
 * Priority: stored color (palette key or custom hex) → keyword matching → default gray.
 *
 * @param cat       - The category name (may be null for uncategorized)
 * @param colorMap  - Optional map of category name → color value from the API
 */
export function getCategoryBadge(
  cat: string | null,
  colorMap?: Record<string, string>,
): BadgeProps {
  if (!cat) return { className: DEFAULT_BADGE }

  const stored = colorMap?.[cat]

  // 1a. Custom hex color stored for this category
  if (isHexColor(stored)) {
    return { className: '', style: hexBadgeStyle(stored) }
  }

  // 1b. Palette key stored for this category
  if (stored && CATEGORY_PALETTE[stored]) {
    return { className: CATEGORY_PALETTE[stored].badge }
  }

  // 2. Keyword matching fallback
  const lower = cat.toLowerCase()
  for (const [keyword, colorKey] of Object.entries(KEYWORD_COLORS)) {
    if (lower.includes(keyword)) return { className: CATEGORY_PALETTE[colorKey].badge }
  }

  return { className: DEFAULT_BADGE }
}

/**
 * Returns a display hex for a swatch dot.
 * Priority: custom hex → palette swatch → keyword match on name → default gray.
 */
export function getSwatchColor(
  colorKey: string | null | undefined,
  catName?: string | null,
): string {
  // Custom hex — use directly
  if (isHexColor(colorKey)) return colorKey

  // Palette key
  if (colorKey && CATEGORY_PALETTE[colorKey]) {
    return CATEGORY_PALETTE[colorKey].swatch
  }

  // Keyword fallback on category name
  if (catName) {
    const lower = catName.toLowerCase()
    for (const [keyword, key] of Object.entries(KEYWORD_COLORS)) {
      if (lower.includes(keyword)) return CATEGORY_PALETTE[key].swatch
    }
  }

  return '#9baabf'
}
