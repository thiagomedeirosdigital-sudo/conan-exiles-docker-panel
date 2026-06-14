import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import net from 'net';

const ENV_PATH = '/app/conan-server-root/.env';
const RCON_HOST = 'conan-exiles-enhanced';
const RCON_PORT = 25575;

function readEnvValue(content: string, key: string) {
    const line = content
        .split('\n')
        .find(l => l.trim().startsWith(`${key}=`));

    return line ? line.split('=', 2)[1].trim() : '';
}

function createPacket(id: number, type: number, body: string) {
    const bodyBuffer = Buffer.from(body, 'utf8');
    const size = 4 + 4 + bodyBuffer.length + 2;
    const packet = Buffer.alloc(4 + size);

    packet.writeInt32LE(size, 0);
    packet.writeInt32LE(id, 4);
    packet.writeInt32LE(type, 8);
    bodyBuffer.copy(packet, 12);
    packet.writeInt8(0, 12 + bodyBuffer.length);
    packet.writeInt8(0, 13 + bodyBuffer.length);

    return packet;
}

function parsePackets(buffer: Buffer) {
    const packets: any[] = [];
    let offset = 0;

    while (offset + 4 <= buffer.length) {
        const size = buffer.readInt32LE(offset);

        if (size <= 0 || offset + 4 + size > buffer.length) break;

        const start = offset + 4;
        const id = buffer.readInt32LE(start);
        const type = buffer.readInt32LE(start + 4);
        const body = buffer
            .subarray(start + 8, start + size - 2)
            .toString('utf8');

        packets.push({ id, type, body, size });
        offset += 4 + size;
    }

    return packets;
}

function sendRconCommand(password: string, command: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const socket = net.createConnection(RCON_PORT, RCON_HOST);
        let buffer = Buffer.alloc(0);
        let authenticated = false;
        let commandSent = false;
        let finished = false;

        const finish = (err?: Error, result?: string) => {
            if (finished) return;
            finished = true;
            try { socket.destroy(); } catch {}
            if (err) reject(err);
            else resolve(result || '');
        };

        const timeout = setTimeout(() => {
            finish(new Error('Timeout aguardando resposta RCON'));
        }, 8000);

        socket.on('connect', () => {
            socket.write(createPacket(1, 3, password));
        });

        socket.on('data', (data) => {
            buffer = Buffer.concat([buffer, data]);
            const packets = parsePackets(buffer);

            for (const packet of packets) {
                if (!authenticated) {
                    if (packet.body.includes('Authenticated')) {
                        authenticated = true;
                        commandSent = true;
                        buffer = Buffer.alloc(0);
                        socket.write(createPacket(2, 2, command));
                    }
                    continue;
                }

                if (commandSent && packet.body && !packet.body.includes('Authenticated')) {
                    clearTimeout(timeout);
                    finish(undefined, packet.body);
                    return;
                }
            }
        });

        socket.on('error', (err) => {
            clearTimeout(timeout);
            finish(err);
        });

        socket.on('close', () => {
            clearTimeout(timeout);
            if (!finished && authenticated && commandSent) {
                finish(undefined, 'Comando enviado.');
            } else if (!finished) {
                finish(new Error('Conexão RCON fechada antes da resposta.'));
            }
        });
    });
}

export async function POST(request: Request) {
    try {
        const { mensagem } = await request.json();

        const cleanMessage = String(mensagem || '')
            .replace(/[\r\n]/g, ' ')
            .trim()
            .slice(0, 220);

        if (!cleanMessage) {
            return NextResponse.json(
                { success: false, error: 'Mensagem vazia.' },
                { status: 400 }
            );
        }

        const envContent = await fs.readFile(ENV_PATH, 'utf-8');
        const rconPassword = readEnvValue(envContent, 'RCON_PASSWORD');

        if (!rconPassword) {
            return NextResponse.json(
                { success: false, error: 'RCON_PASSWORD não encontrado no .env.' },
                { status: 500 }
            );
        }

        const command = `broadcast [ADMIN]: ${cleanMessage}`;
        const respostaLog = await sendRconCommand(rconPassword, command);

        return NextResponse.json({
            success: true,
            respostaLog
        });
    } catch (error: any) {
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Servidor desligado ou RCON inativo'
            },
            { status: 500 }
        );
    }
}
