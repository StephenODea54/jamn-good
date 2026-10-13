// Product types and helpers. The products themselves are edited in EmDash (see src/lib/content.ts).

export type Category = 'fruit' | 'specialty' | 'limited';

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
  category: Category;
  kind: 'jam' | 'baked';
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

export const categories: { id: 'all' | Category; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'fruit', label: 'Fruit' },
  { id: 'specialty', label: 'Specialty' },
  { id: 'limited', label: 'Limited' },
];

export const productUrl = (p: Pick<Product, 'slug'>) => `/shop/${p.slug}`;

export const formatPrice = (n: number) => `$${n.toFixed(2)}`;
