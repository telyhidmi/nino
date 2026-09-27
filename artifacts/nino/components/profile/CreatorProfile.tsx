import React from 'react';
import { Share } from 'react-native';
import { SAMPLE_POSTS, SamplePost } from '@/components/feed/data';
import { ProfileView } from './ProfileView';

/** Read-only profile for a fictional sample creator; never uses the viewer's account. */
export function CreatorProfile({ creator, following, onFollow, onBack, onOpenPost }: {
  creator: SamplePost;
  following: boolean;
  onFollow: () => void;
  onBack: () => void;
  onOpenPost: (id: string) => void;
}) {
  const posts = SAMPLE_POSTS.filter((post) => post.handle === creator.handle);
  return <ProfileView
    key={creator.handle}
    testID="creator-profile"
    name={creator.author}
    handle={creator.handle}
    imageSource={creator.image}
    flag={creator.flag}
    countryCode={creator.countryCode}
    badge="SAMPLE CREATOR"
    bio="Fictional sample creator · illustrative media, not a real account."
    stats={{ following: null, followers: null, likes: null }}
    statsNote="Creator counts unavailable · sample posts only"
    following={[]}
    followingEmpty="Following information isn't available for sample creators."
    postsOnly
    onFollow={onFollow}
    isFollowing={following}
    onBack={onBack}
    onShare={() => { Share.share({ message: `${creator.author} (@${creator.handle}) on Nino · fictional sample creator` }).catch(() => undefined); }}
    onOpenItem={(item) => onOpenPost(item.id)}
    tabs={{
      posts: {
        items: posts.map((post) => ({
          id: post.id,
          kind: post.video ? 'video' : 'photo',
          image: post.image,
          label: post.location,
          caption: post.translation,
          tag: 'SAMPLE',
        })),
        emptyTitle: 'No sample posts',
        emptyBody: 'This creator has no sample posts to show.',
      },
      private: { items: [], emptyTitle: '', emptyBody: '' },
      reposts: { items: [], emptyTitle: '', emptyBody: '' },
      liked: { items: [], emptyTitle: '', emptyBody: '' },
    }}
  />;
}