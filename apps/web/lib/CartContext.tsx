"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { CartResponse, CartItemInput } from "@yourstore/shared";
import { apiClient } from "@/lib/api";

export interface GuestCartItem {
  productId: string;
  variantSku?: string | undefined;
  qty: number;
}

interface CartContextValue {
  cart: CartResponse | null;
  guestItems: GuestCartItem[];
  isLoading: boolean;
  refreshCart: () => Promise<void>;
  addItem: (item: CartItemInput) => Promise<void>;
  updateQty: (productId: string, qty: number, variantSku?: string  ) => Promise<void>;
  removeItem: (productId: string, variantSku?: string  ) => Promise<void>;
  mergeGuestCart: () => Promise<void>;
  itemCount: number;
}

const CartContext = createContext<CartContextValue | null>(null);

// In-memory guest cart (not localStorage as strictly per project requirement)
let inMemoryGuestCart: GuestCartItem[] = [];

export function getInMemoryGuestCart(): GuestCartItem[] {
  return [...inMemoryGuestCart];
}

export function clearInMemoryGuestCart(): void {
  inMemoryGuestCart = [];
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [guestItems, setGuestItems] = useState<GuestCartItem[]>(inMemoryGuestCart);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshCart = useCallback(async () => {
    try {
      const data = await apiClient<CartResponse>("/api/v1/cart");
      setCart(data);
    } catch {
      // Not logged in or guest
      setCart(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCart();
  }, [refreshCart]);

  const mergeGuestCart = useCallback(async () => {
    if (inMemoryGuestCart.length === 0) return;
    try {
      const merged = await apiClient<CartResponse>("/api/v1/cart/merge", {
        method: "POST",
        body: JSON.stringify({ items: inMemoryGuestCart }),
      });
      clearInMemoryGuestCart();
      setGuestItems([]);
      setCart(merged);
    } catch {
      // Ignored if user not authenticated or merge fails
    }
  }, []);

  const addItem = useCallback(
    async (item: CartItemInput) => {
      try {
        const updated = await apiClient<CartResponse>("/api/v1/cart/items", {
          method: "POST",
          body: JSON.stringify(item),
        });
        setCart(updated);
      } catch (err: unknown) {
        // If unauthenticated (401), store in guest cart in-memory
        const isAuthErr =
          err instanceof Error &&
          ("code" in err && (err as { code: string }).code === "UNAUTHORIZED" ||
           err.message.toLowerCase().includes("auth") ||
           err.message.toLowerCase().includes("unauthorized"));

        if (isAuthErr) {
          const existingIdx = inMemoryGuestCart.findIndex(
            (g) => g.productId === item.productId && g.variantSku === item.variantSku,
          );
          if (existingIdx > -1) {
            const current = inMemoryGuestCart[existingIdx];
            if (current) {
              current.qty += item.qty;
            }
          } else {
            const newItem: GuestCartItem = {
              productId: item.productId,
              qty: item.qty,
            };
            if (item.variantSku !== undefined) {
              newItem.variantSku = item.variantSku;
            }
            inMemoryGuestCart.push(newItem);
          }
          setGuestItems([...inMemoryGuestCart]);
          return;
        }
        throw err;
      }
    },
    [],
  );

  const updateQty = useCallback(
    async (productId: string, qty: number, variantSku?: string  ) => {
      if (cart) {
        const body: { productId: string; qty: number; variantSku?: string | undefined } = {
          productId,
          qty,
        };
        if (variantSku !== undefined) {
          body.variantSku = variantSku;
        }
        const updated = await apiClient<CartResponse>("/api/v1/cart/items", {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        setCart(updated);
      } else {
        // In-memory guest update
        if (qty === 0) {
          inMemoryGuestCart = inMemoryGuestCart.filter(
            (g) => !(g.productId === productId && g.variantSku === variantSku),
          );
        } else {
          const item = inMemoryGuestCart.find(
            (g) => g.productId === productId && g.variantSku === variantSku,
          );
          if (item) {
            item.qty = qty;
          }
        }
        setGuestItems([...inMemoryGuestCart]);
      }
    },
    [cart],
  );

  const removeItem = useCallback(
    async (productId: string, variantSku?: string  ) => {
      if (cart) {
        const body: { productId: string; variantSku?: string | undefined } = {
          productId,
        };
        if (variantSku !== undefined) {
          body.variantSku = variantSku;
        }
        const updated = await apiClient<CartResponse>("/api/v1/cart/items", {
          method: "DELETE",
          body: JSON.stringify(body),
        });
        setCart(updated);
      } else {
        inMemoryGuestCart = inMemoryGuestCart.filter(
          (g) => !(g.productId === productId && g.variantSku === variantSku),
        );
        setGuestItems([...inMemoryGuestCart]);
      }
    },
    [cart],
  );

  const itemCount = cart
    ? cart.itemCount
    : guestItems.reduce((acc, curr) => acc + curr.qty, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        guestItems,
        isLoading,
        refreshCart,
        addItem,
        updateQty,
        removeItem,
        mergeGuestCart,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}
