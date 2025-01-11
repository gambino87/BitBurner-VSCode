/** @param {NS} ns */
export async function main(ns) {
  //MARK: Init. Scans
  while (true) {
    const allServers = scanServers(ns);
    await updateServerData(ns, allServers);
    await ns.sleep(10);
    const targetableServers = scanForTargets(ns, allServers);
    const hostServers = scanForHosts(ns, allServers);
    let selectedTarget = targetableServers[0];
    await updateServerData(ns, hostServers);
    await ns.sleep(10);
    await updateServerData(ns, targetableServers);
    await ns.sleep(10);

    //MARK: Nuke Logic
    //////
    // Ensure all servers are accessible
    for (const server of allServers) {
      await openPortsAndNuke(ns, server);
    }
    await ns.sleep(10);

    //////
    // Copy updated scripts to all servers
    for (const server of hostServers) {
      const files = ["weaken.js", "grow.js", "hack.js"];
      ns.scp(files, server.hostname, "home");
    }

    //////
    //BLOCK: EXEC AND TARGET LOGIC
    for (const server of hostServers) {
      if (!server.canHack) {
        continue;
      }

      await updateServerData(ns, allServers);
      await ns.sleep(10);

      // Fuction to calc pre-exec booleans and exec arguments
      const {
        optimalWeakenThreads,
        optimalHackThreads,
        availGrowThreads,
        weakenBoolean,
        growBoolean,
        hackBoolean,
      } = await preExecCalcs(ns, server, selectedTarget);
      await ns.sleep(10);

      // MARK: Target Logic
      if (weakenBoolean || growBoolean || hackBoolean) {
        // Keep current target since one of the conditions is met
      } else {
        // Switch target if none of the conditions are met
        const currentIndex = targetableServers.findIndex(
          (s) => s.hostname === selectedTarget.hostname
        );
        const nextIndex = (currentIndex + 1) % targetableServers.length;
        selectedTarget = targetableServers[nextIndex];
      }

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
        await ns.sleep(10);
        // ns.tprint(
        //   `${server.hostname} >>>>> ${selectedTarget.hostname}: Weakening Target (${optimalWeakenThreads})`
        // );
        await ns.sleep(10);
        continue;
      }

      if (growBoolean) {
        ns.exec(
          "grow.js",
          server.hostname,
          availGrowThreads,
          selectedTarget.hostname
        );
        await ns.sleep(10);
        // ns.tprint(
        //   `${server.hostname} >>>>> ${selectedTarget.hostname}: Growing Target (${availGrowThreads})`
        // );
        await ns.sleep(10);
        continue;
      }

      if (hackBoolean) {
        const sendHackAmnt =
          ns.hackAnalyze(selectedTarget.hostname) *
          optimalHackThreads *
          selectedTarget.netMoney;
        ns.exec(
          "hack.js",
          server.hostname,
          optimalHackThreads,
          selectedTarget.hostname,
          sendHackAmnt
        );
        await ns.sleep(10);
        // ns.tprint(
        //   `${server.hostname} >>>>> ${selectedTarget.hostname}: Hacking Target (${optimalHackThreads})`
        // );
        await ns.sleep(10);
        continue;
      }
      //End of Exec Logic
    }
    await ns.sleep(100);
  }
}

// MARK: (f)Port&Nuke
/////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Determines the optimal number of weaken threads without over-weakening a server.
 * @param {NS} ns - Netscript object
 * @param {string} expects the host name of a server
 * NOTE: This does not provide a return. When called it will attempt to open ports on the server
 *       and then nuke it.
 */
async function openPortsAndNuke(ns, server) {
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
  if (openablePort >= server.openPorts) {
    ns.nuke(server.hostname);
  }
}

// MARK: (f)Init.Data
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

// MARK: (f)Init.Scan
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

// MARK: (f)Upd. Data
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

  return { availableServers, targetableServers };
}

// MARK: (f)W. Threads
/////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Function to not overkill security on weaken
 * Determines the optimal number of weaken threads without over-weakening a server.
 * @param {NS} ns - Netscript object
 * @param {string} target - The server to weaken
 * @returns {number} - Optimal number of threads to weaken the server
 */
