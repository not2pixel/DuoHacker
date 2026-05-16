const { app, BrowserWindow, screen } = require("electron");
const path = require("path");
const https = require("https");

const DUOLINGO_URL = "https://www.duolingo.com";
const SCRIPT_URL =
  "https://update.greasyfork.org/scripts/561041/Duolingo%20DuoHacker.user.js";

app.commandLine.appendSwitch("disable-features", "OutOfBlinkCors,TranslateUI,MediaRouter");
app.commandLine.appendSwitch("disable-background-networking");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-hang-monitor");
app.commandLine.appendSwitch("disable-sync");
app.commandLine.appendSwitch("metrics-recording-only");
app.commandLine.appendSwitch("no-first-run");
app.commandLine.appendSwitch("no-default-browser-check");
app.commandLine.appendSwitch("disable-extensions");
app.commandLine.appendSwitch("disable-component-extensions-with-background-pages");
app.commandLine.appendSwitch("disable-default-apps");
app.commandLine.appendSwitch("disable-breakpad");
app.commandLine.appendSwitch("disable-client-side-phishing-detection");
app.commandLine.appendSwitch("disable-domain-reliability");
app.commandLine.appendSwitch("disable-logging");
app.commandLine.appendSwitch("disable-prompt-on-repost");
app.commandLine.appendSwitch("no-pings");
app.commandLine.appendSwitch("password-store", "basic");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("ignore-gpu-blocklist");

const GM_SHIM = `
(function() {
  if (typeof unsafeWindow === 'undefined') {
    try { Object.defineProperty(window, 'unsafeWindow', { value: window }); } catch(e) {}
  }
  const _store = {};
  window.GM_getValue       = (k, def) => (k in _store ? _store[k] : def);
  window.GM_setValue       = (k, v)   => { _store[k] = v; };
  window.GM_deleteValue    = (k)      => { delete _store[k]; };
  window.GM_listValues     = ()       => Object.keys(_store);
  window.GM_addStyle       = (css)    => {
    const s = document.createElement('style');
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  };
  window.GM_log            = (...a)   => console.log('[GM]', ...a);
  window.GM_openInTab      = (url)    => window.open(url, '_blank');
  window.GM_setClipboard   = (text)   => navigator.clipboard && navigator.clipboard.writeText(text);
  window.GM_notification   = (opts)   => console.info('[GM notify]', typeof opts === 'string' ? opts : opts.text);
  window.GM_xmlhttpRequest = (d)      => {
    const xhr = new XMLHttpRequest();
    xhr.open(d.method || 'GET', d.url);
    if (d.headers) Object.entries(d.headers).forEach(([k,v]) => xhr.setRequestHeader(k, v));
    xhr.onload  = () => d.onload  && d.onload({ responseText: xhr.responseText, status: xhr.status, finalUrl: xhr.responseURL });
    xhr.onerror = () => d.onerror && d.onerror(xhr);
    xhr.send(d.data || null);
  };
  window.GM = {
    getValue:       window.GM_getValue,
    setValue:       window.GM_setValue,
    deleteValue:    window.GM_deleteValue,
    listValues:     window.GM_listValues,
    addStyle:       window.GM_addStyle,
    log:            window.GM_log,
    openInTab:      window.GM_openInTab,
    setClipboard:   window.GM_setClipboard,
    notification:   window.GM_notification,
    xmlHttpRequest: window.GM_xmlhttpRequest,
    info: { script: { name: 'DuoHacker', version: '1.0' } }
  };
  console.log('[DuoHacker] GM shim ready.');
})();
`;

function fetchScript(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchScript(res.headers.location).then(resolve).catch(reject);
        }
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

function prepareScript(raw) {
  return raw.replace(/\/\/\s*==UserScript==[\s\S]*?\/\/\s*==\/UserScript==/m, "");
}

function get169Size() {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;

  let w = Math.min(1920, sw);
  let h = Math.round(w * 9 / 16);

  if (h > sh) {
    h = sh;
    w = Math.round(h * 16 / 9);
  }

  const x = Math.round((sw - w) / 2);
  const y = Math.round((sh - h) / 2);

  return { w, h, x, y };
}

async function createWindow() {
  let userScript = "";
  try {
    console.log("[DuoHacker] Fetching userscript...");
    const raw = await fetchScript(SCRIPT_URL);
    userScript = prepareScript(raw);
    console.log("[DuoHacker] Userscript ready.");
  } catch (err) {
    console.error("[DuoHacker] Failed to fetch userscript:", err.message);
  }

  const { w, h, x, y } = get169Size();

  const win = new BrowserWindow({
    width:  w,
    height: h,
    x,
    y,
    minWidth:  w,
    minHeight: h,
    aspectRatio: 16 / 9,
    title: "DuoHacker",
    icon: path.join(__dirname, "icon.png"),
    backgroundColor: "#1cb0f6",
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false,
      enableWebSQL: false,
      spellcheck: false,
      disableHtmlFullscreenWindowResize: false,
    },
  });

  win.setMenuBarVisibility(false);

  win.once("ready-to-show", () => win.show());

  if (userScript) {
    win.webContents.on("did-finish-load", async () => {
      try {
        await win.webContents.executeJavaScript(GM_SHIM);
        await win.webContents.executeJavaScript(userScript);
        console.log("[DuoHacker] Userscript injected.");
      } catch (e) {
        console.error("[DuoHacker] Injection error:", e.message);
      }
    });
  }

  win.on("hide",    () => win.webContents.setFrameRate(1));
  win.on("minimize",() => win.webContents.setFrameRate(1));
  win.on("show",    () => win.webContents.setFrameRate(60));
  win.on("restore", () => win.webContents.setFrameRate(60));

  if (process.env.DUOHACKER_DEV === "1") {
    win.webContents.openDevTools({ mode: "detach" });
  }

  win.loadURL(DUOLINGO_URL);
  win.on("page-title-updated", (e) => e.preventDefault());
  win.setTitle("DuoHacker – Duolingo");
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
