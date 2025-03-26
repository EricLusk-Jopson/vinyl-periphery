import React from "react";

export const Footer: React.FC = () => (
  <footer className="mt-auto px-4 sm:px-6 py-2 flex flex-col gap-6 text-text-secondary text-center text-xs">
    <ul className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 mx-auto text-sm">
      <li className="w-full sm:w-auto">
        <a
          href="https://linktr.ee/ericluskjopson"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-primary-main inline-block w-full py-2 sm:py-0"
        >
          Get In Touch
        </a>
      </li>
      <li className="w-full sm:w-auto">
        <a
          href="https://github.com/EricLusk-Jopson/vinyl-periphery-feedback/issues/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-primary-main inline-block w-full py-2 sm:py-0"
        >
          Report an Issue
        </a>
      </li>
      <li className="w-full sm:w-auto">
        <a
          href="https://github.com/EricLusk-Jopson/vinyl-periphery-feedback/discussions"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-primary-main inline-block w-full py-2 sm:py-0"
        >
          Feature Requests
        </a>
      </li>
      <li className="w-full sm:w-auto flex justify-center pt-2 sm:pt-0">
        <a
          href="https://www.buymeacoffee.com/eluskjopsoq"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src="/bmc-button.svg"
            alt="Buy me a coffee"
            className="h-8 w-auto hover:opacity-90 transition-opacity"
          />
        </a>
      </li>
    </ul>
    <p className="text-center text-xs">
      This application uses Discogs' API but is not affiliated with, sponsored
      or endorsed by Discogs. 'Discogs' is a trademark of Zink Media, LLC.
      <br />
      Limited to 25 requests/minute per user. This is a limitation by the
      Discogs API. Hopefully this changes
    </p>
  </footer>
);
