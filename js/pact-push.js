/* ============================================================
   Ember Pact — Web Push client. Opt-in per device.
   enable(): ask permission -> subscribe with the server's VAPID key
             -> register the subscription (tagged with this user).
   The push itself is payload-less; the service worker fetches the
   text from api.php?action=notifications when a push arrives.
   ============================================================ */
window.App = window.App || {};
(function (App) {
  'use strict';

  const TOKEN = window.PACT_TOKEN || 'd81c3b70208130fcc0693ddde0b740cb1ff91cb5cb9252519fb5bcdd0e34ba6a';
  const API = location.pathname.replace(/\/[^/]*$/, '') + '/api.php';
  const H = () => ({ 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' });

  function urlB64ToUint8(b) {
    const pad = '='.repeat((4 - b.length % 4) % 4);
    const s = atob((b + pad).replace(/-/g, '+').replace(/_/g, '/'));
    const a = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
    return a;
  }

  function supported() {
    return typeof navigator !== 'undefined' && 'serviceWorker' in navigator &&
      typeof window !== 'undefined' && 'PushManager' in window && 'Notification' in window;
  }
  function permission() { return (typeof Notification !== 'undefined') ? Notification.permission : 'default'; }

  async function registration() { return navigator.serviceWorker.ready; }
  async function currentSubscription() {
    if (!supported()) return null;
    try { return await (await registration()).pushManager.getSubscription(); } catch (e) { return null; }
  }
  async function isSubscribed() { return !!(await currentSubscription()); }

  // returns true on success; throws 'unsupported' | 'denied' | 'no_vapid_key' | server error
  async function enable(user) {
    if (!supported()) throw new Error('unsupported');
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('denied');
    const kr = await fetch(API + '?action=vapidkey', { headers: H() });
    const kj = await kr.json();
    if (!kj.ok || !kj.key) throw new Error('no_vapid_key');
    const reg = await registration();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(kj.key) });
    const u = user || (App.store && App.store.currentUser && App.store.currentUser()) || 'me';
    const rr = await fetch(API + '?action=subscribe', { method: 'POST', headers: H(), body: JSON.stringify({ user: u, subscription: sub.toJSON() }) });
    const rj = await rr.json();
    if (!rj.ok) throw new Error(rj.error || 'subscribe_failed');
    return true;
  }

  async function disable() {
    const sub = await currentSubscription();
    if (sub) {
      try { await fetch(API + '?action=unsubscribe', { method: 'POST', headers: H(), body: JSON.stringify({ endpoint: sub.endpoint }) }); } catch (e) {}
      try { await sub.unsubscribe(); } catch (e) {}
    }
    return true;
  }

  App.pactPush = { supported, permission, isSubscribed, currentSubscription, enable, disable };
})(window.App);
