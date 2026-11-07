"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient, ApiClientError } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { useCart } from "@/lib/CartContext";
import type { Address, ValidateCouponResponse } from "@yourstore/shared";

interface CheckoutOrder {
  orderId: string;
  sessionId?: string | undefined;
  url?: string | undefined;
}

interface AddressFormData {
  label: string;
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { cart, refreshCart } = useCart();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [couponCode, setCouponCode] = useState("");
  const [couponResult, setCouponResult] = useState<ValidateCouponResponse | null>(null);
  const [couponError, setCouponError] = useState<string>("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

  const [addressForm, setAddressForm] = useState<AddressFormData>({
    label: "Home",
    name: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    pincode: "",
  });

  const loadData = useCallback(async () => {
    try {
      const res = await apiClient<{ addresses: Address[] }>("/api/v1/addresses");
      setAddresses(res.addresses);
      if (res.addresses.length > 0 && res.addresses[0]) {
        setSelectedAddressId(res.addresses[0].id ?? res.addresses[0]._id ?? "");
      }
    } catch {
      showToast("Could not load your addresses. Please log in.", "error");
      router.push("/login?redirect=/checkout");
    } finally {
      setPageLoading(false);
    }
  }, [router, showToast]);

  useEffect(() => {
    void loadData();
    void refreshCart();
  }, [loadData, refreshCart]);

  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) return;
    setValidatingCoupon(true);
    setCouponError("");
    setCouponResult(null);
    try {
      const subtotal = cart?.subtotal ?? 0;
      const res = await apiClient<ValidateCouponResponse>("/api/v1/coupons/validate", {
        method: "POST",
        body: JSON.stringify({ code: couponCode.trim().toUpperCase(), subtotal }),
      });
      setCouponResult(res);
      showToast(`Coupon applied! You save ₹${res.discount}`, "success");
    } catch (err) {
      setCouponError(err instanceof ApiClientError ? err.message : "Invalid coupon");
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleSaveAddress = async () => {
    setSavingAddress(true);
    try {
      const res = await apiClient<{ address: Address }>("/api/v1/addresses", {
        method: "POST",
        body: JSON.stringify(addressForm),
      });
      setAddresses((prev) => [...prev, res.address]);
      setSelectedAddressId(res.address.id ?? res.address._id ?? "");
      setShowAddressForm(false);
      showToast("Address saved!", "success");
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : "Failed to save address", "error");
    } finally {
      setSavingAddress(false);
    }
  };

