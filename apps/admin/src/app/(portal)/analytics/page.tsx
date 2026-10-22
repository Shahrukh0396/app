import { Shell } from '../../../components/Shell';
import { StatGrid } from '../../../components/StatGrid';
import { apiGet } from '../../../lib/api';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  let data = { windowDays: 30, newUsers: 0, newDocuments: 0, logins: 0 };
  try {
    data = await apiGet<typeof data>('/admin/analytics');
  } catch {
    data = { windowDays: 30, newUsers: 0, newDocuments: 0, logins: 0 };
  }
  return (
    <Shell title="Analytics">
      <StatGrid
        items={[
          { label: `New users (${data.windowDays}d)`, value: data.newUsers },
          { label: 'New documents', value: data.newDocuments },
          { label: 'Logins', value: data.logins },
        ]}
      />
    </Shell>
  );
}
