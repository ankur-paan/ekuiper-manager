/**
 * Industrial Edge Protocol Driver Registry
 * Catalogs 40+ fieldbus, PLC, CNC, power, and IoT drivers supported in edge environments.
 */

export interface IndustrialDriver {
  id: string;
  name: string;
  category: 'PLC & Automation' | 'CNC & Machine Tools' | 'Power & Telecontrol' | 'Building & Utilities' | 'IoT & Protocols';
  port: number | null;
  desc: string;
}

export const INDUSTRIAL_DRIVERS: IndustrialDriver[] = [
  // PLC & Automation
  { id: 'modbus-tcp', name: 'Modbus TCP', category: 'PLC & Automation', port: 502, desc: 'Standard industrial Ethernet Modbus protocol for PLCs, sensors, and meters.' },
  { id: 'modbus-rtu', name: 'Modbus RTU', category: 'PLC & Automation', port: null, desc: 'Serial RS-485 / RS-232 Modbus RTU communication.' },
  { id: 's7comm', name: 'Siemens S7comm', category: 'PLC & Automation', port: 102, desc: 'Proprietary ISO-on-TCP communication with Siemens S7-300, S7-400, S7-1200, and S7-1500.' },
  { id: 's7comm-for-300', name: 'Siemens S7-300 Legacy', category: 'PLC & Automation', port: 102, desc: 'Optimized MPI / ISO-on-TCP communication for S7-200/300 families.' },
  { id: 's5fetch-write', name: 'Siemens S5 Fetch/Write', category: 'PLC & Automation', port: 102, desc: 'Fetch/write communication for legacy Siemens Simatic S5 series PLCs.' },
  { id: 'ethernet-ip', name: 'Allen-Bradley EtherNet/IP', category: 'PLC & Automation', port: 44818, desc: 'Rockwell Automation EtherNet/IP CIP protocol for ControlLogix and CompactLogix.' },
  { id: 'ethernet-ip-1400', name: 'Allen-Bradley MicroLogix 1400', category: 'PLC & Automation', port: 44818, desc: 'Rockwell MicroLogix 1400 / 1100 series specific EtherNet/IP driver.' },
  { id: 'ethernet-ip-5500', name: 'Allen-Bradley PLC-5 / SLC-500', category: 'PLC & Automation', port: 44818, desc: 'Rockwell legacy SLC 500 and PLC-5 via EtherNet/IP.' },
  { id: 'df1', name: 'Allen-Bradley DF1', category: 'PLC & Automation', port: null, desc: 'Rockwell Automation DF1 point-to-point serial communication protocol.' },
  { id: 'omron-cip', name: 'Omron CIP', category: 'PLC & Automation', port: 44818, desc: 'EtherNet/IP CIP for Omron NJ / NX / CJ series controllers.' },
  { id: 'fins-tcp', name: 'Omron FINS TCP', category: 'PLC & Automation', port: 9600, desc: 'Factory Interface Network Service over TCP for Omron CS/CJ/CP series.' },
  { id: 'fins-udp', name: 'Omron FINS UDP', category: 'PLC & Automation', port: 9600, desc: 'FINS over UDP for high-frequency polling on Omron PLCs.' },
  { id: 'hostlink-cmode', name: 'Omron HostLink C-Mode', category: 'PLC & Automation', port: null, desc: 'Serial HostLink protocol for legacy Omron C-series controllers.' },
  { id: 'qna3e', name: 'Mitsubishi MELSEC QnA 3E', category: 'PLC & Automation', port: 5002, desc: 'Mitsubishi MELSEC-Q/L/iQ-R series 3E frame binary/ASCII Ethernet communication.' },
  { id: 'qna4e', name: 'Mitsubishi MELSEC QnA 4E', category: 'PLC & Automation', port: 5002, desc: 'Mitsubishi MELSEC 4E frame communication.' },
  { id: 'a1e', name: 'Mitsubishi MELSEC A1E', category: 'PLC & Automation', port: 5002, desc: 'Mitsubishi A1E frame communication for legacy A-series and FX series.' },
  { id: 'fx', name: 'Mitsubishi MELSEC FX Serial', category: 'PLC & Automation', port: null, desc: 'Direct programming-port communication with Mitsubishi FX1S, FX1N, FX2N, FX3U.' },
  { id: 'ads', name: 'Beckhoff TwinCAT ADS', category: 'PLC & Automation', port: 48898, desc: 'Automation Device Specification for Beckhoff TwinCAT 2 and TwinCAT 3 PLCs.' },
  { id: 'codesys3', name: 'Codesys V3', category: 'PLC & Automation', port: 1200, desc: 'Communication with CODESYS V3 runtime-based PLCs (Wago, Festo, Schneider).' },

  // CNC & Robotics
  { id: 'focas', name: 'FANUC FOCAS 1/2', category: 'CNC & Machine Tools', port: 8193, desc: 'FANUC Open CNC API Specifications for Series 0i, 30i, 31i, 32i, 35i.' },
  { id: 'heidenhain_cnc', name: 'Heidenhain CNC', category: 'CNC & Machine Tools', port: 19000, desc: 'DNC interface for Heidenhain TNC 640, TNC 620, iTNC 530 controllers.' },
  { id: 'kuka', name: 'KUKA Robot Ethernet KRL', category: 'CNC & Machine Tools', port: 7000, desc: 'Ethernet XML / KRL communication with KUKA KR C4 / C5 robot controllers.' },
  { id: 'brother', name: 'Brother CNC-B00', category: 'CNC & Machine Tools', port: 50000, desc: 'Communication protocol for Brother Speedio machining centers.' },
  { id: 'mazak-udp', name: 'Mazak Matrix / Smooth', category: 'CNC & Machine Tools', port: 8000, desc: 'UDP data acquisition for Mazak Mazatrol Matrix and Smooth CNC systems.' },
  { id: 'knd', name: 'KND CNC', category: 'CNC & Machine Tools', port: 8080, desc: 'Ethernet protocol for Chinese KND series CNC machining controllers.' },

  // Power & Energy
  { id: 'iec104-standard', name: 'IEC 60870-5-104', category: 'Power & Telecontrol', port: 2404, desc: 'Telecontrol equipment and systems over TCP/IP for power grid substations.' },
  { id: 'iec101', name: 'IEC 60870-5-101', category: 'Power & Telecontrol', port: null, desc: 'Serial telecontrol protocol for electrical power distribution RTUs.' },
  { id: 'iec102', name: 'IEC 60870-5-102', category: 'Power & Telecontrol', port: null, desc: 'Transmission of integrated totals in electric power systems.' },
  { id: 'iec103', name: 'IEC 60870-5-103', category: 'Power & Telecontrol', port: null, desc: 'Companion standard for the informative interface of protection equipment.' },
  { id: 'iec61850', name: 'IEC 61850 MMS', category: 'Power & Telecontrol', port: 102, desc: 'Communication networks and systems for power utility automation and substations.' },
  { id: 'dnp3', name: 'DNP3 TCP/UDP', category: 'Power & Telecontrol', port: 20000, desc: 'Distributed Network Protocol for water utilities and North American electric power.' },
  { id: 'dlt645-2007', name: 'DL/T 645-2007', category: 'Power & Telecontrol', port: null, desc: 'Multi-function electric energy meter communication protocol.' },
  { id: 'dlt645-1997', name: 'DL/T 645-1997', category: 'Power & Telecontrol', port: null, desc: 'Legacy electric energy meter communication standard.' },

  // Building & Process
  { id: 'bacnet', name: 'BACnet/IP', category: 'Building & Utilities', port: 47808, desc: 'Building Automation and Control networks protocol for HVAC, lighting, and access control.' },
  { id: 'knx', name: 'KNXnet/IP', category: 'Building & Utilities', port: 3671, desc: 'Open standard for commercial and domestic building automation.' },
  { id: 'hj212', name: 'HJ 212-2017', category: 'Building & Utilities', port: 9000, desc: 'Environmental monitoring data transmission standard for emissions and water quality.' },

  // Open & IoT Standards
  { id: 'opcua', name: 'OPC UA Client', category: 'IoT & Protocols', port: 4840, desc: 'Open Platform Communications Unified Architecture industrial interoperability standard.' },
  { id: 'opcua-server', name: 'OPC UA Server', category: 'IoT & Protocols', port: 4840, desc: 'Expose edge tags and stream results as an OPC UA server endpoint.' },
  { id: 'sparkplugb', name: 'MQTT Sparkplug B', category: 'IoT & Protocols', port: 1883, desc: 'Industrial OT-centric MQTT topic and payload specification by Eclipse Foundation.' },
  { id: 'snmp', name: 'SNMP v2c/v3', category: 'IoT & Protocols', port: 161, desc: 'Simple Network Management Protocol for industrial network switches and UPS equipment.' }
];

export const DRIVER_CATEGORIES = Array.from(new Set(INDUSTRIAL_DRIVERS.map((d) => d.category)));

export function getDriverById(id: string): IndustrialDriver | undefined {
  return INDUSTRIAL_DRIVERS.find((d) => d.id === id.toLowerCase().trim());
}
