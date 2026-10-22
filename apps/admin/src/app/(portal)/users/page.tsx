import { DataTable } from '../../../components/DataTable';
import { Shell } from '../../../components/Shell';
import { apiGet } from '../../../lib/api';

export const dynamic = 'force-dynamic';

interface UserRow {
  name: string;
  email: string;
  role: string;
  plan: string;
  createdAt: string;
}

export default async function UsersPage() {
  const rows = await load<UserRow[]>('/admin/users');
  return (
    <Shell title="Users">
      <DataTable
        columns={['Name', 'Email', 'Role', 'Plan', 'Created']}
        rows={rows.map((row) => [row.name, row.email, row.role, row.plan, row.createdAt])}
      />
    </Shell>
  );
}

async function load<T extends unknown[]>(path: string): Promise<T> {
  try {
    return await apiGet<T>(path);
  } catch {
    return [] as unknown as T;
  }
}
