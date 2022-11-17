/*
 * Copyright (c) [2022] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import { securityFromFlags, mergeConnectionSettings, NetworkManagerAdapter } from "./network_manager";
import { createConnection } from "./model";
import { ConnectionState, ConnectionTypes } from "./index";
import { DBusClient } from "../dbus";
import cockpit from "../../lib/cockpit";

const NM_IFACE = "org.freedesktop.NetworkManager";
const NM_SETTINGS_IFACE = "org.freedesktop.NetworkManager.Settings";
const IP4CONFIG_IFACE = "org.freedesktop.NetworkManager.IP4Config";
const NM_CONNECTION_IFACE = "org.freedesktop.NetworkManager.Settings.Connection";
const ACTIVE_CONNECTION_IFACE = "org.freedesktop.NetworkManager.Connection.Active";
const ACCESS_POINT_IFACE = "org.freedesktop.NetworkManager.AccessPoint";

const dbusClient = new DBusClient("");

const accessPoints = {
  "/org/freedesktop/NetworkManager/AccessPoint/11" : {
    Flags: 3,
    WpaFlags: 0,
    RsnFlags: 392,
    Ssid: "VGVzdGluZw==",
    Frequency: 2432,
    HwAddress: "00:31:92:25:84:FA",
    Mode: 2,
    MaxBitrate: 270000,
    Strength: 76,
    LastSeen: 96711
  }
};

const activeConnections = {
  "/active/connection/wifi/1": {
    Id: "active-wifi-connection",
    Uuid: "uuid-wifi-1",
    State: ConnectionState.ACTIVATED,
    Type: ConnectionTypes.WIFI,
    Ip4Config: "/ip4Config/2"
  },
  "/active/connection/wired/1": {
    Id: "active-wired-connection",
    Uuid: "uuid-wired-1",
    State: ConnectionState.ACTIVATED,
    Type: ConnectionTypes.ETHERNET,
    Ip4Config: "/ip4Config/1"
  },
};

const connections = {
  "/org/freedesktop/NetworkManager/Settings/1": {
    wait: jest.fn(),
    path: "/org/freedesktop/NetworkManager/Settings/1",
    GetSettings: () => ({
      connection: {
        id: cockpit.variant("s", "Testing"),
        uuid: cockpit.variant("s", "1f40ddb0-e6e8-4af8-8b7a-0b3898f0f57a"),
        type: cockpit.variant("s", "802-11-wireless")
      },
      ipv4: {
        addresses: [],
        "address-data": cockpit.variant("aa{sv}", []),
        method: cockpit.variant("s", "auto"),
        dns: cockpit.variant("au", []),
        "route-data": []
      },
      "802-11-wireless": {
        ssid: cockpit.variant("ay", cockpit.byte_array("Testing")),
        hidden: cockpit.variant("b", true),
        mode: cockpit.variant("s", "infrastructure")
      },
      "802-11-wireless-security": {
        "key-mgmt": cockpit.variant("s", "wpa-psk")
      }
    })
  }
};

Object.defineProperties(activeConnections, {
  addEventListener: { value: jest.fn(), enumerable: false }
});

Object.defineProperties(connections, {
  addEventListener: { value: jest.fn(), enumerable: false }
});

const addressesData = {
  "/ip4Config/1": {
    wait: jest.fn(),
    AddressData: [
      {
        address: { v: "10.0.0.1", t: "s" },
        prefix: { v: "22", t: "s" }
      }
    ]
  },
  "/ip4Config/2": {
    wait: jest.fn(),
    AddressData: [
      {
        address: { v: "10.0.0.2", t: "s" },
        prefix: { v: "22", t: "s" }
      }
    ]
  }
};

const ActivateConnectionFn = jest.fn();
const networkProxy = () => ({
  wait: jest.fn(),
  ActivateConnection: ActivateConnectionFn,
  ActiveConnections: Object.keys(activeConnections),
});

const AddConnectionFn = jest.fn();
const networkSettingsProxy = () => ({
  wait: jest.fn(),
  Hostname: "testing-machine",
  GetConnectionByUuid: () => "/org/freedesktop/NetworkManager/Settings/1",
  AddConnection: AddConnectionFn
});

const connectionSettingsMock = {
  wait: jest.fn(),
  path: "/org/freedesktop/NetworkManager/Settings/1",
  GetSettings: () => ({
    connection: {
      id: cockpit.variant("s", "active-wifi-connection"),
      "interface-name": cockpit.variant("s", "wlp3s0"),
      uuid: cockpit.variant("s", "uuid-wifi-1"),
      type: cockpit.variant("s", "802-11-wireless")
    },
    ipv4: {
      addresses: [],
      "address-data": cockpit.variant(
        "aa{sv}", [{
          address: cockpit.variant("s", "192.168.122.200"),
          prefix: cockpit.variant("u", 24)
        }]
      ),
      method: cockpit.variant("s", "auto"),
      gateway: cockpit.variant("s", "192.168.122.1"),
      dns: cockpit.variant("au", [67305985, 16843009]),
      "route-data": []
    }
  }),
  Update: jest.fn(),
  Delete: jest.fn()
};

const connectionSettingsProxy = () => connectionSettingsMock;

describe("NetworkManagerAdapter", () => {
  beforeEach(() => {
    dbusClient.proxy = jest.fn().mockImplementation(iface => {
      if (iface === NM_IFACE) return networkProxy();
      if (iface === NM_SETTINGS_IFACE) return networkSettingsProxy();
      if (iface === NM_CONNECTION_IFACE) return connectionSettingsProxy();
    });

    dbusClient.proxies = jest.fn().mockImplementation(iface => {
      if (iface === ACCESS_POINT_IFACE) return accessPoints;
      if (iface === ACTIVE_CONNECTION_IFACE) return activeConnections;
      if (iface === NM_CONNECTION_IFACE) return connections;
      if (iface === IP4CONFIG_IFACE) return addressesData;
      return {};
    });
  });

  describe("#accessPoints", () => {
    it("returns the list of last scanned access points", async () => {
      const client = new NetworkManagerAdapter(dbusClient);
      await client.setUp();
      const accessPoints = client.accessPoints();

      expect(accessPoints.length).toEqual(1);
      const [testing] = accessPoints;
      expect(testing).toEqual({
        ssid: "Testing",
        hwAddress: "00:31:92:25:84:FA",
        strength: 76,
        security: ["WPA2"]
      });
    });
  });

  describe("#activeConnections", () => {
    it("returns the list of active connections", async () => {
      const client = new NetworkManagerAdapter(dbusClient);
      await client.setUp();
      const availableConnections = client.activeConnections();

      expect(availableConnections.length).toEqual(2);
      const [wireless, ethernet] = availableConnections;
      expect(wireless).toEqual({
        name: "active-wifi-connection",
        id: "uuid-wifi-1",
        state: ConnectionState.ACTIVATED,
        type: ConnectionTypes.WIFI,
        addresses: [{ address: "10.0.0.2", prefix: 22 }]
      });

      expect(ethernet).toEqual({
        name: "active-wired-connection",
        id: "uuid-wired-1",
        state: ConnectionState.ACTIVATED,
        type: ConnectionTypes.ETHERNET,
        addresses: [{ address: "10.0.0.1", prefix: 22 }]
      });
    });
  });

  describe("#connections", () => {
    it("returns the list of settings (profiles)", async () => {
      const client = new NetworkManagerAdapter(dbusClient);
      await client.setUp();
      const connections = await client.connections();

      const [wifi] = connections;

      expect(wifi).toEqual({
        name: "Testing",
        id: "1f40ddb0-e6e8-4af8-8b7a-0b3898f0f57a",
        path: "/org/freedesktop/NetworkManager/Settings/1",
        type: ConnectionTypes.WIFI,
        ipv4: { method: 'auto', addresses: [], nameServers: [] },
        wireless: { ssid: "Testing", hidden: true },
      });
    });
  });

  describe("#getConnection", () => {
    it("returns the connection with the given ID", async () => {
      const client = new NetworkManagerAdapter(dbusClient);
      const connection = await client.getConnection("uuid-wifi-1");
      expect(connection).toEqual({
        id: "uuid-wifi-1",
        name: "active-wifi-connection",
        type: "802-11-wireless",
        ipv4: {
          addresses: [{ address: "192.168.122.200", prefix: 24 }],
          gateway: "192.168.122.1",
          method: "auto",
          nameServers: ["1.2.3.4", "1.1.1.1"]
        }
      });
    });
  });

  describe("#addConnection", () => {
    it("adds a connection and activates it", async () => {
      const client = new NetworkManagerAdapter(dbusClient);
      const connection = createConnection({ name: "Wired connection 1" });
      await client.addConnection(connection);
      expect(AddConnectionFn).toHaveBeenCalledWith(
        expect.objectContaining({
          connection: expect.objectContaining({ id: cockpit.variant("s", connection.name) })
        })
      );
    });
  });

  describe("#updateConnection", () => {
    it("updates the connection", async () => {
      const client = new NetworkManagerAdapter(dbusClient);
      const connection = await client.getConnection("uuid-wifi-1");
      connection.ipv4 = {
        ...connection.ipv4,
        addresses: [{ address: "192.168.1.2", prefix: 24 }],
        gateway: "192.168.1.1",
        nameServers: ["1.2.3.4"]
      };

      await client.updateConnection(connection);
      expect(connectionSettingsMock.Update).toHaveBeenCalledWith(expect.objectContaining(
        {
          connection: expect.objectContaining({
            id: cockpit.variant("s", "active-wifi-connection")
          }),
          ipv4: expect.objectContaining({
            "address-data": cockpit.variant("aa{sv}", [
              { address: cockpit.variant("s", "192.168.1.2"), prefix: cockpit.variant("u", 24) }
            ]),
            gateway: cockpit.variant("s", "192.168.1.1")
          })
        }
      ));
      expect(ActivateConnectionFn).toHaveBeenCalled();
    });
  });

  describe("#connectTo", () => {
    it("activates the given connection", async () => {
      const client = new NetworkManagerAdapter(dbusClient);
      await client.setUp();
      const [wifi] = await client.connections();
      await client.connectTo(wifi);
      expect(ActivateConnectionFn).toHaveBeenCalledWith(wifi.path, "/", "/");
    });
  });

  describe("#addAndConnectTo", () => {
    it("activates the given connection", async () => {
      const client = new NetworkManagerAdapter(dbusClient);
      await client.setUp();
      client.addConnection = jest.fn();
      await client.addAndConnectTo("Testing", { security: "wpa-psk", password: "testing.1234" });

      expect(client.addConnection).toHaveBeenCalledWith(
        createConnection({
          name: "Testing",
          wireless: { ssid: "Testing", security: "wpa-psk", password: "testing.1234" }
        })
      );
    });
  });

  describe("#deleteConnection", () => {
    it("deletes the given connection", async () => {
      const client = new NetworkManagerAdapter(dbusClient);
      await client.setUp();
      const [wifi] = await client.connections();
      await client.deleteConnection(wifi);

      expect(connectionSettingsMock.Delete).toHaveBeenCalled();
    });
  });

  describe("#hostname", () => {
    it("returns the Network Manager settings hostname", async() => {
      const client = new NetworkManagerAdapter(dbusClient);
      await client.setUp();
      expect(client.hostname()).toEqual("testing-machine");
    });
  });
});

describe("securityFromFlags", () => {
  it("returns an array with the security protocols supported by the given AP flags", () => {
    expect(securityFromFlags(1, 0, 0)).toEqual(["WEP"]);
    expect(securityFromFlags(1, 0x00000100, 0x00000100)).toEqual(["WPA1", "WPA2"]);
    expect(securityFromFlags(1, 0x00000200, 0x00000200)).toEqual(["WPA1", "WPA2", "802.1X"]);
  });
});

describe("mergeConnectionSettings", () => {
  it("returns an object merging the original settings and the ones from the connection", () => {
    const settings = {
      uuid: cockpit.variant("s", "ba2b14db-fc6c-40a7-b275-77ef9341880c"),
      id: cockpit.variant("s", "Wired connection 1"),
      ipv4: {
        addresses: cockpit.variant("aau", [[3232266754, 24, 3232266753]]),
        "routes-data": cockpit.variant("aau", [])
      },
      proxy: {}

    };

    const connection = createConnection({
      name: "Wired connection 2",
      ipv4: {
        addresses: [{ address: "192.168.1.2", prefix: 24 }],
        gateway: "192.168.1.1"
      }
    });

    const newSettings = mergeConnectionSettings(settings, connection);

    expect(newSettings.connection.id).toEqual(cockpit.variant("s", connection.name));
    const expectedIpv4 = ({
      gateway: cockpit.variant("s", "192.168.1.1"),
      "address-data": cockpit.variant("aa{sv}", [{
        address: cockpit.variant("s", "192.168.1.2"),
        prefix: cockpit.variant("u", 24)
      }]),
      dns: cockpit.variant("au", []),
      method: cockpit.variant("s", "auto"),
      "routes-data": cockpit.variant("aau", [])
    });
    expect(newSettings.ipv4).toEqual(expect.objectContaining(expectedIpv4));
    expect(newSettings.proxy).not.toBeUndefined();
  });

  it("does not set a gateway if there are not addresses", () => {
    const connection = createConnection({ name: "Wired connection" });
    const settings = {};
    const newSettings = mergeConnectionSettings(settings, connection);
    expect(newSettings.gateway).toBeUndefined();
  });
});
