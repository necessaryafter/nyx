import { useState, useCallback } from "react";

function getStored(): boolean {
  try {
    return localStorage.getItem("nyx-sidebar-collapsed") === "true";
  } catch {
    return false;
  }
}

export function useSidebar() {
  const [collapsed, setCollapsedState] = useState(getStored);

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value);
    try {
      localStorage.setItem("nyx-sidebar-collapsed", String(value));
    } catch {}
  }, []);

  const toggle = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("nyx-sidebar-collapsed", String(next));
      } catch {}
      return next;
    });
  }, []);

  return { collapsed, setCollapsed, toggle };
}
