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

export interface AnnualIncomeByYear {
  [year: string]: string;
}

export interface ResidentialDetails {
  purposeOfUse: string[];
  incomeTypes: string[];
  incomeTypeOther?: string;
  annualIncome: AnnualIncomeByYear;
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
  message: string;
}

// ── Live Activity (Homepage) ────────────────────────────────

export interface LiveRequest {
  key: string;
  mortgageCategory: string;
  productTypes: string[];
  province: string;
  city: string | null;
  status: string;
  createdAt: string;
}

export interface CreateBrokerProfileInput {
  brokerageName: string;
  province: string;
  licenseNumber: string;
  phone: string;
  mortgageCategory?: string;
  bio?: string;
  yearsExperience?: number;
  areasServed?: string;
  specialties?: string;
}
