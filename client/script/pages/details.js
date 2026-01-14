
// Details Page JavaScript - COMPLETE WORKING VERSION
import { getPlatformUrl } from '../core/platformRouter.js';
import { getTaste, updateTaste, bumpGenre } from '../core/taste.js';

function track(event, meta = {}) {
    fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            event,
            meta,
            ts: Date.now()
        })
    }).catch(() => {});
}

function scrollToTop(behavior = 'auto') {
    try {
        window.scrollTo({ top: 0, behavior });
    } catch (e) {
        window.scrollTo(0, 0);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('dYZ? Details page loaded');

    initDetailsPage();
    setupEventListeners();
    window.addEventListener('popstate', handlePopState);
});

async function initDetailsPage() {
    const route = getRouteFromLocation();
    if (route) {
        const resolved = await resolveSlugToContent(route.slug, route.type);
        if (resolved && resolved.id) {
            console.log('dY"< Loading details for slug:', route.slug);
            scrollToTop('auto');
            await loadContentDetails(resolved.id, resolved.type, { history: 'replace' });
            return;
        }
    }

    const urlParams = new URLSearchParams(window.location.search);
    const contentId = urlParams.get('id');
    const contentType = urlParams.get('type') || 'movie';

    console.log('dY"< Loading details for:', { id: contentId, type: contentType });

    // Validate params (prevents /api/tmdb/undefined/undefined)
    if (!contentId || contentId === 'undefined' || !/^\d+$/.test(contentId)) {
        showError('Invalid content ID in URL. Please open the details page by clicking a movie/series card.');
        return;
    }

    const allowedTypes = new Set(['movie', 'tv']);
    if (!contentType || contentType === 'undefined' || !allowedTypes.has(contentType)) {
        showError('Invalid content type in URL.');
        return;
    }

    scrollToTop('auto');
    await loadContentDetails(contentId, contentType, { history: 'replace' });
}

async function loadContentDetails(id, type, options = {}) {
    try {
        console.log(`🔄 Fetching ${type} details for ID: ${id}`);
        
        // Show loading, hide content and error
        showLoading(true);
        scrollToTop('auto');
        
        // Get ALL data at once
        const content = await fetchContentDetails(id, type);
        
        if (!content || !content.id) {
            throw new Error('No content data received');
        }
        
        console.log('? Content loaded:', content.title);

        const historyMode = options.history || 'replace';
        
        // Update SEO metadata
        updateSeoMetadata(content);
        updateRouteForContent(content, type, historyMode);
        updateStructuredData(content, type);
        track('details_view', { id: content.id, type, title: content.title });
        const taste = getTaste();
        const recent = Array.isArray(taste.recent) ? taste.recent : [];
        const updatedRecent = [content.id, ...recent.filter((item) => item !== content.id)].slice(0, 10);
        updateTaste({ recent: updatedRecent });
        
        // Update all UI elements
        updateHeroBackground(content);
        updateContentDetails(content, type);
        loadCast(content);
        loadSimilarContent(content, type);
        loadStreamingOptions(content, type);
        
        // Show main content
        showLoading(false);
        document.getElementById('mainContent').style.display = 'block';
        
    } catch (error) {
        console.error('❌ Error loading content details:', error);
        showError(error.message || 'Failed to load content details');
    }
}

