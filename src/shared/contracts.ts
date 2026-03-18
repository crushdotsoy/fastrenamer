import { z } from 'zod';
import type {
  DirectoryListing,
  ExecuteRenameBatchRequest,
  ExecuteRenameBatchResult,
  HistoryEntry,
  PickSourcesRequest,
  PlatformTarget,
  Preset,
  PreviewRequest,
  PreviewResult,
  RenameRule,
  SourceMode,
  SourceSelection,
  UndoRenameBatchRequest,
  UndoRenameBatchResult,
} from '@fast-renamer/rename-engine';

const baseRuleSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
  label: z.string().optional(),
});

const renameRuleSchema = z.discriminatedUnion('type', [
  baseRuleSchema.extend({
    type: z.literal('new_name'),
    template: z.string(),
  }),
  baseRuleSchema.extend({
    type: z.literal('find_replace'),
    find: z.string(),
    replace: z.string(),
    matchCase: z.boolean(),
    useRegex: z.boolean(),
    replaceAll: z.boolean(),
  }),
  baseRuleSchema.extend({
    type: z.literal('prefix_suffix'),
    prefix: z.string(),
    suffix: z.string(),
  }),
  baseRuleSchema.extend({
    type: z.literal('case_transform'),
    mode: z.enum(['lower', 'upper', 'title', 'sentence', 'camel', 'pascal', 'kebab', 'snake']),
  }),
  baseRuleSchema.extend({
    type: z.literal('trim_text'),
    mode: z.enum([
      'trim',
      'trim_start',
      'trim_end',
      'collapse_spaces',
      'remove_spaces',
      'remove_dashes',
      'remove_underscores',
    ]),
  }),
  baseRuleSchema.extend({
    type: z.literal('remove_text'),
    text: z.string(),
    matchCase: z.boolean(),
  }),
  baseRuleSchema.extend({
    type: z.literal('sequence_insert'),
    position: z.enum(['prefix', 'suffix', 'before_extension']),
    start: z.number().int(),
    step: z.number().int(),
    padWidth: z.number().int().min(0),
    separator: z.string(),
  }),
  baseRuleSchema.extend({
    type: z.literal('date_time'),
    position: z.enum(['prefix', 'suffix', 'before_extension']),
    format: z.string(),
    separator: z.string(),
  }),
  baseRuleSchema.extend({
    type: z.literal('extension_handling'),
    mode: z.enum(['keep', 'lowercase', 'uppercase', 'replace', 'remove']),
    replacement: z.string(),
  }),
]);

const platformSchema = z.enum(['darwin', 'win32', 'linux']) satisfies z.ZodType<PlatformTarget>;
const sourceModeSchema = z.enum([
  'picked_folders',
  'picked_files',
  'top_level_folders',
  'subfolders',
  'top_level_files',
  'files_recursive',
]) satisfies z.ZodType<SourceMode>;

export const pickSourcesRequestSchema = z.object({
  mode: sourceModeSchema,
}) satisfies z.ZodType<PickSourcesRequest>;

export const previewRequestSchema = z.object({
  sourcePaths: z.array(z.string().min(1)),
  sourceMode: sourceModeSchema,
  fileNamePattern: z.string(),
  rules: z.array(renameRuleSchema),
  platform: platformSchema,
}) satisfies z.ZodType<PreviewRequest>;

export const executeRenameBatchRequestSchema =
  previewRequestSchema satisfies z.ZodType<ExecuteRenameBatchRequest>;

export const undoRenameBatchRequestSchema = z.object({
  batchId: z.number().int().positive(),
}) satisfies z.ZodType<UndoRenameBatchRequest>;

export const sourceSelectionSchema = z.object({
  path: z.string(),
  name: z.string(),
  parentPath: z.string(),
  isDirectory: z.boolean(),
}) satisfies z.ZodType<SourceSelection>;

export const directoryListingSchema = z.object({
  sourcePath: z.string(),
  directChildren: z.number().int(),
  recursiveChildren: z.number().int(),
  items: z.array(sourceSelectionSchema),
}) satisfies z.ZodType<DirectoryListing>;

export const presetSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  isSample: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  rules: z.array(renameRuleSchema),
}) satisfies z.ZodType<Preset>;

export const historyEntrySchema = z.object({
  id: z.number().int(),
  createdAt: z.string(),
  renamedCount: z.number().int(),
  sourceRoots: z.array(z.string()),
  rules: z.array(renameRuleSchema),
  previewSummary: z.object({
    total: z.number().int(),
    changed: z.number().int(),
    ok: z.number().int(),
    conflict: z.number().int(),
    invalid: z.number().int(),
    unchanged: z.number().int(),
    blocked: z.boolean(),
  }),
  canUndo: z.boolean(),
  undoState: z.enum(['ready', 'archived', 'overlap', 'missing', 'occupied']),
  undoReason: z.string().optional(),
}) satisfies z.ZodType<HistoryEntry>;

export interface WindowState {
  isMaximized: boolean;
}

export interface AdvancedRenamerApi {
  getDroppedPaths(files: File[]): string[];
  pickSources(request: PickSourcesRequest): Promise<SourceSelection[]>;
  resolveSources(paths: string[]): Promise<SourceSelection[]>;
  loadDirectoryItems(paths: string[]): Promise<DirectoryListing[]>;
  generatePreview(request: PreviewRequest): Promise<PreviewResult>;
  executeRenameBatch(request: ExecuteRenameBatchRequest): Promise<ExecuteRenameBatchResult>;
  undoRenameBatch(request: UndoRenameBatchRequest): Promise<UndoRenameBatchResult>;
  listPresets(): Promise<Preset[]>;
  savePreset(input: { id?: number; name: string; rules: RenameRule[] }): Promise<Preset>;
  deletePreset(id: number): Promise<void>;
  listHistory(): Promise<HistoryEntry[]>;
  minimizeWindow(): Promise<void>;
  toggleMaximizeWindow(): Promise<WindowState>;
  closeWindow(): Promise<void>;
  getWindowState(): Promise<WindowState>;
  onWindowStateChanged(listener: (state: WindowState) => void): () => void;
}

export type {
  ExecuteRenameBatchRequest,
  ExecuteRenameBatchResult,
  HistoryEntry,
  PickSourcesRequest,
  Preset,
  PreviewRequest,
  PreviewResult,
  RenameRule,
  SourceMode,
  UndoRenameBatchRequest,
  UndoRenameBatchResult,
};
