/** @param {NS} ns */
export async function main(ns) {
  while (true) {
    const allServers = scanServers(ns);
    updateServerData(ns, allServers);
    const targetableServers = scanForTargets(ns, allServers);
    const hostServers = scanForHosts(ns, allServers);
    let selectedTarget = targetableServers[0];
    updateServerData(ns, hostServers);
    updateServerData(ns, targetableServers);

    //////
    // Ensure all servers are accessible
    for (const server of allServers) {
      openPortsAndNuke(ns, server);
    }

    //////
    // Copy updated scripts to all servers
    for (const server of hostServers) {
      const files = ["weaken.js", "grow.js", "hack.js"];
      ns.scp(files, server.hostname, "home");
    }

    for (const server of hostServers) {
      if (!server.canHack) {
        continue;
      }

      updateServerData(ns, allServers);

      // Fuction to calc pre-exec booleans and exec arguments
      const {
        optimalWeakenThreads,
        optimalHackThreads,
        availGrowThreads,
        weakenBoolean,
        growBoolean,
        hackBoolean,
      } = await preExecCalcs(ns, server, selectedTarget);

      // MARK: Target Logic
      if (
        (weakenBoolean &&
          selectedTarget.hackThreadsTargetOf === 0 &&
          selectedTarget.growThreadsTargetOf === 0) ||
        (growBoolean &&
          selectedTarget.hackThreadsTargetOf === 0 &&
          selectedTarget.weakenThreadsTargetOf === 0) ||
        (hackBoolean &&
          selectedTarget.weakenThreadsTargetOf === 0 &&
          selectedTarget.growThreadsTargetOf === 0)
      ) {
        // Conditions met, keep current target
      } else {
        // Switch target
        const currentIndex = targetableServers.findIndex(
          (s) => s.hostname === selectedTarget.hostname
        );
        const nextIndex = (currentIndex + 1) % targetableServers.length;
        selectedTarget = targetableServers[nextIndex];
      }
      //ns.tprint(`
      // ---- PRE EXEC
      //   weakenBoolean${weakenBoolean}
      //   growBoolean${growBoolean}
      //   hackBoolean${hackBoolean}
      // ---- HOST ----
      // ${JSON.stringify(server, null, 2)}
      // ---- TARGET ----
      // ${JSON.stringify(selectedTarget, null, 2)}
      //   `)

      // MARK: Exec Logic
      if (weakenBoolean) {
        const sendWeakenAmnt = ns.weakenAnalyze(optimalWeakenThreads);
        ns.exec(
          "weaken.js",
          server.hostname,
          optimalWeakenThreads,
          selectedTarget.hostname,
          sendWeakenAmnt
        );
        await ns.sleep(50);
        //ns.tprint(`${server.hostname} >>>>> ${selectedTarget.hostname}: Weakening Target (${optimalWeakenThreads})`)
        updateServerData(ns, allServers);
        continue;
      }
      if (growBoolean) {
        ns.exec(
          "grow.js",
          server.hostname,
          availGrowThreads,
          selectedTarget.hostname
        );
        await ns.sleep(50);
        //ns.tprint(`${server.hostname} >>>>> ${selectedTarget.hostname}: Growing Target (${availGrowThreads})`)
        updateServerData(ns, allServers);
        continue;
      }
      if (hackBoolean) {
        const sendHackAmnt =
          ns.hackAnalyze(server.hostname) *
          optimalHackThreads *
          selectedTarget.currentMoney;
        ns.exec(
          "hack.js",
          server.hostname,
          optimalHackThreads,
          selectedTarget.hostname,
          sendHackAmnt
        );
        await ns.sleep(50);
        //ns.tprint(`${server.hostname} >>>>> ${selectedTarget.hostname}: Hacking Target (${optimalHackThreads})`)
        updateServerData(ns, allServers);
        continue;
      }
    }
    await ns.sleep(500);
  }
}

// MARK: Ports & Nuke
/////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Determines the optimal number of weaken threads without over-weakening a server.
 * @param {NS} ns - Netscript object
 * @param {string} expects the host name of a server
 * NOTE: This does not provide a return. When called it will attempt to open ports on the server
 *       and then nuke it.
 */
function openPortsAndNuke(ns, server) {
  let homeFiles = ns.ls("home");
  let portTools = homeFiles.filter((file) =>
    [
      "BruteSSH.exe",
      "FTPCrack.exe",
      "relaySMTP.exe",
      "HTTPWorm.exe",
      "SQLInject.exe",
    ].includes(file)
  );
  if (server.openPorts >= 1 && portTools.includes("BruteSSH.exe")) {
    ns.brutessh(server.hostname);
  }
  if (server.openPorts >= 2 && portTools.includes("FTPCrack.exe")) {
    ns.ftpcrack(server.hostname);
  }
  if (server.openPorts >= 3 && portTools.includes("relaySMTP.exe")) {
    ns.relaysmtp(server.hostname);
  }
  if (server.openPorts >= 4 && portTools.includes("HTTPWorm.exe")) {
    ns.httpworm(server.hostname);
  }
  if (server.openPorts == 5 && portTools.includes("SQLInject.exe")) {
    ns.sqlinject(server.hostname);
  }
  let openablePort = portTools.length;
  if (openablePort >= server.openPorts && !ns.hasRootAccess(server.hostname)) {
    ns.nuke(server.hostname);
  }
}

