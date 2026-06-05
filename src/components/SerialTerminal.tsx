import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Cpu, Zap, X, Trash2, Send, Power, Search } from 'lucide-react';
import { CashDrawer } from '../lib/cashDrawer';

export default function SerialTerminal() {
  const [port, setPort] = useState<any>(null);
  const [reader, setReader] = useState<any>(null);
  const [logs, setLogs] = useState<{ type: 'in' | 'out' | 'info' | 'error', text: string, time: string }[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [baudRate, setBaudRate] = useState(9600);
  const [hardwareStatus, setHardwareStatus] = useState<{ serial: boolean, usb: boolean, hid: boolean }>({
    serial: 'serial' in navigator,
    usb: 'usb' in navigator,
    hid: 'hid' in navigator
  });
  const logAreaRef = useRef<HTMLDivElement>(null);

  const addLog = (text: string, type: 'in' | 'out' | 'info' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    setLogs(prev => [...prev.slice(-99), { type, text, time }]);
  };

  const checkPaired = async () => {
    if (!hardwareStatus.serial) return;
    try {
      const ports = await (navigator as any).serial.getPorts();
      if (ports.length > 0) {
        addLog(`System found ${ports.length} already paired serial port(s).`, 'info');
      } else {
        addLog('No already paired serial ports found. Click "Scan" to pair a new one.', 'info');
      }
    } catch (err: any) {
      addLog(`Paired check failed: ${err.message}`, 'error');
    }
  };

  useEffect(() => {
    checkPaired();
  }, []);

  useEffect(() => {
    if (logAreaRef.current) {
      logAreaRef.current.scrollTop = logAreaRef.current.scrollHeight;
    }
  }, [logs]);

  const connect = async () => {
    if (!hardwareStatus.serial) {
      addLog('Web Serial API is not supported. Use Chrome or Edge on Desktop.', 'error');
      return;
    }

    addLog('Opening browser device picker...', 'info');
    try {
      // Chrome sometimes requires a user gesture to be extremely "fresh"
      const p = await (navigator as any).serial.requestPort();
      addLog('Device selected, opening port...', 'info');
      
      await p.open({ baudRate });
      setPort(p);
      setConnected(true);
      addLog(`SUCCESS: Connected at ${baudRate} baud`, 'info');

      readLoop(p);
    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        addLog('No device was selected or found in the list.', 'error');
      } else if (err.name === 'SecurityError') {
        addLog('Hardware access blocked by browser security/permissions.', 'error');
      } else {
        addLog(`Connection failed: ${err.message}`, 'error');
      }
      console.error(err);
    }
  };

  const disconnect = async () => {
    if (reader) {
      await reader.cancel();
    }
    if (port) {
      await port.close();
    }
    setPort(null);
    setReader(null);
    setConnected(false);
    addLog('Disconnected', 'info');
  };

  const readLoop = async (p: any) => {
    while (p.readable && !p.readable.locked) {
      const r = p.readable.getReader();
      setReader(r);
      try {
        while (true) {
          const { value, done } = await r.read();
          if (done) break;
          const text = new TextDecoder().decode(value);
          addLog(text, 'in');
        }
      } catch (err: any) {
        addLog(`Read error: ${err.message}`, 'error');
      } finally {
        r.releaseLock();
        setReader(null);
      }
    }
  };

  const sendData = async () => {
    if (!port || !input) return;
    try {
      const writer = port.writable.getWriter();
      const data = new TextEncoder().encode(input + '\n');
      await writer.write(data);
      writer.releaseLock();
      addLog(input, 'out');
      setInput('');
    } catch (err: any) {
      addLog(`Send error: ${err.message}`, 'error');
    }
  };

  const clearLogs = () => setLogs([]);

  const connectUsb = async () => {
    if (!hardwareStatus.usb) {
      addLog('Web USB API is not supported.', 'error');
      return;
    }

    addLog('Opening USB device picker...', 'info');
    try {
      const device = await (navigator as any).usb.requestDevice({ filters: [] });
      addLog(`USB Device Selected: ${device.productName || 'Unknown Device'}`, 'info');
      addLog(`Vendor ID: ${device.vendorId}, Product ID: ${device.productId}`, 'info');
      addLog('Note: This terminal is optimized for Serial. High-level USB communication requires specific driver logic.', 'info');
    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        addLog('No USB device was selected.', 'error');
      } else {
        addLog(`USB Error: ${err.message}`, 'error');
      }
    }
  };

  const connectHid = async () => {
    if (!hardwareStatus.hid) {
      addLog('Web HID API is not supported.', 'error');
      return;
    }

    addLog('Opening HID device picker...', 'info');
    try {
      const devices = await (navigator as any).hid.requestDevice({ filters: [] });
      if (devices && devices.length > 0) {
        const device = devices[0];
        addLog(`HID Device Selected: ${device.productName || 'Unknown Device'}`, 'info');
        addLog(`Vendor ID: ${device.vendorId}, Product ID: ${device.productId}`, 'info');
      } else {
        addLog('No HID device selected.', 'info');
      }
    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        addLog('No HID device was selected.', 'error');
      } else {
        addLog(`HID Error: ${err.message}`, 'error');
      }
    }
  };

  const testDrawerTrigger = async () => {
    addLog('Attempting Cash Drawer Trigger...', 'info');
    try {
      const success = await CashDrawer.open();
      if (success) {
        addLog('Trigger signal SENT successfully.', 'info');
      } else {
        addLog('Trigger failed: No device selected or cancelled.', 'error');
      }
    } catch (err: any) {
      addLog(`Trigger Error: ${err.message}`, 'error');
    }
  };

  return (
    <div className="bg-[#15161d] border border-white/5 rounded-2xl overflow-hidden shadow-xl dark:bg-[#15161d] dark:border-white/5 font-sans mt-6">
      <div className="p-5 border-b border-white/5 bg-[#1c1d26]/50 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between dark:bg-[#1c1d26]/50 dark:border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-[10px] font-black text-white uppercase tracking-widest">Hardware Debug Terminal</h2>
            <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Test USB-Serial & Direct USB Triggers</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-lg border border-white/5">
            <div className={`w-1.5 h-1.5 rounded-full ${hardwareStatus.serial ? 'bg-emerald-400' : 'bg-rose-500'}`} />
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Serial</span>
          </div>
          
          <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-lg border border-white/5">
            <div className={`w-1.5 h-1.5 rounded-full ${hardwareStatus.hid ? 'bg-emerald-400' : 'bg-rose-500'}`} />
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">HID</span>
          </div>

          {!connected ? (
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={connect}
                className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
              >
                <Search className="w-3.5 h-3.5" />
                Scan Serial
              </button>
              <button 
                onClick={connectUsb}
                className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95"
              >
                <Cpu className="w-3.5 h-3.5" />
                Scan USB
              </button>
              <button 
                onClick={connectHid}
                className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95"
              >
                <Zap className="w-3.5 h-3.5" />
                Scan HID
              </button>
              <button 
                onClick={testDrawerTrigger}
                className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-white border border-amber-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95"
              >
                <Power className="w-3.5 h-3.5" />
                Trigger
              </button>
            </div>
          ) : (
            <button 
              onClick={disconnect}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600/10 text-rose-500 border border-rose-500/20 hover:bg-rose-600 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95"
            >
              <Power className="w-3.5 h-3.5" />
              Disconnect
            </button>
          )}
        </div>
      </div>

      <div className="p-6">
        <div className="flex flex-col h-80 bg-[#0a0a0f] rounded-xl border border-white/5 overflow-hidden">
          {/* Baud Rate selector when disconnected */}
          {!connected && (
            <div className="p-4 border-b border-white/5 flex items-center gap-4 bg-white/5">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Baud Rate:</span>
              <select 
                value={baudRate}
                onChange={(e) => setBaudRate(parseInt(e.target.value))}
                className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-bold text-white focus:outline-none focus:border-indigo-500/50"
              >
                {[1200, 2400, 4800, 9600, 14400, 19200, 38400, 57600, 115200].map(rate => (
                  <option key={rate} value={rate}>{rate}</option>
                ))}
              </select>
            </div>
          )}

          {/* Log Area */}
          <div ref={logAreaRef} className="flex-1 overflow-y-auto p-4 font-mono text-[10px] space-y-1">
            {logs.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center opacity-30 text-slate-500 gap-2">
                <Cpu className="w-8 h-8" />
                <p className="uppercase font-black tracking-widest">Terminal Idle</p>
              </div>
            )}
            {logs.map((log, i) => (
              <div key={i} className={`flex gap-3 leading-relaxed ${
                log.type === 'in' ? 'text-emerald-400' : 
                log.type === 'out' ? 'text-blue-400' : 
                log.type === 'error' ? 'text-rose-400' : 'text-slate-500'
              }`}>
                <span className="opacity-40 shrink-0">[{log.time}]</span>
                <span className="shrink-0 font-black uppercase tracking-tighter">
                  {log.type === 'in' ? '>>>' : log.type === 'out' ? '<<<' : '!!!'}
                </span>
                <span className="break-all">{log.text}</span>
              </div>
            ))}
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white/5 border-t border-white/5 flex gap-3">
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendData()}
              placeholder={connected ? "Type command..." : "Connect first to send commands"}
              disabled={!connected}
              className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all disabled:opacity-50"
            />
            <button 
              onClick={sendData}
              disabled={!connected || !input}
              className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-all active:scale-95 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
            <button 
              onClick={clearLogs}
              className="p-2.5 bg-white/5 text-slate-500 rounded-xl hover:bg-white/10 transition-all active:scale-95"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col md:flex-row gap-4">
          <div className="flex-1 p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
              <h3 className="text-[9px] font-black text-white uppercase tracking-widest">Troubleshooting</h3>
            </div>
            <div className="space-y-2">
              <p className="text-[8px] text-slate-400 leading-relaxed uppercase tracking-wider">
                1. If "No compatible devices found": The OS may not have Serial Drivers (CH340/FTDI/PL2303).
              </p>
              <p className="text-[8px] text-slate-400 leading-relaxed uppercase tracking-wider">
                2. Try "Scan USB" to see if the system sees it as a raw USB device.
              </p>
              <p className="text-[8px] text-slate-400 leading-relaxed uppercase tracking-wider">
                3. Ensure no other apps (like a Serial Monitor) are using the device.
              </p>
            </div>
          </div>
          
          <div className="w-full md:w-64 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">DSR / DTR State</p>
              <div className={`text-[10px] font-black uppercase ${connected ? 'text-emerald-400' : 'text-slate-600'}`}>
                {connected ? 'ACTIVE' : 'INACTIVE'}
              </div>
            </div>
            <div className={`w-3 h-3 rounded-full ${connected ? 'bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.5)]' : 'bg-slate-800'}`} />
          </div>
        </div>
      </div>
    </div>
  );
}
