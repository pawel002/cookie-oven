import { CookieService } from "./services/cookieService.js";
import { UI } from "./ui/ui.js";

import "./css/style.css";

const ui = new UI();
let allCookies = [];

const searchInput = document.getElementById("search-input");

async function init() {
  allCookies = await CookieService.getAll();
  ui.setCookies(allCookies);

  // Trigger initial search if value restored
  if (searchInput && searchInput.value) {
    searchInput.dispatchEvent(new Event("input"));
  } else {
    ui.render();
  }
}

// Global seach handling
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allCookies.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.domain.toLowerCase().includes(term),
    );
    ui.render(filtered);
  });
}

init();
