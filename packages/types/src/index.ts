export const UserRole = {
  USER: 'USER',
  ADMIN: 'ADMIN',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const AuthProvider = {
  EMAIL: 'EMAIL',
  GOOGLE: 'GOOGLE',
  APPLE: 'APPLE',
  MICROSOFT: 'MICROSOFT',
} as const;
export type AuthProvider = (typeof AuthProvider)[keyof typeof AuthProvider];

export const Plan = {
  FREE: 'FREE',
  PREMIUM: 'PREMIUM',
  BUSINESS: 'BUSINESS',
} as const;
export type Plan = (typeof Plan)[keyof typeof Plan];

export const SubscriptionStatus = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  CANCELED: 'CANCELED',
  TRIAL: 'TRIAL',
  PAST_DUE: 'PAST_DUE',
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const TeamRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  EDITOR: 'EDITOR',
  VIEWER: 'VIEWER',
} as const;
export type TeamRole = (typeof TeamRole)[keyof typeof TeamRole];

export const DocumentType = {
  DOCUMENT: 'DOCUMENT',
  RECEIPT: 'RECEIPT',
  ID_CARD: 'ID_CARD',
  PHOTO: 'PHOTO',
  WHITEBOARD: 'WHITEBOARD',
  OTHER: 'OTHER',
} as const;
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

export const PageFilterName = {
  ORIGINAL: 'ORIGINAL',
  MAGIC_COLOR: 'MAGIC_COLOR',
  BLACK_WHITE: 'BLACK_WHITE',
  GRAYSCALE: 'GRAYSCALE',
  COLOR_ENHANCE: 'COLOR_ENHANCE',
  HIGH_CONTRAST: 'HIGH_CONTRAST',
  DOCUMENT: 'DOCUMENT',
  RECEIPT: 'RECEIPT',
  PHOTO: 'PHOTO',
} as const;
export type PageFilterName = (typeof PageFilterName)[keyof typeof PageFilterName];

export const SharePermission = {
  VIEW: 'VIEW',
  EDIT: 'EDIT',
} as const;
export type SharePermission = (typeof SharePermission)[keyof typeof SharePermission];

export const TicketStatus = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
} as const;
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const SyncEntity = {
  FOLDER: 'folder',
  DOCUMENT: 'document',
  PAGE: 'page',
} as const;
export type SyncEntity = (typeof SyncEntity)[keyof typeof SyncEntity];

export const PageSizeName = {
  A4: 'A4',
  LETTER: 'LETTER',
  LEGAL: 'LEGAL',
} as const;
export type PageSizeName = (typeof PageSizeName)[keyof typeof PageSizeName];

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface AuthResponse extends AuthTokens {
  user: PublicUser;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  provider: AuthProvider;
  role: UserRole;
  createdAt: string;
}

export interface FolderRecord {
  id: string;
  userId: string;
  name: string;
  parentFolderId: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface FolderTreeNode extends FolderRecord {
  children: FolderTreeNode[];
}

export interface PageRecord {
  id: string;
  documentId: string;
  imageUrl: string;
  storageKey: string | null;
  mime: string | null;
  pageNumber: number;
  width: number;
  height: number;
  ocrText: string;
  rotation: number;
  filter: PageFilterName;
  size: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRecord {
  id: string;
  userId: string;
  folderId: string | null;
  teamId: string | null;
  title: string;
  description: string;
  thumbnail: string | null;
  previewImage: string | null;
  pdfUrl: string | null;
  ocrText: string;
  pageCount: number;
  size: number;
  favorite: boolean;
  archived: boolean;
  documentType: DocumentType;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  version: number;
  tags: string[];
  pages?: PageRecord[];
}

export interface PlanCatalogEntry {
  id: Plan;
  name: string;
  priceMonthlyCents: number;
  features: string[];
}

export interface SyncChange {
  entity: SyncEntity;
  op: 'upsert' | 'delete';
  id: string;
  version: number;
  payload: Record<string, unknown>;
}

export interface SyncPushRequest {
  deviceId: string;
  changes: SyncChange[];
}

export interface SyncConflictSummary {
  id: string;
  entity: SyncEntity;
  entityId: string;
  clientVersion: number;
  serverVersion: number;
}

export interface SyncPushResult {
  applied: Array<{ entity: SyncEntity; id: string; version: number }>;
  conflicts: SyncConflictSummary[];
}

export interface SyncPullResponse {
  serverTime: string;
  folders: FolderRecord[];
  documents: DocumentRecord[];
  pages: PageRecord[];
}

export interface ShareLinkRecord {
  id: string;
  documentId: string;
  token: string;
  url: string;
  permission: SharePermission;
  expiresAt: string | null;
  createdAt: string;
}

export interface NotificationPreferences {
  emailEnabled: boolean;
  pushEnabled: boolean;
  productUpdates: boolean;
  syncAlerts: boolean;
}

export interface HealthStatus {
  status: 'ok' | 'degraded';
  checks: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
  };
}

export const PLAN_CATALOG: PlanCatalogEntry[] = [
  {
    id: Plan.FREE,
    name: 'Free',
    priceMonthlyCents: 0,
    features: ['Local scans', '3 cloud documents', 'Basic filters', 'Search on device'],
  },
  {
    id: Plan.PREMIUM,
    name: 'Premium',
    priceMonthlyCents: 799,
    features: [
      'Unlimited cloud documents',
      'OCR in multiple languages',
      'Searchable PDF export',
      'Password and watermark',
      'Auto backup',
    ],
  },
  {
    id: Plan.BUSINESS,
    name: 'Business',
    priceMonthlyCents: 1999,
    features: [
      'Everything in Premium',
      'Teams and roles',
      'Shared links',
      'Audit log',
      'Priority OCR',
    ],
  },
];
