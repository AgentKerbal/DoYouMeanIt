document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const targetUrl = params.get("target");

    const input = document.getElementById("codeInput");

    // Guard: challenge page opened directly without a target (bookmark, manual navigation)
    if (!targetUrl) {
        const container = document.querySelector(".container");
        if (container) {
            const msg = document.createElement("p");
            msg.textContent = "No target website specified. Close this tab and visit a blocked site to get a code.";
            msg.style.color = "#ff6b6b";
            container.appendChild(msg);
        }
        if (input) input.disabled = true;
        return;
    }

    let targetHostname = "";
    try {
        targetHostname = new URL(targetUrl).hostname;
    } catch (e) {
        if (input) input.disabled = true;
        return;
    }
    if (!targetHostname) {
        if (input) input.disabled = true;
        return;
    }

    const targetLine = document.getElementById("targetLine");
    if (targetLine) {
        targetLine.innerHTML = "";
        targetLine.append("You tried to visit ");
        const strong = document.createElement("strong");
        strong.textContent = targetHostname;
        targetLine.appendChild(strong);
    }

    // 1. Generate Hash
    const array = new Uint8Array(8);
    window.crypto.getRandomValues(array);
    const randomCode = Array.from(array)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    // 2. Draw it on Canvas (unselectable, so it must be typed manually)
    const canvas = document.getElementById("codeCanvas");

    // HiDPI: render sharp on retina displays while keeping CSS size stable
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.width;
    const cssHeight = canvas.height;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    canvas.style.width = cssWidth + "px";
    canvas.style.height = cssHeight + "px";

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    // Text Style (40px: 16 hex chars fit comfortably in 480px)
    ctx.font = "40px 'Courier New', Courier, monospace";
    ctx.fillStyle = "#00FF41"; // Matrix Green
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    // Draw the text
    ctx.fillText(randomCode, cssWidth / 2, cssHeight / 2);

    // 3. Listen for Input
    input.focus();
    input.addEventListener("input", () => {
        if (input.value.trim().toLowerCase() === randomCode) {
            browser.runtime.sendMessage({ type: "UNLOCK_SITE", url: targetUrl });
            window.location.href = targetUrl;
        }
    });
});
