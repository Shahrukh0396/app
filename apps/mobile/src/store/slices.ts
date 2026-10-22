import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { DocumentRecord, FolderRecord, PublicUser } from '@scanflow/types';
import type { Quad } from '../scanner/homography';
import type { Adjustments, FilterName } from '../imaging/filters';
import { DEFAULT_ADJUSTMENTS } from '../imaging/filters';
import { syncQueueReducer, type SyncQueueAction, type SyncQueueItem } from '../sync/queue';
import type { ThemeMode } from '../theme/theme';
import type { Locale } from '../i18n';

export interface AuthState {
  user: PublicUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  deviceId: string;
  status: 'idle' | 'loading' | 'ready';
  error: string | null;
  unlocked: boolean;
}

export interface ScannerPage {
  id: string;
  uri: string;
  width: number;
  height: number;
  rotation: number;
  filter: FilterName;
  quad: Quad | null;
  ocrText: string;
  adjustments: Adjustments;
  flipped: boolean;
}

export interface ScannerState {
  step: 'capture' | 'crop' | 'enhance' | 'pages' | 'preview';
  pages: ScannerPage[];
  activePageId: string | null;
  autoCapture: boolean;
  batch: boolean;
  quadHistory: Quad[];
  stable: boolean;
  pdfUri: string | null;
}

export interface DocumentsState {
  documents: DocumentRecord[];
  folders: FolderRecord[];
  activeId: string | null;
  query: string;
}

export interface SettingsState {
  theme: ThemeMode;
  locale: Locale;
  autoEnhance: boolean;
  autoBackup: boolean;
  pdfCompression: 'low' | 'medium' | 'high';
  scannerResolution: 'standard' | 'high' | 'max';
  lockEnabled: boolean;
  lockType: 'none' | 'pin' | 'pattern' | 'biometric';
  onboardingComplete: boolean;
}

export interface SyncState {
  online: boolean;
  queue: SyncQueueItem[];
  lastPulledAt: string | null;
  conflicts: Array<{ id: string; entityId: string; clientVersion: number; serverVersion: number }>;
}

const deviceSeed = 'device-scanflow-local';

const authInitial: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  deviceId: deviceSeed,
  status: 'idle',
  error: null,
  unlocked: false,
};

const scannerInitial: ScannerState = {
  step: 'capture',
  pages: [],
  activePageId: null,
  autoCapture: true,
  batch: true,
  quadHistory: [],
  stable: false,
  pdfUri: null,
};

const settingsInitial: SettingsState = {
  theme: 'light',
  locale: 'en',
  autoEnhance: true,
  autoBackup: false,
  pdfCompression: 'medium',
  scannerResolution: 'high',
  lockEnabled: false,
  lockType: 'none',
  onboardingComplete: false,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState: authInitial,
  reducers: {
    setSession(state, action: PayloadAction<{ user: PublicUser; accessToken: string; refreshToken: string }>) {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.status = 'ready';
      state.error = null;
      state.unlocked = true;
    },
    setTokens(state, action: PayloadAction<{ accessToken: string; refreshToken: string }>) {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
    },
    setAuthError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.status = 'idle';
    },
    setDeviceId(state, action: PayloadAction<string>) {
      state.deviceId = action.payload;
    },
    setUnlocked(state, action: PayloadAction<boolean>) {
      state.unlocked = action.payload;
    },
    clearSession(state) {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.unlocked = false;
      state.status = 'idle';
    },
  },
});

