/**
 * Hospital Finder Agent
 * Helps users find nearby hospitals and healthcare facilities
 */

const geminiClient = require('../tools/geminiClient');
const placesClient = require('../tools/placesClient');
const config = require('../config');

class HospitalAgent {
    constructor() {
        this.agentType = 'hospital';
        this.systemPrompt = config.systemPrompts.hospital;
    }

    /**
     * Process a hospital search request
     * @param {string} message - User's message
     * @param {Array} context - Conversation history
     * @param {Object} session - Session with location data
     * @returns {Object} Response with hospitals list
     */
    async process(message, context = [], session = null) {
        try {
            // Parse location from query
            const locationInfo = placesClient.parseLocationFromQuery(message);
            let hospitals = [];
            let searchLocation = null;

            if (locationInfo.useCurrentLocation) {
                // Try to get location from session
                const sessionLocation = session?.metadata?.location;

                if (sessionLocation?.latitude && sessionLocation?.longitude) {
                    searchLocation = {
                        lat: sessionLocation.latitude,
                        lng: sessionLocation.longitude,
                        source: 'session'
                    };
                    hospitals = await placesClient.searchNearby(
                        sessionLocation.latitude,
                        sessionLocation.longitude
                    );
                } else {
                    // Need to request location from user
                    return this.requestLocationResponse();
                }
            } else if (locationInfo.locationName) {
                // Search by location name
                const searchQuery = `hospitals in ${locationInfo.locationName}`;
                hospitals = await placesClient.textSearch(searchQuery);
                searchLocation = { name: locationInfo.locationName, source: 'query' };
            }

            // Format response
            if (hospitals.length === 0) {
                return this.noResultsResponse(locationInfo);
            }

            const formattedResponse = await this.formatHospitalResponse(
                hospitals,
                message,
                context,
                searchLocation
            );

            return {
                text: formattedResponse,
                agentType: this.agentType,
                metadata: {
                    searchResults: hospitals.slice(0, 5).map(h => ({
                        placeId: h.placeId,
                        name: h.name,
                        address: h.address,
                        distance: h.distanceKm
                    })),
                    searchLocation,
                    resultCount: hospitals.length
                }
            };
        } catch (error) {
            console.error('Hospital agent error:', error);
            return this.errorResponse(error);
        }
    }

    /**
     * Format hospital search results into a readable response
     */
    async formatHospitalResponse(hospitals, originalQuery, context, location) {
        const topHospitals = hospitals.slice(0, 5);

        // Build hospital list
        const hospitalList = topHospitals.map((h, i) => {
            let entry = `**${i + 1}. ${h.name}**`;
            entry += `\n   📍 ${h.address}`;

            if (h.distanceText) {
                entry += `\n   📏 ${h.distanceText} away`;
            }

            if (h.rating) {
                const stars = '⭐'.repeat(Math.round(h.rating));
                entry += `\n   ${stars} ${h.rating}/5 (${h.totalRatings || 0} reviews)`;
            }

            if (h.isOpen !== undefined) {
                entry += h.isOpen ? '\n   🟢 Open now' : '\n   🔴 Closed';
            }

            entry += `\n   🗺️ [View on Maps](${h.mapsUrl})`;

            return entry;
        }).join('\n\n');

        // Generate natural language intro using Gemini
        let intro = '';
        try {
            const introPrompt = `Generate a brief, helpful 1-2 sentence introduction for hospital search results. The user asked: "${originalQuery}". We found ${hospitals.length} hospitals. Keep it warm and helpful.`;

            const response = await geminiClient.generateResponse(
                introPrompt,
                this.systemPrompt,
                []
            );
            intro = response.text;
        } catch (e) {
            // Fallback intro
            const locationText = location?.name || 'your area';
            intro = `I found ${hospitals.length} hospitals near ${locationText}. Here are the closest options:`;
        }

        return `${intro}\n\n${hospitalList}\n\n💡 *Tip: Click "View on Maps" for directions. Need more options or a different area?*`;
    }

    /**
     * Response when location is needed
     */
    requestLocationResponse() {
        return {
            text: `To find hospitals near you, I'll need your location. You can either:\n\n1. **Share your current location** - Click the location button below\n2. **Tell me a location** - For example: "Find hospitals in Mumbai" or "Hospitals near Andheri"\n\nWhich would you prefer?`,
            agentType: this.agentType,
            metadata: {
                requiresLocation: true
            }
        };
    }

    /**
     * Response when no results found
     */
    noResultsResponse(locationInfo) {
        const locationText = locationInfo.locationName || 'that area';
        return {
            text: `I couldn't find any hospitals in ${locationText}. This might be because:\n\n• The location name might be spelled differently\n• It's a very remote area\n\nCould you try:\n• Sharing your current location instead?\n• Providing a nearby city or landmark?`,
            agentType: this.agentType,
            metadata: {
                noResults: true
            }
        };
    }

    /**
     * Error response
     */
    errorResponse(error) {
        let message = 'I\'m having trouble searching for hospitals right now.';

        if (error.message?.includes('API key')) {
            message = 'The hospital search service is temporarily unavailable. Please try again later.';
        }

        return {
            text: `${message}\n\nIn the meantime, you can:\n• Search "hospitals near me" on Google Maps\n• Call emergency services if urgent: 102 or 108`,
            agentType: this.agentType,
            metadata: {
                error: true,
                errorMessage: error.message
            }
        };
    }

    /**
     * Process location update from frontend
     */
    async handleLocationUpdate(latitude, longitude, session) {
        // This will be called when user shares location
        return {
            text: 'Got your location! Let me find hospitals near you...',
            agentType: this.agentType,
            metadata: {
                locationReceived: true
            }
        };
    }
}

module.exports = new HospitalAgent();
