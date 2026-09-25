/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Plus, 
  Minus,
  Monitor, 
  Laptop, 
  MousePointer2, 
  Keyboard, 
  Power,
  X,
  CheckCircle2,
  Building2
} from 'lucide-react';
import { 
  LogIn, 
  LogOut, 
  ShieldAlert, 
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Dashboard from '@/src/components/Dashboard';
import Motoboy from '@/src/components/Motoboy';
import ErrorBoundary from '@/src/components/ErrorBoundary';

interface CustomEquipment {
  id: string;
  name: string;
  quantity: number;
}

export default function App() {
  const [user, setUser] = useState<{name: string, email: string, picture: string} | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [view, setView] = useState<'form' | 'dashboard' | 'motoboy'>('form');
  const [motoboyPendingCount, setMotoboyPendingCount] = useState(0);
  const [colaborador, setColaborador] = useState('');
  const [statusRegistro, setStatusRegistro] = useState<'Devolução' | 'Desligamento'>('Devolução');
  const [filial, setFilial] = useState<'Barra Funda' | 'Extrema' | 'Belo Horizonte'>('Barra Funda');
  const [equipamentos, setEquipamentos] = useState<{id: string, quantity: number}[]>([]);
  const [customEquipName, setCustomEquipName] = useState('');
  const [customEquipQty, setCustomEquipQty] = useState(1);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastRegisteredName, setLastRegisteredName] = useState('');
  const [lastRegisteredFilial, setLastRegisteredFilial] = useState<'Barra Funda' | 'Extrema' | 'Belo Horizonte'>('Barra Funda');
  const [customEquipments, setCustomEquipments] = useState<CustomEquipment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const response = await fetch('/api/auth/status', {
          credentials: 'same-origin',
        });
        const data = await response.json();
        if (!cancelled) {
          setUser(data.authenticated ? data.user : null);
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password.trim()) {
      setAuthError("Por favor, insira a senha.");
      return;
    }

    setAuthLoading(true);
    setAuthError(null);

    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ password })
      });
      
      const data = await resp.json();
      
      if (resp.ok && data.success) {
        setUser(data.user);
      } else {
        setAuthError(data.message || "Senha incorreta.");
      }
    } catch (error) {
      setAuthError("Erro ao iniciar login: verifique sua conexão.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch {
      // A limpeza local ainda deve ocorrer quando o backend estiver indisponível.
    } finally {
      setUser(null);
      setView('form');
      setMotoboyPendingCount(0);
    }
  };

  // Sessão persistente sem expiração automática
  const logoutDueToInactivity = () => {
    handleLogout();
    };

  const toggleEquipamento = (id: string) => {
    setEquipamentos(prev => {
      const exists = prev.find(e => e.id === id);
      if (exists) {
        return prev.filter(e => e.id !== id);
      }
      return [...prev, { id, quantity: 1 }];
    });
  };

  const updateEquipamentoQuantity = (id: string, quantity: number) => {
    setEquipamentos(prev => prev.map(e => e.id === id ? { ...e, quantity: Math.max(1, quantity) } : e));
  };

  const addCustomEquipment = () => {
    if (customEquipName.trim()) {
      setCustomEquipments(prev => [
        ...prev, 
        { id: Math.random().toString(36).substr(2, 9), name: customEquipName, quantity: customEquipQty }
      ]);
      setCustomEquipName('');
      setCustomEquipQty(1);
    }
  };

  const handleRegister = async () => {
    if (!colaborador) {
      setMessage({ type: 'error', text: 'Por favor, preencha o nome do colaborador.' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const equipList = [
        ...equipamentos.map(e => {
          const label = standardEquipments.find(s => s.id === e.id)?.label || e.id;
          return `${e.quantity}x ${label}`;
        }),
        ...customEquipments.map(e => `${e.quantity}x ${e.name}`)
      ].join(", ");
      const equipDevolvido = statusRegistro === 'Devolução' ? 'Devolvido' : 'Desligamento';

      const basePayload: Record<string, any> = {
        colaborador: colaborador,
        filial: filial,
        equipamentoQuantidade: equipList,
        equipDevolvido: equipDevolvido,
        controleMaju: 'Entregue'
      };

      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        // Remove completamente a chave "email" da requisição.
        // A planilha nunca substituirá nada porque o "email" sequer será transmitido.
        body: JSON.stringify(basePayload),
      });

      const result = await response.json();

      if (response.ok) {
        setLastRegisteredName(colaborador);
        setLastRegisteredFilial(filial);
        setShowSuccessModal(true);
        setMessage({ type: 'success', text: `Registro realizado com sucesso para ${filial}!` });
        // Limpar campos principais após sucesso
        setColaborador('');
        setStatusRegistro('Devolução');
        setFilial('Barra Funda');
        setEquipamentos([]);
        setCustomEquipments([]);
        
        // Auto-hide message after 5 seconds
        setTimeout(() => {
          setMessage(null);
        }, 5000);
      } else {
        throw new Error(result.error || 'Erro ao registrar na planilha.');
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const removeCustomEquipment = (id: string) => {
    setCustomEquipments(prev => prev.filter(e => e.id !== id));
  };

  const standardEquipments = [
    { id: 'notebook', label: 'Notebook', icon: Laptop },
    { id: 'fonte', label: 'Fonte', icon: Power },
    { id: 'mouse', label: 'Mouse', icon: MousePointer2 },
    { id: 'teclado', label: 'Teclado', icon: Keyboard },
    { id: 'monitor', label: 'Monitor', icon: Monitor },
    { id: 'macbook', label: 'MacBook', icon: Laptop },
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground font-medium">Autenticando...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20 flex items-center justify-center p-4">
        {/* Background Subtle Accent */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative max-w-sm w-full"
        >
          <Card className="bg-card border-border backdrop-blur-2xl shadow-2xl overflow-hidden p-8 text-center">
            <div className="flex justify-center mb-8">
              <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center border border-border shadow-lg transition-transform hover:scale-110 duration-300 overflow-hidden">
                <img 
                  src="https://play-lh.googleusercontent.com/BpgosTzb9wzfgCUTYhN6LvYIAB_A-aWozJCZ6vg0nN6-8ul97z2THmJrrB8aQSO73M4" 
                  alt="Dafiti Icon" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            <h1 className="text-3xl font-black tracking-tight text-foreground mb-3 uppercase">
              CONTROLE <br />
              <span className="text-dft-teal italic">ATIVOS</span>
            </h1>
            <p className="text-muted-foreground font-medium mb-10 leading-relaxed text-sm">
              Gestão de Ativos • TI Infraestrutura<br/>
              Dafiti Group
            </p>

            {authError && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-8 p-4 bg-dft-coral/10 border border-dft-coral/30 rounded-2xl text-dft-coral text-xs flex items-start gap-4 text-left shadow-lg shadow-dft-coral/5"
              >
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <span>{authError}</span>
              </motion.div>
            )}

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="relative group">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Senha de Acesso"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-14 bg-muted/40 border-border text-center text-lg text-foreground placeholder:text-muted-foreground tracking-widest focus:border-dft-teal focus:ring-1 focus:ring-dft-teal rounded-2xl pr-14"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-2 rounded-full hover:bg-muted"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>

              <Button 
                type="submit"
                disabled={authLoading}
                className="w-full h-14 bg-dft-teal hover:bg-dft-teal-hover text-dft-black font-bold text-lg rounded-2xl flex items-center justify-center gap-4 transition-all active:scale-95 shadow-xl shadow-dft-teal/20 disabled:opacity-50"
              >
                {authLoading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <LogIn className="w-6 h-6" />
                )}
                {authLoading ? 'Verificando...' : 'Acessar Sistema'}
              </Button>
            </form>

            <div className="mt-10 pt-8 border-t border-border">
              <div className="flex justify-center gap-2 mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-dft-teal" />
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-bold">
                Segurança Corporativa
              </p>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <>
    <AnimatePresence mode="wait">
      {view === 'motoboy' ? (
        <motion.div
          key="motoboy"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="min-h-screen bg-background text-foreground"
        >
          <ErrorBoundary fallbackTitle="Falha ao carregar Módulo Motoboy" onReset={() => setView('form')}>
            <Motoboy
              userEmail={user?.email}
              onPendingCountChange={setMotoboyPendingCount}
              onBack={() => setView('form')}
            />
          </ErrorBoundary>
        </motion.div>
      ) : view === 'dashboard' ? (
        <motion.div
          key="dashboard"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="min-h-screen bg-background text-foreground"
        >
          <ErrorBoundary fallbackTitle="Falha ao carregar Dashboard" onReset={() => setView('form')}>
            <Dashboard onBack={() => setView('form')} userEmail={user?.email} />
          </ErrorBoundary>
        </motion.div>
      ) : (
        <motion.div
          key="form"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20"
        >
          {/* Background Subtle Accent */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full" />
          </div>

          <div className="relative max-w-3xl mx-auto px-4 py-8">
            {/* Upper Profile Bar */}
            <div className="flex justify-between items-center mb-10 px-6 py-3 bg-card border border-border backdrop-blur-md rounded-2xl shadow-xl">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center border border-border overflow-hidden shadow-inner">
                    <img 
                      src="https://play-lh.googleusercontent.com/BpgosTzb9wzfgCUTYhN6LvYIAB_A-aWozJCZ6vg0nN6-8ul97z2THmJrrB8aQSO73M4" 
                      alt="Dafiti Icon" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-background rounded-full" />
                </div>
                <div>
                  <div className="text-sm font-bold text-foreground leading-tight">{user.name}</div>
                  <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{user.email}</div>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLogout}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl h-10 px-4 transition-all"
              >
                <LogOut className="w-4 h-4 mr-2" />
                <span className="text-xs font-bold uppercase tracking-tight">Sair</span>
              </Button>
            </div>

            {/* Header */}
            <div className="flex flex-col items-center mb-12 text-center">
              <div className="mb-8 flex flex-wrap justify-center gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setView('dashboard')}
                  className="bg-card border-border text-foreground hover:bg-accent hover:text-accent-foreground transition-all gap-2 rounded-lg px-6"
                >
                  <LayoutDashboard className="w-4 h-4 text-primary" />
                  Dashboard
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setView('motoboy')}
                  className="relative bg-card border-border text-foreground hover:bg-accent hover:text-accent-foreground transition-all gap-2 rounded-lg px-6"
                >
                  Motoboy
                  {motoboyPendingCount > 0 && (
                    <span className="absolute -right-2 -top-2 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-black text-destructive-foreground">
                      {motoboyPendingCount}
                    </span>
                  )}
                </Button>
              </div>
              
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-foreground mb-2 uppercase">
                CONTROLE DE <br className="md:hidden" />
                <span className="text-dft-teal">EQUIPAMENTOS</span>
              </h1>
          <p className="text-muted-foreground font-medium text-lg">Sistema de Controle de Colaboradores</p>
          
          <div className="flex gap-1.5 mt-6">
            <div className="h-1.5 w-14 bg-dft-teal rounded-full" />
            <div className="h-1.5 w-6 bg-muted-foreground/30 rounded-full" />
          </div>
        </div>

        {/* Form Card */}
        <Card className="bg-card border-border backdrop-blur-xl shadow-2xl overflow-hidden">
          <CardHeader className="pb-4 relative">
            <div>
              <CardTitle className="text-2xl font-bold text-foreground">Novo Registro</CardTitle>
              <CardDescription className="text-muted-foreground">Preencha os dados do colaborador desligado</CardDescription>
            </div>
            <div className="h-0.5 w-16 bg-dft-teal mt-2 rounded-full" />
            <div className="mt-4 space-y-2">
              <Label htmlFor="statusRegistro" className="text-sm font-semibold text-foreground">
                Status <span className="text-destructive">*</span>
              </Label>
              <select
                id="statusRegistro"
                value={statusRegistro}
                onChange={(e) => setStatusRegistro(e.target.value as 'Devolução' | 'Desligamento')}
                className="h-12 w-full rounded-md border border-border bg-muted/40 px-3 text-sm text-foreground shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="Devolução">Devolução</option>
                <option value="Desligamento">Desligamento</option>
              </select>
            </div>
          </CardHeader>

          <CardContent className="space-y-8">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="colaborador" className="text-sm font-semibold text-foreground">
                  Colaborador <span className="text-destructive">*</span>
                </Label>
                <Input 
                  id="colaborador"
                  placeholder="Nome completo do colaborador"
                  value={colaborador}
                  onChange={(e) => {
                    const value = e.target.value;
                    const sanitizedValue = value.replace(/[0-9]/g, '');
                    setColaborador(sanitizedValue);
                  }}
                  className="bg-muted/40 border-border focus:border-primary focus:ring-primary/20 text-foreground h-12"
                />
              </div>

              {/* Filial */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-primary" />
                    Filial <span className="text-destructive">*</span>
                  </span>
                  <span className="text-xs text-muted-foreground font-normal">
                    Selecione a unidade
                  </span>
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: 'Barra Funda', label: 'Barra Funda', uf: 'SP' },
                    { id: 'Extrema', label: 'Extrema', uf: 'MG' },
                    { id: 'Belo Horizonte', label: 'Belo Horizonte', uf: 'MG' },
                  ].map((branch) => {
                    const isSelected = filial === branch.id;
                    return (
                      <button
                        key={branch.id}
                        type="button"
                        onClick={() => setFilial(branch.id as 'Barra Funda' | 'Extrema' | 'Belo Horizonte')}
                        className={`h-12 px-3.5 rounded-xl text-sm font-semibold transition-all border flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-dft-teal text-dft-black border-dft-teal shadow-lg shadow-dft-teal/20 ring-1 ring-dft-teal'
                            : 'bg-muted/40 border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Building2 className={`w-4 h-4 shrink-0 ${isSelected ? 'text-dft-black' : 'text-muted-foreground'}`} />
                          <span className="font-medium">{branch.label}</span>
                        </span>
                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          isSelected ? 'bg-dft-black/20 text-dft-black' : 'bg-muted text-muted-foreground'
                        }`}>
                          {branch.uf}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Equipments */}
            <div className="space-y-4">
              <Label className="text-sm font-semibold text-foreground">
                Equipamentos <span className="text-destructive">*</span>
              </Label>
              <div className="grid grid-cols-1 gap-3">
                {standardEquipments.map((equip) => {
                  const isSelected = equipamentos.some(e => e.id === equip.id);
                  const currentQty = equipamentos.find(e => e.id === equip.id)?.quantity || 1;

                  return (
                    <div 
                      key={equip.id}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all group ${
                        isSelected 
                          ? 'bg-primary/10 border-primary/40 text-foreground' 
                          : 'bg-muted/20 border-border text-muted-foreground hover:border-border/80'
                      }`}
                    >
                      <div 
                        className="flex items-center gap-3 cursor-pointer flex-1"
                        onClick={() => toggleEquipamento(equip.id)}
                      >
                        <div onClick={(e) => e.stopPropagation()} className="flex items-center">
                          <Checkbox 
                            id={equip.id} 
                            checked={isSelected}
                            onCheckedChange={() => toggleEquipamento(equip.id)}
                            className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                          />
                        </div>
                        <equip.icon className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                        <span className="font-medium">{equip.label}</span>
                      </div>

                      <AnimatePresence>
                        {isSelected && (
                          <motion.div 
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button 
                              variant="secondary" 
                              size="icon"
                              className="w-8 h-8 bg-muted hover:bg-accent text-foreground border-none rounded-md"
                              onClick={() => updateEquipamentoQuantity(equip.id, currentQty - 1)}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            
                            <div className="w-10 h-8 bg-muted/60 flex items-center justify-center rounded-md text-sm font-bold text-foreground border border-border">
                              {currentQty}
                            </div>

                            <Button 
                              variant="secondary" 
                              size="icon"
                              className="w-8 h-8 bg-muted hover:bg-accent text-foreground border-none rounded-md"
                              onClick={() => updateEquipamentoQuantity(equip.id, currentQty + 1)}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom Equipments */}
            <div className="space-y-4">
              <Label className="text-sm font-semibold text-foreground">
                Adicionar Equipamentos Personalizados
              </Label>
              <div className="flex gap-2 items-center">
                <Input 
                  placeholder="Ex: Webcam, Headset, Monitor Secundário..."
                  value={customEquipName}
                  onChange={(e) => setCustomEquipName(e.target.value)}
                  className="bg-muted/40 border-border focus:border-primary focus:ring-primary/20 text-foreground h-12 flex-1"
                />
                
                <AnimatePresence>
                  {customEquipName.trim() && (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex items-center gap-2"
                    >
                      <div className="flex items-center gap-1 bg-muted/40 border border-border rounded-xl px-1 h-12">
                        <Button 
                          variant="secondary" 
                          size="icon"
                          className="w-8 h-8 bg-muted hover:bg-accent text-foreground border-none rounded-md"
                          onClick={() => setCustomEquipQty(Math.max(1, customEquipQty - 1))}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        
                        <div className="w-10 h-8 bg-muted/60 flex items-center justify-center rounded-md text-sm font-bold text-foreground border border-border">
                          {customEquipQty}
                        </div>

                        <Button 
                          variant="secondary" 
                          size="icon"
                          className="w-8 h-8 bg-muted hover:bg-accent text-foreground border-none rounded-md"
                          onClick={() => setCustomEquipQty(customEquipQty + 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>

                      <Button 
                        onClick={addCustomEquipment}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground h-12 w-12 p-0 rounded-xl shrink-0"
                      >
                        <Plus className="w-6 h-6" />
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <AnimatePresence>
                {customEquipments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {customEquipments.map((equip) => (
                      <motion.div
                        key={equip.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex items-center gap-2 bg-muted/40 border border-border px-3 py-1.5 rounded-full text-sm text-foreground"
                      >
                        <span className="font-bold text-primary">{equip.quantity}x</span>
                        <span>{equip.name}</span>
                        <button 
                          onClick={() => removeCustomEquipment(equip.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </AnimatePresence>
            </div>

            {/* Submit Button */}
            <Button 
              onClick={handleRegister}
              disabled={isLoading}
              className="w-full h-14 text-lg font-bold text-dft-black bg-dft-teal hover:bg-dft-teal-hover shadow-xl shadow-dft-teal/20 transition-all duration-300 rounded-xl mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-dft-black/30 border-t-dft-black rounded-full animate-spin" />
                  Registrando...
                </div>
              ) : (
                'Registrar Recebimento'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 flex flex-col items-center gap-2 text-muted-foreground text-sm">
          <img 
            src="https://play-lh.googleusercontent.com/BpgosTzb9wzfgCUTYhN6LvYIAB_A-aWozJCZ6vg0nN6-8ul97z2THmJrrB8aQSO73M4" 
            alt="Dafiti Icon" 
            className="w-8 h-8 opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-300 pointer-events-none"
            referrerPolicy="no-referrer"
          />
          <p>© 2026 Dafiti Group - TI Infraestrutura</p>
        </div>
      </div>
    </motion.div>
    )}
    </AnimatePresence>

    {/* Floating Notification */}
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[110] w-full max-w-sm px-4"
        >
          <div className={`p-4 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-3 border ${
            message.type === 'success' 
              ? 'bg-green-500/20 border-green-500/30 text-green-400' 
              : 'bg-red-500/20 border-red-500/30 text-red-400'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <ShieldAlert className="w-5 h-5 shrink-0" />
            )}
            <span className="text-sm font-bold">{message.text}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Success Modal */}
    <AnimatePresence>
      {showSuccessModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSuccessModal(false)}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Success Animation Background */}
            <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-emerald-500/20 to-transparent pointer-events-none" />
            
            <div className="relative p-8 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 border border-emerald-500/30">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                >
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </motion.div>
              </div>
              
              <h3 className="text-2xl font-black text-foreground mb-2 uppercase tracking-tight">
                Registro Concluído!
              </h3>
              
              <p className="text-muted-foreground mb-6 font-medium">
                O colaborador <span className="text-foreground font-bold">{lastRegisteredName}</span> foi registrado com sucesso na unidade <span className="text-primary font-bold">{lastRegisteredFilial}</span> na planilha de desligados.
              </p>
              
              <div className="w-full h-px bg-border mb-6" />
              
              <Button 
                onClick={() => setShowSuccessModal(false)}
                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95"
              >
                Entendido
              </Button>
            </div>
            
            {/* Bottom Accent */}
            <div className="h-1.5 w-full bg-emerald-500" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </>
  );
}