export const scannerSlice = createSlice({
  name: 'scanner',
  initialState: scannerInitial,
  reducers: {
    setStep(state, action: PayloadAction<ScannerState['step']>) {
      state.step = action.payload;
    },
    setAutoCapture(state, action: PayloadAction<boolean>) {
      state.autoCapture = action.payload;
    },
    noteQuad(state, action: PayloadAction<{ quad: Quad | null; stable: boolean }>) {
      if (action.payload.quad) state.quadHistory.push(action.payload.quad);
      if (state.quadHistory.length > 8) state.quadHistory.shift();
      state.stable = action.payload.stable;
    },
    addPage(state, action: PayloadAction<ScannerPage>) {
      state.pages.push(action.payload);
      state.activePageId = action.payload.id;
      state.quadHistory = [];
      state.stable = false;
    },
    updateActivePage(state, action: PayloadAction<Partial<ScannerPage>>) {
      const page = state.pages.find((item) => item.id === state.activePageId);
      if (page) Object.assign(page, action.payload);
    },
    selectPage(state, action: PayloadAction<string>) {
      state.activePageId = action.payload;
    },
    reorderPages(state, action: PayloadAction<string[]>) {
      const order = new Map(action.payload.map((id, index) => [id, index]));
      state.pages.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    },
    removePage(state, action: PayloadAction<string>) {
      state.pages = state.pages.filter((page) => page.id !== action.payload);
      if (state.activePageId === action.payload) state.activePageId = state.pages[0]?.id ?? null;
    },
    duplicateActive(state) {
      const page = state.pages.find((item) => item.id === state.activePageId);
      if (!page) return;
      const copy: ScannerPage = { ...page, id: `${page.id}-copy-${state.pages.length}`, adjustments: { ...page.adjustments } };
      state.pages.push(copy);
      state.activePageId = copy.id;
    },
    rotateActive(state) {
      const page = state.pages.find((item) => item.id === state.activePageId);
      if (page) page.rotation = (page.rotation + 90) % 360;
    },
    setPdfUri(state, action: PayloadAction<string | null>) {
      state.pdfUri = action.payload;
    },
    resetSession() {
      return scannerInitial;
    },
  },
});

export const documentsSlice = createSlice({
  name: 'documents',
  initialState: { documents: [], folders: [], activeId: null, query: '' } as DocumentsState,
  reducers: {
    setDocuments(state, action: PayloadAction<DocumentRecord[]>) {
      state.documents = action.payload;
    },
    upsertDocument(state, action: PayloadAction<DocumentRecord>) {
      const index = state.documents.findIndex((doc) => doc.id === action.payload.id);
      if (index >= 0) state.documents[index] = action.payload;
      else state.documents.unshift(action.payload);
    },
    setFolders(state, action: PayloadAction<FolderRecord[]>) {
      state.folders = action.payload;
    },
    setActiveDocument(state, action: PayloadAction<string | null>) {
      state.activeId = action.payload;
    },
    setQuery(state, action: PayloadAction<string>) {
      state.query = action.payload;
    },
  },
});

export const settingsSlice = createSlice({
  name: 'settings',
  initialState: settingsInitial,
  reducers: {
    patchSettings(state, action: PayloadAction<Partial<SettingsState>>) {
      Object.assign(state, action.payload);
    },
  },
});

export const syncSlice = createSlice({
  name: 'sync',
  initialState: { online: true, queue: [], lastPulledAt: null, conflicts: [] } as SyncState,
  reducers: {
    setOnline(state, action: PayloadAction<boolean>) {
      state.online = action.payload;
    },
    queueAction(state, action: PayloadAction<SyncQueueAction>) {
      state.queue = syncQueueReducer(state.queue, action.payload);
    },
    setConflicts(state, action: PayloadAction<SyncState['conflicts']>) {
      state.conflicts = action.payload;
    },
    setPulledAt(state, action: PayloadAction<string>) {
      state.lastPulledAt = action.payload;
    },
  },
});

export const { setSession, setTokens, setAuthError, setDeviceId, setUnlocked, clearSession } = authSlice.actions;
export const {
  setStep,
  setAutoCapture,
  noteQuad,
  addPage,
  updateActivePage,
  selectPage,
  reorderPages,
  removePage,
  duplicateActive,
  rotateActive,
  setPdfUri,
  resetSession,
} = scannerSlice.actions;
export const { setDocuments, upsertDocument, setFolders, setActiveDocument, setQuery } = documentsSlice.actions;
export const { patchSettings } = settingsSlice.actions;
export const { setOnline, queueAction, setConflicts, setPulledAt } = syncSlice.actions;

export { DEFAULT_ADJUSTMENTS };
