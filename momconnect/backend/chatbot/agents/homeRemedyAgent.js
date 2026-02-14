/**
 * Home Remedy Agent with Doctor-Like Follow-ups
 * Provides safe home remedies after gathering context through assessment questions
 */

const geminiClient = require('../tools/geminiClient');
const webSearchTool = require('../tools/webSearchTool');
const config = require('../config');
const UserMemory = require('../../models/UserMemory');

class HomeRemedyAgent {
    constructor() {
        this.agentType = 'home_remedy';
        this.systemPrompt = config.systemPrompts.homeRemedy;

        // Calm, psychologist-style follow-up messages (randomized)
        this.calmFollowUps = {
            severity: [
                "Thank you for sharing that with me. I understand this must be difficult. ",
                "I appreciate you telling me more. That helps me understand what you're going through. ",
                "That's really helpful to know. Let me gather just a bit more information. "
            ],
            duration: [
                "I see. It's good that you're paying attention to your body. ",
                "Thank you for that detail. Your body is telling you something, and I'm glad you're listening. ",
                "That context helps a lot. You know your body best. "
            ],
            pregnancyStage: [
                "Thank you for sharing that. Every stage has its own unique needs. ",
                "That's very helpful. I'll keep this in mind to ensure my suggestions are safe for you. ",
                "Perfect, thank you. This helps me tailor my suggestions specifically for your situation. "
            ]
        };

        // Core assessment questions with randomized phrasing
        this.assessmentQuestions = [
            {
                key: 'severity',
                questions: [
                    'On a gentle note, how would you describe what you\'re feeling right now with your {symptom}?',
                    'Could you help me understand how this {symptom} is affecting you?',
                    'When you think about your {symptom}, how would you describe its intensity?'
                ],
                options: ['Mild - uncomfortable but I can manage', 'Moderate - it\'s really affecting my day', 'Severe - it\'s quite overwhelming']
            },
            {
                key: 'duration',
                questions: [
                    'I\'d like to understand the timeline. How long have you been experiencing this?',
                    'Could you share when you first started noticing this?',
                    'How long have you been dealing with this, if you don\'t mind me asking?'
                ],
                options: ['Just started (hours)', 'A few days now', 'More than a week']
            },
            {
                key: 'pregnancyStage',
                questions: [
                    'To make sure I suggest only what\'s safe for you - what stage of your journey are you in?',
                    'Could you share where you are in your pregnancy or postpartum journey?',
                    'Every stage is different - could you tell me which stage you\'re in?'
                ],
                options: ['First trimester (1-12 weeks)', 'Second trimester (13-26 weeks)', 'Third trimester (27-40 weeks)', 'Postpartum/Breastfeeding', 'Not pregnant']
            }
        ];

        // Pre-defined safe remedies for common issues
        this.safeRemedies = {
            'morning_sickness': {
                title: 'Morning Sickness & Nausea',
                remedies: {
                    mild: [
                        { name: 'Ginger', how: 'Sip ginger tea or chew on crystallized ginger. Add fresh ginger to hot water.' },
                        { name: 'Small frequent meals', how: 'Eat small portions every 2-3 hours. Keep crackers by your bedside.' },
                        { name: 'Lemon', how: 'Smell fresh lemon or add lemon slices to water.' }
                    ],
                    moderate: [
                        { name: 'Ginger supplements', how: 'Try ginger capsules (250mg, 4x daily) - consult doctor first.' },
                        { name: 'Vitamin B6', how: 'Take 10-25mg three times daily - helps reduce nausea.' },
                        { name: 'Acupressure bands', how: 'Wear sea-bands on wrists - they press the P6 acupressure point.' }
                    ],
                    severe: [
                        { name: 'Seek medical attention', how: 'If you cannot keep food/water down for 24+ hours, see a doctor immediately.' },
                        { name: 'Rest and hydration', how: 'Take small sips of water. Try ice chips if water is hard to keep down.' },
                        { name: 'Avoid triggers', how: 'Identify and avoid smells/foods that trigger nausea.' }
                    ]
                },
                warning: 'If you\'re unable to keep any food or water down for 24+ hours, or notice dark urine, contact your doctor immediately.'
            },
            'back_pain': {
                title: 'Back Pain',
                remedies: {
                    mild: [
                        { name: 'Warm compress', how: 'Apply a warm (not hot) compress for 15-20 minutes.' },
                        { name: 'Gentle stretches', how: 'Try cat-cow stretches and gentle side stretches.' },
                        { name: 'Proper posture', how: 'Sit with back support. Use a pillow between knees when sleeping.' }
                    ],
                    moderate: [
                        { name: 'Prenatal yoga', how: 'Gentle yoga can strengthen your back. Look for prenatal classes.' },
                        { name: 'Maternity belt', how: 'A support belt can relieve pressure on your lower back.' },
                        { name: 'Swimming or water exercise', how: 'Water supports your weight and relieves back strain.' }
                    ],
                    severe: [
                        { name: 'Consult doctor', how: 'Severe back pain needs medical evaluation.' },
                        { name: 'Prenatal massage', how: 'A certified prenatal massage therapist can help.' },
                        { name: 'Alternate heat/cold', how: 'Try 15 min cold, then 15 min warm.' }
                    ]
                },
                warning: 'If back pain is sudden, severe, or comes with fever, bleeding, or contractions, seek immediate care.'
            },
            'heartburn': {
                title: 'Heartburn & Acid Reflux',
                remedies: {
                    mild: [
                        { name: 'Smaller meals', how: 'Eat smaller portions more frequently.' },
                        { name: 'Avoid triggers', how: 'Common triggers: spicy, acidic, fried foods, chocolate, caffeine.' },
                        { name: 'Don\'t lie down after eating', how: 'Wait at least 2-3 hours after eating before lying down.' }
                    ],
                    moderate: [
                        { name: 'Elevate upper body', how: 'Sleep with extra pillows or elevate the head of your bed.' },
                        { name: 'Ginger or chamomile tea', how: 'These can soothe the digestive system (check with doctor first).' },
                        { name: 'Milk or yogurt', how: 'A small amount can help neutralize stomach acid.' }
                    ],
                    severe: [
                        { name: 'Pregnancy-safe antacids', how: 'Ask your doctor about safe options like Tums or Maalox.' },
                        { name: 'Wear loose clothing', how: 'Tight clothes put pressure on stomach.' },
                        { name: 'Track and avoid triggers', how: 'Keep a food diary to identify your specific triggers.' }
                    ]
                },
                warning: 'If heartburn is very severe, constant, or accompanied by trouble swallowing, contact your healthcare provider.'
            },
            'fatigue': {
                title: 'Fatigue & Low Energy',
                remedies: {
                    mild: [
                        { name: 'Regular rest', how: 'Take short naps when possible. Listen to your body.' },
                        { name: 'Stay hydrated', how: 'Dehydration causes fatigue. Aim for 8-10 glasses of water.' },
                        { name: 'Light exercise', how: 'A short walk can actually boost energy levels.' }
                    ],
                    moderate: [
                        { name: 'Iron-rich foods', how: 'Eat spinach, lean meat, beans. Low iron causes fatigue.' },
                        { name: 'Sleep hygiene', how: 'Keep a regular sleep schedule. Avoid screens before bed.' },
                        { name: 'Ask for help', how: 'Let family/friends help with tasks so you can rest.' }
                    ],
                    severe: [
                        { name: 'Check with doctor', how: 'Extreme fatigue may indicate anemia or thyroid issues.' },
                        { name: 'Prenatal vitamins', how: 'Ensure you\'re taking your prenatal vitamin with iron.' },
                        { name: 'Blood tests', how: 'Ask your doctor to check iron and thyroid levels.' }
                    ]
                },
                warning: 'Extreme fatigue with dizziness, shortness of breath, or racing heart may indicate anemia. Get checked.'
            },
            'constipation': {
                title: 'Constipation',
                remedies: {
                    mild: [
                        { name: 'Fiber-rich foods', how: 'Eat more fruits, vegetables, whole grains, and legumes.' },
                        { name: 'Hydration', how: 'Drink at least 8-10 glasses of water daily.' },
                        { name: 'Prunes', how: 'Eat 4-5 prunes or drink prune juice daily.' }
                    ],
                    moderate: [
                        { name: 'Regular walking', how: 'Walk for 20-30 minutes daily to stimulate bowel movement.' },
                        { name: 'Warm liquids', how: 'Hot water with lemon in the morning can help.' },
                        { name: 'Flaxseed', how: 'Add 1-2 tablespoons of ground flaxseed to meals.' }
                    ],
                    severe: [
                        { name: 'Consult doctor', how: 'Your doctor may recommend pregnancy-safe stool softeners.' },
                        { name: 'Avoid straining', how: 'Never strain as it can cause hemorrhoids.' },
                        { name: 'Scheduled bathroom time', how: 'Try going at the same time each day, especially after meals.' }
                    ]
                },
                warning: 'Don\'t use laxatives without consulting your doctor. Severe pain or blood in stool needs immediate attention.'
            },
            'swelling': {
                title: 'Swelling (Edema)',
                remedies: {
                    mild: [
                        { name: 'Elevate feet', how: 'Rest with feet elevated above heart level for 20-30 minutes.' },
                        { name: 'Stay hydrated', how: 'Drinking water actually helps reduce water retention.' },
                        { name: 'Reduce sodium', how: 'Limit salty foods which worsen swelling.' }
                    ],
                    moderate: [
                        { name: 'Compression socks', how: 'Wear maternity compression stockings during the day.' },
                        { name: 'Avoid standing too long', how: 'Take breaks and sit with feet up every hour.' },
                        { name: 'Sleep on left side', how: 'Improves circulation and reduces swelling.' }
                    ],
                    severe: [
                        { name: 'Contact doctor', how: 'Sudden or severe swelling could indicate preeclampsia.' },
                        { name: 'Monitor blood pressure', how: 'Watch for signs like headaches, vision changes.' },
                        { name: 'Cold compress', how: 'Apply cool (not cold) compress to reduce swelling.' }
                    ]
                },
                warning: '⚠️ IMPORTANT: Sudden severe swelling, especially in face or hands, with headache or vision changes could be preeclampsia. Seek immediate medical care!'
            }
        };

        // Symptom keyword mapping
        this.symptomKeywords = {
            'morning_sickness': ['morning sickness', 'nausea', 'nauseous', 'throwing up', 'vomit', 'queasy', 'sick feeling'],
            'back_pain': ['back pain', 'backache', 'back hurts', 'lower back', 'spine', 'back ache'],
            'heartburn': ['heartburn', 'acid reflux', 'acidity', 'burning chest', 'indigestion', 'acid'],
            'swelling': ['swelling', 'swollen', 'edema', 'puffy feet', 'feet swelling', 'ankle swollen'],
            'constipation': ['constipation', 'constipated', 'bowel', 'can\'t poop', 'hard stool'],
            'fatigue': ['tired', 'fatigue', 'exhausted', 'no energy', 'worn out', 'sleepy', 'low energy']
        };
    }

