import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 font-sans text-center">
          <div className="max-w-md w-full bg-card border border-destructive/20 rounded-2xl p-8 shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center mx-auto mb-4 text-destructive">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h2 className="text-foreground text-xl font-bold mb-2">
              {this.props.fallbackTitle || 'Falha ao renderizar componente'}
            </h2>
            <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
              Ocorreu um erro inesperado ao carregar esta visualização. Seus dados continuam seguros.
            </p>
            {this.state.error?.message && (
              <div className="bg-muted border border-border rounded-lg p-3 text-xs text-destructive font-mono mb-6 text-left overflow-x-auto max-h-28">
                {this.state.error.message}
              </div>
            )}
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={this.handleRetry}
                className="w-full py-2.5 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold flex items-center justify-center gap-2 transition-colors text-sm shadow-md shadow-primary/20"
              >
                <RefreshCw className="w-4 h-4" />
                Tentar Novamente
              </button>
              {this.props.onReset && (
                <button
                  type="button"
                  onClick={this.props.onReset}
                  className="w-full py-2.5 px-4 rounded-lg border border-border text-foreground hover:bg-muted flex items-center justify-center gap-2 transition-colors text-sm font-semibold"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar ao Início
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
