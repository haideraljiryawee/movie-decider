// /script/api/tmdb.js - COMPLETE UPDATED VERSION
const TMDB_BASE_URL = '/api/tmdb';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

class TMDbService {
    constructor() {
        this.baseUrl = TMDB_BASE_URL;
        this.imageBase = TMDB_IMAGE_BASE;
    }

    async fetchData(endpoint, params = {}) {
        try {
            let url;
            
            // Handle different endpoints
            if (endpoint === '/trending') {
                const queryParams = new URLSearchParams(params);
                url = `${this.baseUrl}${endpoint}?${queryParams}`;
            } 
            else if (endpoint === '/search' || endpoint === '/search/multi') {
                const queryParams = new URLSearchParams(params);
                url = `${this.baseUrl}${endpoint}?${queryParams}`;
            }
            else if (endpoint.startsWith('/movie/') || endpoint.startsWith('/tv/')) {
                // Check if it's a details or credits/similar endpoint
                url = `${this.baseUrl}${endpoint}`;
            }
            else if (endpoint === '/discover/movie') {
                const queryParams = new URLSearchParams(params);
                url = `${this.baseUrl}${endpoint}?${queryParams}`;
            }
            else {
                // Default
                const queryParams = new URLSearchParams(params);
                url = `${this.baseUrl}${endpoint}?${queryParams}`;
            }
            
            console.log('📡 Fetching from:', url);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Get trending content
    async getTrending(mediaType = 'all', timeWindow = 'week') {
        return await this.fetchData('/trending', {
            media_type: mediaType,
            time_window: timeWindow
        });
    }

    // Movie list endpoints (popular / top_rated / now_playing / upcoming)
    async getMovieList(listType = 'popular', page = 1) {
        return await this.fetchData(`/movie/list/${listType}`, { page });
    }

    // TV list endpoints (popular / top_rated / on_the_air / airing_today)
    async getTVList(listType = 'popular', page = 1) {
        return await this.fetchData(`/tv/list/${listType}`, { page });
    }

    // Search content
    async searchContent(query, page = 1) {
        return await this.fetchData('/search', { 
            query, 
            page
        });
    }

    // Search multi (movies + TV)
    async searchMulti(query, page = 1) {
        return await this.fetchData('/search/multi', { 
            query, 
            page
        });
    }

    // Get movie details
    async getMovieDetails(movieId) {
        return await this.fetchData(`/movie/${movieId}`);
    }

    // Get TV show details
    async getTVDetails(tvId) {
        return await this.fetchData(`/tv/${tvId}`);
    }

    // Get movie credits
    async getMovieCredits(movieId) {
        return await this.fetchData(`/movie/${movieId}/credits`);
    }

    // Get TV credits
    async getTVCredits(tvId) {
        return await this.fetchData(`/tv/${tvId}/credits`);
    }

    // Get similar movies
    async getSimilarMovies(movieId) {
        return await this.fetchData(`/movie/${movieId}/similar`);
    }

    // Get similar TV shows
    async getSimilarTV(tvId) {
        return await this.fetchData(`/tv/${tvId}/similar`);
    }

    // Get content by genre
    async getContentByGenre(genreId, type = 'movie', page = 1) {
        if (type === 'movie') {
            return await this.fetchData('/discover/movie', {
                with_genres: genreId,
                page
            });
        } else {
            // You'll need to add a similar route in your backend for TV
            console.warn('TV genre discover not implemented yet');
            return await this.getTrending('tv', 'week');
        }
    }

    // Format content for display
    formatContent(item, type = null) {
        const contentType = type || item.media_type || 'movie';
        const title = contentType === 'movie' ? item.title : item.name;
        const year = contentType === 'movie' 
            ? (item.release_date ? new Date(item.release_date).getFullYear() : 'N/A')
            : (item.first_air_date ? new Date(item.first_air_date).getFullYear() : 'N/A');
        
        return {
            id: item.id,
            title: title || 'Untitled',
            overview: item.overview || 'No description available.',
            poster: item.poster_path 
                ? `${this.imageBase}/w500${item.poster_path}`
                : 'https://images.unsplash.com/photo-1542204165-65bf26472b9b?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
            backdrop: item.backdrop_path 
                ? `${this.imageBase}/original${item.backdrop_path}`
                : 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80',
            rating: item.vote_average ? Math.round(item.vote_average * 10) / 10 : 'N/A',
            year: year,
            type: contentType,
            genres: item.genre_ids || [],
            original_language: item.original_language || 'en',
            popularity: item.popularity || 0,
            vote_count: item.vote_count || 0
        };
    }

    // Get image URL
    getImageUrl(path, size = 'original') {
        if (!path) return '';
        return `${this.imageBase}/${size}${path}`;
    }

    // Popular content methods
    async getPopularMovies(page = 1) {
        return await this.getContentByGenre('', 'movie', page);
    }

    async getPopularTVShows(page = 1) {
        return await this.getTrending('tv', 'week');
    }

    // Get streaming providers (simulated)
    async getStreamingProviders(contentId, contentType = 'movie') {
        return {
            netflix: Math.random() > 0.5,
            prime: Math.random() > 0.7,
            hulu: Math.random() > 0.6,
            disney: Math.random() > 0.4,
            hbo: Math.random() > 0.3
        };
    }

    async getContentByPlatform(platform, type = 'movie') {
        const content = await this.getTrending(type, 'week');
        
        return {
            ...content,
            results: content.results.slice(0, 8).map(item => ({
                ...item,
                platform: platform,
                available_on: [platform]
            }))
        };
    }
}

// Create and export singleton instance
const tmdbService = new TMDbService();
export default tmdbService;
