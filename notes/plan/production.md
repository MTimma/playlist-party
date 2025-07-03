**Security**
   • All score mutations executed server-side (Cloud Function) to prevent tampering.<br/>
    • Continuous OWASP dependency scans via `npm audit --production`, `npm-audit-ci`, or GitHub Dependabot.<br/>
    • Enforce strong Content-Security-Policy (CSP) and `X-Frame-Options: DENY` headers at CDN / reverse-proxy level.<br/>
    • Store Firebase service-account JSON and other secrets in a managed secret store (e.g., Google Secret Manager, AWS Secrets Manager, HashiCorp Vault).<br/>
    • Force HTTPS/TLS for every endpoint (CloudFront, Firebase Hosting, Functions) and redirect plain HTTP to HTTPS.