# skylos-pm — OpenClaw skill

17 Node scripts that give Manu Skylos-specific PM tools over the Supabase schema built in Phase 1. See [SKILL.md](SKILL.md) for the tool index and conventions, and [v2.txt](../../v2.txt) for the full spec.

## Local development

```bash
cd skill
npm install
# Reads from the parent .env or from process env:
export SUPABASE_URL=https://kvtvxawzviqirqbjdsfv.supabase.co
export SUPABASE_SERVICE_ROLE=eyJ...
node scripts/read/get-my-tasks.js --as-user jhonny@skylos.io --status open
```

## Deploy

This skill is a subfolder of the [skylos-pm-agent](https://github.com/JJJRLP/skylos-pm-agent) repo. Deploy by cloning the repo on the VPS and pointing `skill_install` at the subfolder:

```bash
cd /opt/devclaw
git clone https://github.com/JJJRLP/skylos-pm-agent.git
# from Manu:
skill_install(source="/opt/devclaw/skylos-pm-agent/skill")
```

## Updates

```bash
cd /opt/devclaw/skylos-pm-agent && git pull
# from Manu:
skill_install(source="/opt/devclaw/skylos-pm-agent/skill")  # re-runs with new code
```
