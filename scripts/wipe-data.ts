/**
 * Wipes all transactional data so we can start fresh.
 *
 * Deletes (in FK-safe order): agent_log, reminders, activities, tasks,
 * pipeline_deals, projects, contacts, companies.
 * KEEPS users + personas (those are the team + persona templates).
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

  console.log("✓ wiped:");
  console.log(`  agent_log:      ${r1.count}`);
  console.log(`  reminders:      ${r2.count}`);
  console.log(`  activities:     ${r3.count}`);
  console.log(`  tasks:          ${r4.count}`);
  console.log(`  pipeline_deals: ${r5.count}`);
  console.log(`  projects:       ${r6.count}`);
  console.log(`  contacts:       ${r7.count}`);
  console.log(`  companies:      ${r8.count}`);

  const usersKept = await prisma.user.count();
  const personasKept = await prisma.persona.count();
  console.log(`  (kept ${usersKept} users + ${personasKept} personas)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