    /**
     * Get a random calm follow-up message
     */
    getRandomFollowUp(key) {
        const followUps = this.calmFollowUps[key];
        return followUps[Math.floor(Math.random() * followUps.length)];
    }

    /**
     * Get a random question for a given key
     */
    getRandomQuestion(questionObj, symptomTitle) {
        const questions = questionObj.questions;
        const question = questions[Math.floor(Math.random() * questions.length)];
        return question.replace('{symptom}', symptomTitle.toLowerCase());
    }

    /**
     * Check if user wants to escape the assessment
     */
    isEscapeRequest(message) {
        const lowerMessage = message.toLowerCase().trim();
        const escapePhrases = [
            'stop', 'cancel', 'nevermind', 'never mind', 'quit', 'exit',
            'skip', 'no thanks', 'forget it', 'i don\'t want', 'leave',
            'go back', 'nahi chahiye', 'rehne do', 'band karo', 'chhodo',
            'ruk jao', 'mat pucho'
        ];
        return escapePhrases.some(phrase => lowerMessage.includes(phrase));
    }

    /**
     * Get known medical conditions from user memory for contraindication checking
     */
    async getUserConditions(userId) {
        if (!userId) return [];
        try {
            const memory = await UserMemory.findOne({ userId }).lean();
            const conditions = [];
            if (memory?.profile?.knownConditions) {
                conditions.push(...memory.profile.knownConditions);
            }
            if (memory?.profile?.pregnancyStage) {
                conditions.push(`Pregnancy stage: ${memory.profile.pregnancyStage}`);
            }
            // Also check topics for medical mentions
            if (memory?.topics) {
                const medicalTopics = memory.topics.filter(t =>
                    t.toLowerCase().includes('diabetes') || t.toLowerCase().includes('hypertension') ||
                    t.toLowerCase().includes('anemia') || t.toLowerCase().includes('thyroid') ||
                    t.toLowerCase().includes('allergy') || t.toLowerCase().includes('preeclampsia')
                );
                conditions.push(...medicalTopics);
            }
            return [...new Set(conditions)]; // deduplicate
        } catch (error) {
            console.error('[HomeRemedyAgent] Error fetching user conditions:', error.message);
            return [];
        }
    }

