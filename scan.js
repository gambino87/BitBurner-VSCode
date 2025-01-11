/** @param {NS} ns **/
export async function main(ns) {
  const exclude = ns.args[0] || "";
  const allServers = scanServers(ns, "home", new Set(), exclude);
  ns.tprint(`${JSON.stringify(allServers, null, 2)}`);
  const updatedServers = await updateServerData(ns, allServers);
  ns.tprint(`${JSON.stringify(updatedServers, null, 2)}`);
}

function scanServers(
  ns,
  startServer = "home",
  visited = new Set(),
  exclude = ""
) {
  if (visited.has(startServer)) return [];

  // Exclude servers matching the prefix before scanning
  if (startServer.startsWith(exclude)) {
    visited.add(startServer);
    return [];
  }

  visited.add(startServer);

  const currentServerData = {
    hostname: startServer,
    maxRam: ns.getServerMaxRam(startServer),
    maxMoney: ns.getServerMaxMoney(startServer),
    minSecurity: ns.getServerMinSecurityLevel(startServer),
    reqHack: ns.getServerRequiredHackingLevel(startServer),
    openPorts: ns.getServerNumPortsRequired(startServer),
    hasRoot: ns.hasRootAccess(startServer),
    serverGrowthStatic: ns.getServerGrowth(startServer),
  };

  let allServers = [currentServerData];

  const connectedServers = ns.scan(startServer);
  for (const server of connectedServers) {
    allServers.push(...scanServers(ns, server, visited, exclude));
  }

  return allServers;
}

async function updateServerData(ns, allServers) {
  // Step 1: Collect all active scripts from all servers first
  let activeScripts = [];
  for (const server of allServers) {
    activeScripts = activeScripts.concat(
      ns.ps(server.hostname).map((script) => ({
        server: server.hostname,
        filename: script.filename,
        threads: script.threads,
        target: script.args[0], // Capture the target being attacked
      }))
    );
  }

  // Step 2: Update each server's dynamic data and count active threads targeting it
  for (const server of allServers) {
    server.currentMoney = ns.getServerMoneyAvailable(server.hostname);
    server.securityLevel = ns.getServerSecurityLevel(server.hostname);
    server.hasRoot = ns.hasRootAccess(server.hostname);
    server.canHack =
      ns.getHackingLevel() >= ns.getServerRequiredHackingLevel(server.hostname);
    server.availRam = server.maxRam - ns.getServerUsedRam(server.hostname);

    // Reset the targeting counts before incrementing
    server.weakenThreadsTargetOf = 0;
    server.growThreadsTargetOf = 0;
    server.hackThreadsTargetOf = 0;

    // Step 3: Check the combined list for scripts targeting this server
    for (const script of activeScripts) {
      if (script.target === server.hostname) {
        if (script.filename === "weaken.js") {
          server.weakenThreadsTargetOf += script.threads;
        }
        if (script.filename === "grow.js") {
          server.growThreadsTargetOf += script.threads;
        }
        if (script.filename === "hack.js") {
          server.hackThreadsTargetOf += script.threads;
        }
      }
    }
    const weakenAmount = ns.weakenAnalyze(1) * server.weakenThreadsTargetOf;
    server.netSec = server.securityLevel - weakenAmount;
  }

  // Return both filtered lists updated with dynamic values
  let availableServers = allServers.filter(
    (server) => server.hasRoot && server.hostname !== "home"
  );
  let targetableServers = allServers.filter(
    (server) => server.hasRoot && server.maxMoney > 0
  );

  // Return unfiltered values
  let updatedServers = allServers;

  return { availableServers, targetableServers, updatedServers };
}
