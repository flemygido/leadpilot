/**
 * LeadPilot — Comprehensive Seed
 * Resets all data and creates 8 realistic leads across the full pipeline.
 *
 * Score formula (max 100):
 *   COMPLETENESS: name(5) + intent(5) + propertyType(5) + bhk(3) + budget(7) + locations(5) = 30
 *   TIMELINE:     immediate(30) | 1_3_months(20) | 3_6_months(10) | exploring(5)
 *   INTENT:       buy/rent(20)
 *   FINANCING:    loan/cash(10)
 *   CONTACT_TIME: known(10)
 *
 * Budget is stored in RUPEES. Panel divides by 100,000 to display in Lakhs.
 *   1 Lakh  = 100,000 rupees
 *   1 Crore = 10,000,000 rupees
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── helpers ────────────────────────────────────────────────────────────────

const L = (n: number) => n * 100_000;         // lakhs → rupees
const C = (n: number) => n * 10_000_000;       // crores → rupees
const daysAhead = (n: number) => new Date(Date.now() + n * 86_400_000);
// at(d, h, m) = exactly d days + h hours + m minutes ago — ensures unique, ordered timestamps
const at = (days: number, hours = 0, mins = 0) =>
  new Date(Date.now() - days * 86_400_000 - hours * 3_600_000 - mins * 60_000);
const hoursAgo = (h: number) => at(0, h);

// Next Monday 9:00 AM local
function nextWeekday(offset: number, hour = 9, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// ─── reset ───────────────────────────────────────────────────────────────────

async function reset() {
  console.log('🗑  Clearing existing data…');
  await prisma.conversationFlag.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.followUpJob.deleteMany();
  await prisma.siteVisit.deleteMany();
  await prisma.stateTransition.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.qualificationResult.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.agentAvailability.deleteMany();
  await prisma.property.deleteMany();
  await prisma.user.deleteMany();
  await prisma.agent.deleteMany();
  console.log('   ✓ Done\n');
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱  LeadPilot — Seeding database…\n');

  await reset();

  // ── Agent ──────────────────────────────────────────────────────────────────
  const agent = await prisma.agent.create({
    data: {
      name: 'Raj Sharma',
      email: 'raj.sharma@leadpilot.dev',
      phone: '+919876543210',
      availabilities: {
        create: [
          { dayOfWeek: 1, startTime: '09:00', endTime: '18:00' },
          { dayOfWeek: 2, startTime: '09:00', endTime: '18:00' },
          { dayOfWeek: 3, startTime: '09:00', endTime: '18:00' },
          { dayOfWeek: 4, startTime: '09:00', endTime: '18:00' },
          { dayOfWeek: 5, startTime: '09:00', endTime: '17:00' },
          { dayOfWeek: 6, startTime: '10:00', endTime: '14:00' },
        ],
      },
    },
  });
  console.log(`✅  Agent: ${agent.name}`);

  // ── Properties ────────────────────────────────────────────────────────────
  const prop1 = await prisma.property.create({
    data: {
      title: '3BHK Premium Apartment — Bandra West',
      description: 'Fully furnished 3BHK with sea view, 2 parking, gym, and 24/7 security. Ready to move in.',
      propertyType: 'apartment',
      bhk: 3,
      areaSqft: 1450,
      priceMin: C(1.8),
      priceMax: C(2.2),
      location: 'Bandra West, Mumbai',
      address: 'Plot 12B, Sea View Heights, Bandstand, Bandra West, Mumbai - 400050',
      status: 'available',
      amenities: ['Sea View', 'Gym', 'Swimming Pool', '2 Car Parking', '24/7 Security', 'Modular Kitchen'],
      ownerName: 'Deepak Malhotra',
      ownerPhone: '+919820012345',
      ownerEmail: 'deepak.malhotra@gmail.com',
      agentId: agent.id,
    },
  });

  const prop2 = await prisma.property.create({
    data: {
      title: '4BHK Luxury Villa — Koregaon Park',
      description: 'Standalone villa with private pool, 3-car garage, and landscaped garden. Gated community.',
      propertyType: 'villa',
      bhk: 4,
      areaSqft: 3800,
      priceMin: C(3.2),
      priceMax: C(3.8),
      location: 'Koregaon Park, Pune',
      address: 'Villa No. 4, Golden Gate Township, Koregaon Park Annexe, Pune - 411001',
      status: 'available',
      amenities: ['Private Pool', '3 Car Garage', 'Landscaped Garden', 'Clubhouse', 'CCTV', 'Gated Community'],
      ownerName: 'Anita Reddy',
      ownerPhone: '+919920023456',
      ownerEmail: 'anita.reddy@yahoo.com',
      agentId: agent.id,
    },
  });

  const prop3 = await prisma.property.create({
    data: {
      title: '2BHK Modern Flat — Andheri West',
      description: 'Brand new 2BHK, modular kitchen, vitrified flooring, rooftop club access. Ready possession.',
      propertyType: 'apartment',
      bhk: 2,
      areaSqft: 1100,
      priceMin: L(85),
      priceMax: L(105),
      location: 'Andheri West, Mumbai',
      address: 'Flat 802, Azure Heights, Veera Desai Road, Andheri West, Mumbai - 400053',
      status: 'available',
      amenities: ['Rooftop Club', 'Gym', 'Power Backup', '1 Car Parking', 'Lift', 'Visitor Parking'],
      ownerName: 'Prakash Patel',
      ownerPhone: '+919833034567',
      ownerEmail: 'prakash.patel@gmail.com',
      agentId: agent.id,
    },
  });

  const prop4 = await prisma.property.create({
    data: {
      title: '3BHK Semi-Furnished — Whitefield',
      description: 'Spacious 3BHK near ITPL with excellent connectivity. Good for IT professionals.',
      propertyType: 'apartment',
      bhk: 3,
      areaSqft: 1650,
      priceMin: L(70),
      priceMax: L(90),
      location: 'Whitefield, Bangalore',
      address: 'Block C, Apt 304, Prestige Tech Park, ITPL Main Road, Whitefield, Bangalore - 560066',
      status: 'available',
      amenities: ['24/7 Security', 'Power Backup', '2 Car Parking', 'Gym', 'Jogging Track'],
      ownerName: 'Venkatesh Iyer',
      ownerPhone: '+919944045678',
      ownerEmail: 'venkatesh.iyer@gmail.com',
      agentId: agent.id,
    },
  });

  const prop5 = await prisma.property.create({
    data: {
      title: 'Grade-A Office Space — Hinjawadi IT Park',
      description: '2,400 sq ft plug-and-play office in a premium IT park. Three-year lease preferred.',
      propertyType: 'commercial',
      areaSqft: 2400,
      priceMin: C(1.5),
      priceMax: C(1.8),
      location: 'Hinjawadi, Pune',
      address: 'Unit 5A, Blue Ridge Towers, Hinjawadi Phase 2, Pune - 411057',
      status: 'available',
      amenities: ['Plug & Play', 'Conference Rooms', 'Cafeteria', 'Parking for 20', 'HVAC', 'Generator Backup'],
      ownerName: 'Bharat Commercial Estates Ltd.',
      ownerPhone: '+912027123456',
      ownerEmail: 'contact@bharatcommercial.in',
      agentId: agent.id,
    },
  });

  console.log('✅  Properties: 5 created');

  // ──────────────────────────────────────────────────────────────────────────
  // LEAD 1: Priya Mehta — VISIT_SCHEDULED / HOT / score 90
  //   Full qualification. Immediate timeline. Visit booked Mon 9 Jun 9 AM.
  //   Score: name(5)+intent(5)+type(5)+bhk(3)+budget(7)+loc(5) = 30
  //          + immediate(30) + buy(20) + loan(10) + no_contact(0) = 90
  // ──────────────────────────────────────────────────────────────────────────
  const visit1At = nextWeekday(1, 9, 0);   // Mon
  const visit1b  = nextWeekday(1, 13, 30); // Mon afternoon
  const visit1c  = nextWeekday(2, 9, 0);   // Tue

  await prisma.lead.create({
    data: {
      phone: '+912212345678',
      name: 'Priya Mehta',
      agentId: agent.id,
      state: 'VISIT_SCHEDULED',
      classification: 'HOT',
      score: 90,
      consent: true,
      consentSource: 'inbound_message',
      consentAt: at(3, 10),
      lastInboundAt: hoursAgo(2),
      source: 'inbound',
      createdAt: at(3, 10),
      qualificationResult: {
        create: {
          intent: 'buy',
          propertyType: 'apartment',
          bhk: 3,
          budgetMin: C(1.8),
          budgetMax: C(2.2),
          preferredLocations: ['Bandra West', 'Khar West', 'Mumbai'],
          timeline: 'immediate',
          financing: 'loan',
          name: 'Priya Mehta',
          preferredContactTime: null,
          notes: 'HDFC pre-approved loan. Current rental ending in 3 weeks. Prefers morning visits.',
        },
      },
      stateTransitions: {
        create: [
          { fromState: 'NEW', toState: 'GREETED', reason: 'continue', createdAt: at(3, 10, 0) },
          { fromState: 'GREETED', toState: 'QUALIFYING', reason: 'qualify', createdAt: at(3, 9, 45) },
          { fromState: 'QUALIFYING', toState: 'QUALIFIED_HOT', reason: 'offer_visit', createdAt: at(2, 15, 0) },
          { fromState: 'QUALIFIED_HOT', toState: 'VISIT_OFFERED', reason: 'offer_visit', createdAt: at(2, 14, 50) },
          { fromState: 'VISIT_OFFERED', toState: 'VISIT_SCHEDULED', reason: 'visit_confirmed', createdAt: hoursAgo(2) },
        ],
      },
      siteVisits: {
        create: [
          { agentId: agent.id, propertyId: prop1.id, scheduledAt: visit1At, status: 'confirmed', confirmedAt: hoursAgo(2), durationMinutes: 60, notes: `${prop1.title}\n${prop1.address}` },
          { agentId: agent.id, propertyId: prop1.id, scheduledAt: visit1b, status: 'cancelled', durationMinutes: 60 },
          { agentId: agent.id, propertyId: prop1.id, scheduledAt: visit1c, status: 'cancelled', durationMinutes: 60 },
        ],
      },
      conversation: {
        create: {
          messages: {
            create: [
              { role: 'lead', direction: 'inbound', body: "Hi, I'm Priya. Looking to buy a 3BHK flat in Bandra West, Mumbai. My budget is around 2 crore.", createdAt: at(3, 10, 0) },
              { role: 'assistant', direction: 'outbound', body: "Hi Priya! Bandra West is a great choice — we have some lovely 3BHK options in your budget. When are you planning to move in? Looking immediately, in the next few months, or still exploring?", createdAt: at(3, 9, 58) },
              { role: 'lead', direction: 'inbound', body: "We need to move immediately — my current rental agreement ends in 3 weeks.", createdAt: at(3, 9, 45) },
              { role: 'assistant', direction: 'outbound', body: "Understood, that's urgent! Will you be arranging a home loan or paying in cash?", createdAt: at(3, 9, 43) },
              { role: 'lead', direction: 'inbound', body: "I have a pre-approved home loan from HDFC Bank. Up to 1.6 crore.", createdAt: at(2, 15, 5) },
              { role: 'assistant', direction: 'outbound', body: "Excellent — pre-approved makes things much faster! I have a beautiful 3BHK in Bandra West priced at ₹1.9 Cr, fully furnished with sea view and parking. Shall I arrange a site visit this week?", createdAt: at(2, 15, 3) },
              { role: 'lead', direction: 'inbound', body: "Yes please, show me the available time slots.", createdAt: at(2, 14, 55) },
              { role: 'assistant', direction: 'outbound', body: `Great news, Priya! I'd love to arrange a site visit for you. 🏡\n\nHere are some available slots:\n\n1️⃣ ${fmt(visit1At)}\n2️⃣ ${fmt(visit1b)}\n3️⃣ ${fmt(visit1c)}\n\nWhich one works best for you? Just reply with the number (1, 2, or 3)! 😊`, createdAt: at(2, 14, 48) },
              { role: 'lead', direction: 'inbound', body: "1", createdAt: hoursAgo(2) },
              { role: 'assistant', direction: 'outbound', body: `Your site visit is confirmed! 🎉\n\n📅 ${fmt(visit1At)}\n\nOur agent Raj Sharma will be there to show you around. He'll call you an hour before to confirm. See you then! 🏡`, createdAt: hoursAgo(2) },
            ],
          },
        },
      },
      notifications: {
        create: [
          {
            agentId: agent.id,
            type: 'hot_lead',
            title: '🔥 HOT Lead: Priya Mehta',
            body: 'Priya Mehta scored 90/100. Intent: Buy 3BHK Bandra West, budget ₹1.8–2.2 Cr, immediate timeline. HDFC pre-approved loan.',
            sentAt: at(2, 14, 45),
            createdAt: at(2, 14, 45),
          },
          {
            agentId: agent.id,
            type: 'site_visit_booked',
            title: `Visit Booked: Priya Mehta`,
            body: `📅 SITE VISIT BOOKED\nLead: Priya Mehta\nPhone: +912212345678\nSlot: ${fmt(visit1At)}\nProperty: 3BHK Premium Apartment — Bandra West\nLocation: Plot 12B, Sea View Heights, Bandstand, Bandra West, Mumbai - 400050`,
            sentAt: hoursAgo(2),
            createdAt: hoursAgo(2),
          },
        ],
      },
    },
  });
  console.log('✅  Lead 1: Priya Mehta — VISIT_SCHEDULED / HOT / 90');

  // ──────────────────────────────────────────────────────────────────────────
  // LEAD 2: Kiran Desai — VISIT_OFFERED / HOT / score 80
  //   Full qualification, 1-3 months timeline, cash. Slots offered, waiting.
  //   Score: name(5)+intent(5)+type(5)+bhk(3)+budget(7)+loc(5) = 30
  //          + 1_3_months(20) + buy(20) + cash(10) + no_contact(0) = 80
  // ──────────────────────────────────────────────────────────────────────────
  const visit2a = nextWeekday(1, 9, 0);
  const visit2b = nextWeekday(2, 9, 0);
  const visit2c = nextWeekday(3, 9, 0);

  await prisma.lead.create({
    data: {
      phone: '+919823456789',
      name: 'Kiran Desai',
      agentId: agent.id,
      state: 'VISIT_OFFERED',
      classification: 'HOT',
      score: 80,
      consent: true,
      consentSource: 'inbound_message',
      consentAt: at(5, 11),
      lastInboundAt: hoursAgo(3),
      source: 'inbound',
      createdAt: at(5, 11),
      qualificationResult: {
        create: {
          intent: 'buy',
          propertyType: 'villa',
          bhk: 4,
          budgetMin: C(3.2),
          budgetMax: C(3.8),
          preferredLocations: ['Koregaon Park', 'Kalyani Nagar', 'Pune'],
          timeline: '1_3_months',
          financing: 'cash',
          name: 'Kiran Desai',
          preferredContactTime: null,
          notes: 'Relocating from Bangalore. Cash buyer, no loan needed. Wants gated community.',
        },
      },
      stateTransitions: {
        create: [
          { fromState: 'NEW', toState: 'GREETED', reason: 'continue', createdAt: at(5, 11, 0) },
          { fromState: 'GREETED', toState: 'QUALIFYING', reason: 'qualify', createdAt: at(5, 10, 45) },
          { fromState: 'QUALIFYING', toState: 'QUALIFIED_HOT', reason: 'offer_visit', createdAt: at(4, 16, 0) },
          { fromState: 'QUALIFIED_HOT', toState: 'VISIT_OFFERED', reason: 'offer_visit', createdAt: at(0, 3, 30) },
        ],
      },
      siteVisits: {
        create: [
          { agentId: agent.id, propertyId: prop2.id, scheduledAt: visit2a, status: 'offered', durationMinutes: 90, notes: `${prop2.title}\n${prop2.address}` },
          { agentId: agent.id, propertyId: prop2.id, scheduledAt: visit2b, status: 'offered', durationMinutes: 90, notes: `${prop2.title}\n${prop2.address}` },
          { agentId: agent.id, propertyId: prop2.id, scheduledAt: visit2c, status: 'offered', durationMinutes: 90, notes: `${prop2.title}\n${prop2.address}` },
        ],
      },
      conversation: {
        create: {
          messages: {
            create: [
              { role: 'lead', direction: 'inbound', body: "Hello, I'm looking to buy a luxury villa in Pune. Specifically interested in Koregaon Park or Kalyani Nagar area.", createdAt: at(5, 11, 0) },
              { role: 'assistant', direction: 'outbound', body: "Hi there! Koregaon Park has some stunning villas — great choice! What's your budget range for the property?", createdAt: at(5, 10, 58) },
              { role: 'lead', direction: 'inbound', body: "My name is Kiran. Budget around 3 to 4 crore. I want 4 bedrooms minimum, independent villa with garden.", createdAt: at(5, 10, 45) },
              { role: 'assistant', direction: 'outbound', body: "Hi Kiran! A ₹3–4 Cr budget for an independent 4BHK villa in Koregaon Park is very workable. When are you planning to make this purchase?", createdAt: at(5, 10, 43) },
              { role: 'lead', direction: 'inbound', body: "Probably in the next 2 months. I'm relocating from Bangalore — my company transfer is confirmed for August.", createdAt: at(4, 16, 0) },
              { role: 'assistant', direction: 'outbound', body: "Perfect, that gives us a good window! Will you be arranging a home loan or buying in cash?", createdAt: at(4, 15, 58) },
              { role: 'lead', direction: 'inbound', body: "Cash purchase. I've sold my Bangalore apartment and have the funds ready.", createdAt: at(4, 15, 45) },
              { role: 'assistant', direction: 'outbound', body: "Excellent — cash purchase makes this very straightforward! I have a beautiful 4BHK standalone villa in Koregaon Park with a private pool, 3-car garage, and landscaped garden at ₹3.5 Cr. Shall I arrange a site visit?", createdAt: at(4, 15, 43) },
              { role: 'lead', direction: 'inbound', body: "Yes, I'm planning to fly to Pune next week. Please share some slot options.", createdAt: at(0, 3, 30) },
              { role: 'assistant', direction: 'outbound', body: `Great news, Kiran! I'd love to arrange a site visit for you. 🏡\n\nHere are some available slots:\n\n1️⃣ ${fmt(visit2a)}\n2️⃣ ${fmt(visit2b)}\n3️⃣ ${fmt(visit2c)}\n\nWhich one works best for you? Just reply with the number (1, 2, or 3)! 😊`, createdAt: at(0, 3, 25) },
              { role: 'lead', direction: 'inbound', body: "Let me check with my wife and confirm shortly. Which property specifically will we visit — can you share the address?", createdAt: at(0, 3, 0) },
            ],
          },
        },
      },
      notifications: {
        create: [
          {
            agentId: agent.id,
            type: 'hot_lead',
            title: '🔥 HOT Lead: Kiran Desai',
            body: 'Kiran Desai scored 80/100. Intent: Buy 4BHK Villa Koregaon Park, budget ₹3.2–3.8 Cr, 1–3 months, cash purchase. Relocating from Bangalore.',
            sentAt: at(4, 16, 0),
            createdAt: at(4, 16, 0),
          },
        ],
      },
    },
  });
  console.log('✅  Lead 2: Kiran Desai — VISIT_OFFERED / HOT / 80');

  // ──────────────────────────────────────────────────────────────────────────
  // LEAD 3: Rohan Joshi — QUALIFIED_HOT / HOT / score 73
  //   Immediate intent, no budget disclosed yet. Just crossed HOT threshold.
  //   Score: name(5)+intent(5)+type(5)+bhk(3)+no_budget(0)+loc(5) = 23
  //          + immediate(30) + buy(20) + no_financing(0) + no_contact(0) = 73
  // ──────────────────────────────────────────────────────────────────────────
  await prisma.lead.create({
    data: {
      phone: '+919834567890',
      name: 'Rohan Joshi',
      agentId: agent.id,
      state: 'QUALIFIED_HOT',
      classification: 'HOT',
      score: 73,
      consent: true,
      consentSource: 'inbound_message',
      consentAt: at(1, 10, 0),
      lastInboundAt: hoursAgo(1),
      source: 'inbound',
      createdAt: at(1, 10, 0),
      qualificationResult: {
        create: {
          intent: 'buy',
          propertyType: 'apartment',
          bhk: 2,
          budgetMin: null,
          budgetMax: null,
          preferredLocations: ['Andheri West', 'Versova', 'Mumbai'],
          timeline: 'immediate',
          financing: 'unknown',
          name: 'Rohan Joshi',
          preferredContactTime: null,
          notes: 'Looking for 2BHK near Andheri West metro. Budget not yet disclosed.',
        },
      },
      stateTransitions: {
        create: [
          { fromState: 'NEW', toState: 'GREETED', reason: 'continue', createdAt: at(1, 10, 0) },
          { fromState: 'GREETED', toState: 'QUALIFYING', reason: 'qualify', createdAt: at(1, 10, 0) },
          { fromState: 'QUALIFYING', toState: 'QUALIFIED_HOT', reason: 'qualify', createdAt: hoursAgo(1) },
        ],
      },
      conversation: {
        create: {
          messages: {
            create: [
              { role: 'lead', direction: 'inbound', body: "Hi, I need to buy a 2BHK flat in Andheri West urgently. My name is Rohan.", createdAt: at(1, 10, 0) },
              { role: 'assistant', direction: 'outbound', body: "Hi Rohan! Andheri West is a fantastic choice — great connectivity and vibrant neighbourhood. How soon are you planning to buy?", createdAt: at(1, 10, 0) },
              { role: 'lead', direction: 'inbound', body: "I need to move within the next 30 days. It's quite urgent, I'm currently staying in a hotel.", createdAt: at(1, 10, 0) },
              { role: 'assistant', direction: 'outbound', body: "I completely understand — staying in a hotel is not ideal! Do you have a home loan arranged, or will this be a cash purchase?", createdAt: at(1, 10, 0) },
              { role: 'lead', direction: 'inbound', body: "I'll need to figure out the financing. Can you first show me what's available in Andheri West and Versova area?", createdAt: hoursAgo(1) },
              { role: 'assistant', direction: 'outbound', body: "Of course! I have a few 2BHK options in Andheri West — brand new with rooftop club access. To find the best match, could you share your approximate budget range?", createdAt: hoursAgo(1) },
            ],
          },
        },
      },
    },
  });
  console.log('✅  Lead 3: Rohan Joshi — QUALIFIED_HOT / HOT / 73');

  // ──────────────────────────────────────────────────────────────────────────
  // LEAD 4: Anjali Singh — QUALIFYING / NURTURE / score 45
  //   Rental intent, partial info, 3-6 months timeline.
  //   Score: name(5)+intent(5)+type(5)+no_bhk+no_budget+no_loc = 15
  //          + 3_6_months(10) + rent(20) + no_financing(0) + no_contact(0) = 45
  // ──────────────────────────────────────────────────────────────────────────
  await prisma.lead.create({
    data: {
      phone: '+917845678901',
      name: 'Anjali Singh',
      agentId: agent.id,
      state: 'QUALIFYING',
      classification: 'NURTURE',
      score: 45,
      consent: true,
      consentSource: 'inbound_message',
      consentAt: at(2, 14, 45),
      lastInboundAt: hoursAgo(6),
      source: 'inbound',
      createdAt: at(2, 14, 45),
      qualificationResult: {
        create: {
          intent: 'rent',
          propertyType: 'apartment',
          bhk: null,
          budgetMin: null,
          budgetMax: null,
          preferredLocations: [],
          timeline: '3_6_months',
          financing: 'unknown',
          name: 'Anjali Singh',
          preferredContactTime: null,
          notes: 'Looking to rent, shifting in 3-4 months. No specific area preference yet.',
        },
      },
      stateTransitions: {
        create: [
          { fromState: 'NEW', toState: 'GREETED', reason: 'continue', createdAt: at(2, 14, 48) },
          { fromState: 'GREETED', toState: 'QUALIFYING', reason: 'qualify', createdAt: at(2, 14, 48) },
        ],
      },
      conversation: {
        create: {
          messages: {
            create: [
              { role: 'lead', direction: 'inbound', body: "Hello, I'm Anjali. I'm looking to rent an apartment sometime in the next few months.", createdAt: at(2, 14, 48) },
              { role: 'assistant', direction: 'outbound', body: "Hi Anjali! Happy to help you find a rental. Are you looking for an apartment, villa, or something else?", createdAt: at(2, 14, 48) },
              { role: 'lead', direction: 'inbound', body: "Apartment is fine. Probably looking in the next 3-4 months, nothing too urgent.", createdAt: at(2, 14, 48) },
              { role: 'assistant', direction: 'outbound', body: "Got it! How many bedrooms are you looking for?", createdAt: at(2, 14, 48) },
              { role: 'lead', direction: 'inbound', body: "Either 2 or 3BHK. Haven't decided. Depends on the price honestly.", createdAt: hoursAgo(6) },
              { role: 'assistant', direction: 'outbound', body: "Understood! What's your monthly rental budget in mind?", createdAt: hoursAgo(6) },
            ],
          },
        },
      },
    },
  });
  console.log('✅  Lead 4: Anjali Singh — QUALIFYING / NURTURE / 45');

  // ──────────────────────────────────────────────────────────────────────────
  // LEAD 5: Vikram Nair — NURTURING / NURTURE / score 35
  //   Early stage buyer, exploring, long timeline. In nurture sequence.
  //   Score: no_name(0)+intent(5)+no_type+no_bhk+no_budget+loc(5) = 10
  //          + exploring(5) + buy(20) + no_financing + no_contact = 35
  // ──────────────────────────────────────────────────────────────────────────
  await prisma.lead.create({
    data: {
      phone: '+916789012345',
      name: 'Vikram Nair',
      agentId: agent.id,
      state: 'NURTURING',
      classification: 'NURTURE',
      score: 35,
      consent: true,
      consentSource: 'inbound_message',
      consentAt: at(10, 11, 0),
      lastInboundAt: at(10, 11, 0),
      source: 'inbound',
      createdAt: at(10, 11, 0),
      qualificationResult: {
        create: {
          intent: 'buy',
          propertyType: 'unknown',
          bhk: null,
          budgetMin: null,
          budgetMax: null,
          preferredLocations: ['Mumbai'],
          timeline: 'exploring',
          financing: 'unknown',
          name: 'Vikram Nair',
          preferredContactTime: null,
          notes: 'Early-stage investor. Exploring options. No urgency. Follow up monthly.',
        },
      },
      stateTransitions: {
        create: [
          { fromState: 'NEW', toState: 'GREETED', reason: 'continue', createdAt: at(10, 11, 0) },
          { fromState: 'GREETED', toState: 'QUALIFYING', reason: 'qualify', createdAt: at(10, 10, 45) },
          { fromState: 'QUALIFYING', toState: 'QUALIFIED_COLD', reason: 'qualify', createdAt: at(10, 10, 30) },
          { fromState: 'QUALIFIED_COLD', toState: 'NURTURING', reason: 'nurture', createdAt: at(9, 8, 0) },
        ],
      },
      followUpJobs: {
        create: [
          { sequenceStep: 1, runAt: at(9, 8), status: 'sent', sentAt: at(9, 8) },
          { sequenceStep: 2, runAt: at(7, 8), status: 'sent', sentAt: at(7, 8) },
          { sequenceStep: 3, runAt: daysAhead(4), status: 'pending' },
          { sequenceStep: 4, runAt: daysAhead(11), status: 'pending' },
        ],
      },
      conversation: {
        create: {
          messages: {
            create: [
              { role: 'lead', direction: 'inbound', body: "Hi, I saw your ad. I'm thinking about buying property in Mumbai but not in any rush.", createdAt: at(10, 11, 0) },
              { role: 'assistant', direction: 'outbound', body: "Hi there! Great to hear from you. Mumbai is always a solid investment. Are you looking for a flat, villa, or commercial space?", createdAt: at(10, 10, 58) },
              { role: 'lead', direction: 'inbound', body: "Probably residential. I'm Vikram by the way. Just browsing for now.", createdAt: at(10, 10, 45) },
              { role: 'assistant', direction: 'outbound', body: "Hi Vikram! Exploring is a great first step. When do you think you might be ready to make a decision?", createdAt: at(10, 10, 43) },
              { role: 'lead', direction: 'inbound', body: "Maybe a year from now? I want to understand the market first.", createdAt: at(10, 10, 30) },
              { role: 'assistant', direction: 'outbound', body: "That makes complete sense! I'll keep you updated with good options as they come up. You can reach out any time you have questions.", createdAt: at(9, 9, 0) },
              { role: 'assistant', direction: 'outbound', body: "👋 Hi Vikram, just checking in! The Mumbai property market has been active recently. Would you like to schedule a quick call to discuss your requirements?", createdAt: at(9, 8, 30) },
              { role: 'assistant', direction: 'outbound', body: "Hello Vikram! A new listing just came in that might interest you — 2BHK in Andheri West at ₹88L. Let me know if you'd like more details! 🏠", createdAt: at(7, 8, 0) },
            ],
          },
        },
      },
    },
  });
  console.log('✅  Lead 5: Vikram Nair — NURTURING / NURTURE / 35');

  // ──────────────────────────────────────────────────────────────────────────
  // LEAD 6: Meera Pillai — GREETED / UNSCORED / score 0
  //   Just sent first message. AI greeted, waiting for response.
  // ──────────────────────────────────────────────────────────────────────────
  await prisma.lead.create({
    data: {
      phone: '+918890123456',
      name: null,
      agentId: agent.id,
      state: 'GREETED',
      classification: 'UNSCORED',
      score: 0,
      consent: true,
      consentSource: 'inbound_message',
      consentAt: hoursAgo(1),
      lastInboundAt: at(0, 1, 3),
      source: 'inbound',
      createdAt: hoursAgo(1),
      stateTransitions: {
        create: [
          { fromState: 'NEW', toState: 'GREETED', reason: 'continue', createdAt: at(0, 1, 2) },
        ],
      },
      conversation: {
        create: {
          messages: {
            create: [
              { role: 'lead', direction: 'inbound', body: "Hello, are you the real estate guys? I saw your number on the banner near Powai lake.", createdAt: at(0, 1, 5) },
              { role: 'assistant', direction: 'outbound', body: "Hi there! Yes, you've reached LeadPilot Real Estate. 😊 I'd love to help you find your perfect property. Are you looking to buy or rent?", createdAt: at(0, 1, 3) },
            ],
          },
        },
      },
    },
  });
  console.log('✅  Lead 6: Meera Pillai — GREETED / UNSCORED / 0');

  // ──────────────────────────────────────────────────────────────────────────
  // LEAD 7: Unknown — NEW / UNSCORED / score 0
  //   Just came in via webhook. No conversation started yet.
  // ──────────────────────────────────────────────────────────────────────────
  await prisma.lead.create({
    data: {
      phone: '+917712345678',
      name: null,
      agentId: agent.id,
      state: 'NEW',
      classification: 'UNSCORED',
      score: 0,
      consent: false,
      source: 'webhook',
      createdAt: hoursAgo(0.5),
    },
  });
  console.log('✅  Lead 7: Unknown — NEW / UNSCORED / 0');

  // ──────────────────────────────────────────────────────────────────────────
  // LEAD 8: Suresh Kumar — HANDED_OFF / HOT / score 87
  //   Full qualification but explicitly asked for a human agent.
  //   Score: name(5)+intent(5)+type(5)+bhk(3)+budget(7)+loc(5) = 30
  //          + immediate(30) + buy(20) + cash(10) + no_contact(0) = 90
  //          (actually no BHK for commercial, so 30-3=27 → 27+30+20+10 = 87)
  // ──────────────────────────────────────────────────────────────────────────
  await prisma.lead.create({
    data: {
      phone: '+919901234567',
      name: 'Suresh Kumar',
      agentId: agent.id,
      state: 'HANDED_OFF',
      classification: 'HOT',
      score: 87,
      consent: true,
      consentSource: 'inbound_message',
      consentAt: at(1, 10, 0),
      lastInboundAt: hoursAgo(3),
      source: 'inbound',
      createdAt: at(1, 10, 0),
      qualificationResult: {
        create: {
          intent: 'buy',
          propertyType: 'commercial',
          bhk: null,
          budgetMin: C(1.5),
          budgetMax: C(1.8),
          preferredLocations: ['Hinjawadi', 'Baner', 'Pune'],
          timeline: 'immediate',
          financing: 'cash',
          name: 'Suresh Kumar',
          preferredContactTime: null,
          notes: 'Wants Grade-A office space. Expanding startup. Wants to speak directly to agent. High priority.',
        },
      },
      stateTransitions: {
        create: [
          { fromState: 'NEW', toState: 'GREETED', reason: 'continue', createdAt: at(1, 10, 0) },
          { fromState: 'GREETED', toState: 'QUALIFYING', reason: 'qualify', createdAt: at(1, 10, 0) },
          { fromState: 'QUALIFYING', toState: 'QUALIFIED_HOT', reason: 'qualify', createdAt: hoursAgo(5) },
          { fromState: 'QUALIFIED_HOT', toState: 'HANDED_OFF', reason: 'handoff', createdAt: hoursAgo(3) },
        ],
      },
      conversation: {
        create: {
          messages: {
            create: [
              { role: 'lead', direction: 'inbound', body: "Hi, I need commercial office space in Pune — specifically Hinjawadi or Baner IT corridor.", createdAt: at(1, 10, 0) },
              { role: 'assistant', direction: 'outbound', body: "Hi there! Hinjawadi IT Park is a great choice for office space. What's your approximate budget and how much square footage are you looking at?", createdAt: at(1, 10, 0) },
              { role: 'lead', direction: 'inbound', body: "I'm Suresh. Budget is 1.5 to 2 crore for a purchase. Need around 2000-2500 sq ft, preferably in a premium building.", createdAt: at(1, 10, 0) },
              { role: 'assistant', direction: 'outbound', body: "Hi Suresh! ₹1.5–2 Cr for 2000–2500 sq ft in Hinjawadi is very realistic. When are you looking to move in?", createdAt: at(1, 10, 0) },
              { role: 'lead', direction: 'inbound', body: "We need it immediately — we're currently working from a co-working space and our team is growing fast.", createdAt: at(1, 10, 0) },
              { role: 'assistant', direction: 'outbound', body: "Perfect! Will this be a purchase in cash or via a business loan?", createdAt: at(1, 10, 0) },
              { role: 'lead', direction: 'inbound', body: "Cash purchase. We recently closed a funding round. Can I speak directly to your agent? I'd prefer to handle this over a call rather than chat.", createdAt: hoursAgo(3) },
              { role: 'assistant', direction: 'outbound', body: "Absolutely, Suresh! Let me connect you with our senior agent Raj Sharma right away. He'll call you within the next 30 minutes. 😊", createdAt: hoursAgo(3) },
            ],
          },
        },
      },
      notifications: {
        create: [
          {
            agentId: agent.id,
            type: 'hot_lead',
            title: '🔥 HOT Lead: Suresh Kumar',
            body: 'Suresh Kumar scored 87/100. Intent: Buy commercial office Hinjawadi, budget ₹1.5–1.8 Cr, immediate, cash. Requested agent call.',
            sentAt: hoursAgo(5),
            createdAt: hoursAgo(5),
          },
          {
            agentId: agent.id,
            type: 'handoff',
            title: '🤝 Handoff: Suresh Kumar',
            body: 'Lead requested to speak to a human agent. Score: 87. Please call +919901234567 within 30 minutes.',
            sentAt: hoursAgo(3),
            createdAt: hoursAgo(3),
          },
        ],
      },
    },
  });
  console.log('✅  Lead 8: Suresh Kumar — HANDED_OFF / HOT / 87');

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n🎉  Seed complete!');
  console.log('    Agent  : Raj Sharma');
  console.log('    Leads  : 8');
  console.log('    Pipeline:');
  console.log('      VISIT_SCHEDULED  Priya Mehta   HOT  90');
  console.log('      VISIT_OFFERED    Kiran Desai   HOT  80');
  console.log('      QUALIFIED_HOT    Rohan Joshi   HOT  73');
  console.log('      QUALIFYING       Anjali Singh  NURTURE  45');
  console.log('      NURTURING        Vikram Nair   NURTURE  35');
  console.log('      GREETED          Meera Pillai  UNSCORED  0');
  console.log('      NEW              Unknown       UNSCORED  0');
  console.log('      HANDED_OFF       Suresh Kumar  HOT  87');
  // ── Demo User (login: raj.sharma@leadpilot.dev / demo1234) ────────────────
  // Hash: bcrypt.hashSync('demo1234', 12)
  await prisma.user.create({
    data: {
      email: 'raj.sharma@leadpilot.dev',
      // bcrypt hash of 'demo1234' with salt rounds=12
      passwordHash: '$2b$12$uRh2EXNeC3zts6gfWcc7dek9XN6ZLLQ66B.R0LjlWWnIV5rQeHJgO',
      agentId: agent.id,
    },
  });
  console.log('✅  Demo user: raj.sharma@leadpilot.dev / demo1234');

  console.log('\n    Dashboard: http://localhost:3000/leads');
}

// ─── formatDateTime (mirrors visit.service.ts) ────────────────────────────────

function fmt(d: Date): string {
  const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dow = days[d.getDay()]  ?? '';
  const mon = months[d.getMonth()] ?? '';
  const h   = d.getHours();
  const m   = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const time = m === 0 ? `${h12}:00 ${ampm}` : `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
  return `${dow}, ${d.getDate()} ${mon} at ${time}`;
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => void prisma.$disconnect());
