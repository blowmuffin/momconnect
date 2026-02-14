<p align="center">
  <img src="https://img.shields.io/badge/React-18.2-61DAFB?logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white" />
  <img src="https://img.shields.io/badge/Gemini_2.0-AI-4285F4?logo=google&logoColor=white" />
  <img src="https://img.shields.io/badge/Twilio-Emergency-F22F46?logo=twilio&logoColor=white" />
  <img src="https://img.shields.io/badge/Socket.io-Realtime-010101?logo=socketdotio&logoColor=white" />
</p>

# 🤱 MomConnect — AI-Powered Maternal Health & Social Support Platform

> *An intelligent social media platform for mothers that combines community support with AI-driven maternal health assistance, real-time crisis detection, and automated emergency response.*

---

## 📋 Table of Contents

- [Why MomConnect Exists](#-why-momconnect-exists)
- [How It's Different](#-how-its-different)
- [Core Features](#-core-features)
- [System Architecture](#-system-architecture)
- [Technology Stack](#-technology-stack)
- [Project Structure](#-project-structure)
- [Module Deep-Dive](#-module-deep-dive)
  - [Backend Models](#backend-models-10-schemas)
  - [Backend Routes & API](#backend-routes--api-6-route-files)
  - [AI Chatbot System](#ai-chatbot-system)
  - [Frontend Pages & Components](#frontend-pages--components)
- [Setup & Installation](#-setup--installation)
- [Environment Variables](#-environment-variables)
- [Running the Application](#-running-the-application)
- [API Reference](#-api-reference)
- [Security Measures](#-security-measures)
- [Design Methodology](#-design-methodology)
- [Future Roadmap](#-future-roadmap)

---

## 🎯 Why MomConnect Exists

### The Problem

India accounts for **12% of global maternal deaths** (WHO, 2023). Nearly **35% of maternal complications** occur due to delayed recognition of danger signs and late access to emergency care. Rural and first-time mothers face:

- **Isolation** — No peer community to share experiences or get emotional support
- **Information asymmetry** — Unreliable health information from non-medical sources
- **Delayed emergency response** — No automated system to alert contacts or find nearby hospitals during a crisis
- **Mental health stigma** — Postpartum depression affects **22% of Indian mothers** yet remains largely unaddressed (NIMHANS study)

### The Solution

MomConnect is not just another parenting app — it's a **safety net with a social layer**. It combines:

1. **An AI health companion** that understands maternal health contexts, detects crisis situations, and takes autonomous emergency actions
2. **A community platform** where mothers connect, share, and support each other
3. **An emergency response system** that places automated calls and SMS to emergency contacts with the user's GPS location during detected crises

---

## 💡 How It's Different

| Feature | Generic Parenting Apps | MomConnect |
|---------|----------------------|------------|
| **Crisis detection** | None | Real-time AI intent classification with weighted keyword + Gemini analysis |
| **Emergency response** | Manual "call 112" button | Automated Twilio call + SMS with user's GPS location to emergency contacts |
| **Health information** | Static FAQ pages | Dynamic AI-generated, evidence-based responses with web verification |
| **Mental health** | Generic tips | Dedicated mental health agent with PHQ-9 screening, breathing exercises, crisis triage |
| **Language support** | English only | English + Hindi (crisis keywords, voice input/output) |
| **Hospital finder** | Basic address lookup | Google Places API with real-time distance, ratings, opening hours |
| **Home remedies** | Generic lists | AI-curated remedies with safety warnings specific to pregnancy/postpartum |
| **Social platform** | Separate apps | Integrated social feed, groups, DMs, explore with recommendation algorithm |
| **Memory system** | Session-only | Persistent user memory across conversations (preferences, history, children info) |
| **Voice interaction** | None | Speech-to-text input + text-to-speech output with language selection |

---

## ✨ Core Features

### 🤖 AI Chatbot System
- **Multi-agent architecture** — 4 specialized agents (Emergency, Hospital Finder, Mental Health, Home Remedy) + orchestrator
- **AI-first intent classification** — Gemini 2.0 Flash for primary classification, weighted keyword scoring as safety net
- **Persistent memory** — Remembers user preferences, children details, medical history across sessions
- **Context-aware conversations** — Maintains conversation context with automatic summarization for long chats
- **Voice I/O** — Speech recognition (en-IN, hi-IN) and text-to-speech with language-appropriate voices

### 🆘 Emergency Response System
- **Real-time crisis detection** — Identifies suicidal ideation, physical danger, and distress in English and Hindi
- **Automated phone call** — Places Twilio call to emergency contact with TTS describing the crisis
- **Automated SMS** — Sends SMS with user's distress message and GPS coordinates
- **Location forwarding** — Auto-captures browser geolocation and includes in emergency notifications
- **Cooldown mechanism** — Prevents accidental mass notifications (configurable, default 2 min for testing)
- **Circuit breaker** — Prevents cascading API failures with exponential backoff

### 🏥 Hospital Finder
- **Google Places API** integration — Finds hospitals, clinics, maternity centers within configurable radius
- **Rich results** — Shows name, distance, rating, opening hours, phone number
- **Dynamic radius** — Expands search radius automatically if too few results found

### 💚 Mental Health Support
- **Mood tracking** — PHQ-9 and GAD-7 inspired screening assessments
- **Coping strategies** — Guided breathing exercises, grounding techniques, journaling prompts
- **Crisis triage** — Escalates to emergency agent when risk is detected during assessment
- **Empathetic responses** — Prompt-engineered to be warm, supportive, and clinically informed

### 🌿 Home Remedy Agent
- **Evidence-based** — AI-generated remedies cross-referenced with web search verification
- **Safety-first** — Always includes medical disclaimers and "when to see a doctor" warnings
- **Pregnancy-aware** — Flags remedies that may be unsafe during pregnancy

### 👥 Social Platform
- **Posts** — Create, like, comment, save with image support
- **Groups** — Create/join topic-based groups with admin roles
- **Direct Messages** — Real-time messaging via Socket.io
- **Follow system** — Follow/unfollow with private account support
- **Explore** — Recommendation algorithm for discovering users, posts, groups
- **User search** — Find other mothers by name

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 18)                         │
│  ┌──────┐ ┌──────┐ ┌────────┐ ┌──────┐ ┌────────┐ ┌────────────┐  │
│  │Login │ │Home  │ │Explore │ │Groups│ │Messages│ │  ChatBot   │  │
│  └──────┘ └──────┘ └────────┘ └──────┘ └────────┘ │ Voice I/O  │  │
│                                                    │ Geolocation│  │
│                                                    │ Emergency  │  │
│                                                    └────────────┘  │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Services: Axios API Client | Socket.io Client | AuthContext   │ │
│  └────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ HTTP REST + WebSocket
┌────────────────────────────────┴────────────────────────────────────┐
│                    BACKEND (Node.js + Express)                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Middleware: Helmet | CORS | Rate Limiter | JWT Auth | Multer  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─────────────── REST API Routes ──────────────────┐               │
│  │ /auth │ /users │ /posts │ /messages │ /groups │ /chatbot │       │
│  └──────────────────────────────────────────────────────────┘       │
│                                                                     │
│  ┌─────────────── AI Chatbot System ────────────────────────────┐   │
│  │  ┌──────────────────────────────────────────────────────┐    │   │
│  │  │              ORCHESTRATOR (Brain)                     │    │   │
│  │  │  Intent Classification → Agent Routing → Response    │    │   │
│  │  └────────────┬─────────────┬──────────────┬────────────┘    │   │
│  │               │             │              │                  │   │
│  │  ┌────────────▼──┐ ┌───────▼──────┐ ┌────▼─────────┐        │   │
│  │  │ Emergency     │ │ Hospital     │ │ Mental Health│        │   │
│  │  │ Agent         │ │ Agent        │ │ Agent        │        │   │
│  │  │ (Twilio call, │ │ (Places API) │ │ (PHQ-9,      │        │   │
│  │  │  SMS, GPS)    │ │              │ │  coping)     │        │   │
│  │  └───────────────┘ └──────────────┘ └──────────────┘        │   │
│  │                                                              │   │
│  │  ┌──────────────┐  ┌──────────────────────────────────┐      │   │
│  │  │ Home Remedy  │  │          TOOLS LAYER             │      │   │
│  │  │ Agent        │  │ GeminiClient | TwilioClient      │      │   │
│  │  │ (AI + web    │  │ PlacesClient | WebSearchTool     │      │   │
│  │  │  verify)     │  │ AppTools     | CircuitBreaker    │      │   │
│  │  └──────────────┘  └──────────────────────────────────┘      │   │
│  │                                                              │   │
│  │  ┌──────────────────────────────────────────────────────┐    │   │
│  │  │ SessionManager (context) │ MemoryManager (long-term) │    │   │
│  │  └──────────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────── Socket.io Server ─────────────┐                      │
│  │ Real-time: DMs, Typing indicators,        │                      │
│  │ Online status, Chatbot events              │                      │
│  └────────────────────────────────────────────┘                      │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
┌────────────────────────────────┴────────────────────────────────────┐
│                      EXTERNAL SERVICES                              │
│  ┌──────────┐ ┌────────┐ ┌───────────────┐ ┌──────────────────┐    │
│  │ MongoDB  │ │ Gemini │ │ Google Places │ │ Twilio (Call+SMS)│    │
│  │ Atlas    │ │ 2.0    │ │ API           │ │                  │    │
│  └──────────┘ └────────┘ └───────────────┘ └──────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🛠 Technology Stack

### Backend

| Technology | Purpose | Why This Choice |
|-----------|---------|-----------------|
| **Node.js** | Runtime | Non-blocking I/O for handling concurrent chat connections |
| **Express.js 4.18** | Web framework | Industry standard, middleware ecosystem, route organization |
| **MongoDB + Mongoose 8** | Database + ODM | Flexible schema for social data, embedded documents for notifications |
| **Socket.io 4.6** | Real-time communication | WebSocket with fallback for DMs, typing indicators, online status |
| **Gemini 2.0 Flash** | AI/LLM | Fast inference (sub-second), strong at structured JSON output for intent classification |
| **Twilio** | Telephony | Automated voice calls + SMS for emergency notifications |
| **Google Places API** | Hospital search | Real-time hospital/clinic data with ratings, hours, distance |
| **JWT** | Authentication | Stateless auth for REST API + Socket.io handshake |
| **bcryptjs** | Password hashing | Industry-standard bcrypt with configurable salt rounds (12) |
| **Helmet** | HTTP security | Sets 15+ security headers (CSP, HSTS, X-Frame-Options, etc.) |
| **express-rate-limit** | DoS prevention | Per-IP and per-user rate limiting on all endpoints |
| **express-mongo-sanitize** | NoSQL injection prevention | Strips `$` and `.` from user input to prevent MongoDB injection |
| **Multer** | File uploads | Multipart form handling for avatar and post image uploads |

### Frontend

| Technology | Purpose | Why This Choice |
|-----------|---------|-----------------|
| **React 18** | UI framework | Component-based architecture, hooks for state management |
| **React Router 6** | Routing | Declarative routing with protected routes via auth context |
| **Axios** | HTTP client | Interceptors for JWT attachment and 401 auto-redirect |
| **Socket.io Client** | Real-time | Client-side WebSocket for DMs and chatbot events |
| **ReactMarkdown** | Formatting | Renders AI chatbot responses with proper formatting |
| **date-fns** | Date formatting | Lightweight date/time formatting for timestamps |
| **Web Speech API** | Voice I/O | Browser-native speech recognition + TTS (no extra dependencies) |
| **Geolocation API** | Location capture | Browser-native GPS for emergency location forwarding |

### Design Methodology

| Approach | Implementation |
|----------|---------------|
| **Agent-Based Architecture** | Modular AI agents with single-responsibility (one per domain) |
| **Multi-Signal Intent Classification** | AI-first (Gemini) + keyword safety net + context boost scoring |
| **Circuit Breaker Pattern** | Prevents cascading failures in Twilio/Gemini API calls |
| **Session + Memory Separation** | Short-term context (per session) vs long-term user memory (persistent) |
| **Defense in Depth Security** | Helmet + CORS + rate limiting + JWT + mongo-sanitize + input truncation |
| **Progressive Enhancement** | Voice/location features degrade gracefully if browser doesn't support them |

---

## 📁 Project Structure

```
momconnect/
├── backend/
│   ├── server.js                    # Express + Socket.io server entry point
│   ├── config/
│   │   └── db.js                    # MongoDB Atlas connection
│   ├── middleware/
│   │   ├── auth.js                  # JWT authentication middleware
│   │   └── upload.js                # Multer file upload configuration
│   ├── models/                      # Mongoose schemas (10 models)
│   │   ├── User.js                  # User profile, auth, emergency contact
│   │   ├── Post.js                  # Social media posts with images
│   │   ├── Comment.js               # Post comments
│   │   ├── Group.js                 # Community groups
│   │   ├── Message.js               # Direct messages
│   │   ├── ChatSession.js           # AI chatbot session state
│   │   ├── ChatMessage.js           # Individual chatbot messages
│   │   ├── EmergencyLog.js          # Emergency event audit trail
│   │   ├── UserInteraction.js       # Recommendation engine data
│   │   └── UserMemory.js            # Persistent AI memory per user
│   ├── routes/                      # Express REST API (6 route files)
│   │   ├── auth.js                  # Register, login, profile
│   │   ├── users.js                 # Follow, search, recommendations
│   │   ├── posts.js                 # CRUD, like, comment, save, feed
│   │   ├── messages.js              # DM retrieval, conversations
│   │   ├── groups.js                # CRUD, join, admin, posts
│   │   └── chatbot.js               # AI chat, location, emergency, session
│   ├── chatbot/                     # AI Chatbot System
│   │   ├── index.js                 # Module exports (orchestrator + sessionManager)
│   │   ├── config.js                # All config: keywords, prompts, thresholds
│   │   ├── orchestrator.js          # Intent classification + agent routing
│   │   ├── sessionManager.js        # Chat session lifecycle + context
│   │   ├── memoryManager.js         # Long-term user memory
│   │   ├── agents/                  # Specialized AI agents
│   │   │   ├── emergencyAgent.js    # Crisis detection + Twilio automation
│   │   │   ├── hospitalAgent.js     # Hospital/clinic search
│   │   │   ├── mentalHealthAgent.js # Mental health support + screening
│   │   │   └── homeRemedyAgent.js   # Home remedy recommendations
│   │   └── tools/                   # Shared tools
│   │       ├── geminiClient.js      # Google Gemini API wrapper
│   │       ├── twilioClient.js      # Twilio call + SMS wrapper
│   │       ├── placesClient.js      # Google Places API wrapper
│   │       ├── webSearchTool.js     # Web search for info verification
│   │       ├── appTools.js          # In-app navigation tools
│   │       └── circuitBreaker.js    # Fault tolerance pattern
│   ├── uploads/                     # User-uploaded files (gitignored)
│   ├── .env.example                 # Environment variable template
│   └── package.json                 # Backend dependencies
│
├── frontend/
│   ├── public/                      # Static assets
│   ├── src/
│   │   ├── App.js                   # Root component + routing (12 routes)
│   │   ├── index.js                 # React DOM entry
│   │   ├── index.css                # Global design system
│   │   ├── context/
│   │   │   └── AuthContext.js       # Auth state provider (JWT + user)
│   │   ├── services/
│   │   │   └── api.js               # Axios instance with interceptors
│   │   ├── pages/                   # Route-level components (10 pages)
│   │   │   ├── ChatBot.js + .css    # Full AI chatbot interface
│   │   │   ├── Home.js + .css       # Social feed
│   │   │   ├── Explore.js + .css    # Discover + recommendations
│   │   │   ├── Profile.js + .css    # User profile view
│   │   │   ├── EditProfile.js + .css # Profile editing
│   │   │   ├── Messages.js + .css   # Real-time DMs
│   │   │   ├── Groups.js + .css     # Group listing
│   │   │   ├── GroupDetail.js + .css # Individual group
│   │   │   ├── CreateGroup.js + .css # Group creation
│   │   │   ├── Login.js             # Auth login
│   │   │   └── Register.js          # Auth registration
│   │   └── components/              # Reusable components (6)
│   │       ├── Navbar.js + .css     # Top navigation bar
│   │       ├── Sidebar.js + .css    # Left sidebar navigation
│   │       ├── Post.js + .css       # Post card component
│   │       ├── CreatePost.js + .css # Post creation form
│   │       ├── SearchUsers.js + .css # User search
│   │       └── FollowersModal.js + .css # Followers/following list
│   └── package.json                 # Frontend dependencies
│
├── .gitignore                       # Git exclusions
└── README.md                        # This file
```

---

## 🔬 Module Deep-Dive

### Backend Models (10 Schemas)

| Model | Fields | Purpose |
|-------|--------|---------|
| **User** | name, email, password (hashed), avatar, bio, location, children[], interests[], followers[], following[], pendingFollowRequests[], savedPosts[], notifications[], emergencyContact{name, phone, relationship, autoCallEnabled} | Core user entity with social graph, emergency contact, and notification system |
| **Post** | author, content, image, category, likes[], commentCount, isAnonymous, tags[] | Social media posts with image support and anonymity option |
| **Comment** | post, author, content, likes[], replies[] | Nested comment system |
| **Group** | name, description, category, creator, admins[], members[], pendingRequests[], isPrivate | Community groups with role-based access |
| **Message** | sender, receiver, content, read, conversation | Direct messaging between users |
| **ChatSession** | userId, status, context[], metadata{location, assessmentState, awaitingCallConfirmation}, startedAt, endedAt | Active chatbot session with conversation context and state machine |
| **ChatMessage** | session, userId, role, content, agentType, metadata, parentMessageId | Individual chatbot message with agent attribution |
| **EmergencyLog** | userId, sessionId, triggerType, triggerMessage, severity, contactNotified, callResult, smsResult, location | Complete audit trail for every emergency notification |
| **UserInteraction** | userId, targetUserId, type, weight, metadata | Interaction signals for recommendation algorithm |
| **UserMemory** | userId, facts{}, preferences{}, healthContext{}, conversationPatterns{}, lastUpdated | Persistent AI memory across all conversations |

### Backend Routes & API (6 Route Files)

| Route File | Endpoints | Key Functions |
|-----------|-----------|---------------|
| **auth.js** | POST /register, POST /login, GET /me | Registration with validation, bcrypt hashing, JWT token generation |
| **users.js** | GET /:id, PUT /profile, POST /follow, GET /suggestions, GET /search | Profile CRUD, follow/unfollow with notifications, recommendation-based suggestions |
| **posts.js** | POST /, GET /feed, POST /:id/like, POST /:id/comment, GET /explore | Full post lifecycle, personalized feed, explore with scoring algorithm |
| **messages.js** | GET /conversations, GET /:userId, POST /send | Conversation list, message history, message sending |
| **groups.js** | POST /, GET /, POST /:id/join, POST /:id/post, PUT /:id/admin | Group CRUD, join/leave, member management, admin actions |
| **chatbot.js** | POST /message, POST /location, GET /session, GET /history, POST /emergency-contact, GET /twilio-status, GET /user-data, DELETE /user-data | Full chatbot API: message processing, location update, session management, emergency contact CRUD, Twilio diagnostics |

### AI Chatbot System

#### Orchestrator (`orchestrator.js` — 858 lines)
The brain of the chatbot. Every message flows through this pipeline:

```
User Message → sanitizeInput() → getOrCreateSession() → updateLocation()
    → classifyIntent() → [Gemini AI classification + keyword safety net]
    → Route to Agent → Agent generates response
    → saveMessage() → updateContext() → updateMemoryBackground()
    → Return response with quickReplies + actions
```

**Key Functions:**
| Function | Lines | Purpose |
|----------|-------|---------|
| `processMessage()` | 38-325 | Main pipeline: sanitize → classify → route → respond |
| `classifyIntent()` | 340-437 | Multi-signal intent: Gemini AI → keyword scoring → context boost |
| `scoreAllIntents()` | 458-492 | Weighted keyword matching across all intent categories |
| `getContextBoost()` | 494-526 | Follow-up detection: boosts current agent if message is contextual |
| `handleGreeting()` | 541-584 | Greeting handler with randomized warm responses |
| `handleGeneral()` | 600-635 | General queries via Gemini with maternal health context |
| `handleAppNavigation()` | 637-737 | In-app navigation: find users, trending posts, groups |
| `getRandomStyleDirective()` | 439-456 | Response variety: randomly varies tone each message |
| `updateMemoryBackground()` | 746-759 | Fire-and-forget long-term memory storage |

#### Session Manager (`sessionManager.js` — 304 lines)
| Function | Purpose |
|----------|---------|
| `createSession()` | Creates new chat session with metadata |
| `getOrCreateSession()` | Gets existing or creates new session |
| `updateContext()` | Adds message to session context with auto-truncation |
| `_summarizeOldContext()` | Compresses old context into summary when context exceeds max |
| `updateLocation()` | Stores user GPS coordinates in session metadata |
| `getFormattedContext()` | Formats context for Gemini API input |
| `endSession()` | Generates conversation summary, saves to memory, closes session |
| `cleanupStaleSessions()` | Periodic cleanup of abandoned sessions |

#### Memory Manager (`memoryManager.js` — ~300 lines)
| Function | Purpose |
|----------|---------|
| `getMemoryContext()` | Retrieves formatted memory for prompt injection |
| `updateFromConversation()` | Extracts facts/preferences from conversation using Gemini |
| `buildMemoryPrompt()` | Constructs memory extraction prompt for AI |
| `mergeMemory()` | Merges new facts into existing memory without duplicates |

#### Emergency Agent (`emergencyAgent.js` — 600+ lines)
| Function | Purpose |
|----------|---------|
| `handleMessage()` | Entry point: detects crisis → asks for call confirmation → provides immediate support |
| `handleCallConfirmation()` | Processes yes/no: extracts location, retrieves contact, triggers call |
| `triggerEmergencyCall()` | Orchestrates: place Twilio call → send SMS → log to EmergencyLog |
| `buildCrisisResponse()` | Generates empathetic response with helpline numbers |
| `checkCooldown()` | Prevents duplicate notifications within cooldown period |

#### Hospital Agent (`hospitalAgent.js` — 200+ lines)
| Function | Purpose |
|----------|---------|
| `handleMessage()` | Extracts location → searches Google Places → formats results |
| `searchHospitals()` | Google Places API query with radius expansion |
| `formatResults()` | Rich card format with distance, rating, hours, phone |

#### Mental Health Agent (`mentalHealthAgent.js` — 250+ lines)
| Function | Purpose |
|----------|---------|
| `handleMessage()` | Routes to assessment, coping strategies, or conversational support |
| `runAssessment()` | PHQ-9 inspired screening with score calculation |
| `getCopingStrategies()` | Guided breathing, grounding, journaling prompts |
| `escalateToCrisis()` | Transfers to emergency agent when risk score is high |

#### Home Remedy Agent (`homeRemedyAgent.js` — 800+ lines)
| Function | Purpose |
|----------|---------|
| `handleMessage()` | Identifies symptom → generates remedy → web-verifies → responds |
| `generateRemedy()` | Gemini-powered remedy generation with pregnancy safety checks |
| `verifyWithWebSearch()` | Cross-references remedy with web search results |
| `addSafetyDisclaimer()` | Appends medical disclaimer and "when to see a doctor" |

#### Chatbot Tools (6 Files)

| Tool | Purpose | Key Methods |
|------|---------|-------------|
| **geminiClient.js** | Google Gemini 2.0 Flash wrapper | `generateResponse()`, `classifyIntent()`, `extractMemory()` with retry, rate limiting, circuit breaker |
| **twilioClient.js** | Twilio voice + SMS | `placeEmergencyCall()`, `sendEmergencySMS()`, `buildVoiceMessage()`, `buildSMSMessage()` with TwiML generation |
| **placesClient.js** | Google Places API | `searchNearbyHospitals()`, `getPlaceDetails()` with radius expansion |
| **webSearchTool.js** | Web search verification | `search()` for cross-referencing AI-generated health info |
| **appTools.js** | In-app navigation | `findUsers()`, `getTrendingPosts()`, `findGroups()` — queries MongoDB directly |
| **circuitBreaker.js** | Fault tolerance | Wraps API calls with failure counting, open/half-open/closed states, exponential backoff |

### Frontend Pages & Components

| Page | Features |
|------|----------|
| **ChatBot.js** (950 lines) | Full AI chat interface, voice input (Speech Recognition API), voice output (TTS), location sharing, emergency contact modal, medical disclaimer, quick replies, action cards (user/post/group/info/nav), typing indicators, retry mechanism, markdown rendering |
| **Home.js** | Social feed with posts from followed users |
| **Explore.js** | Discovery page with recommendation algorithm |
| **Profile.js** | User profile with posts, followers, following |
| **EditProfile.js** | Profile editing with avatar upload |
| **Messages.js** | Real-time DMs with Socket.io |
| **Groups.js** | Group listing and creation |
| **GroupDetail.js** | Group posts, members, admin controls |
| **Login.js / Register.js** | Authentication forms with validation |

---

## 🚀 Setup & Installation

### Prerequisites

- **Node.js** 18+ ([download](https://nodejs.org))
- **MongoDB Atlas** account ([free tier](https://www.mongodb.com/cloud/atlas))
- **Google Cloud** project with Gemini API + Places API enabled
- **Twilio** account ([free trial](https://www.twilio.com)) for emergency calls/SMS

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/momconnect.git
cd momconnect

# 2. Install backend dependencies
cd backend
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env with your actual credentials (see section below)

# 4. Install frontend dependencies
cd ../frontend
npm install
```

---

## 🔐 Environment Variables

Create `backend/.env` with the following:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/momconnect

# Authentication
JWT_SECRET=your-random-secret-string-minimum-32-characters

# Frontend URL (for CORS)
CLIENT_URL=http://localhost:3000

# Google Gemini AI
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.0-flash

# Google Places (Hospital Finder)
GOOGLE_PLACES_API_KEY=your-places-api-key

# Twilio (Emergency Calls + SMS)
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
```

### How to Get API Keys

| Service | Steps |
|---------|-------|
| **MongoDB Atlas** | [mongodb.com/atlas](https://mongodb.com/atlas) → Create cluster → Get connection string |
| **Gemini API** | [aistudio.google.com](https://aistudio.google.com) → Get API Key |
| **Google Places** | [console.cloud.google.com](https://console.cloud.google.com) → Enable Places API → Create key |
| **Twilio** | [twilio.com](https://twilio.com) → Sign up → Dashboard → Get SID + Token + Phone |

---

## ▶️ Running the Application

### Development Mode

```bash
# Terminal 1 — Start backend
cd backend
npm start

# Terminal 2 — Start frontend
cd frontend
npm start
```

- Backend runs on **http://localhost:5000**
- Frontend runs on **http://localhost:3000**

### Production Build

```bash
cd frontend
npm run build
# Serve the build/ folder via Express or Nginx
```

---

## 📡 API Reference

### Authentication
| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/api/auth/register` | `{name, email, password}` | `{token, user}` |
| POST | `/api/auth/login` | `{email, password}` | `{token, user}` |
| GET | `/api/auth/me` | — | `{user}` |

### Chatbot
| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/api/chatbot/message` | `{message, latitude?, longitude?}` | `{message, agentType, actions, quickReplies}` |
| POST | `/api/chatbot/location` | `{latitude, longitude}` | `{success}` |
| GET | `/api/chatbot/history` | — | `{messages[]}` |
| GET | `/api/chatbot/session` | — | `{sessionId, metadata}` |
| POST | `/api/chatbot/emergency-contact` | `{name, phone, relationship}` | `{emergencyContact}` |
| GET | `/api/chatbot/twilio-status` | — | `{diagnosis}` |

### Social
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/posts/feed` | Personalized post feed |
| POST | `/api/posts` | Create post |
| POST | `/api/posts/:id/like` | Toggle like |
| POST | `/api/posts/:id/comment` | Add comment |
| POST | `/api/users/follow/:id` | Follow/unfollow user |
| GET | `/api/users/suggestions` | Recommendation-based suggestions |
| GET | `/api/groups` | List all groups |
| POST | `/api/messages/send` | Send direct message |

---

## 🔒 Security Measures

| Layer | Implementation |
|-------|---------------|
| **HTTP Headers** | Helmet.js sets CSP, HSTS, X-Frame-Options, X-Content-Type-Options |
| **Rate Limiting** | 200 req/15min global, 20 req/15min auth, 20 req/min chatbot |
| **Authentication** | JWT with 30d expiry, bcrypt (12 salt rounds), password not returned in queries |
| **Input Validation** | express-validator on auth routes, message truncation (2000 chars), HTML stripping |
| **NoSQL Injection** | express-mongo-sanitize strips `$` and `.` operators from all input |
| **File Upload** | Multer with 5MB limit, extension whitelist (jpg, png, gif, webp) |
| **Twilio Security** | Input sanitization for TwiML to prevent injection, SMS body truncation |
| **Emergency Safety** | Cooldown prevents mass notifications, circuit breaker on API failures |

---

## 📐 Design Methodology

### Software Engineering Principles Applied

1. **Separation of Concerns** — Each agent handles one domain; tools are shared via dependency injection
2. **Single Responsibility** — Models store data, routes handle HTTP, agents handle business logic, tools handle API calls
3. **Open/Closed Principle** — New agents can be added without modifying the orchestrator (register in config, add routing case)
4. **Circuit Breaker Pattern** — External API calls (Gemini, Twilio) are wrapped with failure thresholds to prevent cascade failures
5. **Progressive Enhancement** — Voice I/O and geolocation enhance UX but the app works fully without them
6. **Defense in Depth** — Multiple security layers (rate limiting + auth + sanitization + validation)
7. **Graceful Degradation** — If Gemini fails, keyword fallback handles intent classification; if Twilio fails, user is informed

### AI/ML Methodology

1. **Multi-Signal Classification** — Primary AI (Gemini) + keyword safety net + context boosting for accurate intent detection
2. **Prompt Engineering** — Carefully crafted system prompts with role, constraints, and output format specifications
3. **Response Variety** — Random style directives injected into prompts to prevent repetitive AI responses
4. **Memory Architecture** — Short-term (context window per session) + long-term (UserMemory model across sessions)
5. **Safety-First AI** — Crisis keywords have zero-latency detection (no API needed), negators prevent false positives

---

## 🗺 Future Roadmap

- [ ] **WhatsApp Integration** — Send emergency notifications via WhatsApp (bypasses Indian carrier SMS filtering)
- [ ] **Multi-language UI** — Full Hindi/Marathi/Tamil UI localization
- [ ] **Doctor Consultation** — In-app video consultation with registered doctors
- [ ] **Vaccination Tracker** — Child immunization schedule with reminders
- [ ] **Community Moderation** — AI-powered content moderation for posts and groups
- [ ] **PWA Support** — Installable progressive web app with offline support
- [ ] **Push Notifications** — Browser push for messages, mentions, and group activity
- [ ] **Analytics Dashboard** — Admin panel with usage metrics, emergency stats, user growth

---

## 📄 License

This project is built for academic and social impact purposes. All rights reserved.

---

<p align="center">
  <strong>Built with ❤️ for every mother who deserves support, safety, and community.</strong>
</p>
