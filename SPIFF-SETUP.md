# Spiff setup

Spiffs use the same app login and private server-side storage. They are shared only with supervisors selected by the configured administrator. Access grants verify ViciDial levels 7–9 using the read-only Users list. The administrator must be able to view the Users list. If ViciDial does not confirm the account and level, access is refused.

Add the following to the existing service environment file, replacing the username with the initial administrator's exact ViciDial username:

```dotenv
SPIFF_ADMIN=your_vicidial_username
```

Restart `vicidial-qa`. The administrator can then open **Spiffs → Supervisor access → Choose supervisors by name**, select accounts, and save. Level 7–9 is checked when access is granted and rechecked within 60 seconds during use. The administrator must have an active app session for selected supervisor verification; remove access immediately if needed.

Storage defaults to `storage/spiffs/spiffs.json` relative to the app's working directory. Set `QA_SPIFF_DIR` to use another private persistent directory. Back up this directory along with existing payroll/review storage; never commit it to Git. The service account must be able to write it. Single Node service instance only: writes are serialized in-process, not across independent app processes.

## Daily rules

Set the date, agent group, reward category, target counting scope, target, target reward, extra-transfer reward, and step (one or two transfers). A cutoff is required for a before/after-lunch scope and for post-lunch bonuses. Rule times use Eastern wall time matching ViciDial, not the viewer's Philippine clock.

There is one rule per date/group/category. Tiers replace lower rewards: `5:150, 7:250` pays 250 total at seven. Keep Jollibee and transfer rules separate. `Whole day` targets count all valid transfers that day. `After lunch AND daily target` bonuses count only valid transfers after the cutoff and after the whole-day target transfer; this option requires Whole day target counting.

Examples to enter after confirming cutoff times:

- October 9 trainee transfer: whole day target 7, base 200, bonus 50 per 1 above the target. Choose post-lunch bonuses if bonuses must be after lunch.
- October 8 trainee transfer: whole day target 7, base 50, bonus 50 per 1 above the target.
- October 9 experienced Jollibee: before-cutoff target 5, base 150, bonus 0; tiers `5:150, 7:250`.
- Target 12 with base 250 and 50 per 2 extra transfers: at 13 pays 250; 14 pays 300. Scope determines whether 12 is the whole-day or post-lunch target.

First-qualifier rules rank agents within the selected group by the recording timestamp of their target valid transfer. Include every competing agent when calculating. Equal timestamps block calculation until the administrator specifies a winner in the rule. These are recording timestamps, not a separately verified transfer-completion event. A winner override and rule revisions are retained in the audit.

## Weekly calculation and payment

Select Monday; weeks run through Saturday. Assign each agent to New or Experienced. Missing rules are not inferred; no reward is calculated for those dates. Finalize QA reviews before calculating. Only XFER records with a Valid review are included. The server fetches records itself; client-provided totals are not accepted.

Editing daily rules does not automatically change a saved week. Unpaid weeks can be explicitly recalculated using updated rules and QA reviews; the previous calculation is retained in the audit, and eligibility decisions are preserved. Select only the agents to update; unselected agents retain their saved calculations. Once any payment is recorded, the entire week is locked against recalculation. Unauthorized absences are reviewed manually: use Needs review or Disqualified and record a reason. Payments are manually recorded with amount, date, reference, and actor. They do not transfer money. Payments cannot exceed the balance, and paid entries cannot later be disqualified through this screen.

Recording dates and times must already follow the HQ Eastern clock. The UI uses `America/New_York` for current dates and payment dates, accounting for DST. Historical ViciDial wall times are never converted through the browser timezone. Verify the deployment clock and access page format before using the result for payouts.

Weekly generation runs as a background job in the Node/Miniflare service and reports progress through the signed-in session. Reports are fetched sequentially. If the browser disconnects, refresh saved weeks before retrying; a calculation may have completed. Restarting the service ends in-progress jobs but retains completed snapshots and payments.

Security update: current supervisor levels are rechecked within 60 seconds using the active administrator session. If the administrator session is unavailable after expiry or restart, spiff access pauses until the administrator signs in again. See SECURITY-SETUP.md for the verification and HTTPS deployment requirements.

Role verification now reads `/vicidial/admin.php?ADD=0A` and matches the exact username row to its Level column. It does not open or modify the user-edit page; a level-8 administrator who can view the Users list can verify other level-8 accounts. Missing/ambiguous rows and unreadable levels fail closed.

Agent groups: selecting New / trainee or Experienced in the name picker saves a shared profile immediately, with an audit event. Selected manual entries are saved when calculating. Saved calculations keep their original group and earnings; changing a profile affects future calculations only. The daily report reads the saved week for the chosen Eastern date and supports CSV export. Qualifying counts follow the separate rule scopes and are not summed as a single total. Payments remain weekly; daily payable excludes pending review and disqualified agents.

Selected-agent recalculation updates only selected agents in an unpaid week. Other saved agents, their rule snapshots, eligibility, and earnings are retained. Paid weeks remain locked. First-qualifier rules require selecting all saved competitors in the affected group so the winner cannot change silently.

Daily rules are displayed one date at a time in a week calendar. Previous/Next move seven days; the date picker jumps to any date. This limits visible rows without deleting history. Saving a rule displays its date.

Retention: there is no automatic 30-day deletion or automatic backup schedule in this service. The live JSON contains all rules, weeks, payments and audit revisions. Backups are separate copies and do not affect app response size. Keep financial/audit history, archive older closed weeks through a future explicit archive workflow, and paginate server reads as volume grows. Never delete unpaid weeks to improve performance.

Spiff roster and recording calculations fetch at most two reports concurrently. Saved agent names appear immediately; the weekly roster fills progressively and reports incomplete loads. Calculate always fetches fresh QA notes and saves only after all applicable reports succeed. Minimize agents hides the picker without clearing selections.
