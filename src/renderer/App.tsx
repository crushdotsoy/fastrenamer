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
  Moon,
  Plus,
  RefreshCcw,
  Replace,
  Save,
  Scissors,
  Settings2,
  Square,
  Sun,
  Trash2,
  Type,
  Undo2,
  Download,
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

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_PREVIEW: PreviewResult = {
  rows: [],
  summary: { total: 0, changed: 0, ok: 0, conflict: 0, invalid: 0, unchanged: 0, blocked: false },
};

const STATUS_OPTIONS = ['ok', 'conflict', 'invalid', 'unchanged'] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];

const SOURCE_MODE_META: Record<
  SourceMode,
  { label: string; pickerLabel: string; detail: string; supportsFilter: boolean }
> = {
  picked_folders: {
    label: 'Picked folders',
    pickerLabel: 'Add Folders',
    detail: 'Pick folders directly and rename those folders themselves.',
    supportsFilter: false,
  },
  picked_files: {
    label: 'Picked files',
    pickerLabel: 'Add Files',
    detail: 'Pick individual files directly.',
    supportsFilter: true,
  },
  top_level_folders: {
    label: 'Top-level folders',
    pickerLabel: 'Add Folders',
    detail: 'Rename direct child folders inside each selected root folder.',
    supportsFilter: false,
  },
  subfolders: {
    label: 'Subfolders',
    pickerLabel: 'Add Folders',
    detail: 'Rename nested folders below the top level.',
    supportsFilter: false,
  },
  top_level_files: {
    label: 'Top-level files',
    pickerLabel: 'Add Folders',
    detail: 'Rename direct child files inside each selected root folder.',
    supportsFilter: true,
  },
  files_recursive: {
    label: 'Files recursively',
    pickerLabel: 'Add Folders',
    detail: 'Rename files at any depth inside each selected root folder.',
    supportsFilter: true,
  },
};

const RULE_META: Record<
  RenameRule['type'],
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  new_name:           { label: 'New Name',        color: '#38bdf8', icon: Type },
  find_replace:       { label: 'Find / Replace',  color: '#4e8fff', icon: Replace },
  prefix_suffix:      { label: 'Prefix / Suffix',  color: '#a78bfa', icon: Braces },
  case_transform:     { label: 'Case Transform',   color: '#34d399', icon: CaseSensitive },
  trim_text:          { label: 'Trim / Normalize', color: '#2dd4bf', icon: Scissors },
  remove_text:        { label: 'Remove Text',      color: '#f87171', icon: Eraser },
  sequence_insert:    { label: 'Sequence',         color: '#fb923c', icon: Hash },
  date_time:          { label: 'Date / Time',      color: '#fbbf24', icon: Calendar },
  extension_handling: { label: 'Extension',        color: '#e879f9', icon: FileCode },
};

const NEW_NAME_TOKENS = [
  { label: 'Sequence', detail: '0001, 0002, 0003', value: '{seq_num:0001}' },
  { label: 'Original Name', detail: 'Current file name', value: '{original_stem}' },
  { label: 'Current Result', detail: 'Name after earlier rules', value: '{current_stem}' },
  { label: 'Parent Folder', detail: 'Containing folder name', value: '{parent}' },
  { label: 'Date', detail: 'YYYY-MM-DD', value: '{date}' },
  { label: 'Time', detail: 'HHmmss', value: '{time}' },
] as const;

const NEW_NAME_STARTERS = [
  { label: 'Simple sequence', value: 'name_{seq_num:0001}' },
  { label: 'Keep original + number', value: '{original_stem}_{seq_num:0001}' },
  { label: 'Folder + number', value: '{parent}_{seq_num:0001}' },
  { label: 'Date + number', value: '{date}_{seq_num:0001}' },
] as const;

const SOURCE_LIST_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});
const THEME_STORAGE_KEY = 'theme';
const LEFT_WIDTH_STORAGE_KEY = 'left_panel_width';
const DEFAULT_LEFT_WIDTH_RATIO = 0.28;
const MIN_LEFT_WIDTH_RATIO = 0.18;
const MAX_LEFT_WIDTH_RATIO = 0.45;

