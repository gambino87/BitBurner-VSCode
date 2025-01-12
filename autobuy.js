const breakpoints = [
  { ram: 8, money: 12e6 },
  { ram: 128, money: 177e6 },
  { ram: 2048, money: 2.9e9 },
  { ram: 32768, money: 45e9 },
  { ram: 1048576, money: 1.5e12 },
]

/** @param {NS} ns **/
export async function main(ns) {
  const lastBreakpointRam = breakpoints[breakpoints.length - 1].ram

  while (true) {
    const breakpoint = getCurrentBreakpoint(ns)

    // If no servers exist, buy the highest breakpoint based on available money
    if (breakpoint.droneRam === 0) {
      await buyServersBasedOnMoney(ns)
    }

    // Check if already at the highest breakpoint, stop the script
    if (breakpoint.droneRam >= lastBreakpointRam) {
      ns.tprint("Final breakpoint RAM reached. Ending script.")
      break
    }

    // DELETE ONLY IF A HIGHER BREAKPOINT IS REACHED
    const nextBreakpoint = breakpoints.find(
      (bp) => bp.ram > breakpoint.droneRam
    )
    if (nextBreakpoint && breakpoint.currentMoney >= nextBreakpoint.money) {
      deleteDronesOnBreakpoint(ns)
    }

    // BUY SERVERS ONLY IF THE BREAKPOINT INCREASED
    const afterDeletionBreakpoint = getCurrentBreakpoint(ns)
    if (afterDeletionBreakpoint.droneRam < lastBreakpointRam) {
      buyDroneServers(ns)
    }

    await ns.sleep(10000)
  }
}

//MARK: Scan
function scanDroneServers(ns, startServer = "home", visited = new Set()) {
  let droneServers = []

  if (visited.has(startServer)) return []
  visited.add(startServer)

  if (startServer.startsWith("drone")) {
    droneServers.push(startServer)
  }

  const connectedServers = ns.scan(startServer)
  for (const server of connectedServers) {
    if (!visited.has(server)) {
      droneServers.push(...scanDroneServers(ns, server, visited))
    }
  }

  return droneServers
}

//MARK: Get Breakpoint
function getCurrentBreakpoint(ns) {
  const droneServers = scanDroneServers(ns)
  const droneRam =
    droneServers.length > 0
      ? Math.max(...droneServers.map((s) => ns.getServerMaxRam(s)), 0)
      : 0
  const currentMoney = ns.getServerMoneyAvailable("home")

  const currentBreakpoint = breakpoints
    .filter((bp) => droneRam >= bp.ram && currentMoney >= bp.money)
    .pop()

  return {
    currentMoney,
    droneRam,
    currentBreakpoint: currentBreakpoint ? currentBreakpoint.money : null,
  }
}

//MARK: Delete All Drones on Breakpoint
function deleteDronesOnBreakpoint(ns) {
  const { currentBreakpoint, droneRam } = getCurrentBreakpoint(ns)
  const lastBreakpointRam = breakpoints[breakpoints.length - 1].ram
  const droneServers = scanDroneServers(ns)

  // If no servers exist, allow purchase instead of deletion
  if (droneServers.length === 0) {
    ns.tprint("No servers exist. Ready to purchase.")
    return
  }

  // Only delete if lower-tier servers exist and it's not at the max breakpoint
  if (currentBreakpoint && droneRam < lastBreakpointRam) {
    for (const server of droneServers) {
      ns.killall(server)
      ns.deleteServer(server)
      ns.tprint(`Killed scripts and deleted server: ${server}`)
    }
  } else {
    ns.tprint("No servers deleted. Maximum breakpoint reached.")
  }
}

function buyDroneServers(ns) {
  const { currentBreakpoint, droneRam } = getCurrentBreakpoint(ns)
  const lastBreakpointRam = breakpoints[breakpoints.length - 1].ram
  const maxServers = 25

  if (ns.getPurchasedServers().length >= maxServers) {
    ns.tprint("Maximum server limit reached. No new servers purchased.")
    return
  }

  // If no servers exist, find the highest affordable breakpoint and buy it
  if (droneRam === 0) {
    const currentMoney = ns.getServerMoneyAvailable("home")
    const highestAffordableBreakpoint = breakpoints
      .filter((bp) => currentMoney >= bp.money)
      .pop()

    if (highestAffordableBreakpoint) {
      for (let i = 0; i < maxServers; i++) {
        const purchased = ns.purchaseServer(
          "drone",
          highestAffordableBreakpoint.ram
        )
        if (purchased) {
          ns.tprint(
            `Purchased server with ${highestAffordableBreakpoint.ram} GB RAM.`
          )
        } else {
          ns.tprint(
            "Server purchase failed. Possibly reached the server limit."
          )
        }
      }
      return
    } else {
      ns.tprint("Not enough money to buy any servers.")
      return
    }
  }

  // Prevent repurchasing when the highest breakpoint is reached
  if (currentBreakpoint && droneRam < lastBreakpointRam) {
    for (let i = 0; i < maxServers; i++) {
      const purchased = ns.purchaseServer("drone", currentBreakpoint.ram)
      if (purchased) {
        ns.tprint(`Purchased server with ${currentBreakpoint.ram} GB RAM.`)
      } else {
        ns.tprint("Server purchase failed. Possibly reached the server limit.")
      }
    }
  } else {
    ns.tprint("No new servers purchased. Already at the highest breakpoint.")
  }
}

//MARK: Buy Servers Based on Money
async function buyServersBasedOnMoney(ns) {
  const currentMoney = ns.getServerMoneyAvailable("home")

  // Find the highest breakpoint affordable based on money
  const highestAffordableBreakpoint = breakpoints
    .filter((bp) => currentMoney >= bp.money)
    .pop()

  if (highestAffordableBreakpoint) {
    for (let i = 0; i < 25; i++) {
      ns.exec(
        "buy.js",
        "home",
        1,
        "drone",
        highestAffordableBreakpoint.ram,
        "yes"
      )
      ns.tprint(
        `Initiated purchase for server with ${highestAffordableBreakpoint.ram} GB RAM.`
      )
      await ns.sleep(10)
    }
  } else {
    ns.tprint("Not enough money to purchase any servers.")
  }
}
