import Link from "next/link";

import { copy } from "@/lib/copy";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/tools", label: "Tools" },
      { href: "/pricing", label: "Pricing" },
      { href: "/api", label: "API" },
      { href: "/changelog", label: "Changelog" },
    ],
  },
  {
    title: "Learn",
    links: [
      { href: "/help", label: "Help center" },
      { href: "/data-methodology", label: "Data methodology" },
      { href: "/faq", label: "FAQ" },
    ],
  },
  {
    title: "Company",
    links: [{ href: "/privacy", label: "Privacy" }, { href: "/terms", label: "Terms" }],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-2">
            <p className="font-semibold text-primary">{copy.brand.name.toUpperCase()}</p>
            <p className="mt-2 max-w-xs text-sm text-muted">{copy.brand.descriptor}</p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-sm font-semibold text-primary">{col.title}</p>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-secondary hover:text-primary">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-10 text-xs text-muted">
          © {new Date().getFullYear()} {copy.brand.name}. Public data explorer for publicly
          accessible profile information.
        </p>
      </div>
    </footer>
  );
}
