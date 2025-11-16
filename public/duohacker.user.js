// ==UserScript==
// @name         Duolingo DuoHacker ⚡
// @name:zh-CN   Duolingo DuoHacker — 新安全模式 Duolingo 农场工具
// @name:ja      Duolingo DuoHacker — 新しい安全モード Duolingo ファーミングツール
// @name:es      Duolingo DuoHacker — Nueva Modo Seguro Herramienta para farmear en Duolingo
// @name:ru      Duolingo DuoHacker — Новый безопасный режим для фарминга Duolingo
// @name:pt-BR   Duolingo DuoHacker — Novo Modo Seguro Ferramenta para farmar no Duolingo
// @name:de      Duolingo DuoHacker — Neuer Sicherer Modus Duolingo Farming-Tool
// @name:it      Duolingo DuoHacker — Nuova Modalità Sicura Strumento di farming Duolingo
// @name:ko      Duolingo DuoHacker — 새로운 안전 모드 Duolingo 팜 도구
// @name:hi      Duolingo DuoHacker — नया सुरक्षित मोड Duolingo फार्मिंग टूल
// @name:ar      Duolingo DuoHacker — الوضع الآمن الجديد أداة زراعة Duolingo
// @name:tr      Duolingo DuoHacker — Yeni Güvenli Mod Duolingo Farming Aracı
// @name:pl      Duolingo DuoHacker — Nowy Tryb Bezpieczny Narzędzie do farmienia Duolingo
// @description  Best free-to-use Duolingo farming tool with new safe mode!
// @description:zh-CN  具有新安全模式的最佳免费 Duolingo 农场工具！
// @description:ja     新しい安全モードを搭載した最高の無料 Duolingo ファーミングツール！
// @description:es     ¡La mejor herramienta gratuita para farmear en Duolingo con nuevo modo seguro!
// @description:ru     Лучший бесплатный инструмент для фарминга Duolingo с новым безопасным режимом!
// @description:pt-BR  A melhor ferramenta gratuita para farmar no Duolingo com novo modo seguro!
// @description:de     Bestes kostenloses Duolingo Farming-Tool mit neuem Sicherem Modus!
// @description:it     Migliore strumento di farming Duolingo gratuito con nuova modalità sicura!
// @description:ko     새로운 안전 모드가 탑재된 최고의 무료 Duolingo 팜 도구!
// @description:hi     नए सुरक्षित मोड के साथ सर्वश्रेष्ठ मुफ्त Duolingo फार्मिंग टूल!
// @description:ar     أفضل أداة زراعة Duolingo مجانية مع الوضع الآمن الجديد!
// @description:tr     Yeni güvenli modlu en iyi ücretsiz Duolingo farming aracı!
// @description:pl     Najlepsze darmowe narzędzie do farmienia Duolingo z nowym trybem bezpiecznym!
// @namespace    https://irylisvps.vercel.app
// @version      2.2
// @author       DuoHacker Community
// @match        https://*.duolingo.com/*
// @match https://*.duolingo.cn/*
// @match https://*.duolingo.com/*
// @icon         https://github.com/pillowslua/images/blob/main/logoo.png?raw=true
// @grant        none
// @license      MIT
// @downloadURL https://update.greasyfork.org/scripts/551444/Duolingo%20DuoHacker%20%E2%9A%A1.user.js
// @updateURL https://update.greasyfork.org/scripts/551444/Duolingo%20DuoHacker%20%E2%9A%A1.meta.js
// ==/UserScript==
const VERSION = "2.2";
const SAFE_DELAY = 2000;
const FAST_DELAY = 300;
const STORAGE_KEY = 'duohacker_accounts';
const SESSION_KEY = 'duohacker_session';
const SCRIPT_ID = '551444';

var jwt, defaultHeaders, userInfo, sub;
let isRunning = false;
let currentMode = 'safe';
let currentTheme = localStorage.getItem('duofarmer_theme') || 'dark';
let hasJoined = localStorage.getItem('duofarmer_joined') === 'true';
let totalEarned = {
    xp: 0,
    gems: 0,
    streak: 0,
    lessons: 0
};
let farmingStats = {
    sessions: 0,
    errors: 0,
    startTime: null
};
let farmingInterval = null;
let savedAccounts = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let duolingoMaxEnabled = localStorage.getItem('duohacker_duolingo_max') === 'true';
let lessonSolving = false;
let lessonsToSolve = 0;
let currentLessonCount = 0;
let autoSolveEnabled = localStorage.getItem('duohacker_auto_solve') === 'true';
let sessionData = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');

// Save session data to localStorage
const saveSessionData = () => {
    sessionData = {
        ...sessionData,
        lastActivity: new Date().toISOString(),
        totalEarned,
        farmingStats,
        currentLessonCount,
        lessonsToSolve
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
};

// ===== VERSION CHECK =====
const checkScriptVersion = async () => {
    try {
        console.log('Checking for updates...');
        const response = await fetch(`https://greasyfork.org/en/scripts/551444.json`);
        const data = await response.json();
        const latestVersion = data.version;

        console.log(`Current: ${VERSION} | Latest: ${latestVersion}`);

        if(VERSION !== latestVersion) {
            showUpdateNotificationModal(latestVersion);
            return false;
        }
        return true;
    } catch (error) {
        console.error('Version check failed:', error);
        return true;
    }
};


const showUpdateNotificationModal = (newVersion) => {

    // Tạo overlay ngăn UI
    const updateOverlay = document.createElement('div');
    updateOverlay.id = '_update_overlay';
    updateOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.9);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(5px);
    `;

    const updateBox = document.createElement('div');
    updateBox.style.cssText = `
        background: linear-gradient(135deg, #1E88E5 0%, #0D47A1 100%);
        border-radius: 20px;
        padding: 40px;
        max-width: 500px;
        text-align: center;
        color: white;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        border: 2px solid rgba(255, 255, 255, 0.1);
    `;

    updateBox.innerHTML = `
        <div style="font-size: 50px; margin-bottom: 20px;">⚠️</div>
        <h2 style="font-size: 28px; margin: 20px 0; font-weight: 700;">Update Required!</h2>
        <p style="font-size: 16px; margin: 15px 0; color: rgba(255, 255, 255, 0.9);">
            Please update to use the tool
        </p>
        <p style="font-size: 14px; margin: 20px 0; color: rgba(255, 255, 255, 0.8);">
            Current: <strong>${VERSION}</strong> → Latest: <strong>${newVersion}</strong>
        </p>
        <p style="font-size: 13px; margin: 20px 0; color: rgba(255, 255, 255, 0.7);">
            New features and security updates are available
        </p>
        <div style="display: flex; gap: 12px; margin-top: 30px;">
            <button id="_update_btn" style="
                flex: 1;
                padding: 12px 24px;
                background: white;
                color: #1E88E5;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s;
            ">
                📥 Update Now
            </button>
        </div>
        <p style="font-size: 12px; margin-top: 20px; color: rgba(255, 255, 255, 0.6);">
            Script won't work until you update
        </p>
    `;

    updateOverlay.appendChild(updateBox);
    document.body.appendChild(updateOverlay);

    // Event listener cho Update button
    document.getElementById('_update_btn')?.addEventListener('click', () => {
        window.open(`https://greasyfork.org/en/scripts/${SCRIPT_ID}`, '_blank');
    });

    const backdrop = document.getElementById('_backdrop');
    const container = document.getElementById('_container');
    const fab = document.getElementById('_fab');

    if(backdrop) backdrop.style.display = 'none';
    if(container) container.style.display = 'none';
    if(fab) fab.style.display = 'none';

    // Ngăn tất cả events
    document.addEventListener('click', (e) => {
        if(e.target.id !== '_update_btn') {
            e.stopPropagation();
        }
    }, true);
};

// Check if we're on a lesson page and should auto-solve
const checkForAutoSolve = () => {
    if (window.location.pathname.includes('/lesson') && autoSolveEnabled) {
        logToConsole('Auto-solve mode: Detected lesson page, starting to solve', 'info');
        if (!lessonSolving) {
            startLessonSolving();
        }
    }
};

// Duolingo Max functionality
const initDuolingoMax = () => {
    'use strict';

    // --- Configuration ---
    const TARGET_URL_REGEX = /https:\/\/www\.duolingo\.com\/\d{4}-\d{2}-\d{2}\/users\/.+/;

    const CUSTOM_SHOP_ITEMS = {
        gold_subscription: {
            itemName: "gold_subscription",
            subscriptionInfo: {
                vendor: "STRIPE",
                renewing: true,
                isFamilyPlan: true,
                expectedExpiration: 9999999999000
            }
        }
    };

    function shouldIntercept(url) {
        const isMatch = TARGET_URL_REGEX.test(url);
        if(isMatch) {
            try {
                console.log(`[API Intercept DEBUG] MATCH FOUND for URL: ${url}`);
            } catch {}
        }
        return isMatch;
    }

    function modifyJson(jsonText) {
        try {
            const data = JSON.parse(jsonText);
            try {
                console.log("[API Intercept] Original Data:", data);
            } catch {}
            data.hasPlus = true;
            if(!data.trackingProperties || typeof data.trackingProperties !== 'object') data.trackingProperties = {};
            data.trackingProperties.has_item_gold_subscription = true;
            data.shopItems = CUSTOM_SHOP_ITEMS;
            try {
                console.log("[API Intercept] Modified Data:", data);
            } catch {}
            return JSON.stringify(data);
        } catch (e) {
            try {
                console.error("[API Intercept] Failed to parse or modify JSON. Returning original text.", e);
            } catch {}
            return jsonText;
        }
    }

    // Store original functions
    const originalFetch = window.fetch;
    const originalXhrOpen = XMLHttpRequest.prototype.open;
    const originalXhrSend = XMLHttpRequest.prototype.send;

    // Function to enable API interception
    window.enableDuolingoMax = function () {
        // fetch
        window.fetch = function (resource, options) {
            const url = resource instanceof Request ? resource.url : resource;
            if(shouldIntercept(url)) {
                try {
                    console.log(`[API Intercept] Intercepting fetch request to: ${url}`);
                } catch {}
                return originalFetch.apply(this, arguments).then(async (response) => {
                    const cloned = response.clone();
                    const jsonText = await cloned.text();
                    const modified = modifyJson(jsonText);
                    let hdrs = response.headers;
                    try {
                        const obj = {};
                        response.headers.forEach((v, k) => obj[k] = v);
                        hdrs = obj;
                    } catch {}
                    return new Response(modified, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: hdrs
                    });
                }).catch(err => {
                    try {
                        console.error('[API Intercept] fetch error', err);
                    } catch {};
                    throw err;
                });
            }
            return originalFetch.apply(this, arguments);
        };

        // XHR
        XMLHttpRequest.prototype.open = function (method, url, ...args) {
            this._intercept = shouldIntercept(url);
            this._url = url;
            originalXhrOpen.call(this, method, url, ...args);
        };

        XMLHttpRequest.prototype.send = function () {
            if(this._intercept) {
                try {
                    console.log(`[API Intercept] Intercepting XHR request to: ${this._url}`);
                } catch {}
                const originalOnReadyStateChange = this.onreadystatechange;
                const xhr = this;
                this.onreadystatechange = function () {
                    if(xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const modifiedText = modifyJson(xhr.responseText);
                            Object.defineProperty(xhr, 'responseText', {
                                writable: true,
                                value: modifiedText
                            });
                            Object.defineProperty(xhr, 'response', {
                                writable: true,
                                value: modifiedText
                            });
                        } catch (e) {
                            try {
                                console.error("[API Intercept] XHR Modification Failed:", e);
                            } catch {}
                        }
                    }
                    if(originalOnReadyStateChange) originalOnReadyStateChange.apply(this, arguments);
                };
            }
            originalXhrSend.apply(this, arguments);
        };

        // Remove manage subscription section
        removeManageSubscriptionSection();

        // Add banner to settings page
        addDuolingoMaxBanner();

        console.log("Duolingo Max features enabled");
    };

    // Function to disable API interception
    window.disableDuolingoMax = function () {
        // Restore original functions
        window.fetch = originalFetch;
        XMLHttpRequest.prototype.open = originalXhrOpen;
        XMLHttpRequest.prototype.send = originalXhrSend;

        // Remove banner if exists
        const banner = document.getElementById('extension-banner');
        if(banner) {
            banner.remove();
        }

        console.log("Duolingo Max features disabled");
    };

    // Function to add banner to settings page
    function addDuolingoMaxBanner() {
        if(!window.location.pathname.includes('/settings/super')) return;

        if(document.getElementById('duolingo-max-banner')) return;

        const refElement = document.querySelector('.ky51z._26JAQ.MGk8p');
        if(!refElement) return;

        const ul = document.createElement('ul');
        ul.className = 'Y6o36';

        const newLi = document.createElement('li');
        newLi.id = 'duolingo-max-banner';
        newLi.className = '_17J_p';
        newLi.style.background = 'linear-gradient(135deg, #2c2f33 0%, #23272a 100%)';
        newLi.style.borderRadius = '8px';
        newLi.style.padding = '12px';
        newLi.innerHTML = `
<div class='thPiC'><div class='_1xOxM' style='font-size: 24px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: #5865F2; border-radius: 100px; box-shadow:0 0 10px rgba(88,101,246,0.3);'>🦉</div></div>
<div class='_3jiBp'>
<h4 class='qyEhl' style='text-shadow:0 0 5px rgba(88,101,242,0.6); color:#fff;'>Join Our Discord</h4>
<span class='_3S2Xa' style='color:#b9bbbe;'>Connect with our community</span>
</div>
<div class='_36kJA'>
<div><a href='https://discord.gg/Gvmd7deFtS'
target='_blank'><button class='_1ursp _2V6ug _2paU5 _3gQUj _7jW2t rdtAy'><span class='_9lHjd'
style='color:#5865F2; text-shadow:0 0 5px rgba(88,101,242,0.4);'>Join Server</span></button></a></div>
</div>
`;

        ul.appendChild(newLi);
        refElement.parentNode.insertBefore(ul, refElement.nextSibling);

        try {
            console.log('Duolingo Max banner successfully added!');
        } catch {}
    }

    // Function to remove manage subscription section
    function removeManageSubscriptionSection(root = document) {
        const sections = root.querySelectorAll('section._3f-te');
        for(const section of sections) {
            const h2 = section.querySelector('h2._203-l');
            if(h2 && h2.textContent.trim() === 'Manage subscription') {
                section.remove();
                break;
            }
        }
    }

    // Initialize based on current setting
    if(duolingoMaxEnabled) {
        window.enableDuolingoMax();
    }

    // Monitor for settings page changes
    const manageSubObserver = new MutationObserver(() => {
        if(duolingoMaxEnabled) {
            removeManageSubscriptionSection();
            addDuolingoMaxBanner();
        }
    });
    manageSubObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
};

