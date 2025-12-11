// ==UserScript==
// @name         DPD Auto-Fill
// @namespace    https://github.com/IceCuBear/DPDAutoFill
// @author       IceCuBear
// @license      GNU AGPLv3
// @version      2025.12.11.3
// @description  Auto-fill parcel number and optional verification code on DPD MyDPD. Simple tracking→ZIP rules, UI, and wide domain support.
// @downloadURL  https://raw.githubusercontent.com/IceCuBear/DPDAutoFill/refs/heads/main/DPDAutoFill.user.js
// @updateURL    https://raw.githubusercontent.com/IceCuBear/DPDAutoFill/refs/heads/main/DPDAutoFill.user.js
// @homepageURL  https://github.com/IceCuBear/DPDAutoFill
// @supportURL   https://github.com/IceCuBear/DPDAutoFill/issues
// @source       https://github.com/IceCuBear/DPDAutoFill
// @icon         https://www.dpd.com/favicon.ico
// @icon64       https://www.dpd.com/favicon.ico
// @run-at       document-idle
// @noframes
// @grant        GM_setValue
// @grant        GM_getValue
// @match        https://www.dpdgroup.com/*/mydpd/*
// @match        https://www.dpdgroup.com/*/mydpd/my-parcels/*
// @match        https://www.dpd.com/*/mydpd/*
// @match        https://www.dpd.com/*/mydpd/my-parcels/*
// ==/UserScript==

