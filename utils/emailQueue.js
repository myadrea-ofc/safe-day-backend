const EMAIL_CONCURRENCY = Number(process.env.EMAIL_CONCURRENCY || 2);

const emailQueue = [];
let activeJobs = 0;

const MAX_QUEUE = Number(process.env.EMAIL_QUEUE_MAX || 500);

function enqueueEmailJob(jobFn) {
  return new Promise((resolve, reject) => {
    if (emailQueue.length >= MAX_QUEUE) {
      return reject(new Error("Email queue penuh, coba lagi nanti"));
    }
    emailQueue.push({ jobFn, resolve, reject });
    processQueue();
  });
}

function processQueue() {
  while (activeJobs < EMAIL_CONCURRENCY && emailQueue.length > 0) {
    const { jobFn, resolve, reject } = emailQueue.shift();
    activeJobs++;

    Promise.resolve()
      .then(jobFn)
      .then(resolve)
      .catch(reject)
      .finally(() => {
        activeJobs--;
        processQueue();
      });
  }
}

module.exports = { enqueueEmailJob };