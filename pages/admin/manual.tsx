import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import type { GetStaticProps } from "next";
import Layout from "@/components/Layout";

const SECTION_IDS = [
  "overview",
  "dashboard",
  "user-management",
  "broker-management",
  "broker-detail",
  "verification",
  "request-management",
  "conversations",
  "reports",
  "activity-log",
  "csv-export",
  "bulk-actions",
  "notices",
  "settings",
  "public-ids",
  "audit-trail",
];

interface SectionProps {
  id: string;
  title: string;
  children: React.ReactNode;
}

function Section({ id, title, children }: SectionProps) {
  return (
    <div id={id} className="card-elevated mb-6 scroll-mt-24">
      <h2 className="heading-md mb-4 text-forest-800">{title}</h2>
      {children}
    </div>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 last:mb-0">
      <h3 className="font-body text-sm font-bold text-forest-700 mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 mb-3">
      <p className="font-body text-sm text-amber-800">{children}</p>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 mb-3">
      <p className="font-body text-sm text-rose-800">{children}</p>
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="font-body text-sm text-forest-700/80 mb-2 last:mb-0">{children}</p>;
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-inside space-y-1 mb-2">
      {items.map((item, i) => (
        <li key={i} className="font-body text-sm text-forest-700/80">{item}</li>
      ))}
    </ul>
  );
}

function NavItem({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <a
      href={href}
      className={`block rounded-lg px-3 py-2 font-body text-sm transition-colors ${
        active
          ? "bg-forest-100 text-forest-800 font-semibold"
          : "text-forest-700 hover:bg-cream-100 hover:text-forest-900"
      }`}
    >
      {label}
    </a>
  );
}