async function fetchContentDetails(id, type) {
    try {
        console.log(`🌐 Fetching ${type} details from API...`);
        
        // DIRECT API CALL to your server
        const url = `${window.location.origin}/api/tmdb/${type}/${id}`;
        console.log('📡 Calling:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data || !data.id) {
            throw new Error('Invalid data received from API');
        }
        
        console.log('📊 Data received:', data.title || data.name);
        
        // Format the data
        return {
            id: data.id,
            title: data.title || data.name,
            overview: data.overview || 'No description available.',
            tagline: data.tagline || '',
            poster: data.poster_path 
                ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
                : 'https://via.placeholder.com/500x750/2f2f2f/ffffff?text=No+Poster',
            backdrop: data.backdrop_path 
                ? `https://image.tmdb.org/t/p/original${data.backdrop_path}`
                : `https://image.tmdb.org/t/p/original${data.poster_path}` || 
                  'https://via.placeholder.com/1920x1080/2f2f2f/ffffff?text=No+Backdrop',
            rating: data.vote_average ? data.vote_average.toFixed(1) : 'N/A',
            ratingCount: Number.isFinite(Number(data.vote_count)) ? Number(data.vote_count) : null,
            year: type === 'movie' 
                ? (data.release_date ? new Date(data.release_date).getFullYear() : 'N/A')
                : (data.first_air_date ? new Date(data.first_air_date).getFullYear() : 'N/A'),
            release_date: data.release_date || '',
            first_air_date: data.first_air_date || '',
            runtime: type === 'movie' 
                ? formatRuntime(data.runtime)
                : (data.episode_run_time && data.episode_run_time.length > 0 
                    ? formatRuntime(data.episode_run_time[0]) 
                    : 'N/A'),
            genres: data.genres || [],
            status: data.status || 'Unknown',
            original_language: data.original_language || 'en',
            budget: type === 'movie' ? formatBudget(data.budget) : null,
            revenue: type === 'movie' ? formatBudget(data.revenue) : null,
            videos: data.videos?.results || [],
            credits: data.credits || { cast: [], crew: [] },
            similar: data.similar?.results || []
        };
        
    } catch (error) {
        console.error('❌ Error in fetchContentDetails:', error);
        throw error;
    }
}

function updateSeoMetadata(content) {
    const title = content?.title || 'Untitled';
    const year = Number.isFinite(Number(content?.year)) ? content.year : '';
    const yearText = year ? ` (${year})` : '';
    document.title = `Watch ${title}${yearText} – Where to Stream`;

    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'description';
        document.head.appendChild(meta);
    }

    const overview = typeof content?.overview === 'string' ? content.overview : '';
    const shortOverview = shortenOverview(overview, 140);
    let description = `Find where to watch ${title} online.`;
    if (shortOverview) description += ` ${shortOverview}`;
    meta.setAttribute('content', description);
}

function updateStructuredData(content, type) {
    const existing = document.querySelectorAll('head script[type="application/ld+json"]');
    existing.forEach((node) => node.remove());

    const name = content?.title || 'Untitled';
    const image = content?.poster || '';
    const description = shortenOverview(content?.overview || '', 200) || '';
    const datePublished = type === 'movie' ? (content?.release_date || '') : (content?.first_air_date || '');
    const ratingValue = content?.rating && content.rating !== 'N/A' ? String(content.rating) : '';
    const ratingCount = Number.isFinite(Number(content?.ratingCount)) ? Number(content.ratingCount) : null;

    const schema = {
        '@context': 'https://schema.org',
        '@type': type === 'tv' ? 'TVSeries' : 'Movie',
        name
    };

    if (datePublished) schema.datePublished = datePublished;
    if (image) schema.image = image;
    if (description) schema.description = description;
    if (ratingValue) {
        schema.aggregateRating = {
            '@type': 'AggregateRating',
            ratingValue
        };
        if (ratingCount !== null) schema.aggregateRating.ratingCount = String(ratingCount);
    }

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
}

const preloadCache = new Set();

function preloadImage(href) {
    if (!href || preloadCache.has(href)) return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = href;
    document.head.appendChild(link);
    preloadCache.add(href);
}

function shortenOverview(text, maxLength = 140) {
    const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
    if (!cleaned) return '';
    if (cleaned.length <= maxLength) return cleaned;
    const slice = cleaned.slice(0, Math.max(0, maxLength - 3));
    const lastSpace = slice.lastIndexOf(' ');
    const safe = lastSpace > 40 ? slice.slice(0, lastSpace) : slice;
    return `${safe.trim()}...`;
}

