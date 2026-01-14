// /script/main.js - Homepage JavaScript
document.addEventListener('DOMContentLoaded', function() {
    console.log('StreamFinder Homepage Initializing...');
    
    // Set current year in footer
    const yearElement = document.querySelector('.copyright');
    if (yearElement) {
        const currentYear = new Date().getFullYear();
        yearElement.textContent = yearElement.textContent.replace('2023', currentYear);
    }
    
    // Load content from API
    loadHomepageContent();
    
    // Setup interactions
    setupHomepageInteractions();
});

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

function getDetailsUrl({ id, type, title, year }) {
    const safeType = type === 'tv' ? 'tv' : 'movie';
    const slug = buildContentSlug(title, year);
    if (slug) return `/${safeType}/${slug}`;
    return `/details.html?id=${id}&type=${safeType}`;
}

async function loadHomepageContent() {
    console.log('Loading homepage content...');
    
    // Set loading state
    setLoadingState(true);
    
    try {
        // Fetch trending content from TMDB API
        const trending = await fetchTrendingContent();
        displayContent(trending, '#trending .content-row');
        
        // Simulate platform content
        const netflixContent = trending.slice(0, 5);
        const primeContent = trending.slice(5, 10);
        
        displayContent(netflixContent, '#netflixContent');
        displayContent(primeContent, '#primeContent');
        
    } catch (error) {
        console.error('Error loading content:', error);
        showErrorState();
        loadFallbackContent();
    } finally {
        setLoadingState(false);
    }
}

// Instead of direct TMDB API calls:
async function fetchTrendingContent() {
    try {
        
        
        // NEW: Use your Node.js proxy
        const url = `/api/tmdb/trending?media_type=all&time_window=week`;
        
        console.log('Fetching from proxy API...');
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Proxy Data received:', data.results.length, 'items');
        
        // Format the data (same as before)
        return data.results.map(item => ({
            id: item.id,
            title: item.title || item.name,
            type: item.media_type || (item.title ? 'movie' : 'tv'),
            poster: item.poster_path 
                ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
                : 'https://via.placeholder.com/500x750?text=No+Image',
            rating: item.vote_average ? item.vote_average.toFixed(1) : 'N/A',
            year: item.release_date 
                ? new Date(item.release_date).getFullYear()
                : (item.first_air_date 
                    ? new Date(item.first_air_date).getFullYear() 
                    : 'N/A'),
            overview: item.overview || 'No description available.'
        }));
        
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}

function displayContent(items, selector) {
    const container = document.querySelector(selector);
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="error-message">
                <p>No content available</p>
            </div>
        `;
        return;
    }
    
    items.forEach(item => {
        const card = createContentCard(item);
        container.appendChild(card);
    });
}

function createContentCard(item) {
    const card = document.createElement('div');
    card.className = 'content-card';
    card.dataset.id = item.id;
    card.dataset.type = item.type;
    
    const posterUrl = item.poster || 'https://via.placeholder.com/500x750?text=No+Image';
    
    card.innerHTML = `
        <img src="${posterUrl}" alt="${item.title}" 
             onerror="this.onerror=null; this.src='https://via.placeholder.com/500x750?text=Image+Error'">
        <div class="content-info">
            <h3 class="content-title">${item.title || 'Untitled'}</h3>
            <div class="content-meta">
                <span class="content-year">${item.year}</span>
                <span class="content-rating">
                    <i class="fas fa-star"></i> ${item.rating}
                </span>
            </div>
        </div>
    `;
    
    // Add click handler
    card.addEventListener('click', function() {
        const id = this.dataset.id;
        const type = this.dataset.type;
        const url = getDetailsUrl({
            id,
            type,
            title: item.title,
            year: item.year
        });
        window.location.href = url;
    });
    
    return card;
}

function setupHomepageInteractions() {
    // Explore button
    const exploreBtn = document.getElementById('exploreBtn');
    if (exploreBtn) {
        exploreBtn.addEventListener('click', function() {
            document.querySelector('#trending').scrollIntoView({ 
                behavior: 'smooth' 
            });
        });
    }
    
    // How it works button
    const howItWorksBtn = document.getElementById('howItWorksBtn');
    if (howItWorksBtn) {
        howItWorksBtn.addEventListener('click', function() {
            document.querySelector('.how-it-works').scrollIntoView({ 
                behavior: 'smooth' 
            });
        });
    }
}

function setLoadingState(loading) {
    const containers = [
        document.querySelector('#trending .content-row'),
        document.getElementById('netflixContent'),
        document.getElementById('primeContent')
    ];
    
    containers.forEach(container => {
        if (container) {
            if (loading) {
                container.classList.add('loading');
                container.innerHTML = `
                    <div class="loading-spinner">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Loading content...</p>
                    </div>
                `;
            } else {
                container.classList.remove('loading');
            }
        }
    });
}

function showErrorState() {
    const containers = [
        document.querySelector('#trending .content-row'),
        document.getElementById('netflixContent'),
        document.getElementById('primeContent')
    ];
    
    containers.forEach(container => {
        if (container) {
            container.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Unable to load content. Please try again later.</p>
                    <button class="retry-button" onclick="window.location.reload()">
                        Retry
                    </button>
                </div>
            `;
        }
    });
}
