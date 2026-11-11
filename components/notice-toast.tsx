"use client";

import { CheckCircle2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { NOTICES, NOTICE_PARAM, isNoticeCode } from "@/lib/notices";

/** Shows the whitelisted ?notice= message once, then strips it from the URL. */
export function NoticeToast() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const code = searchParams.get(NOTICE_PARAM);
  const [message, setMessage] = useState<string | null>(null);
  const [lastCode, setLastCode] = useState<string | null>(null);

  // Adjust state while rendering when the notice param changes (no effect round-trip).
  if (code !== lastCode) {
    setLastCode(code);
    if (isNoticeCode(code)) setMessage(NOTICES[code]);
  }

  useEffect(() => {
    if (!isNoticeCode(code)) return;
    const rest = new URLSearchParams(searchParams.toString());
    rest.delete(NOTICE_PARAM);
    const search = rest.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }, [code, pathname, router, searchParams]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 5000);
    return () => window.clearTimeout(timer);
  }, [message]);

  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      {message && (
        <div className="pointer-events-auto flex items-center gap-3 rounded-panel bg-ink py-2.5 pl-4 pr-2 text-sm text-white shadow-lg">
          <CheckCircle2 aria-hidden className="size-4 text-[#9fd3b4]" />
          <span>{message}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="rounded-control p-1 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <X aria-hidden className="size-4" />
            <span className="sr-only">Dismiss</span>
          </button>
        </div>
      )}
    </div>
  );
}
