import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bike, CheckCircle2, Loader2, PackageCheck, RefreshCw, Send, ShieldAlert, Trash2, X } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MotoboyCreatePayload, MotoboyRequest, MotoboyRole, MotoboyUpdatePayload, MotoboyTab, MotoboyEvent, MotoboyStatus } from "@/src/types/motoboy";

interface MotoboyProps {
  userEmail?: string;
  onPendingCountChange: (count: number) => void;
  onBack?: () => void;
}

const initialCreateForm: MotoboyCreatePayload = {
  nomeSolicitante: "",
  dataSolicitacao: new Date().toISOString().slice(0, 10),
  equipamento: "",
  funcionario: "",
  email: "",
  centroCusto: "",
  telefone: "",
  endereco: "",
  tipoServico: "ENTREGA",
  possuiRetorno: "Não",
  prioridade: "Normal",
};

const emptyUpdateForm: MotoboyUpdatePayload = {
  maquinaRetirada: "",
  enviado: "Não",
  recebido: "Não",
  dataEnvioRecebimento: "",
  codigoRastreio: "",
  observacoes: "",
};

const EQUIPMENT_OPTIONS = ["Notebook", "Fonte", "Fone de Ouvido", "Mouse"];
const emptyShippingDates = { dataEnvio: "", dataRecebimento: "" };

function composeShipmentDates(dataEnvio: string, dataRecebimento: string) {
  return [
    dataEnvio ? `Envio: ${dataEnvio}` : "",
    dataRecebimento ? `Recebimento: ${dataRecebimento}` : "",
  ].filter(Boolean).join(" | ");
}

function parseShipmentDates(value: string) {
  const envioMatch = value.match(/Envio: ([^|]+)/);
  const recebimentoMatch = value.match(/Recebimento: ([^|]+)/);

  return {
    dataEnvio: envioMatch?.[1]?.trim() || "",
    dataRecebimento: recebimentoMatch?.[1]?.trim() || "",
  };
}

function buildUpdateForm(request: MotoboyRequest): MotoboyUpdatePayload {
  return {
    maquinaRetirada: request.maquinaRetirada || "",
    enviado: request.enviado || "Não",
    recebido: request.recebido || "Não",
    dataEnvioRecebimento: request.dataEnvioRecebimento || "",
    codigoRastreio: request.codigoRastreio || "",
    observacoes: request.observacoes || "",
  };
}

function validateReceptionUpdate(form: MotoboyUpdatePayload, shippingDates: typeof emptyShippingDates) {
  const enviado = form.enviado || "Não";
  if (enviado === "Sim" && !shippingDates.dataEnvio) return "Informe a data do envio.";
  return null;
}

async function readJsonResponse(response: Response, fallbackError: string) {
  const text = await response.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text);
  } catch (error: any) {
    if (error?.message === "Unexpected end of JSON input") return {};
    throw new Error(fallbackError);
  }
}

function tabToViewParam(tab: MotoboyTab): string {
  switch (tab) {
    case "Pendentes":
      return "pendentes";
    case "Concluídas":
      return "concluidas";
    case "Excluídas":
      return "excluidas";
    default:
      return "pendentes";
  }
}

