// server/server.js - COMPLETE WORKING VERSION
const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();
const authRoutes = require('./auth');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const isProd = process.env.NODE_ENV === 'production';
const SITEMAP_CACHE_TTL_MS = 1000 * 60 * 60 * 4;
let sitemapCache = { xml: '', expiresAt: 0 };


const log = (...args) => {
    if (!isProd) {
        console.log(...args);
    }
};
// Log API key status
log('🔑 TMDB API Key loaded?', !!TMDB_API_KEY);
if (!TMDB_API_KEY) {
    log('⚠️ WARNING: TMDB_API_KEY is missing in .env file!');
    log('⚠️ Add: TMDB_API_KEY=your_key_here to server/.env');
}

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use(express.static(path.join(__dirname, '../client')));

// Log all requests
app.use((req, res, next) => {
    log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
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

// ==================== TMDB API PROXY ROUTES ====================

// Analytics tracking
app.post('/api/track', (req, res) => {
    const { event, meta = {}, ts } = req.body || {};
    if (!event) {
        return res.status(400).json({ error: 'Event required' });
    }

    const iso = new Date(ts || Date.now()).toISOString();
    const safeMeta = (meta && typeof meta === 'object') ? meta : {};
    const line = `${iso} | ${event} | ${JSON.stringify(safeMeta)}\n`;

    fs.appendFile(path.join(__dirname, '../analytics.log'), line, (err) => {
        if (err) {
            console.error('Analytics write failed:', err.message);
        }
    });

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

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Trending content
app.get('/api/tmdb/trending', async (req, res) => {
    try {
        log('📊 TMDB Trending request');
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
        
        log(`✅ Trending: ${response.data.results.length} items`);
        res.json(response.data);
        
    } catch (error) {
        console.error('❌ Trending error:', error.message);
        res.status(500).json({ 
            error: 'Failed to fetch trending',
            message: error.message
        });
    }
});

// Search
app.get('/api/tmdb/search', async (req, res) => {
    try {
        log('🔍 TMDB Search request:', req.query);
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
        
        log(`✅ Search "${query}": ${response.data.results.length} results`);
        res.json(response.data);
        
    } catch (error) {
        console.error('❌ Search error:', error.message);
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

        log(`✅ Movie list ${listType}: ${response.data.results.length} items`);
        res.json(response.data);
    } catch (error) {
        console.error('❌ Movie list error:', error.message);
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

        log(`✅ TV list ${listType}: ${response.data.results.length} items`);
        res.json(response.data);
    } catch (error) {
        console.error('❌ TV list error:', error.message);
        res.status(500).json({ error: 'Failed to fetch tv list', message: error.message });
    }
});


// Movie/TV details
app.get('/api/tmdb/:type/:id', async (req, res) => {
    try {
        log('🎬 Details request:', req.params);
        const { type, id } = req.params;
        
        // Validate
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
        
        const title = response.data.title || response.data.name;
        log(`✅ Details: ${title}`);
        res.json(response.data);
        
    } catch (error) {
        console.error('❌ Details error:', error.message);
        
        if (error.response?.status === 404) {
            return res.status(404).json({ error: 'Content not found' });
        }
        
        res.status(500).json({ 
            error: 'Failed to fetch details',
            message: error.message
        });
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
        
        log(`✅ Discover movies: ${response.data.results.length} results`);
        res.json(response.data);
        
    } catch (error) {
        console.error('❌ Discover movies error:', error.message);
        res.status(500).json({ 
            error: 'Failed to fetch movies',
            message: error.message
        });
    }
});

// Sitemap
app.get('/sitemap.xml', async (req, res) => {
    res.set('Content-Type', 'application/xml');

    if (sitemapCache.expiresAt > Date.now() && sitemapCache.xml) {
        res.send(sitemapCache.xml);
        return;
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
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
            console.error('Sitemap TMDB error:', error.message);
        }
    }

    const xml = buildSitemapXml(urls);
    sitemapCache = { xml, expiresAt: Date.now() + SITEMAP_CACHE_TTL_MS };
    res.send(xml);
});
// Redirect old search.html to p_search.html
app.get('/search.html', (req, res) => {
    const query = req.url.split('?')[1] || '';
    res.redirect(`/p_search.html${query ? '?' + query : ''}`);
});


// ==================== HTML PAGE ROUTES ====================

// Homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/Pages/index.html'));
});

// Search page
app.get('/search', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/Pages/p_search.html'));
});

// Details page
app.get('/details', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/Pages/details.html'));
});

// Clean details routes (/movie/:slug, /tv/:slug)
app.get(['/movie/:slug', '/tv/:slug'], (req, res) => {
    res.sendFile(path.join(__dirname, '../client/Pages/details.html'));
});

// Movies page
app.get('/movies', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/Pages/movies.html'));
});

// Series page
app.get('/series', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/Pages/series.html'));
});

// Contact page
app.get('/contact', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/Pages/contact.html'));
});

// Test page
app.get('/test', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/Pages/test.html'));
});

// ==================== ERROR HANDLING ====================

// 404 handler for API
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});

// 404 handler for pages
app.use('*', (req, res) => {
    res.status(404).sendFile(path.join(__dirname, '../client/Pages/index.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error('💥 Server error:', err.stack);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
    log(`🚀 Server running on http://localhost:${PORT}`);
    log(`📁 Serving files from: ${path.join(__dirname, '../client')}`);
    log(`🔑 TMDB API: ${TMDB_API_KEY ? 'Configured' : 'NOT CONFIGURED!'}`);
    log(`📊 Available endpoints:`);
    log(`   - http://localhost:${PORT}/api/test`);
    log(`   - http://localhost:${PORT}/api/tmdb/trending`);
    log(`   - http://localhost:${PORT}/api/tmdb/search?query=test`);
    log(`   - http://localhost:${PORT}/api/tmdb/movie/299536`);
});