    /**
     * Process a home remedy request with multi-turn assessment
     */
    async process(message, context = [], session = null) {
        try {
            const assessmentState = session?.metadata?.assessmentState;

            // Check for escape intent during active assessment
            if (assessmentState?.isActive && this.isEscapeRequest(message)) {
                // Clear assessment state
                if (session) {
                    session.metadata.assessmentState = { isActive: false };
                    session.markModified('metadata');
                    await session.save();
                }
                return {
                    text: `No problem at all! I've stopped the assessment. 💚\n\nIf you'd like, I can still give you some general tips, or we can talk about something else entirely. I'm here for whatever you need.\n\n*Remember: For any health concerns during pregnancy, your healthcare provider is always the best resource.*`,
                    agentType: this.agentType,
                    metadata: { assessmentEscaped: true, symptom: assessmentState.symptom }
                };
            }

            // Check if we're in an active assessment
            if (assessmentState?.isActive) {
                return await this.continueAssessment(message, session, assessmentState);
            }

            // Identify the symptom
            const symptom = this.identifySymptom(message);

            // If we have a known symptom, start the assessment
            if (symptom && this.safeRemedies[symptom]) {
                return await this.startAssessment(symptom, session);
            }

            // For unknown symptoms, use Gemini with safety constraints
            const userId = session?.userId || session?.metadata?.userId;
            const conditions = await this.getUserConditions(userId);
            const conditionContext = conditions.length > 0
                ? `\n\nIMPORTANT - User has these known medical conditions: ${conditions.join(', ')}. Ensure all remedies are safe given these conditions and flag any contraindications.`
                : '';
            const enhancedPrompt = this.buildSafetyPrompt(message) + conditionContext;

            // Inject style directive for response variety
            const styleDirectives = config.responseStyleDirectives || [];
            const styleDirective = styleDirectives.length > 0
                ? styleDirectives[Math.floor(Math.random() * styleDirectives.length)]
                : '';
            const enhancedSystemPrompt = styleDirective
                ? `${this.systemPrompt}\n\nSTYLE FOR THIS RESPONSE: ${styleDirective}`
                : this.systemPrompt;

            const response = await geminiClient.generateResponse(
                enhancedPrompt,
                enhancedSystemPrompt,
                context
            );

            return {
                text: this.addSafetyDisclaimer(response.text),
                agentType: this.agentType,
                metadata: {
                    ...response.metadata,
                    symptom: 'other',
                    usedPreDefined: false,
                    conditionsChecked: conditions
                }
            };
        } catch (error) {
            console.error('Home remedy agent error:', error);
            return this.getFallbackResponse();
        }
    }

