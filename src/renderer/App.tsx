import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Braces,
  Calendar,
  CaseSensitive,
  ChevronDown,
  ChevronUp,
  Clock3,
  Copy,
  Eraser,
  FileCode,
  FileInput,
  GripVertical,
  Hash,
  Info,
  Minus,
  Palette,
  Plus,
  RefreshCcw,
  Replace,
  Save,
  Scissors,
  Settings2,
  Square,
  Trash2,
  Type,
  Undo2,
  Download,
  ExternalLink,
  AlertTriangle,
  X,
} from 'lucide-react';
import type { DragEvent, ReactNode } from 'react';
import type {
  HistoryEntry,
  PlatformTarget,
  Preset,
  PreviewResult,
  SourceMode,
  RenameRule,
  SourceSelection,
} from '@fast-renamer/rename-engine';
import type { UpdateState, WindowState } from '@shared/contracts';
import {
  Badge,
  Button,
  Checkbox,
  Drawer,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  IconButton,
  Input,
  Modal,
  Panel,
  PanelHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  Tooltip,
  cn,
} from './components/ui';
import {
  ACTIVE_THEME_STORAGE_KEY,
  CUSTOM_THEMES_STORAGE_KEY,
  DEFAULT_THEME_ID,
  getAllThemes,
  getThemeSnapshot,
  LEGACY_THEME_STORAGE_KEY,
  migrateLegacyThemeId,
  resolveTheme,
  THEME_SNAPSHOT_STORAGE_KEY,
  THEME_TOKEN_FIELDS,
  type AppTheme,
  type ThemeTokenKey,
  type ThemeTokens,
  createCustomTheme,
} from './themes';
import { AVAILABLE_LOCALES, useI18n, type AppLocale } from './i18n';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_PREVIEW: PreviewResult = {
  rows: [],
  summary: { total: 0, changed: 0, ok: 0, conflict: 0, invalid: 0, unchanged: 0, blocked: false },
};

const STATUS_OPTIONS = ['ok', 'conflict', 'invalid', 'unchanged'] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];

const SOURCE_MODE_OPTIONS: SourceMode[] = [
  'picked_folders',
  'picked_files',
  'top_level_folders',
  'subfolders',
  'top_level_files',
  'files_recursive',
];

const RULE_TYPE_ORDER: RenameRule['type'][] = [
  'new_name',
  'custom_rule',
  'find_replace',
  'prefix_suffix',
  'case_transform',
  'trim_text',
  'remove_text',
  'sequence_insert',
  'date_time',
  'extension_handling',
];

function getSourceModeMeta(t: ReturnType<typeof useI18n>['t']): Record<
  SourceMode,
  { label: string; pickerLabel: string; detail: string; supportsFilter: boolean }
> {
  return {
    picked_folders: {
      label: t('source.mode.picked_folders.label'),
      pickerLabel: t('source.mode.picked_folders.picker'),
      detail: t('source.mode.picked_folders.detail'),
      supportsFilter: false,
    },
    picked_files: {
      label: t('source.mode.picked_files.label'),
      pickerLabel: t('source.mode.picked_files.picker'),
      detail: t('source.mode.picked_files.detail'),
      supportsFilter: true,
    },
    top_level_folders: {
      label: t('source.mode.top_level_folders.label'),
      pickerLabel: t('source.mode.top_level_folders.picker'),
      detail: t('source.mode.top_level_folders.detail'),
      supportsFilter: false,
    },
    subfolders: {
      label: t('source.mode.subfolders.label'),
      pickerLabel: t('source.mode.subfolders.picker'),
      detail: t('source.mode.subfolders.detail'),
      supportsFilter: false,
    },
    top_level_files: {
      label: t('source.mode.top_level_files.label'),
      pickerLabel: t('source.mode.top_level_files.picker'),
      detail: t('source.mode.top_level_files.detail'),
      supportsFilter: true,
    },
    files_recursive: {
      label: t('source.mode.files_recursive.label'),
      pickerLabel: t('source.mode.files_recursive.picker'),
      detail: t('source.mode.files_recursive.detail'),
      supportsFilter: true,
    },
  };
}

function getRuleMeta(t: ReturnType<typeof useI18n>['t']): Record<
  RenameRule['type'],
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> {
  return {
    new_name: { label: t('rule.new_name'), color: '#38bdf8', icon: Type },
    custom_rule: { label: t('rule.custom_rule'), color: '#f97316', icon: Braces },
    find_replace: { label: t('rule.find_replace'), color: '#4e8fff', icon: Replace },
    prefix_suffix: { label: t('rule.prefix_suffix'), color: '#a78bfa', icon: Braces },
    case_transform: { label: t('rule.case_transform'), color: '#34d399', icon: CaseSensitive },
    trim_text: { label: t('rule.trim_text'), color: '#2dd4bf', icon: Scissors },
    remove_text: { label: t('rule.remove_text'), color: '#f87171', icon: Eraser },
    sequence_insert: { label: t('rule.sequence_insert'), color: '#fb923c', icon: Hash },
    date_time: { label: t('rule.date_time'), color: '#fbbf24', icon: Calendar },
    extension_handling: { label: t('rule.extension_handling'), color: '#e879f9', icon: FileCode },
  };
}

function getNewNameTokens(t: ReturnType<typeof useI18n>['t']) {
  return [
    { label: t('new_name.token.sequence.label'), detail: t('new_name.token.sequence.detail'), value: '{seq_num:0001}' },
    { label: t('new_name.token.original.label'), detail: t('new_name.token.original.detail'), value: '{original_stem}' },
    { label: t('new_name.token.current.label'), detail: t('new_name.token.current.detail'), value: '{current_stem}' },
    { label: t('new_name.token.parent.label'), detail: t('new_name.token.parent.detail'), value: '{parent}' },
    { label: t('new_name.token.date.label'), detail: t('new_name.token.date.detail'), value: '{date}' },
    { label: t('new_name.token.time.label'), detail: t('new_name.token.time.detail'), value: '{time}' },
  ] as const;
}

function getNewNameStarters(t: ReturnType<typeof useI18n>['t']) {
  return [
    { label: t('new_name.starter.simple'), value: 'name_{seq_num:0001}' },
    { label: t('new_name.starter.original'), value: '{original_stem}_{seq_num:0001}' },
    { label: t('new_name.starter.folder'), value: '{parent}_{seq_num:0001}' },
    { label: t('new_name.starter.date'), value: '{date}_{seq_num:0001}' },
  ] as const;
}

function getCustomRuleQuickInsert() {
  return [
    { label: 'currentName', value: 'currentName' },
    { label: 'currentStem', value: 'currentStem' },
    { label: 'originalStem', value: 'originalStem' },
    { label: 'extension', value: 'extension' },
    { label: 'parent', value: 'parent' },
    { label: 'sourcePath', value: 'sourcePath' },
    { label: 'index', value: 'index' },
    { label: 'total', value: 'total' },
    { label: 'isDirectory', value: 'isDirectory' },
  ] as const;
}

function getCustomRuleExamples() {
  return [
    {
      label: 'Snake + sequence',
      value: 'snake(originalStem) + "_" + pad(index, 3) + ext(lower(extension))',
    },
    {
      label: 'Parent prefix',
      value: 'kebab(parent) + "_" + kebab(currentStem) + ext(extension)',
    },
    {
      label: 'Conditional camera import',
      value:
        'startsWith(originalStem, "IMG_") ? "photo_" + pad(index, 4) + ext(lower(extension)) : currentName',
    },
  ] as const;
}

const CUSTOM_RULE_HELPERS = [
  'lower(text)',
  'upper(text)',
  'trim(text)',
  'title(text)',
  'camel(text)',
  'pascal(text)',
  'kebab(text)',
  'snake(text)',
  'replace(text, search, replacement)',
  'replaceAll(text, search, replacement)',
  'regexReplace(text, pattern, replacement, flags)',
  'pad(value, width, fill?)',
  'slice(text, start, end?)',
  'startsWith(text, search)',
  'endsWith(text, search)',
  'includes(text, search)',
  'basename(path)',
  'dirname(path)',
  'len(text)',
  'when(condition, yes, no)',
  'ext(value)',
] as const;

const SOURCE_LIST_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});
const LEFT_WIDTH_STORAGE_KEY = 'left_panel_width';
const DEFAULT_LEFT_WIDTH_RATIO = 0.28;
const MAX_LEFT_WIDTH_RATIO = 0.45;
const MIN_LEFT_PANEL_WIDTH_PX = 453;
const MIN_PREVIEW_PANEL_WIDTH_PX = 320;
const APP_VERSION = __APP_VERSION__;

function clampLeftWidthRatio(value: number, containerWidth: number) {
  const safeWidth = Math.max(containerWidth, 1);
  const minRatio = Math.min(1, MIN_LEFT_PANEL_WIDTH_PX / safeWidth);
  const previewSafeWidth = Math.max(safeWidth - MIN_PREVIEW_PANEL_WIDTH_PX, 0);
  const dynamicMaxRatio = Math.min(1, previewSafeWidth / safeWidth);
  const maxRatio = Math.max(minRatio, Math.max(MAX_LEFT_WIDTH_RATIO, dynamicMaxRatio));
  return Math.min(maxRatio, Math.max(minRatio, value));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectPlatform(): PlatformTarget {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('win')) return 'win32';
  if (ua.includes('mac')) return 'darwin';
  return 'linux';
}

function isFileDropEvent(event: DragEvent<HTMLElement>) {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

function createRule(type: RenameRule['type']): RenameRule {
  const id = `${type}-${crypto.randomUUID()}`;
  switch (type) {
    case 'new_name':
      return { id, type, enabled: true, template: 'name_{seq_num:0001}' };
    case 'custom_rule':
      return { id, type, enabled: true, expression: 'currentName' };
    case 'find_replace':
      return { id, type, enabled: true, find: '', replace: '', matchCase: false, useRegex: false, replaceAll: true };
    case 'prefix_suffix':
      return { id, type, enabled: true, prefix: '', suffix: '' };
    case 'case_transform':
      return { id, type, enabled: true, mode: 'title' };
    case 'trim_text':
      return { id, type, enabled: true, mode: 'collapse_spaces' };
    case 'remove_text':
      return { id, type, enabled: true, text: '', matchCase: false };
    case 'sequence_insert':
      return { id, type, enabled: true, position: 'prefix', start: 1, step: 1, padWidth: 3, separator: '_' };
    case 'date_time':
      return { id, type, enabled: true, position: 'suffix', format: 'YYYY-MM-DD', separator: '_' };
    case 'extension_handling':
      return { id, type, enabled: true, mode: 'lowercase', replacement: '' };
  }
}

function moveRule(rules: RenameRule[], ruleId: string, direction: 'up' | 'down') {
  const index = rules.findIndex((r) => r.id === ruleId);
  if (index === -1) return rules;
  const nextIndex = direction === 'up' ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= rules.length) return rules;
  const next = [...rules];
  const [rule] = next.splice(index, 1);
  next.splice(nextIndex, 0, rule);
  return next;
}

