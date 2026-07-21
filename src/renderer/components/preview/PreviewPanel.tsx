import { Badge, EmptyState, Panel, PanelHeader, cn } from '../ui';
import type { PreviewResult } from '@fast-renamer/rename-engine/types';
import { STATUS_OPTIONS, type StatusFilter } from '../../app/defaults';
import { useI18n } from '../../i18n';

export function PreviewPanel({
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
            <thead className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur-sm">
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
                  className={cn(
                    'border-b border-border/40 transition-colors',
                    'border-l-[3px]',
                    row.status === 'ok' && 'border-l-ok/70 hover:bg-ok/5',
                    row.status === 'conflict' && 'border-l-conflict/80 bg-conflict/[0.04] hover:bg-conflict/[0.08]',
                    row.status === 'invalid' && 'border-l-invalid/80 bg-invalid/[0.04] hover:bg-invalid/[0.08]',
                    row.status === 'unchanged' && 'border-l-transparent hover:bg-surface/60',
                  )}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge dot tone={row.status}>{row.status}</Badge>
                  </td>
                  <td
                    className={cn(
                      'px-4 py-3 font-mono text-xs',
                      row.changed
                        ? 'text-muted-foreground/70 line-through decoration-muted-foreground/40'
                        : 'text-muted-foreground',
                    )}
                  >
                    {row.originalName}
                  </td>
                  <td
                    className={cn(
                      'px-4 py-3 font-mono text-xs font-semibold tracking-tight',
                      row.status === 'ok' && 'text-ok',
                      row.status === 'conflict' && 'text-conflict',
                      row.status === 'invalid' && 'text-invalid',
                      row.status === 'unchanged' && 'font-medium text-muted-foreground',
                    )}
                  >
                    <span className="inline-flex items-center gap-2">
                      {row.changed && (
                        <span className="text-[10px] font-sans font-semibold uppercase tracking-wider text-muted-foreground/60" aria-hidden>
                          →
                        </span>
                      )}
                      {row.proposedName}
                    </span>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-xs text-muted-foreground truncate">
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
