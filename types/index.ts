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

export type BrokerWithUser = Broker & { user: Pick<User, "name" | "email"> };

export type IntroductionWithBroker = BrokerIntroduction & {
  broker: BrokerWithUser;
};

export type ConversationWithParticipants = Conversation & {
  broker: BrokerWithUser;
  messages: Message[];
  request: Pick<BorrowerRequest, "id" | "requestType" | "province" | "city">;
};

export type RequestWithIntroductions = BorrowerRequest & {
  introductions: IntroductionWithBroker[];
  _count: { introductions: number };
};

// Form types for creating entities
export interface CreateRequestInput {
  requestType: string;
  province: string;
  city?: string;
  propertyType: string;
  priceRangeMin?: number;
  priceRangeMax?: number;
  downPaymentPercent?: string;
  incomeRangeMin?: number;
  incomeRangeMax?: number;
  employmentType?: string;
  creditScoreBand?: string;
  debtRangeMin?: number;
  debtRangeMax?: number;
  mortgageAmountMin?: number;
  mortgageAmountMax?: number;
  preferredTerm?: string;
  preferredType?: string;
  closingTimeline?: string;
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
  bio?: string;
  yearsExperience?: number;
  areasServed?: string;
  specialties?: string;
}
