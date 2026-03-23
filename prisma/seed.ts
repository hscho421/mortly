import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const mode = process.argv[2] ?? "mock";

// ─── Helpers ──────────────────────────────────────────────────
function genPublicId(index: number): string {
  // Deterministic but realistic 9-digit IDs for seeding
  return String(100000000 + index * 7919).slice(0, 9); // prime multiplier avoids collisions
}

function randomDate(daysAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysAgo));
  d.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
  return d;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Data pools ───────────────────────────────────────────────
const FIRST_NAMES = [
  "James", "Mary", "Robert", "Patricia", "Michael", "Jennifer", "William", "Linda",
  "David", "Elizabeth", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah",
  "Daniel", "Karen", "Matthew", "Lisa", "Anthony", "Nancy", "Mark", "Betty",
  "Donald", "Margaret", "Steven", "Sandra", "Andrew", "Ashley", "Paul", "Dorothy",
  "Joshua", "Kimberly", "Kenneth", "Emily", "Kevin", "Donna", "Brian", "Michelle",
  "George", "Carol", "Timothy", "Amanda", "Ronald", "Melissa", "Edward", "Deborah",
  "Jason", "Stephanie", "Jeffrey", "Rebecca", "Ryan", "Sharon", "Jacob", "Laura",
  "Gary", "Cynthia", "Nicholas", "Kathleen", "Eric", "Amy", "Jonathan", "Angela",
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
  "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker",
  "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
  "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell",
  "Carter", "Roberts", "Kim", "Chen", "Park", "Cho", "Wong", "Singh", "Patel",
];

const BROKERAGE_NAMES = [
  "Maple Mortgage Group", "Pacific Rate Finders", "Summit Financial Partners",
  "Northern Lending Co.", "Coast Capital Mortgages", "Prairie Home Finance",
  "Great Lakes Mortgage", "Rockies Financial", "Atlantic Mortgage Solutions",
  "Frontier Rate Experts", "Dominion Lending Hub", "True North Mortgages",
  "Keystone Mortgage Co.", "Horizon Rate Group", "Metro Home Finance",
];

const PROVINCES = ["ON", "BC", "AB", "QC", "MB", "SK", "NS", "NB"];
const CITIES: Record<string, string[]> = {
  ON: ["Toronto", "Ottawa", "Mississauga", "Brampton", "Hamilton", "London", "Markham", "Vaughan"],
  BC: ["Vancouver", "Victoria", "Burnaby", "Richmond", "Surrey", "Kelowna"],
  AB: ["Calgary", "Edmonton", "Red Deer", "Lethbridge"],
  QC: ["Montreal", "Quebec City", "Laval", "Gatineau"],
  MB: ["Winnipeg", "Brandon"],
  SK: ["Saskatoon", "Regina"],
  NS: ["Halifax", "Dartmouth"],
  NB: ["Fredericton", "Moncton", "Saint John"],
};
const SPECIALTIES = [
  "First-time buyers", "Refinancing", "Self-employed", "Commercial",
  "Investment properties", "High-value residential", "Renewals",
  "Bad credit", "New construction", "Vacation properties",
];

const REQUEST_NOTES = [
  "First-time buyer, looking for competitive rates.",
  "Want to refinance to lower my monthly payments.",
  "Renewal coming up, exploring better options.",
  "Self-employed, need flexible income verification.",
  "Looking for a pre-approval before house hunting.",
  "Investment property purchase in the suburbs.",
  "Downsizing from a detached home to a condo.",
  "Recently divorced, need to refinance existing mortgage.",
  "New immigrant, building credit in Canada.",
  "Looking for a vacation property mortgage.",
];

const RESIDENTIAL_PRODUCTS = [
  "NEW_MORTGAGE", "PRE_APPROVAL", "REFINANCING", "RENEWAL",
  "PERSONAL_LOC", "REVERSE_MORTGAGE",
  "DEBT_CONSOLIDATION", "EQUITY_LOAN",
];
const COMMERCIAL_PRODUCTS = ["COMM_NEW_LOAN", "COMM_REFINANCING", "COMM_TRANSFER", "COMM_GOVT_LOAN", "COMM_LOC", "COMM_DEBT_CONSOLIDATION"];
const INCOME_TYPES = ["EMPLOYMENT", "SELF_EMPLOYMENT", "DIVIDEND", "RENTAL", "FOREIGN", "OTHER"];
const TIMELINE_OPTIONS = ["ASAP", "1_MONTH", "3_MONTHS", "6_MONTHS", "1_YEAR_PLUS"];
const BUSINESS_TYPES = [
  "Restaurant", "Retail Store", "Tech Startup", "Construction",
  "Real Estate Development", "Medical Practice", "Law Firm",
  "Consulting", "Manufacturing", "Import/Export",
];

