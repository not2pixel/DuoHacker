// ==UserScript==
// @name         DuoRain
// @namespace    http://tampermonkey.net/
// @version      4.0.BETA
// @description  Duolingo XP farming, Gems farming, Streak farming, Auto-Quest and Auto-Solver Tool.
// @author       OracleMythix
// @license      MIT
// @match        https://*.duolingo.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      duolingo.com
// @connect      stories.duolingo.com
// @connect      goals-api.duolingo.com
// @run-at       document-start
// ==/UserScript==
 
(function() {
'use strict';
 
const MODIFIER_KEY = 'duoRainModifierEnabledV41';
const AUTO_CLICK_KEY = 'duoRainAutoClickEnabledV41';
const SOLVER_SESSION_KEY = 'duoRainSolverSessionV41';
const RELOAD_FLAG = 'duoRainReloaded';
sessionStorage.removeItem(RELOAD_FLAG);
 
function injectNetworkInterceptor() {
    const script = document.createElement('script');
    script.id = 'duorain-network-interceptor';
    script.textContent = `
    (() => {
        const MODIFIER_KEY = '${MODIFIER_KEY}';
        const LESSON_CHALLENGE_CONTENT = { "passage": "DuoRain Lesson Automation", "question": "Join DuoRain Discord Server.", "choices": ["DuoRain"], "correctIndex": 0, "type": "readComprehension" };
        const STORY_HEADER_CONTENT = { "text": "DuoRain", "hints": ["Join", "DuoRain Discord Server"] };
        const originalFetch = window.fetch;
 
        window.fetch = async (...args) => {
            const request = new Request(args[0], args[1]);
            if (sessionStorage.getItem(MODIFIER_KEY) !== 'true') return originalFetch(request);
 
            if (request.url.includes('stories.duolingo.com/api2/stories/')) {
                try {
                    const response = await originalFetch(request);
                    if (!response.ok) return response;
                    const data = await response.json();
                    if (data.elements && data.elements.length > 0) {
                        const storyHeader = { ...data.elements[0] };
                        storyHeader.learningLanguageTitleContent = { ...storyHeader.learningLanguageTitleContent, ...STORY_HEADER_CONTENT };
                        data.elements = [storyHeader];
                    }
                    return new Response(JSON.stringify(data), { status: response.status, headers: response.headers });
                } catch (e) {console.error("DuoRain Interceptor Error (Stories):", e);}
            }
            else if (request.url.includes('/2017-06-30/sessions') && request.method === 'POST') {
                try {
                    const requestBody = await request.clone().json();
                    const response = await originalFetch(request);
                    if (!response.ok) return response;
                    const data = await response.json();
 
                    if (requestBody.type === 'DUORADIO' || requestBody.type === 'PRACTICE_HUB_TAB_AUDIO_PLAYER') {
                        if (data.elements) {
                             data.elements = [{ type: "challenge", challengeType: "select", prompt: "Join DuoRain Discord!", choices: ["Sure!"], correctIndex: 0 }];
                        }
                    }
                    else if (data.challenges) {
                        const isLegendary = window.location.href.includes('/legendary');
                        let newChallenges = [];
 
                        const buildNewChallenge = (originalChallenge) => ({ ...originalChallenge, ...LESSON_CHALLENGE_CONTENT });
 
                        if (isLegendary && data.challenges.length >= 2) {
                            newChallenges.push(buildNewChallenge(data.challenges[0]));
                            newChallenges.push(buildNewChallenge(data.challenges[1]));
                        } else if (data.challenges.length > 0) {
                            newChallenges.push(buildNewChallenge(data.challenges[0]));
                        } else {
                            newChallenges = data.challenges;
                        }
                        data.challenges = newChallenges;
                        if (data.adaptiveChallenges) data.adaptiveChallenges = [];
                    }
                    return new Response(JSON.stringify(data), { status: response.status, headers: response.headers });
                } catch (e) {console.error("DuoRain Interceptor Error (Sessions):", e);}
            }
            return originalFetch(request);
        };
    })();
    `;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
}
 
let isUiHidden = false;
let isAnimating = false;
let settings = {};
let loopDelay = 200;
const raindrops = [];
 
function loadSettings() {
    try {
        const stored = localStorage.getItem('duorain_settings');
        if (stored) {
            settings = JSON.parse(stored);
            if (!Array.isArray(settings.pins)) settings.pins = ['xp', 'gem'];
            if (!Array.isArray(settings.solverPins)) settings.solverPins = ['path-solve', 'practice-solve'];
            if (typeof settings.loopDelay !== 'number' || settings.loopDelay < 0) {
                settings.loopDelay = 200;
            }
             if (typeof settings.easySolve !== 'boolean') settings.easySolve = false;
        } else {
            settings = { pins: ['xp', 'gem'], solverPins: ['path-solve', 'practice-solve'], loopDelay: 200, easySolve: false };
        }
    } catch(e) {
        settings = { pins: ['xp', 'gem'], solverPins: ['path-solve', 'practice-solve'], loopDelay: 200, easySolve: false };
    }
    loopDelay = settings.loopDelay;
}
 
function saveSettings() {
    localStorage.setItem('duorain_settings', JSON.stringify(settings));
}
 
function getJwtToken() {
    try {
        const jwtMatch = document.cookie.match(/(?:^|;\s*)jwt_token=([^;]*)/);
        return jwtMatch ? jwtMatch[1] : null;
    } catch (e) { console.error("DuoRain Error: Failed to get JWT token.", e); return null; }
}
 
function parseJwt(token) {
    if (!token) return null;
    try {
        const payload = token.split('.')[1];
        const decodedPayload = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
        return JSON.parse(decodedPayload);
    } catch (e) { console.error("DuoRain Error: Failed to parse JWT.", e); return null; }
}
 
function injectUI() {
    const uiHTML = `
        <div id="duorain-ui-wrapper" class="DLP_Main">
            <div class="DLP_HStack_8" style="align-self: flex-end;">
                 <div class="DLP_Button_Style_1 DLP_Magnetic_Hover_1 DLP_NoSelect" id="duorain-solver-button">
                    <span id="solver-state-auto" class="duorain-button-state">
                       <svg class="open-svg" width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4m-8-2 8-8m0 0v5m0-5h-5"/></svg>
                       <p class="DLP_Text_Style_1 duorain-neon-glow">Auto-Solver</p>
                    </span>
                     <span id="solver-state-4-0" class="duorain-button-state" style="display: none;">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1.091 -2.182 24 29.455" xml:space="preserve"><defs><filter id="back-rain" x="-50%" y="-50%" width="200%" height="200%"><feFlood flood-color="hsl(210, 100%, 50%)" result="flood"/><feComposite in="flood" in2="SourceGraphic" operator="in" result="comp"/><feGaussianBlur in="comp" stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><path d="M6.268 1.13a.34.34 0 0 0-.252.068L.132 5.756v-.001l-.02.021-.022.022a.3.3 0 0 0-.065.097v.001a.3.3 0 0 0-.023.118L0 6.027l.002.013a.3.3 0 0 0 .024.118v.001q.024.054.065.096.01.012.022.022l.02.021 5.884 4.557a.341.341 0 1 0 .418-.539L1.338 6.367l12.991.001c3.777 0 6.806 3.036 6.806 6.822s-3.029 6.818-6.806 6.818l-9.11.001a.34.34 0 0 0-.242.1.34.34 0 0 0-.1.242.34.34 0 0 0 .343.34h9.11c4.143-.001 7.488-3.351 7.488-7.502s-3.345-7.504-7.489-7.504H1.34l5.095-3.948a.34.34 0 0 0 .06-.478.34.34 0 0 0-.227-.128z" fill="hsl(210, 100%, 50%)" style="filter:url(#back-rain)" stroke="hsl(210, 100%, 50%)" stroke-width="1.5" stroke-linejoin="round"/></svg>
<p class="DLP_Text_Style_1 duorain-neon-glow">4.0</p>
</span>
                    </div>
                    <div class="DLP_Button_Style_1 DLP_Magnetic_Hover_1 DLP_NoSelect" id="duorain-hide-button" style="outline: 2px solid rgba(0, 0, 0, 0.2); outline-offset: -2px; background: rgb(0, 122, 255); flex: none; backdrop-filter: blur(16px);">
                        <svg id="hide-icon" width="23" height="16" viewBox="0 0 23 16" fill="#FFF" xmlns="http://www.w3.org/2000/svg"><path d="M17.7266 14.9922L4.1875 1.47656C3.9375 1.22656 3.9375 0.796875 4.1875 0.546875C4.44531 0.289062 4.875 0.289062 5.125 0.546875L18.6562 14.0625C18.9141 14.3203 18.9219 14.7188 18.6562 14.9922C18.3984 15.2578 17.9844 15.25 17.7266 14.9922ZM18.4609 12.4062L15.3281 9.25781C15.5 8.82812 15.5938 8.35938 15.5938 7.875C15.5938 5.57812 13.7266 3.74219 11.4375 3.74219C10.9531 3.74219 10.4922 3.83594 10.0547 3.99219L7.75 1.67969C8.875 1.3125 10.1016 1.09375 11.4297 1.09375C17.8984 1.09375 22.1172 6.28906 22.1172 7.875C22.1172 8.78125 20.7344 10.8438 18.4609 12.4062ZM11.4297 14.6562C5.05469 14.6562 0.75 9.45312 0.75 7.875C0.75 6.96094 2.16406 4.85938 4.54688 3.27344L7.59375 6.32812C7.39062 6.79688 7.27344 7.32812 7.27344 7.875C7.28125 10.1172 9.13281 12.0078 11.4375 12.0078C11.9766 12.0078 12.4922 11.8906 12.9609 11.6875L15.2812 14.0078C14.125 14.4141 12.8281 14.6562 11.4297 14.6562ZM13.9609 7.71094C13.9609 7.77344 13.9609 7.82812 13.9531 7.88281L11.3203 5.25781C11.375 5.25 11.4375 5.25 11.4922 5.25C12.8594 5.25 13.9609 6.35156 13.9609 7.71094ZM8.88281 7.82031C8.88281 7.75781 8.88281 7.6875 8.89062 7.625L11.5391 10.2734C11.4766 10.2812 11.4219 10.2891 11.3594 10.2891C10 10.2891 8.88281 9.17969 8.88281 7.82031Z"></path></svg>
                        <svg id="show-icon" width="22" height="14" viewBox="0 0 22 14" xmlns="http://www.w3.org/2000/svg" style="display: none;"><path d="M11.2734 13.6406C4.89844 13.6406 0.59375 8.4375 0.59375 6.85156C0.59375 5.27344 4.90625 0.078125 11.2734 0.078125C17.75 0.078125 21.9688 5.27344 21.9688 6.85156C21.9688 8.4375 17.75 13.6406 11.2734 13.6406ZM11.2812 11.0078C13.5781 11.0078 15.4375 9.14844 15.4375 6.85938C15.4375 4.5625 13.5781 2.70312 11.2812 2.70312C8.98438 2.70312 7.125 4.5625 7.125 6.85938C7.125 9.14844 8.98438 11.0078 11.2812 11.0078ZM11.2812 8.49219C10.375 8.49219 9.64844 7.76562 9.64844 6.85938C9.64844 5.95312 10.375 5.22656 11.2812 5.22656C12.1875 5.22656 12.9141 5.95312 12.9141 6.85938C12.9141 7.76562 12.1875 8.49219 11.2812 8.49219Z"></path></svg>
                        <p id="hide-show-text" class="DLP_Text_Style_1" style="color: #FFF;">Hide</p>
                    </div>
                </div>
                <div id="duorain-main-container" class="DLP_Main_Box">
                    <div id="duorain-main-page" class="duorain-page">
                        <div class="DLP_VStack_8">
                           <div class="DLP_HStack_Auto_Top DLP_NoSelect">
                                <div class="DLP_HStack_4">
                                    <p class="DLP_Text_Style_2">Duo<span class="duorain-neon-blue">Rain</span></p>
                                </div>
                                <p class="DLP_Text_Style_1" style="margin-top: 2px; font-size: 14px; color: #FF9500;">BETA</p>
                            </div>
                            <div class="DLP_HStack_8" style="margin-bottom: 8px;">
                               <div id="duorain-status-indicator" class="DLP_Button_Style_1 DLP_Magnetic_Hover_1 DLP_NoSelect idle">
                                    <div id="duorain-rain-container"></div>
                                    <p id="duorain-status-indicator-text" class="DLP_Text_Style_1">Status: Idle</p>
                               </div>
                               <div class="DLP_HStack_4" style="flex: none; gap: 8px;">
                                   <div id="duorain-settings-button" class="duorain-icon-button DLP_Button_Style_1 DLP_Magnetic_Hover_1 DLP_NoSelect">
                                     <svg viewBox="0 0 90 90" class="duorain-settings-svg"><path d="M 31.018 18.844 L 31.018 18.844 c -2.967 -1.229 -2.967 -5.431 0 -6.66 l 0 0 c 0.421 -0.174 0.621 -0.657 0.447 -1.078 L 29.91 7.352 c -0.174 -0.421 -0.657 -0.621 -1.078 -0.447 l 0 0 c -2.967 1.229 -5.938 -1.743 -4.709 -4.709 l 0 0 c 0.174 -0.421 -0.026 -0.904 -0.447 -1.078 l -3.754 -1.555 c -0.421 -0.174 -0.904 0.026 -1.078 0.447 c -1.229 2.967 -5.431 2.967 -6.66 0 c -0.174 -0.421 -0.657 -0.621 -1.078 -0.447 L 7.352 1.117 C 6.931 1.292 6.731 1.775 6.905 2.196 c 1.229 2.967 -1.743 5.938 -4.71 4.71 C 1.775 6.731 1.292 6.931 1.117 7.352 l -1.555 3.753 c -0.174 0.421 0.026 0.904 0.447 1.078 l 0 0 c 2.967 1.229 2.967 5.431 0 6.66 l 0 0 c -0.421 0.174 -0.621 0.657 -0.447 1.078 l 1.555 3.753 c 0.174 0.421 0.657 0.621 1.078 0.447 l 0 0 c 2.967 -1.229 5.938 1.743 4.709 4.71 l 0 0 C 6.73 29.253 6.93 29.736 7.351 29.91 l 3.753 1.555 c 0.421 0.174 0.904 -0.026 1.078 -0.447 l 0 0 c 1.229 -2.967 5.431 -2.967 6.66 0 l 0 0 c 0.174 0.421 0.657 0.621 1.078 0.447 l 3.753 -1.555 c 0.421 -0.174 0.621 -0.657 0.447 -1.078 l 0 0 c -1.229 -2.967 1.743 -5.938 4.71 -4.709 c 0.421 0.174 0.904 -0.026 1.078 -0.447 l 1.555 -3.753 C 31.639 19.501 31.439 19.018 31.018 18.844 z M 15.514 22.294 c -3.744 0 -6.78 -3.036 -6.78 -6.78 s 3.036 -6.78 6.78 -6.78 s 6.78 3.036 6.78 6.78 S 19.258 22.294 15.514 22.294 z" transform="matrix(2.81 0 0 2.81 1.4065934065934016 1.4065934016)"/></svg>
                                   </div>
                                    <div id="DLP_Main_Discord_Button_1_ID" class="duorain-icon-button DLP_Button_Style_1 DLP_Magnetic_Hover_1 DLP_NoSelect">
                                        <svg width="22" height="16" viewBox="0 0 22 16" fill="#FFF" xmlns="http://www.w3.org/2000/svg"><path d="M18.289 1.34C16.9296 0.714 15.4761 0.259052 13.9565 0C13.7699 0.332095 13.5519 0.77877 13.4016 1.1341C11.7862 0.894993 10.1857 0.894993 8.60001 1.1341C8.44972 0.77877 8.22674 0.332095 8.03844 0C6.51721 0.259052 5.06204 0.715671 3.70267 1.34331C0.960812 5.42136 0.21754 9.39811 0.589177 13.3184C2.40772 14.655 4.17011 15.467 5.90275 15.9984C6.33055 15.4189 6.71209 14.8028 7.04078 14.1536C6.41478 13.9195 5.81521 13.6306 5.24869 13.2952C5.39898 13.1856 5.546 13.071 5.68803 12.9531C9.14342 14.5438 12.8978 14.5438 16.3119 12.9531C16.4556 13.071 16.6026 13.1856 16.7512 13.2952C16.183 13.6322 15.5818 13.9211 14.9558 14.1553C15.2845 14.8028 15.6644 15.4205 16.0939 16C17.8282 15.4687 19.5922 14.6567 21.4107 13.3184C21.8468 8.77378 20.6658 4.83355 18.289 1.34ZM7.51153 10.9075C6.47426 10.9075 5.62361 9.95435 5.62361 8.7937C5.62361 7.63305 6.45609 6.67831 7.51153 6.67831C8.56699 6.67831 9.41761 7.63138 9.39945 8.7937C9.40109 9.95435 8.56699 10.9075 7.51153 10.9075ZM14.4884 10.9075C13.4511 10.9075 12.6005 9.95435 12.6005 8.7937C12.6005 7.63305 13.4329 6.67831 14.4884 6.67831C15.5438 6.67831 16.3945 7.63138 16.3763 8.7937C16.3763 9.95435 15.5438 10.9075 14.4884 10.9075Z"></path></svg>
                                   </div>
                                   <div id="DLP_Main_GitHub_Button_1_ID" class="duorain-icon-button DLP_Button_Style_1 DLP_Magnetic_Hover_1 DLP_NoSelect">
                                     <svg width="22" height="22" viewBox="0 0 22 22" fill="#FFF" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M11.0087 0.5C5.19766 0.5 0.5 5.3125 0.5 11.2662C0.5 16.0253 3.50995 20.0538 7.68555 21.4797C8.2076 21.5868 8.39883 21.248 8.39883 20.963C8.39883 20.7134 8.38162 19.8578 8.38162 18.9664C5.45836 19.6082 4.84962 17.683 4.84962 17.683C4.37983 16.4353 3.68375 16.1146 3.68375 16.1146C2.72697 15.4551 3.75345 15.4551 3.75345 15.4551C4.81477 15.5264 5.37167 16.5602 5.37167 16.5602C6.31103 18.1999 7.82472 17.7366 8.43368 17.4514C8.52058 16.7562 8.79914 16.2749 9.09491 16.0076C6.7634 15.758 4.31035 14.8312 4.31035 10.6957C4.31035 9.51928 4.72765 8.55678 5.38888 7.80822C5.28456 7.54091 4.9191 6.43556 5.49342 4.95616C5.49342 4.95616 6.38073 4.67091 8.38141 6.06128C9.23797 5.82561 10.1213 5.70573 11.0087 5.70472C11.896 5.70472 12.8005 5.82963 13.6358 6.06128C15.6367 4.67091 16.524 4.95616 16.524 4.95616C17.0983 6.43556 16.7326 7.54091 16.6283 7.80822C17.3069 8.55678 17.707 9.51928 17.707 10.6957C17.707 14.8312 15.254 15.7401 12.905 16.0076C13.2879 16.3463 13.6183 16.9878 13.6183 18.0039C13.6183 19.4477 13.6011 20.6064 13.6011 20.9627C13.6011 21.248 13.7926 21.5868 14.3144 21.4799C18.49 20.0536 21.5 16.0253 21.5 11.2662C21.5172 5.3125 16.8023 0.5 11.0087 0.5Z"/></svg>
                                   </div>
                               </div>
                            </div>
                            <div id="duorain-pinned-items-container" class="DLP_VStack_8">
                            </div>
                            <div id="duorain-see-more-button" class="DLP_Button_Style_1 DLP_Magnetic_Hover_1 DLP_NoSelect" style="justify-content: space-between; background: rgba(0, 122, 255, 0.1); outline: 2px solid rgba(0, 122, 255, 0.2); align-self: stretch;">
                                <p class="DLP_Text_Style_1" style="color: #007AFF;">See More</p>
                                <svg width="9" height="16" viewBox="0 0 9 16" fill="#007AFF" xmlns="http://www.w3.org/2000/svg"><path d="M8.57031 7.85938C8.57031 8.24219 8.4375 8.5625 8.10938 8.875L2.20312 14.6641C1.96875 14.8984 1.67969 15.0156 1.33594 15.0156C0.648438 15.0156 0.0859375 14.4609 0.0859375 13.7734C0.0859375 13.4219 0.226562 13.1094 0.484375 12.8516L5.63281 7.85156L0.484375 2.85938C0.226562 2.60938 0.0859375 2.28906 0.0859375 1.94531C0.0859375 1.26562 0.648438 0.703125 1.33594 0.703125C1.67969 0.703125 1.96875 0.820312 2.20312 1.05469L8.10938 6.84375C8.42969 7.14844 8.57031 7.46875 8.57031 7.85938Z"></path></svg>
                            </div>
                        </div>
                    </div>
                    <div id="duorain-solver-page" class="duorain-page duorain-page-hidden">
                        <div class="DLP_VStack_8">
                           <div class="DLP_HStack_Auto_Top DLP_NoSelect">
                               <div class="DLP_HStack_4">
                                   <p class="DLP_Text_Style_2">Duo<span class="duorain-neon-blue">Rain</span></p>
                               </div>
                               <p class="DLP_Text_Style_1 duorain-autosolver-text" style="margin-top: 2px; font-size: 14px;">AUTO-SOLVER</p>
                           </div>
                            <div id="duorain-solver-controls" class="DLP_HStack_8" style="margin-top: 8px;">
                                <div class="DLP_Button_Style_1 DLP_NoSelect" style="justify-content: space-between;">
                                    <p class="DLP_Text_Style_1">Easy Solve</p>
                                    <label class="duorain-switch-container">
                                        <input type="checkbox" id="duorain-easy-solve-switch" class="duorain-switch">
                                        <span class="duorain-switch-slider"></span>
                                    </label>
                                </div>
                                <div class="DLP_HStack_4" style="flex: none; gap: 8px;">
                                   <div id="duorain-settings-button-solver" class="duorain-icon-button DLP_Button_Style_1 DLP_Magnetic_Hover_1 DLP_NoSelect">
                                     <svg viewBox="0 0 90 90" class="duorain-settings-svg"><path d="M 31.018 18.844 L 31.018 18.844 c -2.967 -1.229 -2.967 -5.431 0 -6.66 l 0 0 c 0.421 -0.174 0.621 -0.657 0.447 -1.078 L 29.91 7.352 c -0.174 -0.421 -0.657 -0.621 -1.078 -0.447 l 0 0 c -2.967 1.229 -5.938 -1.743 -4.709 -4.709 l 0 0 c 0.174 -0.421 -0.026 -0.904 -0.447 -1.078 l -3.754 -1.555 c -0.421 -0.174 -0.904 0.026 -1.078 0.447 c -1.229 2.967 -5.431 2.967 -6.66 0 c -0.174 -0.421 -0.657 -0.621 -1.078 -0.447 L 7.352 1.117 C 6.931 1.292 6.731 1.775 6.905 2.196 c 1.229 2.967 -1.743 5.938 -4.71 4.71 C 1.775 6.731 1.292 6.931 1.117 7.352 l -1.555 3.753 c -0.174 0.421 0.026 0.904 0.447 1.078 l 0 0 c 2.967 1.229 2.967 5.431 0 6.66 l 0 0 c -0.421 0.174 -0.621 0.657 -0.447 1.078 l 1.555 3.753 c 0.174 0.421 0.657 0.621 1.078 0.447 l 0 0 c 2.967 -1.229 5.938 1.743 4.709 4.71 l 0 0 C 6.73 29.253 6.93 29.736 7.351 29.91 l 3.753 1.555 c 0.421 0.174 0.904 -0.026 1.078 -0.447 l 0 0 c 1.229 -2.967 5.431 -2.967 6.66 0 l 0 0 c 0.174 0.421 0.657 0.621 1.078 0.447 l 3.753 -1.555 c 0.421 -0.174 0.621 -0.657 0.447 -1.078 l 0 0 c -1.229 -2.967 1.743 -5.938 4.71 -4.709 c 0.421 0.174 0.904 -0.026 1.078 -0.447 l 1.555 -3.753 C 31.639 19.501 31.439 19.018 31.018 18.844 z M 15.514 22.294 c -3.744 0 -6.78 -3.036 -6.78 -6.78 s 3.036 -6.78 6.78 -6.78 s 6.78 3.036 6.78 6.78 S 19.258 22.294 15.514 22.294 z" transform="matrix(2.81 0 0 2.81 1.4065934065934016 1.4065934016)"/></svg>
                                   </div>
                                    <div id="DLP_Main_Discord_Button_1_ID-solver" class="duorain-icon-button DLP_Button_Style_1 DLP_Magnetic_Hover_1 DLP_NoSelect">
                                        <svg width="22" height="16" viewBox="0 0 22 16" fill="#FFF" xmlns="http://www.w3.org/2000/svg"><path d="M18.289 1.34C16.9296 0.714 15.4761 0.259052 13.9565 0C13.7699 0.332095 13.5519 0.77877 13.4016 1.1341C11.7862 0.894993 10.1857 0.894993 8.60001 1.1341C8.44972 0.77877 8.22674 0.332095 8.03844 0C6.51721 0.259052 5.06204 0.715671 3.70267 1.34331C0.960812 5.42136 0.21754 9.39811 0.589177 13.3184C2.40772 14.655 4.17011 15.467 5.90275 15.9984C6.33055 15.4189 6.71209 14.8028 7.04078 14.1536C6.41478 13.9195 5.81521 13.6306 5.24869 13.2952C5.39898 13.1856 5.546 13.071 5.68803 12.9531C9.14342 14.5438 12.8978 14.5438 16.3119 12.9531C16.4556 13.071 16.6026 13.1856 16.7512 13.2952C16.183 13.6322 15.5818 13.9211 14.9558 14.1553C15.2845 14.8028 15.6644 15.4205 16.0939 16C17.8282 15.4687 19.5922 14.6567 21.4107 13.3184C21.8468 8.77378 20.6658 4.83355 18.289 1.34ZM7.51153 10.9075C6.47426 10.9075 5.62361 9.95435 5.62361 8.7937C5.62361 7.63305 6.45609 6.67831 7.51153 6.67831C8.56699 6.67831 9.41761 7.63138 9.39945 8.7937C9.40109 9.95435 8.56699 10.9075 7.51153 10.9075ZM14.4884 10.9075C13.4511 10.9075 12.6005 9.95435 12.6005 8.7937C12.6005 7.63305 13.4329 6.67831 14.4884 6.67831C15.5438 6.67831 16.3945 7.63138 16.3763 8.7937C16.3763 9.95435 15.5438 10.9075 14.4884 10.9075Z"></path></svg>
                                   </div>
                                   <div id="DLP_Main_GitHub_Button_1_ID-solver" class="duorain-icon-button DLP_Button_Style_1 DLP_Magnetic_Hover_1 DLP_NoSelect">
                                     <svg width="22" height="22" viewBox="0 0 22 22" fill="#FFF" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M11.0087 0.5C5.19766 0.5 0.5 5.3125 0.5 11.2662C0.5 16.0253 3.50995 20.0538 7.68555 21.4797C8.2076 21.5868 8.39883 21.248 8.39883 20.963C8.39883 20.7134 8.38162 19.8578 8.38162 18.9664C5.45836 19.6082 4.84962 17.683 4.84962 17.683C4.37983 16.4353 3.68375 16.1146 3.68375 16.1146C2.72697 15.4551 3.75345 15.4551 3.75345 15.4551C4.81477 15.5264 5.37167 16.5602 5.37167 16.5602C6.31103 18.1999 7.82472 17.7366 8.43368 17.4514C8.52058 16.7562 8.79914 16.2749 9.09491 16.0076C6.7634 15.758 4.31035 14.8312 4.31035 10.6957C4.31035 9.51928 4.72765 8.55678 5.38888 7.80822C5.28456 7.54091 4.9191 6.43556 5.49342 4.95616C5.49342 4.95616 6.38073 4.67091 8.38141 6.06128C9.23797 5.82561 10.1213 5.70573 11.0087 5.70472C11.896 5.70472 12.8005 5.82963 13.6358 6.06128C15.6367 4.67091 16.524 4.95616 16.524 4.95616C17.0983 6.43556 16.7326 7.54091 16.6283 7.80822C17.3069 8.55678 17.707 9.51928 17.707 10.6957C17.707 14.8312 15.254 15.7401 12.905 16.0076C13.2879 16.3463 13.6183 16.9878 13.6183 18.0039C13.6183 19.4477 13.6011 20.6064 13.6011 20.9627C13.6011 21.248 13.7926 21.5868 14.3144 21.4799C18.49 20.0536 21.5 16.0253 21.5 11.2662C21.5172 5.3125 16.8023 0.5 11.0087 0.5Z"/></svg>
                                   </div>
                               </div>
                            </div>
                            <div id="duorain-solver-pinned-items-container" class="DLP_VStack_8"></div>
                             <div id="duorain-solver-see-more-button" class="DLP_Button_Style_1 DLP_Magnetic_Hover_1 DLP_NoSelect" style="justify-content: space-between; background: rgba(0, 122, 255, 0.1); outline: 2px solid rgba(0, 122, 255, 0.2); align-self: stretch;">
                                <p class="DLP_Text_Style_1" style="color: #007AFF;">See More</p>
                                <svg width="9" height="16" viewBox="0 0 9 16" fill="#007AFF" xmlns="http://www.w3.org/2000/svg"><path d="M8.57031 7.85938C8.57031 8.24219 8.4375 8.5625 8.10938 8.875L2.20312 14.6641C1.96875 14.8984 1.67969 15.0156 1.33594 15.0156C0.648438 15.0156 0.0859375 14.4609 0.0859375 13.7734C0.0859375 13.4219 0.226562 13.1094 0.484375 12.8516L5.63281 7.85156L0.484375 2.85938C0.226562 2.60938 0.0859375 2.28906 0.0859375 1.94531C0.0859375 1.26562 0.648438 0.703125 1.33594 0.703125C1.67969 0.703125 1.96875 0.820312 2.20312 1.05469L8.10938 6.84375C8.42969 7.14844 8.57031 7.46875 8.57031 7.85938Z"></path></svg>
                            </div>
                       </div>
                    </div>
                    <div id="duorain-tasks-page" class="duorain-page duorain-page-hidden">
                        <div class="DLP_VStack_8"><div class="DLP_HStack_Auto_Top DLP_NoSelect"><p class="DLP_Text_Style_2">Running Tasks</p><div class="duorain-back-button DLP_Magnetic_Hover_1" style="cursor: pointer; padding: 4px;" data-target="main"><p class="DLP_Text_Style_1" style="font-size: 14px; opacity: 0.8;">BACK</p></div></div><div id="duorain-running-tasks-list-content" class="DLP_VStack_8" style="margin-top: 8px;"></div></div>
                    </div>
                   <div id="duorain-settings-page" class="duorain-page duorain-page-hidden">
                        <div class="DLP_VStack_8">
                            <div class="DLP_HStack_Auto_Top DLP_NoSelect"><p class="DLP_Text_Style_2">Settings</p><div class="duorain-back-button DLP_Magnetic_Hover_1" style="cursor: pointer; padding: 4px;" data-target="main"><p class="DLP_Text_Style_1" style="font-size: 14px; opacity: 0.8;">BACK</p></div></div>
                            <div id="duorain-settings-content" class="DLP_VStack_8" style="margin-top: 8px;">
                                <div class="duorain-setting-row DLP_HStack_8">
                                    <p class="DLP_Text_Style_1">Loop Delay (ms)</p>
                                    <div class="DLP_HStack_8">
                                        <div class="DLP_Input_Style_1_Active duorain-input-with-spinner">
                                            <input type="number" min="0" id="duorain-loop-delay-input" class="DLP_Input_Input_Style_1">
                                            <div class="duorain-spinner-controls">
                                                <div id="duorain-delay-increment" class="duorain-spinner-button">
                                                    <svg width="16" height="16" viewBox="-3.12 -3.12 30.24 30.24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <defs><filter id="DuoRain-UP-Filter-Spinner" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceAlpha" stdDeviation=".5" result="blur1"/><feFlood flood-color="#2196F3" result="color1"/><feComposite in="color1" in2="blur1" operator="in" result="glow1"/><feGaussianBlur in="SourceAlpha" stdDeviation=".2" result="blur2"/><feFlood flood-color="#03A9F4" result="color2"/><feComposite in="color2" in2="blur2" operator="in" result="glow2"/><feMerge><feMergeNode in="glow1"/><feMergeNode in="glow2"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
                                                        <path d="m5 15 5-5.15a2.74 2.74 0 0 1 4 0L19 15" stroke="#03A9F4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" filter="url(#DuoRain-UP-Filter-Spinner)"/>
                                                    </svg>
                                                </div>
                                                <div id="duorain-delay-decrement" class="duorain-spinner-button">
                                                    <svg class="duorain-spinner-down-svg" width="16" height="16" viewBox="-3.12 -3.12 30.24 30.24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <defs><filter id="DuoRain-DOWN-Filter-Spinner" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceAlpha" stdDeviation=".5" result="blur1"/><feFlood flood-color="#2196F3" result="color1"/><feComposite in="color1" in2="blur1" operator="in" result="glow1"/><feGaussianBlur in="SourceAlpha" stdDeviation=".2" result="blur2"/><feFlood flood-color="#03A9F4" result="color2"/><feComposite in="color2" in2="blur2" operator="in" result="glow2"/><feMerge><feMergeNode in="glow1"/><feMergeNode in="glow2"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
                                                        <path d="m5 15 5-5.15a2.74 2.74 0 0 1 4 0L19 15" stroke="#03A9F4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" filter="url(#DuoRain-DOWN-Filter-Spinner)"/>
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="duorain-info-icon" data-tooltip="The delay in milliseconds between each farm loop. Default: 200 ms.">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/><path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0"/></svg>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div id="duorain-see-more-page" class="duorain-page duorain-page-hidden">
                         <div class="DLP_VStack_8">
                            <div class="DLP_HStack_Auto_Top DLP_NoSelect">
                                <p class="DLP_Text_Style_2">More Features</p>
                                <div class="duorain-back-button DLP_Magnetic_Hover_1" style="cursor: pointer; padding: 4px;" data-target="main">
                                    <p class="DLP_Text_Style_1" style="font-size: 14px; opacity: 0.8;">BACK</p>
                                </div>
                            </div>
                            <div id="duorain-see-more-content" class="duorain-feature-grid">
                            </div>
                        </div>
                    </div>
                    <div id="duorain-solver-more-page" class="duorain-page duorain-page-hidden">
                         <div class="DLP_VStack_8">
                            <div class="DLP_HStack_Auto_Top DLP_NoSelect">
                                <p class="DLP_Text_Style_2">Solver Features</p>
                                <div class="duorain-back-button DLP_Magnetic_Hover_1" style="cursor: pointer; padding: 4px;" data-target="solver">
                                    <p class="DLP_Text_Style_1" style="font-size: 14px; opacity: 0.8;">BACK</p>
                                </div>
                            </div>
                            <div id="duorain-solver-see-more-content" class="duorain-feature-grid">
                            </div>
                        </div>
                    </div>
                </div>
                <div id="duorain-feature-templates" style="display: none;">
                <div class="DLP_VStack_8 duorain-feature-item" data-farm-id="xp">
                    <div class="DLP_HStack_8 duorain-feature-header">
                        <p class="DLP_Text_Style_1 DLP_NoSelect" style="align-self: stretch;">How many XP loops would you like to run?</p>
                        <div class="duorain-pin-icon">
                            <svg class="pin-active" width="13" height="20" viewBox="0 0 13 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M0.140625 12.25C0.140625 10.5156 1.50781 8.80469 3.73438 7.96875L3.98438 4.25781C2.77344 3.57812 1.875 2.85156 1.47656 2.35156C1.24219 2.05469 1.13281 1.74219 1.13281 1.46094C1.13281 0.875 1.57812 0.453125 2.22656 0.453125H10.7578C11.4062 0.453125 11.8516 0.875 11.8516 1.46094C11.8516 1.74219 11.7422 2.05469 11.5078 2.35156C11.1094 2.85156 10.2109 3.57031 9 4.25781L9.25781 7.96875C11.4766 8.80469 12.8438 10.5156 12.8438 12.25C12.8438 13.0312 12.3047 13.5547 11.5 13.5547H7.40625V17.3203C7.40625 18.2578 6.74219 19.5703 6.49219 19.5703C6.24219 19.5703 5.57812 18.2578 5.57812 17.3203V13.5547H1.48438C0.679688 13.5547 0.140625 13.0312 0.140625 12.25Z"></path></svg>
                            <svg class="pin-inactive" width="13" height="20" viewBox="0 0 13 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path opacity="0.5" d="M1.48438 13.5547C0.679688 13.5547 0.140625 13.0312 0.140625 12.25C0.140625 10.5156 1.50781 8.85156 3.55469 8.01562L3.80469 4.25781C2.77344 3.57031 1.86719 2.85156 1.47656 2.34375C1.24219 2.05469 1.13281 1.74219 1.13281 1.46094C1.13281 0.875 1.57812 0.453125 2.22656 0.453125H10.7578C11.4062 0.453125 11.8516 0.875 11.8516 1.46094C11.8516 1.74219 11.7422 2.05469 11.5078 2.34375C11.1172 2.85156 10.2188 3.57031 9.17969 4.25781L9.42969 8.01562C11.4766 8.85156 12.8438 10.5156 12.8438 12.25C12.8438 13.0312 12.3047 13.5547 11.5 13.5547H7.40625V17.3203C7.40625 18.2578 6.74219 19.5703 6.49219 19.5703C6.24219 19.5703 5.57812 18.2578 5.57812 17.3203V13.5547H1.48438ZM6.49219 7.44531C6.92969 7.44531 7.35156 7.47656 7.75781 7.54688L7.53125 3.55469C7.52344 3.38281 7.5625 3.29688 7.69531 3.21875C8.5625 2.76562 9.23438 2.28125 9.46094 2.07812C9.53125 2.00781 9.49219 1.92969 9.41406 1.92969H3.57812C3.5 1.92969 3.45312 2.00781 3.52344 2.07812C3.75 2.28125 4.42188 2.76562 5.28906 3.21875C5.42188 3.29688 5.46094 3.38281 5.45312 3.55469L5.22656 7.54688C5.63281 7.47656 6.05469 7.44531 6.49219 7.44531ZM1.92188 11.9844H11.0625C11.1797 11.9844 11.2344 11.9141 11.2109 11.7734C10.9922 10.3906 9.08594 8.96875 6.49219 8.96875C3.89844 8.96875 1.99219 10.3906 1.77344 11.7734C1.75 11.9141 1.80469 11.9844 1.92188 11.9844Z"></path></svg>
                                        </div>
                                    </div>
                                     <div class="DLP_HStack_8">
                                        <div class="DLP_Input_Button_Style_1_Active DLP_Magnetic_Hover_1 DLP_NoSelect duorain-infinity-button" style="width: 48px; padding: 0;">
                                             <p class="DLP_Text_Style_1" style="color: #007AFF; font-size: 24px; line-height: 1;">#</p>
                                        </div>
                                        <div class="DLP_Input_Style_1_Active"><input type="text" placeholder="0" class="DLP_Input_Input_Style_1 duorain-value-input" data-input-for="xp"></div>
                                        <div class="DLP_Input_Button_Style_1_Active DLP_Magnetic_Hover_1 DLP_NoSelect duorain-gradient-button" data-action="start-xp-farm"><p class="DLP_Text_Style_1" style="color: #FFF;">RUN</p></div>
                                    </div>
                                </div>
                                <div class="DLP_VStack_8 duorain-feature-item" data-farm-id="gem">
                                    <div class="DLP_HStack_8 duorain-feature-header">
                                        <p class="DLP_Text_Style_1 DLP_NoSelect" style="align-self: stretch;">How many Gem loops would you like to run?</p>
                                        <div class="duorain-pin-icon">
                                             <svg class="pin-active" width="13" height="20" viewBox="0 0 13 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M0.140625 12.25C0.140625 10.5156 1.50781 8.80469 3.73438 7.96875L3.98438 4.25781C2.77344 3.57812 1.875 2.85156 1.47656 2.35156C1.24219 2.05469 1.13281 1.74219 1.13281 1.46094C1.13281 0.875 1.57812 0.453125 2.22656 0.453125H10.7578C11.4062 0.453125 11.8516 0.875 11.8516 1.46094C11.8516 1.74219 11.7422 2.05469 11.5078 2.35156C11.1094 2.85156 10.2109 3.57031 9 4.25781L9.25781 7.96875C11.4766 8.80469 12.8438 10.5156 12.8438 12.25C12.8438 13.0312 12.3047 13.5547 11.5 13.5547H7.40625V17.3203C7.40625 18.2578 6.74219 19.5703 6.49219 19.5703C6.24219 19.5703 5.57812 18.2578 5.57812 17.3203V13.5547H1.48438C0.679688 13.5547 0.140625 13.0312 0.140625 12.25Z"></path></svg>
                                            <svg class="pin-inactive" width="13" height="20" viewBox="0 0 13 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path opacity="0.5" d="M1.48438 13.5547C0.679688 13.5547 0.140625 13.0312 0.140625 12.25C0.140625 10.5156 1.50781 8.85156 3.55469 8.01562L3.80469 4.25781C2.77344 3.57031 1.86719 2.85156 1.47656 2.34375C1.24219 2.05469 1.13281 1.74219 1.13281 1.46094C1.13281 0.875 1.57812 0.453125 2.22656 0.453125H10.7578C11.4062 0.453125 11.8516 0.875 11.8516 1.46094C11.8516 1.74219 11.7422 2.05469 11.5078 2.34375C11.1172 2.85156 10.2188 3.57031 9.17969 4.25781L9.42969 8.01562C11.4766 8.85156 12.8438 10.5156 12.8438 12.25C12.8438 13.0312 12.3047 13.5547 11.5 13.5547H7.40625V17.3203C7.40625 18.2578 6.74219 19.5703 6.49219 19.5703C6.24219 19.5703 5.57812 18.2578 5.57812 17.3203V13.5547H1.48438ZM6.49219 7.44531C6.92969 7.44531 7.35156 7.47656 7.75781 7.54688L7.53125 3.55469C7.52344 3.38281 7.5625 3.29688 7.69531 3.21875C8.5625 2.76562 9.23438 2.28125 9.46094 2.07812C9.53125 2.00781 9.49219 1.92969 9.41406 1.92969H3.57812C3.5 1.92969 3.45312 2.00781 3.52344 2.07812C3.75 2.28125 4.42188 2.76562 5.28906 3.21875C5.42188 3.29688 5.46094 3.38281 5.45312 3.55469L5.22656 7.54688C5.63281 7.47656 6.05469 7.44531 6.49219 7.44531ZM1.92188 11.9844H11.0625C11.1797 11.9844 11.2344 11.9141 11.2109 11.7734C10.9922 10.3906 9.08594 8.96875 6.49219 8.96875C3.89844 8.96875 1.99219 10.3906 1.77344 11.7734C1.75 11.9141 1.80469 11.9844 1.92188 11.9844Z"></path></svg>
                                        </div>
                                    </div>
                                    <div class="DLP_HStack_8">
                                        <div class="DLP_Input_Button_Style_1_Active DLP_Magnetic_Hover_1 DLP_NoSelect duorain-infinity-button" style="width: 48px; padding: 0;">
                                             <p class="DLP_Text_Style_1" style="color: #007AFF; font-size: 24px; line-height: 1;">#</p>
                                        </div>
                                        <div class="DLP_Input_Style_1_Active"><input type="text" placeholder="0" class="DLP_Input_Input_Style_1 duorain-value-input" data-input-for="gem"></div>
                                        <div class="DLP_Input_Button_Style_1_Active DLP_Magnetic_Hover_1 DLP_NoSelect duorain-gradient-button" data-action="start-gem-farm"><p class="DLP_Text_Style_1" style="color: #FFF;">RUN</p></div>
                                    </div>
                                </div>
                                <div class="DLP_VStack_8 duorain-feature-item" data-farm-id="streak">
                                    <div class="DLP_HStack_8 duorain-feature-header">
                                        <p class="DLP_Text_Style_1 DLP_NoSelect" style="align-self: stretch;">How many days of Streak to repair?</p>
                                        <div class="duorain-pin-icon">
                                            <svg class="pin-active" width="13" height="20" viewBox="0 0 13 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M0.140625 12.25C0.140625 10.5156 1.50781 8.80469 3.73438 7.96875L3.98438 4.25781C2.77344 3.57812 1.875 2.85156 1.47656 2.35156C1.24219 2.05469 1.13281 1.74219 1.13281 1.46094C1.13281 0.875 1.57812 0.453125 2.22656 0.453125H10.7578C11.4062 0.453125 11.8516 0.875 11.8516 1.46094C11.8516 1.74219 11.7422 2.05469 11.5078 2.35156C11.1094 2.85156 10.2109 3.57031 9 4.25781L9.25781 7.96875C11.4766 8.80469 12.8438 10.5156 12.8438 12.25C12.8438 13.0312 12.3047 13.5547 11.5 13.5547H7.40625V17.3203C7.40625 18.2578 6.74219 19.5703 6.49219 19.5703C6.24219 19.5703 5.57812 18.2578 5.57812 17.3203V13.5547H1.48438C0.679688 13.5547 0.140625 13.0312 0.140625 12.25Z"></path></svg>
                                            <svg class="pin-inactive" width="13" height="20" viewBox="0 0 13 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path opacity="0.5" d="M1.48438 13.5547C0.679688 13.5547 0.140625 13.0312 0.140625 12.25C0.140625 10.5156 1.50781 8.85156 3.55469 8.01562L3.80469 4.25781C2.77344 3.57031 1.86719 2.85156 1.47656 2.34375C1.24219 2.05469 1.13281 1.74219 1.13281 1.46094C1.13281 0.875 1.57812 0.453125 2.22656 0.453125H10.7578C11.4062 0.453125 11.8516 0.875 11.8516 1.46094C11.8516 1.74219 11.7422 2.05469 11.5078 2.34375C11.1172 2.85156 10.2188 3.57031 9.17969 4.25781L9.42969 8.01562C11.4766 8.85156 12.8438 10.5156 12.8438 12.25C12.8438 13.0312 12.3047 13.5547 11.5 13.5547H7.40625V17.3203C7.40625 18.2578 6.74219 19.5703 6.49219 19.5703C6.24219 19.5703 5.57812 18.2578 5.57812 17.3203V13.5547H1.48438ZM6.49219 7.44531C6.92969 7.44531 7.35156 7.47656 7.75781 7.54688L7.53125 3.55469C7.52344 3.38281 7.5625 3.29688 7.69531 3.21875C8.5625 2.76562 9.23438 2.28125 9.46094 2.07812C9.53125 2.00781 9.49219 1.92969 9.41406 1.92969H3.57812C3.5 1.92969 3.45312 2.00781 3.52344 2.07812C3.75 2.28125 4.42188 2.76562 5.28906 3.21875C5.42188 3.29688 5.46094 3.38281 5.45312 3.55469L5.22656 7.54688C5.63281 7.47656 6.05469 7.44531 6.49219 7.44531ZM1.92188 11.9844H11.0625C11.1797 11.9844 11.2344 11.9141 11.2109 11.7734C10.9922 10.3906 9.08594 8.96875 6.49219 8.96875C3.89844 8.96875 1.99219 10.3906 1.77344 11.7734C1.75 11.9141 1.80469 11.9844 1.92188 11.9844Z"></path></svg>
                                        </div>
                                    </div>
                                    <div class="DLP_HStack_8">
                                        <div class="DLP_Input_Button_Style_1_Active DLP_Magnetic_Hover_1 DLP_NoSelect duorain-infinity-button" style="width: 48px; padding: 0;">
                                            <p class="DLP_Text_Style_1" style="color: #007AFF; font-size: 24px; line-height: 1;">#</p>
                                        </div>
                                        <div class="DLP_Input_Style_1_Active"><input type="text" placeholder="0" class="DLP_Input_Input_Style_1 duorain-value-input" data-input-for="streak"></div>
                                        <div class="DLP_Input_Button_Style_1_Active DLP_Magnetic_Hover_1 DLP_NoSelect duorain-gradient-button" data-action="start-streak-farm"><p class="DLP_Text_Style_1" style="color: #FFF;">GET</p></div>
                                    </div>
                                </div>
                                <div class="DLP_VStack_8 duorain-feature-item" data-farm-id="fullquests">
                                    <div class="DLP_HStack_8 duorain-feature-header">
                                        <p class="DLP_Text_Style_1 DLP_NoSelect" style="align-self: stretch;">Complete all quests & unlock all badges?</p>
                                        <div class="duorain-pin-icon">
                                            <svg class="pin-active" width="13" height="20" viewBox="0 0 13 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M0.140625 12.25C0.140625 10.5156 1.50781 8.80469 3.73438 7.96875L3.98438 4.25781C2.77344 3.57812 1.875 2.85156 1.47656 2.35156C1.24219 2.05469 1.13281 1.74219 1.13281 1.46094C1.13281 0.875 1.57812 0.453125 2.22656 0.453125H10.7578C11.4062 0.453125 11.8516 0.875 11.8516 1.46094C11.8516 1.74219 11.7422 2.05469 11.5078 2.35156C11.1094 2.85156 10.2109 3.57031 9 4.25781L9.25781 7.96875C11.4766 8.80469 12.8438 10.5156 12.8438 12.25C12.8438 13.0312 12.3047 13.5547 11.5 13.5547H7.40625V17.3203C7.40625 18.2578 6.74219 19.5703 6.49219 19.5703C6.24219 19.5703 5.57812 18.2578 5.57812 17.3203V13.5547H1.48438C0.679688 13.5547 0.140625 13.0312 0.140625 12.25Z"></path></svg>
                                            <svg class="pin-inactive" width="13" height="20" viewBox="0 0 13 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path opacity="0.5" d="M1.48438 13.5547C0.679688 13.5547 0.140625 13.0312 0.140625 12.25C0.140625 10.5156 1.50781 8.85156 3.55469 8.01562L3.80469 4.25781C2.77344 3.57031 1.86719 2.85156 1.47656 2.34375C1.24219 2.05469 1.13281 1.74219 1.13281 1.46094C1.13281 0.875 1.57812 0.453125 2.22656 0.453125H10.7578C11.4062 0.453125 11.8516 0.875 11.8516 1.46094C11.8516 1.74219 11.7422 2.05469 11.5078 2.34375C11.1172 2.85156 10.2188 3.57031 9.17969 4.25781L9.42969 8.01562C11.4766 8.85156 12.8438 10.5156 12.8438 12.25C12.8438 13.0312 12.3047 13.5547 11.5 13.5547H7.40625V17.3203C7.40625 18.2578 6.74219 19.5703 6.49219 19.5703C6.24219 19.5703 5.57812 18.2578 5.57812 17.3203V13.5547H1.48438ZM6.49219 7.44531C6.92969 7.44531 7.35156 7.47656 7.75781 7.54688L7.53125 3.55469C7.52344 3.38281 7.5625 3.29688 7.69531 3.21875C8.5625 2.76562 9.23438 2.28125 9.46094 2.07812C9.53125 2.00781 9.49219 1.92969 9.41406 1.92969H3.57812C3.5 1.92969 3.45312 2.00781 3.52344 2.07812C3.75 2.28125 4.42188 2.76562 5.28906 3.21875C5.42188 3.29688 5.46094 3.38281 5.45312 3.55469L5.22656 7.54688C5.63281 7.47656 6.05469 7.44531 6.49219 7.44531ZM1.92188 11.9844H11.0625C11.1797 11.9844 11.2344 11.9141 11.2109 11.7734C10.9922 10.3906 9.08594 8.96875 6.49219 8.96875C3.89844 8.96875 1.99219 10.3906 1.77344 11.7734C1.75 11.9141 1.80469 11.9844 1.92188 11.9844Z"></path></svg>
                                        </div>
                                    </div>
                                    <div class="duorain-super-button DLP_Magnetic_Hover_1 DLP_NoSelect" data-action="run-fullquests">
                                        <p>COMPLETE</p>
                                    </div>
                                </div>
                                <div class="DLP_VStack_8 duorain-feature-item" data-farm-id="streak-freeze">
                                    <div class="DLP_HStack_8 duorain-feature-header">
                                        <p class="DLP_Text_Style_1 DLP_NoSelect" style="align-self: stretch;">How many Streak Freezes would you like to redeem?</p>
                                        <div class="duorain-pin-icon">
                                            <svg class="pin-active" width="13" height="20" viewBox="0 0 13 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M0.140625 12.25C0.140625 10.5156 1.50781 8.80469 3.73438 7.96875L3.98438 4.25781C2.77344 3.57812 1.875 2.85156 1.47656 2.35156C1.24219 2.05469 1.13281 1.74219 1.13281 1.46094C1.13281 0.875 1.57812 0.453125 2.22656 0.453125H10.7578C11.4062 0.453125 11.8516 0.875 11.8516 1.46094C11.8516 1.74219 11.7422 2.05469 11.5078 2.35156C11.1094 2.85156 10.2109 3.57031 9 4.25781L9.25781 7.96875C11.4766 8.80469 12.8438 10.5156 12.8438 12.25C12.8438 13.0312 12.3047 13.5547 11.5 13.5547H7.40625V17.3203C7.40625 18.2578 6.74219 19.5703 6.49219 19.5703C6.24219 19.5703 5.57812 18.2578 5.57812 17.3203V13.5547H1.48438C0.679688 13.5547 0.140625 13.0312 0.140625 12.25Z"></path></svg>
                                            <svg class="pin-inactive" width="13" height="20" viewBox="0 0 13 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path opacity="0.5" d="M1.48438 13.5547C0.679688 13.5547 0.140625 13.0312 0.140625 12.25C0.140625 10.5156 1.50781 8.85156 3.55469 8.01562L3.80469 4.25781C2.77344 3.57031 1.86719 2.85156 1.47656 2.34375C1.24219 2.05469 1.13281 1.74219 1.13281 1.46094C1.13281 0.875 1.57812 0.453125 2.22656 0.453125H10.7578C11.4062 0.453125 11.8516 0.875 11.8516 1.46094C11.8516 1.74219 11.7422 2.05469 11.5078 2.34375C11.1172 2.85156 10.2188 3.57031 9.17969 4.25781L9.42969 8.01562C11.4766 8.85156 12.8438 10.5156 12.8438 12.25C12.8438 13.0312 12.3047 13.5547 11.5 13.5547H7.40625V17.3203C7.40625 18.2578 6.74219 19.5703 6.49219 19.5703C6.24219 19.5703 5.57812 18.2578 5.57812 17.3203V13.5547H1.48438ZM6.49219 7.44531C6.92969 7.44531 7.35156 7.47656 7.75781 7.54688L7.53125 3.55469C7.52344 3.38281 7.5625 3.29688 7.69531 3.21875C8.5625 2.76562 9.23438 2.28125 9.46094 2.07812C9.53125 2.00781 9.49219 1.92969 9.41406 1.92969H3.57812C3.5 1.92969 3.45312 2.00781 3.52344 2.07812C3.75 2.28125 4.42188 2.76562 5.28906 3.21875C5.42188 3.29688 5.46094 3.38281 5.45312 3.55469L5.22656 7.54688C5.63281 7.47656 6.05469 7.44531 6.49219 7.44531ZM1.92188 11.9844H11.0625C11.1797 11.9844 11.2344 11.9141 11.2109 11.7734C10.9922 10.3906 9.08594 8.96875 6.49219 8.96875C3.89844 8.96875 1.99219 10.3906 1.77344 11.7734C1.75 11.9141 1.80469 11.9844 1.92188 11.9844Z"></path></svg>
                                        </div>
                                    </div>
                                    <div class="DLP_HStack_8">
                                        <div class="DLP_Input_Style_1_Active duorain-input-with-spinner" style="padding:0; height: 48px;">
                                            <span id="duorain-freeze-value" class="DLP_Input_Input_Style_1" style="display:flex; align-items:center; justify-content:center; padding-right: 24px;">0</span>
                                            <div class="duorain-spinner-controls">
                                                <div id="duorain-freeze-increment" class="duorain-spinner-button">
                                                    <svg width="16" height="16" viewBox="-3.12 -3.12 30.24 30.24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="m5 15 5-5.15a2.74 2.74 0 0 1 4 0L19 15" stroke="#03A9F4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" filter="url(#DuoRain-UP-Filter-Spinner)"/></svg>
                                                </div>
                                                <div id="duorain-freeze-decrement" class="duorain-spinner-button">
                                                    <svg class="duorain-spinner-down-svg" width="16" height="16" viewBox="-3.12 -3.12 30.24 30.24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="m5 15 5-5.15a2.74 2.74 0 0 1 4 0L19 15" stroke="#03A9F4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" filter="url(#DuoRain-DOWN-Filter-Spinner)"/></svg>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="DLP_Input_Button_Style_1_Active DLP_Magnetic_Hover_1 DLP_NoSelect duorain-gradient-button" data-action="grant-streak-freeze"><p class="DLP_Text_Style_1" style="color: #FFF;">GET</p></div>
                                    </div>
                                </div>
                                <div class="DLP_VStack_8 duorain-feature-item" data-farm-id="hearts">
                                    <div class="DLP_HStack_8 duorain-feature-header">
                                        <p class="DLP_Text_Style_1 DLP_NoSelect" style="align-self: stretch;">Would you like to refill your Hearts to full?</p>
                                        <div class="duorain-pin-icon">
                                            <svg class="pin-active" width="13" height="20" viewBox="0 0 13 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M0.140625 12.25C0.140625 10.5156 1.50781 8.80469 3.73438 7.96875L3.98438 4.25781C2.77344 3.57812 1.875 2.85156 1.47656 2.35156C1.24219 2.05469 1.13281 1.74219 1.13281 1.46094C1.13281 0.875 1.57812 0.453125 2.22656 0.453125H10.7578C11.4062 0.453125 11.8516 0.875 11.8516 1.46094C11.8516 1.74219 11.7422 2.05469 11.5078 2.35156C11.1094 2.85156 10.2109 3.57031 9 4.25781L9.25781 7.96875C11.4766 8.80469 12.8438 10.5156 12.8438 12.25C12.8438 13.0312 12.3047 13.5547 11.5 13.5547H7.40625V17.3203C7.40625 18.2578 6.74219 19.5703 6.49219 19.5703C6.24219 19.5703 5.57812 18.2578 5.57812 17.3203V13.5547H1.48438C0.679688 13.5547 0.140625 13.0312 0.140625 12.25Z"></path></svg>
                                            <svg class="pin-inactive" width="13" height="20" viewBox="0 0 13 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path opacity="0.5" d="M1.48438 13.5547C0.679688 13.5547 0.140625 13.0312 0.140625 12.25C0.140625 10.5156 1.50781 8.85156 3.55469 8.01562L3.80469 4.25781C2.77344 3.57031 1.86719 2.85156 1.47656 2.34375C1.24219 2.05469 1.13281 1.74219 1.13281 1.46094C1.13281 0.875 1.57812 0.453125 2.22656 0.453125H10.7578C11.4062 0.453125 11.8516 0.875 11.8516 1.46094C11.8516 1.74219 11.7422 2.05469 11.5078 2.34375C11.1172 2.85156 10.2188 3.57031 9.17969 4.25781L9.42969 8.01562C11.4766 8.85156 12.8438 10.5156 12.8438 12.25C12.8438 13.0312 12.3047 13.5547 11.5 13.5547H7.40625V17.3203C7.40625 18.2578 6.74219 19.5703 6.49219 19.5703C6.24219 19.5703 5.57812 18.2578 5.57812 17.3203V13.5547H1.48438ZM6.49219 7.44531C6.92969 7.44531 7.35156 7.47656 7.75781 7.54688L7.53125 3.55469C7.52344 3.38281 7.5625 3.29688 7.69531 3.21875C8.5625 2.76562 9.23438 2.28125 9.46094 2.07812C9.53125 2.00781 9.49219 1.92969 9.41406 1.92969H3.57812C3.5 1.92969 3.45312 2.00781 3.52344 2.07812C3.75 2.28125 4.42188 2.76562 5.28906 3.21875C5.42188 3.29688 5.46094 3.38281 5.45312 3.55469L5.22656 7.54688C5.63281 7.47656 6.05469 7.44531 6.49219 7.44531ZM1.92188 11.9844H11.0625C11.1797 11.9844 11.2344 11.9141 11.2109 11.7734C10.9922 10.3906 9.08594 8.96875 6.49219 8.96875C3.89844 8.96875 1.99219 10.3906 1.77344 11.7734C1.75 11.9141 1.80469 11.9844 1.92188 11.9844Z"></path></svg>
                                        </div>
                                    </div>
                                    <div class="duorain-super-button duorain-gradient-button DLP_Magnetic_Hover_1 DLP_NoSelect" data-action="grant-hearts">
                                        <p>REFILL</p>
                                    </div>
                                </div>
                                <div class="DLP_VStack_8 duorain-feature-item" data-farm-id="xp-boost">
                                    <div class="DLP_HStack_8 duorain-feature-header">
                                        <p class="DLP_Text_Style_1 DLP_NoSelect" style="align-self: stretch;">Would you like to redeem an XP Boost?</p>
                                        <div class="duorain-pin-icon">
                                            <svg class="pin-active" width="13" height="20" viewBox="0 0 13 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M0.140625 12.25C0.140625 10.5156 1.50781 8.80469 3.73438 7.96875L3.98438 4.25781C2.77344 3.57812 1.875 2.85156 1.47656 2.35156C1.24219 2.05469 1.13281 1.74219 1.13281 1.46094C1.13281 0.875 1.57812 0.453125 2.22656 0.453125H10.7578C11.4062 0.453125 11.8516 0.875 11.8516 1.46094C11.8516 1.74219 11.7422 2.05469 11.5078 2.35156C11.1094 2.85156 10.2109 3.57031 9 4.25781L9.25781 7.96875C11.4766 8.80469 12.8438 10.5156 12.8438 12.25C12.8438 13.0312 12.3047 13.5547 11.5 13.5547H7.40625V17.3203C7.40625 18.2578 6.74219 19.5703 6.49219 19.5703C6.24219 19.5703 5.57812 18.2578 5.57812 17.3203V13.5547H1.48438C0.679688 13.5547 0.140625 13.0312 0.140625 12.25Z"></path></svg>
                                            <svg class="pin-inactive" width="13" height="20" viewBox="0 0 13 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path opacity="0.5" d="M1.48438 13.5547C0.679688 13.5547 0.140625 13.0312 0.140625 12.25C0.140625 10.5156 1.50781 8.85156 3.55469 8.01562L3.80469 4.25781C2.77344 3.57031 1.86719 2.85156 1.47656 2.34375C1.24219 2.05469 1.13281 1.74219 1.13281 1.46094C1.13281 0.875 1.57812 0.453125 2.22656 0.453125H10.7578C11.4062 0.453125 11.8516 0.875 11.8516 1.46094C11.8516 1.74219 11.7422 2.05469 11.5078 2.34375C11.1172 2.85156 10.2188 3.57031 9.17969 4.25781L9.42969 8.01562C11.4766 8.85156 12.8438 10.5156 12.8438 12.25C12.8438 13.0312 12.3047 13.5547 11.5 13.5547H7.40625V17.3203C7.40625 18.2578 6.74219 19.5703 6.49219 19.5703C6.24219 19.5703 5.57812 18.2578 5.57812 17.3203V13.5547H1.48438ZM6.49219 7.44531C6.92969 7.44531 7.35156 7.47656 7.75781 7.54688L7.53125 3.55469C7.52344 3.38281 7.5625 3.29688 7.69531 3.21875C8.5625 2.76562 9.23438 2.28125 9.46094 2.07812C9.53125 2.00781 9.49219 1.92969 9.41406 1.92969H3.57812C3.5 1.92969 3.45312 2.00781 3.52344 2.07812C3.75 2.28125 4.42188 2.76562 5.28906 3.21875C5.42188 3.29688 5.46094 3.38281 5.45312 3.55469L5.22656 7.54688C5.63281 7.47656 6.05469 7.44531 6.49219 7.44531ZM1.92188 11.9844H11.0625C11.1797 11.9844 11.2344 11.9141 11.2109 11.7734C10.9922 10.3906 9.08594 8.96875 6.49219 8.96875C3.89844 8.96875 1.99219 10.3906 1.77344 11.7734C1.75 11.9141 1.80469 11.9844 1.92188 11.9844Z"></path></svg>
                                        </div>
                                    </div>
                                    <div class="duorain-super-button duorain-gradient-button DLP_Magnetic_Hover_1 DLP_NoSelect" data-action="grant-xp-boost">
                                        <p>REDEEM</p>
                                    </div>
                                </div>
                            </div>
             <div id="duorain-solver-feature-templates" style="display: none;">
                <div class="DLP_VStack_8 duorain-feature-item" data-farm-id="path-solve">
                    <div class="DLP_HStack_8 duorain-feature-header">
                        <p class="DLP_Text_Style_1 DLP_NoSelect" style="align-self: stretch; opacity: 0.8;">How many lessons would you like to solve on the path?</p>
                        <div class="duorain-pin-icon">
                            <svg class="pin-active" width="13" height="20" viewBox="0 0 13 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M0.140625 12.25C0.140625 10.5156 1.50781 8.80469 3.73438 7.96875L3.98438 4.25781C2.77344 3.57812 1.875 2.85156 1.47656 2.35156C1.24219 2.05469 1.13281 1.74219 1.13281 1.46094C1.13281 0.875 1.57812 0.453125 2.22656 0.453125H10.7578C11.4062 0.453125 11.8516 0.875 11.8516 1.46094C11.8516 1.74219 11.7422 2.05469 11.5078 2.35156C11.1094 2.85156 10.2109 3.57031 9 4.25781L9.25781 7.96875C11.4766 8.80469 12.8438 10.5156 12.8438 12.25C12.8438 13.0312 12.3047 13.5547 11.5 13.5547H7.40625V17.3203C7.40625 18.2578 6.74219 19.5703 6.49219 19.5703C6.24219 19.5703 5.57812 18.2578 5.57812 17.3203V13.5547H1.48438C0.679688 13.5547 0.140625 13.0312 0.140625 12.25Z"></path></svg>
                            <svg class="pin-inactive" width="13" height="20" viewBox="0 0 13 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path opacity="0.5" d="M1.48438 13.5547C0.679688 13.5547 0.140625 13.0312 0.140625 12.25C0.140625 10.5156 1.50781 8.85156 3.55469 8.01562L3.80469 4.25781C2.77344 3.57031 1.86719 2.85156 1.47656 2.34375C1.24219 2.05469 1.13281 1.74219 1.13281 1.46094C1.13281 0.875 1.57812 0.453125 2.22656 0.453125H10.7578C11.4062 0.453125 11.8516 0.875 11.8516 1.46094C11.8516 1.74219 11.7422 2.05469 11.5078 2.34375C11.1172 2.85156 10.2188 3.57031 9.17969 4.25781L9.42969 8.01562C11.4766 8.85156 12.8438 10.5156 12.8438 12.25C12.8438 13.0312 12.3047 13.5547 11.5 13.5547H7.40625V17.3203C7.40625 18.2578 6.74219 19.5703 6.49219 19.5703C6.24219 19.5703 5.57812 18.2578 5.57812 17.3203V13.5547H1.48438ZM6.49219 7.44531C6.92969 7.44531 7.35156 7.47656 7.75781 7.54688L7.53125 3.55469C7.52344 3.38281 7.5625 3.29688 7.69531 3.21875C8.5625 2.76562 9.23438 2.28125 9.46094 2.07812C9.53125 2.00781 9.49219 1.92969 9.41406 1.92969H3.57812C3.5 1.92969 3.45312 2.00781 3.52344 2.07812C3.75 2.28125 4.42188 2.76562 5.28906 3.21875C5.42188 3.29688 5.46094 3.38281 5.45312 3.55469L5.22656 7.54688C5.63281 7.47656 6.05469 7.44531 6.49219 7.44531ZM1.92188 11.9844H11.0625C11.1797 11.9844 11.2344 11.9141 11.2109 11.7734C10.9922 10.3906 9.08594 8.96875 6.49219 8.96875C3.89844 8.96875 1.99219 10.3906 1.77344 11.7734C1.75 11.9141 1.80469 11.9844 1.92188 11.9844Z"></path></svg>
                        </div>
                    </div>
                    <div class="DLP_HStack_8">
                        <div class="DLP_Input_Button_Style_1_Active DLP_Magnetic_Hover_1 DLP_NoSelect duorain-infinity-button" style="width: 48px; padding: 0;">
                            <p class="DLP_Text_Style_1" style="color: #007AFF; font-size: 24px; line-height: 1;">#</p>
                        </div>
                        <div class="DLP_Input_Style_1_Active">
                            <input type="text" placeholder="0" class="DLP_Input_Input_Style_1 duorain-value-input" data-input-for="path-solve">
                        </div>
                        <div class="DLP_Input_Button_Style_1_Active DLP_Magnetic_Hover_1 DLP_NoSelect duorain-gradient-button" data-action="start-path-solve"><p class="DLP_Text_Style_1" style="color: #FFF;">START</p></div>
                    </div>
                </div>
                <div class="DLP_VStack_8 duorain-feature-item" data-farm-id="practice-solve">
                    <div class="DLP_HStack_8 duorain-feature-header">
                         <p class="DLP_Text_Style_1 DLP_NoSelect" style="align-self: stretch; opacity: 0.8;">How many practices would you like to solve?</p>
                         <div class="duorain-pin-icon">
                            <svg class="pin-active" width="13" height="20" viewBox="0 0 13 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M0.140625 12.25C0.140625 10.5156 1.50781 8.80469 3.73438 7.96875L3.98438 4.25781C2.77344 3.57812 1.875 2.85156 1.47656 2.35156C1.24219 2.05469 1.13281 1.74219 1.13281 1.46094C1.13281 0.875 1.57812 0.453125 2.22656 0.453125H10.7578C11.4062 0.453125 11.8516 0.875 11.8516 1.46094C11.8516 1.74219 11.7422 2.05469 11.5078 2.35156C11.1094 2.85156 10.2109 3.57031 9 4.25781L9.25781 7.96875C11.4766 8.80469 12.8438 10.5156 12.8438 12.25C12.8438 13.0312 12.3047 13.5547 11.5 13.5547H7.40625V17.3203C7.40625 18.2578 6.74219 19.5703 6.49219 19.5703C6.24219 19.5703 5.57812 18.2578 5.57812 17.3203V13.5547H1.48438C0.679688 13.5547 0.140625 13.0312 0.140625 12.25Z"></path></svg>
                            <svg class="pin-inactive" width="13" height="20" viewBox="0 0 13 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path opacity="0.5" d="M1.48438 13.5547C0.679688 13.5547 0.140625 13.0312 0.140625 12.25C0.140625 10.5156 1.50781 8.85156 3.55469 8.01562L3.80469 4.25781C2.77344 3.57031 1.86719 2.85156 1.47656 2.34375C1.24219 2.05469 1.13281 1.74219 1.13281 1.46094C1.13281 0.875 1.57812 0.453125 2.22656 0.453125H10.7578C11.4062 0.453125 11.8516 0.875 11.8516 1.46094C11.8516 1.74219 11.7422 2.05469 11.5078 2.34375C11.1172 2.85156 10.2188 3.57031 9.17969 4.25781L9.42969 8.01562C11.4766 8.85156 12.8438 10.5156 12.8438 12.25C12.8438 13.0312 12.3047 13.5547 11.5 13.5547H7.40625V17.3203C7.40625 18.2578 6.74219 19.5703 6.49219 19.5703C6.24219 19.5703 5.57812 18.2578 5.57812 17.3203V13.5547H1.48438ZM6.49219 7.44531C6.92969 7.44531 7.35156 7.47656 7.75781 7.54688L7.53125 3.55469C7.52344 3.38281 7.5625 3.29688 7.69531 3.21875C8.5625 2.76562 9.23438 2.28125 9.46094 2.07812C9.53125 2.00781 9.49219 1.92969 9.41406 1.92969H3.57812C3.5 1.92969 3.45312 2.00781 3.52344 2.07812C3.75 2.28125 4.42188 2.76562 5.28906 3.21875C5.42188 3.29688 5.46094 3.38281 5.45312 3.55469L5.22656 7.54688C5.63281 7.47656 6.05469 7.44531 6.49219 7.44531ZM1.92188 11.9844H11.0625C11.1797 11.9844 11.2344 11.9141 11.2109 11.7734C10.9922 10.3906 9.08594 8.96875 6.49219 8.96875C3.89844 8.96875 1.99219 10.3906 1.77344 11.7734C1.75 11.9141 1.80469 11.9844 1.92188 11.9844Z"></path></svg>
                        </div>
                    </div>
                     <div class="DLP_HStack_8">
                        <div class="DLP_Input_Button_Style_1_Active DLP_Magnetic_Hover_1 DLP_NoSelect duorain-infinity-button" style="width: 48px; padding: 0;">
                            <p class="DLP_Text_Style_1" style="color: #007AFF; font-size: 24px; line-height: 1;">#</p>
                        </div>
                        <div class="DLP_Input_Style_1_Active">
                            <input type="text" placeholder="0" class="DLP_Input_Input_Style_1 duorain-value-input" data-input-for="practice-solve">
                        </div>
                        <div class="DLP_Input_Button_Style_1_Active DLP_Magnetic_Hover_1 DLP_NoSelect duorain-gradient-button" data-action="start-practice-solve"><p class="DLP_Text_Style_1" style="color: #FFF;">START</p></div>
                    </div>
                </div>
                <div class="DLP_VStack_8 duorain-feature-item" data-farm-id="listen-solve">
                    <div class="DLP_HStack_8 duorain-feature-header">
                        <p class="DLP_Text_Style_1 DLP_NoSelect" style="align-self: stretch; opacity: 0.8;">How many listening practices would you like to solve?</p>
                        <div class="duorain-pin-icon">
                            <svg class="pin-active" width="13" height="20" viewBox="0 0 13 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M0.140625 12.25C0.140625 10.5156 1.50781 8.80469 3.73438 7.96875L3.98438 4.25781C2.77344 3.57812 1.875 2.85156 1.47656 2.35156C1.24219 2.05469 1.13281 1.74219 1.13281 1.46094C1.13281 0.875 1.57812 0.453125 2.22656 0.453125H10.7578C11.4062 0.453125 11.8516 0.875 11.8516 1.46094C11.8516 1.74219 11.7422 2.05469 11.5078 2.35156C11.1094 2.85156 10.2109 3.57031 9 4.25781L9.25781 7.96875C11.4766 8.80469 12.8438 10.5156 12.8438 12.25C12.8438 13.0312 12.3047 13.5547 11.5 13.5547H7.40625V17.3203C7.40625 18.2578 6.74219 19.5703 6.49219 19.5703C6.24219 19.5703 5.57812 18.2578 5.57812 17.3203V13.5547H1.48438C0.679688 13.5547 0.140625 13.0312 0.140625 12.25Z"></path></svg>
                            <svg class="pin-inactive" width="13" height="20" viewBox="0 0 13 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path opacity="0.5" d="M1.48438 13.5547C0.679688 13.5547 0.140625 13.0312 0.140625 12.25C0.140625 10.5156 1.50781 8.85156 3.55469 8.01562L3.80469 4.25781C2.77344 3.57031 1.86719 2.85156 1.47656 2.34375C1.24219 2.05469 1.13281 1.74219 1.13281 1.46094C1.13281 0.875 1.57812 0.453125 2.22656 0.453125H10.7578C11.4062 0.453125 11.8516 0.875 11.8516 1.46094C11.8516 1.74219 11.7422 2.05469 11.5078 2.34375C11.1172 2.85156 10.2188 3.57031 9.17969 4.25781L9.42969 8.01562C11.4766 8.85156 12.8438 10.5156 12.8438 12.25C12.8438 13.0312 12.3047 13.5547 11.5 13.5547H7.40625V17.3203C7.40625 18.2578 6.74219 19.5703 6.49219 19.5703C6.24219 19.5703 5.57812 18.2578 5.57812 17.3203V13.5547H1.48438ZM6.49219 7.44531C6.92969 7.44531 7.35156 7.47656 7.75781 7.54688L7.53125 3.55469C7.52344 3.38281 7.5625 3.29688 7.69531 3.21875C8.5625 2.76562 9.23438 2.28125 9.46094 2.07812C9.53125 2.00781 9.49219 1.92969 9.41406 1.92969H3.57812C3.5 1.92969 3.45312 2.00781 3.52344 2.07812C3.75 2.28125 4.42188 2.76562 5.28906 3.21875C5.42188 3.29688 5.46094 3.38281 5.45312 3.55469L5.22656 7.54688C5.63281 7.47656 6.05469 7.44531 6.49219 7.44531ZM1.92188 11.9844H11.0625C11.1797 11.9844 11.2344 11.9141 11.2109 11.7734C10.9922 10.3906 9.08594 8.96875 6.49219 8.96875C3.89844 8.96875 1.99219 10.3906 1.77344 11.7734C1.75 11.9141 1.80469 11.9844 1.92188 11.9844Z"></path></svg>
                        </div>
                    </div>
                     <div class="DLP_HStack_8">
                        <div class="DLP_Input_Button_Style_1_Active DLP_Magnetic_Hover_1 DLP_NoSelect duorain-infinity-button" style="width: 48px; padding: 0;">
                             <p class="DLP_Text_Style_1" style="color: #007AFF; font-size: 24px; line-height: 1;">#</p>
                        </div>
                        <div class="DLP_Input_Style_1_Active">
                            <input type="text" placeholder="0" class="DLP_Input_Input_Style_1 duorain-value-input" data-input-for="listen-solve">
                        </div>
                        <div class="DLP_Input_Button_Style_1_Active DLP_Magnetic_Hover_1 DLP_NoSelect duorain-gradient-button" data-action="start-listen-solve"><p class="DLP_Text_Style_1" style="color: #FFF;">START</p></div>
                    </div>
                </div>
                <div class="DLP_VStack_8 duorain-feature-item" data-farm-id="lesson-solve">
                     <div class="DLP_HStack_8 duorain-feature-header">
                        <p class="DLP_Text_Style_1 DLP_NoSelect" style="align-self: stretch; opacity: 0.8;">Which and how many lessons would you like to repeat?</p>
                        <div class="duorain-pin-icon">
                            <svg class="pin-active" width="13" height="20" viewBox="0 0 13 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M0.140625 12.25C0.140625 10.5156 1.50781 8.80469 3.73438 7.96875L3.98438 4.25781C2.77344 3.57812 1.875 2.85156 1.47656 2.35156C1.24219 2.05469 1.13281 1.74219 1.13281 1.46094C1.13281 0.875 1.57812 0.453125 2.22656 0.453125H10.7578C11.4062 0.453125 11.8516 0.875 11.8516 1.46094C11.8516 1.74219 11.7422 2.05469 11.5078 2.35156C11.1094 2.85156 10.2109 3.57031 9 4.25781L9.25781 7.96875C11.4766 8.80469 12.8438 10.5156 12.8438 12.25C12.8438 13.0312 12.3047 13.5547 11.5 13.5547H7.40625V17.3203C7.40625 18.2578 6.74219 19.5703 6.49219 19.5703C6.24219 19.5703 5.57812 18.2578 5.57812 17.3203V13.5547H1.48438C0.679688 13.5547 0.140625 13.0312 0.140625 12.25Z"></path></svg>
                            <svg class="pin-inactive" width="13" height="20" viewBox="0 0 13 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path opacity="0.5" d="M1.48438 13.5547C0.679688 13.5547 0.140625 13.0312 0.140625 12.25C0.140625 10.5156 1.50781 8.85156 3.55469 8.01562L3.80469 4.25781C2.77344 3.57031 1.86719 2.85156 1.47656 2.34375C1.24219 2.05469 1.13281 1.74219 1.13281 1.46094C1.13281 0.875 1.57812 0.453125 2.22656 0.453125H10.7578C11.4062 0.453125 11.8516 0.875 11.8516 1.46094C11.8516 1.74219 11.7422 2.05469 11.5078 2.34375C11.1172 2.85156 10.2188 3.57031 9.17969 4.25781L9.42969 8.01562C11.4766 8.85156 12.8438 10.5156 12.8438 12.25C12.8438 13.0312 12.3047 13.5547 11.5 13.5547H7.40625V17.3203C7.40625 18.2578 6.74219 19.5703 6.49219 19.5703C6.24219 19.5703 5.57812 18.2578 5.57812 17.3203V13.5547H1.48438ZM6.49219 7.44531C6.92969 7.44531 7.35156 7.47656 7.75781 7.54688L7.53125 3.55469C7.52344 3.38281 7.5625 3.29688 7.69531 3.21875C8.5625 2.76562 9.23438 2.28125 9.46094 2.07812C9.53125 2.00781 9.49219 1.92969 9.41406 1.92969H3.57812C3.5 1.92969 3.45312 2.00781 3.52344 2.07812C3.75 2.28125 4.42188 2.76562 5.28906 3.21875C5.42188 3.29688 5.46094 3.38281 5.45312 3.55469L5.22656 7.54688C5.63281 7.47656 6.05469 7.44531 6.49219 7.44531ZM1.92188 11.9844H11.0625C11.1797 11.9844 11.2344 11.9141 11.2109 11.7734C10.9922 10.3906 9.08594 8.96875 6.49219 8.96875C3.89844 8.96875 1.99219 10.3906 1.77344 11.7734C1.75 11.9141 1.80469 11.9844 1.92188 11.9844Z"></path></svg>
                        </div>
                    </div>
                     <div class="DLP_HStack_8">
                            <div class="DLP_Input_Style_1_Active">
                                <div style="display: flex; align-items: center; gap: 8px; width: 100%; justify-content: flex-end;">
                                    <p class="DLP_Text_Style_1 DLP_NoSelect" style="color: #007AFF; opacity: 0.5;">Unit:</p>
                                    <input type="text" value="1" placeholder="1" class="DLP_Input_Input_Style_1" data-input-for="lesson-unit" style="width: 30px;">
                                    <p class="DLP_Text_Style_1 DLP_NoSelect" style="color: #007AFF; opacity: 0.5;">Lesson:</p>
                                    <input type="text" value="1" placeholder="1" class="DLP_Input_Input_Style_1" data-input-for="lesson-level" style="width: 30px;">
                                </div>
                            </div>
                        </div>
                    <div class="DLP_HStack_8">
                        <div class="DLP_Input_Button_Style_1_Active DLP_Magnetic_Hover_1 DLP_NoSelect duorain-infinity-button" style="width: 48px; padding: 0;">
                             <p class="DLP_Text_Style_1" style="color: #007AFF; font-size: 24px; line-height: 1;">#</p>
                        </div>
                        <div class="DLP_Input_Style_1_Active">
                            <input type="text" placeholder="0" class="DLP_Input_Input_Style_1 duorain-value-input" data-input-for="lesson-solve">
                        </div>
                        <div class="DLP_Input_Button_Style_1_Active DLP_Magnetic_Hover_1 DLP_NoSelect duorain-gradient-button" data-action="start-lesson-solve"><p class="DLP_Text_Style_1" style="color: #FFF;">START</p></div>
                    </div>
                </div>
            </div>
        </div>
    `;
        const uiStyle = `
        @font-face {
            font-family: 'DuoRain';
            src: url(https://raw.githubusercontent.com/SlimyThor/DuoRain.Site/main/DuoRain.woff2) format('woff2');
            font-weight: 600;
        }
 
        :root {
            --duorain-bg-color: rgb(var(--color-snow), 0.65);
            --duorain-text-color: rgb(var(--color-black-text));
            --duorain-border-color: rgb(var(--color-eel), 0.10);
            --duorain-icon-btn-outline: rgba(0,0,0,0.08);
            --duorain-input-bg: rgba(0, 122, 255, 0.10);
            --duorain-input-outline: rgba(0, 122, 255, 0.20);
            --duorain-input-text: #007AFF;
            --duorain-input-placeholder: rgba(0, 122, 255, 0.5);
            --duorain-status-box-bg: rgba(0, 0, 0, 0.05);
            --duorain-idle-bg: rgb(var(--color-eel), 0.10);
            --duorain-idle-text: rgb(var(--color-eel));
            --duorain-running-bg: rgba(255, 149, 0, 0.2);
            --duorain-running-text: #f57c00;
            --duorain-tooltip-bg: #333;
            --duorain-tooltip-text: #fff;
        }
        html._2L9MF {
            --duorain-bg-color: rgb(var(--color-gray-9), 0.7);
            --duorain-text-color: rgb(var(--color-snow));
            --duorain-border-color: rgb(var(--color-gray-2), 0.10);
            --duorain-icon-btn-outline: rgba(255,255,255,0.2);
            --duorain-input-bg: rgba(0, 0, 0, 0.2);
            --duorain-input-outline: rgba(0, 122, 255, 0.20);
            --duorain-input-text: #89CFF0;
            --duorain-input-placeholder: rgba(137, 207, 240, 0.5);
            --duorain-status-box-bg: rgba(0,0,0,0.2);
            --duorain-idle-bg: rgba(120, 120, 128, 0.2);
            --duorain-idle-text: rgba(255,255,255,0.6);
            --duorain-running-bg: rgba(255, 149, 0, 0.3);
            --duorain-running-text: #FFD580;
            --duorain-tooltip-bg: #F2F2F2;
            --duorain-tooltip-text: #333;
        }
        #duorain-solver-button {
            background: rgba(0, 122, 255, 0.1);
            outline: 2px solid rgba(0, 200, 255, 0.2);
            backdrop-filter: blur(16px);
        }
        .duorain-neon-glow {
             color: hsl(210, 100%, 50%);
             text-shadow: 0 0 5px hsl(210, 100%, 50%),
                          0 0 10px hsl(210, 100%, 50%),
                          0 0 20px hsl(210, 100%, 50%),
                          0 0 40px hsl(210, 100%, 50%);
        }
 
        .duorain-autosolver-text {
             color: #FF9500 !important;
             text-shadow: none;
        }
 
       #duorain-solver-button .open-svg {
            stroke: hsl(210, 100%, 50%);
             filter: drop-shadow(0 0 2px hsl(210, 100%, 50%)) drop-shadow(0 0 5px hsl(210, 100%, 50%));
        }
        #duorain-solver-button:hover {
            filter: brightness(1.2);
        }
        @keyframes fall {
            to { transform: translateY(60px) rotate(10deg); }
        }
        .DLP_NoSelect { -webkit-user-select: none; -ms-user-select: none; user-select: none; }
        .DLP_Text_Style_1 { font-family: "DuoRain", sans-serif; font-size: 16px; font-weight: 500; margin: 0; transition: color 0.4s ease, opacity 0.4s, filter 0.4s; }
        .DLP_Text_Style_2 { font-family: "DuoRain", sans-serif; font-size: 24px; font-weight: 500; margin: 0; transition: color 0.4s ease; }
        .duorain-neon-blue { color: #03A9F4; text-shadow: 0 0 2px #03A9F4, 0 0 6px #2196F3; }
        .DLP_Magnetic_Hover_1 { transition: filter 0.4s cubic-bezier(0.16, 1, 0.32, 1), transform 0.4s cubic-bezier(0.16, 1, 0.32, 1); cursor: pointer; }
        .DLP_Magnetic_Hover_1:hover { filter: brightness(0.9); transform: scale(1.05); }
        .DLP_Magnetic_Hover_1:active { filter: brightness(0.9); transform: scale(0.9); }
        .DLP_Main { display: inline-flex; flex-direction: column; justify-content: flex-end; align-items: flex-end; gap: 8px; position: fixed; right: 16px; bottom: 16px; z-index: 9999; transition: bottom 0.8s cubic-bezier(0.16, 1, 0.32, 1); }
        .duorain-page { display: flex; flex-direction: column; width: 100%; transition: opacity 0.2s ease-out, filter .4s ease-out; }
        .duorain-page-hidden { display: none !important; }
        .DLP_Main_Box { display: flex; width: 340px; padding: 24px 20px; box-sizing: border-box; flex-direction: column; gap: 8px; border-radius: 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.25); transition: background 0.4s ease, border-color 0.4s ease, backdrop-filter 0.4s ease, opacity 0.8s cubic-bezier(0.16, 1, 0.32, 1), filter 0.8s cubic-bezier(0.16, 1, 0.32, 1), width 0.4s cubic-bezier(0.16, 1, 0.32, 1), height 0.4s cubic-bezier(0.16, 1, 0.32, 1); background: var(--duorain-bg-color); backdrop-filter: blur(16px) saturate(180%); -webkit-backdrop-filter: blur(16px) saturate(180%); border: 1px solid var(--duorain-border-color); overflow: hidden; }
        .DLP_Main_Box.duorain-wide-box { width: 420px; }
        .DLP_HStack_Auto_Top, .DLP_HStack_4, .DLP_HStack_8 { display: flex; align-items: center; align-self: stretch; }
        .DLP_HStack_Auto_Top { justify-content: space-between; align-items: flex-start; }
        .DLP_HStack_4 { gap: 4px; }
        .DLP_HStack_8 { gap: 8px; }
        .DLP_VStack_8 { display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 8px; align-self: stretch; }
        .DLP_Button_Style_1 { display: flex; height: 40px; padding: 10px 12px; box-sizing: border-box; align-items: center; gap: 6px; flex: 1 0 0; border-radius: 12px; transition: width 0.8s cubic-bezier(0.77,0,0.18,1), background 0.8s cubic-bezier(0.16, 1, 0.32, 1), outline 0.8s cubic-bezier(0.16, 1, 0.32, 1); }
        .duorain-icon-button { justify-content: center; flex: none; width: 40px; padding: 10px; transition: background-color 0.4s, outline-color 0.4s; }
        #DLP_Main_GitHub_Button_1_ID, #DLP_Main_GitHub_Button_1_ID-solver { background: #333333; }
        #DLP_Main_Discord_Button_1_ID, #DLP_Main_Discord_Button_1_ID-solver { background: #5865F2; }
        #duorain-settings-button, #duorain-settings-button-solver { background: linear-gradient(110deg,hsl(154deg 70% 50%) 0%,hsl(166deg 100% 42%) 6%,hsl(172deg 100% 42%) 13%,hsl(179deg 100% 41%) 19%,hsl(185deg 100% 43%) 25%,hsl(189deg 100% 46%) 31%,hsl(193deg 100% 48%) 37%,hsl(195deg 100% 48%) 44%,hsl(199deg 92% 54%) 50%,hsl(203deg 78% 52%) 56%,hsl(207deg 64% 50%) 63%,hsl(213deg 56% 48%) 69%,hsl(219deg 49% 44%) 75%,hsl(228deg 42% 40%) 81%,hsl(240deg 36% 36%) 87%,hsl(255deg 44% 28%) 94%,hsl(269deg 58% 20%) 100%); outline: none; }
        .duorain-settings-svg { width: 22px; height: 22px; }
        .duorain-settings-svg path { fill: #FFF; transition: fill 0.4s ease; }
        .DLP_Input_Style_1_Active { display: flex; height: 48px; padding: 16px; box-sizing: border-box; align-items: center; flex: 1 0 0; gap: 6px; border-radius: 8px; transition: background 0.4s ease, outline 0.4s ease; background: var(--duorain-input-bg); outline: 2px solid var(--duorain-input-outline); }
        .duorain-infinity-button { background: rgba(0, 122, 255, 0.10); outline: 2px solid rgba(0, 122, 255, 0.20); border-radius: 8px; }
        .duorain-infinity-button p { color: #007AFF; font-size: 24px; line-height: 1; }
        .duorain-gradient-button, .duorain-super-button { background: linear-gradient(110deg,hsl(154deg 70% 50%) 0%,hsl(166deg 100% 42%) 6%,hsl(172deg 100% 42%) 13%,hsl(179deg 100% 41%) 19%,hsl(185deg 100% 43%) 25%,hsl(189deg 100% 46%) 31%,hsl(193deg 100% 48%) 37%,hsl(195deg 100% 48%) 44%,hsl(199deg 92% 54%) 50%,hsl(203deg 78% 52%) 56%,hsl(207deg 64% 50%) 63%,hsl(213deg 56% 48%) 69%,hsl(219deg 49% 44%) 75%,hsl(228deg 42% 40%) 81%,hsl(240deg 36% 36%) 87%,hsl(255deg 44% 28%) 94%,hsl(269deg 58% 20%) 100%); box-shadow: 0 4px 15px rgba(28, 176, 246, 0.4); border: none; border-radius: 12px; }
        #duorain-solver-page .duorain-gradient-button { border-radius: 8px; }
        .DLP_Input_Button_Style_1_Active { display: flex; height: 48px; padding: 12px; box-sizing: border-box; justify-content: center; align-items: center; gap: 6px; }
        .DLP_Input_Button_Style_1_Active p { font-weight: 700; text-transform: uppercase; }
        .DLP_Input_Input_Style_1 { border: none; outline: none; background: none; text-align: right; font-family: "DuoRain", sans-serif; font-size: 16px; font-weight: 500; width: 100%; transition: color 0.4s ease; color: var(--duorain-input-text); }
        .DLP_Input_Input_Style_1::placeholder { transition: color 0.4s ease; color: var(--duorain-input-placeholder); }
        .DLP_Input_Input_Style_1:disabled { background-color: transparent; }
        #duorain-status-indicator { position: relative; overflow: hidden; justify-content: center; transition: all 0.3s ease; gap: 8px; }
        #duorain-rain-container { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
        .raindrop { position: absolute; bottom: 100%; width: 1px; height: 15px; background: linear-gradient(to bottom, rgba(0, 122, 255, 0), rgba(0, 122, 255, 0.8)); animation: fall linear infinite; transform: rotate(10deg); }
        #duorain-running-tasks-list-content, #duorain-settings-content { width: 100%; }
        .duorain-farm-status-box { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-radius: 12px; transition: background-color 0.4s ease; background-color: var(--duorain-status-box-bg); width: 100%; box-sizing: border-box; }
        .duorain-farm-status-box .status-text { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .duorain-farm-status-box .duorain-button-stop { padding: 4px 10px; border-radius: 8px; border: none; background-color: #FF3B30; color: white; font-size: 12px; font-weight: bold; cursor: pointer; transition: background-color 0.2s; }
        .duorain-setting-row { justify-content: space-between; align-items: center; width: 100%; }
        .duorain-small-input { height: 40px; width: 80px; padding: 12px; }
        .duorain-small-input input { text-align: center !important; }
        .duorain-info-icon { position: relative; cursor: help; display: flex; align-items: center; justify-content: center; }
        .duorain-info-icon svg { width: 20px; height: 20px; fill: var(--duorain-text-color); opacity: 0.7; transition: opacity 0.3s ease; }
        .duorain-info-icon:hover::after { content: attr(data-tooltip); position: absolute; top: 50%; right: 120%; transform: translateY(-50%); width: 240px; background-color: var(--duorain-tooltip-bg); color: var(--duorain-tooltip-text); padding: 8px 10px; border-radius: 6px; font-size: 14px; font-family: "DuoRain", sans-serif; font-weight: 500; z-index: 10001; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
        .duorain-info-icon:hover svg { opacity: 1; }
        .duorain-super-button { display: flex; height: 48px; justify-content: center; align-items: center; align-self: stretch; box-sizing: border-box; }
        .duorain-super-button p { font-family: "DuoRain", sans-serif; font-weight: 700; font-size: 16px; color: #FFF; text-shadow: 0 1px 2px rgba(0,0,0,0.25); margin: 0; text-transform: uppercase; }
        .DLP_Text_Style_1, .DLP_Text_Style_2 { color: var(--duorain-text-color); }
        .duorain-farm-status-box .status-text { color: var(--duorain-text-color); }
        #duorain-status-indicator.idle { background-color: var(--duorain-idle-bg); }
        #duorain-status-indicator.idle p { color: var(--duorain-idle-text); }
        #duorain-status-indicator.running { background-color: var(--duorain-running-bg); }
        #duorain-status-indicator.running p { color: var(--duorain-running-text); }
        #duorain-hide-button svg { transition: 0.4s; }
        .duorain-feature-grid { display: flex; flex-wrap: wrap; justify-content: space-between; align-content: flex-start; gap: 8px; width: 100%; }
        .duorain-feature-item { flex-basis: calc(50% - 4px); justify-content: space-between; }
        .duorain-feature-header { justify-content: space-between; align-items: center; width: 100%; }
        #duorain-pinned-items-container .duorain-feature-item, #duorain-solver-pinned-items-container .duorain-feature-item { width: 100%; flex-basis: 100%; }
        #duorain-pinned-items-container .duorain-pin-icon, #duorain-solver-pinned-items-container .duorain-pin-icon { display: none; }
        .duorain-pin-icon { cursor: pointer; }
        .duorain-pin-icon .pin-active { display: none; }
        .duorain-pin-icon.pinned .pin-active { display: block; }
        .duorain-pin-icon.pinned .pin-inactive { display: none; }
        .duorain-pin-icon svg { fill: var(--duorain-text-color); opacity: 0.5; width: 20px; height: 20px; }
        .duorain-notification { position: fixed; bottom: -100px; left: 50%; transform: translateX(-50%); background-color: var(--duorain-bg-color); color: var(--duorain-text-color); padding: 12px 20px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); z-index: 10001; transition: bottom 0.5s cubic-bezier(0.16, 1, 0.32, 1); font-family: "DuoRain", sans-serif; font-size: 16px; font-weight: 500; border: 1px solid var(--duorain-border-color); backdrop-filter: blur(10px); }
        .duorain-switch-container { position: relative; display: inline-block; width: 50px; height: 28px; }
        .duorain-switch { opacity: 0; width: 0; height: 0; }
        .duorain-switch-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--duorain-idle-bg); transition: .4s; border-radius: 28px; }
        .duorain-switch-slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 4px; bottom: 4px; background-color: white; transition: .4s; border-radius: 50%; }
        .duorain-switch:checked + .duorain-switch-slider { background-color: #2196F3; }
        .duorain-switch:checked + .duorain-switch-slider:before { transform: translateX(22px); }
        #duorain-solver-button .duorain-button-state { display: flex; align-items: center; justify-content: center; gap: 6px; transition: opacity 0.3s, visibility 0.3s; }
        #solver-state-4-0 svg { height: 18px; width: auto; }
        #solver-state-4-0 p { font-size: 18px; line-height: 1; }
        .duorain-infinity-button.infinity-active { box-shadow: 0 0 8px #007aff; }
        .duorain-feature-item[data-mode="infinity"] .DLP_Input_Style_1_Active { pointer-events: none; opacity: 0.5; }
 
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button {
            -webkit-appearance: none;
            margin: 0;
        }
        input[type=number] {
            -moz-appearance: textfield;
        }
        .duorain-input-with-spinner {
            position: relative;
            padding: 0;
            height: 40px;
            width: 100px;
            align-items: stretch;
        }
        .duorain-input-with-spinner .DLP_Input_Input_Style_1 {
            text-align: center !important;
            padding-right: 24px;
            padding-left: 12px;
            box-sizing: border-box;
            width: 100%;
        }
        .duorain-spinner-controls {
            position: absolute;
            right: 5px;
            top: 0;
            bottom: 0;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 2px;
        }
        .duorain-spinner-button {
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.1s ease, background-color 0.2s;
            border-radius: 4px;
            width: 18px;
            height: 18px;
        }
        .duorain-spinner-button:hover {
            background-color: rgba(0, 122, 255, 0.15);
        }
        .duorain-spinner-button:active {
            transform: scale(0.9);
        }
        .duorain-spinner-button svg {
            width: 100%;
            height: 100%;
        }
        .duorain-spinner-down-svg {
            transform: rotate(180deg);
        }
        `;
 
    document.body.insertAdjacentHTML('beforeend', uiHTML);
    GM_addStyle(uiStyle);
    GM_addStyle("#duorain-hide-button.duorain-show-mode{transform:translateY(-6px);transition:transform .28s cubic-bezier(.16,1,.32,1)}html:not(._2L9MF) #duorain-hide-button.duorain-show-mode{background:rgba(0,122,255,.08)!important;outline:2px solid rgba(0,122,255,.5)!important}html:not(._2L9MF) #duorain-hide-button.duorain-show-mode #hide-show-text{color:#007AFF!important;text-shadow:none}html:not(._2L9MF) #duorain-hide-button.duorain-show-mode #show-icon{fill:#007AFF!important;filter:none;transform:none}html._2L9MF #duorain-hide-button.duorain-show-mode{background:rgba(0,200,255,.08)!important;outline:2px solid rgba(0,200,255,.5)!important}html._2L9MF #duorain-hide-button.duorain-show-mode #hide-show-text{color:#00E5FF!important;text-shadow:0 0 8px rgba(0,229,255,.9),0 0 14px rgba(0,229,255,.6)}html._2L9MF #duorain-hide-button.duorain-show-mode #show-icon{fill:#00E5FF!important;filter:drop-shadow(0 0 6px rgba(0,229,255,.9)) drop-shadow(0 0 14px rgba(0,229,255,.5));transform:none}#duorain-hide-button.duorain-show-mode:hover{transform:translateY(-8px) scale(1.03)}");
 
 
    const pages = {
        main: document.getElementById('duorain-main-page'),
        tasks: document.getElementById('duorain-tasks-page'),
        settings: document.getElementById('duorain-settings-page'),
        more: document.getElementById('duorain-see-more-page'),
        solver: document.getElementById('duorain-solver-page'),
        solverMore: document.getElementById('duorain-solver-more-page')
 
    };
    let currentPage = pages.main;
    const mainBox = document.querySelector('.DLP_Main_Box');
 
     function updateSolverButtonState(targetPage) {
        const autoState = document.getElementById('solver-state-auto');
        const s4State = document.getElementById('solver-state-4-0');
        if (targetPage === pages.main || targetPage === pages.tasks || targetPage === pages.settings || targetPage === pages.more) {
            autoState.style.display = 'flex';
            s4State.style.display = 'none';
        } else {
            autoState.style.display = 'none';
            s4State.style.display = 'flex';
        }
    }
 
 
    function switchToPage(targetPage) {
        if (isAnimating || currentPage === targetPage) return;
         updateSolverButtonState(targetPage);
 
        isAnimating = true;
        const oldHeight = mainBox.offsetHeight;
        currentPage.style.opacity = '0';
        currentPage.style.filter = 'blur(4px)';
        setTimeout(() => {
            currentPage.classList.add('duorain-page-hidden');
            targetPage.classList.remove('duorain-page-hidden');
            if (targetPage === pages.more || targetPage === pages.solverMore) {
                mainBox.classList.add('duorain-wide-box');
            } else {
                mainBox.classList.remove('duorain-wide-box');
            }
            const newHeight = targetPage.offsetHeight;
            mainBox.style.height = `${oldHeight}px`;
            requestAnimationFrame(() => {
                mainBox.style.height = `${newHeight}px`;
                setTimeout(() => {
                    targetPage.style.opacity = '1';
                    targetPage.style.filter = 'blur(0px)';
                    isAnimating = false;
                    mainBox.style.height = 'auto';
                }, 400);
            });
            currentPage = targetPage;
        }, 200);
    }
 
    document.getElementById('duorain-hide-button').addEventListener("click", () => {
        if (isAnimating) return;
        isUiHidden = !isUiHidden;
        hide(isUiHidden);
    });
 
    document.getElementById('duorain-solver-button').addEventListener('click', () => {
         if (currentPage === pages.solver || currentPage === pages.solverMore) {
            switchToPage(pages.main);
        } else {
            switchToPage(pages.solver);
        }
    });
 
    document.getElementById('duorain-solver-see-more-button').addEventListener('click', () => switchToPage(pages.solverMore));
 
    document.getElementById('duorain-status-indicator').addEventListener('click', () => {
        if (activeFarms.size > 0) switchToPage(pages.tasks);
    });
 
    document.getElementById('duorain-settings-button').addEventListener('click', () => switchToPage(pages.settings));
    document.getElementById('duorain-settings-button-solver').addEventListener('click', () => switchToPage(pages.settings));
 
 
    document.getElementById('duorain-see-more-button').addEventListener('click', () => switchToPage(pages.more));
   document.querySelectorAll('.duorain-back-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const targetPageName = e.currentTarget.dataset.target || 'main';
            const targetPage = pages[targetPageName];
            if(targetPage) {
                switchToPage(targetPage);
            }
        });
    });
 
    document.getElementById('DLP_Main_GitHub_Button_1_ID').addEventListener('click', () => { window.open('https://github.com/OracleMythix/DuoRain-BETA', '_blank'); });
    document.getElementById('DLP_Main_GitHub_Button_1_ID-solver').addEventListener('click', () => { window.open('https://github.com/OracleMythix/DuoRain-BETA', '_blank'); });
    document.getElementById('DLP_Main_Discord_Button_1_ID').addEventListener('click', () => { window.open('https://discord.com/invite/yawq7BxJPy', '_blank'); });
    document.getElementById('DLP_Main_Discord_Button_1_ID-solver').addEventListener('click', () => { window.open('https://discord.com/invite/yawq7BxJPy', '_blank'); });
 
    document.getElementById('duorain-ui-wrapper').addEventListener('click', e => {
        const infinityButton = e.target.closest('.duorain-infinity-button');
        if (infinityButton) {
            const featureItem = infinityButton.closest('.duorain-feature-item');
            const input = featureItem.querySelector('.duorain-value-input');
            const infinityP = infinityButton.querySelector('p');
 
            if (featureItem.dataset.mode === 'infinity') {
                featureItem.removeAttribute('data-mode');
                infinityButton.classList.remove('infinity-active');
                if (infinityP) infinityP.innerHTML = '#';
                if(input) {
                    input.disabled = false;
                    input.value = '';
                }
            } else {
                featureItem.dataset.mode = 'infinity';
                infinityButton.classList.add('infinity-active');
                if (infinityP) infinityP.innerHTML = '∞';
                if(input) {
                    input.disabled = true;
                    input.value = '';
                }
            }
        }
    });
 
 
    hide(false, true);
}
 
