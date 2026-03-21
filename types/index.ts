import type {
  User,
  BorrowerRequest,
  Broker,
  BrokerIntroduction,
  Conversation,
  Message,
  Subscription,
  Report,
} from "@prisma/client";

export type {
  User,
  BorrowerRequest,
  Broker,
  BrokerIntroduction,
  Conversation,
  Message,
  Subscription,
  Report,
};

export type BrokerWithUser = Broker & { user: Pick<User, "publicId" | "name" | "email"> };

export type IntroductionWithBroker = BrokerIntroduction & {
  broker: BrokerWithUser;
};

export type ConversationWithParticipants = Conversation & {
  broker: BrokerWithUser;
  messages: Message[];
  request: Pick<BorrowerRequest, "id" | "province" | "city" | "mortgageCategory" | "productTypes" | "schemaVersion" | "requestType">;
};

export type RequestWithIntroductions = BorrowerRequest & {
  introductions: IntroductionWithBroker[];
  _count: { introductions: number };
};

// ── v2 Request Details ───────────────────────────────────────

export interface ResidentialDetails {
  purposeOfUse: "OWNER_OCCUPIED" | "RENTAL";
  incomeTypes: string[];
  incomeTypeOther?: string;
  annualIncome: string;
}

export interface CommercialDetails {
  businessType: string;
  corporateAnnualIncome: string;
  corporateAnnualExpenses: string;
  ownerNetIncome: string;
}

export type RequestDetails = ResidentialDetails | CommercialDetails;

// ── Form Input Types ─────────────────────────────────────────

export interface CreateRequestInput {
  mortgageCategory: "RESIDENTIAL" | "COMMERCIAL";
  productTypes: string[];
  province: string;
  city?: string;
  details: RequestDetails;
  desiredTimeline?: string;
  notes?: string;
}

export interface CreateIntroductionInput {
  requestId: string;
  howCanHelp: string;
  experience?: string;
  lenderNetwork?: string;
  processNotes?: string;
  personalMessage: string;
  estimatedTimeline?: string;
}

export interface CreateBrokerProfileInput {
  brokerageName: string;
  province: string;
  licenseNumber: string;
  mortgageCategory?: string;
  bio?: string;
  yearsExperience?: number;
  areasServed?: string;
  specialties?: string;
}