// Privacy settings functionality
const togglePrivacy = async () => {
    try {
        const url = `https://www.duolingo.com/2017-06-30/users/${sub}/privacy-settings?fields=privacySettings`;

        const getToken = () => {
            const m = document.querySelector('meta[name="csrf-token"]') || document.querySelector('meta[name="csrf_token"]');
            if(m) return m.content;
            const cookies = document.cookie.split(';').map(s => s.trim());
            for(const name of ['csrf_token', 'csrftoken', 'XSRF-TOKEN', 'csrf']) {
                const c = cookies.find(s => s.startsWith(name + '='));
                if(c) return decodeURIComponent(c.split('=')[1]);
            }
            return null;
        };

        const token = getToken();
        const headers = Object.assign({
            'Content-Type': 'application/json;charset=utf-8'
        }, token ? {
            'x-csrf-token': token
        } : {});

        const get = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            headers
        });
        const js = await get.json();

        const social = js.privacySettings?.find(x => x.id === "disable_social");
        if(!social) {
            logToConsole("Không tìm thấy cài đặt disable_social", 'error');
            return;
        }

        const current = !social.enabled ? false : true;
        const newState = !current;

        logToConsole(`Trạng thái hiện tại: ${current ? "Private" : "Public"} → đổi thành ${newState ? "Private" : "Public"}`, 'info');

        const patch = await fetch(url, {
            method: 'PATCH',
            credentials: 'include',
            headers,
            body: JSON.stringify({
                DISABLE_SOCIAL: newState
            })
        });

        logToConsole(`Kết quả PATCH: ${patch.status}`, patch.ok ? 'success' : 'error');

        // Update the privacy button text
        const privacyBtn = document.getElementById('_privacy_toggle_btn');
        if(privacyBtn) {
            privacyBtn.textContent = newState ? 'Set Public' : 'Set Private';
        }

        return newState;
    } catch (error) {
        logToConsole(`Privacy toggle error: ${error.message}`, 'error');
        return null;
    }
};

