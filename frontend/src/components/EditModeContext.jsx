import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const EditModeContext = createContext(null);

export function EditModeProvider({ children, canEdit }) {
  const [editMode, setEditMode] = useState(false);
  const [cardSize, setCardSize] = useState(() => localStorage.getItem("wedflix_card_size") || "medium");
  const setCardSizeSafe = (value) => {
    const next = ["small", "medium", "large"].includes(value) ? value : "medium";
    setCardSize(next);
    localStorage.setItem("wedflix_card_size", next);
  };
  const value = useMemo(
    () => ({
      canEdit,
      editMode: canEdit ? editMode : false,
      setEditMode,
      toggleEditMode: () => canEdit && setEditMode((v) => !v),
      cardSize,
      setCardSize: setCardSizeSafe,
    }),
    [canEdit, editMode, cardSize]
  );
  useEffect(() => {
    document.body.classList.remove("card-size-small", "card-size-medium", "card-size-large");
    document.body.classList.add(`card-size-${cardSize}`);
  }, [cardSize]);
  return <EditModeContext.Provider value={value}>{children}</EditModeContext.Provider>;
}

export function useEditMode() {
  const ctx = useContext(EditModeContext);
  if (!ctx) return { canEdit: false, editMode: false, setEditMode: () => {}, toggleEditMode: () => {}, cardSize: "medium", setCardSize: () => {} };
  return ctx;
}
