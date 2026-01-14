const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const SITEMAP_CACHE_TTL_MS = 1000 * 60 * 60 * 4;
let sitemapCache = { xml: '', expiresAt: 0 };

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

function slugify(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function buildSlug(title, year) {
    const base = slugify(title);
    if (!base) return '';
    const yearValue = Number.isFinite(Number(year)) ? String(year) : '';
    return yearValue ? `${base}-${yearValue}` : base;
}

function getYearFromDate(dateStr) {
    if (!dateStr) return '';
    const year = new Date(dateStr).getFullYear();
    return Number.isFinite(year) ? String(year) : '';
}

function xmlEscape(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function buildSitemapXml(urls) {
    const entries = urls.map((entry) => {
        return [
            '  <url>',
            `    <loc>${xmlEscape(entry.loc)}</loc>`,
            `    <changefreq>${entry.changefreq || 'weekly'}</changefreq>`,
            `    <priority>${entry.priority || '0.5'}</priority>`,
            '  </url>'
        ].join('\n');
    }).join('\n');

    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        entries,
        '</urlset>'
    ].join('\n');
}

async function fetchPopular(type, pages = 2) {
    const items = [];
    for (let page = 1; page <= pages; page++) {
        const response = await axios.get(
            `https://api.themoviedb.org/3/${type}/popular`,
            {
                params: {
                    api_key: TMDB_API_KEY,
                    language: 'en-US',
                    page
                },
                timeout: 10000
            }
        );
        const results = Array.isArray(response.data?.results) ? response.data.results : [];
        items.push(...results);
    }
    return items;
}

// Sitemap
app.get('/sitemap.xml', async (req, res) => {
    res.set('Content-Type', 'application/xml');

    if (sitemapCache.expiresAt > Date.now() && sitemapCache.xml) {
        res.send(sitemapCache.xml);
        return;
    }

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const baseUrl = `${protocol}://${req.get('host')}`;
    const urls = [
        { loc: `${baseUrl}/`, changefreq: 'weekly', priority: '1.0' },
        { loc: `${baseUrl}/movies`, changefreq: 'weekly', priority: '0.8' }
    ];

    if (TMDB_API_KEY) {
        try {
            const [movies, shows] = await Promise.all([
                fetchPopular('movie', 2),
                fetchPopular('tv', 2)
            ]);

            movies.forEach((item) => {
                const slug = buildSlug(item.title || item.name, getYearFromDate(item.release_date));
                if (!slug) return;
                urls.push({
                    loc: `${baseUrl}/movie/${slug}`,
                    changefreq: 'weekly',
                    priority: '0.8'
                });
            });

            shows.forEach((item) => {
                const slug = buildSlug(item.name || item.title, getYearFromDate(item.first_air_date));
                if (!slug) return;
                urls.push({
                    loc: `${baseUrl}/tv/${slug}`,
                    changefreq: 'weekly',
                    priority: '0.8'
                });
            });
        } catch (error) {
            // Fall back to core URLs only
        }
    }

    const xml = buildSitemapXml(urls);
    sitemapCache = { xml, expiresAt: Date.now() + SITEMAP_CACHE_TTL_MS };
    res.send(xml);
});

// Analytics tracking
app.post('/api/track', (req, res) => {
    const { event, meta = {}, ts } = req.body || {};
    if (!event) {
        return res.status(400).json({ error: 'Event required' });
    }

    const iso = new Date(ts || Date.now()).toISOString();
    const safeMeta = (meta && typeof meta === 'object') ? meta : {};
    const line = `${iso} | ${event} | ${JSON.stringify(safeMeta)}\n`;

    fs.appendFile(path.join(process.cwd(), 'analytics.log'), line, () => {});
    res.json({ ok: true });
});

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({
        message: 'API is working!',
        endpoints: [
            '/api/tmdb/trending',
            '/api/tmdb/search?query=avengers',
            '/api/tmdb/movie/299536',
            '/api/tmdb/tv/66732'
        ]
    });
});

// Trending content
app.get('/api/tmdb/trending', async (req, res) => {
    try {
        const { media_type = 'all', time_window = 'week' } = req.query;

        if (!TMDB_API_KEY) {
            return res.status(500).json({ error: 'TMDB API key not configured' });
        }

        const response = await axios.get(
            `https://api.themoviedb.org/3/trending/${media_type}/${time_window}`,
            {
                params: {
                    api_key: TMDB_API_KEY,
                    language: 'en-US'
                },
                timeout: 10000
            }
        );

        res.json(response.data);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to fetch trending',
            message: error.message
        });
    }
});

