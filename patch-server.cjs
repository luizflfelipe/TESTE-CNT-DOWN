const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

// 1. Update GET /api/motoboy/requests
const regexGet = /app\.get\("\/api\/motoboy\/requests"[\s\S]*?(?=app\.patch\("\/api\/motoboy\/requests\/:id")/;

const replacementGet = `app.get("/api/motoboy/requests", requireAuth, async (req, res) => {
    try {
      const role = getMotoboyRole((req as any).session.user.email || "");
      if (role === "none") {
        return res.status(403).json({ error: "Usuário sem acesso à área Motoboy." });
      }

      const includeAll = req.query.includeAll === "true";
      const cacheKey = role + (includeAll ? "_all" : "");

      const cached = motoboyCache[cacheKey];
      if (cached && (Date.now() - cached.timestamp < MOTOBOY_CACHE_TTL)) {
        console.log(\`[Motoboy Cache] Servindo requests para a cacheKey: \${cacheKey}\`);
        return res.json({ success: true, role, requests: cached.requests });
      }

      let validRequests: any[] = [];

      if (process.env.MOTOBOY_STORAGE === "supabase") {
        const supabase = getSupabaseClient() as any;
        
        let query = supabase.from("motoboy_requests").select("*");
        if (!includeAll) {
          query = query.neq("status", "Excluído");
        }
        
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        
        validRequests = data.map(toCamelCase).filter(req => req.id);
        
        if (role === "recepcao" && !includeAll) {
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
      
      console.log(\`[Motoboy Cache] Atualizando cache para a cacheKey: \${cacheKey}\`);
      motoboyCache[cacheKey] = { requests: validRequests, timestamp: Date.now() };

      res.json({ success: true, role, requests: validRequests });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/motoboy/requests/:id/events", requireAuth, async (req, res) => {
    try {
      const role = getMotoboyRole((req as any).session.user.email || "");
      if (role === "none") {
        return res.status(403).json({ error: "Usuário sem acesso à área Motoboy." });
      }

      if (process.env.MOTOBOY_STORAGE !== "supabase") {
        return res.json({ success: true, events: [] });
      }

      const id = req.params.id;
      const supabase = getSupabaseClient() as any;
      
      const { data, error } = await supabase
        .from("motoboy_request_events")
        .select("*")
        .eq("request_id", id)
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      const events = data.map((row: any) => ({
        id: row.id,
        requestId: row.request_id,
        eventType: row.event_type,
        actor: row.actor,
        payload: row.payload,
        createdAt: row.created_at
      }));

      res.json({ success: true, events });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  `;

code = code.replace(regexGet, replacementGet);

fs.writeFileSync('server.ts', code);
