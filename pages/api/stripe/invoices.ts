import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== "BROKER") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const broker = await prisma.broker.findUnique({
      where: { userId: session.user.id },
      select: { stripeCustomerId: true },
    });

    if (!broker?.stripeCustomerId) {
      return res.status(200).json([]);
    }

    const stripe = getStripe();
    const invoices = await stripe.invoices.list({
      customer: broker.stripeCustomerId,
      limit: 24,
    });

    const mapped = invoices.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      amountPaid: inv.amount_paid,
      currency: inv.currency,
      status: inv.status,
      created: inv.created,
      invoicePdf: inv.invoice_pdf,
      hostedInvoiceUrl: inv.hosted_invoice_url,
    }));

    return res.status(200).json(mapped);
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return res.status(500).json({ error: "Failed to fetch invoices" });
  }
}
