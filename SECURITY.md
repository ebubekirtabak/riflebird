# Security Policy

## Supported Versions

We actively support the following versions of Riflebird with security updates:

| Version | Supported          | Notes                          |
| ------- | ------------------ | ------------------------------ |
| 1.x     | :white_check_mark: | Active development             |
| < 1.0   | :x:                | Pre-release, not supported     |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

### How to Report

If you discover a security vulnerability in Riflebird, please report it by emailing:

**Email**: ebubekir.tabak@yahoo.com

Please include the following information in your report:

1. **Description**: Clear description of the vulnerability
2. **Impact**: Potential impact of the vulnerability
3. **Steps to Reproduce**: Detailed steps to reproduce the issue
4. **Affected Versions**: Which versions are affected
5. **Proof of Concept**: If available, include PoC code (please be responsible)
6. **Suggested Fix**: If you have suggestions for fixing the issue

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your report within 48 hours
- **Assessment**: We will assess the vulnerability and determine its severity within 5 business days
- **Updates**: We will keep you informed of our progress
- **Fix Timeline**:
  - Critical vulnerabilities: Within 7 days
  - High severity: Within 14 days
  - Medium severity: Within 30 days
  - Low severity: In the next scheduled release
- **Credit**: We will credit you in the security advisory (unless you prefer to remain anonymous)

### Security Update Process

1. Vulnerability is confirmed and assessed
2. Fix is developed and tested
3. Security advisory is prepared
4. Patch is released
5. Security advisory is published

## Security Best Practices for Users

When using Riflebird in your projects:

### API Key Management

1. **Never commit API keys** to version control
2. **Use environment variables** for API keys:
   ```bash
   export OPENAI_API_KEY=your-key-here
   export ANTHROPIC_API_KEY=your-key-here
   ```
3. **Use secret management tools** in CI/CD (GitHub Secrets, Vault, etc.)

### Secret Sanitization

Riflebird includes automatic secret sanitization:

- **Automatic detection**: API keys, tokens, passwords are automatically detected
- **Redaction**: Secrets are redacted before sending to AI providers
- **No configuration needed**: Protection is always active

For more details, see [Secret Sanitization Documentation](./packages/core/src/security/README.md)

### Configuration Security

```typescript
// ✅ CORRECT - Use environment variables
export default defineConfig({
  ai: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
  },
});

// ❌ INCORRECT - Never hardcode API keys
export default defineConfig({
  ai: {
    provider: 'openai',
    apiKey: 'sk-1234567890abcdef', // DON'T DO THIS
  },
});
```

### Dependency Security

- **Keep dependencies updated**: Run `pnpm update` regularly
- **Audit dependencies**: Run `pnpm audit` before deploying
- **Review security advisories**: Check GitHub security tab regularly

### CI/CD Security

- **Use GitHub Secrets** for sensitive data
- **Enable branch protection** on main branches
- **Require PR reviews** before merging
- **Enable Dependabot** for automatic updates

## Security Features

Riflebird includes several security features:

### 1. Secret Detection & Sanitization
- Automatic detection of API keys, tokens, passwords
- Redaction before sending to AI providers
- Support for multiple secret types (OpenAI, AWS, GitHub, etc.)

### 2. Input Validation
- Zod-based schema validation
- Type-safe configuration
- Runtime validation of all inputs

### 3. Secure Defaults
- No secrets in logs
- Secure file permissions
- Minimal privilege principle

### 4. Supply Chain Security
- SBOM (Software Bill of Materials) generation
- Dependency scanning
- License compliance checking

## Known Security Considerations

### AI Provider Communication

- Test data and code are sent to AI providers (OpenAI, Anthropic, etc.)
- Secrets are automatically sanitized before transmission
- No sensitive data is logged
- Review your AI provider's privacy policy

### Local Execution

- Generated tests run in your local environment
- Tests may interact with your application
- Review generated tests before running in production

### Network Access

- Riflebird requires network access to AI providers
- Consider using local AI models for air-gapped environments
- Proxy support available for corporate environments

## Security Scanning

Our codebase is regularly scanned with:

- **CodeQL**: Static analysis for security vulnerabilities
- **Dependabot**: Automated dependency updates
- **npm audit**: Vulnerability scanning
- **Snyk**: Continuous security monitoring (optional)
- **TruffleHog**: Secret scanning

## Compliance

- **Open Source License**: MIT License
- **Third-party Licenses**: All dependencies use permissive licenses
- **SBOM**: Software Bill of Materials available for all releases

## Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [npm Security Best Practices](https://docs.npmjs.com/packages-and-modules/securing-your-code)

## Contact

For non-security related issues, please use [GitHub Issues](https://github.com/ebubekirtabak/riflebird/issues).

For security concerns, email: ebubekirtabak@gmail.com

---

**Last Updated**: December 2025
