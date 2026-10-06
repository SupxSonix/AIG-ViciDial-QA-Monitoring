# AIG - ViciDial QA Monitoring

Private Sites viewer for MyVici. Load agent and date, browse 50 recordings per page, and play one selected MP3. Audio is never fetched while loading the list. Credentials are entered by the user and retained only in tab memory, sent via an HTTP header to the server, and forwarded only to `https://myvici.info`. No shared credentials are embedded in source or saved in browser storage.

The server retrieves the existing HTML and extracts recording metadata. Initial list loading still depends on the existing PHP endpoint and its database. This viewer fixes the audio preload and browser rendering overhead; it cannot speed up the original database query.

Notes can be edited from each recording row or the audio player. Save uses a background POST to this viewer, which forwards the original form's exact fields to MyVici's `admin/updateQA.php` endpoint. It updates the row in place without refetching the list, audio, or the original page. Drafts are kept when saving fails or the upstream response does not confirm success. Lead administration still opens the original service; teamdesk actions are not recreated.

The local preview uses Node's network stack for upstream requests on Windows and removes compression headers after Node decompresses the body. Production Workers use their own native fetch implementation.

## Development

Requires Node.js 22 or later. Run `npm ci`, `npm run build`, `npm test`, then `npm run dev`. Open http://127.0.0.1:8787 and connect with your MyVici credentials.

The Worker is emitted at `dist/server/index.js`. This source repository does not deploy the website automatically. The local preview binds to 127.0.0.1.

Status filtering (including XFER and TB), earliest/latest time sorting, and daily XFER counts run locally without a list reload. Notes containing the whole word valid count as valid; invalid or not valid takes priority. Counts include all loaded XFER rows and refresh after a confirmed note save.

Review agent loads the agent roster for the selected date from AgentDailyStatusSummary.php with user=QWE. Agents are deduplicated by their recording-link username, with the maximum reported daily XFER total retained for duplicate links. Selecting an agent loads only that agent's recordings. Changing the date refreshes the roster; manual usernames remain available if the summary is unavailable.

