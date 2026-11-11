"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

/**
 * Next keeps recently visited pages mounted (hidden with React Activity), so a form that was
 * submitted successfully would still show its old values when the user comes back. This hook
 * returns a key that changes when the page is hidden after a submit, remounting the form fresh.
 * Drafts the user abandoned without submitting are kept.
 */
export function useResetOnHide() {
  const [key, setKey] = useState(0);
  const submitted = useRef(false);

  useLayoutEffect(() => {
    return () => {
      if (submitted.current) {
        submitted.current = false;
        setKey((k) => k + 1);
      }
    };
  }, []);

  const markSubmitted = useCallback(() => {
    submitted.current = true;
  }, []);
  const clearSubmitted = useCallback(() => {
    submitted.current = false;
  }, []);

  return { key, markSubmitted, clearSubmitted };
}
