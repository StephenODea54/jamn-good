// Product types and helpers. The products themselves are edited in EmDash (see src/lib/content.ts).

export interface Photo {
  src: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface Product {
  slug: string;
  name: string;
  price: number;
  kind: 'jam' | 'baked';
  /** Limited-run item: also listed under the Limited tab */
  limited: boolean;
  /** Toggled in EmDash: shows an Out of Stock badge and can't be added to the cart or bought */
  outOfStock: boolean;
  /** Short tag shown under the price, e.g. "(Limited)" */
  note?: string;
  /** Square-ish photo used on the shop grid, product cards and cart */
  image?: Photo;
  /** Large photo on the product page (falls back to `image`) */
  hero?: Photo;
  /** Extra gallery thumbnails on the product page */
  gallery: Photo[];
  /** Wide photo for the homepage row (falls back to `image`) */
  home?: Photo;
  /** Position in the homepage row; products without one are not featured */
  homePosition?: number;
  description: string;
  /** The facts block and star rating only show when these are filled in */
  ingredients?: string;
  storage?: string;
  rating?: number;
  reviews?: number;
}

/** Shop page tabs. Jams and Baked Goods filter by type; Limited shows anything marked limited. */
export const shopTabs: { id: 'all' | 'jam' | 'baked' | 'limited'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'jam', label: 'Jams' },
  { id: 'baked', label: 'Baked Goods' },
  { id: 'limited', label: 'Limited' },
];

export const productUrl = (p: Pick<Product, 'slug'>) => `/shop/${p.slug}`;

export const formatPrice = (n: number) => `$${n.toFixed(2)}`;
