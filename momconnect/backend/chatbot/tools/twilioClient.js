/**
 * Twilio Client
 * Handles automated emergency voice calls and SMS via Twilio API
 * 
 * Required environment variables:
 *   TWILIO_ACCOUNT_SID  - Twilio account SID
 *   TWILIO_AUTH_TOKEN    - Twilio auth token
 *   TWILIO_PHONE_NUMBER  - Twilio phone number (E.164 format, e.g. +1234567890)
 */

const CircuitBreaker = require('./circuitBreaker');

class TwilioClient {
    constructor() {
        this.accountSid = process.env.TWILIO_ACCOUNT_SID;
        this.authToken = process.env.TWILIO_AUTH_TOKEN;
        this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
        this.client = null;
        this.initError = null;

        // ─── Validate credentials format ───
        if (!this.accountSid || !this.authToken) {
            this.initError = 'Twilio credentials not set in .env (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)';
            console.warn(`⚠️ ${this.initError}. Emergency calling will not function.`);
            return;
        }

        if (!this.accountSid.startsWith('AC')) {
            this.initError = `TWILIO_ACCOUNT_SID has wrong format: starts with "${this.accountSid.substring(0, 2)}" but must start with "AC". Check your Twilio Console → Account → Account SID.`;
            console.error(`❌ ${this.initError}`);
            return;
        }

        if (!this.fromNumber) {
            this.initError = 'TWILIO_PHONE_NUMBER not set in .env';
            console.warn(`⚠️ ${this.initError}`);
            return;
        }

        try {
            const twilio = require('twilio');
            this.client = twilio(this.accountSid, this.authToken);
            console.log(`✅ Twilio client initialized (SID: ${this.accountSid.substring(0, 6)}..., Phone: ${this.fromNumber})`);

            // Circuit breaker for Twilio API calls
            this.circuitBreaker = new CircuitBreaker({
                name: 'twilio',
                failureThreshold: 3,
                resetTimeoutMs: 60000,
                fallback: () => ({ success: false, error: 'Twilio circuit breaker open — too many recent failures' })
            });
        } catch (error) {
            this.initError = `Twilio SDK failed to initialize: ${error.message}. Run: npm install twilio`;
            console.error(`❌ ${this.initError}`);
        }
    }

    /**
     * Check if Twilio is available and configured
     */
    isAvailable() {
        return this.client !== null && this.fromNumber !== undefined;
    }

