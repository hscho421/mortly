/**
 * Shared design-system primitives for the whole app.
 *
 * These live under `components/admin/primitives/` today because the admin
 * portal was the first surface to need them, but they're not admin-specific
 * — same buttons, badges, cards, dialogs, and tone mappings work for
 * borrower/broker pages. Re-exporting here lets public pages import from
 * `@/components/ui` without either:
 *   - duplicating the components into a parallel tree, or
 *   - being coupled to the admin folder name.
 *
 * If/when these get extracted into a true design-system package, flipping
 * this file to import from that package (instead of the local admin path)
 * is a one-line change.
 */

export {
  ABadge as UBadge,
  ABtn as UBtn,
  ACard as UCard,
  AAvatar as UAvatar,
  ASectionHead as USectionHead,
  ATabs as UTabs,
  FilterChip,
  ASpark as USpark,
  AEmpty as UEmpty,
  ADrawerError as UDrawerError,
  AConfirmDialog as UConfirmDialog,
  toneForUserStatus,
  toneForRole,
  toneForVerification,
  toneForTier,
  toneForRequestStatus,
  toneForConversationStatus,
  toneForReportStatus,
} from "@/components/admin/primitives";

export type {
  ABadgeProps as UBadgeProps,
  ABtnProps as UBtnProps,
  Tone,
  TabItem,
  AConfirmDialogProps as UConfirmDialogProps,
} from "@/components/admin/primitives";

export { default as Banner } from "./Banner";
export type { BannerProps, BannerTone } from "./Banner";
