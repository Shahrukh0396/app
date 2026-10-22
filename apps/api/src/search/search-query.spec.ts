import { DocumentType } from '@scanflow/types';
import { buildDocumentSearch } from './search-query';

describe('buildDocumentSearch', () => {
  it('scopes a plain query to the user and binds every filter', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-02-01T00:00:00.000Z');
    const built = buildDocumentSearch({
      userId: 'user-1',
      teamIds: [],
      q: 'invoice acme',
      type: DocumentType.RECEIPT,
      tag: 'Tax',
      from,
      to,
      limit: 25,
    });
    expect(built.sql).toContain(`plainto_tsquery('simple', $2)`);
    expect(built.sql).toContain(`d."documentType" = $3::"DocumentType"`);
    expect(built.sql).toContain('lower(t.tag) = $4');
    expect(built.sql).toContain('d."createdAt" >= $5');
    expect(built.sql).toContain('d."createdAt" <= $6');
    expect(built.sql).toContain('LIMIT $7');
    expect(built.params).toEqual(['user-1', 'invoice acme', DocumentType.RECEIPT, 'tax', from, to, 25]);
  });

  it('includes team ids without interpolating them into the SQL text', () => {
    const built = buildDocumentSearch({
      userId: 'user-1',
      teamIds: ['team-a', "team'); drop"],
      limit: 10,
    });
    expect(built.sql).toContain('ANY($2::text[])');
    expect(built.sql).not.toContain('drop');
    expect(built.params[1]).toEqual(['team-a', "team'); drop"]);
    expect(built.params[2]).toBe(10);
  });
});
