import { DOCUMENT, Injectable, effect, inject, signal } from '@angular/core'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'spsedu360-theme-mode'

/**
 * Switches the Material color scheme. The theme is generated with `theme-type: color-scheme`, so
 * toggling a class on <html> is all it takes; no component styles are involved.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT)
  readonly mode = signal<ThemeMode>(this.read())

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
  }

  /** Whether the dark scheme is currently showing, resolving `system` against the OS setting. */
  isDark(): boolean {
    const mode = this.mode()
    if (mode !== 'system') return mode === 'dark'
    return !!this.document.defaultView?.matchMedia?.(
      '(prefers-color-scheme: dark)',
    ).matches
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
