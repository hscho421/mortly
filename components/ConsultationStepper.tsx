import { useTranslation } from "next-i18next";

interface ConsultationStepperProps {
  requestStatus: string;
  hasConversation: boolean;
  hasActiveConversation: boolean;
  conversationClosed: boolean;
}

type StepState = "completed" | "active" | "pending";

function getStepStates(
  requestStatus: string,
  hasConversation: boolean,
  hasActiveConversation: boolean,
  conversationClosed: boolean
): [StepState, StepState, StepState] {
  // Step 3 complete: conversation closed or request closed/expired
  if (conversationClosed || requestStatus === "CLOSED" || requestStatus === "EXPIRED") {
    return ["completed", "completed", "completed"];
  }

  // Step 2 active: broker responded and conversation is active
  if (hasConversation && hasActiveConversation) {
    return ["completed", "active", "pending"];
  }

  // Step 2 active: broker responded but conversation not yet active
  if (hasConversation) {
    return ["completed", "active", "pending"];
  }

  // Step 1 active: pending approval or open but no conversations yet
  return ["active", "pending", "pending"];
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function StepCircle({ state, number }: { state: StepState; number: number }) {
  if (state === "completed") {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-forest-600 text-cream-100 shadow-sm">
        <CheckIcon />
      </div>
    );
  }

  if (state === "active") {
    return (
      <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-forest-600 text-cream-100 shadow-sm">
        <span className="font-display text-sm">{number}</span>
        <span className="absolute -inset-1 animate-pulse rounded-full border-2 border-forest-400/40" />
      </div>
    );
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cream-200 text-sage-400">
      <span className="font-display text-sm">{number}</span>
    </div>
  );
}

function Connector({ completed }: { completed: boolean }) {
  return (
    <div className="hidden sm:block flex-1 h-0.5 mx-2">
      <div className={`h-full rounded-full transition-colors duration-500 ${completed ? "bg-forest-600" : "bg-cream-300"}`} />
    </div>
  );
}

function ConnectorVertical({ completed }: { completed: boolean }) {
  return (
    <div className="sm:hidden flex justify-center">
      <div className={`w-0.5 h-6 rounded-full transition-colors duration-500 ${completed ? "bg-forest-600" : "bg-cream-300"}`} />
    </div>
  );
}

export default function ConsultationStepper({
  requestStatus,
  hasConversation,
  hasActiveConversation,
  conversationClosed,
}: ConsultationStepperProps) {
  const { t } = useTranslation("common");

  // Rejected state: show special banner instead of stepper
  if (requestStatus === "REJECTED") {
    return null;
  }

  const [step1, step2, step3] = getStepStates(
    requestStatus,
    hasConversation,
    hasActiveConversation,
    conversationClosed
  );

  const steps = [
    {
      state: step1,
      label: t("consultation.step1"),
      desc: requestStatus === "PENDING_APPROVAL"
        ? t("consultation.pendingApproval")
        : t("consultation.step1Desc"),
    },
    {
      state: step2,
      label: t("consultation.step2"),
      desc: t("consultation.step2Desc"),
    },
    {
      state: step3,
      label: t("consultation.step3"),
      desc: t("consultation.step3Desc"),
    },
  ];

  return (
    <div className="card-elevated mb-8">
      {/* Desktop: horizontal */}
      <div className="hidden sm:flex items-start">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start flex-1">
            <div className="flex flex-col items-center text-center flex-1">
              <StepCircle state={step.state} number={i + 1} />
              <p className={`mt-3 font-body text-sm font-semibold ${
                step.state === "pending" ? "text-sage-400" : "text-forest-800"
              }`}>
                {step.label}
              </p>
              <p className={`mt-1 font-body text-xs leading-relaxed max-w-[160px] ${
                step.state === "pending" ? "text-sage-300" : "text-sage-500"
              }`}>
                {step.state !== "pending" ? step.desc : ""}
              </p>
            </div>
            {i < steps.length - 1 && (
              <div className="flex items-center pt-5 flex-shrink-0 w-12">
                <Connector completed={step.state === "completed"} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Mobile: vertical */}
      <div className="sm:hidden space-y-0">
        {steps.map((step, i) => (
          <div key={i}>
            <div className="flex items-center gap-4">
              <StepCircle state={step.state} number={i + 1} />
              <div className="flex-1 min-w-0">
                <p className={`font-body text-sm font-semibold ${
                  step.state === "pending" ? "text-sage-400" : "text-forest-800"
                }`}>
                  {step.label}
                </p>
                {step.state !== "pending" && (
                  <p className="font-body text-xs text-sage-500 mt-0.5">
                    {step.desc}
                  </p>
                )}
              </div>
            </div>
            {i < steps.length - 1 && (
              <ConnectorVertical completed={step.state === "completed"} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
