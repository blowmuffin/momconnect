/**
 * App Tools — Dynamic Chatbot Integration
 * Provides user search, post discovery, group search, profile lookup, and navigation
 * Returns structured action cards for the frontend to render
 */

const User = require('../../models/User');
const Post = require('../../models/Post');
const Group = require('../../models/Group');

class AppTools {

    /**
     * Search users by name or location (smart fuzzy word-level matching)
     */
    async searchUsers(query, currentUserId) {
        try {
            if (!query || query.trim().length < 2) {
                return { text: 'Please provide at least 2 characters to search.', actions: [] };
            }

            // Strip common filler words for smarter matching
            const fillerWords = ['find', 'me', 'show', 'search', 'for', 'moms', 'mom', 'mothers', 'mother',
                'people', 'users', 'person', 'of', 'in', 'from', 'at', 'the', 'a', 'an', 'who',
                'are', 'is', 'near', 'around', 'living', 'based', 'located', 'connect', 'with'];
            const words = query.trim().toLowerCase()
                .split(/\s+/)
                .filter(w => !fillerWords.includes(w) && w.length >= 2)
                .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

            // If all words were filler, use original query
            if (words.length === 0) {
                const fallback = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                words.push(fallback);
            }

            // Build word-level OR conditions across name, location, bio
            const orConditions = [];
            for (const word of words) {
                const regex = new RegExp(word, 'i');
                orConditions.push({ name: regex });
                orConditions.push({ location: regex });
                orConditions.push({ bio: regex });
            }

            const users = await User.find({
                _id: { $ne: currentUserId },
                $or: orConditions
            })
                .select('name avatar bio location followers following')
                .limit(8)
                .sort({ createdAt: -1 });

            if (users.length === 0) {
                return {
                    text: `I couldn't find anyone matching "${query}". Try a different name or location, or explore the community! 🔍`,
                    actions: [{
                        type: 'nav_link',
                        icon: '🔍',
                        label: 'Explore People',
                        url: '/explore'
                    }]
                };
            }

            // Score results by relevance — prioritize name matches
            const scored = users.map(u => {
                let score = 0;
                for (const word of words) {
                    const regex = new RegExp(word, 'i');
                    if (regex.test(u.name)) score += 10;
                    if (regex.test(u.location || '')) score += 5;
                    if (regex.test(u.bio || '')) score += 2;
                }
                return { user: u, score };
            });
            scored.sort((a, b) => b.score - a.score);
            const topUsers = scored.slice(0, 5).map(s => s.user);

            const actions = topUsers.map(u => ({
                type: 'user_card',
                user: {
                    _id: u._id,
                    name: u.name,
                    avatar: u.avatar,
                    bio: u.bio || '',
                    location: u.location || '',
                    followerCount: u.followers?.length || 0
                },
                buttons: [
                    { label: '💬 Message', action: 'navigate', url: `/messages/${u._id}` },
                    { label: '👤 Profile', action: 'navigate', url: `/profile/${u._id}` }
                ]
            }));

            return {
                text: `I found ${topUsers.length} ${topUsers.length === 1 ? 'person' : 'people'} matching "${query}". Here they are! 👇`,
                actions
            };
        } catch (error) {
            console.error('[AppTools] searchUsers error:', error.message);
            return { text: 'Sorry, I had trouble searching. Please try again.', actions: [] };
        }
    }

    /**
     * Get suggested users to follow
     */
    async getSuggestedUsers(currentUserId) {
        try {
            const currentUser = await User.findById(currentUserId);
            if (!currentUser) return { text: 'Could not load your profile.', actions: [] };

            const users = await User.find({
                _id: { $ne: currentUserId, $nin: currentUser.following || [] }
            })
                .select('name avatar bio location followers')
                .limit(5)
                .sort({ createdAt: -1 });

            if (users.length === 0) {
                return { text: 'You\'re already following everyone! 🎉', actions: [] };
            }

            const actions = users.map(u => ({
                type: 'user_card',
                user: {
                    _id: u._id,
                    name: u.name,
                    avatar: u.avatar,
                    bio: u.bio || '',
                    location: u.location || '',
                    followerCount: u.followers?.length || 0
                },
                buttons: [
                    { label: '💬 Message', action: 'navigate', url: `/messages/${u._id}` },
                    { label: '👤 Profile', action: 'navigate', url: `/profile/${u._id}` }
                ]
            }));

            return {
                text: `Here are some people you might want to connect with! 🤝`,
                actions
            };
        } catch (error) {
            console.error('[AppTools] getSuggestedUsers error:', error.message);
            return { text: 'Sorry, I had trouble loading suggestions.', actions: [] };
        }
    }

