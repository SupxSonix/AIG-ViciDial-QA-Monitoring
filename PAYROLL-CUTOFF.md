Payroll workspace and shift-end rules

/payroll contains payslip creation, saved payslips, payroll rules, per-date shift ends and unpaid-break adjustments. /activity shows activity totals and links to Payroll. The Payroll Activity breakdown is collapsed initially. Login timestamps are references; no shift-start restriction is applied. Paid categories remain Talk, Waiting and Wrap-up; Pause is excluded. Lunch shortfall is off for new settings, while previously saved settings remain available.

The default end time is 18:30 Eastern, using the ViciDial report wall clock. Shift end by date allows an override such as 19:00 for a selected date. Blank overrides use the default. These settings are remembered in this browser for any agent, not shared between supervisors' browsers, and copied into saved payslips. Changing settings does not update an existing saved payslip. Reload activity and create a new payslip to use new rules.

Finish current call pays only Talk that began strictly before the cutoff and ends after it. Waiting, new Talk intervals and Wrap-up after the cutoff are excluded. Each day shows last recorded LOGOUT, effective shift end, finish-call extension and excluded paid seconds. Missing logout displays Unavailable rather than inferring a logout from activity.

The timeline is reconstructed from each report row's start timestamp and successive Pause, Wait, Talk and Dispo durations. DEAD overlaps reported time and is not appended. This follows the normal ViciDial activity state sequence; malformed or overlapping upstream rows cannot be certified by this report alone. Invalid or missing timestamps/durations and a truncated day block payroll rather than guessing.

Source references: https://github.com/inktel/Vicidial/blob/master/www/vicidial/user_stats.php and https://github.com/inktel/Vicidial/blob/master/bin/AST_cleanup_agent_log.pl . Saved payslip requests are limited to 8 MB to retain a multi-day timeline without silently discarding evidence.
