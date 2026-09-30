export type ProfileTabKey = 'posts' | 'private' | 'reposts' | 'liked';
export type ProfileTabState = { tab: ProfileTabKey; resetToken?: number };

export function resetProfileTab(state: ProfileTabState, resetToken?: number): ProfileTabState {
  return state.resetToken === resetToken ? state : { tab: 'posts', resetToken };
}