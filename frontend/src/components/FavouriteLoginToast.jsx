import React, { useCallback, useEffect, useState } from "react";

export function useFavouriteLoginToast() {
  const [visible, setVisible] = useState(false);

  const show = useCallback(() => {
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return undefined;
    const timer = window.setTimeout(() => setVisible(false), 3200);
    return () => window.clearTimeout(timer);
  }, [visible]);

  return { visible, show, hide: () => setVisible(false) };
}

export default function FavouriteLoginToast({ visible, onClose }) {
  if (!visible) return null;
  return (
    <div className="favourite-login-toast" role="status" aria-live="polite">
      <div>
        <strong>Login required</strong>
        <span>Sign in to save this wedding to your favourites.</span>
      </div>
      <button type="button" onClick={onClose} aria-label="Close message">
        x
      </button>
    </div>
  );
}
