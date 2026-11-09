"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Slide {
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  imageUrl: string;
  alt: string;
}

const SLIDES: Slide[] = [
  {
    title: "New Arrivals",
    subtitle: "Discover the latest products just landed in our store — fresh picks every week.",
    ctaLabel: "Shop New Arrivals",
    ctaHref: "/products?sort=newest",
    secondaryLabel: "Browse All",
    secondaryHref: "/products",
    imageUrl: "https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=1600&q=70",
    alt: "New arrivals — colourful sneakers on a shelf",
  },
  {
    title: "Premium Collection",
    subtitle: "Explore our finest, high-end products crafted for those who appreciate quality.",
    ctaLabel: "Shop Premium",
    ctaHref: "/products?sort=price_desc",
    secondaryLabel: "See Top Rated",
    secondaryHref: "/products?sort=rating",
    imageUrl: "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?auto=format&fit=crop&w=1600&q=70",
    alt: "Premium electronics — a sleek laptop on a desk",
  },
  {
    title: "Top Rated Picks",
    subtitle: "Shop the most loved products by our community — tried, tested and praised.",
    ctaLabel: "View Top Rated",
    ctaHref: "/products?sort=rating",
    imageUrl: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1600&q=70",
    alt: "Top rated fashion products on a colourful rack",
  },
  {
    title: "Shop by Category",
    subtitle: "Foods, Books, Health, Industrial and so much more — all under one roof.",
    ctaLabel: "Explore Categories",
    ctaHref: "/products",
    secondaryLabel: "Foods & Grocery",
    secondaryHref: "/products?category=foods",
    imageUrl: "https://images.unsplash.com/photo-1543168256-418811576931?auto=format&fit=crop&w=1600&q=70",
    alt: "Vibrant grocery market — fresh fruits and vegetables",
  },
  {
    title: "Contact Us",
    subtitle: "Have a question or feedback? We'd love to hear from you. Reach out anytime.",
    ctaLabel: "Get in Touch",
    ctaHref: "/contact",
    imageUrl: "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1600&q=70",
    alt: "Person writing a message — customer support concept",
  },
];

const INTERVAL_MS = 6000;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

export function HeroCarousel() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const reduced = usePrefersReducedMotion();
  const liveRef = useRef<HTMLDivElement>(null);
  const pointerStartX = useRef<number | null>(null);
  const pathname = usePathname();

  const count = SLIDES.length;

  const goTo = useCallback(
    (index: number, dir: "next" | "prev" = "next") => {
      if (animating) return;
      setDirection(dir);
      setAnimating(true);
      setTimeout(
        () => {
          setCurrent((index + count) % count);
          setAnimating(false);
        },
        reduced ? 0 : 400,
      );
    },
    [animating, count, reduced],
  );

  const goNext = useCallback(() => goTo(current + 1, "next"), [current, goTo]);
  const goPrev = useCallback(() => goTo(current - 1, "prev"), [current, goTo]);

  // Auto-advance
  useEffect(() => {
    if (paused || reduced) return;
    const id = setInterval(goNext, INTERVAL_MS);
    return () => clearInterval(id);
  }, [paused, reduced, goNext]);

  // Reset on route change
  useEffect(() => {
    setCurrent(0);
  }, [pathname]);

  // Keyboard navigation on the whole carousel
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") goNext();
    if (e.key === "ArrowLeft") goPrev();
  };

  // Swipe / pointer events
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pointerStartX.current = e.clientX;
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerStartX.current === null) return;
    const delta = e.clientX - pointerStartX.current;
    pointerStartX.current = null;
    if (Math.abs(delta) < 40) return;
    if (delta < 0) goNext();
    else goPrev();
  };

  const slide = SLIDES[current];
  if (!slide) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured promotions"
      className="relative w-full overflow-hidden rounded-2xl"
      style={{ height: "clamp(340px, 60vh, 85vh)" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={handleKeyDown}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      tabIndex={0}
    >
      {/* Slides */}
      {SLIDES.map((s, i) => {
        const isActive = i === current;
        const translateClass =
          !reduced && animating
            ? isActive
              ? direction === "next"
                ? "translate-x-0 opacity-100"
                : "translate-x-0 opacity-100"
              : direction === "next"
                ? "-translate-x-full opacity-0"
                : "translate-x-full opacity-0"
            : isActive
              ? "translate-x-0 opacity-100"
              : "translate-x-full opacity-0 pointer-events-none";
        return (
          <div
            key={s.ctaHref}
            role="group"
            aria-roledescription="slide"
            aria-label={`Slide ${i + 1} of ${count}: ${s.title}`}
            aria-hidden={!isActive}
            className={`absolute inset-0 transition-all ${reduced ? "" : "duration-500 ease-in-out"} ${translateClass}`}
          >
            {/* Background image */}
            <img
              src={s.imageUrl}
              alt={s.alt}
              width={1600}
              height={900}
              loading={i === 0 ? "eager" : "lazy"}
              decoding={i === 0 ? "sync" : "async"}
              className="absolute inset-0 w-full h-full object-cover"
              draggable={false}
            />
            {/* Dark gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
            {/* Content */}
            <div className="absolute inset-0 flex flex-col justify-end px-6 pb-16 sm:px-12 sm:pb-20 lg:px-20 lg:pb-24 max-w-4xl">
              <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-tight drop-shadow-lg">
                {s.title}
              </h2>
              <p className="mt-3 text-base sm:text-lg text-white/85 max-w-xl leading-relaxed drop-shadow">
                {s.subtitle}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={s.ctaHref}
                  className="rounded-lg bg-white text-gray-900 font-semibold px-6 py-3 hover:bg-blue-50 transition shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  {s.ctaLabel}
                </Link>
                {s.secondaryLabel && s.secondaryHref && (
                  <Link
                    href={s.secondaryHref}
                    className="rounded-lg border border-white/60 text-white font-semibold px-6 py-3 hover:bg-white/10 transition shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    {s.secondaryLabel}
                  </Link>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Prev / Next buttons */}
      <button
        type="button"
        onClick={goPrev}
        aria-label="Previous slide"
        className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        type="button"
        onClick={goNext}
        aria-label="Next slide"
        className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Dot indicators */}
      <div
        role="tablist"
        aria-label="Slide indicators"
        className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex gap-2"
      >
        {SLIDES.map((s, i) => (
          <button
            key={s.ctaHref}
            type="button"
            role="tab"
            aria-selected={i === current}
            aria-label={`Go to slide ${i + 1}: ${s.title}`}
            onClick={() => goTo(i, i > current ? "next" : "prev")}
            className={`rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
              i === current
                ? "w-8 h-2.5 bg-white"
                : "w-2.5 h-2.5 bg-white/50 hover:bg-white/75"
            }`}
          />
        ))}
      </div>

      {/* Aria live for screen readers */}
      <div ref={liveRef} aria-live="polite" aria-atomic="true" className="sr-only">
        {`Slide ${current + 1} of ${count}: ${slide.title}`}
      </div>
    </section>
  );
}
