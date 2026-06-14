'use client';

import { useEffect, useState } from 'react';

export default function MaintenanceManager() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const carregar = async () => {
    setLoading(true);

    try {
      const res = await fetch('/api/maintenance');
      const json = await res.json();
      setData(json);
    } catch {
      setData({ success: false, error: 'Falha ao carregar manutenção.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const box = {
    backgroundColor: '#1e1e1e',
    border: '1px solid #333',
    borderRadius: '8px',
    padding: '16px'
  };

  const title = {
    color: '#f39c12',
    marginTop: 0,
    marginBottom: '12px'
  };

  const pre = {
    backgroundColor: '#111',
    color: '#ddd',
    border: '1px solid #333',
    borderRadius: '6px',
    padding: '12px',
    overflowX: 'auto' as const,
    whiteSpace: 'pre-wrap' as const,
    maxHeight: '320px',
    fontSize: '12px'
  };

  return (
    <div style={{ backgroundColor: '#1e1e1e', padding: '20px', borderRadius: '8px', border: '1px solid #333' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ marginTop: 0, color: '#f39c12', fontSize: '20px' }}>🛠️ Manutenção do Servidor</h2>
          <p style={{ color: '#bbb', marginTop: 0 }}>
            Diagnóstico geral de disco, backups, cron, scripts e logs recentes.
          </p>
        </div>

        <button
          onClick={carregar}
          disabled={loading}
          style={{
            backgroundColor: '#3498db',
            color: '#fff',
            border: 'none',
            padding: '10px 16px',
            borderRadius: '5px',
            cursor: loading ? 'wait' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          {loading ? 'Atualizando...' : '🔄 Atualizar diagnóstico'}
        </button>
      </div>

      {data?.error && (
        <div style={{ backgroundColor: '#3f1111', border: '1px solid #7f1d1d', color: '#fecaca', padding: '12px', borderRadius: '6px', marginTop: '12px' }}>
          {data.error}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '12px',
        marginTop: '18px'
      }}>
        <div style={box}>
          <h3 style={title}>Disco</h3>
          <pre style={pre}>{data?.disk || 'Carregando...'}</pre>
        </div>

        <div style={box}>
          <h3 style={title}>Tamanhos</h3>
          <div style={{ color: '#ddd', lineHeight: 1.8 }}>
            <div><b>Backups:</b> {data?.sizes?.backupsSafe || '-'}</div>
            <div><b>Save:</b> {data?.sizes?.saved || '-'}</div>
            <div><b>Mods:</b> {data?.sizes?.mods || '-'}</div>
            <div><b>Painel:</b> {data?.sizes?.panel || '-'}</div>
          </div>
        </div>

        <div style={box}>
          <h3 style={title}>Scripts</h3>
          <div style={{ color: '#ddd', lineHeight: 1.8 }}>
            <div>{data?.scripts?.backupSafe ? '✅' : '❌'} Backup seguro</div>
            <div>{data?.scripts?.autoUpdate ? '✅' : '❌'} Auto update</div>
            <div>{data?.scripts?.safeRestart ? '✅' : '❌'} Restart seguro</div>
          </div>
        </div>

        <div style={box}>
          <h3 style={title}>Última checagem</h3>
          <div style={{ color: '#ddd' }}>{data?.checkedAt || '-'}</div>
        </div>
      </div>

      {data?.logs?.modCompatibilityIssues && (
        <div style={{
          marginTop: '18px',
          backgroundColor: '#3b1d1d',
          border: '1px solid #ef4444',
          borderRadius: '8px',
          padding: '16px',
          color: '#fecaca'
        }}>
          <h3 style={{ color: '#fca5a5', marginTop: 0 }}>⚠️ Mods incompatíveis detectados</h3>
          <p style={{ marginTop: 0 }}>
            O Conan encontrou mods desatualizados, corrompidos ou incompatíveis com a versão atual do jogo.
          </p>
          <pre style={pre}>{data.logs.modCompatibilityIssues}</pre>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px', marginTop: '18px' }}>
        <div style={box}>
          <h3 style={title}>Crontab</h3>
          <pre style={pre}>{data?.crontab || 'Sem crontab encontrado.'}</pre>
        </div>

        <div style={box}>
          <h3 style={title}>Últimos backups seguros</h3>
          <pre style={pre}>{data?.latestBackups || 'Nenhum backup listado.'}</pre>
        </div>

        <div style={box}>
          <h3 style={title}>Log do backup seguro</h3>
          <pre style={pre}>{data?.logs?.backup || 'Sem log.'}</pre>
        </div>

        <div style={box}>
          <h3 style={title}>Log do auto update</h3>
          <pre style={pre}>{data?.logs?.update || 'Sem log.'}</pre>
        </div>

        <div style={box}>
          <h3 style={title}>Log do restart seguro</h3>
          <pre style={pre}>{data?.logs?.restart || 'Sem log.'}</pre>
        </div>

        <div style={box}>
          <h3 style={title}>Erros/Avisos recentes do Conan</h3>
          <pre style={pre}>{data?.logs?.conanErrors || 'Nenhum erro/aviso recente encontrado no filtro.'}</pre>
        </div>
      </div>
    </div>
  );
}
