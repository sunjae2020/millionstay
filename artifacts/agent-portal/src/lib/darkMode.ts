import { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "ms_dark_mode";

function read(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function apply(enabled: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", enabled);
}

export function initDarkMode() {
  apply(read());
}

export function useDarkMode() {
  const [enabled, setEnabled] = useState<boolean>(read);

  useEffect(() => {
    apply(enabled);
  }, [enabled]);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { darkMode: enabled, toggleDarkMode: toggle };
}
