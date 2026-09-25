const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

const regexPost = /app\.post\("\/api\/motoboy\/requests"[\s\S]*?(?=app\.get\("\/api\/motoboy\/requests")/;
const replacementPost = `app.post("/api/motoboy/requests", requireAuth, async (req, res) => {
    try {
      const role = getMotoboyRole((req as any).session.user.email || "");
      if (role !== "suporte") {
        return res.status(403).json({ error: "Apenas Suporte TI pode criar solicitações de Motoboy." });
      }

      const data = motoboyCreateSchema.parse(req.body);
      const payloadData = {
        id: generateMotoboyId(),
        ...data,
        status: "Pendente"
      };

      let finalRequest;

      if (process.env.MOTOBOY_STORAGE === "supabase") {
        const supabase = getSupabaseClient();
        const snakeData = toSnakeCase(payloadData);
        const { data: inserted, error } = await supabase.from("motoboy_requests").insert(snakeData).select().single();
        
        if (error) throw new Error(error.message);
        
        await logMotoboyEvent(inserted.id, "created", (req as any).session.user.email, inserted);
        
        finalRequest = toCamelCase(inserted);
      } else {
        const scriptUrl = getMotoboyScriptUrl();
        const payload = {
          action: "createMotoboyRequest",
          data: payloadData
        };

        const response = await fetchWithRetry(scriptUrl, {
          ...createAppsScriptPostOptions(payload),
        });

        const text = await response.text();
        let result;
        try {
          result = JSON.parse(text);
        } catch (e) {
          console.error("Response is not JSON:", text);
          throw new Error("Erro ao processar resposta do script.");
        }

        if (!response.ok || !result.success) {
          throw new Error(result.error || "Erro ao criar solicitação de Motoboy.");
        }
        
        finalRequest = result.data || payload.data;
      }

      clearMotoboyCache();
      res.json({ success: true, request: finalRequest });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.issues[0].message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  `;
code = code.replace(regexPost, replacementPost);

const regexGet = /app\.get\("\/api\/motoboy\/requests"[\s\S]*?(?=app\.patch\("\/api\/motoboy\/requests\/:id")/;
const replacementGet = `app.get("/api/motoboy/requests", requireAuth, async (req, res) => {
    try {
      const role = getMotoboyRole((req as any).session.user.email || "");
      if (role === "none") {
        return res.status(403).json({ error: "Usuário sem acesso à área Motoboy." });
      }

      const cached = motoboyCache[role];
      if (cached && (Date.now() - cached.timestamp < MOTOBOY_CACHE_TTL)) {
        console.log(\`[Motoboy Cache] Servindo requests para a role: \${role}\`);
        return res.json({ success: true, role, requests: cached.requests });
      }

      let validRequests: any[] = [];

      if (process.env.MOTOBOY_STORAGE === "supabase") {
        const supabase = getSupabaseClient();
        let query = supabase.from("motoboy_requests").select("*").neq("status", "Excluído");
        
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        
        validRequests = data.map(toCamelCase).filter(req => req.id);
        
        if (role === "recepcao") {
           validRequests = validRequests.filter(req => req.status !== "Concluído");
        }
      } else {
        const scriptUrl = getMotoboyScriptUrl();
        const query = { action: "listMotoboyRequests", role };
        const response = await fetchWithRetry(\`\${scriptUrl}?action=\${query.action}&role=\${query.role}\`);
        
        const text = await response.text();
        let result;
        try {
          result = JSON.parse(text);
        } catch (e) {
          console.error("Response is not JSON:", text);
          throw new Error("Erro ao processar resposta do script.");
        }

        if (!response.ok || !result.success) {
          throw new Error(result.error || "Erro ao listar solicitações de Motoboy.");
        }
        
        validRequests = filterValidMotoboyRequests(result.data || []);
      }
      
      console.log(\`[Motoboy Cache] Atualizando cache para a role: \${role}\`);
      motoboyCache[role] = { requests: validRequests, timestamp: Date.now() };

      res.json({ success: true, role, requests: validRequests });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  `;
code = code.replace(regexGet, replacementGet);

const regexPatch = /app\.patch\("\/api\/motoboy\/requests\/:id"[\s\S]*?(?=app\.delete\("\/api\/motoboy\/requests\/:id")/;
const replacementPatch = `app.patch("/api/motoboy/requests/:id", requireAuth, async (req, res) => {
    try {
      const role = getMotoboyRole((req as any).session.user.email || "");
      if (role !== "recepcao") {
        return res.status(403).json({ error: "Apenas Recepção pode atualizar solicitações de Motoboy." });
      }

      const id = z.string().min(1, "ID da solicitação é obrigatório").parse(req.params.id);
      const data = motoboyUpdateSchema.parse(req.body);
      
      let finalRequest;

      if (process.env.MOTOBOY_STORAGE === "supabase") {
        const supabase = getSupabaseClient();
        
        const { data: existing, error: existingErr } = await supabase.from("motoboy_requests").select("*").eq("id", id).single();
        if (existingErr) throw new Error(existingErr.message);
        
        const snakeData = toSnakeCase(data);
        const updatedStatus = calculateMotoboyStatus({ ...toCamelCase(existing), ...data });
        snakeData.status = updatedStatus;
        snakeData.atualizado_em = new Date().toISOString();
        
        const { data: updated, error } = await supabase.from("motoboy_requests").update(snakeData).eq("id", id).select().single();
        if (error) throw new Error(error.message);
        
        await logMotoboyEvent(updated.id, "updated", (req as any).session.user.email, { changes: snakeData, snapshot: updated });
        
        finalRequest = toCamelCase(updated);
      } else {
        const scriptUrl = getMotoboyScriptUrl();
        const response = await fetchWithRetry(scriptUrl, {
          ...createAppsScriptPostOptions({ action: "updateMotoboyRequest", id, data }),
        });

        const text = await response.text();
        let result;
        try {
          result = JSON.parse(text);
        } catch (e) {
          console.error("Response is not JSON:", text);
          throw new Error("Erro ao processar resposta do script.");
        }

        if (!response.ok || !result.success) {
          throw new Error(result.error || "Erro ao atualizar solicitação de Motoboy.");
        }
        
        finalRequest = result.data;
      }

      clearMotoboyCache();
      res.json({ success: true, request: finalRequest });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.issues[0].message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  `;
code = code.replace(regexPatch, replacementPatch);

const regexDelete = /app\.delete\("\/api\/motoboy\/requests\/:id"[\s\S]*?(?=\/\/ Vite middleware for development)/;
const replacementDelete = `app.delete("/api/motoboy/requests/:id", requireAuth, async (req, res) => {
    try {
      const user = (req as any).session.user;
      const role = getMotoboyRole(user.email || "");
      if (role !== "suporte" && role !== "recepcao") {
        return res.status(403).json({ error: "Apenas Suporte TI ou Recepção podem excluir solicitações de Motoboy." });
      }

      const id = z.string().min(1, "ID da solicitação é obrigatório").parse(req.params.id);
      const data = motoboyDeleteSchema.parse(req.body);
      const excluidoPor = \`\${user.name || "Usuário"} <\${user.email || "sem-email"}>\`;
      
      let finalRequest;

      if (process.env.MOTOBOY_STORAGE === "supabase") {
        const supabase = getSupabaseClient();
        
        const updateData = {
           status: "Excluído",
           justificativa_exclusao: data.justificativa,
           excluido_por: excluidoPor,
           excluido_em: new Date().toISOString()
        };
        
        const { data: updated, error } = await supabase.from("motoboy_requests").update(updateData).eq("id", id).select().single();
        if (error) throw new Error(error.message);
        
        await logMotoboyEvent(updated.id, "deleted", user.email, { snapshot: updated });
        
        finalRequest = toCamelCase(updated);
      } else {
        const scriptUrl = getMotoboyScriptUrl();
        const response = await fetchWithRetry(scriptUrl, {
          ...createAppsScriptPostOptions({
            action: "deleteMotoboyRequest",
            id,
            data: {
              justificativa: data.justificativa,
              excluidoPor
            }
          }),
        });

        const text = await response.text();
        let result;
        try {
          result = JSON.parse(text);
        } catch (e) {
          console.error("Response is not JSON:", text);
          throw new Error("Erro ao processar resposta do script.");
        }

        if (!response.ok || !result.success) {
          throw new Error(result.error || "Erro ao excluir solicitação de Motoboy.");
        }

        if (result.action === "registerDesligamento") {
          throw new Error("Apps Script publicado não recebeu a ação deleteMotoboyRequest. Atualize Code.gs, crie Nova versão da implantação e reinicie o backend.");
        }
        if (result.data?.status !== "Excluído") {
          throw new Error("Apps Script de Motoboy desatualizado. Atualize o Code.gs e reimplante o Web App.");
        }
        
        finalRequest = result.data;
      }

      clearMotoboyCache();
      res.json({ success: true, request: finalRequest });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.issues[0].message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  `;
code = code.replace(regexDelete, replacementDelete);

fs.writeFileSync('server.ts', code);