const REPORT_REASONS = [
  "Misleading profile information about experience and credentials",
  "Inappropriate language and unprofessional conduct",
  "Suspected unlicensed activity",
  "Spam messages soliciting external services",
  "Unresponsive after initial consultation",
  "Requesting personal financial information outside the platform",
  "Discriminatory language in messages",
  "Fake reviews or inflated ratings",
  "Pressure tactics and aggressive sales behavior",
  "Misrepresenting mortgage rates or terms",
];

// ─── Clear ────────────────────────────────────────────────────
async function clearAll() {
  await prisma.adminNotice.deleteMany();
  await prisma.adminAction.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.report.deleteMany();
  await prisma.brokerIntroduction.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.borrowerRequest.deleteMany();
  await prisma.broker.deleteMany();
  await prisma.user.deleteMany();
  await prisma.systemSetting.deleteMany();
  console.log("All tables cleared.");
}

// ─── Mock seed ────────────────────────────────────────────────
async function seedMock() {
  const hash = await bcrypt.hash("password123", 10);
  let pubIdx = 1;

  // ── Admins (3) ──────────────────────────────────────────────
  const admins = [];
  for (const [name, email] of [
    ["Admin User", "admin@test.com"],
    ["Admin Sarah", "admin2@test.com"],
    ["Admin Dev", "admin3@test.com"],
  ] as const) {
    const u = await prisma.user.create({
      data: {
        email,
        passwordHash: hash,
        role: "ADMIN",
        name,
        publicId: genPublicId(pubIdx++),
        emailVerified: true,
        createdAt: randomDate(28),
      },
    });
    admins.push(u);
  }
  console.log(`${admins.length} admins created.`);

  // ── Borrowers (35) ──────────────────────────────────────────
  const borrowers = [];
  for (let i = 0; i < 35; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[i % LAST_NAMES.length];
    const name = `${first} ${last}`;
    const email = `borrower${i + 1}@test.com`;
    const status = i === 30 ? "SUSPENDED" as const : i === 31 ? "BANNED" as const : "ACTIVE" as const;
    const u = await prisma.user.create({
      data: {
        email,
        passwordHash: hash,
        role: "BORROWER",
        name,
        publicId: genPublicId(pubIdx++),
        emailVerified: true,
        status,
        createdAt: randomDate(25),
      },
    });
    borrowers.push(u);
  }
  console.log(`${borrowers.length} borrowers created.`);

  // ── Broker users (15) ──────────────────────────────────────
  const brokerUsers = [];
  const tiers: ("FREE" | "BASIC" | "PRO" | "PREMIUM")[] = [
    "PREMIUM", "PRO", "PRO", "BASIC", "BASIC",
    "BASIC", "FREE", "FREE", "FREE", "PRO",
    "PREMIUM", "BASIC", "FREE", "PRO", "BASIC",
  ];
  const verStatuses: ("VERIFIED" | "PENDING" | "REJECTED")[] = [
    "VERIFIED", "VERIFIED", "VERIFIED", "VERIFIED", "VERIFIED",
    "VERIFIED", "VERIFIED", "PENDING", "PENDING", "VERIFIED",
    "VERIFIED", "PENDING", "REJECTED", "VERIFIED", "VERIFIED",
  ];
  const brokerRecords = [];

  for (let i = 0; i < 15; i++) {
    const first = FIRST_NAMES[35 + (i % (FIRST_NAMES.length - 35))];
    const last = LAST_NAMES[35 + (i % (LAST_NAMES.length - 35))];
    const name = `${first} ${last}`;
    const email = `broker${i + 1}@test.com`;
    const province = PROVINCES[i % PROVINCES.length];
    const u = await prisma.user.create({
      data: {
        email,
        passwordHash: hash,
        role: "BROKER",
        name,
        publicId: genPublicId(pubIdx++),
        emailVerified: true,
        status: i === 12 ? "SUSPENDED" : "ACTIVE",
        createdAt: randomDate(25),
      },
    });
    brokerUsers.push(u);

    const tier = tiers[i];
    const yrs = 2 + Math.floor(Math.random() * 20);
    const credits =
      tier === "FREE" ? Math.floor(Math.random() * 3) :
      tier === "BASIC" ? 5 + Math.floor(Math.random() * 10) :
      tier === "PRO" ? 15 + Math.floor(Math.random() * 30) :
      50 + Math.floor(Math.random() * 100);

    const specialtyCount = 1 + Math.floor(Math.random() * 3);
    const shuffled = [...SPECIALTIES].sort(() => Math.random() - 0.5);
    const specs = shuffled.slice(0, specialtyCount).join(", ");
    const cities = CITIES[province] || ["City"];

    const broker = await prisma.broker.create({
      data: {
        userId: u.id,
        brokerageName: BROKERAGE_NAMES[i % BROKERAGE_NAMES.length],
        province,
        licenseNumber: `${province.charAt(0)}${String(8000000 + i * 1111).slice(0, 7)}`,
        mortgageCategory: i < 10 ? "BOTH" : i < 13 ? "RESIDENTIAL" : "COMMERCIAL",
        bio: `${yrs} years of experience helping clients with ${specs.toLowerCase()}.`,
        yearsExperience: yrs,
        areasServed: cities.slice(0, 2 + Math.floor(Math.random() * 2)).join(", "),
        specialties: specs,
        verificationStatus: verStatuses[i],
        subscriptionTier: tier,
        responseCredits: credits,
        createdAt: randomDate(25),
      },
    });
    brokerRecords.push(broker);
  }
  console.log(`${brokerUsers.length} brokers created.`);

  // ── Borrower requests (25) — v2 schema ─────────────────────
  const reqStatuses: ("OPEN" | "IN_PROGRESS" | "CLOSED" | "EXPIRED")[] = ["OPEN", "OPEN", "OPEN", "IN_PROGRESS", "IN_PROGRESS", "CLOSED", "EXPIRED"];

  const requests = [];
  for (let i = 0; i < 25; i++) {
    const borrower = borrowers[i % borrowers.length];
    const province = PROVINCES[i % PROVINCES.length];
    const cities = CITIES[province] || ["City"];
    const isCommercial = i >= 20; // last 5 are commercial
    const category = isCommercial ? "COMMERCIAL" as const : "RESIDENTIAL" as const;

    // Pick 1-3 random products for the category
    const pool = isCommercial ? COMMERCIAL_PRODUCTS : RESIDENTIAL_PRODUCTS;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const productTypes = shuffled.slice(0, 1 + Math.floor(Math.random() * Math.min(3, pool.length)));

    // Build category-specific details
    const details = isCommercial
      ? {
          businessType: pick(BUSINESS_TYPES),
          corporateAnnualIncome: `$${200 + Math.floor(Math.random() * 800)},000`,
          corporateAnnualExpenses: `$${100 + Math.floor(Math.random() * 500)},000`,
          ownerNetIncome: `$${80 + Math.floor(Math.random() * 200)},000`,
        }
      : {
          purposeOfUse: i % 3 === 0 ? ["RENTAL"] : i % 5 === 0 ? ["OWNER_OCCUPIED", "RENTAL"] : ["OWNER_OCCUPIED"],
          incomeTypes: [...INCOME_TYPES].sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 3)),
          ...(i % 5 === 0 ? { incomeTypeOther: "Freelance consulting" } : {}),
          annualIncome: { "2025": `${50 + Math.floor(Math.random() * 200)}000`, "2024": `${45 + Math.floor(Math.random() * 180)}000` },
        };

    const req = await prisma.borrowerRequest.create({
      data: {
        publicId: String(100000000 + i),
        borrowerId: borrower.id,
        schemaVersion: 2,
        mortgageCategory: category,
        productTypes,
        province,
        city: pick(cities),
        details,
        desiredTimeline: pick(TIMELINE_OPTIONS),
        notes: pick(REQUEST_NOTES),
        status: pick(reqStatuses),
        createdAt: randomDate(25),
      },
    });
    requests.push(req);
  }
  console.log(`${requests.length} borrower requests created (v2 schema).`);

  // ── Broker introductions (40) ──────────────────────────────
  const introMessages = [
    "I'd love to help you with this. My experience is directly relevant.",
    "I have access to lenders that can offer very competitive rates for your situation.",
    "Let me know if you'd like to chat — I've handled many similar cases.",
    "I specialize in exactly this type of mortgage. Happy to discuss!",
    "With my lender network, I can likely find you a better rate than your bank.",
  ];
  const introSet = new Set<string>();
  let introCount = 0;
  for (let i = 0; i < 40; i++) {
    const reqIdx = i % requests.length;
    const brokerIdx = Math.floor(i / requests.length + i) % brokerRecords.length;
    const key = `${requests[reqIdx].id}-${brokerRecords[brokerIdx].id}`;
    if (introSet.has(key)) continue;
    if (verStatuses[brokerIdx] !== "VERIFIED") continue;
    introSet.add(key);

    await prisma.brokerIntroduction.create({
      data: {
        requestId: requests[reqIdx].id,
        brokerId: brokerRecords[brokerIdx].id,
        howCanHelp: pick(introMessages),
        experience: `${2 + Math.floor(Math.random() * 15)} years in this area.`,
        lenderNetwork: pick(["Big 5 banks + monoline lenders", "Credit unions + alternative lenders", "Full spectrum — banks, monolines, private"]),
        personalMessage: pick(introMessages),
        estimatedTimeline: pick(["1-2 weeks", "2-4 weeks", "3-5 weeks"]),
        createdAt: randomDate(25),
      },
    });
    introCount++;
  }
  console.log(`${introCount} broker introductions created.`);

  // ── Conversations (15) & Messages ──────────────────────────
  const conversations = [];
  const convSet = new Set<string>();
  for (let i = 0; i < 15; i++) {
    const req = requests[i % requests.length];
    const brokerIdx = i % brokerRecords.length;
    if (verStatuses[brokerIdx] !== "VERIFIED") continue;
    const key = `${req.id}-${brokerRecords[brokerIdx].id}`;
    if (convSet.has(key)) continue;
    convSet.add(key);

    const conv = await prisma.conversation.create({
      data: {
        publicId: String(200000000 + i),
        requestId: req.id,
        borrowerId: req.borrowerId,
        brokerId: brokerRecords[brokerIdx].id,
        status: i < 12 ? "ACTIVE" : "CLOSED",
        createdAt: randomDate(25),
      },
    });
    conversations.push({ conv, borrowerId: req.borrowerId, brokerUserId: brokerUsers[brokerIdx].id });
  }

  // Messages for each conversation (3-8 messages each)
  const msgTemplatesBroker = [
    "Hi! I reviewed your request and I think I can help.",
    "Thanks for your interest. Let me outline what I can offer.",
    "I have access to several lenders that would be a great fit for your needs.",
    "Would you be available for a quick call this week?",
    "I've prepared a preliminary rate comparison for you.",
    "Happy to answer any questions about the process.",
    "I can get pre-approval paperwork started right away.",
  ];
  const msgTemplatesBorrower = [
    "Thanks for reaching out! I have a few questions.",
    "What rates are you seeing right now for my situation?",
    "How long does the approval process usually take?",
    "Can you handle the full process end-to-end?",
    "What fees should I expect?",
    "Sounds great, let's move forward!",
    "I need to discuss with my partner first.",
  ];

  for (const { conv, borrowerId, brokerUserId } of conversations) {
    const msgCount = 3 + Math.floor(Math.random() * 6);
    const msgs = [];
    for (let j = 0; j < msgCount; j++) {
      const isBroker = j % 2 === 0;
      msgs.push({
        conversationId: conv.id,
        senderId: isBroker ? brokerUserId : borrowerId,
        body: isBroker ? pick(msgTemplatesBroker) : pick(msgTemplatesBorrower),
        createdAt: new Date(conv.createdAt.getTime() + j * 3600000 * (1 + Math.random() * 12)),
      });
    }
    await prisma.message.createMany({ data: msgs });
  }
  console.log(`${conversations.length} conversations with messages created.`);

  // ── Reports (10) ──────────────────────────────────────────
  const reportStatuses: ("OPEN" | "REVIEWED" | "RESOLVED" | "DISMISSED")[] = [
    "OPEN", "OPEN", "OPEN", "OPEN", "REVIEWED", "REVIEWED", "RESOLVED", "RESOLVED", "DISMISSED", "OPEN",
  ];
  for (let i = 0; i < 10; i++) {
    const reporter = borrowers[i % borrowers.length];
    const targetBroker = brokerRecords[i % brokerRecords.length];
    const status = reportStatuses[i];
    await prisma.report.create({
      data: {
        reporterId: reporter.id,
        targetType: i % 3 === 0 ? "CONVERSATION" : "BROKER",
        targetId: i % 3 === 0 ? (conversations[i % conversations.length]?.conv.id ?? targetBroker.id) : targetBroker.id,
        reason: REPORT_REASONS[i % REPORT_REASONS.length],
        status,
        adminNotes: status === "RESOLVED" ? "Investigated and action taken." : status === "DISMISSED" ? "No violation found." : null,
        resolvedAt: status === "RESOLVED" || status === "DISMISSED" ? randomDate(10) : null,
        createdAt: randomDate(25),
      },
    });
  }
  console.log("10 reports created.");

  // ── Admin actions (20) ────────────────────────────────────
  const actionTypes = [
    { action: "CREDIT_ADJUST", targetType: "BROKER", details: (i: number) => JSON.stringify({ amount: [-5, 10, 3, -2, 15][i % 5], previousBalance: 10, newBalance: 10 + [-5, 10, 3, -2, 15][i % 5] }) },
    { action: "VERIFY_BROKER", targetType: "BROKER", details: () => JSON.stringify({ previousStatus: "PENDING", newStatus: "VERIFIED" }) },
    { action: "REJECT_BROKER", targetType: "BROKER", details: () => JSON.stringify({ previousStatus: "PENDING", newStatus: "REJECTED" }) },
    { action: "SUSPEND_USER", targetType: "USER", details: () => JSON.stringify({ previousStatus: "ACTIVE", newStatus: "SUSPENDED" }) },
    { action: "REACTIVATE_USER", targetType: "USER", details: () => JSON.stringify({ previousStatus: "SUSPENDED", newStatus: "ACTIVE" }) },
    { action: "CLOSE_REQUEST", targetType: "REQUEST", details: () => JSON.stringify({ previousStatus: "OPEN", newStatus: "CLOSED" }) },
    { action: "RESOLVE_REPORT", targetType: "REPORT", details: () => JSON.stringify({ previousStatus: "OPEN", newStatus: "RESOLVED", reportTargetType: "BROKER" }) },
    { action: "DISMISS_REPORT", targetType: "REPORT", details: () => JSON.stringify({ previousStatus: "OPEN", newStatus: "DISMISSED", reportTargetType: "BROKER" }) },
    { action: "SEND_NOTICE", targetType: "USER", details: () => JSON.stringify({ subject: "Account reminder" }) },
    { action: "UPDATE_SETTINGS", targetType: "SYSTEM", details: () => JSON.stringify({ free_tier_credits: "5" }) },
  ];

  for (let i = 0; i < 20; i++) {
    const at = actionTypes[i % actionTypes.length];
    const target = at.targetType === "BROKER" ? brokerRecords[i % brokerRecords.length].id :
                   at.targetType === "USER" ? borrowers[i % borrowers.length].id :
                   at.targetType === "REQUEST" ? requests[i % requests.length].id :
                   "settings";
    await prisma.adminAction.create({
      data: {
        adminId: admins[i % admins.length].id,
        action: at.action,
        targetType: at.targetType,
        targetId: target,
        details: at.details(i),
        reason: i % 3 === 0 ? pick(["Policy violation", "User request", "Routine check", "Promotional bonus", "Spam investigation"]) : null,
        createdAt: randomDate(25),
      },
    });
  }
  console.log("20 admin actions created.");

  // ── Admin notices (5) ─────────────────────────────────────
  for (let i = 0; i < 5; i++) {
    await prisma.adminNotice.create({
      data: {
        adminId: admins[0].id,
        userId: borrowers[i].id,
        subject: pick(["Welcome to mortly", "Account Update", "Important Notice", "Profile Reminder", "Policy Update"]),
        body: pick([
          "Welcome! Your account is set up and ready to use.",
          "We've updated our terms of service. Please review them at your earliest convenience.",
          "Your profile is incomplete. Please update your information to get the best matches.",
          "We noticed unusual activity on your account. Please verify your identity.",
          "Your request has been reviewed by our team. No further action is needed.",
        ]),
        read: i < 2,
        createdAt: randomDate(25),
      },
    });
  }
  console.log("5 admin notices created.");

  // ── System settings ───────────────────────────────────────
  const defaults: [string, string][] = [
    ["platform_name", "mortly"],
    ["support_email", "support@mortgagematch.ca"],
    ["free_tier_credits", "3"],
    ["basic_tier_credits", "15"],
    ["pro_tier_credits", "40"],
    ["max_requests_per_user", "10"],
    ["request_expiry_days", "30"],
    ["maintenance_mode", "false"],
  ];
  for (const [key, value] of defaults) {
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
  console.log("System settings seeded.");

  // ── Summary ───────────────────────────────────────────────
  const totalUsers = admins.length + borrowers.length + brokerUsers.length;
  console.log(`\nSeed complete! ${totalUsers} users created (password: password123)`);
  console.log("\nKey test accounts:");
  console.log("  Admin:     admin@test.com");
  console.log("  Borrower:  borrower1@test.com … borrower35@test.com");
  console.log("  Broker:    broker1@test.com … broker15@test.com");
  console.log("\nSpecial states:");
  console.log("  Suspended borrower: borrower31@test.com");
  console.log("  Banned borrower:    borrower32@test.com");
  console.log("  Suspended broker:   broker13@test.com (also REJECTED)");
  console.log("  Pending brokers:    broker8, broker9, broker12");
  console.log("  Tier spread: FREE(4), BASIC(4), PRO(4), PREMIUM(3)");
}

