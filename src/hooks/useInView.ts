'use client';

import { useState, useEffect, useRef, RefObject } from 'react';

export function useInView(
  options: IntersectionObserverInit = { threshold: 0.1 }
): [RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsInView(entry.isIntersecting);
    }, options);

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [options]);

  return [ref, isInView];
}