function clampLeftWidthRatio(value: number) {
  return Math.min(MAX_LEFT_WIDTH_RATIO, Math.max(MIN_LEFT_WIDTH_RATIO, value));
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

function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return { theme, toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) };
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
  actionKind?: 'open-settings' | 'install-update';
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

function getUpdateStatusLabel(status: UpdateState['status']) {
  switch (status) {
    case 'idle':
      return 'idle';
    case 'disabled':
      return 'packaged builds only';
    case 'checking':
      return 'checking';
    case 'available':
      return 'update found';
    case 'downloading':
      return 'downloading';
    case 'downloaded':
      return 'ready to install';
    case 'up-to-date':
      return 'up to date';
    case 'installing':
      return 'installing';
    case 'error':
      return 'update error';
  }
}

function getUpdateSummary(state: UpdateState) {
  switch (state.status) {
    case 'disabled':
      return state.message ?? 'Install a packaged GitHub release to enable automatic updates.';
    case 'checking':
      return 'Checking GitHub Releases for a newer version.';
    case 'available':
      return `Version ${state.availableVersion ?? 'unknown'} is available and downloading in the background.`;
    case 'downloading':
      return state.progress
        ? `${state.progress.percent.toFixed(0)}% downloaded (${formatBytes(state.progress.transferred)} of ${formatBytes(state.progress.total)}).`
        : 'Downloading the latest release in the background.';
    case 'downloaded':
      return `Version ${state.availableVersion ?? 'unknown'} is ready. Restart the app to install it.`;
    case 'up-to-date':
      return 'This installation already matches the latest published release.';
    case 'installing':
      return 'Closing the app to install the downloaded update.';
    case 'error':
      return state.message ?? 'The app could not complete the update check.';
    default:
      return 'Automatic updates are enabled for packaged releases.';
  }
}

type SettingsSectionId = 'updates' | 'executionProfile' | 'platformRules' | 'appearance';

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

// ─── App ──────────────────────────────────────────────────────────────────────

