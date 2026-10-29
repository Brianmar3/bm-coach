"use client";

import { useEffect, useState } from "react";
import { formatStudentWeight, latestStudentWeight } from "@/lib/student-latest-weight";
import type { StudentEvaluation } from "@/types/evaluation-read-model";

export function StudentLatestWeight({ studentId, profileWeight, revision = 0 }: { studentId: string; profileWeight: number; revision?: number }) {
  const [result, setResult] = useState<{ studentId: string; measurements: StudentEvaluation[] } | null>(null);
  useEffect(() => {
    let pending: AbortController | null = null;
    const load = async () => {
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      try {
        const response = await fetch(`/api/evaluaciones?studentId=${encodeURIComponent(studentId)}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const measurements: StudentEvaluation[] = await response.json();
        if (!controller.signal.aborted) setResult({ studentId, measurements });
      } catch { /* Keep the last available value if the connection is interrupted. */ }
    };
    const visible = () => { if (document.visibilityState === "visible") void load(); };
    void load();
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      pending?.abort();
      window.removeEventListener("focus", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [studentId, revision]);
  return <>{formatStudentWeight(latestStudentWeight(studentId, result?.studentId === studentId ? result.measurements : [], profileWeight))}</>;
}
