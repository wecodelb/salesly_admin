// Dialling codes for the phone field's country picker.
//
// Curated rather than exhaustive: Lebanon and the rest of the region first-class
// (this is where the customers are), then the markets the business is likely to
// call. Adding a country is one line — `{ iso, name, dial }`; the flag is
// derived from the ISO code, so there is no image or icon set to maintain.

export interface CountryCode {
  /** ISO 3166-1 alpha-2, also what the flag emoji is derived from. */
  iso: string
  name: string
  /** Including the leading plus, as it is stored and displayed. */
  dial: string
}

/** Pre-selected on an empty field. */
export const DEFAULT_COUNTRY_ISO = 'LB'

export const COUNTRY_CODES: CountryCode[] = [
  // Levant & Gulf
  { iso: 'LB', name: 'Lebanon', dial: '+961' },
  { iso: 'SY', name: 'Syria', dial: '+963' },
  { iso: 'JO', name: 'Jordan', dial: '+962' },
  { iso: 'PS', name: 'Palestine', dial: '+970' },
  { iso: 'IQ', name: 'Iraq', dial: '+964' },
  { iso: 'SA', name: 'Saudi Arabia', dial: '+966' },
  { iso: 'AE', name: 'United Arab Emirates', dial: '+971' },
  { iso: 'QA', name: 'Qatar', dial: '+974' },
  { iso: 'KW', name: 'Kuwait', dial: '+965' },
  { iso: 'BH', name: 'Bahrain', dial: '+973' },
  { iso: 'OM', name: 'Oman', dial: '+968' },
  { iso: 'YE', name: 'Yemen', dial: '+967' },

  // North Africa & wider Arab world
  { iso: 'EG', name: 'Egypt', dial: '+20' },
  { iso: 'LY', name: 'Libya', dial: '+218' },
  { iso: 'TN', name: 'Tunisia', dial: '+216' },
  { iso: 'DZ', name: 'Algeria', dial: '+213' },
  { iso: 'MA', name: 'Morocco', dial: '+212' },
  { iso: 'SD', name: 'Sudan', dial: '+249' },
  { iso: 'MR', name: 'Mauritania', dial: '+222' },
  { iso: 'DJ', name: 'Djibouti', dial: '+253' },
  { iso: 'SO', name: 'Somalia', dial: '+252' },

  // Neighbours
  { iso: 'TR', name: 'Türkiye', dial: '+90' },
  { iso: 'CY', name: 'Cyprus', dial: '+357' },
  { iso: 'IR', name: 'Iran', dial: '+98' },
  { iso: 'AM', name: 'Armenia', dial: '+374' },
  { iso: 'GE', name: 'Georgia', dial: '+995' },
  { iso: 'AZ', name: 'Azerbaijan', dial: '+994' },

  // Europe
  { iso: 'GB', name: 'United Kingdom', dial: '+44' },
  { iso: 'FR', name: 'France', dial: '+33' },
  { iso: 'DE', name: 'Germany', dial: '+49' },
  { iso: 'IT', name: 'Italy', dial: '+39' },
  { iso: 'ES', name: 'Spain', dial: '+34' },
  { iso: 'PT', name: 'Portugal', dial: '+351' },
  { iso: 'NL', name: 'Netherlands', dial: '+31' },
  { iso: 'BE', name: 'Belgium', dial: '+32' },
  { iso: 'CH', name: 'Switzerland', dial: '+41' },
  { iso: 'AT', name: 'Austria', dial: '+43' },
  { iso: 'SE', name: 'Sweden', dial: '+46' },
  { iso: 'NO', name: 'Norway', dial: '+47' },
  { iso: 'DK', name: 'Denmark', dial: '+45' },
  { iso: 'FI', name: 'Finland', dial: '+358' },
  { iso: 'IE', name: 'Ireland', dial: '+353' },
  { iso: 'GR', name: 'Greece', dial: '+30' },
  { iso: 'PL', name: 'Poland', dial: '+48' },
  { iso: 'CZ', name: 'Czechia', dial: '+420' },
  { iso: 'RO', name: 'Romania', dial: '+40' },
  { iso: 'HU', name: 'Hungary', dial: '+36' },
  { iso: 'BG', name: 'Bulgaria', dial: '+359' },
  { iso: 'UA', name: 'Ukraine', dial: '+380' },
  // Shares +7 with Kazakhstan; a stored "+7…" resolves to Russia.
  { iso: 'RU', name: 'Russia', dial: '+7' },

  // Americas
  // Shares +1 with Canada and the Caribbean; a stored "+1…" resolves here.
  { iso: 'US', name: 'United States', dial: '+1' },
  { iso: 'CA', name: 'Canada', dial: '+1' },
  { iso: 'MX', name: 'Mexico', dial: '+52' },
  { iso: 'BR', name: 'Brazil', dial: '+55' },
  { iso: 'AR', name: 'Argentina', dial: '+54' },
  { iso: 'CL', name: 'Chile', dial: '+56' },
  { iso: 'CO', name: 'Colombia', dial: '+57' },
  { iso: 'PE', name: 'Peru', dial: '+51' },
  { iso: 'VE', name: 'Venezuela', dial: '+58' },

  // Africa
  { iso: 'NG', name: 'Nigeria', dial: '+234' },
  { iso: 'GH', name: 'Ghana', dial: '+233' },
  { iso: 'CI', name: "Côte d'Ivoire", dial: '+225' },
  { iso: 'SN', name: 'Senegal', dial: '+221' },
  { iso: 'CM', name: 'Cameroon', dial: '+237' },
  { iso: 'KE', name: 'Kenya', dial: '+254' },
  { iso: 'ET', name: 'Ethiopia', dial: '+251' },
  { iso: 'TZ', name: 'Tanzania', dial: '+255' },
  { iso: 'UG', name: 'Uganda', dial: '+256' },
  { iso: 'ZA', name: 'South Africa', dial: '+27' },

  // Asia & Pacific
  { iso: 'CN', name: 'China', dial: '+86' },
  { iso: 'IN', name: 'India', dial: '+91' },
  { iso: 'PK', name: 'Pakistan', dial: '+92' },
  { iso: 'BD', name: 'Bangladesh', dial: '+880' },
  { iso: 'LK', name: 'Sri Lanka', dial: '+94' },
  { iso: 'NP', name: 'Nepal', dial: '+977' },
  { iso: 'TH', name: 'Thailand', dial: '+66' },
  { iso: 'VN', name: 'Vietnam', dial: '+84' },
  { iso: 'PH', name: 'Philippines', dial: '+63' },
  { iso: 'ID', name: 'Indonesia', dial: '+62' },
  { iso: 'MY', name: 'Malaysia', dial: '+60' },
  { iso: 'SG', name: 'Singapore', dial: '+65' },
  { iso: 'JP', name: 'Japan', dial: '+81' },
  { iso: 'KR', name: 'South Korea', dial: '+82' },
  { iso: 'HK', name: 'Hong Kong', dial: '+852' },
  { iso: 'TW', name: 'Taiwan', dial: '+886' },
  { iso: 'AU', name: 'Australia', dial: '+61' },
  { iso: 'NZ', name: 'New Zealand', dial: '+64' },
]

/**
 * The flag emoji for an ISO code: each letter maps to its regional indicator
 * symbol. Beats shipping an icon set, and stays correct as the list grows.
 */
export function flagFor(iso: string): string {
  return iso
    .toUpperCase()
    .replace(/[A-Z]/g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
}

export function countryByIso(iso: string): CountryCode {
  return (
    COUNTRY_CODES.find((c) => c.iso === iso) ??
    COUNTRY_CODES.find((c) => c.iso === DEFAULT_COUNTRY_ISO)!
  )
}
