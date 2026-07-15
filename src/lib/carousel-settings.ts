export const CAROUSEL_QUALITY_KEY = "jarvis:carousel-image-quality";
export const CAROUSEL_QUALITIES = ["low", "medium", "high"] as const;
export type CarouselImageQuality = (typeof CAROUSEL_QUALITIES)[number];

export function normalizeCarouselQuality(value: unknown): CarouselImageQuality {
  return CAROUSEL_QUALITIES.includes(value as CarouselImageQuality) ? value as CarouselImageQuality : "high";
}