function slugify(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function buildContentSlug(title, year) {
    const base = slugify(title);
    if (!base) return '';
    const yearValue = Number.isFinite(Number(year)) ? String(year) : '';
    return yearValue ? `${base}-${yearValue}` : base;
}

function parseSlug(slug) {
    const parts = String(slug || '').split('-').filter(Boolean);
    if (!parts.length) return { title: '', year: '' };
    let year = '';
    if (/^\d{4}$/.test(parts[parts.length - 1])) {
        year = parts.pop();
    }
    return { title: parts.join(' '), year };
}

function getRouteFromLocation() {
    const match = window.location.pathname.match(/^\/(movie|tv)\/([^\/]+)$/);
    if (!match) return null;
    return { type: match[1], slug: match[2] };
}

function loadSlugMap() {
    try {
        const raw = localStorage.getItem('movie_slug_map');
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

function saveSlugMapping(slug, entry) {
    if (!slug || !entry || !entry.id) return;
    const map = loadSlugMap();
    map[slug] = {
        id: entry.id,
        type: entry.type || 'movie',
        title: entry.title || '',
        year: entry.year || '',
        t: Date.now()
    };

    const keys = Object.keys(map);
    if (keys.length > 50) {
        keys.sort((a, b) => (map[a].t || 0) - (map[b].t || 0));
        const excess = keys.length - 50;
        for (let i = 0; i < excess; i++) delete map[keys[i]];
    }

    try {
        localStorage.setItem('movie_slug_map', JSON.stringify(map));
    } catch (e) {
        // Ignore storage failures
    }
}

async function resolveSlugToContent(slug, type) {
    const map = loadSlugMap();
    if (map[slug] && map[slug].id) {
        return { id: map[slug].id, type: map[slug].type || type || 'movie' };
    }

    const parsed = parseSlug(slug);
    if (!parsed.title) return null;

    try {
        const requestType = type || 'movie';
        const url = `${window.location.origin}/api/tmdb/search?query=${encodeURIComponent(parsed.title)}&type=${requestType}`;
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        const results = Array.isArray(data?.results) ? data.results : [];
        if (!results.length) return null;

        let match = results[0];
        if (parsed.year) {
            match = results.find((item) => {
                const date = item.release_date || item.first_air_date || '';
                const itemYear = date ? new Date(date).getFullYear() : null;
                return itemYear && String(itemYear) === String(parsed.year);
            }) || match;
        }

        return { id: match.id, type: requestType };
    } catch (e) {
        return null;
    }
}

function updateRouteForContent(content, type, historyMode) {
    const slug = buildContentSlug(content?.title, content?.year);
    if (!slug) return;

    const routeType = type === 'tv' ? 'tv' : 'movie';
    const path = `/${routeType}/${slug}`;

    saveSlugMapping(slug, {
        id: content.id,
        type: routeType,
        title: content.title,
        year: content.year
    });

    const state = { movieId: content.id, type: routeType };

    if (historyMode === 'push') {
        if (window.location.pathname !== path) {
            history.pushState(state, '', path);
        } else {
            history.replaceState(state, '', path);
        }
    } else if (historyMode === 'replace') {
        history.replaceState(state, '', path);
    }
}

function handlePopState(event) {
    const state = event.state;
    if (state && state.movieId) {
        scrollToTop('auto');
        loadContentDetails(state.movieId, state.type || 'movie', { history: 'none' });
        return;
    }

    const route = getRouteFromLocation();
    if (route) {
        resolveSlugToContent(route.slug, route.type).then((resolved) => {
            if (resolved && resolved.id) {
                scrollToTop('auto');
                loadContentDetails(resolved.id, resolved.type, { history: 'none' });
            } else {
                showError('Unable to resolve movie from URL.');
            }
        });
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const contentId = urlParams.get('id');
    const contentType = urlParams.get('type') || 'movie';
    if (contentId && /^\d+$/.test(contentId)) {
        scrollToTop('auto');
        loadContentDetails(contentId, contentType, { history: 'none' });
    }
}

function navigateToContentDetails(id, type) {
    if (!id) return;
    scrollToTop('smooth');
    loadContentDetails(id, type || 'movie', { history: 'push' });
}



function loadCast(content) {
    try {
        console.log(`🎭 Loading cast...`);
        
        const castGrid = document.getElementById('castGrid');
        if (!castGrid) return;
        
        castGrid.innerHTML = '';
        
        const credits = content.credits || { cast: [] };
        
        if (!credits.cast || credits.cast.length === 0) {
            castGrid.innerHTML = '<p class="no-data">Cast information not available.</p>';
            return;
        }
        
        // Get top 8 cast members
        const topCast = credits.cast.slice(0, 8);
        
        topCast.forEach(person => {
            const castMember = document.createElement('div');
            castMember.className = 'cast-member';
            castMember.innerHTML = `
                <img src="${person.profile_path 
                    ? `https://image.tmdb.org/t/p/w185${person.profile_path}`
                    : 'https://via.placeholder.com/185x278/2f2f2f/ffffff?text=No+Image'}" 
                     alt="${person.name}" 
                     class="cast-image"
                     loading="lazy"
                     onerror="this.onerror=null; this.src='https://via.placeholder.com/185x278/2f2f2f/ffffff?text=No+Image'">
                <div class="cast-name">${person.name}</div>
                <div class="cast-character">${person.character || 'Unknown Role'}</div>
            `;
            castGrid.appendChild(castMember);
        });
        
    } catch (error) {
        console.error('❌ Error loading cast:', error);
        const castGrid = document.getElementById('castGrid');
        if (castGrid) {
            castGrid.innerHTML = '<p class="no-data">Failed to load cast information.</p>';
        }
    }
}

function loadSimilarContent(content, type) {
    try {
        console.log(`🔍 Loading similar content...`);
        
        const similarGrid = document.getElementById('similarGrid');
        if (!similarGrid) return;
        
        similarGrid.innerHTML = '';
        
        const similarItems = content.similar.slice(0, 6);
        
        if (similarItems.length === 0) {
            similarGrid.innerHTML = '<p class="no-data">No similar content found.</p>';
            return;
        }
        
        similarItems.forEach(item => {
            const itemType = item.media_type || (item.title ? 'movie' : 'tv');
            const itemYear = item.release_date
                ? new Date(item.release_date).getFullYear()
                : item.first_air_date
                    ? new Date(item.first_air_date).getFullYear()
                    : '';
            const slug = buildContentSlug(item.title || item.name, itemYear);
            const href = `/${itemType === 'tv' ? 'tv' : 'movie'}/${slug}`;
            const similarItem = document.createElement('a');
            similarItem.className = 'similar-item';
            similarItem.href = href;
            
            const posterUrl = item.poster_path 
                ? `https://image.tmdb.org/t/p/w185${item.poster_path}`
                : 'https://via.placeholder.com/185x278/2f2f2f/ffffff?text=No+Image';
            const preloadUrl = item.poster_path
                ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
                : '';
            
            similarItem.innerHTML = `
                <img src="${posterUrl}" 
                     alt="${item.title || item.name}" 
                     class="similar-poster"
                     loading="lazy"
                     onerror="this.onerror=null; this.src='https://via.placeholder.com/185x278/2f2f2f/ffffff?text=No+Image'">
                <div class="similar-title">${item.title || item.name || 'Untitled'}</div>
                <div class="similar-year">
                    ${itemYear || 'N/A'}
                </div>
            `;
            
            similarItem.addEventListener('click', function(e) {
                e.preventDefault();
                navigateToContentDetails(item.id, itemType);
            });
            similarItem.addEventListener('mouseenter', () => preloadImage(preloadUrl));
            similarItem.addEventListener('focus', () => preloadImage(preloadUrl));
            
            similarGrid.appendChild(similarItem);
        });
        
    } catch (error) {
        console.error('❌ Error loading similar content:', error);
        const similarGrid = document.getElementById('similarGrid');
        if (similarGrid) {
            similarGrid.innerHTML = '<p class="no-data">Failed to load similar content.</p>';
        }
    }
}

function updateHeroBackground(content) {
    const hero = document.getElementById('detailHero');
    if (!hero) return;
    
    if (content.backdrop) {
        hero.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.9)), url('${content.backdrop}')`;
    } else {
        hero.style.background = 'linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%)';
    }
}

function updateContentDetails(content, type) {
    console.log('🎨 Updating UI with content data...');
    
    // Update title and basic info
    setElementText('detailTitle', content.title);
    setElementText('detailYear', content.year);
    
    const ratingElement = document.getElementById('detailRating');
    if (ratingElement) {
        ratingElement.innerHTML = `<i class="fas fa-star"></i> ${content.rating}/10`;
    }
    
    setElementText('detailRuntime', content.runtime);
    
    const typeElement = document.getElementById('detailType');
    if (typeElement) {
        typeElement.textContent = type === 'movie' ? 'Movie' : 'TV Show';
        typeElement.style.background = type === 'movie' ? '#E50914' : '#00A8E1';
    }
    
    // Update poster
    const poster = document.getElementById('detailPoster');
    if (poster) {
        poster.src = content.poster;
        poster.alt = content.title;
        poster.onerror = function() {
            this.src = 'https://via.placeholder.com/500x750/2f2f2f/ffffff?text=No+Poster';
        };
    }
    
    // Update tagline
    const tagline = document.getElementById('detailTagline');
    if (tagline) {
        if (content.tagline) {
            tagline.textContent = `"${content.tagline}"`;
            tagline.style.display = 'block';
        } else {
            tagline.style.display = 'none';
        }
    }
    
    // Update overview
    setElementText('detailOverview', content.overview);
    
    // Update genres
    const genresContainer = document.getElementById('detailGenres');
    if (genresContainer) {
        genresContainer.innerHTML = '';
        const genres = content.genres.slice(0, 5);
        
        if (genres.length === 0) {
            const noGenre = document.createElement('span');
            noGenre.className = 'genre';
            noGenre.textContent = 'No genres listed';
            genresContainer.appendChild(noGenre);
        } else {
            genres.forEach(genre => {
                const span = document.createElement('span');
                span.className = 'genre';
                span.textContent = genre.name;
                genresContainer.appendChild(span);
            });
        }
    }
    
    // Update trailer button
    const trailerBtn = document.getElementById('trailerBtn');
    if (trailerBtn) {
        const trailer = findTrailer(content.videos);
        if (trailer) {
            trailerBtn.dataset.trailerKey = trailer.key;
            trailerBtn.disabled = false;
            trailerBtn.innerHTML = '<i class="fas fa-play"></i> Watch Trailer';
            trailerBtn.style.opacity = '1';
            trailerBtn.style.cursor = 'pointer';
            
            trailerBtn.onclick = function() {
                const key = this.dataset.trailerKey;
                window.open(`https://www.youtube.com/watch?v=${key}`, '_blank');
            };
        } else {
            trailerBtn.disabled = true;
            trailerBtn.innerHTML = '<i class="fas fa-play"></i> No Trailer';
            trailerBtn.style.opacity = '0.6';
            trailerBtn.style.cursor = 'not-allowed';
        }
    }
    
    // Update additional info
    updateAdditionalInfo(content, type);
    
    console.log('✅ UI updated successfully');
}

function setElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
    }
}

function findTrailer(videos) {
    if (!videos || videos.length === 0) return null;
    
    const priorities = ['Trailer', 'Teaser', 'Featurette', 'Clip'];
    
    for (const type of priorities) {
        const video = videos.find(v => 
            v.site === 'YouTube' && 
            v.type === type && 
            v.official === true
        );
        
        if (video) return video;
    }
    
    return videos.find(v => v.site === 'YouTube');
}

function formatRuntime(minutes) {
    if (!minutes || minutes === 0) return 'N/A';
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
}

function formatBudget(amount) {
    if (!amount || amount === 0) return 'N/A';
    
    if (amount >= 1000000000) return `$${(amount / 1000000000).toFixed(1)}B`;
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
    return `$${amount.toLocaleString()}`;
}

function updateAdditionalInfo(content, type) {
    const detailsInfo = document.getElementById('detailsInfo');
    if (!detailsInfo) return;
    
    let infoHTML = '';
    
    if (type === 'movie') {
        infoHTML = `
            <div class="info-item">
                <span class="info-label">Status:</span>
                <span class="info-value">${content.status}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Language:</span>
                <span class="info-value">${content.original_language.toUpperCase()}</span>
            </div>
            ${content.budget ? `
            <div class="info-item">
                <span class="info-label">Budget:</span>
                <span class="info-value">${content.budget}</span>
            </div>` : ''}
            ${content.revenue ? `
            <div class="info-item">
                <span class="info-label">Revenue:</span>
                <span class="info-value">${content.revenue}</span>
            </div>` : ''}
        `;
    } else {
        infoHTML = `
            <div class="info-item">
                <span class="info-label">Status:</span>
                <span class="info-value">${content.status}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Language:</span>
                <span class="info-value">${content.original_language.toUpperCase()}</span>
            </div>
        `;
    }
    
    detailsInfo.innerHTML = infoHTML;
}

