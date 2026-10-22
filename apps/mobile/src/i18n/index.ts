import en, { type MessageKey } from './en';

const catalogs = { en } as const;
export type Locale = keyof typeof catalogs;

export function translate(locale: Locale, key: MessageKey): string {
  return catalogs[locale][key] ?? en[key];
}
