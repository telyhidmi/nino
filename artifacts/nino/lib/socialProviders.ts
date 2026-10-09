export type SocialProvider = 'google' | 'apple';

type ProviderSettings = { enabled?: boolean; authenticatable?: boolean };
type SocialSettings = Partial<Record<`oauth_${SocialProvider}`, ProviderSettings>>;

// Clerk's environment is authoritative. Never assume an absent provider works,
// including while configuration is loading or when only account linking is enabled.
export function enabledSocialProviders(settings: SocialSettings | null | undefined): SocialProvider[] {
  return (['google', 'apple'] as const).filter((provider) => {
    const config = settings?.[`oauth_${provider}`];
    return config?.enabled === true && config.authenticatable === true;
  });
}
