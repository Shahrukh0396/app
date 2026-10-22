export function DataTable({ columns, rows }: { columns: string[]; rows: Array<Array<string | number | null>> }) {
  return (
    <table>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column}>{column}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length}>No rows</td>
          </tr>
        ) : (
          rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td key={`${index}-${cellIndex}`}>{cell ?? '—'}</td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
