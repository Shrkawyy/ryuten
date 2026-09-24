

(() => {
    'use strict';
    const rp = window.RYUTEN_PORT;
    // Original vector fallbacks. These are ordinary SVG icons, not redistributed font/glyph files.
    const paths = {
        add: 'M12 4v16M4 12h16', 'arrow-down': 'M12 3v18m-7-7 7 7 7-7', 'arrow-up': 'M12 21V3m-7 7 7-7 7 7', back: 'M20 12H4m7-7-7 7 7 7',
        cash: 'M3 6h18v12H3zM9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
        'chat-bubble': 'M3 4h18v13H9l-6 4z', check: 'm4 12 5 5L20 5', checkbox: 'M3 3h18v18H3zM6 12l4 4 8-9', 'checkbox-outline': 'M3 3h18v18H3z',
        'chevron-left': 'm15 4-8 8 8 8', 'chevron-right': 'm9 4 8 8-8 8', circle: 'M10 12a2 2 0 1 0 4 0 2 2 0 1 0-4 0', close: 'm5 5 14 14M19 5 5 19',
        coin: 'M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0M15 8c-5-3-6 2-2 4s2 6-4 4M12 5v14',
        copy: 'M8 8h13v13H8zM4 16H2V2h14v2', 'copy-all': 'M8 8h13v13H8zM4 16H2V2h14v2', delete: 'M3 6h18M8 6V3h8v3M6 6l1 15h10l1-15M10 10v7m4-7v7',
        discord: 'M6 6c4-3 8-3 12 0l3 12-5 2-2-3h-4l-2 3-5-2zM8 12h1m6 0h1',
        edit: 'm4 16 12-12 4 4L8 20H4zM13 7l4 4', facebook: 'M15 3h-3L9 6v15m-4-11h12',
        'gamepad-btns-plus': 'M7 7h10l4 12-5-2H8l-5 2zM6 11h5M8.5 8.5v5m6-3h1m1 2h1',
        globe: 'M2 12a10 10 0 1 0 20 0 10 10 0 1 0-20 0M2 12h20M12 2c-6 6-6 14 0 20m0-20c6 6 6 14 0 20',
        'import-export': 'M7 2v18m-4-4 4 4 4-4M17 22V4m-4 4 4-4 4 4',
        'info-white': 'M2 12a10 10 0 1 0 20 0 10 10 0 1 0-20 0M12 11v7m0-12v1',
        keyboard: 'M2 5h20v14H2zM5 8h1m3 0h1m3 0h1m3 0h1M5 11h1m3 0h1m3 0h1m3 0h1M6 16h12',
        link: 'm9 15 6-6M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m4 2 1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0',
        list: 'M8 5h13M8 12h13M8 19h13M3 5h1m-1 7h1m-1 7h1', medal: 'M8 2l4 7 4-7M5 16a7 7 0 1 0 14 0 7 7 0 1 0-14 0',
        mouse: 'M5 9a7 7 0 0 1 14 0v6a7 7 0 0 1-14 0zM12 2v7', mute: 'M4 9h4l5-4v14l-5-4H4zM17 9l5 6m0-6-5 6',
        new: 'M3 7h18v10H3zM6 14V10l3 4v-4m3 0v4h2m-2-2h2m3-2v4',
        'north-east': 'M5 19 19 5M8 5h11v11', 'open-in-browser': 'M10 4H3v17h17v-7M13 3h8v8M10 14 21 3',
        pause: 'M8 4v16M16 4v16', person: 'M8 6a4 4 0 1 0 8 0 4 4 0 1 0-8 0M3 21v-3c0-7 18-7 18 0v3',
        play: 'm6 3 15 9-15 9z', 'playback-speed': 'm3 5 10 7-10 7zM13 5l8 7-8 7', record: 'M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0',
        replay: 'M4 8a9 9 0 1 1-1 7M3 3v6h6', save: 'M3 3h15l3 3v15H3zM7 3v6h10V3M7 21v-8h10v8',
        settings: 'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1zM8 12a4 4 0 1 0 8 0 4 4 0 1 0-8 0',
        sort: 'M4 6h16M7 12h10m-7 6h4', 'south-west': 'M19 5 5 19m0-11v11h11', spinner: 'M12 2a10 10 0 1 1-10 10',
        star: 'm12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1z', stop: 'M4 4h16v16H4z', 'triangle-top-rights': 'M5 4h15v15z',
        warning: 'm12 2 10 19H2zM12 8v6m0 3v1',
    };
    paths.reset = paths.replay;
    paths.restart = paths.replay;
    paths['info-fa-white'] = paths['info-white'];
    rp.modules.installFonts = () => {
        document.documentElement.classList.add('rp-icons-fallback');
        const style = document.createElement('style');
        style.id = 'port-vector-icons';
        style.textContent = 'html.rp-icons-fallback .iconfont::before{content:""!important;display:inline-block;width:1em;height:1em;vertical-align:-.12em;background:currentColor;-webkit-mask:var(--rp-icon) center/contain no-repeat;mask:var(--rp-icon) center/contain no-repeat;}' + Object.entries(paths).map(([name, path]) => {
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${path}" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
            return `.iconfont-${name}{--rp-icon:url("data:image/svg+xml,${encodeURIComponent(svg)}")}`;
        }).join('');
        document.head.appendChild(style);
        // System typography and local SVGs: no font binaries or font-provider request.
        rp.status.fonts={interface:'system-local',icons:'svg-local',numerals:'generated-local'};
        rp.fontsReady=Promise.resolve({text:true,icons:false});return rp.fontsReady;
    };
})();