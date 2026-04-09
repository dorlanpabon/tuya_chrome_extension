import type { Device } from "./models";

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
