export class CookieService {
  static async getAll() {
    return new Promise((resolve) => {
      chrome.cookies.getAll({}, (cookies) => {
        resolve(cookies.sort((a, b) => a.domain.localeCompare(b.domain)));
      });
    });
  }

  static async delete(cookie) {
    const protocol = cookie.secure ? "https://" : "http://";
    const domain = cookie.domain.startsWith(".")
      ? cookie.domain.substring(1)
      : cookie.domain;
    const url = protocol + domain + cookie.path;

    return new Promise((resolve) => {
      chrome.cookies.remove({ url: url, name: cookie.name }, resolve);
    });
  }
}
