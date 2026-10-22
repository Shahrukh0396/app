import { DataTable } from '../../../components/DataTable';
import { Shell } from '../../../components/Shell';
import { apiGet } from '../../../lib/api';

export const dynamic = 'force-dynamic';

export default async function SupportPage() {
  let rows: Array<{ subject: string; email: string; status: string; createdAt: string }> = [];
  try {
    rows = await apiGet<typeof rows>('/admin/tickets');
  } catch {
    rows = [];
  }
  return (
    <Shell title="Support tickets">
      <DataTable
        columns={['Subject', 'Email', 'Status', 'Created']}
        rows={rows.map((row) => [row.subject, row.email, row.status, row.createdAt])}
      />
    </Shell>
  );
}