    /**
     * Start a new symptom assessment
     */
    async startAssessment(symptom, session) {
        // Update session with assessment state
        if (session) {
            session.metadata.assessmentState = {
                isActive: true,
                agentType: 'home_remedy',
                symptom: symptom,
                step: 0,
                responses: {},
                startedAt: new Date()
            };
            // Mark metadata as modified so Mongoose saves nested changes
            session.markModified('metadata');
            await session.save();
            console.log(`[HomeRemedyAgent] Assessment started for ${symptom}, session saved`);
        }

        const symptomTitle = this.safeRemedies[symptom].title;
        const firstQuestion = this.assessmentQuestions[0];
        const questionText = this.getRandomQuestion(firstQuestion, symptomTitle);

        let response = `I understand you're experiencing **${symptomTitle}**. I'm here to help, and I want to make sure I give you the best and safest remedies for your situation. 💚\n\nLet me ask you a few gentle questions (just like a caring doctor would):\n\n`;
        response += `**${questionText}**\n\n`;
        response += firstQuestion.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n');
        response += `\n\n_You can reply with the number or describe in your own words._`;

        return {
            text: response,
            agentType: this.agentType,
            metadata: {
                inAssessment: true,
                symptom: symptom,
                step: 0
            }
        };
    }

    /**
     * Continue an ongoing assessment
     */
    async continueAssessment(message, session, assessmentState) {
        const currentStep = assessmentState.step;
        const currentQuestion = this.assessmentQuestions[currentStep];
        const symptom = assessmentState.symptom;

        // Parse user's response
        const parsedResponse = this.parseAssessmentResponse(message, currentQuestion);

        // Store the response
        assessmentState.responses[currentQuestion.key] = parsedResponse;
        assessmentState.step = currentStep + 1;

        // Check if assessment is complete
        if (currentStep + 1 >= this.assessmentQuestions.length) {
            // Assessment complete - provide recommendations
            assessmentState.isActive = false;
            if (session) {
                session.metadata.assessmentState = assessmentState;
                session.markModified('metadata');
                await session.save();
                console.log(`[HomeRemedyAgent] Assessment completed for ${symptom}`);
            }
            return this.providePersonalizedRecommendation(symptom, assessmentState.responses, session);
        }

        // Ask next question with randomized phrasing and calm follow-up
        const nextQuestion = this.assessmentQuestions[currentStep + 1];
        const symptomTitle = this.safeRemedies[symptom]?.title || symptom;

        let response = this.getRandomFollowUp(currentQuestion.key);
        response += `**${this.getRandomQuestion(nextQuestion, symptomTitle)}**\n\n`;
        response += nextQuestion.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n');

        // Save session with markModified for nested object
        if (session) {
            session.metadata.assessmentState = assessmentState;
            session.markModified('metadata');
            await session.save();
            console.log(`[HomeRemedyAgent] Assessment step ${currentStep + 1} saved`);
        }

        return {
            text: response,
            agentType: this.agentType,
            metadata: {
                inAssessment: true,
                symptom: symptom,
                step: currentStep + 1
            }
        };
    }

