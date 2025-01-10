/** @param {NS} ns */
export async function main(ns) {
  let serverCost = 0;
  const serverName = ns.args[0] || "^displaytoast*/";
  const ramAmount = ns.args[1] || "^noramentered*/";
  const doubleCheck = ns.args[2] === "yes";
  const myMoney = ns.getServerMoneyAvailable("home");

  if (serverName == "^displaytoast*/") {
    ns.tprint(`---- Use arguments: buy.js [server name] [ramAmount]`);
    ns.tprint(
      `---- [ramAmount] value must be between 2 - 1048576 and a power of 2.`
    );
    ns.tprint(`---- I.E. 2, 4, 8, 16, 32, 64...`);
  } else if (ramAmount == "^noramentered*/") {
    ns.tprint(`No RAM value entered.`);
  } else if (ramAmount & (ramAmount - 1 !== 0)) {
    ns.tprint(`---- Hello? Are you retarded? Try: buy.js a-new-brain 2`);
  }

  if (
    myMoney > serverCost &&
    serverName !== "^displaytoast*/" &&
    ramAmount !== "^noramentered*/" &&
    !doubleCheck
  ) {
    serverCost = ns.getPurchasedServerCost(ramAmount);
    const serverCostFormatted = serverCost.toLocaleString();
    ns.tprint(`---- Are you sure you want to purchase:`);
    ns.tprint(
      `---- Server: ${serverName} with ${ramAmount} for ${serverCostFormatted}`
    );
    ns.tprint(
      `---- To confirm, use: run buy.js ${serverName} ${ramAmount} yes`
    );
  }
  if (myMoney > serverCost && doubleCheck) {
    serverCost = ns.getPurchasedServerCost(ramAmount);
    const serverCostFormatted = serverCost.toLocaleString();
    ns.tprint(
      `---- Purchased: ${serverName} with ${ramAmount}GB of RAM for $${serverCostFormatted}`
    );
    ns.purchaseServer(serverName, ramAmount);
  }
}
