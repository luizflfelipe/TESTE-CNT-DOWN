const fs = require('fs');

let code = fs.readFileSync('src/components/Motoboy.tsx', 'utf8');

// I will extract everything from "function SupportPanel({" to the end of the file, and replace it with my new implementations.
const splitPoint = "function SupportPanel({";
const parts = code.split(splitPoint);

const topPart = parts[0];

const newPanels = `function SupportPanel({
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.1fr]">
        <RequestListCard
          title="Lista de Solicitações"
          description={\`\${requests.length} solicitação(ões) na aba atual.\`}
          requests={requests}
          selectedRequestId={selectedRequestId}
          setSelectedRequestId={setSelectedRequestId}
        />
        {selectedRequest && (
          <RequestDetailPanel 
            request={selectedRequest} 
            events={events} 
            onDelete={onDelete} 
            showDelete={true} 
          />
        )}
      </div>
    </div>
  );
}

function ReceptionUpdatePanel({
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
  const isReadOnly = selectedRequest?.status === "Concluído" || selectedRequest?.status === "Excluído";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.1fr]">
      <RequestListCard
        title="Lista de Solicitações"
        description={\`\${requests.length} solicitação(ões) na aba atual.\`}
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
            showDelete={false} 
          />
        ) : (
          <Card className="border-cyan-500/20 bg-[#1e293b]/50 h-fit">
            <CardHeader>
              <CardTitle className="text-xl font-black uppercase text-white flex items-center justify-between">
                <span>Atualizar Pedido</span>
                <span className="text-xs text-slate-400 font-normal">ID: {selectedRequest.id.substring(0,8)}</span>
              </CardTitle>
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
        )
      )}
    </div>
  );
}

function RequestDetailPanel({ request, events, onDelete, showDelete }: { request: MotoboyRequest; events: MotoboyEvent[]; onDelete: (r: MotoboyRequest) => void; showDelete: boolean }) {
  return (
    <Card className="border-cyan-500/20 bg-[#1e293b]/50 h-fit">
      <CardHeader>
        <CardTitle className="text-xl font-black uppercase text-white flex items-center justify-between">
          <span>Detalhes e Histórico</span>
          <span className="text-xs text-slate-400 font-normal">ID: {request.id}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <RequesterInfoPanel selectedRequest={request} />
        
        <div>
          <h3 className="text-sm font-bold text-slate-300 mb-3 border-b border-slate-700 pb-2">Histórico de Eventos</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
            {events.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-4">Nenhum evento registrado ou funcionalidade indisponível.</div>
            ) : (
              events.map(ev => (
                <div key={ev.id} className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 text-xs">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-cyan-400 uppercase">{ev.eventType}</span>
                    <span className="text-slate-500">{new Date(ev.createdAt).toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="text-slate-400 mb-2">Por: <span className="text-slate-300 font-medium">{ev.actor}</span></div>
                  <pre className="text-[10px] text-slate-500 bg-slate-950 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(ev.payload, null, 2)}
                  </pre>
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
  requests,
  selectedRequestId,
  setSelectedRequestId,
}: {
  title: string;
  description: string;
  requests: MotoboyRequest[];
  selectedRequestId: string;
  setSelectedRequestId: (id: string) => void;
}) {
  return (
    <Card className="border-orange-500/20 bg-[#1e293b]/50 h-fit">
      <CardHeader>
        <CardTitle className="text-xl font-black uppercase text-white">{title}</CardTitle>
        <CardDescription className="text-slate-400">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6 text-center text-sm text-slate-500">
            Nenhuma solicitação na aba atual.
          </div>
        ) : (
          requests.map((request) => (
            <div
              key={request.id}
              className={\`w-full rounded-2xl border p-4 text-left transition-all \${
                selectedRequestId === request.id
                  ? "border-cyan-500/40 bg-cyan-500/10"
                  : "border-slate-800 bg-slate-950/30 hover:border-slate-700"
              }\`}
            >
              <button type="button" onClick={() => setSelectedRequestId(request.id)} className="w-full text-left">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-black text-white">{request.funcionario}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {request.equipamento} • {request.tipoServico} • 
                      <span className={\`ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase \${
                        request.status === "Concluído" ? "bg-green-500/20 text-green-400" :
                        request.status === "Excluído" ? "bg-red-500/20 text-red-400" :
                        "bg-orange-500/20 text-orange-400"
                      }\`}>
                        {request.status || "Pendente"}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">{request.endereco}</div>
                  </div>
                </div>
              </button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function RequesterInfoPanel({ selectedRequest }: { selectedRequest: MotoboyRequest | null }) {
  if (!selectedRequest) return null;
  return (
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
        <div className="col-span-2">
          <div className="text-slate-500">Endereço</div>
          <div className="font-medium text-slate-300">{selectedRequest.endereco}</div>
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
    <Card className="border-cyan-500/20 bg-[#1e293b]/50">
      <CardHeader>
        <CardTitle className="text-xl font-black uppercase text-white">Nova Solicitação</CardTitle>
        <CardDescription className="text-slate-400">Preencha os dados do colaborador.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Field label="Nome Solicitante" value={form.nomeSolicitante} onChange={(value) => setForm((prev) => ({ ...prev, nomeSolicitante: value }))} required />
            <Field label="Telefone" value={form.telefone} onChange={(value) => setForm((prev) => ({ ...prev, telefone: value }))} required />
            <SelectField label="Tipo de Serviço" value={form.tipoServico} onChange={(value) => setForm((prev) => ({ ...prev, tipoServico: value as any }))} options={["ENTREGA", "Retirada"]} required />
            <SelectField label="Prioridade" value={form.prioridade} onChange={(value) => setForm((prev) => ({ ...prev, prioridade: value as any }))} options={["Baixa", "Normal", "Alta", "Urgente"]} required />
            <SelectField label="Possui Retorno?" value={form.possuiRetorno} onChange={(value) => setForm((prev) => ({ ...prev, possuiRetorno: value as any }))} options={["Sim", "Não"]} required />
            <Field label="Centro de Custo" value={form.centroCusto} onChange={(value) => setForm((prev) => ({ ...prev, centroCusto: value }))} required />
            
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
                      className={\`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all \${
                        checked ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300" : "border-slate-800 bg-slate-950/30 text-slate-400 hover:border-slate-700"
                      }\`}
                    >
                      <span className={\`flex h-5 w-5 items-center justify-center rounded border \${
                        checked ? "border-cyan-400 bg-cyan-400 text-slate-950" : "border-slate-600"
                      }\`}>
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
                className="h-12 border-slate-700 bg-slate-950/50 text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:ring-cyan-500/20"
                placeholder="Rua, Número, Complemento, Bairro, Cidade, CEP..."
              />
            </div>
          </div>
          <div className="flex justify-end pt-4 border-t border-slate-800">
            <Button type="submit" disabled={isSaving} className="h-12 bg-cyan-500 px-8 font-bold text-slate-950 hover:bg-cyan-400">
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
        <Card className="border-red-500/30 bg-[#0f172a] shadow-2xl">
          <CardHeader className="border-b border-slate-800">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center text-xl font-black text-red-500">
                <ShieldAlert className="mr-3 h-6 w-6" />
                Excluir Solicitação
              </CardTitle>
              <button onClick={onCancel} className="text-slate-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <CardDescription className="text-slate-400 mt-2">
              Esta ação removerá o pedido de <span className="font-bold text-slate-300">{request.funcionario}</span>.
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

function Field({ label, required, className, ...props }: { label: string; required?: boolean; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={\`space-y-2 \${className || ""}\`}>
      <Label className="text-sm font-semibold text-slate-300">
        {label} {required && <span className="text-red-400">*</span>}
      </Label>
      <Input
        {...props}
        className="h-11 border-slate-700 bg-slate-950/50 text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:ring-cyan-500/20"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options, required, className }: { label: string; value: string; onChange: (value: string) => void; options: string[]; required?: boolean; className?: string }) {
  return (
    <div className={\`space-y-2 \${className || ""}\`}>
      <Label className="text-sm font-semibold text-slate-300">
        {label} {required && <span className="text-red-400">*</span>}
      </Label>
      <div className="flex gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={\`flex-1 rounded-lg border px-3 py-2 text-sm font-bold transition-all \${
              value === option ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300" : "border-slate-800 bg-slate-950/30 text-slate-400 hover:border-slate-700"
            }\`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
`;

code = topPart + newPanels;
fs.writeFileSync('src/components/Motoboy.tsx', code);