function getOptimalWeakenThreads(ns, hostServer, selectedTarget) {
  // Ensure valid RAM values and avoid division by zero
  const weakenRam = ns.getScriptRam("weaken.js") || 1;
  const reducPerThread = ns.weakenAnalyze(1) || 0.05; // Default security reduction
  const availThreads = Math.floor(hostServer.availRam / weakenRam) || 0;

  // Ensure positive values for security reduction
  const threadsNeededToCap = Math.max(
    Math.floor(selectedTarget.netSec / reducPerThread),
    0
  );

  // Determine the maximum possible threads
  let optimalWeakenThreads = Math.min(availThreads, threadsNeededToCap);

  return optimalWeakenThreads; //Returns a number (not object)
}

// MARK: (f)H. Threads
/**
 * Determines the optimal number of hack threads without hacking below 80% of max money.
 * @param {NS} ns - Netscript object
 * @param {string} target - The server to hack
 * @param {number} availableRam - Available RAM for the operation
 * @returns {number} - Optimal number of threads to hack the server
 */
function getOptimalHackThreads(ns, hostServer, selectedTarget) {
  const hackScriptCost = ns.getScriptRam("hack.js"); // RAM cost for hack.js per thread
  let threads = Math.floor(hostServer.availRam / hackScriptCost) || 0;

  // Prevent division errors and ensure hackAmountPerThread never defaults to zero
  const hackAmountPerThread =
    ns.hackAnalyze(selectedTarget.hostname) *
    Math.max(selectedTarget.currentMoney, 1);

  const hackAmountPerThreadsTargetOf =
    hackAmountPerThread * (selectedTarget.hackThreadsTargetOf ?? 0);

  const netCurrentMoney = Math.max(
    selectedTarget.currentMoney - hackAmountPerThreadsTargetOf,
    0
  );

  selectedTarget.netMoney = netCurrentMoney;

  const hackableMoney = Math.max(selectedTarget.maxMoney - netCurrentMoney, 0);

  // Only reduce threads if calculated threads exceed hackable money
  if (
    hackAmountPerThread > 0 &&
    hackAmountPerThread * threads > hackableMoney
  ) {
    threads = Math.floor(hackableMoney / hackAmountPerThread);
    // Fix issues with infinity and negative threads
    if (!isFinite(threads) || threads <= 0) {
      let maxThreads = Math.floor(hostServer.availRam / hackScriptCost);
      // Ensure maxThreads doesn't drop below zero
      while (
        maxThreads > 0 &&
        maxThreads * hackAmountPerThread < hackableMoney
      ) {
        maxThreads--;
      }
      threads = Math.max(maxThreads, 0);
    }
  }
  // if (selectedTarget.hostname === "n00dles")
  //   ns.tprint(`
  // hackAmountPerThread:${hackAmountPerThread}
  // threads:${threads}
  // hackableMoney:${hackableMoney}
  // hostServer.availRam:${hostServer.availRam}

  // `);
  return Math.max(threads, 0); // Ensure no negative threads are returned
}

// MARK: (f)Exec. Calcs
async function preExecCalcs(ns, hostServer, selectedTarget) {
  const optimalWeakenThreads =
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
  let growthFullSend = false;
  if (hostServer.availRam === hostServer.maxRam) {
    growthFullSend = true;
  }
  const checkAccess =
    hostServer.canHack &&
    hostServer.hasRoot &&
    selectedTarget.canHack &&
    selectedTarget.hasRoot;

  const weakenBoolean = optimalWeakenThreads > 1 && weakenCheck && checkAccess;

  const growBoolean =
    availGrowThreads > 0 &&
    selectedTarget.netMoney < selectedTarget.maxMoney * 0.7 &&
    checkAccess &&
    selectedTarget.growThreadsTargetOf === 0 &&
    growthFullSend;

  const hackBoolean =
    optimalHackThreads > 0 &&
    selectedTarget.netMoney >= selectedTarget.maxMoney * 0.7 &&
    checkAccess;

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