function showDuoRainNotification(message) {
    const existing = document.querySelector('.duorain-notification');
    if (existing) existing.remove();
    const notification = document.createElement('div');
    notification.className = 'duorain-notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    requestAnimationFrame(() => { notification.style.bottom = '20px'; });
    setTimeout(() => {
        notification.style.bottom = '-100px';
        setTimeout(() => notification.remove(), 500);
    }, 3000);
}
 
function setButtonState(button, text, iconToShow, iconToHide, bgColor, outlineColor, textColor, delay, callback) {
    const textElement = button.querySelector('p');
    if (!textElement) return;
    button.style.background = bgColor ?? '';
    button.style.outline = outlineColor ?? '';
    textElement.style.color = textColor ?? '';
    let previousText = textElement.textContent;
    textElement.textContent = text;
    if (iconToShow) iconToShow.style.display = 'block';
    if (iconToHide) iconToHide.style.display = 'none';
    let buttonNewWidth = button.offsetWidth;
    textElement.textContent = previousText;
    if (iconToShow) iconToShow.style.display = 'none';
    if (iconToHide) iconToHide.style.display = 'block';
    button.style.width = `${button.offsetWidth}px`;
    requestAnimationFrame(() => {
        textElement.style.filter = 'blur(4px)';
        textElement.style.opacity = '0';
        if (iconToHide) {
            iconToHide.style.transition = '0.4s';
            iconToHide.style.filter = 'blur(4px)';
            iconToHide.style.opacity = '0';
        }
        button.style.width = `${buttonNewWidth}px`;
    });
    setTimeout(() => {
        textElement.style.transition = '0s';
        textElement.offsetHeight;
        textElement.style.transition = '0.4s';
        if (iconToShow) iconToShow.style.display = 'block';
        if (iconToHide) iconToHide.style.display = 'none';
        if (iconToShow) {
            iconToShow.style.transition = '0.4s';
            iconToShow.style.filter = 'blur(4px)';
            iconToShow.style.opacity = '0';
        }
        textElement.textContent = text;
        requestAnimationFrame(() => {
            textElement.style.filter = '';
            textElement.style.opacity = '';
            if (iconToShow) {
                iconToShow.style.filter = '';
                iconToShow.style.opacity = '1';
            }
        });
        setTimeout(() => {
            button.style.width = '';
            if(callback) callback();
        }, 400);
    }, delay);
}
 
