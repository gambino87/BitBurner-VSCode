/** @param {NS} ns */
export async function main(ns) {
  const target = ns.args[0]
  const weakenAmount = ns.args[1]
  const setSilentMode = ns.args[2]
  const host = ns.getHostname()
  const rounded = Number(weakenAmount.toFixed(3))
  await ns.weaken(target)
  if (!setSilentMode) {
    ns.tprint(`${host} weakened ${target} for ${rounded}!`)
  }
}
