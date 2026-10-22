import { Shell } from '../../../components/Shell';
import { StatGrid } from '../../../components/StatGrid';

export const dynamic = 'force-dynamic';

export default async function HealthPage() {
  const base = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
  const status = await readStatus(`${base}/health`);
  const ready = await readStatus(`${base}/ready`);
  return (
    <Shell title="System health">
      <StatGrid
        items={[
          { label: '/health', value: status },
          { label: '/ready', value: ready },
        ]}
      />
    </Shell>
  );
}

async function readStatus(url: string): Promise<string> {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    return response.ok ? 'ok' : String(response.status);
  } catch {
    return 'down';
  }
}
