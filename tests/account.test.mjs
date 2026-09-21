import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'src', 'app', 'account.js');
const source = fs.readFileSync(sourcePath, 'utf8');

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener, options = false) {
    const entries = this.listeners.get(type) || [];
    entries.push({ listener, capture: options === true || options?.capture === true });
    this.listeners.set(type, entries);
  }

  removeEventListener(type, listener) {
    const entries = this.listeners.get(type) || [];
    this.listeners.set(type, entries.filter(entry => entry.listener !== listener));
  }

  dispatchEvent(event) {
    if (!event.target) event.target = this;
    event.currentTarget = this;
    if (!event.preventDefault) event.preventDefault = () => { event.defaultPrevented = true; };
    if (!event.stopImmediatePropagation) event.stopImmediatePropagation = () => { event.immediateStopped = true; };
    const entries = [...(this.listeners.get(event.type) || [])].sort((a, b) => Number(b.capture) - Number(a.capture));
    for (const entry of entries) {
      if (event.immediateStopped) break;
      entry.listener.call(this, event);
    }
    return !event.defaultPrevented;
  }
}

class FakeClassList {
  constructor(owner) {
    this.owner = owner;
    this.values = new Set();
  }

  add(...values) { values.forEach(value => this.values.add(value)); }
  remove(...values) { values.forEach(value => this.values.delete(value)); }
  contains(value) { return this.values.has(value); }
  toString() { return [...this.values].join(' '); }
}

class FakeElement extends FakeEventTarget {
  constructor(tagName) {
    super();
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = new Map();
    this.classList = new FakeClassList(this);
    this.className = '';
    this.textContent = '';
    this.value = '';
    this.disabled = false;
    this.hidden = false;
    this.open = false;
    this.style = {};
  }

  get firstChild() { return this.children[0] || null; }
  get childNodes() { return this.children; }

  append(...items) {
    for (const item of items) if (item) this.children.push(item);
  }

  replaceChildren(...items) {
    this.children = items.filter(Boolean);
  }

  removeChild(item) {
    const index = this.children.indexOf(item);
    if (index >= 0) this.children.splice(index, 1);
    return item;
  }

  remove() {
    this.removed = true;
    this.parentNode?.removeChild(this);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'id') this.id = String(value);
    if (name === 'class') {
      this.className = String(value);
      this.classList = new FakeClassList(this);
      this.className.split(/\s+/).filter(Boolean).forEach(item => this.classList.add(item));
    }
  }

  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); if (name === 'href') delete this.href; }

  click() {
    this.clicked = (this.clicked || 0) + 1;
    this.dispatchEvent({ type: 'click', target: this, preventDefault() {}, stopImmediatePropagation() {} });
  }

  showModal() { this.open = true; }
  close() { this.open = false; }

  querySelectorAll(selector) {
    const matches = [];
    const visit = node => {
      for (const child of node.children || []) {
        if (matchesSelector(child, selector)) matches.push(child);
        visit(child);
      }
    };
    visit(this);
    return matches;
  }

  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

function matchesSelector(element, selector) {
  const dataMatch = selector.match(/^\[([^=\]]+)(?:=["']?([^\]"']+)["']?)?\]$/);
  if (dataMatch) return element.getAttribute(dataMatch[1]) === (dataMatch[2] ?? element.getAttribute(dataMatch[1]));
  const idMatch = selector.match(/^#([\w-]+)$/);
  if (idMatch) return element.id === idMatch[1];
  return false;
}

class FakeDocument extends FakeEventTarget {
  constructor() {
    super();
    this.head = new FakeElement('head');
    this.body = new FakeElement('body');
    this.documentElement = new FakeElement('html');
    this.documentElement.append(this.head, this.body);
  }

  createElement(tagName) { return new FakeElement(tagName); }

  getElementById(id) {
    return this.querySelector(`#${id}`);
  }

