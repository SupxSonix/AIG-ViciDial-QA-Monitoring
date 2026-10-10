# App name and ViciDial server configuration

Default header: AIG / Monitoring System. Open the profile avatar → Profile settings to save a name for the signed-in account. This is a personal header preference and persists across PCs using private payslip storage. Other supervisors retain their own preference. APP_NAME in the service environment changes the default for accounts without a saved override.

The ViciDial destination is an administrator-managed service setting, not an editable browser address: credentials and API requests are sent there before sign-in. Profile settings displays the active destination. In the existing private /etc/vicidial-qa.env file, set:

VICIDIAL_ORIGIN=https://your-vicidial-domain.example
APP_NAME=AIG / Monitoring System

Use only the trusted replacement ViciDial HTTPS origin, without a path, query, fragment, or embedded credentials. Restart vicidial-qa after changing it. Existing credentials must be valid on the new server; a restart ends current sessions. The Node outbound destination check and browser recording/lead/report links follow this setting. Missing configuration retains https://myvici.info.

Changing the Monitoring System website domain is separate: DNS, HTTPS proxy/certificate and Cloudflare Turnstile hostname/site settings also need updating. That is not controlled by this profile preference.

This integration assumes the current ViciDial paths, report formats, custom /admin QA pages, and recordings paths exist on the replacement domain. The trusted crm.usa-benefitsgroup.com browser-phone host is configured separately in code and CSP; it does not migrate automatically. A stock ViciDial installation without the custom QA pages is not interchangeable without further work.

Profile names are stored under private QA_PAYSLIP_DIR account preferences/profile.json; include that storage in backups. No passwords are stored in profile settings.

The signed-out page header, intro name and sign-in footer all use APP_NAME from the server environment. Set APP_NAME in /etc/vicidial-qa.env and restart the service to change the public name for all visitors. Personal profile names apply after sign-in; signing out restores the public name.
