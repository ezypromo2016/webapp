/**
 * Cash Drawer Utility - Web Serial API
 * Specifically for USB Triggers like Logicowl OJ-1000
 */

export const CashDrawer = {
  /**
   * Opens the cash drawer by sending a trigger signal to the serial port.
   * Most USB triggers respond to sending a simple character or hex value.
   */
  open: async () => {
    const ua = navigator.userAgent;
    const isAndroid = /Android|Linux/i.test(ua) && !/iPhone|iPad|iPod/i.test(ua);
    
    // We send multiple common trigger codes in sequence: '1\n', BELL (0x07), and ESC p (0x1B 0x70...)
    const codes = [
      new Uint8Array([0x31, 0x0A]), // '1\n'
      new Uint8Array([0x07]),       // BELL
      new Uint8Array([0x1B, 0x70, 0x00, 0x19, 0xFA]), // ESC p 0 25 250
      new Uint8Array([0x1B, 0x70, 0x30, 0x37, 0x79])  // Alternative ESC p
    ];

    const hasSerial = 'serial' in navigator;
    const hasUsb = 'usb' in navigator;
    const hasHid = 'hid' in navigator;

    const triggerBuffer = new Uint8Array(codes.reduce((acc, c) => acc + c.length, 0));
    let offset = 0;
    for (const c of codes) { triggerBuffer.set(c, offset); offset += c.length; }

    try {
      // 0. Try already paired devices first (Silent check)
      if (hasSerial) {
        try {
          const ports = await (navigator as any).serial.getPorts();
          for (const port of ports) {
            try {
              await port.open({ baudRate: 9600 });
              await port.setSignals({ dataTerminalReady: true, requestToSend: true });
              const writer = port.writable.getWriter();
              await writer.write(triggerBuffer);
              writer.releaseLock();
              await new Promise(r => setTimeout(r, 400));
              await port.setSignals({ dataTerminalReady: false, requestToSend: false });
              await port.close();
              return true;
            } catch (err) { /* silent fail */ }
          }
        } catch (e) { console.warn('Paired serial check failed', e); }
      }

      if (hasUsb) {
        try {
          const devices = await (navigator as any).usb.getDevices();
          for (const device of devices) {
            try {
              await device.open();
              if (device.configuration === null) await device.selectConfiguration(1);
              let outEndpoint = null;
              for (const iface of device.configuration.interfaces) {
                for (const alt of iface.alternates) {
                  for (const ep of alt.endpoints) {
                    if (ep.direction === 'out') { outEndpoint = ep.endpointNumber; await device.claimInterface(iface.interfaceNumber); break; }
                  }
                  if (outEndpoint !== null) break;
                }
                if (outEndpoint !== null) break;
              }
              if (outEndpoint !== null) { await (device as any).transferOut(outEndpoint, triggerBuffer); }
              else { await device.controlTransferOut({ requestType: 'vendor', recipient: 'device', request: 0x01, value: 0x01, index: 0x00 }); }
              await new Promise(r => setTimeout(r, 400));
              await device.close();
              return true;
            } catch (err) { /* silent fail */ }
          }
        } catch (e) { console.warn('Paired USB check failed', e); }
      }

      if (hasHid) {
        try {
          const devices = await (navigator as any).hid.getDevices();
          for (const device of devices) {
            try {
              await device.open();
              await device.sendReport(0, triggerBuffer);
              await new Promise(r => setTimeout(r, 400));
              await device.close();
              return true;
            } catch (err) { /* silent fail */ }
          }
        } catch (e) { console.warn('Paired HID check failed', e); }
      }

      // 1. Interactive Prompts
      if (hasSerial) {
        try {
          const port = await (navigator as any).serial.requestPort({
            filters: [
              { usbVendorId: 0x067B }, // Prolific
              { usbVendorId: 0x1A86 }, // CH340
              { usbVendorId: 0x0403 }, // FTDI
              { usbVendorId: 0x10C4 }  // CP210x
            ]
          }).catch(async (err: any) => {
            if (err.name === 'NotFoundError') return await (navigator as any).serial.requestPort();
            throw err;
          });

          await port.open({ baudRate: 9600 });
          await port.setSignals({ dataTerminalReady: true, requestToSend: true });
          const writer = port.writable.getWriter();
          await writer.write(triggerBuffer);
          writer.releaseLock();
          await new Promise(r => setTimeout(r, 400));
          await port.setSignals({ dataTerminalReady: false, requestToSend: false });
          await port.close();
          return true;
        } catch (e: any) {
          if (e.name === 'NotFoundError' || e.name === 'SecurityError') console.warn('Serial skip');
          else throw e;
        }
      }

      if (hasUsb) {
        try {
          const device = await (navigator as any).usb.requestDevice({ filters: [] });
          await device.open();
          if (device.configuration === null) await device.selectConfiguration(1);
          let outEndpoint = null;
          for (const iface of device.configuration.interfaces) {
            for (const alt of iface.alternates) {
              for (const ep of alt.endpoints) {
                if (ep.direction === 'out') { outEndpoint = ep.endpointNumber; await device.claimInterface(iface.interfaceNumber); break; }
              }
              if (outEndpoint !== null) break;
            }
            if (outEndpoint !== null) break;
          }
          if (outEndpoint !== null) { await (device as any).transferOut(outEndpoint, triggerBuffer); }
          else { await device.controlTransferOut({ requestType: 'vendor', recipient: 'device', request: 0x01, value: 0x01, index: 0x00 }); }
          await new Promise(r => setTimeout(r, 400));
          await device.close();
          return true;
        } catch (e: any) {
          if (e.name === 'NotFoundError' || e.name === 'SecurityError') console.warn('USB skip');
          else throw e;
        }
      }

      if (hasHid) {
        try {
          const devices = await (navigator as any).hid.requestDevice({ filters: [] });
          if (devices && devices.length > 0) {
            const device = devices[0];
            await device.open();
            await device.sendReport(0, triggerBuffer);
            await new Promise(r => setTimeout(r, 400));
            await device.close();
            return true;
          }
        } catch (e: any) {
          if (e.name === 'NotFoundError' || e.name === 'SecurityError') console.warn('HID skip');
          else throw e;
        }
      }

      throw new Error('No compatible hardware device found. Try "Hardware Terminal" in Settings to debug.');
    } catch (err: any) {

      if (err.name === 'NotFoundError') return false;
      throw err;
    }
  },

  /**
   * Checks if any hardware API is supported
   */
  isSupported: () => {
    const ua = navigator.userAgent;
    const isAndroid = /Android|Linux/i.test(ua) && !/iPhone|iPad|iPod/i.test(ua);
    return ('serial' in navigator) || ('usb' in navigator) || ('hid' in navigator) || isAndroid;
  }
};
