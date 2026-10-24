import type { CSSProperties } from "react";

export const symbolNames = [
  "bench", "bridge", "bud", "clover", "flower", "gathering", "horizon-hill", "house",
  "leaf-cluster", "leafy-sprig", "open-hands", "organic-burst", "path", "raindrop",
  "spark", "sprout", "star", "tree", "two-waves",
] as const;
export type SymbolName = (typeof symbolNames)[number];

/**
 * One of the approved organic symbols, painted in the current text colour via a CSS mask
 * so it follows the theme. Decorative by default; pass `label` when it carries meaning.
 */
export function BrandSymbol({
  name,
  size = 32,
  label,
  className,
}: {
  name: SymbolName;
  size?: number;
  label?: string;
  className?: string;
}) {
  const url = `url(/brand/symbols/${name}.svg)`;
  const style: CSSProperties = {
    width: size,
    height: size,
    backgroundColor: "currentColor",
    maskImage: url,
    WebkitMaskImage: url,
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskPosition: "center",
    WebkitMaskPosition: "center",
    maskSize: "contain",
    WebkitMaskSize: "contain",
    display: "inline-block",
    flexShrink: 0,
  };
  return label ? (
    <span role="img" aria-label={label} className={className} style={style} />
  ) : (
    <span aria-hidden="true" className={className} style={style} />
  );
}
