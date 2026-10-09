import { getClerkInstance, useClerk } from '@clerk/expo';
import { useEffect, useState } from 'react';
import { enabledSocialProviders, type SocialProvider } from '@/lib/socialProviders';

export function useSocialProviders() {
  const clerk = useClerk();
  const [providers, setProviders] = useState<SocialProvider[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const refresh = () => {
      // Isolate Clerk's internal environment accessor here. It is the same
      // loaded instance configuration used by Clerk's own provider buttons.
      const instance = getClerkInstance() as typeof clerk & {
        __internal_environment?: {
          userSettings: { social: Parameters<typeof enabledSocialProviders>[0] };
        } | null;
      };
      const environment = instance?.__internal_environment;
      setReady(Boolean(environment));
      const next = enabledSocialProviders(environment?.userSettings.social);
      setProviders((current) => current.join() === next.join() ? current : next);
    };
    refresh();
    return clerk.addListener(refresh);
  }, [clerk]);

  return { providers, ready };
}
