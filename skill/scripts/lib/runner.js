const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const { writeAgentLog } = require("./log");
const { ok, err } = require("./envelope");
const { resolveUser } = require("./users");

function emit(payload, exitCode) {
  process.stdout.write(JSON.stringify(payload) + "\n");
  process.exit(exitCode);
}

async function runTool({
  name,
  actionType,
  source = "WHATSAPP",
  yargsBuilder,
  handler,
  requireUser = true,
}) {
  const startedAt = Date.now();
  let agentLogId = null;
  let requestedByUserId = null;
  let user = null;

  try {
    const argv = yargs(hideBin(process.argv))
      .scriptName(`skylos-pm:${name}`)
      .option("as-user", {
        type: "string",
        describe: "Email of the user invoking this tool.",
      })
      .help(false)
      .version(false)
      .strict();
    yargsBuilder(argv);
    const parsed = argv.parseSync();

    if (requireUser) {
      user = await resolveUser(parsed["as-user"]);
      requestedByUserId = user.id;
    }

    const result = await handler(parsed, { user, requestedByUserId });

    const durationMs = Date.now() - startedAt;
    agentLogId = await writeAgentLog({
      source,
      toolCalled: name,
      actionType,
      requestSummary: result.requestSummary ?? "",
      responseSummary: result.summary ?? "",
      entitiesAffected: result.entitiesAffected ?? null,
      status: "SUCCESS",
      durationMs,
      requestedByUserId,
    });

    emit(ok(result.data, result.summary, agentLogId), 0);
  } catch (e) {
    const code = e.code || "UNKNOWN";
    const message = e.message || "Error desconocido";
    const details = e.details || (code === "UNKNOWN" ? { stack: e.stack } : null);
    const durationMs = Date.now() - startedAt;

    agentLogId = await writeAgentLog({
      source,
      toolCalled: name,
      actionType,
      requestSummary: "",
      responseSummary: "",
      status: "ERROR",
      errorMessage: `${code}: ${message}`,
      durationMs,
      requestedByUserId,
    });

    emit(err(code, message, details, agentLogId), 1);
  }
}

module.exports = { runTool };
