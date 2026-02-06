# <img src="src/assets/icons/icon.svg" width="30" height="30" style="vertical-align: bottom;"> Cookie Oven

CookieOven allows you to view, manage, and decrypt cookies directly from your browser toolbar. It is designed with a modern interface and specific support for JWE (JSON Web Encryption) token decryption.

## Features

-   **Modern UI**: Clean, responsive interface with a beautiful Green/Emerald theme.
-   **Cookie Management**: View, search, copy, and delete cookies for the current tab.
-   **JWE Decryption**:
    -   Auto-detects JWE tokens.
    -   Supports per-cookie custom secret keys.
    -   Displays decrypted payload in a formatted, scrollable view.
-   **Base64 Support**: Toggle Base64 key processing for keys that need decoding/resizing.

## Installation

You need [npm](https://docs.npmjs.com/) installed. Then you can build the project locally using:

```bash
git clone https://github.com/pawel002/cookie-oven
cd cookie-oven
npm install
npm run build
```

Load into Chrome:
-   Open Chrome and navigate to `chrome://extensions/`.
-   Enable **Developer mode** (top right).
-   Click **Load unpacked**.
-   Select the `dist` directory created by the build step.

## Usage

1.  Click the CookieOven icon in your toolbar.
2.  **View Cookies**: See all cookies for the active tab.
3.  **Decrypt**:
    -   Find a cookie marked with the **TOKEN** badge.
    -   Expand the card.
    -   Enter your shared secret key in the "Custom key" field.
    -   Click **Decrypt**.
    -   Use the **Maximize** button (top-right of the text area) to view full JSON content.

## Tech Stack

-   **Vite**: Build tool and bundler.
-   **Vanilla JS / CSS**: Lightweight core logic and styling.
-   **Jose**: Robust JWT/JWE implementation.
