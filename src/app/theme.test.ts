// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyTheme, readTheme, useThemeStore } from './theme'

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    useThemeStore.setState({ theme: 'dark' })
  })
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme')
  })

  it('defaults to dark when nothing is persisted', () => {
    expect(readTheme()).toBe('dark')
  })

  it('reads a persisted theme', () => {
    localStorage.setItem('runalyze:theme', 'light')
    expect(readTheme()).toBe('light')
  })

  it('applyTheme sets the html attribute for light and clears it for dark', () => {
    applyTheme('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    applyTheme('dark')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('setTheme persists and reflects onto the document', () => {
    useThemeStore.getState().setTheme('light')
    expect(useThemeStore.getState().theme).toBe('light')
    expect(localStorage.getItem('runalyze:theme')).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('toggle flips between dark and light', () => {
    useThemeStore.getState().toggle()
    expect(useThemeStore.getState().theme).toBe('light')
    useThemeStore.getState().toggle()
    expect(useThemeStore.getState().theme).toBe('dark')
  })
})
