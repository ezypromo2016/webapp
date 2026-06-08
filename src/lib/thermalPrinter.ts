export const ThermalPrinter = {
  printReceipt: async (txn: any, businessInfo: any, type: "usb" | "serial" | "bluetooth" = "usb", preAuthorizedDevice?: any) => {
    const ESC = 0x1B;
    const GS = 0x1D;

    const commands: number[] = [];

    // init
    commands.push(ESC, 0x40);

    const addText = (text: string) => {
      for (let i = 0; i < text.length; i++) {
        commands.push(text.charCodeAt(i));
      }
    };

    const addLine = () => addText("--------------------------------\n");
    const addCenter = () => commands.push(ESC, 0x61, 1);
    const addLeft = () => commands.push(ESC, 0x61, 0);
    const addRight = () => commands.push(ESC, 0x61, 2);
    const addBoldOn = () => commands.push(ESC, 0x45, 1);
    const addBoldOff = () => commands.push(ESC, 0x45, 0);

    const padRight = (str: string, len: number) => {
      if (str.length > len) return str.substring(0, len);
      return str + ' '.repeat(len - str.length);
    };
    
    const padLeft = (str: string, len: number) => {
      if (str.length > len) return str.substring(0, len);
      return ' '.repeat(len - str.length) + str;
    };

    // --- Header ---
    addCenter();
    addBoldOn();
    addText((businessInfo?.name || "CBK Apparel & School Supplies") + "\n");
    addBoldOff();
    addText((businessInfo?.address || "Davao de Oro, Philippines") + "\n");
    addText("TEL: " + (businessInfo?.phone || "09912091886") + "\n");
    addLine();

    // --- Meta ---
    addBoldOn();
    addText((txn.title || "POS RECEIPT") + "\n");
    addBoldOff();
    addText("REF: " + txn.transactionNumber + "\n");
    
    const date = new Date(txn.createdAt || Date.now());
    addText("DATE: " + date.toLocaleDateString() + " " + date.toLocaleTimeString() + "\n");
    addText("CUST: " + (txn.customer?.name || "WALK-IN") + "\n");
    addLine();

    // --- Items ---
    addLeft();
    addBoldOn();
    addText("QTY DESC" + " ".repeat(14) + "AMT\n");
    addBoldOff();
    
    (txn.items || []).forEach((item: any) => {
      const qty = padRight(String(item.qty), 3);
      const name = padRight(item.name, 19);
      const amtStr = (item.qty * item.price).toFixed(2);
      const amt = padLeft(amtStr, 8);
      
      addText(`${qty} ${name} ${amt}\n`);
    });
    addLine();

    // --- Totals ---
    addRight();
    addText("TOTAL: " + Number(txn.total).toFixed(2) + " PHP\n");
    addText("METHOD: " + (txn.paymentMethod || "CASH").toUpperCase() + "\n");
    if ((txn.paymentMethod || "cash").toLowerCase() === "cash" && txn.cashTendered !== undefined) {
      addText("TENDERED: " + Number(txn.cashTendered).toFixed(2) + " PHP\n");
      addText("CHANGE: " + Number(txn.change || 0).toFixed(2) + " PHP\n");
    }
    if (txn.total_loaned) addText("LOANED: " + Number(txn.total_loaned).toFixed(2) + " PHP\n");
    if (txn.total_paid) addText("PAID: " + Number(txn.total_paid).toFixed(2) + " PHP\n");
    
    addCenter();
    addLine();
    addText("THANK YOU FOR CHOOSING US\n");
    addText("PLEASE COME AGAIN\n");
    addText("\n\n\n\n"); // feed paper
    
    commands.push(GS, 0x56, 0x41, 0x00);

    const triggerBuffer = new Uint8Array(commands);

    if (type === "bluetooth" && 'bluetooth' in navigator) {
      try {
        const device = await (navigator as any).bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', '49535343-fe7d-4ae5-8fa9-9fafd205e455']
        });
        await device.gatt.connect();
        
        let targetCharacteristic = null;
        const services = await device.gatt.getPrimaryServices();
        for (const service of services) {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              targetCharacteristic = char;
              break;
            }
          }
          if (targetCharacteristic) break;
        }

        if (!targetCharacteristic) {
           await device.gatt.disconnect();
           return { success: false, error: "No writable Bluetooth characteristic found on device." };
        }

        // Write in small chunks (e.g. 20 bytes) for strict BLE limits
        const chunkSize = 20;
        for (let i = 0; i < triggerBuffer.length; i += chunkSize) {
          const chunk = triggerBuffer.slice(i, i + chunkSize);
          if ('writeValueWithoutResponse' in targetCharacteristic && targetCharacteristic.properties.writeWithoutResponse) {
             await targetCharacteristic.writeValueWithoutResponse(chunk);
          } else if ('writeValueWithResponse' in targetCharacteristic && targetCharacteristic.properties.write) {
             await targetCharacteristic.writeValueWithResponse(chunk);
          } else {
             await targetCharacteristic.writeValue(chunk);
          }
          // Small delay to prevent printer buffer overflow
          await new Promise(r => setTimeout(r, 20));
        }

        await device.gatt.disconnect();
        return { success: true };
      } catch (e: any) {
        return { success: false, error: e.message || "Bluetooth print failed." };
      }
    }

    if (type === "serial" && 'serial' in navigator) {
      try {
        const port = await (navigator as any).serial.requestPort();
        await port.open({ baudRate: 9600 });
        const writer = port.writable.getWriter();
        await writer.write(triggerBuffer);
        writer.releaseLock();
        await port.close();
        return { success: true };
      } catch (e: any) {
        // Suppress console.error for expected OS blocks
        return { success: false, error: e.message || "Printer connection cancelled or failed." };
      }
    }

    if (type === "usb" && 'usb' in navigator) {
      try {
        const device = preAuthorizedDevice || await (navigator as any).usb.requestDevice({ filters: [] });
        if (!device.opened) {
          await device.open();
        }
        if (device.configuration === null) await device.selectConfiguration(1);
        let outEndpoint = null;
        let claimedInterface = null;
        for (const iface of device.configuration.interfaces) {
          for (const alt of iface.alternates) {
            for (const ep of alt.endpoints) {
              if (ep.direction === 'out') { 
                outEndpoint = ep.endpointNumber;
                claimedInterface = iface.interfaceNumber;
                try {
                  await device.claimInterface(iface.interfaceNumber); 
                } catch(err) {
                  console.warn("Interface claim ignored or already claimed", err);
                }
                break; 
              }
            }
            if (outEndpoint !== null) break;
          }
          if (outEndpoint !== null) break;
        }
        if (outEndpoint !== null) { 
          await (device as any).transferOut(outEndpoint, triggerBuffer); 
        }
        else { 
          await device.controlTransferOut({ requestType: 'vendor', recipient: 'device', request: 0x01, value: 0x01, index: 0x00 }); 
        }
        
        if (claimedInterface !== null) {
           await device.releaseInterface(claimedInterface).catch(() => {});
        }
        await device.close().catch(() => {});
        return { success: true };
      } catch (e: any) {
        // Suppress console.error for expected OS blocks (access denied, protected class) to avoid false bug reports.
        const errorMessage = e.message || "Unknown error";
        if (errorMessage.includes("Access denied") || errorMessage.includes("protected")) {
           return { success: false, error: `${errorMessage}\n\nNOTE FOR WINDOWS USERS: Your OS blocks direct USB access to printers. To use raw USB printing, you must download a free tool called 'Zadig', select your printer, and install the 'WinUSB' driver.` };
        }
        return { success: false, error: "Printer connection failed: " + errorMessage };
      }
    }

    return { success: false, error: "Printer type not supported by browser." };
  }
};