function hide(value, immediate = false) {
    if (isAnimating && !immediate) return;
    isAnimating = true;
    let wrapper = document.getElementById('duorain-ui-wrapper');
    let mainBox = wrapper.querySelector('.DLP_Main_Box');
    let hideButton = document.getElementById('duorain-hide-button');
    let solverButton = document.getElementById('duorain-solver-button');
 
    const transitionDuration = immediate ? '0s' : '0.8s cubic-bezier(0.16, 1, 0.32, 1)';
    wrapper.style.transition = `bottom ${transitionDuration}`;
    mainBox.style.transition = `opacity ${transitionDuration}, filter ${transitionDuration}`;
    solverButton.style.transition = `opacity ${transitionDuration}, filter ${transitionDuration}`;
 
    let mainBoxHeight = mainBox.offsetHeight;
    if (value) {
        setButtonState(hideButton, "Show", hideButton.querySelector("#show-icon"), hideButton.querySelector("#hide-icon"), null, null, null, immediate ? 0 : 400, () => hideButton.classList.add("duorain-show-mode"));
        wrapper.style.bottom = `-${mainBoxHeight + 8}px`;
        mainBox.style.filter = "blur(8px)";
        mainBox.style.opacity = "0";
        solverButton.style.filter = "blur(8px)";
        solverButton.style.opacity = "0";
        solverButton.style.pointerEvents = "none";
    } else {
        setButtonState(hideButton, "Hide", hideButton.querySelector("#hide-icon"), hideButton.querySelector("#show-icon"), "#007AFF", "2px solid rgba(0, 0, 0, 0.20)", "#FFF", immediate ? 0 : 400, () => hideButton.classList.remove("duorain-show-mode"));
        wrapper.style.bottom = "16px";
        mainBox.style.filter = "";
        mainBox.style.opacity = "";
        solverButton.style.filter = "";
        solverButton.style.opacity = "";
        solverButton.style.pointerEvents = "auto";
    }
    setTimeout(() => { isAnimating = false }, immediate ? 0 : 800);
}
 
