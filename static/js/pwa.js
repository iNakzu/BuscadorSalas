let deferredPwaInstallPrompt = null;

function pwaInstalled() {
    return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPwaInstallPrompt = event;
    const button = document.getElementById('pwa-install-btn');
    if (button && !pwaInstalled()) button.hidden = false;
});

async function instalarPortalPwa() {
    if (!deferredPwaInstallPrompt) return;
    deferredPwaInstallPrompt.prompt();
    await deferredPwaInstallPrompt.userChoice;
    deferredPwaInstallPrompt = null;
}

if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}