    /**
     * Get current user's full profile info
     */
    async getCurrentUserInfo(userId) {
        try {
            const user = await User.findById(userId)
                .select('name avatar bio location children interests followers following')
                .populate('followers', 'name')
                .populate('following', 'name');

            if (!user) return { text: 'Could not load your profile.', actions: [] };

            const postCount = await Post.countDocuments({ user: userId });
            const groupCount = await Group.countDocuments({ 'members.user': userId });

            return {
                text: `Here's your profile info, ${user.name}! 😊`,
                actions: [{
                    type: 'info_card',
                    title: user.name,
                    avatar: user.avatar,
                    fields: [
                        { label: '👥 Followers', value: String(user.followers?.length || 0) },
                        { label: '👤 Following', value: String(user.following?.length || 0) },
                        { label: '📝 Posts', value: String(postCount) },
                        { label: '👥 Groups', value: String(groupCount) },
                        { label: '📍 Location', value: user.location || 'Not set' },
                        { label: '📝 Bio', value: user.bio || 'Not set' }
                    ],
                    buttons: [
                        { label: '👤 View Profile', action: 'navigate', url: `/profile/${userId}` },
                        { label: '✏️ Edit Profile', action: 'navigate', url: '/edit-profile' }
                    ]
                }]
            };
        } catch (error) {
            console.error('[AppTools] getCurrentUserInfo error:', error.message);
            return { text: 'Sorry, I couldn\'t load your profile info.', actions: [] };
        }
    }

    /**
     * Get user's followers or following as cards
     */
    async getUserConnections(userId, type = 'following') {
        try {
            const user = await User.findById(userId)
                .populate(type, 'name avatar bio location followers');

            if (!user) return { text: 'Could not load your profile.', actions: [] };

            const connections = user[type] || [];
            if (connections.length === 0) {
                return {
                    text: type === 'following'
                        ? 'You\'re not following anyone yet. Let me help you find people! 🔍'
                        : 'You don\'t have any followers yet. Share posts to get noticed! ✨',
                    actions: [{ type: 'nav_link', icon: '🔍', label: 'Explore People', url: '/explore' }]
                };
            }

            const actions = connections.slice(0, 6).map(u => ({
                type: 'user_card',
                user: {
                    _id: u._id,
                    name: u.name,
                    avatar: u.avatar,
                    bio: u.bio || '',
                    location: u.location || '',
                    followerCount: u.followers?.length || 0
                },
                buttons: [
                    { label: '💬 Message', action: 'navigate', url: `/messages/${u._id}` },
                    { label: '👤 Profile', action: 'navigate', url: `/profile/${u._id}` }
                ]
            }));

            return {
                text: `Here are the people you ${type === 'following' ? 'follow' : 'are followed by'} (${connections.length} total). Tap to message or view profile! 👇`,
                actions
            };
        } catch (error) {
            console.error('[AppTools] getUserConnections error:', error.message);
            return { text: 'Sorry, I had trouble loading your connections.', actions: [] };
        }
    }

    /**
     * Search posts by keyword, tag, or category
     */
    async searchPosts(query, category = null) {
        try {
            let matchQuery = { isPrivate: false, group: null };

            if (category && category !== 'all') {
                matchQuery.category = category;
            }

            if (query && query.trim()) {
                const searchTerm = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(searchTerm, 'i');
                matchQuery.$or = [
                    { content: regex },
                    { tags: regex }
                ];
            }

            const posts = await Post.find(matchQuery)
                .populate('user', 'name avatar')
                .sort({ createdAt: -1 })
                .limit(5);

            if (posts.length === 0) {
                const msg = query
                    ? `No posts found about "${query}". Try a different keyword or browse the Explore page! 🔍`
                    : `No posts found in this category. Check out the Explore page! 🔍`;
                return {
                    text: msg,
                    actions: [{ type: 'nav_link', icon: '🔍', label: 'Explore Posts', url: '/explore' }]
                };
            }

            const actions = posts.map(p => ({
                type: 'post_card',
                post: {
                    _id: p._id,
                    content: p.content?.substring(0, 120) + (p.content?.length > 120 ? '...' : ''),
                    category: p.category,
                    likeCount: p.likes?.length || 0,
                    commentCount: p.comments?.length || 0,
                    hasImage: p.images?.length > 0,
                    createdAt: p.createdAt
                },
                author: {
                    _id: p.user?._id,
                    name: p.user?.name || 'Unknown',
                    avatar: p.user?.avatar || ''
                },
                buttons: [
                    { label: '👤 Author', action: 'navigate', url: `/profile/${p.user?._id}` }
                ]
            }));

            const label = query ? `about "${query}"` : `in ${category || 'all categories'}`;
            return {
                text: `Found ${posts.length} recent posts ${label}! 📝`,
                actions
            };
        } catch (error) {
            console.error('[AppTools] searchPosts error:', error.message);
            return { text: 'Sorry, I had trouble searching posts.', actions: [] };
        }
    }

