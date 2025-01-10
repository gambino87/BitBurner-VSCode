/** @param {NS} ns */
export async function main(ns) {
  const args0 = ns.args[0];
  const args1 = ns.args[1];
  const maxRam = ns.getServerMaxRam(args0);
  if (!ns.args[0]) {
    ns.tprint(`
       Use the following arguments:
           destroy.js server
        `);
  }

  if (typeof ns.args[0] === "string" && !args1) {
    ns.tprint(`
-----------------------------------------------
   Are you sure you wish to delete ${args0}?
   MAX RAM: ${maxRam}
-----------------------------------------------
           THIS IS IRREVERSABLE
-----------------------------------------------
All scripts will be terminated before deletion.
********MAY CAUSE SMARTRUN.JS TO CRASH*********
-----------------------------------------------
         run destroy.js ${args0} yes
               to continue...
-----------------------------------------------
    `);
  }
  if (args1 === "yes" && args0) {
    const runningscripts = ns.ps(args0);
    for (const script of runningscripts) {
      ns.scriptKill(script.filename, args0);
    }
    ns.tprint(`
        ---- DELETED SERVER: ${args0} ----`);
    ns.deleteServer(args0);
  }
}
