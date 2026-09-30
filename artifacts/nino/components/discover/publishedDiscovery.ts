import type { Post } from '@workspace/api-client-react';

// ISO 3166-1 alpha-2, including territories. Never infer recording location
// from the author's profile, caption, or the illustrative demo country list.
const ISO_CODES = new Set(('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW').split(' '));

export function normalizeCountryCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return ISO_CODES.has(code) ? code : null;
}

export function countryFlag(code: string): string {
  const normalized = normalizeCountryCode(code);
  return normalized ? [...normalized].map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0))).join('') : '';
}

export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region', fallback: 'code' }).of(code) || code;
  } catch {
    // Older native runtimes may not ship Intl.DisplayNames.
    return code;
  }
}

export type PublishedCountry = { code: string; name: string; flag: string; posts: Post[] };
const searchable = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();

export function groupRecordedVideos(posts: readonly Post[], locale: string, query = ''): PublishedCountry[] {
  const groups = new Map<string, PublishedCountry>();
  const seen = new Set<string>();
  const needle = searchable(query.trim());
  for (const post of posts) {
    const location = post.recordingLocation;
    const code = normalizeCountryCode(location?.countryCode);
    if (post.kind !== 'video' || !post.mediaUrl?.trim() || !code || !location ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(location.recordedAt) ||
      !Number.isFinite(Date.parse(location.recordedAt)) || seen.has(post.id)) continue;
    seen.add(post.id);
    const name = countryName(code, locale);
    const matchesCountry = searchable(`${name} ${countryName(code, 'en')} ${code}`).includes(needle);
    if (needle && !matchesCountry && !searchable(post.caption).includes(needle)) continue;
    const group = groups.get(code) ?? { code, name, flag: countryFlag(code), posts: [] };
    group.posts.push(post);
    groups.set(code, group);
  }
  return [...groups.values()].sort((a, b) => b.posts.length - a.posts.length || a.name.localeCompare(b.name, locale));
}

/** Missing IDs deliberately stay missing; never select a different post. */
export function postIndexById(posts: readonly { id: string }[], id: string): number {
  return posts.findIndex((post) => post.id === id);
}