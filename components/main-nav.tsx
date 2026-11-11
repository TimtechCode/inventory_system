"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/products", label: "Products" },
  { href: "/categories", label: "Categories" },
  { href: "/types", label: "Product types" },
] as const;

/** Highlights the current section. Render inside <Suspense> with <NavLinks pathname={null} /> as fallback. */
export function MainNav() {
  return <NavLinks pathname={usePathname()} />;
}

export function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Main">
      <ul className="flex gap-1">
        {LINKS.map((link) => {
          const active = pathname !== null && (pathname === link.href || pathname.startsWith(`${link.href}/`));
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-control px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-sunken hover:text-ink",
                  active && "bg-sage-soft text-sage-strong hover:bg-sage-soft hover:text-sage-strong",
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
