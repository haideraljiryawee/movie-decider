// /script/api/tmdb-global.js
// Expose the ES-module TMDB service on window for non-module scripts (header, etc.)
import tmdbService from './tmdb.js';

window.tmdbService = tmdbService;
export default tmdbService;
