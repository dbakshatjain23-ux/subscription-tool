# Subscription Hub: Super Admin Guide

This guide explains how a super admin should use Subscription Hub to manage users, teams, subscriptions, renewals, notifications, and reports.

## 1. Super Admin Overview

A super admin has full access to the application. This includes:

- Viewing company-wide dashboard data.
- Creating, editing, and deleting users.
- Creating, editing, and deleting teams.
- Creating, editing, and deleting subscriptions.
- Assigning subscriptions to individual users or to the Organization.
- Viewing admin notifications for important actions across the app.
- Opening the Insights page for detailed reporting.
- Exporting reports as JSON or CSV.
- Printing a detailed report.

Regular users only see the data relevant to them. If a super admin creates a subscription and assigns another user as the owner, that subscription appears on that user's dashboard and behaves as if that user created or owns it.

## 2. Login

1. Open the app login page.
2. Enter the company email and password.
3. Click **Sign in**.

After login, the app opens the main workspace. The sidebar shows the available sections based on the signed-in user's permissions.

## 3. Sidebar Navigation

The sidebar contains the main areas of the app:

- **Dashboard**: Company overview, spend summaries, renewal calendar, and billing mix.
- **Subscriptions**: Full subscription list and subscription management.
- **Teams**: Create and manage teams.
- **Users**: Create and manage user access.
- **Insights**: Detailed reporting, exports, and print-ready summaries.
- **Settings**: Account and profile-related settings.

The sidebar can be collapsed or expanded using the sidebar toggle button. The app preserves the sidebar state while moving between pages.

## 4. Profile Menu

The profile menu appears in the sidebar.

It displays the signed-in user's actual name and email. Click it to open:

- **View profile**
- **Security settings**
- **Sign out**

Profile data is cached on the client so it does not flash back to a temporary user state during normal page navigation.

## 5. Creating Users

Super admins can create users from the dashboard or the Users page.

1. Click **Create user**.
2. A popup opens on the same page.
3. Enter the required user details.
4. Select the correct status.
5. Save the user.

After saving:

- The user appears in the Users list.
- Dashboard user counts update.
- Admin notifications record the action.

Use the Users page to edit or delete users. Deleting users should be done carefully because existing subscriptions may still reference that owner historically.

## 6. Managing Teams

Teams are managed from the **Teams** page.

To create a team:

1. Open **Teams** from the sidebar.
2. Click the create team action.
3. Enter the team name and required details.
4. Save the team.

To update a team:

1. Open the Teams page.
2. Find the team.
3. Use the edit action.
4. Save changes.

To delete a team:

1. Open the Teams page.
2. Find the team.
3. Use the delete action.
4. Confirm using the custom confirmation popup.

Teams appear in the subscription form as a dropdown. Only valid teams should be used for new subscriptions.

## 7. Creating Subscriptions

Subscriptions are created through a popup, not a separate page.

To create a subscription:

1. Open **Dashboard** or **Subscriptions**.
2. Click **Add subscription**.
3. Fill in the subscription details:
   - Subscription name
   - Cost
   - Billing cycle
   - Renewal date
   - Assigned team
   - Owner
   - Status
   - Notes, if needed
4. Click **Save subscription**.

Important rules:

- Currency is shown in rupees across the app.
- Renewal date cannot be in the past.
- Monthly subscriptions renew every month from the selected renewal date until cancelled.
- Yearly subscriptions renew every year from the selected renewal date until cancelled.
- Cancelled or inactive subscriptions should not be treated as active upcoming renewals.

The owner dropdown includes:

- Organization
- Active users

The Organization option is available only to super admins.

## 8. Subscription Ownership Behavior

If a super admin creates a subscription and selects another user as the owner:

- The subscription is visible on that user's dashboard.
- The subscription contributes to that user's spend totals.
- Renewal calendar behavior works the same as if the user owned it directly.
- Super admins can still view and manage it from the admin dashboard and subscriptions list.

If the owner is **Organization**, the subscription is treated as company-owned rather than user-owned.

## 9. Editing and Deleting Subscriptions

Super admins can edit or delete subscriptions from the Subscriptions page.

To edit:

1. Open **Subscriptions**.
2. Find the subscription.
3. Click **Edit**.
4. Update the required fields.
5. Save changes.

To delete:

1. Open **Subscriptions**.
2. Find the subscription.
3. Click **Delete**.
4. Confirm using the custom confirmation popup.

The app does not use browser default confirmation dialogs. It uses custom confirmation blocks and toast notifications.

