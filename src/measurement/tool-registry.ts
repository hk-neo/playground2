import type { IMeasurementTool } from '../shared/interfaces/measurement';

export class ToolRegistry {
  private tools = new Map<string, IMeasurementTool>();
  private activeTool: string | null = null;

  register(name: string, tool: IMeasurementTool): void {
    this.tools.set(name, tool);
  }

  setActive(name: string): void {
    const tool = this.tools.get(name);
    if (!tool) return;

    // Deactivate current tool
    if (this.activeTool) {
      const current = this.tools.get(this.activeTool);
      current?.deactivate();
    }

    this.activeTool = name;
    tool.activate();
  }

  getActive(): IMeasurementTool | null {
    if (!this.activeTool) return null;
    return this.tools.get(this.activeTool) ?? null;
  }

  getActiveName(): string | null {
    return this.activeTool;
  }

  listTools(): string[] {
    return Array.from(this.tools.keys());
  }

  unregister(name: string): void {
    if (this.activeTool === name) {
      const tool = this.tools.get(name);
      tool?.deactivate();
      this.activeTool = null;
    }
    this.tools.delete(name);
  }

  clearActive(): void {
    if (this.activeTool) {
      const tool = this.tools.get(this.activeTool);
      tool?.deactivate();
      this.activeTool = null;
    }
  }
}