// Search
app.get('/api/tmdb/search', async (req, res) => {
    try {
        const { query, type = 'multi', page = 1 } = req.query;

        if (!query) {
            return res.status(400).json({ error: 'Query parameter required' });
        }

        if (!TMDB_API_KEY) {
            return res.status(500).json({ error: 'TMDB API key not configured' });
        }

        const response = await axios.get(
            `https://api.themoviedb.org/3/search/${type}`,
            {
                params: {
                    api_key: TMDB_API_KEY,
                    query: query,
                    page: page,
                    language: 'en-US',
                    include_adult: false
                },
                timeout: 10000
            }
        );

        res.json(response.data);
    } catch (error) {
        res.status(500).json({
            error: 'Search failed',
            message: error.message
        });
    }
});

// Movie lists (popular / top_rated / now_playing / upcoming)
app.get('/api/tmdb/movie/list/:listType', async (req, res) => {
    try {
        const { listType } = req.params;
        const { page = 1 } = req.query;

        const allowed = ['popular', 'top_rated', 'now_playing', 'upcoming'];
        if (!allowed.includes(listType)) {
            return res.status(400).json({ error: 'Invalid list type' });
        }

        if (!TMDB_API_KEY) {
            return res.status(500).json({ error: 'TMDB API key not configured' });
        }

        const response = await axios.get(
            `https://api.themoviedb.org/3/movie/${listType}`,
            {
                params: {
                    api_key: TMDB_API_KEY,
                    language: 'en-US',
                    page
                },
                timeout: 10000
            }
        );

        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch movie list', message: error.message });
    }
});

// TV lists (popular / top_rated / on_the_air / airing_today)
app.get('/api/tmdb/tv/list/:listType', async (req, res) => {
    try {
        const { listType } = req.params;
        const { page = 1 } = req.query;

        const allowed = ['popular', 'top_rated', 'on_the_air', 'airing_today'];
        if (!allowed.includes(listType)) {
            return res.status(400).json({ error: 'Invalid list type' });
        }

        if (!TMDB_API_KEY) {
            return res.status(500).json({ error: 'TMDB API key not configured' });
        }

        const response = await axios.get(
            `https://api.themoviedb.org/3/tv/${listType}`,
            {
                params: {
                    api_key: TMDB_API_KEY,
                    language: 'en-US',
                    page
                },
                timeout: 10000
            }
        );

        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch tv list', message: error.message });
    }
});

// Discover movies (for filtering)
app.get('/api/tmdb/discover/movie', async (req, res) => {
    try {
        const {
            page = 1,
            with_genres = '',
            primary_release_year = '',
            sort_by = 'popularity.desc'
        } = req.query;

        if (!TMDB_API_KEY) {
            return res.status(500).json({ error: 'TMDB API key not configured' });
        }

        const params = {
            api_key: TMDB_API_KEY,
            page,
            language: 'en-US',
            sort_by
        };

        if (with_genres) params.with_genres = with_genres;
        if (primary_release_year) params.primary_release_year = primary_release_year;

        const response = await axios.get(
            'https://api.themoviedb.org/3/discover/movie',
            {
                params,
                timeout: 10000
            }
        );

        res.json(response.data);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to fetch movies',
            message: error.message
        });
    }
});

// Movie/TV details
app.get('/api/tmdb/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;

        if (!['movie', 'tv'].includes(type)) {
            return res.status(400).json({ error: 'Type must be "movie" or "tv"' });
        }

        if (!id || isNaN(id)) {
            return res.status(400).json({ error: 'Valid ID required' });
        }

        if (!TMDB_API_KEY) {
            return res.status(500).json({ error: 'TMDB API key not configured' });
        }

        const response = await axios.get(
            `https://api.themoviedb.org/3/${type}/${id}`,
            {
                params: {
                    api_key: TMDB_API_KEY,
                    append_to_response: 'videos,credits,similar',
                    language: 'en-US'
                },
                timeout: 10000
            }
        );

        res.json(response.data);
    } catch (error) {
        res.status(500).json({
            error: 'Failed to fetch details',
            message: error.message
        });
    }
});

module.exports = app;
