const API_BASE = '';
console.log('API Base set to:', API_BASE);

// ========== ENHANCED CACHE WITH BETTER MEMORY MANAGEMENT ==========
class EnhancedSearchCache {
    constructor(maxSize = 30, ttl = 10 * 60 * 1000) { // 10 minutes TTL
        this.cache = new Map();
        this.maxSize = maxSize;
        this.ttl = ttl;
        this.accessCount = new Map(); // Track access frequency for LRU
    }
    
    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        
        // Check if expired
        if (Date.now() - item.timestamp > this.ttl) {
            this.delete(key);
            return null;
        }
        
        // Update access count (for LRU)
        this.accessCount.set(key, (this.accessCount.get(key) || 0) + 1);
        
        return item.data;
    }
    
    set(key, data) {
        // Clean up if cache is too big (LRU eviction)
        if (this.cache.size >= this.maxSize) {
            this.evictLeastUsed();
        }
        
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
        this.accessCount.set(key, 1);
        
        // Schedule cleanup for this key
        setTimeout(() => {
            if (this.cache.has(key) && Date.now() - this.cache.get(key).timestamp > this.ttl) {
                this.delete(key);
            }
        }, this.ttl);
    }
    
    delete(key) {
        this.cache.delete(key);
        this.accessCount.delete(key);
    }
    
    clear() {
        this.cache.clear();
        this.accessCount.clear();
    }
    
    evictLeastUsed() {
        let leastUsedKey = null;
        let minAccess = Infinity;
        
        for (const [key, access] of this.accessCount.entries()) {
            if (access < minAccess) {
                minAccess = access;
                leastUsedKey = key;
            }
        }
        
        if (leastUsedKey) {
            this.delete(leastUsedKey);
        }
    }
    
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            ttl: this.ttl,
            keys: Array.from(this.cache.keys())
        };
    }
}

// ========== GLOBAL STATE MANAGEMENT ==========
const searchCache = new EnhancedSearchCache();
const ITEMS_PER_PAGE = 10;
const MAX_PAGES_TO_FETCH = 3; // Fetch max 3 pages (30 items) for better UX

let currentController = null;
let allFilteredResults = [];
let currentQuery = '';
let currentFilter = 'all';
let currentPage = 1;

// ========== MAIN ENTRY POINT ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔍 Search page initialized');
    
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');
    
    if (!query || query.trim() === '') {
        showNoSearchQuery();
        return;
    }
    
    currentQuery = query.trim();
    updateUIWithQuery(currentQuery);
    setupSearchPageListeners(currentQuery);
    displayRecentSearches();
    loadSearchResults(currentQuery);
});

