import { Shell } from '../../../components/Shell';
import { StatGrid } from '../../../components/StatGrid';
import { apiGet } from '../../../lib/api';

export const dynamic = 'force-dynamic';

interface Stats {
  users: number;
  documents: number;
  pages: number;
  openTickets: number;
}

export default async function DashboardPage() {
  let stats: Stats | null = null;
  let error = '';
  try {
    stats = await apiGet<Stats>('/admin/stats');
  } catch (err) {
    error = err instanceof Error ? err.message : 'Dashboard unavailable';
  }
  return (
    <Shell title="Dashboard">
      {error ? <p className="error">{error}</p> : null}
      <StatGrid
        items={[
          { label: 'Users', value: stats?.users ?? '—' },
          { label: 'Documents', value: stats?.documents ?? '—' },
          { label: 'Pages', value: stats?.pages ?? '—' },
          { label: 'Open tickets', value: stats?.openTickets ?? '—' },
        ]}
      />
    </Shell>
  );
}