export default function Motoboy({ userEmail, onPendingCountChange, onBack }: MotoboyProps) {
  const [role, setRole] = useState<MotoboyRole>("none");
  const [requests, setRequests] = useState<MotoboyRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [createForm, setCreateForm] = useState<MotoboyCreatePayload>(initialCreateForm);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [updateForm, setUpdateForm] = useState<MotoboyUpdatePayload>(emptyUpdateForm);
  const [shippingDates, setShippingDates] = useState(emptyShippingDates);
  const [deleteTarget, setDeleteTarget] = useState<MotoboyRequest | null>(null);
  const [deleteJustification, setDeleteJustification] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const isFetchingRef = useRef(false);
  
  const [activeTab, setActiveTab] = useState<MotoboyTab>("Pendentes");
  const [events, setEvents] = useState<MotoboyEvent[]>([]);

  const availableTabs: MotoboyTab[] = useMemo(() => {
    if (role === "suporte") {
      return ["Pendentes", "Concluídas", "Excluídas"];
    }
    if (role === "recepcao") {
      return ["Pendentes", "Excluídas"];
    }
    return ["Pendentes", "Excluídas"];
  }, [role]);

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab("Pendentes");
      setSelectedRequestId("");
    }
  }, [availableTabs, activeTab]);

  const getRequestStatus = (request: MotoboyRequest): MotoboyStatus => {
    return request.status || "Pendente";
  };

  const visibleRequests = requests.filter((request) => {
    if (!request.id) return false;
    const status = getRequestStatus(request);

    if (activeTab === "Pendentes") {
      return ["Pendente", "Em andamento", "Pendente de recebimento"].includes(status);
    }
    if (activeTab === "Concluídas") {
      return status === "Concluído";
    }
    if (activeTab === "Excluídas") {
      return status === "Excluído";
    }
    return false;
  });

  const pendingRequests = requests.filter((request) => {
    if (!request.id) return false;
    const status = getRequestStatus(request);
    return ["Pendente", "Em andamento", "Pendente de recebimento"].includes(status);
  });
  const selectedRequestForUpdate = requests.find((request) => request.id === selectedRequestId) || null;

  async function fetchRequests(targetTab: MotoboyTab = activeTab) {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsLoading(true);
    try {
      const viewParam = tabToViewParam(targetTab);
      const response = await fetch(`/api/motoboy/requests?view=${encodeURIComponent(viewParam)}`);
      const result = await readJsonResponse(response, "Erro ao carregar solicitações de Motoboy.");
      if (!response.ok) throw new Error(result.error || "Erro ao carregar solicitações de Motoboy.");
      const nextRequests: MotoboyRequest[] = result.requests || [];
      setRole(result.role || "none");
      setRequests(nextRequests);
      onPendingCountChange(nextRequests.filter((request) => request.status !== "Concluído" && request.status !== "Excluído").length);
    } catch (error: any) {
      setMessage({ type: "error", text: error.message });
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }

  async function fetchEvents(id: string) {
    try {
      const response = await fetch(`/api/motoboy/requests/${encodeURIComponent(id)}/events`);
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
  }, [selectedRequestId, userEmail]);

  useEffect(() => {
    fetchRequests(activeTab);
    const interval = setInterval(() => fetchRequests(activeTab), 30000);
    return () => clearInterval(interval);
  }, [userEmail, activeTab]);

  useEffect(() => {
    if (!selectedRequestId) {
      setUpdateForm(emptyUpdateForm);
      setShippingDates(emptyShippingDates);
      return;
    }

    if (!selectedRequestForUpdate) return;

    setUpdateForm(buildUpdateForm(selectedRequestForUpdate));
    setShippingDates(parseShipmentDates(selectedRequestForUpdate.dataEnvioRecebimento || ""));
  }, [selectedRequestId]);

  async function handleCreateRequest(event: React.FormEvent) {
    event.preventDefault();
    if (selectedEquipment.length === 0) {
      setMessage({ type: "error", text: "Selecione ao menos um equipamento." });
      return;
    }
    setIsSaving(true);
    setMessage(null);
    try {
      const payload = {
        ...createForm,
        equipamento: selectedEquipment.join(", "),
      };
      const response = await fetch("/api/motoboy/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await readJsonResponse(response, "Erro ao criar solicitação.");
      if (!response.ok) throw new Error(result.error || "Erro ao criar solicitação.");
      setCreateForm({ ...initialCreateForm, dataSolicitacao: new Date().toISOString().slice(0, 10) });
      setSelectedEquipment([]);
      setMessage({ type: "success", text: `Solicitação ${result.request?.id?.substring(0, 8) || ""} criada com sucesso.` });
      await fetchRequests();
    } catch (error: any) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdateRequest(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedRequestId) {
      setMessage({ type: "error", text: "Selecione uma solicitação para atualizar." });
      return;
    }
    const validationError = validateReceptionUpdate(updateForm, shippingDates);
    if (validationError) {
      setMessage({ type: "error", text: validationError });
      return;
    }
    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/motoboy/requests/${encodeURIComponent(selectedRequestId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...updateForm,
          enviado: updateForm.enviado || "Não",
          recebido: updateForm.recebido || "Não",
          dataEnvioRecebimento: composeShipmentDates(shippingDates.dataEnvio, shippingDates.dataRecebimento),
        }),
      });
      const result = await readJsonResponse(response, "Erro ao atualizar solicitação.");
      if (!response.ok) throw new Error(result.error || "Erro ao atualizar solicitação.");
      if (result.request) {
        setUpdateForm(buildUpdateForm(result.request));
        setShippingDates(parseShipmentDates(result.request.dataEnvioRecebimento || ""));
        setRequests((currentRequests) => currentRequests.map((request) => (
          request.id === result.request.id ? result.request : request
        )));
      }
      setMessage({ type: "success", text: "Solicitação atualizada com sucesso." });
      await fetchRequests();
    } catch (error: any) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteRequest(event: React.FormEvent) {
    event.preventDefault();
    if (!deleteTarget) return;
    if (!deleteJustification.trim()) {
      setMessage({ type: "error", text: "Informe a justificativa da exclusão." });
      return;
    }
    setIsDeleting(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/motoboy/requests/${encodeURIComponent(deleteTarget.id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ justificativa: deleteJustification.trim() }),
      });
      const result = await readJsonResponse(response, "Erro ao excluir solicitação.");
      if (!response.ok) throw new Error(result.error || "Erro ao excluir solicitação.");
      setDeleteTarget(null);
      setDeleteJustification("");
      setSelectedRequestId((current) => current === deleteTarget.id ? "" : current);
      setMessage({ type: "success", text: "Solicitação excluída com justificativa registrada." });
      await fetchRequests();
    } catch (error: any) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans p-4 md:p-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-bold uppercase tracking-wider text-foreground">
              <Bike className="h-3.5 w-3.5 text-primary" />
              Solicitação de Motoboy
            </div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-foreground md:text-5xl">Logística de Ativos</h1>
            <p className="mt-2 text-sm font-medium text-muted-foreground">
              Criação e acompanhamento de entregas e retiradas de equipamentos.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {onBack && (
              <Button onClick={onBack} variant="outline" className="border-border bg-card text-foreground hover:bg-muted">
                Voltar
              </Button>
            )}
            <Button onClick={() => fetchRequests(activeTab)} variant="outline" className="border-border bg-card text-foreground hover:bg-muted">
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {message && (
          <div className={`mb-6 flex items-center gap-3 rounded-2xl border p-4 text-sm font-bold ${
            message.type === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}>
            {message.type === "success" ? <CheckCircle2 className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
            {message.text}
          </div>
        )}

        {deleteTarget && (
          <DeleteConfirmationPanel
            request={deleteTarget}
            justification={deleteJustification}
            setJustification={setDeleteJustification}
            isDeleting={isDeleting}
            onSubmit={handleDeleteRequest}
            onCancel={() => {
              setDeleteTarget(null);
              setDeleteJustification("");
            }}
          />
        )}

        {isLoading ? (
          <Card className="border-border bg-card">
            <CardContent className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-3 h-5 w-5 animate-spin text-primary" />
              Carregando solicitações...
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex gap-2">
                {availableTabs.map(tab => (
                  <button
                    key={tab}
                    onClick={() => { setActiveTab(tab); setSelectedRequestId(""); }}
                    className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${activeTab === tab ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              {activeTab === "Excluídas" && (
                <div className="text-xs text-muted-foreground bg-card px-3 py-1.5 rounded-xl border border-border">
                  ℹ️ As solicitações excluídas ficam disponíveis para consulta nesta aba.
                </div>
              )}
            </div>
            {role === "suporte" ? (
          <SupportPanel
            activeTab={activeTab}
            requests={visibleRequests}
            selectedRequestId={selectedRequestId}
            setSelectedRequestId={setSelectedRequestId}
            events={events}
            form={createForm}
            setForm={setCreateForm}
            selectedEquipment={selectedEquipment}
            setSelectedEquipment={setSelectedEquipment}
            isSaving={isSaving}
            onSubmit={handleCreateRequest}
            onDelete={setDeleteTarget}
          />
        ) : role === "recepcao" ? (
          <ReceptionUpdatePanel
            activeTab={activeTab}
            requests={visibleRequests}
            selectedRequestId={selectedRequestId}
            setSelectedRequestId={setSelectedRequestId}
            events={events}
            onDelete={setDeleteTarget}
            form={updateForm}
            setForm={setUpdateForm}
            shippingDates={shippingDates}
            setShippingDates={setShippingDates}
            isSaving={isSaving}
            onSubmit={handleUpdateRequest}
          />
        ) : (
          <Card className="border-red-500/20 bg-red-500/10">
            <CardContent className="py-8 text-sm font-bold text-red-300">
              Seu usuário não possui acesso à área Motoboy.
            </CardContent>
          </Card>
        )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function formatDisplayDate(dateStr?: string) {
  if (!dateStr) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("pt-BR");
}

function formatDisplayDateTime(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString("pt-BR");
}

function SupportPanel({
  activeTab,
  requests,
  selectedRequestId,
  setSelectedRequestId,
  events,
  form,
  setForm,
  selectedEquipment,
  setSelectedEquipment,
  isSaving,
  onSubmit,
  onDelete,
}: {
  activeTab: MotoboyTab;
  requests: MotoboyRequest[];
  selectedRequestId: string;
  setSelectedRequestId: (id: string) => void;
  events: MotoboyEvent[];
  form: MotoboyCreatePayload;
  setForm: React.Dispatch<React.SetStateAction<MotoboyCreatePayload>>;
  selectedEquipment: string[];
  setSelectedEquipment: React.Dispatch<React.SetStateAction<string[]>>;
  isSaving: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onDelete: (request: MotoboyRequest) => void;
}) {
  const selectedRequest = requests.find((request) => request.id === selectedRequestId) || null;

  const tabConfig = {
    Pendentes: {
      title: "Solicitações Pendentes",
      description: `${requests.length} solicitação(ões) pendente(s) ou em andamento.`,
      emptyMessage: "Nenhuma solicitação pendente no momento.",
    },
    Concluídas: {
      title: "Solicitações Concluídas",
      description: `${requests.length} solicitação(ões) concluída(s).`,
      emptyMessage: "Nenhuma solicitação concluída encontrada.",
    },
    Excluídas: {
      title: "Solicitações Excluídas",
      description: `${requests.length} solicitação(ões) excluída(s) mantida(s) para consulta e auditoria.`,
      emptyMessage: "Nenhuma solicitação excluída encontrada.",
    },
  }[activeTab] || {
    title: "Lista de Solicitações",
    description: `${requests.length} solicitação(ões) na aba atual.`,
    emptyMessage: "Nenhuma solicitação na aba atual.",
  };

  return (
    <div className="space-y-6">
      {activeTab === "Pendentes" && (
        <SupportCreateForm
          form={form}
          setForm={setForm}
          selectedEquipment={selectedEquipment}
          setSelectedEquipment={setSelectedEquipment}
          isSaving={isSaving}
          onSubmit={onSubmit}
        />
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.1fr]">
        <RequestListCard
          title={tabConfig.title}
          description={tabConfig.description}
          emptyMessage={tabConfig.emptyMessage}
          requests={requests}
          selectedRequestId={selectedRequestId}
          setSelectedRequestId={setSelectedRequestId}
        />
        {selectedRequest && (
          <RequestDetailPanel 
            request={selectedRequest} 
            events={events} 
            onDelete={onDelete} 
            showDelete={activeTab !== "Excluídas" && selectedRequest.status !== "Excluído"} 
          />
        )}
      </div>
    </div>
  );
}

function ReceptionUpdatePanel({
  activeTab = "Pendentes",
  requests,
  selectedRequestId,
  setSelectedRequestId,
  events,
  onDelete,
  form,
  setForm,
  shippingDates,
  setShippingDates,
  isSaving,
  onSubmit,
}: {
  activeTab?: MotoboyTab;
  requests: MotoboyRequest[];
  selectedRequestId: string;
  setSelectedRequestId: (id: string) => void;
  events: MotoboyEvent[];
  onDelete: (request: MotoboyRequest) => void;
  form: MotoboyUpdatePayload;
  setForm: React.Dispatch<React.SetStateAction<MotoboyUpdatePayload>>;
  shippingDates: any;
  setShippingDates: any;
  isSaving: boolean;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const selectedRequest = requests.find((request) => request.id === selectedRequestId) || null;
  const isReadOnly = activeTab === "Excluídas" || selectedRequest?.status === "Concluído" || selectedRequest?.status === "Excluído";

  const tabConfig = {
    Pendentes: {
      title: "Solicitações Pendentes",
      description: `${requests.length} solicitação(ões) pendente(s) ou em andamento.`,
      emptyMessage: "Nenhuma solicitação pendente no momento.",
    },
    Concluídas: {
      title: "Solicitações Concluídas",
      description: `${requests.length} solicitação(ões) concluída(s).`,
      emptyMessage: "Nenhuma solicitação concluída encontrada.",
    },
    Excluídas: {
      title: "Solicitações Excluídas",
      description: `${requests.length} solicitação(ões) excluída(s) mantida(s) para consulta e auditoria.`,
      emptyMessage: "Nenhuma solicitação excluída encontrada.",
    },
  }[activeTab] || {
    title: "Lista de Solicitações",
    description: `${requests.length} solicitação(ões) na aba atual.`,
    emptyMessage: "Nenhuma solicitação na aba atual.",
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.1fr]">
      <RequestListCard
        title={tabConfig.title}
        description={tabConfig.description}
        emptyMessage={tabConfig.emptyMessage}
        requests={requests}
        selectedRequestId={selectedRequestId}
        setSelectedRequestId={setSelectedRequestId}
      />
      {selectedRequest && (
        isReadOnly ? (
          <RequestDetailPanel 
            request={selectedRequest} 
            events={events} 
            onDelete={onDelete} 
            showDelete={activeTab !== "Excluídas" && selectedRequest.status !== "Excluído"} 
          />
        ) : (
          <Card className="border-border bg-card h-fit">
            <CardHeader>
              <CardTitle className="text-xl font-black uppercase text-foreground flex items-center justify-between">
                <span>Atualizar Pedido</span>
                <span className="text-xs text-muted-foreground font-normal">ID: {selectedRequest.id.substring(0,8)}</span>
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Preencha os campos operacionais de envio e recebimento ou gerencie a solicitação.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={onSubmit} className="space-y-5">
                <RequesterInfoPanel selectedRequest={selectedRequest} />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <SelectField label="Maquina Retirada" value={form.maquinaRetirada || "Não"} onChange={(value) => setForm((prev) => ({ ...prev, maquinaRetirada: value }))} options={["Não", "Sim"]} />
                  <SelectField label="Enviado" value={form.enviado || "Não"} onChange={(value) => setForm((prev) => ({ ...prev, enviado: value }))} options={["Não", "Sim"]} />
                  <SelectField label="Recebido" value={form.recebido || "Não"} onChange={(value) => setForm((prev) => ({ ...prev, recebido: value }))} options={["Não", "Sim"]} />
                  <Field label="Data do Envio" type="date" value={shippingDates.dataEnvio} onChange={(value) => setShippingDates((prev) => ({ ...prev, dataEnvio: value }))} />
                  <Field label="Data do Recebimento" type="date" value={shippingDates.dataRecebimento} onChange={(value) => setShippingDates((prev) => ({ ...prev, dataRecebimento: value }))} />
                  <Field label="Cod. Rastreio" value={form.codigoRastreio || ""} onChange={(value) => setForm((prev) => ({ ...prev, codigoRastreio: value }))} className="md:col-span-2" />
                  <Field label="Observações" value={form.observacoes || ""} onChange={(value) => setForm((prev) => ({ ...prev, observacoes: value }))} className="md:col-span-2" />
                  <div className="flex flex-col sm:flex-row gap-3 pt-2 md:col-span-2">
                    <Button type="submit" disabled={isSaving || !selectedRequestId} className="flex-1 h-12 bg-orange-500 text-white hover:bg-orange-400">
                      {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <PackageCheck className="mr-2 h-5 w-5" />}
                      Salvar Atualização
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onDelete(selectedRequest)}
                      className="h-12 border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 px-5 font-bold"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir Solicitação
                    </Button>
                  </div>
                </div>
              </form>

              <div>
                <h3 className="text-sm font-bold text-slate-300 mb-3 border-b border-slate-700 pb-2">Histórico de Eventos</h3>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                  {events.length === 0 ? (
                    <div className="text-xs text-slate-500 text-center py-4">Nenhum evento registrado.</div>
                  ) : (
                    events.map(ev => (
                      <div key={ev.id} className="bg-muted/30 p-3 rounded-lg border border-border text-xs">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-primary uppercase">
                            {ev.eventType === "created" || ev.eventType === "criado" ? "Criação da Solicitação" :
                             ev.eventType === "updated" || ev.eventType === "atualizado" ? "Atualização da Solicitação" :
                             ev.eventType === "deleted" || ev.eventType === "excluido" || ev.eventType === "excluído" ? "Exclusão da Solicitação" :
                             ev.eventType.toUpperCase()}
                          </span>
                          <span className="text-muted-foreground">{new Date(ev.createdAt).toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="text-muted-foreground">
                          Realizado por: <span className="text-foreground font-medium">{ev.actor}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}

function RequestDetailPanel({ request, events, onDelete, showDelete }: { request: MotoboyRequest; events: MotoboyEvent[]; onDelete: (r: MotoboyRequest) => void; showDelete: boolean }) {
  const formatEventName = (eventType: string) => {
    const t = (eventType || "").toLowerCase();
    if (t === "created" || t === "criado") return "Criação da Solicitação";
    if (t === "updated" || t === "atualizado") return "Atualização da Solicitação";
    if (t === "deleted" || t === "excluido" || t === "excluído") return "Exclusão da Solicitação";
    return eventType.toUpperCase();
  };

  return (
    <Card className="border-border bg-card h-fit">
      <CardHeader>
        <CardTitle className="text-xl font-black uppercase text-foreground flex items-center justify-between">
          <span>{request.status === "Excluído" ? "Detalhes da Exclusão" : "Detalhes e Histórico"}</span>
          <span className="text-xs text-muted-foreground font-normal">ID: {request.id}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <RequesterInfoPanel selectedRequest={request} />
        
        <div>
          <h3 className="text-sm font-bold text-slate-300 mb-3 border-b border-slate-700 pb-2">Histórico de Eventos</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
            {events.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-4">Nenhum evento registrado.</div>
            ) : (
              events.map(ev => (
                <div key={ev.id} className="bg-muted/30 p-3 rounded-lg border border-border text-xs">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-primary uppercase">{formatEventName(ev.eventType)}</span>
                    <span className="text-muted-foreground">{new Date(ev.createdAt).toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="text-muted-foreground">
                    Realizado por: <span className="text-foreground font-medium">{ev.actor}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {showDelete && request.status !== "Excluído" && (
          <div className="pt-4 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => onDelete(request)}
              className="w-full border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir Solicitação
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RequestListCard({
  title,
  description,
  emptyMessage,
  requests,
  selectedRequestId,
  setSelectedRequestId,
}: {
  title: string;
  description: string;
  emptyMessage?: string;
  requests: MotoboyRequest[];
  selectedRequestId: string;
  setSelectedRequestId: (id: string) => void;
}) {
  return (
    <Card className="border-border bg-card h-fit">
      <CardHeader>
        <CardTitle className="text-xl font-black uppercase text-foreground">{title}</CardTitle>
        <CardDescription className="text-muted-foreground">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6 text-center text-sm text-slate-500">
            {emptyMessage || "Nenhuma solicitação na aba atual."}
          </div>
        ) : (
          requests.map((request) => {
            const isExcluded = request.status === "Excluído";
            return (
              <div
                key={request.id}
                className={`w-full rounded-2xl border p-4 text-left transition-all ${
                  selectedRequestId === request.id
                    ? isExcluded
                      ? "border-destructive/40 bg-destructive/10"
                      : "border-primary/50 bg-primary/10 shadow-md shadow-primary/5"
                    : "border-border bg-card/60 hover:border-foreground/20"
                }`}
              >
                <button type="button" onClick={() => setSelectedRequestId(request.id)} className="w-full text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-full">
                      <div className="flex items-center justify-between">
                        <div className="font-black text-white">{request.funcionario}</div>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          request.status === "Concluído" ? "bg-green-500/20 text-green-400" :
                          isExcluded ? "bg-red-500/20 text-red-400" :
                          "bg-orange-500/20 text-orange-400"
                        }`}>
                          {request.status || "Pendente"}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {request.equipamento} • {request.tipoServico}
                        {request.dataSolicitacao && (
                          <span className="text-slate-500"> • {formatDisplayDate(request.dataSolicitacao)}</span>
                        )}
                      </div>

                      {isExcluded ? (
                        <div className="mt-3 space-y-1 rounded-xl border border-red-500/30 bg-red-950/30 p-2.5 text-xs">
                          {request.justificativaExclusao && (
                            <div className="text-slate-200">
                              <span className="font-semibold text-red-400">Justificativa:</span> {request.justificativaExclusao}
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
                            {request.excluidoPor && (
                              <span>
                                <span className="text-slate-500">Por:</span> <span className="text-slate-300 font-medium">{request.excluidoPor}</span>
                              </span>
                            )}
                            {request.excluidoEm && (
                              <span>
                                <span className="text-slate-500">Em:</span> <span className="text-slate-300 font-medium">{formatDisplayDateTime(request.excluidoEm)}</span>
                              </span>
                            )}
                          </div>
                          {request.observacoes && (
                            <div className="text-[11px] text-slate-400 pt-0.5 border-t border-red-900/30 mt-1">
                              <span className="text-slate-500">Obs:</span> {request.observacoes}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-slate-500">{request.endereco}</div>
                      )}
                    </div>
                  </div>
                </button>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function RequesterInfoPanel({ selectedRequest }: { selectedRequest: MotoboyRequest | null }) {
  if (!selectedRequest) return null;
  const isExcluded = selectedRequest.status === "Excluído";

  return (
    <div className="space-y-4">
      {isExcluded && (
        <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5" />
              Solicitação Excluída (Auditoria)
            </span>
          </div>
          {selectedRequest.justificativaExclusao && (
            <div className="text-xs text-slate-200 bg-red-950/40 p-2.5 rounded-lg border border-red-800/40">
              <span className="font-semibold text-red-300 block mb-0.5">Justificativa da Exclusão:</span>
              {selectedRequest.justificativaExclusao}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
            {selectedRequest.excluidoPor && (
              <div className="text-slate-400">
                <span className="font-semibold text-slate-300 block">Excluído por:</span>
                <span className="text-slate-200">{selectedRequest.excluidoPor}</span>
              </div>
            )}
            {selectedRequest.excluidoEm && (
              <div className="text-slate-400">
                <span className="font-semibold text-slate-300 block">Excluído em:</span>
                <span className="text-slate-200">{formatDisplayDateTime(selectedRequest.excluidoEm)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Dados da Solicitação</h3>
        <div className="grid grid-cols-2 gap-y-3 text-sm">
          <div>
            <div className="text-slate-500">Solicitante</div>
            <div className="font-medium text-slate-300">{selectedRequest.nomeSolicitante}</div>
          </div>
          <div>
            <div className="text-slate-500">Telefone</div>
            <div className="font-medium text-slate-300">{selectedRequest.telefone}</div>
          </div>
          <div>
            <div className="text-slate-500">Funcionário</div>
            <div className="font-medium text-slate-300">{selectedRequest.funcionario}</div>
          </div>
          <div>
            <div className="text-slate-500">Equipamento</div>
            <div className="font-medium text-slate-300">{selectedRequest.equipamento}</div>
          </div>
          {selectedRequest.dataSolicitacao && (
            <div>
              <div className="text-slate-500">Data da Solicitação</div>
              <div className="font-medium text-slate-300">
                {formatDisplayDate(selectedRequest.dataSolicitacao)}
              </div>
            </div>
          )}
          {selectedRequest.centroCusto && (
            <div>
              <div className="text-slate-500">Centro de Custo</div>
              <div className="font-medium text-slate-300">{selectedRequest.centroCusto}</div>
            </div>
          )}
          <div className="col-span-2">
            <div className="text-slate-500">Endereço</div>
            <div className="font-medium text-slate-300">{selectedRequest.endereco}</div>
          </div>
          {selectedRequest.observacoes && (
            <div className="col-span-2">
              <div className="text-slate-500">Observações</div>
              <div className="font-medium text-slate-300">{selectedRequest.observacoes}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SupportCreateForm({
  form,
  setForm,
  selectedEquipment,
  setSelectedEquipment,
  isSaving,
  onSubmit,
}: {
  form: MotoboyCreatePayload;
  setForm: React.Dispatch<React.SetStateAction<MotoboyCreatePayload>>;
  selectedEquipment: string[];
  setSelectedEquipment: React.Dispatch<React.SetStateAction<string[]>>;
  isSaving: boolean;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const EQUIPMENT_OPTIONS = ["Notebook", "Fonte", "Fone de Ouvido", "Mouse"];
  const toggleEquipment = (equipment: string) => {
    setSelectedEquipment((prev) =>
      prev.includes(equipment) ? prev.filter((e) => e !== equipment) : [...prev, equipment]
    );
  };
  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-xl font-black uppercase text-foreground">Nova Solicitação</CardTitle>
        <CardDescription className="text-muted-foreground">Preencha os dados do colaborador.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Field label="Nome Solicitante" value={form.nomeSolicitante} onChange={(value) => setForm((prev) => ({ ...prev, nomeSolicitante: value }))} required />
            <Field label="Telefone" value={form.telefone} onChange={(value) => setForm((prev) => ({ ...prev, telefone: value }))} required />
            <SelectField label="Tipo de Serviço" value={form.tipoServico} onChange={(value) => setForm((prev) => ({ ...prev, tipoServico: value as any }))} options={["ENTREGA", "Retirada"]} required />
            <SelectField label="Prioridade" value={form.prioridade} onChange={(value) => setForm((prev) => ({ ...prev, prioridade: value as any }))} options={["Baixa", "Normal", "Alta", "Urgente"]} required />
            <SelectField label="Possui Retorno?" value={form.possuiRetorno} onChange={(value) => setForm((prev) => ({ ...prev, possuiRetorno: value as any }))} options={["Sim", "Não"]} required />
            <Field label="Centro de Custo" value={form.centroCusto} onChange={(value) => setForm((prev) => ({ ...prev, centroCusto: value }))} />
            
            <div className="space-y-3 md:col-span-2">
              <Label className="text-sm font-semibold text-slate-300">Equipamento <span className="text-red-400">*</span></Label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {EQUIPMENT_OPTIONS.map((equipment) => {
                  const checked = selectedEquipment.includes(equipment);
                  return (
                    <button
                      key={equipment}
                      type="button"
                      onClick={() => toggleEquipment(equipment)}
                      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                        checked ? "border-primary/50 bg-primary/10 text-primary shadow-sm" : "border-border bg-muted/30 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                      }`}
                    >
                      <span className={`flex h-5 w-5 items-center justify-center rounded border ${
                        checked ? "border-primary bg-primary text-primary-foreground font-bold" : "border-border text-transparent"
                      }`}>
                        {checked ? "✓" : ""}
                      </span>
                      <span className="text-sm font-bold">{equipment}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            
            <Field label="Funcionário" value={form.funcionario} onChange={(value) => setForm((prev) => ({ ...prev, funcionario: value }))} required />
            <Field label="email" type="email" value={form.email} onChange={(value) => setForm((prev) => ({ ...prev, email: value }))} required />
            <div className="space-y-3 md:col-span-2">
              <Label className="text-sm font-semibold text-slate-300">Endereço Completo <span className="text-red-400">*</span></Label>
              <Input
                value={form.endereco}
                onChange={(e) => setForm((prev) => ({ ...prev, endereco: e.target.value }))}
                required
                className="h-12 border-border bg-muted/40 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20"
                placeholder="Rua, Número, Complemento, Bairro, Cidade, CEP..."
              />
            </div>
          </div>
          <div className="flex justify-end pt-4 border-t border-border">
            <Button type="submit" disabled={isSaving} className="h-12 bg-primary px-8 font-bold text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20">
              {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
              Registrar Solicitação
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function DeleteConfirmationPanel({
  request,
  justification,
  setJustification,
  isDeleting,
  onSubmit,
  onCancel,
}: {
  request: MotoboyRequest;
  justification: string;
  setJustification: React.Dispatch<React.SetStateAction<string>>;
  isDeleting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
        <Card className="border-destructive/30 bg-card shadow-2xl">
          <CardHeader className="border-b border-border">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center text-xl font-black text-destructive">
                <ShieldAlert className="mr-3 h-6 w-6" />
                Excluir Solicitação
              </CardTitle>
              <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <CardDescription className="text-muted-foreground mt-2">
              Esta ação removerá o pedido de <span className="font-bold text-foreground">{request.funcionario}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Justificativa da Exclusão <span className="text-red-500">*</span></Label>
                <Input
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Por que este pedido está sendo excluído?"
                  required
                  className="bg-slate-950/50 border-slate-700 text-white focus:border-red-500/50 focus:ring-red-500/20"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="button" onClick={onCancel} variant="outline" className="flex-1 border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white">
                  Cancelar
                </Button>
                <Button type="submit" disabled={isDeleting} className="flex-1 bg-red-500 text-white hover:bg-red-600">
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                  Confirmar Exclusão
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

interface FieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label: string;
  required?: boolean;
  className?: string;
  onChange?: (value: string) => void;
}

function Field({ label, required, className, onChange, value, ...props }: FieldProps) {
  return (
    <div className={`space-y-2 ${className || ""}`}>
      <Label className="text-sm font-semibold text-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Input
        {...props}
        value={value || ""}
        onChange={(e) => onChange && onChange(e.target.value)}
        className="h-11 border-border bg-muted/40 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options, required, className }: { label: string; value: string; onChange: (value: string) => void; options: string[]; required?: boolean; className?: string }) {
  return (
    <div className={`space-y-2 ${className || ""}`}>
      <Label className="text-sm font-semibold text-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="flex gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-bold transition-all ${
              value === option ? "border-primary/50 bg-primary/10 text-primary shadow-sm" : "border-border bg-muted/30 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