function renderItems() {
    const pinnedContainer = document.getElementById('duorain-pinned-items-container');
    const seeMoreContainer = document.getElementById('duorain-see-more-content');
    const templatesContainer = document.getElementById('duorain-feature-templates');
    pinnedContainer.innerHTML = '';
    seeMoreContainer.innerHTML = '';
    Array.from(templatesContainer.children).forEach(template => {
        const farmId = template.dataset.farmId;
        const seeMoreClone = template.cloneNode(true);
        seeMoreContainer.appendChild(seeMoreClone);
        if (settings.pins.includes(farmId)) {
            const pinnedClone = template.cloneNode(true);
            pinnedContainer.appendChild(pinnedClone);
        }
    });
    updatePinIcons();
}
 function renderSolverItems() {
    const pinnedContainer = document.getElementById('duorain-solver-pinned-items-container');
    const seeMoreContainer = document.getElementById('duorain-solver-see-more-content');
    const templatesContainer = document.getElementById('duorain-solver-feature-templates');
    pinnedContainer.innerHTML = '';
    seeMoreContainer.innerHTML = '';
    Array.from(templatesContainer.children).forEach(template => {
        const farmId = template.dataset.farmId;
        const seeMoreClone = template.cloneNode(true);
        seeMoreContainer.appendChild(seeMoreClone);
        if (settings.solverPins.includes(farmId)) {
            const pinnedClone = template.cloneNode(true);
            pinnedContainer.appendChild(pinnedClone);
        }
    });
    updateSolverPinIcons();
}
 
 
function updatePinIcons() {
    document.querySelectorAll('#duorain-see-more-content .duorain-pin-icon').forEach(icon => {
        const farmId = icon.closest('.duorain-feature-item').dataset.farmId;
        if (settings.pins.includes(farmId)) {
            icon.classList.add('pinned');
        } else {
            icon.classList.remove('pinned');
        }
    });
}
 
 function updateSolverPinIcons() {
    document.querySelectorAll('#duorain-solver-see-more-content .duorain-pin-icon').forEach(icon => {
        const farmId = icon.closest('.duorain-feature-item').dataset.farmId;
        if (settings.solverPins.includes(farmId)) {
            icon.classList.add('pinned');
        } else {
            icon.classList.remove('pinned');
        }
    });
}
 
