const input = document.getElementById("siteInput");
const addBtn = document.getElementById("addBtn");
const list = document.getElementById("siteList");
const toggle = document.getElementById("myonoffswitch");

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
  const site = input.value.trim();
  if (!site) return;
  browser.storage.local.get("blockedSites").then(res => {
    const sites = res.blockedSites || [];
    if (!sites.includes(site)) {
      sites.push(site);
      browser.storage.local.set({ blockedSites: sites });
      input.value = "";
      renderList(sites);
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
loadSites();
