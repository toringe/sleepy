// Stub (Task 5): replaced by the real player in Task 6.
export function createPlayer() {
  return { play: (session, sound) => console.log('play', session.id, sound.id), state: () => ({}) };
}
