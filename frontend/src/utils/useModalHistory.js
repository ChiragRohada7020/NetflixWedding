import { useEffect, useRef } from "react";

export default function useModalHistory(isOpen, onClose) {
  const pushedRef = useRef(false);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen || pushedRef.current || typeof window === "undefined") return;
    window.history.pushState({ ...(window.history.state || {}), wedflixModal: true }, "", window.location.href);
    pushedRef.current = true;

    const handlePopState = () => {
      if (!pushedRef.current) return;
      pushedRef.current = false;
      closeRef.current?.();
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isOpen]);
}