// Auto Solve functionality
const findReact = (dom, traverseUp = 1) => {
    const key = Object.keys(dom).find(key => key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$"));
    const domFiber = dom[key];
    if(domFiber == null) return null;

    if(domFiber._currentElement) { // React <16
        let compFiber = domFiber._currentElement._owner;
        for(let i = 0; i < traverseUp; i++) {
            compFiber = compFiber._currentElement._owner;
        }
        return compFiber._instance;
    }

    const GetCompFiber = fiber => {
        let parentFiber = fiber.return;
        while(typeof parentFiber.type == "string") {
            parentFiber = parentFiber.return;
        }
        return parentFiber;
    };
    let compFiber = GetCompFiber(domFiber);
    for(let i = 0; i < traverseUp; i++) {
        compFiber = GetCompFiber(compFiber);
    }
    return compFiber.stateNode;
};

const determineChallengeType = () => {
    try {
        if(document.getElementsByClassName("FmlUF").length > 0) { // Story
            if(window.sol.type === "arrange") return "Story Arrange";
            if(window.sol.type === "multiple-choice" || window.sol.type === "select-phrases") return "Story Multiple Choice";
            if(window.sol.type === "point-to-phrase") return "Story Point to Phrase";
            if(window.sol.type === "match") return "Story Pairs";
        } else { // Lesson
            if(document.querySelectorAll('[data-test*="challenge-speak"]').length > 0) return 'Challenge Speak';
            if(window.sol.type === 'tapCompleteTable') return 'Tap Complete Table';
            if(window.sol.type === 'typeCloze') return 'Type Cloze';
            if(window.sol.type === 'typeClozeTable') return 'Type Cloze Table';
            if(window.sol.type === 'tapClozeTable') return 'Tap Cloze Table';
            if(window.sol.type === 'typeCompleteTable') return 'Type Complete Table';
            if(window.sol.type === 'patternTapComplete') return 'Pattern Tap Complete';
            if(document.querySelectorAll('[data-test*="challenge-name"]').length > 0 && document.querySelectorAll('[data-test="challenge-choice"]').length > 0) return 'Challenge Name';
            if(window.sol.type === 'listenMatch') return 'Listen Match';
            if(document.querySelectorAll('[data-test="challenge challenge-listenSpeak"]').length > 0) return 'Listen Speak';
            if(document.querySelectorAll('[data-test="challenge-choice"]').length > 0) {
                if(document.querySelectorAll('[data-test="challenge-text-input"]').length > 0) return 'Challenge Choice with Text Input';
                return 'Challenge Choice';
            }
            if(document.querySelectorAll('[data-test$="challenge-tap-token"]').length > 0) {
                if(window.sol.pairs !== undefined) return 'Pairs';
                if(window.sol.correctTokens !== undefined) return 'Tokens Run';
                if(window.sol.correctIndices !== undefined) return 'Indices Run';
            }
            if(document.querySelectorAll('[data-test="challenge-tap-token-text"]').length > 0) return 'Fill in the Gap';
            if(document.querySelectorAll('[data-test="challenge-text-input"]').length > 0) return 'Challenge Text Input';
            if(document.querySelectorAll('[data-test*="challenge-partialReverseTranslate"]').length > 0) return 'Partial Reverse';
            if(document.querySelectorAll('textarea[data-test="challenge-translate-input"]').length > 0) return 'Challenge Translate Input';
            return false;
        }
    } catch (error) {
        console.error("Error determining challenge type:", error);
        return 'error';
    }
};

const handleChallenge = (challengeType) => {
    if(['Challenge Speak', 'Listen Match', 'Listen Speak', 'error'].includes(challengeType)) {
        const buttonSkip = document.querySelector('button[data-test="player-skip"]');
        if(buttonSkip && !buttonSkip.disabled) {
            console.log(`Auto skipping ${challengeType} challenge`);
            buttonSkip.click();
        } else {
            console.log(`No skip button available for ${challengeType}`);
        }
        return;
    }

    if(challengeType === 'Challenge Choice' || challengeType === 'Challenge Choice with Text Input') {
        if(challengeType === 'Challenge Choice with Text Input') {
            let elm = document.querySelectorAll('[data-test="challenge-text-input"]')[0];
            let nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            nativeInputValueSetter.call(elm, window.sol.correctSolutions ? window.sol.correctSolutions[0].split(/(?<=^\S+)\s/)[1] : (window.sol.displayTokens ? window.sol.displayTokens.find(t => t.isBlank).text : window.sol.prompt));
            let inputEvent = new Event('input', {
                bubbles: true
            });
            elm.dispatchEvent(inputEvent);
        } else {
            document.querySelectorAll("[data-test='challenge-choice']")[window.sol.correctIndex].click();
        }
    } else if(challengeType === 'Pairs' || challengeType === 'Story Pairs') {
        let nl = document.querySelectorAll('[data-test*="challenge-tap-token"]:not(span)');
        window.sol.pairs?.forEach(pair => {
            for(let i = 0; i < nl.length; i++) {
                const nlInnerText = nl[i].querySelector('[data-test="challenge-tap-token-text"]').innerText.toLowerCase().trim();
                if((nlInnerText === pair.learningToken.toLowerCase().trim() || nlInnerText === pair.fromToken.toLowerCase().trim()) && !nl[i].disabled) {
                    nl[i].click();
                }
            }
        });
    } else if(challengeType === 'Tap Complete Table') {
        const solutionRows = window.sol.displayTableTokens.slice(1);
        const tableRowElements = document.querySelectorAll('tbody tr');
        const wordBankButtons = document.querySelector('div[data-test="word-bank"]')?.querySelectorAll('button[data-test*="-challenge-tap-token"]') || [];
        const usedWordBankIndexes = new Set();
        solutionRows.forEach((solutionRow, rowIndex) => {
            const correctToken = solutionRow[1].find(token => token.isBlank);
            if(correctToken) {
                const correctAnswerText = correctToken.text;
                const currentRowElement = tableRowElements[rowIndex];
                let buttons = currentRowElement.querySelectorAll('button[data-test*="-challenge-tap-token"]');
                let clicked = false;
                if(buttons.length > 0) {
                    for(let button of buttons) {
                        const buttonTextElm = button.querySelector('[data-test="challenge-tap-token-text"]');
                        if(buttonTextElm && buttonTextElm.innerText.trim() === correctAnswerText && !button.disabled) {
                            button.click();
                            clicked = true;
                            break;
                        }
                    }
                }
                if(!clicked && wordBankButtons.length > 0) {
                    for(let i = 0; i < wordBankButtons.length; i++) {
                        if(usedWordBankIndexes.has(i)) continue;
                        const button = wordBankButtons[i];
                        const buttonTextElm = button.querySelector('[data-test="challenge-tap-token-text"]');
                        if(buttonTextElm && buttonTextElm.innerText.trim() === correctAnswerText && !button.disabled) {
                            button.click();
                            usedWordBankIndexes.add(i);
                            break;
                        }
                    }
                }
            }
        });
    } else if(challengeType === 'Tokens Run') {
        const all_tokens = document.querySelectorAll('[data-test$="challenge-tap-token"]');
        const correct_tokens = window.sol.correctTokens;
        const clicked_tokens = [];
        correct_tokens.forEach(correct_token => {
            const matching_elements = Array.from(all_tokens).filter(element => element.textContent.trim() === correct_token.trim());
            if(matching_elements.length > 0) {
                const match_index = clicked_tokens.filter(token => token.textContent.trim() === correct_token.trim()).length;
                if(match_index < matching_elements.length) {
                    matching_elements[match_index].click();
                    clicked_tokens.push(matching_elements[match_index]);
                }
            }
        });
    } else if(challengeType === 'Indices Run' || challengeType === 'Fill in the Gap') {
        window.sol.correctIndices?.forEach(index => {
            document.querySelectorAll('div[data-test="word-bank"] [data-test*="challenge-tap-token"]:not(span)')[index].click();
        });
    } else if(challengeType === 'Challenge Text Input') {
        let elm = document.querySelectorAll('[data-test="challenge-text-input"]')[0];
        let nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeInputValueSetter.call(elm, window.sol.correctSolutions ? window.sol.correctSolutions[0] : window.sol.prompt);
        let inputEvent = new Event('input', {
            bubbles: true
        });
        elm.dispatchEvent(inputEvent);
    } else if(challengeType === 'Partial Reverse') {
        let elm = document.querySelector('[data-test*="challenge-partialReverseTranslate"]')?.querySelector("span[contenteditable]");
        let nativeInputNodeTextSetter = Object.getOwnPropertyDescriptor(Node.prototype, "textContent").set;
        nativeInputNodeTextSetter.call(elm, window.sol?.displayTokens?.filter(t => t.isBlank)?.map(t => t.text)?.join()?.replaceAll(',', ''));
        let inputEvent = new Event('input', {
            bubbles: true
        });
        elm.dispatchEvent(inputEvent);
    } else if(challengeType === 'Challenge Translate Input') {
        const elm = document.querySelector('textarea[data-test="challenge-translate-input"]');
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        nativeInputValueSetter.call(elm, window.sol.correctSolutions ? window.sol.correctSolutions[0] : window.sol.prompt);
        let inputEvent = new Event('input', {
            bubbles: true
        });
        elm.dispatchEvent(inputEvent);
    } else if(challengeType === 'Challenge Name') {
        let articles = window.sol.articles;
        let correctSolutions = window.sol.correctSolutions[0];
        let matchingArticle = articles.find(article => correctSolutions.startsWith(article));
        let matchingIndex = matchingArticle !== undefined ? articles.indexOf(matchingArticle) : null;
        let remainingValue = correctSolutions.substring(matchingArticle.length);
        let selectedElement = document.querySelector(`[data-test="challenge-choice"]:nth-child(${matchingIndex + 1})`);
        if(selectedElement) selectedElement.click();
        let elm = document.querySelector('[data-test="challenge-text-input"]');
        let nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeInputValueSetter.call(elm, remainingValue);
        let inputEvent = new Event('input', {
            bubbles: true
        });
        elm.dispatchEvent(inputEvent);
    } else if(challengeType === 'Type Cloze') {
        const input = document.querySelector('input[type="text"].b4jqk');
        if(input) {
            let targetToken = window.sol.displayTokens.find(t => t.damageStart !== undefined);
            let correctWord = targetToken?.text || "";
            let correctEnding = typeof targetToken?.damageStart === "number" ? correctWord.slice(targetToken.damageStart) : "";
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            nativeInputValueSetter.call(input, correctEnding);
            input.dispatchEvent(new Event("input", {
                bubbles: true
            }));
            input.dispatchEvent(new Event("change", {
                bubbles: true
            }));
        }
    } else if(challengeType === 'Type Cloze Table') {
        const tableRows = document.querySelectorAll('tbody tr');
        window.sol.displayTableTokens.slice(1).forEach((rowTokens, i) => {
            const answerCell = rowTokens[1]?.find(t => typeof t.damageStart === "number");
            if(answerCell && tableRows[i]) {
                const input = tableRows[i].querySelector('input[type="text"].b4jqk');
                if(input) {
                    const correctWord = answerCell.text;
                    const correctEnding = correctWord.slice(answerCell.damageStart);
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                    nativeInputValueSetter.call(input, correctEnding);
                    input.dispatchEvent(new Event("input", {
                        bubbles: true
                    }));
                    input.dispatchEvent(new Event("change", {
                        bubbles: true
                    }));
                }
            }
        });
    } else if(challengeType === 'Tap Cloze Table') {
        const tableRows = document.querySelectorAll('tbody tr');
        window.sol.displayTableTokens.slice(1).forEach((rowTokens, i) => {
            const answerCell = rowTokens[1]?.find(t => typeof t.damageStart === "number");
            if(answerCell && tableRows[i]) {
                const wordBank = document.querySelector('[data-test="word-bank"], .eSgkc');
                const wordButtons = wordBank ? Array.from(wordBank.querySelectorAll('button[data-test*="challenge-tap-token"]:not([aria-disabled="true"])')) : [];
                const correctWord = answerCell.text;
                const correctEnding = correctWord.slice(answerCell.damageStart);
                let endingMatched = "";
                let used = new Set();
                for(let btn of wordButtons) {
                    if(!correctEnding.startsWith(endingMatched + btn.innerText)) continue;
                    btn.click();
                    endingMatched += btn.innerText;
                    used.add(btn);
                    if(endingMatched === correctEnding) break;
                }
            }
        });
    } else if(challengeType === 'Type Complete Table') {
        const tableRows = document.querySelectorAll('tbody tr');
        window.sol.displayTableTokens.slice(1).forEach((rowTokens, i) => {
            const answerCell = rowTokens[1]?.find(t => t.isBlank);
            if(answerCell && tableRows[i]) {
                const input = tableRows[i].querySelector('input[type="text"].b4jqk');
                if(input) {
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                    nativeInputValueSetter.call(input, answerCell.text);
                    input.dispatchEvent(new Event("input", {
                        bubbles: true
                    }));
                    input.dispatchEvent(new Event("change", {
                        bubbles: true
                    }));
                }
            }
        });
    } else if(challengeType === 'Pattern Tap Complete') {
        const wordBank = document.querySelector('[data-test="word-bank"], .eSgkc');
        if(wordBank) {
            const choices = window.sol.choices;
            const correctIndex = window.sol.correctIndex ?? 0;
            const correctText = choices[correctIndex];
            const buttons = Array.from(wordBank.querySelectorAll('button[data-test*="challenge-tap-token"]:not([aria-disabled="true"])'));
            const targetButton = buttons.find(btn => btn.innerText.trim() === correctText);
            if(targetButton) targetButton.click();
        }
    } else if(challengeType === 'Story Arrange') {
        let choices = document.querySelectorAll('[data-test*="challenge-tap-token"]:not(span)');
        for(let i = 0; i < window.sol.phraseOrder.length; i++) {
            choices[window.sol.phraseOrder[i]].click();
        }
    } else if(challengeType === 'Story Multiple Choice') {
        let choices = document.querySelectorAll('[data-test="stories-choice"]');
        choices[window.sol.correctAnswerIndex].click();
    } else if(challengeType === 'Story Point to Phrase') {
        let choices = document.querySelectorAll('[data-test="challenge-tap-token-text"]');
        let correctIndex = -1;
        for(let i = 0; i < window.sol.parts.length; i++) {
            if(window.sol.parts[i].selectable === true) {
                correctIndex += 1;
                if(window.sol.correctAnswerIndex === i) {
                    choices[correctIndex].parentElement.click();
                }
            }
        }
    }
};

const solve = () => {
    try {
        window.sol = findReact(document.getElementsByClassName('_3yE3H')[0])?.props?.currentChallenge;
    } catch (error) {
        console.error("Error getting challenge data:", error);
        const buttonSkip = document.querySelector('button[data-test="player-skip"]');
        if(buttonSkip && !buttonSkip.disabled) {
            console.log("Auto skipping due to error fetching challenge data");
            buttonSkip.click();
        }
        return;
    }

    const challengeType = determineChallengeType();
    if(challengeType && !['error', 'Challenge Speak', 'Listen Match', 'Listen Speak'].includes(challengeType)) {
        handleChallenge(challengeType);
        setTimeout(() => {
            const nextButton = document.querySelector('[data-test="player-next"]') || document.querySelector('[data-test="stories-player-continue"]');
            if(nextButton && !nextButton.disabled) nextButton.click();
        }, 100);
    } else {
        console.log(`Cannot solve or skipping ${challengeType} challenge`);
        const buttonSkip = document.querySelector('button[data-test="player-skip"]');
        if(buttonSkip && !buttonSkip.disabled) {
            console.log(`Auto skipping ${challengeType}`);
            buttonSkip.click();
        }
    }
};

const initInterface = () => {
    const containerHTML = `
  <div id="_backdrop"></div>
  <div id="_container" class="theme-${currentTheme}">
    <div id="_header">
      <div class="_header_top">
        <div class="_brand">
          <div class="_logo_container">
            <div class="_logo" style="font-size: 36px; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; background: linear-gradient(135deg, #1E88E5 0%, #0D47A1 100%); border-radius: 50%;">🦉</div>
          </div>
          <div class="_brand_text">
            <h1>DuoHacker</h1>
            <span class="_version_badge">v2.2</span>
          </div>
        </div>
        <div class="_header_controls">
          <button id="_accounts_btn" class="_control_btn _accounts">
            <span style="font-size: 18px;">👥</span>
            <span class="_badge">${savedAccounts.length}</span>
          </button>
          <button id="_settings_btn" class="_control_btn _settings">
            <span style="font-size: 18px;">⚙️</span>
          </button>
          <button id="_theme_toggle" class="_control_btn">
            <span style="font-size: 18px;">${currentTheme === 'dark' ? '☀️' : '🌙'}</span>
          </button>
          <button id="_minimize_btn" class="_control_btn">
            <span style="font-size: 18px;">➖</span>
          </button>
          <button id="_close_btn" class="_control_btn _close">
            <span style="font-size: 18px;">❌</span>
          </button>
        </div>
      </div>
    </div>

    <div id="_main_content" style="display:none">

      <div class="_profile_card">
        <div class="_profile_header">
          <div class="_avatar">
            <span style="font-size: 28px;">👤</span>
          </div>
          <div class="_profile_info">
            <h2 id="_username">Loading...</h2>
            <p id="_user_details">Fetching data...</p>
          </div>
          <button id="_save_account_btn" class="_icon_btn _success" title="Save Current Account">
            <span style="font-size: 16px;">💾</span>
          </button>
          <button id="_refresh_profile" class="_icon_btn" title="Refresh Profile">
            <span style="font-size: 16px;">🔄</span>
          </button>
        </div>
        <div class="_stats_row">
          <div class="_stat_item">
            <div class="_stat_icon">⚡</div>
            <div class="_stat_info">
              <span class="_stat_value" id="_current_xp">0</span>
              <span class="_stat_label">Total XP</span>
            </div>
          </div>
          <div class="_stat_item">
            <div class="_stat_icon">🔥</div>
            <div class="_stat_info">
              <span class="_stat_value" id="_current_streak">0</span>
              <span class="_stat_label">Streak</span>
            </div>
          </div>
          <div class="_stat_item">
            <div class="_stat_icon">💎</div>
            <div class="_stat_info">
              <span class="_stat_value" id="_current_gems">0</span>
              <span class="_stat_label">Gems</span>
            </div>
          </div>
        </div>
      </div>

      <div class="_mode_section">
        <h3>Select Farming Mode</h3>
        <div class="_mode_cards">
          <div class="_mode_card ${currentMode === 'safe' ? '_active' : ''}" data-mode="safe">
            <div class="_mode_icon">🛡️</div>
            <h4>Safe Mode</h4>
            <p>Slow but undetectable farming</p>
            <div class="_mode_specs">
              <span class="_spec">2s delay</span>
              <span class="_spec">100% safe</span>
            </div>
          </div>
          <div class="_mode_card ${currentMode === 'fast' ? '_active' : ''}" data-mode="fast">
            <div class="_mode_icon">⚡</div>
            <h4>Fast Mode</h4>
            <p>Quick farming with moderate risk</p>
            <div class="_mode_specs">
              <span class="_spec">0.3s delay</span>
              <span class="_spec">Use carefully</span>
            </div>
          </div>
        </div>
      </div>

      <div class="_options_section">
        <h3>Farming Options</h3>
        <div class="_option_grid">
          <button class="_option_btn" data-type="xp">
            <div class="_option_icon">⚡</div>
            <span>Farm XP</span>
          </button>
          <button class="_option_btn" data-type="gems">
            <div class="_option_icon">💎</div>
            <span>Farm Gems</span>
          </button>
          <button class="_option_btn" data-type="streak_repair">
            <div class="_option_icon">🔧</div>
            <span>Repair Streak</span>
          </button>
          <button class="_option_btn" data-type="streak_farm">
            <div class="_option_icon">🔥</div>
            <span>Farm Streak</span>
          </button>
          <button class="_option_btn" data-type="solve_lesson">
            <div class="_option_icon">📚</div>
            <span>Solve Lesson</span>
          </button>
          <button class="_option_btn" data-type="farm_all">
            <div class="_option_icon">🌟</div>
            <span>Farm All</span>
          </button>
        </div>
      </div>

      <div class="_auto_solve_section">
        <h3>Auto-Solve Settings</h3>
        <div class="_setting_item">
          <div class="_toggle_container">
            <label class="_toggle_label">[BETA] Enable Auto-Solve on Lesson Pages</label>
            <div class="_toggle_switch ${autoSolveEnabled ? '_active' : ''}" id="_auto_solve_toggle">
              <div class="_toggle_slider"></div>
            </div>
          </div>
          <p class="_setting_description">Automatically solve lessons when you navigate to duolingo.com/lesson ( May causes some errors )</p>
        </div>
      </div>

      <div class="_control_panel">
        <button id="_start_farming" class="_start_btn">
          <span class="_btn_text">Start Farming</span>
        </button>
        <button id="_stop_farming" class="_stop_btn" style="display:none">
          <span class="_btn_text">Stop Farming</span>
        </button>
      </div>

      <div class="_live_stats">
        <h3>Live Statistics</h3>
        <div class="_stats_grid">
          <div class="_live_stat">
            <div class="_live_icon">⚡</div>
            <div class="_live_data">
              <span id="_earned_xp">0</span>
              <small>XP Earned</small>
            </div>
          </div>
          <div class="_live_stat">
            <div class="_live_icon">💎</div>
            <div class="_live_data">
              <span id="_earned_gems">0</span>
              <small>Gems Earned</small>
            </div>
          </div>
          <div class="_live_stat">
            <div class="_live_icon">🔥</div>
            <div class="_live_data">
              <span id="_earned_streak">0</span>
              <small>Streak Gained</small>
            </div>
          </div>
          <div class="_live_stat">
            <div class="_live_icon">📚</div>
            <div class="_live_data">
              <span id="_earned_lessons">0</span>
              <small>Lessons Solved</small>
            </div>
          </div>
          <div class="_live_stat">
            <div class="_live_icon">⏱️</div>
            <div class="_live_data">
              <span id="_farming_time">00:00</span>
              <small>Time Elapsed</small>
            </div>
          </div>
        </div>
      </div>

      <div class="_console_section">
        <div class="_console_header">
          <h3>Activity Log</h3>
          <button id="_clear_console" class="_clear_btn">Clear</button>
        </div>
        <div id="_console_output" class="_console">
          <div class="_log_entry _info">
            <span class="_log_time">${new Date().toLocaleTimeString()}</span>
            <span class="_log_msg">DuoHacker v2.2 initialized</span>
          </div>
        </div>
      </div>

    </div>

    <div id="_join_section" class="_join_section">
      <div class="_join_content">
        <div class="_join_icon">
          <span style="font-size: 30px;">💬</span>
        </div>
        <h2>Join Our Community</h2>
        <p>Get access to updates, support, and exclusive features</p>
        <button id="_join_btn" class="_join_btn">
          <span>Free Pro Version</span>
          <span style="font-size: 16px;">➡️</span>
        </button>
      </div>
    </div>

    <div class="_footer">
      <span>© 2025 DuoHacker by tw1sk</span>
      <div class="_footer_links">
        <button id="_website_btn" class="_footer_link">
          <span style="font-size: 12px;">🌐</span>
          Website
        </button>
        <button id="_discord_btn" class="_footer_link">
          <span style="font-size: 12px;">💬</span>
          Discord
        </button>
      </div>
      <span class="_footer_version">v2.2</span>
    </div>
  </div>

  <div id="_accounts_modal" class="_modal" style="display:none">
    <div class="_modal_overlay"></div>
    <div class="_modal_container _wide">
      <div class="_modal_header">
        <h2>
          <span style="font-size: 24px; display:inline-block;vertical-align:middle;margin-right:8px">👥</span>
          Account Manager
        </h2>
        <button id="_close_accounts" class="_close_modal_btn">
          <span style="font-size: 18px;">❌</span>
        </button>
      </div>
      <div class="_modal_content">
        <div class="_accounts_grid" id="_accounts_list">
          ${savedAccounts.length === 0 ? '<div class="_empty_state"><p>No saved accounts yet. Save your current account to get started!</p></div>' : ''}
        </div>
      </div>
    </div>
  </div>

  <div id="_settings_modal" class="_modal" style="display:none">
    <div class="_modal_overlay"></div>
    <div class="_modal_container">
      <div class="_modal_header">
        <h2>Settings</h2>
        <button id="_close_settings" class="_close_modal_btn">
          <span style="font-size: 18px;">❌</span>
        </button>
      </div>
      <div class="_modal_content">
        <div class="_settings_section">
          <h3>Duolingo Max Features</h3>
          <div class="_setting_item">
            <div class="_toggle_container">
              <label class="_toggle_label">Enable Duolingo Max</label>
              <div class="_toggle_switch ${duolingoMaxEnabled ? '_active' : ''}" id="_duolingo_max_toggle">
                <div class="_toggle_slider"></div>
              </div>
            </div>
            <p class="_setting_description">Unlock premium features including unlimited hearts, no ads, and advanced AI-powered lessons</p>
          </div>
        </div>
        <div class="_settings_section">
          <h3>Privacy Settings</h3>
          <div class="_setting_item">
            <button id="_privacy_toggle_btn" class="_setting_btn _primary">
              <span style="font-size: 18px;">🔒</span>
              Set Private
            </button>
            <p class="_setting_description">Toggle your profile visibility between public and private</p>
          </div>
        </div>
        <div class="_settings_section">
          <h3>Quick Actions</h3>
          <div class="_setting_item">
            <button id="_get_jwt_btn" class="_setting_btn _primary">
              <span style="font-size: 18px;">📋</span>
              Copy JWT Token
            </button>
          </div>
          <div class="_setting_item">
            <button id="_logout_btn" class="_setting_btn _danger">
              <span style="font-size: 18px;">🚪</span>
              Log Out
            </button>
          </div>
        </div>
        <div class="_settings_section">
          <h3>Manual Login</h3>
          <div class="_setting_item">
            <div class="_jwt_input_group">
              <input type="text" id="_jwt_input" placeholder="Paste JWT Token here">
              <button id="_login_jwt_btn" class="_setting_btn _success">
                <span style="font-size: 18px;">➡️</span>
                Login
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div id="_save_account_modal" class="_modal" style="display:none">
    <div class="_modal_overlay"></div>
    <div class="_modal_container">
      <div class="_modal_header">
        <h2>Save Account</h2>
        <button id="_close_save_account" class="_close_modal_btn">
          <span style="font-size: 18px;">❌</span>
        </button>
      </div>
      <div class="_modal_content">
        <div class="_settings_section">
          <div class="_setting_item">
            <label class="_input_label">Account Nickname</label>
            <input type="text" id="_account_nickname" class="_text_input" placeholder="e.g., Main Account, Alt #1, Work Account">
          </div>
          <div class="_setting_item">
            <div class="_account_preview">
              <div class="_preview_avatar">
                <span style="font-size: 20px;">👤</span>
              </div>
              <div class="_preview_info">
                <strong id="_preview_username">Loading...</strong>
                <span id="_preview_details">...</span>
              </div>
            </div>
          </div>
          <div class="_setting_item">
            <button id="_confirm_save_account" class="_setting_btn _success">
              <span style="font-size: 18px;">✅</span>
              Save Account
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div id="_lesson_count_modal" class="_modal" style="display:none">
    <div class="_modal_overlay"></div>
    <div class="_modal_container">
      <div class="_modal_header">
        <h2>Solve Lessons</h2>
        <button id="_close_lesson_count" class="_close_modal_btn">
          <span style="font-size: 18px;">❌</span>
        </button>
      </div>
      <div class="_modal_content">
        <div class="_settings_section">
          <div class="_setting_item">
            <label class="_input_label">Number of Lessons to Solve</label>
            <input type="number" id="_lesson_count_input" class="_text_input" placeholder="Enter number of lessons (0 for unlimited)" min="0" value="5">
            <p class="_setting_description">Enter 0 for unlimited lessons. The script will automatically solve each lesson and reload to continue.</p>
          </div>
          <div class="_setting_item">
            <button id="_start_lesson_solving" class="_setting_btn _success">
              <span style="font-size: 18px;">▶️</span>
              Start Solving
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div id="_fab">
    <div class="_fab_ring"></div>
    <span style="font-size: 20px;">🔧</span>
  </div>
`;

    const style = document.createElement("style");
    style.innerHTML = `
:root {
  --primary-color: #1E88E5;
  --primary-dark: #0D47A1;
  --primary-light: #64B5F6;
  --primary-glow: rgba(30, 136, 229, 0.4);
  --success-color: #43A047;
  --success-glow: rgba(67, 160, 71, 0.3);
  --error-color: #E53935;
  --error-glow: rgba(229, 57, 53, 0.3);
  --warning-color: #FB8C00;
  --warning-glow: rgba(251, 140, 0, 0.3);
  --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-fast: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.15);
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.2);
  --shadow-xl: 0 12px 48px rgba(0, 0, 0, 0.25);
}

.theme-dark {
  --bg-primary: linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%);
  --bg-secondary: rgba(26, 31, 58, 0.8);
  --bg-card: rgba(30, 35, 60, 0.9);
  --bg-modal: rgba(20, 25, 45, 0.95);
  --bg-glass: rgba(255, 255, 255, 0.05);
  --text-primary: #FFFFFF;
  --text-secondary: #B0BEC5;
  --text-muted: #78909C;
  --border-color: rgba(255, 255, 255, 0.08);
  --border-glow: rgba(30, 136, 229, 0.2);
  --hover-bg: rgba(30, 136, 229, 0.12);
  --glass-bg: rgba(255, 255, 255, 0.03);
  --glass-border: rgba(255, 255, 255, 0.1);
}

.theme-light {
  --bg-primary: linear-gradient(135deg, #f5f7fa 0%, #e8eef5 100%);
  --bg-secondary: rgba(245, 247, 250, 0.9);
  --bg-card: rgba(255, 255, 255, 0.95);
  --bg-modal: rgba(255, 255, 255, 0.98);
  --bg-glass: rgba(0, 0, 0, 0.03);
  --text-primary: #212121;
  --text-secondary: #616161;
  --text-muted: #9E9E9E;
  --border-color: rgba(0, 0, 0, 0.08);
  --border-glow: rgba(30, 136, 229, 0.15);
  --hover-bg: rgba(30, 136, 229, 0.08);
  --glass-bg: rgba(0, 0, 0, 0.02);
  --glass-border: rgba(0, 0, 0, 0.05);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#_container {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(90vw, 920px);
  max-height: 90vh;
  background: var(--bg-card);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-radius: 24px;
  box-shadow: var(--shadow-xl), 0 0 0 1px var(--border-color);
  border: 1px solid var(--glass-border);
  overflow: hidden;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  animation: containerAppear 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes containerAppear {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.9) translateY(20px);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1) translateY(0);
  }
}

#_backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 9999;
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

    #_header {
      background: var(--bg-secondary);
      padding: 16px 20px;
      border-bottom: 1px solid var(--border-color);
    }

    ._header_top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    ._brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    ._logo_container {
      width: 40px;
      height: 40px;
    }

    ._logo {
      width: 100%;
      height: 100%;
    }

    ._brand_text {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    ._brand_text h1 {
      font-size: 20px;
      font-weight: 700;
      color: var(--primary-color);
    }

    ._version_badge {
      background: var(--primary-color);
      color: white;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 600;
    }

    ._header_controls {
      display: flex;
      gap: 6px;
    }

    ._control_btn {
      position: relative;
      width: 36px;
      height: 36px;
      border: none;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      color: var(--text-secondary);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: var(--transition);
    }

    ._control_btn:hover {
      background: var(--hover-bg);
      color: var(--primary-color);
    }

    ._control_btn._close:hover {
      background: rgba(229, 57, 53, 0.1);
      color: var(--error-color);
    }

    ._control_btn._accounts {
      background: var(--primary-color);
      color: white;
    }

    ._control_btn._accounts:hover {
      background: var(--primary-dark);
    }

    ._control_btn._settings {
      background: var(--primary-color);
      color: white;
    }

    ._control_btn._settings:hover {
      background: var(--primary-dark);
    }

    ._badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: var(--error-color);
      color: white;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 5px;
      border-radius: 8px;
      min-width: 16px;
      text-align: center;
    }

    #_main_content {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    ._profile_card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 20px;
      transition: var(--transition);
    }

    ._profile_card:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    ._profile_header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    ._avatar {
      width: 50px;
      height: 50px;
      background: var(--primary-color);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }

    ._profile_info {
      flex: 1;
    }

    ._profile_info h2 {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 4px;
    }

    ._profile_info p {
      color: var(--text-secondary);
      font-size: 14px;
    }

    ._icon_btn {
      width: 32px;
      height: 32px;
      border: none;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      color: var(--text-secondary);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: var(--transition);
    }

    ._icon_btn:hover {
      background: var(--hover-bg);
      color: var(--primary-color);
    }

    ._icon_btn._success {
      background: var(--success-color);
      color: white;
      border-color: var(--success-color);
    }

    ._icon_btn._success:hover {
      background: #2E7D32;
    }

    ._stats_row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }

    ._stat_item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px;
      background: var(--bg-secondary);
      border-radius: 8px;
    }

    ._stat_icon {
      font-size: 20px;
    }

    ._stat_info {
      display: flex;
      flex-direction: column;
    }

    ._stat_value {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
    }

    ._stat_label {
      font-size: 11px;
      color: var(--text-secondary);
    }

    ._mode_section h3 {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 12px;
    }

    ._mode_cards {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    ._mode_card {
      background: var(--bg-card);
      border: 2px solid var(--border-color);
      border-radius: 12px;
      padding: 16px;
      cursor: pointer;
      transition: var(--transition);
      text-align: center;
    }

    ._mode_card:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    ._mode_card._active {
      border-color: var(--primary-color);
      background: var(--hover-bg);
    }

    ._mode_icon {
      font-size: 36px;
      margin-bottom: 8px;
    }

    ._mode_card h4 {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 6px;
    }

    ._mode_card p {
      color: var(--text-secondary);
      font-size: 13px;
      margin-bottom: 10px;
    }

    ._mode_specs {
      display: flex;
      justify-content: center;
      gap: 6px;
    }

    ._spec {
      background: var(--bg-secondary);
      padding: 3px 6px;
      border-radius: 4px;
      font-size: 11px;
      color: var(--text-muted);
    }

    ._options_section h3 {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 12px;
    }

    ._option_grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }

    ._option_btn {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 14px;
      cursor: pointer;
      transition: var(--transition);
      display: flex;
      align-items: center;
      gap: 10px;
    }

    ._option_btn:hover {
      background: var(--hover-bg);
      border-color: var(--primary-color);
    }

    ._option_btn._selected {
      background: var(--primary-color);
      color: white;
      border-color: var(--primary-color);
    }

    ._option_icon {
      font-size: 20px;
    }

    ._option_btn span {
      font-weight: 500;
      color: var(--text-primary);
    }

    ._option_btn._selected span {
      color: white;
    }

    ._auto_solve_section {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 16px;
    }

    ._auto_solve_section h3 {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 12px;
    }

    ._control_panel {
      display: flex;
      justify-content: center;
      gap: 12px;
    }

    ._start_btn, ._stop_btn {
      padding: 12px 32px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: var(--transition);
    }

    ._start_btn {
      background: var(--success-color);
      color: white;
    }

    ._stop_btn {
      background: var(--error-color);
      color: white;
    }

    ._start_btn:hover {
      background: #2E7D32;
    }

    ._stop_btn:hover {
      background: #C62828;
    }

    ._live_stats h3 {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 12px;
    }

    ._stats_grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }

    ._live_stat {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 12px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    ._live_icon {
      font-size: 20px;
    }

    ._live_data {
      display: flex;
      flex-direction: column;
    }

    ._live_data span {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
    }

    ._live_data small {
      font-size: 11px;
      color: var(--text-secondary);
    }

    ._console_section {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
    }

    ._console_header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color);
    }

    ._console_header h3 {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
    }

    ._clear_btn {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 4px 8px;
      color: var(--text-secondary);
      font-size: 11px;
      cursor: pointer;
      transition: var(--transition);
    }

    ._clear_btn:hover {
      background: rgba(229, 57, 53, 0.1);
      color: var(--error-color);
    }

    ._console {
      height: 120px;
      overflow-y: auto;
      padding: 12px 16px;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 12px;
    }

    ._log_entry {
      display: flex;
      gap: 8px;
      margin-bottom: 6px;
    }

    ._log_time {
      color: var(--text-muted);
      flex-shrink: 0;
    }

    ._log_msg {
      color: var(--text-secondary);
    }

    ._log_entry._success ._log_msg {
      color: var(--success-color);
    }

    ._log_entry._error ._log_msg {
      color: var(--error-color);
    }

    ._log_entry._info ._log_msg {
      color: var(--primary-color);
    }

    ._join_section {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 30px;
    }

    ._join_content {
      text-align: center;
      max-width: 350px;
    }

    ._join_icon {
      width: 60px;
      height: 60px;
      background: var(--primary-color);
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      color: white;
    }

    ._join_content h2 {
      font-size: 20px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 10px;
    }

    ._join_content p {
      color: var(--text-secondary);
      margin-bottom: 20px;
    }

    ._join_btn {
      background: var(--primary-color);
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: var(--transition);
    }

    ._join_btn:hover {
      background: var(--primary-dark);
    }

    ._footer {
      padding: 12px 20px;
      background: var(--bg-secondary);
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: var(--text-muted);
    }

    ._footer_links {
      display: flex;
      gap: 10px;
    }

    ._footer_link {
      display: flex;
      align-items: center;
      gap: 4px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 4px 8px;
      color: var(--text-secondary);
      font-size: 11px;
      cursor: pointer;
      transition: var(--transition);
    }

    ._footer_link:hover {
      background: var(--hover-bg);
      color: var(--primary-color);
    }

    ._footer_version {
      background: var(--bg-card);
      padding: 2px 6px;
      border-radius: 4px;
    }

    #_fab {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 48px;
      height: 48px;
      background: var(--primary-color);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(30, 136, 229, 0.3);
      transition: var(--transition);
      z-index: 9998;
    }

    #_fab:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 16px rgba(30, 136, 229, 0.4);
    }

    ._fab_ring {
      position: absolute;
      width: 100%;
      height: 100%;
      border: 2px solid var(--primary-color);
      border-radius: 50%;
      animation: ringPulse 2s infinite;
    }

    @keyframes ringPulse {
      0% {
        transform: scale(1);
        opacity: 1;
      }
      100% {
        transform: scale(1.3);
        opacity: 0;
      }
    }

    ._modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    ._modal_overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(5px);
    }

    ._modal_container {
      position: relative;
      width: 90%;
      max-width: 500px;
      max-height: 85vh;
      background: var(--bg-modal);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      overflow: hidden;
      animation: modalSlideIn 0.3s ease-out;
      display: flex;
      flex-direction: column;
    }

    ._modal_container._wide {
      max-width: 800px;
    }

    @keyframes modalSlideIn {
      from {
        opacity: 0;
        transform: scale(0.95) translateY(20px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    ._modal_header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
    }

    ._modal_header h2 {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-primary);
    }

    ._close_modal_btn {
      width: 32px;
      height: 32px;
      border: none;
      background: var(--bg-card);
      color: var(--text-secondary);
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: var(--transition);
    }

    ._close_modal_btn:hover {
      background: rgba(229, 57, 53, 0.1);
      color: var(--error-color);
    }

    ._modal_content {
      padding: 20px;
      overflow-y: auto;
      flex: 1;
    }

    ._settings_section {
      margin-bottom: 20px;
    }

    ._settings_section:last-child {
      margin-bottom: 0;
    }

    ._settings_section h3 {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 16px;
    }

    ._setting_item {
      margin-bottom: 12px;
    }

    ._setting_item:last-child {
      margin-bottom: 0;
    }

    ._setting_btn {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      color: var(--text-primary);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: var(--transition);
    }

    ._setting_btn:hover {
      background: var(--hover-bg);
    }

    ._setting_btn._primary {
      background: var(--primary-color);
      color: white;
      border-color: var(--primary-color);
    }

    ._setting_btn._primary:hover {
      background: var(--primary-dark);
    }

    ._setting_btn._success {
      background: var(--success-color);
      color: white;
      border-color: var(--success-color);
    }

    ._setting_btn._success:hover {
      background: #2E7D32;
    }

    ._setting_btn._danger {
      background: var(--error-color);
      color: white;
      border-color: var(--error-color);
    }

    ._setting_btn._danger:hover {
      background: #C62828;
    }

    ._jwt_input_group {
      display: flex;
      gap: 10px;
    }

    #_jwt_input, #_lesson_count_input {
      flex: 1;
      padding: 12px 16px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      color: var(--text-primary);
      font-size: 14px;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      transition: var(--transition);
    }

    #_jwt_input:focus, #_lesson_count_input:focus {
      outline: none;
      border-color: var(--primary-color);
    }

    ._input_label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary);
      margin-bottom: 6px;
    }

    ._text_input {
      width: 100%;
      padding: 12px 16px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      color: var(--text-primary);
      font-size: 14px;
      transition: var(--transition);
    }

    ._text_input:focus {
      outline: none;
      border-color: var(--primary-color);
    }

    ._text_input::placeholder {
      color: var(--text-muted);
    }

    ._account_preview {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
    }

    ._preview_avatar {
      width: 40px;
      height: 40px;
      background: var(--primary-color);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      flex-shrink: 0;
    }

    ._preview_info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    ._preview_info strong {
      font-size: 14px;
      color: var(--text-primary);
    }

    ._preview_info span {
      font-size: 12px;
      color: var(--text-secondary);
    }

    ._accounts_grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 12px;
    }

    ._empty_state {
      grid-column: 1 / -1;
      text-align: center;
      padding: 40px 20px;
      color: var(--text-secondary);
    }

    ._empty_state p {
      font-size: 14px;
    }

    ._account_card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
      transition: var(--transition);
      position: relative;
      cursor: pointer;
    }

    ._account_card:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      border-color: var(--primary-color);
    }

    ._account_card._active {
      border-color: var(--success-color);
      background: var(--hover-bg);
    }

    ._account_header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }

    ._account_avatar {
      width: 40px;
      height: 40px;
      background: var(--primary-color);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      flex-shrink: 0;
    }

    ._account_info {
      flex: 1;
      min-width: 0;
    }

    ._account_nickname {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    ._account_username {
      font-size: 12px;
      color: var(--text-secondary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    ._account_stats {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 12px;
    }

    ._account_stat {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: var(--text-secondary);
    }

    ._account_actions {
      display: flex;
      gap: 6px;
    }

    ._account_action_btn {
      flex: 1;
      padding: 8px;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: var(--transition);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }

    ._account_action_btn._login {
      background: var(--success-color);
      color: white;
    }

    ._account_action_btn._login:hover {
      background: #2E7D32;
    }

    ._account_action_btn._delete {
      background: var(--error-color);
      color: white;
    }

    ._account_action_btn._delete:hover {
      background: #C62828;
    }

    ._active_badge {
      position: absolute;
      top: 8px;
      right: 8px;
      background: var(--success-color);
      color: white;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
    }

    ._toggle_container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    ._toggle_label {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary);
    }

    ._toggle_switch {
      position: relative;
      width: 50px;
      height: 26px;
      background-color: var(--border-color);
      border-radius: 13px;
      cursor: pointer;
      transition: var(--transition);
    }

    ._toggle_switch._active {
      background-color: var(--primary-color);
    }

    ._toggle_slider {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 20px;
      height: 20px;
      background-color: white;
      border-radius: 50%;
      transition: var(--transition);
    }

    ._toggle_switch._active ._toggle_slider {
      transform: translateX(24px);
    }

    ._setting_description {
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 4px;
    }

    ::-webkit-scrollbar {
      width: 6px;
    }

    ::-webkit-scrollbar-track {
      background: var(--bg-secondary);
      border-radius: 3px;
    }

    ::-webkit-scrollbar-thumb {
      background: var(--border-color);
      border-radius: 3px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: var(--text-muted);
    }

    @media (max-width: 768px) {
      #_container {
        width: 95vw;
        max-height: 95vh;
      }

      ._stats_row, ._mode_cards, ._option_grid, ._stats_grid {
        grid-template-columns: 1fr;
      }

      ._control_panel {
        flex-direction: column;
      }

      ._start_btn, ._stop_btn {
        width: 100%;
      }

      ._footer {
        flex-direction: column;
        gap: 8px;
      }

      ._footer_links {
        width: 100%;
        justify-content: center;
      }

      ._jwt_input_group {
        flex-direction: column;
      }

      ._accounts_grid {
        grid-template-columns: 1fr;
      }

      ._modal_container._wide {
        max-width: 95%;
      }
    }
  `;

    document.head.appendChild(style);
    // === FIX MODAL VISIBILITY & CONTRAST ===
    style.innerHTML += `
  /* Reduce dark overlay opacity */
  ._modal_overlay {
    background: rgba(0, 0, 0, 0.3) !important;
    backdrop-filter: blur(3px) !important;
  }

  /* Make modal box less transparent & text brighter */
  ._modal_container {
    background: rgba(30, 30, 30, 0.98) !important;
    color: #fff !important;
  }

  /* Improve input visibility */
  ._text_input, #_jwt_input, #_lesson_count_input {
    background: #2c2c2c !important;
    color: #fff !important;
    border: 1px solid #444 !important;
  }

  /* Buttons inside settings/login modals */
  ._setting_btn {
    background: #1e88e5 !important;
    color: #fff !important;
    border-color: #1565c0 !important;
  }

  ._setting_btn:hover {
    background: #1565c0 !important;
  }

  /* Make account card text readable */
  ._account_card {
    background: rgba(40, 40, 40, 0.95) !important;
    color: #fff !important;
  }
`;
    // === END FIX ===


    const container = document.createElement("div");
    container.innerHTML = containerHTML;
    document.body.appendChild(container);
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const logToConsole = (message, type = 'info') => {
    const console = document.getElementById('_console_output');
    if(!console) return;

    const timestamp = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `_log_entry _${type}`;
    entry.innerHTML = `
    <span class="_log_time">${timestamp}</span>
    <span class="_log_msg">${message}</span>
  `;

    console.appendChild(entry);
    console.scrollTop = console.scrollHeight;

    while(console.children.length > 50) {
        console.removeChild(console.firstChild);
    }
};

const updateEarnedStats = () => {
    const elements = {
        xp: document.getElementById('_earned_xp'),
        gems: document.getElementById('_earned_gems'),
        streak: document.getElementById('_earned_streak'),
        lessons: document.getElementById('_earned_lessons')
    };

    if(elements.xp) elements.xp.textContent = totalEarned.xp.toLocaleString();
    if(elements.gems) elements.gems.textContent = totalEarned.gems.toLocaleString();
    if(elements.streak) elements.streak.textContent = totalEarned.streak;
    if(elements.lessons) elements.lessons.textContent = totalEarned.lessons.toLocaleString();
};

const updateFarmingTime = () => {
    if(!farmingStats.startTime) return;

    const elapsed = Date.now() - farmingStats.startTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);

    const timeElement = document.getElementById('_farming_time');
    if(timeElement) {
        timeElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
};

const setInterfaceVisible = (visible) => {
    const container = document.getElementById("_container");
    const backdrop = document.getElementById("_backdrop");

    if(container && backdrop) {
        container.style.display = visible ? "flex" : "none";
        backdrop.style.display = visible ? "block" : "none";
    }
};

const isInterfaceVisible = () => {
    const container = document.getElementById("_container");
    return container && container.style.display !== "none";
};

const toggleInterface = () => {
    setInterfaceVisible(!isInterfaceVisible());
};

const applyTheme = (theme) => {
    currentTheme = theme;
    localStorage.setItem('duofarmer_theme', theme);

    const container = document.getElementById("_container");
    if(container) {
        container.className = container.className.replace(/theme-\w+/, `theme-${theme}`);
    }

    // Update theme toggle icon
    const themeToggle = document.getElementById('_theme_toggle');
    if(themeToggle) {
        themeToggle.innerHTML = `<span style="font-size: 18px;">${theme === 'dark' ? '☀️' : '🌙'}</span>`;
    }
};

const saveAccount = (nickname) => {
    if(!jwt || !userInfo) {
        logToConsole('Cannot save account: not logged in', 'error');
        return false;
    }

    const account = {
        id: Date.now().toString(),
        nickname: nickname || userInfo.username,
        username: userInfo.username,
        jwt: jwt,
        fromLanguage: userInfo.fromLanguage,
        learningLanguage: userInfo.learningLanguage,
        streak: userInfo.streak,
        gems: userInfo.gems,
        totalXp: userInfo.totalXp,
        savedAt: new Date().toISOString()
    };

    const existingIndex = savedAccounts.findIndex(acc => acc.username === account.username);
    if(existingIndex !== -1) {
        savedAccounts[existingIndex] = account;
        logToConsole(`Updated account: ${nickname}`, 'success');
    } else {
        savedAccounts.push(account);
        logToConsole(`Saved new account: ${nickname}`, 'success');
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedAccounts));
    updateAccountsBadge();
    return true;
};

const deleteAccount = (accountId) => {
    savedAccounts = savedAccounts.filter(acc => acc.id !== accountId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedAccounts));
    updateAccountsBadge();
    renderAccountsList();
    logToConsole('Account deleted', 'info');
};

