import { DataTable } from '../../../components/DataTable';
import { Shell } from '../../../components/Shell';
import { apiGet } from '../../../lib/api';

export const dynamic = 'force-dynamic';

export default async function RevenuePage() {
  let rows: Array<{ plan: string; status: string; count: number }> = [];
  try {
    rows = await apiGet<typeof rows>('/admin/revenue');
  } catch {
    rows = [];
  }
  return (
    <Shell title="Revenue">
      <DataTable columns={['Plan', 'Status', 'Count']} rows={rows.map((row) => [row.plan, row.status, row.count])} />
    </Shell>
  );
}
