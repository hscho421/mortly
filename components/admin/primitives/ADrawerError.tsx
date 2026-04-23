import ABtn from "./ABtn";

/**
 * Error branch for drawer panels (activity/reports/inbox details).
 * Shown when a resource fetch fails — usually a 404 from a deleted/renamed id.
 */
export default function ADrawerError({
  title,
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="p-8 flex flex-col items-center text-center">
      <div className="text-3xl font-display text-error-700">!</div>
      <div className="font-display text-lg font-semibold mt-3 text-forest-800">
        {title ?? "불러올 수 없습니다"}
      </div>
      <div className="font-body text-[13px] text-sage-500 mt-2 max-w-sm leading-relaxed">
        {message}
      </div>
      {onRetry && (
        <div className="mt-5">
          <ABtn size="sm" variant="ghost" onClick={onRetry}>
            다시 시도
          </ABtn>
        </div>
      )}
    </div>
  );
}
