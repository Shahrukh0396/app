import { Shell } from '../../../components/Shell';
import { StatGrid } from '../../../components/StatGrid';
import { DataTable } from '../../../components/DataTable';
import { apiGet } from '../../../lib/api';

export const dynamic = 'force-dynamic';

export default async function StoragePage() {
  let data = { documents: 0, bytes: 0, pages: 0, topUsers: [] as Array<{ userId: string; bytes: number }> };
  try {
    data = await apiGet<typeof data>('/admin/storage');
  } catch {
    data = { documents: 0, bytes: 0, pages: 0, topUsers: [] };
  }
  return (
    <Shell title="Storage">
      <StatGrid
        items={[
          { label: 'Documents', value: data.documents },
          { label: 'Bytes', value: data.bytes },
          { label: 'Pages', value: data.pages },
        ]}
      />
      <DataTable columns={['User', 'Bytes']} rows={data.topUsers.map((row) => [row.userId, row.bytes])} />
    </Shell>
  );
}
