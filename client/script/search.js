// /script/search.js
document.addEventListener('DOMContentLoaded', function() {
    console.log('Search script loaded');
    
    // Get search elements
    const searchInput = document.getElementById('searchInput');
    const searchIcon = document.getElementById('searchIcon');
    
    if (searchInput && searchIcon) {
        // Search when icon is clicked
        searchIcon.addEventListener('click', performSearch);
        
        // Search when Enter key is pressed
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
        
        // Show search history or suggestions
        searchInput.addEventListener('focus', showSearchSuggestions);
    }
    
    // If we're on a search results page
    if (window.location.pathname.includes('p_search.html')) {
        loadSearchResults();
    }
});

function performSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    
    const query = searchInput.value.trim();
    
    if (query) {
        console.log('Searching for:', query);
        
        // Save to recent searches
        saveToRecentSearches(query);
        
        // Redirect to search results page
        window.location.href = `p_search.html?q=${encodeURIComponent(query)}`;
    } else {
        // Show error or focus the input
        searchInput.focus();
        searchInput.placeholder = 'Please enter a search term...';
    }
}

function saveToRecentSearches(query) {
    try {
        let searches = JSON.parse(localStorage.getItem('streamfinder_searches') || '[]');
        
        // Remove if already exists
        searches = searches.filter(item => item !== query);
        
        // Add to beginning
        searches.unshift(query);
        
        // Keep only last 10 searches
        searches = searches.slice(0, 10);
        
        localStorage.setItem('streamfinder_searches', JSON.stringify(searches));
    } catch (error) {
        console.error('Error saving search:', error);
    }
}

function showSearchSuggestions() {
    try {
        const searches = JSON.parse(localStorage.getItem('streamfinder_searches') || '[]');
        
        if (searches.length > 0) {
            // You could create a dropdown with recent searches here
            console.log('Recent searches:', searches);
        }
    } catch (error) {
        console.error('Error loading search history:', error);
    }
}

async function loadSearchResults() {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');
    
    if (!query) {
        document.getElementById('searchResults').innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <h3>No search query provided</h3>
                <p>Please enter a search term in the box above.</p>
            </div>
        `;
        return;
    }
    
    // Update search input with current query
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = query;
    }
    
    // Show loading state
    document.getElementById('searchResults').innerHTML = `
        <div class="loading-spinner">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Searching for "${query}"...</p>
        </div>
    `;
    
    try {
        // Use the updated function that calls your proxy
        const results = await fetchSearchResults(query);
        displaySearchResults(results, query);
    } catch (error) {
        console.error('Search error:', error);
        document.getElementById('searchResults').innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Search Error</h3>
                <p>Unable to search at the moment. Please try again later.</p>
                <p><small>Error: ${error.message}</small></p>
                <button class="retry-button" onclick="loadSearchResults()">
                    Retry Search
                </button>
            </div>
        `;
    }
}

async function fetchSearchResults(query, page = 1, filter = 'all') {
    try {
        // Use your Node.js proxy server
        let url;
        
        if (filter === 'movie') {
            url = `/api/tmdb/search?query=${encodeURIComponent(query)}&type=movie&page=${page}`;
        } else if (filter === 'tv') {
            url = `/api/tmdb/search?query=${encodeURIComponent(query)}&type=tv&page=${page}`;
        } else {
            url = `/api/tmdb/search?query=${encodeURIComponent(query)}&type=multi&page=${page}`;
        }
        
        console.log('🔍 Searching via proxy:', url);
        const response = await fetch(url);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`API Error: ${response.status} - ${errorData.error || response.statusText}`);
        }
        
        const data = await response.json();
        console.log('✅ Search results from proxy:', data.results?.length || 0, 'items');
        
        // Format the data
        const results = data.results || [];
        
        return results.map(item => ({
            id: item.id,
            title: item.title || item.name,
            type: item.media_type || (item.title ? 'movie' : 'tv'),
            poster: item.poster_path 
                ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
                : 'https://placehold.co/500x750/2f2f2f/ffffff?text=No+Image', // Updated
            rating: item.vote_average ? item.vote_average.toFixed(1) : 'N/A',
            year: item.release_date 
                ? new Date(item.release_date).getFullYear()
                : (item.first_air_date 
                    ? new Date(item.first_air_date).getFullYear() 
                    : 'N/A'),
            overview: item.overview || 'No description available.',
            popularity: item.popularity || 0,
            vote_count: item.vote_count || 0,
            media_type: item.media_type || (item.title ? 'movie' : 'tv')
        }));
        
    } catch (error) {
        console.error('❌ Search fetch error:', error);
        throw error;
    }
}

function displaySearchResults(results, query) {
    const container = document.getElementById('searchResults');
    if (!container) return;
    
    if (!results || results.length === 0) {
        container.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <h3>No results found for "${query}"</h3>
                <p>Try searching for something else or check your spelling.</p>
                <button class="primary-button" onclick="window.history.back()">
                    Go Back
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <h2 class="search-results-title">Search Results for "${query}"</h2>
        <p class="results-count">Found ${results.length} result${results.length !== 1 ? 's' : ''}</p>
        <div class="search-results-grid"></div>
    `;
    
    const grid = container.querySelector('.search-results-grid');
    
    results.forEach(item => {
        const card = createSearchResultCard(item);
        grid.appendChild(card);
    });
}

function createSearchResultCard(item) {
    const card = document.createElement('div');
    card.className = 'search-result-card';
    card.dataset.id = item.id;
    card.dataset.type = item.type;
    
    const posterUrl = item.poster || 'https://placehold.co/500x750/2f2f2f/ffffff?text=No+Image';
    const typeBadge = item.type === 'movie' ? 'Movie' : 'TV Show';
    const badgeColor = item.type === 'movie' ? '#E50914' : '#00A8E1';
    
    card.innerHTML = `
        <div class="result-card-image">
            <img src="${posterUrl}" alt="${item.title}" 
                 onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAwIiBoZWlnaHQ9Ijc1MCIgdmlld0JveD0iMCAwIDUwMCA3NTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI1MDAiIGhlaWdodD0iNzUwIiBmaWxsPSIjMmYyZjJmIi8+Cjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+RW1wdHk8L3RleHQ+Cjwvc3ZnPgo='">
            <div class="type-badge" style="background: ${badgeColor}">
                ${typeBadge}
            </div>
        </div>
        <div class="result-card-info">
            <h3 class="result-title">${item.title || 'Untitled'}</h3>
            <div class="result-meta">
                <span class="result-year">${item.year}</span>
                <span class="result-rating">
                    <i class="fas fa-star"></i> ${item.rating}
                </span>
            </div>
            <p class="result-overview">${item.overview || 'No description available.'}</p>
            <button class="view-details-btn" data-id="${item.id}" data-type="${item.type}">
                View Details <i class="fas fa-arrow-right"></i>
            </button>
        </div>
    `;
    
    // Add click handler
    const viewBtn = card.querySelector('.view-details-btn');
    viewBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        const id = this.dataset.id;
        const type = this.dataset.type;
        window.location.href = `details.html?id=${id}&type=${type}`;
    });
    
    card.addEventListener('click', function() {
        const id = this.dataset.id;
        const type = this.dataset.type;
        window.location.href = `details.html?id=${id}&type=${type}`;
    });
    
    return card;
}
// Make functions available globally
window.SearchModule = {
    performSearch,
    loadSearchResults
};