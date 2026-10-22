import { configureStore } from '@reduxjs/toolkit';
import { scanflowApi } from './api';
import { authSlice, documentsSlice, scannerSlice, settingsSlice, syncSlice } from './slices';

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    documents: documentsSlice.reducer,
    scanner: scannerSlice.reducer,
    settings: settingsSlice.reducer,
    sync: syncSlice.reducer,
    [scanflowApi.reducerPath]: scanflowApi.reducer,
  },
  middleware: (getDefault) => getDefault().concat(scanflowApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