function reorderRule(rules: RenameRule[], draggedRuleId: string, targetRuleId: string) {
  const fromIndex = rules.findIndex((rule) => rule.id === draggedRuleId);
  const toIndex = rules.findIndex((rule) => rule.id === targetRuleId);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
    return rules;
  }

  const next = [...rules];
  const [rule] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, rule);
  return next;
}

function sortSourceSelections(sources: SourceSelection[]) {
  return [...sources].sort((left, right) => SOURCE_LIST_COLLATOR.compare(left.path, right.path));
}

const THEME_TOKEN_CSS_VARIABLES: Record<ThemeTokenKey, string> = {
  background: '--background',
  foreground: '--foreground',
  card: '--card',
  cardForeground: '--card-foreground',
  surface: '--surface',
  surfaceElevated: '--surface-elevated',
  border: '--border',
  muted: '--muted',
  mutedForeground: '--muted-foreground',
  accent: '--accent',
  accentForeground: '--accent-foreground',
  destructive: '--destructive',
  ring: '--ring',
  statusOk: '--status-ok',
  statusConflict: '--status-conflict',
  statusInvalid: '--status-invalid',
  statusUnchanged: '--status-unchanged',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseStoredThemeTokens(value: unknown): ThemeTokens | null {
  if (!isRecord(value)) {
    return null;
  }

  const tokens = {} as ThemeTokens;
  for (const field of THEME_TOKEN_FIELDS) {
    const tokenValue = value[field.key];
    if (typeof tokenValue !== 'string') {
      return null;
    }
    tokens[field.key] = tokenValue;
  }

  return tokens;
}

function parseStoredCustomThemes() {
  try {
    const stored = localStorage.getItem(CUSTOM_THEMES_STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((theme): AppTheme[] => {
      if (!isRecord(theme)) {
        return [];
      }

      const baseThemeId = theme.baseThemeId === 'light' || theme.baseThemeId === 'dark'
        ? theme.baseThemeId
        : theme.colorScheme === 'light' || theme.colorScheme === 'dark'
          ? theme.colorScheme
        : null;
      const tokens = parseStoredThemeTokens(theme.tokens);

      if (!baseThemeId || !tokens) {
        return [];
      }

      return [{
        id: typeof theme.id === 'string' && theme.id ? theme.id : `custom-${crypto.randomUUID()}`,
        name: typeof theme.name === 'string' && theme.name.trim() ? theme.name : 'Custom Theme',
        description: typeof theme.description === 'string' && theme.description.trim()
          ? theme.description
          : 'User-created theme.',
        baseThemeId,
        tokens,
        kind: 'custom',
      }];
    });
  } catch {
    return [];
  }
}

function applyTheme(theme: AppTheme) {
  const root = document.documentElement;

  root.dataset.theme = theme.id;
  root.dataset.colorScheme = theme.baseThemeId;

  for (const field of THEME_TOKEN_FIELDS) {
    root.style.setProperty(THEME_TOKEN_CSS_VARIABLES[field.key], theme.tokens[field.key]);
  }
}

function useThemeManager() {
  const [customThemes, setCustomThemes] = useState<AppTheme[]>(() => parseStoredCustomThemes());
  const [activeThemeId, setActiveThemeId] = useState(() => {
    const storedThemeId = localStorage.getItem(ACTIVE_THEME_STORAGE_KEY);
    if (storedThemeId) {
      return migrateLegacyThemeId(storedThemeId);
    }

    return migrateLegacyThemeId(localStorage.getItem(LEGACY_THEME_STORAGE_KEY));
  });

  const themes = useMemo(() => getAllThemes(customThemes), [customThemes]);
  const theme = useMemo(() => resolveTheme(activeThemeId, customThemes), [activeThemeId, customThemes]);

  useEffect(() => {
    if (!themes.some((candidate) => candidate.id === activeThemeId)) {
      setActiveThemeId(theme.id);
    }
  }, [activeThemeId, theme.id, themes]);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(ACTIVE_THEME_STORAGE_KEY, theme.id);
    localStorage.setItem(THEME_SNAPSHOT_STORAGE_KEY, JSON.stringify(getThemeSnapshot(theme)));
    localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(CUSTOM_THEMES_STORAGE_KEY, JSON.stringify(customThemes));
  }, [customThemes]);

  function createThemeFrom(themeToClone: AppTheme) {
    const nextTheme = createCustomTheme(themeToClone);
    setCustomThemes((current) => [nextTheme, ...current]);
    setActiveThemeId(nextTheme.id);
  }

  return {
    theme,
    themes,
    setTheme: (themeId: string) => setActiveThemeId(migrateLegacyThemeId(themeId)),
    cycleTheme: () => {
      const currentIndex = themes.findIndex((candidate) => candidate.id === theme.id);
      const nextTheme = themes[(currentIndex + 1 + themes.length) % themes.length] ?? themes[0];
      if (nextTheme) {
        setActiveThemeId(nextTheme.id);
      }
    },
    createThemeFromActive: () => createThemeFrom(theme),
    createThemeFromId: (themeId: string) => {
      const sourceTheme = themes.find((candidate) => candidate.id === themeId);
      if (sourceTheme) {
        createThemeFrom(sourceTheme);
      }
    },
    renameCustomTheme: (themeId: string, name: string) => {
      setCustomThemes((current) =>
        current.map((candidate) =>
          candidate.id === themeId
            ? { ...candidate, name, description: `Custom theme based on ${name || 'your palette'}.` }
            : candidate,
        ),
      );
    },
    updateCustomThemeToken: (themeId: string, token: ThemeTokenKey, value: string) => {
      setCustomThemes((current) =>
        current.map((candidate) =>
          candidate.id === themeId
            ? { ...candidate, tokens: { ...candidate.tokens, [token]: value } }
            : candidate,
        ),
      );
    },
    deleteCustomTheme: (themeId: string) => {
      setCustomThemes((current) => current.filter((candidate) => candidate.id !== themeId));
      if (theme.id === themeId) {
        setActiveThemeId(DEFAULT_THEME_ID);
      }
    },
  };
}

const DEFAULT_WINDOW_STATE: WindowState = {
  isMaximized: false,
};

const DEFAULT_UPDATE_STATE: UpdateState = {
  status: 'idle',
  currentVersion: '0.0.0',
};

type UpdateToastTone = 'default' | 'ok' | 'accent' | 'conflict';

interface UpdateToastState {
  id: number;
  open: boolean;
  tone: UpdateToastTone;
  title: string;
  description: string;
  actionLabel?: string;
  actionKind?: 'open-settings' | 'install-update' | 'download-update';
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const scaled = value / 1024 ** exponent;
  return `${scaled >= 10 || exponent === 0 ? scaled.toFixed(0) : scaled.toFixed(1)} ${units[exponent]}`;
}

function getUpdateTone(status: UpdateState['status']) {
  switch (status) {
    case 'downloaded':
    case 'up-to-date':
      return 'ok';
    case 'available':
    case 'downloading':
    case 'checking':
    case 'installing':
      return 'accent';
    case 'error':
      return 'conflict';
    default:
      return 'default';
  }
}

function getUpdateStatusLabel(status: UpdateState['status'], t: ReturnType<typeof useI18n>['t']) {
  switch (status) {
    case 'idle':
      return t('updates.status.idle');
    case 'disabled':
      return t('updates.status.disabled');
    case 'checking':
      return t('updates.status.checking');
    case 'available':
      return t('updates.status.available');
    case 'downloading':
      return t('updates.status.downloading');
    case 'downloaded':
      return t('updates.status.downloaded');
    case 'up-to-date':
      return t('updates.status.up_to_date');
    case 'installing':
      return t('updates.status.installing');
    case 'error':
      return t('updates.status.error');
  }
}

function getUpdateSummary(state: UpdateState, t: ReturnType<typeof useI18n>['t']) {
  switch (state.status) {
    case 'disabled':
      return state.message ?? t('updates.summary.disabled');
    case 'checking':
      return t('updates.summary.checking');
    case 'available':
      return state.manualDownloadOnly
        ? state.message ?? t('updates.summary.available_manual', { version: state.availableVersion ?? 'unknown' })
        : t('updates.summary.available_auto', { version: state.availableVersion ?? 'unknown' });
    case 'downloading':
      return state.progress
        ? t('updates.summary.downloading_with_progress', {
            percent: state.progress.percent.toFixed(0),
            transferred: formatBytes(state.progress.transferred),
            total: formatBytes(state.progress.total),
          })
        : t('updates.summary.downloading');
    case 'downloaded':
      return t('updates.summary.downloaded', { version: state.availableVersion ?? 'unknown' });
    case 'up-to-date':
      return state.manualDownloadOnly
        ? t('updates.summary.up_to_date_manual')
        : t('updates.summary.up_to_date');
    case 'installing':
      return t('updates.summary.installing');
    case 'error':
      return state.message ?? t('updates.summary.error');
    default:
      return state.manualDownloadOnly
        ? state.message ?? t('updates.summary.idle_manual')
        : t('updates.summary.idle');
  }
}

function getThemeDescription(theme: AppTheme, t: ReturnType<typeof useI18n>['t']) {
  if (theme.kind === 'preset') {
    return t(`theme.preset.${theme.id}.description`);
  }

  return theme.description;
}

function getThemeKindLabel(theme: AppTheme, active: boolean, t: ReturnType<typeof useI18n>['t']) {
  if (active) {
    return t('appearance.active');
  }

  return theme.kind === 'custom' ? t('appearance.custom') : t('appearance.preset');
}

type SettingsSectionId = 'updates' | 'executionProfile' | 'platformRules' | 'appearance' | 'language';

