import { DataTable } from '../../../components/DataTable';
import { Shell } from '../../../components/Shell';
import { apiGet } from '../../../lib/api';

export const dynamic = 'force-dynamic';

export default async function DocumentsPage() {
  let rows: Array<{ title: string; email: string; pageCount: number; size: number; documentType: string; deletedAt: string | null }> = [];
  try {
    rows = await apiGet<typeof rows>('/admin/documents');
  } catch {
    rows = [];
  }
  return (
    <Shell title="Documents">
      <DataTable
        columns={['Title', 'Owner', 'Type', 'Pages', 'Bytes', 'Deleted']}
        rows={rows.map((row) => [row.title, row.email, row.documentType, row.pageCount, row.size, row.deletedAt])}
      />
    </Shell>
  );
}
