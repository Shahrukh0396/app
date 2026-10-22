import { PageSizeName } from '@scanflow/types';

export interface PageSize {
  width: number;
  height: number;
}

export const PAGE_SIZES: Record<PageSizeName, PageSize> = {
  A4: { width: 595.28, height: 841.89 },
  LETTER: { width: 612, height: 792 },
  LEGAL: { width: 612, height: 1008 },
};

export function resolvePageSize(name: PageSizeName | undefined): PageSize {
  if (!name) return PAGE_SIZES.A4;
  return PAGE_SIZES[name];
}
