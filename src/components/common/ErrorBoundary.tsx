import React, { Component, ErrorInfo, ReactNode, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/styles/theme';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// A class component cannot call hooks, so the fallback UI — the only part
// that reads theme colors — is split out into a function component. This is
// what lets it resolve colors at render time via useTheme() while the error
// boundary itself stays a class (required for getDerivedStateFromError /
// componentDidCatch).
interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onReset: () => void;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  errorInfo,
  onReset,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.primary,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        },
        errorCard: {
          backgroundColor: colors.surface,
          borderRadius: 8,
          padding: 20,
          width: '100%',
          maxWidth: 400,
          borderWidth: 1,
          borderColor: colors.accent.danger,
        },
        title: {
          fontSize: 20,
          fontWeight: 'bold',
          color: colors.accent.danger,
          marginBottom: 10,
        },
        message: {
          fontSize: 16,
          color: colors.text.primary,
          marginBottom: 20,
          lineHeight: 22,
        },
        debugInfo: {
          backgroundColor: colors.primary,
          padding: 10,
          borderRadius: 4,
          marginBottom: 15,
        },
        debugTitle: {
          fontSize: 14,
          fontWeight: 'bold',
          color: colors.text.secondary,
          marginBottom: 5,
        },
        debugText: {
          fontSize: 12,
          color: colors.text.secondary,
          fontFamily: 'monospace',
        },
        button: {
          backgroundColor: colors.accent.primary,
          padding: 12,
          borderRadius: 6,
          alignItems: 'center',
        },
        buttonText: {
          color: colors.text.primary,
          fontSize: 16,
          fontWeight: '600',
        },
      }),
    [colors]
  );

  return (
    <View style={styles.container}>
      <View style={styles.errorCard}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>
          {error?.message || 'An unexpected error occurred'}
        </Text>
        {__DEV__ && errorInfo && (
          <View style={styles.debugInfo}>
            <Text style={styles.debugTitle}>Debug Info:</Text>
            <Text style={styles.debugText}>{errorInfo.componentStack}</Text>
          </View>
        )}
        <TouchableOpacity style={styles.button} onPress={onReset}>
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error for debugging
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}
