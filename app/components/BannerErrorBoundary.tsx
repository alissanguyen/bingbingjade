"use client";

import { Component, type ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { failed: boolean; }

export class BannerErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(err: unknown) {
    console.error("[AnnouncementBanner] render error — banner suppressed:", err);
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
