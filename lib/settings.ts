import prisma from "@/lib/prisma";

const DEFAULTS: Record<string, string> = {
  request_expiry_days: "30",
  max_requests_per_user: "5",
  maintenance_mode: "false",
  free_tier_credits: "0",
  basic_tier_credits: "5",
  pro_tier_credits: "20",
};

export async function getSetting(key: string): Promise<string> {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  return row?.value ?? DEFAULTS[key] ?? "";
}

export async function getSettingInt(key: string): Promise<number> {
  const val = await getSetting(key);
  return parseInt(val, 10) || 0;
}

export async function getSettingBool(key: string): Promise<boolean> {
  const val = await getSetting(key);
  return val === "true" || val === "1";
}
