/** Keep background feed requests off while preserving periodic refresh on return. */
export function shouldPollFollowing(state: {
  preview: boolean; tab: string; section: string; focused: boolean;
  foreground: boolean; webVisible: boolean; overlayOpen: boolean;
}) {
  return !state.preview && state.tab === 'following' && state.section === 'home' &&
    state.focused && state.foreground && state.webVisible && !state.overlayOpen;
}

/** Buffering is intentionally not a gate: play must initiate remote loading. */
export function shouldPlayVideo(active: boolean, paused: boolean, failed: boolean, seeking: boolean) {
  return active && !paused && !failed && !seeking;
}