function loadStreamingOptions(content, type) {
    const streamingPlatforms = document.getElementById('streamingPlatforms');
    if (!streamingPlatforms) return;
    const watchNowBtn = document.getElementById('watchNowBtn');
    const watchNowNote = document.getElementById('watchNowNote');
    
    streamingPlatforms.innerHTML = '';
    if (watchNowBtn) {
        watchNowBtn.disabled = true;
        watchNowBtn.classList.remove('pulse-once');
    }
    if (watchNowNote) watchNowNote.hidden = true;
    
    const platforms = [
        { key: 'netflix', name: 'Netflix', icon: 'fab fa-netflix', available: Math.random() > 0.5 },
        { key: 'prime', name: 'Prime Video', icon: 'fab fa-amazon', available: Math.random() > 0.7 },
        { key: 'disney', name: 'Disney+', icon: 'fab fa-disney', available: Math.random() > 0.4 },
        { key: 'hulu', name: 'Hulu', icon: 'fab fa-hulu', available: Math.random() > 0.6 },
        { key: 'hbo', name: 'HBO Max', icon: 'fab fa-hbo', available: Math.random() > 0.3 },
        { key: 'apple', name: 'Apple TV+', icon: 'fab fa-apple', available: Math.random() > 0.5 },
        { key: 'oneshows', name: '1Shows', icon: 'fas fa-globe', available: true }
    ];
    
    const availablePlatforms = platforms.filter(p => p.available);
    
    if (availablePlatforms.length === 0) {
        streamingPlatforms.innerHTML = '<div class="platform not-available">Not available for streaming</div>';
        return;
    }
    
    availablePlatforms.forEach((platform, index) => {
        const platformElement = document.createElement('div');
        platformElement.className = 'platform';
        platformElement.innerHTML = `
            <i class="${platform.icon}"></i>
            <span>${platform.name}</span>
        `;
        
        const platformUrl = getPlatformUrl({
            platformKey: platform.key,
            title: content.title,
            type,
            year: content.year,
            region: 'US',
            id: content.id
        });

        platformElement.addEventListener('click', () => {
            const url = platformUrl;
            if (url) {
                window.open(url, '_blank', 'noopener');
            }
        });
        
        streamingPlatforms.appendChild(platformElement);

        if (watchNowBtn && index === 0 && platformUrl) {
            watchNowBtn.disabled = false;
            watchNowBtn.onclick = () => {
                if (platformUrl) {
                    bumpGenre((content.genres || []).map((g) => g.name));
                    track('watch_now_click', {
                        id: content.id,
                        type,
                        title: content.title,
                        platform: platform.key
                    });
                    window.open(platformUrl, '_blank', 'noopener');
                }
            };
            watchNowBtn.classList.add('pulse-once');
            setTimeout(() => {
                watchNowBtn.classList.remove('pulse-once');
            }, 1800);
            if (watchNowNote) watchNowNote.hidden = false;
        }
    });
}

