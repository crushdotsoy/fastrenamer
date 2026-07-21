import { ChevronDown, Copy } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge, Button, cn } from '../ui';
import type { AppTheme } from '../../themes';
import { useI18n } from '../../i18n';

export function getThemeDescription(theme: AppTheme, t: ReturnType<typeof useI18n>['t']) {
  if (theme.kind === 'preset') {
    return t(`theme.preset.${theme.id}.description`);
  }

  return theme.description;
}

export function getThemeKindLabel(theme: AppTheme, active: boolean, t: ReturnType<typeof useI18n>['t']) {
  if (active) {
    return t('appearance.active');
  }

  return theme.kind === 'custom' ? t('appearance.custom') : t('appearance.preset');
}

type SettingsSectionId = 'updates' | 'executionProfile' | 'platformRules' | 'appearance' | 'language';

export function SettingsSection({
  title,
  badge,
  open,
  onToggle,
  children,
}: {
  title: string;
  badge?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();

  return (
    <section
      className={cn(
        'rounded-xl border border-border bg-surface transition-colors',
        open && 'border-accent/20',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          'flex w-full items-start justify-between gap-3 rounded-xl p-4 text-left transition-colors',
          'hover:bg-surface-elevated/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
        )}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {!open && (
            <p className="mt-0.5 text-[11px] text-muted-foreground/70">{t('settings.click_to_expand')}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 pl-2">
          {badge}
          <span
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors',
              open && 'border-accent/30 bg-accent/10 text-accent',
            )}
          >
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform duration-200 ease-out',
                open && 'rotate-180',
              )}
            />
          </span>
        </div>
      </button>

      <div
        aria-hidden={!open}
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={cn(
              'px-4 pb-4 pt-0 transition-transform duration-200 ease-out',
              open ? 'translate-y-0' : '-translate-y-1',
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ThemeOptionCard({
  theme,
  active,
  onSelect,
  onDuplicate,
}: {
  theme: AppTheme;
  active: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
}) {
  const { t } = useI18n();
  const swatches = [
    theme.tokens.background,
    theme.tokens.card,
    theme.tokens.surface,
    theme.tokens.accent,
    theme.tokens.destructive,
  ];

  return (
    <div
      className={cn(
        'rounded-xl border p-3 transition-colors',
        active ? 'border-accent bg-accent/8' : 'border-border bg-card',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{theme.name}</p>
              <Badge tone={active ? 'accent' : 'default'}>
                {getThemeKindLabel(theme, active, t)}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{getThemeDescription(theme, t)}</p>
          </div>
          <span
            className="mt-0.5 h-3 w-3 shrink-0 rounded-full border border-border"
            style={{ backgroundColor: theme.tokens.accent }}
          />
        </div>

        <div className="mt-3 flex gap-1.5">
          {swatches.map((color, index) => (
            <span
              key={`${theme.id}-swatch-${index}`}
              className="h-7 flex-1 rounded-md border border-border/70"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </button>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
        <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {t(`appearance.base.${theme.baseThemeId}`)}
        </span>
        <Button size="sm" variant="ghost" onClick={onDuplicate}>
          <Copy className="h-3.5 w-3.5" />
          {t('appearance.copy')}
        </Button>
      </div>
    </div>
  );
}

export function ThemeTokenEditor({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();
  return (
    <label className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground">{label}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{description}</p>
        </div>
        <code className="rounded-md bg-surface px-2 py-1 text-[11px] text-muted-foreground">
          {value}
        </code>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-12 cursor-pointer rounded-md border border-border bg-transparent p-1"
        />
        <div className="h-10 flex-1 rounded-lg border border-border" style={{ backgroundColor: value }} />
      </div>
    </label>
  );
}
