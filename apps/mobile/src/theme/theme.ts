import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

const lightColors = {
  ...MD3LightTheme.colors,
  primary: '#0F6E6B',
  onPrimary: '#FFFFFF',
  secondary: '#1F3A5F',
  background: '#F4F7F6',
  surface: '#FFFFFF',
  outline: '#D5DEDC',
};

const darkColors = {
  ...MD3DarkTheme.colors,
  primary: '#7EDCD6',
  onPrimary: '#003735',
  secondary: '#B7C7E4',
  background: '#0E1514',
  surface: '#17211F',
  outline: '#31403D',
};

const highContrastColors = {
  ...lightColors,
  primary: '#003734',
  onPrimary: '#FFFFFF',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  onSurface: '#000000',
  outline: '#000000',
};

export type ThemeMode = 'light' | 'dark' | 'highContrast';

export function buildTheme(mode: ThemeMode): MD3Theme {
  if (mode === 'dark') return { ...MD3DarkTheme, colors: darkColors };
  if (mode === 'highContrast') return { ...MD3LightTheme, colors: highContrastColors };
  return { ...MD3LightTheme, colors: lightColors };
}
