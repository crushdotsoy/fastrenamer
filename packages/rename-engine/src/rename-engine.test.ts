import os from 'node:os';
import path from 'node:path';
import { applyRulesToName, generatePreview } from './rename-engine';
import type { RenameRule, ResolvedRenameItem } from './types';

describe('applyRulesToName', () => {
  it('applies ordered transforms without mutating the extension', () => {
    const rules: RenameRule[] = [
      {
        id: 'trim',
        type: 'trim_text',
        enabled: true,
        mode: 'collapse_spaces',
      },
      {
        id: 'case',
        type: 'case_transform',
        enabled: true,
        mode: 'snake',
      },
      {
        id: 'ext',
        type: 'extension_handling',
        enabled: true,
        mode: 'lowercase',
        replacement: '',
      },
    ];

    expect(
      applyRulesToName('  Final Report 2026.TXT  ', false, rules, {
        index: 0,
        total: 1,
        originalName: '  Final Report 2026.TXT  ',
        parentPath: '/tmp',
      }),
    ).toBe(
      'final_report_2026.txt  ',
    );
  });

  it('renders new-name templates with sequence and original stem tokens', () => {
    const rules: RenameRule[] = [
      {
        id: 'new-name',
        type: 'new_name',
        enabled: true,
        template: 'name_{seq_num:0001}_{original_stem}',
      },
    ];

    expect(
      applyRulesToName('Report Final.txt', false, rules, {
        index: 1,
        total: 3,
        originalName: 'Report Final.txt',
        parentPath: '/tmp/Clients',
      }),
    ).toBe('name_0002_Report Final.txt');
  });
});

describe('generatePreview', () => {
  it('uses natural sort order for sequence numbering', () => {
    const preview = generatePreview({
      items: [
        {
          sourcePath: '/tmp/file10.txt',
          name: 'file10.txt',
          parentPath: '/tmp',
          isDirectory: false,
        },
        {
          sourcePath: '/tmp/file2.txt',
          name: 'file2.txt',
          parentPath: '/tmp',
          isDirectory: false,
        },
        {
          sourcePath: '/tmp/file1.txt',
          name: 'file1.txt',
          parentPath: '/tmp',
          isDirectory: false,
        },
      ],
      rules: [
        {
          id: 'seq',
          type: 'sequence_insert',
          enabled: true,
          position: 'prefix',
          start: 1,
          step: 1,
          padWidth: 0,
          separator: '_',
        },
      ],
      platform: 'linux',
      existingPathExists: () => false,
    });

    expect(preview.rows.map((row) => row.proposedName)).toEqual([
      '1_file1.txt',
      '2_file2.txt',
      '3_file10.txt',
    ]);
  });

  it('resolves nested child targets under renamed parent directories', () => {
    const root = path.join(os.tmpdir(), 'fast-renamer-preview');
    const items: ResolvedRenameItem[] = [
      {
        sourcePath: path.join(root, 'Parent Folder'),
        name: 'Parent Folder',
        parentPath: root,
        isDirectory: true,
      },
      {
        sourcePath: path.join(root, 'Parent Folder', 'Quarterly Report.TXT'),
        name: 'Quarterly Report.TXT',
        parentPath: path.join(root, 'Parent Folder'),
        isDirectory: false,
      },
    ];

    const rules: RenameRule[] = [
      {
        id: 'case',
        type: 'case_transform',
        enabled: true,
        mode: 'snake',
      },
      {
        id: 'ext',
        type: 'extension_handling',
        enabled: true,
        mode: 'lowercase',
        replacement: '',
      },
    ];

    const preview = generatePreview({
      items,
      rules,
      platform: 'linux',
      existingPathExists: () => false,
    });

    const parentRow = preview.rows.find((row) => row.originalName === 'Parent Folder');
    const childRow = preview.rows.find((row) => row.originalName === 'Quarterly Report.TXT');

    expect(parentRow?.nextPath).toBe(path.join(root, 'parent_folder'));
    expect(childRow?.finalDirectoryPath).toBe(path.join(root, 'parent_folder'));
    expect(childRow?.nextPath).toBe(path.join(root, 'parent_folder', 'quarterly_report.txt'));
  });

  it('flags duplicate destinations as conflicts', () => {
    const items: ResolvedRenameItem[] = [
      {
        sourcePath: '/tmp/alpha.txt',
        name: 'alpha.txt',
        parentPath: '/tmp',
        isDirectory: false,
      },
      {
        sourcePath: '/tmp/beta.txt',
        name: 'beta.txt',
        parentPath: '/tmp',
        isDirectory: false,
      },
    ];

    const preview = generatePreview({
      items,
      rules: [
        {
          id: 'replace',
          type: 'find_replace',
          enabled: true,
          find: 'alpha',
          replace: 'shared',
          matchCase: true,
          useRegex: false,
          replaceAll: false,
        },
        {
          id: 'replace-2',
          type: 'find_replace',
          enabled: true,
          find: 'beta',
          replace: 'shared',
          matchCase: true,
          useRegex: false,
          replaceAll: false,
        },
      ],
      platform: 'linux',
      existingPathExists: () => false,
    });

    expect(preview.rows.map((row) => row.status)).toEqual(['conflict', 'conflict']);
    expect(preview.summary.conflict).toBe(2);
    expect(preview.summary.blocked).toBe(true);
  });

  it('marks case-only renames as ok with staging guidance on macOS', () => {
    const preview = generatePreview({
      items: [
        {
          sourcePath: '/tmp/Report.txt',
          name: 'Report.txt',
          parentPath: '/tmp',
          isDirectory: false,
        },
      ],
      rules: [
        {
          id: 'lower',
          type: 'case_transform',
          enabled: true,
          mode: 'lower',
        },
      ],
      platform: 'darwin',
      existingPathExists: () => true,
    });

    expect(preview.rows[0].status).toBe('ok');
    expect(preview.rows[0].reasons.join(' ')).toContain('Case-only rename');
  });
});
