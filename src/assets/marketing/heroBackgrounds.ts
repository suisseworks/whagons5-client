/**
 * Curated, logistics-themed hero backgrounds (free Unsplash images).
 *
 * NOTE:
 * - We intentionally use stable `images.unsplash.com/photo-...` URLs (not Unsplash+ / premium),
 *   and we avoid generic/unrelated imagery.
 * - Parameters keep a consistent, performant hero crop.
 *
 * Optional local additions:
 * - If you want to ship your own images, drop them into `public/images/marketing/hero/`
 *   and update `LOCAL_HERO_BACKGROUND_IMAGES` to point at those `/images/...` paths.
 */
const UNSPLASH_HERO_PARAMS = "auto=format&fit=crop&w=1920&q=80";

const u = (base: string) => `${base}?${UNSPLASH_HERO_PARAMS}`;

/**
 * Featured hero images shown early in the rotation.
 *
 * We default these to stable Unsplash `images.unsplash.com/photo-...` URLs so you
 * don't have to manage local assets. You can swap these to local `/images/...` paths
 * if you prefer shipping the images with the app.
 */
export const LOCAL_HERO_BACKGROUND_IMAGES: string[] = [
  // Nature / inspiration (featured)
  u("https://images.unsplash.com/photo-1507525428034-b723cf961d3e"), // ocean / waves
  u("https://images.unsplash.com/photo-1441974231531-c6227db76b6e"), // forest path
  u("https://images.unsplash.com/photo-1619973528933-37f6e22879f8"), // on a mountain peak
  u("https://images.unsplash.com/photo-1469474968028-56623f02e42e"), // mountain range / mist
];

export const HERO_BACKGROUND_IMAGES: string[] = [
  ...LOCAL_HERO_BACKGROUND_IMAGES,
  // Warehouse / logistics
  u("https://images.unsplash.com/photo-1645736315000-6f788915923b"), // forklift in warehouse
  u("https://images.unsplash.com/photo-1740914994657-f1cdffdc418e"), // forklift / warehouse scene
  u("https://images.unsplash.com/photo-1740914994162-0b2a49280aeb"), // warehouse worker on ladder
  u("https://images.unsplash.com/photo-1644079446600-219068676743"), // warehouse shelves/aisles
  u("https://images.unsplash.com/photo-1573205485246-ee99bb898ff6"), // boxes on warehouse shelves
  u("https://images.unsplash.com/photo-1739204618173-3e89def7140f"), // pallets / storage

  // Freight / transport
  u("https://images.unsplash.com/photo-1695222833131-54ee679ae8e5"), // truck on road (motion blur)

  // Ports / containers
  u("https://images.unsplash.com/photo-1511578194003-00c80e42dc9b"), // aerial intermodal containers

  // Hospitality (hotels)
  u("https://images.unsplash.com/photo-1560662105-57f8ad6ae2d1"), // hotel lobby / reception

  // Food industry (commercial kitchen)
  u("https://images.unsplash.com/photo-1588416820614-f8d6ac6cea56"), // commercial kitchen / pots on stove

  // Retail
  // Education (high schools)
  u("https://images.unsplash.com/photo-1670924786856-9ae9882ca224"), // classroom

  // Nature / adventure
  u("https://images.unsplash.com/photo-1502126324834-38f8e02d7160"), // climbing a mountain
  u("https://images.unsplash.com/photo-1506905925346-21bda4d32df4"), // mountain lake reflection
];


