import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from '../../store/theme';

describe('Theme Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    useThemeStore.setState({ mode: 'light', resolvedTheme: 'light' });
    document.documentElement.classList.remove('dark');
  });

  it('starts with light mode by default', () => {
    const state = useThemeStore.getState();
    expect(state.mode).toBe('light');
    expect(state.resolvedTheme).toBe('light');
  });

  it('toggles from light to dark', () => {
    useThemeStore.getState().toggle();
    const state = useThemeStore.getState();
    expect(state.mode).toBe('dark');
    expect(state.resolvedTheme).toBe('dark');
  });

  it('toggles from dark to system', () => {
    useThemeStore.setState({ mode: 'dark', resolvedTheme: 'dark' });
    useThemeStore.getState().toggle();
    const state = useThemeStore.getState();
    expect(state.mode).toBe('system');
  });

  it('toggles from system to light', () => {
    useThemeStore.setState({ mode: 'system', resolvedTheme: 'light' });
    useThemeStore.getState().toggle();
    const state = useThemeStore.getState();
    expect(state.mode).toBe('light');
    expect(state.resolvedTheme).toBe('light');
  });

  it('applies dark class to documentElement when mode is dark', () => {
    useThemeStore.getState().setMode('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('removes dark class from documentElement when mode is light', () => {
    document.documentElement.classList.add('dark');
    useThemeStore.getState().setMode('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('setMode correctly updates mode and resolvedTheme', () => {
    useThemeStore.getState().setMode('dark');
    expect(useThemeStore.getState().mode).toBe('dark');
    expect(useThemeStore.getState().resolvedTheme).toBe('dark');

    useThemeStore.getState().setMode('light');
    expect(useThemeStore.getState().mode).toBe('light');
    expect(useThemeStore.getState().resolvedTheme).toBe('light');
  });
});
