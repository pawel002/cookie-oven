import { CookieService } from "./services/cookieService.js";
import { UI } from "./ui/ui.js";

// CSS import for Vite to bundle
import "./css/style.css";

const ui = new UI();
let allCookies = [];

async function init() {
  allCookies = await CookieService.getAll();
  ui.setCookies(allCookies);
  ui.render();
}

// Global search handling
const searchInput = document.getElementById("search-input");
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
