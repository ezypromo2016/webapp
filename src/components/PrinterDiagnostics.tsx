import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal, X, Play, Usb, AlertCircle, RefreshCw, Send, Check, Bluetooth } from 'lucide-react';

export default function PrinterDiagnostics({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean;
  onClose: () => void;
}) {
  const [logs, setLogs] = useState<{time: Date, message: string, type: 'info' | 'error' | 'success'}[]>([]);
  const [device, setDevice] = useState<any>(null);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [customCommand, setCustomCommand] = useState("1B 40 1B 61 01 48 65 6C 6C 6F 20 50 72 69 6E 74 65 72 0A 0A 0A 1D 56 41 00"); // Hello Printer + Cut
  const [customText, setCustomText] = useState("Hello Bluetooth Printer!\n\n\n\n");
  const [selectedEndpoint, setSelectedEndpoint] = useState<number | null>(null);
  const [selectedInterface, setSelectedInterface] = useState<number | null>(null);
  const [connectionType, setConnectionType] = useState<'usb' | 'bluetooth' | 'serial' | null>(null);
  const [btCharacteristic, setBtCharacteristic] = useState<any>(null);

  const addLog = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setLogs(prev => [...prev, { time: new Date(), message, type }]);
  };

  const connectUSB = async () => {
    try {
      if (!('usb' in navigator)) {
        addLog("WebUSB API not supported in this browser.", 'error');
        return;
      }
      
      const newDevice = await (navigator as any).usb.requestDevice({ filters: [] });
      setDevice(newDevice);
      setConnectionType('usb');
      addLog(`Selected USB device: ${newDevice.productName || 'Unknown'} (Vendor: 0x${newDevice.vendorId.toString(16)}, Product: 0x${newDevice.productId.toString(16)})`, 'success');
      
      await newDevice.open();
      addLog("Device opened.", 'success');
      
      const config = newDevice.configuration;
      if (!config) {
        addLog("No configuration found.", 'error');
        return;
      }
      
      let outEndpoint = null;
      let ifaceNum = null;
      
      for (const iface of config.interfaces) {
        for (const alt of iface.alternates) {
          for (const ep of alt.endpoints) {
             if (ep.direction === 'out' && ep.type === 'bulk') {
               outEndpoint = ep.endpointNumber;
               ifaceNum = iface.interfaceNumber;
               addLog(`Found bulk OUT endpoint: ${outEndpoint} on interface: ${ifaceNum}`, 'info');
               break;
             }
          }
          if (outEndpoint) break;
        }
        if (outEndpoint) break;
      }
      
      if (outEndpoint !== null && ifaceNum !== null) {
        setSelectedEndpoint(outEndpoint);
        setSelectedInterface(ifaceNum);
        
        try {
          if (!newDevice.configuration) await newDevice.selectConfiguration(1);
          await newDevice.claimInterface(ifaceNum);
          addLog("Interface claimed successfully. Ready to send commands via USB.", 'success');
        } catch (claimErr: any) {
          addLog(`Interface claim failed: ${claimErr.message}. On Windows, the OS blocks WebUSB from printers by default. You MUST run a tool called 'Zadig', select your printer, and replace its driver with 'WinUSB' to fix this.`, 'error');
        }
      } else {
        addLog("No bulk OUT endpoint found. Printer might not support generic USB printing.", 'error');
      }
      
    } catch (err: any) {
      addLog(`USB Connection error: ${err.message}`, 'error');
      setDevice(null);
      setConnectionType(null);
    }
  };

  const connectBluetooth = async () => {
    try {
      if (!('bluetooth' in navigator)) {
        addLog("Web Bluetooth API not supported in this browser.", 'error');
        return;
      }

      addLog("Requesting Bluetooth device...", 'info');
      const btDevice = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', '49535343-fe7d-4ae5-8fa9-9fafd205e455'] // Common thermal printer GATT services
      });
      
      setDevice(btDevice);
      setConnectionType('bluetooth');
      addLog(`Selected Bluetooth device: ${btDevice.name || btDevice.id}`, 'success');

      btDevice.addEventListener('gattserverdisconnected', () => {
         addLog(`Bluetooth device ${btDevice.name} disconnected.`, 'error');
         setDevice(null);
         setConnectionType(null);
         setBtCharacteristic(null);
      });

      addLog("Connecting to GATT Server...", 'info');
      const server = await btDevice.gatt.connect();
      addLog("GATT Server connected.", 'success');

      addLog("Discovering services...", 'info');
      const services = await server.getPrimaryServices();
      addLog(`Found ${services.length} services. Searching for writable characteristic...`, 'info');

      let targetChar = null;
      for (const service of services) {
        addLog(`Checking service: ${service.uuid}`, 'info');
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          addLog(`  Characteristic: ${char.uuid} (Write: ${char.properties.write ? 'Yes' : 'No'}, WriteWithoutResponse: ${char.properties.writeWithoutResponse ? 'Yes' : 'No'})`, 'info');
          if (char.properties.write || char.properties.writeWithoutResponse) {
            targetChar = char;
            break;
          }
        }
        if (targetChar) break;
      }

      if (targetChar) {
        setBtCharacteristic(targetChar);
        addLog(`Ready to send commands via Bluetooth Characteristic: ${targetChar.uuid}`, 'success');
      } else {
        addLog("Could not find any writable Bluetooth characteristic. This device might not accept raw ESC/POS via Bluetooth.", 'error');
      }

    } catch (err: any) {
      addLog(`Bluetooth Connection error: ${err.message}`, 'error');
      setDevice(null);
      setConnectionType(null);
      setBtCharacteristic(null);
    }
  };

  const connectSerial = async () => {
    try {
      if (!('serial' in navigator)) {
        addLog("Web Serial API not supported in this browser.", 'error');
        return;
      }

      addLog("Requesting Serial port...", 'info');
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      setDevice(port);
      setConnectionType('serial');
      addLog(`Selected Serial port`, 'success');
    } catch (err: any) {
      addLog(`Serial Connection error: ${err.message}`, 'error');
      setDevice(null);
      setConnectionType(null);
    }
  };

  const rescanSerialPorts = async () => {
    addLog("Clearing cached serial ports...", 'info');
    await disconnectDevice();
    try {
      if (!('serial' in navigator)) throw new Error("Serial not supported");
      const ports = await (navigator as any).serial.getPorts();
      for (const p of ports) {
         if (p.forget) {
           await p.forget();
         }
      }
      addLog("Cached ports cleared. Re-requesting...", 'info');
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      setDevice(port);
      setConnectionType('serial');
      addLog(`Serial Port re-connected successfully.`, 'success');
    } catch (err: any) {
      addLog(`Re-scan error: ${err.message}`, 'error');
      setDevice(null);
      setConnectionType(null);
    }
  };

  const disconnectDevice = async () => {
    if (device) {
      if (connectionType === 'usb') {
        try {
          if (selectedInterface !== null) {
              await device.releaseInterface(selectedInterface).catch(() => {});
          }
          await device.close().catch(() => {});
          addLog("USB Device disconnected.", 'info');
        } catch(e) {}
      } else if (connectionType === 'bluetooth') {
        try {
          if (device.gatt && device.gatt.connected) {
             await device.gatt.disconnect();
          }
          addLog("Bluetooth Device disconnected.", 'info');
        } catch(e) {}
      } else if (connectionType === 'serial') {
        try {
          await device.close().catch(() => {});
          addLog("Serial Device disconnected.", 'info');
        } catch(e) {}
      }
      setDevice(null);
      setSelectedEndpoint(null);
      setSelectedInterface(null);
      setConnectionType(null);
      setBtCharacteristic(null);
    }
  };

  const parseHexToBuffer = (hexStr: string) => {
    const cleanHex = hexStr.replace(/\s+/g, '');
    const bytes = [];
    for (let c = 0; c < cleanHex.length; c += 2) {
      bytes.push(parseInt(cleanHex.substring(c, c + 2), 16));
    }
    return new Uint8Array(bytes);
  };

  const sendCommand = async (buffer: Uint8Array, label: string) => {
    if (!device) {
      addLog("Device not connected.", 'error');
      return;
    }
    
    setIsTestRunning(true);
    addLog(`Sending ${label}...`, 'info');
    
    try {
      if (connectionType === 'usb') {
        if (!device.opened) {
          addLog("USB Device not opened.", 'error');
          return;
        }
        if (selectedEndpoint === null) {
          addLog("USB Endpoint not found.", 'error');
          return;
        }
        const result = await device.transferOut(selectedEndpoint, buffer);
        addLog(`USB Data sent. Status: ${result.status}, Bytes: ${result.bytesWritten}`, result.status === 'ok' ? 'success' : 'error');
      } else if (connectionType === 'bluetooth') {
        if (!btCharacteristic) {
           addLog("Bluetooth Characteristic not found.", 'error');
           return;
        }
        
        const chunkSize = 20;
        let bytesSent = 0;
        for (let i = 0; i < buffer.length; i += chunkSize) {
          const chunk = buffer.slice(i, i + chunkSize);
          if ('writeValueWithoutResponse' in btCharacteristic && btCharacteristic.properties.writeWithoutResponse) {
             await btCharacteristic.writeValueWithoutResponse(chunk);
          } else if ('writeValueWithResponse' in btCharacteristic && btCharacteristic.properties.write) {
             await btCharacteristic.writeValueWithResponse(chunk);
          } else {
             await btCharacteristic.writeValue(chunk);
          }
          bytesSent += chunk.length;
          await new Promise(r => setTimeout(r, 20)); // delay 20ms to prevent buffer overflow
        }
        addLog(`Bluetooth Data sent. Bytes: ${bytesSent}`, 'success');
      } else if (connectionType === 'serial') {
        if (!device.writable) {
           addLog("Serial Port is not writable.", 'error');
           return;
        }
        const writer = device.writable.getWriter();
        try {
           await writer.write(buffer);
        } finally {
           writer.releaseLock();
        }
        addLog(`Serial Data sent. Bytes: ${buffer.length}`, 'success');
      }
    } catch (err: any) {
      if (err.message?.includes("Access denied") || err.message?.includes("protected class")) {
         addLog(`Transfer error: ${err.message}. Your OS is blocking WebUSB from accessing this printer. On Windows, you MUST use 'Zadig' to replace the printer driver with 'WinUSB' for WebUSB to work.`, 'error');
      } else {
         addLog(`Transfer error: ${err.message}`, 'error');
      }
    } finally {
      setIsTestRunning(false);
    }
  };

  const sendCustom = () => {
    try {
      const buffer = parseHexToBuffer(customCommand);
      sendCommand(buffer, `Custom Hex (${buffer.length} bytes)`);
    } catch(err: any) {
      addLog(`Invalid Hex string: ${err.message}`, 'error');
    }
  };

  const sendCustomText = () => {
    try {
      const ESC = 0x1B;
      const initCommand = [ESC, 0x40];
      const textBytes = customText.split('').map(c => c.charCodeAt(0));
      const buffer = new Uint8Array([...initCommand, ...textBytes]);
      sendCommand(buffer, `Custom Text`);
    } catch(err: any) {
      addLog(`Error parsing text: ${err.message}`, 'error');
    }
  };

  const runBasicTest = () => {
    // Basic test: Init, Text, Feed lines
    const ESC = 0x1B;
    const buf = new Uint8Array([
      ESC, 0x40, // Init
      ...Array.from("Test Print OK\n\n\n\n").map(c => c.charCodeAt(0))
    ]);
    sendCommand(buf, "Basic Test String");
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-10 bg-slate-900/40 backdrop-blur-sm"
      >
        <motion.div 
          initial={{ y: 20, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-[#111218] rounded-[2rem] shadow-2xl w-full max-w-4xl flex flex-col h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 lg:p-8 border-b border-slate-200 dark:border-white/5 shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-[1.25rem] bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
                <Terminal className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Printing Diagnostics</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Raw ESC/POS WebUSB Terminal</p>
              </div>
            </div>
            <button 
              onClick={() => { disconnectDevice(); onClose(); }}
              className="p-3 bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-500 rounded-2xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-50 dark:bg-[#0a0a0f]">
            {/* Left Control Panel */}
            <div className="w-full lg:w-[400px] flex flex-col border-r border-slate-200 dark:border-white/5 overflow-y-auto">
              <div className="p-6 space-y-8">
                {/* Connection Box */}
                <div>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <Usb className="w-4 h-4" /> 1. Connect Printer
                  </h3>
                  {!device ? (
                    <div className="flex flex-col gap-2">
                       <div className="flex gap-2">
                          <button 
                            onClick={connectUSB}
                            className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white h-12 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-colors"
                          >
                            <Usb className="w-4 h-4" /> USB
                          </button>
                          <button 
                            onClick={connectBluetooth}
                            className="flex-1 flex items-center justify-center gap-2 bg-sky-500 text-white h-12 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-sky-500/20 hover:bg-sky-400 transition-colors"
                          >
                            <Bluetooth className="w-4 h-4" /> Bluetooth
                          </button>
                       </div>
                       <div className="flex gap-2">
                          <button 
                            onClick={connectSerial}
                            className="flex-1 flex items-center justify-center gap-2 bg-slate-600 text-white h-12 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-slate-600/20 hover:bg-slate-500 transition-colors"
                          >
                            <Terminal className="w-4 h-4" /> Serial (COM)
                          </button>
                          <button 
                            onClick={rescanSerialPorts}
                            className="flex-1 flex items-center justify-center gap-2 bg-rose-500 text-white h-12 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-500/20 hover:bg-rose-400 transition-colors"
                          >
                            <RefreshCw className="w-4 h-4" /> Re-scan Ports
                          </button>
                       </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between">
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-600">
                           <Check className="w-4 h-4" />
                         </div>
                         <div>
                           <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Connected ({connectionType})</p>
                           <p className="text-[9px] font-bold text-slate-500 truncate w-32">{device.productName || device.name || 'Unknown'}</p>
                         </div>
                       </div>
                       <button onClick={disconnectDevice} className="px-3 py-1.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-lg text-[9px] font-black uppercase text-rose-500 hover:bg-rose-50 transition-colors">Disconnect</button>
                    </div>
                  )}
                </div>

                <div className="h-px bg-slate-200 dark:bg-white/5 w-full" />

                {/* Tests Box */}
                <div className={`transition-opacity ${!device ? 'opacity-50 pointer-events-none' : ''}`}>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <Play className="w-4 h-4" /> 2. Run Tests
                  </h3>
                  
                  <div className="space-y-4">
                     <button
                        onClick={runBasicTest}
                        disabled={isTestRunning}
                        className="w-full flex items-center justify-center gap-2 bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-white h-12 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-300 dark:hover:bg-white/20 transition-colors disabled:opacity-50"
                     >
                        Run Basic Print Test
                     </button>
                     
                     <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-white/5">
                       <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-1">Custom Text (ASCII)</label>
                       <textarea 
                         value={customText}
                         onChange={e => setCustomText(e.target.value)}
                         className="w-full h-20 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-xs font-mono text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                       />
                       <button
                          onClick={sendCustomText}
                          disabled={isTestRunning}
                          className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white h-12 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 transition-colors disabled:opacity-50"
                       >
                          <Send className="w-4 h-4" /> Send Text
                       </button>
                     </div>

                     <div className="space-y-2 pt-4 border-t border-slate-200 dark:border-white/5">
                       <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-1">Custom HEX ESC/POS</label>
                       <textarea 
                         value={customCommand}
                         onChange={e => setCustomCommand(e.target.value)}
                         className="w-full h-24 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-3 text-xs font-mono text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                       />
                       <button
                          onClick={sendCustom}
                          disabled={isTestRunning}
                          className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white h-12 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-colors disabled:opacity-50"
                       >
                          <Send className="w-4 h-4" /> Send Hex
                       </button>
                     </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Log Panel */}
            <div className="flex-1 flex flex-col relative bg-[#1e1e24] dark:bg-black/40 border-l border-slate-200 dark:border-transparent">
               <div className="absolute top-0 w-full p-4 flex items-center justify-between bg-gradient-to-b from-[#1e1e24]/90 to-transparent z-10">
                 <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-2">
                   <Terminal className="w-3.5 h-3.5" /> Output Terminal
                 </span>
                 <button 
                  onClick={() => setLogs([])}
                  className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors flex items-center gap-1.5"
                 >
                   <RefreshCw className="w-3 h-3" /> Clear
                 </button>
               </div>
               
               <div className="flex-1 p-6 pt-16 overflow-y-auto space-y-2 font-mono text-[11px] selection:bg-indigo-500/30">
                  {logs.length === 0 && (
                    <div className="text-slate-500 text-center mt-10">Waiting for activity...</div>
                  )}
                  {logs.map((log, i) => (
                    <div key={i} className="flex gap-4">
                      <span className="text-slate-500 shrink-0 select-none">
                        [{log.time.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })}]
                      </span>
                      <span className={`
                        ${log.type === 'error' ? 'text-rose-400 font-medium' : ''}
                        ${log.type === 'success' ? 'text-emerald-400 font-medium' : ''}
                        ${log.type === 'info' ? 'text-slate-300' : ''}
                        break-all whitespace-pre-wrap
                      `}>
                        {log.message}
                      </span>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
