import { buildFolderTree, collectDescendantIds } from './folder-tree';

describe('folder tree', () => {
  const folders = [
    { id: 'a', name: 'Inbox', parentFolderId: null },
    { id: 'b', name: 'Taxes', parentFolderId: 'a' },
    { id: 'c', name: '2024', parentFolderId: 'b' },
    { id: 'd', name: 'Receipts', parentFolderId: null },
  ];

  it('nests children under their parent and sorts siblings', () => {
    const tree = buildFolderTree(folders);
    expect(tree.map((node) => node.name)).toEqual(['Inbox', 'Receipts']);
    expect(tree[0]?.children[0]?.name).toBe('Taxes');
    expect(tree[0]?.children[0]?.children[0]?.id).toBe('c');
  });

  it('promotes orphans to roots when the parent is missing', () => {
    const tree = buildFolderTree([{ id: 'x', name: 'Loose', parentFolderId: 'missing' }]);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.id).toBe('x');
  });

  it('collects a folder and every descendant', () => {
    expect(collectDescendantIds(folders, 'a')).toEqual(['a', 'b', 'c']);
    expect(collectDescendantIds(folders, 'd')).toEqual(['d']);
  });
});
