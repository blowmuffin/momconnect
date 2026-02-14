/**
 * Google Places API Client
 * Wrapper for hospital and healthcare facility searches
 */

const config = require('../config');
const CircuitBreaker = require('./circuitBreaker');

class PlacesClient {
    constructor() {
        this.apiKey = process.env.GOOGLE_PLACES_API_KEY;
        this.baseUrl = 'https://maps.googleapis.com/maps/api/place';

        // Circuit breaker for Places API
        this.circuitBreaker = new CircuitBreaker({
            name: 'places',
            failureThreshold: 3,
            resetTimeoutMs: 60000,
            fallback: () => { throw new Error('Places API circuit breaker open — too many recent failures. Try again later.'); }
        });

        if (!this.apiKey) {
            console.warn('⚠️ GOOGLE_PLACES_API_KEY not set. Hospital finder will not function.');
        }
    }

    /**
     * Check if client is properly configured
     */
    isAvailable() {
        return !!this.apiKey;
    }

    /**
     * Search for nearby hospitals and healthcare facilities
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {number} radius - Search radius in meters
     * @param {string} keyword - Additional search keyword (optional)
     * @returns {Array} List of places
     */
    async searchNearby(lat, lng, radius = null, keyword = 'hospital') {
        if (!this.isAvailable()) {
            throw new Error('Google Places API not configured. Check API key.');
        }

        const searchRadius = radius || config.hospitalSearch.defaultRadiusMeters;
        const url = new URL(`${this.baseUrl}/nearbysearch/json`);

        url.searchParams.set('location', `${lat},${lng}`);
        url.searchParams.set('radius', Math.min(searchRadius, config.hospitalSearch.maxRadiusMeters));
        url.searchParams.set('type', 'hospital');
        url.searchParams.set('keyword', keyword);
        url.searchParams.set('key', this.apiKey);

        try {
            const searchFn = async () => {
                const response = await fetch(url.toString());
                const data = await response.json();

                if (data.status === 'ZERO_RESULTS') {
                    return [];
                }

                if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
                    console.error('Places API error:', data.status, data.error_message);
                    throw new Error(`Places API error: ${data.status}`);
                }

                return this.formatResults(data.results, lat, lng);
            };

            return await this.circuitBreaker.exec(searchFn);
        } catch (error) {
            console.error('Places search error:', error);
            throw error;
        }
    }

    /**
     * Text search for hospitals (when user provides location name)
     * @param {string} query - Search query (e.g., "hospitals in Mumbai")
     * @returns {Array} List of places
     */
    async textSearch(query) {
        if (!this.isAvailable()) {
            throw new Error('Google Places API not configured. Check API key.');
        }

        const url = new URL(`${this.baseUrl}/textsearch/json`);

        url.searchParams.set('query', query);
        url.searchParams.set('type', 'hospital');
        url.searchParams.set('key', this.apiKey);

        try {
            const searchFn = async () => {
                const response = await fetch(url.toString());
                const data = await response.json();

                if (data.status === 'ZERO_RESULTS') {
                    return [];
                }

                if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
                    console.error('Places API error:', data.status, data.error_message);
                    throw new Error(`Places API error: ${data.status}`);
                }

                return this.formatResults(data.results);
            };

            return await this.circuitBreaker.exec(searchFn);
        } catch (error) {
            console.error('Places text search error:', error);
            throw error;
        }
    }

    /**
     * Get detailed information about a place
     * @param {string} placeId - Google Place ID
     * @returns {Object} Place details
     */
    async getPlaceDetails(placeId) {
        if (!this.isAvailable()) {
            throw new Error('Google Places API not configured.');
        }

        const url = new URL(`${this.baseUrl}/details/json`);

        url.searchParams.set('place_id', placeId);
        url.searchParams.set('fields', 'name,formatted_address,formatted_phone_number,opening_hours,rating,website,geometry,types');
        url.searchParams.set('key', this.apiKey);

        try {
            const response = await fetch(url.toString());
            const data = await response.json();

            if (data.status !== 'OK') {
                throw new Error(`Places API error: ${data.status}`);
            }

            const place = data.result;
            return {
                placeId: placeId,
                name: place.name,
                address: place.formatted_address,
                phone: place.formatted_phone_number,
                rating: place.rating,
                website: place.website,
                isOpen: place.opening_hours?.open_now,
                openingHours: place.opening_hours?.weekday_text,
                location: {
                    lat: place.geometry?.location?.lat,
                    lng: place.geometry?.location?.lng
                },
                types: place.types,
                mapsUrl: `https://www.google.com/maps/place/?q=place_id:${placeId}`
            };
        } catch (error) {
            console.error('Place details error:', error);
            throw error;
        }
    }

    /**
     * Format search results into a clean structure
     * @param {Array} results - Raw Places API results
     * @param {number} userLat - User's latitude (for distance calculation)
     * @param {number} userLng - User's longitude
     * @returns {Array} Formatted results
     */
    formatResults(results, userLat = null, userLng = null) {
        return results
            .slice(0, config.hospitalSearch.maxResults)
            .map(place => {
                const formatted = {
                    placeId: place.place_id,
                    name: place.name,
                    address: place.vicinity || place.formatted_address,
                    rating: place.rating,
                    totalRatings: place.user_ratings_total,
                    isOpen: place.opening_hours?.open_now,
                    location: {
                        lat: place.geometry?.location?.lat,
                        lng: place.geometry?.location?.lng
                    },
                    mapsUrl: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`
                };

                // Calculate distance if user location provided
                if (userLat && userLng && place.geometry?.location) {
                    formatted.distanceKm = this.calculateDistance(
                        userLat, userLng,
                        place.geometry.location.lat,
                        place.geometry.location.lng
                    );
                    formatted.distanceText = formatted.distanceKm < 1
                        ? `${Math.round(formatted.distanceKm * 1000)}m`
                        : `${formatted.distanceKm.toFixed(1)}km`;
                }

                return formatted;
            })
            .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
    }

    /**
     * Calculate distance between two coordinates using Haversine formula
     * @returns {number} Distance in kilometers
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    toRad(deg) {
        return deg * (Math.PI / 180);
    }

    /**
     * Parse location from natural language query
     * @param {string} query - User's query
     * @returns {Object} Extracted location info
     */
    parseLocationFromQuery(query) {
        const lowerQuery = query.toLowerCase();

        // Check for "near me" or "nearby" - indicates current location
        if (lowerQuery.includes('near me') || lowerQuery.includes('nearby') ||
            lowerQuery.includes('closest') || lowerQuery.includes('nearest')) {
            return { useCurrentLocation: true };
        }

        // Check for "in [location]" pattern
        const inMatch = query.match(/\bin\s+([a-zA-Z\s]+?)(?:\s*$|[,.])/i);
        if (inMatch) {
            return { locationName: inMatch[1].trim(), useCurrentLocation: false };
        }

        // Check for "[location] hospital" pattern
        const beforeMatch = query.match(/([a-zA-Z\s]+?)\s+hospitals?/i);
        if (beforeMatch && !['find', 'search', 'get', 'show', 'the', 'a', 'any', 'some', 'nearby', 'nearest'].includes(beforeMatch[1].trim().toLowerCase())) {
            return { locationName: beforeMatch[1].trim(), useCurrentLocation: false };
        }

        // Default to current location if no specific location mentioned
        return { useCurrentLocation: true };
    }
}

// Export singleton instance
module.exports = new PlacesClient();