(function () {
    'use strict';

    ////////////////////////////////////////////////////////////////////////////
    // Settings & Storage
    ////////////////////////////////////////////////////////////////////////////

    const KV = {
        enabled: 'dpd_enabled',
        autoZip: 'dpd_auto_zip',
        defaultZip: 'dpd_default_zip',
        rules: 'dpd_rules', // array of {tracking:'', zip:''}
        lastParcel: 'dpd_last_parcel', // session helper
    };

    const DEFAULTS = {
        enabled: true,
        autoZip: true,
        defaultZip: '',
        rules: [],
    };

    function loadSettings() {
        return {
            enabled: GM_getValue(KV.enabled, DEFAULTS.enabled),
            autoZip: GM_getValue(KV.autoZip, DEFAULTS.autoZip),
            defaultZip: GM_getValue(KV.defaultZip, DEFAULTS.defaultZip),
            rules: GM_getValue(KV.rules, DEFAULTS.rules) || [],
        };
    }

    function saveSettings(partial) {
        if (partial.hasOwnProperty('enabled')) GM_setValue(KV.enabled, !!partial.enabled);
        if (partial.hasOwnProperty('autoZip')) GM_setValue(KV.autoZip, !!partial.autoZip);
        if (partial.hasOwnProperty('defaultZip')) GM_setValue(KV.defaultZip, String(partial.defaultZip || ''));
        if (partial.hasOwnProperty('rules')) {
            // Normalize rules to new shape {tracking, zip}
            const cleaned = (Array.isArray(partial.rules) ? partial.rules : []).map(r => ({
                tracking: String((r && (r.tracking ?? r.pattern)) || '').trim(),
                zip: String((r && r.zip) || '').trim(),
            }));
            GM_setValue(KV.rules, cleaned);
        }
        SETTINGS = loadSettings();
    }

    let SETTINGS = loadSettings();

    ////////////////////////////////////////////////////////////////////////////
    // DOM Utilities
    ////////////////////////////////////////////////////////////////////////////

    /**
     * Wait for a selector using MutationObserver for performance.
     * @param {string} selector
     * @param {(el:Element)=>void} callback
     */
    function waitFor(selector, callback) {
        const immediate = document.querySelector(selector);
        if (immediate) {
            callback(immediate);
            return;
        }
        const obs = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) {
                obs.disconnect();
                callback(el);
            }
        });
        obs.observe(document.documentElement, {subtree: true, childList: true});
    }

    function triggerInputChange(el) {
        el.dispatchEvent(new Event('input', {bubbles: true}));
        el.dispatchEvent(new Event('change', {bubbles: true}));
    }

    ////////////////////////////////////////////////////////////////////////////
    // Core Logic
    ////////////////////////////////////////////////////////////////////////////

    // Track parcel number from URL or field for later steps
    const urlParams = new URLSearchParams(location.search);
    const parcelFromUrl = urlParams.get('parcelNumber');

    if (parcelFromUrl) {
        try { sessionStorage.setItem(KV.lastParcel, parcelFromUrl); } catch (e) {}
    }

    // Step 1: Auto-fill parcel number and submit
    if (SETTINGS.enabled) {
        const parcel = parcelFromUrl || (function () { try { return sessionStorage.getItem(KV.lastParcel) || ''; } catch(e) { return ''; } })();
        if (parcel) {
            waitFor('#parcelNumber', (input) => {
                if (!input.value.trim()) {
                    input.value = parcel;
                    triggerInputChange(input);
                }
                const submitBtn = document.querySelector('input[type="submit"].btn.btn-red.et_btn-ec_pnu-ef_smb, button[type="submit"].btn.btn-red');
                if (submitBtn) submitBtn.click();
            });
        }
    }

    // Step 2: Auto-fill verification ZIP (if enabled by user) and submit
    function resolveZipFor(tracking) {
        if (!tracking) return SETTINGS.defaultZip || '';
        const rules = Array.isArray(SETTINGS.rules) ? SETTINGS.rules : [];
        const t = String(tracking).trim();
        for (const r of rules) {
            if (!r) continue;
            // Support legacy shape by falling back to pattern if tracking missing
            const key = String((r.tracking ?? r.pattern) || '').trim();
            if (!key) continue;
            if (t === key) return String(r.zip || '');
        }
        return SETTINGS.defaultZip || '';
    }

    if (SETTINGS.enabled && SETTINGS.autoZip) {
        waitFor('#verificationCode', (verifyInput) => {
            // determine tracking code again from URL or remembered field
            let tracking = parcelFromUrl;
            if (!tracking) {
                const field = document.querySelector('#parcelNumber');
                tracking = (field && field.value) || (function(){ try {return sessionStorage.getItem(KV.lastParcel) || '';} catch(e){return '';} })();
            }
            const zip = resolveZipFor(String(tracking || ''));
            if (zip && !verifyInput.value.trim()) {
                verifyInput.value = zip;
                triggerInputChange(verifyInput);
            }
            // Click confirm if present
            waitFor('input.submit-btn.btn.btn-red.t_frm-ec_pcd-ef_smb, button.submit-btn.btn.btn-red', (confirmBtn) => {
                // Do not spam clicks if user already filled something else
                if (verifyInput && verifyInput.value.trim()) confirmBtn.click();
            });
        });
    }

    ////////////////////////////////////////////////////////////////////////////
    // UI: Settings panel in icon menu (leftmost cog)
    ////////////////////////////////////////////////////////////////////////////

    function injectStyles() {
        const css = `
        .dpdaf-gear { cursor: pointer; display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; }
        .dpdaf-panel { position: absolute; z-index: 9999; min-width: 320px; max-width: 90vw; color: #222; background: #fff; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 6px 18px rgba(0,0,0,.15); padding: 12px; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
        .dpdaf-panel h3 { margin: 0 0 8px; font-size: 16px; }
        .dpdaf-row { display: flex; align-items: center; gap: 8px; margin: 8px 0; }
        .dpdaf-row label { flex: 1 1 auto; }
        .dpdaf-row input[type="text"] { flex: 1 1 auto; padding: 6px 8px; border: 1px solid #ccc; border-radius: 6px; }
        .dpdaf-row input[type="checkbox"] { transform: translateY(1px); }
        .dpdaf-rules { margin-top: 8px; }
        .dpdaf-rule { display:flex; gap:6px; align-items:center; margin:6px 0; }
        .dpdaf-rule select, .dpdaf-rule input[type="text"] { padding: 6px 8px; border:1px solid #ccc; border-radius:6px; }
        .dpdaf-btn { padding: 6px 8px; border: 1px solid #bbb; background: #f6f6f6; border-radius: 6px; cursor: pointer; }
        .dpdaf-btn:hover { background: #eee; }
        .dpdaf-muted { color: #666; font-size: 12px; }
        `;
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    }

    function createGearSVG() {
        const span = document.createElement('span');
        span.className = 'dpdaf-gear';
        span.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M10.325 4.317a1 1 0 0 1 1.35 0l1.169 1.04a7.97 7.97 0 0 1 1.89.238l1.39-.803a1 1 0 0 1 1.366.366l1 1.732a1 1 0 0 1-.366 1.366l-1.192.689c.087.62.087 1.252 0 1.872l1.192.689a1 1 0 0 1 .366 1.366l-1 1.732a1 1 0 0 1-1.366.366l-1.39-.803a7.97 7.97 0 0 1-1.89.238l-1.169 1.04a1 1 0 0 1-1.35 0l-1.169-1.04a7.97 7.97 0 0 1-1.89-.238l-1.39.803a1 1 0 0 1-1.366-.366l-1-1.732a1 1 0 0 1 .366-1.366l1.192-.689a7.98 7.98 0 0 1 0-1.872l-1.192-.689a1 1 0 0 1-.366-1.366l1-1.732a1 1 0 0 1 1.366-.366l1.39.803c.62-.147 1.249-.218 1.89-.238l1.169-1.04ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/></svg>';
        return span;
    }

    function buildPanel() {
        const panel = document.createElement('div');
        panel.className = 'dpdaf-panel';
        panel.style.display = 'none';
        panel.innerHTML = `
            <h3>DPD Auto-Fill</h3>
            <div class="dpdaf-row"><label><input type="checkbox" id="dpdaf_enabled"> Enable script</label></div>
            <div class="dpdaf-row"><label><input type="checkbox" id="dpdaf_autozip"> Auto-fill verification ZIP</label></div>
            <div class="dpdaf-row"><label>Default ZIP</label><input type="text" id="dpdaf_defaultzip" placeholder="e.g. 1234"></div>
            <div class="dpdaf-rules">
                <div class="dpdaf-row"><strong>Rules</strong> <span class="dpdaf-muted">Exact match: tracking number → ZIP</span></div>
                <div id="dpdaf_rules"></div>
                <div class="dpdaf-row"><button class="dpdaf-btn" id="dpdaf_add_rule">Add rule</button></div>
            </div>
        `;
        document.body.appendChild(panel);

        // Bind
        const enabledCb = panel.querySelector('#dpdaf_enabled');
        const autoZipCb = panel.querySelector('#dpdaf_autozip');
        const defaultZipIn = panel.querySelector('#dpdaf_defaultzip');
        const rulesWrap = panel.querySelector('#dpdaf_rules');
        const addBtn = panel.querySelector('#dpdaf_add_rule');

        function renderRules() {
            rulesWrap.innerHTML = '';
            const rules = SETTINGS.rules || [];
            for (let i = 0; i < rules.length; i++) {
                const r = rules[i] || {tracking:'', zip:''};
                const row = document.createElement('div');
                row.className = 'dpdaf-rule';
                const trackingVal = (r.tracking ?? r.pattern ?? '');
                row.innerHTML = `
                    <input type="text" data-idx="${i}" data-key="tracking" placeholder="Tracking number" value="${escapeHtml(trackingVal)}">
                    <input type="text" data-idx="${i}" data-key="zip" placeholder="ZIP" value="${escapeHtml(r.zip||'')}">
                    <button class="dpdaf-btn" data-idx="${i}" data-act="del">Delete</button>
                `;
                rulesWrap.appendChild(row);
            }
        }

        function syncInputs() {
            enabledCb.checked = !!SETTINGS.enabled;
            autoZipCb.checked = !!SETTINGS.autoZip;
            defaultZipIn.value = SETTINGS.defaultZip || '';
            renderRules();
        }

        function persist() {
            saveSettings({
                enabled: enabledCb.checked,
                autoZip: autoZipCb.checked,
                defaultZip: defaultZipIn.value.trim(),
                rules: SETTINGS.rules,
            });
        }

        panel.addEventListener('input', (e) => {
            const t = e.target;
            if (t === enabledCb || t === autoZipCb || t === defaultZipIn) {
                persist();
            } else if (t && t.dataset && t.dataset.key) {
                const idx = Number(t.dataset.idx);
                const key = t.dataset.key;
                const val = t.value;
                if (!Array.isArray(SETTINGS.rules)) SETTINGS.rules = [];
                if (!SETTINGS.rules[idx]) SETTINGS.rules[idx] = {tracking:'', zip:''};
                // Map legacy 'pattern' edits into 'tracking'
                const mappedKey = key === 'pattern' ? 'tracking' : key;
                SETTINGS.rules[idx][mappedKey] = val;
                persist();
            }
        });

        panel.addEventListener('click', (e) => {
            const t = e.target;
            if (t && t.id === 'dpdaf_add_rule') {
                if (!Array.isArray(SETTINGS.rules)) SETTINGS.rules = [];
                SETTINGS.rules.push({tracking:'', zip:''});
                persist();
                renderRules();
            } else if (t && t.dataset && t.dataset.act === 'del') {
                const idx = Number(t.dataset.idx);
                SETTINGS.rules.splice(idx, 1);
                persist();
                renderRules();
            }
        });

        syncInputs();
        return panel;
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"]+/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    }

    function mountUI() {
        injectStyles();

        const gear = createGearSVG();
        const panel = buildPanel();

        // Try to add to the leftmost position in #icon-menu ul
        const menu = document.querySelector('#icon-menu > ul');
        if (menu) {
            const li = document.createElement('li');
            li.className = 'menu-icon-item';
            const a = document.createElement('a');
            a.href = 'javascript:';
            a.title = 'DPD Auto-Fill Settings';
            a.appendChild(gear);
            li.appendChild(a);
            menu.insertBefore(li, menu.firstElementChild || null);
            a.addEventListener('click', (ev) => {
                ev.preventDefault();
                togglePanel(panel, a);
            });
        } else {
            // Fallback floating button
            gear.style.position = 'fixed';
            gear.style.left = '8px';
            gear.style.top = '8px';
            gear.style.background = '#fff';
            gear.style.border = '1px solid #ddd';
            gear.style.borderRadius = '8px';
            gear.style.boxShadow = '0 4px 12px rgba(0,0,0,.15)';
            gear.title = 'DPD Auto-Fill Settings';
            document.body.appendChild(gear);
            gear.addEventListener('click', (ev) => {
                ev.preventDefault();
                togglePanel(panel, gear);
            });
        }
    }

    function togglePanel(panel, anchorEl) {
        if (panel.style.display === 'none') {
            const rect = anchorEl.getBoundingClientRect();
            panel.style.left = Math.max(8, rect.left) + 'px';
            panel.style.top = (rect.bottom + 6 + window.scrollY) + 'px';
            panel.style.display = 'block';
            const onDocClick = (e) => {
                if (!panel.contains(e.target) && e.target !== anchorEl && !anchorEl.contains(e.target)) {
                    panel.style.display = 'none';
                    document.removeEventListener('mousedown', onDocClick, true);
                    window.removeEventListener('scroll', onDocClick, true);
                    window.removeEventListener('resize', onDocClick, true);
                }
            };
            document.addEventListener('mousedown', onDocClick, true);
            window.addEventListener('scroll', onDocClick, true);
            window.addEventListener('resize', onDocClick, true);
        } else {
            panel.style.display = 'none';
        }
    }

    // Defer UI mount until DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountUI);
    } else {
        mountUI();
    }
})();
