import React, { useEffect, useRef, useState } from "react";
import { Bike, CheckCircle2, Loader2, PackageCheck, RefreshCw, Send, ShieldAlert, Trash2, X } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MotoboyCreatePayload, MotoboyRequest, MotoboyRole, MotoboyUpdatePayload, MotoboyTab, MotoboyEvent, MotoboyStatus } from "@/src/types/motoboy";

interface MotoboyProps {
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

export default function Motoboy({ onPendingCountChange, onBack }: MotoboyProps) {
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

  const visibleRequests = requests.filter((request) => {
    if (!request.id) return false;
    if (activeTab === "Pendentes") return request.status !== "Concluído" && request.status !== "Excluído";
    if (activeTab === "Concluídas") return request.status === "Concluído";
    if (activeTab === "Excluídas") return request.status === "Excluído";
    return false;
  });

  const pendingRequests = requests.filter((request) => request.id && request.status !== "Concluído" && request.status !== "Excluído");
  const selectedRequestForUpdate = requests.find((request) => request.id === selectedRequestId) || null;

  async function fetchRequests() {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsLoading(true);
    try {
      const response = await fetch("/api/motoboy/requests?includeAll=true", {
        credentials: "same-origin",
      });
      if (response.status === 401) {
        window.location.reload();
        return;
      }
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
      const response = await fetch(`/api/motoboy/requests/${encodeURIComponent(id)}/events`, {
        credentials: "same-origin",
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
    fetchRequests();
    const interval = setInterval(fetchRequests, 30000);
    return () => clearInterval(interval);
  }, []);

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
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const result = await readJsonResponse(response, "Erro ao criar solicitação.");
      if (!response.ok) throw new Error(result.error || "Erro ao criar solicitação.");
      setCreateForm({ ...initialCreateForm, dataSolicitacao: new Date().toISOString().slice(0, 10) });
      setSelectedEquipment([]);
      setMessage({ type: "success", text: "Solicitação de Motoboy criada com sucesso." });
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
        credentials: "same-origin",
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
        credentials: "same-origin",
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
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans p-4 md:p-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cyan-300">
              <Bike className="h-3.5 w-3.5" />
              Solicitação de Motoboy
            </div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-white md:text-5xl">Logística de Ativos</h1>
            <p className="mt-2 text-sm font-medium text-slate-400">
              Criação e acompanhamento de entregas e retiradas de equipamentos.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {onBack && (
              <Button onClick={onBack} variant="outline" className="border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800">
                Voltar
              </Button>
            )}
            <Button onClick={fetchRequests} variant="outline" className="border-cyan-500/20 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20">
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {message && (
          <div className={`mb-6 flex items-center gap-3 rounded-2xl border p-4 text-sm font-bold ${
            message.type === "success" ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-red-500/30 bg-red-500/10 text-red-400"
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
          <Card className="border-slate-800 bg-[#1e293b]/50">
            <CardContent className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 className="mr-3 h-5 w-5 animate-spin text-cyan-400" />
              Carregando solicitações...
            </CardContent>
          </Card>
        ) : role === "suporte" ? (
          <SupportPanel
            requests={visibleRequests}
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
            requests={pendingRequests}
            selectedRequestId={selectedRequestId}
            setSelectedRequestId={setSelectedRequestId}
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
      </motion.div>
    </div>
  );
}

function SupportPanel({
  requests,
  form,
  setForm,
  selectedEquipment,
  setSelectedEquipment,
  isSaving,
  onSubmit,
  onDelete,
}: {
  requests: MotoboyRequest[];
  form: MotoboyCreatePayload;
  setForm: React.Dispatch<React.SetStateAction<MotoboyCreatePayload>>;
  selectedEquipment: string[];
  setSelectedEquipment: React.Dispatch<React.SetStateAction<string[]>>;
  isSaving: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onDelete: (request: MotoboyRequest) => void;
}) {
  return (
    <div className="space-y-6">
      <SupportCreateForm
        form={form}
        setForm={setForm}
        selectedEquipment={selectedEquipment}
        setSelectedEquipment={setSelectedEquipment}
        isSaving={isSaving}
        onSubmit={onSubmit}
      />
      <RequestListCard
        title="Lista de Solicitações"
        description={`${requests.length} solicitação(ões) registrada(s) para acompanhamento do Suporte.`}
        requests={requests}
        onDelete={onDelete}
      />
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
  function toggleEquipment(equipment: string) {
    setSelectedEquipment((current) => {
      if (current.includes(equipment)) {
        return current.filter((item) => item !== equipment);
      }
      return [...current, equipment];
    });
  }

  return (
    <Card className="border-cyan-500/20 bg-[#1e293b]/50 shadow-2xl shadow-cyan-950/20">
      <CardHeader>
        <CardTitle className="text-2xl font-black uppercase text-white">Nova Solicitação</CardTitle>
        <CardDescription className="text-slate-400">
          Preencha os dados até Prioridade. A Recepção cuidará do envio e recebimento.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Nome do Solicitante" value={form.nomeSolicitante} onChange={(value) => setForm((prev) => ({ ...prev, nomeSolicitante: value }))} required />
          <Field label="Data da Solicitação" type="date" value={form.dataSolicitacao} onChange={(value) => setForm((prev) => ({ ...prev, dataSolicitacao: value }))} required />
          <div className="space-y-3 md:col-span-2">
            <Label className="text-sm font-semibold text-slate-300">
              Equipamento <span className="text-red-400">*</span>
            </Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {EQUIPMENT_OPTIONS.map((equipment) => {
                const checked = selectedEquipment.includes(equipment);

                return (
                  <button
                    key={equipment}
                    type="button"
                    onClick={() => toggleEquipment(equipment)}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                      checked
                        ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                        : "border-slate-800 bg-slate-950/30 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <span className={`flex h-5 w-5 items-center justify-center rounded border ${
                      checked ? "border-cyan-400 bg-cyan-400 text-slate-950" : "border-slate-600"
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
          <Field label="Centro de Custo" value={form.centroCusto} onChange={(value) => setForm((prev) => ({ ...prev, centroCusto: value }))} />
          <Field label="Telefone" value={form.telefone} onChange={(value) => setForm((prev) => ({ ...prev, telefone: value }))} required />
          <Field label="Endereço" value={form.endereco} onChange={(value) => setForm((prev) => ({ ...prev, endereco: value }))} required className="md:col-span-2" />

          <SelectField label="ENTREGA/Retirada" value={form.tipoServico} onChange={(value) => setForm((prev) => ({ ...prev, tipoServico: value as MotoboyCreatePayload["tipoServico"] }))} options={["ENTREGA", "Retirada"]} />
          <SelectField label="Se possui Retorno" value={form.possuiRetorno} onChange={(value) => setForm((prev) => ({ ...prev, possuiRetorno: value as MotoboyCreatePayload["possuiRetorno"] }))} options={["Sim", "Não"]} />
          <SelectField label="Prioridade" value={form.prioridade} onChange={(value) => setForm((prev) => ({ ...prev, prioridade: value as MotoboyCreatePayload["prioridade"] }))} options={["Baixa", "Normal", "Alta", "Urgente"]} />

          <Button type="submit" disabled={isSaving} className="mt-4 h-12 bg-cyan-500 text-slate-950 hover:bg-cyan-400 md:col-span-2">
            {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
            Enviar Solicitação
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ReceptionUpdatePanel({
  requests,
  selectedRequestId,
  setSelectedRequestId,
  onDelete,
  form,
  setForm,
  shippingDates,
  setShippingDates,
  isSaving,
  onSubmit,
}: {
  requests: MotoboyRequest[];
  selectedRequestId: string;
  setSelectedRequestId: (id: string) => void;
  onDelete: (request: MotoboyRequest) => void;
  form: MotoboyUpdatePayload;
  setForm: React.Dispatch<React.SetStateAction<MotoboyUpdatePayload>>;
  shippingDates: typeof emptyShippingDates;
  setShippingDates: React.Dispatch<React.SetStateAction<typeof emptyShippingDates>>;
  isSaving: boolean;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const selectedRequest = requests.find((request) => request.id === selectedRequestId) || null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.1fr]">
      <Card className="border-orange-500/20 bg-[#1e293b]/50">
        <CardHeader>
          <CardTitle className="text-xl font-black uppercase text-white">Solicitações Pendentes</CardTitle>
          <CardDescription className="text-slate-400">
            {requests.length} pedido(s) aguardando atuação da Recepção.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {requests.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6 text-center text-sm text-slate-500">
              Nenhuma solicitação pendente.
            </div>
          ) : (
            requests.map((request) => (
              <div
                key={request.id}
                className={`w-full rounded-2xl border p-4 text-left transition-all ${
                  selectedRequestId === request.id
                    ? "border-cyan-500/40 bg-cyan-500/10"
                    : "border-slate-800 bg-slate-950/30 hover:border-slate-700"
                }`}
              >
                <button type="button" onClick={() => setSelectedRequestId(request.id)} className="w-full text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-white">{request.funcionario}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        {request.equipamento} • {request.tipoServico}
                      </div>
                      <div className="mt-2 text-xs text-slate-500">{request.endereco}</div>
                    </div>
                    <span className="rounded-full bg-orange-500/10 px-2 py-1 text-[10px] font-black uppercase text-orange-400">
                      {request.prioridade}
                    </span>
                  </div>
                </button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onDelete(request)}
                  className="mt-4 h-9 border-red-500/30 bg-red-500/10 text-xs font-bold text-red-300 hover:bg-red-500/20"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-cyan-500/20 bg-[#1e293b]/50">
        <CardHeader>
          <CardTitle className="text-xl font-black uppercase text-white">Atualizar Pedido</CardTitle>
          <CardDescription className="text-slate-400">
            Preencha os campos operacionais de envio e recebimento.
          </CardDescription>
        </CardHeader>
        <CardContent>
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

            <Button type="submit" disabled={isSaving || !selectedRequestId} className="mt-4 h-12 bg-orange-500 text-white hover:bg-orange-400 md:col-span-2">
              {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <PackageCheck className="mr-2 h-5 w-5" />}
              Salvar Atualização
            </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function RequesterInfoPanel({ selectedRequest }: { selectedRequest: MotoboyRequest | null }) {
  if (!selectedRequest) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4 text-sm font-medium text-slate-500">
        Selecione uma solicitação pendente para ver os dados do solicitante.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
      <div className="mb-3 text-xs font-black uppercase text-cyan-300">Dados do Solicitante</div>
      <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <InfoItem label="Solicitante" value={selectedRequest.nomeSolicitante} />
        <InfoItem label="Funcionário" value={selectedRequest.funcionario} />
        <InfoItem label="Email" value={selectedRequest.email} />
        <InfoItem label="Centro de Custo" value={selectedRequest.centroCusto} />
        <InfoItem label="Telefone/Celular" value={selectedRequest.telefone} />
        <InfoItem label="Prioridade" value={selectedRequest.prioridade} />
        <InfoItem label="Equipamento" value={selectedRequest.equipamento} />
        <InfoItem label="Serviço" value={`${selectedRequest.tipoServico} • Retorno: ${selectedRequest.possuiRetorno}`} />
        <InfoItem label="Endereço" value={selectedRequest.endereco} className="sm:col-span-2" />
      </div>
    </div>
  );
}

function InfoItem({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <div className="text-[11px] font-bold uppercase text-slate-500">{label}</div>
      <div className="mt-1 break-words font-semibold text-slate-100">{value || "-"}</div>
    </div>
  );
}

function RequestListCard({
  title,
  description,
  requests,
  onDelete,
}: {
  title: string;
  description: string;
  requests: MotoboyRequest[];
  onDelete: (request: MotoboyRequest) => void;
}) {
  return (
    <Card className="border-slate-800 bg-[#1e293b]/50">
      <CardHeader>
        <CardTitle className="text-xl font-black uppercase text-white">{title}</CardTitle>
        <CardDescription className="text-slate-400">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6 text-center text-sm text-slate-500">
            Nenhuma solicitação registrada.
          </div>
        ) : (
          requests.map((request) => (
            <div key={request.id} className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="font-black text-white">{request.funcionario}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {request.equipamento} • {request.tipoServico} • {request.status || "Pendente"}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">{request.endereco}</div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onDelete(request)}
                  className="h-9 border-red-500/30 bg-red-500/10 text-xs font-bold text-red-300 hover:bg-red-500/20"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
                </Button>
              </div>
            </div>
          ))
        )}
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
  setJustification: (value: string) => void;
  isDeleting: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <Card className="mb-6 border-red-500/30 bg-red-500/10">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-black uppercase text-red-200">Excluir Solicitação</CardTitle>
            <CardDescription className="text-red-100/80">
              Informe a justificativa para excluir a solicitação de {request.funcionario}.
            </CardDescription>
          </div>
          <Button type="button" variant="ghost" onClick={onCancel} className="text-red-100 hover:bg-red-500/20">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-red-100">
              Justificativa da exclusão <span className="text-red-200">*</span>
            </Label>
            <textarea
              required
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
              className="min-h-24 w-full rounded-lg border border-red-500/30 bg-slate-950/50 px-3 py-3 text-sm text-white outline-none transition-colors focus:border-red-300"
              placeholder="Descreva o motivo da exclusão."
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="submit" disabled={isDeleting} className="bg-red-600 text-white hover:bg-red-500">
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Confirmar Exclusão
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} className="border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800">
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="text-sm font-semibold text-slate-300">
        {label}
        {required ? <span className="text-red-400">*</span> : null}
      </Label>
      <Input
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 border-slate-700 bg-[#0f172a]/60 text-white focus:border-cyan-500/50"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-slate-300">{label}</Label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-lg border border-slate-700 bg-[#0f172a]/60 px-3 text-sm text-white outline-none transition-colors focus:border-cyan-500/50"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