// ========== CORE SEARCH LOGIC WITH BATCH FETCHING ==========
async function loadSearchResults(query, page = 1, filter = 'all') {
    console.log(`🔍 Searching: "${query}" (page ${page}, filter: ${filter})`);
    
    if (!query || query.trim() === '') {
        showNoSearchQuery();
        return;
    }
    
    // Update state
    currentQuery = query;
    currentFilter = filter;
    currentPage = page;
    
    showLoadingState();
    
    try {
        // On first page or filter change, fetch fresh data
        if (page === 1 || filter !== currentFilter) {
            const batchResult = await fetchSearchResultsBatch(query, filter);
            allFilteredResults = batchResult.allResults || [];
            console.log(`📊 Total filtered results: ${allFilteredResults.length}`);
        }
        
        // Handle no results
        if (allFilteredResults.length === 0) {
            showNoResultsState();
            return;
        }
        
        // Calculate pagination
        const totalPages = Math.ceil(allFilteredResults.length / ITEMS_PER_PAGE);
        const startIndex = (page - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const pageResults = allFilteredResults.slice(startIndex, endIndex);
        
        // Adjust page if out of bounds
        if (page > totalPages && totalPages > 0) {
            currentPage = totalPages;
            loadSearchResults(query, totalPages, filter);
            return;
        }
        
        const pageData = {
            results: pageResults,
            total_pages: totalPages,
            total_results: allFilteredResults.length,
            page: currentPage
        };
        
        displaySearchResults(pageData, query, currentPage, filter);
        
    } catch (error) {
        console.error('❌ Search error:', error);
        showErrorState(error);
    }
}

// ========== BATCH FETCHING FOR BETTER PAGINATION ==========
async function fetchSearchResultsBatch(query, filter = 'all') {
    const cacheKey = `batch-${query}-${filter}`;
    
    // Check cache first
    const cached = searchCache.get(cacheKey);
    if (cached) {
        console.log('✅ Using cached batch results');
        return cached;
    }
    
    console.log(`📡 Fetching batch for: "${query}" (filter: ${filter})`);
    
    const typeMap = { 'movie': 'movie', 'tv': 'tv', 'all': 'multi' };
    const type = typeMap[filter] || 'multi';
    
    try {
        // Fetch multiple pages in parallel for better performance
        const fetchPromises = [];
        for (let page = 1; page <= MAX_PAGES_TO_FETCH; page++) {
            const url = `${API_BASE}/api/tmdb/search?query=${encodeURIComponent(query)}&type=${type}&page=${page}`;
            fetchPromises.push(
                fetch(url)
                    .then(response => {
                        if (!response.ok) throw new Error(`HTTP ${response.status}`);
                        return response.json();
                    })
                    .catch(error => {
                        console.warn(`⚠️ Page ${page} fetch failed:`, error.message);
                        return { results: [] }; // Return empty on failure
                    })
            );
        }
        
        const pagesData = await Promise.all(fetchPromises);
        
        // Combine and filter results
        let allRawResults = [];
        pagesData.forEach((pageData, index) => {
            if (pageData.results) {
                console.log(`📄 Page ${index + 1}: ${pageData.results.length} raw items`);
                allRawResults = allRawResults.concat(pageData.results);
            }
        });
        
        console.log(`📊 Total raw results: ${allRawResults.length}`);
        
        // Filter invalid items
        const validResults = allRawResults.filter(isValidTMDBItem);
        console.log(`✅ Valid results after filtering: ${validResults.length}`);
        
        // Remove duplicates (by ID)
        const uniqueResults = removeDuplicates(validResults);
        console.log(`🔄 Unique results after deduplication: ${uniqueResults.length}`);
        
        const result = {
            allResults: uniqueResults,
            total_results: uniqueResults.length,
            fetched_pages: MAX_PAGES_TO_FETCH
        };
        
        // Cache the batch result
        searchCache.set(cacheKey, result);
        console.log('💾 Cached batch results');
        
        return result;
        
    } catch (error) {
        console.error('❌ Batch fetch failed:', error);
        throw new Error('Failed to fetch search results. Please try again.');
    }
}

// ========== VALIDATION AND FILTERING ==========
function isValidTMDBItem(item) {
    if (!item) return false;
    
    // Basic validation
    if (!item.id || typeof item.id !== 'number') return false;
    
    const title = item.title || item.name;
    if (!title || typeof title !== 'string' || title.trim() === '') return false;
    
    const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
    if (mediaType !== 'movie' && mediaType !== 'tv') return false;
    
    // Must have at least poster OR backdrop
    const hasPoster = item.poster_path && typeof item.poster_path === 'string';
    const hasBackdrop = item.backdrop_path && typeof item.backdrop_path === 'string';
    if (!hasPoster && !hasBackdrop) return false;
    
    // Must have some meaningful data
    const hasOverview = item.overview && item.overview.trim().length > 20;
    const hasVotes = item.vote_count && item.vote_count > 0;
    const hasRating = item.vote_average && item.vote_average > 0;
    const hasDate = item.release_date || item.first_air_date;
    
    if (!hasOverview && !hasVotes && !hasRating && !hasDate) return false;
    
    return true;
}

function removeDuplicates(results) {
    const seen = new Set();
    return results.filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
    });
}

// ========== UI UPDATES AND DISPLAY ==========
function updateUIWithQuery(query) {
    // Batch DOM updates
    requestAnimationFrame(() => {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = query;
        
        document.title = `"${query}" - Search Results - StreamFinder`;
        
        const searchTitle = document.getElementById('searchQueryTitle');
        if (searchTitle) searchTitle.textContent = `Search Results for "${query}"`;
    });
}