function SettingsSection({
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
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 pl-2">
          {badge}
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground">
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
              'pt-4 transition-transform duration-200 ease-out',
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

function ThemeOptionCard({
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

function ThemeTokenEditor({
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

// ─── App ──────────────────────────────────────────────────────────────────────

export function App() {
  const { locale, setLocale, t } = useI18n();
  const platform = useMemo(detectPlatform, []);
  const sourceModeMeta = useMemo(() => getSourceModeMeta(t), [t]);
  const {
    theme,
    themes,
    setTheme,
    cycleTheme,
    createThemeFromActive,
    createThemeFromId,
    renameCustomTheme,
    updateCustomThemeToken,
    deleteCustomTheme,
  } = useThemeManager();

  const [sources, setSources] = useState<SourceSelection[]>([]);
  const [sourceMode, setSourceMode] = useState<SourceMode>('picked_files');
  const [fileNamePattern, setFileNamePattern] = useState('');
  const [rules, setRules] = useState<RenameRule[]>([]);
  const [preview, setPreview] = useState<PreviewResult>(DEFAULT_PREVIEW);
  const [statusFilters, setStatusFilters] = useState<StatusFilter[]>([...STATUS_OPTIONS]);
  const [busy, setBusy] = useState<'idle' | 'preview' | 'execute' | 'undo'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [presetDrawerOpen, setPresetDrawerOpen] = useState(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);
  const [addSourcesOpen, setAddSourcesOpen] = useState(false);
  const [openSettingsSection, setOpenSettingsSection] = useState<SettingsSectionId | null>(null);
  const [presetName, setPresetName] = useState('');
  const [presetSearch, setPresetSearch] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(null);
  const [draftSourceMode, setDraftSourceMode] = useState<SourceMode>(sourceMode);
  const [draftFileNamePattern, setDraftFileNamePattern] = useState(fileNamePattern);
  const [pendingSourcePick, setPendingSourcePick] = useState<{
    mode: SourceMode;
    fileNamePattern: string;
  } | null>(null);
  const [pendingDroppedSources, setPendingDroppedSources] = useState<SourceSelection[] | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [windowState, setWindowState] = useState<WindowState>(DEFAULT_WINDOW_STATE);
  const [updateState, setUpdateState] = useState<UpdateState>(DEFAULT_UPDATE_STATE);
  const [updateAction, setUpdateAction] = useState<'idle' | 'checking' | 'installing'>('idle');
  const [updateToast, setUpdateToast] = useState<UpdateToastState | null>(null);

  const [leftWidthRatio, setLeftWidthRatio] = useState(() => {
    const stored = Number(localStorage.getItem(LEFT_WIDTH_STORAGE_KEY));
    const fallbackContainerWidth = Math.max(window.innerWidth - 16, 1);
    if (Number.isFinite(stored)) {
      if (stored > 1) {
        // Migrate older fixed-pixel widths to the new proportional layout.
        return clampLeftWidthRatio(stored / fallbackContainerWidth, fallbackContainerWidth);
      }
      return clampLeftWidthRatio(stored, fallbackContainerWidth);
    }
    return clampLeftWidthRatio(DEFAULT_LEFT_WIDTH_RATIO, fallbackContainerWidth);
  });
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);
  const isResizing = useRef(false);
  const desktopLayoutRef = useRef<HTMLDivElement | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidthRatio = useRef(0);
  const resizeContainerWidth = useRef(0);
  const previousUpdateStatus = useRef<UpdateState['status'] | null>(null);
  const updateToastId = useRef(0);

  const sourcePaths = useMemo(() => sources.map((s) => s.path), [sources]);
  const previewRequest = useMemo(
    () => ({ sourcePaths, sourceMode, fileNamePattern, rules, platform }),
    [fileNamePattern, platform, rules, sourceMode, sourcePaths],
  );

  useEffect(() => { void reloadMetadata(); }, []);

  useEffect(() => {
    if (sources.length === 0) { setPreview(DEFAULT_PREVIEW); return; }
    const t = window.setTimeout(() => { void refreshPreview(); }, 180);
    return () => window.clearTimeout(t);
  }, [previewRequest, sources.length]);

  useEffect(() => {
    if (addSourcesOpen || !pendingSourcePick) {
      return;
    }

    const nextPick = pendingSourcePick;
    setPendingSourcePick(null);

    void (async () => {
      try {
        setError(null);
        setSourceMode(nextPick.mode);
        setFileNamePattern(nextPick.fileNamePattern);
        const picked = await window.advancedRenamer.pickSources({ mode: nextPick.mode });
        setSources(sortSourceSelections(picked));
      } catch (err) {
        setError(err instanceof Error ? err.message : t('error.source_picker'));
      }
    })();
  }, [addSourcesOpen, pendingSourcePick, t]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const mqHandler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', mqHandler);

    function onMouseMove(e: MouseEvent) {
      if (!isResizing.current) return;
      const containerWidth = resizeContainerWidth.current;
      if (containerWidth <= 0) return;
      const deltaRatio = (e.clientX - resizeStartX.current) / containerWidth;
      setLeftWidthRatio(clampLeftWidthRatio(resizeStartWidthRatio.current + deltaRatio, containerWidth));
    }
    function onMouseUp() { isResizing.current = false; }
    function onWindowResize() {
      const containerWidth = desktopLayoutRef.current?.getBoundingClientRect().width ?? window.innerWidth;
      setLeftWidthRatio((current) => clampLeftWidthRatio(current, containerWidth));
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('resize', onWindowResize);

    return () => {
      mq.removeEventListener('change', mqHandler);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', onWindowResize);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(LEFT_WIDTH_STORAGE_KEY, String(leftWidthRatio));
  }, [leftWidthRatio]);

  useEffect(() => {
    let mounted = true;

    void window.advancedRenamer.getWindowState().then((state) => {
      if (mounted) {
        setWindowState(state);
      }
    });

    const unsubscribe = window.advancedRenamer.onWindowStateChanged((state) => {
      setWindowState(state);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const handleUpdateStateChange = (state: UpdateState, notify: boolean) => {
      previousUpdateStatus.current = state.status;
      setUpdateState(state);
      setUpdateAction((current) => {
        if (state.status === 'checking') {
          return current === 'installing' ? current : 'checking';
        }
        if (state.status === 'installing') {
          return 'installing';
        }
        return 'idle';
      });

      if (!notify) {
        return;
      }

      if (state.status === 'available') {
        showUpdateToast({
          tone: 'accent',
          title: t('toast.update_found.title'),
          description: state.manualDownloadOnly
            ? t('toast.update_found.description_manual', { version: state.availableVersion ?? 'unknown' })
            : t('toast.update_found.description_auto', { version: state.availableVersion ?? 'unknown' }),
          actionLabel: state.manualDownloadOnly ? t('updates.download') : t('toast.open_settings'),
          actionKind: state.manualDownloadOnly ? 'download-update' : 'open-settings',
        });
      }

      if (state.status === 'downloaded') {
        showUpdateToast({
          tone: 'ok',
          title: t('toast.update_ready.title'),
          description: t('toast.update_ready.description', { version: state.availableVersion ?? 'unknown' }),
          actionLabel: t('toast.restart_now'),
          actionKind: 'install-update',
        });
      }

      if (state.status === 'error') {
        showUpdateToast({
          tone: 'conflict',
          title: t('toast.update_failed.title'),
          description: state.message ?? t('updates.summary.error'),
          actionLabel: t('toast.open_settings'),
          actionKind: 'open-settings',
        });
      }
    };

    void window.advancedRenamer.getUpdateState().then((state) => {
      if (!mounted) {
        return;
      }
      previousUpdateStatus.current = state.status;
      setUpdateState(state);
    });

    const unsubscribe = window.advancedRenamer.onUpdateStateChanged((state) => {
      if (!mounted) {
        return;
      }

      const shouldNotify =
        state.status !== previousUpdateStatus.current &&
        (state.status === 'available' || state.status === 'downloaded' || state.status === 'error');

      handleUpdateStateChange(state, shouldNotify);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [t]);

  async function reloadMetadata() {
    const [presetList, historyList] = await Promise.all([
      window.advancedRenamer.listPresets(),
      window.advancedRenamer.listHistory(),
    ]);
    setPresets(presetList);
    setHistory(historyList);
  }

  function showUpdateToast(input: Omit<UpdateToastState, 'id' | 'open'>) {
    updateToastId.current += 1;
    setUpdateToast({
      id: updateToastId.current,
      open: true,
      ...input,
    });
  }

  function openAddSources() {
    setPendingDroppedSources(null);
    setDraftSourceMode(sourceMode);
    setDraftFileNamePattern(fileNamePattern);
    setAddSourcesOpen(true);
  }

  async function checkForUpdates() {
    setUpdateAction('checking');
    try {
      const nextState = await window.advancedRenamer.checkForUpdates();
      setUpdateState(nextState);
    } finally {
      setUpdateAction((current) => (current === 'checking' ? 'idle' : current));
    }
  }

  async function installUpdate() {
    setUpdateAction('installing');
    const started = await window.advancedRenamer.quitAndInstallUpdate();
    if (!started) {
      setUpdateAction('idle');
    }
  }

  async function openUpdateDownload() {
    setUpdateAction('installing');
    try {
      await window.advancedRenamer.openUpdateDownload();
    } finally {
      setUpdateAction('idle');
    }
  }

  function handleUpdateToastAction(actionKind?: UpdateToastState['actionKind']) {
    if (!actionKind) {
      return;
    }

    if (actionKind === 'open-settings') {
      setSettingsDrawerOpen(true);
      setUpdateToast((current) => (current ? { ...current, open: false } : current));
      return;
    }

    if (actionKind === 'download-update') {
      setUpdateToast((current) => (current ? { ...current, open: false } : current));
      void openUpdateDownload();
      return;
    }

    void installUpdate();
  }

  function toggleSettingsSection(section: SettingsSectionId) {
    setOpenSettingsSection((current) => (current === section ? null : section));
  }

  function clearSources() {
    setSources([]);
    setPreview(DEFAULT_PREVIEW);
    setError(null);
    setPendingSourcePick(null);
  }

  function chooseSourcesFromDialog() {
    if (pendingDroppedSources) {
      const nextSources =
        draftSourceMode === 'picked_files'
          ? pendingDroppedSources.filter((source) => !source.isDirectory)
          : draftSourceMode === 'picked_folders'
            ? pendingDroppedSources.filter((source) => source.isDirectory)
            : pendingDroppedSources.filter((source) => source.isDirectory);

      if (nextSources.length === 0) {
        setError(t('error.dropped_mode'));
        return;
      }

      setError(null);
      setSourceMode(draftSourceMode);
      setFileNamePattern(draftFileNamePattern);
      setSources(sortSourceSelections(nextSources));
      setPendingDroppedSources(null);
      setAddSourcesOpen(false);
      return;
    }

    setPendingSourcePick({
      mode: draftSourceMode,
      fileNamePattern: draftFileNamePattern,
    });
    setAddSourcesOpen(false);
  }

  function handleDraftSourceModeChange(nextMode: SourceMode) {
    setDraftSourceMode(nextMode);
    if (!sourceModeMeta[nextMode].supportsFilter) {
      setDraftFileNamePattern('');
    }
  }

  function removeSourceFromDialog(sourcePath: string) {
    if (pendingDroppedSources) {
      const nextSources = sortSourceSelections(
        pendingDroppedSources.filter((source) => source.path !== sourcePath),
      );
      setPendingDroppedSources(nextSources);

      const availableModes = getAvailableSourceModes(nextSources);
      if (availableModes.length === 0) {
        setAddSourcesOpen(false);
        return;
      }

      if (!availableModes.includes(draftSourceMode)) {
        const nextMode = availableModes.includes('files_recursive')
          ? 'files_recursive'
          : availableModes[0];
        setDraftSourceMode(nextMode);
        if (!sourceModeMeta[nextMode].supportsFilter) {
          setDraftFileNamePattern('');
        }
      }
      return;
    }

    setSources((current) => sortSourceSelections(current.filter((source) => source.path !== sourcePath)));
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);

    if (!isFileDropEvent(event)) {
      return;
    }

    const droppedPaths = window.advancedRenamer.getDroppedPaths(
      Array.from(event.dataTransfer.files),
    );

    if (droppedPaths.length === 0) {
      setError(t('error.dropped_paths'));
      return;
    }

    try {
      setError(null);
      const resolved = await window.advancedRenamer.resolveSources(droppedPaths);
      const hasDirectories = resolved.some((source) => source.isDirectory);

      if (!hasDirectories) {
        setSourceMode('picked_files');
        setFileNamePattern('');
        setSources(sortSourceSelections(resolved));
        return;
      }

      const availableModes = getAvailableSourceModes(resolved);
      const nextDefaultMode = availableModes.includes(sourceMode)
        ? sourceMode
        : availableModes.includes('picked_folders')
          ? 'picked_folders'
        : availableModes.includes('files_recursive')
          ? 'files_recursive'
          : availableModes[0];

      setPendingDroppedSources(sortSourceSelections(resolved));
      setDraftSourceMode(nextDefaultMode);
      setDraftFileNamePattern('');
      setAddSourcesOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error.read_dropped'));
    }
  }

  async function refreshPreview() {
    if (previewRequest.sourcePaths.length === 0) return;
    setBusy('preview');
    setError(null);
    try {
      const next = await window.advancedRenamer.generatePreview(previewRequest);
      startTransition(() => setPreview(next));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error.generate_preview'));
    } finally {
      setBusy('idle');
    }
  }

  async function executeRename() {
    setBusy('execute');
    setError(null);
    try {
      const result = await window.advancedRenamer.executeRenameBatch(previewRequest);
      if (result.errors.length > 0) setError(result.errors.join(' '));
      if (result.renamedCount > 0 && result.errors.length === 0) {
        clearSources();
      } else {
        setPreview(result);
      }
      await reloadMetadata();
    } finally {
      setBusy('idle');
    }
  }

  async function undoLast(batchId: number) {
    setBusy('undo');
    setError(null);
    try {
      const result = await window.advancedRenamer.undoRenameBatch({ batchId });
      if (!result.success && result.errors.length > 0) setError(result.errors.join(' '));
      await reloadMetadata();
      await refreshPreview();
    } finally {
      setBusy('idle');
    }
  }

  async function savePreset() {
    if (!presetName.trim()) { setError(t('error.preset_name_required')); return; }
    await window.advancedRenamer.savePreset({ id: selectedPresetId ?? undefined, name: presetName.trim(), rules });
    setPresetName('');
    setSelectedPresetId(null);
    await reloadMetadata();
  }

  const lastUndoable = history.find((e) => e.canUndo);
  const filteredRows = preview.rows.filter((row) => statusFilters.includes(row.status));
  const filteredPresets = presets.filter((preset) => {
    const needle = presetSearch.trim().toLowerCase();
    if (!needle) {
      return true;
    }

    return preset.name.toLowerCase().includes(needle);
  });
  const availableDraftModes = pendingDroppedSources
    ? getAvailableSourceModes(pendingDroppedSources)
    : SOURCE_MODE_OPTIONS;
  const sourceDialogItems = pendingDroppedSources ?? sources;
  const sourceDialogTitle = pendingDroppedSources ? t('sources.add.dropped_title') : t('sources.add.title');
  const sourceDialogDescription = pendingDroppedSources
    ? t('sources.add.dropped_description')
    : t('sources.add.description');
  const sourceDialogButtonLabel = pendingDroppedSources
    ? t('sources.add.dropped_title')
    : sourceModeMeta[draftSourceMode].pickerLabel;
  const sourceDialogRootCount = pendingDroppedSources?.length ?? sources.length;
  const activeCustomTheme = theme.kind === 'custom' ? theme : null;

  return (
    <div
      className={cn(
        'h-screen overflow-hidden text-foreground',
        !windowState.isMaximized && 'p-2',
      )}
      onDragOver={(event) => {
        if (!isFileDropEvent(event)) {
          return;
        }
        event.preventDefault();
        if (!dragActive) {
          setDragActive(true);
        }
      }}
      onDragLeave={(event) => {
        if (!isFileDropEvent(event)) {
          return;
        }
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
          return;
        }
        setDragActive(false);
      }}
      onDrop={(event) => void handleDrop(event)}
    >
      <div
        className={cn(
          'flex h-full flex-col',
          !windowState.isMaximized && 'mx-auto max-w-[1800px]',
        )}
      >

        {/* Top bar */}
        <div className="shrink-0 pb-2">
          <TopBar
            platform={platform}
            theme={theme}
            themes={themes}
            windowState={windowState}
            sourceCount={sources.length}
            selectedLabel={getSelectedLabel(sources, t)}
            preview={preview}
            busy={busy}
            error={error}
            undoDisabled={!lastUndoable || busy !== 'idle'}
            t={t}
            onOpenAddSources={openAddSources}
            onClearSources={clearSources}
            onRefresh={refreshPreview}
            onExecute={executeRename}
            onUndo={() => lastUndoable && void undoLast(lastUndoable.id)}
            onOpenPresets={() => setPresetDrawerOpen(true)}
            onOpenHistory={() => setHistoryDrawerOpen(true)}
            onOpenSettings={() => setSettingsDrawerOpen(true)}
            onSelectTheme={setTheme}
            onMinimizeWindow={() => void window.advancedRenamer.minimizeWindow()}
            onToggleMaximizeWindow={() =>
              void window.advancedRenamer.toggleMaximizeWindow().then(setWindowState)
            }
            onCloseWindow={() => void window.advancedRenamer.closeWindow()}
          />
        </div>

        {/* Separator */}
        <div className="shrink-0 border-t border-border mb-2" />

        {/* Main panels */}
        <div ref={desktopLayoutRef} className="flex min-h-0 flex-1 flex-col gap-3 sm:gap-4 lg:flex-row lg:gap-0">
          <div
            className="h-full lg:shrink-0"
            style={isDesktop ? { width: `${leftWidthRatio * 100}%` } : undefined}
          >
            <RulesPanel
              rules={rules}
              onAddRule={(type) => setRules((cur) => [...cur, createRule(type)])}
              onUpdateRule={(ruleId, updater) =>
                setRules((cur) => cur.map((r) => (r.id === ruleId ? updater(r) : r)))
              }
              onMoveRule={(ruleId, dir) => setRules((cur) => moveRule(cur, ruleId, dir))}
              onReorderRule={(draggedRuleId, targetRuleId) =>
                setRules((cur) => reorderRule(cur, draggedRuleId, targetRuleId))
              }
              onDeleteRule={(ruleId) => setRules((cur) => cur.filter((r) => r.id !== ruleId))}
            />
          </div>

          {isDesktop && (
            <div
              className="flex h-full w-3 shrink-0 cursor-col-resize select-none items-center justify-center group"
              onMouseDown={(e) => {
                const containerWidth =
                  desktopLayoutRef.current?.getBoundingClientRect().width ?? window.innerWidth;
                isResizing.current = true;
                resizeStartX.current = e.clientX;
                resizeStartWidthRatio.current = leftWidthRatio;
                resizeContainerWidth.current = containerWidth;
                e.preventDefault();
              }}
            >
              <div className="h-full w-px bg-border transition-colors duration-150 group-hover:bg-accent" />
            </div>
          )}

          <div className="h-full min-w-0 flex-1">
            <PreviewPanel
              preview={preview}
              rows={filteredRows}
              statusFilters={statusFilters}
              onToggleFilter={(status) =>
                setStatusFilters((cur) =>
                  cur.includes(status) ? cur.filter((s) => s !== status) : [...cur, status],
                )
              }
            />
          </div>
        </div>
      </div>

      {dragActive && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-accent/10 backdrop-blur-[2px]">
          <div className="rounded-2xl border border-accent/40 bg-card/95 px-8 py-6 text-center shadow-2xl">
            <div className="text-sm font-semibold text-foreground">{t('app.drop.title')}</div>
            <div className="mt-2 text-xs text-muted-foreground">{t('app.drop.description')}</div>
          </div>
        </div>
      )}

      <Modal
        open={addSourcesOpen}
        onOpenChange={(open) => {
          setAddSourcesOpen(open);
          if (!open) {
            setPendingDroppedSources(null);
          }
        }}
        title={sourceDialogTitle}
        description={sourceDialogDescription}
      >
        <div className="space-y-5 p-5">
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t('sources.set')}
              </label>
              <Select
                value={draftSourceMode}
                onValueChange={(value) => handleDraftSourceModeChange(value as SourceMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableDraftModes.includes('picked_folders') && (
                    <SelectItem value="picked_folders">{sourceModeMeta.picked_folders.label}</SelectItem>
                  )}
                  {availableDraftModes.includes('picked_files') && (
                    <SelectItem value="picked_files">{sourceModeMeta.picked_files.label}</SelectItem>
                  )}
                  {availableDraftModes.includes('top_level_folders') && (
                    <SelectItem value="top_level_folders">{sourceModeMeta.top_level_folders.label}</SelectItem>
                  )}
                  {availableDraftModes.includes('subfolders') && (
                    <SelectItem value="subfolders">{sourceModeMeta.subfolders.label}</SelectItem>
                  )}
                  {availableDraftModes.includes('top_level_files') && (
                    <SelectItem value="top_level_files">{sourceModeMeta.top_level_files.label}</SelectItem>
                  )}
                  {availableDraftModes.includes('files_recursive') && (
                    <SelectItem value="files_recursive">{sourceModeMeta.files_recursive.label}</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{sourceModeMeta[draftSourceMode].detail}</p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t('sources.filter')}
              </label>
              <Input
                value={draftFileNamePattern}
                onChange={(e) => setDraftFileNamePattern(e.target.value)}
                placeholder={t('sources.filter.placeholder')}
                disabled={!sourceModeMeta[draftSourceMode].supportsFilter}
              />
              <p className="text-xs text-muted-foreground">
                {sourceModeMeta[draftSourceMode].supportsFilter
                  ? t('sources.filter.help_supported')
                  : t('sources.filter.help_unsupported')}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm font-semibold text-foreground">
              {pendingDroppedSources ? t('sources.dropped') : t('sources.current')}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge dot tone="accent">{sourceModeMeta[draftSourceMode].label}</Badge>
              {draftFileNamePattern ? <Badge dot>{draftFileNamePattern}</Badge> : null}
              <Badge dot>{t('sources.roots', { count: sourceDialogRootCount })}</Badge>
            </div>
            {sourceDialogItems.length > 0 && (
              <div className="mt-3 max-h-40 space-y-2 overflow-y-auto">
                {sourceDialogItems.map((source) => (
                  <div
                    key={source.path}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-card/70 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{source.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{source.path}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={source.isDirectory ? 'accent' : 'default'}>
                        {source.isDirectory ? t('sources.folder') : t('sources.file')}
                      </Badge>
                      <IconButton
                        className="h-7 w-7"
                        onClick={() => removeSourceFromDialog(source.path)}
                        aria-label={t('sources.remove', { name: source.name })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setAddSourcesOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void chooseSourcesFromDialog()}>
              <FileInput className="h-3.5 w-3.5" />
              {sourceDialogButtonLabel}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Presets drawer */}
      <Drawer
        open={presetDrawerOpen}
        onOpenChange={setPresetDrawerOpen}
        title={t('presets.title')}
        description={t('presets.description')}
      >
        <div className="space-y-6 p-5">
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm font-semibold text-foreground">{t('presets.save_stack')}</p>
            <div className="mt-3 space-y-3">
              <Input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder={t('presets.name.placeholder')}
              />
              <div className="flex gap-2">
                <Button onClick={() => void savePreset()}>
                  <Save className="h-3.5 w-3.5" />
                  {t('presets.save')}
                </Button>
                {selectedPresetId && (
                  <Button variant="secondary" onClick={() => setSelectedPresetId(null)}>
                    {t('presets.clear_target')}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">{t('presets.library')}</p>
              <div className="w-full sm:w-64">
                <Input
                  value={presetSearch}
                  onChange={(e) => setPresetSearch(e.target.value)}
                  placeholder={t('presets.search.placeholder')}
                />
              </div>
            </div>
            <PresetList
              presets={filteredPresets}
              onLoad={(p) => {
                setRules(p.rules);
                setPresetDrawerOpen(false);
              }}
              onEdit={(p) => {
                setPresetName(p.name);
                setSelectedPresetId(p.id);
              }}
              onDelete={(p) => void window.advancedRenamer.deletePreset(p.id).then(reloadMetadata)}
              emptyMessage={presetSearch.trim() ? t('presets.empty_search') : t('presets.empty')}
            />
          </div>
        </div>
      </Drawer>

      {/* History drawer */}
      <Drawer
        open={historyDrawerOpen}
        onOpenChange={setHistoryDrawerOpen}
        title={t('history.title')}
        description={t('history.description')}
      >
        <div className="space-y-3 p-5">
          {history.length === 0 && <EmptyState message={t('history.empty')} />}
          {history.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{t('history.batch', { id: entry.id })}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleString(locale)}
                  </p>
                </div>
                <Badge
                  tone={
                    entry.undoState === 'ready'
                      ? 'ok'
                      : entry.undoState === 'archived'
                        ? 'unchanged'
                        : 'conflict'
                  }
                  dot
                >
                  {getUndoStatusLabel(entry, t)}
                </Badge>
              </div>
              <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                <span>{t('history.renamed', { count: entry.renamedCount })}</span>
                <span>{t('history.blocked', { count: entry.previewSummary.conflict + entry.previewSummary.invalid })}</span>
              </div>
              {entry.undoReason && entry.undoState !== 'ready' && entry.undoState !== 'archived' && (
                <p className="mt-3 text-xs text-conflict">{entry.undoReason}</p>
              )}
              {entry.rules.length === 0 && (
                <p className="mt-3 text-xs text-muted-foreground">{t('history.no_template')}</p>
              )}
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={entry.rules.length === 0}
                  onClick={() => setRules(entry.rules)}
                >
                  {t('history.reuse')}
                </Button>
                <Button
                  size="sm"
                  disabled={!entry.canUndo || busy !== 'idle'}
                  onClick={() => void undoLast(entry.id)}
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  {t('history.undo')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Drawer>

      {/* Settings drawer */}
      <Drawer
        open={settingsDrawerOpen}
        onOpenChange={setSettingsDrawerOpen}
        title={t('settings.title')}
        description={t('settings.description')}
      >
        <div className="space-y-3 p-5">
          <SettingsSection
            title={t('settings.updates')}
            badge={(
              <Badge tone={getUpdateTone(updateState.status)} dot>
                {getUpdateStatusLabel(updateState.status, t)}
              </Badge>
            )}
            open={openSettingsSection === 'updates'}
            onToggle={() => toggleSettingsSection('updates')}
          >
            <p className="text-xs text-muted-foreground">{getUpdateSummary(updateState, t)}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Badge>{t('updates.current', { version: updateState.currentVersion })}</Badge>
              {updateState.availableVersion && updateState.availableVersion !== updateState.currentVersion && (
                <Badge tone="accent">{t('updates.latest', { version: updateState.availableVersion })}</Badge>
              )}
              {updateState.checkedAt && (
                <Badge tone="unchanged">
                  {t('updates.checked', { date: new Date(updateState.checkedAt).toLocaleString(locale) })}
                </Badge>
              )}
            </div>

            {updateState.progress && updateState.status === 'downloading' && (
              <div className="mt-3">
                <div className="h-2 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-300"
                    style={{ width: `${Math.max(4, Math.min(100, updateState.progress.percent))}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {t('updates.speed', {
                    percent: updateState.progress.percent.toFixed(0),
                    speed: formatBytes(updateState.progress.bytesPerSecond),
                  })}
                </p>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={updateAction !== 'idle' || updateState.status === 'disabled'}
                onClick={() => void checkForUpdates()}
              >
                <RefreshCcw className={cn('h-3.5 w-3.5', updateAction === 'checking' && 'animate-spin')} />
                {t('updates.check_now')}
              </Button>
              <Button
                size="sm"
                disabled={
                  updateState.manualDownloadOnly
                    ? updateState.status !== 'available' || updateAction === 'installing'
                    : updateState.status !== 'downloaded' || updateAction === 'installing'
                }
                onClick={() => void (updateState.manualDownloadOnly ? openUpdateDownload() : installUpdate())}
              >
                {updateState.manualDownloadOnly ? (
                  <ExternalLink className="h-3.5 w-3.5" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                {updateState.manualDownloadOnly ? t('updates.download') : t('updates.restart_install')}
              </Button>
            </div>
          </SettingsSection>
          <SettingsSection
            title={t('settings.language')}
            badge={<Badge tone="accent">{AVAILABLE_LOCALES.find((option) => option.code === locale)?.nativeLabel ?? locale}</Badge>}
            open={openSettingsSection === 'language'}
            onToggle={() => toggleSettingsSection('language')}
          >
            <div className="rounded-xl border border-border bg-card p-3">
              <label className="space-y-2">
                <span className="text-xs text-muted-foreground">{t('locale.label')}</span>
                <Select value={locale} onValueChange={(value) => setLocale(value as AppLocale)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_LOCALES.map((option) => (
                      <SelectItem key={option.code} value={option.code}>
                        {option.nativeLabel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t('locale.helper')}</p>
              </label>
            </div>
          </SettingsSection>
          <SettingsSection
            title={t('settings.appearance')}
            badge={<Badge tone="accent">{theme.name}</Badge>}
            open={openSettingsSection === 'appearance'}
            onToggle={() => toggleSettingsSection('appearance')}
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card p-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{t('updates.theme_library')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('updates.theme_library_help')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={cycleTheme}>
                    <Palette className="h-3.5 w-3.5" />
                    {t('appearance.cycle')}
                  </Button>
                  <Button size="sm" onClick={createThemeFromActive}>
                    <Plus className="h-3.5 w-3.5" />
                    {t('appearance.new_custom')}
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                {themes.map((candidate) => (
                  <ThemeOptionCard
                    key={candidate.id}
                    theme={candidate}
                    active={candidate.id === theme.id}
                    onSelect={() => setTheme(candidate.id)}
                    onDuplicate={() => createThemeFromId(candidate.id)}
                  />
                ))}
              </div>

              {activeCustomTheme ? (
                <div className="space-y-4 rounded-xl border border-border bg-surface/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{t('appearance.edit_custom')}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{t('appearance.edit_help')}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => deleteCustomTheme(activeCustomTheme.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t('appearance.delete_custom')}
                    </Button>
                  </div>

                  <label className="space-y-2">
                    <span className="text-xs text-muted-foreground">{t('appearance.theme_name')}</span>
                    <Input
                      value={activeCustomTheme.name}
                      onChange={(event) => renameCustomTheme(activeCustomTheme.id, event.target.value)}
                      onBlur={(event) => {
                        const nextName = event.target.value.trim() || t('appearance.theme_name_placeholder');
                        if (nextName !== activeCustomTheme.name) {
                          renameCustomTheme(activeCustomTheme.id, nextName);
                        }
                      }}
                      placeholder={t('appearance.theme_name_placeholder')}
                    />
                  </label>

                  <div className="grid gap-3 lg:grid-cols-2">
                    {THEME_TOKEN_FIELDS.map((field) => (
                      <ThemeTokenEditor
                        key={field.key}
                        label={t(`theme.token.${field.key}.label`)}
                        description={t(`theme.token.${field.key}.description`)}
                        value={activeCustomTheme.tokens[field.key]}
                        onChange={(value) => updateCustomThemeToken(activeCustomTheme.id, field.key, value)}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-card/70 p-4">
                  <p className="text-sm font-semibold text-foreground">{t('appearance.editor_title')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t('appearance.editor_help')}</p>
                </div>
              )}
            </div>
          </SettingsSection>
          <SettingsSection
            title={t('settings.platform_rules')}
            open={openSettingsSection === 'platformRules'}
            onToggle={() => toggleSettingsSection('platformRules')}
          >
            <p className="text-xs text-muted-foreground">{t('platform_rules.description', { platform })}</p>
          </SettingsSection>
          <SettingsSection
            title={t('settings.execution_profile')}
            open={openSettingsSection === 'executionProfile'}
            onToggle={() => toggleSettingsSection('executionProfile')}
          >
            <p className="text-xs text-muted-foreground">{t('execution_profile.description')}</p>
          </SettingsSection>
        </div>
      </Drawer>

      <ToastProvider swipeDirection="right">
        {updateToast && (
          <Toast
            key={updateToast.id}
            open={updateToast.open}
            onOpenChange={(open) => {
              setUpdateToast((current) => (current ? { ...current, open } : current));
            }}
            tone={updateToast.tone}
            duration={updateToast.actionKind === 'install-update' ? 12000 : 7000}
          >
            <div className="pr-8">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    updateToast.tone === 'ok' && 'bg-ok/15 text-ok',
                    updateToast.tone === 'accent' && 'bg-accent/15 text-accent',
                    updateToast.tone === 'conflict' && 'bg-conflict/15 text-conflict',
                    updateToast.tone === 'default' && 'bg-surface text-foreground',
                  )}
                >
                  {updateToast.tone === 'ok' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : updateToast.tone === 'conflict' ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : updateToast.actionKind === 'install-update' ? (
                    <Download className="h-4 w-4" />
                  ) : (
                    <Info className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <ToastTitle>{updateToast.title}</ToastTitle>
                  <ToastDescription>{updateToast.description}</ToastDescription>
                </div>
              </div>
              {updateToast.actionLabel && (
                <div className="mt-3 flex justify-end">
                  <ToastAction
                    altText={updateToast.actionLabel}
                    onClick={() => handleUpdateToastAction(updateToast.actionKind)}
                  >
                    {updateToast.actionLabel}
                  </ToastAction>
                </div>
              )}
            </div>
            <ToastClose />
          </Toast>
        )}
        <ToastViewport />
      </ToastProvider>
    </div>
  );
}

// ─── TopBar ───────────────────────────────────────────────────────────────────

function TopBar({
  platform,
  theme,
  themes,
  windowState,
  sourceCount,
  selectedLabel,
  preview,
  busy,
  error,
  undoDisabled,
  t,
  onOpenAddSources,
  onClearSources,
  onRefresh,
  onExecute,
  onUndo,
  onOpenPresets,
  onOpenHistory,
  onOpenSettings,
  onSelectTheme,
  onMinimizeWindow,
  onToggleMaximizeWindow,
  onCloseWindow,
}: {
  platform: PlatformTarget;
  theme: AppTheme;
  themes: AppTheme[];
  windowState: WindowState;
  sourceCount: number;
  selectedLabel: string;
  preview: PreviewResult;
  busy: 'idle' | 'preview' | 'execute' | 'undo';
  error: string | null;
  undoDisabled: boolean;
  t: ReturnType<typeof useI18n>['t'];
  onOpenAddSources: () => void;
  onClearSources: () => void;
  onRefresh: () => void;
  onExecute: () => void;
  onUndo: () => void;
  onOpenPresets: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onSelectTheme: (themeId: string) => void;
  onMinimizeWindow: () => void;
  onToggleMaximizeWindow: () => void;
  onCloseWindow: () => void;
}) {
  const isMac = platform === 'darwin';
  const topBarGhostButtonClassName =
    'border border-transparent hover:border-accent/30 hover:bg-surface-elevated hover:text-foreground';

  return (
    <Panel className="overflow-visible">
      {/* Main row */}
      <div className="app-drag flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:px-5">
        {/* Brand */}
        <div className={cn('mr-1 flex items-center gap-2.5', isMac && 'pl-16 sm:pl-18')}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <FileCode className="h-4 w-4" />
          </div>
          <div className="leading-none">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Fast Renamer
            </p>
            <p className="text-[10px] text-muted-foreground/50 hidden sm:block">
              {t('topbar.tagline', { version: APP_VERSION })}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-border hidden sm:block" />

        {/* Source + nav buttons */}
        <div className="app-no-drag flex flex-wrap items-center gap-2">
          <Button variant="default" size="sm" onClick={onOpenAddSources}>
            <FileInput className="h-3.5 w-3.5" />
            {t('topbar.add')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={topBarGhostButtonClassName}
            onClick={onClearSources}
            disabled={sourceCount === 0}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t('topbar.clear')}
          </Button>
          <Button variant="ghost" size="sm" className={topBarGhostButtonClassName} onClick={onOpenPresets}>
            <Save className="h-3.5 w-3.5" />
            {t('topbar.presets')}
          </Button>
          <Button variant="ghost" size="sm" className={topBarGhostButtonClassName} onClick={onOpenHistory}>
            <Clock3 className="h-3.5 w-3.5" />
            {t('topbar.history')}
          </Button>
          <Button variant="ghost" size="sm" className={topBarGhostButtonClassName} onClick={onOpenSettings}>
            <Settings2 className="h-3.5 w-3.5" />
            {t('topbar.settings')}
          </Button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action buttons */}
        <div className="app-no-drag flex items-center gap-1.5">
          <Tooltip content={t('topbar.refresh_preview')}>
            <IconButton
              disabled={busy !== 'idle' || sourceCount === 0}
              onClick={onRefresh}
              aria-label={t('topbar.refresh_preview')}
            >
              <RefreshCcw
                className={cn('h-4 w-4', busy === 'preview' && 'animate-spin')}
              />
            </IconButton>
          </Tooltip>

          <Tooltip content={t('topbar.undo_last')}>
            <IconButton disabled={undoDisabled} onClick={onUndo} aria-label={t('history.undo')}>
              <Undo2 className={cn('h-4 w-4', busy === 'undo' && 'animate-spin')} />
            </IconButton>
          </Tooltip>

          <div className="h-6 w-px bg-border mx-0.5" />

          <Button
            size="sm"
            disabled={
              busy !== 'idle' || preview.summary.blocked || preview.summary.changed === 0
            }
            onClick={onExecute}
          >
            {t('topbar.rename')}
            {preview.summary.changed > 0 && (
              <span className="ml-0.5 rounded bg-accent-foreground/20 px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums">
                {preview.summary.changed}
              </span>
            )}
          </Button>

          <div className="h-6 w-px bg-border mx-0.5" />

          <DropdownMenuRoot>
            <DropdownMenuTrigger asChild>
              <IconButton aria-label={t('topbar.choose_theme_aria', { themeName: theme.name })}>
                <Palette className="h-4 w-4" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              <DropdownMenuLabel>{t('topbar.themes')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {themes.map((candidate) => (
                <DropdownMenuItem key={candidate.id} onClick={() => onSelectTheme(candidate.id)}>
                  <span
                    className="h-3 w-3 rounded-full border border-border"
                    style={{ backgroundColor: candidate.tokens.accent }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{candidate.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {candidate.kind === 'custom' ? t('topbar.theme_custom') : t('topbar.theme_preset')}
                    </div>
                  </div>
                  {candidate.id === theme.id && <CheckCircle2 className="h-4 w-4 text-accent" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenuRoot>

          {!isMac && (
            <>
              <div className="h-6 w-px bg-border mx-0.5" />

              <div className="flex items-center gap-1">
                <Tooltip content={t('topbar.minimize')}>
                  <IconButton
                    className="h-8 w-8 rounded-lg hover:bg-surface-elevated"
                    onClick={onMinimizeWindow}
                    aria-label={t('topbar.minimize_window')}
                  >
                    <Minus className="h-4 w-4" />
                  </IconButton>
                </Tooltip>
                <Tooltip content={windowState.isMaximized ? t('topbar.restore_down') : t('topbar.maximize')}>
                  <IconButton
                    className="h-8 w-8 rounded-lg hover:bg-surface-elevated"
                    onClick={onToggleMaximizeWindow}
                    aria-label={windowState.isMaximized ? t('topbar.restore_window') : t('topbar.maximize_window')}
                  >
                    {windowState.isMaximized ? (
                      <Copy className="h-3.5 w-3.5" />
                    ) : (
                      <Square className="h-3.5 w-3.5" />
                    )}
                  </IconButton>
                </Tooltip>
                <Tooltip content={t('topbar.close')}>
                  <IconButton
                    className="h-8 w-8 rounded-lg hover:bg-destructive/90 hover:text-white"
                    onClick={onCloseWindow}
                    aria-label={t('topbar.close_window')}
                  >
                    <X className="h-4 w-4" />
                  </IconButton>
                </Tooltip>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="app-no-drag flex flex-wrap items-center gap-2 border-t border-border bg-surface/40 px-4 py-2 sm:px-5">
        <Badge dot tone="ok">{t('topbar.status.ok', { count: preview.summary.ok })}</Badge>
        <Badge dot tone="conflict">{t('topbar.status.conflicts', { count: preview.summary.conflict })}</Badge>
        <Badge dot tone="invalid">{t('topbar.status.invalid', { count: preview.summary.invalid })}</Badge>
        <Badge dot tone="unchanged">{t('topbar.status.unchanged', { count: preview.summary.unchanged })}</Badge>
        <Badge dot>{selectedLabel}</Badge>

        {busy !== 'idle' && (
          <span className="flex items-center gap-1.5 text-xs text-accent">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            {busy === 'preview' ? t('topbar.busy.preview') : busy === 'execute' ? t('topbar.busy.execute') : t('topbar.busy.undo')}
          </span>
        )}

        {error && (
          <span className="ml-auto text-xs text-conflict">⚠ {error}</span>
        )}
      </div>
    </Panel>
  );
}

// ─── Preview panel ────────────────────────────────────────────────────────────

function PreviewPanel({
  preview,
  rows,
  statusFilters,
  onToggleFilter,
}: {
  preview: PreviewResult;
  rows: PreviewResult['rows'];
  statusFilters: StatusFilter[];
  onToggleFilter: (s: StatusFilter) => void;
}) {
  const { t } = useI18n();
  const statusCounts: Record<StatusFilter, number> = {
    ok: preview.summary.ok,
    conflict: preview.summary.conflict,
    invalid: preview.summary.invalid,
    unchanged: preview.summary.unchanged,
  };

  return (
    <Panel className="h-full">
      <PanelHeader
        title={t('preview.title')}
        detail={t('preview.detail')}
        actions={
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.filter((status) => statusCounts[status] > 0).map((status) => {
              const active = statusFilters.includes(status);
              const toneMap: Record<string, string> = {
                ok: 'text-ok border-ok/30 bg-ok/10',
                conflict: 'text-conflict border-conflict/30 bg-conflict/10',
                invalid: 'text-invalid border-invalid/30 bg-invalid/10',
                unchanged: 'text-unchanged border-unchanged/30 bg-unchanged/10',
              };
              return (
                <button
                  key={status}
                  onClick={() => onToggleFilter(status)}
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-all duration-150',
                    active
                      ? toneMap[status]
                      : 'border-border bg-surface text-muted-foreground hover:border-border/80',
                  )}
                >
                  {status} {statusCounts[status]}
                </button>
              );
            })}
          </div>
        }
      />

      {preview.rows.length === 0 ? (
        <div className="p-4">
          <EmptyState message={t('preview.empty')} />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-[700px] border-collapse text-left text-sm xl:min-w-full">
            <thead className="sticky top-0 z-10 border-b border-border bg-card">
              <tr>
                {[t('preview.column.status'), t('preview.column.original'), t('preview.column.proposed'), t('preview.column.notes')].map((col) => (
                  <th
                    key={col}
                    className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border/40 transition-colors hover:bg-surface/60"
                >
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <Badge dot tone={row.status}>{row.status}</Badge>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {row.originalName}
                  </td>
                  <td
                    className={cn(
                      'px-4 py-2.5 font-mono text-xs font-medium',
                      row.status === 'ok' && 'text-ok',
                      row.status === 'conflict' && 'text-conflict',
                      row.status === 'invalid' && 'text-invalid',
                      row.status === 'unchanged' && 'text-muted-foreground',
                    )}
                  >
                    {row.proposedName}
                  </td>
                  <td className="max-w-xs px-4 py-2.5 text-xs text-muted-foreground truncate">
                    {row.reasons.length > 0
                      ? row.reasons.join(' ')
                      : row.changed
                        ? t('preview.ready')
                        : t('preview.no_change')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

// ─── Rules panel ──────────────────────────────────────────────────────────────

function RulesPanel({
  rules,
  onAddRule,
  onUpdateRule,
  onMoveRule,
  onReorderRule,
  onDeleteRule,
}: {
  rules: RenameRule[];
  onAddRule: (type: RenameRule['type']) => void;
  onUpdateRule: (id: string, updater: (r: RenameRule) => RenameRule) => void;
  onMoveRule: (id: string, dir: 'up' | 'down') => void;
  onReorderRule: (draggedRuleId: string, targetRuleId: string) => void;
  onDeleteRule: (id: string) => void;
}) {
  const { t } = useI18n();
  const ruleMeta = useMemo(() => getRuleMeta(t), [t]);
  const [draggedRuleId, setDraggedRuleId] = useState<string | null>(null);
  const [dropTargetRuleId, setDropTargetRuleId] = useState<string | null>(null);
  const [collapsedRuleIds, setCollapsedRuleIds] = useState<string[]>([]);

  useEffect(() => {
    setCollapsedRuleIds((current) => current.filter((ruleId) => rules.some((rule) => rule.id === ruleId)));
  }, [rules]);

  function toggleRuleCollapsed(ruleId: string) {
    setCollapsedRuleIds((current) =>
      current.includes(ruleId) ? current.filter((id) => id !== ruleId) : [...current, ruleId],
    );
  }

  return (
    <Panel className="h-full">
      <PanelHeader
        title={t('rules.title')}
        detail={t('rules.detail')}
        actions={
          <DropdownMenuRoot>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm">
                <Plus className="h-3.5 w-3.5" />
                {t('rules.add')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t('rules.type')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {RULE_TYPE_ORDER.map((type) => {
                const meta = ruleMeta[type];
                const Icon = meta.icon;
                return (
                  <DropdownMenuItem key={type} onClick={() => onAddRule(type)}>
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded"
                      style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
                    >
                      <Icon className="h-3 w-3" />
                    </span>
                    {meta.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenuRoot>
        }
      />

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4">
        {rules.length === 0 && (
          <EmptyState message={t('rules.empty')} />
        )}
        {rules.map((rule, index) => (
          <RuleCard
            key={rule.id}
            rule={rule}
            index={index}
            dragging={draggedRuleId === rule.id}
            dropTarget={dropTargetRuleId === rule.id}
            collapsed={collapsedRuleIds.includes(rule.id)}
            onUpdate={(updater) => onUpdateRule(rule.id, updater)}
            onMove={(dir) => onMoveRule(rule.id, dir)}
            onToggleCollapsed={() => toggleRuleCollapsed(rule.id)}
            onDragStart={() => {
              setDraggedRuleId(rule.id);
              setDropTargetRuleId(rule.id);
            }}
            onDragEnter={() => {
              if (draggedRuleId && draggedRuleId !== rule.id) {
                setDropTargetRuleId(rule.id);
              }
            }}
            onDragEnd={() => {
              setDraggedRuleId(null);
              setDropTargetRuleId(null);
            }}
            onDrop={() => {
              if (draggedRuleId && draggedRuleId !== rule.id) {
                onReorderRule(draggedRuleId, rule.id);
              }
              setDraggedRuleId(null);
              setDropTargetRuleId(null);
            }}
            onDelete={() => onDeleteRule(rule.id)}
          />
        ))}
      </div>
    </Panel>
  );
}

function RuleCard({
  rule,
  index,
  dragging,
  dropTarget,
  collapsed,
  onUpdate,
  onMove,
  onToggleCollapsed,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDrop,
  onDelete,
}: {
  rule: RenameRule;
  index: number;
  dragging: boolean;
  dropTarget: boolean;
  collapsed: boolean;
  onUpdate: (updater: (r: RenameRule) => RenameRule) => void;
  onMove: (dir: 'up' | 'down') => void;
  onToggleCollapsed: () => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const meta = getRuleMeta(t)[rule.type];
  const Icon = meta.icon;

  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
      className={cn(
        'rounded-xl border bg-surface transition-all duration-150',
        !rule.enabled && 'opacity-50',
        dragging && 'scale-[0.99] opacity-70',
        dropTarget && !dragging && 'border-accent shadow-[0_0_0_1px_rgba(59,130,246,0.35)]',
      )}
      style={{ borderColor: `${meta.color}30`, borderLeftColor: meta.color, borderLeftWidth: '3px' }}
    >
      {/* Card header */}
      <div
        className="grid grid-cols-[auto_1fr_auto] items-center gap-2 px-3.5 py-3"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            onToggleCollapsed();
          }
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1">
            <button
              type="button"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move';
                onDragStart();
              }}
              className="inline-flex h-7 w-7 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-surface-elevated hover:text-foreground active:cursor-grabbing"
              aria-label={t('rules.drag')}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
            <Tooltip content={collapsed ? t('rules.expand') : t('rules.collapse')}>
              <IconButton className="h-7 w-7" onClick={onToggleCollapsed} aria-label={collapsed ? t('rules.expand') : t('rules.collapse')}>
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-150', !collapsed && 'rotate-180')} />
              </IconButton>
            </Tooltip>
          </div>
        </div>
        <div className="flex min-w-0 items-center justify-center gap-2.5">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${meta.color}18`, color: meta.color }}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div className="flex min-h-7 flex-col justify-center text-center">
            <p className="text-sm font-semibold leading-none text-foreground">{meta.label}</p>
            <p className="mt-1 text-[10px] leading-none text-muted-foreground">{t('rules.step', { count: index + 1 })}</p>
          </div>
        </div>

        <div className="flex items-center justify-self-end gap-0.5">
          <Switch
            checked={rule.enabled}
            onCheckedChange={(checked) => onUpdate((r) => ({ ...r, enabled: checked }))}
          />
          <Tooltip content={t('rules.move_up')}>
            <IconButton className="h-7 w-7" onClick={() => onMove('up')}>
              <ChevronUp className="h-3.5 w-3.5" />
            </IconButton>
          </Tooltip>
          <Tooltip content={t('rules.move_down')}>
            <IconButton className="h-7 w-7" onClick={() => onMove('down')}>
              <ChevronDown className="h-3.5 w-3.5" />
            </IconButton>
          </Tooltip>
          <Tooltip content={t('rules.delete')}>
            <IconButton
              className="h-7 w-7 text-destructive hover:bg-destructive/10"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      {!collapsed && (
        <div className="border-t px-3.5 py-3" style={{ borderColor: `${meta.color}18` }}>
          <RuleEditor rule={rule} onChange={(next) => onUpdate(() => next)} />
        </div>
      )}
    </div>
  );
}

function NewNameRuleEditor({
  rule,
  onChange,
}: {
  rule: Extract<RenameRule, { type: 'new_name' }>;
  onChange: (rule: Extract<RenameRule, { type: 'new_name' }>) => void;
}) {
  const { t } = useI18n();
  const tokens = useMemo(() => getNewNameTokens(t), [t]);
  const starters = useMemo(() => getNewNameStarters(t), [t]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function insertToken(token: string) {
    const input = inputRef.current;
    if (!input) {
      onChange({ ...rule, template: `${rule.template}${token}` });
      return;
    }

    const start = input.selectionStart ?? rule.template.length;
    const end = input.selectionEnd ?? rule.template.length;
    const nextTemplate = `${rule.template.slice(0, start)}${token}${rule.template.slice(end)}`;
    onChange({ ...rule, template: nextTemplate });

    requestAnimationFrame(() => {
      const nextCursor = start + token.length;
      input.focus();
      input.setSelectionRange(nextCursor, nextCursor);
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Input
          ref={inputRef}
          value={rule.template}
          onChange={(e) => onChange({ ...rule, template: e.target.value })}
          placeholder={t('editor.new_name.placeholder')}
        />
        <p className="text-xs text-muted-foreground">
          {t('editor.new_name.help')}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t('editor.new_name.quick_insert')}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {tokens.map((token) => (
            <button
              key={token.value}
              type="button"
              onClick={() => insertToken(token.value)}
              className={cn(
                'rounded-lg border border-border bg-surface px-3 py-2 text-left transition-colors',
                'hover:border-accent/40 hover:bg-surface-elevated',
              )}
            >
              <div className="text-xs font-semibold text-foreground">{token.label}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{token.detail}</div>
              <code className="mt-1 block text-[11px] text-accent">{token.value}</code>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t('editor.new_name.starters')}
        </p>
        <div className="flex flex-wrap gap-2">
          {starters.map((template) => (
            <Button
              key={template.value}
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onChange({ ...rule, template: template.value })}
            >
              {template.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CustomRuleEditor({
  rule,
  onChange,
}: {
  rule: Extract<RenameRule, { type: 'custom_rule' }>;
  onChange: (rule: Extract<RenameRule, { type: 'custom_rule' }>) => void;
}) {
  const { t } = useI18n();
  const quickInsert = useMemo(() => getCustomRuleQuickInsert(), []);
  const examples = useMemo(() => getCustomRuleExamples(), []);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  function insertSnippet(snippet: string) {
    const input = inputRef.current;
    if (!input) {
      onChange({ ...rule, expression: `${rule.expression}${snippet}` });
      return;
    }

    const start = input.selectionStart ?? rule.expression.length;
    const end = input.selectionEnd ?? rule.expression.length;
    const nextExpression = `${rule.expression.slice(0, start)}${snippet}${rule.expression.slice(end)}`;
    onChange({ ...rule, expression: nextExpression });

    requestAnimationFrame(() => {
      const nextCursor = start + snippet.length;
      input.focus();
      input.setSelectionRange(nextCursor, nextCursor);
    });
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-accent/20 bg-accent/5 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">{t('editor.custom.beta')}</Badge>
          <p className="text-xs font-medium text-foreground">{t('editor.custom.help')}</p>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t('editor.custom.return_label')}</p>
      </div>

      <div className="space-y-2">
        <textarea
          ref={inputRef}
          value={rule.expression}
          onChange={(event) => onChange({ ...rule, expression: event.target.value })}
          placeholder={t('editor.custom.placeholder')}
          spellCheck={false}
          className={cn(
            'min-h-[120px] w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none',
            'font-mono leading-6 placeholder:text-muted-foreground transition-colors',
            'focus:border-accent/60 focus:ring-2 focus:ring-accent/10',
          )}
        />
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t('editor.custom.quick_insert')}
        </p>
        <div className="flex flex-wrap gap-2">
          {quickInsert.map((snippet) => (
            <Button
              key={snippet.value}
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => insertSnippet(snippet.value)}
              className="font-mono"
            >
              {snippet.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t('editor.custom.examples')}
        </p>
        <div className="grid gap-2">
          {examples.map((example) => (
            <button
              key={example.label}
              type="button"
              onClick={() => onChange({ ...rule, expression: example.value })}
              className={cn(
                'rounded-lg border border-border bg-surface px-3 py-2 text-left transition-colors',
                'hover:border-accent/40 hover:bg-surface-elevated',
              )}
            >
              <div className="text-xs font-semibold text-foreground">{example.label}</div>
              <code className="mt-1 block text-[11px] leading-5 text-accent">{example.value}</code>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t('editor.custom.reference')}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {CUSTOM_RULE_HELPERS.map((helper) => (
            <div key={helper} className="rounded-lg border border-border/80 bg-surface px-3 py-2">
              <code className="text-[11px] text-foreground">{helper}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RuleEditor({ rule, onChange }: { rule: RenameRule; onChange: (r: RenameRule) => void }) {
  const { t } = useI18n();
  switch (rule.type) {
    case 'new_name':
      return <NewNameRuleEditor rule={rule} onChange={onChange} />;

    case 'custom_rule':
      return <CustomRuleEditor rule={rule} onChange={onChange} />;

    case 'find_replace':
      return (
        <div className="space-y-2.5">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              value={rule.find}
              onChange={(e) => onChange({ ...rule, find: e.target.value })}
              placeholder={t('editor.find.placeholder')}
            />
            <Input
              value={rule.replace}
              onChange={(e) => onChange({ ...rule, replace: e.target.value })}
              placeholder={t('editor.replace.placeholder')}
            />
          </div>
          <div className="flex flex-wrap gap-4">
            <Checkbox
              checked={rule.matchCase}
              onCheckedChange={(checked) => onChange({ ...rule, matchCase: checked === true })}
              label={t('editor.match_case')}
            />
            <Checkbox
              checked={rule.useRegex}
              onCheckedChange={(checked) => onChange({ ...rule, useRegex: checked === true })}
              label={t('editor.regex')}
            />
            <Checkbox
              checked={rule.replaceAll}
              onCheckedChange={(checked) => onChange({ ...rule, replaceAll: checked === true })}
              label={t('editor.replace_all')}
            />
          </div>
        </div>
      );

    case 'prefix_suffix':
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            value={rule.prefix}
            onChange={(e) => onChange({ ...rule, prefix: e.target.value })}
            placeholder={t('editor.prefix.placeholder')}
          />
          <Input
            value={rule.suffix}
            onChange={(e) => onChange({ ...rule, suffix: e.target.value })}
            placeholder={t('editor.suffix.placeholder')}
          />
        </div>
      );

    case 'case_transform':
      return (
        <Select
          value={rule.mode}
          onValueChange={(value) => onChange({ ...rule, mode: value as typeof rule.mode })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lower">{t('editor.case.lower')}</SelectItem>
            <SelectItem value="upper">{t('editor.case.upper')}</SelectItem>
            <SelectItem value="title">{t('editor.case.title')}</SelectItem>
            <SelectItem value="sentence">{t('editor.case.sentence')}</SelectItem>
            <SelectItem value="camel">{t('editor.case.camel')}</SelectItem>
            <SelectItem value="pascal">{t('editor.case.pascal')}</SelectItem>
            <SelectItem value="kebab">{t('editor.case.kebab')}</SelectItem>
            <SelectItem value="snake">{t('editor.case.snake')}</SelectItem>
          </SelectContent>
        </Select>
      );

    case 'trim_text':
      return (
        <Select
          value={rule.mode}
          onValueChange={(value) => onChange({ ...rule, mode: value as typeof rule.mode })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="trim">{t('editor.trim.trim')}</SelectItem>
            <SelectItem value="trim_start">{t('editor.trim.trim_start')}</SelectItem>
            <SelectItem value="trim_end">{t('editor.trim.trim_end')}</SelectItem>
            <SelectItem value="collapse_spaces">{t('editor.trim.collapse_spaces')}</SelectItem>
            <SelectItem value="remove_spaces">{t('editor.trim.remove_spaces')}</SelectItem>
            <SelectItem value="remove_dashes">{t('editor.trim.remove_dashes')}</SelectItem>
            <SelectItem value="remove_underscores">{t('editor.trim.remove_underscores')}</SelectItem>
          </SelectContent>
        </Select>
      );

    case 'remove_text':
      return (
        <div className="space-y-2.5">
          <Input
            value={rule.text}
            onChange={(e) => onChange({ ...rule, text: e.target.value })}
            placeholder={t('editor.remove.placeholder')}
          />
          <Checkbox
            checked={rule.matchCase}
            onCheckedChange={(checked) => onChange({ ...rule, matchCase: checked === true })}
            label={t('editor.match_case')}
          />
        </div>
      );

    case 'sequence_insert':
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Select
            value={rule.position}
            onValueChange={(value) => onChange({ ...rule, position: value as typeof rule.position })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="prefix">{t('editor.position.prefix')}</SelectItem>
              <SelectItem value="suffix">{t('editor.position.suffix')}</SelectItem>
              <SelectItem value="before_extension">{t('editor.position.before_extension')}</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={rule.separator}
            onChange={(e) => onChange({ ...rule, separator: e.target.value })}
            placeholder={t('editor.separator.placeholder')}
          />
          <Input
            type="number"
            value={rule.start}
            onChange={(e) => onChange({ ...rule, start: Number(e.target.value) })}
            placeholder={t('editor.start.placeholder')}
          />
          <Input
            type="number"
            value={rule.step}
            onChange={(e) => onChange({ ...rule, step: Number(e.target.value) })}
            placeholder={t('editor.step.placeholder')}
          />
          <Input
            type="number"
            value={rule.padWidth}
            onChange={(e) => onChange({ ...rule, padWidth: Number(e.target.value) })}
            placeholder={t('editor.pad.placeholder')}
          />
        </div>
      );

    case 'date_time':
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Select
            value={rule.position}
            onValueChange={(value) => onChange({ ...rule, position: value as typeof rule.position })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="prefix">{t('editor.position.prefix')}</SelectItem>
              <SelectItem value="suffix">{t('editor.position.suffix')}</SelectItem>
              <SelectItem value="before_extension">{t('editor.position.before_extension')}</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={rule.format}
            onChange={(e) => onChange({ ...rule, format: e.target.value })}
            placeholder={t('editor.date_format.placeholder')}
          />
          <Input
            value={rule.separator}
            onChange={(e) => onChange({ ...rule, separator: e.target.value })}
            placeholder={t('editor.separator.placeholder')}
          />
        </div>
      );

    case 'extension_handling':
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Select
            value={rule.mode}
            onValueChange={(value) => onChange({ ...rule, mode: value as typeof rule.mode })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="keep">{t('editor.extension.keep')}</SelectItem>
              <SelectItem value="lowercase">{t('editor.extension.lowercase')}</SelectItem>
              <SelectItem value="uppercase">{t('editor.extension.uppercase')}</SelectItem>
              <SelectItem value="replace">{t('editor.extension.replace')}</SelectItem>
              <SelectItem value="remove">{t('editor.extension.remove')}</SelectItem>
            </SelectContent>
          </Select>
          {rule.mode === 'replace' && (
            <Input
              value={rule.replacement}
              onChange={(e) => onChange({ ...rule, replacement: e.target.value })}
              placeholder="jpg"
            />
          )}
        </div>
      );
  }
}

// ─── Preset list ──────────────────────────────────────────────────────────────

function PresetList({
  presets,
  onLoad,
  onEdit,
  onDelete,
  emptyMessage,
}: {
  presets: Preset[];
  onLoad: (p: Preset) => void;
  onEdit: (p: Preset) => void;
  onDelete?: (p: Preset) => void;
  emptyMessage: string;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      {presets.length === 0 && <EmptyState message={emptyMessage} />}
      {presets.map((preset) => (
        <div key={preset.id} className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{preset.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t('presets.rules_count', { count: preset.rules.length })}</p>
            </div>
            <Badge tone={preset.isSample ? 'accent' : 'ok'} dot>
              {preset.isSample ? t('presets.sample') : t('presets.saved')}
            </Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => onLoad(preset)}>{t('presets.load')}</Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={preset.isSample}
              onClick={() => onEdit(preset)}
            >
              {t('presets.edit_name')}
            </Button>
            {onDelete && !preset.isSample && (
              <Button size="sm" variant="danger" onClick={() => onDelete(preset)}>{t('common.delete')}</Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function getSelectedLabel(sources: SourceSelection[], t: ReturnType<typeof useI18n>['t']) {
  if (sources.length === 0) {
    return t('selected.none');
  }

  if (sources.every((source) => source.isDirectory)) {
    return t('selected.folders', { count: sources.length });
  }

  if (sources.every((source) => !source.isDirectory)) {
    return t('selected.files', { count: sources.length });
  }

  return t('selected.items', { count: sources.length });
}

function getAvailableSourceModes(sources: SourceSelection[]): SourceMode[] {
  const hasFiles = sources.some((source) => !source.isDirectory);
  const hasDirectories = sources.some((source) => source.isDirectory);
  const modes: SourceMode[] = [];

  if (hasFiles) {
    modes.push('picked_files');
  }
  if (hasDirectories) {
    modes.push('picked_folders', 'top_level_folders', 'subfolders', 'top_level_files', 'files_recursive');
  }

  return modes;
}

function getUndoStatusLabel(entry: HistoryEntry, t: ReturnType<typeof useI18n>['t']) {
  switch (entry.undoState) {
    case 'ready':
      return t('undo.ready');
    case 'archived':
      return t('undo.archived');
    case 'overlap':
      return t('undo.overlap');
    case 'missing':
      return t('undo.missing');
    case 'occupied':
      return t('undo.occupied');
  }
}
