import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const mode = process.argv[2] ?? "mock";

async function clearAll() {
  // Delete in order respecting foreign keys
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.report.deleteMany();
  await prisma.brokerIntroduction.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.borrowerRequest.deleteMany();
  await prisma.broker.deleteMany();
  await prisma.user.deleteMany();
  console.log("All tables cleared.");
}

async function seedMock() {
  const hash = await bcrypt.hash("password123", 10);

  // Users
  const admin = await prisma.user.create({
    data: { email: "admin@test.com", passwordHash: hash, role: "ADMIN", name: "Admin User" },
  });
  const borrower1 = await prisma.user.create({
    data: { email: "john@test.com", passwordHash: hash, role: "BORROWER", name: "John Smith" },
  });
  const borrower2 = await prisma.user.create({
    data: { email: "alice@test.com", passwordHash: hash, role: "BORROWER", name: "Alice Johnson" },
  });
  const borrower3 = await prisma.user.create({
    data: { email: "bob@test.com", passwordHash: hash, role: "BORROWER", name: "Bob Williams" },
  });
  const brokerUser1 = await prisma.user.create({
    data: { email: "broker1@test.com", passwordHash: hash, role: "BROKER", name: "Sarah Lee" },
  });
  const brokerUser2 = await prisma.user.create({
    data: { email: "broker2@test.com", passwordHash: hash, role: "BROKER", name: "Mike Chen" },
  });

  console.log("Users created.");

  // Brokers
  const broker1 = await prisma.broker.create({
    data: {
      userId: brokerUser1.id,
      brokerageName: "Maple Mortgage Group",
      province: "ON",
      licenseNumber: "M08001234",
      bio: "15 years of experience helping first-time buyers in the GTA.",
      yearsExperience: 15,
      areasServed: "Toronto, Mississauga, Brampton",
      specialties: "First-time buyers, Refinancing",
      verificationStatus: "VERIFIED",
      subscriptionTier: "PRO",
      rating: 4.8,
      completedMatches: 47,
      responseCredits: 10,
    },
  });
  const broker2 = await prisma.broker.create({
    data: {
      userId: brokerUser2.id,
      brokerageName: "Pacific Rate Finders",
      province: "BC",
      licenseNumber: "X300567",
      bio: "Specializing in competitive rates for self-employed borrowers.",
      yearsExperience: 8,
      areasServed: "Vancouver, Burnaby, Richmond",
      specialties: "Self-employed, Commercial",
      verificationStatus: "PENDING",
      subscriptionTier: "BASIC",
      rating: 4.5,
      completedMatches: 22,
      responseCredits: 5,
    },
  });

  console.log("Brokers created.");

  // Borrower Requests
  const req1 = await prisma.borrowerRequest.create({
    data: {
      borrowerId: borrower1.id,
      requestType: "PURCHASE",
      province: "ON",
      city: "Toronto",
      propertyType: "CONDO",
      priceRangeMin: 500000,
      priceRangeMax: 700000,
      downPaymentPercent: "10%",
      employmentType: "FULL_TIME",
      creditScoreBand: "GOOD",
      mortgageAmountMin: 450000,
      mortgageAmountMax: 630000,
      preferredTerm: "5 years",
      preferredType: "FIXED",
      closingTimeline: "3-6 months",
      notes: "First-time buyer looking for a condo downtown.",
      status: "OPEN",
    },
  });
  const req2 = await prisma.borrowerRequest.create({
    data: {
      borrowerId: borrower2.id,
      requestType: "REFINANCE",
      province: "BC",
      city: "Vancouver",
      propertyType: "DETACHED",
      priceRangeMin: 1200000,
      priceRangeMax: 1500000,
      downPaymentPercent: "30%",
      employmentType: "SELF_EMPLOYED",
      creditScoreBand: "EXCELLENT",
      mortgageAmountMin: 800000,
      mortgageAmountMax: 1050000,
      preferredTerm: "3 years",
      preferredType: "VARIABLE",
      closingTimeline: "1-3 months",
      status: "IN_PROGRESS",
    },
  });
  const req3 = await prisma.borrowerRequest.create({
    data: {
      borrowerId: borrower3.id,
      requestType: "RENEWAL",
      province: "ON",
      city: "Mississauga",
      propertyType: "TOWNHOUSE",
      priceRangeMin: 800000,
      priceRangeMax: 950000,
      employmentType: "FULL_TIME",
      creditScoreBand: "FAIR",
      mortgageAmountMin: 600000,
      mortgageAmountMax: 750000,
      preferredType: "NOT_SURE",
      closingTimeline: "6+ months",
      status: "OPEN",
    },
  });

  console.log("Borrower requests created.");

  // Broker Introductions
  await prisma.brokerIntroduction.create({
    data: {
      requestId: req1.id,
      brokerId: broker1.id,
      howCanHelp: "I specialize in first-time condo purchases in the GTA.",
      experience: "Helped 200+ first-time buyers close in Toronto.",
      lenderNetwork: "Big 5 banks + monoline lenders",
      personalMessage: "Hi John, I'd love to help you find the right condo mortgage!",
      estimatedTimeline: "2-4 weeks",
    },
  });
  await prisma.brokerIntroduction.create({
    data: {
      requestId: req2.id,
      brokerId: broker2.id,
      howCanHelp: "Expert at refinancing for self-employed borrowers in BC.",
      experience: "8 years handling complex income documentation.",
      lenderNetwork: "Alternative lenders + credit unions",
      personalMessage: "Hi Alice, I can get you competitive rates even with self-employed income.",
      estimatedTimeline: "3-5 weeks",
    },
  });
  await prisma.brokerIntroduction.create({
    data: {
      requestId: req1.id,
      brokerId: broker2.id,
      howCanHelp: "I can offer competitive rates from BC-based lenders.",
      personalMessage: "John, happy to explore some out-of-province options for you.",
    },
  });
  await prisma.brokerIntroduction.create({
    data: {
      requestId: req3.id,
      brokerId: broker1.id,
      howCanHelp: "Renewal is a great time to renegotiate your rate.",
      experience: "Helped dozens of clients save on renewals.",
      personalMessage: "Bob, let's make sure you're getting the best renewal rate possible.",
      estimatedTimeline: "1-2 weeks",
    },
  });

  console.log("Broker introductions created.");

  // Conversations & Messages
  const conv1 = await prisma.conversation.create({
    data: {
      requestId: req1.id,
      borrowerId: borrower1.id,
      brokerId: broker1.id,
      status: "ACTIVE",
    },
  });
  const conv2 = await prisma.conversation.create({
    data: {
      requestId: req2.id,
      borrowerId: borrower2.id,
      brokerId: broker2.id,
      status: "ACTIVE",
    },
  });
  const conv3 = await prisma.conversation.create({
    data: {
      requestId: req3.id,
      borrowerId: borrower3.id,
      brokerId: broker1.id,
      status: "ACTIVE",
    },
  });

  await prisma.message.createMany({
    data: [
      { conversationId: conv1.id, senderId: brokerUser1.id, body: "Hi John! I'd love to help you find the perfect condo." },
      { conversationId: conv1.id, senderId: borrower1.id, body: "Thanks Sarah! I'm looking at units near the subway." },
      { conversationId: conv1.id, senderId: brokerUser1.id, body: "Great choice. I have lenders offering 4.89% fixed for 5 years." },
      { conversationId: conv1.id, senderId: borrower1.id, body: "That sounds competitive. What are the fees?" },
      { conversationId: conv2.id, senderId: brokerUser2.id, body: "Hi Alice, I reviewed your profile. Let's talk about your refinance." },
      { conversationId: conv2.id, senderId: borrower2.id, body: "Hi Mike! I want to lower my rate and access some equity." },
      { conversationId: conv2.id, senderId: brokerUser2.id, body: "With your credit score, we can definitely find something great." },
      { conversationId: conv3.id, senderId: brokerUser1.id, body: "Bob, your renewal is coming up. Let's beat your current rate." },
      { conversationId: conv3.id, senderId: borrower3.id, body: "Yes please! My current rate is 5.4% fixed." },
      { conversationId: conv3.id, senderId: brokerUser1.id, body: "I can get you 4.79% right now. Want me to start the paperwork?" },
    ],
  });

  console.log("Conversations and messages created.");

  // Reports
  await prisma.report.createMany({
    data: [
      { id: "rpt_1", reporterId: borrower1.id, targetType: "Broker", targetId: broker2.id, reason: "Misleading profile information about experience and credentials", status: "OPEN" },
      { id: "rpt_2", reporterId: borrower2.id, targetType: "Message", targetId: "msg_482", reason: "Inappropriate language and unprofessional conduct", status: "OPEN" },
      { id: "rpt_3", reporterId: borrower3.id, targetType: "Broker", targetId: broker1.id, reason: "Suspected unlicensed activity in Ontario", status: "REVIEWED" },
      { id: "rpt_4", reporterId: borrower1.id, targetType: "Message", targetId: "msg_391", reason: "Spam messages soliciting external services", status: "RESOLVED" },
      { id: "rpt_5", reporterId: borrower2.id, targetType: "Broker", targetId: broker1.id, reason: "Unresponsive after initial consultation, possible bait-and-switch", status: "OPEN" },
      { id: "rpt_6", reporterId: borrower3.id, targetType: "Message", targetId: "msg_520", reason: "Requesting personal financial information outside the platform", status: "OPEN" },
    ],
  });

  console.log("Reports created.");
  console.log("\nSeed complete! Test accounts (password: password123):");
  console.log("  Admin:    admin@test.com");
  console.log("  Borrower: john@test.com / alice@test.com / bob@test.com");
  console.log("  Broker:   broker1@test.com / broker2@test.com");
}

