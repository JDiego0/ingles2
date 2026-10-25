import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** Evita la pantalla en blanco ante un error inesperado. El progreso guardado no se toca. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('English Journey error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="app-main">
        <div className="card card--warn">
          <h1>Algo salió mal</h1>
          <p>Ocurrió un error inesperado en esta pantalla. Tu progreso guardado no se ha borrado.</p>
          <p className="muted small">Detalle técnico: {this.state.error.message}</p>
          <div className="row">
            <button
              className="btn btn--primary"
              onClick={() => {
                window.location.hash = '#/';
                window.location.reload();
              }}
            >
              Volver al inicio
            </button>
          </div>
        </div>
      </main>
    );
  }
}
