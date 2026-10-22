import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from 'react-native-paper';
import { useAppSelector } from './hooks';
import type { RootStackParamList, TabParamList } from './types';
import {
  AboutScreen,
  BackupSettingsScreen,
  CloudSyncScreen,
  CropScreen,
  DocumentDetailsScreen,
  DocumentsScreen,
  EnhancementScreen,
  FoldersScreen,
  ForgotPasswordScreen,
  HomeScreen,
  LoginScreen,
  OCRResultScreen,
  OnboardingScreen,
  PDFPreviewScreen,
  PageManagerScreen,
  ProfileScreen,
  RegisterScreen,
  ScannerScreen,
  SearchScreen,
  SecuritySettingsScreen,
  SettingsScreen,
  ShareScreen,
  SplashScreen,
  SubscriptionScreen,
} from '../screens/screens';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

function MainTabs() {
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="Home" component={HomeScreen} options={{ tabBarAccessibilityLabel: 'Home' }} />
      <Tabs.Screen name="Documents" component={DocumentsScreen} options={{ tabBarAccessibilityLabel: 'Documents' }} />
      <Tabs.Screen name="Folders" component={FoldersScreen} options={{ tabBarAccessibilityLabel: 'Folders' }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ tabBarAccessibilityLabel: 'Profile' }} />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const theme = useTheme();
  const user = useAppSelector((state) => state.auth.user);
  const unlocked = useAppSelector((state) => state.auth.unlocked);
  const lockEnabled = useAppSelector((state) => state.settings.lockEnabled);
  const onboarding = useAppSelector((state) => state.settings.onboardingComplete);
  const signedIn = Boolean(user) && (!lockEnabled || unlocked);
  return (
    <NavigationContainer theme={theme.dark ? DarkTheme : DefaultTheme}>
      <Stack.Navigator screenOptions={{ headerShadowVisible: false }}>
        {!signedIn ? (
          <>
            <Stack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false }} />
            {!onboarding ? <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} /> : null}
            <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Log in' }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Create account' }} />
            <Stack.Screen name="Forgot" component={ForgotPasswordScreen} options={{ title: 'Reset password' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="Scanner" component={ScannerScreen} options={{ title: 'Scanner' }} />
            <Stack.Screen name="Crop" component={CropScreen} options={{ title: 'Crop' }} />
            <Stack.Screen name="Enhancement" component={EnhancementScreen} options={{ title: 'Enhance' }} />
            <Stack.Screen name="PageManager" component={PageManagerScreen} options={{ title: 'Pages' }} />
            <Stack.Screen name="PDFPreview" component={PDFPreviewScreen} options={{ title: 'PDF' }} />
            <Stack.Screen name="OCRResult" component={OCRResultScreen} options={{ title: 'OCR' }} />
            <Stack.Screen name="Search" component={SearchScreen} options={{ title: 'Search' }} />
            <Stack.Screen name="DocumentDetails" component={DocumentDetailsScreen} options={{ title: 'Document' }} />
            <Stack.Screen name="CloudSync" component={CloudSyncScreen} options={{ title: 'Cloud sync' }} />
            <Stack.Screen name="Share" component={ShareScreen} options={{ title: 'Share' }} />
            <Stack.Screen name="Subscription" component={SubscriptionScreen} options={{ title: 'Subscription' }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
            <Stack.Screen name="Security" component={SecuritySettingsScreen} options={{ title: 'Security' }} />
            <Stack.Screen name="Backup" component={BackupSettingsScreen} options={{ title: 'Backup' }} />
            <Stack.Screen name="About" component={AboutScreen} options={{ title: 'About' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
