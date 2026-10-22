import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  Forgot: undefined;
  Main: undefined;
  Scanner: undefined;
  Crop: undefined;
  Enhancement: undefined;
  PageManager: undefined;
  PDFPreview: undefined;
  OCRResult: undefined;
  Search: undefined;
  DocumentDetails: { id: string };
  CloudSync: undefined;
  Share: { id?: string };
  Subscription: undefined;
  Settings: undefined;
  Security: undefined;
  Backup: undefined;
  About: undefined;
};

export type TabParamList = {
  Home: undefined;
  Documents: undefined;
  Folders: undefined;
  Profile: undefined;
};

export type TabProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;
