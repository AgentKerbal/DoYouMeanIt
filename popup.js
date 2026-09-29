const input = document.getElementById("siteInput");
const addBtn = document.getElementById("addBtn");
const list = document.getElementById("siteList");
const toggle = document.getElementById("myonoffswitch");

// Normalize user input to a bare hostname (or keyword):
// "https://WWW.X.com/path?q=1" -> "x.com", "Twitter" -> "twitter"
function normalizeSite(raw) {
  let s = raw.trim().toLowerCase();
  if (!s) return "";
  // Strip protocol
  s = s.replace(/^[a-z]+:\/\//, "");
  // Strip path / query / fragment
  s = s.split(/[/?#]/)[0];
  // Strip port
  s = s.split(":")[0];
  // Strip leading dots and trailing dots
  s = s.replace(/^\.+/, "").replace(/\.+$/, "");
  // Strip a single leading "www." so www.x.com and x.com map to the same entry
  s = s.replace(/^www\./, "");
  // Reject whitespace / empty
  if (!s || /\s/.test(s)) return "";
  return s;
}

// 1. Load the saved toggle state when popup opens
// Default to TRUE (checked) if it hasn't been saved yet
browser.storage.local.get("extensionEnabled").then(res => {
  // If 'extensionEnabled' is undefined, we assume it's true (ON)
  const isEnabled = res.extensionEnabled !== false;
  toggle.checked = isEnabled;
});

// 2. Save the state whenever you click the switch
toggle.addEventListener('change', () => {
  browser.storage.local.set({ extensionEnabled: toggle.checked });
});

// --------------------


function renderList(sites) {
  list.innerHTML = "";
  if (sites.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No sites blocked yet";
    list.appendChild(li);
    return;
  }
  sites.forEach(site => {
    const li = document.createElement("li");
    li.textContent = site;
    const removeBtn = document.createElement("span");
    removeBtn.textContent = "X";
    removeBtn.className = "remove";
    removeBtn.onclick = () => removeSite(site);
    li.appendChild(removeBtn);
    list.appendChild(li);
  });
}

function loadSites() {
  browser.storage.local.get("blockedSites").then(res => {
    renderList(res.blockedSites || []);
  });
}

function addSite() {
  const site = normalizeSite(input.value);
  if (!site) return;
  browser.storage.local.get("blockedSites").then(res => {
    const sites = res.blockedSites || [];
    if (!sites.includes(site)) {
      sites.push(site);
      browser.storage.local.set({ blockedSites: sites });
      input.value = "";
      renderList(sites);
    } else {
      input.value = "";
    }
  });
}

function removeSite(siteToRemove) {
  browser.storage.local.get("blockedSites").then(res => {
    const sites = res.blockedSites || [];
    const newSites = sites.filter(s => s !== siteToRemove);
    browser.storage.local.set({ blockedSites: newSites });
    renderList(newSites);
  });
}

addBtn.onclick = addSite;
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addSite();
});
loadSites();
