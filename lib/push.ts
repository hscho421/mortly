import { Expo, type ExpoPushMessage, type ExpoPushTicket } from "expo-server-sdk";
import prisma from "@/lib/prisma";

const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN,
});

type PushData = Record<string, string | number | boolean | undefined>;

export type PushLocale = "en" | "ko";

type LocalizedString = Record<PushLocale, string>;

export interface LocalizedPush {
  title: LocalizedString;
  body: LocalizedString;
}

interface SendPushOptions {
  userIds: string[];
  content: LocalizedPush;
  data?: PushData;
}

/**
 * Send a localized push notification to one or more users.
 * Each device is delivered in its own stored locale (default ko).
 * Invalid/unregistered tokens are pruned automatically.
 */
export async function sendPushToUsers({
  userIds,
  content,
  data,
}: SendPushOptions) {
  if (userIds.length === 0) return;

  const now = new Date();
  const devices = await prisma.deviceToken.findMany({
    where: {
      userId: { in: userIds },
      pushEnabled: true,
      OR: [{ mutedUntil: null }, { mutedUntil: { lt: now } }],
    },
    select: { id: true, token: true, locale: true },
  });

  if (devices.length === 0) return;

  const messages: ExpoPushMessage[] = [];
  const invalidIds: string[] = [];

  for (const d of devices) {
    if (!Expo.isExpoPushToken(d.token)) {
      invalidIds.push(d.id);
      continue;
    }
    const loc: PushLocale = d.locale === "en" ? "en" : "ko";
    messages.push({
      to: d.token,
      sound: "default",
      title: content.title[loc],
      body: content.body[loc],
      data: data ?? {},
    });
  }

  if (invalidIds.length > 0) {
    await prisma.deviceToken.deleteMany({ where: { id: { in: invalidIds } } });
  }

  if (messages.length === 0) return;

  const chunks = expo.chunkPushNotifications(messages);
  const tickets: ExpoPushTicket[] = [];

  for (const chunk of chunks) {
    try {
      const chunkTickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...chunkTickets);
    } catch (err) {
      console.error("Expo push send error:", err);
    }
  }

  // Prune tokens Expo flags as unregistered in the ticket response
  const tokensToRemove: string[] = [];
  tickets.forEach((ticket, idx) => {
    if (ticket.status === "error") {
      const errType = ticket.details?.error;
      if (errType === "DeviceNotRegistered") {
        const msg = messages[idx];
        if (typeof msg.to === "string") tokensToRemove.push(msg.to);
      }
    }
  });

  if (tokensToRemove.length > 0) {
    await prisma.deviceToken.deleteMany({
      where: { token: { in: tokensToRemove } },
    });
  }
}

// ── Localized push templates ────────────────────────────────

function truncate(s: string, max = 120): string {
  const trimmed = s.trim();
  const chars = Array.from(trimmed);
  return chars.length > max ? `${chars.slice(0, max).join("")}…` : trimmed;
}

/** A new chat message arrived. Title = sender's display name. */
export function messagePush(senderName: string, body: string): LocalizedPush {
  const preview = truncate(body);
  return {
    title: { en: senderName, ko: senderName },
    body: { en: preview, ko: preview },
  };
}

/** A broker reached out to a borrower (first message on a new conversation). */
export function brokerInquiryPush(
  brokerageName: string,
  firstMessage?: string
): LocalizedPush {
  if (firstMessage && firstMessage.trim().length > 0) {
    const preview = truncate(firstMessage);
    return {
      title: { en: brokerageName, ko: brokerageName },
      body: { en: preview, ko: preview },
    };
  }
  return {
    title: {
      en: "New message from a broker",
      ko: "새로운 모기지 전문가 메시지",
    },
    body: {
      en: `${brokerageName} sent you a message about your request.`,
      ko: `${brokerageName}에서 요청에 대해 메시지를 보냈습니다.`,
    },
  };
}

/** A borrower reached out to a broker. */
export function borrowerInquiryPush(borrowerName?: string | null): LocalizedPush {
  if (borrowerName) {
    return {
      title: {
        en: "New client inquiry",
        ko: "신규 고객 문의",
      },
      body: {
        en: `${borrowerName} reached out about a request.`,
        ko: `${borrowerName}님이 요청에 대해 문의했습니다.`,
      },
    };
  }
  return {
    title: {
      en: "New client inquiry",
      ko: "신규 고객 문의",
    },
    body: {
      en: "A client reached out about a request.",
      ko: "고객이 요청에 대해 문의했습니다.",
    },
  };
}