// MARK: Init. Serv. Data
/////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Determines the optimal number of weaken threads without over-weakening a server.
 * @param {NS} ns - Netscript object
 * @param {string} defaults to 'home'; no string is expected
 * @param {array} defaults to an empty array to prevent infinte loops; no array is expected
 * @returns {array} - Returns an array of every server in the ga
 */
function scanServers(ns, startServer = "home", visited = new Set()) {
  // Prevent re-scanning the same server
  if (visited.has(startServer)) return [];
  visited.add(startServer);

  // Collect static server data for the current server
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

  // Store the current server's data in the results
  let allServers = [currentServerData];

  // Recursively scan connected servers and collect their data
  const connectedServers = ns.scan(startServer);
  for (const server of connectedServers) {
    if (!visited.has(server)) {
      allServers.push(...scanServers(ns, server, visited));
    }
  }
  return allServers;
}

// MARK: Scan
/////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Determines the optimal number of weaken threads without over-weakening a server.
 * @param {NS} ns - Netscript object
 * @param {array} allServers - Array of every server
 * @returns {array} - Returns an array of servers filtering out server with 0 money
 */
function scanForTargets(ns, allServers) {
  let targetServers = allServers.filter(
    (server) => server.maxMoney > 0 && server.canHack
  );
  return targetServers;
}

function scanForHosts(ns, allServers) {
  let hostServers = allServers.filter(
    (server) =>
      server.maxRam > 0 && server.canHack && server.hostname !== "home"
  );
  return hostServers;
}

// MARK: Update Servers
/////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Function to update server data
 * @param {NS} ns - Netscript object
 * @param {array} allServers - Array of every server
 * @returns {array, array} - Adds changeable data points to all arrays. Then copies that array and
 *                           removes servers with 0 makes money; used for targetting.
 *
 * NOTE: {targetServers} is different from {targetableServers} because {targetServers} information will
 * dynamically change as loops iterate, while {targetableServers} will not.
 */
function updateServerData(ns, allServers) {
  let activeScripts = [];
  for (const server of allServers) {
    //Get some basic information
    server.currentMoney = ns.getServerMoneyAvailable(server.hostname);
    server.securityLevel = ns.getServerSecurityLevel(server.hostname);
    server.hasRoot = ns.hasRootAccess(server.hostname); // Ensure root access is updated
    server.canHack =
      ns.getHackingLevel() >= ns.getServerRequiredHackingLevel(server.hostname);
    server.availRam = server.maxRam - ns.getServerUsedRam(server.hostname);

    //Find how many weaken, grow or hack threads are targetting this server
    activeScripts = ns.ps(server.hostname);
    server.weakenThreadsTargetOf = 0;
    server.growThreadsTargetOf = 0;
    server.hackThreadsTargetOf = 0;
  }
  for (const server of allServers) {
    for (const script of activeScripts) {
      if (
        script.filename === "weaken.js" &&
        script.args[0] === server.hostname
      ) {
        server.weakenThreads += script.threads;
      } else if (
        script.filename === "grow.js" &&
        script.args[0] === server.hostname
      ) {
        server.growThreads += script.threads;
      } else if (
        script.filename === "hack.js" &&
        script.args[0] === server.hostname
      ) {
        server.hackThreads += script.threads;
      }
    }
  }

  for (const server of allServers) {
    const currentWeaken = ns.weakenAnalyze(server.weakenThreadsTargetOf) || 0;
    // Fetch current security data
    const minSecurity = server.minSecurity;
    const currentSecurity = server.securityLevel;
    server.netSec = currentSecurity - currentWeaken;
  }

  // Return both filtered lists updated with dynamic values
  let availableServers = allServers.filter(
    (server) => server.hasRoot && server.hostname !== "home"
  );
  let targetableServers = allServers.filter(
    (server) => server.hasRoot && server.maxMoney > 0
  );

  return availableServers, targetableServers;
}

// MARK: Weaken Threads
/////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Function to not overkill security on weaken
 * Determines the optimal number of weaken threads without over-weakening a server.
 * @param {NS} ns - Netscript object
 * @param {string} target - The server to weaken
 * @returns {number} - Optimal number of threads to weaken the server
 */
