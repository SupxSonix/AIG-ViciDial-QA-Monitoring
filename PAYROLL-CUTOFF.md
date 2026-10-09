Payroll workspace and shift-end rules

/payroll contains payslip creation, saved payslips, payroll rules, per-date shift ends and unpaid-break adjustments. /activity shows activity totals and links to Payroll. The Payroll Activity breakdown is collapsed initially. Login timestamps are references; no shift-start restriction is applied. Paid categories remain Talk, Waiting and Wrap-up; Pause is excluded. Lunch shortfall is off for new settings, while previously saved settings remain available.

The default end time is 18:30 Eastern, using the ViciDial report wall clock. Shift end by date allows an override such as 19:00 for a selected date. Blank overrides use the default. These settings are remembered in this browser for any agent, not shared between supervisors' browsers, and copied into saved payslips. Changing settings does not update an existing saved payslip. Reload activity and create a new payslip to use new rules.

Finish current call pays only Talk that began strictly before the cutoff and ends after it. Waiting, new Talk intervals and Wrap-up after the cutoff are excluded. Each day shows last recorded LOGOUT, effective shift end, finish-call extension and excluded paid seconds. Missing logout displays Unavailable rather than inferring a logout from activity.

The timeline is reconstructed from each report row's start timestamp and successive Pause, Wait, Talk and Dispo durations. DEAD overlaps reported time and is not appended. This follows the normal ViciDial activity state sequence; malformed or overlapping upstream rows cannot be certified by this report alone. Invalid or missing timestamps/durations and a truncated day block payroll rather than guessing.

Source references: https://github.com/inktel/Vicidial/blob/master/www/vicidial/user_stats.php and https://github.com/inktel/Vicidial/blob/master/bin/AST_cleanup_agent_log.pl . Saved payslip requests are limited to 8 MB to retain a multi-day timeline without silently discarding evidence.

## Account column layout

Payroll column order, explicit column visibility, Professional/Breakdown view, and Hide zero-value columns save automatically to the signed-in account using the authenticated payslip storage service. The layout loads when Payroll opens on another PC. Layout changes do not change payroll calculations or save the payslip itself. Each account has its own layout; username casing is normalized for layout preferences. The most recent saved edit wins when multiple PCs edit the same account.

Preferences are stored in a private preferences/payroll-layout.json beneath the account directory under QA_PAYSLIP_DIR (default storage/payslips); include this directory in backups. They do not appear in the saved payslip list. The page reports save/load failures instead of claiming synchronization. Existing browser column order is used until an account layout is available; rearrange a column or toggle visibility once to save it to the account.