const loginWithAccount = (account) => {
    document.cookie = `jwt_token=${account.jwt}; path=/; domain=.duolingo.com`;
    logToConsole(`Logging in as ${account.username}...`, 'info');
    setTimeout(() => {
        window.location.reload();
    }, 1000);
};

const updateAccountsBadge = () => {
    const badge = document.querySelector('._control_btn._accounts ._badge');
    if(badge) {
        badge.textContent = savedAccounts.length;
    }
};

const renderAccountsList = () => {
    const accountsList = document.getElementById('_accounts_list');
    if(!accountsList) return;

    if(savedAccounts.length === 0) {
        accountsList.innerHTML = '<div class="_empty_state"><p>No saved accounts yet. Save your current account to get started!</p></div>';
        return;
    }

    const currentUsername = userInfo?.username;

    accountsList.innerHTML = savedAccounts.map(account => {
        const isActive = account.username === currentUsername;
        return `
      <div class="_account_card ${isActive ? '_active' : ''}" data-id="${account.id}">
        ${isActive ? '<div class="_active_badge">ACTIVE</div>' : ''}
        <div class="_account_header">
          <div class="_account_avatar">
            <span style="font-size: 20px;">👤</span>
          </div>
          <div class="_account_info">
            <div class="_account_nickname">${account.nickname}</div>
            <div class="_account_username">@${account.username}</div>
          </div>
        </div>
        <div class="_account_stats">
          <div class="_account_stat">⚡ ${account.totalXp?.toLocaleString() || 0}</div>
          <div class="_account_stat">🔥 ${account.streak || 0}</div>
          <div class="_account_stat">💎 ${account.gems || 0}</div>
        </div>
        <div class="_account_actions">
          ${!isActive ? `<button class="_account_action_btn _login" data-action="login">
            <span style="font-size: 14px;">➡️</span>
            Login
          </button>` : '<div style="flex:1"></div>'}
          <button class="_account_action_btn _delete" data-action="delete">
            <span style="font-size: 14px;">🗑️</span>
          </button>
        </div>
      </div>
    `;
    }).join('');

    accountsList.querySelectorAll('._account_card').forEach(card => {
        const accountId = card.dataset.id;
        const account = savedAccounts.find(acc => acc.id === accountId);

        card.querySelector('[data-action="login"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if(confirm(`Switch to account: ${account.nickname}?`)) {
                loginWithAccount(account);
            }
        });

        card.querySelector('[data-action="delete"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if(confirm(`Delete account: ${account.nickname}?`)) {
                deleteAccount(accountId);
            }
        });
    });
};

