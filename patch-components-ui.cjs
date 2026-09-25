const fs = require('fs');

let code = fs.readFileSync('src/components/Motoboy.tsx', 'utf8');

// Add Tabs UI above the panels
const targetTabs = `        {isLoading ? (
          <Card className="border-slate-800 bg-[#1e293b]/50">
            <CardContent className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 className="mr-3 h-5 w-5 animate-spin text-cyan-400" />
              Carregando solicitações...
            </CardContent>
          </Card>
        ) : role === "suporte" ? (
          <SupportPanel`;

const replacementTabs = `        {isLoading ? (
          <Card className="border-slate-800 bg-[#1e293b]/50">
            <CardContent className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 className="mr-3 h-5 w-5 animate-spin text-cyan-400" />
              Carregando solicitações...
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="flex gap-2">
              {(["Pendentes", "Concluídas", "Excluídas"] as MotoboyTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); setSelectedRequestId(""); }}
                  className={\`px-4 py-2 rounded-full text-sm font-bold transition-all \${activeTab === tab ? "bg-cyan-500 text-slate-950" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}\`}
                >
                  {tab}
                </button>
              ))}
            </div>
            {role === "suporte" ? (
          <SupportPanel`;

code = code.replace(targetTabs, replacementTabs);

// Add missing closing divs and pass new props
const targetSupportPanel = `          <SupportPanel
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
          <ReceptionUpdatePanel`;

const replacementSupportPanel = `          <SupportPanel
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
          <ReceptionUpdatePanel`;

code = code.replace(targetSupportPanel, replacementSupportPanel);

const targetReceptionPanel = `          <ReceptionUpdatePanel
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
        ) : (`;

const replacementReceptionPanel = `          <ReceptionUpdatePanel
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
        ) : (`;

code = code.replace(targetReceptionPanel, replacementReceptionPanel);

const targetEndRole = `            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-400">
              Você não possui permissão para acessar esta área.
            </div>
        )}`;

const replacementEndRole = `            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-400">
              Você não possui permissão para acessar esta área.
            </div>
            )}
          </div>
        )}`;

code = code.replace(targetEndRole, replacementEndRole);

fs.writeFileSync('src/components/Motoboy.tsx', code);
