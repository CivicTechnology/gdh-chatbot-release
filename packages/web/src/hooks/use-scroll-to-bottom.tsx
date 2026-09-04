import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";

type ScrollFlag = ScrollBehavior | false;

export function useScrollToBottom() {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isSticky, setIsSticky] = useState(true);
  const isStickyRef = useRef(isSticky);
  const lastScrollTopRef = useRef(0);

  // Keep ref in sync with state
  useEffect(() => {
    isStickyRef.current = isSticky;
  }, [isSticky]);

  const { data: scrollBehavior = false, mutate: setScrollBehavior } =
    useSWR<ScrollFlag>("messages:should-scroll", null, { fallbackData: false });

  const handleScroll = useCallback(() => {
    if (!containerRef.current) {
      return;
    }
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;

    // Check if we are within 100px of the bottom (like v0 does)
    const atBottom = scrollTop + clientHeight >= scrollHeight - 100;
    setIsAtBottom(atBottom);

    // If user scrolled up (away from bottom), disable sticky mode
    if (scrollTop < lastScrollTopRef.current && !atBottom) {
      setIsSticky(false);
    }

    lastScrollTopRef.current = scrollTop;
  }, []);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const container = containerRef.current;

    const scrollToBottomIfSticky = () => {
      if (isStickyRef.current && container) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "instant",
        });
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        handleScroll();
        scrollToBottomIfSticky();
      });
    });

    const mutationObserver = new MutationObserver(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          handleScroll();
          scrollToBottomIfSticky();
        });
      });
    });

    resizeObserver.observe(container);
    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "data-state"],
    });

    handleScroll();

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [handleScroll]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    container.addEventListener("scroll", handleScroll);
    handleScroll(); // Check initial state

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll]);

  useEffect(() => {
    if (scrollBehavior && containerRef.current) {
      const container = containerRef.current;
      const scrollOptions: ScrollToOptions = {
        top: container.scrollHeight,
        behavior: scrollBehavior,
      };
      container.scrollTo(scrollOptions);
      setScrollBehavior(false);
    }
  }, [scrollBehavior, setScrollBehavior]);

  const scrollToBottom = useCallback(
    (currentScrollBehavior: ScrollBehavior = "smooth") => {
      setScrollBehavior(currentScrollBehavior);
      setIsSticky(true);
    },
    [setScrollBehavior]
  );

  function onViewportEnter() {
    setIsAtBottom(true);
  }

  function onViewportLeave() {
    setIsAtBottom(false);
  }

  return {
    containerRef,
    endRef,
    isAtBottom,
    isSticky,
    scrollToBottom,
    onViewportEnter,
    onViewportLeave,
  };
}