export function App() {
  const platform = useMemo(detectPlatform, []);
  const { theme, toggleTheme } = useTheme();

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
    if (Number.isFinite(stored)) {
      if (stored > 1) {
        // Migrate older fixed-pixel widths to the new proportional layout.
        return clampLeftWidthRatio(stored / Math.max(window.innerWidth - 16, 1));
      }
      return clampLeftWidthRatio(stored);
    }
    return DEFAULT_LEFT_WIDTH_RATIO;
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
        setError(err instanceof Error ? err.message : 'Failed to open the source picker.');
      }
    })();
  }, [addSourcesOpen, pendingSourcePick]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const mqHandler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', mqHandler);

    function onMouseMove(e: MouseEvent) {
      if (!isResizing.current) return;
      const containerWidth = resizeContainerWidth.current;
      if (containerWidth <= 0) return;
      const deltaRatio = (e.clientX - resizeStartX.current) / containerWidth;
      setLeftWidthRatio(clampLeftWidthRatio(resizeStartWidthRatio.current + deltaRatio));
    }
    function onMouseUp() { isResizing.current = false; }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      mq.removeEventListener('change', mqHandler);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
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
          title: 'Update found',
          description: `Version ${state.availableVersion ?? 'unknown'} is downloading in the background.`,
          actionLabel: 'Open settings',
          actionKind: 'open-settings',
        });
      }

      if (state.status === 'downloaded') {
        showUpdateToast({
          tone: 'ok',
          title: 'Update ready',
          description: `Version ${state.availableVersion ?? 'unknown'} is ready to install.`,
          actionLabel: 'Restart now',
          actionKind: 'install-update',
        });
      }

      if (state.status === 'error') {
        showUpdateToast({
          tone: 'conflict',
          title: 'Update failed',
          description: state.message ?? 'The app could not complete the update check.',
          actionLabel: 'Open settings',
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
  }, []);

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

  function handleUpdateToastAction(actionKind?: UpdateToastState['actionKind']) {
    if (!actionKind) {
      return;
    }

    if (actionKind === 'open-settings') {
      setSettingsDrawerOpen(true);
      setUpdateToast((current) => (current ? { ...current, open: false } : current));
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
        setError('The dropped items do not match the selected source mode.');
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
    if (!SOURCE_MODE_META[nextMode].supportsFilter) {
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
        if (!SOURCE_MODE_META[nextMode].supportsFilter) {
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
      setError('Dropped items did not include filesystem paths.');
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
      setError(err instanceof Error ? err.message : 'Failed to read dropped items.');
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
      setError(err instanceof Error ? err.message : 'Failed to generate preview.');
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
    if (!presetName.trim()) { setError('Preset name is required.'); return; }
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
    : (Object.keys(SOURCE_MODE_META) as SourceMode[]);
  const sourceDialogItems = pendingDroppedSources ?? sources;
  const sourceDialogTitle = pendingDroppedSources ? 'Use Dropped Items' : 'Add Sources';
  const sourceDialogDescription = pendingDroppedSources
    ? 'Choose how Fast Renamer should interpret the dropped folders or files.'
    : 'Choose what kind of items you want to rename before opening the file picker.';
  const sourceDialogButtonLabel = pendingDroppedSources
    ? 'Use Dropped Items'
    : SOURCE_MODE_META[draftSourceMode].pickerLabel;
  const sourceDialogRootCount = pendingDroppedSources?.length ?? sources.length;

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
            windowState={windowState}
            sourceCount={sources.length}
            selectedLabel={getSelectedLabel(sources)}
            preview={preview}
            busy={busy}
            error={error}
            undoDisabled={!lastUndoable || busy !== 'idle'}
            onOpenAddSources={openAddSources}
            onClearSources={clearSources}
            onRefresh={refreshPreview}
            onExecute={executeRename}
            onUndo={() => lastUndoable && void undoLast(lastUndoable.id)}
            onOpenPresets={() => setPresetDrawerOpen(true)}
            onOpenHistory={() => setHistoryDrawerOpen(true)}
            onOpenSettings={() => setSettingsDrawerOpen(true)}
            onToggleTheme={toggleTheme}
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
            <div className="text-sm font-semibold text-foreground">Drop files or folders to add sources</div>
            <div className="mt-2 text-xs text-muted-foreground">
              Fast Renamer will use the dropped items as the current source roots.
            </div>
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
                Source Set
              </label>
              <Select
                value={draftSourceMode}
                onChange={(e) => handleDraftSourceModeChange(e.target.value as SourceMode)}
              >
                {availableDraftModes.includes('picked_folders') && (
                  <option value="picked_folders">Picked folders</option>
                )}
                {availableDraftModes.includes('picked_files') && (
                  <option value="picked_files">Picked files</option>
                )}
                {availableDraftModes.includes('top_level_folders') && (
                  <option value="top_level_folders">Top-level folders</option>
                )}
                {availableDraftModes.includes('subfolders') && (
                  <option value="subfolders">Subfolders</option>
                )}
                {availableDraftModes.includes('top_level_files') && (
                  <option value="top_level_files">Top-level files</option>
                )}
                {availableDraftModes.includes('files_recursive') && (
                  <option value="files_recursive">Files recursively</option>
                )}
              </Select>
              <p className="text-xs text-muted-foreground">
                {SOURCE_MODE_META[draftSourceMode].detail}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                File Filter
              </label>
              <Input
                value={draftFileNamePattern}
                onChange={(e) => setDraftFileNamePattern(e.target.value)}
                placeholder="*.tif, *.tiff"
                disabled={!SOURCE_MODE_META[draftSourceMode].supportsFilter}
              />
              <p className="text-xs text-muted-foreground">
                {SOURCE_MODE_META[draftSourceMode].supportsFilter
                  ? 'Optional glob filters. Supports * and ?, separated by commas.'
                  : 'Filters are only used when the source set targets files.'}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm font-semibold text-foreground">
              {pendingDroppedSources ? 'Dropped items' : 'Current source set'}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge dot tone="accent">{SOURCE_MODE_META[draftSourceMode].label}</Badge>
              {draftFileNamePattern ? <Badge dot>{draftFileNamePattern}</Badge> : null}
              <Badge dot>{sourceDialogRootCount} picked roots</Badge>
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
                        {source.isDirectory ? 'folder' : 'file'}
                      </Badge>
                      <IconButton
                        className="h-7 w-7"
                        onClick={() => removeSourceFromDialog(source.path)}
                        aria-label={`Remove ${source.name}`}
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
              Cancel
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
        title="Presets"
        description="Sample stacks for discoverability plus reusable user presets."
      >
        <div className="space-y-6 p-5">
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm font-semibold text-foreground">Save Current Stack</p>
            <div className="mt-3 space-y-3">
              <Input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="My awesome preset…"
              />
              <div className="flex gap-2">
                <Button onClick={() => void savePreset()}>
                  <Save className="h-3.5 w-3.5" />
                  Save preset
                </Button>
                {selectedPresetId && (
                  <Button variant="secondary" onClick={() => setSelectedPresetId(null)}>
                    Clear target
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">Preset Library</p>
              <div className="w-full sm:w-64">
                <Input
                  value={presetSearch}
                  onChange={(e) => setPresetSearch(e.target.value)}
                  placeholder="Search presets"
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
              emptyMessage={presetSearch.trim() ? 'No presets match your search.' : 'No presets yet.'}
            />
          </div>
        </div>
      </Drawer>

      {/* History drawer */}
      <Drawer
        open={historyDrawerOpen}
        onOpenChange={setHistoryDrawerOpen}
        title="Rename History"
        description="Completed batches stored for auditability and one-click undo."
      >
        <div className="space-y-3 p-5">
          {history.length === 0 && <EmptyState message="No rename batches recorded yet." />}
          {history.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Batch #{entry.id}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleString()}
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
                  {getUndoStatusLabel(entry)}
                </Badge>
              </div>
              <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                <span>{entry.renamedCount} renamed</span>
                <span>{entry.previewSummary.conflict + entry.previewSummary.invalid} blocked</span>
              </div>
              {entry.undoReason && entry.undoState !== 'ready' && entry.undoState !== 'archived' && (
                <p className="mt-3 text-xs text-conflict">{entry.undoReason}</p>
              )}
              {entry.rules.length === 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  This batch does not have a reusable template saved.
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={entry.rules.length === 0}
                  onClick={() => setRules(entry.rules)}
                >
                  Reuse template
                </Button>
                <Button
                  size="sm"
                  disabled={!entry.canUndo || busy !== 'idle'}
                  onClick={() => void undoLast(entry.id)}
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  Undo
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
        title="Settings"
        description="Local preferences plus GitHub release updates."
      >
        <div className="space-y-3 p-5">
          <SettingsSection
            title="App Updates"
            badge={(
              <Badge tone={getUpdateTone(updateState.status)} dot>
                {getUpdateStatusLabel(updateState.status)}
              </Badge>
            )}
            open={openSettingsSection === 'updates'}
            onToggle={() => toggleSettingsSection('updates')}
          >
            <p className="text-xs text-muted-foreground">{getUpdateSummary(updateState)}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Badge>current {updateState.currentVersion}</Badge>
              {updateState.availableVersion && updateState.availableVersion !== updateState.currentVersion && (
                <Badge tone="accent">latest {updateState.availableVersion}</Badge>
              )}
              {updateState.checkedAt && (
                <Badge tone="unchanged">
                  checked {new Date(updateState.checkedAt).toLocaleString()}
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
                  {updateState.progress.percent.toFixed(0)}% at {formatBytes(updateState.progress.bytesPerSecond)}/s
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
                Check now
              </Button>
              <Button
                size="sm"
                disabled={updateState.status !== 'downloaded' || updateAction === 'installing'}
                onClick={() => void installUpdate()}
              >
                <Download className="h-3.5 w-3.5" />
                Restart to install
              </Button>
            </div>
          </SettingsSection>
          <SettingsSection
            title="Appearance"
            open={openSettingsSection === 'appearance'}
            onToggle={() => toggleSettingsSection('appearance')}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Theme</span>
              <Button size="sm" variant="secondary" onClick={toggleTheme}>
                {theme === 'dark' ? (
                  <><Sun className="h-3.5 w-3.5" /> Switch to Light</>
                ) : (
                  <><Moon className="h-3.5 w-3.5" /> Switch to Dark</>
                )}
              </Button>
            </div>
          </SettingsSection>
          <SettingsSection
            title="Platform Rules"
            open={openSettingsSection === 'platformRules'}
            onToggle={() => toggleSettingsSection('platformRules')}
          >
            <p className="text-xs text-muted-foreground">
              Preview validation uses{' '}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{platform}</code>{' '}
              filename rules so conflicts and invalid names reflect the current machine.
            </p>
          </SettingsSection>
          <SettingsSection
            title="Execution Profile"
            open={openSettingsSection === 'executionProfile'}
            onToggle={() => toggleSettingsSection('executionProfile')}
          >
            <p className="text-xs text-muted-foreground">
              Renderer runs sandboxed with a preload bridge. Filesystem writes only happen
              through validated batch execution and undo in the Electron main process.
            </p>
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
  windowState,
  sourceCount,
  selectedLabel,
  preview,
  busy,
  error,
  undoDisabled,
  onOpenAddSources,
  onClearSources,
  onRefresh,
  onExecute,
  onUndo,
  onOpenPresets,
  onOpenHistory,
  onOpenSettings,
  onToggleTheme,
  onMinimizeWindow,
  onToggleMaximizeWindow,
  onCloseWindow,
}: {
  platform: PlatformTarget;
  theme: 'dark' | 'light';
  windowState: WindowState;
  sourceCount: number;
  selectedLabel: string;
  preview: PreviewResult;
  busy: 'idle' | 'preview' | 'execute' | 'undo';
  error: string | null;
  undoDisabled: boolean;
  onOpenAddSources: () => void;
  onClearSources: () => void;
  onRefresh: () => void;
  onExecute: () => void;
  onUndo: () => void;
  onOpenPresets: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
  onMinimizeWindow: () => void;
  onToggleMaximizeWindow: () => void;
  onCloseWindow: () => void;
}) {
  const isMac = platform === 'darwin';

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
            <p className="text-[10px] text-muted-foreground/50 hidden sm:block">v1 · batch rename</p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-border hidden sm:block" />

        {/* Source + nav buttons */}
        <div className="app-no-drag flex flex-wrap items-center gap-2">
          <Button variant="default" size="sm" onClick={onOpenAddSources}>
            <FileInput className="h-3.5 w-3.5" />
            Add
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSources}
            disabled={sourceCount === 0}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </Button>
          <Button variant="ghost" size="sm" onClick={onOpenPresets}>
            <Save className="h-3.5 w-3.5" />
            Presets
          </Button>
          <Button variant="ghost" size="sm" onClick={onOpenHistory}>
            <Clock3 className="h-3.5 w-3.5" />
            History
          </Button>
          <Button variant="ghost" size="sm" onClick={onOpenSettings}>
            <Settings2 className="h-3.5 w-3.5" />
            Settings
          </Button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action buttons */}
        <div className="app-no-drag flex items-center gap-1.5">
          <Tooltip content="Refresh preview">
            <IconButton
              disabled={busy !== 'idle' || sourceCount === 0}
              onClick={onRefresh}
              aria-label="Refresh preview"
            >
              <RefreshCcw
                className={cn('h-4 w-4', busy === 'preview' && 'animate-spin')}
              />
            </IconButton>
          </Tooltip>

          <Tooltip content="Undo last rename">
            <IconButton disabled={undoDisabled} onClick={onUndo} aria-label="Undo">
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
            Rename
            {preview.summary.changed > 0 && (
              <span className="ml-0.5 rounded bg-accent-foreground/20 px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums">
                {preview.summary.changed}
              </span>
            )}
          </Button>

          <div className="h-6 w-px bg-border mx-0.5" />

          <Tooltip content={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}>
            <IconButton onClick={onToggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </IconButton>
          </Tooltip>

          {!isMac && (
            <>
              <div className="h-6 w-px bg-border mx-0.5" />

              <div className="flex items-center gap-1">
                <Tooltip content="Minimize">
                  <IconButton
                    className="h-8 w-8 rounded-lg hover:bg-surface-elevated"
                    onClick={onMinimizeWindow}
                    aria-label="Minimize window"
                  >
                    <Minus className="h-4 w-4" />
                  </IconButton>
                </Tooltip>
                <Tooltip content={windowState.isMaximized ? 'Restore down' : 'Maximize'}>
                  <IconButton
                    className="h-8 w-8 rounded-lg hover:bg-surface-elevated"
                    onClick={onToggleMaximizeWindow}
                    aria-label={windowState.isMaximized ? 'Restore window' : 'Maximize window'}
                  >
                    {windowState.isMaximized ? (
                      <Copy className="h-3.5 w-3.5" />
                    ) : (
                      <Square className="h-3.5 w-3.5" />
                    )}
                  </IconButton>
                </Tooltip>
                <Tooltip content="Close">
                  <IconButton
                    className="h-8 w-8 rounded-lg hover:bg-destructive/90 hover:text-white dark:hover:text-[#080c14]"
                    onClick={onCloseWindow}
                    aria-label="Close window"
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
        <Badge dot tone="ok">{preview.summary.ok} ok</Badge>
        <Badge dot tone="conflict">{preview.summary.conflict} conflicts</Badge>
        <Badge dot tone="invalid">{preview.summary.invalid} invalid</Badge>
        <Badge dot tone="unchanged">{preview.summary.unchanged} unchanged</Badge>
        <Badge dot>{selectedLabel}</Badge>

        {busy !== 'idle' && (
          <span className="flex items-center gap-1.5 text-xs text-accent">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            {busy === 'preview' ? 'Generating preview…' : busy === 'execute' ? 'Renaming…' : 'Undoing…'}
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
  const statusCounts: Record<StatusFilter, number> = {
    ok: preview.summary.ok,
    conflict: preview.summary.conflict,
    invalid: preview.summary.invalid,
    unchanged: preview.summary.unchanged,
  };

  return (
    <Panel className="h-full">
      <PanelHeader
        title="Preview"
        detail="Live diff with filesystem safety checks."
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
          <EmptyState message="Preview appears here after you select sources and configure rules." />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-[700px] border-collapse text-left text-sm xl:min-w-full">
            <thead className="sticky top-0 z-10 border-b border-border bg-card">
              <tr>
                {['Status', 'Original', 'Proposed', 'Notes'].map((col) => (
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
                        ? 'Ready to rename'
                        : 'No change'}
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
  const RULE_TYPES: RenameRule['type'][] = [
    'new_name', 'find_replace', 'prefix_suffix', 'case_transform', 'trim_text',
    'remove_text', 'sequence_insert', 'date_time', 'extension_handling',
  ];
  const [draggedRuleId, setDraggedRuleId] = useState<string | null>(null);
  const [dropTargetRuleId, setDropTargetRuleId] = useState<string | null>(null);

  return (
    <Panel className="h-full">
      <PanelHeader
        title="Rule Stack"
        detail="Transforms applied top to bottom."
        actions={
          <DropdownMenuRoot>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm">
                <Plus className="h-3.5 w-3.5" />
                Add Rule
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Rule type</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {RULE_TYPES.map((type) => {
                const meta = RULE_META[type];
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
          <EmptyState message="No rules yet. Add one with the button above." />
        )}
        {rules.map((rule, index) => (
          <RuleCard
            key={rule.id}
            rule={rule}
            index={index}
            dragging={draggedRuleId === rule.id}
            dropTarget={dropTargetRuleId === rule.id}
            onUpdate={(updater) => onUpdateRule(rule.id, updater)}
            onMove={(dir) => onMoveRule(rule.id, dir)}
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
  onUpdate,
  onMove,
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
  onUpdate: (updater: (r: RenameRule) => RenameRule) => void;
  onMove: (dir: 'up' | 'down') => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
  onDelete: () => void;
}) {
  const meta = RULE_META[rule.type];
  const Icon = meta.icon;

  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
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
      <div className="flex items-center justify-between gap-2 px-3.5 py-3">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            className="inline-flex h-7 w-7 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-surface-elevated hover:text-foreground active:cursor-grabbing"
            aria-label="Drag to reorder rule"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${meta.color}18`, color: meta.color }}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground leading-none">{meta.label}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Step {index + 1}</p>
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          <Switch
            checked={rule.enabled}
            onCheckedChange={(checked) => onUpdate((r) => ({ ...r, enabled: checked }))}
          />
          <Tooltip content="Move up">
            <IconButton className="h-7 w-7" onClick={() => onMove('up')}>
              <ChevronUp className="h-3.5 w-3.5" />
            </IconButton>
          </Tooltip>
          <Tooltip content="Move down">
            <IconButton className="h-7 w-7" onClick={() => onMove('down')}>
              <ChevronDown className="h-3.5 w-3.5" />
            </IconButton>
          </Tooltip>
          <Tooltip content="Delete rule">
            <IconButton
              className="h-7 w-7 text-destructive hover:bg-destructive/10"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      {/* Rule editor */}
      <div className="border-t px-3.5 py-3" style={{ borderColor: `${meta.color}18` }}>
        <RuleEditor rule={rule} onChange={(next) => onUpdate(() => next)} />
      </div>
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
        <input
          ref={inputRef}
          value={rule.template}
          onChange={(e) => onChange({ ...rule, template: e.target.value })}
          placeholder="name_{seq_num:0001}"
          className={cn(
            'h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none',
            'placeholder:text-muted-foreground transition-colors',
            'focus:border-accent/60 focus:ring-2 focus:ring-accent/10',
          )}
        />
        <p className="text-xs text-muted-foreground">
          Click a token to insert it where your cursor is. Extensions stay unchanged unless you add an Extension rule.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Quick Insert
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {NEW_NAME_TOKENS.map((token) => (
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
          Starter Templates
        </p>
        <div className="flex flex-wrap gap-2">
          {NEW_NAME_STARTERS.map((template) => (
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

function RuleEditor({ rule, onChange }: { rule: RenameRule; onChange: (r: RenameRule) => void }) {
  switch (rule.type) {
    case 'new_name':
      return <NewNameRuleEditor rule={rule} onChange={onChange} />;

    case 'find_replace':
      return (
        <div className="space-y-2.5">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              value={rule.find}
              onChange={(e) => onChange({ ...rule, find: e.target.value })}
              placeholder="Find…"
            />
            <Input
              value={rule.replace}
              onChange={(e) => onChange({ ...rule, replace: e.target.value })}
              placeholder="Replace with…"
            />
          </div>
          <div className="flex flex-wrap gap-4">
            <Checkbox
              checked={rule.matchCase}
              onChange={(e) => onChange({ ...rule, matchCase: e.target.checked })}
              label="Match case"
            />
            <Checkbox
              checked={rule.useRegex}
              onChange={(e) => onChange({ ...rule, useRegex: e.target.checked })}
              label="Regex"
            />
            <Checkbox
              checked={rule.replaceAll}
              onChange={(e) => onChange({ ...rule, replaceAll: e.target.checked })}
              label="Replace all"
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
            placeholder="Prefix"
          />
          <Input
            value={rule.suffix}
            onChange={(e) => onChange({ ...rule, suffix: e.target.value })}
            placeholder="Suffix"
          />
        </div>
      );

    case 'case_transform':
      return (
        <Select
          value={rule.mode}
          onChange={(e) => onChange({ ...rule, mode: e.target.value as typeof rule.mode })}
        >
          <option value="lower">lowercase</option>
          <option value="upper">UPPERCASE</option>
          <option value="title">Title Case</option>
          <option value="sentence">Sentence case</option>
          <option value="camel">camelCase</option>
          <option value="pascal">PascalCase</option>
          <option value="kebab">kebab-case</option>
          <option value="snake">snake_case</option>
        </Select>
      );

    case 'trim_text':
      return (
        <Select
          value={rule.mode}
          onChange={(e) => onChange({ ...rule, mode: e.target.value as typeof rule.mode })}
        >
          <option value="trim">Trim both ends</option>
          <option value="trim_start">Trim start</option>
          <option value="trim_end">Trim end</option>
          <option value="collapse_spaces">Collapse internal spaces</option>
          <option value="remove_spaces">Remove spaces</option>
          <option value="remove_dashes">Remove dashes</option>
          <option value="remove_underscores">Remove underscores</option>
        </Select>
      );

    case 'remove_text':
      return (
        <div className="space-y-2.5">
          <Input
            value={rule.text}
            onChange={(e) => onChange({ ...rule, text: e.target.value })}
            placeholder="Text to remove"
          />
          <Checkbox
            checked={rule.matchCase}
            onChange={(e) => onChange({ ...rule, matchCase: e.target.checked })}
            label="Match case"
          />
        </div>
      );

    case 'sequence_insert':
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Select
            value={rule.position}
            onChange={(e) => onChange({ ...rule, position: e.target.value as typeof rule.position })}
          >
            <option value="prefix">Prefix</option>
            <option value="suffix">Suffix</option>
            <option value="before_extension">Before extension</option>
          </Select>
          <Input
            value={rule.separator}
            onChange={(e) => onChange({ ...rule, separator: e.target.value })}
            placeholder="Separator"
          />
          <Input
            type="number"
            value={rule.start}
            onChange={(e) => onChange({ ...rule, start: Number(e.target.value) })}
            placeholder="Start"
          />
          <Input
            type="number"
            value={rule.step}
            onChange={(e) => onChange({ ...rule, step: Number(e.target.value) })}
            placeholder="Step"
          />
          <Input
            type="number"
            value={rule.padWidth}
            onChange={(e) => onChange({ ...rule, padWidth: Number(e.target.value) })}
            placeholder="Pad width"
          />
        </div>
      );

    case 'date_time':
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Select
            value={rule.position}
            onChange={(e) => onChange({ ...rule, position: e.target.value as typeof rule.position })}
          >
            <option value="prefix">Prefix</option>
            <option value="suffix">Suffix</option>
            <option value="before_extension">Before extension</option>
          </Select>
          <Input
            value={rule.format}
            onChange={(e) => onChange({ ...rule, format: e.target.value })}
            placeholder="YYYY-MM-DD"
          />
          <Input
            value={rule.separator}
            onChange={(e) => onChange({ ...rule, separator: e.target.value })}
            placeholder="Separator"
          />
        </div>
      );

    case 'extension_handling':
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Select
            value={rule.mode}
            onChange={(e) => onChange({ ...rule, mode: e.target.value as typeof rule.mode })}
          >
            <option value="keep">Keep as-is</option>
            <option value="lowercase">Lowercase</option>
            <option value="uppercase">Uppercase</option>
            <option value="replace">Replace</option>
            <option value="remove">Remove</option>
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
  return (
    <div className="space-y-3">
      {presets.length === 0 && <EmptyState message={emptyMessage} />}
      {presets.map((preset) => (
        <div key={preset.id} className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{preset.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{preset.rules.length} rules</p>
            </div>
            <Badge tone={preset.isSample ? 'accent' : 'ok'} dot>
              {preset.isSample ? 'sample' : 'saved'}
            </Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => onLoad(preset)}>Load</Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={preset.isSample}
              onClick={() => onEdit(preset)}
            >
              Edit name
            </Button>
            {onDelete && !preset.isSample && (
              <Button size="sm" variant="danger" onClick={() => onDelete(preset)}>Delete</Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function getSelectedLabel(sources: SourceSelection[]) {
  if (sources.length === 0) {
    return '0 selected';
  }

  if (sources.every((source) => source.isDirectory)) {
    return `${sources.length} ${sources.length === 1 ? 'folder' : 'folders'} selected`;
  }

  if (sources.every((source) => !source.isDirectory)) {
    return `${sources.length} ${sources.length === 1 ? 'file' : 'files'} selected`;
  }

  return `${sources.length} items selected`;
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

function getUndoStatusLabel(entry: HistoryEntry) {
  switch (entry.undoState) {
    case 'ready':
      return 'undo ready';
    case 'archived':
      return 'archived';
    case 'overlap':
      return 'overlap';
    case 'missing':
      return 'files not found';
    case 'occupied':
      return 'occupied';
  }
}
