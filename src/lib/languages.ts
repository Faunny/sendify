// The 22 target languages Sendify ships with. Each entry carries the BCP-47 code,
// a human label, an emoji flag for compact UI, and the DeepL code used for translation.
// DeepL uses different codes than BCP-47 (e.g. EN-GB vs en-GB) so we keep both.

export type Language = {
  code: string;          // BCP-47
  label: string;
  nativeLabel: string;
  flag: string;
  deeplCode: string;     // DeepL target code
  countries: string[];   // ISO-3166-1 alpha-2 list where this is a primary marketing language
};

export const LANGUAGES: Language[] = [
  { code: "es-ES", label: "Spanish (Spain)",     nativeLabel: "Español",         flag: "🇪🇸", deeplCode: "ES",    countries: ["ES"] },
  { code: "es-MX", label: "Spanish (LatAm)",     nativeLabel: "Español LatAm",   flag: "🇲🇽", deeplCode: "ES",    countries: ["MX", "AR", "CL", "CO", "US"] },
  { code: "en-GB", label: "English (UK)",        nativeLabel: "English UK",      flag: "🇬🇧", deeplCode: "EN-GB", countries: ["GB", "IE"] },
  { code: "en-US", label: "English (US)",        nativeLabel: "English US",      flag: "🇺🇸", deeplCode: "EN-US", countries: ["US", "CA"] },
  { code: "fr-FR", label: "French",              nativeLabel: "Français",        flag: "🇫🇷", deeplCode: "FR",    countries: ["FR", "BE", "CH", "LU", "MC"] },
  { code: "de-DE", label: "German",              nativeLabel: "Deutsch",         flag: "🇩🇪", deeplCode: "DE",    countries: ["DE", "AT", "CH"] },
  { code: "it-IT", label: "Italian",             nativeLabel: "Italiano",        flag: "🇮🇹", deeplCode: "IT",    countries: ["IT", "CH", "SM"] },
  { code: "pt-PT", label: "Portuguese (PT)",     nativeLabel: "Português",       flag: "🇵🇹", deeplCode: "PT-PT", countries: ["PT"] },
  { code: "pt-BR", label: "Portuguese (BR)",     nativeLabel: "Português BR",    flag: "🇧🇷", deeplCode: "PT-BR", countries: ["BR"] },
  { code: "nl-NL", label: "Dutch",               nativeLabel: "Nederlands",      flag: "🇳🇱", deeplCode: "NL",    countries: ["NL", "BE"] },
  { code: "pl-PL", label: "Polish",              nativeLabel: "Polski",          flag: "🇵🇱", deeplCode: "PL",    countries: ["PL"] },
  { code: "sv-SE", label: "Swedish",             nativeLabel: "Svenska",         flag: "🇸🇪", deeplCode: "SV",    countries: ["SE"] },
  { code: "da-DK", label: "Danish",              nativeLabel: "Dansk",           flag: "🇩🇰", deeplCode: "DA",    countries: ["DK"] },
  { code: "fi-FI", label: "Finnish",             nativeLabel: "Suomi",           flag: "🇫🇮", deeplCode: "FI",    countries: ["FI"] },
  { code: "nb-NO", label: "Norwegian",           nativeLabel: "Norsk",           flag: "🇳🇴", deeplCode: "NB",    countries: ["NO"] },
  { code: "el-GR", label: "Greek",               nativeLabel: "Ελληνικά",        flag: "🇬🇷", deeplCode: "EL",    countries: ["GR", "CY"] },
  { code: "cs-CZ", label: "Czech",               nativeLabel: "Čeština",         flag: "🇨🇿", deeplCode: "CS",    countries: ["CZ"] },
  { code: "ro-RO", label: "Romanian",            nativeLabel: "Română",          flag: "🇷🇴", deeplCode: "RO",    countries: ["RO", "MD"] },
  { code: "hu-HU", label: "Hungarian",           nativeLabel: "Magyar",          flag: "🇭🇺", deeplCode: "HU",    countries: ["HU"] },
  { code: "bg-BG", label: "Bulgarian",           nativeLabel: "Български",       flag: "🇧🇬", deeplCode: "BG",    countries: ["BG"] },
  { code: "sk-SK", label: "Slovak",              nativeLabel: "Slovenčina",      flag: "🇸🇰", deeplCode: "SK",    countries: ["SK"] },
  { code: "sl-SI", label: "Slovenian",           nativeLabel: "Slovenščina",     flag: "🇸🇮", deeplCode: "SL",    countries: ["SI"] },
];

export function languageByCode(code: string): Language | undefined {
  return LANGUAGES.find((l) => l.code === code);
}

export function languagesForCountry(country: string): Language[] {
  return LANGUAGES.filter((l) => l.countries.includes(country.toUpperCase()));
}
