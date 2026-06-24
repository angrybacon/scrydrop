type Identifier =
  | { name: string }
  | { name: string; set: string }
  | { set: string; collector_number: string };

const FLUSH_SIZE = 75;
const FLUSH_INTERVAL = 1000;

type BatcherConfiguration = {
  debug: boolean;
  fetcher: (identifiers: Identifier[]) => Promise<{
    data: unknown[];
    not_found: unknown[];
  }>;
};

export const Batcher = ({ debug, fetcher }: BatcherConfiguration) => {
  const queue: {
    id: Identifier;
    reject: (error: Error) => void;
    resolve: (card: unknown) => void;
  }[] = [];

  let timer: NodeJS.Timeout | null = null;

  const flush = async () => {
    if (debug) console.info(`Flushing queue (${queue.length})`);
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (queue.length === 0) return;
    const batch = queue.splice(0, FLUSH_SIZE);
    try {
      const { data, not_found } = await fetcher(batch.map(({ id }) => id));
      if (data.length !== batch.length) {
        // NOTE We assume Scryfall preserves the order as they advertise as much
        throw new Error(`Missing data ${JSON.stringify(not_found, null, 2)}`);
      }
      if (debug) console.info(`Reading batch (${data.length})`);
      for (const [index, { resolve }] of batch.entries()) resolve(data[index]);
    } catch (cause) {
      for (const pending of batch) {
        const error = cause instanceof Error ? cause : new Error(String(cause));
        pending.reject(error);
      }
    }
    // NOTE Items may have arrived during the await
    if (queue.length >= FLUSH_SIZE) return flush();
    if (queue.length) timer ??= setTimeout(() => void flush(), FLUSH_INTERVAL);
  };

  const enqueue = (id: Identifier): Promise<unknown> =>
    new Promise((resolve, reject) => {
      queue.push({ id, reject, resolve });
      if (debug) console.info(`Queued ${JSON.stringify(id)}`);
      if (queue.length >= FLUSH_SIZE) void flush();
      timer ??= setTimeout(() => void flush(), FLUSH_INTERVAL);
    });

  return { enqueue };
};
