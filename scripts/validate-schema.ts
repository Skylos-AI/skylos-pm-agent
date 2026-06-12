/**
 * Post-seed sanity check for Phase 1.
 *
 * Asserts the acceptance criteria from v1.txt:
 *   - 3 users with valid E.164 whatsapp_number
 *   - 6 personas, all language = "es"
 *   - >= 100 companies with non-null nit and department
 *   - >= 5 projects linked to real companies
 *   - >= 10 pipeline_deals across >= 3 distinct stages
 *   - >= 5 OPEN tasks per user (TODO, IN_PROGRESS, BLOCKED)
 *   - all foreign keys resolve (no orphan rows)
 *
 * Exit 0 on success, 1 with a clear error message on failure.
 */

import { prisma } from "../src/lib/prisma";
import { TaskStatus } from "@prisma/client";

const E164 = /^\+[1-9]\d{7,14}$/;

const failures: string[] = [];

function check(condition: boolean, message: string) {
  if (!condition) failures.push(message);
}

async function main() {
  // ----- users -----
  const users = await prisma.user.findMany();
  check(users.length === 3, `expected 3 users, found ${users.length}`);
  for (const u of users) {
    check(
      !!u.whatsappNumber && E164.test(u.whatsappNumber),
      `user ${u.email} has invalid E.164 whatsapp_number: ${u.whatsappNumber ?? "null"}`,
    );
  }

  // ----- personas -----
  const personas = await prisma.persona.findMany();
  check(personas.length === 6, `expected 6 personas, found ${personas.length}`);
  for (const p of personas) {
    check(p.language === "es", `persona ${p.name} has language=${p.language}, expected "es"`);
  }

  // ----- companies -----
  const companiesWithNitAndDept = await prisma.company.count({
    where: { nit: { not: null }, department: { not: null } },
  });
  check(
    companiesWithNitAndDept >= 100,
    `expected >= 100 companies with nit + department, found ${companiesWithNitAndDept}`,
  );

  // ----- projects -----
  const projects = await prisma.project.findMany({ include: { company: true } });
  check(projects.length >= 5, `expected >= 5 projects, found ${projects.length}`);
  for (const proj of projects) {
    check(!!proj.company, `project ${proj.name} has no resolvable company`);
  }

  // ----- pipeline deals -----
  const deals = await prisma.pipelineDeal.findMany();
  check(deals.length >= 10, `expected >= 10 pipeline_deals, found ${deals.length}`);
  const distinctStages = new Set(deals.map((d) => d.stage));
  check(
    distinctStages.size >= 3,
    `expected pipeline_deals across >= 3 distinct stages, found ${distinctStages.size}`,
  );

  // ----- tasks: >= 5 open per user -----
  for (const u of users) {
    const openCount = await prisma.task.count({
      where: {
        assigneeId: u.id,
        status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED] },
      },
    });
    check(
      openCount >= 5,
      `user ${u.email} has ${openCount} open tasks, expected >= 5`,
    );
  }

  // ----- foreign-key integrity (no orphans) -----
  // Required FKs are DB-enforced, so they can't dangle. Verify the optional
  // FK columns we actually set (task.project_id, activity.project_id,
  // activity.contact_id, reminder.*) point at rows that exist.
  type OrphanRow = { count: bigint };
  const orphanChecks: Array<{ label: string; sql: string }> = [
    {
      label: "tasks.project_id → projects.id",
      sql: `select count(*)::bigint as count from tasks t
            where t.project_id is not null
              and not exists (select 1 from projects p where p.id = t.project_id)`,
    },
    {
      label: "activities.project_id → projects.id",
      sql: `select count(*)::bigint as count from activities a
            where a.project_id is not null
              and not exists (select 1 from projects p where p.id = a.project_id)`,
    },
    {
      label: "activities.contact_id → contacts.id",
      sql: `select count(*)::bigint as count from activities a
            where a.contact_id is not null
              and not exists (select 1 from contacts c where c.id = a.contact_id)`,
    },
    {
      label: "reminders.related_company_id → companies.id",
      sql: `select count(*)::bigint as count from reminders r
            where r.related_company_id is not null
              and not exists (select 1 from companies c where c.id = r.related_company_id)`,
    },
  ];
  for (const o of orphanChecks) {
    const [row] = await prisma.$queryRawUnsafe<OrphanRow[]>(o.sql);
    check(row.count === 0n, `${row.count} orphan rows on ${o.label}`);
  }

  // ----- report -----
  if (failures.length === 0) {
    console.log("✓ Phase 1 schema validation passed");
    console.log(`  users:      ${users.length}`);
    console.log(`  personas:   ${personas.length}`);
    console.log(`  companies:  ${companiesWithNitAndDept} (with nit + department)`);
    console.log(`  projects:   ${projects.length}`);
    console.log(`  deals:      ${deals.length} across ${distinctStages.size} stages`);
    process.exit(0);
  } else {
    console.error("✗ Phase 1 schema validation failed:");
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
