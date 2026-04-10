import type { Device } from "./models";

export function orderDevices(
  devices: Device[],
  deviceOrder: string[],
): Device[] {
  if (deviceOrder.length === 0) {
    return devices;
  }

  const orderIndex = new Map(deviceOrder.map((deviceId, index) => [deviceId, index]));

  return [...devices].sort((left, right) => {
    const leftIndex = orderIndex.get(left.id);
    const rightIndex = orderIndex.get(right.id);

    if (leftIndex === undefined && rightIndex === undefined) {
      return left.name.localeCompare(right.name);
    }
    if (leftIndex === undefined) {
      return 1;
    }
    if (rightIndex === undefined) {
      return -1;
    }
    return leftIndex - rightIndex;
  });
}

export function filterDevices(
  devices: Device[],
  search: string,
  filter: "all" | "online" | "offline",
): Device[] {
  const query = search.trim().toLowerCase();

  return devices.filter((device) => {
    const matchesQuery =
      query.length === 0 ||
      device.name.toLowerCase().includes(query) ||
      device.id.toLowerCase().includes(query) ||
      device.channels.some((channel) =>
        channel.displayName.toLowerCase().includes(query),
      );

    const matchesFilter =
      filter === "all" ||
      (filter === "online" && device.online) ||
      (filter === "offline" && !device.online);

    return matchesQuery && matchesFilter;
  });
}
