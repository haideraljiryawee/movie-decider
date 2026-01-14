function slugify(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export function getPlatformUrl({
    platformKey,
    title,
    type,
    year,
    region = 'US',
    id
}) {
    const normalizedKey = String(platformKey || '').toLowerCase();
    const normalizedType = type === 'tv' ? 'tv' : 'movie';
    const encodedQuery = encodeURIComponent(title || '');
    const slug = slugify(title);

    const platforms = {
        netflix: (q) => `https://www.netflix.com/search?q=${q}`,
        amazon: (q) => `https://www.amazon.com/s?k=${q}&i=instant-video`,
        prime: (q) => `https://www.amazon.com/s?k=${q}&i=instant-video`,
        apple: (q) => `https://tv.apple.com/search?term=${q}`,
        google: (q) => `https://play.google.com/store/search?q=${q}&c=movies`,
        disney: (q) => `https://www.disneyplus.com/search?q=${q}`,
        hulu: (q) => `https://www.hulu.com/search?q=${q}`,
        hbo: (q) => `https://play.hbomax.com/search?q=${q}`,
        oneshows: (q, r, ctx) => {
            if (ctx.id && ctx.slug) {
                const path = ctx.type === 'tv' ? 'tv' : 'movies';
                return `https://www.1shows.nl/${path}/${ctx.id}-${ctx.slug}?streaming=true`;
            }
            return `https://www.1shows.nl/?s=${q}`;
        }
    };

    const handler = platforms[normalizedKey];
    if (!handler) return null;

    return handler(encodedQuery, region, {
        id,
        type: normalizedType,
        year: Number.isFinite(Number(year)) ? String(year) : '',
        slug
    }) || null;
}
