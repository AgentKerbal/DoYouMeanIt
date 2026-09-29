let blockedSites = [];
let unlockedSites = new Set();
let lockTimers = {};
// Timestamps (ms) marking when a hostname was unlocked, to protect it while the target page loads
let justUnlocked = {};

const UNLOCK_GRACE_MS = 15000;
const RELOCK_DELAY_MS = 5000;

// --- MATCHING HELPERS (single source of truth) ---
function matchesEntry(hostname, site) {
    // 1. Exact match (e.g. "twitter.com" == "twitter.com")
    if (hostname === site) return true;

    // 2. Subdomain match (e.g. "mobile.twitter.com" ends with ".twitter.com")
    if (hostname.endsWith("." + site)) return true;

    // 3. Simple keyword match (only if user entered a word like "twitter" without a dot)
    if (!site.includes(".") && hostname.includes(site)) {
        const parts = hostname.split('.');
        return parts.includes(site);
    }

    return false;
}

function isBlockedHost(hostname) {
    return blockedSites.some(site => matchesEntry(hostname, site));
}

// An unlocked parent covers its subdomains (unlock twitter.com -> mobile.twitter.com allowed),
// but an unlocked child does NOT cover its parent.
function isUnlockedHost(hostname) {
    for (const unlocked of unlockedSites) {
        if (hostname === unlocked) return true;
        if (hostname.endsWith("." + unlocked)) return true;
    }
    return false;
}

// --- SETUP ---
browser.storage.local.get("blockedSites").then((res) => {
    blockedSites = res.blockedSites || [];
});

browser.storage.onChanged.addListener((changes) => {
    if (changes.blockedSites) {
        blockedSites = changes.blockedSites.newValue || [];
    }
});

browser.runtime.onMessage.addListener((message) => {
    if (message.type === "UNLOCK_SITE") {
        if (!message.url) return;
        let hostname;
        try {
            hostname = new URL(message.url).hostname;
        } catch (e) {
            return;
        }
        if (!hostname) return;
        unlockedSites.add(hostname);

        // Mark this site as "Just Unlocked" so the watcher doesn't
        // start the re-lock timer while the target page is still loading.
        justUnlocked[hostname] = Date.now();

        // Kill any existing timers
        if (lockTimers[hostname]) {
            clearTimeout(lockTimers[hostname]);
            delete lockTimers[hostname];
        }
    }
});

// --- THE BOUNCER ---
browser.webRequest.onBeforeRequest.addListener(
    async (details) => {
        const settings = await browser.storage.local.get("extensionEnabled");
        if (settings.extensionEnabled === false) return;

        if (!details.url.startsWith("http")) return;
        if (details.url.includes("challenge.html")) return;

        const url = new URL(details.url);
        const hostname = url.hostname;

        if (isBlockedHost(hostname)) {
            // If it's NOT in our safe list, block it.
            if (!isUnlockedHost(hostname)) {
                return {
                    redirectUrl: browser.runtime.getURL(`challenge.html?target=${encodeURIComponent(details.url)}`)
                };
            }
        }
    },
    {
        urls: ["<all_urls>"],
        types: ["main_frame"]
    },
    ["blocking"]
);

// --- TIMER LOGIC ---

function startLockTimer(hostname) {
    if (lockTimers[hostname]) return; // Timer already running

    lockTimers[hostname] = setTimeout(() => {
        unlockedSites.delete(hostname);
        delete lockTimers[hostname];
        delete justUnlocked[hostname]; // Cleanup
    }, RELOCK_DELAY_MS);
}

function cancelLockTimer(hostname) {
    if (lockTimers[hostname]) {
        clearTimeout(lockTimers[hostname]);
        delete lockTimers[hostname];
    }
}

// --- THE WATCHER ---
async function updateLocks() {
    if (unlockedSites.size === 0) return;

    // 1. Get all currently open tabs
    const tabs = await browser.tabs.query({});
    const openHostnames = new Set(tabs.map(t => {
        try { return new URL(t.url).hostname; } catch(e) { return ""; }
    }));

    // 2. Check every unlocked site
    unlockedSites.forEach(site => {

        // Is it (or one of its subdomains) open in a tab?
        // Parent unlock covers children, so mobile.twitter.com counts as twitter.com open.
        let isSiteOpen = false;
        for (const h of openHostnames) {
            if (!h) continue;
            if (h === site || h.endsWith("." + site)) {
                isSiteOpen = true;
                break;
            }
        }

        // Is it "Just Unlocked"? (Protected while the target page loads)
        const isJustUnlocked = justUnlocked[site] && (Date.now() - justUnlocked[site] < UNLOCK_GRACE_MS);

        if (isSiteOpen || isJustUnlocked) {
            // Safe! Cancel any pending locks
            if (lockTimers[site]) {
                cancelLockTimer(site);
            }
        } else {
            // Not open AND not loading -> Start the Countdown
            if (!lockTimers[site]) {
                startLockTimer(site);
            }
        }
    });
}

// Listen for tab events
browser.tabs.onRemoved.addListener(() => setTimeout(updateLocks, 200));
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' || changeInfo.url) {
        updateLocks();
    }
});