function displaySearchResults(data, query, currentPage, filter) {
    const { results, total_results, total_pages } = data;
    
    // Hide loading
    document.getElementById('loadingSpinner').style.display = 'none';
    
    // Update results info
    updateResultsInfo(total_results, query, filter);
    
    if (!results || results.length === 0) {
        showNoResultsState();
        return;
    }
    
    // Display results with virtualization for large datasets
    displayResultsGrid(results);
    
    // Setup pagination
    setupPagination(total_pages, currentPage);
}

function updateResultsInfo(total_results, query, filter) {
    const resultsInfo = document.getElementById('resultsInfo');
    if (!resultsInfo) return;
    
    const filterText = filter === 'all' ? '' : ` (${filter === 'movie' ? 'Movies' : 'TV Shows'})`;
    const text = `Found ${total_results.toLocaleString()} result${total_results !== 1 ? 's' : ''} for "${query}"${filterText}`;
    
    // Use textContent for better performance than innerHTML
    resultsInfo.textContent = text;
}

// ========== OPTIMIZED RESULTS DISPLAY ==========
function displayResultsGrid(results) {
    const resultsGrid = document.getElementById('searchResults');
    if (!resultsGrid) return;
    
    // Clear with a single operation
    resultsGrid.innerHTML = '';
    
    // Use document fragment for batch DOM insertion
    const fragment = document.createDocumentFragment();
    const cards = [];
    
    results.forEach(item => {
        const card = createSearchResultCard(item);
        if (card) {
            cards.push(card);
            fragment.appendChild(card);
        }
    });
    
    // Single DOM insertion
    resultsGrid.appendChild(fragment);
    
    // Lazy load images after they're in DOM
    setTimeout(() => {
        lazyLoadImages(cards);
    }, 0);
}

function createSearchResultCard(item) {
    if (!item || !item.id) return null;
    
    const itemType = item.media_type || (item.title ? 'movie' : 'tv');
    const title = item.title || item.name || 'Untitled';
    const date = item.release_date || item.first_air_date;
    const year = date ? new Date(date).getFullYear() : 'N/A';
    const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
    const voteCount = item.vote_count || 0;
    const overview = item.overview || 'No description available.';
    const truncatedOverview = overview.length > 150 ? overview.substring(0, 147) + '...' : overview;
    
    // Optimized poster URL with placeholder
    const posterPath = item.poster_path || item.backdrop_path;
    const posterUrl = posterPath 
        ? `https://image.tmdb.org/t/p/w500${posterPath}`
        : 'https://placehold.co/500x750/2f2f2f/ffffff?text=No+Image';
    
    const card = document.createElement('div');
    card.className = 'search-result-card';
    card.dataset.id = item.id;
    card.dataset.type = itemType;
    card.dataset.rating = rating;
    card.dataset.year = year;
    
    card.innerHTML = `
        <div class="result-card-image">
            <img data-src="${posterUrl}" alt="${title}" 
                 loading="lazy"
                 class="lazy-image"
                 onerror="this.onerror=null; this.src='https://placehold.co/500x750/2f2f2f/ffffff?text=Image+Error'">
            <div class="type-badge ${itemType}">
                ${itemType === 'movie' ? 'Movie' : 'TV Show'}
            </div>
        </div>
        <div class="result-card-info">
            <h3 class="result-title" title="${title}">${title}</h3>
            <div class="result-meta">
                <span class="result-year">${year}</span>
                <span class="result-rating" title="${voteCount} votes">
                    <i class="fas fa-star"></i> ${rating}
                </span>
            </div>
            <p class="result-overview" title="${overview}">${truncatedOverview}</p>
            <button class="view-details-btn" data-id="${item.id}" data-type="${itemType}">
                View Details <i class="fas fa-arrow-right"></i>
            </button>
        </div>
    `;
    
    // Use event delegation instead of individual listeners
    card.addEventListener('click', handleCardClick);
    
    return card;
}

// ========== EVENT DELEGATION FOR BETTER PERFORMANCE ==========
function handleCardClick(e) {
    const card = e.target.closest('.search-result-card');
    if (!card) return;
    
    const id = card.dataset.id;
    const type = card.dataset.type;
    
    // If clicking the button or its children
    if (e.target.closest('.view-details-btn')) {
        e.stopPropagation();
    }
    
    if (id && type) {
        navigateToDetails(id, type);
    }
}