export default function AdminManual() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation("common");
  const [activeSection, setActiveSection] = useState("overview");

  const handleScroll = useCallback(() => {
    let current = SECTION_IDS[0];
    for (const id of SECTION_IDS) {
      const el = document.getElementById(id);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= 120) {
          current = id;
        }
      }
    }
    setActiveSection(current);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  if (status === "loading") {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-body-sm">{t("manual.loading", "Loading...")}</p>
        </div>
      </Layout>
    );
  }

  if (!session || session.user.role !== "ADMIN") {
    router.replace("/login", undefined, { locale: router.locale });
    return null;
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <Link
            href="/admin/dashboard"
            className="mb-4 inline-flex items-center gap-1 font-body text-sm font-medium text-forest-600 hover:text-forest-800 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            {t("admin.backToDashboard")}
          </Link>
          <h1 className="heading-lg">{t("manual.title", "Admin Manual")}</h1>
          <p className="text-body mt-2">
            {t("manual.subtitle", "Complete guide to managing the MortgageMatch platform.")}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <nav className="lg:w-64 shrink-0">
            <div className="lg:sticky lg:top-24 card-elevated !p-3 space-y-0.5">
              <p className="px-3 py-2 font-body text-xs font-semibold uppercase tracking-wider text-sage-400">
                {t("manual.tableOfContents", "Table of Contents")}
              </p>
              <NavItem href="#overview" label={t("manual.navOverview", "Overview")} active={activeSection === "overview"} />
              <NavItem href="#dashboard" label={t("manual.navDashboard", "Dashboard")} active={activeSection === "dashboard"} />
              <NavItem href="#user-management" label={t("manual.navUserManagement", "User Management")} active={activeSection === "user-management"} />
              <NavItem href="#broker-management" label={t("manual.navBrokerManagement", "Broker Management")} active={activeSection === "broker-management"} />
              <NavItem href="#broker-detail" label={t("manual.navBrokerDetail", "Broker Detail")} active={activeSection === "broker-detail"} />
              <NavItem href="#verification" label={t("manual.navVerification", "Verification Queue")} active={activeSection === "verification"} />
              <NavItem href="#request-management" label={t("manual.navRequestManagement", "Request Management")} active={activeSection === "request-management"} />
              <NavItem href="#conversations" label={t("manual.navConversations", "Conversation Oversight")} active={activeSection === "conversations"} />
              <NavItem href="#reports" label={t("manual.navReports", "Reports")} active={activeSection === "reports"} />
              <NavItem href="#activity-log" label={t("manual.navActivityLog", "Activity Log")} active={activeSection === "activity-log"} />
              <NavItem href="#csv-export" label={t("manual.navCsvExport", "CSV Export")} active={activeSection === "csv-export"} />
              <NavItem href="#bulk-actions" label={t("manual.navBulkActions", "Bulk Actions")} active={activeSection === "bulk-actions"} />
              <NavItem href="#notices" label={t("manual.navNotices", "Admin Notices")} active={activeSection === "notices"} />
              <NavItem href="#settings" label={t("manual.navSettings", "System Settings")} active={activeSection === "settings"} />
              <NavItem href="#public-ids" label={t("manual.navPublicIds", "Public User IDs")} active={activeSection === "public-ids"} />
              <NavItem href="#audit-trail" label={t("manual.navAuditTrail", "Audit Trail")} active={activeSection === "audit-trail"} />
            </div>
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Overview */}
            <Section id="overview" title={t("manual.overviewTitle", "Overview")}>
              <P>{t("manual.overviewP1", "The admin portal gives you full control over the MortgageMatch platform. From here you can manage users, verify brokers, oversee requests and conversations, handle reports, and review a complete audit trail of all administrative actions.")}</P>
              <P>{t("manual.overviewP2", "All admin pages use client-side filtering — data is loaded once when the page opens, and search/filter changes are instant without reloading. Every action you take (status changes, credit adjustments, verifications, deletions) is automatically logged to the activity log.")}</P>
              <Tip>{t("manual.overviewTip", "Tip: All admin pages are accessible from the dashboard quick links. You can also navigate directly via the URL bar (e.g., /admin/users, /admin/requests).")}</Tip>
            </Section>

            {/* Dashboard */}
            <Section id="dashboard" title={t("manual.dashboardTitle", "Dashboard")}>
              <P>{t("manual.dashboardP1", "The dashboard (/admin/dashboard) is your landing page. It shows six live statistics:")}</P>
              <BulletList items={[
                t("manual.dashboardStat1", "Total Users — all registered accounts on the platform"),
                t("manual.dashboardStat2", "Pending Verifications — brokers waiting for license verification"),
                t("manual.dashboardStat3", "Active Requests — borrower requests currently open or in progress"),
                t("manual.dashboardStat4", "Open Reports — user-submitted reports that need attention"),
                t("manual.dashboardStat5", "Active Conversations — ongoing borrower-broker conversations"),
                t("manual.dashboardStat6", "Total Requests — all borrower requests ever created"),
              ]} />
              <P>{t("manual.dashboardP2", "Below the stats, quick link cards take you directly to each admin tool. Each card shows a live count so you can prioritize where to look first.")}</P>

              <SubSection title={t("manual.trendsTitle", "30-Day Trends Chart")}>
                <P>{t("manual.trendsP1", "The dashboard includes a 30-day trends chart showing daily counts of new users, requests, and conversations as a stacked bar chart.")}</P>
                <BulletList items={[
                  t("manual.trend1", "Hover over any bar to see exact counts for that date"),
                  t("manual.trend2", "The chart updates automatically when the dashboard loads"),
                  t("manual.trend3", "Date labels show in Korean format when viewing in Korean language"),
                ]} />
              </SubSection>
            </Section>

            {/* User Management */}
            <Section id="user-management" title={t("manual.userManagementTitle", "User Management")}>
              <P>{t("manual.userManagementP1", "The user management page (/admin/users) shows every account on the platform — borrowers, brokers, and other admins.")}</P>

              <SubSection title={t("manual.searchAndFilter", "Search & Filter")}>
                <BulletList items={[
                  t("manual.userSearch1", "Search by name, email, or 9-digit public user ID"),
                  t("manual.userSearch2", "Filter by role: All, Borrowers, Brokers, Admins"),
                  t("manual.userSearch3", "Results update instantly as you type — no need to press Enter"),
                ]} />
              </SubSection>

              <SubSection title={t("manual.userTableColumns", "Table Columns")}>
                <BulletList items={[
                  t("manual.userCol1", "User — name and email address"),
                  t("manual.userCol2", "User ID — the 9-digit public ID (click to copy to clipboard)"),
                  t("manual.userCol3", "Role — BORROWER, BROKER, or ADMIN badge"),
                  t("manual.userCol4", "Status — ACTIVE, SUSPENDED, or BANNED badge"),
                  t("manual.userCol5", "Details — for brokers: brokerage name, subscription tier, and credit count. For borrowers: request and conversation counts"),
                  t("manual.userCol6", "Joined — account creation date"),
                  t("manual.userCol7", "Actions — available actions based on the user's current state"),
                ]} />
              </SubSection>

              <SubSection title={t("manual.accountActions", "Account Actions")}>
                <P>{t("manual.accountActionsP1", "You can change a user's account status. These actions are available for non-admin users only (you cannot suspend or ban other admins):")}</P>
                <BulletList items={[
                  t("manual.accountAction1", "Suspend — temporarily restricts login. The user sees a 'suspended' message when trying to sign in. Use for warnings or investigations."),
                  t("manual.accountAction2", "Ban — permanently blocks the account. The user sees a 'banned' message. Use for confirmed policy violations."),
                  t("manual.accountAction3", "Reactivate — restores a suspended or banned account back to active status."),
                ]} />
                <Warning>{t("manual.accountActionsWarning", "Warning: Suspending or banning a user takes effect immediately. They will be blocked on their next login attempt.")}</Warning>
              </SubSection>

              <SubSection title={t("manual.creditAdjustments", "Credit Adjustments")}>
                <P>{t("manual.creditAdjP1", "For broker accounts, a 'Credits' button opens a modal where you can add or remove response credits:")}</P>
                <BulletList items={[
                  t("manual.creditAdj1", "Enter a positive number to add credits (e.g., 5)"),
                  t("manual.creditAdj2", "Enter a negative number to remove credits (e.g., -3)"),
                  t("manual.creditAdj3", "Always provide a reason (e.g., 'Refund for spam request', 'Promotional bonus')"),
                  t("manual.creditAdj4", "The new balance is shown immediately after confirmation"),
                ]} />
                <Tip>{t("manual.creditAdjTip", "Tip: Credit adjustments are logged in the activity log with the amount, previous balance, new balance, and your reason.")}</Tip>
              </SubSection>
            </Section>

            {/* Broker Management */}
            <Section id="broker-management" title={t("manual.brokerManagementTitle", "Broker Management")}>
              <P>{t("manual.brokerManagementP1", "The broker management page (/admin/brokers) lists all broker profiles with their key information at a glance.")}</P>

              <SubSection title={t("manual.brokerListColumns", "Table Columns")}>
                <BulletList items={[
                  t("manual.brokerCol1", "Name — the broker's display name"),
                  t("manual.brokerCol2", "Brokerage — the brokerage company name"),
                  t("manual.brokerCol3", "Province — where the broker is licensed"),
                  t("manual.brokerCol4", "License # — the broker's license number"),
                  t("manual.brokerCol5", "Status — verification status: PENDING, VERIFIED, or REJECTED"),
                  t("manual.brokerCol6", "Tier — subscription tier: FREE, BASIC, PRO, or PREMIUM"),
                  t("manual.brokerCol7", "Rating — average borrower rating (or -- if no reviews)"),
                  t("manual.brokerCol8", "Actions — View (opens detail page), Verify, or Suspend buttons"),
                ]} />
              </SubSection>

              <SubSection title={t("manual.brokerQuickActions", "Quick Actions from the List")}>
                <BulletList items={[
                  t("manual.brokerAction1", "View — opens the full broker detail page"),
                  t("manual.brokerAction2", "Verify — instantly approves a pending broker (one click)"),
                  t("manual.brokerAction3", "Suspend — rejects a broker's verification (they can no longer view requests or send introductions)"),
                ]} />
              </SubSection>

              <P>{t("manual.brokerFilterP1", "Use the status filter dropdown to narrow the list to only PENDING, VERIFIED, or REJECTED brokers.")}</P>
            </Section>

            {/* Broker Detail */}
            <Section id="broker-detail" title={t("manual.brokerDetailTitle", "Broker Detail Page")}>
              <P>{t("manual.brokerDetailP1", "Clicking 'View' on any broker (from the broker list or user management page) opens a comprehensive detail page (/admin/brokers/[id]).")}</P>

              <SubSection title={t("manual.brokerDetailSections", "Page Sections")}>
                <BulletList items={[
                  t("manual.brokerSection1", "Header — broker name, public user ID, verification badge, subscription tier badge, account status badge"),
                  t("manual.brokerSection2", "Profile Info — brokerage, email, license number, province, mortgage category, experience, areas served, specialties, member since, bio"),
                  t("manual.brokerSection3", "Stats Cards — credits remaining, total introductions, total conversations, average rating with review count"),
                  t("manual.brokerSection4", "Verification Actions — Approve, Reject, or Reset to Pending buttons (changes take effect immediately)"),
                  t("manual.brokerSection5", "Recent Introductions — last 20 introductions with request type, location, status, and date. Click 'View' to go to request management."),
                  t("manual.brokerSection6", "Recent Conversations — last 20 conversations with borrower name, status, message count, and last activity. Click 'Messages' to view the thread."),
                  t("manual.brokerSection7", "Reviews — all reviews with star ratings, borrower names, dates, and comments"),
                  t("manual.brokerSection8", "Credit Purchases — purchase history showing pack type, credit count, amount paid, and date"),
                ]} />
              </SubSection>
            </Section>

            {/* Verification Queue */}
            <Section id="verification" title={t("manual.verificationTitle", "Verification Queue")}>
              <P>{t("manual.verificationP1", "The verification queue (/admin/verification) shows brokers awaiting license verification. This is a focused view — it only shows PENDING brokers.")}</P>
              <P>{t("manual.verificationP2", "For each broker you can approve or reject. Approved brokers can immediately start viewing requests and sending introductions (depending on their subscription tier). Rejected brokers are blocked from these features.")}</P>
              <Tip>{t("manual.verificationTip", "Tip: You can also verify brokers from the broker management list or from the broker detail page. All three methods are equivalent.")}</Tip>
            </Section>

            {/* Request Management */}
            <Section id="request-management" title={t("manual.requestManagementTitle", "Request Management")}>
              <P>{t("manual.requestManagementP1", "The request management page (/admin/requests) gives you oversight of all borrower mortgage requests on the platform.")}</P>

              <SubSection title={t("manual.requestSearchFilter", "Search & Filter")}>
                <BulletList items={[
                  t("manual.requestSearch1", "Search by request ID, borrower name, province, or city"),
                  t("manual.requestSearch2", "Filter by status: Open, In Progress, Closed, Expired"),
                  t("manual.requestSearch3", "Filter by type: Purchase, Refinance, Renewal"),
                ]} />
              </SubSection>

              <SubSection title={t("manual.requestActions", "Available Actions")}>
                <BulletList items={[
                  t("manual.requestAction1", "Details — opens a modal showing the full request information: borrower, property type, price range, mortgage amount, employment type, credit score band, closing timeline, and notes"),
                  t("manual.requestAction2", "Status — opens a modal to change the request status. You must select a new status and can optionally provide a reason. When closing a request, all active conversations are automatically closed too."),
                  t("manual.requestAction3", "Delete — permanently removes the request and ALL related data: introductions, conversations, messages, and reviews. This cannot be undone."),
                ]} />
                <Warning>{t("manual.requestDeleteWarning", "Warning: Deleting a request is irreversible. All associated introductions, conversations, messages, and reviews will be permanently removed. Always provide a reason for the audit trail.")}</Warning>
              </SubSection>
            </Section>

            {/* Conversations */}
            <Section id="conversations" title={t("manual.conversationsTitle", "Conversation Oversight")}>
              <P>{t("manual.conversationsP1", "The conversation oversight page (/admin/conversations) lets you monitor all borrower-broker messaging on the platform.")}</P>

              <SubSection title={t("manual.conversationList", "Conversation List")}>
                <BulletList items={[
                  t("manual.convoList1", "Search by participant name, email, or brokerage name"),
                  t("manual.convoList2", "Filter by status: Active or Closed"),
                  t("manual.convoList3", "Each row shows: participants (with account status badges if suspended/banned), related request info, message count, last message preview, and review rating if exists"),
                ]} />
              </SubSection>

              <SubSection title={t("manual.conversationDetail", "Viewing a Conversation")}>
                <P>{t("manual.convoDetailP1", "Click 'Messages' to open the full conversation thread (/admin/conversations/[id]). Here you can see:")}</P>
                <BulletList items={[
                  t("manual.convoDetail1", "Every message with sender name, role badge (Borrower/Broker/Admin), and timestamp"),
                  t("manual.convoDetail2", "Admin closure messages are highlighted with an amber border"),
                  t("manual.convoDetail3", "Conversation info card showing borrower, broker, request details, and status"),
                  t("manual.convoDetail4", "If a review was left, it shows the star rating and comment"),
                ]} />
              </SubSection>

              <SubSection title={t("manual.closingConversation", "Closing a Conversation")}>
                <P>{t("manual.closingConvoP1", "You can close any active conversation by clicking the 'Close' button. You must provide a reason (e.g., 'Abusive language', 'Spam'). When you close a conversation:")}</P>
                <BulletList items={[
                  t("manual.closingConvo1", "An admin message is automatically sent to the conversation with the closure reason"),
                  t("manual.closingConvo2", "The conversation status changes to CLOSED"),
                  t("manual.closingConvo3", "Both the borrower and broker can no longer send messages"),
                  t("manual.closingConvo4", "The action is logged in the activity log"),
                ]} />
              </SubSection>
            </Section>

            {/* Reports */}
            <Section id="reports" title={t("manual.reportsTitle", "Reports")}>
              <P>{t("manual.reportsP1", "The reports page (/admin/reports) shows all user-submitted reports. Users can report brokers, requests, or conversations for policy violations.")}</P>

              <SubSection title={t("manual.reportSearchFilter", "Search & Filter")}>
                <BulletList items={[
                  t("manual.reportSearch1", "Search by reporter name, reason text, or target ID"),
                  t("manual.reportSearch2", "Filter by status: Open, Reviewed, Resolved, Dismissed"),
                  t("manual.reportSearch3", "Filter by target type: Broker, Request, Conversation"),
                ]} />
              </SubSection>

              <SubSection title={t("manual.reportWorkflow", "Report Workflow")}>
                <P>{t("manual.reportWorkflowP1", "Each report has a status lifecycle:")}</P>
                <BulletList items={[
                  t("manual.reportStatus1", "OPEN — newly submitted, needs investigation"),
                  t("manual.reportStatus2", "REVIEWED — you've looked at it but haven't made a decision yet"),
                  t("manual.reportStatus3", "RESOLVED — action was taken (e.g., broker suspended, content removed)"),
                  t("manual.reportStatus4", "DISMISSED — investigated but no action needed (false report, duplicate, etc.)"),
                ]} />
              </SubSection>

              <SubSection title={t("manual.reportActions", "Available Actions")}>
                <BulletList items={[
                  t("manual.reportAction1", "View Target — click the target badge (Broker/Request/Conversation) to navigate to the relevant admin page for investigation"),
                  t("manual.reportAction2", "Add/Edit Notes — open the notes modal to record your investigation findings, resolution details, or follow-up actions. You can also change the report status from this modal."),
                  t("manual.reportAction3", "Resolve — marks the report as resolved and records the resolution timestamp"),
                  t("manual.reportAction4", "Dismiss — marks the report as dismissed (no action taken)"),
                  t("manual.reportAction5", "Reopen — changes a resolved or dismissed report back to OPEN status for re-investigation"),
                ]} />
                <Tip>{t("manual.reportTip", "Tip: Always add notes before resolving or dismissing a report. Notes help other admins understand what was investigated and why the decision was made.")}</Tip>
              </SubSection>
            </Section>

            {/* Activity Log */}
            <Section id="activity-log" title={t("manual.activityLogTitle", "Activity Log")}>
              <P>{t("manual.activityLogP1", "The activity log (/admin/activity) is a complete audit trail of every admin action taken on the platform. Every status change, credit adjustment, verification, deletion, and conversation closure is recorded here.")}</P>

              <SubSection title={t("manual.activityActions", "Tracked Action Types")}>
                <BulletList items={[
                  t("manual.action1", "CREDIT_ADJUST — broker credit adjustments with amount and reason"),
                  t("manual.action2", "SUSPEND_USER — user account suspensions"),
                  t("manual.action3", "BAN_USER — user account bans"),
                  t("manual.action4", "REACTIVATE_USER — account reactivations"),
                  t("manual.action5", "VERIFY_BROKER — broker verification approvals"),
                  t("manual.action6", "REJECT_BROKER — broker verification rejections"),
                  t("manual.action7", "CLOSE_REQUEST — borrower request closures"),
                  t("manual.action8", "REOPEN_REQUEST — request reopenings"),
                  t("manual.action9", "UPDATE_REQUEST_STATUS — request status changes"),
                  t("manual.action10", "DELETE_REQUEST — request deletions (irreversible)"),
                  t("manual.action11", "CLOSE_CONVERSATION — conversation closures"),
                  t("manual.action12", "RESOLVE_REPORT — report resolutions"),
                  t("manual.action13", "DISMISS_REPORT — report dismissals"),
                  t("manual.action14", "UPDATE_REPORT — report note/status updates"),
                  t("manual.action15", "SEND_NOTICE — admin notice sent to a user"),
                  t("manual.action16", "UPDATE_SETTINGS — system settings changes"),
                ]} />
              </SubSection>

              <SubSection title={t("manual.activityDetails", "Action Details")}>
                <P>{t("manual.activityDetailsP1", "Each log entry shows: the admin who performed the action, the action type, the target (user, broker, request, etc.), a timestamp, and detailed information specific to the action type (e.g., previous/new balance for credit adjustments, previous/new status for status changes).")}</P>
              </SubSection>

              <P>{t("manual.activityFilterP1", "Use the filter dropdown to narrow the log to specific action types. This is useful for auditing specific categories of actions (e.g., all credit adjustments, all bans).")}</P>
            </Section>

            {/* CSV Export */}
            <Section id="csv-export" title={t("manual.csvExportTitle", "CSV Export")}>
              <P>{t("manual.csvExportP1", "Several admin pages include a CSV export button that lets you download the current data as a spreadsheet-compatible file.")}</P>

              <SubSection title={t("manual.csvExportPages", "Pages with CSV Export")}>
                <BulletList items={[
                  t("manual.csvExportPage1", "User Management — exports all users with name, email, public ID, role, status, and join date"),
                  t("manual.csvExportPage2", "Reports — exports all reports with reporter, target, reason, status, and dates"),
                  t("manual.csvExportPage3", "Activity Log — exports all admin actions with admin name, action type, target, details, and timestamp"),
                ]} />
              </SubSection>

              <SubSection title={t("manual.csvExportNotes", "Notes")}>
                <BulletList items={[
                  t("manual.csvExportNote1", "The exported file includes all data, not just the currently filtered view"),
                  t("manual.csvExportNote2", "Files are named with the current date (e.g., users_2025-01-15.csv)"),
                  t("manual.csvExportNote3", "CSV files include a BOM header for proper Excel encoding of special characters and Korean text"),
                ]} />
              </SubSection>
            </Section>

            {/* Bulk Actions */}
            <Section id="bulk-actions" title={t("manual.bulkActionsTitle", "Bulk Actions")}>
              <P>{t("manual.bulkActionsP1", "The user management page supports bulk actions, allowing you to apply status changes to multiple users at once.")}</P>

              <SubSection title={t("manual.bulkActionsHow", "How to Use")}>
                <BulletList items={[
                  t("manual.bulkHow1", "Use the checkboxes in the leftmost column to select individual users"),
                  t("manual.bulkHow2", "Use the header checkbox to select or deselect all visible users"),
                  t("manual.bulkHow3", "A bulk action bar appears at the top when users are selected, showing the count"),
                  t("manual.bulkHow4", "Choose an action: Suspend All, Ban All, or Reactivate All"),
                  t("manual.bulkHow5", "Click 'Clear' to deselect all users"),
                ]} />
              </SubSection>

              <Warning>{t("manual.bulkActionsWarning", "Warning: Bulk actions apply immediately to all selected users. Admin accounts are excluded from selection. Each individual status change is logged separately in the activity log.")}</Warning>
            </Section>

            {/* Admin Notices */}
            <Section id="notices" title={t("manual.noticesTitle", "Admin Notices")}>
              <P>{t("manual.noticesP1", "Admins can send notices directly to individual users. Notices appear as a bell notification in the user's navigation bar.")}</P>

              <SubSection title={t("manual.noticesSending", "Sending a Notice")}>
                <BulletList items={[
                  t("manual.noticeSend1", "On the user management page, click the 'Notice' button in any non-admin user's action column"),
                  t("manual.noticeSend2", "Enter a subject line and message body in the modal"),
                  t("manual.noticeSend3", "Click 'Send Notice' to deliver the notification"),
                  t("manual.noticeSend4", "The action is logged in the activity log as SEND_NOTICE"),
                ]} />
              </SubSection>

              <SubSection title={t("manual.noticesReceiving", "How Users See Notices")}>
                <BulletList items={[
                  t("manual.noticeReceive1", "A bell icon with a red badge appears in the navigation bar showing unread count"),
                  t("manual.noticeReceive2", "Clicking the bell opens a dropdown with all notices, newest first"),
                  t("manual.noticeReceive3", "Unread notices show a blue dot indicator"),
                  t("manual.noticeReceive4", "Clicking a notice marks it as read"),
                ]} />
              </SubSection>

              <Tip>{t("manual.noticesTip", "Tip: Use notices for account warnings, policy reminders, or important platform announcements targeted at specific users.")}</Tip>
            </Section>

            {/* System Settings */}
            <Section id="settings" title={t("manual.settingsTitle", "System Settings")}>
              <P>{t("manual.settingsP1", "The settings page (/admin/settings) allows you to configure platform-wide values without code changes. Changes are saved to the database and logged in the activity log.")}</P>

              <SubSection title={t("manual.settingsAvailable", "Available Settings")}>
                <BulletList items={[
                  t("manual.setting1", "Platform Name — the display name of the platform"),
                  t("manual.setting2", "Support Email — the contact email shown to users"),
                  t("manual.setting3", "Free / Basic / Pro / Premium Tier Credits — default monthly credits for each subscription tier"),
                  t("manual.setting4", "Max Requests Per User — maximum number of active requests a borrower can have"),
                  t("manual.setting5", "Request Expiry Days — number of days before an open request expires automatically"),
                  t("manual.setting6", "Maintenance Mode — toggle to enable/disable a maintenance mode flag"),
                ]} />
              </SubSection>

              <SubSection title={t("manual.settingsNotes", "Notes")}>
                <BulletList items={[
                  t("manual.settingsNote1", "Changes are tracked as drafts until you click 'Save Changes'"),
                  t("manual.settingsNote2", "Only modified values are saved — unchanged settings are not rewritten"),
                  t("manual.settingsNote3", "All setting changes are logged as UPDATE_SETTINGS in the activity log"),
                ]} />
              </SubSection>

              <Warning>{t("manual.settingsWarning", "Warning: Settings changes take effect immediately. Changing tier credits affects future billing cycles, not retroactively.")}</Warning>
            </Section>

            {/* Public User IDs */}
            <Section id="public-ids" title={t("manual.publicIdsTitle", "Public User IDs")}>
              <P>{t("manual.publicIdsP1", "Every user on the platform has a unique 9-digit public ID (e.g., 482913756). This ID is shown to users on their profile page and to admins in the user management table.")}</P>
              <BulletList items={[
                t("manual.publicId1", "Users see their ID on their profile/settings page with a note to use it when contacting support"),
                t("manual.publicId2", "Admins can search by public ID in the user management page"),
                t("manual.publicId3", "The public ID is displayed on the broker detail page for quick reference"),
                t("manual.publicId4", "Click any public ID in the admin table to copy it to your clipboard"),
              ]} />
              <P>{t("manual.publicIdsP2", "Internal database IDs (CUIDs) are never shown to users. When a user contacts support, ask for their 9-digit user ID to quickly locate their account.")}</P>
            </Section>

            {/* Audit Trail */}
            <Section id="audit-trail" title={t("manual.auditTrailTitle", "Audit Trail & Best Practices")}>
              <P>{t("manual.auditTrailP1", "Every admin action is automatically logged. You don't need to do anything — the system records who did what, when, and why.")}</P>

              <SubSection title={t("manual.bestPractices", "Best Practices")}>
                <BulletList items={[
                  t("manual.bestPractice1", "Always provide a reason when suspending, banning, or adjusting credits — the reason is saved in the audit trail"),
                  t("manual.bestPractice2", "Add notes to reports before resolving or dismissing — this helps other admins understand your decision"),
                  t("manual.bestPractice3", "Use 'Suspend' as a first step for investigations, 'Ban' only for confirmed violations"),
                  t("manual.bestPractice4", "Check the activity log regularly to stay aware of actions taken by other admins"),
                  t("manual.bestPractice5", "When closing a conversation, provide a clear reason — it's sent as a message visible to both parties"),
                  t("manual.bestPractice6", "Before deleting a request, verify it's truly spam/fraud — deletion is permanent and removes all associated data"),
                  t("manual.bestPractice7", "Verify broker licenses carefully — approved brokers immediately gain access to borrower requests"),
                ]} />
              </SubSection>
            </Section>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common"])),
  },
});