## 10. Dashboard

The dashboard gives a quick operating view.

For super admins, it includes:

- Total spend.
- Active subscription count.
- Renewal overview.
- User summary.
- Spend by user, including Organization.
- Spend by team.
- Spend by service.
- Renewal calendar.
- Billing mix.

Graph cards are limited to the top three records where needed so the layout remains stable as data grows.

The renewal calendar shows only the next three upcoming renewals to keep the dashboard compact.

For regular users, the dashboard shows user-relevant data and avoids admin-only reporting cards.

## 11. Notifications

Admin notifications record important actions across the app.

Super admins can see action notifications such as:

- User created.
- User updated.
- User deleted.
- Team created.
- Team updated.
- Team deleted.
- Subscription created.
- Subscription updated.
- Subscription deleted.

Notifications are intended for admin visibility. Regular users should not see the full company-wide action feed.

## 12. Insights Page

The Insights page is for deeper reporting than the dashboard.

Use it to review:

- Spend trends.
- Owner-level spend.
- Team-level spend.
- Service-level spend.
- Billing cycle mix.
- Renewal exposure.
- Subscription status summaries.

The page includes report controls for preparing detailed reports.

Available export options:

- **JSON export**: Best for structured backup or technical review.
- **CSV export**: Best for spreadsheets and finance workflows.
- **Print report**: Opens a print-friendly report layout for saving as PDF or printing.

Before exporting, apply the filters and report options you need so the output matches the desired view.

## 13. Toasts and Confirmations

The app uses reusable toast notifications for action feedback.

Examples:

- Subscription created successfully.
- User updated successfully.
- Team deleted successfully.
- Renewal date cannot be in the past.
- Unable to save subscription because required fields are missing.

Delete actions use custom confirmation popups instead of browser confirmation dialogs.

## 14. Common Validation Rules

When saving data, watch for these rules:

- Subscription name is required.
- Cost must be valid.
- Billing cycle must be selected.
- Renewal date is required and cannot be in the past.
- Team must be valid.
- Owner must be valid.
- Status must be selected.
- User email must be valid.
- Team name must be unique enough for internal use.

If a save fails, the app should show a contextual error explaining what needs to be corrected.

## 15. Supabase Setup Notes

Before testing all super admin features, make sure the database migrations are applied in Supabase.

Required migration areas include:

- Base application schema.
- Expanded audit action support.
- Teams schema and policies.

The teams migration is required for:

- Teams page.
- Team dropdown in the subscription form.
- Team-level dashboard and insights reporting.

If teams do not appear in the subscription form, verify that the teams table and policies exist in Supabase.

## 16. Recommended Admin Workflow

For a new company setup:

1. Login as super admin.
2. Create active users.
3. Create teams.
4. Add subscriptions.
5. Assign each subscription to the correct owner and team.
6. Review the dashboard for totals and upcoming renewals.
7. Open Insights for detailed reporting.
8. Export CSV or JSON if the finance or operations team needs a copy.

For ongoing management:

1. Add new subscriptions as they are purchased.
2. Cancel or update subscriptions when ownership, team, or billing changes.
3. Review renewal calendar regularly.
4. Check notifications for admin activity.
5. Use Insights for monthly or quarterly review.

## 17. Troubleshooting

If a subscription fails to save:

- Check that the renewal date is today or a future date.
- Check that the owner is selected.
- Check that the team exists and is selectable.
- Check that the cost is entered correctly.

If a user cannot see a subscription:

- Confirm the subscription owner is that user.
- Confirm the subscription is active.
- Confirm the user profile exists and is active.

If team data is missing:

- Confirm the teams migration was applied.
- Confirm the team is active.
- Refresh the page after creating or updating teams.

If dashboard data looks stale:

- Refresh the page.
- Confirm recent create, edit, or delete actions completed successfully.
- Check whether cached data needs a new fetch after a major data change.

If export output looks incomplete:

- Review the active filters on the Insights page.
- Use JSON export for complete structured detail.
- Use CSV export for spreadsheet-friendly tabular data.
- Use Print report for PDF-style summaries.

## 18. Best Practices

- Keep team names simple and consistent.
- Use Organization ownership only for shared company subscriptions.
- Assign user-owned tools directly to the responsible user.
- Keep renewal dates accurate so the calendar remains useful.
- Prefer editing subscriptions over deleting them unless the record is truly not needed.
- Review Insights before renewals to identify unnecessary spend.
- Keep user access updated when employees join, leave, or change teams.