function setupPinEventListeners() {
    document.getElementById('duorain-see-more-page').addEventListener('click', (e) => {
        const pinIcon = e.target.closest('.duorain-pin-icon');
        if (pinIcon) {
            const farmId = pinIcon.closest('.duorain-feature-item').dataset.farmId;
            const index = settings.pins.indexOf(farmId);
            if (index > -1) {
                settings.pins.splice(index, 1);
            } else {
                if (settings.pins.length >= 3) {
                    showDuoRainNotification("You can only pin up to 3 features.");
                    return;
                }
                settings.pins.push(farmId);
            }
            saveSettings();
            renderItems();
        }
    });
}
function setupSolverPinEventListeners() {
    document.getElementById('duorain-solver-more-page').addEventListener('click', (e) => {
        const pinIcon = e.target.closest('.duorain-pin-icon');
        if (pinIcon) {
            const farmId = pinIcon.closest('.duorain-feature-item').dataset.farmId;
            const index = settings.solverPins.indexOf(farmId);
            if (index > -1) {
                settings.solverPins.splice(index, 1);
            } else {
                if (settings.solverPins.length >= 3) {
                    showDuoRainNotification("You can only pin up to 3 features.");
                    return;
                }
                settings.solverPins.push(farmId);
            }
            saveSettings();
            renderSolverItems();
        }
    });
}
 
 
const activeFarms = new Map();
 
