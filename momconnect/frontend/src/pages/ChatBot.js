import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import api from '../services/api';
import './ChatBot.css';

const ChatBot = ({ user }) => {
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [locationShared, setLocationShared] = useState(false);
    const [sessionId, setSessionId] = useState(null);

    // Voice state
    const [isListening, setIsListening] = useState(false);
    const [speakerEnabled, setSpeakerEnabled] = useState(false);
    const [speechSupported, setSpeechSupported] = useState(false);
    const [ttsSupported, setTtsSupported] = useState(false);
    const [voiceLang, setVoiceLang] = useState('en-IN'); // en-IN or hi-IN

    // Quick replies
    const [quickReplies, setQuickReplies] = useState([]);

    // Emergency contact state
    const [showEmergencyModal, setShowEmergencyModal] = useState(false);
    const [emergencyContact, setEmergencyContact] = useState({ name: '', phone: '', relationship: '', autoCallEnabled: true });
    const [emergencyLoading, setEmergencyLoading] = useState(false);
    const [emergencySaved, setEmergencySaved] = useState(false);

    // Medical disclaimer state
    const [showDisclaimer, setShowDisclaimer] = useState(false);
    const [disclaimerAccepted, setDisclaimerAccepted] = useState(() => {
        return localStorage.getItem('momconnect_disclaimer_accepted') === 'true';
    });

    // Clear chat confirmation
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    // Scroll-to-bottom visibility
    const [showScrollBtn, setShowScrollBtn] = useState(false);

    // Retry state
    const [lastFailedMessage, setLastFailedMessage] = useState(null);

    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const inputRef = useRef(null);
    const recognitionRef = useRef(null);
    const synthRef = useRef(null);

    // Check for speech API support on mount
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            setSpeechSupported(true);
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.lang = 'en-IN'; // English-India (handles Indian accents well)

            recognition.onresult = (event) => {
                let finalTranscript = '';
                let interimTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript;
                    } else {
                        interimTranscript += transcript;
                    }
                }

                if (finalTranscript) {
                    setInput(finalTranscript);
                    setIsListening(false);
                } else if (interimTranscript) {
                    setInput(interimTranscript);
                }
            };

            recognition.onend = () => {
                setIsListening(false);
            };

            recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                setIsListening(false);
                if (event.error === 'not-allowed') {
                    setError('Microphone access denied. Please allow microphone access in your browser settings.');
                }
            };

            recognitionRef.current = recognition;
        }

        // Check TTS support
        if ('speechSynthesis' in window) {
            setTtsSupported(true);
            synthRef.current = window.speechSynthesis;
        }

        return () => {
            if (recognitionRef.current) {
                try { recognitionRef.current.abort(); } catch (e) { }
            }
            if (synthRef.current) {
                synthRef.current.cancel();
            }
        };
    }, []);

    // Load chat history on mount
    useEffect(() => {
        if (user) {
            loadHistory();
            initializeSession();
            loadEmergencyContact();
            // Auto-request location for emergency features (silently, no error if denied)
            if (!locationShared && navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    async (pos) => {
                        try {
                            await api.post('/chatbot/location', {
                                latitude: pos.coords.latitude,
                                longitude: pos.coords.longitude
                            });
                            setLocationShared(true);
                        } catch (e) {
                            // Non-critical — location will be requested again on next message
                        }
                    },
                    () => { /* User denied — that's OK, they can click 📍 later */ },
                    { timeout: 5000 }
                );
            }
            // Show disclaimer on first use
            if (!disclaimerAccepted) {
                setShowDisclaimer(true);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    // Scroll-to-bottom button visibility
    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return;
        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 200);
        };
        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, []);

    const initializeSession = async () => {
        try {
            const res = await api.get('/chatbot/session');
            if (res.data?.sessionId) {
                setSessionId(res.data.sessionId);
            }
        } catch (err) {
            // Session will be created on first message
        }
    };

    // Load emergency contact
    const loadEmergencyContact = async () => {
        try {
            const res = await api.get('/chatbot/emergency-contact');
            if (res.data?.emergencyContact) {
                setEmergencyContact(res.data.emergencyContact);
            }
        } catch (err) {
            // No emergency contact set yet
        }
    };

    // Save emergency contact
    const saveEmergencyContact = async () => {
        setEmergencyLoading(true);
        setEmergencySaved(false);
        try {
            await api.post('/chatbot/emergency-contact', emergencyContact);
            setEmergencySaved(true);
            setTimeout(() => setEmergencySaved(false), 3000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save emergency contact');
        } finally {
            setEmergencyLoading(false);
        }
    };

    const loadHistory = async () => {
        try {
            const res = await api.get('/chatbot/history');
            if (res.data?.messages) {
                setMessages(res.data.messages.map(msg => ({
                    id: msg._id,
                    text: msg.content,
                    sender: msg.role,
                    agentType: msg.agentType,
                    timestamp: new Date(msg.timestamp),
                    metadata: msg.metadata,
                    actions: msg.metadata?.actions || msg.actions || []
                })));
            }
        } catch (err) {
            console.error('Failed to load history:', err);
        }
    };

    // Text-to-Speech handler — with improved markdown cleanup and language matching
    const speakText = useCallback((text) => {
        if (!speakerEnabled || !synthRef.current) return;

        // Cancel any ongoing speech
        synthRef.current.cancel();

        // Clean text for speech — thorough markdown removal
        const cleanText = text
            .replace(/---+/g, '')           // horizontal rules
            .replace(/#{1,6}\s*/g, '')      // headers
            .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
            .replace(/\*([^*]+)\*/g, '$1')     // italic
            .replace(/_([^_]+)_/g, '$1')       // italic alt
            .replace(/~~([^~]+)~~/g, '$1')     // strikethrough
            .replace(/`([^`]+)`/g, '$1')       // inline code
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
            .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')   // images
            .replace(/^[\s]*[-*+]\s/gm, ', ')  // list items
            .replace(/^[\s]*\d+\.\s/gm, ', ')  // numbered lists
            .replace(/[•⚠️⚕️💚🏥🌿🆘📍📋🔗📅💤🌬️🧘💜🔊🔇]/g, '') // emoji
            .replace(/\n+/g, '. ')
            .replace(/\s{2,}/g, ' ')
            .trim();

        if (!cleanText) return;

        // Break into chunks if too long (max ~200 chars per utterance for natural speech)
        const chunks = cleanText.match(/.{1,200}[.!?,;]?\s*/g) || [cleanText];

        // Determine the TTS language based on the voice input language
        const ttsLangPrefix = voiceLang === 'hi-IN' ? 'hi' : 'en';

        chunks.forEach((chunk, index) => {
            const utterance = new SpeechSynthesisUtterance(chunk.trim());
            utterance.rate = 0.95;
            utterance.pitch = 1.05;
            utterance.volume = 0.9;
            utterance.lang = voiceLang; // Match input language

            // Pick a voice matching the selected language
            const voices = synthRef.current.getVoices();
            const preferred = voices.find(v =>
                (v.name.includes('Samantha') || v.name.includes('Google') || v.name.includes('Natural')) &&
                v.lang.startsWith(ttsLangPrefix)
            ) || voices.find(v => v.lang.startsWith(ttsLangPrefix) && v.name.includes('Female'))
                || voices.find(v => v.lang.startsWith(ttsLangPrefix));
            if (preferred) utterance.voice = preferred;

            synthRef.current.speak(utterance);
        });
    }, [speakerEnabled, voiceLang]);

    // Toggle mic listening
    const toggleListening = () => {
        if (!recognitionRef.current) return;

        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        } else {
            // Stop any ongoing TTS
            if (synthRef.current) synthRef.current.cancel();
            setInput('');
            // Apply current voice language before starting
            recognitionRef.current.lang = voiceLang;
            try {
                recognitionRef.current.start();
            } catch (e) {
                console.error('Speech recognition start error:', e);
                setError('Could not start voice input. Please check microphone permissions.');
                setIsListening(false);
                return;
            }
            setIsListening(true);
        }
    };

    // Toggle TTS
    const toggleSpeaker = () => {
        if (speakerEnabled && synthRef.current) {
            synthRef.current.cancel();
        }
        setSpeakerEnabled(!speakerEnabled);
    };

    // Send message
    const sendMessage = async (messageText) => {
        const text = (messageText || input).trim();
        if (!text || loading) return;

        // Stop speech recognition if active
        if (isListening && recognitionRef.current) {
            recognitionRef.current.stop();
            setIsListening(false);
        }

        // Stop any ongoing TTS
        if (synthRef.current) synthRef.current.cancel();

        const userMessage = {
            id: Date.now(),
            text,
            sender: 'user',
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setQuickReplies([]);
        setLoading(true);
        setError('');

        try {
            const payload = { message: text };

            // Include location if shared
            if (locationShared && navigator.geolocation) {
                try {
                    const pos = await new Promise((resolve, reject) =>
                        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
                    );
                    payload.latitude = pos.coords.latitude;
                    payload.longitude = pos.coords.longitude;
                } catch (locErr) {
                    // Location not critical
                }
            }

            const res = await api.post('/chatbot/message', payload);

            if (res.data) {
                // Show error banner if backend returned success: false
                if (res.data.success === false) {
                    setError(res.data.error || res.data.message || 'Something went wrong');
                    setTimeout(() => setError(''), 8000);
                }

                const botMessage = {
                    id: res.data.messageId || Date.now() + 1,
                    text: res.data.message,
                    sender: 'assistant',
                    agentType: res.data.agentType,
                    timestamp: new Date(),
                    metadata: res.data.metadata,
                    actions: res.data.actions || []
                };

                setMessages(prev => [...prev, botMessage]);

                if (res.data.sessionId) setSessionId(res.data.sessionId);

                // Always update quick replies (clears stale ones when none returned)
                setQuickReplies(res.data.quickReplies || []);

                // Speak the response if speaker is enabled
                if (speakerEnabled) {
                    speakText(res.data.message);
                }
            }
        } catch (err) {
            console.error('Send error:', err);
            const errorMessage = err.response?.data?.message || 'Something went wrong. Please try again.';
            setError(errorMessage);
            setTimeout(() => setError(''), 8000);
            setLastFailedMessage(text); // Store for retry

            // Add error as bot message with retry
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                text: '😔 I\'m having trouble connecting right now. Please try again in a moment.',
                sender: 'assistant',
                agentType: 'orchestrator',
                timestamp: new Date(),
                isError: true
            }]);
        } finally {
            setLoading(false);
        }
    };

    // Share location
    const shareLocation = async () => {
        if (!navigator.geolocation) {
            setError('Geolocation not supported by your browser');
            return;
        }

        try {
            const pos = await new Promise((resolve, reject) =>
                navigator.geolocation.getCurrentPosition(resolve, reject)
            );

            await api.post('/chatbot/location', {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude
            });

            setLocationShared(true);
            setError('');
        } catch (err) {
            setError('Unable to get location. Please enable location services.');
        }
    };

    // Clear chat — with confirmation
    const clearChat = async () => {
        if (!showClearConfirm) {
            setShowClearConfirm(true);
            return;
        }
        try {
            if (sessionId) {
                await api.delete('/chatbot/session');
            }
            setMessages([]);
            setQuickReplies([]);
            setSessionId(null);
            setShowClearConfirm(false);
        } catch (err) {
            console.error('Clear error:', err);
            setShowClearConfirm(false);
        }
    };

    // Retry last failed message
    const retryMessage = () => {
        if (lastFailedMessage) {
            setLastFailedMessage(null);
            sendMessage(lastFailedMessage);
        }
    };

    // Accept disclaimer
    const acceptDisclaimer = () => {
        localStorage.setItem('momconnect_disclaimer_accepted', 'true');
        setDisclaimerAccepted(true);
        setShowDisclaimer(false);
    };

    // Textarea auto-resize
    const handleInputChange = (e) => {
        setInput(e.target.value);
        // Auto-resize textarea
        const textarea = e.target;
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    };

    // Scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Handle quick reply click
    const handleQuickReply = (text) => {
        sendMessage(text);
    };

    // Handle key press
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // Get agent display info
    const getAgentInfo = (agentType) => {
        const agents = {
            emergency: { label: '🆘 Crisis Support', color: '#ff4757' },
            hospital: { label: '🏥 Hospital Finder', color: '#3742fa' },
            mental_health: { label: '💚 Mental Health', color: '#2ed573' },
            home_remedy: { label: '🌿 Home Remedies', color: '#ffa502' },
            app_navigation: { label: '🧭 App Navigator', color: '#1e90ff' },
            orchestrator: { label: '✨ MomConnect', color: '#764ba2' }
        };
        return agents[agentType] || agents.orchestrator;
    };

    // Login prompt if not authenticated
    if (!user) {
        return (
            <div className="chatbot-page">
                <div className="chatbot-login-prompt">
                    <h2>💬 MomConnect AI Chat</h2>
                    <p>Sign in to access your personal maternal health companion</p>
                    <Link to="/login">
                        <button>Sign In to Chat</button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="chatbot-page" role="main" aria-label="MomConnect AI Chatbot">
            {/* Medical Disclaimer Modal */}
            {showDisclaimer && (
                <div className="disclaimer-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="disclaimer-title">
                    <div className="disclaimer-modal">
                        <h3 id="disclaimer-title">⚕️ Important Medical Disclaimer</h3>
                        <div className="disclaimer-content">
                            <p><strong>MomConnect AI</strong> is an AI-powered assistant designed to provide general maternal health information and emotional support.</p>
                            <ul>
                                <li>This is <strong>not</strong> a substitute for professional medical advice, diagnosis, or treatment.</li>
                                <li>Always consult your healthcare provider for medical decisions.</li>
                                <li>In case of emergency, call emergency services immediately.</li>
                                <li>Information provided may not be accurate or up-to-date for your specific situation.</li>
                            </ul>
                            <p>By continuing, you acknowledge that you understand these limitations.</p>
                        </div>
                        <button className="disclaimer-accept-btn" onClick={acceptDisclaimer} autoFocus>
                            I Understand — Continue
                        </button>
                    </div>
                </div>
            )}

            {/* Clear Chat Confirmation */}
            {showClearConfirm && (
                <div className="clear-confirm-overlay" role="dialog" aria-modal="true" aria-label="Confirm clear chat">
                    <div className="clear-confirm-dialog">
                        <p>Are you sure you want to clear this conversation? This cannot be undone.</p>
                        <div className="clear-confirm-actions">
                            <button className="clear-confirm-cancel" onClick={() => setShowClearConfirm(false)}>Cancel</button>
                            <button className="clear-confirm-delete" onClick={clearChat}>Clear Chat</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Back Navigation */}
            <nav className="chatbot-nav" aria-label="Chat navigation">
                <Link to="/" className="back-btn" aria-label="Back to home">← Back to Home</Link>
            </nav>

            <main className="chatbot-main" aria-label="Chat interface">
                {/* Header */}
                <div className="chatbot-header">
                    <div className="chatbot-header-info">
                        <div className="chatbot-avatar">🤱</div>
                        <div className="chatbot-title">
                            <h2>MomConnect AI</h2>
                            <span className="chatbot-subtitle">Your maternal health companion</span>
                        </div>
                    </div>
                    <div className="chatbot-header-actions">
                        {locationShared && <span className="location-badge" title="Location shared">📍</span>}
                        {ttsSupported && (
                            <button
                                className={`speaker-toggle-btn ${speakerEnabled ? 'active' : ''}`}
                                onClick={toggleSpeaker}
                                title={speakerEnabled ? 'Turn off voice output' : 'Turn on voice output'}
                                aria-label={speakerEnabled ? 'Turn off voice output' : 'Turn on voice output'}
                                aria-pressed={speakerEnabled}
                            >
                                {speakerEnabled ? '🔊' : '🔇'}
                            </button>
                        )}
                        <button
                            className={`emergency-contact-btn ${emergencyContact.phone ? 'has-contact' : ''}`}
                            onClick={() => setShowEmergencyModal(true)}
                            title="Emergency contact setup"
                            aria-label="Set up emergency contact"
                        >
                            ⚠️
                        </button>
                        <button className="clear-chat-btn" onClick={() => setShowClearConfirm(true)} title="Clear chat" aria-label="Clear chat history">🗑️</button>
                    </div>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="error-banner">
                        {error}
                        <button className="error-dismiss" onClick={() => setError('')}>✕</button>
                    </div>
                )}

                {/* Messages Area */}
                <div className="chatbot-messages" ref={messagesContainerRef} role="log" aria-live="polite" aria-label="Chat messages">
                    {messages.length === 0 && !loading && (
                        <div className="chatbot-welcome">
                            <div className="welcome-icon">👋</div>
                            <h3>Hi {user.name?.split(' ')[0] || 'there'}!</h3>
                            <p>I'm your MomConnect AI companion. I'm here to support you with maternal health, emotional wellbeing, and more.</p>

                            <div className="welcome-features" role="group" aria-label="Quick start options">
                                <button className="feature-card" onClick={() => sendMessage("I need emotional support")} aria-label="Get emotional support">
                                    <span className="feature-icon">💚</span>
                                    <span>Emotional Support</span>
                                </button>
                                <button className="feature-card" onClick={() => sendMessage("Find hospitals near me")} aria-label="Find nearby hospitals">
                                    <span className="feature-icon">🏥</span>
                                    <span>Find Hospitals</span>
                                </button>
                                <button className="feature-card" onClick={() => sendMessage("I need a home remedy")} aria-label="Get home remedy suggestions">
                                    <span className="feature-icon">🌿</span>
                                    <span>Home Remedies</span>
                                </button>
                                <button className="feature-card" onClick={() => sendMessage("I need help now")} aria-label="Get crisis support">
                                    <span className="feature-icon">🆘</span>
                                    <span>Crisis Support</span>
                                </button>
                                <button className="feature-card" onClick={() => sendMessage("Find someone to connect with")} aria-label="Find people to connect with">
                                    <span className="feature-icon">🔍</span>
                                    <span>Find People</span>
                                </button>
                                <button className="feature-card" onClick={() => sendMessage("Show trending posts")} aria-label="View trending posts">
                                    <span className="feature-icon">🔥</span>
                                    <span>Trending</span>
                                </button>
                            </div>

                            <p className="welcome-prompt">
                                {speechSupported ? 'Type a message or tap the 🎤 to speak' : 'Type a message to get started'}
                            </p>
                        </div>
                    )}

                    {messages.map((msg) => (
                        <div key={msg.id} className={`message message-${msg.sender}${msg.isError ? ' message-error' : ''}`} role="article" aria-label={`${msg.sender === 'user' ? 'You' : 'MomConnect AI'} said`}>
                            {msg.sender === 'assistant' && msg.agentType && (
                                <span
                                    className="agent-badge"
                                    style={{ backgroundColor: getAgentInfo(msg.agentType).color }}
                                >
                                    {getAgentInfo(msg.agentType).label}
                                </span>
                            )}
                            <div className="message-content">
                                {msg.sender === 'assistant' ? (
                                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                                ) : (
                                    msg.text
                                )}
                            </div>

                            {/* Action Cards */}
                            {msg.actions && msg.actions.length > 0 && (
                                <div className="action-cards-container">
                                    {msg.actions.map((action, idx) => {
                                        if (action.type === 'user_card') {
                                            return (
                                                <div key={idx} className="action-card user-card">
                                                    <div className="user-card-header">
                                                        <div className="user-card-avatar">
                                                            {action.user.avatar ? (
                                                                <img src={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/uploads/avatars/${action.user.avatar}`} alt={action.user.name} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'flex'); }} />
                                                            ) : (
                                                                <span className="avatar-placeholder">{action.user.name?.charAt(0)?.toUpperCase()}</span>
                                                            )}
                                                        </div>
                                                        <div className="user-card-info">
                                                            <h4>{action.user.name}</h4>
                                                            {action.user.location && <span className="user-card-location">📍 {action.user.location}</span>}
                                                            {action.user.bio && <p className="user-card-bio">{action.user.bio.substring(0, 80)}</p>}
                                                            <span className="user-card-followers">👥 {action.user.followerCount} followers</span>
                                                        </div>
                                                    </div>
                                                    <div className="action-card-buttons">
                                                        {action.buttons?.map((btn, bIdx) => (
                                                            <button key={bIdx} className="action-card-btn" onClick={() => navigate(btn.url)}>{btn.label}</button>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        }
                                        if (action.type === 'post_card') {
                                            return (
                                                <div key={idx} className="action-card post-card">
                                                    <div className="post-card-header">
                                                        <span className="post-card-author">{action.author?.name}</span>
                                                        <span className="post-card-category">{action.post.category}</span>
                                                    </div>
                                                    <p className="post-card-content">{action.post.content}</p>
                                                    <div className="post-card-stats">
                                                        <span>❤️ {action.post.likeCount}</span>
                                                        <span>💬 {action.post.commentCount}</span>
                                                        {action.post.hasImage && <span>🖼️</span>}
                                                    </div>
                                                    <div className="action-card-buttons">
                                                        {action.buttons?.map((btn, bIdx) => (
                                                            <button key={bIdx} className="action-card-btn" onClick={() => navigate(btn.url)}>{btn.label}</button>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        }
                                        if (action.type === 'group_card') {
                                            return (
                                                <div key={idx} className="action-card group-card">
                                                    <div className="group-card-header">
                                                        <h4>{action.group.name}</h4>
                                                        <span className="group-card-category">{action.group.category}</span>
                                                    </div>
                                                    {action.group.description && <p className="group-card-desc">{action.group.description}</p>}
                                                    <div className="group-card-stats">
                                                        <span>👥 {action.group.memberCount} members</span>
                                                        {action.group.isPrivate && <span>🔒 Private</span>}
                                                    </div>
                                                    <div className="action-card-buttons">
                                                        {action.buttons?.map((btn, bIdx) => (
                                                            <button key={bIdx} className="action-card-btn" onClick={() => navigate(btn.url)}>{btn.label}</button>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        }
                                        if (action.type === 'nav_link') {
                                            return (
                                                <button key={idx} className="nav-link-card" onClick={() => navigate(action.url)}>
                                                    <span className="nav-link-icon">{action.icon}</span>
                                                    <span>{action.label}</span>
                                                </button>
                                            );
                                        }
                                        if (action.type === 'info_card') {
                                            return (
                                                <div key={idx} className="action-card info-card">
                                                    <h4 className="info-card-title">{action.title}</h4>
                                                    <div className="info-card-fields">
                                                        {action.fields?.map((field, fIdx) => (
                                                            <div key={fIdx} className="info-card-field">
                                                                <span className="info-field-label">{field.label}</span>
                                                                <span className="info-field-value">{field.value}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {action.buttons && (
                                                        <div className="action-card-buttons">
                                                            {action.buttons.map((btn, bIdx) => (
                                                                <button key={bIdx} className="action-card-btn" onClick={() => navigate(btn.url)}>{btn.label}</button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }
                                        return null;
                                    })}
                                </div>
                            )}

                            <div className="message-time" aria-label={`Sent at ${msg.timestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}>
                                {msg.timestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {msg.isError && lastFailedMessage && (
                                    <button className="retry-btn" onClick={retryMessage} aria-label="Retry sending message" title="Retry">
                                        🔄 Retry
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Quick Reply Chips */}
                    {quickReplies.length > 0 && !loading && (
                        <div className="quick-replies-container" role="group" aria-label="Suggested replies">
                            {quickReplies.map((reply, index) => (
                                <button
                                    key={index}
                                    className="quick-reply-chip"
                                    onClick={() => handleQuickReply(reply)}
                                    aria-label={`Send: ${reply}`}
                                >
                                    {reply}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Typing Indicator */}
                    {loading && (
                        <div className="message message-assistant" aria-label="MomConnect is typing">
                            <div className="typing-indicator" role="status" aria-label="Typing">
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />

                    {/* Scroll to Bottom Button */}
                    {showScrollBtn && (
                        <button className="scroll-to-bottom-btn" onClick={scrollToBottom} aria-label="Scroll to latest messages" title="Scroll to bottom">
                            ↓
                        </button>
                    )}
                </div>

                {/* Input Area */}
                <div className="chatbot-input-container" role="form" aria-label="Message input">
                    <button
                        className="location-btn"
                        onClick={shareLocation}
                        title={locationShared ? 'Location shared ✓' : 'Share location for nearby hospitals'}
                        aria-label={locationShared ? 'Location shared' : 'Share your location'}
                    >
                        {locationShared ? '📍' : '📌'}
                    </button>

                    <textarea
                        ref={inputRef}
                        className="chatbot-input"
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyPress}
                        placeholder={isListening ? '🎤 Listening...' : 'Type your message...'}
                        rows={1}
                        disabled={loading || (showDisclaimer && !disclaimerAccepted)}
                        aria-label="Type your message"
                        aria-describedby="input-hint"
                    />
                    <span id="input-hint" className="sr-only">Press Enter to send, Shift+Enter for new line</span>

                    {/* Voice Input Button */}
                    {speechSupported && (
                        <>
                            <button
                                className={`lang-toggle-btn ${voiceLang === 'hi-IN' ? 'hindi' : ''}`}
                                onClick={() => setVoiceLang(prev => prev === 'en-IN' ? 'hi-IN' : 'en-IN')}
                                title={voiceLang === 'en-IN' ? 'Switch voice to Hindi' : 'Switch voice to English'}
                                aria-label={voiceLang === 'en-IN' ? 'Switch to Hindi voice' : 'Switch to English voice'}
                                disabled={loading || isListening}
                            >
                                {voiceLang === 'en-IN' ? 'EN' : 'हि'}
                            </button>
                            <button
                                className={`mic-btn ${isListening ? 'listening' : ''}`}
                                onClick={toggleListening}
                                disabled={loading}
                                title={isListening ? 'Stop listening' : `Start voice input (${voiceLang === 'en-IN' ? 'English' : 'Hindi'})`}
                                aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
                                aria-pressed={isListening}
                            >
                                🎤
                            </button>
                        </>
                    )}

                    <button
                        className="send-btn"
                        onClick={() => sendMessage()}
                        disabled={!input.trim() || loading}
                        aria-label="Send message"
                    >
                        ➤
                    </button>
                </div>

                {/* Voice Listening Overlay */}
                {isListening && (
                    <div className="listening-overlay" onClick={toggleListening}>
                        <div className="listening-indicator">
                            <div className="listening-pulse"></div>
                            <span className="listening-text">🎤 Listening...</span>
                            <span className="listening-hint">Tap anywhere to stop</span>
                        </div>
                    </div>
                )}
            </main>

            {/* Emergency Contact Modal */}
            {showEmergencyModal && (
                <div className="emergency-modal-overlay" onClick={() => setShowEmergencyModal(false)}>
                    <div className="emergency-modal" onClick={e => e.stopPropagation()}>
                        <div className="emergency-modal-header">
                            <h3>⚠️ Emergency Contact</h3>
                            <button className="modal-close" onClick={() => setShowEmergencyModal(false)}>✕</button>
                        </div>
                        <p className="emergency-modal-desc">
                            Set up a trusted contact. If you're ever in crisis, I can reach out to them on your behalf.
                        </p>

                        <div className="emergency-form">
                            <label>
                                <span>Contact Name</span>
                                <input
                                    type="text"
                                    placeholder="e.g. Mom, Partner"
                                    value={emergencyContact.name}
                                    onChange={e => setEmergencyContact(prev => ({ ...prev, name: e.target.value }))}
                                />
                            </label>
                            <label>
                                <span>Phone Number</span>
                                <input
                                    type="tel"
                                    placeholder="e.g. 9876543210"
                                    value={emergencyContact.phone}
                                    onChange={e => setEmergencyContact(prev => ({ ...prev, phone: e.target.value }))}
                                />
                            </label>
                            <label>
                                <span>Relationship</span>
                                <select
                                    value={emergencyContact.relationship}
                                    onChange={e => setEmergencyContact(prev => ({ ...prev, relationship: e.target.value }))}
                                >
                                    <option value="">Select...</option>
                                    <option value="partner">Partner / Spouse</option>
                                    <option value="parent">Parent</option>
                                    <option value="sibling">Sibling</option>
                                    <option value="friend">Friend</option>
                                    <option value="doctor">Doctor</option>
                                    <option value="other">Other</option>
                                </select>
                            </label>
                            <label className="auto-call-toggle">
                                <input
                                    type="checkbox"
                                    checked={emergencyContact.autoCallEnabled}
                                    onChange={e => setEmergencyContact(prev => ({ ...prev, autoCallEnabled: e.target.checked }))}
                                />
                                <span>Allow auto-call in high-severity crisis</span>
                            </label>
                        </div>

                        <div className="emergency-modal-actions">
                            {emergencySaved && <span className="save-success">✓ Saved!</span>}
                            <button
                                className="emergency-save-btn"
                                onClick={saveEmergencyContact}
                                disabled={emergencyLoading || !emergencyContact.name || !emergencyContact.phone}
                            >
                                {emergencyLoading ? 'Saving...' : 'Save Contact'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatBot;
