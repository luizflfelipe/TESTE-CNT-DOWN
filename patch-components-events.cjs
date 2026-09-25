const fs = require('fs');

let code = fs.readFileSync('src/components/Motoboy.tsx', 'utf8');

const targetUseEffect = `  useEffect(() => {
    fetchRequests();`;

const replacementUseEffect = `  async function fetchEvents(id: string) {
    try {
      const response = await fetch(\`/api/motoboy/requests/\${encodeURIComponent(id)}/events\`, {
        credentials: "same-origin"
      });
      const result = await readJsonResponse(response, "Erro ao carregar histórico.");
      if (result.success && result.events) {
        setEvents(result.events);
      }
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    if (selectedRequestId) fetchEvents(selectedRequestId);
    else setEvents([]);
  }, [selectedRequestId]);

  useEffect(() => {
    fetchRequests();`;

code = code.replace(targetUseEffect, replacementUseEffect);
fs.writeFileSync('src/components/Motoboy.tsx', code);
