import { FileNode, FileTreeOptions } from '@models/file-tree';

export type CompiledPattern = {
  regex: RegExp;
  isPathPattern: boolean;
};

export type FilePattern = {
  /**
   * File naming patterns to match
   * Examples: ['*.component.tsx', '*.test.ts', '*.spec.ts']
   */
  patterns: string[];
  /**
   * File extensions to include
   * Examples: ['.tsx', '.ts', '.jsx', '.js']
   */
  extensions?: string[];
  /**
   * Description of the file type
   */
  description?: string;
};

export type FileType =
  | 'component'
  | 'test'
  | 'model'
  | 'util'
  | 'config'
  | 'hook'
  | 'page'
  | 'api'
  | 'style'
  | 'custom';

/**
 * Predefined file patterns for common file types
 */
export const FILE_PATTERNS: Record<FileType, FilePattern> = {
  component: {
    patterns: [
      '*.component.tsx',
      '*.component.ts',
      '*.component.jsx',
      '*.component.js',
      '*.[Cc]omponent.tsx',
      '*.[Cc]omponent.jsx',
    ],
    extensions: ['.tsx', '.jsx', '.ts', '.js'],
    description: 'React/Vue/Angular components',
  },
  test: {
    patterns: [
      '*.test.ts',
      '*.test.tsx',
      '*.test.js',
      '*.test.jsx',
      '*.spec.ts',
      '*.spec.tsx',
      '*.spec.js',
      '*.spec.jsx',
    ],
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    description: 'Test files',
  },
  model: {
    patterns: ['*.model.ts', '*.model.js', '*.entity.ts', '*.schema.ts'],
    extensions: ['.ts', '.js'],
    description: 'Data models and entities',
  },
  util: {
    patterns: ['*.util.ts', '*.util.js', '*.helper.ts', '*.helper.js'],
    extensions: ['.ts', '.js'],
    description: 'Utility and helper functions',
  },
  config: {
    patterns: [
      '*.config.ts',
      '*.config.js',
      '*.config.mjs',
      '*.config.json',
      'tsconfig.json',
      'package.json',
    ],
    extensions: ['.ts', '.js', '.mjs', '.json'],
    description: 'Configuration files',
  },
  hook: {
    patterns: ['use*.ts', 'use*.tsx', 'use*.js', 'use*.jsx'],
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    description: 'React hooks',
  },
  page: {
    patterns: ['*.page.tsx', '*.page.ts', '*.page.jsx', '*.page.js', 'page.tsx', 'page.ts'],
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
    description: 'Page components',
  },
  api: {
    patterns: ['*.api.ts', '*.api.js', '*.service.ts', '*.service.js'],
    extensions: ['.ts', '.js'],
    description: 'API and service files',
  },
  style: {
    patterns: ['*.css', '*.scss', '*.sass', '*.less', '*.module.css', '*.module.scss'],
    extensions: ['.css', '.scss', '.sass', '.less'],
    description: 'Style files',
  },
  custom: {
    patterns: [],
    extensions: [],
    description: 'Custom pattern',
  },
};

export type FindFilesByPatternOptions = FileTreeOptions & {
  /**
   * Case-sensitive pattern matching
   * @default false
   */
  caseSensitive?: boolean;
  /**
   * Include full file path in results
   * @default true
   */
  includeFullPath?: boolean;
  /**
   * Patterns to exclude
   * Examples: ['*.test.ts', 'dist/**']
   */
  excludePatterns?: string[];
  /**
   * Pre-built file tree to use instead of fetching from rootPath
   * If provided, rootPath parameter will be ignored
   */
  fileTree?: FileNode[];
};

const PATTERN_CACHE = new Map<string, CompiledPattern>();