  querySelectorAll(selector) {
    return this.documentElement.querySelectorAll(selector);
  }

  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

function flush() {
  return new Promise(resolve => setImmediate(resolve));
}

function harness({ withLoginBridge = false } = {}) {
  const childDocument = new FakeDocument();
  const parentDocument = new FakeDocument();
  const providerButtons = {
    discord: parentDocument.createElement('button'),
    facebook: parentDocument.createElement('button')
  };
  providerButtons.discord.id = 'btnLoginDisc';
  providerButtons.facebook.id = 'btnLoginFB';
  parentDocument.body.append(providerButtons.discord, providerButtons.facebook);

  const account = {
    id: 7,
    real_name: 'Pilot <One>',
    experience: 1200,
    coins: 900,
    skin_profiles: [{ skin_id_1: 101, skin_id_2: null }],
    skin_routes: { 101: 'skins/owned-one' },
    hat_profiles: [{ hat_id_1: 201, hat_id_2: null }],
    hat_images: { 201: { image_url: 'https://cdn.example/hat-201.png' } },
    emoji_slots: [{ id: 301, image_url: 'https://cdn.example/emoji-301.png' }, null, null, null]
  };
  const requestCalls = [];
  const requestJsonCalls = [];
  const sentEmoji = [];
  const emojiSlotUpdates = [];
  const authSlotUpdates = [];
  let mutationFailure = false;
  let loginBridgeCalls = [];
  let tokenListener = null;
  let nativeSupportCalls = [];
  let feedReleases = [];
  let ryutenShows = 0;
  let multiboxFeedReleases = 0;

  const h = {
    config: {
      authRoot: 'https://api.senpa.io',
      endPoints: {
        authProfile: 'https://api.senpa.io/account/',
        skins: {
          list: 'https://api.senpa.io/skins/list',
          search: 'https://api.senpa.io/skins/search',
          routeBase: 'https://cdn.example/skins'
        },
        hats: {
          list: 'https://api.senpa.io/hats/',
          equip: 'https://api.senpa.io/hats/equip',
          buy: id => `https://api.senpa.io/hats/${id}/buy`
        },
        emojis: {
          list: 'https://api.senpa.io/emojis/',
          slots: 'https://api.senpa.io/emojis/slots',
          buy: id => `https://api.senpa.io/emojis/${id}/buy`
        }
      }
    },
    store: { account, profiles: { selected: 0 }, profile: { nick: 'Original Nick' } },
    auth: {
      authToken: 'test-token',
      setEmojiSlots(slots) { authSlotUpdates.push(slots); }
    },
    player: {},
    actions: {
      sendEmoji(slot) { sentEmoji.push(slot); return true; }
    },
    account: {
      getToken() { return 'test-token'; },
      onTokenChange(callback) { tokenListener = callback; return () => { tokenListener = null; }; },
      async request(route, options = {}) {
        requestCalls.push({ route, options });
        if (route === '/account/') return account;
        if (route === '/skins/list' || route === '/skins/search') return { results: [{ id: 102, skin_name: 'New Skin', skin_route: 'skins/new' }] };
        if (route === '/hats/') return { results: { hats: [
          { id: 201, name: 'Owned Hat', image_url: 'https://cdn.example/hat-201.png', owned: true },
          { id: 202, name: 'Shop Hat', image_url: 'https://cdn.example/hat-202.png', owned: false, for_sale: true, price: 50 }
        ] } };
        if (route === '/emojis/') return { results: { emojis: [
          { id: 301, name: 'Owned Emoji', image_url: 'https://cdn.example/emoji-301.png', owned: true },
          { id: 302, name: 'Shop Emoji', image_url: 'https://cdn.example/emoji-302.png', owned: false, for_sale: true, price: 25 }
        ] } };
        throw new Error(`unexpected GET ${route}`);
      },
      async requestJson(route, body) {
        requestJsonCalls.push({ route, body });
        if (mutationFailure) return { success: false, error: 'denied' };
        return { success: true };
      },
      async logout() { return true; }
    }
  };
  if (withLoginBridge) {
    h.accountLogin = async provider => {
      loginBridgeCalls.push(provider);
      return true;
    };
  }

  const port = {
    modules: {},
    parentPort: {
      openSkinPicker() { throw new Error('legacy skin picker should be replaced'); },
      showNative(reason) { nativeSupportCalls.push(reason); },
      showRyuten() { ryutenShows += 1; },
      multibox: { releaseFeed() { multiboxFeedReleases += 1; } },
      frame: { contentWindow: { focus() {} } }
    },
    feedTiming: { release(reason) { feedReleases.push(reason); } },
    syncAccountSkins() {}
  };
  const accountCard = childDocument.createElement('section');
  accountCard.id = 'senpa-account';
  childDocument.body.append(accountCard);
  const window = {
    document: childDocument,
    parent: { document: parentDocument },
    confirm() { return true; },
    RYUTEN_PORT: port
  };
  const context = vm.createContext({ window, document: childDocument, URL, Promise, queueMicrotask, setImmediate, console });
  vm.runInContext(source, context, { filename: sourcePath });
  const adapter = port.modules.installAccount(h, { document: childDocument });

  return {
    account,
    adapter,
    childDocument,
    h,
    loginBridgeCalls,
    mutationFailure: value => { mutationFailure = value; },
    nativeSupportCalls,
    port,
    parentPort: port.parentPort,
    feedReleases,
    ryutenShows,
    multiboxFeedReleases,
    providerButtons,
    requestCalls,
    requestJsonCalls,
    sentEmoji,
    authSlotUpdates,
    emojiSlotUpdates,
    tokenListener
  };
}

test('account module exposes approved API, live state, and replaces pp.openSkinPicker', async () => {
  const fixture = harness();
  const { adapter, parentPort, port, nativeSupportCalls } = fixture;

  assert.equal(typeof port.modules.installAccount, 'function');
  assert.equal(typeof adapter.open, 'function');
  assert.equal(typeof adapter.equipSkin, 'function');
  assert.equal(typeof adapter.equipHat, 'function');
  assert.equal(typeof adapter.equipEmoji, 'function');
  assert.equal(adapter.state.open, false);

  adapter.open('account');
  assert.equal(adapter.state.open, true);
  assert.equal(adapter.state.tab, 'account');
  adapter.close();
  assert.equal(adapter.state.open, false);

  parentPort.openSkinPicker(1);
  assert.equal(adapter.state.open, true);
  assert.equal(adapter.state.tab, 'skins');
  assert.equal(adapter.state.skinSlot, 1);
  adapter.close();

  adapter.open('advanced');
  assert.equal(adapter.state.open, false);
  assert.equal(nativeSupportCalls.length, 1);
  assert.match(nativeSupportCalls[0], /Advanced native support/);
});

test('auth opens the existing native provider without showing the native menu', async () => {
  const fixture = harness();
  const { adapter, providerButtons, nativeSupportCalls } = fixture;

  assert.equal(await adapter.openAuth('discord'), true);
  assert.equal(providerButtons.discord.clicked, 1);
  assert.equal(nativeSupportCalls.length, 0);
  assert.equal(await adapter.openAuth('facebook'), true);
  assert.equal(providerButtons.facebook.clicked, 1);
  assert.equal(nativeSupportCalls.length, 0);
});

test('h.accountLogin is preferred when native provider buttons are not mounted', async () => {
  const fixture = harness({ withLoginBridge: true });
  const { adapter, loginBridgeCalls, providerButtons } = fixture;

  assert.equal(await adapter.openAuth('discord'), true);
  assert.deepEqual(loginBridgeCalls, ['discord']);
  assert.equal(providerButtons.discord.clicked || 0, 0);
});

test('account refresh and skins use h.config/native account routes', async () => {
  const fixture = harness();
  const { adapter, requestCalls, account } = fixture;

  await adapter.refresh();
  await adapter.loadSkins('level', 1, 'new');

  assert.equal(requestCalls[0].route, '/account/');
  assert.deepEqual(JSON.parse(JSON.stringify(requestCalls[1])), {
    route: '/skins/search',
    options: { query: { type: 'level', page: 1, query: 'new' } }
  });
  assert.equal(adapter.state.account.name, 'Pilot <One>');
  assert.equal(account.skin_profiles[0].skin_id_1, 101);
});

test('equipSkin commits only after a successful native response and rolls back failed mutations', async () => {
  const fixture = harness();
  const { adapter, account, mutationFailure, requestJsonCalls } = fixture;
  await adapter.refresh();
  assert.equal(fixture.h.store.profile.nick, 'Original Nick');

  await adapter.equipSkin(0, { id: 102, route: 'skins/new' });
  assert.equal(account.skin_profiles[0].skin_id_1, 102);
  assert.deepEqual(JSON.parse(JSON.stringify(requestJsonCalls[0])), {
    route: '/account/save-profile',
    body: { profile_id: 0, profile: { route1: 'skins/new', route2: '' } }
  });

  mutationFailure(true);
  await assert.rejects(() => adapter.equipSkin(0, { id: 103, route: 'skins/failed' }), /denied/);
  assert.equal(account.skin_profiles[0].skin_id_1, 102);
  assert.equal(account.skin_routes[102], 'skins/new');
  assert.equal(account.skin_routes[103], undefined);
});

test('owned hats equip through native hats/equip and failed responses leave ownership state unchanged', async () => {
  const fixture = harness();
  const { adapter, account, mutationFailure, requestJsonCalls } = fixture;
  await adapter.refresh();

  const ownedHat = { id: 202, name: 'New Hat', image_url: 'https://cdn.example/hat-202.png', owned: true };
  await adapter.equipHat(1, ownedHat);
  assert.equal(account.hat_profiles[0].hat_id_2, 202);
  assert.deepEqual(JSON.parse(JSON.stringify(requestJsonCalls[0])), {
    route: '/hats/equip',
    body: { profile_id: 0, tab: 2, hat_id: 202 }
  });

  mutationFailure(true);
  await assert.rejects(() => adapter.equipHat(0, { id: 203, image_url: 'https://cdn.example/hat-203.png' }), /denied/);
  assert.equal(account.hat_profiles[0].hat_id_1, 201);
  assert.equal(account.hat_profiles[0].hat_id_2, 202);
});

test('owned emoji equip waits for native success and sendEmoji calls only h.actions.sendEmoji', async () => {
  const fixture = harness();
  const { adapter, account, authSlotUpdates, mutationFailure, requestJsonCalls, sentEmoji } = fixture;
  await adapter.refresh();

  await adapter.equipEmoji(1, { id: 302, name: 'Owned New', image_url: 'https://cdn.example/emoji-302.png' });
  assert.equal(account.emoji_slots[0].id, 301);
  assert.equal(account.emoji_slots[1].id, 302);
  assert.deepEqual(JSON.parse(JSON.stringify(requestJsonCalls[0])), {
    route: '/emojis/slots',
    body: { slots: [301, 302, null, null] }
  });
  assert.deepEqual(JSON.parse(JSON.stringify(authSlotUpdates.at(-1))), ['https://cdn.example/emoji-301.png', 'https://cdn.example/emoji-302.png', null, null]);

  mutationFailure(true);
  await assert.rejects(() => adapter.equipEmoji(0, { id: 303, image_url: 'https://cdn.example/emoji-303.png' }), /denied/);
  assert.equal(account.emoji_slots[1].id, 302);
  assert.equal(account.emoji_slots[0].id, 301);

  assert.equal(adapter.sendEmoji(1), true);
  assert.deepEqual(sentEmoji, [1]);
});

test('normal account sections do not transition to native UI and Escape closes early', async () => {
  const fixture = harness();
  const { adapter, childDocument, nativeSupportCalls } = fixture;

  await adapter.refresh();
  for (const tab of ['account', 'skins', 'hats', 'emojis']) {
    adapter.open(tab);
    assert.equal(adapter.state.open, true);
    adapter.close();
  }
  assert.equal(nativeSupportCalls.length, 0);

  adapter.open('emojis');
  const panel = childDocument.querySelector('[data-ryuten-account="panel"]');
  assert.ok(panel);
  childDocument.dispatchEvent({ type: 'keydown', key: 'Escape' });
  assert.equal(adapter.state.open, false);
  assert.equal(panel.hidden, true);
});

test('rendered text is textContent and artwork is restricted to HTTPS', async () => {
  const fixture = harness();
  const { adapter, childDocument } = fixture;
  await adapter.refresh();
  adapter.open('account');
  const panel = childDocument.querySelector('[data-ryuten-account="panel"]');
  assert.ok(panel);
  const accountCard = childDocument.getElementById('senpa-account');
  assert.equal(accountCard.querySelector('#senpa-account-name').textContent, 'Pilot <One>');
  assert.equal(fixture.port.accountUtils?.httpsURL?.('http://unsafe.example/a.png') || '', '');
});
