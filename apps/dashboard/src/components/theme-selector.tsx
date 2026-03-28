/**
 * ThemeSelector — Dashboard theme picker
 *
 * Shows 4 theme cards with live color preview + light/dark toggle.
 * Changes are applied instantly (via data-style + data-theme) for
 * real-time preview. The parent saves to API on "حفظ التغييرات".
 */

'use client';

import { useCallback } from 'react';
import { useTheme } from 'next-themes';
import { Check, Sun, Moon, Palette } from 'lucide-react';
import { themeConfigs, THEME_KEYS } from '@/themes/theme-config';
import type { TenantTheme } from '@/types';

interface ThemeSelectorProps {
  /** Currently selected theme */
  selected:    TenantTheme;
  /** Currently selected mode */
  mode:        'light' | 'dark';
  /** Callback when theme changes */
  onThemeChange: (theme: TenantTheme) => void;
  /** Callback when mode changes */
  onModeChange:  (mode: 'light' | 'dark') => void;
}

export function ThemeSelector({
  selected,
  mode,
  onThemeChange,
  onModeChange,
}: ThemeSelectorProps): React.ReactElement {
  const { setTheme: setNextTheme } = useTheme();

  // Apply theme live for instant preview
  const applyTheme = useCallback((theme: TenantTheme) => {
    onThemeChange(theme);
    document.documentElement.setAttribute('data-style', theme);
  }, [onThemeChange]);

  const applyMode = useCallback((m: 'light' | 'dark') => {
    onModeChange(m);
    setNextTheme(m);
  }, [onModeChange, setNextTheme]);

  return (
    <div className="space-y-6">
      {/* ── Theme cards ── */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Palette className="h-4 w-4 text-[var(--muted-foreground)]" />
          <h3 className="text-sm font-semibold text-[var(--foreground)]">اختيار الثيم</h3>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {THEME_KEYS.map((key) => {
            const config = themeConfigs[key];
            const isSelected = selected === key;

            return (
              <button
                key={key}
                onClick={() => applyTheme(key)}
                className={`
                  group relative overflow-hidden rounded-xl border-2 p-0 text-start transition-all
                  ${isSelected
                    ? 'border-[var(--brand-primary)] ring-2 ring-[var(--brand-primary)] ring-offset-2 ring-offset-[var(--background)]'
                    : 'border-[var(--border)] hover:border-[var(--muted-foreground)]'
                  }
                `}
              >
                {/* Preview bar — shows theme colors */}
                <div
                  className="flex h-16 items-end justify-between px-3 pb-2"
                  style={{ background: config.preview.bg }}
                >
                  <div className="flex gap-1.5">
                    <span
                      className="h-4 w-4 rounded-full border border-white/20"
                      style={{ background: config.preview.primary }}
                    />
                    <span
                      className="h-4 w-4 rounded-full border border-white/20"
                      style={{ background: config.preview.accent }}
                    />
                  </div>

                  {isSelected && (
                    <div className="rounded-full bg-white p-0.5">
                      <Check className="h-3 w-3 text-[var(--brand-primary)]" />
                    </div>
                  )}
                </div>

                {/* Theme info */}
                <div className="p-3">
                  <p className="text-sm font-bold text-[var(--foreground)]">
                    {config.nameAr}
                  </p>
                  <p className="mt-0.5 text-[10px] leading-snug text-[var(--muted-foreground)]">
                    {config.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Light / Dark toggle ── */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-[var(--foreground)]">الوضع</h3>
        <div className="flex gap-3">
          <button
            onClick={() => applyMode('light')}
            className={`
              flex items-center gap-2 rounded-xl border-2 px-6 py-3 transition-all
              ${mode === 'light'
                ? 'border-[var(--brand-primary)] bg-[var(--primary-50,var(--muted))]'
                : 'border-[var(--border)] hover:border-[var(--muted-foreground)]'
              }
            `}
          >
            <Sun className="h-5 w-5" />
            <span className="font-medium">فاتح</span>
          </button>

          <button
            onClick={() => applyMode('dark')}
            className={`
              flex items-center gap-2 rounded-xl border-2 px-6 py-3 transition-all
              ${mode === 'dark'
                ? 'border-[var(--brand-primary)] bg-[var(--primary-50,var(--muted))]'
                : 'border-[var(--border)] hover:border-[var(--muted-foreground)]'
              }
            `}
          >
            <Moon className="h-5 w-5" />
            <span className="font-medium">داكن</span>
          </button>
        </div>
      </div>
    </div>
  );
}
