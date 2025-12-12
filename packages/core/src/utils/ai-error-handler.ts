export type AIError = {
    message?: string;
    status?: number;
    statusCode?: number;
};

/**
 * Check if an error is a fatal AI provider error (e.g., Rate Limit, Auth).
 * If it is, throws a descriptive error that should stop execution.
 * If not, returns void (caller should handle or rethrow the original error).
 */
export function checkAndThrowFatalError(error: unknown): void {
    const aiError = error as AIError;
    const errorMessage = aiError?.message || String(error);
    const statusCode = aiError?.status || aiError?.statusCode;

    // Rate Limit / Quota
    if (
        statusCode === 429 ||
        errorMessage.includes('429') ||
        errorMessage.toLowerCase().includes('usage limit')
    ) {
        throw new Error('AI Provider Rate Limit Exceeded: ' + errorMessage);
    }

    // Authentication / Permissions
    if (
        statusCode === 401 ||
        statusCode === 403 ||
        errorMessage.includes('AI Provider Authentication Error')
    ) {
        throw new Error(`AI Provider Authentication Error (${statusCode || 'Unknown'}): ` + errorMessage);
    }
}