const addEventListeners = () => {
    document.getElementById('_fab')?.addEventListener('click', toggleInterface);

    document.getElementById('_minimize_btn')?.addEventListener('click', () => {
        setInterfaceVisible(false);
    });

    document.getElementById('_close_btn')?.addEventListener('click', () => {
        if(isRunning) {
            if(confirm('Farming is active. Are you sure you want to close?')) {
                stopFarming();
                setInterfaceVisible(false);
            }
        } else {
            setInterfaceVisible(false);
        }
    });

    document.getElementById('_theme_toggle')?.addEventListener('click', () => {
        applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
    });

    document.getElementById('_accounts_btn')?.addEventListener('click', () => {
        renderAccountsList();
        document.getElementById('_accounts_modal').style.display = 'flex';
    });

    document.getElementById('_close_accounts')?.addEventListener('click', () => {
        document.getElementById('_accounts_modal').style.display = 'none';
    });

    document.getElementById('_accounts_modal')?.addEventListener('click', (e) => {
        if(e.target.classList.contains('_modal_overlay')) {
            document.getElementById('_accounts_modal').style.display = 'none';
        }
    });

    document.getElementById('_settings_btn')?.addEventListener('click', () => {
        document.getElementById('_settings_modal').style.display = 'flex';
    });

    document.getElementById('_close_settings')?.addEventListener('click', () => {
        document.getElementById('_settings_modal').style.display = 'none';
    });

    document.getElementById('_settings_modal')?.addEventListener('click', (e) => {
        if(e.target.classList.contains('_modal_overlay')) {
            document.getElementById('_settings_modal').style.display = 'none';
        }
    });

    // Auto-solve toggle
    document.getElementById('_auto_solve_toggle')?.addEventListener('click', () => {
        const toggle = document.getElementById('_auto_solve_toggle');
        autoSolveEnabled = !autoSolveEnabled;
        localStorage.setItem('duohacker_auto_solve', autoSolveEnabled.toString());

        if(autoSolveEnabled) {
            toggle.classList.add('_active');
            logToConsole('Auto-solve enabled', 'success');
            // Check if we're currently on a lesson page
            if(window.location.pathname.includes('/lesson')) {
                checkForAutoSolve();
            }
        } else {
            toggle.classList.remove('_active');
            logToConsole('Auto-solve disabled', 'info');
        }
    });

    // Privacy toggle button
    document.getElementById('_privacy_toggle_btn')?.addEventListener('click', async () => {
        const newState = await togglePrivacy();
        if(newState !== null) {
            const privacyBtn = document.getElementById('_privacy_toggle_btn');
            if(privacyBtn) {
                privacyBtn.textContent = newState ? 'Set Public' : 'Set Private';
            }
        }
    });

    // Duolingo Max toggle
    document.getElementById('_duolingo_max_toggle')?.addEventListener('click', () => {
        const toggle = document.getElementById('_duolingo_max_toggle');
        duolingoMaxEnabled = !duolingoMaxEnabled;
        localStorage.setItem('duohacker_duolingo_max', duolingoMaxEnabled.toString());

        if(duolingoMaxEnabled) {
            toggle.classList.add('_active');
            if(window.enableDuolingoMax) {
                window.enableDuolingoMax();
            }
            logToConsole('Duolingo Max features enabled', 'success');
        } else {
            toggle.classList.remove('_active');
            if(window.disableDuolingoMax) {
                window.disableDuolingoMax();
            }
            logToConsole('Duolingo Max features disabled', 'info');
        }
    });

    document.getElementById('_save_account_btn')?.addEventListener('click', () => {
        if(!userInfo) {
            logToConsole('Please wait for user data to load', 'error');
            return;
        }
        document.getElementById('_preview_username').textContent = userInfo.username;
        document.getElementById('_preview_details').textContent = `${userInfo.fromLanguage} → ${userInfo.learningLanguage}`;
        document.getElementById('_account_nickname').value = userInfo.username;
        document.getElementById('_save_account_modal').style.display = 'flex';
    });

    document.getElementById('_close_save_account')?.addEventListener('click', () => {
        document.getElementById('_save_account_modal').style.display = 'none';
    });

    document.getElementById('_save_account_modal')?.addEventListener('click', (e) => {
        if(e.target.classList.contains('_modal_overlay')) {
            document.getElementById('_save_account_modal').style.display = 'none';
        }
    });

    document.getElementById('_confirm_save_account')?.addEventListener('click', () => {
        const nickname = document.getElementById('_account_nickname').value.trim();
        if(!nickname) {
            alert('Please enter a nickname for this account');
            return;
        }
        if(saveAccount(nickname)) {
            document.getElementById('_save_account_modal').style.display = 'none';
            alert(`Account saved as: ${nickname}`);
        }
    });

    document.getElementById('_get_jwt_btn')?.addEventListener('click', () => {
        const token = getJwtToken();
        if(token) {
            navigator.clipboard.writeText(token);
            logToConsole('JWT Token copied to clipboard', 'success');
            alert('JWT Token copied to clipboard!');
        } else {
            logToConsole('JWT Token not found', 'error');
            alert('JWT Token not found! Please make sure you are logged in to Duolingo.');
        }
    });

    document.getElementById('_logout_btn')?.addEventListener('click', () => {
        if(confirm('Are you sure you want to log out?')) {
            window.location.href = 'https://www.duolingo.com/logout';
        }
    });

    document.getElementById('_login_jwt_btn')?.addEventListener('click', () => {
        const jwtInput = document.getElementById('_jwt_input');
        const token = jwtInput.value.trim();

        if(token) {
            document.cookie = `jwt_token=${token}; path=/; domain=.duolingo.com`;
            logToConsole('JWT Token updated, refreshing page...', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            logToConsole('Please enter a valid JWT Token', 'error');
            alert('Please enter a valid JWT Token');
        }
    });

    document.getElementById('_website_btn')?.addEventListener('click', () => {
        window.open('https://twisk.fun/', '_blank');
    });

    document.getElementById('_discord_btn')?.addEventListener('click', () => {
        window.open('https://discord.gg/Gvmd7deFtS', '_blank');
    });

    document.getElementById('_join_btn')?.addEventListener('click', () => {
        window.open('https://discord.gg/Gvmd7deFtS', '_blank');
        localStorage.setItem('duofarmer_joined', 'true');
        hasJoined = true;
        document.getElementById('_join_section').style.display = 'none';
        document.getElementById('_main_content').style.display = 'flex';
        initializeFarming();
    });

    document.querySelectorAll('._mode_card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('._mode_card').forEach(c => c.classList.remove('_active'));
            card.classList.add('_active');
            currentMode = card.dataset.mode;
            logToConsole(`Switched to ${currentMode} mode`, 'info');
        });
    });

    document.querySelectorAll('._option_btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('._option_btn').forEach(b => b.classList.remove('_selected'));
            btn.classList.add('_selected');
        });
    });

    document.getElementById('_start_farming')?.addEventListener('click', startFarming);
    document.getElementById('_stop_farming')?.addEventListener('click', stopFarming);

    document.getElementById('_refresh_profile')?.addEventListener('click', async () => {
        const btn = document.getElementById('_refresh_profile');
        btn.style.animation = 'spin 1s linear';
        await refreshUserData();
        btn.style.animation = '';
    });

    document.getElementById('_clear_console')?.addEventListener('click', () => {
        const console = document.getElementById('_console_output');
        if(console) {
            console.innerHTML = '';
            logToConsole('Console cleared', 'info');
        }
    });

    // Lesson count modal
    document.getElementById('_close_lesson_count')?.addEventListener('click', () => {
        document.getElementById('_lesson_count_modal').style.display = 'none';
    });

    document.getElementById('_lesson_count_modal')?.addEventListener('click', (e) => {
        if(e.target.classList.contains('_modal_overlay')) {
            document.getElementById('_lesson_count_modal').style.display = 'none';
        }
    });

    document.getElementById('_start_lesson_solving')?.addEventListener('click', () => {
        const input = document.getElementById('_lesson_count_input');
        lessonsToSolve = parseInt(input.value) || 0;
        currentLessonCount = 0;
        document.getElementById('_lesson_count_modal').style.display = 'none';

        // Check if we're on a lesson page
        if(window.location.pathname.includes('/lesson')) {
            startLessonSolving();
        } else {
            logToConsole('Redirecting to lessons page...', 'info');
            window.location.href = 'https://www.duolingo.com/lesson';
        }
    });
};

