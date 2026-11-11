"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-ink-muted">The page couldn&apos;t be loaded. Your data is safe; try again.</p>
      <Button className="mt-6" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
