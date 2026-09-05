import { Component, ErrorInfo, Fragment, ReactNode } from "react";
import i18n from "@/i18n";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  // Bumped on reset so "다시 시도" remounts the subtree instead of re-rendering
  // the same (possibly corrupted) tree straight back into the error.
  resetKey: number;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, resetKey: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Page render error:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState((prev) => ({ hasError: false, error: null, resetKey: prev.resetKey + 1 }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
            <AlertTriangle className="h-7 w-7 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">{i18n.t("error_boundary.title")}</h2>
          <p className="text-sm text-gray-500 mb-6 max-w-sm">
            {i18n.t("error_boundary.description")}
          </p>
          {this.state.error && (
            <pre className="text-xs text-left bg-gray-50 border border-gray-200 rounded-lg p-3 mb-5 max-w-lg overflow-auto text-red-600 w-full">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-3">
            <Button variant="outline" onClick={this.handleReset} className="gap-2">
              <RefreshCw className="h-4 w-4" /> {i18n.t("error_boundary.try_again")}
            </Button>
            <Button onClick={() => window.location.reload()}>
              {i18n.t("error_boundary.reload")}
            </Button>
          </div>
        </div>
      );
    }

    return <Fragment key={this.state.resetKey}>{this.props.children}</Fragment>;
  }
}
