/**
 * Import for its side effect from a react-test-renderer test. Every tree the test creates is unmounted after each test.
 * A FlatList or Icon left mounted keeps a timer that fires after the file has finished and logs an act() warning;
 * jest then reports "Cannot log after tests are done" and exits 1 on CI even though every test passed.
 */
import TestRenderer, { act } from 'react-test-renderer';

const created: TestRenderer.ReactTestRenderer[] = [];
const original = TestRenderer.create;

TestRenderer.create = ((...args: Parameters<typeof original>) => {
  const renderer = original(...args);
  created.push(renderer);
  return renderer;
}) as typeof original;

afterEach(() => {
  act(() => {
    for (const r of created.splice(0)) {
      try {
        r.unmount();
      } catch {
        // already unmounted by the test
      }
    }
  });
});
