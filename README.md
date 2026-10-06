# AIG - ViciDial QA Monitoring

Fast viewer for MyVici. Load agent and date, browse 50 recordings per page, and play one selected MP3. Audio is never fetched while loading the list. Credentials are verified with ViciDial at sign-in and held only in server memory for an eight-hour session. The browser receives an opaque HttpOnly, SameSite=Strict cookie; no password is saved in browser storage. Refresh restores the session automatically. Sign-out, expiration, or an app restart requires signing in again. HTTPS proxy deployments should forward X-Forwarded-Proto: https and preserve the Host header.

The server retrieves the existing HTML and extracts recording metadata. Initial list loading still depends on the existing PHP endpoint and its database. This viewer fixes the audio preload and browser rendering overhead; it cannot speed up the original database query.

Notes can be edited from each recording row or the audio player. Save uses a background POST to this viewer, which forwards the original form's exact fields to MyVici's `admin/updateQA.php` endpoint. It updates the row in place without refetching the list, audio, or the original page. Drafts are kept when saving fails or the upstream response does not confirm success. Lead administration still opens the original service; teamdesk actions are not recreated.

The local preview uses Node's network stack for upstream requests on Windows and removes compression headers after Node decompresses the body. Production Workers use their own native fetch implementation.

## Development

Requires Node.js 22 or later. Run `npm ci`, `npm run build`, `npm test`, then `npm run dev`. Open http://127.0.0.1:8787 and connect with your MyVici credentials.

The Worker is emitted at `dist/server/index.js`. This source repository does not deploy the website automatically. The local preview binds to 127.0.0.1.

Status filtering (including XFER and TB), earliest/latest time sorting, and daily XFER counts run locally without a list reload. Explicit [QA: valid] or [QA: invalid] labels take priority. In older notes, the whole word valid counts as valid; invalid or not valid takes priority. Counts include all loaded XFER rows and refresh after a confirmed note save.

Review agent loads the agent roster for the selected date from AgentDailyStatusSummary.php with user=QWE. Agents are deduplicated by their recording-link username, with the maximum reported daily XFER total retained for duplicate links. Selecting an agent loads only that agent's recordings. Changing the date refreshes the roster; manual usernames remain available if the summary is unavailable.


Unreviewed XFER only hides transfers with a saved review label. Review next opens the next matching call with the existing audio player. Valid and Invalid buttons add an explicit [QA: valid] or [QA: invalid] label while preserving the notes. Save & Next advances only after a confirmed save. Queue order follows the selected time sort and search. Explicit labels take priority over words in the note body; older notes retain invalid-first classification.

The open recording list checks its source every 120 seconds while the tab is visible. Refresh now checks immediately without reloading the page. Refresh preserves playback, filters, sort and pagination, pauses during note editing/saving, and keeps the last successful list on errors. The daily roster also refreshes. Counts reflect recordings actually available from the recording endpoint; source processing delays cannot be removed. Transfers use blue and unreviewed transfers use amber.

Not sure saves [QA: not sure] for further review, with purple tags and a separate total and filter. Auto/Manual controls scheduled checks; Refresh now works in either mode. Mode defaults to Auto when the page opens.

The agent dropdown shows names only; its roster summary does not supply QA transfer totals. Actual transfer counts remain based on the selected agent recording list. Refresh interval choices are 30 seconds, 1, 2, 5 or 10 minutes, with 2 minutes as the default. Changing the interval restarts the schedule; Manual mode stops it.

Review features:
- Invalid reasons: Wrong transfer, Customer not interested, Disconnected call, Duplicate transfer/recording, or Other. Reasons and optional context are saved in the existing ViciDial note field.
- Selected-agent or all-agent CSV/text reports for the loaded recording date; include all XFER calls or just Invalid/Not sure. Reports include agent name, customer name, lead, notes, reason and recording URL. Links require normal ViciDial access. A report preview and download link remain available. All-agent reports and progress are loaded one agent at a time on demand, without downloading audio. Failed agent requests stop report generation instead of silently producing an incomplete report.
- Team progress uses actual recording lists. The reviewed percentage counts Valid and Invalid; Not sure remains pending.
- Playback speed and skip back/forward 10 seconds use the existing player.
- Refresh mode/interval, filters, sorting, search and playback speed are remembered locally. Credentials and notes are not stored in browser preferences.
- Review history records confirmed changes made through this app only, with reviewer identity, server-observed previous notes and new notes. Direct edits on the original website are not logged. The Node service stores history under storage/review-history (override with QA_HISTORY_DIR). Keep this directory writable by the vicidial-qa service user and include it in backups. It is excluded from Git and is not served by the viewer. History is retained across service restarts; the UI returns the latest 100 events for a call. Workers deployments need a REVIEW_HISTORY service binding. If the audit write fails after ViciDial confirms a save, the app reports that notes saved but history was not stored.

Reporting is available on the separate /reports page (or /qa/reports behind the Apache prefix). Select a report date and any combination of agents, or use Generate individually. Invalid and Not sure are included by default and listed before Valid. Also include Valid adds valid customers and recording URLs; unreviewed calls are excluded from reports. Reports and progress fetch only the selected agents sequentially.
