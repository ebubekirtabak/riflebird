import { getCompiledPattern } from './file/file-patterns';

/**
 * Check if a file name or path matches any of the given patterns
 * @param fileName - File name to test
 * @param filePath - Full file path to test
 * @param patterns - Array of glob patterns to match against
 * @param caseSensitive - Whether matching should be case-sensitive
 * @returns True if the file matches any pattern
 */
export function matchesPattern(
    fileName: string,
    filePath: string,
    patterns: string[],
    caseSensitive: boolean
): boolean {
    const compiledPatterns = patterns.map(p => getCompiledPattern(p, caseSensitive));

    // Normalize strings for case-insensitive matching
    const name = caseSensitive ? fileName : fileName.toLowerCase();
    const path = caseSensitive ? filePath : filePath.toLowerCase();

    return compiledPatterns.some(compiled =>
        compiled.regex.test(compiled.isPathPattern ? path : name)
    );
};