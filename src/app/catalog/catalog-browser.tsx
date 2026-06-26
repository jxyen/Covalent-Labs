"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CATEGORIES,
  fromPrice,
  type FilterCategory,
  type Product,
} from "@/lib/products";
import { ProductCard } from "@/components/product-card";

type SortKey = "popular" | "rating" | "price-asc" | "price-desc" | "name";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "popular", label: "Most popular" },
  { key: "rating", label: "Top rated" },
  { key: "price-asc", label: "Price: low to high" },
  { key: "price-desc", label: "Price: high to low" },
  { key: "name", label: "Alphabetical" },
];

function isCategory(value: string | null): value is FilterCategory {
  return value !== null && (CATEGORIES as string[]).includes(value);
}

function CatalogInner({ products }: { products: Product[] }) {
  const searchParams = useSearchParams();
  const initialCat = searchParams.get("cat");

  const [category, setCategory] = useState<FilterCategory>(
    isCategory(initialCat) ? initialCat : "All"
  );
  const [sort, setSort] = useState<SortKey>("popular");

  const sorted = useMemo(() => {
    const filtered =
      category === "All" ? products : products.filter((p) => p.category === category);

    const result = [...filtered];
    switch (sort) {
      case "popular":
        result.sort((a, b) => b.reviews - a.reviews);
        break;
      case "rating":
        result.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
        break;
      case "price-asc":
        result.sort((a, b) => fromPrice(a) - fromPrice(b));
        break;
      case "price-desc":
        result.sort((a, b) => fromPrice(b) - fromPrice(a));
        break;
      case "name":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    return result;
  }, [products, category, sort]);

  return (
    <main
      className="container"
      style={{ padding: "clamp(36px,6vw,64px) 20px clamp(56px,8vw,96px)" }}
    >
      <div className="eyebrow">Catalog</div>
      <h1 style={{ margin: "12px 0 0", fontSize: "clamp(28px,5vw,42px)", fontWeight: 600, letterSpacing: "-0.03em" }}>
        Research peptides
      </h1>
      <p style={{ margin: "12px 0 0", fontSize: 16, lineHeight: 1.6, color: "var(--ink-muted)", maxWidth: 560 }}>
        Every compound is independently lab-tested with a verifiable certificate of analysis. All
        products are for research use only.
      </p>

      <div
        style={{
          margin: "28px 0 22px",
          display: "flex",
          gap: 10,
          overflowX: "auto",
          paddingBottom: 4,
          WebkitOverflowScrolling: "touch",
        }}
      >
        {CATEGORIES.map((c) => (
          <button
            key={c}
            className="cat-chip"
            data-active={c === category}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          marginBottom: 22,
        }}
      >
        <span style={{ fontSize: 13.5, color: "var(--ink-faint)" }}>
          {sorted.length} {sorted.length === 1 ? "product" : "products"}
          {category !== "All" ? ` in ${category}` : ""}
        </span>
        <label style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span className="font-mono" style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-ghost)" }}>
            Sort
          </span>
          <select
            className="sort-select"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        className="product-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(244px, 1fr))",
          gap: 18,
        }}
      >
        {sorted.map((p) => (
          <ProductCard key={p.code} product={p} variant="catalog" />
        ))}
      </div>
    </main>
  );
}

export function CatalogBrowser({ products }: { products: Product[] }) {
  return (
    <Suspense fallback={null}>
      <CatalogInner products={products} />
    </Suspense>
  );
}