    /**
     * Get trending posts (most liked in the last 7 days)
     */
    async getTrendingPosts() {
        try {
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            const posts = await Post.find({
                isPrivate: false,
                group: null,
                createdAt: { $gte: weekAgo }
            })
                .populate('user', 'name avatar')
                .limit(10);

            if (posts.length === 0) {
                return {
                    text: 'No trending posts this week yet. Be the first to create one! ✨',
                    actions: [{ type: 'nav_link', icon: '✍️', label: 'Create a Post', url: '/' }]
                };
            }

            // Sort by like count descending and take top 5
            posts.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
            const topPosts = posts.slice(0, 5);

            const actions = topPosts.map(p => ({
                type: 'post_card',
                post: {
                    _id: p._id,
                    content: p.content?.substring(0, 120) + (p.content?.length > 120 ? '...' : ''),
                    category: p.category,
                    likeCount: p.likes?.length || 0,
                    commentCount: p.comments?.length || 0,
                    hasImage: p.images?.length > 0,
                    createdAt: p.createdAt
                },
                author: {
                    _id: p.user?._id,
                    name: p.user?.name || 'Unknown',
                    avatar: p.user?.avatar || ''
                },
                buttons: [
                    { label: '👤 Author', action: 'navigate', url: `/profile/${p.user?._id}` }
                ]
            }));

            return {
                text: `🔥 Here's what's trending this week!`,
                actions
            };
        } catch (error) {
            console.error('[AppTools] getTrendingPosts error:', error.message);
            return { text: 'Sorry, I had trouble loading trending posts.', actions: [] };
        }
    }

    /**
     * Search groups by name or category
     */
    async searchGroups(query, category = null) {
        try {
            let matchQuery = {};

            if (category && category !== 'all') {
                matchQuery.category = category;
            }

            if (query && query.trim()) {
                const searchTerm = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(searchTerm, 'i');
                matchQuery.$or = [
                    { name: regex },
                    { description: regex }
                ];
            }

            const groups = await Group.find(matchQuery)
                .select('name description category image members isPrivate')
                .limit(5)
                .sort({ createdAt: -1 });

            if (groups.length === 0) {
                return {
                    text: query
                        ? `No groups found for "${query}". You can create your own! 🎉`
                        : 'No groups found in this category.',
                    actions: [
                        { type: 'nav_link', icon: '➕', label: 'Create a Group', url: '/groups/create' },
                        { type: 'nav_link', icon: '👥', label: 'Browse Groups', url: '/groups' }
                    ]
                };
            }

            const actions = groups.map(g => ({
                type: 'group_card',
                group: {
                    _id: g._id,
                    name: g.name,
                    description: g.description?.substring(0, 100) || '',
                    category: g.category,
                    memberCount: g.members?.length || 0,
                    isPrivate: g.isPrivate,
                    image: g.image
                },
                buttons: [
                    { label: '👁️ View', action: 'navigate', url: `/groups/${g._id}` }
                ]
            }));

            return {
                text: `Found ${groups.length} groups! Tap to view and join 👇`,
                actions
            };
        } catch (error) {
            console.error('[AppTools] searchGroups error:', error.message);
            return { text: 'Sorry, I had trouble searching groups.', actions: [] };
        }
    }

    /**
     * Get groups the user belongs to
     */
    async getUserGroups(userId) {
        try {
            const groups = await Group.find({ 'members.user': userId })
                .select('name description category image members')
                .limit(6);

            if (groups.length === 0) {
                return {
                    text: 'You haven\'t joined any groups yet. Let me help you find some! 🤝',
                    actions: [
                        { type: 'nav_link', icon: '👥', label: 'Browse Groups', url: '/groups' },
                        { type: 'nav_link', icon: '➕', label: 'Create a Group', url: '/groups/create' }
                    ]
                };
            }

            const actions = groups.map(g => ({
                type: 'group_card',
                group: {
                    _id: g._id,
                    name: g.name,
                    description: g.description?.substring(0, 100) || '',
                    category: g.category,
                    memberCount: g.members?.length || 0,
                    image: g.image
                },
                buttons: [
                    { label: '👁️ Open', action: 'navigate', url: `/groups/${g._id}` }
                ]
            }));

            return {
                text: `You're in ${groups.length} groups! 👇`,
                actions
            };
        } catch (error) {
            console.error('[AppTools] getUserGroups error:', error.message);
            return { text: 'Sorry, I had trouble loading your groups.', actions: [] };
        }
    }

