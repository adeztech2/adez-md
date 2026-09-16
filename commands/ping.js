export const name = 'ping';
export const category = 'General';
export const adminOnly = false;
export const ownerOnly = false;

export async function execute(sock, msg, { from }) {
  const start = Date.now();

  const sent = await sock.sendMessage(
    from,
    { text: '🏓 Pinging...' },
    { quoted: msg }
  );

  const latency = Date.now() - start;

  await sock.sendMessage(
    from,
    { text: `🏓 Pong!\n⏱️ ${latency}ms` },
    { quoted: sent }
  );
}
