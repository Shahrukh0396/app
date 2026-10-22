export interface FlatFolder {
  id: string;
  name: string;
  parentFolderId: string | null;
}

export type FolderNode<T extends FlatFolder> = T & {
  children: Array<FolderNode<T>>;
};

export function buildFolderTree<T extends FlatFolder>(folders: T[]): Array<FolderNode<T>> {
  const nodes = new Map<string, FolderNode<T>>();
  for (const folder of folders) {
    nodes.set(folder.id, { ...folder, children: [] });
  }
  const roots: Array<FolderNode<T>> = [];
  for (const folder of folders) {
    const node = nodes.get(folder.id);
    if (!node) continue;
    const parentId = folder.parentFolderId;
    const parent = parentId ? nodes.get(parentId) : undefined;
    if (parent && parent.id !== node.id) parent.children.push(node);
    else roots.push(node);
  }
  const sortTree = (list: Array<FolderNode<T>>) => {
    list.sort((a, b) => a.name.localeCompare(b.name));
    list.forEach((child) => sortTree(child.children));
  };
  sortTree(roots);
  return roots;
}

export function collectDescendantIds(folders: FlatFolder[], rootId: string): string[] {
  const children = new Map<string, string[]>();
  for (const folder of folders) {
    if (!folder.parentFolderId) continue;
    const list = children.get(folder.parentFolderId) ?? [];
    list.push(folder.id);
    children.set(folder.parentFolderId, list);
  }
  const ids: string[] = [];
  const walk = (id: string) => {
    ids.push(id);
    for (const child of children.get(id) ?? []) walk(child);
  };
  walk(rootId);
  return ids;
}
