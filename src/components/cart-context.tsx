"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { addItem, setQty as setQtyFn, removeItem, itemCount, type CartItem } from "@/lib/cart/cart";

const KEY = "kairo-cart-v1";

interface CartContextValue {
  items: CartItem[];
  count: number;
  add: (item: CartItem) => void;
  setQty: (sizeId: string, qty: number) => void;
  remove: (sizeId: string) => void;
  clear: () => void;
  justAdded: string | null;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      // Deliberate post-mount hydration: starting empty then setState avoids an
      // SSR/client markup mismatch on cart count. The lint rule's perf concern
      // does not apply to one-shot hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setItems(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
  }, [items]);

  const add = useCallback((item: CartItem) => {
    setItems((cur) => addItem(cur, item));
    setJustAdded(item.productCode);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setJustAdded(null), 1300);
  }, []);
  const setQty = useCallback((sizeId: string, qty: number) => setItems((cur) => setQtyFn(cur, sizeId, qty)), []);
  const remove = useCallback((sizeId: string) => setItems((cur) => removeItem(cur, sizeId)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({ items, count: itemCount(items), add, setQty, remove, clear, justAdded }),
    [items, add, setQty, remove, clear, justAdded],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
