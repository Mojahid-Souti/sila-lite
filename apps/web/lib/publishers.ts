/**
 * Who published a Bazaar template, and the mark that stands for them.
 *
 * The Bazaar groups templates under their publisher's own heading, so an
 * organisation's work reads as theirs rather than as anonymous platform
 * furniture. Adding an organisation is one row here plus a file in
 * /public/icons — never a conditional in a component.
 *
 * `logo` is a wordmark (the brand's name set in its own type), which is why the
 * heading renders it INSTEAD of the name rather than beside it. A publisher
 * with no row falls back to its name as plain text.
 */
export type Publisher = {
  /** Wordmark under /public/icons. */
  logo: string;
  /** Rendered height. A wordmark is wide, so height is what's constrained. */
  logoClass: string;
  /** What the mark says, for anyone who cannot see it. */
  alt: string;
};

const PUBLISHERS: Record<string, Publisher> = {};

export function publisherBrand(name: string | undefined | null): Publisher | null {
  if (!name) return null;
  return PUBLISHERS[name.trim().toLowerCase()] ?? null;
}
