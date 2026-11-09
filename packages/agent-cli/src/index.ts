import { WebSocket } from 'ws';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { config } from 'dotenv';

config();

const SERVER_WS_URL = process.env.SERVER_WS_URL || 'ws://localhost:4000/api/v1/agent/socket';
const CENTER_ID = process.env.CENTER_ID || 'CTR-CAMPUS-01';
const AGENT_SECRET = process.env.AGENT_SECRET || 'campus_secret_key_123';
const AUTO_OPEN_FILE = process.env.AUTO_OPEN_FILE !== 'false';

const TEMP_DIR = path.resolve(process.cwd(), 'temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Formatting helpers
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const magenta = (s: string) => `\x1b[35m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

let activeSocket: WebSocket | null = null;
let retryAttempt = 0;
let heartbeatTimer: NodeJS.Timeout | null = null;

function printBanner() {
  console.log(`
${bold(cyan('╔════════════════════════════════════════════════════════════════╗'))}
${bold(cyan('║        CampusPrint Desktop Operator Terminal Agent (CLI)       ║'))}
${bold(cyan('╚════════════════════════════════════════════════════════════════╝'))}
  ${bold('Station ID:')}   ${yellow(CENTER_ID)}
  ${bold('Gateway:')}      ${SERVER_WS_URL}
  ${bold('Host OS:')}      ${os.type()} ${os.release()} (${os.arch()})
  ${bold('Auto-Open:')}    ${AUTO_OPEN_FILE ? green('ENABLED (Instant Print Dialog)') : yellow('DISABLED')}
  ${bold('Spool Cache:')}  ${TEMP_DIR}
------------------------------------------------------------------
`);
}

function connect() {
  const url = `${SERVER_WS_URL}?centerId=${encodeURIComponent(CENTER_ID)}&token=${encodeURIComponent(AGENT_SECRET)}`;
  console.log(`📡 Connecting to print gateway at ${cyan(SERVER_WS_URL)}...`);

  const socket = new WebSocket(url, {
    headers: {
      'X-Center-ID': CENTER_ID,
      'X-Agent-Secret': AGENT_SECRET,
    },
  });

  activeSocket = socket;

  socket.on('open', () => {
    retryAttempt = 0;
    console.log(green(`\n✔ [ONLINE] Handshake established with Gateway for Center [${CENTER_ID}]`));

    // Register terminal specs
    const registerPayload = {
      type: 'DEVICE_REGISTER',
      centerId: CENTER_ID,
      secretToken: AGENT_SECRET,
      deviceModel: `Desktop Workstation (${os.type()} ${os.arch()})`,
      appVersion: '1.0.0-cli',
      timestamp: Date.now(),
    };
    socket.send(JSON.stringify(registerPayload));
    console.log(`📋 Sent hardware specs: ${registerPayload.deviceModel}`);

    // Heartbeat every 30s
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'HEARTBEAT', timestamp: Date.now() }));
      }
    }, 30000);

    console.log(cyan(`\n🎧 Ready and listening for incoming student print dispatches...\n`));
  });

  socket.on('message', async (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'JOB_DISPATCHED') {
        await handleJobDispatched(msg.payload, socket);
      } else if (msg.type === 'REGISTER_ACK') {
        console.log(`ℹ️ Gateway confirmed: ${msg.message}`);
      }
    } catch (err: any) {
      console.error('Error handling message:', err.message);
    }
  });

  socket.on('close', (code, reason) => {
    console.log(yellow(`\n⚠ Connection closed (${code}: ${reason || 'Disconnected'}). Scheduling reconnect...`));
    scheduleReconnect();
  });

  socket.on('error', (err) => {
    console.error(`\n❌ Transport error: ${err.message}`);
  });
}

async function handleJobDispatched(payload: any, socket: WebSocket) {
  const { orderItemId, documentName, totalPages, colorMode, duplexMode, paperSize, copies, downloadUrl } = payload;

  console.log(`
${bold(magenta('┌─────────────────────────────────────────────────────────────────┐'))}
${bold(magenta('│ 📥 NEW PRINT ORDER DISPATCHED                                    │'))}
${bold(magenta('└─────────────────────────────────────────────────────────────────┘'))}
  ${bold('Order Item:')}   #${orderItemId}
  ${bold('Document:')}     ${bold(documentName)} (${totalPages} pages)
  ${bold('Print Specs:')}  ${colorMode} | ${paperSize} | ${duplexMode} | x${copies} copies
  ${bold('Download:')}     ${downloadUrl}
`);

  // Step 1: Download PDF
  process.stdout.write('  1. Downloading document payload to spool cache... ');
  const targetFile = path.join(TEMP_DIR, `job_${orderItemId}.pdf`);

  try {
    const res = await fetch(downloadUrl);
    if (!res.ok) throw new Error(`Download failed with status ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());

    // Validate %PDF- header
    if (buffer.length < 4 || buffer[0] !== 0x25 || buffer[1] !== 0x50 || buffer[2] !== 0x44 || buffer[3] !== 0x46) {
      throw new Error('Downloaded file does not have valid %PDF- magic signature');
    }

    fs.writeFileSync(targetFile, buffer);
    console.log(green(`[OK] (${(buffer.length / 1024).toFixed(1)} KB)`));

    // Step 2: Signal PRINTING status
    socket.send(
      JSON.stringify({
        type: 'JOB_STATUS_UPDATE',
        orderItemId,
        status: 'PRINTING',
        timestamp: Date.now(),
      })
    );
    console.log(`  2. Spooler status: ${cyan('PRINTING')} reported to gateway`);

    // Step 3: Open file or dispatch to OS printer
    if (AUTO_OPEN_FILE) {
      console.log(`  3. Launching system viewer/print dialog for ${targetFile}...`);
      openFileInSystemViewer(targetFile);
    }

    // Step 4: Signal COMPLETED status
    socket.send(
      JSON.stringify({
        type: 'JOB_STATUS_UPDATE',
        orderItemId,
        status: 'COMPLETED',
        timestamp: Date.now(),
      })
    );
    console.log(`  4. Spooler status: ${green('COMPLETED')} reported to gateway ✔\n`);
  } catch (err: any) {
    console.error(`\n  ❌ Error processing print job: ${err.message}`);
    socket.send(
      JSON.stringify({
        type: 'JOB_STATUS_UPDATE',
        orderItemId,
        status: 'FAILED',
        errorMessage: err.message,
        timestamp: Date.now(),
      })
    );
  }
}

function openFileInSystemViewer(filePath: string) {
  const platform = os.platform();
  let cmd = '';

  if (platform === 'win32') {
    cmd = `start "" "${filePath}"`;
  } else if (platform === 'darwin') {
    cmd = `open "${filePath}"`;
  } else {
    cmd = `xdg-open "${filePath}"`;
  }

  exec(cmd, (err) => {
    if (err) {
      console.warn(`  ⚠️  System viewer launch note: ${err.message}`);
    }
  });
}

function scheduleReconnect() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  retryAttempt++;
  const delaySec = Math.min(30, 2 ** Math.min(5, retryAttempt));
  console.log(`⏳ Reconnecting in ${delaySec} seconds (attempt #${retryAttempt})...`);
  setTimeout(connect, delaySec * 1000);
}

// Start
printBanner();
connect();

