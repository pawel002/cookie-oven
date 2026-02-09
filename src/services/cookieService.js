export class CookieService {
  /**
   * Retrieves all cookies and sorts them by domain.
   * @returns {Promise<chrome.cookies.Cookie[]>}
   */
  static async getAll() {
    try {
      const cookies = await chrome.cookies.getAll({});
      return cookies.sort((a, b) => a.domain.localeCompare(b.domain));
    } catch (error) {
      console.error("Failed to fetch cookies:", error);
      return [];
    }
  }

  /**
   * Deletes a specific cookie.
   * @param {chrome.cookies.Cookie} cookie
   * @returns {Promise<chrome.cookies.CookieChangeInfo | null>}
   */
  static async delete(cookie) {
    try {
      const url = this._getCookieUrl(cookie);
      return await chrome.cookies.remove({
        url: url,
        name: cookie.name,
        storeId: cookie.storeId,
      });
    } catch (error) {
      console.error(`Failed to delete cookie ${cookie.name}:`, error);
      return null;
    }
  }

  /**
   * Helper to reconstruct the URL from cookie data.
   * Required because chrome.cookies.remove needs a URL, not a domain.
   */
  static _getCookieUrl(cookie) {
    const rawDomain = cookie.domain;
    const cleanDomain = rawDomain.startsWith(".")
      ? rawDomain.substring(1)
      : rawDomain;

    const protocol = cookie.secure ? "https://" : "http://";
    return `${protocol}${cleanDomain}${cookie.path}`;
  }
}
