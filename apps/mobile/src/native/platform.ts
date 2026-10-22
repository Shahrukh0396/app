import { GoogleSignin } from '@react-native-google-signin/google-signin';
import appleAuth from '@invertase/react-native-apple-authentication';
import PublicClientApplication from 'react-native-msal';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import Share from 'react-native-share';
import ReactNativeBiometrics from 'react-native-biometrics';
import * as Keychain from 'react-native-keychain';
import { createMMKV } from 'react-native-mmkv';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import RNFS from 'react-native-fs';
import { Linking } from 'react-native';
import {
  APPLE_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
  MICROSOFT_CLIENT_ID,
  REVENUECAT_API_KEY,
} from '@env';

const AUTH_SERVICE = 'scanflow.auth';
const KEY_SERVICE = 'scanflow.filekey';

export const settingsStorage = createMMKV({ id: 'scanflow-settings' });

export async function saveAuthTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Keychain.setGenericPassword(accessToken, refreshToken, { service: AUTH_SERVICE });
}

export async function readAuthTokens(): Promise<{ accessToken: string; refreshToken: string } | null> {
  const credentials = await Keychain.getGenericPassword({ service: AUTH_SERVICE });
  if (!credentials) return null;
  return { accessToken: credentials.username, refreshToken: credentials.password };
}

export async function clearAuthTokens(): Promise<void> {
  await Keychain.resetGenericPassword({ service: AUTH_SERVICE });
}

export async function saveFileKey(keyB64: string): Promise<void> {
  await Keychain.setGenericPassword('file-key', keyB64, { service: KEY_SERVICE });
}

export async function readFileKey(): Promise<string | null> {
  const credentials = await Keychain.getGenericPassword({ service: KEY_SERVICE });
  return credentials ? credentials.password : null;
}

export async function signInWithGoogle(): Promise<{ idToken: string; name?: string }> {
  if (!GOOGLE_WEB_CLIENT_ID) throw new Error('GOOGLE_WEB_CLIENT_ID is not configured');
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
  });
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const result = await GoogleSignin.signIn();
  const idToken = result.data?.idToken;
  if (!idToken) throw new Error('Google did not return an ID token');
  return { idToken, name: result.data?.user.name ?? undefined };
}

export async function signInWithApple(): Promise<{ idToken: string; name?: string }> {
  if (!APPLE_CLIENT_ID) throw new Error('APPLE_CLIENT_ID is not configured');
  const response = await appleAuth.performRequest({
    requestedOperation: appleAuth.Operation.LOGIN,
    requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
  });
  if (!response.identityToken) throw new Error('Apple did not return an identity token');
  const name = [response.fullName?.givenName, response.fullName?.familyName].filter(Boolean).join(' ');
  return { idToken: response.identityToken, name: name || undefined };
}

export async function signInWithMicrosoft(): Promise<{ idToken: string }> {
  if (!MICROSOFT_CLIENT_ID) throw new Error('MICROSOFT_CLIENT_ID is not configured');
  const client = new PublicClientApplication({
    auth: { clientId: MICROSOFT_CLIENT_ID, redirectUri: 'msauth.com.scanflow.app://auth' },
  });
  const result = await client.acquireToken({ scopes: ['User.Read'] });
  const idToken = result?.idToken;
  if (!idToken) throw new Error('Microsoft did not return an ID token');
  return { idToken };
}

export async function promptBiometric(reason: string): Promise<boolean> {
  const biometrics = new ReactNativeBiometrics();
  const available = await biometrics.isSensorAvailable();
  if (!available.available) return false;
  const result = await biometrics.simplePrompt({ promptMessage: reason });
  return result.success;
}

export async function configurePurchases(): Promise<void> {
  if (!REVENUECAT_API_KEY) throw new Error('REVENUECAT_API_KEY is not configured');
  Purchases.setLogLevel(LOG_LEVEL.INFO);
  Purchases.configure({ apiKey: REVENUECAT_API_KEY });
}

export async function loadOfferings() {
  await configurePurchases();
  return Purchases.getOfferings();
}

export async function purchasePackage(pkg: Parameters<typeof Purchases.purchasePackage>[0]) {
  await configurePurchases();
  return Purchases.purchasePackage(pkg);
}

export async function shareFile(url: string, mime: string, message: string): Promise<void> {
  await Share.open({ url, type: mime, message, failOnCancel: false });
}

export async function shareText(message: string): Promise<void> {
  await Share.open({ message, failOnCancel: false });
}

export async function openExternal(url: string): Promise<void> {
  const supported = await Linking.canOpenURL(url);
  if (!supported) throw new Error('No app is installed for that share target');
  await Linking.openURL(url);
}

export async function recognizeText(uri: string): Promise<string> {
  const result = await TextRecognition.recognize(uri);
  return result.text;
}

export async function writePdf(name: string, bytes: Uint8Array): Promise<string> {
  const path = `${RNFS.DocumentDirectoryPath}/${name}`;
  const binary = Array.from(bytes, (value) => String.fromCharCode(value)).join('');
  await RNFS.writeFile(path, binary, 'ascii');
  return `file://${path}`;
}
