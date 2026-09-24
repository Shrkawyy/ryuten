

/* Ryuten account, profile, skin, hat, and emoji adapter. */
(() => {
  'use strict';

  const port = window.RYUTEN_PORT;
  if (!port) return;

  port.modules = port.modules || {};

  const MAX_PROFILES = 10;
  const DEFAULT_SKIN_BASE = 'https://api.senpa.io/u';
  const TAB_NAMES = ['account', 'skins', 'hats', 'emojis', 'shop'];
  const SKIN_TABS = ['level', 'free', 'mine', 'favorites'];

  const fallbackRoutes = Object.freeze({
    account: '/account/',
    skinsList: '/skins/list',
    saveProfile: '/account/save-profile',
    hats: '/hats/',
    hatsCatalogue: '/hats/',
    hatsEquip: '/hats/equip',
    emojis: '/emojis/',
    emojiSlots: '/emojis/slots'
  });

  const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const isObject = value => value !== null && typeof value === 'object';
  const isAccount = value => isObject(value) && !Array.isArray(value) && value !== -1 && !value.error;
  const finiteId = value => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    const id = Number(value);
    return Number.isSafeInteger(id) && id >= 0 ? id : null;
  };
  const textValue = (value, fallback = '') => {
    if (value === null || value === undefined) return fallback;
    return String(value).slice(0, 180);
  };
  const httpsURL = value => {
    if (typeof value !== 'string' || !value) return '';
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
    } catch {
      return '';
    }
  };
  const hexColor = value => {
    if (typeof value !== 'string' || !/^#[\da-f]{6}$/i.test(value)) return '';
    return value.toLowerCase();
  };

  function endpointValue(value, id, fallback) {
    if (typeof value === 'function') {
      try {
        const result = value(id);
        return typeof result === 'string' && result ? result : fallback;
      } catch {
        return fallback;
      }
    }
    if (typeof value === 'string' && value) {
      return value.includes('{id}') ? value.replaceAll('{id}', String(id)) : value;
    }
    return fallback;
  }

  function normalizeApiRoute(value, fallback, authRoot) {
    if (typeof value !== 'string' || !value) return fallback;
    if (value.startsWith('/')) return value;
    try {
      const url = new URL(value);
      const root = new URL(authRoot || 'https://api.senpa.io');
      if (url.origin !== root.origin) return fallback;
      return `${url.pathname || '/'}${url.search || ''}`;
    } catch {
      return fallback;
    }
  }

  function nativeRoutes(h) {
    const configured = isObject(h?.config) && isObject(h.config.endPoints) ? h.config.endPoints : {};
    const skins = isObject(configured.skins) ? configured.skins : {};
    const hats = isObject(configured.hats) ? configured.hats : {};
    const emojis = isObject(configured.emojis) ? configured.emojis : {};
    const authRoot = httpsURL(h?.config?.authRoot) || 'https://api.senpa.io';
    const route = (value, fallback) => normalizeApiRoute(value, fallback, authRoot);
    return {
      account: route(configured.authProfile, fallbackRoutes.account),
      skinsList: route(skins.list, fallbackRoutes.skinsList),
      skinsSearch: route(skins.search, '/skins/search'),
      saveProfile: route(configured.saveProfile, fallbackRoutes.saveProfile),
      hats: route(hats.list, fallbackRoutes.hats),
      hatsCatalogue: route(hats.catalogue, fallbackRoutes.hatsCatalogue),
      hatsEquip: route(hats.equip, fallbackRoutes.hatsEquip),
      emojis: route(emojis.list, fallbackRoutes.emojis),
      emojiSlots: route(emojis.slots, fallbackRoutes.emojiSlots),
      skinBase: httpsURL(skins.routeBase) || DEFAULT_SKIN_BASE,
      hatBuy: id => route(endpointValue(hats.buy, id, `/hats/${id}/buy`), `/hats/${id}/buy`),
      emojiBuy: id => route(endpointValue(emojis.buy, id, `/emojis/${id}/buy`), `/emojis/${id}/buy`)
    };
  }

  function normalizeEmoji(value) {
    if (!isObject(value)) return null;
    const id = finiteId(value.id);
    if (id === null) return null;
    return {
      id,
      image_url: httpsURL(value.image_url),
      name: textValue(value.emoji_name || value.name || `Emoji ${id}`, `Emoji ${id}`),
      owned: value.owned === true,
      for_sale: value.for_sale === true,
      price: value.price ?? value.cost ?? value.coins ?? null
    };
  }

  function normalizeEmojiSlots(account) {
    const slots = isAccount(account) && Array.isArray(account.emoji_slots) ? account.emoji_slots : [];
    return Array.from({ length: 4 }, (_, index) => normalizeEmoji(slots[index]));
  }

  function normalizeHat(value, catalog, ownedIds = new Set()) {
    if (!isObject(value)) return null;
    const id = finiteId(value.id);
    if (id === null) return null;
    const fallback = isObject(catalog) ? catalog : {};
    return {
      id,
      image_url: httpsURL(value.image_url || fallback.url),
      name: textValue(value.hat_name || value.name || `Hat ${id}`, `Hat ${id}`),
      owned: value.owned === true || ownedIds.has(id),
      for_sale: value.for_sale === true,
      price: value.price ?? value.cost ?? value.coins ?? null,
      scale: Number.isFinite(Number(value.scale)) ? Number(value.scale) : Number(fallback.scale) || 150,
      offset_y: Number.isFinite(Number(value.offset_y)) ? Number(value.offset_y) : Number(fallback.offset_y) || 0
    };
  }

  function normalizeSkin(value, h) {
    if (!isObject(value)) return null;
    const id = finiteId(value.id);
    const route = typeof value.skin_route === 'string' ? value.skin_route.trim() : '';
    if (id === null && !route) return null;
    const base = nativeRoutes(h).skinBase.replace(/\/$/, '');
    const image = httpsURL(route) || (route ? `${base}/${encodeURIComponent(route).replace(/%2F/g, '/')}` : '');
    return {
      id,
      route,
      image_url: image,
      name: textValue(value.skin_name || value.name || (id === null ? route : `Skin ${id}`), 'Skin'),
      requirement_type: textValue(value.requirement_type),
      requirement_data: textValue(value.requirement_data),
      favorite: value.favorite === true || value.favourite === true,
      owned: value.owned === true
    };
  }

  const accountUtils = {
    routes: fallbackRoutes,
    isAccount,
    normalizeEmoji,
    normalizeEmojiSlots,
    normalizeHat,
    normalizeSkin,
    normalizeApiRoute,
    httpsURL,
    hexColor
  };
  port.accountUtils = accountUtils;

  function createAdapter(h, reference) {
    const previous = port.account;
    if (previous && typeof previous.dispose === 'function') previous.dispose();

    const doc = reference?.document || (typeof document !== 'undefined' ? document : null);
    const state = {
      open: false,
      tab: 'account',
      profileIndex: finiteId(h?.store?.profiles?.selected) ?? 0,
      skinSlot: 0,
      skinTab: 'level',
      skinPage: 1,
      skinQuery: '',
      skins: [],
      hats: [],
      emojis: [],
      selectedEmojiSlot: 0,
      busy: '',
      loading: '',
      error: '',
      message: '',
      account: isAccount(h?.store?.account) ? h.store.account : null
    };
    state.profileIndex = Math.max(0, Math.min(MAX_PROFILES - 1, state.profileIndex));

    const listeners = [];
    let accountRequest = null;
    let panel = null;
    let style = null;
    let renderQueued = false;
    const pp = port.parentPort || null;
    const originalSkinPicker = pp?.openSkinPicker;
    let authGeneration = 0;
    let accountGeneration = 0;
    let accountRequestGeneration = -1;
    let awaitingAccountRefresh = false;
    let focusReturn = null;

    function makeElement(tag, attrs = {}, text) {
      let item = typeof reference?.el === 'function' ? reference.el(tag, attrs, text) : null;
      if (!item && doc?.createElement) item = doc.createElement(tag);
      if (!item) return null;
      if (typeof reference?.el !== 'function') {
        for (const [key, value] of Object.entries(attrs || {})) {
          if (value === undefined || value === null) continue;
          if (key === 'className') item.className = value;
          else if (key === 'textContent') item.textContent = value;
          else if (key in item && key !== 'style') item[key] = value;
          else item.setAttribute?.(key, String(value));
        }
        if (text !== undefined && text !== null) item.textContent = text;
      }
      return item;
    }

    function clear(item) {
      if (!item) return;
      if (typeof item.replaceChildren === 'function') item.replaceChildren();
      else while (item.firstChild) item.removeChild(item.firstChild);
    }

    function append(item, ...children) {
      if (!item) return item;
      for (const child of children) if (child) item.append?.(child);
      return item;
    }

    function addListener(target, type, listener, options) {
      if (!target?.addEventListener) return;
      target.addEventListener(type, listener, options);
      listeners.push(() => target.removeEventListener?.(type, listener, options));
    }

    function scheduleRender() {
      if (renderQueued) return;
      renderQueued = true;
      const flush = () => {
        renderQueued = false;
        render();
      };
      if (typeof queueMicrotask === 'function') queueMicrotask(flush);
      else Promise.resolve().then(flush);
    }

    function currentAccount() {
      if (awaitingAccountRefresh) return isAccount(state.account) && accountGeneration === authGeneration ? state.account : null;
      if (isAccount(h?.store?.account)) {
        state.account = h.store.account;
        accountGeneration = authGeneration;
        return h.store.account;
      }
      return isAccount(state.account) && accountGeneration === authGeneration ? state.account : null;
    }

    function hasToken() {
      const token = h?.auth?.authToken;
      if (typeof token === 'string' && token.length > 0) return true;
      try {
        const nativeToken = h?.account?.getToken?.();
        return typeof nativeToken === 'string' && nativeToken.length > 0;
      } catch {
        return false;
      }
    }

    function signedIn() {
      return hasToken() && Boolean(currentAccount());
    }

    function errorText(error) {
      const message = textValue(error?.message || error, 'Account request failed');
      return message.replace(/bearer|authorization|token/gi, '[redacted]').slice(0, 180);
    }

    function setError(error) {
      state.error = errorText(error);
      state.message = '';
      scheduleRender();
    }

    function request(route, options) {
      if (typeof h?.account?.request !== 'function') throw new Error('native_account_client_unavailable');
      return h.account.request(route, options || {});
    }

    function requestJson(route, body) {
      if (typeof h?.account?.requestJson !== 'function') throw new Error('native_account_client_unavailable');
      return h.account.requestJson(route, body);
    }

    function assertMutationSuccess(result, requireSuccess = false) {
      if (!isObject(result) || result.error || result.success === false || (hasOwn(result, 'success') && result.success !== true) || (requireSuccess && result.success !== true)) {
        throw new Error(textValue(result?.error, 'native_account_mutation_failed'));
      }
      return result;
    }

    function emojiSlots(account = currentAccount()) {
      return normalizeEmojiSlots(account);
    }

    function skinRoute(account, profileIndex, slot) {
      const profile = account?.skin_profiles?.[profileIndex];
      if (!isObject(profile)) return '';
      const id = profile[`skin_id_${slot + 1}`];
      const route = account?.skin_routes?.[id];
      return typeof route === 'string' ? route : '';
    }

    function hatIds(account, profileIndex) {
      const profile = account?.hat_profiles?.[profileIndex];
      return [finiteId(profile?.hat_id_1), finiteId(profile?.hat_id_2)];
    }

    function idsFrom(value) {
      if (!Array.isArray(value)) return [];
      return value.map(item => isObject(item) ? finiteId(item.id) : finiteId(item)).filter(id => id !== null);
    }

    function allEquippedHatIds(account) {
      if (!Array.isArray(account?.hat_profiles)) return [];
      return account.hat_profiles.flatMap((_, index) => hatIds(account, index)).filter(id => id !== null);
    }

    function syncLocalProfileCosmetics(account = currentAccount()) {
      if (!account) return;
      const nickname = h?.store?.profile?.nick;
      const hats = hatIds(account, state.profileIndex);
      if (isObject(h?.player)) {
        h.player.hat1 = hats[0] ?? 0;
        h.player.hat2 = hats[1] ?? 0;
      }
      if (isObject(h?.store?.profile)) {
        h.store.profile.hat1 = hats[0] ?? 0;
        h.store.profile.hat2 = hats[1] ?? 0;
        if (nickname !== undefined) h.store.profile.nick = nickname;
      }
      if (typeof port.syncAccountSkins === 'function') port.syncAccountSkins();
    }

    function syncAccountState(account) {
      state.account = account;
      accountGeneration = authGeneration;
      awaitingAccountRefresh = false;
      if (isObject(h?.store)) h.store.account = account;
      const urls = normalizeEmojiSlots(account).map(item => item?.image_url || null);
      if (typeof h?.auth?.setEmojiSlots === 'function') h.auth.setEmojiSlots(urls);
      syncLocalProfileCosmetics(account);
    }

    async function refreshAccount() {
      if (accountRequest && accountRequestGeneration === authGeneration) return accountRequest;
      if (!hasToken()) {
        awaitingAccountRefresh = false;
        state.account = isAccount(h?.store?.account) ? h.store.account : null;
        accountGeneration = authGeneration;
        scheduleRender();
        return state.account;
      }
      const generation = authGeneration;
      awaitingAccountRefresh = true;
      accountRequestGeneration = generation;
      accountRequest = Promise.resolve().then(() => request(nativeRoutes(h).account)).then(result => {
        if (generation !== authGeneration || !hasToken()) throw new Error('auth_changed');
        if (!isAccount(result)) throw new Error(textValue(result?.error, 'account_load_failed'));
        syncAccountState(result);
        state.error = '';
        scheduleRender();
        return result;
      }).catch(error => {
        if (generation === authGeneration) {
          awaitingAccountRefresh = false;
          state.account = isAccount(h?.store?.account) ? h.store.account : state.account;
        }
        setError(error);
        throw error;
      }).finally(() => {
        if (accountRequestGeneration === generation) {
          accountRequest = null;
          accountRequestGeneration = -1;
        }
      });
      return accountRequest;
    }

    function requireAccount() {
      if (!hasToken()) throw new Error('not_signed_in');
      const account = currentAccount();
      if (!account) throw new Error('account_not_loaded');
      return account;
    }

    async function openAuth(provider = 'discord') {
      const selected = String(provider).toLowerCase() === 'facebook' ? 'facebook' : 'discord';
      const loginBridge = h?.accountLogin;
      if (typeof loginBridge === 'function') {
        try {
          const result = await loginBridge(selected);
          if (result !== false) {
            state.message = `Opening Senpa ${selected} authentication…`;
            state.error = '';
            scheduleRender();
            return true;
          }
        } catch (error) {
          setError(error);
          return false;
        }
      }
      let nativeDocument = null;
      try {
        nativeDocument = window.parent && window.parent.document ? window.parent.document : null;
      } catch {
        nativeDocument = null;
      }
      const buttonId = selected === 'facebook' ? 'btnLoginFB' : 'btnLoginDisc';
      const button = nativeDocument?.getElementById?.(buttonId);
      if (button && typeof button.click === 'function') {
        button.click();
        state.message = `Opening Senpa ${selected} authentication…`;
        state.error = '';
        scheduleRender();
        return true;
      }
      setError(new Error('native_auth_provider_unavailable'));
      return false;
    }

    async function logout() {
      if (typeof h?.account?.logout !== 'function') throw new Error('native_account_client_unavailable');
      authGeneration += 1;
      awaitingAccountRefresh = true;
      await h.account.logout();
      state.account = null;
      accountGeneration = authGeneration;
      awaitingAccountRefresh = false;
      if (isObject(h?.store)) h.store.account = -1;
      if (typeof h?.auth?.setEmojiSlots === 'function') h.auth.setEmojiSlots(null);
      state.message = 'Signed out of Senpa.';
      state.error = '';
      scheduleRender();
      return true;
    }

    function setProfile(index) {
      const selected = Number(index);
      if (!Number.isInteger(selected) || selected < 0 || selected >= MAX_PROFILES) return false;
      state.profileIndex = selected;
      if (isObject(h?.store?.profiles)) h.store.profiles.selected = selected;
      syncLocalProfileCosmetics();
      state.message = `Profile ${selected + 1} selected.`;
      scheduleRender();
      return true;
    }

    function accountLevel(account) {
      const experience = Number(account?.experience);
      if (Number.isFinite(experience) && typeof h?.accountLevel?.levelFromExp === 'function') {
        try {
          const level = Number(h.accountLevel.levelFromExp(experience));
          if (Number.isFinite(level)) return level;
        } catch {
          /* Fall back to the account payload when the native helper is unavailable. */
        }
      }
      return account?.level ?? account?.account_level ?? null;
    }

    function skinIsBlocked(item, account) {
      if (!item) return true;
      if (textValue(item.name).trim().toLowerCase() === 'pending') return true;
      if (Number(item.requirement_type) !== 1) return false;
      const required = Number(item.requirement_data);
      const level = Number(accountLevel(account));
      return !Number.isFinite(required) || !Number.isFinite(level) || level < required;
    }

    function commitSkin(account, profileIndex, slot, item) {
      const profiles = Array.isArray(account.skin_profiles) ? account.skin_profiles : (account.skin_profiles = []);
      const profile = isObject(profiles[profileIndex]) ? profiles[profileIndex] : (profiles[profileIndex] = {});
      const oldId = profile[`skin_id_${slot + 1}`];
      const route = item?.route || '';
      if (item && item.id !== null) {
        profile[`skin_id_${slot + 1}`] = item.id;
        if (!isObject(account.skin_routes)) account.skin_routes = {};
        account.skin_routes[item.id] = route;
      } else {
        profile[`skin_id_${slot + 1}`] = null;
        if (isObject(account.skin_routes) && oldId !== undefined) delete account.skin_routes[oldId];
      }
      syncAccountState(account);
    }

    function skinSnapshot(account, profileIndex) {
      return {
        profiles: Array.isArray(account.skin_profiles),
        profile: Array.isArray(account.skin_profiles) && isObject(account.skin_profiles[profileIndex])
          ? { ...account.skin_profiles[profileIndex] }
          : undefined,
        routes: isObject(account.skin_routes) ? { ...account.skin_routes } : undefined
      };
    }

    function restoreSkinSnapshot(account, profileIndex, snapshot) {
      if (snapshot.profiles) {
        if (!Array.isArray(account.skin_profiles)) account.skin_profiles = [];
        account.skin_profiles[profileIndex] = snapshot.profile ? { ...snapshot.profile } : undefined;
      } else {
        delete account.skin_profiles;
      }
      if (snapshot.routes) account.skin_routes = { ...snapshot.routes };
      else delete account.skin_routes;
    }

    async function equipSkin(slot, item, profileIndex = state.profileIndex) {
      const account = requireAccount();
      const selectedSkin = item ? (item.route !== undefined ? item : normalizeSkin(item, h)) : null;
      const selectedSlot = Number(slot);
      const selectedProfile = Number(profileIndex);
      if (!Number.isInteger(selectedSlot) || selectedSlot < 0 || selectedSlot > 1) throw new Error('bad_skin_slot');
      if (!Number.isInteger(selectedProfile) || selectedProfile < 0 || selectedProfile >= MAX_PROFILES) throw new Error('bad_profile');
      if (selectedSkin && (!selectedSkin.route || skinIsBlocked(selectedSkin, account))) throw new Error('skin_unavailable');
      const next = {
        route1: selectedSlot === 0 ? (selectedSkin?.route || '') : skinRoute(account, selectedProfile, 0),
        route2: selectedSlot === 1 ? (selectedSkin?.route || '') : skinRoute(account, selectedProfile, 1)
      };
      const snapshot = skinSnapshot(account, selectedProfile);
      const generation = authGeneration;
      const result = assertMutationSuccess(await requestJson(nativeRoutes(h).saveProfile, {
        profile_id: selectedProfile,
        profile: next
      }));
      if (generation !== authGeneration || !hasToken()) throw new Error('auth_changed');
      try {
        commitSkin(account, selectedProfile, selectedSlot, selectedSkin?.route ? selectedSkin : null);
      } catch (error) {
        restoreSkinSnapshot(account, selectedProfile, snapshot);
        try { syncAccountState(account); } catch { /* preserve the original commit error */ }
        throw error;
      }
      state.message = selectedSkin?.route ? 'Skin equipped.' : 'Skin slot cleared.';
      state.error = '';
      scheduleRender();
      return result;
    }

    async function loadSkins(tab = state.skinTab, page = state.skinPage, query = state.skinQuery) {
      requireAccount();
      const selectedTab = SKIN_TABS.includes(tab) ? tab : 'level';
      const selectedPage = Math.max(1, Number(page) || 1);
      const apiPage = selectedTab === 'free' ? selectedPage - 1 : selectedPage;
      state.loading = 'skins';
      scheduleRender();
      try {
        const searchQuery = textValue(query).trim();
        const result = await request(searchQuery ? nativeRoutes(h).skinsSearch : nativeRoutes(h).skinsList, {
          query: { type: selectedTab, page: apiPage, query: searchQuery }
        });
        if (result?.error) throw new Error(textValue(result.error, 'skins_load_failed'));
        const values = Array.isArray(result?.results) ? result.results : Array.isArray(result?.results?.skins) ? result.results.skins : Array.isArray(result) ? result : null;
        if (!values) throw new Error('skins_response_invalid');
        state.skinTab = selectedTab;
        state.skinPage = selectedPage;
        state.skinQuery = searchQuery;
        state.skins = values.map(value => normalizeSkin(value, h)).filter(Boolean);
        state.error = '';
        return state.skins;
      } finally {
        state.loading = '';
        scheduleRender();
      }
    }

    function commitHat(account, profileIndex, slot, item) {
      const profiles = Array.isArray(account.hat_profiles) ? account.hat_profiles : (account.hat_profiles = []);
      const profile = isObject(profiles[profileIndex]) ? profiles[profileIndex] : (profiles[profileIndex] = {});
      profile.hat_id_1 = profile.hat_id_1 ?? null;
      profile.hat_id_2 = profile.hat_id_2 ?? null;
      profile[`hat_id_${slot + 1}`] = item ? item.id : null;
      if (item?.image_url) {
        if (!isObject(account.hat_images)) account.hat_images = {};
        account.hat_images[item.id] = {
          image_url: item.image_url,
          scale: item.scale,
          offset_y: item.offset_y
        };
      }
      syncAccountState(account);
    }

    function hatSnapshot(account, profileIndex) {
      return {
        profiles: Array.isArray(account.hat_profiles),
        profile: Array.isArray(account.hat_profiles) && isObject(account.hat_profiles[profileIndex])
          ? { ...account.hat_profiles[profileIndex] }
          : undefined,
        images: isObject(account.hat_images) ? { ...account.hat_images } : undefined
      };
    }

    function restoreHatSnapshot(account, profileIndex, snapshot) {
      if (snapshot.profiles) {
        if (!Array.isArray(account.hat_profiles)) account.hat_profiles = [];
        account.hat_profiles[profileIndex] = snapshot.profile ? { ...snapshot.profile } : undefined;
      } else {
        delete account.hat_profiles;
      }
      if (snapshot.images) account.hat_images = { ...snapshot.images };
      else delete account.hat_images;
    }

    async function loadHats() {
      requireAccount();
      state.loading = 'hats';
      scheduleRender();
      try {
        const result = await request(nativeRoutes(h).hats);
        if (result?.error) throw new Error(textValue(result.error, 'hats_load_failed'));
        const source = isObject(result?.results) ? result.results : result;
        const values = Array.isArray(result?.results) ? result.results : Array.isArray(source?.hats) ? source.hats : Array.isArray(source) ? source : null;
        if (!values) throw new Error('hats_response_invalid');
        const ownedIds = new Set([
          ...idsFrom(source?.owned),
          ...idsFrom(result?.owned),
          ...allEquippedHatIds(currentAccount())
        ]);
        state.hats = values.map(value => normalizeHat(value, h?.hatCatalog?.get?.(finiteId(value?.id)), ownedIds)).filter(Boolean);
        state.error = '';
        return state.hats;
      } finally {
        state.loading = '';
        scheduleRender();
      }
    }

    async function equipHat(slot, item, profileIndex = state.profileIndex) {
      const account = requireAccount();
      const selectedSlot = Number(slot);
      const selectedProfile = Number(profileIndex);
      if (!Number.isInteger(selectedSlot) || selectedSlot < 0 || selectedSlot > 1) throw new Error('bad_hat_slot');
      if (!Number.isInteger(selectedProfile) || selectedProfile < 0 || selectedProfile >= MAX_PROFILES) throw new Error('bad_profile');
      const snapshot = hatSnapshot(account, selectedProfile);
      const generation = authGeneration;
      const result = assertMutationSuccess(await requestJson(nativeRoutes(h).hatsEquip, {
        profile_id: selectedProfile,
        tab: selectedSlot + 1,
        hat_id: item ? item.id : null
      }), true);
      if (generation !== authGeneration || !hasToken()) throw new Error('auth_changed');
      try {
        commitHat(account, selectedProfile, selectedSlot, item || null);
      } catch (error) {
        restoreHatSnapshot(account, selectedProfile, snapshot);
        try { syncAccountState(account); } catch { /* preserve the original commit error */ }
        throw error;
      }
      state.message = item ? 'Hat equipped.' : 'Hat slot cleared.';
      state.error = '';
      scheduleRender();
      return result;
    }

    async function loadEmojis() {
      requireAccount();
      state.loading = 'emojis';
      scheduleRender();
      try {
        const result = await request(nativeRoutes(h).emojis);
        if (result?.error) throw new Error(textValue(result.error, 'emojis_load_failed'));
        const source = isObject(result?.results) ? result.results : result;
        const values = Array.isArray(result?.results) ? result.results : Array.isArray(source?.emojis) ? source.emojis : Array.isArray(source) ? source : null;
        if (!values) throw new Error('emojis_response_invalid');
        const ownedIds = new Set([...idsFrom(source?.owned), ...idsFrom(result?.owned)]);
        state.emojis = values.map(value => {
          const item = normalizeEmoji(value);
          if (item && ownedIds.has(item.id)) item.owned = true;
          return item;
        }).filter(Boolean);
        state.error = '';
        return state.emojis;
      } finally {
        state.loading = '';
        scheduleRender();
      }
    }

    function commitEmojiSlots(account, slots) {
      account.emoji_slots = slots.map(item => item ? {
        id: item.id,
        image_url: item.image_url
      } : null);
      syncAccountState(account);
    }

    async function equipEmoji(slot, item) {
      const account = requireAccount();
      const selectedSlot = Number(slot);
      if (!Number.isInteger(selectedSlot) || selectedSlot < 0 || selectedSlot > 3) throw new Error('bad_emoji_slot');
      const previous = emojiSlots(account);
      const next = previous.slice();
      next[selectedSlot] = item ? normalizeEmoji(item) : null;
      if (item && !next[selectedSlot]) throw new Error('bad_emoji');
      if (next[selectedSlot]) {
        for (let index = 0; index < next.length; index += 1) {
          if (index !== selectedSlot && next[index]?.id === next[selectedSlot].id) next[index] = null;
        }
      }
      const generation = authGeneration;
      const result = assertMutationSuccess(await requestJson(nativeRoutes(h).emojiSlots, {
        slots: next.map(value => value?.id ?? null)
      }), true);
      if (generation !== authGeneration || !hasToken()) throw new Error('auth_changed');
      try {
        commitEmojiSlots(account, next);
      } catch (error) {
        commitEmojiSlots(account, previous);
        throw error;
      }
      state.message = item ? `Emoji equipped to slot ${selectedSlot + 1}.` : `Emoji slot ${selectedSlot + 1} cleared.`;
      state.error = '';
      scheduleRender();
      return result;
    }

    function sendEmoji(slot) {
      const selectedSlot = Number(slot);
      if (!Number.isInteger(selectedSlot) || selectedSlot < 0 || selectedSlot > 3) return false;
      if (typeof h?.actions?.sendEmoji !== 'function') {
        setError(new Error('native_send_emoji_unavailable'));
        return false;
      }
      const accepted = Boolean(h.actions.sendEmoji(selectedSlot));
      state.message = accepted ? `Emoji requested from slot ${selectedSlot + 1}; Senpa applies its cooldown.` : 'Emoji is unavailable right now.';
      state.error = '';
      scheduleRender();
      return accepted;
    }

    async function buyHat(id) {
      requireAccount();
      const selectedId = finiteId(id);
      if (selectedId === null) throw new Error('bad_hat');
      const generation = authGeneration;
      const result = assertMutationSuccess(await requestJson(nativeRoutes(h).hatBuy(selectedId), {}), true);
      if (generation !== authGeneration || !hasToken()) throw new Error('auth_changed');
      state.message = 'Hat purchased.';
      await Promise.all([refreshAccount(), loadHats()]);
      return result;
    }

    async function buyEmoji(id) {
      requireAccount();
      const selectedId = finiteId(id);
      if (selectedId === null) throw new Error('bad_emoji');
      const generation = authGeneration;
      const result = assertMutationSuccess(await requestJson(nativeRoutes(h).emojiBuy(selectedId), {}), true);
      if (generation !== authGeneration || !hasToken()) throw new Error('auth_changed');
      state.message = 'Emoji purchased.';
      await Promise.all([refreshAccount(), loadEmojis()]);
      return result;
    }

    function openAdvancedNativeSupport() {
      const showNative = typeof pp?.showNative === 'function' ? pp.showNative.bind(pp) : null;
      if (!showNative) {
        setError(new Error('native_support_unavailable'));
        return false;
      }
      showNative('Advanced native support: replays and native-only graphics');
      return true;
    }

    function profileSelect() {
      const wrapper = makeElement('label', { className: 'ryuten-account-field', 'data-account-control': 'profile' });
      append(wrapper, makeElement('span', {}, 'Profile'));
      const select = makeElement('select', { 'aria-label': 'Profile', 'data-account-profile': 'true' });
      for (let index = 0; index < MAX_PROFILES; index += 1) {
        const option = makeElement('option', { value: String(index) }, `Profile ${index + 1}`);
        if (option && index === state.profileIndex) option.selected = true;
        select?.append?.(option);
      }
      if (select) {
        select.value = String(state.profileIndex);
        select.addEventListener?.('change', event => setProfile(event.target.value));
      }
      append(wrapper, select);
      return wrapper;
    }

    function actionButton(label, callback, options = {}) {
      const button = makeElement('button', { className: options.className || 'ryuten-account-button', type: 'button' }, label);
      if (!button) return button;
      for (const [key, value] of Object.entries(options.attrs || {})) button.setAttribute?.(key, String(value));
      if (options.disabled) button.disabled = true;
      button.addEventListener?.('click', event => {
        event.preventDefault();
        if (button.disabled) return;
        Promise.resolve().then(callback).catch(setError);
      });
      return button;
    }

    function imageNode(url, alt, className = 'ryuten-account-image') {
      const safeURL = httpsURL(url);
      if (!safeURL) return null;
      const image = makeElement('img', { className, alt: textValue(alt, 'Senpa artwork'), loading: 'lazy' });
      if (!image) return null;
      image.src = safeURL;
      image.referrerPolicy = 'no-referrer';
      image.addEventListener?.('error', () => image.remove?.());
      return image;
    }

    function displayName(account) {
      return textValue(account?.display_name || account?.username || account?.real_name || account?.name, 'Senpa account');
    }

    function updateLegacyAccountCard(account) {
      const card = doc?.getElementById?.('senpa-account');
      if (!card) return;
      const name = card.querySelector?.('#senpa-account-name');
      const info = card.querySelector?.('#senpa-account-info');
      if (name) name.textContent = signedIn() ? displayName(account) : 'Sign in to Senpa';
      if (info) info.textContent = signedIn() ? `Level ${textValue(accountLevel(account), '—')} · Account, skins, hats and emojis` : 'Account, skins, hats and emojis';
    }

    function statusNodes() {
      const wrapper = makeElement('div', { className: 'ryuten-account-status', 'aria-live': 'polite' });
      if (state.busy || state.loading) append(wrapper, makeElement('span', { className: 'ryuten-account-busy' }, state.busy || `Loading ${state.loading}…`));
      if (state.error) append(wrapper, makeElement('span', { className: 'ryuten-account-error', role: 'alert' }, state.error));
      if (state.message) append(wrapper, makeElement('span', { className: 'ryuten-account-message' }, state.message));
      return wrapper;
    }

    function accountSummary(account) {
      const wrapper = makeElement('div', { className: 'ryuten-account-summary' });
      const avatar = imageNode(account?.avatar_url || account?.avatar, 'Account avatar', 'ryuten-account-avatar');
      append(wrapper, avatar);
      const details = makeElement('div', { className: 'ryuten-account-summary-details' });
      append(details,
        makeElement('strong', {}, displayName(account)),
        makeElement('span', {}, `Level ${textValue(accountLevel(account), '—')}`),
        makeElement('span', {}, `Coins ${textValue(account?.coins ?? account?.currency?.coins, '—')}`)
      );
      append(wrapper, details);
      return wrapper;
    }

    function loginButtons() {
      const wrapper = makeElement('div', { className: 'ryuten-account-actions' });
      append(wrapper,
        actionButton('Continue with Discord', () => openAuth('discord'), { attrs: { 'data-account-action': 'auth', 'data-provider': 'discord' } }),
        actionButton('Continue with Facebook', () => openAuth('facebook'), { attrs: { 'data-account-action': 'auth', 'data-provider': 'facebook' } })
      );
      append(wrapper, makeElement('p', { className: 'ryuten-account-note' }, 'Senpa authentication opens its existing provider popup; Ryuten stays in control of this menu.'));
      return wrapper;
    }

    function currentEmojiView(account) {
      const wrapper = makeElement('section', { className: 'ryuten-account-section' });
      append(wrapper, makeElement('h3', {}, 'Current game emojis'));
      const grid = makeElement('div', { className: 'ryuten-account-grid' });
      for (let index = 0; index < 4; index += 1) {
        const item = emojiSlots(account)[index];
        const card = makeElement('div', { className: `ryuten-account-card${state.selectedEmojiSlot === index ? ' is-selected' : ''}`, 'data-account-kind': 'emoji-slot', 'data-slot': String(index) });
        append(card, makeElement('strong', {}, `Slot ${index + 1}`), imageNode(item?.image_url, item?.name || `Emoji ${index + 1}`));
        append(card, makeElement('span', {}, item?.name || 'Empty'));
        append(card,
          actionButton(state.selectedEmojiSlot === index ? 'Selected' : 'Select', () => {
            state.selectedEmojiSlot = index;
            scheduleRender();
          }, { disabled: state.selectedEmojiSlot === index, attrs: { 'data-account-action': 'select-emoji-slot', 'data-slot': String(index) } }),
          actionButton('Send', () => sendEmoji(index), { disabled: !item || !signedIn(), attrs: { 'data-account-action': 'send-emoji', 'data-slot': String(index) } })
        );
        append(grid, card);
      }
      append(wrapper, grid);
      return wrapper;
    }

    function renderAccountTab(body, account) {
      if (!signedIn()) {
        append(body,
          makeElement('p', {}, 'Sign in to manage your Ryuten account, profiles, skins, hats, and emojis.'),
          loginButtons()
        );
        return;
      }
      append(body, accountSummary(account), profileSelect());
      append(body, actionButton('Refresh account', () => refreshAccount()));
      append(body, actionButton('Sign out', () => logout(), { className: 'ryuten-account-button danger' }));
      append(body, currentEmojiView(account));
      const quick = makeElement('div', { className: 'ryuten-account-actions' });
      append(quick,
        actionButton('Manage skins', () => activateTab('skins')),
        actionButton('Manage hats', () => activateTab('hats')),
        actionButton('Manage emojis', () => activateTab('emojis'))
      );
      append(body, quick);
      const advanced = makeElement('section', { className: 'ryuten-account-section advanced-support' });
      append(advanced,
        makeElement('h3', {}, 'Advanced native support'),
        makeElement('p', {}, 'Replays and native-only graphics/preferences remain available here explicitly.'),
        actionButton('Open native support', openAdvancedNativeSupport, { attrs: { 'data-account-action': 'advanced' } })
      );
      append(body, advanced);
    }

    function renderSkinTab(body, account) {
      if (!signedIn()) {
        append(body, makeElement('p', {}, 'Sign in to manage skins.'), loginButtons());
        return;
      }
      append(body, profileSelect());
      const slots = makeElement('div', { className: 'ryuten-account-actions' });
      for (let slot = 0; slot < 2; slot += 1) {
        const equipped = skinRoute(account, state.profileIndex, slot);
        append(slots, actionButton(`Skin slot ${slot + 1}${state.skinSlot === slot ? ' (selected)' : ''}`, () => {
          state.skinSlot = slot;
          scheduleRender();
        }, { disabled: state.skinSlot === slot }), makeElement('span', { className: 'ryuten-account-current' }, equipped || 'Empty'));
      }
      append(body, slots, actionButton('Remove current skin', () => equipSkin(state.skinSlot, null), {
        disabled: !skinRoute(account, state.profileIndex, state.skinSlot),
        attrs: { 'data-account-action': 'clear-current-skin', 'data-slot': String(state.skinSlot) }
      }));
      const filters = makeElement('div', { className: 'ryuten-account-actions' });
      for (const tab of SKIN_TABS) append(filters, actionButton(tab, () => {
        state.skinTab = tab;
        state.skinPage = 1;
        void loadSkins(tab, 1, state.skinQuery).catch(setError);
      }, { disabled: state.skinTab === tab, attrs: { 'data-skin-tab': tab } }));
      append(body, filters);
      const search = makeElement('input', { type: 'search', placeholder: 'Search skins', value: state.skinQuery, 'aria-label': 'Search skins' });
      const searchButton = actionButton('Search', () => {
        state.skinPage = 1;
        void loadSkins(state.skinTab, 1, search.value).catch(setError);
      });
      append(body, makeElement('div', { className: 'ryuten-account-search' }), search, searchButton);
      const grid = makeElement('div', { className: 'ryuten-account-grid' });
      for (const item of state.skins) {
        const equipped = item.route && item.route === skinRoute(account, state.profileIndex, state.skinSlot);
        const card = makeElement('div', { className: 'ryuten-account-card', 'data-account-kind': 'skin', 'data-item-id': item.id === null ? '' : String(item.id) });
        append(card, imageNode(item.image_url, item.name), makeElement('strong', {}, item.name));
        if (item.requirement_data) append(card, makeElement('small', {}, item.requirement_data));
        append(card, actionButton(equipped ? 'Clear slot' : (skinIsBlocked(item, account) ? 'Locked' : 'Equip'), () => equipSkin(state.skinSlot, equipped ? null : item), { disabled: !item.route || (!equipped && skinIsBlocked(item, account)), attrs: { 'data-account-action': 'equip-skin', 'data-slot': String(state.skinSlot) } }));
        append(grid, card);
      }
      append(body, grid);
      const pages = makeElement('div', { className: 'ryuten-account-actions' });
      append(pages,
        actionButton('Previous page', () => {
          if (state.skinPage > 1) void loadSkins(state.skinTab, state.skinPage - 1, state.skinQuery).catch(setError);
        }, { disabled: state.skinPage <= 1 }),
        makeElement('span', {}, `Page ${state.skinPage}`),
        actionButton('Next page', () => void loadSkins(state.skinTab, state.skinPage + 1, state.skinQuery).catch(setError))
      );
      append(body, pages);
    }

    function renderHatTab(body, account) {
      if (!signedIn()) {
        append(body, makeElement('p', {}, 'Sign in to manage hats.'), loginButtons());
        return;
      }
      append(body, profileSelect());
      const equipped = hatIds(account, state.profileIndex);
      const slots = makeElement('div', { className: 'ryuten-account-actions' });
      for (let slot = 0; slot < 2; slot += 1) {
        append(slots, actionButton(`Hat slot ${slot + 1}${state.skinSlot === slot ? ' (selected)' : ''}`, () => {
          state.skinSlot = slot;
          scheduleRender();
        }, { disabled: state.skinSlot === slot }), makeElement('span', { className: 'ryuten-account-current' }, equipped[slot] === null ? 'Empty' : `Hat ${equipped[slot]}`));
      }
      append(body, slots, actionButton('Open hat shop', () => activateTab('shop')));
      const grid = makeElement('div', { className: 'ryuten-account-grid' });
      for (const item of state.hats.filter(value => value.owned)) {
        const isEquipped = equipped[state.skinSlot] === item.id;
        const card = makeElement('div', { className: 'ryuten-account-card', 'data-account-kind': 'hat', 'data-item-id': String(item.id) });
        append(card, imageNode(item.image_url, item.name), makeElement('strong', {}, item.name));
        append(card, actionButton(isEquipped ? 'Clear slot' : 'Equip', () => equipHat(state.skinSlot, isEquipped ? null : item), { attrs: { 'data-account-action': 'equip-hat', 'data-slot': String(state.skinSlot) } }));
        append(grid, card);
      }
      if (!grid.childNodes?.length && !state.loading) append(grid, makeElement('p', {}, 'No owned hats found.')); 
      append(body, grid);
    }

    function renderEmojiTab(body, account) {
      if (!signedIn()) {
        append(body, makeElement('p', {}, 'Sign in to manage emojis.'), loginButtons());
        return;
      }
      append(body, currentEmojiView(account));
      append(body, makeElement('p', { className: 'ryuten-account-note' }, `Selected slot: ${state.selectedEmojiSlot + 1}. Choose an owned emoji below to equip it.`));
      const grid = makeElement('div', { className: 'ryuten-account-grid' });
      for (const item of state.emojis.filter(value => value.owned)) {
        const card = makeElement('div', { className: 'ryuten-account-card', 'data-account-kind': 'emoji', 'data-item-id': String(item.id) });
        append(card, imageNode(item.image_url, item.name), makeElement('strong', {}, item.name));
        append(card, actionButton('Equip to selected slot', () => equipEmoji(state.selectedEmojiSlot, item), { attrs: { 'data-account-action': 'equip-emoji', 'data-slot': String(state.selectedEmojiSlot) } }));
        append(grid, card);
      }
      if (!grid.childNodes?.length && !state.loading) append(grid, makeElement('p', {}, 'No owned emojis found.'));
      append(body, grid, actionButton('Open emoji shop', () => activateTab('shop')));
    }

    function confirmPurchase(kind, item) {
      const amount = item.price === null || item.price === undefined ? '' : ` for ${textValue(item.price)} coins`;
      const prompt = `Buy ${textValue(item.name, kind)}${amount}?`;
      return typeof window.confirm !== 'function' || window.confirm(prompt);
    }

    function renderShopTab(body) {
      if (!signedIn()) {
        append(body, makeElement('p', {}, 'Sign in to view the Senpa shop.'), loginButtons());
        return;
      }
      append(body, makeElement('p', { className: 'ryuten-account-note' }, 'Purchases require an explicit confirmation and are sent through the native Senpa account client.'));
      append(body, makeElement('h3', {}, 'Hats'));
      const hats = makeElement('div', { className: 'ryuten-account-grid' });
      for (const item of state.hats.filter(value => value.for_sale && !value.owned)) {
        const card = makeElement('div', { className: 'ryuten-account-card', 'data-account-kind': 'shop-hat', 'data-item-id': String(item.id) });
        append(card, imageNode(item.image_url, item.name), makeElement('strong', {}, item.name), makeElement('span', {}, item.price === null ? 'Price unavailable' : `${textValue(item.price)} coins`));
        append(card, actionButton('Buy hat', () => {
          if (confirmPurchase('hat', item)) return buyHat(item.id);
          return undefined;
        }, { disabled: item.price === null || item.price === undefined, attrs: { 'data-account-action': 'buy-hat', 'data-item-id': String(item.id) } }));
        append(hats, card);
      }
      append(body, hats);
      append(body, makeElement('h3', {}, 'Emojis'));
      const emojis = makeElement('div', { className: 'ryuten-account-grid' });
      for (const item of state.emojis.filter(value => value.for_sale && !value.owned)) {
        const card = makeElement('div', { className: 'ryuten-account-card', 'data-account-kind': 'shop-emoji', 'data-item-id': String(item.id) });
        append(card, imageNode(item.image_url, item.name), makeElement('strong', {}, item.name), makeElement('span', {}, item.price === null ? 'Price unavailable' : `${textValue(item.price)} coins`));
        append(card, actionButton('Buy emoji', () => {
          if (confirmPurchase('emoji', item)) return buyEmoji(item.id);
          return undefined;
        }, { disabled: item.price === null || item.price === undefined, attrs: { 'data-account-action': 'buy-emoji', 'data-item-id': String(item.id) } }));
        append(emojis, card);
      }
      append(body, emojis);
    }

    function render() {
      const account = currentAccount();
      updateLegacyAccountCard(account);
      if (!panel) return;
      const root = makeElement('div', { className: 'ryuten-account-panel-inner' });
      const header = makeElement('header', { className: 'ryuten-account-header' });
      const heading = makeElement('div');
      append(heading, makeElement('h2', {}, 'Ryuten account'), makeElement('span', {}, account ? displayName(account) : 'Not signed in'));
      append(header, heading);
      append(header, actionButton('Close', close, { className: 'ryuten-account-close' }));
      const nav = makeElement('nav', { className: 'ryuten-account-tabs', 'aria-label': 'Account sections' });
      for (const tab of TAB_NAMES) append(nav, actionButton(tab[0].toUpperCase() + tab.slice(1), () => activateTab(tab), { className: `ryuten-account-tab${state.tab === tab ? ' is-active' : ''}`, disabled: state.tab === tab, attrs: { 'data-account-tab': tab } }));
      const body = makeElement('main', { className: 'ryuten-account-body' });
      if (state.tab === 'account') renderAccountTab(body, account);
      else if (state.tab === 'skins') renderSkinTab(body, account);
      else if (state.tab === 'hats') renderHatTab(body, account);
      else if (state.tab === 'emojis') renderEmojiTab(body, account);
      else renderShopTab(body);
      append(root, header, nav, statusNodes(), body);
      clear(panel);
      panel.append?.(root);
    }

    function activateTab(tab) {
      if (!TAB_NAMES.includes(tab)) return false;
      state.tab = tab;
      state.error = '';
      scheduleRender();
      if (signedIn()) {
        const load = tab === 'skins' ? loadSkins() : tab === 'hats' ? loadHats() : tab === 'emojis' ? loadEmojis() : tab === 'shop' ? Promise.all([loadHats(), loadEmojis()]) : null;
        if (load) Promise.resolve(load).catch(setError);
      }
      return true;
    }

    function prepareRyutenMenu() {
      port.feedTiming?.release?.('account');
      pp?.multibox?.releaseFeed?.();
      pp?.showRyuten?.();
      h?.menu?.show?.();
    }

    function open(target = 'account', slot) {
      const options = typeof target === 'string' ? { tab: target, slot } : (isObject(target) ? target : {});
      if (options.tab === 'advanced') return openAdvancedNativeSupport();
      if (TAB_NAMES.includes(options.tab)) state.tab = options.tab;
      if (Number.isInteger(Number(options.slot))) state.skinSlot = Math.max(0, Math.min(1, Number(options.slot)));
      focusReturn = doc?.activeElement || null;
      prepareRyutenMenu();
      state.open = true;
      state.error = '';
      state.message = '';
      if (panel) {
        panel.hidden = false;
        panel.classList?.add('is-open');
        if (typeof panel.showModal === 'function' && !panel.open) panel.showModal();
      }
      render();
      void refreshAccount().then(() => activateTab(state.tab)).catch(() => {});
      return true;
    }

    function close() {
      state.open = false;
      port.feedTiming?.release?.('account-close');
      pp?.multibox?.releaseFeed?.();
      if (panel) {
        if (typeof panel.close === 'function' && panel.open) panel.close();
        panel.hidden = true;
        panel.classList?.remove('is-open');
      }
      const target = focusReturn;
      focusReturn = null;
      if (target && typeof target.focus === 'function') target.focus({ preventScroll: true });
      else pp?.frame?.contentWindow?.focus?.();
      return true;
    }

    function publicState() {
      const account = currentAccount();
      return {
        open: state.open,
        tab: state.tab,
        profileIndex: state.profileIndex,
        skinSlot: state.skinSlot,
        signedIn: signedIn(),
        busy: state.busy || state.loading,
        error: state.error,
        message: state.message,
        account: account ? {
          id: finiteId(account.id),
          name: displayName(account),
          level: accountLevel(account),
          coins: account.coins ?? account.currency?.coins ?? null
        } : null,
        emojiSlots: emojiSlots(account).map(item => item ? { id: item.id, image_url: item.image_url, name: item.name } : null),
        hats: hatIds(account, state.profileIndex)
      };
    }

    Object.defineProperties(publicState, {
      open: { enumerable: true, get: () => state.open },
      tab: { enumerable: true, get: () => state.tab },
      busy: { enumerable: true, get: () => state.busy || state.loading },
      error: { enumerable: true, get: () => state.error },
      message: { enumerable: true, get: () => state.message }
    });

    const css = `
      #ryuten-account-panel { border: 0; border-radius: 14px; padding: 0; width: min(760px, calc(100vw - 28px)); max-height: min(760px, calc(100vh - 28px)); background: #111827; color: #f8fafc; box-shadow: 0 18px 70px #000b; }
      #ryuten-account-panel::backdrop { background: #020617b8; }
      #ryuten-account-panel[hidden] { display: none; }
      .ryuten-account-panel-inner { display: flex; flex-direction: column; min-height: 300px; }
      .ryuten-account-header { display: flex; justify-content: space-between; align-items: center; gap: 14px; padding: 18px 20px 12px; border-bottom: 1px solid #334155; }
      .ryuten-account-header h2 { margin: 0 0 3px; font-size: 20px; }
      .ryuten-account-header span, .ryuten-account-note, .ryuten-account-current, .ryuten-account-card small { color: #a5b4fc; }
      .ryuten-account-tabs { display: flex; gap: 6px; flex-wrap: wrap; padding: 10px 20px; border-bottom: 1px solid #334155; }
      .ryuten-account-body { overflow: auto; padding: 16px 20px 20px; }
      .ryuten-account-actions, .ryuten-account-search { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin: 10px 0; }
      .ryuten-account-button { border: 1px solid #64748b; border-radius: 8px; padding: 7px 11px; background: #1e293b; color: #f8fafc; cursor: pointer; }
      .ryuten-account-button:hover, .ryuten-account-tab.is-active { background: #3730a3; }
      .ryuten-account-button:disabled { opacity: .55; cursor: default; }
      .ryuten-account-button.danger { border-color: #fb7185; }
      .ryuten-account-close { border: 0; border-radius: 6px; padding: 7px 11px; background: transparent; color: #f8fafc; font-size: 14px; cursor: pointer; }
      .ryuten-account-close:hover, .ryuten-account-close:focus-visible { background: #334155; }
      .ryuten-account-tab { border: 0; border-radius: 6px; padding: 6px 9px; background: #1e293b; color: #e2e8f0; cursor: pointer; }
      .ryuten-account-summary { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
      .ryuten-account-avatar, .ryuten-account-image { width: 56px; height: 56px; object-fit: contain; border-radius: 8px; background: #0f172a; }
      .ryuten-account-summary-details { display: grid; gap: 3px; }
      .ryuten-account-section { margin-top: 18px; padding-top: 14px; border-top: 1px solid #334155; }
      .ryuten-account-section h3 { margin: 0 0 8px; }
      .ryuten-account-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
      .ryuten-account-card { display: grid; gap: 7px; align-content: start; padding: 10px; border: 1px solid #334155; border-radius: 9px; background: #0f172a; }
      .ryuten-account-card .ryuten-account-image { width: 84px; height: 84px; justify-self: center; }
      .ryuten-account-card.is-selected { border-color: #818cf8; }
      .ryuten-account-field { display: grid; gap: 5px; margin: 8px 0; max-width: 240px; }
      .ryuten-account-field select, .ryuten-account-search input { min-height: 32px; border-radius: 6px; border: 1px solid #64748b; padding: 5px 8px; background: #0f172a; color: #f8fafc; }
      .ryuten-account-status { min-height: 20px; padding: 0 20px; }
      .ryuten-account-error { color: #fda4af; }
      .ryuten-account-message { color: #86efac; }
      .advanced-support { color: #cbd5e1; }
      #senpa-account .senpa-account-label, #senpa-account #senpa-account-name, #senpa-account #senpa-account-info { display: block; margin: 2px 0; }
      #senpa-account, #senpa-account .senpa-account-copy { display: block !important; }
      #senpa-account .senpa-account-label { color: #a5b4fc; font-size: 11px; letter-spacing: .08em; }
      #senpa-account #senpa-account-info { color: #cbd5e1; font-size: 11px; }
    `;

    if (doc?.createElement) {
      style = makeElement('style', { 'data-ryuten-account-style': 'true' });
      if (style) {
        style.textContent = css;
        (doc.head || doc.documentElement || doc.body)?.append?.(style);
      }
      panel = makeElement('dialog', { id: 'ryuten-account-panel', 'aria-label': 'Ryuten account', 'data-ryuten-account': 'panel' });
      if (panel) {
        panel.hidden = true;
        panel.addEventListener?.('cancel', event => {
          event.preventDefault();
          close();
        });
        panel.addEventListener?.('click', event => {
          if (event.target === panel) close();
        });
        doc.body?.append?.(panel);
      }
      addListener(doc, 'keydown', event => {
        if (state.open && event.key === 'Escape') {
          event.preventDefault();
          event.stopImmediatePropagation?.();
          close();
        }
      }, true);
    }

    const accountCard = doc?.getElementById?.('senpa-account');
    if (accountCard) {
      clear(accountCard);
      const copy = makeElement('div', { className: 'senpa-account-copy' });
      append(copy,
        makeElement('div', { className: 'senpa-account-label' }, 'RYUTEN ACCOUNT'),
        makeElement('strong', { id: 'senpa-account-name' }, 'Sign in to Senpa'),
        makeElement('span', { id: 'senpa-account-info' }, 'Account, skins, hats and emojis')
      );
      append(accountCard, copy, actionButton('Open account', open, { attrs: { 'data-account-action': 'open' } }));
    }

    const loginLink = doc?.getElementById?.('login-button');
    if (loginLink) {
      loginLink.removeAttribute?.('href');
      loginLink.textContent = 'ACCOUNT';
      loginLink.onclick = event => {
        event?.preventDefault?.();
        open();
      };
    }

    function intercept(id, callback) {
      const target = doc?.getElementById?.(id);
      if (!target?.addEventListener) return;
      const listener = event => {
        event.preventDefault();
        event.stopImmediatePropagation?.();
        callback();
      };
      target.addEventListener('click', listener, true);
      listeners.push(() => target.removeEventListener?.('click', listener, true));
    }

    intercept('mame-trb-shop-btn', () => open('shop'));

    if (pp) pp.openSkinPicker = (slot = 0) => open('skins', slot);

    let tokenUnsubscribe = null;
    if (typeof h?.account?.onTokenChange === 'function') {
      try {
        tokenUnsubscribe = h.account.onTokenChange(token => {
          authGeneration += 1;
          awaitingAccountRefresh = Boolean(token);
          state.account = null;
          if (!token) {
            if (typeof h?.auth?.setEmojiSlots === 'function') h.auth.setEmojiSlots(null);
            state.message = 'Sign in to manage your Senpa account.';
            state.error = '';
            scheduleRender();
          } else {
            void refreshAccount().catch(() => {});
          }
        });
      } catch (error) {
        setError(error);
      }
    }

    const adapter = {
      open,
      close,
      refresh: refreshAccount,
      get state() { return publicState(); },
      snapshot: publicState,
      setProfile,
      openAuth,
      logout,
      equipSkin,
      loadSkins,
      equipHat,
      loadHats,
      equipEmoji,
      loadEmojis,
      sendEmoji,
      buyHat,
      buyEmoji,
      openAdvancedNativeSupport,
      panel,
      dispose() {
        for (const remove of listeners.splice(0)) remove();
        if (typeof tokenUnsubscribe === 'function') tokenUnsubscribe();
        if (pp?.openSkinPicker === adapter.openSkinPicker) pp.openSkinPicker = originalSkinPicker;
        panel?.remove?.();
        style?.remove?.();
      }
    };
    adapter.openSkinPicker = pp?.openSkinPicker;
    return adapter;
  }

  port.modules.installAccount = (h, reference) => {
    const adapter = createAdapter(h || {}, reference || {});
    port.account = adapter;
    return adapter;
  };
})();