    /**
     * Parse user's response to assessment question
     */
    parseAssessmentResponse(message, question) {
        const lowerMessage = message.toLowerCase().trim();

        // Check for number responses
        const numberMatch = lowerMessage.match(/^[1-5]$/);
        if (numberMatch) {
            const index = parseInt(numberMatch[0]) - 1;
            if (index >= 0 && index < question.options.length) {
                return question.options[index];
            }
        }

        // Return the raw message for keyword-based parsing later
        return lowerMessage;
    }

    /**
     * Provide personalized recommendation based on assessment
     */
    async providePersonalizedRecommendation(symptom, responses, session = null) {
        const remedy = this.safeRemedies[symptom];
        if (!remedy) {
            return this.getFallbackResponse();
        }

        // Determine severity level
        let severityLevel = 'mild';
        if (responses.severity) {
            if (responses.severity.includes('severe') || responses.severity.includes('overwhelming')) {
                severityLevel = 'severe';
            } else if (responses.severity.includes('moderate') || responses.severity.includes('affecting')) {
                severityLevel = 'moderate';
            }
        }

        // Get remedies for severity level
        const remedies = remedy.remedies[severityLevel] || remedy.remedies.mild;

        // Check for contraindications via user memory
        const userId = session?.userId || session?.metadata?.userId;
        const conditions = await this.getUserConditions(userId);
        let contraindicationWarning = '';
        if (conditions.length > 0) {
            contraindicationWarning = `\n\n⚠️ **Note about your health profile:** Based on what I know about your conditions (${conditions.join(', ')}), please double-check these remedies with your healthcare provider to ensure they're safe for you.\n`;
        }

        // Build personalized response with calm psychologist tone
        let response = `## ${remedy.title} - Your Personalized Care Plan\n\n`;
        response += `⚕️ *I'm an AI assistant, not a medical professional. These suggestions are for informational purposes only.*\n\n`;
        response += `Thank you for taking the time to share that with me. Based on what you've told me:\n\n`;
        response += `• **How you're feeling:** ${responses.severity || 'Not specified'}\n`;
        response += `• **Duration:** ${responses.duration || 'Not specified'}\n`;
        response += `• **Your journey stage:** ${responses.pregnancyStage || 'Not specified'}\n\n`;

        response += `Here are some gentle remedies I think could help you feel more comfortable:\n\n`;

        remedies.forEach((r, i) => {
            response += `**${i + 1}. ${r.name}**\n${r.how}\n\n`;
        });

        // Add contraindication warning if applicable
        if (contraindicationWarning) {
            response += contraindicationWarning;
        }

        // Verify the primary remedy via web search (non-blocking)
        let verificationInfo = null;
        try {
            const primaryRemedy = remedies[0]?.name || symptom;
            const verification = await webSearchTool.verifyRemedy(symptom.replace(/_/g, ' '), primaryRemedy);
            if (verification.verified) {
                verificationInfo = verification;
                response += `\n📋 **Source verification:** Information about *${primaryRemedy}* verified via ${verification.source || 'web search'}.\n`;
                if (verification.url) {
                    response += `🔗 [Read more](${verification.url})\n`;
                }
                response += `\n`;
            }
        } catch (err) {
            console.warn('[HomeRemedyAgent] Web verification failed (non-blocking):', err.message);
        }

        // Add severity-specific advice
        if (severityLevel === 'severe') {
            response += `\n⚠️ **A caring note:** Since what you're experiencing seems quite intense, I want to gently encourage you to reach out to your healthcare provider. These remedies can offer some relief, but you deserve professional care and attention.\n\n`;
        }

        // Add duration-specific advice
        if (responses.duration === 'weeks' || responses.duration?.includes('week')) {
            response += `\n📅 **Gentle reminder:** Since this has been going on for a while, it might be worth mentioning to your doctor at your next visit. You know your body best, and getting a professional opinion is always a good idea.\n\n`;
        }

        response += `---\n⚠️ **When to seek care:** ${remedy.warning}\n\n`;
        response += `*These suggestions come from a place of care, but every body is unique. Please always check with your healthcare provider, especially during pregnancy or while breastfeeding. You're doing amazing, and I'm here if you need more support.* 💚`;

        return {
            text: response,
            agentType: this.agentType,
            metadata: {
                symptom,
                severityLevel,
                usedPreDefined: true,
                assessmentCompleted: true,
                responses,
                conditionsChecked: conditions,
                webVerification: verificationInfo
            }
        };
    }