function setupEventListeners() {
    // Add to list button
    const addToListBtn = document.querySelector('.add-to-list-btn');
    if (addToListBtn) {
        addToListBtn.addEventListener('click', function() {
            const title = document.getElementById('detailTitle')?.textContent || 'Content';
            alert(`"${title}" has been added to your watchlist!`);
        });
    }
    
    // Share button
    const shareBtn = document.querySelector('.share-btn');
    if (shareBtn) {
        shareBtn.addEventListener('click', function() {
            const title = document.getElementById('detailTitle')?.textContent || 'Check this out!';
            const url = window.location.href;
            
            if (navigator.share) {
                navigator.share({
                    title: title,
                    text: `Check out "${title}" on StreamFinder!`,
                    url: url
                });
            } else {
                navigator.clipboard.writeText(url).then(() => {
                    alert('Link copied to clipboard!');
                });
            }
        });
    }
    
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    const searchIcon = document.getElementById('searchIcon');
    
    if (searchInput && searchIcon) {
        searchIcon.addEventListener('click', () => {
            const query = searchInput.value.trim();
            if (query) {
                window.location.href = `/search?q=${encodeURIComponent(query)}`;
            }
        });
        
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = searchInput.value.trim();
                if (query) {
                    window.location.href = `/search?q=${encodeURIComponent(query)}`;
                }
            }
        });
    }
}

function showLoading(show) {
    const loadingContainer = document.getElementById('loadingContainer');
    const mainContent = document.getElementById('mainContent');
    const errorContainer = document.getElementById('errorContainer');
    
    if (loadingContainer) loadingContainer.style.display = show ? 'flex' : 'none';
    if (mainContent) mainContent.style.display = show ? 'none' : 'block';
    if (errorContainer) errorContainer.style.display = 'none';
}

function showError(message) {
    console.log('❌ Showing error:', message);
    
    showLoading(false);
    
    const errorContainer = document.getElementById('errorContainer');
    if (errorContainer) {
        errorContainer.style.display = 'flex';
        
        const errorMsg = errorContainer.querySelector('p');
        if (errorMsg) {
            errorMsg.textContent = message;
        }
    }
}

console.log('🎬 Details page script loaded successfully');
