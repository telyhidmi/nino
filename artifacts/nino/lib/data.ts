export type Country = { code: string; name: string; flag: string };
export type Language = { code: string; name: string; native: string };

export const COUNTRIES: Country[] = [
  ['AR','Argentina'],['AU','Australia'],['AT','Austria'],['BH','Bahrain'],['BE','Belgium'],['BO','Bolivia'],['BR','Brazil'],
  ['CA','Canada'],['CL','Chile'],['CN','China'],['CO','Colombia'],['CR','Costa Rica'],['CU','Cuba'],['DK','Denmark'],
  ['DO','Dominican Republic'],['DZ','Algeria'],['EC','Ecuador'],['EG','Egypt'],['FI','Finland'],['FR','France'],['DE','Germany'],
  ['GR','Greece'],['GT','Guatemala'],['HN','Honduras'],['IN','India'],['ID','Indonesia'],['IQ','Iraq'],['IE','Ireland'],
  ['IT','Italy'],['JP','Japan'],['JO','Jordan'],['KE','Kenya'],['KR','South Korea'],['KW','Kuwait'],['LB','Lebanon'],
  ['LY','Libya'],['MY','Malaysia'],['MX','Mexico'],['MA','Morocco'],['MZ','Mozambique'],['NL','Netherlands'],['NZ','New Zealand'],
  ['NG','Nigeria'],['NO','Norway'],['OM','Oman'],['PK','Pakistan'],['PS','Palestine'],['PA','Panama'],['PY','Paraguay'],
  ['PE','Peru'],['PH','Philippines'],['PL','Poland'],['PT','Portugal'],['PR','Puerto Rico'],['QA','Qatar'],['RU','Russia'],
  ['SA','Saudi Arabia'],['SN','Senegal'],['SG','Singapore'],['ZA','South Africa'],['ES','Spain'],['SD','Sudan'],['SE','Sweden'],
  ['CH','Switzerland'],['SY','Syria'],['TH','Thailand'],['TN','Tunisia'],['TR','Türkiye'],['AE','United Arab Emirates'],
  ['GB','United Kingdom'],['US','United States'],['UY','Uruguay'],['VE','Venezuela'],['VN','Vietnam'],['YE','Yemen'],['AO','Angola'],['CV','Cabo Verde'],
].map(([code, name]) => ({
  code,
  name,
  flag: String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)),
})).sort((a, b) => a.name.localeCompare(b.name));

export const LANGUAGES: Language[] = [
  { code: 'ar', name: 'Arabic', native: 'العربية' },
  { code: 'en', name: 'English', native: 'English' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'it', name: 'Italian', native: 'Italiano' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'ko', name: 'Korean', native: '한국어' },
  { code: 'zh', name: 'Chinese', native: '中文' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'ur', name: 'Urdu', native: 'اردو' },
  { code: 'fa', name: 'Persian', native: 'فارسی' },
  { code: 'ru', name: 'Russian', native: 'Русский' },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia' },
  { code: 'ms', name: 'Malay', native: 'Bahasa Melayu' },
  { code: 'th', name: 'Thai', native: 'ไทย' },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt' },
  { code: 'nl', name: 'Dutch', native: 'Nederlands' },
  { code: 'pl', name: 'Polish', native: 'Polski' },
  { code: 'sw', name: 'Swahili', native: 'Kiswahili' },
  { code: 'el', name: 'Greek', native: 'Ελληνικά' },
  { code: 'sv', name: 'Swedish', native: 'Svenska' },
];

export const countryBy = (c?: string) => COUNTRIES.find((x) => x.code === c);
export const languageBy = (c?: string) => LANGUAGES.find((x) => x.code === c);

export type NinoProfile = {
  displayName: string;
  country: string;
  nativeLanguage: string;
  understands: string[];
  profileComplete: boolean;
};

export function readProfile(meta: Record<string, unknown> | undefined | null): NinoProfile {
  const m = (meta ?? {}) as Partial<NinoProfile>;
  return {
    displayName: typeof m.displayName === 'string' ? m.displayName : '',
    country: typeof m.country === 'string' ? m.country : '',
    nativeLanguage: typeof m.nativeLanguage === 'string' ? m.nativeLanguage : '',
    understands: Array.isArray(m.understands) ? m.understands.filter((x): x is string => typeof x === 'string') : [],
    profileComplete: m.profileComplete === true,
  };
}

export function clerkErrorMessage(err: unknown, fallback: string): string {
  const e = err as { errors?: { longMessage?: string; message?: string }[]; longMessage?: string; message?: string } | null;
  const message = e?.errors?.[0]?.longMessage || e?.errors?.[0]?.message || e?.longMessage || e?.message || fallback;
  return message.replace(/Passwords must be 10 characters or more\.?/g, 'Minimum 10 characters');
}