const startFarming = async () => {
    if(isRunning) return;

    const selectedOption = document.querySelector('._option_btn._selected');
    if(!selectedOption) {
        logToConsole('Please select a farming option', 'error');
        return;
    }

    const type = selectedOption.dataset.type;
    const delayMs = currentMode === 'safe' ? SAFE_DELAY : FAST_DELAY;

    // Handle special cases
    if(type === 'solve_lesson') {
        document.getElementById('_lesson_count_modal').style.display = 'flex';
        return;
    }

    if(type === 'farm_all') {
        if(confirm('Farm All will combine XP, Gems, and Streak farming. Continue?')) {
            await farmAll(delayMs);
        }
        return;
    }

    isRunning = true;
    farmingStats.startTime = Date.now();

    document.getElementById('_start_farming').style.display = 'none';
    document.getElementById('_stop_farming').style.display = 'block';

    logToConsole(`Started ${type} farming in ${currentMode} mode`, 'success');

    const timer = setInterval(updateFarmingTime, 1000);

    try {
        switch(type) {
        case 'xp':
            await farmXP(delayMs);
            break;
        case 'gems':
            await farmGems(delayMs);
            break;
        case 'streak_repair':
            await repairStreak();
            break;
        case 'streak_farm':
            await farmStreak();
            break;
        }
    } catch (error) {
        logToConsole(`Farming error: ${error.message}`, 'error');
    } finally {
        clearInterval(timer);
    }
};

