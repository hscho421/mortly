import Link from "next/link";

/**
 * BrandMark — single canonical render of the mortly logo.
 *
 * All app chrome (Navbar, Footer, BrokerShell, BorrowerShell) renders the
 * brand through this component so swapping the asset is a one-file edit.
 * The image source is `/public/logo/logo.svg`; edit that file to update
 * the wordmark everywhere.
 *
 * Note on font fidelity: the SVG uses live <text> with Outfit. When loaded
 * as an <img>, browsers render the SVG in an isolated document and DO NOT
 * inherit fonts loaded by the host page. The wordmark will fall back to
 * the system sans-serif in this context. If pixel-perfect Outfit
 * rendering is required, convert the SVG text to outlines in your design
 * tool and re-export.
 */

const LOGO_SRC = "/logo/logo.svg";

export interface BrandMarkProps {
  /**
   * Wraps the mark in a Next.js <Link> when provided. Pass `null` (or omit)
   * to render the bare image — useful in places that already have a parent
   * link or in non-clickable contexts.
   */
  href?: string | null;
  /**
   * Tailwind sizing classes. The mark scales by height; width follows the
   * SVG's intrinsic aspect ratio (currently 2.5 : 1).
   */
  className?: string;
  /** Accessible label. Defaults to "mortly". */
  alt?: string;
  /** Optional title for hover affordance. */
  title?: string;
}

const DEFAULT_CLASS = "h-7 w-auto";

export default function BrandMark({
  href,
  className = DEFAULT_CLASS,
  alt = "mortly",
  title,
}: BrandMarkProps) {
  // eslint-disable-next-line @next/next/no-img-element
  const img = (
    <img src={LOGO_SRC} alt={alt} className={className} draggable={false} />
  );

  if (!href) return img;

  return (
    <Link href={href} className="inline-flex items-baseline" title={title}>
      {img}
    </Link>
  );
}
