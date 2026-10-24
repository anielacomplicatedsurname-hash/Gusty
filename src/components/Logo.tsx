import Image from "next/image";
import { brand } from "@/config/brand";

// Aspect ratios from the traced originals' viewBoxes. Artwork is never redrawn or recoloured.
const variants = {
  primary: { src: brand.logo.primary, ratio: 3792 / 1296 },
  stacked: { src: brand.logo.stacked, ratio: 1116 / 1072 },
  icon: { src: brand.logo.icon, ratio: 928 / 756 },
  wordmark: { src: brand.logo.wordmark, ratio: 1388 / 616 },
  hey: { src: brand.logo.hey, ratio: 1468 / 844 },
} as const;

export function Logo({
  variant = "primary",
  height,
  alt = brand.name,
  priority,
}: {
  variant?: keyof typeof variants;
  height: number;
  alt?: string;
  priority?: boolean;
}) {
  const { src, ratio } = variants[variant];
  return (
    <Image
      src={src}
      alt={alt}
      height={height}
      width={Math.round(height * ratio)}
      priority={priority}
      unoptimized
    />
  );
}
