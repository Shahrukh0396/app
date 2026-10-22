export interface StatItem {
  label: string;
  value: string | number;
}

export function StatGrid({ items }: { items: StatItem[] }) {
  return (
    <section className="stat-grid" aria-label="Summary">
      {items.map((item) => (
        <article key={item.label} className="stat-card">
          <p className="stat-label">{item.label}</p>
          <p className="stat-value">{item.value}</p>
        </article>
      ))}
    </section>
  );
}
