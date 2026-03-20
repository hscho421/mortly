import type { NextApiRequest, NextApiResponse } from "next";
import { getSettingBool } from "@/lib/settings";

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  const enabled = await getSettingBool("maintenance_mode");
  return res.status(200).json({ maintenance: enabled });
}
