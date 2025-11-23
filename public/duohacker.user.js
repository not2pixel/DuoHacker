(() => {
    'use strict';

    let CONFIG = {
        GEM_DELAY: 250,
        XP_DELAY: 2000,
        STREAK_DELAY: 40,
        HOTKEY: 'F8',
        TAB_POSITION: 'right',
        TAB_SIZE: 40
    };

    let jwt, sub, userInfo, headers;
    let activeTask = null;
    let stats = { gems: 0, xp: 0, streak: 0 };
    let selectedMode = null;
    let isUIVisible = false;
    let tabElement = null;
    let licenseKey = null;
    let isActivated = false;

    // License Key Management
    const LICENSE = {
    // GitHub raw file URL chứa danh sách license keys
    GITHUB_KEYS_URL: 'https://raw.githubusercontent.com/pillowslua/DuoHacker/refs/heads/main/nightwarekey.txt',

    // Cache để tránh gọi API quá nhiều
    cachedKeys: null,
    cacheTime: null,
    CACHE_DURATION: 3600000, // 1 giờ (ms)

    // Fetch danh sách keys từ GitHub
    fetchKeysFromGithub: async () => {
        try {
            // Kiểm cache trước
            if (LICENSE.cachedKeys && LICENSE.cacheTime &&
                (Date.now() - LICENSE.cacheTime < LICENSE.CACHE_DURATION)) {
                console.log('Using cached keys');
                return LICENSE.cachedKeys;
            }

            const response = await fetch(LICENSE.GITHUB_KEYS_URL);
            if (!response.ok) {
                console.error('Failed to fetch keys from GitHub');
                return [];
            }

            const text = await response.text();
            // Parse keys từ file (mỗi key một dòng)
            const keys = text
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#')); // Bỏ qua dòng trống và comments

            // Lưu vào cache
            LICENSE.cachedKeys = keys;
            LICENSE.cacheTime = Date.now();

            return keys;
        } catch (error) {
            console.error('Error fetching keys from GitHub:', error);
            return [];
        }
    },

    // Check nếu key có trong danh sách
    isValid: async (key) => {
        if (!key) return false;

        try {
            const validKeys = await LICENSE.fetchKeysFromGithub();
            return validKeys.includes(key.trim());
        } catch (error) {
            console.error('License validation error:', error);
            return false;
        }
    },

    // Save key vào localStorage
    saveKey: async (key) => {
        if (await LICENSE.isValid(key)) {
            localStorage.setItem('nightware_license', key.trim());
            licenseKey = key.trim();
            isActivated = true;
            return true;
        }
        return false;
    },

    // Load key từ localStorage
    loadKey: async () => {
        const savedKey = localStorage.getItem('nightware_license');
        if (savedKey && await LICENSE.isValid(savedKey)) {
            licenseKey = savedKey;
            isActivated = true;
            return true;
        }
        return false;
    },

    // Remove key
    removeKey: () => {
        localStorage.removeItem('nightware_license');
        licenseKey = null;
        isActivated = false;
    },

    // Format key để hiển thị
    formatKey: (key) => {
        if (!key) return 'No Key';
        // Hiển thị 4 ký tự cuối + dấu *
        const visible = key.slice(-4);
        return `****${visible}`;
    },

    // Lấy status của key
    getKeyStatus: async (key) => {
        if (!key) return { valid: false, message: 'No key provided' };

        try {
            const isValid = await LICENSE.isValid(key);
            if (isValid) {
                return { valid: true, message: 'Key is valid' };
            } else {
                return { valid: false, message: 'Invalid key' };
            }
        } catch (error) {
            return { valid: false, message: 'Connection error' };
        }
    }
};

    // SVG Icons
    const ICONS = {
        lightning: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
        farm: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 22v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"></path><path d="M4 12V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6"></path><path d="M12 2v20"></path><path d="M8 10h8"></path><path d="M8 14h8"></path></svg>`,
        stats: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`,
        settings: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
        info: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
        key: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 1 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>`,
        lock: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`,
        unlock: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>`,
        gems: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
        xp: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon><circle cx="12" cy="12" r="3"></circle></svg>`,
        streak: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M8 12h8M12 8l4 4-4 4M12 16l-4-4 4-4"></path><path d="M2 12h4M18 12h4"></path></svg>`,
        combo: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
        close: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
    };

    const utils = {
        getJWT: () => {
            const match = document.cookie.match(/jwt_token=([^;]+)/);
            return match ? match[1] : null;
        },

        decodeJWT: (token) => {
            try {
                const payload = token.split('.')[1];
                const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
                return JSON.parse(decodeURIComponent(escape(decoded)));
            } catch (e) {
                return null;
            }
        },

        formatHeaders: (jwt) => ({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwt}`,
            'User-Agent': navigator.userAgent
        }),

        delay: ms => new Promise(r => setTimeout(r, ms)),

        request: async (url, options = {}) => {
            const response = await fetch(url, {
                ...options,
                headers: { ...headers, ...options.headers }
            });
            return response;
        },

        antiDevTools: () => {
            const checkWindowSize = () => {
                const threshold = 160;
                if (window.outerHeight - window.innerHeight > threshold ||
                    window.outerWidth - window.innerWidth > threshold) {
                    window.close();
                }
            };

            const checkConsole = () => {
                const devtools = {
                    open: false,
                    orientation: null
                };
                const threshold = 160;

                const emitEvent = (state, orientation) => {
                    if (state) {
                        window.close();
                    }
                };

                setInterval(() => {
                    if (window.outerHeight - window.innerHeight > threshold ||
                        window.outerWidth - window.innerWidth > threshold) {
                        if (!devtools.open) {
                            emitEvent(true, null);
                        }
                        devtools.open = true;
                    } else {
                        devtools.open = false;
                    }
                }, 500);
            };

            const disableShortcuts = (e) => {
                if (e.keyCode === 123 ||
                    (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74)) ||
                    (e.ctrlKey && e.keyCode === 85)) {
                    e.preventDefault();
                    return false;
                }
            };

            const disableRightClick = (e) => {
                e.preventDefault();
                return false;
            };

            setInterval(checkWindowSize, 1000);
            checkConsole();
            document.addEventListener('keydown', disableShortcuts);
            document.addEventListener('contextmenu', disableRightClick);

            const antiDebugger = () => {
                setInterval(() => {
                    const before = new Date();
                    debugger;
                    const after = new Date();
                    if (after - before > 100) {
                        window.close();
                    }
                }, 1000);
            };

            if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                antiDebugger();
            }
        }
    };

    const api = {
        getUserInfo: async () => {
            const url = `https://www.duolingo.com/2017-06-30/users/${sub}?fields=id,username,fromLanguage,learningLanguage,streak,totalXp,gems,streakData`;
            const res = await utils.request(url);
            return res.json();
        },

        farmGems: async () => {
            const rewardId = "SKILL_COMPLETION_BALANCED-dd2495f4_d44e_3fc3_8ac8_94e2191506f0-2-GEMS";
            const url = `https://www.duolingo.com/2017-06-30/users/${sub}/rewards/${rewardId}`;
            const data = {
                consumed: true,
                learningLanguage: userInfo.learningLanguage,
                fromLanguage: userInfo.fromLanguage
            };

            return utils.request(url, {
                method: 'PATCH',
                body: JSON.stringify(data)
            });
        },

        farmXP: async () => {
            const url = `https://stories.duolingo.com/api2/stories/fr-en-le-passeport/complete`;
            const data = {
                awardXp: true,
                completedBonusChallenge: true,
                fromLanguage: "en",
                hasXpBoost: false,
                illustrationFormat: "svg",
                isFeaturedStoryInPracticeHub: true,
                isLegendaryMode: true,
                isV2Redo: false,
                isV2Story: false,
                learningLanguage: "fr",
                masterVersion: true,
                maxScore: 0,
                score: 0,
                happyHourBonusXp: 469,
                startTime: Math.floor(Date.now() / 1000),
                endTime: Math.floor(Date.now() / 1000),
            };

            return utils.request(url, {
                method: 'POST',
                body: JSON.stringify(data)
            });
        },

        farmSessionOnce: async (startTime, endTime) => {
            try {
                const challengeTypes = ["assist", "select", "translate", "match", "listen"];

                const sessionPayload = {
                    challengeTypes: challengeTypes,
                    fromLanguage: userInfo.fromLanguage,
                    isFinalLevel: false,
                    isV2: true,
                    juicy: true,
                    learningLanguage: userInfo.learningLanguage,
                    smartTipsVersion: 2,
                    type: "GLOBAL_PRACTICE",
                };

                const sessionRes = await utils.request("https://www.duolingo.com/2017-06-30/sessions", {
                    method: 'POST',
                    body: JSON.stringify(sessionPayload)
                });

                if (!sessionRes?.ok) return null;
                const sessionData = await sessionRes.json();

                if (!sessionData?.id) return null;

                const updatePayload = {
                    ...sessionData,
                    heartsLeft: 0,
                    startTime: startTime,
                    enableBonusPoints: false,
                    endTime: endTime,
                    failed: false,
                    maxInLessonStreak: Math.floor(Math.random() * 10 + 5),
                    shouldLearnThings: true,
                };

                const updateRes = await utils.request(`https://www.duolingo.com/2017-06-30/sessions/${sessionData.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(updatePayload)
                });

                return updateRes?.ok ? await updateRes.json() : null;
            } catch (error) {
                console.error('Session farm error:', error);
                return null;
            }
        }
    };

    const farming = {
        async gems() {
            while (activeTask === 'gems') {
                if (!isActivated) {
                    ui.showMessage('Please enter a license key to use this feature!', 'error');
                    farming.stop();
                    return;
                }

                const res = await api.farmGems();
                if (res?.ok) {
                    userInfo.gems += 30;
                    stats.gems += 30;
                    ui.updateStats();
                }
                await utils.delay(CONFIG.GEM_DELAY);
            }
        },

        async xp() {
            while (activeTask === 'xp') {
                if (!isActivated) {
                    ui.showMessage('Please enter a license key to use this feature!', 'error');
                    farming.stop();
                    return;
                }

                const res = await api.farmXP();
                if (res?.ok) {
                    userInfo.totalXp += 499;
                    stats.xp += 499;
                    ui.updateStats();
                }
                await utils.delay(CONFIG.XP_DELAY);
            }
        },

        async streak() {
            while (activeTask === 'streak') {
                if (!isActivated) {
                    ui.showMessage('Please enter a license key to use this feature!', 'error');
                    farming.stop();
                    return;
                }

                const hasStreak = userInfo.streakData?.currentStreak;
                const startDate = hasStreak ? userInfo.streakData.currentStreak.startDate : new Date();

                let currentTimestamp = Math.floor(new Date(startDate).getTime() / 1000) - 86400;

                try {
                    const sessionRes = await api.farmSessionOnce(currentTimestamp, currentTimestamp + 300);
                    if (sessionRes) {
                        currentTimestamp -= 86400;
                        userInfo.streak += 1;
                        stats.streak += 1;
                        ui.updateStats();
                        await utils.delay(CONFIG.STREAK_DELAY);
                    } else {
                        await utils.delay(CONFIG.STREAK_DELAY * 2);
                    }
                } catch (error) {
                    console.error('Streak farming error:', error);
                    await utils.delay(CONFIG.STREAK_DELAY * 3);
                }
            }
        },

        stop() {
            activeTask = null;
            ui.updateUI();
        }
    };

    const ui = {
        create() {
            this.createTab();
            this.createMainUI();
            this.setupHotkey();
            utils.antiDevTools();

            // Load license key on startup
            LICENSE.loadKey();
        },

        createTab() {
            tabElement = document.createElement('div');
            tabElement.id = 'nightware-tab';

            let positionStyles = '';
            if (CONFIG.TAB_POSITION === 'right') {
                positionStyles = `
                    position: fixed;
                    top: 50%;
                    right: 0;
                    transform: translateY(-50%);
                    width: ${CONFIG.TAB_SIZE}px;
                    height: ${CONFIG.TAB_SIZE * 3}px;
                    border-radius: ${CONFIG.TAB_SIZE}px 0 0 ${CONFIG.TAB_SIZE}px;
                    cursor: pointer;
                    z-index: 999998;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #2a2a2a;
                    color: #fff;
                    font-size: 20px;
                    transition: all 0.3s ease;
                    box-shadow: -2px 0 10px rgba(0, 0, 0, 0.3);
                    border: 1px solid #3a3a3a;
                `;
            } else if (CONFIG.TAB_POSITION === 'left') {
                positionStyles = `
                    position: fixed;
                    top: 50%;
                    left: 0;
                    transform: translateY(-50%);
                    width: ${CONFIG.TAB_SIZE}px;
                    height: ${CONFIG.TAB_SIZE * 3}px;
                    border-radius: 0 ${CONFIG.TAB_SIZE}px ${CONFIG.TAB_SIZE}px 0;
                    cursor: pointer;
                    z-index: 999998;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #2a2a2a;
                    color: #fff;
                    font-size: 20px;
                    transition: all 0.3s ease;
                    box-shadow: 2px 0 10px rgba(0, 0, 0, 0.3);
                    border: 1px solid #3a3a3a;
                `;
            }

            tabElement.style.cssText = positionStyles;
            tabElement.innerHTML = isActivated ? ICONS.lightning : ICONS.lock;

            tabElement.addEventListener('mouseenter', () => {
                if (CONFIG.TAB_POSITION === 'right') {
                    tabElement.style.transform = 'translateY(-50%) translateX(-5px)';
                    tabElement.style.background = '#3a3a3a';
                } else if (CONFIG.TAB_POSITION === 'left') {
                    tabElement.style.transform = 'translateY(-50%) translateX(5px)';
                    tabElement.style.background = '#3a3a3a';
                }
            });

            tabElement.addEventListener('mouseleave', () => {
                if (CONFIG.TAB_POSITION === 'right') {
                    tabElement.style.transform = 'translateY(-50%)';
                    tabElement.style.background = '#2a2a2a';
                } else if (CONFIG.TAB_POSITION === 'left') {
                    tabElement.style.transform = 'translateY(-50%)';
                    tabElement.style.background = '#2a2a2a';
                }
            });

            tabElement.addEventListener('click', () => {
                this.toggleUI();
            });

            document.body.appendChild(tabElement);
        },

        createMainUI() {
            const container = document.createElement('div');
            container.id = 'nightware-hub';
            container.style.display = 'none';

            const styles = `
                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateX(100px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }

                @keyframes slideOut {
                    from {
                        opacity: 1;
                        transform: translateX(0);
                    }
                    to {
                        opacity: 0;
                        transform: translateX(100px);
                    }
                }

                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                #nightware-hub {
                    position: fixed;
                    top: 50px;
                    right: 50px;
                    width: 900px;
                    height: 550px;
                    background: #1f1f1f;
                    border: 1px solid #3a3a3a;
                    border-radius: 8px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
                    z-index: 999999;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    color: #d0d0d0;
                    user-select: none;
                }

                #nightware-hub.show {
                    animation: slideIn 0.3s ease-out forwards;
                }

                #nightware-hub.hide {
                    animation: slideOut 0.3s ease-out forwards;
                }

                #nightware-hub.dragging {
                    box-shadow: 0 15px 50px rgba(0, 0, 0, 0.8);
                    cursor: grabbing !important;
                }

                .nw-header {
                    background: #2a2a2a;
                    padding: 16px 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid #3a3a3a;
                    cursor: grab;
                }

                .nw-header:active {
                    cursor: grabbing;
                }

                .nw-header-left {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .nw-logo-text {
                    font-weight: 600;
                    font-size: 16px;
                    color: #fff;
                    letter-spacing: 0.5px;
                }

                .nw-controls button {
                    width: 28px;
                    height: 28px;
                    border: 1px solid #4a4a4a;
                    background: #2a2a2a;
                    color: #b0b0b0;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 16px;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .nw-controls button:hover {
                    background: #3a3a3a;
                    border-color: #5a5a5a;
                    color: #fff;
                }

                .nw-body {
                    display: flex;
                    flex: 1;
                    overflow: hidden;
                }

                .nw-sidebar {
                    width: 80px;
                    background: #2a2a2a;
                    border-right: 1px solid #3a3a3a;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    padding: 12px 0;
                    align-items: center;
                }

                .nw-nav-btn {
                    width: 56px;
                    height: 48px;
                    border: 1px solid #3a3a3a;
                    background: #2a2a2a;
                    color: #b0b0b0;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 20px;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .nw-nav-btn:hover {
                    background: #3a3a3a;
                    border-color: #4a4a4a;
                    color: #fff;
                }

                .nw-nav-btn.active {
                    background: #3a3a3a;
                    border-color: #5a5a5a;
                    color: #fff;
                }

                .nw-content {
                    flex: 1;
                    padding: 24px;
                    overflow-y: auto;
                    background: #1f1f1f;
                }

                .nw-content::-webkit-scrollbar {
                    width: 8px;
                }

                .nw-content::-webkit-scrollbar-track {
                    background: #1f1f1f;
                }

                .nw-content::-webkit-scrollbar-thumb {
                    background: #3a3a3a;
                    border-radius: 4px;
                }

                .nw-content::-webkit-scrollbar-thumb:hover {
                    background: #4a4a4a;
                }

                .menu-section {
                    display: none;
                    animation: fadeIn 0.3s ease-out;
                }

                .menu-section.active {
                    display: block;
                }

                .mode-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 16px;
                    margin-bottom: 24px;
                }

                .mode-card {
                    background: #2a2a2a;
                    border: 1px solid #3a3a3a;
                    border-radius: 8px;
                    padding: 20px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    position: relative;
                }

                .mode-card.locked {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .mode-card.locked::after {
                    content: '';
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    width: 20px;
                    height: 20px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .mode-card:hover:not(.locked) {
                    background: #3a3a3a;
                    border-color: #4a4a4a;
                    transform: translateY(-2px);
                }

                .mode-card.selected {
                    background: #3a3a3a;
                    border-color: #5a5a5a;
                }

                .mode-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 12px;
                }

                .mode-icon {
                    width: 24px;
                    height: 24px;
                    color: #b0b0b0;
                }

                .mode-title {
                    font-size: 14px;
                    font-weight: 600;
                    color: #fff;
                }

                .mode-desc {
                    font-size: 12px;
                    color: #b0b0b0;
                    line-height: 1.4;
                }

                .mode-stats {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 12px;
                    padding-top: 12px;
                    border-top: 1px solid #3a3a3a;
                }

                .mode-stat-item {
                    text-align: center;
                }

                .mode-stat-label {
                    font-size: 10px;
                    color: #b0b0b0;
                    text-transform: uppercase;
                }

                .mode-stat-value {
                    font-size: 16px;
                    font-weight: 700;
                    color: #fff;
                }

                .farm-section {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .farm-info {
                    background: #2a2a2a;
                    border: 1px solid #3a3a3a;
                    border-radius: 8px;
                    padding: 14px;
                    font-size: 13px;
                    color: #b0b0b0;
                    text-align: center;
                }

                .farm-btn {
                    width: 100%;
                    padding: 14px;
                    background: #2a2a2a;
                    border: 1px solid #4a4a4a;
                    color: #fff;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 14px;
                    transition: all 0.2s ease;
                    letter-spacing: 0.5px;
                }

                .farm-btn:hover {
                    background: #3a3a3a;
                    border-color: #5a5a5a;
                }

                .farm-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .farm-btn.farming {
                    background: #2d5a2d;
                    border-color: #3d7a3d;
                }

                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 16px;
                }

                .stat-card {
                    background: #2a2a2a;
                    border: 1px solid #3a3a3a;
                    border-radius: 8px;
                    padding: 20px;
                    text-align: center;
                    transition: all 0.2s ease;
                }

                .stat-card:hover {
                    background: #3a3a3a;
                    border-color: #4a4a4a;
                }

                .stat-icon {
                    width: 24px;
                    height: 24px;
                    margin: 0 auto 8px;
                    color: #b0b0b0;
                }

                .stat-label {
                    font-size: 11px;
                    color: #b0b0b0;
                    text-transform: uppercase;
                    margin-bottom: 6px;
                }

                .stat-value {
                    font-size: 20px;
                    font-weight: 700;
                    color: #fff;
                }

                .settings-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 16px;
                }

                .setting-item {
                    background: #2a2a2a;
                    border: 1px solid #3a3a3a;
                    border-radius: 8px;
                    padding: 16px;
                }

                .setting-label {
                    font-size: 12px;
                    color: #b0b0b0;
                    text-transform: uppercase;
                    margin-bottom: 8px;
                }

                .setting-input {
                    width: 100%;
                    padding: 8px 12px;
                    background: #1f1f1f;
                    border: 1px solid #3a3a3a;
                    border-radius: 4px;
                    color: #fff;
                    font-size: 13px;
                    transition: all 0.2s ease;
                }

                .setting-input:focus {
                    outline: none;
                    border-color: #4a4a4a;
                    background: #2a2a2a;
                }

                .setting-value {
                    color: #b0b0b0;
                    font-size: 12px;
                    margin-top: 4px;
                }

                .license-section {
                    background: #2a2a2a;
                    border: 1px solid #3a3a3a;
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 16px;
                }

                .license-status {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 12px;
                }

                .license-status.active {
                    color: #4ade80;
                }

                .license-status.inactive {
                    color: #f87171;
                }

                .license-input-group {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 8px;
                }

                .license-input {
                    flex: 1;
                    padding: 8px 12px;
                    background: #1f1f1f;
                    border: 1px solid #3a3a3a;
                    border-radius: 4px;
                    color: #fff;
                    font-size: 13px;
                    transition: all 0.2s ease;
                }

                .license-input:focus {
                    outline: none;
                    border-color: #4a4a4a;
                    background: #2a2a2a;
                }

                .license-btn {
                    padding: 8px 16px;
                    background: #3a3a3a;
                    border: 1px solid #4a4a4a;
                    color: #fff;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.2s ease;
                }

                .license-btn:hover {
                    background: #4a4a4a;
                    border-color: #5a5a5a;
                }

                .license-btn.remove {
                    background: #dc2626;
                    border-color: #dc2626;
                }

                .license-btn.remove:hover {
                    background: #b91c1c;
                    border-color: #b91c1c;
                }

                .license-info {
                    font-size: 11px;
                    color: #b0b0b0;
                    line-height: 1.4;
                }

                .message-toast {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 12px 20px;
                    border-radius: 6px;
                    color: #fff;
                    font-size: 13px;
                    z-index: 1000000;
                    animation: slideInRight 0.3s ease-out;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                }

                .message-toast.success {
                    background: #16a34a;
                }

                .message-toast.error {
                    background: #dc2626;
                }

                .message-toast.info {
                    background: #2563eb;
                }

                @keyframes slideInRight {
                    from {
                        opacity: 0;
                        transform: translateX(100px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }

                .info-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 16px;
                }

                .info-item {
                    background: #2a2a2a;
                    border: 1px solid #3a3a3a;
                    border-radius: 8px;
                    padding: 16px;
                }

                .info-label {
                    font-size: 11px;
                    color: #b0b0b0;
                    text-transform: uppercase;
                    margin-bottom: 6px;
                }

                .info-value {
                    font-size: 16px;
                    font-weight: 600;
                    color: #fff;
                }
            `;

            document.head.insertAdjacentHTML('beforeend', `<style>${styles}</style>`);

            container.innerHTML = `
                <div class="nw-header">
                    <div class="nw-header-left">
                        <span class="nw-logo-text">${isActivated ? ICONS.lightning : ICONS.lock} NIGHTWARE HUB</span>
                    </div>
                    <div class="nw-controls">
                        <button class="close-btn">${ICONS.close}</button>
                    </div>
                </div>
                <div class="nw-body">
                    <div class="nw-sidebar">
                        <button class="nw-nav-btn active" data-menu="mode-select" title="Farm">${ICONS.farm}</button>
                        <button class="nw-nav-btn" data-menu="dashboard" title="Stats">${ICONS.stats}</button>
                        <button class="nw-nav-btn" data-menu="settings" title="Settings">${ICONS.settings}</button>
                        <button class="nw-nav-btn" data-menu="info" title="Info">${ICONS.info}</button>
                    </div>
                    <div class="nw-content">
                        <!-- Mode Select -->
                        <div class="menu-section active" data-section="mode-select">
                            <div class="license-section">
                                <div class="license-status ${isActivated ? 'active' : 'inactive'}">
                                    ${isActivated ? ICONS.unlock : ICONS.lock}
                                    <span>${isActivated ? 'License Activated' : 'License Required'}</span>
                                </div>
                                <div class="license-input-group">
                                    <input type="text" class="license-input" id="license-input" placeholder="Enter license key..." value="${LICENSE.formatKey(licenseKey)}">
                                    <button class="license-btn" id="license-activate-btn">Activate</button>
                                    ${isActivated ? `<button class="license-btn remove" id="license-remove-btn">Remove</button>` : ''}
                                </div>
                                <div class="license-info">
                                    License keys are required to use farming features. Contact administrator for access.
                                </div>
                            </div>

                            <div class="mode-grid">
                                <div class="mode-card ${!isActivated ? 'locked' : ''}" data-mode="gems">
                                    <div class="mode-header">
                                        <span class="mode-icon">${ICONS.gems}</span>
                                        <div>
                                            <div class="mode-title">Gems</div>
                                            <div class="mode-desc">Farm virtual currency</div>
                                        </div>
                                    </div>
                                    <div class="mode-stats">
                                        <div class="mode-stat-item">
                                            <div class="mode-stat-label">Earned</div>
                                            <div class="mode-stat-value" data-gems>0</div>
                                        </div>
                                    </div>
                                    ${!isActivated ? `<div style="position: absolute; top: 10px; right: 10px;">${ICONS.lock}</div>` : ''}
                                </div>
                                <div class="mode-card ${!isActivated ? 'locked' : ''}" data-mode="xp">
                                    <div class="mode-header">
                                        <span class="mode-icon">${ICONS.xp}</span>
                                        <div>
                                            <div class="mode-title">XP</div>
                                            <div class="mode-desc">Increase experience</div>
                                        </div>
                                    </div>
                                    <div class="mode-stats">
                                        <div class="mode-stat-item">
                                            <div class="mode-stat-label">Earned</div>
                                            <div class="mode-stat-value" data-xp>0</div>
                                        </div>
                                    </div>
                                    ${!isActivated ? `<div style="position: absolute; top: 10px; right: 10px;">${ICONS.lock}</div>` : ''}
                                </div>
                                <div class="mode-card ${!isActivated ? 'locked' : ''}" data-mode="streak">
                                    <div class="mode-header">
                                        <span class="mode-icon">${ICONS.streak}</span>
                                        <div>
                                            <div class="mode-title">Streak</div>
                                            <div class="mode-desc">Maintain daily streak</div>
                                        </div>
                                    </div>
                                    <div class="mode-stats">
                                        <div class="mode-stat-item">
                                            <div class="mode-stat-label">Earned</div>
                                            <div class="mode-stat-value" data-streak>0</div>
                                        </div>
                                    </div>
                                    ${!isActivated ? `<div style="position: absolute; top: 10px; right: 10px;">${ICONS.lock}</div>` : ''}
                                </div>
                                <div class="mode-card ${!isActivated ? 'locked' : ''}" data-mode="combo">
                                    <div class="mode-header">
                                        <span class="mode-icon">${ICONS.combo}</span>
                                        <div>
                                            <div class="mode-title">Combo</div>
                                            <div class="mode-desc">Farm all at once</div>
                                        </div>
                                    </div>
                                    <div class="mode-stats">
                                        <div class="mode-stat-item">
                                            <div class="mode-stat-label">All In</div>
                                            <div class="mode-stat-value">∞</div>
                                        </div>
                                    </div>
                                    ${!isActivated ? `<div style="position: absolute; top: 10px; right: 10px;">${ICONS.lock}</div>` : ''}
                                </div>
                            </div>
                            <div class="farm-section">
                                <div class="farm-info" id="mode-info">${isActivated ? 'Select a mode to start' : 'Please activate license key to use features'}</div>
                                <button class="farm-btn" id="farm-btn" ${!isActivated ? 'disabled' : ''}>${isActivated ? 'Select mode first' : 'License Required'}</button>
                            </div>
                        </div>

                        <!-- Dashboard -->
                        <div class="menu-section" data-section="dashboard">
                            <div class="stats-grid">
                                <div class="stat-card">
                                    <div class="stat-icon">${ICONS.gems}</div>
                                    <div class="stat-label">Gems</div>
                                    <div class="stat-value" id="gems-val">0</div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-icon">${ICONS.xp}</div>
                                    <div class="stat-label">XP</div>
                                    <div class="stat-value" id="xp-val">0</div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-icon">${ICONS.streak}</div>
                                    <div class="stat-label">Streak</div>
                                    <div class="stat-value" id="streak-val">0</div>
                                </div>
                            </div>
                        </div>

                        <!-- Settings -->
                        <div class="menu-section" data-section="settings">
                            <div class="settings-grid">
                                <div class="setting-item">
                                    <div class="setting-label">Gem Delay (ms)</div>
                                    <input type="number" class="setting-input" id="gem-delay" value="250" min="50" max="5000" step="50">
                                    <div class="setting-value" id="gem-delay-val">250ms</div>
                                </div>
                                <div class="setting-item">
                                    <div class="setting-label">XP Delay (ms)</div>
                                    <input type="number" class="setting-input" id="xp-delay" value="2000" min="500" max="10000" step="100">
                                    <div class="setting-value" id="xp-delay-val">2000ms</div>
                                </div>
                                <div class="setting-item">
                                    <div class="setting-label">Streak Delay (ms)</div>
                                    <input type="number" class="setting-input" id="streak-delay" value="40" min="20" max="500" step="10">
                                    <div class="setting-value" id="streak-delay-val">40ms</div>
                                </div>
                                <div class="setting-item">
                                    <div class="setting-label">Hotkey</div>
                                    <input type="text" class="setting-input" id="hotkey-input" value="${CONFIG.HOTKEY}" readonly>
                                    <div class="setting-value">Press key to change</div>
                                </div>
                            </div>
                        </div>

                        <!-- Info -->
                        <div class="menu-section" data-section="info">
                            <div class="info-grid">
                                <div class="info-item">
                                    <div class="info-label">Username</div>
                                    <div class="info-value" id="username-info">-</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-label">Total XP</div>
                                    <div class="info-value" id="totalxp-info">0</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-label">Current Streak</div>
                                    <div class="info-value" id="currentstreak-info">0</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-label">License Status</div>
                                    <div class="info-value" id="license-info">${isActivated ? 'Activated' : 'Not Activated'}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(container);
            this.setupEvents(container);
            this.makeDraggable(container);
        },

        showMessage(message, type = 'info') {
            const toast = document.createElement('div');
            toast.className = `message-toast ${type}`;
            toast.textContent = message;
            document.body.appendChild(toast);

            setTimeout(() => {
                toast.style.animation = 'slideOut 0.3s ease-out forwards';
                setTimeout(() => {
                    document.body.removeChild(toast);
                }, 300);
            }, 3000);
        },

        setupEvents(container) {
            container.querySelector('.close-btn').onclick = () => {
                this.hideUI();
            };

            // License events
            const licenseInput = container.querySelector('#license-input');
            const activateBtn = container.querySelector('#license-activate-btn');
            const removeBtn = container.querySelector('#license-remove-btn');

            if (activateBtn) {
                activateBtn.onclick = async () => {
                    const key = licenseInput.value.trim();
                    activateBtn.disabled = true;
                    activateBtn.textContent = 'Checking...';

                    if (await LICENSE.saveKey(key)) {
                        this.showMessage('License activated successfully!', 'success');
                        this.updateLicenseUI();
                    } else {
                        this.showMessage('Invalid license key!', 'error');
                    }

                    activateBtn.disabled = false;
                    activateBtn.textContent = 'Activate';
                };
            }

            if (removeBtn) {
                removeBtn.onclick = () => {
                    if (confirm('Are you sure you want to remove the license key?')) {
                        LICENSE.removeKey();
                        this.showMessage('License key removed', 'info');
                        this.updateLicenseUI();
                    }
                };
            }

            container.querySelectorAll('.nw-nav-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const menu = btn.dataset.menu;
                    this.switchMenu(menu);
                };
            });

            container.querySelectorAll('.mode-card').forEach(card => {
                card.onclick = (e) => {
                    e.stopPropagation();

                    if (!isActivated) {
                        this.showMessage('Please activate your license key first!', 'error');
                        return;
                    }

                    const mode = card.dataset.mode;
                    selectedMode = mode;
                    this.selectMode(mode);
                };
            });

            const farmBtn = container.querySelector('#farm-btn');
            farmBtn.onclick = (e) => {
                e.stopPropagation();
                if (activeTask) {
                    farming.stop();
                } else if (selectedMode && isActivated) {
                    activeTask = selectedMode;
                    if (selectedMode === 'combo') {
                        farming.gems();
                        farming.xp();
                        farming.streak();
                    } else {
                        farming[selectedMode]();
                    }
                    this.updateUI();
                } else if (!isActivated) {
                    this.showMessage('Please activate your license key first!', 'error');
                }
            };

            const settingsInputs = {
                'gem-delay': 'GEM_DELAY',
                'xp-delay': 'XP_DELAY',
                'streak-delay': 'STREAK_DELAY'
            };

            Object.entries(settingsInputs).forEach(([id, configKey]) => {
                const input = container.querySelector(`#${id}`);
                const valueDisplay = container.querySelector(`#${id}-val`);
                input.onchange = (e) => {
                    const val = parseInt(e.target.value);
                    CONFIG[configKey] = val;
                    valueDisplay.textContent = `${val}ms`;
                };
                input.oninput = (e) => {
                    const val = parseInt(e.target.value);
                    valueDisplay.textContent = `${val}ms`;
                };
            });

            const hotkeyInput = container.querySelector('#hotkey-input');
            hotkeyInput.onclick = () => {
                hotkeyInput.value = 'Press new key...';
                hotkeyInput.style.background = '#3a3a3a';

                const handleKeyDown = (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    let keyName = '';
                    if (e.key === 'F1' || e.key === 'F2' || e.key === 'F3' || e.key === 'F4' ||
                        e.key === 'F5' || e.key === 'F6' || e.key === 'F7' || e.key === 'F8' ||
                        e.key === 'F9' || e.key === 'F10' || e.key === 'F11' || e.key === 'F12') {
                        keyName = e.key;
                    } else if (e.ctrlKey && e.key === 's') {
                        keyName = 'Ctrl+S';
                    } else if (e.ctrlKey && e.key === 'd') {
                        keyName = 'Ctrl+D';
                    } else if (e.key.length === 1) {
                        keyName = e.key.toUpperCase();
                    }

                    if (keyName) {
                        CONFIG.HOTKEY = keyName;
                        hotkeyInput.value = keyName;
                        hotkeyInput.style.background = '#1f1f1f';
                        this.setupHotkey();
                        document.removeEventListener('keydown', handleKeyDown, true);
                    }
                };

                document.addEventListener('keydown', handleKeyDown, true);
            };
        },

        updateLicenseUI() {
            const container = document.getElementById('nightware-hub');
            if (!container) return;

            // Update tab icon
            if (tabElement) {
                tabElement.innerHTML = isActivated ? ICONS.lightning : ICONS.lock;
            }

            // Update logo
            const logoText = container.querySelector('.nw-logo-text');
            if (logoText) {
                logoText.innerHTML = `${isActivated ? ICONS.lightning : ICONS.lock} NIGHTWARE HUB`;
            }

            // Update license section
            const licenseStatus = container.querySelector('.license-status');
            const licenseInput = container.querySelector('#license-input');
            const activateBtn = container.querySelector('#license-activate-btn');
            const removeBtn = container.querySelector('#license-remove-btn');
            const modeInfo = container.querySelector('#mode-info');
            const farmBtn = container.querySelector('#farm-btn');

            if (licenseStatus) {
                licenseStatus.className = `license-status ${isActivated ? 'active' : 'inactive'}`;
                licenseStatus.innerHTML = `
                    ${isActivated ? ICONS.unlock : ICONS.lock}
                    <span>${isActivated ? 'License Activated' : 'License Required'}</span>
                `;
            }

            if (licenseInput) {
                licenseInput.value = LICENSE.formatKey(licenseKey);
            }

            if (activateBtn) {
                activateBtn.style.display = isActivated ? 'none' : 'block';
            }

            if (removeBtn) {
                removeBtn.style.display = isActivated ? 'block' : 'none';
            }

            if (modeInfo) {
                modeInfo.textContent = isActivated ? 'Select a mode to start' : 'Please activate license key to use features';
            }

            if (farmBtn) {
                farmBtn.disabled = !isActivated;
                farmBtn.textContent = isActivated ? 'Select mode first' : 'License Required';
            }

            // Update mode cards
            container.querySelectorAll('.mode-card').forEach(card => {
                const lockIcon = card.querySelector('.lock-icon');
                if (isActivated) {
                    card.classList.remove('locked');
                    if (lockIcon) lockIcon.remove();
                } else {
                    card.classList.add('locked');
                    if (!lockIcon) {
                        const lockDiv = document.createElement('div');
                        lockDiv.className = 'lock-icon';
                        lockDiv.style.cssText = 'position: absolute; top: 10px; right: 10px;';
                        lockDiv.innerHTML = ICONS.lock;
                        card.appendChild(lockDiv);
                    }
                }
            });

            // Update info section
            const licenseInfo = container.querySelector('#license-info');
            if (licenseInfo) {
                licenseInfo.textContent = isActivated ? 'Activated' : 'Not Activated';
            }
        },

        setupHotkey() {
            document.removeEventListener('keydown', this.hotkeyHandler);

            this.hotkeyHandler = (e) => {
                if (CONFIG.HOTKEY.startsWith('F') && e.key === CONFIG.HOTKEY) {
                    e.preventDefault();
                    this.toggleUI();
                } else if (CONFIG.HOTKEY.startsWith('Ctrl+') && e.ctrlKey && e.key === CONFIG.HOTKEY.substring(5)) {
                    e.preventDefault();
                    this.toggleUI();
                } else if (CONFIG.HOTKEY.length === 1 && e.key.toUpperCase() === CONFIG.HOTKEY) {
                    e.preventDefault();
                    this.toggleUI();
                }
            };

            document.addEventListener('keydown', this.hotkeyHandler);
        },

        toggleUI() {
            const container = document.getElementById('nightware-hub');
            if (isUIVisible) {
                this.hideUI();
            } else {
                this.showUI();
            }
        },

        showUI() {
            const container = document.getElementById('nightware-hub');
            container.style.display = 'flex';

            setTimeout(() => {
                container.classList.add('show');
                container.classList.remove('hide');
            }, 10);

            isUIVisible = true;

            if (tabElement) {
                tabElement.style.opacity = '0.3';
            }
        },

        hideUI() {
            const container = document.getElementById('nightware-hub');
            container.classList.add('hide');
            container.classList.remove('show');

            setTimeout(() => {
                container.style.display = 'none';
            }, 300);

            isUIVisible = false;

            if (tabElement) {
                tabElement.style.opacity = '1';
            }
        },

        selectMode(mode) {
            const container = document.getElementById('nightware-hub');
            container.querySelectorAll('.mode-card').forEach(card => {
                card.classList.toggle('selected', card.dataset.mode === mode);
            });

            const modeDescriptions = {
                gems: 'Gems mode - Click to start',
                xp: 'XP mode - Click to start',
                streak: 'Streak mode - Click to start',
                combo: 'Combo mode - Click to start'
            };

            document.getElementById('mode-info').textContent = modeDescriptions[mode];
            const farmBtn = document.getElementById('farm-btn');
            farmBtn.disabled = false;
            farmBtn.textContent = 'Start Farming';
        },

        switchMenu(menu) {
            const container = document.getElementById('nightware-hub');
            container.querySelectorAll('.nw-nav-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.menu === menu);
            });
            container.querySelectorAll('.menu-section').forEach(section => {
                section.classList.toggle('active', section.dataset.section === menu);
            });
        },

        updateUI() {
            const container = document.getElementById('nightware-hub');
            const farmBtn = container.querySelector('#farm-btn');

            if (activeTask) {
                farmBtn.classList.add('farming');
                farmBtn.textContent = 'Farming... (Click to stop)';
            } else {
                farmBtn.classList.remove('farming');
                if (selectedMode) {
                    farmBtn.textContent = 'Start Farming';
                } else {
                    farmBtn.textContent = isActivated ? 'Select mode first' : 'License Required';
                }
            }
        },

        updateStats() {
            if (!userInfo) return;

            const modeContainer = document.querySelector('.menu-section[data-section="mode-select"]');
            if (modeContainer) {
                const gemsCard = modeContainer.querySelector('[data-gems]');
                const xpCard = modeContainer.querySelector('[data-xp]');
                const streakCard = modeContainer.querySelector('[data-streak]');

                if (gemsCard) gemsCard.textContent = (stats.gems || 0).toLocaleString();
                if (xpCard) xpCard.textContent = (stats.xp || 0).toLocaleString();
                if (streakCard) streakCard.textContent = (stats.streak || 0).toLocaleString();
            }

            document.getElementById('gems-val').textContent = (userInfo.gems || 0).toLocaleString();
            document.getElementById('xp-val').textContent = (userInfo.totalXp || 0).toLocaleString();
            document.getElementById('streak-val').textContent = (userInfo.streak || 0).toLocaleString();

            document.getElementById('username-info').textContent = userInfo.username || '-';
            document.getElementById('totalxp-info').textContent = (userInfo.totalXp || 0).toLocaleString();
            document.getElementById('currentstreak-info').textContent = (userInfo.streak || 0).toLocaleString();
            document.getElementById('license-info').textContent = isActivated ? 'Activated' : 'Not Activated';
        },

        makeDraggable(element) {
            const header = element.querySelector('.nw-header');
            let isDragging = false;
            let startX = 0;
            let startY = 0;
            let initialX = 0;
            let initialY = 0;

            const dragStart = (e) => {
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;

                const rect = element.getBoundingClientRect();
                initialX = rect.left;
                initialY = rect.top;

                element.classList.add('dragging');
                element.style.position = 'fixed';
                element.style.left = initialX + 'px';
                element.style.top = initialY + 'px';
                element.style.right = 'auto';
                element.style.bottom = 'auto';

                document.addEventListener('mousemove', dragMove);
                document.addEventListener('mouseup', dragEnd);

                e.preventDefault();
            };

            const dragMove = (e) => {
                if (!isDragging) return;

                e.preventDefault();

                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;

                let newX = initialX + deltaX;
                let newY = initialY + deltaY;

                // Limit within viewport
                const maxX = window.innerWidth - element.offsetWidth;
                const maxY = window.innerHeight - element.offsetHeight;

                newX = Math.max(0, Math.min(newX, maxX));
                newY = Math.max(0, Math.min(newY, maxY));

                element.style.left = newX + 'px';
                element.style.top = newY + 'px';
            };

            const dragEnd = () => {
                isDragging = false;
                element.classList.remove('dragging');

                document.removeEventListener('mousemove', dragMove);
                document.removeEventListener('mouseup', dragEnd);
            };

            header.addEventListener('mousedown', dragStart);
        }
    };

    const init = async () => {
        if (!location.hostname.includes('duolingo.com')) return;

        jwt = utils.getJWT();
        if (!jwt) return;

        const decoded = utils.decodeJWT(jwt);
        if (!decoded) return;

        sub = decoded.sub;
        headers = utils.formatHeaders(jwt);

        try {
            userInfo = await api.getUserInfo();
            ui.create();
            ui.updateStats();
        } catch (error) {
            console.error('Nightware Hub init failed:', error);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 1000);
    }
})();
