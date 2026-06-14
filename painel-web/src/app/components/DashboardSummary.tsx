'use client';

import { useEffect, useState } from 'react';

export default function DashboardSummary() {
  const [stats, setStats] = useState<any>(null);
  const [backups, setBackups] = useState<any>(null);
  const [alerts, setAlerts] = useState<any>(null);
  const [updates, setUpdates] = useState<any>(null);
  const [players, setPlayers] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const carregar = async () => {
    setLoading(true);

    try {
      const [s, b, a, u, p] = await Promise.allSettled([
        fetch('/api/stats').then(r => r.json()),
        fetch('/api/backups').then(r => r.json()),
        fetch('/api/alerts').then(r => r.json()),
        fetch('/api/updates').then(r => r.json()),
        fetch('/api/players').then(r => r.json())
      ]);

      if (s.status === 'fulfilled') setStats(s.value);
      if (b.status === 'fulfilled') setBackups(b.value);
      if (a.status === 'fulfilled') setAlerts(a.value);
      if (u.status === 'fulfilled') setUpdates(u.value);
      if (p.status === 'fulfilled') setPlayers(p.value);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    const timer = setInterval(carregar, 30000);
    return () => clearInterval(timer);
  }, []);

  const ultimoBackup = backups?.safeBackups?.[0];
  const qtdBackups = backups?.safeBackups?.length || 0;
  const qtdLegacy = backups?.legacyBackups?.length || 0;
  const changedMods = Array.isArray(updates?.changedMods) ? updates.changedMods.length : 0;
  const playersOnline = players?.online?.players ?? 0;
  const playersMax = players?.online?.maxPlayers ?? 0;
  const unique24h = players?.history?.unique24h ?? 0;
  const unique48h = players?.history?.unique48h ?? 0;

  const card = {
    backgroundColor: '#1e1e1e',
    border: '1px solid #333',
    borderRadius: '8px',
    padding: '14px'
  };

  const label = {
    color: '#aaa',
    fontSize: '12px',
    marginBottom: '7px',
    textTransform: 'uppercase' as const
  };

  const value = {
    color: '#fff',
    fontSize: '18px',
    fontWeight: 'bold' as const
  };

  const small = {
    color: '#bbb',
    fontSize: '12px',
    marginTop: '7px'
  };

  return (
    <div style={{ gridColumn: '1 / -1', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h2 style={{ color: '#f39c12', margin: 0, fontSize: '20px' }}>Resumo do Servidor</h2>

        <button
          onClick={carregar}
          disabled={loading}
          style={{
            backgroundColor: '#3498db',
            color: '#fff',
            border: 'none',
            padding: '8px 12px',
            borderRadius: '5px',
            cursor: loading ? 'wait' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          {loading ? 'Atualizando...' : '🔄 Atualizar'}
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '12px'
      }}>
        <div style={card}>
          <div style={label}>Status Conan</div>
          <div style={{ ...value, color: stats?.status === 'Online' ? '#22c55e' : '#ef4444' }}>
            {stats?.status || 'Carregando...'}
          </div>
          <div style={small}>Monitoramento do container</div>
        </div>

        <div style={card}>
          <div style={label}>CPU / RAM</div>
          <div style={value}>CPU {stats?.cpu ?? '-'}%</div>
          <div style={small}>
            RAM {stats?.ram?.used ?? '-'} / {stats?.ram?.total ?? '-'}
          </div>
        </div>

        <div style={card}>
          <div style={label}>Último backup</div>
          <div style={{ ...value, fontSize: '14px', fontFamily: 'monospace' }}>
            {ultimoBackup?.filename || 'Nenhum backup'}
          </div>
          <div style={small}>
            {ultimoBackup?.date || '-'} {ultimoBackup?.size ? `• ${ultimoBackup.size}` : ''}
          </div>
        </div>

        <div style={card}>
          <div style={label}>Backups</div>
          <div style={value}>{qtdBackups} seguro(s)</div>
          <div style={{ ...small, color: qtdLegacy > 0 ? '#facc15' : '#22c55e' }}>
            Legacy/inseguros: {qtdLegacy}
          </div>
        </div>

        <div style={card}>
          <div style={label}>Restart automático</div>
          <div style={{ ...value, color: alerts?.restartAtivo ? '#22c55e' : '#f97316' }}>
            {alerts?.restartAtivo ? 'Ativo' : 'Desativado'}
          </div>
          <div style={small}>Horário: {alerts?.horaRestart || '-'}</div>
        </div>

        <div style={card}>
          <div style={label}>Players agora</div>
          <div style={{ ...value, color: players?.online?.ok ? '#22c55e' : '#ef4444' }}>
            {playersOnline} / {playersMax}
          </div>
          <div style={small}>{players?.online?.name || 'Servidor Conan'}</div>
        </div>

        <div style={card}>
          <div style={label}>Players únicos 24h</div>
          <div style={value}>{unique24h}</div>
          <div style={small}>Baseado em Steam IDs nos logs</div>
        </div>

        <div style={card}>
          <div style={label}>Players únicos 48h</div>
          <div style={value}>{unique48h}</div>
          <div style={small}>Baseado em Steam IDs nos logs</div>
        </div>

        <div style={card}>
          <div style={label}>Updates</div>
          <div style={{ ...value, color: updates?.updatesFound ? '#facc15' : '#22c55e' }}>
            {updates?.updatesFound ? 'Update disponível' : 'Sem updates'}
          </div>
          <div style={small}>Mods alterados: {changedMods}</div>
        </div>
      </div>
    </div>
  );
}
