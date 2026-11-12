import { WebSocket } from 'ws';

export interface DispatchedJobPayload {
  orderItemId: string;
  documentName: string;
  totalPages: number;
  colorMode: string;
  duplexMode: string;
  paperSize: string;
  copies: number;
  downloadUrl: string;
  createdAt: number;
  targetPrinter?: {
    id: string;
    name: string;
    portName: string;
  };
  requiresManualFlip?: boolean;
}

export interface ConnectedAgent {
  connectionId: string;
  centerId: string;
  socket: WebSocket;
  deviceModel?: string;
  appVersion?: string;
  connectedAt: Date;
  lastHeartbeat: Date;
}

export interface PrinterTelemetry {
  name: string;
  port: string;
  status: 'ONLINE' | 'PAPER_OUT' | 'OFFLINE' | 'ERROR';
  queuedJobs: number;
  queuedPages: number;
  supportsColor: boolean;
  supportsA3: boolean;
  supportsAutoDuplex: boolean;
  lastUpdated?: Date;
}

class AgentRegistry {
  // Map of connectionId -> ConnectedAgent
  private agents = new Map<string, ConnectedAgent>();

  // Map of centerId -> Set of connectionIds
  private centerToAgents = new Map<string, Set<string>>();

  // Map of centerId -> isSpoolerPaused
  private centerSpoolerPaused = new Map<string, boolean>();

  // Map of centerId -> PrinterTelemetry[]
  private centerTelemetry = new Map<string, PrinterTelemetry[]>();

  public updatePrinterTelemetry(centerId: string, telemetry: PrinterTelemetry[]): void {
    const listWithTimestamp = telemetry.map((t) => ({
      ...t,
      lastUpdated: new Date(),
    }));
    this.centerTelemetry.set(centerId, listWithTimestamp);
    console.log(`📊 Updated printer telemetry for Center [${centerId}]: ${telemetry.length} printer(s)`);
  }

  public getPrinterTelemetry(centerId: string): PrinterTelemetry[] {
    return this.centerTelemetry.get(centerId) || [];
  }

  public isSpoolerPaused(centerId: string): boolean {
    return this.centerSpoolerPaused.get(centerId) ?? false;
  }

  public setSpoolerPaused(centerId: string, paused: boolean): void {
    this.centerSpoolerPaused.set(centerId, paused);
  }

  /**
   * Broadcasts SPOOLER_STATE message to all active agents for the specified center.
   */
  public broadcastSpoolerState(centerId: string, isPaused: boolean): number {
    this.centerSpoolerPaused.set(centerId, isPaused);

    const message = JSON.stringify({
      type: 'SPOOLER_STATE',
      isPaused,
      timestamp: Date.now(),
    });

    let sent = 0;
    const connectionIds = this.centerToAgents.get(centerId);
    if (connectionIds) {
      for (const connId of connectionIds) {
        const agent = this.agents.get(connId);
        if (agent && agent.socket.readyState === WebSocket.OPEN) {
          try {
            agent.socket.send(message);
            sent++;
          } catch (_err) {}
        }
      }
    }

    // Fallback broadcast to all active agents if center not specifically mapped
    if (sent === 0) {
      for (const agent of this.agents.values()) {
        if (agent.socket.readyState === WebSocket.OPEN) {
          try {
            agent.socket.send(message);
            sent++;
          } catch (_err) {}
        }
      }
    }

    console.log(`📡 Broadcasted SPOOLER_STATE (isPaused=${isPaused}) to ${sent} connected agent(s) for Center [${centerId}]`);
    return sent;
  }

  register(connectionId: string, centerId: string, socket: WebSocket): ConnectedAgent {
    const agent: ConnectedAgent = {
      connectionId,
      centerId,
      socket,
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
    };

    this.agents.set(connectionId, agent);

    if (!this.centerToAgents.has(centerId)) {
      this.centerToAgents.set(centerId, new Set());
    }
    this.centerToAgents.get(centerId)!.add(connectionId);

    console.log(`🔌 Agent registered: [${connectionId}] for Center [${centerId}]`);
    return agent;
  }

  updateDeviceInfo(connectionId: string, deviceModel: string, appVersion: string) {
    const agent = this.agents.get(connectionId);
    if (agent) {
      agent.deviceModel = deviceModel;
      agent.appVersion = appVersion;
      agent.lastHeartbeat = new Date();
      console.log(`📱 Agent device specs updated [${connectionId}]: ${deviceModel} (v${appVersion})`);
    }
  }

  updateHeartbeat(connectionId: string) {
    const agent = this.agents.get(connectionId);
    if (agent) {
      agent.lastHeartbeat = new Date();
    }
  }

  unregister(connectionId: string) {
    const agent = this.agents.get(connectionId);
    if (agent) {
      const centerSet = this.centerToAgents.get(agent.centerId);
      if (centerSet) {
        centerSet.delete(connectionId);
        if (centerSet.size === 0) {
          this.centerToAgents.delete(agent.centerId);
        }
      }
      this.agents.delete(connectionId);
      console.log(`👋 Agent disconnected: [${connectionId}] (Center: ${agent.centerId})`);
    }
  }

  /**
   * Dispatches a print job to an active agent registered for the specified center.
   * If spooler is paused (walk-in mode), digital jobs are held in queue.
   */
  dispatchJobToCenter(centerId: string, payload: DispatchedJobPayload): boolean {
    if (this.isSpoolerPaused(centerId)) {
      console.log(`⏸️ Spooler paused (Walk-in Mode) for Center [${centerId}]. Holding OrderItem [${payload.orderItemId}].`);
      return false;
    }

    const connectionIds = this.centerToAgents.get(centerId);
    if (!connectionIds || connectionIds.size === 0) {
      // If no agent for this center, check if there's any active agent at all (for single-center testing)
      if (this.agents.size > 0) {
        const firstAgent = Array.from(this.agents.values())[0];
        console.log(`ℹ️ Center [${centerId}] not directly matched. Routing to active test agent [${firstAgent.centerId}].`);
        return this.sendToAgent(firstAgent, payload);
      }
      return false;
    }

    // Pick first available connection for center
    for (const connId of connectionIds) {
      const agent = this.agents.get(connId);
      if (agent && agent.socket.readyState === WebSocket.OPEN) {
        return this.sendToAgent(agent, payload);
      }
    }

    return false;
  }

  private sendToAgent(agent: ConnectedAgent, payload: DispatchedJobPayload): boolean {
    try {
      const message = JSON.stringify({
        type: 'JOB_DISPATCHED',
        payload,
        timestamp: Date.now(),
      });
      agent.socket.send(message);
      return true;
    } catch (err: any) {
      console.error(`Failed to send job to agent ${agent.connectionId}:`, err.message);
      return false;
    }
  }

  getAllConnectedAgents() {
    return Array.from(this.agents.values()).map((a) => ({
      connectionId: a.connectionId,
      centerId: a.centerId,
      deviceModel: a.deviceModel || 'Unknown',
      appVersion: a.appVersion || 'Unknown',
      connectedAt: a.connectedAt,
      lastHeartbeat: a.lastHeartbeat,
    }));
  }
}

export const agentRegistry = new AgentRegistry();