const stopFarming = () => {
    if(!isRunning) return;

    isRunning = false;
    lessonSolving = false;
    if(farmingInterval) {
        clearInterval(farmingInterval);
        farmingInterval = null;
    }

    document.getElementById('_start_farming').style.display = 'block';
    document.getElementById('_stop_farming').style.display = 'none';

    logToConsole('Farming stopped', 'info');
    saveSessionData();
};

const startLessonSolving = async () => {
    if(lessonSolving) return;

    lessonSolving = true;
    isRunning = true;
    farmingStats.startTime = Date.now();

    document.getElementById('_start_farming').style.display = 'none';
    document.getElementById('_stop_farming').style.display = 'block';

    logToConsole(`Started solving ${lessonsToSolve === 0 ? 'unlimited' : lessonsToSolve} lessons`, 'success');

    const timer = setInterval(updateFarmingTime, 1000);

    try {
        while(lessonSolving && (lessonsToSolve === 0 || currentLessonCount < lessonsToSolve)) {
            // Check if we're on a lesson page
            if(!window.location.pathname.includes('/lesson')) {
                logToConsole('Not on a lesson page, finding a lesson to start...', 'info');
                const startButton = document.querySelector('[data-test="start-button"]');
                if(startButton) {
                    startButton.click();
                    await delay(2000);
                } else {
                    logToConsole('No lesson found, reloading...', 'warning');
                    window.location.href = 'https://www.duolingo.com/learn';
                    await delay(5000);
                    continue;
                }
            }

            // Solve the current lesson
            await solveCurrentLesson();
            currentLessonCount++;
            totalEarned.lessons++;
            updateEarnedStats();
            saveSessionData();
            logToConsole(`Lesson ${currentLessonCount} completed`, 'success');

            // Check if we've reached the limit
            if(lessonsToSolve > 0 && currentLessonCount >= lessonsToSolve) {
                logToConsole('All lessons completed!', 'success');
                break;
            }

            // Wait a bit before starting the next lesson
            await delay(currentMode === 'safe' ? 3000 : 1000);

            // Reload to start a new lesson
            window.location.href = 'https://www.duolingo.com/learn';
            await delay(5000);
        }
    } catch (error) {
        logToConsole(`Lesson solving error: ${error.message}`, 'error');
    } finally {
        clearInterval(timer);
        lessonSolving = false;
        isRunning = false;
        document.getElementById('_start_farming').style.display = 'block';
        document.getElementById('_stop_farming').style.display = 'none';
        saveSessionData();
    }
};

const solveCurrentLesson = async () => {
    return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            try {
                // Check if we're on a lesson page
                if(document.querySelector('[data-test="challenge-header"]') || document.querySelector('._3yE3H')) {
                    // Solve the current challenge
                    solve();

                    // Check if lesson is complete
                    const nextButton = document.querySelector('[data-test="player-next"]');
                    const continueButton = document.querySelector('[data-test="stories-player-continue"]');
                    const completedScreen = document.querySelector('[data-test="session-over"]');

                    if(nextButton && !nextButton.disabled) {
                        nextButton.click();
                    } else if(continueButton && !continueButton.disabled) {
                        continueButton.click();
                    } else if(completedScreen) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }
            } catch (error) {
                logToConsole(`Error solving lesson: ${error.message}`, 'error');
            }
        }, 1000);

        // Timeout after 60 seconds
        setTimeout(() => {
            clearInterval(checkInterval);
            resolve();
        }, 60000);
    });
};

const farmAll = async (delayMs) => {
    isRunning = true;
    farmingStats.startTime = Date.now();

    document.getElementById('_start_farming').style.display = 'none';
    document.getElementById('_stop_farming').style.display = 'block';

    logToConsole(`Started Farm All in ${currentMode} mode`, 'success');

    const timer = setInterval(updateFarmingTime, 1000);

    try {
        // Farm XP first
        logToConsole('Farming XP...', 'info');
        await farmXP(delayMs);

        // Then farm gems
        logToConsole('Farming Gems...', 'info');
        await farmGems(delayMs);

        // Finally repair and farm streak
        logToConsole('Repairing Streak...', 'info');
        await repairStreak();

        logToConsole('Farming Streak...', 'info');
        await farmStreak();

        logToConsole('Farm All completed!', 'success');
    } catch (error) {
        logToConsole(`Farm All error: ${error.message}`, 'error');
    } finally {
        clearInterval(timer);
        isRunning = false;
        document.getElementById('_start_farming').style.display = 'block';
        document.getElementById('_stop_farming').style.display = 'none';
        saveSessionData();
    }
};

const farmXP = async (delayMs) => {
    while(isRunning) {
        try {
            const response = await farmXpOnce();
            if(response.ok) {
                const data = await response.json();
                const earned = data?.awardedXp || 0;
                totalEarned.xp += earned;
                updateEarnedStats();
                saveSessionData();
                logToConsole(`Earned ${earned} XP`, 'success');
            }
            await delay(delayMs);
        } catch (error) {
            logToConsole(`XP farming error: ${error.message}`, 'error');
            await delay(delayMs * 2);
        }
    }
};

