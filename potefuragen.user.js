// ==UserScript==
// @name         potefuragen
// @namespace    http://tampermonkey.net/
// @version      5.3
// @description  手動gen
// @author       potefura
// @match        https://discord.com/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @connect      mail-api.potefura.jp
// @connect      humanizier.potefura.jp
// @downloadURL  https://raw.githubusercontent.com/potefura/tokengen/refs/heads/main/potefuragen.user.js
// @updateURL    https://raw.githubusercontent.com/potefura/tokengen/refs/heads/main/potefuragen.user.js
// ==/UserScript==

(function() {
    'use strict';

    if (window.top !== window.self) return;

    const disnamec = "10";
    const usrnamec = "10";
    const usiro = "_genned";
    const pass = "potefuraz247";
    const fillspeed = "20";
    const YEAR = "2000";
    const MONTH = "1月";
    const DAY = "1";
    const DOMAIN = "yamada-tako.gay";
    const EMAIL_API_URL = "https://mail-api.potefura.jp";
    const EMAIL_POLL_INTERVAL = 2000;
    const EMAIL_POLL_MAX_ATTEMPTS = 60;
    const HUMANIZER_API_URL = "https://humanizier.potefura.jp/api/humanizer";

    let currentEmail = null;
    let currentAddress = null;
    let currentVerificationUrl = null;

    /**
     * Tampermonkey の GM_xmlhttpRequest ラッパー
     */
    function gmFetch(url, options = {}) {
        return new Promise((resolve, reject) => {
            const gmOptions = {
                method: options.method || 'GET',
                url: url,
                timeout: options.timeout || 10000,
                headers: options.headers || {},
                onload: (response) => {
                    resolve({
                        ok: response.status >= 200 && response.status < 300,
                        status: response.status,
                        json: () => Promise.resolve(JSON.parse(response.responseText)),
                        text: () => Promise.resolve(response.responseText)
                    });
                },
                onerror: (error) => {
                    reject(new Error(`Request failed: ${error}`));
                },
                ontimeout: () => {
                    reject(new Error('Request timeout'));
                }
            };

            if (options.body) {
                gmOptions.data = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
            }

            GM_xmlhttpRequest(gmOptions);
        });
    }

    /**
     * トークン検証 & Humanizer実行
     */
    async function validateAndHumanize(token) {
        const status = document.getElementById('gen_status');
        
        // Step 1: トークン検証
        console.log('[validateAndHumanize] Validating token...');
        try {
            const validationResponse = await gmFetch('https://discord.com/api/v9/users/@me', {
                method: 'GET',
                headers: { 'Authorization': token }
            });

            if (!validationResponse.ok) {
                const data = await validationResponse.json();
                console.log('[validateAndHumanize] Validation response:', data);
                
                // 40002 = アカウント未確認
                if (data.code === 40002) {
                    console.log('[validateAndHumanize] Account not verified (40002)');
                    return false;
                }
            }

            console.log('[validateAndHumanize] Token is valid');
        } catch (e) {
            console.error('[validateAndHumanize] Validation error:', e);
            return false;
        }

        // Step 2: Humanizer実行
        console.log('[validateAndHumanize] Running Humanizer...');
        status.innerText = "⏳ Humanizer 実行中...";
        status.style.color = "#faa61a";
        
        try {
            const humanizeResponse = await gmFetch(HUMANIZER_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: token.replace(/^"|"$/g, ''),
                    bio: true,
                    pronouns: true,
                    display_name: true,
                    avatar: true
                })
            });

            if (humanizeResponse.ok) {
                const data = await humanizeResponse.json();
                console.log('[validateAndHumanize] Humanizer success:', data);
                status.innerText = "✅ Humanizer 完了！";
                status.style.color = "#3ba55c";
                return true;
            } else {
                console.warn('[validateAndHumanize] Humanizer failed with status:', humanizeResponse.status);
                status.innerText = "✅ Humanizer スキップ";
                status.style.color = "#3ba55c";
                return true;
            }
        } catch (e) {
            console.warn('[validateAndHumanize] Humanizer error, skipping:', e);
            status.innerText = "✅ Humanizer スキップ (通常のプロセスは継続)";
            status.style.color = "#3ba55c";
            return true;
        }
    }

    function createUI() {
        if (document.getElementById('gen_ui_panel')) return;

        const div = document.createElement('div');
        div.id = 'gen_ui_panel';
        Object.assign(div.style, {
            position: 'fixed',
            top: '10px',
            right: '10px',
            width: '350px',
            backgroundColor: '#2f3136',
            color: 'white',
            padding: '15px',
            borderRadius: '8px',
            zIndex: '9999',
            border: '1px solid #7289da',
            boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
            userSelect: 'none',
            fontFamily: '"gg sans", "Helvetica Neue", sans-serif'
        });

        div.innerHTML = `
            <div style="margin-bottom: 10px;">
                <label style="font-weight: bold; display: block; margin-bottom: 5px;">メール</label>
                <div style="display: flex; gap: 5px;">
                    <input type="text" id="gen_email" placeholder="自動取得されます"
                        style="flex: 1; padding: 5px; color: black; border-radius: 4px; border: none; cursor: text; user-select: text;">
                    <button id="gen_create_email_btn" style="padding: 5px 10px; background: #5865F2; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                        取得
                    </button>
                </div>
            </div>
            <button id="gen_start_btn" style="width: 100%; padding: 8px; background: #5865F2; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; margin-bottom: 5px;">
                自動で埋める
            </button>
            <button id="gen_reset_btn" style="width: 100%; padding: 8px; background: #ed4245; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                localstorage削除
            </button>
            <div id="gen_status" style="margin-top: 10px; font-size: 12px; color: #bbb; word-break: break-all; line-height: 1.4;">待機中</div>
        `;
        document.body.appendChild(div);

        document.getElementById('gen_create_email_btn').onclick = createEmailAddress;
        document.getElementById('gen_start_btn').onclick = startAutoFill;
        document.getElementById('gen_reset_btn').onclick = resetData;

        makeDraggable(div);
    }

    function makeDraggable(element) {
        let isDragging = false, startX, startY, initialLeft, initialTop;
        element.style.cursor = 'move';
        element.addEventListener('mousedown', function(e) {
            if (['INPUT', 'BUTTON', 'TEXTAREA'].includes(e.target.tagName.toUpperCase())) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = element.getBoundingClientRect();
            element.style.right = 'auto';
            element.style.left = rect.left + 'px';
            element.style.top = rect.top + 'px';
            initialLeft = rect.left;
            initialTop = rect.top;
            e.preventDefault();
        });
        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            element.style.left = (initialLeft + e.clientX - startX) + 'px';
            element.style.top = (initialTop + e.clientY - startY) + 'px';
        });
        document.addEventListener('mouseup', () => { isDragging = false; });
    }

    async function createEmailAddress() {
        const status = document.getElementById('gen_status');
        const emailInput = document.getElementById('gen_email');
        const createBtn = document.getElementById('gen_create_email_btn');
        
        status.innerText = "メールアドレス生成中...";
        status.style.color = "yellow";
        createBtn.disabled = true;

        try {
            const response = await gmFetch(`${EMAIL_API_URL}/create?domain=${DOMAIN}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            });

            if (response.ok) {
                const data = await response.json();
                currentEmail = data.address;
                currentAddress = data.address;
                emailInput.value = currentEmail;
                status.innerText = `✓ メール生成完了\n${currentEmail}`;
                status.style.color = "#3ba55c";
            } else {
                status.innerText = `エラー: ステータス ${response.status}`;
                status.style.color = "red";
            }
        } catch (e) {
            status.innerText = `メール取得失敗: ${e.message}\n別のドメインで試してください`;
            status.style.color = "red";
        }
        createBtn.disabled = false;
    }

    function resetData() {
        try {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
            iframe.contentWindow.localStorage.clear();
            iframe.contentWindow.sessionStorage.clear();
            iframe.remove();
        } catch(e) {}
        document.cookie.split(";").forEach(c => {
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
        window.location.href = "https://discord.com/register";
    }

    function randomString(len, charSet) {
        return Array.from({length: len}, () => charSet.charAt(Math.floor(Math.random() * charSet.length))).join('');
    }

    function setReactValue(selector, value) {
        const element = document.querySelector(selector);
        if (!element) return;
        const lastValue = element.value;
        element.value = value;
        const event = new Event('input', { bubbles: true });
        const tracker = element._valueTracker;
        if (tracker) tracker.setValue(lastValue);
        element.dispatchEvent(event);
    }

    async function handleDropdown(selectorPartial, text) {
        const container = document.querySelector(selectorPartial);
        if (!container) return;

        const trigger = container.querySelector('[role="combobox"]') || container.querySelector('button');
        if (!trigger) return;
        trigger.focus();
        trigger.click();
        await new Promise(r => setTimeout(r, 100));
        const strText = String(text);
        for (let char of strText) {
            trigger.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
            await new Promise(r => setTimeout(r, 20));
        }
        await new Promise(r => setTimeout(r, 100));
        trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
        await new Promise(r => setTimeout(r, fillspeed));
    }

    async function startAutoFill() {
        const status = document.getElementById('gen_status');
        const email = document.getElementById('gen_email').value;
        if (!email) {
            status.innerText = "Emailがemptyです";
            status.style.color = "red";
            return;
        }
        status.innerText = "フォーム入力中...";
        status.style.color = "yellow";

        setReactValue('input[name="email"]', email);
        setReactValue('input[name="global_name"]', randomString(disnamec, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'));
        setReactValue('input[name="username"]', randomString(usrnamec, 'abcdefghijklmnopqrstuvwxyz0123456789_.') + usiro);
        setReactValue('input[name="password"]', pass);

        await handleDropdown('div[class*="year_"]', YEAR);
        await handleDropdown('div[class*="month_"]', MONTH);
        await handleDropdown('div[class*="day_"]', DAY);

        const submitBtn = document.querySelector('button[type="submit"]');
        if (submitBtn) {
            monitorTokenBeforeEmail(email);
            
            status.innerText = "アカウント登録中...";
            status.style.color = "yellow";
            submitBtn.click();
        } else {
            status.innerText = "登録ボタンが見つかりません";
            status.style.color = "red";
        }
    }

    function monitorTokenBeforeEmail(address) {
        const status = document.getElementById('gen_status');
        if (window._tokenMonitorInterval) clearInterval(window._tokenMonitorInterval);
        
        window._tokenMonitorInterval = setInterval(() => {
            const token = getToken();
            if (token) {
                clearInterval(window._tokenMonitorInterval);
                console.log('[monitorTokenBeforeEmail] Token detected');
                
                status.innerText = "認証リンク取得中...";
                status.style.color = "#faa61a";
                
                setTimeout(() => {
                    waitForVerificationEmail(address);
                }, 1000);
            }
        }, 1000);
    }

    async function waitForVerificationEmail(address) {
        const status = document.getElementById('gen_status');
        const startTime = Date.now();
        const timeout = EMAIL_POLL_MAX_ATTEMPTS * EMAIL_POLL_INTERVAL;
        let attempt = 0;

        while (Date.now() - startTime < timeout) {
            attempt++;
            try {
                const verificationUrl = await getVerificationLink(address);
                console.log(`[attempt ${attempt}] Verification URL:`, verificationUrl);
                
                if (verificationUrl) {
                    displayVerificationUrl(verificationUrl);
                    monitorTokenForDisplay();
                    return;
                } else {
                    console.log(`[attempt ${attempt}] No verification link yet`);
                }
            } catch (e) {
                console.error('Verification link fetch error:', e);
            }
            
            status.innerText = "認証リンク取得中...";
            await new Promise(r => setTimeout(r, EMAIL_POLL_INTERVAL));
        }

        status.innerText = "メール取得タイムアウト";
        status.style.color = "red";
    }

    async function getVerificationLink(address) {
        try {
            const verifyLinkUrl = `${EMAIL_API_URL}/messages/verify-link?address=${encodeURIComponent(address)}`;
            console.log('[getVerificationLink] Fetching from:', verifyLinkUrl);
            const response = await gmFetch(verifyLinkUrl, { timeout: 5000 });
            
            if (response.ok) {
                const data = await response.json();
                console.log('[getVerificationLink] Response data:', data);
                
                if (data.results && data.results.length > 0) {
                    const links = data.results[0].links;
                    if (links && links.length > 0) {
                        const verificationUrl = links[0];
                        console.log('[getVerificationLink] Verification URL found:', verificationUrl);
                        return verificationUrl;
                    }
                }
            } else {
                console.error('[getVerificationLink] Response not ok, status:', response.status);
            }
        } catch (e) {
            console.error('Error fetching verification link:', e);
        }
        return null;
    }

    function displayVerificationUrl(verificationUrl) {
        currentVerificationUrl = verificationUrl;
        const status = document.getElementById('gen_status');
        if (!status) return;
        
        status.innerHTML = `
            <div style="margin-bottom: 12px; color: #faa61a; font-weight: bold; font-size: 14px;">⚠️ 認証リンク待機中</div>
            <div style="margin-bottom: 8px; font-size: 12px; color: #bbb;">認証URL をクリックまたはコピーして開く:</div>
            <textarea id="gen_url_area" style="width: 100%; height: 100px; color: black; font-size: 12px; box-sizing: border-box; margin-bottom: 12px; font-family: monospace; padding: 8px; border-radius: 4px; border: 2px solid #5865F2; resize: none; overflow-y: auto;" readonly>${verificationUrl}</textarea>
            <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                <button id="gen_copy_url_btn" style="flex: 1; padding: 12px; background: #5865F2; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; transition: background 0.2s; font-size: 14px;">
                    📋 コピー
                </button>
                <button id="gen_open_url_btn" style="flex: 1; padding: 12px; background: #3ba55c; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; transition: background 0.2s; font-size: 14px;">
                    🔗 新タブで開く
                </button>
            </div>
            <div id="gen_token_status" style="margin-top: 12px; font-size: 12px; color: #bbb; padding: 8px; background: #40444b; border-radius: 4px;">
                ⏳ トークン取得待機中...
                <br/>
                <span style="font-size: 11px; color: #888;">ブラウザで上記URLを開いて認証を完了してください</span>
            </div>
        `;

        const copyBtn = document.getElementById('gen_copy_url_btn');
        const openBtn = document.getElementById('gen_open_url_btn');
        const urlArea = document.getElementById('gen_url_area');

        copyBtn.onclick = (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(verificationUrl).then(() => {
                const originalText = copyBtn.innerText;
                copyBtn.innerText = "✅ コピー完了";
                copyBtn.style.background = '#43b581';
                setTimeout(() => {
                    copyBtn.innerText = originalText;
                    copyBtn.style.background = '#5865F2';
                }, 2000);
            });
        };

        openBtn.onclick = (e) => {
            e.stopPropagation();
            window.open(verificationUrl, '_blank');
        };

        copyBtn.onmouseover = () => copyBtn.style.background = '#4752c4';
        copyBtn.onmouseout = () => copyBtn.style.background = '#5865F2';
        
        openBtn.onmouseover = () => openBtn.style.background = '#2d7a4a';
        openBtn.onmouseout = () => openBtn.style.background = '#3ba55c';

        [copyBtn, openBtn, urlArea].forEach(el => {
            el.addEventListener('mousedown', e => e.stopPropagation());
        });
    }

    function monitorTokenForDisplay() {
        if (window._tokenDisplayInterval) clearInterval(window._tokenDisplayInterval);
        
        window._tokenDisplayInterval = setInterval(async () => {
            const token = getToken();
            if (token) {
                clearInterval(window._tokenDisplayInterval);
                console.log('[monitorTokenForDisplay] Token detected, validating and humanizing');
                
                // トークン検証 & Humanizer実行
                await validateAndHumanize(token);
                
                // その後、通常のトークン表示処理
                displayToken(token);
            }
        }, 1000);
    }

    function getToken() {
        let token = null;
        try {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
            token = iframe.contentWindow.localStorage.getItem("token");
            iframe.remove();
        } catch (e) {}
        if (!token) {
            try { token = window.localStorage.getItem("token"); } catch (e) {}
        }
        return token ? token.replace(/^"|"$/g, "") : null;
    }

    function displayToken(token) {
        const status = document.getElementById('gen_status');
        if (!status) return;
        
        status.innerHTML = `
            <div style="margin-bottom: 12px; color: #faa61a; font-weight: bold; font-size: 14px;">⚠️ 認証リンク待機中</div>
            <div style="margin-bottom: 8px; font-size: 12px; color: #bbb;">認証URL をクリックまたはコピーして開く:</div>
            <textarea id="gen_url_area" style="width: 100%; height: 100px; color: black; font-size: 12px; box-sizing: border-box; margin-bottom: 12px; font-family: monospace; padding: 8px; border-radius: 4px; border: 2px solid #5865F2; resize: none; overflow-y: auto;" readonly>${currentVerificationUrl}</textarea>
            <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                <button id="gen_copy_url_btn" style="flex: 1; padding: 12px; background: #5865F2; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; transition: background 0.2s; font-size: 14px;">
                    📋 コピー
                </button>
                <button id="gen_open_url_btn" style="flex: 1; padding: 12px; background: #3ba55c; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; transition: background 0.2s; font-size: 14px;">
                    🔗 新タブで開く
                </button>
            </div>
            
            <div style="margin-bottom: 12px; color: #0f0; font-weight: bold; font-size: 16px;">✅ アカウント作成完了</div>
            <div style="margin-bottom: 8px; font-size: 12px; color: #bbb; font-weight: bold;">トークン:</div>
            <textarea id="gen_token_area" style="width: 100%; height: 120px; color: black; font-size: 12px; box-sizing: border-box; margin-bottom: 12px; font-family: monospace; padding: 8px; border-radius: 4px; border: 2px solid #3ba55c; resize: none; overflow-y: auto;" readonly>${token}</textarea>
            <button id="gen_copy_btn" style="width: 100%; padding: 12px; background: #3ba55c; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; transition: background 0.2s; margin-bottom: 12px; font-size: 14px;">
                📋 トークンをコピー
            </button>
            <div style="font-size: 12px; color: #888; padding: 8px; background: #40444b; border-radius: 4px;">
                ⚠️ LocalStorage削除まで何度でも確認・コピーできます
            </div>
        `;
        
        const copyUrlBtn = document.getElementById('gen_copy_url_btn');
        const openUrlBtn = document.getElementById('gen_open_url_btn');
        const urlArea = document.getElementById('gen_url_area');

        copyUrlBtn.onclick = (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(currentVerificationUrl).then(() => {
                const originalText = copyUrlBtn.innerText;
                copyUrlBtn.innerText = "✅ コピー完了";
                copyUrlBtn.style.background = '#43b581';
                setTimeout(() => {
                    copyUrlBtn.innerText = originalText;
                    copyUrlBtn.style.background = '#5865F2';
                }, 2000);
            });
        };

        openUrlBtn.onclick = (e) => {
            e.stopPropagation();
            window.open(currentVerificationUrl, '_blank');
        };

        copyUrlBtn.onmouseover = () => copyUrlBtn.style.background = '#4752c4';
        copyUrlBtn.onmouseout = () => copyUrlBtn.style.background = '#5865F2';
        
        openUrlBtn.onmouseover = () => openUrlBtn.style.background = '#2d7a4a';
        openUrlBtn.onmouseout = () => openUrlBtn.style.background = '#3ba55c';

        [copyUrlBtn, openUrlBtn, urlArea].forEach(el => {
            el.addEventListener('mousedown', e => e.stopPropagation());
        });
        
        startCooldown();
        const copyBtn = document.getElementById('gen_copy_btn');
        const tokenArea = document.getElementById('gen_token_area');
        
        copyBtn.onclick = (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(token).then(() => {
                const o = copyBtn.innerText; 
                copyBtn.innerText = "✅ コピー完了";
                copyBtn.style.background = '#43b581';
                setTimeout(() => { 
                    copyBtn.innerText = o;
                    copyBtn.style.background = '#3ba55c';
                }, 2000);
            });
        };
        
        copyBtn.onmouseover = () => copyBtn.style.background = '#2d7a4a';
        copyBtn.onmouseout = () => copyBtn.style.background = '#3ba55c';
        
        [copyBtn, tokenArea, document.getElementById('gen_email')].forEach(el => {
            el.addEventListener('mousedown', e => e.stopPropagation());
        });
    }

    function startCooldown() {
        let timeLeft = 120;
        const statusDiv = document.getElementById('gen_status');
        const timerDiv = document.createElement('div');
        timerDiv.id = 'gen_timer_area';
        Object.assign(timerDiv.style, { 
            marginTop: '8px', 
            fontWeight: 'bold', 
            color: '#faa61a', 
            fontSize: '12px',
            padding: '8px',
            backgroundColor: '#40444b',
            borderRadius: '4px',
            textAlign: 'center'
        });
        timerDiv.innerText = `⏱️ レート制限: ${timeLeft}秒`;
        if (statusDiv) statusDiv.appendChild(timerDiv);
        
        const interval = setInterval(() => {
            timeLeft--;
            if (timerDiv) timerDiv.innerText = `⏱️ レート制限: ${timeLeft}秒`;
            if (timeLeft <= 0) {
                clearInterval(interval);
                if (timerDiv) {
                    timerDiv.innerText = "✅ 次のアカウント作成可能！";
                    timerDiv.style.color = "#3ba55c";
                    timerDiv.style.backgroundColor = "#1a2a1f";
                }
                showVencordStyleNotification();
            }
        }, 1000);
    }

    function showVencordStyleNotification() {
        if (document.getElementById('gen_vencord_notif')) return;
        const notif = document.createElement('div');
        notif.id = 'gen_vencord_notif';
        Object.assign(notif.style, {
            position: 'fixed', 
            bottom: '20px', 
            left: '20px', 
            backgroundColor: '#202225', 
            color: 'white',
            padding: '12px 16px', 
            borderRadius: '5px', 
            borderLeft: '4px solid #3ba55c',
            boxShadow: '0 8px 16px rgba(0,0,0,0.24)', 
            zIndex: '10000', 
            cursor: 'pointer',
            fontFamily: '"gg sans", "Helvetica Neue", Helvetica, Arial, sans-serif',
            transition: 'transform 0.2s ease', 
            userSelect: 'none'
        });
        notif.innerHTML = `
            <div style="font-weight: bold; font-size: 14px; color: #3ba55c;">✅ レート制限解除！</div>
            <div style="font-size: 13px; color: #dcddde;">クリックして登録画面へ移動</div>
        `;
        notif.onmouseover = () => notif.style.transform = 'translateX(5px)';
        notif.onmouseout = () => notif.style.transform = 'translateX(0)';
        notif.onclick = () => {
            notif.innerHTML = `<div style="font-size: 13px;">削除中...</div>`;
            setTimeout(() => { notif.remove(); resetData(); }, 300);
        };
        document.body.appendChild(notif);
    }

    setInterval(() => {
        if (!document.getElementById('gen_ui_panel') && document.body) {
            createUI();
        }
    }, 1000);

    function createTokenCopyBtn() {
        if (document.getElementById('token_copy_btn')) return;

        const btn = document.createElement('button');
        btn.id = 'token_copy_btn';
        btn.innerText = "Token Copy";
        Object.assign(btn.style, {
            position: 'fixed',
            top: '10px',
            left: '10px',
            zIndex: '99998',
            padding: '8px 12px',
            backgroundColor: '#5865F2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontFamily: 'sans-serif',
            boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
        });

        btn.onclick = function() {
            const token = getToken();
            if (token) {
                navigator.clipboard.writeText(token).then(() => {
                    const originalText = btn.innerText;
                    btn.innerText = "✅ Copied!";
                    btn.style.backgroundColor = '#3ba55c';
                    setTimeout(() => {
                        btn.innerText = originalText;
                        btn.style.backgroundColor = '#5865F2';
                    }, 2000);
                }).catch(() => {
                    const textarea = document.createElement('textarea');
                    textarea.value = token;
                    textarea.style.position = 'fixed';
                    textarea.style.left = '-9999px';
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                    btn.innerText = "✅ Copied!";
                    btn.style.backgroundColor = '#3ba55c';
                    setTimeout(() => {
                        btn.innerText = originalText;
                        btn.style.backgroundColor = '#5865F2';
                    }, 2000);
                });
            } else {
                const originalText = btn.innerText;
                btn.innerText = "❌ Not Found";
                btn.style.backgroundColor = '#ed4245';
                setTimeout(() => {
                    btn.innerText = originalText;
                    btn.style.backgroundColor = '#5865F2';
                }, 2000);
            }
        };
        document.body.appendChild(btn);
    }

    function createTokenLoginBtn() {
        if (document.getElementById('token_login_btn')) return;

        const btn = document.createElement('button');
        btn.id = 'token_login_btn';
        btn.innerText = "Token Login";
        Object.assign(btn.style, {
            position: 'fixed',
            top: '50px',
            left: '10px',
            zIndex: '99998',
            padding: '8px 12px',
            backgroundColor: '#3ba55c',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontFamily: 'sans-serif',
            boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
        });

        btn.onclick = function() {
            const token = prompt("Paste your token:");
            if (token && token.trim()) {
                const cleanToken = token.trim().replace(/^"|"$/g, "");
                
                fetch('https://discord.com/api/v9/users/@me', {
                    headers: { 'Authorization': cleanToken }
                }).then(response => {
                    if (response.ok) {
                        try {
                            const iframe = document.createElement('iframe');
                            iframe.style.display = 'none';
                            document.body.appendChild(iframe);
                            iframe.contentWindow.localStorage.clear();
                            iframe.contentWindow.localStorage.setItem("token", `"${cleanToken}"`);
                            iframe.remove();
                        } catch(e) {}
                        
                        try {
                            window.localStorage.setItem("token", `"${cleanToken}"`);
                        } catch(e) {}
                        
                        btn.innerText = "✅ Login Success";
                        btn.style.backgroundColor = '#3ba55c';
                        setTimeout(() => {
                            window.location.href = "/app";
                        }, 1000);
                    } else if (response.status === 401) {
                        btn.innerText = "❌ 401 Unauthorized";
                        btn.style.backgroundColor = '#ed4245';
                        setTimeout(() => {
                            btn.innerText = "Token Login";
                            btn.style.backgroundColor = '#3ba55c';
                        }, 2000);
                    } else if (response.status === 429) {
                        btn.innerText = "⏳ 429 Rate Limited";
                        btn.style.backgroundColor = '#ed4245';
                        setTimeout(() => {
                            btn.innerText = "Token Login";
                            btn.style.backgroundColor = '#3ba55c';
                        }, 2000);
                    }
                }).catch(err => {
                    btn.innerText = "❌ Network Error";
                    btn.style.backgroundColor = '#ed4245';
                    setTimeout(() => {
                        btn.innerText = "Token Login";
                        btn.style.backgroundColor = '#3ba55c';
                    }, 2000);
                });
            }
        };
        document.body.appendChild(btn);
    }

    setInterval(() => {
        if (document.body) {
            createTokenCopyBtn();
            createTokenLoginBtn();
        }
    }, 1000);
})();
