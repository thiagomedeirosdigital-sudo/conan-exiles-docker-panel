'use client';

import { useEffect, useRef, useState } from 'react';

type BackupItem = {
  filename: string;
  name?: string;
  type?: string;
  size?: string;
  sizeMB?: string;
  date?: string;
  modifiedAt?: string;
};

type BackupsResponse = {
  safeBackups?: BackupItem[];
};

export default function BackupManager() {
  const [safeBackups, setSafeBackups] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'sucesso' | 'erro' | 'aviso'; texto: string } | null>(null);

  const confirmResolver = useRef<((value: boolean) => void) | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    titulo: string;
    mensagem: string;
    confirmarTexto: string;
    tipo?: 'perigo' | 'aviso';
  } | null>(null);

  const pedirConfirmacao = (
    titulo: string,
    mensagem: string,
    confirmarTexto: string,
    tipo: 'perigo' | 'aviso' = 'aviso'
  ) => {
    return new Promise<boolean>((resolve) => {
      confirmResolver.current = resolve;
      setConfirmDialog({ titulo, mensagem, confirmarTexto, tipo });
    });
  };

  const fecharConfirmacao = (confirmado: boolean) => {
    if (confirmResolver.current) {
      confirmResolver.current(confirmado);
      confirmResolver.current = null;
    }

    setConfirmDialog(null);
  };

  const carregarBackups = async () => {
    try {
      const res = await fetch('/api/backups');
      const data: BackupsResponse = await res.json();

      setSafeBackups(Array.isArray(data.safeBackups) ? data.safeBackups : []);
    } catch {
      setFeedback({ tipo: 'erro', texto: 'Erro ao carregar backups.' });
    }
  };

  useEffect(() => {
    carregarBackups();
  }, []);

  const criarBackupSeguro = async () => {
    const ok = await pedirConfirmacao(
      'Criar Backup Seguro?',
      'O Conan será parado temporariamente para copiar banco, WAL/SHM e configurações com segurança.',
      'Criar backup seguro',
      'aviso'
    );

    if (!ok) return;

    setLoading(true);
    setFeedback({ tipo: 'aviso', texto: 'Criando backup seguro. Aguarde...' });

    try {
      const res = await fetch('/api/backups', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        setFeedback({ tipo: 'sucesso', texto: data.message || 'Backup seguro criado com sucesso.' });
        await carregarBackups();
      } else {
        setFeedback({ tipo: 'erro', texto: data.error || data.message || 'Falha ao criar backup seguro.' });
      }
    } catch {
      setFeedback({ tipo: 'erro', texto: 'Erro de comunicação ao criar backup seguro.' });
    } finally {
      setLoading(false);
    }
  };

  const restaurarBackupSeguro = async (backupName: string) => {
    const ok = await pedirConfirmacao(
      'Restaurar Backup Seguro?',
      `O backup ${backupName} será restaurado. O Conan será parado, o banco atual será salvo em um backup de emergência e depois o backup escolhido será aplicado.`,
      'Restaurar backup',
      'perigo'
    );

    if (!ok) return;

    setLoading(true);
    setFeedback({ tipo: 'aviso', texto: 'Restaurando backup seguro. Aguarde...' });

    try {
      const res = await fetch('/api/backups/restore-safe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backupName,
          confirm: 'RESTAURAR_BACKUP_SEGURO',
          restoreConfig: false
        })
      });

      const data = await res.json();

      if (data.success) {
        setFeedback({
          tipo: 'sucesso',
          texto: `${data.message || 'Backup restaurado com sucesso.'} Backup de emergência: ${data.emergencyBackup || '-'}`
        });
        await carregarBackups();
      } else {
        setFeedback({ tipo: 'erro', texto: data.error || 'Falha ao restaurar backup seguro.' });
      }
    } catch {
      setFeedback({ tipo: 'erro', texto: 'Erro de comunicação ao restaurar backup seguro.' });
    } finally {
      setLoading(false);
    }
  };

  const excluirBackupSeguro = async (backupName: string) => {
    const ok = await pedirConfirmacao(
      'Excluir Backup Seguro?',
      `O backup ${backupName} será excluído permanentemente. Essa ação apaga a pasta inteira desse backup e não pode ser desfeita.`,
      'Excluir backup',
      'perigo'
    );

    if (!ok) return;

    setLoading(true);
    setFeedback({ tipo: 'aviso', texto: 'Excluindo backup seguro. Aguarde...' });

    try {
      const res = await fetch('/api/backups/delete-safe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backupName,
          confirm: 'EXCLUIR_BACKUP_SEGURO'
        })
      });

      const data = await res.json();

      if (data.success) {
        setFeedback({ tipo: 'sucesso', texto: data.message || 'Backup seguro excluído.' });
        await carregarBackups();
      } else {
        setFeedback({ tipo: 'erro', texto: data.error || 'Falha ao excluir backup seguro.' });
      }
    } catch {
      setFeedback({ tipo: 'erro', texto: 'Erro de comunicação ao excluir backup seguro.' });
    } finally {
      setLoading(false);
    }
  };

  const nomeBackup = (backup: BackupItem) => backup.filename || backup.name || '';

  return (
    <div style={{ backgroundColor: '#1e1e1e', padding: '22px', borderRadius: '10px', color: '#fff', border: '1px solid #333' }}>
      {/* BACKUP_LAYOUT_SAFE_ONLY_V3 */}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, color: '#f39c12' }}>💾 Backups do Servidor</h2>
          <p style={{ marginTop: '6px', color: '#cbd5e1' }}>
            Gerencie apenas backups seguros do Conan. Tudo relacionado a backup antigo/legacy foi removido da tela.
          </p>
        </div>

        <button
          onClick={criarBackupSeguro}
          disabled={loading}
          style={{
            backgroundColor: '#16a34a',
            color: '#fff',
            border: 'none',
            padding: '10px 16px',
            borderRadius: '6px',
            cursor: loading ? 'wait' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          🛡️ Criar Backup Seguro
        </button>
      </div>

      {feedback && (
        <div style={{
          marginTop: '14px',
          padding: '12px',
          borderRadius: '8px',
          border: feedback.tipo === 'erro' ? '1px solid #991b1b' : feedback.tipo === 'aviso' ? '1px solid #8a5a00' : '1px solid #16a34a',
          backgroundColor: feedback.tipo === 'erro' ? '#351212' : feedback.tipo === 'aviso' ? '#2a2412' : '#12351f',
          color: feedback.tipo === 'erro' ? '#fecaca' : feedback.tipo === 'aviso' ? '#facc15' : '#bbf7d0',
          fontWeight: 'bold'
        }}>
          {feedback.texto}
        </div>
      )}

      {loading && (
        <div style={{ marginTop: '12px', padding: '10px', backgroundColor: '#2a2a2a', border: '1px solid #444', borderRadius: '6px' }}>
          Processando...
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px', marginTop: '18px' }}>
        <div style={{ background: '#151515', border: '1px solid #166534', borderRadius: '8px', padding: '14px' }}>
          <strong style={{ color: '#86efac', display: 'block', fontSize: '15px' }}>🛡️ Backups seguros</strong>
          <span style={{ color: '#fff', fontSize: '24px', fontWeight: 'bold' }}>{safeBackups.length}</span>
          <p style={{ margin: '6px 0 0', color: '#aaa', fontSize: '12px' }}>Indicados para restauração.</p>
        </div>

        <div style={{ background: '#151515', border: '1px solid #7f1d1d', borderRadius: '8px', padding: '14px' }}>
          <strong style={{ color: '#fecaca', display: 'block', fontSize: '15px' }}>⚠️ Atenção</strong>
          <p style={{ margin: '6px 0 0', color: '#ddd', fontSize: '12px' }}>
            Restaurar backup altera o estado atual do servidor. Use com cuidado.
          </p>
        </div>
      </div>

      <h3 style={{ marginTop: '24px', color: '#f39c12', borderBottom: '1px solid #333', paddingBottom: '8px' }}>
        🛡️ Backups seguros disponíveis
      </h3>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '12px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #444' }}>
            <th style={{ textAlign: 'left', padding: '10px' }}>Data / Hora</th>
            <th style={{ textAlign: 'left', padding: '10px' }}>Nome do backup</th>
            <th style={{ textAlign: 'left', padding: '10px' }}>Tamanho DB</th>
            <th style={{ textAlign: 'right', padding: '10px' }}>Ações seguras</th>
          </tr>
        </thead>

        <tbody>
          {safeBackups.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ padding: '18px', textAlign: 'center', color: '#aaa' }}>
                Nenhum backup seguro encontrado. Clique em “Criar Backup Seguro” para gerar o primeiro.
              </td>
            </tr>
          ) : (
            safeBackups.map((backup) => {
              const name = nomeBackup(backup);

              return (
                <tr key={name} style={{ borderBottom: '1px solid #333' }}>
                  <td style={{ padding: '10px' }}>{backup.date || backup.modifiedAt || '-'}</td>
                  <td style={{ padding: '10px', fontFamily: 'monospace' }}>{name}</td>
                  <td style={{ padding: '10px' }}>
                    <span style={{ backgroundColor: '#333', padding: '3px 7px', borderRadius: '4px' }}>
                      {backup.size || backup.sizeMB || '-'}
                    </span>
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>
                    <button
                      onClick={() => restaurarBackupSeguro(name)}
                      disabled={loading}
                      style={{
                        backgroundColor: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        padding: '7px 10px',
                        borderRadius: '4px',
                        marginRight: '8px',
                        cursor: loading ? 'wait' : 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      🔁 Restaurar seguro
                    </button>

                    <button
                      onClick={() => excluirBackupSeguro(name)}
                      disabled={loading}
                      style={{
                        backgroundColor: '#7f1d1d',
                        color: '#fff',
                        border: 'none',
                        padding: '7px 10px',
                        borderRadius: '4px',
                        cursor: loading ? 'wait' : 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      Excluir seguro
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {confirmDialog && (
        <div
          /* BACKUP_CONFIRM_MODAL_V1 */
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.72)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div style={{
            width: '100%',
            maxWidth: '480px',
            backgroundColor: '#1e1e1e',
            border: confirmDialog.tipo === 'perigo' ? '1px solid #dc2626' : '1px solid #f39c12',
            borderRadius: '12px',
            padding: '22px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.45)'
          }}>
            <h2 style={{
              marginTop: 0,
              marginBottom: '10px',
              color: confirmDialog.tipo === 'perigo' ? '#f87171' : '#f39c12',
              fontSize: '20px'
            }}>
              ⚠️ {confirmDialog.titulo}
            </h2>

            <p style={{ color: '#ddd', fontSize: '14px', lineHeight: 1.5, marginBottom: '18px' }}>
              {confirmDialog.mensagem}
            </p>

            <div style={{
              backgroundColor: '#2a2412',
              border: '1px solid #8a5a00',
              color: '#facc15',
              borderRadius: '8px',
              padding: '10px',
              fontSize: '13px',
              marginBottom: '18px'
            }}>
              Backups são ações críticas. Confirme apenas se tiver certeza.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => fecharConfirmacao(false)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '6px',
                  border: '1px solid #444',
                  backgroundColor: '#2a2a2a',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => fecharConfirmacao(true)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: confirmDialog.tipo === 'perigo' ? '#dc2626' : '#f39c12',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {confirmDialog.confirmarTexto}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
