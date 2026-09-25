const fs = require('fs');

let code = fs.readFileSync('src/components/Motoboy.tsx', 'utf8');

// Imports
code = code.replace(
  'import type { MotoboyCreatePayload, MotoboyRequest, MotoboyRole, MotoboyUpdatePayload } from "@/src/types/motoboy";',
  'import type { MotoboyCreatePayload, MotoboyRequest, MotoboyRole, MotoboyUpdatePayload, MotoboyTab, MotoboyEvent, MotoboyStatus } from "@/src/types/motoboy";'
);

// State and visibleRequests
const oldStateBlock = `  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const isFetchingRef = useRef(false);

  const visibleRequests = requests.filter((request) => request.id && request.status !== "Excluído");
  const pendingRequests = visibleRequests.filter((request) => request.status !== "Concluído");`;

const newStateBlock = `  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const isFetchingRef = useRef(false);
  
  const [activeTab, setActiveTab] = useState<MotoboyTab>("Pendentes");
  const [events, setEvents] = useState<MotoboyEvent[]>([]);

  const visibleRequests = requests.filter((request) => {
    if (!request.id) return false;
    if (activeTab === "Pendentes") return request.status !== "Concluído" && request.status !== "Excluído";
    if (activeTab === "Concluídas") return request.status === "Concluído";
    if (activeTab === "Excluídas") return request.status === "Excluído";
    return false;
  });

  const pendingRequests = requests.filter((request) => request.id && request.status !== "Concluído" && request.status !== "Excluído");`;

code = code.replace(oldStateBlock, newStateBlock);

// Fetch requests
code = code.replace(
  'const response = await fetch("/api/motoboy/requests", {',
  'const response = await fetch("/api/motoboy/requests?includeAll=true", {'
);

fs.writeFileSync('src/components/Motoboy.tsx', code);
