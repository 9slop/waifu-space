// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en" data-theme="sakura">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>WaifuSpace — Your Personal Companion & Calendar</title>
          <meta
            name="description"
            content="A customizable anime companion dashboard featuring distinct personality archetypes, full Google Calendar-style schedule integration, Japanese aesthetic wallpapers, and custom themes."
          />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
          <link
            href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap"
            rel="stylesheet"
          />
          <link
            rel="icon"
            href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Cpath fill='%23ff6584' d='M245.83 121.63a15.53 15.53 0 0 0-9.52-7.33a73.5 73.5 0 0 0-22.17-2.22c4-19.85 1-35.55-2.06-44.86a16.15 16.15 0 0 0-18.79-10.88a85.5 85.5 0 0 0-28.55 12.12a94.6 94.6 0 0 0-27.11-33.25a16.05 16.05 0 0 0-19.26 0a94.5 94.5 0 0 0-27.11 33.25a85.5 85.5 0 0 0-28.55-12.12a16.15 16.15 0 0 0-18.79 10.88c-3 9.31-6 25-2.06 44.86a73.5 73.5 0 0 0-22.17 2.22a15.53 15.53 0 0 0-9.52 7.33a16 16 0 0 0-1.6 12.27c3.39 12.57 13.8 36.48 45.33 55.32S113.13 208 128.05 208s42.67 0 74-18.78c31.53-18.84 41.94-42.75 45.33-55.32a16 16 0 0 0-1.55-12.27M59.14 72.14a.2.2 0 0 1 .23-.15a70.4 70.4 0 0 1 25.81 11.67A118.7 118.7 0 0 0 80 119.17c0 18.74 3.77 34 9.11 46.28A123.6 123.6 0 0 1 69.57 140C51.55 108.62 55.3 84 59.14 72.14m3 103.35C35.47 159.57 26.82 140.05 24 129.7a59.8 59.8 0 0 1 22.5-1.17a129 129 0 0 0 9.15 19.41a142.3 142.3 0 0 0 34 39.56a115 115 0 0 1-27.55-12.01ZM128 190.4c-9.33-6.94-32-28.23-32-71.23C96 76.7 118.38 55.24 128 48c9.62 7.26 32 28.72 32 71.19c0 42.98-22.67 64.27-32 71.21m42.82-106.74A70.4 70.4 0 0 1 196.63 72a.2.2 0 0 1 .23.15c3.84 11.85 7.59 36.47-10.43 67.85a123.3 123.3 0 0 1-19.54 25.48c5.34-12.26 9.11-27.54 9.11-46.28a118.7 118.7 0 0 0-5.18-35.54M232 129.72c-2.77 10.25-11.4 29.81-38.09 45.77a115 115 0 0 1-27.55 12a142.3 142.3 0 0 0 34-39.56a129 129 0 0 0 9.15-19.41a59.7 59.7 0 0 1 22.49 1.19Z'/%3E%3C/svg%3E"
          />
          {assets}
        </head>
        <body>
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
));