export function getCompiledPattern(pattern: string, caseSensitive: boolean): CompiledPattern {
  const cacheKey = `${pattern}:${caseSensitive ? 's' : 'i'}`;

  if (PATTERN_CACHE.has(cacheKey)) {
    return PATTERN_CACHE.get(cacheKey)!;
  }

  const pat = caseSensitive ? pattern : pattern.toLowerCase();
  const isPath = pattern.includes('/') || pattern.includes('**');

  let regexPattern = '';
  let i = 0;
  const len = pat.length;

  while (i < len) {
    const char = pat[i];

    if (char === '\\') {
      // Handle escape sequences
      if (i + 1 < len) {
        const nextChar = pat[i + 1];
        // If next char is a glob special, treat as literal
        if (['*', '?', '(', ')', '[', ']', '{', '}', '\\'].includes(nextChar)) {
          regexPattern += escapeRegExp(nextChar);
          i += 2;
          continue;
        }
      }
      // Otherwise treat backslash as literal
      regexPattern += '\\\\';
      i++;
      continue;
    }

    if (char === '*') {
      // Handle ** vs *
      if (i + 1 < len && pat[i + 1] === '*') {
        regexPattern += '.*';
        i += 2;
      } else {
        regexPattern += '[^/]*';
        i++;
      }
      continue;
    }

    if (char === '?') {
      regexPattern += '[^/]';
      i++;
      continue;
    }

    if (char === '[') {
      // Handle character classes [abc] or [a-z]
      // We need to find the closing ]
      let j = i + 1;
      let foundClose = false;
      while (j < len) {
        if (pat[j] === ']' && pat[j - 1] !== '\\') {
          foundClose = true;
          break;
        }
        j++;
      }

      if (foundClose) {
        // Determine content of class
        const content = pat.substring(i, j + 1);
        // Validate content is just a character class (mostly safe to pass through if valid)
        // But generally safe to just append as is, because [ ] are regex chars too.
        // We just need to make sure we don't accidentally enable other regex features inside?
        // Standard regex class content is: literals, ranges, escaped chars.
        regexPattern += content;
        i = j + 1;
        continue;
      }
      // If no closing bracket, treat [ as literal? Or fail?
      // Standard glob usually treats unclosed [ as literal.
      regexPattern += '\\[';
      i++;
      continue;
    }

    if (char === '{') {
      // Handle brace expansion {a,b}
      // Find closing }
      let j = i + 1;
      // if we support nested, but basic file-patterns usually doesn't.
      // The previous regex implementation `config/file-patterns.ts` used `replace(/\{([^}]+)\}/g` which implies NO nesting support.

      let foundClose = false;
      while (j < len) {
        if (pat[j] === '\\') {
          // Skip escaped chars inside
          j += 2;
          continue;
        }
        if (pat[j] === '}') {
          foundClose = true;
          break;
        }
        j++;
      }

      if (foundClose) {
        const content = pat.substring(i + 1, j);
        // Split by comma (careful of usage of escaped comma?)
        // Previous regex: `group.replace(/,/g, '|')`
        // We should probably safeguard the content?
        // The content might contain other patterns?
        // Previous impl: `file-patterns` supported glob inside braces? Not clearly.
        // It just did literal replacement.
        // Let's assume content is mostly literals or valid inner patterns.
        // For safety and staying close to previous:
        // We'll escape the options but allow `|`

        // Wait, if content is `a,b`, we want `(a|b)`.
        // `a` and `b` should be regex-escaped?
        // Previous impl did NOT escape content inside braces!
        // But previous impl did escape dots globally BEFORE processing braces.
        // So `a.js` inside `{}` became `a\.js`.

        // So recursively processing content might be overkill but correct.
        // Simplified: Split by comma, process each part with THIS FUNCTION's logic?
        // That might recurse infinitely if not careful, but `getCompiledPattern` returns object.
        // We just need the regex string part.

        // Let's just escape the content chars and replace commas with |.
        // But wait, what if content has `*`? `{*.ts,*.js}`.
        // We need to process the globs inside.

        // Actually, the previous logic was:
        // 1. Escape dots
        // 2. Escape **
        // 3. * -> [^/]*
        // 4. ? -> [^/]
        // 5. {a,b} -> (a|b)

        // This implies `{}` replacement happened LAST (after * expansion).
        // Wait, in previous code:
        // `replace(/\./g)`
        // `replace(/\*\*/g)`
        // `replace(/\*/g)`
        // `replace(/@@DOUBLESTAR@@/g)`
        // `replace(/\?/g)`
        // `replace(/\{([^}]+)\}/g)`

        // NOTE: `{}` replacement happened LAST.
        // So `*.{ts,js}` -> `[^/]*\.\{ts,js\}` (Dots escaped, * expanded).
        // Then `{...}` matched. content is `ts,js`. -> `(ts|js)`.
        // Result `[^/]*\.(ts|js)`.

        // If we had `{*.ts,*.js}`:
        // `[^/]*\.ts,[^/]*\.js` inside braces.
        // Replaced `,` with `|`.
        // `([^/]*\.ts|[^/]*\.js)`.

        // So I definitely need to process globs inside braces.
        // My token loop handles `*` linearly.
        // When we hit `{`, we consume until `}`.
        // We must process the content within this block.

        // Since this is getting complex for a single function:
        // I will recurse or just use a shared `compileSegment` function.
        // But wait, `file-patterns.ts` needs to export `getCompiledPattern`.

        // I'll extract the loop body into `processPattern(p: string): string`.

        // Split content by unescaped comma.
        const options: string[] = [];
        let currentOpt = '';
        let k = 0;
        while (k < content.length) {
          if (content[k] === ',' && (k === 0 || content[k - 1] !== '\\')) {
            options.push(currentOpt);
            currentOpt = '';
          } else if (content[k] === '\\' && k + 1 < content.length && content[k + 1] === ',') {
            currentOpt += ','; // Unescape comma
            k++;
          } else {
            currentOpt += content[k];
          }
          k++;
        }
        options.push(currentOpt);

        const processedOptions = options.map((opt) => processGlobString(opt));
        regexPattern += `(${processedOptions.join('|')})`;

        i = j + 1;
        continue;
      }

      regexPattern += '\\{';
      i++;
      continue;
    }

    // Default: escape char
    regexPattern += escapeRegExp(char);
    i++;
  }

  // Remove leading ./ if present (pattern: starts with \.\/)
  // Our parser produces `\.` then `/` (if / is not special) -> `\./`
  // Actually `/` is not escaped by escapeRegExp unless added.
  // escapeRegExp: `[.*+?^${}()|[\]\\]`. / is not in there.
  // So `/` is literal `/`.
  // So `.` -> `\.`. `.` -> `\.`. `/` -> `/`.
  // leading `./` -> `\./`.
  regexPattern = regexPattern.replace(/^\\\.\//, '');

  const regex = new RegExp(`^${regexPattern}$`);
  const compiled = { regex, isPathPattern: isPath };
  PATTERN_CACHE.set(cacheKey, compiled);

  return compiled;
}

function processGlobString(str: string): string {
  let regex = '';
  let i = 0;
  const len = str.length;

  while (i < len) {
    const char = str[i];
    if (char === '\\') {
      if (i + 1 < len) {
        const nextChar = str[i + 1];
        if (['*', '?', '(', ')', '[', ']', '{', '}', '\\'].includes(nextChar)) {
          regex += escapeRegExp(nextChar);
          i += 2;
          continue;
        }
      }
      regex += '\\\\';
      i++;
      continue;
    }
    if (char === '*') {
      if (i + 1 < len && str[i + 1] === '*') {
        regex += '.*';
        i += 2;
      } else {
        regex += '[^/]*';
        i++;
      }
      continue;
    }
    if (char === '?') {
      regex += '[^/]';
      i++;
      continue;
    }
    if (char === '[') {
      let j = i + 1;
      let foundClose = false;
      while (j < len) {
        if (str[j] === ']' && str[j - 1] !== '\\') {
          foundClose = true;
          break;
        }
        j++;
      }
      if (foundClose) {
        regex += str.substring(i, j + 1);
        i = j + 1;
        continue;
      }
      regex += '\\[';
      i++;
      continue;
    }
    // NOTE: We do not handle nested braces in the simple version,
    // effectively flattening braces if they appear inside braces?
    // Or we could recurse.
    // For now, let's assume no nested braces for simplicity/safety to match orig behavior.
    // Orig behavior regex wouldn't match outer braces if inner braces existed?
    // regex `\{([^}]+)\}` matches innermost or first? `[^}]+` implies it stops at FIRST `}`.
    // So `{a,{b,c}}` -> matches `{a,{b,c}` -> content `a,{b,c`.
    // Then split by `,` -> `a`, `{b`, `c`.
    // So `a` | `{b` | `c`.
    // This suggests original didn't support nesting properly either.

    regex += escapeRegExp(char);
    i++;
  }
  return regex;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
