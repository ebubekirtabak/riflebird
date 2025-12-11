import { describe, it, expect } from 'vitest';
import { checkAndThrowFatalError } from '../ai-error-handler';

describe('ai-error-handler', () => {
    describe('checkAndThrowFatalError', () => {
        it('should throw Rate Limit Exceeded error for 429 status code', () => {
            const error = { status: 429, message: 'Too Many Requests' };
            expect(() => checkAndThrowFatalError(error)).toThrow(/Rate Limit Exceeded/);
        });

        it('should throw Rate Limit Exceeded error when message contains "429"', () => {
            const error = { message: 'Some error 429 occurred' };
            expect(() => checkAndThrowFatalError(error)).toThrow(/Rate Limit Exceeded/);
        });

        it('should throw Rate Limit Exceeded error when message contains "usage limit"', () => {
            const error = { message: 'You have exceeded your daily usage limit' };
            expect(() => checkAndThrowFatalError(error)).toThrow(/Rate Limit Exceeded/);
        });

        it('should throw Authentication Error for 401 status code', () => {
            const error = { status: 401, message: 'Unauthorized' };
            expect(() => checkAndThrowFatalError(error)).toThrow(/Authentication Error/);
        });

        it('should throw Authentication Error for 403 status code', () => {
            const error = { status: 403, message: 'Forbidden' };
            expect(() => checkAndThrowFatalError(error)).toThrow(/Authentication Error/);
        });

        it('should throw Authentication Error even if status code is lost but message indicates it', () => {
            const error = { message: 'Failed to process file: AI Provider Authentication Error (401): Unauthorized' };
            expect(() => checkAndThrowFatalError(error)).toThrow(/Authentication Error/);
        });

        it('should not throw for non-fatal errors', () => {
            const error = { status: 500, message: 'Internal Server Error' };
            expect(() => checkAndThrowFatalError(error)).not.toThrow();
        });

        it('should not throw for generic errors', () => {
            const error = new Error('Something went wrong');
            expect(() => checkAndThrowFatalError(error)).not.toThrow();
        });
    });
});
