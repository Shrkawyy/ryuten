

/** Cancellation boundary around the captured Ryuten loading screen. */
(() => {
    'use strict';
    const rp = window.RYUTEN_PORT;
    rp.modules.installLoadingLifecycle = loading => {
        let dismissed = false;
        let initialization = null;
        const begin = loading._2794.bind(loading);
        const hide = loading._5075.bind(loading);
        const clearTicker = () => {
            window.clearInterval(loading._1275);
            loading._1275 = 0;
        };
        loading._2794 = () => {
            if (dismissed)
                return Promise.resolve();
            // Native initialization awaits background.decode() + a 500 ms fade BEFORE
            // assigning its interval. A fast local-asset boot can dismiss the screen first.
            // Clear an interval created by a late completion before its first callback runs.
            if (!initialization)
                initialization = Promise.resolve().then(begin).finally(() => {
                    if (dismissed)
                        clearTicker();
                });
            return initialization;
        };
        loading._5075 = () => {
            if (dismissed)
                return;
            dismissed = true;
            clearTicker();
            return hide();
        };
        rp.listeners.push(() => { dismissed = true; clearTicker(); });
    };
})();