import { useEffect, useRef, useState } from "react";
import { HERO_IMAGES } from "../constants";

export default function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const trackRef = useRef<HTMLDivElement>(null);
  const lastInteractionRef = useRef(Date.now());

  useEffect(() => {
    if (!autoScroll) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % HERO_IMAGES.length);
    }, 10000);
    return () => clearInterval(id);
  }, [autoScroll]);

  useEffect(() => {
    if (!trackRef.current) return;
    const w = trackRef.current.offsetWidth;
    trackRef.current.scrollTo({ left: index * w, behavior: "smooth" });
  }, [index]);

  const handleArrow = (dir: number) => {
    setAutoScroll(false);
    lastInteractionRef.current = Date.now();
    setIndex((i) => {
      const next = i + dir;
      if (next < 0) return HERO_IMAGES.length - 1;
      if (next >= HERO_IMAGES.length) return 0;
      return next;
    });
  };

  useEffect(() => {
    if (!autoScroll) {
      const id = setInterval(() => {
        if (Date.now() - lastInteractionRef.current >= 30000) {
          setAutoScroll(true);
        }
      }, 1000);
      return () => clearInterval(id);
    }
  }, [autoScroll]);

  return (
    <section className="hero hero-carousel-h" aria-label="Signature dishes carousel">
      <button
        type="button"
        className="hero-arrow hero-arrow-left"
        onClick={() => handleArrow(-1)}
        aria-label="Previous slide"
      />
      <button
        type="button"
        className="hero-arrow hero-arrow-right"
        onClick={() => handleArrow(1)}
        aria-label="Next slide"
      />
      <div ref={trackRef} className="hero-track" style={{ overflowX: "auto" }}>
        {HERO_IMAGES.map((src) => (
          <div
            key={src}
            className="hero-slide-h"
            style={{ backgroundImage: `url(${src})` }}
          />
        ))}
      </div>
    </section>
  );
}
