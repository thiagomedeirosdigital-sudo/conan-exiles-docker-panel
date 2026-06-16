'use client';

import { useEffect, useRef, useState } from 'react';
import ConfirmModal, { type ConfirmDialogData } from './ConfirmModal';

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
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro' | 'aviso'; texto: string } | null>(null);

  const confirmResolver = useRef<((value: boolean) => void) | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogData | null>(null);

  const pedirConfirmacao = (titulo: string, mensagem: string, confirmarTexto: string) => {
    return new Promise<boolean>((resolve) => {
      confirmResolver.current = resolve;
      setConfirmDialog({ titulo, mensagem, confirmarTexto });
    });
  };

  const fecharConfirmacao = (confirmado: boolean) => {
    if (confirmResolver.current) {
      confirmResolver.current(confirmado);
      confirmResolver.current = null;
    }
    setConfirmDialog(null);
  };


  const verificarPlayersOnline = async () => {
    try {
      const res = await fetch('/api/players');
      const data = await res.json();

      const players = Number(data?.online?.players || 0);
      const maxPlayers = Number(data?.online?.maxPlayers || 0);

      return {
        players,
        maxPlayers,
        temPlayers: players > 0
      };
    } catch {
      return {
        players: 0,
        maxPlayers: 0,
        temPlayers: false
      };
    }
  };

  const montarAvisoPlayers = (playersInfo: { players: number; maxPlayers: number; temPlayers: boolean }) => {
    if (!playersInfo.temPlayers) {
      return 'Nenhum jogador online detectado agora. Mesmo assim, confirme apenas se tiver certeza.';
    }

    return `⚠️ Existem ${playersInfo.players}/${playersInfo.maxPlayers || '?'} jogadores online agora. Atualizar pode reiniciar o servidor. Evite fazer isso com jogadores conectados.`;
  };



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
    setFeedback(null);

    try {
      const res = await fetch('/api/updates', { method: 'POST' });
      const data = await res.json();
      setStatus(data);
      setFeedback({
        tipo: data.updatesFound ? 'aviso' : 'sucesso',
        texto: data.updatesFound ? 'Update encontrado. Confira os mods listados abaixo.' : 'Nenhum update encontrado no momento.'
      });
    } catch {
      setFeedback({ tipo: 'erro', texto: 'Erro ao verificar updates.' });
    } finally {
      setActionLoading(false);
    }
  };

  const atualizarComSeguranca = async () => {
    // UPDATES_PLAYERS_ONLINE_WARNING_V1
    const playersInfo = await verificarPlayersOnline();

    const ok = await pedirConfirmacao(
      'Executar Atualização Segura?',
      `${montarAvisoPlayers(playersInfo)}\n\nO painel enviará aviso RCON, criará backup seguro, reiniciará o Conan e aplicará updates no start.`,
      playersInfo.temPlayers ? 'Confirmar mesmo com players online' : 'Executar atualização segura'
    );

    if (!ok) return;

    setActionLoading(true);
    setFeedback({ tipo: 'aviso', texto: 'Atualização segura solicitada. Aguarde o processo iniciar...' });

    try {
      const res = await fetch('/api/updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceUpdate: true })
      });

      const data = await res.json();
      setStatus(data);
      setFeedback({
        tipo: data.success === false ? 'erro' : 'sucesso',
        texto: data.message || 'Processo de atualização solicitado.'
      });
    } catch {
      setFeedback({ tipo: 'erro', texto: 'Erro ao solicitar atualização segura.' });
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

      {feedback && (
        <div style={{
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '16px',
          border: feedback.tipo === 'erro' ? '1px solid #991b1b' : feedback.tipo === 'aviso' ? '1px solid #8a5a00' : '1px solid #16a34a',
          backgroundColor: feedback.tipo === 'erro' ? '#351212' : feedback.tipo === 'aviso' ? '#2a2412' : '#12351f',
          color: feedback.tipo === 'erro' ? '#fecaca' : feedback.tipo === 'aviso' ? '#facc15' : '#bbf7d0',
          fontWeight: 'bold'
        }}>
          {feedback.texto}
        </div>
      )}

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
      {/* UPDATES_SHARED_CONFIRM_MODAL_V1 */}
      <ConfirmModal
        dialog={confirmDialog}
        onCancel={() => fecharConfirmacao(false)}
        onConfirm={() => fecharConfirmacao(true)}
        aviso="Essa ação pode reiniciar o servidor. Confirme apenas em horário seguro."
      />
    </div>
  );
}
