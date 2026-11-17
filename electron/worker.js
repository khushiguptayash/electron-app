// ============================================================
//  CHILD PROCESS — a separate Node.js process started by Main.
//  It talks to its parent ONLY through process.parentPort.
// ============================================================
const id = process.env.CHILD_ID;

// Helper: CHILD -> PARENT
function sendToParent(message) {
  process.parentPort.postMessage(message);
}

// PARENT -> CHILD: handle messages coming from Main
process.parentPort.on('message', (event) => {
  const message = event.data;

  if (message.type === 'greet') {
    sendToParent({ type: 'reply', text: `Hi! Child #${id} received: "${message.text}"` });
  }

  if (message.type === 'count-primes') {
    // Heavy work runs here, so the UI never freezes
    const start = Date.now();
    const result = countPrimes(message.limit);
    sendToParent({
      type: 'result',
      text: `Found ${result.toLocaleString()} primes below ${message.limit.toLocaleString()} in ${Date.now() - start} ms`,
    });
  }
});

function countPrimes(limit) {
  let count = 0;
  for (let n = 2; n < limit; n++) {
    let isPrime = true;
    for (let d = 2; d * d <= n; d++) {
      if (n % d === 0) { isPrime = false; break; }
    }
    if (isPrime) count++;
  }
  return count;
}

// The child can also talk FIRST, without being asked:
sendToParent({ type: 'ready', text: `Child #${id} is running (pid ${process.pid})` });

setInterval(() => {
  sendToParent({ type: 'heartbeat', text: `Child #${id} is alive` });
}, 10000);
