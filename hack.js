/** @param {NS} ns */
export async function main(ns) {
  const target = ns.args[0];
  const hackAmount = ns.args[1];
  const host = ns.getHostname();
  await ns.hack(target);
  //ns.tprint(`${host} hacked ${target} for ~ $${Math.floor(hackAmount)}!`);
}