async function main() {
  console.log(`Running seed in "${mode}" mode...\n`);

  await clearAll();

  if (mode === "mock") {
    await seedMock();
  } else if (mode === "empty") {
    const hash = await bcrypt.hash("password123", 10);

    await prisma.user.create({
      data: { email: "admin@test.com", passwordHash: hash, role: "ADMIN", name: "Admin User" },
    });
    await prisma.user.create({
      data: { email: "john@test.com", passwordHash: hash, role: "BORROWER", name: "John Smith" },
    });
    await prisma.user.create({
      data: { email: "alice@test.com", passwordHash: hash, role: "BORROWER", name: "Alice Johnson" },
    });
    await prisma.user.create({
      data: { email: "bob@test.com", passwordHash: hash, role: "BORROWER", name: "Bob Williams" },
    });
    await prisma.user.create({
      data: { email: "broker1@test.com", passwordHash: hash, role: "BROKER", name: "Sarah Lee" },
    });
    await prisma.user.create({
      data: { email: "broker2@test.com", passwordHash: hash, role: "BROKER", name: "Mike Chen" },
    });

    console.log("Users created (no requests/brokers/conversations).");
    console.log("\nTest accounts (password: password123):");
    console.log("  Admin:    admin@test.com");
    console.log("  Borrower: john@test.com / alice@test.com / bob@test.com");
    console.log("  Broker:   broker1@test.com / broker2@test.com");
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