const farmGems = async (delayMs) => {
    while(isRunning) {
        try {
            const response = await farmGemOnce();
            if(response.ok) {
                totalEarned.gems += 30;
                updateEarnedStats();
                saveSessionData();
                logToConsole('Earned 30 gems', 'success');
            }
            await delay(delayMs);
        } catch (error) {
            logToConsole(`Gem farming error: ${error.message}`, 'error');
            await delay(delayMs * 2);
        }
    }
};

const repairStreak = async () => {
    logToConsole('Starting streak repair...', 'info');

    try {
        if(!userInfo.streakData?.currentStreak) {
            logToConsole('No streak to repair!', 'error');
            return;
        }

        const startStreakDate = userInfo.streakData.currentStreak.startDate;
        const endStreakDate = userInfo.streakData.currentStreak.endDate;
        const startStreakTimestamp = Math.floor(new Date(startStreakDate).getTime() / 1000);
        const endStreakTimestamp = Math.floor(new Date(endStreakDate).getTime() / 1000);
        const expectedStreak = Math.floor((endStreakTimestamp - startStreakTimestamp) / (60 * 60 * 24)) + 1;

        if(expectedStreak > userInfo.streak) {
            logToConsole(`Found ${expectedStreak - userInfo.streak} frozen days. Repairing...`, 'warning');

            let currentTimestamp = Math.floor(Date.now() / 1000);
            for(let i = 0; i < expectedStreak && isRunning; i++) {
                await farmSessionOnce(currentTimestamp, currentTimestamp + 60);
                currentTimestamp -= 86400;
                logToConsole(`Repaired day ${i + 1}/${expectedStreak}`, 'info');
                await delay(currentMode === 'safe' ? SAFE_DELAY : FAST_DELAY);
            }

            const updatedUser = await getUserInfo(sub);
            if(updatedUser.streak >= expectedStreak) {
                logToConsole(`Streak repair completed! New streak: ${updatedUser.streak}`, 'success');
                userInfo = updatedUser;
                totalEarned.streak += (updatedUser.streak - userInfo.streak);
                updateUserInfo();
                updateEarnedStats();
                saveSessionData();
            }
        } else {
            logToConsole('No frozen streak detected', 'info');
        }
    } catch (error) {
        logToConsole(`Streak repair failed: ${error.message}`, 'error');
    } finally {
        stopFarming();
    }
};

const farmStreak = async () => {
    logToConsole('Starting streak farming...', 'info');

    const hasStreak = !!userInfo.streakData?.currentStreak;
    const startStreakDate = hasStreak ? userInfo.streakData.currentStreak.startDate : new Date();
    const startFarmStreakTimestamp = Math.floor(new Date(startStreakDate).getTime() / 1000);
    let currentTimestamp = hasStreak ? startFarmStreakTimestamp - 86400 : startFarmStreakTimestamp;

    while(isRunning) {
        try {
            await farmSessionOnce(currentTimestamp, currentTimestamp + 60);
            currentTimestamp -= 86400;
            totalEarned.streak++;
            userInfo.streak++;
            updateUserInfo();
            updateEarnedStats();
            saveSessionData();
            logToConsole(`Streak increased to ${userInfo.streak}`, 'success');
            await delay(currentMode === 'safe' ? SAFE_DELAY : FAST_DELAY);
        } catch (error) {
            logToConsole(`Streak farming error: ${error.message}`, 'error');
            await delay((currentMode === 'safe' ? SAFE_DELAY : FAST_DELAY) * 2);
        }
    }
};

const getJwtToken = () => {
    let match = document.cookie.match(new RegExp('(^| )jwt_token=([^;]+)'));
    if(match) {
        return match[2];
    }
    return null;
};

const decodeJwtToken = (token) => {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
        atob(base64)
        .split("")
        .map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
};

const formatHeaders = (jwt) => ({
    "Content-Type": "application/json",
    Authorization: "Bearer " + jwt,
    "User-Agent": navigator.userAgent,
});

const getUserInfo = async (sub) => {
    const userInfoUrl = `https://www.duolingo.com/2017-06-30/users/${sub}?fields=id,username,fromLanguage,learningLanguage,streak,totalXp,level,numFollowers,numFollowing,gems,creationDate,streakData`;
    const response = await fetch(userInfoUrl, {
        method: "GET",
        headers: defaultHeaders,
    });
    return await response.json();
};

const sendRequestWithDefaultHeaders = async ({
    url,
    payload,
    headers = {},
    method = "GET"
}) => {
    const mergedHeaders = {
        ...defaultHeaders,
        ...headers
    };
    return await fetch(url, {
        method,
        headers: mergedHeaders,
        body: payload ? JSON.stringify(payload) : undefined,
    });
};

const farmXpOnce = async () => {
    const startTime = Math.floor(Date.now() / 1000);
    const fromLanguage = userInfo.fromLanguage;
    const completeUrl = `https://stories.duolingo.com/api2/stories/en-${fromLanguage}-the-passport/complete`;

    const payload = {
        awardXp: true,
        isFeaturedStoryInPracticeHub: false,
        completedBonusChallenge: true,
        mode: "READ",
        isV2Redo: false,
        isV2Story: false,
        isLegendaryMode: true,
        masterVersion: false,
        maxScore: 0,
        numHintsUsed: 0,
        score: 0,
        startTime: startTime,
        fromLanguage: fromLanguage,
        learningLanguage: "en",
        hasXpBoost: false,
        happyHourBonusXp: 449,
    };

    return await sendRequestWithDefaultHeaders({
        url: completeUrl,
        payload: payload,
        method: "POST",
    });
};

const farmGemOnce = async () => {
    const idReward = "SKILL_COMPLETION_BALANCED-dd2495f4_d44e_3fc3_8ac8_94e2191506f0-2-GEMS";
    const patchUrl = `https://www.duolingo.com/2017-06-30/users/${sub}/rewards/${idReward}`;

    const patchData = {
        consumed: true,
        learningLanguage: userInfo.learningLanguage,
        fromLanguage: userInfo.fromLanguage,
    };

    return await sendRequestWithDefaultHeaders({
        url: patchUrl,
        payload: patchData,
        method: "PATCH",
    });
};

const farmSessionOnce = async (startTime, endTime) => {
    const sessionPayload = {
        challengeTypes: [
            "assist", "characterIntro", "characterMatch", "characterPuzzle", "characterSelect",
            "characterTrace", "characterWrite", "completeReverseTranslation", "definition",
            "dialogue", "extendedMatch", "extendedListenMatch", "form", "freeResponse",
            "gapFill", "judge", "listen", "listenComplete", "listenMatch", "match", "name",
            "listenComprehension", "listenIsolation", "listenSpeak", "listenTap",
            "orderTapComplete", "partialListen", "partialReverseTranslate", "patternTapComplete",
            "radioBinary", "radioImageSelect", "radioListenMatch", "radioListenRecognize",
            "radioSelect", "readComprehension", "reverseAssist", "sameDifferent", "select",
            "selectPronunciation", "selectTranscription", "svgPuzzle", "syllableTap",
            "syllableListenTap", "speak", "tapCloze", "tapClozeTable", "tapComplete",
            "tapCompleteTable", "tapDescribe", "translate", "transliterate",
            "transliterationAssist", "typeCloze", "typeClozeTable", "typeComplete",
            "typeCompleteTable", "writeComprehension",
        ],
        fromLanguage: userInfo.fromLanguage,
        isFinalLevel: false,
        isV2: true,
        juicy: true,
        learningLanguage: userInfo.learningLanguage,
        smartTipsVersion: 2,
        type: "GLOBAL_PRACTICE",
    };

    const sessionRes = await sendRequestWithDefaultHeaders({
        url: "https://www.duolingo.com/2017-06-30/sessions",
        payload: sessionPayload,
        method: "POST",
    });

    const sessionData = await sessionRes.json();

    const updateSessionPayload = {
        ...sessionData,
        heartsLeft: 0,
        startTime: startTime,
        enableBonusPoints: false,
        endTime: endTime,
        failed: false,
        maxInLessonStreak: 9,
        shouldLearnThings: true,
    };

    const updateRes = await sendRequestWithDefaultHeaders({
        url: `https://www.duolingo.com/2017-06-30/sessions/${sessionData.id}`,
        payload: updateSessionPayload,
        method: "PUT",
    });

    return await updateRes.json();
};

const updateUserInfo = () => {
    if(!userInfo) return;

    const elements = {
        username: document.getElementById('_username'),
        user_details: document.getElementById('_user_details'),
        currentStreak: document.getElementById('_current_streak'),
        currentGems: document.getElementById('_current_gems'),
        currentXp: document.getElementById('_current_xp')
    };

    if(elements.username) elements.username.textContent = userInfo.username;
    if(elements.user_details) {
        elements.user_details.textContent = `${userInfo.fromLanguage} → ${userInfo.learningLanguage}`;
    }
    if(elements.currentStreak) elements.currentStreak.textContent = userInfo.streak?.toLocaleString() || '0';
    if(elements.currentGems) elements.currentGems.textContent = userInfo.gems?.toLocaleString() || '0';
    if(elements.currentXp) elements.currentXp.textContent = userInfo.totalXp?.toLocaleString() || '0';
};

const refreshUserData = async () => {
    if(!sub || !defaultHeaders) return;

    try {
        logToConsole('Refreshing user data...', 'info');
        userInfo = await getUserInfo(sub);
        updateUserInfo();
        logToConsole('User data refreshed', 'success');
    } catch (error) {
        logToConsole(`Failed to refresh: ${error.message}`, 'error');
    }
};

const initializeFarming = async () => {
    try {
        jwt = getJwtToken();
        if(!jwt) {
            logToConsole('Please login to Duolingo and reload', 'error');
            return false;
        }

        defaultHeaders = formatHeaders(jwt);
        const decodedJwt = decodeJwtToken(jwt);
        sub = decodedJwt.sub;

        logToConsole('Loading user data...', 'info');
        userInfo = await getUserInfo(sub);

        if(userInfo && userInfo.username) {
            updateUserInfo();
            logToConsole(`Welcome ${userInfo.username}!`, 'success');

            // Restore session data if available
            if(sessionData && sessionData.totalEarned) {
                totalEarned = sessionData.totalEarned;
                updateEarnedStats();
                logToConsole('Session data restored', 'info');
            }

            // Check if auto-solve is enabled and we're on a lesson page
            if(autoSolveEnabled && window.location.pathname.includes('/lesson')) {
                checkForAutoSolve();
            }

            return true;
        } else {
            logToConsole('Failed to load user data', 'error');
            return false;
        }
    } catch (error) {
        logToConsole(`Init error: ${error.message}`, 'error');
        return false;
    }
};

// Check if we're on a lesson page and start solving if needed
const checkForLessonPage = () => {
    if(window.location.pathname.includes('/lesson') && autoSolveEnabled) {
        checkForAutoSolve();
    }
};

const updateStyle = document.createElement('style');
updateStyle.innerHTML = `
    #_update_overlay {
        animation: fadeInUpdate 0.5s ease-out;
    }

    @keyframes fadeInUpdate {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }

    #_update_btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
    }

    #_update_btn:active {
        transform: translateY(0);
    }
`;
document.head.appendChild(updateStyle);

(async () => {
    try {
        const isUpToDate = await checkScriptVersion();
        if(!isUpToDate) {
            return;  // Dừng nếu outdated
        }

        initInterface();
        setInterfaceVisible(false);
        applyTheme(currentTheme);
        addEventListeners();
        updateAccountsBadge();
        initDuolingoMax();
        document.getElementById('_join_section').style.display = 'flex';
        document.getElementById('_main_content').style.display = 'none';
        setInterval(checkForLessonPage, 2000);
        logToConsole('DuoHacker v2.2 ready - Enhanced Multi-Account Edition', 'success');
    } catch (error) {
        console.error('Init failed:', error);
    }
})();
