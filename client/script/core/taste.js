const DEFAULT_TASTE = {
    genres: {},
    media: {},
    moods: {},
    recent: []
};

function readTaste() {
    try {
        const raw = localStorage.getItem('user_taste');
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function writeTaste(value) {
    try {
        localStorage.setItem('user_taste', JSON.stringify(value));
    } catch (e) {
        // Ignore storage failures
    }
}

export function getTaste() {
    const stored = readTaste();
    const taste = stored && typeof stored === 'object' ? stored : {};
    return {
        genres: { ...(taste.genres || {}) },
        media: { ...(taste.media || {}) },
        moods: { ...(taste.moods || {}) },
        recent: Array.isArray(taste.recent) ? [...taste.recent] : []
    };
}

export function updateTaste(partial = {}) {
    const current = getTaste();
    const next = { ...current };

    Object.entries(partial || {}).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            next[key] = value;
            return;
        }

        if (value && typeof value === 'object') {
            const base = { ...(next[key] || {}) };
            Object.entries(value).forEach(([k, v]) => {
                const inc = Number(v) || 0;
                base[k] = (Number(base[k]) || 0) + inc;
            });
            next[key] = base;
            return;
        }

        next[key] = value;
    });

    writeTaste(next);
    return next;
}

export function bumpGenre(list) {
    const items = Array.isArray(list) ? list : [list];
    const updates = {};
    items.forEach((entry) => {
        const key = String(entry || '').trim().toLowerCase();
        if (!key) return;
        updates[key] = (updates[key] || 0) + 1;
    });
    if (Object.keys(updates).length) {
        updateTaste({ genres: updates });
    }
}

export function bumpMedia(type) {
    const key = String(type || '').trim().toLowerCase();
    if (!key) return;
    updateTaste({ media: { [key]: 1 } });
}
