import type { SVGProps } from "react";

/**
 * Product/platform brand marks. These are deliberately kept as custom SVGs
 * — Fluent System Icons has no GitHub logo, and the DRAGHUB diamond is the
 * product's own mark, not a generic UI icon. Everything else in the app
 * icon vocabulary comes from fluent-icons.tsx.
 */

export const GithubMark = (p: SVGProps<SVGSVGElement>) => (
  <svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
    {...p}
  >
    <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.07 11.07 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.07.78 2.16 0 1.56-.01 2.82-.01 3.2 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
  </svg>
);

/** The DRAGHUB product mark — a diamond, used in the system bar and as the
 * default fallback glyph. Not a semantic UI icon; do not reuse it to mean
 * "repository" or any other concept. */
export const DraghubMark = (p: SVGProps<SVGSVGElement>) => (
  <svg
    width={16}
    height={16}
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
    {...p}
  >
    <path d="M12 1.5 22.5 12 12 22.5 1.5 12Z" />
  </svg>
);
