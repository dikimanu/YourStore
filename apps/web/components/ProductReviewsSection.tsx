"use client";

import React, { useState, useEffect, useCallback } from "react";
import { apiClient, ApiClientError } from "@/lib/api";
import { useToast } from "@/components/Toast";

interface ReviewItem {
  id: string;
  userName: string;
  rating: number;
  title: string;
  body: string;
  createdAt: string;
}

interface ReviewsResponse {
  reviews: ReviewItem[];
  total: number;
  page: number;
  totalPages: number;
}

interface ProductReviewsSectionProps {
  productId: string;
  ratingAvg: number;
  ratingCount: number;
}

export function ProductReviewsSection({
  productId,
  ratingAvg,
  ratingCount,
}: ProductReviewsSectionProps) {
  const { showToast } = useToast();

  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [total, setTotal] = useState(ratingCount);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Form state
  const [rating, setRating] = useState<number>(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient<ReviewsResponse>(
        `/api/v1/reviews?productId=${productId}&page=${page}&limit=5`,
      );
      setReviews(res.reviews);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch {
      // Ignored or handled gracefully
    } finally {
      setLoading(false);
    }
  }, [productId, page]);

  useEffect(() => {
    void fetchReviews();
  }, [fetchReviews]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      await apiClient("/api/v1/reviews", {
        method: "POST",
        body: JSON.stringify({
          productId,
          rating,
          title: title.trim(),
          body: body.trim(),
        }),
      });

      showToast("Thank you! Your review has been published.", "success");
      setTitle("");
      setBody("");
      setRating(5);
      void fetchReviews();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFormError(err.message);
        showToast(err.message, "error");
      } else {
        const msg = err instanceof Error ? err.message : "Failed to submit review";
        setFormError(msg);
        showToast(msg, "error");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="pt-12 border-t border-gray-200 dark:border-gray-800 space-y-8">
      {/* Header & Overall Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Customer Reviews</h2>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center text-amber-400">
              {Array.from({ length: 5 }).map((_, idx) => (
                <span key={idx} className="text-lg">
                  {idx < Math.round(ratingAvg) ? "★" : "☆"}
                </span>
              ))}
            </div>
            <span className="text-sm font-semibold">
              {ratingAvg.toFixed(1)} out of 5
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({total} review{total !== 1 ? "s" : ""})
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Review Submission Form */}
        <div className="lg:col-span-1">
          <div className="border border-gray-200 dark:border-gray-800 rounded-2xl p-5 bg-white dark:bg-gray-900 space-y-4 sticky top-24">
            <h3 className="font-semibold text-base">Write a Review</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Only verified buyers who have received delivery of this product may submit a review.
            </p>

            {formError && (
              <div className="p-3 text-xs rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300">
                {formError}
              </div>
            )}

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              {/* Accessible Star Rating Input */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Rating *
                </label>
                <div
                  role="radiogroup"
                  aria-label="Rating from 1 to 5 stars"
                  className="flex items-center gap-1 text-2xl"
                >
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      role="radio"
                      aria-checked={rating === star}
                      aria-label={`${star} star${star > 1 ? "s" : ""}`}
                      onClick={() => setRating(star)}
                      className={`transition p-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded ${
                        star <= rating
                          ? "text-amber-400 hover:text-amber-500"
                          : "text-gray-300 dark:text-gray-600 hover:text-gray-400"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                  <span className="ml-2 text-xs font-semibold text-gray-600 dark:text-gray-400">
                    {rating} / 5
                  </span>
                </div>
              </div>

              <div>
                <label htmlFor="review-title" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Headline / Title *
                </label>
                <input
                  id="review-title"
                  type="text"
                  required
                  maxLength={100}
                  placeholder="e.g. Highly recommended, exceeded expectations"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="review-body" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Review Details *
                </label>
                <textarea
                  id="review-body"
                  required
                  rows={4}
                  maxLength={2000}
                  placeholder="Share your experience with build quality, performance, and day-to-day use..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition shadow disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Post Review"}
              </button>
            </form>
          </div>
        </div>

        {/* Reviews List */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="py-12 text-center text-gray-500">
              <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2" />
              Loading reviews…
            </div>
          ) : reviews.length === 0 ? (
            <div className="border border-dashed border-gray-300 dark:border-gray-800 rounded-2xl p-8 text-center text-gray-500 dark:text-gray-400 space-y-2">
              <div className="text-3xl">💬</div>
              <p className="font-semibold text-gray-700 dark:text-gray-300">No reviews yet</p>
              <p className="text-xs">Be the first verified customer to share your thoughts!</p>
            </div>
          ) : (
            reviews.map((rev) => (
              <div
                key={rev.id}
                className="border border-gray-200 dark:border-gray-800 rounded-2xl p-5 bg-white dark:bg-gray-900 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                      {rev.userName}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-300 font-medium">
                      ✓ Verified Buyer
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {new Date(rev.createdAt).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex text-amber-400 text-sm">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <span key={idx}>{idx < rev.rating ? "★" : "☆"}</span>
                    ))}
                  </div>
                  <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                    {rev.title}
                  </h4>
                </div>

                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line pt-1">
                  {rev.body}
                </p>
              </div>
            ))
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3.5 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3.5 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
