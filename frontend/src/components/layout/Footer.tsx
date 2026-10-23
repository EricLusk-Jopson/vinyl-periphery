import React from "react";

const links = [
  { label: "Get in touch", href: "https://linktr.ee/ericluskjopson" },
  {
    label: "Report an issue",
    href: "https://github.com/EricLusk-Jopson/vinyl-periphery-feedback/issues/",
  },
  {
    label: "Request a feature",
    href: "https://github.com/EricLusk-Jopson/vinyl-periphery-feedback/discussions",
  },
  { label: "Buy me a coffee", href: "https://www.buymeacoffee.com/eluskjopsoq" },
];

export const Footer: React.FC = () => (
  <footer className="mt-auto border-t">
    <div className="mx-auto flex max-w-[1280px] flex-col gap-5 px-4 py-7 md:flex-row md:flex-wrap md:items-center md:justify-between md:px-6">
      <nav aria-label="Footer">
        <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring md:min-h-0"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <p className="max-w-[520px] text-[13px] leading-relaxed text-faint">
        Data from Discogs. Vinyl Periphery is not affiliated with, sponsored
        or endorsed by Discogs. Discogs is a trademark of Zink Media, LLC.
      </p>
    </div>
  </footer>
);
