/** @param {NS} ns */
export async function main(ns) {
  const target = ns.args[0];
  const setSilentMode = ns.args[1];

  await ns.grow(target);
  if (!setSilentMode) {
    ns.tprint(`Grew ${target}!`);
  }
}
