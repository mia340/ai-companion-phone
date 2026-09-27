/**
 * Design tokens as TypeScript constants.
 * Mirrors src/styles/tokens.css so runtime/canvas code can use the same values
 * without parsing CSS. Keep the two files in sync.
 */

export const brand = {
  50: '#f2f8fe',
  100: '#e2f0fb',
  200: '#c4e2f6',
  300: '#9ccdef',
  400: '#6fb1e3',
  500: '#4f97d4',
  600: '#3d7cba',
  700: '#346497',
  800: '#2f547c',
  900: '#2b4767'
} as const

export const neutral = {
  0: '#ffffff',
  50: '#f7fafc',
  100: '#eef3f7',
  200: '#e1e9f0',
  300: '#cbd7e1',
  400: '#9fb0bf',
  500: '#77889a',
  600: '#5d6f82',
  700: '#4a5a6b',
  800: '#3c4a58',
  900: '#2b3744'
} as const

export const semantic = {
  success: '#2f9e6e',
  successSoft: '#e6f6ee',
  warning: '#c68a2e',
  warningSoft: '#fdf3e2',
  danger: '#c0506a',
  dangerStrong: '#a93d57',
  dangerSoft: '#fdebf0',
  info: brand[500],
  infoSoft: brand[50]
} as const

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64
} as const

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  '2xl': 30,
  full: 999
} as const

export const shadows = {
  xs: '0 1px 2px rgba(40,66,92,.06)',
  sm: '0 2px 8px rgba(43,72,100,.07)',
  md: '0 6px 18px rgba(45,76,104,.1)',
  lg: '0 14px 36px rgba(45,76,104,.14)',
  xl: '0 28px 72px rgba(45,76,104,.2)'
} as const

export const fontSize = {
  xs: 10,
  sm: 12,
  base: 14,
  md: 15,
  lg: 17,
  xl: 22,
  display: 40
} as const

export const motion = {
  durationFast: 0.14,
  durationBase: 0.22,
  durationSlow: 0.34,
  easeStandard: 'cubic-bezier(.2,.82,.24,1)',
  easeEmphasized: 'cubic-bezier(.3,.7,.2,1)'
} as const

export const zIndex = {
  base: 1,
  sticky: 10,
  header: 20,
  dropdown: 30,
  overlay: 40,
  modal: 50,
  toast: 60
} as const

export const designTokens = {
  brand,
  neutral,
  semantic,
  spacing,
  radius,
  shadows,
  fontSize,
  motion,
  zIndex
} as const

export type DesignTokens = typeof designTokens
