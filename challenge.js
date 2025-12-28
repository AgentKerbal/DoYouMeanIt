document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const targetUrl = params.get("target");

    // 1. Generate Hash
    const array = new Uint8Array(8);
    window.crypto.getRandomValues(array);
    const randomCode = Array.from(array)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    // 2. Draw it on Canvas (The Mitigation)
    const canvas = document.getElementById("codeCanvas");
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Text Style
    ctx.font = "48px Courier New";
    ctx.fillStyle = "#00FF41"; // Matrix Green
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    // Add some noise (lines) to confuse bots/eyes
    /*
    for (let i = 0; i < 7; i++) {
        ctx.strokeStyle = `rgba(0, 255, 65, ${Math.random() * 0.5})`;
        ctx.lineWidth = Math.random() * 2;
        ctx.beginPath();
        ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
        ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
        ctx.stroke();
    }
    */

    // Draw the text
    ctx.fillText(randomCode, canvas.width / 2, canvas.height / 2);

    // 3. Listen for Input
    const input = document.getElementById("codeInput");
    input.addEventListener("input", () => {
        if (input.value.trim().toLowerCase() === randomCode) {
            browser.runtime.sendMessage({ type: "UNLOCK_SITE", url: targetUrl });
            window.location.href = targetUrl;
        }
    });
});
