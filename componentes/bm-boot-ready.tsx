"use client";

import { useLayoutEffect } from "react";

export function BmBootReady() {
  useLayoutEffect(() => {
    document.documentElement.dataset.bmAppReady = "true";
  }, []);

  return null;
}
