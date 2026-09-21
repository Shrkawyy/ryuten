/* The tracker is the only public server catalogue. A refresh never switches a live connection. */
class SenpaTracker {
    constructor({ fetcher = window.fetch.bind(window), storage = window.localStorage, onChange = () => { } } = {}) { this.fetcher = fetcher; this.storage = storage; this.onChange = onChange; this.servers = []; this.updatedAt = 0; this.stale = true; this.error = ''; this.inFlight = null; this.timer = null; }
    static normalize(data) { if (!Array.isArray(data))
        throw Error('Tracker returned an unknown schema (expected an array)'); const out = [], seen = new Set(); let sawEU = false; for (const raw of data) {
        if (!raw || typeof raw !== 'object' || typeof raw.host !== 'string')
            continue;
        // This port intentionally exposes the EU Senpa catalogue only. Keep the
        // region decision tied to tracker metadata; never infer it from a host
        // prefix, because the service can move endpoints between regions.
        const region = String(raw.region || '').trim().toUpperCase();
        if (region !== 'EU')
            continue;
        sawEU = true;
        let url;
        try {
            url = new URL(raw.host.includes('://') ? raw.host : 'wss://' + raw.host);
        }
        catch {
            continue;
        }
        if (url.protocol !== 'wss:' || url.username || url.password || !(url.hostname === 'senpa.io' || url.hostname.endsWith('.senpa.io')) || url.pathname !== '/' || url.search || url.hash)
            continue;
        const host = url.host;
        if (seen.has(host))
            continue;
        seen.add(host);
        const nonnegative = v => Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0;
        out.push({ id: String(raw.id ?? host), host, name: String(raw.name || host), region: 'EU', mode: String(raw.mode || ''), modeName: String(raw.mode_name || raw.mode || ''), players: nonnegative(raw.num_players), spectators: nonnegative(raw.num_spectators), capacity: nonnegative(raw.max_players), version: String(raw.version || '') });
    } if (data.length && !out.length && sawEU)
        throw Error('Tracker contained no usable secure Senpa endpoints'); return out; }
    restore() { try {
        const v = JSON.parse(this.storage.getItem('ryuten.senpa.v1.tracker') || 'null');
        if (v && Array.isArray(v.raw)) {
            this.servers = SenpaTracker.normalize(v.raw);
            this.updatedAt = Number(v.at) || 0;
            this.stale = true;
            this.onChange(this);
        }
    }
    catch { } }
    async refresh() { if (this.inFlight)
        return this.inFlight; this.inFlight = (async () => { const control = new AbortController(), timeout = setTimeout(() => control.abort(), 12000); try {
        const response = await this.fetcher('https://api.senpa.io/tracker', { credentials: 'omit', cache: 'no-cache', signal: control.signal });
        if (!response.ok)
            throw Error('Tracker HTTP ' + response.status);
        const raw = await response.json();
        this.servers = SenpaTracker.normalize(raw);
        this.updatedAt = Date.now();
        this.stale = false;
        this.error = '';
        try {
            this.storage.setItem('ryuten.senpa.v1.tracker', JSON.stringify({ at: this.updatedAt, raw }));
        }
        catch { }
        this.onChange(this);
        return this.servers;
    }
    catch (e) {
        this.stale = true;
        this.error = e.name === 'AbortError' ? 'Tracker request timed out' : String(e.message);
        this.onChange(this);
        return this.servers;
    }
    finally {
        clearTimeout(timeout);
        this.inFlight = null;
    } })(); return this.inFlight; }
    start() { this.restore(); void this.refresh(); this.timer = setInterval(() => { if (!document.hidden)
        void this.refresh(); }, 30000); }
    stop() { clearInterval(this.timer); this.timer = null; }
}

