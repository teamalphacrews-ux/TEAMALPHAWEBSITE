import { Component, createElement } from 'react';

/** Read presentation only: recovery must never retain the thrown error or user data. */
export function readRecoveryAppearance(root = globalThis.document?.documentElement) {
  const appearance = root?.getAttribute('data-studio-appearance');
  const browserTheme = root?.getAttribute('data-studio-browser-theme');
  return appearance === 'dark' || browserTheme === 'dark' ? 'dark' : 'light';
}

/** Stays mounted across navigation; only a failed subtree resets when its route changes. */
export default class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, resetKey: props.resetKey, appearance: 'light' };
    this.retry = this.retry.bind(this);
  }

  static getDerivedStateFromError() {
    return { failed: true, appearance: readRecoveryAppearance() };
  }

  static getDerivedStateFromProps(props, state) {
    return props.resetKey !== state.resetKey
      ? { failed: false, resetKey: props.resetKey }
      : null;
  }

  retry() {
    this.setState({ failed: false });
  }

  render() {
    return this.state.failed
      ? createElement(this.props.fallback, { onRetry: this.retry, appearance: this.state.appearance })
      : this.props.children;
  }
}
