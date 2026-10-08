import { DOCUMENT, Injectable, effect, inject, signal } from '@angular/core'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ThemeAccent =
  | 'iris'
  | 'graphite'
  | 'emerald'
  | 'ocean'
  | 'sunset'
  | 'rose'

/** Accent themes generated in `_palettes.scss` (label and brand colour for pickers). */
export const THEME_ACCENTS: {
  id: ThemeAccent
  label: string
  color: string
}[] = [
  { id: 'iris', label: 'Iris', color: '#5b5bd6' },
  { id: 'graphite', label: 'Graphite', color: '#18181b' },
  { id: 'emerald', label: 'Emerald', color: '#03865b' },
  { id: 'ocean', label: 'Ocean', color: '#0277b6' },
  { id: 'sunset', label: 'Sunset', color: '#c9480a' },
  { id: 'rose', label: 'Rose', color: '#e11d48' },
]

const STORAGE_KEY = 'spsedu360-theme-mode'
const ACCENT_KEY = 'spsedu360-theme-accent'

/**
 * Switches the Material color scheme. The theme is generated with `theme-type: color-scheme`, so
 * toggling a class on <html> is all it takes; no component styles are involved.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT)
  readonly mode = signal<ThemeMode>(this.read())
  readonly accent = signal<ThemeAccent>(this.readAccent())

  constructor() {
    effect(() => {
      const mode = this.mode()
      const root = this.document.documentElement
      root.classList.toggle('light-theme', mode === 'light')
      root.classList.toggle('dark-theme', mode === 'dark')
      try {
        localStorage.setItem(STORAGE_KEY, mode)
      } catch {
        /* storage unavailable */
      }
    })
    effect(() => {
      const accent = this.accent()
      const root = this.document.documentElement
      for (const option of THEME_ACCENTS)
        root.classList.toggle(`ui-accent-${option.id}`, option.id === accent)
      try {
        localStorage.setItem(ACCENT_KEY, accent)
      } catch {
        /* storage unavailable */
      }
    })
  }

  /** Whether the dark scheme is currently showing, resolving `system` against the OS setting. */
  isDark(): boolean {
    const mode = this.mode()
    if (mode !== 'system') return mode === 'dark'
    return !!this.document.defaultView?.matchMedia?.(
      '(prefers-color-scheme: dark)',
    ).matches
  }

  private readAccent(): ThemeAccent {
    try {
      const value = localStorage.getItem(ACCENT_KEY)
      if (THEME_ACCENTS.some((option) => option.id === value))
        return value as ThemeAccent
    } catch {
      /* storage unavailable */
    }
    return 'iris'
  }

  private read(): ThemeMode {
    try {
      const value = localStorage.getItem(STORAGE_KEY)
      if (value === 'light' || value === 'dark' || value === 'system')
        return value
    } catch {
      /* storage unavailable */
    }
    return 'system'
  }
}
