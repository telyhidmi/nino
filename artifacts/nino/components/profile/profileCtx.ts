import type { FollowedCreator, ProfileItem } from './ProfileView';

export type ProfileCtx = {
  following: FollowedCreator[];
  liked: ProfileItem[];
  onUnfollow: (id: string) => void;
};
