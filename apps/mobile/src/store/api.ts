import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import type { AuthResponse, DocumentRecord, FolderRecord, PlanCatalogEntry, PublicUser } from '@scanflow/types';
import { SCANFLOW_API_URL } from '@env';
import { clearSession, setTokens } from './slices';

interface AuthAwareState {
  auth: {
    accessToken: string | null;
    refreshToken: string | null;
    deviceId: string;
  };
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: SCANFLOW_API_URL || 'http://10.0.2.2:3000',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as AuthAwareState).auth.accessToken;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extra,
) => {
  let result = await rawBaseQuery(args, api, extra);
  if (result.error?.status !== 401) return result;
  const state = api.getState() as AuthAwareState;
  if (!state.auth.refreshToken) {
    api.dispatch(clearSession());
    return result;
  }
  const refresh = await rawBaseQuery(
    {
      url: '/auth/refresh',
      method: 'POST',
      body: { refreshToken: state.auth.refreshToken, deviceId: state.auth.deviceId },
    },
    api,
    extra,
  );
  const data = refresh.data as AuthResponse | undefined;
  if (!data?.accessToken || !data.refreshToken) {
    api.dispatch(clearSession());
    return result;
  }
  api.dispatch(setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken }));
  result = await rawBaseQuery(args, api, extra);
  return result;
};

export const scanflowApi = createApi({
  reducerPath: 'scanflowApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Document', 'Folder', 'Me', 'Search'],
  endpoints: (build) => ({
    register: build.mutation<AuthResponse, { name: string; email: string; password: string; deviceId: string }>({
      query: (body) => ({ url: '/auth/register', method: 'POST', body }),
    }),
    login: build.mutation<AuthResponse, { email: string; password: string; deviceId: string }>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
    }),
    forgotPassword: build.mutation<{ ok: true }, { email: string }>({
      query: (body) => ({ url: '/auth/forgot-password', method: 'POST', body }),
    }),
    providerLogin: build.mutation<AuthResponse, { provider: 'google' | 'apple' | 'microsoft'; idToken: string; deviceId: string; name?: string }>({
      query: ({ provider, ...body }) => ({ url: `/auth/${provider}`, method: 'POST', body }),
    }),
    me: build.query<PublicUser, void>({ query: () => '/users/me', providesTags: ['Me'] }),
    updateMe: build.mutation<PublicUser, { name?: string; avatar?: string }>({
      query: (body) => ({ url: '/users/me', method: 'PUT', body }),
      invalidatesTags: ['Me'],
    }),
    folders: build.query<FolderRecord[], void>({ query: () => '/folders', providesTags: ['Folder'] }),
    createFolder: build.mutation<FolderRecord, { name: string; parentFolderId?: string }>({
      query: (body) => ({ url: '/folders', method: 'POST', body }),
      invalidatesTags: ['Folder'],
    }),
    documents: build.query<DocumentRecord[], { folder?: string; favorite?: boolean; archived?: boolean; deleted?: boolean } | void>({
      query: (filters) => ({
        url: '/documents',
        params: {
          folder: filters?.folder,
          favorite: filters?.favorite === undefined ? undefined : String(filters.favorite),
          archived: filters?.archived === undefined ? undefined : String(filters.archived),
          deleted: filters?.deleted ? 'true' : undefined,
        },
      }),
      providesTags: ['Document'],
    }),
    document: build.query<DocumentRecord, string>({
      query: (id) => `/documents/${id}`,
      providesTags: ['Document'],
    }),
    createDocument: build.mutation<DocumentRecord, { title: string; description?: string; folderId?: string; tags?: string[] }>({
      query: (body) => ({ url: '/documents', method: 'POST', body }),
      invalidatesTags: ['Document'],
    }),
    updateDocument: build.mutation<DocumentRecord, { id: string; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `/documents/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Document'],
    }),
    deleteDocument: build.mutation<{ ok: true }, string>({
      query: (id) => ({ url: `/documents/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Document'],
    }),
    restoreDocument: build.mutation<DocumentRecord, string>({
      query: (id) => ({ url: `/documents/${id}/restore`, method: 'POST' }),
      invalidatesTags: ['Document'],
    }),
    search: build.query<{ documents: DocumentRecord[]; query: string }, string>({
      query: (q) => ({ url: '/search', params: { q } }),
      providesTags: ['Search'],
    }),
    plans: build.query<PlanCatalogEntry[], void>({ query: () => '/plans' }),
    syncPush: build.mutation<unknown, { deviceId: string; changes: unknown[] }>({
      query: (body) => ({ url: '/sync/push', method: 'POST', body }),
    }),
    syncPull: build.mutation<unknown, { since?: string }>({
      query: ({ since }) => ({ url: '/sync/pull', method: 'POST', params: { since } }),
    }),
    backup: build.mutation<{ id: string }, void>({
      query: () => ({ url: '/backup', method: 'POST' }),
    }),
    extractOcr: build.mutation<{ text: string; confidence: number }, { uri: string; name: string; type: string; lang?: string }>({
      query: ({ uri, name, type, lang }) => {
        const body = new FormData();
        // React Native FormData accepts a file descriptor; the DOM Blob type does not.
        body.append('file', { uri, name, type } as unknown as Blob);
        body.append('lang', lang ?? 'eng');
        return { url: '/ocr/extract', method: 'POST', body };
      },
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useForgotPasswordMutation,
  useProviderLoginMutation,
  useMeQuery,
  useFoldersQuery,
  useDocumentsQuery,
  useDocumentQuery,
  useCreateDocumentMutation,
  useUpdateDocumentMutation,
  useDeleteDocumentMutation,
  useRestoreDocumentMutation,
  useSearchQuery,
  usePlansQuery,
  useSyncPushMutation,
  useSyncPullMutation,
  useBackupMutation,
  useExtractOcrMutation,
  useCreateFolderMutation,
  useUpdateMeMutation,
} = scanflowApi;
