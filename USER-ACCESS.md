# Super Admin and regular user access

The app continues using ViciDial authentication. Super Admin grants **app access** to existing ViciDial usernames; this does not create a ViciDial account or change its upstream permissions.

## Enable on the Node service

In `/etc/vicidial-qa.env`, set:

```dotenv
SUPER_ADMIN=JasonS
SPIFF_ADMIN=JasonS
```

The updated `preview.mjs` provides private access storage automatically. It uses `SUPER_ADMIN`, falling back to the existing `SPIFF_ADMIN` when `SUPER_ADMIN` is absent. Usernames are matched without case sensitivity. If both settings are absent, the old access behavior remains until an administrator is configured. With access enabled, missing or unreadable access storage denies protected API access.

Build and test before restarting:

```bash
cd /var/www/vicidial-qa
npm run build
npm test
sudo systemctl restart vicidial-qa
```

Sign in as `JasonS`, open the account menu, then **User access**. Add a ViciDial username, select sections, and save. All other ViciDial accounts are denied app login until explicitly enabled here. Before enabling this feature, plan to add the supervisors who currently use the app; their prior Spiff selection alone does not grant app access.

The configured Super Admin has every app section and action. Its identity is controlled by the service environment, cannot be reassigned through an API or the editor, and cannot be disabled through the UI. To change ownership, edit `SUPER_ADMIN` and restart the service. Preserve `SPIFF_ADMIN` for older deployments; when `SUPER_ADMIN` is configured it is also the Spiff owner.

## Permissions

Regular users can be granted Recordings, Live agents, Payroll, Agent activity, Reports, Team QA, and Spiffs independently. Recordings, Reports, or Team QA is required to grant Edit QA notes or Create manager review links. Without Edit QA notes, recording notes remain readable but cannot be changed. Manager-link-only users can open the review-link tools with read-only notes.

Section access includes that section's existing actions, such as payroll saving/exporting and live monitoring. Spiffs includes financial record editing, rules and calculations; it still requires a verified ViciDial level 7–9 account, and the Super Admin must be able to read the ViciDial Users list. Regular users cannot change Spiff supervisor access. App permissions are not agent-level restrictions: allowed sections can access the agents that the account's ViciDial credentials already permit.

Menus hide unavailable sections. Navigating to a disallowed page redirects to the first allowed section. Backend permissions are reloaded from private storage for every protected API request; manually calling an API does not bypass access restrictions. Saving any permission change revokes that user's current sessions, so the next login uses the new access. A request that has already been authorized and sent upstream may finish; access changes do not cancel in-flight operations or remove previously viewed/downloaded data.

Single-use manager review pages remain public to holders of their valid bearer links. Disabling an app user does not revoke previously shared links; links retain their existing expiry and revocation controls.

## Storage and Workers

Access is stored at `storage/access/users.json` relative to the service working directory, with private directory/file modes. Override the directory with `QA_ACCESS_DIR`. Back it up along with other app storage. User changes retain actor, timestamp, and before/after audit entries. No passwords are stored in this file. Writes are serialized and use atomic rename; run a single Node service instance against this directory.

A Workers deployment must explicitly set `SUPER_ADMIN` and provide an `APP_ACCESS` service binding implementing `access-storage.mjs`'s trusted service interface. Do not expose that private service on a public route. The app supplies trusted `X-Actor` and `X-Super-Admin` headers from its verified session and server configuration, never from incoming client headers. The Spiff service accepts `X-App-Spiff-Access` only from this internal interface; the public Worker overwrites it after verifying app access.

Run `node access-test.mjs` after `npm run build` for focused checks: owner bootstrap, disabled/unlisted login denial, per-user routes, session revocation, no escalation, persistence, audit, concurrent writes, and storage failures.

## Active ViciDial user picker

Opening User access loads the active account directory from `/vicidial/admin.php?ADD=0A`, using the signed-in Super Admin’s ViciDial credentials. The endpoint is Super Admin only. It reads the explicit ACTIVE column, includes only Y, and excludes the configured owner. All account levels can be selected; granting app access does not bypass upstream account permissions or the separate Spiff level check. Active means enabled, not currently logged in.

Search by name or username, select a user, choose permissions and Save access. Existing app users open in edit mode. Refresh ViciDial users reloads the directory; New user resets to a fresh entry, clears the selection and search, and focuses the username field with visible feedback. Manual usernames remain available when the directory cannot be read. Loading or selecting a directory user does not grant access automatically.