// ─── Empty seed ───────────────────────────────────────────────
async function seedEmpty() {
  const hash = await bcrypt.hash("123", 10);
  let pubIdx = 900;

  // Admin
  await prisma.user.create({
    data: { email: "admin@test.com", passwordHash: hash, role: "ADMIN", name: "Admin User", publicId: genPublicId(pubIdx++), emailVerified: true },
  });

  // Borrowers
  await prisma.user.create({
    data: { email: "borrower1@test.com", passwordHash: hash, role: "BORROWER", name: "John Smith", publicId: genPublicId(pubIdx++), emailVerified: true },
  });
  await prisma.user.create({
    data: { email: "borrower2@test.com", passwordHash: hash, role: "BORROWER", name: "Alice Johnson", publicId: genPublicId(pubIdx++), emailVerified: true },
  });

  // Brokers — one per tier
  for (const [email, name, tier, credits, province, license] of [
    ["broker-free@test.com", "David Park", "FREE", 0, "ON", "M08009001"],
    ["broker-basic@test.com", "Sarah Lee", "BASIC", 5, "ON", "M08001234"],
    ["broker-pro@test.com", "Mike Chen", "PRO", 20, "BC", "X300567"],
    ["broker-premium@test.com", "Jessica Wang", "PREMIUM", 999, "AB", "A20045678"],
  ] as const) {
    const u = await prisma.user.create({
      data: { email, passwordHash: hash, role: "BROKER", name, publicId: genPublicId(pubIdx++), emailVerified: true },
    });
    await prisma.broker.create({
      data: {
        userId: u.id,
        brokerageName: `${name.split(" ")[1]} Mortgage Services`,
        province,
        licenseNumber: license,
        bio: `Experienced mortgage broker.`,
        yearsExperience: 5,
        areasServed: (CITIES[province] || ["City"]).slice(0, 2).join(", "),
        specialties: "General",
        verificationStatus: "VERIFIED",
        subscriptionTier: tier,
        responseCredits: credits,
      },
    });
  }

  // System settings
  for (const [key, value] of [
    ["platform_name", "mortly"],
    ["support_email", "support@mortgagematch.ca"],
    ["free_tier_credits", "3"],
    ["basic_tier_credits", "15"],
    ["pro_tier_credits", "40"],
    ["max_requests_per_user", "10"],
    ["request_expiry_days", "30"],
    ["maintenance_mode", "false"],
  ] as const) {
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  console.log("Empty seed complete! All passwords: 123");
  console.log("\nAccounts:");
  console.log("  Admin:    admin@test.com");
  console.log("  Borrower: borrower1@test.com / borrower2@test.com");
  console.log("  Broker:   broker-free@test.com   (FREE, 0 credits)");
  console.log("  Broker:   broker-basic@test.com  (BASIC, 5 credits)");
  console.log("  Broker:   broker-pro@test.com    (PRO, 20 credits)");
  console.log("  Broker:   broker-premium@test.com (PREMIUM, 999 credits)");
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  console.log(`Running seed in "${mode}" mode...\n`);

  await clearAll();

  if (mode === "mock") {
    await seedMock();
  } else if (mode === "empty") {
    await seedEmpty();
  } else {
    console.error(`Unknown mode: "${mode}". Use "mock" or "empty".`);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