    /**
     * Place an automated emergency voice call
     * The call plays a TwiML message alerting the emergency contact
     * 
     * @param {string} toPhone - Recipient phone number (E.164 format: +919876543210)
     * @param {string} userName - Name of the user in distress
     * @param {Object} options - Additional options
     * @param {string} options.severity - Crisis severity (HIGH, MEDIUM)
     * @param {string} options.relationship - Contact's relationship to user
     * @returns {Object} Call result { success, callSid, error }
     */
    async placeEmergencyCall(toPhone, userName, options = {}) {
        if (!this.isAvailable()) {
            const reason = this.initError || 'Twilio client is null (unknown reason)';
            console.error(`[TwilioClient] Cannot place call — ${reason}`);
            return { success: false, error: `Twilio not configured: ${reason}` };
        }

        // Sanitize trigger message for voice — remove special chars that break TwiML
        const triggerMsg = (options.triggerMessage || '').replace(/[<>&"']/g, '').substring(0, 200);

        if (!toPhone || !this.isValidPhone(toPhone)) {
            return { success: false, error: 'Invalid phone number' };
        }

        const severity = options.severity || 'HIGH';
        const relationship = options.relationship || 'contact';

        // Build the voice message with full context
        const voiceMessage = this.buildVoiceMessage(userName, severity, relationship, triggerMsg, options.location);

        try {
            const callFn = async () => {
                const call = await this.client.calls.create({
                    twiml: voiceMessage,
                    to: toPhone,
                    from: this.fromNumber,
                    timeout: 30,
                    record: false,
                    statusCallbackEvent: ['completed', 'busy', 'failed', 'no-answer']
                });
                return call;
            };

            const call = await this.circuitBreaker.exec(callFn);

            console.log(`[TwilioClient] Emergency call placed — SID: ${call.sid}, to: ${toPhone}`);

            return {
                success: true,
                callSid: call.sid,
                status: call.status
            };
        } catch (error) {
            console.error('[TwilioClient] Call error:', error.message);
            return {
                success: false,
                error: error.message,
                code: error.code
            };
        }
    }

    /**
     * Send an emergency SMS as backup
     * 
     * @param {string} toPhone - Recipient phone number (E.164 format)
     * @param {string} userName - Name of the user in distress
     * @param {Object} options - Additional options
     * @returns {Object} SMS result { success, messageSid, error }
     */
    async sendEmergencySMS(toPhone, userName, options = {}) {
        if (!this.isAvailable()) {
            const reason = this.initError || 'Twilio client is null (unknown reason)';
            console.error(`[TwilioClient] Cannot send SMS — ${reason}`);
            return { success: false, error: `Twilio not configured: ${reason}` };
        }

        if (!toPhone || !this.isValidPhone(toPhone)) {
            return { success: false, error: 'Invalid phone number' };
        }

        const triggerMsg = (options.triggerMessage || '').substring(0, 300);

        const severity = options.severity || 'HIGH';

        const smsBody = this.buildSMSMessage(userName, severity, triggerMsg, options.location);

        console.log(`[TwilioClient] Sending SMS to ${toPhone}, body length: ${smsBody.length}`);
        console.log(`[TwilioClient] SMS body preview: ${smsBody.substring(0, 100)}...`);

        try {
            const message = await this.client.messages.create({
                body: smsBody,
                to: toPhone,
                from: this.fromNumber
            });

            console.log(`[TwilioClient] Emergency SMS sent — SID: ${message.sid}, to: ${toPhone}, status: ${message.status}`);

            return {
                success: true,
                messageSid: message.sid,
                status: message.status
            };
        } catch (error) {
            console.error('[TwilioClient] SMS error:', error.message);
            console.error('[TwilioClient] SMS error code:', error.code);
            console.error('[TwilioClient] SMS error details:', error.moreInfo || 'none');
            return {
                success: false,
                error: error.message,
                code: error.code
            };
        }
    }

    /**
     * Build TwiML voice message for the emergency call
     */
    buildVoiceMessage(userName, severity, relationship, triggerMessage = '', location = null) {
        const urgencyText = severity === 'HIGH'
            ? 'This is an URGENT emergency alert. Please listen carefully.'
            : 'This is an important safety alert. Please listen carefully.';

        // Build context about what happened
        let whatHappened = `Your ${relationship}, ${userName}, has reached out for emergency help through MomConnect, a maternal health app.`;
        if (triggerMessage) {
            whatHappened += ` They said: ${triggerMessage}.`;
        }

        // Location mention for voice
        let locationNote = '';
        if (location && location.lat && location.lng) {
            locationNote = `Their location has been shared with you via text message. Please check your S M S for a map link.`;
        }

        // TwiML format with clear, actionable voice message — repeated twice
        return `<Response>
    <Say voice="Polly.Joanna" language="en-US">
        Hello. ${urgencyText}
    </Say>
    <Pause length="1"/>
    <Say voice="Polly.Joanna" language="en-US">
        ${whatHappened}
    </Say>
    <Pause length="1"/>
    <Say voice="Polly.Joanna" language="en-US">
        Here is what you should do right now.
        First, try calling ${userName} immediately.
        Second, if they don't answer, go to their location if you can.
        Third, if you believe they are in danger, call emergency services at 1 1 2.
        ${locationNote}
    </Say>
    <Pause length="2"/>
    <Say voice="Polly.Joanna" language="en-US">
        I will now repeat this message one more time.
    </Say>
    <Pause length="1"/>
    <Say voice="Polly.Joanna" language="en-US">
        ${urgencyText}
        ${whatHappened}
        Please call ${userName} immediately. If they don't answer, go to them or call emergency services at 1 1 2.
        ${locationNote}
    </Say>
    <Pause length="1"/>
    <Say voice="Polly.Joanna" language="en-US">
        This was an automated alert from MomConnect. Thank you for being there for ${userName}. Goodbye.
    </Say>
</Response>`;
    }

    /**
     * Build SMS message for emergency notification
     */
    buildSMSMessage(userName, severity, triggerMessage = '', location = null) {
        // Ultra-short, single-segment SMS to avoid Indian carrier DLT filtering
        // No newlines, no special chars, no URLs — just plain text under 160 chars
        let body = `${userName} needs emergency help.`;

        if (triggerMessage) {
            const short = triggerMessage.substring(0, 60);
            body += ` Msg: ${short}`;
        }

        body += ` Call them or call 112.`;

        if (location && location.lat && location.lng) {
            body += ` GPS: ${location.lat.toFixed(4)},${location.lng.toFixed(4)}`;
        }

        return body;
    }

    /**
     * Validate phone number (basic E.164 format check)
     */
    /**
     * Diagnose Twilio configuration issues
     * @returns {Object} Diagnostic info
     */
    diagnose() {
        return {
            sdkInstalled: (() => { try { require('twilio'); return true; } catch { return false; } })(),
            accountSidSet: !!this.accountSid,
            accountSidFormat: this.accountSid ? (this.accountSid.startsWith('AC') ? 'valid (AC...)' : `INVALID (starts with ${this.accountSid.substring(0, 2)})`) : 'not set',
            authTokenSet: !!this.authToken,
            fromNumberSet: !!this.fromNumber,
            fromNumber: this.fromNumber || 'not set',
            clientInitialized: this.client !== null,
            initError: this.initError,
            isAvailable: this.isAvailable()
        };
    }

    isValidPhone(phone) {
        // E.164: + followed by 7-15 digits
        return /^\+[1-9]\d{6,14}$/.test(phone);
    }
}

module.exports = new TwilioClient();
