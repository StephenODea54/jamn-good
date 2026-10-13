type Line = { slug: string; qty: number };
type CatalogItem = { name: string; price: number; image: string; url: string };

const KEY = 'jamn-good-cart';
const MAX_QTY = 99;

const money = (n: number) => `$${n.toFixed(2)}`;

export function initCart() {
  const root = document.querySelector<HTMLElement>('[data-cart-root]');
  const catalogEl = document.getElementById('cart-catalog');
  const template = document.getElementById('cart-line-template') as HTMLTemplateElement | null;
  if (!root || !catalogEl || !template) return;

  const catalog: Record<string, CatalogItem> = JSON.parse(catalogEl.textContent || '{}');
  const list = root.querySelector<HTMLElement>('[data-cart-lines]')!;
  const empty = root.querySelector<HTMLElement>('[data-cart-empty]')!;
  const subtotal = root.querySelector<HTMLElement>('[data-cart-subtotal]')!;
  const checkout = root.querySelector<HTMLButtonElement>('[data-cart-checkout]')!;
  const errorBox = root.querySelector<HTMLElement>('[data-cart-error]')!;
  let lastFocus: HTMLElement | null = null;

  const read = (): Line[] => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(v) ? v.filter((l) => catalog[l?.slug] && l.qty > 0) : [];
    } catch {
      return [];
    }
  };

  const write = (lines: Line[]) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      /* storage unavailable (private mode etc.) – cart still works for this page view */
    }
    memory = lines;
    render();
  };

  let memory = read();

  const render = () => {
    const lines = memory;
    const count = lines.reduce((n, l) => n + l.qty, 0);
    document.querySelectorAll<HTMLElement>('[data-cart-count]').forEach((el) => {
      el.textContent = String(count);
      el.hidden = count === 0;
    });

    list.replaceChildren(
      ...lines.map((line) => {
        const item = catalog[line.slug];
        const node = template.content.firstElementChild!.cloneNode(true) as HTMLElement;
        node.dataset.slug = line.slug;
        node.querySelectorAll<HTMLAnchorElement>('[data-line-link]').forEach((a) => (a.href = item.url));
        const img = node.querySelector<HTMLImageElement>('[data-line-img]')!;
        img.src = item.image;
        img.alt = item.name;
        node.querySelector('[data-line-name]')!.textContent = item.name;
        node.querySelector('[data-line-price]')!.textContent = money(item.price);
        node.querySelector('[data-line-count]')!.textContent = String(line.qty);
        node.querySelector('[data-line-dec]')!.setAttribute('aria-label', `Decrease ${item.name} quantity`);
        node.querySelector('[data-line-inc]')!.setAttribute('aria-label', `Increase ${item.name} quantity`);
        node.querySelector('[data-line-remove]')!.setAttribute('aria-label', `Remove ${item.name}`);
        return node;
      }),
    );

    const total = lines.reduce((sum, l) => sum + catalog[l.slug].price * l.qty, 0);
    subtotal.textContent = money(total);
    empty.hidden = lines.length > 0;
    list.hidden = lines.length === 0;
    checkout.disabled = lines.length === 0;
  };

  const setQty = (slug: string, qty: number) => {
    const lines = memory.map((l) => ({ ...l }));
    const line = lines.find((l) => l.slug === slug);
    if (line) line.qty = Math.min(qty, MAX_QTY);
    else if (qty > 0) lines.push({ slug, qty: Math.min(qty, MAX_QTY) });
    write(lines.filter((l) => l.qty > 0));
  };

  const open = () => {
    lastFocus = document.activeElement as HTMLElement | null;
    root.inert = false;
    root.setAttribute('data-open', '');
    document.documentElement.style.overflow = 'hidden';
    root.querySelector<HTMLElement>('.cart-drawer__close')?.focus();
  };

  const startCheckout = async () => {
    if (checkout.getAttribute('aria-busy') === 'true' || memory.length === 0) return;
    errorBox.hidden = true;
    checkout.setAttribute('aria-busy', 'true');
    checkout.textContent = 'Starting checkout…';
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: memory }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error(data.error || 'We couldn’t start checkout. Please try again.');
    } catch (err) {
      errorBox.textContent =
        err instanceof TypeError ? 'You seem to be offline. Please check your connection.' : (err as Error).message;
      errorBox.hidden = false;
      checkout.removeAttribute('aria-busy');
      checkout.textContent = 'Checkout';
    }
  };

  const close = () => {
    root.removeAttribute('data-open');
    root.inert = true;
    document.documentElement.style.overflow = '';
    lastFocus?.focus();
  };

  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;

    const add = t.closest<HTMLElement>('[data-add-to-cart]');
    if (add) {
      const slug = add.dataset.addToCart!;
      const qtyInput = add.closest('form, [data-product]')?.querySelector<HTMLInputElement>('[data-qty-input]');
      const qty = Math.max(1, parseInt(qtyInput?.value || '1', 10) || 1);
      const current = memory.find((l) => l.slug === slug)?.qty ?? 0;
      setQty(slug, current + qty);
      open();
      return;
    }

    if (t.closest('[data-cart-checkout]')) return void startCheckout();
    if (t.closest('[data-cart-open]')) return open();
    if (t.closest('[data-cart-close]')) return close();

    const line = t.closest<HTMLElement>('.cart-line');
    if (!line) return;
    const slug = line.dataset.slug!;
    const current = memory.find((l) => l.slug === slug)?.qty ?? 0;
    if (t.closest('[data-line-inc]')) setQty(slug, current + 1);
    else if (t.closest('[data-line-dec]')) setQty(slug, current - 1);
    else if (t.closest('[data-line-remove]')) setQty(slug, 0);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root.hasAttribute('data-open')) close();
  });

  // keep several open tabs in sync
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      memory = read();
      render();
    }
  });

  render();

  // Back from Stripe without paying: reopen the cart.
  const params = new URLSearchParams(location.search);
  if (params.get('cart') === 'open') {
    params.delete('cart');
    history.replaceState(null, '', location.pathname + (params.size ? `?${params}` : '') + location.hash);
    if (memory.length) open();
  }
}

/** Empty the cart (after a successful order). */
export function clearCart() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Quantity steppers outside the drawer (product page). */
export function initQtySteppers() {
  document.querySelectorAll<HTMLElement>('[data-qty]').forEach((wrap) => {
    const input = wrap.querySelector<HTMLInputElement>('[data-qty-input]');
    if (!input) return;
    const clamp = (n: number) => Math.min(MAX_QTY, Math.max(1, n || 1));
    wrap.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-qty-inc]')) input.value = String(clamp(+input.value + 1));
      if (t.closest('[data-qty-dec]')) input.value = String(clamp(+input.value - 1));
    });
    input.addEventListener('change', () => (input.value = String(clamp(+input.value))));
  });
}
