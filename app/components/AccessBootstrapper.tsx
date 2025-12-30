"use client";

import { useEffect } from "react";

export default function AccessBootstrapper() {
  useEffect(() => {
    fetch("/api/access").catch(() => {});
  }, []);

  return null;
}
