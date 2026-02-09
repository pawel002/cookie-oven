import { CookieService } from "../services/cookieService.js";
import { CryptoService } from "../services/cryptoService.js";

export class UI {
  constructor() {
    this.listContainer = document.getElementById("cookie-list");
    this.searchInput = document.getElementById("search-input");
    this.cookies = [];

    this.initEventListeners();
    this.restoreState();
  }

  initEventListeners() {
    if (this.searchInput) {
      this.searchInput.addEventListener("input", (e) => {
        localStorage.setItem("ui_search_term", e.target.value);
      });
    }

    this.listContainer.addEventListener("scroll", () => {
      localStorage.setItem("ui_scroll_top", this.listContainer.scrollTop);
    });
  }

  restoreState() {
    const savedSearch = localStorage.getItem("ui_search_term");
    if (savedSearch && this.searchInput) {
      this.searchInput.value = savedSearch;
      setTimeout(() => {
        this.searchInput.dispatchEvent(new Event("input"));
      }, 50);
    }

    const savedScroll = localStorage.getItem("ui_scroll_top");
    if (savedScroll) {
      this.pendingScrollTop = parseInt(savedScroll, 10);
    }
  }

  setCookies(cookies) {
    this.cookies = cookies;
  }

  render(cookiesToRender = this.cookies) {
    this.listContainer.innerHTML = "";

    if (cookiesToRender.length === 0) {
      this.listContainer.innerHTML = `
        <div class="empty-state">
          <p>No cookies found matching your criteria.</p>
        </div>`;
      return;
    }

    cookiesToRender.forEach((cookie) => this.createCard(cookie));

    if (this.pendingScrollTop) {
      requestAnimationFrame(() => {
        this.listContainer.scrollTop = this.pendingScrollTop;
        this.pendingScrollTop = null; // Clear it
      });
    }
  }

  createCard(cookie) {
    const card = document.createElement("div");
    card.className = "cookie-card";

    const isToken = cookie.value.includes(".") && cookie.value.length > 20;
    const badgeHtml = isToken ? '<span class="chip jwe">Token</span>' : "";

    const httpOnlyHtml = cookie.httpOnly
      ? '<span class="chip http">HttpOnly</span>'
      : "";

    const cookieKeyId = `key_${cookie.domain}_${cookie.name}`;
    const savedLocalKey = localStorage.getItem(cookieKeyId) || "";

    const cookieB64Id = `b64_${cookie.domain}_${cookie.name}`;
    const savedB64Mode = localStorage.getItem(cookieB64Id) === "true";

    card.innerHTML = `
      <div class="card-summary">
        <div class="card-info">
          <span class="cookie-domain">${cookie.domain}</span>
          <span class="cookie-name">${cookie.name} ${badgeHtml} ${httpOnlyHtml}</span>
        </div>
        <svg class="expand-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </div>
      <div class="card-details">
        <div class="value-preview">${cookie.value}</div>
        
        ${
          isToken
            ? `
          <div class="crypto-zone">
            <div class="key-input-wrapper">
                <input type="password" class="local-key-input" placeholder="Custom key" value="${savedLocalKey}">
                <button class="btn-b64 ${savedB64Mode ? "active" : ""}" title="Treat key as Base64 and pad to 64 bytes">B64</button>
                <button class="btn btn-primary btn-process">Decrypt</button>
            </div>
            <div class="decrypted-view-container">
                <div class="decrypted-view hidden"></div>
            </div>
          </div>
        `
            : ""
        }

        <div class="btn-group">
          <button class="btn btn-secondary btn-copy">Copy Value</button>
          <button class="btn btn-danger btn-delete">Delete Cookie</button>
        </div>
      </div>
    `;

    card.querySelector(".card-summary").onclick = () => {
      card.classList.toggle("expanded");
    };

    const copyBtn = card.querySelector(".btn-copy");
    if (copyBtn) {
      copyBtn.onclick = (e) => {
        e.stopPropagation();
        navigator.clipboard
          .writeText(cookie.value)
          .then(() => {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = "Copied!";
            setTimeout(() => {
              copyBtn.textContent = originalText;
            }, 1500);
          })
          .catch((err) => {
            console.error("Failed to copy: ", err);
            copyBtn.textContent = "Error";
          });
      };
    }

    const delBtn = card.querySelector(".btn-delete");
    if (delBtn) {
      delBtn.onclick = (e) => {
        e.stopPropagation();
        if (confirm(`Delete cookie ${cookie.name}?`)) {
          CookieService.delete(cookie).then(() => {
            localStorage.removeItem(cookieKeyId);
            localStorage.removeItem(cookieB64Id);
            this.cookies = this.cookies.filter((c) => c !== cookie);
            card.remove();
          });
        }
      };
    }

    if (isToken) {
      const processBtn = card.querySelector(".btn-process");
      const output = card.querySelector(".decrypted-view");
      const localInput = card.querySelector(".local-key-input");
      const b64Btn = card.querySelector(".btn-b64");

      let isB64 = savedB64Mode;

      b64Btn.onclick = (e) => {
        e.stopPropagation();
        isB64 = !isB64;
        localStorage.setItem(cookieB64Id, isB64);
        b64Btn.classList.toggle("active", isB64);
      };

      processBtn.onclick = async (e) => {
        e.stopPropagation();

        const customKey = localInput.value;
        if (customKey) {
          localStorage.setItem(cookieKeyId, customKey);
        } else {
          localStorage.removeItem(cookieKeyId);
        }

        let result = CryptoService.decodeJWT(cookie.value);
        let method = "Decoded JWT";

        const parts = cookie.value.split(".").length;

        const header = CryptoService.getTokenHeader(cookie.value);
        let headerInfo = "";
        if (header) {
          headerInfo = `Header: ${JSON.stringify(header)}\n-------------------\n`;
        }

        if (parts === 5) {
          const key = customKey;
          const res = await CryptoService.decryptJWE(cookie.value, key, isB64);
          result = res.output;
          if (res.debug) headerInfo += res.debug + "-------------------\n";

          method = "Decrypted JWE" + (isB64 ? " (B64 Mode)" : "");
        } else if (!result && parts !== 3) {
          result = "Not a recognized JWT/JWE format.";
          method = "Error";
        }

        const fullContent = `[${method}]\n${headerInfo}${result || "Could not parse token."}`;
        output.textContent = fullContent;
        output.classList.remove("hidden");

        if (!card.querySelector(".btn-maximize")) {
          const maxBtn = document.createElement("button");
          maxBtn.className = "btn-maximize";
          maxBtn.title = "Maximize View";
          maxBtn.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>';

          maxBtn.onclick = (ev) => {
            ev.stopPropagation();
            this.showFullscreen(fullContent);
          };

          const container = card.querySelector(".decrypted-view-container");
          container.appendChild(maxBtn);
        }
      };
    }

    this.listContainer.appendChild(card);
  }

  showFullscreen(content) {
    let modal = document.getElementById("fullscreen-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "fullscreen-modal";
      modal.className = "fullscreen-modal hidden";
      modal.innerHTML = `
            <div class="fullscreen-header">
                <button class="fullscreen-close" title="Close">&times;</button>
            </div>
            <div class="fullscreen-content"></div>
          `;
      document.body.appendChild(modal);

      modal.querySelector(".fullscreen-close").onclick = () => {
        modal.classList.add("hidden");
      };
    }

    const contentArea = modal.querySelector(".fullscreen-content");
    contentArea.textContent = content;
    modal.classList.remove("hidden");
  }
}
