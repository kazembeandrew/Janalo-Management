/**
 * AI Data Firewall Utility
 * Scrubs PII (Personally Identifiable Information) from objects 
 * to ensure privacy when sending data to external AI models.
 */

export const scrubPII = (data: any): any => {
    if (!data) return data;

    // Handle arrays
    if (Array.isArray(data)) {
        return data.map(item => scrubPII(item));
    }

    // Handle objects
    if (typeof data === 'object') {
        const scrubbed: any = { ...data };
        
        const sensitiveKeys = [
            'full_name', 'name', 'phone', 'address', 
            'email', 'employment', 'username', 'password',
            'location_lat', 'location_long'
        ];

        for (const key in scrubbed) {
            if (sensitiveKeys.includes(key.toLowerCase())) {
                if (key.toLowerCase().includes('name')) {
                    // Keep first initial for context, redact the rest
                    const val = String(scrubbed[key]);
                    scrubbed[key] = val ? `${val.charAt(0)}... [REDACTED]` : '[EMPTY]';
                } else {
                    scrubbed[key] = '[REDACTED FOR PRIVACY]';
                }
            } else if (typeof scrubbed[key] === 'object') {
                scrubbed[key] = scrubPII(scrubbed[key]);
            }
        }
        return scrubbed;
    }

    return data;
};