    /**
     * Identify the symptom from user message
     */
    identifySymptom(message) {
        const lowerMessage = message.toLowerCase();

        for (const [symptom, keywords] of Object.entries(this.symptomKeywords)) {
            if (keywords.some(kw => lowerMessage.includes(kw))) {
                return symptom;
            }
        }

        return null;
    }

    /**
     * Build a safety-enhanced prompt for unknown symptoms
     */
    buildSafetyPrompt(message) {
        return `User is asking about: ${message}

Please provide helpful information while:
1. Only suggesting remedies that are SAFE during pregnancy and breastfeeding
2. Being cautious and recommending doctor consultation when appropriate
3. Using a warm, calm, and supportive psychologist-like tone
4. Never diagnosing or suggesting medications
5. Being specific about how to use any remedy you suggest`;
    }

    /**
     * Add safety disclaimer if not already present
     */
    addSafetyDisclaimer(response) {
        if (response.includes('consult') || response.includes('doctor') || response.includes('healthcare')) {
            return response;
        }
        return response + '\n\n---\n*These gentle suggestions come from a place of care. Please always check with your healthcare provider, especially during pregnancy or breastfeeding.* 💚';
    }

    /**
     * Fallback response with calm tone
     */
    getFallbackResponse() {
        return {
            text: `I'm here to help you feel more comfortable. To give you the safest and most personalized suggestions, could you tell me a bit more about:

• What symptoms are you experiencing?
• How would you describe the intensity?
• How long have you been feeling this way?

This helps me provide remedies that are gentle and safe for your unique situation.

**In the meantime, some universally comforting tips:**
• Stay well hydrated with water or herbal teas
• Rest when your body asks for it
• Gentle movement can sometimes help

*Remember, I'm here for you, and please always feel free to reach out to your healthcare provider for personalized care.* 💚`,
            agentType: this.agentType,
            metadata: {
                fallback: true
            }
        };
    }
}

module.exports = new HomeRemedyAgent();

