'use client';

import { useEffect, useState } from 'react';

type ModUpdate = {
  modId: string;
  title?: string;
  oldDate?: string;
  newDate?: string;
  changed?: boolean;
};

export default function UpdatesManager() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const carregarStatus = async () => {
    setLoading(true);

    try {
      const res = await fetch('/api/updates');
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ success: false, error: 'Falha ao carregar status de updates.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarStatus();
  }, []);

  const verificarAgora = async () => {
    setActionLoading(true);

    try {
      const res = await fetch('/api/updates', { method: 'POST' });
      const data = await res.json();
      setStatus(data);
      alert(data.updatesFound ? 'Update encontrado.' : 'Nenhum update encontrado.');
    } catch {
      alert('Erro ao verificar updates.');
    } finally {
      setActionLoading(false);
    }
  };

  const atualizarComSeguranca = async () => {
    const ok = confirm(
      'Executar atualização segura agora?\n\n' +
      'O painel enviará aviso RCON, criará backup seguro, reiniciará o Conan e aplicará updates no start.\n\n' +
      'Use somente em horário seguro.'
    );

    if (!ok) return;

    setActionLoading(true);

    try {
      const res = await fetch('/api/updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceUpdate: true })
      });

      const data = await res.json();
      setStatus(data);
      alert(data.message || 'Processo de atualização solicitado.');
    } catch {
      alert('Erro ao solicitar atualização segura.');
    } finally {
      setActionLoading(false);
    }
  };

  const mods: ModUpdate[] = Array.isArray(status?.mods) ? status.mods : [];
  const changedCount = mods.filter((mod) => mod.changed).length;

  return (
    <div style={{ backgroundColor: '#1e1e1e', padding: '22px', borderRadius: '10px', border: '1px solid #333' }}>
      {/* UPDATES_LAYOUT_V2 */}
      <h2 style={{ marginTop: 0, color: '#f39c12', borderBottom: '1px solid #333', paddingBottom: '10px', fontSize: '22px' }}>
        🔄 Atualizações do Conan e Mods
      </h2>
      <p style={{ marginTop: '-2px', marginBottom: '18px', color: '#aaa', fontSize: '14px' }}>
        Verifique atualizações dos mods no Steam Workshop e aplique updates com backup e reinício seguro.
      </p>

      <div style={{
        backgroundColor: '#2a2412',
        border: '1px solid #8a5a00',
        borderRadius: '8px',
        color: '#facc15',
        padding: '14px',
        marginBottom: '18px'
      }}>
        <b>⚠️ Como funciona:</b><br />
        Primeiro verifique updates. Se houver alteração, use a atualização segura em horário adequado.
        O processo envia aviso RCON, cria backup e reinicia o Conan. Como <b>UPDATE_ON_START=true</b>, o jogo e os mods são atualizados quando o servidor sobe.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginBottom: '18px' }}>
        <button
          onClick={verificarAgora}
          disabled={actionLoading}
          style={{
            backgroundColor: '#3498db',
            color: '#fff',
            border: 'none',
            padding: '10px 16px',
            borderRadius: '5px',
            cursor: actionLoading ? 'wait' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          🔍 {actionLoading ? 'Verificando...' : 'Verificar updates'}
        </button>

        <button
          onClick={atualizarComSeguranca}
          disabled={actionLoading}
          style={{
            backgroundColor: '#16a34a',
            color: '#fff',
            border: 'none',
            padding: '10px 16px',
            borderRadius: '5px',
            cursor: actionLoading ? 'wait' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          🛡️ Atualizar com segurança
        </button>

        <button
          onClick={carregarStatus}
          disabled={loading}
          style={{
            backgroundColor: '#555',
            color: '#fff',
            border: 'none',
            padding: '10px 16px',
            borderRadius: '5px',
            cursor: loading ? 'wait' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          {loading ? 'Atualizando...' : '↻ Recarregar status'}
        </button>
      </div>

      <div style={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px', padding: '16px' }}>
        <h3 style={{ marginTop: 0, color: status?.updatesFound ? '#facc15' : '#22c55e' }}>
          {status
            ? status.updatesFound
              ? `⚠️ Update encontrado (${changedCount} mod/mods)`
              : '✅ Sem updates encontrados'
            : 'Carregando status...'}
        </h3>

        {status?.checkedAt && (
          <p style={{ color: '#bbb' }}>
            <b>Última checagem:</b> {status.checkedAt}
          </p>
        )}

        {status?.error && (
          <p style={{ color: '#ef4444' }}>
            <b>Erro:</b> {status.error}
          </p>
        )}

        {status?.note && (
          <div style={{
            backgroundColor: '#2a2412',
            border: '1px solid #8a5a00',
            color: '#facc15',
            padding: '10px',
            borderRadius: '5px',
            marginBottom: '12px'
          }}>
            {status.note}
          </div>
        )}

        <details open>
          <summary style={{ cursor: 'pointer', color: '#fff', fontWeight: 'bold', marginBottom: '10px' }}>
            🧩 Mods checados ({mods.length})
          </summary>

          <div style={{ display: 'grid', gap: '8px', marginTop: '10px' }}>
            {mods.length > 0 ? (
              mods.map((mod) => (
                <div key={mod.modId} style={{
                  backgroundColor: '#1e1e1e',
                  border: '1px solid #333',
                  borderRadius: '5px',
                  padding: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '10px',
                  flexWrap: 'wrap'
                }}>
                  <div>
                    <b>{mod.title || mod.modId}</b>
                    <div style={{ color: '#aaa', fontSize: '12px' }}>
                      ID Steam: {mod.modId}
                    </div>
                    <div style={{ color: '#aaa', fontSize: '12px' }}>
                      Atual: {mod.oldDate || '-'} • Workshop: {mod.newDate || '-'}
                    </div>
                  </div>

                  <div style={{
                    color: mod.changed ? '#facc15' : '#22c55e',
                    fontWeight: 'bold'
                  }}>
                    {mod.changed ? 'Atualização disponível' : 'OK'}
                  </div>
                </div>
              ))
            ) : (
              <p style={{ color: '#aaa' }}>Nenhum mod carregado ainda.</p>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}
