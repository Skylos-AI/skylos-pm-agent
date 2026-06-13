const { getClient } = require("./supabase");
const { appError } = require("./envelope");

async function findCompanyByAny({ id, nit, name }) {
  const supa = getClient();
  if (id) {
    const { data, error } = await supa
      .from("companies")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw appError("DB_ERROR", error.message);
    if (!data) throw appError("NOT_FOUND", `Empresa ${id} no encontrada.`);
    return data;
  }
  if (nit) {
    const { data, error } = await supa
      .from("companies")
      .select("*")
      .eq("nit", nit)
      .maybeSingle();
    if (error) throw appError("DB_ERROR", error.message);
    if (!data) throw appError("NOT_FOUND", `Empresa con NIT ${nit} no encontrada.`);
    return data;
  }
  if (name) {
    const { data, error } = await supa
      .from("companies")
      .select("*")
      .ilike("name", `%${name}%`)
      .limit(5);
    if (error) throw appError("DB_ERROR", error.message);
    if (!data || data.length === 0) {
      throw appError("NOT_FOUND", `Empresa que coincida con "${name}" no encontrada.`);
    }
    if (data.length > 1) {
      throw appError(
        "VALIDATION",
        `Múltiples coincidencias para "${name}". Especifica con --id o --nit.`,
        { candidates: data.map((c) => ({ id: c.id, name: c.name, nit: c.nit })) },
      );
    }
    return data[0];
  }
  throw appError("INVALID_ARGS", "Provee --id, --nit, o --name.");
}

async function findProjectByAny({ id, name }) {
  const supa = getClient();
  if (id) {
    const { data, error } = await supa
      .from("projects")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw appError("DB_ERROR", error.message);
    if (!data) throw appError("NOT_FOUND", `Proyecto ${id} no encontrado.`);
    return data;
  }
  if (name) {
    const { data, error } = await supa
      .from("projects")
      .select("*")
      .ilike("name", `%${name}%`)
      .limit(5);
    if (error) throw appError("DB_ERROR", error.message);
    if (!data || data.length === 0) {
      throw appError("NOT_FOUND", `Proyecto que coincida con "${name}" no encontrado.`);
    }
    if (data.length > 1) {
      throw appError(
        "VALIDATION",
        `Múltiples coincidencias para "${name}". Especifica con --id.`,
        { candidates: data.map((p) => ({ id: p.id, name: p.name })) },
      );
    }
    return data[0];
  }
  throw appError("INVALID_ARGS", "Provee --id o --name.");
}

async function findTaskByAny({ id, title, assigneeId }) {
  const supa = getClient();
  if (id) {
    const { data, error } = await supa
      .from("tasks")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw appError("DB_ERROR", error.message);
    if (!data) throw appError("NOT_FOUND", `Tarea ${id} no encontrada.`);
    return data;
  }
  if (title) {
    let q = supa.from("tasks").select("*").ilike("title", `%${title}%`).limit(5);
    if (assigneeId) q = q.eq("assignee_id", assigneeId);
    const { data, error } = await q;
    if (error) throw appError("DB_ERROR", error.message);
    if (!data || data.length === 0) {
      throw appError("NOT_FOUND", `Tarea que coincida con "${title}" no encontrada.`);
    }
    if (data.length > 1) {
      throw appError(
        "VALIDATION",
        `Múltiples tareas coinciden con "${title}". Especifica con --id.`,
        { candidates: data.map((t) => ({ id: t.id, title: t.title, status: t.status })) },
      );
    }
    return data[0];
  }
  throw appError("INVALID_ARGS", "Provee --id o --title.");
}

async function findDealByAny({ id, title }) {
  const supa = getClient();
  if (id) {
    const { data, error } = await supa
      .from("pipeline_deals")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw appError("DB_ERROR", error.message);
    if (!data) throw appError("NOT_FOUND", `Negocio ${id} no encontrado.`);
    return data;
  }
  if (title) {
    const { data, error } = await supa
      .from("pipeline_deals")
      .select("*")
      .ilike("title", `%${title}%`)
      .limit(5);
    if (error) throw appError("DB_ERROR", error.message);
    if (!data || data.length === 0) {
      throw appError("NOT_FOUND", `Negocio que coincida con "${title}" no encontrado.`);
    }
    if (data.length > 1) {
      throw appError(
        "VALIDATION",
        `Múltiples negocios coinciden. Especifica con --id.`,
        { candidates: data.map((d) => ({ id: d.id, title: d.title, stage: d.stage })) },
      );
    }
    return data[0];
  }
  throw appError("INVALID_ARGS", "Provee --id o --title.");
}

async function resolveContact({ id, name, companyId }) {
  const supa = getClient();
  if (id) {
    const { data, error } = await supa
      .from("contacts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw appError("DB_ERROR", error.message);
    if (!data) throw appError("NOT_FOUND", `Contacto ${id} no encontrado.`);
    return data;
  }
  if (name) {
    let q = supa.from("contacts").select("*").ilike("full_name", `%${name}%`).limit(5);
    if (companyId) q = q.eq("company_id", companyId);
    const { data, error } = await q;
    if (error) throw appError("DB_ERROR", error.message);
    if (!data || data.length === 0) {
      throw appError("NOT_FOUND", `Contacto "${name}" no encontrado.`);
    }
    if (data.length > 1) {
      throw appError("VALIDATION", `Múltiples contactos coinciden con "${name}".`, {
        candidates: data.map((c) => ({ id: c.id, full_name: c.full_name })),
      });
    }
    return data[0];
  }
  return null;
}

module.exports = {
  findCompanyByAny,
  findProjectByAny,
  findTaskByAny,
  findDealByAny,
  resolveContact,
};