function createRain() {
    if (raindrops.length > 0) return;
    const rainContainer = document.getElementById('duorain-rain-container');
    for (let i = 0; i < 20; i++) {
        const raindrop = document.createElement('div');
        raindrop.className = 'raindrop';
        raindrop.style.left = `${Math.random() * 100}%`;
        raindrop.style.animationDuration = `${0.5 + Math.random() * 0.3}s`;
        raindrop.style.animationDelay = `${Math.random() * 2}s`;
        rainContainer.appendChild(raindrop);
        raindrops.push(raindrop);
    }
}
 
function clearRain() {
    raindrops.forEach(drop => drop.remove());
    raindrops.length = 0;
}
 
function updateMasterStatus() {
    const indicator = document.getElementById('duorain-status-indicator');
    const indicatorText = document.getElementById('duorain-status-indicator-text');
    const farmCount = activeFarms.size;
    if (farmCount > 0) {
        indicator.classList.remove('idle');
        indicator.classList.add('running');
        indicatorText.textContent = `Running (${farmCount})`;
        createRain();
    } else {
        indicator.classList.remove('running');
        indicator.classList.add('idle');
        indicatorText.textContent = 'Status: Idle';
        clearRain();
    }
}
 
function addFarmUI(farmId, message) {
    const container = document.getElementById('duorain-running-tasks-list-content');
    if (!container) return;
    const farmBox = document.createElement('div');
    farmBox.id = `farm-status-${farmId}`;
    farmBox.className = 'duorain-farm-status-box';
    farmBox.innerHTML = `<p class="DLP_Text_Style_1 status-text">${message}</p><button class="duorain-button-stop">Stop</button>`;
    farmBox.querySelector('.duorain-button-stop').addEventListener('click', () => stopFarm(farmId));
    container.appendChild(farmBox);
    updateMasterStatus();
}
 
