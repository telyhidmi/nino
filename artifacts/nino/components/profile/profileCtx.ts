import type { FollowedCreator, ProfileItem } from './ProfileView';

export type ProfileCtx = {
  uploads: ProfileItem[];
  onAdd: () => void;
  onRemove: (item: ProfileItem) => void;
  following: FollowedCreator[];
  liked: ProfileItem[];
  onUnfollow: (id: string) => void;
};
