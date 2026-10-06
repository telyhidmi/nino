import React from 'react';
import { Share } from 'react-native';
import { SAMPLE_POSTS, SamplePost } from '@/components/feed/data';
import { useI18n } from '@/lib/i18n';
import { ProfileView } from './ProfileView';

/** Read-only profile for a fictional sample creator; never uses the viewer's account. */
export function CreatorProfile({ creator, following, onFollow, onBack, onOpenPost }: {
  creator: SamplePost;
  following: boolean;
  onFollow: () => void;
  onBack: () => void;
  onOpenPost: (id: string) => void;
}) {
  const { t } = useI18n();
  const posts = SAMPLE_POSTS.filter((post) => post.handle === creator.handle);
  return <ProfileView
    key={creator.handle}
    testID="creator-profile"
    name={creator.author}
    handle={creator.handle}
    imageSource={creator.image}
    flag={creator.flag}
    countryCode={creator.countryCode}
    badge={t('profileCreatorBadge')}
    bio={t('profileCreatorBio')}
    stats={{ following: null, followers: null, likes: null }}
    statsNote={t('profileCreatorStats')}
    following={[]}
    followingEmpty={t('profileCreatorFollowing')}
    postsOnly
    onFollow={onFollow}
    isFollowing={following}
    onBack={onBack}
    onShare={() => { Share.share({ message: t('profileShareCreator').replace('{name}', creator.author).replace('{handle}', creator.handle) }).catch(() => undefined); }}
    onOpenItem={(item) => onOpenPost(item.id)}
    tabs={{
      posts: {
        items: posts.map((post) => ({
          id: post.id,
          kind: post.video ? 'video' : 'photo',
          image: post.image,
          label: post.location,
          caption: post.translation,
          tag: t('profileSample'),
        })),
        emptyTitle: t('profileNoSample'),
        emptyBody: t('profileNoSampleBody'),
      },
      private: { items: [], emptyTitle: '', emptyBody: '' },
      reposts: { items: [], emptyTitle: '', emptyBody: '' },
      liked: { items: [], emptyTitle: '', emptyBody: '' },
    }}
  />;
}