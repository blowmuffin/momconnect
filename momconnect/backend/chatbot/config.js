/**
 * Chatbot Configuration
 * Central configuration for all chatbot agents and settings
 */

module.exports = {
    // Gemini Model Settings
    gemini: {
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
        maxOutputTokens: 2048,
        temperature: 0.85, // Higher temperature for varied, lively responses
        classificationTemperature: 0.1, // Low temperature for consistent classification
        topP: 0.95,
        topK: 40
    },

    // Random style directives injected into prompts for response variety
    responseStyleDirectives: [
        'Be warm and encouraging like a supportive best friend who is genuinely excited to help.',
        'Be gently playful — sprinkle in light humor, fun metaphors, and the occasional emoji surprise.',
        'Be nurturing and wise, like a caring elder sister (didi) sharing life wisdom over chai.',
        'Be cheerful and energetic — use vivid, colorful language that lifts the mood.',
        'Be calm and soothing — like a warm hug on a tough day. Speak slowly and gently.',
        'Be encouraging and uplifting — celebrate the fact they reached out and highlight their strength.',
        'Be casual and relatable — like chatting with a friend who totally gets it.',
        'Be dynamic and expressive — use creative analogies and paint word pictures.',
        'Be empowering and confident — remind them they are capable and strong.',
        'Be curious and engaged — ask thoughtful follow-ups that show you really care.'
    ],

    // Context Settings
    context: {
        maxMessages: 20,
        sessionTimeoutHours: 24
    },

    // Hospital Search Settings
    hospitalSearch: {
        defaultRadiusMeters: 5000,
        maxRadiusMeters: 50000,
        maxResults: 10,
        types: ['hospital', 'doctor', 'health'],
        maternalKeywords: ['maternity', 'obstetrics', 'gynecology', 'women', 'mother']
    },

    // Crisis Detection Keywords - with context-aware phrase matching (English + Hindi/Hinglish)
    crisisKeywords: [
        'suicide', 'suicidal', 'kill myself', 'end my life', 'want to die',
        'self harm', 'hurt myself', 'cutting myself', 'overdose',
        'can\'t go on', 'no point living', 'better off dead',
        'give up on life', 'end it all', 'not worth living',
        'postpartum psychosis', 'harm my baby', 'hurt my baby',
        'intrusive thoughts', 'scary thoughts about baby',
        // Hindi / Hinglish
        'मुझे मरना है', 'मरना चाहती हूं', 'आत्महत्या', 'जीने का मन नहीं',
        'खुद को मारना', 'mar jana hai', 'marna chahti', 'khudkushi',
        'aatmhatya', 'jina nahi chahti', 'khud ko marna',
        'bachche ko nuksan', 'baby ko maarna', 'apne aap ko hurt'
    ],

    // Phrases that NEGATE crisis intent (to avoid false positives)
    crisisNegators: [
        'hopeless at', 'hopeless with', 'hopeless in',
        'can\'t go on a', 'can\'t go on the', 'can\'t go on this',
        'give up on trying', 'give up on finding',
        'not worth the', 'not worth buying',
        'cutting vegetables', 'cutting hair', 'cutting nails', 'cutting calories',
        'overdose of caffeine', 'overdose of sugar'
    ],

    // Crisis Helplines by Region
    crisisHelplines: {
        'IN': [
            { name: 'iCall (Mumbai)', number: '9152987821', hours: 'Mon-Sat 8am-10pm' },
            { name: 'Vandrevala Foundation', number: '1860-2662-345', hours: '24/7', toll: true },
            { name: 'NIMHANS Helpline', number: '080-46110007', hours: '24/7' },
            { name: 'KIRAN Mental Health', number: '1800-599-0019', hours: '24/7', toll: true },
            { name: 'Snehi (Chennai)', number: '044-24640050', hours: '24/7' },
            { name: 'Connecting Trust (Bengaluru)', number: '080-25721747', hours: 'Daily 2pm-6pm' },
            { name: 'Women Helpline (India)', number: '181', hours: '24/7', toll: true },
            { name: 'Emergency', number: '112', hours: '24/7', toll: true }
        ],
        'DEFAULT': [
            { name: 'KIRAN Mental Health Helpline', number: '1800-599-0019', hours: '24/7 (Toll-Free)', toll: true },
            { name: 'Women Helpline', number: '181', hours: '24/7', toll: true }
        ]
    },

    // Weighted keyword sets for intent classification
    // Each keyword has a weight (1-3): 1=weak signal, 2=moderate, 3=strong signal
    weightedKeywords: {
        EMERGENCY: {
            keywords: [
                { phrase: 'kill myself', weight: 3 },
                { phrase: 'end my life', weight: 3 },
                { phrase: 'want to die', weight: 3 },
                { phrase: 'suicide', weight: 3 },
                { phrase: 'suicidal', weight: 3 },
                { phrase: 'self harm', weight: 3 },
                { phrase: 'hurt myself', weight: 3 },
                { phrase: 'harm my baby', weight: 3 },
                { phrase: 'hurt my baby', weight: 3 },
                { phrase: 'overdose', weight: 2 },
                { phrase: 'can\'t go on', weight: 2 },
                { phrase: 'no point living', weight: 3 },
                { phrase: 'better off dead', weight: 3 },
                { phrase: 'end it all', weight: 3 },
                { phrase: 'scary thoughts about baby', weight: 2 },
                { phrase: 'intrusive thoughts', weight: 2 },
                { phrase: 'postpartum psychosis', weight: 3 },
                // Hindi crisis phrases
                { phrase: 'marna chahti', weight: 3 },
                { phrase: 'mar jana', weight: 3 },
                { phrase: 'jeena nahi', weight: 3 },
                { phrase: 'khudkushi', weight: 3 },
                { phrase: 'aatmhatya', weight: 3 },
                { phrase: 'jee nahi lagta', weight: 2 },
                { phrase: 'sab khatam', weight: 2 },
                { phrase: 'nahi reh sakti', weight: 2 },
                { phrase: 'bachche ko nuksan', weight: 3 },
                { phrase: 'baby ko maarna', weight: 3 },
                // Emergency contact / physical harm phrases
                { phrase: 'call my emergency', weight: 3 },
                { phrase: 'call emergency contact', weight: 3 },
                { phrase: 'emergency contact', weight: 2 },
                { phrase: 'bleeding', weight: 2 },
                { phrase: 'i am dying', weight: 3 },
                { phrase: 'i\'m dying', weight: 3 },
                { phrase: 'need help now', weight: 2 },
                { phrase: 'please help me', weight: 2 }
            ],
            threshold: 2, // minimum total weight to classify
            negators: [
                'hopeless at', 'hopeless with', 'cutting vegetables', 'cutting hair',
                'cutting nails', 'cutting calories', 'give up on trying', 'give up on finding'
            ]
        },
        HOSPITAL_SEARCH: {
            keywords: [
                { phrase: 'find hospital', weight: 3 },
                { phrase: 'find a hospital', weight: 3 },
                { phrase: 'nearby hospital', weight: 3 },
                { phrase: 'nearest hospital', weight: 3 },
                { phrase: 'hospitals near', weight: 3 },
                { phrase: 'hospital in', weight: 3 },
                { phrase: 'hospitals in', weight: 3 },
                { phrase: 'find clinic', weight: 3 },
                { phrase: 'find a clinic', weight: 3 },
                { phrase: 'nearby clinic', weight: 3 },
                { phrase: 'medical center', weight: 2 },
                { phrase: 'emergency room', weight: 2 },
                { phrase: 'maternity ward', weight: 2 },
                { phrase: 'maternity center', weight: 2 },
                { phrase: 'obgyn near', weight: 3 },
                { phrase: 'gynecologist near', weight: 3 },
                { phrase: 'pediatrician near', weight: 3 },
                { phrase: 'where is the hospital', weight: 3 },
                { phrase: 'where can i find a doctor', weight: 3 },
                // Hindi
                { phrase: 'hospital dhundho', weight: 3 },
                { phrase: 'aspatal', weight: 3 },
                { phrase: 'doctor chahiye', weight: 3 },
                { phrase: 'kareeb ka hospital', weight: 3 },
                { phrase: 'najdeeki hospital', weight: 3 },
                { phrase: 'dispensary', weight: 2 },
                { phrase: 'PHC', weight: 2 },
                { phrase: 'primary health centre', weight: 2 },
                { phrase: 'government hospital', weight: 2 },
                { phrase: 'sarkari hospital', weight: 3 }
            ],
            threshold: 2,
            negators: ['scared', 'afraid', 'nervous', 'anxious', 'worried about going']
        },
        HOME_REMEDY: {
            keywords: [
                { phrase: 'home remedy', weight: 3 },
                { phrase: 'home remedies', weight: 3 },
                { phrase: 'natural remedy', weight: 3 },
                { phrase: 'natural remedies', weight: 3 },
                { phrase: 'natural treatment', weight: 3 },
                { phrase: 'morning sickness', weight: 3 },
                { phrase: 'heartburn', weight: 2 },
                { phrase: 'constipation', weight: 2 },
                { phrase: 'swelling in', weight: 2 },
                { phrase: 'swollen feet', weight: 3 },
                { phrase: 'swollen ankles', weight: 3 },
                { phrase: 'back pain', weight: 2 },
                { phrase: 'how to relieve', weight: 2 },
                { phrase: 'what helps with', weight: 2 },
                { phrase: 'cure for', weight: 2 },
                { phrase: 'nausea during pregnancy', weight: 3 },
                { phrase: 'breastfeeding pain', weight: 2 },
                { phrase: 'nursing pain', weight: 2 },
                { phrase: 'sore nipples', weight: 2 },
                // Hindi
                { phrase: 'gharelu nuskha', weight: 3 },
                { phrase: 'gharelu upay', weight: 3 },
                { phrase: 'gharelu ilaaj', weight: 3 },
                { phrase: 'desi nuskha', weight: 3 },
                { phrase: 'ji machlana', weight: 3 },
                { phrase: 'ulti', weight: 2 },
                { phrase: 'kabz', weight: 2 },
                { phrase: 'kamar dard', weight: 2 },
                { phrase: 'pair mein sujan', weight: 3 },
                { phrase: 'acidity', weight: 2 },
                { phrase: 'gas ki problem', weight: 2 },
                // Ayurveda / traditional
                { phrase: 'ayurvedic', weight: 2 },
                { phrase: 'dadi maa', weight: 2 },
                { phrase: 'nani maa', weight: 2 },
                { phrase: 'haldi doodh', weight: 2 },
                { phrase: 'ajwain', weight: 2 },
                { phrase: 'jeera paani', weight: 2 }
            ],
            threshold: 2,
            negators: ['tired of everything', 'tired of life', 'sore about', 'ache in my heart']
        },
        MENTAL_HEALTH: {
            keywords: [
                { phrase: 'feeling anxious', weight: 3 },
                { phrase: 'feeling depressed', weight: 3 },
                { phrase: 'feeling sad', weight: 3 },
                { phrase: 'feeling down', weight: 3 },
                { phrase: 'feeling overwhelmed', weight: 3 },
                { phrase: 'feeling lonely', weight: 3 },
                { phrase: 'can\'t sleep', weight: 2 },
                { phrase: 'can\'t stop worrying', weight: 3 },
                { phrase: 'anxiety', weight: 2 },
                { phrase: 'depressed', weight: 2 },
                { phrase: 'depression', weight: 2 },
                { phrase: 'stressed', weight: 2 },
                { phrase: 'stress', weight: 1 },
                { phrase: 'overwhelmed', weight: 2 },
                { phrase: 'worried', weight: 1 },
                { phrase: 'postpartum', weight: 2 },
                { phrase: 'baby blues', weight: 3 },
                { phrase: 'crying all the time', weight: 3 },
                { phrase: 'mood swings', weight: 2 },
                { phrase: 'emotional', weight: 1 },
                { phrase: 'scared', weight: 1 },
                { phrase: 'fear', weight: 1 },
                { phrase: 'insomnia', weight: 2 },
                { phrase: 'tired of everything', weight: 2 },
                { phrase: 'tired of life', weight: 2 },
                { phrase: 'lost myself', weight: 2 },
                { phrase: 'who am i', weight: 2 },
                { phrase: 'not myself', weight: 2 },
                // Conversational support phrases
                { phrase: 'stay with me', weight: 2 },
                { phrase: 'talk to me', weight: 2 },
                { phrase: 'be with me', weight: 2 },
                { phrase: 'i need someone', weight: 2 },
                { phrase: 'i feel alone', weight: 3 },
                // Hindi mental health
                { phrase: 'bahut tension', weight: 3 },
                { phrase: 'tension ho rahi', weight: 3 },
                { phrase: 'dar lag raha', weight: 2 },
                { phrase: 'akela feel', weight: 3 },
                { phrase: 'rona aa raha', weight: 3 },
                { phrase: 'mood kharab', weight: 2 },
                { phrase: 'neend nahi aa rahi', weight: 2 },
                { phrase: 'udaas', weight: 2 },
                { phrase: 'pareshan', weight: 2 },
                { phrase: 'chinta', weight: 2 },
                { phrase: 'ghabrahat', weight: 2 },
                { phrase: 'man nahi lagta', weight: 2 },
                { phrase: 'thak gayi', weight: 2 },
                { phrase: 'bahut mushkil', weight: 2 }
            ],
            threshold: 2,
            negators: []
        },
        GREETING: {
            keywords: [
                { phrase: 'hello', weight: 3 },
                { phrase: 'hi', weight: 2 },
                { phrase: 'hey', weight: 2 },
                { phrase: 'good morning', weight: 3 },
                { phrase: 'good afternoon', weight: 3 },
                { phrase: 'good evening', weight: 3 },
                { phrase: 'good night', weight: 2 },
                { phrase: 'howdy', weight: 3 },
                { phrase: 'what\'s up', weight: 2 },
                { phrase: 'how are you', weight: 3 },
                { phrase: 'thanks', weight: 2 },
                { phrase: 'thank you', weight: 3 },
                { phrase: 'bye', weight: 3 },
                { phrase: 'goodbye', weight: 3 },
                { phrase: 'see you', weight: 3 },
                { phrase: 'take care', weight: 2 },
                // Hindi greetings
                { phrase: 'namaste', weight: 3 },
                { phrase: 'namaskar', weight: 3 },
                { phrase: 'pranam', weight: 3 },
                { phrase: 'dhanyavaad', weight: 3 },
                { phrase: 'shukriya', weight: 3 },
                { phrase: 'alvida', weight: 3 },
                { phrase: 'kaise ho', weight: 3 },
                { phrase: 'kya haal', weight: 3 },
                { phrase: 'suprabhat', weight: 3 },
                { phrase: 'shubh ratri', weight: 3 }
            ],
            threshold: 2,
            negators: []
        },
        APP_NAVIGATION: {
            keywords: [
                // User search
                { phrase: 'find user', weight: 4 },
                { phrase: 'search user', weight: 4 },
                { phrase: 'search for', weight: 3 },
                { phrase: 'find people', weight: 4 },
                { phrase: 'search people', weight: 4 },
                { phrase: 'look for', weight: 2 },
                { phrase: 'who is', weight: 2 },
                { phrase: 'find mom', weight: 3 },
                // Messaging
                { phrase: 'text someone', weight: 4 },
                { phrase: 'send message', weight: 4 },
                { phrase: 'message someone', weight: 4 },
                { phrase: 'want to text', weight: 4 },
                { phrase: 'want to message', weight: 4 },
                { phrase: 'chat with', weight: 3 },
                { phrase: 'dm ', weight: 3 },
                { phrase: 'direct message', weight: 4 },
                // Profile
                { phrase: 'my profile', weight: 4 },
                { phrase: 'my info', weight: 4 },
                { phrase: 'my followers', weight: 4 },
                { phrase: 'my following', weight: 4 },
                { phrase: 'who follows me', weight: 4 },
                { phrase: 'who do i follow', weight: 4 },
                { phrase: 'how many followers', weight: 4 },
                { phrase: 'show profile', weight: 3 },
                { phrase: 'view profile', weight: 3 },
                // Posts
                { phrase: 'show posts', weight: 3 },
                { phrase: 'find posts', weight: 3 },
                { phrase: 'search posts', weight: 4 },
                { phrase: 'trending', weight: 3 },
                { phrase: 'popular posts', weight: 3 },
                { phrase: 'saved posts', weight: 4 },
                { phrase: 'my saved', weight: 3 },
                { phrase: 'bookmarks', weight: 3 },
                { phrase: 'posts about', weight: 3 },
                // Groups
                { phrase: 'find group', weight: 4 },
                { phrase: 'search group', weight: 4 },
                { phrase: 'join group', weight: 4 },
                { phrase: 'my groups', weight: 4 },
                { phrase: 'browse groups', weight: 3 },
                { phrase: 'groups about', weight: 3 },
                // Navigation
                { phrase: 'take me to', weight: 4 },
                { phrase: 'go to', weight: 3 },
                { phrase: 'open', weight: 2 },
                { phrase: 'navigate to', weight: 4 },
                { phrase: 'show me', weight: 2 },
                { phrase: 'explore page', weight: 3 },
                { phrase: 'messages page', weight: 3 },
                { phrase: 'home page', weight: 3 },
                // Suggestions
                { phrase: 'suggest people', weight: 4 },
                { phrase: 'who should i follow', weight: 4 },
                { phrase: 'recommend people', weight: 3 },
                { phrase: 'suggest users', weight: 4 },
                // Hindi
                { phrase: 'dhundho', weight: 3 },
                { phrase: 'khojo', weight: 3 },
                { phrase: 'kisko message', weight: 4 },
                { phrase: 'mera profile', weight: 4 },
                { phrase: 'mere followers', weight: 4 },
                { phrase: 'mere groups', weight: 4 },
                { phrase: 'post dikhao', weight: 3 },
                { phrase: 'group dikhao', weight: 3 }
            ],
            threshold: 3,
            negators: []
        }
    },

    // Quick-reply suggestion templates per agent type
    quickReplies: {
        greeting: [
            'How can you help me?',
            'I have a health question',
            'I need emotional support',
            'Find hospitals near me',
            'मुझे मदद चाहिए'
        ],
        emergency: [
            'I need more resources',
            'Can you stay with me?',
            'I want to talk to someone',
            'Helpline numbers batao'
        ],
        hospital: [
            'Show more hospitals',
            'Government hospitals near me',
            'I need a specialist',
            'Thank you'
        ],
        mental_health: [
            'Tell me more',
            'What can I do right now?',
            'I want to talk about something else',
            'Thank you, that helps',
            'Kuch aur batao'
        ],
        home_remedy: [
            'Try a different remedy',
            'Is this safe during pregnancy?',
            'I have another symptom',
            'Koi aur gharelu nuskha?',
            'Thank you'
        ],
        app_navigation: [
            'Find someone',
            'Show trending posts',
            'My groups',
            'Who should I follow?',
            'Take me to messages'
        ],
        general: [
            'Tell me about healthy eating',
            'I have a health question',
            'Find hospitals near me',
            'I need emotional support',
            'Home remedy for nausea'
        ]
    },

    // Agent System Prompts - Professional Calm Psychologist Communication Style
    systemPrompts: {
        orchestrator: `You are the MomConnect AI orchestrator — an India-focused maternal health chatbot.

Analyze the user's message and classify intent. The user may write in English, Hindi (Romanized/Devanagari), Hinglish, Tamil, Telugu, Bengali, Marathi, or any Indian language.

Categories:
- EMERGENCY: Crisis indicators, self-harm, danger to self or baby
- HOSPITAL_SEARCH: Finding healthcare facilities
- MENTAL_HEALTH: Emotional wellbeing, anxiety, stress, depression, need for company/support
- HOME_REMEDY: Natural remedies for pregnancy/postpartum symptoms
- APP_NAVIGATION: Finding/searching users, viewing profiles, searching posts, browsing groups, navigating to app pages, messaging someone, showing followers/following, trending posts, saved posts
- GREETING: Greetings, farewells, thanks, casual chat
- GENERAL: Unclear or general questions

IMPORTANT: Messages like "stay with me", "talk to me", "I need someone" are MENTAL_HEALTH, not EMERGENCY.
IMPORTANT: Messages about finding people, searching, messaging someone, viewing profiles/posts/groups are APP_NAVIGATION.

Respond with ONLY the category name, optionally followed by a confidence score 0-100.
Example: MENTAL_HEALTH 85
Example: APP_NAVIGATION 90`,

        greeting: `You are MomConnect AI, a warm and friendly maternal health companion built for mothers in India.

YOUR PERSONALITY:
• You're cheerful, warm, and genuinely happy to see the user
• You're like a supportive didi (elder sister) who's always glad to chat
• Keep greetings brief (2-3 sentences max) and natural

MULTI-LANGUAGE SUPPORT:
• If the user writes in Hindi, reply in Hindi (Devanagari script)
• If the user writes in Hinglish (mixed Hindi-English), reply in Hinglish
• If the user writes in Tamil, Telugu, Bengali, Marathi, Kannada, etc., reply in that language
• If the user writes in English, reply in English
• Always match the user's language naturally

COMMUNICATION STYLE:
• Use emojis sparingly but warmly (1-2 max)
• If it's their first message, briefly mention what you can help with
• If they say thanks/shukriya/dhanyavaad, respond warmly
• NEVER respond with therapeutic language to casual greetings

VARIETY IS KEY — DO NOT BE REPETITIVE:
• NEVER start with the same greeting twice in a row
• Rotate between different openers: questions, exclamations, warm observations, playful comments
• Vary your emoji choices — don't always use the same ones
• Each response should feel fresh, spontaneous, and uniquely YOU
• Mix up sentence lengths — short punchy lines + longer warm ones

EXAMPLES (use these as inspiration, but always create fresh responses):
User: "Hello!" → "Hi there! 😊 I'm so glad you're here. How can I help you today?"
User: "Hello!" → "Hey, welcome back! ✨ What's on your mind today?"
User: "Namaste" → "Namaste! 🙏 Main MomConnect AI hoon. Aapki kya madad kar sakti hoon?"
User: "Shukriya" → "Aapka swagat hai! 😊 Kuch aur madad chahiye?"`,

        // Dynamic style directive placeholder — gets replaced at runtime
        styleDirective: '{{STYLE_DIRECTIVE}}',

        emergency: `You are a compassionate crisis support specialist for MomConnect, trained in maternal mental health crisis intervention. You serve mothers across India.

CORE APPROACH - Calm, Grounded Presence:
• Speak slowly and gently, as if you're sitting beside them in a quiet room
• Use short, clear sentences that are easy to process during distress
• Acknowledge their pain without alarm - your calm is their anchor
• Create a sense of safety through your steady, unhurried tone

MULTI-LANGUAGE: Always respond in the same language the user wrote in (Hindi, English, Hinglish, or any Indian language). In Hindi: use simple, compassionate words.

COMMUNICATION STYLE:
"I hear you, and I'm here with you right now." / "Main yahaan hoon, aapke saath."
"What you're feeling is real, and you deserve support."
"Let's take this one moment at a time, together."

RESPONSE STRUCTURE:
1. ACKNOWLEDGE: Validate their pain immediately (2-3 sentences of pure empathy)
2. GROUND: Offer one simple grounding technique if appropriate
3. CONNECT: Share India-specific crisis resources (KIRAN 1800-599-0019, Women Helpline 181)
4. HOPE: Gently remind them this pain can get better with support

INDIA-SPECIFIC RESOURCES TO ALWAYS INCLUDE:
• KIRAN Mental Health Helpline: 1800-599-0019 (24/7, toll-free)
• Women Helpline: 181 (24/7, toll-free)
• iCall: 9152987821
• Emergency: 112

Never minimize. Never lecture. Never leave them without resources.
You are a bridge to professional help, not a replacement.`,

        mentalHealth: `You are a warm, supportive mental health companion for MomConnect, specializing in maternal emotional wellbeing for mothers in India.

YOUR THERAPEUTIC APPROACH - Person-Centered & Calm:
• Imagine you're a trusted didi (elder sister) who also happens to be a trained counselor
• Speak with the warmth of someone who genuinely cares
• Use reflective listening - show you truly hear them
• Validate before you advise; acknowledge before you suggest
• Never rush to fix - sometimes presence is the medicine
• When a user says "stay with me" or "talk to me" — be fully present. Don't redirect to helplines. Just be there.

MULTI-LANGUAGE: Always respond in the same language the user wrote in. If Hindi, use warm, conversational Hindi. If Hinglish, match their tone.

COMMUNICATION STYLE:
• "That sounds like a lot to carry. Tell me more about what that's like for you."
• "Yeh bahut mushkil hoga aapke liye. Batao, kya feel ho raha hai?"
• "Many mothers experience something similar - you're not alone in this."
• "Aap akeli nahi hain. Bahut si maayen yeh mehsoos karti hain."

VARIETY IS KEY — NEVER REPEAT YOURSELF:
• NEVER open with the same line twice — each response should feel fresh and unique
• Rotate between: reflective questions, gentle observations, validating statements, hopeful reframes
• Use different metaphors and analogies each time
• Vary between asking questions and offering gentle insights
• Sometimes start with empathy, sometimes with curiosity, sometimes with a warm observation

YOUR EXPERTISE:
• Postpartum depression, anxiety, and adjustment
• Pregnancy emotional changes and body image
• Baby blues vs. postpartum depression
• Sleep deprivation and its emotional effects
• Identity shifts in motherhood
• Joint family pressures and in-law dynamics (common in India)
• Working mother guilt and balancing responsibilities
• Self-compassion and gentle self-care

GUIDELINES:
• Ask one thoughtful question at a time
• Offer 2-3 practical suggestions, not overwhelming lists
• End with an open invitation: "I'm here if you want to talk more" / "Main yahaan hoon"

You don't diagnose. You support, validate, and gently guide toward professional help when needed.`,


        hospital: `You are a warm, helpful healthcare navigator for MomConnect, helping mothers find healthcare facilities across India.

YOUR APPROACH:
• Be efficient but never cold
• Understand common Indian healthcare needs (government vs private hospitals, PHCs)
• Organize information clearly and calmly

MULTI-LANGUAGE: Respond in the user's language.

COMMUNICATION STYLE:
"Let me help you find the right care nearby."
"Aapke paas ka hospital dhundhti hoon."

RESPONSE FORMAT:
• List facilities with clear formatting
• Prioritize maternal/pediatric care when relevant
• Include: Name, Address, Distance, Rating, Contact
• Note if government (sarkari) or private
• Offer to refine search if needed`,

        homeRemedy: `You are a gentle, knowledgeable home remedy guide for MomConnect, specializing in pregnancy-safe natural wellness with knowledge of both modern and traditional Indian remedies.

YOUR APPROACH - Calm & Reassuring:
• Speak like a wise dadi/nani (grandmother) who also has medical knowledge
• Acknowledge their discomfort with genuine compassion first
• Present remedies as gentle suggestions, not commands
• Always prioritize safety over effectiveness

MULTI-LANGUAGE: Respond in the user's language. If Hindi, use familiar terms for remedies (haldi doodh, ajwain ka paani, etc.).

COMMUNICATION STYLE:
"I understand how uncomfortable [symptom] can be. Let me share some gentle remedies."
"Yeh problem bahut common hai pregnancy mein. Kuch aasaan gharelu nuskhe batati hoon."

VARIETY IS KEY — KEEP IT FRESH:
• NEVER repeat the same empathy opener — create a new compassionate opening each time
• Vary which remedies you mention first — rotate between modern, traditional, and Ayurvedic
• Use different formatting: sometimes numbered list, sometimes flowing prose, sometimes a comparison
• Mix up your disclaimers too — don't always use the exact same safety reminder text
• Add occasional interesting facts about WHY a remedy works or its cultural history

RESPONSE STRUCTURE:
1. EMPATHIZE: Acknowledge their discomfort (1-2 sentences)
2. REASSURE: Normalize the symptom if appropriate
3. SUGGEST: Offer 2-3 remedies including traditional Indian options
4. EXPLAIN: For each remedy, briefly explain why it helps
5. CAUTION: Note when to seek medical care
6. DISCLAIM: Always include a gentle safety reminder

INDIA-SPECIFIC REMEDIES TO KNOW:
• Haldi doodh (turmeric milk), Jeera paani, Ajwain, Saunf (fennel), Adrak (ginger)
• Coconut oil for skin/stretch marks
• Methi (fenugreek) for lactation
• Yoga and pranayama-based suggestions

SAFETY RULES (Non-Negotiable):
• ONLY recommend remedies verified safe during pregnancy/breastfeeding
• NEVER suggest essential oils for ingestion
• NEVER recommend herbs without pregnancy safety verification
• ALWAYS suggest consulting doctor for persistent symptoms

Your goal is to provide comfort and relief while ensuring safety above all.`
    },

    // Intent classification examples for better accuracy
    intentExamples: {
        EMERGENCY: [
            'I feel like hurting myself',
            'I can\'t take it anymore',
            'I want to end it all',
            'I\'m having scary thoughts about my baby',
            'Marna chahti hoon',
            'Sab khatam karna hai'
        ],
        HOSPITAL_SEARCH: [
            'Find a hospital near me',
            'Where is the nearest maternity center',
            'I need a doctor',
            'Hospitals in Mumbai',
            'Kareeb ka hospital batao',
            'Government hospital dhundho'
        ],
        MENTAL_HEALTH: [
            'I\'m feeling anxious about my pregnancy',
            'Is it normal to feel sad after giving birth',
            'How do I deal with stress as a new mom',
            'I can\'t stop worrying',
            'Can you stay with me?',
            'Talk to me, I feel alone',
            'Bahut tension ho rahi hai',
            'Akela feel ho raha hai'
        ],
        HOME_REMEDY: [
            'What helps with morning sickness',
            'Natural remedies for back pain',
            'How to reduce swelling in feet',
            'Home treatment for heartburn during pregnancy',
            'Gharelu nuskha batao',
            'Pregnancy mein acidity ka ilaaj'
        ],
        GREETING: [
            'Hello!',
            'Hi there',
            'Namaste',
            'Shukriya',
            'Thank you so much',
            'Goodbye, take care'
        ]
    }
};
