import { CookieService } from "../services/cookieService.js";
import { CryptoService } from "../services/cryptoService.js";

export class UI {
  constructor() {
    this.listContainer = document.getElementById("cookie-list");
    this.searchInput = document.getElementById("search-input");
    this.cookies = [];
    this.pendingScrollTop = null;

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
      // Dispatch input event to trigger any external filtering listeners
      this.searchInput.dispatchEvent(new Event("input"));
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

    if (!cookiesToRender || cookiesToRender.length === 0) {
      this.listContainer.innerHTML = `
        <div class="empty-state">
          <p>No cookies found matching your criteria.</p>
        </div>`;
      return;
    }

    // Use a fragment to minimize reflows
    const fragment = document.createDocumentFragment();
    cookiesToRender.forEach((cookie) => {
      fragment.appendChild(this.createCard(cookie));
    });
    this.listContainer.appendChild(fragment);

    // Restore scroll position if needed
    if (this.pendingScrollTop !== null) {
      requestAnimationFrame(() => {
        this.listContainer.scrollTop = this.pendingScrollTop;
        this.pendingScrollTop = null;
      });
    }
  }

  createCard(cookie) {
    const card = document.createElement("div");
    card.className = "cookie-card";

    // --- 1. Identify Cookie Type ---
    const isToken = cookie.value.includes(".") && cookie.value.length > 20;

    // --- 2. Load Saved State ---
    const cookieKeyId = `key_${cookie.domain}_${cookie.name}`;
    const cookieB64Id = `b64_${cookie.domain}_${cookie.name}`;

    const savedLocalKey = localStorage.getItem(cookieKeyId) || "";
    const savedB64Mode = localStorage.getItem(cookieB64Id) === "true";

    // --- 3. Build HTML Structure ---
    const badgeHtml = isToken ? '<span class="chip jwe">Token</span>' : "";
    const httpOnlyHtml = cookie.httpOnly
      ? '<span class="chip http">HttpOnly</span>'
      : "";

    card.innerHTML = `
      <div class="card-summary">
        <div class="card-info">
          <span class="cookie-domain">${cookie.domain}</span>
          <span class="cookie-name">${cookie.name} ${badgeHtml} ${httpOnlyHtml}</span>
        </div>
        <svg class="expand-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </div>
      
      <div class="card-details">
        <div class="value-preview" title="${cookie.value}">${cookie.value}</div>
        
        ${isToken ? this.generateCryptoZone(savedLocalKey, savedB64Mode) : ""}

        <div class="btn-group">
          <button class="btn btn-secondary btn-copy">Copy Value</button>
          <button class="btn btn-danger btn-delete">Delete Cookie</button>
        </div>
      </div>
    `;

    // --- 4. Attach Event Listeners ---
    this.attachCardEvents(card, cookie, isToken, cookieKeyId, cookieB64Id);

    return card;
  }

  generateCryptoZone(savedKey, isB64) {
    return `
      <div class="crypto-zone">
        <div class="key-input-wrapper">
            <input type="password" class="local-key-input" placeholder="Custom secret key" value="${savedKey}">
            <button class="btn-b64 ${isB64 ? "active" : ""}" title="Treat key as Base64">B64</button>
            <button class="btn btn-primary btn-process">Decrypt</button>
        </div>
        <div class="decrypted-view-container hidden">
            </div>
      </div>
    `;
  }

  attachCardEvents(card, cookie, isToken, keyId, b64Id) {
    // Expand/Collapse
    card.querySelector(".card-summary").onclick = () => {
      card.classList.toggle("expanded");
    };

    // Copy Button
    const copyBtn = card.querySelector(".btn-copy");
    copyBtn.onclick = (e) => this.handleCopy(e, copyBtn, cookie.value);

    // Delete Button
    const delBtn = card.querySelector(".btn-delete");
    delBtn.onclick = (e) => this.handleDelete(e, card, cookie, keyId, b64Id);

    // Crypto Logic (Only if it's a token)
    if (isToken) {
      const processBtn = card.querySelector(".btn-process");
      const b64Btn = card.querySelector(".btn-b64");
      const localInput = card.querySelector(".local-key-input");
      const container = card.querySelector(".decrypted-view-container");

      // Toggle B64 Mode
      b64Btn.onclick = (e) => {
        e.stopPropagation();
        const isActive = b64Btn.classList.toggle("active");
        localStorage.setItem(b64Id, isActive);
      };

      // Decrypt Action
      processBtn.onclick = async (e) => {
        e.stopPropagation();
        const isB64 = b64Btn.classList.contains("active");
        const customKey = localInput.value;

        // Save key preference
        if (customKey) localStorage.setItem(keyId, customKey);
        else localStorage.removeItem(keyId);

        // UI Loading State
        processBtn.textContent = "Processing...";
        processBtn.disabled = true;

        await this.handleDecryption(cookie.value, customKey, isB64, container);

        // Restore UI State
        processBtn.textContent = "Decrypt";
        processBtn.disabled = false;
      };
    }
  }

