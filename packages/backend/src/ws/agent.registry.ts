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

class AgentRegistry {
  // Map of connectionId -> ConnectedAgent
  private agents = new Map<string, ConnectedAgent>();

  // Map of centerId -> Set of connectionIds
  private centerToAgents = new Map<string, Set<string>>();

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
   */
  dispatchJobToCenter(centerId: string, payload: DispatchedJobPayload): boolean {
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

