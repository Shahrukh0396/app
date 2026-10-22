import { useEffect, useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { store } from '../store';
import { buildTheme } from '../theme/theme';
import { RootNavigator } from './navigation';
import { useAppSelector } from './hooks';
import { settingsStorage } from '../native/platform';
import { patchSettings } from '../store/slices';

function ThemedApp() {
  const mode = useAppSelector((state) => state.settings.theme);
  const theme = useMemo(() => buildTheme(mode), [mode]);
  useEffect(() => {
    const raw = settingsStorage.getString('settings');
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as Partial<ReturnType<typeof store.getState>['settings']>;
      store.dispatch(patchSettings(saved));
    } catch {
      settingsStorage.remove('settings');
    }
  }, []);
  return (
    <PaperProvider theme={theme}>
      <SafeAreaProvider>
        <RootNavigator />
      </SafeAreaProvider>
    </PaperProvider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <ThemedApp />
      </Provider>
    </GestureHandlerRootView>
  );
}