function updateFarmStatus(farmId, message) {
    const farmBox = document.getElementById(`farm-status-${farmId}`);
    if (farmBox) {
        farmBox.querySelector('.status-text').textContent = message;
    }
}
 
function finalizeFarmUI(farmId, finalMessage) {
    const farmBox = document.getElementById(`farm-status-${farmId}`);
    if (farmBox) {
        farmBox.querySelector('.status-text').textContent = finalMessage;
        const stopButton = farmBox.querySelector('.duorain-button-stop');
        if (stopButton) stopButton.remove();
        setTimeout(() => {
            if(farmBox) farmBox.remove();
            updateMasterStatus();
        }, 5000);
    }
}
 
function stopFarm(farmId, isManual = true) {
    if (!activeFarms.has(farmId)) return;
    activeFarms.set(farmId, false);
    activeFarms.delete(farmId);
    updateMasterStatus();
    document.querySelectorAll(`[data-action="start-${farmId}-farm"], [data-action="run-fullquests"], [data-action="start-${farmId}"], [data-action^="grant-"]`).forEach(btn => {
        btn.style.pointerEvents = 'auto';
        btn.style.opacity = 1;
    });
 
     if (farmId.includes('-solve')) {
        sessionStorage.removeItem(AUTO_CLICK_KEY);
        sessionStorage.removeItem(SOLVER_SESSION_KEY);
        sessionStorage.removeItem(MODIFIER_KEY);
        if (isManual) {
             finalizeFarmUI(farmId, "Stopped. Returning home...");
             setTimeout(() => {window.location.href = "https://duolingo.com/learn";},1000)
        }
    }
 
    if (isManual) {
        finalizeFarmUI(farmId, "Stopped.");
    }
}
 
function getDuoHeaders(jwt) {
    return {
        'Accept': 'application/json, text/plain, */*',
        'user-agent': navigator.userAgent,
        'authorization': `Bearer ${jwt}`,
        'content-type': 'application/json'
    };
}
 
function getUserData(jwt, sub) {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: "GET",
            url: `https://www.duolingo.com/2017-06-30/users/${sub}?fields=learningLanguage,fromLanguage,streakData,timezone,tz`,
            headers: { 'authorization': `Bearer ${jwt}` },
            onload: (response) => {
                if (response.status >= 200 && response.status < 300) {
                    const data = JSON.parse(response.responseText);
                    resolve({
                        fromLanguage: data.fromLanguage || 'en',
                        learningLanguage: data.learningLanguage || 'es',
                        streakStartDate: data.streakData?.currentStreak?.startDate,
                        timezone: data.timezone || data.tz || 'UTC'
                    });
                } else { reject(new Error(`HTTP error! status: ${response.status}`)); }
            },
            onerror: (error) => reject(error)
        });
    });
}
async function grantShopItem(jwt, uid, fromLang, toLang, itemName, friendlyName, quantity = 1) {
    showDuoRainNotification(`Granting ${friendlyName}...`);
    let successCount = 0;
    for (let i = 0; i < quantity; i++) {
        const success = await new Promise(resolve => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: `https://www.duolingo.com/2017-06-30/users/${uid}/shop-items`,
                headers: {
                    'accept': 'application/json',
                    'authorization': `Bearer ${jwt}`,
                    'content-type': 'application/json',
                    'user-agent': 'Duodroid/6.26.2 Dalvik/2.1.0 (Linux; U; Android 13; Pixel 7 Build/TQ3A.230805.001)',
                    'x-amzn-trace-id': `User=${uid}`
                },
                data: JSON.stringify({
                    itemName: itemName,
                    isFree: true,
                    consumed: true,
                    fromLanguage: fromLang,
                    learningLanguage: toLang
                }),
                onload: (res) => {
                    if (res.status >= 200 && res.status < 300) {
                        try {
                            const data = JSON.parse(res.responseText);
                            resolve(!!data.purchaseId);
                        } catch (e) {
                            resolve(false);
                        }
                    } else {
                        resolve(false);
                    }
                },
                onerror: () => resolve(false)
            });
        });
        if (success) {
            successCount++;
        } else {
            showDuoRainNotification(`Error granting ${friendlyName}.`);
            return;
        }
    }
    showDuoRainNotification(`Successfully Granted ${successCount}x ${friendlyName}!`);
}
 
async function farmXp(jwt, fromLang, toLang, count) {
    const farmId = 'xp';
    if (activeFarms.has(farmId)) return;
    activeFarms.set(farmId, true);
    document.querySelectorAll('[data-action="start-xp-farm"]').forEach(btn => {
        btn.style.pointerEvents = 'none';
        btn.style.opacity = 0.5;
    });
    addFarmUI(farmId, "Starting XP farm...");
    let totalXp = 0;
    let loopShouldContinue = true;
    for (let i = 0; i < count; i++) {
        if (!activeFarms.get(farmId)) { loopShouldContinue = false; break; }
        const now_ts = Math.floor(Date.now() / 1000);
        const payload = { "awardXp": true, "completedBonusChallenge": true, "fromLanguage": fromLang, "learningLanguage": toLang, "hasXpBoost": false, "illustrationFormat": "svg", "isFeaturedStoryInPracticeHub": true, "isLegendaryMode": true, "isV2Redo": false, "isV2Story": false, "masterVersion": true, "maxScore": 0, "score": 0, "happyHourBonusXp": 469, "startTime": now_ts, "endTime": now_ts };
        await new Promise(resolve => {
            setTimeout(() => {
                GM_xmlhttpRequest({
                    method: "POST", url: "https://stories.duolingo.com/api2/stories/fr-en-le-passeport/complete", headers: getDuoHeaders(jwt), data: JSON.stringify(payload),
                    onload: res => {
                        if (res.status === 200 && activeFarms.get(farmId)) {
                            totalXp += JSON.parse(res.responseText).awardedXp || 0;
                            updateFarmStatus(farmId, `XP Loop ${i + 1}/${count === Infinity ? '∞' : count} | Total: ${totalXp}`);
                        } else if (activeFarms.get(farmId)) { updateFarmStatus(farmId, `Error on loop ${i + 1}.`); loopShouldContinue = false; }
                        resolve();
                    },
                    onerror: () => { if (activeFarms.get(farmId)) { updateFarmStatus(farmId, "Request failed."); loopShouldContinue = false; } resolve(); }
                });
            }, loopDelay);
        });
        if (!loopShouldContinue) break;
    }
    stopFarm(farmId, false);
    finalizeFarmUI(farmId, loopShouldContinue ? `Finished! Total: ${totalXp} XP` : "Stopped due to error.");
}
 
async function farmGems(jwt, uid, fromLang, toLang, count) {
    const farmId = 'gem';
    if (activeFarms.has(farmId)) return;
    activeFarms.set(farmId, true);
    document.querySelectorAll('[data-action="start-gem-farm"]').forEach(btn => {
        btn.style.pointerEvents = 'none';
        btn.style.opacity = 0.5;
    });
    addFarmUI(farmId, "Starting Gem farm...");
    let totalGems = 0;
    let loopShouldContinue = true;
    for (let i = 0; i < count; i++) {
        if (!activeFarms.get(farmId)) { loopShouldContinue = false; break; }
        for (const reward of ["SKILL_COMPLETION_BALANCED-...-2-GEMS", "SKILL_COMPLETION_BALANCED-...-2-GEMS"]) {
            await new Promise(resolve => {
                GM_xmlhttpRequest({
                    method: 'PATCH', url: `https://www.duolingo.com/2017-06-30/users/${uid}/rewards/${reward}`, headers: getDuoHeaders(jwt), data: JSON.stringify({ "consumed": true, "fromLanguage": fromLang, "learningLanguage": toLang }),
                    onload: (res) => { if (res.status !== 200) console.warn(`Failed to redeem ${reward}`); resolve(); },
                    onerror: () => { console.error(`Error redeeming ${reward}`); resolve(); }
                });
            });
        }
        totalGems += 120;
        updateFarmStatus(farmId, `Gem Loop ${i + 1}/${count === Infinity ? '∞' : count} | Total: ~${totalGems}`);
        await new Promise(r => setTimeout(r, loopDelay));
    }
    stopFarm(farmId, false);
    finalizeFarmUI(farmId, loopShouldContinue ? `Finished! Total: ~${totalGems} Gems` : "Stopped.");
}
 
async function farmStreak(jwt, uid, fromLang, toLang, days) {
    const farmId = 'streak';
    if (activeFarms.has(farmId)) return;
    activeFarms.set(farmId, true);
    addFarmUI(farmId, "Getting user data...");
    const userData = await getUserData(jwt, uid).catch(() => {
        stopFarm(farmId, false);
        finalizeFarmUI(farmId, "Error: Could not get user data.");
        return null;
    });
    if (!userData) {
        stopFarm(farmId, false);
        finalizeFarmUI(farmId, "Error: Could not get user data.");
        return;
    }
    document.querySelectorAll('[data-action="start-streak-farm"]').forEach(btn => {
        btn.style.pointerEvents = 'none';
        btn.style.opacity = 0.5;
    });
    const startDate = userData.streakStartDate ? new Date(userData.streakStartDate) : new Date();
    let loopShouldContinue = true;
    for (let i = 0; i < days; i++) {
        if (!activeFarms.get(farmId)) { loopShouldContinue = false; break; }
        const simDay = new Date(startDate);
        simDay.setDate(simDay.getDate() - i);
        updateFarmStatus(farmId, `Farming ${simDay.toISOString().split('T')[0]} | Day ${i+1}/${days === Infinity ? '∞' : days}`);
        await new Promise(resolve => {
            setTimeout(() => {
                GM_xmlhttpRequest({
                    method: 'POST', url: "https://www.duolingo.com/2017-06-30/sessions", headers: getDuoHeaders(jwt), data: JSON.stringify({ "challengeTypes": [], "fromLanguage": fromLang, "isFinalLevel": false, "isV2": true, "juicy": true, "learningLanguage": toLang, "type": "GLOBAL_PRACTICE" }),
                    onload: (r1) => {
                        if (r1.status !== 200) { console.error(`POST fail for ${simDay.toISOString().split('T')[0]}`); return resolve(); }
                        const sessionData = JSON.parse(r1.responseText);
                        const putPayload = { ...sessionData, "heartsLeft": 5, "startTime": Math.floor(simDay.getTime() / 1000 - 60), "endTime": Math.floor(simDay.getTime() / 1000), "failed": false };
                        GM_xmlhttpRequest({ method: 'PUT', url: `https://www.duolingo.com/2017-06-30/sessions/${sessionData.id}`, headers: getDuoHeaders(jwt), data: JSON.stringify(putPayload), onload: resolve, onerror: resolve });
                    },
                    onerror: resolve
                });
            }, loopDelay);
        });
        if (!loopShouldContinue) break;
    }
    stopFarm(farmId, false);
    finalizeFarmUI(farmId, loopShouldContinue ? "🎉 Streak farming complete!" : "Stopped.");
}
 
