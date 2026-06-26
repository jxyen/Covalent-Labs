"use client";

import { useState } from "react";
import Link from "next/link";
import { CATEGORY_META, type Category, type Product } from "@/lib/products";
import { ProductCard } from "@/components/product-card";

/**
 * Tabbed category browser (replaces the stacked category cards). Tabs scroll
 * horizontally on mobile; tapping one reveals that category's products in a
 * compact grid below — far less vertical scrolling than stacked cards.
 */
export function CategoryTabs({ products }: { products: Product[] }) {
  const [active, setActive] = useState<Category>(CATEGORY_META[0].name);
  const meta = CATEGORY_META.find((c) => c.name === active)!;
  const filtered = products.filter((p) => p.category === active);

  return (
    <div>
      <div className="cat-tabs" role="tablist" aria-label="Research categories">
        {CATEGORY_META.map((c) => (
          <button
            key={c.name}
            role="tab"
            aria-selected={c.name === active}
            className="cat-tab"
            data-active={c.name === active}
            onClick={() => setActive(c.name)}
          >
            {c.name}
          </button>
        ))}
      </div>

      <p className="cat-tab-blurb">{meta.blurb}</p>

      <div className="cat-tab-grid">
        {filtered.map((p) => (
          <ProductCard key={p.code} product={p} variant="catalog" />
        ))}
      </div>

      <div style={{ marginTop: 22, textAlign: "center" }}>
        <Link href={`/catalog?cat=${encodeURIComponent(active)}`} className="btn btn-ghost" style={{ fontSize: 14, padding: "12px 22px" }}>
          View all {active} →
        </Link>
      </div>
    </div>
  );
}
