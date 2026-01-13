import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    private handleReload = () => {
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-pink-50 p-6 text-center">
                    <div className="glass-card p-8 max-w-sm w-full space-y-6 flex flex-col items-center bg-white/80 border border-red-100 shadow-xl shadow-red-100/50">
                        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center text-red-500 mb-2 animate-pulse">
                            <AlertTriangle size={48} />
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Упс, ошибка!</h2>
                            <p className="text-gray-500 font-medium text-sm leading-relaxed">
                                Что-то пошло не так. Мы уже знаем об этом и работаем над исправлением.
                            </p>
                        </div>

                        {this.state.error && (
                            <div className="w-full bg-red-50 p-3 rounded-xl border border-red-100">
                                <code className="text-[10px] text-red-600 font-mono block overflow-hidden text-ellipsis whitespace-nowrap">
                                    {this.state.error.message}
                                </code>
                            </div>
                        )}

                        <button
                            onClick={this.handleReload}
                            className="w-full bg-red-500 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-red-200 active:scale-95 transition-all hover:bg-red-600"
                        >
                            <RefreshCw size={20} />
                            Перезагрузить
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