function getOptimalWeakenThreads(ns, hostServer, selectedTarget) {
  let optimalWeakenThreads = 0;
  const reducPerThread = ns.weakenAnalyze(1);
  const weakenRam = ns.getScriptRam("weaken.js"); // RAM cost per thread for weaken
  const availThreads = Math.floor(hostServer.availRam / weakenRam);
  const threads = Math.floor(selectedTarget.netSec / reducPerThread);
  let maxThreads = 0;
  if (availThreads <= threads) {
    maxThreads = availThreads;
  } else {
    maxThreads = threads;
  }
  return { optimalWeakenThreads };
}

// MARK: Hack Threads
/**
 * Determines the optimal number of hack threads without hacking below 80% of max money.
 * @param {NS} ns - Netscript object
 * @param {string} target - The server to hack
 * @param {number} availableRam - Available RAM for the operation
 * @returns {number} - Optimal number of threads to hack the server
 */
function getOptimalHackThreads(ns, hostServer, selectedTarget) {
  const hackScriptCost = ns.getScriptRam("hack.js"); // RAM cost for hack.js per thread
  let threads = Math.floor(hostServer.availRam / hackScriptCost);

  const hackAmountPerThread =
    ns.hackAnalyze(selectedTarget.hostname) * selectedTarget.currentMoney;

  const desiredMoney = selectedTarget.maxMoney * 0.7; // Do not hack below 80% of max money

  const hackThreadMoney =
    hackAmountPerThread *
    selectedTarget.currentMoney *
    selectedTarget.hackThreadsTargetOf;
  const netMoney = selectedTarget.currentMoney - hackThreadMoney;
  selectedTarget.netMoney = netMoney;
  const hackableMoney = netMoney - desiredMoney;

  // If hacking even one thread would steal too much money, reduce the thread count quickly
  if (hackAmountPerThread * threads > hackableMoney) {
    threads = Math.floor(hackableMoney / hackAmountPerThread);
  }

  return Math.max(threads, 0); // Ensure no negative threads returned
}
// MARK: preExecCalcs
async function preExecCalcs(ns, hostServer, selectedTarget) {
  const { optimalWeakenThreads } =
    getOptimalWeakenThreads(ns, hostServer, selectedTarget) || 0;
  const optimalHackThreads =
    getOptimalHackThreads(ns, hostServer, selectedTarget) || 0;
  const sendWeakenAmnt = ns.weakenAnalyze(optimalWeakenThreads) || 0;
  const sendWeakenAmntFormatted = Math.round(sendWeakenAmnt * 1000) / 1000;
  const weakenCheck =
    selectedTarget.netSec > selectedTarget.minSecurity * 1.1 ||
    selectedTarget.netSec > selectedTarget.minSecurity + 2;
  const sendHackAmnt =
    ns.hackAnalyze(selectedTarget.hostname) *
      (optimalHackThreads * selectedTarget.currentMoney) || 0;
  const sendHackFormatted = Math.floor(sendHackAmnt);
  const availGrowThreads = Math.floor(hostServer.availRam / 1.75) || 0;
  const growthFullSend = hostServer.availRam === hostServer.maxRam;
  const checkAccess =
    hostServer.canHack &&
    hostServer.hasRoot &&
    selectedTarget.canHack &&
    selectedTarget.hasRoot;

  const weakenBoolean = optimalWeakenThreads > 2 && weakenCheck && checkAccess;

  const growBoolean =
    availGrowThreads > 0 &&
    selectedTarget.netMoney < selectedTarget.maxMoney * 0.7 &&
    checkAccess &&
    selectedTarget.growThreadsTargetOf === 0;
  growthFullSend;

  const hackBoolean =
    optimalHackThreads > 0 &&
    selectedTarget.netMoney > selectedTarget.maxMoney * 0.7 &&
    checkAccess;

  if (
    hackBoolean === true &&
    (selectedTarget.hostname === "neo-net" ||
      selectedTarget.hostname === "hong-fang-tea" ||
      selectedTarget.hostname === "neo-net")
  ) {
    ns.tprint(`
      ----- HOST ----
  ${JSON.stringify(hostServer, null, 2)}
      ----- TARGET ----;
  ${JSON.stringify(selectedTarget, null, 2)}
    `);
  }

  //   ns.tprint(` ---- preExecCalc RETURN ----
  //   weakenBoolean: ${weakenBoolean}
  //   optimalWeakenThreads: ${optimalWeakenThreads}
  //   growBoolean: ${growBoolean}
  //   availGrowThreads: ${availGrowThreads}
  //   hackBoolean: ${hackBoolean}
  //   optimalHackThreads: ${optimalHackThreads}
  //   ----- HOST ----
  //   ${JSON.stringify(hostServer, null, 2)}
  //   ----- TARGET ----;
  //  ${JSON.stringify(selectedTarget, null, 2)}`);

  return {
    optimalWeakenThreads,
    optimalHackThreads,
    availGrowThreads,
    sendWeakenAmntFormatted,
    sendHackFormatted,
    weakenBoolean,
    growBoolean,
    hackBoolean,
  };
}
