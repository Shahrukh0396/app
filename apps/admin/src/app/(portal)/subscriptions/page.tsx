import { DataTable } from '../../../components/DataTable';
import { Shell } from '../../../components/Shell';
import { apiGet } from '../../../lib/api';

export const dynamic = 'force-dynamic';

export default async function SubscriptionsPage() {
  const rows = await safe<Array<{ email: string; plan: string; status: string; revenueCatId: string | null; expiresAt: string | null }>>('/admin/subscriptions');
  return (
    <Shell title="Subscriptions">
      <DataTable
        columns={['Email', 'Plan', 'Status', 'RevenueCat', 'Expires']}
        rows={rows.map((row) => [row.email, row.plan, row.status, row.revenueCatId, row.expiresAt])}
      />
    </Shell>
  );
}

async function safe<T extends unknown[]>(path: string): Promise<T> {
  try {
    return await apiGet<T>(path);
  } catch {
    return [] as unknown as T;
  }
}
