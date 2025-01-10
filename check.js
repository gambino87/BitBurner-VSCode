/** @param {NS} ns */
export async function main(ns) {
  const allServers = scanServers(ns);
  const checkTarget = ns.args[0];

  if (checkTarget === "weaken" || "hack" || "grow") {
    let checkWeaken = [];
    let checkHack = [];
    let checkGrow = [];
    let scripts = [];
    for (const server of allServers) {
      scripts = ns.getRunningScript(server);
      checkWeaken = scripts.filter("weaken.js");
      checkGrow = scripts.filter("grow.js");
      checkHack = scripts.filter("hack.js");
    }
    if (checkTarget === "weaken") {
      ns.tprint(`${checkWeaken}`);
    }
    if (checkTarget === "grow") {
      ns.tprint(`${checkGrow}`);
    }
    if (checkTarget === "hack") {
      ns.tprint(`${checkHack}`);
    }
  }

  let runningScripts = ns.getRunningScript(checkTarget);
  if (checkTarget === "") {
    ns.tprint(`${runningScripts}`);
  }
  if (checkTarget === "weaken" && !("weaken" || "hack" || "grow")) {
    if (runningScripts.filename === "weaken.js") {
      growScript = runningScripts.filter("weaken.js");
      ns.tprint(`${weakenScript}`);
    }
  }
  if (checkTarget === "grow") {
    if (runningScripts.filename === "weaken.js") {
      growScript = runningScripts.filter("grow.js");
      ns.tprint(`${growScript}`);
    }
  }
  if (checkTarget === "hack") {
    if (runningScripts.filename === "weaken.js") {
      hackScript = runningScripts.filter("hack.js");
      ns.tprint(`${hackScriptrunScript}`);
    }
  }
}

function scanServers(ns, startServer = "home", visited = new Set()) {
  // Prevent re-scanning the same server
  if (visited.has(startServer)) return [];
  visited.add(startServer);

  // Store the current server's data in the results
  const allServers = [];

  // Recursively scan connected servers and collect their data
  const connectedServers = ns.scan(startServer);
  for (const server of connectedServers) {
    if (!visited.has(server)) {
      allServers.push(...scanServers(ns, server, visited));
    }
  }
  return allServers;
}
