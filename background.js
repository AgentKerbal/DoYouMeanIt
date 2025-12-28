let blockedSites = [];
let unlockedSites = new Set();
let lockTimers = {};
// New: specific timestamps to protect sites that are currently loading
let justUnlocked = {};

// --- SETUP ---
browser.storage.local.get("blockedSites").then((res) => {
    blockedSites = res.blockedSites || [];
});

browser.storage.onChanged.addListener((changes) => {
    if (changes.blockedSites) {
        blockedSites = changes.blockedSites.newValue;
    }
});

browser.runtime.onMessage.addListener((message) => {
    if (message.type === "UNLOCK_SITE") {
        const hostname = new URL(message.url).hostname;
        unlockedSites.add(hostname);

        // 1. Mark this site as "Just Unlocked" for 15 seconds
        // This prevents the timer from starting while the page loads
        justUnlocked[hostname] = Date.now();

        // 2. Kill any existing timers
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
        // const isBlocked = blockedSites.some(site => hostname.includes(site));

        const isBlocked = blockedSites.some(site => {
            // 1. Exact match (e.g. "twitter.com" == "twitter.com")
            if (hostname === site) return true;

            // 2. Subdomain match (e.g. "mobile.twitter.com" ends with ".twitter.com")
            if (hostname.endsWith("." + site)) return true;

            // 3. Simple Keyword match (only if user entered a word like "twitter" without .com)
            // We check if the hostname has that word surrounded by dots or start/end
            if (!site.includes(".") && hostname.includes(site)) {
                // This is a heuristic. If you block "news", it blocks "news.google.com" but not "newspaper.com"
                const parts = hostname.split('.');
                return parts.includes(site);
            }

            return false;
        });

        if (isBlocked) {
            // If it's NOT in our safe list, block it.
            if (!unlockedSites.has(hostname)) {
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

    console.log(`Starting 5s countdown for ${hostname}`);
    lockTimers[hostname] = setTimeout(() => {
        unlockedSites.delete(hostname);
        delete lockTimers[hostname];
        delete justUnlocked[hostname]; // Cleanup
        console.log(`LOCKED ${hostname}`);
    }, 5000);
}

function cancelLockTimer(hostname) {
    if (lockTimers[hostname]) {
        clearTimeout(lockTimers[hostname]);
        delete lockTimers[hostname];
        console.log(`Cancelled timer for ${hostname}`);
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

        // Is it open in a tab?
        const isSiteOpen = [...openHostnames].some(h => h.includes(site));

        // Is it "Just Unlocked"? (Protected for 15 seconds)
        const isJustUnlocked = justUnlocked[site] && (Date.now() - justUnlocked[site] < 1000);

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