  // --- Logic Helpers ---

  async handleDecryption(token, key, isB64, container) {
    const parts = token.split(".").length;
    let header = CryptoService.getTokenHeader(token);
    let debugLog = "";
    let result = "";
    let method = "";
    let isError = false;

    // 1. Attempt Decryption/Decoding
    if (parts === 5) {
      // JWE
      const res = await CryptoService.decryptJWE(token, key, isB64);
      result = res.output;
      debugLog = res.debug;
      method = "JWE Decryption";
      // Heuristic check for error message from service
      if (result.startsWith("Error:")) isError = true;
    } else {
      // JWS or plain
      result = CryptoService.decodeJWT(token);
      method = "JWT Decode";
      if (!result) {
        result = "Unable to parse token format.";
        isError = true;
      }
    }

    // 2. Build the UI HTML
    // We use <details> for debug logs so they are hidden by default but accessible.
    const headerHtml = header
      ? `<div class="token-header-badge">Algo: <strong>${header.alg}</strong> | Enc: <strong>${header.enc || "N/A"}</strong></div>`
      : "";

    const debugHtml = debugLog
      ? `<details class="debug-details">
             <summary>Debug Logs</summary>
             <pre class="debug-log">${debugLog}</pre>
           </details>`
      : "";

    const contentClass = isError ? "text-error" : "text-json";

    container.innerHTML = `
      <div class="result-header">
        <span class="method-badge">${method}</span>
        ${headerHtml}
        <button class="btn-maximize" title="Fullscreen">
           <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
        </button>
      </div>
      ${debugHtml}
      <pre class="decrypted-content ${contentClass}">${result}</pre>
    `;

    container.classList.remove("hidden");

    // Attach maximize listener newly created
    container.querySelector(".btn-maximize").onclick = (e) => {
      e.stopPropagation();
      this.showFullscreen(result, debugLog, header); // Pass raw data for clean fullscreen
    };
  }

  handleCopy(e, btn, text) {
    e.stopPropagation();
    navigator.clipboard
      .writeText(text)
      .then(() => {
        const original = btn.textContent;
        btn.textContent = "Copied!";
        setTimeout(() => (btn.textContent = original), 1500);
      })
      .catch((err) => console.error("Copy failed", err));
  }

  handleDelete(e, card, cookie, keyId, b64Id) {
    e.stopPropagation();
    if (confirm(`Delete cookie ${cookie.name}?`)) {
      CookieService.delete(cookie).then(() => {
        localStorage.removeItem(keyId);
        localStorage.removeItem(b64Id);

        // Remove from local state and DOM
        this.cookies = this.cookies.filter((c) => c !== cookie);
        card.remove();

        // Check if list is now empty
        if (this.cookies.length === 0) this.render();
      });
    }
  }

  showFullscreen(content, debug, header) {
    let modal = document.getElementById("fullscreen-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "fullscreen-modal";
      modal.className = "fullscreen-modal hidden";
      modal.innerHTML = `
            <div class="fullscreen-header">
                <span class="fs-title">Token Inspector</span>
                <button class="fullscreen-close">&times;</button>
            </div>
            <div class="fullscreen-body">
                <div class="fs-meta"></div>
                <pre class="fs-content"></pre>
            </div>
          `;
      document.body.appendChild(modal);
      modal.querySelector(".fullscreen-close").onclick = () =>
        modal.classList.add("hidden");
    }

    // Populate Modal
    const metaDiv = modal.querySelector(".fs-meta");
    const contentPre = modal.querySelector(".fs-content");

    metaDiv.innerHTML = "";
    if (header)
      metaDiv.innerHTML += `<div><strong>Header:</strong> ${JSON.stringify(header)}</div>`;
    if (debug)
      metaDiv.innerHTML += `<details><summary>Debug Log</summary><pre>${debug}</pre></details>`;

    contentPre.textContent = content;
    modal.classList.remove("hidden");
  }
}
