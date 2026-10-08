# Security hardening deployment

Build and run npm test before restarting vicidial-qa. Source changes require deployment; publishing to GitHub alone does not update the live site.

All private APIs now require the app session; the legacy X-Vici-Authorization header is removed. QA note saves first fetch the authorized agent/date recording list, verify the lead/audio pair, and take the audit baseline from that response. This adds one upstream read per save. Concurrent upstream edits can still occur between the read and write because the legacy endpoint has no conditional-update support.

The page uses a SHA-256 hash of the generated application script in its CSP. Always run npm run build after source changes; do not alter the emitted HTML/script after building. Inline styles remain permitted. Turnstile and the existing browser-phone host remain allowed.

## Cloudflare and Apache

Enable Always Use HTTPS for agent.phdirectory.net at Cloudflare. Review the affected domain's other applications before enabling a zone-wide setting. Keep the existing tunnel/proxy forwarding X-Forwarded-Proto: https from a trusted proxy, and prevent public clients from bypassing that proxy and supplying their own forwarding headers.

The application redirects insecure page GETs to HTTPS and rejects insecure API requests. Local localhost development is exempt. HSTS max-age=31536000 is emitted; it deliberately does not enable includeSubDomains or preload. Enable HSTS at the edge too so Apache error pages and other paths receive the policy. Verify HTTPS for all hostname paths before making any broader HSTS changes.

Do not add an Apache HTTPS redirect based only on its local connection scheme when Cloudflare Tunnel connects over HTTP; this can create redirect loops. If adding an origin redirect, use the trusted forwarded scheme and test both HTTP and HTTPS externally.

Check externally: http://agent.phdirectory.net/qa/ should redirect; HTTPS login and APIs should work. Sign in and check Turnstile, audio playback, a test recording's notes, Listen/Stop, and spiff roles.

## Spiff role verification

Selected accounts' current levels 7–9 are now rechecked with a maximum 60-second cache. To support level-7 supervisors without permission to read the ViciDial user-admin page, this check uses the spiff administrator's active app session held in server memory. The administrator must sign in again after a service restart or session expiry. If no administrator session is available when verification is due, spiff access fails closed with a clear message. No extra password is stored on disk or published.

The configured administrator is checked too. Removing an account from Supervisor access takes effect on the next spiff request; re-saving access clears cached role checks. A ViciDial level downgrade takes effect when the current role cache expires, at most 60 seconds later. This restricts spiff access, not the user's other ViciDial permissions or existing audio calls.

For unattended access without an active administrator, a future trusted role-directory integration is needed. Do not disable the role check to work around this.

## Remaining operational checks

Application fixes do not configure Cloudflare rate limits/WAF, host updates, backup protection, or origin firewall rules. Review those separately. Authentication and note security tests use synthetic records; confirm deployment behavior with authorized test accounts before using production payouts.