function fetchAllMetrics(jwt) {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: "GET",
            url: 'https://goals-api.duolingo.com/schema?ui_language=en',
            headers: getDuoHeaders(jwt),
            timeout: 15000,
            ontimeout: () => reject(new Error('Request timed out while fetching metrics')),
            onload: res => {
                if (res.status === 200) {
                    try {
                        const schema = JSON.parse(res.responseText);
                        const metrics = new Set(schema.goals.map(g => g.metric).filter(Boolean));
                        resolve(metrics);
                    } catch (e) {
                        console.error("DuoRain Error: Could not parse schema. Raw response:", res.responseText);
                        reject(new Error('Failed to parse schema response.'));
                    }
                } else {
                    console.error(`DuoRain Error: Failed to fetch metrics. Status: ${res.status}. Response:`, res.responseText);
                    reject(new Error(`Failed to fetch metrics (Status: ${res.status})`));
                }
            },
            onerror: (err) => {
                console.error("DuoRain Error: Network error fetching metrics.", err);
                reject(new Error('Network error fetching metrics.'))
            }
        });
    });
}
 
function postProgressUpdate(jwt, uid, payload) {
    return new Promise(resolve => {
        GM_xmlhttpRequest({
            method: 'POST',
            url: `https://goals-api.duolingo.com/users/${uid}/progress/batch`,
            headers: getDuoHeaders(jwt),
            data: JSON.stringify(payload),
            timeout: 15000,
            ontimeout: () => resolve(false),
            onload: (res) => resolve(res.status === 200),
            onerror: () => resolve(false)
        });
    });
}
 
function generateQuestDates() {
    const dates = [];
    const now = new Date();
    const startDay = now.getDate();
    const endDate = new Date(2021, 0, 1);
    let currentDate = new Date(now);
    while (currentDate >= endDate) {
        let targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), startDay, now.getHours(), now.getMinutes(), now.getSeconds());
        if (targetDate.getMonth() !== currentDate.getMonth()) {
            targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        }
        dates.push(targetDate);
        currentDate.setDate(1);
        currentDate.setMonth(currentDate.getMonth() - 1);
    }
    return dates;
}
 
async function runFullQuestCompletion(jwt, uid, timezone) {
    const farmId = 'fullquests';
    if (activeFarms.has(farmId)) return;
    activeFarms.set(farmId, true);
    document.querySelectorAll('[data-action="run-full-quests"]').forEach(btn => {
        btn.style.opacity = 0.5;
        btn.style.pointerEvents = 'none';
    });
    addFarmUI(farmId, 'Starting full completion process...');
    try {
        updateFarmStatus(farmId, 'Fetching quest metrics...');
        const metrics = await fetchAllMetrics(jwt);
        if (!metrics || metrics.size === 0) {
            throw new Error('No quest metrics found in schema.');
        }
        const dates = generateQuestDates();
        updateFarmStatus(farmId, `Found ${dates.length} months to process...`);
        const metricUpdates = [...metrics].map(m => ({ "metric": m, "quantity": 2000 }));
        if (!metrics.has("QUESTS")) {
            metricUpdates.push({ "metric": "QUESTS", "quantity": 1 });
        }
        let successCount = 0;
        for (let i = 0; i < dates.length; i++) {
            if (!activeFarms.get(farmId)) {
                finalizeFarmUI(farmId, 'Process stopped by user.');
                stopFarm(farmId, false);
                return;
            }
            const targetDate = dates[i];
            const monthStr = targetDate.toLocaleString('default', { month: 'long', year: 'numeric' });
            updateFarmStatus(farmId, `[${i + 1}/${dates.length}] Submitting for ${monthStr}...`);
            const timestamp = targetDate.toISOString();
            const payload = { "metric_updates": metricUpdates, "timestamp": timestamp, "timezone": timezone };
            const success = await postProgressUpdate(jwt, uid, payload);
            if (success) {
                successCount++;
            } else {
                console.warn(`DuoRain: POST for ${timestamp} failed.`);
            }
            await new Promise(r => setTimeout(r, 1000));
        }
        finalizeFarmUI(farmId, `Finished! Processed ${dates.length} updates with ${successCount} successes.`);
    } catch (e) {
        console.error('DuoRain: Full quest completion error:', e);
        finalizeFarmUI(farmId, `Error: ${e.message || 'An unknown error occurred'}`);
    }
    stopFarm(farmId, false);
}
 
function initializeSettings() {
    const loopDelayInput = document.getElementById('duorain-loop-delay-input');
    loopDelayInput.value = settings.loopDelay;
 
    loopDelayInput.addEventListener('change', () => {
        const newValue = parseInt(loopDelayInput.value, 10);
        if (!isNaN(newValue) && newValue >= 0) {
            loopDelay = newValue;
            settings.loopDelay = newValue;
            saveSettings();
        } else {
            loopDelayInput.value = settings.loopDelay;
        }
    });
 
     const easySolveSwitch = document.getElementById('duorain-easy-solve-switch');
    if (sessionStorage.getItem(MODIFIER_KEY) === 'true' && !sessionStorage.getItem(AUTO_CLICK_KEY)) {
        easySolveSwitch.checked = true;
    }
     easySolveSwitch.addEventListener('change', () => {
        if(activeFarms.size > 0){
             showDuoRainNotification("Please stop all running tasks before toggling Easy Solve.");
             easySolveSwitch.checked = !easySolveSwitch.checked;
             return;
        }
        settings.easySolve = easySolveSwitch.checked;
        saveSettings();
        if (settings.easySolve) {
            sessionStorage.setItem(MODIFIER_KEY, 'true');
            sessionStorage.removeItem(AUTO_CLICK_KEY);
        } else {
            sessionStorage.removeItem(MODIFIER_KEY);
            sessionStorage.removeItem(AUTO_CLICK_KEY);
        }
        showDuoRainNotification(`Easy Solve ${settings.easySolve ? 'enabled' : 'disabled'}. Reloading...`);
        setTimeout(() => {
             sessionStorage.setItem(RELOAD_FLAG, 'true');
             window.location.reload();
        }, 1000);
    });
 
    const incrementButton = document.getElementById('duorain-delay-increment');
    const decrementButton = document.getElementById('duorain-delay-decrement');
    let holdTimeout;
    let holdInterval;
 
    const updateDelayValue = (amount) => {
        const currentValue = parseInt(loopDelayInput.value, 10) || 0;
        const newValue = Math.max(0, currentValue + amount);
        loopDelayInput.value = newValue;
        loopDelayInput.dispatchEvent(new Event('change'));
    };
 
    const startHold = (amount, button) => {
        stopHold();
        holdTimeout = setTimeout(() => {
            holdInterval = setInterval(() => {
                updateDelayValue(amount);
            }, 100);
        }, 400);
    };
 
    const stopHold = () => {
        clearTimeout(holdTimeout);
        clearInterval(holdInterval);
    };
 
    const addListeners = (button, amount) => {
        button.addEventListener('mousedown', (e) => { e.preventDefault(); updateDelayValue(amount); startHold(amount, button); });
        button.addEventListener('mouseup', stopHold);
        button.addEventListener('mouseleave', stopHold);
        button.addEventListener('touchstart', (e) => { e.preventDefault(); updateDelayValue(amount); startHold(amount, button); }, { passive: false });
        button.addEventListener('touchend', stopHold);
    };
 
    addListeners(incrementButton, 1);
    addListeners(decrementButton, -1);
}
 
function initializeAutoClicker() {
    const CONTINUE_SELECTORS = ['[data-test="start-button"]', '[data-test="story-start"]', '[data-test="stories-player-continue"]:not([disabled])', '[data-test="stories-player-done"]:not([disabled])', '[data-test="player-next"]:not([aria-disabled="true"])', '[data-test="session-complete-slide"] [data-test="player-next"]', '[data-test="legendary-session-end-continue"]', 'button._1rcV8._1gKir:not([disabled])'];
    const ANSWER_SELECTORS = ['[data-test="challenge-choice"][tabindex="0"]', '[data-test*="challenge-tap-token"]', '[data-test="challenge-image-choice"]', '[data-test="challenge-choice"]'];
    setInterval(() => {
        if (sessionStorage.getItem(AUTO_CLICK_KEY) !== 'true') return;
        const allButtons = document.querySelectorAll('button');
        for (const button of allButtons) {
            if (button.innerText && button.innerText.trim().toLowerCase() === 'no thanks' && !button.disabled) { button.click(); return; }
        }
        for (const selector of CONTINUE_SELECTORS) {
            const button = document.querySelector(selector);
            if (button) { button.click(); return; }
        }
        const isContinueButtonActive = document.querySelector('[data-test="player-next"]:not([aria-disabled="true"])');
        if (isContinueButtonActive) return;
        for (const selector of ANSWER_SELECTORS) {
            if (selector.includes('challenge-tap-token')) {
                const tokens = document.querySelectorAll(selector + ':not([aria-disabled="true"])');
                if (tokens.length > 0) { tokens.forEach(token => token.click()); return; }
            } else {
                const answerButton = document.querySelector(selector + ':not([aria-disabled="true"])');
                if (answerButton) { answerButton.click(); return; }
            }
        }
    }, 200);
}
 
function startSolverSession(farmId, count, lessonParams = {}) {
     if (activeFarms.size > 0) {
        showDuoRainNotification("Another task is already running.");
        return;
    }
 
    let url;
    switch (farmId) {
        case 'path-solve':
            url = '/lesson';
            break;
        case 'practice-solve':
            url = '/practice';
            break;
        case 'listen-solve':
            url = '/practice-hub/listening-practice';
            break;
        case 'lesson-solve':
             if (lessonParams.unit && lessonParams.level) {
                url = `/lesson/unit/${lessonParams.unit}/level/${lessonParams.level}`;
            } else {
                showDuoRainNotification("Please specify Unit and Lesson number.");
                return;
            }
            break;
        default:
            showDuoRainNotification("Unknown solver type.");
            return;
    }
 
    activeFarms.set(farmId, true);
    sessionStorage.setItem(MODIFIER_KEY, 'true');
    sessionStorage.setItem(AUTO_CLICK_KEY, 'true');
    sessionStorage.setItem(SOLVER_SESSION_KEY, JSON.stringify({
        farm: farmId,
        remaining: count,
        total: count
    }));
    showDuoRainNotification(`Starting ${farmId.replace('-solve','')} solver...`);
    window.location.href = `https://duolingo.com${url}`;
}
 
function checkActiveSolverSession() {
    const sessionDataJSON = sessionStorage.getItem(SOLVER_SESSION_KEY);
    if (!sessionDataJSON) return;
 
    try {
        const { farm, remaining, total } = JSON.parse(sessionDataJSON);
 
        if (document.body) {
             addFarmUI(farm, `Solving... (${total - (remaining === Infinity ? 0 : remaining) + (total === Infinity ? 1 : 0)}/${total === Infinity ? '∞' : total})`);
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                addFarmUI(farm, `Solving... (${total - (remaining === Infinity ? 0 : remaining) + (total === Infinity ? 1 : 0)}/${total === Infinity ? '∞' : total})`);
            });
        }
 
        const observer = new MutationObserver((mutations) => {
            if (document.querySelector('[data-test="session-complete-slide"]')) {
                observer.disconnect();
                handleLessonCompletion(farm, remaining, total);
            }
        });
 
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        } else {
            document.addEventListener('DOMContentLoaded', () => observer.observe(document.body, { childList: true, subtree: true }));
        }
    } catch (e) {
        console.error("DuoRain Error parsing solver session:", e);
        sessionStorage.removeItem(SOLVER_SESSION_KEY);
    }
}
 
function handleLessonCompletion(farm, remaining, total) {
     if (remaining !== Infinity) {
        remaining--;
    }
 
    if ((remaining > 0 || remaining === Infinity) && activeFarms.has(farm)) {
         sessionStorage.setItem(SOLVER_SESSION_KEY, JSON.stringify({ farm, remaining, total }));
         setTimeout(() => {
             window.location.reload();
         }, 1500);
    } else {
         stopFarm(farm, false);
         finalizeFarmUI(farm, "Finished! Returning to learn page...");
         setTimeout(() => {
              window.location.href = "https://duolingo.com/learn";
         }, 1500);
    }
}
 
async function main() {
 
    if (window.location.pathname.includes('/lesson') || window.location.pathname.includes('/practice')) {
         checkActiveSolverSession();
    }
 
    injectUI();
    loadSettings();
    initializeSettings();
    renderItems();
    setupPinEventListeners();
    renderSolverItems();
    setupSolverPinEventListeners();
 
    const jwt = getJwtToken();
    const indicatorText = document.getElementById('duorain-status-indicator-text');
    if (!jwt || !parseJwt(jwt)?.sub) {
        indicatorText.textContent = 'Error: Not logged in.';
        document.querySelectorAll('.DLP_VStack_8').forEach(el => {
            el.style.opacity = 0.5;
            el.style.pointerEvents = 'none';
        });
        return;
    }
 
    const userId = parseJwt(jwt).sub;
    const duolingoUserData = await getUserData(jwt, userId);
 
    if (!duolingoUserData) {
         indicatorText.textContent = 'Error: Failed to load user data.';
         document.querySelectorAll('.DLP_VStack_8').forEach(el => {
            el.style.opacity = 0.5;
            el.style.pointerEvents = 'none';
        });
        return;
    }
 
    document.getElementById('duorain-main-container').addEventListener('click', (e) => {
        const button = e.target.closest('[data-action]');
        if (!button) return;
 
        const action = button.dataset.action;
        const farmType = action.replace('start-', '').replace('-farm', '').replace('run-', '').replace('grant-', '');
        const featureItem = button.closest('.duorain-feature-item');
        let count;
 
 
        if (featureItem && featureItem.dataset.mode === 'infinity') {
            count = Infinity;
        } else {
            const input = featureItem ? featureItem.querySelector(`.duorain-value-input[data-input-for="${farmType}"]`) : null;
            count = input ? (input.value ? parseInt(input.value, 10) : 1) : 1;
        }
 
       if (action.includes('-solve')) {
            const lessonParams = {};
            if (action === 'start-lesson-solve' && featureItem) {
                const unitInput = featureItem.querySelector('[data-input-for="lesson-unit"]');
                const levelInput = featureItem.querySelector('[data-input-for="lesson-level"]');
                lessonParams.unit = unitInput ? unitInput.value : 1;
                lessonParams.level = levelInput ? levelInput.value : 1;
            }
             if ((isNaN(count) || count <= 0) && count !== Infinity) {
                showDuoRainNotification("Please enter a valid number of loops.");
                return;
            }
            startSolverSession(farmType, count, lessonParams);
            return;
        }
 
        if ( (isNaN(count) || count <= 0) && !action.startsWith('grant-') && action !== 'run-fullquests') {
            showDuoRainNotification("Please enter a valid number of loops.");
            return;
        }
 
        const { fromLanguage, learningLanguage, timezone } = duolingoUserData;
        switch(action) {
            case 'start-xp-farm': farmXp(jwt, fromLanguage, 'fr', count); break;
            case 'start-gem-farm': farmGems(jwt, userId, fromLanguage, learningLanguage, count); break;
            case 'start-streak-farm': farmStreak(jwt, userId, fromLanguage, learningLanguage, count); break;
            case 'run-fullquests': runFullQuestCompletion(jwt, userId, timezone); break;
            case 'grant-streak-freeze': {
                const freezeCount = parseInt(document.getElementById('duorain-freeze-value').textContent, 10);
                if (freezeCount > 0) {
                    grantShopItem(jwt, userId, fromLanguage, learningLanguage, 'streak_freeze', 'Streak Freeze', freezeCount);
                } else {
                    showDuoRainNotification("Please select at least 1 Streak Freeze.");
                }
                break;
            }
            case 'grant-hearts': grantShopItem(jwt, userId, fromLanguage, learningLanguage, 'health_refill', 'Heart Refill'); break;
            case 'grant-xp-boost': grantShopItem(jwt, userId, fromLanguage, learningLanguage, 'general_xp_boost', 'XP Boost'); break;
        }
    });
 
    const freezeValueEl = document.getElementById('duorain-freeze-value');
    const freezeIncBtn = document.getElementById('duorain-freeze-increment');
    const freezeDecBtn = document.getElementById('duorain-freeze-decrement');
 
    if (freezeValueEl && freezeIncBtn && freezeDecBtn) {
        freezeIncBtn.addEventListener('click', () => {
            let currentValue = parseInt(freezeValueEl.textContent, 10);
            if (currentValue < 3) freezeValueEl.textContent = currentValue + 1;
        });
 
        freezeDecBtn.addEventListener('click', () => {
            let currentValue = parseInt(freezeValueEl.textContent, 10);
            if (currentValue > 0) freezeValueEl.textContent = currentValue - 1;
        });
    }
}
 
injectNetworkInterceptor();
initializeAutoClicker();
 
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', main);
} else {
    main();
}
 
})();