function lazyLoadImages(cards) {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target.querySelector('.lazy-image');
                if (img && img.dataset.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    observer.unobserve(entry.target);
                }
            }
        });
    }, { rootMargin: '50px' });
    
    cards.forEach(card => {
        observer.observe(card);
    });
}

// ========== PAGINATION ==========
function setupPagination(totalPages, currentPage) {
    const pagination = document.getElementById('pagination');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const pageInfo = document.getElementById('pageInfo');
    
    if (!pagination || !prevBtn || !nextBtn || !pageInfo) return;
    
    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }
    
    pagination.style.display = 'flex';
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
    
    // Use dataset for event handlers
    prevBtn.dataset.page = currentPage - 1;
    nextBtn.dataset.page = currentPage + 1;
}

// Event delegation for pagination buttons
document.addEventListener('click', function(e) {
    if (e.target.closest('#prevPage') && !e.target.closest('#prevPage').disabled) {
        const page = parseInt(e.target.closest('#prevPage').dataset.page);
        loadSearchResults(currentQuery, page, currentFilter);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    if (e.target.closest('#nextPage') && !e.target.closest('#nextPage').disabled) {
        const page = parseInt(e.target.closest('#nextPage').dataset.page);
        loadSearchResults(currentQuery, page, currentFilter);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
});

// ========== SORTING ==========
function sortCurrentResults(sortBy) {
    if (!allFilteredResults.length) return;
    
    console.log(`🔀 Sorting ${allFilteredResults.length} items by: ${sortBy}`);
    
    const sorted = [...allFilteredResults].sort((a, b) => {
        switch(sortBy) {
            case 'popularity':
                return (b.popularity || 0) - (a.popularity || 0);
            case 'rating':
                const ratingDiff = (b.vote_average || 0) - (a.vote_average || 0);
                return ratingDiff !== 0 ? ratingDiff : (b.vote_count || 0) - (a.vote_count || 0);
            case 'date':
                const dateA = a.release_date || a.first_air_date || '';
                const dateB = b.release_date || b.first_air_date || '';
                return new Date(dateB) - new Date(dateA);
            case 'title':
                return (a.title || a.name || '').localeCompare(b.title || b.name || '');
            default:
                return 0;
        }
    });
    
    allFilteredResults = sorted;
    currentResults = sorted.slice(0, ITEMS_PER_PAGE);
    
    // Re-render current page
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    displayResultsGrid(sorted.slice(startIndex, endIndex));
    
    showSortNotification(`Sorted by ${sortBy}`);
}

// ========== EVENT LISTENERS SETUP ==========
function setupSearchPageListeners(query) {
    // Filter buttons with delegation
    document.addEventListener('click', function(e) {
        const filterBtn = e.target.closest('.filter-btn');
        if (filterBtn) {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            filterBtn.classList.add('active');
            loadSearchResults(query, 1, filterBtn.dataset.filter);
        }
    });
    
    // Sort select
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', function() {
            sortCurrentResults(this.value);
        });
    }
    
    // Retry button
    const retryBtn = document.getElementById('retryButton');
    if (retryBtn) {
        retryBtn.addEventListener('click', () => loadSearchResults(query));
    }
    
    // Search input
    const searchInput = document.getElementById('searchInput');
    const searchIcon = document.getElementById('searchIcon');
    
    if (searchInput && searchIcon) {
        const performSearch = () => {
            const newQuery = searchInput.value.trim();
            if (newQuery) {
                saveToRecentSearches(newQuery);
                window.location.href = `p_search.html?q=${encodeURIComponent(newQuery)}`;
            } else {
                searchInput.focus();
                searchInput.classList.add('error');
                setTimeout(() => searchInput.classList.remove('error'), 2000);
            }
        };
        
        searchIcon.addEventListener('click', performSearch);
        searchInput.addEventListener('keypress', (e) => e.key === 'Enter' && performSearch());
    }
}

