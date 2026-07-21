/**
 * Wraps URL.createObjectURL / URL.revokeObjectURL so revocation is testable
 * with a mocked global URL. Revokes the previously held object URL when a
 * new blob is attached, and exposes a `revoke()` for unmount cleanup. Pure,
 * no React dependency, so it is directly unit-testable.
 */
export function createImageUrlManager() {
  const url = (typeof URL !== "undefined" ? URL : globalThis.URL) as {
    createObjectURL: (blob: Blob) => string;
    revokeObjectURL: (url: string) => void;
  };
  let current: string | null = null;
  return {
    create(blob: Blob): string {
      if (current) url.revokeObjectURL(current);
      current = url.createObjectURL(blob);
      return current;
    },
    revoke() {
      if (current) {
        url.revokeObjectURL(current);
        current = null;
      }
    },
    get current() {
      return current;
    },
  };
}
