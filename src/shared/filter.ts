import type { Device } from "./models";

export function orderDevices(
  devices: Device[],
  deviceOrder: string[],
  favoriteDeviceIds: string[] = [],
): Device[] {
  const orderIndex = new Map(deviceOrder.map((deviceId, index) => [deviceId, index]));
  const favoriteSet = new Set(favoriteDeviceIds);

  return [...devices].sort((left, right) => {
    const leftFavorite = favoriteSet.has(left.id);
    const rightFavorite = favoriteSet.has(right.id);

    if (leftFavorite !== rightFavorite) {
      return leftFavorite ? -1 : 1;
    }

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
  filter: "all" | "online" | "offline" | "favorites",
  favoriteDeviceIds: string[] = [],
): Device[] {
  const query = search.trim().toLowerCase();
  const favoriteSet = new Set(favoriteDeviceIds);

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
      (filter === "offline" && !device.online) ||
      (filter === "favorites" && favoriteSet.has(device.id));

    return matchesQuery && matchesFilter;
  });
}
