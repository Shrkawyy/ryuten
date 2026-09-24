// ==UserScript==
// @name         Ryuten for Senpa — XPLUS 500 Test — Full Shields
// @namespace    local.ryuten.senpa.port.xplus-full-shields-test
// @version      1.2.1-xplus.2
// @description  Full shields restored. XPLUS capped at 500 ms. Local map repair, FFA auto-connect and optional 10 ms feed-request test. Disable other port versions.
// @match        https://senpa.io/web*
// @match        https://www.senpa.io/web*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(()=>{ "use strict";
if(window.top!==window.self||window.SENPA_PORT)return;
if(new URL(location.href).searchParams.get("ryuten-port")==="off")return;
window.stop();
const PAYLOAD=