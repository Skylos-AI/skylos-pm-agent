/**
 * Wipes all transactional data + placeholder users so we can start fresh.
 *
 * Deletes (in FK-safe order): agent_log, reminders, activities, tasks,
 * pipeline_deals, projects, contacts, companies.
 *
 * Also deletes users whose full_name contains "Placeholder" — these are
 * the seeded Eduardo / Claudio stand-ins. Real teammates get invited
 * through Supabase Auth and won't carry that marker.
 *
 * KEEPS real users + personas (those are the team + persona templates).
 *
 * Run with: npm run wipe
 */

import { prisma } from "../src/lib/prisma";

async function main() {
  // FK-safe deletion order (children before parents)
  const r1 = await prisma.agentLog.deleteMany();
  const r2 = await prisma.reminder.deleteMany();
  const r3 = await prisma.activity.deleteMany();
  const r4 = await prisma.task.deleteMany();
  const r5 = await prisma.pipelineDeal.deleteMany();
  const r6 = await prisma.project.deleteMany();
  const r7 = await prisma.contact.deleteMany();
  const r8 = await prisma.company.deleteMany();

  // Now safe to drop placeholder team members — no rows reference them.
  const r9 = await prisma.user.deleteMany({
    where: { fullName: { contains: "Placeholder" } },
  });

  console.log("✓ wiped:");
  console.log(`  agent_log:        ${r1.count}`);
  console.log(`  reminders:        ${r2.count}`);
  console.log(`  activities:       ${r3.count}`);
  console.log(`  tasks:            ${r4.count}`);
  console.log(`  pipeline_deals:   ${r5.count}`);
  console.log(`  projects:         ${r6.count}`);
  console.log(`  contacts:         ${r7.count}`);
  console.log(`  companies:        ${r8.count}`);
  console.log(`  placeholder users: ${r9.count}`);

  const remaining = await prisma.user.findMany({
    select: { email: true, fullName: true, role: true },
    orderBy: { fullName: "asc" },
  });
  const personasKept = await prisma.persona.count();
  console.log(`  (kept ${remaining.length} real users + ${personasKept} personas)`);
  for (const u of remaining) {
    console.log(`    · ${u.fullName} <${u.email}> [${u.role}]`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
