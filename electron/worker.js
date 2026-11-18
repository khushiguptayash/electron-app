// Read this worker's numeric ID from the environment provided by Main.
const id = process.env.CHILD_ID;

// Send a plain object from this child back to Main.
function sendToParent(message) {
  // Use the utility-process parentPort rather than browser IPC.
  process.parentPort.postMessage(message);
}

// Listen for plain-object messages forwarded through Main.
process.parentPort.on('message', (event) => {
  // Extract the payload that Main posted to this worker.
  const message = event.data;

  // Handle a greeting request sent by the UI.
  if (message.type === 'greet') {
    // Return a child-ID-specific reply and echo the received text.
    sendToParent({ type: 'reply', text: `Hi! Child #${id} received: "${message.text}"` });
  }

  // Handle a CPU-intensive prime-counting request.
  if (message.type === 'count-primes') {
    // Record the start time to report elapsed computation time.
    const start = Date.now();
    // Run the calculation in this separate child process.
    const result = countPrimes(message.limit);
    // Send the calculated result back to Main.
    sendToParent({
      type: 'result',
      // Format both numbers and include elapsed milliseconds.
      text: `Found ${result.toLocaleString()} primes below ${message.limit.toLocaleString()} in ${Date.now() - start} ms`,
    });
  }
});

// Count prime numbers strictly below the supplied limit.
function countPrimes(limit) {
  // Initialize the output count.
  let count = 0;
  // Test every integer beginning at 2.
  for (let n = 2; n < limit; n++) {
    // Assume this integer is prime until a divisor is found.
    let isPrime = true;
    // Test divisors only through the integer square root.
    for (let d = 2; d * d <= n; d++) {
      // Stop testing this integer when one divisor is found.
      if (n % d === 0) { isPrime = false; break; }
    }
    // Increase the count only if no divisor disproved primality.
    if (isPrime) count++;
  }
  // Return the completed count to the message handler.
  return count;
}

// Send an unsolicited ready message when the worker has started.
sendToParent({ type: 'ready', text: `Child #${id} is running (pid ${process.pid})` });

// Start a timer that sends a heartbeat every ten seconds.
setInterval(() => {
  // Post one alive message to Main on each interval.
  sendToParent({ type: 'heartbeat', text: `Child #${id} is alive` });
}, 10000);
