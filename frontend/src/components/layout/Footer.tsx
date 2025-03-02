export const Footer: React.FC = () => (
  <footer className="mt-auto px-6 py-2 flex flex-col gap-2 text-text-secondary text-center text-xs">
    <div className="text-center"></div>
    <ul className="flex items-center gap-6 mx-auto text-sm">
      <li>
        <a href="/contact" className="hover:text-accent-red">
          Contact Form
        </a>
      </li>
      <li>
        <a
          href="https://github.com/EricLusk-Jopson/vinyl-periphery-feedback/issues/"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-accent-red"
        >
          Report an Issue
        </a>
      </li>
      <li>
        <a
          href="https://github.com/EricLusk-Jopson/vinyl-periphery-feedback/discussions"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-red-700"
        >
          Feature Requests
        </a>
      </li>
      <li>
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