// ========== UTILITY FUNCTIONS ==========
function navigateToDetails(id, type) {
    if (!id || !type || (type !== 'movie' && type !== 'tv')) {
        console.error('Invalid navigation parameters:', { id, type });
        return;
    }
    window.location.href = `details.html?id=${id}&type=${type}`;
}

function saveToRecentSearches(query) {
    try {
        const key = 'streamfinder_recent_searches';
        let searches = JSON.parse(localStorage.getItem(key) || '[]');
        searches = searches.filter(item => item !== query);
        searches.unshift(query);
        searches = searches.slice(0, 5);
        localStorage.setItem(key, JSON.stringify(searches));
    } catch (error) {
        console.error('Error saving recent search:', error);
    }
}

function displayRecentSearches() {
    try {
        const searches = JSON.parse(localStorage.getItem('streamfinder_recent_searches') || '[]');
        if (searches.length) {
            const searchInput = document.getElementById('searchInput');
            if (searchInput && !searchInput.getAttribute('list')) {
                const datalist = document.createElement('datalist');
                datalist.id = 'recent-searches';
                searches.forEach(search => {
                    datalist.innerHTML += `<option value="${search}">`;
                });
                document.body.appendChild(datalist);
                searchInput.setAttribute('list', 'recent-searches');
            }
        }
    } catch (error) {
        console.error('Error displaying recent searches:', error);
    }
}

// ========== UI STATE MANAGEMENT ==========
function showLoadingState() {
    const states = {
        loadingSpinner: 'flex',
        errorMessage: 'none',
        noResults: 'none',
        pagination: 'none'
    };
    
    Object.entries(states).forEach(([id, display]) => {
        const el = document.getElementById(id);
        if (el) el.style.display = display;
    });
    
    // Show skeletons
    const resultsGrid = document.getElementById('searchResults');
    if (resultsGrid) {
        resultsGrid.innerHTML = Array(6).fill().map(() => `
            <div class="search-result-card skeleton-loading">
                <div class="result-card-image skeleton-image"></div>
                <div class="result-card-info">
                    <div class="skeleton-text" style="height: 24px; margin-bottom: 10px;"></div>
                    <div class="result-meta">
                        <div class="skeleton-text short" style="width: 60px; height: 20px;"></div>
                        <div class="skeleton-text short" style="width: 60px; height: 20px; margin-left: 10px;"></div>
                    </div>
                    <div class="skeleton-text medium" style="height: 60px; margin-top: 10px;"></div>
                </div>
            </div>
        `).join('');
    }
}

function showErrorState(error) {
    const states = {
        loadingSpinner: 'none',
        errorMessage: 'block',
        noResults: 'none',
        pagination: 'none'
    };
    
    Object.entries(states).forEach(([id, display]) => {
        const el = document.getElementById(id);
        if (el) el.style.display = display;
    });
    
    const errorMsg = document.querySelector('#errorMessage p');
    if (errorMsg) {
        errorMsg.textContent = error.message.includes('Network') 
            ? 'Network error. Please check your connection.'
            : 'Unable to load search results. Please try again.';
    }
}

function showNoResultsState() {
    document.getElementById('loadingSpinner').style.display = 'none';
    document.getElementById('noResults').style.display = 'block';
    document.getElementById('pagination').style.display = 'none';
}

function showNoSearchQuery() {
    document.getElementById('loadingSpinner').style.display = 'none';
    document.getElementById('resultsInfo').textContent = 'Please enter a search query';
    document.getElementById('noResults').style.display = 'block';
}

function showSortNotification(message) {
    const existing = document.querySelector('.sort-notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = 'sort-notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed; top: 100px; right: 20px;
        background: rgba(229, 9, 20, 0.9); color: white;
        padding: 10px 20px; border-radius: 5px; z-index: 1000;
        font-size: 14px; animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// ========== DEBUGGING AND UTILITIES ==========
window.searchModule = {
    loadSearchResults,
    clearCache: () => {
        searchCache.clear();
        console.log('🧹 Cache cleared');
    },
    getStats: () => searchCache.getStats(),
    currentState: () => ({
        query: currentQuery,
        filter: currentFilter,
        page: currentPage,
        totalResults: allFilteredResults.length
    })
};