    /**
     * Get user's saved posts
     */
    async getSavedPosts(userId) {
        try {
            const user = await User.findById(userId).select('savedPosts');
            if (!user || !user.savedPosts?.length) {
                return {
                    text: 'You haven\'t saved any posts yet. Browse the feed and tap the save button on posts you like! 📌',
                    actions: [{ type: 'nav_link', icon: '🏠', label: 'Go to Feed', url: '/' }]
                };
            }

            const posts = await Post.find({ _id: { $in: user.savedPosts.slice(0, 5) } })
                .populate('user', 'name avatar')
                .sort({ createdAt: -1 });

            const actions = posts.map(p => ({
                type: 'post_card',
                post: {
                    _id: p._id,
                    content: p.content?.substring(0, 120) + (p.content?.length > 120 ? '...' : ''),
                    category: p.category,
                    likeCount: p.likes?.length || 0,
                    commentCount: p.comments?.length || 0,
                    hasImage: p.images?.length > 0,
                    createdAt: p.createdAt
                },
                author: {
                    _id: p.user?._id,
                    name: p.user?.name || 'Unknown',
                    avatar: p.user?.avatar || ''
                },
                buttons: [
                    { label: '👤 Author', action: 'navigate', url: `/profile/${p.user?._id}` }
                ]
            }));

            return {
                text: `Here are your saved posts (${user.savedPosts.length} total) 📌`,
                actions
            };
        } catch (error) {
            console.error('[AppTools] getSavedPosts error:', error.message);
            return { text: 'Sorry, I had trouble loading your saved posts.', actions: [] };
        }
    }

    /**
     * Get navigation links
     */
    getNavLinks(destination = null) {
        const allLinks = {
            home: { type: 'nav_link', icon: '🏠', label: 'Home Feed', url: '/' },
            explore: { type: 'nav_link', icon: '🔍', label: 'Explore', url: '/explore' },
            messages: { type: 'nav_link', icon: '💬', label: 'Messages', url: '/messages' },
            groups: { type: 'nav_link', icon: '👥', label: 'Groups', url: '/groups' },
            create_group: { type: 'nav_link', icon: '➕', label: 'Create Group', url: '/groups/create' },
            edit_profile: { type: 'nav_link', icon: '✏️', label: 'Edit Profile', url: '/edit-profile' },
            chatbot: { type: 'nav_link', icon: '🤖', label: 'AI Assistant', url: '/chatbot' }
        };

        if (destination) {
            const key = destination.toLowerCase().replace(/\s+/g, '_');
            const match = allLinks[key];
            if (match) {
                return {
                    text: `Here you go! Tap below to navigate 👇`,
                    actions: [match]
                };
            }

            // Fuzzy match
            for (const [k, v] of Object.entries(allLinks)) {
                if (destination.toLowerCase().includes(k.replace('_', ' ')) || v.label.toLowerCase().includes(destination.toLowerCase())) {
                    return {
                        text: `Here you go! Tap below to navigate 👇`,
                        actions: [v]
                    };
                }
            }
        }

        // Return all links
        return {
            text: 'Here are all the places you can go! Tap any link 👇',
            actions: Object.values(allLinks)
        };
    }

    /**
     * Master dispatcher — Gemini tells us the sub-intent, we route it
     */
    async handleAction(subIntent, params, userId) {
        switch (subIntent) {
            case 'search_user':
                return this.searchUsers(params.query, userId);
            case 'suggested_users':
                return this.getSuggestedUsers(userId);
            case 'my_profile':
                return this.getCurrentUserInfo(userId);
            case 'my_followers':
                return this.getUserConnections(userId, 'followers');
            case 'my_following':
                return this.getUserConnections(userId, 'following');
            case 'text_someone':
                // If user named someone specific, search for them; otherwise show following list
                if (params.query && params.query.trim().length >= 2) {
                    return this.searchUsers(params.query, userId);
                }
                return this.getUserConnections(userId, 'following');
            case 'search_posts':
                return this.searchPosts(params.query, params.category);
            case 'trending_posts':
                return this.getTrendingPosts();
            case 'saved_posts':
                return this.getSavedPosts(userId);
            case 'search_groups':
                return this.searchGroups(params.query, params.category);
            case 'my_groups':
                return this.getUserGroups(userId);
            case 'navigate':
                return this.getNavLinks(params.destination);
            default:
                return this.getNavLinks();
        }
    }
}

module.exports = new AppTools();
