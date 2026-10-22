import { DataTable } from '../../../components/DataTable';
import { Shell } from '../../../components/Shell';
import { apiGet } from '../../../lib/api';

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  let rows: Array<{ action: string; entity: string; email: string | null; ip: string | null; createdAt: string }> = [];
  try {
    rows = await apiGet<typeof rows>('/admin/audit');
  } catch {
    rows = [];
  }
  return (
    <Shell title="Audit logs">
      <DataTable
        columns={['Action', 'Entity', 'Email', 'IP', 'When']}
        rows={rows.map((row) => [row.action, row.entity, row.email, row.ip, row.createdAt])}
      />
    </Shell>
  );
}
