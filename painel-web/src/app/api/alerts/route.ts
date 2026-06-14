import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const settingsPath = '/app/conan-server-root/cron_settings.json';

const defaultSettings = {
    restartAtivo: false,
    horaRestart: '03:00',
    tempoAviso1: 10,
    mensagem1: '[AVISO] Servidor reinicia em 10 minutos para manutenção diária segura!',
    tempoAviso2: 5,
    mensagem2: '[AVISO] Restam 5 minutos para o reinício seguro! Desloguem em local seguro.'
};

function cleanBool(value: unknown) {
    return value === true;
}

function cleanTime(value: unknown) {
    if (typeof value !== 'string') return '03:00';
    if (!/^\d{2}:\d{2}$/.test(value)) return '03:00';

    const [h, m] = value.split(':').map(Number);
    if (h < 0 || h > 23 || m < 0 || m > 59) return '03:00';

    return value;
}

function cleanMinutes(value: unknown, fallback: number) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(1, Math.min(120, Math.floor(n)));
}

function cleanMessage(value: unknown, fallback: string) {
    if (typeof value !== 'string') return fallback;
    return value.replace(/[\r\n]/g, ' ').trim().slice(0, 250);
}

async function ensureSettingsFile() {
    try {
        await fs.access(settingsPath);
    } catch {
        await fs.writeFile(settingsPath, JSON.stringify(defaultSettings, null, 2), 'utf-8');
    }
}

export async function GET() {
    try {
        await ensureSettingsFile();

        const data = await fs.readFile(settingsPath, 'utf-8');
        const parsed = JSON.parse(data);

        return NextResponse.json({
            ...defaultSettings,
            ...parsed
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: 'Erro ao ler configurações de restart seguro', details: error.message },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        const settings = {
            restartAtivo: cleanBool(body.restartAtivo),
            horaRestart: cleanTime(body.horaRestart),
            tempoAviso1: cleanMinutes(body.tempoAviso1, 10),
            mensagem1: cleanMessage(body.mensagem1, defaultSettings.mensagem1),
            tempoAviso2: cleanMinutes(body.tempoAviso2, 5),
            mensagem2: cleanMessage(body.mensagem2, defaultSettings.mensagem2)
        };

        if (settings.tempoAviso2 >= settings.tempoAviso1) {
            return NextResponse.json(
                { error: 'O segundo aviso deve ter menos minutos que o primeiro aviso.' },
                { status: 400 }
            );
        }

        await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');

        return NextResponse.json({
            success: true,
            message: settings.restartAtivo
                ? 'Restart automático seguro ATIVADO.'
                : 'Restart automático seguro DESATIVADO.',
            settings
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: 'Erro ao salvar configurações de restart seguro', details: error.message },
            { status: 500 }
        );
    }
}
