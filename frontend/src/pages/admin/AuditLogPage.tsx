import { useMemo, useState } from 'react';
import { Eye, FileText, RotateCcw, ScrollText } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { buildPaginationMeta } from '@/utils/pagination';
import { DefinitionList } from '@/components/common/DefinitionList';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchInput } from '@/components/common/SearchInput';
import { useAuditLogs } from '@/hooks/queries/useAdminQueries';
import { formatDateTime, formatTimeAgo } from '@/utils/format';
import type { AuditLog } from '@/types';

const AUDIT_PAGE_SIZE = 50;

/** Human-readable label for the audit actions the backend records. */
function actionLabel(action: string): string {
  return action
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function actionTone(action: string): 'success' | 'danger' | 'warning' | 'info' | 'neutral' {
  const upper = action.toUpperCase();
  if (upper.includes('DELETE') || upper.includes('DEACTIVATE') || upper.includes('RESET'))
    return 'danger';
  if (upper.includes('CREATE') || upper.includes('ADD') || upper.includes('LOGIN_SUCCESS'))
    return 'success';
  if (upper.includes('FAILED') || upper.includes('LOCKED') || upper.includes('CORRECT'))
    return 'warning';
  if (upper.includes('UPDATE') || upper.includes('PATCH')) return 'info';
  return 'neutral';
}

/**
 * Audit trail for administrators.
 *
 * Backed by GET /admin/audit-logs (page + pageSize only). Action/entity/user
 * filtering is applied to the fetched page in the browser because the endpoint
 * accepts no filter parameters - noted here and in API_CONTRACT.md.
 */
export function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const audit = useAuditLogs({ page, pageSize: AUDIT_PAGE_SIZE });

  const meta = buildPaginationMeta({
    total: audit.data?.total ?? 0,
    page: audit.data?.page ?? page,
    pageSize: audit.data?.pageSize ?? AUDIT_PAGE_SIZE,
  });

  const rows = useMemo(() => {
    const items = audit.data?.items ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((entry) =>
      [entry.action, entry.entityType ?? '', entry.entityId ?? '', entry.user?.email ?? '']
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [audit.data, search]);

  const columns: DataTableColumn<AuditLog>[] = [
    {
      id: 'action',
      header: 'Action',
      cell: (entry) => <Badge tone={actionTone(entry.action)}>{actionLabel(entry.action)}</Badge>,
    },
    {
      id: 'entity',
      header: 'Entity',
      cell: (entry) => (
        <div>
          <div className="cell-primary">{entry.entityType ?? '—'}</div>
          {entry.entityId ? (
            <div className="cell-sub text-mono">{entry.entityId.slice(0, 8)}</div>
          ) : null}
        </div>
      ),
    },
    {
      id: 'user',
      header: 'Performed by',
      cell: (entry) =>
        entry.user ? (
          <div>
            <div className="cell-primary">{entry.user.email}</div>
            <div className="cell-sub">{entry.user.role}</div>
          </div>
        ) : (
          <span className="text-caption">System</span>
        ),
      hideOn: 'tablet',
    },
    {
      id: 'ip',
      header: 'IP address',
      cell: (entry) => <span className="text-mono text-caption">{entry.ipAddress ?? '—'}</span>,
      hideOn: 'tablet',
    },
    {
      id: 'createdAt',
      header: 'When',
      align: 'right',
      cell: (entry) => (
        <div>
          <div className="cell-primary">{formatTimeAgo(entry.createdAt)}</div>
          <div className="cell-sub">{formatDateTime(entry.createdAt)}</div>
        </div>
      ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      className: 'cell-actions',
      cell: (entry) => (
        <IconButton
          size="sm"
          variant="bordered"
          icon={<Eye size={15} />}
          label="View audit entry details"
          onClick={() => setSelected(entry)}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Everything recorded by the backend: logins, data changes and administrative actions."
        actions={
          <Button
            variant="secondary"
            icon={<RotateCcw size={16} />}
            onClick={() => void audit.refetch()}
            isLoading={audit.isFetching}
            loadingText="Loading…"
          >
            Refresh
          </Button>
        }
      />

      <Alert tone="info" title="Filtering" icon={<ScrollText size={17} />}>
        The audit endpoint pages through the newest entries server-side (50 per page). The search
        box narrows the entries on the current page only, because the backend accepts no action,
        entity or date filter - the required parameters are listed in{' '}
        <code className="text-mono">frontend/API_CONTRACT.md</code>.
      </Alert>

      <Card flush>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(entry) => entry.id}
          isLoading={audit.isPending}
          isFetching={audit.isFetching}
          error={audit.isError ? audit.error : null}
          onRetry={() => void audit.refetch()}
          caption="Audit log entries"
          onRowClick={(entry) => setSelected(entry)}
          emptyVariant={search ? 'search' : 'default'}
          emptyTitle={search ? 'No entries on this page match' : 'No audit entries yet'}
          emptyMessage={
            search
              ? 'Clear the search or move to another page.'
              : 'Entries appear as soon as accounts are created and administrative actions are performed.'
          }
          toolbar={
            <div className="toolbar">
              <SearchInput
                className="toolbar__group"
                label="Search audit entries"
                placeholder="Search action, entity or user…"
                value={search}
                onChange={setSearch}
              />
              <div className="toolbar__actions">
                <span className="text-caption">
                  Page {meta.page} of {Math.max(meta.totalPages, 1)} · newest first
                </span>
              </div>
            </div>
          }
          footer={
            <Pagination
              meta={meta}
              onPageChange={setPage}
              isLoading={audit.isFetching}
              itemLabel="entries"
            />
          }
          renderMobileCard={(entry) => (
            <>
              <div className="card-list__header">
                <Badge tone={actionTone(entry.action)}>{actionLabel(entry.action)}</Badge>
                <span className="text-caption">{formatTimeAgo(entry.createdAt)}</span>
              </div>
              <dl className="card-list__meta">
                <div>
                  <dt>Entity</dt>
                  <dd>{entry.entityType ?? '—'}</dd>
                </div>
                <div>
                  <dt>Performed by</dt>
                  <dd>{entry.user?.email ?? 'System'}</dd>
                </div>
                <div>
                  <dt>When</dt>
                  <dd>{formatDateTime(entry.createdAt)}</dd>
                </div>
              </dl>
              <div className="card-list__actions">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Eye size={14} />}
                  onClick={() => setSelected(entry)}
                >
                  View details
                </Button>
              </div>
            </>
          )}
        />
      </Card>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? actionLabel(selected.action) : 'Audit entry'}
        description={selected ? formatDateTime(selected.createdAt) : undefined}
        size="md"
        footer={
          <Button variant="secondary" onClick={() => setSelected(null)}>
            Close
          </Button>
        }
      >
        {selected ? (
          <div className="stack stack-4">
            <DefinitionList
              stacked
              items={[
                { term: 'Action', value: selected.action, mono: true },
                { term: 'Entity type', value: selected.entityType },
                { term: 'Entity ID', value: selected.entityId, mono: true },
                {
                  term: 'Performed by',
                  value: selected.user
                    ? `${selected.user.email} (${selected.user.role})`
                    : 'System',
                },
                { term: 'User ID', value: selected.userId, mono: true },
                { term: 'IP address', value: selected.ipAddress, mono: true },
                { term: 'Timestamp', value: formatDateTime(selected.createdAt) },
              ]}
            />

            <div className="stack stack-2">
              <h3 className="section-title row" style={{ gap: 'var(--space-2)' }}>
                <FileText size={15} aria-hidden="true" />
                Metadata
              </h3>
              <pre className="code-block">{formatMetadata(selected.metadata)}</pre>
            </div>

            {selected.userAgent ? (
              <p className="text-caption">
                <strong>User agent:</strong> {selected.userAgent}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}

function formatMetadata(metadata: unknown): string {
  if (metadata === null || metadata === undefined) return 'No metadata recorded for this entry.';
  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return String(metadata);
  }
}