  const handleStripeCheckout = async () => {
    if (!selectedAddressId) {
      showToast("Please select a delivery address", "error");
      return;
    }
    setCheckoutLoading(true);
    try {
      const body: { addressId: string; couponCode?: string | undefined } = {
        addressId: selectedAddressId,
      };
      if (couponResult) {
        body.couponCode = couponResult.code;
      }
      const res = await apiClient<CheckoutOrder>("/api/v1/checkout/stripe", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (res.url) {
        window.location.href = res.url;
      } else {
        showToast("Failed to get Stripe checkout URL", "error");
      }
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : "Checkout failed", "error");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleCodCheckout = async () => {
    if (!selectedAddressId) {
      showToast("Please select a delivery address", "error");
      return;
    }
    setCheckoutLoading(true);
    try {
      const body: { addressId: string; couponCode?: string | undefined } = {
        addressId: selectedAddressId,
      };
      if (couponResult) {
        body.couponCode = couponResult.code;
      }
      const res = await apiClient<CheckoutOrder>("/api/v1/checkout/cod", {
        method: "POST",
        body: JSON.stringify(body),
      });
      showToast("Order placed! Cash on delivery.", "success");
      router.push(`/orders/${res.orderId}`);
    } catch (err) {
      showToast(err instanceof ApiClientError ? err.message : "Checkout failed", "error");
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="text-center py-24 space-y-4">
        <p className="text-xl font-semibold text-gray-700 dark:text-gray-300">
          Your cart is empty. Nothing to check out.
        </p>
        <Link
          href="/products"
          className="inline-block px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
        >
          Shop Now
        </Link>
      </div>
    );
  }

  const effectiveSubtotal = couponResult ? couponResult.newSubtotal : cart.subtotal;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Address + Coupon */}
        <div className="lg:col-span-2 space-y-6">
          {/* Address Selection */}
          <section className="border border-gray-200 dark:border-gray-800 rounded-xl p-6 bg-white dark:bg-gray-900 space-y-4">
            <h2 className="text-lg font-semibold">Delivery Address</h2>
            {addresses.length === 0 && !showAddressForm && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No addresses saved yet.{" "}
                <button
                  type="button"
                  onClick={() => setShowAddressForm(true)}
                  className="text-blue-600 dark:text-blue-400 underline"
                >
                  Add one
                </button>
              </p>
            )}
            <div className="space-y-3">
              {addresses.map((addr) => {
                const addrId = addr.id ?? addr._id ?? "";
                return (
                  <label
                    key={addrId}
                    className={`flex gap-3 p-3 rounded-lg border cursor-pointer transition ${
                      selectedAddressId === addrId
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
                    }`}
                  >
                    <input
                      type="radio"
                      name="address"
                      value={addrId}
                      checked={selectedAddressId === addrId}
                      onChange={() => setSelectedAddressId(addrId)}
                      className="mt-0.5 accent-blue-600"
                    />
                    <div className="text-sm">
                      <p className="font-medium">{addr.label} — {addr.name}</p>
                      <p className="text-gray-500 dark:text-gray-400">
                        {addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}, {addr.city}, {addr.state} {addr.pincode}
                      </p>
                      <p className="text-gray-500 dark:text-gray-400">{addr.phone}</p>
                    </div>
                  </label>
                );
              })}
            </div>
            {!showAddressForm ? (
              <button
                type="button"
                onClick={() => setShowAddressForm(true)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                + Add a new address
              </button>
            ) : (
              <div className="space-y-3 border-t border-gray-200 dark:border-gray-800 pt-4 mt-2">
                <h3 className="text-sm font-semibold">New Address</h3>
                {(
                  [
                    ["label", "Label (e.g. Home, Office)"],
                    ["name", "Full Name"],
                    ["phone", "Phone"],
                    ["line1", "Address Line 1"],
                    ["line2", "Address Line 2 (optional)"],
                    ["city", "City"],
                    ["state", "State"],
                    ["pincode", "Pincode"],
                  ] as [keyof AddressFormData, string][]
                ).map(([field, placeholder]) => (
                  <input
                    key={field}
                    type="text"
                    placeholder={placeholder}
                    value={addressForm[field]}
                    onChange={(e) =>
                      setAddressForm((prev) => ({ ...prev, [field]: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ))}
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={savingAddress}
                    onClick={() => void handleSaveAddress()}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingAddress ? "Saving…" : "Save Address"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddressForm(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Coupon */}
          <section className="border border-gray-200 dark:border-gray-800 rounded-xl p-6 bg-white dark:bg-gray-900 space-y-3">
            <h2 className="text-lg font-semibold">Coupon Code</h2>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter coupon code"
                value={couponCode}
                disabled={couponResult !== null}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              {couponResult ? (
                <button
                  type="button"
                  onClick={() => { setCouponResult(null); setCouponCode(""); }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Remove
                </button>
              ) : (
                <button
                  type="button"
                  disabled={validatingCoupon || !couponCode.trim()}
                  onClick={() => void handleValidateCoupon()}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {validatingCoupon ? "Checking…" : "Apply"}
                </button>
              )}
            </div>
            {couponError && (
              <p className="text-xs text-red-500">{couponError}</p>
            )}
            {couponResult && (
              <p className="text-xs text-green-600 dark:text-green-400">
                ✓ Coupon applied! You save ₹{couponResult.discount.toLocaleString("en-IN")}
              </p>
            )}
          </section>
        </div>

        {/* Right: Order Summary + Payment */}
        <div className="lg:col-span-1">
          <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-6 bg-white dark:bg-gray-900 space-y-4 sticky top-24">
            <h2 className="text-lg font-semibold">Order Summary</h2>
            <div className="space-y-2 text-sm">
              {cart.items.map((item) => (
                <div
                  key={item.productId + (item.variantSku ?? "")}
                  className="flex justify-between gap-2"
                >
                  <span className="text-gray-600 dark:text-gray-300 truncate">
                    {item.title} × {item.qty}
                  </span>
                  <span className="font-medium flex-shrink-0">
                    ₹{item.lineTotal.toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-200 dark:border-gray-800 pt-3 space-y-1 text-sm">
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>Subtotal</span>
                <span>₹{cart.subtotal.toLocaleString("en-IN")}</span>
              </div>
              {couponResult && (
                <div className="flex justify-between text-green-600 dark:text-green-400">
                  <span>Discount ({couponResult.code})</span>
                  <span>−₹{couponResult.discount.toLocaleString("en-IN")}</span>
                </div>
              )}
              <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
                <span>Shipping &amp; Tax</span>
                <span>Calculated at checkout</span>
              </div>
              {couponResult && (
                <div className="flex justify-between font-semibold text-gray-900 dark:text-gray-100 border-t border-gray-200 dark:border-gray-800 pt-1">
                  <span>Effective subtotal</span>
                  <span>₹{effectiveSubtotal.toLocaleString("en-IN")}</span>
                </div>
              )}
            </div>

            <div className="space-y-3 border-t border-gray-200 dark:border-gray-800 pt-4">
              <button
                type="button"
                disabled={checkoutLoading || !selectedAddressId}
                onClick={() => void handleStripeCheckout()}
                className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {checkoutLoading ? "Processing…" : "Pay with Stripe"}
              </button>
              <button
                type="button"
                disabled={checkoutLoading || !selectedAddressId}
                onClick={() => void handleCodCheckout()}
                className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {checkoutLoading ? "Processing…" : "Cash on Delivery"}
              </button>
            </div>

            <Link
              href="/cart"
              className="block text-center text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 mt-2"
            >
              ← Edit Cart
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
